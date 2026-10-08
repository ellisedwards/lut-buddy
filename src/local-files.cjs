'use strict';
const {spawn}=require('node:child_process');
// The native chooser supplies paths; browser requests cannot supply them.
const chooserScript=`function run(){
 var app=Application.currentApplication();app.includeStandardAdditions=true;
 try{var files=app.chooseFile({withPrompt:'Choose original clips to link to LUT Pal',ofType:['mp4','mov','mxf','mkv','mts','m2ts','avi','webm'],multipleSelectionsAllowed:true});return JSON.stringify(files.map(function(file){return file.toString();}));}
 catch(error){if(error.errorNumber===-128)return '[]';throw error;}
}`;
async function chooseClipFiles(signal){
 if(process.platform!=='darwin')throw Error('Linking originals currently uses the Mac file picker. Use Import clips on this computer.');
 return new Promise((resolve,reject)=>{const child=spawn('/usr/bin/osascript',['-l','JavaScript','-e',chooserScript],{signal,stdio:['ignore','pipe','pipe']});let out='',errors='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>errors=(errors+b).slice(-2000));child.on('error',reject);child.on('close',code=>{if(code!==0){reject(new Error(signal?.aborted?'Selection cancelled.':'Could not open the Mac file picker. Use Import clips instead. '+errors));return;}try{const files=JSON.parse(out);if(!Array.isArray(files)||files.some(f=>typeof f!=='string'))throw Error('Invalid file selection.');resolve(files);}catch(e){reject(e);}});});
}
module.exports={chooseClipFiles,chooserScript};
