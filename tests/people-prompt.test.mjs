import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-prompt-'));
await build({ entryPoints: ['src/core/people/prompt/index.ts', 'src/core/people/updater.ts', 'src/core/people/settings.ts', 'src/core/people/field.ts', 'src/core/people/types.ts', 'src/core/people/store.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const P = await mod('prompt/index');
const U = await mod('updater');
const St = await mod('settings');
const F = await mod('field');
const T = await mod('types');
const S = await mod('store');

const sections = (t) => [...t.matchAll(/<<SECTION:([a-z_]+)>>/g)].map((m) => m[1]).sort();

test('지침 두 벌: 절 표식이 같고 짝이 맞고, 조립하면 표식이 남지 않는다', () => {
  assert.deepEqual(sections(P.UPDATER_DETAILED), sections(P.UPDATER_COMPACT));
  for (const t of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    const open = [...t.matchAll(/<<SECTION:([a-z_]+)>>/g)].length;
    const close = [...t.matchAll(/<<END:([a-z_]+)>>/g)].length;
    assert.equal(open, close);
    assert.ok(!t.includes('{{') && !t.includes('}}'), 'CBS 기호 없음');
  }
  const s = St.peopleSettings({});
  const full = U.assemblePrompt(P.promptFor(s), U.enabledSections(s), '');
  assert.ok(!/<<[A-Z_:a-z]+>>/.test(full));
  assert.ok(!/User rules/.test(full), '규칙이 없으면 user_rules 절은 빠진다');
  const withRules = U.assemblePrompt(P.promptFor(s), U.enabledSections(s), '한국어 존댓말로만 판정한다');
  assert.match(withRules, /User rules[\s\S]*한국어 존댓말로만/);
  const off = U.assemblePrompt(P.promptFor(s), new Set(), '');
  assert.ok(off.length < full.length);
  assert.ok(!/<<[A-Z_:a-z]+>>/.test(off));
  // 간결판이 자세히판보다 짧고, 둘 다 출력 계약을 담는다
  assert.ok(P.UPDATER_COMPACT.length < P.UPDATER_DETAILED.length);
  for (const t of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) assert.match(t, /"new_people"[\s\S]*"docs"[\s\S]*"suspicion"[\s\S]*"next_note"/);
});

test('필드 사건 → 기록: 선물은 계기, 부상은 상태, 동행 해제는 대체', () => {
  const chat = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: 'b', chatId: 'c1' }] };
  const store = T.emptyStore();
  store.people.쟈알디 = { name: '쟈알디', faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] };
  const ev = (id, kind, who, extra = {}) => ({ id, at: 1, anchor: 'c1', kind, text: `${kind} 사건`, who, ...extra });
  assert.equal(F.applyFieldEvent(store, chat, ev('e1', 'gift', ['주인공', '쟈알디']), '주인공'), 2, '계기 + 행적');
  assert.equal(F.applyFieldEvent(store, chat, ev('e1', 'gift', ['주인공', '쟈알디']), '주인공'), 0, '같은 사건은 한 번');
  assert.equal(F.applyFieldEvent(store, chat, ev('e2', 'hurt', ['쟈알디'], { scene: '복도' }), '주인공'), 3, '계기 + 상태 + 행적');
  F.applyFieldEvent(store, chat, ev('e3', 'follow', ['쟈알디']), '주인공');
  F.applyFieldEvent(store, chat, ev('e4', 'unfollow', ['쟈알디']), '주인공');
  const live = S.liveness(chat);
  const state = S.liveEntries(store.people.쟈알디.slots.state, live).map((e) => e.text);
  assert.ok(state.some((t) => t.startsWith('부상')));
  assert.ok(!state.some((t) => t === '유저와 동행 중'), '동행 해제로 대체됨');
  assert.equal(F.applyFieldEvent(store, chat, ev('e5', 'gift', ['주인공', '모르는사람']), '주인공'), 0);
});
