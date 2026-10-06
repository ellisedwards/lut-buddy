const test=require('node:test'),assert=require('node:assert/strict'),nav=require('../ui/look-navigation.js'),adapter=require('../src/look-adapter.cjs'),{parseCube}=require('../src/cube.cjs');
const identity=()=>Buffer.from('LUT_3D_SIZE 2\n'+[0,1].flatMap(b=>[0,1].flatMap(g=>[0,1].map(r=>`${r} ${g} ${b}`))).join('\n'));
test('Apple curve matches independent published OpenColorIO test values and neutral adaptation preserves exposure',()=>{
 for(const [v,expected]of [[.5,.198913991],[.4,.083076466024],[.3,.0315782763]])assert.ok(Math.abs(adapter.appleDecode(v)-expected)<2e-6);
 assert.ok(Math.abs(adapter.sonyEncode(.18)-420/1023)<1e-12);
 for(const v of [-.05,0,.01,.01125,.18,1,10])assert.ok(Math.abs(adapter.sonyDecode(adapter.sonyEncode(v))-v)<1e-10);
 for(const v of [0,.1,.3,.5,.7,1]){const result=adapter.toSony([v,v,v]);for(const c of result)assert.ok(Math.abs(c-adapter.sonyEncode(adapter.appleDecode(v)))<1e-10);}
});
test('Adapted CUBE uses a finite 33-point red-fastest grid and retains the complete source pipeline at lattice points',()=>{
 const bytes=identity(),baked=adapter.bake(bytes,'Test'),sample=adapter.sampler(baked);assert.equal(parseCube(baked).size,33);assert.equal(parseCube(bytes).size,2);
 for(const rgb of [[0,0,0],[1,1,1],[.5,.25,.75],[.125,.5,.25]]){const expected=adapter.toSony(rgb).map(v=>Math.max(0,Math.min(1,v))),actual=sample(rgb);for(let i=0;i<3;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-8);}
});
test('Linked versions keep the look across cameras, remember absent variants, and keep No LUT explicit',()=>{
 const source={name:'sony',code:'LCS',sha256:'source',input:'unknown',legacy:true},copy={name:'apple',code:'LCS',sha256:'derived',lookFamilySha:'source',input:'apple-log2'},other={name:'other',code:'LCS',sha256:'other',input:'apple-log2'};
 assert.equal(nav.canShareCode(source,copy),true);assert.equal(nav.canShareCode(source,other),false);assert.equal(nav.canShareCode(copy,{...copy,input:'apple-log2'}),false);
 assert.deepEqual(nav.resolve([source,copy],'sony','',n=>n==='apple'),{name:'apple',family:'source'});
 assert.deepEqual(nav.resolve([source,copy],'','source',n=>n==='sony'),{name:'sony',family:'source'});
 assert.deepEqual(nav.resolve([source,copy],'','',()=>true),{name:'',family:''});
 assert.deepEqual(nav.resolve([source],'sony','',()=>false),{name:'',family:'source'});
});
test('Device grouping uses recorded models, keeping unknown devices separate from camera profiles',()=>{
 assert.equal(nav.device({available:true,display:'ILCE-7M4'}).label,'Sony · A7 IV');assert.equal(nav.device({available:true,display:'iPhone 17 Pro Max'}).key,'iPhone 17 Pro Max');assert.equal(nav.device({available:false,display:'ILCE-7M4'}).key,'__unknown');
});
test('Adapted look imports once, retains source stars and codes, and survives a portable-project round trip',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{Store}=require('../src/store.cjs'),{startServer}=require('../src/server.cjs'),files=require('../src/project-files.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-adapter-test-')),target=fs.mkdtempSync(path.join(os.tmpdir(),'lut-adapter-open-')),s=await Store.open(root),p=s.state().projects[0].id,bytes=identity(),sha=parseCube(bytes).sha256;fs.writeFileSync(path.join(root,'luts/source.cube'),bytes);
 s.change(()=>{s.db.run('INSERT INTO luts(id,name,original_name,sha256,asset,size,input,output,favourite,details) VALUES (?,?,?,?,?,?,?,?,?,?)',['source','Source','source.cube',sha,'luts/source.cube',2,'unknown','unknown',1,JSON.stringify({legacy:true,code:'LCS'})]);s.db.run('INSERT INTO ui_state VALUES (?,?,?)',[p,'initial',JSON.stringify({favourites:['source.cube'],adjustments:{},sceneDevice:'iPhone 17 Pro Max'})]);});s.close();const app=await startServer({root,port:0});let opened;
 try{const r=await fetch(app.url),h=await r.text(),boot=JSON.parse(h.match(/id="product-boot"[^>]*>([\s\S]*?)<\/script>/)[1]),headers={Cookie:r.headers.get('set-cookie').split(';')[0],'X-LUT-Token':boot.token,'Content-Type':'application/json'},call=async(method,payload={})=>{const r=await fetch(app.url+'/api/call',{method:'POST',headers,body:JSON.stringify({method,payload:{projectId:p,...payload}})}),x=await r.json();assert.equal(r.status,200,x.error);return x.data;};
  const derived=await call('adaptLut',{id:'source'});assert.equal(derived.code,'LCS');assert.equal((await call('adaptLut',{id:'source'})).duplicate,true);const current=await call('state');assert.equal(current.luts.length,2);assert.ok(current.luts.every(l=>l.favourite));assert.deepEqual(fs.readFileSync(path.join(root,'luts/source.cube')),bytes);
  const invalid=await fetch(app.url+'/api/call',{method:'POST',headers,body:JSON.stringify({method:'updateLut',payload:{projectId:p,id:'source',name:'Source',input:'apple-log2',output:'rec709',code:'LCS',favourite:true}})});assert.equal(invalid.status,400);assert.equal((await call('state')).luts.find(l=>l.id==='source').input,'unknown');
  const review=await call('reviewItems',{kind:'lut',ids:[derived.id]});await call('updateBatch',{kind:'lut',items:[{id:derived.id,expectedRevision:review[0].revision,fields:{name:'Edited adaptation'}}]});
  const exportResult=await call('saveProject'),archive=Buffer.from(await (await fetch(app.url+'/'+exportResult.url,{headers})).arrayBuffer()),file=path.join(target,'saved.lutproject');fs.writeFileSync(file,archive);opened=await Store.open(target);const result=await files.open(opened,file),luts=opened.state().luts;assert.equal(luts.length,2);assert.ok(luts.every(l=>JSON.parse(l.details).code==='LCS'));assert.equal(JSON.parse(opened.one('SELECT state FROM ui_state WHERE project_id=?',[result.projectId]).state).sceneDevice,'iPhone 17 Pro Max');assert.equal(new Set(luts.map(nav.family)).size,1);
 }finally{opened?.db.close();await app.close();fs.rmSync(root,{recursive:true,force:true});fs.rmSync(target,{recursive:true,force:true});}
});
test('An older loaded LUT list retains favourites for newly imported camera versions',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../ui/explorer-overlay.js'),'utf8'),fn=source.slice(source.indexOf('function restorePreferences('),source.indexOf('let hadBrowserPreferences=')),context=vm.createContext({state:{favourites:[],adjustments:{}},byName:new Map([['sony',{sha256:'source'}]]),byScene:new Map(),lookNavigation:nav,Set});vm.runInContext(fn+"\nrestorePreferences({favourites:['sony','new-iphone-version']});",context);assert.deepEqual(Array.from(context.state.favourites),['sony','new-iphone-version']);
});
