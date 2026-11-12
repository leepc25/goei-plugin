// 망상홈쇼핑 시청 기록 → 본편 참고 기록 (core/hslog.ts)
import test from 'node:test';
import assert from 'node:assert/strict';
import { hslog, homeshop, budget, focus } from '../dist-test/core.mjs';
const { appendLog, readLog, hsMainContext, hsMainSettings, hsMainOn, hsMainRules, HS_LOG_VAR, HS_LOG_MAX, HS_LOG_HOST, HS_MAIN_SET, HS_MAIN_KEY, HS_MAIN_FALLBACK, sameProgram } = hslog;

const item = (id, name, pay, desc) => ({ id, name, pay, desc, price: 0 });
const showOf = (key, ids = ['a1', 'a2']) => ({
  loaded: true, key, title: '금요 심야 특집', at: 0, prev: [], chat: [],
  parts: [{ item: item(ids[0], '행운의 무전기', '무이자 6회', '건전지 없이도 누군가 받습니다.'), cues: [] }, { item: item(ids[1], '잠들지 않는 베개', '무이자 3회', '아침까지 눈이 떠 있습니다.'), cues: [] }],
});
const host = (p, text) => ({ k: 'show', p, who: HS_LOG_HOST, text });
const chat = (p, who, text) => ({ k: 'chat', p, who, text });
const me = (p, text) => ({ k: 'say', p, who: '김솔음', text, me: 1 });
const reply = (p, who, text) => ({ k: 'say', p, who, text });
const buy = (p, text, ref) => ({ k: 'buy', p, who: '김솔음', text, ...(ref ? { ref } : {}) });
const chatOf = (vars) => ({ message: [], scriptstate: vars });
const body = (text) => JSON.parse(text.split('\n').at(-2));
const RULE = 'RULE-LINE';

const full = () => {
  const show = showOf('k1');
  let vars = {};
  vars = { ...vars, ...appendLog(vars, show, [host(0, '고객님들, 잘 오셨습니다.'), chat(0, 'ㅇㅇ', '재입고 되나요'), me(0, '이거 진짜예요?'), reply(0, HS_LOG_HOST, '진짜입니다, 고객님.'), reply(0, '???', '사지 마세요')]) };
  vars = { ...vars, ...appendLog(vars, show, [host(1, '다음 상품입니다.'), chat(1, '밤손님', '베개 궁금'), buy(1, '전화 주문: 「잠들지 않는 베개」 · 무이자 할부 3회')]) };
  return { show, vars };
};

test('시청 기록: 덧붙이기 · 같은 대본 줄은 한 번만 · 본 부의 상품만 적는다', () => {
  const show = showOf('k1');
  let vars = appendLog({}, show, [host(0, '첫 줄'), chat(0, 'ㅇㅇ', '와')]);
  let log = readLog(vars);
  assert.equal(log.key, 'k1');
  assert.equal(log.title, '금요 심야 특집');
  assert.equal(log.entries.length, 2);
  assert.deepEqual(Object.keys(log.items), ['0'], '아직 안 본 2부 상품은 없다');
  assert.equal(log.items[0].name, '행운의 무전기');
  assert.equal(log.items[0].pay, '무이자 6회');
  // 같은 부를 다시 틀어도 대본 줄은 한 번만, 내 채팅은 같은 말이어도 다시 적는다
  vars = { ...vars, ...appendLog(vars, show, [host(0, '첫 줄'), chat(0, 'ㅇㅇ', '와'), me(0, '안녕'), me(0, '안녕')]) };
  log = readLog(vars);
  assert.deepEqual(log.entries.map((e) => e.k), ['show', 'chat', 'say', 'say']);
  assert.deepEqual(appendLog(vars, show, [host(0, '첫 줄')]), {}, '바뀐 것이 없으면 빈 조각');
  assert.deepEqual(appendLog(vars, show, []), {});
  assert.deepEqual(appendLog(vars, show, [{ k: 'nope', p: 0, who: 'x', text: 'y' }, { k: 'chat', p: 0, who: 'x', text: '  ' }]), {}, '모르는 종류·빈 글은 버린다');
});

test('시청 기록: 새 편성이면 갈아 끼운다 (같은 열쇠라도 상품이 다르면 새 편성)', () => {
  const { vars } = full();
  assert.equal(readLog(vars).entries.length, 8);
  const next = appendLog(vars, showOf('k2', ['b1', 'b2']), [host(0, '새 방송')]);
  assert.equal(readLog(next).key, 'k2');
  assert.deepEqual(readLog(next).entries.map((e) => e.text), ['새 방송']);
  const again = appendLog(vars, showOf('k1', ['c1', 'c2']), [host(0, '같은 턴에 다시 받은 방송')]);
  assert.equal(readLog(again).entries.length, 1);
  assert.equal(sameProgram(showOf('k1'), showOf('k1')), true);
  assert.equal(sameProgram(showOf('k1'), showOf('k1', ['c1', 'c2'])), false);
  assert.deepEqual(readLog({ [HS_LOG_VAR]: '{깨진' }).entries, []);
});

test('시청 기록: 줄 수 한계 — 오래된 줄부터 버리되 내 채팅·주문은 남긴다', () => {
  const show = showOf('k1');
  let vars = appendLog({}, show, [me(0, '맨 처음 내 말'), buy(0, '전화 주문: 「행운의 무전기」')]);
  const many = Array.from({ length: HS_LOG_MAX + 50 }, (_, i) => chat(0, `닉${i}`, `줄 ${i}`));
  vars = { ...vars, ...appendLog(vars, show, many) };
  const log = readLog(vars);
  assert.equal(log.entries.length, HS_LOG_MAX);
  assert.equal(log.entries[0].text, '맨 처음 내 말');
  assert.equal(log.entries[1].k, 'buy');
  assert.equal(log.entries.at(-1).text, `줄 ${HS_LOG_MAX + 49}`);
  assert.equal(log.entries[2].text, '줄 52', '가장 오래된 시청자 줄 52개가 빠졌다');
});

test('설정: 기본값 · 끄기 · 종류 · 토큰 범위 · 설정 표', () => {
  assert.deepEqual(hsMainSettings(undefined), { on: true, kinds: ['show', 'chat', 'say', 'buy'], tokens: 3000 });
  assert.equal(hsMainSettings({ $hs_main: '0' }).on, false);
  assert.deepEqual(hsMainSettings({ $hs_main_kinds: 'buy, say' }).kinds, ['say', 'buy']);
  assert.deepEqual(hsMainSettings({ $hs_main_kinds: '' }).kinds.length, 4, '비우면 기본');
  assert.deepEqual(hsMainSettings({ $hs_main_kinds: 'none' }).kinds, []);
  assert.equal(hsMainSettings({ $hs_main_tokens: '0' }).tokens, 0);
  assert.equal(hsMainSettings({ $hs_main_tokens: '999999999' }).tokens, HS_MAIN_SET.tokens.hi);
  assert.equal(hsMainSettings({ $hs_main_tokens: 'x' }).tokens, HS_MAIN_SET.tokens.def);
  assert.deepEqual([HS_MAIN_KEY.on, HS_MAIN_KEY.kinds, HS_MAIN_KEY.tokens], ['$hs_main', '$hs_main_kinds', '$hs_main_tokens']);
  assert.equal(HS_MAIN_SET.kinds.def, 'show,chat,say,buy');
  const { vars } = full();
  assert.equal(hsMainOn(vars), true);
  assert.equal(hsMainOn({ ...vars, $hs_main: '0' }), false);
  assert.equal(hsMainOn({}), false, '기록이 없으면 안 넘긴다');
  assert.ok(hsMainRules().length > 20);
  assert.ok(HS_MAIN_FALLBACK.length > 20);
});

test('본편 참고 기록: 머리말 + 상품(부)마다 묶은 기록', () => {
  const { vars } = full();
  const text = hsMainContext(chatOf(vars), RULE, null, 0);
  const lines = text.split('\n');
  assert.equal(lines[0], '[MODULE_CONTEXT_BEGIN]');
  assert.equal(lines[1], RULE);
  assert.equal(lines.at(-1), '[MODULE_CONTEXT_END]');
  const j = body(text);
  assert.equal(j.feature, 'homeshop');
  assert.equal(j.program, '금요 심야 특집');
  assert.equal(j.records.length, 2);
  assert.deepEqual({ part: j.records[0].part, item: j.records[0].item, payment: j.records[0].payment, description: j.records[0].description }, { part: 1, item: '행운의 무전기', payment: '무이자 6회', description: '건전지 없이도 누군가 받습니다.' });
  assert.deepEqual(j.records[0].lines, [
    { type: 'host', text: '고객님들, 잘 오셨습니다.' },
    { type: 'viewer', nick: 'ㅇㅇ', text: '재입고 되나요' },
    { type: 'user_chat', nick: '김솔음', text: '이거 진짜예요?' },
    { type: 'host_reply_to_user', text: '진짜입니다, 고객님.' },
    { type: 'viewer_reply_to_user', nick: '???', text: '사지 마세요' },
  ]);
  assert.equal(j.records[1].part, 2);
  assert.deepEqual(j.records[1].lines.map((l) => l.type), ['host', 'viewer', 'user_order']);
});

test('본편 참고 기록: 끄면 빈 글 · 기록이 없으면 빈 글 · 종류 고르기', () => {
  const { vars } = full();
  assert.equal(hsMainContext(chatOf({ ...vars, $hs_main: '0' }), RULE, null, 0), '');
  assert.equal(hsMainContext(chatOf({}), RULE, null, 0), '');
  assert.equal(hsMainContext(chatOf({ ...vars, $hs_main_kinds: 'none' }), RULE, null, 0), '');
  const only = body(hsMainContext(chatOf({ ...vars, $hs_main_kinds: 'say,buy' }), RULE, null, 0));
  assert.equal(only.program, undefined, '방송 내용을 끄면 편성 제목·상품도 안 넘긴다');
  assert.equal(only.records[0].item, undefined);
  assert.deepEqual(only.records.flatMap((r) => r.lines.map((l) => l.type)), ['user_chat', 'host_reply_to_user', 'viewer_reply_to_user', 'user_order']);
  const showOnly = body(hsMainContext(chatOf({ ...vars, $hs_main_kinds: 'show' }), RULE, null, 0));
  assert.deepEqual(showOnly.records.flatMap((r) => r.lines.map((l) => l.type)), ['host', 'host']);
  assert.equal(showOnly.records[1].item, '잠들지 않는 베개');
  // 상한을 안 주면 설정 값($hs_main_tokens)
  assert.equal(hsMainContext(chatOf({ ...vars, $hs_main_tokens: '1' }), RULE), '');
  assert.notEqual(hsMainContext(chatOf(vars), RULE), '');
});

test('본편 참고 기록: 상한을 넘으면 시청자 채팅 → 진행자 대사 → 반응 순으로 버리고 내 채팅·주문은 끝까지 남긴다', () => {
  const show = showOf('k1');
  const entries = [];
  for (let i = 0; i < 12; i++) entries.push(host(0, `진행자가 말한 대사 ${i}번입니다`), chat(0, `닉${i}`, `시청자가 친 채팅 ${i}번입니다`));
  entries.push(me(0, '내가 친 채팅입니다'), reply(0, HS_LOG_HOST, '진행자의 대답입니다'), reply(0, '밤손님', '시청자의 대답입니다'), buy(0, '전화 주문: 「행운의 무전기」 · 무이자 할부 6회'));
  const c = chatOf(appendLog({}, show, entries));
  const types = (cap) => { const t = hsMainContext(c, RULE, null, cap); return t ? body(t).records.flatMap((r) => r.lines) : []; };
  const all = types(0);
  assert.equal(all.length, 28);
  const size = budget.promptTokens({ messages: [{ content: hsMainContext(c, RULE, null, 0) }] });
  const count = (ls, t) => ls.filter((l) => l.type === t).length;
  // 조금 넘침: 가장 오래된 시청자 채팅부터 빠지고 진행자 대사는 그대로
  const a = types(size - 10);
  assert.ok(count(a, 'viewer') < 12 && count(a, 'viewer') > 0, `시청자 채팅 일부만: ${count(a, 'viewer')}`);
  assert.equal(count(a, 'host'), 12);
  assert.equal(a.find((l) => l.type === 'viewer').text !== '시청자가 친 채팅 0번입니다', true, '오래된 것부터');
  assert.equal(a.filter((l) => l.type === 'viewer').at(-1).text, '시청자가 친 채팅 11번입니다');
  // 더 좁게: 상한을 줄여 가며 버려지는 순서를 본다
  let sawHostCut = false;
  let sawOnlyMine = false;
  for (let cap = size; cap > 0; cap -= 5) {
    const ls = types(cap);
    if (!ls.length) continue;
    assert.ok(budget.promptTokens({ messages: [{ content: hsMainContext(c, RULE, null, cap) }] }) <= cap, '상한 안');
    if (count(ls, 'host') < 12) {
      sawHostCut = true;
      assert.equal(count(ls, 'viewer'), 0, '진행자 대사가 빠지기 전에 시청자 채팅이 다 빠진다');
      if (count(ls, 'host')) assert.equal(ls.filter((l) => l.type === 'host').at(-1).text, '진행자가 말한 대사 11번입니다');
    }
    if (count(ls, 'host_reply_to_user') + count(ls, 'viewer_reply_to_user') < 2) assert.equal(count(ls, 'host'), 0, '반응은 진행자 대사 다음에 빠진다');
    if (count(ls, 'user_chat') + count(ls, 'user_order') < 2) {
      assert.equal(ls.length, count(ls, 'user_chat') + count(ls, 'user_order'), '내 채팅·주문은 맨 마지막에');
    } else if (ls.length === 2) sawOnlyMine = true;
  }
  assert.ok(sawHostCut && sawOnlyMine);
  assert.equal(hsMainContext(c, RULE, null, 1), '', '아무것도 못 넣으면 빈 글');
});

test('본편 참고 기록: 장면과 관련된 줄은 같은 갈래 안에서 더 늦게 버린다', () => {
  const show = showOf('k1');
  const entries = [chat(0, '류재관', '이 줄은 장면에 나온 사람이 쳤습니다')];
  for (let i = 0; i < 8; i++) entries.push(chat(0, `닉${i}`, `시청자가 친 채팅 ${i}번입니다`));
  entries.push(me(0, '내 말'));
  const c = chatOf(appendLog({}, show, entries));
  const f = { scene: '류재관이 문을 열었다.', terms: [] };
  assert.equal(focus.related(f, ['류재관']), true);
  const size = budget.promptTokens({ messages: [{ content: hsMainContext(c, RULE, f, 0) }] });
  const kept = body(hsMainContext(c, RULE, f, size - 30)).records[0].lines.filter((l) => l.type === 'viewer');
  assert.ok(kept.length < 9);
  assert.equal(kept[0].nick, '류재관', '가장 오래됐지만 장면에 나온 닉네임이라 남는다');
});

test('본편 참고 기록: 없던 일이 된 주문은 넘기지 않는다 · fitTotal 과 같이 돈다', () => {
  const show = showOf('k1');
  const order = { id: 'ho_a1', item: { name: '행운의 무전기' }, n: 6, anchor: 'gone', turn: 1, dues: [], boxId: '' };
  const vars0 = appendLog({}, show, [host(0, '대사'), buy(0, '전화 주문: 「행운의 무전기」', 'ho_a1')]);
  const dead = chatOf({ ...vars0, ...homeshop.ordersVars([order]) });
  assert.deepEqual(body(hsMainContext(dead, RULE, null, 0)).records[0].lines.map((l) => l.type), ['host'], '주문한 응답이 지워졌다');
  const alive = chatOf({ ...vars0, ...homeshop.ordersVars([{ ...order, anchor: '' }]) });
  assert.deepEqual(body(hsMainContext(alive, RULE, null, 0)).records[0].lines.map((l) => l.type), ['host', 'user_order']);
  // body.ts moduleContext 와 같은 꼴: 총 상한 안에서 다른 기능과 나눠 쓴다
  const { vars } = full();
  const c = chatOf(vars);
  const part = { cap: hsMainSettings(vars).tokens, build: (cap) => hsMainContext(c, RULE, null, cap) };
  const other = { cap: 3000, build: (cap) => '가'.repeat(Math.min(cap || 3000, 3000)) };
  const whole = budget.fitTotal([part, other], 0);
  assert.equal(whole[0], hsMainContext(c, RULE, null, 0));
  const tight = budget.fitTotal([part, other], 200);
  assert.ok(budget.promptTokens({ messages: tight.map((content) => ({ content })) }) <= 200, '총 상한 안');
  assert.ok(tight[0] === '' || body(tight[0]).records.some((r) => r.lines.some((l) => l.type === 'user_chat' || l.type === 'user_order')), '줄여도 내 채팅·주문부터 남는다');
});
