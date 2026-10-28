// npm run build 후 실행. 실제 단일 HTML을 HTTP로 열어 쟈알디 출동/정산/이어하기 검증.
// PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/usr/bin/chromium node tests/hq-settlement-browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = await build({ stdin: { contents: `
import { createHq } from './src/game/action/hq/view';
import { newSave, saveText } from './src/game/action/hq/state';
import { launch } from './src/game/action/hq/logic';
import { emptyResult } from './src/game/action/hq/contract';
window.hqTest = { createHq, newSave, saveText, launch, emptyResult };`, resolveDir: process.cwd() }, bundle: true, format: 'iife', write: false, loader: { '.css': 'text' } });
const server = createServer(async (req, res) => {
  if (req.url === '/fixture') return res.end('<div id="fixture"></div><script src="/fixture.js"></script>');
  if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(fixture.outputFiles[0].text); }
  if (req.url !== '/') return res.writeHead(404).end();
  res.setHeader('Content-Type', 'text/html');
  res.end(await readFile('dist/goei-action-game.html'));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e)));
page.setDefaultTimeout(15000);
const snapshot = () => page.evaluate(() => {
  const session = JSON.parse(localStorage.getItem('goei-session-journal:0'));
  return { ...session, hq: JSON.parse(session.hq) };
});
async function skipStory() {
  for (let i = 0; i < 6; i++) {
    for (const selector of ['.gsy-vskip', '.gsy-skip']) {
      // 건너뛰기 단추는 영상 위에서 깜빡여 Playwright 의 「안정」 판정을 못 받는다: DOM 클릭으로
      await page.evaluate((sel) => { const b = document.querySelector(sel); if (b && b.offsetParent) b.click(); }, selector);
    }
    await page.waitForTimeout(100);
  }
}
async function deploy() {
  await skipStory();
  await page.waitForFunction(() => window.__goeiEngine?.inHub);
  await page.evaluate(() => window.__goeiEngine.world.stage.goto('jaemtri'));
  await page.waitForFunction(() => window.__goeiEngine.world.props.some(p => p.id === 'spot:jaemtri'));
  await page.evaluate(() => {
    const w = window.__goeiEngine.world;
    w.stage.onInteract(w.api, w.floor, w.props.find(p => p.id === 'spot:jaemtri'));
  });
  await page.locator('[data-mission="m1"]').click();
  if (await page.locator('[data-act="brief"]').isDisabled()) throw new Error(`브리핑 단추 비활성: ${(await page.locator('.goei-engine-hq').innerText()).replace(/\s+/g, ' ').slice(0, 400)}`);
  await page.locator('[data-act="brief"]').click();
  await page.locator('[data-act="deploy"]').click();
  // 출동 준비 → B3 주차장 승합차 앞에서 E (사용자 2026-10-25)
  await page.waitForFunction(() => !document.querySelector('[data-act=deploy]'));
  await page.evaluate(() => window.__goeiEngine.world.stage.jump('b3', 370, 470));
  await page.waitForFunction(() => window.__goeiEngine.world?.floor?.id === 'hq:b3' && window.__goeiEngine.world.props.some((q) => q.id === 'spot:van'));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await skipStory();
  await page.waitForFunction(() => window.__goeiEngine?.world && !window.__goeiEngine.inHub);
  const s = await snapshot();
  assert.equal(s.hq.active.agent, 'eileen'); // 주인공은 에일린 (engine/modules.ts runAgent)
  assert.equal(s.hq.active.runId, s.checkpoint.run.launch.runId);
  return s.hq.active.runId;
}
async function settlement(how, day) {
  // 정산은 귀환 영상보다 먼저 저널에 남아야 한다.
  await page.waitForFunction(({ how, day }) => {
    const raw = localStorage.getItem('goei-session-journal:0');
    if (!raw) return false;
    const session = JSON.parse(raw), hq = JSON.parse(session.hq);
    return hq.day === day && hq.last?.how === how && !hq.active && !session.checkpoint;
  }, { how, day });
  const s = await snapshot();
  await skipStory();
  await page.waitForSelector('.hq-result');
  await page.locator('.hq-over [data-act="close"]').first().click();
  return s;
}
try {
  // host.resuming이 없거나 false여도 본부 자체가 출동을 지우면 안 된다.
  await page.goto(`${url}/fixture`);
  const fixtureResult = await page.evaluate(async () => {
    const T = window.hqTest, outcomes = [];
    for (const resuming of [undefined, () => false, () => true]) {
      const state = T.newSave(), launch = T.launch(state, 'm1', 17), hq = T.createHq();
      let saved = '';
      hq.mount(document.getElementById('fixture'), { load: async () => T.saveText(state), save: async s => { saved = s; }, deploy() {}, resuming, rand: () => 0.9 }, { walk: false });
      await hq.ready();
      const active = hq.state.active?.runId;
      hq.onReturn({ ...T.emptyResult('return'), runId: 'wrong' }, launch);
      const unchanged = hq.state.day === 1 && !hq.isOpen();
      hq.openPlace('jaemtri');
      hq.unmount();
      outcomes.push({ active, unchanged, savedActive: JSON.parse(saved).active?.runId, expected: launch.runId });
    }
    return outcomes;
  });
  for (const f of fixtureResult) {
    assert.equal(f.active, f.expected);
    assert.equal(f.savedActive, f.expected);
    assert.equal(f.unchanged, true);
  }
  const earlyClose = await page.evaluate(async () => {
    const T = window.hqTest, hq = T.createHq(), state = T.newSave();
    T.launch(state, 'm1', 18);
    let finishLoad, writes = 0;
    hq.mount(document.getElementById('fixture'), {
      load: () => new Promise(resolve => { finishLoad = resolve; }),
      save: async () => { writes++; }, deploy() {},
    }, { walk: false });
    const loading = hq.ready();
    hq.unmount();
    finishLoad(T.saveText(state));
    await loading;
    return writes;
  });
  assert.equal(earlyClose, 0, '로딩 도중 닫아도 기본값으로 active 저장을 덮어쓰지 않는다');
  console.log('PASS 본부 mount: active 보존, 잘못된 결과 무시');
  await page.goto(url);
  await page.locator('.mn-btn').filter({ hasText: '새로 시작' }).click();
  const first = await deploy();
  // fixture로 L2와 다락방까지 이동을 단축하되 실제 점검문/로프 상호작용을 거친다.
  await page.evaluate(() => {
    const game = window.__goeiEngine, w = game.world, stage = w.stage, out = stage.outing();
    out.pending = { to: 'floor', depth: 2, type: 'lobby', sub: null };
    w.enterFloor(stage.nextFloor(game.run, w.floor, 'next'));
    out.found = ['greet', 'lobby'];
    const door = w.props.find(p => ['hatch', 'servicedoor'].includes(p.kind));
    if (!door) throw new Error('점검문 없음');
    stage.onInteract(w.api, w.floor, door);
    const [col, row] = out.service.atticCell;
    out.pending = { to: 'service', col, row, side: 'l' };
    w.enterFloor(stage.nextFloor(game.run, w.floor, 'next'));
    const rope = w.props.find(p => p.kind === 'rope');
    if (!rope) throw new Error('다락방 로프 없음');
    stage.onInteract(w.api, w.floor, rope);
    if (w.ended !== 'return') throw new Error('로프가 안전 귀환을 만들지 않음');
  });
  const returned = await settlement('return', 2);
  assert.equal(returned.hq.last.runId, first);
  assert.equal(returned.hq.last.result.missionDone, true);
  assert.ok(returned.hq.missionsDone.includes('m1'));
  assert.equal(returned.hq.loadout[0].n, 2);
  console.log('PASS 실제 로프 return → 성공 정산 → 재출동');
  const second = await deploy();
  assert.notEqual(second, first);
  // 새로고침 후 이어하기: 본부 active와 체크포인트 runId가 그대로 일치해야 한다.
  await page.reload();
  await page.waitForFunction(() => !!window.__goeiEngine);
  if (process.env.HQ_TEST_STAGE_ID_PATCH === '1') {
    // 통합 담당 최소 패치의 효과만 검증. 원본 코드/저장에는 적용하지 않는다.
    await page.evaluate(() => {
      const game = window.__goeiEngine, resume = game.resume.bind(game);
      game.resume = saved => resume({ ...saved, run: { ...saved.run, stageId: saved.run.stageId ?? 'elevator' } });
    });
    console.log('TEST-ONLY PATCH: resume 입력 run.stageId 기본값 elevator');
  }
  await page.locator('.mn-btn').filter({ hasText: '이어하기' }).click();
  await skipStory();
  await page.waitForFunction(() => window.__goeiEngine?.world && !window.__goeiEngine.inHub);
  assert.equal((await snapshot()).hq.active.runId, second);
  assert.equal(await page.evaluate(() => window.__goeiEngine.run.launch.runId), second);
  console.log('PASS 새로고침 이어하기: active/runId 유지');
  await page.keyboard.press('Escape');
  await page.locator('.mn-btn').filter({ hasText: '출동 포기' }).click();
  await page.locator('.mn-btn').filter({ hasText: /^철수$/ }).click();
  const withdrawn = await settlement('withdraw', 3);
  assert.equal(withdrawn.hq.last.result.missionDone, false);
  assert.equal(withdrawn.hq.loadout[0].n, 2);
  console.log('PASS 메뉴 포기 withdraw → 정산 → 재출동');
  await deploy();
  await page.evaluate(() => { const w = window.__goeiEngine.world; w.player.inv = 0; w.api.hurtPlayer(99999, true); });
  const evacuated = await settlement('evac', 4);
  assert.equal(evacuated.hq.last.result.missionDone, false);
  assert.deepEqual(evacuated.hq.loadout, [null, null, null, null]);
  // 부상이 생겼으면 기존 쟈알디를 의무실에서 치료한다.
  if (evacuated.hq.agents.jyaldi.injured) {
    await page.evaluate(() => window.__goeiEngine.world.stage.goto('clinic'));
    await page.waitForFunction(() => window.__goeiEngine.world.props.some(p => p.id === 'spot:clinic'));
    await page.evaluate(() => {
      const w = window.__goeiEngine.world;
      w.stage.onInteract(w.api, w.floor, w.props.find(p => p.id === 'spot:clinic'));
    });
    await page.locator('[data-treat="jyaldi"]').click();
    await page.locator('.hq-over [data-act="close"]').first().click();
  }
  await deploy();
  assert.equal((await snapshot()).hq.runs, 3);
  assert.deepEqual(errors, []);
  console.log('PASS 사망 evac → 정산 → 쟈알디 재출동; pageerror 0');
} catch (error) {
  await page.screenshot({ path: '/tmp/hq-settlement-failure.png' });
  console.error('CHECKPOINT', await page.evaluate(() => { const raw = localStorage.getItem('goei-session-journal:0'); if (!raw) return null; const s = JSON.parse(raw); return { stageId: s.checkpoint?.run.stageId ?? null, active: JSON.parse(s.hq).active }; }));
  console.error('PAGE', (await page.locator('body').innerText()).slice(-2000), errors);
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
