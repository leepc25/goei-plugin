import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-flogic-'));
const names = ['sched', 'rel', 'standing', 'follow', 'phone'];
await build({ entryPoints: names.map(n => `src/core/field${n}.ts`), outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `core/field${n}.mjs`)));
const S = await imp('sched'), R = await imp('rel'), G = await imp('standing'), F = await imp('follow'), P = await imp('phone');

test('일과: 시간대·자정 넘김·본편 상태 우선', () => {
  const s = { npc: '잼트리', blocks: [{ from: 540, to: 720, scene: 'desk', act: 'work' }, { from: 1320, to: 360, scene: 'room', act: 'sleep' }] };
  assert.equal(S.whereAt(s, 600).scene, 'desk');
  assert.equal(S.whereAt(s, 100).scene, 'room');
  assert.equal(S.whereAt(s, 800).act, 'idle');
  assert.equal(S.whereAt(s, 600, '작전투입'), 'away');
  assert.equal(S.whereAt(s, 600, '부상').scene, 'clinic');
  assert.equal(S.whereAt(s, 600 + 1440).scene, 'desk');
});
test('길찾기: 최단 경로와 끊긴 경우', () => {
  const g = { a: ['b'], b: ['a', 'c'], c: ['b', 'd'], d: ['c'], x: [] };
  assert.deepEqual(S.routeScenes(g, 'a', 'd'), ['a', 'b', 'c', 'd']);
  assert.equal(S.routeScenes(g, 'a', 'x'), null);
  assert.equal(S.stuckStep(3), 'teleport');
  assert.equal(S.stuckStep(1), 'sidestep');
});
test('관계: 한 번 ±5, 하루 상한, 반복 체감', () => {
  let r = R.newRel();
  r = R.applyCue(r, '선물');
  assert.equal(r.affinity, 4);
  for (let i = 0; i < 10; i++) r = R.applyCue(r, '호감', R.DEFAULT_TEMPER, 0, ['호감', '호감']);
  assert.ok(r.today <= 12);
  const rude = R.applyCue(R.newRel(), '불쾌', { open: 1, grudge: 3 });
  assert.equal(rude.affinity, -5);
  const next = R.applyCue(r, '선물', R.DEFAULT_TEMPER, 1);
  assert.equal(next.day, 1);
  assert.equal(R.applyCue(R.newRel(), '배신').trust, 0);
});
test('관계: 시간이 지나면 풀린다', () => {
  const r = { affinity: 10, trust: 50, mood: '화남', guard: 3, today: 0, day: 0 };
  const d = R.decay(r, 48);
  assert.equal(d.mood, '평온');
  assert.equal(d.guard, 0);
  assert.equal(d.affinity, 8);
  assert.equal(R.affinityLabel(0), '보통');
});
test('태도: 도발이 쌓이면 경계 → 적대, 선공은 바로 적대 이상', () => {
  let a = { stance: 'neutral', provocation: 0 };
  a = R.provoke(a, 2);
  assert.equal(a.stance, 'wary');
  a = R.provoke(a, 2);
  assert.equal(a.stance, 'hostile');
  assert.equal(R.provoke({ stance: 'neutral', provocation: 0 }, 3).stance, 'flee');
  assert.equal(R.provoke({ stance: 'neutral', provocation: 0 }, 3, { edge: 1, timid: false, canFight: true }).stance, 'fight');
  assert.equal(R.calm({ stance: 'hostile', provocation: 60 }, 40).stance, 'neutral');
  assert.equal(R.lethal(false), 'down');
  assert.equal(R.lethal(true), 'kill');
});
test('평판: 거점 반응', () => {
  assert.equal(G.shift('중립', 3), '수배');
  assert.equal(G.reaction('수배', 'security', false), 'attack');
  assert.equal(G.reaction('중립', 'civilian', false), 'ignore');
  assert.equal(G.reaction('경계', 'civilian', false), 'watch');
  assert.equal(G.detected('중립', false), false);
});
test('동행: 의도 분류·4명 제한·거절', () => {
  assert.equal(F.classify('따라와'), 'follow');
  assert.equal(F.classify('여기서 기다려'), 'wait');
  assert.equal(F.classify('따라오지 마'), 'wait');
  assert.equal(F.classify('따라올래?'), null);
  assert.equal(F.classify('안녕'), null);
  const c = F.fieldCompanions(['a', 'b', 'c', 'd', 'e', 'a']);
  assert.equal(c.shown.length, 4);
  assert.deepEqual(c.rest, ['e']);
  assert.equal(F.canJoin({ state: '부상', affinity: 5 }).ok, false);
  assert.equal(F.canJoin({ state: '휴게', affinity: 0 }).ok, true);
  let t = [];
  for (let i = 0; i <= 10; i++) t = F.pushFoot(t, { t: i, x: i * 10, y: 0 });
  assert.equal(F.followPoint(t, 10).x, 85 > 0 ? 80 : 0);
});
test('전화: 조건 판정', () => {
  assert.equal(P.canCall({ available: true, inAnomaly: false }).ok, true);
  assert.equal(P.canCall({ available: true, inAnomaly: true, link: 'none' }).reason, '신호가 닿지 않는다.');
  assert.equal(P.canCall({ available: true, inAnomaly: true, link: 'phone' }).ok, true);
  assert.equal(P.canCall({ available: false, inAnomaly: false }).reason, '받지 않는다.');
  assert.equal(P.canCall({ state: '사망', available: true, inAnomaly: false }).ok, false);
});
