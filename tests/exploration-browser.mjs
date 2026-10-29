// npm run build first. HTTP only. Fixtures replace the read-only map view, never game state.
// PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/usr/bin/chromium node tests/exploration-browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.GAME_URL || 'http://127.0.0.1:8765/dist/goei-action-game.html';
const shots = resolve(process.env.SHOTS || 'out/exploration-ui');
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  for (const [name, width, height, touch] of [['pc', 1280, 720, false], ['mobile', 844, 390, true], ['small-mobile', 667, 375, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    // Record canvas text per full-map frame for bounds and header/legend collision checks.
    await page.addInitScript(() => {
      const old = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (s, x, y, ...args) {
        if (String(s).startsWith('출동 지도')) window.mapText = [];
        if (window.mapText) {
          const width = this.measureText(s).width, size = parseFloat(this.font.match(/([\d.]+)px/)?.[1] || '0');
          window.mapText.push({ s, x: this.textAlign === 'right' ? x - width : this.textAlign === 'center' ? x - width / 2 : x, y, width, size });
        }
        return old.call(this, s, x, y, ...args);
      };
    });
    await page.goto(`${url}?start=stage=elevator${touch ? '&touch=1' : ''}`);
    await page.waitForFunction(() => window.__goeiEngine?.world?.stage.mapView?.());
    // Deterministic run for comparable screenshots; existing Jyaldi and real stage.
    await page.evaluate(() => window.__goeiEngine.deploy({ seed: 4242, agent: 'jyaldi', stageId: 'elevator' }));
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${shots}/${name}-minimap.png` });
    // 모바일 조작 설계(2026-10-28): 터치 「지도」 단추는 모바일에서 뺐다(PC 키 M 은 그대로). 지도는 키로 연다
    const toggle = async () => page.keyboard.press('KeyM'); // 에일린 키 배치: 지도 = M (Tab은 지원 요원)
    await toggle(); await page.waitForTimeout(150);
    if (touch) {
      assert.equal(await page.locator('[data-id="light"]').isVisible(), false, 'map hides combat controls');
      assert.equal(await page.locator('.tp-base').isVisible(), false, 'map hides joystick');
      assert.equal(await page.locator('[data-id="menu"]').isVisible(), true, 'map menu control remains');
    }
    const tick = await page.evaluate(() => window.__goeiEngine.world.tick);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => window.__goeiEngine.world.tick), tick, `${name}: map pauses simulation`);
    await page.screenshot({ path: `${shots}/${name}-map.png` });
    await toggle(); await page.waitForTimeout(180);
    if (touch) assert.equal(await page.locator('[data-id="light"]').isVisible(), true, 'closing map restores controls');
    assert.ok(await page.evaluate(() => window.__goeiEngine.world.tick) > tick, `${name}: map closes and resumes`);
    // Real service entrance: position at the actual prop, then send the gameplay interaction key.
    await page.evaluate(() => {
      const w = window.__goeiEngine.world;
      const door = w.props.find(p => p.kind === 'servicedoor' || p.kind === 'hatch');
      if (!door) throw new Error('service entrance missing');
      w.player.x = door.x; w.player.y = door.y ?? 560;
    });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__goeiEngine.world.stage.mapView().where === 'service');
    await toggle(); await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/${name}-service.png` });
    // Render-only fixture exercises max 7x5 density, all locks and both reward states.
    await page.evaluate(() => {
      const stage = window.__goeiEngine.world.stage;
      window.realMapView = stage.mapView;
      const rooms = [];
      for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) rooms.push({
        col, row, seen: row < 4, clear: row < 2, open: { l: col > 0, r: col < 6, u: row > 0, d: row < 4 }, wrap: {}, lock: {}, broken: {}, role: 'fight', key: null, panel: false, guardian: false, reward: null, name: `방 ${col + 1}-${row + 1}`,
      });
      rooms[0].role = 'arrival'; rooms[0].service = true;
      rooms[1].key = 2;
      rooms[2].reward = 'full'; rooms[3].reward = 'done';
      rooms[6].panel = true; rooms[6].guardian = true;
      rooms[7].role = 'secret'; rooms[7].reward = 'full';
      for (const [a, state, n] of [[8, 'locked', 2], [10, 'key', 1], [12, 'open', 3]]) {
        rooms[a].lock.r = { n, state }; rooms[a + 1].lock.l = { n, state };
      }
      rooms[14].wrap.l = true; rooms[14].open.l = true;
      const fixture = { where: 'floor', depth: 12, room: [3, 2], roomW: 2560, cell: null, worlds: [{ depth: 12, label: 'B-9 · 잠금·보상 표시 검수', cols: 7, rows: 5, rooms }], services: [], keys: ['①', '③'], upgrades: ['scout'], panelReady: false, goal: '열쇠 ①이 있다. 노란 잠금 앞에서 조사. 층 목표 해결 후 패널로 하강.', seed: 4242 };
      stage.mapView = () => structuredClone(fixture);
      window.mapFixture = fixture;
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/${name}-states.png` });
    const text = await page.evaluate(() => ({ items: window.mapText, w: document.querySelector('canvas').width, h: document.querySelector('canvas').height, scale: document.querySelector('canvas').getBoundingClientRect().width / document.querySelector('canvas').width }));
    for (const item of text.items) {
      assert.ok(item.x >= -1 && item.x + item.width <= text.w + 1 && item.y - item.size / 2 >= 0 && item.y + item.size / 2 <= text.h, `${name}: text outside canvas ${JSON.stringify(item)}`);
    }
    for (const phrase of ['보유 열쇠', '잠김 ·', '열쇠 보유', '보상 남음', '패널 꺼짐', '귀환:']) {
      const item = text.items.find(t => t.s.includes(phrase));
      assert.ok(item, `${name}: ${phrase}`);
      assert.ok(item.size * text.scale >= 12, `${name}: readable ${phrase}`);
    }
    const labels = text.items.filter(t => t.s.length > 4 && !t.s.startsWith('방 '));
    for (let i = 0; i < labels.length; i++) for (const b of labels.slice(i + 1)) {
      const a = labels[i];
      const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.abs(a.y - b.y) < (a.size + b.size) / 2;
      assert.ok(!overlap, `${name}: overlapping labels ${a.s} / ${b.s}`);
    }
    // Service fixture: discovered attic/rope, four-way connectors, frontier cells.
    await page.evaluate(() => {
      const m = window.mapFixture;
      m.where = 'service'; m.cell = [1, 1]; m.room = null;
      m.goal = '다락방 R에서 휴식·정보 송신. 로프를 조사하면 안전 귀환한다.';
      m.services = [{ depth: 12, cols: 4, rows: 4, hatchX: 600, shortcut: false, cells: Array.from({ length: 16 }, (_, i) => ({ col: i % 4, row: Math.floor(i / 4), seen: i < 12 || i === 15, key: i === 2, kind: i === 0 ? 'entry' : i === 10 ? 'attic' : i === 15 ? 'down' : 'plain', open: { l: i % 4 > 0, r: i % 4 < 3, u: i >= 4, d: i < 12 } })) }];
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${shots}/${name}-rope.png` });
    const serviceText = await page.evaluate(() => window.mapText);
    assert.ok(serviceText.some(t => t.s === '↑'), 'entry cell marks the upper hatch');
    assert.ok(serviceText.some(t => t.s === 'R'), 'attic marks the return rope');
    for (const item of serviceText) assert.ok(item.x >= -1 && item.x + item.width <= text.w + 1 && item.y + item.size / 2 <= text.h, `${name}: service text bounds ${item.s}`);
    console.log(`${name}: actual map pause/resume and service entry; dense map/rope fixtures; text bounds/readability/collisions passed`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
} finally { await browser.close(); }
