'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),split=require('../ui/split-state.js');

function harness(saved){
 const ids=new Map(),storage=new Map(),document=new EventTarget();let picker=null;
 class Element extends EventTarget{
  constructor(tag='div'){super();this.tagName=tag;this.children=[];this.hidden=false;this.style={values:{},setProperty:(k,v)=>this.style.values[k]=v};this.dataset={};this.attributes={};this.className='';this.classList={toggle:(c,on)=>{const classes=new Set(this.className.split(' ').filter(Boolean));if(on??!classes.has(c))classes.add(c);else classes.delete(c);this.className=[...classes].join(' ');},contains:c=>this.className.split(' ').includes(c)};this.clientWidth=1200;this.clientHeight=600;this.width=1280;this.height=720;this.offsetTop=14;this.offsetHeight=32;}
  append(...elements){for(const e of elements){e.remove();this.children.push(e);e.parentElement=this;}}
  before(e){e.parentElement=this.parentElement;}
  after(e){e.parentElement=this.parentElement;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.parentElement=null;}
  replaceChildren(...children){for(const child of [...this.children])child.remove();this.append(...children);}
  setAttribute(k,v){this.attributes[k]=v;}
  getContext(){return {drawImage(){}};}
  closest(){return get('scene-control');}
 }
 function get(id){if(!ids.has(id))ids.set(id,new Element());return ids.get(id);}
 document.getElementById=get;document.createElement=t=>new Element(t);document.createElementNS=(ns,t)=>new Element(t);document.createComment=()=>new Element('comment');document.querySelector=s=>s==='.topbar'?get('topbar'):null;
 const CustomEvent=class extends Event{constructor(t,options){super(t);this.detail=options?.detail;}};
 for(const id of ['stage','inspection-view','preview-loading','motion-play'])new Element().append(get(id));get('scene-picker').hidden=true;
 const scenes=['a','b','c','d','e'].map(id=>({id,label:'Scene '+id,profile:'rec709'})),records=['Look','Mono'].map((name,i)=>({name,id:i?'mono':'look',code:i?'B&W':'COL',input:'rec709',output:'rec709'}));let selection={scene:'a',selected:'Look',adjustments:{}};const state=()=>JSON.parse(storage.get('lut-split-view-p'));
 const product={boot:{projectId:'p'},getScenes:()=>scenes,getRecords:()=>records,getSelection:()=>selection,getView:()=>({scene:scenes.find(s=>s.id===selection.scene),record:records.find(r=>r.name===selection.selected),surface:get('surface')}),hasAdjustments:()=>false,getImage:async()=>({naturalWidth:1280,naturalHeight:720}),refresh:()=>{const look=product.split?.previewFamily(selection.scene);if(look!==undefined)selection.selected=records.find(r=>r.id===look)?.name||'';document.dispatchEvent(new CustomEvent('lut-render-start',{detail:{sceneId:selection.scene}}));document.dispatchEvent(new CustomEvent('lut-render-ready'));},selectScene:id=>{selection={...selection,scene:id};product.refresh();},motion:{stop(){}}};
 const window=new EventTarget();window.LUTProduct=product;window.LUTSplitState=split;window.LUTLookNavigation={family:r=>r?.id||''};window.LUTLookMath={settings:a=>({enabled:true,...a})};window.LUTSourceCurves={forProfile:()=>true};window.LUTScenePicker={position(){},close:()=>{const prior=picker;picker=null;get('scene-picker').hidden=true;prior?.onCancel?.();},open:options=>{picker=options;get('scene-picker').hidden=false;}};
 if(saved)storage.set('lut-split-view-p',JSON.stringify(saved));
 vm.runInNewContext(fs.readFileSync(require.resolve('../ui/shoot.js'),'utf8'),{window,document,CustomEvent,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},ResizeObserver:class{observe(){}},Option:class{}});
 return {get,state,product,picker:()=>picker,add:()=>get('split-add').onclick(),cancel:()=>window.LUTScenePicker.close(),choose:id=>{const prior=picker;picker=null;get('scene-picker').hidden=true;prior.onChoose(id);},replace:id=>get('split-view').children.find(p=>p.dataset.scene===id).children[1].children[0].onclick(),nodes:()=>get('split-view').children,activate:id=>get('split-view').children.find(p=>p.dataset.pane===id).children[0].children[1].onclick(),select:family=>{product.split.chooseLook(family);product.refresh();}};
}

test('Duplicating directly opens a second pane; LUT browsing and focus keep the two looks independent',()=>{
 const h=harness();h.get('split-duplicate').onclick();const copy=h.state().active;assert.deepEqual(h.state().ids,['a',copy]);assert.equal(h.picker(),null);assert.equal(h.state().linked,false);assert.equal(h.nodes()[0].dataset.scene,h.nodes()[1].dataset.scene);h.select('mono');assert.equal(h.product.getView().record.id,'mono');assert.equal(h.product.split.motionPanes()[0].record.id,'look');h.activate('a');assert.equal(h.product.getView().record.id,'look');assert.equal(h.product.split.motionPanes()[0].record.id,'mono');h.select('');assert.equal(h.product.getView().record,undefined);assert.equal(h.product.split.motionPanes()[0].record.id,'mono');h.activate(copy);assert.equal(h.product.getView().record.id,'mono');h.get('split-link').onclick();assert.equal(h.state().linked,true);assert.equal(h.product.split.motionPanes()[0].record.id,'mono');h.select('look');assert.equal(h.product.split.motionPanes()[0].record.id,'look');h.get('split-undo').onclick();assert.equal(h.state().linked,false);h.activate('a');assert.equal(h.product.getView().record,undefined);assert.equal(h.product.split.motionPanes()[0].record.id,'mono');
});

test('Keep-only preserves the chosen copy and reload restores its look; external scene selection still works',()=>{
 const h=harness();h.get('split-duplicate').onclick();const copy=h.state().active;h.select('mono');h.get('split-keep').onclick();assert.equal(h.get('split-view').hidden,true);assert.equal(h.product.getView().record.id,'mono');const next=harness(h.state());assert.equal(next.state().active,copy);assert.equal(next.product.getView().record.id,'mono');next.product.selectScene('b');assert.equal(next.product.getSelection().scene,'b');assert.equal(next.state().ids.length,1);assert.equal(next.state().ids[0],'b');
});

test('Returning to saved looks does not make unlinked neighbours follow later LUT choices',()=>{
 const h=harness();h.get('split-duplicate').onclick();h.select('mono');h.get('split-saved').onclick();assert.equal(h.product.split.motionPanes()[0].record.id,'mono');h.select('look');assert.equal(h.product.getView().record.id,'look');assert.equal(h.product.split.motionPanes()[0].record.id,'mono');
});

test('Add shows a transient blank frame and anchors its picker without saving a phantom scene',()=>{
 const h=harness();assert.equal(h.get('scene-control').hidden,false);h.add();assert.equal(h.nodes().length,2);const blank=h.nodes()[1];assert.ok(blank.classList.contains('pane-empty'));assert.equal(h.picker().anchor,blank);assert.equal(h.product.getSelection().scene,'a');assert.deepEqual(h.state().ids,['a']);assert.equal(h.get('scene-control').hidden,true);
 h.cancel();assert.equal(h.get('split-view').hidden,true);assert.equal(h.get('scene-control').hidden,false);assert.deepEqual(h.state().ids,['a']);
 h.add();h.choose('b');assert.deepEqual(h.state().ids,['a','b']);assert.equal(h.product.getSelection().scene,'b');assert.ok(h.nodes().every(p=>!p.classList.contains('pane-empty')));assert.equal(h.picker(),null);
});

test('Cancelling an add restores an expanded group; choosing an existing scene does not duplicate it',()=>{
 const h=harness({ids:['a','b'],active:'a',focused:true,family:'look'});h.add();assert.equal(h.nodes().length,3);assert.equal(h.state().focused,true,'Persist original focus until the blank is filled');h.cancel();assert.equal(h.get('split-view').hidden,true);assert.equal(h.state().focused,true);assert.deepEqual(h.state().ids,['a','b']);h.add();h.choose('b');assert.deepEqual(h.state().ids,['a','b']);assert.equal(h.product.getSelection().scene,'b');assert.equal(h.state().focused,false);
});

test('Each frame opens its picker over itself; replacement changes only that slot',()=>{
 const h=harness({ids:['a','b','c'],active:'a',focused:false,family:'look'});h.replace('b');assert.equal(h.picker().anchor.dataset.scene,'b');h.cancel();assert.deepEqual(h.state().ids,['a','b','c']);h.replace('b');h.choose('d');assert.deepEqual(h.state().ids,['a','d','c']);assert.equal(h.product.getSelection().scene,'d');
 h.add();assert.equal(h.nodes().length,4);assert.equal(h.get('split-view').style.values['--pane-columns'],2);h.choose('e');assert.deepEqual(h.state().ids,['a','d','c','e']);assert.equal(h.get('scene-control').hidden,true);
});

test('Anchored scene picker centres over the target and stays inside the viewport',()=>{
 const source=fs.readFileSync(require.resolve('../ui/scene-picker.js'),'utf8'),start=source.indexOf(' function position(){'),end=source.indexOf('\n function close(',start),body=source.slice(start,end);
 for(const box of [{left:0,top:0,width:350,height:200},{left:1100,top:650,width:350,height:200}]){
  const panel={style:{},offsetHeight:460},context={pickerAnchor:{getBoundingClientRect:()=>box},panel,innerWidth:1440,innerHeight:800};vm.runInNewContext(body+';position();',context);const left=parseFloat(panel.style.left),top=parseFloat(panel.style.top);assert.ok(left>=12&&left+580<=1428);assert.ok(top>=12&&top+460<=788);
 }
});

test('Picker selection fills the slot without invoking its cancel action',()=>{
 const source=fs.readFileSync(require.resolve('../ui/scene-picker.js'),'utf8'),close=source.slice(source.indexOf(' function close('),source.indexOf('\n async function open(')),select=source.slice(source.indexOf(' function select(id)'),source.indexOf('\n function setSelecting('));let chosen=0,cancelled=0;
 const panel={hidden:false},element={textContent:'',setAttribute(){}},context={panel,el:()=>element,toggle:element,choosing:()=>chosen++,pickerAnchor:null,cancelChoice:()=>cancelled++,requestVersion:0,clearDrag(){},selecting:false,checked:new Set(),anchor:undefined,busy:false};vm.runInNewContext(close+select+";select('b');",context);assert.equal(chosen,1);assert.equal(cancelled,0);assert.equal(panel.hidden,true);assert.equal(context.choosing,null);
 context.cancelChoice=()=>cancelled++;context.panel.hidden=false;vm.runInNewContext('close();close();',context);assert.equal(cancelled,1,'Cancellation is delivered once');
});
