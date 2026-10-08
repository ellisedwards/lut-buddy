'use strict';
// Encoded RGB signal levels: every R/G/B value contributes, with alpha excluded.
window.LUTLevels = {
 bins(pixels, stride=4, maximum=255) {
  const counts=new Uint32Array(128);
  for(let i=0;i<pixels.length;i+=stride)for(let channel=0;channel<3;channel++){
   const value=pixels[i+channel];
   counts[Math.max(0,Math.min(127,Math.floor(value/maximum*128)))]+=1;
  }
  return counts;
 },
 draw(canvas,original,output,light=false) {
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const peak=Math.max(1,...original,...output),root=Math.sqrt(peak),pad=3;
  ctx.strokeStyle=light?'#00000026':'#ffffff26';ctx.lineWidth=1;
  for(const fraction of [0,.5,1]){const x=pad+fraction*(w-pad*2);ctx.beginPath();ctx.moveTo(x,pad);ctx.lineTo(x,h-pad);ctx.stroke();}
  const trace=(counts,colour,fill)=>{
   ctx.beginPath();
   counts.forEach((count,i)=>{const x=pad+i/(counts.length-1)*(w-pad*2),y=h-pad-Math.sqrt(count)/root*(h-pad*2);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
   ctx.strokeStyle=colour;ctx.lineWidth=2.5;ctx.stroke();
   ctx.lineTo(w-pad,h-pad);ctx.lineTo(pad,h-pad);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  };
  trace(original,light?'#5d718b':'#b8c8de',light?'#5d718b14':'#b8c8de14');
  trace(output,light?'#956729':'#e6bb83',light?'#9567291a':'#e6bb831a');
 }
};
