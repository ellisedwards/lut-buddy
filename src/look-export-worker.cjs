'use strict';
const {workerData:d}=require('node:worker_threads'),fs=require('node:fs'),math=require('../ui/look-math.js'),{sampler}=require('./look-adapter.cjs');
const apply=math.pipeline(d.profile,d.lutFile?sampler(fs.readFileSync(d.lutFile)):null,d.adjustments),input=fs.openSync(d.raw,'r'),output=fs.openSync(d.output,'wx'),row=Buffer.alloc(d.width*6);
try{
 if(fs.fstatSync(input).size!==d.width*d.height*6)throw Error('Original pixel dimensions do not match.');
 for(let y=0;y<d.height;y++){
  let read=0;while(read<row.length){const n=fs.readSync(input,row,read,row.length-read,null);if(!n)throw Error('Original pixel data is incomplete.');read+=n;}
  for(let i=0;i<row.length;i+=6){const c=apply([row.readUInt16LE(i)/65535,row.readUInt16LE(i+2)/65535,row.readUInt16LE(i+4)/65535]);for(let k=0;k<3;k++)row.writeUInt16LE(Math.round(c[k]*65535),i+k*2);}
  let written=0;while(written<row.length)written+=fs.writeSync(output,row,written,row.length-written);
 }
}finally{fs.closeSync(input);fs.closeSync(output);}
