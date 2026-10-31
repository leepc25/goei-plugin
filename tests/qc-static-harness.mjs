// QC(정적 감사) 브라우저 시험 공용 틀: tests/browser.mjs 의 hostScript(가짜 risuai)를 복사·축약한 것.
// 쓰는 곳: tests/qc-static-xss-browser.mjs · qc-static-cache-browser.mjs · qc-static-perf-browser.mjs
//   import { launch, boot, open } from './qc-static-harness.mjs';
//   const { browser } = await launch(); const { page, errors } = await boot(browser, fixture, chat); await open(page);
// 가짜 risuai 는 window.__chat / window.__char 를 읽고 쓴다. 채팅을 바꾸려면 window.__chats[n] 와 getCurrentChatIndex 를 바꾼다.
// window.__calls.api[name] 에 risuai 호출 횟수가 쌓인다 (감시 루프 비용 측정용).
import { createRequire } from 'node:module';
import { distWorldPack } from './data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
export const plugin = readFileSync(new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');
export const bodyCode = readFileSync(new URL('../dist/goei-body.js', import.meta.url), 'utf8');
/** 시험 본체(scripts/build.mjs): 예외 주입 블록(globalThis.__goeiFaultSteps)만 남긴 것. qc-static-risu 의 요청 처리기 실패 절만 쓴다 */
export const testBodyCode = readFileSync(new URL('../dist-test/goei-body.js', import.meta.url), 'utf8');
/** 세계 자료 팩 (개선 나1): 본체처럼 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우). 받기 시험은 noBody 쪽에서 */
export const worldPack = distWorldPack();

export function hostScript(char, chat, { body = bodyCode } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {}, api: {}, prefsSaves: 0 };
    const count = (k) => { window.__calls.api[k] = (window.__calls.api[k] || 0) + 1; };
    const wrap = (el) => el && ({
      _el: el,
      setAttribute: async (k, v) => { if (!k.startsWith('x-')) throw new Error('x- only'); el.setAttribute(k, v); },
      setInnerHTML: async (h) => { el.innerHTML = h; },
      getInnerHTML: async () => el.innerHTML,
      setTextContent: async (t) => { el.textContent = t; },
      setStyle: async (k, v) => { el.style[k] = v; },
      getStyle: async (k) => el.style[k],
      appendChild: async (c) => { el.appendChild(c._el); },
      querySelector: async (q) => { count('dom.querySelector'); return wrap(el.querySelector(q)); },
      querySelectorAll: async (q) => { const a = [...el.querySelectorAll(q)].map(wrap); return Object.assign(a, { length: async () => a.length, at: async (i) => a[i] }); },
      getBoundingClientRect: async () => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
      addEventListener: async (type, fn) => { const h = (e) => { const ev = { type: e.type, clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons }; setTimeout(() => fn(ev), 5); }; document.addEventListener(type, h); return String(Math.random()); },
      removeEventListener: async () => {},
      remove: async () => { el.remove(); },
      addClass: async (c) => { el.classList.add(c); },
      removeClass: async (c) => { el.classList.remove(c); },
      hasClass: async (c) => el.classList.contains(c),
      textContent: async () => el.textContent,
    });
    window.__store = { 'p:goei:body': ${JSON.stringify(body)}, 'p:goei:data-world': ${JSON.stringify(worldPack)} };
    window.__rootDoc = { querySelector: async (q) => { count('dom.querySelector'); return wrap(document.querySelector(q)); }, querySelectorAll: async (q) => { const a = [...document.querySelectorAll(q)].map(wrap); return Object.assign(a, { length: async () => a.length, at: async (i) => a[i] }); }, createElement: async (t) => wrap(document.createElement(t)) };
    window.__char = ${JSON.stringify(char)};
    window.__chats = [${JSON.stringify(chat)}];
    window.__chatIndex = 0;
    Object.defineProperty(window, '__chat', { get: () => window.__chats[window.__chatIndex], set: (v) => { window.__chats[window.__chatIndex] = v; } });
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.risuai = {
      registerButton: async (arg, cb) => ({ id: arg.id }),
      registerSetting: async () => ({ id: 's' }),
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async () => true,
      unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: { getItem: async (k) => { count('pluginStorage.getItem'); return window.__store['p:' + k] ?? null; }, setItem: async (k, v) => { count('pluginStorage.setItem'); if (k === 'goei:prefs') window.__calls.prefsSaves++; window.__store['p:' + k] = v; }, keys: async () => [], removeItem: async (k) => { delete window.__store['p:' + k]; } },
      addRisuReplacer: async (type, fn) => { window.__calls.replacers.push(fn); },
      removeRisuReplacer: async () => {},
      addRisuChatListener: async (mode, fn) => { window.__calls.listeners.push(fn); },
      removeRisuChatListener: async () => {},
      addRisuScriptHandler: async (mode, fn) => { window.__calls.handlers[mode] = fn; },
      removeRisuScriptHandler: async () => {},
      onUnload: async (fn) => { window.__unload = fn; },
      showContainer: async (m) => { window.__calls.show.push(m); const g = document.querySelector('.gx'); if (g) g.style.display = ''; },
      hideContainer: async () => { window.__calls.hide++; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; },
      getCurrentCharacterIndex: async () => { count('getCurrentCharacterIndex'); return 0; },
      getCurrentChatIndex: async () => { count('getCurrentChatIndex'); return window.__chatIndex; },
      getCharacterFromIndex: async () => { count('getCharacterFromIndex'); return clone(window.__char); },
      setCharacterToIndex: async (i, c) => { window.__char = clone(c); },
      getChatFromIndex: async (c, i) => { count('getChatFromIndex'); return clone(window.__chats[i] ?? null); },
      setChatToIndex: async (a, i, chat) => { window.__calls.setChat.push(clone(chat)); window.__chats[i] = clone(chat); },
      runLLMModel: async () => ({ type: 'fail', result: 'no mock' }),
      getCurrentLorebookEntries: async () => clone(window.__char.globalLore || []),
      getDatabase: async () => ({ modules: [], enabledModules: [] }),
      readImage: async () => { throw new Error('no asset'); },
      saveAsset: async () => 'assets/x.png',
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t).replace(/\\{\\{user\\}\\}/g, '유저'),
      nativeFetch: async () => ({ ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }),
    };`;
}

export async function launch() {
  const browser = await chromium.launch();
  process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
  return { browser };
}

/** 플러그인을 Risu 처럼(async 함수 안) 올린다. 돌려주는 bootMs 는 스크립트 주입부터 replacer 등록(본체 start() 끝)까지 */
export async function boot(browser, char, chat, viewport = { width: 1100, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%"></div></body></html>');
  await page.addScriptTag({ content: "document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);" });
  await page.addScriptTag({ content: hostScript(char, chat) });
  await page.addScriptTag({ content: `window.__t0 = performance.now(); (async () => { ${plugin}\n })().then(() => { window.__tBoot = performance.now() - window.__t0; }).catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
  assert.equal(await page.evaluate(() => window.__bootError ?? null), null);
  return { page, errors };
}

export async function open(page) {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  await page.click('[x-goei-fab] button');
  await page.waitForSelector('.gx-nb');
}
