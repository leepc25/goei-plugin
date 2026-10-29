// QC(설정 창·시작 화면·창 뼈대) 공용 틀: tests/browser.mjs 의 hostScript 를 복사·확장했다.
// - document 리스너 수·노드 수를 잴 수 있게 addEventListener 를 센다 (창 열기/닫기 누수 측정)
// - 세 뷰포트(PC 1100×900 · 폰 세로 390×844 · 폰 가로 844×390, hasTouch) 를 이름으로 고른다
// 사용: import { boot, openWin, VIEWPORTS, ... } from './qc-settings-harness.mjs'
import { createRequire } from 'node:module';
import { distPackFiles, distWorldPack } from './data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
export const { chromium } = require('playwright');

export const VIEWPORTS = {
  pc: { width: 1100, height: 900, touch: false },
  phone: { width: 390, height: 844, touch: true },
  land: { width: 844, height: 390, touch: true },
};

export function loadFixture(path) {
  const fixture = JSON.parse(readFileSync(path, 'utf8'));
  const manifest = JSON.parse(fixture.globalLore.find((e) => e.comment === 'Plugin manifest').content);
  return { fixture, manifest, fixtureDir: dirname(resolve(path)) };
}

const plugin = readFileSync(new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');
const bodyCode = readFileSync(new URL('../dist/goei-body.js', import.meta.url), 'utf8');
/** 세계 자료 팩 (개선 나1): 본체처럼 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우). 받기 시험은 noBody 쪽에서 */
const worldPack = distWorldPack();
/** 받기 흉내 기본값: 설치·점검 페이지가 받는 설치 자료 팩 (개선 나1). 시험이 window.__fetch 를 바꾸면 그쪽이 우선 */
const served = distPackFiles('goei-data-install');

/** 가짜 risuai (tests/browser.mjs hostScript 와 같음 + 리스너 세기) */
export function hostScript(char, chat, { rootDom = true, noBody = false, store = {} } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {}, setChar: 0 };
    // document 전체 리스너 수 (창 열기/닫기 누수 측정): 플러그인이 붙인 것만 센다
    window.__docListeners = 0;
    {
      const add = document.addEventListener.bind(document);
      const rem = document.removeEventListener.bind(document);
      document.addEventListener = (t, f, o) => { window.__docListeners++; return add(t, f, o); };
      document.removeEventListener = (t, f, o) => { window.__docListeners--; return rem(t, f, o); };
    }
    const listeners = new Map();
    const wrap = (el) => el && ({
      _el: el,
      setAttribute: async (k, v) => { if (!k.startsWith('x-')) throw new Error('x- only'); el.setAttribute(k, v); },
      setInnerHTML: async (h) => { el.innerHTML = h; },
      getInnerHTML: async () => el.innerHTML,
      setTextContent: async (t) => { el.textContent = t; },
      setStyle: async (k, v) => { el.style[k] = v; },
      getStyle: async (k) => el.style[k],
      appendChild: async (c) => { el.appendChild(c._el); },
      querySelector: async (q) => wrap(el.querySelector(q)),
      getBoundingClientRect: async () => { await new Promise((r) => setTimeout(r, 10)); const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
      addEventListener: async (type, fn) => { const id = String(Math.random()); const h = (e) => { const ev = { type: e.type, clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons }; setTimeout(() => fn(ev), 5); }; listeners.set(id, [type, h]); document.addEventListener(type, h); return id; },
      removeEventListener: async (type, id) => { await new Promise((r) => setTimeout(r, 30)); const l = listeners.get(id); if (l) { document.removeEventListener(l[0], l[1]); listeners.delete(id); } },
      remove: async () => { el.remove(); },
      addClass: async (c) => { el.classList.add(c); },
      removeClass: async (c) => { el.classList.remove(c); },
      hasClass: async (c) => el.classList.contains(c),
      textContent: async () => el.textContent,
    });
    // store: 미리 넣어 둘 저장소 항목 (새로 고침 뒤 기기 설정이 유지되는지 볼 때: { 'p:goei:prefs': … })
    window.__store = ${JSON.stringify(store)};
    if (!${noBody}) window.__store['p:goei:body'] = ${JSON.stringify(bodyCode)};
    if (!${noBody}) window.__store['p:goei:data-world'] = ${JSON.stringify(worldPack)};
    window.__files = ${JSON.stringify(served)};
    window.__fetch = (u) => window.__files[String(u).split('?')[0].split('/').pop()] ?? null;
    window.__rootDoc = ${rootDom} ? { querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => { const a = [...document.querySelectorAll(q)].map(wrap); return { length: async () => a.length, at: async (i) => a[i] }; }, createElement: async (t) => wrap(document.createElement(t)) } : null;
    window.__char = ${JSON.stringify(char)};
    window.__liteChar = window.__char;
    window.__chat = ${JSON.stringify(chat)};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.risuai = {
      registerButton: async (arg, cb) => { window.__button = { arg, cb }; return { id: arg.id }; },
      registerSetting: async (name, cb) => { window.__setting = cb; return { id: 's' }; },
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async (m) => { (window.__calls.send = window.__calls.send || []).push({ m, last: window.__chat.message?.at(-1)?.data }); if (window.__sendFail) throw new Error('Sending chat with plugin-based model is currently blocked'); return true; },
      unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: { getItem: async (k) => window.__store['p:' + k] ?? null, setItem: async (k, v) => { (window.__calls.setStore = window.__calls.setStore || []).push(k); window.__store['p:' + k] = v; }, keys: async () => Object.keys(window.__store).filter((k) => k.startsWith('p:')).map((k) => k.slice(2)), removeItem: async (k) => { delete window.__store['p:' + k]; } },
      addRisuReplacer: async (type, fn) => { window.__calls.replacers.push(fn); },
      removeRisuReplacer: async () => {},
      addRisuChatListener: async (mode, fn) => { window.__calls.listeners.push(fn); },
      removeRisuChatListener: async () => {},
      addRisuScriptHandler: async (mode, fn) => { window.__calls.handlers[mode] = fn; },
      removeRisuScriptHandler: async () => {},
      onUnload: async () => {},
      showContainer: async (m) => { window.__calls.show.push(m); const g = document.querySelector('.gx'); if (g) g.style.display = ''; },
      hideContainer: async () => { window.__calls.hide++; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; },
      getCurrentCharacterIndex: async () => 0,
      getCurrentChatIndex: async () => 0,
      getCharacterFromIndex: async () => clone(window.__char),
      setCharacterToIndex: async (i, c) => { window.__calls.setChar++; window.__char = clone(c); },
      getChatFromIndex: async () => clone(window.__chat),
      setChatToIndex: async (a, b, chat) => { window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async (o) => { window.__calls.llm = window.__calls.llm || []; window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 150)); const next = (window.__llm || []).shift(); return next ?? { type: 'fail', result: 'no mock' }; },
      getCurrentLorebookEntries: async () => clone([...(window.__char.globalLore || []), ...(window.__moduleLore || [])]),
      getDatabase: async () => ({ modules: window.__modules || [], enabledModules: (window.__modules || []).map((m) => m.id) }),
      readImage: async (p) => { (window.__calls.read = window.__calls.read || []).push(p); if (window.__assets[p]) return window.__assets[p]; const b64 = await window.__readAsset(p); if (!b64) throw new Error('no asset'); return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t).replace(/\\{\\{user\\}\\}/g, window.__userName ?? '{{user}}'),
      nativeFetch: async (url) => { (window.__calls.fetch = window.__calls.fetch || []).push(url); const r = window.__fetch && window.__fetch(String(url)); return r ? { ok: true, status: 200, json: async () => r, text: async () => typeof r === 'string' ? r : JSON.stringify(r), arrayBuffer: async () => (r instanceof Uint8Array ? r : new TextEncoder().encode(typeof r === 'string' ? r : JSON.stringify(r))).slice().buffer } : { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; },
    };
    window.__assets = {};`;
}

export async function launch() {
  const browser = await chromium.launch();
  process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
  process.on('uncaughtException', async (e) => { console.error('FAIL', e?.stack ?? e); await browser.close().catch(() => {}); process.exit(1); });
  return browser;
}

/** 플러그인을 띄운 페이지. vp: VIEWPORTS 키 또는 {width,height,touch} */
export async function boot(browser, { fixture, fixtureDir }, chat, vp = 'pc', opts = {}) {
  const v = typeof vp === 'string' ? VIEWPORTS[vp] : vp;
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, ...(v.touch ? { hasTouch: true, isMobile: true } : {}) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.exposeFunction('__readAsset', (p) => {
    try { return readFileSync(new URL(p, `file://${fixtureDir}/`)).toString('base64'); } catch { return null; }
  });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"><button id="other" style="margin:40px">다른 버튼</button></div></body></html>');
  await page.addScriptTag({ content: "document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);" });
  await page.addScriptTag({ content: hostScript(fixture, chat, opts) });
  await page.addScriptTag({ content: `(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
  const bootError = await page.evaluate(() => window.__bootError ?? null);
  if (bootError) throw new Error(`boot: ${bootError}`);
  return { page, errors, vp: v };
}

/** 창 열기: 등록된 버튼(registerButton)으로 바로 연다 (플로팅 버튼 효과를 기다리지 않는다) */
export async function openWin(page) {
  await page.waitForFunction(() => !!window.__button);
  await page.evaluate(() => window.__button.cb());
  await page.waitForFunction(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none' && !g.querySelector('.gx-empty')?.textContent?.includes('읽는 중'); });
}

export const prefsOf = (page) => page.evaluate(() => JSON.parse(window.__store['p:goei:prefs'] || '{}'));
export const chatOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__chat)));
/** 채팅을 바꿔 끼우고 창을 닫는다 (다음 openWin 이 새로 읽게) */
export async function setChat(page, chat) {
  await page.evaluate((c) => { window.__chat = c; window.__calls.setChat = []; }, chat);
}
export async function closeWin(page) {
  const open = await page.evaluate(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none'; });
  if (open) {
    await page.evaluate(() => document.querySelector('.gx-head [data-action="close"], .gx [data-action="close"]')?.click());
    await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
  }
}

/** 편집 창 열기 (시작 전: prefs-open, 시작 뒤: ed-open) → 노드 */
export const tabOfNode = (n) => (n.startsWith('guide:') || n.startsWith('rule:') ? 'guide' : n === 'install' || n === 'set:update' || n.startsWith('manage:') ? 'manage' : n.startsWith('set:') ? 'set' : 'world');
export async function goNode(page, n) {
  await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tabOfNode(n));
  await page.waitForFunction((n) => !!document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`), n);
  await page.evaluate((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`).click(), n);
  await page.waitForFunction((n) => document.querySelector(`.gw .gw-tree-item.on`)?.dataset.value === n, n);
}
export async function openEditor(page, node = 'set:screen') {
  const picker = await page.$('.gx [data-action="prefs-open"]');
  if (picker) await page.evaluate(() => document.querySelector('.gx [data-action="prefs-open"]').click());
  else await page.evaluate(() => document.querySelector('.gx [data-action="ed-open"]').click());
  await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
  await goNode(page, node);
}
export async function closeEditor(page, force = false) {
  await page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]').click());
  if (force) {
    const c = await page.$('.gw [data-action="ed-close-force"]');
    if (c) await page.evaluate(() => document.querySelector('.gw [data-action="ed-close-force"]').click());
  }
  await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
}

/** 클릭을 DOM 에서 직접 (겹친 요소·스크롤 밖 요소도 누른다) */
export async function clickSel(page, sel) {
  const ok = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
  if (!ok) throw new Error(`no element: ${sel}`);
}
export async function setInput(page, sel, value, ev = 'change') {
  const ok = await page.evaluate(([s, v, e]) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.value = v;
    el.dispatchEvent(new Event(e, { bubbles: true }));
    return true;
  }, [sel, value, ev]);
  if (!ok) throw new Error(`no input: ${sel}`);
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 접근성·넘침 점검: 글자 없는 단추, 가로 넘침 */
export async function auditDom(page, rootSel, ignore = '') {
  return page.evaluate(([rootSel, ignore]) => {
    const root = document.querySelector(rootSel);
    if (!root) return { missing: ['(no root)'], overflow: [], scrollW: 0 };
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const missing = [...root.querySelectorAll('button')].filter((b) => vis(b) && !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title') && !b.querySelector('img[alt]:not([alt=""])')).map((b) => b.outerHTML.slice(0, 120));
    const W = window.innerWidth;
    const overflow = [...root.querySelectorAll('*')].filter((el) => {
      if (!vis(el)) return false;
      if (ignore && el.closest(ignore)) return false; // 일부러 화면 밖에 둔 것(쓸기 닫기 손잡이 등)과 그 안쪽
      const r = el.getBoundingClientRect();
      return r.right > W + 1 || r.left < -1;
    }).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { missing, overflow, scrollW: document.documentElement.scrollWidth };
  }, [rootSel, ignore]);
}
