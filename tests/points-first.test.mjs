// 백일몽 포인트: 첫 포인트 상태창은 따르지 않는다 — 무조건 0 시작 (2026-11-09 사용자: 모델이 「기본 포인트 900」을 지어냄)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPoints, syncPointsToStatus } from '../dist-test/core.mjs';

const line = (p) => `[▣|2025.05.12|09:20 AM|🌧️|16°C|백일몽 본사|없음|없음|없음|백일몽/사원|1230000|${p}]`;
const chat = (...pts) => ({ message: pts.flatMap((p, i) => [{ role: 'user', data: `턴 ${i}`, chatId: `u${i}` }, { role: 'char', data: `응답.\n${line(p)}`, chatId: `c${i}` }]), scriptstate: {} });

test('첫 상태창의 포인트는 장부에 안 들어간다 (0 유지)', () => {
  assert.equal(syncPointsToStatus(readPoints({}), chat('900')), null);
});
test('두 번째 상태창부터는 따른다', () => {
  const w = syncPointsToStatus(readPoints({}), chat('900', '1400'));
  assert.ok(w && w.log.length === 1 && w.log[0].amount === 1400);
});
