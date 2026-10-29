// QC(2026-10-28) 시작기 · 본체 로딩 · 설치 · 업데이트 · 저장소. 모든 경우를 Risu 플러그인 칸과 같은 격리(iframe sandbox + nonce CSP,
// eval·blob 막힘) 안에서 돌린다. 가짜 risuai 는 tests/browser.mjs hostScript 를 복사해 넓혔다(캐릭터 여럿·현재 캐릭터 바꾸기·
// 저장 실패 주입·받기 주입·언로드·버튼 id 별 기록).
// 사용법: node tests/qc-loader-browser.mjs <fixture.json>   (fixture 는 tests/make_fixture.py 로 경량 카드에서)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { distPackFiles, distWorldPack } from './data-init.mjs';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const pkg = JSON.parse(read('package.json'));
const VERSION = pkg.version;
const plugin = read('dist/goei-plugin.js');
const bodyCode = read('dist/goei-body.js');
/** 옛 시작기: 사용자 기기에 이미 깔린 release/goei-plugin.js (본체 조각만 받는다). 새 본체는 세계 자료를 스스로 받아야 이 시작기로도 돈다 (개선 나1).
 *  판 글자만 지금 판으로 맞춘다 (시작기는 자기 판의 본체만 받고 실행하므로) */
const oldLoader = (() => { const t = read('release/goei-plugin.js'); const v = /^\/\/@version (\S+)/m.exec(t)?.[1]; return v && v !== VERSION ? t.split(v).join(VERSION) : t; })();
/** 세계 자료 팩 글 (본체에 박힌 지문과 같은 것). 본체가 있으면 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우) */
const worldPack = distWorldPack();
const manifest = JSON.parse(fixture.globalLore.find((e) => e.comment === 'Plugin manifest').content);

// release 폴더 모양의 파일 묶음 (이름 → 글 또는 {b64})
const files = {};
{
  const bodyIndex = JSON.parse(read('dist/goei-body.json'));
  files['goei-body.json'] = JSON.stringify(bodyIndex);
  for (const n of bodyIndex.parts) files[n] = read(`dist/${n}`);
  const tok = JSON.parse(read('dist/tok-o200k.json'));
  files['tok-o200k.json'] = JSON.stringify(tok);
  for (const n of tok.parts) files[n] = read(`dist/${n}`);
  const wiki = JSON.parse(read('release/wiki-base.json'));
  files['wiki-base.json'] = JSON.stringify(wiki);
  for (const n of wiki.parts) files[n] = read(`release/${n}`);
  files['icon.png'] = { b64: readFileSync(new URL('release/icon.png', root)).toString('base64') };
  const upd = JSON.parse(read('release/card-update.json'));
  files['card-update.json'] = JSON.stringify(upd);
  for (const n of upd.parts) files[n] = read(`release/${n}`);
  files['version.json'] = read('release/version.json');
  // 자료 팩 (개선 나1): 세계 자료는 본체가 뜰 때, 설치 자료는 설치·점검 화면이 받는다
  Object.assign(files, distPackFiles('goei-data-world'), distPackFiles('goei-data-install'));
}
const bodyIndex = JSON.parse(files['goei-body.json']);
const worldIndex = JSON.parse(files['goei-data-world.json']);
const installIndex = JSON.parse(files['goei-data-install.json']);
/** src/loader/body.ts bodyHash 와 같은 식 (sha256 만 어긋난 목록을 만들 때) */
const fnv = (text) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0; return h.toString(16).padStart(8, '0'); };
/** 글자 하나를 바꾼 조각(길이 같음)과, 그 깨진 본체에 맞춘 hash 를 가진 목록 (sha256 은 원본 그대로 → sha256 확인만 걸린다) */
const corruptPart = (name) => files[name].slice(0, 100) + '#' + files[name].slice(101);
const corruptedBodyHash = (name) => fnv(bodyIndex.parts.map((n) => (n === name ? corruptPart(name) : files[n])).join(''));

const otherBot = { name: '다른 봇', alternateGreetings: ['안녕'], globalLore: [{ comment: '내 로어', content: '글', key: 'x', mode: 'normal' }], additionalAssets: [] };
const emptyBot = { name: '깡통봇', alternateGreetings: ['안녕'], globalLore: [], additionalAssets: [], image: 'assets/old-icon.png' };
const emptyChat = () => ({ message: [], scriptstate: {} });

/** serve: 처음부터 받기 흉내에 둘 파일 이름 (시작기가 뜨자마자 받으므로 boot 뒤에 넣으면 늦다). storeFail: setItem 이 실패할 키(정규식 글) */
/** eventsOn: SafeElement.addEventListener 가 걸리는 곳. 'element' = 2026-10 Risu(요소 자신), 'document' = 옛 Risu(문서 전체) */
/** data: body 를 미리 둘 때 세계 자료 팩도 같이 둔다(기본). false 면 본체는 있고 자료는 없는 저장소 (본체가 자료만 받는 경우) */
function hostScript(chars, charIndex, chat, { rootDom = true, body = null, store = {}, risuFetch = false, serve = [], storeFail = '', eventsOn = 'element', data = true } = {}) {
  const served = Object.fromEntries(serve.map((n) => [n, files[n]]));
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {}, removed: [], idx: 0, fetch: [], risuFetch: [] };
    const listeners = new Map();
    window.__eventsOn = ${JSON.stringify(eventsOn)};
    const attach = (target, type, fn) => { const id = String(Math.random()); const h = (e) => { const ev = { type: e.type, clientX: e.clientX, clientY: e.clientY, button: e.button, buttons: e.buttons }; setTimeout(() => fn(ev), 5); }; listeners.set(id, [target, type, h]); target.addEventListener(type, h); return id; };
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
      querySelectorAll: async (q) => { const a = [...el.querySelectorAll(q)].map(wrap); a.length = async () => a.length; return a; },
      getBoundingClientRect: async () => { await new Promise((r) => setTimeout(r, 10)); const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
      addEventListener: async (type, fn) => attach(window.__eventsOn === 'element' ? el : document, type, fn),
      removeEventListener: async (type, id) => { await new Promise((r) => setTimeout(r, 30)); const l = listeners.get(id); if (l) { l[0].removeEventListener(l[1], l[2]); listeners.delete(id); } },
      remove: async () => { el.remove(); },
      addClass: async (c) => { el.classList.add(c); },
      removeClass: async (c) => { el.classList.remove(c); },
      hasClass: async (c) => el.classList.contains(c),
      textContent: async () => el.textContent,
    });
    window.__store = ${JSON.stringify(store)};
    ${body ? `window.__store['p:goei:body'] = ${JSON.stringify(body)};` : ''}
    ${body && data ? `window.__store['p:goei:data-world'] = ${JSON.stringify(worldPack)};` : ''}
    // SafeDocument: 리스너는 늘 문서(Document)에 걸린다 (Risu v3.svelte.ts SafeDocument 생성자)
    window.__rootDoc = ${rootDom} ? { ...wrap(document.documentElement), querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)), addEventListener: async (type, fn) => attach(document, type, fn) } : null;
    window.__chars = ${JSON.stringify(chars)};
    window.__charIndex = ${charIndex};
    Object.defineProperty(window, '__char', { get: () => window.__chars[window.__charIndex], set: (v) => { window.__chars[window.__charIndex] = v; } });
    window.__chat = ${JSON.stringify(chat)};
    window.__buttons = {};
    window.__storeFail = ${storeFail ? `new RegExp(${JSON.stringify(storeFail)})` : 'null'};
    window.__fetchHook = null;
    window.__files = Object.fromEntries(Object.entries(${JSON.stringify(served)}).map(([k, v]) => [k, v && v.b64 ? Uint8Array.from(atob(v.b64), (c) => c.charCodeAt(0)) : v]));
    window.__fetch = (u) => { const name = u.split('?')[0].split('/').pop(); if (window.__fetchHook) { const r = window.__fetchHook(name, u); if (r !== undefined) return r; } return window.__files[name] ?? null; };
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const toBytes = (r) => r instanceof Uint8Array ? r : new TextEncoder().encode(typeof r === 'string' ? r : JSON.stringify(r));
    window.risuai = {
      registerButton: async (arg, cb) => { window.__buttons[arg.id || arg.name] = { arg, cb }; window.__button = { arg, cb }; return { id: arg.id }; },
      unregisterUIPart: async (id) => { delete window.__buttons[id]; },
      registerSetting: async (name, cb) => { window.__setting = cb; return { id: 's' }; },
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async (m) => { (window.__calls.send = window.__calls.send || []).push({ m }); return true; },
      unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: {
        getItem: async (k) => window.__store['p:' + k] ?? null,
        setItem: async (k, v) => { if (window.__storeFail && window.__storeFail.test(k)) throw new Error('QuotaExceededError: Failed to write plugin storage item "' + k + '"'); window.__store['p:' + k] = v; },
        keys: async () => Object.keys(window.__store).filter((k) => k.startsWith('p:')).map((k) => k.slice(2)),
        removeItem: async (k) => { delete window.__store['p:' + k]; },
      },
      addRisuReplacer: async (type, fn) => { window.__calls.replacers.push(fn); },
      removeRisuReplacer: async (type) => { window.__calls.removed.push('replacer:' + type); },
      addRisuChatListener: async (mode, fn) => { window.__calls.listeners.push(fn); },
      removeRisuChatListener: async (mode) => { window.__calls.removed.push('listener:' + mode); },
      addRisuScriptHandler: async (mode, fn) => { window.__calls.handlers[mode] = fn; },
      removeRisuScriptHandler: async (mode) => { window.__calls.removed.push('handler:' + mode); },
      onUnload: async (cb) => { window.__unload = cb; },
      showContainer: async (m) => { window.__calls.show.push(m); const g = document.querySelector('.gx'); if (g) g.style.display = ''; },
      hideContainer: async () => { window.__calls.hide++; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; },
      getCurrentCharacterIndex: async () => { window.__calls.idx++; return window.__charIndex; },
      getCurrentChatIndex: async () => 0,
      getCharacterFromIndex: async (i) => (window.__chars[i] ? clone(window.__chars[i]) : null),
      setCharacterToIndex: async (i, c) => { window.__calls.setChar = (window.__calls.setChar || 0) + 1; window.__chars[i] = clone(c); },
      getChatFromIndex: async () => clone(window.__chat),
      setChatToIndex: async (a, b, chat) => { window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async (o) => ({ type: 'fail', result: 'no mock' }),
      getCurrentLorebookEntries: async () => clone(window.__char.globalLore || []),
      getDatabase: async () => ({ modules: [], enabledModules: [] }),
      readImage: async (p) => { if (window.__assets[p]) return window.__assets[p]; throw new Error('no asset'); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t),
      nativeFetch: async (url) => { window.__calls.fetch.push(String(url)); const r = await (window.__fetch && window.__fetch(String(url))); return r ? { ok: true, status: 200, json: async () => r, text: async () => typeof r === 'string' ? r : JSON.stringify(r), arrayBuffer: async () => toBytes(r).slice().buffer } : { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; },
    };
    ${risuFetch ? `window.risuai.risuFetch = async (url, arg) => { window.__calls.risuFetch.push(String(url)); const r = await (window.__fetch && window.__fetch(String(url))); return r ? { ok: true, status: 200, data: toBytes(r) } : { ok: false, status: 404, data: null }; };` : ''}
    window.__assets = {};`;
}

const browser = await chromium.launch();
// 바깥 문서는 http://127.0.0.1 에서 연다: about:blank 안의 sandbox srcdoc 은 보안 컨텍스트가 아니라 crypto.subtle 이 없다.
// 실제 Risu(https·tauri)의 플러그인 칸은 보안 컨텍스트라 사진 지문(sha1) 확인이 돈다 (host/picpack.ts digest)
const outer = '<!doctype html><html><body style="margin:0"><iframe style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>';
const server = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(outer); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const outerUrl = `http://127.0.0.1:${server.address().port}/`;
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); server.close(); process.exit(1); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// QC_FROM=n 이면 n번 절부터 (고칠 때 빨리 돌리려고)
const from = Number(process.env.QC_FROM || 1);
let scene = 0;
const skip = () => ++scene < from;

/** Risu src/ts/plugins/apiV3/factory.ts 와 같은 격리: sandbox iframe + nonce CSP. 플러그인은 srcdoc 안에서 바로 돈다 */
/** opts.insecure: 바깥 문서를 about:blank 로 (sandbox srcdoc 이 보안 컨텍스트가 아니라 crypto.subtle 이 없는 환경 흉내). opts.loader: 시작기 글 (기본 dist, 'old' 면 release 의 옛 시작기) */
async function boot(chars, charIndex, chat, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  const nonce = 'n' + Math.random().toString(36).slice(2);
  const csp = `connect-src 'none'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; frame-src 'none'; object-src 'none'; style-src * 'unsafe-inline'; default-src 'none'; img-src * data: blob:; font-src * data: blob:; media-src * data: blob:; base-uri 'none';`;
  const loader = opts.loader === 'old' ? oldLoader : plugin;
  const inner = (hostScript(chars, charIndex, chat, opts) + `\n(async () => { ${loader}\n })().catch(e => { window.__bootError = String(e); });`).replace(/<\/script/gi, '<\\/script');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}" id="csp-meta"></head>`
    + `<body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"></div>`
    + `<script nonce="${nonce}">document.querySelector('meta#csp-meta')?.remove();\n${inner}</script></body></html>`;
  if (opts.insecure) await page.setContent(outer);
  else await page.goto(outerUrl);
  await page.evaluate(({ html, csp }) => {
    const f = document.querySelector('iframe');
    f.sandbox.add('allow-scripts');
    f.sandbox.add('allow-modals');
    f.setAttribute('csp', csp);
    f.srcdoc = html;
  }, { html, csp });
  let frame = null;
  for (let i = 0; i < 100 && !frame; i++) {
    frame = page.frames().find((f) => f !== page.mainFrame());
    if (!frame) await page.waitForTimeout(100);
  }
  await frame.waitForFunction(() => window.__calls?.replacers.length || window.__bootError);
  assert.equal(await frame.evaluate(() => window.__bootError ?? null), null);
  return { page, frame, errors, logs };
}
/** release 파일을 받기 흉내에 넣는다 (이름 목록을 주면 그것만) */
async function serve(frame, names = Object.keys(files)) {
  const sub = Object.fromEntries(names.map((n) => [n, files[n]]));
  await frame.evaluate((f) => {
    window.__files = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v && v.b64 ? Uint8Array.from(atob(v.b64), (c) => c.charCodeAt(0)) : v]));
  }, sub);
}
const fab = (frame) => frame.evaluate(() => document.querySelector('[x-goei-fab]')?.style.display ?? 'none');
const waitFab = (frame, display = 'block', timeout = 8000) => frame.waitForFunction((d) => (document.querySelector('[x-goei-fab]')?.style.display ?? 'none') === d, display, { timeout });
const panelMsg = (frame) => frame.evaluate(() => document.querySelector('.gl-msg')?.textContent ?? null);
const fetched = (frame) => frame.evaluate(() => window.__calls.fetch.map((u) => u.split('?')[0].split('/').pop()));
const bodyFiles = ['goei-body.json', ...bodyIndex.parts];
const worldFiles = ['goei-data-world.json', ...worldIndex.parts];
const installFiles = ['goei-data-install.json', ...installIndex.parts];
/** 본체가 처음 뜨는 데 필요한 것: 본체 조각 + 세계 자료 팩 (본체가 뜨면서 받는다) */
const startFiles = [...bodyFiles, ...worldFiles];
const storedWorld = (frame) => frame.evaluate(() => window.__store['p:goei:data-world'] ?? null);
const ok = (t) => console.log(`PASS ${t}`);
const closeOf = async (page, errors, allow = []) => {
  const bad = errors.filter((e) => !allow.some((a) => e.includes(a)));
  assert.deepEqual(bad, [], '페이지 오류 없음');
  await page.close();
};

// ── 1) 받기 성공: 본체 없음 → 괴이 카드를 보면 조각으로 받아 저장·실행, 받기 창 없이 플로팅 버튼. 받은 뒤 그려진 채팅은 다시 저장(redrawAfterLoad)
if (!skip()) {
  const chat = { message: [{ role: 'char', data: '안녕 <img=Jyaldi_default>' }], scriptstate: {} };
  const { page, frame, errors } = await boot([fixture], 0, chat, { serve: startFiles });
  await waitFab(frame);
  assert.equal(await frame.locator('.gl-card').count(), 0, '받기 창 없음');
  assert.deepEqual(await fetched(frame), startFiles, '본체 목록 + 조각, 이어서 세계 자료 목록 + 조각을 한 번씩 (본체가 뜨면서 자료를 받는다)');
  assert.match(await frame.evaluate(() => window.__store['p:goei:body'].slice(0, 30)), /^\/\/ goei-body /, '본체 저장');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'].length), bodyCode.length);
  assert.equal((await storedWorld(frame))?.length ?? 0, worldPack.length, '세계 자료 팩 저장 (goei:data-world)');
  await frame.waitForFunction(() => window.__calls.setChat.length >= 1, null, { timeout: 5000 });
  assert.equal(await frame.evaluate(() => window.__calls.setChat.length), 1, '이미지 태그가 있는 괴이 채팅을 한 번 다시 저장');
  assert.match(await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">ANOMALY SIMULATION</div>')), /landing/, '시작 카드 표시는 본체가');
  // 시작기 감시가 멈추고 본체 감시만 돈다 (1초마다 getCurrentCharacterIndex 한 번)
  const a = await frame.evaluate(() => window.__calls.idx);
  await sleep(2200);
  const b = await frame.evaluate(() => window.__calls.idx);
  assert.ok(b - a >= 2 && b - a <= 4, `감시 1초 간격 (${b - a}번)`);
  await closeOf(page, errors);
  ok('시작기 받기 성공: 본체 조각 → 저장 → 실행 → 세계 자료 팩 받아 저장 → 플로팅 버튼, 채팅 다시 그리기');
}

// ── 2) 받기 실패(404) → 받기 창. 1분 재시도 억제. 다시 받기: 조각 하나 깨짐 · 판 불일치 · 길이 불일치 · 지문 불일치 · 성공
if (!skip()) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat());
  await frame.waitForSelector('.gl-card', { timeout: 8000 });
  assert.deepEqual(await fetched(frame), ['goei-body.json'], '목록에서 바로 실패');
  assert.deepEqual(await frame.evaluate(() => window.__calls.show), ['fullscreen'], '창을 띄움');
  assert.equal(await fab(frame), 'none', '버튼 없음');
  // 1분 안에는 메시지 표시·요청 때 다시 받으려 하지 않는다
  const before = (await fetched(frame)).length;
  const shown = await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">ANOMALY SIMULATION</div>'));
  assert.match(shown, /data-goei="landing"/, '본체 없으면 원문 그대로');
  await frame.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '%%SEED%% hi' }], 'model'));
  await sleep(300);
  assert.equal((await fetched(frame)).length, before, '1분 재시도 억제');
  // 1분이 지나면 조용히 다시 받아 본다 (받기 창은 이미 떠 있으니 새로 띄우지 않음)
  await frame.evaluate(() => { const real = Date.now; window.__realNow = real; Date.now = () => real() + 61_000; });
  await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">x</div>'));
  await sleep(300);
  assert.equal((await fetched(frame)).length, before + 1, '1분 뒤 다시 시도');
  assert.equal(await frame.locator('.gl-card').count(), 1, '창은 하나');
  const retry = async () => {
    await frame.evaluate(() => { document.querySelector('.gl-msg').textContent = ''; });
    await frame.click('[data-gl="get"]');
    await frame.waitForFunction(() => { const m = document.querySelector('.gl-msg'); return m && !m.hidden && m.textContent && m.textContent !== '받는 중'; }, null, { timeout: 15000 });
    return panelMsg(frame);
  };
  // 조각 하나 깨짐(404)
  await serve(frame, startFiles.filter((n) => n !== 'goei-body.3.txt'));
  assert.match(await retry(), /받지 못했어요 \(404\)/, '조각 404');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'] ?? null), null, '깨진 본체는 저장 안 함');
  // 판 불일치 (아직 안 올라온 판)
  await serve(frame, startFiles);
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-body.json' ? JSON.stringify({ ...JSON.parse(window.__files[n]), version: '0.0.1' }) : undefined); });
  assert.match(await retry(), /아직 이 판의 본체가/, '판 불일치');
  // 길이 불일치 (조각이 잘림)
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-body.2.txt' ? window.__files[n].slice(0, -10) : undefined); });
  assert.match(await retry(), /끝까지 받지 못했어요/, '길이 불일치');
  // 지문 불일치 (길이는 같은데 글자가 바뀐 조각). 플러그인 칸은 보안 컨텍스트라 sha256 으로 잡는다
  assert.ok(await frame.evaluate(() => window.isSecureContext && !!crypto.subtle), '플러그인 칸이 보안 컨텍스트');
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-body.5.txt' ? window.__files[n].slice(0, 100) + '#' + window.__files[n].slice(101) : undefined); });
  assert.match(await retry(), /깨져 있어요\(sha256\)/, '지문 불일치 → sha256 에서 걸림');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'] ?? null), null);
  // sha256 불일치만 (개선 나2): 목록의 hash 를 깨진 본체에 맞춰 두어 hash 로는 못 잡는 경우도 sha256 이 잡는다
  await frame.evaluate(({ hash }) => { window.__fetchHook = (n) => (n === 'goei-body.json' ? JSON.stringify({ ...JSON.parse(window.__files[n]), hash }) : n === 'goei-body.5.txt' ? window.__files[n].slice(0, 100) + '#' + window.__files[n].slice(101) : undefined); }, { hash: corruptedBodyHash('goei-body.5.txt') });
  assert.match(await retry(), /깨져 있어요\(sha256\)/, 'sha256 불일치 → 다시 받기');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'] ?? null), null, '깨진 본체는 저장 안 함');
  // sha256 이 없는 목록(hash 만, 0.17.9 개발 중 모양)이면 hash 로 잡는다
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-body.json' ? JSON.stringify({ ...JSON.parse(window.__files[n]), sha256: undefined }) : n === 'goei-body.5.txt' ? window.__files[n].slice(0, 100) + '#' + window.__files[n].slice(101) : undefined); });
  assert.match(await retry(), /깨져 있어요\(hash\)/, 'sha256 없는 목록은 hash 로');
  // 성공: 옛 release 목록(hash·sha256 둘 다 없음)도 길이·판만 보고 그대로 통과 (호환)
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-body.json' ? JSON.stringify({ ...JSON.parse(window.__files[n]), hash: undefined, sha256: undefined }) : undefined); });
  await frame.click('[data-gl="get"]');
  await waitFab(frame);
  assert.equal(await frame.locator('.gl-card').count(), 0, '받으면 창이 닫힘');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'].length), bodyCode.length);
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.gx-fac');
  await closeOf(page, errors);
  ok('시작기 받기 실패: 받기 창 · 1분 억제 · 조각 404 · 판 불일치 · 길이 불일치 · 지문 불일치(sha256·sha256만·hash) · 옛 목록 호환 · 다시 받기 성공');
}

// ── 2-1) 보안 컨텍스트가 아닌 환경(about:blank 안 sandbox srcdoc, crypto.subtle 없음): sha256 을 못 내니 hash 로 확인하고, 맞으면 받는다
if (!skip()) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat(), { insecure: true });
  await frame.waitForSelector('.gl-card', { timeout: 8000 });
  assert.equal(await frame.evaluate(() => !window.isSecureContext && !(globalThis.crypto && crypto.subtle)), true, 'crypto.subtle 이 없는 환경');
  const retry = async () => {
    await frame.evaluate(() => { document.querySelector('.gl-msg').textContent = ''; });
    await frame.click('[data-gl="get"]');
    await frame.waitForFunction(() => { const m = document.querySelector('.gl-msg'); return m && !m.hidden && m.textContent && m.textContent !== '받는 중'; }, null, { timeout: 15000 });
    return panelMsg(frame);
  };
  await serve(frame, startFiles);
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-body.5.txt' ? window.__files[n].slice(0, 100) + '#' + window.__files[n].slice(101) : undefined); });
  assert.match(await retry(), /깨져 있어요\(hash\)/, 'sha256 을 못 내면 hash 경로로 떨어져 잡는다');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'] ?? null), null);
  await frame.evaluate(() => { window.__fetchHook = null; });
  await frame.click('[data-gl="get"]');
  await waitFab(frame);
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'].length), bodyCode.length, 'hash 가 맞으면 받아서 실행');
  await closeOf(page, errors);
  ok('보안 컨텍스트 아님: sha256 대신 hash 로 확인 (불일치 잡음 · 일치 통과)');
}

// ── 3) 파일로 넣기: 다른 판 · 깨진 파일(실행 안 됨: 창 유지·저장 안 함) · 맞는 판. 닫기
if (!skip()) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat());
  await frame.waitForSelector('.gl-card', { timeout: 8000 });
  const put = async (name, text) => {
    await frame.evaluate(() => { document.querySelector('.gl-msg').textContent = ''; });
    await frame.locator('input[type=file]').setInputFiles({ name, mimeType: 'text/javascript', buffer: Buffer.from(text) });
    await frame.waitForFunction(() => { const m = document.querySelector('.gl-msg'); return (m && !m.hidden && m.textContent && m.textContent !== '받는 중') || !document.querySelector('.gl-card'); }, null, { timeout: 15000 });
    return panelMsg(frame);
  };
  assert.match(await put('goei-body.js', '// goei-body 0.0.1\nconsole.log(1)'), /맞는 goei-body\.js가 아니에요/, '다른 판');
  assert.match(await put('goei-body.js', `// goei-body ${VERSION}\nthrow new Error("boom")`), /본체를 시작하지 못했어요/, '깨진 파일: 창에 까닭');
  assert.equal(await frame.locator('.gl-card').count(), 1, '깨진 파일이면 창이 남음');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'] ?? null), null, '깨진 본체는 저장소에 남기지 않음');
  assert.equal(await frame.evaluate(() => [...document.querySelectorAll('.gl-act button')].every((b) => !b.disabled)), true, '단추 다시 살아남');
  // 닫기 → 창 제거·컨테이너 숨김. 그 뒤 메시지 표시로는 창이 다시 안 뜸
  await frame.click('[data-gl="close"]');
  assert.equal(await frame.locator('.gl-card').count(), 0);
  assert.equal(await frame.evaluate(() => window.__calls.hide), 1);
  await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">x</div>'));
  await sleep(300);
  assert.equal(await frame.locator('.gl-card').count(), 0, '닫은 뒤 표시만으로는 창이 다시 안 뜸');
  // 다른 봇에 갔다가 괴이 카드로 돌아오면 다시 받기 창 (카드를 다시 열면 다시 시도)
  await frame.evaluate(() => { window.__chars.push({ name: '다른 봇', globalLore: [], alternateGreetings: [], additionalAssets: [] }); window.__charIndex = 1; });
  await sleep(1300);
  await frame.evaluate(() => { window.__charIndex = 0; });
  await frame.waitForSelector('.gl-card', { timeout: 5000 });
  // 맞는 판의 파일 → 실행(세계 자료 팩은 본체가 받는다) → 창 닫힘 → 버튼
  await serve(frame, worldFiles);
  await put('goei-body.js', bodyCode);
  await waitFab(frame);
  assert.equal(await frame.locator('.gl-card').count(), 0);
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'].length), bodyCode.length, '파일로 넣은 본체 저장');
  await closeOf(page, errors, ['boom']);
  ok('시작기 파일로 넣기: 다른 판 · 깨진 파일 · 닫기 · 카드 다시 열면 창 · 맞는 판');
}

// ── 4) 저장해 둔 본체가 깨졌을 때(판은 맞음): 지우고 받기 창에 까닭. 받으면 정상
if (!skip()) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat(), { body: `// goei-body ${VERSION}\nthis is not js (` });
  await frame.waitForSelector('.gl-card', { timeout: 8000 });
  assert.match(await panelMsg(frame), /본체를 시작하지 못했어요/);
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'] ?? null), null, '깨진 저장 본체는 지움 (다음엔 다시 받게)');
  assert.deepEqual(await fetched(frame), [], '저장 본체가 있었으니 받지는 않았음');
  await serve(frame, startFiles);
  await frame.click('[data-gl="get"]');
  await waitFab(frame);
  await closeOf(page, errors, ['Unexpected', 'SyntaxError']);
  ok('저장된 본체가 깨짐 → 지우고 받기 창 → 다시 받아 실행');
}

// ── 5) 저장 실패(QuotaExceeded): 받은 본체로 이번에는 그냥 돈다. 다음에 다시 받는다
if (!skip()) {
  const { page, frame, errors, logs } = await boot([fixture], 0, emptyChat(), { serve: startFiles, storeFail: '^goei:(body|data-world)$' });
  await waitFab(frame);
  assert.equal(await frame.evaluate(() => window.__store['p:goei:body'] ?? null), null, '저장은 안 됨');
  assert.ok(logs.some((l) => l.includes('본체를 저장하지 못했어요')), '저장 실패를 적음');
  assert.equal(await storedWorld(frame), null, '세계 자료도 저장 안 됨');
  assert.ok(logs.some((l) => l.includes('세계 자료를 저장하지 못했어요')), '세계 자료 저장 실패도 적음 (받은 자료로 이번에는 돈다)');
  assert.equal(await frame.locator('.gl-card').count(), 0, '받기 창은 안 뜸');
  await closeOf(page, errors);
  ok('pluginStorage 저장 실패(용량 초과)에도 본체는 뜸 (세계 자료 저장 실패도 같은 정책)');
}

// ── 6) 다른 봇: 아무것도 하지 않음(요청·표시·버튼). 괴이 카드로 바꾸면 본체, 다시 다른 봇이면 버튼 숨김, 돌아오면 접속 효과
if (!skip()) {
  const { page, frame, errors } = await boot([otherBot, fixture], 0, emptyChat());
  await serve(frame, startFiles);
  await sleep(2500);
  assert.deepEqual(await fetched(frame), [], '다른 봇에서는 받지 않음');
  assert.equal(await frame.locator('.gl-card').count(), 0);
  assert.equal(await frame.evaluate(() => !!document.querySelector('[x-goei-fab]')), false, '플로팅 버튼 없음');
  assert.equal(await frame.evaluate(() => window.__calls.handlers.display('그냥 글 [AN|x]')), '그냥 글 [AN|x]', '표시 그대로');
  const msgs = [{ role: 'system', content: 'sys' }, { role: 'user', content: '안녕' }];
  assert.deepEqual(await frame.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs), msgs, '요청 그대로');
  assert.deepEqual(await fetched(frame), [], '표시·요청으로도 받지 않음');
  assert.deepEqual(Object.keys(await frame.evaluate(() => window.__buttons)), ['goei-plugin-install'], '설치 단추(햄버거)만');
  assert.equal(await frame.evaluate(() => window.__buttons['goei-plugin-install'].arg.location), 'hamburger');
  // 괴이 카드로 전환 → 받아서 본체 → 버튼
  await frame.evaluate(() => { window.__charIndex = 1; });
  await waitFab(frame);
  assert.deepEqual(await fetched(frame), startFiles);
  assert.equal(await frame.evaluate(() => document.querySelector('[x-goei-fab]').getAttribute('x-goei-intro')), 'true', '접속 효과');
  // 다른 봇으로 → 버튼 숨김, 표시는 그대로
  await frame.evaluate(() => { window.__charIndex = 0; });
  await waitFab(frame, 'none');
  assert.equal(await frame.evaluate(() => window.__calls.handlers.display('그냥 글')), '그냥 글');
  // 다시 괴이 카드 → 버튼 + 접속 효과 다시
  await frame.evaluate(() => { document.querySelector('[x-goei-fab]').setAttribute('x-goei-intro', 'false'); window.__charIndex = 1; });
  await waitFab(frame);
  await frame.waitForFunction(() => document.querySelector('[x-goei-fab]').getAttribute('x-goei-intro') === 'true', null, { timeout: 3000 });
  await closeOf(page, errors);
  ok('다른 봇: 아무 일도 없음 · 괴이 카드로 전환 시 받기·버튼·접속 효과 · 되돌아가면 숨김');
}

// ── 7) 언로드: 처리기 전부 해제, 플로팅 버튼 제거, 감시 멈춤
if (!skip()) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat(), { body: bodyCode });
  await waitFab(frame);
  await frame.evaluate(() => window.__unload());
  await sleep(200);
  assert.equal(await frame.evaluate(() => !!document.querySelector('[x-goei-fab]')), false, '버튼 제거');
  assert.deepEqual((await frame.evaluate(() => window.__calls.removed)).sort(), ['handler:display', 'handler:input', 'listener:output', 'replacer:beforeRequest'].sort(), '처리기 4개 해제');
  const a = await frame.evaluate(() => window.__calls.idx);
  await sleep(2300);
  assert.equal(await frame.evaluate(() => window.__calls.idx), a, '감시 멈춤');
  await closeOf(page, errors);
  ok('언로드: 처리기 해제·버튼 제거·감시 멈춤');
}

// ── 8) 본 화면 접근(mainDom) 거부: 채팅 메뉴 단추로 대체. 감시는 돌아서 괴이 카드 판정(liteNow)이 되고 요청 손질이 된다
if (!skip()) {
  const status = '[▣|2025.01.01|02:47 AM|☀️|4°C|서울 종로구 거리|없음|없음|없음|관리국/신입]';
  const chat = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: `답\n${status}` }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '1' } };
  const msgs = [{ role: 'system', content: 'sys' }, { role: 'assistant', content: `답\n${status}` }, { role: 'user', content: '다음' }];
  const run = async (rootDom) => {
    const { page, frame, errors } = await boot([fixture], 0, chat, { body: bodyCode, rootDom });
    await frame.waitForFunction(() => window.__buttons['goei-plugin-chat'] || document.querySelector('[x-goei-fab]'), null, { timeout: 8000 });
    await sleep(1500);
    const out = await frame.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs);
    const buttons = await frame.evaluate(() => Object.fromEntries(Object.entries(window.__buttons).map(([k, v]) => [k, v.arg.location])));
    await closeOf(page, errors);
    return { out, buttons };
  };
  const denied = await run(false);
  assert.equal(denied.buttons['goei-plugin-chat'], 'chat', '채팅 메뉴 단추');
  assert.ok(denied.out.some((m) => typeof m.content === 'string' && m.content.includes('[Previous status]')), '권한 없어도 괴이 카드 판정이 되어 요청을 손질함');
  const granted = await run(true);
  assert.equal(granted.buttons['goei-plugin-chat'], undefined, '권한이 있으면 채팅 단추 없음');
  assert.deepEqual(denied.out, granted.out, '손질 결과가 권한 여부와 무관');
  ok('mainDom 거부: 채팅 메뉴 단추 + 감시·요청 손질은 그대로');
}

// ── 9) 옛 길(risuFetch)이 있는 Risu: 본 화면에서 직접 받고 nativeFetch 는 쓰지 않는다
if (!skip()) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat(), { risuFetch: true, serve: startFiles });
  await waitFab(frame);
  assert.equal((await frame.evaluate(() => window.__calls.risuFetch.length)), startFiles.length, '본체 조각과 세계 자료 조각 모두 risuFetch 로');
  assert.deepEqual(await fetched(frame), [], 'nativeFetch 안 씀');
  await closeOf(page, errors);
  ok('risuFetch 가 있으면 그 길로 받음');
}

// ── 10) 깡통봇 설치 전체: 로어북·인사말·사진 1,751장·아이콘·위키 묶음·토크나이저 → 점검 전부 ✓ → 저장소 사용량 → 이전 아이콘으로
if (!skip()) {
  const { page, frame, errors } = await boot([emptyBot], 0, emptyChat(), { body: bodyCode });
  await serve(frame);
  // 사진은 받은 바이트의 sha1 지문을 본다. 가짜 바이트를 쓰려면 지문 계산(crypto.subtle)을 막는다 (못 내는 환경 = 확인 없이 씀)
  await frame.evaluate(() => { Object.defineProperty(Crypto.prototype, 'subtle', { get: () => undefined }); window.__fetchHook = (n, u) => (u.includes('/pic/') ? new Uint8Array([1, 2, 3]) : undefined); });
  await frame.waitForFunction(() => window.__buttons['goei-plugin-install']);
  await frame.evaluate(() => window.__buttons['goei-plugin-install'].cb());
  await frame.waitForSelector('.gw-install', { timeout: 10000 });
  assert.match(await frame.textContent('.gw-install'), /아직 괴이 ː ANOMALY 카드가 아니에요/);
  assert.equal(await frame.locator('.gw-inst-no').count(), 6, '점검 6줄 전부 없음');
  const t0 = Date.now();
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => document.querySelector('.gw-install')?.textContent?.includes('끝났어요'), null, { timeout: 180000 });
  const ms = Date.now() - t0;
  const info = await frame.textContent('.gw-install .gx-hint');
  assert.match(info, /로어북·인사말·봇 이름 · 사진 1751장 · 아이콘 · 위키 기본 문서 · 토크나이저 — 끝났어요/, info);
  assert.equal(await frame.locator('.gx-err').count(), 0, '안 된 것 없음');
  const ch = await frame.evaluate(() => window.__chars[0]);
  assert.equal(ch.name, '괴이 ː ANOMALY');
  assert.equal(ch.alternateGreetings.length, 1 + 57, '기존 인사말 + 57');
  assert.deepEqual(ch.globalLore.map((e) => e.comment), ['⚙️설정', 'Directory', '📖위키', 'Plugin manifest']);
  assert.equal(ch.additionalAssets.length, manifest.pictures.length, '카드 사진 전부');
  assert.match(ch.image, /^assets\//, '아이콘이 메인');
  assert.deepEqual(ch.ccAssets.map((a) => [a.type, a.name]), [['icon', 'main'], ['icon', 'goei']], '이전 아이콘은 목록에 남김');
  const store = await frame.evaluate(() => Object.fromEntries(Object.entries(window.__store).map(([k, v]) => [k, typeof v === 'string' ? v.length : JSON.stringify(v).length])));
  assert.ok(store['p:goei:wikibase'] > 500_000, '위키 묶음 저장');
  assert.ok(store['p:goei:tok-o200k'] > 2_000_000, '토크나이저 저장');
  assert.deepEqual(JSON.parse(await frame.evaluate(() => window.__store['p:goei:icon'])), { [ch.name]: { ours: ch.image, prev: 'assets/old-icon.png' } }, '아이콘 기록 (chaId 없는 봇은 이름으로)');
  assert.equal(await frame.locator('.gw-inst-no').count(), 0, '점검 전부 있음');
  assert.match(await frame.textContent('.gw-install'), /모두 갖춰져 있어요/);
  assert.equal(await frame.textContent('[data-action="ed-inst-all"]'), '다시 점검·맞추기');
  // 다시 눌러도 바꿀 것 없음 (사진 0장 → 받기 없음)
  const f0 = (await fetched(frame)).length;
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /끝났어요|바꿀 것이 없었어요/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 30000 });
  assert.match(await frame.textContent('.gw-install .gx-hint'), /^로어북·인사말(·봇 이름)? — 끝났어요\.$/, '두 번째: 로어북만 다시 맞춤');
  assert.equal((await fetched(frame)).length, f0, '두 번째는 아무것도 안 받음');
  // 저장소 사용량(설정 내보내기)에 본체·위키·토크나이저가 보인다
  await frame.click('[data-action="ed-node"][data-value="manage:backup"]');
  await frame.waitForFunction(() => /플러그인 본체/.test(document.querySelector('.gw')?.textContent ?? '') && !/…/.test(document.querySelector('.gw-tokens')?.textContent ?? ''), null, { timeout: 5000 });
  const usage = await frame.evaluate(() => [...document.querySelectorAll('.gw .ps-row')].map((r) => `${r.querySelector('b')?.textContent}=${r.querySelector('.gw-tokens')?.textContent}`).filter((t) => t.includes('MB') || t.includes('KB') || t.includes('없음')));
  assert.ok(usage.some((t) => /플러그인 본체=\d/.test(t)) && usage.some((t) => /토크나이저=\d/.test(t)) && usage.some((t) => /위키 기본 문서=\d/.test(t)), usage.join(' / '));
  // 상태 점검: 토크나이저 o200k_base
  await frame.click('[data-action="ed-node"][data-value="manage:diag"]');
  assert.match(await frame.textContent('.gw'), /o200k_base/);
  // 이전 아이콘으로
  await frame.click('[data-action="ed-node"][data-value="install"]');
  await frame.waitForSelector('[data-action="ed-inst-icon-back"]', { timeout: 5000 });
  await frame.click('[data-action="ed-inst-icon-back"]');
  await frame.waitForFunction(() => document.querySelector('.gw-install')?.textContent?.includes('이전 아이콘 — 끝났어요'), null, { timeout: 10000 });
  assert.equal(await frame.evaluate(() => window.__chars[0].image), 'assets/old-icon.png');
  // 창을 닫으면 플로팅 버튼 (설치로 괴이 카드가 됨 → 감시 다시 판정)
  await frame.click('.gw [data-action="ed-close"]');
  await frame.click('.gx [data-action="close"]');
  await waitFab(frame);
  const total = Object.entries(store).filter(([k]) => k.startsWith('p:')).reduce((n, [, v]) => n + v, 0);
  console.log('MEASURE 설치', JSON.stringify({ installMs: ms, storageChars: store, totalMB: +(total / 1048576).toFixed(2) }));
  await closeOf(page, errors);
  ok('깡통봇 설치 전체 → 점검 ✓ → 저장소 사용량 → 이전 아이콘 → 플로팅 버튼');
}

// ── 11) 설치 부분 실패: 사진 일부 404 → 그 100장 묶음은 통째로 안 넣음(카드 그대로), 다음 단계는 계속, 다시 누르면 이어서. 지문 불일치도 실패
if (!skip()) {
  const { page, frame, errors } = await boot([emptyBot], 0, emptyChat(), { body: bodyCode });
  await serve(frame);
  const digests = manifest.pictures.map((p) => `${p[1]}.${p[2]}`);
  await frame.evaluate((d) => {
    const bad = new Set(d.slice(150, 160)); // 두 번째 묶음(100~199)에 404 열 장
    window.__fetchHook = (n, u) => (u.includes('/pic/') ? (bad.has(n) ? null : new Uint8Array([1, 2, 3])) : undefined);
  }, digests);
  await frame.waitForFunction(() => window.__buttons['goei-plugin-install']);
  assert.ok(await frame.evaluate(() => window.isSecureContext && !!crypto.subtle), '플러그인 칸이 보안 컨텍스트라 지문(sha1) 확인이 돈다');
  await frame.evaluate(() => window.__buttons['goei-plugin-install'].cb());
  await frame.waitForSelector('.gw-install', { timeout: 10000 });
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /끝났어요|안 된 것/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 180000 });
  const err1 = await frame.textContent('.gw-install .gx-err');
  // crypto.subtle 이 살아 있으니 가짜 바이트는 지문이 달라 첫 묶음부터 실패한다
  assert.match(err1, /사진: 사진 「.+」을 받지 못했어요/, err1);
  assert.equal(await frame.evaluate(() => window.__chars[0].additionalAssets.length), 0, '한 장이라도 못 받은 묶음은 카드에 안 넣음');
  assert.match(await frame.textContent('.gw-install .gx-hint'), /아이콘 · 위키 기본 문서 · 토크나이저 — 끝났어요/, '다른 단계는 계속');
  // 지문 계산을 끄면 두 번째 묶음에서만 막힌다: 첫 100장은 저장되고 100/1751 로 멈춘다
  await frame.evaluate(() => { Object.defineProperty(Crypto.prototype, 'subtle', { get: () => undefined }); });
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /안 된 것/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 180000 });
  const err2 = await frame.textContent('.gw-install .gx-err');
  assert.match(err2, /100\/1751장까지 받았어요/, err2);
  assert.equal(await frame.evaluate(() => window.__chars[0].additionalAssets.length), 100, '받은 묶음까지만 저장');
  assert.match(await frame.textContent('.gw-install'), /100\/1751장/, '점검표에 남은 수');
  // 404 를 고치고 다시 누르면 이어서 받는다
  await frame.evaluate(() => { window.__fetchHook = (n, u) => (u.includes('/pic/') ? new Uint8Array([1, 2, 3]) : undefined); });
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => /사진 1651장/.test(document.querySelector('.gw-install')?.textContent ?? ''), null, { timeout: 180000 });
  assert.equal(await frame.evaluate(() => window.__chars[0].additionalAssets.length), 1751);
  assert.equal(await frame.locator('.gw-inst-no').count(), 0);
  await closeOf(page, errors);
  ok('설치 부분 실패: 지문 불일치·404 묶음은 카드 그대로, 다른 단계 계속, 다시 누르면 이어서');
}

// ── 12) 이미 설치된 카드(괴이 카드)에서는 점검 화면. 위키 묶음·토크나이저 없으면 그것만 받고, 지우면 다시 「없음」
if (!skip()) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat(), { body: bodyCode });
  await serve(frame);
  await waitFab(frame);
  await frame.evaluate(() => window.__buttons['goei-plugin-install'].cb());
  await frame.waitForSelector('.gw-install', { timeout: 10000 });
  assert.match(await frame.textContent('.gw-install'), /빠진 것 2개/, '위키 묶음·토크나이저만 없음 (아이콘은 점검 항목이지만 빠진 것 수에는 안 셈)');
  assert.equal(await frame.locator('.gw-inst-no').count(), 3, '아이콘·위키·토크나이저');
  await frame.click('[data-action="ed-inst-all"]');
  await frame.waitForFunction(() => document.querySelector('.gw-install')?.textContent?.includes('끝났어요'), null, { timeout: 60000 });
  assert.match(await frame.textContent('.gw-install .gx-hint'), /로어북·인사말 · 아이콘 · 위키 기본 문서 · 토크나이저 — 끝났어요/);
  assert.equal(await frame.evaluate(() => window.__chars[0].additionalAssets.length), fixture.additionalAssets.length, '사진은 안 받음');
  assert.equal((await fetched(frame)).filter((n) => n.endsWith('.avif')).length, 0);
  assert.equal(await frame.evaluate(() => window.__chars[0].alternateGreetings.length), fixture.alternateGreetings.length, '인사말 그대로');
  // 지우기 → 없음 → 토큰 수 어림값
  await frame.click('[data-action="ed-node"][data-value="manage:backup"]');
  await frame.waitForSelector('[data-action="man-drop-tok"]', { timeout: 5000 });
  await frame.click('[data-action="man-drop-tok"]');
  await frame.click('[data-action="man-drop-tok-yes"]');
  await frame.waitForSelector('[data-action="man-drop-wiki"]', { timeout: 5000 });
  await frame.click('[data-action="man-drop-wiki"]');
  await frame.click('[data-action="man-drop-wiki-yes"]');
  await frame.waitForFunction(() => !document.querySelector('[data-action="man-drop-wiki"]') && !/…/.test(document.querySelector('.gw-tokens')?.textContent ?? ''), null, { timeout: 5000 });
  assert.equal(await frame.evaluate(() => window.__store['p:goei:tok-o200k'] ?? null), null);
  assert.equal(await frame.evaluate(() => window.__store['p:goei:wikibase'] ?? null), null);
  await frame.click('[data-action="ed-node"][data-value="manage:diag"]');
  assert.match(await frame.textContent('.gw'), /어림값/);
  await frame.click('[data-action="ed-node"][data-value="install"]');
  await frame.waitForFunction(() => document.querySelectorAll('.gw-inst-no').length === 2, null, { timeout: 5000 });
  await closeOf(page, errors);
  ok('설치된 카드: 점검 화면, 없는 것(위키·토크나이저·아이콘)만 받기, 지우기');
}

// ── 13) 토크나이저·위키 묶음 다시 읽기: 저장소에 있으면 본체가 뜰 때 올린다 (받기 없음)
if (!skip()) {
  const tokText = JSON.parse(files['tok-o200k.json']).parts.map((n) => files[n]).join('');
  const wikiText = JSON.parse(files['wiki-base.json']).parts.map((n) => files[n]).join('');
  const { page, frame, errors } = await boot([fixture], 0, emptyChat(), { body: bodyCode, store: { 'p:goei:tok-o200k': tokText, 'p:goei:wikibase': wikiText }, serve: installFiles });
  await waitFab(frame);
  await frame.evaluate(() => window.__buttons['goei-plugin-install'].cb());
  await frame.waitForSelector('.gw-install', { timeout: 10000 });
  await frame.waitForFunction(() => document.querySelectorAll('.gw-inst-no').length === 1, null, { timeout: 5000 });
  assert.match(await frame.textContent('.gw-install'), /모두 갖춰져 있어요/, '위키·토크나이저가 있으면 빠진 것 없음 (아이콘만 다름)');
  await frame.click('[data-action="ed-node"][data-value="manage:diag"]');
  assert.match(await frame.textContent('.gw'), /o200k_base/, '다시 읽은 토크나이저');
  assert.ok(!(await fetched(frame)).some((n) => /tok-o200k|wiki-base|goei-body|goei-data-world/.test(n)), '토크나이저·위키·본체·세계 자료는 받지 않음 (창을 열면 version.json 과 설치 자료 팩만)');
  // 깨진 저장값: 어림값으로
  await page.close();
  const bad = await boot([fixture], 0, emptyChat(), { body: bodyCode, store: { 'p:goei:tok-o200k': '{"pat_str":1}'.padEnd(2000, ' '), 'p:goei:wikibase': 'NOTAPACK' }, serve: installFiles });
  await waitFab(bad.frame);
  await bad.frame.evaluate(() => window.__buttons['goei-plugin-install'].cb());
  await bad.frame.waitForSelector('.gw-install', { timeout: 10000 });
  await bad.frame.click('[data-action="ed-node"][data-value="manage:diag"]');
  assert.match(await bad.frame.textContent('.gw'), /어림값/, '깨진 순위표면 어림값');
  await closeOf(bad.page, [...errors, ...bad.errors]);
  ok('토크나이저·위키 묶음 저장소에서 다시 읽기 · 깨진 값은 어림값');
}

// ── 14) 업데이트 전체 흐름 + 실패 경우: 안내·건너뛰기·준비·적용(사진은 바뀐 것만, 직접 넣은 것 보존, 명부 보존), minPlugin 부족, 중간 실패, 두 번 누름, 창 닫기, 옛 자리 항목
if (!skip()) {
  const payload = JSON.parse(JSON.parse(files['card-update.json']).parts.map((n) => files[n]).join(''));
  payload.version = '9.0.0';
  payload.data.firstMessage = '새 첫 안내';
  const man = payload.data.globalLore.find((e) => e.comment === 'Plugin manifest');
  const picBytes = [1, 2, 3, 4, 5];
  const picHash = createHash('sha1').update(Buffer.from(picBytes)).digest('hex').slice(0, 12);
  const pics = manifest.pictures.map((x) => [...x]);
  const changed = pics[0][0];
  pics[0] = [changed, picHash, 'avif', 5];
  pics.push(['NewPic', picHash, 'avif', 5]);
  man.content = JSON.stringify({ ...JSON.parse(man.content), version: '9.0.0', pictures: pics });
  const text = JSON.stringify(payload);
  const parts = [text.slice(0, 1000), text.slice(1000, 50000), text.slice(50000)];
  // 받은 파일 자체의 minPlugin 이 높은 판 (목록의 minPlugin 과 별개로 본다)
  const textHigh = JSON.stringify({ ...payload, minPlugin: '99.0.0' });
  const partsHigh = [textHigh.slice(0, 1000), textHigh.slice(1000, 50000), textHigh.slice(50000)];
  // 옛 판 카드: 자리 항목 4개 + 직접 넣은 로어북 + 고친 명부 + 직접 넣은 사진
  const oldCard = JSON.parse(JSON.stringify(fixture));
  for (const k of ['Faction', 'Mystic', 'Anomaly', 'Agent']) oldCard.globalLore.push({ comment: `📚Lore slot · ${k}`, content: '{{getvar::goei_lore_x}}', key: '', mode: 'normal', alwaysActive: true });
  oldCard.globalLore.push({ comment: '내가 넣은 로어북', content: '메모', key: '', mode: 'normal' });
  const dir = oldCard.globalLore.find((e) => e.comment === 'Directory');
  dir.content = dir.content.replace('"schema"', '"내가 고친 값": 1, "schema"');
  oldCard.additionalAssets.push(['MyOwn', 'assets/mine.webp', 'webp']);
  const chat = { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '1' } };
  const { page, frame, errors } = await boot([oldCard], 0, chat, { body: bodyCode, serve: installFiles });
  await frame.evaluate(({ parts, partsHigh, bytes, version }) => {
    window.__picBytes = bytes;
    window.__delay = 0;
    window.__fetchHook = (n, u) => {
      const wait = (v) => (window.__delay ? new Promise((r) => setTimeout(() => r(v), window.__delay)) : v);
      const set = window.__payloadMin ? partsHigh : parts;
      if (window.__drop && window.__drop.test(n)) return null;
      if (n === 'version.json') return { card: '9.0.0', plugin: '0.0.1', minPlugin: window.__minPlugin ?? '0.0.1' };
      if (n === 'card-update.json') return wait({ schema: 1, version, minPlugin: window.__payloadMin ?? '0.0.1', parts: set.map((_, i) => `card-update.${i + 1}.txt`), length: set.join('').length });
      if (u.includes('/pic/')) return new Uint8Array(window.__picBytes);
      const m = /card-update\.(\d+)\.txt/.exec(n);
      return m ? wait(set[+m[1] - 1]) : undefined;
    };
  }, { parts, partsHigh, bytes: picBytes, version: payload.version });
  await waitFab(frame);
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.upd-banner', { timeout: 10000 });
  assert.match(await frame.textContent('.upd-banner'), /카드 v9\.0\.0/);
  assert.equal(await frame.locator('.gx-xdot').count(), 1, '설정 아이콘에 점');
  await frame.click('[data-action="upd-skip"]');
  assert.equal(await frame.locator('.upd-banner').count(), 0, '건너뛰면 안내가 사라짐');
  assert.equal(await frame.evaluate(() => window.__store['p:goei:update-skip']), '9.0.0|');
  const toUpdate = async () => {
    const open = await frame.evaluate(() => { const g = document.querySelector('.gw'); return !!g && !g.hidden; });
    if (!open) await frame.click('[data-action="ed-open"][data-value="set:screen"] >> nth=0');
    await frame.waitForSelector('.gw:not([hidden])', { timeout: 5000 });
    await frame.click('[data-action="ed-tab"][data-value="manage"]');
    await frame.click('[data-action="ed-node"][data-value="set:update"]');
    await frame.waitForSelector('[data-action="upd-check"]', { timeout: 5000 });
  };
  await toUpdate();
  assert.match(await frame.textContent('.gw'), /v9\.0\.0/);
  // (a) version.json 의 minPlugin 이 높으면: 준비 단추 없이 안내
  await frame.evaluate(() => { window.__minPlugin = '99.0.0'; });
  await frame.click('[data-action="upd-check"]');
  await frame.waitForFunction(() => /플러그인을 먼저 업데이트/.test(document.querySelector('.gw')?.textContent ?? ''), null, { timeout: 5000 });
  assert.equal(await frame.locator('[data-action="upd-prepare"]').count(), 0, 'minPlugin 부족: 준비 단추 없음');
  await frame.evaluate(() => { window.__minPlugin = '0.0.1'; });
  await frame.click('[data-action="upd-check"]');
  await frame.waitForSelector('[data-action="upd-prepare"]', { timeout: 5000 });
  // (b) 받은 파일의 minPlugin 이 높으면: 준비 실패 안내
  await frame.evaluate(() => { window.__payloadMin = '99.0.0'; });
  await frame.click('[data-action="upd-prepare"]');
  await frame.waitForSelector('.gw .gx-err', { timeout: 10000 });
  assert.match(await frame.textContent('.gw .gx-err'), /플러그인 v99\.0\.0 이상이 필요해요/);
  assert.equal(await frame.locator('.upd-plan').count(), 0);
  await frame.evaluate(() => { window.__payloadMin = null; });
  // (c) 중간 조각 404: 안내, 계획 없음
  await frame.evaluate(() => { window.__drop = /card-update\.2\.txt/; });
  await frame.click('[data-action="upd-prepare"]');
  await frame.waitForFunction(() => /받지 못했어요 \(404/.test(document.querySelector('.gw .gx-err')?.textContent ?? ''), null, { timeout: 150000 });
  assert.equal(await frame.locator('.upd-plan').count(), 0);
  assert.equal(await frame.evaluate(() => window.__calls.setChar ?? 0), 0, '카드는 그대로');
  await frame.evaluate(() => { window.__drop = null; });
  // (d) 두 번 연속 누름: 한 번만 받는다. 받는 동안 창을 닫았다 열어도 계획이 남는다
  await frame.evaluate(() => { window.__delay = 400; });
  const f0 = (await fetched(frame)).filter((n) => n === 'card-update.json').length;
  await frame.click('[data-action="upd-prepare"]');
  await frame.click('[data-action="upd-prepare"]', { force: true }).catch(() => {});
  await frame.click('.gw [data-action="ed-close"]');
  await frame.click('.gx [data-action="close"]');
  await frame.waitForFunction((n) => window.__calls.fetch.filter((u) => /card-update\.3\.txt/.test(u)).length >= n, 1, { timeout: 20000 });
  await sleep(800);
  assert.equal((await fetched(frame)).filter((n) => n === 'card-update.json').length, f0 + 1, '두 번 눌러도 한 번만 받음');
  await frame.evaluate(() => { window.__delay = 0; });
  await frame.click('[x-goei-fab] button');
  await frame.waitForFunction(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none' && g.querySelector('[data-action="ed-open"]'); }, null, { timeout: 5000 });
  await toUpdate();
  await frame.waitForSelector('.upd-plan', { timeout: 5000 });
  assert.match(await frame.textContent('.upd-plan'), /첫 안내/);
  assert.match(await frame.textContent('.upd-plan'), /카드 사진: 바뀜 1 · 새로 1/);
  // (e) 적용
  await frame.click('[data-action="upd-apply"]');
  await frame.waitForFunction(() => window.__calls.setChar === 1, null, { timeout: 30000 });
  const ch = await frame.evaluate(() => window.__chars[0]);
  const before = oldCard.additionalAssets.find((r) => r[0] === changed);
  const after = ch.additionalAssets.find((r) => r[0] === changed);
  assert.notEqual(after[1], before[1], '지문이 바뀐 카드 사진은 새 것으로');
  assert.ok(ch.additionalAssets.some((r) => r[0] === 'NewPic'), '새 카드 사진 추가');
  assert.ok(ch.additionalAssets.some((r) => r[0] === 'MyOwn' && r[1] === 'assets/mine.webp'), '직접 넣은 사진 보존');
  assert.equal(ch.additionalAssets.length, oldCard.additionalAssets.length + 1, '나머지 사진은 그대로');
  assert.equal((await fetched(frame)).filter((n) => n.endsWith('.avif')).length, 2, '바뀐 사진만 받음');
  assert.equal(ch.firstMessage, '새 첫 안내');
  assert.match(ch.globalLore.find((e) => e.comment === 'Directory')?.content ?? '', /내가 고친 값/, '명부는 보존');
  assert.ok(ch.globalLore.some((e) => e.comment === '내가 넣은 로어북'), '직접 넣은 로어북 유지');
  assert.equal(ch.globalLore.filter((e) => String(e.comment).startsWith('📚Lore slot')).length, 0, '옛 자리 항목 4개는 뺌');
  assert.equal(ch.name, oldCard.name, '이름 유지');
  assert.deepEqual(ch.chats, oldCard.chats, '채팅 그대로');
  await frame.waitForFunction(() => /v9\.0\.0으로 바꿨어요/.test(document.querySelector('.gw')?.textContent ?? ''), null, { timeout: 5000 });
  assert.equal(await frame.locator('[data-action="upd-apply"]').count(), 0, '적용 뒤 단추 없음');
  assert.equal(await frame.locator('.gx-xdot').count(), 0, '최신이면 점 없음');
  // (f) 사진 받기 실패면 카드도 바꾸지 않는다
  await frame.evaluate(() => { const m = window.__chars[0].globalLore.find((e) => e.comment === 'Plugin manifest'); const j = JSON.parse(m.content); j.version = '0.1.0'; j.pictures[1][1] = 'deadbeef0000'; m.content = JSON.stringify(j); window.__drop = /\.avif$/; });
  // 카드가 바뀌었으니 창을 닫았다 열어 다시 읽게 한다
  await frame.click('.gw [data-action="ed-close"]');
  await frame.click('.gx [data-action="close"]');
  await frame.click('[x-goei-fab] button');
  await frame.waitForFunction(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none' && g.querySelector('[data-action="ed-open"]'); }, null, { timeout: 5000 });
  await toUpdate();
  await frame.waitForSelector('[data-action="upd-prepare"]', { timeout: 5000 });
  await frame.click('[data-action="upd-prepare"]');
  await frame.waitForSelector('[data-action="upd-apply"]', { timeout: 20000 });
  await frame.click('[data-action="upd-apply"]');
  await frame.waitForFunction(() => /카드는 바꾸지 않았어요/.test(document.querySelector('.gw .gx-err')?.textContent ?? ''), null, { timeout: 60000 });
  assert.equal(await frame.evaluate(() => window.__calls.setChar), 1, '카드 저장은 한 번뿐');
  await closeOf(page, errors);
  ok('업데이트: 안내·건너뛰기·minPlugin·중간 실패·두 번 누름·창 닫기·적용(사진 선별·보존·명부·자리 항목 제거)·사진 실패 시 카드 보존');
}

// ── 15) 플로팅 버튼 끌기·누르기: 리스너가 요소에만 걸리는 2026-10 Risu 와 문서 전체에 걸리는 옛 Risu 둘 다에서
//        손가락이 버튼 상자를 벗어나도 끌기가 이어지고, 놓으면 자리를 저장하며, 그냥 누르면 창이 열린다
for (const eventsOn of skip() ? [] : ['element', 'document']) {
  const { page, frame, errors } = await boot([fixture], 0, emptyChat(), { body: bodyCode, eventsOn });
  await waitFab(frame);
  await sleep(2600); // 접속 효과가 끝난 뒤
  const r = await frame.evaluate(() => { const b = document.querySelector('[x-goei-fab] button').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(r.x, r.y);
  await page.mouse.down();
  await page.mouse.move(r.x - 60, r.y - 40, { steps: 4 });
  await page.mouse.move(r.x - 300, r.y - 200, { steps: 10 });
  await sleep(200);
  await page.mouse.up();
  await sleep(300);
  const pos = await frame.evaluate(() => { const h = document.querySelector('[x-goei-fab]'); return { right: parseInt(h.style.right), bottom: parseInt(h.style.bottom), drag: h.getAttribute('x-goei-drag'), saved: window.__store['goei-plugin:fab-pos'] ?? null }; });
  assert.ok(pos.right >= 16 + 250 && pos.bottom >= 96 + 150, `${eventsOn}: 상자를 벗어나도 끌림 (${pos.right},${pos.bottom})`);
  assert.equal(pos.drag, 'false', '놓으면 끌기 끝');
  assert.deepEqual(JSON.parse(pos.saved), { right: pos.right, bottom: pos.bottom }, '자리 저장');
  assert.equal(await frame.locator('.gx').count(), 0, '끌고 놓은 뒤에는 창이 안 열림');
  // 그냥 누르면 창
  const r2 = await frame.evaluate(() => { const b = document.querySelector('[x-goei-fab] button').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.click(r2.x, r2.y);
  await frame.waitForSelector('.gx-fac', { timeout: 5000 });
  // 다른 곳을 눌러도 창은 안 열림 (문서 전체 리스너여도 좌표로 거른다)
  await frame.click('.gx [data-action="close"]');
  await page.mouse.click(50, 50);
  await sleep(300);
  assert.equal(await frame.evaluate(() => document.querySelector('.gx')?.style.display), 'none', '버튼 밖을 눌러도 창 안 열림');
  await closeOf(page, errors);
  ok(`플로팅 버튼 끌기·누르기 (리스너 ${eventsOn})`);
}

// ── 16) 자료 팩(개선 나1): 옛 시작기(release/goei-plugin.js)와 새 시작기 둘 다에서 새 본체가 세계 자료를 스스로 받아 저장하고 뜬다 → 창 열림.
//        시작기는 본체 조각만 받고, 본체가 start() 안에서 goei-data-world.json + 조각을 받아 pluginStorage(goei:data-world)에 둔다
for (const loader of skip() ? [] : ['old', 'new']) {
  const chat = emptyChat();
  const { page, frame, errors } = await boot([fixture], 0, chat, { serve: startFiles, loader });
  await waitFab(frame);
  assert.equal(await frame.locator('.gl-card').count(), 0, '받기 창 없음');
  const got = await fetched(frame);
  assert.deepEqual(got.slice(0, bodyFiles.length), bodyFiles, `${loader}: 시작기는 본체 조각만 받음`);
  assert.deepEqual(got.slice(bodyFiles.length), worldFiles, `${loader}: 그 다음 본체가 세계 자료 목록 + 조각 ${worldIndex.parts.length}개를 한 번씩`);
  assert.equal((await storedWorld(frame))?.length ?? 0, worldPack.length, '세계 자료 팩 저장');
  assert.equal(await storedWorld(frame), worldPack, '저장한 글이 dist 의 팩과 같음');
  // 처리기 등록·화면은 자료가 들어온 뒤: 요청 손질이 세계 자료(세력 관계·명부)를 읽어도 던지지 않는다
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.gx-fac', { timeout: 8000 });
  assert.match(await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">ANOMALY SIMULATION</div>')), /landing/, '시작 카드 표시는 본체가');
  // 새로고침 흉내: 본체·자료가 저장소에 있으면 아무것도 받지 않고 뜬다 (저장소에서 읽음 — 저장소 의존 없음)
  const store = await frame.evaluate(() => ({ 'p:goei:body': window.__store['p:goei:body'], 'p:goei:data-world': window.__store['p:goei:data-world'] }));
  await closeOf(page, errors);
  const again = await boot([fixture], 0, chat, { store, loader });
  await waitFab(again.frame);
  assert.deepEqual(await fetched(again.frame), [], `${loader}: 저장소에 본체·자료가 있으면 받기 없음`);
  await again.frame.click('[x-goei-fab] button');
  await again.frame.waitForSelector('.gx-fac', { timeout: 8000 });
  await closeOf(again.page, again.errors);
  ok(`자료 팩: ${loader === 'old' ? '옛 시작기' : '새 시작기'} + 새 본체 → 세계 자료 받아 저장 → 창 열림 → 다시 뜰 때 받기 없음`);
}

// ── 17) 자료 팩 받기 실패: 조각 404 → 본체가 띄우는 받기 창(까닭 · 다시 받기 · 닫기, 파일 넣기 없음). 옛 시작기는 시작 실패에 아무 창도 안 띄우므로
//        본체가 띄운다(host/datapanel.ts). 1분 재시도 억제(표시마다 다시 받지 않음) · 깨진 조각(sha256) · 목록 판 불일치 · 성공 →
//        옛 시작기: 채팅 다시 저장(Risu 가 다시 그리면 display → 시작기가 본체를 다시 띄움) / 새 시작기: 고리(__goeiRelaunch)로 바로 띄움, 창은 하나만
for (const loader of skip() ? [] : ['old', 'new']) {
  const chat = { message: [{ role: 'user', data: 'hi' }], scriptstate: {} };
  const { page, frame, errors, logs } = await boot([fixture], 0, chat, { serve: startFiles.filter((n) => n !== 'goei-data-world.2.txt'), loader });
  await frame.waitForSelector('.gl-card', { timeout: 15000 });
  assert.equal(await frame.locator('.gl-card').count(), 1, `${loader}: 받기 창은 하나 (새 시작기도 자기 창을 겹쳐 띄우지 않음)`);
  assert.equal(await frame.locator('[data-gl="file"]').count(), 0, '본체의 자료 받기 창에는 파일 넣기가 없음');
  const first = await panelMsg(frame);
  assert.match(first, /^세계 자료\(goei-data-world\)를 받지 못했어요: goei-data-world\.2\.txt을 받지 못했어요 \(404\)\./, first);
  assert.match(await frame.textContent('.gl-card'), /다시 받아 주세요/, '안내 글');
  assert.deepEqual(await frame.evaluate(() => window.__calls.show), ['fullscreen'], '창을 띄움');
  assert.equal(await fab(frame), 'none', '자료 없이는 버튼도 처리기 화면도 없음');
  assert.equal(await storedWorld(frame), null, '못 받은 자료는 저장 안 함');
  assert.match(await frame.evaluate(() => window.__store['p:goei:body']?.slice(0, 30) ?? ''), /^\/\/ goei-body /, '본체는 저장됨 (본체는 멀쩡)');
  assert.ok(logs.some((l) => l.includes('본체를 시작하지 못했어요') && l.includes('세계 자료')), '시작기 로그에 까닭');
  // 1분 억제: 메시지 표시로 시작기가 본체를 다시 시작해도(옛 시작기는 표시마다) 자료를 다시 받으려 하지 않는다. 창은 그대로 하나
  const n0 = (await fetched(frame)).filter((n) => n === 'goei-data-world.json').length;
  await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">x</div>'));
  await sleep(700);
  assert.equal((await fetched(frame)).filter((n) => n === 'goei-data-world.json').length, n0, `${loader}: 1분 안에는 다시 받지 않음`);
  assert.equal(await frame.locator('.gl-card').count(), 1, '창은 하나');
  const retry = async () => {
    await frame.evaluate(() => { document.querySelector('.gl-msg').textContent = ''; });
    await frame.click('[data-gl="get"]');
    await frame.waitForFunction(() => { const m = document.querySelector('.gl-msg'); return (m && !m.hidden && m.textContent && m.textContent !== '받는 중') || !document.querySelector('.gl-card'); }, null, { timeout: 30000 });
    return panelMsg(frame);
  };
  // 깨진 조각(길이 같음): 보안 컨텍스트라 sha256 에서 걸린다
  await serve(frame, startFiles);
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-data-world.1.txt' ? window.__files[n].slice(0, 100) + '#' + window.__files[n].slice(101) : undefined); });
  assert.match(await retry(), /세계 자료가 깨져 있어요\(sha256\)/, '깨진 조각');
  assert.equal(await storedWorld(frame), null);
  assert.equal(await frame.evaluate(() => [...document.querySelectorAll('.gl-act button')].every((b) => !b.disabled)), true, '단추 다시 살아남');
  // 목록의 지문이 본체와 다름 (release 에 다른 판의 팩만 있을 때): 조각은 받지 않는다
  await frame.evaluate(() => { window.__fetchHook = (n) => (n === 'goei-data-world.json' ? JSON.stringify({ ...JSON.parse(window.__files[n]), hash: 'deadbeef' }) : undefined); });
  const p1 = (await fetched(frame)).filter((n) => n === 'goei-data-world.1.txt').length;
  assert.match(await retry(), /아직 이 판의 세계 자료가 올라오지 않았어요/, '판 불일치');
  assert.equal((await fetched(frame)).filter((n) => n === 'goei-data-world.1.txt').length, p1, '목록에서 멈춤');
  // 성공 → 창 닫힘 → 저장
  await frame.evaluate(() => { window.__fetchHook = null; });
  await frame.click('[data-gl="get"]');
  await frame.waitForFunction(() => !document.querySelector('.gl-card'), null, { timeout: 30000 });
  assert.equal((await storedWorld(frame))?.length ?? 0, worldPack.length, '세계 자료 저장');
  if (loader === 'new') {
    // 새 시작기: 고리로 바로 다시 띄운다 (1분 억제와 무관)
    await waitFab(frame, 'block', 15000);
    assert.equal(await frame.evaluate(() => window.__calls.setChat.length), 0, '채팅 다시 저장은 안 함');
  } else {
    // 옛 시작기: 채팅을 그대로 다시 저장해 Risu 가 다시 그리게 한다. (가짜 Risu 는 다시 그리지 않으니) 표시 처리기를 불러 흉내 → 시작기가 본체를 띄움
    await frame.waitForFunction(() => window.__calls.setChat.length === 1, null, { timeout: 5000 });
    assert.deepEqual(await frame.evaluate(() => window.__calls.setChat[0].message), chat.message, '채팅은 그대로 다시 저장');
    assert.equal(await fab(frame), 'none');
    await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">x</div>'));
    await waitFab(frame, 'block', 15000);
  }
  await frame.click('[x-goei-fab] button');
  await frame.waitForFunction(() => { const g = document.querySelector('.gx'); return g && g.style.display !== 'none' && g.querySelector('[data-action="ed-open"]'); }, null, { timeout: 8000 });
  await closeOf(page, errors);
  ok(`자료 팩 받기 실패(${loader === 'old' ? '옛' : '새'} 시작기): 본체의 받기 창 · 1분 억제 · 깨진 조각(sha256) · 판 불일치 · 다시 받기 성공 → ${loader === 'old' ? '채팅 다시 저장 → 표시 → ' : '고리로 '}본체 뜸`);
}

// ── 18) 저장소의 자료가 이 판과 다르면(판 불일치·깨짐) 다시 받고, 맞으면 받지 않는다. 자료만 없는 저장소(본체는 있음)도 자료만 받는다
if (!skip()) {
  // (a) 판이 다른 팩(짧은 글) → 다시 받아 덮어씀
  const { page, frame, errors, logs } = await boot([fixture], 0, emptyChat(), { body: bodyCode, data: false, store: { 'p:goei:data-world': '{"schema":1,"kind":"world"}' }, serve: worldFiles, loader: 'old' });
  await waitFab(frame);
  assert.deepEqual(await fetched(frame), worldFiles, '본체는 저장소에서, 세계 자료만 다시 받음');
  assert.equal(await storedWorld(frame), worldPack, '새 팩으로 덮어씀');
  assert.ok(logs.some((l) => l.includes('저장된 세계 자료가 이 판과 달라 다시 받아요')), '까닭을 적음');
  await closeOf(page, errors);
  // (b) 길이는 같은데 글자가 다른 팩(깨짐) → 지문이 달라 다시 받음
  const broken = worldPack.slice(0, 500) + (worldPack[500] === 'a' ? 'b' : 'a') + worldPack.slice(501);
  const b = await boot([fixture], 0, emptyChat(), { body: bodyCode, data: false, store: { 'p:goei:data-world': broken }, serve: worldFiles, loader: 'old' });
  await waitFab(b.frame);
  assert.deepEqual(await fetched(b.frame), worldFiles, '지문이 다르면 다시 받음');
  assert.equal(await storedWorld(b.frame), worldPack);
  await closeOf(b.page, b.errors);
  // (c) 자료만 없는 저장소 → 자료만 받음. (d) 둘 다 있으면 아무것도 안 받음 (16 에서도 봄)
  const c = await boot([fixture], 0, emptyChat(), { body: bodyCode, data: false, serve: worldFiles, loader: 'old' });
  await waitFab(c.frame);
  assert.deepEqual(await fetched(c.frame), worldFiles, '자료만 받음');
  await closeOf(c.page, c.errors);
  const d = await boot([fixture], 0, emptyChat(), { body: bodyCode, loader: 'old' });
  await waitFab(d.frame);
  assert.deepEqual(await fetched(d.frame), [], '맞는 자료가 있으면 받기 없음');
  await closeOf(d.page, d.errors);
  ok('저장소 자료 판 불일치·깨짐 → 다시 받음 · 자료만 없으면 자료만 · 맞으면 받기 없음');
}

await browser.close();
server.close();
console.log('ALL PASS qc-loader-browser');
