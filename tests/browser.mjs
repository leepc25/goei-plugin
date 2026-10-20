// 실제 Chromium에서 플러그인 번들을 Risu와 같은 방식(async 함수 안)으로 실행하고
// 가짜 risuai API로 시작 화면 → 저장까지 확인한다.
// 사용법: node tests/browser.mjs <fixture.json> [screenshot-dir]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
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
      pluginStorage: { getItem: async (k) => window.__store['p:' + k] ?? null, setItem: async (k, v) => { window.__store['p:' + k] = v; }, keys: async () => [], removeItem: async () => {} },
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
// 상황 그림 카드: 띠를 눌러 상세 창을 열고, 창 안의 버튼(지도·목표로 고르기·종료 등)을 누른다
async function cardAction(page, name, action, scope = '') {
  if (!(await page.locator('.ev-pop').count())) await page.click(`${scope} li.gx-evc:has-text("${name}")`);
  await page.click(`.ev-pop [data-action="${action}"]`);
}
// 커스텀 목록: 그림 띠를 눌러 펼친 뒤 「이 …로 선택」 (2026-10-20 그림 카드)
async function pickCustom(page, row = '.gx-mlist li.gx-mx') {
  await page.locator(`${row} [data-action="mission-open"]`).first().click();
  await page.click('.gx-mlist li.gx-mx.open [data-action="mission-pick"]');
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
  await page.waitForSelector('.gx-settings');
  assert.equal(await page.$('[data-action="set-scope"][data-value="chat"]'), null, '시작 전에는 「이 채팅」 없음');
  assert.ok(await page.$('[data-action="set-scope"][data-value="card"]'), '시작 전에도 카드 명부');
  assert.equal(await page.evaluate(() => document.querySelector('.st-world').open), false, '괴이 발생은 접혀 있음');
  await page.click('.st-world > summary');
  await page.click('[data-action="set-world"][data-value="incident_cap:+"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').world?.incident_cap === 2);
  await page.click('[data-action="set-theme"][data-value="dark"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').theme === 'dark');
  if (shots) await page.screenshot({ path: `${shots}/1-prefs.png` });
  await page.click('[data-action="prefs-close"]');
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
  await page.click('[data-action="prefs-close"]');
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
  assert.equal(sent.at(-1).content, '새벽 편의점, 냉장고 안에서 노크 소리');
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
  assert.equal(req.at(-1).content, '시작');
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
  assert.equal(await page.evaluate(() => window.__button), undefined, '채팅 메뉴 항목 없음');
  assert.deepEqual(errors, []);
  console.log('PASS 다른 봇 → 아무것도 표시하지 않음');
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
  assert.match(after.scriptstate.$an_report, new RegExp(`\\[AN\\|${where}\\|${preset.name}\\|활성\\|B\\|P001\\] \\{0시간 0분 전\\}`));
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
    await page.click('.gx-nav .gx-nb:not(.mob)[data-value="mission"]');
    await pickCustom(page);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/9-mission-wide.png` });
    for (const t of ['board', 'map', 'mission', 'phone', 'wiki', 'settings']) {
      await page.click(`.gx-nav .gx-nb:not(.mob)[data-value="${t}"]`); await page.waitForTimeout(150);
      await page.screenshot({ path: `${shots}/9-tab-${t}.png` });
    }
    await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
    await page.waitForSelector('.gx-board');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (shots) { await page.screenshot({ path: `${shots}/9-board-mobile.png` }); await page.evaluate(() => { const b = document.querySelector(".gx-body"); b.scrollTop = b.scrollHeight; }); await page.screenshot({ path: `${shots}/9-board-mobile-agents.png` }); }
  await page.setViewportSize({ width: 1280, height: 860 });
  // 상황판 요원 카드의 톡·위키 바로가기
  const agentCard = page.locator('.gx-board .gx-acard', { hasText: '쟈알디' });
  // PC도 요원 카드를 누르면 큰 사진 창
  await agentCard.locator('.gx-acard-top b').click();
  await page.waitForSelector('.gx-agpop');
  assert.equal(await page.$eval('.gx-agpop .gx-ava', (el) => el.getBoundingClientRect().width), 200);
  await page.click('.gx-agpop-x');
  assert.equal(await page.locator('.gx-agpop').count(), 0);
  await agentCard.locator('[data-action="agent-talk"]').click();
  await page.waitForSelector('.ph-room');
  assert.ok((await page.textContent('.ph-room')).includes('쟈알디'));
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  await agentCard.locator('[data-action="wiki-goto"]').click();
  await page.waitForSelector('.nw-compose, .nw-doc');
  assert.ok((await page.textContent('.gx-panel')).includes('쟈알디'));
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('.gx-board');
  await page.setViewportSize({ width: 390, height: 844 });
  // 상황판 행 → 임무(지도) 탭의 그 자리
  await page.setViewportSize({ width: 1280, height: 860 });
  // 그림 카드: 눌러 펼친 뒤 지도 버튼
  await cardAction(page, preset.name, 'board-map', '.gx-board');
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
      await page.waitForSelector('.gx-nb.on[data-value="wiki"], .nw-doc, .nw-write', { timeout: 6000 });
      // 설정 「상태창」: 페이퍼 → 그린 상자도 바로 바뀜, 미표시 → 숨김
      await page.click('.gx-nav .gx-nb:not(.mob)[data-value="settings"]');
      await page.click('[data-action="set-status"][data-value="paper"]');
      await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').status === 'paper');
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#msg .x-risu-gst')).backgroundColor), 'rgb(250, 245, 233)');
      if (shots) await page.screenshot({ path: `${shots}/9-status-settings.png` });
      await page.click('[data-action="set-status"][data-value="off"]');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gst')).display === 'none');
      await page.click('[data-action="set-status"][data-value="auto"]');
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#msg .x-risu-gst')).backgroundColor === 'rgb(35, 45, 50)');
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS 상태창: 플러그인 그리기·요일·공휴일·지난 장면·말풍선·위키 이름·배색 설정');
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
  assert.equal(req.length, 2);
  assert.ok(!req[1].content.includes('SCENE_CARD') && req[1].content.endsWith('Situation:\n조용히 진입한다'), req[1].content);
  const req2 = await page.evaluate((t) => window.__calls.replacers[0]([{ role: 'user', content: t }, { role: 'user', content: '그리고 문을 연다' }], 'model'), rec.data);
  assert.equal(req2.length, 1);
  assert.ok(req2[0].content.endsWith('Situation:\n조용히 진입한다\n\n그리고 문을 연다'), req2[0].content);
  // 장소 자체 선택: 아직 안 보낸 카드는 바꿔 끼운다
  await open(page);
  await page.waitForSelector('.gx-canvas');
  await page.selectOption('.gx-select', '02');
  await page.click('.gx-pin[data-value="02-0"]');
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
  await page.waitForSelector('.gx-evc');
  await cardAction(page, preset.name, 'end-event');
  assert.equal((await page.textContent('.ev-pop [data-action="end-event"]')).trim(), '정말 종료');
  await page.click('.ev-pop [data-action="end-event"]');
  await page.waitForFunction((name) => !JSON.parse(window.__chat.scriptstate.$goei_world).an.some((e) => e.name === name), preset.name);
  assert.ok(!(await page.evaluate(() => window.__chat.scriptstate.$an_report)).includes(`${preset.name}|활성`));
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
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="mission"]');
  await page.click('[data-action="mission-kind"][data-value="ms"]');
  await pickCustom(page);
  const site = (await page.textContent('.gx-goal b')).trim();
  // 다른 탭에 다녀와도 고른 목표 유지
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="wiki"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="mission"]');
  assert.equal((await page.textContent('.gx-goal b')).trim(), site, '탭 이동 뒤에도 목표 유지');
  if (shots) await page.screenshot({ path: `${shots}/12-mission-tab.png` });
  await page.click('[data-action="mission-send"]');
  await page.waitForFunction(() => window.__chat.message.length === 4);
  const after = await page.evaluate(() => window.__chat);
  assert.ok(after.message[3].data.includes('Continue naturally') && after.message[3].data.includes(site));
  assert.equal(JSON.parse(after.scriptstate.$goei_world).pending.ms, site);
  // 요청 취소
  await open(page);
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="mission"]');
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
    await page.locator('[data-action="tab"][data-value="wiki"]:visible').first().click();
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
  await page.click('.nw-scrim', { position: { x: 370, y: 400 } });
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
  // 모바일: 펼친 목록을 왼쪽으로 밀면 접힘
  await page.evaluate(() => {
    const el = document.querySelector('.nw-list');
    const t = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })];
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: t(200), changedTouches: t(200) }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: t(60) }));
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
  const req = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'system', content: 's' }, { role: 'user', content: 'u' }], 'model'));
  assert.equal(req[req.length - 1].content, 'u', '사용자 메시지가 맨 끝');
  const last = req[req.length - 2];
  assert.equal(last.role, 'system');
  assert.ok(last.content.startsWith('[MODULE_CONTEXT_BEGIN]\nThese saved records are reference data'));
  assert.ok(last.content.includes('"kind":"private_message"'));
  const sub = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'submodel'));
  assert.equal(sub.length, 1, '보조 모델 요청에는 안 붙임');
  // 본편 반영 총 상한: 너무 작으면 아무 기록도 안 붙음
  await page.evaluate(() => { window.__chat.scriptstate.$gen_ctx_total = '10'; });
  const tight = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model'));
  assert.equal(tight.length, 1, '총 상한 안에 못 들면 빼기');
  await page.evaluate(() => { delete window.__chat.scriptstate.$gen_ctx_total; });
  // 설정: 본편 반영 빼기
  await page.click('[data-action="gn-settings"]');
  await page.click('[data-action="gn-cfg"][data-value="context=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.context'] === '1');
  const off = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model'));
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
  const req = await page.evaluate((r) => window.__calls.replacers[0]([{ role: 'user', content: r }, { role: 'user', content: '빨리 받아' }], 'model'), rec);
  assert.equal(req[req.length - 1].content, '{{user}} places a phone call to 쟈알디.\n\n현장 상황 보고\n\n빨리 받아');
  // 본편 반영: 대화·공지가 마지막 사용자 메시지 바로 앞 system 메시지로
  const ctx = req[req.length - 2];
  assert.equal(ctx.role, 'system');
  assert.ok(ctx.content.includes('"feature":"phone"') && ctx.content.includes('선배 지금 어디예요?') && ctx.content.includes('지하 2층 출입 통제'));
  // 자동 확인: 본편 응답이 끝나면 한 번 (같은 응답에는 다시 안 함)
  await page.evaluate(() => { window.__chat.scriptstate.$ph_auto = '1'; window.__chat.scriptstate.$cooldown_received_incoming = '-5'; });
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
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="settings"]');
  await page.waitForSelector('.gx-settings');
  assert.ok((await page.textContent('.st-step b')).includes('12명'));
  assert.equal(await page.getAttribute('[data-action="set-theme"][data-value="dark"]', 'aria-pressed'), 'true', '새 채팅 테마 기본은 다크');
  await page.click('[data-action="set-theme"][data-value="paper"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_fixed_theme === 'paper');
  await page.waitForFunction(() => document.querySelector('[data-action="set-theme"][data-value="paper"]')?.getAttribute('aria-pressed') === 'true');
  const kinds = await page.textContent('.ps-cards');
  assert.ok(kinds.includes('2개') && kinds.includes('100%') && kinds.includes('48시간'), kinds);
  // 괴이 생성 수치: 이 채팅에만 ($wg_*)
  await page.evaluate(() => { const d = document.querySelector('.st-world'); if (!d.open) d.querySelector('summary').click(); });
  await page.click('[data-action="set-world"][data-value="preset_cap:+"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$wg_preset_cap === '3');
  await page.click('[data-action="set-world"][data-value="incident_p:-"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$wg_incident_p === '40');
  // 설정은 하나: 「기본값으로 저장」을 누르면 지금 채팅 값이 새 채팅 기본값으로 (v0.16.23)
  assert.equal(await page.$('[data-action="set-scope"][data-value="defaults"]'), null, '이 채팅/기본값 두 벌 없음');
  await page.click('[data-action="set-bar"][data-value="save"]');
  await page.waitForSelector('.st-barconfirm');
  await page.click('[data-action="set-bar-yes"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').world?.preset_cap === 3);
  assert.equal(JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs'])).theme, 'paper');
  // 요원 표시 인원: 줄이면 상황판 요원 수와 요원 보고가 함께 바뀐다
  await page.click('[data-action="set-agent"][data-value="n:-"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_agent_limit === '11');
  await page.waitForFunction(() => document.querySelector('.st-step b')?.textContent.includes('11명'));
  const agCount = await page.evaluate(() => (window.__chat.scriptstate.$ag_report.match(/- code: P\d+/g) || []).length);
  assert.ok(agCount <= 11);
  // 지원 투입 끄기 → 지도 편성에서 지원 인원 칸이 사라진다
  await page.click('[data-action="set-support"][data-value="0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_support_on === '0');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="mission"]');
  await page.waitForSelector('.gx-mbox');
  await pickCustom(page, '.gx-mbox li.gx-mx');
  await page.waitForSelector('.gx-team');
  assert.equal(await page.locator('.gx-mission .gx-unplace:not([disabled])').count(), 1, '커스텀 목표를 고르면 취소가 켜짐');
  await page.click('.gx-mission .gx-unplace');
  await page.waitForFunction(() => document.querySelector('.gx-team .gx-goal b')?.classList.contains('none'));
  assert.equal(await page.locator('.gx-mlist .sel').count(), 0, '취소하면 커스텀 목표가 풀림');
  assert.equal(await page.locator('.gx-scard').count(), 0, '지원 투입 OFF면 지원 인원 카드 없음');
  // 에셋: 보조모델 + 캐릭터당 1장
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="settings"]');
  await page.waitForSelector('[data-action="set-asset-model"]');
  assert.equal(await page.$('[data-action="set-asset-limit"]'), null, '메인모델이면 캐릭터당 이미지 수 없음');
  await page.click('[data-action="set-asset-model"][data-value="aux"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_asset_model === 'aux');
  await page.click('[data-action="set-asset-limit"][data-value="1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_asset_limit === '1');
  if (shots) await page.screenshot({ path: `${shots}/16-settings.png` });
  await page.evaluate(() => {
    window.__moduleLore = [{ comment: 'Image tag', content: JSON.stringify({ characters: ['Jyaldi'], sfw_keywords: ['default', 'smile'], kor_to_eng: { 쟈알디: 'Jyaldi' } }) }];
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
  // 이미지 자료가 없으면 본문은 그대로 두고 설정 탭에 이유를 남긴다
  await page.evaluate(() => { window.__moduleLore = []; });
  await fire('쟈알디가 다시 웃었다.');
  assert.equal(await page.evaluate(() => window.__chat.message.at(-1).data), '쟈알디가 다시 웃었다.');
  assert.match(await page.evaluate(() => window.__chat.scriptstate.$goei_asset_note), /Image tag/);
  assert.equal(await page.evaluate(() => window.__calls.llm.length), n0 + 1, '자료가 없으면 모델을 부르지 않음');
  // 메인모델로 돌리면 보충하지 않는다
  await page.click('[data-action="set-asset-model"][data-value="main"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_asset_model === 'main');
  // 상황판 끄기: 확인 → 상태 비움 → 다시 켜기
  await page.click('[data-action="set-anomaly"][data-value="off"]');
  await page.waitForSelector('.st-confirm');
  await page.click('[data-action="set-anomaly"][data-value="off-yes"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_anomaly_on === '0' && window.__chat.scriptstate.$an_report === '');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="board"]');
  await page.waitForSelector('[data-action="world-on"]');
  await page.click('.gx-nav .gx-nb:not(.mob)[data-value="settings"]');
  await page.click('[data-action="set-anomaly"][data-value="on"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$st_anomaly_on === '1' && /NEW \[AN\|/.test(window.__chat.scriptstate.$an_report));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  if (shots) await page.screenshot({ path: `${shots}/16-settings-mobile.png` });
  assert.deepEqual(errors, []);
  console.log('PASS 설정: 테마·카드 기본값·요원 표시 인원·지원 투입·보조모델 이미지 태그·상황판 끄고 켜기');
  await page.close();
}

// 17) 카드 명부: 시작 전 설정에서 요원·조직·괴이 값을 고쳐 카드 로어북 「괴이봇 명부」에 저장
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.waitForSelector('[data-action="prefs-open"]');
  await page.click('[data-action="prefs-open"]');
  await page.click('[data-action="set-scope"][data-value="card"]');
  await page.waitForSelector('.dir');
  const kinds = await page.textContent('.dir-kinds');
  assert.ok(/괴이\s*70/.test(kinds) && /요원\s*55/.test(kinds) && /조직\s*16/.test(kinds), kinds);
  assert.equal(await page.getAttribute('.dir-bar [data-value="save"]', 'disabled'), '', '고친 게 없으면 저장 못 함');
  // 괴이: 명일 아파트를 발생 후보에서 빼기
  // 통합 검색: 탭과 상관없이 다섯 탭을 묶어 보여 주고, 고르면 그 탭으로 가서 펼친다
  await page.click('[data-action="dir-kind"][data-value="agent"]');
  await page.fill('[data-input="dir-q"]', '관리국');
  await page.waitForFunction(() => document.querySelectorAll('.dir-list .dir-group').length >= 2);
  if (shots) await page.screenshot({ path: `${shots}/17-dir-search.png` });
  await page.fill('[data-input="dir-q"]', '명일');
  await page.click('.dir-head[data-value="anomaly|명일 아파트"]');
  await page.waitForSelector('.dir-kinds [data-value="anomaly"].on');
  assert.equal(await page.inputValue('[data-input="dir-q"]'), '');
  await page.click('[data-action="dir-set"][data-value="preset|0|명일 아파트"]');
  await page.waitForFunction(() => !document.querySelector('.dir-bar [data-value="save"]')?.disabled);
  // 다른 폴더에서 온 후보: 원본 World catalog의 조직·개체는 따로 묶고 출처 폴더를 보여 준다. 새 후보 추가
  await page.fill('[data-input="dir-q"]', '');
  await page.click('[data-action="dir-kind"][data-value="anomaly"]');
  const listText = await page.textContent('.dir-list');
  assert.ok(listText.includes('다른 폴더에서 온 후보') && listText.includes('🙂요원 · 개체') && listText.includes('🌆세력'), '출처 폴더 표시');
  await page.click('[data-action="dir-add-toggle"]');
  await page.fill('[data-input="dir-ext-q"]', '세력');
  const extName = await page.getAttribute('.dir-ext-item', 'data-value');
  assert.ok(extName);
  await page.click('.dir-ext-item');
  await page.waitForSelector(`.dir-head[data-value="${extName}"][aria-expanded="true"]`);
  // 조직 추가 → 요원에게 고르기
  await page.click('[data-action="dir-kind"][data-value="org"]');
  await page.click('[data-action="dir-add-toggle"]');
  await page.fill('[name="dir-org-new"]', '테스트 조직');
  await page.click('[data-action="dir-org-add"]');
  await page.waitForSelector('.dir-head[data-value="테스트 조직"]');
  await page.click('[data-action="dir-org-toggle"][data-value="rosterFor|A00|테스트 조직"]');
  // 기본 세력: 부르는 이름·괴담톡 전용 탭·첫 장면 로어북
  await page.click('.dir-head[data-value="관리국"]');
  await page.fill('[data-input="dir"][data-key="disp:B00|A00"]', '짝퉁 관리국');
  await page.fill('[data-input="dir"][data-key="ptab:T01"]', '본부');
  await page.fill('[data-input="dir"][data-key="seed:A00-8"]', '관리국, 쟈알디');
  if (shots) {
    await page.evaluate(() => document.querySelector('[data-key="ptab:T01"]').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${shots}/17-directory-builtin.png` });
    const vp = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.locator('[data-key="disp:none|A00"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${shots}/17-directory-builtin-mobile.png` });
    await page.setViewportSize(vp);
  }
  await page.click('[data-action="dir-kind"][data-value="agent"]');
  await page.fill('[data-input="dir-q"]', '쟈알디');
  await page.click('.dir-head[data-value="agent|쟈알디"]');
  await page.click('[data-action="dir-org-pick"][data-value="테스트 조직|쟈알디"]');
  await page.fill('[data-input="dir"][data-key="rank|쟈알디"]', '국장');
  if (shots) await page.screenshot({ path: `${shots}/17-directory.png` });
  await page.click('.dir-bar [data-value="save"]');
  await page.click('[data-action="dir-save"]');
  await page.waitForFunction(() => window.__calls.setChar === 1);
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
  await page.waitForFunction(() => document.querySelector('.gx-toast[data-toast="dir"]')?.textContent.includes('저장했어요'));
  // 저장한 값으로 다시 읽힘: 새로고침 뒤에도 쟈알디는 테스트 조직
  await page.fill('[data-input="dir-q"]', '쟈알디');
  assert.ok((await page.textContent('.dir-list')).includes('테스트 조직'));
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
  const offReq = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model'));
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
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await open(page);
  await page.waitForSelector('[data-action="prefs-open"]');
  await page.click('[data-action="prefs-open"]');
  await page.click('[data-action="set-scope"][data-value="card"]');
  await page.waitForSelector('.dir');
  await page.click('[data-action="dir-kind"][data-value="org"]');
  await page.click('[data-action="dir-add-toggle"]');
  await page.fill('[name="dir-org-new"]', '테스트 결사');
  await page.click('[data-action="dir-org-add"]');
  await page.waitForSelector('[data-action="dir-fac-play"][data-value="1|테스트 결사"]');
  await page.click('[data-action="dir-fac-play"][data-value="1|테스트 결사"]');
  await page.waitForSelector('.dir-code');
  assert.equal(await page.textContent('.dir-code'), 'F00');
  assert.equal(await page.$('[data-action="dir-fac-patch"]'), null, '새 Lite 카드에는 자리표시자가 이미 있음');
  await page.click('[data-action="dir-fac-type"][data-value="freelancer|테스트 결사"]');
  await page.fill('[data-key="org:title|테스트 결사"]', '비밀 결사');
  await page.fill('[data-key="org:blurb|테스트 결사"]', '밤에만 움직이는 결사.');
  await page.fill('[data-key="org:gm_name|테스트 결사"]', 'Test Society');
  await page.fill('[data-key="org:gm_desc|테스트 결사"]', 'A secret society.');
  if (shots) await page.screenshot({ path: `${shots}/20-faction-org.png` });
  // 기본 세력 숨기기
  await page.click('.dir-head[data-value="관리국"]');
  await page.click('[data-action="dir-fac-hide"][data-value="0|관리국"]');
  // 요원 한 명을 새 세력으로
  await page.click('[data-action="dir-kind"][data-value="agent"]');
  await page.fill('[data-input="dir-q"]', '쟈알디');
  await page.click('.dir-head[data-value="agent|쟈알디"]');
  await page.click('[data-action="dir-org-pick"][data-value="테스트 결사|쟈알디"]');
  assert.ok((await page.textContent('.dir-panel')).includes('비밀 결사') || (await page.textContent('.dir-panel')).includes('테스트 결사'));
  await page.click('.dir-bar [data-value="save"]');
  await page.click('[data-action="dir-save"]');
  await page.waitForFunction(() => window.__calls.setChar === 1);
  const book = await page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content));
  const org = book.조직['테스트 결사'];
  assert.deepEqual([org.code, org.playable, org.type, org.title, org.gm_name], ['F00', true, 'freelancer', '비밀 결사', 'Test Society']);
  assert.deepEqual(book.codes_used, ['F00']);
  assert.equal(book.조직['관리국'].hidden, true);
  assert.ok(book.요원.쟈알디.roster_for.includes('F00') && book.요원.쟈알디.phone_tabs.includes('T105'));
  // 시작 화면: 관리국은 숨고 비밀 결사가 보임, 첫 장면은 직접 입력·커스텀 임무 두 개
  await page.click('[data-action="prefs-close"]');
  await page.waitForSelector('.gx-facs');
  assert.equal(await page.$('[data-action="faction"][data-value="A00"]'), null, '숨긴 기본 세력');
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
  await page.click('[data-action="tab"][data-value="settings"] >> nth=0');
  await page.click('[data-action="upd-prepare"]');
  await page.waitForSelector('.upd-plan');
  if (shots) await page.locator('.upd-plan').scrollIntoViewIfNeeded(), await page.screenshot({ path: `${shots}/update-settings.png` });
  assert.match(await page.textContent('.upd-plan'), /첫 안내/);
  assert.match(await page.textContent('.upd-plan'), /카드 사진: 바뀜 1 · 새로 1/);
  await page.click('[data-action="upd-apply"]');
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
  await page.waitForSelector('.gx-hint');
  if (shots) await page.locator('.gx-hint').last().scrollIntoViewIfNeeded().catch(() => {}), await page.screenshot({ path: `${shots}/update-done.png` });
  assert.match(await page.textContent('.gx-settings'), /v9\.0\.0으로 바꿨어요/);
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
  const files = Object.fromEntries(['goei-body.json', ...JSON.parse(readFileSync(new URL('../dist/goei-body.json', import.meta.url), 'utf8')).parts]
    .map((n) => [n, readFileSync(new URL(`../dist/${n}`, import.meta.url), 'utf8')]));
  await frame.evaluate((files) => {
    window.__fetch = (u) => { const name = u.split('?')[0].split('/').pop(); return files[name] ?? null; };
  }, files);
  await frame.click('[data-gl="get"]');
  await frame.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  assert.equal(await frame.locator('.gl-card').count(), 0, '받으면 창이 닫힘');
  assert.match(await frame.evaluate(() => window.__store['p:goei:body'].slice(0, 40)), /^\/\/ goei-body /);
  await frame.click('[x-goei-fab] button');
  await frame.waitForSelector('.gx-fac');
  // 시작 카드 표시도 본체가 맡는다
  assert.match(await frame.evaluate(() => window.__calls.handlers.display('<div data-goei="landing">ANOMALY SIMULATION</div>')), /landing/);
  assert.deepEqual(errors, []);
  console.log('PASS 시작기: 격리 환경에서 본체 없음 → 받기 창 → 조각으로 받아 실행 → 창 열기');
  await page.close();
}

// 관찰형 게임: 그림 팩이 없으면 받기 화면, 받은 뒤에는 바로 게임
{
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await page.click('[x-goei-fab] button');
  await page.click('[data-action="game-open"] >> nth=0');
  // 게임 창 기본은 1인 전투 검증판 (main 액션 작업). 이 시험은 기존 순찰
  await page.click('[data-game-mode="patrol"]');
  await page.waitForSelector('.gx-gp');
  if (shots) {
    await page.screenshot({ path: `${shots}/game-pack.png` });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shots}/game-pack-m.png` });
    await page.setViewportSize({ width: 1100, height: 900 });
  }
  await page.click('[data-gp="get"]');
  await page.waitForFunction(() => !document.querySelector('.gx-gp-msg')?.hidden && !document.querySelector('[data-gp="get"]').disabled);
  assert.match(await page.textContent('.gx-gp-msg'), /받지 못했어요/);
  const pack = readFileSync(new URL('../dist/goei-game-patrol.pack', import.meta.url)).toString('base64');
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    window.__fetch = (u) => (u.includes('goei-game-patrol.pack') ? bytes : null);
  }, pack);
  await page.click('[data-gp="get"]');
  await page.waitForSelector('.goei-game canvas');
  await page.waitForFunction(() => !document.querySelector('.gg-load'));
  assert.equal(await page.evaluate(() => Object.keys(JSON.parse(window.__store['p:goei:game-pack:patrol']).files).length), 19, '그림 19장 저장');
  await page.waitForTimeout(1500);
  if (shots) {
    await page.screenshot({ path: `${shots}/game-pc.png` });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${shots}/game-m.png` });
    await page.setViewportSize({ width: 1100, height: 900 });
  }
  await page.click('[data-action="game-close"]');
  assert.equal(await page.locator('.gx-game').count(), 0);
  await page.click('[data-action="game-open"] >> nth=0');
  await page.waitForSelector('.goei-game canvas');
  assert.equal(await page.locator('.gx-gp').count(), 0, '받은 뒤에는 바로 게임');
  assert.deepEqual(errors, []);
  console.log('PASS 관찰형 게임: 그림 팩 받기 실패 안내 → 받기 → 저장 → 다시 열면 바로 게임');
  await page.close();
}

// 17b) 설정 위 「설정·명부」 줄은 스크롤해도 위에 고정, 명부 탭에서는 그 아래 분류 줄도 함께 고정. 거점 탭은 조직 제목 없이 한 목록
for (const vp of [{ width: 1100, height: 900 }, { width: 390, height: 844 }]) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, vp);
  await startedWithReply(page);
  await open(page);
  await page.locator('[data-action="tab"][data-value="settings"]:visible').first().click();
  await page.waitForSelector('.gx-settings > .st-scopebar');
  const stuck = (sel) => page.evaluate((sel) => {
    const body = document.querySelector('.gx-settings');
    body.scrollTop = body.scrollHeight;
    const b = body.getBoundingClientRect();
    const r = document.querySelector(sel).getBoundingClientRect();
    return { gap: Math.round(r.top - b.top), scrolled: body.scrollTop > 200 };
  }, sel);
  const a = await stuck('.gx-settings > .st-scopebar');
  assert.ok(a.scrolled && a.gap <= 2, `설정 줄 고정 ${JSON.stringify(a)}`);
  const m = vp.width < 500 ? 'm' : 'pc';
  if (shots) await page.screenshot({ path: `${shots}/17b-set-sticky-${m}.png` });
  if (m === 'pc') {
    // 화면: 메뉴 오른쪽, 창 바깥 불투명도 0%
    const setDim = (pg, n) => pg.$eval('input[data-input="dim"]', (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, n);
    await page.click('[data-action="set-nav"][data-value="right"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.nav === 'right');
    assert.ok(await page.evaluate(() => document.querySelector('.gx-nav').getBoundingClientRect().left > document.querySelector('.gx-content').getBoundingClientRect().left), '메뉴가 오른쪽');
    await setDim(page, 0);
    await page.waitForFunction(() => /rgba\(3, 7, 9, 0\)|transparent/.test(getComputedStyle(document.querySelector('.gx')).backgroundColor));
    await setDim(page, 100);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.gx')).backgroundColor === 'rgb(3, 7, 9)');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gx-hsep')).color === 'rgb(0, 0, 0)'), false, '글자색 변수 그대로');
    await setDim(page, 0);
    if (shots) await page.screenshot({ path: `${shots}/17b-nav-right.png` });
    await page.click('[data-action="set-nav"][data-value="left"]');
    await setDim(page, 50);
    // 기능별 설정: 맨 위 단추로 그 탭의 설정을 바로 연다
    assert.ok(await page.evaluate(() => document.querySelector('.gx-settings .ps-group h3')?.textContent === '기능별 설정'), '기능별 설정이 맨 위');
    await page.click('[data-action="feature-set"][data-value="wiki"]');
    await page.waitForSelector('.nw-setpane');
    await page.click('[data-action="tab"][data-value="settings"]');
    await page.click('[data-action="feature-set"][data-value="gnet"]');
    await page.waitForFunction(() => document.querySelector('[data-action="gn-settings"]')?.getAttribute('aria-pressed') === 'true');
    await page.click('[data-action="tab"][data-value="settings"]');
    await page.waitForSelector('.gx-settings .st-feats');
    if (shots) {
      await page.evaluate(() => document.querySelector('.st-world').scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${shots}/16-settings-lower.png` });
    }
  }
  await page.click('[data-action="set-scope"][data-value="card"]');
  await page.waitForSelector('.dir-kinds');
  await page.click('[data-action="dir-kind"][data-value="agent"]');
  await page.waitForTimeout(200);
  const bar = await stuck('.gx-settings > .st-scopebar');
  const kinds = await page.evaluate(() => {
    const k = document.querySelector('.dir-kinds').getBoundingClientRect();
    const t = document.querySelector('.gx-settings > .st-scopebar').getBoundingClientRect();
    return Math.round(k.top - t.bottom);
  });
  assert.ok(bar.scrolled && bar.gap <= 2 && kinds >= 0 && kinds <= 10, `명부 두 줄 고정 ${JSON.stringify(bar)} ${kinds}`);
  if (shots) await page.screenshot({ path: `${shots}/17b-dir-sticky-${m}.png` });
  await page.click('[data-action="dir-kind"][data-value="base"]');
  await page.waitForSelector('.dir-row');
  assert.equal(await page.locator('.dir .dir-group').count(), 0, '거점 탭은 조직 제목 없음');
  await page.evaluate(() => { document.querySelector('.gx-settings').scrollTop = 0; });
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
  await page.click('[data-action="tab"][data-value="settings"] >> nth=0');
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
  await page.click('[data-action="tab"][data-value="map"] >> nth=0');
  await page.waitForSelector('.gx-field');
  await page.selectOption('select[data-change="map-region"]', sido.split('=').pop() || '02');
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => [...document.querySelectorAll('.gx-field .fac')].some((p) => p.textContent.includes('시험 거점')));
  assert.ok(seen, '새 거점이 임무 지도에 보임');
  if (shots) await page.screenshot({ path: `${shots}/17c-map-newbase.png` });
  // 괴이 사진 고르기 → 저장하면 명부에 남음
  await page.click('[data-action="tab"][data-value="settings"] >> nth=0');
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
  await page.click('[data-action="tab"][data-value="wiki"] >> nth=0');
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
    await page.locator('[data-action="tab"][data-value="settings"]:visible').first().click();
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
      await page.click('[data-action="tab"][data-value="board"] >> nth=0');
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
  await page.click('[data-action="tab"][data-value="board"]:visible');
  await page.click('.gx-bdrawer .ph-grip');
  assert.equal(await page.locator('.gx-bdrawer .mk-slot:not(.empty)').count(), 1);
  assert.equal(await page.locator('.gx-bdrawer [data-action="game-open"], .gx-bdrawer [data-value="settings"]').count(), 0, '순찰·설정 버튼은 뺌');
  await page.click('.gx-bdrawer .mk-slot:not(.empty)');
  assert.equal(await tabNow(), 'wiki', '칸을 누르면 그 화면');
  assert.equal(await page.locator('.ph-drawer.open').count(), 0, '서랍에서 가면 서랍은 접힘');
  await page.click('[data-action="tab"][data-value="board"]:visible');
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

await browser.close();
