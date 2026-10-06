'use strict';
const fs=require('node:fs/promises');
// Read only bounded box headers and the selected video track's sample descriptions.
// Never search compressed pixels or unrelated metadata for a profile name.
// Apple identifiers: https://developer.apple.com/documentation/videotoolbox/kvtcompressionpropertykey_logtransferfunction
const identifiers={
 'com.apple.rec2020.apple-log':{profile:'apple-log',gamma:'Apple Log',gamut:'BT.2020'},
 'com.apple.apple-wide-gamut.apple-log':{profile:'apple-log2',gamma:'Apple Log 2',gamut:'Apple Wide Gamut'}
};
async function readLogProfile(file,stream,signal){
 if(!['prores','h264','hevc'].includes(stream.codec_name))return null;
 const trackId=Number(stream.id),hasTrackId=Number.isSafeInteger(trackId)&&trackId>0;
 let handle,reads=0,bytes=0,present=false;
 try{
  handle=await fs.open(file,'r');const size=(await handle.stat()).size;
  async function read(offset,length){
   signal?.throwIfAborted();if(++reads>10000||(bytes+=length)>256*1024)throw Error('Metadata limit');
   const b=Buffer.alloc(length),r=await handle.read(b,0,length,offset);if(r.bytesRead!==length)throw Error('Truncated metadata');return b;
  }
  async function boxes(start,end){
   const found=[];while(start+8<=end){const b=await read(start,8),type=b.toString('latin1',4),n=b.readUInt32BE();let length=n,header=8;
    if(n===1){length=Number((await read(start+8,8)).readBigUInt64BE());header=16;}else if(n===0)length=end-start;
    if(!Number.isSafeInteger(length)||length<header||start+length>end)throw Error('Invalid metadata box');
    found.push({type,start:start+header,end:start+length});start+=length;
   }
   if(start<end&&(await read(start,end-start)).some(v=>v!==0))throw Error('Invalid metadata padding');
   return found;
  }
  const moovs=(await boxes(0,size)).filter(b=>b.type==='moov');if(moovs.length!==1)return null;
  const tracks=(await boxes(moovs[0].start,moovs[0].end)).filter(b=>b.type==='trak'),candidates=[];
  for(const track of tracks){const children=await boxes(track.start,track.end),tk=children.find(b=>b.type==='tkhd');if(!tk)continue;
   const version=(await read(tk.start,1))[0],offset=version===0?12:version===1?20:null;if(offset===null||tk.start+offset+4>tk.end)continue;
   if(hasTrackId&&(await read(tk.start+offset,4)).readUInt32BE()!==trackId)continue;
   let selected=children;
   for(const type of ['mdia','minf','stbl']){const box=selected.find(b=>b.type===type);selected=box?await boxes(box.start,box.end):[];}
   const stsd=selected.find(b=>b.type==='stsd');if(!stsd||stsd.start+8>stsd.end)continue;
   const head=await read(stsd.start,8);if(head.readUInt32BE()!==0)throw Error('Unsupported sample description');
   const entries=await boxes(stsd.start+8,stsd.end);if(!entries.length||entries.length!==head.readUInt32BE(4)||entries.length>64)throw Error('Invalid sample count');
   let matches=true;for(const entry of entries){if(!['apch','apcn','apcs','apco','ap4h','ap4x','avc1','avc3','hvc1','hev1'].includes(entry.type)||entry.start+78>entry.end){matches=false;break;}
    if(!hasTrackId){const dimensions=await read(entry.start+24,4);if(dimensions.readUInt16BE()!==stream.width||dimensions.readUInt16BE(2)!==stream.height||(stream.codec_tag_string&&entry.type!==stream.codec_tag_string)){matches=false;break;}}
   }
   if(matches)candidates.push(entries);
  }
  // Older probes omit track IDs. Accept only a unique matching video description.
  if(candidates.length!==1)return null;const entries=candidates[0];
  const values=[];
  for(const entry of entries){
   if(!['apch','apcn','apcs','apco','ap4h','ap4x','avc1','avc3','hvc1','hev1'].includes(entry.type)||entry.start+78>entry.end)return null;
   const extensions=await boxes(entry.start+78,entry.end),logs=extensions.filter(b=>b.type==='logs');
   if(logs.length)present=true;
   if(logs.length!==1||logs[0].end-logs[0].start>256){values.push(null);continue;}
   const id=(await read(logs[0].start,logs[0].end-logs[0].start)).toString('utf8');values.push(id);
  }
  if(!present)return null;
  const id=values[0],known=Object.hasOwn(identifiers,id)?identifiers[id]:null,consistent=known&&values.every(v=>v===id);
  const conflict=stream.color_transfer&&!['unknown','unspecified'].includes(stream.color_transfer);
  if(!consistent||conflict)return {present:true,profile:null,identifier:id,warning:'Recorded Log identifiers are unsupported, inconsistent or conflict with the video transfer tags. Confirm the recording profile.'};
  return {present:true,identifier:id,...known};
 }catch(error){if(signal?.aborted)throw error;return {present,profile:null,warning:'QuickTime recording profile metadata could not be read safely. Confirm the recording profile.'};}
 finally{await handle?.close();}
}
module.exports={readLogProfile};
