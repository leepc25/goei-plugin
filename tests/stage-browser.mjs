// 차원 승강기 시연판 Chromium 연기 시험 + PC·폰 스크린샷. node scripts/build-stage.mjs 뒤 실행.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const out = process.env.SHOTS || '/tmp/stage-shots';
execSync(`mkdir -p ${out}`);
const url = pathToFileURL(resolve('release/demo/goei-elevator-stage.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
const go = (page, target) =>
  page.evaluate((t) => {
    const es = window.__es;
    es.stage.outing().pending = t;
    es.eng.api.finish('next');
  }, target);
const walk = async (page, ms, key = 'ArrowRight') => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};
try {
  for (const [name, vp, mobile] of [
    ['pc', { width: 1280, height: 950 }, false],
    ['m', { width: 390, height: 844 }, true],
    ['ml', { width: 844, height: 390 }, true],
  ]) {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url);
    await page.screenshot({ path: `${out}/${name}-0-start.png` });
    await page.click('[data-do=go]');
    await page.waitForTimeout(400);
    await walk(page, 1500);
    await page.screenshot({ path: `${out}/${name}-1-lobby.png` });
    const x = await page.evaluate(() => window.__es.eng.p.x);
    assert.ok(x > 400, `걸었다 ${x}`);
    await go(page, { to: 'car' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}-2-car.png` });
    for (const [i, type, sub] of [
      [3, 'chase', null],
      [4, 'dark', null],
      [5, 'silent', null],
      [6, 'puzzle', null],
      [7, 'replica', 'red'],
      [8, 'trial', null],
      [9, 'deep', null],
    ]) {
      await go(page, { to: 'floor', depth: type === 'deep' ? 15 : 3 + i, type, sub });
      await page.waitForTimeout(200);
      await walk(page, type === 'chase' ? 3500 : 1800);
      const title = await page.evaluate(() => window.__es.eng.plan.title);
      assert.ok(title.includes('·'), title);
      await page.screenshot({ path: `${out}/${name}-${i}-${type}.png` });
    }
    // 정비 구역 → 다락방
    await page.evaluate(() => {
      const es = window.__es;
      const o = es.stage.outing();
      o.depth = 6;
    });
    await page.evaluate(() => {
      const props = window.__es.eng.props;
      const sd = props.find((p) => p.kind === 'servicedoor' || p.kind === 'hatch');
      window.__es.eng.p.x = sd.x;
    });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
    let where = await page.evaluate(() => window.__es.eng.plan.stage.where);
    assert.equal(where, 'service');
    await page.screenshot({ path: `${out}/${name}-10-service.png` });
    await page.evaluate(() => {
      const o = window.__es.stage.outing();
      o.pending = { to: 'service', col: o.service.atticCell[0], row: o.service.atticCell[1], side: 'l' };
      window.__es.eng.api.finish('next');
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}-11-attic.png` });
    await page.evaluate(() => (window.__es.eng.p.x = window.__es.eng.props.find((p) => p.kind === 'rope').x));
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}-12-end.png` });
    assert.equal(await page.evaluate(() => window.__es.eng.ended), 'return');
    if (name === 'm') {
      // 터치 버튼으로도 움직이는가
      await page.click('[data-do=again]');
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => window.__es.eng.p.x);
      const box = await page.locator('.stick').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      // 세로 폰은 판이 90° 돌아가 있어 화면 아래쪽 = 판의 오른쪽
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 5);
      await page.waitForTimeout(800);
      await page.mouse.up();
      const after = await page.evaluate(() => window.__es.eng.p.x);
      assert.ok(after > before + 50, `스틱 ${before}→${after}`);
    }
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('ok', out);
} finally {
  await browser.close();
}
