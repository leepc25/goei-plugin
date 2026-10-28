import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  OLD_OUTSIDE_PLACES,
  readDirectory, migrateLore, parseCatalog, buildRegistry, directoryData, withDirectory, DIRECTORY_COMMENT, stableAgentId, assignOrg, orgOf,
} from '../dist-test/core.mjs';

import { REAL } from './realcard.mjs';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;
const j = (x) => JSON.stringify(x);

const F = (id, name) => ({ comment: name, key: `folder:${id}`, mode: 'folder', content: '' });
const L = (name, folder, key = '') => ({ comment: name, key, content: `${name} 설정`, mode: 'normal', folder: folder ? `folder:${folder}` : undefined });
const tabs = { comment: 'Phone tabs', content: JSON.stringify({ version: 1, tabs: [
  { id: 'T01', name: '관리', visible_for: ['A00'] }, { id: 'T02', name: '가짜', visible_for: ['B00'] },
  { id: 'T04', name: '중립', visible_for: ['A00', 'B00', 'C00', 'D00', 'E00'] }, { id: 'X01', name: '괴이', visible_for: ['A00', 'B00', 'C00', 'D00', 'E00'] },
] }) };
const small = () => [
  F('a', '🚧괴이'), F('s', '🎁파밍'), F('g', '🙂요원'), F('c', '⚙️설정'), tabs,
  L('명일 아파트', 'a', 'Myeongil Apartment, 명일 아파트'), L('새 괴이', 'a', '새괴이, New Thing'),
  L('도깨비 공방', 's', 'Dokkaebi Workshop'),
  L('-----관리국-----', 'g'), L('쟈알디', 'g', 'Jyaldi, 쟈알디'),
  L('-----가짜 관리국-----', 'g'), L('사장', 'g', 'Sa-jang, 사장'),
  L('-----중립-----', 'g'), L('차여진', 'g', 'Cha Yeo-jin'),
  L('-----개체-----', 'g'), L('브라우니', 'g', 'Brownie'),
];

test('폴더만 있는 카드: 로어북 키에서 처음 값을 정함', () => {
  const d = readDirectory(small());
  assert.equal(d.folders, true);
  assert.deepEqual(d.anomalies.map((p) => [p.lore, p.english, p.preset]), [['명일 아파트', 'Myeongil Apartment', true], ['새 괴이', 'New Thing', true]]);
  assert.deepEqual(d.sites.map((p) => p.lore), ['도깨비 공방']);
  assert.deepEqual(d.groups, ['관리국', '가짜 관리국', '중립', '개체']);
  const by = Object.fromEntries(d.agents.map((a) => [a.name, a]));
  assert.deepEqual([by.쟈알디.affiliation, by.쟈알디.rosterFor, by.쟈알디.phoneTabs], ['A00', ['A00'], ['T01']]);
  assert.deepEqual([by.사장.affiliation, by.사장.rosterFor, by.사장.phoneTabs], ['B00', ['B00'], ['T02']], '가장 긴 세력 이름(가짜 관리국)');
  assert.deepEqual([by.차여진.affiliation, by.차여진.rosterFor, by.차여진.phoneTabs], ['', [], []], '맞는 조직이 없으면 소속 미정');
  assert.deepEqual([by.브라우니.affiliation, by.브라우니.rosterFor], ['', []]);
  assert.deepEqual(d.orgs.map((o) => [o.name, o.faction]), [['관리국', 'A00'], ['가짜 관리국', 'B00'], ['백일몽', 'C00'], ['민간인', 'D00'], ['프리랜서', 'E00']]);
  assert.match(by.쟈알디.id, /^P\d{5}$/);
  assert.equal(by.쟈알디.id, readDirectory(small()).agents[0].id, '같은 이름이면 같은 ID');
  const cat = parseCatalog(small());
  assert.equal(cat.anomalies.length, 2);
  assert.equal(cat.people.length, 4);
  assert.deepEqual(cat.landmarks, []);
});

test('명부 값이 우선, 숨김·이름 바꾸기, 지운 로어북은 빠짐', () => {
  const base = small();
  const d = readDirectory(base);
  const data = directoryData(d);
  data.괴이['새 괴이'] = { ...data.괴이['새 괴이'], preset: false, label: '새로운 괴이' };
  data.요원.사장 = { ...data.요원.사장, id: 'P020', rank: '사장' };
  data.요원['없는 사람'] = { id: 'P099', name: '없는 사람' };
  const lore = withDirectory(base, data);
  const entry = lore.find((e) => e.comment === DIRECTORY_COMMENT);
  assert.equal(entry.key, '');
  assert.equal(entry.alwaysActive, false);
  assert.equal(entry.folder, 'folder:c', '설정 폴더 안');
  const d2 = readDirectory(lore);
  assert.equal(d2.saved, true);
  assert.deepEqual(d2.anomalies.map((p) => [p.label, p.preset]), [['명일 아파트', true], ['새로운 괴이', false]]);
  assert.deepEqual(parseCatalog(lore).anomalies.map((a) => a.name), ['명일 아파트']);
  const sa = d2.agents.find((a) => a.name === '사장');
  assert.deepEqual([sa.id, sa.rank], ['P020', '사장']);
  assert.ok(!d2.agents.some((a) => a.name === '없는 사람'), '로어북이 없는 명부 줄은 무시');
  assert.ok(buildRegistry(lore).byTerm.has('새로운 괴이'), '숨긴 괴이도 이름 찾기에는 남음');
  // 로어북 삭제 → 명부에 남아 있어도 빠짐
  const removed = lore.filter((e) => e.comment !== '새 괴이');
  assert.deepEqual(readDirectory(removed).anomalies.map((p) => p.lore), ['명일 아파트']);
  // 다시 쓰면 명부 하나만
  assert.equal(withDirectory(lore, data).filter((e) => e.comment === DIRECTORY_COMMENT).length, 1);
});

test('새 요원 추가: 명부 순서 뒤에 붙고 기존 ID는 그대로', () => {
  const lore = withDirectory(small(), directoryData(readDirectory(small())));
  const ids = Object.fromEntries(readDirectory(lore).agents.map((a) => [a.name, a.id]));
  const at = lore.findIndex((e) => e.comment === '쟈알디');
  const added = [...lore.slice(0, at + 1), L('신입', 'g', 'Rookie, 신입'), ...lore.slice(at + 1)];
  const d = readDirectory(added);
  assert.deepEqual(d.agents.map((a) => a.name), ['쟈알디', '사장', '차여진', '브라우니', '신입']);
  for (const a of d.agents) if (ids[a.name]) assert.equal(a.id, ids[a.name]);
  const r = d.agents.at(-1);
  assert.deepEqual([r.affiliation, r.english, r.group], ['A00', 'Rookie', '관리국']);
});

test('조직: 명부에 새 조직을 적으면 구분선 이름으로 짐작하고, 고른 조직 값이 요원에게 들어감', () => {
  const base = small();
  const data = directoryData(readDirectory(base));
  data.조직.중립 = { roster_for: ['D00', 'E00'], phone_tabs: ['T04'] };
  delete data.요원.차여진;
  const lore = withDirectory(base, data);
  const d = readDirectory(lore);
  const cha = d.agents.find((a) => a.name === '차여진');
  assert.deepEqual([cha.affiliation, cha.rosterFor, cha.phoneTabs], ['중립', ['D00', 'E00'], ['T04']]);
  assert.ok(d.orgs.some((o) => o.name === '중립' && !o.faction));
  const brownie = structuredClone(d.agents.find((a) => a.name === '브라우니'));
  assignOrg(brownie, orgOf(d.orgs, 'A00'));
  assert.deepEqual([brownie.affiliation, brownie.rosterFor, brownie.phoneTabs], ['A00', ['A00'], ['T01']]);
  assignOrg(brownie, undefined);
  assert.deepEqual([brownie.affiliation, brownie.rosterFor], ['', []]);
});

test('ID가 겹치면 고정 ID로 바꿈', () => {
  const taken = new Set(['P10000']);
  const id = stableAgentId('x', taken);
  assert.match(id, /^P\d{5}$/);
  assert.ok(!taken.has(id));
});

test('실제 카드: 명부로 옮긴 뒤에도 상황판·이름 찾기·연락처가 같음', { skip: !realLore }, () => {
  const before = parseCatalog(realLore);
  const d = readDirectory(realLore);
  assert.equal(d.folders, true);
  assert.equal(d.saved, false);
  assert.equal(d.agents.length, 55);
  assert.ok(d.agents.every((a) => a.inFolder));
  const moved = migrateLore(realLore);
  assert.ok(!moved.some((e) => e.comment === 'Agent roster'));
  assert.ok(!moved.some((e) => e.comment === 'World catalog'), '거점도 명부로 옮겨서 World catalog는 없앰');
  const bases = readDirectory(moved).bases;
  assert.equal(bases.length, 6);
  assert.deepEqual(bases.map((b) => b.org), ['관리국', '백일몽', '특수재난대응협회', '교황청', '이슬람', '중림 지하상가']);
  assert.deepEqual(bases, d.bases);
  // 폴더 밖 괴이·특수 후보(세력·요원 로어북)는 옮기지 않음 (2026-10-21 사용자). 나머지는 같음
  const dropped = new Set(['탐미주의', '진조 세크리엠', '발푸르기스 협회', '십마녀 아벤샤', '무명찬란교']);
  const after = parseCatalog(moved);
  assert.equal(j(after), j({ ...before, anomalies: before.anomalies.filter((a) => !dropped.has(a.name)) }));
  const outside = new Set(OLD_OUTSIDE_PLACES);
  const places = (l) => buildRegistry(l).entries.filter((e) => !e.key.startsWith('Agent roster/'));
  // 별칭은 빠진 항목이 쓰던 것을 다른 항목이 넘겨받을 수 있어(Mumyeong Chanran-gyo → 해피엔딩 홀) 이름만 견줌
  const ids = (e) => `${e.key}|${e.name}|${e.lore}`;
  assert.deepEqual(places(moved).map(ids), places(realLore).filter((e) => !outside.has(e.lore)).map(ids));
  // 요원은 그대로 (자리를 비운 별칭은 요원 이름 찾기로 넘어감)
  const agentKeys = (l) => buildRegistry(l).entries.filter((e) => e.key.startsWith('Agent roster/')).map((e) => e.key);
  assert.deepEqual(agentKeys(moved), agentKeys(realLore));
  assert.deepEqual(readDirectory(moved).agents, d.agents);
  assert.deepEqual(readDirectory(moved).orgs, d.orgs);
  const orgNames = d.orgs.map((o) => o.name);
  for (const n of ['관리국', '특수재난대응협회', '중림 지하상가', '미분류']) assert.ok(orgNames.includes(n), n);
  // 두 번 옮겨도 같음
  assert.equal(j(migrateLore(moved)), j(moved));
});

test('요원 순서: 같은 소속 안에서만 옮기고, 저장하면 노출 순서(catalog.people)도 바뀐다', async () => {
  const { moveAgent } = await import('../dist-test/core.mjs');
  const d = { agents: [
    { lore: 'a1', affiliation: 'A00' }, { lore: 'b1', affiliation: 'B00' }, { lore: 'a2', affiliation: 'A00' }, { lore: 'a3', affiliation: 'A00' },
  ] };
  const order = () => d.agents.map((a) => a.lore).join(',');
  assert.equal(moveAgent(d, 'a1', 'up'), false, '맨 위는 더 못 올라감');
  assert.equal(moveAgent(d, 'a1', 'down'), true);
  assert.equal(order(), 'a2,b1,a1,a3', '다른 소속(b1)은 건너뛰고 같은 소속끼리 자리를 바꾼다');
  assert.equal(moveAgent(d, 'a3', 'before', 'a2'), true);
  assert.equal(order(), 'a3,a2,b1,a1');
  assert.equal(moveAgent(d, 'a3', 'after', 'a1'), true);
  assert.equal(order(), 'a2,b1,a1,a3');
  assert.equal(moveAgent(d, 'a2', 'after', 'b1'), false, '다른 소속 옆으로는 못 옮김');
  if (realLore) {
    const dir = readDirectory(realLore);
    const ids = dir.agents.filter((a) => a.affiliation === dir.agents[0].affiliation).map((a) => a.lore);
    moveAgent(dir, ids[1], 'up');
    const saved = withDirectory(realLore, directoryData(dir));
    const people = parseCatalog(saved).people.map((p) => p.lore ?? p.name);
    assert.equal(readDirectory(saved).agents[0].lore, ids[1], '저장한 순서를 다시 읽어도 그대로');
    assert.ok(people.length > 0);
  }
});

test('폴더 밖 괴이·특수 후보: 옮길 때 빼고, 옛 카드 명부에서도 기본 후보를 뺌 (2026-10-21)', { skip: !realLore }, async () => {
  const { dropOldOutsidePlaces } = await import('../dist-test/core.mjs');
  const moved = migrateLore(realLore);
  const d = readDirectory(moved);
  assert.ok(d.anomalies.length > 50 && d.anomalies.every((r) => r.inFolder));
  assert.ok(d.sites.length > 5 && d.sites.every((r) => r.inFolder));
  // 옛 카드 명부: 기본 후보가 들어 있던 것처럼 만들고 빼기
  const entry = moved.find((e) => e.comment === 'Directory');
  const data = JSON.parse(entry.content);
  data.괴이.탐미주의 = { preset: true, label: '탐미주의', english: 'Aestheticism', aliases: [] };
  data['미스틱 사이트']['세계정치 게시판'] = { preset: false, label: '세계정치 게시판', english: '', aliases: [] };
  const old = moved.map((e) => (e === entry ? { ...e, content: JSON.stringify(data) } : e));
  assert.ok(readDirectory(old).anomalies.some((r) => r.lore === '탐미주의'));
  const clean = dropOldOutsidePlaces(old);
  assert.ok(!readDirectory(clean).anomalies.some((r) => r.lore === '탐미주의'));
  assert.ok(!readDirectory(clean).sites.some((r) => r.lore === '세계정치 게시판'));
  assert.equal(readDirectory(clean).anomalies.length, d.anomalies.length);
  assert.equal(dropOldOutsidePlaces(moved), moved, '뺄 게 없으면 그대로');
});
