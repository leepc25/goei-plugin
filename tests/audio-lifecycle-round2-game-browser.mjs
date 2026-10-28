// Run against the normal source and current build; no integration patch is needed.
// AUDIO_VIDEO_ONLY=1 tests the actual VideoPlayer source without a game/demo build.
// Actual game controls for deploy/withdraw; room traversal is shortened with stage.goto.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const videoOnly = process.env.AUDIO_VIDEO_ONLY === '1';
const fixture = await build({ stdin: { contents: `
import { VideoPlayer } from './src/game/action/story/video';
import { createGameAudio } from './src/game/action/audio';
import { VIDEO_AUDIO_EVENT } from './src/game/action/audio/videoTrack';
window.a = createGameAudio(); a.floor('hq'); a.setCutscene(true);
document.body.addEventListener(VIDEO_AUDIO_EVENT, e => a.attachMedia(e.detail));
window.video = new VideoPlayer(document.body); window.finished = 0;
void video.play('/v/', location.pathname === '/buffer-test' ? [0.15, 2] : [2], [], () => finished++, Promise.resolve(true), true);
`, resolveDir: process.cwd() }, bundle: true, format: 'iife', write: false, loader: { '.css': 'text' } });
const wav = Buffer.alloc(44 + 8000 * 2 * 10);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
let releaseSecondCut;
const server = createServer(async (req, res) => {
  if (req.url === '/video-test' || req.url === '/buffer-test') return res.end(`<body><script>${fixture.outputFiles[0].text}</script>`);
  if (req.url === '/v/c2/timing.json') {
    releaseSecondCut = () => res.end(JSON.stringify({ ms: [2000] }));
    return;
  }
  if (req.url === '/v/c1/timing.json') return res.end(JSON.stringify({ ms: [2000] }));
  if (req.url === '/v/c1/0001.png' || req.url === '/v/c2/0001.png') {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="gray"/></svg>');
  }
  if (req.url === '/v/sound.ogg') { res.setHeader('Content-Type', 'audio/wav'); return res.end(wav); }
  if (req.url === '/sound') { res.setHeader('Content-Type', 'text/html'); return res.end(await readFile('release/demo/goei-sound.html')); }
  if (req.url !== '/') return res.writeHead(404).end();
  res.setHeader('Content-Type', 'text/html'); res.end(await readFile('dist/goei-action-game.html'));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.setDefaultTimeout(15000);
await page.addInitScript(() => {
  window.audioContexts = [];
  const AC = AudioContext;
  window.AudioContext = class extends AC { constructor(...args) { super(...args); audioContexts.push(this); } };
});
async function skipStory() {
  for (let i = 0; i < 6; i++) {
    for (const selector of ['.gsy-vskip', '.gsy-skip']) {
      const b = page.locator(selector); if (await b.isVisible()) await b.click();
    }
    await page.waitForTimeout(100);
  }
}
try {
  if (!videoOnly) {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => !!window.__goeiEngine);
  assert.equal(await page.evaluate(() => audioContexts.length), 0, 'no AudioContext before input');
  await page.getByText('새로 시작', { exact: true }).click();
  const runs = [];
  for (let i = 0; i < 4; i++) {
    await skipStory();
    await page.waitForFunction(() => window.__goeiEngine.inHub);
    await page.evaluate(() => window.__goeiEngine.world.stage.goto('jaemtri'));
    await page.waitForFunction(() => window.__goeiEngine.world.props.some(p => p.id === 'spot:jaemtri'));
    await page.evaluate(() => {
      const w = window.__goeiEngine.world;
      w.stage.onInteract(w.api, w.floor, w.props.find(p => p.id === 'spot:jaemtri'));
    });
    await page.locator('[data-mission="m1"]').click();
    await page.locator('[data-act="brief"]').click();
    await page.locator('[data-act="deploy"]').click();
    // 출동 준비 → B3 승합차 (사용자 2026-10-25)
    await page.evaluate(() => window.__goeiEngine.world.stage.jump('b3', 370, 470));
    await page.waitForFunction(() => window.__goeiEngine.world?.props.some((q) => q.id === 'spot:van'));
    await page.keyboard.press('KeyE');
    await skipStory();
    await page.waitForFunction(() => !window.__goeiEngine.inHub && audioContexts[0]?.state === 'running');
    runs.push(await page.evaluate(() => window.__goeiEngine.run.launch.runId));
    assert.equal(await page.evaluate(() => audioContexts.length), 1, 'one context across redeploys');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => audioContexts[0].state === 'suspended');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => audioContexts[0].state === 'running');
    await page.keyboard.press('Escape');
    await page.locator('.mn-btn').filter({ hasText: '출동 포기' }).click();
    await page.locator('.mn-btn').filter({ hasText: /^철수$/ }).click();
    await skipStory();
    await page.waitForSelector('.hq-result');
    await page.locator('.hq-over [data-act="close"]').first().click();
  }
  assert.equal(new Set(runs).size, 4);
  await mkdir('/tmp/goei-audio-lifecycle-round2', { recursive: true });
  await page.screenshot({ path: '/tmp/goei-audio-lifecycle-round2/game-redeploy.png' });
  await page.evaluate(() => window.__goeiEngine.destroy());
  await page.waitForFunction(() => audioContexts.every(c => c.state === 'closed'));
  assert.deepEqual(errors, []);
  console.log('PASS first input → HQ/deploy/withdraw ×4, pause/resume ×4, one context, destroy closes context');
  }
  const film = await browser.newPage();
  film.on('pageerror', e => errors.push(String(e)));
  await film.addInitScript(() => {
    const Native = Audio;
    window.media = [];
    window.Audio = class extends Native { constructor(url) { super(url); media.push(this); } };
  });
  await film.goto(`http://127.0.0.1:${server.address().port}/video-test`);
  await film.locator('.gsy-vsound').waitFor({ state: 'visible' });
  await film.locator('.gsy-vsound').click();
  await film.waitForFunction(() => !media[0].paused);
  await film.evaluate(() => a.pause());
  await film.waitForTimeout(2200);
  assert.equal(await film.evaluate(() => finished), 0, 'paused film does not finish while its audio is stopped');
  await film.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    a.resume();
  });
  await film.waitForTimeout(2200);
  assert.deepEqual(await film.evaluate(() => ({ finished, paused: media[0].paused })), { finished: 0, paused: true }, 'hidden film and audio stay paused even after menu resume');
  await film.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await film.evaluate(() => { a.setVolume('master', 0); a.resume(); });
  await film.waitForFunction(() => !media[0].paused && media[0].volume === 0);
  await film.locator('.gsy-vskip').click();
  assert.deepEqual(await film.evaluate(() => ({ finished, released: media[0].paused && !media[0].getAttribute('src') })), { finished: 1, released: true });
  console.log('PASS source VideoPlayer: real sound-enable click, pause/visibility clock, zero volume, skip releases media');
  await film.goto(`http://127.0.0.1:${server.address().port}/buffer-test`);
  await film.locator('.gsy-vsound').waitFor({ state: 'visible' });
  await film.locator('.gsy-vsound').click();
  await film.waitForFunction(() => !document.querySelector('.gsy-vloading').hidden && media[0].paused);
  await film.waitForTimeout(300);
  assert.equal(await film.evaluate(() => finished), 0, 'buffering keeps the film clock at the loaded cut');
  await film.evaluate(() => a.pause());
  assert.equal(typeof releaseSecondCut, 'function');
  releaseSecondCut();
  await film.waitForTimeout(100);
  assert.equal(await film.evaluate(() => media[0].paused), true, 'a loaded cut cannot override the menu pause');
  await film.evaluate(() => a.resume());
  await film.waitForFunction(() => document.querySelector('.gsy-vloading').hidden && !media[0].paused);
  await film.waitForFunction(() => finished === 1);
  assert.equal(await film.evaluate(() => media[0].paused && !media[0].getAttribute('src')), true);
  await film.close();
  console.log('PASS source VideoPlayer: pending cut holds audio/clock, resume respects menu pause, natural end releases media');
  for (const viewport of videoOnly ? [] : [{ width: 1280, height: 950 }, { width: 390, height: 844 }]) {
    const sound = await browser.newPage({ viewport });
    sound.on('pageerror', e => errors.push(String(e)));
    await sound.goto(`http://127.0.0.1:${server.address().port}/sound`);
    await sound.click('#unlock'); await sound.waitForFunction(() => window.__audio.unlocked);
    assert.ok(await sound.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const count = await sound.evaluate(async () => {
      const buttons = [...document.querySelectorAll('button')].filter(b => b.id !== 'unlock' && !b.textContent.includes('검사'));
      for (const b of buttons) { b.click(); await new Promise(r => setTimeout(r, 15)); }
      return buttons.length;
    });
    assert.ok(count > 90);
    if (viewport.width === 1280) {
      const r = await sound.evaluate(() => window.__checkAll());
      assert.deepEqual([...r.sfx, ...r.songs].filter(s => s.nan || s.peak < 0.005 || s.peak > 1.2), []);
      console.log(`PASS sound lab HTTP: ${r.sfx.length} SFX / ${r.songs.length} songs rendered`);
    }
    await sound.close();
  }
  assert.deepEqual(errors, []);

} finally { await browser.close(); await new Promise(r => server.close(r)); }
