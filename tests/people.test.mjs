import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-'));
await build({
  entryPoints: ['src/core/people/types.ts', 'src/core/people/store.ts', 'src/core/people/affinity.ts', 'src/core/people/seed.ts', 'src/core/people/select.ts', 'src/core/people/inject.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const T = await mod('types');
const S = await mod('store');
const A = await mod('affinity');
const Seed = await mod('seed');
const Sel = await mod('select');
const Inj = await mod('inject');

const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, ...(chatId ? { chatId } : {}) })) });
const person = (name, extra = {}) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], ...extra });
const cue = (who, cueName, anchor, seq, extra = {}) => ({ id: `c${who}${anchor}${seq}`, anchor, seq, src: 'story', who, kind: 'cue', cue: cueName, reason: 'r', ...extra });

test('호감: 계기 합, 기준 메시지당 ±10 상한, 예외 계기, 범위', () => {
  const p = person('쟈알디');
  const c = chat(['user', 'a', 'u1'], ['char', 'b', 'c1'], ['user', 'c', 'u2'], ['char', 'd', 'c2']);
  const live = S.liveness(c);
  const store = { ...T.emptyStore(), people: { 쟈알디: p }, log: [cue('쟈알디', '헌신', 'c1', 0), cue('쟈알디', '헌신', 'c1', 1), cue('쟈알디', '도움', 'c2', 0)] };
  // c1: 10+10 → 상한 10 / c2: +3
  assert.equal(A.affinityOf(p, S.liveChanges(store, live)), 13);
  store.log.push(cue('쟈알디', '중대위반', 'c2', 1));
  assert.equal(A.affinityOf(p, S.liveChanges(store, live)), 10 + 3 - 50);
  const big = { ...T.emptyStore(), people: { 쟈알디: p }, log: Array.from({ length: 40 }, (_, i) => cue('쟈알디', '헌신', i % 2 ? 'c1' : 'c2', i)) };
  assert.equal(A.affinityOf(p, S.liveChanges(big, live)), 20, '기준 메시지가 둘이면 최대 +20');
  assert.equal(A.affinityOf({ ...p, affinity: { base: 290 } }, S.liveChanges(big, live)), 300, '상한 300');
});

test('호감: 성격 계수·속도 배율, 고정(pin)과 취소(void)', () => {
  const p = person('데쥬레');
  const c = chat(['user', 'a', 'u1'], ['char', 'b', 'c1'], ['char', 'd', 'c2']);
  const live = S.liveness(c);
  const store = { ...T.emptyStore(), people: { 데쥬레: p }, log: [cue('데쥬레', '도움', 'c1', 0), cue('데쥬레', '무시', 'c1', 1)] };
  assert.equal(A.affinityOf(p, S.liveChanges(store, live), 0, { temper: { open: 2, grudge: 0.5 } }), 6 - 2);
  assert.equal(A.affinityOf(p, S.liveChanges(store, live), 0, { speed: 2 }), 6 - 8);
  store.log.push({ id: 'pin', anchor: 'c2', seq: 0, src: 'manual', who: '데쥬레', kind: 'cue', reason: '사용자', pin: 150 });
  store.log.push(cue('데쥬레', '헌신', 'c2', 1));
  assert.equal(A.affinityOf(p, S.liveChanges(store, live)), 150, '고정 뒤 계기는 무시');
  store.log[2].void = true;
  assert.equal(A.affinityOf(p, S.liveChanges(store, live)), -1 + 10, '고정을 취소하면 다시 계산');
});

test('살아 있음: 기준 메시지가 사라지면 빠지고, story 인용이 본문에 없으면 빠진다. #0 은 늘 산다', () => {
  const c = chat(['user', '안녕', 'u1'], ['char', '쟈알디가 팔을 감싸 안았다.', 'c1']);
  const live = S.liveness(c);
  assert.ok(S.isAlive({ anchor: 'c1', src: 'story', quote: '팔을 감싸 안았다' }, live));
  assert.ok(S.isAlive({ anchor: 'c1', src: 'story', quote: '팔을  감싸 "안았다"' }, live), '공백·따옴표 차이는 무시');
  assert.ok(!S.isAlive({ anchor: 'c1', src: 'story', quote: '다리를 걸었다' }, live));
  assert.ok(!S.isAlive({ anchor: 'c9', src: 'field' }, live));
  assert.ok(S.isAlive({ anchor: '#0', src: 'seed' }, live));
  assert.ok(S.isAlive({ anchor: '#2', src: 'field' }, live), '#메시지수 기준은 그만큼 메시지가 있으면 산다');
  assert.ok(!S.isAlive({ anchor: '#3', src: 'field' }, live));
  assert.ok(!S.isAlive({ anchor: 'c1', src: 'story', quote: '팔을', void: true }, live));
});

test('칸 항목: 대체 항목이 죽으면 이전 항목이 되살아난다', () => {
  const c1 = chat(['char', '사무실', 'a'], ['char', '왼팔을 다쳤다', 'b']);
  const list = [
    { id: 'e1', text: '본부 사무실', src: 'seed', anchor: '#0', seq: 0 },
    { id: 'e2', text: '왼팔 부상', src: 'story', anchor: 'b', seq: 0, quote: '왼팔을 다쳤다', replaces: 'e1' },
  ];
  assert.deepEqual(S.liveEntries(list, S.liveness(c1)).map((e) => e.id), ['e2']);
  const c2 = chat(['char', '사무실', 'a'], ['char', '멀쩡하다', 'b2']);
  assert.deepEqual(S.liveEntries(list, S.liveness(c2)).map((e) => e.id), ['e1'], '다시 굴려 응답이 바뀌면 옛 항목 복귀');
});

test('읽음 표시: 안 읽은 응답, 내용이 바뀐 응답, 사라진 열쇠 정리', () => {
  const c = chat(['user', 'q', 'u1'], ['char', 'a1', 'c1'], ['user', 'q2', 'u2'], ['char', 'a2', 'c2']);
  const store = T.emptyStore();
  assert.deepEqual(S.unreadIndexes(c, store), [1, 3]);
  S.markRead(store, c, [1, 3]);
  assert.deepEqual(S.unreadIndexes(c, store), []);
  const c2 = chat(['user', 'q', 'u1'], ['char', 'a1', 'c1'], ['user', 'q2', 'u2'], ['char', 'a2-다시', 'c3']);
  assert.deepEqual(S.unreadIndexes(c2, store), [3], '다시 굴린 응답은 안 읽음');
  S.markRead(store, c2, [3]);
  assert.ok(!('c2' in store.read));
});

test('저장 읽기: 깨진 항목은 버리고 기본값으로', () => {
  const st = S.peopleStore({ [T.PEOPLE_KEY]: { people: { 쟈알디: { name: '쟈알디', slots: { state: [{ id: 'x', text: 't', anchor: '#0' }, null, 'bad'] }, express: 9 } }, log: [{ id: 'c', anchor: 'a', who: 'w', kind: 'cue' }, {}], read: { a: 'h', b: 3 } } });
  assert.equal(st.people.쟈알디.slots.state.length, 1);
  assert.equal(st.people.쟈알디.express, 1);
  assert.equal(st.log.length, 1);
  assert.deepEqual(st.read, { a: 'h' });
  assert.deepEqual(S.peopleStore({}), T.emptyStore());
});

test('시트 시작값: Identity·Character 는 칸으로, 고정 절은 원문으로', () => {
  const sheet = ['### Character - Jyaldi', '', '#### Identity', '- Age: 30', '- Role: Chief', '', '#### Character', '- Never lies.', '[Flaws]', '- Overworks.', '', '#### Voice', '- Short orders.', '', '#### Abilities', 'Strong.'].join('\n');
  const p = Seed.seedPerson('쟈알디', sheet, { faction: 'A00', express: 0, affinityBase: 0, address: { toUser: '요원', register: '반말' } });
  assert.deepEqual(p.slots.identity.map((e) => e.text), ['Age: 30', 'Role: Chief']);
  assert.deepEqual(p.slots.personality.map((e) => e.text), ['Never lies.', '[Flaws] Overworks.']);
  assert.equal(p.slots.identity[0].anchor, '#0');
  assert.deepEqual(Seed.fixedSections(sheet).map((s) => s.name), ['Voice', 'Abilities']);
  const none = Seed.seedPerson('새사람', null);
  assert.equal(none.seeded.from, 'none');
  assert.deepEqual(none.slots, {});
});

test('장면 인물: 최근 글의 이름·별명·유일한 호칭, 동행 칸', () => {
  const store = T.emptyStore();
  for (const n of ['쟈알디', '잼트리', '이도형']) store.people[n] = person(n);
  const match = Sel.nameMatcher([
    { name: '쟈알디', aliases: ['Jyaldi'], titles: ['부장'] },
    { name: '이도형', aliases: [], titles: ['부장'] },
    { name: '잼트리', aliases: [], titles: ['언니'] },
  ]);
  assert.deepEqual(match('부장이 왔다').sort(), [], '겹치는 호칭은 안 잡음');
  assert.deepEqual(match('언니가 커피를 탔다'), ['잼트리']);
  assert.deepEqual(match('Jyaldi said'), ['쟈알디']);
  assert.deepEqual(match('이 도형'), [], '사람 이름은 띄어쓰기를 봐주지 않음');
  const c = chat(['user', '잼트리에게 간다', 'u1'], ['char', '쟈알디가 왔다.\n[▣|2025.01.01|10:00 AM|☀️|4°C|본부|없음|이도형|없음]', 'c1']);
  assert.deepEqual(Sel.scenePeople(c, store, match), ['쟈알디', '이도형', '잼트리'], '마지막 응답(상태창 동행 포함) → 유저 입력 순서');
  assert.deepEqual(Sel.scenePeople(c, store, match, { input: '이도형 과장을 찾는다', max: 2 }), ['이도형', '쟈알디']);
});

test('기록 블록: 절 단위 혼합, 모르는 것, 단계 문장, 메모', () => {
  const sheet = ['### Character - Jyaldi', '#### Identity', '- Role: Chief', '#### Voice', '- Short orders.', '#### Background', '- Lost her team.'].join('\n');
  const c = chat(['char', '쟈알디는 명단을 봤다고 들었다. 데쥬레는 비밀번호를 알았다.', 'c1']);
  const live = S.liveness(c);
  const store = T.emptyStore();
  store.people.쟈알디 = Seed.seedPerson('쟈알디', sheet, { express: 0, address: { toUser: '너', register: '반말' } });
  store.people.데쥬레 = person('데쥬레');
  store.people.쟈알디.slots.knowledge = [{ id: 'k1', text: '유저가 명단을 봤다', src: 'story', anchor: 'c1', seq: 0, quote: '명단을 봤다' }];
  store.people.데쥬레.slots.knowledge = [{ id: 'k2', text: '금고 비밀번호', src: 'story', anchor: 'c1', seq: 0, quote: '비밀번호를 알았다' }];
  store.log.push(cue('쟈알디', '헌신', 'c1', 0, { quote: '명단을 봤다' }));
  store.log.push(cue('쟈알디', '헌신', 'c1', 1, { quote: '명단을 봤다' }));
  const changes = S.liveChanges(store, live);
  const unknown = Inj.unknownTo(store.people.쟈알디, store, live);
  assert.deepEqual(unknown, ['금고 비밀번호']);
  const block = Inj.personBlock(store.people.쟈알디, store, live, changes, { sheet, unknown, note: { now: 'Watches the door.', mustNot: ['유저의 전직'] } });
  assert.match(block, /Identity:\n- Role: Chief/);
  assert.match(block, /Voice:\n- Short orders\./);
  assert.match(block, /Background:/);
  assert.match(block, /Does not know[^\n]*\n- 금고 비밀번호/);
  assert.match(block, /Relationship → \{\{user\}\}: 무관심/, '10점은 무관심 단계');
  assert.match(block, /Address → \{\{user\}\}: '너', informal/);
  assert.match(block, /Must not reveal: 유저의 전직/);
  assert.ok(!/\d+점|score: \d/.test(block), '숫자 없음');
  const whole = Inj.peopleBlock([block]);
  assert.ok(whole.startsWith(Inj.PEOPLE_HEAD));
});

test('항목 상태: 대체·합침·취소·사라짐을 구분하고, 합친 항목(from)이 죽으면 원본이 되살아난다', () => {
  const c = chat(['user', 'a', 'u1'], ['char', '쟈알디가 왔다. 명단을 봤다.', 'c1'], ['user', 'b', 'u2'], ['char', '쟈알디가 떠났다.', 'c2']);
  const live = S.liveness(c);
  const e = (id, text, anchor, extra = {}) => ({ id, text, src: 'story', anchor, seq: 1, ...extra });
  const list = [e('a', '왔다', 'c1', { quote: '쟈알디가 왔다' }), e('b', '떠났다', 'c2', { quote: '떠났다', replaces: 'a' }), e('c', '없는 인용', 'c1', { quote: '여기 없는 글' }), e('d', '취소', 'c2', { void: true })];
  const st = S.entryStates(list, live);
  assert.equal(st.get('a'), 'replaced');
  assert.equal(st.get('b'), 'alive');
  assert.equal(st.get('c'), 'gone');
  assert.equal(st.get('d'), 'void');
  // 합치기: from 에 든 원본은 대체된 것. 합친 항목의 기준 메시지가 사라지면 원본이 돌아온다
  const merged = [e('h1', '일 1', 'c1'), e('h2', '일 2', 'c1'), e('m', '일 1과 2', 'c2', { from: ['h1', 'h2'] })];
  assert.deepEqual(S.liveEntries(merged, live).map((x) => x.id), ['m']);
  assert.equal(S.entryStates(merged, live).get('h1'), 'replaced');
  const cut = chat(['user', 'a', 'u1'], ['char', '쟈알디가 왔다. 명단을 봤다.', 'c1']);
  assert.deepEqual(S.liveEntries(merged, S.liveness(cut)).map((x) => x.id), ['h1', 'h2']);
});

test('읽음 해시: 이미지 태그·공백 차이는 바뀐 응답으로 치지 않는다', () => {
  const a = { role: 'char', data: '쟈알디가 왔다.\n\n문장 둘.' };
  const b = { role: 'char', data: '쟈알디가 왔다.\n\n<img=Jyaldi_smile>\n\n문장  둘.' };
  const d = { role: 'char', data: '쟈알디가 갔다.' };
  assert.equal(S.messageHash(a), S.messageHash(b));
  assert.notEqual(S.messageHash(a), S.messageHash(d));
});
