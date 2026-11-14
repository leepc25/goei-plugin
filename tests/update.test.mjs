import { test } from 'node:test';
import { REAL } from './realcard.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as core from '../dist-test/core.mjs';
import { compareVersions, cardVersion, mergeByName, planUpdate, isPayload, readManifest, directoryData, readDirectory } from '../dist-test/core.mjs';

test('버전 비교', () => {
  assert.equal(compareVersions('0.15.3', '0.15.10'), -1);
  assert.equal(compareVersions('0.16.0', '0.15.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(cardVersion([]), '0');
  assert.equal(cardVersion([{ comment: '괴이봇 플러그인 매니페스트', content: '{"version":"0.16.0"}' }]), '0.16.0');
});

test('이름끼리 합치기: 바꾸고, 새로 넣고, 사용자 항목·보호 항목은 지킴', () => {
  const name = (e) => e.comment;
  const cur = [{ comment: 'A', content: 'old' }, { comment: '내 메모', content: 'mine' }, { comment: '괴이봇 명부', content: 'user' }, { comment: 'X', content: '1' }, { comment: 'X', content: '2' }];
  const inc = [{ comment: 'A', content: 'new' }, { comment: '괴이봇 명부', content: 'default' }, { comment: 'B', content: 'b' }, { comment: 'X', content: '1' }, { comment: 'X', content: '2b' }];
  const { list, count } = mergeByName(cur, inc, name, (e) => e.comment === '괴이봇 명부');
  assert.deepEqual(list.map((e) => `${e.comment}:${e.content}`), ['A:new', '괴이봇 명부:user', 'B:b', 'X:1', 'X:2b', '내 메모:mine']);
  assert.deepEqual(count, { replaced: 2, added: 1, kept: 1, protected: 1 });
});

test('카드 합치기: 채팅·사진·이름은 그대로, 정해진 칸만 바뀜', () => {
  const char = { name: '내 이름', chats: [{ message: [1] }], image: 'img', additionalAssets: [['a', 'b', 'png']], firstMessage: 'old', globalLore: [{ comment: '괴이봇 명부', content: 'mine' }], customscript: [{ comment: '내 정규식' }, { comment: '📊상태창' }] };
  const payload = { schema: 1, version: '0.16.0', minPlugin: '0.16.0', data: { firstMessage: 'new', globalLore: [{ comment: '괴이봇 명부', content: '{}' }, { comment: '괴이봇 플러그인 매니페스트', content: '{"version":"0.16.0"}' }], customscript: [{ comment: '🖼️에셋출력' }] } };
  assert.ok(isPayload(payload));
  const plan = planUpdate(char, payload);
  assert.equal(plan.next.name, '내 이름');
  assert.equal(plan.next.chats, char.chats);
  assert.equal(plan.next.image, 'img');
  assert.equal(plan.next.firstMessage, 'new');
  assert.deepEqual(plan.fields, ['firstMessage']);
  assert.equal(plan.next.globalLore[0].content, 'mine');
  assert.equal(cardVersion(plan.next.globalLore), '0.16.0');
  assert.deepEqual(plan.next.customscript.map((r) => r.comment), ['🖼️에셋출력', '내 정규식'], '옛 상태창 정규식은 빠짐');
});

const PAYLOAD = new URL('../release/card-update.json', import.meta.url);
test('실제 카드 업데이트 파일: 형식·매니페스트 버전', { skip: !existsSync(PAYLOAD) }, () => {
  // card-update.json은 조각 목록, 실제 데이터는 card-update.N.txt를 이어 붙인 것
  const index = JSON.parse(readFileSync(PAYLOAD, 'utf8'));
  const text = index.parts.map((n) => readFileSync(new URL(n, PAYLOAD), 'utf8')).join('');
  assert.equal(text.length, index.length, 'JS 글자 수와 목록의 length가 같아야 한다');
  for (const n of index.parts) assert.ok(Buffer.byteLength(readFileSync(new URL(n, PAYLOAD), 'utf8')) <= 200_000);
  const p = JSON.parse(text);
  assert.equal(p.version, index.version);
  assert.ok(isPayload(p));
  assert.ok(readManifest(p.data.globalLore));
  assert.equal(cardVersion(p.data.globalLore), p.version);
  // 같은 카드에 다시 적용하면 바뀌는 것이 없어야 한다
  const plan = planUpdate({ ...p.data }, p);
  assert.deepEqual([plan.fields, plan.lore.replaced, plan.lore.added, plan.lore.kept], [[], 0, 0, 0]);
});

test('예전 카드 업데이트: 괴이봇 명부 → Directory, 옛 데이터 로어북은 명부로 옮기고 지움', { skip: !existsSync(PAYLOAD) || !existsSync(REAL) }, () => {
  const index = JSON.parse(readFileSync(PAYLOAD, 'utf8'));
  const p = JSON.parse(index.parts.map((n) => readFileSync(new URL(n, PAYLOAD), 'utf8')).join(''));
  const m = JSON.parse(readFileSync(REAL, 'utf8'));
  const orig = m.lorebook ?? m.module?.lorebook;
  // v0.16.25 무렵 사용자 카드: 옛 이름 명부(요원 직급을 고침) + Faction display(고침)·Phone tabs·Start trigger·LB Backend·옛 매니페스트
  const dir = directoryData(readDirectory(orig));
  delete dir.호칭; delete dir['괴담톡 탭']; delete dir['시작 로어북'];
  const agent = Object.keys(dir.요원)[0];
  dir.요원[agent].rank = '내가 고친 직급';
  const display = JSON.parse(orig.find((e) => e.comment === 'Faction display').content);
  display.B00.A00 = '짝퉁 관리국';
  const user = [
    ...orig.filter((e) => !['Agent roster', 'Settings', '통합설정'].includes(e.comment)).map((e) => (e.comment === 'Faction display' ? { ...e, content: JSON.stringify(display) } : e)),
    { comment: '괴이봇 명부', content: JSON.stringify(dir), key: '', mode: 'normal' },
    { comment: '괴이봇 플러그인 매니페스트', content: '{"version":"0.16.25"}', key: '', mode: 'normal' },
    { comment: '내 메모', content: '메모', key: '', mode: 'normal' },
  ];
  const plan = planUpdate({ globalLore: user, customscript: [] }, p);
  const lore = plan.next.globalLore;
  const names = lore.map((e) => e.comment);
  for (const n of ['괴이봇 명부', '괴이봇 플러그인 매니페스트', 'LB Backend', 'Faction display', 'Phone tabs', 'Start trigger', 'World catalog']) assert.ok(!names.includes(n), n);
  assert.equal(names.filter((n) => n === 'Directory').length, 1);
  assert.ok(names.includes('내 메모'));
  const saved = JSON.parse(lore.find((e) => e.comment === 'Directory').content);
  assert.equal(saved.요원[agent].rank, '내가 고친 직급');
  assert.equal(saved.호칭.B00.A00, '짝퉁 관리국');
  assert.ok(saved['시작 로어북']['A00-1'].length && saved['괴담톡 탭'].tabs.length);
  assert.equal(cardVersion(lore), p.version);
});

test('update: image tag regexes move to the plugin and are removed from old cards', () => {
  const char = { name: 'x', chats: [], globalLore: [], customscript: [{ comment: '🖼️에셋줄바꿈' }, { comment: '🖼️에셋출력' }, { comment: '🖼️에셋리퀘제거' }, { comment: '내 정규식' }] };
  const payload = { schema: 1, version: '0.16.40', minPlugin: '0.16.40', data: { globalLore: [{ comment: '괴이봇 플러그인 매니페스트', content: '{"version":"0.16.40"}' }], customscript: [] } };
  assert.deepEqual(planUpdate(char, payload).next.customscript.map((r) => r.comment), ['내 정규식']);
});

test('카드 업데이트: 새 카드 명부에만 있는 칸(시작 소지품 등)은 사용자 명부 빈 자리에 채우고, 고친 값은 그대로 (2026-11-08)', () => {
  const mine = { schema: 1, 요원: { 살라딘: { affiliation: '내가 고친 소속' } } };
  const def = { schema: 1, 요원: { 살라딘: { affiliation: '기본 소속', start_items: [{ name: '단검' }] }, 새요원: { affiliation: 'X' } } };
  const char = { globalLore: [{ comment: 'Directory', content: JSON.stringify(mine) }], customscript: [] };
  const payload = { schema: 1, version: '0.21.4', minPlugin: '0.21.0', data: { globalLore: [{ comment: 'Directory', content: JSON.stringify(def) }, { comment: '괴이봇 플러그인 매니페스트', content: '{"version":"0.21.4"}' }], customscript: [] } };
  const plan = planUpdate(char, payload);
  const got = JSON.parse(plan.next.globalLore.find((e) => e.comment === 'Directory').content);
  assert.equal(got.요원.살라딘.affiliation, '내가 고친 소속');
  assert.deepEqual(got.요원.살라딘.start_items, [{ name: '단검' }]);
  assert.ok(got.요원.새요원, '새 요원 칸도 들어옴');
});

// loader#1 (2026-11-14): 아무 봇에 설치한 봇은 ⚙️설정 폴더 key 가 무작위라 카드의 고정 key 와 다르다
function bareBotAndCard() {
  const planted = core.plantGreetings(['인사1']);
  const lore = core.installLore([{ comment: '내 로어', key: 'a', content: 'x', mode: 'normal' }], planted.index);
  const dirEntry = lore.find((e) => e.comment === 'Directory');
  const dj = JSON.parse(dirEntry.content);
  const agent = Object.keys(dj['요원'])[0];
  dj['요원'][agent].__mine = 'USER EDIT';
  dirEntry.content = JSON.stringify(dj);
  const man = lore.find((e) => e.comment === 'Plugin manifest');
  man.content = JSON.stringify({ ...JSON.parse(man.content), version: '0.21.11' });
  const char = { name: '내 봇', globalLore: lore, customscript: [] };
  // 카드: 폴더 key 가 고정값인 ⚙️설정 + Directory + Plugin manifest(source 있음, 버전 높음)
  const CARD_KEY = 'folder:f3b3863b-card-fixed';
  const base = core.installLore([], {});
  const baseKey = base.find((e) => e.mode === 'folder').key;
  const cardLore = base.map((e) => {
    const out = { ...e };
    if (out.mode === 'folder') out.key = CARD_KEY;
    if (out.folder === baseKey) out.folder = CARD_KEY;
    if (out.comment === 'Plugin manifest') out.content = JSON.stringify({ ...JSON.parse(out.content), version: '9.9.9', source: 'card', keys: { settings: CARD_KEY } });
    return out;
  });
  const payload = { schema: 1, version: '9.9.9', minPlugin: '0.21.0', data: { globalLore: cardLore, customscript: [] } };
  return { char, payload, agent, CARD_KEY };
}

test('카드 업데이트: 폴더 key 가 다른 봇(아무 봇에 설치)도 명부·매니페스트가 하나씩이고 사용자 명부를 지킨다 (loader#1)', () => {
  const { char, payload, agent, CARD_KEY } = bareBotAndCard();
  const before = JSON.stringify(payload);
  const myKey = char.globalLore.find((e) => e.mode === 'folder').key;
  assert.notEqual(myKey, CARD_KEY);
  const plan = planUpdate(char, payload);
  assert.equal(JSON.stringify(payload), before, 'payload 원본은 바꾸지 않는다');
  const check = (lore) => {
    assert.equal(lore.filter((e) => e.comment === 'Directory').length, 1, '명부는 하나');
    const d = core.readDirectoryData(lore);
    assert.ok(d, '명부를 읽을 수 있다');
    assert.equal(d['요원'][agent].__mine, 'USER EDIT', '사용자가 고친 값이 남는다');
    assert.equal(lore.filter((e) => e.comment === 'Plugin manifest').length, 1, '매니페스트는 하나');
    assert.equal(lore.filter((e) => e.mode === 'folder').length, 1, '설정 폴더는 하나');
    assert.equal(lore.find((e) => e.mode === 'folder').key, myKey, '폴더 key 는 지금 카드 것');
    assert.ok(lore.filter((e) => e.folder).every((e) => e.folder === myKey), '폴더 안 항목은 모두 지금 폴더에');
    assert.equal(core.findFolder(lore).key, myKey, '매니페스트의 폴더 key 도 맞음');
    assert.ok(lore.some((e) => e.comment === '내 로어'), '직접 넣은 로어는 남는다');
  };
  check(plan.next.globalLore);
  assert.equal(cardVersion(plan.next.globalLore), '9.9.9');
  assert.equal(plan.lore.protected, 1);
  assert.equal(plan.lore.added, 0);
  // 한 번 더 적용해도 그대로
  check(planUpdate(plan.next, payload).next.globalLore);
});

test('카드 업데이트 안전망: 사용자 명부가 다른 폴더에 있어 짝이 안 맞아도 명부는 사용자 것 하나만 남는다 (loader#1)', () => {
  const { char, payload, agent } = bareBotAndCard();
  char.globalLore = char.globalLore.map((e) => (e.comment === 'Directory' ? { ...e, folder: '' } : e));
  const plan = planUpdate(char, payload);
  const lore = plan.next.globalLore;
  assert.equal(lore.filter((e) => e.comment === 'Directory').length, 1);
  assert.equal(core.readDirectoryData(lore)['요원'][agent].__mine, 'USER EDIT');
  assert.equal(plan.lore.protected, 1);
  const again = planUpdate(plan.next, payload).next.globalLore;
  assert.equal(again.filter((e) => e.comment === 'Directory').length, 1);
  assert.equal(core.readDirectoryData(again)['요원'][agent].__mine, 'USER EDIT');
});

test('카드 업데이트: 내 봇에 설치한 경우 명부의 빠진 칸·카드 사진·버전만 올리고 봇 설명·인사말·트리거·첫 메시지·정규식은 그대로 (사용자 2026-11-14 D-1 (가))', () => {
  const { char, payload, agent } = bareBotAndCard();
  const mine = {
    desc: '내 봇 설명', firstMessage: '내 첫 메시지', alternateGreetings: ['내 인사', '인사1'], triggerscript: [{ comment: '내 트리거' }],
    personality: '내 성격', scenario: '내 시나리오', systemPrompt: '내 지시', characterVersion: '내 판', customscript: [{ comment: '내 정규식', in: 'a', out: 'b' }, { comment: '📊상태창' }],
  };
  Object.assign(char, mine);
  // 명부에서 칸 하나를 빼 둔다 (새 카드 명부에서 채워져야 함)
  const dirEntry = char.globalLore.find((e) => e.comment === 'Directory');
  const dj = JSON.parse(dirEntry.content);
  const gone = Object.keys(dj['요원'])[1];
  delete dj['요원'][gone];
  dirEntry.content = JSON.stringify(dj);
  const before = JSON.parse(char.globalLore.find((e) => e.comment === 'Plugin manifest').content);
  Object.assign(payload.data, { desc: '', firstMessage: '', alternateGreetings: [''], triggerscript: [], personality: '', scenario: '', systemPrompt: '', characterVersion: '9.9.9', customscript: [{ comment: '카드 정규식' }] });
  const cardMan = payload.data.globalLore.find((e) => e.comment === 'Plugin manifest');
  const pics = [['새사진', 'abc', 'webp', 10]];
  cardMan.content = JSON.stringify({ ...JSON.parse(cardMan.content), source: { name: 'card' }, greetings: { 'A00-ko-1': 7 }, pictures: pics });
  const check = (plan) => {
    for (const [k, v] of Object.entries(mine)) assert.deepEqual(plan.next[k], v, `${k} 는 그대로`);
    assert.deepEqual(plan.fields, [], '바뀌는 카드 칸 없음');
    assert.deepEqual([plan.scripts.replaced, plan.scripts.added], [0, 0]);
    const lore = plan.next.globalLore;
    const m = readManifest(lore);
    assert.equal(m.version, '9.9.9', '버전은 올라간다');
    assert.equal(m.source, undefined, '정식 카드 표시가 붙지 않는다');
    assert.deepEqual(m.greetings, before.greetings, '인사말 번호는 내 봇 것 그대로');
    assert.deepEqual(m.keys, before.keys, '폴더 key 그대로');
    assert.deepEqual(m.pictures, pics, '카드 사진 목록은 새 카드 것');
    assert.equal(lore.filter((e) => e.comment === 'Plugin manifest').length, 1);
    const d = core.readDirectoryData(lore);
    assert.equal(d['요원'][agent].__mine, 'USER EDIT', '고친 명부 값은 그대로');
    assert.ok(d['요원'][gone], '명부의 빠진 칸은 채운다');
    assert.ok(lore.some((e) => e.comment === '내 로어'));
  };
  const plan = planUpdate(char, payload);
  check(plan);
  // 한 번 더 적용해도 그대로 (정식 카드로 잘못 읽히지 않는다)
  check(planUpdate(plan.next, payload));
});
