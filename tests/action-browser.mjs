// npm run build 뒤 실행. PLAYWRIGHT_MODULE로 별도 설치 경로 지정 가능.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`,
);
const base = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(base, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(base + sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    res.setHeader(
      'Content-Type',
      extname(path) === '.html'
        ? 'text/html'
        : extname(path) === '.js'
          ? 'text/javascript'
          : 'application/octet-stream',
    );
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const url = `http://127.0.0.1:${server.address().port}/tests/game/action.html`;
const errors = [];
const open = async (page) => {
  await page.waitForFunction(() => !document.querySelector('[data-do=resume]').disabled);
  await page.locator('[data-do=resume]').click();
};
const snapshot = async (page) => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  return page.evaluate(() => JSON.parse(localStorage.getItem('goei-action-demo:v1')));
};
try {
  const page = await browser.newPage({
    viewport: { width: 1300, height: 950 },
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await open(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(450);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyX');
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(100);
  let saved = await snapshot(page);
  assert.ok(saved.player.x > 260);
  assert.ok(saved.player.z > 0);
  const x = saved.player.x;
  await page.evaluate(() => window.__reopen());
  await open(page);
  saved = await snapshot(page);
  assert.equal(saved.player.x, x, '닫고 열어도 위치 유지');
  // 채팅처럼 게임 밖 입력에 초점을 주면 전투 단축키를 가로채지 않는다.
  await page.locator('[data-do=resume]').click();
  await page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 'chat';
    document.body.append(i);
    i.focus();
  });
  await page.keyboard.type('qwe zxc');
  assert.equal(await page.locator('#chat').inputValue(), 'qwe zxc');
  await page.evaluate(() => document.getElementById('chat').remove());
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('goei-action-demo:v1'));
    r.player.hp = 80;
    r.player.z = r.player.vz = 0;
    r.player.act = 'idle';
    r.player.t = 0;
    r.player.inv = 0;
    r.auto = false;
    localStorage.setItem('goei-action-demo:v1', JSON.stringify(r));
    window.__reopen();
  });
  await open(page);
  await page.keyboard.down('KeyQ');
  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyQ');
  saved = await snapshot(page);
  assert.equal(saved.player.items[0], 2, '키 반복은 아이템 한 번만 소비');
  assert.equal(saved.player.hp, 150);
  await page.evaluate(() => window.__reopen());
  await open(page);
  await page.keyboard.press('KeyF');
  await page.waitForFunction(
    () => document.querySelector('.ga-msg').textContent.includes('훈련 완료'),
    {},
    { timeout: 60000 },
  );
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('goei-action-demo:v1')).phase === 'cleared',
  );
  await page.screenshot({ path: '/tmp/goei-action-result.png' });
  await page.locator('.ga-foot [data-do=restart]').click();
  await page.screenshot({ path: '/tmp/goei-action-desktop.png' });
  // 새 체형의 실제 근접 동작/피해를 브라우저에서 검증한다. 불법 저장이 초기화된 것을 명중으로 오인하지 않는다.
  await snapshot(page);
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('goei-action-demo:v1'));
    r.message = '근접 배치 검증';
    r.auto = false;
    r.bolts = [];
    r.effects = [];
    r.enemies.forEach((e, i) => {
      e.x = i ? 1200 : r.player.x + 75;
      e.y = i ? 670 : r.player.y;
      e.cooldown = 9;
    });
    localStorage.setItem('goei-action-demo:v1', JSON.stringify(r));
    window.__reopen();
  });
  await open(page);
  assert.match(await page.locator('.ga-msg').textContent(), /근접 배치 검증/);
  assert.equal(await page.locator('.ga').getAttribute('data-art-profile'), 'normal-v4');
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => document.querySelector('.ga').dataset.action === 'melee1');
  await page.waitForTimeout(160);
  await page.keyboard.up('KeyZ');
  const melee = await snapshot(page);
  assert.ok(melee.player.act.startsWith('melee'));
  assert.ok(melee.enemies[0].hp < melee.enemies[0].max);
  assert.equal(melee.bolts.length, 0, '근접에서 권총으로 되돌아가지 않음');
  await page.evaluate(() => {
    document.querySelector('.ga-menu').hidden = true;
  });
  await page.screenshot({ path: '/tmp/goei-normal-verified-melee.png' });
  // 새 동작은 실제 키 입력과 훈련 배치에서 검증한다.
  await page.locator('[data-do=practice]').click();
  await page.keyboard.down('KeyA');
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => document.querySelector('.ga').dataset.action === 'crouch');
  await page.keyboard.up('ArrowDown');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.ga').dataset.action === 'crouchwalk');
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => document.querySelector('.ga').dataset.action === 'lowkick');
  await page.screenshot({ path: '/tmp/goei-v4-lowkick.png' });
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('KeyA');
  await page.locator('[data-do=practice]').click();
  await page.keyboard.press('KeyX');
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => document.querySelector('.ga').dataset.action === 'airattack');
  await page.screenshot({ path: '/tmp/goei-v4-airattack.png' });
  await page.keyboard.up('KeyZ');
  await page.locator('[data-do=practice]').click();
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyZ');
  await page.waitForFunction(() => document.querySelector('.ga').dataset.action === 'dashattack');
  await page.screenshot({ path: '/tmp/goei-v4-dashattack.png' });
  await page.keyboard.up('KeyZ');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('ArrowRight');
  const practice = await snapshot(page);
  assert.equal(practice.practice, true);
  assert.equal(practice.player.hp, 200, '훈련 표적은 선제 공격하지 않음');
  // 게임 해제 뒤 RAF가 화면이나 저장을 다시 만들지 않는다.
  await page.evaluate(() => window.__close());
  assert.equal(await page.locator('.ga').count(), 0);
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const m = await mobile.newPage();
  m.on('pageerror', (e) => errors.push(String(e)));
  await m.goto(url + '?w=390&h=844');
  await open(m);
  const stick = await m.locator('.ga-stick').boundingBox(),
    attack = await m.locator('[data-hold=attack]').boundingBox();
  const cdp = await mobile.newCDPSession(m),
    point = (id, x, y) => ({ id, x, y });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      point(1, stick.x + stick.width * 0.8, stick.y + stick.height * 0.5),
      point(2, attack.x + attack.width / 2, attack.y + attack.height / 2),
    ],
  });
  await m.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await m.locator('[data-do=pause]').click();
  await m.waitForTimeout(100);
  const ms = await m.evaluate(() => JSON.parse(localStorage.getItem('goei-action-demo:v1')));
  assert.ok(ms.player.x > 220, '조이스틱 이동과 공격 멀티터치');
  await m.locator('[data-do=resume]').click();
  await m.screenshot({ path: '/tmp/goei-action-mobile.png' });
  const bounds = await m.locator('canvas').boundingBox();
  assert.ok(bounds.width <= 390);
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth), 390);
  const standalone = await browser.newPage();
  standalone.on('pageerror', (e) => errors.push(String(e)));
  await standalone.goto(url.replace('/tests/game/action.html', '/dist/goei-action-demo.html'));
  await open(standalone);
  assert.equal(await standalone.locator('canvas').count(), 1);
  // 실제 게임 창의 두 모드 전환과 저장 키 분리를 모의 Risu host에서 확인한다.
  const integrated = await browser.newPage({
    viewport: { width: 1300, height: 950 },
  });
  integrated.on('pageerror', (e) => errors.push(String(e)));
  await integrated.goto(url);
  await integrated.evaluate(async () => {
    window.__close();
    const bytes = new Uint8Array(
      await (await fetch('/dist-test/goei-game-patrol.pack')).arrayBuffer(),
    );
    const length = new DataView(bytes.buffer).getUint32(8, true),
      head = JSON.parse(new TextDecoder().decode(bytes.slice(12, 12 + length)));
    const files = {};
    for (const [name, at, n] of head.files) {
      const data = bytes.slice(12 + length + at, 12 + length + at + n);
      let str = '';
      for (let i = 0; i < data.length; i += 0x8000)
        str += String.fromCharCode(...data.slice(i, i + 0x8000));
      files[name] = btoa(str);
    }
    window.__store = {
      'goei:game-pack:patrol': JSON.stringify({
        version: head.version,
        atlas: head.atlas,
        files,
      }),
      'goei:game': 'old-patrol-record',
    };
    const actionBytes = new Uint8Array(
      await (await fetch('/dist-test/goei-game-action.pack')).arrayBuffer(),
    );
    const alen = new DataView(actionBytes.buffer).getUint32(8, true),
      ah = JSON.parse(new TextDecoder().decode(actionBytes.slice(12, 12 + alen)));
    const afiles = {};
    for (const [name, at, n] of ah.files) {
      const data = actionBytes.slice(12 + alen + at, 12 + alen + at + n);
      let str = '';
      for (let i = 0; i < data.length; i += 0x8000)
        str += String.fromCharCode(...data.slice(i, i + 0x8000));
      afiles[name] = btoa(str);
    }
    window.__store['goei:game-pack:action-normal-v4'] = JSON.stringify({
      version: ah.version,
      atlas: ah.atlas,
      files: afiles,
    });
    window.risuai = {
      pluginStorage: {
        getItem: async (k) => window.__store[k] ?? null,
        setItem: async (k, v) => {
          window.__store[k] = v;
        },
      },
    };
    const style = document.createElement('style');
    style.textContent =
      '.gx-game{position:absolute;inset:0;display:flex;flex-direction:column}.gx-game-box{flex:1;min-height:0;display:flex}';
    document.head.append(style);
    window.__ui = await import('/dist-test/action-ui.js');
    window.__ui.openGame(document.getElementById('box'));
  });
  await open(integrated);
  await integrated.keyboard.down('ArrowRight');
  await integrated.waitForTimeout(100);
  await integrated.keyboard.up('ArrowRight');
  await integrated.keyboard.press('Escape');
  await integrated.waitForTimeout(100);
  assert.equal(await integrated.evaluate(() => window.__store['goei:game']), 'old-patrol-record');
  assert.ok(await integrated.evaluate(() => window.__store['goei:game-action:v1']));
  await integrated.locator('[data-game-mode=patrol]').click();
  await integrated.locator('.goei-game').waitFor();
  await integrated.locator('[data-game-mode=action]').click();
  await open(integrated);
  assert.equal(await integrated.locator('.ga').count(), 1);
  assert.equal(await integrated.locator('.goei-game').count(), 0);
  await integrated.evaluate(() => window.__ui.closeGame());
  assert.equal(await integrated.locator('.gx-game').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: keyboard, jump+shot, QWE single use, focus, restore, auto clear, unmount, touch joystick+attack, mobile layout, v4 crouch/lowkick/airattack/dashattack',
  );
} finally {
  await browser.close();
  await new Promise((ok) => server.close(ok));
}
