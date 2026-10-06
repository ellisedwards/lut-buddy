const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {createHash,randomUUID} = require('node:crypto');
const readline = require('node:readline');
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('@ffprobe-installer/ffprobe').path;
const camera=require('./camera.cjs');
function run(binary,args,signal,onLine,onErrorLine,{cwd}={}) {
  return new Promise((resolve,reject) => {
    const child=spawn(binary,args,{stdio:['ignore','pipe','pipe'],signal,cwd});
    let output='',errors='';
    if(onLine) { const lines=readline.createInterface({input:child.stdout}); lines.on('line',onLine); }
    else child.stdout.on('data',chunk=> {output+=chunk;});
    child.stderr.on('data',chunk=> {errors=(errors+chunk).slice(-64000);});
    if(onErrorLine){const lines=readline.createInterface({input:child.stderr});lines.on('line',onErrorLine);}
    child.on('error',reject); child.on('close',code=>code===0?resolve({output,errors}):reject(new Error(signal?.aborted?'Operation cancelled.':`Media tool could not read this file. ${errors.slice(-900)}`)));
  });
}
async function digest(file,signal) {
  const hash=createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) {signal?.throwIfAborted(); hash.update(chunk);}
  return hash.digest('hex');
}
function fingerprint(file) { const stat=fs.statSync(file); if(!stat.isFile()) throw new Error('Select a local video file.'); return {size:stat.size,mtimeMs:stat.mtimeMs}; }
function unchanged(clip) {
  const metadata=JSON.parse(clip.metadata);
  let stat; try {stat=fingerprint(clip.source);} catch {throw new Error('Clip is missing. Restore a library backup or reimport the original clip. Saved scenes still work.');}
  if (stat.size!==metadata.fingerprint.size||stat.mtimeMs!==metadata.fingerprint.mtimeMs) throw new Error('The original clip has changed. Reimport it before capturing another frame. Saved scenes still work.');
  return metadata;
}
async function inspect(file,signal,notify=()=>{}) {
  const before=fingerprint(file);
  notify('Reading clip information…');
  const probe=JSON.parse((await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file],signal)).output);
  const video=probe.streams.find(stream=>stream.codec_type==='video'&&!stream.disposition?.attached_pic);
  if(!video) throw new Error('This file has no supported video stream.');
  const pts=[];let missingTimestamp=false;
  notify('Indexing original frames. You can cancel this import…');
  await run(ffprobe,['-v','error','-select_streams',String(video.index),'-show_frames','-show_entries','frame=best_effort_timestamp','-of','compact=p=0:nk=0',file],signal,line=> {
    // Some probes concatenate first-frame SEI side data without a delimiter.
    if(!line.startsWith('best_effort_timestamp='))return;
    const match=line.match(/^best_effort_timestamp=(-?\d+)(?:$|side_data_type=|\|)/);
    if(match)pts.push(match[1]);else missingTimestamp=true;
  });
  if(missingTimestamp)throw new Error('A frame has no usable timestamp. This clip cannot be marked accurately.');
  if(/^\d+$/.test(video.nb_frames||'')&&Number(video.nb_frames)!==pts.length)throw new Error('Frame index does not match the clip frame count. Nothing was imported.');
  if(!pts.length) throw new Error('No frame timestamps were found. This clip cannot be marked accurately.');
  if(pts.some((v,i)=>i>0&&BigInt(v)<=BigInt(pts[i-1]))) throw new Error('This clip has duplicate or non-increasing frame timestamps; exact-frame support needs further validation.');
  notify('Reading recorded camera settings…');
  const recorded=await camera.extract(file,video,pts,signal,run);
  notify('Checking original clip identity…');
  const sha256=await digest(file,signal),after=fingerprint(file);
  if(before.size!==after.size||before.mtimeMs!==after.mtimeMs) throw new Error('Clip changed while importing. Please retry.');
  return {stream:video,format:probe.format,pts,sha256,fingerprint:after,camera:recorded,...(recorded.aligned&&recorded.recording?.matrix?{decoding:{matrix:recorded.recording.matrix,range:video.color_range,evidence:'Recorded Sony RTMD coding equations'}}:{}),decoderVersion:'ffmpeg-static 5.3.0',colourStatus:'Decoded range/matrix use recorded metadata where available. Absent tags remain [Unverified]; reference colour accuracy [Unverified].'};
}
function rgbConversion(metadata) {
  // A recording gamma/gamut does not establish the YUV decoding matrix.
  // Use an actual stream tag or a separately verified decoding record.
  const matrix=metadata.decoding?.matrix||metadata.stream.color_space;
  const matrices={bt709:'bt709',bt601:'bt601',bt470bg:'bt601',smpte170m:'bt601',smpte240m:'smpte240m',bt2020nc:'bt2020'};
  if(!matrices[matrix])return '';
  const range=metadata.decoding?.range||metadata.stream.color_range;
  return `scale=in_color_matrix=${matrices[matrix]}${range==='pc'?':in_range=full':range==='tv'?':in_range=limited':''}:out_range=full:flags=accurate_rnd+full_chroma_int,format=rgb48le`;
}
function decodeKey(metadata){return createHash('sha256').update(rgbConversion(metadata)).digest('hex').slice(0,12);}
async function frame(clip,index,root,signal) {
  const metadata=unchanged(clip);
  if(!Number.isInteger(index)||index<0||index>=metadata.pts.length) throw new Error('Frame is outside this clip.');
  const key=`${clip.id}-${index}-rgb-v2-${decodeKey(metadata)}`,asset=`cache/${key}.png`,thumb=`cache/${key}.jpg`;
  const full=path.join(root,asset),small=path.join(root,thumb);
  if(!fs.existsSync(full)||!fs.existsSync(small)) {
    const temporary=path.join(root,'staging',`${randomUUID()}.png`);
    try {
      const filters=[`select=eq(n\\,${index})`,'showinfo',rgbConversion(metadata)].filter(Boolean).join(',');
      const decoded=await run(ffmpeg,['-hide_banner','-loglevel','info','-copyts','-i',clip.source,'-map',`0:${metadata.stream.index}`,'-vf',filters,'-frames:v','1','-fps_mode','passthrough','-pix_fmt','rgb48be','-update','1',temporary],signal);
      const match=decoded.errors.match(/Parsed_showinfo_[^\n]*n:\s*0\s+pts:\s*(-?\d+)/);
      if(!match||match[1]!==metadata.pts[index]) throw new Error('Decoded frame did not match the marked timestamp. Nothing was imported.');
      unchanged(clip);
      await thumbnail(temporary,small,signal);
      await fsp.rename(temporary,full);
    } finally { if(fs.existsSync(temporary)) await fsp.unlink(temporary); }
  }
  return {clipId:clip.id,index,pts:metadata.pts[index],timeBase:metadata.stream.time_base,asset,thumb};
}
function previewIndex(metadata,index){if(!Number.isInteger(index)||index<0||index>=metadata.pts.length)throw new Error('Frame is outside this clip.');}
const scrubAsset=(clip,index)=>`cache/${clip.id}-${index}-scrub-v2-${decodeKey(JSON.parse(clip.metadata))}.jpg`;
function scrubResult(clip,metadata,index){return {clipId:clip.id,index,pts:metadata.pts[index],timeBase:metadata.stream.time_base,thumb:scrubAsset(clip,index)};}
async function scrubFrames(clip,root,signal){
 const metadata=unchanged(clip),folder=path.join(root,'staging',`scrub-${randomUUID()}`),observed=[];
 await fsp.mkdir(folder);
 try{
  const filters=['showinfo',rgbConversion(metadata),'scale=w=min(960\\,iw):h=-2:flags=bilinear'].filter(Boolean).join(',');
  await run(ffmpeg,['-hide_banner','-loglevel','info','-copyts','-i',clip.source,'-map',`0:${metadata.stream.index}`,'-vf',filters,'-fps_mode','passthrough','-q:v','3','-start_number','0',path.join(folder,'%06d.jpg')],signal,undefined,line=>{const match=line.match(/Parsed_showinfo_[^\n]*n:\s*(\d+)\s+pts:\s*(-?\d+)/);if(match)observed[Number(match[1])]=match[2];});
  if(observed.length!==metadata.pts.length||metadata.pts.some((pts,index)=>observed[index]!==pts))throw new Error('Scrubbing previews did not match the original frame index.');
  const files=await fsp.readdir(folder);if(files.length!==metadata.pts.length)throw new Error('Scrubbing preview count does not match the clip.');
  unchanged(clip);signal?.throwIfAborted();
  for(let index=0;index<metadata.pts.length;index++)await fsp.rename(path.join(folder,`${String(index).padStart(6,'0')}.jpg`),path.join(root,scrubAsset(clip,index)));
 }finally{await fsp.rm(folder,{recursive:true,force:true});}
}
async function previewFrame(clip,index,root,signal){
 const metadata=unchanged(clip);previewIndex(metadata,index);const thumb=scrubAsset(clip,index),target=path.join(root,thumb);
 if(!fs.existsSync(target)){
  const temporary=path.join(root,'staging',`${randomUUID()}.jpg`),[n,d]=metadata.stream.time_base.split('/').map(Number),seek=Math.max(Number(metadata.pts[0])*n/d,Number(metadata.pts[index])*n/d-1);
  try{
   const filters=[`select=eq(pts\\,${metadata.pts[index]})`,'showinfo',rgbConversion(metadata),'scale=w=min(960\\,iw):h=-2:flags=bilinear'].filter(Boolean).join(',');
   const decode=async fast=>run(ffmpeg,['-hide_banner','-loglevel','info','-copyts',...(fast?['-ss',String(seek),'-seek_timestamp','1']:[]),'-i',clip.source,'-map',`0:${metadata.stream.index}`,'-vf',filters,'-frames:v','1','-fps_mode','passthrough','-q:v','3','-y',temporary],signal);
   let result=await decode(true);let pts=result.errors.match(/Parsed_showinfo_[^\n]*n:\s*0\s+pts:\s*(-?\d+)/)?.[1];
   // Nonzero starts and unusual seek behaviour use a verified sequential fallback.
   if(pts!==metadata.pts[index]||!fs.existsSync(temporary)){result=await decode(false);pts=result.errors.match(/Parsed_showinfo_[^\n]*n:\s*0\s+pts:\s*(-?\d+)/)?.[1];}
   if(pts!==metadata.pts[index])throw new Error('Scrubbing preview did not match the selected original frame.');
   unchanged(clip);signal?.throwIfAborted();await fsp.rename(temporary,target);
  }finally{await fsp.unlink(temporary).catch(()=>{});}
 }
 return scrubResult(clip,metadata,index);
}

async function thumbnail(source,target,signal) {
  const temporary=path.join(path.dirname(target),`${randomUUID()}.jpg`);
  try {await run(ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-vf','scale=w=min(1280\\,iw):h=-1:flags=lanczos','-frames:v','1','-q:v','2','-y',temporary],signal);
  signal?.throwIfAborted();await fsp.rename(temporary,target);
  }finally{await fsp.unlink(temporary).catch(()=>{});}
}
async function renderLut(source,lutFile,target,signal) {
  // The only filter path is an app-owned UUID path, never a user supplied name.
  source=path.resolve(source);lutFile=path.resolve(lutFile);target=path.resolve(target);const lutName=path.basename(lutFile);if(!/^[\w .-]+$/.test(lutName))throw new Error('Unsupported LUT filename for the media renderer.');
  const temporary=path.join(path.dirname(target),`${randomUUID()}.png`);
  try {await run(ffmpeg,['-hide_banner','-loglevel','error','-i',source,'-vf',`lut3d=file='${lutName}':interp=trilinear`,'-frames:v','1','-pix_fmt','rgb48be','-update','1','-y',temporary],signal,undefined,undefined,{cwd:path.dirname(lutFile)});
  signal?.throwIfAborted();await fsp.rename(temporary,target);
  }finally{await fsp.unlink(temporary).catch(()=>{});}
}
async function renderLutPreview(source,lutFile,target,signal){
 source=path.resolve(source);lutFile=path.resolve(lutFile);target=path.resolve(target);const lutName=path.basename(lutFile);if(!/^[\w .-]+$/.test(lutName))throw new Error('Unsupported LUT filename for the media renderer.');
 const temporary=path.join(path.dirname(target),`${randomUUID()}.jpg`);
 try{await run(ffmpeg,['-v','error','-i',source,'-vf',`scale=w=min(1280\\,iw):h=-1:flags=lanczos+accurate_rnd,format=rgb48le,lut3d=file='${lutName}':interp=trilinear`,'-frames:v','1','-pix_fmt','yuvj444p','-q:v','2','-y',temporary],signal,undefined,undefined,{cwd:path.dirname(lutFile)});signal?.throwIfAborted();await fsp.rename(temporary,target);}finally{await fsp.unlink(temporary).catch(()=>{});}
}
async function trimCache(root,budget=512*1024*1024) {
  const folder=path.join(root,'cache'),files=[];
  for(const name of await fsp.readdir(folder)) { const file=path.join(folder,name),stat=await fsp.stat(file); if(stat.isFile()) files.push({file,...stat}); }
  let bytes=files.reduce((sum,file)=>sum+file.size,0);
  files.sort((a,b)=>a.mtimeMs-b.mtimeMs);
  for(const file of files) {if(bytes<=budget)break; await fsp.unlink(file.file); bytes-=file.size;}
}
module.exports = {run,digest,fingerprint,unchanged,inspect,frame,previewFrame,scrubFrames,scrubAsset,thumbnail,renderLut,renderLutPreview,trimCache,ffmpeg,ffprobe};
