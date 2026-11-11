// 소지품·가계부·상점 설정 (2026-11-08): 켜고 끄기 연동, 새 옵션(상태 바꾸기·다 쓴 물건·넘길 내용·기록 턴 수·잔고 따르기·거래 기준·최근 거래·열리는 자리)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItem, applyItemChanges, itemDetail, itemLine, itemLogTurns, itemsVars, invOn, itemPushOn, itemAutoOn, itemStartOn, itemStateOn, liveItems, readItems, recentWalletLines,
  shopBlocked, shopGuide, shopSettings, walletLoose, walletRecentN, walletSyncOn, withStatusBlock, settings,
} from '../dist-test/core.mjs';

const alive = new Set(['c1', 'c2']);

test('상점은 소지품·가계부 둘 다 켜져야: 하나라도 끄면 꺼지고 까닭을 알려 준다', () => {
  assert.equal(shopBlocked({}), '');
  assert.equal(shopBlocked({ $it_on: '0' }), 'items');
  assert.equal(shopBlocked({ $st_col_wallet: 'off' }), 'wallet');
  assert.equal(shopBlocked({ $it_on: '0', $st_col_wallet: 'off' }), 'both');
  assert.equal(shopSettings({}).on, true);
  assert.equal(shopSettings({ $it_on: '0' }).on, false);
  assert.equal(shopSettings({ $st_col_wallet: 'off' }).on, false);
  assert.equal(shopSettings({ $sh_on: '0' }).on, false);
  // 소지품을 끄면 본편 넘기기·읽기·시작 소지품도 꺼진다 (가계부는 따로)
  assert.equal(invOn({ $it_on: '0' }), false);
  assert.deepEqual([itemPushOn({ $it_on: '0' }), itemAutoOn({ $it_on: '0' }), itemStartOn({ $it_on: '0' })], [false, false, false]);
  assert.deepEqual([itemPushOn({}), itemAutoOn({}), itemStartOn({})], [true, true, true]);
});

test('상점이 열리는 자리: 기본 어디서든(주인 없는 가게·통신 판매 포함), 가게 장면만 고를 수 있음', () => {
  assert.equal(shopSettings({}).where, 'any');
  assert.equal(shopSettings({ $sh_where: 'shop' }).where, 'shop');
  const any = shopGuide({ $sh_judge: 'main' });
  const shop = shopGuide({ $sh_where: 'shop', $sh_judge: 'main' });
  assert.ok(!any.includes('{where}') && !shop.includes('{where}'));
  assert.notEqual(any, shop);
  assert.ok(/empty/i.test(any), '주인이 없으면 비워 둔다는 안내');
});

test('상태 바꾸기 끔: 손상·고장은 받지 않고 파괴는 그냥 없어짐으로', () => {
  let it = addItem({ list: [], log: [] }, alive, { name: '손전등', from: 'manual', anchor: '' });
  const off = applyItemChanges(it, alive, [{ action: 'update', name: '손전등', state: 'broken', anchor: 'c1' }], { state: false });
  assert.equal(liveItems(off, alive)[0].state, 'ok');
  const on = applyItemChanges(it, alive, [{ action: 'update', name: '손전등', state: 'broken', anchor: 'c1' }]);
  assert.equal(liveItems(on, alive)[0].state, 'broken');
  const gone = applyItemChanges(it, alive, [{ action: 'destroyed', name: '손전등', anchor: 'c1' }], { state: false });
  assert.equal(liveItems(gone, alive).length, 0);
  assert.equal(gone.log.at(-1).what, 'gone');
  assert.equal(itemStateOn({ $it_state: '0' }), false);
  assert.equal(itemStateOn({}), true);
});

test('다 쓴 물건: 기본은 목록에서 빠지고, 남겨 두기면 「다 씀」으로 남는다', () => {
  const base = addItem({ list: [], log: [] }, alive, { name: '부적', uses: 2, from: 'manual', anchor: '' });
  const ch = [{ action: 'update', name: '부적', uses: 0, anchor: 'c1' }];
  assert.equal(liveItems(applyItemChanges(base, alive, ch), alive).length, 0);
  const kept = readItems({ ...itemsVars(base), $it_spent: 'keep' });
  assert.equal(kept.keep, true);
  const after = applyItemChanges(kept, alive, ch);
  assert.equal(liveItems(after, alive).length, 1);
  assert.ok(itemLine(liveItems(after, alive)[0], 0, false).includes('used up'));
  // 저장 글에는 keep 이 들어가지 않는다 (설정 변수가 정함)
  assert.ok(!Object.values(itemsVars(after)).join('').includes('"keep"'));
});

test('본편에 넘길 내용·기록 턴 수: 고른 값만, 숫자는 0~10', () => {
  assert.equal(itemDetail({}), 'full');
  assert.equal(itemDetail({ $it_detail: 'name' }), 'name');
  assert.equal(itemDetail({ $it_detail: 'x' }), 'full');
  const e = { id: 'a', name: '손전등', desc: '긴 설명', effect: '비춘다', use: true, state: 'ok', anchor: '', from: 'manual' };
  assert.ok(itemLine(e, undefined, false, 'full').includes('비춘다'));
  assert.ok(!itemLine(e, undefined, false, 'name').includes('비춘다'));
  assert.equal(itemLogTurns({}), 3);
  assert.equal(itemLogTurns({ $it_logturns: '3' }), 3);
  assert.equal(itemLogTurns({ $it_logturns: '99' }), 10);
  assert.equal(itemLogTurns({ $it_logturns: '-1' }), 3);
});

test('가계부 옵션: 잔고 따르기 기본 켬, 거래 기준 기본 금액만, 최근 거래 0~10줄', () => {
  assert.equal(walletSyncOn({}), true);
  assert.equal(walletSyncOn({ $st_wallet_sync: '0' }), false);
  assert.equal(walletLoose({}), false);
  assert.equal(walletLoose({ $st_wallet_loose: '1' }), true);
  assert.equal(walletRecentN({}), 0);
  assert.equal(walletRecentN({ $st_wallet_recent: '20' }), 10);
  const w = { start: 0, log: [
    { id: '1', anchor: 'c1', amount: -30000, memo: '택시', src: 'story' },
    { id: '2', anchor: 'gone', amount: -5000, memo: '지운 응답', src: 'story' },
    { id: '3', anchor: 'c2', amount: 100000, memo: '보수', src: 'story' },
  ] };
  assert.deepEqual(recentWalletLines(w, alive, 1), ['+100,000 won 보수']);
  assert.deepEqual(recentWalletLines(w, alive, 5), ['-30,000 won 택시', '+100,000 won 보수']);
  assert.deepEqual(recentWalletLines(w, alive, 0), []);
  const msgs = [{ role: 'user', content: 'a' }, { role: 'assistant', content: '글\n[▣|x|1,000원]' }, { role: 'user', content: 'b' }];
  const out = withStatusBlock(msgs, '', { cols: ['wallet'], wallet: 1000, recent: ['-30,000 won 택시'] });
  assert.ok(out.some((m) => String(m.content).includes('Recent cash transactions (oldest first): -30,000 won 택시')));
});

test('새 옵션 값은 새 채팅 기본값으로 저장된다', () => {
  for (const k of ['$it_on', '$it_start', '$it_spent', '$it_state', '$it_detail', '$it_logturns', '$st_wallet_sync', '$st_wallet_loose', '$st_wallet_recent', '$sh_where', '$sh_on']) assert.ok(settings.PREF_VAR.test(k), k);
  assert.ok(!settings.PREF_VAR.test('$it_resumed'), '다시 켠 표시는 채팅 상태');
});

test('상점이 꺼져 있으면 이번 응답의 상점 표식도 지우고 가게를 열지 않는다', async () => {
  const { settleShop, readShop } = await import('../dist-test/core.mjs');
  const chat = (vars) => ({ message: [{ role: 'user', data: '들어간다', chatId: 'u1' }, { role: 'char', data: '가게다\n[shop: 우주 쇼핑몰|]', chatId: 'c1' }], scriptstate: vars });
  const on = settleShop(chat({}), 1);
  assert.equal(readShop(on.vars).shop, '우주 쇼핑몰', '주인 없는 가게도 열린다');
  for (const vars of [{ $it_on: '0' }, { $st_col_wallet: 'off' }, { $sh_on: '0' }]) {
    const r = settleShop(chat(vars), 1);
    assert.ok(!String(r.message?.[1]?.data ?? '가게다').includes('[shop:'), JSON.stringify(vars));
    assert.equal(readShop(r.vars ?? {})?.shop ?? '', '', JSON.stringify(vars));
  }
});

test('주인공 자기 가게는 상점이 아니다: 표식의 주인이 주인공이면 지우고 열지 않는다 (11-09 마덕희·헐값매입)', async () => {
  const { settleShop, readShop } = await import('../dist-test/core.mjs');
  const chat = { message: [{ role: 'user', data: '가게 문을 연다', chatId: 'u1' }, { role: 'char', data: '헐값매입이다\n[shop: 헐값매입|마덕희]', chatId: 'c1' }], scriptstate: {} };
  const r = settleShop(chat, 1, ['마 덕희', '']);
  assert.ok(!String(r.message?.[1]?.data).includes('[shop:'), '표식 지움');
  assert.equal(readShop(r.vars ?? {})?.shop ?? '', '');
  assert.equal(readShop(settleShop(chat, 1, ['은하제']).vars).shop, '헐값매입', '남의 가게는 그대로');
});
