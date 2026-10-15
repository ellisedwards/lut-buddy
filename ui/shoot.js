'use strict';
(()=>{
 const $=id=>document.getElementById(id),product=window.LUTProduct,navigation=window.LUTLookNavigation;
 const scenes=product.getScenes(),sceneMap=new Map(scenes.map(s=>[s.id,s])),records=product.getRecords();
 const viewer=$('viewer'),grid=$('split-view'),storageKey='lut-split-view-'+product.boot.projectId;
 let saved;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
 const model=window.LUTSplitState.create(saved,scenes.map(s=>s.id),product.getSelection().scene);
 const cells=new Map(),cache=new Map(),scratch=document.createElement('canvas');
 const homes=['stage','inspection-view','preview-loading'].map(id=>{const element=$(id),home=document.createComment(id+' home');element.before(home);return {element,home};});
 let renderer,paintVersion=0,cacheBytes=0,busy=false,styles=[],menuScene;
 const hasGroup=()=>model.state.ids.length>1,isGrid=()=>hasGroup()&&!model.state.focused;
 const family=record=>record?navigation.family(record):'';
 const compatible=(r,s)=>r.input===s.profile&&r.output==='rec709'||r.legacy&&r.input==='unknown'&&r.output==='unknown'&&s.profile==='sony-slog3-sgamut3cine';
 const recordFor=(s,target)=>target?records.find(r=>family(r)===target&&compatible(r,s)):null;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 function icon(path,label){const button=node('button','pane-icon');button.type='button';button.title=label;button.setAttribute('aria-label',label);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');p.setAttribute('d',path);svg.append(p);button.append(svg);return button;}
 function remember(){try{localStorage.setItem(storageKey,JSON.stringify(model.snapshot()));}catch{}buttons();}
 function closeMenus(){$('split-menu').hidden=true;$('pane-menu').hidden=true;$('split-menu-open').setAttribute('aria-expanded','false');}
 function copy(canvas,surface){const w=surface.videoWidth||surface.naturalWidth||surface.width,h=surface.videoHeight||surface.naturalHeight||surface.height;if(!w||!h)return;canvas.width=Math.min(640,w);canvas.height=Math.max(1,Math.round(h*canvas.width/w));canvas.getContext('2d').drawImage(surface,0,0,canvas.width,canvas.height);}
 function snapshotActive(){const v=product.getView(),cell=v&&cells.get(v.scene.id);if(cell)try{copy(cell.canvas,product.motion?.currentView()?.surface||v.surface);}catch{}}
 function makeCell(id){
  const scene=sceneMap.get(id),pane=node('article','frame-pane');pane.dataset.scene=id;pane.setAttribute('role','group');pane.setAttribute('aria-label',scene.label);
  const body=node('div','pane-body'),canvas=node('canvas','pane-canvas'),hit=node('button','pane-hit'),message=node('span','pane-message');
  hit.type='button';hit.setAttribute('aria-label','Focus '+scene.label);canvas.width=640;canvas.height=360;canvas.setAttribute('aria-label','Preview '+scene.label);
  const header=node('div','pane-heading'),label=node('button','pane-label',scene.label+' ⌄');label.type='button';label.setAttribute('aria-label','Replace '+scene.label);label.title='Replace frame';
  const expand=icon('M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5','Expand '+scene.label),more=icon('M5 12h.01M12 12h.01M19 12h.01','Frame actions for '+scene.label);
  header.append(label,expand,more);body.append(canvas,hit,message);pane.append(body,header);
  hit.onclick=()=>activate(id);label.onclick=()=>pick(id);expand.onclick=()=>focus(id);more.onclick=()=>{activate(id);closeMenus();menuScene=id;$('pane-menu').hidden=false;const box=more.getBoundingClientRect(),parent=viewer.getBoundingClientRect();$('pane-menu').style.left=Math.max(8,Math.min(viewer.clientWidth-200,box.right-parent.left-190))+'px';$('pane-menu').style.top=Math.min(viewer.clientHeight-140,box.bottom-parent.top+4)+'px';};
  pane.addEventListener('dblclick',e=>{if(e.target.closest('.pane-heading'))return;e.preventDefault();model.state.focused?group():focus(id);});
  return {pane,body,canvas,hit,message,expand};
 }
 function buttons(){
  const count=model.state.ids.length;$('split-back').hidden=!hasGroup()||!model.state.focused;$('split-back').setAttribute('aria-label','Return to '+count+' frames');$('split-undo').hidden=!model.canUndo();
  $('shoot-open').setAttribute('aria-pressed',String(isGrid()));$('shoot-open').setAttribute('aria-label',hasGroup()?(isGrid()?'Expand active frame':'Show '+count+' frames'):'Split view');$('shoot-open').title=hasGroup()?(isGrid()?'Expand active frame':'Return to frame group'):'Add a frame to split view';
  $('split-keep').hidden=!hasGroup();$('shoot-pair').hidden=count!==2;$('split-saved').hidden=!hasGroup();$('split-apply').hidden=!hasGroup();$('split-apply').textContent='Apply look to '+count+' frames';$('split-apply').disabled=busy||model.state.family===null||product.getSelection().comparing;
  $('shoot-export').textContent=count>1?'Export these '+count+' frames':'Export current frame';$('shoot-export').disabled=busy;$('shoot-save-style').disabled=busy||!product.getView();$('shoot-style-apply').disabled=busy||!$('shoot-style').value;$('shoot-delete-style').hidden=!$('shoot-style').value;
 }
 function layout(){
  snapshotActive();for(const [id,cell]of cells)if(!model.state.ids.includes(id)){cell.pane.remove();cells.delete(id);}const grouped=isGrid();viewer.classList.toggle('panes-grid',grouped);viewer.classList.toggle('has-frame-group',hasGroup());grid.hidden=!grouped;
  if(grouped){
   for(const id of model.state.ids)if(!cells.has(id))cells.set(id,makeCell(id));
   for(const [id,cell]of cells)if(!model.state.ids.includes(id)){cell.pane.remove();cells.delete(id);}
   grid.replaceChildren(...model.state.ids.map(id=>cells.get(id).pane));grid.dataset.count=String(model.state.ids.length);

   const active=cells.get(model.state.active);for(const {element}of homes)active.body.append(element);
   for(const [id,cell]of cells){cell.pane.classList.toggle('active',id===model.state.active);cell.hit.hidden=id===model.state.active;cell.pane.setAttribute('aria-current',String(id===model.state.active));if(id===model.state.active){const target=targetFor(id),missing=!!target&&!recordFor(sceneMap.get(id),target);cell.pane.classList.toggle('pane-warning',missing);cell.pane.title=missing?'No compatible look for this recording profile':'';}}
  }else for(const {element,home}of homes)home.after(element);
  geometry();buttons();remember();
 }
 function geometry(){viewer.style.setProperty('--pane-bottom',($('lut-dock').hidden?8:$('lut-dock').offsetHeight+28)+'px');if(isGrid()){let best=1,area=0;const count=model.state.ids.length;for(let cols=1;cols<=Math.min(count,8);cols++){const rows=Math.ceil(count/cols),w=(grid.clientWidth-(cols-1)*5)/cols,h=(grid.clientHeight-(rows-1)*5)/rows-28,fit=Math.min(w,h*16/9),score=fit*fit*(count/(rows*cols));if(score>area){area=score;best=cols;}}grid.style.setProperty('--pane-columns',best);}}
 function show(){closeMenus();layout();if(product.getSelection().scene!==model.state.active)product.selectScene(model.state.active);else product.refresh();}
 function activate(id){snapshotActive();model.activate(id);show();}
 function focus(id=model.state.active){snapshotActive();model.focus(id);show();}
 function group(){model.group();show();}
 function keep(id){snapshotActive();model.keep(id);show();}
 function pick(replace){closeMenus();product.motion?.stop();window.LUTScenePicker.open({title:replace?'Replace frame':'Add frame to split view',onChoose:id=>{snapshotActive();if(replace)model.replace(replace,id);else model.add(id,family(product.getView()?.selected||records.find(r=>r.name===product.getSelection().selected)));show();}});}
 function settings(scene){const a=window.LUTLookMath.settings(product.getSelection().adjustments?.[scene.id]||{});if(!window.LUTSourceCurves.forProfile(scene.profile)){a.exposure=0;a.warmth=0;a.tint=0;}return a;}
 function targetFor(id){const selection=product.getSelection();if(selection.comparing)return family(records.find(r=>r.name===selection.reference));return model.state.family===null?product.getSelection().sceneLooks?.[id]??family(records.find(r=>r.name===product.getSelection().selected)):model.state.family;}
 function keepCache(key,canvas){const bytes=canvas.width*canvas.height*4;cache.set(key,{canvas,bytes});cacheBytes+=bytes;while(cacheBytes>24*1024*1024&&cache.size>1){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).bytes;cache.delete(oldest);}}
 async function paint(){
  const version=++paintVersion;renderer?.cancel();if(!isGrid())return;grid.setAttribute('aria-busy','true');const pending=[];
  for(const id of model.state.ids){
   if(id===model.state.active)continue;const s=sceneMap.get(id),target=targetFor(id),record=recordFor(s,target),a=settings(s),key=JSON.stringify([id,record?.id||'',a]);
   const warning=target&&!record?'No compatible look':s.profile==='unknown'?'Confirm recording profile':'';
   try{
    let image=cache.get(key)?.canvas;
    if(!image){const snapshot=document.createElement('canvas');if(product.hasAdjustments(a)&&(record||a.exposure||a.warmth||a.tint)){if(!renderer)renderer=new window.LUTPreviewRenderer(scratch);if(!await renderer.render(s,record,a)||version!==paintVersion)return;copy(snapshot,scratch);}else copy(snapshot,await product.getImage(record?.name||'',id));if(version!==paintVersion)return;keepCache(key,snapshot);image=snapshot;}
    pending.push({id,image,warning,code:record?.code||'LOG'});
   }catch(error){pending.push({id,warning:error.message,failed:true});}
   if(version!==paintVersion||!isGrid())return;
  }
  if(version!==paintVersion)return;
  // Keep existing pictures until the whole new comparison is ready.
  for(const value of pending){const cell=cells.get(value.id);if(!cell)continue;if(value.image)copy(cell.canvas,value.image);cell.canvas.dataset.look=value.code||'';cell.message.textContent=value.failed?'Preview unavailable':'';cell.pane.title=value.warning;cell.pane.classList.toggle('pane-warning',!!value.warning);}
  grid.setAttribute('aria-busy','false');
 }
 document.addEventListener('lut-render-start',e=>{
  paintVersion++;renderer?.cancel();const id=e.detail.sceneId;if(!model.state.ids.includes(id))model.replace(model.state.active,id);else model.activate(id);layout();
 });
 document.addEventListener('lut-render-ready',()=>{if(isGrid())$('stage').setAttribute('aria-label','Active frame '+sceneMap.get(model.state.active).label+'. Double-click to expand.');paint();buttons();});
 $('stage').addEventListener('keydown',e=>{if(e.key==='Enter'&&isGrid()){e.preventDefault();e.stopPropagation();focus();}});
 $('stage').addEventListener('dblclick',()=>{if(hasGroup()&&!isGrid())group();});
 $('split-add').onclick=()=>pick();$('shoot-open').onclick=()=>hasGroup()?(isGrid()?focus():group()):pick();$('split-back').onclick=group;$('split-undo').onclick=()=>{snapshotActive();model.undo();show();};
 $('pane-replace').onclick=()=>pick(menuScene);$('pane-remove').onclick=()=>{model.remove(menuScene);show();};$('pane-keep').onclick=()=>keep(menuScene);$('split-keep').onclick=()=>keep(model.state.active);
 $('split-saved').onclick=()=>{model.state.family=null;show();};
 async function call(method,payload={}){const r=await fetch('api/call',{method:'POST',headers:{'Content-Type':'application/json','X-LUT-Token':product.boot.token},body:JSON.stringify({method,payload:{projectId:product.boot.projectId,...payload}})}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Action unavailable.');return d.data;}
 async function safe(work){if(busy)return;busy=true;buttons();try{await work();}catch(error){$('shoot-status').textContent=error.message;}finally{busy=false;buttons();}}
 async function refreshStyles(){const data=await call('shootState');styles=data.library.styles;const selected=$('shoot-style').value;$('shoot-style').replaceChildren(new Option('Saved styles…',''),...styles.map(s=>new Option(s.name,s.id)));$('shoot-style').value=selected;buttons();return data;}
 $('split-menu-open').onclick=()=>{const open=$('split-menu').hidden;closeMenus();if(open){$('split-menu').hidden=false;$('split-menu-open').setAttribute('aria-expanded','true');safe(refreshStyles);}};
 $('shoot-style').onchange=()=>{const style=styles.find(s=>s.id===$('shoot-style').value);$('shoot-style-reference').hidden=!style;if(style)$('shoot-style-reference').src='assets/'+JSON.parse(style.details).reference;buttons();};
 async function apply(styleId){await product.flush();const data=await call('shootState'),result=await call('applyShoot',{sceneIds:[...model.state.ids],family:model.state.family??family(product.getView()?.selected),styleId,expectedRevision:data.preferences.revision});model.state.family=null;product.adoptSettings(result);$('shoot-status').textContent='Saved. Individual corrections kept. Library Undo is available.';window.LUTLibrary?.refresh();}
 $('split-apply').onclick=()=>safe(()=>apply());$('shoot-style-apply').onclick=()=>safe(()=>apply($('shoot-style').value));
 $('shoot-save-style').onclick=()=>{$('style-name').value='';$('style-name-status').textContent='';$('style-name-dialog').showModal();};
 $('style-name-form').onsubmit=async e=>{if(e.submitter?.value!=='save')return;e.preventDefault();const button=e.submitter;button.disabled=true;try{const v=product.getView();if(!v)throw Error('Wait for the frame to finish.');await call('saveStyle',{sceneId:v.scene.id,lutId:v.record?.id||'',adjustments:v.adjustments,name:$('style-name').value});$('style-name-dialog').close();await refreshStyles();$('shoot-status').textContent='Style saved with its reference example.';}catch(error){$('style-name-status').textContent=error.message;}finally{button.disabled=false;}};
 $('shoot-delete-style').onclick=()=>safe(async()=>{await call('deleteStyle',{id:$('shoot-style').value});await refreshStyles();$('shoot-style-reference').hidden=true;$('shoot-status').textContent='Style removed. Library Undo can restore it.';});
 $('shoot-export').onclick=()=>safe(async()=>{await product.flush();$('shoot-cancel').hidden=false;try{const result=await call('exportHandoff',{sceneIds:[...model.state.ids],...(product.getSelection().comparing?{family:family(product.getView()?.record)}:model.state.family!==null&&hasGroup()?{family:model.state.family}:{fallbackFamily:family(product.getView()?.selected)})}),link=node('a');link.href=result.url;link.download=result.name;link.click();$('shoot-status').textContent='Exported pinned stills, per-shot looks and instructions.';}finally{$('shoot-cancel').hidden=true;}});
 $('shoot-cancel').onclick=()=>call('cancel').catch(e=>$('shoot-status').textContent=e.message);
 $('shoot-pair').onclick=()=>{product.motion?.stop();const v=product.getView(),values=model.state.ids.map(id=>{const cell=cells.get(id),canvas=document.createElement('canvas');copy(canvas,id===v?.scene.id?v.surface:cell.canvas);const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,mean=[0,0,0];for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)mean[k]+=data[i+k]/255/(data.length/4);return mean;});if(values.length!==2)return;const difference=values[1].map((v,i)=>(v-values[0][i])*100);$('shoot-pair-result').textContent='Average brightness Δ '+(difference[0]*.2126+difference[1]*.7152+difference[2]*.0722).toFixed(1)+' pts · RGB '+difference.map(n=>n.toFixed(1)).join(' / ');$('shoot-pair-result').title='Whole-frame averages depend on composition and lighting; this is not a skin-tone or camera calibration check.';};
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('#split-menu,#pane-menu,#split-menu-open,.pane-heading'))closeMenus();});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||document.querySelector('dialog[open]')||!$('scene-picker').hidden)return;if(!$('split-menu').hidden||!$('pane-menu').hidden){closeMenus();e.preventDefault();e.stopImmediatePropagation();}else if(model.state.focused){group();e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('resize',geometry);const sizing=new ResizeObserver(geometry);sizing.observe($('lut-dock'));sizing.observe(viewer);
 product.split={hasGroup,isGrid,contains:id=>hasGroup()&&model.state.ids.includes(id),previewFamily:()=>model.state.family!==null?model.state.family:undefined,chooseLook:value=>{const next=hasGroup()?value:null,changed=next!==model.state.family;model.state.family=next;remember();return changed;}};
 if(model.state.ids.length&&!model.state.ids.includes(product.getSelection().scene))model.replace(model.state.active,product.getSelection().scene);
 layout();product.refresh();
})();
