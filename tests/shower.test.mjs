import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-shower-'));
await build({ entryPoints: ['src/game/action/fighter/shower.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const S = await import(pathToFileURL(join(dir, 'shower.mjs')));

test('샤워 계획은 현실 10분 이상이고 머리감기·몸씻기만 쓴다', () => {
  const p = S.showerPlan({ seed: 3 });
  assert.ok(S.planSeconds(p) >= 600);
  assert.ok(p.every((b) => b.id === 'SH_D' || b.id === 'SH_E'));
  assert.ok(p.some((b) => b.id === 'SH_D') && p.some((b) => b.id === 'SH_E'));
});
test('블록은 들어가기·나오기 한 번, 문지르는 구간(1~5장)만 반복, 속도가 바뀐다', () => {
  const b = S.scrubBlock('SH_E', 8, 2, () => 0.5);
  assert.equal(b.seq[0].f, 0); assert.equal(b.seq.filter((e) => e.f === 0).length, 1);
  assert.equal(b.seq.filter((e) => e.f === 6).length, 1);
  const mid = b.seq.slice(1, -3);
  assert.ok(mid.every((e) => e.f >= 1 && e.f <= 5));
  const p = S.showerPlan({ seed: 7, seconds: 120 });
  const speeds = new Set(p.flatMap((x) => x.seq.filter((e) => e.f >= 1 && e.f <= 5 && e.d < 0.5).map((e) => e.d)));
  assert.ok(speeds.size >= 2, '속도 차등');
  assert.equal(b.seq[b.seq.length - 1].d, 2);   // 서 있기
});
test('같은 씨앗이면 같은 계획, 없는 줄은 건너뜀', () => {
  assert.deepEqual(S.showerPlan({ seed: 5, seconds: 60 }), S.showerPlan({ seed: 5, seconds: 60 }));
  assert.ok(S.showerPlan({ seconds: 60, has: (id) => id === 'SH_E' }).every((b) => b.id === 'SH_E'));
  assert.deepEqual(S.showerPlan({ has: () => false }), []);
});
