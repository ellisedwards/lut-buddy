'use strict';
(()=>{
 const el=id=>document.getElementById(id),call=(...args)=>window.LUTLibrary.call(...args);
 const make=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 let target,proposal,busy=false,generation=0,request,requestId;
 const preferred=()=>localStorage.getItem('lut-ai-provider')==='codex'?'codex':'claude-code';
 const remember=id=>localStorage.setItem('lut-ai-provider',id);
 const setStatus=text=>el('ai-review-status').textContent=text;
 async function connections(){
  el('ai-check').disabled=true;el('ai-connections').textContent='Checking installed tools…';
  try{const rows=await call('aiStatus',{refresh:true});el('ai-connections').replaceChildren(...rows.map(row=>{const n=make('div');n.append(make('strong',row.label),make('span',row.ready?`Signed in · ${row.billing}`:row.installed?'Not ready':'Not installed'),make('small',row.message+(row.version?' · '+row.version:'')));return n;}));}catch(error){el('ai-connections').textContent=error.message;}finally{el('ai-check').disabled=false;}
 }
 function settings(){el('ai-provider').value=preferred();el('ai-settings-dialog').showModal();connections();}
 function open({kind,item,sceneId}){
  target={kind,item,sceneId};proposal=undefined;generation++;busy=false;el('ai-review-provider').value=preferred();el('ai-review-fields').replaceChildren();el('ai-use').hidden=true;el('ai-stop').hidden=true;el('ai-generate').disabled=false;el('ai-review-provider').disabled=false;
  el('ai-review-title').textContent=`Suggest ${kind==='scene'?'scene':'LUT'} details`;el('ai-review-context').textContent=kind==='scene'?'Sends this original scene preview and its details.':'Sends the selected scene’s original preview and this LUT applied to it, plus the LUT’s existing details. Saved preview adjustments are excluded.';
  setStatus('Nothing changes until you review the suggestions and save the details.');
  const previews=el('ai-review-previews');previews.replaceChildren();
  for(const [src,label]of (kind==='scene'?[[`previews/${item.id}/original`,'Original scene']]:sceneId?[[`previews/${sceneId}/original`,'Original'],[`previews/${sceneId}/${item.id}`,'LUT applied']]:[])){
   const box=make('figure'),img=make('img');img.alt=label;img.src=src;img.addEventListener('error',()=>{img.hidden=true;});box.append(img,make('figcaption',label));previews.append(box);
  }
  el('ai-review-dialog').showModal();
 }
 function renderSuggestions(result){
  const fields=el('ai-review-fields');fields.replaceChildren();
  for(const [key,label,max]of [['name','Name',160],['code','Abbreviation',3],['maker','Creator',160],['description','Description',1000],['tags','Tags',1000]]){
   if(!Object.hasOwn(result.suggestion,key))continue;
   const group=make('div'),heading=make('label'),checkbox=make('input');checkbox.type='checkbox';checkbox.checked=key!=='maker'||!!result.suggestion.maker;checkbox.dataset.field=key;heading.className='library-checkbox';heading.append(checkbox,make('span',label));
   const input=make(key==='description'?'textarea':'input');input.className='library-input';input.value=result.suggestion[key];input.maxLength=max;input.id=`ai-field-${key}`;input.setAttribute('aria-label',`Suggested ${label.toLowerCase()}`);if(key==='description')input.rows=2;group.append(heading,input);fields.append(group);
  }
  el('ai-use').hidden=false;
 }
 async function generate(){
  if(busy)return;const own=++generation;proposal=undefined;busy=true;el('ai-use').hidden=true;el('ai-review-fields').replaceChildren();el('ai-generate').disabled=true;el('ai-review-provider').disabled=true;el('ai-stop').hidden=false;request=new AbortController();requestId=crypto.randomUUID();
  const provider=el('ai-review-provider').value;remember(provider);setStatus(`Asking ${provider==='codex'?'Codex':'Claude Code'}… You can cancel this request.`);
  try{const result=await call('aiSuggest',{provider,kind:target.kind,id:target.item.id,sceneId:target.sceneId,requestId},request.signal);if(own!==generation)return;proposal=result;renderSuggestions(result);setStatus('Review the wording and choose which fields to use. Your library has not changed.');}
  catch(error){if(own===generation)setStatus(error.name==='AbortError'?'Request cancelled. Nothing changed.':error.message);}
  finally{if(own===generation){busy=false;request=undefined;el('ai-generate').disabled=false;el('ai-review-provider').disabled=false;el('ai-stop').hidden=true;}}
 }
 async function stop(){
  if(!busy)return;const own=++generation,id=requestId;request?.abort();request=undefined;
  // The local service owns subprocess termination, not just the browser fetch.
  try{await call('cancel',{requestId:id});}catch{}if(own!==generation)return;busy=false;el('ai-generate').disabled=false;el('ai-review-provider').disabled=false;el('ai-stop').hidden=true;setStatus('Request cancelled. Nothing changed.');
 }
 el('ai-use').addEventListener('click',()=>{
  if(!proposal||busy)return;const selected=[...el('ai-review-fields').querySelectorAll('input[type=checkbox]:checked')];if(!selected.length){setStatus('Choose at least one field to use.');return;}
  for(const check of selected)el(`edit-${target.kind}-${check.dataset.field}`).value=el('ai-field-'+check.dataset.field).value;
  target.item.aiRevision=proposal.baseRevision;target.item.aiSource=proposal.source;el('ai-review-dialog').close();
 });
 el('ai-review-close').addEventListener('click',()=>el('ai-review-dialog').close());el('ai-review-dialog').addEventListener('close',()=>{if(busy)stop();generation++;});
 el('ai-generate').addEventListener('click',generate);el('ai-stop').addEventListener('click',stop);el('ai-check').addEventListener('click',connections);
 for(const id of ['ai-settings-close','ai-settings-done'])el(id).addEventListener('click',()=>{remember(el('ai-provider').value);el('ai-settings-dialog').close();});
 window.LUTAI={open,settings};
})();
