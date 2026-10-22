// Source-only boundary regressions. No game build or character assets.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const bundle = await build({ stdin: { contents: `
export { mountStory, VIDEOS } from './src/game/action/story';
export { VideoPlayer } from './src/game/action/story/video';
`, resolveDir: process.cwd() }, bundle: true, format: 'iife', globalName: 'StoryTest', write: false, loader: { '.css': 'text' } });
const server = createServer((req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(`<body><script>${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`); }
  if (req.url.includes('/missing/')) return res.writeHead(404).end();
  if (req.url.endsWith('index.json')) return res.end('["first_day"]');
  if (req.url.endsWith('timing.json')) return res.end('{"ms":[1000]}');
  if (req.url.endsWith('.png')) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="gray"/></svg>');
  }
  res.writeHead(404).end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = [];
async function check(name, run) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  assert.deepEqual(errors, [], 'source fixture loads');
  await page.evaluate(() => {
    window.delay = ms => new Promise(r => setTimeout(r, ms));
    window.menu = false; window.done = 0;
    StoryTest.VIDEOS.first_day = { cuts: [0.15], subs: [] };
    window.story = StoryTest.mountStory(document.body, { getAgent: () => 'jyaldi', paused: () => menu, videoUrl: () => '/v/first_day/' });
    window.player = new StoryTest.VideoPlayer(document.body);
  });
  try { await run(page); assert.deepEqual(errors, []); results.push({ name, ok: true }); }
  catch (error) { results.push({ name, ok: false, error: String(error) }); }
  finally { await page.close(); }
}
try {
  await check('silent story clock respects a menu already open during load', async page => {
    const result = await page.evaluate(async () => {
      menu = true; story.cutscene('first_day', () => done++); story.update(0);
      await delay(400);
      const paused = { done, blocking: story.isBlocking(), video: story.isVideoPlaying() };
      menu = false; story.update(0); await delay(300);
      return { paused, resumed: { done, blocking: story.isBlocking() } };
    });
    assert.deepEqual(result, { paused: { done: 0, blocking: true, video: true }, resumed: { done: 1, blocking: false } });
  });
  await check('dispose cancels completion callbacks and cannot start another cutscene', async page => {
    const result = await page.evaluate(async () => {
      story.cutscene('first_day', () => { done++; story.cutscene('first_day'); });
      story.dispose(); await delay(50);
      return { done, blocking: story.isBlocking(), video: story.isVideoPlaying(), nodes: document.querySelectorAll('.gsy-video').length };
    });
    assert.deepEqual(result, { done: 0, blocking: false, video: false, nodes: 1 });
  });
  await check('replacement drops old completion instead of transitioning the previous world', async page => {
    const result = await page.evaluate(async () => {
      let old = 0, current = 0, ready;
      const pending = player.play('/v/', [0.15], [], () => old++, new Promise(r => ready = r));
      await player.play('/v/', [0.15], [], () => current++);
      ready(true); await pending; await delay(300);
      return { old, current, open: player.open };
    });
    assert.deepEqual(result, { old: 0, current: 1, open: false });
  });
  await check('rejected readiness ends once and releases blocking', async page => {
    const result = await page.evaluate(async () => {
      let rejected = false;
      try { await player.play('/v/', [0.15], [], () => done++, Promise.reject(new Error('asset listing unavailable'))); }
      catch { rejected = true; }
      return { rejected, done, open: player.open };
    });
    assert.deepEqual(result, { rejected: false, done: 1, open: false });
  });
  await check('fast repeated skip ignores a late asset response and completes only once', async page => {
    const result = await page.evaluate(async () => {
      let ready;
      const pending = player.play('/v/', [0.15], [], () => done++, new Promise(r => ready = r));
      player.finish(); player.finish(); ready(true); await pending; await delay(200);
      return { done, open: player.open };
    });
    assert.deepEqual(result, { done: 1, open: false });
  });
  await check('missing first cut completes without retaining the overlay', async page => {
    const result = await page.evaluate(async () => {
      await player.play('/missing/', [0.15], [], () => done++);
      return { done, open: player.open, hidden: player.el.hidden };
    });
    assert.deepEqual(result, { done: 1, open: false, hidden: true });
  });
  await check('world cancellation releases blocking and a later story can complete normally', async page => {
    const result = await page.evaluate(async () => {
      let old = 0;
      story.cutscene('first_day', () => old++);
      story.cancel(); story.cancel();
      const cancelled = { blocking: story.isBlocking(), video: story.isVideoPlaying() };
      story.cutscene('first_day', () => done++);
      await delay(350);
      return { old, done, cancelled, blocking: story.isBlocking() };
    });
    assert.deepEqual(result, { old: 0, done: 1, cancelled: { blocking: false, video: false }, blocking: false });
  });
} finally { await browser.close(); await new Promise(r => server.close(r)); }
console.log(JSON.stringify(results, null, 2));
assert.ok(results.every(r => r.ok), 'story video lifecycle regressions');
