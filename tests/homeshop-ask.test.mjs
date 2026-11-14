// 망상홈쇼핑 편성 호출 (ui/homeshop.ts ask): 그림 팩을 기다린 뒤 채팅을 다시 확인하고, 요청문은 그때 채팅 값으로 만든다 (재검토 11-14 ①-6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await build({
  stdin: { contents: `export { shopSource } from './src/ui/shop';\nexport { homeshopAction, resetHomeshop } from './src/ui/homeshop';\nexport { HS_RETRY_KEY } from './src/core/setdef/homeshop';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const code = out.outputFiles[0].text;
// 시험마다 새 모듈 (그림 팩 받기 상태가 모듈 안에 남는다)
let seq = 0;
const dir = mkdtempSync(join(tmpdir(), 'goei-hsask-'));
const fresh = () => { const f = join(dir, `m${++seq}.mjs`); writeFileSync(f, code); return import(pathToFileURL(f).href); };

const chatOf = (mark, vars) => ({
  message: [{ role: 'user', data: '둘러본다', chatId: 'u1' }, { role: 'char', data: `${mark} 에 다녀왔다.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]`, chatId: 'c1' }],
  scriptstate: { ...vars },
  note: '',
});
const ctxOf = (chatIndex, mark, vars = {}) => ({ charIndex: 0, chatIndex, char: { name: '괴이봇', desc: '', globalLore: [] }, chat: chatOf(mark, vars) });

/** 팩 받기를 내가 풀 때까지 붙잡아 두는 가짜 Risu */
function fakeRisu() {
  const calls = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  let waiting;
  const asked = new Promise((r) => { waiting = r; });
  globalThis.risuai = {
    pluginStorage: { getItem: async () => { waiting(); await gate; return null; }, setItem: async () => {}, removeItem: async () => {} },
    nativeFetch: async () => { throw new Error('막힘'); },
    runLLMModel: async (o) => { calls.push(JSON.stringify(o.messages)); return { type: 'fail', result: '시험' }; },
    getChatFromIndex: async () => null,
    setChatToIndex: async () => {},
  };
  return { calls, release, asked };
}

test('망상홈쇼핑 편성: 그림 팩을 기다리는 사이 채팅을 옮겼으면 요청을 보내지 않는다', async () => {
  const M = await fresh();
  const R = fakeRisu();
  const a = ctxOf(0, 'OLDMARK', { [M.HS_RETRY_KEY]: '0' });
  const b = ctxOf(1, 'NEWMARK', { [M.HS_RETRY_KEY]: '0' });
  let cur = a;
  const env = { render() {}, refresh: async () => {}, current: () => cur };
  const done = M.homeshopAction('hs-refresh', undefined, a, env);
  await R.asked;
  cur = b;
  R.release();
  await done;
  assert.equal(R.calls.length, 0, '옮긴 뒤에는 옛 채팅 요청이 나가면 안 된다');
});

test('망상홈쇼핑 편성: 요청문은 그림 팩을 기다린 뒤의 채팅 값으로 만든다', async () => {
  const M = await fresh();
  const R = fakeRisu();
  const a = ctxOf(0, 'OLDMARK', { [M.HS_RETRY_KEY]: '0' });
  let cur = a;
  const env = { render() {}, refresh: async () => {}, current: () => cur };
  const done = M.homeshopAction('hs-refresh', undefined, a, env);
  await R.asked;
  cur = ctxOf(0, 'NEWMARK', { [M.HS_RETRY_KEY]: '0' });
  R.release();
  await done;
  assert.ok(R.calls.length > 0, '같은 채팅이면 요청은 나간다');
  assert.ok(R.calls[0].includes('NEWMARK') && !R.calls[0].includes('OLDMARK'), '기다린 뒤의 채팅으로 요청문을 만든다');
});
