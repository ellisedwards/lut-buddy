'use strict';
(()=>{
 const $=id=>document.getElementById(id),product=window.LUTProduct,viewBox=$('inspection-view'),a=$('inspection-a'),b=$('inspection-b');
 let job=0,controller,mode='toggle',zoom=false,fullA,mask=null,pan={x:0,y:0},drag,refRenderer,refCanvas=document.createElement('canvas');
 const fullImages=new Map();
 const identity={exposure:0,warmth:0,tint:0,contrast:1,saturation:1,enabled:true};
 function settings(v){return v.adjustments.enabled?v.adjustments:identity;}
 async function call(method,payload,signal){const r=await fetch('api/call',{method:'POST',headers:{'Content-Type':'application/json','X-LUT-Token':product.boot.token},body:JSON.stringify({method,payload:{projectId:product.boot.projectId,...payload}}),signal}),data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Image could not be prepared.');return data.data;}
 const payload=(v,record)=>({sceneId:v.scene.id,lutId:record?.id||'',adjustments:settings(v)});
 async function originalSize(v,record,signal){
  const key=JSON.stringify([v.scene.id,v.scene.raw_path,v.scene.actual_seconds,v.scene.profile,record?.id,record?.sha256,settings(v)]);
  if(fullImages.has(key)){const image=fullImages.get(key);fullImages.delete(key);fullImages.set(key,image);return image;}
  const result=await call('inspectStill',payload(v,record),signal),image=new Image();await new Promise((resolve,reject)=>{image.onload=()=>image.decode().then(resolve,reject);image.onerror=()=>reject(Error('Original-resolution image unavailable.'));image.src=result.url;});
  if(signal.aborted)throw Object.assign(Error('Cancelled'),{name:'AbortError'});fullImages.set(key,image);while(fullImages.size>2)fullImages.delete(fullImages.keys().next().value);return image;
 }
 function copy(canvas,surface){canvas.width=surface.naturalWidth||surface.width;canvas.height=surface.naturalHeight||surface.height;canvas.getContext('2d').drawImage(surface,0,0);}
 function geometry(){
  viewBox.classList.toggle('inspection-split',mode==='split');viewBox.classList.toggle('inspection-zoom',zoom);$('inspection-right').hidden=mode==='toggle';$('inspection-reference-label').hidden=mode==='toggle';$('inspection-divider').hidden=mode!=='wipe';$('wipe-control').hidden=mode!=='wipe';
  const fraction=Number($('inspection-wipe').value);viewBox.style.setProperty('--wipe',fraction+'%');$('inspection-right').style.clipPath=mode==='wipe'?`inset(0 0 0 ${fraction}%)`:'';
  const limitX=Math.max(0,(a.width-viewBox.clientWidth/(mode==='split'?2:1))/2),limitY=Math.max(0,(a.height-viewBox.clientHeight)/2);pan.x=Math.max(-limitX,Math.min(limitX,pan.x));pan.y=Math.max(-limitY,Math.min(limitY,pan.y));
  for(const canvas of [a,b,$('inspection-mask')]){canvas.style.width=zoom?(a.width||1)+'px':'100%';canvas.style.height=zoom?(a.height||1)+'px':'100%';canvas.style.transform=zoom?`translate(calc(-50% + ${pan.x}px),calc(-50% + ${pan.y}px))`:'';}
  $('inspection-mask').style.objectFit='contain';$('inspection-mask').hidden=!mask;
  $('inspection-fit').setAttribute('aria-pressed',String(!zoom));$('inspection-100').setAttribute('aria-pressed',String(zoom));
 }
 async function referenceSurface(v){
  const name=v.reference?.name||'',image=await product.getImage(name,v.scene.id),adjustments=settings(v);
  if( product.hasAdjustments(adjustments)&&(name||adjustments.exposure||adjustments.warmth||adjustments.tint)){
   if(!refRenderer)refRenderer=new window.LUTPreviewRenderer(refCanvas);if(!await refRenderer.render(v.scene,v.reference,adjustments))return;
   const snapshot=document.createElement('canvas');copy(snapshot,refCanvas);return snapshot;
  }return image;
 }
 async function update(v){
  const version=++job;controller?.abort();controller=new AbortController();const signal=controller.signal;fullA=null;
  if(v?.comparing&&mode!=='toggle'){mode='toggle';$('inspection-mode').value=mode;}
  $('wipe-control').hidden=mode!=='wipe';$('inspection-fit').setAttribute('aria-pressed',String(!zoom));$('inspection-100').setAttribute('aria-pressed',String(zoom));
  if(!v?.scene||(!zoom&&mode==='toggle')){viewBox.hidden=true;$('inspect-status').textContent='';return;}
  const primary=zoom?(v.comparing?v.record:v.selected):v.selected;
  $('inspect-status').textContent=zoom?'Loading original-resolution pixels…':'Loading comparison…';
  try{
   const first=zoom?await originalSize(v,primary,signal):v.surface;
   const second=mode==='toggle'?undefined:zoom?await originalSize(v,v.reference,signal):await referenceSurface(v);
   if(version!==job||signal.aborted||!first||(mode!=='toggle'&&!second))return;
   copy(a,first);if(second)copy(b,second);fullA=zoom?first:undefined;viewBox.hidden=false;
   $('inspection-selected-label').textContent=(v.comparing?'Reference':'Selected')+' · '+(primary?.stem||'Original');$('inspection-reference-label').textContent='Reference · '+(v.reference?.stem||'Original');
   geometry();$('inspect-status').textContent=zoom?`${a.width} × ${a.height} · 1 image pixel = 1 CSS pixel · drag to pan`:'Selected and reference · same scene adjustments';
   window.LUTScopePanel?.update({...v,surface:first});
  }catch(error){if(version!==job||signal.aborted)return;console.warn('Inspection: '+error.message);$('inspect-status').textContent=error.message;if(zoom){zoom=false;geometry();}viewBox.hidden=true;}
 }
 function setMode(next){mode=next;$('inspection-mode').value=mode;if(mode!=='toggle')product.resetCompare();pan={x:0,y:0};update(product.getView());}
 $('inspect-open').addEventListener('click',()=>{const panel=$('inspect-panel');panel.hidden=!panel.hidden;$('inspect-open').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){product.hideAdjustments();$('library-panel').hidden=true;update(product.getView());}});
 function closeInspector(){$('inspect-panel').hidden=true;$('inspect-open').setAttribute('aria-expanded','false');}
 $('inspect-close').addEventListener('click',closeInspector);
 for(const id of ['library-open','adjust-open'])$(id).addEventListener('click',closeInspector);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('inspect-panel').hidden&&!document.querySelector('dialog[open]')){event.preventDefault();closeInspector();$('inspect-open').focus({preventScroll:true});}},true);
 $('inspection-mode').addEventListener('change',e=>setMode(e.target.value));$('inspection-wipe').addEventListener('input',geometry);
 $('inspection-fit').addEventListener('click',()=>{zoom=false;pan={x:0,y:0};update(product.getView());});$('inspection-100').addEventListener('click',()=>{zoom=true;pan={x:0,y:0};update(product.getView());});
 viewBox.addEventListener('pointerdown',e=>{if(!zoom||e.button!==0)return;drag={x:e.clientX,y:e.clientY,pan:{...pan}};viewBox.setPointerCapture(e.pointerId);e.preventDefault();});viewBox.addEventListener('pointermove',e=>{if(!drag)return;pan.x=drag.pan.x+e.clientX-drag.x;pan.y=drag.pan.y+e.clientY-drag.y;geometry();});for(const event of ['pointerup','pointercancel','lostpointercapture'])viewBox.addEventListener(event,()=>drag=null);
 async function exportView(format,button){
  const v=product.getView();if(!v?.scene)return;const record=v.comparing?v.record:v.selected;button.disabled=true;$('inspect-status').textContent=format==='png'?'Exporting original-resolution PNG…':'Baking adjusted CUBE…';
  try{const result=await call('exportLook',{...payload(v,record),format});const link=document.createElement('a');link.href=result.url;link.download=result.name;document.body.append(link);link.click();link.remove();$('inspect-status').textContent=format==='png'?'Full-resolution 16-bit PNG saved.':'33-point adjusted CUBE saved · use the stated input profile on unadjusted footage.';$('adjust-status').textContent=$('inspect-status').textContent;}
  catch(error){$('inspect-status').textContent=error.message;$('adjust-status').textContent=error.message;}finally{button.disabled=false;}
 }
 $('export-full-png').addEventListener('click',e=>exportView('png',e.currentTarget));$('export-adjusted-cube').addEventListener('click',e=>exportView('cube',e.currentTarget));
 window.addEventListener('resize',geometry);
 window.LUTInspection={update,setCompareMode:setMode,hasComparison:()=>mode!=='toggle',getScopeSurface:()=>fullA,setMask:value=>{mask=value;if(mask)copy($('inspection-mask'),mask);geometry();},invalidate(){job++;fullA=null;controller?.abort();refRenderer?.cancel();},exportView};
 window.LUTInspection.update(product.getView());
})();
