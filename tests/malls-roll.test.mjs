// 우주 쇼핑몰 진열 배정·시그니처 상품 (11-09 사용자: 하드코딩 금지 — 전부 설정에서). core/malls.ts 만 묶어서 본다
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/malls'; export { appendItems, dropItemsNamed, emptyShop, parseShelf, parseTalk, applyTalk, buyNote, SHOP_LINE, SECRET_LINE, lineOf, TRUTH_RULE, sayToOwner, stampLastLine } from './src/core/shop'; export { inventoryText } from './src/core/items';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

/** 정해진 수열을 내는 난수 (시험용) */
const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

test('진열 배정: 기본값은 장르 20종·등급 5단계, 칸마다 다른 장르, 등급 구간이 글에 들어간다', () => {
  const r = M.cosRoll({});
  assert.equal(r.on, true);
  assert.equal(r.genres.length, 20);
  assert.equal(r.tiers.length, 5);
  assert.equal(r.useful, 'auto');
  const text = M.cosAssignment(5, true, r, seq(0.1, 0.5, 0.9, 0.3, 0.7));
  const lines = text.split('\n').filter((l) => l.startsWith('Item '));
  assert.equal(lines.length, 5);
  const genres = lines.map((l) => /GENRE: ([^|]+) \|/.exec(l)[1].trim());
  assert.equal(new Set(genres).size, 5, '장르가 겹치지 않는다');
  assert.ok(lines.every((l) => /VALUE TIER: \S+ \(.+\), price ₩[\d,]+-[\d,]+/.test(l)), '등급 이름·설명·구간');
  assert.ok(lines.some((l) => l.includes('ROLE: useful')), '컨텍스트 켬 → 상황용 칸');
  assert.ok(lines.some((l) => l.includes('ROLE: broad stock')));
});

test('진열 배정: 끄면 빈 글, 상황용 칸 수는 설정대로, 장르·등급은 글로 고친다', () => {
  assert.equal(M.cosAssignment(5, true, M.cosRoll({ $cos_roll_on: '0' })), '');
  const none = M.cosAssignment(5, true, M.cosRoll({ $cos_roll_useful: '0' }));
  assert.ok(!none.includes('ROLE:'), '상황용 없음이면 역할 칸이 없다');
  const two = M.cosAssignment(4, false, M.cosRoll({ $cos_roll_useful: '2' }));
  assert.equal((two.match(/ROLE: useful/g) ?? []).length, 2, '컨텍스트가 꺼져 있어도 설정이 2칸이면 2칸');
  const r = M.cosRoll({ $cos_roll_genres: '요리, 원예,요리', $cos_roll_tiers: '싼것|cheap|1000|2000\n비싼것|dear|5000|9000\n이상한줄\n거꾸로|x|9|1' });
  assert.deepEqual(r.genres, ['요리', '원예'], '쉼표로 나누고 중복은 뺀다');
  assert.deepEqual(r.tiers.map((t) => [t.name, t.lo, t.hi]), [['싼것', 1000, 2000], ['비싼것', 5000, 9000]], '이상한 줄·거꾸로 된 구간은 버린다');
  assert.equal(M.tiersText(M.parseTiers(M.tiersText(M.COS_TIERS_DEFAULT))), M.tiersText(M.COS_TIERS_DEFAULT), '글 ↔ 값 왕복');
  const t = M.cosAssignment(3, false, r, seq(0.2));
  assert.ok(t.includes('GENRE: 요리') && t.includes('GENRE: 원예'), '장르가 칸보다 적으면 돌려 쓴다');
  assert.ok(M.cosRollChanged({ $cos_roll_genres: 'a' }) && !M.cosRollChanged({}));
});

test('시그니처 상품: 기본값은 구버전 둘, 글로 저장·읽기, 확률대로 끼우고 모델이 낸 같은 이름은 버린다', () => {
  const def = M.cosFixed({});
  assert.deepEqual(def.map((f) => f.name), ['우리가 도움!', '착한 친구']);
  assert.equal(def[1].was, 44_444_444);
  assert.deepEqual(M.cosFixed({ $cos_fixed: '[]' }), [], '다 지우면 없음');
  assert.deepEqual(M.cosFixed({ $cos_fixed: 'broken' }).length, 2, '깨진 글이면 기본값');
  const mine = [{ ...M.newCosFixed(), name: '은화 뱀', price: 3_000_000, pct: 100 }, { ...def[0], pct: 0 }];
  const back = M.cosFixed(M.cosFixedVars(mine));
  assert.equal(back[0].name, '은화 뱀');
  assert.deepEqual(M.cosFixedRoll(back, () => 0.5).map((f) => f.name), ['은화 뱀'], '확률 100은 들어가고 0은 안 들어간다');
  assert.deepEqual(M.cosFixedRoll([{ ...mine[0], on: false }]), [], '끈 것은 안 들어간다');
  // 진열대에 붙이기: 모델이 낸 같은 이름은 빠지고, 이미 진열된 것은 다시 안 붙는다
  let st = M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'k');
  st = { ...st, loaded: true, items: [{ id: 'a', name: '은화뱀', desc: '', effect: '', use: false, price: 1 }, { id: 'b', name: '손전등', desc: '', effect: '', use: false, price: 2 }], prev: ['은화 뱀', '손전등'] };
  st = M.dropItemsNamed(st, ['은화 뱀']);
  assert.deepEqual(st.items.map((x) => x.name), ['손전등']);
  assert.deepEqual(st.prev, ['손전등'], '지난 목록에서도 뺀다 (모델이 「피할 이름」으로도 못 보게)');
  st = M.appendItems(st, [{ name: '은화 뱀', desc: '', effect: '', use: false, price: 3_000_000 }]);
  assert.deepEqual(st.items.map((x) => x.name), ['손전등', '은화 뱀']);
  const again = M.appendItems(st, [{ name: '은화 뱀', desc: '', effect: '', use: false, price: 3_000_000 }]);
  assert.equal(again.items.length, 2, '이미 있으면 또 안 붙는다');
});

test('추첨 방식: 장르 겹침·통일, 등급 가중치·골고루·통일, 가중치 0은 안 뽑힌다 (11-09 사용자: 추첨 방식도 설정에서)', () => {
  const base = { $cos_roll_genres: 'a,b,c', $cos_roll_tiers: 'L|low|1|2|1\nH|high|3|4|0' };
  const one = M.cosRoll({ ...base, $cos_roll_gmode: 'one', $cos_roll_tmode: 'same' });
  assert.equal(one.gmode, 'one'); assert.equal(one.tmode, 'same');
  const d1 = M.cosDraw(4, false, one);
  assert.equal(new Set(d1.map((s) => s.genre)).size, 1, '한 장르로');
  assert.ok(d1.every((s) => s.tier.name === 'L'), '가중치 0 등급은 안 뽑히고, 한 등급으로');
  const any = M.cosRoll({ ...base, $cos_roll_gmode: 'any' });
  assert.equal(M.cosDraw(3, false, any, seq(0.1, 0.1, 0.1, 0.1, 0.1, 0.1)).filter((s) => s.genre === 'a').length, 3, '겹쳐도 됨 → 같은 장르 셋');
  const even = M.cosRoll({ $cos_roll_tmode: 'even' });
  const d3 = M.cosDraw(5, false, even);
  assert.equal(new Set(d3.map((s) => s.tier.name)).size, 5, '골고루 → 5칸에 5등급 전부');
  assert.equal(M.cosRoll({}).gmode, 'uniq'); assert.equal(M.cosRoll({}).tmode, 'weight');
  assert.equal(M.parseTiers('x|y|1|2')[0].w, 1, '가중치 비우면 1');
  assert.ok(M.tiersText(M.COS_TIERS_DEFAULT).endsWith('|1'), '글에 가중치가 붙는다');
});

test('숨긴 진짜 효과: 우주몰 줄 끝 「진실」 칸은 저장되고 화면용 효과와 따로 간다 (11-09 사용자: 효과는 광고 문구, 진짜는 모델만)', () => {
  assert.equal(M.SECRET_LINE, `${M.SHOP_LINE}|진실`);
  assert.equal(M.lineOf('Cos'), M.SECRET_LINE); assert.equal(M.lineOf('Shop'), M.SHOP_LINE);
  const r = M.parseShelf('<shelf>\n빛의 돌|1200000|사용|glowing stone|0.2|둥근 돌이다|어둠을 밝힌다|-|쥐면 주변 전등이 전부 꺼진다\n보통 돌|999999|-|stone|0.3|돌|???||\n</shelf>', { sells: 'x', never: '', prices: '' });
  assert.equal(r.items[0].truth, '쥐면 주변 전등이 전부 꺼진다');
  assert.equal(r.items[0].effect, '어둠을 밝힌다');
  assert.equal(r.items[1].truth, undefined, '비우면 없음');
});

test('진실 섞기: ? 는 「아무도 모름」, 설정 기본은 섞음, 시그니처 빈 진실은 ? (11-09 사용자: 두 개를 섞는 게 낫다)', () => {
  const r = M.parseShelf('<shelf>\n돌|999999|-|stone|0.3|돌|???||?\n</shelf>', { sells: 'x', never: '', prices: '' });
  assert.equal(r.items[0].truth, '?');
  assert.equal(M.cosTruthMode({}), 'mix'); assert.equal(M.cosTruthMode({ $cos_truth: 'none' }), 'none');
  assert.ok(M.TRUTH_RULE.mix.includes('MIX') && M.TRUTH_RULE.none.includes('EVERY'));
});

test('정보 쪽지: <info>제목|값|내용</info> → 대사에 붙은 쪽지, 같은 제목은 한 번만, 사면 bought (11-09 사용자)', () => {
  const r = M.parseTalk('<owner>그것에 대해 우리는 아는 것이 있다. 값은 적당하다.</owner>\n<change mode="none">\n</change>\n<info>골목의 괴이|700000|그것은 소리를 따라온다. 소리를 내지 마라|진짜다</info>');
  assert.deepEqual(r.info, { title: '골목의 괴이', price: 700000, body: '그것은 소리를 따라온다. 소리를 내지 마라|진짜다' });
  let st = { ...M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'k'), loaded: true };
  st = M.applyTalk(st, r, false);
  assert.equal(st.notes.length, 1); assert.equal(st.talk.at(-1).note, st.notes[0].id);
  st = M.applyTalk(st, r, false);
  assert.equal(st.notes.length, 1, '같은 제목은 다시 안 내민다'); assert.equal(st.talk.at(-1).note, undefined);
  const b = M.buyNote(st, st.notes[0].id);
  assert.equal(b.notes[0].bought, true); assert.equal(M.buyNote(b, st.notes[0].id), null, '두 번 못 산다');
  assert.equal(M.parseTalk('<owner>모른다.</owner>').info, undefined);
});

test('포인트몰 진열 배정 (11-09 사용자 「1번은 해」): $bm_roll_* 따로, 분류·포인트 구간', () => {
  const r = M.mallRoll({}, 'bm');
  assert.ok(r.on && r.genres.includes('가전') && r.tiers.length === 5 && r.tiers[0].lo === 30, '포인트몰 기본값');
  const t = M.cosAssignment(3, false, r, () => 0.1, 'bm');
  assert.ok(t.includes('CATEGORY:') && / p( \||$)/m.test(t) && !t.includes('₩'), `포인트 표기: ${t.split('\n')[0]}`);
  assert.equal(M.cosAssignment(3, false, M.mallRoll({ $bm_roll_on: '0' }, 'bm'), Math.random, 'bm'), '', '포인트몰만 끔');
  assert.ok(M.mallRoll({ $bm_roll_on: '0' }, 'cos').on, '우주몰은 그대로');
  assert.ok(M.rollChanged({ $bm_roll_tiers: 'a|b|1|2' }, 'bm') && !M.rollChanged({ $bm_roll_tiers: 'a|b|1|2' }, 'cos'));
});

test('팔기 (11-10 사용자): <deal/> 은 말로 판 표시, <offer> 를 빼먹으면 대사의 값 하나를 읽는다', () => {
  assert.equal(M.parseTalk('<owner>거래 성립.</owner><offer>15000</offer><deal/>').deal, true);
  assert.equal(M.parseTalk('<owner>15000원에 산다.</owner><offer>15000</offer>').deal, undefined);
  const sell = { itemId: 'i1', name: '토끼 가면', desc: '', effect: '', use: false };
  const st = { ...M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'k'), loaded: true, sell };
  assert.equal(M.applyTalk(st, M.parseTalk('<owner>우리는 15,000원에 매입한다.</owner>'), false).sell.price, 15000, '대사의 값 하나');
  assert.equal(M.applyTalk(st, M.parseTalk('<owner>3만원짜리를 15000원에 산다.</owner>'), false).sell.price, undefined, '값이 둘이면 읽지 않는다');
  assert.equal(M.applyTalk({ ...st, sell: { ...sell, price: 9000 } }, M.parseTalk('<owner>20000원은 무리.</owner>'), false).sell.price, 9000, '이미 부른 값은 그대로');
});

test('쇼핑몰에서 한 일(운영자와 나눈 말·맞춤 주문·1:1 상담)은 그 턴에만 본편에 넘어간다 (2026-11-10 사용자)', () => {
  const { mallEvents, mallVarsOf, emptyShop, stampLastLine: stamp, sayToOwner, inventoryText } = M;
  const c = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: '옛', chatId: 'c0' }, { role: 'user', data: 'b', chatId: 'u2' }, { role: 'char', data: '본문', chatId: 'c1' }], scriptstate: {} };
  let st = { ...emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'c1'), loaded: true, talk: [{ who: 'me', text: '옛말', k: 'c0' }] };
  st = stamp(sayToOwner(st, '맞춤 제작 되나요'), 'c1');
  st = stamp({ ...st, talk: [...st.talk, { who: 'owner', text: '가능하다, 선불.' }] }, 'c1');
  const order = { id: 'o1', anchor: 'c1', price: 1140000, hours: 6, orderedAt: null, orderedKey: 'c1', item: { name: '가림 내의', desc: '', effect: '', use: false } };
  const vars = { ...mallVarsOf('cos', st), $cos_orders: JSON.stringify([order]), $bm_desk: JSON.stringify({ agent: { name: '김' }, talk: [{ who: 'sys', text: '연결' }, { who: 'me', text: '가불 되나요' }, { who: 'op', text: '불가합니다.' }], anchor: 'c1', past: [] }) };
  const ev = mallEvents({ ...c, scriptstate: vars });
  assert.equal(ev.length, 3, ev.join('\n'));
  assert.ok(ev[0].includes('맞춤 제작 되나요') && ev[0].includes('가능하다, 선불.') && !ev[0].includes('옛말'), ev[0]);
  assert.ok(ev[1].includes('가림 내의') && ev[1].includes('1,140,000'), ev[1]);
  assert.ok(ev[2].includes('가불 되나요') && !ev[2].includes('연결'), ev[2]);
  assert.match(inventoryText({ ...c, scriptstate: { ...vars, $it_push: '1' } }), /This turn: .*operator on the 우주 쇼핑몰 website/);
  const next = { ...c, message: [...c.message, { role: 'user', data: '간다', chatId: 'u3' }, { role: 'char', data: '다음', chatId: 'c2' }], scriptstate: vars };
  assert.deepEqual(mallEvents(next), [], '다음 응답 뒤에는 없다');
});
