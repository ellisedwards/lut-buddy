const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {AIConnection,runCli,authState}=require('../src/ai-cli.cjs'),metadata=require('../src/metadata.cjs'),{Store}=require('../src/store.cjs');
const suggestion={name:'Desk still life',description:'A collection of small objects on a table.',tags:'interior, objects'};
const help='--json-schema --tools --permission-mode --restricted --strict-mcp-config --no-session-persistence --system-prompt --ephemeral --ignore-user-config --ignore-rules --image --json --output-schema --output-last-message --sandbox --skip-git-repo-check';
test('Account status requires positive authentication and does not expose credential material',async()=>{
 assert.equal(authState('codex',{code:1,stdout:'Not logged in',stderr:''}).authenticated,false);
 assert.equal(authState('claude-code',{code:0,stdout:'unrecognised status'}).authenticated,false);
 assert.equal(authState('claude-code',{code:0,stdout:'{"loggedIn":true,"authMethod":"api_key"}'}).billing,'API / provider billing');
 let calls=0;const ai=new AIConnection({env:{CLAUDE_CODE_BIN:'claude-test',CODEX_BIN:'codex-test'},runner:async(bin,args)=>{calls++;return {code:0,stdout:args.includes('--version')?'2.1.266':args.includes('--help')?help:bin==='claude-test'?JSON.stringify({loggedIn:true,authMethod:'oauth_token',credential:'SECRET-DO-NOT-RETURN'}):'Logged in using ChatGPT',stderr:''};}});
 const statuses=await ai.status();assert.ok(statuses.every(s=>s.ready));assert.ok(!JSON.stringify(statuses).includes('SECRET'));const previous=calls;await ai.status();assert.equal(calls,previous);await ai.status(true);assert.ok(calls>previous);await assert.rejects(ai.inspect('shell'),/Choose/);
});
test('Copied image transport uses private staging, validates failures and cleans up both provider requests',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-ai-transport-test-'));let staged;
 try{
 const image=path.join(root,'source.jpg');fs.writeFileSync(image,Buffer.from([1,2,3]));
 for(const id of ['claude-code','codex']){
 const ai=new AIConnection({env:{CLAUDE_CODE_BIN:'claude-test',CODEX_BIN:'codex-test'},runner:async(bin,args,input,opts)=>{
 if(args.includes('--version'))return {code:0,stdout:'2.1.266',stderr:''};if(args.includes('--help'))return {code:0,stdout:help,stderr:''};if(args[0]==='auth'||args[0]==='login')return {code:0,stdout:bin==='claude-test'?'{"loggedIn":true,"authMethod":"oauth_token"}':'Logged in using ChatGPT',stderr:''};
 staged=opts.cwd;assert.notEqual(staged,root);assert.ok(fs.readFileSync(path.join(staged,'image-1.jpg')).equals(fs.readFileSync(image)));assert.equal(fs.statSync(path.join(staged,'image-1.jpg')).mode&0o777,0o600);assert.ok(input.includes('image-1.jpg'));
 if(id==='codex'){assert.equal(args[args.indexOf('--sandbox')+1],'read-only');assert.ok(args.includes('--ignore-user-config'));fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify(suggestion));return {code:0,stdout:'{"type":"turn.completed"}\n',stderr:''};}
 assert.equal(args[args.indexOf('--tools')+1],'Read');assert.ok(args.includes('--strict-mcp-config'));return {code:0,stdout:JSON.stringify({structured_output:suggestion}),stderr:''};
 }});
 assert.deepEqual(await ai.suggest({provider:id,prompt:'Describe the selected preview.',images:[image],schema:metadata.schema('scene')}),suggestion);assert.equal(fs.existsSync(staged),false);
 }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Cancellation and timeout terminate the subprocess and wait for its close',async()=>{
 const controller=new AbortController(),run=runCli(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},100)'],'',{signal:controller.signal});setTimeout(()=>controller.abort(),150);await assert.rejects(run,e=>e.name==='AbortError');
 await assert.rejects(runCli(process.execPath,['-e','setInterval(()=>{},100)'],'',{timeoutMs:50}),/timed out/);
});
test('Suggestion fields exclude technical claims and reject malformed output',()=>{
 assert.deepEqual(metadata.validateSuggestion('scene',suggestion),suggestion);
 assert.throws(()=>metadata.validateSuggestion('scene',{...suggestion,profile:'apple-log'}),/unexpected fields/);
 assert.throws(()=>metadata.validateSuggestion('scene',{...suggestion,tags:[]}));
 assert.throws(()=>metadata.validateSuggestion('lut',{...suggestion,code:'LONG',maker:''}));
});
test('Scene edits preserve recording evidence; abbreviations are unique and independent from legacy previews',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-ai-metadata-test-')),s=await Store.open(root);
 try{const project=s.state().projects[0].id;s.change(()=>{
 s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip',project,'original.mov','original.mov','apple-log','{}']);
 s.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256,details) VALUES (?,?,?,?,?,?,?,?,?,?,?)',['scene',project,'clip','Original',0,'0','1/24','frames/original.png','frames/original.jpg','original-hash',JSON.stringify({cameraMetadata:{gamma:'Apple Log'},legacy:true})]);
 for(const [id,code]of [['lut','OLD'],['other','NEW']])s.db.run('INSERT INTO luts(id,name,original_name,sha256,asset,size,details) VALUES (?,?,?,?,?,?,?)',[id,id,id+'.cube',id,'luts/'+id+'.cube',2,JSON.stringify({legacy:true,code})]);
 });const row=s.one('SELECT * FROM scenes WHERE id=?',['scene']),rev=metadata.revision(row);
 metadata.updateScene(s,{id:'scene',...suggestion,collections:[],expectedRevision:rev});const changed=s.one('SELECT * FROM scenes WHERE id=?',['scene']);assert.equal(JSON.parse(changed.details).cameraMetadata.gamma,'Apple Log');assert.equal(changed.sha256,row.sha256);assert.equal(s.one('SELECT profile FROM clips WHERE id=?',['clip']).profile,'apple-log');
 assert.throws(()=>metadata.updateScene(s,{id:'scene',...suggestion,collections:[],expectedRevision:rev}),/changed/);
 const lut=s.one('SELECT * FROM luts WHERE id=?',['lut']),details=metadata.lutDetails(s,lut,{code:'XYZ',description:'Suggested visual look.',maker:'',tags:'warm'});assert.equal(details.code,'OLD');assert.equal(details.displayCode,'XYZ');assert.throws(()=>metadata.lutDetails(s,lut,{code:'NEW'}),/already used/);assert.throws(()=>metadata.lutDetails(s,lut,{code:'LOG'}),/reserved/);assert.equal(lut.original_name,'lut.cube');
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true});}
});
test('AI cancellation belongs to its request and cannot cancel a different request; proposals never write the library',async()=>{
 const {startServer}=require('../src/server.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-ai-request-test-'));let app,active;
 try{
 app=await startServer({root,port:0,ai:{status:async()=>[],suggest:async({signal})=>new Promise((resolve,reject)=>{active=signal;signal.addEventListener('abort',()=>reject(Object.assign(Error('cancelled'),{name:'AbortError'})),{once:true});})}});
 const s=app.store,project=s.state().projects[0].id;s.change(()=>{s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip',project,'recorded.mov','recorded.mov','rec709','{}']);s.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256,details) VALUES (?,?,?,?,?,?,?,?,?,?,?)',['scene',project,'clip','Original',0,'0','1/24','frames/original.png','frames/original.jpg','hash','{}']);});fs.writeFileSync(path.join(root,'frames/original.jpg'),'fixture');
 const page=await fetch(app.url),html=await page.text(),boot=JSON.parse(html.match(/id="product-boot"[^>]*>([\s\S]*?)<\/script>/)[1]),cookie=page.headers.get('set-cookie').split(';')[0],before=fs.readFileSync(s.file);
 const call=(method,payload)=>fetch(app.url+'/api/call',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-LUT-Token':boot.token},body:JSON.stringify({method,payload})});
 const request=call('aiSuggest',{kind:'scene',id:'scene',provider:'claude-code',requestId:'one'});
 for(let n=0;!active&&n<50;n++)await new Promise(r=>setTimeout(r,10));assert.ok(active);
 await call('cancel',{requestId:'different-request'});assert.equal(active.aborted,false);await call('cancel',{requestId:'one'});assert.equal(active.aborted,true);const response=await request;assert.equal(response.status,400);assert.match((await response.json()).error,/cancelled/);assert.ok(fs.readFileSync(s.file).equals(before));
 }finally{await app?.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('Batch review saves atomically, rejects stale items and duplicate codes, and preserves technical evidence',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-batch-review-')),s=await Store.open(root),p=s.state().projects[0].id;
 try{s.change(()=>{s.db.run('INSERT INTO clips VALUES (?,?,?,?,?,?)',['clip',p,'camera.mov','camera.mov','apple-log','{}']);for(const id of ['one','two']){s.db.run('INSERT INTO scenes(id,project_id,clip_id,name,frame_index,pts,time_base,asset,thumb,sha256,details) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,p,'clip',id,0,'0','1/24','frames/'+id+'.png','frames/'+id+'.jpg',id,JSON.stringify({cameraMetadata:{gamma:'Apple Log'},raw_path:'preserved'})]);s.db.run('INSERT INTO luts(id,name,original_name,sha256,asset,size,details) VALUES (?,?,?,?,?,?,?)',[id,id,id+'.cube',id,'luts/'+id+'.cube',2,JSON.stringify({code:id==='one'?'ONE':'TWO',legacy:true})]);}});
 const review=(kind)=>metadata.reviewItems(s,{kind,projectId:p,ids:['one','two']}).map(({item,revision})=>({id:item.id,expectedRevision:revision,fields:{name:'Reviewed '+item.name}}));
 let items=review('scene'),before=fs.readFileSync(s.file);assert.throws(()=>metadata.updateBatch(s,{kind:'scene',projectId:p,items:[items[0],{...items[1],expectedRevision:'old'}]}),/changed/);assert.ok(fs.readFileSync(s.file).equals(before));
 metadata.updateBatch(s,{kind:'scene',projectId:p,items});assert.equal(s.one('SELECT name FROM scenes WHERE id=?',['one']).name,'Reviewed one');assert.equal(JSON.parse(s.one('SELECT details FROM scenes WHERE id=?',['one']).details).cameraMetadata.gamma,'Apple Log');assert.equal(s.one('SELECT profile FROM clips WHERE id=?',['clip']).profile,'apple-log');
 items=review('lut').map(item=>({...item,fields:{code:'SAME'}}));before=fs.readFileSync(s.file);assert.throws(()=>metadata.updateBatch(s,{kind:'lut',projectId:p,items}));assert.ok(fs.readFileSync(s.file).equals(before));
 items=review('lut').map(item=>({...item,fields:{code:'DUP'}}));assert.throws(()=>metadata.updateBatch(s,{kind:'lut',projectId:p,items}),/more than once/);assert.ok(fs.readFileSync(s.file).equals(before));
 items=review('lut').map(item=>({...item,fields:{code:item.id==='one'?'TWO':'ONE',description:'Reviewed look'}}));metadata.updateBatch(s,{kind:'lut',projectId:p,items});const row=s.one('SELECT * FROM luts WHERE id=?',['one']);assert.equal(JSON.parse(row.details).displayCode,'TWO');assert.equal(JSON.parse(row.details).code,'ONE');assert.equal(row.original_name,'one.cube');assert.equal(row.asset,'luts/one.cube');assert.equal(row.sha256,'one');
 assert.throws(()=>metadata.updateBatch(s,{kind:'scene',projectId:p,items:review('scene').map(item=>({...item,fields:{profile:'rec709'}}))}),/Unexpected/);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true});}
});
