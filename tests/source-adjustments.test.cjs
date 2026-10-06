'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),curves=require('../ui/source-curves.js'),{profiles}=require('../src/camera-transforms.cjs');
const close=(a,b,t=2e-6)=>assert.ok(Math.abs(a-b)<t,`${a} differs from ${b}`);
test('Source exposure changes scene-linear XYZ uniformly for every conversion profile',()=>{
 for(const p of profiles)for(const exposure of [-2,-1,1,2]){
  const rgb=[.5,.4,.3],xyz=p.decode(rgb),actual=p.decode(curves.adjust(rgb,p.id,{exposure}));actual.forEach((v,i)=>close(v,xyz[i]*2**exposure,p.id==='nikon-nlog-bt2020'?1e-4:2e-6));
 }
});
test('Sony source exposure retains the established S-Log3 formula and relative balance order',()=>{
 const rgb=[.5,.4,.3],decode=y=>10**((y*1023-420)/261.5)*.19-.01,encode=x=>(420+Math.log10((x+.01)/.19)*261.5)/1023;
 const gains=[2**(.004*15+.002*-8),2**(-.004*-8),2**(-.004*15+.002*-8)];const actual=curves.adjust(rgb,'sony-slog3-sgamut3cine',{exposure:1,warmth:15,tint:-8});actual.forEach((v,i)=>close(v,encode(decode(rgb[i])*2*gains[i]),1e-12));
});
test('Rec.709 and HLG exposure follow published source transfer landmarks without inventing a Log profile',()=>{
 const rec=curves.forProfile('rec709'),hlg=curves.forProfile('hlg-bt2020');close(rec.decode(.080),.080/4.5,1e-12);close(rec.encode(.18),.4090077288641504,1e-12);close(hlg.decode(.5),1/12,1e-12);close(hlg.decode(1),1,1e-7);
 close(curves.adjust([.5,.5,.5],'hlg-bt2020',{exposure:1})[0],.6564099854204412,1e-7);
 assert.equal(curves.forProfile('apple-log2-raw'),undefined);assert.equal(curves.forProfile('dji-dlog-m'),undefined);assert.throws(()=>curves.adjust([.5,.5,.5],'unknown'),/Confirm/);
});
test('Neutral controls preserve each profile and Apple Log 2 shares the curve while retaining a separate gamut',()=>{
 for(const id of [...profiles.map(p=>p.id),'rec709','hlg-bt2020'])for(const rgb of [[.1,.1,.1],[.5,.4,.3],[1,1,1]])curves.adjust(rgb,id).forEach((v,i)=>close(v,rgb[i],id==='nikon-nlog-bt2020'?1e-6:1e-8));
 assert.equal(curves.forProfile('apple-log'),curves.forProfile('apple-log2'));assert.notDeepEqual(profiles.find(p=>p.id==='apple-log').decode([.5,.4,.3]),profiles.find(p=>p.id==='apple-log2').decode([.5,.4,.3]));
});
