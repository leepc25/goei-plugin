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

test('괴담톡: 말버릇 칸은 본 응답을 깨지 않고, 이번 사람 것만 합친다', () => {
  const g = room('group', ['c_1', 'c_2']);
  const raw = '{"updates":[],"announcements":[],"invitations":[]}\n<ph-habits>[{"sender":"c_1","note":"짧게 끊어 보냄"},{"sender":"c_9","note":"남"}]</ph-habits>';
  assert.deepEqual(P.decodeJson(raw), { updates: [], announcements: [], invitations: [] });
  const rows = P.parseHabits(raw);
  const ids = new Map([['c_1', '가'], ['c_2', '나']]);
  const v = P.mergeHabits({}, rows, ids);
  assert.deepEqual(P.readHabits(v), [{ id: 'c_1', name: '가', note: '짧게 끊어 보냄' }]);
  assert.equal(P.mergeHabits(v, rows, ids), null, '같은 내용이면 저장하지 않는다');
  assert.equal(P.parseReply('<lb-minitalk-patch>[]</lb-minitalk-patch><ph-habits>깨짐</ph-habits>', g, false).events.length, 0);
  assert.deepEqual(P.parseHabits('<ph-habits>깨짐</ph-habits>'), []);
});

test('괴담톡: 단톡 수다를 켜면 단톡방 하나에 수다 표시가 붙고, 말버릇이 요청에 실린다', () => {
  const st = P.blankState();
  const g = room('group', ['c_1', 'c_2']);
  st.rooms[g.id] = g;
  st.order.push(g.id);
  P.push(st, g, 'c_1', '안녕', 't');
  const vars = { '$ph_banter': '1', '$ph_banter_chance': '100', '$ph_incoming': '0', '$ph_group_invites': '0', '$ph_announcements': '0', '$ph_habits_list': JSON.stringify([{ id: 'c_1', name: 'c_1', note: '짧게 씀' }]) };
  const src = (v) => ({ char: { name: '괴이', desc: '', globalLore: [] }, chat: { message: [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }], scriptstate: v, localLore: [] } });
  const dir = { contacts: [], map: new Map(), tabs: [] };
  const plan = PP.refreshPrompt(src(vars), st, dir, {}, () => 0);
  const body = JSON.parse(plan.prompt.messages[1].content);
  assert.equal(body.rooms[0].banter, true);
  assert.match(plan.prompt.messages[0].content, /GROUP BANTER/);
  assert.deepEqual(body.textingHabits, [{ sender: 'c_1', note: '짧게 씀' }]);
  assert.match(plan.prompt.messages[0].content, /TEXTING HABITS/);
  const off = PP.refreshPrompt(src({ ...vars, '$ph_banter': '0', '$ph_habits': '0' }), st, dir, {}, () => 0);
  const ob = JSON.parse(off.prompt.messages[1].content);
  assert.equal(ob.rooms[0].banter, undefined);
  assert.equal(ob.textingHabits, undefined);
  assert.doesNotMatch(off.prompt.messages[0].content, /GROUP BANTER|TEXTING HABITS/);
});

test('괴담톡: 보기 전용 방 요청·응답 (사이드스토리·혼잣말·다중인격)', async () => {
  const { phoneView: V } = await import('../dist-test/core.mjs');
  const src = (v) => ({ char: { name: '괴이', desc: '', globalLore: [] }, chat: { message: [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }], scriptstate: v, localLore: [] } });
  const side = PP.viewPrompt(src({ '$ph_view_pov': '에일린', '$ph_view_size': '1' }), {}, []);
  assert.match(side.messages[0].content, /Side story/);
  assert.match(side.messages[0].content, /exactly two participants/);
  assert.match(side.messages[0].content, /Keep the viewpoint character silent/);
  assert.equal(JSON.parse(side.messages[1].content).viewpoint.name, '에일린');
  const multi = PP.viewPrompt(src({ '$ph_view_preset': 'multi', '$ph_view_speak': '1' }), {}, []);
  assert.match(multi.messages[0].content, /Inner voices/);
  assert.match(multi.messages[0].content, /speak as themself/);
  assert.doesNotMatch(multi.messages[0].content, /Side story/);
  const raw = JSON.stringify({ name: '퇴근길', pov: 'p1', participants: [{ id: 'p1', name: '에일린' }, { id: 'p2', name: '동료' }, { id: '-', name: 'x' }],
    messages: [{ sender: 'p2', type: 'text', content: '오늘 뭐 먹어', reactions: '👍5' }, { sender: '-', type: 'skip', content: '-' }, { sender: 'p9', type: 'text', content: '없는 사람' }, { sender: '-', type: 'pause', content: '10분 후' }] });
  const r = V.parseView(raw, 'side');
  assert.equal(r.people.length, 2);
  assert.equal(r.messages.length, 1, '끝의 생략·대기 줄은 떼고, 없는 사람 말은 뺀다');
  assert.equal(r.messages[0].reactions, '👍1');
  assert.throws(() => V.parseView(JSON.stringify({ name: 'x', pov: 'p1', participants: [{ id: 'p1', name: 'a' }], messages: [] }), 'mono'), /메시지가 하나도/);
  const list = [{ ...r, id: 'v_1', time: 't', unread: true }];
  assert.equal(V.viewUnread(list), 1);
  const next = PP.viewPrompt(src({ '$ph_view_pov': '에일린' }), {}, list);
  assert.equal(JSON.parse(next.messages[1].content).previousRoom.name, '퇴근길');
  assert.equal(V.viewSettings({}).auto, 'manual');
});
