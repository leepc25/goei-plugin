// Run from repository root. Outputs stay in this task's ignored evidence directory.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
const here = new URL('./', import.meta.url);
const evidence = new URL('evidence/', here);
await mkdir(evidence, { recursive: true });
await import('./build-review.mjs');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const fixture = await build({ stdin: {
  contents: `import {VideoPlayer} from './src/game/action/story/video';window.video=new VideoPlayer(document.body);`,
  resolveDir: process.cwd(),
}, bundle: true, format: 'iife', write: false, loader: { '.css': 'text' } });
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/review') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(await readFile(new URL('round2-review.html', here)));
    }
    if (req.url === '/fixture.js') {
      res.setHeader('Content-Type', 'text/javascript');
      return res.end(fixture.outputFiles[0].text);
    }
    if (req.url === '/baseline') return res.end('<body><script src="/fixture.js"></script>');
    if (/^\/original\/c[1-4]\/(timing\.json|\d{4}\.png)$/.test(req.url)) {
      res.setHeader('Content-Type', req.url.endsWith('.png') ? 'image/png' : 'application/json');
      return res.end(await readFile(`game-src/art/cutscene/frames/first_day/${req.url.slice('/original/'.length)}`));
    }
    res.writeHead(404).end();
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(origin + '/review');
  assert.match(await page.locator('#status').innerText(), /신규 프레임 0장/);
  assert.equal(await page.locator('button').isDisabled(), true);
  assert.equal(await page.locator('img,canvas,video').count(), 0, 'No substitute art in blocked review');
  await page.screenshot({ path: new URL('round2-review-pc.png', evidence).pathname, fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: new URL('round2-review-mobile.png', evidence).pathname, fullPage: true });
  await page.goto(origin + '/baseline');
  await page.evaluate(() => {
    window.draws = []; window.finished = 0;
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...args) {
      window.draws.push({ path: new URL(img.src).pathname, at: performance.now(), width: img.naturalWidth, height: img.naturalHeight });
      return original.call(this, img, ...args);
    };
    void window.video.play('/original/', [4, 4, 6, 4], [], () => { window.finished++; window.finishedAt = performance.now(); });
  });
  await page.waitForFunction(() => window.finished === 1, {}, { timeout: 25000 });
  const result = await page.evaluate(() => ({ draws: window.draws, finished: window.finished, finishedAt: window.finishedAt }));
  assert.deepEqual([...new Set(result.draws.map(d => d.path.split('/')[2]))], ['c1', 'c2', 'c3', 'c4']);
  assert.ok(result.draws.every(d => d.width === 640 && d.height === 360));
  const firstHoldMs = result.draws[1].at - result.draws[0].at;
  assert.ok(firstHoldMs >= 1550, 'Existing first hold is really displayed, not merely present in JSON');
  assert.deepEqual(errors, []);
  await writeFile(new URL('round2-baseline-playback.json', evidence), JSON.stringify({ ...result, firstHoldMs, errors }, null, 2) + '\n');
  console.log(`PASS original first_day c1–c4 playback; first hold ${Math.round(firstHoldMs)}ms; blocked review PC/mobile`);
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}

// Preserve the integration owner's regression test; change only its output filename in an ignored copy.
const regression = await readFile('tests/door-video-browser.mjs', 'utf8');
const originalShot = '/workspace/goei-hq-door-fixed.png';
assert.ok(regression.includes(originalShot), 'Check upstream test output location before copying');
const regressionPath = new URL('round2-door-video-regression.mjs', evidence);
await writeFile(regressionPath, regression.replace(originalShot, new URL('round2-hq-door-baseline.png', evidence).pathname));
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [regressionPath.pathname], { stdio: 'inherit' });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve() : reject(new Error(`Existing regression exited ${code}`)));
});
