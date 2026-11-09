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
test('같은 값이면 바뀔 게 없다', () => {
  const w = syncPointsToStatus(readPoints({}), chat('900'));
  assert.equal(syncPointsToStatus(w, chat('900')), null);
});
