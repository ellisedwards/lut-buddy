/* Encoded signal measurements. Rec.709 Y'/Cb/Cr coefficients: ITU-R BT.709-6
   sections 3.2/3.3. These measure preview pixels, not sensor RAW headroom. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LUTScopes=api;})(globalThis,()=>{
 'use strict';
 const clamp=v=>Math.max(0,Math.min(1,v));
 const luma=(r,g,b)=>.2126*r+.7152*g+.0722*b;
 const chroma=(r,g,b)=>{const y=luma(r,g,b);return [(b-y)/1.8556,(r-y)/1.5748];};
 function histogram(pixels,stride=4,maximum=255){
  const rgb=Array.from({length:3},()=>new Uint32Array(256)),combined=new Uint32Array(256);
  for(let i=0;i<pixels.length;i+=stride)for(let c=0;c<3;c++){const bin=Math.min(255,Math.floor(clamp(pixels[i+c]/maximum)*256));rgb[c][bin]++;combined[bin]++;}
  return {rgb,combined};
 }
 function waveform(pixels,width,height,{parade=false,columns=256,rows=128}={}){
  const planes=Array.from({length:parade?3:1},()=>new Uint32Array(columns*rows));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4,r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,col=Math.min(columns-1,Math.floor(x/width*columns)),values=parade?[r,g,b]:[luma(r,g,b)];
   values.forEach((v,c)=>{const row=rows-1-Math.round(clamp(v)*(rows-1));planes[c][row*columns+col]++;});
  }
  return {planes,columns,rows};
 }
 function vectorscope(pixels,size=192){
  const counts=new Uint32Array(size*size);
  for(let i=0;i<pixels.length;i+=4){const [cb,cr]=chroma(pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255),x=Math.max(0,Math.min(size-1,Math.round((cb+.5)*(size-1)))),y=Math.max(0,Math.min(size-1,Math.round((.5-cr)*(size-1))));counts[y*size+x]++;}
  return {counts,size};
 }
 function clipping(pixels,{low=0,high=255,shadows=true,highlights=true,mask=false}={}){
  if(!Number.isFinite(low)||!Number.isFinite(high)||low<0||high>255||low>=high)throw Error('Black threshold must be below white threshold.');
  const black=[0,0,0],white=[0,0,0],overlay=mask?new Uint8ClampedArray(pixels.length):undefined;let shadowPixels=0,highlightPixels=0;
  for(let i=0;i<pixels.length;i+=4){let dark=true,bright=false;for(let c=0;c<3;c++){const v=pixels[i+c];if(v<=low)black[c]++;else dark=false;if(v>=high){white[c]++;bright=true;}}
   if(dark)shadowPixels++;if(bright)highlightPixels++;
   if(overlay&&((dark&&shadows)||(bright&&highlights))){overlay[i]=bright?255:45;overlay[i+1]=bright?45:110;overlay[i+2]=bright?45:255;overlay[i+3]=190;}
  }
  return {black,white,shadowPixels,highlightPixels,pixels:pixels.length/4,overlay};
 }
 return {luma,chroma,histogram,waveform,vectorscope,clipping};
});
