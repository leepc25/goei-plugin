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

test('옛 명부(부록 줄 없음): 플러그인 기본 명부의 같은 이름 줄을 쓴다 (화요퀴즈쇼 · 합창단 퍼레이드 목표 끔)', async () => {
  const { readFileSync } = await import('node:fs');
  const { withWorldLore } = await import('../dist-test/core.mjs');
  const fresh = JSON.parse(readFileSync(new URL('../src/data/install/directory.json', import.meta.url), 'utf8'));
  const PARADE = '화요퀴즈쇼 · 합창단 퍼레이드';
  assert.equal(fresh.부록[PARADE].target, false, '기본 명부: 목표 끔');
  const old = structuredClone(fresh);
  delete old.부록[PARADE];
  const books = (d) => withWorldLore([{ comment: 'Directory', key: '', mode: 'normal', content: JSON.stringify(d) }]);
  const picked = (bs) =>
    lore.pickLore(lore.managedEntries(bs), [{ role: 'user', data: '조용한 밤' }], { target: '화요퀴즈쇼', board: [], deployed: [] }, { depth: 10, budget: 0 }).map((p) => p.entry.name);
  assert.deepEqual(picked(books(fresh)), ['화요퀴즈쇼']);
  assert.deepEqual(picked(books(old)), ['화요퀴즈쇼'], '줄이 없는 옛 명부도 목표만으로는 퍼레이드를 싣지 않는다');
  const row = (bs) => readDirectory(bs).appendices.find((r) => r.lore === PARADE);
  assert.equal(row(books(old)).target, false);
  assert.equal(directoryData(readDirectory(books(old))).부록[PARADE].target, false, '그 사이 명부를 저장해도 「켬」으로 굳지 않는다');
  // 사용자가 명부에 직접 적은 줄은 그대로 (기본값이 덮지 않는다)
  const mine = structuredClone(old);
  mine.부록[PARADE] = { keys: true, with_parent: false, need_parent: false, target: true };
  assert.equal(row(books(mine)).target, true);
  assert.deepEqual(picked(books(mine)), ['화요퀴즈쇼', PARADE]);
  // 기본 명부에 없는 부록은 코드 기본값 그대로
  assert.equal(readDirectory(base).appendices.find((r) => r.lore === '이름 모를 부록').target, true);
});

test('망상홈쇼핑 · 상품: 오후역이 켜지는 모든 길에서 같이 켜진다 (오후역 본문에서 뺀 상품 4개가 여기 있다)', async () => {
  const { readFileSync } = await import('node:fs');
  const { withWorldLore } = await import('../dist-test/core.mjs');
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const fresh = JSON.parse(read('../src/data/install/directory.json'));
  const APP = '망상홈쇼핑 · 상품';
  const split = (t) => t.split(',').map((k) => k.trim()).filter(Boolean);
  // 자료 세 곳이 같다: 부록 키 ⊇ 오후역 키, 카드 글 머리 = 세계 자료·기본 명부
  const station = JSON.parse(read('../src/data/world/anomalies.json')).records.오후역;
  const app = JSON.parse(read('../src/data/world/appendices.json')).records[APP];
  for (const k of [...split(station.keys), '오후역', fresh.괴이.오후역.english, ...fresh.괴이.오후역.aliases]) assert.ok(split(app.keys).includes(k), `부록 키에 ${k}`);
  for (const w of ['Into the Vacuum', 'Happy-Maker', 'Gold-Edition Blood Bathtub', 'Aesthetic-Caterpillar Egg-Sac Diet Aid']) {
    assert.ok(app.fields.body.includes(w), `부록 본문에 ${w}`);
    assert.ok(!JSON.stringify(station).includes(w), `오후역 본문에는 없다: ${w}`);
  }
  const head = Object.fromEntries(read('../card/extra-lore/부록_망상홈쇼핑_상품.txt').split('\n---\n')[0].split('\n').map((l) => l.split(': ')).map(([k, ...v]) => [k, v.join(': ')]));
  assert.equal(head.key, app.keys, '카드 글 키 = 세계 자료 키');
  assert.deepEqual(JSON.parse(head.appendix), fresh.부록[APP], '카드 글 조건 = 기본 명부');

  const books = (d) => withWorldLore([{ comment: 'Directory', key: '', mode: 'normal', content: JSON.stringify(d) }]);
  const picked = (bs, text, state = {}) =>
    lore.pickLore(lore.managedEntries(bs), [{ role: 'user', data: text }], { target: '', board: [], deployed: [], ...state }, { depth: 10, budget: 0 }).map((p) => p.entry.name);
  const both = (got, why) => assert.ok(got.includes('오후역') && got.includes(APP), `${why}: ${got.join(', ')}`);
  const now = books(fresh);
  // 글에 이름만
  for (const t of ['오후역에 내렸다.', '혈액 방송국 로비에 들어섰다.', '혈액방송국이 보인다.', 'We got off at Afternoon Station.', 'the Blood Broadcasting Station lobby']) both(picked(now, t), t);
  // 상태창 목표 (이름·키·영문명), 위치만 다른 곳이어도
  for (const target of ['오후역', '혈액 방송국', '혈액방송국', 'Afternoon Station', 'Blood Broadcasting Station']) both(picked(now, '조용한 밤', { target, place: '대기실' }), `목표 ${target}`);
  both(picked(now, '조용한 밤', { target: '오후역', place: '혈액 방송국 메인 스튜디오' }), '목표 오후역 + 위치');
  assert.ok(picked(now, '조용한 밤', { place: '혈액 방송국 메인 스튜디오' }).includes(APP), '위치만으로도');
  // Risu 방식
  const risu = lore.pickLoreRisu(lore.managedEntries(now), [{ role: 'user', data: '오후역에 내렸다.' }], 10).map((p) => p.entry.name);
  both(risu, 'Risu 방식');
  // 옛 카드 명부 (위치에 혈액 방송국이 없는 줄이 저장돼 있음)도 목표 칸으로 켜진다
  const old = structuredClone(fresh);
  old.부록[APP] = { keys: true, with_parent: false, need_parent: false, target: true, places: ['망상홈쇼핑', '망상 홈쇼핑', '오후역'] };
  both(picked(books(old), '조용한 밤', { target: '혈액 방송국' }), '옛 명부 + 목표 혈액 방송국');
  // 세계 탭에서 오후역에 넣은 별칭·바꾼 영문명으로 오후역이 켜져도 같이 켜진다 (글·목표 칸 둘 다, 11-14 재검토)
  const mine = structuredClone(fresh);
  mine.괴이.오후역.aliases = [...mine.괴이.오후역.aliases, '혈흉 방송국'];
  mine.괴이.오후역.english = 'Noon Terminal';
  both(picked(books(mine), '혈흉 방송국에 도착했다.'), '넣은 별칭 (글)');
  both(picked(books(mine), '조용한 밤', { target: '혈흉 방송국', place: '대기실' }), '넣은 별칭 (목표)');
  both(picked(books(mine), 'We reached Noon Terminal.'), '바꾼 영문명 (글)');
  both(picked(books(mine), '조용한 밤', { target: 'Noon Terminal' }), '바꾼 영문명 (목표)');
  // 「목표」 스위치를 끄면 목표 칸만으로는 안 켜진다 (오후역은 켜져도 부록은 안 따라간다). 글에 부르는 말이 나오면 켜진다
  const off = structuredClone(fresh);
  off.부록[APP] = { ...off.부록[APP], target: false };
  for (const target of ['오후역', '혈액 방송국', 'Afternoon Station']) {
    const got = picked(books(off), '조용한 밤', { target, place: '대기실' });
    assert.ok(got.includes('오후역') && !got.includes(APP), `목표 끔 + 목표 ${target}: ${got.join(', ')}`);
  }
  both(picked(books(off), '오후역에 내렸다.', { target: '오후역', place: '대기실' }), '목표 끔 + 글에 이름');
  const offMine = structuredClone(mine);
  offMine.부록[APP] = { ...offMine.부록[APP], target: false };
  both(picked(books(offMine), '혈흉 방송국에 도착했다.'), '목표 끔 + 넣은 별칭 (글)');
  assert.ok(!picked(books(offMine), '조용한 밤', { target: '혈흉 방송국', place: '대기실' }).includes(APP), '목표 끔 + 넣은 별칭 (목표)');
  // 상관없는 글·목표에서는 꺼져 있다
  for (const got of [picked(now, '조용한 밤'), picked(now, '오후에 역 앞 방송국에서 만나자. 혈액 검사는 내일.'), picked(now, '조용한 밤', { target: '화요퀴즈쇼', place: '서울역' })]) assert.ok(!got.includes(APP) && !got.includes('오후역'), got.join(', '));
  // 새로 넣은 키가 다른 부록·항목을 켜지 않는다
  assert.deepEqual(picked(now, '오후역에 내렸다.').filter((n) => n.includes('·')), [APP]);
});
