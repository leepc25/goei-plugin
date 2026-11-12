// tests/guide-out.test.mjs 가 쓰는 묶음·호출 목록 (2026-11-13: 코드에 박혀 있던 지침을 지침 절로 옮긴 것의 검증).
// build(root) = 그 소스 나무의 관련 모듈을 한 묶음으로 (지침 상태를 함께 쓰게). calls(M) = 옮긴 글이 들어가는 요청문들을 정해진 입력으로 만든 것.
// 옛 나무(옮기기 전)에도 같은 calls 를 돌려 tests/fixtures/guide-out-old.json 의 calls 를 만들었다 (옛 코드에 없던 함수는 건너뜀).
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENTRY = `
export * as G from './src/core/guides';
export * as craft from './src/core/craft';
export * as advanced from './src/core/advanced';
export * as attach from './src/core/attach';
export * as gp from './src/core/gnetPrompt';
export * as gnet from './src/core/gnet';
export * as boards from './src/core/boards';
export * as phone from './src/core/phone';
export * as pp from './src/core/phonePrompt';
export * as shop from './src/core/shop';
export * as malls from './src/core/malls';
export * as director from './src/core/people/director';
export * as speech from './src/core/people/speech';
export * as sexual from './src/core/people/sexual';
export * as updater from './src/core/people/updater';
export * as consolidate from './src/core/people/consolidate';
export * as inject from './src/core/people/inject';
export * as ptypes from './src/core/people/types';
export * as psettings from './src/core/people/settings';
export * as statusctx from './src/core/statusctx';
export * as statuscols from './src/core/world/statuscols';
export * as wfaction from './src/core/world/faction';
export * as wdir from './src/core/world/directory';
export * as items from './src/core/items';
export * as lore from './src/core/lore';
export * as asset from './src/core/asset';
export * as joint from './src/host/joint';
export * as llm from './src/host/llm';
`;

export async function buildBundle(root) {
  const dir = await mkdtemp(join(tmpdir(), 'goei-guide-out-'));
  const outfile = join(dir, 'bundle.mjs');
  await build({ stdin: { contents: ENTRY, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
  return import(pathToFileURL(outfile));
}

const C = (k) => `$lb_cfg_lb-gn.${k}`;
const seedless = (s) => s.replace(/<x-output-seed-([ab])>[^<]*<\/x-output-seed-\1>/g, '<x-output-seed-$1>*</x-output-seed-$1>');
const hex = (s) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** 이름 → 글. 옛 코드에 없는 함수는 건너뛴다 (그 이름은 옛 기록에 없다) */
export function calls(M) {
  const out = {};
  const put = (name, fn) => {
    let v;
    try { v = fn(); } catch (e) { if (e instanceof Skip) return; throw new Error(`${name}: ${e?.stack ?? e}`); }
    out[name] = typeof v === 'string' ? v : JSON.stringify(v);
  };
  class Skip extends Error {}
  const need = (f) => { if (typeof f !== 'function') throw new Skip(); return f; };

  // ── 요청 공통 ──
  const jt = (...keys) => keys.map((key) => ({ key, messages: [{ role: 'user', content: `${key} 지시` }] }));
  put('joint.envelope.boards', () => M.joint.combinedPrompts(jt('gnet', 'gal', 'phone'))[0].content);
  put('joint.envelope.one', () => M.joint.combinedPrompts(jt('gnet', 'phone'))[0].content);
  put('joint.retry', () => need(M.joint.jointRetryText)(['gnet', 'phone']));
  put('llm.defaultFix', () => need(M.llm.defaultFix)([{ role: 'user', content: 'U' }])('RAW', 'bad json'));
  put('llm.reiterate', () => need(M.llm.reiterationText)(1, 2));
  const base = [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'U' }];
  put('craft.note', () => M.craft.craftMessages(base, { thoughts: 'note', memo: false, reiterate: 0 }, { thoughts: '1. step' }));
  put('craft.inner', () => M.craft.craftMessages(base, { thoughts: 'inner', memo: false, reiterate: 0 }, { thoughts: '1. step' }));
  const img = (i) => `%%ATTACHMENT:${hex(JSON.stringify({ kind: 'image', content: `사진 ${i}`, asset: `assets/a${i}.png` }))}%%`;
  put('attach.data', () => M.attach.prepareAttachments([{ role: 'user', content: `보냄 [[ATTACH:photo]]골목 사진[[/ATTACH]] ${Array.from({ length: 10 }, (_, i) => img(i)).join(' ')}` }]));
  put('attach.missing', () => need(M.attach.imageMissingLine)('1, 3'));
  for (const k of ['ko', 'en', 'ja']) put(`advanced.language.${k}`, () => String(M.advanced.genSettings({ $gen_lang: k }).language));

  // ── 게시판 ──
  const gsrc = (vars = {}) => ({ char: { name: '괴이', desc: '', globalLore: [] }, chat: { message: [{ role: 'user', data: '가' }, { role: 'char', data: '나' }], scriptstate: vars, localLore: [] } });
  const post = { id: 100001, nick: '글쓴이', title: '복도 불빛', body: '3층 복도 불이 깜빡인다', date: '2025.01.01 10:00', views: 3, votes: 1, mine: false, comments: [{ nick: '댓글러', body: '저도 봤어요', parent: 0, mine: false, date: '2025.01.01 10:05' }] };
  const gst = () => ({ posts: [structuredClone(post)], dms: [{ nick: '글쓴이', side: 'me', body: '복도 불빛 글 봤어요', date: '2025.01.01 11:00' }], sources: { 글쓴이: { postid: 100001, title: '복도 불빛', author: '글쓴이', body: '3층 복도 불이 깜빡인다', quote: '', quoteAuthor: '' } }, seq: 100002 });
  const plan = (s, st) => M.gnet.incomingPlan(s.chat, st, M.gnet.gnetSettings(s.chat.scriptstate), 'ㅇㅇ', () => 0.99);
  for (const site of ['gn', 'gal', 'wpf', 'sm']) {
    const vars = { ...M.boards.boardState({}, site), [C('sampling')]: '1' };
    put(`gnet.refresh.${site}`, () => { const s = gsrc(vars); const st = gst(); return seedless(JSON.stringify(M.gp.refreshPrompt(s, st, plan(s, st), 'ㅇㅇ', {}).messages)); });
  }
  put('gnet.post', () => { const s = gsrc(); const st = gst(); return M.gp.postPrompt(s, st, '새 글 생각', plan(s, st), {}).messages; });
  put('gnet.comment', () => { const s = gsrc(); const st = gst(); return M.gp.commentPrompt(s, st, 100001, 0, '무섭네요', plan(s, st), 'ㅇㅇ', {}).messages; });
  put('gnet.refreshOne', () => { const s = gsrc(); const st = gst(); return M.gp.commentPrompt(s, st, 100001, 0, '', plan(s, st), 'ㅇㅇ', {}, M.gp.POST_REFRESH_ACTION, 'refresh').messages; });
  put('gnet.dm', () => { const s = gsrc(); return M.gp.dmPrompt(s, gst(), '글쓴이', '복도 불빛 글 봤어요', 'ㅇㅇ', {}).messages; });
  put('gnet.dmRetry', () => { const s = gsrc(); const p = M.gp.dmPrompt(s, gst(), '글쓴이', '복도 불빛 글 봤어요', 'ㅇㅇ', {}); return M.gp.retryMessages(p, 'RAW', 'no body').slice(-2); });
  put('gnet.commentTime', () => `${M.gp.commentTimeRule('2025.01.01 12:30')}\n${M.gp.commentTimeRule('')}`);

  // ── 괴담톡 ──
  put('phone.refreshRetry', () => {
    const rule = M.G.guideSec ? M.G.guideSec('Phone', 'RETRY.REFRESH') ?? undefined : undefined;
    return M.pp.refreshRetry({ messages: base, contactMode: false, retryRule: rule }, 'bad patch');
  });
  put('phone.view', () => M.pp.viewPrompt(gsrc(), {}, []).messages[0].content);

  // ── 상점·쇼핑몰 ──
  const shopSt = (extra = {}) => ({ ...M.shop.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, ''), loaded: true, ...extra });
  const ssrc = (st, extra = {}) => ({ st, refs: '', story: '', status: '', situation: '', identity: '', language: null, ...extra });
  for (const mode of ['all', 'mix', 'none']) put(`shop.shelf.cos.${mode}`, () => M.shop.shelfPrompt(ssrc(shopSt(), { truthMode: mode }), M.shop.shopSettings({}), 'Cos'));
  put('shop.talk.cos.secret', () => {
    const st = shopSt();
    st.items = [{ id: 's1', name: '빛의 돌', price: 1200000, desc: '둥근 돌', effect: '어둠을 밝힌다', truth: '쥐면 주변 전등이 꺼진다' }];
    st.talk = [{ who: 'me', text: '이거 뭐예요' }];
    return M.shop.talkPrompt(ssrc(st), M.shop.shopSettings({}), 'Cos');
  });
  put('shop.rule.any', () => M.shop.shopRule({}));
  put('shop.rule.shop', () => M.shop.shopRule({ [M.shop.SHOP_WHERE_VAR]: 'shop' }));
  put('shop.guide.any', () => M.shop.shopGuide({}));
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  put('malls.assign.cos', () => M.malls.cosAssignment(5, true, M.malls.cosRoll({ $cos_roll_useful: '2' }), seq(0.1, 0.5, 0.9, 0.3, 0.7)));
  put('malls.assign.bm', () => M.malls.cosAssignment(3, false, M.malls.mallRoll({}, 'bm'), () => 0.1, 'bm'));

  // ── Director ──
  const T = M.ptypes;
  const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
  const chat = { message: [['user', '출근했다', 'u1'], ['char', '쟈알디가 말했다. "명일 아파트 건은 네가 맡아."', 'c1']].map(([role, data, chatId]) => ({ role, data, chatId })) };
  const allOn = { $pp_director: 'scene', $pp_perception: '1', $pp_perception_ext: '1', $pp_suspicion: '1', $pp_openness: '1', $pp_rhythm: '1', $pp_axes: '1', $pp_register: '1', $pp_affinity: '1', $pp_register_variety: 'two', $pp_sexual_desire: '1', $pp_paraphilia: '1', $pp_director_search: '1', $pp_director_features: '1' };
  const dstore = () => { const s = T.emptyStore(); s.people.쟈알디 = person('쟈알디'); return s; };
  const dbuild = () => M.director.buildDirector(chat, dstore(), ['쟈알디'], '서류를 받았다', M.psettings.peopleSettings(allOn), { 쟈알디: '규칙' });
  put('director.system', () => dbuild().system);
  put('director.repair', () => M.director.repairDirector(dbuild(), '{bad', 'notes missing').system);
  put('director.pass2', () => M.director.buildDirectorPass2(dbuild(), []).system);
  put('director.block', () => M.director.directorBlock([{ who: '쟈알디', now: '서류를 건넸다', react: '', mustNot: [], uncertain: [] }], '김솔음'));
  const sp = (variety, limit) => ({ features: new Set(['register']), registerVariety: variety, registerChange: 'ask', registerSignLimit: limit });
  put('speech.writer.one', () => M.speech.speechVarietyBlock(sp('one', 3), 'writer'));
  put('speech.writer.sign', () => M.speech.speechVarietyBlock(sp('two', 3), 'writer'));
  put('speech.writer.free', () => M.speech.speechVarietyBlock(sp('two', 1), 'writer'));
  put('speech.director', () => M.speech.speechVarietyBlock(sp('one', 3), 'director'));

  // ── 갱신기 덧붙임 ──
  const sx = (desire, paraphilia, explicit) => ({ features: new Set(['axes']), sexualDesire: desire, paraphilia, explicitStyle: explicit });
  put('sexual.writer.both', () => M.sexual.sexualWriterSection(sx(true, true, true)));
  put('sexual.writer.desire', () => M.sexual.sexualWriterSection(sx(true, false, false)));
  put('sexual.writer.paraphilia', () => M.sexual.sexualWriterSection(sx(false, true, false)));
  put('sexual.rules', () => `${M.sexual.sexualPromptRules(true)}\n${M.sexual.sexualPromptRules(false)}`);
  put('updater.assemble.en', () => M.updater.assemblePrompt('BASE\n<<USER_RULES>>', new Set(), '내 규칙', 'en'));
  put('updater.signal', () => need(M.updater.signalStateNote)());
  put('updater.tracking', () => need(M.updater.trackingRule)());
  put('updater.shopKey', () => need(M.updater.shopKeyLine)());
  put('consolidate.ko', () => M.consolidate.CONSOLIDATE_PROMPT('ko'));
  put('consolidate.en', () => M.consolidate.CONSOLIDATE_PROMPT('en'));
  put('consolidate.user', () => need(M.consolidate.consolidateUserText)('{"name":"쟈알디"}'));

  // ── 본편에 붙는 글 ──
  const ALL = ['date', 'time', 'weather', 'temp', 'place', 'target', 'companions', 'deployed', 'identity', 'wallet', 'points'];
  put('status.block', () => M.statusctx.statusBlock('[▣|2025.01.01|02:47 AM]', ['date', 'time']));
  put('status.first', () => M.statusctx.withStatusBlock([{ role: 'user', content: '시작' }], '', { cols: ['date', 'time', 'wallet'], wallet: 1140000 }));
  put('status.section', () => M.statuscols.statusSection(ALL));
  const alive = new Set(['a1']);
  put('items.block', () => {
    let it = M.items.addItem({ list: [], log: [] }, alive, { name: '빛의 돌', effect: '어둠을 밝힌다', truth: '쥐면 주변 전등이 전부 꺼진다', use: true, from: 'store', anchor: 'a1' });
    it = M.items.addItem(it, alive, { name: '돌', effect: '???', truth: '?', use: true, from: 'store', anchor: 'a1' });
    it = M.items.addItem(it, alive, { name: '조약돌', truth: '?', use: true, from: 'store', anchor: 'a1' });
    return M.items.itemsBlock(M.items.liveItems(it, alive), { slots: 8, limit: '8 items', use: [{ name: '빛의 돌', n: 1 }, { name: '돌', n: 1 }, { name: '조약돌', n: 1 }] });
  });
  put('items.text', () => {
    const it = M.items.addItem({ list: [], log: [] }, alive, { name: '손전등', use: true, from: 'store', anchor: 'a1' });
    const c = { message: [{ role: 'user', data: '가', chatId: 'u1' }, { role: 'char', data: '나', chatId: 'a1' }], scriptstate: {} };
    return M.items.inventoryText({ ...c, scriptstate: { ...M.items.itemsVars(it) } });
  });
  put('items.resumed', () => need(M.items.resumedEvent)());
  put('lore.locked', () => M.lore.unlockHint({ name: '명일 아파트 · 진상', appendix: { parent: '명일 아파트', when: { unlock: '주인공이 304호 문을 연다' } } }));
  put('people.block', () => M.inject.peopleBlock(['## 쟈알디 (living record · updated in this chat)\nIdentity:\n- 요원']));
  put('people.sexualLine', () => {
    const p = person('쟈알디');
    const store = dstore();
    const live = { has: () => true };
    try {
      return M.inject.personBlock(p, store, live, [], { mode: 'record', unknown: [], sexual: { desire: '직설적이다', paraphilia: '' } });
    } catch { throw new Skip(); }
  });
  const DIR = { comment: 'Directory', key: '', mode: 'normal', content: JSON.stringify({
    schema: 1, 괴이: {}, '미스틱 사이트': {},
    요원: { 쟈알디: { affiliation: 'A00', english: 'Jyaldi', department: '종합대응팀' } },
    조직: { 관리국: { code: 'A00', english: 'Management Bureau' }, 백일몽: { code: 'C00', english: 'Baekilmong' } },
    호칭: { none: { A00: '관리국', C00: '백일몽' } },
  }) };
  put('faction.assemble', () => M.wfaction.assembleFaction(M.wdir.readDirectory([DIR]), new Map(), { pairs: { '관리국>백일몽': { stage: 'hostile' } }, common: '' }));
  put('roster.assemble', () => M.wfaction.assembleRoster(M.wdir.readDirectory([DIR]), new Map(), new Map()));

  // ── 이미지 태그 넣기 ──
  const idata = (allowUser) => ({ characters: ['Lee Ha-neul', 'Eileen'], keywords: ['default', 'smile', 'serious'], keywordSet: new Set(['default', 'smile', 'serious']), aliases: new Map([['이하늘', 'Lee Ha-neul'], ['하늘', 'Lee Ha-neul'], ['에일린', 'Eileen']]), allowUser });
  put('asset.prompt', () => M.asset.assetPrompt(['Lee Ha-neul', 'Eileen'], ['이하늘이 웃었다.', '에일린은 {names} 라고 적힌 쪽지를 보았다.'], idata(false), 2)[0].content);
  put('asset.prompt.user', () => M.asset.assetPrompt(['Eileen'], ['에일린이 들어왔다.'], { ...idata(true), aliases: new Map() }, 1)[0].content);
  return out;
}

/** 지침에서 절을 빼낸 글 (옛 글로 고쳐 저장해 둔 지침 흉내) */
export function withoutSections(text, names) {
  let s = text;
  for (const n of names) s = s.replace(new RegExp(`\\n*@@SECTION ${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?\\n@@END`), '');
  return s;
}
/** 절 본문을 바꾼 글 */
export function withSection(text, name, edit) {
  const re = new RegExp(`(@@SECTION ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n)([\\s\\S]*?)(\\n@@END)`);
  if (!re.test(text)) throw new Error(`절 없음: ${name}`);
  return text.replace(re, (_m, a, b, c) => a + edit(b) + c);
}
/** 옮긴 절이 들어 있는 지침들 (gnet.txt → 게시판 넷, shop.txt → 상점·쇼핑몰 둘) */
export const GUIDES_OF = { Common: ['Common'], GNet: ['GNet', 'Gal', 'Wpf', 'Salmon'], Phone: ['Phone'], Shop: ['Shop', 'Cos', 'Bm'], Director: ['Director'], UpdaterExtra: ['UpdaterExtra'], Main: ['Main'], Asset: ['Asset'] };
