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
