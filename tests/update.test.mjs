import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

const REAL = '/mnt/project-files/analysis/extracted/module.json';
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
