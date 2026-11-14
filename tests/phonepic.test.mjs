// 괴담톡에서 인물이 에셋 그림을 사진으로 보내던 기능을 뺐다 (2026-11-12 사용자: 감정 표시처럼 썼다).
// 괴담넷 쪽 [사진:…] 은 그대로다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as core from '../dist-test/core.mjs';
import { REAL } from './realcard.mjs';

const { phone: P, phonePrompt: PP, attach: AT } = core;
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;
const chatOf = (vars = {}, message = []) => ({ message, scriptstate: { '$st_faction': 'A00', ...vars } });
const phoneTxt = readFileSync(new URL('../src/data/guides/phone.txt', import.meta.url), 'utf8');
const gnetTxt = readFileSync(new URL('../src/data/guides/gnet.txt', import.meta.url), 'utf8');

test('괴담톡 지침에 에셋 사진 보내기 줄이 없고, 괴담넷 지침에는 그대로 있다', () => {
  assert.doesNotMatch(phoneTxt, /\[사진:/);
  assert.doesNotMatch(phoneTxt, /__SITE_PICS__/);
  assert.match(phoneTxt, /\[\[ATTACH:photo\]\]what the picture shows\[\[\/ATTACH\]\]/, '글 사진 설명은 그대로');
  assert.match(gnetTxt, /\[사진:Name\]/);
  assert.match(gnetTxt, /__SITE_PICS__/);
});

test('옛 [사진:이름_표정] 은 모델에게 글 사진 설명으로 넘어간다', () => {
  assert.equal(AT.sitePicAsPhoto('봐라\n[사진:진나솔_angry]\n됐냐'), '봐라\n[[ATTACH:photo]]진나솔[[/ATTACH]]\n됐냐');
  assert.equal(AT.sitePicAsPhoto('[사진:Jin Na-sol]'), '[[ATTACH:photo]]Jin Na-sol[[/ATTACH]]');
  assert.equal(AT.sitePicAsPhoto('그냥 말'), '그냥 말');
  assert.equal(AT.previewText('[사진:진나솔_angry] 됐냐'), '[사진] 됐냐', '목록 미리보기는 전과 같다');
});

test('괴담톡 요청문: 사진 목록·표식 안내가 없고, 방 기록의 옛 표식도 바뀌어 간다 (고쳐 둔 옛 지침이어도)', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const d = P.directory(realLore, chat);
  const c = d.contacts[0];
  const mk = () => {
    const st = P.blankState();
    const r = { id: `dm_${c.id}`, kind: 'dm', members: [c.id], people: { [c.id]: P.personOf(c) }, messages: [], draft: '', unread: 0 };
    st.rooms[r.id] = r;
    P.push(st, r, c.id, '하, 미치겠네.\n[사진:진나솔_angry]', '');
    P.push(st, r, 'me', '죄송합니다', '');
    r.pending = { status: 'error', action: { type: 'send' } };
    return PP.replyPrompt({ char: { globalLore: realLore }, chat }, st, r, d, { A00: '관리국' });
  };
  const check = (p) => {
    const sys = p.messages[0].content;
    assert.match(sys, /\[\[ATTACH:photo\]\]what the picture shows/, '첨부 절은 들어간다');
    assert.doesNotMatch(sys, /\[사진:|__SITE_PICS__|Real photos:|People \(may add _expression\)|Expressions:/);
    const body = p.messages[1].content;
    assert.doesNotMatch(body, /\[사진:/);
    assert.match(body, /\[\[ATTACH:photo\]\]진나솔\[\[\/ATTACH\]\]/);
  };
  check(mk());
  // 사용자가 옛 글 그대로 고쳐 저장해 둔 지침 (그 두 줄이 남아 있음)
  const old = phoneTxt.replace('@@SECTION ATTACHMENT_OUTPUT\n', '@@SECTION ATTACHMENT_OUTPUT\nMY OWN LINE\n').replace(/(\n@@END\n\n@@SECTION PATCH)/, "\nReal photos: when the subject is one of the pictures listed below, an NPC may send [사진:Name] instead of a photo description, or [사진:Name_expression] for a person in the People list; the app shows the actual picture. Write the listed name exactly, on its own line inside the content/body string. Anything not listed stays a described [[ATTACH:photo]]. Send one only when that character would plausibly have or take such a photo.\n__SITE_PICS__$1");
  assert.match(old, /__SITE_PICS__/);
  core.setGuideOverride('Phone', old);
  try {
    const p = mk();
    assert.match(p.messages[0].content, /MY OWN LINE/, '고친 지침이 쓰였다');
    check(p);
  } finally {
    core.setGuideOverride('Phone', null);
  }
});

test('괴담넷 요청문에는 사진 안내가 그대로 들어가고, 목록은 이번 요청 자료에 이름이 나온 것만이다 (11-14 E-14)', { skip: !realLore }, () => {
  const src = (message) => ({ char: { globalLore: realLore }, chat: chatOf({}, message) });
  const b = core.gnetBooks(src([]));
  const sec = gnetTxt.slice(0, gnetTxt.indexOf('Real photos: when the subject')).match(/@@SECTION (\S+)[^@]*$/)[1];
  const raw = b.read(sec);
  assert.match(raw, /Real photos: when the subject/);
  assert.match(b.pics(raw, ''), /Available pictures: none\.$/, '자료에 아무도 없으면 지침의 「없음」 줄');
  // 실제 요청문: 자리가 남지 않고, 본문에 나온 이름만 목록에 있다
  const st = { seq: 100001, posts: [], dms: [], sources: {} };
  const sysOf = (message) => {
    const s = src(message);
    return core.refreshPrompt(s, st, core.incomingPlan(s.chat, st, core.gnetSettings(s.chat.scriptstate), '나', () => 0.99), '나', {}).messages[0].content;
  };
  const things = (sys) => /^Anomalies, people and places \(no expression\): (.*)$/m.exec(sys)?.[1].split(', ') ?? [];
  const everything = things(b.pics(raw, JSON.stringify(realLore)));
  assert.ok(everything.length > 20, '명부에 그림 있는 괴이·장소가 여럿');
  const quiet = sysOf([{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  assert.doesNotMatch(quiet, /__SITE_PICS__/);
  assert.match(quiet, /Real photos: when the subject/);
  assert.ok(things(quiet).length < everything.length / 2, '전체 목록이 통째로 붙지 않는다');
  const name = everything.find((n) => !things(quiet).includes(n));
  const hit = sysOf([{ role: 'user', data: `${name} 얘기를 들었다` }, { role: 'char', data: '조용했다.' }]);
  assert.ok(things(hit).includes(name), '본문에 나온 대상은 목록에 있다');
  assert.equal(things(hit).length, things(quiet).length + 1, '그것만 더해진다');
  // 인물 줄: 늘 붙는 참고 기록(🙂Roster)의 이름은 세지 않는다 (사용자 2026-11-14 E-14 물음 2)
  const people = (sys) => /^People \(may add _expression\): (.*)$/m.exec(sys)?.[1].split(', ') ?? [];
  const everyone = people(b.pics(raw, JSON.stringify(realLore)));
  assert.ok(everyone.length > 20, '명부에 그림 있는 인물이 여럿');
  assert.match(core.refreshPrompt(src([{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]), st, core.incomingPlan(chatOf(), st, core.gnetSettings({}), '나', () => 0.99), '나', {}).messages[1].content, /\[활성 로어북: 🙂Roster\]/, '참고 자료에는 명부가 그대로 간다');
  assert.equal(people(quiet).length, 0, `조용한 새로고침의 인물 줄: ${everyone.length} → ${people(quiet).length}`);
  assert.doesNotMatch(quiet, /^Expressions: /m, '인물이 없으면 표정 줄도 없다');
  const who = sysOf([{ role: 'user', data: `${everyone[3]} 얘기를 들었다` }, { role: 'char', data: '조용했다.' }]);
  assert.deepEqual(people(who), [everyone[3]], '본문에 나온 인물만');
  const board = { ...st, posts: [{ id: 100000, nick: 'ㅇㅇ', title: `${everyone[5]} 봤다`, body: '진짜임', date: '', views: 1, votes: 0, mine: false, comments: [] }] };
  const s2 = src([{ role: 'user', data: 'a' }, { role: 'char', data: 'b' }]);
  const onBoard = core.refreshPrompt(s2, board, core.incomingPlan(s2.chat, board, core.gnetSettings(s2.chat.scriptstate), '나', () => 0.99), '나', {}).messages[0].content;
  assert.deepEqual(people(onBoard), [everyone[5]], '게시판 글에 나온 인물만');
  console.log(`E-14 조용한 새로고침: 인물 ${everyone.length} → ${people(quiet).length}, 괴이·장소 ${everything.length} → ${things(quiet).length}`);
  const dm = core.dmPrompt(src([]), { ...st, dms: [{ nick: 'x', side: 'me', body: '안녕', unread: false, date: '' }] }, 'x', '안녕', '나', {}).messages[0].content;
  assert.doesNotMatch(dm, /__SITE_PICS__/);
  assert.ok(things(dm).length < everything.length / 2, '쪽지 요청도 같다');
});

test('본편 참고로 가는 괴담톡 기록에도 옛 표식이 그대로 가지 않는다', () => {
  core.advanced.applyAdvanced({});
  const st = P.blankState();
  const r = { id: 'dm_c_1', kind: 'dm', members: ['c_1'], people: { c_1: { id: 'c_1', name: '진나솔' } }, messages: [], draft: '', unread: 0 };
  st.rooms[r.id] = r; st.order = [r.id];
  P.push(st, r, 'c_1', '[사진:진나솔_angry]', '19:25');
  P.push(st, r, 'c_1', '하, 미치겠네.', '19:25');
  const text = P.mainContext(st, { items: [] }, P.phoneSettings({}), 'R', null);
  assert.ok(text, '기록이 넘어간다');
  assert.doesNotMatch(text, /\[사진:/);
  assert.match(text, /진나솔/);
  assert.match(text, /하, 미치겠네\./);
});
