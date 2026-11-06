// 모델 호출: 다시 보기·동시 요청 수·생각 칸 지우기·재시도 원인 분석 (라이트보드 5.0.0, 2026-11-06)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

await build({ entryPoints: ['src/host/llm.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/llm.mjs', logLevel: 'silent' });
const { generate } = await import('../dist-test/llm.mjs');

test('llm: 다시 보기는 첫 응답 뒤 n번, 고친 응답을 쓴다. 생각 칸은 지운다', async () => {
  const calls = [];
  let n = 0;
  globalThis.risuai = { runLLMModel: async (o) => (calls.push(o), { type: 'success', result: n++ === 0 ? '<lb-process>짧은 생각</lb-process>첫답' : `고친답${n}` }) };
  const { raw } = await generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same', reiterate: 2 });
  assert.equal(calls.length, 3);
  assert.equal(raw, '고친답3');
  assert.equal(calls[1].messages.at(-2).content, '첫답', '생각 칸을 뗀 응답으로 다시 묻는다');
  assert.match(calls[1].messages.at(-1).content, /Reiteration phase \(1\/2\)/);
});

test('llm: 재시도 문구에 원인 분석, 동시 요청 수를 넘지 않는다', async () => {
  const calls = [];
  globalThis.risuai = { runLLMModel: async (o) => (calls.push(o), { type: 'success', result: calls.length === 1 ? 'bad' : 'ok' }) };
  await generate([{ role: 'user', content: 'Q' }], 'aux', (r) => { if (r === 'bad') throw new Error('형식'); return r; }, { retries: 1, retryModel: 'same' });
  assert.match(calls[1].messages.at(-1).content, /analyze the error source/);

  let live = 0;
  let peak = 0;
  globalThis.risuai = { runLLMModel: async () => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 20)); live--; return { type: 'success', result: 'x' }; } };
  const o = { retries: 0, retryModel: 'same', concurrent: 2 };
  await Promise.all([1, 2, 3, 4, 5].map(() => generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, o)));
  assert.equal(peak, 2);
  peak = 0;
  await Promise.all([1, 2, 3].map(() => generate([{ role: 'user', content: 'Q' }], 'aux', (r) => r, { retries: 0, retryModel: 'same' })));
  assert.equal(peak, 3, '0이면 제한 없음');
});
