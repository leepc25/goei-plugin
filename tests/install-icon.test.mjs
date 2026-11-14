// 사용자 11-14 D-2 (가): 「이전 아이콘으로」 되돌린 봇은 전체 설치 단추(「빠진 것 전부 채우기」)가 아이콘을 건드리지 않고 단추 강조도 풀린다.
// 세부 선택의 「플러그인 아이콘으로」 단추로만 다시 플러그인 아이콘이 된다.
// 실행: node --test tests/install-icon.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { installPackText } from '../scripts/data-pack.mjs';

const out = await build({
  stdin: {
    contents: `
      export { checkInstall, installIcon, restoreIcon } from './src/host/install';
      export { installAction, installPage, instUi, refreshInstall } from './src/ui/editor/install';
      export { applyInstallPack } from './src/core/datapack';
      export { installData, installLore, plantGreetings, installLoreSettings } from './src/core/install';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text', '.md': 'text' },
  define: { __UPDATE_BASE__: '"https://example.invalid/release"', __PLUGIN_VERSION__: '"0.0.0"', __WORLD_PACK__: '"{}"', __INSTALL_PACK__: '"{}"', __ITEMS_PACK__: '"{}"', __LOOKS_PACK__: '"{}"', __HOMESHOP_PACK__: '"{}"' },
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
M.applyInstallPack(installPackText());

const ICON = new Uint8Array(readFileSync(new URL(`../release/${M.installData().icon.file}`, import.meta.url)));
const ICON_KEY = 'goei:icon';

/** 캐릭터 하나와 기기 저장소만 있는 가짜 Risu. 아이콘 파일만 받을 수 있다 (그 밖의 받기는 실패) */
function fakeRisu(char) {
  const store = new Map();
  const box = { char, store, fetched: [] };
  let n = 0;
  globalThis.risuai = {
    getCharacterFromIndex: async () => structuredClone(box.char),
    setCharacterToIndex: async (_i, next) => void (box.char = structuredClone(next)),
    saveAsset: async () => `assets/saved-${++n}.webp`,
    nativeFetch: async (url) => {
      box.fetched.push(String(url));
      if (/\/icon\.(png|webp)\?/.test(String(url))) return { ok: true, status: 200, arrayBuffer: async () => ICON.buffer.slice(0) };
      return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '' };
    },
    pluginStorage: { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k), keys: async () => [...store.keys()] },
  };
  return box;
}
const note = (box) => JSON.parse(box.store.get(ICON_KEY) ?? '{}')[box.char.chaId];
const iconFetches = (box) => box.fetched.filter((u) => /\/icon\./.test(u)).length;

test('host: 「이전 아이콘으로」는 기록을 지우지 않고 되돌렸다고 적는다. 다시 넣으면 풀린다', async () => {
  const box = fakeRisu({ chaId: 'c1', name: '내 봇', image: 'assets/mine.png' });
  await M.installIcon(0, () => {});
  assert.equal(box.char.image, 'assets/saved-1.webp');
  assert.deepEqual(note(box), { ours: 'assets/saved-1.webp', prev: 'assets/mine.png' }, '되돌리기 전 기록 모양은 그대로');
  let r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.iconPrev, 'assets/mine.png');
  assert.equal(r.iconDeclined, false);

  assert.equal(await M.restoreIcon(0), true);
  assert.equal(box.char.image, 'assets/mine.png');
  assert.equal(note(box)?.declined, true, '되돌린 기록이 남는다');
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, false);
  assert.equal(r.iconDeclined, true);
  assert.equal(r.iconPrev, '', '이미 이전 아이콘이므로 「이전 아이콘으로」는 내지 않는다');

  await M.installIcon(0, () => {});
  assert.deepEqual(note(box), { ours: 'assets/saved-2.webp', prev: 'assets/mine.png' }, '다시 넣으면 되돌린 표시가 풀린다');
  r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.iconDeclined, false);
  assert.equal(r.iconPrev, 'assets/mine.png');
});

test('host·화면: 되돌린 뒤 Risu 에서 플러그인 아이콘을 직접 메인으로 고르면 「이전 아이콘으로」가 다시 나온다', async () => {
  const box = fakeRisu({ chaId: 'c3', name: '내 봇', image: 'assets/mine.png' });
  const ctx = () => ({ charIndex: 0, chatIndex: 0, char: box.char, chat: {} });
  M.instUi.forChar = -1;
  await M.installIcon(0, () => {});
  const ours = box.char.image;
  assert.equal(await M.restoreIcon(0), true);
  // Risu 아이콘 목록에서 직접 고름: 기록(declined)은 그대로, 메인만 우리 것
  box.char = { ...box.char, image: ours };
  assert.equal(note(box)?.declined, true);
  let r = await M.checkInstall(0);
  assert.equal(r.state.icon, true);
  assert.equal(r.iconPrev, 'assets/mine.png', '지금 플러그인 아이콘이므로 되돌릴 길을 낸다');
  assert.equal(r.iconDeclined, false);
  await M.refreshInstall(ctx());
  const html = M.installPage(ctx());
  assert.match(html, /data-action="ed-inst-icon-back"/);
  assert.doesNotMatch(html, /data-action="ed-inst-icon"[ >]/);

  // 다시 되돌리면 전과 같다
  assert.equal(await M.restoreIcon(0), true);
  assert.equal(box.char.image, 'assets/mine.png');
  r = await M.checkInstall(0);
  assert.equal(r.iconDeclined, true);
  assert.equal(r.iconPrev, '');
});

test('화면: 되돌린 봇은 전체 단추가 아이콘을 건드리지 않고 강조가 풀린다. 「플러그인 아이콘으로」로만 다시 바뀐다', async () => {
  // 로어북·인사말·첫 메시지·로어북 설정이 갖춰진 설치된 봇 (사진은 다 받지 못한 상태: 이어 받으려고 전체 단추를 누르는 경우)
  const lore = M.installLore([]).lore;
  const planted = M.plantGreetings([], lore);
  const box = fakeRisu({ chaId: 'c2', name: '내 봇', image: 'assets/mine.png', globalLore: planted.lore ?? lore, alternateGreetings: planted.greetings, firstMessage: M.installData().greetings.first, loreSettings: M.installLoreSettings(undefined), additionalAssets: [] });
  const ctx = () => ({ charIndex: 0, chatIndex: 0, char: box.char, chat: {} });
  const env = { render: () => {}, refresh: async () => {} };
  M.instUi.forChar = -1;

  await M.installIcon(0, () => {});
  await M.refreshInstall(ctx());
  assert.match(M.installPage(ctx()), /data-action="ed-inst-icon-back"/);
  assert.doesNotMatch(M.installPage(ctx()), /data-action="ed-inst-icon"[ >]/);

  await M.installAction('ed-inst-icon-back', ctx(), env);
  assert.equal(box.char.image, 'assets/mine.png');
  assert.equal(M.instUi.iconDeclined, true);
  let html = M.installPage(ctx());
  assert.match(html, /<button class="gx-mini" data-action="ed-inst-icon" >플러그인 아이콘으로<\/button>/, '세부 선택에 「플러그인 아이콘으로」');
  assert.doesNotMatch(html, /data-action="ed-inst-icon-back"/);

  // 전체 단추: 사진 받기는 이 가짜 환경에서 실패하지만 아이콘은 받으려 들지도 않는다
  const before = iconFetches(box);
  await M.installAction('ed-inst-all', ctx(), env);
  assert.equal(iconFetches(box), before, '전체 단추가 아이콘을 받지 않는다');
  assert.equal(box.char.image, 'assets/mine.png', '되돌린 아이콘 그대로');
  assert.equal(note(box)?.declined, true);

  // 단추 강조: 아이콘 말고 다 갖춰졌으면 「다시 점검·맞추기」(강조 없음)
  M.instUi.state = { ...M.instUi.state, goei: true, pictures: { missing: [], bytes: 0, total: 0 }, wikiPack: true, tokenizer: true, directoryGaps: 0 };
  html = M.installPage(ctx());
  assert.match(html, /<button class="gx-mini" data-action="ed-inst-all">다시 점검·맞추기<\/button>/);
  M.instUi.iconDeclined = false;
  assert.match(M.installPage(ctx()), /<button class="gx-mini primary" data-action="ed-inst-all">빠진 것 전부 채우기<\/button>/, '기록이 없는 봇은 전처럼 강조');

  // 「플러그인 아이콘으로」
  await M.installAction('ed-inst-icon', ctx(), env);
  assert.equal(box.char.image, note(box).ours, '플러그인 아이콘이 메인');
  assert.equal(M.instUi.iconDeclined, false);
  assert.equal(M.instUi.state.icon, true);
  assert.match(M.instUi.info, /^아이콘 — 끝났어요\.$/);
  html = M.installPage(ctx());
  assert.match(html, /data-action="ed-inst-icon-back"/);
  assert.doesNotMatch(html, /data-action="ed-inst-icon"[ >]/);
});
