'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function buildId(){const hash=createHash('sha256'),root=path.join(__dirname,'..');for(const file of require('../scripts/source-files.cjs').filter(f=>/^(src|ui|tools)\//.test(f)||['package.json','package-lock.json'].includes(f))){hash.update(file+'\0');hash.update(fs.readFileSync(path.join(root,file)));}return hash.digest('hex').slice(0,20);}
module.exports={buildId};
