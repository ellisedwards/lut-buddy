/* Pixel operations shared by full-resolution exports and portable adjusted LUTs.
   The live WebGL shader uses the same order and published source curves. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./source-curves.js'):root.LUTSourceCurves);if(typeof module==='object'&&module.exports)module.exports=api;else root.LUTLookMath=api;})(globalThis,curves=>{
 'use strict';
 const defaults={exposure:0,warmth:0,tint:0,contrast:1,saturation:1,enabled:true};
 function settings(value={}){
  const out={...defaults},ranges={exposure:[-2,2],warmth:[-100,100],tint:[-100,100],contrast:[.5,1.5],saturation:[0,1.5]};
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid look settings.');
  for(const [key,[lo,hi]]of Object.entries(ranges))if(value[key]!==undefined){if(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<lo||value[key]>hi)throw Error('Invalid '+key+' setting.');out[key]=value[key];}
  if(value.enabled!==undefined){if(typeof value.enabled!=='boolean')throw Error('Invalid bypass setting.');out.enabled=value.enabled;}
  return out.enabled?out:{...defaults};
 }
 function pipeline(profile,apply,requested={}){
  const a=settings(requested),curve=curves.forProfile(profile),source=a.exposure||a.warmth||a.tint,gains=curves.balance(a.warmth,a.tint).map(v=>v*2**a.exposure);
  if(source&&!curve)throw Error('Confirm a supported recording profile before exporting source adjustments.');
  return rgb=>{
   let c=source?rgb.map((v,i)=>curve.encode(curve.decode(v)*gains[i])):rgb;
   if(apply){c=apply(c).map(v=>(v-.5)*a.contrast+.5);const y=c[0]*.2126+c[1]*.7152+c[2]*.0722;c=c.map(v=>y+(v-y)*a.saturation);}
   return c.map(v=>Math.max(0,Math.min(1,v)));
  };
 }
 return {settings,pipeline};
});
