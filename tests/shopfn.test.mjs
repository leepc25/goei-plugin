// 상점 셋의 가게 표·기능 표·양 표 (2026-11-12): 기본값은 예전 요청문 그대로(참조 로어북 수만 실제로 줄임), 가게마다 따로, 둘 다 켠 것만,
// 요청 종류마다 제 줄, 작가 노트·페르소나, 망상홈쇼핑은 그대로, 게시판·위키의 개수 제한은 그대로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({
  stdin: {
    contents: `
      export { shopSource } from './src/ui/shop';
      export { previewMallShelf, deskSource } from './src/ui/malls';
      export { previewHomeshop } from './src/ui/homeshop';
      export * from './src/core/shopfn';
      export { collectRefs, limitRefs, refText } from './src/core/refs';
      export { mallVars, mallSettings, readMall } from './src/core/malls';
      export { hsVars, hsSettings } from './src/core/homeshop';
      export { shelfPrompt, talkPrompt, shopSettings, emptyShop } from './src/core/shop';
      export { fnRefToggles } from './src/core/reffn';
      export { initWorldData } from './src/core/world/catalog';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text' }, logLevel: 'silent',
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

// 가게 이름·주인 이름에 걸리는 둘(우주 쇼핑몰·운영자) + 최근 챗로그에 걸리는 일곱 = 관련 로어북 아홉. 「갑 창고」 글 안의 「을 다리」는 2차 참조가 아니라 이미 관련
const STORY = ['갑 창고', '을 다리', '병 극장', '정 병원', '무 학교', '기 공장', '경 터널'];
const lore = [
  { comment: 'World catalog', content: JSON.stringify({ 괴이: [[true, '우주 쇼핑몰', '우주 쇼핑몰', 'Cosmic Mall', []], ...STORY.map((n, i) => [true, n, n, `Story ${i}`, []]), [true, '신 저수지', '신 저수지', 'Hop', []]], '미스틱 사이트': [], 랜드마크: [] }) },
  { comment: 'Agent roster', content: JSON.stringify({ version: 2, characters: [{ id: 'P001', name: '운영자', english: 'Operator', lore: '운영자', aliases: [] }, { id: 'P002', name: '철물 주인', english: 'Owner', lore: '철물 주인', aliases: [] }] }) },
  { comment: '우주 쇼핑몰', content: '무엇이든 파는 사이트.' },
  { comment: '운영자', content: '사이트의 운영자.' },
  { comment: '철물 주인', content: '철물점 주인.' },
  ...STORY.map((n, i) => ({ comment: n, content: `${n} 이야기 ${i}.${i === 0 ? ' 신 저수지와 이어진다.' : ''}` })),
  { comment: '신 저수지', content: '2차로만 걸리는 곳.' },
  { comment: '📜Faction', content: '세력 글.' },
  { comment: '🙂Roster', content: '명부 글.' },
];
const chatOf = (vars = {}) => ({
  message: [{ role: 'user', data: '둘러본다', chatId: 'u1' }, { role: 'char', data: `${STORY.join(', ')}에 다녀왔다.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]`, chatId: 'c1' }],
  scriptstate: { $cos_roll_on: '0', $bm_roll_on: '0', $an_report: '진행 중 괴이 글', ...vars },
  note: '작가 노트 글',
});
const ctxOf = (vars = {}) => ({ charIndex: 0, chatIndex: 0, char: { name: '괴이봇', desc: '봇 설명 글', globalLore: lore }, chat: chatOf(vars) });
const mallCtx = (ctx, site) => ({ ...ctx, chat: { ...ctx.chat, scriptstate: M.mallVars(ctx.chat.scriptstate, site) } });
const cosSt = (vars) => ({ ...M.readMall(vars, 'cos'), loaded: true, talk: [{ who: 'me', text: '이거 얼마예요' }] });
const shopSt = () => ({ ...M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'c1'), loaded: true, talk: [{ who: 'me', text: '깎아 주세요' }] });
const heads = (refs) => [...refs.matchAll(/^\[([^:\]\n]+): ([^\]\n]+)\]$/gm)].map((m) => `${m[1]}:${m[2]}`);
const related = (refs) => heads(refs).filter((h) => h.startsWith('관련 로어북:')).map((h) => h.slice(7));
/** 요청문 (기본 상점) */
const shopReq = (vars, fn, st = shopSt()) => {
  const ctx = ctxOf(vars);
  const s = M.shopSettings(ctx.chat.scriptstate);
  const src = M.shopSource(ctx, st, s, M.shopGive(ctx.chat.scriptstate, 'shop', fn));
  return { src, msgs: fn === 'shelf' ? M.shelfPrompt(src, s) : M.talkPrompt(src, s) };
};
/** 예전 요청문 (표가 생기기 전: give 를 안 넘긴 길 = 고정 값) */
const shopOld = (vars, fn, st = shopSt()) => {
  const ctx = ctxOf(vars);
  const s = M.shopSettings(ctx.chat.scriptstate);
  const src = M.shopSource(ctx, st, s);
  return { src, msgs: fn === 'shelf' ? M.shelfPrompt(src, s) : M.talkPrompt(src, s) };
};
const mallReq = (vars, site, fn, old = false) => {
  const ctx = ctxOf(vars);
  const s = M.mallSettings(ctx.chat.scriptstate, site);
  const st = site === 'cos' ? cosSt(ctx.chat.scriptstate) : { ...M.readMall(ctx.chat.scriptstate, 'bm'), loaded: true, talk: [{ who: 'me', text: '문의' }] };
  const src = M.shopSource(mallCtx(ctx, site), st, s, old ? undefined : M.shopGive(ctx.chat.scriptstate, site, fn));
  return { src, msgs: fn === 'shelf' ? M.shelfPrompt(src, s, site === 'cos' ? 'Cos' : 'Bm') : M.talkPrompt(src, s, site === 'cos' ? 'Cos' : 'Bm') };
};

test('자료: 관련 로어북이 아홉 (가게·주인 이름 둘 + 챗로그 일곱)', () => {
  const { src } = shopOld({}, 'shelf');
  assert.equal(related(src.refs).length, 9);
  assert.deepEqual(heads(src.refs).filter((h) => !h.startsWith('관련')), ['공통:봇 설명', '활성 로어북:📜Faction', '활성 로어북:🙂Roster']);
});

test('기본값: 참조 로어북 수가 넉넉하면 진열·문의 요청문이 예전과 글자 하나 다르지 않다 (기본 상점·우주 쇼핑몰·포인트몰)', () => {
  const v = { $sh_refs: '12' };
  for (const fn of ['shelf', 'talk']) {
    assert.deepEqual(shopReq(v, fn).msgs, shopOld(v, fn).msgs, `기본 상점 ${fn}`);
    assert.deepEqual(shopReq(v, fn, { ...shopSt(), loaded: false, talk: [] }).msgs, shopOld(v, fn, { ...shopSt(), loaded: false, talk: [] }).msgs, `기본 상점 첫 호출 ${fn}`);
    for (const site of ['cos', 'bm']) assert.deepEqual(mallReq(v, site, fn).msgs, mallReq(v, site, fn, true).msgs, `${site} ${fn}`);
  }
  // 맥락 반영을 끈 채팅도 그대로 (쇼핑몰은 따로 정한 적이 없으면 기본 상점 값)
  const off = { $sh_refs: '12', $sh_ctx: '0' };
  for (const fn of ['shelf', 'talk']) {
    assert.deepEqual(shopReq(off, fn).msgs, shopOld(off, fn).msgs);
    for (const site of ['cos', 'bm']) assert.deepEqual(mallReq(off, site, fn).msgs, mallReq(off, site, fn, true).msgs);
  }
  assert.ok(!JSON.stringify(shopReq(off, 'shelf').msgs).includes('[최근 본문]'));
  assert.ok(JSON.stringify(shopReq(v, 'shelf').msgs).includes('[최근 본문]'));
});

test('기본값: 1:1 상담 자료는 예전과 같고 맥락(챗로그·상태창·괴이)은 넘어가지 않는다', () => {
  const ctx = ctxOf({ $sh_refs: '12' });
  const d = M.deskSource(ctx);
  const s = M.mallSettings(ctx.chat.scriptstate, 'bm');
  const old = M.shopSource(mallCtx(ctx, 'bm'), { ...M.readMall(ctx.chat.scriptstate, 'bm'), shop: '백일몽', owner: '' }, s);
  assert.equal(d.refs, old.refs);
  assert.equal(d.language, old.language);
  assert.deepEqual(Object.keys(d).sort(), ['language', 'nick', 'points', 'refs', 'shelf']);
  assert.equal(M.shopGive(ctx.chat.scriptstate, 'bm', 'desk').context, false);
  assert.equal(M.shopFnNone('desk', 'ctx'), true);
  assert.equal(M.shopFnOn({ $sh_fn_desk_ctx: '1' }, 'desk', 'ctx'), false, '없는 칸은 변수가 있어도 꺼짐');
});

test('참조 로어북: 수만큼만 넘긴다. 가게·주인 이름에 걸린 것이 먼저 남고, 그다음 챗로그 것이 원래 차례대로', () => {
  const all = related(shopOld({}, 'shelf').src.refs);
  const named = ['우주 쇼핑몰', '운영자'];
  const story = all.filter((n) => !named.includes(n));
  assert.equal(story.length, 7);
  // 기본 6: 예전에는 아홉이 다 갔다
  const six = related(shopReq({}, 'shelf').src.refs);
  assert.equal(six.length, 6);
  assert.ok(named.every((n) => six.includes(n)));
  assert.deepEqual(six.filter((n) => !named.includes(n)), story.slice(0, 4));
  assert.deepEqual(six, all.filter((n) => six.includes(n)), '남은 것의 차례는 그대로');
  // 2: 이름에 걸린 둘만 / 1: 그중 앞의 것 / 0: 관련 없음
  assert.deepEqual(related(shopReq({ $sh_fn_shelf_refs: '2' }, 'shelf').src.refs).sort(), [...named].sort());
  assert.equal(related(shopReq({ $sh_fn_shelf_refs: '1' }, 'shelf').src.refs).length, 1);
  const zero = shopReq({ $sh_fn_shelf_refs: '0' }, 'shelf').src.refs;
  assert.deepEqual(heads(zero), ['공통:봇 설명', '활성 로어북:📜Faction', '활성 로어북:🙂Roster'], '0이면 관련 로어북만 빠진다');
  // 쇼핑몰·1:1 상담도
  assert.equal(related(mallReq({}, 'cos', 'shelf').src.refs).length, 6);
  assert.equal(related(M.deskSource(ctxOf({})).refs).length, 6);
  assert.equal(related(M.deskSource(ctxOf({ $sh_fn_desk_refs: '0' })).refs).length, 0);
});

test('참조 로어북: 2차 참조를 관련 로어북보다 먼저 뺀다', () => {
  const on = { $sh_give_secondary: '1', $sh_fn_shelf_secondary: '1' };
  const full = heads(shopReq({ ...on, $sh_fn_shelf_refs: '12' }, 'shelf').src.refs);
  assert.ok(full.includes('2차 참조:신 저수지'));
  assert.equal(full.filter((h) => h.startsWith('관련')).length, 9);
  const nine = heads(shopReq({ ...on, $sh_fn_shelf_refs: '9' }, 'shelf').src.refs);
  assert.ok(!nine.some((h) => h.startsWith('2차 참조')));
  assert.equal(nine.filter((h) => h.startsWith('관련')).length, 9);
});

test('양 표: 기능마다 제 값, 정하지 않으면 $sh_turns·$sh_refs, 범위 밖 값은 버린다', () => {
  const v = { $sh_turns: '5', $sh_refs: '9', $sh_fn_talk_turns: '2', $sh_fn_desk_refs: '0', $sh_fn_shelf_refs: '99', $sh_fn_shelf_turns: '0' };
  assert.equal(M.shopFnNum(v, 'shelf', 'turns'), 5);
  assert.equal(M.shopFnNum(v, 'shelf', 'refs'), 9);
  assert.equal(M.shopFnNum(v, 'talk', 'turns'), 2);
  assert.equal(M.shopFnNum(v, 'talk', 'refs'), 9);
  assert.equal(M.shopFnNum(v, 'desk', 'refs'), 0);
  assert.equal(M.shopFnNum({}, 'desk', 'turns'), 3);
  assert.equal(M.shopFnNum({}, 'desk', 'refs'), 6);
  // 챗로그 턴 수가 요청문에 듣는다
  const ctx = ctxOf({ $sh_fn_shelf_turns: '1', $sh_fn_talk_turns: '2' });
  ctx.chat.message.unshift({ role: 'user', data: '옛말', chatId: 'u0' }, { role: 'char', data: '옛 응답 글', chatId: 'c0' });
  const s = M.shopSettings(ctx.chat.scriptstate);
  assert.ok(!M.shopSource(ctx, shopSt(), s, M.shopGive(ctx.chat.scriptstate, 'shop', 'shelf')).story.includes('옛 응답 글'));
  assert.ok(M.shopSource(ctx, shopSt(), s, M.shopGive(ctx.chat.scriptstate, 'shop', 'talk')).story.includes('옛 응답 글'));
});

test('가게 표: 가게마다 따로 (변수 이름·기본값·서로 건드리지 않음)', () => {
  assert.equal(M.shopGiveVar('shop', 'desc'), '$sh_give_desc');
  assert.equal(M.shopGiveVar('cos', 'authors'), '$cos_sh_give_authors');
  assert.equal(M.shopGiveVar('bm', 'ctx'), '$bm_sh_ctx');
  assert.equal(M.shopGiveVar('shop', 'ctx'), '$sh_ctx');
  const def = Object.fromEntries(M.SHOP_GIVE_KEYS.map((k) => [k, M.shopGiveOn({}, 'cos', k)]));
  assert.deepEqual(def, { desc: true, authors: false, persona: false, active: true, related: true, secondary: false, ctx: true });
  // 우주 쇼핑몰만 봇 설명을 끄고 작가 노트를 켠다
  const v = { $sh_refs: '12', $cos_sh_give_desc: '0', $cos_sh_give_authors: '1' };
  const cos = heads(mallReq(v, 'cos', 'shelf').src.refs);
  assert.ok(!cos.includes('공통:봇 설명') && cos.includes('공통:작가 노트'));
  for (const h of [heads(shopReq(v, 'shelf').src.refs), heads(mallReq(v, 'bm', 'shelf').src.refs)]) assert.ok(h.includes('공통:봇 설명') && !h.includes('공통:작가 노트'));
  // 맥락 반영: 쇼핑몰이 따로 정하면 그 값, 아니면 기본 상점 값
  assert.equal(M.shopGiveOn({ $sh_ctx: '0' }, 'cos', 'ctx'), false);
  assert.equal(M.shopGiveOn({ $sh_ctx: '0', $cos_sh_ctx: '1' }, 'cos', 'ctx'), true);
  assert.equal(M.shopGiveOn({ $sh_ctx: '0', $cos_sh_ctx: '1' }, 'bm', 'ctx'), false);
  assert.equal(M.shopGiveOn({ $cos_sh_ctx: '0' }, 'shop', 'ctx'), true);
  assert.equal(M.mallSettings({ $cos_sh_ctx: '0' }, 'cos').context, false);
  assert.equal(M.mallSettings({ $cos_sh_ctx: '0' }, 'bm').context, true);
  const c = { $sh_refs: '12', $cos_sh_ctx: '0' };
  assert.ok(!JSON.stringify(mallReq(c, 'cos', 'shelf').msgs).includes('[최근 본문]'));
  assert.ok(JSON.stringify(mallReq(c, 'bm', 'shelf').msgs).includes('[최근 본문]'));
  assert.ok(JSON.stringify(shopReq(c, 'shelf').msgs).includes('[최근 본문]'));
  // 같이 쓰는 나머지 값은 여전히 기본 상점 자리 하나
  assert.equal(M.mallSettings({ $cos_sh_thoughts: 'note', $cos_sh_turns: '8', $cos_sh_refs: '1' }, 'cos').thoughts, 'off');
  assert.equal(M.mallSettings({ $cos_sh_turns: '8' }, 'cos').turns, 3);
});

test('둘 다 켠 것만: 가게 표와 기능 표', () => {
  const sent = (vars, fn) => heads(shopReq({ $sh_refs: '12', ...vars }, fn).src.refs);
  // 기능 표 기본값은 작가 노트·페르소나 켬, 2차 참조 끔
  const fdef = Object.fromEntries(M.SHOP_GIVE_KEYS.map((k) => [k, M.shopFnOn({}, 'shelf', k)]));
  assert.deepEqual(fdef, { desc: true, authors: true, persona: true, active: true, related: true, secondary: false, ctx: true });
  assert.ok(sent({ $sh_give_authors: '1' }, 'shelf').includes('공통:작가 노트'), '가게 표만 켜면 기능 표 기본값(켬)과 만나 넘어간다');
  assert.ok(!sent({ $sh_give_authors: '1', $sh_fn_shelf_authors: '0' }, 'shelf').includes('공통:작가 노트'));
  assert.ok(!sent({ $sh_fn_shelf_authors: '1' }, 'shelf').includes('공통:작가 노트'), '기능 표만 켜면 안 넘어간다');
  assert.ok(!sent({ $sh_fn_shelf_desc: '0' }, 'shelf').includes('공통:봇 설명'));
  assert.ok(!sent({ $sh_give_active: '0' }, 'shelf').some((h) => h.startsWith('활성 로어북:📜')));
  assert.ok(!sent({ $sh_fn_shelf_related: '0' }, 'shelf').some((h) => h.startsWith('관련')));
  assert.ok(!sent({ $sh_give_secondary: '1' }, 'shelf').some((h) => h.startsWith('2차')), '2차 참조는 둘 다 켜야');
  // 맥락 반영
  const ctxSent = (vars, fn) => JSON.stringify(shopReq(vars, fn).msgs).includes('[진행 중 괴이·사건]');
  assert.equal(ctxSent({}, 'shelf'), true);
  assert.equal(ctxSent({ $sh_fn_shelf_ctx: '0' }, 'shelf'), false);
  assert.equal(ctxSent({ $sh_ctx: '0', $sh_fn_shelf_ctx: '1' }, 'shelf'), false);
  // 페르소나: 둘 다 켜면 넘길 것에 든다 (요청 자료는 core/refs.ts collectRefs 가 그 값으로 모은다)
  assert.equal(M.shopGive({}, 'shop', 'talk').toggles.persona, false);
  assert.equal(M.shopGive({ $sh_give_persona: '1' }, 'shop', 'talk').toggles.persona, true);
  assert.equal(M.shopGive({ $sh_give_persona: '1', $sh_fn_talk_persona: '0' }, 'shop', 'talk').toggles.persona, false);
  const src = { char: { name: '괴이봇', desc: '봇 설명 글', globalLore: lore }, chat: chatOf(), persona: '페르소나 글' };
  const rows = M.collectRefs(src, { scope: 'gnet', text: '', ...M.shopGive({ $sh_give_persona: '1', $sh_give_authors: '1' }, 'shop', 'talk').toggles });
  assert.deepEqual(rows.filter((r) => r.kind === 'base').map((r) => r.sources[0]), ['봇 설명', '작가 노트', '사용자 페르소나']);
});

test('요청 종류마다 제 줄을 읽는다 (진열 · 문의 · 1:1 상담)', () => {
  const v = { $sh_refs: '12', $sh_fn_talk_desc: '0', $sh_fn_desk_active: '0', $sh_fn_shelf_related: '0', $sh_fn_talk_ctx: '0' };
  const shelf = heads(shopReq(v, 'shelf').src.refs);
  const talk = heads(shopReq(v, 'talk').src.refs);
  const desk = heads(M.deskSource(ctxOf(v)).refs);
  assert.ok(shelf.includes('공통:봇 설명') && talk.every((h) => h !== '공통:봇 설명') && desk.includes('공통:봇 설명'));
  assert.ok(shelf.some((h) => h.startsWith('활성')) && talk.some((h) => h.startsWith('활성')) && !desk.some((h) => h.startsWith('활성')));
  assert.ok(!shelf.some((h) => h.startsWith('관련')) && talk.some((h) => h.startsWith('관련')));
  assert.ok(JSON.stringify(shopReq(v, 'shelf').msgs).includes('[최근 본문]') && !JSON.stringify(shopReq(v, 'talk').msgs).includes('[최근 본문]'));
  // 쇼핑몰도 같은 기능 표를 같이 쓴다
  assert.ok(!heads(mallReq(v, 'cos', 'talk').src.refs).includes('공통:봇 설명'));
  assert.ok(heads(mallReq(v, 'cos', 'shelf').src.refs).includes('공통:봇 설명'));
  // 우주 쇼핑몰 상황용 칸 「자동」은 진열에 실제로 넘기는 맥락 반영을 본다
  const pv = M.previewMallShelf(ctxOf({ $cos_roll_on: '1', $sh_fn_shelf_ctx: '0' }), 'cos');
  assert.ok(!JSON.stringify(pv).includes('ROLE: useful'));
});

test('망상홈쇼핑: 기본값이면 요청문이 그대로고, 자기 줄(가게 표)만 읽는다', () => {
  const base = { $sh_refs: '2', $sh_turns: '2' };
  const tables = {
    $sh_give_desc: '0', $sh_give_authors: '1', $sh_give_persona: '1', $sh_give_active: '0', $sh_give_related: '0', $sh_give_secondary: '1',
    $cos_sh_give_desc: '0', $bm_sh_give_related: '0', $cos_sh_ctx: '0', $bm_sh_ctx: '0',
    ...Object.fromEntries(['shelf', 'talk', 'desk'].flatMap((f) => [...M.SHOP_GIVE_KEYS.map((k) => [`$sh_fn_${f}_${k}`, '0']), [`$sh_fn_${f}_turns`, '8'], [`$sh_fn_${f}_refs`, '0']])),
  };
  const a = M.previewHomeshop(ctxOf(base));
  // 가게 표의 다른 가게 줄은 닿지 않는다. 기능 표(진열 줄)는 가게가 같이 쓰므로 망상홈쇼핑 편성에도 닿는다
  const shopRows = Object.fromEntries(Object.entries(tables).filter(([k]) => !k.startsWith('$sh_fn_')));
  const b = M.previewHomeshop(ctxOf({ ...base, ...shopRows }));
  assert.ok(a && a.length);
  assert.ok(!JSON.stringify(M.previewHomeshop(ctxOf({ ...base, $sh_fn_shelf_desc: '0' }))).includes('[공통: 봇 설명]'), '기능 표 진열 줄에서 끄면 안 간다');
  assert.deepEqual(b, a, '다른 가게 줄은 망상홈쇼핑에 닿지 않는다');
  const off = JSON.stringify(M.previewHomeshop(ctxOf({ ...base, $hs_sh_give_desc: '0' })));
  assert.ok(!off.includes('[공통: 봇 설명]'), '망상홈쇼핑 줄에서 봇 설명을 끄면 안 간다');
  const text = JSON.stringify(a);
  // 기본값: 봇 설명·상시 로어북은 가고 작가 노트는 안 간다
  assert.ok(text.includes('[공통: 봇 설명]') && text.includes('[활성 로어북: 📜Faction]') && !text.includes('작가 노트 글'));
  // 「참조 로어북」 수(양 표 진열 줄)는 망상홈쇼핑 편성에도 다른 가게와 똑같이 듣는다
  assert.equal((text.match(/\[관련 로어북: /g) ?? []).length, 2);
  assert.deepEqual(M.hsVars({ ...base, ...tables }).$sh_ctx, undefined);
  assert.equal(M.hsSettings({ ...base, ...tables }).shop.context, true);
  assert.equal(M.hsSettings({ $sh_ctx: '0' }).shop.context, false, '기본 상점 자리의 맥락 반영을 그대로 읽는다');
});

test('게시판·괴담톡·위키의 개수 제한은 그대로다 (hard 를 안 주면 필수 줄은 빼지 않는다)', () => {
  const src = { char: { name: '괴이봇', desc: '봇 설명 글', globalLore: lore }, chat: chatOf() };
  const g = M.collectRefs(src, { scope: 'gnet', text: STORY.join(' '), secondary: true });
  assert.equal(g.filter((r) => r.kind === 'direct').length, 7);
  assert.deepEqual(M.limitRefs(g, 0), g.filter((r) => r.kind !== 'secondary'), '게시판: 관련 로어북은 필수라 남고 2차만 빠진다');
  assert.deepEqual(M.limitRefs(g, 0, {}), M.limitRefs(g, 0));
  assert.deepEqual(M.limitRefs(g, 99), g);
  const w = M.collectRefs(src, { scope: 'wiki', primaryNames: ['갑 창고'], text: STORY.join(' '), secondary: true });
  assert.equal(M.limitRefs(w, 0).filter((r) => r.kind === 'direct' || r.kind === 'secondary').length, 0);
  assert.equal(M.limitRefs(w, 3).filter((r) => r.kind === 'direct' || r.kind === 'secondary').length, 3);
  // hard: 필수도 수에 맞춘다, first 는 끝까지
  const hard = M.limitRefs(g, 2, { hard: true, first: (r) => r.sources.includes('경 터널') });
  assert.deepEqual(hard.filter((r) => r.kind === 'direct').map((r) => r.sources[0]), [g.find((r) => r.kind === 'direct').sources[0], '경 터널']);
  // 게시판 기능 표(core/reffn.ts)는 상점 표의 변수를 읽지 않는다
  assert.deepEqual(M.fnRefToggles({ $sh_give_desc: '0', $sh_fn_shelf_desc: '0' }, 'gn', 'refresh'), M.fnRefToggles({}, 'gn', 'refresh'));
});
