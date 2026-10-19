import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRun, step, serialize, restore } from '../dist-test/action-sim.mjs';
const tick = (r, seconds, input = { x: 0, y: 0 }) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) step(r, input, 1 / 60);
};
const bullet = (r, { front = true, height = 135 } = {}) => {
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

test('근접 Z는 3연계 후 다운을 만들고 먼 표적에는 사격한다', () => {
  const r = newRun();
  r.player.gauge = 0;
  r.enemies.forEach((e, i) => {
    e.x = i ? 1200 : 300;
    e.y = i ? 650 : 510;
    e.cooldown = 9;
  });
  r.enemies[0].hp = r.enemies[0].max = 500;
  const seen = new Set();
  for (let i = 0; i < 90; i++) {
    step(r, { x: 0, y: 0, attack: true }, 1 / 60);
    seen.add(r.player.act);
  }
  assert.ok(seen.has('melee1') && seen.has('melee2') && seen.has('melee3'));
  assert.ok(r.enemies[0].hp < 500);
  assert.equal(r.bolts.length, 0);
  const distant = newRun();
  step(distant, { x: 0, y: 0, attack: true }, 1 / 60);
  assert.equal(distant.player.act, 'shot');
});
test('보행 위상은 실제 거리만 누적하고 벽에서 미끄러지지 않는다', () => {
  const r = newRun();
  step(r, { x: 1, y: 0 }, 1 / 60);
  assert.ok(r.player.stride > 0);
  const before = r.player.stride;
  step(r, { x: 0, y: 0 }, 1 / 60);
  assert.equal(r.player.stride, before);
  r.player.x = 1225;
  step(r, { x: 1, y: 0 }, 1 / 60);
  assert.equal(r.player.stride, before);
  assert.equal(r.player.speed, 0);
  const fast = newRun(),
    slow = newRun();
  step(fast, { x: 1, y: 0, run: true }, 1 / 60);
  step(slow, { x: 1, y: 0 }, 1 / 60);
  assert.equal(fast.player.act, 'run');
  assert.ok(fast.player.x > slow.player.x);
});

// 표시 크기 변경 후 회피 속도와 바닥 범위가 저장 복원을 깨뜨리지 않아야 한다.
test('일반 체형 회피 도중 저장과 이전 바닥 좌표를 복원한다', () => {
  const r = newRun();
  tick(r, 0.18, { x: 1, y: 0, dash: true });
  assert.ok(restore(serialize(r)), '회피 중 최대 속도의 부동소수 오차를 허용');
  const old = newRun();
  old.version = 2;
  old.player.y = 400;
  old.enemies[0].y = 440;
  const migrated = restore(serialize(old));
  assert.ok(migrated);
  assert.equal(migrated.player.y, 480);
  assert.equal(migrated.enemies[0].y, 480);
});

test('명중 접촉 자세를 유지하고 정지 뒤 밀리며 같은 일격은 중복 피해가 없다', () => {
  const r = newRun();
  r.practice = true;
  r.enemies.forEach((e, i) => {
    e.x = i ? 1200 : 300;
    e.y = i ? 670 : 510;
  });
  step(r, { x: 0, y: 0, attack: true }, 1 / 30);
  for (let i = 0; i < 10 && !r.hitstop; i++) step(r, { x: 0, y: 0 }, 1 / 30);
  assert.ok(r.hitstop > 0);
  assert.equal(r.player.t, 5 / 60, '낮은 FPS에서도 접촉 시점을 유지');
  assert.equal(r.enemies[0].x, 300, '명중 직후 순간이동하지 않음');
  const hp = r.enemies[0].hp,
    t = r.player.t,
    age = r.effects[0].t;
  step(r, { x: 0, y: 0, attack: true }, 1 / 60);
  assert.equal(r.player.t, t);
  assert.equal(r.enemies[0].x, 300);
  assert.ok(r.player.attackBuffer > 0, '히트스톱 중 입력 수신');
  assert.ok(r.effects[0].t > age, '섬광은 정지 중에도 진행');
  tick(r, 0.14);
  assert.ok(r.enemies[0].x > 300);
  assert.equal(r.enemies[0].hp, hp);
  const miss = newRun();
  miss.practice = true;
  miss.player.act = 'melee1';
  miss.player.duration = 16 / 60;
  tick(miss, 0.2);
  assert.equal(miss.hitstop, 0, '헛치면 멈추지 않음');
});

test('걷기와 달리기의 실제 거리 위상은 서로 다른 보폭을 사용한다', () => {
  for (const [run, stride] of [
    [false, 160],
    [true, 192],
  ]) {
    const r = newRun();
    step(r, { x: 1, y: 0, run }, 1 / 60);
    assert.ok(Math.abs(r.player.stride - (r.player.x - 220) / stride) < 1e-9);
  }
});

test('앉아 이동·하단차기·공중차기·대시공격이 전용 상태로 실행된다', () => {
  const low = newRun();
  low.practice = true;
  step(low, { x: 0, y: 1, guard: true }, 1 / 60);
  const x = low.player.x;
  step(low, { x: 1, y: 0, guard: true }, 1 / 60);
  assert.equal(low.player.act, 'crouchwalk');
  assert.ok(low.player.x > x);
  step(low, { x: 0, y: 0, guard: true, attack: true }, 1 / 60);
  assert.equal(low.player.act, 'lowkick');
  const air = newRun();
  air.practice = true;
  air.enemies[0].x = 300;
  air.enemies[0].y = 510;
  step(air, { x: 0, y: 0, jump: true, attack: true }, 1 / 60);
  assert.equal(air.player.act, 'airattack');
  tick(air, 0.15);
  assert.ok(air.enemies[0].hp < air.enemies[0].max);
  const dash = newRun();
  step(dash, { x: 1, y: 0, run: true, attack: true }, 1 / 60);
  assert.equal(dash.player.act, 'dashattack');
  assert.ok(restore(serialize(low)) && restore(serialize(air)) && restore(serialize(dash)));
});

test('패배·승리 상태에서도 본체 동작 시간이 진행된다', () => {
  const loss = newRun();
  loss.player.hp = 1;
  bullet(loss);
  step(loss, { x: 0, y: 0 }, 1 / 60);
  assert.equal(loss.player.act, 'defeat');
  tick(loss, 0.5);
  assert.ok(loss.player.t >= 0.49);
  const win = newRun();
  win.enemies.forEach((e) => {
    e.hp = 0;
    e.act = 'dead';
  });
  step(win, { x: 0, y: 0 }, 1 / 60);
  assert.equal(win.player.act, 'victory');
  tick(win, 0.5);
  assert.ok(win.player.t >= 0.49);
});
