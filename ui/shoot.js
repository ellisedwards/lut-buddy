'use strict';
(()=>{
 const $=id=>document.getElementById(id),product=window.LUTProduct,navigation=window.LUTLookNavigation;
 const scenes=product.getScenes(),sceneMap=new Map(scenes.map(s=>[s.id,s])),records=product.getRecords();
 const viewer=$('viewer'),grid=$('split-view'),storageKey='lut-split-view-'+product.boot.projectId;
 let saved;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
 const model=window.LUTSplitState.create(saved,scenes.map(s=>s.id),product.getSelection().scene);
 const sceneFor=id=>sceneMap.get(model.scene(id));
 const cells=new Map(),cache=new Map(),scratch=document.createElement('canvas');
 const homes=['stage','inspection-view','preview-loading'].map(id=>{const element=$(id),home=document.createComment(id+' home');element.before(home);return {element,home};});
 let renderer,paintVersion=0,cacheBytes=0,busy=false,styles=[],menuScene,pendingPane=null;
 const hasGroup=()=>model.state.ids.length>1,isGrid=()=>(hasGroup()||!!pendingPane)&&!model.state.focused;
 const family=record=>record?navigation.family(record):'';
 const compatible=(r,s)=>r.input===s.profile&&r.output==='rec709'||r.legacy&&r.input==='unknown'&&r.output==='unknown'&&s.profile==='sony-slog3-sgamut3cine';
 const recordFor=(s,target)=>target?records.find(r=>family(r)===target&&compatible(r,s)):null;
 const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 function icon(path,label){const button=node('button','pane-icon');button.type='button';button.title=label;button.setAttribute('aria-label',label);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');p.setAttribute('d',path);svg.append(p);button.append(svg);return button;}
 function remember(){try{const saved=model.snapshot();if(pendingPane)saved.focused=pendingPane.previousFocused;localStorage.setItem(storageKey,JSON.stringify(saved));}catch{}buttons();}
 function closeMenus(){$('split-menu').hidden=true;$('pane-menu').hidden=true;$('split-menu-open').setAttribute('aria-expanded','false');}
 // Preserve preview detail when a frame becomes inactive; scaling down here
 // made it visibly softer than the same frame in the active viewer.
 function copy(canvas,surface){const w=surface.videoWidth||surface.naturalWidth||surface.width,h=surface.videoHeight||surface.naturalHeight||surface.height;if(!w||!h)return;canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(surface,0,0,w,h);}
 function snapshotActive(){const v=product.getView(),cell=v&&model.scene(model.state.active)===v.scene.id&&cells.get(model.state.active);if(cell)try{copy(cell.canvas,product.motion?.currentView()?.surface||v.surface);}catch{}}
 function makeCell(id){
  const scene=sceneFor(id),pane=node('article','frame-pane');pane.dataset.scene=scene.id;pane.dataset.pane=id;pane.setAttribute('role','group');pane.setAttribute('aria-label',scene.label);
  const body=node('div','pane-body'),canvas=node('canvas','pane-canvas'),hit=node('button','pane-hit'),message=node('span','pane-message');
  hit.type='button';hit.setAttribute('aria-label','Focus '+scene.label);canvas.width=640;canvas.height=360;canvas.setAttribute('aria-label','Preview '+scene.label);
  const header=node('div','pane-heading'),label=node('button','pane-label',scene.label+' ⌄');label.type='button';label.setAttribute('aria-label','Replace '+scene.label);label.title='Replace frame';
  const look=node('span','pane-look'),duplicate=icon('M8 8h13v13H8zM16 8V3H3v13h5','Duplicate frame to compare looks'),expand=icon('M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5','Expand '+scene.label),more=icon('M5 12h.01M12 12h.01M19 12h.01','Frame actions for '+scene.label);
  duplicate.onclick=()=>duplicateFrame(id);header.append(label,look,duplicate,expand,more);body.append(canvas,hit,message);pane.append(body,header);
  hit.onclick=()=>activate(id);label.onclick=()=>pick(id);expand.onclick=()=>focus(id);more.onclick=()=>{activate(id);closeMenus();menuScene=id;$('pane-menu').hidden=false;const box=more.getBoundingClientRect(),parent=viewer.getBoundingClientRect();$('pane-menu').style.left=Math.max(8,Math.min(viewer.clientWidth-200,box.right-parent.left-190))+'px';$('pane-menu').style.top=Math.min(viewer.clientHeight-140,box.bottom-parent.top+4)+'px';};
  pane.addEventListener('dblclick',e=>{if(e.target.closest('.pane-heading'))return;e.preventDefault();model.state.focused?group():focus(id);});
  return {pane,body,canvas,hit,message,expand,look};
 }
 function buttons(){
  const count=model.state.ids.length;$('split-back').hidden=!hasGroup()||!model.state.focused;$('split-back').setAttribute('aria-label','Return to '+count+' frames');$('split-undo').hidden=!model.canUndo();
  $('shoot-open').setAttribute('aria-pressed',String(isGrid()));$('shoot-open').setAttribute('aria-label',hasGroup()?(isGrid()?'Expand active frame':'Show '+count+' frames'):'Split view');$('shoot-open').title=hasGroup()?(isGrid()?'Expand active frame':'Return to frame group'):'Add a frame to split view';
  $('split-link').hidden=!hasGroup();$('split-link').setAttribute('aria-pressed',String(model.state.linked));$('split-link').setAttribute('aria-label',model.state.linked?'Unlink looks':'Link looks');$('split-link').title=model.state.linked?'Looks linked: choosing a LUT changes all frames':'Looks unlinked: choosing a LUT changes the active frame. Link using its look';$('split-link-icon').setAttribute('d',model.state.linked?'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2':'m3 3 18 18M8 16l-1 1a3 3 0 0 1-4-4l3-3M16 8l1-1a3 3 0 0 0-4-4l-3 3M18 12l3-3M6 12l-3 3');
  $('split-keep').hidden=!hasGroup();$('shoot-pair').hidden=count!==2;$('split-saved').hidden=!hasGroup();$('split-apply').hidden=!hasGroup();$('split-apply').textContent=model.state.linked?'Apply look to '+new Set(model.state.ids.map(model.scene)).size+' scenes':'Apply active look to this scene';$('split-apply').disabled=busy||product.getSelection().comparing;
  $('shoot-export').textContent=count>1?'Export these '+count+' frames':'Export current frame';$('shoot-export').disabled=busy;$('shoot-save-style').disabled=busy||!product.getView();$('shoot-style-apply').disabled=busy||!$('shoot-style').value;$('shoot-delete-style').hidden=!$('shoot-style').value;
 }
 function layout(){
  snapshotActive();for(const [id,cell]of cells)if(!model.state.ids.includes(id)){cell.pane.remove();cells.delete(id);}const grouped=isGrid();viewer.classList.toggle('panes-grid',grouped);viewer.classList.toggle('has-frame-group',hasGroup());grid.hidden=!grouped;$('scene-picker-toggle').closest('.scene-control').hidden=grouped;document.querySelector('.topbar').classList.toggle('split-layout',grouped);
  if(grouped){
   for(const id of model.state.ids)if(!cells.has(id))cells.set(id,makeCell(id));
   for(const [id,cell]of cells)if(!model.state.ids.includes(id)){cell.pane.remove();cells.delete(id);}
   grid.replaceChildren(...model.state.ids.map(id=>cells.get(id).pane),...(pendingPane?[pendingPane.pane]:[]));grid.dataset.count=String(model.state.ids.length+(pendingPane?1:0));

   const active=cells.get(model.state.active);for(const {element,home}of homes)if(active)active.body.append(element);else home.after(element);
   for(const [id,cell]of cells){cell.pane.classList.toggle('active',id===model.state.active);cell.hit.hidden=id===model.state.active;cell.pane.setAttribute('aria-current',String(id===model.state.active));const target=targetFor(id),record=recordFor(sceneFor(id),target);cell.look.textContent=record?.code||'LOG';cell.look.title=record?.stem||record?.name||'No LUT';if(id===model.state.active){const missing=!!target&&!record;cell.pane.classList.toggle('pane-warning',missing);cell.pane.title=missing?'No compatible look for this recording profile':'';}}
  }else for(const {element,home}of homes)home.after(element);
  geometry();buttons();remember();document.dispatchEvent(new CustomEvent('lut-split-layout'));
 }
 function geometry(){
  if(!isGrid())return;
  // Fit the images themselves, then centre the touching grid as one group.
  // Full-width cells with contain-fit images left empty space at every seam.
  let best=1,area=0,width=0;const count=model.state.ids.length+(pendingPane?1:0);
  for(let cols=1;cols<=Math.min(count,8);cols++){if((count===3||count===4)&&cols!==2)continue;const rows=Math.ceil(count/cols),fit=Math.min(grid.clientWidth/cols,grid.clientHeight/rows*16/9),score=fit*fit*(count/(rows*cols));if(score>area){area=score;best=cols;width=fit;}}
  grid.style.setProperty('--pane-columns',best);grid.style.setProperty('--pane-width',width+'px');grid.style.setProperty('--pane-height',width*9/16+'px');
  // The global toolbar overlays the images. Keep local controls below it only
  // when the first row actually reaches that edge of the viewer.
  const rows=Math.ceil(count/best),top=(grid.clientHeight-rows*width*9/16)/2,toolbarBottom=Math.max($('split-tools').offsetTop+$('split-tools').offsetHeight,$('motion-play').parentElement.offsetTop+$('motion-play').parentElement.offsetHeight);
  grid.style.setProperty('--pane-tools-top',Math.max(5,toolbarBottom+8-top)+'px');
  for(const [index,id]of model.state.ids.entries())cells.get(id).pane.classList.toggle('pane-top-row',index<best);
  pendingPane?.pane.classList.toggle('pane-top-row',model.state.ids.length<best);if(!$('scene-picker').hidden)window.LUTScenePicker.position();
 }
 function show(){closeMenus();layout();const sceneId=model.scene(model.state.active);if(product.getSelection().scene!==sceneId)product.selectScene(sceneId);else product.refresh();}
 function activate(id){snapshotActive();model.activate(id);show();}
 function focus(id=model.state.active){snapshotActive();model.focus(id);show();}
 function group(){model.group();show();}
 function keep(id){snapshotActive();model.keep(id);show();}
 function resolvedLooks(){return Object.fromEntries(model.state.ids.map(id=>[id,targetFor(id)]));}
 function duplicateFrame(id=model.state.active){window.LUTScenePicker.close();snapshotActive();model.duplicate(id,resolvedLooks());product.resetCompare?.();show();}
 function pick(replace){
  window.LUTScenePicker.close();closeMenus();product.motion?.stop();let target;
  const openPicker=()=>window.LUTScenePicker.open({title:replace?'Replace frame':'Choose scene for new frame',anchor:target,onCancel:()=>{if(!pendingPane)return;const focused=pendingPane.previousFocused;pendingPane.pane.remove();pendingPane=null;model.state.focused=focused;show();},onChoose:id=>{snapshotActive();pendingPane?.pane.remove();pendingPane=null;if(replace)model.replace(replace,id);else model.add(id,targetFor(model.state.active));show();}});
  if(replace)target=cells.get(replace)?.pane;
  else{const pane=node('article','frame-pane pane-empty'),button=icon('M12 4v16M4 12h16','Choose a scene for new frame');pane.setAttribute('role','group');pane.setAttribute('aria-label','New frame');button.className='pane-empty-choose';button.append(node('span','Choose scene'));button.onclick=openPicker;pane.append(button);pendingPane={pane,previousFocused:model.state.focused};model.state.focused=false;layout();target=pane;paint();}
  openPicker();
 }
 function settings(scene){const a=window.LUTLookMath.settings(product.getSelection().adjustments?.[scene.id]||{});if(!window.LUTSourceCurves.forProfile(scene.profile)){a.exposure=0;a.warmth=0;a.tint=0;}return a;}
 function chosenFor(id){const fallback=product.getSelection().sceneLooks?.[model.scene(id)]??family(records.find(r=>r.name===product.getSelection().selected));return model.state.linked?model.state.family??fallback:model.state.looks[id]??fallback;}
 function targetFor(id){const selection=product.getSelection();return selection.comparing&&(model.state.linked||id===model.state.active)?family(records.find(r=>r.name===selection.reference)):chosenFor(id);}
 function keepCache(key,canvas){const bytes=canvas.width*canvas.height*4;cache.set(key,{canvas,bytes});cacheBytes+=bytes;while(cacheBytes>24*1024*1024&&cache.size>1){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).bytes;cache.delete(oldest);}}
 async function paint(){
  const version=++paintVersion;renderer?.cancel();if(!isGrid())return;grid.setAttribute('aria-busy','true');const pending=[];
  for(const id of model.state.ids){
   if(id===model.state.active)continue;const s=sceneFor(id),target=targetFor(id),record=recordFor(s,target),a=settings(s),key=JSON.stringify([s.id,record?.id||'',a]);
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
  paintVersion++;renderer?.cancel();alignScene(e.detail.sceneId);layout();
 });
 document.addEventListener('lut-render-ready',()=>{if(isGrid())$('stage').setAttribute('aria-label','Active frame '+sceneFor(model.state.active).label+'. Double-click to expand.');paint();buttons();});
 $('stage').addEventListener('keydown',e=>{if(e.key==='Enter'&&isGrid()){e.preventDefault();e.stopPropagation();focus();}});
 $('stage').addEventListener('dblclick',()=>{if(hasGroup()&&!isGrid())group();});
 $('split-add').onclick=()=>pick();$('shoot-open').onclick=()=>hasGroup()?(isGrid()?focus():group()):pick();$('split-back').onclick=group;$('split-undo').onclick=()=>{snapshotActive();model.undo();show();};
 $('split-duplicate').onclick=()=>duplicateFrame();$('pane-duplicate').onclick=()=>duplicateFrame(menuScene);$('split-link').onclick=()=>{snapshotActive();model.setLinked(!model.state.linked,resolvedLooks());product.resetCompare?.();show();};
 $('pane-replace').onclick=()=>pick(menuScene);$('pane-remove').onclick=()=>{model.remove(menuScene);show();};$('pane-keep').onclick=()=>keep(menuScene);$('split-keep').onclick=()=>keep(model.state.active);
 $('split-saved').onclick=()=>{model.state.family=null;model.state.looks={};if(!model.state.linked)model.state.looks=Object.fromEntries(model.state.ids.map(id=>[id,chosenFor(id)]));show();};
 async function call(method,payload={}){const r=await fetch('api/call',{method:'POST',headers:{'Content-Type':'application/json','X-LUT-Token':product.boot.token},body:JSON.stringify({method,payload:{projectId:product.boot.projectId,...payload}})}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Action unavailable.');return d.data;}
 async function safe(work){if(busy)return;busy=true;buttons();try{await work();}catch(error){$('shoot-status').textContent=error.message;}finally{busy=false;buttons();}}
 async function refreshStyles(){const data=await call('shootState');styles=data.library.styles;const selected=$('shoot-style').value;$('shoot-style').replaceChildren(new Option('Saved styles…',''),...styles.map(s=>new Option(s.name,s.id)));$('shoot-style').value=selected;buttons();return data;}
 $('split-menu-open').onclick=()=>{const open=$('split-menu').hidden;closeMenus();if(open){$('split-menu').hidden=false;$('split-menu-open').setAttribute('aria-expanded','true');safe(refreshStyles);}};
 $('shoot-style').onchange=()=>{const style=styles.find(s=>s.id===$('shoot-style').value);$('shoot-style-reference').hidden=!style;if(style)$('shoot-style-reference').src='assets/'+JSON.parse(style.details).reference;buttons();};
 async function apply(styleId){await product.flush();const data=await call('shootState'),sceneIds=model.state.linked?[...new Set(model.state.ids.map(model.scene))]:[model.scene(model.state.active)],result=await call('applyShoot',{sceneIds,family:chosenFor(model.state.active),styleId,expectedRevision:data.preferences.revision});if(model.state.linked)model.state.family=null;else delete model.state.looks[model.state.active];product.adoptSettings(result);$('shoot-status').textContent='Saved. Individual corrections kept. Library Undo is available.';window.LUTLibrary?.refresh();}
 $('split-apply').onclick=()=>safe(()=>apply());$('shoot-style-apply').onclick=()=>safe(()=>apply($('shoot-style').value));
 $('shoot-save-style').onclick=()=>{$('style-name').value='';$('style-name-status').textContent='';$('style-name-dialog').showModal();};
 $('style-name-form').onsubmit=async e=>{if(e.submitter?.value!=='save')return;e.preventDefault();const button=e.submitter;button.disabled=true;try{const v=product.getView();if(!v)throw Error('Wait for the frame to finish.');await call('saveStyle',{sceneId:v.scene.id,lutId:v.record?.id||'',adjustments:v.adjustments,name:$('style-name').value});$('style-name-dialog').close();await refreshStyles();$('shoot-status').textContent='Style saved with its reference example.';}catch(error){$('style-name-status').textContent=error.message;}finally{button.disabled=false;}};
 $('shoot-delete-style').onclick=()=>safe(async()=>{await call('deleteStyle',{id:$('shoot-style').value});await refreshStyles();$('shoot-style-reference').hidden=true;$('shoot-status').textContent='Style removed. Library Undo can restore it.';});
 $('shoot-export').onclick=()=>safe(async()=>{await product.flush();$('shoot-cancel').hidden=false;try{const result=await call('exportHandoff',{frames:model.state.ids.map(id=>({sceneId:model.scene(id),family:targetFor(id)}))}),link=node('a');link.href=result.url;link.download=result.name;link.click();$('shoot-status').textContent='Exported pinned stills, per-frame looks and instructions.';}finally{$('shoot-cancel').hidden=true;}});
 $('shoot-cancel').onclick=()=>call('cancel').catch(e=>$('shoot-status').textContent=e.message);
 $('shoot-pair').onclick=()=>{product.motion?.stop();const v=product.getView(),values=model.state.ids.map(id=>{const cell=cells.get(id),canvas=document.createElement('canvas');copy(canvas,id===model.state.active&&v?v.surface:cell.canvas);const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,mean=[0,0,0];for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)mean[k]+=data[i+k]/255/(data.length/4);return mean;});if(values.length!==2)return;const difference=values[1].map((v,i)=>(v-values[0][i])*100);$('shoot-pair-result').textContent='Average brightness Δ '+(difference[0]*.2126+difference[1]*.7152+difference[2]*.0722).toFixed(1)+' pts · RGB '+difference.map(n=>n.toFixed(1)).join(' / ');$('shoot-pair-result').title='Whole-frame averages depend on composition and lighting; this is not a skin-tone or camera calibration check.';};
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('#split-menu,#pane-menu,#split-menu-open,.pane-heading'))closeMenus();});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape'||e.defaultPrevented||document.querySelector('dialog[open]')||!$('scene-picker').hidden)return;if(!$('split-menu').hidden||!$('pane-menu').hidden){closeMenus();e.preventDefault();e.stopImmediatePropagation();}else if(model.state.focused){group();e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('resize',geometry);const sizing=new ResizeObserver(geometry);sizing.observe($('lut-dock'));sizing.observe(viewer);
 function alignScene(sceneId){if(!sceneMap.has(sceneId)||model.scene(model.state.active)===sceneId)return;const pane=model.state.ids.find(id=>model.scene(id)===sceneId);if(pane)model.activate(pane);else model.replace(model.state.active,sceneId);}
 product.split={hasGroup,isGrid,motionPanes:()=>isGrid()?model.state.ids.filter(id=>id!==model.state.active).map(id=>{const scene=sceneFor(id);return {paneId:id,scene,record:recordFor(scene,targetFor(id)),adjustments:settings(scene),body:cells.get(id).body};}):[],contains:id=>hasGroup()&&model.state.ids.some(p=>model.scene(p)===id),previewFamily:sceneId=>{alignScene(sceneId);return !model.state.linked?chosenFor(model.state.active):model.state.family??undefined;},chooseLook:value=>{if(!model.state.linked)for(const id of model.state.ids)if(!Object.hasOwn(model.state.looks,id))model.state.looks[id]=chosenFor(id);const changed=model.chooseLook(value);remember();return changed;}};
 alignScene(product.getSelection().scene);
 layout();product.refresh();
})();
