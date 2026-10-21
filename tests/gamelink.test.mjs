// 게임 ↔ 본편 연동 (core/gamelink.ts): 스냅숏 읽기, 결과 모양 맞추기, 보고서 글, 기록 로어북
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardSnapshot, normReport, reportText, withRecord, withoutRecord, recordLines, RECORD_COMMENT, WORLD_KEY, emptyWorld } from '../dist-test/core.mjs';

const roster = {
  version: 2,
  refill: 2,
  characters: [
    { id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: [], affiliation: 'A00', rank: '팀장', department: '', roster_for: ['A00'], phone_tabs: [] },
    { id: 'P002', name: '스팡달', english: 'Spangdal', lore: '스팡달', aliases: [], affiliation: 'A00', rank: '요원', department: '', roster_for: ['A00'], phone_tabs: [] },
  ],
};
const worldBook = { 괴이: [[true, '차원 승강기', '차원 승강기', 'Dimensional Elevator', []]], '미스틱 사이트': [], 랜드마크: [] };
const char = { name: '괴이', globalLore: [{ comment: 'World catalog', content: JSON.stringify(worldBook) }, { comment: 'Agent roster', content: JSON.stringify(roster) }] };

function chatWith(world) {
  return { message: [], scriptstate: { $st_faction: 'A00', [WORLD_KEY]: JSON.stringify(world) } };
}

test('snapshot reads agents, states and live events', () => {
  const w = emptyWorld();
  w.agents.P002 = { st: '작전투입', situation: '차원 승강기 B-3', since: null, dead: 0, tagged: true };
  w.an.push({ loc: '02', name: '차원 승강기', state: '활성', grade: 'B', deploy: 'P002', kind: 'preset', origin: 'model', presetName: '', since: null, born: 1, exploring: false, situation: '승강기가 멈춤' });
  const s = cardSnapshot(char, chatWith(w), { main: (r) => `${r.english}_default`, face: (r) => `${r.english}_default#50,16,44` });
  assert.equal(s.faction, 'A00');
  assert.deepEqual(s.agents.map((a) => [a.id, a.state, a.locked]), [['P001', '미정', false], ['P002', '작전투입', true]]);
  assert.equal(s.agents[0].face, 'Jyaldi_default#50,16,44');
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].name, '차원 승강기');
  assert.equal(s.events[0].situation, '승강기가 멈춤');
  assert.equal(s.anomalies[0].english, 'Dimensional Elevator');
});

test('report is normalized and marks are stripped', () => {
  assert.equal(normReport(null), null);
  assert.equal(normReport({ outcome: 'return' }), null, 'mission is required');
  const r = normReport({ id: 'x1', mission: '조사: 로비 %%SEED%%', outcome: 'weird', depth: 'B-2', agents: [{ id: 'jyaldi', name: '쟈알디', hp: 40 }], rules: ['인사는 두 번', 3], loot: [] });
  assert.equal(r.outcome, 'return');
  assert.equal(r.mission, '조사: 로비 SEED');
  assert.deepEqual(r.rules, ['인사는 두 번', '3']);
  assert.equal(normReport({ mission: 'a', outcome: 'withdraw' }).outcome, 'withdraw');
  const text = reportText(r);
  assert.match(text, /^\[관리국 출동 보고서\] 조사: 로비 SEED · 귀환 · 최저 B-2/);
  assert.match(text, /찾은 규칙: 인사는 두 번 \/ 3/);
});

test('record lorebook keeps the latest five and can be removed', () => {
  let chat = { message: [], localLore: [{ comment: '위키:다른 문서', content: 'x' }] };
  for (let i = 1; i <= 7; i++) chat = withRecord(chat, normReport({ mission: `임무 ${i}`, outcome: 'evac' }), new Date(2026, 9, i));
  const entry = chat.localLore.find((e) => e.comment === RECORD_COMMENT);
  assert.equal(entry.alwaysActive, true);
  assert.equal(recordLines(chat), 5);
  assert.match(entry.content.split('\n')[2], /2026-10-07 임무 7 · 후송/);
  assert.equal(chat.localLore.length, 2, 'other local lore stays');
  const gone = withoutRecord(chat);
  assert.equal(gone.localLore.length, 1);
  assert.equal(withoutRecord(gone), null);
});
