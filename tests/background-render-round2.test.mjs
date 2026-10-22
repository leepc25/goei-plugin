// Asset lifecycle regression without a browser; real PNG headers and production drawing entrypoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/game/action/art/bg';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const bg = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const png = name => `data:image/png;base64,${readFileSync(`game-src/art/bg/dot/${name}.png`).toString('base64')}`;
const images = [];
globalThis.window = { __GOEI_BG_ART__: {} };
globalThis.Image = class {
  constructor() { images.push(this); this.complete = false; this.naturalWidth = 0; }
  load() { const b = Buffer.from(this.src.split(',')[1], 'base64'); this.width = this.naturalWidth = b.readUInt32BE(16); this.height = this.naturalHeight = b.readUInt32BE(20); this.complete = true; }
};
let draws = 0, patternCalls = 0;
const ctx = { canvas: { width:1280, height:720 }, getTransform: () => ({ a:1,b:0,c:0,d:1,e:0,f:0 }),
  save() {}, restore() {}, drawImage() { draws++; }, createPattern() { patternCalls++; return patternCalls === 1 ? null : { setTransform() {} }; } };

test('late pack, pending image, replacement source, offscreen return contract, and pattern retry', () => {
  const place = 'service', name = 'objects/service_objects_7';
  assert.equal(bg.propArtSize('merchant', ''), null);
  assert.equal(bg.drawPropArt(ctx, 'merchant', '', 300, 600), false);
  window.__GOEI_BG_ART__[place] = { [name]: png(`${place}/${name}`) };
  assert.ok(bg.propArtSize('merchant', ''));
  assert.equal(bg.drawPropArt(ctx, 'merchant', '', 300, 600), false);
  for (let i=0;i<10;i++) assert.equal(bg.drawPropArt(ctx, 'merchant', '', 300, 600), false);
  assert.equal(images.length, 1, 'loading frames share one decoder');
  images[0].load();
  assert.equal(bg.drawPropArt(ctx, 'merchant', '', 300, 600), true);
  assert.equal(draws, 1);
  assert.equal(bg.drawPropArt(ctx, 'merchant', '', -10000, 600), true, 'culled art must not request fallback drawing');
  assert.equal(draws, 1);
  const oldSize = bg.propArtSize('merchant', '');
  window.__GOEI_BG_ART__[place][name] = png('hq_office/objects/hq_office_objects_10');
  assert.notDeepEqual(bg.propArtSize('merchant', ''), oldSize);
  assert.equal(bg.drawPropArt(ctx, 'merchant', '', 300, 600), false, 'replacement is pending, not stale');
  images[1].load();
  assert.equal(bg.drawPropArt(ctx, 'merchant', '', 300, 600), true);
  window.__GOEI_BG_ART__.hq_clinic = { hq_clinic_floor: png('hq_clinic/hq_clinic_floor') };
  assert.equal(bg.floorPattern(ctx, 'hq_clinic'), null);
  images[2].load();
  assert.equal(bg.floorPattern(ctx, 'hq_clinic'), null);
  assert.ok(bg.floorPattern(ctx, 'hq_clinic'), 'createPattern null is retried');
  const ready = bg.floorPattern(ctx, 'hq_clinic');
  assert.equal(patternCalls, 2, 'ready patterns are reused');
  window.__GOEI_BG_ART__.hq_clinic.hq_clinic_floor = png('lobby/lobby_floor');
  assert.equal(bg.floorPattern(ctx, 'hq_clinic'), null);
  images[3].load();
  assert.notEqual(bg.floorPattern(ctx, 'hq_clinic'), ready, 'source replacement invalidates derived pattern');
});
