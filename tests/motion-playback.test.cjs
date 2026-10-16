'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function harness(){
 const elements=new Map(),videos=[],renders=[],callbacks=new Map();let serial=0,renderers=0;
 class Element extends EventTarget{
  constructor(tag='div'){super();this.tagName=tag;this.dataset={};this.hidden=false;this.paused=true;this.currentTime=0;this.readyState=0;this.width=1280;this.height=720;this.videoWidth=1920;this.videoHeight=1080;this.attributes={};}
  setAttribute(k,v){this.attributes[k]=v;}
  removeAttribute(k){delete this.attributes[k];if(k==='src')this.src='';}
  append(...items){for(const item of items)item.parent=this;}
  remove(){this.removed=true;}
  getContext(){return {drawImage(){}};}
  load(){if(!this.src)return;queueMicrotask(()=>{this.readyState=2;this.onloadeddata?.();this.dispatchEvent(new Event('loadeddata'));});}
  async play(){if(this.deferPlay)await this.deferPlay;this.paused=false;}
  pause(){this.paused=true;}
  requestVideoFrameCallback(fn){const id=++serial;callbacks.set(id,fn);return id;}
  cancelVideoFrameCallback(id){callbacks.delete(id);}
 }
 const document=new EventTarget();document.body=new Element();document.hidden=false;document.querySelector=()=>null;document.getElementById=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};document.createElement=tag=>{const e=new Element(tag);if(tag==='video')videos.push(e);return e;};
 const adjustment={enabled:true,exposure:0,warmth:0,tint:0,contrast:1,saturation:1};
 const scenes=Array.from({length:4},(_,i)=>({id:String(i),motion:{asset:String(i)+'.mp4',pinOffset:2,duration:6}}));
 let current={scene:scenes[0],record:{name:'Look'},adjustments:adjustment},panes=scenes.slice(1).map(scene=>({scene,record:current.record,adjustments:adjustment,body:new Element()}));
 const product={boot:{projectId:'test',token:'test'},getView:()=>current,split:{motionPanes:()=>panes}};
 const window=new EventTarget();window.LUTProduct=product;window.LUTPreviewRenderer=class{constructor(canvas){renderers++;this.canvas=canvas;}cancel(){}async renderMotion(scene,record,adjustments,video){renders.push({scene:scene.id,record,adjustments,video,time:video.currentTime});this.canvas.width=1920;this.canvas.height=1080;return true;}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../ui/motion.js'),'utf8'),{document,window,performance:{now:()=>123},AbortController,setTimeout,clearTimeout,requestAnimationFrame:fn=>{const id=++serial;callbacks.set(id,fn);return id;},cancelAnimationFrame:id=>callbacks.delete(id)});
 const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);};
 const event=(type,detail)=>{const e=new Event(type);e.detail=detail;document.dispatchEvent(e);};
 return {product,document,videos,renders,elements,callbacks,flush,event,get renderers(){return renderers;},setView:v=>current=v,current:()=>current,scenes,setPanes:v=>panes=v,panes:()=>panes,body:()=>new Element()};
}

test('All visible loops share a peer renderer, pause together, and Space toggles only the active frame',async()=>{
 const h=harness();await h.product.motion.toggleAll();await h.flush();for(const [id,callback]of [...h.callbacks]){h.callbacks.delete(id);callback();}await h.flush();assert.equal(h.videos.length,4);assert.ok(h.videos.every(v=>!v.paused));assert.equal(h.renderers,2,'One active renderer and one shared peer renderer');
 await h.product.motion.toggle();assert.equal(h.videos[0].paused,true);assert.ok(h.videos.slice(1).every(v=>!v.paused));
 await h.product.motion.toggle();assert.equal(h.videos[0].paused,false);
 await h.product.motion.toggleAll();await h.flush();assert.ok(h.videos.every(v=>v.paused));assert.equal(h.callbacks.size,0);
 await h.product.motion.toggleAll();await h.flush();assert.ok(h.videos.every(v=>!v.paused));
 h.product.motion.stop();assert.ok(h.videos.every(v=>v.paused));assert.ok(h.videos.slice(1).every(v=>v.removed&&!v.src));assert.equal(h.callbacks.size,0);
});

test('Expanding releases hidden videos, returning resumes them, and LUT changes reach every visible pane',async()=>{
 const h=harness();await h.product.motion.toggleAll();await h.flush();const previous=h.videos.slice(1),panes=h.panes();
 h.setPanes([]);h.event('lut-split-layout');await h.flush();assert.ok(previous.every(v=>v.paused&&v.removed));assert.equal(h.videos[0].paused,false);
 h.setPanes(panes);h.event('lut-split-layout');await h.flush();assert.ok(h.videos.slice(4).every(v=>!v.paused));
 const record={name:'New LUT'},adjustments={...h.current().adjustments,contrast:1.3};h.setView({...h.current(),record,adjustments});h.setPanes(panes.map(p=>({...p,record,adjustments})));h.event('lut-render-ready');await h.flush();
 for(const scene of h.scenes)assert.ok(h.renders.some(r=>r.scene===scene.id&&r.record===record&&r.adjustments.contrast===1.3));
 h.product.motion.stop();
});

test('Focus changes keep group playback running; scenes without motion are skipped',async()=>{
 const h=harness();delete h.scenes[3].motion;await h.product.motion.toggleAll();await h.flush();assert.equal(h.videos.length,3);
 const previous=h.current(),next={...previous,scene:h.scenes[1]};h.setPanes([h.scenes[0],h.scenes[2],h.scenes[3]].map(scene=>({...previous,scene,body:h.body()})));h.setView(next);h.event('lut-render-start',{sceneId:next.scene.id});h.event('lut-split-layout');h.event('lut-render-ready');await h.flush();
 assert.equal(h.product.motion.diagnostics().playing,true);assert.equal(h.product.motion.diagnostics().peers.length,2);assert.ok(h.product.motion.diagnostics().peers.every(p=>p.playing));
 h.product.motion.stop();
});

test('A delayed video start cannot restart after pause-all or leaving the group',async()=>{
 const h=harness();await h.product.motion.toggleAll();await h.flush();await h.product.motion.toggleAll();
 let release;const gate=new Promise(r=>release=r);const peer=h.videos[1];peer.deferPlay=gate;
 const starting=h.product.motion.toggleAll();await h.flush();h.setPanes([]);h.event('lut-split-layout');await h.product.motion.toggleAll();release();await starting;await h.flush();assert.equal(peer.paused,true);assert.equal(h.videos[0].paused,true);assert.equal(h.callbacks.size,0);h.product.motion.stop();
});

test('Copies of the active scene share its video clock while rendering separate LUTs',async()=>{
 const h=harness(),mono={name:'Mono'},warm={name:'Warm'},base=h.current();h.setPanes([{...base,paneId:'copy-1',record:mono,body:h.body()},{...base,paneId:'copy-2',record:warm,body:h.body()}]);await h.product.motion.toggle();await h.flush();assert.equal(h.videos.length,1,'Copies use the active decoder, not extra videos');assert.equal(h.product.motion.diagnostics().peers.length,2);assert.ok(h.product.motion.diagnostics().peers.every(p=>p.playing));assert.ok(h.renders.some(r=>r.record===mono));assert.ok(h.renders.some(r=>r.record===warm));assert.ok(h.renders.every(r=>r.video===h.videos[0]));
 h.videos[0].currentTime=4;for(const [id,callback]of [...h.callbacks]){h.callbacks.delete(id);callback();}await h.flush();assert.ok(h.renders.filter(r=>r.time===4).some(r=>r.record===mono));assert.ok(h.renders.filter(r=>r.time===4).some(r=>r.record===warm));await h.product.motion.toggle();await h.flush();assert.equal(h.videos[0].paused,true);assert.ok(h.product.motion.diagnostics().peers.every(p=>!p.playing));h.product.motion.stop();assert.equal(h.videos[0].removed,undefined,'Releasing copies never removes the main video');
});

test('Copies of another scene share one peer source and survive one copy being removed',async()=>{
 const h=harness(),scene=h.scenes[1],base=h.current(),one={...base,scene,paneId:'one',body:h.body()},two={...base,scene,paneId:'two',record:{name:'Mono'},body:h.body()};h.setPanes([one,two]);await h.product.motion.toggleAll();await h.flush();assert.equal(h.videos.length,2);assert.equal(h.product.motion.diagnostics().peers.length,2);h.setPanes([two]);h.event('lut-split-layout');await h.flush();assert.equal(h.videos[1].removed,undefined);assert.equal(h.videos[1].paused,false);assert.equal(h.product.motion.diagnostics().peers[0].id,'two');h.setPanes([]);h.event('lut-split-layout');assert.equal(h.videos[1].removed,true);assert.equal(h.videos[1].paused,true);assert.equal(h.videos[0].paused,false);h.product.motion.stop();
});
