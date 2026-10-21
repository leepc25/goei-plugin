import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lore, planUpdate, keyPrint } from '../dist-test/core.mjs';

const F = { org: 'F:org', site: 'F:site', an: 'F:an', ag: 'F:ag' };
const folder = (key, comment) => ({ key, comment, mode: 'folder', content: '' });
const entry = (folder, comment, key, order, body = comment) => ({ comment, key, folder, insertorder: order, mode: 'normal', content: `@@dont_activate\n${body}` });
const BOOKS = [
  folder(F.org, '🌆세력'), folder(F.site, '🎁파밍'), folder(F.an, '🚧괴이'), folder(F.ag, '🙂요원'),
  entry(F.org, '관리국', '관리국', 200),
  entry(F.org, '가짜 관리국', '가짜 관리국, Fake Bureau', 200),
  entry(F.org, '극단', '극단', 203),
  entry(F.site, '여우상담실', 'Fox Counseling, 여우상담실', 400),
  entry(F.an, '어두운 정원', 'Dark Garden, 어두운 정원', 500),
  entry(F.an, '꿈과 희망의 극단', '꿈과 희망의 극단', 500),
  entry(F.an, '인류의 신비전', '인류의 신비전', 500),
  entry(F.ag, '차여진', 'Yeo-jin, 차여진, 여진', 600, '{{#if {{equal::{{getvar::st_faction}}::A00}}}}관리국 시점{{/if}}여진 글'),
  entry(F.ag, '이도형', 'Do-hyeong, 이도형, 도형', 600),
  entry(F.ag, '제이', 'Jay, 제이, 경비반장', 600),
  { comment: '내가 넣은 요원', key: '아무개', folder: F.ag, insertorder: 600, mode: 'normal', content: '데코 없음' },
  ...['Faction', 'Mystic', 'Anomaly', 'Agent'].map((n) => ({ comment: `📚Lore slot · ${n}`, key: '', alwaysActive: true, mode: 'normal', content: '' })),
];
const entries = lore.managedEntries(BOOKS);
const pick = (texts, state = {}) =>
  lore.pickLore(entries, texts.map((t, i) => (typeof t === 'string' ? { role: i % 2 ? 'char' : 'user', data: t } : t)), { target: '', board: [], deployed: [], ...state }, { depth: 10, budget: 0 }).map((p) => p.entry.name);

test('자리 항목이 있는 카드에서 네 폴더의 키 있는 항목을 고른다', () => {
  assert.equal(entries.length, 11);
  assert.deepEqual(lore.managedEntries(BOOKS.filter((e) => !String(e.comment).startsWith('📚'))), [], '자리 항목이 없으면 아무것도');
  assert.equal(entries.find((e) => e.name === '어두운 정원').keys.find((k) => k.text === '어두운 정원').rule, 'confirm');
  assert.equal(entries.find((e) => e.name === '차여진').keys.find((k) => k.text === '여진').rule, 'alias');
  assert.equal(entries.find((e) => e.name === '제이').keys.find((k) => k.text === '제이').rule, 'plain');
});

test('한국어: 앞뒤 경계와 조사·서술', () => {
  assert.deepEqual(pick(['차여진이었다.']), ['차여진']);
  assert.deepEqual(pick(['고개가 숙여진다']), []);
  assert.deepEqual(pick(['극단적인 선택']), []);
  assert.deepEqual(pick(['"극단"이 움직였다']), ['극단']);
  assert.deepEqual(pick(['궁극 단계']), []);
  assert.deepEqual(pick(['제이가 웃었다']), ['제이']);
  assert.deepEqual(pick(['제이크가 왔다']), []);
});

test('긴 이름 우선, 띄어쓰기·「의」 변형', () => {
  assert.deepEqual(pick(['가짜 관리국 요원이다']), ['가짜 관리국']);
  assert.deepEqual(pick(['꿈과 희망의 극단으로 갔다']), ['꿈과 희망의 극단']);
  assert.deepEqual(pick(['여우 상담실에 들렀다']), ['여우상담실']);
  assert.deepEqual(pick(['인류 신비전 전시']), ['인류의 신비전']);
});

test('두 글자 별칭은 확증이 있을 때만', () => {
  assert.deepEqual(pick(['도형을 그렸다']), []);
  assert.deepEqual(pick(['도형 씨, 이리 와요']), ['이도형']);
  assert.deepEqual(pick(['여진아!']), ['차여진']);
  assert.deepEqual(pick(['여진은 어디 있지']), []);
  assert.deepEqual(pick(['여진은 어디 있지'], { deployed: ['차여진'] }), ['차여진']);
  assert.deepEqual(pick(['이 도형을 봐']), []);
});

test('구절형 괴이 이름은 따옴표·괴담·상황판·상태창으로 확증', () => {
  assert.deepEqual(pick(['어두운 정원을 걸었다']), []);
  assert.deepEqual(pick(['「어두운 정원」에 들어갔다']), ['어두운 정원']);
  assert.deepEqual(pick(['어두운 정원 괴담을 들었다']), ['어두운 정원']);
  assert.deepEqual(pick(['어두운 정원을 걸었다'], { board: ['어두운 정원'] }), ['어두운 정원']);
  assert.deepEqual(pick(['조용하다'], { target: '어두운 정원' }), ['어두운 정원']);
});

test('영어: 단어 경계, 복수·소유격, 하이픈 변형', () => {
  // Jay는 흔한 영어 이름이라 확증 키 (2026-10-21): 이름만으로는 안 켜고, 직함·따옴표·다른 키가 있으면 켠다
  assert.deepEqual(pick(['Jay가 말했다']), []);
  assert.deepEqual(pick(['Guard Chief Jay nodded']), ['제이']);
  assert.deepEqual(pick(['「Jay」가 말했다']), ['제이']);
  assert.deepEqual(pick(['jaywalk']), []);
  assert.deepEqual(pick(['제이 반장이 웃었다']), ['제이'], '띄고 붙은 호칭 뒤 조사');
  assert.deepEqual(pick(["the fake bureau's office"]), ['가짜 관리국']);
  assert.deepEqual(pick(['Yeojin smiled']), ['차여진']);
  assert.deepEqual(pick(['Yeo jin']), ['차여진']);
});

test('검색 깊이 밖은 보지 않고, 순서는 삽입 순서', () => {
  const msgs = ['제이', ...Array(10).fill('조용하다')];
  assert.deepEqual(pick(msgs), []);
  assert.deepEqual(pick(['제이가 관리국에 갔다']), ['관리국', '제이']);
});

test('Risu 방식: 띄어쓰기를 지우고 포함', () => {
  const got = lore.pickLoreRisu(entries, [{ role: 'user', data: '고개가 숙여진다. 궁극 단계' }], 10).map((p) => p.entry.name);
  assert.deepEqual(got, ['극단', '차여진']);
});

test('자리 글: CBS를 풀고 장식 줄을 뗀다', () => {
  const chat = { message: [{ role: 'user', data: '차여진이 제이를 불렀다' }], scriptstate: { $st_faction: 'A00' } };
  const got = lore.computeLore(BOOKS, chat, { mode: 'plugin', depth: 10, budget: 0, env: { vars: chat.scriptstate } });
  assert.equal(got.vars.$goei_lore_agent, '관리국 시점여진 글\n\n제이');
  assert.equal(got.vars.$goei_lore_org, '');
  assert.ok(lore.sameVars({ ...got.vars }, got.vars));
});

test('상한을 넘으면 점수 낮은 것부터 뺀다', () => {
  const msgs = [{ role: 'char', data: '관리국' }, { role: 'user', data: '제이' }];
  const got = lore.pickLore(entries, msgs, { target: '', board: [], deployed: [] }, { depth: 10, budget: 7 }, true).map((p) => p.entry.name);
  assert.deepEqual(got, ['제이']);
});

test('요청 보정: 넣어 둔 글을 새로 고른 글로', () => {
  const msgs = [{ role: 'system', content: 'A\n\n옛 요원 글\n\nB' }, { role: 'user', content: 'x' }];
  const r = lore.patchSlots(msgs, { $goei_lore_agent: '옛 요원 글' }, { $goei_lore_agent: '새 글', $goei_lore_org: '세력' });
  assert.equal(r.changed, 2);
  assert.equal(r.messages[0].content, 'A\n\n세력\n\n새 글\n\nB');
});

test('요청 보정: 비어 있던 자리는 이웃 자리 글 옆에', () => {
  const msgs = [{ role: 'system', content: 'A\n\n세력 글\n\nB' }];
  const r = lore.patchSlots(msgs, { $goei_lore_org: '세력 글', $goei_lore_agent: '' }, { $goei_lore_org: '세력 글', $goei_lore_agent: '요원 글' });
  assert.equal(r.messages[0].content, 'A\n\n세력 글\n\n요원 글\n\nB');
  const r2 = lore.patchSlots(msgs, { $goei_lore_agent: '' }, { $goei_lore_agent: '요원 글' });
  assert.equal(r2.changed, 0, '이웃이 모두 비면 그대로');
  const r3 = lore.patchSlots([{ content: 'X\n\n요원 글' }], { $goei_lore_org: '', $goei_lore_agent: '요원 글' }, { $goei_lore_org: '세력 글', $goei_lore_agent: '요원 글' });
  assert.equal(r3.messages[0].content, 'X\n\n세력 글\n\n요원 글', '앞 이웃이 없으면 뒷자리 앞');
});

test('카드 업데이트: 사용자가 고친 키는 남긴다', () => {
  const manifest = (keys) => ({ comment: 'Plugin manifest', key: '', content: JSON.stringify({ version: '9', keys }) });
  const cur = [{ comment: 'A', key: 'a, aa', content: 'old' }, { comment: 'B', key: 'b, mine', content: 'old' }];
  const inc = [{ comment: 'A', key: 'a', content: 'new' }, { comment: 'B', key: 'b', content: 'new' }, manifest({ A: [keyPrint('a,aa'), keyPrint('a')], B: [keyPrint('b, x'), keyPrint('b')] })];
  const plan = planUpdate({ globalLore: cur, customscript: [] }, { schema: 1, version: '9', minPlugin: '0', data: { globalLore: inc, customscript: [] } });
  const by = Object.fromEntries(plan.next.globalLore.map((e) => [e.comment, e]));
  assert.equal(by.A.key, 'a');
  assert.equal(by.B.key, 'b, mine');
  assert.equal(by.B.content, 'new');
});

test('보내는 방식에 맞게 @@dont_activate 줄을 붙이고 뗀다', () => {
  assert.equal(lore.syncDecorators(BOOKS.filter((e) => !String(e.comment).startsWith('📚')), 'plugin'), null, '자리 항목이 없으면 그대로');
  const got = lore.syncDecorators(BOOKS, 'plugin');
  assert.equal(got.find((e) => e.comment === '내가 넣은 요원').content, '@@dont_activate\n데코 없음');
  assert.equal(got.filter((e, i) => e !== BOOKS[i]).length, 1, '다른 항목은 그대로');
  assert.equal(lore.syncDecorators(got, 'plugin'), null);
  const risu = lore.syncDecorators(got, 'risu');
  assert.equal(risu.find((e) => e.comment === '제이').content, '제이');
  assert.ok(risu.every((e) => !String(e.content).includes('@@dont_activate')));
  assert.equal(risu.find((e) => e.comment.startsWith('📚')).alwaysActive, true, '자리 항목은 그대로');
  const chat = { message: [{ role: 'user', data: '제이' }], scriptstate: {} };
  const r = lore.computeLore(risu, chat, { mode: 'risu', depth: 10, budget: 0, env: { vars: {} } });
  assert.deepEqual(r.picks.map((p) => p.entry.name), ['제이'], 'Risu가 켤 것 추정');
  assert.equal(r.vars.$goei_lore_agent, '', 'Risu가 직접 켤 때는 자리를 비움');
});

test('trimRoster: 전체 로어북이 들어간 인물은 Roster 한 줄 소개에서 뺀다', () => {
  const { trimRoster } = lore;
  const roster = '## Roster\n- Purpose: GM reference.\n\n#### Team\n- Jyaldi (early 30s/F): boss.\n- Aileen (early 20s/F): cynic.\n\n## Other\n- Jyaldi (x): keep\n';
  const out = trimRoster([{ role: 'system', content: roster }, { role: 'system', content: '### Character - Jyaldi\n- Age: 30s' }]);
  assert.equal(out[0].content, '## Roster\n- Purpose: GM reference.\n\n#### Team\n- Aileen (early 20s/F): cynic.\n\n## Other\n- Jyaldi (x): keep\n');
  const same = [{ role: 'system', content: roster }];
  assert.equal(trimRoster(same), same);
});
