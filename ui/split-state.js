(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LUTSplitState=api;})(globalThis,()=>{
 // Pane identity is separate from scene identity. Copies share media, not looks.
 function create(saved,available,current){
  const valid=new Set(available),sceneIds={},looks={};
  const ids=[...new Set(Array.isArray(saved?.ids)?saved.ids:[])].filter(id=>typeof id==='string'&&valid.has(saved?.sceneIds?.[id]||id));
  for(const id of ids){if(saved?.sceneIds?.[id])sceneIds[id]=saved.sceneIds[id];if(typeof saved?.looks?.[id]==='string')looks[id]=saved.looks[id];}
  if(!ids.length&&valid.has(current))ids.push(current);
  const savedActive=ids.includes(saved?.active)&&((sceneIds[saved.active]||saved.active)===current||!valid.has(current))?saved.active:null;
  const state={ids,sceneIds,looks,linked:saved?.linked!==false,active:savedActive||ids.find(id=>(sceneIds[id]||id)===current)||ids[0],focused:!!saved?.focused&&ids.length>1,family:typeof saved?.family==='string'?saved.family:null};
  const history=[],scene=id=>state.sceneIds[id]||id,snapshot=()=>({...state,ids:[...state.ids],sceneIds:{...state.sceneIds},looks:{...state.looks}});
  function remember(){history.push(snapshot());if(history.length>10)history.shift();}
  function activate(id){if(state.ids.includes(id))state.active=id;}
  function add(id,family){if(!valid.has(id))return false;const existing=state.ids.find(p=>scene(p)===id);if(existing){activate(existing);state.focused=false;return false;}remember();if(state.ids.length===1&&state.linked)state.family=family;if(!state.linked)state.looks[id]=family;state.ids.push(id);state.active=id;state.focused=false;return true;}
  function replace(target,id){if(!valid.has(id)||!state.ids.includes(target))return false;if(scene(target)===id)return false;const existing=state.ids.find(p=>scene(p)===id);if(existing){activate(existing);return false;}remember();const look=state.looks[target];state.ids[state.ids.indexOf(target)]=id;delete state.sceneIds[target];delete state.looks[target];if(look!==undefined)state.looks[id]=look;state.active=id;return true;}
  function duplicate(id,resolved={}){if(!state.ids.includes(id))return false;remember();for(const pane of state.ids)if(state.linked||!Object.hasOwn(state.looks,pane))state.looks[pane]=resolved[pane]??state.family??'';const source=scene(id);let n=2,key;do{key=source+'::view-'+n++;}while(state.ids.includes(key)||valid.has(key));state.sceneIds[key]=source;state.looks[key]=resolved[id]??state.looks[id]??state.family??'';state.linked=false;state.ids.splice(state.ids.indexOf(id)+1,0,key);state.active=key;state.focused=false;return key;}
  function setLinked(linked,resolved={}){if(linked===state.linked)return;remember();if(linked)state.family=resolved[state.active]??state.looks[state.active]??state.family??'';else for(const id of state.ids)state.looks[id]=resolved[id]??state.family??'';state.linked=linked;}
  function chooseLook(family){if(state.linked){const next=state.ids.length>1||state.family!==null?family:null,changed=next!==state.family;state.family=next;return changed;}const changed=state.looks[state.active]!==family;state.looks[state.active]=family;return changed;}
  function remove(id){if(state.ids.length<2||!state.ids.includes(id))return;remember();const index=state.ids.indexOf(id);state.ids.splice(index,1);delete state.sceneIds[id];delete state.looks[id];if(state.active===id)state.active=state.ids[Math.min(index,state.ids.length-1)];if(state.ids.length===1)state.focused=false;}
  function keep(id){if(!state.ids.includes(id)||state.ids.length<2)return;remember();state.ids=[id];state.sceneIds=state.sceneIds[id]?{[id]:state.sceneIds[id]}:{};state.looks=Object.hasOwn(state.looks,id)?{[id]:state.looks[id]}:{};state.active=id;state.focused=false;}
  function focus(id=state.active){activate(id);state.focused=state.ids.length>1;}
  function group(){state.focused=false;}
  function undo(){const previous=history.pop();if(previous)Object.assign(state,previous,{ids:previous.ids.filter(id=>valid.has(previous.sceneIds[id]||id))});}
  return {state,scene,snapshot,activate,add,replace,duplicate,setLinked,chooseLook,remove,keep,focus,group,undo,canUndo:()=>history.length>0};
 }
 return {create};
});
