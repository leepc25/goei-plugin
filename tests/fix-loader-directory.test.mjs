// loader#2 (전수검사 11-13): 명부에서 지운 거점·조직과 일부러 비운 칸이 「빠진 것 전부 채우기」·카드 업데이트 때 되살아나지 않는다
import test from 'node:test';
import assert from 'node:assert/strict';
import { installLore, installCheck, installData, readDirectoryData, readDirectory, directoryData, withDirectory, fillDirectory } from '../dist-test/core.mjs';

const DEF = installData().directory;
const GREET = installData().greetings.index;
// 정식 카드처럼 괴이·파밍·요원·부록 폴더에 기본 명부의 항목이 로어북으로 있다 (명부 편집기는 로어북에 있는 항목만 적는다)
const FOLDERS = { 괴이: '🚧괴이', '미스틱 사이트': '🎁파밍', 요원: '🙂요원', 부록: '📎부록' };
const cardLore = () =>
  Object.entries(FOLDERS).flatMap(([sec, name]) => [
    { key: `folder:${sec}`, comment: name, content: '', mode: 'folder' },
    ...Object.keys(DEF[sec] ?? {}).map((n) => ({ key: n, comment: n, content: n, mode: 'normal', folder: `folder:${sec}` })),
  ]);
const fresh = () => installLore(cardLore(), GREET);
const check = (lore) => installCheck({ lore, firstMessage: '', loreSettings: undefined, alternateGreetings: [], assets: [], iconOurs: false, wikiPack: false, tokenizer: false });
/** 명부 편집기 저장과 같은 길: 읽은 명부를 고쳐 directoryData → withDirectory */
const save = (lore, edit) => {
  const d = readDirectory(lore);
  edit(d);
  return withDirectory(lore, directoryData(d));
};
const baseName = Object.keys(DEF.거점)[0];
const agentLore = Object.keys(DEF.요원).find((n) => DEF.요원[n].affiliation && DEF.요원[n].rank && DEF.요원[n].roster_for?.length);

test('바탕: 아무것도 고치지 않고 저장한 명부는 빠진 칸이 없다', () => {
  assert.equal(check(save(fresh(), () => {})).directoryGaps, 0);
});

test('지운 기본 거점은 다시 채우지 않는다 (점검도 빠진 칸으로 세지 않음)', () => {
  assert.ok(baseName, '기본 명부에 거점이 있다');
  const lore = save(fresh(), (d) => (d.bases = d.bases.filter((b) => b.name !== baseName)));
  assert.equal(baseName in readDirectoryData(lore).거점, false);
  assert.equal(check(lore).directoryGaps, 0, '지운 거점을 빠진 칸으로 세지 않는다');
  const again = installLore(lore, GREET);
  assert.equal(baseName in readDirectoryData(again).거점, false, '채우기 뒤에도 지운 채');
  // 카드 업데이트 길 (core/update.ts addDirectoryDefaults = fillDirectory(지금 명부, 새 카드 명부))
  const filled = fillDirectory(readDirectoryData(lore), DEF);
  assert.equal(filled.gaps, 0);
  assert.equal(baseName in filled.data.거점, false);
});

test('거점을 전부 지워도 되살아나지 않고, 같은 이름으로 다시 만들면 지운 기록이 풀린다', () => {
  const lore = save(fresh(), (d) => (d.bases = []));
  assert.deepEqual(Object.keys(readDirectoryData(installLore(lore, GREET)).거점 ?? {}), []);
  assert.equal(check(lore).directoryGaps, 0);
  const back = withDirectory(lore, { ...readDirectoryData(lore), 거점: { [baseName]: DEF.거점[baseName] } });
  assert.equal((readDirectoryData(back)._removed?.거점 ?? []).includes(baseName), false);
  assert.ok(baseName in readDirectoryData(back).거점);
});

test('이름을 바꾼 기본 거점이 옛 이름으로 하나 더 생기지 않는다', () => {
  const lore = save(fresh(), (d) => (d.bases.find((b) => b.name === baseName).name = `${baseName} (바꿈)`));
  const names = Object.keys(readDirectoryData(installLore(lore, GREET)).거점);
  assert.equal(names.includes(baseName), false);
  assert.ok(names.includes(`${baseName} (바꿈)`));
});

test('일부러 비운 칸(소속 미정·직급 없음·목록에서 숨김)은 그대로 둔다', () => {
  assert.ok(agentLore, '소속·직급·목록이 있는 기본 요원');
  const lore = save(fresh(), (d) => {
    const a = d.agents.find((x) => x.lore === agentLore);
    a.affiliation = '';
    a.rank = '';
    a.rosterFor = [];
  });
  assert.equal(check(lore).directoryGaps, 0, '비운 칸을 빠진 칸으로 세지 않는다');
  const row = readDirectoryData(installLore(lore, GREET)).요원[agentLore];
  assert.equal(row.affiliation, '');
  assert.equal(row.rank, '');
  assert.deepEqual(row.roster_for, []);
});

test('지운 기록은 다른 저장(지운 기록을 모르는 명부 값)에도 남는다', () => {
  const lore = save(fresh(), (d) => (d.bases = d.bases.filter((b) => b.name !== baseName)));
  const next = save(lore, (d) => (d.refill = 3));
  assert.deepEqual(readDirectoryData(next)._removed?.거점, [baseName]);
});

test('없는 항목·없는 칸·기본 명부를 받은 적 없는 명부(10-29 깡통봇)는 그대로 채운다', () => {
  // 새 카드에만 있는 거점·칸은 들어온다
  const cur = { schema: 1, 거점: { 가: { sido: '서울', gu: '중구', x: 1, y: 1 } }, 요원: { ㄱ: { name: 'ㄱ', affiliation: '' } } };
  const def = { 거점: { 가: { sido: '서울', gu: '중구', x: 1, y: 1, english: 'A' }, 나: { sido: '부산', gu: '중구', x: 2, y: 2 } }, 요원: { ㄱ: { name: 'ㄱ', affiliation: 'A00', carry: 3 } } };
  const f = fillDirectory(cur, def);
  assert.ok('나' in f.data.거점, '없는 항목');
  assert.equal(f.data.거점.가.english, 'A', '없는 칸');
  assert.equal(f.data.요원.ㄱ.carry, 3, '없는 칸');
  assert.equal(f.data.요원.ㄱ.affiliation, '', '비운 칸은 그대로');
  // 거점이 비어 있고 지운 기록도 없는 명부: 빈 칸도 기본 값으로 (2026-10-29 사용자: 깡통봇 명부 거점 0·소속 없음)
  const bare = fillDirectory({ schema: 1, 거점: {}, 요원: { ㄱ: { name: 'ㄱ', affiliation: '' } } }, def);
  assert.equal(Object.keys(bare.data.거점).length, 2);
  assert.equal(bare.data.요원.ㄱ.affiliation, 'A00');
});
