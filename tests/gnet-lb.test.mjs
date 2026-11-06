// 괴담넷 라이트보드 항목 (일기장·감정 게시판, 주요 인물 닉네임, 반응 그림, 다양성 강화 seed, 2026-11-06)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshPrompt, incomingPlan, gnetSettings, mergeKeyFigures, keyFigures, consList, GN_KEYFIG } from '../dist-test/core.mjs';

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

test('괴담넷: 일기장·감정 게시판은 선쪽지가 꺼지고 주인 이름이 들어간다', () => {
  const v = { [C('style')]: 'diary', [C('who')]: '에일린' };
  assert.equal(gnetSettings(v).incoming, false);
  assert.match(sys(v), /에일린/);
  assert.equal(gnetSettings({ [C('style')]: 'emotion' }).incoming, false);
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

test('괴담넷: 반응 그림은 켜고 목록이 있어야 붙는다', () => {
  const list = '웃음 | https://a/1.png\n잘못[된]:이름 | https://a/2.png\n울음|https://a/3.png';
  assert.deepEqual(consList({ [C('cons_list')]: list }).map((c) => c.name), ['웃음', '울음']);
  assert.equal(gnetSettings({ [C('cons')]: '1' }).cons, false);
  const on = sys({ [C('cons')]: '1', [C('cons_list')]: list });
  assert.match(on, /\[콘:name\]/);
  assert.match(on, /웃음/);
  assert.doesNotMatch(sys({ [C('cons_list')]: list }), /\[콘:name\]/);
});

test('괴담넷: 다양성 강화를 켜면 확률과 seed를 요구한다', () => {
  const on = sys({ [C('sampling')]: '1' });
  assert.match(on, /alternativeProb/);
  assert.match(on, /<x-output-seed-a>\S+<\/x-output-seed-a>/);
});
