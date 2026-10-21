// npm run build 뒤 실행. 실제 Chromium에서 소리 시험실을 열고 모든 효과음·곡을 오프라인 렌더해 무음·깨짐을 검사한다.
// PLAYWRIGHT_MODULE / CHROMIUM_PATH 로 경로 지정 가능.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const errors = [];
for (const [w, h] of [[1280, 950], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(pathToFileURL(resolve('release/demo/goei-sound.html')).href);
  await page.click('#unlock');
  await page.waitForFunction(() => window.__audio.unlocked);
  // 가로 넘침 없음
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(over <= 0, `가로 넘침 ${over}px (${w})`);
  // 모든 층·연출·효과음 버튼을 눌러도 오류가 없다
  const n = await page.evaluate(async () => {
    const bs = [...document.querySelectorAll('button')].filter((b) => b.id !== 'unlock' && !b.textContent.includes('검사'));
    for (const b of bs) {
      b.click();
      await new Promise((r) => setTimeout(r, 15));
    }
    return bs.length;
  });
  assert.ok(n > 90, `버튼 ${n}개`);
  await page.waitForTimeout(1500);
  if (w === 1280) {
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/sound-pc.png` });
    const r = await page.evaluate(() => window.__checkAll());
    const bad = [...r.sfx, ...r.songs].filter((s) => s.nan || s.peak < 0.005 || s.peak > 1.2);
    console.log(`효과음 ${r.sfx.length}개, 곡 ${r.songs.length}개 렌더`);
    console.log('가장 큰 효과음', r.sfx.sort((a, b) => b.peak - a.peak).slice(0, 5).map((s) => `${s.id} ${s.peak}`).join(', '));
    console.log('가장 작은 효과음', r.sfx.slice(-5).map((s) => `${s.id} ${s.peak}`).join(', '));
    console.log('곡', r.songs.map((s) => `${s.id} 최대 ${s.peak} 평균 ${s.rms}`).join(' / '));
    assert.deepEqual(bad, []);
  } else if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/sound-m.png`, fullPage: false });
  await page.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log('소리 시험실 브라우저 시험 통과');
