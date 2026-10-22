import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'goei-shop-drops-round2-'));
const bundle = await build({ stdin: { contents: `
export * from './src/game/action/items/index.ts';
export { rollDrops as enemyRollDrops } from './src/game/action/enemy/drops.ts';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false });
writeFileSync(join(dir, 'transactions.mjs'), bundle.outputFiles[0].text);
const I = await import(join(dir, 'transactions.mjs'));
const snapshot = (shop, run) => structuredClone({ shop, run });
const count = run => run.loadout.reduce((n, s) => n + (s?.n ?? 0), 0);
const full = run => { run.loadout = Array.from({ length: 4 }, () => ({ id: 'charm', n: 1 })); };
const actor = { x: 300, y: 600, z: 0, dir: 1 };
function collect(field, run) {
  // Landing/position setup only; payout uses the real pickup loop.
  for (const e of field.ents) Object.assign(e, { ...actor, vx: 0, vy: 0, vz: 0, age: 1 });
  return I.stepField(field, run, actor, {}, [], 0);
}

test('현금 부족·소모품 포화·탄약 포화는 거래 전체를 보존한다', () => {
  for (const why of ['cash', 'full', 'ammoFull']) {
    const run = I.createItemRun('jyaldi'), shop = I.openShop('madeokhee', run, 2, 77);
    run.cash = why === 'cash' ? 0 : 500;
    if (why === 'full') full(run);
    if (why === 'ammoFull') run.reserve = I.SIGNATURES.jyaldi.reserveMax;
    const before = snapshot(shop, run);
    assert.deepEqual(I.buy(shop, run, why === 'ammoFull' ? 'ammo' : 'i:medkit'), { ok: false, why });
    assert.deepEqual(snapshot(shop, run), before);
  }
});

test('연속 구매는 실제 지급 한 개당 한 번 차감하며 품절 뒤 무변경', () => {
  const run = I.createItemRun('jyaldi'), shop = I.openShop('madeokhee', run, 1, 77);
  run.cash = 1000;
  const offer = shop.offers.find(o => o.key === 'i:medkit');
  for (let i = 0; i < 12; i++) assert.equal(I.buy(shop, run, offer.key).ok, i < 3);
  assert.equal(count(run), 3); assert.equal(run.cash, 1000 - 3 * offer.price); assert.equal(offer.stock, 0);
});

test('자판기 체력 대가는 지급 전에 확인하고 실패하면 RNG·재고도 보존한다', () => {
  for (const ctx of [undefined, { hp: 1, max: 100 }, { hp: 20, max: 100 }, { hp: NaN, max: 100 }]) {
    const run = I.createItemRun('jyaldi'), shop = I.openShop('vending', run, 1, 7);
    const before = snapshot(shop, run);
    assert.deepEqual(I.buy(shop, run, 'g:hp', ctx), { ok: false, why: 'cash', currency: 'hp' });
    assert.deepEqual(snapshot(shop, run), before);
  }
  const run = I.createItemRun('jyaldi'), shop = I.openShop('vending', run, 1, 7);
  const ctx = { hp: 41, max: 100 };
  for (let i = 0; i < 2; i++) {
    const result = I.buy(shop, run, 'g:hp', ctx);
    assert.equal(result.ok, true); ctx.hp -= result.hpCost * ctx.max;
  }
  assert.equal(ctx.hp, 1); assert.equal(count(run), 2);
});

test('자판기 소모품 포화는 현금·체력 대가·추첨 진행 없음', () => {
  for (const key of ['g:cash', 'g:hp']) {
    const run = I.createItemRun('jyaldi'), shop = I.openShop('vending', run, 1, 7);
    run.cash = 500; full(run); const before = snapshot(shop, run);
    assert.deepEqual(I.buy(shop, run, key, { hp: 100, max: 100 }), { ok: false, why: 'full' });
    assert.deepEqual(snapshot(shop, run), before);
  }
});

test('부채가 있으면 재방문·다른 대출 선택으로도 추가 지급하지 않는다', () => {
  const run = I.createItemRun('jyaldi'), shop = I.openShop('shinyuri', run, 1, 7);
  assert.equal(I.buy(shop, run, 'l:1').ok, true);
  assert.equal(run.cash, I.LOANS[1].cash); assert.equal(run.debt, I.LOANS[1].debt);
  assert.ok(shop.offers.every(o => o.stock === 0));
  const reopened = I.openShop('shinyuri', run, 1, 7), before = snapshot(reopened, run);
  assert.deepEqual(I.buy(reopened, run, 'l:0'), { ok: false, why: 'loan' });
  assert.deepEqual(snapshot(reopened, run), before);
});

test('저장된 회수물 가격 표시와 매각 지급 일치·연속 판매 중복 없음', () => {
  const run = I.createItemRun('jyaldi'), shop = I.openShop('madeokhee', run, 3, 7);
  I.addRelic(run, 'scrap'); run.bag[0].value = 57;
  const shown = I.sellPrice(shop, run.bag[0].value);
  assert.equal(I.sell(shop, run, 0), shown);
  assert.equal(I.sell(shop, run, 0), 0); assert.equal(run.cash, shown);
});

test('드랍 꿈결·열쇠 수량과 실제 회수 일치', () => {
  for (const [item, ref] of [['dream', 'dreamcatcher'], ['key', 'rustkey']]) {
    const run = I.createItemRun('jyaldi'), field = I.createField(7);
    I.spawnEnemyDrops(field, run, [{ item, n: 3 }], actor.x, actor.y);
    collect(field, run);
    assert.equal(run.bag.filter(b => b?.id === ref).length, 3);
    assert.equal(field.ents.length, 0);
  }
});

test('드랍 가방 포화 시 바닥 보존 → 판매 후 한 번만 회수', () => {
  const run = I.createItemRun('jyaldi'), field = I.createField(9), shop = I.openShop('madeokhee', run, 1, 7);
  for (let i = 0; i < 6; i++) I.addRelic(run, 'scrap');
  I.spawnEnemyDrops(field, run, [{ item: 'dream', n: 1 }], actor.x, actor.y);
  collect(field, run); assert.equal(field.ents.length, 1);
  I.sell(shop, run, 0); collect(field, run); collect(field, run);
  assert.equal(field.ents.length, 0); assert.equal(run.bag.filter(b => b?.id === 'dreamcatcher').length, 1);
});

test('적 드랍 표 6종 × 정예 × 50시드: 바닥과 실제 지급 수량 보존', () => {
  for (const table of ['none', 'common', 'bureau', 'daydream', 'mid', 'guardian']) for (const elite of [false, true]) for (let seed = 1; seed <= 50; seed++) {
    const rng = { seed }, drops = I.enemyRollDrops(table, () => I.rand(rng), elite);
    const run = I.createItemRun('jyaldi'), field = I.createField(seed);
    I.spawnEnemyDrops(field, run, drops, actor.x, actor.y);
    const sum = kind => drops.filter(d => d.item === kind).reduce((n, d) => n + d.n, 0);
    const events = collect(field, run);
    assert.equal(run.cash, sum('cash')); assert.equal(run.shards, sum('shard'));
    assert.equal(run.reserve, 16 + sum('ammo') * I.AMMO_PICKUP.pistol.amount);
    assert.equal(events.filter(e => e.t === 'pickup' && e.kind === 'heal').length, sum('heal'));
    assert.equal(run.bag.filter(Boolean).length, sum('relic') + sum('dream') + sum('key'));
    assert.equal(field.ents.length, 0);
  }
});

test('탄 없는 요원 드랍은 명시된 수량만큼 현금으로 지급', () => {
  const run = I.createItemRun('gorgodio'), field = I.createField(9);
  I.spawnEnemyDrops(field, run, [{ item: 'ammo', n: 3 }], actor.x, actor.y);
  collect(field, run); assert.equal(run.cash, 12); assert.equal(field.ents.length, 0);
});

test('엔진이 적용할 수 없는 오염 치료·효과 없는 만피 치료는 차감하지 않는다', () => {
  for (const [key, ctx] of [['c:purge', { hp: 50, max: 100 }], ['c:patch', { hp: 100, max: 100 }]]) {
    const run = I.createItemRun('jyaldi'), shop = I.openShop('backalley', run, 1, 7);
    run.cash = 500; const before = snapshot(shop, run);
    assert.equal(I.buy(shop, run, key, ctx).ok, false);
    assert.deepEqual(snapshot(shop, run), before);
  }
});

test('치료 연결은 실제 효과만 반환하고 성공 시 한 번 차감한다', () => {
  for (const ctx of [{ hp: 50, max: 100 }, { hp: 100, max: 100, curable: ['bleed'] }]) {
    const run = I.createItemRun('jyaldi'), shop = I.openShop('backalley', run, 1, 7);
    run.cash = 500;
    const result = I.buy(shop, run, 'c:patch', ctx);
    assert.equal(result.ok, true);
    assert.equal(result.heal, ctx.hp < ctx.max ? 0.5 : 0);
    assert.deepEqual(result.cure, ctx.curable ?? []);
    assert.equal(run.cash, 500 - I.priceAt(40, 1));
    assert.equal(I.buy(shop, run, 'c:patch', ctx).ok, false);
  }
});

test('0·음수·비정수 드랍은 지급하지 않는다', () => {
  for (const item of ['cash','shard','heal','ammo','relic','dream','key']) for (const n of [0,-1,0.5,NaN,Infinity]) {
    const run = I.createItemRun('jyaldi'), field = I.createField(9);
    I.spawnEnemyDrops(field, run, [{ item, n }], actor.x, actor.y);
    assert.equal(field.ents.length, 0);
  }
});
