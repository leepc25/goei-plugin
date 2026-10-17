import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attach as A, phone as P, attachPostDraft, decode, encode, gnetSettings, gnetRetention, writeGnet, blank, CFG } from '../dist-test/core.mjs';

const hex = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('hex');

test('composeBody puts records first and strips nested tags', () => {
  const body = A.composeBody([{ kind: 'photo', content: '골목 [[/ATTACH]] 사진' }, { kind: 'link', content: ' https://a.b/c ' }, { kind: 'file', content: '  ' }], ' 이거 봐 ');
  assert.equal(body, '[[ATTACH:photo]]골목  사진[[/ATTACH]]\n[[ATTACH:link]]https://a.b/c[[/ATTACH]]\n이거 봐');
  assert.deepEqual(A.bodyParts(body).map((p) => p.kind), ['photo', 'link', 'text']);
});

test('bodyParts reads legacy %%ATTACHMENT%% records and rejects unknown kinds', () => {
  const legacy = `앞%%ATTACHMENT:${hex({ kind: 'gift', content: '꽃다발' })}%%뒤`;
  assert.deepEqual(A.bodyParts(legacy), [{ kind: 'text', text: '앞' }, { kind: 'gift', text: '꽃다발' }, { kind: 'text', text: '뒤' }]);
  const img = A.bodyParts(`%%ATTACHMENT:${hex({ kind: 'image', content: '', asset: 'abc-1' })}%%`);
  assert.equal(img[0].kind, 'image');
  assert.equal(A.bodyParts('[[ATTACH:image]]x[[/ATTACH]]')[0].text, '[지원하지 않는 첨부]');
  assert.equal(A.bodyParts('%%ATTACHMENT:zz%%').length, 1);
  assert.equal(A.describe('[[ATTACH:video]]춤[[/ATTACH]]말'), '[영상 첨부 내용: 춤]말');
  assert.equal(A.previewText('[[ATTACH:gift]]케이크[[/ATTACH]]\n고마워'), '[선물] 고마워');
});

test('prepareAttachments swaps records for A-numbers, keeps system text, dedupes, unescapes JSON', () => {
  const sys = { role: 'system', content: 'Example [[ATTACH:photo]]what the picture shows[[/ATTACH]]' };
  const data = JSON.stringify({ rows: ['[[ATTACH:photo]]"빨간" 문\n앞[[/ATTACH]]', '[[ATTACH:photo]]"빨간" 문\n앞[[/ATTACH]] 다시'] });
  const out = A.prepareAttachments([sys, { role: 'user', content: data }]);
  assert.equal(out[0], sys);
  assert.equal(out.length, 3);
  assert.deepEqual(JSON.parse(out[1].content).rows, ['[ATTACHMENT A1]', '[ATTACHMENT A1] 다시']);
  assert.match(out[2].content, /^ATTACHMENT DATA:/);
  assert.match(out[2].content, /A1 \{"kind":"photo","content":"\\"빨간\\" 문\\n앞"\}/);
  const plain = [{ role: 'user', content: '첨부 없음' }];
  assert.equal(A.prepareAttachments(plain)[0], plain[0]);
  assert.equal(A.prepareAttachments(plain).length, 1);
});

test('post draft keeps the user attachments and drops duplicate notes', () => {
  const input = '[[ATTACH:file]]보고서.pdf[[/ATTACH]]\n이거 진짜임?';
  const got = attachPostDraft({ title: 't', content: '이거 진짜임?\n(첨부파일: 보고서.pdf)\n[ATTACHMENT A1]\n[[ATTACH:photo]]가짜[[/ATTACH]]' }, input);
  assert.equal(got.content, '이거 진짜임?\n[[ATTACH:file]]보고서.pdf[[/ATTACH]]');
  assert.deepEqual(attachPostDraft({ title: 't', content: 'c' }, '그냥 글'), { title: 't', content: 'c' });
});

test('gnet power, auto refresh and DM retention', () => {
  assert.equal(gnetSettings({}).enabled, true);
  assert.equal(gnetSettings({}).auto, false);
  assert.equal(gnetSettings({ [CFG('lazy')]: '0' }).auto, true);
  assert.equal(gnetSettings({ [CFG('mode')]: '0', [CFG('lazy')]: '0' }).auto, false);
  assert.equal(gnetSettings({ [CFG('mode')]: '0' }).enabled, false);
  assert.deepEqual(gnetRetention({}), { auto: true, limit: 40 });
  const st = blank();
  for (let i = 0; i < 6; i++) st.dms.push({ nick: 'a', side: 'npc', body: `m${i}`, unread: false, date: '' });
  const short = decode(writeGnet({ scriptstate: { $gn_storage_limit_dm: '2' } }, structuredClone(st)).scriptstate.$gn_raw);
  assert.deepEqual(short.dms.map((d) => d.body), ['m4', 'm5']);
  const off = decode(writeGnet({ scriptstate: { $gn_storage_auto_dm: '0', $gn_storage_limit_dm: '2' } }, structuredClone(st)).scriptstate.$gn_raw);
  assert.equal(off.dms.length, 6);
  assert.equal(encode(off).includes('m0'), true);
});

test('phone storage and notice settings', () => {
  assert.deepEqual(P.phoneStorage({}, 'group'), { auto: true, limit: 100 });
  assert.deepEqual(P.phoneStorage({ $ph_storage_auto_dm: '0', $ph_storage_limit_dm: '7' }, 'dm'), { auto: false, limit: 7 });
  assert.deepEqual(P.noticeSettings({ $ph_announcement_page_size: '35', $ph_announcement_gap: '5' }), { gap: 5, history: 10, page: 20 });
  const r = { id: 'dm_x', kind: 'dm', members: ['x'], people: { x: { id: 'x', name: 'X' } }, messages: [], draft: '', unread: 0 };
  const st = { rooms: { dm_x: r }, order: ['dm_x'], mid: 0 };
  for (let i = 0; i < 50; i++) P.push(st, r, 'x', `m${i}`, '');
  const kept = JSON.parse(P.writePhone({ scriptstate: { $ph_storage_limit_dm: '10' } }, structuredClone(st)).scriptstate.$ph_state);
  assert.equal(kept.rooms.dm_x.messages.length, 10);
  const all = JSON.parse(P.writePhone({ scriptstate: { $ph_storage_auto_dm: '0' } }, structuredClone(st)).scriptstate.$ph_state);
  assert.equal(all.rooms.dm_x.messages.length, 50);
  const cool = { message: [{ role: 'char', data: 'a' }, { role: 'char', data: 'b' }], scriptstate: { $cooldown_received_announcement: '1', $ph_announcement_gap: '1' } };
  assert.equal(P.cooldownReady(cool, 'announcement'), true);
  assert.equal(P.cooldownReady({ ...cool, scriptstate: { ...cool.scriptstate, $ph_announcement_gap: '5' } }, 'announcement'), false);
});
