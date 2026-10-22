// Default: built dist HTML. STORY_LATEST_SOURCE=1 swaps only its module in memory.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let html = await readFile('dist/goei-action-game.html', 'utf8');
if (process.env.STORY_LATEST_SOURCE === '1') {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const result = await build({ entryPoints: ['src/game/action/engine/demo.ts'], bundle: true, format: 'esm', write: false, target: 'es2022', loader: { '.css': 'text' }, define: { __PLUGIN_VERSION__: JSON.stringify(pkg.version), __UPDATE_BASE__: JSON.stringify(pkg.goei.updateBase) } });
  html = html.replace(/<script type="module">[\s\S]*?<\/script>/, () => `<script type="module">${result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
}
const server = createServer((req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(html); }
  if (req.url.endsWith('index.json')) return res.end('["opening","first_day","first_entry"]');
  if (req.url.endsWith('timing.json')) return res.end('{"ms":[1000]}');
  if (req.url.endsWith('.png')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="gray"/></svg>');
  }
  res.writeHead(404).end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.setDefaultTimeout(15000);
await page.addInitScript(() => {
  // Invoke the real attract-mode callback without spending twenty seconds idle.
  const native = window.setTimeout;
  window.setTimeout = function(fn, ms, ...args) {
    const id = native(fn, ms, ...args);
    if (ms === 20000) window.startOpeningNow = () => { clearTimeout(id); fn(...args); };
    return id;
  };
});
const state = () => page.evaluate(() => ({
  blocking: __goeiStory.isBlocking(), video: __goeiStory.isVideoPlaying(), callbacks: oldCallbacks,
  menuHidden: document.querySelector('.gs-ui').style.visibility === 'hidden',
  overlayZ: document.querySelector('.gsy-video').parentElement.style.zIndex,
}));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => !!window.__goeiEngine && !!window.startOpeningNow);
  await page.evaluate(() => {
    window.oldCallbacks = 0;
    const cutscene = __goeiStory.cutscene;
    __goeiStory.cutscene = (id, done) => cutscene(id, () => { oldCallbacks++; done?.(); });
    startOpeningNow();
  });
  await page.waitForFunction(() => __goeiStory.isVideoPlaying() && document.querySelector('.gs-ui').style.visibility === 'hidden');
  await page.evaluate(() => __goeiEngine.toTitle());
  assert.deepEqual(await state(), { blocking: false, video: false, callbacks: 0, menuHidden: false, overlayZ: '15' });
  await page.getByText('새로 시작', { exact: true }).waitFor({ state: 'visible' });
  console.log('PASS active title opening → toTitle: no completion callback, blocking cleared, title menu restored');

  await page.evaluate(() => startOpeningNow());
  await page.waitForFunction(() => __goeiStory.isVideoPlaying());
  await page.evaluate(() => { __goeiStory.flags.cut_first_day = 1; __goeiEngine.start_new(); });
  await page.waitForFunction(() => __goeiEngine.inHub && !!__goeiEngine.world);
  assert.deepEqual(await state(), { blocking: false, video: false, callbacks: 0, menuHidden: false, overlayZ: '15' });
  console.log('PASS active title opening → new HQ world: no completion callback, overlay/menu policy restored');

  await page.evaluate(() => __goeiStory.cutscene('first_day'));
  await page.waitForFunction(() => __goeiStory.isVideoPlaying());
  await page.evaluate(() => { window.oldWorld = __goeiEngine.world; __goeiEngine.start_new(); });
  await page.waitForFunction(() => __goeiEngine.world !== oldWorld && __goeiEngine.inHub);
  assert.deepEqual(await state(), { blocking: false, video: false, callbacks: 0, menuHidden: false, overlayZ: '15' });
  console.log('PASS active HQ cutscene → replacement HQ: old scene cannot complete into the new world');

  await page.evaluate(() => { delete __goeiStory.flags.cut_first_day; __goeiEngine.start_new(); __goeiEngine.toTitle(); });
  await page.waitForTimeout(800);
  assert.deepEqual(await state(), { blocking: false, video: false, callbacks: 0, menuHidden: false, overlayZ: '15' });
  await page.getByText('새로 시작', { exact: true }).waitFor({ state: 'visible' });
  console.log('PASS new HQ → immediate title: delayed first_day callback cannot cover the title');
  await page.evaluate(() => __goeiEngine.destroy());
  assert.deepEqual(errors, []);
} finally { await browser.close(); await new Promise(r => server.close(r)); }
