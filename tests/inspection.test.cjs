'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const scopes=require('../ui/scope-math.js'),math=require('../ui/look-math.js'),exportsModule=require('../src/look-export.cjs'),{sampler,sonyEncode,sonyDecode}=require('../src/look-adapter.cjs'),media=require('../src/media.cjs');
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<=t,`${a} vs ${b}`);
function cube(scale=1){const rows=[];for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++)rows.push([r,g,b].map(v=>v*scale).join(' '));return Buffer.from('LUT_3D_SIZE 2\n'+rows.join('\n')+'\n');}
test('Scopes locate RGB endpoints, exclude alpha and preserve waveform image positions',()=>{
 const pixels=new Uint8ClampedArray([0,0,0,255,255,0,0,0,255,255,255,255]);
 const h=scopes.histogram(pixels);assert.equal(h.combined.reduce((a,b)=>a+b,0),9);assert.equal(h.rgb[0][255],2);assert.equal(h.rgb[1][255],1);assert.equal(h.rgb[2][0],2);
 const w=scopes.waveform(pixels,3,1,{columns:3,rows:101});assert.equal(w.planes[0][100*3],1);assert.equal(w.planes[0][79*3+1],1);assert.equal(w.planes[0][2],1);
 const p=scopes.waveform(pixels,3,1,{parade:true,columns:3,rows:101});assert.equal(p.planes[0][1],1);assert.equal(p.planes[1][100*3+1],1);
 const c=scopes.clipping(pixels,{mask:true});assert.deepEqual(c.white,[2,1,1]);assert.equal(c.shadowPixels,1);assert.equal(c.highlightPixels,2);assert.equal(c.overlay[2],255);assert.equal(c.overlay[4],255);
});
test('Vectorscope uses published Rec.709 primary landmarks and puts neutrals at centre',()=>{
 near(scopes.luma(1,0,0),.2126,1e-12);near(scopes.luma(0,1,0),.7152,1e-12);near(scopes.luma(0,0,1),.0722,1e-12);
 const [cb,cr]=scopes.chroma(1,0,0);near(cb,-.2126/1.8556,1e-12);near(cr,.5,1e-12);const neutral=scopes.vectorscope(new Uint8ClampedArray([128,128,128,255]),101);assert.equal(neutral.counts[50*101+50],1);
 const red=scopes.vectorscope(new Uint8ClampedArray([255,0,0,255]),101);assert.equal(red.counts[Math.round((cb+.5)*100)],1);
});
test('Portable adjusted LUT matches independent post-LUT math and original source exposure',()=>{
 const bytes=cube(.8),a={exposure:0,warmth:0,tint:0,contrast:1.2,saturation:.7},baked=exportsModule.bake(bytes,'sony-slog3-sgamut3cine',a),apply=sampler(baked),rgb=[.45,.37,.22],contrast=rgb.map(v=>(v*.8-.5)*1.2+.5),y=contrast[0]*.2126+contrast[1]*.7152+contrast[2]*.0722;
 apply(rgb).forEach((v,i)=>near(v,y+(contrast[i]-y)*.7,2e-8));
 const source=math.pipeline('sony-slog3-sgamut3cine',v=>v,{exposure:1});source(rgb).forEach((v,i)=>near(v,sonyEncode(sonyDecode(rgb[i])*2),1e-12));
 assert.throws(()=>math.pipeline('unknown',v=>v,{exposure:1}),/Confirm/);assert.throws(()=>math.settings({contrast:Infinity}),/Invalid/);math.pipeline('unknown',v=>v,{enabled:false,exposure:1})(rgb).forEach((v,i)=>near(v,rgb[i],1e-12));
 assert.match(baked.toString(),/33-point approximation/);assert.match(baked.toString(),/Input profile: sony-slog3/);
});
test('Full-resolution export processes original RGB48 pixels and retains 16-bit PNG dimensions',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-full-export-')),raw=path.join(root,'in.rgb48le'),source=path.join(root,'source.png'),lut=path.join(root,'look.cube'),target=path.join(root,'out.png'),decoded=path.join(root,'out.rgb48le');
 try{
  const values=Buffer.alloc(40*24*6);for(let i=0;i<values.length;i+=6)for(let c=0;c<3;c++)values.writeUInt16LE([30000,20000,10000][c],i+c*2);fs.writeFileSync(raw,values);fs.writeFileSync(lut,cube(.8));
  await media.run(media.ffmpeg,['-v','error','-f','rawvideo','-pixel_format','rgb48le','-video_size','40x24','-i',raw,'-frames:v','1','-pix_fmt','rgb48be','-y',source]);
  const size=await exportsModule.render(source,lut,'rec709',{contrast:1.2,saturation:.7},target);assert.deepEqual(size,{width:40,height:24});
  const info=JSON.parse((await media.run(media.ffprobe,['-v','error','-show_streams','-of','json',target])).output).streams[0];assert.equal(info.pix_fmt,'rgb48be');
  await media.run(media.ffmpeg,['-v','error','-i',target,'-frames:v','1','-pix_fmt','rgb48le','-f','rawvideo','-y',decoded]);const actual=fs.readFileSync(decoded),c=[30000,20000,10000].map(v=>(v/65535*.8-.5)*1.2+.5),y=c[0]*.2126+c[1]*.7152+c[2]*.0722;
  for(let i=0;i<actual.length;i+=6)for(let k=0;k<3;k++)near(actual.readUInt16LE(i+k*2)/65535,Math.max(0,Math.min(1,y+(c[k]-y)*.7)),1.1/65535);
  assert.deepEqual(fs.readFileSync(raw),values);assert.ok(!fs.readdirSync(root).some(f=>f.endsWith('-out.rgb48le')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('HTTP adjusted exports enforce project/profile matching and do not change the library',async()=>{
 const {startServer}=require('../src/server.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-export-http-'));let app;
 try{
  app=await startServer({root,port:0});const p=app.store.state().projects[0].id;fs.writeFileSync(path.join(root,'luts','test.cube'),cube());
  app.store.change(()=>{app.store.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip',p,'test.mov','','rec709','{}']);app.store.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256) VALUES (?,?,?,?,?,?,?,?,?,?)',['scene',p,'clip','Original',0,'0','1/24','frames/test.png','frames/test.jpg','frame-hash']);app.store.db.run('INSERT INTO luts(id,name,original_name,sha256,asset,size,input,output,details) VALUES (?,?,?,?,?,?,?,?,?)',['lut','Test','Test.cube','lut-hash','luts/test.cube',2,'rec709','rec709','{}']);});
  const page=await fetch(app.url),html=await page.text(),boot=JSON.parse(html.match(/id="product-boot"[^>]*>([\s\S]*?)<\/script>/)[1]),headers={Cookie:page.headers.get('set-cookie').split(';')[0],'X-LUT-Token':boot.token,'Content-Type':'application/json'};
  const call=async payload=>{const response=await fetch(app.url+'/api/call',{method:'POST',headers,body:JSON.stringify({method:'exportLook',payload})});return {response,data:await response.json()};},before=app.store.state();
  let out=await call({projectId:'wrong',sceneId:'scene',lutId:'lut',format:'cube'});assert.equal(out.response.status,400);assert.match(out.data.error,/another project/);
  out=await call({projectId:p,sceneId:'scene',lutId:'lut',format:'cube',adjustments:{contrast:1.1}});assert.equal(out.response.status,200);const download=await fetch(app.url+'/'+out.data.data.url,{headers});assert.equal(download.status,200);assert.match(await download.text(),/LUT_3D_SIZE 33/);assert.deepEqual(app.store.state(),before);
  const twice=await fetch(app.url+'/'+out.data.data.url,{headers});assert.equal(twice.status,400);
 }finally{if(app)await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('Full-resolution inspection queues requests, cancels stale work and leaves the library writer available',async()=>{
 const {startServer}=require('../src/server.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-inspection-queue-'));let app,release,entered;
 const originalRun=media.run,gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>entered=resolve);
 try{
  app=await startServer({root,port:0});const projectId=app.store.state().projects[0].id;
  await media.run(media.ffmpeg,['-v','error','-f','lavfi','-i','color=gray:size=40x24','-frames:v','1','-pix_fmt','rgb48be','-y',path.join(root,'frames/test.png')]);
  app.store.change(()=>{app.store.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip',projectId,'Test','unused','rec709','{}']);app.store.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256) VALUES (?,?,?,?,?,?,?,?,?,?)',['scene',projectId,'clip','Original',0,'0','1/24','frames/test.png','frames/test.png','queue-frame']);});
  const page=await fetch(app.url),html=await page.text(),boot=JSON.parse(html.match(/id="product-boot"[^>]*>([\s\S]*?)<\/script>/)[1]),headers={Cookie:page.headers.get('set-cookie').split(';')[0],'X-LUT-Token':boot.token,'Content-Type':'application/json'};
  const call=(method,payload,signal)=>fetch(app.url+'/api/call',{method:'POST',headers,body:JSON.stringify({method,payload:{projectId,...payload}}),signal});
  let intercepted=false;media.run=async(...args)=>{if(!intercepted&&args[1].includes('-f')&&args[1].at(-1).endsWith('.rgb48le')){intercepted=true;entered();await gate;}return originalRun(...args);};
  const controller=new AbortController(),stale=call('inspectStill',{sceneId:'scene',adjustments:{exposure:.5}},controller.signal).catch(e=>e);
  await started;const before=app.store.state(),write=await call('updateScene',{id:'scene',name:'Renamed during inspection',tags:'',collections:[],expectedRevision:require('../src/metadata.cjs').revision(app.store.one('SELECT * FROM scenes WHERE id=?',['scene']))});assert.equal(write.status,200);
  const latest=call('inspectStill',{sceneId:'scene',adjustments:{exposure:1}});controller.abort();release();assert.equal((await stale).name,'AbortError');
  const response=await latest,data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.data.width,40);assert.equal(data.data.height,24);assert.equal((await fetch(app.url+'/'+data.data.url,{headers})).status,200);
  assert.equal(app.store.state().scenes[0].name,'Renamed during inspection');assert.deepEqual(app.store.state().luts,before.luts);assert.ok(!fs.readdirSync(path.join(root,'cache')).some(f=>f.endsWith('.rgb48le')));
 }finally{release?.();media.run=originalRun;if(app)await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
