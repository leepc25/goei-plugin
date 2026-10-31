// QC 2026-10-28 · 플러그인 창 안 기능 모듈 렌더 시간 측정 (docs/qc/04_modules.md ③): 괴담넷 글 20/500개(댓글 4개씩·쪽지 60통), 괴담톡 대화 100/2000줄
// 사용법: node tests/qc-modules-perf.mjs <fixture.json>   (fixture: tests/make_fixture.py). 각 조작의 ms 를 찍고, 3초를 넘으면 실패한다
// 호스트 흉내는 tests/browser.mjs·tests/qc-modules-browser.mjs 와 같다.
import { createRequire } from 'node:module';
import { distWorldPack } from './data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const shots = process.argv[3];
const fixtureDir = dirname(resolve(process.argv[2]));
if (shots) mkdirSync(shots, { recursive: true });
const plugin = readFileSync(process.env.PLUGIN || new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');

// 본체는 시작기가 pluginStorage에서 꺼낸다. 따로 시험하는 곳(noBody) 말고는 미리 넣어 둔다
const bodyCode = readFileSync(new URL('../dist/goei-body.js', import.meta.url), 'utf8');
/** 세계 자료 팩 (개선 나1): 본체처럼 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우). 받기 시험은 noBody 쪽에서 */
const worldPack = distWorldPack();
function hostScript(char, chat, { rootDom = true, noBody = false } = {}) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {} };
    // SafeElement 흉내. Risu와 똑같이 addEventListener는 요소가 아니라 document 전체에 건다.
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
    if (!${noBody}) window.__store['p:goei:data-world'] = ${JSON.stringify(worldPack)};
    window.__rootDoc = ${rootDom} ? { querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)) } : null;
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
      pluginStorage: { getItem: async (k) => window.__store['p:' + k] ?? null, setItem: async (k, v) => { window.__store['p:' + k] = v; }, keys: async () => [], removeItem: async (k) => { delete window.__store['p:' + k]; } },
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
      setCharacterToIndex: async (i, c) => { window.__calls.setChar = (window.__calls.setChar || 0) + 1; window.__char = clone(c); },
      getChatFromIndex: async () => clone(window.__chat),
      setChatToIndex: async (a, b, chat) => { window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async (o) => { window.__calls.llm = window.__calls.llm || []; window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 150)); const next = (window.__llm || []).shift(); return next ?? { type: 'fail', result: 'no mock' }; },
      getCurrentLorebookEntries: async () => clone([...(window.__char.globalLore || []), ...(window.__moduleLore || [])]),
      getDatabase: async () => ({ modules: window.__modules || [], enabledModules: (window.__modules || []).map((m) => m.id) }),
      readImage: async (p) => { (window.__calls.read = window.__calls.read || []).push(p); if (window.__assets[p]) return window.__assets[p]; const b64 = await window.__readAsset(p); if (!b64) throw new Error('no asset'); return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t).replace(/\{\{user\}\}/g, window.__userName ?? '{{user}}'),
      nativeFetch: async (url) => { (window.__calls.fetch = window.__calls.fetch || []).push(url); const r = window.__fetch && window.__fetch(String(url)); return r ? { ok: true, status: 200, json: async () => r, text: async () => typeof r === 'string' ? r : JSON.stringify(r), arrayBuffer: async () => (r instanceof Uint8Array ? r : new TextEncoder().encode(typeof r === 'string' ? r : JSON.stringify(r))).slice().buffer } : { ok: false, status: 404, json: async () => null, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }; },
    };
    window.__assets = {};`;
}

const browser = await chromium.launch();
// 실패하면 브라우저를 닫고 바로 끝낸다 (열린 브라우저 때문에 멈춘 채 남지 않게)
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
async function boot(char, chat, viewport = process.env.VP ? { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } : { width: 1100, height: 900 }, opts = {}) {
  const page = await browser.newPage({ viewport, ...(opts.touch ? { hasTouch: true, isMobile: true } : {}) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.exposeFunction('__readAsset', (p) => {
    try { return readFileSync(new URL(p, `file://${fixtureDir}/`)).toString('base64'); } catch { return null; }
  });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"><button id="other" style="margin:40px">다른 버튼</button></div></body></html>');
  // 실제 Risu 플러그인 창은 allow-forms 없는 iframe이라 form 제출 이벤트가 아예 일어나지 않는다
  await page.addScriptTag({ content: "document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);" });
  await page.addScriptTag({ content: hostScript(char, chat, opts) });
  await page.addScriptTag({ content: `(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
  assert.equal(await page.evaluate(() => window.__bootError ?? null), null);
  return { page, errors };
}
// 플로팅 버튼이 뜰 때까지 기다렸다가(접속 효과 포함) 누른다
async function open(page) {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 6000 });
  await page.click('[x-goei-fab] button');
}

async function startedWithReply(page) {
  await open(page);
  await page.waitForSelector('.gx-fac');
  await page.click('.gx-fac[data-value="A00"]');
  await page.click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length === 1);
  await page.evaluate(async () => {
    window.__chat.scriptstate.$ph_auto = '0';
    window.__chat.scriptstate.$pp_on = '0';
    window.__chat.message.push({ role: 'user', data: '시작' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]' });
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
    const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
  });
}
const B = 1846000;
const LIMIT = 3000;
function lap(n, what, t) {
  const ms = Date.now() - t;
  console.log(`${n}\t${what.join(' ')}\t${ms}ms`);
  assert.ok(ms < LIMIT, `${n} ${what.join(' ')} ${ms}ms`);
}
for (const N of [20, 500]) {
  const { page } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const lines = ['GN1', `Q|${B + N}`];
  for (let i = N; i >= 1; i--) {
    lines.push(`P|${B + i}|2025.01.01 02:${String(i % 60).padStart(2, '0')}|닉${i}|제목 ${i} 아주 긴 제목이 들어간다|${i * 3}|${i}|본문 ${i}\\n둘째 줄|${i % 7 === 0 ? 1 : 0}`);
    for (let c = 1; c <= 4; c++) lines.push(`C|${B + i}|${c > 1 ? c - 1 : 0}|댓${c}|댓글 ${i}-${c}|0|0|2025.01.01 03:${String(c).padStart(2, '0')}`);
  }
  for (let i = 0; i < 60; i++) lines.push(`D|상대${i % 3}|${i % 2 ? 'me' : 'npc'}|쪽지 ${i}|${i % 2 ? 0 : 1}|2025.01.01 04:00`);
  await page.evaluate((raw) => { window.__chat.scriptstate.$gn_raw = raw; }, lines.join('\n'));
  // 플로팅 버튼의 접속 효과를 기다린 뒤부터 잰다
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  let t = Date.now();
  await page.click('[x-goei-fab] button');
  await page.waitForSelector('.gx-nav');
  lap(N, ['open'], t);
  t = Date.now();
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="gnet"]');
  await page.waitForSelector('.gn-row-main');
  lap(N, ['nav gnet'], t);
  for (const sub of ['dm', 'board', 'dm', 'board']) {
    t = Date.now();
    await page.click(`[data-action="gn-sub"][data-value="${sub}"]`);
    await page.waitForSelector(sub === 'dm' ? '.gn-dmrow' : '.gn-row-main');
    lap(N, ['sub', sub], t);
  }
  t = Date.now();
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board, .gx-ops');
  lap(N, ['nav board'], t);
  t = Date.now();
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="gnet"]');
  await page.waitForSelector('.gn-row-main');
  lap(N, ['nav gnet again'], t);
  await page.close();
}
const JY = 'c_50303031';
for (const N of [100, 2000]) {
  const { page } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const st = { version: 2, seq: 1, mid: 0, rooms: {}, order: [] };
  const room = { id: `dm_${JY}`, kind: 'dm', members: [JY], people: { [JY]: { id: JY, name: '쟈알디', english: 'Jyaldi' } }, messages: [], draft: '', unread: 0, readThrough: 0 };
  for (let i = 1; i <= N; i++) room.messages.push({ id: ++st.mid, sender: i % 3 ? JY : 'me', text: `${i % 3 ? '받은' : '보낸'} 말 ${i}`, time: `2025.01.${String(1 + Math.floor(i / 100)).padStart(2, '0')} 0${i % 10}:00`, kind: 'message', audience: [JY] });
  room.unread = 7;
  st.rooms[room.id] = room;
  st.order.push(room.id);
  await page.evaluate((st) => { window.__chat.scriptstate.$ph_state = JSON.stringify(st); window.__chat.scriptstate.$ph_storage_auto_dm = '0'; }, st);
  // 플로팅 버튼의 접속 효과를 기다린 뒤부터 잰다
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  let t = Date.now();
  await page.click('[x-goei-fab] button');
  await page.waitForSelector('.gx-nav');
  lap(N, ['open'], t);
  t = Date.now();
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await page.waitForSelector('.ph');
  lap(N, ['nav phone'], t);
  t = Date.now();
  await page.click('[data-action="ph-sub"][data-value="chats"]');
  await page.waitForSelector('.ph-chats');
  lap(N, ['sub chats'], t);
  t = Date.now();
  await page.click('.ph-chats [data-action="ph-room"]');
  await page.waitForSelector('.ph-room');
  lap(N, ['open room'], t);
  t = Date.now();
  await page.click('.ph-more').catch(() => {});
  await page.waitForTimeout(50);
  lap(N, ['more'], t);
  t = Date.now();
  await page.click('[data-action="ph-back"]');
  await page.waitForSelector('.ph-chats');
  lap(N, ['back'], t);
  await page.close();
}
await browser.close();
