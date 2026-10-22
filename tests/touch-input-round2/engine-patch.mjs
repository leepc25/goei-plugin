// Validate the integration patch in a disposable directory; protected engine source is never edited.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const file='src/game/action/engine/input.ts';
const scratch=await mkdtemp(join(tmpdir(),'goei-touch-input-round2-'));
const load=async(source)=>{
 const {outputFiles}=await build({stdin:{contents:source,loader:'ts'},format:'esm',write:false});
 return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
};
try {
 const source=await readFile(file,'utf8');
 const {Input:Before}=await load(source);
 const before=new Before();before.press('shift');before.clear();
 const stale=before.sample();
 assert.equal(stale.pressed.has('shift'),true,'baseline reproduces stale edge');
 assert.equal(stale.evade,true,'baseline reproduces cancellation becoming a dodge');
 await mkdir(join(scratch,'src/game/action/engine'),{recursive:true});
 await writeFile(join(scratch,file),source);
 const patch=resolve('tests/touch-input-round2/engine-input-reset.patch');
 execFileSync('git',['apply','--check',patch],{cwd:scratch,timeout:10000});
 execFileSync('git',['apply',patch],{cwd:scratch,timeout:10000});
 const {Input}=await load(await readFile(join(scratch,file),'utf8'));
 const input=new Input();input.press('shift');input.press('attack');input.clear();
 let p=input.sample();assert.equal(p.evade,false);assert.equal(p.pressed.size,0);assert.equal(p.released.size,0);assert.equal(p.held.size,0);
 input.press('right');input.sample();input.clear();input.press('right');p=input.sample();assert.equal(p.run,false,'cancelled tap cannot start a new dash');
 input.release('right');input.sample();input.press('shift');input.sample();input.release('shift');assert.equal(input.sample().evade,true,'ordinary short Shift still dodges');
 console.log('PASS baseline stale press/dodge reproduced; integration patch applies and cancels edges/history without breaking ordinary dodge');
} finally {await rm(scratch,{recursive:true,force:true});}
