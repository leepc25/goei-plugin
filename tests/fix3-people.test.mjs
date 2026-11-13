// 전수검사 11-13 인물 기록 고침 3: 단계 글·꼬리 글이 지침 「Main」 절로 (기본 글은 옛 글과 같다), 말투만 고친 호칭 변경, 성적 정책 글 한 번, 갱신기 본문 정리·계기 이름
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix3/people';
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
const ENTRY = `
export * as T from './src/core/people/types';
export * as S from './src/core/people/store';
export * as Inj from './src/core/people/inject';
export * as R from './src/core/people/request';
export * as Fac from './src/core/people/faction';
export * as Rh from './src/core/people/rhythm';
export * as Ax from './src/core/people/axes';
export * as Aff from './src/core/people/affinity';
export * as Sx from './src/core/people/sexual';
export * as U from './src/core/people/updater';
export * as St from './src/core/people/settings';
export * as G from './src/core/guides';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { T, S, Inj, R, Fac, Rh, Ax, Aff, Sx, U, St, G } = await import(pathToFileURL(outfile));

const NEW = /^(PEOPLE\.(EXPRESS_\d|TASTE_NOTE|OPENNESS_NOTE|AFFINITY\.\d|TASTE\.-?\d|OPENNESS\.\d|AXIS\.[A-Za-z]+\.\d)|RHYTHM\.(HEAD|CLOCK_HEAD|METHOD)|FACTION\.(HEAD|STAGE\.[a-z]+)|STATUS\.RECENT_(CASH|POINT))$/;
const cutNew = (src) => src.replace(/@@SECTION ([^\n]+)\n[\s\S]*?\n@@END\n?\n?/g, (all, n) => (NEW.test(n.trim()) ? '' : all));
const withEdit = (src, name, f) => src.replace(new RegExp(`(@@SECTION ${name.replace(/[.]/g, '\\.')}\\n)([\\s\\S]*?)(\\n@@END)`), (a, h, b, e) => h + f(b) + e);
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const person = (name, extra = {}) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {}, ...extra });

const render = () => {
  const c = chat(['user', '출근', 'u1'], ['char', '쟈알디가 말했다.', 'c1']);
  const store = T.emptyStore();
  const p = person('쟈알디');
  store.people.쟈알디 = p;
  const live = S.liveness(c);
  const out = [];
  [-80, -40, -5, 0, 100, 150, 200, 280].forEach((base, i) => {
    p.affinity.base = base;
    const ch = [
      { id: 't', anchor: 'c1', seq: 0, src: 'story', who: '쟈알디', kind: 'taste', band: Math.min(3, i - 3) },
      { id: 'o', anchor: 'c1', seq: 1, src: 'story', who: '쟈알디', kind: 'openness', init: [0, 90, 150, 210, 270][i % 5] },
    ];
    out.push(Inj.personBlock(p, store, live, ch, { mode: 'record', user: '김솔음', taste: true, openness: true, axes: true }));
  });
  out.push(Ax.axesLinesEn({ relationalInitiative: 10, expressionDirectness: 30, emotionalExpressiveness: 50, guardedness: 70, impulsivity: 90, relationshipPersistence: 100 }).join('\n'));
  const fl = ['friendly', 'favorable', 'neutral', 'wary', 'hostile'].map((id, i) => ({ code: `X${i}`, name: `세력${i}`, value: 0, stage: T.FACTION_STAGES[id], base: 0 }));
  out.push(Fac.factionsBlock(fl, '김솔음'), Fac.factionsBlock(fl));
  out.push(Rh.rhythmClockLines({ turn: 3, hooks: [], active: { short: 0, mid: 0, long: 0 }, lastPlant: null, plantAllowed: true, plantBlocked: '', priority: [], lastMethod: 'sound' }).join('\n'));
  out.push(Inj.rhythmBlock([{ key: 'hook:a', text: 'x' }], null, ['clock']));
  return out.join('\n=====\n');
};

test('새 절이 있어도 없어도 요청 글이 같다 (기본 글 = 옛 코드 글)', () => {
  G.setGuideOverride('Main', '');
  const base = render();
  assert.match(base, /Relationship → 김솔음: 극도의 적대 \(Extreme hostility\. Keep the actual cause/);
  assert.match(base, /## Factions → 김솔음 \(standing of each organization toward 김솔음, kept by the system; members act accordingly\)/);
  assert.match(base, /Members welcome 김솔음, share information freely and take 김솔음's side/);
  assert.match(base, /Previous staging method: sound — do not use the same anticipation method in consecutive turns\./);
  const cut = cutNew(G.guideDefault('Main'));
  assert.ok(!cut.includes('PEOPLE.AFFINITY.0') && cut.includes('PEOPLE.RULE') && cut.includes('SEXUAL.POLICY'));
  G.setGuideOverride('Main', cut);
  try {
    assert.equal(G.guideSec('Main', 'FACTION.HEAD'), null);
    assert.equal(render(), base);
  } finally { G.setGuideOverride('Main', ''); }
});

test('절을 고치면 그 글이 바뀐다', () => {
  const MARK = 'ZZ-EDIT';
  for (const name of ['PEOPLE.AFFINITY.0', 'PEOPLE.AFFINITY.7', 'PEOPLE.TASTE.-3', 'PEOPLE.TASTE.3', 'PEOPLE.OPENNESS.0', 'PEOPLE.OPENNESS.4', 'PEOPLE.AXIS.guardedness.3', 'FACTION.HEAD', 'FACTION.STAGE.hostile', 'RHYTHM.METHOD']) {
    G.setGuideOverride('Main', withEdit(G.guideDefault('Main'), name, (b) => `${b} ${MARK}`));
    try { assert.ok(render().includes(MARK), name); } finally { G.setGuideOverride('Main', ''); }
  }
});

test('호칭: 호칭 없이 말투만 고친 변경도 말투에 반영된다', () => {
  const p = person('새인물', { address: { toUser: '', register: '존댓말' } });
  const reg = [{ id: 'a1', anchor: 'c1', seq: 0, src: 'manual', who: '새인물', kind: 'address', toUser: '', register: '반말' }];
  assert.deepEqual(Aff.addressOf(p, reg), { toUser: '', register: '반말' });
  const both = [{ id: 'a0', anchor: 'c0', seq: 0, src: 'story', who: '새인물', kind: 'address', toUser: '선배', register: '존댓말' }, ...reg];
  assert.deepEqual(Aff.addressOf(p, both), { toUser: '선배', register: '반말' });
  p.address.pin = true;
  assert.deepEqual(Aff.addressOf(p, both), { toUser: '', register: '존댓말' }, '고정은 그대로');
});

test('성적 프로필 정책 글은 여러 인물 블록에서 한 번만', () => {
  const s = St.peopleSettings({ $pp_axes: '1', $pp_sexual_desire: '1' });
  assert.ok(s.sexualDesire && s.features.has('axes'));
  const store = T.emptyStore();
  for (const n of ['쟈알디', '도경']) {
    const p = person(n);
    Sx.setSexualText(p, 'desire', `${n} 취향`, 'c1', true);
    store.people[n] = p;
  }
  const c = chat(['user', '쟈알디와 도경을 만난다', 'u1'], ['char', '쟈알디와 도경이 왔다.', 'c1'], ['user', '인사', 'u2']);
  const r = R.peopleBlockFor(c, { settings: s, store, sheetOf: () => null, user: '김솔음' });
  assert.deepEqual(r.people.sort(), ['도경', '쟈알디']);
  assert.equal(r.text.split('Sexual profile (policy: sexual_context_only').length - 1, 2);
  assert.equal(r.text.split(Sx.sexualDirectorPolicy()).length - 1, 1, '정책 긴 글은 한 번');
  // 한 인물 블록(기본)은 그대로 긴 글을 붙인다
  const one = Inj.personBlock(store.people.쟈알디, store, S.liveness(c), [], { sexual: Sx.sexualTexts(store.people.쟈알디, s) });
  assert.ok(one.includes(`Sexual profile (policy: sexual_context_only — ${Sx.sexualDirectorPolicy()})`));
});

test('갱신기 본문: 생각·주석·그림 태그·상점 표식을 뺀다', () => {
  const t = U.cleanSpan('<Thoughts>비밀</Thoughts>\n쟈알디가 왔다.\n<img="쟈알디_neutral">\n<!-- note -->\n그는 웃었다. <think>x</think> [shop: 칼집|주인]', 10000);
  assert.ok(!/비밀|<img|note|<think>|shop/.test(t), t);
  assert.match(t, /쟈알디가 왔다\.[\s\S]*그는 웃었다\./);
});

test('갱신기 자료: 호감이 글로만이어도 세력 평판 수치가 켜져 있으면 계기 이름을 준다', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const c = chat(['user', '출근', 'u1'], ['char', '쟈알디가 왔다.', 'c1']);
  const names = [{ name: '쟈알디', aliases: [], titles: [] }];
  const cuesOf = (st) => U.buildUpdate(c, store, [1], { settings: St.peopleSettings(st), system: 'SYS', values: {}, names }).data.cues;
  assert.deepEqual([...cuesOf({ $pp_num_affinity: '0' })], [...T.CUES]);
  assert.deepEqual([...cuesOf({ $pp_affinity: '0' })], [...T.CUES]);
  assert.deepEqual(cuesOf({ $pp_num_affinity: '0', $pp_num_faction_rep: '0' }), []);
  assert.deepEqual(cuesOf({ $pp_num_affinity: '0', $pp_faction_rep: '0' }), []);
  assert.deepEqual([...cuesOf({})], [...T.CUES]);
});

test('성적 문체: 고친 글이 이미 「When false」로 시작하면 두 번 붙이지 않는다', () => {
  const s = St.peopleSettings({ $pp_axes: '1', $pp_sexual_desire: '1', $pp_explicit_style: '0' });
  const def = Sx.sexualWriterSection(s);
  assert.ok(def.includes('When false, use the 0.10.7 style') && def.includes('When true, write like adults'));
  G.setGuideOverride('UpdaterExtra', withEdit(G.guideDefault('UpdaterExtra'), 'SEXUAL.PLAIN_STYLE', () => 'When false, keep it blunt.'));
  try {
    const out = Sx.sexualWriterSection(s);
    assert.ok(out.includes('When false, keep it blunt.') && !out.includes('When false: When false'));
  } finally { G.setGuideOverride('UpdaterExtra', ''); }
});
