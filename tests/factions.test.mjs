import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  factionList, factionVars, staleFactionVars, withFactionPlaceholders, placeholdersReady, nextCode, extraTabId, factionType,
  planStart, readDirectory, directoryData, withDirectory, phoneTabs, parseCatalog, applyOutput, emptyWorld, DEFAULT_SETTINGS,
  processOutput, factionCodesToNames, evaluate, phone,
} from '../dist-test/core.mjs';

import { REAL } from './realcard.mjs';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;

const F = (id, name) => ({ comment: name, key: `folder:${id}`, mode: 'folder', content: '' });
const L = (name, folder, key = '') => ({ comment: name, key, content: `${name} 설정`, mode: 'normal', folder: folder ? `folder:${folder}` : undefined });
const TAG = [
  '### Affiliation Change', '[AC|code]', '', '- code = A00 | B00 | C00 | D00 | E00',
  '   - A00 = Anomaly Management Bureau', '   - E00 = Freelancer', "- {{user}}'s current affiliation: {{getvar::ib_affiliation}}",
  '   - Faction pool: 관리국 | 가짜 관리국 | 발푸르기스 협회 | etc.', '',
].join('\n');
const tabs = { comment: 'Phone tabs', content: JSON.stringify({ version: 1, tabs: [
  { id: 'T01', name: '관리', visible_for: ['A00'] }, { id: 'T04', name: '중립', visible_for: ['A00', 'B00', 'C00', 'D00', 'E00'] },
] }) };
const base = () => [
  F('a', '🚧괴이'), F('g', '🙂요원'), F('c', '⚙️설정'), tabs,
  { comment: '🏷️Tag', content: TAG }, { comment: '📜Faction', content: '## Faction\n\n### Vatican\nHoly.\n' },
  L('명일 아파트', 'a'), L('-----관리국-----', 'g'), L('쟈알디', 'g', 'Jyaldi'), L('블라렛', 'g', 'Blarett'),
  L('발푸르기스 협회', ''), L('Start trigger', ''),
];

/** 블라렛을 발푸르기스 협회 소속으로 두고 협회를 플레이 세력으로 켠 카드 */
function withWalpurgis(lore, spec = {}) {
  const d = readDirectory(lore);
  const data = directoryData(d);
  data.조직['발푸르기스 협회'] = { roster_for: ['F00'], phone_tabs: [extraTabId('F00')], code: 'F00', playable: true, gm_name: 'Walpurgis Society', gm_desc: 'Sorcerers.', ...spec };
  data.요원.블라렛 = { ...data.요원.블라렛, affiliation: '발푸르기스 협회', roster_for: ['F00'], phone_tabs: [extraTabId('F00')] };
  data.codes_used = ['F00'];
  return withDirectory(lore, data);
}

test('자리표시자: 태그·세력 로어북에 넣고, 두 번 넣지 않음', () => {
  const r = withFactionPlaceholders(base());
  assert.deepEqual(r.missing, []);
  assert.equal(r.changed, true);
  const tag = r.lore.find((e) => e.comment === '🏷️Tag').content;
  assert.match(tag, /code = A00 \| B00 \| C00 \| D00 \| E00\{\{getvar::fac_codes\}\}\n/);
  assert.match(tag, /- E00 = Freelancer\{\{getvar::fac_ac\}\}\n/);
  assert.match(tag, /발푸르기스 협회\{\{getvar::fac_pool\}\} \| etc\.\n/);
  assert.match(r.lore.find((e) => e.comment === '📜Faction').content, /Holy\.\{\{getvar::fac_extra\}\}\n$/);
  assert.equal(placeholdersReady(r.lore), true);
  assert.equal(withFactionPlaceholders(r.lore).changed, false);
  assert.equal(placeholdersReady(base()), false);
});

test('자리표시자: 원본 봇 로어북에서도 네 자리를 모두 찾음', { skip: !realLore }, () => {
  const r = withFactionPlaceholders(realLore);
  assert.deepEqual(r.missing, []);
  const tag = r.lore.find((e) => e.comment === '🏷️Tag').content;
  // 새 세력이 없으면 변수가 모두 빈 값이라 Risu가 보내는 글이 원래와 같다
  const vars = { $st_anomaly_on: '1', $st_faction: 'A00', $ib_affiliation: '관리국', ...factionVars(r.lore) };
  const before = evaluate(realLore.find((e) => e.comment === '🏷️Tag').content, { vars });
  assert.equal(evaluate(tag, { vars }), before);
  // 새 세력이 있으면 코드 줄·이름 줄·세력 설명이 붙는다
  const lore = withWalpurgis(r.lore);
  const fv = factionVars(lore);
  const out = evaluate(lore.find((e) => e.comment === '🏷️Tag').content, { vars: { ...vars, ...fv } });
  assert.match(out, /code = A00 \| B00 \| C00 \| D00 \| E00 \| F00\n/);
  assert.match(out, /- E00 = Freelancer\n   - F00 = Walpurgis Society\n/);
  assert.doesNotMatch(out, /fac_pool/);
  assert.equal(fv.$fac_pool, '', '이미 배치 목록에 있는 이름은 다시 넣지 않음');
  const fac = evaluate(lore.find((e) => e.comment === '📜Faction').content, { vars: { ...vars, ...fv } });
  assert.match(fac, /### Walpurgis Society \[F00\]\nSorcerers\.\nOrganization:[^\n]*\n\n## Faction Doctrine/, '세력 목록 끝, 관계 절 앞');
  // 옛 빌드처럼 글 끝(--- 뒤)에 붙은 카드는 자리를 옮긴다
  const facText = r.lore.find((e) => e.comment === '📜Faction').content;
  const old = r.lore.map((e) => (e.comment === '📜Faction' ? { ...e, content: `${facText.split('{{getvar::fac_extra}}').join('').replace(/\s+$/, '')}{{getvar::fac_extra}}\n` } : e));
  assert.equal(placeholdersReady(old), false);
  const moved = withFactionPlaceholders(old);
  assert.equal(moved.changed, true);
  assert.equal(moved.lore.find((e) => e.comment === '📜Faction').content, facText);
  assert.equal(placeholdersReady(moved.lore), true);
});

test('세력 목록: 자리표시자가 있는 카드에서만 새 세력, 기본 세력은 이름·숨김만', () => {
  const plain = withWalpurgis(base(), {});
  assert.deepEqual(factionList(plain).map((f) => f.code), ['A00', 'B00', 'C00', 'D00', 'E00'], '자리표시자 없으면 새 세력 숨김');
  const lore = withWalpurgis(withFactionPlaceholders(base()).lore, { type: 'civilian', title: '마법사 결사', photo: 'walpurgis' });
  const list = factionList(lore);
  const f = list.find((x) => x.code === 'F00');
  assert.deepEqual([f.name, f.affiliation, f.photo, f.type, f.builtin], ['마법사 결사', '발푸르기스 협회', 'walpurgis', 'civilian', false]);
  assert.deepEqual(f.scenarios.map((s) => s.kind), ['direct', 'preset']);
  assert.equal(factionType('F00', lore), 'civilian');
  assert.equal(list.find((x) => x.code === 'A00').photo, '');
  // 기본 세력 고치기: 명부의 같은 code 칸
  const d = readDirectory(lore);
  const a00 = d.orgs.find((o) => o.faction === 'A00');
  a00.spec.title = '관리국 (정식)';
  a00.spec.hidden = true;
  const lore2 = withDirectory(lore, directoryData(d));
  const a = factionList(lore2).find((x) => x.code === 'A00');
  assert.deepEqual([a.name, a.hidden, a.affiliation], ['관리국 (정식)', true, '관리국']);
  assert.equal(readDirectory(lore2).orgs.find((o) => o.name === '발푸르기스 협회').spec.code, 'F00', '저장해도 코드 유지');
  assert.deepEqual(readDirectory(lore2).usedCodes, ['F00']);
});

test('코드: F00부터, 쓴 코드는 건너뜀', () => {
  assert.equal(nextCode([]), 'F00');
  assert.equal(nextCode(['F00', 'G00']), 'H00');
  assert.equal(extraTabId('F00'), 'T105');
});

test('시작: 새 세력은 공용 빈 첫 장면 + 명부 시드 + 자리표시자 변수', () => {
  const lore = withWalpurgis(withFactionPlaceholders(base()).lore);
  const manifest = { schema: 1, plugin: 'goei-plugin', greetings: { 'A00-ko-1': 0, 'A00-ko-8': 1, 'D00-ko-6': 1 } };
  const plan = planStart({ faction: 'F00', lang: 'ko', fm: 1 }, manifest, lore, 2);
  assert.equal(plan.fmIndex, 1);
  assert.equal(plan.kind, 'direct');
  assert.equal(plan.scriptstate.$ib_affiliation, '발푸르기스 협회');
  assert.match(plan.scriptstate.$seed_lore, /발푸르기스 협회 설정/);
  assert.equal(plan.scriptstate.$fac_codes, ' | F00');
  assert.equal(planStart({ faction: 'F00', lang: 'ko', fm: 2 }, manifest, lore, 2).kind, 'preset');
  assert.throws(() => planStart({ faction: 'F00', lang: 'ko', fm: 3 }, manifest, lore, 2), /상황을 골라/);
  assert.equal(staleFactionVars(lore, plan.scriptstate), null);
  assert.deepEqual(staleFactionVars(lore, {}), factionVars(lore));
});

test('상황판: [AC|F00]로 소속 변경, 새 세력 요원 목록·이름', () => {
  const lore = withWalpurgis(withFactionPlaceholders(base()).lore);
  const c = parseCatalog(lore);
  const r = applyOutput(emptyWorld(), c, DEFAULT_SETTINGS, 'A00', '본문\n[AC|F00]', () => 0.99);
  assert.equal(r.faction, 'F00');
  assert.equal(applyOutput(emptyWorld(), c, DEFAULT_SETTINGS, 'A00', '[AC|Q00]', () => 0.99).faction, null, '없는 코드는 무시');
  const chat = { message: [{ role: 'char', data: '본문\n[AC|F00]' }], scriptstate: { $st_anomaly_on: '1', $st_faction: 'A00' } };
  const next = processOutput(chat, 0, chat.message[0].data, c, DEFAULT_SETTINGS, () => 0.99);
  assert.equal(next.scriptstate.$st_faction, 'F00');
  assert.equal(next.scriptstate.$ib_affiliation, '발푸르기스 협회');
  assert.equal(next.scriptstate.$fac_codes, ' | F00');
  assert.match(next.scriptstate.$ag_report, /블라렛/);
  assert.equal(factionCodesToNames('F00 소속', { F00: '발푸르기스 협회' }), '발푸르기스 협회 소속');
});

test('괴담톡: 새 세력 전용 탭과 모두 공개 탭', () => {
  const lore = withWalpurgis(withFactionPlaceholders(base()).lore);
  const t = phoneTabs(lore);
  assert.deepEqual(t.find((x) => x.id === 'T105'), { id: 'T105', name: '발푸', visibleFor: ['F00'] });
  assert.ok(t.find((x) => x.id === 'T04').visibleFor.includes('F00'));
  assert.ok(!t.find((x) => x.id === 'T01').visibleFor.includes('F00'));
  const dir = phone.directory(lore, { message: [], scriptstate: { $st_faction: 'F00' } });
  assert.deepEqual(dir.tabs.map((x) => x.id), ['T04', 'T105']);
  assert.deepEqual(dir.contacts.map((x) => x.name), ['블라렛']);
});
