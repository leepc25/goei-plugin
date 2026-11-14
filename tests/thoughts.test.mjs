// 재검토 11-14 ①-5: 속생각 블록 떼기 — 이어진 블록 전부, <Thoughts>·<think> 둘 다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-thoughts-'));
await build({
  entryPoints: ['src/core/thoughts.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const T = await import(pathToFileURL(join(dir, 'core/thoughts.mjs')));

test('splitThoughts: 맨 앞에 이어진 생각 블록은 전부 head 로 간다', () => {
  const head = '<Thoughts>a</Thoughts>\n<Thoughts>b {{up::x}}</Thoughts>\n';
  assert.deepEqual(T.splitThoughts(`${head}본문`), { head, body: '본문' });
});

test('splitThoughts: <think> 블록도 뗀다 (섞여 이어져도)', () => {
  assert.deepEqual(T.splitThoughts('<think>a {{up::x}}</think>\n본문'), { head: '<think>a {{up::x}}</think>\n', body: '본문' });
  const mix = '\n<Thoughts>a</Thoughts>\n\n<think>b</think>\n\n';
  assert.deepEqual(T.splitThoughts(`${mix}본문`), { head: mix, body: '본문' });
});

test('splitThoughts: 블록 하나·없음·본문 중간 블록은 전과 같다', () => {
  assert.deepEqual(T.splitThoughts('<Thoughts>a</Thoughts>\n\n본문'), { head: '<Thoughts>a</Thoughts>\n\n', body: '본문' });
  assert.deepEqual(T.splitThoughts('본문'), { head: '', body: '본문' });
  assert.deepEqual(T.splitThoughts('본문\n<Thoughts>a</Thoughts>'), { head: '', body: '본문\n<Thoughts>a</Thoughts>' });
  // 짝이 다른 닫는 태그로는 닫히지 않는다
  assert.deepEqual(T.splitThoughts('<Thoughts>a</think>본문'), { head: '', body: '<Thoughts>a</think>본문' });
  // head + body 는 늘 원문 그대로 (저장 본문에서 지우지 않는다)
  const raw = '<Thoughts>a</Thoughts>\n<think>b</think>\n본문 <think>c</think>';
  const s = T.splitThoughts(raw);
  assert.equal(s.head + s.body, raw);
});

test('stripThoughts: <Thoughts>·<think> 블록을 모두 지우고, 맨 앞 닫히지 않은 블록은 통째로 생각으로 본다', () => {
  assert.equal(T.stripThoughts('<Thoughts>a</Thoughts>\n<think>b</think>\n본문'), '본문');
  assert.equal(T.stripThoughts('<think>a</think>본문'), '본문');
  assert.equal(T.stripThoughts('<Thoughts>a</Thoughts>\n본문'), '본문');
  assert.equal(T.stripThoughts('<think>끝나지 않음'), '');
  assert.equal(T.stripThoughts('<Thoughts>끝나지 않음'), '');
  assert.equal(T.stripThoughts('본문 <Thoughts>끝나지 않음'), '본문 <Thoughts>끝나지 않음');
  assert.equal(T.stripThoughts('본문'), '본문');
});
