// Real Web Audio, strict autoplay, no character assets. Output: /tmp/goei-audio-lifecycle-round2/.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const bundle = await build({ stdin: { contents: `export * from './src/game/action/audio/index'; export * from './src/game/action/audio/engine'; export * from './src/game/action/audio/music'; export * from './src/game/action/audio/videoTrack';`, resolveDir: process.cwd() }, bundle: true, format: 'iife', globalName: 'AudioTest', write: false });
const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(`<button id="start">Start</button><script>${bundle.outputFiles[0].text}</script>`); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });
const results = [];
async function check(name, fn) {
  if (process.env.AUDIO_CASE && !name.includes(process.env.AUDIO_CASE)) return;
  const page = await browser.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    window.contexts = [];
    window.connections = new Map();
    const connect = AudioNode.prototype.connect, disconnect = AudioNode.prototype.disconnect;
    AudioNode.prototype.connect = function(...args) { window.connections.set(this, true); return connect.apply(this, args); };
    AudioNode.prototype.disconnect = function(...args) { if (!args.length) window.connections.delete(this); return disconnect.apply(this, args); };
    const AC = window.AudioContext;
    window.AudioContext = class extends AC { constructor(...args) { super(...args); window.contexts.push(this); } };
    window.delay = ms => new Promise(r => setTimeout(r, ms));
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  try { const detail = await fn(page); assert.deepEqual(errors, []); results.push({ name, ok: true, detail }); }
  catch (error) { results.push({ name, ok: false, error: String(error), diagnostics: await page.evaluate(() => ({ needsButton: window.needsButton, media: window.mediaElements?.map(m => ({paused:m.paused, ready:m.readyState, error:m.error?.message})), activation: navigator.userActivation.hasBeenActive })) }); }
  finally { await page.close(); }
}
await check('first gesture unlocks once; latest pre-unlock music intent wins', async page => {
  await page.evaluate(() => { window.a = AudioTest.createGameAudio(); a.floor('title'); a.music(null); });
  assert.equal(await page.evaluate(() => contexts.length), 0);
  await page.click('#start');
  await page.waitForFunction(() => a.unlocked);
  assert.equal(await page.evaluate(() => a.song), null);
  await page.click('#start');
  assert.equal(await page.evaluate(() => contexts.length), 1);
});
await check('zero SFX volume also silences reverb', async page => {
  const peak = await page.evaluate(async () => {
    const c = new OfflineAudioContext(2, 44100 * 3, 44100), g = AudioTest.buildGraph(c, c.destination);
    g.gains.sfx.gain.value = 0;
    AudioTest.SFX.heal.fn(g.out, 0, { vol: 1, pan: 0, pitch: 1, dest: g.out.sfx });
    const b = await c.startRendering();
    return Math.max(...b.getChannelData(0).subarray(0, 100000).map(Math.abs));
  });
  assert.equal(peak, 0);
});
await check('jingle uses audio time while paused', async page => {
  await page.evaluate(() => { window.a = AudioTest.createGameAudio(); a.floor('hq'); });
  await page.click('#start'); await page.waitForFunction(() => a.unlocked);
  const length = await page.evaluate(() => { a.jingle('clear'); a.pause(); return AudioTest.compileSong(AudioTest.SONGS.clear).steps * AudioTest.stepSec(AudioTest.SONGS.clear.bpm); });
  await page.waitForTimeout((length + 1) * 1000);
  assert.equal(await page.evaluate(() => a.song), 'clear');
});
await check('repeated floor transitions release nodes', async page => {
  await page.evaluate(() => { window.a = AudioTest.createGameAudio(); });
  await page.click('#start'); await page.waitForFunction(() => a.unlocked);
  const counts = await page.evaluate(async () => {
    const before = connections.size;
    for (let i = 0; i < 12; i++) { a.floor(i % 2 ? 'hq' : 'lobby'); a.play('heal'); await delay(30); }
    a.floor(null); await delay(4500);
    return { before, after: connections.size };
  });
  assert.equal(counts.after, counts.before, JSON.stringify(counts));
  return counts;
});
await check('pause/visibility cannot be overridden by resume or a late unlock', async page => {
  await page.evaluate(() => { window.a = AudioTest.createGameAudio(); a.floor('hq'); });
  await page.click('#start'); await page.waitForFunction(() => a.unlocked);
  const result = await page.evaluate(async () => {
    const c = contexts[0];
    a.pause();
    const immediate = a.play('heal');
    await delay(100);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    a.resume(); await delay(100);
    const hidden = c.state;
    a.pause();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange')); await delay(100);
    const paused = c.state;
    a.resume(); await delay(100);
    return { immediate, hidden, paused, resumed: c.state };
  });
  assert.deepEqual(result, { immediate: false, hidden: 'suspended', paused: 'suspended', resumed: 'running' });
});
await check('autoplay denial retries on gesture; dispose handles pending resume', async page => {
  await page.evaluate(async () => {
    window.a = AudioTest.createGameAudio();
    await a.unlock();
    await contexts[0].suspend();
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function() { return Promise.reject(new DOMException('blocked', 'NotAllowedError')); };
    window.restoreResume = () => { AudioContext.prototype.resume = resume; };
  });
  assert.equal(await page.evaluate(() => a.unlock()), false);
  await page.evaluate(() => restoreResume());
  await page.click('#start'); await page.waitForFunction(() => a.unlocked);
  const result = await page.evaluate(async () => {
    a.pause(); await delay(100);
    const c = contexts[0];
    c.resume = () => new Promise(resolve => { window.finishResume = resolve; });
    const pending = a.unlock(); // still paused: no resume
    await pending;
    a.resume();
    a.dispose(); finishResume(); await delay(100);
    return { song: a.song, unlocked: a.unlocked, state: c.state };
  });
  assert.deepEqual(result, { song: null, unlocked: false, state: 'closed' });
});
await check('all bus returns obey zero volume; a stopped song has no wet send', async page => {
  const result = await page.evaluate(async () => {
    const peaks = {};
    for (const bus of ['sfx', 'music', 'amb', 'ui']) {
      const c = new OfflineAudioContext(2, 44100 * 3, 44100), g = AudioTest.buildGraph(c, c.destination);
      g.gains[bus].gain.value = 0;
      const o = AudioTest.busOut(g.out, bus);
      AudioTest.SFX.heal.fn(o, 0, { vol: 1, pan: 0, pitch: 1, dest: o[bus] });
      const b = await c.startRendering();
      peaks[bus] = b.getChannelData(0).reduce((m, n) => Math.max(m, Math.abs(n)), 0);
    }
    const c = new OfflineAudioContext(2, 44100 * 4, 44100), g = AudioTest.buildGraph(c, c.destination);
    const player = new AudioTest.Player(g.out, AudioTest.compileSong(AudioTest.SONGS.hq), 0.5);
    player.schedule(2); player.fadeOut(0, 0.1);
    const b = await c.startRendering();
    peaks.stoppedSong = b.getChannelData(0).reduce((m, n) => Math.max(m, Math.abs(n)), 0);
    return peaks;
  });
  assert.deepEqual(result, { sfx: 0, music: 0, amb: 0, ui: 0, stoppedSong: 0 });
});
await check('cutscene media: autoplay button retries play; volume, menu, hidden tab, skip cleanup', async page => {
  const setupMedia = () => {
    // Existing asset-free PCM fixture (silence): tests media lifecycle, not musical content.
    const bytes = new Uint8Array(44 + 8000 * 2 * 20), view = new DataView(bytes.buffer);
    const text = (offset, s) => [...s].forEach((c, i) => bytes[offset + i] = c.charCodeAt(0));
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVEfmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, bytes.length - 44, true);
    window.mediaURL = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    const Native = window.Audio;
    window.mediaElements = [];
    window.Audio = class extends Native { constructor(url) { super(url); mediaElements.push(this); } };
    window.a = AudioTest.createGameAudio();
    document.body.addEventListener(AudioTest.VIDEO_AUDIO_EVENT, e => a.attachMedia(e.detail));
    window.track = new AudioTest.VideoTrack(document.body, mediaURL, show => { window.needsButton = show; });
    document.querySelector('#start').onclick = () => track.enable(1);
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Runtime.evaluate', { expression: `(${setupMedia.toString()})()`, userGesture: false });
  await page.waitForFunction(() => window.needsButton === true);
  await page.click('#start');
  await page.waitForFunction(() => !mediaElements[0].paused && needsButton === false);
  const result = await page.evaluate(async () => {
    const m = mediaElements[0];
    a.setVolume('master', 0); const zero = m.volume;
    a.setVolume('master', 0.5); a.setVolume('sfx', 0.5); const scaled = m.volume;
    a.setCutscene(true); const cutVolume = m.volume;
    a.pause(); await delay(100); const paused = m.paused;
    a.resume(); await delay(100); const resumed = !m.paused;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange')); await delay(100); const hidden = m.paused;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange')); await delay(100);
    track.pause(); await delay(50); const buffering = m.paused;
    track.resume(2); await delay(100); const afterBuffer = !m.paused;
    track.dispose(); await delay(100);
    return { zero, scaled, cutVolume, paused, resumed, hidden, buffering, afterBuffer, ended: m.paused && !m.getAttribute('src') };
  });
  assert.deepEqual(result, { zero: 0, scaled: 0.0625, cutVolume: 0.0625, paused: true, resumed: true, hidden: true, buffering: true, afterBuffer: true, ended: true });
});
await check('dispose flushes the last volume change and catches async storage failure', async page => {
  const result = await page.evaluate(async () => {
    let writes = 0, saved;
    const a = AudioTest.createGameAudio({ save: json => { writes++; saved = JSON.parse(json); return Promise.reject(new Error('unavailable')); } });
    await a.ready;
    a.resume();
    a.setVolume('master', 0);
    a.dispose(); a.dispose();
    await delay(500);
    return { writes, master: saved.master, contexts: contexts.length };
  });
  assert.deepEqual(result, { writes: 1, master: 0, contexts: 0 });
});
await browser.close(); await new Promise(r => server.close(r));
mkdirSync('/tmp/goei-audio-lifecycle-round2', { recursive: true });
writeFileSync(`/tmp/goei-audio-lifecycle-round2/${process.env.BASELINE ? 'baseline' : 'results'}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
assert.ok(results.every(r => r.ok), 'audio lifecycle regressions');
