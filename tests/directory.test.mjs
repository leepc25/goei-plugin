import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  readDirectory, migrateLore, parseCatalog, buildRegistry, directoryData, withDirectory, DIRECTORY_COMMENT, stableAgentId, assignOrg, orgOf,
} from '../dist-test/core.mjs';

const REAL = '/mnt/project-files/analysis/extracted/module.json';
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
  const after = parseCatalog(moved);
  assert.equal(j(after), j(before));
  const ra = buildRegistry(realLore).entries.map(j);
  const rb = buildRegistry(moved).entries.map(j);
  assert.deepEqual(rb, ra);
  assert.deepEqual(readDirectory(moved).agents, d.agents);
  assert.deepEqual(readDirectory(moved).orgs, d.orgs);
  const orgNames = d.orgs.map((o) => o.name);
  for (const n of ['관리국', '특수재난대응협회', '중림 지하상가', '미분류']) assert.ok(orgNames.includes(n), n);
  // 두 번 옮겨도 같음
  assert.equal(j(migrateLore(moved)), j(moved));
});
