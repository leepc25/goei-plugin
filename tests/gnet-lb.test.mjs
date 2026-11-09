// 괴담넷 라이트보드 항목 (주요 인물 닉네임, 다양성 강화 seed, 2026-11-06), 사이트별 지침 (2026-11-08)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshPrompt, incomingPlan, gnetSettings, mergeKeyFigures, keyFigures, GN_KEYFIG, boards } from '../dist-test/core.mjs';

const C = (k) => `$lb_cfg_lb-gn.${k}`;
const src = (vars = {}) => ({
  char: { name: '괴이', desc: '', globalLore: [] },
  chat: { message: [{ role: 'user', data: '가' }, { role: 'char', data: '나' }], scriptstate: vars, localLore: [] },
});
const st = { posts: [], dms: [], sources: {}, seq: 100000 };
const sys = (vars) => {
  const s = src(vars);
  return refreshPrompt(s, st, incomingPlan(s.chat, st, gnetSettings(vars), 'ㅇㅇ', () => 0.99), 'ㅇㅇ', {}).messages[0].content;
};

test('사이트마다 자기 지침을 쓴다 (성격 고르기 없음)', () => {
  const v = (site) => boards.boardState({}, site);
  assert.match(sys(v('gn')), /괴담넷 is a closed forum/);
  assert.match(sys(v('gal')), /괴담갤 \(괴담 갤러리\) is a completely civilian/);
  assert.match(sys(v('wpf')), /세계정치 게시판 \(세정게/);
  assert.match(sys(v('sm')), /연어 마켓 \(salmon-market\.kr\)/);
  assert.doesNotMatch(sys(v('gal')), /괴담넷 is a closed/);
  assert.equal(gnetSettings({}).incoming, true);
});

test('괴담넷: 주요 인물 닉네임은 요청에 붙고, 응답을 합쳐 저장한다', () => {
  assert.match(sys({}), /keyFigures/);
  assert.doesNotMatch(sys({ [C('keyfigures')]: '0' }), /"keyFigures"/);
  const a = mergeKeyFigures({}, [{ keyFigure: '에일린', nickname: '빨간우산', note: '' }, { keyFigure: '', nickname: 'x' }]);
  assert.equal(keyFigures(a).length, 1);
  assert.equal(mergeKeyFigures(a, [{ keyFigure: '에일린', nickname: '빨간우산', note: '' }]), null);
  const b = mergeKeyFigures(a, [{ keyFigure: '에일린', nickname: '파란우산' }]);
  assert.equal(keyFigures(b)[0].nickname, '파란우산');
  assert.match(sys({ [GN_KEYFIG]: b[GN_KEYFIG] }), /파란우산/);
});

test('괴담넷: 다양성 강화를 켜면 확률과 seed를 요구한다', () => {
  const on = sys({ [C('sampling')]: '1' });
  assert.match(on, /alternativeProb/);
  assert.match(on, /<x-output-seed-a>\S+<\/x-output-seed-a>/);
});
