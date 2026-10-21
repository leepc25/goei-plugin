// 화면·조작 시연판 Chromium 실입력 시험: PC 키보드, 폰 가로 터치(스틱+버튼 동시), 폰 세로, 가짜 게임패드, 메뉴. npm run build 뒤 실행.
// 스크린샷: SHOTS=폴더 (기본 dist-test/ui-shots)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const base = resolve('.');
const shots = process.env.SHOTS || 'dist-test/ui-shots';
mkdirSync(shots, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const path = resolve(base, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(base + sep)) return res.writeHead(403).end();
    res.setHeader('Content-Type', extname(path) === '.html' ? 'text/html' : 'application/octet-stream');
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/dist/goei-ui-demo.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fitCheck = async (page, label) => {
  const r = await page.evaluate(() => {
    const s = document.querySelector('.gs-stage').getBoundingClientRect();
    return { w: s.width, h: s.height, l: s.left, t: s.top, r: s.right, b: s.bottom, vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth };
  });
  assert.ok(Math.abs(r.w / r.h - 16 / 9) < 0.01, `${label}: 16:9 (${r.w}x${r.h})`);
  assert.ok(r.l >= -1 && r.t >= -1 && r.r <= r.vw + 1 && r.b <= r.vh + 1, `${label}: 화면 안 ${JSON.stringify(r)}`);
  assert.ok(r.sw <= r.vw, `${label}: 가로 넘침 없음`);
  return r;
};
try {
  // ── PC 키보드
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(`pc: ${e}`));
    await page.goto(url);
    await page.waitForSelector('.mn-title.on');
    await fitCheck(page, 'PC');
    await page.screenshot({ path: `${shots}/pc-title.png` });
    await page.keyboard.press('Enter'); // 새로 시작
    await page.waitForSelector('.mn-dialog.on');
    await page.keyboard.press('Digit1'); // 쟈알디
    await wait(2200);
    assert.equal(await page.evaluate(() => window.__ui.run.phase), 'floor');
    const x0 = await page.evaluate(() => window.__ui.run.player.x);
    await page.keyboard.down('ArrowRight');
    await wait(700);
    await page.keyboard.up('ArrowRight');
    const x1 = await page.evaluate(() => window.__ui.run.player.x);
    assert.ok(x1 > x0 + 40, `키보드 이동 ${x0}→${x1}`);
    await page.screenshot({ path: `${shots}/pc-play.png` });
    // 사격 → 탄 줄어듦
    await page.keyboard.down('KeyS');
    await wait(900);
    await page.keyboard.up('KeyS');
    const mag = await page.evaluate(() => window.__ui.hudState().weapon.mag);
    assert.ok(mag < 12, `사격하면 탄이 준다 (${mag})`);
    // Esc 일시정지 → 시간 멈춤
    await page.keyboard.press('Escape');
    await page.waitForSelector('.mn.on h2');
    const tA = await page.evaluate(() => window.__ui.run.time);
    await wait(400);
    assert.equal(await page.evaluate(() => window.__ui.run.time), tA, '메뉴 중 시간 정지');
    await page.screenshot({ path: `${shots}/pc-pause.png` });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter'); // 설정
    await page.waitForSelector('.mn-row .mn-tog');
    // CRT 켜기: 첫 항목
    await page.keyboard.press('Enter');
    assert.ok(await page.evaluate(() => document.querySelector('.gs').classList.contains('crt')), 'CRT 켜짐');
    await page.screenshot({ path: `${shots}/pc-settings.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await wait(200);
    assert.equal(await page.evaluate(() => document.querySelector('.mn.on')), null, 'Esc 로 메뉴 닫힘');
    await page.screenshot({ path: `${shots}/pc-crt.png` });
    // 어두운 층: 조명·림라이트
    await page.evaluate(() => window.__ui.goFloor('dark'));
    await wait(2600);
    await page.screenshot({ path: `${shots}/pc-dark.png` });
    // 지도
    await page.keyboard.press('KeyZ');
    await wait(150);
    await page.screenshot({ path: `${shots}/pc-map.png` });
    await page.keyboard.press('KeyZ');
    // 가짜 게임패드: X 버튼 = 근접(KeyA)
    await page.evaluate(() => {
      const pad = { id: '시험 패드', connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
      window.__pad = pad;
      navigator.getGamepads = () => [pad];
    });
    await page.evaluate(() => (window.__pad.buttons[2] = { pressed: true, value: 1 }));
    await wait(100);
    assert.ok(await page.evaluate(() => window.__ui.shell.input.held('KeyA')), '패드 X = A');
    await page.evaluate(() => ((window.__pad.buttons[2] = { pressed: false, value: 0 }), (window.__pad.axes[0] = 1)));
    const px0 = await page.evaluate(() => window.__ui.run.player.x);
    await wait(500);
    assert.ok((await page.evaluate(() => window.__ui.run.player.x)) > px0 + 20, '패드 스틱 이동');
    await page.evaluate(() => (window.__pad.axes[0] = 0));
    await page.close();
  }
  // ── 폰 가로 터치
  {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`mobile: ${e}`));
    await page.goto(url);
    await page.waitForSelector('.mn-title.on');
    await fitCheck(page, '폰 가로');
    await page.screenshot({ path: `${shots}/m-title.png` });
    await page.tap('.mn-btn >> text=새로 시작');
    await page.waitForSelector('.mn-dialog.on');
    await page.tap('.mn-dialog .mn-btn >> nth=0');
    await wait(2200);
    assert.ok(await page.evaluate(() => !document.querySelector('.tp').classList.contains('hide')), '터치 버튼 보임');
    await page.screenshot({ path: `${shots}/m-play.png` });
    const cdp = await ctx.newCDPSession(page);
    const a = await page.evaluate(() => {
      const r = document.querySelector('.tp-b[data-id=attack]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const x0 = await page.evaluate(() => window.__ui.run.player.x);
    // 왼손 스틱 누르고 오른쪽으로 끌기 + 오른손 공격 동시에
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 300, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 300, id: 1 }] });
    await wait(600);
    const x1 = await page.evaluate(() => window.__ui.run.player.x);
    assert.ok(x1 > x0 + 20, `터치 이동 ${x0}→${x1}`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 300, id: 1 }, { x: a.x, y: a.y, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 300, id: 1 }, { x: a.x, y: a.y, id: 2 }] });
    await wait(80);
    const held = await page.evaluate(() => ({ a: window.__ui.shell.input.held('KeyA'), r: window.__ui.shell.input.held('ArrowRight') }));
    await page.screenshot({ path: `${shots}/m-touch.png` });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(held.a && held.r, `스틱+공격 동시 ${JSON.stringify(held)}`);
    await wait(100);
    assert.ok(await page.evaluate(() => !window.__ui.shell.input.held('KeyA') && !window.__ui.shell.input.held('ArrowRight')), '손 떼면 풀림');
    // 메뉴 버튼
    const mr = await page.evaluate(() => {
      const r = document.querySelector('.tp-b[data-id=menu]').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.touchscreen.tap(mr.x, mr.y);
    await page.waitForSelector('.mn.on h2');
    await page.screenshot({ path: `${shots}/m-pause.png` });
    await page.tap('.mn-btn >> text=계속');
    await page.evaluate(() => window.__ui.goFloor('dark'));
    await wait(2600);
    await page.screenshot({ path: `${shots}/m-dark.png` });
    await ctx.close();
  }
  // ── 폰 세로
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`portrait: ${e}`));
    await page.goto(url);
    await page.waitForSelector('.gs-rotate.on');
    await page.screenshot({ path: `${shots}/p-rotate.png` });
    await page.tap('[data-rot=keep]');
    await fitCheck(page, '폰 세로');
    await page.tap('.mn-btn >> text=새로 시작');
    await page.tap('.mn-dialog .mn-btn >> nth=0');
    await wait(2200);
    await page.screenshot({ path: `${shots}/p-play.png` });
    await ctx.close();
  }
  // ── 폰 세로 + 「화면 돌려서 크게」: 게임 전체가 90도 돌고, 터치 좌표도 돌려서 읽는다
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`turned: ${e}`));
    await page.goto(url);
    await page.waitForSelector('.gs-rotate.on');
    await page.tap('[data-rot=turn]');
    assert.ok(await page.evaluate(() => document.querySelector('.gs').classList.contains('turned')), '돌려 보기 켜짐');
    const big = await page.evaluate(() => document.querySelector('.gs-stage').getBoundingClientRect().height);
    assert.ok(big > 600, `돌리면 게임이 커진다 (${big})`);
    await page.tap('.mn-btn >> text=새로 시작');
    await page.tap('.mn-dialog .mn-btn >> nth=0');
    await wait(2200);
    const cdp = await ctx.newCDPSession(page);
    const x0 = await page.evaluate(() => window.__ui.run.player.x);
    // 돌린 화면의 (150, 300) = 실제 화면 (390 - 300, 150)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 150, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 210, id: 1 }] });
    await wait(600);
    const right = await page.evaluate(() => window.__ui.shell.input.held('ArrowRight'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const x1 = await page.evaluate(() => window.__ui.run.player.x);
    assert.ok(right && x1 > x0 + 20, `돌린 화면에서 스틱 오른쪽 = 오른쪽 이동 ${x0}→${x1}`);
    await page.screenshot({ path: `${shots}/p-turned.png` });
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('ui-browser: 통과', shots);
} finally {
  await browser.close();
  server.close();
}
