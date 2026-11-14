// 시작기(src/main.ts): 받기 창의 「다시 받기」와 뒤에서 도는 조용한 재시도가 겹쳐도 본체는 한 번만 켜진다 (loader#9)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-test', { recursive: true });
await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist-test/main-single-start.mjs',
  logLevel: 'silent',
  define: { __PLUGIN_VERSION__: '"t"', __UPDATE_BASE__: '"x"' },
});

const CODE = '// goei-body t\n/* 가짜 본체 */';
const realNow = Date.now;
const realLog = console.log;
let seq = 0;

const until = async (cond, what) => {
  for (let i = 0; i < 2000; i++) {
    if (cond()) return;
    await new Promise((r) => setImmediate(r));
  }
  throw new Error(`기다리다 끝남: ${what}`);
};

/** 가짜 Risu·화면을 깔고 시작기를 새로 읽는다 */
async function boot() {
  const s = {
    starts: 0, // 본체 start 횟수
    runs: 0, // 본체 코드 실행(runBody) 횟수
    unloads: 0,
    root: null, // 받기 창
    net: 'fail', // 'fail' | 'ok' | 'hold'(holdNet 을 풀 때까지 기다림)
    holdNet: null,
    holdStart: null, // 본체 start 가 기다릴 약속
    handlers: {},
    button: null,
    onUnload: null,
  };
  const el = () => {
    const e = {
      hidden: false,
      textContent: '',
      nonce: '',
      disabled: false,
      listeners: {},
      innerHTML: '',
      append() {},
      remove() {},
      click() {},
      addEventListener(type, f) { e.listeners[type] = f; },
      querySelector: () => el(),
      querySelectorAll: () => [el(), el(), el()],
    };
    return e;
  };
  const body = {
    beforeRequest: async (m) => m,
    output: async () => {},
    input: async (t) => t,
    display: async (t) => t,
    install: () => {},
    sanitize: (m) => m,
    unload: async () => { s.unloads++; },
  };
  globalThis.document = {
    createElement: () => el(),
    querySelectorAll: () => [],
    body: { append(e) { s.root = e; } },
    head: {
      append() {
        s.runs++;
        globalThis.__goeiBody = {
          version: 't',
          start: async () => {
            s.starts++;
            if (s.holdStart) await s.holdStart;
            return body;
          },
        };
      },
    },
  };
  const res = (text) => ({ ok: true, status: 200, text: async () => text });
  globalThis.risuai = {
    pluginStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    nativeFetch: async (url) => {
      const net = s.net;
      if (net === 'fail') return { ok: false, status: 500, text: async () => '' };
      if (net === 'hold') await s.holdNet;
      return String(url).includes('goei-body.json') ? res(JSON.stringify({ version: 't', parts: ['goei-body.0.txt'], length: CODE.length })) : res(CODE);
    },
    registerButton: async (_o, cb) => { s.button = cb; },
    requestPluginPermission: async () => {},
    addRisuReplacer: async (type, f) => { s.handlers[type] = f; },
    addRisuChatListener: async (type, f) => { s.handlers[type] = f; },
    addRisuScriptHandler: async (type, f) => { s.handlers[type] = f; },
    removeRisuReplacer: async () => {},
    removeRisuChatListener: async () => {},
    removeRisuScriptHandler: async () => {},
    onUnload: async (f) => { s.onUnload = f; },
    getCurrentCharacterIndex: async () => -1,
    getCharacterFromIndex: async () => null,
    showContainer: async () => {},
    hideContainer: async () => {},
  };
  console.log = () => {};
  await import(`../dist-test/main-single-start.mjs?n=${++seq}`);
  s.click = (gl) => s.root.listeners.click({ target: { closest: () => ({ dataset: { gl } }) } });
  s.end = async () => {
    Date.now = realNow;
    console.log = realLog;
    await s.onUnload?.();
  };
  // 첫 받기 실패 → 받기 창
  s.button();
  await until(() => s.root, '받기 창');
  // 1분 뒤: 표식 든 메시지가 그려지면 조용히 다시 받는다
  Date.now = () => realNow() + 61_000;
  return s;
}

test('조용한 재시도가 본체를 켜는 중에 「다시 받기」를 눌러도 본체는 한 번만 켜진다', async () => {
  const s = await boot();
  try {
    let open;
    s.holdStart = new Promise((r) => (open = r));
    s.net = 'ok';
    const shown = s.handlers.display('%%SEED%% 글');
    await until(() => s.starts === 1, '조용한 재시도의 본체 시작');
    s.click('get');
    // 창의 받기가 끝나 install 이 start 까지 갈 시간을 준다
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    open();
    assert.equal(await shown, '%%SEED%% 글');
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    assert.equal(s.runs, 1, '본체 코드는 한 번만 실행');
    assert.equal(s.starts, 1, '본체 start 는 한 번만');
  } finally {
    await s.end();
  }
});

test('조용한 재시도가 받는 중에 「다시 받기」로 본체가 켜지면, 뒤늦게 받은 쪽은 다시 켜지 않는다', async () => {
  const s = await boot();
  try {
    let open;
    s.holdNet = new Promise((r) => (open = r));
    s.net = 'hold';
    const shown = s.handlers.display('%%SEED%% 글');
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    assert.equal(s.starts, 0);
    s.net = 'ok';
    s.click('get');
    await until(() => s.starts === 1, '받기 창의 본체 시작');
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    open();
    assert.equal(await shown, '%%SEED%% 글');
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    assert.equal(s.runs, 1, '본체 코드는 한 번만 실행');
    assert.equal(s.starts, 1, '본체 start 는 한 번만');
  } finally {
    await s.end();
  }
});

test('앞선 시작이 실패하면 뒤따른 쪽이 제 본체로 이어서 켠다', async () => {
  const s = await boot();
  try {
    let fail;
    s.holdStart = new Promise((_, rej) => (fail = rej));
    s.net = 'ok';
    const shown = s.handlers.display('%%SEED%% 글');
    await until(() => s.starts === 1, '조용한 재시도의 본체 시작');
    s.click('get');
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    s.holdStart = null;
    fail(new Error('시작 실패'));
    assert.equal(await shown, '%%SEED%% 글');
    await until(() => s.starts === 2, '뒤따른 쪽의 본체 시작');
    for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r));
    assert.equal(s.starts, 2);
    // 켜졌으니 표시 처리기가 본체로 간다 (다시 켜지 않는다)
    assert.equal(await s.handlers.display('%%SEED%% 글'), '%%SEED%% 글');
    assert.equal(s.starts, 2);
  } finally {
    await s.end();
  }
});
