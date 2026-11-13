// 전수검사 11-13 기록 고침: 일지 시각 순서, 연대기 사건 줄 자리, 보고서 호감 계수, 종료 응답 뒤 보고서 다시 셈
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-fixjournal-'));
await build({
  entryPoints: ['src/core/journal/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
  loader: { '.txt': 'text', '.md': 'text' },
});
const J = await import(pathToFileURL(join(dir, 'core/journal/index.mjs')));

const PEOPLE_KEY = 'goeiPeopleV1';
const emptyStore = () => ({ schema: 1, people: {}, factions: {}, docs: {}, log: [], folded: {}, read: {}, pending: {}, ignored: [] });
const msgs = (...ids) => ids.map((id, i) => ({ role: i % 2 ? 'char' : 'user', data: i % 2 ? `응답 [▣|2025.01.0${Math.ceil(i / 2)}|03:00 AM|☀️|4°C|종로|없음]` : '계속', chatId: id }));
const cue = (who, cueName, anchor, seq) => ({ id: `c${who}${anchor}${seq}`, anchor, seq, src: 'manual', who, kind: 'cue', cue: cueName, reason: '' });
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const row = (extra) => ({ id: `j${extra.name}`, kind: 'an', name: '?', loc: '', at: null, since: null, born: null, idx: 1, anchor: 'c1', mine: true, cause: 'model', agents: [], result: '', ...extra });
const report = (extra) => ({ id: 'r1', no: 'RPT-0101-01', full: true, mine: true, kind: 'in', cause: 'model', head: { name: '사건', loc: '', born: null, since: null, at: null, duration: null }, trail: [], agents: [], result: '', idx: 3, anchor: 'c2', fromKey: 'c1', savedAt: '2025-01-01T00:00:00Z', people: [], wallet: [], balance: 1000, ...extra });

test('일지: 종료 시각이 최근인 줄이 위, 같은 시각은 나중 저장이 위, 시각 없음은 맨 뒤', () => {
  const rows = [{ n: 'C', at: 100 }, { n: 'B', at: 300 }, { n: 'N', at: null }, { n: 'A', at: 200 }, { n: 'D', at: 300 }];
  assert.deepEqual(J.journalNewestFirst(rows).map((r) => r.n), ['D', 'B', 'A', 'C', 'N']);
});

test('연대기: 앞 메시지를 지워도 사건 줄은 열쇠로 지금 자리를 찾는다', () => {
  const message = msgs('u2', 'c2', 'u3', 'c3'); // u1·c1 을 지운 뒤
  const rows = [row({ name: '내 사건', idx: 3, anchor: 'c2' })];
  const chat = { message, scriptstate: { $goei_journal: JSON.stringify({ v: 1, rows }) }, [PEOPLE_KEY]: emptyStore() };
  const [e] = J.buildChronicle(chat, []);
  assert.equal(e.pos, 1);
  assert.equal(e.day, '2025.01.01');
  // 열쇠가 없어진 줄은 저장 번호 그대로
  const gone = { ...chat, scriptstate: { $goei_journal: JSON.stringify({ v: 1, rows: [row({ name: '옛', idx: 3, anchor: 'zz' })] }) } };
  assert.equal(J.buildChronicle(gone, [])[0].pos, 3);
});

test('보고서 다시 셈: 종료 응답의 가계부 줄·호감 계기가 뒤에 적혀도 그 응답의 보고서에 들어간다', () => {
  const message = msgs('u1', 'c1', 'u2', 'c2');
  const store = { ...emptyStore(), people: { 사장: person('사장') }, log: [cue('사장', '도움', 'c2', 0)] };
  const wallet = { start: 1000, log: [{ id: 'w1', anchor: 'c2', amount: 300, memo: '상태창 잔고', src: 'story', at: '' }] };
  const chat = { message, scriptstate: { $goei_reports: JSON.stringify({ v: 1, items: [report({}), report({ id: 'r2', idx: 1, anchor: 'c1' })] }), $st_wallet: JSON.stringify(wallet) }, [PEOPLE_KEY]: store };
  const v = J.refreshClosures(chat, 3);
  assert.ok(v);
  const items = JSON.parse(v.$goei_reports).items;
  assert.equal(items[0].balance, 1300);
  assert.deepEqual(items[0].wallet.map((t) => t.amount), [300]);
  assert.deepEqual(items[0].people.map((p) => p.who), ['사장']);
  // 다른 메시지에서 끝난 보고서는 그대로
  assert.deepEqual(items[1].people, []);
  assert.equal(items[1].balance, 1000);
  // 이미 맞으면 저장하지 않는다
  assert.equal(J.refreshClosures({ ...chat, scriptstate: { ...chat.scriptstate, ...v } }, 3), null);
  // 간이 보고서·fromKey 없는 옛 보고서는 건드리지 않는다
  const old = { ...chat, scriptstate: { ...chat.scriptstate, $goei_reports: JSON.stringify({ v: 1, items: [report({ fromKey: undefined }), report({ id: 'r3', mine: false, full: false })] }) } };
  assert.equal(J.refreshClosures(old, 3), null);
});

test('보고서 호감: 성격 계수를 넣어 인물 기록 화면과 같은 수치', () => {
  const message = msgs('u1', 'c1', 'u2', 'c2');
  const store = { ...emptyStore(), people: { 무명씨: person('무명씨'), 게슈간: person('게슈간') }, log: [cue('무명씨', '도움', 'c2', 0), cue('게슈간', '도움', 'c2', 0)] };
  const chat = { message, scriptstate: { $goei_reports: JSON.stringify({ v: 1, items: [report({})] }) }, [PEOPLE_KEY]: store };
  const people = JSON.parse(J.refreshClosures(chat, 3).$goei_reports).items[0].people;
  const d = Object.fromEntries(people.map((p) => [p.who, p.delta]));
  assert.equal(d['무명씨'], 3); // 기본 자료에 없는 사람은 계수 1
  assert.equal(d['게슈간'], 1.5); // 게슈간 open 0.5 (relations-base.json)
});
