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
  { id: 'b1', name: '지하 1층', length: 2400, lane: [420, 669], doors: [{ id: 'shower_f', x: 400, kind: 'door', to: 'shower_f', toDoor: 'out' }] },
  { id: 'shower_f', name: '탈의실(여)', length: 1264, lane: [572, 836], sex: '여', lockers: [{ id: 'locker1', x: 560, y: 670, face: -1 }, { id: 'locker2', x: 600, y: 610, face: -1 }], doors: [{ id: 'out', x: 630, kind: 'exit', side: 'S', to: 'b1', toDoor: 'shower_f' }, { id: 'bath', x: 100, kind: 'exit', to: 'bath_f', toDoor: 'out' }] },
  { id: 'bath_f', name: '샤워실(여)', length: 1848, lane: [620, 836], sex: '여', showers: [{ id: 'shower2', x: 536, y: 712, face: -1 }, { id: 'shower3', x: 592, y: 636, face: -1 }], doors: [{ id: 'out', x: 1700, kind: 'exit', to: 'shower_f', toDoor: 'bath' }] },
];
const CLIPS = ['idle', 'walk', 'run', 'shower', 'undress', 'dress', 'nude_idle', 'nude_walk', 'nude_run', 'nude_hit', 'nude_hit2', 'nude_down', 'hit', 'down'];
const sim = () => new A.WorldSim(new P.PlaceGraph(scenes, []), R.mulberry32(5), { sceneFaction: () => 'A00', has: (_l, c) => CLIPS.includes(c), lineN: () => 10 });
const woman = (w, name, scene = 'b1', x = 900) => {
  const a = w.add({ id: `npc:${name}`, name, kind: 'named', brain: 'needs', home: 'b1', roam: ['b1', 'shower_f', 'bath_f'], look: name }, { scene, x, y: scene === 'b1' ? 560 : 700 });
  for (const k of Object.keys(a.needs)) a.needs[k] = 100;
  a.needs.hygiene = 0;
  return a;
};
const run = (w, sec) => { for (let t = 0; t < sec; t += 1 / 10) w.step(1 / 10, { scene: 'b1', x: 1800, y: 560 }); };
const until = (w, f, sec = 600) => { for (let t = 0; t < sec && !f(); t += 0.5) run(w, 0.5); return f(); };

test('장면 종류: 「탈의」 = locker, 「샤워」 = bathroom', () => {
  assert.equal(P.kindFromName({ name: '탈의실(여)' }), 'locker');
  assert.equal(P.kindFromName({ name: '샤워실(여)' }), 'bathroom');
});

test('탈의실 캐비닛에서 옷 벗기 → 맨몸으로 샤워실 빈 샤워기 → 씻기(10분 이상) → 탈의실로 돌아와 옷 입기', () => {
  const w = sim();
  const a = woman(w, '에일린');
  assert.ok(until(w, () => a.shower?.step === 'undress'), '탈의실에서 옷 벗기 시작');
  assert.equal(a.scene, 'shower_f');
  assert.equal(a.clip, 'undress');
  assert.equal(!!a.nude, false, '벗는 동안은 아직 옷 입은 그림');
  const L = scenes[1].lockers.find((l) => a.station === `shower_f#l:${l.id}`);
  assert.ok(L); assert.equal(a.x, L.x); assert.equal(a.y, L.y); assert.equal(a.face, L.face);
  assert.ok(until(w, () => a.nude && a.clip === 'nude_walk', 10), '맨몸으로 걷기');
  assert.ok(a.scene === 'shower_f' || a.scene === 'bath_f');
  assert.ok(until(w, () => a.shower?.step === 'wash'), '샤워기 도착');
  assert.equal(a.scene, 'bath_f');
  const sp = scenes[2].showers.find((s) => s.id === a.shower.id);
  assert.equal(a.x, sp.x); assert.equal(a.y, sp.y); assert.equal(a.face, sp.face);
  assert.equal(a.clip, 'shower');
  assert.ok(a.clipUntil - a.clipAt >= 600);
  assert.deepEqual(w.showerUsers('bath_f').map((u) => u.id), [sp.id]);
  run(w, 590);
  assert.equal(a.shower?.step, 'wash', '욕구가 차도 정한 시간까지 씻는다');
  assert.ok(until(w, () => a.shower?.step === 'dress', 300), '탈의실로 돌아와 옷 입기');
  assert.equal(a.scene, 'shower_f');
  assert.equal(a.nude, true);
  assert.equal(a.clip, 'dress', '옷 입는 동안은 맨몸 클립으로 바꾸지 않음');
  assert.ok(until(w, () => !a.shower, 5));
  assert.equal(!!a.nude, false);
});

test('콘쥬스도 다른 인물과 똑같이 샤워한다, 두 사람은 다른 캐비닛·다른 샤워기', () => {
  const w = sim();
  const a = woman(w, '콘쥬스', 'b1', 800), b = woman(w, '쟈알디', 'b1', 1000);
  assert.ok(until(w, () => a.shower?.step === 'wash' && b.shower?.step === 'wash'));
  assert.notEqual(a.shower.id, b.shower.id);
  assert.notEqual(a.shower.locker.id, b.shower.locker.id);
});

test('주인공이 쓰는 샤워기·캐비닛은 고르지 않는다', () => {
  const w = sim();
  w.playerShower = { scene: 'bath_f', id: 'shower2' };
  w.playerLocker = { scene: 'shower_f', id: 'locker1' };
  const a = woman(w, '에일린');
  assert.ok(until(w, () => a.shower?.step === 'wash'));
  assert.equal(a.shower.locker.id, 'locker2');
  assert.equal(a.shower.id, 'shower3');
  assert.ok(w.showerBusy('bath_f', 'shower3'));
});

test('샤워 중 맞으면 샤워를 끊고 맨몸 피격, 탈의실·샤워실 밖으로 나가면 옷 입음', () => {
  const w = sim();
  const a = woman(w, '에일린');
  assert.ok(until(w, () => a.shower?.step === 'wash'));
  w.hitActor(a.def.id, 1, 2, 10);
  assert.equal(a.shower, undefined);
  assert.equal(a.nude, true);
  assert.ok(a.clip.startsWith('nude_'), a.clip);
  assert.equal(w.showerUsers('bath_f').length, 0);
  a.needs.hygiene = 100;
  a.def.roam = ['b1']; a.def.home = 'b1';
  assert.ok(until(w, () => a.scene === 'shower_f'));
  assert.equal(a.nude, true, '탈의실에서는 아직 맨몸');
  assert.ok(until(w, () => a.scene === 'b1'));
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

test('이성이 탈의실에 들어오면 샤워실과 같은 반응(들어옴 → 머묾1 → 머묾2, shower.* 대사) — 사용자 11-02 06:32', () => {
  const w = sim();
  const a = w.add({ id: 'npc:쟈알디', name: '쟈알디', kind: 'named', brain: 'needs', home: 'shower_f', roam: ['shower_f'], look: '쟈알디' }, { scene: 'shower_f', x: 400, y: 700 });
  a.face = 1; a.plan = 'stay'; a.act = 'idle'; for (const k of Object.keys(a.needs)) a.needs[k] = 100;
  const male = { scene: 'shower_f', x: 900, y: 700, sex: '남', face: -1 };
  for (let t = 0; t < 30; t += 0.1) w.step(0.1, male);
  const ev = w.events.filter((e) => e.kind === 'intrude' && e.who === '쟈알디');
  assert.deepEqual(ev.map((e) => e.stage), [0, 1, 2]);
  assert.ok(w.events.some((e) => e.kind === 'cue' && e.cell === 'shower.intrude'));
  const w2 = sim();
  const b = w2.add({ id: 'npc:쟈알디', name: '쟈알디', kind: 'named', brain: 'needs', home: 'shower_f', roam: ['shower_f'], look: '쟈알디' }, { scene: 'shower_f', x: 400, y: 700 });
  b.face = 1; b.plan = 'stay'; b.act = 'idle'; for (const k of Object.keys(b.needs)) b.needs[k] = 100;
  for (let t = 0; t < 5; t += 0.1) w2.step(0.1, { ...male, sex: '여' });
  assert.equal(w2.events.filter((e) => e.kind === 'intrude').length, 0, '같은 성별은 반응 없음');
});
