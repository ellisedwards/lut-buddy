'use strict';
// Store only edited fields: undo must not roll back later imports or navigation.
const {randomUUID}=require('node:crypto');
const definitions={
 projects:['id','name'],collections:['id','project_id','name'],memberships:['scene_id','collection_id'],scene_orders:['project_id','scope','scene_id','position'],collection_orders:['project_id','collection_id','position'],
 scenes:['id','name','tags','details','deleted'],luts:['id','name','input','output','favourite','details','position'],clips:['id','profile']
};
const keys={projects:['id'],collections:['id'],memberships:['scene_id','collection_id'],scene_orders:['project_id','scope','scene_id'],collection_orders:['collection_id'],scenes:['id'],luts:['id'],clips:['id']};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function capture(store){const data={};for(const [table,columns]of Object.entries(definitions))data[table]=store.query(`SELECT rowid AS _rowid,${columns.join(',')} FROM ${table}`);const favourites=store.query('SELECT * FROM luts WHERE favourite=1').map(l=>JSON.parse(l.details).legacy?l.original_name:`${l.id}.cube`);data.ui=store.query('SELECT id FROM projects').map(p=>{const r=store.query('SELECT state FROM ui_state WHERE project_id=?',[p.id])[0];return {project_id:p.id,...(r?JSON.parse(r.state):{favourites,adjustments:{}})};});return data;}
function difference(before,after){const changes=[];for(const table of Object.keys(definitions)){
 const key=row=>JSON.stringify(keys[table].map(k=>row[k])),a=new Map(before[table].map(row=>[key(row),row])),b=new Map(after[table].map(row=>[key(row),row]));
 for(const id of new Set([...a.keys(),...b.keys()])){const old=a.get(id),next=b.get(id);if(equal(old,next))continue;
  // Imported clips/scenes/LUTs belong to import, not the edit history.
  if((!old||!next)&&['projects','scenes','luts','clips'].includes(table))continue;
  const fields=old&&next?definitions[table].filter(k=>!keys[table].includes(k)&&!equal(old[k],next[k])):definitions[table];
  if(fields.length)changes.push({table,key:keys[table].map(k=>[k,(old||next)[k]]),fields,before:old||null,after:next||null});
 }
 }
 const a=new Map(before.ui.map(r=>[r.project_id,r])),b=new Map(after.ui.map(r=>[r.project_id,r]));for(const id of new Set([...a.keys(),...b.keys()])){const old=a.get(id),next=b.get(id);for(const field of ['favourites','adjustments','lutOrder'])if(!equal(old?.[field],next?.[field]))changes.push({table:'ui_state',projectId:id,field,before:old?.[field]??null,after:next?.[field]??null});}
 return changes;}
function status(store,projectId){const filter=projectId?" AND json_extract(patch,'$.projectId')=?":'',args=projectId?[projectId]:[];return {undo:store.query('SELECT id,label FROM edit_history WHERE undone=0'+filter+' ORDER BY id DESC LIMIT 1',args)[0]||null,redo:store.query('SELECT id,label FROM edit_history WHERE undone=1'+filter+' ORDER BY id LIMIT 1',args)[0]||null};}
function apply(store,redo=false,projectId){const entry=status(store,projectId)[redo?'redo':'undo'];if(!entry)return false;
 const saved=JSON.parse(store.one('SELECT patch FROM edit_history WHERE id=?',[entry.id]).patch),patch=Array.isArray(saved)?saved:saved.changes,changes=patch.map(c=>({...c,expected:redo?c.before:c.after,target:redo?c.after:c.before}));
 for(const c of changes){if(c.table==='ui_state'){const row=store.query('SELECT state FROM ui_state WHERE project_id=?',[c.projectId])[0],current=row?JSON.parse(row.state)[c.field]??null:capture(store).ui.find(r=>r.project_id===c.projectId)?.[c.field]??null;if(!equal(current,c.expected))throw Error('These settings changed since this edit. Nothing was undone.');continue;}const where=c.key.map(([k])=>`${k}=?`).join(' AND '),row=store.query(`SELECT rowid AS _rowid,* FROM ${c.table} WHERE ${where}`,c.key.map(([,v])=>v))[0]||null;
  if(!c.expected?!!row:!row||c.fields.some(k=>!equal(row[k],c.expected[k])))throw Error('This edit changed since it was saved. Nothing was undone.');
 }
 store.change(()=>{
  // Validate the complete result at commit so parent/child restoration stays atomic.
  store.db.run('PRAGMA defer_foreign_keys=ON');
  for(const c of changes){if(c.table==='ui_state'){const row=store.query('SELECT * FROM ui_state WHERE project_id=?',[c.projectId])[0],value=row?JSON.parse(row.state):{};if(c.target===null)delete value[c.field];else value[c.field]=c.target;store.db.run('INSERT INTO ui_state VALUES (?,?,?) ON CONFLICT(project_id) DO UPDATE SET state=excluded.state,revision=excluded.revision',[c.projectId,randomUUID(),JSON.stringify(value)]);continue;}const where=c.key.map(([k])=>`${k}=?`).join(' AND '),args=c.key.map(([,v])=>v);
   if(!c.target)store.db.run(`DELETE FROM ${c.table} WHERE ${where}`,args);
   else if(!c.expected){if(store.query(`SELECT rowid FROM ${c.table} WHERE rowid=?`,[c.target._rowid]).length){store.db.run(`UPDATE ${c.table} SET rowid=-rowid WHERE rowid>=?`,[c.target._rowid]);store.db.run(`UPDATE ${c.table} SET rowid=-rowid+1 WHERE rowid<0`);}const columns=['rowid',...definitions[c.table]];store.db.run(`INSERT INTO ${c.table}(${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,[c.target._rowid,...definitions[c.table].map(k=>c.target[k])]);}
   else store.db.run(`UPDATE ${c.table} SET ${c.fields.map(k=>`${k}=?`).join(',')} WHERE ${where}`,[...c.fields.map(k=>c.target[k]),...args]);
  }
  store.db.run('UPDATE edit_history SET undone=? WHERE id=?',[redo?0:1,entry.id]);
 });return true;
}
module.exports={capture,difference,status,apply};
