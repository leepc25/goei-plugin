// Consume the built HTML. No coordinate injection, source replacement, or build.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const html = await readFile('dist/goei-action-game.html');
const out = process.env.SHOTS || 'out/start-room';
await mkdir(out, { recursive: true });
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = [], errors = [];
try {
  for (const mobile of [false, true]) {
    const name = mobile ? 'touch' : 'pc';
    const page = await browser.newPage({ viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: mobile, isMobile: mobile });
    page.on('pageerror', error => errors.push({ name, error: String(error) }));
    const cdp = await page.context().newCDPSession(page);
    let finger;
    const send = async (type, x, y) => {
      if (type !== 'touchEnd') finger = { id: 1, x, y, radiusX: 2, radiusY: 2, force: 1 };
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [finger] });
      await page.waitForTimeout(35);
    };
    const walk = async (axis, value) => {
      const current = await page.evaluate(axis => __goeiEngine.world.player[axis], axis);
      if (Math.abs(current - value) <= 4) return;
      const sign = current < value ? 1 : -1;
      const key = axis === 'x' ? sign > 0 ? 'ArrowRight' : 'ArrowLeft' : sign > 0 ? 'ArrowDown' : 'ArrowUp';
      if (mobile) {
        await send('touchStart', 180, 240);
        await send('touchMove', 180 + (axis === 'x' ? sign * 24 : 0), 240 + (axis === 'y' ? sign * 24 : 0));
      } else await page.keyboard.down(key);
      try {
        await page.waitForFunction(({ axis, value, sign }) => sign * (__goeiEngine.world.player[axis] - value) >= 0, { axis, value, sign }, { timeout: 10000 });
      } finally {
        if (mobile) await send('touchEnd');
        else await page.keyboard.up(key);
      }
      await page.waitForTimeout(100);
    };
    const interact = async () => {
      if (!mobile) return page.keyboard.press('KeyE');
      const r = await page.locator('[data-id="interact"]').boundingBox();
      await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    };
    const state = () => page.evaluate(() => {
      const w = __goeiEngine.world;
      return { floor: w.floor.id, x: w.player.x, y: w.player.y, camX: w.camX, length: w.floor.length, lane: w.lane };
    });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/?start=hq${mobile ? '&touch=1' : ''}`);
      await page.waitForFunction(() => window.__goeiEngine?.world?.floor.id === 'hq:office' && !__goeiEngine.mods.blocking());
      await page.waitForTimeout(500);
      const initial = await state();
      assert.equal(initial.length, 1280); assert.equal(initial.camX, 0); assert.deepEqual(initial.lane, [430, 690]);
      assert.equal(initial.x, 820); assert.equal(initial.y, 620);
      await page.screenshot({ path: `${out}/${name}-initial.png` });

      await walk('x', 680); await walk('y', 470); await interact();
      await page.locator('.hq-talk[role="dialog"]').waitFor({ state: 'visible' });
      assert.ok(await page.locator('[data-mission]').count(), 'mission choices open from the real interaction');
      await page.screenshot({ path: `${out}/${name}-mission.png` });
      const close = page.locator('.hq-x[data-act="close"]:visible');
      if (mobile) await close.tap(); else await close.click();
      await page.waitForFunction(() => !__goeiEngine.mods.hq.isOpen());

      await walk('x', 1084); await walk('y', 446); await interact();
      await page.waitForFunction(() => __goeiEngine.world.floor.id === 'hq:f2');
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${out}/${name}-corridor.png` });
      await interact();
      await page.waitForFunction(() => __goeiEngine.world.floor.id === 'hq:office');
      await page.waitForTimeout(400);
      const returned = await state();
      assert.equal(returned.x, 1084); assert.equal(returned.y, 446); assert.equal(returned.camX, 0);

      await walk('x', 650); await walk('y', 430); await walk('x', 420);
      const behind = await state(); assert.equal(behind.y, 430);
      await page.screenshot({ path: `${out}/${name}-desk-behind.png` });
      // Go around the right side; do not move through the desk collision volume.
      await walk('x', 650); await walk('y', 620); await walk('x', 420);
      const front = await state(); assert.ok(front.y >= 620);
      await page.screenshot({ path: `${out}/${name}-desk-front.png` });
      results.push({ name, pass: true, initial, returned, behind, front });
      console.log(`PASS ${name}: mission UI, north-door round trip, real desk rear/front walking`);
    } catch (error) {
      await page.screenshot({ path: `${out}/${name}-failure.png` });
      results.push({ name, pass: false, state: await state(), error: String(error) });
      throw error;
    } finally { await page.close(); }
  }
  assert.deepEqual(errors, [], 'no uncaught page errors');
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
