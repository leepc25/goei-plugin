// QC 전수 점검 · 플러그인 창 안 기능 모듈 (괴담넷·괴담톡·위키·상황판·가계부·인물 기록·공통 보조 호출). 보고서 docs/qc/04_modules.md
// 사용법: node tests/qc-modules-browser.mjs <fixture.json> [screenshot-dir]   (fixture: tests/make_fixture.py). ONLY=G1,P2 로 절만 골라 돌린다
// 호스트 흉내(hostScript·boot·open)는 tests/browser.mjs 와 같다. 모델 응답은 window.__llm 큐에 넣어 흉내 낸다.
import { createRequire } from 'node:module';
import { distWorldPack } from './data-init.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';

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
      // 두 번째 채팅(__chat1)을 두면 채팅 번호 1 은 그쪽 (창이 보는 채팅과 다른 채팅의 자동 확인 시험)
      getChatFromIndex: async (c, i) => { if (i === 1 && window.__chat1) return clone(window.__chat1); window.__calls.reads = (window.__calls.reads ?? 0) + 1; return clone(window.__chat); },
      setChatToIndex: async (a, b, chat) => { if (b === 1 && window.__chat1) { window.__chat1 = clone(chat); return; } window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
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

// ── 공통 도우미 ──
// ONLY=G1,P1 처럼 절을 골라 돌릴 수 있다
const want = (id) => !process.env.ONLY || process.env.ONLY.split(',').includes(id);

/** A00으로 시작하고 첫 응답(상황판 태그 포함)을 넣어 「진행 중」 상태로. 창은 닫아 둔다 */
async function startedWithReply(page, { phoneAuto = false, gnetAuto = false } = {}) {
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
  await page.evaluate(async ({ reply, phoneAuto, gnetAuto }) => {
    if (!phoneAuto) window.__chat.scriptstate.$ph_auto = '0';
    if (!gnetAuto) window.__chat.scriptstate['$lb_cfg_lb-gn.lazy'] = '1';
    window.__chat.message.push({ role: 'user', data: '시작' }, { role: 'char', data: reply });
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
    const g = document.querySelector('.gx'); if (g) g.style.display = 'none';
  }, { reply, phoneAuto, gnetAuto });
  return { preset, where, code };
}
// 창은 열 때 채팅을 다시 읽는다: 밖에서(시험이) 채팅 값을 바꾼 뒤엔 닫았다 다시 연다 (마지막 탭으로 열린다)
async function reopen(page) {
  const reads = await page.evaluate(() => window.__calls.reads ?? 0);
  await page.click('[data-action="close"]');
  await open(page);
  // 창이 채팅을 다시 읽고 그릴 때까지 (옛 화면에 누르면 클릭이 사라진다)
  await page.waitForFunction((n) => (window.__calls.reads ?? 0) > n, reads);
  await wait(300);
}
// PC 메뉴는 보고 있는 탭을 한 번 더 누르면 상황판으로 간다 (사용자 2026-10-21) → 이미 그 탭이면 누르지 않는다
const nav = async (page, id) => {
  const sel = `.gx-nav .gx-nb:not(.mob)[data-value="${id}"]`;
  if (!(await page.locator(`${sel}.on`).count())) await page.click(sel);
};
const llm = (page, list) => page.evaluate((l) => { window.__llm = l; }, list);
const llmCount = (page) => page.evaluate(() => (window.__calls.llm ?? []).length);
const ok = (s) => ({ type: 'success', result: s });
const fail = (s = 'Failed to fetch') => ({ type: 'fail', result: s });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = (page) => page.waitForFunction(() => !document.querySelector('.nw-busy'), null, { timeout: 8000 });
/** 다음 본편 응답이 들어온 것처럼 output 처리기를 부른다 */
async function fireOutput(page, text = '다음 장면이 이어졌다.') {
  return page.evaluate(async (t) => {
    const c = window.__chat;
    c.message.push({ role: 'user', data: '계속' }, { role: 'char', data: t });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  }, text);
}
const B = 1846000;
const post = (id, over = {}) => ({ author: `n${id}`, id: B + id, title: `제목 ${id}`, time: '02:30', date: '2025.01.01 02:30', views: 10, upvotes: 1, content: `본문 ${id}`, mine: false, comments: [], ...over });

// ═══════════ 괴담넷 ═══════════

// G1) 응답 깨짐·빈 응답·모델 실패: 기존 게시판 유지, 화면이 잠기지 않고, 실패 원문이 보인다. 재시도는 형식 오류에만
if (want('G1')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await nav(page, 'gnet');
  await page.waitForSelector('.gn');
  // 1-a. 깨진 JSON → 설정 재시도(기본 1회)로 한 번 더 묻고, 그것도 깨지면 실패 + 원문
  await llm(page, [ok('{"posts": [ {"author": "a", "id": 1846001, "title": "t"'), ok('이건 JSON 아님')]);
  await page.click('[data-action="gn-refresh"]');
  await page.waitForSelector('.nw-busy');
  await idle(page);
  assert.equal(await llmCount(page), 2, '형식 오류는 설정 횟수(1)만큼 다시 묻는다');
  const retryMsgs = await page.evaluate(() => window.__calls.llm[1].messages);
  assert.ok(retryMsgs.at(-1).content.includes('Validation error'), '다시 물을 때 오류 안내');
  assert.ok((await page.textContent('.nw-fail')).includes('이건 JSON 아님'), '실패 원문 보관');
  assert.ok(await page.isEnabled('[data-action="gn-refresh"]'), '실패 뒤 새로고침 단추가 다시 눌린다');
  assert.ok((await page.textContent('.gn')).includes('게시글이 없어요'), '기존(빈) 게시판 유지');
  // 1-b. 빈 응답 → LlmError, 재시도 없음
  await llm(page, [ok('   '), ok('{"posts":[]}')]);
  await page.click('[data-action="gn-refresh"]');
  await idle(page);
  assert.equal(await llmCount(page), 3, '빈 응답은 연결 문제로 보고 다시 묻지 않는다');
  assert.ok((await page.textContent('.gx-toast, .gn')).includes('빈 응답'));
  // 1-c. 모델 실패 (type fail)
  await llm(page, [fail('Failed to fetch')]);
  await page.click('[data-action="gn-refresh"]');
  await idle(page);
  assert.equal(await llmCount(page), 4);
  assert.ok((await page.textContent('.gn')).includes('모델 요청에 실패'));
  // 1-d. posts 가 비었거나 전부 사용자 명의 → 유지 + 안내
  await llm(page, [ok(JSON.stringify({ posts: [post(1, { author: '익명' })] }))]);
  await page.click('[data-action="gn-refresh"]');
  await idle(page);
  assert.ok((await page.textContent('.gn')).includes('기존 게시판을 유지'), '사용자 명의 글만 오면 유지');
  // 1-e. 정상 응답 뒤 두 번 연달아 누르기: 두 번째는 「끝난 뒤 다시」 안내만, 모델 호출 없음
  const n0 = await llmCount(page);
  // 느린 모델(0.8초): 생성 중에 한 번 더 누르면 안내만, 모델 호출은 한 번
  await page.evaluate((b) => {
    const orig = window.risuai.runLLMModel;
    window.risuai.runLLMModel = async (o) => { window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 800)); window.risuai.runLLMModel = orig; return { type: 'success', result: b }; };
  }, JSON.stringify({ posts: [post(1), post(2)] }));
  await page.click('[data-action="gn-refresh"]');
  await page.waitForSelector('.nw-busy');
  await page.evaluate(() => document.querySelector('[data-action="gn-refresh"]').removeAttribute('disabled'));
  await page.click('[data-action="gn-refresh"]');
  assert.ok((await page.textContent('.gn')).includes('끝난 뒤 다시'), '생성 중 안내');
  await idle(page);
  assert.equal(await llmCount(page), n0 + 1, '겹쳐 누르면 한 번만 부른다');
  assert.equal(await page.locator('.gn-row').count(), 2);
  assert.deepEqual(errors, []);
  console.log('PASS 괴담넷: 깨진 JSON 재시도·빈 응답·모델 실패·사용자 명의만·겹쳐 누르기');
  await page.close();
}

// G2) XSS: 모델 출력·사용자 입력이 화면에 들어갈 때 HTML 로 실행되지 않는다 (글·댓글·쪽지·닉네임·설정 글칸)
if (want('G2')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await page.evaluate(() => { window.__chat.scriptstate.$gn_raw = ['GN1', `Q|${1846001}`, `P|1846001|2025.01.01 02:00|익명|내 글|0|0|내 본문|1`].join('\n'); });
  await open(page);
  await nav(page, 'gnet');
  const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  const board = { posts: [
    post(2, { author: `"><b onclick="window.__xss=3">x`, title: `제목 ${evil}`, content: `본문 ${evil}`, comments: [{ author: `c${evil}`, content: `댓글 ${evil}`, parent: 0, mine: false }] }),
  ], incoming: [{ nick: `쪽${evil}`, body: `쪽지 ${evil}` }] };
  await llm(page, [ok(JSON.stringify(board))]);
  await page.click('[data-action="gn-refresh"]');
  await idle(page);
  await page.waitForSelector('.gn-row-main[data-value="1846002"]', { timeout: 5000 }).catch(async () => { throw new Error(`글이 안 보임: ${await page.textContent('.gn')}`); });
  await page.click('.gn-row-main[data-value="1846002"]');
  await page.waitForSelector('.gn-post');
  assert.equal(await page.evaluate(() => window.__xss), undefined, '모델 출력이 실행되지 않음');
  assert.equal(await page.locator('.gn img[src="x"]').count(), 0, 'img 태그가 글자로만');
  assert.ok((await page.textContent('.gn-post-body')).includes('<img src=x'), '본문은 글자로 보인다');
  // 쪽지 목록·본문
  await page.click('[data-action="gn-sub"][data-value="dm"]');
  await page.click('.gn-dmrow');
  await page.waitForSelector('.gn-pane .ph-msg');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  // 사용자 입력: 닉네임·주제 설정
  await page.click('[data-action="gn-nick"]');
  await page.fill('input[name="gn-nick"]', `닉${evil}`);
  await page.click('[data-action="gn-nick-save"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$gn_nick ?? '').startsWith('닉<img'));
  assert.equal(await page.evaluate(() => window.__xss), undefined, '닉네임도 글자로');
  assert.ok((await page.textContent('.gn-mynick')).includes('<img src=x'));
  await page.click('[data-action="gn-settings"]');
  await page.fill('[data-change="gn-text"][data-key="subject"]', `주제 "${evil}`);
  await page.dispatchEvent('[data-change="gn-text"][data-key="subject"]', 'change');
  await page.waitForFunction(() => (window.__chat.scriptstate['$lb_cfg_lb-gn.subject'] ?? '').startsWith('주제'));
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.inputValue('[data-change="gn-text"][data-key="subject"]'), `주제 "${evil}`, '글칸 값은 그대로');
  assert.deepEqual(errors, []);
  console.log('PASS 괴담넷: 모델 출력·사용자 입력 HTML escape (글·댓글·쪽지·닉네임·설정)');
  await page.close();
}

// G3) 큰 게시판(글 500개·댓글 2,000개)과 쪽지 보관 상한·자동 정리, 별명, 사생활·수량 설정이 요청에 들어가는지
if (want('G3')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  // 저장 형식으로 큰 게시판을 넣는다
  const lines = ['GN1', `Q|${B + 500}`];
  for (let i = 500; i >= 1; i--) {
    lines.push(`P|${B + i}|2025.01.01 02:${String(i % 60).padStart(2, '0')}|닉${i}|제목 ${i} 아주 긴 제목이 들어간다|${i * 3}|${i}|본문 ${i}\\n둘째 줄|${i % 7 === 0 ? 1 : 0}`);
    for (let c = 1; c <= 4; c++) lines.push(`C|${B + i}|${c > 1 ? c - 1 : 0}|댓${c}|댓글 ${i}-${c}|0|0|2025.01.01 03:${String(c).padStart(2, '0')}`);
  }
  for (let i = 0; i < 60; i++) lines.push(`D|상대${i % 3}|${i % 2 ? 'me' : 'npc'}|쪽지 ${i}|${i % 2 ? 0 : 1}|2025.01.01 04:00`);
  await page.evaluate((raw) => { window.__chat.scriptstate.$gn_raw = raw; }, lines.join('\n'));
  await open(page);
  await page.waitForSelector('.gx-nav');
  const t0 = Date.now();
  await nav(page, 'gnet');
  await page.waitForSelector('.gn-row-main');
  const dt = Date.now() - t0;
  assert.equal(await page.locator('.gn-row').count(), 500);
  assert.ok(dt < 5000, `글 500개 첫 그리기 ${dt}ms`);
  const t2 = Date.now();
  await page.click('[data-action="gn-sub"][data-value="dm"]');
  await page.waitForSelector('.gn-dmrow');
  await page.click('[data-action="gn-sub"][data-value="board"]');
  await page.waitForSelector('.gn-row-main');
  assert.ok(Date.now() - t2 < 2500, `글 500개 다시 그리기 ${Date.now() - t2}ms`);
  const t1 = Date.now();
  await page.click('.gn-row-main[data-value="' + (B + 250) + '"]');
  await page.waitForSelector('.gn-post');
  assert.ok(Date.now() - t1 < 3000, '글 열기');
  assert.equal(await page.locator('.gn-pane .gn-c').count(), 4);
  // 쪽지함: 상대 3명, 각 20통 (기본 상한 40 안) → 자동 정리 상한을 5로 내리면 저장 때 5통만
  await page.click('[data-action="gn-sub"][data-value="dm"]');
  assert.equal(await page.locator('.gn-dmrow').count(), 3);
  await page.click('[data-action="gn-settings"]');
  await page.fill('[data-change="gn-keep"]', '5');
  await page.dispatchEvent('[data-change="gn-keep"]', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$gn_storage_limit_dm === '5');
  // 상한은 다음 저장(writeGnet) 때 적용된다: 쪽지를 하나 읽으면 저장된다
  await page.click('[data-action="gn-settings"]');
  await page.click('.gn-dmrow[data-value="상대0"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$gn_raw.match(/^D\|상대0\|/gm) ?? []).length === 5, null, { timeout: 4000 });
  assert.equal((await page.evaluate(() => window.__chat.scriptstate.$gn_raw.match(/^D\|상대1\|/gm).length)), 5, '다른 상대도 5통');
  // 자동 정리를 끄면 상한을 넘겨도 지우지 않는다
  await page.click('[data-action="gn-settings"]');
  await page.click('[data-action="gn-cfg"][data-value="storage=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$gn_storage_auto_dm === '0');
  assert.equal(await page.locator('[data-change="gn-keep"]').count(), 0, '끄면 상한 칸이 사라진다');
  // 설정: 수량·사생활·다양성·주제가 요청문에 들어간다
  await page.click('[data-action="gn-cfg"][data-value="quantity=3"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.quantity'] === '3');
  await page.click('[data-action="gn-cfg"][data-value="sampling=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.sampling'] === '1');
  await page.click('[data-action="gn-cfg"][data-value="privacy=4"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.privacy'] === '4');
  await page.click('[data-action="gn-cfg"][data-value="style=wpf"]');
  await page.waitForFunction(() => window.__chat.scriptstate['$lb_cfg_lb-gn.style'] === 'wpf');
  assert.ok((await page.textContent('.ph-form .ph-room-title')).includes('세정게'), '성격을 바꾸면 창 이름도');
  await page.click('[data-action="gn-settings"]');
  await page.click('[data-action="gn-sub"][data-value="board"]');
  await llm(page, [ok(JSON.stringify({ posts: [post(900)], alternativePosts: [post(901, { title: '대안' })] }))]);
  await page.click('[data-action="gn-refresh"]');
  await idle(page);
  const sys = await page.evaluate(() => window.__calls.llm.at(-1).messages[0].content);
  const usr = await page.evaluate(() => window.__calls.llm.at(-1).messages[1].content);
  assert.ok(sys.includes('7-9') || usr.includes('7-9'), '수량 3 = 7~9개');
  assert.ok(sys.includes('Diversity sampling is ON'), '다양성 강화');
  assert.ok(usr.includes('"POST_LIMIT":"9"') || usr.includes('9'), '상한');
  assert.ok((await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('|대안|'), '다양성 켜면 alternativePosts 를 쓴다');
  // 글 500개 중 보호(내 글 7의 배수 = 71개)만 남고 나머지는 상한으로 정리됐는지
  const raw = await page.evaluate(() => window.__chat.scriptstate.$gn_raw);
  const nPosts = (raw.match(/^P\|/gm) ?? []).length;
  assert.ok(nPosts <= 9 + 71 && nPosts >= 71, `상한 9 + 보호 글 71: ${nPosts}`);
  assert.deepEqual(errors, []);
  console.log('PASS 괴담넷: 글 500개 렌더·쪽지 보관 상한·자동 정리 끄기·수량·다양성·사생활·성격 설정');
  await page.close();
}

// G4) 새로고침 「창을 열 때」·「매 턴」 + 괴담톡과 같은 모델이면 Joint 한 번, 다른 모델이면 차례로 두 번. 자동 새로고침 결과 저장이 유저 조작을 덮지 않는다
if (want('G4')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page, { phoneAuto: true, gnetAuto: true });
  // 둘 다 매 턴, 같은 모델(보조) → 통합 요청 1회
  await page.evaluate(() => {
    const s = window.__chat.scriptstate;
    s.$ph_auto = '1';
    s['$lb_cfg_lb-gn.lazy'] = '0';
    s['$lb_cfg_lb-gn.mode'] = '2';
    s.$ph_model = 'aux';
    s.$cooldown_received_incoming = '-5';
  });
  const n0 = await llmCount(page);
  const combined = JSON.stringify({ gnet: { posts: [post(1), post(2)], incoming: [] }, phone: { updates: [], announcements: [], invitations: [] } });
  await llm(page, [ok(combined)]);
  await fireOutput(page, '장면 하나.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 1 && /제목 1/.test(window.__chat.scriptstate.$gn_raw ?? ''), n0, { timeout: 8000 });
  await wait(300);
  const joint = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.ok(joint.messages[0].content.startsWith('Execute two independent automatic tasks'), '통합 요청');
  const body = JSON.parse(joint.messages[1].content);
  assert.ok(Array.isArray(body.gnet) && Array.isArray(body.phone));
  assert.equal(await llmCount(page), n0 + 1, '한 번만');
  // 통합 응답에서 한쪽이 null → 그쪽만 따로 한 번 더
  await llm(page, [ok(JSON.stringify({ gnet: null, phone: { updates: [], announcements: [], invitations: [] } })), ok(JSON.stringify({ posts: [post(3)], incoming: [] }))]);
  await fireOutput(page, '장면 둘.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 3, n0, { timeout: 8000 });
  await wait(300);
  assert.ok((await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('제목 3'), 'null 이면 괴담넷만 다시 물어 반영');
  // 다른 모델 → 차례로 두 번 (괴담톡 먼저, 그다음 괴담넷)
  await page.evaluate(() => { window.__chat.scriptstate['$lb_cfg_lb-gn.mode'] = '1'; });
  await llm(page, [ok('{"updates":[],"announcements":[],"invitations":[]}'), ok(JSON.stringify({ posts: [post(4)], incoming: [] }))]);
  await fireOutput(page, '장면 셋.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 5, n0, { timeout: 8000 });
  await wait(300);
  const [c1, c2] = await page.evaluate(() => window.__calls.llm.slice(-2));
  assert.equal(c1.mode, 'submodel');
  assert.equal(c2.mode, 'model', '괴담넷은 메인');
  assert.ok(JSON.parse(c1.messages[1].content).rooms !== undefined, '괴담톡 먼저');
  assert.ok((await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('제목 4'));
  // 통합 응답 전체가 깨지면 둘 다 실패하고 재시도(각자) 뒤에도 기존 게시판 유지, 다음 턴에 다시 산다
  await page.evaluate(() => { window.__chat.scriptstate['$lb_cfg_lb-gn.mode'] = '2'; });
  await llm(page, [ok('완전히 깨진 응답')]);
  await fireOutput(page, '장면 넷.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length >= n + 6, n0, { timeout: 8000 });
  await wait(800);
  assert.ok((await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('제목 4'), '실패해도 기존 유지');
  // 자동 새로고침 중에 사용자가 글을 지워도 자동 결과가 그 삭제를 덮지 않는다 (생성 중 바뀐 게시판 → 결과 버림)
  await open(page);
  await nav(page, 'gnet');
  await page.waitForSelector('.gn-row-main');
  await page.evaluate(() => { window.__chat.scriptstate['$lb_cfg_lb-gn.lazy'] = 'open'; window.__chat.scriptstate.$ph_auto = '0'; });
  await page.evaluate(() => { window.__llm = []; window.__slow = true; });
  // 느린 모델: runLLMModel 을 잠깐 바꿔 1초 뒤 답하게
  await page.evaluate(() => {
    const orig = window.risuai.runLLMModel;
    window.risuai.runLLMModel = async (o) => { window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 1200)); return { type: 'success', result: JSON.stringify({ posts: [{ author: 'z', id: 1846990, title: '느린 결과', time: '01:00', date: '2025.01.01 01:00', views: 1, upvotes: 0, content: 'x', mine: false, comments: [] }], incoming: [] }) }; };
    window.__restoreLlm = () => { window.risuai.runLLMModel = orig; };
  });
  await page.click('[data-action="gn-refresh"]');
  await page.waitForSelector('.nw-busy');
  // 생성 중 사용자가 설정에서 닉네임을 바꾼다 (게시판 자체는 안 바뀜 → 결과 적용됨), 그리고 글을 지우면 → 결과 버림
  // 게시판의 글 하나를 통째로 지운다 (마지막 줄이면 줄바꿈이 없다)
  const removed = await page.evaluate(() => { const before = window.__chat.scriptstate.$gn_raw; window.__chat.scriptstate.$gn_raw = before.split('\n').filter((l) => !/^[PC]\|1846004\|/.test(l)).join('\n'); return before !== window.__chat.scriptstate.$gn_raw; });
  assert.ok(removed, '지울 글이 있어야 한다');
  await idle(page);
  await page.evaluate(() => window.__restoreLlm());
  const notice = await page.textContent('.gn');
  assert.ok(notice.includes('게시판이 바뀌어서'), `생성 중 바뀐 게시판은 적용하지 않음: ${notice.slice(0, 200)}`);
  assert.ok(!(await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('느린 결과'));
  assert.deepEqual(errors, []);
  console.log('PASS 괴담넷: 매 턴 자동 새로고침 Joint(같은 모델 1회·null 보충·다른 모델 차례)·통합 실패·생성 중 변경 보호');
  await page.close();
}

// G5) 별명(userNick)·내 글 보호·새 쪽지 보내기(받는 사람 직접 입력)·답장·쪽지 삭제·글/댓글 삭제 뒤 번호 당김·페이지(모바일 펼침)
if (want('G5')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await nav(page, 'gnet');
  await page.waitForSelector('.gn');
  await page.click('[data-action="gn-nick"]');
  await page.fill('input[name="gn-nick"]', '야간순찰');
  await page.press('input[name="gn-nick"]', 'Enter');
  await page.waitForFunction(() => window.__chat.scriptstate.$gn_nick === '야간순찰');
  assert.ok((await page.textContent('.gn-mynick')).includes('야간순찰'), 'Enter 로도 저장(data-enter)');
  // 새로고침: 내 별명 명의 글·댓글은 뺀다
  await llm(page, [ok(JSON.stringify({ posts: [post(1, { comments: [{ author: '야간순찰', content: '사칭', parent: 0 }, { author: 'b', content: '진짜', parent: 0 }] }), post(2, { author: '야간순찰' })], incoming: [] }))]);
  await page.click('[data-action="gn-refresh"]');
  await idle(page);
  assert.equal(await page.locator('.gn-row').count(), 1, '내 명의 글은 뺌');
  assert.ok((await page.textContent('.gx-toast')).includes('새 글 1개와 댓글·연결 답글 1개'), '뺀 것 안내');
  // 새 쪽지: 받는 사람을 직접 적는다 (쪽지 상대는 공개 글이 하나뿐이면 출처가 붙는다)
  await page.click('[data-action="gn-newdm"]');
  await page.waitForSelector('[data-input="gn-to"]');
  await page.click('[data-action="gn-send"]');
  assert.ok((await page.textContent('.gn')).includes('내용을 입력'), '빈 내용 막기');
  await page.fill('[data-input="gn-draft"]', '안녕하세요');
  await page.click('[data-action="gn-send"]');
  assert.ok((await page.textContent('.gn')).includes('받는 사람 닉네임'), '받는 사람 없으면 막기');
  await page.fill('[data-input="gn-to"]', 'n1');
  await llm(page, [ok('{"body":"누구세요?"}')]);
  await page.click('[data-action="gn-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=누구세요', { timeout: 6000 });
  const dmReq = JSON.parse(await page.evaluate(() => window.__calls.llm.at(-1).messages[1].content.match(/"HISTORY":(\[[^\n]*\])/)?.[1] ?? '[]'));
  assert.ok(Array.isArray(dmReq));
  assert.ok((await page.evaluate(() => window.__calls.llm.at(-1).messages[1].content)).includes('Original forum post #1846001'), '공개 글이 하나뿐이면 출처가 붙는다');
  // 나에게는 못 보냄
  await page.click('[data-action="gn-newdm"]');
  await page.fill('[data-input="gn-to"]', '야간순찰');
  await page.fill('[data-input="gn-draft"]', '나');
  await page.click('[data-action="gn-send"]');
  assert.ok((await page.textContent('.gn')).includes('나에게는'));
  await page.click('[data-action="gn-back"]');
  // 쪽지 삭제 (두 번)
  await page.click('[data-action="gn-del-thread"][data-value="n1"]');
  await page.click('[data-action="gn-del-thread"][data-value="n1"]');
  await page.waitForFunction(() => !/^D\|n1/m.test(window.__chat.scriptstate.$gn_raw));
  assert.ok(!(await page.evaluate(() => window.__chat.scriptstate.$gn_raw)).includes('T|n1'), '출처도 지움');
  // 댓글 달기 → 답글 → 내 댓글 삭제하면 뒤 번호가 당겨지고 답글은 부모를 잃어 글에 붙는다
  await page.click('[data-action="gn-sub"][data-value="board"]');
  await page.click('.gn-row-main[data-value="1846001"]');
  await page.fill('[data-input="gn-draft"]', '내 댓글');
  await llm(page, [ok(JSON.stringify({ comments: [{ author: 'b', content: '답', parent: 2 }], incoming: [], activity: [] }))]);
  await page.click('[data-action="gn-send"]');
  await page.waitForFunction(() => /C\|1846001\|2\|b\|답\|0/.test(window.__chat.scriptstate.$gn_raw), null, { timeout: 6000 });
  await page.click('[data-action="gn-del-comment"][data-value="1846001:2"]');
  await page.click('[data-action="gn-del-comment"][data-value="1846001:2"]');
  await page.waitForFunction(() => /C\|1846001\|0\|b\|답\|0/.test(window.__chat.scriptstate.$gn_raw), null, { timeout: 4000 });
  assert.equal(await page.locator('.gn-pane .gn-c').count(), 2);
  // 모바일: 글은 목록 안에서 펼쳐지고 댓글 입력줄이 아래에 고정
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('.gx-nav .gx-nb.mob[data-value="gnet"]').catch(() => {});
  await page.waitForTimeout(200);
  if (!(await page.locator('.gn-inline').count())) await page.click('.gn-row-main[data-value="1846001"]');
  await page.waitForSelector('.gn-inline');
  assert.equal(await page.locator('.gn-composer [data-input="gn-draft"]').count(), 1, '모바일 입력줄');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS 괴담넷: 별명 저장(Enter)·사칭 거르기·새 쪽지 검사·출처·쪽지 삭제·댓글 삭제 번호 당김·모바일 펼침');
  await page.close();
}

// ═══════════ 괴담톡 ═══════════

const patchOf = (rows) => `<lb-minitalk-patch>${JSON.stringify(rows.map((r) => ({ op: 'add', path: '/messages/-', value: r })))}</lb-minitalk-patch>`;
const msg = (sender, content) => ({ content, sender, type: 'text' });
const JY = 'c_50303031';
const SP = 'c_50303032';

// P1) 응답 깨짐·빈 응답·모델 실패: 새 메시지 확인은 재시도 뒤 실패 안내 + 원문, 기존 기록 유지, 화면이 잠기지 않음. 선톡 확률 0·대기 턴이면 모델을 안 부름
if (want('P1')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await nav(page, 'phone');
  await page.waitForSelector('.ph');
  // 1-a. 깨진 JSON → 같은 자료로 한 번 더(refreshRetry) → 또 깨지면 실패
  await llm(page, [ok('{"updates": [ {"room": "dm_c_50303031"'), ok('설명문만')]);
  await page.click('[data-action="ph-refresh"]');
  await page.waitForSelector('.nw-busy');
  await idle(page);
  assert.equal(await llmCount(page), 2, '형식 오류 1회 재시도');
  const retry = await page.evaluate(() => window.__calls.llm[1].messages);
  assert.equal(retry.length, 2, '같은 자료(system+user)로 다시');
  assert.ok(retry[0].content.includes('The previous response was rejected'));
  assert.ok((await page.textContent('.nw-fail')).includes('설명문만'), '실패 원문');
  assert.ok(await page.isEnabled('[data-action="ph-refresh"]'));
  // 1-b. 빈 응답·모델 실패: 재시도 없음
  await llm(page, [ok('')]);
  await page.click('[data-action="ph-refresh"]');
  await idle(page);
  assert.equal(await llmCount(page), 3);
  await llm(page, [fail('boom')]);
  await page.click('[data-action="ph-refresh"]');
  await idle(page);
  assert.equal(await llmCount(page), 4);
  assert.ok((await page.textContent('.ph')).includes('모델 요청에 실패'));
  // 1-c. 틀린 방·틀린 공지·틀린 초대만 오면 「그것만 빼고」 → 전부 빠지면 실패로 안내
  await llm(page, [ok(JSON.stringify({ updates: [{ room: 'dm_없는방', patch: [msg('x', 'hi')] }], announcements: [{ issuer: '', category: '잡담', title: 't', text: 'x' }], invitations: [] }))]);
  await page.click('[data-action="ph-refresh"]');
  await idle(page);
  assert.equal(await llmCount(page), 6, '검사 실패는 형식 오류라 한 번 더 묻는다');
  assert.ok((await page.textContent('.ph')).includes('허용되지 않은 대화방') || (await page.textContent('.ph')).includes('공지'));
  // 1-d. 선톡 확률 0 + 초대 끄기 → 후보 없음: 모델을 부르지 않고 안내
  await page.click('[data-action="ph-settings"]');
  await page.fill('[data-change="ph-num"][data-key="incoming_chance"]', '0');
  await page.dispatchEvent('[data-change="ph-num"][data-key="incoming_chance"]', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_incoming_chance === '0');
  await page.click('[data-action="ph-cfg"][data-value="group_invites=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_group_invites === '0');
  await page.click('[data-action="ph-cfg"][data-value="announcements=0"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_announcements === '0');
  await page.click('[data-action="ph-settings"]');
  const n = await llmCount(page);
  await page.click('[data-action="ph-refresh"]');
  await wait(400);
  assert.equal(await llmCount(page), n, '확률 0·초대 끔·공지 끔이면 모델을 안 부른다');
  assert.ok((await page.textContent('.ph')).includes('건너뛰었어요'));
  // 1-e. 확률 100 + 대기 턴 중이면 선톡은 빼고 공지만 (공지 켬)
  await page.click('[data-action="ph-settings"]');
  await page.fill('[data-change="ph-num"][data-key="incoming_chance"]', '250');
  await page.dispatchEvent('[data-change="ph-num"][data-key="incoming_chance"]', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_incoming_chance === '100', null, { timeout: 3000 });
  await page.click('[data-action="ph-cfg"][data-value="announcements=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_announcements === '1');
  // 대기 표시는 「선톡을 받은 때의 이야기 턴 수」: 지금 턴으로 적으면 아직 쉬는 중
  await page.evaluate(() => { window.__chat.scriptstate.$cooldown_received_incoming = String(window.__chat.message.filter((m) => m.role === 'char' && String(m.data ?? '').trim() && !String(m.data).includes('%%')).length); });
  await page.click('[data-action="ph-settings"]');
  // 창은 열 때 채팅을 다시 읽는다: 밖에서 바꾼 대기 표시가 보이게 닫았다 연다
  await page.click('[data-action="close"]');
  await open(page);
  await page.waitForSelector('.ph'); // 마지막 탭(괴담톡)으로 다시 열린다
  await llm(page, [ok('{"updates":[],"announcements":[],"invitations":[]}')]);
  await page.click('[data-action="ph-refresh"]');
  await idle(page);
  const body = JSON.parse(await page.evaluate(() => window.__calls.llm.at(-1).messages[1].content));
  assert.equal(body.activityCheck.incoming, false, '선톡 대기 중');
  assert.equal(body.announcementCheck.allowed, true);
  assert.equal(body.rooms.length, 0, '대화 없고 선톡 불가면 방 후보 없음');
  assert.deepEqual(errors, []);
  console.log('PASS 괴담톡: 깨진 JSON 재시도·빈 응답·실패·검사 실패·확률 0·대기 턴·공지만');
  await page.close();
}

// P2) XSS·큰 대화(2,000줄)·더 보기·보관 상한·읽음 표시·알림 배지·연락처 추가/삭제·전화 상대 검사
if (want('P2')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const evil = '<img src=x onerror="window.__xss=1">';
  const st = { version: 2, seq: 1, mid: 0, rooms: {}, order: [] };
  const room = { id: `dm_${JY}`, kind: 'dm', members: [JY], people: { [JY]: { id: JY, name: '쟈알디', english: 'Jyaldi' } }, messages: [], draft: '', unread: 0, readThrough: 0 };
  for (let i = 1; i <= 2000; i++) room.messages.push({ id: ++st.mid, sender: i % 3 ? JY : 'me', text: `${i % 3 ? '받은' : '보낸'} 말 ${i} ${i === 1999 ? evil : ''}`, time: `2025.01.${String(1 + Math.floor(i / 100)).padStart(2, '0')} 0${i % 10}:00`, kind: 'message', audience: [JY] });
  room.unread = 7;
  st.rooms[room.id] = room;
  st.order.push(room.id);
  const grp = { id: 'g_1', kind: 'group', name: `방${evil}`, members: [JY, SP], people: { [JY]: { id: JY, name: '쟈알디' }, [SP]: { id: SP, name: '스팡달' } }, messages: [{ id: ++st.mid, sender: 'system', text: '초대', time: '2025.01.01 01:00', kind: 'invite', audience: [JY, SP] }, { id: ++st.mid, sender: SP, text: `단톡 ${evil}`, time: '2025.01.01 01:01', kind: 'message', audience: [JY, SP] }], draft: '', unread: 1 };
  st.rooms.g_1 = grp;
  st.order.push('g_1');
  const bul = { version: 2, seq: 0, items: [], checks: {}, seen: {} };
  for (let i = 1; i <= 45; i++) bul.items.push({ id: ++bul.seq, order: ++st.mid, read: i > 40, channel: i % 2 ? 'A00' : 'B00', channelName: i % 2 ? '관리국' : '가짜', issuer: `발신 ${evil}`, category: '공지', title: `공지 ${i} ${evil}`, text: `본문 ${i}\n둘째 ${evil}`, time: '2025.01.01 02:00' });
  await page.evaluate(({ st, bul }) => { window.__chat.scriptstate.$ph_state = JSON.stringify(st); window.__chat.scriptstate.$ph_bulletins = JSON.stringify(bul); window.__chat.scriptstate.$ph_storage_auto_dm = '0'; window.__chat.scriptstate.$ph_storage_auto_notice = '0'; }, { st, bul });
  await open(page);
  await page.waitForSelector('.gx-nav');
  assert.ok((await page.locator('.gx-nav .gx-nb:not(.mob)[data-value="phone"] .gx-nbadge').count()) > 0, '탭 배지(새 메시지)');
  const t0 = Date.now();
  await nav(page, 'phone');
  await page.waitForSelector('.ph');
  await page.click('[data-action="ph-sub"][data-value="chats"]');
  assert.ok((await page.textContent('[data-action="ph-sub"][data-value="chats"]')).includes('8'), '대화 배지 7+1');
  assert.equal(await page.locator('.ph-chats .ph-badge').count(), 2);
  await page.click('.ph-chats [data-action="ph-room"][data-value="dm_c_50303031"]');
  await page.waitForSelector('.ph-room');
  const dt = Date.now() - t0;
  assert.ok(dt < 5000, `2,000줄 방 열기 ${dt}ms`);
  assert.equal(await page.locator('.ph-log .ph-msg').count(), 40, '처음엔 40개만');
  assert.ok(await page.locator('.ph-more').count(), '이전 대화 더 보기');
  await page.click('.ph-more');
  await page.waitForFunction(() => document.querySelectorAll('.ph-log .ph-msg').length === 80);
  assert.equal(await page.evaluate(() => window.__xss), undefined, '말풍선 HTML escape');
  assert.ok((await page.textContent('.ph-log')).includes('<img src=x'), '글자로 보임');
  let s1 = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  assert.equal(s1.rooms.dm_c_50303031.unread, 0, '열면 읽음');
  assert.equal(s1.rooms.dm_c_50303031.messages.length, 2000, '자동 정리 끔이면 그대로');
  // 보관 상한 켜고 3 → 저장 때 3개만 남고 흐름 요약(baseline)과 정리 수
  await page.click('[data-action="ph-back"]');
  await page.click('[data-action="ph-settings"]');
  await page.click('[data-action="ph-cfg"][data-value="storage_auto_dm=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_storage_auto_dm === '1');
  await page.fill('[data-change="ph-num"][data-key="storage_limit_dm"]', '3');
  await page.dispatchEvent('[data-change="ph-num"][data-key="storage_limit_dm"]', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_storage_limit_dm === '3');
  await page.click('[data-action="ph-settings"]');
  await page.click('[data-action="ph-sub"][data-value="chats"]');
  await page.click('.ph-chats [data-action="ph-room"][data-value="dm_c_50303031"]');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$ph_state).rooms.dm_c_50303031.messages.length === 3, null, { timeout: 5000 });
  s1 = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  assert.equal(s1.rooms.dm_c_50303031.trimmedRecords, 1997);
  assert.equal(s1.rooms.dm_c_50303031.conversationBaseline.lastSender, JY);
  assert.ok((await page.textContent('.ph-log')).includes('오래된 기록 1997개'));
  // 단톡방: 이름·말풍선 escape, 참여자 줄
  await page.click('[data-action="ph-back"]');
  await page.click('.ph-chats [data-action="ph-room"][data-value="g_1"]');
  await page.waitForSelector('.ph-members');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.ok((await page.textContent('.ph-room-title')).includes('<img'));
  // 공지: 45개, 페이지 20·30·40 설정, 안 읽음 필터, 세력 칩, 모두 읽음, 삭제
  await page.click('[data-action="ph-back"]');
  await page.click('[data-action="ph-sub"][data-value="notices"]');
  await page.waitForSelector('.ph-notices');
  assert.equal(await page.locator('.ph-notice').count(), 30, '기본 페이지 30');
  assert.ok((await page.textContent('.ph-pager')).includes('1 / 2'));
  assert.equal(await page.locator('.ph-notice-facs .gx-chip').count(), 2, '세력이 섞였을 때 칩');
  await page.click('[data-action="ph-notice-page"][data-value="2"]');
  assert.equal(await page.locator('.ph-notice').count(), 15);
  await page.click('[data-action="ph-notice-filter"][data-value="unread"]');
  assert.equal(await page.locator('.ph-notice').count(), 30, '안 읽음 40개 중 첫 페이지');
  await page.click('[data-action="ph-notice-faction"][data-value="B00"]');
  assert.equal(await page.locator('.ph-notice').count(), 20, 'B00 안 읽음 20');
  assert.equal(await page.evaluate(() => window.__xss), undefined, '공지 escape');
  await page.click('.ph-notice .ph-ncard');
  await page.waitForSelector('.ph-ndoc-text');
  assert.ok((await page.innerHTML('.ph-ndoc-text')).includes('<br>'), '줄바꿈');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  await page.click('[data-action="ph-notice-all"]');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$ph_bulletins).items.every((r) => r.read === true));
  await page.click('[data-action="ph-notice-filter"][data-value="all"]');
  await page.click('[data-action="ph-notice-faction"][data-value="B00"]'); // 다시 누르면 세력 칩 해제
  assert.equal(await page.locator('.ph-notice').count(), 30);
  await page.click('[data-action="ph-settings"]');
  await page.click('[data-action="ph-cfg"][data-value="announcement_page_size=50"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_announcement_page_size === '50');
  await page.click('[data-action="ph-settings"]');
  await page.click('[data-action="ph-sub"][data-value="notices"]');
  assert.equal(await page.locator('.ph-notice').count(), 45, '페이지 50이면 한 쪽');
  const nid = await page.getAttribute('.ph-notice .ph-ndel', 'data-value');
  await page.click(`.ph-notice .ph-ndel[data-value="${nid}"]`);
  await page.click(`.ph-notice [data-action="ph-notice-del"][data-value="${nid}"]`);
  await page.waitForFunction((n) => JSON.parse(window.__chat.scriptstate.$ph_bulletins).items.length === n, 44);
  // 공지 보관 상한: 10 → 저장 때 10개만
  await page.click('[data-action="ph-settings"]');
  // (공지 자동 정리는 처음에 꺼 둠: 기본 상한 20이면 「모두 읽음」 저장 때 이미 20개로 줄어든다)
  await page.click('[data-action="ph-cfg"][data-value="storage_auto_notice=1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_storage_auto_notice === '1');
  await page.fill('[data-change="ph-num"][data-key="storage_limit_notice"]', '10');
  await page.dispatchEvent('[data-change="ph-num"][data-key="storage_limit_notice"]', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$ph_storage_limit_notice === '10');
  await page.click('[data-action="ph-settings"]');
  await page.click('[data-action="ph-sub"][data-value="notices"]');
  await page.click('.ph-notice .ph-ndel');
  await page.click('.ph-notice .gx-mini.danger');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$ph_bulletins).items.length === 10, null, { timeout: 4000 });
  // 연락처 추가: 명부 이름이면 그 인물, 아니면 기타; 빈 이름·줄바꿈 막기; 같은 이름 둘이면 안내; 삭제하면 1:1 방도
  await page.click('[data-action="ph-sub"][data-value="contacts"]');
  await page.click('[data-action="ph-add"]');
  await page.click('[data-action="ph-add-save"]');
  assert.ok((await page.textContent('.ph')).includes('60자 이내'));
  await page.fill('[data-input="ph-add-name"]', `동네 형${evil}`);
  await page.click('[data-action="ph-add-save"]');
  assert.ok((await page.textContent('.ph')).includes('괄호 없이'), '꺾쇠는 막는다');
  await page.fill('[data-input="ph-add-name"]', '동네 형');
  await page.fill('[data-input="ph-add-note"]', '편의점 알바');
  await page.click('[data-action="ph-add-save"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$ph_contacts ?? '').includes('동네 형'));
  assert.equal(await page.getAttribute('.ph-tabs .ph-tab.on', 'data-value'), 'T05', '기타 탭으로');
  const cid = await page.getAttribute('.ph-contacts [data-action="ph-contact-del"]', 'data-value');
  await page.click(`[data-action="ph-dm"][data-value="${cid}"]`);
  await page.waitForSelector('.ph-room');
  await page.fill('[data-input="ph-draft"]', '형 뭐해');
  await llm(page, [ok(JSON.stringify({ contacts: [], result: { patch: [{ op: 'add', path: '/messages/-', value: msg(cid, '알바 중') }] } }))]);
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=알바 중', { timeout: 6000 });
  const cm = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.ok(JSON.parse(cm.messages[1].content).singlePassContact === true, '직접 추가한 연락처는 한 번에 판단 모드');
  await page.click('[data-action="ph-back"]');
  await page.click('[data-action="ph-add"]');
  await page.fill('[data-input="ph-add-name"]', '쟈알디');
  await page.click('[data-action="ph-add-save"]');
  assert.ok((await page.textContent('.ph')).includes('이미 등록된'), '명부 인물이 이미 보이면 안내');
  // (안내와 함께 연락처 목록으로 돌아온다)
  await page.click('[data-action="ph-sub"][data-value="contacts"]');
  await page.click('.ph-tabs [data-value="T05"]').catch(() => {});
  await page.click(`[data-action="ph-contact-del"][data-value="${cid}"]`);
  await page.click(`[data-action="ph-contact-del"][data-value="${cid}"]`);
  await page.waitForFunction((c) => !(window.__chat.scriptstate.$ph_contacts ?? '').includes(c) && !JSON.parse(window.__chat.scriptstate.$ph_state).rooms[`dm_${c}`], cid);
  // 전화: 줄바꿈·꺾쇠 상대 막기
  await page.click('[data-action="ph-call"][data-value=""]');
  await page.fill('[data-input="ph-call-to"]', '쟈알디<x>');
  await page.click('[data-action="ph-call-place"]');
  assert.ok((await page.textContent('.ph')).includes('상대 이름을 확인'));
  assert.deepEqual(errors, []);
  console.log('PASS 괴담톡: XSS·2,000줄 더 보기·보관 상한·읽음·배지·공지 페이지/필터/세력/모두 읽음/삭제/상한·연락처 추가·삭제·전화 검사');
  await page.close();
}

// P3) 답장 응답 깨짐 → 다시 시도/건너뛰기, 단톡 인원 상한(9), 초대로 1:1 → 단톡 승격, 퇴장·대기 줄, 선물은 1:1만, 첨부 상한 3, 입력 상한
if (want('P3')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await nav(page, 'phone');
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.waitForSelector('.ph-room');
  // 보내기 → 깨진 응답(참여하지 않은 인물 말풍선만) → 실패 → 건너뛰기 → 다시 보내기 가능
  await page.fill('[data-input="ph-draft"]', '팀장님');
  await llm(page, [ok(patchOf([msg('c_99', '나 아님')])), ok(patchOf([msg('c_99', '또 아님')]))]);
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('[data-action="ph-skip"]', { timeout: 8000 });
  assert.ok((await page.textContent('.ph')).includes('참여하지 않은 인물'));
  assert.ok(await page.isDisabled('[data-action="ph-send"]'), '대기 중엔 보내기 잠김');
  await page.click('[data-action="ph-skip"]');
  await page.waitForFunction(() => !JSON.parse(window.__chat.scriptstate.$ph_state).rooms.dm_c_50303031.pending);
  assert.ok(await page.isEnabled('[data-action="ph-send"]'), '건너뛴 뒤 풀림');
  // 선물 첨부: 1:1 은 가능
  await page.click('[data-action="ph-att-menu"]');
  await page.click('[data-action="ph-att-add"][data-value="gift"]');
  await page.click('[data-action="ph-att-add"][data-value="photo"]');
  await page.click('[data-action="ph-att-add"][data-value="link"]');
  await page.click('[data-action="ph-att-add"][data-value="file"]').catch(() => {});
  assert.equal(await page.locator('.at-item').count(), 3, '첨부는 3개까지');
  await page.click('[data-action="ph-send"]');
  assert.ok((await page.textContent('.ph')).includes('첨부 내용을 입력'), '빈 첨부 막기');
  await page.fill('[data-input="ph-att"][data-key="0"]', '커피');
  await page.fill('[data-input="ph-att"][data-key="1"]', '현장 사진');
  await page.fill('[data-input="ph-att"][data-key="2"]', 'https://example.com/a');
  await llm(page, [ok(patchOf([msg('c_50303031', '고마워'), { content: '…', sender: '-', type: 'pause' }, { content: '잠시 후', sender: '-', type: 'pause' }]))]);
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=고마워', { timeout: 8000 });
  const r1 = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state)).rooms.dm_c_50303031;
  assert.deepEqual(r1.messages.filter((m) => m.sender === 'me').map((m) => m.text.slice(0, 16)), ['팀장님', '[[ATTACH:gift]]커', '[[ATTACH:photo]]', '[[ATTACH:link]]h'], '건너뛴 답장의 내 말은 남고, 첨부는 따로 한 말풍선');
  assert.equal(r1.messages.filter((m) => m.kind === 'pause').length, 1, '문장부호만인 대기는 안 남김, 짧은 시간 표시는 남김');
  assert.equal(await page.locator('.at-card-gift').count(), 1);
  assert.ok(await page.locator('.at-card-link a[href="https://example.com/a"]').count(), '주소만이면 링크');
  // 입력 상한 4000토큰
  await page.fill('[data-input="ph-draft"]', '가'.repeat(4100));
  await page.click('[data-action="ph-send"]');
  assert.ok((await page.textContent('.ph')).includes('4000토큰'));
  // 초대로 1:1 → 단톡 승격, 참여자 9명 상한
  await page.click('[data-action="ph-invite"]');
  await page.waitForSelector('.ph-pick');
  const picks = await page.$$eval('.ph-pick [data-action="ph-pick"]', (b) => b.map((x) => x.dataset.value));
  for (const c of picks.slice(0, 9)) await page.click(`[data-action="ph-pick"][data-value="${c}"]`);
  assert.ok((await page.textContent('.ph')).includes('최대 9명'), '상대 9명 상한 (기존 1 + 8)');
  assert.equal(await page.locator('.ph-pick .ph-main.on').count(), 8);
  await llm(page, [ok(patchOf([msg(picks[0], '안녕하세요'), { content: picks[1], sender: '-', type: 'exit' }]))]);
  await page.click('[data-action="ph-group-create"]');
  await page.waitForFunction(() => Object.values(JSON.parse(window.__chat.scriptstate.$ph_state).rooms).some((r) => r.kind === 'group' && r.members.length === 8), null, { timeout: 8000 });
  const s2 = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  assert.equal(s2.rooms.dm_c_50303031, undefined, '1:1 방은 단톡으로 바뀜');
  const g = Object.values(s2.rooms).find((r) => r.kind === 'group');
  assert.equal(g.messages.filter((m) => m.kind === 'invite').length, 8);
  assert.equal(g.messages.filter((m) => m.kind === 'exit').length, 1, '퇴장');
  assert.ok(!g.members.includes(picks[1]));
  assert.ok((await page.textContent('.ph-room-title b')).includes(','), '이름 없는 단톡은 참여자 이름');
  // 단톡에서 선물은 막힘 (메뉴에 이유)
  await page.click('[data-action="ph-att-menu"]');
  assert.ok(await page.isDisabled('[data-action="ph-att-add"][data-value="gift"]'), '단톡 선물 막힘');
  // 모델이 단톡에 선물 말풍선을 보내면 버린다
  await page.fill('[data-input="ph-draft"]', '다들 고마워');
  await llm(page, [ok(patchOf([msg(picks[0], '[[ATTACH:gift]]반지[[/ATTACH]]'), msg(picks[2], '네')]))]);
  await page.click('[data-action="ph-att-menu"]');
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=네', { timeout: 8000 });
  // 1:1 때 내가 보낸 선물은 승격된 단톡 기록에 그대로 남는다. 모델이 단톡에 보낸 선물만 버려졌는지 본다
  const g2 = Object.values(JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state)).rooms).find((r) => r.kind === 'group');
  assert.ok(!g2.messages.some((m) => m.sender !== 'me' && m.text.includes('[[ATTACH:gift]]')), '모델 선물 말풍선 버림');
  assert.ok(g2.messages.some((m) => m.sender === picks[2] && m.text === '네'));
  assert.equal(await page.locator('.ph-msg.npc .at-card-gift').count(), 0);
  // 방 삭제 (두 번), 대기 중엔 못 지움
  await page.click('[data-action="ph-room-del"]');
  await page.click('.ph-room-head .gx-mini.danger');
  await page.waitForFunction(() => !Object.values(JSON.parse(window.__chat.scriptstate.$ph_state).rooms).some((r) => r.kind === 'group'));
  assert.equal(await page.locator('.ph-room').count(), 0, '지우면 목록으로');
  assert.deepEqual(errors, []);
  console.log('PASS 괴담톡: 답장 깨짐 건너뛰기·첨부 상한·선물 1:1만·대기 줄·입력 상한·초대 승격·인원 상한·퇴장·방 삭제');
  await page.close();
}

// P4) 자동 확인이 다른 채팅 것일 때: 창이 보고 있는 채팅(0)의 화면·읽음·알림은 건드리지 않고, 그 채팅(1)에는 안 읽음으로 저장 (괴담넷과 같은 규칙)
if (want('P4')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const st = { version: 2, seq: 1, mid: 0, rooms: {}, order: [] };
  const room = { id: `dm_${JY}`, kind: 'dm', members: [JY], people: { [JY]: { id: JY, name: '쟈알디', english: 'Jyaldi' } }, messages: [], draft: '', unread: 0, readThrough: 0 };
  for (let i = 1; i <= 3; i++) room.messages.push({ id: ++st.mid, sender: JY, text: `말 ${i}`, time: '2025.01.01 01:00', kind: 'message', audience: [JY] });
  st.rooms[room.id] = room;
  st.order.push(room.id);
  await page.evaluate((st) => { window.__chat.scriptstate.$ph_state = JSON.stringify(st); }, st);
  await open(page);
  await nav(page, 'phone');
  await page.click('[data-action="ph-sub"][data-value="chats"]');
  await page.click(`.ph-chats [data-action="ph-room"][data-value="dm_${JY}"]`);
  await page.waitForSelector('.ph-room');
  // 채팅 1: 같은 카드의 다른 채팅. 매 턴 자동 확인 켬
  await page.evaluate(() => {
    const c = JSON.parse(JSON.stringify(window.__chat));
    c.scriptstate.$ph_auto = '1';
    c.scriptstate.$cooldown_received_incoming = '-5';
    c.message.push({ role: 'user', data: '계속' }, { role: 'char', data: '다른 채팅의 장면.' });
    window.__chat1 = c;
  });
  const before = await page.evaluate(() => window.__chat.scriptstate.$ph_state);
  const html0 = await page.innerHTML('.ph');
  await llm(page, [ok(JSON.stringify({ updates: [{ room: `dm_${JY}`, patch: [{ op: 'add', path: '/messages/-', value: msg(JY, '다른 채팅 새 말') }] }], announcements: [], invitations: [] }))]);
  await page.evaluate(async () => {
    const c = window.__chat1;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 1, messageIndex: c.message.length - 1 });
  });
  await page.waitForFunction(() => (window.__chat1.scriptstate.$ph_state ?? '').includes('다른 채팅 새 말'), null, { timeout: 8000 });
  await wait(400);
  const r1 = JSON.parse(await page.evaluate(() => window.__chat1.scriptstate.$ph_state)).rooms[`dm_${JY}`];
  assert.ok(r1.unread > 0, `창이 다른 채팅을 보고 있으니 안 읽음으로 저장: ${r1.unread}`);
  assert.equal(await page.evaluate(() => window.__chat.scriptstate.$ph_state), before, '창의 채팅(0)은 그대로');
  assert.ok(!(await page.textContent('.ph')).includes('다른 채팅 새 말'), '창 화면에 다른 채팅 말이 섞이지 않음');
  assert.ok(!(await page.textContent('.ph')).includes('자동으로 확인'), '창에 진행 표시도 안 뜸');
  assert.equal(await page.innerHTML('.ph'), html0, '창은 다시 그려지지 않음');
  assert.deepEqual(errors, []);
  console.log('PASS 괴담톡: 다른 채팅 자동 확인은 창의 화면·읽음·알림을 건드리지 않음');
  await page.close();
}

// ═══════════ 위키 ═══════════

const article = (title, body, extra = '') => `<lightboard-namuwiki doc_title="${title}" main_color="#27685b" related1="소라 랜드" recent1="없는 문서"${extra}>
[Infobox]Title:${title}|분류:괴이|등급:B
[Toc]
[Heading]Title:개요|Level:1
[Paragraph]${body}
[Heading]Title:탈출법|Level:1
[Paragraph]출구는 ➡️없는 문서➡️ 뒤에 있다. 📌각주 하나📌
</lightboard-namuwiki>`;
const packFixture = () => {
  const docs = { '소라 랜드': article('소라 랜드', '기본 문서 본문. 관람차가 혼자 돈다.'), '기본만': article('기본만', '기본 문서만 있는 글.') };
  const packed = 'GOEIWIKI1:' + gzipSync(Buffer.from(JSON.stringify(docs))).toString('base64');
  return { ...fixture, globalLore: [...fixture.globalLore, { key: '', comment: '📖위키 묶음', content: packed, mode: 'normal', insertorder: 0, alwaysActive: false, selective: false }] };
};

// 위키 목록(책갈피)이 닫혀 있으면 연다 (누를 때마다 열고 닫힌다)
const listOpen = async (page) => { if ((await page.getAttribute('.nw-grab', 'aria-expanded')) !== 'true') await page.click('.nw-grab'); };

// W1) 팩 없음: 목록 비어 있음 → 검색 → 작성 화면 → 설정(모드·길이·모델·공용 지침·이 문서 지침)이 요청문에 → 저장 → 링크 → 뒤로 → 다시 쓰기(이전 문서 참고 ON/OFF) → 채팅 반영 → XSS
if (want('W1')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await nav(page, 'wiki');
  await page.waitForSelector('.nw-home');
  assert.ok((await page.textContent('.nw-home')).includes('아직 이번 이야기에서 쓴 문서가 없어요'));
  await page.click('.nw-grab');
  assert.ok((await page.textContent('.nw-list')).includes('아직 작성한 문서가 없어요'), '팩 없음 → 목록 비어 있음');
  // 검색: 명부 항목이면 작성 화면
  await page.fill('.nw .ph-search', '소라 랜드');
  await page.press('.nw .ph-search', 'Enter');
  await page.waitForSelector('.nw-compose');
  assert.ok((await page.textContent('.nw-compose')).includes('같은 이름의 로어북이 있어요'));
  // 설정: 원본 충실·짧게·보조·이전 문서 참고 OFF·채팅 반영 ON·공용 지침
  await page.click('[data-action="wiki-settings"]');
  await page.click('[data-action="wiki-mode"][data-value="faithful"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_mode === 'faithful');
  await page.click('[data-action="wiki-length"][data-value="short"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_length === 'short');
  await page.click('[data-action="wiki-model"][data-value="aux"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_model === 'aux');
  await page.click('[data-action="wiki-context"][data-value="1"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_context === '1');
  await page.fill('[data-change="wiki-request"]', '존댓말로 쓸 것');
  await page.dispatchEvent('[data-change="wiki-request"]', 'change');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_writing_request === '존댓말로 쓸 것');
  await page.click('[data-action="wiki-settings"]');
  await page.click('.nw-grab');
  await page.fill('.nw .ph-search', '소라 랜드');
  await page.press('.nw .ph-search', 'Enter');
  await page.waitForSelector('.nw-compose');
  await page.fill('[data-input="wiki-docreq"]', '출구를 자세히');
  // 실패: 닫는 태그 없음 → 안내 + 원문, 재시도 1회
  await llm(page, [ok('<lightboard-namuwiki doc_title="소라 랜드">[Paragraph]끊김'), ok('그냥 글')]);
  await page.click('[data-action="wiki-start"]');
  await page.waitForSelector('.nw-busy');
  await page.waitForFunction(() => !document.querySelector('.nw-busy'), null, { timeout: 8000 });
  assert.ok((await page.textContent('.nw-status')).includes('만들지 못했어요'));
  assert.ok((await page.textContent('.nw-fail')).includes('그냥 글'));
  const call = await page.evaluate(() => window.__calls.llm[0]);
  assert.equal(call.mode, 'submodel');
  assert.ok(call.messages[0].content.includes('SELECTED LENGTH: SHORT'), '길이 짧게');
  assert.ok(!call.messages[0].content.includes('SELECTED LENGTH: DETAILED'));
  assert.ok(call.messages[1].content.includes('[사용자 작성 지침 — 모든 문서 공통]\n존댓말로 쓸 것'));
  assert.ok(call.messages[1].content.includes('[사용자 작성 지침 — 이 문서만, 공통 지침과 부딪치면 이쪽을 우선]\n출구를 자세히'));
  assert.ok(call.messages[1].content.includes('[최근 챗로그]'));
  assert.ok(!call.messages[1].content.includes('[이전 위키'), '처음 쓸 땐 이전 문서 없음');
  // 성공: 확장 모드로 바꾸고 생성 → 저장 → 문서 화면 (XSS 포함)
  await page.click('[data-action="wiki-settings"]');
  await page.click('[data-action="wiki-mode"][data-value="expand"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_mode === 'expand');
  await page.click('[data-action="wiki-length"][data-value="detailed"]');
  await page.waitForFunction(() => window.__chat.scriptstate.$nw_length === 'detailed');
  await page.click('[data-action="wiki-settings"]');
  await page.click('.nw-grab');
  await page.fill('.nw .ph-search', '소라 랜드');
  await page.press('.nw .ph-search', 'Enter');
  await page.waitForSelector('.nw-compose');
  const evil = '<img src=x onerror="window.__xss=1">';
  await llm(page, [ok(article('소라 랜드', `관람차 ${evil} {{user}} 가 본다. ❗강조❗ ➡️${evil}➡️`, ' main_color="url(javascript:1)"'))]);
  await page.click('[data-action="wiki-start"]');
  await page.waitForSelector('.nw-dochead', { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__xss), undefined, '문서 본문 escape');
  assert.ok((await page.textContent('.nw-body')).includes('<img src=x'));
  assert.ok(!(await page.innerHTML('.nw-body')).includes('javascript:'), 'main_color 검사');
  // 저장본은 {{ }} 를 무력화(&#123;)해 본편 요청에서 Risu 문법으로 안 풀리게, 창에는 글자 그대로 보인다
  assert.ok(JSON.stringify(await page.evaluate(() => window.__chat.localLore)).includes('&#123;&#123;user'), '저장본(채팅 로어북) 템플릿 기호 무력화');
  assert.ok((await page.textContent('.nw-body')).includes('{{user}}'), '창에는 글자 그대로');
  const sys2 = await page.evaluate(() => window.__calls.llm.at(-1).messages[0].content);
  assert.ok(sys2.includes('SELECTED LENGTH: DETAILED'));
  // 채팅 반영: 쓴 문서가 본편 요청에 wiki_reference 로
  // 로어북 있는 주제(소라 랜드) 문서는 기본(로어북 있는 문서 칩 끔)이면 안 들어간다 (v0.16.27 사용자 결정). 칩을 켜면 들어간다
  const hasWiki = (req) => req.some((m) => m.role === 'system' && m.content.includes('"feature":"wiki"') && m.content.includes('"title":"소라 랜드"'));
  const ask = () => page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '소라 랜드에 갔다' }], 'model'));
  assert.ok(!hasWiki(await ask()), '로어북 있는 문서는 기본 제외');
  await page.evaluate(() => { window.__chat.scriptstate.$nw_adv_ctx_lore = '1'; window.__chat.scriptstate.$nw_adv_ctx_focus = '0'; });
  assert.ok(hasWiki(await ask()), '채팅 반영 (로어북 있는 문서 칩 켬)');
  await page.evaluate(() => { delete window.__chat.scriptstate.$nw_adv_ctx_lore; delete window.__chat.scriptstate.$nw_adv_ctx_focus; });
  // 링크: 없는 문서 → 작성 화면(부모 원본 자료 물려받음), 뒤로 → 문서
  // 「탈출법」 문단은 클리어 전 괴이 문서라 스포일러로 접혀 있다: 펼친 뒤 링크
  assert.ok(await page.locator('.nw-body details.nw-spoil:not([open]) .nw-link[data-value="없는 문서"]').count(), '정답 문단 접기');
  await page.click('.nw-body details.nw-spoil:has(.nw-link[data-value="없는 문서"]) > summary');
  await page.click('.nw-body .nw-link[data-value="없는 문서"]');
  await page.waitForSelector('.nw-compose');
  assert.ok((await page.textContent('.nw-compose')).includes('이어받아 작성해요') || (await page.textContent('.nw-compose')).includes('로어북이 없어요'));
  await page.click('[data-action="wiki-back"]');
  await page.waitForSelector('.nw-dochead');
  assert.equal((await page.textContent('.nw-title')).trim(), '소라 랜드');
  // 다시 쓰기: 이전 문서 참고 ON → [이전 위키], OFF → 없음
  await page.click('.nw-pane .ph-room-head [data-action="wiki-rewrite"]');
  await page.waitForSelector('.nw-rewrite');
  await llm(page, [ok(article('소라 랜드', '다시 쓴 본문'))]);
  await page.click('[data-action="wiki-rw-go"]');
  await page.waitForFunction(() => document.querySelector('.nw-body')?.textContent.includes('다시 쓴 본문'), null, { timeout: 8000 });
  assert.ok((await page.evaluate(() => window.__calls.llm.at(-1).messages[1].content)).includes('[이전 위키'), '이전 문서 참고 ON');
  await page.click('.nw-pane .ph-room-head [data-action="wiki-rewrite"]');
  await page.click('[data-action="wiki-rw-prev"][data-value="0"]');
  await llm(page, [ok(article('소라 랜드', '세 번째 본문'))]);
  await page.click('[data-action="wiki-rw-go"]');
  await page.waitForFunction(() => document.querySelector('.nw-body')?.textContent.includes('세 번째 본문'), null, { timeout: 8000 });
  assert.ok(!(await page.evaluate(() => window.__calls.llm.at(-1).messages[1].content)).includes('[이전 위키'), '이전 문서 참고 OFF');
  // 생성 중 다른 문서 작성 요청 → 안내만
  await page.evaluate(() => {
    const orig = window.risuai.runLLMModel;
    window.risuai.runLLMModel = async (o) => { window.__calls.llm.push(o); await new Promise((r) => setTimeout(r, 900)); window.risuai.runLLMModel = orig; return { type: 'success', result: '<lightboard-namuwiki doc_title="느림">[Paragraph]느린 문서</lightboard-namuwiki>' }; };
  });
  await listOpen(page);
  await page.fill('.nw .ph-search', '느림');
  await page.press('.nw .ph-search', 'Enter');
  await page.waitForSelector('.nw-nohit');
  await page.click('.nw-nohit [data-action="wiki-write"]');
  await page.waitForSelector('.nw-compose');
  const n1 = await llmCount(page);
  await page.click('[data-action="wiki-start"]');
  await page.waitForSelector('.nw-busy');
  await listOpen(page);
  await page.fill('.nw .ph-search', '둘째');
  await page.press('.nw .ph-search', 'Enter');
  await page.click('.nw-nohit [data-action="wiki-write"]');
  await page.waitForSelector('.nw-compose');
  assert.ok(await page.isDisabled('[data-action="wiki-start"]'), '생성 중엔 작성 시작이 잠긴다');
  await page.waitForFunction(() => !document.querySelector('.nw-busy'), null, { timeout: 8000 });
  assert.equal(await llmCount(page), n1 + 1);
  assert.ok((await page.evaluate(() => JSON.stringify(window.__chat.localLore))).includes('WIKI｜느림'), '창에서 다른 문서를 보고 있어도 저장');
  assert.deepEqual(errors, []);
  console.log('PASS 위키: 팩 없음·검색·작성 설정(모드·길이·모델·지침)·실패 유지·XSS·채팅 반영·링크·뒤로·다시 쓰기 이전 문서 ON/OFF·생성 중 잠금');
  await page.close();
}

// W2) 팩 있음(카드 묶음): 기본 문서는 생성 없이 열림, 목록·분류·탭, 덮어쓰면 채팅 문서가 이기고 지우면 기본으로 되돌아감, 삭제 두 번, 상태창 위키 이름(setWikiOpener)
if (want('W2')) {
  const { page, errors } = await boot(packFixture(), { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await nav(page, 'wiki');
  await page.waitForSelector('.nw-home');
  assert.ok((await page.textContent('.nw-hero-t')).includes('문서 2개'));
  await page.click('.nw-grab');
  await page.waitForSelector('.nw-tabs');
  assert.equal(await page.locator('.nw-list .ph-row').count(), 2, '기본 문서 2개가 목록에');
  await page.click('.nw-list [data-action="wiki-pick"][data-value="소라 랜드"]');
  await page.waitForSelector('.nw-dochead');
  assert.equal(await llmCount(page), 0, '기본 문서는 생성하지 않음');
  assert.ok((await page.textContent('.nw-body')).includes('기본 문서 본문'));
  assert.equal(await page.locator('.nw-spoil:not(.fn)').count(), 1, '괴이 문서의 정답 문단은 접힘');
  assert.equal(await page.locator('.nw-notes .nw-spoil.fn').count(), 1, '접은 문단 속 각주는 각주 목록에서도 가림');
  assert.equal(await page.locator('.nw-pane .ph-room-head [data-action="wiki-delete"]').count(), 0, '기본 문서는 지울 수 없음');
  // 덮어쓰기(다시 쓰기) → 채팅 문서가 이김 → 지우면 「되돌리기」 → 기본 문서로
  await page.click('.nw-pane .ph-room-head [data-action="wiki-rewrite"]');
  await llm(page, [ok(article('소라 랜드', '채팅에서 새로 쓴 본문'))]);
  await page.click('[data-action="wiki-rw-go"]');
  await page.waitForFunction(() => document.querySelector('.nw-body')?.textContent.includes('채팅에서 새로 쓴 본문'), null, { timeout: 8000 });
  assert.ok((await page.textContent('.nw-list')).includes('소라 랜드'));
  await page.click('.nw-pane .ph-room-head [data-action="wiki-delete"]');
  assert.equal((await page.textContent('.nw-pane .ph-room-head .gx-mini.danger')).trim(), '되돌리기');
  await page.click('.nw-pane .ph-room-head .gx-mini.danger');
  await page.waitForFunction(() => document.querySelector('.nw-body')?.textContent.includes('기본 문서 본문'), null, { timeout: 4000 });
  // 검색: 비슷한 제목 제안 (띄어쓰기 다름)
  await page.click('.nw-grab');
  await page.fill('.nw .ph-search', '소라랜드');
  await page.press('.nw .ph-search', 'Enter');
  await page.waitForSelector('.nw-dochead');
  assert.equal((await page.textContent('.nw-title')).trim(), '소라 랜드', '별칭·띄어쓰기 무시로 바로 열림');
  // 상태창의 위키 이름을 누르면 창이 그 문서로 (setWikiOpener)
  await page.click('[data-action="close"]').catch(() => {});
  const rendered = await page.evaluate(() => window.__calls.handlers.display('[▣|2025.01.01|03:00 AM|☀️|4°C|소라 랜드 정문|기본만]'));
  assert.ok(rendered.includes('data-goei-wiki'), '상태창 위키 이름 밑줄');
  assert.deepEqual(errors, []);
  console.log('PASS 위키: 카드 묶음 기본 문서·생성 없음·스포일러 접기·덮어쓰기/되돌리기·별칭 검색·상태창 위키 이름');
  await page.close();
}

// W3) 모바일: 책갈피로 목록 열기, 문서 고르면 접힘, 가로 넘침 없음. PC: 목록 위치 오른쪽(prefs.wikiSide)
if (want('W3')) {
  const { page, errors } = await boot(packFixture(), { message: [], scriptstate: {} }, { width: 390, height: 844 }, { touch: true });
  await startedWithReply(page);
  await open(page);
  await page.locator(':is([data-action="tab"], [data-action="nav-tab"])[data-value="wiki"]:visible').first().click();
  await page.waitForSelector('.nw-home');
  await page.tap('.nw-edge');
  await page.waitForSelector('.nw-app.list-open');
  await page.tap('.nw-list [data-action="wiki-pick"][data-value="기본만"]');
  await page.waitForSelector('.nw-dochead');
  assert.equal(await page.locator('.nw-app.list-open').count(), 0, '고르면 목록이 접힘');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.tap('.nw-body .nw-link').catch(() => {});
  assert.deepEqual(errors, []);
  console.log('PASS 위키: 모바일 책갈피·목록 접힘');
  await page.close();
}

// ═══════════ 상황판(관제실·요원·일지·지도·사진) ═══════════

// S1) 요원 표시 인원 0/12/20, 모니터↔목록, 사원증 창(톡·위키·기록), 일지 줄 고르기·CCTV↔위성·상세 창·목표 지정·종료 두 번, 지원 투입 끔
if (want('S1')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  const { preset } = await startedWithReply(page);
  await open(page);
  await page.waitForSelector('.gx-board');
  assert.equal(await page.locator('.gx-agwall .gx-agmon').count(), 12, '기본 12명');
  assert.equal(await page.locator('.gx-agmon.op').count(), 1, '작전투입 1명');
  // 목록 모양 (기기 공통 설정)
  await page.click('[data-action="agents-view"][data-value="list"]');
  await page.waitForSelector('.gx-agrows');
  assert.equal(await page.locator('.gx-agrow').count(), 12);
  assert.equal(JSON.parse(await page.evaluate(() => window.__store['p:goei:prefs'] ?? '{}')).agents, 'list');
  assert.ok((await page.textContent('.gx-agbox h2')).includes('작전1/12'), '작전 수/인원');
  // 사원증 창: 톡·위키, 기록은 인물 기록이 있을 때만
  await page.click('.gx-agrow[data-value="P001"]');
  await page.waitForSelector('.gx-agcard');
  assert.ok((await page.textContent('.gx-agcard')).includes('NO. P-001'));
  assert.equal(await page.locator('.gx-agcard [data-action="people-goto"]').count(), 0, '기록이 없으면 「기록」 없음');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.gx-agcard', { state: 'detached' }).catch(() => {});
  if (await page.locator('.gx-agcard').count()) await page.click('.ev-scrim');
  // 20명·0명
  await page.evaluate(() => { window.__chat.scriptstate.$st_agent_limit = '20'; });
  await reopen(page);
  await page.waitForSelector('.gx-agrows');
  const n20 = await page.locator('.gx-agrow').count();
  // 경량 카드의 A00 등록 요원이 12명 이하일 수 있어 「12 이상 20 이하」만 본다. 줄이는 쪽(5명)은 정확히 센다
  assert.ok(n20 >= 12 && n20 <= 20, `20명 설정: ${n20}`);
  await page.evaluate(() => { window.__chat.scriptstate.$st_agent_limit = '5'; });
  await reopen(page);
  await page.waitForSelector('.gx-agrows');
  assert.equal(await page.locator('.gx-agrow').count(), 5, '5명 설정');
  await page.evaluate(() => { window.__chat.scriptstate.$st_agent_limit = '0'; });
  await reopen(page);
  await page.waitForSelector('.gx-agbox');
  assert.ok((await page.textContent('.gx-agbox')).includes('0명으로 해 두었어요'));
  await page.evaluate(() => { window.__chat.scriptstate.$st_agent_limit = '12'; });
  await reopen(page);
  await page.click('[data-action="agents-view"][data-value="wall"]');
  // 일지: 첫 줄은 우리 편이 들어간 것. CCTV ↔ 위성 지도, 상세 줄 고르기
  await page.waitForSelector('.gx-oprow');
  assert.ok((await page.getAttribute('.gx-oprow.sel', 'data-value')).startsWith('an'), '우리 요원이 들어간 괴이가 먼저');
  assert.ok((await page.textContent('.gx-opview.feed .gx-opcap')).includes(preset.name));
  await page.click('[data-action="ops-mode"][data-value="map"]');
  await page.waitForSelector('.gx-opview.map');
  assert.ok(await page.locator('.gx-oppin').count() >= 1, '위성 지도 핀');
  await page.click('[data-action="ops-mode"][data-value="feed"]');
  // 목표 지정 → 임무 탭 목표로, 다시 누르면 해제
  await page.click('.gx-opview.feed [data-action="pick-event"]');
  await page.waitForSelector('.gx-map');
  assert.ok((await page.textContent('.gx-goal b')).includes(preset.name), '목표');
  await nav(page, 'board');
  assert.equal(await page.getAttribute('.gx-opview.feed [data-action="pick-event"]', 'aria-pressed'), 'true');
  await page.click('.gx-opview.feed [data-action="pick-event"]');
  await page.waitForFunction(() => document.querySelector('.gx-opview.feed [data-action="pick-event"]')?.getAttribute('aria-pressed') === 'false');
  // 지원 투입 끔 → 임무 탭 편성에 지원 인원 카드 없음
  await page.evaluate(() => { window.__chat.scriptstate.$st_support_on = '0'; });
  await reopen(page);
  await nav(page, 'map');
  await page.waitForSelector('.gx-team');
  assert.equal(await page.locator('.gx-scard').count(), 0, '지원 투입 끔');
  await page.evaluate(() => { window.__chat.scriptstate.$st_support_on = '1'; });
  await reopen(page);
  await nav(page, 'map');
  await page.waitForSelector('.gx-scard');
  // 종료: 두 번 눌러야, 끝난 상황은 일지에 흐리게 남고 CCTV 는 END
  await nav(page, 'board');
  const key = await page.getAttribute('.gx-oprow.sel', 'data-value');
  await page.click('.gx-opview.feed [data-action="end-event"]');
  assert.ok((await page.getAttribute('.gx-opview.feed [data-action="end-event"]', 'title')).includes('한 번 더'));
  await page.click('.gx-opview.feed [data-action="end-event"]');
  await page.waitForSelector('.gx-oprow.ended');
  assert.ok(!JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_world)).an.some((a) => a.name === preset.name && a.state === '활성'), '끝낸 괴이는 활성 목록에서 빠짐');
  assert.ok(await page.locator('.gx-oprow.ended').count() >= 1, '끝난 상황은 일지에 남음');
  assert.notEqual(await page.getAttribute('.gx-oprow.sel', 'data-value'), key, '끝나면 다른 상황이 선택');
  assert.deepEqual(errors, []);
  console.log('PASS 상황판: 요원 인원 0/12/20·모니터↔목록·사원증·일지 선택·CCTV↔위성·목표 지정/해제·지원 투입 끔·종료 두 번');
  await page.close();
}

// S2) 사진 첨부: 사진 아닌 파일·20MB 넘는 파일·못 여는 파일은 안내, 정상 PNG 는 미리보기 → 보내면 경로만 저장. 첨부 상한
if (want('S2')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await nav(page, 'phone');
  await page.click('[data-action="ph-dm"][data-value="c_50303031"]');
  await page.waitForSelector('.ph-room');
  await page.click('[data-action="ph-att-menu"]');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pick-photo="ph"]')]);
  await chooser.setFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.waitForFunction(() => document.querySelector('.gx-toast')?.textContent.includes('사진 파일만'), null, { timeout: 4000 });
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pick-photo="ph"]')]);
  await chooser2.setFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(21 * 1024 * 1024) });
  await page.waitForFunction(() => document.querySelector('.gx-toast')?.textContent.includes('너무 커요'), null, { timeout: 6000 });
  const [chooser3] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pick-photo="ph"]')]);
  await chooser3.setFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not a png') });
  await page.waitForFunction(() => document.querySelector('.gx-toast')?.textContent.includes('열지 못했어요'), null, { timeout: 6000 });
  // 정상 PNG (1×1)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const [chooser4] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-pick-photo="ph"]')]);
  await chooser4.setFiles({ name: 'ok.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.at-item-image');
  assert.equal(await page.locator('.at-thumb').count(), 1, '미리보기');
  await llm(page, [ok('<lb-minitalk-patch>[{"op":"add","path":"/messages/-","value":{"content":"잘 봤어","sender":"c_50303031","type":"text"}}]</lb-minitalk-patch>')]);
  await page.click('[data-action="ph-send"]');
  await page.waitForSelector('.ph-msg.npc >> text=잘 봤어', { timeout: 8000 });
  const st = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$ph_state));
  const mine = st.rooms.dm_c_50303031.messages.find((m) => m.sender === 'me');
  assert.match(mine.text, /^%%ATTACHMENT:[0-9a-f]+%%$/, '경로만 저장(데이터는 에셋 저장소)');
  assert.ok((await page.evaluate(() => Object.keys(window.__assets))).length === 1);
  const sent = await page.evaluate(() => window.__calls.llm.at(-1).messages.at(-1));
  assert.ok(Array.isArray(sent.multimodals) && sent.multimodals.length === 1, 'AI 요청에는 실제 사진');
  assert.deepEqual(errors, []);
  console.log('PASS 사진 첨부: 형식·크기·깨진 파일 안내, 정상 PNG 경로 저장·AI 전달');
  await page.close();
}

// ═══════════ 가계부 ═══════════

// WL1) 잔고 직접 수정 끔(기본): ✎·✕ 없음, 조작으로도 안 바뀜. 켜면 ✎·✕, 잘못된 금액 안내. 되감기: 기준 메시지가 사라진 거래는 빠짐. 모바일 머리 잔고·ID카드 칩
if (want('WL1')) {
  const wallet = { start: 140000, log: [
    { id: 'w1', anchor: 'c1', amount: -15000, memo: '택시비', src: 'story', quote: '택시비 15,000원', at: '2026-10-27T01:00:00Z' },
    { id: 'w2', anchor: 'c2', amount: 30000, memo: '상품권', src: 'story', quote: '3만 원', at: '2026-10-27T01:00:00Z' },
  ] };
  const chat = {
    message: [
      { role: 'user', data: 'hi', chatId: 'u1' },
      { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|출근|-|-|관리국/요원|₩ 125,000]', chatId: 'c1' },
      { role: 'user', data: '다음', chatId: 'u2' },
      { role: 'char', data: '본문\n[▣|2025.01.02|09:40 AM|☀️|4°C|종로|출근|-|-|관리국/요원|₩ 155,000]', chatId: 'c2' },
    ],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_wallet: JSON.stringify(wallet), $ph_auto: '0', $pp_on: '0' },
  };
  const { page, errors } = await boot(fixture, chat);
  await open(page);
  await page.click('.gx-nav-brand .gx-id-wallet');
  await page.waitForSelector('.gx-wallettab');
  assert.ok((await page.textContent('.gx-wt-tile.bal b')).includes('155,000'));
  assert.equal(await page.locator('.gx-wt-pen').count(), 0, '수정 끔: ✎ 없음');
  assert.equal(await page.locator('.gx-wt-del').count(), 0, '수정 끔: ✕ 없음');
  assert.equal(await page.locator('.gx-wt-row').count(), 2);
  // 되감기: c2 메시지를 지우면 그 거래가 빠진다
  await page.evaluate(() => { window.__chat.message = window.__chat.message.slice(0, 2); });
  await reopen(page);
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-wt-row').count(), 1, '기준 메시지가 사라진 거래는 빠짐');
  assert.ok((await page.textContent('.gx-wt-tile.bal b')).includes('125,000'));
  // 켬: ✎·✕, 잘못된 금액
  await page.evaluate(() => { window.__chat.scriptstate.$st_wallet_edit = '1'; });
  await reopen(page);
  await page.waitForSelector('.gx-wt-pen');
  await page.click('.gx-wt-pen');
  await page.fill('[name="wt-adj"]', '많이');
  await page.click('[data-action="wallet-adj"]');
  assert.ok((await page.textContent('.gx-wallettab')).includes('금액을 읽을 수 없어요'));
  await page.fill('[name="wt-adj"]', '13만');
  await page.press('[name="wt-adj"]', 'Enter');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$st_wallet).log.some((r) => r.src === 'manual'), null, { timeout: 4000 });
  const w2 = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$st_wallet));
  assert.equal(w2.log.find((r) => r.src === 'manual').amount, 5000, '잔고 12.5만 → 13만 = 조정 +5,000');
  await page.waitForFunction(() => document.querySelector('.gx-wt-tile.bal b')?.textContent.includes('130,000'));
  assert.deepEqual(errors, []);
  console.log('PASS 가계부: 수정 끔 ✎✕ 없음·되감기·수정 켬·금액 검사');
  await page.close();
}

// WL2) 모바일: 머리 잔고 단추 → 가계부, ID카드 잔고 칩 → 가계부, 잔고 칸을 끈 채팅은 가계부 없음
if (want('WL2')) {
  const chat = { message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|출근|-|-|관리국/요원|₩ 140,000]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $ph_auto: '0', $pp_on: '0' } };
  const { page, errors } = await boot(fixture, chat, { width: 390, height: 844 }, { touch: true });
  await open(page);
  await page.waitForSelector('.gx-hwallet');
  assert.ok((await page.textContent('.gx-hwallet')).includes('140,000'), '머리 잔고 = 시작 잔고 14만');
  await page.tap('.gx-hwallet');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-hwallet').count(), 0, '가계부 탭 안에서는 머리 단추 숨김');
  await page.tap('.gx-nav .gx-nb.home[data-value="board"]');
  await page.tap('.gx-idbtn');
  await page.waitForSelector('.gx-idpop .gx-wallet');
  await page.tap('.gx-idpop .gx-wallet');
  await page.waitForSelector('.gx-wallettab');
  assert.equal(await page.locator('.gx-idpop').count(), 0, 'ID카드 창은 닫힘');
  // 잔고 칸 끔
  await page.evaluate(() => { window.__chat.scriptstate.$st_col_wallet = 'off'; });
  await page.tap('.gx-nav .gx-nb.home[data-value="board"]');
  await reopen(page);
  await page.waitForSelector('.gx-head'); // (이 채팅은 상황판 없이 시작해 상황판 자리엔 「상황판 켜기」 안내)
  assert.equal(await page.locator('.gx-hwallet').count(), 0, '잔고 칸을 끄면 머리 잔고 없음');
  assert.equal(await page.locator('.gx-nb[data-value="wallet"]').count(), 0, '가계부 메뉴 없음');
  assert.deepEqual(errors, []);
  console.log('PASS 가계부: 모바일 머리 잔고·ID카드 칩');
  await page.close();
}

// ═══════════ 인물 기록 ═══════════

const upd = (o) => ok(JSON.stringify(o));
// 갱신 요청의 메시지 번호 m 은 읽는 구간 안 순번: 직전 쌍 1(기본) → m1·m2 는 맥락(첫 응답), m3·m4 가 확정 구간(새 유저·응답)

// PP1) 매 턴 갱신: 장면 인물이 있으면 보조 모델 1회(직렬: 괴담톡보다 먼저), 같은 응답은 다시 안 읽음. 응답 정상/부분/깨짐/빈 → 반영·버림·실패가 진단에. 병렬 설정. 끔.
if (want('PP1')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const n0 = await llmCount(page);
  // 응답에 쟈알디가 나오면 시트에서 시작값을 만들고 갱신 호출 1회
  await llm(page, [upd({ entries: [{ who: '쟈알디', slot: 'state', op: 'add', text: '현장에서 보고를 받는 중', m: 'm4', quote: '쟈알디 부장이 보고를 받았다' }, { who: '없는사람', slot: 'state', op: 'add', text: 'x', m: 'm4', quote: '쟈알디' }, { who: '쟈알디', slot: 'scene', op: 'add', text: '인용 없음', m: 'm4', quote: '이 글은 원문에 없다' }], cues: [{ who: '쟈알디', cue: '도움', m: 'm4', quote: '보고를 받았다', reason: '보고' }], address: [{ who: '쟈알디', toUser: '자네', register: '반말', m: 'm4', quote: '자네, 수고했네' }] })]);
  await fireOutput(page, '쟈알디 부장이 보고를 받았다. "자네, 수고했네."');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 1, n0, { timeout: 8000 });
  await page.waitForFunction(() => window.__chat.goeiPeopleV1?.people?.['쟈알디']?.slots?.state?.length > 0, null, { timeout: 8000 });
  const call = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.equal(call.mode, 'submodel');
  assert.ok(call.messages[0].content.includes('cues') || call.messages[0].content.length > 1000, '갱신 지침');
  const data = JSON.parse(call.messages[1].content);
  assert.deepEqual(data.people.map((p) => p.name), ['쟈알디']);
  assert.ok(data.span.some((s) => s.m === 'm4' && s.confirmed));
  let store = await page.evaluate(() => window.__chat.goeiPeopleV1);
  assert.equal(store.people['쟈알디'].seeded.from, 'lore', '시트에서 시작값');
  assert.equal(store.people['쟈알디'].slots.state.filter((e) => e.src === 'story').length, 1);
  assert.equal(store.people['쟈알디'].slots.scene, undefined, '인용이 원문에 없으면 버림');
  assert.equal(store.log.filter((c) => c.kind === 'cue').length, 1);
  assert.equal(store.log.filter((c) => c.kind === 'address')[0].toUser, '자네');
  // 같은 응답을 다시 알려도 안 읽음(읽음 표시)
  await page.evaluate(async () => {
    const c = window.__chat;
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  await wait(500);
  assert.equal(await llmCount(page), n0 + 1, '읽은 응답은 다시 읽지 않는다');
  // 깨진 응답 → 1회 재시도 → 실패 진단
  await llm(page, [ok('{"entries": ['), ok('아님')]);
  await fireOutput(page, '쟈알디가 웃었다.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 3, n0, { timeout: 8000 });
  await wait(600);
  let diag = JSON.parse(await page.evaluate(() => window.__store['p:goei-people-diag'] ?? '[]'));
  assert.ok(diag.at(-1).ok === false && diag.at(-1).stage === 'parse', `깨진 응답 진단: ${JSON.stringify(diag.at(-1).stage)}`);
  assert.ok(diag.at(-1).raw.includes('아님'), '원문 보관');
  // 빈 응답 → 모델 실패
  await llm(page, [ok('  ')]);
  await fireOutput(page, '쟈알디가 떠났다.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 4, n0, { timeout: 8000 });
  await wait(600);
  diag = JSON.parse(await page.evaluate(() => window.__store['p:goei-people-diag'] ?? '[]'));
  assert.equal(diag.at(-1).stage, 'model');
  // 직렬: 괴담톡 매 턴과 함께 — 인물 갱신이 먼저, 그다음 괴담톡
  await page.evaluate(() => { window.__chat.scriptstate.$ph_auto = '1'; window.__chat.scriptstate.$cooldown_received_incoming = '-5'; });
  await llm(page, [upd({ entries: [] }), ok('{"updates":[],"announcements":[],"invitations":[]}')]);
  await fireOutput(page, '쟈알디가 돌아왔다.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 6, n0, { timeout: 8000 });
  await wait(400);
  const [c1, c2] = await page.evaluate(() => window.__calls.llm.slice(-2));
  assert.ok(JSON.parse(c1.messages[1].content).people !== undefined, '인물 갱신 먼저');
  assert.ok(JSON.parse(c2.messages[1].content).rooms !== undefined, '괴담톡 다음');
  // 병렬: 둘 다 동시에 시작 (순서 보장 없음, 둘 다 호출됨)
  await page.evaluate(() => { window.__chat.scriptstate.$pp_parallel = '1'; });
  await llm(page, [upd({ entries: [] }), ok('{"updates":[],"announcements":[],"invitations":[]}')]);
  await fireOutput(page, '쟈알디가 앉았다.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 8, n0, { timeout: 8000 });
  // 끔: 호출 없음, 본편에도 안 들어감
  await page.evaluate(() => { window.__chat.scriptstate.$pp_on = '0'; window.__chat.scriptstate.$ph_auto = '0'; });
  await fireOutput(page, '쟈알디가 섰다.');
  await wait(600);
  assert.equal(await llmCount(page), n0 + 8, '끄면 호출 없음');
  const reqOff = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '쟈알디에게 간다' }], 'model'));
  assert.ok(!reqOff.some((m) => /\[People records\]/.test(m.content)), '끄면 본편 블록 없음');
  await page.evaluate(() => { window.__chat.scriptstate.$pp_on = '1'; });
  const reqOn = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '쟈알디에게 간다' }], 'model'));
  const blk = reqOn.find((m) => /\[People records\]/.test(m.content));
  assert.ok(blk && blk.content.includes('## 쟈알디') && /Address → [^:\n]+: '자네'/.test(blk.content) && blk.content.includes('현장에서 보고를 받는 중'), '본편 블록 (호칭 대상은 페르소나 이름으로 풀림)');
  assert.deepEqual(errors, []);
  console.log('PASS 인물 기록: 매 턴 1회·읽음·버림(명단 밖·인용 없음)·깨짐 재시도·빈 응답·직렬/병렬·끔·본편 블록');
  await page.close();
}

// PP2) 위키 화면 연동: 인물 목록 → 상세(호감·호칭·칸·근거·고정·취소·되살리기·변경 기록) → 세력 평판(값·구간·고정) → 문서. 메시지당 상한·경계 설정값. 되감기(메시지 수정 → 항목 빠짐)
if (want('PP2')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const n0 = await llmCount(page);
  await llm(page, [upd({
    entries: [{ who: '쟈알디', slot: 'state', op: 'add', text: '부상 (왼팔)', m: 'm4', quote: '왼팔을 다쳤다' }, { who: '쟈알디', slot: 'knowledge', op: 'add', text: '관람차 비밀을 안다', m: 'm4', quote: '관람차' }],
    cues: [{ who: '쟈알디', cue: '큰도움', m: 'm4', quote: '왼팔을 다쳤다', reason: '구해줌' }, { who: '쟈알디', cue: '헌신', m: 'm4', quote: '관람차', reason: '두 번째' }],
    faction_cues: [{ faction: '관리국', cue: '큰도움', m: 'm4', quote: '왼팔을 다쳤다', reason: '구조' }, { faction: '백일몽', cue: '파탄', m: 'm4', quote: '관람차', reason: '방해' }],
    docs: [{ type: 'event', key: '관람차 사건', op: 'add', text: '관람차에서 쟈알디가 다침', m: 'm4', quote: '왼팔을 다쳤다' }],
  })]);
  await fireOutput(page, '쟈알디가 나를 구하다 왼팔을 다쳤다. 관람차 비밀을 알게 됐다.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 1, n0, { timeout: 8000 });
  await page.waitForFunction(() => (window.__chat.goeiPeopleV1?.log ?? []).length >= 4, null, { timeout: 8000 });
  await open(page);
  // 2026-10-29: 인물 기록 화면은 위키가 아니라 왼쪽 메뉴 「기록」 › 인물 (위키 홈에 타일 없음)
  await nav(page, 'wiki');
  await page.waitForSelector('.nw-home');
  assert.equal(await page.locator('.nw-tile.k-pp').count(), 0, '위키 홈에 인물 타일 없음');
  await nav(page, 'records');
  await page.click('[data-action="rec-sub"][data-value="people"]');
  await page.waitForSelector('.pp-pane');
  assert.ok((await page.textContent('.pp-pane')).includes('쟈알디'));
  assert.ok((await page.textContent('.pp-pane .ph-room-title')).includes('1명'));
  // 세력 평판: 기록 탭 › 세력 (기본 5 + 기록). 메시지당 상한 10 → 큰도움 5 + 헌신 10 = 15 → 10 으로 잘림(호감), 세력도 ±10
  await page.click('[data-action="rec-sub"][data-value="factions"]');
  await page.waitForSelector('.pp-sec:has-text("세력 평판")');
  const facRow = await page.textContent('.pp-sec:has-text("세력 평판")');
  assert.ok(facRow.includes('관리국') && facRow.includes('백일몽'));
  await page.click('[data-action="rec-sub"][data-value="people"]');
  await page.click('[data-action="rec-person"][data-value="쟈알디"]');
  await page.waitForSelector('.pp-aff');
  await page.click('[data-action="pp-num-toggle"]');
  const affText = await page.textContent('.pp-aff-num');
  assert.ok(affText.includes('10 '), `메시지당 상한 10: ${affText}`);
  // 근거 펼치기·고정·취소·되살리기
  // 근거(원문 위치)는 이야기에서 나온 항목에만 있다 (시트 시작값에는 없음)
  const key = await page.getAttribute('.pp-slot [data-action="pp-jump"]', 'data-value');
  await page.click(`[data-action="pp-jump"][data-value="${key}"]`);
  await page.waitForSelector('.pp-evidence');
  assert.ok((await page.textContent('.pp-evidence')).includes('왼팔을 다쳤다'));
  await page.click(`[data-action="pp-pin"][data-value="${key}"]`);
  await page.waitForFunction((k) => { const [who, slot, id] = k.split('|'); return window.__chat.goeiPeopleV1.people[who].slots[slot].find((e) => e.id === id)?.pin === true; }, key);
  await page.click(`[data-action="pp-void"][data-value="${key}"]`);
  await page.waitForFunction((k) => { const [who, slot, id] = k.split('|'); return window.__chat.goeiPeopleV1.people[who].slots[slot].find((e) => e.id === id)?.void === true; }, key);
  assert.ok((await page.textContent('.pp-pane')).includes('취소됨'));
  // 취소한 항목은 「지난 항목」 접기 안으로 간다: 펼쳐서 되살리기
  await page.click(`details.pp-oldbox:has([data-action="pp-void"][data-value="${key}"]) > summary`);
  await page.click(`[data-action="pp-void"][data-value="${key}"]`);
  await page.waitForFunction((k) => { const [who, slot, id] = k.split('|'); return !window.__chat.goeiPeopleV1.people[who].slots[slot].find((e) => e.id === id)?.void; }, key);
  // 호감 직접 고정 (이유 필수) → 단계 표시, 변경 기록에 수동
  await page.click('[data-action="pp-aff-edit"]');
  await page.fill('[data-input="pp-aff-num"]', '150');
  await page.click('[data-action="pp-aff-save"]');
  assert.ok((await page.textContent('.pp-pane')).includes('이유를 적어'));
  await page.fill('[data-input="pp-aff-reason"]', '시험');
  await page.click('[data-action="pp-aff-save"]');
  await page.waitForFunction(() => window.__chat.goeiPeopleV1.log.some((c) => c.src === 'manual' && c.pin === 150));
  assert.ok((await page.textContent('.pp-aff-top b')).includes('관심'), '150 = 관심');
  // 호칭 직접 수정 + 고정
  await page.click('[data-action="pp-addr-edit"]');
  await page.fill('[data-input="pp-addr-to"]', '요원님');
  await page.click('[data-action="pp-addr-reg"][data-value="reg=존댓말"]');
  await page.check('[data-change="pp-addr-pin"]');
  await page.click('[data-action="pp-addr-save"]');
  await page.waitForFunction(() => window.__chat.goeiPeopleV1.people['쟈알디'].address.pin === true && window.__chat.goeiPeopleV1.people['쟈알디'].address.toUser === '요원님');
  // 세력 평판 상세: 값 −100~100, 구간, 고정 (기록 탭 › 세력)
  await page.click('[data-action="rec-sub"][data-value="factions"]');
  await page.waitForSelector('.pp-sec:has-text("세력 평판")');
  await page.click('[data-action="rec-faction"][data-value="C00"]');
  await page.waitForSelector('.pp-cells');
  const fv = await page.textContent('.pp-aff-num');
  assert.ok(fv.includes('범위 -100~100'));
  await page.click('[data-action="pp-aff-edit"]');
  await page.fill('[data-input="pp-aff-num"]', '-500');
  await page.fill('[data-input="pp-aff-reason"]', '시험');
  await page.click('[data-action="pp-fac-save"]');
  await page.waitForFunction(() => window.__chat.goeiPeopleV1.log.some((c) => c.who === '세력:C00' && c.pin === -100));
  assert.ok((await page.textContent('.pp-aff-top b')).includes('적대'), '−100 = 적대');
  // 경계 설정: 기본(경계 하한 −60)이면 −80 은 적대, 중립 하한을 −90 으로 내리면 −80 은 중립
  await page.click('[data-action="pp-aff-edit"]');
  await page.fill('[data-input="pp-aff-num"]', '-80');
  await page.fill('[data-input="pp-aff-reason"]', '시험2');
  await page.click('[data-action="pp-fac-save"]');
  await page.waitForFunction(() => window.__chat.goeiPeopleV1.log.some((c) => c.who === '세력:C00' && c.pin === -80));
  assert.ok((await page.textContent('.pp-aff-top b')).includes('적대'), '기본 경계: −80 = 적대');
  await page.evaluate(() => { window.__chat.scriptstate.$pp_faction_bounds = '61,21,-90,-95'; });
  await reopen(page);
  if (!(await page.locator('.pp-cells').count())) { await page.click('[data-action="rec-sub"][data-value="factions"]'); await page.click('[data-action="rec-faction"][data-value="C00"]'); }
  await page.waitForSelector('.pp-cells');
  assert.ok((await page.textContent('.pp-aff-top b')).includes('중립'), '중립 하한 −90: −80 = 중립');
  // 문서 (기록 탭 › 인물 › 기록 문서)
  await page.click('[data-action="rec-sub"][data-value="people"]');
  await page.click('[data-action="rec-docs"]');
  await page.waitForSelector('.pp-pane');
  assert.ok((await page.textContent('.pp-pane')).includes('관람차 사건'));
  // 되감기: 근거 메시지 본문을 고치면 항목·계기가 빠지고(회색), 화면은 「메시지가 사라져 빠짐」
  await page.evaluate(() => { const m = window.__chat.message.at(-1); m.data = '전혀 다른 글.'; });
  await reopen(page);
  if (!(await page.locator('[data-action="rec-person"][data-value="쟈알디"]').count())) await page.click('[data-action="rec-sub"][data-value="people"]');
  await page.click('[data-action="rec-person"][data-value="쟈알디"]');
  await page.waitForSelector('.pp-aff');
  assert.ok((await page.textContent('.pp-pane')).includes('메시지가 사라져 빠짐'));
  const reqAfter = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '쟈알디' }], 'model'));
  const blk = reqAfter.find((m) => /\[People records\]/.test(m.content));
  assert.ok(blk && !blk.content.includes('부상 (왼팔)'), '빠진 항목은 본편에 안 들어감');
  assert.ok(blk.content.includes("'요원님'"), '고정한 호칭은 남음');
  assert.deepEqual(errors, []);
  console.log('PASS 인물 기록: 기록 탭 연동·근거·고정·취소·호감/호칭 직접 수정·세력 평판 값/구간/고정·문서·되감기');
  await page.close();
}

// PP3) 이미지 태그: 목록에 없는 이름·표정은 칸을 그리지 않고 지운다. 이미지 지침은 메인 요청 끝 시스템 메시지로
if (want('PP3')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  const h = await page.evaluate(() => window.__calls.handlers.display('앞<img=Jyaldi_smile>가운데<img=Nobody_smile>뒤<img=Jyaldi_dancing>끝'));
  assert.ok(h.includes('Jyaldi_smile'), '아는 이름·표정은 그림 칸');
  assert.ok(!h.includes('Nobody') && !h.includes('dancing'), '모르는 이름·표정은 지움');
  assert.ok(h.includes('가운데') && h.includes('뒤'));
  const req = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: 'u' }], 'model'));
  const ip = req.filter((m) => m.role === 'system' && m.content.includes('## Inserting Character Visual Images'));
  assert.equal(ip.length, 1, '이미지 지침 한 번');
  assert.ok(ip[0].content.includes('Jyaldi') && ip[0].content.includes('Do not create tags for {{user}}'));
  assert.deepEqual(errors, []);
  console.log('PASS 이미지 태그: 목록 밖 이름·표정 제거, 이미지 지침 한 번');
  await page.close();
}
// IP1) 이미지 지침 화면 (설정 → 이미지 지침): 지침 틀 저장·미리보기·기본값, 출력 대상 끄기·임의 추가(꺾쇠 걸러짐), 표정 세트 → 메인 요청 끝 시스템 메시지에 그대로. 보조 모델이면 안 넣음
if (want('IP1')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  await startedWithReply(page);
  await open(page);
  await page.click('.gx-nav .gx-nb.desk[data-value="set:screen"]');
  await page.waitForSelector('.gw .gw-win');
  await page.click('[data-action="ed-tab"][data-value="guide"]');
  await page.click('[data-action="ed-node"][data-value="guide:Image"]');
  await page.waitForSelector('.ip-pane');
  const evil = '<img src=x onerror="window.__xss=1">';
  // 지침 틀: 자리표가 채워지고, 꺾쇠가 든 틀도 화면(미리보기)에서는 글자로
  await page.fill('[data-input="ip-template"]', `QC-TEMPLATE ${evil}\nchars: {characters}\nkw: {keywords}\n{user_rule}끝`);
  await page.click('[data-action="ip-template-save"]');
  await page.waitForFunction(() => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgPrompt ?? '').startsWith('QC-TEMPLATE'));
  // 임의 추가: 꺾쇠·밑줄·중괄호는 걸러진다. $& 는 replace 특수 문자로 풀리지 않는다
  await page.fill('[data-input="ip-extra"]', 'Ave_n<sha>$&');
  await page.click('[data-action="ip-extra-add"]');
  await page.waitForFunction(() => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgNamesExtra ?? []).includes('Avensha$&'));
  // 빈 이름은 안내
  await page.click('[data-action="ip-extra-add"]');
  assert.ok((await page.textContent('.ip-pane')).includes('영문명을 적어'));
  // 명부 인물 끄기 (Jyaldi)
  await page.uncheck('[data-change="ip-toggle"][data-key="Jyaldi"]');
  await page.waitForFunction(() => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgNamesOff ?? []).includes('Jyaldi'));
  // 표정 세트: 대문자·줄바꿈 정리
  await page.fill('[data-input="ip-keywords"]', 'Smile, CRY\nangry');
  await page.click('[data-action="ip-keywords-save"]');
  await page.waitForFunction(() => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgKeywords ?? []).join(',') === 'smile,cry,angry');
  await page.click('[data-action="ip-preview"]');
  await page.waitForSelector('.ip-preview');
  const pv = await page.textContent('.ip-preview');
  assert.ok(pv.includes('QC-TEMPLATE <img') && pv.includes('kw: smile, cry, angry') && pv.includes('Avensha$&') && !/\bJyaldi\b/.test(pv), `미리보기: ${pv.slice(0, 300)}`);
  assert.equal(await page.evaluate(() => window.__xss), undefined, '미리보기 escape');
  // 메인 요청: 끝 시스템 메시지로 한 번
  const req = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '안녕' }], 'model'));
  const last = req.at(-1);
  assert.equal(last.role, 'system');
  assert.ok(last.content.startsWith('QC-TEMPLATE') && last.content.includes('Avensha$&') && !/\bJyaldi\b/.test(last.content), '요청에 저장한 지침');
  assert.equal(req.filter((m) => /QC-TEMPLATE/.test(m.content)).length, 1);
  // 보조 모델로 태그를 붙이는 설정이면 메인 요청에 지침을 넣지 않는다
  await page.evaluate(() => { window.__chat.scriptstate.$st_asset_model = 'aux'; });
  const req2 = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '안녕' }], 'model'));
  assert.ok(!req2.some((m) => /QC-TEMPLATE/.test(m.content)), '보조 모델 설정이면 지침 없음');
  await page.evaluate(() => { window.__chat.scriptstate.$st_asset_model = 'main'; });
  // 기본값으로 되돌리기
  await page.click('[data-action="ip-template-reset"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgPrompt === undefined);
  const req3 = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'user', content: '안녕' }], 'model'));
  assert.ok(req3.at(-1).content.startsWith('## Inserting Character Visual Images'), '기본 틀');
  assert.deepEqual(errors, []);
  console.log('PASS 이미지 지침 화면: 틀 저장·미리보기 escape·임의 추가 거르기·대상 끄기·표정 세트·메인 요청 반영·보조 모델이면 없음·기본값');
  await page.close();
}

// ═══════════ 기록 · 소감 (묶음 3, docs/설계안_기록_보고서.md 6장) ═══════════
// 종료 턴 응답 둘: 진입(활성·목표 = 이 괴이 → 내가 출동) → 종료(격리). 글에 쟈알디가 나와야 갱신기가 모델을 부른다 (장면 인물 없음이면 안 부름)
const enterText = (where, preset) => ['쟈알디 부장이 셔터 앞에서 지시를 내렸다.', `[AN|${where}|${preset.name}|활성|A|P001, P002|셔터 안쪽으로 진입했다]`, '[AG|P002|작전투입|현장]', `[▣|2025.01.01|03:30 AM|☀️|4°C|${where} 지하|${preset.name}]`].join('\n');
const endText = (where, preset) => ['쟈알디가 격리 완료를 보고했다.', `[AN|${where}|${preset.name}|격리|A|P001, P002|격리 완료. 현장 봉쇄 해제]`, '[AG|P001|휴게|사무실]', '[AG|P002|부상|병원]', '[▣|2025.01.01|04:11 AM|☀️|4°C|관리국 본부|없음]'].join('\n');
const lastReport = (page) => page.evaluate(() => JSON.parse(window.__chat.scriptstate.$goei_reports ?? '{"items":[]}').items.at(-1) ?? null);
async function openReportPage(page, id) {
  await open(page);
  await nav(page, 'records');
  await page.waitForSelector('.gx-records');
  await page.click('[data-action="rec-sub"][data-value="reports"]');
  // 칩은 「내가 출동」·「요원 처리」 둘뿐 (사용자 결정) — 보고서가 어느 쪽인지 보고 고른다
  const mine = await page.evaluate((id) => JSON.parse(window.__chat.scriptstate.$goei_reports).items.find((r) => r.id === id)?.mine, id);
  await page.click(`[data-action="rec-rfilter"][data-value="${mine ? 'mine' : 'bg'}"]`);
  await page.click(`.gx-rcard[data-value="${id}"]`);
  await page.waitForSelector('.gx-rpt');
}

// J1) 소감 자동(기본 켬): 종료 턴의 인물 기록 갱신 호출 1회에 ended_now 자료·debrief 절이 얹히고(호출 수 그대로), 응답 debriefs 가 검사 뒤 보고서에 src turn 으로. 사건당 1건, 종료 없는 턴엔 절·자료 없음
if (want('J1')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  const { preset, where } = await startedWithReply(page);
  // 갱신기 응답을 그때그때 만든다 (보고서 id 는 종료가 반영된 뒤에야 알 수 있다)
  await page.evaluate(() => {
    const orig = window.risuai.runLLMModel;
    window.risuai.runLLMModel = async (o) => {
      if (!window.__llmDyn) return orig(o);
      (window.__calls.llm = window.__calls.llm || []).push(o);
      await new Promise((r) => setTimeout(r, 100));
      return window.__llmDyn(o);
    };
  });
  const n0 = await llmCount(page);
  await llm(page, [upd({ entries: [] })]);
  await fireOutput(page, enterText(where, preset));
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 1, n0, { timeout: 8000 });
  const c1 = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.equal(JSON.parse(c1.messages[1].content).ended_now, undefined, '종료 없는 턴: ended_now 없음');
  assert.ok(!c1.messages[0].content.includes('Debrief'), '종료 없는 턴: 소감 절 없음');
  await page.evaluate(() => {
    window.__llmDyn = () => {
      const r = JSON.parse(window.__chat.scriptstate.$goei_reports).items.at(-1);
      return { type: 'success', result: JSON.stringify({ entries: [], debriefs: [{ id: r.id, who: '쟈알디', text: '셔터 안쪽은 좁았다. 스팡달이 다친 게 마음에 걸린다.' }, { id: r.id, who: '쟈알디', text: '둘째 것' }, { id: 'r_none', who: '쟈알디', text: '없는 사건' }] }) };
    };
  });
  await fireOutput(page, endText(where, preset));
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 2, n0, { timeout: 8000 });
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$goei_reports ?? '{"items":[]}').items.some((r) => r.debrief), null, { timeout: 8000 });
  await page.evaluate(() => { window.__llmDyn = null; });
  const call = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.equal(call.mode, 'submodel');
  assert.ok(call.messages[0].content.includes('15c. Debrief') && call.messages[0].content.includes('"debriefs"'), '지침에 소감 절 + 출력 칸');
  const data = JSON.parse(call.messages[1].content);
  assert.equal(data.ended_now.length, 1, 'ended_now 한 건');
  assert.ok(data.ended_now[0].name === preset.name && data.ended_now[0].agents.includes('쟈알디') && data.ended_now[0].mine === true && data.want.debriefs === true, JSON.stringify(data.ended_now));
  assert.ok(data.ended_now[0].trail_tail.some((t) => t.includes('셔터')), '경과 꼬리');
  const rep = await lastReport(page);
  assert.equal(rep.id, data.ended_now[0].id);
  assert.deepEqual([rep.debrief.who, rep.debrief.src], ['쟈알디', 'turn']);
  assert.ok(rep.debrief.text.startsWith('셔터 안쪽은 좁았다'));
  const diag = JSON.parse(await page.evaluate(() => window.__store['p:goei-people-diag'] ?? '[]')).at(-1);
  assert.equal(diag.report.applied.debriefs, 1, '진단: 소감 1');
  assert.deepEqual(diag.report.dropped.filter((d) => d.kind === 'debrief').map((d) => d.reason), ['사건당 1건', '이번 턴에 종료된 사건이 아님']);
  // 보고서 페이지에 소감 (종료 턴 갱신기), 설정 → 인물 기록 → 진단 목록에 「소감 1」
  await openReportPage(page, rep.id);
  const dtext = await page.textContent('.gx-rpt-debrief');
  assert.ok(dtext.includes('쟈알디 소감') && dtext.includes('종료 턴 갱신기') && dtext.includes('셔터 안쪽은 좁았다'), dtext);
  assert.equal(await page.locator('.gx-rpt [data-action="rec-debrief"]:not([disabled])').count(), 1, '소감 쓰기 단추는 살아 있다 (덮어쓰기)');
  // 종료 없는 다음 턴: 다시 절·자료 없음, 있던 소감 그대로
  await llm(page, [upd({ entries: [] })]);
  await fireOutput(page, '쟈알디가 커피를 마셨다.');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 3, n0, { timeout: 8000 });
  await wait(300);
  const c3 = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.equal(JSON.parse(c3.messages[1].content).ended_now, undefined);
  assert.ok(!c3.messages[0].content.includes('15c. Debrief'));
  assert.equal((await lastReport(page)).debrief.src, 'turn');
  assert.deepEqual(errors, []);
  console.log('PASS 소감 자동: 종료 턴 갱신 호출에 ended_now·debrief 절 (호출 1회 그대로) · 검사(사건당 1건·없는 사건) · 보고서 src turn · 진단 「소감 1」 · 종료 없는 턴엔 없음');
  await page.close();
}

// J2) 소감 자동 끔 ($jr_debrief_auto=0): 종료 턴 갱신 호출은 그대로 1회지만 절·자료가 없고, 보고서는 「소감 없음」
if (want('J2')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  const { preset, where } = await startedWithReply(page);
  await page.evaluate(() => { window.__chat.scriptstate.$jr_debrief_auto = '0'; });
  const n0 = await llmCount(page);
  await llm(page, [upd({ entries: [] }), upd({ entries: [], debriefs: [{ id: 'x', who: '쟈알디', text: '보내도 안 받는다.' }] })]);
  await fireOutput(page, enterText(where, preset));
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 1, n0, { timeout: 8000 });
  await fireOutput(page, endText(where, preset));
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 2, n0, { timeout: 8000 });
  await wait(500);
  const call = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.ok(!call.messages[0].content.includes('Debrief'), '소감 절 없음');
  const data = JSON.parse(call.messages[1].content);
  assert.equal(data.ended_now, undefined);
  assert.equal(data.want.debriefs, false);
  const rep = await lastReport(page);
  assert.ok(rep && rep.mine && !rep.debrief, '보고서는 있고 소감은 없음');
  await openReportPage(page, rep.id);
  assert.ok((await page.textContent('.gx-rpt')).includes('소감 없음'));
  assert.deepEqual(errors, []);
  console.log('PASS 소감 자동 끔: 갱신 호출은 그대로, 절·자료 없음, 보고서 「소감 없음」');
  await page.close();
}

// J3) 인물 기록 갱신기 끔 ($pp_on=0): 종료 턴에 호출 0회 → 「소감 없음」. 그래도 보고서 페이지 「소감 쓰기」는 보조 모델 1회로 된다 (src manual)
if (want('J3')) {
  const { page, errors } = await boot(fixture, { message: [], scriptstate: {} });
  const { preset, where } = await startedWithReply(page);
  await page.evaluate(() => { window.__chat.scriptstate.$pp_on = '0'; });
  const n0 = await llmCount(page);
  await fireOutput(page, enterText(where, preset));
  await fireOutput(page, endText(where, preset));
  await wait(700);
  assert.equal(await llmCount(page), n0, '갱신기 꺼짐: 종료 턴에 호출 0회');
  const rep = await lastReport(page);
  assert.ok(rep && rep.mine && !rep.debrief);
  await openReportPage(page, rep.id);
  assert.ok((await page.textContent('.gx-rpt')).includes('소감 없음'));
  await page.evaluate((id) => { window.__llm = [ok0(JSON.stringify({ debriefs: [{ id, who: '스팡달', text: '병원 침대에서 쓴다. 다음엔 셔터부터 확인하자.' }] }))]; function ok0(s) { return { type: 'success', result: s }; } }, rep.id);
  await page.click('.gx-rpt [data-action="rec-debrief"]');
  await page.waitForFunction((id) => JSON.parse(window.__chat.scriptstate.$goei_reports).items.find((r) => r.id === id)?.debrief?.src === 'manual', rep.id, { timeout: 15000 });
  assert.equal(await llmCount(page), n0 + 1, '수동 소감 = 1회');
  const call = await page.evaluate(() => window.__calls.llm.at(-1));
  assert.equal(call.mode, 'submodel');
  assert.ok(!call.messages[0].content.includes('15c.') && call.messages[0].content.includes('after-action'), '갱신기 전체 지침이 아니라 짧은 전용 지침');
  await page.waitForFunction(() => document.querySelector('.gx-rpt-debrief')?.textContent?.includes('스팡달 소감'));
  assert.ok((await page.textContent('.gx-rpt-debrief')).includes('직접 요청'));
  // 깨진 응답 → 단추 옆 글대로 **1회**만 (재시도 없음) 실패 안내, 보고서의 소감은 그대로
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '{"debriefs":[' }, { type: 'success', result: '{"debriefs":[{"id":"x","who":"y","text":"재시도가 있었다면 이게 갔다"}]}' }]; });
  await page.click('.gx-rpt [data-action="rec-debrief"]');
  await page.waitForFunction((n) => (window.__calls.llm ?? []).length === n + 2, n0, { timeout: 15000 });
  await wait(400);
  assert.equal(await llmCount(page), n0 + 2, '깨진 응답에도 보조 모델은 1회만 (2회 아님)');
  await page.waitForSelector('.gx-records .gx-err');
  assert.ok((await page.textContent('.gx-records .gx-err')).includes('소감을 쓰지 못했어요'));
  assert.equal((await lastReport(page)).debrief.who, '스팡달', '있던 소감 그대로');
  assert.deepEqual(errors, []);
  console.log('PASS 갱신기 끔: 종료 턴 호출 0회·「소감 없음」 · 수동 「소감 쓰기」 1회(src manual) · 깨진 응답은 실패 안내');
  await page.close();
}

await browser.close();
