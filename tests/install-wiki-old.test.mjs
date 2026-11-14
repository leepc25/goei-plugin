// 사용자 11-14 D-3·C-5 (가): 받아 둔 위키 기본 문서가 옛 판이면 설치·점검 점검표 글은 「새 판 있음 (다시 받기, 약 1MB)」,
// 관리 → 상태 점검도 「있음」 대신 「새 판 있음」 + 받기 단추. 새 판 확인은 한 번만 보내고, 설치·점검 창은 짧은 한도까지만 기다린다.
// 실행: node --test tests/install-wiki-old.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { installPackText } from '../scripts/data-pack.mjs';

const out = await build({
  stdin: {
    contents: `
      export { checkInstall, checkWikiPackOld, dropWikiPack, installWikiPack, wikiPackOld, WIKI_CHECK_MS } from './src/host/install';
      export { installPage, instUi, refreshInstall } from './src/ui/editor/install';
      export { managePage, ensureManage } from './src/ui/editor/manage';
      export { applyInstallPack } from './src/core/datapack';
      export { setStoredWikiPack, WIKI_PACK_HEAD } from './src/core/wiki';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text', '.md': 'text' },
  define: { __UPDATE_BASE__: '"https://example.invalid/release"', __PLUGIN_VERSION__: '"0.0.0"', __WORLD_PACK__: '"{}"', __INSTALL_PACK__: '"{}"', __ITEMS_PACK__: '"{}"', __LOOKS_PACK__: '"{}"', __HOMESHOP_PACK__: '"{}"' },
});
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
M.applyInstallPack(installPackText());

const PACK = `${M.WIKI_PACK_HEAD}AAAA`;
const DIGEST_KEY = 'goei:wikibase-digest';

/** 가짜 Risu: wiki-base.json 은 index(없으면 hang 약속)로, wiki-base.0.txt 는 묶음으로 답한다 */
function fakeRisu({ digest, index, hang }) {
  const store = new Map(digest ? [[DIGEST_KEY, digest]] : []);
  const box = { char: { chaId: 'w1', name: '내 봇' }, store, indexFetches: 0 };
  globalThis.risuai = {
    getCharacterFromIndex: async () => structuredClone(box.char),
    setCharacterToIndex: async (_i, next) => void (box.char = structuredClone(next)),
    nativeFetch: async (url) => {
      const u = String(url);
      if (/\/wiki-base\.json\?/.test(u)) {
        box.indexFetches++;
        if (hang) await hang;
        return { ok: true, status: 200, text: async () => JSON.stringify(index) };
      }
      if (/\/wiki-base\.0\.txt\?/.test(u)) return { ok: true, status: 200, text: async () => PACK };
      return { ok: false, status: 404, text: async () => '' };
    },
    pluginStorage: { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k), keys: async () => [...store.keys()] },
  };
  return box;
}
const ctx = (box) => ({ charIndex: 0, chatIndex: 0, char: box.char, chat: {} });
const INDEX = { parts: ['wiki-base.0.txt'], length: PACK.length, digest: 'new' };
const wikiRow = (html) => html.split('<div class="ps-row').find((r) => r.includes('<b>위키 기본 문서')) ?? '';

test('옛 판: 점검표 글이 「새 판 있음 (다시 받기, 약 1MB)」, 상태 점검도 「새 판 있음」 + 받기 단추. 확인은 한 번만', async () => {
  await M.dropWikiPack().catch(() => {});
  const box = fakeRisu({ digest: 'old', index: INDEX });
  M.setStoredWikiPack(PACK);
  M.instUi.forChar = -1;

  let r = await M.checkInstall(0);
  assert.equal(r.state.wikiPack, false, '빠진 것으로 세어 전체 단추가 다시 받는다');
  assert.equal(r.wikiOld, true);
  r = await M.checkInstall(0);
  assert.equal(r.wikiOld, true);
  assert.equal(box.indexFetches, 1, '새 판 확인은 한 번만 보낸다');

  await M.refreshInstall(ctx(box));
  let row = wikiRow(M.installPage(ctx(box)));
  assert.match(row, /새 판 있음 \(다시 받기, 약 1MB\)/);
  assert.doesNotMatch(row, /없음/, '있는 문서를 「없음」이라고 하지 않는다');

  row = wikiRow(M.managePage(ctx(box), 'manage:diag', false));
  assert.match(row, />새 판 있음</);
  assert.doesNotMatch(row, />있음</);
  assert.match(row, /data-action="man-get-wiki"/, '받기 단추가 나온다');
  assert.match(row, /받기 \(약 1MB\)/);

  // 다시 받으면 두 화면 모두 「있음」
  await M.installWikiPack(() => {});
  assert.equal(box.store.get(DIGEST_KEY), 'new');
  assert.equal(M.wikiPackOld(), false);
  r = await M.checkInstall(0);
  assert.equal(r.state.wikiPack, true);
  assert.equal(r.wikiOld, false);
  await M.refreshInstall(ctx(box));
  assert.match(wikiRow(M.installPage(ctx(box))), /저장소에 있음 \(이 기기 공통\)/);
  row = wikiRow(M.managePage(ctx(box), 'manage:diag', false));
  assert.match(row, />있음</);
  assert.doesNotMatch(row, /man-get-wiki/);
});

test('같은 판·없음: 글은 전과 같다', async () => {
  await M.dropWikiPack();
  let box = fakeRisu({ digest: 'new', index: INDEX });
  M.setStoredWikiPack(PACK);
  let r = await M.checkInstall(0);
  assert.equal(r.state.wikiPack, true);
  assert.equal(r.wikiOld, false);

  await M.dropWikiPack();
  box = fakeRisu({ index: INDEX });
  r = await M.checkInstall(0);
  assert.equal(r.state.wikiPack, false);
  assert.equal(r.wikiOld, false);
  M.instUi.forChar = -1;
  await M.refreshInstall(ctx(box));
  assert.match(wikiRow(M.installPage(ctx(box))), /없음 \(약 1MB\)/);
  const row = wikiRow(M.managePage(ctx(box), 'manage:diag', false));
  assert.match(row, />없음</);
  assert.match(row, /man-get-wiki/);
  assert.equal(box.indexFetches, 0, '받아 둔 묶음이 없으면 새 판 확인을 보내지 않는다');
});

test('새 판 확인 응답이 멈춰도 설치·점검은 짧은 한도 뒤에 뜬다. 늦게 온 답은 다음 점검에 반영', async () => {
  await M.dropWikiPack();
  let release;
  const hang = new Promise((res) => (release = res));
  const box = fakeRisu({ digest: 'old', index: INDEX, hang });
  M.setStoredWikiPack(PACK);
  assert.ok(M.WIKI_CHECK_MS <= 5000, '한도는 짧게');

  const t0 = Date.now();
  let r = await M.checkInstall(0);
  const took = Date.now() - t0;
  assert.ok(took < M.WIKI_CHECK_MS + 2000, `한도 안에 뜬다 (${took}ms)`);
  assert.equal(r.state.wikiPack, true, '확인 못 했으면 있는 것으로');
  assert.equal(r.wikiOld, false);

  // 상태 점검을 그려 둔다: 답이 오면 다시 그린다
  let renders = 0;
  M.ensureManage(() => renders++);
  assert.match(wikiRow(M.managePage(ctx(box), 'manage:diag', false)), />있음</);

  release();
  assert.equal(await M.checkWikiPackOld(), true);
  await new Promise((res) => setTimeout(res, 0));
  assert.ok(renders >= 1, '옛 판으로 확인되면 상태 점검을 다시 그린다');
  r = await M.checkInstall(0);
  assert.equal(r.wikiOld, true);
  assert.equal(box.indexFetches, 1, '다시 보내지 않는다');
  assert.match(wikiRow(M.managePage(ctx(box), 'manage:diag', false)), />새 판 있음</);
  await M.dropWikiPack();
});
