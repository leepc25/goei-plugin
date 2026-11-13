// 전수검사 11-13 인물 기록 고침: 유저 대상 말투 항목이 블록에 들어가고, 인물 블록 꼬리 글·리듬 머리는 지침 절이 있으면 그 글, 없으면 옛 글 그대로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/people';
await mkdir(dir, { recursive: true });
const outfile = join(dir, `bundle-${process.pid}.mjs`);
const ENTRY = `
export * as T from './src/core/people/types';
export * as S from './src/core/people/store';
export * as Inj from './src/core/people/inject';
export * as G from './src/core/guides';
`;
await build({ stdin: { contents: ENTRY, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', target: 'es2022', charset: 'utf8', loader: { '.txt': 'text', '.css': 'text' }, outfile, logLevel: 'silent' });
const { T, S, Inj, G } = await import(pathToFileURL(outfile));

const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const setup = () => {
  const c = chat(['user', '출근', 'u1'], ['char', '쟈알디가 말했다.', 'c1']);
  const store = T.emptyStore();
  const p = person('쟈알디');
  p.slots.speech = [
    { id: 'sp1', text: '요원 (반말). 말끝을 흐린다. [말투 변화 조짐 가까워짐 1/3] 같이 밥 먹음', src: 'seed', anchor: '#0', seq: 0, target: '@user' },
    { id: 'sp2', text: '명령조', src: 'seed', anchor: '#0', seq: 1, target: '도경' },
  ];
  store.people.쟈알디 = p;
  return { p, store, live: S.liveness(c) };
};

test('유저 대상 말투 항목이 블록에 들어간다 (본편은 표지를 떼고, Director 는 남긴다)', () => {
  const { p, store, live } = setup();
  const main = Inj.personBlock(p, store, live, [], { mode: 'record', user: '김솔음' });
  assert.match(main, /Speech → 김솔음:\n- 요원 \(반말\)\. 말끝을 흐린다\.\n/);
  assert.ok(!main.includes('말투 변화 조짐'), '본편에는 표지 없음');
  assert.match(main, /Speech toward others:\n- → 도경: 명령조/);
  const dir = Inj.personBlock(p, store, live, [], { mode: 'record', user: '김솔음', speechMarks: true });
  assert.ok(dir.includes('[말투 변화 조짐 가까워짐 1/3] 같이 밥 먹음'));
});

test('인물 블록 꼬리 글·리듬 머리: 절이 없으면 옛 글 그대로, 절이 있으면 그 글', () => {
  const { p, store, live } = setup();
  for (const n of G.GUIDE_NAMES) G.setGuideOverride(n, '');
  const before = Inj.personBlock(p, store, live, [], { mode: 'record' });
  assert.ok(before.includes('Expression: restrained; small, deniable cues (pauses, gaze, delayed replies).'));
  const rh = Inj.rhythmBlock([{ key: 'hook:a', text: 'x' }], null, ['- a: 1']);
  assert.equal(rh, '## Scene rhythm (kept by the system; guidance, not content to narrate)\n- hook:a: x\nHook clock (counted by the system; never say turn numbers in the story):\n- a: 1');
  const add = (secs) => G.setGuideOverride('Main', G.guideDefault('Main') + secs.map(([k, v]) => `\n\n@@SECTION ${k}\n${v}\n@@END`).join(''));
  try {
    add([['PEOPLE.EXPRESS_1', 'EXP-ONE'], ['RHYTHM.HEAD', 'RH-HEAD'], ['RHYTHM.CLOCK_HEAD', 'RH-CLOCK']]);
    const after = Inj.personBlock(p, store, live, [], { mode: 'record' });
    assert.ok(after.includes('EXP-ONE') && !after.includes('Expression: restrained'));
    assert.equal(Inj.rhythmBlock([{ key: 'hook:a', text: 'x' }], null, ['- a: 1']), 'RH-HEAD\n- hook:a: x\nRH-CLOCK\n- a: 1');
  } finally { for (const n of G.GUIDE_NAMES) G.setGuideOverride(n, ''); }
  assert.equal(Inj.personBlock(p, store, live, [], { mode: 'record' }), before, '되돌리면 처음과 같다');
});
