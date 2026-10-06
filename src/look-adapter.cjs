'use strict';
const {parseCube}=require('./cube.cjs');
// Published camera equations and D65 primaries, cross-checked against OpenColorIO.
// AppleCameras.cpp / SonyCameras.cpp (ASWF, BSD-3-Clause); see docs/LOOK-ADAPTATION.md.
const APPLE=[[.725,.301],[.221,.814],[.068,-.076]],SONY=[[.766,.275],[.225,.8],[.089,-.087]],WHITE=[.3127,.329];
const mul=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((sum,v,k)=>sum+v*b[k][j],0)));
function inverse(m){const a=m.map((r,i)=>[...r,...[0,1,2].map(j=>i===j?1:0)]);for(let i=0;i<3;i++){const scale=a[i][i];if(Math.abs(scale)<1e-12)throw Error('Singular colour matrix.');a[i]=a[i].map(v=>v/scale);for(let j=0;j<3;j++)if(j!==i){const f=a[j][i];a[j]=a[j].map((v,k)=>v-f*a[i][k]);}}return a.map(r=>r.slice(3));}
function rgbXYZ(primaries){const columns=primaries.map(([x,y])=>[x/y,1,(1-x-y)/y]),m=[0,1,2].map(i=>columns.map(c=>c[i])),white=[WHITE[0]/WHITE[1],1,(1-WHITE[0]-WHITE[1])/WHITE[1]],scale=mul(inverse(m),white.map(v=>[v])).map(r=>r[0]);return m.map(row=>row.map((v,i)=>v*scale[i]));}
const matrix=mul(inverse(rgbXYZ(SONY)),rgbXYZ(APPLE));
function appleDecode(v){const r0=-.05641088,c=47.28711236,pt=c*(.01-r0)**2;return v>=pt?2**((v-.69336945)/.08550479)-.00964052:v>=0?Math.sqrt(v/c)+r0:r0;}
function appleEncode(v){return v>=.01?.08550479*Math.log2(v+.00964052)+.69336945:v>=-.05641088?47.28711236*(v+.05641088)**2:0;}
function sonyEncode(v){return v>=.01125?(420+Math.log10((v+.01)/.19)*261.5)/1023:(v*(171.2102946929-95)/.01125+95)/1023;}
function sonyDecode(v){const threshold=171.2102946929/1023;return v>=threshold?10**((v*1023-420)/261.5)*.19-.01:(v*1023-95)*.01125/(171.2102946929-95);}
function toSony(rgb){const linear=rgb.map(appleDecode);return matrix.map(row=>sonyEncode(row.reduce((sum,v,i)=>sum+v*linear[i],0)));}
const cameraTransforms=require('./camera-transforms.cjs'),profiles=cameraTransforms.profiles.map(p=>p.id),reverseMatrix=inverse(matrix);
function transform(rgb,sourceProfile,targetProfile){
 if(!profiles.includes(sourceProfile)||!profiles.includes(targetProfile)||sourceProfile===targetProfile)throw Error('Choose two different supported recording profiles for porting.');
 if(sourceProfile==='sony-slog3-sgamut3cine'&&targetProfile==='apple-log2')return toSony(rgb);
 return cameraTransforms.byId(sourceProfile).encode(cameraTransforms.byId(targetProfile).decode(rgb));
}
function sampler(bytes){const parsed=parseCube(bytes),rows=Buffer.from(bytes).toString('utf8').split(/\r?\n/).map(l=>l.replace(/#.*$/,'').trim()).filter(l=>/^[+\-.\d]/.test(l)).map(l=>l.split(/\s+/).map(Number));return rgb=>{const p=rgb.map((v,i)=>Math.max(0,Math.min(1,(v-parsed.lo[i])/(parsed.hi[i]-parsed.lo[i])))*(parsed.size-1)),low=p.map(Math.floor),f=p.map((v,i)=>v-low[i]),out=[0,0,0];for(let b=0;b<2;b++)for(let g=0;g<2;g++)for(let r=0;r<2;r++){const row=rows[(Math.min(low[2]+b,parsed.size-1)*parsed.size+Math.min(low[1]+g,parsed.size-1))*parsed.size+Math.min(low[0]+r,parsed.size-1)],w=(r?f[0]:1-f[0])*(g?f[1]:1-f[1])*(b?f[2]:1-f[2]);for(let i=0;i<3;i++)out[i]+=row[i]*w;}return out;};}
function bake(bytes,title,{sourceProfile='sony-slog3-sgamut3cine',targetProfile='apple-log2'}={}){const source=parseCube(bytes),apply=sampler(bytes),rows=[];transform([0,0,0],sourceProfile,targetProfile);for(let b=0;b<33;b++)for(let g=0;g<33;g++)for(let r=0;r<33;r++)rows.push(apply(transform([r/32,g/32,b/32],sourceProfile,targetProfile)).map(v=>v.toFixed(9)).join(' '));const route=sourceProfile==='sony-slog3-sgamut3cine'&&targetProfile==='apple-log2'?'Apple Log 2 / Apple Wide Gamut -> existing Sony S-Log3 / S-Gamut3.Cine look':`${cameraTransforms.byId(targetProfile).shortLabel} -> existing ${cameraTransforms.byId(sourceProfile).shortLabel} look`;const text=`TITLE ${JSON.stringify(title.replace(/[\"\r\n]/g,' '))}\n# ${route}\n# Source SHA256 ${source.sha256}\n# Camera-to-camera perceptual match is unverified. Standard non-RAW input only.\nLUT_3D_SIZE 33\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n${rows.join('\n')}\n`;const result=Buffer.from(text);parseCube(result);return result;}
module.exports={appleDecode,appleEncode,sonyEncode,sonyDecode,toSony,transform,profiles,matrix,reverseMatrix,sampler,bake,version:1};
