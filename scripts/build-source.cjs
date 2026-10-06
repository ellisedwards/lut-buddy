// Share source only. Personal footage, migrated LUTs and development evidence stay outside the ZIP.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),destination=path.resolve(process.argv[2]||path.join(root,'..','LUT-Buddy-0.1.0-source.zip'));
const files=require('./source-files.cjs');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'lut-source-')),folder=path.join(temporary,'LUT-Buddy');
try{for(const relative of files){const target=path.join(folder,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,relative),target);}fs.chmodSync(path.join(folder,'Start LUT Buddy.command'),0o755);fs.mkdirSync(path.dirname(destination),{recursive:true});const zip=path.join(temporary,'source.zip');execFileSync('/usr/bin/zip',['-q','-r',zip,'LUT-Buddy'],{cwd:temporary});fs.renameSync(zip,destination);console.log(destination);}finally{fs.rmSync(temporary,{recursive:true,force:true});}
