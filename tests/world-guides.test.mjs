// 지침 내장(GNet·Phone·Wiki·Directive·Visit·RP·Tag)과 Faction·Roster 조립, 요청 삽입 (docs/설계안_세계편집.md 3·4장)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  guideText, guideDefault, setGuideOverride, GUIDE_NAMES, policySections, parseDirective, withWorldLore, isVirtual, readDirectory, worldRecords, worldRelations,
  assembleFaction, assembleRoster, evaluate, lore as L, ALWAYS_BOOKS,
} from '../dist-test/core.mjs';

const slots = ['Faction', 'Mystic', 'Anomaly', 'Agent'].map((n) => ({ comment: `📚Lore slot · ${n}`, key: '', alwaysActive: true, mode: 'normal', content: '' }));
const DIR = { comment: 'Directory', key: '', mode: 'normal', content: JSON.stringify({
  schema: 1, 괴이: {}, '미스틱 사이트': {},
  요원: { 쟈알디: { affiliation: 'A00', english: 'Jyaldi', department: '종합대응팀' }, 스팡달: { affiliation: 'A00', english: 'Spangdal', department: '종합대응팀' }, 백석주: { affiliation: 'C00', english: 'Baek Seok-ju', department: '현장탐사팀 A조' }, 블라렛: { affiliation: '교황청', english: 'Blaret' } },
  조직: { 관리국: { code: 'A00', english: 'Management Bureau' }, '가짜 관리국': { code: 'B00', english: 'Fake Management Bureau' }, 백일몽: { code: 'C00', english: 'Baekilmong' }, 교황청: { english: 'Vatican' }, 남해지사: { english: 'Namhae Branch' } },
  호칭: { none: { A00: '관리국', B00: '가짜 관리국', C00: '백일몽' }, B00: { A00: '가짜 관리국', B00: '관리국', C00: '백일몽' } },
}) };

test('지침은 카드 로어북 없이 플러그인 내장 글에서 읽는다', () => {
  for (const n of GUIDE_NAMES) assert.ok(guideDefault(n).length > 100, n);
  assert.deepEqual(Object.keys(policySections([], 'GNet')).slice(0, 3), ['LB', 'LB.EXTRA', 'EXTENSION.REQUEST']);
  assert.ok(policySections([{ comment: 'GNet', content: '@@SECTION LB\n카드 글\n@@END' }], 'GNet').LB !== '카드 글', '카드 로어북이 있어도 내장 글 (우선 규칙 없음)');
  assert.ok(policySections([], 'Visit').COMMON && policySections([], 'Visit').OUTPUT_GROUP, 'Visit 는 card/visit-guide.txt');
  assert.equal(policySections([{ comment: '다른 책', content: '@@SECTION A\nx\n@@END' }], '다른 책').A, 'x', '지침이 아닌 이름은 로어북');
  const d = parseDirective([]);
  assert.ok(d.sections.COMMON && d.format.destination.name);
  setGuideOverride('Directive', '===COMMON===\n내 지침\n===OPENING===\no\n===CONTINUATION===\nc\n===CONTEXT===\nx\n===FORMAT===\n' + JSON.stringify(d.format));
  assert.equal(parseDirective([]).sections.COMMON, '내 지침');
  setGuideOverride('Directive', '');
  assert.equal(parseDirective([]).sections.COMMON, d.sections.COMMON);
  assert.match(guideText('Tag'), /\{\{getvar::fac_codes\}\}/, 'Tag 에 새 세력 자리표가 있다');
});

test('Faction·Roster 조립: 조직 소개 첫 문단 + 관계 목록 + 공통 규칙, 조직→부서→요원 소개', () => {
  const out = withWorldLore([...slots, DIR]);
  const dir = readDirectory(out);
  const fac = assembleFaction(dir, worldRecords('org'), worldRelations());
  assert.match(fac, /^## Faction\n\nThis reference describes the world to the GM\./);
  assert.match(fac, /### \{\{#if \{\{not_equal::\{\{getvar::st_faction\}\}::B00\}\}\}\}Management Bureau\{\{\/if\}\}\{\{#if \{\{equal::\{\{getvar::st_faction\}\}::B00\}\}\}\}Fake Management Bureau\{\{\/if\}\} \[A00\]\n/);
  assert.ok(!fac.includes('Namhae Branch'), 'noSummary 조직은 요약에 없음');
  assert.ok(fac.includes('### The Aestheticism') || fac.includes('### 탐미주의'), '요약 전용 조직은 뒤에');
  assert.match(fac, /## Faction Relations\n[^\n]*\n- .*Management Bureau.* → .*Fake Management Bureau.*: hostile — /);
  assert.match(fac, /## Faction Doctrine and Relations\n### Mutual Perception/);
  const a00 = evaluate(fac, { vars: { st_faction: 'A00' }, user: 'U' });
  const b00 = evaluate(fac, { vars: { st_faction: 'B00' }, user: 'U' });
  assert.match(a00, /### Management Bureau \[A00\]\nA secret organization that protects humanity/);
  assert.match(b00, /### Fake Management Bureau \[A00\]\nRegarded by the opposing Bureau as an organization of monsters/, 'B00 시점 소개 변형');
  assert.ok(!a00.includes('{{'), 'CBS 가 전부 풀림');
  const ros = assembleRoster(dir, worldRecords('agent'), worldRecords('org'));
  const r = evaluate(ros, { vars: { st_faction: 'A00' }, user: 'U' });
  assert.match(r, /^## Roster\n- Purpose: /);
  assert.match(r, /### Management Bureau \[A00\]\n\n#### Comprehensive Response Team\n- Jyaldi \(early 30s\/F, Boo-jang\): /);
  assert.match(r, /#### Field Exploration Team\nA Jo \(Elite Jo\)\n- Baek Seok-ju \(late 30s\/F, Gwa-jang\): /, '조 꼬리표는 그 부서 요원 앞에');
  assert.match(r, /### Vatican\n- Blaret \(/, '부서 없는 요원은 조직 바로 아래');
  assert.ok(!r.includes('Spangdal') === false, '소개가 있는 요원은 모두');
});

test('가상 상시 항목(🏷️Tag·📜Faction·🙂Roster)은 카드에 없을 때만, 요청에는 한 덩어리로 첫 대화 앞에', () => {
  const out = withWorldLore([...slots, DIR]);
  const always = out.filter((e) => isVirtual(e) && e.alwaysActive);
  assert.deepEqual(always.map((e) => [e.comment, e.insertorder]), ALWAYS_BOOKS.map((b) => [b.name, b.order]));
  const withTag = withWorldLore([...slots, DIR, { comment: '🏷️Tag', content: '카드 태그', alwaysActive: true, mode: 'normal', key: '' }]);
  assert.deepEqual(withTag.filter((e) => isVirtual(e) && e.alwaysActive).map((e) => e.comment), ['📜Faction', '🙂Roster']);
  assert.equal(L.managedEntries(withWorldLore([DIR])).length > 100, true, '자리 항목이 없어도 가상 로어북이 있으면 고른다');
  const block = L.joinLoreBlock([{ order: 500, text: '괴이' }, { order: 100, text: '태그' }, { order: 399, text: '시드' }, { order: 0, text: '' }]);
  assert.equal(block, '태그\n\n시드\n\n괴이');
  const msgs = [{ role: 'system', content: '본 프롬프트' }, { role: 'system', content: '지침' }, { role: 'assistant', content: '첫 장면 글이에요' }, { role: 'user', content: '안녕' }];
  const ins = L.insertLoreBlock(msgs, block, '첫 장면 글이에요');
  assert.equal(ins.length, 5);
  assert.equal(ins[2].role, 'system');
  assert.match(ins[2].content, /^<!-- goei:lore -->\n태그\n\n시드\n\n괴이$/);
  assert.equal(L.insertLoreBlock(ins, block).length, 5, '두 번 끼우지 않음');
  const ins2 = L.insertLoreBlock([{ role: 'user', content: '첫 글' }, { role: 'assistant', content: '첫 장면 글이에요' }], block, '첫 장면 글이에요');
  assert.equal(ins2[1].role, 'system', '첫 대화 글이 든 메시지 앞 (앞의 user 지침은 건너뜀)');
  assert.equal(L.insertLoreBlock([{ role: 'system', content: 'a' }], block).at(-1).role, 'system', '대화가 없으면 끝');
});
