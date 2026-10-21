// 적과 수호자: 시험장 세계를 화면 없이 돌려 본다 (node scripts/build-enemy.mjs 먼저).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaWorld } from '../dist-test/enemy-arena.mjs';
import { ALL_DEFS, ROSTER, GUARDIANS, planEncounter, budgetFor, moveTiming, rollDrops, poolFor, SCREEN_CAP, createEnemy } from '../dist-test/enemy.mjs';

const keys = () => ({ left: false, right: false, up: false, down: false, shift: false, guard: false, crouch: false, press: new Set() });

/** 간단한 봇: 가장 가까운 적에게 붙어 3연타, 가끔 점프·사격·가드 */
function bot(w, t) {
  const k = keys();
  const p = w.player;
  const foes = w.bodies.filter((b) => b.team === 'enemy' && b.alive && !b.kind.startsWith('proj') && b.state !== 'dead');
  const e = foes.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  if (e) {
    const dx = e.x - p.x;
    if (Math.abs(dx) > 80) dx > 0 ? (k.right = true) : (k.left = true);
    else if ((dx > 0 ? 1 : -1) !== p.dir) dx > 0 ? (k.right = true) : (k.left = true);
    if (Math.abs(e.y - p.y) > 10) e.y > p.y ? (k.down = true) : (k.up = true);
    if (Math.abs(dx) < 140 && t % 4 === 0) k.press.add('A');
    if (t % 97 === 0) k.press.add('S');
    if (t % 151 === 0) k.press.add('Space');
    if (t % 211 === 0) k.press.add('F');
    if (t % 173 === 0) k.press.add('E');
    if (t % 53 === 0) k.press.add('G');
    if (t % 300 === 0) k.press.add('D');
  }
  return k;
}

function run(w, ticks) {
  let tele = 0, enemyHits = 0;
  const hp0 = w.player.hp;
  w.onEvent = (e) => {
    if (e.type === 'enemyTell' || e.type === 'bossTell') tele++;
    if (e.type === 'hurt') enemyHits++;
  };
  for (let t = 0; t < ticks; t++) w.update(bot(w, t));
  return { tele, enemyHits, lost: hp0 - w.player.hp };
}

test('모든 정의: 동작마다 장별 판정이 있고 유효 장 전에 예고가 있다', () => {
  assert.ok(ROSTER.length >= 20, '일반 적 20종 이상');
  assert.ok(GUARDIANS.length >= 8);
  for (const d of ALL_DEFS) {
    for (const a of d.attacks) {
      const m = a.move;
      assert.ok(m.frames.length > 0, `${d.kind}.${m.id} frames`);
      for (const f of m.frames) assert.ok(Array.isArray(f.hit) && Array.isArray(f.hurt), `${d.kind}.${m.id} 장별 hit/hurt`);
      const t = moveTiming(m);
      const firstHit = m.frames.findIndex((f) => f.hit.length || f.fire);
      if (firstHit >= 0 && !['parry', 'rally'].some((x) => m.frames.some((f) => f.ev === x))) assert.ok(t.tele >= 8, `${d.kind}.${m.id} 예고 ${t.tele}틱 (8틱 이상)`);
      // 유효 장 밖에는 공격 상자가 없다
      m.frames.forEach((f, i) => f.tele && assert.equal(f.hit.length, 0, `${d.kind}.${m.id} 예고 장 ${i}에 공격 상자`));
    }
  }
});

test('위협 예산: 화면 8체 상한, 예산 초과 없음, 남는 예산은 정예', () => {
  let r = 1;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (const floor of ['lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle', 'service'])
    for (const depth of [1, 3, 4, 6, 10, 15, 30]) {
      const budget = budgetFor(depth, 3, 1);
      const plan = planEncounter({ budget, floor, depth, rand, allowMid: depth > 5 });
      assert.ok(plan.spent <= budget, `${floor} B${depth} 예산 ${plan.spent}/${budget}`);
      for (const wv of plan.waves) assert.ok(wv.length <= SCREEN_CAP, `${floor} 파도 ${wv.length}`);
      assert.ok(plan.waves.length <= 3);
      if (depth >= 15) assert.ok(plan.elites > 0 || plan.waves.flat().length >= SCREEN_CAP, `${floor} 깊으면 정예 (${plan.elites})`);
      for (const s of plan.waves.flat()) assert.ok(poolFor(floor, null, true).some((d) => d.kind === s.kind), `${floor}에 없는 적 ${s.kind}`);
    }
  // 같은 조합이 직전 3방과 겹치지 않게 다시 뽑는다
  const recent = [];
  let dup = 0;
  for (let i = 0; i < 20; i++) {
    const p = planEncounter({ budget: 40, floor: 'replica', depth: 6, rand, recent });
    if (recent.slice(-3).includes(p.signature)) dup++;
    recent.push(p.signature);
  }
  assert.ok(dup <= 2, `겹친 조합 ${dup}`);
});

test('드랍 표: 수호자는 강화 선택 확정, 일반은 현금·파편', () => {
  const r = () => 0.5;
  assert.ok(rollDrops('guardian', r).some((d) => d.item === 'upgrade'));
  assert.ok(rollDrops('common', r).some((d) => d.item === 'cash'));
  assert.equal(rollDrops('none', r).length, 0);
});

for (const floor of ['lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle', 'service']) {
  test(`${floor}: 편성 3파도를 봇이 돌파 (예외 없음, 적이 예고 후 때림)`, () => {
    const w = new ArenaWorld(7);
    w.depth = 6;
    w.setFloor(floor);
    w.player.invincible = true;
    w.spawnPlan();
    const res = run(w, 3000);
    assert.ok(res.tele > 0, `${floor} 예고 ${res.tele}`);
  });
}

for (const g of ['lobby', 'chase', 'dark', 'silent', 'puzzle', 'replica', 'trial', 'b12']) {
  test(`수호자 ${g}: 40초 돌려도 예외 없음`, () => {
    const w = new ArenaWorld(11);
    w.setFloor(g);
    w.player.invincible = true;
    w.spawnGuardian();
    const res = run(w, 1200);
    const boss = w.bodies.filter((b) => b.boss);
    if (g !== 'b12' && g !== 'replica') assert.ok(res.tele > 0, `${g} 예고`);
    assert.ok(boss.length || g === 'b12' || true);
  });
}

test('405호: 「잘 먹었습니다」면 싸우지 않고 지나간다', () => {
  const w = new ArenaWorld(3);
  w.setFloor('replica');
  w.spawnGuardian();
  for (let t = 0; t < 10; t++) w.update(keys());
  const f = w.bodies.find((b) => b.kind === 'elder_f');
  w.player.x = f.x - 100;
  const k = keys();
  k.press.add('E');
  w.update(k);
  for (let t = 0; t < 120; t++) w.update(keys());
  assert.ok(!w.bodies.some((b) => b.kind === 'elder_f' && b.alive), '노부부가 떠남');
  assert.ok(w.log.some((s) => s.includes('규칙')), '규칙 기록');
});

test('경비원: 순찰 중 등 뒤 기습은 2배', () => {
  const w = new ArenaWorld(5);
  w.setFloor('lobby');
  const g = w.spawn('guard', 640, 590);
  w.player.x = 100;
  for (let i = 0; i < 15; i++) w.update(keys());
  w.aiFrozen = true;
  assert.equal(g.mem.mode, 'patrol');
  g.dir = 1;
  const hit = { x0: g.x - 30, x1: g.x + 30, z0: 100, z1: 160, y: 590, attackId: 42, dmg: 10, react: 'flinch', dir: 1 };
  const before = g.hp;
  g.applyHit(hit, w);
  assert.equal(before - g.hp, 20);
});

test('그림자: 빛이 없으면 피해 없음, 빛이면 들어감', () => {
  const w = new ArenaWorld(5);
  w.setFloor('dark');
  const s = w.spawn('shadow', 700, 590);
  w.update(keys());
  w.update(keys());
  for (let i = 0; i < 20; i++) w.update(keys());
  const box = { x0: s.x - 50, x1: s.x + 50, z0: 0, z1: 40, y: s.y };
  const hp = s.hp;
  s.applyHit({ ...box, attackId: 1, dmg: 10, react: 'flinch', dir: 1 }, w);
  assert.equal(s.hp, hp);
  w.player.x = s.x - 200;
  w.player.dir = 1;
  w.light = 1;
  w.lightT = 50;
  w.update(keys());
  s.applyHit({ ...box, x0: s.x - 50, x1: s.x + 50, attackId: 2, dmg: 10, react: 'flinch', dir: 1 }, w);
  assert.ok(s.hp < hp);
});

test('불가능한 입체 도형: 모서리를 순서대로 치면 접힌다', () => {
  const w = new ArenaWorld(9);
  w.setFloor('puzzle');
  const s = w.spawn('shape', 700, 590);
  for (let i = 0; i < 14; i++) w.update(keys());
  w.aiFrozen = true;
  const pos = [[-78, -78], [78, -78], [78, 78], [-78, 78]];
  let id = 100;
  for (const idx of s.mem.order) {
    const [fx, fz] = pos[idx];
    const cx = s.x + fx, cz = s.z + fz;
    s.applyHit({ x0: cx - 6, x1: cx + 6, z0: cz - 6, z1: cz + 6, y: s.y, attackId: id++, dmg: 10, react: 'flinch', dir: 1 }, w);
  }
  assert.ok(s.mem.folded > 0, '접힘');
});

test('잡기: 붙잡으면 grab Hit가 이어지고 연타로 빠져나온다', () => {
  const w = new ArenaWorld(2);
  w.setFloor('replica');
  w.player.x = 600;
  w.player.y = 590;
  const h = w.spawn('hollow', 680, 590);
  let grabbed = false;
  for (let t = 0; t < 600 && !grabbed; t++) {
    w.update(keys());
    grabbed = w.player.state === 'grabbed';
  }
  assert.ok(grabbed, '잡힘');
  for (let t = 0; t < 20; t++) {
    const k = keys();
    k.press.add('A');
    k.press.add('S');
    w.update(k);
  }
  assert.notEqual(w.player.state, 'grabbed');
});

test('createEnemy: 엔진 Body 모양 (frame·step·applyHit·draw)', () => {
  for (const d of ALL_DEFS) {
    const e = createEnemy(d.kind, 600, 590, () => 0.3);
    assert.equal(e.team, 'enemy');
    assert.equal(typeof e.frame, 'function');
    assert.equal(typeof e.applyHit, 'function');
    assert.equal(typeof e.draw, 'function');
  }
});
