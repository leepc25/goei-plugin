// 가계부 (설계안 8절): 장부 읽기·잔고·살아 있는 거래·수동 조정·금액 읽기
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWallet, walletVars, walletBalance, liveWallet, addWalletEntry, removeWalletEntry, adjustWallet, aliveAnchors, formatWon, formatDelta, parseWon, mentionsAmount, WALLET_VAR } from '../dist-test/core.mjs';

const chat = () => ({ message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: 'b', chatId: 'c1' }, { role: 'char', data: 'c' }] });

test('장부: 없으면 시작 잔고의 빈 장부, 깨져도 빈 장부', () => {
  assert.deepEqual(readWallet({}, 500000), { start: 500000, log: [] });
  assert.deepEqual(readWallet({ [WALLET_VAR]: '{nope' }, 1), { start: 1, log: [] });
  const w = readWallet(walletVars({ start: 10, log: [{ id: 'x', anchor: 'c1', amount: 5, memo: 'm', src: 'story', at: '' }, { bad: 1 }] }), 0);
  assert.equal(w.start, 10);
  assert.equal(w.log.length, 1, '깨진 항목은 버림');
});

test('잔고: 기준 메시지가 남은 거래만, 수동 조정은 늘', () => {
  let w = { start: 1000000, log: [] };
  w = addWalletEntry(w, { anchor: 'c1', amount: -50000, memo: '택시', src: 'story' });
  w = addWalletEntry(w, { anchor: 'c1', amount: -50000, memo: '택시', src: 'story' });
  assert.equal(w.log.length, 1, '같은 거래는 한 번');
  w = addWalletEntry(w, { anchor: 'c9', amount: 300000, memo: '사라진 메시지', src: 'story' });
  w = addWalletEntry(w, { anchor: '#3', amount: -2000, memo: '커피', src: 'story' });
  w = addWalletEntry(w, { anchor: '', amount: 7000, memo: '수정', src: 'manual' });
  w = addWalletEntry(w, { anchor: 'c1', amount: 0, memo: '0원', src: 'story' });
  const alive = aliveAnchors(chat());
  assert.deepEqual([...alive], ['u1', 'c1', '#3']);
  assert.equal(liveWallet(w, alive).length, 3);
  assert.equal(walletBalance(w, alive), 1000000 - 50000 - 2000 + 7000);
  w = removeWalletEntry(w, w.log[0].id);
  assert.equal(walletBalance(w, alive), 1000000 - 2000 + 7000);
  w = adjustWallet(w, alive, 1234567);
  assert.equal(walletBalance(w, alive), 1234567);
  assert.equal(adjustWallet(w, alive, 1234567), w, '같은 값이면 그대로');
});

test('표기와 금액 읽기', () => {
  assert.equal(formatWon(1230000), '₩ 1,230,000');
  assert.equal(formatWon(-5000), '−₩ 5,000');
  assert.equal(formatDelta(50000), '+50,000');
  assert.equal(formatDelta(-5000), '−5,000');
  assert.equal(formatDelta(0), '');
  assert.equal(parseWon('50,000원'), 50000);
  assert.equal(parseWon('₩3,000'), 3000);
  assert.equal(parseWon('3만 원'), 30000);
  assert.equal(parseWon('12만5천원'), 125000);
  assert.equal(parseWon('1억 2000만'), 120000000);
  assert.equal(parseWon('-5만'), -50000);
  assert.equal(parseWon('1,200,000'), 1200000);
  assert.equal(parseWon('조금'), null);
  assert.ok(mentionsAmount('택시비 15,000원을 냈다'));
  assert.ok(mentionsAmount('₩3,000'));
  assert.ok(mentionsAmount('3만 원을 건넸다'));
  assert.ok(!mentionsAmount('돈을 조금 냈다'));
});

test('시작 잔고 기본값 14만 원 (사용자 2026-10-27)', async () => {
  const { WALLET_START_DEFAULT } = await import('../dist-test/core.mjs');
  assert.equal(WALLET_START_DEFAULT, 140000);
  assert.equal(readWallet({}, WALLET_START_DEFAULT).start, 140000);
});

test('필드 거래: 출처 field, 같은 물건 두 번도 따로, 기준 메시지가 사라지면 빠짐', async () => {
  const { withFieldTrade } = await import('../dist-test/core.mjs');
  let w = { start: 140000, log: [] };
  w = withFieldTrade(w, 'c1', -1200, '삼각김밥', 'f_1');
  w = withFieldTrade(w, 'c1', -1200, '삼각김밥', 'f_2');
  w = withFieldTrade(w, 'c9', -5000, '사라진 방문', 'f_3');
  w = withFieldTrade(w, 'c1', 0.4, '0원', 'f_4');
  w = withFieldTrade(w, 'c1', 3000, '  ', 'f_5');
  assert.equal(w.log.length, 4);
  assert.ok(w.log.every((e) => e.src === 'field'));
  assert.equal(w.log[3].memo, '필드 거래');
  assert.equal(walletBalance(w, aliveAnchors(chat())), 140000 - 2400 + 3000);
});

test('필드 거래: 장면 이름·필드 시각을 같이 적는다 (길면 자름)', async () => {
  const { withFieldTrade } = await import('../dist-test/core.mjs');
  const w = withFieldTrade({ start: 0, log: [] }, 'c1', -1200, '삼각김밥', 'f_1', { place: '  종로 큰길  ', time: '09:40' });
  assert.equal(w.log[0].place, '종로 큰길');
  assert.equal(w.log[0].time, '09:40');
  const bare = withFieldTrade({ start: 0, log: [] }, 'c1', -1200, '삼각김밥', 'f_2');
  assert.equal('place' in bare.log[0], false);
});
