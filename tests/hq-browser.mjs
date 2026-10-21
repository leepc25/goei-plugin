// 본부 시연판 Chromium 시험: 본부 → 잼트리 → 브리핑 → 출동 → 걷기·아이템·Esc 가방 → 후송 정산 → 다시 출동 → 다락방 철수 → 저장 유지.
// 먼저 node src/game/action/hq/build-demo.mjs. 스크린샷은 SHOTS 폴더(기본 /tmp)에.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const SHOTS = process.env.SHOTS || '/tmp';
const base = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(base, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(base + sep)) return res.writeHead(403).end();
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/release/demo/goei-hq.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  for (const vp of [{ name: 'pc', width: 1280, height: 950 }, { name: 'm', width: 390, height: 844, mobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${vp.name}: ${e}`));
    await page.goto(url);
    await page.waitForSelector('.hq-places button');
    await page.screenshot({ path: `${SHOTS}/hq-${vp.name}-0.png` });
    // 걸어서 잼트리 자리까지 (PC: 키보드)
    if (!vp.mobile) {
      await page.locator('.hq').focus();
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => window.__hq.state.x > 850);
      await page.keyboard.up('ArrowRight');
      await page.keyboard.press('KeyE');
    } else await page.click('[data-go=jaemtri]');
    await page.waitForSelector('[data-mission]');
    await page.screenshot({ path: `${SHOTS}/hq-${vp.name}-1-board.png` });
    await page.click('[data-act=brief]');
    await page.waitForSelector('[data-act=deploy]');
    await page.screenshot({ path: `${SHOTS}/hq-${vp.name}-2-brief.png` });
    await page.click('[data-act=deploy]');
    await page.waitForFunction(() => window.__run && window.__run.run.phase === 'floor');
    // 걷기 + 1번 아이템 (회복약, 칸에서 하나 줄어야 함)
    const n0 = await page.evaluate(() => window.__run.inv.items[0]?.n ?? 0);
    if (!vp.mobile) {
      await page.locator('.hq-run').focus();
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowRight');
      await page.keyboard.press('Digit1');
    } else await page.click('[data-item="0"]');
    assert.equal(await page.evaluate(() => window.__run.inv.items[0]?.n ?? 0), n0 - 1, '아이템 1 소모');
    await page.screenshot({ path: `${SHOTS}/hq-${vp.name}-3-run.png` });
    // Esc 가방
    if (!vp.mobile) await page.keyboard.press('Escape');
    else await page.click('.hq-run-top [data-r=menu]');
    await page.waitForSelector('.hq-runmenu');
    await page.screenshot({ path: `${SHOTS}/hq-${vp.name}-4-bag.png` });
    await page.click('[data-rm=close]');
    // 후송
    await page.evaluate(() => {
      window.__run.run.ended = 'evac';
    });
    await page.waitForSelector('.hq-over:not([hidden]) [data-act=close]');
    const t = await page.textContent('.hq-over');
    assert.match(t, /후송/);
    await page.screenshot({ path: `${SHOTS}/hq-${vp.name}-5-settle.png` });
    await page.click('.hq-over [data-act=close]');
    const day = await page.evaluate(() => window.__hq.state.day);
    assert.equal(day, 2);
    // 다시 출동 (부상이면 다른 요원) → 다락방에서 철수
    if (await page.evaluate(() => window.__hq.state.agents.jyaldi.injured > 0)) {
      await page.click('[data-go=office]');
      await page.click('[data-pick=eileen]');
    }
    await page.click('[data-go=jaemtri]');
    await page.click('[data-act=brief]');
    await page.click('[data-act=deploy]');
    await page.waitForFunction(() => window.__run && window.__run.run.phase === 'floor' && !window.__run.run.ended);
    await page.evaluate(() => {
      window.__run.run.phase = 'service';
    });
    await page.click('.hq-run-top [data-r=menu]');
    await page.click('[data-rm=withdraw]');
    await page.waitForSelector('.hq-over:not([hidden]) [data-act=close]');
    assert.match(await page.textContent('.hq-over'), /철수/);
    await page.click('.hq-over [data-act=close]');
    // 저장이 남는지: 다시 열기
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForSelector('.hq-places button');
    await page.waitForFunction(() => window.__hq.state.day === 3);
    // Esc 메뉴 · 수동 저장
    await page.click('[data-act=menu]');
    await page.click('[data-saveslot="1"]');
    await page.waitForSelector('[data-loadslot="1"]');
    await page.screenshot({ path: `${SHOTS}/hq-${vp.name}-6-menu.png`, fullPage: false });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `가로 넘침 ${over}`);
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('hq-browser ok');
} finally {
  await browser.close();
  server.close();
}
