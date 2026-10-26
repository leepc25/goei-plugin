import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-up-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/affinity.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const A = await mod('affinity');

const settings = (over = {}) => ({ ...St.peopleSettings({}), ...over });
const person = (name, extra = {}) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], ...extra });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: ['Jyaldi'], titles: ['부장'] }, { name: '데쥬레', aliases: [], titles: [] }];

const base = () =>
  chat(
    ['user', '출근했다', 'u1'],
    ['char', '잼트리가 커피를 탔다.\n[AG|쟈알디|내근|결재]', 'c1'],
    ['user', '쟈알디에게 명단을 봤다고 말했다', 'u2'],
    ['char', '쟈알디가 말했다. "이제 그냥 너라고 할게." 그러고는 유저를 감싸 안으며 팔을 다쳤다. 데쥬레는 금고 비밀번호를 알았다.\n[▣|2025.01.01|10:00 AM|☀️|4°C|본부|없음|데쥬레|없음]\n[AG|쟈알디|부상|왼팔]', 'c2'],
  );

function setup() {
  const c = base();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.데쥬레 = person('데쥬레');
  store.people.쟈알디.slots.threads = [{ id: 'e07', text: '명일 아파트 재조사 약속 (미이행)', src: 'seed', anchor: '#0', seq: 0, target: '@user' }];
  store.people.쟈알디.slots.state = [{ id: 'e12', text: '본부 사무실', src: 'seed', anchor: '#0', seq: 1 }];
  const input = U.buildUpdate(c, store, [3], { settings: settings(), system: 'SYS', values: { 쟈알디: '거짓말 안 함' }, names });
  return { c, store, input };
}

test('묶음 계획: 6턴 또는 글자 상한', () => {
  const c = { message: Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: 'x'.repeat(1000), chatId: `m${i}` })) };
  const unread = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  assert.deepEqual(U.planBatches(c, unread, 100000).map((b) => b.length), [6, 4]);
  assert.deepEqual(U.planBatches(c, unread, 5000).map((b) => b.length), [2, 2, 2, 2, 2]);
});

test('요청 자료: 확정·맥락 구간, 꼬리표, 장면 인물, 태그 신호, 이미 기록된 것', () => {
  const { store, input } = setup();
  const span = input.data.span;
  assert.deepEqual(span.map((s) => [s.m, s.role, !!s.confirmed]), [['m1', 'user', false], ['m2', 'assistant', false], ['m3', 'user', true], ['m4', 'assistant', true]]);
  assert.ok(!span[3].text.includes('[▣'), '상태창 줄은 지움');
  assert.ok(!span[3].text.includes('[AG'), '요원 태그는 지움');
  assert.deepEqual(input.people.sort(), ['데쥬레', '쟈알디']);
  assert.deepEqual(input.data.signals, [{ who: '쟈알디', tag: '상태', from: '내근', to: '부상', note: 'Record how and why in `state`; add one `history` line.' }]);
  const me = input.data.people.find((p) => p.name === '쟈알디');
  assert.equal(me.values, '거짓말 안 함');
  assert.equal(me.entries.threads[0].id, 'e07');
  assert.equal(me.affinity_now, '무관심(60)');
  assert.equal(input.data.want.next_note, true);
  assert.equal(store.read.c2, undefined, '자료를 만들 뿐 읽음 표시는 안 함');
});

test('지침 조립: 꺼진 절은 빼고 표식은 지우고 사용자 규칙을 덧붙인다', () => {
  const text = 'A\n<<SECTION:affinity>>AFF<<END:affinity>>\n<<SECTION:suspicion>>SUS<<END:suspicion>>\nZ';
  const out = U.assemblePrompt(text, new Set(['affinity']), '한국어로');
  assert.match(out, /AFF/);
  assert.doesNotMatch(out, /SUS|<<|>>/);
  assert.match(out, /## User rules[\s\S]*한국어로/);
  const on = U.enabledSections(settings());
  assert.ok(on.has('affinity') && on.has('next_note') && on.has('docs_event'));
});

test('응답 읽기: 울타리·앞뒤 글 허용, 객체 아니면 거부', () => {
  assert.deepEqual(U.parseUpdate('설명\n```json\n{"entries":[]}\n```'), { entries: [] });
  assert.deepEqual(U.parseUpdate('<think>x</think>{"cues":[]}'), { cues: [] });
  assert.throws(() => U.parseUpdate('[1,2]'));
  assert.throws(() => U.parseUpdate('{"entries":"x"}'));
});

test('반영: 항목 add/upsert/remove 보류, 계기 상한·중복, 호칭, 신분, 메모, 읽음 표시', () => {
  const { c, store, input } = setup();
  const r = {
    entries: [
      { who: '쟈알디', slot: 'state', op: 'upsert', replace: 'e12', text: '왼팔 부상 (유저를 감싸다)', m: 'm4', quote: '팔을 다쳤다' },
      { who: '쟈알디', slot: 'knowledge', op: 'add', text: '유저가 명단을 봤다', m: 'm3', quote: '명단을 봤다' },
      { who: '쟈알디', slot: 'knowledge', op: 'add', text: '유저가 명단을 봤다는 것', m: 'm3', quote: '명단을 봤다' },
      { who: '쟈알디', slot: 'threads', op: 'remove', replace: 'e07', m: 'm4', quote: '팔을 다쳤다' },
      { who: '데쥬레', slot: 'knowledge', op: 'add', text: '금고 비밀번호', m: 'm4', quote: '비밀번호를 알았다' },
      { who: '데쥬레', slot: 'state', op: 'add', text: '지어낸 사실', m: 'm4', quote: '여기 없는 말' },
      { who: '부장', slot: 'history', op: 'add', text: '유저를 감쌌다', m: 'm4', quote: '감싸 안으며' },
      { who: '아무개', slot: 'state', op: 'add', text: 'x', m: 'm4', quote: '팔을' },
      { who: '쟈알디', slot: 'scene', op: 'add', text: '맥락 메시지 근거', m: 'm2', quote: '커피를 탔다' },
    ],
    cues: [
      { who: '쟈알디', cue: '큰도움', m: 'm4', quote: '감싸 안으며', reason: '유저가 몸으로 막음' },
      { who: '쟈알디', cue: '도움', m: 'm3', quote: '명단을 봤다', reason: '정보 공유' },
      { who: '쟈알디', cue: '작은친절', m: 'm3', quote: '명단을', reason: '세 번째' },
      { who: '데쥬레', cue: '엉뚱', m: 'm4', quote: '비밀번호', reason: 'x' },
    ],
    address: [{ who: '쟈알디', toUser: '너', register: '반말', m: 'm4', quote: '그냥 너라고 할게' }],
    identity: { faction: '관리국', rank: '신입' },
    next_note: [{ who: '쟈알디', now: 'Guards the door.', must_not_reveal: ['유저의 전직'] }, { who: '잼트리', now: 'x' }],
  };
  const rep = U.applyUpdate(store, c, input, r, { settings: settings() });
  assert.equal(rep.applied.entries, 4, 'upsert 1 + add 2(쟈알디 지식, 데쥬레 지식) + 부장→쟈알디 history 1');
  assert.ok(rep.dropped.some((d) => d.reason === '같은 뜻의 항목이 이미 있음'));
  assert.ok(rep.dropped.some((d) => d.reason === '인용이 원문에 없음'));
  assert.ok(rep.dropped.some((d) => d.reason === '명단에 없는 이름' && d.who === '아무개'));
  assert.ok(rep.dropped.some((d) => d.reason === '확정 구간 밖 메시지'));
  assert.ok(rep.held.some((h) => h.reason === '삭제 근거가 분명하지 않음'));
  const live = S.liveness(c);
  const state = S.liveEntries(store.people.쟈알디.slots.state, live);
  assert.deepEqual(state.map((e) => e.text), ['왼팔 부상 (유저를 감싸다)']);
  assert.equal(rep.applied.cues, 2);
  assert.ok(rep.dropped.some((d) => d.reason === '인물당 2개 상한'));
  assert.ok(rep.dropped.some((d) => d.reason === '표에 없는 계기'));
  const changes = S.liveChanges(store, live);
  assert.equal(A.affinityOf(store.people.쟈알디, changes), 8);
  assert.deepEqual(A.addressOf(store.people.쟈알디, changes), { toUser: '너', register: '반말' });
  assert.equal(store.identity.faction, '관리국');
  assert.equal(rep.applied.notes, 1);
  assert.deepEqual(U.latestNote(store, '쟈알디', live), { now: 'Guards the door.', mustNot: ['유저의 전직'] });
  assert.deepEqual(S.unreadIndexes(c, store), [1], '읽은 응답은 표시, 앞 응답은 아직');
});

test('반영: 다시 굴려 응답이 바뀌면 그 응답 근거 항목·계기가 빠지고 옛 항목이 돌아온다', () => {
  const { c, store, input } = setup();
  U.applyUpdate(store, c, input, { entries: [{ who: '쟈알디', slot: 'state', op: 'upsert', replace: 'e12', text: '왼팔 부상', m: 'm4', quote: '팔을 다쳤다' }], cues: [{ who: '쟈알디', cue: '헌신', m: 'm4', quote: '감싸 안으며' }] }, { settings: settings() });
  const c2 = { message: [...c.message.slice(0, 3), { role: 'char', data: '쟈알디는 서류만 봤다.', chatId: 'c2b' }] };
  const live = S.liveness(c2);
  assert.deepEqual(S.liveEntries(store.people.쟈알디.slots.state, live).map((e) => e.text), ['본부 사무실']);
  assert.equal(A.affinityOf(store.people.쟈알디, S.liveChanges(store, live)), 0);
  assert.deepEqual(S.unreadIndexes(c2, store), [1, 3]);
});

test('새 인물: 2턴 규칙·역할 명사·별명 충돌·상한, 확인 모드', () => {
  const { c, store, input } = setup();
  const np = (name, extra = {}) => ({ name, aliases: [], m: 'm4', quote: '감싸 안으며', identity: '관리국 사람', ...extra });
  let rep = U.applyUpdate(store, c, input, { new_people: [np('김철수'), np('택시 기사'), np('Jyaldi')] }, { settings: settings({ twoTurn: true }) });
  assert.ok(rep.held.some((h) => h.who === '김철수' && /2턴/.test(h.reason)));
  assert.ok(rep.dropped.some((d) => d.who === '택시 기사' && d.reason === '역할 명사'));
  assert.ok(rep.dropped.some((d) => d.who === 'Jyaldi' && /이미 있는/.test(d.reason)));
  assert.ok(!store.people.김철수 && store.pending.김철수);
  // 다음 턴에 다시 나오면 등록
  const c2 = { message: [...c.message, { role: 'user', data: '김철수를 불렀다', chatId: 'u3' }, { role: 'char', data: '김철수가 왔다. 감싸 안으며 인사했다.', chatId: 'c3' }] };
  const input2 = U.buildUpdate(c2, store, [5], { settings: settings(), system: 'S', values: {}, names });
  rep = U.applyUpdate(store, c2, input2, { new_people: [{ name: '김철수', aliases: ['철수'], m: 'm4', quote: '김철수가 왔다', identity: '관리국 신입' }] }, { settings: settings(), sheetOf: () => null, baseOf: () => ({ faction: 'A00' }) });
  assert.deepEqual(rep.applied.newPeople, ['김철수']);
  assert.equal(store.people.김철수.seeded.from, 'none');
  assert.deepEqual(store.people.김철수.aliases, ['철수']);
  assert.equal(store.people.김철수.slots.identity[0].text, '관리국 신입');
  // 2턴 규칙 끄고 확인 모드: 대기에만
  const store3 = T.emptyStore();
  store3.people.쟈알디 = person('쟈알디');
  rep = U.applyUpdate(store3, c, input, { new_people: [np('박영희')] }, { settings: settings({ twoTurn: false, newPeople: 'confirm' }) });
  assert.ok(rep.held.some((h) => h.reason === '확인 뒤 등록'));
  assert.ok(store3.pending.박영희 && !store3.people.박영희);
  // 2턴 규칙 끔 + 자동: 바로, 턴당 2명
  const store4 = T.emptyStore();
  store4.people.쟈알디 = person('쟈알디');
  rep = U.applyUpdate(store4, c, input, { new_people: [np('가'), np('나'), np('다')] }, { settings: settings({ twoTurn: false }) });
  assert.deepEqual(rep.applied.newPeople, ['가', '나']);
  assert.ok(rep.dropped.some((d) => d.reason === '턴당 2명 상한'));
});

test('문서·의심: 종류 검사, 꺼진 기능, 의심 해소는 접는다', () => {
  const { c, store, input } = setup();
  const rep = U.applyUpdate(store, c, input, {
    docs: [
      { type: 'event', key: '본부 부상 사건', op: 'add', text: '쟈알디가 유저를 감싸다 왼팔을 다쳤다', m: 'm4', quote: '팔을 다쳤다', date: '2025.01.01', place: '본부', who: ['쟈알디', '@user'] },
      { type: 'scene', key: 'x', op: 'add', text: 'y', m: 'm4', quote: '팔을' },
      { type: 'item', key: '명단', op: 'upsert', replace: 'nope', text: 'z', m: 'm3', quote: '명단을 봤다' },
    ],
    suspicion: [
      { who: '데쥬레', target: '@user', kind: '배신', op: 'open', text: '유저가 명단을 봤다는 말을 의심', m: 'm3', quote: '명단을 봤다' },
      { who: '데쥬레', target: '@user', kind: '배신', op: 'clue', text: '비밀번호를 알고 있었다', m: 'm4', quote: '비밀번호를 알았다' },
      { who: '데쥬레', target: '@user', kind: '배신', op: 'close', text: '오해로 밝혀짐', m: 'm4', quote: '비밀번호를 알았다' },
      { who: '데쥬레', target: '@user', kind: '질투', op: 'open', text: 'x', m: 'm4', quote: '비밀번호' },
    ],
  }, { settings: settings() });
  assert.equal(rep.applied.docs, 1);
  assert.ok(rep.dropped.some((d) => d.kind === 'doc' && /없는 문서 종류/.test(d.reason)));
  assert.ok(rep.dropped.some((d) => d.kind === 'doc' && /replace/.test(d.reason)));
  const ev = store.docs['event:본부 부상 사건'];
  assert.equal(ev.entries[0].date, '2025.01.01');
  assert.equal(rep.applied.suspicion, 3);
  assert.ok(rep.dropped.some((d) => d.reason === '없는 의심 종류'));
  const live = S.liveness(c);
  const su = S.liveEntries(store.people.데쥬레.slots.suspicion, live);
  assert.deepEqual(su.map((e) => e.text), ['[시작] 유저가 명단을 봤다는 말을 의심', '[해소] 오해로 밝혀짐'], '해소는 마지막 단서를 대체');
  // 기능 끔
  const rep2 = U.applyUpdate(store, c, input, { suspicion: [{ who: '데쥬레', target: '@user', kind: '정체', op: 'open', text: 'q', m: 'm4', quote: '팔을' }] }, { settings: settings({ features: new Set(['affinity']) }) });
  assert.equal(rep2.applied.suspicion, 0);
});

test('유사 문장 판정', () => {
  assert.ok(U.similar('유저가 명단을 봤다', '유저가 명단을 봤다는 것'));
  assert.ok(U.similar('왼팔 부상, 3일차', '왼팔  부상 3일차.'));
  assert.ok(!U.similar('왼팔 부상', '오른다리 골절'));
});

test('유저가 연기하는 요원은 장면 인물·새 인물에서 빠진다', () => {
  const { c, store } = setup();
  store.people.이도형 = person('이도형', { faction: 'B00' });
  const input = U.buildUpdate(c, store, [3], { settings: settings(), system: 'S', values: {}, names: [...names, { name: '이도형', aliases: [], titles: [] }], exclude: ['이도형'] });
  assert.ok(!input.people.includes('이도형'), '장면 인물에서 제외');
  const r = { new_people: [{ name: '이도형', aliases: [], identity: '회사 부장', speech: null, m: 'm4', quote: '쟈알디가 말했다' }] };
  delete store.people.이도형;
  const rep = U.applyUpdate(store, c, input, r, { settings: settings({ twoTurn: false }), exclude: ['이도형'] });
  assert.equal(rep.applied.newPeople.length, 0);
  assert.ok(rep.dropped.some((d) => d.reason === '유저가 연기하는 요원'));
});

test('기본값: 인물끼리 감정 켬, 기록 상한 2000, 접기 상한 20000, 말투 5종', () => {
  const s = St.peopleSettings({});
  assert.ok(s.features.has('npc_emotion'));
  assert.equal(s.perCap, 2000);
  assert.equal(s.spanCap, 20000);
  assert.deepEqual(T.REGISTERS, ['존댓말', '반말', '혼합', '하게체', '하오체']);
  const st = S.peopleStore({ goeiPeopleV1: { people: { a: { name: 'a', address: { toUser: '자네', register: '하게체' } }, b: { name: 'b', address: { register: '이상' } } } } });
  assert.equal(st.people.a.address.register, '하게체');
  assert.equal(st.people.b.address.register, '존댓말');
});

test('문서: 인용이 없어도 확정 구간 메시지면 받고, 있으면 원문에 있어야 한다', () => {
  const { c, store, input } = setup();
  const rep = U.applyUpdate(store, c, input, {
    docs: [
      { type: 'event', key: '명단 사건', op: 'add', text: '유저가 명단을 봤다고 쟈알디에게 말했다', m: 'm4', quote: null },
      { type: 'event', key: '없는 인용', op: 'add', text: 'x', m: 'm4', quote: '이 글은 원문에 없다' },
      { type: 'event', key: '맥락 구간', op: 'add', text: 'x', m: 'm1', quote: null },
    ],
  }, { settings: settings() });
  assert.equal(rep.applied.docs, 1);
  assert.ok(store.docs['event:명단 사건'] && !store.docs['event:명단 사건'].entries[0].quote);
  assert.ok(rep.dropped.some((d) => d.reason === '인용이 원문에 없음'));
  assert.ok(rep.dropped.some((d) => d.reason === '확정 구간 밖 메시지'));
});
