const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {parseCube,compatible}=require('../src/cube.cjs');
const {Store}=require('../src/store.cjs');
const media=require('../src/media.cjs');
function identity(size=2){const rows=[];for(let b=0;b<size;b++)for(let g=0;g<size;g++)for(let r=0;r<size;r++)rows.push(`${r/(size-1)} ${g/(size-1)} ${b/(size-1)}`);return `TITLE "Identity"\nLUT_3D_SIZE ${size}\n${rows.join('\n')}\n`;}
test('CUBE grid/domain validation and compatibility prevent silent bad colour',()=> {
  for(const size of [17,33,65])assert.equal(parseCube(Buffer.from(identity(size))).size,size);
  for(const text of [identity().replace('0 0 0','NaN 0 0'),identity().replace('0 0 0',''),identity()+'1 0 0\n','LUT_1D_SIZE 2\n0\n1',identity().replace('LUT_3D_SIZE 2','LUT_3D_SIZE 2\nDOMAIN_MIN 1 0 0\nDOMAIN_MAX 1 1 1'),identity().replace('LUT_3D_SIZE 2','LUT_3D_SIZE 2\nLUT_3D_SIZE 2')])assert.throws(()=>parseCube(Buffer.from(text)));
  assert.equal(parseCube(Buffer.from(identity().replace('TITLE "Identity"','TITLE Official Sony title'))).title,'Official Sony title');
  assert.equal(parseCube(Buffer.from(identity().replace('TITLE "Identity"','TITLE "Look #1" # comment'))).title,'Look #1');
  assert.equal(compatible('unknown',{input:'unknown',output:'unknown'}).ok,false);
  assert.equal(compatible('sony-slog3-sgamut3cine',{input:'rec709',output:'rec709'}).ok,false);
  assert.equal(compatible('sony-slog3-sgamut3cine',{input:'sony-slog3-sgamut3cine',output:'rec709'}).ok,true);
});
test('Library autosave survives failed transactions and failed disk replacement',async()=> {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-explorer-store-')),s=await Store.open(root),before=s.state(),file=fs.readFileSync(s.file);
  assert.throws(()=>s.change(()=>s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['bad','missing','bad','bad','unknown','{}'])));
  assert.deepEqual(s.state(),before);assert.deepEqual(fs.readFileSync(s.file),file);
  const originalRename=fs.renameSync;
  try {fs.renameSync=(a,b)=>{if(b===s.file)throw new Error('Injected disk error');return originalRename(a,b);};assert.throws(()=>s.change(()=>s.db.run('INSERT INTO projects VALUES (?,?)',['new','Not saved'])),/Injected disk error/);}finally{fs.renameSync=originalRename;}
  assert.deepEqual(s.state(),before);assert.deepEqual(fs.readFileSync(s.file),file);
  s.change(()=>s.db.run('INSERT INTO projects VALUES (?,?)',['good','Saved']));
  s.close();const reopened=await Store.open(root);assert.equal(reopened.state().projects.at(-1).name,'Saved');
  assert.equal(reopened.db.exec('PRAGMA integrity_check')[0].values[0][0],'ok');
  s.close();reopened.close();fs.rmSync(root,{recursive:true});
});
test('Fractional and variable frame timing: marked image equals independently decoded RGB',async()=> {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-explorer-media-')),s=await Store.open(root);
  for(const variant of ['fractional','variable']) {
    const file=path.join(root,`${variant}.mp4`),args=['-hide_banner','-loglevel','error','-f','lavfi','-i',`testsrc2=size=192x108:rate=${variant==='fractional'?'24000/1001':'10'}:duration=1`];
    if(variant==='variable')args.push('-vf',"setpts='if(lt(N,3),N,2*N-2)/(10*TB)'");
    args.push('-c:v','libx264','-pix_fmt','yuv420p10le','-fps_mode','vfr','-video_track_timescale','24000',file);
    await media.run(media.ffmpeg,args);
    const metadata=await media.inspect(file),clip={id:variant,source:file,metadata:JSON.stringify(metadata)};
    const deltas=metadata.pts.slice(1).map((v,i)=>Number(v)-Number(metadata.pts[i]));
    if(variant==='variable')assert.ok(new Set(deltas).size>1,'Fixture must have variable timestamps');
    if(variant==='fractional')assert.equal(metadata.stream.avg_frame_rate,'24000/1001');
    const reference=(await media.run(media.ffmpeg,['-v','error','-i',file,'-map','0:v:0','-fps_mode','passthrough','-pix_fmt','rgb48be','-f','framemd5','-'])).output.split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>line.split(',').at(-1).trim());
    const index=Math.min(5,metadata.pts.length-1),marked=await media.frame(clip,index,root);
    assert.equal(marked.pts,metadata.pts[index]);
    const actual=(await media.run(media.ffmpeg,['-v','error','-i',path.join(root,marked.asset),'-pix_fmt','rgb48be','-f','framemd5','-'])).output.split('\n').filter(line=>line&&!line.startsWith('#'))[0].split(',').at(-1).trim();
    assert.equal(actual,reference[index]);
    fs.utimesSync(file,new Date(),new Date(Date.now()+1000));assert.throws(()=>media.unchanged(clip),/changed/);
  }
  s.close();fs.rmSync(root,{recursive:true});
});
test('LUT render respects red-fastest ordering and identity preserves 16-bit samples',async()=> {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-explorer-colour-')),source=path.join(root,'source.png'),cube=path.join(root,'identity.cube'),target=path.join(root,'output.png');
  fs.writeFileSync(cube,identity());
  await media.run(media.ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=64x48:duration=0.1','-frames:v','1','-pix_fmt','rgb48be',source]);
  await media.renderLut(source,cube,target);
  const hash=async file=>(await media.run(media.ffmpeg,['-v','error','-i',file,'-pix_fmt','rgb48be','-f','framemd5','-'])).output.split('\n').find(line=>line&&!line.startsWith('#')).split(',').at(-1).trim();
  assert.equal(await hash(source),await hash(target));
  fs.rmSync(root,{recursive:true});
});
module.exports={identity};
test('Recording info distinguishes source codec, selected profile, and decoding matrix without guessing camera identity',()=>{
 const {withFormat}=require('../src/camera.cjs');
 const source={stream:{codec_name:'hevc',pix_fmt:'yuv420p10le',width:3840,height:2160,color_space:'bt709',avg_frame_rate:'30000/1001'}};
 const phone=withFormat({available:false},source,'apple-log');
 assert.equal(phone.available,true);assert.equal(phone.format.fields.codec.display,'HEVC / H.265');assert.equal(phone.format.fields.precision.display,'10-bit 4:2:0');
 assert.equal(phone.format.fields.gamma.display,'Apple Log');assert.equal(phone.format.fields.gamut.display,'BT.2020');assert.equal(phone.format.profileStatus,'selected');assert.equal(phone.format.fields.camera_model.display,'[Unverified]');
 assert.equal(phone.settings.frame_rate.display,'29.970 fps');
 const unknown=withFormat({available:false},source,'unknown');assert.equal(unknown.format.fields.gamma.display,'[Unverified]');assert.equal(unknown.format.fields.gamut.display,'[Unverified]');
 const recorded={settings:{gamma:{available:true,display:'S-Log3',source:'RTMD'},gamut:{available:true,display:'S-Gamut3.Cine',source:'RTMD'},camera_model:{available:true,display:'ILCE-7M4',source:'Camera XML'}}};
 const sony=withFormat(recorded,{stream:{codec_name:'h264',pix_fmt:'yuv422p10le'}},'sony-slog3-sgamut3cine');assert.equal(sony.format.profileStatus,'recorded');assert.equal(sony.format.fields.precision.display,'10-bit 4:2:2');
 const overridden=withFormat(recorded,source,'apple-log');assert.equal(overridden.format.fields.gamma.display,'Apple Log');assert.match(overridden.format.conflict,/recorded S-Log3/);
 const old=withFormat(recorded,{legacy:true,stream:{time_base:'1/1000000'}},'sony-slog3-sgamut3cine');assert.equal(old.format.fields.codec.display,'[Unverified]');assert.equal(old.format.fields.precision.display,'[Unverified]');
 assert.equal(recorded.settings.gamma.display,'S-Log3','Overlay enrichment must not rewrite captured metadata');
});
test('Fast scrub previews preserve fractional/VFR frame identity and cannot publish cancelled images',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-scrub-check-')),s=await Store.open(root);
 try{for(const kind of ['fractional','variable','offset']){
  const source=path.join(root,kind+'.mp4'),args=['-v','error','-f','lavfi','-i',`testsrc2=size=192x108:rate=${kind==='fractional'?'24000/1001':'10'}:duration=3`];
  if(kind==='variable')args.push('-vf',"setpts='if(lt(N,10),N,2*N-10)/(10*TB)'");
  if(kind==='offset')args.push('-vf','setpts=PTS+2/TB');
  args.push('-c:v','libx264','-pix_fmt','yuv420p10le','-fps_mode','vfr','-video_track_timescale','24000',source);await media.run(media.ffmpeg,args);
  const metadata=await media.inspect(source),clip={id:kind,source,metadata:JSON.stringify(metadata)},index=metadata.pts.length-3;
  const selected=await media.previewFrame(clip,index,root);assert.equal(selected.pts,metadata.pts[index]);
  const reference=path.join(root,kind+'-reference.jpg');await media.run(media.ffmpeg,['-v','error','-copyts','-i',source,'-vf',`select=eq(n\\,${index}),scale=w=min(960\\,iw):h=-2:flags=bilinear`,'-frames:v','1','-fps_mode','passthrough','-q:v','3','-y',reference]);
  assert.ok(fs.readFileSync(path.join(root,selected.thumb)).equals(fs.readFileSync(reference)),kind+' preview pixels differ from independent frame decode');
  await media.scrubFrames(clip,root);assert.ok(fs.readFileSync(path.join(root,selected.thumb)).equals(fs.readFileSync(reference)),kind+' preview pixels differ from independent frame decode');
  for(let i=0;i<metadata.pts.length;i++)assert.ok(fs.existsSync(path.join(root,media.scrubAsset(clip,i))));
  const cancelled=new AbortController();cancelled.abort();const rejected={...clip,id:kind+'-cancelled'};await assert.rejects(media.scrubFrames(rejected,root,cancelled.signal));assert.equal(fs.readdirSync(path.join(root,'cache')).some(n=>n.startsWith(rejected.id+'-')),false);
 }}finally{s.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('Tagged and verified-sidecar YUV decoding matches explicit BT.709 full/limited references and invalidates stale previews',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-matrix-check-')),store=await Store.open(root);
 try{
  const source=path.join(root,'tagged.mp4');await media.run(media.ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=192x108:rate=10:duration=1','-c:v','libx264','-pix_fmt','yuv420p10le','-color_range','pc','-colorspace','bt709',source]);
  const metadata=await media.inspect(source);assert.equal(metadata.stream.color_space,'bt709');assert.equal(metadata.stream.color_range,'pc');
  const pixelHash=async file=>(await media.run(media.ffmpeg,['-v','error','-i',file,'-pix_fmt','rgb48le','-f','framemd5','-'])).output.split('\n').find(line=>line&&!line.startsWith('#')).split(',').at(-1).trim();
  let lastPreview;
  for(const mode of ['stream-tag','sidecar-full','sidecar-limited']){
   const m=JSON.parse(JSON.stringify(metadata));if(mode!=='stream-tag'){delete m.stream.color_space;m.decoding={matrix:'bt709',range:mode==='sidecar-full'?'pc':'tv',evidence:'test sidecar'};}
   const clip={id:'same-clip',source,metadata:JSON.stringify(m)},index=5,range=mode==='sidecar-limited'?'limited':'full';
   const expected=path.join(root,mode+'.png');await media.run(media.ffmpeg,['-v','error','-i',source,'-map','0:v:0','-vf',`select=eq(n\\,5),scale=in_color_matrix=bt709:in_range=${range}:out_range=full:flags=accurate_rnd+full_chroma_int,format=rgb48le`,'-frames:v','1','-pix_fmt','rgb48be',expected]);
   const marked=await media.frame(clip,index,root);assert.equal(await pixelHash(path.join(root,marked.asset)),await pixelHash(expected),mode+' original RGB');
   const reference=path.join(root,mode+'.jpg');await media.run(media.ffmpeg,['-v','error','-i',expected,'-vf','scale=w=min(960\\,iw):h=-2:flags=bilinear','-frames:v','1','-q:v','3',reference]);
   const preview=await media.previewFrame(clip,index,root);assert.ok(fs.readFileSync(path.join(root,preview.thumb)).equals(fs.readFileSync(reference)),mode+' scrub RGB');
   await media.scrubFrames(clip,root);assert.ok(fs.readFileSync(path.join(root,preview.thumb)).equals(fs.readFileSync(reference)),mode+' batch scrub RGB');
   if(mode==='sidecar-limited')assert.notEqual(preview.thumb,lastPreview,'changed decoding cannot reuse stale cache');lastPreview=preview.thumb;
  }
 }finally{store.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('The preserved Sony LUT library works on new Sony footage without claiming compatibility with other cameras',()=>{
 const lut={input:'unknown',output:'unknown',legacy:true};
 assert.equal(compatible('sony-slog3-sgamut3cine',lut).ok,true);
 for(const profile of ['unknown','apple-log','rec709','canon-clog3-cinema-gamut'])assert.equal(compatible(profile,lut).ok,false);
 assert.equal(compatible('sony-slog3-sgamut3cine',{...lut,input:'apple-log',output:'rec709'}).ok,false);
 assert.equal(compatible('sony-slog3-sgamut3cine',{...lut,legacy:false}).ok,false);
});
test('Camera sample alignment rejects wrong-frame settings and unsupported values remain unavailable',()=>{
 const camera=require('../src/camera.cjs'),stream={time_base:'1/24000',width:3840,height:2160},pts=['0','1001'];
 const tags={'Doc1:Track3:SampleTime':0,'Doc1:Track3:ISO':100,'Doc2:Track3:SampleTime':1001/24000,'Doc2:Track3:ISO':500,'Doc2:Track3:Sony_rtmd_0x8005':49702};
 let metadata={stream,pts,sha256:'fixture',camera:camera.parseCamera(tags,stream,pts)};
 let selected=camera.atFrame(metadata,1,'camera.mp4');assert.equal(selected.settings.iso.value,500);assert.ok(Math.abs(selected.settings.focal_length_mm.value-55)<1e-10);assert.equal(selected.settings.white_balance_kelvin.available,false);
 tags['Doc2:Track3:SampleTime']=0.5;metadata.camera=camera.parseCamera(tags,stream,pts);selected=camera.atFrame(metadata,1,'camera.mp4');assert.equal(selected.settings.iso.available,false);assert.equal(selected.sample_seconds,null);
 assert.throws(()=>camera.attachSidecar(metadata,'camera.mp4','otherM01.XML','<NonRealTimeMeta/>'),/filename/);
 assert.throws(()=>camera.attachSidecar(metadata,'camera.mp4','cameraM01.XML','<!DOCTYPE xml [<!ENTITY evil SYSTEM "file:/etc/passwd">]><NonRealTimeMeta/>'),/entities/);
 assert.throws(()=>camera.attachSidecar(metadata,'camera.mp4','cameraM01.XML','<NonRealTimeMeta><Duration value="99"/></NonRealTimeMeta>'),/duration/);
 assert.throws(()=>camera.attachSidecar(metadata,'camera.mp4','cameraM01.XML','<NonRealTimeMeta><Duration value="2"/>'),/malformed/);
 const xml='<NonRealTimeMeta><Duration value="2"/><Device modelName="Test camera"/><AcquisitionRecord><Group><Item name="CodingEquations" value="rec709"/></Group></AcquisitionRecord></NonRealTimeMeta>';
 assert.equal(camera.attachSidecar(metadata,'camera.mp4','cameraM01.XML',xml).camera.sidecar.fields.camera_model,'Test camera');
 metadata.stream.color_space='bt470bg';assert.throws(()=>camera.attachSidecar(metadata,'camera.mp4','cameraM01.XML',xml),/decoding matrix/);
});

test('Scenes can belong to multiple collections with independent persistent orders, rejecting stale and cross-project edits',async()=>{
 const order=require('../src/scene-order.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-scene-orders-')),s=await Store.open(root),project=s.state().projects[0].id;
 try{
  s.change(()=>{s.db.run('INSERT INTO projects VALUES (?,?)',['other','Other']);for(const [id,p]of [['clip',project],['foreign','other']])s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',[id,p,id,'fixture.mp4','unknown','{}']);for(const id of ['a','b','c'])s.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,project,'clip',id,0,'0','1/1',id+'.png',id+'.jpg',id]);for(const [id,p]of [['one',project],['two',project],['elsewhere','other']])s.db.run('INSERT INTO collections VALUES (?,?,?)',[id,p,id]);});
  order.reorder(s,{projectId:project,ids:['c','b','a']});
  order.add(s,{sceneId:'a',collectionId:'one'});order.add(s,{sceneId:'a',collectionId:'two'});order.add(s,{sceneId:'b',collectionId:'one'});order.add(s,{sceneId:'a',collectionId:'two'});
  assert.equal(s.state().memberships.filter(m=>m.scene_id==='a').length,2);
  order.reorder(s,{projectId:project,collectionId:'one',ids:['b','a']});
  assert.deepEqual(order.orderedIds(s,project),['c','b','a']);assert.deepEqual(order.orderedIds(s,project,'one'),['b','a']);assert.deepEqual(order.orderedIds(s,project,'two'),['a']);
  const before=fs.readFileSync(s.file);for(const edit of [{projectId:project,ids:['a','a','c']},{projectId:project,collectionId:'two',ids:['b','a']},{projectId:project,collectionId:'elsewhere',ids:[]}])assert.throws(()=>order.reorder(s,edit));assert.throws(()=>order.add(s,{sceneId:'a',collectionId:'elsewhere'}));assert.deepEqual(fs.readFileSync(s.file),before);
  s.change(()=>s.db.run('UPDATE scenes SET deleted=1 WHERE id=?',['b']));assert.deepEqual(order.orderedIds(s,project,'one'),['a']);s.change(()=>s.db.run('UPDATE scenes SET deleted=0 WHERE id=?',['b']));assert.deepEqual(order.orderedIds(s,project,'one'),['b','a']);
  s.close();const reopened=await Store.open(root);assert.deepEqual(order.orderedIds(reopened,project),['c','b','a']);assert.deepEqual(order.orderedIds(reopened,project,'one'),['b','a']);reopened.close();
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('Upgrading an existing library seeds only genuine demo scenes, keeps other memberships/settings, and backs up first',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-picker-migration-'));let s=await Store.open(root);const project=s.state().projects[0].id;
 try{
  s.change(()=>{s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['legacy',project,'Saved gallery','original','sony-slog3-sgamut3cine',JSON.stringify({legacy:true})]);for(const [id,details]of [['camera',{legacy:true,clip:'C0044.MP4'}],['demo',{legacy:true}]])s.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256,details) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,project,'legacy',id,0,'0','1/1',id+'.png',id+'.jpg',id,JSON.stringify(details)]);s.db.run('INSERT INTO collections VALUES (?,?,?)',['existing',project,'Favourites']);s.db.run('INSERT INTO memberships VALUES (?,?)',['demo','existing']);s.db.run('INSERT INTO ui_state VALUES (?,?,?)',[project,'unchanged',JSON.stringify({scene:'camera',favourites:[],adjustments:{camera:{exposure:.5}}})]);s.db.run('DROP TABLE edit_history;DROP TABLE scene_orders;DROP TABLE collection_orders;PRAGMA user_version=3;');});
  const old=fs.readFileSync(s.file),scenes=s.query('SELECT * FROM scenes'),settings=s.query('SELECT * FROM ui_state');s.close();s=await Store.open(root);
  assert.deepEqual(s.query('SELECT * FROM scenes'),scenes);assert.deepEqual(s.query('SELECT * FROM ui_state'),settings);
  const demos=s.state().collections.find(c=>c.name==='Demos');assert.ok(demos);assert.deepEqual(s.state().memberships.filter(m=>m.collection_id===demos.id).map(m=>m.scene_id),['demo']);assert.equal(s.state().memberships.filter(m=>m.scene_id==='demo').length,2);
  assert.ok(fs.readdirSync(path.join(root,'backups')).some(file=>fs.readFileSync(path.join(root,'backups',file)).equals(old)),'The pre-upgrade database must be retained exactly');
  s.close();s=await Store.open(root);assert.equal(s.state().collections.filter(c=>c.name==='Demos').length,1);assert.equal(s.db.exec('PRAGMA integrity_check')[0].values[0][0],'ok');
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('Bulk collection removal preserves scenes, other memberships and order, with atomic validation and restore',async()=>{
 const order=require('../src/scene-order.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-membership-'));let s=await Store.open(root);const project=s.state().projects[0].id;
 try{
  s.change(()=>{s.db.run('INSERT INTO projects VALUES (?,?)',['foreign','Other']);s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip',project,'clip','fixture','unknown','{}']);s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['foreign-clip','foreign','clip','fixture','unknown','{}']);for(const [id,p,c]of [['a',project,'clip'],['b',project,'clip'],['c',project,'clip'],['foreign-scene','foreign','foreign-clip']])s.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256) VALUES (?,?,?,?,?,?,?,?,?,?)',[id,p,c,id,0,'0','1/1',id+'.png',id+'.jpg',id]);for(const id of ['one','two'])s.db.run('INSERT INTO collections VALUES (?,?,?)',[id,project,id]);});
  for(const collectionId of ['one','two'])order.membership(s,{sceneIds:['a','b','c'],collectionId,action:'add'});
  order.reorder(s,{projectId:project,collectionId:'one',ids:['c','a','b']});order.reorder(s,{projectId:project,ids:['b','a','c']});
  const scenes=s.query('SELECT * FROM scenes'),before=fs.readFileSync(s.file);
  for(const sceneIds of [['a','foreign-scene'],['a','missing'],['a','a'],[]])assert.throws(()=>order.membership(s,{sceneIds,collectionId:'one',action:'remove'}));assert.throws(()=>order.membership(s,{sceneIds:['a'],collectionId:'',action:'remove'}));assert.deepEqual(fs.readFileSync(s.file),before);
  order.membership(s,{sceneIds:['a','b'],collectionId:'one',action:'remove'});assert.deepEqual(order.orderedIds(s,project,'one'),['c']);assert.deepEqual(order.orderedIds(s,project,'two'),['a','b','c']);assert.deepEqual(order.orderedIds(s,project),['b','a','c']);assert.deepEqual(s.query('SELECT * FROM scenes'),scenes);
  s.close();s=await Store.open(root);assert.deepEqual(order.orderedIds(s,project,'one'),['c']);
  order.membership(s,{sceneIds:['a','b'],collectionId:'one',action:'add'});assert.deepEqual(order.orderedIds(s,project,'one'),['c','a','b']);order.membership(s,{sceneIds:['a','b'],collectionId:'one',action:'add'});assert.equal(s.state().memberships.length,6);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('Collection rename and ordering survive reopen without changing scenes or memberships',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-collection-order-'));let s=await Store.open(root);const ordering=require('../src/scene-order.cjs'),p=s.state().projects[0].id;
 try{s.change(()=>{for(const id of ['one','two','three'])s.db.run('INSERT INTO collections VALUES (?,?,?)',[id,p,id]);});
 const unchanged=s.query('SELECT * FROM scenes'),members=s.query('SELECT * FROM memberships');ordering.reorderCollections(s,{projectId:p,ids:['three','one','two']});ordering.renameCollection(s,{id:'one',name:'Studio',expectedName:'one'});
 assert.throws(()=>ordering.renameCollection(s,{id:'one',name:'Stale',expectedName:'one'}),/changed/);assert.throws(()=>ordering.reorderCollections(s,{projectId:p,ids:['three','one']}),/changed/);assert.throws(()=>ordering.reorderCollections(s,{projectId:p,ids:['three','one','one']}),/changed/);
 s.close();s=await Store.open(root);assert.deepEqual(s.state().collections.map(c=>c.id),['three','one','two']);assert.equal(s.state().collections.find(c=>c.id==='one').name,'Studio');assert.deepEqual(s.query('SELECT * FROM scenes'),unchanged);assert.deepEqual(s.query('SELECT * FROM memberships'),members);
 s.change(()=>s.db.run('INSERT INTO collections VALUES (?,?,?)',['four',p,'New']));assert.deepEqual(s.state().collections.map(c=>c.id),['three','one','two','four']);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('Recorded HLG tags are distinct from Apple Log, and uncertain recording modes stay unverified',()=>{
 const c=require('../src/camera.cjs'),stream={width:1920,height:1080,time_base:'1/30',color_transfer:'arib-std-b67',color_primaries:'bt2020',color_space:'bt2020nc'};
 let value=c.parseCamera({'QuickTime:Make':'Apple','QuickTime:Model':'iPhone 15 Pro'},stream,['0']);assert.equal(value.detectedProfile,'hlg-bt2020');assert.equal(value.recording.gamma,'HLG');assert.equal(value.recording.gamut,'BT.2020');
 const info=c.withFormat(c.atFrame({stream,pts:['0'],camera:value,sha256:'test'},0,'phone.mov'),{stream},value.detectedProfile);assert.equal(info.format.fields.camera_model.display,'iPhone 15 Pro');assert.equal(info.format.fields.gamma.display,'HLG');assert.equal(info.format.profileStatus,'recorded');
 value=c.parseCamera({'QuickTime:Make':'Apple'},{...stream,color_transfer:'unknown'},['0']);assert.equal(value.detectedProfile,null);
 value=c.parseCamera({'QuickTime:Make':'Apple'},{...stream,color_transfer:'bt709',color_primaries:'bt709',color_space:'bt709'},['0']);assert.equal(value.detectedProfile,'rec709');
 value=c.parseCamera({'QuickTime:Make':'Sony'},{...stream,color_transfer:'bt709',color_primaries:'bt709',color_space:'bt709'},['0']);assert.equal(value.detectedProfile,'rec709','Matching recorded SDR tags are usable across camera brands');
});

test('Apple Log 2 remains separate from Apple Log 1 and Sony, with its own gamut',()=>{
 const {profile}=require('../src/cube.cjs'),{withFormat,parseCamera}=require('../src/camera.cjs');
 assert.equal(profile('apple-log2'),'apple-log2');
 const source={stream:{codec_name:'prores',profile:'422',pix_fmt:'yuv422p10le',color_space:'bt2020nc',width:3840,height:2160}};
 const info=withFormat({available:false},source,'apple-log2');
 assert.equal(info.format.fields.gamma.display,'Apple Log 2');assert.equal(info.format.fields.gamut.display,'Apple Wide Gamut');assert.equal(info.format.profileStatus,'selected');
 const lut={input:'apple-log2',output:'rec709'};assert.equal(compatible('apple-log2',lut).ok,true);for(const p of ['apple-log','sony-slog3-sgamut3cine','unknown'])assert.equal(compatible(p,lut).ok,false);assert.equal(compatible('apple-log2',{input:'apple-log',output:'rec709'}).ok,false);
 // Generic stream tags and Apple identity alone never prove a log profile.
 assert.equal(parseCamera({'QuickTime:Make':'Apple','QuickTime:Model':'iPhone 17 Pro'},{time_base:'1/24',color_space:'bt2020nc'},['0']).detectedProfile,null);
});

test('Legacy Sony gallery cannot bypass compatibility after a clip profile changes',async()=>{
 const {startServer}=require('../src/server.cjs');const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-legacy-profile-'));let app;
 try{app=await startServer({root,port:0});const p=app.store.state().projects[0].id;fs.mkdirSync(path.join(root,'gallery','saved'),{recursive:true});fs.writeFileSync(path.join(root,'gallery','saved','OLD.jpg'),'saved gallery preview');
 app.store.change(()=>{app.store.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip',p,'Sony.mov','','sony-slog3-sgamut3cine',JSON.stringify({legacy:true})]);app.store.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256,details) VALUES (?,?,?,?,?,?,?,?,?,?,?)',['saved',p,'clip','Saved Sony',0,'0','1/24','frames/original.png','frames/original.jpg','hash',JSON.stringify({legacy:true})]);app.store.db.run('INSERT INTO luts(id,name,original_name,sha256,asset,size,details) VALUES (?,?,?,?,?,?,?)',['look','Sony','Sony.cube','lut-hash','luts/look.cube',33,JSON.stringify({legacy:true,code:'OLD'})]);});
 const response=await fetch(app.url),html=await response.text(),boot=JSON.parse(html.match(/id="product-boot"[^>]*>([\s\S]*?)<\/script>/)[1]),cookie=response.headers.get('set-cookie').split(';')[0];const headers={Cookie:cookie,'X-LUT-Token':boot.token};
 let preview=await fetch(app.url+'/previews/saved/look',{headers});assert.equal(preview.status,200);assert.equal(await preview.text(),'saved gallery preview');
 const changed=await fetch(app.url+'/api/call',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({method:'setClipProfile',payload:{id:'clip',value:'apple-log2',projectId:p}})});assert.ok((await changed.json()).ok);
 preview=await fetch(app.url+'/previews/saved/look',{headers});assert.equal(preview.status,400);assert.match(await preview.text(),/Confirm.*profile/);
 }finally{if(app)await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
