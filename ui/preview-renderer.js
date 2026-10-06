/* Source profile -> relative scene-linear exposure/balance -> source profile
   -> unchanged 3D LUT -> look controls. Shared curves: source-curves.js. */
window.LUTPreviewRenderer = class {
 constructor(canvas) {
  this.canvas=canvas;canvas.width=1280;canvas.height=720;
  const gl=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!gl) throw new Error('Live adjustments need WebGL2. Try Chrome or Safari.');
  this.rgbFrames=new Map();this.sources=new Map();this.luts=new Map();this.version=0;
  const vertex=`#version 300 es
  out vec2 uv;
  void main(){vec2 p=vec2((gl_VertexID==1)?3.0:-1.0,(gl_VertexID==2)?3.0:-1.0);uv=(p+1.0)*0.5;gl_Position=vec4(p,0.0,1.0);}`;
  const fragment=`#version 300 es
  precision highp float;precision highp sampler3D;
  in vec2 uv;out vec4 colour;
  uniform sampler2D source;uniform sampler3D cube;
  uniform vec3 domainMin,domainMax;uniform int cubeSize;uniform bool useLut;
  uniform float exposure,contrast,saturation;uniform vec3 balance;uniform int sourceCurve;
  ${window.LUTSourceCurves.shader()}
  vec3 lookup(vec3 c){
   vec3 p=clamp((c-domainMin)/(domainMax-domainMin),0.0,1.0)*float(cubeSize-1);
   ivec3 a=ivec3(floor(p)),b=min(a+ivec3(1),ivec3(cubeSize-1));vec3 f=fract(p);
   vec3 z0=mix(mix(texelFetch(cube,ivec3(a.x,a.y,a.z),0).rgb,texelFetch(cube,ivec3(b.x,a.y,a.z),0).rgb,f.x),mix(texelFetch(cube,ivec3(a.x,b.y,a.z),0).rgb,texelFetch(cube,ivec3(b.x,b.y,a.z),0).rgb,f.x),f.y);
   vec3 z1=mix(mix(texelFetch(cube,ivec3(a.x,a.y,b.z),0).rgb,texelFetch(cube,ivec3(b.x,a.y,b.z),0).rgb,f.x),mix(texelFetch(cube,ivec3(a.x,b.y,b.z),0).rgb,texelFetch(cube,ivec3(b.x,b.y,b.z),0).rgb,f.x),f.y);
   return mix(z0,z1,f.z);
  }
  void main(){
   vec3 c=texture(source,vec2(uv.x,1.0-uv.y)).rgb;
   if(exposure!=0.0||any(notEqual(balance,vec3(1.0)))){vec3 linear=vec3(decodeLog(c.r),decodeLog(c.g),decodeLog(c.b))*exp2(exposure)*balance;c=vec3(encodeLog(linear.r),encodeLog(linear.g),encodeLog(linear.b));}
   if(useLut){c=lookup(c);c=(c-vec3(0.5))*contrast+vec3(0.5);float y=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(y),c,saturation);}
   colour=vec4(clamp(c,0.0,1.0),1.0);
  }`;
  const compile=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
  this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
  gl.useProgram(this.program);this.uniforms={};
  for(const name of ['source','cube','domainMin','domainMax','cubeSize','useLut','exposure','contrast','saturation','balance','sourceCurve'])this.uniforms[name]=gl.getUniformLocation(this.program,name);
  gl.uniform1i(this.uniforms.source,0);gl.uniform1i(this.uniforms.cube,1);
  // Complete dummy 3D texture for the no-LUT branch.
  this.dummy=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,this.dummy);this.configure(gl.TEXTURE_3D);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA32F,1,1,1,0,gl.RGBA,gl.FLOAT,new Float32Array([0,0,0,1]));
 }
 configure(target) {const gl=this.gl;gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(target,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(target,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);if(target===gl.TEXTURE_3D)gl.texParameteri(target,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);}
 async checkedFetch(path){const r=await fetch(path);if(!r.ok)throw new Error(`Could not load ${path}`);return r;}
 source(scene) {
  if(this.sources.has(scene.id)){const p=this.sources.get(scene.id);this.sources.delete(scene.id);this.sources.set(scene.id,p);return p;}
  const promise=(async()=>{
   let rgb;const width=scene.preview_width||1280,height=scene.preview_height||720;
   if(scene.clip||scene.raw_path){const path=scene.raw_path||`card_sources/${scene.id}_1280x720.rgb48le`;const bytes=await (await this.checkedFetch(`${path}?frame=${scene.actual_seconds||0}`)).arrayBuffer();const raw=new Uint16Array(bytes);if(raw.length!==width*height*3)throw new Error('Log frame dimensions do not match.');rgb=new Float32Array(raw.length);for(let i=0;i<raw.length;i++)rgb[i]=raw[i]/65535;}
   else {const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=scene.original_url||`${scene.id}_LOG.jpg`;});const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const raw=ctx.getImageData(0,0,width,height).data;rgb=new Float32Array(width*height*3);for(let i=0,j=0;i<raw.length;i+=4){rgb[j++]=raw[i]/255;rgb[j++]=raw[i+1]/255;rgb[j++]=raw[i+2]/255;}}
   this.rgbFrames.set(scene.id,rgb);
   const rgba=new Float32Array(width*height*4);for(let i=0,j=0;i<rgb.length;i+=3){rgba[j++]=rgb[i];rgba[j++]=rgb[i+1];rgba[j++]=rgb[i+2];rgba[j++]=1;}
   const gl=this.gl,texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);this.configure(gl.TEXTURE_2D);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,height,0,gl.RGBA,gl.FLOAT,rgba);return texture;
  })();this.sources.set(scene.id,promise);return promise;
 }
 lut(record) {
  if(!record)return Promise.resolve({texture:this.dummy,size:1,lo:[0,0,0],hi:[1,1,1]});
  if(!this.luts.has(record.name))this.luts.set(record.name,(async()=>{
   const text=await (await this.checkedFetch(record.lut_url||`lut_data/${record.name}`)).text();let size=0,lo=[0,0,0],hi=[1,1,1],values=[];
   for(const line of text.split(/\r?\n/)){const p=line.split('#')[0].trim().split(/\s+/);if(!p[0]||p[0]==='TITLE')continue;if(p[0]==='LUT_3D_SIZE')size=Number(p[1]);else if(p[0]==='DOMAIN_MIN')lo=p.slice(1).map(Number);else if(p[0]==='DOMAIN_MAX')hi=p.slice(1).map(Number);else if(p.length===3){values.push(...p.map(Number),1);}else throw new Error('Unsupported LUT header.');}
   if(!size||values.length!==size**3*4||values.some(v=>!Number.isFinite(v))||hi.some((v,i)=>v<=lo[i]))throw new Error('Invalid LUT data.');
   const gl=this.gl,texture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_3D,texture);this.configure(gl.TEXTURE_3D);gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA32F,size,size,size,0,gl.RGBA,gl.FLOAT,new Float32Array(values));return {texture,size,lo,hi};
  })());return this.luts.get(record.name);
 }
 async autoBalance(scene){
  await this.source(scene);const rgb=this.rgbFrames.get(scene.id),samples=[];
  const curve=window.LUTSourceCurves.forProfile(scene.profile);if(!curve)throw Error('Confirm a supported recording profile first.');const decode=curve.decode;
  for(let i=0;i<rgb.length;i+=3*13){const c=[decode(rgb[i]),decode(rgb[i+1]),decode(rgb[i+2])],lo=Math.min(...c),hi=Math.max(...c),mean=(c[0]+c[1]+c[2])/3;if(lo<.025||hi>1.5||mean<.06)continue;const chroma=(hi-lo)/hi;if(chroma>.55)continue;samples.push({c,chroma,mean});}
  if(samples.length<100)throw new Error('Too few neutral candidates. Use the colour sliders.');
  samples.sort((a,b)=>a.chroma-b.chroma);const neutral=samples.slice(0,Math.max(100,Math.floor(samples.length*.2)));
  const median=values=>{values.sort((a,b)=>a-b);return values[Math.floor(values.length/2)];};
  const r=-median(neutral.map(s=>Math.log2(s.c[0]/s.c[1]))),b=-median(neutral.map(s=>Math.log2(s.c[2]/s.c[1])));
  return {warmth:Math.max(-100,Math.min(100,Math.round((r-b)/.008))),tint:Math.max(-100,Math.min(100,Math.round(((r+b)/2)/.006)))};
 }
 cancel(){this.version++;}
 async render(scene,record,adjustments){
  const version=++this.version;const [source,lut]=await Promise.all([this.source(scene),this.lut(record)]);if(version!==this.version)return false;
  const width=scene.preview_width||1280,height=scene.preview_height||720;this.canvas.width=width;this.canvas.height=height;const gl=this.gl;gl.useProgram(this.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,source);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_3D,lut.texture);
  gl.uniform3fv(this.uniforms.domainMin,lut.lo);gl.uniform3fv(this.uniforms.domainMax,lut.hi);gl.uniform1i(this.uniforms.cubeSize,lut.size);gl.uniform1i(this.uniforms.useLut,record?1:0);
  const curve=window.LUTSourceCurves.forProfile(scene.profile);if(!curve&&(adjustments.exposure||adjustments.warmth||adjustments.tint))throw Error('Confirm a supported recording profile first.');gl.uniform1i(this.uniforms.sourceCurve,curve?.index??-1);gl.uniform3fv(this.uniforms.balance,window.LUTSourceCurves.balance(adjustments.warmth,adjustments.tint));
  gl.uniform1f(this.uniforms.exposure,adjustments.exposure);gl.uniform1f(this.uniforms.contrast,adjustments.contrast);gl.uniform1f(this.uniforms.saturation,adjustments.saturation);
  gl.viewport(0,0,width,height);gl.drawArrays(gl.TRIANGLES,0,3);if(gl.getError()!==gl.NO_ERROR)throw new Error('Live preview could not render.');
  while(this.sources.size>2){const key=this.sources.keys().next().value,p=this.sources.get(key);this.sources.delete(key);this.rgbFrames.delete(key);p.then(texture=>gl.deleteTexture(texture));}
  return true;
 }
};
