// 우주 쇼핑몰 맞춤 주문 (11-09 사용자): 견적 → 선납 → 작중 시각으로 납기 판정 → 받기
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/orders'; export { parseTalk, applyTalk, acceptQuote, parseOrderLine, emptyShop } from './src/core/shop';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
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
