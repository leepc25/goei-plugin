import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const out = await build({ stdin: { contents: `
export { World } from './src/game/action/engine/world';
export { Dummy } from './src/game/action/engine/bodies';
export { linkItems } from './src/game/action/engine/itemsLink';
export { equip, placeProp, spawnPickup } from './src/game/action/items';
export { newSave } from './src/game/action/hq/state';
export { launch } from './src/game/action/hq/logic';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const clips = JSON.parse(readFileSync('game-pack/jyaldi/frames.json', 'utf8')).clips;
const idle = { mx: 0, my: 0, evade: false, run: false, downDouble: false, held: new Set(), pressed: new Set(), released: new Set() };
const floor = { id: 'item-effects', title: 'item-effects', type: 'lobby', length: 5000, lane: [440,690], startX: 300, exitX: Infinity, encounters: [], props: [] };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

function setup(power = 1, aim = 1) {
  const launch = M.launch(M.newSave(), 'm1', 42);
  Object.assign(launch.stats, { power, aim });
  const run = { agent: 'jyaldi', seed: 42, stageId: 'elevator', launch };
  const world = new M.World(run, clips, null);
  const items = M.linkItems(world, run);
  world.hooks.push(() => items.tick());
  world.enterFloor({ ...floor });
  world.itemField.ents.length = 0;
  world.player.x = world.player.px = 300;
  world.player.y = world.player.py = 565;
  return { world, items, run };
}
function target(ctx, distance) {
  const d = new M.Dummy(ctx.world.player.x + distance, ctx.world.player.y, false);
  d.hp = d.hpMax = 1000;
  ctx.world.add(d);
  return d;
}
function tick(ctx, n = 30) { for (let i = 0; i < n; i++) ctx.world.step(idle); }
function lost(d) { return 1000 - d.hp; }

function meleeDamage(power) {
  const c = setup(power, 3);
  M.equip(c.items.run, 'pipe');
  const d = target(c, 70);
  assert.equal(c.world.player.itemAct('attack'), 'wswing');
  return lost(d);
}
test('임시 근접 무기: 실제 stepField 피해에 힘을 한 번 적용하고 사격은 섞지 않음', () => {
  near(meleeDamage(1), 22);
  near(meleeDamage(1.4), meleeDamage(1) * 1.4);
});

function gunDamage(aim, mode = 'last') {
  const c = setup(2, aim);
  M.equip(c.items.run, 'servicepistol', mode === 'last' ? 1 : 3);
  const d = target(c, 260);
  assert.equal(c.world.player.itemAct('shoot'), 'wfire');
  assert.equal(lost(d), 0, '발사 시점에는 총알이 아직 적에게 닿지 않음');
  if (mode === 'last') assert.equal(c.items.run.held, null, '마지막 탄 발사 직후 임시 총 소멸');
  if (mode === 'swap') {
    const pickup = M.spawnPickup(c.world.itemField, 'weapon', c.world.player.x, c.world.player.y, 'pipe');
    Object.assign(pickup, { z: 0, vz: 0, vx: 0, vy: 0 });
    assert.equal(c.world.pickHook(), true);
    assert.equal(c.items.run.held.id, 'pipe', '명중 전에 실제 줍기 경로로 근접 무기 교체');
  }
  tick(c);
  return lost(d);
}
test('마지막 탄: 총이 소멸한 뒤 날아간 탄환에도 발사 무기의 사격 배율 적용', () => {
  near(gunDamage(1), 13);
  near(gunDamage(1.5), gunDamage(1) * 1.5);
});
test('발사 후 무기 교체: 현재 근접 무기의 힘 대신 기존 탄환에 사격 배율 적용', () => {
  near(gunDamage(1.5, 'swap'), gunDamage(1, 'swap') * 1.5);
});

function thrownDamage(power, aim) {
  const c = setup(power, aim);
  c.items.run.carry = { prop: 'pot', hp: 8 };
  const d = target(c, 160);
  assert.equal(c.world.player.itemAct('attack'), 'toss');
  tick(c);
  return lost(d);
}
function explosionDamage(power, aim) {
  const c = setup(power, aim);
  M.equip(c.items.run, 'pipe');
  M.placeProp(c.world.itemField, 'barrel', c.world.player.x + 90, c.world.player.y);
  const d = target(c, 220);
  assert.equal(c.world.player.itemAct('attack'), 'wswing');
  assert.equal(c.world.itemField.ents.some(e => e.type === 'prop' && e.prop === 'barrel'), false);
  return lost(d);
}
test('환경 물건 투척과 파괴 폭발: 무기 힘/사격 강화가 피해에 새로 붙지 않음', () => {
  near(thrownDamage(1, 1), 18);
  near(thrownDamage(2, 3), thrownDamage(1, 1));
  near(explosionDamage(1, 1), 40);
  near(explosionDamage(2, 3), explosionDamage(1, 1));
});

test('저장 복원: 임시 무기 원래 피해와 남은 횟수 유지, 본부 배율은 명중 시 한 번 적용', () => {
  for (const weapon of ['pipe', 'servicepistol']) {
    const c = setup(1.4, 1.5);
    M.equip(c.items.run, weapon, 2);
    assert.equal(c.world.canCheckpoint(), true);
    const saved = c.world.snapshot();
    const restored = setup(1.4, 1.5);
    restored.world.restore(saved);
    assert.deepEqual(restored.items.run.held, { id: weapon, uses: 2 });
    const d = target(restored, weapon === 'pipe' ? 70 : 260);
    restored.world.player.itemAct(weapon === 'pipe' ? 'attack' : 'shoot');
    tick(restored);
    near(lost(d), weapon === 'pipe' ? 22 * 1.4 : 13 * 1.5);
    assert.equal(restored.items.run.held.uses, 1);
  }
});
