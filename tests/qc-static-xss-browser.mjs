// 보안 QC: 모델 출력·채팅 기록(괴담넷·괴담톡·위키·인물 기록·가계부·상태창·기록 카드)에 든 HTML 조각이
// 채팅 화면(display 처리기)과 플러그인 창(패널 탭)에서 실행되지 않고 글자로만 보이는지 실제 Chromium 으로 확인한다.
// 사용법: node tests/qc-static-xss-browser.mjs <fixture.json>
// 틀은 tests/browser.mjs 의 hostScript 를 복사·축약한 것 (가짜 risuai).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { addUserPost, addUserComment, addOutgoingDm, writeGnet, CFG, saveDoc, addWalletEntry, walletVars, phone } from '../dist-test/core.mjs';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const plugin = readFileSync(new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');
const bodyCode = readFileSync(new URL('../dist/goei-body.js', import.meta.url), 'utf8');

function hostScript(char, chat) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {} };
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
    window.__store = { 'p:goei:body': ${JSON.stringify(bodyCode)} };
    window.__rootDoc = { querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => { const a = [...document.querySelectorAll(q)].map(wrap); return Object.assign(a, { length: async () => a.length, at: async (i) => a[i] }); }, createElement: async (t) => wrap(document.createElement(t)) };
    window.__char = ${JSON.stringify(char)};
    window.__chat = ${JSON.stringify(chat)};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.risuai = {
      registerButton: async (arg, cb) => ({ id: arg.id }),
      registerSetting: async () => ({ id: 's' }),
      getRootDocument: async () => window.__rootDoc,
      requestPluginPermission: async () => true,
      sendChat: async () => true,
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
      setCharacterToIndex: async (i, c) => { window.__char = clone(c); },
      getChatFromIndex: async () => clone(window.__chat),
      setChatToIndex: async (a, b, chat) => { window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
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

// ── 공격 문자열 ──
const P1 = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
const P2 = '"><svg onload="window.__xss=(window.__xss||0)+1"><b>';
const P3 = "'><img src=x onerror=window.__xss=1>";
const P4 = "$' $& $1 $<a> 끝"; // String.replace 치환 문자열 패턴
const ALL = `${P1}${P2}${P3}${P4}`;
const hex = (s) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');

// ── 채팅 기록: 모든 기능의 저장 글에 공격 문자열을 넣는다 ──
function poisonedChat() {
  const status = `[▣|2025.01.01|02:47 AM|${P1}|4°C|${P2}|${P4}]`;
  const scene = `%%SCENE_CARD:${hex(JSON.stringify({ target: P1, party: P2 }))}%%\n이동 지시문 본문\n%%/SCENE_CARD%%`;
  const call = `%%PHONE_CALL:${hex(P1)}%%\n통화 본문\n%%/PHONE_CALL%%`;
  let chat = {
    message: [
      { role: 'user', data: '안녕' },
      { role: 'char', data: `첫 장면\n${status}` },
      { role: 'user', data: scene },
      { role: 'char', data: `둘째 장면 <img=쟈알디_x;background:red> <img=a)b_happy;x> <img=쟈알디_happy> [🔓|${P1}]\n${status}` },
      { role: 'user', data: call },
      { role: 'char', data: `셋째 장면\n[▣|2025.01.02|03:00 AM|☀️|5°C|${P3}|${ALL}]` },
    ],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1', [CFG('mode')]: '2', $nw_context: '1' },
  };
  // 괴담넷: 글·댓글·쪽지
  const gn = { posts: [], dms: [], sources: {}, seq: 0 };
  const post = addUserPost(gn, P1, P2, `${P1}\n${P3}`, '2025.01.01 10:00');
  addUserComment(gn, post.id, 0, P2, P1, '2025.01.01 10:05');
  addOutgoingDm(gn, P1, P2, '2025.01.01 10:10');
  chat = writeGnet(chat, gn);
  // 위키 문서 (제목은 < > 를 막으므로 본문·참조·지침에)
  chat = saveDoc(chat, { title: '시험 문서', mode: 'faithful', model: 'main', created: 1700000000, length: 'short', sources: [P1], primarySources: [P2], writingRequest: P1, docRequest: P2, direct: false },
    `<lightboard-namuwiki main_color="${P2}">\n[Heading]Title=${P1}|Level=1\n[Paragraph]${P1} ➡️${P2}➡️ ❗${P1}❗ 📌${P2}📌 ${P4}\n[List]${P1}\n</lightboard-namuwiki>`);
  // 괴담톡: 방 이름·주제·사람 이름·말풍선·직접 넣은 연락처
  const ps = phone.blankState();
  ps.rooms.r1 = { id: 'r1', kind: 'group', name: P1, topic: P2, members: ['x1', 'x2'], people: { x1: { id: 'x1', name: P1, custom: true, note: P2 }, x2: { id: 'x2', name: P2, custom: true } },
    messages: [{ id: 1, sender: 'x1', text: `${P1} ${P3}`, time: '2025.01.01 10:00', kind: 'message', audience: ['x1', 'x2'] }, { id: 2, sender: 'me', text: P2, time: '2025.01.01 10:01', kind: 'message', audience: ['x1', 'x2'] }], draft: '', unread: 1 };
  ps.order = ['r1'];
  ps.mid = 2;
  chat = phone.writePhone(chat, ps);
  chat.scriptstate[phone.PH_CONTACTS] = JSON.stringify({ version: 1, seq: 1, items: [{ id: 'c1', name: P1, note: P2 }] });
  // 인물 기록
  const entry = (id, text, extra = {}) => ({ id, text, src: 'manual', anchor: '', seq: 0, ...extra });
  chat.goeiPeopleV1 = {
    schema: 1,
    people: {
      쟈알디: { name: '쟈알디', faction: 'A00', seeded: { from: 'none', at: '' }, slots: { identity: [entry('e1', P1)], state: [entry('e2', P2)], relationship: [entry('e3', P3, { target: P1 })], speech: [entry('e4', P4, { target: '@user' })] }, affinity: { base: 10 }, address: { toUser: P1, register: '존댓말' }, express: 1, aliases: [P2] },
      [P1]: { name: P1, faction: '', seeded: { from: 'none', at: '' }, slots: { state: [entry('e5', P1)] }, affinity: { base: 0 }, address: { toUser: P2, register: '반말' }, express: 1, aliases: [] },
    },
    factions: {}, docs: {}, log: [{ id: 'c1', anchor: '', who: '쟈알디', kind: 'cue', cue: '도움', text: P1, quote: P2, src: 'manual', seq: 0 }], folded: {}, read: {}, pending: { [P2]: { anchor: '', aliases: [P1] } }, ignored: [],
  };
  chat.scriptstate.$pp_on = '1';
  // 가계부
  Object.assign(chat.scriptstate, walletVars(addWalletEntry({ start: 100000, log: [] }, { anchor: '', amount: -5000, memo: P1, src: 'manual', quote: P2, place: P3 })));
  return chat;
}

const browser = await chromium.launch();
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });

async function boot(char, chat, viewport = { width: 1100, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%"></div></body></html>');
  await page.addScriptTag({ content: "document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);" });
  await page.addScriptTag({ content: hostScript(char, chat) });
  await page.addScriptTag({ content: `(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
  assert.equal(await page.evaluate(() => window.__bootError ?? null), null);
  return { page, errors };
}
async function open(page) {
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  await page.click('[x-goei-fab] button');
  await page.waitForSelector('.gx-nb');
}
/** 실행된 흔적: window.__xss, 살아 있는 공격 요소, 페이지 오류 */
async function audit(page, errors, where) {
  // 그림이 로드 실패해 onerror 가 돌 시간을 준다
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => ({
    xss: window.__xss ?? 0,
    live: document.querySelectorAll('img[src="x"], svg[onload], [onerror]').length,
    rawTag: (document.querySelector('.gx')?.innerText ?? '').includes('[▣|'),
  }));
  assert.equal(r.xss, 0, `${where}: 스크립트가 실행됨`);
  assert.equal(r.live, 0, `${where}: 공격 요소가 DOM 에 살아 있음`);
  assert.deepEqual(errors, [], `${where}: 페이지 오류`);
  return r;
}

const chat = poisonedChat();
let total = 0;
/** 그 화면에 공격 문자열이 글자로 실제로 보이는지 (그리지도 않고 통과하는 것을 막는다) */
async function seen(page, where) {
  const t = await page.evaluate(() => document.querySelector('.gw')?.hidden === false ? document.querySelector('.gw').innerText : document.querySelector('.gx').innerText);
  assert.ok(t.includes('onerror'), `${where}: 공격 문자열이 글자로 보여야 함 (그려지지 않음)`);
}

// 1) display 처리기: 채팅 화면에 그리는 HTML
{
  const { page, errors } = await boot(fixture, chat);
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  const texts = chat.message.map((m) => m.data).concat([
    `%%GOEI_START%%\n${ALL}\n%%/GOEI_START%%`,
    `%%GOEI_START%%\n${ALL}\n%%/GOEI_START%%\n%%GOEI_UNSENT%%`,
    `${P4} [▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|${P4}]`,
  ]);
  for (const [i, t] of texts.entries()) {
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), t);
    // 본문은 Risu 몫이고 플러그인은 태그·표식만 바꾼다: 공격 문자열은 모두 태그·표식 안에만 넣었으니 출력에 날것이 있으면 플러그인이 흘린 것
    const leak = html.search(/<(img|svg|b)\b[^>]*\bon(error|load)=/i); // 진짜 태그만 (escape 된 &lt;img 는 무해)
    assert.ok(leak < 0, `display #${i}: 이벤트 속성이 그대로 남음: …${html.slice(Math.max(0, leak - 260), leak + 80)}…`);
    // 표식은 다 바뀌어야 한다 (치환 문자열 $& 때문에 원문 태그가 두 번 들어가는 것도 잡힌다)
    assert.ok(!html.includes('[▣|') || !t.includes('[▣|'), `display #${i}: 상태창 태그 원문이 남음`);
    assert.ok(!html.includes('%%'), `display #${i}: 표식이 남음`);
    await page.evaluate((h) => { document.querySelector('.default-chat-screen').innerHTML = `<div class="risu-chat">${h}</div>`; }, html);
    await audit(page, errors, `display #${i}`);
    total++;
  }
  console.log(`PASS display 처리기 ${texts.length}건: 공격 문자열이 글자로만 남음`);
  await page.close();
}

// 2) 플러그인 창: 탭마다 그 기록을 그린다
{
  const { page, errors } = await boot(fixture, chat);
  await open(page);
  await audit(page, errors, '상황판'); await seen(page, '상황판');
  const tab = async (id) => { await page.click(`.gx-nav [data-action="nav-tab"][data-value="${id}"]`); await page.waitForFunction((id) => document.querySelector('.gx')?.dataset.tab === id, id); };
  await tab('map'); await audit(page, errors, '지도'); total++;
  await tab('mission'); await audit(page, errors, '임무'); total++;
  await tab('gnet'); await audit(page, errors, '괴담넷 목록'); total++;
  await page.click('[data-action="gn-open"]'); await page.waitForSelector('.gn-c'); await audit(page, errors, '괴담넷 글·댓글'); await seen(page, '괴담넷 글'); total++;
  if (await page.$('[data-action="gn-dm"], [data-action="gn-dms"]')) { await page.click('[data-action="gn-dm"], [data-action="gn-dms"]'); await audit(page, errors, '괴담넷 쪽지'); total++; }
  await tab('phone'); await audit(page, errors, '괴담톡 목록(연락처)'); await seen(page, '괴담톡 연락처'); total++;
  await page.click('[data-action="ph-sub"][data-value="chats"]'); await page.waitForSelector('[data-action="ph-room"]'); await audit(page, errors, '괴담톡 대화 목록'); total++;
  if (await page.$('[data-action="ph-room"]')) { await page.click('[data-action="ph-room"]'); await page.waitForSelector('.ph-msg'); await audit(page, errors, '괴담톡 방'); await seen(page, '괴담톡 방'); total++; } else assert.fail('괴담톡 방이 목록에 없음');
  for (const sub of ['contacts', 'chats', 'notice']) {
    const b = await page.$(`[data-action="ph-sub"][data-value="${sub}"]`);
    if (b) { await b.click(); await audit(page, errors, `괴담톡 ${sub}`); total++; }
  }
  await page.fill('[data-input="ph-search"], .ph-search input', P1).catch(() => {});
  await audit(page, errors, '괴담톡 검색'); total++;
  await tab('wiki'); await audit(page, errors, '위키 홈'); total++;
  await page.fill('[data-input="wiki-home-query"]', '시험 문서');
  await page.press('[data-input="wiki-home-query"]', 'Enter');
  await page.waitForSelector('.nw-doc', { timeout: 5000 }); await audit(page, errors, '위키 문서'); await seen(page, '위키 문서'); total++;
  if (await page.$('[data-action="wiki-people"]')) { await page.click('[data-action="wiki-people"]'); await page.waitForTimeout(200); await audit(page, errors, '인물 기록 목록'); await seen(page, '인물 기록'); total++;
    const who = await page.$('[data-action="pp-open"], .pp-row [data-action]');
    if (who) { await who.click(); await page.waitForTimeout(200); await audit(page, errors, '인물 기록 상세'); total++; }
  }
  await tab('wallet'); await audit(page, errors, '가계부'); await seen(page, '가계부'); total++;
  await tab('field'); await audit(page, errors, '필드'); total++;
  // 설정 창: 인물 기록·괴담넷·괴담톡 설정 페이지와 세계 편집 트리 (명부 이름 등)
  await page.click('.gx-nav .gx-nb.desk[data-action="ed-open"]');
  await page.waitForSelector('.gw .gw-set');
  for (const node of ['set:people', 'set:gnet', 'set:phone', 'set:board', 'set:wiki', 'manage:diag']) {
    const b = await page.$(`[data-action="ed-node"][data-value="${node}"]`);
    if (!b) { await page.click('[data-action="ed-tab"][data-value="manage"]'); }
    const b2 = await page.$(`[data-action="ed-node"][data-value="${node}"]`);
    if (b2) { await b2.click(); await page.waitForTimeout(150); await audit(page, errors, `설정 ${node}`); total++; }
  }
  console.log(`PASS 플러그인 창 ${total}곳: 공격 문자열이 글자로만 남음`);
  await page.close();
}

await browser.close();
console.log(`PASS 전부 ${total}건`);
