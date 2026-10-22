// Validate the integrated engine source; do not re-apply the historical handoff patch.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const source=await readFile('src/game/action/engine/input.ts','utf8');
const {outputFiles}=await build({stdin:{contents:source,loader:'ts'},format:'esm',write:false});
const {Input}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const input=new Input();input.press('shift');input.press('attack');input.clear();
let p=input.sample();assert.equal(p.evade,false);assert.equal(p.pressed.size,0);assert.equal(p.released.size,0);assert.equal(p.held.size,0);
input.press('right');input.sample();input.clear();input.press('right');p=input.sample();assert.equal(p.run,false,'cancelled tap cannot start a new dash');
input.release('right');input.sample();input.press('shift');input.sample();input.release('shift');assert.equal(input.sample().evade,true,'ordinary short Shift still dodges');
console.log('PASS integrated Input.clear cancels edges/history without breaking ordinary dodge');
