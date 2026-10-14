'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto'),media=require('./media.cjs');
const seconds=(pts,base)=>{const [n,d]=base.split('/').map(Number);return Number(pts)*n/d;};
function windowFor(metadata,index){
 if(!Number.isInteger(index)||index<0||index>=metadata.pts.length)throw Error('Frame is outside this clip.');
 const times=metadata.pts.map(p=>seconds(p,metadata.stream.time_base)),pin=times[index],first=times[0],last=times.at(-1),start=Math.max(first,Math.min(pin-3,last-6));
 const startIndex=times.findIndex(t=>t>=start),end=times[startIndex]+6;
 return {startIndex,start:times[startIndex],pinOffset:pin-times[startIndex],duration:Math.min(6,last-times[startIndex]+1/24),timeBase:metadata.stream.time_base};
}
async function prepare(clip,index,target,signal){
 await require('./storage.cjs').enoughSpace(path.dirname(path.dirname(target)),12*1024*1024);
 const metadata=media.unchanged(clip),window=windowFor(metadata,index),temporary=path.join(path.dirname(target),randomUUID()+'.mp4');let observed;
 const filters=[`select=gte(pts\\,${metadata.pts[window.startIndex]})`,'showinfo',media.rgbConversion(metadata),'setpts=PTS-STARTPTS','fps=24','scale=w=min(1280\\,iw):h=-2:flags=lanczos+accurate_rnd:out_color_matrix=bt709:out_range=tv','format=yuv420p'].filter(Boolean).join(',');
 try{
  await media.run(media.ffmpeg,['-hide_banner','-loglevel','info','-copyts','-ss',String(Math.max(seconds(metadata.pts[0],window.timeBase),window.start-1)),'-seek_timestamp','1','-i',clip.source,'-map',`0:${metadata.stream.index}`,'-an','-filter_threads','1','-vf',filters,'-t',String(window.duration),'-c:v','libx264','-preset','veryfast','-crf','18','-maxrate','4M','-bufsize','8M','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','iec61966-2-1','-movflags','+faststart','-y',temporary],signal,undefined,line=>{const match=line.match(/Parsed_showinfo_[^\n]*n:\s*0\s+pts:\s*(-?\d+)/);if(match)observed=match[1];});
  if(observed!==metadata.pts[window.startIndex])throw Error('Moving preview did not start at the expected original frame.');
  const probe=JSON.parse((await media.run(media.ffprobe,['-v','error','-show_streams','-show_format','-of','json',temporary],signal)).output),stream=probe.streams.find(s=>s.codec_type==='video'),duration=Number(probe.format.duration),bytes=fs.statSync(temporary).size;
  if(!stream||duration<=0||duration>6.1||bytes>12*1024*1024||probe.streams.some(s=>s.codec_type==='audio'))throw Error('Moving preview exceeded its supported duration or size.');
  signal?.throwIfAborted();media.unchanged(clip);await fsp.rename(temporary,target);
  return {version:1,...window,duration,width:stream.width,height:stream.height,fps:24,bytes,sourceSha256:metadata.sha256,decodingKey:metadata.decoding||{},colour:'Compressed encoded RGB preview; full-resolution still is the reference.'};
 }finally{await fsp.unlink(temporary).catch(()=>{});}
}
function captureIndex(clip,motion,time){const metadata=media.unchanged(clip);if(!motion||motion.sourceSha256!==metadata.sha256||!Number.isFinite(motion.start)||!Number.isFinite(motion.duration)||motion.duration<=0||motion.duration>6.1||!Number.isFinite(time)||time<0||time>motion.duration)throw Error('Choose a moment inside this moving scene.');const target=motion.start+time;let best=0;for(let i=1;i<metadata.pts.length;i++)if(Math.abs(seconds(metadata.pts[i],metadata.stream.time_base)-target)<Math.abs(seconds(metadata.pts[best],metadata.stream.time_base)-target))best=i;return best;}
module.exports={prepare,windowFor,captureIndex};
