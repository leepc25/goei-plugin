import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import {
  evaluate, buildRegistry, resolveName, referenceEntries, termPresent, collectRefs, limitRefs, refText, recentTurns, storyText,
  policySections, factionCodesToNames, canonicalTitle, wikiPrompt, acceptArticle, renderArticle, saveDoc, listDocs, findDoc, deleteDoc,
  WIKI_DEFAULTS, validTitle, sceneRecord, stripModules, prepareBaseDocs, baseDocs, WIKI_PACK_HEAD,
} from '../dist-test/core.mjs';

import { REAL } from './realcard.mjs';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;

test('cbs: getvar, if/else, when forms, comparisons, unknown tags kept', () => {
  const env = { vars: { $st_faction: 'B00', $n: '3', $empty: '' }, user: '나', char: '괴이봇' };
  assert.equal(evaluate('{{#if {{equal::{{getvar::st_faction}}::B00}}}}가짜{{/if}}{{#if {{not_equal::{{getvar::st_faction}}::B00}}}}진짜{{/if}}', env), '가짜');
  assert.equal(evaluate('{{#when::st_faction::vis::A00}}A{{:else}}B{{/when}}', env), 'B');
  assert.equal(evaluate('{{#when::{{notequal::{{getvar::st_faction}}::A00}}}}x{{/when}}', env), 'x');
  assert.equal(evaluate('{{#when {{and::{{? {{length::{{trim::{{getvar::n}} }} }} > 0 }}::{{? {{getvar::n}} != null }}}} }}yes{{/when}}', env), 'yes');
  assert.equal(evaluate('{{#when {{and::{{? {{length::{{trim::{{getvar::empty}} }} }} > 0 }}::1}} }}yes{{/when}}', env), '');
  assert.equal(evaluate('{{#if 1}}a{{#if 0}}b{{/if}}c{{/if}}', env), 'ac');
  assert.equal(evaluate('{{? 조용한 아저씨 말투 != null }}', env), '1', '띄어쓰기 있는 값');
  assert.equal(evaluate('{{? 3 > 2 }}|{{? 1 + 2 * 3 }}|{{? null == null }}', env), '1|7|1');
  assert.equal(evaluate('{{user}}와 {{char}} {{random::a::b}}', env), '나와 괴이봇 {{random::a::b}}');
});

test('registry: aliases resolve to lore names and terms allow Korean particles', () => {
  const lore = [
    { comment: 'World catalog', content: JSON.stringify({ 괴이: [[true, '소라 랜드', '소라 랜드', 'Sora Land', ['놀이공원']]], '미스틱 사이트': [], 랜드마크: [[false, '관리국 본부', '관리국', '관리국', 'Bureau HQ', '02', '종로구', 1, 1, []]] }) },
    { comment: 'Agent roster', content: JSON.stringify({ version: 2, characters: [{ id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: ['부장'] }] }) },
  ];
  const r = buildRegistry(lore);
  assert.equal(resolveName(r, 'sora land')[0].lore, '소라 랜드');
  assert.equal(resolveName(r, '관리국')[0].lore, '관리국', '숨긴 항목도 이름 찾기에는 쓴다');
  assert.ok(termPresent('쟈알디에게 물었다', '쟈알디'));
  assert.ok(!termPresent('쟈알디스 공장', '쟈알디'));
  assert.ok(termPresent('Met Jyaldi.', 'jyaldi'));
  assert.deepEqual(referenceEntries(r, '부장과 소라 랜드에 갔다').map((e) => e.lore).sort(), ['소라 랜드', '쟈알디']);
});

test('registry: aliases that name a group or another entry are not used; given names need a form of address', () => {
  const lore = [
    { comment: 'World catalog', content: JSON.stringify({ 괴이: [[true, '유쾌 테마파크', '유쾌 테마파크', 'Yukoae', ['플라워 골든 리조트']], [true, '플라워 골든 리조트', '플라워 골든 리조트', 'Flower Golden', []]], '미스틱 사이트': [], 랜드마크: [] }) },
    { comment: 'Agent roster', content: JSON.stringify({ version: 2, characters: [
      { id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: ['관리국', '종합대응팀', 'Response Team'], affiliation: 'A00', department: '종합대응팀' },
      { id: 'P002', name: '스팡달', english: 'Spangdal', lore: '스팡달', aliases: ['관리국', 'Response Team'], affiliation: 'A00', department: '종합대응팀' },
      { id: 'P049', name: '신유리', english: 'Shin Yuri', lore: '신유리', aliases: ['유리'], affiliation: '중림 지하상가' },
    ] }) },
  ];
  const r = buildRegistry(lore);
  const names = (t) => referenceEntries(r, t).map((e) => e.name).sort();
  assert.deepEqual(names('관리국 사무실에 갔다'), [], '소속 이름은 요원 별칭이 아님');
  assert.deepEqual(names('Response Team arrived'), [], '여럿이 같이 쓰는 별칭');
  assert.deepEqual(names('플라워 골든 리조트로'), ['플라워 골든 리조트'], '다른 항목 이름은 별칭이 아님');
  assert.deepEqual(names('창문 유리가 깨졌다'), []);
  assert.deepEqual(names('유리 씨가 웃었다'), ['신유리']);
  assert.deepEqual(names('신유리가 웃었다'), ['신유리']);
});

test('refs: collects base, primary, active, direct and secondary rows with CBS evaluated', () => {
  const lore = [
    { comment: 'World catalog', content: JSON.stringify({ 괴이: [[true, '소라 랜드', '소라 랜드', 'Sora Land', []]], '미스틱 사이트': [], 랜드마크: [] }) },
    { comment: 'Agent roster', content: JSON.stringify({ version: 2, characters: [{ id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: [] }] }) },
    { comment: '소라 랜드', content: '폐장한 놀이공원. 쟈알디가 조사했다.' },
    { comment: '쟈알디', content: '관리국 부장.' },
    { comment: '📜Faction', content: '{{#if {{equal::{{getvar::st_faction}}::B00}}}}B 시점{{/if}}{{#if {{not_equal::{{getvar::st_faction}}::B00}}}}A 시점{{/if}}' },
    { comment: 'GNet', content: '@@SECTION X\nsecret\n@@END' },
  ];
  const src = { char: { name: '괴이봇', desc: '설명 {{char}}', globalLore: lore }, chat: { message: [], scriptstate: { $st_faction: 'A00' }, note: '노트' } };
  const rows = collectRefs(src, { scope: 'wiki', primaryNames: ['소라 랜드'], text: '소라 랜드', secondary: true });
  assert.deepEqual(rows.map((r) => [r.kind, r.sources[0]]), [['base', '봇 설명'], ['base', '작가 노트'], ['primary', '소라 랜드'], ['active', '📜Faction'], ['secondary', '쟈알디']]);
  assert.equal(rows[0].content, '설명 괴이봇');
  assert.equal(rows[3].content, 'A 시점');
  assert.match(refText(rows), /^\[공통: 봇 설명\]\n설명 괴이봇/);
  // 개수 제한은 관련·2차 참조만 센다 (원본 reference_count)
  assert.equal(limitRefs(rows, 1).length, 5);
  assert.equal(limitRefs(rows, 0).length, 4);
  assert.ok(!limitRefs(rows, 0).some((r) => r.kind === 'secondary'));
});

test('refs: recent turns group user and char messages, hide tags and scene cards', () => {
  const chat = { message: [
    { role: 'char', data: '첫 인사' },
    { role: 'user', data: '안녕' },
    { role: 'char', data: '본문\n[AN|서울특별시 종로구|x|활성|B|없음]' },
    { role: 'user', data: sceneRecord({ target: '소라 랜드', party: '나' }, 'LONG DIRECTIVE') },
    { role: 'char', data: '도착' },
  ] };
  const t = recentTurns(chat, 2);
  assert.equal(t.length, 2);
  assert.equal(storyText(t), '[user]\n안녕\n\n[char]\n본문\n\n[user]\n[이동] 목표: 소라 랜드 / 투입: 나\n\n[char]\n도착');
  assert.equal(stripModules('a [MODULE_CONTEXT_BEGIN]x[MODULE_CONTEXT_END] b'), 'a  b');
  assert.equal(factionCodesToNames('A00와 B00 P001', { A00: '관리국', B00: '가짜 관리국' }), '관리국와 가짜 관리국 P001');
});

const ARTICLE = `설명 앞말
<lightboard-namuwiki doc_title="잘못된 제목" doc_type="other" main_color="#27685b" asset_src="" related1="소라 랜드 사건" recent1="쟈알디">
[Infobox]Title:소라 랜드|위치:➡️서울 종로구➡️|상태:❗폐장❗
[Toc]
[Heading]Level:1|Title:개요
[Paragraph]소라 랜드는 ➡️소라 랜드➡️ 폐장한 놀이공원이다.📌1999년 기준.📌 ➡️쟈알디➡️가 조사했고 ➡️쟈알디➡️가 또 갔다. {{getvar::x}}
[Heading]Level:2|Title:소문
[List]관람차가 혼자 돈다
[List]✂️농담✂️
[Quote]돌아가|Source:경비원
[Table]Caption:비교|Color:#123456|Head:항목;;수치|Row:가;;1
</lightboard-namuwiki>
뒷말`;

test('wiki: accept forces the title, escapes templates, cleans links; render builds blocks', () => {
  const canon = (t) => (t === 'Jyaldi' ? '쟈알디' : t);
  const body = acceptArticle(ARTICLE, '소라 랜드', canon);
  assert.match(body, /^<lightboard-namuwiki doc_title="소라 랜드" doc_type="other"/);
  assert.ok(body.endsWith('</lightboard-namuwiki>'));
  assert.ok(body.includes('&#123;&#123;getvar::x&#125;&#125;'));
  assert.ok(body.includes('소라 랜드는 소라 랜드 폐장한'), '자기 자신 링크 제거');
  assert.equal((body.match(/➡️쟈알디➡️/g) ?? []).length, 1, '중복 링크 제거');
  assert.throws(() => acceptArticle('<lightboard-namuwiki doc_title="x">[Paragraph]a', 'x', canon), /끝까지 오지 않았어요/);
  assert.throws(() => acceptArticle('그냥 글', 'x', canon), /형식/);
  assert.throws(() => acceptArticle('<lightboard-namuwiki>[List]a</lightboard-namuwiki>', 'x', canon), /Paragraph/);
  const r = renderArticle(body, { saved: (t) => t === '쟈알디', canon });
  assert.equal(r.title, '소라 랜드');
  assert.deepEqual(r.related, ['소라 랜드 사건']);
  assert.deepEqual(r.recent, ['쟈알디']);
  assert.deepEqual(r.headings, ['개요', '소문']);
  assert.ok(r.html.includes('<table class="nw-infobox"') && r.html.includes('<b>폐장</b>'));
  assert.ok(r.html.includes('class="nw-link on" data-action="wiki-open" data-value="쟈알디"'));
  assert.ok(r.html.includes('<sup class="nw-fn" data-fn="1" role="button" tabindex="0">[1]</sup>') && r.html.includes('<ol class="nw-notes"><li data-fn="1">1999년 기준.</li></ol>'));
  assert.ok(r.html.includes('<s>농담</s>') && r.html.includes('<cite>— 경비원</cite>') && r.html.includes('--nw:#123456'));
  assert.ok(r.html.includes('{{getvar::x}}'), '본문의 템플릿은 글자로 보인다 (창에서는 해석되지 않음)');
  assert.ok(!/<script/i.test(renderArticle('<lightboard-namuwiki>[Paragraph]<script>x</script></lightboard-namuwiki>', { saved: () => false, canon }).html));
});

test('wiki: chat lore storage round trip, update in place and delete', () => {
  const meta = { title: '소라 랜드', mode: 'expand', model: 'main', created: 1, length: 'detailed', sources: [], primarySources: ['소라 랜드'], writingRequest: '', direct: false };
  const body = '<lightboard-namuwiki doc_title="소라 랜드">[Paragraph]a -- b</lightboard-namuwiki>';
  let chat = { message: [], localLore: [{ comment: '다른 메모', content: 'x' }] };
  chat = saveDoc(chat, meta, body);
  chat = saveDoc(chat, { ...meta, title: 'B' }, body);
  chat = saveDoc(chat, { ...meta, created: 2, writingRequest: '--주의--' }, body.replace('[Paragraph]a', '[Paragraph]c'));
  assert.equal(chat.localLore.length, 3);
  assert.equal(chat.localLore[1].comment, 'WIKI｜소라 랜드');
  assert.equal(chat.localLore[1].key, '');
  assert.equal(chat.localLore[1].alwaysActive, false);
  assert.ok(chat.localLore[1].content.startsWith('[NW_PRIVATE_BEGIN]\n<!--NW_META:'));
  { const c = chat.localLore[1].content; assert.ok(!c.slice(c.indexOf('NW_META:'), c.indexOf('-->')).includes('--'), 'meta 안에 -- 없음'); }
  const doc = findDoc(chat, '소라 랜드');
  assert.equal(doc.meta.created, 2);
  assert.equal(doc.meta.writingRequest, '--주의--');
  assert.ok(doc.body.includes('[Paragraph]c'));
  assert.deepEqual(listDocs(chat).map((d) => d.title), ['소라 랜드', 'B']);
  assert.deepEqual(listDocs(deleteDoc(chat, 'B')).map((d) => d.title), ['소라 랜드']);
  assert.equal(validTitle('a<b'), false);
  assert.equal(validTitle('WIKI｜x'), false);
  // 카드 기본 문서: 채팅 문서 뒤에, 같은 제목은 채팅 문서가 이긴다. 채팅 문서를 지우면 기본 문서가 다시 보인다
  const card = [{ comment: 'WIKI｜B', content: body.replace('[Paragraph]a', '[Paragraph]base') }, { comment: 'WIKI｜C', content: body }, { comment: 'Faction', content: 'x' }];
  assert.deepEqual(listDocs(chat, card).map((d) => [d.title, !!d.base]), [['소라 랜드', false], ['B', false], ['C', true]]);
  const back = findDoc(deleteDoc(chat, 'B'), 'B', card);
  assert.ok(back.base && back.body.includes('[Paragraph]base'));
  assert.equal(findDoc(chat, 'C', card).meta, null);
});

test('packed card wiki docs: unpacked once, loose entries win, chat docs win', async () => {
  const doc = (t, p) => `<lightboard-namuwiki doc_title="${t}" doc_type="other">\n[Paragraph]${p}\n</lightboard-namuwiki>`;
  const packed = WIKI_PACK_HEAD + gzipSync(Buffer.from(JSON.stringify({ 가: doc('가', 'pack'), 나: doc('나', 'pack') }))).toString('base64');
  const lore = [{ comment: '📖위키 기본 문서', content: packed }, { comment: 'WIKI｜나', content: doc('나', 'loose') }];
  assert.deepEqual(baseDocs([...lore]).map((d) => d.title), ['나']); // 풀기 전에는 낱개 문서만
  await prepareBaseDocs(lore);
  const docs = baseDocs(lore);
  assert.deepEqual(docs.map((d) => [d.title, d.base, d.body.includes('loose')]), [['나', true, true], ['가', true, false]]);
  const chat = { message: [], localLore: [{ comment: 'WIKI｜가', content: doc('가', 'mine') }] };
  assert.ok(findDoc(chat, '가', lore).body.includes('mine'));
  assert.ok(findDoc({ message: [] }, '가', lore).body.includes('pack'));
});

test('wiki prompt from the real card: sections, references, faction names', { skip: !realLore }, () => {
  const sec = policySections(realLore, 'Wiki');
  for (const k of ['NW.GUIDE', 'NW.FORMAT', 'NW.LINKS_OPEN', 'MAIN_CONTEXT', 'NW.HISTORY', 'NW.PREVIOUS']) assert.ok(sec[k], k);
  const src = { char: { name: '괴이봇', desc: '봇 설명', globalLore: realLore }, chat: { message: [{ role: 'user', data: '쟈알디와 소라 랜드에 간다' }, { role: 'char', data: '도착했다.' }], scriptstate: { $st_faction: 'A00' } } };
  const reg = buildRegistry(realLore);
  const c = canonicalTitle(reg, src, 'Sora Land');
  assert.deepEqual(c, { title: '소라 랜드', known: true });
  assert.equal(canonicalTitle(reg, src, '소라 랜드 (장소)').title, '소라 랜드');
  assert.equal(canonicalTitle(reg, src, '없는 주제').known, false);
  const p = wikiPrompt(src, { title: '소라 랜드', inherited: [], previous: null, writingRequest: '무섭게', direct: false }, WIKI_DEFAULTS, { A00: '관리국' });
  assert.equal(p.messages.length, 2);
  assert.ok(p.messages[0].content.startsWith(sec['NW.GUIDE'].slice(0, 40)));
  assert.ok(p.messages[0].content.includes('8,000') || p.messages[0].content.includes('8000'), '상세 분량');
  const u = p.messages[1].content;
  assert.ok(u.startsWith('문서 제목: 소라 랜드\n\n[참고 자료]\n[공통: 봇 설명]'));
  assert.ok(u.includes('[주제 원본: 소라 랜드]'), u.slice(0, 500));
  assert.ok(u.includes('[활성 로어북: 📜Faction]') && u.includes('[관련 로어북: 쟈알디]'));
  assert.ok(u.includes('[최근 챗로그]\n[user]\n쟈알디와 소라 랜드에 간다') && u.endsWith('[사용자 작성 지침 — 모든 문서 공통]\n무섭게'));
  assert.ok(!u.includes('{{getvar'), 'CBS 해석됨');
  assert.ok(!/\[A00\]/.test(u), '소속 코드는 이름으로');
  assert.ok(p.primarySources.includes('소라 랜드'));
});

test('renderArticle: fold면 정답 문단(탈출·금기 등)만 접고 각주도 가린다', () => {
  const body = '<lightboard-namuwiki doc_title="t">\n[Heading]Level:1|Title:개요\n[Paragraph]겉 이야기\n[Heading]Level:1|Title:출구\n[Paragraph]정답📌비밀 각주📌\n[Heading]Level:2|Title:세부\n[List]목록\n[Heading]Level:1|Title:여담\n[Paragraph]끝';
  const o = { saved: () => false, canon: (t) => t };
  const open = renderArticle(body, o).html;
  assert.ok(!open.includes('nw-spoil'));
  const html = renderArticle(body, { ...o, fold: true }).html;
  assert.equal((html.match(/<details class="nw-spoil">/g) || []).length, 1);
  const inside = html.slice(html.indexOf('<details class="nw-spoil">'), html.indexOf('</details>'));
  assert.ok(inside.includes('정답') && inside.includes('세부') && inside.includes('목록') && !inside.includes('끝'));
  assert.ok(html.includes('겉 이야기') && html.indexOf('겉 이야기') < html.indexOf('<details'));
  assert.ok(html.includes('<details class="nw-spoil fn">'));
});

test('dropDefaultAliases: 목록에 든 기본 별칭만 지우고 사용자 별칭은 남긴다', async () => {
  const core = await import('../dist-test/core.mjs');
  const books = realLore ? core.migrateLore(realLore) : null;
  if (!books) return;
  const dir = core.readDirectory(books);
  const a = dir.agents.find((x) => x.aliases.length);
  const drop = { 괴이: {}, '미스틱 사이트': {}, 요원: { [a.lore]: [a.aliases[0]] } };
  const out = core.dropDefaultAliases(books, drop);
  const b = core.readDirectory(out).agents.find((x) => x.lore === a.lore);
  assert.deepEqual(b.aliases, a.aliases.slice(1));
  assert.equal(core.dropDefaultAliases(out, drop), out, '두 번째는 바꿀 게 없다');
});
