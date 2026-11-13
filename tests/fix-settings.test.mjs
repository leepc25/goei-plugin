// 전수검사 11-13 고친 것: 보고서 알림 기억 저장(setPrefs), 위키 목록 서랍 쓸기 비킴(swipeback)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-fixset-'));
await build({
  entryPoints: ['src/core/settings.ts', 'src/ui/swipeback.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text', '.md': 'text' },
});
const S = await import(pathToFileURL(join(dir, 'core/settings.mjs')));
const W = await import(pathToFileURL(join(dir, 'ui/swipeback.mjs')));

test('setPrefs: 띄운 보고서 알림 기억을 남긴다 (최근 50개, 겹침·빈 값 버림)', () => {
  assert.deepEqual(S.setPrefs({ noticedReports: ['rpt1', 'rpt2'] }).noticedReports, ['rpt1', 'rpt2']);
  assert.deepEqual(S.setPrefs({ noticedReports: ['a', 'a', '', 3, 'b'] }).noticedReports, ['a', 'b']);
  const many = Array.from({ length: 60 }, (_, i) => `r${i}`);
  const kept = S.setPrefs({ noticedReports: many }).noticedReports;
  assert.equal(kept.length, 50);
  assert.equal(kept[0], 'r10');
  assert.equal(kept[49], 'r59');
  assert.equal(S.setPrefs({}).noticedReports, undefined);
  assert.equal('noticedReports' in S.setPrefs({ noticedReports: [] }), false);
});

test('swipeback: 위키 목록 서랍·책갈피·가림막에서 시작한 쓸기는 비킨다', () => {
  for (const sel of ['.wk .wdr', '.wk .wgrab', '.wk .wscrim', '.ph-drawer', 'input']) assert.ok(W.SWIPE_SKIP.split(',').map((x) => x.trim()).includes(sel), sel);
});
