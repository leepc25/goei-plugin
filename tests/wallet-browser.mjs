// 가계부 탭 (src/ui/wallet.ts): PC 왼쪽 메뉴, 모바일 머리 잔고 단추·ID카드 잔고 칩으로 들어가 내역·합계·추가·수정·지우기
// 사용법: node tests/wallet-browser.mjs <fixture.json> [screenshot-dir]   (fixture: tests/make_fixture.py)
// 호스트 흉내(hostScript·boot·open)는 tests/browser.mjs 와 같다.
import { createRequire } from 'node:module';
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

const wallet = { start: 140000, log: [
  { id: 'w1', anchor: 'c1', amount: -15000, memo: '택시비', src: 'story', quote: '택시비 15,000원을 카드로 냈다', at: '2026-10-27T01:00:00Z' },
  { id: 'w2', anchor: 'c1', amount: 30000, memo: '상품권', src: 'story', quote: '3만 원짜리 상품권을 받았다', at: '2026-10-27T01:00:00Z' },
  { id: 'w3', anchor: 'c2', amount: -1200, memo: '삼각김밥', src: 'field', place: '종로 큰길', time: '09:40', at: '2026-10-27T01:10:00Z' },
  { id: 'w4', anchor: 'gone', amount: -99999, memo: '지운 메시지', src: 'story', at: '2026-10-27T01:20:00Z' },
] };
const chat = () => ({
  message: [
    { role: 'user', data: 'hi', chatId: 'u1' },
    { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|출근|-|-|관리국/요원|₩ 155,000]', chatId: 'c1' },
    { role: 'user', data: '다음 날', chatId: 'u2' },
    { role: 'char', data: '본문\n[▣|2025.01.02|09:40 AM|☀️|4°C|종로 큰길|출근|-|-|관리국/요원|₩ 153,800]', chatId: 'c2' },
  ],
  scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_wallet: JSON.stringify(wallet), $st_wallet_edit: '1' },
});
const walletOf = (page) => page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_wallet));
const rows = (page) => page.locator('.gx-wt-row').count();

// PC: 왼쪽 메뉴 「가계부」
{
  const { page, errors } = await boot(fixture, chat(), { width: 1280, height: 860 });
  await open(page);
  await page.waitForSelector('.gx-nav');
  await page.click('.gx-nav > .gx-nb[data-value="wallet"]');
  await page.waitForSelector('.gx-wallettab');
  assert.match(await page.textContent('.gx-wt-balrow b'), /153,800/, '잔고 = 시작 + 살아 있는 거래 (지운 메시지 거래 빠짐)');
  assert.match(await page.textContent('.gx-wt-tile.bal'), /시작 ₩ 140,000 · 거래 3건/);
  const tiles = await page.locator('.gx-wt-tile').allTextContents();
  assert.match(tiles[1], /수입\s*\+30,000\s*1건/);
  assert.match(tiles[2], /지출\s*−16,200\s*2건/);
  assert.match(tiles[3], /오늘 · 01\.02\s*−1,200\s*1건/);
  // 날짜 묶음 (최신 위) · 그 거래 뒤 잔고 · 필드 장면·시각 · 본문 근거
  assert.deepEqual(await page.locator('.gx-wt-day h3 span').allTextContents(), ['2025.01.02 (목)', '2025.01.01 (수)']);
  assert.equal(await rows(page), 3);
  const first = await page.textContent('.gx-wt-row >> nth=0');
  assert.match(first, /삼각김밥[\s\S]*종로 큰길 09:40[\s\S]*−1,200[\s\S]*153,800/);
  assert.match(await page.textContent('.gx-wt-row:has-text("택시비")'), /「택시비 15,000원을 카드로 냈다」[\s\S]*125,000/);
  assert.ok(await page.$('.gx-wt-row:has-text("삼각김밥") .gx-wt-ic.field'), '필드 아이콘');
  // 거르기·찾기
  await page.click('[data-action="wallet-filter"][data-value="in"]');
  assert.equal(await rows(page), 1);
  await page.click('[data-action="wallet-filter"][data-value="all"]');
  await page.fill('.gx-wt-q', '카드');
  await page.waitForFunction(() => document.querySelectorAll('.gx-wt-row').length === 1);
  assert.ok(await page.isVisible('.gx-wt-q'), '찾는 동안 입력칸 유지');
  await page.fill('.gx-wt-q', '');
  await page.waitForFunction(() => document.querySelectorAll('.gx-wt-row').length === 3);
  // 지우기 (마우스 올리면 ✕)
  await page.hover('.gx-wt-row:has-text("상품권")');
  await page.click('.gx-wt-row:has-text("상품권") .gx-wt-del');
  await page.waitForFunction(() => document.querySelector('.gx-wt-balrow b')?.textContent?.includes('123,800'));
  // 잔고 고치기 (✎)
  await page.click('.gx-wt-pen');
  await page.fill('[name="wt-adj"]', '20만');
  await page.click('[data-action="wallet-adj"]');
  await page.waitForFunction(() => document.querySelector('.gx-wt-balrow b')?.textContent?.includes('200,000'));
  assert.equal(await page.locator('[name="wt-adj"]').count(), 0, '저장하면 고치기 칸 닫힘');
  const w = await walletOf(page);
  assert.ok(w.log.some((e) => e.src === 'manual' && e.amount === 76200));
  assert.match((await page.locator('.gx-wt-tile').allTextContents())[1], /수입\s*\+0/, '직접 수정은 수입·지출에 안 섞임');
  assert.ok(await page.$('.gx-wt-row .gx-wt-ic.manual'), '직접 수정 아이콘');
  if (shots) await page.screenshot({ path: `${shots}/wallet-pc.png` });
  // ID카드 잔고 칩도 탭으로
  await page.click('.gx-nav > .gx-nb[data-value="board"]');
  await page.click('.gx-nav-brand .gx-wallet');
  await page.waitForSelector('.gx-wallettab');
  assert.deepEqual(errors, []);
  await page.close();
}

// 모바일: 머리 잔고 단추, 줄을 누르면 ✕, ID카드 창의 잔고 칩
{
  const { page, errors } = await boot(fixture, chat(), { width: 390, height: 844 });
  await open(page);
  await page.waitForSelector('.gx-hwallet');
  assert.match(await page.textContent('.gx-hwallet'), /153,800/);
  await page.click('.gx-hwallet');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-hwallet').count(), 0, '가계부 탭에서는 머리 잔고 단추 숨김');
  assert.equal(await page.isVisible('.gx-wt-row:has-text("택시비") .gx-wt-del'), false);
  await page.click('.gx-wt-row:has-text("택시비") .gx-wt-main');
  assert.equal(await page.isVisible('.gx-wt-row:has-text("택시비") .gx-wt-del'), true, '누르면 ✕');
  if (shots) await page.screenshot({ path: `${shots}/wallet-mobile.png`, fullPage: true });
  await page.locator('[data-value="board"]:visible').first().click();
  await page.click('.gx-idbtn');
  await page.waitForSelector('.gx-idpop .gx-wallet');
  await page.click('.gx-idpop .gx-wallet');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-idpop').count(), 0, 'ID카드 창은 닫힘');
  assert.deepEqual(errors, []);
  await page.close();
}

// 잔고 직접 수정 꺼짐(기본): ✎·✕ 없음, 시작 잔고 잠김 → 설정에서 켜면 생김
{
  const c = chat();
  delete c.scriptstate.$st_wallet_edit;
  const { page, errors } = await boot(fixture, c, { width: 1280, height: 860 });
  await open(page);
  await page.waitForSelector('.gx-nav');
  await page.click('.gx-nav > .gx-nb[data-value="wallet"]');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-wt-pen').count(), 0, '꺼져 있으면 ✎ 없음');
  assert.equal(await page.locator('.gx-wt-del').count(), 0, '꺼져 있으면 ✕ 없음');
  await page.click('[data-action="ed-open"][data-value="set:screen"] >> nth=0');
  await page.click('[data-action="ed-node"][data-value="set:board"]');
  await page.waitForSelector('[data-action="set-wallet-edit"]');
  assert.equal(await page.isDisabled('.st-won'), true, '이야기가 시작된 채팅은 시작 잔고 잠김');
  await page.click('[data-action="set-wallet-edit"][data-value="1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_wallet_edit === '1');
  await page.waitForFunction(() => document.querySelector('.st-won') && !document.querySelector('.st-won').disabled);
  if (shots) { await page.locator('[data-action="set-wallet-edit"]').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: `${shots}/wallet-setting.png` }); }
  assert.deepEqual(errors, []);
  await page.close();
}

// 잔고 칸을 끈 채팅: 메뉴·단추 없음
{
  const c = chat();
  c.scriptstate.$st_col_wallet = 'off';
  const { page } = await boot(fixture, c, { width: 1280, height: 860 });
  await open(page);
  await page.waitForSelector('.gx-nav');
  assert.equal(await page.locator('.gx-nav > .gx-nb[data-value="wallet"]').count(), 0);
  assert.equal(await page.locator('.gx-hwallet').count(), 0);
  await page.close();
}

await browser.close();
console.log('wallet-browser 통과');
