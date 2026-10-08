const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the actual browser save functions with controlled response timing.
const source=fs.readFileSync(require.resolve('../ui/explorer-overlay.js'),'utf8');
const save=source.slice(source.indexOf('function save()'),source.indexOf('const descriptions='));
const sync=source.slice(source.indexOf('function retainView('),source.indexOf('function refreshSharedSettings('));
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve};}
function harness(state,fetch){const values=new Map(),elements=new Map(),context=vm.createContext({fetch,JSON,Set,Map,Promise,setTimeout:()=>0,clearTimeout(){},localStorage:{setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)||null,removeItem:k=>values.delete(k)},$:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},productBoot:{projectId:'project',token:'token'},preferenceKey:'project',hadBrowserPreferences:false,state:structuredClone(state),projectReady:true,projectRevision:'old',lastSharedState:structuredClone(state),pendingPrefs:null,savingProject:false,loadingProject:false,projectTimer:0,applyTheme(){},refreshSceneAssets(){},updateControls(){}});vm.runInContext('function restorePreferences(value){state=JSON.parse(JSON.stringify(value));} async function render({persist=true}={}){if(persist)save();}',context);vm.runInContext(save+sync+"\nfunction refreshSceneAssets(){}",context);return {context,values,run:code=>vm.runInContext(code,context)};}
const response=(status,state,revision='remote')=>({status,ok:status===200,json:async()=>({state,revision})});
test('Reloading while scenes are removed keeps their adjustments for Undo and handles keys as own data',()=>{
 const restore=source.slice(source.indexOf('function cleanAdjustments('),source.indexOf('let hadBrowserPreferences='));
 const saved={adjustments:JSON.parse('{"removed":{"exposure":0.75,"warmth":18,"enabled":false},"__proto__":{"contrast":1.2}}')};
 const context=vm.createContext({state:{adjustments:{}},byScene:new Map([['active',{}]]),byName:new Map(),saved});vm.runInContext(restore+';restorePreferences(saved);',context);
 const persisted=JSON.parse(JSON.stringify(context.state));assert.equal(persisted.adjustments.removed.exposure,.75);assert.equal(persisted.adjustments.removed.warmth,18);assert.equal(persisted.adjustments.removed.enabled,false);assert.equal(Object.hasOwn(context.state.adjustments,'__proto__'),true);
 context.saved=persisted;context.byScene.set('removed',{});context.state={adjustments:{}};vm.runInContext('restorePreferences(saved);',context);assert.equal(context.state.adjustments.removed.exposure,.75);assert.equal(context.state.adjustments.removed.enabled,false);
});
test('A scene change during a conflicted save cannot remove favourites added by another browser',async()=>{
 const base={scene:'first',favourites:['one'],adjustments:{}},remote={...base,favourites:['one','two','three']},held=deferred(),sent=[];
 const h=harness(base,async(url,options)=>{const body=JSON.parse(options.body);sent.push(body);if(sent.length===1)return response(409,remote);if(sent.length===2)return held.promise;return response(200,body.state,'saved');});
 h.run("state.scene='second';save();");const saving=h.run('persistProject()');
 while(sent.length<2)await new Promise(r=>setImmediate(r));
 h.run("state.scene='third';save();");held.resolve(response(200,sent[1].state,'accepted'));await saving;
 assert.deepEqual(sent.at(-1).state.favourites,['one','two','three']);assert.equal(sent.at(-1).state.scene,'third');assert.equal(h.context.state.favourites.length,3);
});
test('An explicit unstar still survives a conflict while another favourite is added',async()=>{
 const base={scene:'first',favourites:['one','two'],adjustments:{}},sent=[];
 const h=harness(base,async(url,options)=>{const body=JSON.parse(options.body);sent.push(body);return sent.length===1?response(409,{...base,favourites:['one','two','three']}):response(200,body.state);});
 h.run("state.favourites=['two'];save();");await h.run('persistProject()');assert.deepEqual(sent.at(-1).state.favourites,['two','three']);
});
test('A delayed refresh cannot overwrite a scene or favourites edited while it was loading',async()=>{
 const base={scene:'first',favourites:['one'],adjustments:{}},held=deferred(),h=harness(base,()=>held.promise);
 const loading=h.run('loadProjectSettings()');h.run("state.scene='second';state.favourites.push('two');save();");held.resolve(response(200,{...base,favourites:['one','three']}));await loading;
 assert.equal(h.context.state.scene,'second');assert.deepEqual(JSON.parse(JSON.stringify(h.context.state.favourites)),['one','three','two']);
});
test('A delayed refresh cannot overwrite a save that completed after the read began',async()=>{
 const base={scene:'first',favourites:['one'],adjustments:{}},held=deferred(),h=harness(base,async(url,options)=>options?response(200,JSON.parse(options.body).state,'newer'):held.promise);
 const loading=h.run('loadProjectSettings()');h.run("state.favourites.push('two');save();");await h.run('persistProject()');held.resolve(response(200,base,'old'));await loading;
 assert.equal(h.context.projectRevision,'newer');assert.deepEqual(JSON.parse(JSON.stringify(h.context.state.favourites)),['one','two']);assert.equal(h.context.pendingPrefs,null);
});
test('Returning to the previous scene or undoing a star while its save is in flight is retained',async()=>{
 const base={scene:'first',favourites:['one'],adjustments:{}},held=deferred(),sent=[];
 const h=harness(base,async(url,options)=>{const body=JSON.parse(options.body);sent.push(body);return sent.length===1?held.promise:response(200,body.state,'final');});
 h.run("state.scene='second';state.favourites.push('two');save();");const saving=h.run('persistProject()');
 h.run("state.scene='first';state.favourites=['one'];save();");held.resolve(response(200,sent[0].state,'accepted'));await saving;
 assert.equal(sent.at(-1).state.scene,'first');assert.deepEqual(sent.at(-1).state.favourites,['one']);
});

test('Shared refresh keeps this tab on its scene and look without saving an older manifest back',async()=>{
 const base={scene:'demo',sceneCollection:'',sceneDevice:'',selected:'first',reference:'',selectedLook:'first-family',favourites:['one'],adjustments:{},comparing:false},remote={...base,scene:'new-import',selected:'second',selectedLook:'second-family',favourites:['one','two'],adjustments:{'new-import':{exposure:.5}}},sent=[];
 const h=harness(base,async(url,options)=>{if(options?.method==='POST')sent.push(options);return response(200,remote,'changed');});
 await h.run('loadProjectSettings()');assert.equal(h.context.state.scene,'demo');assert.equal(h.context.state.selected,'first');assert.deepEqual(JSON.parse(JSON.stringify(h.context.state.favourites)),['one','two']);assert.equal(h.context.state.adjustments['new-import'].exposure,.5);assert.equal(h.context.pendingPrefs,null);assert.equal(sent.length,0);
});
test('A conflicting favourite save keeps local navigation even when another tab changed scenes',async()=>{
 const base={scene:'demo',selected:'first',favourites:['one'],adjustments:{},comparing:false},sent=[];
 const h=harness(base,async(url,options)=>{const body=JSON.parse(options.body);sent.push(body);return sent.length===1?response(409,{...base,scene:'new-import',selected:'second',favourites:['one','three']}):response(200,body.state);});
 h.run("state.favourites.push('two');save();");await h.run('persistProject()');assert.equal(h.context.state.scene,'demo');assert.equal(h.context.state.selected,'first');assert.deepEqual(sent.at(-1).state.favourites,['one','three','two']);
});
test('Returning exactly to the saved view while a request is in flight queues that return',async()=>{
 const base={scene:'first',favourites:['one'],adjustments:{},comparing:false},held=deferred(),sent=[];
 const h=harness(base,async(url,options)=>{const body=JSON.parse(options.body);sent.push(body);return sent.length===1?held.promise:response(200,body.state,'final');});
 h.run("state.scene='second';save();");const saving=h.run('persistProject()');h.run("state.scene='first';save();");held.resolve(response(200,sent[0].state,'accepted'));await saving;assert.equal(sent.length,2);assert.equal(sent.at(-1).state.scene,'first');assert.equal(h.context.state.scene,'first');
});

test('Returning to the saved scene before the save delay replaces an older queued scene',async()=>{
 const base={scene:'first',favourites:['one'],adjustments:{},comparing:false},sent=[],h=harness(base,async(url,options)=>{const state=JSON.parse(options.body).state;sent.push(state);return response(200,state,'new');});
 h.run("state.scene='second';save();state.scene='first';save();");await h.run('persistProject()');assert.equal(sent.length,1);assert.equal(sent[0].scene,'first');assert.equal(h.context.state.scene,'first');
});

test('A delayed old preview cannot replace the current scene or clear its loading state',async()=>{
 const body=source.slice(source.indexOf('async function render('),source.indexOf('function select(')),first=deferred(),second=deferred(),elements=new Map(),timers=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',classList:{toggle(){}},setAttribute(){},removeAttribute(){}});return elements.get(id);};
 const context=vm.createContext({scenes:[{id:'first'},{id:'second'}],state:{scene:'first',selected:'look',comparing:false},byScene:new Map([['first',{label:'First'}],['second',{label:'Second'}]]),byName:new Map([['look',{maker:'Fixture',code:'AAA'}]]),productBoot:{profiles:[]},$:element,preview:element('preview'),renderVersion:0,liveRenderer:null,thumbnailScene:'first',allTiles:[],loadedImages:new Set(),setTimeout:f=>timers.push(f),clearTimeout(){},invalidateLevels(){},updateControls(){},save(){},imagePath:(name,scene)=>scene,label:name=>name,loadImage:path=>path==='first'?first.promise:second.promise,refreshSceneAssets(){},renderAdjustments:async()=>false,updateDescription(){},updateLevels(){}});
 vm.runInContext(body,context);const old=vm.runInContext('render()',context);assert.equal(timers.length,0,'Switching looks in an established scene must not display a preparing overlay');context.state.scene='second';const current=vm.runInContext('render()',context);assert.equal(element('preview-loading').hidden,true);timers.forEach(f=>f());first.resolve();await old;assert.equal(element('preview-loading').hidden,false);assert.equal(element('preview').src,undefined);second.resolve();await current;assert.equal(element('preview').src,'second');assert.equal(element('preview').alt,'Second · look');assert.equal(element('preview-loading').hidden,true);
});

test('The first delayed shared read preserves the scene already shown from page boot',async()=>{
 const base={scene:'demo',selected:'first',favourites:['one'],adjustments:{},comparing:false},h=harness(base,()=>response(200,{...base,scene:'new-import',selected:'second'},'changed'));h.context.projectReady=false;await h.run('loadProjectSettings()');assert.equal(h.context.state.scene,'demo');assert.equal(h.context.state.selected,'first');assert.equal(h.context.pendingPrefs,null);
});

test('Scene thumbnails stay visible and swap together, with late old scenes ignored',async()=>{
 const body=source.slice(source.indexOf('function refreshSceneAssets(){'),source.indexOf('async function loadProjectSettings(){'));
 const loads=new Map(),tiles=['one','two'].map(name=>{
  const classes=new Set(),img={src:'previous/'+name,getAttribute(){return this.src;},removeAttribute(){this.src='';}};
  return {dataset:{name},classes,img,querySelector:()=>img,classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key),remove:key=>classes.delete(key)}};
 });
 const context=vm.createContext({state:{scene:'first'},thumbnailVersion:0,thumbnailScene:null,allTiles:tiles,canUseLut:()=>true,imagePath:(name,scene)=>scene+'/'+name,warmScene(){},loadImage:path=>{const wait=deferred();loads.set(path,wait);return wait.promise;}});
 vm.runInContext(body,context);vm.runInContext('refreshSceneAssets()',context);
 assert.ok(tiles.every(t=>!t.classes.has('preview-pending')),'Previously displayed thumbnails must stay visible');
 loads.get('first/one').resolve();await new Promise(r=>setImmediate(r));assert.deepEqual(tiles.map(t=>t.img.src),['previous/one','previous/two'],'One finished tile must not produce a partial row');
 context.state.scene='second';vm.runInContext('refreshSceneAssets()',context);loads.get('second/two').resolve();loads.get('second/one').resolve();await new Promise(r=>setImmediate(r));
 assert.deepEqual(tiles.map(t=>t.img.src),['second/one','second/two']);loads.get('first/two').resolve();await new Promise(r=>setImmediate(r));assert.deepEqual(tiles.map(t=>t.img.src),['second/one','second/two'],'Late completion from a previous scene must not flash the row back');
});
