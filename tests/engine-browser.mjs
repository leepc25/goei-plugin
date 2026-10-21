// 게임 엔진 시연판 Chromium 실입력 시험. npm run build 뒤 실행. SHOTS=폴더 를 주면 스크린샷을 남긴다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const shots = process.env.SHOTS;
const url = pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const errors = [];
const S = (page, name) => (shots ? page.screenshot({ path: `${shots}/${name}.png` }) : null);
const st = (page) => page.evaluate(() => { const g = window.__goeiEngine; const w = g.world; return w ? { x: w.player.x, y: w.player.y, z: w.player.z, hp: w.player.hp, state: w.player.state, ammo: w.player.ammo, kills: w.kills, enc: w.encActive, bodies: w.bodies.length, combo: w.player.maxCombo, ended: w.ended, tick: w.tick } : null; });
const hold = async (page, key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__goeiEngine);
  await page.waitForTimeout(400);
  await S(page, 'pc-title');
  // 제목 → 이어하기(허수아비 연습)에서 조작 확인
  await page.getByText('이어하기').click();
  await page.waitForFunction(() => window.__goeiEngine.world);
  await page.waitForTimeout(400);
  await S(page, 'pc-start');
  const s0 = await st(page);
  await hold(page, 'ArrowRight', 500);
  const s1 = await st(page);
  assert.ok(s1.x > s0.x + 60, `걷기 ${s0.x}→${s1.x}`);
  // 허수아비 쪽으로 가서 3연타
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__goeiEngine.world.player.x > 600, null, { timeout: 5000 });
  await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 12; i++) { await page.keyboard.press('KeyA'); await page.waitForTimeout(110); }
  await S(page, 'pc-combo');
  const s2 = await st(page);
  assert.ok(s2.combo >= 2, `콤보 ${s2.combo}`);
  // 판정 보기
  await page.keyboard.press('KeyH');
  await page.keyboard.press('KeyA');
  await page.waitForTimeout(120);
  await S(page, 'pc-hitbox');
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(900);
  // 사격
  await page.keyboard.press('KeyS');
  await page.waitForTimeout(500);
  const s3 = await st(page);
  assert.ok(s3.ammo < 8, '사격 후 탄 감소');
  // 점프·회피·앉기
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const s4 = await st(page);
  assert.ok(s4.z > 0, '점프');
  await page.waitForTimeout(700);
  await page.keyboard.down('ArrowLeft'); await page.keyboard.press('ShiftLeft'); await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(50);
  const s5 = await st(page);
  assert.equal(s5.state, 'evade');
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(70); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(200);
  assert.equal((await st(page)).state, 'crouch');
  await page.keyboard.press('KeyA'); await page.waitForTimeout(80);
  assert.equal((await st(page)).state, 'lowkick');
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(300);
  // 폭파
  await page.keyboard.press('KeyD'); await page.waitForTimeout(250);
  await S(page, 'pc-blast');
  // 메뉴 → 타이틀로 → 새로 시작(본부) → 잼트리 → 임무 → 출동
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await S(page, 'pc-pause');
  await page.getByText('타이틀로').click();
  await page.getByText('예', { exact: true }).click();
  await page.waitForFunction(() => !window.__goeiEngine.world);
  await page.getByText('새로 시작').click();
  await page.waitForSelector('.hq-places button');
  await S(page, 'pc-hq');
  await page.click('[data-go=jaemtri]');
  await page.waitForSelector('[data-mission]');
  await page.click('[data-mission]');
  await page.click('[data-act=brief]');
  await page.waitForSelector('[data-act=deploy]');
  await page.click('[data-act=deploy]');
  await page.waitForFunction(() => window.__goeiEngine.world);
  await page.waitForTimeout(300);
  // 자동 진행: 오른쪽으로 걸으며 계속 때림 (훈련장 끝까지)
  const t0 = Date.now();
  let last;
  await page.keyboard.down('ArrowRight');
  while (Date.now() - t0 < 60000) {
    last = await st(page);
    if (!last || last.ended || last.hp <= 0) break;
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(90);
    if (Math.random() < 0.15) { await page.keyboard.press('KeyD'); }
  }
  await page.keyboard.up('ArrowRight');
  await S(page, 'pc-late');
  console.log('진행', last);
  await page.waitForTimeout(800);
  await S(page, 'pc-end');
  if (last && last.ended) {
    await page.waitForTimeout(1500);
    await S(page, 'pc-settle');
  }
  // 모바일 가로
  const m = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  m.on('pageerror', (e) => errors.push(String(e)));
  await m.goto(url + '?touch=1');
  await m.waitForFunction(() => window.__goeiEngine);
  await m.waitForTimeout(300);
  const box = await m.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
  void box;
  await m.getByText('이어하기').click();
  await m.waitForFunction(() => window.__goeiEngine.world);
  await m.waitForTimeout(500);
  await S(m, 'm-start');
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= 844, '가로 넘침');
} finally {
  await browser.close();
}
assert.deepEqual(errors, []);
console.log('engine-browser 통과');
