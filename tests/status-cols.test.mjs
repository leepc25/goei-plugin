// 상태창 칸 정의 (설계안 7절): 칸 구성 읽기, 사용·표시, 구성 기록, 지침 절 조립, 칸 구성에 따른 파서
import test from 'node:test';
import assert from 'node:assert/strict';
import { POINTS_ON_VAR, colConfig, usedCols, hiddenCols, colLog, withColLog, setStatusColumns, shapeFor, formatStatusLine, statusSection, fillStatusSection, parseWalletCell, findStatusTags, rebuildStatusLine, withStatusBlock, STATUS_HEAD, COL_IDS } from '../dist-test/core.mjs';

// 포인트 칸(11번째, 2026-11-08)은 기본 「자동」이라 신분이 백일몽이 아니면 빠진다. 나머지 열 칸
const TEN = COL_IDS.filter((c) => c !== 'points');

test('칸 구성: 없으면 모두 on, 잠긴 칸(날짜·시각·위치)은 off 가 될 수 없다', () => {
  const cfg = colConfig({});
  assert.deepEqual(usedCols(cfg), TEN);
  assert.deepEqual([...hiddenCols(cfg)], ['points'], '안 쓰는 포인트 칸만');
  const c2 = colConfig({ $st_col_date: 'off', $st_col_weather: 'off', $st_col_temp: 'hide', $st_col_wallet: 'bogus' });
  assert.equal(c2.date, 'hide', '잠긴 칸을 끄면 숨김으로');
  assert.equal(c2.weather, 'off');
  assert.deepEqual(usedCols(c2), TEN.filter((c) => c !== 'weather'));
  assert.deepEqual([...hiddenCols(c2)].sort(), ['date', 'points', 'temp', 'weather'], '안 쓰는 칸도 상자에서 숨김');
  assert.equal(c2.wallet, 'on');
});

test('구성 기록: 바뀔 때만 더하고, 같은 메시지 수면 덮어쓴다', () => {
  const v = {};
  const l1 = withColLog(v, 0, ['date', 'time', 'place']);
  assert.equal(colLog({ $st_col_log: l1 }).length, 1);
  const l2 = withColLog({ $st_col_log: l1 }, 0, ['date', 'time', 'place', 'target']);
  assert.equal(colLog({ $st_col_log: l2 }).length, 1, '같은 메시지 수는 덮어쓰기');
  const l3 = withColLog({ $st_col_log: l2 }, 5, ['date', 'time', 'place']);
  assert.deepEqual(colLog({ $st_col_log: l3 }).map((e) => e.from), [0, 5]);
  assert.equal(withColLog({ $st_col_log: l3 }, 9, ['date', 'time', 'place']), l3, '같은 구성이면 그대로');
  assert.deepEqual(colLog({ $st_col_log: '{bad' }), []);
});

test('줄 만들기: 빈 값은 없음, | 와 ] 는 치운다', () => {
  assert.equal(formatStatusLine({ date: '2025.01.01', time: '10:00 AM', place: '서울|강남]' }, ['date', 'time', 'place', 'target']), '[▣|2025.01.01|10:00 AM|서울 강남|없음]');
});

test('지침 절: 칸 구성대로 형식 줄·규칙·예시', () => {
  const full = statusSection(TEN);
  assert.ok(full.includes('[▣|YYYY.MM.DD|HH:MM AM/PM|weather|temperature|location|anomaly|companions|deployed|identity|balance]'));
  assert.ok(full.includes('Balance =') && full.includes('Identity =') && full.includes('Companions ='));
  assert.ok(full.includes('[▣|2025.01.01|10:15 PM|🌫️|9°C|명일 아파트 3층 복도|명일 아파트|쟈알디,에일린|투입|관리국/요원|1180000]'));
  const slim = statusSection(['date', 'time', 'place']);
  assert.ok(slim.includes('[▣|YYYY.MM.DD|HH:MM AM/PM|location]'));
  assert.ok(!slim.includes('Balance =') && !slim.includes('Companions ='));
  assert.ok(slim.includes('[▣|2025.01.01|02:47 AM|서울 종로구 거리]'));
  assert.ok(!slim.includes('inside an anomaly'));
  assert.equal(fillStatusSection('A\n{status_section}\nB', ['date', 'time', 'place']), `A\n${slim}\nB`);
  assert.equal(fillStatusSection('no mark', COL_IDS), 'no mark');
});

test('잔고 칸 읽기', () => {
  assert.equal(parseWalletCell('1230000'), 1230000);
  assert.equal(parseWalletCell('₩1,230,000'), 1230000);
  assert.equal(parseWalletCell('-5,000원'), -5000);
  assert.equal(parseWalletCell('없음'), null);
  assert.equal(parseWalletCell('약 백만'), null);
});

test('파서: 10칸은 알려진 모양으로, 잔고까지 읽는다', () => {
  setStatusColumns({});
  const [t] = findStatusTags('[▣|2025.01.01|10:15 PM|🌫️|9°C|명일 아파트 3층 복도|명일 아파트|쟈알디,에일린|투입|관리국/요원|1180000]');
  assert.equal(t.identity, '관리국/요원');
  assert.equal(t.wallet, '1180000');
  assert.equal(t.deployed, true);
  assert.deepEqual(t.companions, ['쟈알디', '에일린']);
});

test('파서: 칸을 끈 채팅은 그 구성으로 읽고, 기록된 옛 구성으로도 읽는다', () => {
  const log = withColLog({}, 0, ['date', 'time', 'place', 'target', 'wallet']);
  setStatusColumns({ $st_col_weather: 'off', $st_col_temp: 'off', $st_col_companions: 'off', $st_col_deployed: 'off', $st_col_log: log });
  assert.deepEqual(shapeFor(6), ['date', 'time', 'place', 'target', 'identity', 'wallet'], '지금 구성(6칸)이 알려진 6칸 모양보다 먼저');
  const [t] = findStatusTags('[▣|2025.01.01|10:15 PM|명일 아파트 3층 복도|명일 아파트|관리국/요원|990000]');
  assert.equal(t.place, '명일 아파트 3층 복도');
  assert.equal(t.target, '명일 아파트');
  assert.equal(t.identity, '관리국/요원');
  assert.equal(t.wallet, '990000');
  assert.equal(t.weather, '');
  assert.equal(t.deployed, null, '투입 칸이 없으면 null');
  const [old] = findStatusTags('[▣|2025.01.01|09:00 AM|관리국 본부|없음|1000000]');
  assert.equal(old.place, '관리국 본부', '기록된 옛 5칸 구성');
  assert.equal(old.wallet, '1000000');
  setStatusColumns({});
  const [k] = findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음]');
  assert.equal(k.place, '서울 종로구 거리', '구성이 기본이면 알려진 6칸 모양');
  assert.equal(k.wallet, '');
});

test('직전 상태 줄 다시 만들기: 끈 칸은 빼고, 새 칸은 없음, 신분·잔고는 플러그인 값으로', () => {
  setStatusColumns({});
  const line = '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|쟈알디|없음]';
  assert.equal(rebuildStatusLine(line, ['date', 'time', 'place', 'companions', 'identity', 'wallet'], { identity: '관리국/신입', wallet: 1230000 }), '[▣|2025.01.01|02:47 AM|서울 종로구 거리|쟈알디|관리국/신입|1230000]');
  assert.equal(rebuildStatusLine(line, TEN, { wallet: null }), '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|쟈알디|없음|없음|없음]');
  const ten = '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음|관리국/요원|5000]';
  assert.equal(rebuildStatusLine(ten, TEN, { wallet: 7000 }), ten.replace('5000', '7000'), '잔고는 장부 값이 이긴다');
  assert.equal(rebuildStatusLine('[▣|이상한 줄]', COL_IDS, {}), '[▣|이상한 줄]', '읽지 못하면 그대로');
});

test('직전 상태 블록: 모양이 주어지면 그 칸 구성과 칸 이름을 적는다', () => {
  setStatusColumns({});
  const out = withStatusBlock([{ role: 'assistant', content: '글\n[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음]' }, { role: 'user', content: '입력' }], '관리국/신입', { cols: ['date', 'time', 'place', 'identity', 'wallet'], wallet: 300000 });
  const block = out.find((m) => m.content.startsWith(STATUS_HEAD)).content;
  assert.ok(block.includes('[▣|2025.01.01|02:47 AM|서울 종로구 거리|관리국/신입|300000]'));
  assert.ok(block.includes('Fields: 날짜 | 시각 | 위치 | 신분 | 잔고'));
});

// 11-08 전수점검: 기본값과 다른 구성으로 시작한 채팅에서 처음 바꿀 때 옛 구성을 0번부터로 남긴다. 기록 변수는 설정 변수가 아니다
test('구성 기록: 비어 있으면 바뀌기 전 구성을 먼저 남김, $st_col_log 는 설정 변수 아님', async () => {
  const { settings } = await import('../dist-test/core.mjs');
  const prev = { $st_col_weather: 'off' };
  const log = colLog({ $st_col_log: withColLog(prev, 4, TEN) });
  assert.deepEqual(log.map((e) => e.from), [0, 4]);
  assert.deepEqual(log[0].cols, TEN.filter((c) => c !== 'weather'));
  assert.equal(colLog({ $st_col_log: withColLog({}, 0, ['date', 'time', 'place']) }).length, 1, '메시지가 없으면 그대로');
  assert.equal(settings.isChatSettingVar('$st_col_log'), false);
  assert.equal(settings.isChatSettingVar('$st_col_wallet'), true);
});

// 백일몽 포인트 칸 (2026-11-08 사용자: 백일몽이면 자동으로 켜지고, 아니면 칸 자체가 빠진다)
test('포인트 칸: 자동(신분이 백일몽일 때만), 직접 고르면 그 값, 자동+숨김', () => {
  assert.equal(colConfig({}).points, 'off');
  assert.equal(colConfig({ [POINTS_ON_VAR]: '1' }).points, 'on');
  assert.deepEqual(usedCols(colConfig({ [POINTS_ON_VAR]: '1' })), COL_IDS);
  assert.equal(colConfig({ [POINTS_ON_VAR]: '1', $st_col_points: 'autohide' }).points, 'hide');
  assert.equal(colConfig({ [POINTS_ON_VAR]: '0', $st_col_points: 'on' }).points, 'on', '직접 「사용」');
  assert.equal(colConfig({ [POINTS_ON_VAR]: '1', $st_col_points: 'off' }).points, 'off', '직접 「사용 안 함」');
});

test('포인트 칸: 지침 절·파서·직전 상태 줄', () => {
  const s = statusSection(COL_IDS);
  assert.ok(s.includes('|identity|balance|points]') && s.includes('Points ='));
  assert.ok(s.includes('|백일몽/사원|1230000|0]'), '포인트 칸이 있으면 예시 신분도 백일몽');
  setStatusColumns({ [POINTS_ON_VAR]: '1' });
  const [t] = findStatusTags('[▣|2025.01.01|10:15 PM|🌫️|9°C|백일몽 본사|없음|없음|없음|백일몽/사원|1180000|900p]');
  assert.equal(t.identity, '백일몽/사원');
  assert.equal(t.wallet, '1180000');
  assert.equal(t.points, '900');
  setStatusColumns({});
  const [k] = findStatusTags('[▣|2025.01.01|10:15 PM|🌫️|9°C|백일몽 본사|없음|없음|없음|백일몽/사원|1180000|1,200 포인트]');
  assert.equal(k.points, '1200', '알려진 11칸 모양');
  const line = '[▣|2025.01.01|10:15 PM|🌫️|9°C|백일몽 본사|없음|없음|없음|백일몽/사원|1180000|900]';
  assert.equal(rebuildStatusLine(line, COL_IDS, { wallet: 1180000, points: 800 }), line.replace('|900]', '|800]'), '포인트는 장부 값이 이긴다');
  assert.equal(rebuildStatusLine(line, TEN, { wallet: 1180000 }), line.replace('|900]', ']'), '칸이 빠지면 줄에서도 빠짐');
});
