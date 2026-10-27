// 상태창 칸 정의 (설계안 7절): 칸 구성 읽기, 사용·표시, 구성 기록, 지침 절 조립, 칸 구성에 따른 파서
import test from 'node:test';
import assert from 'node:assert/strict';
import { colConfig, usedCols, hiddenCols, colLog, withColLog, setStatusColumns, shapeFor, formatStatusLine, statusSection, fillStatusSection, parseWalletCell, findStatusTags, rebuildStatusLine, withStatusBlock, STATUS_HEAD, COL_IDS } from '../dist-test/core.mjs';

test('칸 구성: 없으면 모두 on, 잠긴 칸(날짜·시각·위치)은 off 가 될 수 없다', () => {
  const cfg = colConfig({});
  assert.deepEqual(usedCols(cfg), COL_IDS);
  assert.equal(hiddenCols(cfg).size, 0);
  const c2 = colConfig({ $st_col_date: 'off', $st_col_weather: 'off', $st_col_temp: 'hide', $st_col_wallet: 'bogus' });
  assert.equal(c2.date, 'hide', '잠긴 칸을 끄면 숨김으로');
  assert.equal(c2.weather, 'off');
  assert.deepEqual(usedCols(c2), COL_IDS.filter((c) => c !== 'weather'));
  assert.deepEqual([...hiddenCols(c2)].sort(), ['date', 'temp', 'weather'], '안 쓰는 칸도 상자에서 숨김');
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
  const full = statusSection(COL_IDS);
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
  assert.equal(rebuildStatusLine(line, COL_IDS, { wallet: null }), '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|쟈알디|없음|없음|없음]');
  const ten = '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음|관리국/요원|5000]';
  assert.equal(rebuildStatusLine(ten, COL_IDS, { wallet: 7000 }), ten.replace('5000', '7000'), '잔고는 장부 값이 이긴다');
  assert.equal(rebuildStatusLine('[▣|이상한 줄]', COL_IDS, {}), '[▣|이상한 줄]', '읽지 못하면 그대로');
});

test('직전 상태 블록: 모양이 주어지면 그 칸 구성과 칸 이름을 적는다', () => {
  setStatusColumns({});
  const out = withStatusBlock([{ role: 'assistant', content: '글\n[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음]' }, { role: 'user', content: '입력' }], '관리국/신입', { cols: ['date', 'time', 'place', 'identity', 'wallet'], wallet: 300000 });
  const block = out.find((m) => m.content.startsWith(STATUS_HEAD)).content;
  assert.ok(block.includes('[▣|2025.01.01|02:47 AM|서울 종로구 거리|관리국/신입|300000]'));
  assert.ok(block.includes('Fields: 날짜 | 시각 | 위치 | 신분 | 잔고'));
});
