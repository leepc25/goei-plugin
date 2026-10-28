import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { phone as P, phonePrompt as PP, unwrapCalls, recentTurns } from '../dist-test/core.mjs';

import { REAL } from './realcard.mjs';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;

const chatOf = (vars = {}, message = []) => ({ message, scriptstate: { '$st_faction': 'A00', ...vars } });
const dmRoom = (cid, extra = {}) => ({ id: `dm_${cid}`, kind: 'dm', members: [cid], people: { [cid]: { id: cid, name: '상대' } }, messages: [], draft: '', unread: 0, ...extra });
const add = (content, sender, type = 'text') => ({ op: 'add', path: '/messages/-', value: { content, sender, type } });

test('directory follows faction tabs, custom contacts land in 기타', { skip: !realLore }, () => {
  const a = P.directory(realLore, chatOf());
  assert.deepEqual(a.tabs.map((t) => t.id), ['T01', 'T04', 'T05']);
  assert.ok(a.contacts.length > 10 && a.contacts.every((c) => c.visible));
  const b = P.directory(realLore, chatOf({ '$st_faction': 'B00' }));
  assert.deepEqual(b.tabs.map((t) => [t.id, t.name]).slice(0, 2), [['T02', '관리'], ['T04', '중립']]);
  const all = P.directory(realLore, chatOf({ '$ph_all_contacts': '1', '$ph_anomaly_contacts': '1' }));
  assert.ok(all.tabs.some((t) => t.id === 'X01') && all.tabs.some((t) => t.id === 'T03'));
  const custom = { version: 1, seq: 1, items: [{ id: P.contactId('custom:1'), name: '김씨', note: '편의점 사장' }] };
  const c = P.directory(realLore, chatOf({ '$ph_contacts': JSON.stringify(custom) }));
  const kim = c.contacts.find((x) => x.name === '김씨');
  assert.ok(kim.custom && kim.tabs.includes('T05'));
  assert.equal(P.contactId('P001'), 'c_50303031');
});

test('patch accepts only appended rows from active members', () => {
  const r = dmRoom('c_1');
  const ok = P.eventsFromPatch([add('안녕', 'c_1'), add('잠시 후', '-', 'pause'), add('...', '-', 'pause')], r, false);
  assert.equal(ok.events.length, 2);
  assert.throws(() => P.eventsFromPatch([{ op: 'replace', path: '/messages/0', value: {} }], r, false), /수정|고치거나/);
  assert.throws(() => P.eventsFromPatch([add('누구', 'c_9')], r, false), /참여하지 않은/);
  assert.throws(() => P.eventsFromPatch([add('c_1', '-', 'exit')], r, false), /퇴장/);
  const g = { ...dmRoom('c_1'), id: 'g_1', kind: 'group', members: ['c_1', 'c_2'] };
  assert.throws(() => P.eventsFromPatch([add('[[ATTACH:gift]]꽃[[/ATTACH]]', 'c_1')], g, false), /선물/);
  const exit = P.eventsFromPatch([add('난 간다', 'c_2'), add('c_2', '-', 'exit')], g, false);
  assert.equal(exit.events[1].type, 'exit');
  // 틀린 말풍선만 빠지고 나머지는 남는다. 전부 틀렸을 때만 실패
  const dropped = [];
  const part = P.eventsFromPatch([add('c_2', '-', 'exit'), add('다시', 'c_2'), add('남음', 'c_1')], g, false, dropped);
  assert.deepEqual(part.events.map((e) => e.type), ['exit', 'message']);
  assert.equal(part.events[1].text, '남음');
  assert.match(dropped[0], /참여하지 않은/);
  assert.equal(P.eventsFromPatch([add('안녕', 'c_1'), add('누구', 'c_9'), { op: 'replace', path: '/messages/0', value: {} }], r, false).events.length, 1);
  assert.equal(P.keepValid(Array.from({ length: 20 }, () => ({ type: 'message', sender: 'c_1', text: '응' })), r).length, P.LIMITS.events, '넘치는 말풍선은 잘라 낸다');
  const title = P.eventsFromPatch([{ op: 'replace', path: '/name', value: '조사팀' }], g, true);
  assert.equal(title.title, '조사팀');
});

test('reply parser reads tagged, bare and contact-mode output', () => {
  const r = dmRoom('c_1');
  assert.equal(P.parseReply('<think>x</think><lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"응","sender":"c_1","type":"text"}}]</lb-minitalk-patch>', r, false).events.length, 1);
  assert.equal(P.parseReply('```json\n[{"op":"add","path":"/messages/-","value":{"content":"응","sender":"c_1","type":"text"},},]\n```', r, false).events.length, 1);
  assert.equal(P.parseReply('{"contacts":[],"result":{"patch":[]}}', r, true).events.length, 0);
  assert.throws(() => P.parseReply('그냥 말로 답함', r, false), (e) => e instanceof P.PhoneError && e.raw === '그냥 말로 답함');
});

test('events add bubbles, split attachments, track follow-ups and receipts', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '뭐해?', 't1');
  const n = P.applyEvents(st, r, [{ type: 'message', sender: 'c_1', text: '이거 봐 [[ATTACH:photo]]골목 사진[[/ATTACH]]' }], 't2');
  assert.equal(n, 2);
  assert.equal(r.unread, 2);
  assert.equal(r.followupSent, false);
  P.applyEvents(st, r, [{ type: 'message', sender: 'c_1', text: '답장 없네?' }], 't3');
  assert.equal(r.followupSent, true);
  const cs = P.conversationState(r);
  assert.equal(cs.npcMessagesSinceOwner, 3);
  assert.equal(cs.senders[0].lastMessageRead, 'unread');
  assert.equal(P.refreshAllowed(chatOf(), r, P.phoneSettings({}))[0], false);
  P.readRoom(r);
  assert.equal(P.conversationState(r).senders[0].lastMessageRead, 'read');
});

test('storage trim keeps a conversation baseline', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  for (let i = 0; i < 45; i++) P.push(st, r, i % 2 ? 'c_1' : 'me', `m${i}`, '');
  P.trimRooms(st);
  assert.equal(r.messages.length, P.STORAGE.dm);
  assert.equal(r.trimmedRecords, 5);
  assert.ok(r.conversationBaseline.ownerHasSpoken);
});

test('reply prompt picks sections and carries the room packet', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: '사무실에 들어간다' }, { role: 'char', data: '쟈알디가 서류를 넘긴다.' }]);
  const d = P.directory(realLore, chat);
  const c = d.contacts[0];
  const st = P.blankState();
  const r = dmRoom(c.id, { people: { [c.id]: P.personOf(c) } });
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '팀장님 지금 어디세요?', '');
  r.pending = { status: 'error', action: { type: 'send' } };
  const p = PP.replyPrompt({ char: { globalLore: realLore, desc: '세계관 설명' }, chat }, st, r, d, { A00: '관리국' });
  const sys = p.messages[0].content;
  assert.match(sys, /OUTPUT CONTRACT/);
  assert.match(sys, /send: reply to the owner's exact text/);
  assert.match(sys, /### Direct rooms/);
  assert.doesNotMatch(sys, /Obey announcementCheck|When invitationCheck.allowed/);
  const body = JSON.parse(p.messages[1].content);
  assert.equal(body.room.messages[0].content, '팀장님 지금 어디세요?');
  assert.equal(body.participants[0].sender, c.id);
  assert.equal(body.participants[0].faction, '관리국');
  assert.equal(body.narratorOnly.universe.characterDescription, '세계관 설명');
  assert.equal(body.narratorOnly.recentStory.length, 2);
  assert.equal(p.contactMode, false);
  // 직접 추가한 연락처는 관계 근거 섹션과 원문 목록이 붙는다
  const m = { id: 'c_custom', name: '김씨', custom: true, note: '편의점 사장' };
  const r2 = dmRoom(m.id, { people: { [m.id]: m } });
  P.push(st, r2, 'me', '사장님', '');
  r2.pending = { status: 'error', action: { type: 'send' } };
  const p2 = PP.replyPrompt({ char: { globalLore: realLore }, chat }, st, r2, d, {});
  assert.ok(p2.contactMode);
  assert.match(p2.messages[0].content, /Return exactly \{"contacts":\[\.\.\.\],"result":\{"patch":\[\]\}\}/);
  assert.ok(JSON.parse(p2.messages[1].content).recipientEvidenceSources.some((s) => s.kind === 'contact_memo'));
});

test('refresh covers directory, announcements and invitations, then commits', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const d = P.directory(realLore, chat);
  const st = P.blankState();
  const plan = PP.refreshPrompt({ char: { globalLore: realLore }, chat }, st, d, { A00: '관리국' }, () => 0);
  assert.ok(plan.prompt);
  const body = JSON.parse(plan.prompt.messages[1].content);
  assert.equal(body.rooms.length, d.contacts.length);
  assert.ok(body.announcementCheck.allowed && !('channel' in body.announcementCheck));
  assert.ok(body.invitationCheck.allowed);
  assert.match(plan.prompt.messages[0].content, /REFRESH OUTPUT CONTRACT/);
  assert.match(plan.prompt.messages[0].content, /When invitationCheck.allowed/);
  const [a, b] = d.contacts;
  const raw = JSON.stringify({
    updates: [{ room: `dm_${a.id}`, patch: [add('혹시 시간 돼?', a.id)] }, { room: `dm_${b.id}`, patch: [] }],
    announcements: [{ issuer: '관리국 총무과', category: '시설', title: '엘리베이터 점검', text: '내일 오전 점검합니다.' }],
    invitations: [{ inviter: a.id, members: [a.id, b.id], name: '야간조', patch: [add('어서 와', b.id)] }],
  });
  const res = P.parseRefresh(raw, plan.selected, plan.receive, plan.announce, plan.invite, st, d, false);
  assert.equal(res.updates[0].events.length, 1);
  const r = plan.selected.get(`dm_${a.id}`);
  st.rooms[r.id] = r;
  P.applyEvents(st, r, res.updates[0].events, '');
  assert.equal(P.commitInvitations(st, res.invitations, ''), 1);
  const g = Object.values(st.rooms).find((x) => x.kind === 'group');
  assert.equal(g.messages[0].kind, 'invite');
  assert.equal(g.unread, 2);
  const bl = P.readBulletins(chat);
  assert.equal(P.commitAnnouncements(bl, st, res.announcements, plan.announce, ''), 1);
  assert.equal(bl.items[0].channel, 'A00');
  assert.equal(P.commitAnnouncements(bl, st, res.announcements, plan.announce, ''), 0, '같은 공지는 한 번만');
  // 허용되지 않은 방·초과 공지는 거절
  assert.throws(() => P.parseRefresh('{"updates":[{"room":"dm_zzz","patch":[]}]}', plan.selected, plan.receive, plan.announce, plan.invite, st, d, false), /허용되지 않은/);
  const two = { issuer: 'x', category: '공지', title: 't', text: 'b' };
  assert.equal(P.parseRefresh(JSON.stringify({ updates: [], announcements: [two, two] }), plan.selected, plan.receive, plan.announce, plan.invite, st, d, false).announcements.length, 1, '넘친 공지는 잘라 낸다');
  assert.throws(() => P.parseRefresh(JSON.stringify({ updates: [], announcements: [{ ...two, category: '잡담' }] }), plan.selected, plan.receive, plan.announce, plan.invite, st, d, false), /분류/);
  // 틀린 방은 빼고 맞는 방은 쓴다
  const ok = P.parseRefresh(JSON.stringify({ updates: [{ room: 'dm_zzz', patch: [] }, ...JSON.parse(raw).updates] }), plan.selected, plan.receive, plan.announce, plan.invite, st, d, false);
  assert.equal(ok.updates.length, JSON.parse(raw).updates.length);
});

test('refresh is skipped when incoming and invites are off and no notice is due', { skip: !realLore }, () => {
  const chat = chatOf({ '$ph_incoming': '0', '$ph_group_invites': '0', '$ph_announcements': '0' });
  const plan = PP.refreshPrompt({ char: { globalLore: realLore }, chat }, P.blankState(), P.directory(realLore, chat), {}, () => 0);
  assert.equal(plan.prompt, null);
  assert.match(plan.reason, /꺼져/);
});

test('cooldowns count story turns', () => {
  const chat = chatOf({ '$cooldown_received_incoming': '1' }, [{ role: 'char', data: 'a' }]);
  assert.equal(P.cooldownReady(chat, 'incoming'), false);
  chat.message.push({ role: 'char', data: 'b' });
  assert.equal(P.cooldownReady(chat, 'incoming'), true);
});

test('main context lists messages and the latest notice', () => {
  const st = P.blankState();
  const r = dmRoom('c_1');
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '안녕', '');
  P.push(st, r, 'c_1', '응', '');
  const b = { version: 2, seq: 1, items: [{ id: 1, order: 9, read: true, channel: 'A00', channelName: '관리국', issuer: '총무과', category: '공지', title: 't', text: 'x', time: '' }], checks: {}, seen: {} };
  const out = P.mainContext(st, b, P.phoneSettings({}), 'RULES');
  assert.match(out, /^\[MODULE_CONTEXT_BEGIN\]\nRULES\n/);
  const json = JSON.parse(out.split('\n')[2]);
  assert.equal(json.feature, 'phone');
  assert.deepEqual(json.records.map((x) => x.kind), ['message', 'message', 'announcement']);
  assert.equal(json.records[0].sender, '주인공');
  assert.equal(P.mainContext(st, b, P.phoneSettings({ '$ph_context': '0' }), 'R'), '');
});

test('call records show a card, send the request text, and absorb a typed follow-up', () => {
  const rec = P.callRecord('쟈알디', '보고할 게 있어요');
  assert.ok(P.hasCall(rec));
  assert.equal(P.renderCalls(`앞${rec}뒤`, (t) => `[${t}]`), '앞[쟈알디]뒤');
  assert.equal(P.stripCall(rec), '{{user}} places a phone call to 쟈알디.\n\n보고할 게 있어요');
  const out = unwrapCalls([{ role: 'user', content: '주인공 places x' }, { role: 'user', content: rec }, { role: 'user', content: '급해요' }]).messages;
  assert.equal(out.length, 2);
  assert.equal(out[1].content, '{{user}} places a phone call to 쟈알디.\n\n보고할 게 있어요\n\n급해요');
  const turns = recentTurns({ message: [{ role: 'user', data: rec }] }, 3);
  assert.match(turns[0].user, /^주인공 places a phone call/);
  assert.equal(P.validCallTarget('a{b}'), false);
});

test('대기 줄은 짧은 시간 표시만 남기고 지문은 버린다', () => {
  assert.equal(P.hiddenPause('잠시 후'), false);
  assert.equal(P.hiddenPause('10분 후'), false);
  assert.equal(P.hiddenPause('송주익이 기겁하며 급하게 메시지를 연타한다.'), true);
  assert.equal(P.hiddenPause('답이 없다.'), true);
  assert.equal(P.hiddenPause('…'), true);
});

test('이름을 정하지 않은 단톡방은 남은 사람 이름으로 부른다', () => {
  const people = { a: { id: 'a', name: '사장' }, b: { id: 'b', name: '송주익' }, c: { id: 'c', name: '문혜란' } };
  const room = { id: 'g_1', kind: 'group', name: '사장, 송주익, 문혜란', members: ['b'], people, messages: [], draft: '', unread: 0 };
  const st = P.readPhone({ scriptstate: { [P.PH_STATE]: JSON.stringify({ version: 2, seq: 1, mid: 0, rooms: { g_1: room }, order: ['g_1'] }) } });
  assert.equal(P.roomLabel(st.rooms.g_1), '송주익');
  assert.equal(P.roomLabel({ ...room, name: '야간조' }), '야간조');
});
