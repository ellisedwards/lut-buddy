const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the actual browser save functions with controlled response timing.
const source=fs.readFileSync(require.resolve('../ui/explorer-overlay.js'),'utf8');
const save=source.slice(source.indexOf('function save()'),source.indexOf('const descriptions='));
const sync=source.slice(source.indexOf('function mergeSettings('),source.indexOf('function refreshSharedSettings('));
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve};}
function harness(state,fetch){const values=new Map(),elements=new Map(),context=vm.createContext({fetch,JSON,Set,Map,Promise,setTimeout:()=>0,clearTimeout(){},localStorage:{setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)||null,removeItem:k=>values.delete(k)},$:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},productBoot:{projectId:'project',token:'token'},preferenceKey:'project',hadBrowserPreferences:false,state:structuredClone(state),projectReady:true,projectRevision:'old',lastSharedState:structuredClone(state),pendingPrefs:null,savingProject:false,loadingProject:false,projectTimer:0,applyTheme(){},refreshSceneAssets(){},updateControls(){}});vm.runInContext('function restorePreferences(value){state=JSON.parse(JSON.stringify(value));} async function render(){save();}',context);vm.runInContext(save+sync+"\nfunction refreshSceneAssets(){}",context);return {context,values,run:code=>vm.runInContext(code,context)};}
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
