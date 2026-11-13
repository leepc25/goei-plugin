// 전수검사 11-13 (3차): 토크나이저 기억 상한, 묶음 요청의 동시 요청 수, 가짜 관리국 신분 읽기, 진행 창 토큰 채우기, body.ts 연결
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const dir = '/tmp/audit_1113/fix3/pipe';
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
const ENTRY = `
export * as Tok from './src/core/tokenizer';
export * as Prog from './src/core/progress';
export * as J from './src/host/joint';
export * as P from './src/host/people';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { Tok, Prog, J, P } = await import(pathToFileURL(outfile));
const body = await readFile(new URL('../src/body.ts', import.meta.url), 'utf8');

test('토크나이저: 긴 글을 많이 세도 수는 그대로 (글자 수 상한으로 밀려난 뒤 다시 세도 같다)', () => {
  const ranks = require('js-tiktoken/ranks/o200k_base');
  const { Tiktoken } = require('js-tiktoken/lite');
  assert.equal(Tok.setTokenizerRanks({ pat_str: ranks.pat_str, special_tokens: ranks.special_tokens, bpe_ranks: ranks.bpe_ranks }, 'o200k_base'), true);
  const ref = new Tiktoken(ranks);
  const big = (i) => `${i} `.padEnd(400_000, 'ab ');
  const first = Tok.exactTokens(big(0));
  assert.equal(first, ref.encode(big(0), [], []).length);
  for (let i = 1; i <= 11; i++) Tok.exactTokens(big(i)); // 400만 자 넘김 → 앞 글이 밀려난다
  assert.equal(Tok.exactTokens(big(0)), first);
  assert.equal(Tok.exactTokens('안녕하세요'), ref.encode('안녕하세요', [], []).length);
  Tok.clearTokenizer();
});

test('Joint: 동시 요청 수 1이면 통합 뒤 혼자 보내는 요청도 한 번에 하나 (pipeline#5)', async () => {
  let live = 0;
  let peak = 0;
  globalThis.risuai = {
    runLLMModel: async () => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 20));
      live--;
      return { type: 'success', result: '{"gnet": {"a": 1}, "phone": {"b": 2}}' };
    },
  };
  const run = async (concurrent) => {
    peak = 0;
    const j = new J.Joint('aux', undefined, ['gn', 'phone'], concurrent);
    await Promise.all([j.ask('gn', [{ role: 'user', content: 'g' }]), j.ask('phone', [{ role: 'user', content: 'p' }])]);
    // 이미 보낸 묶음에 다시 묻기 → 각자 따로
    await Promise.all([j.ask('gn', [{ role: 'user', content: 'g2' }]), j.ask('phone', [{ role: 'user', content: 'p2' }])]);
    return peak;
  };
  assert.equal(await run(1), 1);
  assert.equal(await run(undefined), 2, '설정 0(제한 없음)은 그대로 동시에');
  delete globalThis.risuai;
});

test('statusIdentity: 가짜 관리국(B00) 채팅의 「관리국/사원」은 B00 으로 읽는다 (gmain#2)', () => {
  const line = (id) => `글\n[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음|${id}|1000]`;
  const chat = (id, faction) => ({ message: [{ role: 'user', data: '출근' }, { role: 'char', data: line(id), chatId: 'c1' }], scriptstate: faction ? { '$st_faction': faction } : {} });
  const b = P.statusIdentity(chat('관리국/사원', 'B00'));
  assert.equal(b?.faction, 'B00');
  assert.equal(b?.level, 1);
  assert.equal(P.statusIdentity(chat('관리국/사원', 'A00'))?.faction, 'A00');
  assert.equal(P.statusIdentity(chat('관리국/요원', ''))?.faction, 'A00', '소속을 모르면 그대로');
  assert.equal(P.statusIdentity(chat('가짜 관리국/대리', 'B00'))?.faction, 'B00');
});

test('진행 창: 보낸 뒤 센 토큰을 호출 줄·본편에 채운다 (perf#7)', () => {
  Prog.resetProgress();
  const t = Prog.progressBegin();
  const id = Prog.progressCallStart('갱신기', 'aux', 0);
  Prog.progressCallTokens(id, 123);
  assert.equal(Prog.progressTurn().calls.find((c) => c.id === id).reqTokens, 123);
  Prog.progressMainTokens(77, t);
  assert.equal(Prog.progressTurn().mainTokens, 77);
  Prog.progressMainTokens(88, { other: true });
  assert.equal(Prog.progressTurn().mainTokens, 77, '다른 턴이면 건드리지 않는다');
  Prog.resetProgress();
});

test('body.ts 연결: 이미지 지침 {{user}} 풀기, 인물 갱신 채팅 번호, 묶음 동시 요청 수, 캐릭터 바뀌면 에셋 다시 읽기', () => {
  assert.match(body, /appendImgPrompt\(out, evaluate\(buildImgPrompt\(cfg, names, s\.assetPlayer\), \{ vars: chat\.scriptstate \?\? \{\}, char: char\.name, user: me\?\.name \|\| userOrTag\(\) \}\)\)/);
  assert.match(body, /requestPeopleUpdate\('turn', \{ at: \{ charIndex: arg\.characterIndex, chatIndex: arg\.chatIndex \} \}\)/);
  assert.match(body, /new Joint\(group\[0\]\.model, group\[0\]\.fixed, group\.map\(\(t\) => t\.kind\), genSettings\(now!\.scriptstate\)\.concurrent\)/);
  assert.match(body, /snap\.charIndex !== lastChar \|\| \(next\.changed && next\.fabVisible\)\)\) void loadModuleAssets\(\)/);
});
