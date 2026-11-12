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

test('괴담넷 요청문에는 사진 목록이 그대로 들어간다', { skip: !realLore }, () => {
  const list = core.sitePicList ? core.sitePicList({ globalLore: realLore }) : null;
  const b = core.gnetBooks({ char: { globalLore: realLore }, chat: chatOf() });
  const sec = gnetTxt.slice(0, gnetTxt.indexOf('Real photos: when the subject')).match(/@@SECTION (\S+)[^@]*$/)[1];
  const all = b.read(sec);
  assert.doesNotMatch(all, /__SITE_PICS__/);
  assert.match(all, /Real photos: when the subject/);
  assert.match(all, /People \(may add _expression\)|Available pictures: none\./);
  if (list) assert.ok(all.includes(list.split('\n')[0]));
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
