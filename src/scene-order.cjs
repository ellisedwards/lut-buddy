// Collection membership and ordering are independent: adding to an album never moves footage.
function orderedIds(store,projectId,collectionId=''){
 store.one('SELECT id FROM projects WHERE id=?',[projectId]);
 if(collectionId&&store.one('SELECT project_id FROM collections WHERE id=?',[collectionId]).project_id!==projectId)throw new Error('Collection belongs to another project.');
 const rows=store.query('SELECT s.id,s.details,c.metadata FROM scenes s JOIN clips c ON c.id=s.clip_id WHERE s.project_id=? AND s.deleted=0 ORDER BY s.rowid',[projectId]);
 const footage=row=>!!JSON.parse(row.details).clip||!JSON.parse(row.metadata).legacy;
 let ids=[...rows.filter(footage),...rows.filter(row=>!footage(row))].map(row=>row.id);
 if(collectionId){const members=new Set(store.query('SELECT scene_id FROM memberships WHERE collection_id=?',[collectionId]).map(row=>row.scene_id));ids=ids.filter(id=>members.has(id));}
 const positions=new Map(store.query('SELECT scene_id,position FROM scene_orders WHERE project_id=? AND scope=?',[projectId,collectionId]).map(row=>[row.scene_id,row.position]));
 return ids.sort((a,b)=>(positions.get(a)??Infinity)-(positions.get(b)??Infinity));
}
function reorder(store,{projectId,collectionId='',ids}){
 const current=orderedIds(store,projectId,collectionId);
 if(!Array.isArray(ids)||ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>!current.includes(id)))throw new Error('This scene list changed. Reopen the picker before rearranging it.');
 store.change(()=>{store.db.run('DELETE FROM scene_orders WHERE project_id=? AND scope=?',[projectId,collectionId]);ids.forEach((id,index)=>store.db.run('INSERT INTO scene_orders VALUES (?,?,?,?)',[projectId,collectionId,id,index]));});
 return store.state();
}
function add(store,{sceneId,collectionId}){
 return membership(store,{sceneIds:[sceneId],collectionId,action:'add'});
}
function membership(store,{sceneIds,collectionId,action}){
 if(!Array.isArray(sceneIds)||!sceneIds.length||sceneIds.some(id=>typeof id!=='string')||new Set(sceneIds).size!==sceneIds.length)throw new Error('Select distinct scenes first.');
 if(!['add','remove'].includes(action))throw new Error('Choose add or remove from collection.');
 const collection=store.one('SELECT project_id FROM collections WHERE id=?',[collectionId]);
 // Validate the entire selection before changing any membership.
 for(const id of sceneIds)if(store.one('SELECT project_id FROM scenes WHERE id=? AND deleted=0',[id]).project_id!==collection.project_id)throw new Error('Scene and collection belong to different projects.');
 store.change(()=>{for(const id of sceneIds){if(action==='add')store.db.run('INSERT OR IGNORE INTO memberships VALUES (?,?)',[id,collectionId]);else store.db.run('DELETE FROM memberships WHERE scene_id=? AND collection_id=?',[id,collectionId]);}});
 return store.state();
}
module.exports={orderedIds,reorder,add,membership};

function seedDemoCollections(store){
 const demos=store.query('SELECT s.id,s.project_id,s.details,c.metadata FROM scenes s JOIN clips c ON c.id=s.clip_id WHERE s.deleted=0 ORDER BY s.rowid').filter(row=>JSON.parse(row.metadata).legacy&&!JSON.parse(row.details).clip);
 const projects=[...new Set(demos.map(row=>row.project_id))];
 for(const projectId of projects){let collection=store.query('SELECT id FROM collections WHERE project_id=? AND name=? COLLATE NOCASE ORDER BY rowid LIMIT 1',[projectId,'Demos'])[0];if(!collection){collection={id:require('node:crypto').randomUUID()};store.db.run('INSERT INTO collections VALUES (?,?,?)',[collection.id,projectId,'Demos']);}for(const row of demos.filter(row=>row.project_id===projectId))store.db.run('INSERT OR IGNORE INTO memberships VALUES (?,?)',[row.id,collection.id]);}
}
module.exports.seedDemoCollections=seedDemoCollections;

function renameCollection(store,{id,name,expectedName}){
 const row=store.one('SELECT * FROM collections WHERE id=?',[id]);
 if(expectedName!==row.name)throw Error('This collection changed. Reopen the picker and try again.');
 if(typeof name!=='string'||!name.trim()||name.length>160)throw Error('Use a name between 1 and 160 characters.');
 store.change(()=>store.db.run('UPDATE collections SET name=? WHERE id=?',[name.trim(),id]));return store.state();
}
function reorderCollections(store,{projectId,ids}){
 store.one('SELECT id FROM projects WHERE id=?',[projectId]);const current=store.query('SELECT id FROM collections WHERE project_id=?',[projectId]).map(c=>c.id);
 if(!Array.isArray(ids)||ids.length!==current.length||new Set(ids).size!==ids.length||ids.some(id=>!current.includes(id)))throw Error('This collection list changed. Reopen the picker before rearranging it.');
 store.change(()=>{store.db.run('DELETE FROM collection_orders WHERE project_id=?',[projectId]);ids.forEach((id,position)=>store.db.run('INSERT INTO collection_orders VALUES (?,?,?)',[projectId,id,position]));});return store.state();
}
module.exports.renameCollection=renameCollection;module.exports.reorderCollections=reorderCollections;
