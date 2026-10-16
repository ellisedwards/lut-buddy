'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{create}=require('../ui/split-state.js');
const available=['a','b','c','d'];
test('Split views start with one frame, add individually and focus duplicates without duplicating panes',()=>{
 const m=create(null,available,'a');assert.deepEqual(m.state.ids,['a']);m.add('b','look');m.add('c','other');assert.deepEqual(m.state.ids,['a','b','c']);assert.equal(m.state.family,'look');m.add('a','unused');assert.deepEqual(m.state.ids,['a','b','c']);assert.equal(m.state.active,'a');assert.equal(m.add('deleted','look'),false);
});
test('Expanding and returning preserve the group; keep-only and removal are recoverable view changes',()=>{
 const m=create(null,available,'a');m.add('b','look');m.add('c','look');m.focus('b');assert.equal(m.state.focused,true);assert.deepEqual(m.state.ids,['a','b','c']);m.group();assert.equal(m.state.focused,false);m.keep('b');assert.deepEqual(m.state.ids,['b']);assert.equal(m.state.family,'look');m.undo();assert.deepEqual(m.state.ids,['a','b','c']);assert.equal(m.state.active,'b');m.remove('b');assert.deepEqual(m.state.ids,['a','c']);assert.equal(m.state.active,'c');m.undo();assert.deepEqual(m.state.ids,['a','b','c']);assert.equal(m.state.active,'b');
});
test('Replacing an active pane does not lose its neighbours and Undo restores its position',()=>{
 const m=create({ids:['a','b','c'],active:'b',focused:true,family:'look'},available,'b');m.replace('b','d');assert.deepEqual(m.state.ids,['a','d','c']);assert.equal(m.state.focused,true);m.undo();assert.deepEqual(m.state.ids,['a','b','c']);assert.equal(m.state.active,'b');m.replace('b','c');assert.deepEqual(m.state.ids,['a','b','c']);assert.equal(m.state.active,'c');
});
test('Reload filters unavailable frames, preserves the layout and never removes the last pane',()=>{
 const m=create({ids:['a','a','removed','c'],active:'a',focused:true,family:'look'},available,'c');assert.deepEqual(m.state.ids,['a','c']);assert.equal(m.state.active,'c');assert.equal(m.state.focused,true);const next=create(m.snapshot(),['c'],'c');assert.deepEqual(next.state.ids,['c']);assert.equal(next.state.focused,false);next.remove('c');assert.deepEqual(next.state.ids,['c']);assert.equal(next.state.family,'look');assert.deepEqual(create({},available,'d').state.ids,['d']);
});

test('Duplicate creates a new pane of the same scene and unlinks without changing other looks',()=>{
 const m=create(null,available,'a');m.add('b','look');const copy=m.duplicate('a',{a:'warm',b:'cool'});assert.equal(m.scene(copy),'a');assert.deepEqual(m.state.ids,['a',copy,'b']);assert.equal(m.state.linked,false);assert.deepEqual(m.state.looks,{a:'warm',b:'cool',[copy]:'warm'});m.chooseLook('mono');assert.equal(m.state.looks.a,'warm');assert.equal(m.state.looks[copy],'mono');assert.equal(m.state.looks.b,'cool');
 m.focus(copy);m.group();assert.equal(m.state.active,copy);m.keep(copy);assert.equal(m.scene(m.state.active),'a');assert.equal(m.state.looks[copy],'mono');m.undo();assert.deepEqual(m.state.ids,['a',copy,'b']);assert.equal(m.state.looks[copy],'mono');
 const next=create(m.snapshot(),available,'a');assert.equal(next.state.active,copy);assert.equal(next.scene(copy),'a');assert.equal(next.state.looks[copy],'mono');assert.equal(next.state.linked,false);
});

test('Relinking uses the active look; unlinking retains the currently displayed looks and Undo restores differences',()=>{
 const m=create(null,available,'a'),copy=m.duplicate('a',{a:'warm'});m.chooseLook('mono');m.setLinked(true,{a:'warm',[copy]:'mono'});assert.equal(m.state.family,'mono');assert.equal(m.state.linked,true);m.undo();assert.equal(m.state.linked,false);assert.equal(m.state.looks.a,'warm');assert.equal(m.state.looks[copy],'mono');m.setLinked(true,{[copy]:'mono'});m.chooseLook('cool');m.setLinked(false,{a:'cool',[copy]:'cool'});assert.equal(m.state.looks.a,'cool');assert.equal(m.state.looks[copy],'cool');m.chooseLook('');assert.equal(m.state.looks[copy],'');assert.equal(m.state.looks.a,'cool');
});

test('Copies are view-only and reload removes copies whose source scene is unavailable',()=>{
 const m=create(null,available,'a'),copy=m.duplicate('a',{a:'warm'}),third=m.duplicate(copy,{a:'warm',[copy]:'mono'});assert.notEqual(copy,third);assert.equal(m.scene(third),'a');m.add('b','cool');const next=create(m.snapshot(),['b'],'b');assert.deepEqual(next.state.ids,['b']);assert.equal(next.state.looks.b,'cool');m.remove(copy);assert.ok(!m.state.ids.includes(copy));assert.equal(m.scene(third),'a');m.undo();assert.equal(m.scene(copy),'a');assert.equal(m.state.looks[copy],'warm');
});
