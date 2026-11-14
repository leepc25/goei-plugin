// 재검토 11-14 (1-2): 설정 「초기화」가 고정해 둔 장부를 「그 전으로 되돌리기」가 지우지 않는다 (사용자 16-1: 이야기 중인데 장부 없는 채팅은 지금 시작값 고정).
// 실행: node --test tests/fix-settings-reset-undo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({
  stdin: {
    contents: `
      export { handleSettings, settingsUi, THEME_KEY } from './src/ui/settings';
      export { setPrefs, getPrefs } from './src/core/settings';
      export { readWallet, walletBalance, walletVars, WALLET_VAR, WALLET_START_DEFAULT } from './src/core/wallet';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'browser', target: 'es2022', charset: 'utf8', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text', '.md': 'text' },
  define: { __UPDATE_BASE__: '""', __PLUGIN_VERSION__: '"0.0.0"', __WORLD_PACK__: '"{}"', __INSTALL_PACK__: '"{}"', __ITEMS_PACK__: '"{}"', __LOOKS_PACK__: '"{}"', __HOMESHOP_PACK__: '"{}"' },
});

/** 채팅 하나와 기기 저장소만 있는 가짜 Risu */
function fakeRisu(chat) {
  const store = new Map();
  globalThis.risuai = {
    getChatFromIndex: async () => structuredClone(chat.now),
    setChatToIndex: async (_c, _i, next) => void (chat.now = structuredClone(next)),
    pluginStorage: { getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => void store.set(k, v), removeItem: async (k) => void store.delete(k) },
  };
}

const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('초기화 → 되돌리기: 초기화가 고정한 장부는 남고, 그 사이에 생긴 거래 줄도 남는다', async () => {
  // 이야기 중(사용자 메시지 있음)인데 장부가 아직 없는 채팅. 기기 시작 잔고는 50,000
  const chat = { now: { message: [{ role: 'char', data: '시작' }, { role: 'user', data: '안녕' }], scriptstate: { $st_agent_count: '5' } } };
  fakeRisu(chat);
  M.setPrefs({ walletStart: 50_000 });
  assert.equal(M.getPrefs().walletStart, 50_000);
  const ctx = () => ({ charIndex: 0, chatIndex: 0, char: { globalLore: [] }, chat: structuredClone(chat.now) });
  const env = { render: () => {}, refresh: async () => {} };

  M.settingsUi.confirm = 'reset';
  await M.handleSettings('set-bar-yes', '', ctx(), env);
  assert.equal(M.settingsUi.notice, '');
  // 초기화: 기기 시작 잔고는 지워지고(다시 140,000), 장부는 그때 시작값 50,000으로 고정
  assert.equal(M.getPrefs().walletStart, undefined);
  assert.equal(M.readWallet(chat.now.scriptstate, M.WALLET_START_DEFAULT).start, 50_000);
  assert.ok(M.settingsUi.undo, '되돌리기 띠가 뜬다');
  assert.equal(M.WALLET_VAR in M.settingsUi.undo.before, false, '장부는 되돌릴 것에 들지 않는다');

  // 초기화와 되돌리기 사이에 거래 한 줄
  const w = M.readWallet(chat.now.scriptstate, M.WALLET_START_DEFAULT);
  w.log.push({ id: 't1', anchor: '', amount: -3_000, memo: '커피', src: 'manual' });
  Object.assign(chat.now.scriptstate, M.walletVars(w));

  await M.handleSettings('set-bar-undo', '', ctx(), env);
  assert.equal(M.settingsUi.notice, '');
  // 설정 값은 돌아오고
  assert.equal(chat.now.scriptstate.$st_agent_count, '5');
  // 장부는 그대로: 시작값 50,000 + 거래 줄 → 잔고 47,000 (140,000으로 튀지 않는다)
  const after = M.readWallet(chat.now.scriptstate, M.getPrefs().walletStart ?? M.WALLET_START_DEFAULT);
  assert.equal(after.start, 50_000);
  assert.deepEqual(after.log.map((e) => e.id), ['t1']);
  assert.equal(M.walletBalance(after, new Set()), 47_000);
});
