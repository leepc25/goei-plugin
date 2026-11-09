// 우주 쇼핑몰 맞춤 주문 (11-09 사용자): 견적 → 선납 → 작중 시각으로 납기 판정 → 받기
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/orders'; export { parseTalk, applyTalk, acceptQuote, parseOrderLine, emptyShop, reviveShop, markSold } from './src/core/shop';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('견적 줄 → 견적, <order> → 대사에 붙음, 같은 이름은 바꿔치기, 수락은 한 번', () => {
  const q = M.parseOrderLine('소리 없는 신발|4500000|36|장비|shoes|0.8|발에 맞게 만든 신발이다|발소리가 사라진다|신은 사람의 목소리도 함께 사라진다');
  assert.equal(q.price, 4_500_000); assert.equal(q.hours, 36); assert.equal(q.item.name, '소리 없는 신발'); assert.equal(q.item.truth, '신은 사람의 목소리도 함께 사라진다'); assert.equal(q.item.equip, 'gear');
  assert.equal(M.parseOrderLine('이름|1000|'), null, '납기 없으면 없음');
  const r = M.parseTalk('<owner>우리는 그것을 만들 수 있다. 값은 이렇다.</owner>\n<change mode="none">\n</change>\n<order>소리 없는 신발|4500000|36|장비|shoes|0.8|발에 맞게 만든 신발이다|발소리가 사라진다|?</order>');
  assert.equal(r.quote.item.truth, '?');
  let st = { ...M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, 'k'), loaded: true };
  st = M.applyTalk(st, r, false);
  assert.equal(st.quotes.length, 1); assert.equal(st.talk.at(-1).quote, st.quotes[0].id);
  st = M.applyTalk(st, { ...r, quote: { ...r.quote, price: 5_000_000 } }, false);
  assert.equal(st.quotes.length, 1, '같은 이름 견적은 바꿔치기'); assert.equal(st.quotes[0].price, 5_000_000);
  const a = M.acceptQuote(st, st.quotes[0].id);
  assert.equal(a.quotes[0].accepted, true); assert.equal(M.acceptQuote(a, st.quotes[0].id), null);
});

test('납기: 상태창 시각으로 판정, 시각이 없으면 다음 응답 뒤, 받은 건 끝', () => {
  const chat = (time) => ({ message: [{ role: 'user', data: 'x', chatId: 'u1' }, { role: 'char', data: `답.\n[▣|2025.01.01|${time}|☀️|4°C|관리국|QC 괴이]`, chatId: 'c1' }] });
  const t0 = M.worldMinute(chat('02:47 AM'));
  assert.equal(M.minuteText(t0), '2025.01.01 02:47 AM');
  const o = { id: 'q1', anchor: 'c1', price: 1, hours: 36, orderedAt: t0, orderedKey: 'c1', item: { name: '신발', desc: '', effect: '', use: false } };
  assert.equal(M.minuteText(M.orderDue(o)), '2025.01.02 02:47 PM');
  assert.equal(M.orderReady(o, M.worldMinute(chat('11:00 PM')), 'c9'), false, '같은 날 밤은 아직');
  assert.equal(M.orderReady(o, M.orderDue(o), 'c9'), true, '납기 시각이면 받는다');
  assert.equal(M.orderReady({ ...o, taken: true }, M.orderDue(o), 'c9'), false);
  const blind = { ...o, orderedAt: null };
  assert.equal(M.orderReady(blind, null, 'c1'), false, '시각 없음 + 아직 같은 응답');
  assert.equal(M.orderReady(blind, null, 'c2'), true, '시각 없음 + 새 응답');
  assert.equal(M.worldMinute({ message: [{ role: 'char', data: '상태창 없음', chatId: 'c1' }] }), null);
  assert.ok(M.ordersText([o], t0, 'c1').includes('due 2025.01.02 02:47 PM'));
  const back = M.readOrders(M.ordersVars([o]));
  assert.equal(back[0].item.name, '신발');
});

test('받은 응답을 지우면(다시 굴리기) 주문은 「받음」에서 되돌아와 다시 받을 수 있다 (11-09 전수점검: 물건은 죽고 주문만 받음으로 남아 돈만 나갔다)', () => {
  const o = { id: 'q1', anchor: 'c1', price: 100, hours: 1, orderedAt: null, orderedKey: 'c1', walletId: 'cos_ord_q1', item: { name: 'x' }, taken: true, takenKey: 'c3' };
  const vars = M.ordersVars([o]);
  assert.equal(M.liveOrders(vars, new Set(['c1', 'c3']))[0].taken, true, '받은 응답이 살아 있으면 받음');
  const back = M.liveOrders(vars, new Set(['c1']));
  assert.equal(back.length, 1);
  assert.equal(back[0].taken, false, '받은 응답이 죽으면 다시 받을 수 있다');
  assert.equal(M.liveOrders(vars, new Set([])).length, 0, '주문한 응답까지 죽으면 주문도 없음 (돈 돌아옴)');
  const old = { ...o, takenKey: undefined };
  assert.equal(M.liveOrders(M.ordersVars([old]), new Set([]))[0]?.taken, true, '옛 자료(받은 키 없음)는 그대로 받음');
});

test('산 응답이 죽으면 진열대·쪽지·견적도 안 산 것으로 (reviveShop)', () => {
  const st = { ...M.emptyShop({ raw: '', shop: 's', owner: 'o' }, 'c1'), items: [{ id: 'i1', name: 'a', price: 10, desc: '', effect: '', sold: true, soldKey: 'c2' }, { id: 'i2', name: 'b', price: 10, desc: '', effect: '', sold: true }], notes: [{ id: 'n1', title: 't', price: 5, body: 'b', bought: true, boughtKey: 'c2' }], quotes: [{ id: 'q1', price: 1, hours: 1, item: { name: 'z' }, accepted: true, acceptedKey: 'c2' }] };
  const alive = M.reviveShop(st, new Set(['c1', 'c2']));
  assert.equal(alive.items[0].sold, true);
  const dead = M.reviveShop(st, new Set(['c1']));
  assert.equal(dead.items[0].sold, undefined, '산 응답 죽음 → 다시 살 수 있다');
  assert.equal(dead.items[1].sold, true, '키 없는 옛 자료는 그대로');
  assert.equal(dead.notes[0].bought, undefined);
  assert.equal(dead.quotes[0].accepted, undefined);
  assert.equal(M.markSold(st, 'i3', 'c9'), st);
});
