'use strict';
(()=>{
 const el=id=>document.getElementById(id),product=window.LUTProduct,boot=product.boot;
 const sceneMap=new Map(JSON.parse(el('scenes-manifest').textContent).map(s=>[s.id,s]));
 const camera=JSON.parse(el('camera-metadata').textContent),navigation=window.LUTLookNavigation,devices=new Map([...sceneMap].map(([id])=>[id,navigation.device(camera[id]?.format?.fields?.camera_model)]));
 const deviceChoices=new Map([...devices.values()].map(d=>[d.key,d.label]));
 const filteredIds=scope=>orderIds(scope).filter(id=>!product.getSelection().sceneDevice||devices.get(id)?.key===product.getSelection().sceneDevice);
 const baseOrder=product.getSceneNavigation(),panel=el('scene-picker'),toggle=el('scene-picker-toggle'),list=el('scene-picker-list');
 let data={collections:[],memberships:[],sceneOrders:[],...boot.picker},available=new Set(baseOrder),browsing='',busy=false,dragging,draggingFolder,dropTarget,naming=false,requestVersion=0,selecting=false,checked=new Set(),anchor,undoRemoval,history;
 const reopenKey='scene-picker-reopen-'+boot.projectId;
 const node=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
 const groups=()=>data.collections.filter(c=>c.project_id===boot.projectId);
 const folder=id=>groups().find(c=>c.id===id);
 function orderIds(scope=''){
  const members=new Set(data.memberships.filter(m=>m.collection_id===scope).map(m=>m.scene_id));
  const positions=new Map(data.sceneOrders.filter(o=>o.project_id===boot.projectId&&o.scope===scope).map(o=>[o.scene_id,o.position]));
  const personal=id=>!!sceneMap.get(id)?.clip&&!sceneMap.get(id)?.demo;
  const rank=id=>positions.get(id)??(!scope&&personal(id)?-1-baseOrder.indexOf(id):Infinity);
  return baseOrder.filter(id=>available.has(id)&&(!scope||members.has(id))).sort((a,b)=>(scope?0:Number(personal(b))-Number(personal(a)))||rank(a)-rank(b));
 }
 const visibleIds=()=>{const search=el('scene-picker-search').value.trim().toLowerCase();return filteredIds(browsing).filter(id=>`${product.sceneTitle(id)} ${sceneMap.get(id).gamma||''} ${sceneMap.get(id).tags||''}`.toLowerCase().includes(search));};
 function sync(redraw=true){
  const selected=product.getSelection();let scope=selected.sceneCollection||'';
  if(scope&&!folder(scope)){scope='';product.setSceneCollection('');}
  const ids=filteredIds(scope);
  product.setSceneNavigation(ids);
  if(ids.length&&!ids.includes(selected.scene)){product.selectScene(ids[0]);return;}
  el('scene-picker-title').textContent=product.sceneTitle(selected.scene)||'Choose a scene';
  const label=[folder(scope)?.name,deviceChoices.get(selected.sceneDevice)].filter(Boolean).join(' · '),context=el('scene-picker-context');context.textContent=label;context.hidden=!label;
  toggle.title=(label?label+' · ':'')+(product.sceneTitle(selected.scene)||'Choose a scene');
  if(!panel.hidden&&redraw)draw();
 }
 function setLibrary(value){
  history=value.history||history;requestVersion++;const next={collections:value.collections||[],memberships:value.memberships||[],sceneOrders:value.sceneOrders||[]};let changed=JSON.stringify(next)!==JSON.stringify(data);data=next;
  if(undoRemoval&&undoRemoval.historyId!==history?.undo?.id)undoRemoval=undefined;
  if(!undoRemoval&&['Remove scene','Remove scenes'].includes(history?.undo?.label))undoRemoval={collectionId:'',historyId:history.undo.id};
  if(value.scenes){const ids=value.scenes.filter(s=>s.project_id===boot.projectId).map(s=>s.id);if(ids.length!==available.size||ids.some(id=>!available.has(id)))changed=true;available=new Set(ids);for(const scene of value.scenes)if(sceneMap.has(scene.id)){if((sceneMap.get(scene.id).tags||'')!==(scene.tags||''))changed=true;sceneMap.get(scene.id).tags=scene.tags;}}
  if(browsing&&!folder(browsing))browsing='';const remaining=new Set(orderIds(browsing));checked=new Set([...checked].filter(id=>remaining.has(id)));sync(changed);drawActions();
 }
 async function call(method,payload){const r=await fetch('api/call',{method:'POST',headers:{'Content-Type':'application/json','X-LUT-Token':boot.token},body:JSON.stringify({method,payload:{projectId:boot.projectId,...payload}})});const result=await r.json();if(!r.ok||result.ok===false)throw new Error(result.error||'Could not save this change.');return result.data;}
 function status(text){el('scene-picker-status').textContent=text;}
 async function saved(work,message){if(busy)return false;busy=true;panel.setAttribute('aria-busy','true');drawActions();try{const value=await work();if(window.LUTLibrary?.acceptSnapshot)window.LUTLibrary.acceptSnapshot(value);else setLibrary(value);status(message);return true;}catch(error){status(error.message);draw();return false;}finally{busy=false;panel.removeAttribute('aria-busy');drawActions();}}
 function position(){const box=toggle.getBoundingClientRect(),width=Math.min(580,innerWidth-24);panel.style.width=width+'px';panel.style.left=Math.max(12,Math.min(box.left,innerWidth-width-12))+'px';panel.style.top=(box.bottom+8)+'px';panel.style.maxHeight=Math.max(130,innerHeight-box.bottom-20)+'px';}
 function close(focus=false){panel.hidden=true;toggle.setAttribute('aria-expanded','false');clearDrag();selecting=false;checked.clear();anchor=undefined;if(focus)toggle.focus({preventScroll:true});}
 async function open(){
  browsing=product.getSelection().sceneCollection||'';el('scene-picker-search').value='';status('');panel.hidden=false;toggle.setAttribute('aria-expanded','true');position();draw();el('scene-picker-search').focus({preventScroll:true});
  const version=++requestVersion;
  try{const r=await fetch(`api/state?project=${boot.projectId}`,{cache:'no-store'});if(!r.ok)throw new Error('Could not refresh this scene list.');const value=await r.json();if(version===requestVersion&&!busy&&!dragging&&!draggingFolder)setLibrary(value);}catch(error){status(error.message);}
 }
 function chooseScope(id){
  if(busy)return;if(browsing!==id){checked.clear();anchor=undefined;}browsing=id;el('scene-picker-search').value='';status('');const ids=filteredIds(id);
  // Empty collections can be explored without replacing the last usable preview.
  if(ids.length){product.setSceneCollection(id);product.setSceneNavigation(ids);if(!ids.includes(product.getSelection().scene))product.selectScene(ids[0]);else sync();}
  draw();
 }
 function select(id){if(busy)return;product.setSceneCollection(browsing);product.setSceneNavigation(filteredIds(browsing));product.selectScene(id);close(true);}
 function setSelecting(value){if(busy)return;selecting=value;if(!value){checked.clear();anchor=undefined;}draw();}
 function check(id,event){
  if(busy)return;selecting=true;const ids=visibleIds(),value=!checked.has(id);
  const range=event?.shiftKey&&ids.includes(anchor)?ids.slice(Math.min(ids.indexOf(anchor),ids.indexOf(id)),Math.max(ids.indexOf(anchor),ids.indexOf(id))+1):[id];
  for(const item of range)value?checked.add(item):checked.delete(item);anchor=id;draw();list.querySelector(`[data-scene="${id}"] .scene-picker-checkbox`)?.focus({preventScroll:true});
 }
 function drawActions(){
  el('scene-picker-device').disabled=busy;
  const count=checked.size,selectButton=el('scene-picker-select');selectButton.textContent=selecting?'Done':'Select';selectButton.setAttribute('aria-pressed',String(selecting));selectButton.disabled=busy;
  el('scene-picker-actions').hidden=!selecting;el('scene-picker-count').textContent=`${count} selected`;const visible=visibleIds();el('scene-picker-select-all').textContent=visible.length&&visible.every(id=>checked.has(id))?'Deselect all':'Select all';el('scene-picker-select-all').disabled=busy||!visible.length;
  const add=el('scene-picker-add');add.replaceChildren(new Option('Add to…',''),...groups().map(c=>new Option(c.name,c.id)),new Option('New collection…','__new'));add.disabled=busy||!count;
  const removeButton=el('scene-picker-remove');removeButton.hidden=false;removeButton.disabled=busy||!count;removeButton.textContent=browsing?'Remove from collection':'Remove from project';removeButton.title=browsing?`Remove selected scenes from ${folder(browsing)?.name||'this collection'}. Keep them in All scenes.`:'Remove selected scenes from All scenes and every collection in this project. Original clips and saved files are kept; Undo is available.';
  el('scene-picker-review').disabled=busy||!count;
  el('scene-picker-undo').hidden=!undoRemoval;el('scene-picker-undo').disabled=busy;
  for(const input of list.querySelectorAll('.scene-picker-checkbox'))input.disabled=busy;
 }
 function folderButton(id,label){
  const button=node('button',undefined,'scene-picker-folder');button.type='button';button.dataset.collection=id;button.title=label;
  button.setAttribute('aria-pressed',String(browsing===id));
  const icon=node('span',undefined,'scene-picker-folder-icon'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),outline=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');outline.setAttribute('d',id?'M3 6h7l2 3h9v11H3Z':'M4 4h16v16H4ZM8 8h8M8 12h8M8 16h8');svg.append(outline);icon.append(svg);button.append(icon,node('span',label));
  button.addEventListener('click',()=>chooseScope(id));
  if(id){button.addEventListener('dragover',e=>{if(!dragging||busy)return;e.preventDefault();e.dataTransfer.dropEffect='copy';button.classList.add('scene-drop-folder');});button.addEventListener('dragleave',()=>button.classList.remove('scene-drop-folder'));button.addEventListener('drop',e=>{if(!dragging)return;e.preventDefault();e.stopPropagation();const source=dragging;clearDrag();if(source)add(source,id);});}
  return button;
 }
 function folderRow(collection){
  const row=node('div',undefined,'scene-picker-folder-row');row.dataset.folder=collection.id;
  const handle=node('button','⠿','scene-picker-folder-grip');handle.type='button';handle.draggable=true;handle.title='Drag to reorder collections. Alt + Up/Down also reorders.';handle.setAttribute('aria-label','Rearrange collection '+collection.name);
  handle.addEventListener('dragstart',e=>{if(busy){e.preventDefault();return;}draggingFolder=collection.id;e.dataTransfer.setData('text/plain',collection.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setDragImage(row,20,20);row.classList.add('scene-dragging');});handle.addEventListener('dragend',clearDrag);
  handle.addEventListener('keydown',e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();const ids=groups().map(c=>c.id),index=ids.indexOf(collection.id),next=index+(e.key==='ArrowUp'?-1:1);if(next>=0&&next<ids.length)moveFolder(collection.id,ids[next],next>index);}});
  const rename=node('button','✎','scene-picker-folder-rename');rename.type='button';rename.title='Rename collection';rename.setAttribute('aria-label','Rename '+collection.name);rename.addEventListener('click',()=>renameFolder(collection));
  row.append(handle,folderButton(collection.id,collection.name),rename);
  row.addEventListener('dragover',e=>{if(!draggingFolder||busy||draggingFolder===collection.id)return;e.preventDefault();e.dataTransfer.dropEffect='move';markDrop(row,e.clientY>row.getBoundingClientRect().top+row.offsetHeight/2);});
  row.addEventListener('dragleave',e=>{if(!row.contains(e.relatedTarget))row.classList.remove('scene-drop-before','scene-drop-after');});
  row.addEventListener('drop',e=>{if(!draggingFolder)return;e.preventDefault();e.stopPropagation();const source=draggingFolder,after=row.classList.contains('scene-drop-after');clearDrag();moveFolder(source,collection.id,after);});return row;
 }
 async function moveFolder(source,target,after){
  if(busy||source===target)return;const ids=groups().map(c=>c.id).filter(id=>id!==source);ids.splice(ids.indexOf(target)+(after?1:0),0,source);
  await saved(()=>call('reorderCollections',{projectId:boot.projectId,ids}),'Collection order saved.');el('scene-picker-folders').querySelector(`[data-folder="${source}"] .scene-picker-folder-grip`)?.focus({preventScroll:true});
 }
 async function collectionName(title,value=''){
  if(busy||naming)return;naming=true;const dialog=el('scene-picker-name-dialog');dialog.querySelector('h2').textContent=title;dialog.querySelector('button[value=create]').textContent=value?'Save':'Create';el('scene-picker-name').value=value;dialog.returnValue='';dialog.showModal();
  const result=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='create'?el('scene-picker-name').value.trim():null),{once:true}));naming=false;return result;
 }
 async function renameFolder(collection){const name=await collectionName('Rename collection',collection.name);if(name)await saved(()=>call('renameCollection',{id:collection.id,name,expectedName:collection.name}),'Collection renamed.');}
 function draw(){
  const deviceSelect=el('scene-picker-device'),current=product.getSelection().sceneDevice||'';
  deviceSelect.replaceChildren(new Option('All devices',''),...[...deviceChoices].map(([key,label])=>new Option(label,key)));deviceSelect.value=current;deviceSelect.disabled=busy;
  const folders=el('scene-picker-folders');folders.replaceChildren(folderButton('','All scenes'),node('small','Collections','scene-picker-folder-heading'),...groups().map(folderRow));
  el('scene-picker-list-title').textContent=folder(browsing)?.name||'All scenes';list.replaceChildren();
  const ids=visibleIds(),selected=product.getSelection().scene;
  for(const id of ids){
   const scene=sceneMap.get(id),row=node('li',undefined,'scene-picker-row');row.dataset.scene=id;
   const handle=node('button','⠿','scene-picker-grip');handle.type='button';handle.draggable=true;handle.setAttribute('aria-label','Rearrange '+scene.label);handle.title='Drag to reorder or add to a collection. Alt + Up/Down also reorders.';
   handle.addEventListener('dragstart',e=>{if(busy){e.preventDefault();return;}dragging=checked.has(id)?orderIds(browsing).filter(item=>checked.has(item)):[id];e.dataTransfer.setData('text/plain',dragging.join('\n'));e.dataTransfer.effectAllowed='copyMove';e.dataTransfer.setDragImage(row,20,20);for(const item of dragging)list.querySelector(`[data-scene="${item}"]`)?.classList.add('scene-dragging');showTrash();status(`Dragging ${dragging.length===1?'1 scene':dragging.length+' scenes'}. Drop onto a collection to add, or the trash target to ${browsing?'remove from this collection':'remove from the project'}.`);});handle.addEventListener('dragend',clearDrag);
   handle.addEventListener('keydown',e=>{if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();const index=ids.indexOf(id),next=index+(e.key==='ArrowUp'?-1:1);if(next>=0&&next<ids.length)move(id,ids[next],e.key==='ArrowDown');}});
   const button=node('button',undefined,'scene-picker-choose');button.type='button';button.setAttribute('aria-pressed',String(selected===id));button.dataset.scene=id;button.title=product.sceneTitle(id);
   const image=node('img');image.src=scene.original_url||`previews/${id}/original`;image.alt='';image.draggable=false;
   const text=node('span',undefined,'scene-picker-row-text');text.append(node('span',scene.label),node('small',scene.demo||!scene.clip?'Demo':scene.gamma||'[Unverified] profile'));
   button.append(image,text,node('span',selected===id?'✓':'','scene-picker-check'));button.addEventListener('click',e=>selecting||e.metaKey||e.ctrlKey||e.shiftKey?check(id,e):select(id));
   row.append(handle);if(selecting){const checkbox=node('input',undefined,'scene-picker-checkbox');checkbox.type='checkbox';checkbox.checked=checked.has(id);checkbox.disabled=busy;checkbox.setAttribute('aria-label','Select '+scene.label);checkbox.addEventListener('click',e=>check(id,e));row.append(checkbox);row.classList.toggle('scene-marked',checked.has(id));}row.append(button);list.append(row);
   row.addEventListener('dragover',e=>{if(!dragging||busy||dragging.includes(id))return;e.preventDefault();e.dataTransfer.dropEffect='move';markDrop(row,e.clientY>row.getBoundingClientRect().top+row.offsetHeight/2);autoScroll(e.clientY);});
   row.addEventListener('dragleave',e=>{if(!row.contains(e.relatedTarget))row.classList.remove('scene-drop-before','scene-drop-after');});
   row.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();const source=dragging,after=row.classList.contains('scene-drop-after');clearDrag();if(source&&!source.includes(id))move(source,id,after);});
  }
  el('scene-picker-empty').hidden=ids.length>0;el('scene-picker-empty').textContent=el('scene-picker-search').value.trim()?'No matching scenes.':product.getSelection().sceneDevice&&!ids.length?'No scenes for this device here. Choose All devices or another collection.':browsing?'No scenes in this collection. Drag scenes here from All scenes.':'Import a clip in Library to add your scenes.';
  drawActions();
 }
 function markDrop(row,after){dropTarget?.classList.remove('scene-drop-before','scene-drop-after');dropTarget=row;row.classList.add(after?'scene-drop-after':'scene-drop-before');}
 function clearDrag(){dragging=undefined;draggingFolder=undefined;dropTarget=undefined;el('scene-picker-trash').hidden=true;el('scene-picker-trash').classList.remove('scene-trash-over');for(const n of panel.querySelectorAll('.scene-dragging,.scene-drop-before,.scene-drop-after,.scene-drop-folder'))n.classList.remove('scene-dragging','scene-drop-before','scene-drop-after','scene-drop-folder');}
 function showTrash(){
  const trash=el('scene-picker-trash'),box=panel.getBoundingClientRect(),scope=folder(browsing)?.name||'project';el('scene-picker-trash-label').textContent=`Remove ${dragging.length>1?dragging.length+' scenes':'scene'} from ${scope}`;trash.setAttribute('aria-label',browsing?'Remove dragged scenes from collection':'Remove dragged scenes from project');trash.hidden=false;
  const width=Math.min(170,innerWidth-24),height=80;trash.style.width=width+'px';let left=box.right+10,top=box.bottom-height;if(left+width>innerWidth-12){left=Math.max(12,box.right-width);top=box.bottom+10;if(top+height>innerHeight-12)top=Math.max(12,box.top-height-10);}trash.style.left=left+'px';trash.style.top=top+'px';
 }
 function autoScroll(y){const box=list.getBoundingClientRect();if(y<box.top+30)list.scrollTop-=25;else if(y>box.bottom-30)list.scrollTop+=25;}
 async function move(source,target,after){
  if(busy)return;const visible=visibleIds(),sources=(Array.isArray(source)?source:[source]).filter(id=>visible.includes(id));if(!sources.length||!visible.includes(target)||sources.includes(target))return;
  const next=visible.filter(id=>!sources.includes(id));next.splice(next.indexOf(target)+(after?1:0),0,...sources);let cursor=0;const shown=new Set(visible),ids=orderIds(browsing).map(id=>shown.has(id)?next[cursor++]:id);
  const scope=browsing;await saved(()=>call('reorderScenes',{projectId:boot.projectId,collectionId:scope,ids}),'Scene order saved.');
  list.querySelector(`[data-scene="${sources[0]}"] .scene-picker-grip`)?.focus({preventScroll:true});
 }
 async function add(sceneIds,collectionId){const label=folder(collectionId)?.name;await saved(()=>call('collectionMembership',{sceneIds:Array.isArray(sceneIds)?sceneIds:[sceneIds],collectionId,action:'add'}),`Added to ${label}. Still in All scenes.`);}
 async function remove(sceneIds){
  const collectionId=browsing,label=folder(collectionId)?.name;if(!sceneIds.length)return;
  if(!collectionId){
   const remaining=new Set(orderIds()),ids=sceneIds.filter(id=>remaining.has(id));if(!ids.length)return;
   await product.flush?.();
   if(await saved(()=>call('removeScenes',{sceneIds:ids}),`Removed ${ids.length===1?'1 scene':ids.length+' scenes'} from the project. Original files kept. Undo is available.`))reloadPicker(`Removed ${ids.length===1?'1 scene':ids.length+' scenes'} from the project. Original files kept. Undo is available.`);
   return;
  }
  const members=new Set(orderIds(collectionId)),ids=sceneIds.filter(id=>members.has(id));if(!ids.length)return;
  if(await saved(()=>call('collectionMembership',{sceneIds:ids,collectionId,action:'remove'}),`Removed ${ids.length===1?'1 scene':ids.length+' scenes'} from ${label}. Kept in All scenes and other collections.`)){undoRemoval={sceneIds:ids,collectionId,historyId:history?.undo?.id};drawActions();}
 }
 function reloadPicker(message){sessionStorage.setItem(reopenKey,message);window.LUTLibrary.reload(false);}
 async function newCollection(sceneIds){
  const result=await collectionName('New collection');
  if(result){await saved(()=>call('collection',{projectId:boot.projectId,name:result,...(sceneIds?{sceneIds:Array.isArray(sceneIds)?sceneIds:[sceneIds]}:{})}),sceneIds?'Collection created and scenes added.':'Collection created. Drag scenes here from All scenes.');}
  el('scene-picker-new').focus({preventScroll:true});
 }
 list.addEventListener('dragover',e=>{if(!dragging||busy)return;e.preventDefault();autoScroll(e.clientY);});
 list.addEventListener('drop',e=>{if(e.target!==list||!dragging)return;e.preventDefault();const source=dragging,target=visibleIds().filter(id=>!source.includes(id)).at(-1);clearDrag();if(target)move(source,target,true);});
 el('scene-picker-select').addEventListener('click',()=>setSelecting(!selecting));
 el('scene-picker-select-all').addEventListener('click',()=>{if(busy)return;const ids=visibleIds(),clear=ids.every(id=>checked.has(id));for(const id of ids)clear?checked.delete(id):checked.add(id);draw();});
 el('scene-picker-add').addEventListener('change',e=>{const id=e.target.value,ids=[...checked];if(id==='__new')newCollection(ids);else if(id)add(ids,id);e.target.value='';});
 el('scene-picker-review').addEventListener('click',()=>{const ids=[...checked];close();window.LUTBatchReview?.open({kind:'scene',ids});});
 el('scene-picker-remove').addEventListener('click',()=>remove([...checked]));
 el('scene-picker-undo').addEventListener('click',async()=>{const entry=undoRemoval,message=entry?.collectionId?'Scenes restored to the collection.':'Scenes restored to the project.';if(entry&&await saved(()=>call('undo',{expectedId:entry.historyId}),message)){undoRemoval=undefined;if(!entry.collectionId){reloadPicker(message);return;}if(browsing===entry.collectionId)chooseScope(browsing);drawActions();}});
 const trash=el('scene-picker-trash');trash.addEventListener('dragover',e=>{if(!dragging||busy)return;e.preventDefault();e.dataTransfer.dropEffect='move';trash.classList.add('scene-trash-over');});trash.addEventListener('dragleave',e=>{if(!trash.contains(e.relatedTarget))trash.classList.remove('scene-trash-over');});trash.addEventListener('drop',e=>{e.preventDefault();const ids=dragging;clearDrag();if(ids)remove(ids);});
 el('scene-picker-new').addEventListener('click',()=>newCollection());
 el('scene-picker-new').addEventListener('dragover',e=>{if(!dragging||busy)return;e.preventDefault();e.dataTransfer.dropEffect='copy';el('scene-picker-new').classList.add('scene-drop-folder');});
 el('scene-picker-new').addEventListener('dragleave',()=>el('scene-picker-new').classList.remove('scene-drop-folder'));
 el('scene-picker-new').addEventListener('drop',e=>{e.preventDefault();const source=dragging;clearDrag();if(source)newCollection(source);});
 el('scene-picker-device').addEventListener('change',event=>{if(busy)return;checked.clear();anchor=undefined;product.setSceneDevice(event.target.value);sync();draw();});
 toggle.addEventListener('click',()=>panel.hidden?open():close());el('scene-picker-close').addEventListener('click',()=>close(true));el('scene-picker-search').addEventListener('input',draw);
 document.addEventListener('pointerdown',e=>{if(panel.hidden||naming||panel.contains(e.target)||toggle.contains(e.target)||trash.contains(e.target))return;close();if(el('stage').contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('keydown',e=>{
  if(panel.hidden||naming)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(selecting)setSelecting(false);else close(true);return;}
  if(e.target.closest?.('.scene-picker-grip,.scene-picker-folder-grip')&&e.altKey)return;
  if(['ArrowUp','ArrowDown'].includes(e.key)&&panel.contains(e.target)){e.preventDefault();e.stopPropagation();const buttons=[...list.querySelectorAll('.scene-picker-choose')],index=buttons.indexOf(e.target),next=Math.max(0,Math.min(buttons.length-1,index+(e.key==='ArrowDown'?1:-1)));buttons[next]?.focus();}
  else if(panel.contains(e.target))e.stopPropagation();
 },true);
 document.addEventListener('focusin',e=>{if(!panel.hidden&&!naming&&!panel.contains(e.target)&&!toggle.contains(e.target))close();});
 window.addEventListener('resize',()=>{if(!panel.hidden)position();});window.addEventListener('blur',clearDrag);
 window.LUTScenePicker={sync,setLibrary,orderIds,close};sync();
 const reopenMessage=sessionStorage.getItem(reopenKey);if(reopenMessage){sessionStorage.removeItem(reopenKey);open().then(()=>status(reopenMessage));}
})();
