'use strict';
const {createHash}=require('node:crypto');
const {canShareCode}=require('../ui/look-navigation.js');
function checkCodes(rows){const used=new Map();for(const row of rows){const d=JSON.parse(row.details),code=d.displayCode||d.code;if(!code)continue;if((used.get(code)||[]).some(other=>!canShareCode(row,other)))throw Error(`The abbreviation ${code} is used more than once. Choose a different one before saving.`);used.set(code,[...(used.get(code)||[]),row]);}}
const limit=(value,max,label)=>{if(typeof value!=='string'||value.length>max)throw Error(`${label} must be text of at most ${max} characters.`);return value.trim();};
const revision=row=>createHash('sha256').update(JSON.stringify(row)).digest('hex');
function checkRevision(row,expected){if(expected!==undefined&&expected!==revision(row))throw Error('These details changed while you were editing. Reopen the details and try again.');}
function validateCode(store,id,value){const code=limit(value,3,'LUT abbreviation').toUpperCase();if(!/^[A-Z0-9]{3}$/.test(code)||code==='LOG')throw Error('Use three letters/numbers; LOG is reserved.');const editing=store.one('SELECT * FROM luts WHERE id=?',[id]);for(const row of store.query('SELECT * FROM luts')){const d=JSON.parse(row.details);if(row.id!==id&&(d.displayCode||d.code)===code&&!canShareCode(editing,row))throw Error(`The abbreviation ${code} is already used by another LUT.`);}return code;}
function updateScene(store,{id,name,tags,collections,description,expectedRevision,aiSource}){
 const row=store.one('SELECT * FROM scenes WHERE id=? AND deleted=0',[id]);checkRevision(row,expectedRevision);
 name=limit(name,160,'Name');if(!name)throw Error('Give this scene a name.');tags=limit(tags,1000,'Tags');if(!Array.isArray(collections))throw Error('Select collections.');const ids=[...new Set(collections)];for(const group of ids)if(store.one('SELECT * FROM collections WHERE id=?',[group]).project_id!==row.project_id)throw Error('Collection belongs to another project.');
 const details=JSON.parse(row.details);if(description!==undefined)details.description=limit(description,1000,'Description');if(aiSource)details.aiSuggestion=source(aiSource);
 store.change(()=>{store.db.run('UPDATE scenes SET name=?,tags=?,details=? WHERE id=?',[name,tags,JSON.stringify(details),id]);for(const group of store.query('SELECT collection_id FROM memberships WHERE scene_id=?',[id]))if(!ids.includes(group.collection_id))store.db.run('DELETE FROM memberships WHERE scene_id=? AND collection_id=?',[id,group.collection_id]);for(const group of ids)store.db.run('INSERT OR IGNORE INTO memberships VALUES (?,?)',[id,group]);});
}
function lutDetails(store,row,{code,description,maker,tags,aiSource}){
 const details=JSON.parse(row.details);
 // details.code remains the preserved gallery filename. Only displayCode is editable.
 if(code!==undefined)details.displayCode=validateCode(store,row.id,code);
 if(description!==undefined)details.description={text:limit(description,1000,'Description'),confidence:aiSource?'AI suggestion reviewed by you':'user-supplied'};
 if(maker!==undefined)details.maker=limit(maker,160,'Creator');if(tags!==undefined)details.tags=limit(tags,1000,'Tags');if(aiSource)details.aiSuggestion=source(aiSource);
 return details;
}
function source(value){if(!value||!['claude-code','codex'].includes(value.provider)||typeof value.at!=='string'||!Number.isFinite(Date.parse(value.at)))throw Error('Invalid suggestion source.');return {provider:value.provider,at:value.at,reviewed:true};}
function schema(kind){const properties={name:{type:'string'},description:{type:'string'},tags:{type:'string'}};if(kind==='lut'){properties.code={type:'string'};properties.maker={type:'string'};}return {type:'object',additionalProperties:false,properties,required:Object.keys(properties)};}
function validateSuggestion(kind,value){const keys=schema(kind).required;if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw Error('AI returned unexpected fields. Nothing was changed.');const result={};for(const key of keys)result[key]=limit(value[key],key==='name'||key==='maker'?160:key==='code'?3:1000,key);if(!result.name)throw Error('AI did not suggest a name. Nothing was changed.');if(kind==='lut'&&!/^[A-Z0-9]{3}$/.test(result.code.toUpperCase()))throw Error('AI did not suggest a three-character abbreviation. Nothing was changed.');if(kind==='lut')result.code=result.code.toUpperCase();return result;}
module.exports={revision,checkRevision,updateScene,lutDetails,schema,validateSuggestion};

function reviewItems(store,{kind,ids,projectId}){
 if(!['scene','lut'].includes(kind)||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw Error('Select distinct scenes or LUTs.');
 return ids.map(id=>{const item=store.one(kind==='scene'?'SELECT * FROM scenes WHERE id=? AND deleted=0':'SELECT * FROM luts WHERE id=?',[id]);if(kind==='scene'&&item.project_id!==projectId)throw Error('Scene belongs to another project.');return {item,revision:revision(item)};});
}
function updateBatch(store,{kind,projectId,items}){
 if(!['scene','lut'].includes(kind)||!Array.isArray(items)||!items.length||new Set(items.map(i=>i.id)).size!==items.length)throw Error('Select distinct scenes or LUTs.');
 const allowed=kind==='scene'?['name','description','tags']:['name','description','tags','code','maker','input','output'];
 const prepared=items.map(({id,fields,expectedRevision,aiSource})=>{
  const row=store.one(kind==='scene'?'SELECT * FROM scenes WHERE id=? AND deleted=0':'SELECT * FROM luts WHERE id=?',[id]);
  if(kind==='scene'&&row.project_id!==projectId)throw Error('Scene belongs to another project.');
  if(typeof expectedRevision!=='string')throw Error('Reopen this review before saving.');checkRevision(row,expectedRevision);
  if(!fields||typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).some(key=>!allowed.includes(key)))throw Error('Unexpected detail fields. Nothing was changed.');
  const details=JSON.parse(row.details),next={...row};
  if(Object.hasOwn(fields,'name')){next.name=limit(fields.name,160,'Name');if(!next.name)throw Error('Give each item a name.');if(kind==='lut'&&next.name!==row.name)details.displayNameEdited=true;}
  if(Object.hasOwn(fields,'tags')){const tags=limit(fields.tags,1000,'Tags');if(kind==='scene')next.tags=tags;else details.tags=tags;}
  if(Object.hasOwn(fields,'description')){const text=limit(fields.description,1000,'Description');details.description=kind==='scene'?text:{text,confidence:aiSource?'AI suggestion reviewed by you':'user-supplied'};}
  if(kind==='lut'){
   if(Object.hasOwn(fields,'code')){const code=limit(fields.code,3,'LUT abbreviation').toUpperCase();if(!/^[A-Z0-9]{3}$/.test(code)||code==='LOG')throw Error('Use three letters/numbers; LOG is reserved.');details.displayCode=code;}
   if(Object.hasOwn(fields,'maker'))details.maker=limit(fields.maker,160,'Creator');
   for(const key of ['input','output'])if(Object.hasOwn(fields,key))next[key]=require('./cube.cjs').profile(fields[key]);
  }
  if(aiSource)details.aiSuggestion=source(aiSource);next.details=JSON.stringify(details);return next;
 });
 if(kind==='lut'){
  const replacements=new Map(prepared.map(row=>[row.id,row])),used=new Map();
  for(const original of store.query('SELECT * FROM luts')){const d=JSON.parse((replacements.get(original.id)||original).details),code=d.displayCode||d.code;if(!code)continue;if((used.get(code)||[]).some(other=>!canShareCode(replacements.get(original.id)||original,other)))throw Error(`The abbreviation ${code} is used more than once. Choose a different one before saving.`);used.set(code,[...(used.get(code)||[]),replacements.get(original.id)||original]);}
 }
 // One transaction: no partially saved batch, and no changes to captured pixels or camera evidence.
 store.change(()=>{for(const row of prepared){if(kind==='scene')store.db.run('UPDATE scenes SET name=?,tags=?,details=? WHERE id=?',[row.name,row.tags,row.details,row.id]);else store.db.run('UPDATE luts SET name=?,input=?,output=?,details=? WHERE id=?',[row.name,row.input,row.output,row.details,row.id]);}});
}
module.exports.reviewItems=reviewItems;module.exports.updateBatch=updateBatch;
module.exports.checkCodes=checkCodes;
