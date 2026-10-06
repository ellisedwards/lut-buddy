// Recorded settings only. No camera setting is inferred from image appearance.
const path=require('node:path');
const exiftool=require('exiftool-vendored.pl');
const config=path.join(__dirname,'../tools/sony_camera_extra.config');
const decoderSources=['https://exiftool.org/TagNames/Sony.html#rtmd','https://github.com/AdrianEddy/telemetry-parser/blob/master/src/sony/rtmd_tags.rs'];
const tags=['SampleTime','SampleDuration','FNumber','ExposureTime','ISO','WhiteBalance','FocalLength','FrameRate','ExposureCompensation','CameraWBKelvin','Sony_rtmd_0x8005','Sony_rtmd_0x810d','Sony_rtmd_0x3210','Sony_rtmd_0x3219','Sony_rtmd_0x321a','Make','Model','LensModel','RecordedLensAttributes'];
function uuid(value){if(typeof value!=='string')return '';const bytes=value.trim().split(/\s+/).map(Number);return bytes.length===16&&bytes.every(b=>Number.isInteger(b)&&b>=0&&b<=255)&&bytes.slice(0,4).join(' ')==='6 14 43 52'?Buffer.from(bytes).toString('hex'):'';}
const gamma=value=>({'01010605':'S-Log3','01010604':'S-Log3','01020000':'Rec.709','010b0000':'HLG','01010607':'PQ'})[uuid(value).slice(-8)]||null;
const gamut=value=>({'01030105':'S-Gamut3.Cine','01030104':'S-Gamut3','03030000':'Rec.709','03040000':'BT.2020'})[uuid(value).slice(-8)]||null;
const matrix=value=>({'02010000':'bt601','02020000':'bt709','02030000':'smpte240m','02060000':'bt2020nc'})[uuid(value).slice(-8)]||null;
function parseCamera(data,stream,pts){
 const docs=new Map(),staticTags={};
 for(const [key,value]of Object.entries(data)){const match=key.match(/^(Doc\d+):([^:]+):(.+)$/);if(match){const [,doc,track,name]=match;const sample=docs.get(doc)||{doc,track};sample[name]=value;docs.set(doc,sample);}else if(key!=='SourceFile')staticTags[key.split(':').at(-1)]=value;}
 const samples=[...docs.values()].filter(s=>s.track&&Number.isFinite(s.SampleTime)&&Object.keys(s).some(key=>!['doc','track','SampleTime','SampleDuration'].includes(key))).sort((a,b)=>a.SampleTime-b.SampleTime);
 const [n,d]=stream.time_base.split('/').map(Number),start=Number(pts[0])*n/d;
 const aligned=samples.length===pts.length&&samples.every((s,i)=>Math.abs((s.SampleTime-samples[0].SampleTime)-(Number(pts[i])*n/d-start))<1e-5);
 const triples=samples.map(s=>({gamma:gamma(s.Sony_rtmd_0x3210),gamut:gamut(s.Sony_rtmd_0x3219),matrix:matrix(s.Sony_rtmd_0x321a)}));
 const first=triples[0],consistent=Boolean(first)&&triples.every(t=>JSON.stringify(t)===JSON.stringify(first));
 const sonyProfile=aligned&&consistent&&first.gamma==='S-Log3'?(first.gamut==='S-Gamut3.Cine'?'sony-slog3-sgamut3cine':first.gamut==='S-Gamut3'?'sony-slog3-sgamut3':null):aligned&&consistent&&first.gamma==='Rec.709'&&first.gamut==='Rec.709'?'rec709':null;
 const hasSonyEvidence=samples.some(s=>['Sony_rtmd_0x3210','Sony_rtmd_0x3219','Sony_rtmd_0x321a'].some(k=>s[k]!==undefined));
 const taggedHLG=!hasSonyEvidence&&stream.color_transfer==='arib-std-b67'&&stream.color_primaries==='bt2020'&&stream.color_space==='bt2020nc';
 const taggedSDR=!hasSonyEvidence&&stream.color_transfer==='bt709'&&stream.color_primaries==='bt709'&&stream.color_space==='bt709';
 const streamRecording=taggedHLG?{gamma:'HLG',gamut:'BT.2020',matrix:'bt2020nc'}:taggedSDR?{gamma:'Rec.709',gamut:'Rec.709',matrix:'bt709'}:null;
 const detectedProfile=sonyProfile||(taggedHLG?'hlg-bt2020':taggedSDR?'rec709':null);
 return {decoder:'ExifTool 13.59 + recorded video stream tags + documented Sony RTMD decoding',decoderSources,staticTags,samples,aligned,detectedProfile,recordingSource:streamRecording?'Original video stream colour tags':'Recorded Sony RTMD',recording:streamRecording||(consistent?first:null),warning:samples.length&&!aligned?'Recorded camera samples do not align with the video frame timeline. Dynamic settings are unavailable.':null};
}
async function extract(file,stream,pts,signal,run){
 const args=[exiftool,'-config',config,'-j','-n','-ee','-a','-u','-G3:1',...tags.map(t=>'-'+t),file];let result,warning;
 try{result=await run(process.platform==='darwin'?'/usr/bin/perl':'perl',args,signal,undefined,undefined,{maxOutputBytes:16*1024*1024});}
 catch(error){if(signal?.aborted)throw error;warning=error.code==='OUTPUT_LIMIT'?'Per-frame metadata is too large. Clip-level metadata retained; dynamic settings are unavailable.':'Detailed camera metadata is unavailable. Video stream information retained.';
  try{result=await run(process.platform==='darwin'?'/usr/bin/perl':'perl',args.filter(a=>a!=='-ee'),signal,undefined,undefined,{maxOutputBytes:1024*1024});}catch(e){if(signal?.aborted)throw e;result={output:'[{}]'};}}
 const data=JSON.parse(result.output)[0]||{},recorded=parseCamera(data.Error?{}:data,stream,pts);if(warning||data.Error)recorded.warning=warning||'Camera metadata is unavailable. Video stream information retained.';return recorded;
}
function atFrame(metadata,index,clipName){
 const camera=metadata.camera;if(!camera)return {available:false};
 const sample=camera.aligned?camera.samples[index]:undefined,settings={},recording=camera.recording;
 const put=(key,value,display,source,scope=(sample?'frame':'clip'),note)=>{const available=value!==undefined&&value!==null&&Number.isFinite(typeof value==='number'?value:0);settings[key]={value:available?value:null,display:available?display:null,available,scope,source,...(note?{note}:{})};};
 const src=sample?`Sony RTMD ${sample.doc}:${sample.track} at ${sample.SampleTime}s`:'Recorded camera metadata';
 const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
 const iso=positive(sample?.ISO??camera.staticTags.ISO);put('iso',iso,String(iso),src+' ISO');
 const f=positive(sample?.FNumber??camera.staticTags.FNumber);put('aperture',f,f?`f/${f.toFixed(1)}`:null,src+' FNumber');
 const shutter=positive(sample?.ExposureTime??camera.staticTags.ExposureTime);put('shutter_seconds',shutter,shutter?`1/${Math.round(1/shutter)} s`:null,src+' ExposureTime',sample?'frame':'clip','Recorded exposure duration; nominal shutter label is not inferred.');
 const packed=sample?.Sony_rtmd_0x8005;let focal=positive(sample?.FocalLength??camera.staticTags.FocalLength);
 if(Number.isInteger(packed)&&packed>=0&&packed<=65535){let exp=(packed>>>12)&15;if(exp>=8)exp-=16;focal=positive((packed&4095)*10**exp*1000);}
 put('focal_length_mm',focal,focal?`${Number(focal.toPrecision(6))} mm`:null,src+' Sony 0x8005');
 const wbMode=({0:'Preset',1:'Automatic',2:'Hold',3:'One Push'})[sample?.Sony_rtmd_0x810d];put('white_balance_mode',wbMode,wbMode,src+' Sony 0x810d');
 const wb=({1:'Incandescent',2:'Fluorescent',4:'Daylight',5:'Cloudy',6:'Custom / Shade',255:'Preset'})[sample?.WhiteBalance];put('white_balance_preset',wb,wb,src+' WhiteBalance');
 const kelvin=positive(sample?.CameraWBKelvin);put('white_balance_kelvin',kelvin,kelvin?`${kelvin} K`:null,src+' Sony 0x810e','frame','No Kelvin temperature is inferred from a preset.');
 const ev=sample?.ExposureCompensation;put('exposure_compensation_ev',typeof ev==='number'&&Number.isFinite(ev)?ev:null,`${ev} EV`,src+' ExposureCompensation');
 const rate=positive(sample?.FrameRate);put('frame_rate',rate,rate?`${rate.toFixed(3)} fps`:null,src+' FrameRate');
 const sidecar=camera.sidecar?.fields||{};for(const [key,value]of [['camera_model',sidecar.camera_model||camera.staticTags.Model],['lens_model',sidecar.lens_model||sample?.RecordedLensAttributes||camera.staticTags.LensModel],['gamma',recording?.gamma||sidecar.gamma],['gamut',recording?.gamut||sidecar.gamut]])put(key,value,value,key==='gamma'||key==='gamut'?camera.recordingSource||'Recorded profile metadata':'Recorded camera metadata','clip');
 put('resolution',[metadata.stream.width,metadata.stream.height],`${metadata.stream.width} × ${metadata.stream.height}`,'Video stream dimensions','clip');
 return {available:Object.entries(settings).some(([key,value])=>key!=='resolution'&&key!=='frame_rate'&&value.available),clip:clipName,actual_seconds:Number(metadata.pts[index])*Number(metadata.stream.time_base.split('/')[0])/Number(metadata.stream.time_base.split('/')[1]),frame_index_zero_based:index,sample_seconds:sample?.SampleTime??null,sample_duration_seconds:sample?.SampleDuration??null,source_sha256:metadata.sha256,settings,metadata_sample:sample||null,decoder:camera.decoder,decoder_sources:decoderSources,limits:camera.warning||'Absent or unsupported settings stay unavailable. No Kelvin or exposure setting is inferred from image appearance.'};
}
module.exports={extract,parseCamera,atFrame};

function attachSidecar(metadata,clipName,filename,xml){
 const {createHash}=require('node:crypto');
 if(typeof xml!=='string'||Buffer.byteLength(xml)>256*1024||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Use a camera XML file without document entities, up to 256 KB.');
 const expected=clipName.replace(/\.[^.]+$/,'')+'M01.xml';if(typeof filename!=='string'||filename.toLowerCase()!==expected.toLowerCase())throw new Error('The camera XML filename does not match this clip.');
 const {XMLParser,XMLValidator}=require('fast-xml-parser');
 if(XMLValidator.validate(xml)!==true)throw new Error('Camera XML is malformed. Nothing was changed.');
 const parsed=new XMLParser({ignoreAttributes:false,removeNSPrefix:true}).parse(xml),meta=parsed.NonRealTimeMeta;
 if(!meta||typeof meta!=='object')throw new Error('This is not a supported Sony camera metadata XML.');
 const get=tag=>Object.fromEntries(Object.entries(meta[tag]||{}).filter(([key])=>key.startsWith('@_')).map(([key,value])=>[key.slice(2),value]));
 const groups=[].concat(meta.AcquisitionRecord?.Group||[]),items=Object.fromEntries(groups.flatMap(group=>[].concat(group.Item||[])).map(item=>[item['@_name'],item['@_value']]));
 if(Number(get('Duration').value)!==metadata.pts.length)throw new Error('Camera XML duration does not match the video frame count.');
 const gammaName={'s-log3-cine':'S-Log3','s-log3':'S-Log3',rec709:'Rec.709'}[items.CaptureGammaEquation]||null,gamutName={'s-gamut3-cine':'S-Gamut3.Cine','s-gamut3':'S-Gamut3',rec709:'Rec.709'}[items.CaptureColorPrimaries]||null;
 const coding={rec709:'bt709',rec601:'bt601',rec2020:'bt2020nc'}[items.CodingEquations]||null;
 const streamMatrix=({bt709:'bt709',bt601:'bt601',bt470bg:'bt601',smpte170m:'bt601',smpte240m:'smpte240m',bt2020nc:'bt2020nc'})[metadata.stream.color_space];
 if(coding&&streamMatrix&&coding!==streamMatrix)throw new Error('Camera XML conflicts with the video decoding matrix.');
 const recorded=metadata.camera.recording;
 if(recorded&&((metadata.camera.recordingSource!=='Original video stream colour tags'&&((recorded.gamma&&gammaName&&recorded.gamma!==gammaName)||(recorded.gamut&&gamutName&&recorded.gamut!==gamutName)))||(recorded.matrix&&coding&&recorded.matrix!==coding)))throw new Error('Camera XML conflicts with metadata recorded inside this video.');
 metadata.camera.sidecar={filename,sha256:createHash('sha256').update(xml).digest('hex'),sourceSha256:metadata.sha256,xml,fields:{camera_model:get('Device').modelName||null,lens_model:get('Lens').modelName||null,gamma:gammaName,gamut:gamutName}};
 if(coding&&!recorded?.matrix)metadata.decoding={matrix:coding,range:metadata.stream.color_range,evidence:`Camera XML ${filename}; matching duration and selected clip filename`};
 if(gammaName==='S-Log3'&&['S-Gamut3.Cine','S-Gamut3'].includes(gamutName)){metadata.camera.detectedProfile=gamutName==='S-Gamut3'?'sony-slog3-sgamut3':'sony-slog3-sgamut3cine';metadata.camera.recording={gamma:gammaName,gamut:gamutName,matrix:coding||recorded?.matrix};metadata.camera.recordingSource='Matching camera XML';}
 return metadata;
}
module.exports.attachSidecar=attachSidecar;

// These describe the original clip, never the PNG/JPEG used to display a scene.
const profileSpaces={
 'sony-slog3-sgamut3cine':['S-Log3','S-Gamut3.Cine'],
 rec709:['Rec.709','Rec.709'],
 'hlg-bt2020':['HLG','BT.2020'],
 // Apple Log (first generation): https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/applelog
 'apple-log':['Apple Log','BT.2020'],
 // https://developer.apple.com/documentation/avfoundation/avcapturecolorspace/applelog2
 'apple-log2':['Apple Log 2','Apple Wide Gamut'],
 'canon-clog3-cinema-gamut':['C-Log3','Cinema Gamut'],
 'panasonic-vlog-vgamut':['V-Log','V-Gamut'],
 'arri-logc3-wide-gamut3':['LogC3','ARRI Wide Gamut 3']
};
for(const p of require('./camera-transforms.cjs').profiles){if(!profileSpaces[p.id]){const [curve,gamut]=p.label.split(' · ').at(-1).split(' / ');profileSpaces[p.id]=[curve,gamut];}}
function withFormat(info,metadata,selectedProfile){
 const settings={...info.settings},stream=metadata.stream||{},fields={};
 const field=(value,source,note)=>({display:value||'[Unverified]',available:!!value,source,...(note?{note}:{})});
 fields.camera_model=field(settings.camera_model?.available?settings.camera_model.display:null,settings.camera_model?.source,settings.camera_model?.source?.startsWith('Creator')?'Camera supplied in demo creator documentation; not embedded camera metadata.':'Camera model recorded in the clip or its camera XML.');
 const codec=stream.codec_name;
 const codecName=({h264:'H.264',hevc:'HEVC / H.265',prores:'ProRes',av1:'AV1',vp9:'VP9',mpeg2video:'MPEG-2',dnxhd:'DNxHD / DNxHR'})[codec]||codec;
 fields.codec=field(codecName?codecName+(codec==='prores'&&stream.profile?' '+stream.profile:''):null,'Original video stream codec',stream.profile?`Codec profile: ${stream.profile}. Compression format; this does not establish the Log curve or colour gamut.`:'Compression format; this does not establish the Log curve or colour gamut.');
 const pixel=stream.pix_fmt||'',yuv=pixel.match(/^yuv(?:j)?a?(420|422|444|440|411|410)p(?:(\d+)(?:le|be))?$/),depth=Number(stream.bits_per_raw_sample)||Number(yuv?.[2])||(yuv?8:({nv12:8,nv21:8,p010le:10,p010be:10,p016le:16,p016be:16})[pixel]);
 const chroma=yuv?.[1]?.split('').join(':')||(/^nv(?:12|21)$|^p0(?:10|16)(?:le|be)$/.test(pixel)?'4:2:0':null);
 fields.precision=field(depth?`${depth}-bit${chroma?' '+chroma:''}`:null,'Original video stream pixel format',`Source pixel format: ${pixel||'[Unverified]'}. Bit depth and chroma sampling belong to the video, not the rendered image.`);
 const selected=profileSpaces[selectedProfile],recordedGamma=settings.gamma?.available?settings.gamma.display:null,recordedGamut=settings.gamut?.available?settings.gamut.display:null;
 const conflict=!!selected&&!!((recordedGamma&&recordedGamma!==selected[0])||(recordedGamut&&recordedGamut!==selected[1]));
 // The selected clip profile is what LUT matching uses. Keep overrides visible.
 const supplied=!!selected&&(!recordedGamma||!recordedGamut||conflict);
 fields.gamma=field(selected?.[0]||recordedGamma,supplied?'Selected clip profile':settings.gamma?.source,supplied?'Selected by you for LUT matching; not established from recorded camera metadata.':undefined);
 fields.gamut=field(selected?.[1]||recordedGamut,supplied?'Selected clip profile':settings.gamut?.source,supplied?'Gamut belonging to the selected clip profile; not established from recorded camera metadata.':undefined);
 fields.resolution=field(stream.width&&stream.height?`${stream.width} × ${stream.height}`:settings.resolution?.available?settings.resolution.display:null,'Original video dimensions');
 if(!settings.frame_rate?.available&&stream.avg_frame_rate){const [n,d]=stream.avg_frame_rate.split('/').map(Number),rate=n/d;if(Number.isFinite(rate)&&rate>0)settings.frame_rate={display:`${rate.toFixed(3)} fps`,available:true,source:'Original video stream average frame rate',note:'Average video frame rate; variable-rate clips can have different frame intervals.'};}
 return {...info,available:true,settings,format:{fields,profileStatus:supplied?'selected':recordedGamma&&recordedGamut?'recorded':'unverified',conflict:conflict?`Selected profile differs from recorded ${recordedGamma||'[Unverified]'} / ${recordedGamut||'[Unverified]'}`:null}};
}
module.exports.withFormat=withFormat;
