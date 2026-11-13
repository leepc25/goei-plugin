// 전수검사 11-13 고침 3: 괴담톡 절 고르기·보기 방 확인, 쇼핑몰·연어 마켓 지침, 로어 표식 떼기, 위키 표·링크·본편 문서·그림
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REAL } from './realcard.mjs';
import { initTestData } from './data-init.mjs';

const dir = '/tmp/audit_1113/fix3/text';
await mkdir(dir, { recursive: true });
const file = join(dir, 'core.mjs');
const define = Object.fromEntries(['__UPDATE_BASE__', '__PLUGIN_VERSION__', '__WORLD_PACK__', '__INSTALL_PACK__', '__ITEMS_PACK__', '__LOOKS_PACK__', '__HOMESHOP_PACK__'].map((k) => [k, '"{}"']));
await build({ entryPoints: ['src/core/index.ts'], outfile: file, bundle: true, platform: 'node', format: 'esm', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, define, logLevel: 'silent' });
const C = await import(pathToFileURL(file));
initTestData(C);
const G = await import(pathToFileURL(await (async () => {
  const f = join(dir, 'guides.mjs');
  await build({ entryPoints: ['src/core/guides.ts'], outfile: f, bundle: true, platform: 'node', format: 'esm', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent' });
  return f;
})()));

const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;
const P = C.phone;
const PP = C.phonePrompt;
const chatOf = (vars = {}, message = []) => ({ message, scriptstate: { '$st_faction': 'A00', ...vars } });
const dmRoom = (cid, extra = {}) => ({ id: `dm_${cid}`, kind: 'dm', members: [cid], people: { [cid]: { id: cid, name: '상대' } }, messages: [], draft: '', unread: 0, ...extra });

test('괴담톡: 내가 보낸 말에 답할 때는 Direct rooms 절을 붙이지 않는다 (gphone#7)', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: '사무실' }, { role: 'char', data: '조용하다' }]);
  const d = P.directory(realLore, chat);
  const c = d.contacts[0];
  const st = P.blankState();
  const r = dmRoom(c.id, { people: { [c.id]: P.personOf(c) } });
  st.rooms[r.id] = r;
  P.push(st, r, 'me', '어디세요?', '');
  r.pending = { status: 'error', action: { type: 'send' } };
  const send = PP.replyPrompt({ char: { globalLore: realLore, desc: '' }, chat }, st, r, d, {}).messages[0].content;
  assert.doesNotMatch(send, /### Direct rooms/);
  assert.match(send, /send: reply to the owner's exact text/);
  r.pending = { status: 'error', action: { type: 'refresh' } };
  const refresh = PP.replyPrompt({ char: { globalLore: realLore, desc: '' }, chat }, st, r, d, {}).messages[0].content;
  assert.match(refresh, /### Direct rooms/, '방 새로고침에는 그대로');
});

test('괴담톡: 말이 있는 방이 둘 이상일 때만 방 사이 기억 절 (gphone#8)', { skip: !realLore }, () => {
  const chat = chatOf({}, [{ role: 'user', data: '사무실' }, { role: 'char', data: '조용하다' }]);
  const d = P.directory(realLore, chat);
  const src = { char: { globalLore: realLore, desc: '' }, chat };
  const cross = /crossRoomMessages contains retained messages/;
  const plan = (st) => PP.refreshPrompt(src, st, d, {}, () => 0).prompt;
  const blank = plan(P.blankState());
  assert.ok(JSON.parse(blank.messages[1].content).rooms.length > 1, '빈 후보 방은 여럿');
  assert.doesNotMatch(blank.messages[0].content, cross, '말이 있는 방이 없으면 붙지 않는다');
  const two = P.blankState();
  for (const c of d.contacts.slice(0, 2)) {
    const r = dmRoom(c.id, { people: { [c.id]: P.personOf(c) } });
    two.rooms[r.id] = r;
    P.push(two, r, c.id, '안녕', '');
  }
  assert.match(plan(two).messages[0].content, cross, '말이 있는 방이 둘이면 붙는다');
});

test('괴담톡 보기 방: 지침 속 낱말이 아니라 절이 있는지로 본다 (hardcode#12)', () => {
  const src = readFileSync(new URL('../src/core/phonePrompt.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(p\['VIEW\.OUTPUT'\] === undefined\) throw new PhoneError/);
  assert.doesNotMatch(src, /system\.includes\('OUTPUT CONTRACT'\)/);
});

test('우주 쇼핑몰만 흥정 문장이 없다 (gshop#6 = 사용자 승인 가-3)', () => {
  const shop = G.guideDefault('Shop');
  const cos = G.guideDefault('Cos');
  const bm = G.guideDefault('Bm');
  assert.match(shop, / Haggling: the owner may refuse/);
  assert.doesNotMatch(cos, /Haggling:/);
  // 포인트몰은 주인 대화가 1:1 상담(BmDesk)으로 가서 TALK 절 자체가 빠졌다 (나-52 사용자 승인)
  assert.doesNotMatch(bm, /@@SECTION TALK\n/);
  assert.doesNotMatch(bm, /Haggling:/);
});

test('로어 원문 첫 줄의 @@dont_activate 는 떼고 보낸다 (ggnet#13)', () => {
  const src = { char: { name: 'x', desc: '', globalLore: [{ key: '', comment: '에일린', content: '@@dont_activate\n에일린 본문\n\n---', mode: 'normal' }] }, chat: { message: [], scriptstate: {}, localLore: [] } };
  const t = C.bookText(src, '에일린');
  assert.ok(t.startsWith('에일린 본문'), t);
  assert.doesNotMatch(t, /dont_activate/);
});

test('위키 표: RowHead 는 첫 칸만 머리 칸 (gshop#10·wiki#11)', () => {
  const body = '<lightboard-namuwiki doc_title="t">[Paragraph]a\n[Table]Head:a;;b|RowHead:가;;1|Row:나;;2</lightboard-namuwiki>';
  const r = C.renderArticle(body, { saved: () => false, canon: (x) => x });
  assert.match(r.html, /<tr><th>a<\/th><th>b<\/th><\/tr>/);
  assert.match(r.html, /<tr><th>가<\/th><td>1<\/td><\/tr>/);
  assert.match(r.html, /<tr><td>나<\/td><td>2<\/td><\/tr>/);
});

test('위키 링크: 분류 표는 본문과 겹쳐도 링크를 둔다 (wiki#10)', () => {
  const canon = (x) => x;
  const out = C.reviewLinks('[Paragraph]➡️가➡️와 ➡️나➡️, 또 ➡️가➡️\n[CategoryTable]Caption:집단|Row:➡️가➡️;;➡️나➡️;;➡️마➡️;;➡️가➡️', 't', canon);
  const [p, tbl] = out.split('\n');
  assert.equal(p, '[Paragraph]➡️가➡️와 ➡️나➡️, 또 가', '본문 중복은 그대로 지운다');
  assert.equal(tbl, '[CategoryTable]Caption:집단|Row:➡️가➡️;;➡️나➡️;;➡️마➡️;;가', '표 안 중복만 지운다');
  assert.equal(C.reviewLinks('[Paragraph]➡️t➡️', 't', canon), '[Paragraph]t', '자기 링크는 지운다');
});

test('위키 본편 문서: 부모 원본을 물려받은 창작 문서는 창작 문서로 센다 (wiki#6)', () => {
  const meta = (title, created, primarySources) => ({ title, mode: 'expand', model: 'main', created, length: 'short', sources: [], primarySources, writingRequest: '', direct: false });
  const body = (t) => `<lightboard-namuwiki>[Paragraph]${t}</lightboard-namuwiki>`;
  let chat = { message: [], scriptstate: {}, localLore: [] };
  chat = C.saveDoc(chat, meta('소라 랜드', 10, ['소라 랜드']), body('부모'));
  chat = C.saveDoc(chat, meta('북관의 역행 계단', 20, ['소라 랜드']), body('자식'));
  chat.scriptstate = { '$nw_adv_ctx_focus': '0', '$nw_adv_ctx_count': '5' };
  const rec = JSON.parse(C.wikiMainContext(chat, 'R').split('\n')[2]).records;
  assert.deepEqual(rec.map((r) => r.title), ['북관의 역행 계단']);
});

test('위키 그림: 주제 표시가 있으면 첫 항목이라도 표시로만 가린다 (wiki#7)', () => {
  const src = { char: { name: '괴이', desc: '', globalLore: [] }, chat: { message: [], scriptstate: {}, localLore: [] } };
  const req = (images) => ({ title: '에일린', writingRequest: '', inherited: [], previous: null, direct: false, images });
  const off = C.wikiPrompt(src, req([{ name: 'Sora Land', label: '소라 랜드', subject: false }]), C.wikiSettings({}), {}).messages[0].content;
  assert.doesNotMatch(off, /Sora Land/);
  const on = C.wikiPrompt(src, req([{ name: 'Eileen', label: '다른 이름', subject: true }]), C.wikiSettings({}), {}).messages[0].content;
  assert.match(on, /- Eileen = 다른 이름/);
  const old = C.wikiPrompt(src, req([{ name: 'First', label: '첫 그림' }]), C.wikiSettings({}), {}).messages[0].content;
  assert.match(old, /- First = 첫 그림/, '표시 없는 옛 호출은 예전처럼');
});
