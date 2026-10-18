import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readMeta, newMeta, newRun, step, applySquad, agents, trigger, SAVE_VERSION } from '../dist-test/game-sim.mjs';

const run10min = (seed, squad) => {
  const meta = newMeta();
  if (squad) meta.squad = squad;
  const run = newRun(meta, seed);
  for (let i = 0; i < 30 * 600; i++) step(run, meta, 1 / 30, 390);
  return { meta, run };
};

test('저장 읽기: 깨지거나 이상한 값은 기본값', () => {
  assert.deepEqual(readMeta(null), newMeta());
  assert.deepEqual(readMeta('{'), newMeta());
  assert.deepEqual(readMeta('[1,2]').squad, newMeta().squad);
  const m = readMeta(JSON.stringify({ version: 1, squad: ['rose', 'rose', 'x', 'geshu'], patrols: -3, best: 2.7, kills: { corner: 5, bogus: 9 }, depth: 0 }));
  assert.deepEqual(m.squad, newMeta().squad, '네 명이 아니면 기본 분대');
  assert.equal(m.patrols, 0);
  assert.equal(m.best, 2);
  assert.equal(m.depth, 1);
  assert.equal(m.kills.corner, 5);
  assert.equal(m.kills.bogus, undefined);
  assert.equal(m.version, SAVE_VERSION);
});

test('10분 순찰: 방 세 곳과 우두머리를 지나 은신처를 거쳐 다음 순찰로', () => {
  const { meta } = run10min(7);
  assert.ok(meta.patrols >= 2, `마친 순찰 ${meta.patrols}`);
  assert.ok((meta.kills.statue ?? 0) + (meta.kills.master ?? 0) >= 2);
  assert.ok(meta.depth === meta.patrols + 1);
});

test('같은 씨앗이면 같은 결과', () => {
  assert.deepEqual(run10min(42).meta, run10min(42).meta);
});

test('모든 요원이 어떤 분대로든 순찰을 이어 간다', () => {
  for (const squad of [['jyaldi', 'gorgo', 'geshu', 'deadfall'], ['spandal', 'eileen', 'curas', 'rose'], ['geshu', 'rose', 'eileen', 'deadfall']]) {
    const { meta } = run10min(3, squad);
    assert.ok(meta.patrols + meta.wipes >= 1, squad.join());
  }
});

test('편성을 바꾸면 은신처에서 새 분대로', () => {
  const meta = newMeta();
  const run = newRun(meta, 1);
  for (let i = 0; i < 300; i++) step(run, meta, 1 / 30, 390);
  applySquad(run, meta, ['rose', 'curas', 'spandal', 'geshu']);
  assert.equal(run.phase, 'camp');
  assert.deepEqual(agents(run).map((a) => a.kind).sort(), ['curas', 'geshu', 'rose', 'spandal']);
  assert.deepEqual(meta.squad, ['rose', 'curas', 'spandal', 'geshu']);
});

test('기술은 충전이 다 차고 적이 있을 때만 탭으로 쓴다', () => {
  const meta = newMeta();
  const run = newRun(meta, 5);
  const a = agents(run)[0];
  a.gauge = 1;
  assert.equal(trigger(run, a.uid), false, '적이 없으면 안 씀');
  for (let i = 0; i < 30 * 30 && !run.units.some((u) => u.side === 'e'); i++) step(run, meta, 1 / 30, 390);
  a.gauge = 1;
  assert.equal(trigger(run, a.uid), true);
  assert.equal(a.act, 'skill');
  assert.equal(trigger(run, a.uid), false, '충전이 비면 다시 못 씀');
});
