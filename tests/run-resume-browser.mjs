// 실제 본부 출동 → 새로고침 → 이어하기 → 구형 저장 이관 → 철수 정산.
// npm run build 후 GAME_URL=http://127.0.0.1:8766/dist/goei-action-game.html 로 실행.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const url = process.env.GAME_URL || pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const errors = [];
const journalKey = 'goei-session-journal:0';
const idle = async page => {
  // 영상은 자료를 읽은 뒤 열릴 수 있다. 월드 존재만으로 조작 가능 판정하지 않는다.
  await page.waitForTimeout(500);
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__goeiStory?.skip());
    await page.waitForTimeout(100);
    if (await page.evaluate(() => !window.__goeiEngine.mods.blocking())) return;
  }
  assert.equal(await page.evaluate(() => window.__goeiEngine.mods.blocking()), false, '대화·영상 종료');
};
const snapshot = page => page.evaluate(key => {
  const g = window.__goeiEngine, w = g.world, s = w.stage;
  const journal = JSON.parse(localStorage.getItem(key));
  return { seed: w.run.seed, stageId: w.run.stageId, runId: w.run.launch?.runId, floor: w.floor.id,
    hp: w.player.hp, reserve: w.player.reserve, outings: s.meta().outings,
    checkpoint: journal.checkpoint, hq: JSON.parse(journal.hq) };
}, journalKey);
try {
  for (const phone of [false, true]) {
    const context = await browser.newContext({ viewport: phone ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: phone, isMobile: phone });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url);
    await page.waitForFunction(() => window.__goeiEngine);
    await page.getByText('새로 시작', { exact: true }).click();
    await page.waitForFunction(() => window.__goeiEngine?.inHub);
    await page.evaluate(() => window.__goeiEngine.world.stage.goto('jaemtri'));
    await page.waitForFunction(() => window.__goeiEngine.world.props.some(p => p.id === 'spot:jaemtri'));
    await idle(page);
    await page.evaluate(() => { const w = window.__goeiEngine.world; w.player.x = w.props.find(p => p.id === 'spot:jaemtri').x; });
    await page.keyboard.press('KeyE');
    await page.waitForSelector('.gnp:not([hidden])');
    await page.keyboard.press('KeyE');
    await page.locator('[data-mission]').first().click();
    await page.locator('[data-act=brief]').click();
    await page.locator('[data-act=deploy]').click();
    await page.waitForFunction(() => window.__goeiEngine.world && !window.__goeiEngine.inHub);
    await idle(page);
    await page.evaluate(() => {
      const g = window.__goeiEngine; g.paused = true;
      g.world.player.hp = 137; g.world.player.reserve = 17;
      g.checkpoint(true);
    });
    const before = await snapshot(page);
    assert.equal(before.stageId, 'elevator');
    assert.equal(before.checkpoint.run.stageId, 'elevator', '기본 무대 ID도 저장');
    assert.equal(before.hq.active.runId, before.runId);
    assert.equal(JSON.parse(before.checkpoint.world).player.hp, 137);

    await page.reload();
    await page.waitForFunction(() => window.__goeiEngine);
    await page.getByText('이어하기', { exact: true }).click();
    await page.waitForFunction(() => window.__goeiEngine.world && !window.__goeiEngine.inHub);
    await page.evaluate(() => { window.__goeiEngine.paused = true; });
    const after = await snapshot(page);
    for (const key of ['seed', 'stageId', 'runId', 'floor', 'hp', 'reserve', 'outings']) assert.equal(after[key], before[key], key);
    assert.equal(after.hq.active.runId, before.runId, '본부 로딩이 중단 출동을 지우지 않음');
    await page.evaluate(() => { window.__goeiEngine.paused = false; });
    await idle(page);
    const x0 = await page.evaluate(() => window.__goeiEngine.world.player.x);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(x => window.__goeiEngine.world.player.x > x + 20, x0), '복원 후 실제 이동 가능');
    if (shots) await page.screenshot({ path: `${shots}/${phone ? 'phone' : 'pc'}-resumed.png` });

    // 초기 v1의 stageId 없는 저장을 실제 타이틀 버튼으로 복원한다.
    await page.evaluate(key => {
      window.__goeiEngine.toTitle();
      const data = JSON.parse(localStorage.getItem(key));
      delete data.checkpoint.run.stageId;
      data.revision = Date.now() + 5000;
      localStorage.setItem(key, JSON.stringify(data));
    }, journalKey);
    await page.reload();
    await page.waitForFunction(() => window.__goeiEngine);
    await page.getByText('이어하기', { exact: true }).click();
    await page.waitForFunction(() => window.__goeiEngine.world && !window.__goeiEngine.inHub);
    const migrated = await snapshot(page);
    assert.equal(migrated.stageId, 'elevator');
    assert.equal(migrated.runId, before.runId);
    assert.equal(migrated.outings, before.outings);

    await page.evaluate(() => { window.__goeiEngine.endRun('withdraw'); window.__goeiStory?.skip(); });
    await page.waitForFunction(() => window.__goeiEngine.inHub);
    await page.waitForFunction(key => {
      const s = JSON.parse(localStorage.getItem(key)); return s.checkpoint === null && !JSON.parse(s.hq).active;
    }, journalKey);
    const settled = await page.evaluate(key => JSON.parse(JSON.parse(localStorage.getItem(key)).hq), journalKey);
    assert.equal(settled.last.runId, before.runId);
    await page.reload(); await page.waitForFunction(() => window.__goeiEngine);
    await page.getByText('이어하기', { exact: true }).click();
    await page.waitForFunction(() => window.__goeiEngine.inHub);
    const settledAgain = await page.evaluate(key => JSON.parse(JSON.parse(localStorage.getItem(key)).hq), journalKey);
    assert.equal(settledAgain.day, settled.day, '정산된 출동은 재실행·중복 정산하지 않음');
    assert.equal(settledAgain.last.runId, before.runId);
    console.log(`${phone ? 'phone' : 'pc'}: 본부 출동·새로고침 복원·구형 저장·철수 정산·본부 복원 통과`, { seed: before.seed, runId: before.runId });
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
