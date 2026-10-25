// 통합판 한 바퀴 시험: 타이틀 → 새로 시작 → 본부 → 임무 → 출동 → 승강기 층 여러 개(적·대사) → 철수 → 본부 정산.
// 걷기는 순간 이동으로 줄이고, 누르기(E·A·Space)는 실제 키로 한다. npm run build 뒤 실행. SHOTS=폴더 면 스크린샷.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const shots = process.env.SHOTS;
const FLOORS = Number(process.env.FLOORS || 4);
const url = pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const errors = [];
const warns = new Set();
const log = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning' && m.text().includes('[goei]')) warns.add(m.text());
  });
  const S = (n) => (shots ? page.screenshot({ path: `${shots}/loop-${n}.png` }) : null);
  await page.goto(url);
  await page.waitForFunction(() => window.__goeiEngine);
  await page.getByText('새로 시작').click();
  // 본부(벨트 장면) → 잼트리 자리 문 앞에서 E
  await page.waitForFunction(() => window.__goeiEngine.inHub && window.__goeiEngine.world);
  await S('hq');
  // 자리 소품은 손이 닿을 때만 생긴다: 지도의 자리 좌표로 옮긴다
  await page.evaluate(() => { const w = window.__goeiEngine.world; const sp = w.stage.current().spots.find((q) => q.id === 'jaemtri'); w.player.x = sp.x; w.player.y = sp.y; });
  await page.waitForTimeout(100);
  await page.keyboard.press('KeyE');
  // 자리 주인과 대화창이 먼저 열린다 (NPC 자유 대화). E 한 번 더 = 원래 창구
  // (본편 연결이 있으면 자리 주인 대화창이 먼저 뜬다: 그때만 E 한 번 더)
  await page.waitForSelector('.gnp:not([hidden]), [data-mission]', { state: 'visible' });
  if (await page.locator('.gnp:not([hidden])').count()) await page.keyboard.press('KeyE');
  await page.waitForSelector('[data-mission]', { state: 'visible' });
  await page.click('[data-mission]');
  await page.click('[data-act=brief]');
  await page.waitForSelector('[data-act=deploy]');
  await page.click('[data-act=deploy]');
  // 출동 준비 → B3 주차장 승합차 앞에서 E (사용자 2026-10-25)
  await page.waitForFunction(() => !document.querySelector('[data-act=deploy]'));
  await page.evaluate(() => window.__goeiEngine.world.stage.jump('b3', 370, 444));
  await page.waitForFunction(() => window.__goeiEngine.world?.floor?.id === 'hq:b3' && window.__goeiEngine.world.props.some((q) => q.id === 'spot:van'));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__goeiEngine.world && !window.__goeiEngine.inHub);
  const state = () =>
    page.evaluate(() => {
      const g = window.__goeiEngine;
      const w = g.world;
      if (!w) return { scene: g.sceneName ?? null };
      const p = w.player;
      const story = document.querySelector('.gsy-box:not([hidden]), .gsy-choices:not([hidden])');
      return {
        floor: w.floor.id, title: w.floor.title, depth: w.floor.depth, floors: w.floors, x: p.x, len: w.floor.length,
        enemies: w.bodies.filter((b) => b.team === 'enemy' && b.alive && b.hp > 0).map((b) => ({ id: b.id, kind: b.kind, x: b.x, y: b.y, boss: !!b.boss })),
        props: w.props.map((q) => ({ id: q.id, kind: q.kind, x: q.x, y: q.y, label: q.label })),
        enc: w.encActive, ended: w.ended, blocking: !!story, kills: w.kills,
      };
    });
  const tp = (x, y) => page.evaluate(([x, y]) => { const p = window.__goeiEngine.world.player; p.x = x; if (y) p.y = y; p.hp = p.hpMax; p.vx = p.vy = 0; }, [x, y]);
  const seen = { floors: [], kinds: new Set(), bosses: new Set(), dialogs: 0 };
  let lastFloor = null;
  let fights = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    const s = await state();
    if (!s.floor) break;
    if (s.floor !== lastFloor) {
      lastFloor = s.floor;
      seen.floors.push(`${s.title}(${s.depth})`);
      await S(`floor${seen.floors.length}`);
      if (seen.floors.length > FLOORS * 2 + 1) break;
    }
    if (s.blocking) {
      seen.dialogs++;
      await page.keyboard.press('Digit1'); // 선택지면 첫째
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      continue;
    }
    for (const e of s.enemies) (seen.kinds.add(e.kind), e.boss && seen.bosses.add(e.kind));
    if (s.enemies.length) {
      const e = s.enemies[0];
      await tp(e.x - 80, e.y);
      await page.keyboard.press('KeyA');
      await page.waitForTimeout(110);
      if (++fights > 600) break;
      continue;
    }
    const depthCount = seen.floors.filter((f) => !f.startsWith('승강기')).length;
    const want = s.props.find((q) => q.kind === 'button' && q.id === 'btn0') ?? (depthCount < FLOORS ? s.props.find((q) => q.kind === 'panel') : null);
    if (!want) break;
    await tp(want.x, want.y > 480 ? want.y : undefined);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
  }
  const before = await state();
  log.push(['마지막', before.title, before.floors]);
  await S('last');
  // 철수 → 본부 정산 (열린 대화부터 닫기)
  for (let i = 0; i < 20 && (await state()).blocking; i++) {
    await page.keyboard.press('Digit1');
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await S('pause');
  await page.getByText('본부로 귀환').first().click();
  await page.getByText('귀환', { exact: true }).first().click();
  // 귀환 컷신을 넘기며 본부까지
  for (let i = 0; i < 80 && !(await page.evaluate(() => window.__goeiEngine.inHub)); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => window.__goeiEngine.inHub, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  await S('settle');
  const hqText = await page.evaluate(() => document.querySelector('.goei-engine-hq, .hq')?.innerText.slice(0, 400) ?? '');
  console.log(JSON.stringify({ floors: seen.floors, kinds: [...seen.kinds], bosses: [...seen.bosses], dialogs: seen.dialogs, warns: [...warns], log }, null, 1));
  console.log('본부 화면:', hqText.replace(/\s+/g, ' ').slice(0, 300));
  assert.ok(seen.floors.length >= 3, '층을 거의 못 지남');
  assert.deepEqual(errors, []);
  console.log('game-loop 통과');
} finally {
  await browser.close();
}
