// 상점 「메인 요청에 붙이는 것」 (2026-11-12 사용자: 「각 기능들 컨텍 포함 선택이 어디있지? 상점 관련된거 없는거 같은데」 → 가게마다 다른 격자).
// core/shopctx.ts: 가게(기본 상점·우주 쇼핑몰·백일몽 포인트몰) × (컨텍스트 포함 · 구매 · 팔기 · 문의 · 맞춤 주문 · 1:1 상담) 조합마다
// 메인 요청 글(inventoryText)에 붙는 것·안 붙는 것, 전부 끄면 아무것도 안 붙음, 「최대 양」.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/index'; export * from './src/core/malls'; export * from './src/core/shopctx'; export { emptyShop, stampLastLine } from './src/core/shop';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false, logLevel: 'silent' });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const { SHOP_PLACES, SHOP_MAIN_ALL, SHOP_MAIN_KINDS, SHOP_MAIN_LABEL, shopMainKey, shopMain, shopMainLines, capLines, boughtPasses, soldPasses, inventoryText, mallEvents, shopEvents } = M;

/** 한 턴에 세 가게에서 다 한 장면: 붙을 수 있는 것이 전부 들어 있다 */
function scene(extra = {}, talkN = 1) {
  const message = [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: '옛', chatId: 'c0' }, { role: 'user', data: 'b', chatId: 'u2' }, { role: 'char', data: '본문\n[shop: 철물점|주인]', chatId: 'c1' }];
  const c = { message, scriptstate: {} };
  const alive = M.aliveAnchors(c);
  // 기본 상점: 주인과 나눈 말 + 판 것
  let shop = M.readShop(M.settleShop(c, 3).vars);
  const talk = [];
  for (let i = 1; i <= talkN; i++) talk.push({ who: 'me', text: `상점말${i}` }, { who: 'owner', text: `주인답${i}` });
  shop = { ...shop, loaded: true, talk, sales: [{ name: '낡은 손전등', price: 14000 }] };
  // 우주 쇼핑몰: 운영자와 나눈 말 + 맞춤 주문(선납)
  let cos = { ...M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'c1'), loaded: true, talk: [] };
  for (let i = 1; i <= talkN; i++) { cos = M.stampLastLine(M.sayToOwner(cos, `몰말${i}`), 'c1'); cos = M.stampLastLine({ ...cos, talk: [...cos.talk, { who: 'owner', text: `운영답${i}` }] }, 'c1'); }
  const order = { id: 'o1', anchor: 'c1', price: 1140000, hours: 6, orderedAt: null, orderedKey: 'c1', item: { name: '가림 내의', desc: '', effect: '', use: false } };
  // 포인트몰: 1:1 상담
  const deskTalk = [{ who: 'sys', text: '연결' }];
  for (let i = 1; i <= talkN; i++) deskTalk.push({ who: 'me', text: `상담말${i}` }, { who: 'op', text: `상담답${i}` });
  // 소지품: 가게마다 산 것, 맞춤 주문을 받은 것, 산 곳이 안 적힌 것(망상홈쇼핑 등), 우주 쇼핑몰·포인트몰에 판 것
  let it = { list: [], log: [] };
  const buy = (name, store) => { it = M.addItem(it, alive, { name, desc: '', effect: '', use: false, from: 'store', anchor: 'c1', ...(store ? { store } : {}) }); };
  buy('철물 손전등', 'shop'); buy('우주 양말', 'cos'); buy('복지 텀블러', 'bm'); buy('맞춤 장갑', 'cos-order'); buy('홈쇼핑 냄비', '');
  for (const [name, note] of [['여분 정장', '우주 쇼핑몰에 팖'], ['낡은 사원증', '백일몽 포인트몰에 팖']]) {
    it = M.addItem(it, alive, { name, desc: '', effect: '', use: false, from: 'story', anchor: 'c0' });
    it = M.sellItem(it, it.list.find((e) => e.name === name).id, 'c1', note);
  }
  const vars = {
    ...M.shopVars(shop), ...M.mallVarsOf('cos', cos), $cos_orders: JSON.stringify([order]),
    $bm_desk: JSON.stringify({ agent: { name: '김' }, talk: deskTalk, anchor: 'c1', past: [] }),
    ...M.itemsVars(it), $it_push: '1', ...extra,
  };
  return { message, scriptstate: vars };
}

/** 붙는 것 하나하나를 알아보는 글귀 → 그것을 다스리는 칸 [가게, 종류] */
const MARK = {
  '상점 구매': [/just bought[^;\n]*철물 손전등/, 'shop', 'buy'],
  '상점 팔기': [/just sold 낡은 손전등 \(14,000 won\) to the owner of 철물점/, 'shop', 'sell'],
  '상점 문의': [/talked with the owner of 철물점/, 'shop', 'ask'],
  '우주 구매': [/just bought[^;\n]*우주 양말/, 'cos', 'buy'],
  '우주 문의': [/operator on the 우주 쇼핑몰 website/, 'cos', 'ask'],
  '우주 문의(판 것)': [/just sold 여분 정장 to 우주 쇼핑몰/, 'cos', 'ask'],
  '우주 맞춤 주문(선납)': [/placed a custom order with 우주 쇼핑몰 for 「가림 내의」/, 'cos', 'order'],
  '우주 맞춤 주문(받은 것)': [/just bought[^;\n]*맞춤 장갑/, 'cos', 'order'],
  '포인트몰 구매': [/just bought[^;\n]*복지 텀블러/, 'bm', 'buy'],
  '포인트몰 1:1 상담': [/counselor on the 백일몽 포인트몰 1:1 상담/, 'bm', 'desk'],
  '포인트몰에 판 것': [/just sold 낡은 사원증 to 백일몽 포인트몰/, 'bm', null],
};
const ALWAYS = /just bought[^;\n]*홈쇼핑 냄비/;
const present = (text) => Object.fromEntries(Object.entries(MARK).map(([n, [re]]) => [n, re.test(text)]));

test('이름·변수: 가게마다 있는 종류, 변수 이름, 화면 이름', () => {
  assert.deepEqual(SHOP_PLACES, ['shop', 'cos', 'bm']);
  assert.deepEqual(SHOP_MAIN_KINDS, { shop: ['buy', 'sell', 'ask'], cos: ['buy', 'ask', 'order'], bm: ['buy', 'desk'] });
  assert.deepEqual(SHOP_MAIN_ALL.map((k) => SHOP_MAIN_LABEL[k]), ['구매', '팔기', '문의', '맞춤 주문', '1:1 상담']);
  assert.equal(shopMainKey('shop'), '$sh_main');
  assert.equal(shopMainKey('shop', 'sell'), '$sh_main_sell');
  assert.equal(shopMainKey('cos'), '$cos_sh_main');
  assert.equal(shopMainKey('cos', 'order'), '$cos_sh_main_order');
  assert.equal(shopMainKey('bm', 'desk'), '$bm_sh_main_desk');
  // 그 가게에 없는 종류는 변수가 켜져 있어도 안 붙는다
  assert.equal(shopMain({ $bm_sh_main_sell: '1' }, 'bm').has('sell'), false);
  assert.equal(shopMain({ $sh_main_order: '1' }, 'shop').has('order'), false);
});

test('기본값: 전부 켬 — 전과 같이 다 붙는다', () => {
  const text = inventoryText(scene());
  for (const [n, on] of Object.entries(present(text))) assert.equal(on, true, `${n}\n${text}`);
  assert.match(text, ALWAYS);
  for (const p of SHOP_PLACES) { const m = shopMain({}, p); assert.equal(m.on, true); for (const k of SHOP_MAIN_KINDS[p]) assert.equal(m.has(k), true); }
});

test('가게 × 칸 전부: 칸 하나를 끄면 그 칸이 다스리는 것만 빠지고 나머지는 그대로', () => {
  let n = 0;
  for (const p of SHOP_PLACES) for (const k of SHOP_MAIN_KINDS[p]) {
    const text = inventoryText(scene({ [shopMainKey(p, k)]: '0' }));
    for (const [name, [re, mp, mk]] of Object.entries(MARK)) assert.equal(re.test(text), !(mp === p && mk === k), `${p}·${k} 끔 → ${name}\n${text}`);
    assert.match(text, ALWAYS, '산 곳이 안 적힌 것은 거르지 않는다');
    n += 1;
  }
  assert.equal(n, 8, '상점 3 + 우주 쇼핑몰 3 + 포인트몰 2');
});

test('가게 × 칸 전부: 그 가게에 없는 칸의 변수를 꺼도 아무것도 안 바뀐다', () => {
  const all = inventoryText(scene());
  for (const p of SHOP_PLACES) for (const k of SHOP_MAIN_ALL.filter((x) => !SHOP_MAIN_KINDS[p].includes(x))) {
    assert.equal(inventoryText(scene({ [shopMainKey(p, k)]: '0' })), all, `${p}·${k}`);
  }
});

test('「컨텍스트 포함」을 끄면 그 가게 것이 전부 빠지고 다른 가게 것은 그대로', () => {
  for (const p of SHOP_PLACES) {
    const text = inventoryText(scene({ [shopMainKey(p)]: '0' }));
    for (const [name, [re, mp]] of Object.entries(MARK)) assert.equal(re.test(text), mp !== p, `${p} 끔 → ${name}\n${text}`);
    assert.match(text, ALWAYS);
    // 꺼져 있어도 종류마다 켜 둔 값은 그대로 남는다 (다시 켜면 돌아온다)
    const m = shopMain({ [shopMainKey(p)]: '0' }, p);
    assert.equal(m.on, false);
    for (const k of SHOP_MAIN_KINDS[p]) { assert.equal(m.kinds[k], true); assert.equal(m.has(k), false); }
  }
});

test('전부 끄면 상점 것은 아무것도 안 붙는다 (가게 전체를 끄든, 칸을 하나하나 끄든)', () => {
  const masters = Object.fromEntries(SHOP_PLACES.map((p) => [shopMainKey(p), '0']));
  const cells = Object.fromEntries(SHOP_PLACES.flatMap((p) => SHOP_MAIN_KINDS[p].map((k) => [shopMainKey(p, k), '0'])));
  for (const [how, off] of [['가게 전체', masters], ['칸마다', cells]]) {
    const c = scene(off);
    const text = inventoryText(c);
    const got = present(text);
    for (const [name, [, mp, mk]] of Object.entries(MARK)) {
      // 포인트몰에 판 것은 칸이 없어 그 줄의 「컨텍스트 포함」만 따른다
      const want = how === '칸마다' && mp === 'bm' && mk === null;
      assert.equal(got[name], want, `${how} 끔 → ${name}\n${text}`);
    }
    assert.match(text, ALWAYS, '상점 것이 아닌 것은 남는다');
    if (how === '가게 전체') {
      assert.deepEqual(mallEvents(c), []);
      assert.deepEqual(shopEvents(c), []);
    }
  }
  // 소지품까지 꺼 두면 붙일 글 자체가 없다 (상점 것만 남던 [Shop] 글이 비어 통째로 사라진다)
  const bare = scene({ ...masters, $it_on: '0' });
  bare.scriptstate.$st_items = JSON.stringify({ list: [], log: JSON.parse(bare.scriptstate.$st_items).log });
  assert.equal(inventoryText(bare), '');
  const bareOn = scene({ $it_on: '0' });
  assert.match(inventoryText(bareOn), /This turn: .*just sold 여분 정장 to 우주 쇼핑몰/, '켜 두면 소지품을 꺼도 판 일은 넘어간다');
});

test('기본 상점 문의: 거래가 끊긴 일도 「문의」를 따른다', () => {
  const c = scene();
  const st = { ...M.readShop(c.scriptstate), closed: true };
  const vars = { ...c.scriptstate, ...M.shopVars(st) };
  assert.match(shopEvents({ ...c, scriptstate: vars }).join('\n'), /refused service.*철물점/);
  const off = shopEvents({ ...c, scriptstate: { ...vars, $sh_main_ask: '0' } }).join('\n');
  assert.doesNotMatch(off, /refused service/);
  assert.match(off, /just sold 낡은 손전등/, '팔기는 그대로');
});

test('맞춤 주문 완성: 「맞춤 주문」과 「완성 알림 = 카드 + 메인 요청」 둘 다 켜져 있어야 붙는다', () => {
  const st = (d, t) => `답.\n[▣|${d}|${t}|☀️|4°C|관리국|QC 괴이]`;
  const o = { id: 'q1', anchor: 'c1', price: 1, hours: 2, orderedAt: Date.UTC(2025, 0, 1, 2, 47) / 60000, orderedKey: 'c1', item: { name: '소리 없는 신발', desc: '', effect: '', use: false } };
  const message = [{ role: 'user', data: 'x', chatId: 'u1' }, { role: 'char', data: st('2025.01.01', '02:47 AM'), chatId: 'c1' }, { role: 'user', data: 'y', chatId: 'u2' }, { role: 'char', data: st('2025.01.01', '06:00 AM'), chatId: 'c2' }];
  const ev = (extra) => mallEvents({ message, scriptstate: { $cos_orders: JSON.stringify([o]), ...extra } });
  assert.ok(ev({}).length === 1 && ev({})[0].includes('finished'));
  assert.deepEqual(ev({ $cos_sh_main_order: '0' }), []);
  assert.deepEqual(ev({ $cos_sh_main: '0' }), []);
  assert.deepEqual(ev({ $cos_ready: 'card' }), [], '「카드만」이면 칸이 켜져 있어도 없다');
  assert.equal(ev({ $cos_sh_main_ask: '0', $cos_sh_main_buy: '0' }).length, 1, '다른 칸은 상관없다');
});

test('최대 양: 기본 0 = 전부, 넘으면 최근 줄만, 세 곳(주인·운영자·상담) 모두', () => {
  assert.equal(shopMainLines({}), 0);
  assert.equal(shopMainLines({ $sh_main_lines: '' }), 0);
  assert.equal(shopMainLines({ $sh_main_lines: '12' }), 12);
  assert.equal(shopMainLines({ $sh_main_lines: '999' }), 200);
  assert.equal(shopMainLines({ $sh_main_lines: '-3' }), 0);
  assert.equal(shopMainLines({ $sh_main_lines: 'abc' }), 0);
  assert.deepEqual(capLines([1, 2, 3, 4], 0), [1, 2, 3, 4]);
  assert.deepEqual(capLines([1, 2, 3, 4], 2), [3, 4]);
  assert.deepEqual(capLines([1, 2], 5), [1, 2]);
  // 대화 5번 주고받음 = 10줄
  const all = inventoryText(scene({}, 5));
  for (const w of ['상점말1', '주인답5', '몰말1', '운영답5', '상담말1', '상담답5']) assert.ok(all.includes(w), `제한 없음 → ${w}`);
  const cut = inventoryText(scene({ $sh_main_lines: '4' }, 5));
  for (const w of ['상점말4', '주인답4', '상점말5', '주인답5', '몰말4', '운영답5', '상담말4', '상담답5']) assert.ok(cut.includes(w), `4줄 → ${w} 남음`);
  for (const w of ['상점말3', '주인답3', '상점말1', '몰말3', '운영답3', '몰말1', '상담말3', '상담답3', '상담말1']) assert.ok(!cut.includes(w), `4줄 → ${w} 빠짐`);
  assert.ok(!cut.includes('연결'), '상담 안내 줄은 원래 안 붙는다');
  // 딱 맞으면 그대로
  assert.equal(inventoryText(scene({ $sh_main_lines: '10' }, 5)), all);
});

test('산 것·판 것 가르기: 산 곳이 안 적힌 것, 「…에 팖」이 아닌 기록은 거르지 않는다', () => {
  const off = Object.fromEntries(SHOP_PLACES.map((p) => [shopMainKey(p), '0']));
  assert.equal(boughtPasses(off, undefined), true);
  assert.equal(boughtPasses(off, 'hs'), true);
  assert.equal(boughtPasses(off, 'shop'), false);
  assert.equal(boughtPasses({ $cos_sh_main_buy: '0' }, 'cos-order'), true, '받은 맞춤 주문은 「구매」가 아니라 「맞춤 주문」');
  assert.equal(boughtPasses({ $cos_sh_main_order: '0' }, 'cos-order'), false);
  assert.equal(boughtPasses({ $cos_sh_main_order: '0' }, 'cos'), true);
  assert.equal(soldPasses(off, '망상홈쇼핑', false), true);
  assert.equal(soldPasses(off, '을지로 철물점', true), false);
  assert.equal(soldPasses({ $sh_main_sell: '0' }, '을지로 철물점', true), false);
  assert.equal(soldPasses({ $sh_main_sell: '0' }, '우주 쇼핑몰', true), true);
  assert.equal(soldPasses({ $cos_sh_main_ask: '0' }, '우주 쇼핑몰', true), false);
  assert.equal(soldPasses({ $bm_sh_main_buy: '0', $bm_sh_main_desk: '0' }, '백일몽 포인트몰', true), true);
  assert.equal(soldPasses({ $bm_sh_main: '0' }, '백일몽 포인트몰', true), false);
});
