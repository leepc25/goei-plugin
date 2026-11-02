// NPC 샤워 (11-02): 같은 성별 샤워실의 빈 샤워 자리에서 옷 벗기 → 머리감기·몸씻기(문지르는 구간만 속도 차등) → 옷 입기, 현실 10분 이상
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-npcshower-'));
await build({ entryPoints: ['src/game/world/rng.ts', 'src/game/world/places.ts', 'src/game/world/actors.ts', 'src/game/action/fighter/shower.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)));
const R = await imp('game/world/rng'), P = await imp('game/world/places'), A = await imp('game/world/actors'), S = await imp('game/action/fighter/shower');

const scenes = [
  { id: 'b1', name: '지하 1층', length: 2400, lane: [420, 669], doors: [{ id: 'shower_f', x: 400, kind: 'door', to: 'bath_f', toDoor: 'out' }] },
  { id: 'bath_f', name: '샤워실(여)', length: 1848, lane: [620, 836], sex: '여', showers: [{ id: 'shower2', x: 536, y: 712, face: -1 }, { id: 'shower3', x: 592, y: 636, face: -1 }], doors: [{ id: 'out', x: 1700, kind: 'exit', to: 'b1', toDoor: 'shower_f' }] },
];
const CLIPS = ['idle', 'walk', 'run', 'shower', 'nude_idle', 'nude_walk', 'nude_run', 'nude_hit', 'nude_hit2', 'nude_down', 'hit', 'down'];
const sim = () => new A.WorldSim(new P.PlaceGraph(scenes, []), R.mulberry32(5), { sceneFaction: () => 'A00', has: (_l, c) => CLIPS.includes(c) });
const woman = (w, name, x = 900) => {
  const a = w.add({ id: `npc:${name}`, name, kind: 'named', brain: 'needs', home: 'bath_f', roam: ['bath_f'], look: name }, { scene: 'bath_f', x, y: 700 });
  for (const k of Object.keys(a.needs)) a.needs[k] = 100;
  a.needs.hygiene = 0;
  return a;
};
const run = (w, sec) => { for (let t = 0; t < sec; t += 1 / 10) w.step(1 / 10, { scene: 'b1', x: 1200, y: 560 }); };

test('샤워실 종류: 이름에 「샤워」가 있으면 bathroom', () => {
  assert.equal(P.kindFromName({ name: '샤워실(여)' }), 'bathroom');
});

test('씻기 욕구가 바닥이면 빈 샤워 자리로 가서 맨몸으로 샤워(10분 이상) → 끝나면 옷 입음', () => {
  const w = sim();
  const a = woman(w, '에일린');
  for (let i = 0; i < 600 && !a.shower; i++) run(w, 0.5);
  assert.ok(a.shower, '샤워 시작');
  assert.ok(['shower2', 'shower3'].includes(a.shower.id));
  const sp = scenes[1].showers.find((s) => s.id === a.shower.id);
  assert.equal(a.x, sp.x); assert.equal(a.y, sp.y); assert.equal(a.face, sp.face);
  assert.equal(a.clip, 'shower');
  assert.equal(a.nude, true);
  assert.ok(a.clipUntil - a.clipAt >= 600, `길이 ${a.clipUntil - a.clipAt}`);
  assert.deepEqual(w.showerUsers('bath_f').map((u) => u.id), [a.shower.id]);
  run(w, 300);
  assert.ok(a.shower, '욕구가 차도 정한 시간까지는 계속');
  run(w, 500);
  assert.equal(a.shower, undefined);
  assert.equal(!!a.nude, false, '옷 입음');
});

test('콘쥬스도 다른 인물과 똑같이 샤워한다, 두 사람은 다른 자리', () => {
  const w = sim();
  const a = woman(w, '콘쥬스', 800), b = woman(w, '쟈알디', 1000);
  for (let i = 0; i < 600 && !(a.shower && b.shower); i++) run(w, 0.5);
  assert.ok(a.shower && b.shower);
  assert.notEqual(a.shower.id, b.shower.id);
});

test('주인공이 쓰는 자리는 고르지 않는다, 자리가 다 차면 기다린다', () => {
  const w = sim();
  w.playerShower = { scene: 'bath_f', id: 'shower2' };
  const a = woman(w, '에일린');
  for (let i = 0; i < 600 && !a.shower; i++) run(w, 0.5);
  assert.equal(a.shower.id, 'shower3');
  assert.ok(w.showerBusy('bath_f', 'shower2') && w.showerBusy('bath_f', 'shower3'));
  const b = woman(w, '쟈알디');
  run(w, 60);
  assert.equal(b.shower, undefined);
  assert.equal(!!b.nude, false);
});

test('샤워 중 맞으면 샤워를 끊고 맨몸 피격, 샤워실을 나가면 옷 입음', () => {
  const w = sim();
  const a = woman(w, '에일린');
  for (let i = 0; i < 600 && !a.shower; i++) run(w, 0.5);
  w.hitActor(a.def.id, 1, 2, 10);
  assert.equal(a.shower, undefined);
  assert.equal(a.nude, true);
  assert.ok(a.clip.startsWith('nude_'), a.clip);
  assert.equal(w.showerUsers('bath_f').length, 0);
  a.needs.hygiene = 100;
  a.def.roam = ['bath_f', 'b1']; a.def.home = 'b1';
  for (let i = 0; i < 600 && a.scene === 'bath_f'; i++) run(w, 0.5);
  assert.equal(a.scene, 'b1');
  assert.equal(!!a.nude, false);
});

test('NPC 샤워 장: 옷 벗기(SH_A) 한 번 → 머리감기·몸씻기 → 옷 입기(SH_A 거꾸로)', () => {
  const nOf = (id) => ({ SH_A: 10, SH_D: 8, SH_E: 8 })[id] ?? 0;
  const T = 660;
  assert.deepEqual(S.npcShowerFrame('k', 1, 0, T, nOf), { id: 'SH_A', f: 0 });
  assert.deepEqual(S.npcShowerFrame('k', 1, 1.15, T, nOf), { id: 'SH_A', f: 9 });
  const mid = new Set(); for (let t = 2; t < T - 2; t += 0.37) mid.add(S.npcShowerFrame('k', 1, t, T, nOf).id);
  assert.deepEqual([...mid].sort(), ['SH_D', 'SH_E']);
  assert.deepEqual(S.npcShowerFrame('k', 1, T - 0.01, T, nOf), { id: 'SH_A', f: 0 });
  assert.equal(S.npcShowerFrame('k', 1, T - 1, T, nOf).id, 'SH_A');
});
