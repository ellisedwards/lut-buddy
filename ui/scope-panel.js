'use strict';
(()=>{
 const $=id=>document.getElementById(id),panel=$('levels'),plot=$('levels-plot'),ctx=plot.getContext('2d'),sample=document.createElement('canvas'),sampleCtx=sample.getContext('2d',{willReadFrequently:true});
 let current,original,version=0,timer,expanded=false,lastPixels;const originalCache=new Map();
 const modes=[['histogram','Histogram'],['rgb','RGB histogram'],['waveform','Waveform'],['parade','RGB parade'],['vectorscope','Vectorscope']];let modeIndex=0;
 const scopeMode=()=>modes[modeIndex][0];
 const isLight=()=>document.documentElement.dataset.theme==='light';
 const colours=['#ff7979','#70db9d','#87b4ff'];
 function scopeView(){const v=window.LUTProduct.getView(),surface=window.LUTInspection?.getScopeSurface();return v&&surface?{...v,surface}:v;}
 function grid(w,h){ctx.strokeStyle=isLight()?'#00000028':'#ffffff28';ctx.lineWidth=1;ctx.font='11px -apple-system, sans-serif';ctx.fillStyle=isLight()?'#575d66':'#bec4cc';for(const f of [0,.25,.5,.75,1]){const y=12+(1-f)*(h-24);ctx.beginPath();ctx.moveTo(28,y);ctx.lineTo(w-8,y);ctx.stroke();ctx.fillText(String(Math.round(f*100)),1,y+4);}}
 function trace(counts,colour,w,h,left=3,right=w-3,peak=Math.max(1,...counts)){ctx.beginPath();counts.forEach((n,i)=>{const x=left+i/(counts.length-1)*(right-left),y=h-4-Math.sqrt(n/peak)*(h-8);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.strokeStyle=colour;ctx.lineWidth=1.7;ctx.stroke();}
 function density(counts,cols,rows,x,y,w,h,colour){let peak=1;for(const n of counts)peak=Math.max(peak,n);const layer=document.createElement('canvas');layer.width=cols;layer.height=rows;const c=layer.getContext('2d'),image=c.createImageData(cols,rows),rgb=colour.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));for(let i=0;i<counts.length;i++)if(counts[i]){const k=i*4;image.data[k]=rgb[0];image.data[k+1]=rgb[1];image.data[k+2]=rgb[2];image.data[k+3]=Math.round(255*(.3+.7*Math.sqrt(counts[i]/peak)));}c.putImageData(image,0,0);ctx.drawImage(layer,x,y,w,h);}
 function draw(){
  if(!lastPixels||!current?.scene)return;const mode=scopeMode(),w=plot.width,h=plot.height;ctx.clearRect(0,0,w,h);
  const output=window.LUTScopes.histogram(lastPixels.data),rec709=current.record?current.record.output==='rec709':current.scene.profile==='rec709';
  $('scope-source').textContent=current.comparing?'Reference preview':'Displayed preview';$('levels-output-label').textContent=current.comparing?'Reference':'Output';$('levels-axis').style.visibility=['histogram','rgb'].includes(mode)?'visible':'hidden';panel.querySelector('.log-key').hidden=mode!=='histogram';panel.querySelector('.log-key').classList.toggle('scope-unavailable',mode==='histogram'&&!original);panel.querySelector('.log-key').title=original?'Original scene signal':'Original signal unavailable; only Output is plotted.';
  if(mode==='histogram'){const originalBins=original?.combined,ratio=originalBins?output.combined.reduce((a,b)=>a+b,0)/Math.max(1,originalBins.reduce((a,b)=>a+b,0)):1;window.LUTLevels.draw(plot,originalBins?Float64Array.from(originalBins,n=>n*ratio):null,output.combined,isLight());}
  else if(mode==='rgb'){const peak=Math.max(1,...output.rgb.flatMap(bins=>Array.from(bins)));output.rgb.forEach((bins,i)=>trace(bins,colours[i],w,h,3,w-3,peak));}
  else if(mode==='waveform'||mode==='parade'){
   grid(w,h);const {planes,columns,rows}=window.LUTScopes.waveform(lastPixels.data,lastPixels.width,lastPixels.height,{parade:mode==='parade'}),area=(w-38)/planes.length;
   planes.forEach((plane,i)=>{density(plane,columns,rows,28+i*area,12,area-2,h-24,mode==='parade'?colours[i]:(isLight()?'#956729':'#e6bb83'));if(mode==='parade'){ctx.fillStyle=colours[i];ctx.fillText(['R','G','B'][i],30+i*area,12);}});
  }else if(mode==='vectorscope'){
   if(!rec709){ctx.fillStyle=isLight()?'#575d66':'#c7cbd0';ctx.font='12px -apple-system, sans-serif';ctx.textAlign='center';ctx.fillText('Confirm Rec.709 output in LUT details',w/2,h/2);ctx.textAlign='left';}
   else{const side=Math.min(w-40,h-24),left=(w-side)/2,top=12,cx=w/2,cy=top+side/2;ctx.strokeStyle=isLight()?'#00000045':'#ffffff45';for(const r of [side*.25,side*.5]){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(left,cy);ctx.lineTo(left+side,cy);ctx.moveTo(cx,top);ctx.lineTo(cx,top+side);ctx.stroke();
    const vector=window.LUTScopes.vectorscope(lastPixels.data);density(vector.counts,vector.size,vector.size,left,top,side,side,isLight()?'#956729':'#e6bb83');
    for(const [label,rgb]of [['R',[.75,0,0]],['Y',[.75,.75,0]],['G',[0,.75,0]],['C',[0,.75,.75]],['B',[0,0,.75]],['M',[.75,0,.75]]]){const [cb,cr]=window.LUTScopes.chroma(...rgb),x=cx+cb*side,y=cy-cr*side;ctx.strokeStyle=isLight()?'#5d718b':'#b8c8de';ctx.strokeRect(x-3,y-3,6,6);ctx.fillStyle=isLight()?'#5d718b':'#b8c8de';ctx.font='10px -apple-system, sans-serif';ctx.fillText(label,x+5,y+3);}
    if($('scope-skin').checked){const angle=123*Math.PI/180;ctx.strokeStyle='#f7b5a4';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(angle)*side*.5,cy-Math.sin(angle)*side*.5);ctx.stroke();ctx.setLineDash([]);}
   }
  }
  $('scope-skin-label').hidden=mode!=='vectorscope';$('scope-note').textContent=mode==='vectorscope'?'Rec.709 preview · 75% targets · skin line is a hue guide, not a target for every face.':mode==='histogram'||mode==='rgb'?'Encoded preview values · square-root counts · not sensor headroom.':'Preview signal 0–100% · sampled across the whole image.';
  const stats=window.LUTScopes.clipping(lastPixels.data,{low:Number($('clip-low').value)*2.55,high:Number($('clip-high').value)*2.55});
  const pct=n=>(n/Math.max(1,stats.pixels)*100).toFixed(1)+'%';$('scope-clipping').textContent=`Near black ${pct(stats.shadowPixels)} · near white ${pct(stats.highlightPixels)}`; $('scope-clipping').title='Near black: all channels at/below threshold. Near white: any channel at/above threshold. Measured from sampled preview pixels.';
  $('scope-channel-clipping').textContent=['R','G','B'].map((c,i)=>`${c}: ${pct(stats.black[i])} black / ${pct(stats.white[i])} white`).join(' · ');
  plot.title=[$('scope-note').textContent,$('scope-clipping').textContent,$('scope-channel-clipping').textContent].join('\n');
  $('clip-shadows').parentElement.title='Shadows: '+pct(stats.shadowPixels)+' · all channels at or below the black threshold.';
  $('clip-highlights').parentElement.title='Highlights: '+pct(stats.highlightPixels)+' · any channel at or above the white threshold.';
  updateMask();
 }
 function updateMask(){
  const mask=$('clipping-mask');if(!current||(!$('clip-shadows').checked&&!$('clip-highlights').checked)){mask.hidden=true;window.LUTInspection?.setMask(null);return;}
  const surface=current.surface,width=surface.naturalWidth||surface.width,height=surface.naturalHeight||surface.height,c=document.createElement('canvas');c.width=width;c.height=height;const cc=c.getContext('2d',{willReadFrequently:true});cc.drawImage(surface,0,0,width,height);
  const image=cc.getImageData(0,0,width,height),stats=window.LUTScopes.clipping(image.data,{low:Number($('clip-low').value)*2.55,high:Number($('clip-high').value)*2.55,shadows:$('clip-shadows').checked,highlights:$('clip-highlights').checked,mask:true});image.data.set(stats.overlay);mask.width=width;mask.height=height;mask.getContext('2d').putImageData(image,0,0);mask.hidden=false;window.LUTInspection?.setMask(mask);
 }
 async function update(view){
  current=view;clearTimeout(timer);const job=++version;if(!view?.scene)return;
  if(!panel.hidden||$('clip-shadows').checked||$('clip-highlights').checked)timer=setTimeout(async()=>{
   let pixels;
   try{
    if(view.surface.decode)await view.surface.decode();if(job!==version)return;
    sample.width=384;sample.height=Math.max(1,Math.round((view.surface.naturalHeight||view.surface.height)*384/(view.surface.naturalWidth||view.surface.width)));sampleCtx.drawImage(view.surface,0,0,sample.width,sample.height);pixels=sampleCtx.getImageData(0,0,sample.width,sample.height);
    let raw;
    if(scopeMode()==='histogram'){const path=view.scene.raw_path;if(path){const key=path+'/'+view.scene.actual_seconds;if(!originalCache.has(key))originalCache.set(key,(async()=>{const res=await fetch(`${path}?frame=${view.scene.actual_seconds||0}`);if(!res.ok)throw Error('Original signal unavailable.');return window.LUTScopes.histogram(new Uint16Array(await res.arrayBuffer()),3,65535);})().catch(error=>{originalCache.delete(key);throw error;}));raw=await originalCache.get(key);}else{const image=await window.LUTProduct.getImage('',view.scene.id);sampleCtx.drawImage(image,0,0,sample.width,sample.height);raw=window.LUTScopes.histogram(sampleCtx.getImageData(0,0,sample.width,sample.height).data);}}
    if(job!==version)return;lastPixels=pixels;original=raw;draw();$('scope-error').hidden=true;$('levels-status').textContent='Scopes updated for '+view.scene.label;
   }catch(error){if(job===version){if(pixels){lastPixels=pixels;original=null;draw();}$('scope-error').hidden=false;$('scope-error').title=error.message+' Refresh the page to reconnect.';$('levels-status').textContent=error.message;}}
  },60);
 }
 $('scope-expand').addEventListener('click',()=>{expanded=!expanded;panel.classList.toggle('scope-expanded',expanded);const label=expanded?'Compact scopes':'Expand scopes';$('scope-expand').setAttribute('aria-label',label);$('scope-expand').setAttribute('aria-expanded',String(expanded));$('scope-expand').title=label;$('scope-size-icon').setAttribute('d',expanded?'M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5':'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5');plot.width=expanded?640:400;plot.height=expanded?300:120;draw();update(scopeView());window.LUTProduct.positionScopes();});
 function stepMode(step){modeIndex=(modeIndex+step+modes.length)%modes.length;$('scope-title').textContent=modes[modeIndex][1];draw();update(scopeView());window.LUTProduct.positionScopes();}
 $('scope-prev').addEventListener('click',()=>stepMode(-1));$('scope-next').addEventListener('click',()=>stepMode(1));
 $('scope-skin').addEventListener('change',()=>draw());
 for(const id of ['clip-shadows','clip-highlights','clip-low','clip-high'])$(id).addEventListener('change',()=>{try{draw();}catch(error){$('clipping-mask').hidden=true;window.LUTInspection?.setMask(null);$('scope-clipping').textContent=error.message;$('levels-status').textContent=error.message;}});
 window.LUTScopePanel={update,redraw:draw,invalidate(){version++;clearTimeout(timer);$('clipping-mask').hidden=true;window.LUTInspection?.setMask(null);},position(){},hideMask(){ $('clipping-mask').hidden=true;}};
 window.LUTScopePanel.update(window.LUTProduct.getView());
})();
