import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, step, serialize, restore } from '../dist-test/action-sim.mjs';
const tick = (r, seconds, input = { x: 0, y: 0 }) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) step(r, input, 1 / 60);
};
const bullet = (r, { front = true, height = 82 } = {}) => {
  const p = r.player;
  r.bolts.push({
    id: r.nextId++,
    x: p.x + (front ? 40 : -40),
    y: p.y,
    z: height,
    vx: front ? -1000 : 1000,
    life: 1,
    enemy: true,
  });
};
test('자동으로 동일 전투 규칙 안에서 방을 완주한다', () => {
  const r = newRun();
  r.auto = true;
  tick(r, 120);
  assert.equal(r.phase, 'cleared');
  assert.equal(r.kills, 4);
  assert.ok(r.player.hp > 0);
  assert.ok(r.time > 5);
});
test('저장 복귀 후 공격·난사체·자동 진행 결과가 동일하다', () => {
  const r = newRun();
  r.auto = true;
  tick(r, 2);
  const copy = restore(serialize(r));
  assert.ok(copy);
  tick(r, 30);
  tick(copy, 30);
  assert.deepEqual({ ...copy, effects: [] }, { ...r, effects: [] });
});
test('숨겨진 시간처럼 큰 dt가 와도 한 틱 이상 따라잡지 않는다', () => {
  const r = newRun();
  step(r, { x: 1, y: 0 }, 1000);
  assert.ok(r.time <= 1 / 30);
  assert.ok(r.player.x < 230);
});
test('가드는 앞 공격만 방어하며 낮은 자세는 높은 탄환을 피한다', () => {
  const r = newRun();
  r.player.act = 'guard';
  bullet(r);
  step(r, { x: 0, y: 0, guard: true }, 1 / 60);
  assert.equal(r.player.hp, 200);
  assert.ok(r.player.guard < 100);
  bullet(r, { front: false });
  step(r, { x: 0, y: 0, guard: true }, 1 / 60);
  assert.equal(r.player.hp, 188);
  const low = newRun();
  low.player.act = 'crouch';
  bullet(low);
  step(low, { x: 0, y: 1, guard: true }, 1 / 60);
  assert.equal(low.player.hp, 200);
  assert.equal(low.player.guard, 100);
});
test('회피 무적과 슈퍼아머는 피해 처리에서 독립된다', () => {
  const r = newRun();
  step(r, { x: 1, y: 0, dash: true }, 1 / 60);
  bullet(r);
  step(r, { x: 0, y: 0 }, 1 / 60);
  assert.equal(r.player.hp, 200);
  const a = newRun();
  a.player.armor = true;
  a.player.act = 'skill';
  a.player.duration = 0.62;
  bullet(a);
  step(a, { x: 0, y: 0 }, 1 / 60);
  assert.equal(a.player.hp, 188);
  assert.equal(a.player.act, 'skill');
});
test('방향키의 대각 이동이 더 빠르지 않고 점프와 공격을 함께 시작할 수 있다', () => {
  const a = newRun(),
    b = newRun();
  step(a, { x: 1, y: 0 }, 1 / 60);
  step(b, { x: 1, y: 1 }, 1 / 60);
  assert.ok(Math.abs(Math.hypot(b.player.x - 220, b.player.y - 510) - (a.player.x - 220)) < 1e-8);
  const r = newRun();
  step(r, { x: 0, y: 0, jump: true, attack: true }, 1 / 60);
  assert.ok(r.player.vz > 0);
  assert.equal(r.player.act, 'shot');
});
test('소모품은 효과가 있을 때만 쓰고 종류별 자원을 복구한다', () => {
  const r = newRun();
  step(r, { x: 0, y: 0, item: 0 }, 1 / 60);
  assert.equal(r.player.items[0], 3);
  r.player.hp = 100;
  step(r, { x: 0, y: 0, item: 0 }, 1 / 60);
  assert.equal(r.player.hp, 170);
  assert.equal(r.player.items[0], 2);
  r.player.energy = 10;
  step(r, { x: 0, y: 0, item: 2 }, 1 / 60);
  assert.equal(r.player.energy, 100);
  assert.equal(r.player.items[2], 1);
});
test('적은 준비 동작 후 공격하고 치명상은 후송으로 끝난다', () => {
  const r = newRun();
  r.enemies[0].x = r.player.x + 60;
  r.enemies[0].y = r.player.y;
  step(r, { x: 0, y: 0 }, 1 / 60);
  assert.equal(r.enemies[0].act, 'shot');
  assert.equal(r.player.hp, 200);
  tick(r, 0.6);
  assert.ok(r.player.hp < 200);
  const fatal = newRun();
  fatal.player.hp = 1;
  bullet(fatal);
  step(fatal, { x: 0, y: 0 }, 1 / 60);
  assert.equal(fatal.phase, 'evacuated');
  assert.match(fatal.message, /후송/);
});
test('잘못된 저장·구형 순찰·비정상 값은 실행하지 않는다', () => {
  assert.equal(restore('{'), null);
  assert.equal(restore('{"version":1,"squad":[]}'), null);
  for (const mutate of [
    (r) => (r.player.hp = -1),
    (r) => (r.player.items = [999, 0, 0]),
    (r) => (r.enemies[0].id = 1),
    (r) => (r.bolts = [{ vx: Infinity }]),
    (r) => (r.phase = 'cleared'),
    (r) => (r.nextId = -1),
  ]) {
    const r = newRun();
    mutate(r);
    assert.equal(restore(serialize(r)), null);
  }
  assert.ok(restore(serialize(newRun())));
});
