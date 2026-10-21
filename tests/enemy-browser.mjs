// 적 시험장 Chromium 연기 시험 + PC·휴대폰 화면 사진. node scripts/build-enemy.mjs 뒤 실행.
// 사진: dist-test/shots/enemy-*.png
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const file = 'file://' + resolve('release/demo/goei-enemy-arena.html');
mkdirSync('dist-test/shots', { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];

async function shot(name, url, viewport, actions, opts = {}) {
  const page = await browser.newPage({ viewport, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(file + url);
  await page.waitForTimeout(300);
  await actions?.(page);
  await page.screenshot({ path: `dist-test/shots/enemy-${name}.png` });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(width <= viewport.width + 1, `${name}: 가로 넘침 ${width}`);
  const st = await page.evaluate(() => {
    const w = window.__arena;
    return { enemies: w.bodies.filter((b) => b.team === 'enemy').length, hp: w.player.hp, tick: w.tick };
  });
  await page.close();
  return st;
}

const hold = async (page, key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};

// PC: 로비 편성, 오른쪽으로 걸어가 3연타
const a = await shot('pc-lobby', '?floor=lobby&depth=6', { width: 1280, height: 950 }, async (p) => {
  await p.click('#boxes');
  await hold(p, 'ArrowRight', 900);
  for (let i = 0; i < 9; i++) (await p.keyboard.press('KeyA'), await p.waitForTimeout(90));
  await p.waitForTimeout(1500);
});
assert.ok(a.tick > 60, '틱이 돈다');
for (const [floor, wait] of [['chase', 2500], ['replica', 2500], ['dark', 2500], ['silent', 2500], ['puzzle', 2500], ['trial', 2500], ['b12', 2500]])
  await shot(`pc-guardian-${floor}`, `?floor=${floor}&spawn=guardian`, { width: 1280, height: 950 }, async (p) => {
    await p.click('#boxes');
    await hold(p, 'ArrowRight', 600);
    await p.waitForTimeout(wait);
  });
await shot('pc-guardian-lobby', '?floor=lobby&spawn=guardian', { width: 1280, height: 950 }, async (p) => {
  await hold(p, 'ArrowRight', 1500);
  await p.waitForTimeout(1200);
});
await shot('pc-picker', '?spawn=none', { width: 1280, height: 950 }, async (p) => {
  await p.click('#pick');
  await p.waitForTimeout(200);
});
// 휴대폰 가로·세로 (터치 버튼)
const m = await shot('phone-land', '?floor=replica&depth=5', { width: 844, height: 390 }, async (p) => {
  const btn = p.locator('.pad button[data-k="A"]');
  for (let i = 0; i < 6; i++) (await btn.tap(), await p.waitForTimeout(120));
  await p.waitForTimeout(1200);
}, { touch: true });
await shot('phone-port', '?floor=lobby&spawn=guardian', { width: 390, height: 844 }, async (p) => p.waitForTimeout(1500), { touch: true });
await browser.close();
assert.deepEqual(errors, [], errors.join('\n'));
console.log('ok', { a, m });
