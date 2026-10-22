// node --test tests/items-combat-round2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'goei-items-combat-round2-'));
const bundle = await build({ stdin: { contents: `
export * from './src/game/action/items/index.ts';
export { World } from './src/game/action/engine/world.ts';
export { linkItems } from './src/game/action/engine/itemsLink.ts';
export { createElevatorStage, DIRS, OPP, roomAt } from './src/game/action/stage/index.ts';
export { createEnemy } from './src/game/action/enemy/index.ts';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', write: false, loader: { '.css': 'text' } });
writeFileSync(join(dir, 'items-combat-round2.mjs'), bundle.outputFiles[0].text);
const I = await import(join(dir, 'items-combat-round2.mjs'));
const actor = { x: 300, y: 600, z: 0, dir: 1 };
const step = (f, r, input = {}, ctx, a = actor, targets = []) => I.stepField(f, r, a, input, targets, 1 / 30, ctx);
function ground(f, kind, ref, amount = 1, x = actor.x) {
  return Object.assign(I.spawnPickup(f, kind, x, actor.y, ref, amount), { z: 0, vz: 0, vx: 0, vy: 0, age: 1 });
}
const fullSlots = () => [{ id: 'medkit', n: 2 }, ...Array.from({ length: 3 }, () => ({ id: 'charm', n: 1 }))];

test('소모품 묶음: 빈 자리만 획득하고 남은 수량은 바닥·JSON 왕복 후에도 보존', () => {
  let f = I.createField(71), r = I.createItemRun('jyaldi', fullSlots());
  ground(f, 'item', 'medkit', 3);
  const ev = step(f, r);
  assert.equal(ev.find(e => e.t === 'pickup')?.amount, 1);
  assert.equal(r.loadout[0].n, 3);
  assert.equal(f.ents[0]?.amount, 2);
  ({ f, r } = JSON.parse(JSON.stringify({ f, r })));
  assert.equal(step(f, r).filter(e => e.t === 'pickup').length, 0);
  r.loadout[1] = null;
  step(f, r);
  assert.equal(r.loadout[1].n, 2);
  assert.equal(f.ents.length, 0);
});

test('회수품 묶음: 가방 여섯 칸 포화 후 남은 점검표는 재방문 때 한 번만 획득', () => {
  const f = I.createField(72), r = I.createItemRun('jyaldi');
  for (let i = 0; i < 5; i++) I.addRelic(r, 'photo');
  ground(f, 'relic', 'checklist', 2);
  assert.equal(step(f, r).find(e => e.t === 'pickup')?.amount, 1);
  assert.equal(f.ents[0]?.amount, 1);
  assert.ok(step(f, r, { interact: true }).some(e => e.t === 'full'));
  r.bag[0] = null;
  step(f, r);
  assert.equal(r.bag.filter(x => x?.id === 'checklist').length, 2);
  assert.equal(f.ents.length, 0);
});

test('탄약 포화: 1발만 보충한 상자의 나머지 7발을 저장하고 재장전 뒤 회수', () => {
  let f = I.createField(73), r = I.createItemRun('jyaldi');
  r.reserve = I.SIGNATURES.jyaldi.reserveMax - 1;
  ground(f, 'ammo');
  step(f, r);
  assert.equal(r.reserve, 32);
  assert.equal(f.ents.length, 1, '남은 탄약이 사라지면 안 됨');
  ({ f, r } = JSON.parse(JSON.stringify({ f, r })));
  r.mag = 0;
  I.startReload(r); I.tickRun(r, 1);
  step(f, r);
  assert.equal(r.mag, 8);
  assert.equal(r.reserve, 31);
  assert.equal(f.ents.length, 0);
});

test('체력 최대에서는 바닥 회복을 남기고, 부상 뒤 한 번만 획득', () => {
  const f = I.createField(74), r = I.createItemRun('jyaldi');
  ground(f, 'heal');
  assert.equal(step(f, r, {}, { hp: 100, max: 100 }).filter(e => e.t === 'pickup').length, 0);
  assert.equal(f.ents.length, 1);
  assert.equal(step(f, r, {}, { hp: 50, max: 100 }).filter(e => e.t === 'pickup').length, 1);
  assert.equal(step(f, r, {}, { hp: 50, max: 100 }).filter(e => e.t === 'pickup').length, 0);
});

test('0개 보급품은 새 출동에서 생성·사용되지 않는다', () => {
  const r = I.createItemRun('jyaldi', [{ id: 'medkit', n: 0 }]);
  assert.equal(r.loadout[0], null);
  assert.equal(I.useItem(r, 0, { hp: 1, max: 100 }), null);
  I.addItem(r, 'medkit', 1);
  assert.equal(I.addItem(r, 'medkit', -1), 0);
  assert.equal(r.loadout[0].n, 1);
});

test('한 틱 회복 조각 여러 개와 회복약 입력: 필요한 조각만 소비하고 약은 남긴다', () => {
  const f = I.createField(74), r = I.createItemRun('jyaldi', [{ id: 'medkit', n: 1 }]);
  ground(f, 'heal'); ground(f, 'heal');
  const ctx = { hp: 99, max: 100 };
  const ev = step(f, r, { use: 0 }, ctx);
  assert.equal(ev.filter(e => e.t === 'pickup').length, 1);
  assert.equal(ev.filter(e => e.t === 'use').length, 0);
  assert.equal(f.ents.length, 1);
  assert.equal(r.loadout[0].n, 1);
  assert.equal(ctx.hp, 99, '호출자의 상태는 실제 엔진 효과 적용 전 수정하지 않음');
});

test('폭발 후 같은 공격의 오래된 물건 참조가 중복 드랍·다른 물건 삭제를 만들지 않는다', () => {
  const f = I.createField(75), r = I.createItemRun('jyaldi');
  I.placeProp(f, 'barrel', 340, 600);
  I.placeProp(f, 'crate', 390, 600);
  const outside = I.placeProp(f, 'pot', 1000, 600);
  const ev = I.attack(f, r, actor, [], { damage: 30, reach: 130 }).events;
  assert.equal(ev.filter(e => e.t === 'break' && e.prop === 'crate').length, 1);
  assert.ok(f.ents.includes(outside));
});

test('같은 종류 드럼통도 연쇄 폭발하고 각 개체는 한 번만 부서진다', () => {
  const f = I.createField(76), r = I.createItemRun('jyaldi');
  const first = I.placeProp(f, 'barrel', 340, 600);
  I.placeProp(f, 'barrel', 460, 600);
  const ev = I.damageProp(f, r, first, 30);
  assert.equal(ev.filter(e => e.t === 'break').length, 2);
  assert.equal(f.ents.length, 0);
});

for (const id of ['flash', 'smoke']) test(`방 끝에서 ${id} 투척: 소비한 한 개가 경계 밖으로 사라지지 않고 착지 효과 발생`, () => {
  const f = I.createField(77), r = I.createItemRun('jyaldi', [{ id, n: 1 }]);
  const a = { ...actor, x: f.bounds.x1 - 10 };
  const ev = step(f, r, { use: 0 }, undefined, a);
  for (let i = 0; i < 90; i++) ev.push(...step(f, r, {}, undefined, a));
  const bursts = ev.filter(e => e.t === 'burst');
  assert.equal(bursts.length, 1);
  assert.equal(bursts[0].kind, id);
  assert.ok(bursts[0].x <= f.bounds.x1 && bursts[0].x >= f.bounds.x0);
  assert.equal(r.loadout[0], null);
});

function setup() {
  const meta = { load: () => null, save() {} }, stage = I.createElevatorStage(meta);
  const run = { seed: 42, agent: 'jyaldi', stageId: 'elevator' };
  const world = new I.World(run, {}, stage), items = I.linkItems(world, run);
  world.enterFloor(stage.firstFloor(run));
  world.itemField.ents.length = 0;
  return { world, stage, run, items, meta };
}
test('실제 World 소비·회복·가방 포화·무기 교환·방 왕복·체크포인트 복원', () => {
  const { world: w, stage, run, items, meta } = setup();
  const ir = items.run, p = w.player, floor = w.floor;
  p.hp = p.hpMax / 2;
  assert.ok(w.itemUse(1));
  assert.equal(p.hp, p.hpMax * .85);
  assert.equal(ir.loadout[0].n, 1);
  assert.equal(w.itemUse(1), false, '연속 입력은 소비하지 않음');
  ir.itemCd = 0; p.hp = p.hpMax;
  assert.equal(w.itemUse(1), false);
  I.equip(ir, 'pipe', 3);
  const weapon = ground(w.itemField, 'weapon', 'smg', 1, p.x);
  weapon.y = p.y;
  w.pickHook();
  assert.equal(ir.held.id, 'smg');
  assert.equal(w.itemField.ents.find(e => e.ref === 'pipe').uses, 3);
  ir.bag.fill({ id: 'photo', name: '사진', value: 40, research: 8 });
  const check = w.props.find(q => q.kind === 'checklist');
  stage.onInteract(w.api, w.floor, check);
  assert.ok(w.props.includes(check));
  ir.bag[0] = null;
  stage.onInteract(w.api, w.floor, check);
  assert.equal(ir.bag[0].id, 'checklist');
  const field = w.itemField;
  w.enterFloor({ ...floor, id: 'items-round2-return-fixture', props: [], encounters: [] });
  w.enterFloor(floor);
  assert.equal(w.itemField, field);
  const saved = JSON.parse(JSON.stringify({ stage: stage.snapshot(), world: w.snapshot() }));
  const st2 = I.createElevatorStage(meta), w2 = new I.World(run, {}, st2), i2 = I.linkItems(w2, run);
  w2.enterFloor(st2.restore(saved.stage)); w2.restore(saved.world);
  assert.equal(i2.run.loadout[0].n, 1);
  assert.equal(i2.run.held.id, 'smg');
  assert.equal(w2.itemField.ents.filter(e => e.ref === 'pipe').length, 1);
  assert.equal(i2.run.bag.filter(e => e?.id === 'checklist').length, 1);
  assert.equal(w2.props.some(e => e.id === check.id), false);
});

test('공용 연결: 임시 무기 두 번째 타격도 실제 적에게 피해, 처치는 한 번 기록', () => {
  const { world: w, items } = setup();
  const p = w.player;
  const enemy = I.createEnemy('fb_smg', p.x + 60, p.y, () => .5);
  enemy.set('idle'); enemy.hp = enemy.hpMax = 40;
  w.bodies.push(enemy);
  const deaths = []; w.on(e => { if (e.type === 'enemyDie' && e.kind === enemy.kind) deaths.push(e); });
  I.equip(items.run, 'pipe');
  p.itemAct('attack');
  assert.equal(enemy.hp, 18);
  p.itemAct('attack');
  assert.ok(enemy.hp <= 0, `두 번째 타격 뒤 HP=${enemy.hp}`);
  assert.equal(deaths.length, 1);
  assert.equal(w.kills, 1);
});

test('공용 연결: 섬광탄이 실제 Enemy를 2초 기절시키고 피해를 만들지 않는다', () => {
  const { world: w, items } = setup();
  const p = w.player;
  const enemy = I.createEnemy('fb_smg', p.x + 180, p.y, () => .5);
  enemy.set('idle'); w.bodies.push(enemy);
  const hp = enemy.hp;
  items.run.loadout[0] = { id: 'flash', n: 1 };
  w.itemUse(1);
  for (let i = 0; i < 40; i++) items.tick();
  assert.equal(enemy.state, 'stunned');
  assert.equal(enemy.stunT, 60);
  assert.equal(enemy.hp, hp);
});

test('공용 연결: 연막 안의 실제 적은 둔화되고 영역을 벗어나면 회복', () => {
  const { world: w, items } = setup();
  const enemy = I.createEnemy('fb_smg', w.player.x + 180, w.player.y, () => .5);
  enemy.set('idle'); w.bodies.push(enemy);
  const speed = enemy.speed();
  w.itemField.zones.push({ kind: 'smoke', x: enemy.x, y: enemy.y, r: 200, t: 0, life: 5, slow: .4 });
  items.tick();
  assert.equal(enemy.speed(), speed * .6);
  enemy.x += 400;
  for (let i = 0; i < 3; i++) { w.tick++; enemy.step(w); items.tick(); }
  assert.equal(enemy.speed(), speed);
});
