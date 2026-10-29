// 필드 출동 종료 → 보고서 (docs/설계안_기록_보고서.md 5-10절, core/journal/field.ts): 장부 사건 목록 → 경과·요원·거래·인물·소요, 같은 출동 중복 방지, 알림
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldReport, fieldLabel, fieldSummary, withFieldEvent, withFieldTrade, readWallet, walletVars, journalSettings, readJournal, readReports, recordVars, onReport, emitReport, lastReportNotice } from '../dist-test/core.mjs';

const ev = (id, kind, text, at, extra = {}) => ({ id, at, anchor: '#2', kind, text, ...extra });
const chatWith = (events, extra = {}) => {
  let chat = { message: [{ role: 'user', data: '시작' }, { role: 'char', data: '본문\n[▣|2025.01.01|10:20 AM|☀️|4°C|관리국 본부|없음]' }], scriptstate: {}, ...extra };
  for (const e of events) chat = withFieldEvent(chat, e);
  return chat;
};
const T0 = Date.UTC(2025, 0, 1, 1, 20);
const S = journalSettings({});
const BASE = 10 * 60 + 20;

test('필드 라벨: 투입 글 → 라벨, 없으면 종료 글에서', () => {
  assert.equal(fieldLabel('작전 투입: 젖은 복도', '작전 종료 (귀환): 젖은 복도, 처치 3, 부상 2'), '젖은 복도');
  assert.equal(fieldLabel(undefined, '작전 종료 (철수): 명일 아파트, 처치 0, 부상 9'), '명일 아파트');
  assert.equal(fieldLabel(undefined, '이상한 글'), '필드 출동');
});

test('필드 출동 하나 → 일지 fd 줄 + 전체 보고서 (경과·투입·결과·거래·소요), 같은 방문을 두 번 받아도 한 번', () => {
  const enter = ev('e1', 'enter_anomaly', '작전 투입: 젖은 복도', T0, { visit: 'v1' });
  const mid = [
    ev('e2', 'move', '3층으로 올라갔다', T0 + 60_000, { visit: 'v1', scene: '젖은 복도' }),
    ev('e3', 'kill', '그림자 둘을 처치했다', T0 + 5 * 60_000, { visit: 'v1', who: ['에일린'] }),
    ev('e4', 'hurt', '왼팔을 다쳤다', T0 + 9 * 60_000, { visit: 'v1' }),
    // 다른 방문의 사건은 경과에 안 들어간다
    ev('e5', 'move', '다른 방문', T0 + 10 * 60_000, { visit: 'v0' }),
  ];
  const exit = ev('e6', 'exit_anomaly', '작전 종료 (귀환): 젖은 복도, 처치 2, 부상 1', T0 + 84 * 60_000, { visit: 'v1' });
  let chat = chatWith([enter, ...mid, exit]);
  // 그 구간의 필드 거래 둘 + 구간 밖 하나
  let w = readWallet({}, 140000);
  w = withFieldTrade(w, '#2', 80000, '처리 수당', 'f1', { place: '젖은 복도' });
  w = withFieldTrade(w, '#2', -12500, '택시', 'f2');
  w.log = w.log.map((e) => ({ ...e, at: new Date(T0 + 30 * 60_000).toISOString() }));
  w = withFieldTrade(w, '#2', -5000, '다음 날 커피', 'f3');
  w.log[2].at = new Date(T0 + 500 * 60_000).toISOString();
  chat = { ...chat, scriptstate: { ...chat.scriptstate, ...walletVars(w) } };
  // 인물 변화 (src field, 같은 anchor·방문)
  chat.goeiPeopleV1 = {
    schema: 1, people: { 에일린: { name: '에일린', faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: {}, express: 1, aliases: [] } }, factions: {}, docs: {}, folded: {}, read: {}, pending: {}, ignored: [],
    log: [
      { id: 'c1', anchor: '#2', seq: 0, src: 'field', who: '에일린', kind: 'cue', cue: '도움', group: '#2|v1|젖은 복도', reason: '필드: 그림자 둘을 처치했다' },
      { id: 'c2', anchor: '#2', seq: 1, src: 'field', who: '에일린', kind: 'cue', cue: '실망', group: '#2|v0|', reason: '다른 방문' },
    ],
  };
  const catalog = { people: [{ id: 'P002', name: '에일린', english: 'Eileen' }] };
  const r = buildFieldReport({ chat, exit, player: '민준', site: '관리국 본부', catalog, baseMinute: BASE, settings: S, now: '2025-01-01T02:44:00.000Z' });
  assert.ok(r && r.added);
  const { row, report } = r;
  assert.equal(row.kind, 'fd');
  assert.equal(row.cause, 'field');
  assert.ok(row.mine && report.full && report.mine);
  assert.equal(row.name, '젖은 복도');
  assert.equal(row.loc, '관리국 본부');
  assert.equal(row.since, BASE);
  assert.equal(row.at, BASE + 84);
  assert.equal(report.head.duration, 84);
  assert.equal(row.idx, 1);
  assert.equal(row.anchor, '#2');
  assert.equal(report.statusKey, undefined, '필드 종료는 응답이 아니라 채팅 카드 열쇠가 없다');
  assert.deepEqual(report.trail.map((t) => t.text), ['작전 투입: 젖은 복도', '(이동) 3층으로 올라갔다', '(처치) 그림자 둘을 처치했다', '(부상) 왼팔을 다쳤다', '작전 종료 (귀환): 젖은 복도, 처치 2, 부상 1']);
  assert.deepEqual(report.trail.map((t) => t.m), [BASE, BASE + 1, BASE + 5, BASE + 9, BASE + 84]);
  assert.deepEqual(report.agents, [{ id: '', name: '민준', st: '' }, { id: 'P002', name: '에일린', st: '' }]);
  assert.equal(report.result, '작전 종료 (귀환): 젖은 복도, 처치 2, 부상 1');
  assert.deepEqual(report.wallet.map((t) => [t.memo, t.amount]), [['처리 수당', 80000], ['택시', -12500]]);
  assert.equal(report.balance, 140000 + 80000 - 12500 - 5000);
  assert.equal(report.people.length, 1);
  assert.ok(report.people[0].who === '에일린' && report.people[0].delta > 0 && report.people[0].quote.includes('처치'));
  assert.equal(report.no, 'RPT-0101-01');
  assert.equal(r.journal.rows.length, 1);
  assert.equal(r.reports.items.length, 1);
  assert.ok(fieldSummary(report).includes('민준 · 에일린') && fieldSummary(report).includes('1시간 24분'));
  // 저장 뒤 같은 exit 를 다시 받으면 새로 더하지 않는다
  const saved = { ...chat, scriptstate: { ...chat.scriptstate, ...recordVars(r.journal, r.reports) } };
  const again = buildFieldReport({ chat: saved, exit, player: '민준', site: '관리국 본부', catalog, baseMinute: BASE, settings: S });
  assert.ok(again && !again.added && again.report.id === report.id);
  assert.equal(readJournal(saved).rows.length, 1);
  assert.equal(readReports(saved).items.length, 1);
});

test('투입 사건이 없으면 종료 글만으로, 시각을 모르면 null', () => {
  const exit = ev('x1', 'exit_anomaly', '작전 종료 (철수): 명일 아파트, 처치 0, 부상 5', T0);
  const r = buildFieldReport({ chat: chatWith([exit]), exit, player: '', site: '관리국 본부', baseMinute: null, settings: S });
  assert.ok(r?.added);
  assert.equal(r.row.name, '명일 아파트');
  assert.equal(r.row.at, null);
  assert.equal(r.report.head.duration, null);
  assert.deepEqual(r.report.trail.map((t) => t.text), ['작전 종료 (철수): 명일 아파트, 처치 0, 부상 5']);
  assert.equal(r.report.agents[0].name, '주인공');
  assert.equal(buildFieldReport({ chat: chatWith([]), exit: { ...exit, kind: 'move' }, player: '', site: 'x', baseMinute: null, settings: S }), null, 'exit_anomaly 가 아니면 없음');
});

test('새 보고서 알림: 구독자에게 전해지고 마지막 알림이 남는다 (게임 다리 lastReport)', () => {
  const got = [];
  const off = onReport((n) => got.push(n.id));
  emitReport({ id: 'rX', cause: 'field', title: '젖은 복도', summary: '귀환 · 민준' });
  off();
  emitReport({ id: 'rY', cause: 'field', title: 'y', summary: '' });
  assert.deepEqual(got, ['rX']);
  assert.equal(lastReportNotice().id, 'rY');
});

test('같은 출동의 종료를 새 id 로 다시 받아도 (플러그인 다리가 두 번 불림) 보고서는 하나: 앞 종료 사건을 건너뛰고 같은 투입에 닿는다', () => {
  const enter = ev('e1', 'enter_anomaly', '작전 투입: 젖은 복도', T0, { visit: 'v1' });
  const kill = ev('e2', 'kill', '그림자를 처치했다', T0 + 60_000, { visit: 'v1', who: ['에일린'] });
  const exit1 = ev('x1', 'exit_anomaly', '작전 종료 (귀환): 젖은 복도, 처치 1, 부상 0', T0 + 5 * 60_000, { visit: 'v1' });
  let chat = chatWith([enter, kill, exit1]);
  const first = buildFieldReport({ chat, exit: exit1, player: '나', site: '관리국 본부', baseMinute: BASE, settings: S });
  assert.ok(first.added);
  chat = { ...chat, scriptstate: { ...chat.scriptstate, ...recordVars(first.journal, first.reports) } };
  const exit2 = ev('x2', 'exit_anomaly', '작전 종료 (귀환): 젖은 복도, 처치 1, 부상 0', T0 + 6 * 60_000, { visit: 'v1' });
  chat = withFieldEvent(chat, exit2);
  const again = buildFieldReport({ chat, exit: exit2, player: '나', site: '관리국 본부', baseMinute: BASE, settings: S });
  assert.equal(again.added, false, '같은 투입 → 같은 id → 더하지 않는다');
  assert.equal(again.report.id, first.report.id);
  assert.equal(readJournal(chat).rows.filter((r) => r.kind === 'fd').length, 1);
  assert.deepEqual(first.report.trail.map((t) => t.text), ['작전 투입: 젖은 복도', '(처치) 그림자를 처치했다', '작전 종료 (귀환): 젖은 복도, 처치 1, 부상 0']);
  // 새 투입 뒤의 종료는 새 출동
  const enter2 = ev('e9', 'enter_anomaly', '작전 투입: 명일 아파트', T0 + 10 * 60_000, { visit: 'v1' });
  const exit3 = ev('x3', 'exit_anomaly', '작전 종료 (철수): 명일 아파트, 처치 0, 부상 1', T0 + 15 * 60_000, { visit: 'v1' });
  chat = withFieldEvent(withFieldEvent(chat, enter2), exit3);
  const third = buildFieldReport({ chat, exit: exit3, player: '나', site: '관리국 본부', baseMinute: BASE, settings: S });
  assert.ok(third.added && third.report.id !== first.report.id && third.report.head.name === '명일 아파트');
  assert.deepEqual(third.report.trail.map((t) => t.text), ['작전 투입: 명일 아파트', '작전 종료 (철수): 명일 아파트, 처치 0, 부상 1'], '앞 출동의 사건·종료는 안 섞인다');
});
