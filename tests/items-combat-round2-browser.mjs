// npm run build 뒤 실행. 공유 소스는 그대로 두고 연결 패치를 번들에만 적용한다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const output = resolve('dist-test/items-combat-round2-browser');
await mkdir(output, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'goei-items-combat-round2-browser-'));
const shared = 'src/game/action/engine/itemsLink.ts', copied = join(dir, shared);
await mkdir(dirname(copied), { recursive: true });
await writeFile(copied, await readFile(shared));
await promisify(execFile)('git', ['apply', resolve('tests/fixtures/items-combat-round2-itemsLink.patch')], { cwd: dir });
const plugin = { name: 'items-round2-link', setup(b) {
  b.onLoad({ filter: /\/engine\/itemsLink\.ts$/ }, async () => ({ contents: await readFile(copied, 'utf8'), loader: 'ts', resolveDir: dirname(resolve(shared)) }));
} };
const bundled = await build({ stdin: { contents: `
import './src/game/action/engine/demo.ts';
import * as items from './src/game/action/items';
import { createEnemy } from './src/game/action/enemy';
window.itemsRound2 = { items, createEnemy };
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false, plugins: [plugin], loader: { '.css': 'text' } });
const original = await readFile('dist/goei-action-game.html', 'utf8');
const start = original.lastIndexOf('<script type="module">');
assert.ok(start >= 0);
const patched = original.slice(0, start) + '<script type="module">' + bundled.outputFiles[0].text + '</script></html>';
await writeFile(join(output, 'items-combat-round2-patched.html'), patched);
const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(req.url.startsWith('/patched') ? patched : original); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const errors = [], results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(String(e)));
  const press = key => page.keyboard.press(key, { delay: 80 });
  const load = async path => {
    await page.goto(url + path + '?start=stage=dummy');
    await page.waitForFunction(() => window.__goeiEngine?.world && !window.__goeiEngine.mods.blocking());
    await page.waitForTimeout(400);
  };
  // 빌드한 원본 단일 HTML에서 실제 숫자 키로 소비/회복을 검증한다.
  await load('/base');
  const before = await page.evaluate(() => {
    const w = window.__goeiEngine.world;
    w.player.hp = w.player.hpMax / 2;
    return { hp: w.player.hp, max: w.player.hpMax, n: w.itemRun.loadout[0].n };
  });
  await press('Digit1');
  await page.waitForFunction(n => window.__goeiEngine.world.itemRun.loadout[0]?.n === n - 1, before.n);
  assert.equal(await page.evaluate(() => window.__goeiEngine.world.player.hp), before.hp + before.max * .35);
  results.push('원본 dist HTML: Digit1 회복·정확히 한 개 소비');

  await load('/patched');
  const ready = () => page.waitForFunction(() => { const p = window.__goeiEngine.world.player; return !p.move && p.phase === 'free'; });
  const state = () => page.evaluate(() => {
    const w = window.__goeiEngine.world;
    return { hp: w.player.hp, ammo: w.player.ammo, reserve: w.player.reserve, bag: w.itemRun.bag, slots: w.itemRun.loadout, held: w.itemRun.held, carry: w.itemRun.carry, ents: w.itemField.ents, projs: w.itemField.projs, zones: w.itemField.zones };
  });
  // 위치 주입은 시험 조건 설정에만 사용. 획득·소비·사격·들기·던지기는 실제 키 입력/틱.
  await page.evaluate(() => {
    const w = window.__goeiEngine.world, I = window.itemsRound2.items, p = w.player;
    w.itemField.ents.length = 0; w.bodies = w.bodies.filter(b => b.team !== 'enemy');
    w.itemRun.loadout = [{ id: 'medkit', n: 2 }, ...Array.from({ length: 3 }, () => ({ id: 'charm', n: 1 }))];
    Object.assign(I.spawnPickup(w.itemField, 'item', p.x, p.y, 'medkit', 3), { z: 0, vz: 0, vx: 0, vy: 0, age: 1 });
    p.hp = p.hpMax / 2;
  });
  await page.waitForFunction(() => window.__goeiEngine.world.itemRun.loadout[0].n === 3);
  assert.equal((await state()).ents[0].amount, 2);
  await press('Digit1'); await ready();
  await page.waitForFunction(() => window.__goeiEngine.world.itemField.ents[0]?.amount === 1);
  results.push('소모품 포화: 잔량 2개 유지 → Digit1 사용 뒤 1개만 보충');

  await page.evaluate(() => {
    const w = window.__goeiEngine.world, I = window.itemsRound2.items, p = w.player;
    w.itemField.ents.length = 0; p.hp = p.hpMax;
    Object.assign(I.spawnPickup(w.itemField, 'heal', p.x, p.y), { z: 0, vz: 0, vx: 0, vy: 0, age: 1 });
  });
  await page.waitForTimeout(200);
  assert.equal((await state()).ents.length, 1);
  await page.evaluate(() => { const p = window.__goeiEngine.world.player; p.hp = p.hpMax - 5; });
  await page.waitForFunction(() => window.__goeiEngine.world.itemField.ents.length === 0);
  results.push('체력 최대일 때 회복 조각 보존 → 부상 뒤 회복');

  await page.evaluate(() => {
    const w = window.__goeiEngine.world, I = window.itemsRound2.items, p = w.player;
    w.itemRun.bag.fill({ id: 'photo', name: '사진', value: 40, research: 8 });
    Object.assign(I.spawnPickup(w.itemField, 'relic', p.x, p.y, 'checklist'), { z: 0, vz: 0, vx: 0, vy: 0, age: 1 });
  });
  await press('KeyE'); await ready();
  assert.equal((await state()).ents.length, 1);
  await page.evaluate(() => { window.__goeiEngine.world.itemRun.bag[0] = null; });
  await page.waitForFunction(() => window.__goeiEngine.world.itemRun.bag[0]?.id === 'checklist');
  assert.equal((await state()).ents.length, 0);
  results.push('가방 포화 E 거절 → 빈 칸 확보 뒤 점검표 1회 획득');

  await page.evaluate(() => {
    const w = window.__goeiEngine.world, I = window.itemsRound2.items, p = w.player;
    p.reserve = 31;
    Object.assign(I.spawnPickup(w.itemField, 'ammo', p.x, p.y), { z: 0, vz: 0, vx: 0, vy: 0, age: 1 });
  });
  await page.waitForFunction(() => window.__goeiEngine.world.player.reserve === 32);
  assert.equal((await state()).ents[0].ammoLeft, 7);
  const ammo = (await state()).ammo;
  await press('KeyS');
  await ready(); // 첫 S는 홀스터에서 꺼내기, 두 번째 S가 사격.
  await press('KeyS');
  await page.waitForFunction(n => window.__goeiEngine.world.player.ammo < n, ammo);
  results.push('탄약 31→32, 바닥 잔탄 7 보존 및 실제 S 사격 소비');
  await ready();

  await page.evaluate(() => {
    const w = window.__goeiEngine.world, I = window.itemsRound2.items, p = w.player;
    w.itemField.ents.length = 0;
    Object.assign(I.spawnPickup(w.itemField, 'weapon', p.x, p.y, 'pipe'), { z: 0, vz: 0, vx: 0, vy: 0, age: 1 });
  });
  await press('KeyE');
  await page.waitForFunction(() => window.__goeiEngine.world.itemRun.held?.id === 'pipe');
  await ready();
  await page.evaluate(() => {
    const w = window.__goeiEngine.world, p = w.player;
    const e = window.itemsRound2.createEnemy('fb_smg', p.x + 75, p.y, () => .5);
    e.set('idle'); e.hp = e.hpMax = 40; e.brain = { think() {} };
    w.bodies.push(e); window.itemsRound2.enemy = e;
  });
  await press('KeyA');
  await page.waitForFunction(() => window.itemsRound2.enemy.hp < 40);
  await ready();
  await page.evaluate(() => { const w = window.__goeiEngine.world, e = window.itemsRound2.enemy; e.x = w.player.x + 75; e.y = w.player.y; e.vx = 0; });
  await press('KeyA');
  await page.waitForFunction(() => window.itemsRound2.enemy.hp <= 0);
  assert.equal((await state()).held.uses, 6);
  assert.equal(await page.evaluate(() => window.__goeiEngine.world.kills), 1);
  results.push('E 쇠파이프 획득 → A 두 번으로 실제 적 처치, 내구 8→6·처치 1');
  await ready();

  await page.evaluate(() => {
    const w = window.__goeiEngine.world, I = window.itemsRound2.items, p = w.player;
    w.itemRun.held = null; w.itemField.ents.length = 0; w.bodies = w.bodies.filter(b => b.team !== 'enemy');
    I.placeProp(w.itemField, 'chair', p.x + 45, p.y);
  });
  await page.waitForTimeout(100); await press('KeyE');
  await page.waitForFunction(() => window.__goeiEngine.world.itemRun.carry?.prop === 'chair');
  await ready(); await press('KeyA');
  await page.waitForFunction(() => !window.__goeiEngine.world.itemRun.carry);
  await page.waitForFunction(() => window.__goeiEngine.world.itemField.projs.length === 0);
  assert.equal((await state()).ents.some(e => e.prop === 'chair'), false);
  results.push('의자 E 들기 → A 투척 → 착지 후 원본·투사체 소멸');
  await ready();

  for (const id of ['flash', 'smoke']) {
    await page.evaluate(id => {
      const w = window.__goeiEngine.world, p = w.player;
      w.itemRun.loadout = [{ id, n: 1 }, null, null, null]; w.itemRun.itemCd = 0;
      p.x = p.px = w.itemField.bounds.x1 - 10; p.dir = 1;
      const e = window.itemsRound2.createEnemy('fb_smg', p.x - 100, p.y, () => .5);
      e.set('idle'); e.brain = { think() {} }; w.bodies.push(e); window.itemsRound2.enemy = e;
    }, id);
    await press('Digit1');
    await page.waitForFunction(kind => window.__goeiEngine.world.itemField.zones.some(z => z.kind === kind), id);
    assert.equal((await state()).slots[0], null);
    if (id === 'flash') assert.equal(await page.evaluate(() => window.itemsRound2.enemy.state), 'stunned');
    if (id === 'smoke') assert.ok(await page.evaluate(() => window.itemsRound2.enemy.slow > 0));
    await page.screenshot({ path: join(output, `items-combat-round2-${id}.png`) });
    results.push(`방 끝 ${id} Digit1 투척 → 착지 효과${id === 'flash' ? '·실제 적 기절' : ''}`);
    await ready();
  }
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'items-combat-round2-results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log(results.map(x => 'PASS ' + x).join('\n'));
} catch (e) { console.error(results, errors); throw e; } finally { await browser.close(); await new Promise(r => server.close(r)); }
