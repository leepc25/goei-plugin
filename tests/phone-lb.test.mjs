// 괴담톡 라이트보드 항목 (이모지 반응·생략 줄, 2026-11-06)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phone as P, phonePrompt as PP } from '../dist-test/core.mjs';

const room = (kind, members) => ({ id: `${kind}_1`, kind, members, people: Object.fromEntries(members.map((c) => [c, { id: c, name: c }])), messages: [], draft: '', unread: 0 });
const add = (content, sender, type = 'text', extra = {}) => ({ op: 'add', path: '/messages/-', value: { content, sender, type, ...extra } });

test('괴담톡: 반응 읽기와 사람 수 제한', () => {
  assert.deepEqual(P.parseReactions('👍3 😭1 -'), [{ emoji: '👍', count: 3 }, { emoji: '😭', count: 1 }]);
  assert.deepEqual(P.parseReactions('-'), []);
  assert.deepEqual(P.parseReactions('좋아요3'), [], '글자는 반응이 아니다');
  assert.equal(P.clampReactions('👍5', 2), '👍2');
  assert.equal(P.clampReactions('👍5', 0), '');
});

test('괴담톡: 단톡 반응은 본 사람 수까지, 1:1에서 상대 말에는 붙지 않는다', () => {
  const st = P.blankState();
  const g = room('group', ['c_1', 'c_2', 'c_3']);
  const ev = P.eventsFromPatch([add('다들 모여', 'c_1', 'text', { reactions: '👍9' }), add('-', '-', 'skip'), add('-', '-', 'skip'), add('왔어', 'c_2')], g, false);
  P.applyEvents(st, g, ev.events, 't');
  assert.equal(g.messages[0].reactions, '👍2');
  assert.deepEqual(g.messages.map((m) => m.kind), ['message', 'skip', 'message'], '생략 줄은 하나로');
  const re = P.eventsFromPatch([{ op: 'replace', path: `/messages/${g.messages[2].id}/reactions`, value: '😂1' }], g, false);
  P.applyEvents(st, g, re.events, 't');
  assert.equal(g.messages[2].reactions, '😂1');
  const d = room('dm', ['c_1']);
  P.push(st, d, 'me', '뭐해', 't');
  P.applyEvents(st, d, P.eventsFromPatch([add('그냥', 'c_1', 'text', { reactions: '❤️1' }), { op: 'replace', path: `/messages/${d.messages[0].id}/reactions`, value: '❤️3' }], d, false).events, 't');
  assert.equal(d.messages[1].reactions, undefined);
  assert.equal(d.messages[0].reactions, '❤️1');
});

test('괴담톡: 요청에 반응·생략 줄이 실린다', () => {
  const g = room('group', ['c_1', 'c_2']);
  const st = P.blankState();
  P.push(st, g, 'c_1', '안녕', 't').reactions = '👍1';
  P.push(st, g, 'system', '', 't', 'skip');
  const on = PP.roomPacket(g, true).messages;
  assert.equal(on[0].reactions, '👍1');
  assert.equal(on[1].type, 'skip');
  assert.equal(on[1].content, '-');
  assert.equal(PP.roomPacket(g).messages[0].reactions, undefined);
  assert.equal(P.phoneSettings({}).reactions, true);
  assert.equal(P.phoneSettings({ '$ph_reactions': '0' }).reactions, false);
});
