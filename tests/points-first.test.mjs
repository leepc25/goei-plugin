// 백일몽 포인트: 상태창 따르기 — 첫 상태창도 본문대로 따른다 (2026-11-09 사용자 「본문 따라 가야지」: 본문에 기본 포인트 900이 있으면 900이 생기는 게 맞다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPoints, syncPointsToStatus } from '../dist-test/core.mjs';

const line = (p) => `[▣|2025.05.12|09:20 AM|🌧️|16°C|백일몽 본사|없음|없음|없음|백일몽/사원|1230000|${p}]`;
const chat = (...pts) => ({ message: pts.flatMap((p, i) => [{ role: 'user', data: `턴 ${i}`, chatId: `u${i}` }, { role: 'char', data: `응답.\n${line(p)}`, chatId: `c${i}` }]), scriptstate: {} });

test('장부는 0에서 시작하고 첫 상태창의 포인트를 따른다', () => {
  assert.equal(readPoints({}).start, 0);
  const w = syncPointsToStatus(readPoints({}), chat('900'));
  assert.ok(w && w.log.length === 1 && w.log[0].amount === 900);
});
test('같은 값이면 잔액이 그대로 (거래 한 줄만)', () => {
  const w = syncPointsToStatus(readPoints({}), chat('900'));
  const w2 = syncPointsToStatus(w, chat('900')) ?? w;
  assert.equal(w2.log.length, 1);
  assert.equal(w2.log.reduce((a, e) => a + e.amount, 0), 900);
});

test('같은 정산을 두 번 셌다가 되돌린 맞춤 줄 짝은 지운다 (거래 한 줄만 남는다)', () => {
  // 턴0: 상태창 5000 → 맞춤 +5000. 갱신기가 같은 응답에 「정산 지급 +5000」을 또 적음(옛 버그) → 턴1 상태창 5000 → 맞춤 −5000
  const c1 = chat('5000');
  const w1 = syncPointsToStatus(readPoints({}), c1);
  const anchor = w1.log[0].anchor;
  const dup = { ...w1, log: [...w1.log, { id: 'x1', anchor, amount: 5000, memo: '정산 지급', src: 'story', at: '' }] };
  const c2 = chat('5000', '5000');
  const healed = syncPointsToStatus({ ...dup, log: [...dup.log, { id: 'ps_later', anchor: 'zz', amount: -5000, memo: '상태창 포인트', src: 'story', at: '' }] }, c2);
  assert.deepEqual(healed.log.map((e) => e.memo), ['정산 지급']);
});

test('포인트 칸이 그대로인 응답에서 갱신기가 적은 지출은 되돌리지 않는다 (가계부와 같음, 재검토 11-14)', () => {
  const w1 = syncPointsToStatus(readPoints({}), chat('900'));
  const c2 = chat('900', '900');
  // 턴1: 상태창 포인트 칸은 900 그대로인데 갱신기가 본문에서 「매점 −300」을 읽어 적음
  const spent = { ...w1, log: [...w1.log, { id: 'u1', anchor: 'c1', amount: -300, memo: '매점', src: 'story', at: '' }] };
  const w2 = syncPointsToStatus(spent, c2) ?? spent;
  assert.deepEqual(w2.log.map((e) => [e.memo, e.amount]), [['상태창 포인트', 900], ['매점', -300]]);
  // 이미 되돌림 줄이 적힌 장부(옛 버그 흔적)는 그 줄을 뺀다
  const bad = { ...spent, log: [...spent.log, { id: 'ps_c1', anchor: 'c1', amount: 300, memo: '상태창 포인트', src: 'story', at: '' }] };
  const w3 = syncPointsToStatus(bad, c2);
  assert.deepEqual(w3.log.map((e) => [e.memo, e.amount]), [['상태창 포인트', 900], ['매점', -300]]);
});
test('포인트 칸이 바뀐 응답은 지금처럼 맞춘다 (갱신기가 같은 거래를 적으면 맞춤 줄이 빠진다)', () => {
  const w1 = syncPointsToStatus(readPoints({}), chat('900'));
  const c2 = chat('900', '600');
  const w2 = syncPointsToStatus(w1, c2);
  assert.deepEqual(w2.log.map((e) => e.amount), [900, -300]);
  const w3 = syncPointsToStatus({ ...w2, log: [...w2.log, { id: 'u1', anchor: 'c1', amount: -300, memo: '매점', src: 'story', at: '' }] }, c2);
  assert.deepEqual(w3.log.map((e) => [e.memo, e.amount]), [['상태창 포인트', 900], ['매점', -300]]);
});
