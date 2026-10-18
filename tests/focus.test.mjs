import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focus as F, phone as P, advanced, mainContext, G_POST_BASE, addUserPost, wikiMainContext, saveDoc } from '../dist-test/core.mjs';

const reg = { entries: [], byTerm: new Map(), byLore: new Map() };
const msg = (id, sender, text, who) => ({ id, sender, text, kind: 'text', audience: [who], time: '' });
const room = (id, cid, name, msgs) => ({ id, kind: 'dm', members: [cid], people: { [cid]: { id: cid, name } }, messages: msgs, draft: '', unread: 0 });
const records = (t) => (t ? JSON.parse(t.split('\n')[2]).records : []);

test('focus: scene text takes the last turns without system prompts, names match with particles', () => {
  const scene = F.sceneText([{ role: 'system', content: '윤서아 시스템' }, { role: 'user', content: '옛 글' }, { role: 'assistant', content: '윤서아가 문을 열었다' }, { role: 'user', content: '따라간다' }], 1);
  assert.equal(scene, '윤서아가 문을 열었다\n따라간다');
  const f = F.makeFocus(scene, reg);
  assert.ok(F.related(f, ['윤서아']));
  assert.ok(!F.related(f, ['서아']), '다른 이름의 일부는 아님');
  assert.ok(!F.related(null, ['윤서아']));
});

test('focus: phone main context puts scene-related rooms first, keeps a few newest, stays in time order', () => {
  advanced.applyAdvanced({});
  const old = Array.from({ length: 5 }, (_, i) => msg(i + 1, 'c_1', `서아 옛말 ${i}`, 'c_1'));
  const chatter = Array.from({ length: 30 }, (_, i) => msg(100 + i, 'c_2', `잡담 ${i}`, 'c_2'));
  const st = { ...P.blankState(), rooms: { dm_1: room('dm_1', 'c_1', '윤서아', old), dm_2: room('dm_2', 'c_2', '박도윤', chatter) } };
  const set = P.phoneSettings({});
  const f = F.makeFocus('윤서아와 폐건물에 들어갔다', reg);
  const got = records(P.mainContext(st, { items: [] }, set, 'R', f));
  assert.equal(got.filter((r) => r.title === '윤서아').length, 5, '관련 방은 오래돼도 들어감');
  assert.equal(got.filter((r) => r.title === '박도윤').length, P.HISTORY.contextRecent, '관련 없는 방은 최근 몇 개만');
  assert.deepEqual(got.map((r) => r.order), got.map((r) => r.order).slice().sort((a, b) => a - b));
  // 장면 관련 먼저를 끄면 원본처럼 최근 순
  advanced.applyAdvanced({ '$ph_adv_ctx_focus': '0' });
  const plain = records(P.mainContext(st, { items: [] }, set, 'R', f));
  assert.equal(plain.filter((r) => r.title === '박도윤').length, 30);
  advanced.applyAdvanced({});
});

test('focus: gnet main context keeps the newest post and dms, plus posts and dms about the scene', () => {
  advanced.applyAdvanced({});
  const st = { seq: G_POST_BASE, posts: [], dms: [], sources: {} };
  addUserPost(st, '나', '소라 랜드 후기', '밤에 갇혔다', '');
  addUserPost(st, '나', '점심 메뉴', '김밥', '');
  addUserPost(st, '나', '최신 글', '아무 말', '');
  for (let i = 0; i < 10; i++) st.dms.push({ side: 'other', nick: i === 0 ? '윤서아' : `익명${i}`, body: `쪽지 ${i}`, date: '' });
  const reg2 = { entries: [], byTerm: new Map(), byLore: new Map() };
  const titles = (f) => records(mainContext(st, '나', 'R', f)).map((r) => r.title ?? `${r.kind}:${r.sender}`);
  const got = titles(F.makeFocus('소라 랜드 후기를 다시 읽고 윤서아에게 물었다', reg2));
  assert.ok(got.includes('최신 글') && got.includes('소라 랜드 후기') && !got.includes('점심 메뉴'));
  assert.ok(got.includes('private_message:윤서아'), '오래된 쪽지라도 장면에 나온 상대');
  assert.equal(got.filter((t) => t.startsWith('private_message')).length, 6);
});

test('focus: wiki sends created documents named in the scene in full, lorebook documents only when turned on', () => {
  const meta = (title, created, lore) => ({ title, mode: 'expand', model: 'main', created, length: 'short', sources: [], primarySources: lore ? [title] : [], writingRequest: '', direct: false });
  const body = (t) => `<lightboard-namuwiki>[Heading]Level:1|Title:개요\n[Paragraph]${t} 개요\n[Heading]Level:1|Title:상세\n[Paragraph]${t} 상세</lightboard-namuwiki>`;
  let chat = { message: [], scriptstate: {}, localLore: [] };
  chat = saveDoc(chat, meta('소라 랜드', 10, true), body('소라 랜드'));
  chat = saveDoc(chat, meta('검은 우체통', 20, false), body('검은 우체통'));
  chat = saveDoc(chat, meta('새 문서', 30, false), body('새 문서'));
  const scene = F.makeFocus('소라 랜드 앞의 검은 우체통을 열었다', reg);
  const got = records(wikiMainContext(chat, 'R', scene));
  assert.deepEqual(got.map((r) => r.title), ['검은 우체통'], '로어북 있는 문서는 기본으로 빠짐');
  assert.ok(got[0].content.includes('검은 우체통 상세'), '전문');
  chat.scriptstate = { '$nw_adv_ctx_lore': '1' };
  assert.deepEqual(records(wikiMainContext(chat, 'R', scene)).map((r) => r.title), ['소라 랜드', '검은 우체통']);
  chat.scriptstate = { '$nw_adv_ctx_lore': '1', '$nw_adv_ctx_created': '0' };
  assert.deepEqual(records(wikiMainContext(chat, 'R', scene)).map((r) => r.title), ['소라 랜드']);
  chat.scriptstate = {};
  assert.equal(wikiMainContext(chat, 'R', F.makeFocus('아무 일 없음', reg)), '');
});
