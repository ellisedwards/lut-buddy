const fs = require('node:fs');
const path = require('node:path');
const initSQL = require('sql.js');
const lockfile = require('proper-lockfile');
const { randomUUID } = require('node:crypto');
function atomicWrite(file, bytes) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file), {recursive:true});
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd,bytes); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary,file);
    const directory = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
class Store {
  static async open(root) {
    fs.mkdirSync(root, {recursive:true});
    const SQL = await initSQL({locateFile: name => require.resolve(`sql.js/dist/${name}`)});
    const lockPath=path.join(fs.realpathSync(root),'.lut-buddy.lock');let store;
    let release;try{release=lockfile.lockSync(root,{lockfilePath:lockPath,stale:60000,update:10000,retries:0,onCompromised:error=>{if(store)store.lockError=error;}});}catch(error){if(error.code==='ELOCKED')throw new Error('This library is already open in LUT Buddy. Use the existing window, or stop its service first. After a forced quit, wait one minute and try again.');throw error;}
    try{
    const file = path.join(root,'library.sqlite');
    const db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
    store = new Store(root,db,SQL);store.releaseLock=release;store.lockPath=lockPath;store.lockIdentity=fs.statSync(lockPath);
    db.run('PRAGMA foreign_keys=ON;');
    const version = db.exec('PRAGMA user_version')[0].values[0][0];
    if (version > 7) throw new Error('This library needs a newer version of LUT Buddy.');
    if(version>0&&version<7)store.backup();
    if (version === 0) store.change(() => {
      db.run(`CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT NOT NULL);
        CREATE TABLE clips(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,source TEXT NOT NULL,profile TEXT NOT NULL,metadata TEXT NOT NULL);
        CREATE TABLE scenes(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),clip_id TEXT NOT NULL REFERENCES clips(id),name TEXT NOT NULL,frame_index INTEGER NOT NULL,pts TEXT NOT NULL,time_base TEXT NOT NULL,asset TEXT NOT NULL,thumb TEXT NOT NULL,sha256 TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',deleted INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE collections(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL);
        CREATE TABLE memberships(scene_id TEXT REFERENCES scenes(id),collection_id TEXT REFERENCES collections(id),PRIMARY KEY(scene_id,collection_id));
        CREATE TABLE luts(id TEXT PRIMARY KEY,name TEXT NOT NULL,original_name TEXT NOT NULL,sha256 TEXT UNIQUE NOT NULL,asset TEXT NOT NULL,size INTEGER NOT NULL,input TEXT NOT NULL DEFAULT 'unknown',output TEXT NOT NULL DEFAULT 'unknown',favourite INTEGER NOT NULL DEFAULT 0);
        PRAGMA user_version=1;`);
      db.run('INSERT INTO projects VALUES (?,?)',[randomUUID(),'My Project']);
    });
    if(version<2)store.change(()=>db.run(`ALTER TABLE scenes ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE luts ADD COLUMN details TEXT NOT NULL DEFAULT '{}';
      CREATE TABLE ui_state(project_id TEXT PRIMARY KEY REFERENCES projects(id),revision TEXT NOT NULL,state TEXT NOT NULL);
      PRAGMA user_version=2;`));
    if(version<3)store.change(()=>db.run('ALTER TABLE luts ADD COLUMN position INTEGER; UPDATE luts SET position=rowid-1; PRAGMA user_version=3;'));
    if(version<4)store.change(()=>db.run(`CREATE TABLE scene_orders(project_id TEXT NOT NULL REFERENCES projects(id),scope TEXT NOT NULL,scene_id TEXT NOT NULL REFERENCES scenes(id),position INTEGER NOT NULL,PRIMARY KEY(project_id,scope,scene_id)); PRAGMA user_version=4;`));
    if(version<5)store.change(()=>{require('./scene-order.cjs').seedDemoCollections(store);db.run('PRAGMA user_version=5;');});
    if(version<6)store.change(()=>db.run(`CREATE TABLE collection_orders(project_id TEXT NOT NULL REFERENCES projects(id),collection_id TEXT PRIMARY KEY REFERENCES collections(id),position INTEGER NOT NULL); PRAGMA user_version=6;`));
    if(version<7)store.change(()=>db.run(`CREATE TABLE edit_history(id INTEGER PRIMARY KEY AUTOINCREMENT,label TEXT NOT NULL,patch TEXT NOT NULL,undone INTEGER NOT NULL DEFAULT 0); PRAGMA user_version=7;`));
    for (const directory of ['frames','luts','cache','staging','backups','clips','gallery']) fs.mkdirSync(path.join(root,directory),{recursive:true});
    const integrity = db.exec('PRAGMA integrity_check')[0].values[0][0];
    if (integrity !== 'ok') throw new Error('Library integrity check failed. Preserve this library and restore a backup.');
    return store;
    }catch(error){if(store)store.close();else release();throw error;}
  }
  constructor(root,db,SQL) { this.root = root; this.file = path.join(root,'library.sqlite'); this.db = db; this.SQL = SQL; }
  query(sql,args=[]) { const statement = this.db.prepare(sql); try { statement.bind(args); const rows=[]; while(statement.step()) rows.push(statement.getAsObject()); return rows; } finally { statement.free(); } }
  one(sql,args=[]) { const row=this.query(sql,args)[0]; if(!row) throw new Error('That library item is no longer available.'); return row; }
  record(label,work,projectId) { const previous=this.editLabel,previousProject=this.editProject;this.editLabel=label;this.editProject=projectId;try{return work();}finally{this.editLabel=previous;this.editProject=previousProject;} }
  assertWritable(){if(this.closed)throw new Error('This library is closed. Reopen LUT Buddy.');let current;try{current=fs.statSync(this.lockPath);}catch{}if(this.lockError||!current||current.ino!==this.lockIdentity.ino||current.dev!==this.lockIdentity.dev||Date.now()-current.mtimeMs>60000)throw new Error('Library protection was interrupted. Stop and reopen LUT Buddy before saving.');}
  close(){if(this.closed)return;this.closed=true;try{this.db.close();}finally{try{this.releaseLock?.();}catch(error){if(!this.lockError&&!['ERELEASED','ENOENT'].includes(error.code))throw error;}}}
  change(work) {
    this.assertWritable();
    const before = this.db.export(),history=require('./history.cjs'),edited=this.editLabel?history.capture(this):null;
    this.db.run('PRAGMA foreign_keys=ON');
    this.db.run('BEGIN IMMEDIATE');
    try { const result=work(); if(edited){const patch=history.difference(edited,history.capture(this));if(patch.length){if(this.editProject)this.db.run("DELETE FROM edit_history WHERE undone=1 AND json_extract(patch,'$.projectId')=?",[this.editProject]);else this.db.run('DELETE FROM edit_history WHERE undone=1');this.db.run('INSERT INTO edit_history(label,patch) VALUES (?,?)',[this.editLabel,JSON.stringify({projectId:this.editProject||null,changes:patch})]);}} this.assertWritable(); this.db.run('COMMIT'); atomicWrite(this.file,this.db.export()); return result; }
    catch(error) { this.db.close(); this.db=new this.SQL.Database(before); this.db.run('PRAGMA foreign_keys=ON'); throw error; }
  }
  state() {
    return {projects:this.query('SELECT * FROM projects ORDER BY rowid'), clips:this.query('SELECT id,project_id,name,source,profile FROM clips ORDER BY rowid'), scenes:this.query('SELECT * FROM scenes WHERE deleted=0 ORDER BY rowid DESC'), collections:this.query('SELECT c.* FROM collections c LEFT JOIN collection_orders o ON c.id=o.collection_id ORDER BY c.project_id,o.position IS NULL,o.position,c.rowid'), memberships:this.query('SELECT * FROM memberships'), sceneOrders:this.query('SELECT * FROM scene_orders ORDER BY position'), luts:this.query('SELECT * FROM luts ORDER BY position IS NULL, position, rowid')};
  }
  backup() { const target=path.join(this.root,'backups',`${Date.now()}-${randomUUID()}.sqlite`); atomicWrite(target,this.db.export()); return target; }
}
module.exports = {Store,atomicWrite};
