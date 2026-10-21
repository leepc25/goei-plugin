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
  await page.waitForSelector('.hq-places button');
  await page.click('[data-go=jaemtri]');
  await page.waitForSelector('[data-mission]');
  await page.click('[data-mission]');
  await page.click('[data-act=brief]');
  await page.waitForSelector('[data-act=deploy]');
  await page.click('[data-act=deploy]');
  await page.waitForFunction(() => window.__goeiEngine.world);
  const state = () =>
    page.evaluate(() => {
      const g = window.__goeiEngine;
      const w = g.world;
      if (!w) return { scene: g.sceneName ?? null };
      const p = w.player;
      const story = document.querySelector('.gst-box:not([hidden]), .gst-choices:not([hidden])');
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
  // 철수 → 본부 정산
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.getByText('철수', { exact: false }).first().click();
  const yes = page.getByText('예', { exact: true });
  if (await yes.count()) await yes.first().click();
  await page.waitForFunction(() => !window.__goeiEngine.world, null, { timeout: 15000 });
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
