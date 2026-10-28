import test from 'node:test';
import assert from 'node:assert/strict';
import { findStatusTags, lastStatusFields } from '../dist-test/core.mjs';

test('상태창 8칸: 목표·동행·투입을 칸 순서대로 읽는다', () => {
  const [t] = findStatusTags('[▣|2025.01.01|10:15 PM|🌫️|9°C|명일 아파트 3층 복도|명일 아파트|쟈알디,에일린|투입]');
  assert.equal(t.place, '명일 아파트 3층 복도');
  assert.equal(t.target, '명일 아파트');
  assert.deepEqual(t.companions, ['쟈알디', '에일린']);
  assert.equal(t.deployed, true);
});

test('상태창 8칸: 없음은 빈 값, 투입 없음은 false', () => {
  const [t] = findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음]');
  assert.equal(t.target, '');
  assert.deepEqual(t.companions, []);
  assert.equal(t.deployed, false);
});

test('옛 6칸 상태창은 그대로 읽고 투입은 null', () => {
  const [t] = findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|소라 랜드]');
  assert.equal(t.target, '소라 랜드');
  assert.deepEqual(t.companions, []);
  assert.equal(t.deployed, null);
});

test('목표가 있고 투입 전이면 투입 false (브리핑·이동)', () => {
  const f = lastStatusFields(['[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|소라 랜드|로제몬|없음]']);
  assert.equal(f.target, '소라 랜드');
  assert.deepEqual(f.companions, ['로제몬']);
  assert.equal(f.deployed, false);
});

test('동행이 5명 이상이어도 전부 읽는다 (필드는 앞 4명만 쓴다)', () => {
  const [t] = findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|거리|없음|가,나,다,라,마|없음]');
  assert.equal(t.companions.length, 5);
});

test('전각 쉼표·가운뎃점으로 나눈 동행도 읽는다', () => {
  const [t] = findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|거리|없음|쟈알디，에일린、데드폴|없음]');
  assert.deepEqual(t.companions, ['쟈알디', '에일린', '데드폴']);
});

test('상태줄 시각 → 필드 시계 분: 오전·오후, 날짜 없으면 그날의 분 (QC 2026-10-28: 「02:47 PM」을 2시로 읽던 것)', async () => {
  const { statusClockMinute, statusMinute } = await import('../dist-test/core.mjs');
  assert.equal(statusClockMinute({ date: '2025.01.01', time: '10:20 AM' }), statusMinute('2025.01.01', '10:20 AM'));
  assert.equal(statusClockMinute({ date: '2025.01.01', time: '02:47 PM' }) % 1440, 14 * 60 + 47);
  assert.equal(statusClockMinute({ date: '', time: '02:47 PM' }), 14 * 60 + 47);
  assert.equal(statusClockMinute({ time: '12:05 AM' }), 5);
  assert.equal(statusClockMinute({ time: '오후 9시' }), 21 * 60);
  assert.equal(statusClockMinute({ time: '' }), null);
  assert.equal(statusClockMinute(null), null);
});
