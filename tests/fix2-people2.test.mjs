// 전수검사 11-13 인물 쪽 고침: 정리의 버린 원본·null 목록·Director 열쇠·need+notes·가진 물건 또 얻음·변경 기록 줄이기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/people2';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/people/consolidate.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/updater.ts', 'src/core/people/director.ts', 'src/core/people/affinity.ts', 'src/core/people/sexual.ts', 'src/core/itemrules.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/${n}.mjs`)));
const C = await mod('people/consolidate');
const S = await mod('people/store');
const T = await mod('people/types');
const St = await mod('people/settings');
const U = await mod('people/updater');
const D = await mod('people/director');
const A = await mod('people/affinity');
const X = await mod('people/sexual');
const R = await mod('itemrules');

const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });

test('정리: 어느 from 에도 없는 원본은 접혀서 살아 있지 않다', () => {
  const chat = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: '쟈알디가 왔다.', chatId: 'c1' }] };
  const e = (id, text) => ({ id, text, src: 'story', anchor: 'c1', seq: 1, quote: '왔다' });
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.state = [e('s1', 'a'), e('s2', 'b'), e('s3', 'c')];
  const settings = St.peopleSettings({});
  const input = C.buildConsolidate(store, chat, '쟈알디', settings);
  const live = S.liveness(chat);
  const rep = C.applyConsolidate(store, '쟈알디', input, { slots: { state: [{ text: 'merged', from: ['s1'] }] } }, live, settings);
  assert.deepEqual([rep.slots, rep.before, rep.after], [1, 3, 1]);
  const list = store.people.쟈알디.slots.state;
  assert.deepEqual(S.liveEntries(list, live).map((x) => x.text), ['merged']);
  const st = S.entryStates(list, live);
  assert.deepEqual([st.get('s1'), st.get('s2'), st.get('s3')], ['replaced', 'folded', 'folded']);
});

test('갱신기 응답: 목록 키의 null 은 빈 목록, 글은 여전히 오류', () => {
  const r = U.parseUpdate('{"entries":[{"who":"쟈알디"}],"cues":null,"items":null,"shop":null}');
  assert.equal(r.cues, undefined);
  assert.equal(r.entries.length, 1);
  assert.equal(r.shop, null, 'shop 의 null 은 그대로');
  assert.throws(() => U.parseUpdate('{"cues":"없음"}'), /cues는 목록/);
});

test('Director: 빈 need·2차의 need 는 notes 가 있으면 notes 로', () => {
  const notes = '"notes":[{"who":"쟈알디","now":"서류를 넘김"}]';
  const a = D.parseDirectorAny(`{"need":[],${notes}}`, ['쟈알디'], true, true);
  assert.equal(a.notes[0].now, '서류를 넘김');
  const b = D.parseDirectorAny(`{"need":[{"kind":"chat","query":"x"}],${notes}}`, ['쟈알디'], true, false);
  assert.equal(b.notes.length, 1);
  const c = D.parseDirectorAny(`{"need":[{"kind":"nope","query":"x"}],${notes}}`, ['쟈알디'], true, true);
  assert.equal(c.notes.length, 1);
  assert.ok('need' in D.parseDirectorAny(`{"need":[{"kind":"chat","query":"x"}],${notes}}`, ['쟈알디'], true, true), '1차에서는 검색 요청 우선');
  assert.throws(() => D.parseDirectorAny('{"need":[{"kind":"chat","query":"x"}]}', ['쟈알디'], true, false), /2차/);
  assert.throws(() => D.parseDirectorAny('{"need":[{"kind":"nope","query":"x"}]}', ['쟈알디'], true, true), /비어/);
});

test('Director 재사용 열쇠: 입력이 같아도 최근 글이 달라지면 다른 열쇠', () => {
  const s = St.peopleSettings({ $pp_director: 'scene', $pp_rhythm: '0' });
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const m = (last) => ({ message: [{ role: 'user', data: '계속', chatId: 'u1' }, { role: 'char', data: last, chatId: 'c1' }, { role: 'user', data: '계속', chatId: 'u2' }] });
  const k1 = D.buildDirector(m('쟈알디가 문을 열었다.'), store, ['쟈알디'], '계속', s, {}).key;
  const k2 = D.buildDirector(m('쟈알디가 계단을 내려갔다.'), store, ['쟈알디'], '계속', s, {}).key;
  const k3 = D.buildDirector(m('쟈알디가 문을 열었다.'), store, ['쟈알디'], '계속', s, {}).key;
  assert.notEqual(k1, k2);
  assert.equal(k1, k3);
});

test('소지품: 가진 물건을 new 로 또 얻으면 update 로 바꾸되 남은 횟수를 받은 수로 덮지 않는다', () => {
  const c = { scriptstate: {}, message: [['user', 'x', 'u1'], ['char', '생수 두 병을 더 받았다. 보관해 둔 생수와 합쳤다.', 'c1']].map(([role, data, chatId]) => ({ role, data, chatId })) };
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const s = St.peopleSettings({});
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names: [{ name: '쟈알디', aliases: [], titles: [] }], items: [{ name: '생수', desc: '', use: true, left: 3, state: 'ok' }] });
  const desc = '보관해 둔 생수';
  const rep = U.applyUpdate(store, c, input, { items: [{ name: '생수', action: 'new', uses: 2, desc, m: 'm2', quote: '생수 두 병을 더 받았다' }] }, { settings: s, items: true });
  assert.equal(rep.items.length, 1);
  assert.equal(rep.items[0].action, 'update');
  assert.equal(rep.items[0].uses, undefined);
  assert.equal(rep.items[0].desc, R.leftWordIn(desc) || R.offWordIn(desc) ? '' : desc);
  const rep2 = U.applyUpdate(T.emptyStore(), c, input, { items: [{ name: '생수', action: 'update', uses: 1, desc: '', m: 'm2', quote: '생수 두 병을 더 받았다' }] }, { settings: s, items: true });
  assert.equal(rep2.items[0].uses, 1, '진짜 update 의 uses 는 그대로');
});

test('성적 지침: 고친 지침에도 「거짓일 때」 조건이 남는다 (기본 글)', () => {
  const sec = X.sexualWriterSection({ ...St.peopleSettings({}), features: new Set(['axes']), sexualDesire: true, paraphilia: false, explicitStyle: false });
  assert.ok(/When false[,:]/.test(sec));
});

test('변경 기록: 지워진 메시지의 변경은 버리고, 상한을 넘으면 오래된 계기를 값이 같게 접는다', () => {
  const n = 260;
  const chat = { message: Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: `m${i}`, chatId: `k${i}` })) };
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.affinity.base = 20;
  const cues = ['작은친절', '도움', '큰도움', '헌신', '실망', '무시', '배신'];
  let seq = 0;
  for (let i = 0; i < 820; i++) {
    const at = 1 + (i % 25) * 2;
    store.log.push({ id: `x${i}`, anchor: `k${at}`, seq: seq++, src: 'field', who: '쟈알디', kind: 'cue', cue: cues[i % cues.length] });
  }
  store.log.push({ id: 'late', anchor: `k${n - 1}`, seq: seq++, src: 'field', who: '쟈알디', kind: 'cue', cue: '헌신' });
  store.log.push({ id: 'dead', anchor: 'gone', seq: seq++, src: 'field', who: '쟈알디', kind: 'cue', cue: '헌신' });
  store.log.push({ id: 'hash', anchor: '#999', seq: seq++, src: 'field', who: '쟈알디', kind: 'cue', cue: '헌신' });
  const o = { speed: 1, turnCap: 10 };
  const live = S.liveness(chat);
  const before = A.affinityOf(store.people.쟈알디, S.liveChanges(store, live), store.folded.쟈알디 ?? 0, o);
  S.foldLog(store, chat, (who, list, folded) => A.sumCues(who, store.people[who].affinity.base, list, folded, T.AFF_MIN, T.AFF_MAX, o) - store.people[who].affinity.base);
  const after = A.affinityOf(store.people.쟈알디, S.liveChanges(store, live), store.folded.쟈알디 ?? 0, o);
  assert.ok(Math.abs(before - after) < 0.01, `${before} → ${after}`);
  assert.deepEqual(store.log.map((c) => c.id).sort(), ['hash', 'late']);
  // 고정이 든 사람은 접지 않는다
  const s2 = T.emptyStore();
  s2.people.쟈알디 = person('쟈알디');
  for (let i = 0; i < 801; i++) s2.log.push({ id: `y${i}`, anchor: `k${1 + (i % 50) * 2}`, seq: i, src: 'field', who: '쟈알디', kind: 'cue', cue: '도움', ...(i === 3 ? { pin: 50, cue: undefined } : {}) });
  S.foldLog(s2, chat, () => 0);
  assert.equal(s2.log.length, 801);
});
