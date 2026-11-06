// 연대기·인사 기록부 (2026-11-06): 유저만의 것, 단계가 바뀐 때만, 필드 줄은 세지 않음, 지출은 가계부와 같은 셈
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChronicle, buildPersonnel } from '../dist-test/core.mjs';
// 인물 장부 (core 입구에 people 이 없어 이름·빈 장부를 여기 적는다: src/core/people/types.ts PEOPLE_KEY·emptyStore)
const PEOPLE_KEY = 'goeiPeopleV1';
const emptyStore = () => ({ schema: 1, people: {}, factions: {}, docs: {}, log: [], folded: {}, read: {}, pending: {}, ignored: [] });

const msgs = (...ids) => ids.map((id, i) => ({ role: i % 2 ? 'char' : 'user', data: i % 2 ? `응답 [▣|2025.01.0${Math.ceil(i / 2)}|03:00 AM|☀️|4°C|종로|없음]` : '계속', chatId: id }));
const cue = (who, cueName, anchor, seq, reason = '') => ({ id: `c${who}${anchor}${seq}`, anchor, seq, src: 'manual', who, kind: 'cue', cue: cueName, reason });
const person = (name, base) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const row = (extra) => ({ id: `j${extra.name}`, kind: 'an', name: '?', loc: '', at: null, since: null, born: null, idx: 1, anchor: 'c1', mine: true, cause: 'model', agents: [], result: '', ...extra });

test('연대기: 내가 나간 사건만, 필드 줄 빼고, 한 메시지 안 오르내림은 올리지 않는다', () => {
  const message = msgs('u1', 'c1', 'u2', 'c2');
  const store = { ...emptyStore(), people: { 쟈알디: person('쟈알디', 58) }, log: [
    cue('쟈알디', '도움', 'c1', 0), cue('쟈알디', '실망', 'c1', 1), // 58 → 61(인식) → 59(무관심): 한 메시지 안이라 줄 없음
    cue('쟈알디', '헌신', 'c2', 0, '목숨을 구함'), // 69 → 인식
  ] };
  const rows = [row({ name: '내 괴이', idx: 1, cause: 'manual' }), row({ name: '남의 사건', kind: 'in', mine: false, idx: 3 }), row({ name: '옛 필드', kind: 'fd', idx: 3 })];
  const chat = { message, scriptstate: { $goei_journal: JSON.stringify({ v: 1, rows }) }, [PEOPLE_KEY]: store };
  const list = buildChronicle(chat, []);
  assert.deepEqual(list.map((e) => [e.kind, e.title]), [['event', '내 괴이'], ['person', '쟈알디']]);
  assert.ok(list[0].text.includes('직접 종료') && list[0].day === '2025.01.01');
  assert.equal(list[1].text, '호감 무관심 → 인식 · 목숨을 구함');
  assert.equal(list[1].day, '2025.01.02');
});

test('인사 기록부: 내 사건 수·클리어·같이 간 요원 Top3(나 빼고)·지출(직접 수정 제외)', () => {
  const ag = (...n) => n.map((name) => ({ id: '', name, st: '' }));
  const rows = [
    row({ name: 'a', agents: ag('A', 'B'), cleared: true }), row({ name: 'b', agents: ag('A', 'C') }), row({ name: 'c', agents: ag('A', 'B', 'D') }),
    row({ name: 'd', mine: false, agents: ag('E', 'E', 'E') }), row({ name: 'e', kind: 'fd', agents: ag('F') }),
  ];
  const wallet = { start: 1000, log: [
    { id: 'w1', anchor: '', amount: -300, memo: '택시', src: 'story', at: '' },
    { id: 'w2', anchor: '', amount: 500, memo: '수당', src: 'story', at: '' },
    { id: 'w3', anchor: '', amount: -900, memo: '맞춤', src: 'manual', at: '' },
  ] };
  const chat = { message: msgs('u1', 'c1'), scriptstate: { $goei_journal: JSON.stringify({ v: 1, rows }), $st_wallet: JSON.stringify(wallet) } };
  const p = buildPersonnel(chat, [], 0);
  assert.equal(p.closed, 3);
  assert.equal(p.cleared, 1);
  assert.deepEqual(p.companions, [['A', 3], ['B', 2], ['C', 1]]);
  assert.equal(p.spent, 300);
});
