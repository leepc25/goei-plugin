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
  // 저장이 없으면 이어하기가 없다
  assert.equal(await page.getByText('이어하기').count(), 0, '저장 없이 이어하기');
  // 시작 꼬리표로 허수아비 연습에서 조작 확인
  await page.goto(url + '?start=stage=dummy');
  await page.waitForFunction(() => window.__goeiEngine && window.__goeiEngine.world);
  await page.waitForTimeout(400);
  await S(page, 'pc-start');
  const s0 = await st(page);
  await hold(page, 'ArrowRight', 500);
  const s1 = await st(page);
  assert.ok(s1.x > s0.x + 60, `걷기 ${s0.x}→${s1.x}`);
  // 주인공 = 에일린 테스트룸 전투 (2026-10-25 사용자 지시). 키도 테스트룸: Z 약 · X 강 · A 원거리 · S 기술 · D 충전 · C 회피 · V 막기 · Space 점프
  const ei = (page) => page.evaluate(() => { const p = window.__goeiEngine.world.player; return { cls: !!p.core, mode: p.core?.P.mode, clip: p.core?.P.clip?.id ?? null, z: p.z, heat: p.core?.P.heat ?? 0, combo: p.maxCombo, hp: window.__goeiEngine.world.bodies.filter((b) => b.team === 'enemy').reduce((s, b) => s + b.hp, 0) }; });
  assert.ok((await ei(page)).cls, '주인공이 에일린');
  // 허수아비 쪽으로 가서 약 3연타 + 강
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__goeiEngine.world.player.x > 600, null, { timeout: 5000 });
  await page.keyboard.up('ArrowRight');
  const hp0 = (await ei(page)).hp;
  const seen = new Set();
  // 앞 동작이 끝나 이어 칠 수 있을 때(약 → 「이어 치기」 자세, 약3 → 서기) 다음 키를 누른다
  const ready = () => page.waitForFunction(() => { const P = window.__goeiEngine.world.player.core.P; return P.mode === 'chain' || P.mode === 'ground'; }, null, { timeout: 3000 });
  for (const k of ['KeyQ', 'KeyQ', 'KeyQ', 'KeyW']) { await ready(); await hold(page, k, 40); for (let i = 0; i < 3; i++) { await page.waitForTimeout(40); const c = (await ei(page)).clip; if (c) seen.add(c); } }
  await S(page, 'pc-combo');
  assert.ok(['9', '10', '11', '12'].every((c) => seen.has(c)), `약1·약2·약3·강 동작 (${[...seen]})`);
  assert.ok((await ei(page)).hp < hp0, '허수아비가 맞음');
  await page.waitForTimeout(700);
  // 원거리: 누르고 있으면 연사, 총열 열이 오른다
  await hold(page, 'KeyA', 500);
  assert.ok((await ei(page)).heat > 0, '원거리 사격 (총열 열)');
  await page.waitForTimeout(700);
  // 점프
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  assert.ok((await st(page)).z > 0, '점프');
  await page.waitForTimeout(900);
  // 회피(Shift 짧게)·방어(C)·기술(D)·충전(S)
  await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(60); await page.keyboard.up('ShiftLeft'); await page.waitForTimeout(80);
  assert.ok(['16', '16_1'].includes((await ei(page)).clip), '회피');
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyC'); await page.waitForTimeout(150);
  assert.equal((await ei(page)).mode, 'block', '막기');
  await page.keyboard.up('KeyC'); await page.waitForTimeout(400);
  await page.keyboard.press('KeyD'); await page.waitForTimeout(450);
  assert.equal((await ei(page)).clip, '22_1', '고유기술 제압사격');
  await page.waitForTimeout(1500);
  await page.keyboard.down('KeyS'); await page.waitForTimeout(700);
  assert.equal((await ei(page)).mode, 'charge', '충전');
  await page.keyboard.up('KeyS'); await page.waitForTimeout(250);
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
  // 본부 = 엔진 벨트 장면: 잼트리 자리 문 앞으로 가서 E
  await page.waitForFunction(() => window.__goeiEngine.inHub && window.__goeiEngine.world);
  await page.waitForTimeout(300);
  await S(page, 'pc-hq');
  // 자리 소품은 손이 닿을 때만 생긴다: 지도의 자리 좌표로 옮긴다
  await page.evaluate(() => { const w = window.__goeiEngine.world; const sp = w.stage.current().spots.find((q) => q.id === 'jaemtri'); w.player.x = sp.x; w.player.y = sp.y; });
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  // 자리 주인과 대화창이 먼저 열린다 (NPC 자유 대화). E 한 번 더 = 원래 창구
  // (본편 연결이 있으면 자리 주인 대화창이 먼저 뜬다: 그때만 E 한 번 더)
  await page.waitForSelector('.gnp:not([hidden]), [data-mission]', { state: 'visible' });
  if (await page.locator('.gnp:not([hidden])').count()) await page.keyboard.press('KeyE');
  await page.waitForSelector('[data-mission]', { state: 'visible' });
  await S(page, 'pc-hq-panel');
  await page.click('[data-mission]');
  await page.click('[data-act=brief]');
  await page.waitForSelector('[data-act=deploy]');
  await page.click('[data-act=deploy]');
  // 출동 준비 → B3 주차장 승합차 앞에서 E (사용자 2026-10-25)
  await page.waitForFunction(() => !document.querySelector('[data-act=deploy]'));
  await page.evaluate(() => window.__goeiEngine.world.stage.jump('b3', 370, 470));
  await page.waitForFunction(() => window.__goeiEngine.world?.floor?.id === 'hq:b3' && window.__goeiEngine.world.props.some((q) => q.id === 'spot:van'));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
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
  await m.goto(url + '?touch=1&start=stage=dummy');
  await m.waitForFunction(() => window.__goeiEngine && window.__goeiEngine.world);
  await m.waitForTimeout(500);
  await S(m, 'm-start');
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(sw <= 844, '가로 넘침');
} finally {
  await browser.close();
}
assert.deepEqual(errors, []);
console.log('engine-browser 통과');
