// Chromium 거래 실입력 회귀. 공용 파일은 고치지 않고 전달 패치를 임시 복사본에 적용한다.
// npm run build && node tests/shop-drops-round2-browser.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, dirname } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const dir = mkdtempSync(join(tmpdir(), 'goei-shop-drops-round2-browser-'));
const adapter = 'src/game/action/engine/itemsLink.ts';
mkdirSync(join(dir, dirname(adapter)), { recursive: true });
writeFileSync(join(dir, adapter), readFileSync(adapter));
execFileSync('git', ['apply', '--unsafe-paths', '--directory', dir, resolve('tests/shop-drops-round2-adapter.patch')]);
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
async function bundle(baseline) {
  return (await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, format: 'iife', write: false, loader: { '.css': 'text' }, plugins: [{ name: 'round2-isolated-adapter', setup(b) {
    b.onLoad({ filter: /(?:engine\/itemsLink|items\/(?:shop|shopPanel|link))\.ts$/ }, args => {
      const path = relative(process.cwd(), args.path);
      const contents = baseline ? execFileSync('git', ['show', `0d43a449:${path}`], { encoding: 'utf8' })
        : path === adapter ? readFileSync(join(dir, adapter), 'utf8') : readFileSync(args.path, 'utf8');
      return { contents, loader: 'ts', resolveDir: dirname(args.path) };
    });
  } }] })).outputFiles[0].text;
}
const baseline = await bundle(true), fixed = await bundle(false);
const server = createServer((req, res) => {
  if (req.url === '/baseline.js' || req.url === '/fixed.js') {
    res.setHeader('Content-Type', 'text/javascript'); return res.end(req.url === '/baseline.js' ? baseline : fixed);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (req.url?.startsWith('/game')) return res.end(readFileSync('dist/goei-action-game.html'));
  res.end(`<body style="margin:0;background:#111"><script src="/${req.url === '/baseline' ? 'baseline' : 'fixed'}.js"></script>`);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url + '/baseline');
  await page.evaluate(() => setup('vending', { hp: 1 })); await page.keyboard.press('KeyE');
  await page.locator('[data-k="g:hp"]').click(); await page.locator('[data-k="g:hp"]').click();
  await page.keyboard.press('Escape'); await page.keyboard.press('KeyE');
  await page.locator('[data-k="g:hp"]').click();
  assert.equal((await page.evaluate(() => state())).hp, 1);
  assert.equal((await page.evaluate(() => state())).count, 3);
  console.log('REPRO 0d43a449: HP 1 유지 + 무료 3개 지급 (재오픈으로 재고도 재생성)');
  await page.evaluate(() => setup('backalley', { hp: 100 })); await page.keyboard.press('KeyE');
  const clinicBefore = await page.evaluate(() => state());
  await page.locator('[data-k="c:purge"]').click();
  const clinicAfter = await page.evaluate(() => state());
  assert.equal(clinicAfter.hp, clinicBefore.hp); assert.ok(clinicAfter.cash < clinicBefore.cash);
  console.log('REPRO 0d43a449: 연결되지 않은 오염 세척에서 현금만 차감');

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
    console.log(`PASS ${mobile ? '667×375 touch' : '1280×720 mouse'}: HP·현금·포화·연속 구매·부채·판매·재오픈·저장복원 (공용 패치 임시 적용)`);
    await p.close();
  }
  // The shipped build without the adapter patch must fail closed for HP trades.
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
  console.log('PASS 실제 생성 HTML: 공용 체력 연결 전 무료 지급 차단');
  assert.deepEqual(errors, []);
} finally {
  await browser.close(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true });
}
