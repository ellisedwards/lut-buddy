(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LUTSplitState=api;})(globalThis,()=>{
 // View membership only. Removing a pane never removes a saved scene.
 function create(saved,available,current){
  const valid=new Set(available),ids=[...new Set(Array.isArray(saved?.ids)?saved.ids:[])].filter(id=>valid.has(id));
  if(!ids.length&&valid.has(current))ids.push(current);
  const state={ids,active:ids.includes(current)?current:ids.includes(saved?.active)?saved.active:ids[0],focused:!!saved?.focused&&ids.length>1,family:typeof saved?.family==='string'?saved.family:null};
  const history=[];const snapshot=()=>({...state,ids:[...state.ids]});
  function remember(){history.push(snapshot());if(history.length>10)history.shift();}
  function activate(id){if(state.ids.includes(id))state.active=id;}
  function add(id,family){if(!valid.has(id))return false;if(state.ids.includes(id)){activate(id);state.focused=false;return false;}remember();if(state.ids.length===1)state.family=family;state.ids.push(id);state.active=id;state.focused=false;return true;}
  function replace(target,id){if(!valid.has(id)||!state.ids.includes(target))return false;if(state.ids.includes(id)){activate(id);return false;}remember();state.ids[state.ids.indexOf(target)]=id;state.active=id;return true;}
  function remove(id){if(state.ids.length<2||!state.ids.includes(id))return;remember();const index=state.ids.indexOf(id);state.ids.splice(index,1);if(state.active===id)state.active=state.ids[Math.min(index,state.ids.length-1)];if(state.ids.length===1){state.focused=false;}}
  function keep(id){if(!state.ids.includes(id)||state.ids.length<2)return;remember();state.ids=[id];state.active=id;state.focused=false;}
  function focus(id=state.active){activate(id);state.focused=state.ids.length>1;}
  function group(){state.focused=false;}
  function undo(){const previous=history.pop();if(previous)Object.assign(state,previous,{ids:previous.ids.filter(id=>valid.has(id))});}
  return {state,snapshot,activate,add,replace,remove,keep,focus,group,undo,canUndo:()=>history.length>0};
 }
 return {create};
});
