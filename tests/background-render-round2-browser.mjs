// node tests/background-render-round2-browser.mjs (npm run build first).
// Outputs are isolated; no generated HTML or screenshots are committed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = 'out/background-render-round2';
mkdirSync(out, { recursive: true });
const pack = {};
for (const place of readdirSync('game-src/art/bg/dot')) for (const sub of ['', 'objects/']) {
  const dir = `game-src/art/bg/dot/${place}/${sub}`;
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.png'))) (pack[place] ??= {})[sub + f.slice(0, -4)] = `data:image/png;base64,${readFileSync(dir + f).toString('base64')}`;
}
const bundles = {};
for (const name of ['before', 'after']) {
  const result = await build({ stdin: { contents: `export * from './src/game/action/art/bg';`, resolveDir: process.cwd() }, bundle: true, format: 'iife', globalName: name, write: false,
    plugins: name === 'before' ? [{ name: 'baseline', setup(b) { b.onLoad({ filter: /\/art\/bg\.ts$/ }, args => ({ contents: execFileSync('git', ['show', '0d43a449:src/game/action/art/bg.ts'], { encoding: 'utf8' }), loader: 'ts', resolveDir: args.path.replace(/\/[^/]+$/, '') })); } }] : [] });
  bundles[name] = result.outputFiles[0].text;
}
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  if (req.url === '/fixture') return res.end(`<canvas id="c" width="1280" height="720"></canvas><script>window.__GOEI_BG_ART__=${JSON.stringify(pack)}</script><script>${bundles.before}</script><script>${bundles.after}</script>`);
  res.end(readFileSync('dist/goei-action-game.html'));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const errors = [], report = {};
try {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url + '/fixture');
  report.layers = await page.evaluate(async () => {
    const ctx = document.querySelector('canvas').getContext('2d', { willReadFrequently: true });
    const created = [];
    const NativeImage = Image;
    window.Image = class extends NativeImage { constructor() { super(); created.push(this); } };
    const cases = {
      exploration: (m) => { m.drawWallCell(ctx, 'lobby', '', 0, 6400, false, 440); m.drawFloor(ctx, 'lobby', 0, 6400, 440, 720); },
      pipes: m => m.drawPipeBundle(ctx, -3000, 3000, 400),
      lowRow: m => m.drawLowRow(ctx, -1500, 2500, 680, 7),
      props: m => { for (let x = -2400; x < 4000; x += 200) m.drawPropArt(ctx, 'desk_row', '', x, 580); },
      tonedFloor: m => { m.setFloorTone(3); m.drawFloor(ctx, 'lobby', -300, 3000, 440, 720); m.drawLedge(ctx, 'lobby', 100, 1800, 530, 630, 30); m.setFloorTone(0); },
      highSigns: m => { for (let x = -2400; x < 4000; x += 200) m.drawPropArt(ctx, 'sign', '읽어야', x, 580); },
    };
    const result = [];
    for (const [name, draw] of Object.entries(cases)) for (const transform of [[1,0,0,1,0,0], [1,0,0,1,-901.25,0], [.65,0,0,.65,-100,80], [-1,0,0,1,1280,0], [1,.08,.1,1,-100,10]]) {
      const camera = -transform[4];
      ctx.setTransform(...transform);
      for (let warm = 0; warm < 4; warm++) { draw(before); draw(after); await Promise.all(created.map(im => im.decode().catch(() => {}))); }
      const images = [], row = { name, camera, transform };
      for (const [label, m] of [['before', before], ['after', after]]) {
        ctx.resetTransform(); ctx.clearRect(0, 0, 1280, 720); ctx.setTransform(...transform);
        draw(m); images.push(ctx.getImageData(0, 0, 1280, 720).data);
        const counts = { drawImage: 0, fillRect: 0, createLinearGradient: 0, createPattern: 0 }, originals = {};
        for (const key of Object.keys(counts)) { originals[key] = ctx[key]; ctx[key] = function (...args) { counts[key]++; return originals[key].apply(this, args); }; }
        const initialImages = created.length, samples = [];
        for (let batch = 0; batch < 5; batch++) { const start = performance.now(); for (let i = 0; i < 100; i++) draw(m); samples.push((performance.now() - start) / 100); }
        for (const key of Object.keys(counts)) { ctx[key] = originals[key]; counts[key] /= 500; }
        row[label] = { ...counts, medianMs: samples.sort((a,b)=>a-b)[2], newImages: created.length - initialImages };
      }
      row.changedBytes = images[0].reduce((n, v, i) => n + (v !== images[1][i] ? 1 : 0), 0);
      result.push(row);
    }
    return result;
  });
  report.cache = await page.evaluate(async () => {
    const ctx = document.querySelector('canvas').getContext('2d'); ctx.resetTransform();
    const result = {};
    for (const [label, m] of [['before', before], ['after', after]]) {
      const saved = window.__GOEI_BG_ART__.service['objects/service_objects_7'];
      delete window.__GOEI_BG_ART__.service['objects/service_objects_7'];
      m.propArtSize('merchant', ''); m.drawPropArt(ctx, 'merchant', '', 300, 600);
      window.__GOEI_BG_ART__.service['objects/service_objects_7'] = saved;
      m.drawPropArt(ctx, 'merchant', '', 300, 600);
      await new Promise(r => setTimeout(r, 100));
      const lateImage = m.drawPropArt(ctx, 'merchant', '', 300, 600), lateSize = !!m.propArtSize('merchant', '');
      m.floorPattern(ctx, 'hq_clinic'); await new Promise(r => setTimeout(r, 100));
      const original = ctx.createPattern; let attempts = 0;
      ctx.createPattern = function (...args) { attempts++; return attempts === 1 ? null : original.apply(this, args); };
      m.floorPattern(ctx, 'hq_clinic');
      const patternRetry = !!m.floorPattern(ctx, 'hq_clinic'); ctx.createPattern = original;
      result[label] = { lateImage, lateSize, patternRetry };
    }
    return result;
  });
  // Real game: start office, walk through the first door, then deploy to an exploration room.
  await page.goto(url);
  await page.waitForFunction(() => window.__goeiEngine);
  await page.getByText('새로 시작', { exact: true }).click();
  await page.waitForTimeout(500); await page.evaluate(() => window.__goeiStory.skip());
  await page.waitForFunction(() => window.__goeiEngine.world?.floor.id === 'hq:office' && !window.__goeiEngine.mods.blocking());
  const measure = async name => {
    report[name] = await page.evaluate(() => {
      const w = window.__goeiEngine.world, c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      const ctx = c.getContext('2d'), calls = { drawImage: 0, fillRect: 0, createLinearGradient: 0 };
      ctx.translate(-w.camX, 0);
      for (const key of Object.keys(calls)) { const original = ctx[key]; ctx[key] = function (...args) { calls[key]++; return original.apply(this, args); }; }
      const start = performance.now(); for (let i = 0; i < 200; i++) w.floor.drawBackground(ctx, w.camX);
      return { id: w.floor.id, msPerBackground: (performance.now() - start) / 200, callsPerBackground: Object.fromEntries(Object.entries(calls).map(([k,v]) => [k,v/200])) };
    });
    await page.screenshot({ path: `${out}/${name}.png` });
  };
  await measure('office');
  const door = await page.evaluate(() => window.__goeiEngine.world.stage.current().doors.find(d => d.to));
  const walk = async (key, axis, value, sign) => { await page.keyboard.down(key); await page.waitForFunction(({axis,value,sign}) => sign * (window.__goeiEngine.world.player[axis]-value) >= 0, {axis,value,sign}, {timeout:20000}); await page.keyboard.up(key); };
  await walk('ArrowUp','y',486,-1); await walk('ArrowRight','x',door.x+78,1); await walk('ArrowDown','y',676,1); await walk('ArrowLeft','x',door.x+20,-1);
  await page.keyboard.press('KeyE'); await page.waitForFunction(() => window.__goeiEngine.world.floor.id === 'hq:f2');
  await measure('corridor');
  await page.evaluate(() => window.__goeiEngine.deploy({ seed:4242, agent:'jyaldi', stageId:'elevator' }));
  await page.waitForFunction(() => window.__goeiEngine.world.floor.type !== 'hq'); await page.waitForTimeout(500);
  await measure('exploration');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/${process.env.BASELINE ? 'baseline' : 'result'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!process.env.BASELINE) {
    for (const row of report.layers) { assert.equal(row.changedBytes, 0, `${row.name}: visible pixels unchanged`); assert.equal(row.after.newImages, 0); }
    assert.deepEqual(report.cache.after, { lateImage:true, lateSize:true, patternRetry:true });
    assert.equal(report.cache.before.lateImage, false, 'baseline reproduces missing asset lock');
    assert.ok(report.layers.find(r => r.name === 'props').after.drawImage < report.layers.find(r => r.name === 'props').before.drawImage);
  }
} finally { await browser.close(); await new Promise(r => server.close(r)); }
