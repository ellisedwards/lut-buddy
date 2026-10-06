(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LUTLookNavigation=api;})(globalThis,()=>{
 const details=row=>typeof row.details==='string'?JSON.parse(row.details):row;
 const family=row=>details(row).lookFamilySha||row.sha256;
 const input=row=>row.input==='unknown'&&details(row).legacy?'sony-slog3-sgamut3cine':row.input;
 const canShareCode=(a,b)=>Boolean(family(a)&&family(a)===family(b)&&input(a)!=='unknown'&&input(b)!=='unknown'&&input(a)!==input(b));
 function device(field){const model=field?.available&&field.display&&!field.display.includes('[Unverified]')?field.display.trim():'';return {key:model||'__unknown',label:model==='ILCE-7M4'?'Sony · A7 IV':model||'Unknown device'};}
 function resolve(records,current,remembered,usable){const active=records.find(r=>r.name===current),look=active?family(active):remembered||'';const match=look&&records.find(r=>family(r)===look&&usable(r.name));return {name:active&&usable(current)?current:match?.name||'',family:look};}
 return {family,input,canShareCode,device,resolve};
});
