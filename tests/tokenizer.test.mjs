// 토크나이저 (o200k_base): 순위표를 올리면 tokens() 가 정확한 수를, 없으면 어림값을 준다
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { tokens, setTokenizerRanks, clearTokenizer, tokenizerName, exactTokens } from '../dist-test/core.mjs';

const require = createRequire(import.meta.url);

test('어림값: 토크나이저가 없을 때', () => {
  clearTokenizer();
  assert.equal(tokenizerName(), '');
  assert.equal(exactTokens('x'), null);
  assert.equal(tokens('안녕하세요'), 5);
});

test('o200k_base 순위표를 올리면 js-tiktoken 과 같은 수', () => {
  const ranks = require('js-tiktoken/ranks/o200k_base');
  const { Tiktoken } = require('js-tiktoken/lite');
  assert.equal(setTokenizerRanks(JSON.stringify({ pat_str: ranks.pat_str, special_tokens: ranks.special_tokens, bpe_ranks: ranks.bpe_ranks }), 'o200k_base'), true);
  assert.equal(tokenizerName(), 'o200k_base');
  const ref = new Tiktoken(ranks);
  for (const t of ['안녕하세요, 관리국 요원 쟈알디입니다.', 'The Museum continuously curates itself around the current audience.', '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음]', '<|endoftext|> 특수 토큰도 글자로']) {
    assert.equal(tokens(t), ref.encode(t, [], []).length, t);
  }
  assert.ok(tokens('안녕하세요') < 5, '한글은 어림값보다 적다');
  clearTokenizer();
  assert.equal(setTokenizerRanks('{bad', 'x'), false);
});
