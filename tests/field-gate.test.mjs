import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-gate-'));
await build({ entryPoints: ['src/core/fieldgate.ts', 'src/core/fieldsites.ts', 'src/core/fieldclock.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { presence, entryDecision } = await import(pathToFileURL(join(dir, 'core/fieldgate.mjs')));
const { siteFor } = await import(pathToFileURL(join(dir, 'core/fieldsites.mjs')));
const { walkSeconds, clockText, mergeClock } = await import(pathToFileURL(join(dir, 'core/fieldclock.mjs')));

test('입장: 작전투입 상태면 안, 목표만 있으면 준비, 없으면 밖', () => {
  assert.equal(presence({ player: true, state: '작전투입', target: '' }), 'inside');
  assert.equal(presence({ player: true, state: '대기', target: '○○ 조사' }), 'prep');
  assert.equal(presence({ player: true, state: '휴게', target: '' }), 'none');
});
test('입장: 요원 상태와 투입 칸이 어긋나면 모름', () => {
  assert.equal(presence({ player: true, state: '대기', deployed: true }), 'unknown');
  assert.equal(presence({ player: false, deployed: true }), 'inside');
  assert.equal(presence({ player: false, deployed: null, target: '' }), 'none');
  assert.equal(presence({ player: false, deployed: null, target: 'x' }), 'unknown');
});
test('입장: 사용자가 고치면 그게 이긴다', () => {
  assert.equal(presence({ player: true, state: '작전투입', override: 'outside' }), 'none');
  assert.equal(presence({ player: true, state: '휴게', override: 'inside' }), 'inside');
});
test('입장: 안이면 막고 모름은 알리며 통과', () => {
  assert.equal(entryDecision('inside').allow, false);
  assert.ok(entryDecision('inside').reason);
  assert.equal(entryDecision('unknown').allow, true);
  assert.ok(entryDecision('unknown').notice);
  assert.equal(entryDecision('none').allow, true);
});
test('거점: 표에 없는 소속은 본부', () => {
  assert.deepEqual(siteFor('A00').site.id, 'hq');
  assert.equal(siteFor('').exact, false);
});
test('시계: 거리로 초를 센다', () => {
  assert.equal(walkSeconds(142 * 13), 10);
  assert.equal(walkSeconds(0), 0);
  assert.equal(clockText(14 * 3600 + 5 * 60), '14:05');
  assert.equal(mergeClock(900, 10), 900);
  assert.equal(mergeClock(900, 30), 1800);
  assert.equal(mergeClock(null, null), null);
});
