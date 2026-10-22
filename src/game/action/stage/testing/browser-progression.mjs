// npm run build 후 실행. 실제 HTML의 World 입력 경로로 퍼즐·열쇠 선택을 검증한다.
// 전투 균형 시험이 아닌 장치 시험: 해당 방을 직접 로드하고 입력 사이에는 일시정지한다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const html = await readFile(resolve('dist/goei-action-game.html'));
const server = createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(process.env.STAGE_TEST_URL || `http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__goeiEngine);
  const result = await page.evaluate(() => {
    const g = window.__goeiEngine;
    function room(seed, type, depth, cell) {
      g.deploy({ seed, agent: 'jyaldi', stageId: 'elevator' });
      g.paused = true;
      const w = g.world, stage = w.stage;
      stage.outing().pending = { to: 'floor', depth, type, sub: null, room: cell };
      w.enterFloor(stage.nextFloor(g.run, w.floor, 'next'));
      w.paused = false;
      return w;
    }
    function press(w, prop) {
      w.player.x = w.player.px = prop.x;
      w.player.y = prop.y;
      w.player.stop = 0;
      w.player.hp = w.player.hpMax;
      w.step({ mx: 0, my: 0, evade: false, run: false, downDouble: false, held: new Set(), pressed: new Set(['interact']), released: new Set() });
    }
    const w = room(270, 'puzzle', 4, [1, 2]);
    const f = w.floor.stage.floor;
    const sh = f.placed.find(p => p.kind === 'shutter' && p.data.group !== undefined);
    const states = [];
    for (const n of [2, 1, 3, 2]) {
      const s = f.placed.find(p => p.kind === 'switch' && p.data.group === sh.data.group && p.data.n === n);
      press(w, w.props.find(p => p.id === `p${s.id}`));
      states.push(w.props.find(p => p.id === `p${sh.id}`).solid);
    }
    // seed 24의 침묵 층: 수정 전 계단과 열쇠가 x=768을 공유해 E가 계단을 탔다.
    const k = room(24, 'silent', 4, [0, 1]);
    const key = k.props.find(p => p.kind === 'key');
    const keyX = key.x;
    press(k, key);
    return { order: sh.data.order, states, keys: k.stage.outing().wkeys, keyX, where: k.floor.id };
  });
  assert.equal(result.order, '1-3-2');
  assert.deepEqual(result.states, [true, true, true, false]);
  assert.ok(result.keys.includes('4:1'), JSON.stringify(result));
  assert.deepEqual(errors, []);
  console.log('Chromium progression', JSON.stringify(result));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
