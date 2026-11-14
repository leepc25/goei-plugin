// 재검토 11-14 (1-4): 설정 머리의 「기본값 불러오기」「초기화」「되돌리기」로 보고서 카드 표시가 바뀌면 이미 뜬 카드도 다시 그린다
// (채팅 카드 열쇠 표를 다시 모으고, 채팅을 그대로 한 번 더 저장해 display 처리기가 다시 돌게 한다). 안 바뀌면 다시 그리지 않는다.
// 실행: node --test tests/fix-settings-bar-cards.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { worldPackText } from '../scripts/data-pack.mjs';

const out = await build({
  stdin: {
    contents: `
      export { handleSettings, settingsUi } from './src/ui/settings';
      export { setPrefs, getPrefs } from './src/core/settings';
      export { reportCardKeys, refreshStatusContext } from './src/host/statusview';
      export { reportVars, readReports } from './src/core/journal';
      export { applyWorldPack } from './src/core/datapack';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text', '.md': 'text' },
  define: { __UPDATE_BASE__: '""', __PLUGIN_VERSION__: '"0.0.0"', __WORLD_PACK__: '"{}"', __INSTALL_PACK__: '"{}"', __ITEMS_PACK__: '"{}"', __LOOKS_PACK__: '"{}"', __HOMESHOP_PACK__: '"{}"' },
});

/** 채팅 하나와 기기 저장소만 있는 가짜 Risu. sets = 채팅 저장 횟수 */
function fakeRisu(chat) {
  const store = new Map();
  const count = { sets: 0 };
  globalThis.risuai = {
    getChatFromIndex: async () => structuredClone(chat.now),
    setChatToIndex: async (_c, _i, next) => void ((chat.now = structuredClone(next)), count.sets++),
    getCharacterFromIndex: async () => ({ globalLore: [] }),
    pluginStorage: { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k) },
  };
  return count;
}

const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
// 채팅 카드를 다시 모을 때 캐릭터 로어북에 세계 자료를 더하므로 자료 팩을 먼저 넣는다
M.applyWorldPack(worldPackText());

const KEY = '<상태창>열쇠</상태창>';
/** 내가 출동하지 않은 사건의 보고서 하나가 있는 채팅 (표시 「전부」일 때만 카드가 붙는다) */
function newChat(card) {
  const store = M.readReports({});
  store.items.push({ id: 'r1', no: '1', full: false, mine: false, kind: 'an', cause: 'model', head: {}, trail: [], agents: [], result: '', idx: 0, anchor: '', statusKey: KEY, savedAt: '2026-11-14T00:00:00.000Z' });
  return { now: { message: [{ role: 'char', data: '시작' }, { role: 'user', data: '안녕' }], scriptstate: { ...M.reportVars(store), ...(card ? { $jr_chat_card: card } : {}) } } };
}
const env = { render: () => {}, refresh: async () => {} };
const ctxOf = (chat) => ({ charIndex: 0, chatIndex: 0, char: { globalLore: [] }, chat: structuredClone(chat.now) });
const keys = () => [...M.reportCardKeys().keys()];

test('준비: 보고서가 읽히고 표시 「전부」에서만 카드 열쇠가 잡힌다', async () => {
  const chat = newChat('all');
  fakeRisu(chat);
  assert.equal(M.readReports(chat.now).items.length, 1);
  await M.refreshStatusContext(0, 0);
  assert.deepEqual(keys(), [KEY]);
});

test('초기화로 카드 표시가 「전부」→기본으로 바뀌면 뜬 카드가 사라지고, 되돌리면 다시 뜬다', async () => {
  const chat = newChat('all');
  const count = fakeRisu(chat);
  M.setPrefs({});
  await M.refreshStatusContext(0, 0);
  assert.deepEqual(keys(), [KEY]);

  M.settingsUi.confirm = 'reset';
  await M.handleSettings('set-bar-yes', '', ctxOf(chat), env);
  assert.equal(M.settingsUi.notice, '');
  assert.equal(chat.now.scriptstate.$jr_chat_card, undefined);
  assert.deepEqual(keys(), [], '열쇠 표를 다시 모아 카드가 없다');
  assert.equal(count.sets, 2, '설정 저장 + 다시 그리게 하는 저장');

  await M.handleSettings('set-bar-undo', '', ctxOf(chat), env);
  assert.equal(M.settingsUi.notice, '');
  assert.equal(chat.now.scriptstate.$jr_chat_card, 'all');
  assert.deepEqual(keys(), [KEY], '되돌리면 카드가 다시 붙는다');
  assert.equal(count.sets, 4);
});

test('기본값 불러오기로 카드 표시가 바뀌면 뜬 카드에 반영된다', async () => {
  const chat = newChat('');
  const count = fakeRisu(chat);
  M.setPrefs({ vars: { $jr_chat_card: 'all' } });
  await M.refreshStatusContext(0, 0);
  assert.deepEqual(keys(), []);

  M.settingsUi.confirm = 'load';
  await M.handleSettings('set-bar-yes', '', ctxOf(chat), env);
  assert.equal(M.settingsUi.notice, '');
  assert.equal(chat.now.scriptstate.$jr_chat_card, 'all');
  assert.deepEqual(keys(), [KEY]);
  assert.equal(count.sets, 2);
});

test('카드 표시가 안 바뀌는 초기화는 채팅을 한 번만 저장한다 (다시 그리지 않는다)', async () => {
  const chat = newChat('');
  const count = fakeRisu(chat);
  M.setPrefs({});
  M.settingsUi.confirm = 'reset';
  await M.handleSettings('set-bar-yes', '', ctxOf(chat), env);
  assert.equal(M.settingsUi.notice, '');
  assert.equal(count.sets, 1);
});
