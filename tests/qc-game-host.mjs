// QC 공용 틀 (게임 영역): 가짜 Risu 환경(tests/browser.mjs hostScript 사본)에 플러그인을 올리고, 진행 중인 괴이 채팅을 심어
// 플러그인 창 → 필드 탭(게임)까지 간다. 게임 파일(코드·팩)은 dist/game/ 을 window.__fetch 로 준다.
// 사용: import { boot, openPanel, gameFiles, serveGame, startedChat } from './qc-game-host.mjs'
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
export const { chromium } = require('playwright');

export const DIST = new URL('../dist/', import.meta.url);
export const plugin = readFileSync(process.env.PLUGIN || new URL('goei-plugin.js', DIST), 'utf8');
export const bodyCode = readFileSync(new URL('goei-body.js', DIST), 'utf8');
export const VERSION = /\/\/ goei-body (\S+)/.exec(bodyCode)?.[1] ?? JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export function loadFixture(path) {
  const fixture = JSON.parse(readFileSync(path, 'utf8'));
  return { fixture, fixtureDir: dirname(resolve(path)) };
}

/** 가짜 Risu API (tests/browser.mjs hostScript 와 같다). SafeElement 흉내·pluginStorage·setChatToIndex 기록·runLLMModel 큐·nativeFetch(window.__fetch) */
export function hostScript(char, chat, { rootDom = true, noBody = false } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {} };
    const listeners = new Map();
    const wrap = (el) => el && ({
      _el: el,
      setAttribute: async (k, v) => { if (!k.startsWith('x-')) throw new Error('x- only'); el.setAttribute(k, v); },
      setInnerHTML: async (h) => { el.innerHTML = h; },
      getInnerHTML: async () => el.innerHTML,
      setTextContent: async (t) => { el.textContent = t; },
      setStyle: async (k, v) => { el.style[k] = v; },
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
    window.__store = {};
    if (!${noBody}) window.__store['p:goei:body'] = ${JSON.stringify(bodyCode)};
    window.__rootDoc = ${rootDom} ? { querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)) } : null;
    window.__char = ${JSON.stringify(char)};
    window.__liteChar = window.__char;
    window.__chat = ${JSON.stringify(chat)};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.__storeFail = null; // 'get' | 'set' 이면 pluginStorage 가 그 호출에서 던진다 (저장소 고장 흉내)
    window.risuai = {
      registerButton: async (arg, cb) => { window.__button = { arg, cb }; return { id: arg.id }; },
      registerSetting: async (name, cb) => { window.__setting = cb; return { id: 's' }; },
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async (m) => { (window.__calls.send = window.__calls.send || []).push({ m, last: window.__chat.message?.at(-1)?.data }); if (window.__sendFail) throw new Error('Sending chat with plugin-based model is currently blocked'); return true; },
      unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: {
        getItem: async (k) => { if (window.__storeFail === 'get') throw new Error('storage down'); return window.__store['p:' + k] ?? null; },
        setItem: async (k, v) => { if (window.__storeFail === 'set') throw new Error('storage down'); window.__store['p:' + k] = v; },
        keys: async () => Object.keys(window.__store).filter((k) => k.startsWith('p:')).map((k) => k.slice(2)),
        removeItem: async (k) => { delete window.__store['p:' + k]; },
      },
      addRisuReplacer: async (type, fn) => { window.__calls.replacers.push(fn); },
      removeRisuReplacer: async () => {},
      addRisuChatListener: async (mode, fn) => { window.__calls.listeners.push(fn); },
      removeRisuChatListener: async () => {},
      addRisuScriptHandler: async (mode, fn) => { window.__calls.handlers[mode] = fn; },
      removeRisuScriptHandler: async () => {},
      onUnload: async () => {},
      showContainer: async (m) => { window.__calls.show.push(m); const g = document.querySelector('.gx'); if (g) g.style.display = ''; },
      hideContainer: async () => { window.__calls.hide++; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; },
      getCurrentCharacterIndex: async () => window.__charIndex ?? 0,
      getCurrentChatIndex: async () => window.__chatIndex ?? 0,
      getCharacterFromIndex: async () => clone(window.__char),
      setCharacterToIndex: async (i, c) => { window.__calls.setChar = (window.__calls.setChar || 0) + 1; window.__char = clone(c); },
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

/** 진행 중인 채팅 (시작 선택 뒤 봇이 한 번 답한 상태): 상황판 태그가 있는 봇 응답 하나 */
export function startedChat(extra = {}) {
  const reply = ['본문', '[AN|서울 종로구|젖은 복도|활성|A|P001]', '[AG|P001|작전투입|현장]', '[AG|P002|휴게|사무실]', '[AG|P003|휴게|휴게실]', '[▣|2025.01.01|10:20 AM|☀️|4°C|관리국 본부|없음]'].join('\n');
  return {
    id: 'chat-qc-1',
    message: [{ role: 'user', data: '시작', chatId: 'm1' }, { role: 'char', data: reply, chatId: 'm2' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: 1, $ph_auto: '0', ...extra },
  };
}

/** dist/game/ 파일 이름 → 바이트(base64) */
export function gameFiles() {
  const gdir = new URL('game/', DIST);
  return Object.fromEntries(readdirSync(gdir).map((n) => [n, readFileSync(new URL(n, gdir)).toString('base64')]));
}

/** 페이지의 window.__fetch 가 dist/game/ 을 주게 한다 (fail 에 이름 정규식을 주면 그 파일은 404) */
export async function serveGame(page, files, { fail = null, delayMs = 0 } = {}) {
  await page.evaluate(({ files, fail, delayMs }) => {
    const bytes = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Uint8Array.from(atob(v), (c) => c.charCodeAt(0))]));
    window.__gameBytes = bytes;
    window.__fetchFail = fail ? new RegExp(fail) : null;
    window.__fetch = (u) => {
      const name = u.split('?')[0].split('/').pop();
      if (window.__fetchFail && window.__fetchFail.test(name)) return null;
      return bytes[name] ?? null;
    };
    void delayMs;
  }, { files, fail, delayMs });
}

export async function boot(browser, char, chat, { viewport = { width: 1100, height: 900 }, touch = false, fixtureDir = '.', opts = {} } = {}) {
  const page = await browser.newPage({ viewport, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.exposeFunction('__readAsset', (p) => {
    try { return readFileSync(new URL(p, `file://${fixtureDir}/`)).toString('base64'); } catch { return null; }
  });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"><button id="other" style="margin:40px">다른 버튼</button></div></body></html>');
  await page.addScriptTag({ content: "document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);" });
  await page.addScriptTag({ content: hostScript(char, chat, opts) });
  await page.addScriptTag({ content: `(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
  assert.equal(await page.evaluate(() => window.__bootError ?? null), null);
  return { page, errors };
}

/** 플로팅 버튼 → 창 열기 */
export async function openPanel(page) {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  await page.click('[x-goei-fab] button');
  await page.waitForSelector('.gx-head');
}

/** 필드 탭(게임 시작 화면)까지 */
export async function openField(page) {
  // PC 는 왼쪽 메뉴 줄(nav-tab), 폰은 머리의 필드 단추(tab): 보이는 쪽을 누른다
  const btn = page.locator('[data-value="field"]:visible').first();
  await btn.click();
  await page.waitForSelector('.gx-game .gx-gl');
}

/** 시작 화면 「들어가기」 → 엔진 캔버스 */
export async function enterGame(page) {
  await page.waitForSelector('.gx-gl [data-g="play"]:not([disabled])');
  await page.click('.gx-gl [data-g="play"]');
  await page.waitForSelector('.gx-game-box .goei-engine canvas', { timeout: 20000 });
  await page.waitForFunction(() => !!window.__goeiEngine, null, { timeout: 20000 });
}

/** 제목 화면 → 필드 입장 → 본부 (field-harness.enterHub 와 같다) */
export async function enterHub(page) {
  await page.waitForFunction(() => window.__goeiEngine);
  for (let i = 0; i < 80 && !(await page.evaluate(() => !!window.__goeiEngine?.inHub && !!window.__goeiEngine.world)); i++) {
    const btn = page.locator('.gx-game button:visible', { hasText: /필드 입장|새로 시작|들어가기|계속|확인|닫기/ }).first();
    if (await btn.count()) await btn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1200);
}
