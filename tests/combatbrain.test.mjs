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
