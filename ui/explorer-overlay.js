'use strict';
const productBoot=JSON.parse(document.getElementById('product-boot').textContent);
window.LUTProduct={boot:productBoot,getSelection:()=>({...state}),selectScene:id=>{if(byScene.has(id)){$('scene').value=id;$('scene').dispatchEvent(new Event('change',{bubbles:true}));}},setSceneCollection:id=>{state.sceneCollection=id;save();},setSceneDevice:id=>{state.sceneDevice=id;save();},setSceneNavigation:ids=>{sceneNavigation=ids.filter(id=>byScene.has(id));$('scene').replaceChildren(...sceneNavigation.map(id=>makeOption(id,sceneLabels.get(id))));$('scene').value=state.scene;},getSceneNavigation:()=>[...sceneNavigation],sceneTitle:id=>sceneLabels.get(id),refresh:()=>render(),flush:async()=>{save();while(savingProject||pendingPrefs){await persistProject();await new Promise(r=>setTimeout(r,30));}}};
const scenes = JSON.parse(document.getElementById('scenes-manifest').textContent);
const byScene = new Map(scenes.map(scene => [scene.id,scene]));
const records = JSON.parse(document.getElementById('manifest').textContent);
const lookNavigation=window.LUTLookNavigation;
if(records.some((r,i)=>!/^[A-Z0-9]{3}$/.test(r.code||'')||records.slice(0,i).some(other=>other.code===r.code&&!lookNavigation.canShareCode(r,other))))throw new Error('LUT codes must be unique except across linked camera versions.');
const byName = new Map(records.map(r => [r.name,r]));
const $ = id => document.getElementById(id);
const tiles = $('tiles'), rail = $('rail'), preview = $('preview');
const preferenceKey = 'lut-explorer-project-'+productBoot.projectId;
let state = {scene:'studio_wide',sceneCollection:'',sceneDevice:'',selectedLook:'',referenceLook:'',selected:'SONY_REF_LC709A.cube',reference:'',comparing:false,favourites:[],favouritesOnly:false,adjustments:{},theme:'dark',cameraInfo:false,histogram:false,stripVisible:true,lutOrder:records.map(r=>r.id)};
function cleanAdjustments(value={}) {
 const number=(key,fallback,min,max)=>typeof value[key]==='number'&&Number.isFinite(value[key])?Math.max(min,Math.min(max,value[key])):fallback;
 return {warmth:number('warmth',0,-100,100),tint:number('tint',0,-100,100),exposure:number('exposure',0,-2,2),contrast:number('contrast',1,.5,1.5),saturation:number('saturation',1,0,1.5),enabled:typeof value.enabled==='boolean'?value.enabled:true};
}
function restorePreferences(saved) {
 if(!saved||typeof saved!=='object')return;
 if(Array.isArray(saved.lutOrder))state.lutOrder=saved.lutOrder;
 if(typeof saved.stripVisible==='boolean')state.stripVisible=saved.stripVisible;
 if(typeof saved.cameraInfo==='boolean')state.cameraInfo=saved.cameraInfo;
 if(typeof saved.histogram==='boolean')state.histogram=saved.histogram;
 else if(typeof saved.cameraInfo==='boolean')state.histogram=saved.cameraInfo;
 if(['dark','light'].includes(saved.theme))state.theme=saved.theme;
 if (byScene.has(saved.scene)) state.scene = saved.scene;
 if(typeof saved.sceneCollection==='string')state.sceneCollection=saved.sceneCollection;
 if(typeof saved.sceneDevice==='string')state.sceneDevice=saved.sceneDevice;
 for(const key of ['selectedLook','referenceLook'])if(typeof saved[key]==='string')state[key]=saved[key];
 if (saved.selected === '' || byName.has(saved.selected)){state.selected=saved.selected;if(typeof saved.selectedLook!=='string')state.selectedLook=byName.has(saved.selected)?lookNavigation.family(byName.get(saved.selected)):'';}
 if (saved.reference === '' || byName.has(saved.reference)){state.reference=saved.reference;if(typeof saved.referenceLook!=='string')state.referenceLook=byName.has(saved.reference)?lookNavigation.family(byName.get(saved.reference)):'';}
 if (Array.isArray(saved.favourites)) state.favourites = [...new Set(saved.favourites.filter(name=>typeof name==='string'))];
 if (typeof saved.favouritesOnly==='boolean') state.favouritesOnly = saved.favouritesOnly;
 if(saved.adjustments&&typeof saved.adjustments==='object')for(const [scene,a] of Object.entries(saved.adjustments)){if(byScene.has(scene)&&a&&typeof a==='object')state.adjustments[scene]=cleanAdjustments(a);}
}
let hadBrowserPreferences=false;
try {
 const saved = JSON.parse(localStorage.getItem(preferenceKey));hadBrowserPreferences=Boolean(saved);
 restorePreferences(saved);
} catch {}
restorePreferences(productBoot.settings);
if(!byScene.has(state.scene))state.scene=scenes[0]?.id||'';
if(state.favouritesOnly && state.favourites.length && state.selected && !state.favourites.includes(state.selected)) state.selected=state.favourites[0];
let projectReady=false,projectRevision=null,lastSharedState=null,pendingPrefs=null,savingProject=false,projectTimer=0,loadingProject=false;
function save() { try { localStorage.setItem(preferenceKey,JSON.stringify(state));$('save-status').textContent=''; } catch { $('save-status').textContent='Favourites could not be saved in this browser.'; } if(projectReady){const snapshot=JSON.parse(JSON.stringify({...state,comparing:false}));if(JSON.stringify(snapshot)!==JSON.stringify(lastSharedState)){pendingPrefs=snapshot;try{localStorage.setItem(preferenceKey+'-pending',JSON.stringify({base:lastSharedState,revision:projectRevision,state:snapshot}));}catch{}clearTimeout(projectTimer);projectTimer=setTimeout(persistProject,200);}} }
const descriptions=JSON.parse($('descriptions').textContent);
const cameraMetadata=JSON.parse($('camera-metadata').textContent);
function updateStrip(){const visible=state.stripVisible;$('lut-dock').hidden=!visible;$('strip-toggle').setAttribute('aria-pressed',String(visible));$('strip-toggle').setAttribute('aria-label',visible?'Hide LUT strip':'Show LUT strip');$('strip-toggle').title=(visible?'Hide LUT strip':'Show LUT strip')+' (L)';}
$('strip-toggle').addEventListener('click',()=>{state.stripVisible=!state.stripVisible;updateStrip();updateCameraInfo();save();updateLevels();});
window.addEventListener('resize',()=>updateCameraInfo());
function updateCameraInfo(){
 const d=cameraMetadata[state.scene],button=$('camera-info'),strip=$('camera-strip'),available=Boolean(d?.available);
 button.disabled=!available;button.title=available?'Camera and recording info (C)':'Camera information unavailable';
 button.setAttribute('aria-label',available?(state.cameraInfo?'Hide camera and recording info':'Show camera and recording info'):'Camera information unavailable');
 button.setAttribute('aria-pressed',String(state.cameraInfo));strip.hidden=!available||!state.cameraInfo;
 strip.style.bottom=(state.stripVisible?$('lut-dock').offsetHeight+24:14)+'px';strip.replaceChildren();
 if(!available){positionLevels();return;}
 const add=(row,label,field)=>{const span=document.createElement('span'),small=document.createElement('small');small.textContent=label;span.append(small,document.createTextNode(field.display));span.title=[field.source,field.note].filter(Boolean).join('. ');row.append(span);return span;};
 const group=()=>{const row=document.createElement('div');row.className='camera-info-group';strip.append(row);return row;};
 const s=d.settings||{};
 if(d.format){
  const f=d.format.fields,device=group(),colour=group(),format=group();
  add(device,'Camera',f.camera_model);
  if(s.lens_model?.available)device.firstElementChild.title+=' · Lens: '+s.lens_model.display;
  add(colour,'Profile',f.gamma);add(colour,'Gamut',f.gamut);
  if(d.format.profileStatus==='selected')add(colour,'',{display:'(selected profile)',note:'The clip profile was selected by you; it is not confirmed by recorded camera metadata.'});
  if(d.format.conflict){const warning=add(colour,'',{display:'Profile mismatch',note:d.format.conflict});warning.className='camera-profile-warning';}
  if(f.resolution?.available)add(format,'',f.resolution);
  if(s.frame_rate?.available)add(format,'',s.frame_rate);
  if(f.precision?.available)add(format,'',f.precision);
  if(!format.children.length)format.remove();
 }
 const row=group();
 for(const [label,key]of [['ISO','iso'],['','aperture'],['Shutter','shutter_seconds'],['','focal_length_mm']])if(s[key]?.available)add(row,label,s[key]);
 if(!d.format){if(s.frame_rate?.available)add(row,'',s.frame_rate);if(s.gamma?.available)add(row,'Profile',s.gamma);}
 const wb=s.white_balance_mode?.display==='Automatic'?'Auto':s.white_balance_kelvin?.available?s.white_balance_kelvin.display:s.white_balance_preset?.available&&!['None','Preset'].includes(s.white_balance_preset.display)?s.white_balance_preset.display:s.white_balance_mode?.display;
 if(wb)add(row,'WB',{display:wb,source:s.white_balance_kelvin?.available?s.white_balance_kelvin.source:s.white_balance_mode?.source,note:s.white_balance_kelvin?.available?undefined:'Recorded white balance mode or preset; no Kelvin temperature is inferred.'});
 if(!row.children.length)row.remove();
 const a={...sceneAdjustments()},name=state.comparing?state.reference:state.selected;
 if(hasAdjustment(a)){
  const edited=group();edited.classList.add('camera-adjustments');
  const sourceEditable=!!window.LUTSourceCurves.forProfile(byScene.get(state.scene)?.profile);
  const active=[];
  if(sourceEditable){
   if(Math.abs(a.exposure)>1e-6)active.push(['Exposure',`${a.exposure>0?'+':''}${a.exposure.toFixed(2)} EV`]);
   for(const key of ['warmth','tint'])if(Math.abs(a[key])>1e-6)active.push([key==='warmth'?'Warmth':'Tint',`${a[key]>0?'+':''}${a[key]}`]);
  }
  if(name)for(const key of ['contrast','saturation'])if(Math.abs(a[key]-1)>1e-6)active.push([key==='contrast'?'Contrast':'Saturation',`${Math.round(a[key]*100)}%`]);
  if(a.enabled)for(const [label,display]of active)add(edited,label,{display,note:'Preview adjustment; original camera metadata is unchanged.'});
  if(!edited.children.length)edited.remove();
 }

 positionLevels();
}
$('camera-info').addEventListener('click',()=>{state.cameraInfo=!state.cameraInfo;updateCameraInfo();save();});
$('histogram-toggle').addEventListener('click',()=>{state.histogram=!state.histogram;positionLevels();save();updateLevels();});
function applyTheme(){document.documentElement.dataset.theme=state.theme;const light=state.theme==='light';$('theme').setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');$('theme').title=(light?'Dark theme':'Light theme')+' (T)';$('theme-sun').hidden=light;$('theme-sun').style.display=light?'none':'';$('theme-icon').setAttribute('d',light?'M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z':'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4');}
applyTheme();$('theme').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();positionLevels();save();});
function updateDescription(name){const d=descriptions[name];const box=$('look-description');box.replaceChildren();if(!name){box.textContent=`Original ${byScene.get(state.scene)?.gamma||'frame'} · no creative look or display conversion.`;return;}if(!d){box.textContent='Description being researched.';return;}const text=(d.confidence==='unverified'&&!d.text.includes('[Unverified]')?'[Unverified] ':'')+d.text;if(d.source_url){const a=document.createElement('a');a.href=d.source_url;a.target='_blank';a.rel='noopener';a.title='Read source description';a.textContent=text;box.append(a);}else box.textContent=text;}
function imagePath(name,scene=state.scene) {if(!byScene.has(scene))return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221280%22 height=%22720%22/%3E';return `previews/${scene}/${name?byName.get(name).id:'original'}`;}
function canUseLut(name,sceneId=state.scene){if(!name)return true;const record=byName.get(name),scene=byScene.get(sceneId);if(!record||!scene)return false;if(scene.legacy&&record.legacy&&scene.profile==='sony-slog3-sgamut3cine')return true;if(record.legacy&&scene.profile==='sony-slog3-sgamut3cine'&&record.input==='unknown'&&record.output==='unknown')return true;return scene.profile!=='unknown'&&record.input===scene.profile&&record.output==='rec709';}
function label(name) { return name ? (byName.get(name)?.legacy&&!byName.get(name)?.displayNameEdited?name:byName.get(name)?.stem)||name : `No LUT · original ${byScene.get(state.scene)?.gamma||'frame'}`; }
function makeOption(name,text) { const option=document.createElement('option');option.value=name;option.textContent=text;return option; }
const cardGroup=document.createElement('optgroup');cardGroup.label='Your footage';
const sampleGroup=document.createElement('optgroup');sampleGroup.label='Demo scenes';
for (const scene of scenes) {
 const seconds=scene.time_seconds;
 const timestamp=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 const stem=scene.clip?.replace(/\.[^.]+$/,''),actual=scene.actual_seconds||0,defaultCapture=`${stem} · ${Math.floor(actual/60)}:${(actual%60).toFixed(3).padStart(6,'0')}`;
 const title=scene.clip&&scene.label!==defaultCapture ? `${scene.label} · ${stem} · ${timestamp}` : scene.label;
 (scene.clip?cardGroup:sampleGroup).append(makeOption(scene.id,title));
}
$('scene').append(cardGroup,sampleGroup);$('scene').value=state.scene;
// The menu groups footage before demos; scene shortcuts must use that same order.
let sceneNavigation=[...$('scene').options].map(option=>option.value);
const sceneLabels=new Map([...$('scene').options].map(option=>[option.value,option.textContent]));
for(const [id,key] of Object.entries({'strip-toggle':'L','camera-info':'C','histogram-toggle':'H','adjust-open':'E',favourite:'F',fullscreen:'M',theme:'T','adjust-bypass':'B',toggle:'Space','filter-all':'A','filter-favourites':'A',about:'Shift+/'}))$(id).setAttribute('aria-keyshortcuts',key);
$('filter-all').title='Show all compatible LUTs (A toggles favourites)';$('filter-favourites').title='Show favourites (A)';
$('scene-count').textContent=`${records.length} looks · ${scenes.length} scenes`;
$('reference').append(makeOption('','X · No LUT / original log'));
for (const r of records) {
 $('reference').append(makeOption(r.name,`${r.code} · ${r.stem}`));
 const button=document.createElement('button');button.className='tile';button.dataset.name=r.name;
 button.setAttribute('aria-label',`${r.code} — ${r.name}`);button.setAttribute('aria-pressed','false');button.title=`${r.code} · ${r.name}`;
 const img=document.createElement('img');img.src=imagePath(canUseLut(r.name)?r.name:'');img.alt='';img.draggable=false;
 const code=document.createElement('span');code.className='code';code.textContent=r.code;
 const favourite=document.createElement('span');favourite.className='fav-badge';favourite.textContent='★';favourite.setAttribute('aria-hidden','true');
 button.append(img,code,favourite);if(r.adaptation){const ported=document.createElement('span');ported.className='ported-indicator tile-ported';ported.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 10H2V2h8v1"/></svg>';ported.setAttribute('aria-hidden','true');button.append(ported);button.title+=' · Ported copy of '+r.adaptation.sourceName;button.setAttribute('aria-label',button.getAttribute('aria-label')+' · Ported copy');}tiles.append(button);
}
$('reference').value=state.reference;
const allTiles=[...rail.querySelectorAll('.tile')];
const cache=new Map();
function loadImage(path) {
 if (!cache.has(path)) {
  const img=new Image();
  const promise=new Promise((resolve,reject)=>{img.onload=()=>img.decode().then(()=>resolve(img),reject);img.onerror=()=>reject(new Error(`Could not load ${path}`));});
  img.src=path;cache.set(path,promise);
 }
 return cache.get(path);
}
const warmedScenes=[];
function warmScene(scene) {
 if(!byScene.has(scene))return;
 const previous=warmedScenes.indexOf(scene);
 if(previous!==-1) warmedScenes.splice(previous,1);
 warmedScenes.push(scene);
 if(warmedScenes.length>2) warmedScenes.shift();
 // Keep only the two most recent scenes in the preload cache.
 for(const path of cache.keys()) {
  if(!warmedScenes.some(id=>path.startsWith('previews/'+id+'/'))) cache.delete(path);
 }
 // Preloading makes the click-and-drag sweep instantaneous once images arrive.
 for (const name of ['',...byName.keys()])if(canUseLut(name,scene))loadImage(imagePath(name,scene)).catch(()=>{});
}
let renderVersion=0;
function visibleNames() { return ['',...records.filter(r=>canUseLut(r.name)&&(!state.favouritesOnly || state.favourites.includes(r.name))).map(r=>r.name)]; }
function updateFavourites() {
 const name=state.comparing?state.reference:state.selected;
 const isFavourite=state.favourites.includes(name);
 const action=isFavourite?'Remove from favourites':'Add to favourites';
 $('favourite').disabled=!name;
 $('favourite').textContent=isFavourite?'★':'☆';
 $('favourite').setAttribute('aria-pressed',String(isFavourite));
 $('favourite').setAttribute('aria-label',name?`${action}: ${name}`:'Original log cannot be favourited');
 $('favourite').title=name?action+' (F)':'No LUT selected';
 $('filter-all').setAttribute('aria-pressed',String(!state.favouritesOnly));
 $('filter-favourites').setAttribute('aria-pressed',String(state.favouritesOnly));
 $('favourite-count').textContent=state.favourites.filter(name=>canUseLut(name)).length;
 for(const tile of allTiles) {
  const isFavourite=state.favourites.includes(tile.dataset.name);
  tile.classList.toggle('favourite',isFavourite);
  tile.hidden=Boolean(tile.dataset.name && (!canUseLut(tile.dataset.name) || state.favouritesOnly && !isFavourite));
  tile.disabled=!lutReorderMode&&!!tile.dataset.name&&!canUseLut(tile.dataset.name);
  tile.title=tile.dataset.name?(tile.disabled?'Choose matching clip and LUT profiles in Library. Hold for 3 seconds to reorder.':`${byName.get(tile.dataset.name).code} · ${byName.get(tile.dataset.name).stem} · Hold for 3 seconds to reorder`):'X · No LUT / original';
 }
 const compatibleRecords=records.filter(r=>canUseLut(r.name));
 // Rebuild the native picker when profile/order changes: hidden options are unreliable on macOS.
 const optionNames=['',...compatibleRecords.map(r=>r.name)];
 if(JSON.stringify([...$('reference').options].map(o=>o.value))!==JSON.stringify(optionNames)){
  $('reference').replaceChildren(makeOption('','X · No LUT / original log'),...compatibleRecords.map(r=>makeOption(r.name,`${r.code} · ${r.stem}`)));
  $('reference').value=state.reference;
 }
 for(const option of $('reference').options) {
  if(!option.value) continue;
  const r=byName.get(option.value);
  option.textContent=`${r.code} · ${r.stem}${state.favourites.includes(r.name)?' ★':''}`;
 }
 const empty=!compatibleRecords.some(r=>!state.favouritesOnly||state.favourites.includes(r.name));
 $('no-favourites').textContent=state.favouritesOnly?'No compatible favourites for this scene · choose All':'No compatible LUTs for this scene';
 $('no-favourites').hidden=!empty;
 tiles.hidden=empty;
 $('scroll-left').hidden=empty;$('scroll-right').hidden=empty;
 requestAnimationFrame(updateScrollButtons);
}
function updateControls() {
 for(const key of ['selected','reference']){const value=lookNavigation.resolve(records,state[key],state[key+'Look'],canUseLut);state[key]=value.name;state[key+'Look']=value.family;}
 $('reference').value=state.reference;
 allTiles.forEach(tile=>tile.setAttribute('aria-pressed',String(tile.dataset.name===state.selected)));
 $('scene').value=state.scene;
 $('stage').setAttribute('aria-pressed',String(state.comparing));
 $('toggle').setAttribute('aria-pressed',String(state.comparing));
 $('toggle').textContent=state.comparing?'Back':'Compare';
 $('toggle').title=(state.comparing?'Return to selected LUT':`Compare with ${label(state.reference)}`)+' (Space)';
 $('stage').setAttribute('aria-label',state.comparing?`Return to ${label(state.selected)}`:`Compare with ${label(state.reference)}`);
 updateFavourites();
 updateAdjustmentControls();updateStrip();updateCameraInfo();
 window.LUTScenePicker?.sync();
}
async function render() {
 if(!scenes.length){preview.hidden=true;preview.removeAttribute('src');$('live-preview').hidden=true;$('filename').textContent='Your footage, your looks';$('look-detail').textContent='Open Library to import a clip and mark your scenes.';$('empty-library').hidden=false;return;}
 $('empty-library').hidden=true;
 const version=++renderVersion;liveRenderer?.cancel();invalidateLevels();
 updateControls();save();
 const name=state.comparing?state.reference:state.selected, scene=state.scene, comparing=state.comparing;
 const path=imagePath(name,scene);
 try {
  await loadImage(path);
  if (version!==renderVersion) return;
  $('filename').textContent=label(name);updateDescription(name);
  const r=byName.get(name);
  $('look-detail').textContent=(r?`${r.maker} · ${r.code}`:'Untreated log image')+(comparing?` · comparing against ${label(state.selected)}`:'');
  $('badge-text').textContent=comparing?'Comparison':(name?'Selected LUT':'No LUT');
  $('badge').classList.toggle('reference',comparing);
  const adjusted=await renderAdjustments(name,scene,version);
  if(version!==renderVersion)return;
  // Publish only the finished preview. Keep the previous surface during loading.
  preview.src=path;preview.alt=`${byScene.get(scene).label} · ${label(name)}`;
  $('live-preview').hidden=!adjusted;preview.hidden=adjusted;
  displayedLevelsVersion=version;updateLevels();
 } catch (error) {
  if(version===renderVersion) { $('filename').textContent='Preview could not load';$('look-detail').textContent=error.message; }
 }
}
function select(name,{reveal=false}={}) {
 if ((!byName.has(name) && name!=='') || !canUseLut(name)) return;
 if (state.selected===name && !state.comparing) return;
 state.selected=name;state.selectedLook=byName.has(name)?lookNavigation.family(byName.get(name)):'';state.comparing=false;render();
 if (reveal && name) allTiles.find(tile=>tile.dataset.name===name).scrollIntoView({block:'nearest',inline:'nearest'});
}
function compare() { state.comparing=!state.comparing;render(); }
// Native select menus have no open-state API. Track activation and consume the
// dismissal gesture before it can reach the preview or another action.
let activeDropdown=null,dropdownDismissClick=false;
const dropdownTarget=event=>event.target.closest?.('select');
document.addEventListener('pointerdown',event=>{
 dropdownDismissClick=false;
 const select=dropdownTarget(event);
 if(activeDropdown&&select!==activeDropdown){
  const previous=activeDropdown;activeDropdown=null;dropdownDismissClick=true;
  event.preventDefault();event.stopImmediatePropagation();previous.blur();return;
 }
 if(select)activeDropdown=select;
},true);
document.addEventListener('click',event=>{
 if(dropdownDismissClick||(activeDropdown&&!dropdownTarget(event))){
  const previous=activeDropdown;activeDropdown=null;dropdownDismissClick=false;
  event.preventDefault();event.stopImmediatePropagation();previous?.blur();
 }
},true);
document.addEventListener('change',event=>{if(dropdownTarget(event))activeDropdown=null;},true);
document.addEventListener('keydown',event=>{
 const select=dropdownTarget(event);
 if(event.key==='Escape'||event.key==='Tab'){activeDropdown=null;dropdownDismissClick=false;}
 else if(select&&(['Enter',' '].includes(event.key)||(event.altKey&&event.key==='ArrowDown')))activeDropdown=select;
},true);
window.addEventListener('blur',()=>{activeDropdown=null;dropdownDismissClick=false;});
$('stage').addEventListener('click',compare);$('toggle').addEventListener('click',compare);
$('reference').addEventListener('change',event=>{state.reference=event.target.value;state.referenceLook=byName.has(state.reference)?lookNavigation.family(byName.get(state.reference)):'';render();});
$('favourite').addEventListener('click',()=>{
 const name=state.comparing?state.reference:state.selected;
 if(!name) return;
 if(state.favourites.includes(name)) state.favourites=state.favourites.filter(value=>value!==name);
 else state.favourites.push(name);
 if(state.favouritesOnly && !state.comparing && state.favourites.length && !state.favourites.includes(state.selected)) state.selected=state.favourites[0];
 render();
});
function filterFavourites(only) {
 state.favouritesOnly=only;
 if(only && state.favourites.length && state.selected && !state.favourites.includes(state.selected)) {
  state.selected=state.favourites[0];state.comparing=false;
 }
 tiles.scrollLeft=0;render();
 requestAnimationFrame(()=>allTiles.find(tile=>tile.dataset.name===state.selected && !tile.hidden)?.scrollIntoView({block:'nearest',inline:'nearest'}));
}
$('filter-all').addEventListener('click',()=>filterFavourites(false));
$('filter-favourites').addEventListener('click',()=>filterFavourites(true));
$('scene').addEventListener('change',event=>{
 state.scene=event.target.value;
 $('raw-thumb').src=imagePath('');
 for (const tile of tiles.querySelectorAll('.tile')) tile.querySelector('img').src=imagePath(canUseLut(tile.dataset.name)?tile.dataset.name:'');
 warmScene(state.scene);render();
});
allTiles.forEach(tile=>tile.addEventListener('click',()=>{if(!lutReorderMode)select(tile.dataset.name);}));

let drag=null,frame=0,holdTimer=0,lutReorderMode=false,dragGhost=null,reorderSaving=false;
let savedLutOrder=records.map(r=>r.name),orderDirty=false;
const lutOrder=()=>[...tiles.querySelectorAll('.tile')].map(t=>t.dataset.name);
function applyLutOrder(names){
 const items=new Map(allTiles.filter(t=>t.dataset.name).map(t=>[t.dataset.name,t]));
 for(const name of names)tiles.append(items.get(name));
 const ranked=new Map(names.map((name,index)=>[name,index]));records.sort((a,b)=>ranked.get(a.name)-ranked.get(b.name));
 allTiles.sort((a,b)=>(a.dataset.name?ranked.get(a.dataset.name)+1:0)-(b.dataset.name?ranked.get(b.dataset.name)+1:0));
 for(const name of names){const option=[...$('reference').options].find(o=>o.value===name);if(option)$('reference').append(option);}
 updateScrollButtons();
}
async function saveLutOrder(){
 if(reorderSaving||!orderDirty)return;reorderSaving=true;
 try{while(orderDirty){orderDirty=false;const names=lutOrder();const response=await fetch('api/call',{method:'POST',headers:{'Content-Type':'application/json','X-LUT-Token':productBoot.token},body:JSON.stringify({method:'reorderLuts',payload:{projectId:productBoot.projectId,ids:names.map(name=>byName.get(name).id)}})});const value=await response.json();if(!response.ok||!value.ok)throw new Error(value.error||'Order could not be saved.');savedLutOrder=names;state.lutOrder=names.map(name=>byName.get(name).id);save();$('lut-reorder-status').textContent='LUT order saved.';}}
 catch(error){orderDirty=false;applyLutOrder(savedLutOrder);$('save-status').textContent=error.message;$('lut-reorder-status').textContent=error.message;}
 finally{reorderSaving=false;}
}
function enterLutReorder(){
 lutReorderMode=true;$('lut-dock').classList.add('reordering');$('lut-reorder-toolbar').hidden=false;
 $('lut-reorder-status').textContent='Reorder mode. Drag LUTs to rearrange them. Choose Done or press Escape to finish.';
 for(const tile of allTiles)if(tile.dataset.name){tile.disabled=false;tile.setAttribute('aria-description','Drag to reorder; arrow keys move the focused LUT.');}
}
function finishLutReorder(){endDrag();lutReorderMode=false;$('lut-dock').classList.remove('reordering');$('lut-reorder-toolbar').hidden=true;for(const tile of allTiles)tile.removeAttribute('aria-description');updateFavourites();saveLutOrder();}
$('lut-reorder-done').addEventListener('click',finishLutReorder);
function startReorderDrag(tile,x,y){
 drag.tile=tile;tile.classList.add('reorder-dragging');const box=tile.getBoundingClientRect();dragGhost=tile.cloneNode(true);dragGhost.classList.remove('reorder-dragging');dragGhost.classList.add('lut-drag-ghost');dragGhost.setAttribute('aria-hidden','true');dragGhost.removeAttribute('aria-description');dragGhost.tabIndex=-1;dragGhost.style.width=box.width+'px';dragGhost.style.height=box.height+'px';document.body.append(dragGhost);moveGhost(x,y);
}
function moveGhost(x,y){if(dragGhost){dragGhost.style.left=(x-dragGhost.offsetWidth/2)+'px';dragGhost.style.top=(y-dragGhost.offsetHeight/2)+'px';}}
function reorderHitTest(x,y){
 if(!drag?.tile)return;const target=document.elementFromPoint(x,y)?.closest('.tile');
 if(!target||target===drag.tile||!tiles.contains(target))return;
 // Reorder visible slots only; hidden non-favourites keep their positions.
 const visible=[...tiles.querySelectorAll('.tile')].filter(t=>!t.hidden),old=visible.indexOf(drag.tile),index=visible.indexOf(target),box=target.getBoundingClientRect();
 if(index<0||(index>old&&x<box.left+box.width/2)||(index<old&&x>box.left+box.width/2))return;
 visible.splice(old,1);visible.splice(index,0,drag.tile);let cursor=0;
 const names=[...tiles.querySelectorAll('.tile')].map(t=>t.hidden?t.dataset.name:visible[cursor++].dataset.name);
 applyLutOrder(names);orderDirty=true;
}
function hitTest(x,y){const tile=document.elementFromPoint(x,y)?.closest('.tile');if(tile&&rail.contains(tile))select(tile.dataset.name);}
function edgeSweep(){
 if(!drag)return;const box=tiles.getBoundingClientRect(),withinY=drag.y>=box.top-10&&drag.y<=box.bottom+10;let speed=0;
 if(withinY&&drag.x>=box.left&&drag.x<=box.right+40){if(drag.x>box.right-40)speed=Math.min(18,(drag.x-box.right+40)*.45);else if(drag.x<box.left+40)speed=-Math.min(18,(box.left+40-drag.x)*.45);}
 if(speed&&(lutReorderMode||!holdTimer)){tiles.scrollLeft+=speed;if(lutReorderMode)reorderHitTest(drag.x,drag.y);else hitTest(drag.x,drag.y);}
 frame=requestAnimationFrame(edgeSweep);
}
rail.addEventListener('pointerdown',event=>{
 const tile=event.target.closest('.tile');if(!tile||event.button!==0||!event.isPrimary)return;
 if(lutReorderMode&&!tile.dataset.name)return;
 event.preventDefault();tile.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};
 rail.setPointerCapture(event.pointerId);
 if(lutReorderMode)startReorderDrag(tile,event.clientX,event.clientY);
 else{select(tile.dataset.name);if(tile.dataset.name)holdTimer=setTimeout(()=>{if(drag){enterLutReorder();startReorderDrag(tile,drag.x,drag.y);}},3000);}
 frame=requestAnimationFrame(edgeSweep);
});
rail.addEventListener('pointermove',event=>{
 if(!drag||event.pointerId!==drag.id)return;drag.x=event.clientX;drag.y=event.clientY;
 if(Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>8){clearTimeout(holdTimer);holdTimer=0;}
 if(lutReorderMode){moveGhost(drag.x,drag.y);reorderHitTest(drag.x,drag.y);}else hitTest(drag.x,drag.y);
});
function endDrag(){
 clearTimeout(holdTimer);holdTimer=0;if(!drag)return;
 const id=drag.id;drag.tile?.classList.remove('reorder-dragging');drag=null;dragGhost?.remove();dragGhost=null;cancelAnimationFrame(frame);
 if(rail.hasPointerCapture(id))rail.releasePointerCapture(id);if(lutReorderMode)saveLutOrder();
}
rail.addEventListener('contextmenu',event=>{if(event.target.closest('.tile'))event.preventDefault();});
rail.addEventListener('pointerup',endDrag);rail.addEventListener('pointercancel',endDrag);rail.addEventListener('lostpointercapture',endDrag);window.addEventListener('blur',endDrag);
tiles.addEventListener('wheel',event=>{
 if (Math.abs(event.deltaY)>Math.abs(event.deltaX)) { event.preventDefault();tiles.scrollLeft+=event.deltaY; }
},{passive:false});
function updateScrollButtons() {
 $('scroll-left').disabled=tiles.scrollLeft<1;
 $('scroll-right').disabled=tiles.scrollLeft+tiles.clientWidth>=tiles.scrollWidth-1;
}
tiles.addEventListener('scroll',updateScrollButtons,{passive:true});window.addEventListener('resize',updateScrollButtons);
$('scroll-left').addEventListener('click',()=>tiles.scrollBy({left:-tiles.clientWidth*.7,behavior:'smooth'}));
$('scroll-right').addEventListener('click',()=>tiles.scrollBy({left:tiles.clientWidth*.7,behavior:'smooth'}));
window.addEventListener('keydown',event=>{
 if(event.isComposing||event.defaultPrevented)return;
 if(lutReorderMode){if(event.key==='Escape'){event.preventDefault();finishLutReorder();}else if(['ArrowLeft','ArrowRight'].includes(event.key)&&tiles.contains(event.target)){event.preventDefault();const visible=[...tiles.querySelectorAll('.tile')].filter(t=>!t.hidden),index=visible.indexOf(event.target),next=index+(event.key==='ArrowLeft'?-1:1);if(next>=0&&next<visible.length){[visible[index],visible[next]]=[visible[next],visible[index]];let cursor=0;applyLutOrder([...tiles.querySelectorAll('.tile')].map(t=>t.hidden?t.dataset.name:visible[cursor++].dataset.name));event.target.focus({preventScroll:true});event.target.scrollIntoView({block:'nearest',inline:'nearest'});orderDirty=true;saveLutOrder();}}return;}
 if(event.key==='Escape'&&$('viewer').classList.contains('expanded')){event.preventDefault();$('viewer').classList.remove('expanded');syncFullscreen();return;}
 if(event.key==='Escape'&&!$('adjust-panel').hidden){showAdjustmentPanel(false);return;}
 if (document.querySelector('dialog[open]') || !scenes.length || event.target.closest?.('select,input,textarea,[contenteditable]:not([contenteditable="false"])') || event.altKey || event.ctrlKey || event.metaKey || $('about-dialog').open) return;
 if(event.shiftKey&&event.key!=='?')return;
 if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();if(!sceneNavigation.length)return;const index=sceneNavigation.indexOf(state.scene),next=Math.max(0,Math.min(sceneNavigation.length-1,index+(event.key==='ArrowDown'?1:-1)));$('scene').value=sceneNavigation[next];$('scene').dispatchEvent(new Event('change',{bubbles:true}));return;}
 const shortcuts={f:'favourite',l:'strip-toggle',c:'camera-info',h:'histogram-toggle',e:'adjust-open',m:'fullscreen',t:'theme',b:'adjust-bypass','?':'about'};
 const shortcut=shortcuts[event.key.toLowerCase()];
 if(shortcut){event.preventDefault();if(!event.repeat)$(shortcut).click();return;}
 if(event.key.toLowerCase()==='a'){event.preventDefault();if(!event.repeat)filterFavourites(!state.favouritesOnly);return;}
 if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
  event.preventDefault();
  const names=visibleNames(),index=names.indexOf(state.selected);
  const next=event.key==='Home'?0:event.key==='End'?names.length-1:Math.max(0,Math.min(names.length-1,index+(event.key==='ArrowRight'?1:-1)));
  select(names[next],{reveal:true});
 } else if(event.code==='Space' && (!event.target.matches('button') || event.target.classList.contains('tile'))) { event.preventDefault();compare(); }
});
$('viewer').append($('about-dialog'));
$('about').addEventListener('click',()=>$('about-dialog').showModal());
$('close-about').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')) { const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) event.target.close(); }});
let liveRenderer=null,adjustFrame=0;
function sceneAdjustments(scene=state.scene){return state.adjustments[scene]||(state.adjustments[scene]=cleanAdjustments());}
function hasAdjustment(a){return Math.abs(a.warmth)>1e-6||Math.abs(a.tint)>1e-6||Math.abs(a.exposure)>1e-6||Math.abs(a.contrast-1)>1e-6||Math.abs(a.saturation-1)>1e-6;}
function updateAdjustmentControls(){
 const a=sceneAdjustments(),name=state.comparing?state.reference:state.selected;
 const sourceEditable=!!window.LUTSourceCurves.forProfile(byScene.get(state.scene)?.profile);
 for(const key of ['exposure','warmth','tint','auto-balance'])$(key).disabled=!sourceEditable;
 $('source-profile-note').textContent=sourceEditable?'Exposure & colour before LUT · contrast & saturation after.':'Confirm a supported recording profile to adjust exposure and colour. Contrast & saturation remain available after a LUT.';
 for(const key of ['exposure','warmth','tint','contrast','saturation'])$(key).value=a[key];
 $('exposure-value').textContent=`${a.exposure>0?'+':''}${a.exposure.toFixed(2)} EV`;
 for(const key of ['warmth','tint'])$(key+'-value').textContent=`${a[key]>0?'+':''}${a[key]}`;
 $('contrast-value').textContent=`${Math.round(a.contrast*100)}%`;$('saturation-value').textContent=`${Math.round(a.saturation*100)}%`;
 $('contrast').disabled=!name;$('saturation').disabled=!name;
 $('adjust-bypass').setAttribute('aria-pressed',String(!a.enabled));$('adjust-bypass').textContent=a.enabled?'Bypass':'Enable';
 $('adjust-open').classList.toggle('edited',a.enabled&&hasAdjustment(a));
}
async function renderAdjustments(name,scene,version){
 const a={...sceneAdjustments(scene)},canvas=$('live-preview');
 if(!window.LUTSourceCurves.forProfile(byScene.get(scene)?.profile)){a.exposure=0;a.warmth=0;a.tint=0;}
 if(!a.enabled||!hasAdjustment(a)||(!name&&a.exposure===0&&a.warmth===0&&a.tint===0)){
  $('adjust-status').textContent=!a.enabled&&hasAdjustment(a)?'Bypassed · settings kept.':'';return false;
 }
 $('adjust-status').textContent='Preparing preview…';
 try{
  if(!liveRenderer)liveRenderer=new window.LUTPreviewRenderer(canvas);
  const done=await liveRenderer.render(byScene.get(scene),byName.get(name),{...a});
  if(!done||version!==renderVersion)return;
  if(!name){$('filename').textContent='No LUT · '+(byScene.get(scene)?.gamma||'Original');$('look-detail').textContent='Log image · source adjustments';}
  else $('look-detail').textContent+=' · adjusted';
  $('adjust-status').textContent=name?'Settings kept for this scene.':'Source adjustments · contrast and saturation need a LUT.';
  return true;
 }catch(error){if(version!==renderVersion)return; $('adjust-status').textContent=error.message;$('look-detail').textContent+=' · adjustments unavailable';return false;}
}
function showAdjustmentPanel(open){$('adjust-panel').hidden=!open;$('adjust-open').setAttribute('aria-expanded',String(open));$('adjust-open').setAttribute('aria-label',open?'Hide adjustments':'Show adjustments');$('adjust-open').title=(open?'Hide adjustments':'Show adjustments')+' (E)';if(open)updateAdjustmentControls();}
$('adjust-open').addEventListener('click',()=>showAdjustmentPanel($('adjust-panel').hidden));$('adjust-close').addEventListener('click',()=>showAdjustmentPanel(false));
for(const key of ['exposure','warmth','tint','contrast','saturation'])$(key).addEventListener('input',event=>{
 const a=sceneAdjustments();a[key]=Number(event.target.value);a.enabled=true;updateAdjustmentControls();save();cancelAnimationFrame(adjustFrame);adjustFrame=requestAnimationFrame(()=>render());
});
$('adjust-bypass').addEventListener('click',()=>{const a=sceneAdjustments();a.enabled=!a.enabled;render();});
$('auto-balance').addEventListener('click',async()=>{const button=$('auto-balance'),scene=state.scene;button.disabled=true;$('adjust-status').textContent='Estimating neutral balance…';try{if(!liveRenderer)liveRenderer=new window.LUTPreviewRenderer($('live-preview'));const balance=await liveRenderer.autoBalance(byScene.get(scene));if(scene!==state.scene)return;Object.assign(sceneAdjustments(),balance,{enabled:true});await render();$('adjust-status').textContent='Estimated balance · refine with the colour sliders.';}catch(error){$('adjust-status').textContent=error.message;}finally{updateAdjustmentControls();}});
$('adjust-reset').addEventListener('click',()=>{state.adjustments[state.scene]=cleanAdjustments();render();});
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('save-image').addEventListener('click',async()=>{
 const button=$('save-image');button.disabled=true;
 try{
  const snapshot=JSON.stringify([state.scene,state.selected,state.reference,state.comparing,sceneAdjustments()]);
  await render();
  if(snapshot!==JSON.stringify([state.scene,state.selected,state.reference,state.comparing,sceneAdjustments()]))throw new Error('Preview changed. Save again when ready.');
  if($('look-detail').textContent.includes('adjustments unavailable'))throw new Error('Adjustments could not render. Bypass them to save the original.');
  let canvas=$('live-preview');if(canvas.hidden){canvas=document.createElement('canvas');canvas.width=byScene.get(state.scene).preview_width||1280;canvas.height=byScene.get(state.scene).preview_height||720;canvas.getContext('2d').drawImage(preview,0,0,canvas.width,canvas.height);}
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Image could not be saved.');
  if(snapshot!==JSON.stringify([state.scene,state.selected,state.reference,state.comparing,sceneAdjustments()]))throw new Error('Preview changed. Save again when ready.');
  const name=state.comparing?state.reference:state.selected,a=sceneAdjustments();
  downloadBlob(blob,`${state.scene}_${name?byName.get(name).stem:'LOG'}${a.enabled&&hasAdjustment(a)?'_Adjusted':''}.png`);
  $('adjust-status').textContent='PNG saved · source image and LUT unchanged.';
 }catch(error){$('adjust-status').textContent=error.message;}finally{button.disabled=false;}
});
function isFullscreen(){return document.fullscreenElement===$('viewer')||$('viewer').classList.contains('expanded');}
function syncFullscreen(){const full=isFullscreen();$('fullscreen').setAttribute('aria-pressed',String(full));$('fullscreen').setAttribute('aria-label',full?'Exit fullscreen':'Enter fullscreen');$('fullscreen').title=full?'Exit fullscreen (M / Esc)':'Fullscreen (M)';$('fullscreen-icon').setAttribute('d',full?'M4 9h5V4M20 9h-5V4M9 20v-5H4M15 20v-5h5':'M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5');}
$('fullscreen').addEventListener('click',async()=>{
 const viewer=$('viewer');
 if(document.fullscreenElement===viewer){await document.exitFullscreen();}
 else if(viewer.classList.contains('expanded'))viewer.classList.remove('expanded');
 else{try{if(!viewer.requestFullscreen)throw new Error('Fullscreen unavailable');await viewer.requestFullscreen();}catch{viewer.classList.add('expanded');}}
 syncFullscreen();
});
document.addEventListener('fullscreenchange',syncFullscreen);
$('backup-settings').addEventListener('click',()=>{downloadBlob(new Blob([JSON.stringify({version:1,state},null,2)],{type:'application/json'}),'LUT_Explorer_Settings.json');$('backup-status').textContent='Settings backed up, including favourites and adjustments.';});
$('restore-settings').addEventListener('click',()=>$('settings-file').click());
$('settings-file').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 try{const saved=JSON.parse(await file.text());if(saved.version!==1||!saved.state||typeof saved.state!=='object')throw new Error('Choose a LUT Buddy settings backup.');
  try{localStorage.setItem('ellis-lut-explorer-before-import',JSON.stringify(state));}catch{}
  state.adjustments={};restorePreferences(saved.state);state.comparing=false;applyTheme();$('reference').value=state.reference;
  $('raw-thumb').src=imagePath('');for(const tile of tiles.querySelectorAll('.tile'))tile.querySelector('img').src=imagePath(canUseLut(tile.dataset.name)?tile.dataset.name:'');warmScene(state.scene);await render();$('backup-status').textContent='Settings restored.';
 }catch(error){$('backup-status').textContent=error.message;}finally{event.target.value='';}
});
function mergeSettings(base,local,remote){
 const result=JSON.parse(JSON.stringify(remote));
 const oldFav=new Set(base?.favourites||[]),newFav=new Set(local.favourites),remoteFav=new Set(remote.favourites||[]);
 for(const name of newFav)if(!oldFav.has(name))remoteFav.add(name);
 for(const name of oldFav)if(!newFav.has(name))remoteFav.delete(name);
 result.favourites=[...remoteFav];result.adjustments=result.adjustments||{};
 for(const [id,a] of Object.entries(local.adjustments||{}))if(JSON.stringify(a)!==JSON.stringify(base?.adjustments?.[id]))result.adjustments[id]=a;
 for(const key of ['scene','sceneCollection','sceneDevice','selectedLook','referenceLook','selected','reference','favouritesOnly','theme','cameraInfo','histogram','stripVisible','lutOrder'])if(local[key]!==base?.[key])result[key]=local[key];
 return result;
}
async function persistProject(){
 if(savingProject||!pendingPrefs)return;savingProject=true;
 try{
  while(pendingPrefs){
   const snapshot=pendingPrefs;pendingPrefs=null;
   const response=await fetch(`api/settings?project=${productBoot.projectId}`,{method:'POST',headers:{'Content-Type':'application/json','X-LUT-Token':productBoot.token},body:JSON.stringify({revision:projectRevision,state:snapshot})});
   const data=await response.json();
   if(response.status===409){
    pendingPrefs=mergeSettings(lastSharedState,pendingPrefs||snapshot,data.state);projectRevision=data.revision;lastSharedState=data.state;
    // Publish the merge before waiting for the retry. Otherwise the next gesture
    // can save stale favourites as deletions against the new shared revision.
    restorePreferences(pendingPrefs);applyTheme();refreshSceneAssets();render();continue;
   }
   if(!response.ok)throw new Error(data.error||'Project save unavailable');
   projectRevision=data.revision;lastSharedState=snapshot;
   if(pendingPrefs){restorePreferences(pendingPrefs);applyTheme();refreshSceneAssets();render();}
   else{restorePreferences(snapshot);applyTheme();refreshSceneAssets();updateControls();}
   if(!pendingPrefs){try{localStorage.removeItem(preferenceKey+'-pending');}catch{}$('save-status').textContent='';$('backup-status').textContent='Saved to this project folder.';}
  }
 }catch(error){$('save-status').textContent='Saved in this browser only · project save unavailable';$('backup-status').textContent=error.message;}
 finally{savingProject=false;}
}
function refreshSceneAssets(){$('raw-thumb').src=imagePath('');for(const tile of tiles.querySelectorAll('.tile'))tile.querySelector('img').src=imagePath(canUseLut(tile.dataset.name)?tile.dataset.name:'');warmScene(state.scene);}
async function loadProjectSettings(){
 if(loadingProject||savingProject)return;loadingProject=true;const startedRevision=projectRevision;
 try{
  const response=await fetch(`api/settings?project=${productBoot.projectId}`,{cache:'no-store'});if(!response.ok)throw new Error('Project save unavailable');const data=await response.json();
  // A save may have completed while the read was in flight. Its newer result wins.
  if(savingProject||projectRevision!==startedRevision)return;
  if(projectReady&&data.revision===projectRevision&&!pendingPrefs)return;
  projectRevision=data.revision;lastSharedState=data.state;
  let incoming=data.state;if(data.initial_import&&hadBrowserPreferences){incoming={...data.state,...state,favourites:[...new Set([...(data.state.favourites||[]),...state.favourites])],adjustments:{...(data.state.adjustments||{}),...state.adjustments}};}try{const cached=JSON.parse(localStorage.getItem(preferenceKey+'-pending'));if(cached?.state)incoming=data.state?mergeSettings(cached.base,cached.state,data.state):cached.state;}catch{}
  if(incoming){restorePreferences(incoming);applyTheme();$('reference').value=state.reference;refreshSceneAssets();}
  projectReady=true;await render();
 }catch{projectReady=false;$('backup-status').textContent='Project saving is unavailable. Keep this tab open and restart the local service.';}
 finally{loadingProject=false;}
}
function refreshSharedSettings(){if(!document.hidden&&!pendingPrefs&&!savingProject)loadProjectSettings();}
window.addEventListener('focus',refreshSharedSettings);
document.addEventListener('visibilitychange',refreshSharedSettings);
window.addEventListener('storage',event=>{if(event.key===preferenceKey||event.key===preferenceKey+'-pending')refreshSharedSettings();});
setInterval(refreshSharedSettings,5000);
const originalLevelCache=new Map(),levelScratch=document.createElement('canvas');
levelScratch.width=1280;levelScratch.height=720;
const levelContext=levelScratch.getContext('2d',{willReadFrequently:true});
let levelsJob=0,levelsTimer=0,displayedLevelsVersion=-1,lastLevelPlot=null;
function positionLevels(){
 const visible=state.histogram,box=$('levels'),button=$('histogram-toggle'),strip=$('camera-strip');box.hidden=!visible;
 button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Hide histogram':'Show histogram');button.title=(visible?'Hide histogram':'Show histogram')+' (H)';
 const inset=window.innerWidth<=700?20:24,base=state.stripVisible?$('lut-dock').offsetHeight+24:14;
 const stacked=visible&&!strip.hidden&&$('viewer').clientWidth<740;
 strip.style.right=(visible&&!stacked?inset+box.offsetWidth+20:inset)+'px';
 box.style.bottom=(base+(stacked?strip.offsetHeight+10:0))+'px';
 if(visible&&lastLevelPlot)window.LUTLevels.draw($('levels-plot'),lastLevelPlot.original,lastLevelPlot.output,state.theme==='light');
}
function invalidateLevels(){levelsJob++;clearTimeout(levelsTimer);lastLevelPlot=null;$('levels-plot').getContext('2d').clearRect(0,0,400,120);$('levels-status').textContent='Updating levels';}
function originalLevels(scene){
 const key=scene.id+'/'+scene.actual_seconds;
 if(!originalLevelCache.has(key))originalLevelCache.set(key,(async()=>{
  if(scene.clip||scene.raw_path){
   const path=scene.raw_path||`card_sources/${scene.id}_1280x720.rgb48le`;
   const response=await fetch(`${path}?frame=${scene.actual_seconds||0}`);if(!response.ok)throw new Error('Original LOG levels unavailable.');
   const values=new Uint16Array(await response.arrayBuffer());if(values.length!==(scene.preview_width||1280)*(scene.preview_height||720)*3)throw new Error('Original LOG dimensions do not match.');
   return window.LUTLevels.bins(values,3,65535);
  }
  const image=await loadImage(imagePath('',scene.id)),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,1280,720);
  return window.LUTLevels.bins(context.getImageData(0,0,1280,720).data);
 })().catch(error=>{originalLevelCache.delete(key);throw error;}));
 return originalLevelCache.get(key);
}
function updateLevels(){
 const job=++levelsJob;clearTimeout(levelsTimer);positionLevels();
 if($('levels').hidden||displayedLevelsVersion!==renderVersion)return;
 const scene=state.scene,name=state.comparing?state.reference:state.selected,version=renderVersion;
 $('levels-output-label').textContent=state.comparing?'Reference':name?'Output':'No LUT';
 $('levels').setAttribute('aria-busy','true');
 levelsTimer=setTimeout(async()=>{
  try{
   const original=await originalLevels(byScene.get(scene));
   const outputImage=$('live-preview').hidden?await loadImage(imagePath(name,scene)):$('live-preview');
   if(job!==levelsJob||version!==renderVersion||!state.histogram)return;
   levelContext.drawImage(outputImage,0,0,1280,720);
   const output=window.LUTLevels.bins(levelContext.getImageData(0,0,1280,720).data);
   lastLevelPlot={original,output};window.LUTLevels.draw($('levels-plot'),original,output,state.theme==='light');
   $('levels').setAttribute('aria-busy','false');$('levels-status').textContent=`LOG and ${label(name)} levels updated${$('live-preview').hidden?'':' with preview adjustments'}.`;
  }catch(error){if(job===levelsJob){$('levels').setAttribute('aria-busy','false');$('levels-status').textContent=error.message;$('levels-output-label').textContent='Unavailable';}}
 },40);
}
$('raw-thumb').src=imagePath('');
warmScene(state.scene);render();updateScrollButtons();
requestAnimationFrame(()=>allTiles.find(tile=>tile.dataset.name===state.selected)?.scrollIntoView({block:'nearest',inline:'nearest'}));
loadProjectSettings();
