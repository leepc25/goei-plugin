import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lore, readDirectory, directoryData, withDirectory, planUpdate } from '../dist-test/core.mjs';

// 📎부록: 본 항목은 이름 앞부분으로 찾고, 자리·순서는 본 항목을 따른다. 켜지는 조건은 명부(Directory)의 「부록」
const F = { org: 'F:org', site: 'F:site', an: 'F:an', ag: 'F:ag', app: 'F:app', set: 'F:set' };
const folder = (key, comment) => ({ key, comment, mode: 'folder', content: '' });
const entry = (folder, comment, key, order, body = comment) => ({ comment, key, folder, insertorder: order, mode: 'normal', content: `@@dont_activate\n${body}` });
const slots = ['Faction', 'Mystic', 'Anomaly', 'Agent'].map((n) => ({ comment: `📚Lore slot · ${n}`, key: '', alwaysActive: true, mode: 'normal', content: '' }));
const base = [
  folder(F.org, '🌆세력'), folder(F.site, '🎁파밍'), folder(F.an, '🚧괴이'), folder(F.ag, '🙂요원'), folder(F.app, '📎부록'), folder(F.set, '⚙️설정'),
  entry(F.org, '남해지사', 'Namhae Branch, 남해지사', 201),
  entry(F.org, '백일몽', '백일몽', 200),
  entry(F.an, '빛이 없으라', '빛이 없으라, 사경산', 500),
  entry(F.an, '어두운 정원', 'Dark Garden, 어두운 정원', 500),
  entry(F.ag, '진나솔', 'Jin Na-sol, 진나솔', 600),
  entry(F.app, '남해지사 · 시설', '휴무 구역, 남해술집', 0),
  entry(F.app, '남해지사 · 숨은 진실', '', 0, '작업자는 재활용품'),
  entry(F.app, '빛이 없으라 · 수도원', '신마음수도원', 0),
  entry(F.app, '이름 모를 부록', '아무 키', 0),
  ...slots,
];
const withData = (books, 부록) => withDirectory(books, { ...directoryData(readDirectory(books)), 부록 });
const BOOKS = withData(base, {
  '남해지사 · 시설': { keys: true, with_parent: false, need_parent: false, target: false, places: ['남해지사', '용머리'] },
  '남해지사 · 숨은 진실': { keys: false, with_parent: true, need_parent: true, target: false, unlock: '작업자 재활용을 알게 됨' },
  '빛이 없으라 · 수도원': { keys: true, with_parent: false, need_parent: false, target: true, agents: ['진나솔'] },
});
const entries = lore.managedEntries(BOOKS);
const byName = (n) => entries.find((e) => e.name === n);
const pick = (texts, state = {}) =>
  lore.pickLore(entries, texts.map((t, i) => ({ role: i % 2 ? 'char' : 'user', data: t })), { target: '', board: [], deployed: [], ...state }, { depth: 10, budget: 0 }).map((p) => p.entry.name);

test('명부: 부록 폴더 항목은 이름 앞부분으로 본 항목을 찾고, 괴이·특수 목록에 들어가지 않는다', () => {
  const dir = readDirectory(BOOKS);
  assert.deepEqual(dir.appendices.map((r) => [r.lore, r.parent]), [
    ['남해지사 · 시설', '남해지사'], ['남해지사 · 숨은 진실', '남해지사'], ['빛이 없으라 · 수도원', '빛이 없으라'], ['이름 모를 부록', ''],
  ]);
  assert.ok(!dir.anomalies.some((r) => r.lore.includes('·')), '부록은 무작위 발생 후보가 아님');
  assert.equal(lore.managedEntries(base).length > 0, true);
  // 저장해도 본 항목이 짐작과 같으면 적지 않는다 (본 항목 이름을 바꿔도 따라가게)
  const saved = directoryData(dir).부록['남해지사 · 시설'];
  assert.equal('parent' in saved, false);
  assert.deepEqual(saved.places, ['남해지사', '용머리']);
});

test('부록 자리·순서는 본 항목을 따른다 (본 항목 바로 뒤). 본 항목이 없으면 세력 자리', () => {
  assert.equal(byName('빛이 없으라 · 수도원').kind, 'anomaly');
  assert.equal(byName('빛이 없으라 · 수도원').order, 500);
  assert.equal(byName('남해지사 · 시설').kind, 'org');
  assert.equal(byName('이름 모를 부록').kind, 'org');
  assert.ok(byName('남해지사 · 숨은 진실'), '키 없는 부록도 다른 조건이 있으면 고를 수 있다');
  const order = lore.pickLore(entries, [{ role: 'user', data: '백일몽 남해지사의 휴무 구역에 갔다' }], { target: '', board: [], deployed: [] }, { depth: 10, budget: 0 }).map((p) => p.entry.name);
  assert.deepEqual(order, ['백일몽', '남해지사', '남해지사 · 시설']);
});

test('부록 조건: 키 · 위치 · 목표 · 동행', () => {
  assert.deepEqual(pick(['남해술집에서 한잔']), ['남해지사 · 시설']);
  assert.deepEqual(pick(['조용한 밤'], { place: '제주 용머리 해안 지하' }), ['남해지사 · 시설']);
  assert.deepEqual(pick(['조용한 밤'], { target: '빛이 없으라' }), ['빛이 없으라', '빛이 없으라 · 수도원']);
  assert.deepEqual(pick(['조용한 밤'], { target: '사경산' }), ['빛이 없으라', '빛이 없으라 · 수도원'], '목표 칸이 본 항목 키여도');
  assert.deepEqual(pick(['조용한 밤'], { companions: ['진나솔'] }), ['빛이 없으라 · 수도원']);
  assert.deepEqual(pick(['조용한 밤'], { deployed: ['Jin Na-sol'] }), ['빛이 없으라 · 수도원'], '투입 중인 요원은 영어 이름으로도');
});

test('해금 전에는 켜지지 않고, 본 항목이 켜졌을 때 해금 조건만 알린다', () => {
  assert.deepEqual(pick(['남해지사로 출근했다']), ['남해지사']);
  assert.deepEqual(pick(['남해지사로 출근했다'], { unlocked: ['남해지사 · 숨은 진실'] }), ['남해지사', '남해지사 · 숨은 진실']);
  assert.deepEqual(pick(['조용한 밤'], { unlocked: ['남해지사 · 숨은 진실'] }), [], '본 항목이 꺼져 있으면 끔');
  const chat = (ss = {}) => ({ message: [{ role: 'user', data: '남해지사로 출근했다' }], scriptstate: ss });
  const opts = { mode: 'plugin', depth: 10, budget: 0, env: { vars: {} } };
  const locked = lore.computeLore(BOOKS, chat(), opts);
  assert.deepEqual(locked.locked.map((e) => e.name), ['남해지사 · 숨은 진실']);
  assert.match(locked.vars.$goei_lore_org, /\[Locked appendix: 「남해지사 · 숨은 진실」\][^\n]*작업자 재활용을 알게 됨/);
  assert.match(locked.vars.$goei_lore_org, /\[🔓\|남해지사 · 숨은 진실\]/);
  assert.doesNotMatch(locked.vars.$goei_lore_org, /재활용품/, '내용은 보내지 않는다');
  const open = lore.computeLore(BOOKS, chat({ [lore.UNLOCK_VAR]: '["남해지사 · 숨은 진실"]' }), opts);
  assert.deepEqual(open.locked, []);
  assert.match(open.vars.$goei_lore_org, /작업자는 재활용품/);
});

test('예산이 모자라면 본 항목 먼저', () => {
  const big = withData(base.map((e) => (e.comment === '남해지사 · 시설' ? { ...e, content: `@@dont_activate\n${'x'.repeat(400)}` } : e)), {});
  const es = lore.managedEntries(big);
  const got = lore.pickLore(es, [{ role: 'user', data: '남해술집, 남해지사' }], { target: '', board: [], deployed: [] }, { depth: 10, budget: 60 }).map((p) => p.entry.name);
  assert.deepEqual(got, ['남해지사']);
});

test('해금 표시 읽기·지우기', () => {
  const text = '본문 끝.\n[🔓|남해지사 · 숨은 진실]\n[▣|2025.01.01|02:47 AM|☀️|4°C|남해지사|없음]';
  assert.deepEqual(lore.unlockTags(text), ['남해지사 · 숨은 진실']);
  assert.equal(lore.stripUnlockTags(text), '본문 끝.\n[▣|2025.01.01|02:47 AM|☀️|4°C|남해지사|없음]');
  assert.equal(lore.stripUnlockTags('그대로'), '그대로');
  assert.deepEqual(lore.readUnlocked({ [lore.UNLOCK_VAR]: 'oops' }), []);
});

test('Risu가 직접 켜는 방식에서도 해금이 걸린 부록은 막아 둔다', () => {
  const books = withData(base, { '빛이 없으라 · 수도원': { keys: true, unlock: '불을 켠 사람이 생김' } });
  const next = lore.syncDecorators(books, 'risu');
  const body = (n) => next.find((e) => e.comment === n).content;
  assert.ok(!body('남해지사').startsWith('@@dont_activate'));
  assert.ok(!body('남해지사 · 시설').startsWith('@@dont_activate'));
  assert.ok(body('빛이 없으라 · 수도원').startsWith('@@dont_activate'), '해금이 걸린 부록');
  const plugin = lore.syncDecorators(next, 'plugin');
  assert.ok(plugin.find((e) => e.comment === '남해지사 · 시설').content.startsWith('@@dont_activate'), '플러그인 방식으로 돌아오면 다시 붙인다');
});

test('카드 업데이트: 사용자 명부에 없는 부록 조건만 더한다', () => {
  const user = withData(base, { '남해지사 · 시설': { keys: false, target: false, places: ['내가 고친 위치'] } });
  const incoming = BOOKS.map((e) => ({ ...e }));
  const plan = planUpdate({ globalLore: user, customscript: [] }, { schema: 1, version: '0.16.60', minPlugin: '0.16.60', data: { globalLore: incoming, customscript: [] } });
  const dir = readDirectory(plan.next.globalLore);
  const row = (n) => dir.appendices.find((r) => r.lore === n);
  assert.deepEqual(row('남해지사 · 시설').places, ['내가 고친 위치'], '사용자가 고친 것은 그대로');
  assert.equal(row('남해지사 · 숨은 진실').unlock, '작업자 재활용을 알게 됨', '새 부록 조건은 들어온다');
});
