'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto'),{Worker}=require('node:worker_threads');
const media=require('./media.cjs'),math=require('../ui/look-math.js'),{sampler}=require('./look-adapter.cjs'),{parseCube}=require('./cube.cjs');
function bake(bytes,profile,adjustments,title='Adjusted look',outputProfile=bytes?'unknown':profile){
 const apply=math.pipeline(profile,bytes?sampler(bytes):null,adjustments),rows=[];
 for(let b=0;b<33;b++)for(let g=0;g<33;g++)for(let r=0;r<33;r++)rows.push(apply([r/32,g/32,b/32]).map(v=>v.toFixed(9)).join(' '));
 const text=`TITLE ${JSON.stringify(title.replace(/["\r\n]/g,' '))}\n# Input profile: ${profile}\n# Output profile: ${outputProfile}\n# Settings: ${JSON.stringify(math.settings(adjustments))}\n# Source SHA256: ${bytes?parseCube(bytes).sha256:'no source LUT'}\n# Source adjustments -> original LUT -> contrast/saturation -> output clamp\n# 33-point approximation. Apply to unadjusted footage in the stated input profile.\nLUT_3D_SIZE 33\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n${rows.join('\n')}\n`;
 const result=Buffer.from(text);parseCube(result);return result;
}
function worker(data,signal){return new Promise((resolve,reject)=>{
 signal?.throwIfAborted();const task=new Worker(path.join(__dirname,'look-export-worker.cjs'),{workerData:data});let done=false,workerError;
 const finish=(error)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
 const abort=()=>{task.terminate();};signal?.addEventListener('abort',abort,{once:true});
 task.once('error',error=>workerError=error);task.once('exit',code=>finish(signal?.aborted?Object.assign(Error('Export cancelled.'),{name:'AbortError'}):workerError||(code?Error('Image export worker stopped.'):undefined)));
});}
async function render(source,lutFile,profile,adjustments,target,signal){
 const a=math.settings(adjustments),info=JSON.parse((await media.run(media.ffprobe,['-v','error','-show_streams','-of','json',source],signal)).output).streams.find(s=>s.codec_type==='video');
 const {width,height}=info||{};if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>100000000)throw Error('Unsupported original image dimensions.');
 const id=randomUUID(),folder=path.dirname(target),raw=path.join(folder,id+'.rgb48le'),output=path.join(folder,id+'-out.rgb48le'),temporary=path.join(folder,id+'.png');
 try{
  await media.run(media.ffmpeg,['-v','error','-i',source,'-frames:v','1','-pix_fmt','rgb48le','-f','rawvideo','-y',raw],signal);
  await worker({raw,output,width,height,lutFile,profile,adjustments:a},signal);
  await media.run(media.ffmpeg,['-v','error','-f','rawvideo','-pixel_format','rgb48le','-video_size',`${width}x${height}`,'-i',output,'-frames:v','1','-pix_fmt','rgb48be','-update','1','-y',temporary],signal);
  signal?.throwIfAborted();await fsp.rename(temporary,target);return {width,height};
 }finally{await Promise.all([raw,output,temporary].map(f=>fsp.unlink(f).catch(()=>{})));}
}
function key(sceneHash,lutHash,profile,adjustments){return createHash('sha256').update(JSON.stringify([1,sceneHash,lutHash,profile,math.settings(adjustments)])).digest('hex');}
module.exports={bake,render,key};
