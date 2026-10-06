'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {readLogProfile}=require('../src/quicktime-log.cjs');
const apple='com.apple.rec2020.apple-log',apple2='com.apple.apple-wide-gamut.apple-log';
const box=(type,...parts)=>{const payload=Buffer.concat(parts),header=Buffer.alloc(8);header.writeUInt32BE(payload.length+8);header.write(type,4);return Buffer.concat([header,payload]);};
function track(id,entries,version=0){const tk=Buffer.alloc(version===1?32:24);tk[0]=version;tk.writeUInt32BE(id,version===1?20:12);const count=Buffer.alloc(8);count.writeUInt32BE(entries.length,4);return box('trak',box('tkhd',tk),box('mdia',box('minf',box('stbl',box('stsd',count,...entries)))));}
const entry=(id,...extra)=>box('apch',Buffer.alloc(78),...(id===null?[]:[box('logs',Buffer.from(id))]),...extra);
async function fixture(work){const root=fs.mkdtempSync(path.join(os.tmpdir(),'lut-log-box-')),file=path.join(root,'clip.mov');try{await work(file);}finally{fs.rmSync(root,{recursive:true,force:true});}}
const stream={codec_name:'prores',id:'0x1',color_primaries:'bt2020',color_space:'bt2020nc'};
test('Apple recording identifiers distinguish Log 1 and Log 2 on the selected original track',async()=>fixture(async file=>{
 for(const [id,profile]of [[apple,'apple-log'],[apple2,'apple-log2']]){fs.writeFileSync(file,box('moov',track(2,[entry(id===apple?apple2:apple)]),track(1,[entry(id)],1)));const value=await readLogProfile(file,stream);assert.equal(value.profile,profile);assert.equal(value.identifier,id);}
 fs.writeFileSync(file,box('moov',track(1,[entry(apple,Buffer.alloc(4))])));assert.equal((await readLogProfile(file,stream)).profile,'apple-log','Apple sample descriptions can have four padding bytes');
}));
test('Text in pixels or metadata, absent identifiers, conflicting samples and transfer tags cannot identify Apple Log',async()=>fixture(async file=>{
 fs.writeFileSync(file,Buffer.concat([box('mdat',Buffer.from(apple2)),box('moov',track(1,[entry(null)]),box('udta',box('logs',Buffer.from(apple2))))]));assert.equal(await readLogProfile(file,stream),null);
 for(const entries of [[entry(apple),entry(apple2)],[entry(apple),entry(null)],[entry('unknown.log')],[entry('__proto__')],[entry(apple,box('logs',Buffer.from(apple2)))]]){fs.writeFileSync(file,box('moov',track(1,entries)));assert.equal((await readLogProfile(file,stream)).profile,null);}
 fs.writeFileSync(file,box('moov',track(1,[entry(apple)])));assert.equal((await readLogProfile(file,{...stream,color_transfer:'bt709'})).profile,null);assert.equal(await readLogProfile(file,{...stream,id:'0x3'}),null);assert.equal(await readLogProfile(file,{...stream,codec_name:'unknown'}),null);
}));
test('Older probes without a track ID require one unique matching video description',async()=>fixture(async file=>{
 const visual=Buffer.alloc(78);visual.writeUInt16BE(3840,24);visual.writeUInt16BE(2160,26);const e=box('apch',visual,box('logs',Buffer.from(apple))),s={...stream,id:undefined,width:3840,height:2160,codec_tag_string:'apch'};
 fs.writeFileSync(file,box('moov',track(1,[e]),track(2,[entry(apple2)])));assert.equal((await readLogProfile(file,s)).profile,'apple-log');
 fs.writeFileSync(file,box('moov',track(1,[e]),track(2,[e])));assert.equal(await readLogProfile(file,s),null);
 fs.writeFileSync(file,box('moov',track(1,[e])));assert.equal(await readLogProfile(file,{...s,width:1920}),null);
}));
test('Log parsing skips large media boxes, bounds malformed metadata and respects cancellation',async()=>fixture(async file=>{
 const header=Buffer.alloc(16);header.writeUInt32BE(1);header.write('mdat',4);header.writeBigUInt64BE(2n**31n+16n,8);fs.writeFileSync(file,header);const fd=fs.openSync(file,'r+');fs.writeSync(fd,box('moov',track(1,[entry(apple2)])),0,undefined,Number(2n**31n+16n));fs.closeSync(fd);assert.equal((await readLogProfile(file,stream)).profile,'apple-log2');
 fs.writeFileSync(file,Buffer.from('000000046d6f6f76','hex'));assert.equal((await readLogProfile(file,stream)).profile,null);
 fs.writeFileSync(file,box('moov',track(1,[entry(apple)])));const controller=new AbortController();controller.abort();await assert.rejects(readLogProfile(file,stream,controller.signal),e=>e.name==='AbortError');
}));
