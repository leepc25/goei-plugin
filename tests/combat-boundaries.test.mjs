import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: `
export { World } from './src/game/action/engine/world';
export { linkItems } from './src/game/action/engine/itemsLink';
export { createEnemy } from './src/game/action/enemy';
export { equip } from './src/game/action/items';
export { newSave } from './src/game/action/hq/state';
export { launch } from './src/game/action/hq/logic';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const clips = JSON.parse(readFileSync('game-pack/jyaldi/frames.json', 'utf8')).clips;
const idle = { mx: 0, my: 0, evade: false, run: false, downDouble: false, held: new Set(), pressed: new Set(), released: new Set() };
const floor = { id: 'combat-boundaries', title: 'combat-boundaries', type: 'lobby', length: 5000, lane: [440,690], startX: 500, exitX: Infinity, encounters: [], props: [] };
function setup({ charge = 1, xp = 0 } = {}) {
  const save = M.newSave(); save.agents.jyaldi.xp = xp;
  const launch = M.launch(save, 'm1', 42);
  Object.assign(launch.stats, { power: 1, aim: 1, charge });
  const run = { agent: 'jyaldi', seed: 42, stageId: 'elevator', launch };
  const world = new M.World(run, clips, null), items = M.linkItems(world, run);
  world.hooks.push(() => items.tick());
  world.enterFloor({ ...floor }); world.itemField.ents.length = 0;
  world.player.x = world.player.px = 500; world.player.y = world.player.py = 565;
  return { world, items };
}
function enemy(c, distance = 70, hp = 300, kind = 'fb_smg') {
  const e = M.createEnemy(kind, c.world.player.x + distance, c.world.player.y, () => .5);
  e.set('idle'); e.hp = e.hpMax = hp;
  // 행동 선택만 고정하고 피격/가드/기절/죽음/물리는 실제 Enemy 경로를 사용한다.
  e.brain = { think() {} };
  c.world.add(e); return e;
}
function step(c, n = 1, pad = idle) { for (let i = 0; i < n; i++) c.world.step(pad); }

for (const weapon of ['pipe', 'servicepistol']) test(`${weapon}: 실제 적 명중·처치 게이지와 콤보에 본부 충전 배율 적용`, () => {
  const c = setup({ charge: 1.5 });
  const e = enemy(c, weapon === 'pipe' ? 70 : 220, 24);
  const deaths = []; c.world.on(ev => { if (ev.type === 'enemyDie') deaths.push(ev); });
  M.equip(c.items.run, weapon);
  c.world.player.itemAct(weapon === 'pipe' ? 'attack' : 'shoot');
  if (weapon !== 'pipe') step(c, 8);
  assert.ok(e.hp > 0 && e.hp < 24);
  assert.equal(c.world.player.gauge, 2.5 * 1.5);
  assert.equal(c.world.player.combo, 1);
  // 피격 이동 뒤 두 번째 실제 공격이 닿는 위치로 시험 대상을 배치한다.
  e.x = c.world.player.x + (weapon === 'pipe' ? 70 : 220); e.y = c.world.player.y;
  c.items.run.shotCd = 0;
  c.world.player.itemAct(weapon === 'pipe' ? 'attack' : 'shoot');
  if (weapon !== 'pipe') step(c, 8);
  assert.ok(e.hp <= 0);
  assert.equal(c.world.player.gauge, (2.5 + 2.5 + 4) * 1.5);
  assert.equal(c.world.player.combo, 2);
  assert.equal(c.world.kills, 1); assert.equal(deaths.length, 1);
  step(c, 30); assert.equal(c.world.kills, 1); assert.equal(deaths.length, 1);
});

test('임시 무기가 무적·정면 방패에 막히면 명중/처치 게이지를 지급하지 않는다', () => {
  for (const defense of ['invulnerable', 'shield']) {
    const c = setup({ charge: 1.5 });
    const e = enemy(c, 70, 100, defense === 'shield' ? 'fb_shield' : 'fb_smg');
    e.dir = -1;
    if (defense === 'invulnerable') e.inv = 30;
    M.equip(c.items.run, 'pipe'); c.world.player.itemAct('attack');
    assert.equal(c.world.player.gauge, 0); assert.equal(c.world.player.combo, 0);
    assert.equal(c.world.kills, 0);
  }
});

test('숙련5 필살은 실제 Enemy에게 두 번 명중하고 한 번만 처치한다', () => {
  const c = setup({ xp: 560 }); const e = enemy(c, 170, 100);
  const deaths = []; c.world.on(ev => { if (ev.type === 'enemyDie') deaths.push(ev); });
  c.world.player.gauge = 100;
  step(c, 1, { ...idle, pressed: new Set(['super']) });
  step(c, 120);
  assert.ok(e.hp <= 0); assert.equal(c.world.kills, 1); assert.equal(deaths.length, 1);
  assert.equal(c.world.player.maxCombo, 2);
});

test('지원 공격은 실제 Enemy에게 한 번 명중하고 후속 플레이어 공격 ID를 막지 않는다', () => {
  const c = setup(); const e = enemy(c, 250, 200);
  c.world.player.gauge = 50;
  step(c, 1, { ...idle, pressed: new Set(['ally']) });
  step(c, 65);
  assert.equal(e.hp, 170);
  e.set('idle'); e.x = c.world.player.x + 70; e.y = c.world.player.y; e.z = e.vz = e.vx = e.vy = 0;
  step(c, 1, { ...idle, pressed: new Set(['attack']) });
  step(c, 30);
  assert.equal(e.hp, 162);
});

test('TV 투척의 충돌 피해와 전격 폭발 피해 뒤 명시된 1초 기절을 실제 적에 적용', () => {
  const c = setup(); const e = enemy(c, 160, 100);
  c.items.run.carry = { prop: 'tv', hp: 12 };
  assert.equal(c.world.player.itemAct('attack'), 'toss');
  for (let n = 0; n < 60 && !c.world.itemField.zones.some(z => z.kind === 'shock'); n++) step(c);
  assert.ok(c.world.itemField.zones.some(z => z.kind === 'shock'));
  assert.equal(e.hp, 56, 'TV 충돌 34 + 전격 폭발 10');
  assert.equal(e.state, 'stunned'); assert.equal(e.stunT, 30);
  step(c, 29); assert.equal(e.state, 'stunned');
  step(c); assert.equal(e.state, 'idle');
});

test('TV 전격은 무적 적을 기절시키지 않고, 충돌로 처치한 적을 중복 처치하지 않는다', () => {
  for (const protectedEnemy of [true, false]) {
    const c = setup(); const e = enemy(c, 160, protectedEnemy ? 100 : 30);
    if (protectedEnemy) e.inv = 100;
    const deaths = []; c.world.on(ev => { if (ev.type === 'enemyDie') deaths.push(ev); });
    c.items.run.carry = { prop: 'tv', hp: 12 }; c.world.player.itemAct('attack');
    for (let n = 0; n < 60 && !c.world.itemField.zones.some(z => z.kind === 'shock'); n++) step(c);
    if (protectedEnemy) {
      assert.equal(e.hp, 100); assert.notEqual(e.state, 'stunned');
      assert.equal(c.world.player.gauge, 0);
    } else {
      assert.ok(e.hp <= 0); assert.equal(c.world.kills, 1); assert.equal(deaths.length, 1);
    }
  }
});
