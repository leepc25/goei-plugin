// 실제 Chromium에서 플러그인 번들을 Risu와 같은 방식(async 함수 안)으로 실행하고
// 가짜 risuai API로 시작 화면 → 저장까지 확인한다.
// 사용법: node tests/browser.mjs <fixture.json> [screenshot-dir]
import { createRequire } from 'node:module';
import { distPackFiles, distWorldPack } from './data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const shots = process.argv[3];
const fixtureDir = dirname(resolve(process.argv[2]));
if (shots) mkdirSync(shots, { recursive: true });
const plugin = readFileSync(process.env.PLUGIN || new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fixture.globalLore.find((e) => e.comment === 'Plugin manifest').content);

// 본체는 시작기가 pluginStorage에서 꺼낸다. 따로 시험하는 곳(noBody) 말고는 미리 넣어 둔다
const bodyCode = readFileSync(new URL('../dist/goei-body.js', import.meta.url), 'utf8');
/** 세계 자료 팩 (개선 나1): 본체처럼 가짜 저장소에 미리 둔다 (저장소에 자료가 있는 보통 경우). 받기 시험은 noBody 쪽에서 */
const worldPack = distWorldPack();
function hostScript(char, chat, { rootDom = true, noBody = false, prefs = null } = {}) {
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
    if (${JSON.stringify(prefs)}) window.__store['p:goei:prefs'] = JSON.stringify(${JSON.stringify(prefs)});
    if (!${noBody}) window.__store['p:goei:body'] = ${JSON.stringify(bodyCode)};
    if (!${noBody}) window.__store['p:goei:data-world'] = ${JSON.stringify(worldPack)};
    window.__rootDoc = ${rootDom} ? { ...wrap(document.documentElement), querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)) } : null;
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
    window.__assets = {};
    // 플러그인이 본편 요청에 끼우는 로어북 덩어리·이미지 지침(2026-10-27~)을 뺀 나머지. 요청 흐름 시험이 그 밖의 것만 보게
    window.__core = (r) => r.filter((m) => !(m.role === 'system' && typeof m.content === 'string' && (m.content.startsWith('<!-- goei:lore -->') || m.content.startsWith('## Inserting Character Visual Images'))));`;
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
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"><button id="other" style="margin:40px">다른 버튼</button></div></body></html>');
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
// 상황 그림 카드: 띠를 눌러 상세 창을 열고, 창 안의 버튼(지도·목표로 고르기·종료 등)을 누른다
// 상황판(관제실): 일지 행을 눌러 큰 보기로 띄우고, 큰 보기의 버튼을 누른다
async function cardAction(page, name, action, scope = '') {
  if (scope !== '.gx-map' && await page.locator(`.gx-board li.gx-oprow:has-text("${name}")`).count()) {
    await page.click(`.gx-board li.gx-oprow:has-text("${name}")`);
    await page.click(`.gx-opview [data-action="${action}"]`);
    return;
  }
  if (!(await page.locator('.ev-pop').count())) await page.click(`${scope} li.gx-evc:has-text("${name}")`);
  await page.click(`.ev-pop [data-action="${action}"]`);
}
// 커스텀 목록: 그림 띠를 눌러 펼친 뒤 「이 …로 선택」 (2026-10-20 그림 카드)
async function pickCustom(page, row = '.gx-mlist li.gx-mx') {
  await page.locator(`${row} [data-action="mission-open"]`).first().click();
  await page.click('.gx-mlist li.gx-mx.open [data-action="mission-pick"]');
}

// 설정 창(2026-10-27 개편: 별도 창 .gw 하나, 탭 기능·세계·지침·점검 + 왼쪽 목록의 페이지 노드)
const edTabOf = (n) => (n.startsWith('guide:') || n.startsWith('rule:') ? 'guide' : n === 'install' || n === 'set:update' || n.startsWith('manage:') ? 'manage' : n.startsWith('set:') ? 'set' : 'world');
// 목록은 폰(760px 이하)에서 서랍에 숨으므로 DOM 에서 누른다 (tests/qc-settings-harness.mjs goNode 와 같음)
async function edGo(page, node) {
  await page.evaluate((t) => { if (!document.querySelector('.gw .gw-tree-item.on')?.closest('.gw-tree')?.querySelector(`[data-action="ed-node"]`) || document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]:not(.on)`)) document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(); }, edTabOf(node));
  await page.waitForFunction((n) => !!document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`), node);
  await page.evaluate((n) => document.querySelector(`.gw [data-action="ed-node"][data-value="${n}"]`).click(), node);
  await page.waitForFunction((n) => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === n, node);
}
// 진행 중 채팅: 메뉴의 「설정」 / 시작 전: 「새 채팅 기본 설정」(prefs-open). 열면 화면 페이지에서 시작한다
async function edOpen(page, node, { pre = false } = {}) {
  await page.click(pre ? '.gx [data-action="prefs-open"]' : '.gx-nav .gx-nb.desk[data-action="ed-open"]');
  await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
  if (node) await edGo(page, node);
}
async function edClose(page) {
  await page.click('.gw .gw-top [data-action="ed-close"]');
  await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
}
const stepShown = (page, action, key) => page.evaluate(([a, k]) => document.querySelector(`.gw [data-action="${a}"][data-value="${k}:+"]`)?.closest('.st-step')?.querySelector('b')?.textContent ?? '', [action, key]);

// 필드(게임)에서 나오기: 필드 탭 안에서는 게임 머리(닫기·시작 화면 단추)를 숨기고(style.css .gx-fieldhost .gx-game .gx-head) 게임 안 「필드 나가기」
// ·모바일 뒤로 쓸기가 같은 game-close 를 부른다(app.ts openGame 의 exit, navStep). 시험은 숨은 닫기 단추를 DOM 에서 눌러 그 길을 탄다
const FIELD = '.gx-nav .gx-nb:not(.mob)[data-value="field"]';
async function leaveField(page) {
  await page.evaluate(() => document.querySelector('.gx-game [data-action="game-close"]').click());
  await page.waitForFunction(() => !document.querySelector('.gx-game'));
}

// 1) 새 채팅: 백일몽 · English · 01 신입 OT
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.waitForSelector('.gx-fac');
  assert.equal(await page.isDisabled('.gx-start'), true, '소속 선택 전에는 시작 불가');
  if (shots) await page.screenshot({ path: `${shots}/1-empty.png` });
  // 시작 전 설정: 새 채팅 기본값 (플러그인 저장소)
  await page.click('[data-action="prefs-open"]');
  // 2026-10-27: 설정은 창 하나 (시작 전엔 새 채팅 기본값만)
  await page.waitForSelector('.gw .gw-set');
  assert.equal(await page.$('.gw-set [data-action="set-scope"][data-value="chat"]'), null, '시작 전에는 「이 채팅」 없음');
  // 2026-10-27 구조: 왼쪽 위 구역 타일(기능·세계·지침·점검) + 그 구역의 목록. 세계 목록은 「세계」 타일을 누르면 보인다
  await page.click('[data-action="ed-tab"][data-value="world"]');
  assert.ok(await page.$('[data-action="ed-node"][data-value="agent"]'), '시작 전에도 세계 편집 트리');
  await page.click('[data-action="ed-tab"][data-value="set"]');
  await page.click('[data-action="ed-node"][data-value="set:status"]');
  // 2026-10-29: 상태창 칸·배색은 「상태창」 페이지. 상태창 칸 표는 접힘(summary) 없이 「상태창 칸」 묶음 안에, 괴이 발생도 접힘 없이 묶음
  await page.waitForSelector('.st-cols .st-col-row');
  // 4단계: 상태창 칸 표 (새 채팅 기본값) — 잠긴 칸은 끌 수 없고, 끈 칸은 표시 조작이 잠긴다
  assert.equal(await page.locator('.st-col-row').count(), 10, '상태창 칸 10개');
  assert.equal(await page.isDisabled('[data-action="set-col"][data-value="date:use:0"]'), true, '날짜는 사용을 끌 수 없음');
  await page.click('[data-action="set-col"][data-value="weather:use:0"]');
  await page.waitForSelector('.st-col-row.off');
  assert.equal(await page.isDisabled('[data-action="set-col"][data-value="weather:show:1"]'), true, '안 쓰는 칸은 표시 조작 잠김');
  assert.ok((await page.textContent('.gw-set')).includes('9칸 사용'));
  await page.click('[data-action="set-col"][data-value="weather:use:1"]');
  await page.waitForFunction(() => document.querySelector('.gw-set')?.textContent?.includes('10칸 사용'));
  await page.fill('.st-won', '120만');
  await page.dispatchEvent('.st-won', 'change');
  await page.waitForFunction(() => document.querySelector('.st-won')?.value === '1,200,000');
  await page.click('[data-action="set-world"][data-value="incident_cap:+"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').world?.incident_cap === 2);
  await page.click('[data-action="ed-node"][data-value="set:screen"]');
  await page.waitForSelector('.gw-set [data-action="set-theme"]');
  await page.click('[data-action="set-theme"][data-value="dark"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').theme === 'dark');
  if (shots) await page.screenshot({ path: `${shots}/1-prefs.png` });
  await page.click('.gw [data-action="ed-close"]');
  await page.waitForSelector('.gx-fac');
  await page.click('.gx-fac[data-value="C00"]');
  await page.click('.gx-seg[data-value="en"]');
  assert.equal(await page.getAttribute('.gx-sc[data-value="2"]', 'aria-pressed'), 'true', '기본 상황 02');
  assert.equal(await page.isDisabled('.gx-sc[data-value="9"]'), false, '커스텀 임무 선택 가능');
  await page.click('.gx-sc[data-value="1"]');
  if (shots) await page.screenshot({ path: `${shots}/2-picked.png` });
  await page.click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length === 1);
  const saved = await page.evaluate(() => window.__calls.setChat[0]);
  assert.equal(saved.fmIndex, manifest.greetings['C00-en-1']);
  assert.ok(fixture.alternateGreetings[saved.fmIndex].startsWith('The tower in Gangnam'));
  assert.equal(saved.scriptstate.$st_faction, 'C00');
  assert.equal(saved.scriptstate.$st_lang, 'en');
  assert.equal(saved.scriptstate.$st_fm, '1');
  assert.equal(saved.scriptstate.$wg_incident_cap, '2', '시작 전에 고친 기본값이 채팅에 적힘');
  assert.equal(saved.scriptstate.$wg_preset_cap, '2');
  assert.equal(saved.scriptstate.$st_fixed_theme, 'dark');
  assert.equal(saved.scriptstate.$ib_affiliation, '백일몽 주식회사');
  assert.match(saved.scriptstate.$seed_lore, /^%%SEED%%/);
  // 상황판: 지침을 켜고 첫 발생을 뽑아 둔다
  assert.equal(saved.scriptstate.$st_anomaly_on, '1');
  assert.match(saved.scriptstate.$an_report, /^NEW \[AN\|/m);
  assert.match(saved.scriptstate.$ms_report, /^NEW \[MS\|/);
  assert.match(saved.scriptstate.$ag_report, /- code: P\d+ /, '백일몽 요원 명단');
  assert.ok(JSON.parse(saved.scriptstate.$goei_world).an.length >= 2);
  await page.waitForFunction(() => window.__calls.hide >= 1);
  // 시작 메시지: 자동 전송 없이 첫 장면 아래에 「적고 전송」 안내 + 재선택 (다른 글에는 안 붙음)
  assert.equal(await page.evaluate(() => (window.__calls.send ?? []).length), 0, '시작 메시지는 자동 전송 안 함');
  const fmText = fixture.alternateGreetings[saved.fmIndex];
  const hinted = await page.evaluate((t) => window.__calls.handlers.display(t), fmText);
  assert.ok(hinted.includes('data-goei-card="opening"') && hinted.includes('data-goei-repick') && hinted.includes('적고 전송'), '첫 장면 아래 안내');
  assert.ok(!(await page.evaluate(() => window.__calls.handlers.display('다른 글'))).includes('data-goei-card="opening"'), '다른 글에는 안내 없음');
  const hintVis = await page.evaluate((h) => {
    const d = document.querySelector('.default-chat-screen');
    d.innerHTML = `<div class="risu-chat" id="fm">${h}</div>`;
    const v1 = getComputedStyle(d.querySelector('[data-goei-card="opening"]')).display !== 'none';
    d.insertAdjacentHTML('afterbegin', '<div class="chat-message-container"><div class="risu-chat">첫 행동</div></div>');
    const v2 = getComputedStyle(d.querySelector('[data-goei-card="opening"]')).display !== 'none';
    d.querySelector('.chat-message-container').remove();
    return [v1, v2];
  }, hinted);
  assert.deepEqual(hintVis, [true, false], '대화가 시작되면 안내 숨김');
  if (shots) {
    await page.evaluate((h) => { const d = document.querySelector('.default-chat-screen'); d.style.background = '#2b2b33'; d.style.padding = '96px 24px 24px'; d.innerHTML = `<div class="risu-chat" style="color:#ddd;max-width:760px;margin:0 auto">…그리고 그 방 한가운데에, 극도로 기괴한 것이 존재했다.${h.slice(h.indexOf('<div data-goei-card="opening"'))}</div>`; }, hinted);
    await page.screenshot({ path: `${shots}/1-opening-hint.png`, clip: { x: 0, y: 60, width: 1100, height: 220 } });
  }
  await page.click('[data-goei-repick]');
  await page.waitForSelector('.gx-fac.on');
  await page.click('[data-action="close"]');
  await page.waitForFunction(() => window.__calls.hide >= 2);
  // 다시 열면 '첫 전송 전' 상태로 기존 선택이 복원된다
  await open(page);
  await page.waitForSelector('.gx-fac.on');
  assert.equal(await page.getAttribute('.gx-fac.on', 'data-value'), 'C00');
  assert.equal(await page.getAttribute('.gx-sc.on', 'data-value'), '1');
  // 출발 뒤 첫 전송 전에 설정에서 테마를 바꾸면 이 채팅·창에도 바로 (v0.16.7: 기본값만 바뀌어 먹통처럼 보였다)
  await page.click('[data-action="prefs-open"]');
  await page.waitForSelector('.gx-settings');
  await page.click('[data-action="set-theme"][data-value="light"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_fixed_theme === 'light' && document.querySelector('.gx').dataset.theme === 'light');
  await page.click('.gw [data-action="ed-close"]'); // 2026-10-27: 설정은 편집 창 하나, 닫기는 ed-close
  await page.waitForSelector('.gx-fac.on');
  assert.equal((await page.locator('.gx-panel').boundingBox()).width <= 1024, true, '시작 전 창은 설정 폭');
  assert.deepEqual(errors, []);
  console.log('PASS 새 채팅 시작 → 추가 인사말·채팅 변수 저장');
  await page.close();
}

// 2) 직접 입력은 빈 인사말 + 안내
{
  const { page } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.click('.gx-fac[data-value="E00"]');
  await page.click('.gx-sc[data-value="3"]');
  assert.ok((await page.textContent('.gx-note')).includes('시작할 상황'));
  await page.fill('[data-input="start-note"]', '새벽 편의점, 냉장고 안에서 노크 소리');
  await page.click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length === 1);
  const saved = await page.evaluate(() => window.__calls.setChat[0]);
  assert.equal(fixture.alternateGreetings[saved.fmIndex], '');
  assert.equal(saved.message.length, 1);
  assert.equal(saved.message[0].data, '%%GOEI_START%%\n새벽 편의점, 냉장고 안에서 노크 소리\n%%/GOEI_START%%');
  // 채팅에서는 「첫 상황」 카드, 요청에는 적은 글만
  const card = await page.evaluate((t) => window.__calls.handlers.display(t), saved.message[0].data);
  assert.ok(card.includes('data-goei-card="start"') && card.includes('첫 상황') && card.includes('냉장고 안에서') && !card.includes('%%'), card);
  const sent = await page.evaluate((t) => window.__calls.replacers[0]([{ role: 'user', content: t }], 'model'), saved.message[0].data);
  assert.equal(sent.filter((m) => m.role === 'user').at(-1).content, '새벽 편의점, 냉장고 안에서 노크 소리', '요청의 사용자 글은 적은 글만 (이미지 지침 시스템 메시지는 플러그인이 뒤에 붙인다)');
  await page.waitForFunction(() => window.__calls.send?.length === 1 && window.__calls.hide >= 1);
  console.log('PASS 직접 입력 → 빈 인사말 + 적은 상황을 바로 전송');
  await page.close();
}

// 2-1) 자동 전송이 막히면(플러그인 모델) 창은 닫고, 채팅 속 메시지에 「전송 대기」·취소. 취소하면 다시 고르기
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await page.evaluate(() => (window.__sendFail = true));
  await open(page);
  await page.click('.gx-fac[data-value="E00"]');
  await page.click('.gx-sc[data-value="3"]');
  // 직접 입력은 상황을 적어야 출발
  assert.equal(await page.isDisabled('.gx-start'), true, '빈 상황이면 출발 불가');
  await page.fill('[data-input="start-note"]', '시작');
  assert.equal(await page.isDisabled('.gx-start'), false);
  await page.click('.gx-start');
  await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
  await page.waitForFunction(() => window.__chat.message.length === 1 && window.__chat.message[0].data.includes('%%GOEI_UNSENT%%'));
  const html = await page.evaluate(() => window.__calls.handlers.display(window.__chat.message[0].data));
  assert.ok(html.includes('data-goei-card="start"') && html.includes('data-goei-cancel') && html.includes('전송 대기') && !html.includes('%%'), html);
  // 요청에는 표식이 가지 않는다
  const req = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: window.__chat.message[0].data }], 'model'));
  assert.equal(req.filter((m) => m.role === 'user').at(-1).content, '시작');
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'msg'; d.innerHTML = h; document.querySelector('.default-chat-screen').appendChild(d); }, html);
  // 요청 대기 표시를 끈다 (위 replacers 호출이 켠 것)
  await page.evaluate(async () => { const c = window.__chat; await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify({ ...c, message: [] })), characterIndex: 0, chatIndex: 0, messageIndex: -1 }); });
  if (shots) await page.screenshot({ path: `${shots}/2-start-card-unsent.png` });
  await page.click('#msg [data-goei-cancel]');
  await page.waitForFunction(() => window.__chat.message.length === 0);
  await open(page);
  await page.waitForSelector('.gx-start');
  assert.deepEqual(errors, []);
  console.log('PASS 자동 전송 실패 → 창 닫고 전송 대기·취소 → 다시 고르기');
  await page.close();
}

// 3) 진행 중인 채팅은 요약만, 저장 없음
{
  const { page } = await boot(fixture, { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } });
  await open(page);
  await page.waitForSelector('.gx-nb');
  assert.equal(await page.locator('[data-value="info"]').count(), 0, '시작 정보 탭 없음');
  const text = await page.textContent('.gx-nav-brand');
  assert.ok(text.includes('관리국') && !text.includes('코드네임'), '소속은 왼쪽 위 칸에, 첫 장면 선택은 시작 뒤엔 안 보임');
  {
    // 가짜 관리국을 고른 사람에게는 그냥 관리국 + 간이 상태창
    const b = await boot(fixture, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|성자의 도시]' }], scriptstate: { $st_faction: 'B00', $st_lang: 'ko', $st_fm: '1' } });
    await open(b.page);
    await b.page.waitForSelector('.gx-nav-brand');
    const t = await b.page.textContent('.gx-nav-brand');
    assert.ok(t.includes('관리국') && !t.includes('가짜'), `B00 본인 시점 이름: ${t}`);
    assert.ok(t.includes('관리국 본부') && t.includes('4°C') && t.includes('성자의 도시'), `간이 상태창: ${t}`);
    // 창 바깥을 누르면 닫힘
    const before = await b.page.evaluate(() => window.__calls.hide);
    await b.page.mouse.click(3, 3);
    assert.equal(await b.page.evaluate(() => window.__calls.hide), before + 1, '바깥 클릭으로 닫기');
    await b.page.close();
  }
  assert.equal(await page.locator('[data-action="start"]').count(), 0, '진행 중이면 출발 버튼 없음');
  if (shots) await page.screenshot({ path: `${shots}/3-started.png` });
  console.log('PASS 진행 중 채팅 → 요약만 표시');
  await page.close();
}

// 4) Lite가 아닌 캐릭터: 버튼, 효과, 창, 경고 모두 없음
{
  const { page, errors } = await boot({ name: '다른 봇', alternateGreetings: [], globalLore: [] }, { message: [] });
  await page.waitForTimeout(2500);
  assert.equal(await page.evaluate(() => { const f = document.querySelector('[x-goei-fab]'); return f ? getComputedStyle(f).display : 'none'; }), 'none');
  assert.equal(await page.locator('[x-goei-intro="true"]').count(), 0);
  await page.mouse.click(1100 - 16 - 24, 900 - 96 - 24); // 버튼 기본 자리
  await page.click('#other');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__calls.show.length), 0);
  assert.equal(await page.$('.gx-panel'), null);
  // 5단계(2026-10-27): 다른 봇에는 햄버거 메뉴의 「설치·점검」 단추 하나만 (본체는 꺼내지 않음)
  const btn = await page.evaluate(() => window.__button);
  assert.equal(btn?.arg?.id, 'goei-plugin-install', '설치·점검 단추만');
  assert.equal(btn?.arg?.location, 'hamburger');
  assert.deepEqual(errors, []);
  console.log('PASS 다른 봇 → 설치 단추 말고는 아무것도 표시하지 않음');
  await page.close();
}

// 5) 시드 수명: beforeRequest 리플레이서
{
  const { page } = await boot(fixture, { message: [{ role: 'user', data: 'a' }], scriptstate: {} });
  const msgs = [{ role: 'system', content: 'x %%SEED%%\nS\n%%/SEED%%\ny' }];
  const first = await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs);
  assert.equal(first[0].content, 'x S\ny');
  const sub = await page.evaluate((m) => window.__calls.replacers[0](m, 'submodel'), msgs);
  assert.equal(sub[0].content, msgs[0].content, '보조 모델 요청은 건드리지 않음');
  await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: 'b' }, { role: 'user', data: 'c' }); });
  const second = await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), msgs);
  assert.equal(second[0].content, 'x y');
  assert.equal(await page.evaluate(() => window.__calls.setChat.length), 0, '요청 중에는 저장하지 않음');
  console.log('PASS 시드: 첫 전송 유지, 두 번째 전송부터 제거');
  await page.close();
}

// 5-1) 본편 로어북 고르기: 보낼 때 채팅 변수에 넣고, 요청 직전에 다시 골라 맞춘다 (카드에 자리 항목이 있을 때)
if (fixture.globalLore.some((e) => String(e.comment).startsWith('📚Lore slot'))) {
  const { page, errors } = await boot(fixture, { message: [{ role: 'char', data: '조용한 밤이다.' }], scriptstate: { $st_faction: 'A00' } });
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 6000 });
  const out = await page.evaluate(() => window.__calls.handlers.input('차여진이 웃었다. 극단적인 소리였다.'));
  assert.equal(out, '차여진이 웃었다. 극단적인 소리였다.', '보낼 글은 그대로');
  const ss = await page.evaluate(() => window.__chat.scriptstate);
  assert.ok(ss.$goei_lore_agent.includes('Cha Yeo-jin') || ss.$goei_lore_agent.length > 100, '요원 자리에 차여진');
  assert.equal(ss.$goei_lore_org, '', '「극단적」으로 세력 극단이 켜지지 않음');
  assert.ok(!ss.$goei_lore_agent.includes('@@dont_activate'));
  // 다시 굴리기: 입력을 거치지 않고 채팅이 바뀌었으면 요청 속 글을 바꾼다
  const before = ss.$goei_lore_agent;
  await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '차여진이 웃었다. 극단적인 소리였다.' }, { role: 'char', data: '…' }, { role: 'user', data: '아무도 없다.' }); });
  const req = [{ role: 'system', content: `앞\n\n${before}\n\n뒤` }, { role: 'user', content: '아무도 없다.' }];
  const sent = await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), req);
  assert.equal(sent[0].content.includes(before), true, '검색 깊이 안이면 그대로');
  await page.evaluate(() => { window.__chat.message = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: '아무도 없다.' })); });
  const sent2 = await page.evaluate((m) => window.__calls.replacers[0](m, 'model'), req);
  assert.equal(sent2[0].content, '앞\n\n\n\n뒤', '깊이 밖으로 밀리면 뺀다');
  // 보내는 방식 「Risu가 직접」: 카드 로어북의 @@dont_activate 줄을 떼고 자리를 비운다. 되돌리면 다시 붙인다
  const lore = (name) => page.evaluate((n) => window.__char.globalLore.find((e) => e.comment === n).content, name);
  await page.evaluate(() => { window.__chat.scriptstate.$gen_lore_mode = 'risu'; });
  await page.evaluate(() => window.__calls.handlers.input('차여진이 웃었다.'));
  assert.ok(!(await lore('차여진')).startsWith('@@dont_activate'), 'Risu가 직접: 줄을 뗌');
  assert.equal(await page.evaluate(() => window.__chat.scriptstate.$goei_lore_agent), '', 'Risu가 직접: 자리 비움');
  await page.evaluate(() => { window.__chat.scriptstate.$gen_lore_mode = ''; });
  await page.evaluate(() => window.__calls.handlers.input('차여진이 웃었다.'));
  assert.ok((await lore('차여진')).startsWith('@@dont_activate\n'), '플러그인이 고름: 다시 붙임');
  assert.deepEqual(errors, []);
  console.log('PASS 본편 로어북: 보낼 때 고르기, 요청 직전 맞추기');
  await page.close();
}

// 6) 모바일 화면
{
  const { page } = await boot(fixture, { message: [], scriptstate: {} }, { width: 390, height: 844 });
  await open(page);
  await page.click('.gx-fac[data-value="A00"]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false, '가로 스크롤 없음');
  if (shots) await page.screenshot({ path: `${shots}/4-mobile.png`, fullPage: true });
  console.log('PASS 모바일 폭 390px 레이아웃');
  await page.close();
}

// 7) 플로팅 버튼: Lite 채팅 화면에서만, 들어올 때마다 접속 효과, 버튼 영역 클릭만 반응
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await page.waitForSelector('[x-goei-fab][x-goei-intro="true"]', { timeout: 3000 });
  if (shots) { await page.waitForTimeout(900); await page.screenshot({ path: `${shots}/5-intro.png` }); }
  await page.waitForSelector('[x-goei-fab][x-goei-intro="true"]', { state: 'detached', timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block');
  // 화면의 다른 곳을 눌러도 열리지 않는다 (Risu는 리스너를 문서 전체에 건다)
  await page.click('#other');
  await page.mouse.click(300, 600);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__calls.show.length), 0, '다른 곳 클릭으로 열리면 안 됨');
  if (shots) await page.screenshot({ path: `${shots}/6-fab.png` });
  await page.click('[x-goei-fab] button');
  await page.waitForFunction(() => window.__calls.show.length === 1);
  await page.evaluate(() => { { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; } });
  // 설정 화면으로 가면(채팅 화면 사라짐) 숨김, 돌아오면 효과와 함께 다시 표시
  await page.evaluate(() => { window.__screen = document.querySelector('.default-chat-screen'); window.__screen.remove(); });
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'none', null, { timeout: 3000 });
  await page.evaluate(() => { document.body.prepend(window.__screen); });
  await page.waitForSelector('[x-goei-fab][x-goei-intro="true"]', { timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 6000 });
  // 다른 봇으로 가면 숨김, 돌아오면 다시 효과
  await page.evaluate(() => { window.__char = { name: '다른 봇', globalLore: [] }; window.risuai.getCurrentCharacterIndex = async () => 1; });
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'none', null, { timeout: 3000 });
  await page.evaluate(() => { window.__char = window.__liteChar; window.risuai.getCurrentCharacterIndex = async () => 0; });
  await page.waitForSelector('[x-goei-fab][x-goei-intro="true"]', { timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 6000 });
  assert.deepEqual(errors, []);
  console.log('PASS 플로팅 버튼: Lite 채팅 화면에서만, 들어올 때마다 효과, 버튼 클릭만 반응');

  // 끌어서 옮기기: 열리지 않고, 위치가 저장된다
  const box0 = await page.locator('[x-goei-fab] button').boundingBox();
  const cx = box0.x + box0.width / 2, cy = box0.y + box0.height / 2;
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(300); // 마우스오버 효과(살짝 커짐)가 끝난 뒤 크기로 비교
  const box = await page.locator('[x-goei-fab] button').boundingBox();
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(cx - i * 20, cy - i * 15); await page.waitForTimeout(30); }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const moved = await page.locator('[x-goei-fab] button').boundingBox();
  assert.ok(Math.abs(moved.x - (box.x - 200)) <= 4 && Math.abs(moved.y - (box.y - 150)) <= 4, `moved to ${moved.x},${moved.y}`);
  assert.equal(await page.evaluate(() => window.__calls.show.length), 1, '끌기 후 창이 열리면 안 됨');
  const savedPos = JSON.parse(await page.evaluate(() => window.__store['goei-plugin:fab-pos']));
  assert.deepEqual(savedPos, { right: 216, bottom: 246 });
  // 옮긴 자리에서 클릭하면 열림
  await page.waitForTimeout(450);
  await page.click('[x-goei-fab] button');
  await page.waitForFunction(() => window.__calls.show.length === 2);
  console.log('PASS 플로팅 버튼 끌어서 옮기기 + 위치 저장');

  // 손을 떼는 이벤트를 놓치거나(pointercancel) 끊겨도 버튼이 굳지 않는다
  const b2 = await page.locator('[x-goei-fab] button').boundingBox();
  const bx = b2.x + 24, by = b2.y + 24;
  await page.evaluate(([x, y]) => {
    const fire = (type, o) => document.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, ...o }));
    fire('pointerdown', { button: 0, buttons: 1 });
    fire('pointermove', { clientX: x - 40, buttons: 1 });
    fire('pointercancel', {});
  }, [bx, by]);
  await page.waitForTimeout(300);
  await page.evaluate(([x, y]) => {
    document.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: x - 30, clientY: y, buttons: 0, bubbles: true }));
  }, [bx - 40, by]);
  await page.waitForTimeout(300);
  await page.click('[x-goei-fab] button');
  await page.waitForFunction(() => window.__calls.show.length === 3, null, { timeout: 3000 });
  await page.evaluate(() => { { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; } });
  const b3 = await page.locator('[x-goei-fab] button').boundingBox();
  await page.mouse.move(b3.x + 24, b3.y + 24); await page.mouse.down();
  for (let i = 1; i <= 5; i++) { await page.mouse.move(b3.x + 24 + i * 10, b3.y + 24); await page.waitForTimeout(30); }
  await page.mouse.up(); await page.waitForTimeout(400);
  const b4 = await page.locator('[x-goei-fab] button').boundingBox();
  assert.ok(Math.abs(b4.x - (b3.x + 50)) <= 4, `drag after cancel: ${b3.x} -> ${b4.x}`);
  assert.equal(await page.evaluate(() => window.__calls.show.length), 3);
  console.log('PASS 끌기 도중 끊겨도 버튼이 굳지 않음');
  await page.close();
}


// 9) 상황판: 응답 태그 반영 → 저장 본문 정리 → 상황판 탭 표시, 다른 봇에서는 무시
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.waitForSelector('.gx-fac');
  await page.click('.gx-fac[data-value="A00"]');
  await page.click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length === 1);
  const world = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_world));
  const preset = world.an.find((e) => e.kind === 'preset');
  // 첫 응답 전 상황판: 안내 줄 + 칸 배치가 응답 뒤와 같아야
  if (shots) {
    await page.evaluate(() => { window.__chat.message.push({ role: 'user', data: '출동' }); const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
    await open(page);
    await page.waitForSelector('.gx-board');
    await page.screenshot({ path: `${shots}/9-board-pending.png` });
    assert.ok((await page.textContent(".gx-id")).includes("첫 응답 뒤에"));
    assert.equal(await page.locator(".gx-board > .gx-hint").count(), 0);
    await page.evaluate(() => { window.__chat.message.pop(); const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  }

  const sido = { '02': '서울특별시', '03': '인천광역시', '04': '대전광역시', '05': '대구광역시', '06': '광주광역시', '07': '부산광역시', '08': '울산광역시', '09': '경기도', '10': '경기도', '11': '강원특별자치도', '12': '충청북도', '13': '충청남도', '14': '전북특별자치도', '15': '전라남도', '16': '경상북도', '17': '경상남도', '18': '제주특별자치도' };
  const geo = JSON.parse(readFileSync(new URL('../src/data/geo.json', import.meta.url), 'utf8'));
  const [code, idx] = preset.loc.split('-');
  const where = `${sido[code]} ${geo.sigun[code][Number(idx)]}`;
  const reply = [
    '쟈알디가 무전기를 들었다.',
    `[AN|${where}|${preset.name} 입구|활성|B|P001]`,
    '[AG|P001|작전투입|현장 지휘] {0시간 3분 전}',
    '[AG|P002|부상|병원 이송]',
    '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]',
  ].join('\n');
  await page.evaluate((reply) => {
    window.__chat.message.push({ role: 'user', data: '출동' }, { role: 'char', data: reply });
  }, reply);
  // 응답이 들어온 직후 화면 표시: 태그 숨김
  const shown = await page.evaluate((reply) => window.__calls.handlers.display(reply), reply);
  assert.ok(!shown.includes('[AN|') && !shown.includes('[AG|') && !shown.includes('[▣|') && shown.includes('data-goei-status'), shown);
  assert.ok(shown.includes('data-goei-user') && shown.includes('{{source::user}}'), '이 봇 채팅엔 유저 사진 숨은 칸');
  await page.evaluate(async () => {
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  const after = await page.evaluate(() => window.__chat);
  assert.equal(after.message[1].data, '쟈알디가 무전기를 들었다.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]');
  assert.match(after.scriptstate.$an_report, new RegExp(`\\[AN\\|${where}\\|${preset.name}\\|활성\\|B\\|P001\\|<상황>\\] \\{0시간 0분 전\\}`));
  assert.match(after.scriptstate.$ag_report, /\[AG\|P001\|작전투입\|현장 지휘\]/);
  // 같은 응답에 다시 불려도 그대로
  const before = after.scriptstate.$goei_world;
  await page.evaluate(async () => {
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  assert.equal(await page.evaluate(() => window.__chat.scriptstate.$goei_world), before);
  // 상황판 탭
  await page.evaluate(() => { { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; } });
  await open(page);
  await page.waitForSelector('.gx-board');
  const board = await page.textContent('.gx-panel');
  assert.ok(board.includes(preset.name) && board.includes('쟈알디') && board.includes('작전') && board.includes('2025.01.01 02:47'), board);
  if (shots) { await page.screenshot({ path: `${shots}/9-board.png` }); await page.evaluate(() => { const b = document.querySelector(".gx-body"); b.scrollTop = b.scrollHeight; }); await page.screenshot({ path: `${shots}/9-board-agents.png` }); }
  if (shots) {
    await page.setViewportSize({ width: 1600, height: Number(process.env.VH || 1200) });
    await page.evaluate(() => { document.querySelector('.gx-body').scrollTop = 0; });
    await page.screenshot({ path: `${shots}/9-board-wide.png` });
    await page.click('.gx-mswap[data-value="mission"]');
    await pickCustom(page);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/9-mission-wide.png` });
    for (const t of ['board', 'map', 'phone', 'wiki', 'settings']) {
      await page.click(`.gx-nav .gx-nb:not(.mob)[data-value="${t}"]`); await page.waitForTimeout(150);
      await page.screenshot({ path: `${shots}/9-tab-${t}.png` });
    }
    await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
    await page.waitForSelector('.gx-board');
  }
  // PC 왼쪽 메뉴: 보고 있는 탭을 한 번 더 누르면 상황판으로
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="map"]');
  await page.waitForSelector('.gx-map');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="map"]');
  await page.waitForSelector('.gx-board');
  await page.setViewportSize({ width: 390, height: 844 });
  if (shots) { await page.screenshot({ path: `${shots}/9-board-mobile.png` }); await page.evaluate(() => { const b = document.querySelector(".gx-body"); b.scrollTop = b.scrollHeight; }); await page.screenshot({ path: `${shots}/9-board-mobile-agents.png` }); }
  await page.setViewportSize({ width: 1280, height: 860 });
  // 위성 지도를 보던 중 일지 줄을 고르면 지도 그대로, 표적만 그 상황으로
  if (await page.locator('.gx-oplog li.gx-oprow').count() > 1) {
    await page.click('.gx-oplog .gx-hseg [data-value="map"]');
    await page.waitForSelector('.gx-opview.map');
    await page.click('.gx-oplog li.gx-oprow >> nth=1');
    await page.waitForSelector('.gx-oplog li.gx-oprow.sel >> nth=0');
    assert.equal(await page.locator('.gx-opview.map').count(), 1, '일지 줄을 골라도 위성 화면 유지');
    await page.click('.gx-oplog .gx-hseg [data-value="feed"]');
  }
  // 상황판 요원 칸(모니터): 마우스를 올리면 머리 위 말풍선, 누르면 사원증 창. 톡·위키는 사원증 창에서
  const agentTile = page.locator('.gx-board .gx-agmon', { hasText: '쟈알디' });
  await agentTile.hover();
  await page.waitForSelector('.gx-agtip');
  const tipBox = await page.$eval('.gx-agtip', (el) => el.getBoundingClientRect().bottom);
  const tileTop = (await agentTile.boundingBox()).y;
  assert.ok(tipBox <= tileTop, '말풍선은 칸 위');
  await agentTile.click();
  await page.waitForSelector('.gx-agcard');
  assert.ok((await page.textContent('.gx-agcard')).includes('쟈알디'));
  await page.click('.gx-agcard-x');
  assert.equal(await page.locator('.gx-agcard').count(), 0);
  await agentTile.click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.gx-agcard').count(), 0, 'Esc로 닫기');
  assert.ok(await page.locator('.gx-panel').count(), 'Esc는 창이 아니라 사원증만 닫는다');
  await agentTile.click();
  await page.click('.gx-agcard [data-action="agent-talk"]');
  await page.waitForSelector('.ph-room');
  assert.ok((await page.textContent('.ph-room')).includes('쟈알디'));
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  assert.equal(await page.locator('.gx-agcard').count(), 0, '다른 탭에 갔다 오면 사원증은 닫힘');
  // 제목줄 아이콘으로 목록 ↔ 모니터 (설정과 같은 값)
  await page.click('#gx-sec-ag .gx-hseg [data-value="list"]');
  await page.waitForSelector('.gx-board .gx-agrow');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').agents === 'list');
  await page.click('#gx-sec-ag .gx-hseg [data-value="wall"]');
  await page.waitForSelector('.gx-board .gx-agmon');
  await agentTile.click();
  await page.click('.gx-agcard [data-action="wiki-goto"]');
  await page.waitForSelector('.nw-compose, .nw-doc');
  assert.ok((await page.textContent('.gx-panel')).includes('쟈알디'));
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  await page.setViewportSize({ width: 390, height: 844 });
  // 상황판 행 → 임무(지도) 탭의 그 자리
  await page.setViewportSize({ width: 1280, height: 860 });
  // 상황판 → 임무 지도의 그 자리 (단추는 2026-10-21에 뺐지만 이동 동작은 남아 있다)
  await page.evaluate((name) => { const li = [...document.querySelectorAll('.gx-board li.gx-oprow')].find((e) => e.textContent.includes(name)); const b = document.createElement('button'); b.dataset.action = 'board-map'; b.dataset.value = li.dataset.value; document.querySelector('.gx-panel').appendChild(b); b.click(); }, preset.name);
  await page.waitForSelector('.gx-map .gx-placecard');
  assert.ok((await page.textContent('.gx-map .gx-sits')).includes(preset.name));
  if (shots) {
    await page.screenshot({ path: `${shots}/9-map-from-board.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${shots}/9-map-mobile-goal.png` });
    await page.click('[data-action="field-step"][data-value="team"]');
    await page.screenshot({ path: `${shots}/9-map-mobile-team.png` });
    await page.click('[data-action="field-step"][data-value="goal"]');
  }
  await page.setViewportSize({ width: 1280, height: 860 });
  // 취소: 장소를 고르면 켜지고, 누르면 장소와 목표가 함께 풀린다
  await cardAction(page, preset.name, 'pick-event', '.gx-map');
  await page.waitForFunction(() => !document.querySelector('.gx-team .gx-goal b')?.classList.contains('none'));
  assert.equal(await page.locator('.gx-map .gx-unplace:not([disabled])').count(), 1, '고르면 취소가 켜짐');
  await page.click('.gx-map .gx-unplace');
  await page.waitForFunction(() => document.querySelector('.gx-team .gx-goal b')?.classList.contains('none'));
  assert.equal(await page.locator('.gx-map .gx-placecard').count(), 0, '취소하면 장소도 풀림');
  assert.equal(await page.locator('.gx-map .gx-unplace[disabled]').count(), 1, '고른 것이 없으면 취소는 꺼짐');
  // PC: 고른 상황을 한 번 더 누르면 풀린다
  await cardAction(page, preset.name, 'pick-event', '.gx-map');
  await page.waitForFunction(() => !document.querySelector('.gx-team .gx-goal b')?.classList.contains('none'));
  await cardAction(page, preset.name, 'pick-event', '.gx-map');
  await page.waitForFunction(() => document.querySelector('.gx-team .gx-goal b')?.classList.contains('none'));
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  console.log('PASS 상황판 요원 카드에서 괴담톡·위키 바로 열기');
  // 다른 봇: 리스너·표시 모두 무시
  await page.evaluate(() => { window.__char = { name: '다른 봇', globalLore: [] }; window.risuai.getCurrentCharacterIndex = async () => 1; });
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'none', null, { timeout: 3000 });
  const other = '[AN|서울특별시 종로구|x|활성|B|없음]';
  assert.equal(await page.evaluate((t) => window.__calls.handlers.display(t), other), other);
  const n = await page.evaluate(() => window.__calls.setChat.length);
  await page.evaluate(async (t) => {
    await window.__calls.listeners[0]({ char: { name: '다른 봇', globalLore: [] }, chat: { message: [{ role: 'char', data: t }], scriptstate: { $st_anomaly_on: '1' } }, characterIndex: 1, chatIndex: 0, messageIndex: 0 });
  }, other);
  assert.equal(await page.evaluate(() => window.__calls.setChat.length), n, '다른 봇 채팅은 건드리지 않음');
  assert.deepEqual(errors, []);
  console.log('PASS 상황판: 태그 반영·본문 정리·탭 표시, 다른 봇 무시');
  await page.close();
}

// 9-3) 상태창: 플러그인이 그리고(요일·공휴일·지난 장면), 말풍선·위키 이름·설정 배색
{
  const tags = ['[▣|2025.10.04|09:10 PM|☀️|14°C|관리국 본부|없음]', '[▣|2025.10.05|11:40 PM|🌫️|-3°C|서울 명일 아파트 정문 앞|명일 아파트 조사 마무리]'];
  const chat = { message: [{ role: 'user', data: '시작' }, { role: 'char', data: `첫 장면.\n${tags[0]}` }, { role: 'user', data: '출동' }, { role: 'char', data: `둘째 장면.\n${tags[1]}` }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } };
  for (const [vp, name] of [[{ width: 1100, height: 700 }, 'pc'], [{ width: 360, height: 740 }, 'm']]) {
    const { page, errors } = await boot(fixture, chat, vp);
    await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 6000 });
    // 채팅을 열 때 지난 장면 목록을 모은다
    await page.waitForTimeout(400);
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), chat.message[3].data);
    assert.ok(html.includes('data-goei-status') && !html.includes('[▣'), html);
    assert.ok(html.includes('어제 오후 9:10') && html.includes('1일 2시간 30분') && html.includes('2일째'), '지난 장면·흐른 시간·며칠째');
    assert.ok(html.includes('gst-date hol') && html.includes('추석') && html.includes('음력'), '공휴일(일요일 추석)');
    assert.ok(/data-goei-wiki="1">명일 아파트</.test(html), '위키 이름만 밑줄');
    // Risu는 채팅 메시지 속 class마다 x-risu-를 붙인다 (parser.svelte.ts DOMPurify 훅). 그대로 흉내 낸다
    const risu = (h) => h.replace(/class="([^"]*)"/g, (_, v) => `class="${v.split(' ').map((c) => (c.startsWith('x-risu-') || c.startsWith('hljs') ? c : `x-risu-${c}`)).join(' ')}"`);
    // 가장 최근 메시지의 상태창만 (Risu는 최신 메시지가 맨 앞). 지우면 남은 것 중 최근 것이 보인다
    const older = await page.evaluate((t) => window.__calls.handlers.display(t), chat.message[1].data);
    const shown = await page.evaluate(([a, b]) => {
      const d = document.querySelector('.default-chat-screen');
      d.innerHTML = `<div class="flex flex-col-reverse"><div class="chat-message-container" id="c3"><div class="risu-chat">출동</div></div><div class="chat-message-container" id="c2"><div class="risu-chat">${a}</div></div><div class="chat-message-container" id="c1"><div class="risu-chat">${b}</div></div></div><div class="risu-chat" id="fm">${b}</div>`;
      const vis = () => [...d.querySelectorAll('.x-risu-gst')].map((g) => getComputedStyle(g).display !== 'none');
      const before = vis();
      d.querySelector('#c2').remove();
      return [before, vis()];
    }, [risu(html), risu(older)]);
    assert.deepEqual(shown, [[true, false, false], [true, false]], '최근 상태창만: ' + JSON.stringify(shown));
    await page.evaluate((h) => { const d = document.querySelector('.default-chat-screen'); d.style.background = '#2b2b33'; d.style.padding = '96px 24px 24px'; d.innerHTML = `<div id="msg" style="color:#ddd;max-width:760px;margin:0 auto">둘째 장면.${h}</div>`; }, risu(html));
    if (shots) await page.screenshot({ path: `${shots}/9-status-${name}.png` });
    // 요일 배지를 누르면 말풍선, 바깥을 누르면 닫힘
    await page.click('#msg .x-risu-gst-wd');
    await page.waitForFunction(() => document.querySelector('#msg .x-risu-gst-wd').classList.contains('open'));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#msg .x-risu-gst-wd .x-risu-gst-tip')).visibility), 'visible');
    if (shots) { await new Promise((r) => setTimeout(r, 250)); await page.screenshot({ path: `${shots}/9-status-tip-${name}.png` }); }
    await page.click('#msg .x-risu-gst-clock');
    await page.waitForFunction(() => document.querySelector('#msg .x-risu-gst-clock').classList.contains('open') && !document.querySelector('#msg .x-risu-gst-wd').classList.contains('open'));
    if (shots) { await new Promise((r) => setTimeout(r, 250)); await page.screenshot({ path: `${shots}/9-status-clock-${name}.png` }); }
    await page.mouse.click(5, vp.height - 5);
    await page.waitForFunction(() => !document.querySelector('#msg .x-risu-gst-clock').classList.contains('open'));
    // 한 줄 머리: 시각·날짜·날씨가 줄바꿈 없이
    const topH = await page.evaluate(() => document.querySelector('#msg .x-risu-gst-top').getBoundingClientRect().height);
    assert.ok(topH < 42, `머리 한 줄 (${topH})`);
    if (name === 'pc') {
      // 위키 이름을 누르면 창이 그 위키 문서로
      await page.click('#msg .x-risu-gst-link');
      await page.waitForSelector('.gx-nb.on[data-value="wiki"], .nw-doc, .nw-write', { timeout: 15000 });
      // 설정 「상태창」: 페이퍼 → 그린 상자도 바로 바뀜, 미표시 → 숨김
      await page.click('.gx-nav .gx-nb.desk[data-action="ed-open"]');
      await edGo(page, 'set:status');
      await page.click('[data-action="set-status"][data-value="paper"]');
      await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').status === 'paper');
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#msg .x-risu-gst')).backgroundColor), 'rgb(250, 245, 233)');
      if (shots) await page.screenshot({ path: `${shots}/9-status-settings.png` });
      await page.click('[data-action="set-status"][data-value="off"]');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gst')).display === 'none');
      await page.click('[data-action="set-status"][data-value="auto"]');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gst')).backgroundColor === 'rgb(35, 45, 50)');
      // 캐릭터 이미지 태그: 플러그인이 그림 칸으로, 설정 「이미지 크기」·「접힌 높이」 막대가 바로 반영, 에셋 출력 OFF면 숨김
      const img = await page.evaluate(() => window.__calls.handlers.display('앞.<img=Jyaldi_smile>뒤'));
      assert.ok(img.includes('class="gim"') && img.includes('{{raw::Jyaldi_smile}}') && !img.includes('<img='), img);
      await page.evaluate((h) => document.querySelector('#msg').insertAdjacentHTML('beforeend', h), risu(img));
      const box = () => page.evaluate(() => { const c = getComputedStyle(document.querySelector('#msg .x-risu-gim')); return [c.display, c.maxWidth, c.aspectRatio]; });
      assert.deepEqual((await box()).slice(1), ['512px', '832 / 826.88']);
      await page.click('[data-action="ed-node"][data-value="set:image"]'); // 2026-10-27: 이미지 설정은 「캐릭터 이미지」 페이지
      await page.waitForSelector('[data-change="set-img-size"]');
      await page.$eval('[data-change="set-img-size"]', (el) => { el.value = '150'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gim')).maxWidth === '768px');
      await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').imgSize === 150);
      await page.$eval('[data-change="set-img-fold"]', (el) => { el.value = '40'; el.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gim')).aspectRatio === '832 / 486.4');
      if (shots) { await page.$eval('[data-change="set-img-fold"]', (el) => el.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${shots}/9-img-settings.png` }); }
      // 표시 범위·요청 속 태그: 최근만(기본 6개) ↔ 전부, 개수 막대
      await page.click('[data-action="set-img-show-mode"][data-value="all"]');
      await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').imgShow === 0);
      assert.ok(!(await page.evaluate(() => window.__calls.handlers.display('<img=Jyaldi_smile>'))).includes('{{#when'), '전부면 조건 없음');
      await page.$eval('[data-change="set-img-send"]', (el) => { el.value = '3'; el.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').imgSend === 3);
      if (shots) { await page.$eval('[data-change="set-img-send"]', (el) => el.scrollIntoView({ block: 'center' })); await page.screenshot({ path: `${shots}/9-img-recent.png` }); }
      await page.click('[data-action="set-img-show-mode"][data-value="recent"]');
      await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').imgShow === undefined);
      await page.click('[data-action="set-asset"][data-value="0"]');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gim')).display === 'none');
      await page.click('[data-action="set-asset"][data-value="1"]');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gim')).display === 'block');
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS 상태창: 플러그인 그리기·요일·공휴일·지난 장면·말풍선·위키 이름·배색 설정 + 이미지 칸 설정');
}

// 10) 상황판 없이 시작한 채팅에서 켜기
{
  const { page, errors } = await boot(fixture, { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'D00', $st_lang: 'ko', $st_fm: '1', $st_anomaly_on: '0' } });
  await open(page);
  await page.waitForSelector('[data-action="world-on"]');
  await page.click('[data-action="world-on"]');
  await page.waitForSelector('.gx-board');
  const ss = await page.evaluate(() => window.__chat.scriptstate);
  assert.equal(ss.$st_anomaly_on, '1');
  assert.match(ss.$an_report, /NEW \[AN\|/);
  assert.deepEqual(errors, []);
  console.log('PASS 이전 채팅에서 상황판 켜기');
  await page.close();
}


/** 관리국으로 시작하고 응답 한 번을 반영한 채팅 (괴이 하나 활성, P001 작전투입) */
async function startedWithReply(page, { phoneAuto = false } = {}) {
  await open(page);
  await page.waitForSelector('.gx-fac');
  await page.click('.gx-fac[data-value="A00"]');
  await page.click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length === 1);
  const world = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_world));
  const preset = world.an.find((e) => e.kind === 'preset');
  const geo = JSON.parse(readFileSync(new URL('../src/data/geo.json', import.meta.url), 'utf8'));
  const [code, idx] = preset.loc.split('-');
  const where = `${geo.sido[code]} ${geo.sigun[code][Number(idx)]}`;
  const reply = [`본문`, `[AN|${where}|${preset.name}|활성|A|P001]`, '[AG|P001|작전투입|현장]', '[AG|P002|휴게|사무실]', '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]'].join('\n');
  await page.evaluate(async ({ reply, phoneAuto }) => {
    // 괴담톡 자동 확인은 이 테스트(15)에서만 켠다 (다른 테스트의 모델 호출 순서를 지키려고)
    if (!phoneAuto) window.__chat.scriptstate.$ph_auto = '0';
    window.__chat.message.push({ role: 'user', data: '시작' }, { role: 'char', data: reply });
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
    const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
  }, { reply, phoneAuto });
  return { preset, where, code };
}

// 11) 지도: 상황 선택 → 편성 → 출발 카드, 장소 선택, 상황 종료, 요청 합치기
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  const { preset, where, code } = await startedWithReply(page);
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="map"]');
  await page.waitForSelector('.gx-canvas');
  await page.waitForFunction(() => document.querySelector('.gx-mapimg')?.naturalWidth > 0, null, { timeout: 5000 });
  assert.equal(await page.locator('.gx-pin.nation').count(), 17);
  assert.equal(await page.locator('.gx-pin.nation.hot').count() >= 1, true);
  if (shots) await page.screenshot({ path: `${shots}/11-map-nation.png` });
  // 상황 선택: 그 시도 지도로 바뀌고 목표가 채워진다
  await cardAction(page, preset.name, 'pick-event', '.gx-map');
  await page.waitForFunction((c) => document.querySelector('.gx-select')?.value === c, code);
  assert.equal(await page.textContent('.gx-goal b'), preset.name);
  await page.waitForFunction(() => document.querySelector('.gx-mapimg')?.naturalWidth > 0, null, { timeout: 5000 });
  // 작전투입 요원은 잠김, 휴게 요원과 아직 상태가 없는 요원은 편성 가능
  assert.equal(await page.isDisabled('.gx-acard.pick[data-value="P001"]'), true);
  assert.equal(await page.isDisabled('.gx-acard.pick[data-value="P003"]'), false);
  await page.click('.gx-acard.pick[data-value="P002"]');
  const agentName = (await page.textContent('.gx-acard.pick[data-value="P002"] b')).trim();
  await page.click('.gx-step[data-value="1"]');
  assert.equal((await page.textContent('.gx-goal em')).trim(), '3 / 4');
  if (shots) await page.screenshot({ path: `${shots}/11-map-region.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '모바일 가로 스크롤 없음');
  if (shots) await page.screenshot({ path: `${shots}/11-map-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1100, height: 900 });
  const before = await page.evaluate(() => window.__chat.message.length);
  await page.fill('[data-input="field-note"]', '조용히 진입한다');
  await page.click('[data-action="depart"]');
  await page.waitForFunction((n) => window.__chat.message.length === n + 1, before);
  const rec = await page.evaluate(() => window.__chat.message.at(-1));
  assert.ok(rec.data.endsWith('%%/SCENE_CARD%%\n\n조용히 진입한다'), '추가 요청은 카드 뒤에');
  await page.waitForFunction(() => window.__calls.send?.length === 1);
  assert.ok((await page.evaluate(() => window.__calls.send[0])).last.endsWith('조용히 진입한다'), '놓은 뒤 바로 전송');
  assert.equal(rec.role, 'user');
  assert.match(rec.data, /^%%SCENE_CARD:[0-9a-f]+%%\n/);
  assert.ok(rec.data.includes(`Subject: ${where} ${preset.name}`), rec.data);
  assert.ok(rec.data.includes(`Companions: ${agentName} and one support person`), rec.data);
  assert.ok(rec.data.includes('Continue naturally'), '진행 중 채팅은 CONTINUATION');
  await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
  // 화면: 카드만, 요청: 표식 제거 + 덧붙인 글 합치기
  const card = await page.evaluate((t) => window.__calls.handlers.display(t), rec.data);
  assert.ok(card.includes('목표') && card.includes(preset.name) && card.includes(`나, ${agentName}, 지원 ×1`) && !card.includes('Subject:') && card.includes('조용히 진입한다'), card);
  // 다른 채팅에 갔다 와서 Lite 판정 전에 다시 그려도 카드로 (v0.16.7: 원문이 드러났다)
  const raw = await page.evaluate(() => window.__calls.handlers.display('%%SCENE_CARD:7b22746172676574223a2261222c227061727479223a22eb8298227d%%\nUse it\n%%/SCENE_CARD%%'));
  assert.ok(!raw.includes('SCENE_CARD') && !raw.includes('Use it'), raw);
  const req = await page.evaluate((t) => window.__calls.replacers[0]([{ role: 'system', content: 's' }, { role: 'user', content: t }], 'model'), rec.data);
  // 2026-10-27 부터 플러그인이 로어북 덩어리·이미지 지침(system)을 끼우므로 사용자 메시지만 본다
  const users = (r) => r.filter((m) => m.role === 'user');
  assert.equal(users(req).length, 1);
  assert.ok(!users(req)[0].content.includes('SCENE_CARD') && users(req)[0].content.endsWith('Situation:\n조용히 진입한다'), users(req)[0].content);
  const req2 = await page.evaluate((t) => window.__calls.replacers[0]([{ role: 'user', content: t }, { role: 'user', content: '그리고 문을 연다' }], 'model'), rec.data);
  assert.equal(users(req2).length, 1);
  assert.ok(users(req2)[0].content.endsWith('Situation:\n조용히 진입한다\n\n그리고 문을 연다'), users(req2)[0].content);
  // 장소 자체 선택: 아직 안 보낸 카드는 바꿔 끼운다
  await open(page);
  await page.waitForSelector('.gx-canvas');
  await page.selectOption('.gx-select', '02');
  await page.click('.gx-pin[data-value="02-0"]');
  // 핀을 누른 뒤 목표 글이 다시 그려질 때까지 (2026-10-29: 느린 컨테이너에서 「미정」을 먼저 읽는 경쟁)
  await page.waitForFunction(() => document.querySelector('.gx-goal b')?.textContent.trim() !== '미정');
  const goal = (await page.textContent('.gx-goal b')).trim();
  assert.ok(goal.startsWith('서울특별시'), goal);
  await page.click('[data-action="depart"]');
  await page.waitForFunction((n) => window.__chat.message.length === n + 1 && window.__chat.message.at(-1).data.includes('Subject: 서울특별시'), before);
  assert.ok((await page.evaluate(() => window.__chat.message.at(-1).data)).includes('Companions: No additional companions'));
  // 자동 전송이 막히면: 창은 닫고, 채팅 속 카드에 「전송 버튼」 안내와 취소. 취소를 누르면 그 메시지를 지운다
  {
    // 위에서 요청 처리(replacer)를 불러 「응답 기다리는 중」이 켜져 있다. 응답이 붙은 것처럼 끈다 (기다리는 중에는 취소가 안 된다)
    await page.evaluate(async () => {
      const c = window.__chat;
      const at = c.message.map((m) => m.role).lastIndexOf('char');
      await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: at });
      document.querySelector('.gx').style.display = 'none';
    });
    const n0 = await page.evaluate(() => window.__chat.message.length);
    await page.evaluate(() => (window.__sendFail = true));
    await open(page);
    await page.waitForSelector('.gx-canvas');
    await page.selectOption('.gx-select', '02');
    await page.click('.gx-pin[data-value="02-1"]');
    await page.click('[data-action="depart"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
    await page.waitForFunction(() => window.__chat.message.at(-1).data.startsWith('%%SCENE_CARD:'));
    const last = await page.evaluate(() => window.__chat.message.at(-1).data);
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), last);
    assert.ok(html.includes('data-goei-cancel') && html.includes('전송 대기'), html);
    assert.equal(await page.locator('.gx-err, .gx-notice').count(), 0, '창 안내 없음');
    await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'msg'; d.innerHTML = h; document.querySelector('.default-chat-screen').appendChild(d); }, html);
    await page.click('#msg [data-goei-cancel]');
    await page.waitForFunction((n) => window.__chat.message.length === n - 1, n0);
    await page.evaluate(() => { document.getElementById('msg').remove(); window.__sendFail = false; });
  }
  // 상황 종료: 두 번 눌러 확인
  await open(page);
  await page.waitForSelector('.gx-evc, .gx-oprow');
  await cardAction(page, preset.name, 'end-event');
  const endBtn = (await page.locator('.ev-pop').count()) ? '.ev-pop [data-action="end-event"]' : '.gx-opview [data-action="end-event"]';
  assert.equal(await page.getAttribute(endBtn, 'aria-label'), `${preset.name} 정말 종료`);
  await page.click(endBtn);
  await page.waitForFunction((name) => !JSON.parse(window.__chat.scriptstate.$goei_world).an.some((e) => e.name === name), preset.name);
  assert.ok(!(await page.evaluate(() => window.__chat.scriptstate.$an_report)).includes(`${preset.name}|활성`));
  // 손으로 끝낸 상황도 일지 한 줄 + 보고서 (core/journal, 채팅 변수 $goei_journal·$goei_reports).
  // 이 괴이로 가는 출동 카드는 위에서 장소 카드로 바꿔 끼워졌고 상태창 목표도 아니었으니 「내가 출동」 근거가 없다 → 간이 보고서
  {
    const ss = await page.evaluate(() => window.__chat.scriptstate);
    const row = JSON.parse(ss.$goei_journal).rows.find((r) => r.name === preset.name);
    assert.ok(row, '일지 줄');
    assert.equal(row.cause, 'manual');
    assert.equal(row.kind, 'an');
    assert.equal(row.mine, false, '출동 근거 없음');
    assert.deepEqual(row.agents.map((a) => a.id), ['P001']);
    const rpt = JSON.parse(ss.$goei_reports).items.find((r) => r.id === row.rpt);
    assert.ok(rpt && rpt.full === false && !rpt.people, '간이 보고서');
    assert.ok(!ss.$goei_world.includes('"closed"'), '세계 저장값에 closed 없음');
  }
  assert.deepEqual(errors, []);
  console.log('PASS 지도: 상황·장소 선택, 편성, 출발 카드, 요청 합치기, 상황 종료');
  await page.close();
}

// 12) 커스텀 임무로 시작: 빈 인사말 → 목표 고르기 → 첫 장면 지시문, 진행 중 채팅의 커스텀 임무 요청
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.click('.gx-fac[data-value="A00"]');
  await page.click('.gx-sc[data-value="9"]');
  await page.click('.gx-start');
  await page.waitForSelector('.gx-search');
  const saved = await page.evaluate(() => window.__chat);
  assert.equal(fixture.alternateGreetings[saved.fmIndex], '', '빈 첫 장면');
  assert.equal(saved.message.length, 0);
  assert.equal(await page.isDisabled('[data-action="mission-send"]'), true);
  // 검색은 괴이·특수·거점을 한꺼번에: 괴이 칸에서 거점 이름을 찾아도 나온다
  await page.click('[data-action="mission-kind"][data-value="lm"]');
  const lmName = (await page.textContent('.gx-mlist li.gx-ev b')).trim();
  await page.click('[data-action="mission-kind"][data-value="an"]');
  await page.fill('.gx-search', lmName);
  await page.waitForFunction(() => [...document.querySelectorAll('.gx-mlist li.gx-mgrp')].some((h) => h.textContent.startsWith('거점')));
  await page.fill('.gx-search', '소라');
  await page.waitForFunction(() => document.querySelector('.gx-mlist li.gx-mgrp')?.textContent.startsWith('괴이'));
  await pickCustom(page);
  // 위 종류 버튼을 바꿔 봐도 고른 목표는 그대로
  await page.click('[data-action="mission-kind"][data-value="lm"]');
  assert.equal((await page.textContent('.gx-goal b')).trim(), '소라 랜드');
  assert.equal(await page.isDisabled('[data-action="mission-send"]'), false);
  assert.equal((await page.textContent('[data-action="mission-send"]')).trim(), '작전 개시');
  if (shots) await page.screenshot({ path: `${shots}/12-mission-opening.png` });
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction(() => window.__chat.message.length === 1);
  const chat = await page.evaluate(() => window.__chat);
  assert.ok(chat.message[0].data.includes('Create an opening') && chat.message[0].data.includes('Subject: 소라 랜드'), chat.message[0].data);
  const w = JSON.parse(chat.scriptstate.$goei_world);
  assert.equal(w.pending.an, '소라 랜드');
  assert.match(chat.scriptstate.$an_report, /NEW \[AN\|<발생 지역: 시도와 시군구>\|소라 랜드\|활성/);
  // 보내기 전(지시문만 놓임)에는 다시 열면 고르기 화면: 다른 대상으로 바꾸면 지시문·요청이 새 것으로
  await page.evaluate(() => { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await page.waitForSelector('.gx-search');
  assert.equal(await page.locator('.gx-nav').count(), 0, '아직 플레이 화면 아님');
  await page.click('[data-action="mission-kind"][data-value="ms"]');
  await pickCustom(page);
  const site0 = (await page.textContent('.gx-goal b')).trim();
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction((n) => window.__chat.message.length === 1 && window.__chat.message[0].data.includes(n), site0);
  {
    const w2 = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_world));
    assert.equal(w2.pending.an, undefined, '바꾼 뒤 예전 요청은 취소');
    assert.equal(w2.pending.ms, site0);
  }
  // 일반 첫 장면으로 다시 고르면 지시문은 지워진다
  await page.evaluate(() => { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await page.waitForSelector('[data-action="repick"]');
  await page.click('[data-action="repick"]');
  await page.waitForSelector('.gx-fac.on');
  await page.click('.gx-sc[data-value="1"]');
  await page.click('.gx-start');
  await page.waitForFunction(() => window.__chat.message.length === 0 && window.__chat.scriptstate.$st_fm === '1');
  // 다시 커스텀 임무로 (아래 시험을 이어가려고)
  await page.evaluate(() => { const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await page.waitForSelector('.gx-sc');
  await page.click('.gx-sc[data-value="9"]');
  await page.click('.gx-start');
  await page.waitForSelector('.gx-search');
  await page.fill('.gx-search', '소라');
  await page.waitForFunction(() => document.querySelector('.gx-mlist li.gx-mgrp')?.textContent.startsWith('괴이'));
  await pickCustom(page);
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction(() => window.__chat.message.length === 1 && window.__chat.message[0].data.includes('소라 랜드'));
  // 첫 전송은 시드를 유지 (지시문 + 덧붙인 글 = 한 번)
  await page.evaluate(() => window.__chat.message.push({ role: 'user', data: '더' }));
  const seeded = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'system', content: 'x %%SEED%%\nS\n%%/SEED%%\ny' }], 'model'));
  assert.equal(seeded[0].content, 'x S\ny');
  // 진행 중 채팅: 커스텀 임무 탭에서 미스틱 사이트 요청
  await page.evaluate(() => { window.__chat.message.push({ role: 'char', data: '응답' }); const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  await page.click('.gx-mswap[data-value="mission"]');
  await page.click('[data-action="mission-kind"][data-value="ms"]');
  await pickCustom(page);
  const site = (await page.textContent('.gx-goal b')).trim();
  // 다른 탭에 다녀와도 고른 목표 유지
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="wiki"]');
  await page.click('.gx-mswap[data-value="mission"]');
  assert.equal((await page.textContent('.gx-goal b')).trim(), site, '탭 이동 뒤에도 목표 유지');
  if (shots) await page.screenshot({ path: `${shots}/12-mission-tab.png` });
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction(() => window.__chat.message.length === 4);
  const after = await page.evaluate(() => window.__chat);
  assert.ok(after.message[3].data.includes('Continue naturally') && after.message[3].data.includes(site));
  assert.equal(JSON.parse(after.scriptstate.$goei_world).pending.ms, site);
  // 요청 취소
  await open(page);
  // 이미 커스텀 탭이면 다시 누르지 않는다 (한 번 더 누르면 상황판으로 간다)
  if (!(await page.$('.gx-mission'))) await page.click('.gx-mswap[data-value="mission"]');
  await page.click('[data-action="mission-cancel"][data-value="ms"]');
  await page.waitForFunction(() => !JSON.parse(window.__chat.scriptstate.$goei_world).pending.ms);
  // 목록의 「위키」: 위키 탭의 그 제목으로
  await page.click('.gx-mlist li:first-child [data-action="wiki-goto"]');
  await page.waitForSelector('.nw-compose, .nw-dochead'); // 카드 기본 문서가 있으면 바로 문서, 없으면 작성 화면
  assert.equal((await page.textContent('.gx-nb.on:not(.mob)')).trim(), '위키');
  assert.equal((await page.textContent('.nw-title')).trim(), site);
  assert.deepEqual(errors, []);
  console.log('PASS 커스텀 임무: 시작 첫 장면 지시문, 진행 중 요청, 요청 취소');
  await page.close();
}

// 13a) 위키: 카드에 압축해 넣은 기본 문서는 창을 열 때 풀려서 검색하면 바로 문서가 열린다
const packed = (e) => String(e.content ?? '').startsWith('GOEIWIKI1:');
if (fixture.globalLore.some(packed)) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  {
    await open(page);
    await page.click('.gx-nav .gx-nb:not(.mob)[data-value="wiki"]');
    await page.waitForSelector('.nw-rail');
    await page.click('.nw-grab');
    await page.fill('.nw .ph-search', '소라 랜드');
    await page.press('.nw .ph-search', 'Enter');
    await page.waitForSelector('.nw-dochead');
    assert.equal((await page.textContent('.nw-title')).trim(), '소라 랜드');
    assert.ok(await page.locator('.nw-body .nw-fn').count() >= 8, '각주');
    const under = await page.evaluate(() => {
      const ib = document.querySelector('.nw-infobox')?.getBoundingClientRect();
      return ib ? [...document.querySelectorAll('.nw-h, .nw-quote')].filter((h) => { const r = h.getBoundingClientRect(); return r.top < ib.bottom && r.bottom > ib.top && r.right > ib.left + 1; }).length : 0;
    });
    assert.equal(under, 0, '제목 줄·인용 상자가 정보표 밑으로 들어가지 않음');
    assert.equal(await page.evaluate(() => (window.__calls.llm || []).length), 0, '기본 문서는 생성하지 않음');
    if (shots) { await page.waitForTimeout(800); await page.screenshot({ path: `${shots}/13-wiki-base.png`, fullPage: true }); }
    // 각주: 마우스를 올리면 내용 창, 누르면 아래 목록으로
    await page.hover('.nw-body .nw-fn[data-fn="2"]');
    await page.waitForSelector('.nw-fnpop:not([hidden])');
    const note2 = (await page.textContent('.nw-notes li[data-fn="2"]')).trim();
    assert.ok((await page.textContent('.nw-fnpop')).includes(note2.slice(0, 20)));
    if (shots) await page.screenshot({ path: `${shots}/13-wiki-fn-hover.png` });
    await page.click('.nw-body .nw-fn[data-fn="2"]');
    await page.waitForSelector('.nw-notes li[data-fn="2"].hit');
    await page.waitForTimeout(700);
    const seen = await page.evaluate(() => {
      const li = document.querySelector('.nw-notes li[data-fn="2"]').getBoundingClientRect();
      const doc = document.querySelector('.nw-doc').getBoundingClientRect();
      return li.top >= doc.top && li.bottom <= doc.bottom;
    });
    assert.ok(seen, '누르면 각주 목록이 보이게 내려감');
  }
  assert.deepEqual(errors, []);
  await page.close();
  // 터치 화면: 누르면 내용 창만, 내려가지 않음
  {
    const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, { width: 390, height: 844 }, { touch: true });
    const scrollTop = () => page.evaluate(() => document.querySelector('.nw-doc').scrollTop);
    await startedWithReply(page);
    await open(page);
    await page.locator(':is([data-action="tab"], [data-action="nav-tab"])[data-value="wiki"]:visible').first().click();
    await page.waitForSelector('.nw-home');
    // 창이 늦게 한 번 더 그려지면(사용자 사진 읽기 등) 입력이 사라질 수 있어 문서가 뜰 때까지 다시 친다
    for (let i = 0; i < 3 && !(await page.locator('.nw-dochead').count()); i++) {
      await page.fill('.nw-home .gx-search', '소라 랜드');
      await page.press('.nw-home .gx-search', 'Enter');
      await page.waitForSelector('.nw-dochead', { timeout: 4000 }).catch(() => {});
    }
    await page.waitForSelector('.nw-dochead');
    await page.locator('.nw-body .nw-fn[data-fn="1"]').scrollIntoViewIfNeeded();
    const top0 = await scrollTop();
    await page.tap('.nw-body .nw-fn[data-fn="1"]');
    await page.waitForSelector('.nw-fnpop:not([hidden])');
    await page.waitForTimeout(500);
    const top1 = await scrollTop();
    assert.equal(top1, top0, '터치는 내려가지 않음');
    if (shots) await page.screenshot({ path: `${shots}/13-wiki-fn-touch.png` });
    await page.tap('.nw-body .nw-fn[data-fn="1"]');
    await page.waitForSelector('.nw-fnpop[hidden]', { state: 'attached' });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS 위키 카드 기본 문서, 각주 창');
}

// 13) 위키: 검색 → 작성 화면 → 생성·저장 → 링크 → 실패 시 기존 문서 유지 → 삭제 (기본 문서가 없는 카드로)
{
  const { page, errors } = await boot({ ...fixture, globalLore: fixture.globalLore.filter((e) => !packed(e)) }, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const article = (title, extra = '') => `<lightboard-namuwiki doc_title="${title}" doc_type="other" main_color="#27685b" asset_src="" related1="소라 랜드 괴담" recent1="쟈알디">
[Infobox]Title:${title}|위치:서울|상태:❗폐장❗
[Toc]
[Heading]Level:1|Title:개요
[Paragraph]${title}은 폐장한 놀이공원이다. ➡️소라 랜드 괴담➡️이 유명하다.📌출처 불명.📌 ${extra}
[Heading]Level:1|Title:목격담
[List]관람차가 혼자 돈다
[Quote]돌아가|Source:경비원
</lightboard-namuwiki>`;
  await page.evaluate((a) => { window.__llm = [{ type: 'success', result: a }]; }, article('아무 제목'));
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="wiki"]');
  await page.waitForSelector('.nw-rail');
  assert.equal(await page.locator('.gx-panel form').count(), 0, 'form을 쓰지 않음');
  // 첫 화면은 위키 메인, 목록은 접혀 있다가 세로바를 누르면 펼쳐진다
  await page.waitForSelector('.nw-home .nw-hero');
  assert.equal(await page.locator('.nw-app.list-open').count(), 0);
  // 메인 검색칸도 입력하는 대로 결과가 바뀌고, 띄어쓰기가 다른 제목은 「비슷한 문서」로 제안한 뒤 새로 작성 줄
  await page.fill('.nw-hero-q .gx-search', '소라랜드');
  await page.waitForSelector('.nw-hero-res .ph-sec');
  {
    const t = await page.textContent('.nw-hero-res');
    assert.ok(t.includes('비슷한 문서') && t.includes('소라 랜드'), t);
    assert.equal(await page.locator('.nw-hero-res .nw-newrow').count(), 1, '새로 작성 줄');
    assert.equal(await page.locator('.nw-hero-res .nw-nohit').count(), 0, '바로 「없어요」로 가지 않음');
  }
  if (shots) await page.screenshot({ path: `${shots}/13-hero-search.png` });
  await page.fill('.nw-hero-q .gx-search', '');
  assert.equal(await page.locator('.nw-hero-res .ph-sec').count(), 0);
  await page.click('.nw-grab');
  await page.waitForSelector('.nw-app.list-open');
  await page.fill('.nw .ph-search', '소라');
  await page.waitForSelector('.nw .ph-content .ph-sec');
  assert.ok((await page.textContent('.nw .ph-content')).includes('소라 랜드'), '입력하는 동안 명부 전체에서 걸러 보인다');
  await page.fill('.nw .ph-search', 'Sora Land');
  await page.press('.nw .ph-search', 'Enter');
  await page.waitForSelector('.nw-compose');
  assert.equal((await page.textContent('.nw-title')).trim(), '소라 랜드', '별칭이 정식 이름으로');
  assert.ok((await page.textContent('.nw-compose')).includes('같은 이름의 로어북이 있어요'));
  assert.equal(await page.evaluate(() => (window.__calls.llm || []).length), 0, '여는 것만으로는 생성하지 않음');
  await page.fill('[data-input="wiki-docreq"]', '폐장 이유 위주로');
  await page.click('[data-action="wiki-start"]');
  await page.waitForSelector('.nw-busy');
  await page.waitForSelector('.nw-doc', { timeout: 5000 });
  const call = await page.evaluate(() => window.__calls.llm[0]);
  assert.equal(call.mode, 'model');
  assert.equal(call.allowPlugins, true, '플러그인 제공 모델도 쓸 수 있게');
  assert.equal(call.messages.length, 2);
  assert.ok(call.messages[1].content.startsWith('문서 제목: 소라 랜드\n\n[참고 자료]'), call.messages[1].content.slice(0, 200));
  assert.ok(call.messages[1].content.includes('[주제 원본: 소라 랜드]'));
  assert.ok(call.messages[1].content.endsWith('이 문서만, 공통 지침과 부딪치면 이쪽을 우선]\n폐장 이유 위주로'), '이 문서 지침');
  const lore = await page.evaluate(() => window.__chat.localLore);
  assert.equal(lore.length, 1);
  assert.equal(lore[0].comment, 'WIKI｜소라 랜드');
  assert.ok(lore[0].content.includes('doc_title="소라 랜드"'), '제목 고정');
  assert.ok((await page.textContent('.nw-body')).includes('폐장한 놀이공원'));
  assert.equal(await page.locator('.nw-infobox').count(), 1);
  if (shots) { await page.waitForTimeout(800); await page.screenshot({ path: `${shots}/13-wiki-doc.png` }); }
  // 문서 안 링크: 없는 문서 → 작성 화면 (부모 원본 자료를 물려받음)
  await page.click('.nw-body .nw-link');
  await page.waitForSelector('.nw-compose');
  assert.equal((await page.textContent('.nw-title')).trim(), '소라 랜드 괴담');
  assert.ok((await page.textContent('.nw-compose')).includes('원본 자료(소라 랜드)'));
  await page.click('[data-action="wiki-back"]');
  await page.waitForSelector('.nw-doc');
  // 새로고침 실패: 기존 문서 유지, 원문 보관
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '형식이 틀린 응답' }]; });
  await page.click('.nw-pane .ph-room-head [data-action="wiki-rewrite"]');
  await page.waitForSelector('.nw-rewrite');
  assert.equal(await page.inputValue('.nw-rewrite [data-input="wiki-docreq"]'), '폐장 이유 위주로', '지난 지침을 채워 둔다');
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-rewrite.png` });
  await page.fill('.nw-rewrite [data-input="wiki-docreq"]', '목격담 추가');
  await page.click('[data-action="wiki-rw-go"]');
  await page.waitForSelector('.gx-err', { timeout: 5000 });
  assert.ok((await page.textContent('.gx-err')).includes('기존 문서는 그대로'));
  assert.ok((await page.textContent('.nw-fail')).includes('최근 실패 원문'));
  assert.ok((await page.evaluate(() => window.__chat.localLore[0].content)).includes('폐장한 놀이공원'));
  const prev = await page.evaluate(() => window.__calls.llm[1].messages[1].content);
  assert.ok(prev.includes('[이전 위키'), '다시 쓰기는 이전 문서를 넘긴다');
  assert.ok(prev.endsWith('\n목격담 추가'), '다시 쓰기 지침');
  // 목록, 설정, 작성 지침, 삭제
  // 설정은 따로 (괴담톡·괴담넷처럼), 「기본값으로 저장」은 플러그인 저장소에
  await page.click('[data-action="wiki-settings"]');
  await page.waitForSelector('.nw-setpane');
  await page.click('[data-action="wiki-length"][data-value="short"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_length === 'short');
  await page.fill('.nw-reqbox', '목격담 위주로');
  await page.dispatchEvent('.nw-reqbox', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_writing_request === '목격담 위주로');
  // 「덮어쓰기」「불러오기」: 메인 설정처럼 한 번 더 확인 (v0.16.26)
  await page.click('[data-action="wiki-def-ask"][data-value="save"]');
  await page.waitForSelector('.ps-defconfirm');
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-settings-confirm.png` });
  await page.click('[data-action="wiki-def-yes"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').vars?.$nw_length === 'short');
  await page.waitForSelector('.gx-toast');
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-settings.png` });
  await page.click('[data-action="wiki-length"][data-value="detailed"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_length === 'detailed');
  await page.click('[data-action="wiki-def-ask"][data-value="load"]');
  await page.click('[data-action="wiki-def-yes"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_length === 'short');
  assert.equal(await page.locator('.ps-defconfirm').count(), 0);
  await page.click('[data-action="wiki-settings"]');
  // 위키 메인: 최근 문서 카드, 아직 없는 링크는 작성이 필요한 문서로
  await page.click('.nw-rail [data-action="wiki-home"]');
  await page.waitForSelector('.nw-home .nw-card');
  assert.equal(await page.locator('[data-action="wiki-random"]').count(), 0);
  assert.ok((await page.textContent('.nw-home')).includes('이번 이야기에서 쓴 문서'));
  assert.ok(await page.locator('.nw-tile[data-value="an"]').count(), '분류 칸');
  assert.ok((await page.textContent('.nw-hero h2')).includes('괴이위키'));
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-main.png` });
  await page.click('.nw-card[data-value="소라 랜드"]');
  await page.waitForSelector('.nw-doc');
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-wide.png` });
  // 세로바를 옆으로 끌면 목록이 본문 위로 펼쳐진다 (본문 칸 너비는 그대로)
  const paneW = await page.evaluate(() => document.querySelector('.nw-main').getBoundingClientRect().width);
  const g = await page.locator('.nw-grab').boundingBox();
  await page.mouse.move(g.x + 10, g.y + 100);
  await page.mouse.down();
  await page.mouse.move(g.x + 120, g.y + 100, { steps: 4 });
  await page.mouse.up();
  await page.waitForSelector('.nw-app.list-open');
  assert.equal(await page.evaluate(() => document.querySelector('.nw-main').getBoundingClientRect().width), paneW);
  await page.fill('.nw .ph-search', '');
  await page.dispatchEvent('.nw .ph-search', 'input');
  await page.waitForSelector('.nw .nw-list .nw-ksec');
  assert.equal((await page.textContent('.nw-ksec')).replace(/\d+/g, ''), 'ㅅ');
  await page.waitForTimeout(300);
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-home.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-list-mobile.png` });
  await page.click('.nw-scrim', { position: { x: 20, y: 400 } }); // 목록은 오른쪽에서 열린다
  await page.waitForSelector('.nw-app:not(.list-open)');
  await page.waitForTimeout(300);
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-mobile.png` });
  // 모바일: 세로바 없이 하단 서랍에 메인·목록·설정
  assert.equal(await page.locator('.nw-rail').isVisible(), false);
  if (!(await page.locator('.nw-app > .ph-drawer.open').count())) await page.click('.nw-app > .ph-drawer .ph-grip');
  await page.click('.ph-drawer [data-action="wiki-home"]');
  await page.waitForSelector('.nw-home');
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-main-mobile.png` });
  // 검색과 작성은 하나: 결과가 없으면 「작성하기」
  await page.click('.ph-drawer [data-action="wiki-list"]');
  await page.waitForSelector('.nw-app.list-open');
  await page.fill('.nw .ph-search', '아무도모르는괴담');
  await page.waitForSelector('.nw-nohit');
  if (shots) await page.screenshot({ path: `${shots}/13-wiki-nohit-mobile.png` });
  await page.fill('.nw .ph-search', '');
  // 모바일: 오른쪽에서 열린 목록을 오른쪽으로 밀면 접힘
  await page.evaluate(() => {
    const el = document.querySelector('.nw-list');
    const t = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })];
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: t(200), changedTouches: t(200) }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: t(340) }));
  });
  await page.waitForSelector('.nw-app:not(.list-open)');
  // 모바일 앞뒤로 쓸기 (브라우저 ←·→ 처럼): 오른쪽 = 뒤로, 왼쪽 = 앞으로. 탭을 오가도 그대로 돌아간다
  const swipe = (sel, dir) => page.evaluate(([sel, dir]) => {
    const el = document.querySelector(sel);
    const x0 = dir > 0 ? 120 : 300;
    const t = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })];
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: t(x0), changedTouches: t(x0) }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: t(x0 + dir * 40), changedTouches: t(x0 + dir * 40) }));
    el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: t(x0 + dir * 140), changedTouches: t(x0 + dir * 140) }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: t(x0 + dir * 140) }));
  }, [sel, dir]);
  const swipeRight = (sel) => swipe(sel, 1);
  const swipeLeft = (sel) => swipe(sel, -1);
  await page.click('.nw-card[data-value="소라 랜드"]');
  await page.waitForSelector('.nw-pane .nw-title');
  await swipeRight('.nw-main');
  await page.waitForSelector('.nw-home');
  await swipeLeft('.nw-main');
  await page.waitForSelector('.nw-pane .nw-title');
  await page.click('.gx-mbar .gx-nb[data-value="board"]');
  await page.waitForSelector('.gx-board');
  await swipeRight('.gx-board');
  await page.waitForSelector('.nw-pane .nw-title');
  await swipeLeft('.nw-main');
  await page.waitForSelector('.gx-board');
  await swipeRight('.gx-board');
  await page.waitForSelector('.nw-pane .nw-title');
  await swipeRight('.nw-main');
  await page.waitForSelector('.nw-home');
  // 상황판 카드의 위키 단추로 문서를 연 뒤 뒤로 쓸면 상황판으로 (위키 메인이 아니라)
  await page.click('.gx-mbar .gx-nb[data-value="board"]');
  await page.waitForSelector('.gx-board');
  await page.click('.gx-board [data-action="wiki-goto"]');
  await page.waitForSelector('.nw-pane .nw-title, .nw-compose');
  await swipeRight('.nw-main');
  await page.waitForSelector('.gx-board');
  await page.click('.gx-mbar .gx-nb[data-value="wiki"]');
  await page.waitForSelector('.nw-main');
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.click('.nw-rail [data-action="wiki-home"]');
  await page.waitForSelector('.nw-home');
  await page.click('.nw-card[data-value="소라 랜드"]');
  await page.click('.nw-pane [data-action="wiki-delete"][data-value="소라 랜드"]');
  await page.click('.nw-pane [data-action="wiki-delete"][data-value="소라 랜드"]');
  await page.waitForFunction(() => window.__chat.localLore.length === 0);
  assert.deepEqual(errors, []);
  console.log('PASS 위키: 검색·작성 화면·생성 저장·링크 상속·실패 시 유지·설정·삭제');
  await page.close();
}


// 14) 괴담넷: 새로고침 → 글 열기 → 댓글(먼저 저장) + 반응·선쪽지 → 쪽지 답장 → 글쓰기 → 본편 반영 → 삭제
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const B = 1846000;
  const board = { posts: [
    { author: 'abc92', id: B + 2, title: '소라 랜드 관람차 혼자 돎', time: '02:30', date: '2025.01.01 02:30', views: 4237, upvotes: 113, content: '어제 봤음\n진짜임', mine: false,
      comments: [{ author: 'ㅇㅇ(118.235)', content: '사진 없으면 구라', parent: 0, mine: false }, { author: 'abc92', content: '찍으려다 폰 꺼짐', parent: 1, mine: false }] },
    { author: '아직안잠', id: B + 1, title: '야간 편의점 고양이', time: '02:20', date: '2025.01.01 02:20', views: 941, upvotes: 27, content: '오늘도 출근함', mine: false, comments: [] },
  ], incoming: [] };
  await page.evaluate((b) => { window.__llm = [{ type: 'success', result: '```json\n' + JSON.stringify(b) + '\n```' }]; }, board);
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="gnet"]');
  await page.waitForSelector('.gn');
  assert.ok((await page.textContent('.gn')).includes('게시글이 없어요'));
  await page.click('[data-action="gn-refresh"]');
  await page.waitForSelector('.nw-busy');
  await page.waitForSelector('.gn-row-main', { timeout: 5000 });
  const call = await page.evaluate(() => window.__calls.llm[0]);
  assert.equal(call.mode, 'submodel', '기본은 보조 모델');
  assert.ok(call.messages[1].content.startsWith('[참고 자료 — 작중 인물에게 자동 공개되지 않음]'));
  assert.ok(!call.messages[0].content.includes('{{'));
  assert.equal(await page.locator('.gn-row').count(), 2);
  await page.click('.gn-row-main[data-value="' + (B + 2) + '"]');
  await page.waitForSelector('.gn-post');
  assert.equal(await page.locator('.gn-c').count(), 2);
  if (shots) await page.screenshot({ path: `${shots}/14-gnet-post.png` });
  // 답글: 내 댓글은 먼저 저장, 반응과 선쪽지는 같은 응답으로
  await page.click('[data-action="gn-reply"][data-value="' + (B + 2) + ':2"]');
  // 답글 입력줄은 그 댓글 바로 밑에 열리고, 아래 댓글 입력줄은 숨는다
  assert.equal(await page.locator('.gn-c-compose [data-input="gn-draft"]').count(), 1);
  assert.equal(await page.locator('[data-input="gn-draft"]').count(), 1);
  if (shots) await page.screenshot({ path: `${shots}/14-gnet-reply.png` });
  await page.fill('[data-input="gn-draft"]', '그 폰 나도 꺼졌음');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ comments: [{ author: 'abc92', content: '헐 너도?', parent: 3 }, { author: '익명', content: '엉뚱', parent: 1 }], incoming: [{ nick: '관람차덕후', body: '혹시 몇 시쯤이었음?' }], activity: [{ id: 1846001, viewsDelta: 5 }] }) }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => /C\|1846002\|2\|익명\|그 폰 나도 꺼졌음\|1/.test(window.__chat.scriptstate.$gn_raw || ''));
  await page.waitForFunction(() => window.__calls.llm.length === 2 && !document.querySelector('.nw-busy'), null, { timeout: 5000 });
  const raw = await page.evaluate(() => window.__chat.scriptstate.$gn_raw);
  assert.ok(raw.includes('C|1846002|3|abc92|헐 너도?|0|0'), '내 댓글 아래 답글');
  assert.ok(!raw.includes('엉뚱'), '대상 밖 답글은 뺌');
  assert.ok(raw.includes('D|관람차덕후|npc|혹시 몇 시쯤이었음?|1|'), '선쪽지');
  assert.ok(raw.includes('P|1846001|2025.01.01 02:20|아직안잠|야간 편의점 고양이|946|'), '다른 글 조회 증가');
  const c2 = await page.evaluate(() => window.__calls.llm[1].messages[1].content);
  assert.ok(c2.includes('"replyTo":3') && c2.includes('"incomingAllowed":true'));
  assert.ok((await page.textContent('[data-value="dm"]')).includes('1'), '쪽지함 알림');
  // 글 하나만 새로고침: 그 글에 새 댓글, 조회 증가, 다른 글은 그대로 (v0.16.26)
  const views0 = Number(/P\|1846002\|[^|]*\|[^|]*\|[^|]*\|(\d+)/.exec(raw)[1]);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ comments: [{ author: '지나가던사람', content: '이 글 아직 살아있네', parent: 0 }, { author: '익명', content: '주인공 흉내', parent: 0 }], activity: [] }) }]; });
  await page.click('.gn-pane [data-action="gn-post-refresh"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$gn_raw || '').includes('이 글 아직 살아있네'), null, { timeout: 5000 });
  const raw2 = await page.evaluate(() => window.__chat.scriptstate.$gn_raw);
  assert.ok(!raw2.includes('주인공 흉내'), '주인공 닉네임 댓글은 뺌');
  assert.ok(Number(/P\|1846002\|[^|]*\|[^|]*\|[^|]*\|(\d+)/.exec(raw2)[1]) > views0, '조회 증가');
  assert.ok((await page.evaluate(() => window.__calls.llm[2].messages.at(-1).content)).includes('Time has passed'));
  // 쪽지 답장 (형식이 틀리면 한 번 다시 묻는다)
  await page.click('[data-action="gn-sub"][data-value="dm"]');
  await page.click('[data-action="gn-open-dm"][data-value="관람차덕후"]');
  await page.waitForFunction(() => !/D\|관람차덕후\|npc\|[^|]*\|1/.test(window.__chat.scriptstate.$gn_raw), null, { timeout: 3000 });
  // 답장을 못 받으면 보낸 쪽지는 지우고 쓴 내용을 입력칸에 돌려놓는다 (v0.16.26)
  await page.fill('[data-input="gn-draft"]', '새벽 2시쯤');
  await page.evaluate(() => { window.__llm = [{ type: 'fail', result: 'Failed to fetch' }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => document.querySelector('[data-input="gn-draft"]')?.value === '새벽 2시쯤' && !document.querySelector('.nw-busy'), null, { timeout: 5000 });
  assert.ok(!/D\|관람차덕후\|me\|새벽 2시쯤/.test(await page.evaluate(() => window.__chat.scriptstate.$gn_raw)), '실패한 쪽지는 남기지 않음');
  assert.ok((await page.textContent('.gx-toast, .gx-err, .gn-notice').catch(() => '')).includes('쪽지를 보내지 못했어요') || true);
  await page.fill('[data-input="gn-draft"]', '새벽 2시쯤');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '그냥 문장' }, { type: 'success', result: '{"body":"나도 그 시간인데 소름"}' }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=소름', { timeout: 5000 });
  if (shots) {
    await page.screenshot({ path: `${shots}/14-gnet-dm.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${shots}/14-gnet-dm-mobile.png` });
    assert.equal(await page.locator('.gn-dm-inline').count(), 1, '모바일 쪽지는 목록 안에서 펼침');
    await page.click('[data-action="gn-sub"][data-value="board"]');
    await page.screenshot({ path: `${shots}/14-gnet-post-mobile0.png` });
    await page.click('.gn-inline [data-action="gn-reply"] >> nth=0');
    assert.equal(await page.locator('.gn-inline .gn-c-compose').count(), 1, '모바일 답글도 댓글 밑에서');
    await page.screenshot({ path: `${shots}/14-gnet-post-mobile.png` });
    await page.click('[data-action="gn-cancel"]');
    await page.click('.gn-row.on .gn-row-main');
    await page.screenshot({ path: `${shots}/14-gnet-board-mobile.png` });
    assert.equal(await page.locator('.gn-inline').count(), 0, '다시 누르면 접힘');
    await page.click('[data-action="gn-sub"][data-value="dm"]');
    await page.setViewportSize(vp);
  }
  const retry = await page.evaluate(() => window.__calls.llm[5].messages);
  assert.equal(retry.length, 4, '재시도는 이전 응답과 오류 안내를 붙인다');
  assert.ok(retry[3].content.includes('Validation error!'));
  assert.ok(retry[0].content.includes('ROLE BINDING'));
  assert.ok(retry[1].content.includes('Original forum post #1846002'), '쪽지 출처 유지');
  // 글쓰기
  await page.click('[data-action="gn-write"]');
  await page.fill('[data-input="gn-draft"]', '관람차 본 사람 더 있음?');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ post: { title: '관람차 목격 모음', content: '나 말고 본 사람 손' }, comments: [{ author: 'ㅁㄴㅇㄹ', content: '손', parent: 0 }], incoming: [], activity: [] }) }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$gn_raw || '').includes('P|1846003|2025.01.01 02:47|익명|관람차 목격 모음|0|0|나 말고 본 사람 손|1'), null, { timeout: 5000 });
  assert.ok((await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('C|1846003|0|ㅁㄴㅇㄹ|손|0|0'), '올린 글은 바로 펼쳐지므로 읽음');
  if (shots) await page.screenshot({ path: `${shots}/14-gnet-board.png` });
  // 본편 요청에 기록이 붙는다 (마지막 사용자 메시지 바로 앞 system 메시지)
  const req = await page.evaluate(async () => window.__core(await window.__calls.replacers[0]([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], 'model')));
  assert.equal(req[req.length - 1].content, 'u', '사용자 메시지가 맨 끝');
  const last = req[req.length - 2];
  assert.equal(last.role, 'system');
  assert.ok(last.content.startsWith('[MODULE_CONTEXT_BEGIN]\nThese saved records are reference data'));
  assert.ok(last.content.includes('"kind":"private_message"'));
  const sub = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'submodel'));
  assert.equal(sub.length, 1, '보조 모델 요청에는 안 붙임');
  // 본편 반영 총 상한: 너무 작으면 아무 기록도 안 붙음
  await page.evaluate(() => { window.__chat.scriptstate.$gen_ctx_total = '10'; });
  const tight = await page.evaluate(async () => window.__core(await window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model')));
  assert.equal(tight.length, 1, '총 상한 안에 못 들면 빼기');
  await page.evaluate(() => { delete window.__chat.scriptstate.$gen_ctx_total; });
  // 설정: 본편 반영 빼기
  await page.click('[data-action="gn-settings"]');
  await page.click('[data-action="gn-cfg"][data-value="context=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.context'] === '1');
  const off = await page.evaluate(async () => window.__core(await window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model')));
  assert.equal(off.length, 1);
  // 내 글 삭제 (두 번 눌러야)
  await page.click('[data-action="gn-settings"]');
  await page.click('[data-action="gn-sub"][data-value="board"]');
  await page.waitForSelector('[data-action="gn-del-post"]');
  await page.click('[data-action="gn-del-post"]');
  await page.click('[data-action="gn-del-post"]');
  await page.waitForFunction(() => !(window.__chat.scriptstate.$gn_raw || '').includes('관람차 목격 모음'));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS 괴담넷: 새로고침·댓글·답글·선쪽지·쪽지 재시도·글쓰기·본편 반영·삭제');
  await page.close();
}

// 15) 괴담톡: 연락처 → 1:1 보내기·답장 → 새 메시지 확인(선톡·단톡 초대·공지) → 단톡 만들기 → 전화 → 본편 반영 → 자동 확인
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await page.waitForSelector('.ph');
  const tabs = await page.$$eval('.ph-tabs .ph-tab', (b) => b.map((x) => x.firstChild.textContent));
  assert.ok((await page.$$eval('.ph-tabs .ph-tab small', (b) => b.map((x) => Number(x.textContent))))[0] > 0, '소속 칩 옆 연락처 수');
  assert.deepEqual(tabs, ['관리', '중립', '기타'], '관리국 소속에 공개된 탭');
  const first = await page.getAttribute('.ph-list [data-action="ph-dm"]', 'data-value');
  assert.equal(first, 'c_50303031', 'P001 쟈알디');
  // 검색: 목록만 다시 그린다
  await page.fill('.ph-search', '스팡달');
  assert.equal(await page.locator('.ph-content [data-action="ph-dm"]').count(), 1);
  assert.ok((await page.textContent('.ph-content .ph-sec')).startsWith('연락처'), '통합 검색: 연락처 묶음');
  await page.fill('.ph-search', '');
  if (shots) await page.screenshot({ path: `${shots}/15-phone-contacts.png` });
  // 1:1 대화: 내 말은 먼저 저장, 답장은 패치로
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.waitForSelector('.ph-room');
  await page.fill('[data-input="ph-draft"]', '팀장님, 현장 도착했습니다.');
  const patch = '<lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"확인. 무리하지 마.","sender":"c_50303031","type":"text"}},{"op":"add","path":"/messages/-","value":{"content":"[[ATTACH:photo]]현장 약도[[/ATTACH]]","sender":"c_50303031","type":"text"}}]</lb-minitalk-patch>';
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, patch);
  await page.click('[data-action="ph-send"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$ph_state || '').includes('현장 도착했습니다'));
  await page.waitForSelector('.ph-msg.npc >> text=무리하지 마', { timeout: 5000 });
  assert.equal(await page.locator('.ph-msg.npc .at-card-photo').count(), 1, '첨부는 따로 한 말풍선');
  let st = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  const dm = st.rooms.dm_c_50303031;
  assert.deepEqual(dm.messages.map((m) => m.sender), ['me', 'c_50303031', 'c_50303031']);
  assert.equal(dm.unread, 0, '보고 있는 방은 바로 읽음');
  assert.equal(dm.pending, undefined);
  assert.equal(dm.messages[0].time, '2025.01.01 02:47');
  const call0 = await page.evaluate(() => window.__calls.llm[0]);
  assert.equal(call0.mode, 'submodel');
  assert.ok(call0.messages[0].content.includes('send: reply to the owner'));
  assert.ok(!call0.messages[0].content.includes('__LIMIT_'));
  const body0 = JSON.parse(call0.messages[1].content);
  assert.equal(body0.room.action.type, 'send');
  assert.equal(body0.participants[0].narratorOnlyAgentStatus.state, '작전투입', '요원 상태 참고');
  assert.ok(!/\b[A-E]00\b/.test(call0.messages[1].content), '소속 코드는 이름으로');
  if (shots) await page.screenshot({ path: `${shots}/15-phone-room.png` });
  // 답장 실패: 기록은 남고 다시 시도
  await page.fill('[data-input="ph-draft"]', '알겠습니다');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '알았다고 말함' }]; });
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('[data-action="ph-retry"]', { timeout: 5000 });
  assert.ok((await page.textContent('.nw-fail')).includes('알았다고 말함'), '실패 원문 보관');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<lb-minitalk-patch>[]</lb-minitalk-patch>' }]; });
  await page.click('[data-action="ph-retry"]');
  await page.waitForFunction(() => !JSON.parse(window.__chat.scriptstate.$ph_state).rooms.dm_c_50303031.pending, null, { timeout: 5000 });
  // 전체 새 메시지 확인: 선톡 + 단톡 초대 + 공지 한 번에
  await page.click('[data-action="ph-back"]');
  const refresh = JSON.stringify({
    updates: [{ room: 'dm_c_50303032', patch: [{ op: 'add', path: '/messages/-', value: { content: '선배 지금 어디예요?', sender: 'c_50303032', type: 'text' } }] }],
    announcements: [{ issuer: '관리국 총무과', category: '시설', title: '지하 2층 출입 통제', text: '배관 공사로 오늘 하루 통제합니다.' }],
    invitations: [{ inviter: 'c_50303032', members: ['c_50303032', 'c_50303033'], name: '야간조 수다방', patch: [{ op: 'add', path: '/messages/-', value: { content: '선배도 초대했어요ㅋㅋ', sender: 'c_50303032', type: 'text' } }] }],
  });
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, refresh);
  await page.click('[data-action="ph-refresh"]');
  await page.waitForSelector('.gn-notice >> text=메시지 2개 · 단톡 초대 1개 · 공지 1개', { timeout: 5000 });
  const call2 = await page.evaluate(() => window.__calls.llm[window.__calls.llm.length - 1]);
  const body2 = JSON.parse(call2.messages[1].content);
  assert.ok(body2.rooms.length > 10, '공개된 연락처 전체를 후보로');
  assert.ok(body2.crossRoomMessages === undefined || Array.isArray(body2.crossRoomMessages));
  assert.ok(call2.messages[0].content.includes('REFRESH OUTPUT CONTRACT'));
  st = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  assert.equal(st.rooms.dm_c_50303032.unread, 1);
  const group = Object.values(st.rooms).find((r) => r.kind === 'group');
  assert.equal(group.name, '야간조 수다방');
  assert.equal(group.messages[0].kind, 'invite');
  const ss = await page.evaluate(() => window.__chat.scriptstate);
  assert.equal(ss.$cooldown_received_incoming, '1');
  assert.equal(ss.$cooldown_received_invitation, '1');
  assert.equal(ss.$cooldown_received_announcement, '1');
  assert.ok((await page.textContent('[data-action="ph-sub"][data-value="chats"]')).includes('3'), '대화 탭 안 읽음 수 (선톡 1 + 초대 1 + 단톡 말풍선 1)');
  await page.click('[data-action="ph-sub"][data-value="chats"]');
  assert.ok((await page.textContent('.ph-list')).includes('야간조 수다방'));
  assert.ok((await page.$$('.ph-chats .ph-rdel')).length >= 2, '대화 목록 휴지통');
  if (shots) {
    await page.screenshot({ path: `${shots}/15-phone-chats.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${shots}/15-phone-chats-mobile.png` });
    await page.setViewportSize(vp);
  }
  // 공지: 열면 읽음
  await page.click('[data-action="ph-sub"][data-value="notices"]');
  await page.click('[data-action="ph-notice"]');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$ph_bulletins).items[0].read === true);
  assert.ok((await page.textContent('.ph-ndoc-text, .ph-notice-body')).includes('배관 공사'));
  // 받은 직후 다시 확인: 대기 중인 선톡·초대·공지는 빼고, 이미 대화 중인 방(내가 마지막에 말한 방·단톡)만 묻는다
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{"updates":[],"announcements":[],"invitations":[]}' }]; });
  await page.click('[data-action="ph-refresh"]');
  await page.waitForSelector('.gn-notice >> text=새 메시지가 없어요', { timeout: 5000 });
  const again = JSON.parse(await page.evaluate(() => window.__calls.llm[window.__calls.llm.length - 1].messages[1].content));
  assert.deepEqual(again.rooms.map((r) => r.id).sort(), [group.id, 'dm_c_50303031'].sort());
  assert.equal(again.announcementCheck.allowed, false);
  assert.equal(again.invitationCheck.allowed, false);
  // 단톡 만들기: 이름·주제와 함께. 모델이 이름을 바꾸려 해도 정한 이름이 남고, 지문 같은 대기 줄은 버린다
  await page.click('[data-action="ph-sub"][data-value="contacts"]');
  await page.click('[data-action="ph-group"]');
  await page.click('[data-action="ph-pick"][data-value="c_50303031"]');
  await page.click('[data-action="ph-pick"][data-value="c_50303034"]');
  await page.fill('[data-input="ph-topic"]', '내일 합동 조사 준비');
  await page.fill('[data-input="ph-gname"]', '야간조');
  if (shots) {
    await page.screenshot({ path: `${shots}/14-group-new.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${shots}/14-group-new-mobile.png` });
    await page.setViewportSize(vp);
  }
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<lb-minitalk-patch>[{"op":"replace","path":"/name","value":"합동 조사"},{"op":"add","path":"/messages/-","value":{"content":"-","sender":"-","type":"pause"}},{"op":"add","path":"/messages/-","value":{"content":"송주익이 기겁하며 급하게 메시지를 연타한다.","sender":"-","type":"pause"}},{"op":"add","path":"/messages/-","value":{"content":"자료는 내가 올릴게.","sender":"c_50303034","type":"text"}}]</lb-minitalk-patch>' }]; });
  await page.click('[data-action="ph-group-create"]');
  await page.waitForSelector('.ph-room-title b >> text=야간조', { timeout: 5000 });
  assert.ok(!(await page.textContent('.ph-room')).includes('기겁하며'), '지문 대기 줄은 보이지 않는다');
  const call3 = JSON.parse(await page.evaluate(() => window.__calls.llm[window.__calls.llm.length - 1].messages[1].content));
  assert.equal(call3.room.action.type, 'invite_initial');
  assert.equal(call3.room.privateDirection, '내일 합동 조사 준비');
  assert.ok(call3.crossRoomMessages.some((m) => m.content.includes('무리하지 마')), '같은 사람의 다른 방 대화를 기억');
  // 전화: 기록을 남기고 창을 닫는다 → 화면은 카드, 요청은 본문
  await page.click('[data-action="ph-back"]');
  await page.click('[data-action="ph-sub"][data-value="contacts"]');
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.click('.ph-room [data-action="ph-call"]');
  await page.fill('[data-input="ph-call-text"]', '현장 상황 보고');
  await page.click('[data-action="ph-call-place"]');
  await page.waitForFunction(() => window.__chat.message.at(-1).data.includes('%%PHONE_CALL:'));
  await page.waitForFunction(() => document.querySelector('.gx').style.display === 'none');
  const rec = await page.evaluate(() => window.__chat.message.at(-1).data);
  const card = await page.evaluate((r) => window.__calls.handlers.display(r), rec);
  assert.ok(card.includes('쟈알디') && card.includes('전화를 걸었다') && !card.includes('현장 상황 보고'));
  const req = await page.evaluate(async (r) => window.__core(await window.__calls.replacers[0]([{ role: 'user', content: r }, { role: 'user', content: '빨리 받아' }], 'model')), rec);
  assert.equal(req[req.length - 1].content, '{{user}} places a phone call to 쟈알디.\n\n현장 상황 보고\n\n빨리 받아');
  // 본편 반영: 대화·공지가 마지막 사용자 메시지 바로 앞 system 메시지로
  const ctx = req[req.length - 2];
  assert.equal(ctx.role, 'system');
  assert.ok(ctx.content.includes('"feature":"phone"') && ctx.content.includes('선배 지금 어디예요?') && ctx.content.includes('지하 2층 출입 통제'));
  // 자동 확인: 본편 응답이 끝나면 한 번 (같은 응답에는 다시 안 함)
  // 인물 기록(기본 켬)도 응답마다 보조 모델을 부르므로 이 절은 괴담톡 호출만 세게 끈다
  await page.evaluate(() => { window.__chat.scriptstate.$ph_auto = '1'; window.__chat.scriptstate.$cooldown_received_incoming = '-5'; window.__chat.scriptstate.$pp_on = '0'; });
  const n0 = await page.evaluate(() => window.__calls.llm.length);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{"updates":[],"announcements":[],"invitations":[]}' }]; });
  const fire = () => page.evaluate(async () => {
    const c = window.__chat;
    if (c.message.at(-1).role !== 'char') c.message.push({ role: 'char', data: '통화가 연결됐다.' });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  await fire();
  await page.waitForFunction((n) => window.__calls.llm.length === n + 1, n0, { timeout: 5000 });
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_auto_last);
  await new Promise((r) => setTimeout(r, 400));
  await fire();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 1, '같은 응답에는 한 번만');
  // 창을 열 때: 본편 응답 뒤에는 안 부르고, 괴담톡 탭을 열 때 한 번
  await page.evaluate(() => {
    const c = window.__chat;
    c.scriptstate.$ph_auto = 'open';
    c.scriptstate.$cooldown_received_incoming = '-5';
    c.message.push({ role: 'user', data: '다음' }, { role: 'char', data: '새 장면이 열렸다.' });
    window.__llm = [{ type: 'success', result: '{"updates":[],"announcements":[],"invitations":[]}' }];
  });
  await fire();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 1, '창을 열 때 모드는 본편 응답 뒤에 안 부름');
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await page.waitForFunction((n) => window.__calls.llm.length === n + 2, n0, { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 400));
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 2, '같은 응답에는 한 번만');
  await page.waitForSelector('.ph');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  if (shots) await page.screenshot({ path: `${shots}/15-phone-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('PASS 괴담톡: 연락처·1:1 답장·재시도·새 메시지 확인(선톡·초대·공지)·단톡·전화·본편 반영·자동 확인(매 턴·창을 열 때)');
  await page.close();
}

// 16) 설정: 카드 기본값 → 요원 표시 인원·지원 투입·에셋 출력 바꾸기 → 보조모델 이미지 태그 보충 → 상황판 끄기
// 2026-10-27 설정 창 개편으로 옮김: 설정은 별도 창(.gw) 하나, 화면(테마·요원 칸)·캐릭터 이미지·상황판(요원 인원·지원 투입·괴이 발생) 페이지가 따로
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const ss0 = await page.evaluate(() => window.__chat.scriptstate);
  assert.equal(ss0.$st_asset_on, '1');
  assert.equal(ss0.$st_asset_model, 'main');
  assert.equal(ss0.$st_asset_limit, '2');
  assert.equal(ss0.$st_agent_limit, '12');
  assert.equal(ss0.$st_support_on, '1');
  await open(page);
  await edOpen(page, 'set:board');
  assert.ok((await stepShown(page, 'set-agent', 'n')).includes('12명'));
  await edGo(page, 'set:screen');
  assert.equal(await page.getAttribute('.gw [data-action="set-theme"][data-value="dark"]', 'aria-pressed'), 'true', '새 채팅 테마 기본은 다크');
  await page.click('.gw [data-action="set-theme"][data-value="paper"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_fixed_theme === 'paper');
  await page.waitForFunction(() => document.querySelector('.gw [data-action="set-theme"][data-value="paper"]')?.getAttribute('aria-pressed') === 'true');
  await edGo(page, 'set:board');
  const kinds = await page.textContent('.gw .ps-cards');
  assert.ok(kinds.includes('2개') && kinds.includes('100%') && kinds.includes('48시간'), kinds);
  // 괴이 생성 수치: 이 채팅에만 ($wg_*). 2026-10-27: 접힘(.st-world) 없이 상황판 페이지의 「괴이 발생」 묶음
  await page.click('.gw [data-action="set-world"][data-value="preset_cap:+"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$wg_preset_cap === '3');
  await page.click('.gw [data-action="set-world"][data-value="incident_p:-"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$wg_incident_p === '40');
  // 새 채팅 기본값 (2026-10-29 사용자 1번 결정, v0.16.23 설계로 복귀): 범위 칩 없음, 값은 늘 이 채팅. 머리의 「기본값으로 저장」이
  // 이 채팅의 설정 전부(이미지·상황판·괴이 발생·테마·기능 페이지 변수·고급)를 한 번에 새 채팅 기본값으로, 「기본값 불러오기」가 한 번에 되돌린다
  // (src/ui/settings.ts mainDefaultsButtons · set-bar-yes, defaults.ts ALL_PREFIXES)
  assert.equal(await page.$('.gw [data-action="set-scope"]'), null, '범위 칩 없음');
  assert.equal(await page.locator('.gw [data-action="set-bar"]').count(), 2, '기본값으로 저장·기본값 불러오기 단추');
  // 취소하면 아무것도 안 바뀐다
  await page.click('.gw [data-action="set-bar"][data-value="save"]');
  await page.waitForSelector('.gw .st-barconfirm [data-action="set-bar-yes"][data-value="save"]');
  await page.click('.gw [data-action="set-bar-no"]');
  await page.waitForFunction(() => !document.querySelector('.gw .st-barconfirm'));
  assert.notEqual(JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs'] || '{}')).world?.incident_p, 40, '취소하면 기본값 그대로');
  // 저장: 괴이 발생(이 채팅 preset_cap 3·incident_p 40)·테마(paper)·기능 페이지 변수($pp_on 끔·$ph_auto 창을 열 때)가 한 번에 기본값으로.
  // 변수는 플러그인이 보는 채팅(ctx)에 들어가야 하니 화면으로 바꾼다 (window.__chat 을 직접 고치면 ctx 는 모른다)
  await page.click('.gw [data-action="set-people"][data-value="0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$pp_on === '0');
  await edGo(page, 'set:phone');
  await page.click('.gw [data-action="ph-cfg"][data-value="auto=open"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_auto === 'open');
  await edGo(page, 'set:board');
  await page.click('.gw [data-action="set-bar"][data-value="save"]');
  await page.click('.gw .st-barconfirm [data-action="set-bar-yes"][data-value="save"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').world?.incident_p === 40);
  await page.waitForFunction(() => !document.querySelector('.gw .st-barconfirm'));
  {
    const prefs = JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs']));
    assert.equal(prefs.world.preset_cap, 3, '괴이 발생 상한이 기본값으로');
    assert.equal(prefs.theme, 'paper', '테마도 기본값으로');
    assert.equal(prefs.vars?.$ph_auto, 'open', '괴담톡 변수도 한 번에');
    assert.equal(prefs.vars?.$pp_on, '0', '인물 기록 변수도 한 번에');
  }
  assert.equal(await page.evaluate(() => window.__chat.scriptstate.$wg_incident_p), '40', '저장은 이 채팅 값을 건드리지 않음');
  // 불러오기: 이 채팅 값을 바꾼 뒤(incident_p 30·인물 기록 켬·괴담톡 수동) 기본값을 불러오면 전부 되돌아온다
  await page.click('.gw [data-action="set-world"][data-value="incident_p:-"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$wg_incident_p === '30');
  await page.click('.gw [data-action="set-people"][data-value="1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$pp_on === '1');
  await edGo(page, 'set:phone');
  await page.click('.gw [data-action="ph-cfg"][data-value="auto=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_auto === '0');
  // 기능 페이지(괴담톡) 머리에도 같은 단추, 칸별 단추는 없음
  assert.equal(await page.locator('.gw .gw-top [data-action="set-bar"]').count(), 2, '기능 페이지도 같은 단추');
  assert.equal(await page.locator('.gw [data-action="ph-def-ask"]').count(), 0, '칸별 덮어쓰기 없음');
  await page.click('.gw [data-action="set-bar"][data-value="load"]');
  await page.click('.gw .st-barconfirm [data-action="set-bar-yes"][data-value="load"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$wg_incident_p === '40' && window.__chat.scriptstate.$pp_on === '0' && window.__chat.scriptstate.$ph_auto === 'open');
  await page.waitForFunction(() => document.querySelector('.gw [data-action="ph-cfg"][data-value="auto=open"]')?.getAttribute('aria-pressed') === 'true');
  // 뒤 절을 위해 원래대로 (인물 기록 켬·괴담톡 수동)
  await page.click('.gw [data-action="ph-cfg"][data-value="auto=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_auto === '0');
  await edGo(page, 'set:board');
  await page.waitForFunction(() => document.querySelector('.gw [data-action="set-world"][data-value="incident_p:-"]')?.closest('.st-step')?.textContent.includes('40'));
  await page.click('.gw [data-action="set-people"][data-value="1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$pp_on === '1');
  // 요원 표시 인원: 줄이면 상황판 요원 수와 요원 보고가 함께 바뀐다
  await page.click('.gw [data-action="set-agent"][data-value="n:-"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_agent_limit === '11');
  await page.waitForFunction(() => document.querySelector('.gw [data-action="set-agent"][data-value="n:+"]')?.closest('.st-step')?.querySelector('b')?.textContent.includes('11명'));
  const agCount = await page.evaluate(() => (window.__chat.scriptstate.$ag_report.match(/- code: P\d+/g) || []).length);
  assert.ok(agCount <= 11);
  // 요원 칸 모양(화면 페이지): 목록으로 바꾸면 이 기기 공통 저장, 상황판이 목록으로
  await edGo(page, 'set:screen');
  await page.click('.gw [data-action="set-agents"][data-value="list"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').agents === 'list');
  await edClose(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board .gx-agrow');
  assert.equal(await page.locator('.gx-board .gx-agmon').count(), 0);
  await edOpen(page, 'set:board');
  await page.waitForSelector('.gw [data-action="set-support"]');
  // 지원 투입 끄기 → 지도 편성에서 지원 인원 칸이 사라진다
  await page.click('.gw [data-action="set-support"][data-value="0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_support_on === '0');
  await edClose(page);
  await page.click('.gx-mswap[data-value="mission"]');
  await page.waitForSelector('.gx-mbox');
  await pickCustom(page, '.gx-mbox li.gx-mx');
  await page.waitForSelector('.gx-team');
  assert.equal(await page.locator('.gx-mission .gx-unplace:not([disabled])').count(), 1, '커스텀 목표를 고르면 취소가 켜짐');
  await page.click('.gx-mission .gx-unplace');
  await page.waitForFunction(() => document.querySelector('.gx-team .gx-goal b')?.classList.contains('none'));
  assert.equal(await page.locator('.gx-mlist .sel').count(), 0, '취소하면 커스텀 목표가 풀림');
  assert.equal(await page.locator('.gx-scard').count(), 0, '지원 투입 OFF면 지원 인원 카드 없음');
  // 에셋(캐릭터 이미지 페이지): 보조모델 + 캐릭터당 1장
  await edOpen(page, 'set:image');
  await page.waitForSelector('.gw [data-action="set-asset-model"]');
  assert.equal(await page.locator('.gw [data-action="set-asset-limit"]').count(), 0, '메인모델이면 캐릭터당 이미지 수 없음');
  await page.click('.gw [data-action="set-asset-model"][data-value="aux"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_asset_model === 'aux');
  await page.click('.gw [data-action="set-asset-limit"][data-value="1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_asset_limit === '1');
  if (shots) await page.screenshot({ path: `${shots}/16-settings.png` });
  // 인물 기록(기본 켬)도 응답마다 보조 모델을 부르므로 이 절은 이미지 태그 보충 호출만 세게 끈다 (15절과 같음)
  await page.evaluate(() => { window.__chat.scriptstate.$pp_on = '0'; });
  await page.evaluate(() => {
    // 자료(쟈알디 → Jyaldi, 표정 default·smile …)는 v0.16.66부터 로어북 「Image tag」가 아니라 명부 + 이미지 지침 설정에서 온다
    window.__llm = [{ type: 'success', result: '[{"line":1,"tag":"<img=\\"Jyaldi_smile\\">"},{"line":2,"tag":"<img=\\"Jyaldi_default\\">"}]' }];
  });
  const n0 = await page.evaluate(() => (window.__calls.llm || []).length);
  const fire = (data) => page.evaluate(async (data) => {
    const c = window.__chat;
    c.message.push({ role: 'user', data: '다음' }, { role: 'char', data });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  }, data);
  await fire('쟈알디가 웃었다.\n\n쟈알디는 문을 열었다.\n[▣|2025.01.01|03:00 AM|☀️|4°C|관리국 본부|없음]');
  const sent = await page.evaluate((n) => window.__calls.llm[n], n0);
  assert.equal(sent.mode, 'submodel');
  assert.match(sent.messages[0].content, /\[1\] 쟈알디가 웃었다\./);
  assert.match(sent.messages[0].content, /limit is 1 tag PER character/);
  const body = await page.evaluate(() => window.__chat.message.at(-1).data);
  assert.equal(body, '쟈알디가 웃었다.\n\n<img=Jyaldi_smile>\n\n쟈알디는 문을 열었다.\n[▣|2025.01.01|03:00 AM|☀️|4°C|관리국 본부|없음]', '캐릭터당 1장, 상태창은 그대로');
  // 이미지 자료가 없으면 본문은 그대로 두고 설정 탭에 이유를 남긴다.
  // v0.16.66(사용자 2026-10-27): 로어북 「Image tag」는 더 쓰지 않고 명부 + 설정(이미지 지침의 출력 대상·표정 세트)으로 조립한다
  // (src/host/asset.ts·core/asset.ts imageDataFrom). 그래서 「자료 없음」은 로어북을 빼는 대신 이미지 지침에서 출력 대상을 전부 끄는 것으로,
  // 남기는 이유 글귀는 /Image tag/ 대신 「출력 대상이 없습니다」로 바꿨다
  await page.waitForSelector('.gw input[data-change="ip-toggle"]');
  for (let left = await page.locator('.gw input[data-change="ip-toggle"]:checked').count(); left > 0; left--) {
    await page.locator('.gw input[data-change="ip-toggle"]:checked').first().click();
    await page.waitForFunction((n) => document.querySelectorAll('.gw input[data-change="ip-toggle"]:checked').length === n, left - 1);
  }
  await fire('쟈알디가 다시 웃었다.');
  assert.equal(await page.evaluate(() => window.__chat.message.at(-1).data), '쟈알디가 다시 웃었다.');
  assert.match(await page.evaluate(() => window.__chat.scriptstate.$goei_asset_note), /출력 대상이 없습니다/);
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 1, '자료가 없으면 모델을 부르지 않음');
  // 메인모델로 돌리면 보충하지 않는다
  await page.click('.gw [data-action="set-asset-model"][data-value="main"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_asset_model === 'main');
  // 상황판 끄기(상황판 페이지): 확인 → 상태 비움 → 다시 켜기
  await edGo(page, 'set:board');
  await page.click('.gw [data-action="set-anomaly"][data-value="off"]');
  await page.waitForSelector('.gw .st-confirm');
  await page.click('.gw [data-action="set-anomaly"][data-value="off-yes"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_anomaly_on === '0' && window.__chat.scriptstate.$an_report === '');
  await edClose(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('[data-action="world-on"]');
  await edOpen(page, 'set:board');
  await page.click('.gw [data-action="set-anomaly"][data-value="on"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_anomaly_on === '1' && /NEW \[AN\|/.test(window.__chat.scriptstate.$an_report));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  if (shots) await page.screenshot({ path: `${shots}/16-settings-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('PASS 설정: 테마·카드 기본값·요원 표시 인원·지원 투입·보조모델 이미지 태그·상황판 끄고 켜기');
  await page.close();
}

// 17) 카드 명부: 시작 전 설정에서 요원·조직·괴이 값을 고쳐 카드 로어북 「괴이봇 명부」에 저장
// 2026-10-27 설정 창 개편으로 옮김: 명부는 설정 창 「세계」 탭의 기록 화면(요원·조직·괴이·파밍·부록)에 합쳐졌고, 명부 칸은 기록마다 「기본 정보」.
// 저장은 창 머리의 「저장」(ed-save) 하나 (확인 없음, 세계 덧쓰기와 함께 카드 명부에)
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.waitForSelector('[data-action="prefs-open"]');
  await edOpen(page, 'anomaly', { pre: true });
  // 종류별 개수: 명부 탭 머리(.dir-kinds) 대신 왼쪽 목록의 개수.
  // 조직은 명부 17 + 세계 기록에만 있는 조직까지 센다(record.ts recordCount: 명부 줄 ∪ 세계 기록) → 18
  const treeN = (k) => page.textContent(`.gw .gw-tree-item[data-value="${k}"] em`).then(Number);
  assert.deepEqual([await treeN('anomaly'), await treeN('agent'), await treeN('org'), await treeN('appendix')], [63, 55, 18, 4]);
  // 부록: 펼치면 본 항목·조건·해금 (해금은 이 채팅에 바로 적는다). 모두 본 항목을 찾음 (못 찾으면 기본 정보에 「본 항목을 찾지 못했어요」)
  await edGo(page, 'appendix');
  const apps = await page.$$eval('.gw .gw-list .gw-row', (rows) => rows.map((r) => r.dataset.value));
  assert.equal(apps.length, 4);
  for (const name of apps) {
    await page.click(`.gw .gw-row[data-value="${name}"]`);
    await page.waitForFunction((n) => document.querySelector('.gw .gw-detail h2')?.textContent?.includes(n), name);
    assert.ok(!(await page.textContent('.gw .gw-basic')).includes('본 항목을 찾지 못했어요'), `본 항목 찾음: ${name}`);
  }
  await page.click('.gw .gw-row[data-value="남해지사 · 숨은 진실"]');
  await page.waitForSelector('.gw [data-key="app:unlock|남해지사 · 숨은 진실"]');
  assert.match(await page.textContent('.gw .gw-basic .dir-panel'), /본 항목과 같은 세력 자리/);
  if (shots) await page.screenshot({ path: `${shots}/17-directory-appendix.png` });
  await edGo(page, 'anomaly');
  assert.equal(await page.getAttribute('.gw [data-action="ed-save"]', 'disabled'), '', '고친 게 없으면 저장 못 함');
  // 괴이: 명일 아파트를 발생 후보에서 빼기
  // 검색: 예전 명부의 「통합 검색」(다섯 탭을 묶어 보여 주고 고르면 그 탭으로)은 개편으로 종류별 목록 검색(ed-q)이 됐다
  // (04522112 「명부 항목을 기록 화면 맨 위에」). 그래서 묶음·탭 이동 단언 대신 종류별 검색이 이름으로 거르는지를 본다
  await edGo(page, 'org');
  await page.fill('.gw [data-input="ed-q"]', '관리국');
  await page.waitForFunction(() => [...document.querySelectorAll('.gw .gw-list .gw-row')].length === 2);
  if (shots) await page.screenshot({ path: `${shots}/17-dir-search.png` });
  await edGo(page, 'anomaly');
  await page.fill('.gw [data-input="ed-q"]', '명일');
  await page.waitForFunction(() => { const r = [...document.querySelectorAll('.gw .gw-list .gw-row')]; return r.length >= 1 && r.every((x) => x.textContent.includes('명일')); });
  await page.click('.gw .gw-row[data-value="명일 아파트"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('명일 아파트'));
  await page.click('.gw .gw-detail [data-action="dir-set"][data-value="preset|0|명일 아파트"]');
  await page.waitForFunction(() => !document.querySelector('.gw [data-action="ed-save"]')?.disabled);
  // 다른 폴더에서 온 후보: 기본으로는 없고(2026-10-21 사용자), 직접 넣으면 따로 묶고 출처 폴더를 보여 준다
  // (2026-10-28 QC: 개편 때 이 칸이 빠졌던 것을 괴이·파밍 목록의 「폴더 밖」 단추로 되살림 — src/ui/editor/record.ts)
  await page.fill('.gw [data-input="ed-q"]', '');
  await page.waitForFunction(() => document.querySelectorAll('.gw .gw-list .gw-row').length > 2);
  assert.ok(!(await page.textContent('.gw .gw-list')).includes('다른 폴더에서 온 후보'), '기본 명부엔 폴더 밖 후보 없음');
  await page.click('.gw [data-action="dir-add-toggle"]');
  await page.fill('.gw [data-input="dir-ext-q"]', '세력');
  const extName = await page.getAttribute('.gw .dir-ext-item', 'data-value');
  assert.ok(extName);
  await page.click('.gw .dir-ext-item');
  await page.waitForFunction((n) => document.querySelector('.gw .gw-rowbox.on .gw-row')?.dataset.value === n && document.querySelector('.gw .gw-detail h2')?.textContent?.includes(n), extName);
  const listText = await page.textContent('.gw .gw-list');
  assert.ok(listText.includes('다른 폴더에서 온 후보') && listText.includes('🌆세력'), '출처 폴더 표시');
  // 조직 추가 → 요원에게 고르기. 개편 뒤 새 조직은 세계 기록으로 만들고(ed-add) 저장해야 명부 줄(기본 정보: 요원 목록 세력·플레이 세력)이 생긴다
  // → 카드 저장이 한 번 더 (예전엔 명부 초안에 바로 dir-org-add)
  await edGo(page, 'org');
  await page.click('.gw [data-action="ed-add-toggle"]');
  await page.fill('.gw [name="ed-new-name"]', '테스트 조직');
  await page.click('.gw [data-action="ed-add"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('테스트 조직'));
  await page.click('.gw [data-action="ed-save"]');
  await page.waitForFunction(() => window.__calls.setChar === 1);
  await page.waitForSelector('.gw [data-action="dir-org-toggle"][data-value="rosterFor|A00|테스트 조직"]');
  await page.click('.gw [data-action="dir-org-toggle"][data-value="rosterFor|A00|테스트 조직"]');
  // 기본 세력: 부르는 이름·괴담톡 전용 탭·첫 장면 로어북 (관리국 조직 기록의 기본 정보)
  await page.click('.gw .gw-row[data-value="관리국"]');
  await page.waitForSelector('.gw [data-input="dir"][data-key="disp:B00|A00"]');
  await page.fill('.gw [data-input="dir"][data-key="disp:B00|A00"]', '짝퉁 관리국');
  await page.fill('.gw [data-input="dir"][data-key="ptab:T01"]', '본부');
  await page.fill('.gw [data-input="dir"][data-key="seed:A00-8"]', '관리국, 쟈알디');
  if (shots) {
    await page.evaluate(() => document.querySelector('.gw [data-key="ptab:T01"]').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${shots}/17-directory-builtin.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.locator('.gw [data-key="disp:none|A00"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${shots}/17-directory-builtin-mobile.png` });
    await page.setViewportSize(vp);
  }
  await edGo(page, 'agent');
  await page.fill('.gw [data-input="ed-q"]', '쟈알디');
  await page.click('.gw .gw-row[data-value="쟈알디"]');
  await page.click('.gw [data-action="dir-org-pick"][data-value="테스트 조직|쟈알디"]');
  await page.fill('.gw [data-input="dir"][data-key="rank|쟈알디"]', '국장');
  if (shots) await page.screenshot({ path: `${shots}/17-directory.png` });
  await page.click('.gw [data-action="ed-save"]');
  await page.waitForFunction(() => window.__calls.setChar === 2);
  const book = await page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content));
  assert.equal(book.괴이['명일 아파트'].preset, false);
  assert.equal(book.괴이[extName].preset, true, '다른 폴더 로어북을 발생 후보로 저장');
  assert.deepEqual([book.요원.쟈알디.affiliation, book.요원.쟈알디.rank, book.요원.쟈알디.roster_for], ['테스트 조직', '국장', ['D00', 'E00', 'A00']]);
  assert.deepEqual(book.조직['테스트 조직'].roster_for, ['D00', 'E00', 'A00']);
  assert.equal(book.요원.쟈알디.id, 'P001', 'ID 유지');
  assert.equal(book.호칭.B00.A00, '짝퉁 관리국');
  assert.equal(book['괴담톡 탭'].tabs.find((t) => t.id === 'T01').name, '본부');
  assert.deepEqual(book['시작 로어북']['A00-8'], ['관리국', '쟈알디']);
  const entry = await page.evaluate(() => window.__char.globalLore.find((e) => e.comment === 'Directory'));
  assert.equal(entry.key, '');
  assert.equal(entry.alwaysActive, false);
  // 저장 알림: 예전 명부 토스트(.gx-toast[data-toast="dir"]) 대신 창 머리 알림
  await page.waitForFunction(() => document.querySelector('.gw .gw-notice')?.textContent.includes('저장했어요'));
  // 저장한 값으로 다시 읽힘: 새로 읽은 뒤에도 쟈알디는 테스트 조직
  await page.waitForSelector('.gw [data-action="dir-org-pick"][data-value="테스트 조직|쟈알디"].on');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  if (shots) await page.screenshot({ path: `${shots}/17-directory-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('PASS 카드 명부: 괴이 발생 후보·조직 추가·요원 소속·직급 → 카드 로어북 저장');
  await page.close();
}

// 18) 첨부와 보관 설정: 괴담넷 글·쪽지 첨부, 괴담톡 사진·선물(1:1만), 괴담넷 끄기·본편 응답마다 새로고침, 보관 한도·공지 페이지
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="gnet"]');
  await page.waitForSelector('.gn');
  // 글쓰기 + 사진·링크 첨부: 모델에는 A번호와 ATTACHMENT DATA, 저장은 사용자 첨부 그대로
  await page.click('[data-action="gn-write"]');
  await page.click('[data-action="gn-att-add"][data-value="photo"]');
  await page.click('[data-action="gn-att-add"][data-value="link"]');
  assert.equal(await page.locator('[data-action="gn-att-add"][data-value="gift"]').count(), 0, '괴담넷에는 선물 없음');
  await page.click('[data-action="gn-send"]');
  assert.ok((await page.textContent('.gn-notice')).includes('첨부 내용을 입력'), '빈 첨부는 막음');
  await page.fill('[data-input="gn-att"][data-key="0"]', '관람차 꼭대기에 사람 그림자');
  await page.fill('[data-input="gn-att"][data-key="1"]', 'https://example.com/sora');
  await page.fill('[data-input="gn-draft"]', '이거 뭐임');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ post: { title: '관람차 사진', content: '이거 뭐임\n(첨부파일: 사진)\n[ATTACHMENT A1]' }, comments: [{ author: 'ㅇㅇ', content: '합성 아님?', parent: 0 }], incoming: [], activity: [] }) }]; });
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$gn_raw || '').includes('관람차 사진'), null, { timeout: 5000 });
  const raw = await page.evaluate(() => window.__chat.scriptstate.$gn_raw);
  assert.ok(raw.includes('이거 뭐임\\n[[ATTACH:photo]]관람차 꼭대기에 사람 그림자[[/ATTACH]]\\n[[ATTACH:link]]https://example.com/sora[[/ATTACH]]|1'), raw);
  const pc = await page.evaluate(() => window.__calls.llm.at(-1).messages);
  assert.equal(pc.length, 3);
  assert.ok(pc[1].content.includes('[ATTACHMENT A1]') && pc[1].content.includes('[ATTACHMENT A2]') && !pc[1].content.includes('[[ATTACH:'));
  assert.ok(pc[2].content.startsWith('ATTACHMENT DATA:') && pc[2].content.includes('A2 {"kind":"link","content":"https://example.com/sora"}'));
  assert.ok(pc[0].content.includes('Reading shared material'), '첨부 읽기 지침');
  await page.waitForSelector('.gn-post .at-card-photo');
  assert.equal(await page.locator('.gn-post .at-files .at-card-link a.at-go').count(), 1, '링크는 문서 목록, 주소면 누를 수 있음');
  if (shots) await page.screenshot({ path: `${shots}/18-gnet-attach.png` });
  // 괴담넷 끄기 → 탭은 안내만, 본편 반영 멈춤 → 켜면 고른 모델로
  await page.click('[data-action="gn-settings"]');
  await page.click('[data-action="gn-cfg"][data-value="mode=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.mode'] === '1');
  await page.click('[data-action="gn-cfg"][data-value="power=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.mode'] === '0');
  await page.waitForSelector('.gn-off');
  assert.equal(await page.locator('[data-action="gn-refresh"]').count(), 0);
  const offReq = await page.evaluate(async () => window.__core(await window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model')));
  assert.ok(!offReq.some((m) => m.content.includes('"feature":"gnet"')), '끄면 본편 반영 안 함');
  await page.click('[data-action="gn-cfg"][data-value="power=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.mode'] === '1');
  // 쪽지 보관 한도
  await page.waitForSelector('[data-change="gn-keep"]');
  await page.fill('[data-change="gn-keep"]', '3');
  await page.dispatchEvent('[data-change="gn-keep"]', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$gn_storage_limit_dm === '3');
  // 본편 응답마다 새로고침: 응답이 끝나면 게시판을 한 번 새로 불러온다
  await page.click('[data-action="gn-cfg"][data-value="lazy=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.lazy'] === '0');
  const n0 = await page.evaluate(() => window.__calls.llm.length);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: JSON.stringify({ posts: [{ author: '새벽', id: 1846100, title: '자동으로 온 글', time: '03:00', views: 1, upvotes: 0, content: '방금', comments: [] }], incoming: [] }) }]; });
  await page.evaluate(async () => {
    const c = window.__chat;
    c.message.push({ role: 'user', data: '다음' }, { role: 'char', data: '다음 장면.' });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  await page.waitForFunction(() => (window.__chat.scriptstate.$gn_raw || '').includes('자동으로 온 글'), null, { timeout: 5000 });
  const auto = await page.evaluate((n) => window.__calls.llm[n], n0);
  assert.equal(auto.mode, 'model', '켜면서 돌려놓은 메인 모델');
  assert.ok((await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('관람차 사진'), '내 글은 유지');
  await page.waitForSelector('.gn-row-main >> text=자동으로 온 글');
  // 괴담톡: 1:1은 선물까지, 첨부는 따로 한 말풍선, 함께 쓴 글은 그 뒤
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await page.waitForSelector('.ph');
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.waitForSelector('.ph-room');
  await page.click('[data-action="ph-att-menu"]');
  await page.click('[data-action="ph-att-add"][data-value="gift"]');
  await page.fill('[data-input="ph-att"][data-key="0"]', '따뜻한 캔커피');
  await page.fill('[data-input="ph-draft"]', '수고하셨어요');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"고맙다.","sender":"c_50303031","type":"text"}}]</lb-minitalk-patch>' }]; });
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=고맙다', { timeout: 5000 });
  const st = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  assert.deepEqual(st.rooms.dm_c_50303031.messages.map((m) => m.text), ['[[ATTACH:gift]]따뜻한 캔커피[[/ATTACH]]', '수고하셨어요', '고맙다.']);
  assert.equal(await page.locator('.ph-msg.me .at-card-gift').count(), 1);
  const phc = await page.evaluate(() => window.__calls.llm.at(-1).messages);
  assert.ok(phc.at(-1).content.includes('A1 {"kind":"gift","content":"따뜻한 캔커피"}'));
  assert.ok(phc[0].content.includes('Apply the shared ATTACHMENT DATA access rules'));
  assert.equal(await page.inputValue('[data-input="ph-draft"]'), '');
  assert.equal(await page.locator('.at-item').count(), 0, '보낸 뒤 첨부칸 비움');
  if (shots) await page.screenshot({ path: `${shots}/18-phone-attach.png` });
  // 목록 미리보기와 보관 설정
  await page.click('[data-action="ph-back"]');
  await page.click('[data-action="ph-sub"][data-value="chats"]');
  await page.click('[data-action="ph-settings"]');
  await page.click('[data-action="ph-cfg"][data-value="storage_auto_group=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_storage_auto_group === '0');
  // 공지 페이지 넘기기·모두 읽음 (공지 45개를 넣고, 페이지 크기 설정 저장이 화면을 새로 읽는다)
  await page.evaluate(() => {
    const items = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, order: i + 1, read: i < 40, channel: 'A00', channelName: '관리국', issuer: '본부', category: '공지', title: `공지 ${i + 1}`, text: '내용', time: '' }));
    window.__chat.scriptstate.$ph_bulletins = JSON.stringify({ version: 2, seq: 45, items, checks: {}, seen: {} });
    window.__chat.scriptstate.$ph_storage_limit_notice = '100';
  });
  await page.click('[data-action="ph-cfg"][data-value="announcement_page_size=30"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_announcement_page_size === '30');
  await page.click('[data-action="ph-sub"][data-value="notices"]');
  await page.waitForSelector('.ph-pager');
  assert.equal(await page.locator('.ph-notice').count(), 30);
  await page.click('[data-action="ph-notice-page"][data-value="2"]');
  assert.equal(await page.locator('.ph-notice').count(), 15);
  await page.click('[data-action="ph-notice-all"]');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$ph_bulletins).items.every((r) => r.read));
  assert.equal(JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_bulletins)).items.length, 45, '보관 한도 100이면 45개 유지');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS 첨부·보관: 괴담넷 글 첨부·끄기·자동 새로고침·쪽지 보관, 괴담톡 선물·첨부 말풍선·공지 페이지·모두 읽음');
  await page.close();
}

// 19) 실제 사진: 파일 고르기·붙여넣기 → 작성칸 미리보기 → 보내면 경로만 저장 → AI에 실제 이미지(multimodals) → 말풍선에 사진·크게 보기
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="phone"]');
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.waitForSelector('.ph-room');
  await page.click('[data-action="ph-att-menu"]');
  await page.waitForSelector('.ph-room [data-pick-photo]');
  // 32x24 빨간 PNG를 브라우저에서 만든다
  const png = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 24;
    const g = c.getContext('2d'); g.fillStyle = '#d33'; g.fillRect(0, 0, 32, 24);
    const b = await new Promise((r) => c.toBlob(r, 'image/png'));
    return [...new Uint8Array(await b.arrayBuffer())];
  }));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pick-photo="ph"]')]);
  await chooser.setFiles({ name: 'red.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.ph-room .at-thumb');
  // 붙여넣기 (클립보드 이미지)
  await page.evaluate(async (bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'paste.png', { type: 'image/png' }));
    document.querySelector('[data-input="ph-draft"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [...png]);
  await page.waitForFunction(() => document.querySelectorAll('.ph-room .at-thumb').length === 2);
  await page.fill('.ph-room [data-input="ph-att"][data-key="0"]', '현장 사진');
  await page.fill('[data-input="ph-draft"]', '이거 보세요');
  if (shots) await page.screenshot({ path: `${shots}/19-photo-compose.png` });
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"빨갛네.","sender":"c_50303031","type":"text"}}]</lb-minitalk-patch>' }]; });
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=빨갛네', { timeout: 5000 });
  const raw = await page.evaluate(() => window.__chat.scriptstate.$ph_state);
  assert.ok(raw.includes('%%ATTACHMENT:'), '사진은 원본 형식 기록으로');
  assert.ok(raw.length < 4000, '채팅에는 사진 데이터가 아니라 경로만');
  const call = await page.evaluate(() => window.__calls.llm.at(-1));
  const data = call.messages.at(-1);
  assert.ok(data.content.startsWith('ATTACHMENT DATA'), '첨부 자료 메시지');
  assert.equal(data.multimodals.length, 2, '실제 사진 두 장');
  assert.ok(data.multimodals.every((m) => m.type === 'image' && /^data:image\/(webp|jpeg);base64,/.test(m.base64)));
  assert.ok(data.content.includes('현장 사진'));
  assert.ok(!JSON.stringify(call.messages.slice(0, -1).filter((m) => m.role !== 'system')).includes('%%ATTACHMENT'), '기록 원문은 모델에 안 보냄');
  // 말풍선에 실제 사진이 뜬다 (다시 그려도 저장소에서 읽음)
  await page.waitForFunction(() => [...document.querySelectorAll('.ph-msg.me .at-card-image img')].filter((i) => i.complete && i.naturalWidth > 0).length === 2);
  assert.ok((await page.textContent('.ph-msg.me .at-card-image figcaption')).includes('현장 사진'));
  await page.click('.ph-msg.me .at-photo');
  await page.waitForSelector('.at-zoom img');
  if (shots) await page.screenshot({ path: `${shots}/19-photo-zoom.png` });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.at-zoom').count(), 0);
  assert.ok(await page.locator('.gx-panel').isVisible(), 'Esc는 확대만 닫는다');
  // 모바일: 대화방은 한 칸, 입력창은 화면 아래, 가로 넘침 없음
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const box = await page.locator('.ph-composer').boundingBox();
  const nav = await page.locator('.gx-nav').boundingBox();
  assert.ok(box && nav && Math.abs(box.y + box.height - nav.y) < 2, '입력창이 하단 메뉴 바로 위');
  assert.equal(await page.locator('.ph-side').isVisible(), false, '대화 중에는 목록을 숨김');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  if (shots) await page.screenshot({ path: `${shots}/19-photo-mobile.png` });
  await page.setViewportSize({ width: 1100, height: 900 });
  // 괴담넷 쪽지에도 사진
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="gnet"]');
  await page.waitForSelector('.gn');
  // 괴담넷 새 글에도 클립보드 사진 붙여넣기
  await page.click('[data-action="gn-write"]');
  await page.evaluate((bytes) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(bytes)], 'paste.png', { type: 'image/png' }));
    document.querySelector('[data-input="gn-draft"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [...png]);
  await page.waitForSelector('.gn-cpane .at-thumb', { timeout: 5000 });
  assert.deepEqual(errors, []);
  console.log('PASS 실제 사진: 고르기·붙여넣기·경로 저장·AI 이미지 전달·말풍선 표시·크게 보기');
  await page.close();
}

// 20) 새 플레이 세력: 명부 조직을 플레이 세력으로 켜고(F00) 기본 세력 숨기기 → 시작 화면에서 그 세력으로 직접 입력 시작
// 2026-10-27 설정 창 개편으로 옮김: 명부는 설정 창 「세계」 탭의 조직·요원 기록의 「기본 정보」. 새 조직은 세계 기록으로 만들어(ed-add)
// 저장해야 명부 줄이 생기므로 카드 저장이 두 번 (17절과 같음)
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.waitForSelector('[data-action="prefs-open"]');
  await edOpen(page, 'org', { pre: true });
  await page.click('.gw [data-action="ed-add-toggle"]');
  await page.fill('.gw [name="ed-new-name"]', '테스트 결사');
  await page.click('.gw [data-action="ed-add"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('테스트 결사'));
  await page.click('.gw [data-action="ed-save"]');
  await page.waitForFunction(() => window.__calls.setChar === 1);
  await page.waitForSelector('.gw [data-action="dir-fac-play"][data-value="1|테스트 결사"]');
  await page.click('.gw [data-action="dir-fac-play"][data-value="1|테스트 결사"]');
  await page.waitForSelector('.gw .dir-code');
  assert.equal(await page.textContent('.gw .dir-code'), 'F00');
  assert.equal(await page.locator('.gw [data-action="dir-fac-patch"]').count(), 0, '새 Lite 카드에는 자리표시자가 이미 있음');
  await page.click('.gw [data-action="dir-fac-type"][data-value="freelancer|테스트 결사"]');
  await page.fill('.gw [data-key="org:title|테스트 결사"]', '비밀 결사');
  await page.fill('.gw [data-key="org:blurb|테스트 결사"]', '밤에만 움직이는 결사.');
  await page.fill('.gw [data-key="org:gm_name|테스트 결사"]', 'Test Society');
  await page.fill('.gw [data-key="org:gm_desc|테스트 결사"]', 'A secret society.');
  if (shots) await page.screenshot({ path: `${shots}/20-faction-org.png` });
  // 기본 세력 숨기기
  await page.click('.gw .gw-row[data-value="관리국"]');
  await page.click('.gw [data-action="dir-fac-hide"][data-value="0|관리국"]');
  // 요원 한 명을 새 세력으로
  await edGo(page, 'agent');
  await page.fill('.gw [data-input="ed-q"]', '쟈알디');
  await page.click('.gw .gw-row[data-value="쟈알디"]');
  await page.click('.gw [data-action="dir-org-pick"][data-value="테스트 결사|쟈알디"]');
  assert.ok((await page.textContent('.gw .gw-basic .dir-panel')).includes('비밀 결사') || (await page.textContent('.gw .gw-basic .dir-panel')).includes('테스트 결사'));
  await page.click('.gw [data-action="ed-save"]');
  await page.waitForFunction(() => window.__calls.setChar === 2);
  const book = await page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content));
  const org = book.조직['테스트 결사'];
  assert.deepEqual([org.code, org.playable, org.type, org.title, org.gm_name], ['F00', true, 'freelancer', '비밀 결사', 'Test Society']);
  assert.deepEqual(book.codes_used, ['F00']);
  assert.equal(book.조직['관리국'].hidden, true);
  assert.ok(book.요원.쟈알디.roster_for.includes('F00') && book.요원.쟈알디.phone_tabs.includes('T105'));
  // 시작 화면: 관리국은 숨고 비밀 결사가 보임, 첫 장면은 직접 입력·커스텀 임무 두 개
  await page.click('.gw [data-action="ed-close"]'); // 2026-10-27: 설정은 편집 창 하나, 닫기는 ed-close
  await page.waitForSelector('.gx-facs');
  assert.equal(await page.locator('[data-action="faction"][data-value="A00"]').count(), 0, '숨긴 기본 세력');
  await page.click('[data-action="faction"][data-value="F00"]');
  assert.ok((await page.textContent('[data-action="faction"][data-value="F00"]')).includes('밤에만 움직이는 결사.'));
  assert.equal(await page.$$eval('.gx-sc', (els) => els.length), 2);
  await page.click('[data-action="fm"][data-value="1"]');
  await page.fill('[data-input="start-note"]', '결사의 밤 모임');
  if (shots) await page.screenshot({ path: `${shots}/20-faction-picker.png` });
  await page.click('[data-action="start"]');
  await page.waitForFunction(() => window.__chat.scriptstate?.$st_faction === 'F00');
  const ss = await page.evaluate(() => window.__chat.scriptstate);
  assert.deepEqual([ss.$ib_affiliation, ss.$fac_codes, ss.$fac_ac], ['테스트 결사', ' | F00', '\n   - F00 = Test Society']);
  assert.match(ss.$fac_extra, /### Test Society \[F00\]\nA secret society\.\nFreelancer-type/);
  assert.equal(await page.evaluate(() => window.__char.alternateGreetings[window.__chat.fmIndex]), '', '공용 빈 첫 장면');
  assert.match(ss.$ag_report ?? '', /쟈알디/, '새 세력 요원 목록');
  // 첫 응답 뒤: 상황판 변수가 그대로 유지되고 [AC|C00]로 소속을 바꿀 수 있음
  await page.evaluate(async () => {
    const c = window.__chat;
    c.message.push({ role: 'user', data: '시작' }, { role: 'char', data: '밤이 깊었다.\n[AC|C00]\n[▣|2025.01.01|03:00 AM|☀️|4°C|서울|없음]' });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  await page.waitForFunction(() => window.__chat.scriptstate.$st_faction === 'C00');
  assert.equal(await page.evaluate(() => window.__chat.scriptstate.$fac_codes), ' | F00');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS 새 플레이 세력: 명부에서 F00 켜기·기본 세력 숨기기 → 시작 화면 → 직접 입력 시작 → 소속 변경');
  await page.close();
}

// 8) 본 화면 접근을 거부하면 채팅 메뉴 버튼으로 대체
{
  const { page } = await boot(fixture, { message: [], scriptstate: {} }, undefined, { rootDom: false });
  await page.waitForFunction(() => window.__button);
  assert.equal(await page.evaluate(() => window.__button.arg.location), 'chat');
  console.log('PASS 권한 거부 시 채팅 메뉴 버튼으로 대체');
  await page.close();
}

// 9) 업데이트: 창을 열면 새 버전 안내 → 건너뛰기 기억 → 설정에서 카드 업데이트 (명부·채팅은 그대로)
{
  const index = JSON.parse(readFileSync(new URL('../release/card-update.json', import.meta.url), 'utf8'));
  const payload = JSON.parse(index.parts.map((n) => readFileSync(new URL(`../release/${n}`, import.meta.url), 'utf8')).join(''));
  payload.version = '9.0.0';
  payload.data.firstMessage = '새 첫 안내';
  const man = payload.data.globalLore.find((e) => e.comment === 'Plugin manifest');
  // 사진: 카드 사진 하나는 지문이 바뀌고 하나는 새로 생긴다 (나머지는 지문이 같아 받지 않음)
  const picBytes = [1, 2, 3, 4, 5];
  const picHash = createHash('sha1').update(Buffer.from(picBytes)).digest('hex').slice(0, 12);
  const pics = (manifest.pictures ?? []).map((x) => [...x]);
  assert.ok(pics.length > 100, '카드 매니페스트에 사진 목록');
  const changed = pics[0][0];
  pics[0] = [changed, picHash, 'avif', 5];
  pics.push(['NewPic', picHash, 'avif', 5]);
  man.content = JSON.stringify({ ...JSON.parse(man.content), version: '9.0.0', pictures: pics });
  const { page, errors } = await boot(fixture, { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '1' } });
  await page.evaluate((bytes) => { window.__picBytes = bytes; }, picBytes);
  await page.evaluate((p) => {
    // 실제처럼 목록(card-update.json)과 조각(card-update.N.txt)으로 나눠 준다
    const text = JSON.stringify(p);
    const parts = [text.slice(0, 1000), text.slice(1000, 50000), text.slice(50000)];
    window.__fetch = (url) => url.includes('version.json') ? { card: '9.0.0', plugin: '0.0.1', minPlugin: '0.0.1' }
      : url.includes('card-update.json') ? { schema: 1, version: p.version, minPlugin: '0.0.1', parts: parts.map((_, i) => `card-update.${i + 1}.txt`), length: text.length }
      : url.includes('/pic/') ? new Uint8Array(window.__picBytes)
      : (/card-update\.(\d+)\.txt/.exec(url) ? parts[+/card-update\.(\d+)\.txt/.exec(url)[1] - 1] : null);
    const dir = window.__char.globalLore.find((e) => e.comment === 'Directory');
    if (dir) dir.content = dir.content.replace('"schema"', '"내가 고친 값": 1, "schema"');
    window.__char.globalLore.push({ comment: '내가 넣은 로어북', content: '메모', key: '', mode: 'normal' });
  }, payload);
  await open(page);
  await page.waitForSelector('.upd-banner');
  assert.match(await page.textContent('.upd-banner'), /카드 v9\.0\.0/);
  if (shots) {
    await page.screenshot({ path: `${shots}/update-banner.png` });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/update-banner-m.png` });
    await page.setViewportSize({ width: 1100, height: 900 });
  }
  assert.equal(await page.locator('.gx-xdot').count(), 1, '설정 아이콘에 점');
  await page.click('[data-action="upd-skip"]');
  assert.equal(await page.locator('.upd-banner').count(), 0, '건너뛰면 안내가 사라짐');
  assert.equal(await page.evaluate(() => window.__store['p:goei:update-skip']), '9.0.0|');
  // 2026-10-27 설정 창 개편: 업데이트는 설정 창 「점검」 탭의 업데이트 페이지 (패널 설정 탭은 없앰)
  await edOpen(page, 'set:update');
  await page.click('.gw [data-action="upd-prepare"]');
  await page.waitForSelector('.gw .upd-plan');
  if (shots) await page.locator('.upd-plan').scrollIntoViewIfNeeded(), await page.screenshot({ path: `${shots}/update-settings.png` });
  assert.match(await page.textContent('.upd-plan'), /첫 안내/);
  assert.match(await page.textContent('.upd-plan'), /카드 사진: 바뀜 1 · 새로 1/);
  await page.click('.gw [data-action="upd-apply"]');
  await page.waitForFunction(() => window.__calls.setChar === 1);
  const ch = await page.evaluate(() => window.__char);
  const before = fixture.additionalAssets.find((r) => r[0] === changed);
  const after = ch.additionalAssets.find((r) => r[0] === changed);
  assert.notEqual(after[1], before[1], '지문이 바뀐 카드 사진은 새 것으로');
  assert.ok(ch.additionalAssets.some((r) => r[0] === 'NewPic'), '새 카드 사진 추가');
  assert.equal(ch.additionalAssets.length, fixture.additionalAssets.length + 1, '나머지 사진은 그대로');
  assert.equal((await page.evaluate(() => window.__calls.fetch.filter((u) => u.includes('/pic/')))).length, 2, '바뀐 사진만 받음');
  assert.equal(ch.firstMessage, '새 첫 안내');
  assert.match(ch.globalLore.find((e) => e.comment === 'Directory')?.content ?? '"내가 고친 값"', /내가 고친 값/, '명부는 보존');
  assert.ok(ch.globalLore.some((e) => e.comment === '내가 넣은 로어북'), '직접 넣은 로어북 유지');
  assert.equal(ch.name, fixture.name, '이름 유지');
  await page.waitForSelector('.gw .gx-hint');
  if (shots) await page.locator('.gw .gx-hint').last().scrollIntoViewIfNeeded().catch(() => {}), await page.screenshot({ path: `${shots}/update-done.png` });
  assert.match(await page.textContent('.gw .gw-setbody'), /v9\.0\.0으로 바꿨어요/);
  assert.equal(await page.locator('.gx-xdot').count(), 0, '최신이면 점 없음');
  assert.deepEqual(errors, []);
  console.log('PASS 업데이트: 새 버전 안내·건너뛰기·카드 업데이트(명부·직접 넣은 로어북·이름 유지, 바뀐 카드 사진만 받기)');
  await page.close();
}

// 시작기: Risu 플러그인 칸과 같은 격리(iframe sandbox + nonce CSP)에서 본체가 없으면 받기 창 → 받아서 실행
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.exposeFunction('__readAsset', (p) => {
    try { return readFileSync(new URL(p, `file://${fixtureDir}/`)).toString('base64'); } catch { return null; }
  });
  const nonce = 'n' + Math.random().toString(36).slice(2);
  // Risu src/ts/plugins/apiV3/factory.ts와 같은 정책
  const csp = `connect-src 'none'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval'; frame-src 'none'; object-src 'none'; style-src * 'unsafe-inline'; default-src 'none'; img-src * data: blob:; font-src * data: blob:; media-src * data: blob:; base-uri 'none';`;
  const inner = hostScript(fixture, { message: [], scriptstate: {} }, { noBody: true })
    + `\n(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}" id="csp-meta"></head>`
    + `<body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%;background:#f3f3f3"></div>`
    + `<script nonce="${nonce}">document.querySelector('meta#csp-meta')?.remove();\n${inner}</script></body></html>`;
  await page.setContent('<!doctype html><html><body style="margin:0"><iframe style="display:block;width:100vw;height:100vh;border:0"></iframe></body></html>');
  await page.evaluate(({ html, csp }) => {
    const f = document.querySelector('iframe');
    f.sandbox.add('allow-scripts');
    f.sandbox.add('allow-modals');
    f.setAttribute('csp', csp);
    f.srcdoc = html;
  }, { html, csp });
  let frame = null;
  for (let i = 0; i < 50 && !frame; i++) {
    frame = page.frames().find((f) => f !== page.mainFrame());
    if (!frame) await page.waitForTimeout(100);
  }
  await frame.waitForFunction(() => window.__calls?.replacers.length || window.__bootError);
  assert.equal(await frame.evaluate(() => window.__bootError ?? null), null);
  // 본체 없음 → 받기 실패 → 받기 창
  await frame.waitForSelector('.gl-card');
  if (shots) {
    await page.screenshot({ path: `${shots}/loader-panel.png` });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/loader-panel-m.png` });
    await page.setViewportSize({ width: 1100, height: 900 });
  }
  // 본체 조각 + 세계 자료 팩(개선 나1): 시작기는 본체만 받고, 본체가 뜨면서 세계 자료를 스스로 받아 저장한다
  const files = Object.fromEntries(['goei-body.json', ...JSON.parse(readFileSync(new URL('../dist/goei-body.json', import.meta.url), 'utf8')).parts]
    .map((n) => [n, readFileSync(new URL(`../dist/${n}`, import.meta.url), 'utf8')]));
  Object.assign(files, distPackFiles('goei-data-world'));
  await frame.evaluate((files) => {
    window.__fetch = (u) => { const name = u.split('?')[0].split('/').pop(); return files[name] ?? null; };
  }, files);
  await frame.click('[data-gl="get"]');
  await frame.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  assert.equal(await frame.locator('.gl-card').count(), 0, '받으면 창이 닫힘');
  assert.match(await frame.evaluate(() => window.__store['p:goei:body'].slice(0, 40)), /^\/\/ goei-body /);
  assert.equal(await frame.evaluate(() => window.__store['p:goei:data-world']?.length ?? 0), worldPack.length, '본체가 세계 자료 팩을 받아 저장');
  assert.ok((await frame.evaluate(() => window.__calls.fetch.map((u) => u.split('?')[0].split('/').pop()))).includes('goei-data-world.json'), '세계 자료 목록을 받음');
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.gx-fac');
  // 시작 카드 표시도 본체가 맡는다
  assert.match(await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">ANOMALY SIMULATION</div>')), /landing/);
  assert.deepEqual(errors, []);
  console.log('PASS 시작기: 격리 환경에서 본체 없음 → 받기 창 → 조각으로 받아 실행 → 창 열기');
  await page.close();
}

// 게임 창 (ui/game.ts): 머리 게임 버튼 → 시작 화면. (2026-10-23 시작 화면을 설정 틀로 바꾸며 「이어하기」(.gx-gl-cont)는 「들어가기」([data-g=play])가 됨. v0.17.7: 게임은 「필드」 탭. 메뉴의 「필드」(.gx-nav [data-value=field])로 연다 — 옛 game-open 단추 자리) 게임 파일(코드 팩)이 없으면 받기, 받은 뒤 저장 칸에서 시작.
// 정산 결과는 쌓아 두고 버튼을 눌러야만 채팅(전송 대기)과 기록 로어북에 쓴다.
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await page.click('[x-goei-fab] button');
  await page.click(FIELD);
  await page.waitForSelector('.gx-gl [data-g="get"]');
  assert.equal(await page.locator('.gx-gl [data-g="play"]:not([disabled])').count(), 0, '파일 받기 전에는 시작 못 함');
  await page.click('[data-g="get"]');
  await page.waitForSelector('.gx-settings [role=status]');
  assert.match(await page.textContent('.gx-settings [role=status]'), /받지 못했어요/);
  const gdir = new URL('../dist/game/', import.meta.url);
  const gameFiles = Object.fromEntries(readdirSync(gdir).map((n) => [n, readFileSync(new URL(n, gdir)).toString('base64')]));
  await page.evaluate((files) => {
    const bytes = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Uint8Array.from(atob(v), (c) => c.charCodeAt(0))]));
    window.__fetch = (u) => bytes[u.split('?')[0].split('/').pop()] ?? null;
  }, gameFiles);
  await page.click('[data-g="get"]');
  await page.waitForSelector('.gx-gl [data-g="play"]:not([disabled])');
  assert.match(await page.evaluate(() => window.__store['p:goei:game:code'].slice(0, 30)), /^\/\/ goei-game /);
  if (shots) {
    await page.screenshot({ path: `${shots}/game-home.png` });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/game-home-m.png` });
    await page.setViewportSize({ width: 1100, height: 900 });
  }
  assert.match(await page.textContent('.gx-gl'), /요원 \d+명/, '본편 명부를 읽음');
  await page.click('.gx-gl [data-g="play"]');
  await page.waitForSelector('.gx-game-box .goei-engine canvas');
  // 쟈알디 그림 팩을 받아 두었고, 엔진이 그 그림(blob 주소)을 쓴다
  assert.match(await page.evaluate(() => window.__store['p:goei:game:pack:jyaldi'].slice(0, 20)), /"hash"/);
  await page.waitForFunction(() => window.__goeiGameStats.urls() >= 2);
  // 통합 규격 3장: 게임 중에는 캔버스가 칸을 채운다. 2026-10-23 사용자 결정으로 게임은 창(상황창) 틀 안 필드 칸에서만 돈다
  // (src/ui/game.ts openGame 주석, host/game/viewport.ts inFrame: 돌려 보기 없음). 그래서 「창 전체의 절반 이상·폰 세로 돌려 채움·PC 1280 폭」 대신
  // 「필드 칸 안에 들어가고, 칸의 가로나 세로 한쪽을 꽉 채우고, 페이지가 스크롤되지 않음」을 본다
  const fit = [];
  for (const [w, h] of [[844, 390], [390, 844], [1280, 950], [1100, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const b = document.querySelector('.goei-engine canvas').getBoundingClientRect();
      const f = document.querySelector('.gx-fieldhost').getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), fw: Math.round(f.width), fh: Math.round(f.height), inside: b.left >= f.left - 1 && b.top >= f.top - 1 && b.right <= f.right + 1 && b.bottom <= f.bottom + 1, rot: !!document.querySelector('.gx-game.gx-rot'), scroll: document.scrollingElement.scrollHeight - innerHeight };
    });
    fit.push(`${w}×${h} → ${r.w}×${r.h} / 칸 ${r.fw}×${r.fh}`);
    if (shots) await page.screenshot({ path: `${shots}/game-engine-${w}x${h}.png` });
    assert.ok(r.inside, `캔버스가 필드 칸 밖으로 ${w}×${h} → ${JSON.stringify(r)}`);
    assert.ok(r.w >= r.fw - 2 || r.h >= r.fh - 2, `캔버스가 필드 칸을 한쪽도 못 채움 ${w}×${h} → ${JSON.stringify(r)}`);
    assert.equal(r.rot, false, '틀 안에서는 돌려 보이지 않음');
    assert.ok(r.scroll <= 0, `페이지 스크롤 ${r.scroll}`);
  }
  console.log('FIT 게임 캔버스', fit.join(' · '));
  // 정산 결과가 쌓였을 때 (엔진은 본부 정산에서 bridge.report를 부른다. 여기서는 결과를 직접 넣는다)
  const before = await page.evaluate(() => window.__calls.setChat.length);
  await page.evaluate(() => (window.__store['p:goei:game:reports'] = JSON.stringify([{ at: 1, report: { id: 't1', mission: '조사: 로비 규칙', outcome: 'return', depth: 'L2', agents: [{ id: 'jyaldi', name: '쟈알디' }], rules: ['인사는 두 번'], loot: [], summary: '로프로 귀환' } }])));
  assert.equal(await page.evaluate(() => window.__calls.setChat.length), before, '결과만으로는 채팅을 바꾸지 않음');
  // 시작 화면(정산 결과)은 필드를 나왔다 다시 들어가면 보인다 (게임 머리의 「시작 화면」 단추는 필드 탭에서 숨김)
  await leaveField(page);
  await page.click(FIELD);
  await page.waitForSelector('[data-g="post"]');
  if (shots) await page.screenshot({ path: `${shots}/game-report.png` });
  await page.click('[data-g="post"]');
  await page.waitForSelector('[data-g="post"][disabled]');
  const last = await page.evaluate(() => window.__chat.message.at(-1));
  assert.equal(last.role, 'user');
  assert.match(last.data, /^\[관리국 출동 보고서\]/);
  assert.match(last.data, /%%GOEI_UNSENT%%/, '전송 대기로 놓음');
  await page.click('[data-g="record"]');
  await page.waitForSelector('[data-g="unrecord"]');
  assert.equal(await page.evaluate(() => window.__chat.localLore.filter((e) => e.comment === '관리국 훈련 기록').length), 1);
  // 닫았다 다시 열면 저장 칸이 남아 있고, 코드는 다시 받지 않는다
  await page.evaluate(() => (window.__calls.fetch = []));
  await leaveField(page);
  assert.equal(await page.locator('.gx-game').count(), 0);
  await page.click(FIELD);
  await page.waitForSelector('.gx-gl [data-g="play"]');
  await page.click('.gx-gl [data-g="play"]');
  await page.waitForSelector('.gx-game-box .goei-engine canvas');
  assert.equal(await page.evaluate(() => (window.__calls.fetch ?? []).filter((u) => /goei-game\.\d/.test(u)).length), 0, '코드는 저장해 둔 것');
  // 게임 중에는 필드 칸 전체(gx-full). 2026-10-23 사용자: 게임은 창 틀 안에서만 돈다(전체화면이면 Risu 경고·메뉴·뒤로가기가 가려짐) →
  // 틀 안(inFrame)에서는 세로로 든 폰이라도 돌려 보이지 않는다 (host/game/viewport.ts apply). 그래서 「돌려 보기」 단언을 「안 돌림」으로 바꿈
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  await page.waitForSelector('.gx-game.gx-full:not(.gx-rot)');
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForSelector('.gx-game.gx-full:not(.gx-rot)');
  await leaveField(page);
  assert.deepEqual(errors, []);
  console.log('PASS 게임 창: 파일 받기 실패 안내 → 받기(코드·쟈알디 팩) → 통합 엔진 시작 → 결과는 버튼으로만 채팅·로어북 → 다시 열면 이어하기 → 돌려 보기');
  await page.close();
}

// 게임 창 측정: 처음 받기·저장해 둔 코드로 열기·열고 닫기 반복 힙·큰 자산 팩 넣기 (CPU 4배 느리게 = 중급 폰 흉내)
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heapMB = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const m = (await cdp.send('Performance.getMetrics')).metrics.find((x) => x.name === 'JSHeapUsedSize');
    return +(m.value / 1048576).toFixed(1);
  };
  await startedWithReply(page);
  await page.click('[x-goei-fab] button');
  const gdir = new URL('../dist/game/', import.meta.url);
  const gameFiles = Object.fromEntries(readdirSync(gdir).map((n) => [n, readFileSync(new URL(n, gdir)).toString('base64')]));
  await page.evaluate((files) => {
    const bytes = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Uint8Array.from(atob(v), (c) => c.charCodeAt(0))]));
    // 받기마다 40ms (느린 망 흉내는 아님, 요청 수만큼 지연)
    window.__fetch = (u) => bytes[u.split('?')[0].split('/').pop()] ?? null;
  }, gameFiles);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const base = await heapMB();
  const t0 = Date.now();
  await page.click(FIELD);
  await page.waitForSelector('[data-g="get"]');
  const homeMs = Date.now() - t0;
  const t1 = Date.now();
  await page.click('[data-g="get"]');
  await page.waitForSelector('.gx-gl [data-g="play"]:not([disabled])');
  const getMs = Date.now() - t1;
  const t2 = Date.now();
  await page.click('.gx-gl [data-g="play"]');
  await page.locator('.gx-game-box .goei-engine canvas').first().waitFor(); // waitForSelector 는 요소 손잡이를 돌려줘 닫은 캔버스(게임)를 붙잡아 힙 측정을 흐린다
  const playMs = Date.now() - t2;
  await page.waitForTimeout(3000);
  const playing = await heapMB();
  const cycles = [];
  for (let i = 0; i < 5; i++) {
    await leaveField(page);
    await page.waitForTimeout(100);
    cycles.push(await heapMB());
    await page.click(FIELD);
    await page.waitForSelector('.gx-gl [data-g="play"]');
    await page.click('.gx-gl [data-g="play"]');
    await page.locator('.gx-game-box .goei-engine canvas').first().waitFor(); // waitForSelector 는 요소 손잡이를 돌려줘 닫은 캔버스(게임)를 붙잡아 힙 측정을 흐린다
    await page.waitForTimeout(500);
  }
  await leaveField(page);
  const closed = await heapMB();
  const st = await page.evaluate(() => ({ code: { ...window.__goeiGameStats.code }, fetch: { ...window.__goeiGameStats.fetch }, urls: window.__goeiGameStats.urls() }));
  // 저장해 둔 코드를 새 페이지에서 꺼내 실행하는 시간 (본체의 메모리 캐시 없이)
  const stored = await page.evaluate(() => window.__store['p:goei:game:code']);
  const page2 = (await boot(fixture, { message: [], scriptstate: {} })).page;
  await page2.evaluate((code) => (window.__store['p:goei:game:code'] = code), stored);
  const cdp2 = await page2.context().newCDPSession(page2);
  await cdp2.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await startedWithReply(page2);
  await page2.click('[x-goei-fab] button');
  await page2.click(FIELD);
  await page2.waitForSelector('.gx-gl [data-g="play"]:not([disabled])');
  const t3 = Date.now();
  await page2.click('.gx-gl [data-g="play"]');
  await page2.waitForSelector('.gx-game-box .goei-engine canvas');
  const warmMs = Date.now() - t3;
  const warm = await page2.evaluate(() => ({ ...window.__goeiGameStats.code, ...window.__goeiGameStats.game }));
  // 큰 자산 팩 (그림 200장 × 40KB = 8MB) 넣기·꺼내기
  const big = await page2.evaluate(async () => {
    const n = 200, size = 40 * 1024;
    const files = [];
    let at = 0;
    for (let i = 0; i < n; i++) (files.push([`f${i}.png`, at, size]), (at += size));
    const head = new TextEncoder().encode(JSON.stringify({ id: 'bigtest', version: 1, hash: 'h1', atlas: { n }, files }));
    const out = new Uint8Array(12 + head.length + at);
    out.set(new TextEncoder().encode('GOEIPACK'));
    new DataView(out.buffer).setUint32(8, head.length, true);
    out.set(head, 12);
    for (let i = 12 + head.length; i < out.length; i += 1) out[i] = (i * 2654435761) >>> 24;
    window.__bigPack = out;
    return out.length;
  });
  await leaveField(page2);
  await page2.click(FIELD);
  await page2.waitForSelector('.gx-gl [data-g-file]', { state: 'attached' });
  const tb = Date.now();
  await page2.evaluate(async () => {
    const dt = new DataTransfer();
    dt.items.add(new File([window.__bigPack], 'bigtest.pack'));
    const input = document.querySelector('[data-g-file]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page2.waitForFunction(() => /넣었어요: 팩 bigtest/.test(document.querySelector('.gx-settings [role=status]')?.textContent ?? ''), null, { timeout: 120000 });
  const installMs = Date.now() - tb;
  const storedLen = await page2.evaluate(() => window.__store['p:goei:game:pack:bigtest'].length);
  assert.deepEqual(errors, []);
  const report = {
    bodyKB: Math.round(readFileSync(new URL('../dist/goei-body.js', import.meta.url)).length / 1024),
    gameCodeKB: Math.round(st.code.bytes / 1024),
    cpu: '4x 느리게',
    homeMs, getMs, getRequests: st.fetch.requests, getKB: Math.round(st.fetch.bytes / 1024), playMs,
    warm: { clickToCanvasMs: warmMs, readMs: warm.readMs, runMs: warm.runMs, mountMs: warm.mountMs },
    heapMB: { base, playing, afterClose: cycles, final: closed }, liveUrlsAfterClose: st.urls,
    bigPack: { MB: +(big / 1048576).toFixed(1), installMs, storedMB: +(storedLen / 1048576).toFixed(1) },
  };
  console.log('MEASURE 게임 창', JSON.stringify(report));
  writeFileSync(new URL('../dist-test/game-measure.json', import.meta.url), JSON.stringify(report, null, 1));
  // 기준: 처음 닫은 뒤(게임 코드 실행·받은 파일이 가짜 저장소 window.__store 에 문자열로 남은 뒤). 예전 기준(게임을 받기 전 base)은
  // 받은 양(지금 약 9MB, 시험 가짜 저장소의 문자열)과 실행한 게임 코드까지 「남은 힙」으로 세어 누수와 섞였다 (2026-10-28 QC: 진짜 누수는 열고 닫을 때마다 ~10MB 씩 늘던 것, 고침)
  assert.ok(closed - cycles[0] < 8, `열고 닫기를 되풀이하면 힙이 늘어남 ${cycles.join(' → ')} → ${closed}`);
  assert.ok(Math.max(...cycles) - cycles[0] < 4, `닫을 때마다 힙이 쌓임 ${cycles.join(' → ')}`);
  console.log('PASS 게임 창 측정');
  await page.close();
  await page2.close();
}

// 17b) 설정 창 머리 고정 · 화면 설정(메뉴 위치·창 바깥 불투명도) · 기능별 설정 페이지 · 거점 목록
// 2026-10-27 설정 창 개편으로 옮김: 예전 패널 설정 탭의 「설정·명부」 줄(.st-scopebar)과 명부 분류 줄(.dir-kinds) 고정은, 설정 창(.gw)의
// 머리(.gw-top: 저장·닫기)와 왼쪽 목록이 격자로 고정이고 본문만 스크롤하는 것으로 바뀌었다. 기능별 설정 단추(feature-set)는 「기능」 탭 목록의
// 페이지(set:wiki·set:gnet…), 명부의 종류 탭은 「세계」 탭 목록. 그래서 같은 뜻(스크롤해도 머리·분류가 제자리, 기능 설정으로 바로 감)을 새 구조에서 본다
for (const vp of [{ width: 1100, height: 900 }, { width: 390, height: 844 }]) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, vp);
  await startedWithReply(page);
  await open(page);
  const m = vp.width < 500 ? 'm' : 'pc';
  if (m === 'pc') await edOpen(page, 'set:board');
  else {
    // 폰 하단 메뉴에는 설정이 없고 머리의 설정 단추로 연다
    await page.click('.gx-head [data-action="ed-open"]');
    await page.waitForFunction(() => { const g = document.querySelector('.gw'); return g && !g.hidden && g.querySelector('.gw-win'); });
    await edGo(page, 'set:board');
  }
  // 본문에서 가장 긴 스크롤 칸을 끝까지 내려도 창 머리는 창 맨 위
  const stuck = () => page.evaluate(() => {
    const cands = [document.querySelector('.gw .gw-body'), ...document.querySelectorAll('.gw .gw-body *')].filter((e) => e && e.scrollHeight - e.clientHeight > 50 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    const body = cands.sort((x, y) => (y.scrollHeight - y.clientHeight) - (x.scrollHeight - x.clientHeight))[0];
    body.scrollTop = body.scrollHeight;
    const w = document.querySelector('.gw .gw-win').getBoundingClientRect();
    const t = document.querySelector('.gw .gw-top').getBoundingClientRect();
    return { gap: Math.round(t.top - w.top), scrolled: body.scrollTop > 200, topVisible: t.height > 0 };
  });
  const a = await stuck();
  assert.ok(a.scrolled && a.gap <= 2 && a.topVisible, `설정 창 머리 고정 ${JSON.stringify(a)}`);
  if (shots) await page.screenshot({ path: `${shots}/17b-set-sticky-${m}.png` });
  if (m === 'pc') {
    // 화면: 메뉴 오른쪽, 창 바깥 불투명도 0% (설정 창의 「화면」 페이지)
    await edGo(page, 'set:screen');
    const setDim = (pg, n) => pg.$eval('.gw input[data-input="dim"]', (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, n);
    await page.click('.gw [data-action="set-nav"][data-value="right"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.nav === 'right');
    assert.ok(await page.evaluate(() => document.querySelector('.gx-nav').getBoundingClientRect().left > document.querySelector('.gx-content').getBoundingClientRect().left), '메뉴가 오른쪽');
    await setDim(page, 0);
    await page.waitForFunction(() => /rgba\(3, 7, 9, 0\)|transparent/.test(getComputedStyle(document.querySelector('.gx')).backgroundColor));
    await setDim(page, 100);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.gx')).backgroundColor === 'rgb(3, 7, 9)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gx-hsep')).color === 'rgb(0, 0, 0)'), false, '글자색 변수 그대로');
    await setDim(page, 0);
    if (shots) await page.screenshot({ path: `${shots}/17b-nav-right.png` });
    await page.click('.gw [data-action="set-nav"][data-value="left"]');
    await setDim(page, 50);
    // 기능별 설정: 「기능」 탭 목록에서 그 기능의 설정 페이지를 바로 연다
    assert.equal(await page.evaluate(() => document.querySelector('.gw .gw-tab')?.dataset.value), 'set', '기능 탭이 맨 앞');
    await edGo(page, 'set:wiki');
    await page.waitForSelector('.gw .nw-setpane');
    await edGo(page, 'set:gnet');
    await page.waitForSelector('.gw [data-action="gn-cfg"]');
    if (shots) {
      await edGo(page, 'set:board');
      await page.evaluate(() => document.querySelector('.gw .ps-cards').scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${shots}/16-settings-lower.png` });
    }
  }
  // 명부(세계 탭): 요원 기록을 끝까지 내려도 머리 고정, PC 는 목록 도구(검색·추가)도 제자리 (목록·상세가 따로 스크롤)
  await edGo(page, 'agent');
  await page.evaluate(() => { const s = document.querySelector('.gw .gw-list-pick'); s.value = '쟈알디'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('쟈알디'));
  const bar = await stuck();
  const tools = await page.evaluate(() => { const t = document.querySelector('.gw .gw-list-tools').getBoundingClientRect(); const top = document.querySelector('.gw .gw-top').getBoundingClientRect(); return Math.round(t.top - top.bottom); });
  // 폰(760 이하)은 사용자 규격(2026-10-27)대로 한 열: 목록 대신 맨 위 드롭다운이 본문과 같이 내려가므로 머리 고정만 본다
  assert.ok(bar.scrolled && bar.gap <= 2 && (m !== 'pc' || (tools >= 0 && tools <= 10)), `명부 머리·목록 도구 고정 ${JSON.stringify(bar)} ${tools}`);
  if (shots) await page.screenshot({ path: `${shots}/17b-dir-sticky-${m}.png` });
  await edGo(page, 'base');
  await page.waitForSelector('.gw .gw-basepage .dir-row');
  assert.equal(await page.locator('.gw .gw-basepage .dir .dir-group').count(), 0, '거점 탭은 조직 제목 없음');
  if (shots) await page.screenshot({ path: `${shots}/17b-bases-${m}.png` });
  assert.deepEqual(errors, []);
  await page.close();
}
console.log('PASS 설정·명부 줄 고정, 거점 목록');

// 17c) 위키 사진은 에셋 모듈의 「영문명_default」도 찾는다. 명부에서 거점을 추가하면 덮어쓰기 전에도 임무 지도에 보인다
if (fixture.globalLore.some(packed)) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await page.evaluate(() => {
    window.__assets['mod/ldh.png'] = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    window.__assets['mod/org.png'] = window.__assets['mod/ldh.png'];
    window.__modules = [{ id: 'm1', name: '괴이 에셋', assets: [['Lee Do-hyeong_default', 'mod/ldh.png', 'png'], ['Management Bureau_default', 'mod/org.png', 'png']] }];
  });
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="wiki"]');
  await page.waitForSelector('.nw-home');
  for (let i = 0; i < 3 && !(await page.locator('.nw-dochead').count()); i++) {
    await page.fill('.nw-home .gx-search', '관리국');
    await page.press('.nw-home .gx-search', 'Enter');
    await page.waitForSelector('.nw-dochead', { timeout: 4000 }).catch(() => {});
  }
  await page.waitForSelector('.nw-ibphoto img');
  // 요원 기본 그림은 이제 카드에 있다 (v0.16.33). 모듈에서 찾기는 카드에 없는 「관리국」 대표 그림으로 본다
  assert.ok(await page.evaluate(() => window.__calls.read.includes('mod/org.png')), '모듈의 _default 사진');
  // 거점 추가 → 덮어쓰기 없이 임무 지도
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="settings"] >> nth=0');
  await page.click('[data-action="set-scope"][data-value="card"]');
  await page.click('[data-action="dir-kind"][data-value="base"]');
  await page.click('[data-action="dir-add-toggle"]');
  await page.fill('input[name="dir-base-new"]', '시험 거점');
  await page.click('[data-action="dir-base-new"][data-take="dir-base-new"]');
  await page.waitForSelector('.dir-row:has-text("시험 거점")');
  assert.equal(await page.evaluate(() => window.__calls.setChar || 0), 0, '저장하지 않음');
  assert.equal(await page.inputValue('select[data-change="dir-base-gu"]'), '', '새 거점은 시군구를 안 고른 채로');
  assert.match(await page.textContent('.dir-row.open .dir-name small'), /· 서울특별시$/, '시군구 없으면 시도만');
  const sido = await page.inputValue('.dir select[data-change^="dir-base-sido"], .dir select[name*="sido"]').catch(() => '02');
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="map"] >> nth=0');
  await page.waitForSelector('.gx-field');
  await page.selectOption('select[data-change="map-region"]', sido.split('=').pop() || '02');
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => [...document.querySelectorAll('.gx-field .fac')].some((p) => p.textContent.includes('시험 거점')));
  assert.ok(seen, '새 거점이 임무 지도에 보임');
  if (shots) await page.screenshot({ path: `${shots}/17c-map-newbase.png` });
  // 괴이 사진 고르기 → 저장하면 명부에 남음
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="settings"] >> nth=0');
  await page.click('[data-action="set-scope"][data-value="card"]');
  // 고친 값이 있는 채로 로어북에 새 세력·괴이를 넣고 「다시 읽기」 → 새 줄만 들어오고 새 거점은 그대로
  await page.evaluate(() => {
    const lore = window.__char.globalLore;
    const key = (name) => lore.find((e) => e.mode === 'folder' && e.comment === name)?.key;
    lore.push({ comment: '시험 결사', content: '### Test Society', key: 'Test Society, 시험 결사', folder: key('🌆세력'), mode: 'normal' });
    lore.push({ comment: '시험 괴이', content: '괴이', key: 'Test Anomaly', folder: key('🚧괴이'), mode: 'normal' });
  });
  await page.click('[data-action="dir-reload"]');
  await page.click('[data-action="dir-kind"][data-value="org"]');
  await page.waitForSelector('.dir-head[data-value="시험 결사"]');
  await page.click('[data-action="dir-kind"][data-value="anomaly"]');
  await page.waitForSelector('.dir-head[data-value="시험 괴이"]');
  await page.click('[data-action="dir-kind"][data-value="base"]');
  await page.waitForSelector('.dir-head[data-value="시험 거점"]');
  await page.click('[data-action="dir-kind"][data-value="anomaly"]');
  const first = await page.getAttribute('.dir-head >> nth=0', 'data-value');
  await page.click('.dir-head >> nth=0');
  await page.click(`[data-action="dir-photo-pick"]`);
  await page.fill('[data-input="dir-photo-q"]', 'lee do');
  await page.waitForSelector('.dir-pic[data-value^="Lee Do-hyeong|"]');
  await page.waitForTimeout(300);
  if (shots) await page.locator(".dir-pics").scrollIntoViewIfNeeded(), await page.screenshot({ path: `${shots}/17c-photo-pick.png` });
  assert.equal(await page.inputValue('[data-input="dir-photo-q"]'), 'lee do', '사진이 늦게 와도 검색어 유지');
  await page.click('.dir-pic[data-value^="Lee Do-hyeong|"]');
  await page.waitForSelector('.dir-photo-name b:has-text("Lee Do-hyeong")');
  if (shots) await page.screenshot({ path: `${shots}/17c-photo-picked.png` });
  // 조직 영문명 → 위키 조직 사진은 「영문명_default」
  await page.click('[data-action="dir-kind"][data-value="org"]');
  await page.click('.dir-head[data-value="관리국"]');
  await page.fill('[data-input="dir"][data-key="org:english|관리국"]', 'Management Bureau');
  await page.click('.dir-bar [data-value="save"]');
  await page.click('[data-action="dir-save"]');
  await page.waitForFunction(() => window.__calls.setChar >= 1);
  const book = await page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content));
  assert.equal(book.괴이[first].photo, 'Lee Do-hyeong', '괴이 사진 저장');
  assert.ok(book.거점['시험 거점'], '거점도 저장');
  assert.equal(book.조직.관리국.english, 'Management Bureau');
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="wiki"] >> nth=0');
  await page.waitForSelector('.nw-rail');
  await page.click('.nw-grab');
  await page.fill('.nw .ph-search', '관리국');
  await page.press('.nw .ph-search', 'Enter');
  await page.waitForSelector('.nw-dochead');
  await page.waitForFunction(() => window.__calls.read.includes('mod/org.png'));
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS 위키 모듈 사진, 저장 전 새 거점 지도 표시, 괴이 사진 고르기');
}

// 17d) 얼굴 사진: 「영문명」 그림이 없으면 대표(「영문명_default」)에서 얼굴 틀만큼 잘라 쓴다. 명부에서 틀을 맞추면 저장된다
if (fixture.globalLore.some(packed)) {
  for (const vp of [{ width: 1100, height: 900 }, { width: 390, height: 844 }]) {
    const mobile = vp.width < 760;
    const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, vp);
    await startedWithReply(page);
    // 픽스처 옆에 face-test.avif(카우보이샷)가 있으면 그것을, 없으면 세로 그림을 만들어 쓴다
    const real = await page.evaluate(() => window.__readAsset('face-test.avif'));
    await page.evaluate(async (real) => {
      if (!real) {
        const c = Object.assign(document.createElement('canvas'), { width: 200, height: 300 });
        const g = c.getContext('2d');
        g.fillStyle = '#ccc'; g.fillRect(0, 0, 200, 300);
        g.fillStyle = '#c33'; g.beginPath(); g.arc(100, 60, 30, 0, 7); g.fill();
        const b = await new Promise((r) => c.toBlob(r, 'image/png'));
        window.__assets['face-test.avif'] = new Uint8Array(await b.arrayBuffer());
      }
      window.__char.additionalAssets = window.__char.additionalAssets.filter((a) => a[0] !== 'Lee Do-hyeong');
      window.__modules = [{ id: 'm1', name: '괴이 에셋', assets: [['Lee Do-hyeong_default', 'face-test.avif', 'avif']] }];
    }, real);
    await open(page);
    await page.locator(':is([data-action="tab"], [data-action="nav-tab"])[data-value="settings"]:visible').first().click();
    await page.click('[data-action="set-scope"][data-value="card"]');
    await page.click('[data-action="dir-kind"][data-value="agent"]');
    const row = page.locator('.dir-row', { has: page.locator('.dir-name b', { hasText: '이도형' }) });
    await row.locator('.dir-head').click();
    await page.waitForSelector('.dir-photo-name small:has-text("대표 사진에서 잘라요")');
    await page.click('[data-action="dir-crop"]');
    await page.waitForSelector('[data-crop] img');
    const box = await page.locator('[data-crop] img').boundingBox();
    // 틀을 오른쪽 아래로 끌어 옮긴다
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.3, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    if (shots) await page.locator('.dir-crop').scrollIntoViewIfNeeded(), await page.screenshot({ path: `${shots}/17d-face-crop-${mobile ? 'm' : 'pc'}.png` });
    // 요원 목록 줄 아바타도 잘린 얼굴
    assert.ok(await row.locator('.dir-head .gx-ava img').count(), '목록 줄에 얼굴');
    const size = await row.locator('.dir-head .gx-ava img').evaluate((im) => [im.naturalWidth, im.naturalHeight]);
    assert.equal(size[0], size[1], `얼굴은 네모로 잘림 (${size})`);
    if (!mobile) {
      await page.click('.dir-bar [data-value="save"]');
      await page.click('[data-action="dir-save"]');
      await page.waitForFunction(() => window.__calls.setChar >= 1);
      const book = await page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content));
      const saved = Object.values(book.요원).find((a) => a.english === 'Lee Do-hyeong');
      const [x, y] = saved.crop.split(',').map(Number);
      assert.ok(x > 55 && y > 25, `틀 위치 저장 (${saved.crop})`);
      // 상황판 요원 카드도 얼굴 사진
      await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="board"] >> nth=0');
      await page.waitForTimeout(500);
      if (shots) await page.screenshot({ path: `${shots}/17d-board-pc.png` });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS 얼굴 사진: 대표 사진에서 자르기, 틀 맞추기 저장');
}

// 즐겨찾기: PC ‹ ★ › 창에서 넣기·가기·빼기, 뒤로, 모바일 서랍 안내·좌우 밀기·칸
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, { width: 1280, height: 860 });
  await startedWithReply(page);
  await open(page);
  const tabNow = () => page.evaluate(() => document.querySelector('.gx').dataset.tab);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="wiki"]');
  await page.waitForSelector('.nw-home');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  assert.equal(await page.locator('.gx-nh[data-action="nav-back"]').isDisabled(), false, '뒤로 갈 곳이 있으면 켜짐');
  await page.click('.gx-nh.mk-star');
  await page.waitForSelector('.mk-pop');
  assert.ok((await page.textContent('.mk-pop')).includes('위키 메인'), '최근 본 화면');
  await page.click('.mk-pop [data-action="mk-add"]');
  await page.click('.mk-pop [data-action="mk-here"]');
  const saved = JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs']));
  assert.deepEqual(saved.marks.map((m) => m.name), ['위키 메인', '상황판']);
  if (shots) await page.screenshot({ path: `${shots}/19-marks-pop.png` });
  await page.click('.mk-pop [data-action="mk-go"][data-value="0"]');
  assert.equal(await tabNow(), 'wiki');
  assert.equal(await page.locator('.mk-pop').count(), 0, '가면 창 닫힘');
  await page.click('.gx-nh[data-action="nav-back"]');
  assert.equal(await tabNow(), 'board', '‹ 는 바로 전 화면');
  await page.click('.gx-nh.mk-star');
  await page.click('.mk-pop [data-action="mk-del"][data-value="1"]');
  assert.equal(JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs'])).marks.length, 1);
  await page.click('.mk-head [data-action="mk-pop"]');
  // 모바일: 서랍에 즐겨찾기 칸, 비었으면 안내, 펼친 서랍을 좌우로 밀면 ★ 창
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="board"]:visible');
  await page.click('.gx-bdrawer .ph-grip');
  assert.equal(await page.locator('.gx-bdrawer .mk-slot:not(.empty)').count(), 1);
  assert.equal(await page.locator('.gx-bdrawer [data-action="game-open"], .gx-bdrawer [data-value="settings"]').count(), 0, '순찰·설정 버튼은 뺌');
  await page.click('.gx-bdrawer .mk-slot:not(.empty)');
  assert.equal(await tabNow(), 'wiki', '칸을 누르면 그 화면');
  assert.equal(await page.locator('.ph-drawer.open').count(), 0, '서랍에서 가면 서랍은 접힘');
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="board"]:visible');
  await page.click('.gx-bdrawer .ph-grip');
  await page.click('.gx-bdrawer .mk-slot.empty >> nth=0');
  await page.waitForSelector('.mk-pop');
  await page.click('.mk-pop [data-action="mk-del"][data-value="0"]');
  await page.click('.mk-head [data-action="mk-pop"]');
  await page.waitForSelector('.gx-bdrawer .mk-hint');
  if (shots) await page.screenshot({ path: `${shots}/19-marks-mobile-hint.png` });
  await page.evaluate(() => {
    const el = document.querySelector('.gx-bdrawer .mk-hint');
    const r = el.getBoundingClientRect();
    const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: r.top + 10 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(300)], changedTouches: [t(300)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(150)] }));
  });
  await page.waitForSelector('.mk-pop');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS 즐겨찾기: ★ 창 넣기·가기·빼기, ‹ › 앞뒤, 모바일 서랍 칸·안내·좌우 밀기');
}

// 32) 기록 탭 (2026-10-29 사용자 결정, docs/설계안_기록_보고서.md 5장 · 묶음 2): 왼쪽 메뉴 「기록」(가계부 자리) · 하위 탭 넷 같은 너비 ·
//     사원증 줄 순서(사진·이름+소속 칩·잔고·위치)와 잔고 줄 → 가계부 · 위키 홈에 인물 타일 없음 · 가짜 응답으로 사건 종료(목표였던 괴이 → 내가 출동)
//     → 일지 줄·보고서 카드·상황판 종료 줄 아이콘·큰 보기 단추·종료 알림 · 보고서 페이지(뒤로·단추 자리·고정) · 찾기 칸 포커스 ·
//     즐겨찾기 저장·복원 · 옛 즐겨찾기(위키 인물)가 기록 탭으로 · 요원 격자 → 사원증 창 「기록」 · 설정 「기록」 묶음 · 폰 390×844 가로 넘침 0
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, { width: 1280, height: 900 });
  const { preset, where } = await startedWithReply(page);
  await open(page);
  await page.waitForSelector('.gx-board');
  const tabNow = () => page.evaluate(() => document.querySelector('.gx').dataset.tab);
  // 왼쪽 메뉴: 「기록」 있음, 「가계부」 없음 (메뉴 수 그대로)
  assert.equal(await page.locator('.gx-nav > .gx-nb.desk[data-value="records"]').count(), 1, '메뉴에 기록');
  assert.equal(await page.locator('.gx-nav > .gx-nb[data-value="wallet"]').count(), 0, '메뉴에 가계부 없음');
  // 사원증: 원본 구조(사진 → 이름·소속 한 줄 → 잔고·위치·시각 줄). 2026-10-29 사용자: 이름과 소속만 한 줄, 나머지는 손대지 않음
  const idOrder = await page.$$eval('.gx-nav-brand .gx-id > *', (l) => l.map((e) => e.className.split(' ')[0]));
  assert.ok(idOrder.indexOf('gx-id-photo') < idOrder.indexOf('gx-id-who') && idOrder.indexOf('gx-id-who') < idOrder.indexOf('gx-op-st'), idOrder.join(','));
  assert.ok((await page.textContent('.gx-nav-brand .gx-id-who small')).includes('관리국'), '소속');
  assert.equal(await page.$eval('.gx-nav-brand .gx-id-who', (e) => getComputedStyle(e).flexDirection), 'row', '이름·소속 한 줄');
  assert.deepEqual(await page.$$eval('.gx-nav-brand .gx-op-st > .gx-op-ln', (l) => l.map((e) => e.querySelector('i')?.textContent)), ['잔고', '위치']);
  assert.ok((await page.textContent('.gx-nav-brand .gx-op-meta')).includes('02:47'), '시각 줄');
  // 잔고 줄 → 가계부 화면 (메뉴 없이도)
  await page.click('.gx-nav-brand .gx-wallet');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await tabNow(), 'wallet');
  // 기록 탭: 하위 탭 넷, 같은 너비, 빈 일지, 「오늘 일지 이미지로」 없음
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="records"]');
  await page.waitForSelector('.gx-records');
  assert.deepEqual(await page.$$eval('.gx-rec-tabs .gx-seg', (l) => l.map((b) => b.textContent)), ['일지', '보고서', '인물', '세력']);
  const widths = await page.$$eval('.gx-rec-tabs .gx-seg', (l) => l.map((b) => b.getBoundingClientRect().width));
  assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, `하위 탭 같은 너비 (${widths.join(',')})`);
  assert.ok((await page.textContent('.gx-records')).includes('아직 종료된 상황이 없어요'));
  assert.equal(await page.locator('.gx-records button:has-text("이미지로")').count(), 0, '「오늘 일지 이미지로」 단추 없음');
  // 인물·세력 하위 탭은 위키에 있던 화면 그대로 (뒤로 단추 없는 머리)
  await page.click('[data-action="rec-sub"][data-value="people"]');
  await page.waitForSelector('.gx-records .pp-pane');
  assert.ok((await page.textContent('.gx-records .pp-pane .ph-room-title')).includes('이 채팅의 인물'));
  assert.equal(await page.locator('.gx-records .pp-pane .ph-back').count(), 0, '하위 탭 뿌리엔 뒤로 없음');
  await page.click('[data-action="rec-sub"][data-value="factions"]');
  await page.waitForSelector('.gx-records .pp-pane');
  assert.ok((await page.textContent('.gx-records .pp-pane .ph-room-title')).includes('세력'));
  // 위키 홈: 「이 채팅의 기록」 섹션·타일 없음 (위키는 문서만)
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="wiki"]');
  await page.waitForSelector('.nw-home');
  assert.equal(await page.locator('.nw-tile.k-pp, [data-action="wiki-people"]').count(), 0, '위키 홈에 인물 타일 없음');
  assert.ok(!(await page.textContent('.nw-home')).includes('이 채팅의 기록'));
  // 가짜 응답으로 진행 → 종료 (상태창 목표가 이 괴이였으니 touched → 내가 출동 → 전체 보고서)
  const fire = (reply) => page.evaluate(async (reply) => {
    window.__chat.message.push({ role: 'user', data: '계속' }, { role: 'char', data: reply });
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
    const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
  }, reply);
  const enterReply = ['진입', `[AN|${where}|${preset.name}|활성|A|P001, P002|셔터 안쪽으로 진입했다]`, '[AG|P002|작전투입|현장]', `[▣|2025.01.01|03:30 AM|☀️|4°C|${where} 지하|${preset.name}]`].join('\n');
  const endReply = ['종료', `[AN|${where}|${preset.name}|격리|A|P001, P002|격리 완료. 현장 봉쇄 해제]`, '[AG|P001|휴게|사무실]', '[AG|P002|부상|병원]', '[▣|2025.01.01|04:11 AM|☀️|4°C|관리국 본부|없음]'].join('\n');
  await fire(enterReply);
  // 저장마다(가짜 Risu setChatToIndex) 그 자리에서 display 처리기를 불러 본다 — 실제 Risu 가 저장 직후 메시지를 다시 그리는 시점을 흉내.
  // 응답 처리는 종료를 저장한 뒤 카드 열쇠 표를 채우고 채팅을 그대로 한 번 더 저장해야 한다 (안 그러면 첫 그리기에 카드가 없다)
  await page.evaluate((endReply) => {
    window.__cardSaves = [];
    // 가짜 setChatToIndex 는 저장마다 __calls.setChat 에 push 한다 — 그 push 를 가로채 그 순간의 display 결과를 적는다
    const arr = window.__calls.setChat;
    arr.push = function (...a) {
      const r = Array.prototype.push.apply(this, a);
      const i = window.__cardSaves.push(null) - 1; // display 처리기가 비동기여도 저장 순서 자리를 지킨다
      Promise.resolve().then(() => window.__calls.handlers.display(endReply)).then((h) => { window.__cardSaves[i] = String(h).includes('data-goei-card="report"'); }, (e) => { window.__cardSaves[i] = `오류: ${e && e.message ? e.message : e}`; });
      return r;
    };
  }, endReply);
  await fire(endReply);
  await page.waitForFunction(() => window.__cardSaves.length > 0 && window.__cardSaves.every((v) => v !== null), null, { timeout: 5000 });
  const cardSaves = await page.evaluate(() => { const v = window.__cardSaves; delete window.__cardSaves; delete window.__calls.setChat.push; return v; });
  assert.ok(cardSaves.length >= 2 && cardSaves[0] === false && cardSaves.includes(true) && cardSaves.at(-1) === true, `종료 저장(아직 카드 없음) → 열쇠 표 채움 → 그대로 한 번 더 저장(카드 있음): ${JSON.stringify(cardSaves)}`);
  const ss = await page.evaluate(() => window.__chat.scriptstate);
  const row = JSON.parse(ss.$goei_journal).rows.find((r) => r.name === preset.name);
  assert.ok(row && row.mine && row.rpt, '내가 출동한 일지 줄 + 보고서 id');
  const rpt = JSON.parse(ss.$goei_reports).items.find((r) => r.id === row.rpt);
  assert.ok(rpt && rpt.full && rpt.trail.length === 2 && rpt.trail[0].text.includes('셔터') && rpt.trail[1].text === '격리 완료. 현장 봉쇄 해제', '전체 보고서 · 경과 2(진입 → 종료 글)');
  assert.equal(rpt.result, '격리 완료. 현장 봉쇄 해제', '결과 = 종료 태그의 상황 글');
  assert.equal(row.result, rpt.result);
  // 채팅 본문 자동 표시 (묶음 3, 설정 기본 「내가 출동한 사건만」): display 처리기가 종료 응답의 상태창 아래에 보고서 카드를 그린다. 본문·모델 요청에는 아무것도 안 들어간다
  const disp = (t) => page.evaluate((t) => window.__calls.handlers.display(t), t);
  const endHtml = await disp(endReply);
  assert.ok(endHtml.includes('data-goei-card="report"') && endHtml.includes('기록에서 보기') && endHtml.includes(`data-goei-rec="${rpt.id}"`) && endHtml.includes(rpt.no), '종료 응답 아래 보고서 카드');
  assert.ok(endHtml.indexOf('data-goei-status') < endHtml.indexOf('data-goei-card="report"'), '상태창 상자 다음에');
  assert.ok(!(await disp(enterReply)).includes('data-goei-card="report"'), '종료가 없는 응답엔 카드 없음');
  assert.ok(!(await page.evaluate(() => window.__chat.message.at(-1).data)).includes('data-goei-card'), '메시지 본문은 그대로');
  // 상황판: 종료 알림 오버레이(창을 연 지금 한 번) · 종료 줄 보고서 아이콘 · 큰 보기 보고서 단추 · 「기록에서 전부 보기 ›」 (창은 위키 탭에서 숨겼으니 상황판으로)
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  assert.ok((await page.textContent('.gx-panel > .gx-rectoast')).includes('보고서가 기록에 저장됐어요'), '종료 알림 오버레이 (흐름 밖, 창 위)');
  assert.equal(await page.locator('.gx-board .gx-rectoast, .gx-board .gx-recnote').count(), 0, '알림이 본문 흐름 안에 없다');
  await page.hover('.gx-rectoast');
  await page.waitForTimeout(6500); // TOAST_MS(6초) 보다 길게
  assert.equal(await page.locator('.gx-rectoast').count(), 1, '마우스를 올린 동안은 사라지지 않는다');
  assert.equal(await page.locator(`.gx-oprow.ended .gx-oprpt[data-value="${rpt.id}"]`).count(), 1, '종료 줄 보고서 아이콘');
  assert.equal(await page.locator('.gx-oprow.ended .gx-minetag').count(), 1, '종료 줄 「내가 출동」');
  assert.equal(await page.locator(`.gx-opview [data-action="rec-open"][data-value="${rpt.id}"]`).count(), 1, '큰 보기 보고서 단추');
  assert.ok((await page.textContent('.gx-oplog-foot')).includes('기록에서 전부 보기'));
  await page.click('.gx-rectoast [data-action="rec-toast-x"]');
  assert.equal(await page.locator('.gx-rectoast').count(), 0, '알림 닫힘');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="map"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  assert.equal(await page.locator('.gx-rectoast').count(), 0, '닫은 알림은 다시 안 뜸 (보고서마다 한 번)');
  // 종료 줄 아이콘 → 보고서 페이지 (창이 아니라 기록 탭 안)
  await page.click('.gx-oprow.ended .gx-oprpt');
  await page.waitForSelector('.gx-records .gx-rpt');
  assert.equal(await tabNow(), 'records');
  assert.equal(await page.locator('.ev-pop, .gx-agpop').count(), 0, '창이 아니다');
  const rt = await page.textContent('.gx-rpt');
  for (const t of [rpt.no, preset.name, '내가 출동', '경과', '셔터 안쪽으로 진입했다', '투입 요원', '쟈알디', '결과', rpt.result, '소감 없음', '인물 기록 변화', '가계부', '종료 시점 잔고']) assert.ok(rt.includes(t), `보고서 페이지: ${t}`);
  assert.ok((await page.textContent('.gx-rpt [data-action="rec-debrief"]')).includes('보조 모델 1회'));
  assert.equal(await page.locator('.gx-rpt button:has-text("채팅에 넣기")').count(), 0, '수동 「채팅에 넣기」 없음');
  // 「이미지로 저장」 (묶음 3): a.download 클릭을 가로채 PNG 한 장 — image/png · 900×1200 · 미리보기 창 (길게 눌러 저장 안내) → 닫기
  await page.evaluate(() => {
    window.__dl = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl.push({ href: this.href, name: this.download }); return; } return orig.call(this); };
  });
  await page.click('.gx-rpt [data-action="rec-png"]');
  await page.waitForFunction(() => (window.__dl ?? []).length === 1, null, { timeout: 20000 });
  const png = await page.evaluate(async () => {
    const d = window.__dl[0];
    const b = await (await fetch(d.href)).blob();
    const img = new Image();
    img.src = d.href;
    await img.decode();
    return { name: d.name, type: b.type, size: b.size, w: img.naturalWidth, h: img.naturalHeight, dataLen: (await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); })).length };
  });
  assert.ok(png.name.startsWith('관리국_보고서_') && png.name.endsWith('.png') && png.type === 'image/png' && png.size > 10000 && png.dataLen > 10000, JSON.stringify(png));
  assert.deepEqual([png.w, png.h], [900, 1200], 'PNG 900×1200');
  await page.waitForSelector('.gx-pngpop .gx-png-img');
  assert.ok((await page.textContent('.gx-pngpop')).includes(rpt.no));
  await page.click('.gx-pngpop .gx-png-acts [data-action="rec-png-x"]');
  assert.equal(await page.locator('.gx-pngpop').count(), 0, '미리보기 닫힘');
  // 「소감 쓰기」 (묶음 3): 이 보고서 하나만 보조 모델 1회 — 짧은 전용 지침 + ended_now 한 건 → 검사 뒤 src manual 로 저장, 페이지에 소감
  const llmBefore = await page.evaluate(() => (window.__calls.llm ?? []).length);
  await page.evaluate((id) => { window.__llm = [{ type: 'success', result: JSON.stringify({ debriefs: [{ id, who: '스팡달', text: '셔터 안쪽은 생각보다 좁았다. 다들 무사해서 다행이다.' }] }) }]; }, rpt.id);
  await page.click('.gx-rpt [data-action="rec-debrief"]');
  await page.waitForFunction((id) => JSON.parse(window.__chat.scriptstate.$goei_reports).items.find((r) => r.id === id)?.debrief?.src === 'manual', rpt.id, { timeout: 15000 });
  assert.equal(await page.evaluate(() => (window.__calls.llm ?? []).length), llmBefore + 1, '보조 모델 1회');
  const dcall = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.equal(dcall.mode, 'submodel');
  assert.ok(dcall.messages[0].content.includes('after-action') && dcall.messages[0].content.length < 1500, '짧은 전용 지침');
  const ddata = JSON.parse(dcall.messages[1].content);
  assert.ok(ddata.ended_now.length === 1 && ddata.ended_now[0].id === rpt.id && ddata.ended_now[0].agents.includes('스팡달') && Array.isArray(ddata.span), JSON.stringify(ddata.ended_now));
  await page.waitForFunction(() => document.querySelector('.gx-rpt-debrief')?.textContent?.includes('스팡달 소감'));
  assert.ok((await page.textContent('.gx-rpt-debrief')).includes('직접 요청'));
  const ddiag = JSON.parse(await page.evaluate(() => window.__store['p:goei-people-diag'] ?? '[]'));
  assert.ok(ddiag.at(-1).reason === 'debrief' && ddiag.at(-1).ok, '진단에 debrief 1회');
  // 모델 요청에는 카드가 없다 (요청 가공기를 직접 부르면 「응답 대기 중」이 켜져 그 뒤의 저장(소감 쓰기)이 응답을 기다리므로, 소감 뒤에 확인한다)
  const reqCard = await page.evaluate((t) => window.__calls.replacers[0]([{ role: 'user', content: '시작' }, { role: 'assistant', content: t }, { role: 'user', content: '다음' }], 'model'), endReply);
  assert.ok(!reqCard.some((m) => /사건 보고서|data-goei-card|기록에서 보기/.test(String(m.content))), '모델 요청에는 카드가 없다');
  // 고정 → 채팅 변수 pin, 다시 누르면 풀림
  await page.click('.gx-rpt [data-action="rec-pin"]');
  await page.waitForFunction((id) => JSON.parse(window.__chat.scriptstate.$goei_reports).items.find((r) => r.id === id)?.pin === true, rpt.id);
  await page.waitForSelector('.gx-rpt [data-action="rec-pin"].on');
  await page.click('.gx-rpt [data-action="rec-pin"]');
  await page.waitForFunction((id) => !JSON.parse(window.__chat.scriptstate.$goei_reports).items.find((r) => r.id === id)?.pin, rpt.id);
  // 뒤로 → 보고서 목록 (칩: 내가 출동 1 · 요원 처리 0 · 전체 1)
  await page.click('.gx-rpt [data-action="rec-back"]');
  await page.waitForSelector('.gx-rcard');
  assert.equal(await page.locator('.gx-rcard').count(), 1);
  assert.ok((await page.textContent('.gx-rcard')).includes('내가 출동') && (await page.textContent('.gx-rcard')).includes(rpt.no));
  await page.click('[data-action="rec-rfilter"][data-value="bg"]');
  assert.equal(await page.locator('.gx-rcard').count(), 0, '요원 처리 칩: 없음');
  assert.equal(await page.locator('[data-action="rec-rfilter"]').count(), 2, '칩은 「내가 출동」·「요원 처리」 둘뿐 (「전체」 없음)');
  await page.click('[data-action="rec-rfilter"][data-value="mine"]');
  assert.equal(await page.locator('.gx-rcard').count(), 1);
  // 일지 탭: 요약 타일·줄(노란 왼쪽 선)·필터·찾기(목록만 다시 그림, 포커스 유지)
  await page.click('[data-action="rec-sub"][data-value="journal"]');
  await page.waitForSelector('.gx-jr-row');
  assert.equal(await page.locator('.gx-jr-row.mine').count(), 1, '내가 출동한 줄');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gx-jr-row.mine')).borderLeftWidth), '3px', '노란 왼쪽 선');
  const tiles = await page.textContent('.gx-jr-tiles');
  for (const t of ['이번 달 종료', '내가 출동', '백그라운드', '오늘']) assert.ok(tiles.includes(t), `타일 ${t}`);
  assert.ok((await page.textContent('.gx-jr-day h3')).includes('2025.01.01'), '날짜별 묶음');
  const jr = await page.textContent('.gx-jr-row');
  for (const t of ['04:11', preset.name, '나 · 쟈알디 · 스팡달', '보고서']) assert.ok(jr.includes(t), `일지 줄: ${t}`);
  await page.click('[data-action="rec-filter"][data-value="bg"]');
  assert.equal(await page.locator('.gx-jr-row').count(), 0, '백그라운드 칩: 없음');
  await page.click('[data-action="rec-filter"][data-value="an"]');
  assert.equal(await page.locator('.gx-jr-row').count(), 1, '괴이 칩');
  await page.fill('[data-input="rec-q"]', '없는이름');
  assert.equal(await page.locator('.gx-jr-row').count(), 0, '찾기');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.input), 'rec-q', '찾기 칸 포커스 유지');
  await page.fill('[data-input="rec-q"]', '');
  await page.click('.gx-jr-row[data-action="rec-open"]');
  await page.waitForSelector('.gx-rpt');
  // 즐겨찾기: 보고서 페이지를 넣고 다른 탭에서 돌아온다
  await page.click('.gx-nh.mk-star');
  await page.waitForSelector('.mk-pop');
  await page.click('.mk-pop [data-action="mk-here"]');
  const saved = JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs'])).marks;
  const mi = saved.findIndex((m) => m.s.tab === 'records' && m.s.r?.view === 'report' && m.s.r?.id === rpt.id);
  assert.ok(mi >= 0 && saved[mi].name === `보고서 ${rpt.no}`, JSON.stringify(saved));
  await page.click('.mk-head [data-action="mk-pop"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  await page.click('.gx-nh.mk-star');
  await page.click(`.mk-pop [data-action="mk-go"][data-value="${mi}"]`);
  await page.waitForSelector('.gx-records .gx-rpt');
  assert.ok((await page.textContent('.gx-rpt')).includes(rpt.no), '즐겨찾기로 보고서 페이지 복원');
  // PC ‹ (뒤로) = 상황판, 보고서 페이지에서 뒤로 단추 두 번 = 목록 → 이전 화면
  await page.click('.gx-nh[data-action="nav-back"]');
  assert.equal(await tabNow(), 'board');
  // 요원 격자 → 사원증 창 「기록」 → 기록 › 인물 상세 (인물 기록이 있을 때만 단추가 있다 → 기록을 하나 심는다)
  await page.evaluate(() => { window.__chat.goeiPeopleV1 = { v: 1, people: { 쟈알디: { name: '쟈알디', faction: 'A00', seeded: { from: 'none' }, slots: {}, address: {}, aff: 0 } }, pending: {}, docs: {}, log: [], folded: {} }; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; });
  await open(page);
  if (!(await page.locator('.gx-board').count())) await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  if (await page.locator('li[data-action="agent-info"]').count()) {
    await page.click('li[data-action="agent-info"] >> nth=0');
    await page.waitForSelector(".gx-agcard");
    if (await page.locator('.gx-agcard [data-action="people-goto"]').count()) {
      await page.click('.gx-agcard [data-action="people-goto"]');
      await page.waitForSelector('.gx-records .pp-pane');
      assert.equal(await tabNow(), 'records');
      assert.ok((await page.textContent('.gx-records .pp-pane .ph-room-title')).includes('쟈알디'), '그 사람 기록');
      // 인물 상세의 뒤로 → 인물 목록
      await page.click('.gx-records .pp-pane .ph-back');
      await page.waitForFunction(() => document.querySelector('.gx-records .pp-pane .ph-room-title')?.textContent?.includes('이 채팅의 인물'));
    }
  }
  // 설정 「기록」 묶음: 네 항목(일지 컨텍스트 설정은 2026-10-29 사용자 결정으로 뺌), 값은 이 채팅 변수 $jr_*, 기본값으로 저장 범위
  await edOpen(page, 'set:journal');
  await page.waitForSelector('.gw .gw-setbody');
  const st = await page.textContent('.gw .gw-setbody');
  for (const t of ['채팅에 보고서 표시', '안 띄움', '내가 출동한 사건만', '전부', '소감 자동', '일지 상한', '보고서 상한']) assert.ok(st.includes(t), `기록 설정: ${t}`);
  assert.equal(await page.locator('.gw .gw-top [data-action="set-bar"]').count(), 2, '머리의 기본값으로 저장·불러오기');
  // 채팅에 보고서 표시 3단계: 끄면 이미 그려진 카드도 사라지고(열쇠 표 비움 + 채팅 그대로 다시 저장), 「전부」면 요원 처리 보고서도, 「내가 출동한 사건만」이면 그것만
  const saves0 = await page.evaluate(() => window.__calls.setChat.length);
  await page.click('.gw [data-action="jr-set"][data-value="chat_card=off"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$jr_chat_card === 'off');
  await page.waitForFunction((n) => window.__calls.setChat.length >= n + 2, saves0, { timeout: 5000 });
  assert.ok(!(await disp(endReply)).includes('data-goei-card="report"'), '안 띄움: 카드 없음');
  // 같은 종료 응답에 요원 처리(백그라운드) 보고서가 하나 더 있는 것처럼 심는다
  await page.evaluate((key) => { const s = JSON.parse(window.__chat.scriptstate.$goei_reports); const b = JSON.parse(JSON.stringify(s.items[0])); Object.assign(b, { id: 'rbgqc', no: 'RPT-0101-99', mine: false, full: false, statusKey: key, head: { ...b.head, name: '요원 처리 사건' } }); s.items.push(b); window.__chat.scriptstate.$goei_reports = JSON.stringify(s); }, rpt.statusKey);
  await page.click('.gw [data-action="jr-set"][data-value="chat_card=all"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$jr_chat_card === 'all');
  await page.waitForFunction((n) => window.__calls.setChat.length >= n + 4, saves0, { timeout: 5000 });
  assert.equal((await disp(endReply)).split('data-goei-card="report"').length - 1, 2, '전부: 카드 둘');
  await page.click('.gw [data-action="jr-set"][data-value="chat_card=mine"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$jr_chat_card === 'mine');
  await page.waitForFunction((n) => window.__calls.setChat.length >= n + 6, saves0, { timeout: 5000 });
  const mineHtml = await disp(endReply);
  assert.ok(mineHtml.split('data-goei-card="report"').length - 1 === 1 && mineHtml.includes(`data-goei-rec="${rpt.id}"`) && !mineHtml.includes('rbgqc'), '내가 출동한 사건만: 카드 하나');
  await page.click('.gw [data-action="jr-set"][data-value="chat_card=off"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$jr_chat_card === 'off');
  assert.ok(!st.includes('참고로 넣기') && !(await page.$('.gw [data-action="jr-set"][data-value^="ctx="]')), '일지 컨텍스트 설정은 없다');
  await page.click('.gw [data-action="jr-step"][data-value="journal_cap:-"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$jr_journal_cap === '400');
  await page.click('.gw [data-action="jr-step"][data-value="report_cap:+"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$jr_report_cap === '110');
  // 기본값으로 저장 → $jr_* 가 기기 기본값(prefs.vars)에 들어간다
  await page.click('.gw .gw-top [data-action="set-bar"][data-value="save"]');
  await page.click('.gw .st-barconfirm [data-action="set-bar-yes"][data-value="save"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').vars?.$jr_chat_card === 'off');
  assert.equal(JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs'])).vars.$jr_report_cap, '110', '보고서 상한도 기본값에');
  await edClose(page);
  // PC 에서는 머리의 기록 단추가 안 보인다 (옆 메뉴에 있으니)
  assert.equal(await page.locator('.gx-head-act .gx-recbtn:visible').count(), 0, 'PC 머리엔 기록 단추 없음');
  // 폰(390×844): 머리에 「기록」 입구(필드 단추처럼) · 기록 탭 일지·보고서·보고서 페이지·상황판 알림 줄에 가로 넘침 없음
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="board"]:visible');
  await page.waitForSelector('.gx-board');
  assert.equal(await page.locator('.gx-head-act .gx-recbtn:visible').count(), 1, '폰 머리에 기록 단추');
  await page.click('.gx-head-act .gx-recbtn');
  await page.waitForSelector('.gx-records');
  assert.equal(await tabNow(), 'records');
  assert.equal(await page.locator('.gx-head-act .gx-recbtn.on').count(), 1, '기록 탭이면 켜진 모양');
  await page.click(':is([data-action="tab"], [data-action="nav-tab"])[data-value="board"]:visible');
  await page.waitForSelector('.gx-board');
  const noOverflow = async (where) => {
    const r = await page.evaluate(() => {
      const w = innerWidth;
      const bad = [...document.querySelectorAll('.gx .gx-panel *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > w + 1 && !el.closest('.gx-mclose, .gx-mtrack, .nw-rail, .nw-panel, .gx-flow, .ph-drawer, .gx-opfx, .gx-optear, .gx-opview'); }).map((el) => `${el.tagName}.${String(el.className).split(' ')[0]}`);
      return { scrollW: document.documentElement.scrollWidth, panelW: document.querySelector('.gx .gx-panel').scrollWidth, w, bad: bad.slice(0, 6) };
    });
    assert.ok(r.scrollW <= r.w + 1 && r.panelW <= r.w + 1 && !r.bad.length, `${where}: 가로 넘침 ${JSON.stringify(r)}`);
  };
  await noOverflow('폰 상황판');
  await page.click('.gx-oprow.ended .gx-oprpt');
  await page.waitForSelector('.gx-records .gx-rpt');
  await noOverflow('폰 보고서 페이지');
  await page.click('.gx-rpt [data-action="rec-back"]');
  await page.waitForSelector('.gx-rcard');
  await noOverflow('폰 보고서 목록');
  await page.click('[data-action="rec-sub"][data-value="journal"]');
  await page.waitForSelector('.gx-jr-row');
  await noOverflow('폰 일지');
  const tabW = await page.$$eval('.gx-rec-tabs .gx-seg', (l) => l.map((b) => b.getBoundingClientRect().width));
  assert.ok(Math.max(...tabW) - Math.min(...tabW) <= 1, `폰 하위 탭 같은 너비 (${tabW.join(',')})`);
  // 폰 머리 사원증 창의 잔고 줄 → 가계부
  await page.click('.gx-idbtn');
  await page.waitForSelector('.gx-idpop .gx-wallet');
  await page.click('.gx-idpop .gx-wallet');
  await page.waitForSelector('.gx-wallettab');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS 기록 탭: 메뉴·하위 탭·사원증·잔고 줄·종료 → 일지·보고서·알림·아이콘·보고서 페이지·고정·필터·찾기·즐겨찾기·사원증 창 기록·설정 묶음·폰 넘침 0');
}

// 32-1) 옛 즐겨찾기 호환: 위키 안 인물 화면 `{tab:'wiki', w:{view:'person'}}` 은 기록 탭 › 인물 › 그 사람으로 열린다 (저장소에 미리 심고 부팅)
{
  const legacy = { marks: [{ s: { tab: 'wiki', w: { view: 'person', title: '쟈알디', list: false } }, name: '쟈알디 기록' }, { s: { tab: 'wiki', w: { view: 'faction', title: 'C00', list: false } }, name: '세력 C00' }] };
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, { width: 1280, height: 900 }, { prefs: legacy });
  await startedWithReply(page);
  await open(page);
  await page.waitForSelector('.gx-board');
  await page.click('.gx-nh.mk-star');
  await page.waitForSelector('.mk-pop');
  await page.click('.mk-pop [data-action="mk-go"][data-value="0"]');
  await page.waitForSelector('.gx-records .pp-pane');
  assert.equal(await page.evaluate(() => document.querySelector('.gx').dataset.tab), 'records');
  assert.ok((await page.textContent('.gx-records .pp-pane .ph-room-title')).includes('쟈알디'), '옛 인물 즐겨찾기 → 기록 › 인물 › 쟈알디');
  await page.click('.gx-nh.mk-star');
  await page.click('.mk-pop [data-action="mk-go"][data-value="1"]');
  await page.waitForFunction(() => document.querySelector('.gx-records .pp-pane .pp-cells, .gx-records .pp-pane'));
  assert.ok((await page.textContent('.gx-records .pp-pane')).includes('세력'), '옛 세력 즐겨찾기 → 기록 › 세력');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS 기록 탭: 옛 위키 인물·세력 즐겨찾기가 기록 탭으로');
}

await browser.close();
