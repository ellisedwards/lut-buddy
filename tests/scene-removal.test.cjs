'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../src/store.cjs'),{startServer}=require('../src/server.cjs');
async function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-scene-removal-')),store=await Store.open(root),projectId=store.state().projects[0].id;
 for(const file of ['clips/original.mov','frames/original.png','frames/thumb.jpg','luts/look.cube'])fs.writeFileSync(path.join(root,file),'preserved '+file);
 store.change(()=>{
  store.db.run('INSERT INTO projects VALUES (?,?)',['foreign','Other project']);
  for(const p of [projectId,'foreign'])store.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip-'+p,p,'Original',path.join(root,'clips/original.mov'),'rec709','{}']);
  for(const [id,p]of [['a',projectId],['b',projectId],['c',projectId],['other','foreign']])store.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,p,'clip-'+p,id,0,'0','1/24','frames/original.png','frames/thumb.jpg','original-frame']);
  for(const id of ['one','two'])store.db.run('INSERT INTO collections VALUES (?,?,?)',[id,projectId,id]);
  for(const id of ['a','b','c'])for(const collection of ['one','two'])store.db.run('INSERT INTO memberships VALUES (?,?)',[id,collection]);
  for(const scope of ['','one','two'])['c','a','b'].forEach((id,position)=>store.db.run('INSERT INTO scene_orders VALUES (?,?,?,?)',[projectId,scope,id,position]));
  store.db.run('INSERT INTO luts(id,name,original_name,sha256,asset,size,details) VALUES (?,?,?,?,?,?,?)',['look','Look','look.cube','lut-hash','luts/look.cube',2,'{"code":"AAA"}']);
  store.db.run('INSERT INTO ui_state VALUES (?,?,?)',[projectId,'initial',JSON.stringify({scene:'b',favourites:['look.cube'],adjustments:{b:{exposure:.5}}})]);
 });store.close();
 const app=await startServer({root,port:0});return {root,projectId,app};
}
async function client(app,projectId){
 const page=await fetch(app.url),html=await page.text(),cookie=page.headers.get('set-cookie').split(';')[0],token=html.match(/"token":"([a-f0-9]+)"/)[1];
 return async(method,payload={})=>{const response=await fetch(app.url+'/api/call',{method:'POST',headers:{cookie,'x-lut-token':token,'Content-Type':'application/json'},body:JSON.stringify({method,payload:{projectId,...payload}})}),result=await response.json();if(!response.ok)throw Error(result.error);return result.data;};
}
test('Bulk removal is one persistent Undo, retains assets, memberships, ordering and preferences',async()=>{
 const f=await fixture();let app=f.app;
 try{
  let call=await client(app,f.projectId);const before=app.store.state(),prefs=app.store.query('SELECT * FROM ui_state'),files=['clips/original.mov','frames/original.png','frames/thumb.jpg','luts/look.cube'].map(file=>[file,fs.readFileSync(path.join(f.root,file))]);
  const removed=await call('removeScenes',{sceneIds:['a','b']});assert.deepEqual(removed.scenes.map(s=>s.id).sort(),['c','other']);assert.equal(removed.history.undo.label,'Remove scenes');assert.equal(app.store.query('SELECT * FROM edit_history').length,1);
  for(const key of ['clips','luts','collections','memberships','sceneOrders'])assert.deepEqual(app.store.state()[key],before[key]);assert.deepEqual(app.store.query('SELECT * FROM ui_state'),prefs);for(const [file,bytes]of files)assert.deepEqual(fs.readFileSync(path.join(f.root,file)),bytes);
  await app.close();app=await startServer({root:f.root,port:0});call=await client(app,f.projectId);
  const restored=await call('undo',{expectedId:removed.history.undo.id});for(const key of Object.keys(before))assert.deepEqual(app.store.state()[key],before[key]);
  assert.deepEqual((await call('redo')).scenes.map(s=>s.id).sort(),['c','other']);
 }finally{await app.close();fs.rmSync(f.root,{recursive:true,force:true});}
});
test('Invalid and cross-project selections and disk failures never partially remove scenes',async()=>{
 const f=await fixture();try{
  const call=await client(f.app,f.projectId),before=f.app.store.state(),bytes=fs.readFileSync(f.app.store.file);
  for(const sceneIds of [[],['a','a'],['a','missing'],['a','other'],['a',null],null]){await assert.rejects(call('removeScenes',{sceneIds}));assert.deepEqual(f.app.store.state(),before);assert.deepEqual(fs.readFileSync(f.app.store.file),bytes);}
  await assert.rejects(call('remove',{id:'other'}),/another project/);
  const rename=fs.renameSync;try{fs.renameSync=(a,b)=>{if(b===f.app.store.file)throw Error('Injected publish failure');return rename(a,b);};await assert.rejects(call('removeScenes',{sceneIds:['a','b']}),/Injected publish failure/);}finally{fs.renameSync=rename;}
  assert.deepEqual(f.app.store.state(),before);assert.deepEqual(fs.readFileSync(f.app.store.file),bytes);assert.equal(f.app.store.query('SELECT * FROM edit_history').length,0);
 }finally{await f.app.close();fs.rmSync(f.root,{recursive:true,force:true});}
});
test('Emptying the entire project preserves other projects and Undo refuses an intervening edit',async()=>{
 const f=await fixture();try{
  const call=await client(f.app,f.projectId),before=f.app.store.state();const removed=await call('removeScenes',{sceneIds:['a','b','c']});assert.deepEqual(removed.scenes.map(s=>s.id),['other']);
  const page=await fetch(f.app.url),html=await page.text();assert.match(html,/<script type="application\/json" id="scenes-manifest">\[\]<\/script>/);
  const edited=await call('collection',{name:'Later collection'});await assert.rejects(call('undo',{expectedId:removed.history.undo.id}),/Another edit happened/);assert.deepEqual(f.app.store.state().scenes.map(s=>s.id),['other']);
  await call('undo',{expectedId:edited.history.undo.id});const restored=await call('undo',{expectedId:removed.history.undo.id});for(const key of Object.keys(before))assert.deepEqual(f.app.store.state()[key],before[key]);
 }finally{await f.app.close();fs.rmSync(f.root,{recursive:true,force:true});}
});
