import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayInfo } from '../dist-test/core.mjs';

const short = (s) => { const i = dayInfo(s); return i && `${i.date} ${i.weekday} ${i.holiday}`.trim(); };

test('요일: 모델이 쓴 날짜 형식 여럿, 붙여 온 요일은 계산한 것으로', () => {
  assert.equal(short('2025.03.15'), '2025.03.15 토');
  assert.equal(short('2025-03-16'), '2025-03-16 일');
  assert.equal(short('2025년 3월 17일'), '2025년 3월 17일 월');
  assert.equal(short('2025.03.15 (수)'), '2025.03.15 토', '틀린 요일은 지운다');
  assert.equal(short('2025.03.15 Sat'), '2025.03.15 토');
  assert.equal(dayInfo('3월 중순'), null);
  assert.equal(dayInfo('2025.02.30'), null);
});

test('공휴일: 양력·음력·대체공휴일 (2025년 실제 달력)', () => {
  const want = {
    '2025.01.01': '신정', '2025.01.28': '설날', '2025.01.29': '설날', '2025.01.30': '설날',
    '2025.03.01': '삼일절', '2025.03.03': '대체공휴일', '2025.05.05': '어린이날·부처님오신날', '2025.05.06': '대체공휴일',
    '2025.06.06': '현충일', '2025.08.15': '광복절', '2025.10.03': '개천절', '2025.10.05': '추석', '2025.10.06': '추석',
    '2025.10.07': '추석', '2025.10.08': '대체공휴일', '2025.10.09': '한글날', '2025.12.25': '성탄절',
    '2025.10.10': '', '2025.05.07': '', '2025.03.04': '',
  };
  for (const [d, h] of Object.entries(want)) assert.equal(dayInfo(d).holiday, h, d);
  assert.equal(dayInfo('2024.09.18').holiday, '추석');
  assert.equal(dayInfo('2024.02.12').holiday, '대체공휴일', '2024 설 연휴 일요일 → 월요일');
  assert.equal(dayInfo('2023.05.29').holiday, '대체공휴일', '2023 부처님오신날 토요일');
  assert.equal(dayInfo('2019.10.03').holiday, '개천절');
  assert.equal(dayInfo('2020.08.17').holiday, '', '2021 전에는 광복절 대체 없음 (임시공휴일은 모름)');
  assert.equal(dayInfo('2025.10.06').red, true);
  assert.equal(dayInfo('2025.03.16').red, true);
  assert.equal(dayInfo('2025.03.15').saturday, true);
});
