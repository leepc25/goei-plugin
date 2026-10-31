import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-combat-'));
await build({ entryPoints: ['src/game/combat/brain.ts', 'src/game/world/rng.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const B = await import(pathToFileURL(join(dir, 'game/combat/brain.mjs')));
const R = await import(pathToFileURL(join(dir, 'game/world/rng.mjs')));

const persona = { aggression: 0.6, patience: 0.5, zoning: 0.3, courage: 0.6 };
const me = (o = {}) => ({ x: 600, y: 560, z: 0, face: 1, free: true, air: false, stunned: false, hp: 1, sp: 0, guard: 100, ...o });
const foe = (o = {}) => ({ x: 900, y: 560, z: 0, attacking: false, recovering: false, air: false, down: false, hp: 1, ...o });
const run = (brain, n, m, f) => { const all = []; for (let i = 0; i < n; i++) { const d = brain.tick(typeof m === 'function' ? m(i) : m, typeof f === 'function' ? f(i) : f); all.push(d); } return all; };
const pressed = (ds) => ds.flatMap((d) => d.press);
const held = (ds) => ds.flatMap((d) => [...d.hold]);

test('난이도: 쉬움이 악몽보다 반응이 느리다', () => {
  const mk = (d) => new B.FighterBrain('a', 'B', d, persona, R.mulberry32(1));
  assert.ok(mk('easy').reactTicks > mk('normal').reactTicks);
  assert.ok(mk('normal').reactTicks > mk('nightmare').reactTicks);
  assert.ok(mk('nightmare').reactTicks >= 2);
});

test('멀리 있으면 상대 쪽으로 걷거나 달린다', () => {
  const br = new B.FighterBrain('a', 'B', 'normal', { ...persona, zoning: 0 }, R.mulberry32(2));
  const ds = run(br, 60, me({ x: 200 }), foe({ x: 1200 }));
  const h = held(ds);
  assert.ok(h.includes('right'), '오른쪽(상대 쪽) 이동');
  assert.ok(!h.includes('left') || h.filter((b) => b === 'right').length > h.filter((b) => b === 'left').length);
});

test('붙어 있으면 공격 버튼을 누른다', () => {
  const br = new B.FighterBrain('a', 'B', 'normal', { ...persona, aggression: 1 }, R.mulberry32(3));
  const p = pressed(run(br, 120, me({ x: 600 }), foe({ x: 660 })));
  assert.ok(p.some((b) => ['light', 'heavy', 'skill', 'charge', 'super'].includes(b)), p.join(','));
});

test('상대 공격에 방어(막기·회피)로 반응한다 — 반응 지연 뒤', () => {
  let any = false;
  for (let s = 1; s <= 10 && !any; s++) {
    const br = new B.FighterBrain('a', 'S', 'nightmare', persona, R.mulberry32(s));
    const ds = run(br, 30, me({ x: 600 }), foe({ x: 680, attacking: true }));
    any = ds.some((d) => d.hold.has('block') || d.press.includes('dodge') || d.press.includes('block'));
  }
  assert.ok(any);
});

test('맞고 있으면 아무것도 안 누른다', () => {
  const br = new B.FighterBrain('a', 'B', 'normal', persona, R.mulberry32(4));
  const ds = run(br, 20, me({ stunned: true }), foe({ x: 660 }));
  assert.equal(pressed(ds).length, 0);
});

test('콤보 경로: 등급이 높을수록 긴 경로까지', () => {
  assert.ok(B.ROUTES.length >= 4);
  assert.ok(B.ROUTES.every((r) => r.seq.length >= 1 && r.diff >= 1));
});

test('지휘: 한 표적 공격 무게 상한', () => {
  const sq = new B.Squad(3);
  const t = {};
  assert.ok(sq.borrow(t, 'a', 2));
  assert.ok(!sq.borrow(t, 'b', 2));
  assert.ok(sq.borrow(t, 'b', 1));
  sq.give(t, 'a');
  assert.ok(sq.borrow(t, 'c', 2));
});

test('필살 정책·저스트 회피 등급', () => {
  assert.equal(B.DIFF.easy.justDodge, null);
  assert.ok(B.gradeAtLeast('A', B.DIFF.normal.justDodge));
  assert.ok(!B.gradeAtLeast('C', B.DIFF.normal.justDodge));
  assert.ok(!B.gradeAtLeast('S', B.DIFF.easy.justDodge));
});

test('같은 씨앗이면 같은 판단', () => {
  const go = () => pressed(run(new B.FighterBrain('a', 'B', 'normal', persona, R.mulberry32(9)), 200, (i) => me({ x: 400 + i }), (i) => foe({ x: 800 - i, attacking: i % 40 < 6 }))).join(',');
  assert.equal(go(), go());
});

test('인물마다 가진 동작만: 점프 공격·사격·기술이 없는 몸은 그것을 계획하지 않고, 용기 낮으면 뒷걸음질 → 달아남', () => {
  const pressed = new Set();
  const b = new B.FighterBrain('x', 'B', 'normal', { aggression: 0.9, patience: 0.2, zoning: 0.9, courage: 0.9 }, R.mulberry32(5), undefined, {}, { jumpAtk: false, jump: false, shoot: false, skill: false, charge: false, super: false });
  const me = (x) => ({ x, y: 560, z: 0, face: 1, free: true, air: false, stunned: false, hp: 1, sp: 100, guard: 100 });
  const foe = (x) => ({ x, y: 560, z: 0, attacking: false, recovering: false, air: false, down: false, hp: 1 });
  for (let t = 0; t < 3000; t++) { const d = b.tick(me(400), foe(400 + 120 + (t % 400))); d.press.forEach((p) => pressed.add(p)); }
  for (const p of ['jump', 'shoot', 'skill', 'charge', 'super']) assert.ok(!pressed.has(p), `${p} 를 눌렀다`);
  const c = new B.FighterBrain('y', 'B', 'normal', { aggression: 0.2, patience: 0.5, zoning: 0.2, courage: 0.1 }, R.mulberry32(6), undefined, {}, { flee: true, back: true });
  const held = new Set();
  for (let t = 0; t < 400; t++) { const d = c.tick({ ...me(400), hp: 0.3 }, foe(520)); d.hold.forEach((h) => held.add(h)); }
  assert.equal(c.strategy, 'flee');
  assert.ok(held.has('back') && held.has('flee'), [...held].join(','));
});

test('다운되면 바로 또는 10~20틱 뒤 일어나기(점프)를 누른다 — 누운 채 무적으로 멈추지 않는다 (QC 2026-10-28)', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const br = new B.FighterBrain('a', 'B', 'normal', persona, R.mulberry32(seed));
    const ds = run(br, 30, me({ free: false, stunned: true, lying: true }), foe({ x: 700 }));
    const at = ds.findIndex((d) => d.press.includes('jump'));
    assert.ok(at === 0 || (at >= 10 && at <= 21), `씨앗 ${seed}: ${at}틱에 일어남`);
    assert.ok(ds.every((d) => d.press.every((b) => b === 'jump')), '누운 동안 다른 버튼은 누르지 않는다');
  }
  // 스턴(서서 휘청임)은 연타로 빨리 풀지 않는다: 누르지 않음
  const st = new B.FighterBrain('a', 'B', 'normal', persona, R.mulberry32(5));
  assert.deepEqual(pressed(run(st, 30, me({ free: false, stunned: true, lying: false }), foe({ x: 700 }))), []);
});
