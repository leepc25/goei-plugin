// 「기록」 자료·엔진 (docs/설계안_기록_보고서.md 묶음 1): 종료 → closed·일지·보고서, 경과 누적, 기간 자르기, 상한·고정·되감기, 설정, 컨텍스트 끼우기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCatalog, DEFAULT_SETTINGS, applyOutput, bootstrap, parseWorld, serializeWorld, endEvent, activeEvents, processOutput, startWorldVars, readWorld, locName,
  TRAIL_CAP, buildClosures, readJournal, readReports, rewindClosures, trimJournal, trimReports, pinReport, recordVars, journalSettings, JR, JR_DEFAULTS,
  journalBlock, withJournal, JOURNAL_HEAD, journalLine, mineReasons, periodOf, parseAgents, settings,
} from '../dist-test/core.mjs';
// 묶음 3: PNG 카드(순수 그리기)·소감 검사·저장
import { paintReport, wrapText, PNG_W, PNG_H, validateDebrief, withDebriefs, endedInBatch, endedNowOf, DEBRIEF_PROMPT, emptyReports } from '../dist-test/core.mjs';

const worldBook = {
  괴이: [
    [true, '소라 랜드', '소라 랜드', 'Sora Land', []],
    [true, '명일 아파트', '명일 아파트', 'Myeongil Apartment', []],
  ],
  '미스틱 사이트': [[true, '달빛 서점', '달빛 서점', 'Moon Books', []]],
  랜드마크: [[true, '관리국 본부', '관리국', '관리국', 'Bureau HQ', '02', '종로구', 52.6, 44.6, []]],
};
const roster = {
  version: 2,
  refill: 2,
  characters: [
    { id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: [], affiliation: 'A00', rank: '팀장', department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] },
    { id: 'P002', name: '스팡달', english: 'Spangdal', lore: '스팡달', aliases: [], affiliation: 'A00', rank: '요원', department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] },
  ],
};
const catalog = parseCatalog([
  { comment: 'World catalog', content: JSON.stringify(worldBook) },
  { comment: 'Agent roster', content: JSON.stringify(roster) },
]);
// 발생 추첨은 끈다 (종료만 본다)
const S = { ...DEFAULT_SETTINGS, preset_p: 0, random_p: 0, incident_p: 0, mystic_p: 0, agent_limit: 2 };
const rng = () => 0.99;

const ST = (time, target = '없음', companions = '없음', deployed = '없음') => `[▣|2025.01.01|${time}|☀️|4°C|서울 종로구 거리|${target}|${companions}|${deployed}]`;
const IN = (state, deploy, situation) => `[IN|서울 종로구|관리국 본부|${state}|${deploy}|${situation}]`;
const empty = () => bootstrap(catalog, S, rng);

// ── 엔진: closed · trail · touched ──

test('모델 태그 종료가 closed 에 원인과 종료 직전 모습으로 쌓이고, 저장 JSON 에는 closed 가 없다', () => {
  let w = applyOutput(empty(), catalog, S, 'A00', `${IN('진행', 'P001', '정전')}\n${ST('10:00 AM')}`, rng).world;
  assert.equal(w.closed.length, 0);
  w = applyOutput(w, catalog, S, 'A00', `${IN('진행', 'P001', '복구 중')}\n${ST('11:00 AM')}`, rng).world;
  w = applyOutput(w, catalog, S, 'A00', `${IN('종료', 'P001', '복구 완료')}\n${ST('12:00 PM')}`, rng).world;
  assert.equal(w.inc.length, 0);
  assert.equal(w.closed.length, 1);
  const c = w.closed[0];
  assert.equal(c.kind, 'in');
  assert.equal(c.cause, 'model');
  assert.equal(c.entry.name, '관리국 본부');
  assert.equal(c.entry.deploy, 'P001');
  assert.deepEqual(c.entry.trail.map((t) => t.text), ['정전', '복구 중'], '경과는 상황 글이 바뀐 시점만');
  assert.equal(c.minute, w.minute);
  const saved = serializeWorld(w);
  assert.ok(!saved.includes('"closed"'));
  assert.equal(parseWorld(saved).closed, undefined);
  assert.equal('closed' in parseWorld(JSON.stringify({ ...JSON.parse(saved), closed: [{}] })), false, '옛 저장에 섞인 closed 는 버린다');
});

test('괴이 클리어는 cleared 로, 발생대기 종료는 closed 에 안 쌓인다', () => {
  const w0 = bootstrap(catalog, { ...S, preset_p: 100 }, () => 0);
  assert.equal(w0.an[0].state, '발생대기');
  const pend = applyOutput(w0, catalog, S, 'A00', `[AN|${locName(w0.an[0].loc)}|소라 랜드|소멸|B|없음|끝]\n${ST('10:00 AM')}`, rng).world;
  assert.equal(pend.closed.length, 0, '시작도 안 한 것은 일지에 남기지 않는다');
  let w = applyOutput(empty(), catalog, S, 'A00', `[AN|서울 종로구|소라 랜드|활성|B|P001|소리가 들림]\n${ST('10:00 AM', '소라 랜드')}`, rng).world;
  assert.equal(w.an.length, 1);
  assert.equal(w.an[0].touched, true, '상태창 목표 칸이 이 괴이였다');
  w = applyOutput(w, catalog, S, 'A00', `[AN|서울 종로구|소라 랜드|클리어|B|P001|정리됨]\n${ST('11:00 AM')}`, rng).world;
  assert.equal(w.closed.length, 1);
  assert.equal(w.closed[0].cleared, true);
  assert.equal(w.closed[0].entry.touched, true);
});

test('자동 종료(ttl)는 cause ttl, 손으로 끝내면 manual', () => {
  let w = applyOutput(empty(), catalog, S, 'A00', `${IN('진행', 'P001', '정전')}\n${ST('10:00 AM')}`, rng).world;
  // incident_ttl 12시간: 13시간 뒤 상태창
  w = applyOutput(w, catalog, S, 'A00', `[▣|2025.01.01|11:00 PM|☀️|4°C|서울|없음|없음|없음]`, rng).world;
  assert.equal(w.inc.length, 0);
  assert.equal(w.closed[0]?.cause, 'ttl');
  let m = applyOutput(empty(), catalog, S, 'A00', `[MS|부산 중구|달빛 서점|출현|P002|책이 넘어감]\n${ST('10:00 AM', '달빛 서점')}`, rng).world;
  assert.equal(m.ms[0].touched, true);
  const key = activeEvents(m).find((e) => e.kind === 'ms').key;
  assert.equal(endEvent(m, key), true);
  assert.equal(m.closed[0].cause, 'manual');
  assert.equal(m.closed[0].kind, 'ms');
  assert.equal(m.closed[0].entry.visitors, 'P002');
});

test('경과는 같은 글을 거듭 쌓지 않고 상한을 넘으면 첫 줄은 두고 둘째부터 지운다', () => {
  let w = applyOutput(empty(), catalog, S, 'A00', `${IN('진행', 'P001', '첫 발견')}\n${ST('10:00 AM')}`, rng).world;
  w = applyOutput(w, catalog, S, 'A00', `${IN('진행', 'P001', '첫 발견')}\n${ST('10:10 AM')}`, rng).world;
  assert.equal(w.inc[0].trail.length, 1);
  for (let i = 0; i < TRAIL_CAP + 5; i++) w = applyOutput(w, catalog, S, 'A00', `${IN('진행', 'P001', `상황 ${i}`)}\n${ST('10:10 AM')}`, rng).world;
  assert.equal(w.inc[0].trail.length, TRAIL_CAP);
  assert.equal(w.inc[0].trail[0].text, '첫 발견');
  assert.equal(w.inc[0].trail.at(-1).text, `상황 ${TRAIL_CAP + 4}`);
  // 사건 태그가 상황 칸을 비우면 쌓지 않는다
  w = applyOutput(w, catalog, S, 'A00', `[IN|서울 종로구|관리국 본부|진행|P001]\n${ST('10:10 AM')}`, rng).world;
  assert.equal(w.inc[0].trail.length, TRAIL_CAP);
  assert.equal(w.inc[0].situation, '');
});

// ── 조립: processOutput 으로 끝까지 ──

/** 상황판이 켜진 채팅: 응답을 차례로 반영한다 (리스너가 부르는 processOutput 과 같은 길) */
function play(turns, extra = {}) {
  let chat = { message: [], scriptstate: { ...startWorldVars(catalog, S, 'A00', rng), $st_faction: 'A00', ...(extra.vars ?? {}) }, ...(extra.top ?? {}) };
  for (const t of turns) {
    if (typeof t === 'string' || t.role === 'user') {
      chat = { ...chat, message: [...chat.message, typeof t === 'string' ? { role: 'user', data: t } : t] };
      continue;
    }
    chat = { ...chat, message: [...chat.message, { role: 'char', data: t.data }] };
    if (extra.before) chat = extra.before(chat) ?? chat;
    const next = processOutput(chat, chat.message.length - 1, t.data, catalog, S, rng);
    if (next) chat = next;
  }
  return chat;
}
const C = (data) => ({ role: 'char', data });
// 출동 지시문 카드 (core/dispatch sceneRecord 와 같은 모양): 목표 관리국 본부
const hex = (s) => Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
const SCENE = `%%SCENE_CARD:${hex(JSON.stringify({ target: '관리국 본부', party: '나, 쟈알디' }))}%%\nSubject: 관리국 본부\n%%/SCENE_CARD%%`;

const PEOPLE = { goeiPeopleV1: { schema: 1, people: { 사장: { name: '사장', faction: 'C00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 10 }, address: { toUser: '', register: '존댓말' }, express: 1, aliases: [] }, 잼트리: { name: '잼트리', faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '', register: '존댓말' }, express: 1, aliases: [] } }, factions: {}, docs: {}, log: [
  { id: 'c1', anchor: '#4', seq: 0, src: 'story', who: '사장', kind: 'cue', cue: '도움', quote: '고맙소', reason: '도왔다' },
  { id: 'c2', anchor: '#4', seq: 1, src: 'story', who: '사장', kind: 'cue', cue: '작은친절', reason: '인사' },
  { id: 'c3', anchor: '#2', seq: 0, src: 'story', who: '잼트리', kind: 'cue', cue: '큰도움', reason: '기간 밖' },
  { id: 'c4', anchor: '#4', seq: 2, src: 'story', who: '세력:B00', kind: 'cue', cue: '실망', reason: '세력은 안 넣음' },
], folded: {}, read: {}, pending: {}, ignored: [] } };
const WALLET = JSON.stringify({ start: 140000, log: [
  { id: 'w1', anchor: '#4', amount: 50000, memo: '수당', src: 'story', quote: '5만 원', at: '2025-01-01T00:00:00Z' },
  { id: 'w2', anchor: '#2', amount: -3000, memo: '기간 밖 커피', src: 'story', at: '2025-01-01T00:00:00Z' },
  { id: 'w3', anchor: '', amount: 1000, memo: '수동', src: 'manual', at: '2025-01-01T00:00:00Z' },
  { id: 'w4', anchor: '#9', amount: -99999, memo: '아직 없는 메시지', src: 'story', at: '2025-01-01T00:00:00Z' },
] });

// 번호: 0 user · 1 char(기간 밖 응답) · 2 user(출동 카드) · 3 char(활성, 상황 A) · 4 user · 5 char(상황 B, 투입) · 6 user · 7 char(종료)
const MINE_TURNS = [
  '시작',
  C(`평범한 아침.\n${ST('09:00 AM')}`),
  { role: 'user', data: SCENE },
  C(`사건 발생. 사장이 "고맙소" 하고 말했다.\n${IN('진행', 'P001', '정전')}\n[AG|P001|작전투입|현장]\n${ST('10:00 AM', '관리국 본부', '쟈알디', '투입')}`),
  '진입한다',
  C(`복구 중.\n${IN('진행', 'P001, P002', '복구 중')}\n${ST('11:00 AM', '관리국 본부', '쟈알디', '투입')}`),
  '마무리한다',
  C(`끝.\n${IN('종료', 'P001, P002', '복구 완료')}\n[AG|P001|휴게|복귀]\n[AG|P002|부상|치료 중]\n${ST('12:30 PM', '없음', '없음', '없음')}`),
];

test('내가 출동한 사건이 종료되면 일지 줄과 전체 보고서(경과·요원·결과·인물·가계부·잔고)가 생긴다', () => {
  const chat = play(MINE_TURNS, { top: PEOPLE, vars: { $st_wallet: WALLET } });
  const j = readJournal(chat);
  assert.equal(j.rows.length, 1);
  const row = j.rows[0];
  assert.equal(row.kind, 'in');
  assert.equal(row.name, '관리국 본부');
  assert.equal(row.mine, true);
  assert.equal(row.cause, 'model');
  assert.equal(row.idx, 7);
  assert.equal(row.anchor, '#8');
  assert.equal(row.result, '복구 중', '결과 = 마지막 상황 글 (종료 태그의 글은 반영 전이라 안 들어간다)');
  assert.deepEqual(row.agents, [{ id: 'P001', name: '쟈알디', st: '휴게' }, { id: 'P002', name: '스팡달', st: '부상' }]);
  assert.equal(row.at - row.since, 150, '10:00 → 12:30');
  const r = readReports(chat);
  assert.equal(r.items.length, 1);
  const rep = r.items[0];
  assert.equal(rep.id, row.rpt);
  assert.equal(rep.full, true);
  assert.match(rep.no, /^RPT-0101-01$/);
  assert.equal(rep.head.duration, 150);
  assert.equal(rep.head.place, '서울 종로구 거리');
  assert.deepEqual(rep.trail.map((t) => t.text), ['정전', '복구 중']);
  assert.equal(rep.agents[1].situation, '치료 중');
  assert.equal(rep.statusKey, ST('12:30 PM', '없음', '없음', '없음'));
  // 인물: 기간(3~7) 안 살아 있는 cue 만 (인용이 본문에 있어야 산다), 세력 평판은 빼고, 합과 근거 인용
  assert.deepEqual(rep.people.map((p) => [p.who, p.delta, p.quote, p.cue]), [['사장', 4, '고맙소', '도움']]);
  assert.equal(rep.people[0].stage, '무관심');
  // 가계부: 기간 안 거래만, 수동 조정은 잔고에만, 종료 뒤 거래는 빠짐
  assert.deepEqual(rep.wallet, [{ memo: '수당', amount: 50000, quote: '5만 원' }]);
  assert.equal(rep.balance, 140000 - 3000 + 50000 + 1000);
  // 세계 저장값에는 종료 전 trail·startKey 가 남고 closed 는 없다
  const w = readWorld(chat);
  assert.equal(w.closed, undefined);
  assert.ok(!chat.scriptstate.$goei_world.includes('closed'));
});

test('출동 근거 다섯 가지를 따로 판정한다', () => {
  const base = play(MINE_TURNS.slice(0, 6));
  const s = (o = {}) => ({ name: '관리국 본부', agentNames: ['쟈알디'], ...o });
  assert.deepEqual(mineReasons(base, 3, 5, s()).sort(), ['companion', 'deployed', 'scene']);
  // 출동 카드는 활성 응답 바로 앞 유저 메시지에 있어도 잡는다 (from-1)
  assert.ok(mineReasons({ ...base, message: base.message.map((m, i) => (i === 3 || i === 5 ? { ...m, data: m.data.replace(/\[▣[^\]]*\]/g, '') } : m)) }, 3, 5, s()).includes('scene'));
  assert.deepEqual(mineReasons(base, 4, 5, { name: '다른 사건', agentNames: ['스팡달'] }), []);
  assert.deepEqual(mineReasons(base, 4, 5, { name: '다른 사건', agentNames: [], touched: true }), ['touched']);
  const field = { ...base, goeiFieldV1: { events: [{ id: 'f1', at: 1, anchor: '#6', kind: 'enter_anomaly', text: '작전 투입: 관리국 본부' }] } };
  assert.ok(mineReasons(field, 4, 5, { name: '관리국 본부', agentNames: [] }).includes('field'));
  assert.ok(!mineReasons(field, 0, 1, { name: '관리국 본부', agentNames: [] }).includes('field'), '기간 밖 필드 사건은 근거가 아니다');
  // 기간: startKey 가 있으면 그 메시지, 없으면 since 분 이상인 첫 상태창 응답, 그것도 없으면 종료 메시지
  const w = readWorld(base);
  assert.equal(w.inc[0].startKey, '#4');
  assert.deepEqual(periodOf(base, 5, w.inc[0]), { from: 3, to: 5 });
  assert.deepEqual(periodOf(base, 5, { since: w.inc[0].since }), { from: 3, to: 5 });
  assert.deepEqual(periodOf(base, 5, { since: null }), { from: 5, to: 5 });
  assert.deepEqual(periodOf(base, 9, { since: null }), { from: 5, to: 5 }, '번호가 넘치면 마지막 메시지');
  assert.deepEqual(parseAgents('P001, 교황청, 없음', w, catalog, 'A00'), [{ id: 'P001', name: '쟈알디', st: '작전투입', situation: '현장' }, { id: '', name: '교황청', st: '' }]);
});

test('백그라운드 사건은 간이 보고서(인물·가계부 없음)로, 상태창 없는 응답이면 채팅 카드 열쇠도 없다', () => {
  const chat = play([
    '시작',
    C(`사건.\n${IN('진행', 'P002', '정전')}`),
    '다른 일',
    C(`끝.\n${IN('종료', 'P002', '복구')}`),
  ], { top: PEOPLE, vars: { $st_wallet: WALLET } });
  const row = readJournal(chat).rows[0];
  assert.equal(row.mine, false);
  const rep = readReports(chat).items[0];
  assert.equal(rep.full, false);
  assert.equal(rep.people, undefined);
  assert.equal(rep.wallet, undefined);
  assert.equal(rep.balance, undefined);
  assert.equal(rep.statusKey, undefined);
  assert.equal(rep.head.at, null, '분을 모르면 null');
  assert.equal(rep.result, '정전');
  assert.deepEqual(rep.agents, [{ id: 'P002', name: '스팡달', st: '' }]);
  assert.equal(journalLine(row), '- 시각 없음 · 사건 관리국 본부 · 서울특별시 종로구 · 투입 스팡달 · 정전');
});

test('리롤 되감기: 같은 번호의 응답을 다시 반영하면 그 응답의 자동 종료 기록은 지워지고 수동 종료는 남는다', () => {
  let chat = play(MINE_TURNS);
  assert.equal(readJournal(chat).rows.length, 1);
  // 같은 자리에 종료 없는 응답
  const i = chat.message.length - 1;
  const again = `아직 복구 중.\n${IN('진행', 'P001', '마저 복구')}\n${ST('12:30 PM')}`;
  chat = processOutput({ ...chat, message: chat.message.map((m, k) => (k === i ? { ...m, data: again } : m)) }, i, again, catalog, S, rng);
  assert.equal(readJournal(chat).rows.length, 0);
  assert.equal(readReports(chat).items.length, 0);
  assert.equal(readWorld(chat).inc.length, 1);
  // 손으로 끝낸 것 (ui/field.ts saveWorld 길): manual 줄은 되감기 대상이 아니다
  const w = readWorld(chat);
  endEvent(w, activeEvents(w)[0].key);
  const built = buildClosures({ chat, index: i, world: w, closed: w.closed, catalog, faction: 'A00', settings: journalSettings(chat.scriptstate), now: '2025-01-01T00:00:00.000Z' });
  assert.equal(built.rows[0].cause, 'manual');
  assert.equal(built.rows[0].mine, true);
  const r = rewindClosures(built.journal, built.reports, i);
  assert.equal(r.changed, false);
  assert.equal(r.journal.rows.length, 1);
  // 같은 종료를 두 번 반영해도 한 줄
  const twice = buildClosures({ chat: { ...chat, scriptstate: { ...chat.scriptstate, ...recordVars(built.journal, built.reports) } }, index: i, world: w, closed: w.closed, catalog, faction: 'A00', settings: journalSettings(chat.scriptstate) });
  assert.equal(twice.rows.length, 0);
  assert.equal(twice.journal.rows.length, 1);
});

// ── 저장: 상한·고정·연결 ──

const fakeRow = (n, extra = {}) => ({ id: `j${n}`, kind: 'in', name: `사건 ${n}`, loc: '02-6', at: n, since: 0, born: 0, idx: n, anchor: `#${n}`, mine: false, cause: 'model', agents: [], result: '처리 완료', rpt: `r${n}`, ...extra });
const fakeReport = (n, extra = {}) => ({ id: `r${n}`, no: `RPT-0101-0${n}`, full: false, mine: false, kind: 'in', cause: 'model', head: { name: `사건 ${n}`, loc: '02-0', born: 0, since: 0, at: n, duration: n }, trail: [], agents: [], result: '처리 완료', idx: n, anchor: `#${n}`, savedAt: 'x', ...extra });

test('상한: 일지는 오래된 줄부터, 보고서는 고정 안 된 것 가운데 오래된 것부터 지우고 줄의 rpt 를 끊는다', () => {
  const j = { v: 1, rows: [1, 2, 3, 4, 5].map((n) => fakeRow(n)) };
  assert.deepEqual(trimJournal(j, 3).rows.map((r) => r.id), ['j3', 'j4', 'j5']);
  assert.equal(trimJournal(j, 5), j);
  let r = { v: 1, items: [1, 2, 3, 4, 5].map((n) => fakeReport(n)) };
  r = pinReport(r, 'r1', true);
  const t = trimReports(r, j, 2);
  assert.deepEqual(t.reports.items.map((x) => x.id), ['r1', 'r4', 'r5']);
  assert.deepEqual(t.removed, ['r2', 'r3']);
  assert.deepEqual(t.journal.rows.map((x) => x.rpt), ['r1', undefined, undefined, 'r4', 'r5'], '지워진 보고서를 가리키던 줄은 남고 연결만 끊긴다');
  assert.equal(pinReport(r, '없음', true), r);
  assert.equal(pinReport(r, 'r1', false).items[0].pin, undefined);
  // 되감기는 고정한 보고서와 그 줄을 둔다
  const rw = rewindClosures(j, r, 1);
  assert.ok(rw.journal.rows.some((x) => x.id === 'j1') && rw.reports.items.some((x) => x.id === 'r1'));
  const rw2 = rewindClosures(j, r, 2);
  assert.ok(!rw2.journal.rows.some((x) => x.id === 'j2') && !rw2.reports.items.some((x) => x.id === 'r2'));
  // 깨진 값은 빈 저장소, 깨진 줄은 버림
  assert.deepEqual(readJournal({ $goei_journal: '{bad' }).rows, []);
  assert.deepEqual(readReports({ message: [], scriptstate: { $goei_reports: JSON.stringify({ v: 1, items: [fakeReport(1), { id: 'x' }, null] }) } }).items.map((x) => x.id), ['r1']);
  assert.deepEqual(readJournal({ $goei_journal: JSON.stringify({ v: 1, rows: [fakeRow(1), { id: 'bad' }] }) }).rows.map((x) => x.id), ['j1']);
});

test('상한 설정대로 조립 때 잘린다', () => {
  const rows = [1, 2, 3].map((n) => fakeRow(n));
  const items = [1, 2, 3].map((n) => fakeReport(n));
  const w = applyOutput(empty(), catalog, S, 'A00', `${IN('진행', 'P001', '정전')}\n${ST('10:00 AM')}`, rng).world;
  endEvent(w, activeEvents(w)[0].key);
  const chat = { message: [{ role: 'user', data: '시작' }, { role: 'char', data: `글\n${ST('10:00 AM')}` }], scriptstate: { ...recordVars({ v: 1, rows }, { v: 1, items }), [JR('journal_cap')]: '100', [JR('report_cap')]: '20' } };
  const built = buildClosures({ chat, index: 1, world: w, closed: w.closed, catalog, faction: 'A00', settings: { ...journalSettings(chat.scriptstate), journalCap: 2, reportCap: 1 } });
  assert.deepEqual(built.journal.rows.map((r) => r.name), ['사건 3', '관리국 본부']);
  assert.equal(built.reports.items.length, 1);
  assert.equal(built.reports.items[0].id, built.rows[0].rpt);
  assert.equal(built.reports.items[0].no, 'RPT-0101-04', '그 날짜의 순번은 지워진 것 뒤로 이어진다');
  assert.equal(built.journal.rows[0].rpt, undefined, '밀려난 보고서 연결은 끊긴다');
});

// ── 설정 ──

test('기록 설정: 기본값·경계값·글자', () => {
  const d = journalSettings(undefined);
  assert.deepEqual(d, { chatCard: 'mine', ctx: 0, debriefAuto: true, journalCap: 500, reportCap: 100 });
  assert.equal(JR_DEFAULTS.chat_card, 'mine');
  const s = journalSettings({ [JR('chat_card')]: 'off', [JR('ctx')]: '999', [JR('debrief_auto')]: '0', [JR('journal_cap')]: '-5', [JR('report_cap')]: 'abc' });
  assert.deepEqual(s, { chatCard: 'off', ctx: 50, debriefAuto: false, journalCap: 100, reportCap: 100 });
  assert.equal(journalSettings({ [JR('chat_card')]: 'all' }).chatCard, 'all');
  assert.equal(journalSettings({ [JR('chat_card')]: 'weird' }).chatCard, 'mine');
  assert.equal(journalSettings({ [JR('ctx')]: '0' }).ctx, 0, '0 은 고른 값(끔)');
  assert.equal(journalSettings({ [JR('ctx')]: '7.9' }).ctx, 7);
  for (const k of ['$jr_chat_card', '$jr_ctx', '$jr_debrief_auto', '$jr_journal_cap', '$jr_report_cap']) assert.ok(settings.PREF_VAR.test(k), `${k} 는 「기본값으로 저장」 범위`);
  assert.ok(!settings.PREF_VAR.test('$goei_journal'), '기록 자체는 설정이 아니다');
});

// ── 컨텍스트 끼우기 ──

test('일지 컨텍스트: 끔이면 요청 그대로, 켜면 최근 N건 한 줄씩을 마지막 사용자 메시지 앞 system 블록으로', () => {
  const chat = play(MINE_TURNS);
  const rows = [...readJournal(chat).rows, fakeRow(9, { name: '둘째 {{사건}} %%', mine: false, at: 60 * 24 * 10, agents: [{ id: '', name: '외부인', st: '' }] })];
  const msgs = [{ role: 'system', content: '지침' }, { role: 'user', content: '첫 말' }, { role: 'assistant', content: '응답' }, { role: 'user', content: '다음 행동' }];
  assert.deepEqual(withJournal(msgs, chat), msgs, '기본(끔)이면 아무것도 안 넣는다');
  assert.equal(journalBlock(rows, 0), '');
  assert.equal(journalBlock([], 5), '');
  const on = { ...chat, scriptstate: { ...chat.scriptstate, ...recordVars({ v: 1, rows }, { v: 1, items: [] }), [JR('ctx')]: '1' } };
  const out = withJournal(msgs, on);
  assert.equal(out.length, 5);
  assert.equal(out[3].role, 'system');
  assert.equal(out[4].content, '다음 행동');
  assert.ok(out[3].content.startsWith(`${JOURNAL_HEAD} 최근 1건`), out[3].content);
  assert.ok(out[3].content.includes('둘째 ｛｛사건｝｝ ％％'), '템플릿 기호는 막는다');
  assert.ok(!out[3].content.includes('관리국 본부'), 'N=1 이면 최근 한 줄만');
  const two = journalBlock(rows, 5).split('\n');
  assert.equal(two.length, 3, '머리 + 2줄 (N 이 줄 수보다 커도 있는 만큼)');
  assert.equal(two[1], '- 01.01 12:30 · 사건 관리국 본부 · 서울특별시 종로구 · 투입 쟈알디·스팡달 · 복구 중 (내가 출동)');
  assert.equal(two[2], '- 01.11 00:00 · 사건 둘째 ｛｛사건｝｝ ％％ · 서울특별시 종로구 · 투입 외부인 · 처리 완료');
  // 채팅 메시지는 손대지 않는다
  assert.equal(on.message.length, chat.message.length);
});

// ── 묶음 3: PNG 카드 (core/journal/png.ts 순수 그리기) ──

/** 캔버스 2D 흉내: 호출을 기록만 한다. 글자 폭은 글자 수 × 8 */
function fakeCtx() {
  const calls = [];
  const g = { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'top', globalAlpha: 1, calls };
  for (const m of ['fillRect', 'fillText', 'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'closePath', 'fill', 'stroke', 'save', 'restore', 'clip', 'drawImage']) g[m] = (...a) => void calls.push([m, ...a]);
  g.measureText = (t) => ({ width: [...String(t)].length * 8 });
  return g;
}
const COLORS = { void: '#111', panel: '#222', line: '#333', text: '#eee', sub: '#ccc', dim: '#999', signal: '#5ee', amber: '#fb4', danger: '#f76', accentBg: '#143' };
const pngReport = (over = {}) => ({
  id: 'r1', no: 'RPT-0101-01', full: true, mine: true, kind: 'an', cause: 'model',
  head: { name: '소라 랜드', grade: 'B', loc: '02-0', place: '종로 지하상가', born: 60 * 24 * 365 * 55 + 17 * 60, since: 60 * 24 * 365 * 55 + 17 * 60 + 13, at: 60 * 24 * 365 * 55 + 19 * 60, duration: 107 },
  trail: Array.from({ length: 11 }, (_, i) => ({ m: 60 * 24 * 365 * 55 + 17 * 60 + i * 5, e: i, text: `경과 ${i + 1} 상황 글이 바뀌었다` })),
  agents: [{ id: 'P001', name: '쟈알디', st: '작전투입', situation: '현장' }, { id: 'P002', name: '스팡달', st: '부상' }],
  result: '격리 완료. 현장 봉쇄 해제 '.repeat(12),
  people: [{ who: '쟈알디', delta: 6, quote: '수고했네', stage: '신뢰' }, { who: '스팡달', delta: -2 }],
  wallet: [{ memo: '처리 수당', amount: 80000 }, { memo: '택시', amount: -12500 }],
  balance: 207500, idx: 3, anchor: '#4', savedAt: '2025-01-01T00:00:00.000Z', ...over,
});

test('PNG 카드: 바탕 900×1200 부터, 머리·그림 틀·제목·시각 타일·경과(8줄+외 N건)·요원·인물·결과·가계부·바닥글 순서, 간이는 인물·가계부 없음', () => {
  assert.equal(PNG_W, 900);
  assert.equal(PNG_H, 1200);
  const g = fakeCtx();
  const r = paintReport(g, pngReport(), { colors: COLORS, sans: 'sans-serif', mono: 'monospace', art: null, org: '관리국 종합대응팀' });
  assert.deepEqual(g.calls[0], ['fillRect', 0, 0, 900, 1200], '첫 호출이 바탕 전체');
  assert.deepEqual(r.sections, ['bg', 'head', 'art-empty', 'title', 'tiles', 'trail', 'agents', 'result', 'people', 'wallet', 'foot']);
  const texts = g.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  for (const t of ['괴이 ː ANOMALY', 'INCIDENT REPORT · RPT-0101-01', '소라 랜드', '내가 출동', '발생', '투입', '종료', '소요', '1h 47m', '경과', '… 외 5건', '투입 요원', '쟈알디', '스팡달', '인물 기록 변화', '+6 → 신뢰', '−2', '결과', '가계부', '처리 수당', '+80,000', '−12,500', '종료 시점 잔고', '₩ 207,500', 'ANOMALY SIMULATION 2.4']) {
    assert.ok(texts.some((x) => x.includes(t)), `글: ${t}`);
  }
  assert.equal(texts.filter((x) => /^경과 \d+ /.test(x)).length, 6, '경과 최대 6줄');
  assert.ok(!g.calls.some((c) => c[0] === 'drawImage'), '그림이 없으면 drawImage 없음');
  assert.ok(texts.every((t) => !/\{\{|%%/.test(t)));
  // 바닥글은 늘 같은 자리 (y = 1200 − 48 − 28)
  const foot = g.calls.find((c) => c[0] === 'fillText' && c[1] === 'ANOMALY SIMULATION 2.4');
  assert.deepEqual(foot.slice(2), [48, 1124]);
  // 간이 보고서: 인물·가계부 구역 없음, 「요원 처리」 배지
  const g2 = fakeCtx();
  const r2 = paintReport(g2, pngReport({ full: false, mine: false, people: undefined, wallet: undefined, balance: undefined, debrief: { who: '쟈알디', text: '힘들었다.', src: 'turn', at: '2025-01-01' } }), { colors: COLORS, sans: 'sans-serif', mono: 'monospace' });
  assert.deepEqual(r2.sections, ['bg', 'head', 'art-empty', 'title', 'tiles', 'trail', 'agents', 'result', 'debrief', 'foot']);
  const texts2 = g2.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  assert.ok(texts2.includes('요원 처리') && texts2.includes('쟈알디 소감') && texts2.includes('힘들었다.'));
  assert.ok(!texts2.includes('가계부') && !texts2.includes('인물 기록 변화'));
  // 그림이 있으면 틀 안에 꽉 차게 (clip → drawImage → restore), 가로 804 틀에 1600×900 그림
  const g3 = fakeCtx();
  const r3 = paintReport(g3, pngReport(), { colors: COLORS, sans: 'sans-serif', mono: 'monospace', art: { img: 'IMG', w: 1600, h: 900 } });
  assert.ok(r3.sections.includes('art'));
  const di = g3.calls.findIndex((c) => c[0] === 'drawImage');
  assert.ok(di > 0 && g3.calls.slice(0, di).some((c) => c[0] === 'clip') && g3.calls[di + 1][0] === 'restore', '자르기 → 그림 → 복원');
  const [, img, , , dw, dh] = g3.calls[di];
  assert.equal(img, 'IMG');
  assert.ok(Math.abs(dw - 1600 * Math.max(804 / 1600, 170 / 900)) < 1e-6 && dh >= 170, `꽉 채움 ${dw}×${dh}`);
});

test('PNG 줄바꿈: 글자 단위, 최대 줄 수를 넘으면 마지막 줄 끝에 …', () => {
  const g = fakeCtx();
  assert.deepEqual(wrapText(g, '', 100, 3), []);
  assert.deepEqual(wrapText(g, '가나다라마바사아자차', 40, 3), ['가나다라마', '바사아자차']);
  assert.deepEqual(wrapText(g, '가나다라마바사아자차카타파하', 40, 2), ['가나다라마', '바사아자…']);
  assert.deepEqual(wrapText(g, '짧다', 400, 1), ['짧다']);
});

// ── 묶음 3: 소감 검사·저장 (core/journal/debrief.ts) ──

test('소감 검사: 이번 턴 종료 사건 id·투입 요원 이름·본문 규칙, 사건당 1건, manual 만 덮어쓴다', () => {
  const rep = pngReport();
  const ended = [endedNowOf(rep)];
  assert.deepEqual(ended[0].agents, ['쟈알디', '스팡달']);
  assert.equal(ended[0].trail_tail.length, 3);
  assert.equal(ended[0].kind, '괴이');
  assert.ok(ended[0].loc.includes('종로 지하상가'));
  assert.equal(validateDebrief({ id: 'r9', who: '쟈알디', text: '현장은 조용했다. 다들 수고했다.' }, ended).ok, false);
  assert.equal(validateDebrief({ id: 'r1', who: '쟈알디', text: '' }, ended).ok, false);
  assert.equal(validateDebrief({ id: 'r1', who: '쟈알디', text: '{{user}} 덕분이다. 고맙다.' }, ended).ok, false);
  assert.equal(validateDebrief(null, ended).ok, false);
  const okOne = validateDebrief({ id: 'r1', who: '스팡달', text: '  팔이 아직  욱신거린다.\n그래도 다 끝났다. ' }, ended);
  assert.ok(okOne.ok && okOne.value.who === '스팡달' && okOne.value.text === '팔이 아직 욱신거린다. 그래도 다 끝났다.');
  const unknownWho = validateDebrief({ id: 'r1', who: '모르는사람', text: '현장은 조용했다. 다들 수고했다.' }, ended);
  assert.ok(unknownWho.ok && unknownWho.value.who === '쟈알디', '모르는 이름이면 첫 요원');
  const long = validateDebrief({ id: 'r1', who: '쟈알디', text: '가'.repeat(500) }, ended);
  assert.ok(long.ok && long.value.text.length === 300, '300자에서 자름');
  // 저장: 없는 id 무시, 같은 id 둘이면 첫 것, 있던 소감은 turn/backfill 로 안 덮고 manual 로는 덮는다
  const store = { ...emptyReports(), items: [rep, { ...rep, id: 'r2', no: 'RPT-0101-02' }] };
  const w1 = withDebriefs(store, [{ id: 'r1', who: '쟈알디', text: '첫 소감' }, { id: 'r1', who: '스팡달', text: '둘째' }, { id: 'r9', who: 'x', text: '없는 사건' }], 'turn', '2025-01-02T00:00:00.000Z');
  assert.equal(w1.applied, 1);
  assert.deepEqual(w1.store.items[0].debrief, { who: '쟈알디', text: '첫 소감', src: 'turn', at: '2025-01-02T00:00:00.000Z' });
  assert.equal(w1.store.items[1].debrief, undefined);
  const w2 = withDebriefs(w1.store, [{ id: 'r1', who: '스팡달', text: '다시' }], 'backfill');
  assert.equal(w2.applied, 0, '있던 소감은 자동으로 안 덮는다');
  const w3 = withDebriefs(w1.store, [{ id: 'r1', who: '스팡달', text: '다시' }], 'manual');
  assert.ok(w3.applied === 1 && w3.store.items[0].debrief.src === 'manual' && w3.store.items[0].debrief.text === '다시');
  // 묶음 안 종료 사건: idx 가 묶음에 있고 소감이 아직 없는 것만, 최대 3건
  const many = { v: 1, items: [1, 2, 3, 4, 5].map((i) => ({ ...rep, id: `r${i}`, idx: i, ...(i === 2 ? { debrief: { who: 'a', text: 'b', src: 'turn', at: '' } } : {}) })) };
  assert.deepEqual(endedInBatch(many, [1, 2, 3, 4, 5]).map((r) => r.id), ['r3', 'r4', 'r5']);
  assert.deepEqual(endedInBatch(many, [2, 7]).map((r) => r.id), []);
  assert.ok(DEBRIEF_PROMPT.includes('"debriefs"') && !DEBRIEF_PROMPT.includes('{{'), '수동 지침은 짧고 템플릿 기호가 없다');
  assert.ok(DEBRIEF_PROMPT.length < 1500);
});
