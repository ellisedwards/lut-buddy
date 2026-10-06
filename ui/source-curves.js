/* Published camera curves shared by conversion and live source adjustments.
   Sources and restrictions: docs/MODERN-CAMERA-PROFILES.md. No HDR rendering. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.LUTSourceCurves=value;})(typeof globalThis==='object'?globalThis:this,()=>{
 'use strict';
 const f=n=>{const s=String(n);return /[.e]/i.test(s)?s:s+'.0';};
 const curves=[];
 function add(name,decode,encode,glDecode,glEncode){const c={name,index:curves.length,decode,encode,glDecode,glEncode};curves.push(c);return c;}
 function cameraLog(name,base,a,b,c,d,cut,slope){
  const at=a*Math.log(c*cut+d)/Math.log(base)+b,k=slope??a*c/((c*cut+d)*Math.log(base)),offset=at-k*cut;
  return add(name,y=>y<at?(y-offset)/k:(base**((y-b)/a)-d)/c,x=>x<cut?k*x+offset:a*Math.log(c*x+d)/Math.log(base)+b,
   `x<${f(at)}?(x-(${f(offset)}))/${f(k)}:(pow(${f(base)},(x-(${f(b)}))/${f(a)})-(${f(d)}))/${f(c)}`,
   `x<${f(cut)}?${f(k)}*x+(${f(offset)}):${f(a)}*log(${f(c)}*x+(${f(d)}))/log(${f(base)})+(${f(b)})`);
 }
 const sony=add('S-Log3',y=>y>=171.2102946929/1023?10**((y*1023-420)/261.5)*.19-.01:(y*1023-95)*.01125/(171.2102946929-95),x=>x>=.01125?(420+Math.log10((x+.01)/.19)*261.5)/1023:(x*(171.2102946929-95)/.01125+95)/1023,
  'x>=171.2102946929/1023.0?pow(10.0,(x*1023.0-420.0)/261.5)*0.19-0.01:(x*1023.0-95.0)*0.01125/(171.2102946929-95.0)',
  'x>=0.01125?(420.0+log((x+0.01)/0.19)/log(10.0)*261.5)/1023.0:(x*(171.2102946929-95.0)/0.01125+95.0)/1023.0');
 const apple=add('Apple Log',y=>y>=47.28711236*(.01+.05641088)**2?2**((y-.69336945)/.08550479)-.00964052:y>=0?Math.sqrt(y/47.28711236)-.05641088:-.05641088,x=>x>=.01?.08550479*Math.log2(x+.00964052)+.69336945:x>=-.05641088?47.28711236*(x+.05641088)**2:0,
  'x>=47.28711236*pow(0.01+0.05641088,2.0)?exp2((x-0.69336945)/0.08550479)-0.00964052:x>=0.0?sqrt(x/47.28711236)-0.05641088:-0.05641088',
  'x>=0.01?0.08550479*log2(x+0.00964052)+0.69336945:x>=-0.05641088?47.28711236*pow(x+0.05641088,2.0):0.0');
 const canon2=add('C-Log2',y=>(y<.092864125?-(10**((.092864125-y)/.24136077)-1):(10**((y-.092864125)/.24136077)-1))*.9/87.099375,x=>x<0?-.24136077*Math.log10(1-x*87.099375/.9)+.092864125:.24136077*Math.log10(1+x*87.099375/.9)+.092864125,
  '(x<0.092864125?-(pow(10.0,(0.092864125-x)/0.24136077)-1.0):(pow(10.0,(x-0.092864125)/0.24136077)-1.0))*0.9/87.099375',
  'x<0.0?-0.24136077*log(1.0-x*87.099375/0.9)/log(10.0)+0.092864125:0.24136077*log(1.0+x*87.099375/0.9)/log(10.0)+0.092864125');
 const canon3=add('C-Log3',y=>.9*(y<.097465473?-(10**((.12783901-y)/.36726845)-1)/14.98325:y<=.15277891?(y-.12512219)/1.9754798:(10**((y-.12240537)/.36726845)-1)/14.98325),x=>x<-.0126?-.36726845*Math.log10(1-x*14.98325/.9)+.12783901:x<=.0126?1.9754798*x/.9+.12512219:.36726845*Math.log10(1+x*14.98325/.9)+.12240537,
  '0.9*(x<0.097465473?-(pow(10.0,(0.12783901-x)/0.36726845)-1.0)/14.98325:x<=0.15277891?(x-0.12512219)/1.9754798:(pow(10.0,(x-0.12240537)/0.36726845)-1.0)/14.98325)',
  'x<-0.0126?-0.36726845*log(1.0-x*14.98325/0.9)/log(10.0)+0.12783901:x<=0.0126?1.9754798*x/0.9+0.12512219:0.36726845*log(1.0+x*14.98325/0.9)/log(10.0)+0.12240537');
 function fuji(name,a,b,c,d,e,g,cut1,cut2){return add(name,y=>y>=cut2?(10**((y-d)/c)-b)/a:(y-g)/e,x=>x>=cut1?c*Math.log10(a*x+b)+d:e*x+g,
  `x>=${f(cut2)}?(pow(10.0,(x-${f(d)})/${f(c)})-${f(b)})/${f(a)}:(x-${f(g)})/${f(e)}`,
  `x>=${f(cut1)}?${f(c)}*log(${f(a)}*x+${f(b)})/log(10.0)+${f(d)}:${f(e)}*x+${f(g)}`);}
 const flog=fuji('F-Log',.555556,.009468,.344676,.790453,8.735631,.092864,.00089,.100537775223865),flog2=fuji('F-Log2',5.555556,.064829,.245281,.384316,8.799461,.092864,.000889,.100686685370811);
 const nikon=add('N-Log',y=>y*1023<452?(y*1023/650)**3-.0075:Math.exp((y*1023-619)/150),x=>x<.328?650*Math.cbrt(x+.0075)/1023:(150*Math.log(x)+619)/1023,
  'x*1023.0<452.0?pow(x*1023.0/650.0,3.0)-0.0075:exp((x*1023.0-619.0)/150.0)',
  'x<0.328?650.0*sign(x+0.0075)*pow(abs(x+0.0075),1.0/3.0)/1023.0:(150.0*log(x)+619.0)/1023.0');
 const vlog=cameraLog('V-Log',10,.241514,.598206,1,.00873,.01),logc3=cameraLog('LogC3 EI800',10,.2471896383,.3855369987,1/.18,.052272275,((1/9)-.052272275)/(1/.18)),logc4=cameraLog('LogC4',2,.0647954196341293,-.295908392682586,2231.82630906769,64,-.0180569961199113),red=cameraLog('Log3G10',10,.224282,0,155.975327,.01*155.975327+1,-.01),bmd=cameraLog('Film Gen5',Math.E,.08692876065491224,.5300133392291939,1,.005494072432257808,.005),dji=cameraLog('D-Log 2017',10,1/3.89616,2.27752/3.89616,.9892,.0108,.00758078675);
 const rec709=add('Rec.709',y=>y<.081?y/4.5:((y+.099)/1.099)**(1/.45),x=>x<.018?4.5*x:1.099*x**.45-.099,
  'x<0.081?x/4.5:pow((x+0.099)/1.099,1.0/0.45)', 'x<0.018?4.5*x:1.099*pow(x,0.45)-0.099');
 const hlg=add('HLG',y=>y<=.5?y*y/3:(Math.exp((y-.55991073)/.17883277)+.28466892)/12,x=>x<=1/12?Math.sqrt(Math.max(0,3*x)):.17883277*Math.log(12*x-.28466892)+.55991073,
  'x<=0.5?x*x/3.0:(exp((x-0.55991073)/0.17883277)+0.28466892)/12.0',
  'x<=1.0/12.0?sqrt(max(0.0,3.0*x)):0.17883277*log(12.0*x-0.28466892)+0.55991073');
 const profiles={rec709,'hlg-bt2020':hlg,
  'sony-slog3-sgamut3cine':sony,'sony-slog3-sgamut3':sony,'apple-log':apple,'apple-log2':apple,
  'canon-clog2-cinema-gamut':canon2,'canon-clog3-cinema-gamut':canon3,'panasonic-vlog-vgamut':vlog,
  'arri-logc3-wide-gamut3':logc3,'arri-logc4-wide-gamut4':logc4,'red-log3g10-redwidegamutrgb':red,
  'blackmagic-film-gen5-wide-gamut':bmd,'dji-dlog-dgamut':dji,'fujifilm-flog-fgamut':flog,
  'fujifilm-flog2-fgamut':flog2,'fujifilm-flog2c-fgamutc':flog2,'nikon-nlog-bt2020':nikon
 };
 const shader=()=>['decode','encode'].map(mode=>`float ${mode}Log(float x){\n${curves.map(c=>`if(sourceCurve==${c.index})return ${mode==='decode'?c.glDecode:c.glEncode};`).join('\n')}\nreturn x;\n}`).join('\n');
 const balance=(warmth=0,tint=0)=>[2**(warmth*.004+tint*.002),2**(-tint*.004),2**(-warmth*.004+tint*.002)];
 function adjust(rgb,id,{exposure=0,warmth=0,tint=0}={}){const c=profiles[id];if(!c)throw Error('Confirm a supported recording profile before adjusting the source.');const gains=balance(warmth,tint);return rgb.map((v,i)=>c.encode(c.decode(v)*2**exposure*gains[i]));}
 return {forProfile:id=>profiles[id],shader,balance,adjust};
});
