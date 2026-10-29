// 깡통봇 설치·점검 (설계안 9절): 괴이 카드 판정, 인사말 심기, 로어북 심기(없는 것만·key 로 폴더 찾기), 점검
import test from 'node:test';
import assert from 'node:assert/strict';
import { isGoeiLore, installLore, plantGreetings, installCheck, findFolder, installSummary, installData, readManifest, readDirectoryData, WIKI_FOLDER_KEY } from '../dist-test/core.mjs';

// 설치 자료는 본체에 없고 자료 팩(goei-data-install)으로 받는다 (개선 나1). 시험은 dist-test/core.mjs 가 tests/data-init.mjs 로 파일에서 넣어 준다
const INSTALL_GREETINGS = installData().greetings;
const INSTALL_PICTURES = installData().pictures;
const DEFAULT_DIRECTORY = installData().directory;

test('설치 자료(팩): 인사말 57 키, 사진 목록, 기본 명부, 아이콘 정보', () => {
  assert.equal(installData().icon.file, 'icon.png');
  assert.equal(Object.keys(INSTALL_GREETINGS.index).length, 66, '키(세력×언어×시나리오) 66개');
  assert.equal(INSTALL_GREETINGS.texts.length, 57);
  assert.ok(INSTALL_PICTURES.length > 1700);
  assert.equal(DEFAULT_DIRECTORY.schema, 1);
  assert.equal(Object.keys(DEFAULT_DIRECTORY.요원).length, 55);
});

test('괴이 카드 판정: 매니페스트 또는 명부', () => {
  assert.equal(isGoeiLore([]), false);
  assert.equal(isGoeiLore([{ comment: 'x', content: 'y' }]), false);
  assert.equal(isGoeiLore([{ comment: 'Directory', content: JSON.stringify({ schema: 1 }) }]), true);
  assert.equal(isGoeiLore([{ comment: 'Plugin manifest', content: JSON.stringify({ plugin: 'goei-plugin', greetings: {} }) }]), true);
});

test('인사말 심기: 있는 것은 그대로, 같은 글은 번호 재사용, 없는 것은 뒤에', () => {
  const user = ['사용자 인사말', INSTALL_GREETINGS.texts[1]];
  const r = plantGreetings(user);
  assert.equal(r.greetings[0], '사용자 인사말');
  assert.equal(r.greetings[1], INSTALL_GREETINGS.texts[1]);
  const keyOf1 = Object.entries(INSTALL_GREETINGS.index).find(([, n]) => n === 1)[0];
  assert.equal(r.index[keyOf1], 1, '같은 글이 이미 있으면 그 번호');
  assert.equal(r.greetings.length, 2 + 57 - 1);
  for (const [k, n] of Object.entries(INSTALL_GREETINGS.index)) assert.equal(r.greetings[r.index[k]], INSTALL_GREETINGS.texts[n]);
  const again = plantGreetings(r.greetings);
  assert.deepEqual(again.greetings, r.greetings, '두 번 심어도 늘지 않음');
  assert.deepEqual(again.index, r.index);
});

test('로어북 심기: 빈 봇 → 설정 폴더·명부·위키 폴더·매니페스트, 두 번 해도 그대로', () => {
  const planted = plantGreetings([]);
  const lore = installLore([{ key: 'hello', comment: '사용자 로어', content: '그대로' }], planted.index);
  const names = lore.map((e) => e.comment);
  assert.deepEqual(names, ['사용자 로어', '⚙️설정', 'Directory', '📖위키', 'Plugin manifest']);
  const settings = findFolder(lore, 'settings');
  assert.ok(settings.key.startsWith('folder:'));
  assert.equal(lore.find((e) => e.comment === 'Directory').folder, settings.key);
  assert.equal(findFolder(lore, 'wiki').key, WIKI_FOLDER_KEY);
  const m = readManifest(lore);
  assert.equal(m.plugin, 'goei-plugin');
  assert.deepEqual(m.keys, { settings: settings.key, wiki: WIKI_FOLDER_KEY });
  assert.equal(m.pictures.length, INSTALL_PICTURES.length);
  assert.equal(Object.keys(readDirectoryData(lore).요원).length, 55, '기본 명부');
  const twice = installLore(lore, planted.index);
  assert.deepEqual(twice.map((e) => e.comment), names);
  assert.equal(findFolder(twice, 'settings').key, settings.key);
});

test('폴더 이름을 바꿔도 매니페스트 key 로 찾고, 명부를 지우면 기본 명부로 다시 만든다', () => {
  const lore = installLore([], plantGreetings([]).index);
  const renamed = lore.map((e) => (e.comment === '⚙️설정' ? { ...e, comment: '내 설정' } : e)).filter((e) => e.comment !== 'Directory');
  assert.equal(findFolder(renamed, 'settings').comment, '내 설정');
  const st = installCheck({ lore: renamed, alternateGreetings: [], assets: [], iconOurs: false, wikiPack: false });
  assert.equal(st.settingsFolder, true);
  assert.equal(st.directory, false);
  assert.equal(st.manifest, true);
  assert.equal(st.greetings.ok, false);
  assert.equal(st.pictures.missing.length, INSTALL_PICTURES.length);
  assert.ok(installSummary(st).some((t) => t.includes('명부')) && installSummary(st).some((t) => t.includes('인사말')));
  const fixed = installLore(renamed, plantGreetings([]).index);
  assert.equal(fixed.filter((e) => e.comment === '내 설정').length, 1, '폴더를 새로 만들지 않음');
  assert.equal(fixed.find((e) => e.comment === 'Directory').folder, findFolder(fixed, 'settings').key);
});

test('점검: 다 갖춘 카드는 빠진 것 없음', () => {
  const planted = plantGreetings([]);
  const lore = installLore([], planted.index);
  const assets = INSTALL_PICTURES.map((p) => [p[0], `path/${p[1]}`, p[2]]);
  const st = installCheck({ lore, alternateGreetings: planted.greetings, assets, iconOurs: true, wikiPack: true, tokenizer: true });
  assert.deepEqual(installSummary(st), []);
  assert.equal(st.goei, true);
});
