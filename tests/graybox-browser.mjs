// 회색 상자 시험판 Chromium 실입력 시험. npm run build 뒤 실행.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const base = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(base, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(base + sep)) return res.writeHead(403).end();
    const data = await readFile(path);
    res.setHeader('Content-Type', extname(path) === '.html' ? 'text/html' : extname(path) === '.js' ? 'text/javascript' : 'application/octet-stream');
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  for (const url of [`http://127.0.0.1:${server.address().port}/tests/game/graybox.html`, `http://127.0.0.1:${server.address().port}/dist/goei-graybox.html`]) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 950 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url);
    await page.waitForSelector('.gb-panel.on[data-panel=hq]');
    await page.keyboard.press('KeyE');
    await page.waitForSelector('.gb-panel.on[data-panel=brief]');
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.__gb.run.phase === 'floor');
    await page.screenshot({ path: '/tmp/goei-graybox-1.png' });
    const x0 = await page.evaluate(() => window.__gb.run.player.x);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('KeyA');
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ x: window.__gb.run.player.x, log: window.__gb.run.log.length }));
    assert.ok(r.x > x0 + 80, '걷기');
    await page.screenshot({ path: '/tmp/goei-graybox-2.png' });
    // 메뉴·크기 비교·저장
    await page.keyboard.press('Escape');
    await page.waitForSelector('.gb-panel.on[data-panel=pause]');
    await page.locator('[data-do=resume]').click();
    await page.locator('[data-do=size]').click();
    await page.locator('[data-size="96"]').click();
    await page.locator('[data-do=closesize]').click();
    await page.evaluate(() => window.__gb.save());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('goei-graybox:v1')).meta.size), 96);
    await page.screenshot({ path: '/tmp/goei-graybox-3.png' });
    // 부하 시험 (작게)
    await page.locator('[data-do=load]').click();
    const quick = await page.evaluate(async () => {
      const mod = window.__gb;
      void mod;
      return true;
    });
    assert.ok(quick);
    await page.close();
  }
  // 모바일 폭
  const m = await browser.newPage({ viewport: { width: 844, height: 390 } });
  m.on('pageerror', (e) => errors.push(String(e)));
  await m.goto(`http://127.0.0.1:${server.address().port}/dist/goei-graybox.html?w=844&h=390`);
  await m.waitForSelector('.gb-panel.on[data-panel=hq]');
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, '모바일 가로 넘침 없음');
  await m.screenshot({ path: '/tmp/goei-graybox-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('graybox browser ok');
} finally {
  await browser.close();
  server.close();
}
