// 조각 동시 받기 (src/core/fetchparts.ts): 순서 유지, 동시 개수 상한, 실패 전파
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/core/fetchparts.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/fetchparts.mjs', logLevel: 'silent' });
const { fetchParts } = await import('../dist-test/fetchparts.mjs');

test('늦게 끝난 조각이 있어도 순서대로 붙고 동시에 4개까지만', async () => {
  const names = Array.from({ length: 12 }, (_, i) => `p${i}`);
  let live = 0, peak = 0;
  const done = [];
  const text = await fetchParts(names, async (n) => {
    live++; peak = Math.max(peak, live);
    await new Promise((r) => setTimeout(r, 30 - Number(n.slice(1)) * 2));
    live--;
    return `[${n}]`;
  }, (d) => done.push(d));
  assert.equal(text, names.map((n) => `[${n}]`).join(''));
  assert.equal(peak, 4);
  assert.deepEqual(done, Array.from({ length: 12 }, (_, i) => i + 1));
});

test('하나라도 실패하면 던진다', async () => {
  await assert.rejects(fetchParts(['a', 'b', 'c'], async (n) => { if (n === 'b') throw new Error('끊김'); return n; }), /끊김/);
});

test('빈 목록', async () => {
  assert.equal(await fetchParts([], async () => 'x'), '');
});
