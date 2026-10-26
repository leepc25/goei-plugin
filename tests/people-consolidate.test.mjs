// 인물 기록 정리 (보조 모델 1회): 요청 자료·응답 검사·반영
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-con-'));
await build({
  entryPoints: ['src/core/people/consolidate.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/updater.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const C = await mod('consolidate');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const U = await mod('updater');

const chat = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: '쟈알디가 왔다. 명단을 봤다. 팔을 다쳤다.', chatId: 'c1' }] };
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const e = (id, text, extra = {}) => ({ id, text, src: 'story', anchor: 'c1', seq: 1, quote: '왔다', ...extra });

test('정리: 입력은 살아 있는 비고정 항목만, 칸 상한 포함; 결과는 from 으로 원본을 접거나 대체한다', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.state = [e('s1', '본부에 있음'), e('s2', '왼팔 부상'), e('s3', '피곤함'), e('s4', '고정', { pin: true }), e('s5', '취소', { void: true })];
  store.people.쟈알디.slots.history = [e('h1', '명단 사건'), e('h2', '부상')];
  const settings = { ...St.peopleSettings({}), capScale: 1 };
  const input = C.buildConsolidate(store, chat, '쟈알디', settings);
  assert.deepEqual(input.data.slots.state.map((x) => x.id), ['s1', 's2', 's3'], '고정·취소는 안 넣음');
  assert.equal(input.data.caps.state, T.SLOT_CAP.state);
  assert.ok(input.system.includes('in Korean'));
  const r = C.parseConsolidate('```json\n{"slots":{"state":[{"text":"본부에서 왼팔을 다친 채 피곤해함","from":["s1","s2","s3"]}],"history":[{"text":"명단 사건 뒤 부상","from":["h1"]},{"text":"x","from":["h2"]}],"scene":[{"text":"없는 칸","from":["z"]}]}}\n```');
  const live = S.liveness(chat);
  const rep = C.applyConsolidate(store, '쟈알디', input, r, live, settings);
  assert.equal(rep.slots, 1, 'state 만 반영 (history 는 입력보다 줄지 않음, scene 은 입력에 없음)');
  const state = S.liveEntries(store.people.쟈알디.slots.state, live);
  assert.deepEqual(state.map((x) => x.text).sort(), ['고정', '본부에서 왼팔을 다친 채 피곤해함'].sort());
  assert.ok(store.people.쟈알디.slots.state.filter((x) => x.folded).length === 3);
  assert.equal(S.entryStates(store.people.쟈알디.slots.state, live).get('s1'), 'folded');
  assert.ok(rep.dropped.some((d) => d.slot === 'history') && rep.dropped.some((d) => d.slot === 'scene'));
  // 하나에서 온 결과는 대체 (되살릴 수 있음)
  const store2 = T.emptyStore();
  store2.people.쟈알디 = person('쟈알디');
  store2.people.쟈알디.slots.threads = [e('t1', '재조사 약속'), e('t2', '커피 약속'), e('t3', '보고서')];
  const in2 = C.buildConsolidate(store2, chat, '쟈알디', settings);
  C.applyConsolidate(store2, '쟈알디', in2, { slots: { threads: [{ text: '재조사·커피 약속', from: ['t1', 't2'] }, { text: '보고서 제출', from: ['t3'] }] } }, live, settings);
  const st = S.entryStates(store2.people.쟈알디.slots.threads, live);
  assert.equal(st.get('t1'), 'folded');
  assert.equal(st.get('t3'), 'replaced');
  assert.equal(S.liveEntries(store2.people.쟈알디.slots.threads, live).length, 2);
});

test('설정: 기록 언어 영어면 지침 끝에 언어 규칙, 칸 상한 배율 기본 2', () => {
  const s = St.peopleSettings({});
  assert.equal(s.lang, 'ko');
  assert.equal(s.capScale, 2);
  assert.equal(U.slotCap('history', 2), 24);
  const out = U.assemblePrompt('A <<USER_RULES>> B', new Set(), '', 'en');
  assert.ok(out.includes('## Record language') && out.includes('in English'));
  assert.ok(!U.assemblePrompt('A <<USER_RULES>> B', new Set(), '', 'ko').includes('Record language'));
  assert.ok(C.CONSOLIDATE_PROMPT('en').includes('in English'));
});
