import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
// Dedicated in-memory bundle: never overwrite another task's dist-test output.
const { outputFiles } = await build({stdin:{contents:`export { InputHub } from './src/game/action/ui/input'; export { PadReader } from './src/game/action/ui/gamepad'; export { Input } from './src/game/action/engine/input';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const { InputHub, PadReader, Input } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('input cancellation discards unsampled attack and Shift without firing a dodge',()=>{
 const input=new Input();input.press('shift');input.press('attack');input.clear();
 const p=input.sample();assert.equal(p.evade,false);assert.equal(p.pressed.size,0);assert.equal(p.released.size,0);assert.equal(p.held.size,0);
});
test('input cancellation clears dash/crouch double-tap history',()=>{
 for(const direction of ['right','down']){
  const input=new Input();input.press(direction);input.sample();input.clear();input.press(direction);
  const p=input.sample();assert.equal(p.run,false);assert.equal(p.downDouble,false);assert.equal(p.pressed.has(direction),true);
 }
});
test('normal short Shift release still dodges after input cancellation',()=>{
 const input=new Input();input.press('shift');input.sample();input.clear();assert.equal(input.sample().evade,false);
 input.press('shift');input.sample();input.release('shift');assert.equal(input.sample().evade,true);
});

test('pad replacement with fewer buttons releases old held actions',()=>{
 const hub=new InputHub(), reader=new PadReader(hub);
 let pad={id:'full',index:0,connected:true,axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===2,value:i===2?1:0}))};
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[pad]}});
 try {
  reader.poll(); assert.equal(hub.held('KeyA'),true);
  pad={...pad,id:'short',index:1,buttons:[]}; reader.poll(); assert.equal(hub.held('KeyA'),false);
  pad=null;reader.poll();assert.deepEqual(hub.axis(),{x:0,y:0});
 } finally {if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
