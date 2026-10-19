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

import { findStatusTags, statusMinute, statusTimeline, sceneLabel, elapsedLabel, storyDay, scanStatus, lastStatusFields } from '../dist-test/core.mjs';

test('상태창 태그: 너그럽게 읽기', () => {
  const one = (s) => { const [t] = findStatusTags(s); return t && [t.date, t.time, t.weather, t.temp, t.place, t.target]; };
  assert.deepEqual(one('[▣|2025.03.15|12:15 PM|☀️|12°C|관리국 본부|함평 소라 랜드]'), ['2025.03.15', '12:15 PM', '☀️', '12°C', '관리국 본부', '함평 소라 랜드']);
  assert.deepEqual(one('[▣ | 2025.03.15 | 12:15 PM | ☀️ | 12°C | 관리국 본부 | 없음 ]'), ['2025.03.15', '12:15 PM', '☀️', '12°C', '관리국 본부', '']);
  // 전각 기호, 닫는 괄호 없음
  assert.deepEqual(one('【▣｜2025.03.15｜12:15 PM｜☀️｜12°C｜관리국 본부｜없음'), ['2025.03.15', '12:15 PM', '☀️', '12°C', '관리국 본부', '']);
  // 날씨 칸 빠짐
  assert.deepEqual(one('[▣|2025.03.15|12:15 PM|12°C|관리국 본부|소라 랜드]'), ['2025.03.15', '12:15 PM', '', '12°C', '관리국 본부', '소라 랜드']);
  // 날씨·기온이 한 칸
  assert.deepEqual(one('[▣|2025.03.15|12:15 PM|☀️ 12°C|관리국 본부]'), ['2025.03.15', '12:15 PM', '☀️', '12°C', '관리국 본부', '']);
  // 순서가 바뀜
  assert.deepEqual(one('[▣|12:15 PM|2025.03.15|☀️|12°C|관리국 본부|목표]'), ['2025.03.15', '12:15 PM', '☀️', '12°C', '관리국 본부', '목표']);
  assert.equal(findStatusTags('그냥 글 [AN|x]').length, 0);
  assert.equal(scanStatus('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]').target, '');
  assert.equal(lastStatusFields(['a', '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|소라]']).target, '소라');
});

test('상태창 시각: 분·지난 장면·흐른 시간·며칠째', () => {
  const a = statusMinute('2025.03.14', '09:10 PM');
  const b = statusMinute('2025.03.15', '11:40 PM');
  assert.equal(statusMinute('2025.03.15', '12:00 AM') % 1440, 0);
  assert.equal(statusMinute('2025.03.15', '오후 3:05') % 1440, 15 * 60 + 5);
  assert.equal(sceneLabel(a, b), '어제 오후 9:10');
  assert.equal(sceneLabel(statusMinute('2025.03.15', '10:00 AM'), b), '오늘 오전 10:00');
  assert.equal(sceneLabel(statusMinute('2025.03.10', '12:05 PM'), b), '3월 10일 오후 12:05');
  assert.equal(elapsedLabel(a, b), '1일 2시간 30분');
  assert.equal(elapsedLabel(b, b), '흐르지 않음');
  assert.equal(storyDay(statusMinute('2025.03.13', '11:00 PM'), b), 3);
  const tl = statusTimeline(['[▣|2025.03.13|11:00 PM|☀️|1°C|가|없음]', '[▣|2025.03.14|09:10 PM|☀️|1°C|나|없음]']);
  assert.equal(tl.prev.get('[▣|2025.03.14|09:10 PM|☀️|1°C|나|없음]'), statusMinute('2025.03.13', '11:00 PM'));
  assert.equal(tl.start, statusMinute('2025.03.13', '11:00 PM'));
  assert.equal(tl.last.minute, a);
});
