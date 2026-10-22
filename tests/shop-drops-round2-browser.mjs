// Chromium 거래 실입력 회귀. 현재 소스의 통합 어댑터를 직접 번들한다.
// node tests/shop-drops-round2-browser.mjs (dist HTML을 자산/화면 틀로 사용)
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const entry = `
import * as I from './src/game/action/items/index.ts';
import { World } from './src/game/action/engine/world.ts';
import { createElevatorStage } from './src/game/action/stage/index.ts';
import { linkItems, mountItemsOverlay } from './src/game/action/engine/itemsLink.ts';
window.setup = (vendor = 'madeokhee', opts = {}) => {
  mountItemsOverlay(document.body);
  const stage = createElevatorStage({ load: () => null, save: () => {} });
  const config = { seed: 77, agent: 'jyaldi', stageId: 'elevator' };
  const world = new World(config, {}, stage), items = linkItems(world, config);
  world.enterFloor(stage.firstFloor(config));
  world.itemField.ents = []; world.player.hpMax = 100; world.player.hp = opts.hp ?? 100;
  items.run.loadout = opts.full ? Array.from({length:4}, () => ({ id:'charm', n:1 })) : [null,null,null,null];
  items.run.cash = opts.cash ?? 1000;
  if (opts.ammoFull) world.player.reserve = items.run.reserve = I.SIGNATURES.jyaldi.reserveMax;
  if (opts.bag) for (let i = 0; i < 6; i++) I.addRelic(items.run, 'scrap');
  const prop = { id: 'round2-merchant', kind: 'merchant', label: I.VENDORS[vendor].name, x:300, y:600, w:40 };
  window.world = world; window.run = items.run;
  window.open = () => world.interactWith(prop);
  window.restore = (saved) => world.itemState.restore(JSON.parse(saved));
};
window.addEventListener('keydown', e => { if (e.code === 'KeyE') window.open(); });
window.state = () => ({ hp: world.player.hp, cash: run.cash, debt: run.debt,
 count: run.loadout.reduce((n,s)=>n+(s?.n??0),0), bag:run.bag.filter(Boolean).length,
 saved: JSON.stringify(world.itemState.snapshot()) });
`;
const fixed = (await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, format: 'iife', write: false, loader: { '.css': 'text' } })).outputFiles[0].text;
const demo = (await build({ entryPoints: ['src/game/action/engine/demo.ts'], bundle: true, format: 'esm', write: false, loader: { '.css': 'text' } })).outputFiles[0].text;
const template = readFileSync('dist/goei-action-game.html', 'utf8');
const scriptStart = template.lastIndexOf('<script type="module">');
assert.ok(scriptStart >= 0);
const gameHtml = template.slice(0, scriptStart) + '<script type="module">' + demo + '</script></html>';
const server = createServer((req, res) => {
  if (req.url === '/fixed.js') {
    res.setHeader('Content-Type', 'text/javascript'); return res.end(fixed);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url?.startsWith('/game')) return res.end(gameHtml);
  res.end(`<body style="margin:0;background:#111"><script src="/fixed.js"></script>`);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(String(e)));
  for (const mobile of [false, true]) {
    const p = await browser.newPage({ viewport: mobile ? { width: 667, height: 375 } : { width: 1280, height: 720 }, hasTouch: mobile });
    p.on('pageerror', e => errors.push(String(e)));
    await p.goto(url + '/fixed');
    const press = async selector => mobile ? p.locator(selector).tap() : p.locator(selector).click();
    const setup = async (vendor, opts) => { await p.evaluate(([v,o]) => window.setup(v,o), [vendor,opts]); await p.keyboard.press('KeyE'); };
    await setup('vending', { hp: 41 });
    await press('[data-k="g:hp"]'); await press('[data-k="g:hp"]');
    let s = await p.evaluate(() => state()); assert.equal(s.hp, 1); assert.equal(s.count, 2);
    await p.keyboard.press('Escape'); await p.keyboard.press('KeyE');
    assert.equal(await p.locator('[data-k="g:hp"]').isDisabled(), true);
    await p.keyboard.press('Escape');
    await p.evaluate(saved => { setup('vending', { hp: 1 }); restore(saved); }, s.saved);
    await p.keyboard.press('KeyE'); assert.equal(await p.locator('[data-k="g:hp"]').isDisabled(), true);
    // Old snapshots with no shops still load; a genuinely new run gets fresh stock.
    await p.keyboard.press('Escape');
    await p.evaluate(saved => { const old = JSON.parse(saved); delete old.shops; setup('vending'); restore(JSON.stringify(old)); }, s.saved);
    await p.keyboard.press('KeyE'); assert.equal(await p.locator('[data-k="g:hp"]').isDisabled(), false);
    await setup('vending', { hp: 1 });
    const before = await p.evaluate(() => state()); await press('[data-k="g:hp"]');
    assert.deepEqual(await p.evaluate(() => state()), before);
    assert.match(await p.locator('.msg').innerText(), /체력/);
    await setup('madeokhee', { cash: 0 }); await press('[data-k="i:medkit"]');
    assert.equal((await p.evaluate(() => state())).cash, 0); assert.match(await p.locator('.msg').innerText(), /현금/);
    await setup('madeokhee', { full: true }); s = await p.evaluate(() => state()); await press('[data-k="i:medkit"]');
    assert.deepEqual(await p.evaluate(() => state()), s); assert.match(await p.locator('.msg').innerText(), /가득/);
    await setup('madeokhee', { ammoFull: true }); s = await p.evaluate(() => state()); await press('[data-k="ammo"]');
    assert.deepEqual(await p.evaluate(() => state()), s);
    await setup('madeokhee', {});
    // Native consecutive input, with rerender between each purchase.
    for (let i = 0; i < 3; i++) await press('[data-k="i:medkit"]');
    s = await p.evaluate(() => state()); assert.equal(s.count, 3);
    await p.keyboard.press('Escape'); await p.keyboard.press('KeyE');
    assert.equal(await p.locator('[data-k="i:medkit"]').isDisabled(), true);
    assert.equal((await p.evaluate(() => state())).cash, s.cash);
    await setup('backalley', { hp: 100 });
    s = await p.evaluate(() => state());
    await press('[data-k="c:purge"]'); await press('[data-k="c:patch"]');
    assert.deepEqual(await p.evaluate(() => state()), s); assert.match(await p.locator('.msg').innerText(), /치료/);
    await setup('backalley', { hp: 40 }); await press('[data-k="c:patch"]');
    assert.equal((await p.evaluate(() => state())).hp, 90);
    await setup('shinyuri', {}); await press('[data-k="l:1"]');
    s = await p.evaluate(() => state()); assert.equal(s.cash, 1120); assert.equal(s.debt, 190);
    assert.equal(await p.locator('[data-k="l:0"]').isDisabled(), true);
    await setup('madeokhee', { bag: true }); await press('[data-sell="0"]');
    assert.equal((await p.evaluate(() => state())).bag, 5); assert.equal(await p.locator('[data-sell="0"]').count(), 0);
    const shots = resolve('dist-test/shop-drops-round2'); mkdirSync(shots, { recursive: true });
    await p.screenshot({ path: join(shots, mobile ? 'mobile.png' : 'pc.png') });
    console.log(`PASS ${mobile ? '667×375 touch' : '1280×720 mouse'}: HP·현금·포화·연속 구매·부채·판매·재오픈·저장복원 (현재 소스 공용 연결)`);
    await p.close();
  }
  // 현재 게임 전체 번들도 HP 1의 거래를 거절하고 정상 체력에서는 비용을 차감한다.
  await page.goto(url + '/game?start=stage=dummy');
  await page.waitForFunction(() => window.__goeiEngine?.world);
  await page.evaluate(() => {
    const w = window.__goeiEngine.world;
    w.itemRun.loadout = [null,null,null,null]; w.player.hp = 1;
    w.interactWith({ id:'round2-build-vending',kind:'merchant',label:'무엇이든 자판기',x:w.player.x,y:w.player.y,w:40 });
  });
  await page.locator('[data-k="g:hp"]').click();
  assert.equal(await page.evaluate(() => window.__goeiEngine.world.itemRun.loadout.filter(Boolean).length), 0);
  assert.match(await page.locator('.msg').innerText(), /체력/);
  await page.evaluate(() => { const p = window.__goeiEngine.world.player; p.hpMax = 100; p.hp = 41; });
  await page.locator('[data-k="g:hp"]').click();
  assert.equal(await page.evaluate(() => window.__goeiEngine.world.player.hp), 21);
  assert.equal(await page.evaluate(() => window.__goeiEngine.world.itemRun.loadout.reduce((n,s) => n + (s?.n ?? 0), 0)), 1);
  console.log('PASS 현재 게임 HTML: HP 1 무료 지급 차단, HP 41 구매 후 21로 비용 반영');
  assert.deepEqual(errors, []);
} finally {
  await browser.close(); await new Promise(r => server.close(r));
}
