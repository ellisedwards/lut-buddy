'use strict';
(()=>{
 const el=id=>document.getElementById(id),call=(...args)=>window.LUTLibrary.call(...args);
 let library,ids=[],devices=[],busy=false,stopped=false,requestId,created=false;
 const effective=row=>window.LUTLookNavigation.input(row),sourceRows=()=>ids.map(id=>library.luts.find(l=>l.id===id)).filter(Boolean);
 let profileNotes=new Map();
 let supported=['sony-slog3-sgamut3cine','apple-log2'];
 const title=id=>window.LUTLibrary.profiles.find(p=>p[0]===id)?.[1]||id;
 function controls(){
  const target=el('port-profile').value,rows=sourceRows(),unsupported=rows.some(row=>!supported.includes(effective(row))||!(row.output==='rec709'||JSON.parse(row.details).legacy&&row.input==='unknown'&&row.output==='unknown'));
  const same=rows.some(row=>effective(row)===target),custom=el('port-device').value==='__new';
  el('port-device-name').hidden=!custom;
  el('port-convert').disabled=busy||!rows.length||unsupported||same||!supported.includes(target)||(custom&&!el('port-device-name').value.trim());
  el('port-route').textContent=unsupported?'Confirm a supported input profile and Rec.709 output in LUT details first.':same?'One of these LUTs already uses this recording profile. Choose a different target.':!supported.includes(target)?'This recording profile is not supported for conversion yet.':rows.length?`${rows.length===1?title(effective(rows[0])):rows.length+' selected looks'} → ${title(target)} · 33-point`:'Choose a LUT to convert.';
  if(rows.some(row=>JSON.parse(row.details).legacy&&row.input==='unknown'))el('port-route').textContent+=' Uses your existing Sony viewer setup; original LUT profiles remain [Unverified].';
  const notes=[...new Set([profileNotes.get(target),...rows.map(row=>profileNotes.get(effective(row)))].filter(Boolean))];if(notes.length)el('port-route').textContent+=' '+notes.join(' ');
  for(const id of ['port-source','port-device','port-profile','port-device-name','port-ai','port-provider'])el(id).disabled=busy;
  el('port-provider').hidden=!el('port-ai').checked;el('port-close').disabled=busy;el('port-stop').hidden=!busy;
 }
 function deviceProfiles(){
  const device=devices.find(d=>d.id===el('port-device').value),profiles=device?.profiles||window.LUTLibrary.profiles.filter(p=>supported.includes(p[0])).map(p=>p[0]);
  el('port-profile').replaceChildren(...profiles.map(id=>new Option(title(id),id)));controls();
 }
 async function open({ids:chosen=[]}={}){
  if(el('port-dialog').open||busy)return;
  try{
   library=await call('state');const supportedProfiles=await call('portProfiles');supported=supportedProfiles.map(p=>p.id);profileNotes=new Map(supportedProfiles.map(p=>[p.id,p.note]));created=false;
   ids=chosen.filter(id=>library.luts.some(l=>l.id===id));
   if(!ids.length){const selected=window.LUTProduct.getSelection().selected,record=JSON.parse(el('manifest').textContent).find(l=>l.name===selected);if(record)ids=[record.id];}
   el('port-source').replaceChildren(new Option('Choose a LUT',''),...library.luts.map(row=>new Option(row.name+' · '+title(effective(row)),row.id)));
   el('port-source').value=ids[0]||'';el('port-source').hidden=ids.length>1;el('port-sources').hidden=ids.length<=1;el('port-sources').textContent=sourceRows().map(r=>r.name).join('\n');
   const camera=JSON.parse(el('camera-metadata').textContent),grouped=new Map();
   for(const scene of library.scenes.filter(s=>s.project_id===window.LUTProduct.boot.projectId)){
    const device=window.LUTLookNavigation.device(camera[scene.id]?.format?.fields?.camera_model);if(device.key==='__unknown')continue;
    const profile=library.clips.find(c=>c.id===scene.clip_id)?.profile||'unknown';if(!grouped.has(device.key))grouped.set(device.key,{id:device.key,label:device.label,profiles:[]});const row=grouped.get(device.key);if(!row.profiles.includes(profile))row.profiles.push(profile);
   }
   for(const lut of library.luts){const adapted=JSON.parse(lut.details).adaptation;if(!adapted?.targetDevice)continue;const key=adapted.targetDevice;if(!grouped.has(key))grouped.set(key,{id:key,label:key,profiles:[]});const row=grouped.get(key);if(!row.profiles.includes(adapted.targetProfile))row.profiles.push(adapted.targetProfile);}
   devices=[...grouped.values()];
   // A target can be chosen before importing footage; its profile is explicit.
   if(!devices.some(d=>d.id==='iPhone 17 Pro'))devices.push({id:'iPhone 17 Pro',label:'iPhone 17 Pro',profiles:['apple-log2']});
   const preset=new Option('Choose another device…','__new');el('port-device').replaceChildren(...devices.map(d=>new Option(d.label,d.id)),preset);
   const rows=sourceRows(),preferred=rows.length&&effective(rows[0])==='apple-log2'?devices.find(d=>d.profiles.includes('sony-slog3-sgamut3cine')):devices.find(d=>d.id==='iPhone 17 Pro');
   el('port-device').value=preferred?.id||'__new';el('port-device-name').value='';el('port-status').textContent='';el('port-provider').value=localStorage.getItem('lut-ai-provider')==='codex'?'codex':'claude-code';deviceProfiles();el('port-dialog').showModal();
  }catch(error){el('library-message').textContent=error.message;}
 }
 async function convert(){
  if(busy||el('port-convert').disabled)return;
  const targetProfile=el('port-profile').value,targetDevice=el('port-device').value==='__new'?el('port-device-name').value.trim():el('port-device').value,reviewAI=el('port-ai').checked,provider=el('port-provider').value,results=[];
  busy=true;stopped=false;controls();
  try{
   await window.LUTProduct.flush();
   for(const row of sourceRows()){
    if(stopped)break;requestId=crypto.randomUUID();el('port-status').textContent=`Converting ${results.length+1} of ${ids.length}…`;
    const result=await call('adaptLut',{id:row.id,targetProfile,targetDevice,requestId});results.push(result);created ||= !result.duplicate;
   }
   busy=false;controls();const count=results.length;
   if(!count){el('port-status').textContent='Stopped. No copies added.';return;}
   sessionStorage.setItem('library-message',`${count} look${count===1?'':'s'} ready for ${targetDevice}. ${results.every(r=>r.duplicate)?'Existing versions reused.':'Original LUTs kept unchanged.'}`);
   if(stopped){el('port-status').textContent=`Stopped after ${count} look${count===1?'':'s'}. Completed copies remain saved.`;return;}
   created=false;el('port-dialog').close();
   await window.LUTBatchReview.open({kind:'lut',ids:[...new Set(results.map(r=>r.id))],afterImport:true,portReview:true,autoAI:reviewAI,provider});
  }catch(error){el('port-status').textContent=error.message+(results.length?' Completed copies remain saved.':'');}
  finally{busy=false;controls();}
 }
 el('port-source').addEventListener('change',()=>{ids=el('port-source').value?[el('port-source').value]:[];controls();});
 el('port-device').addEventListener('change',deviceProfiles);
 for(const id of ['port-profile','port-ai','port-device-name'])el(id).addEventListener('input',controls);
 el('port-convert').addEventListener('click',convert);
 el('port-stop').addEventListener('click',async()=>{stopped=true;el('port-status').textContent='Stopping after the current conversion…';try{await call('cancel',{requestId});}catch{}});
 el('port-close').addEventListener('click',()=>el('port-dialog').close());
 el('port-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 el('port-dialog').addEventListener('close',()=>{if(created){created=false;window.LUTLibrary.reload(false);}});
 window.LUTPorting={open};
})();
