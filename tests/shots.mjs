// 실제 Chromium에서 플러그인 번들을 Risu와 같은 방식(async 함수 안)으로 실행하고
// 가짜 risuai API로 시작 화면 → 저장까지 확인한다.
// 사용법: node tests/browser.mjs <fixture.json> [screenshot-dir]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const shots = process.argv[3];
const fixtureDir = dirname(resolve(process.argv[2]));
if (shots) mkdirSync(shots, { recursive: true });
const plugin = readFileSync(process.env.PLUGIN || new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fixture.globalLore.find((e) => e.comment === '괴이봇 플러그인 매니페스트').content);

function hostScript(char, chat, { rootDom = true } = {}) {
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
    });
    window.__store = {};
    window.__rootDoc = ${rootDom} ? { querySelector: async (q) => wrap(document.querySelector(q)), createElement: async (t) => wrap(document.createElement(t)) } : null;
    window.__char = ${JSON.stringify(char)};
    window.__liteChar = window.__char;
    window.__chat = ${JSON.stringify(chat)};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.risuai = {
      registerButton: async (arg, cb) => { window.__button = { arg, cb }; return { id: arg.id }; },
      registerSetting: async (name, cb) => { window.__setting = cb; return { id: 's' }; },
      getRootDocument: async () => window.__rootDoc,
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
      readImage: async (p) => { if (window.__assets[p]) return window.__assets[p]; const b64 = await window.__readAsset(p); if (!b64) throw new Error('no asset'); return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); },
      saveAsset: async (bytes) => { const p = 'assets/' + Object.keys(window.__assets).length.toString(16).padStart(8, 'a') + '.png'; window.__assets[p] = new Uint8Array(bytes); return p; },
      readInlay: async () => null,
      parseRisuChat: async (t) => String(t).replace(/\{\{user\}\}/g, window.__userName ?? '{{user}}'),
    };
    window.__assets = {};`;
}

const browser = await chromium.launch();
// 실패하면 브라우저를 닫고 바로 끝낸다 (열린 브라우저 때문에 멈춘 채 남지 않게)
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
async function boot(char, chat, viewport = process.env.VP ? { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } : { width: 1100, height: 900 }, opts = {}) {
  const page = await browser.newPage({ viewport, hasTouch: !!opts.touch });
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

// 모바일 화면 모아 찍기 (수정 전후 비교용): node tests/shots.mjs <fixture.json> <dir>
const { page, errors } = await boot(fixture, { message: [], scriptstate: {} }, { width: 390, height: 844 }, { touch: true });
await startedWithReply(page);
await page.evaluate(async () => {
  const items = [1, 2, 3].map((i) => ({ id: `n${i}`, channel: 'A00', issuer: '관리국 총무과', category: i === 1 ? '안전' : '공지', title: `공지 제목 ${i} 조금 길게 써 보는 제목입니다`, text: '본문 첫 줄입니다. 배관 공사로 인해 지하 2층 출입이 제한됩니다.\n둘째 줄.', time: '2025.01.01 02:4' + i, read: i !== 1 }));
  window.__chat.scriptstate.$ph_bulletins = JSON.stringify({ version: 1, items, seen: {} });
});
// 유저 사진: Risu가 채팅 속 숨은 칸의 {{source::user}}를 /sw/img/<경로 hex>로 바꿔 둔 상태를 흉내 낸다
await page.evaluate(() => {
  const row = (window.__char.additionalAssets || []).find((a) => /jyaldi/i.test(a[0])) || window.__char.additionalAssets[0];
  window.__userName = '한지우';
  const hex = [...new TextEncoder().encode(row[1])].map((b) => b.toString(16).padStart(2, '0')).join('');
  const box = document.createElement('span');
  box.setAttribute('data-goei-user', '');
  box.hidden = true;
  box.innerHTML = `<img src="/sw/img/${hex}" alt="">`;
  document.body.appendChild(box);
});
const g = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: `${shots}/${name}.png` }); };
await open(page);
await page.waitForSelector('.gx-board');
await g('m01-board');
await page.click('.gx-idbtn').catch((e) => console.log('idbtn', e.message));
await g('m01b-idcard');
await page.click('.gx-idpop .gx-agpop-x').catch(() => {});
await page.evaluate(() => document.querySelector('.gx-content')?.scrollBy(0, 600));
await g('m02-board-scroll');
await page.click('.gx-board .gx-acard .gx-acard-sit').catch((e) => console.log('agpop', e.message));
await g('m02b-agent-info');
await page.click('.gx-agpop-x').catch(() => {});
await page.click('.gx-mtrack .gx-nb[data-value=\"map\"] >> nth=1');
await g('m03-map');
// 두 손가락으로 지도 확대 (충남 근처)
{
  const cdp = await page.context().newCDPSession(page);
  const r = await page.$eval('.gx-canvas[data-map]', (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const cx = r.x + r.w * 0.4, cy = r.y + r.h * 0.45;
  const tp = (d) => [{ x: cx - d, y: cy, id: 0 }, { x: cx + d, y: cy, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(20) });
  for (let d = 30; d <= 90; d += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(d) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('zoom', await page.$eval('.gx-mapzoom', (el) => el.style.transform), await page.$eval('.gx-content', (el) => el.scrollTop));
  await g('m03b-map-pinch');
  // 한 손가락으로 옮기기
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 0 }] });
  for (let d = 10; d <= 60; d += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - d, y: cy - d, id: 0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('pan', await page.$eval('.gx-mapzoom', (el) => el.style.transform));
  await g('m03c-map-pan');
  await page.click('.gx-zbtn.reset');
  console.log('reset', JSON.stringify(await page.$eval('.gx-mapzoom', (el) => el.style.transform)));
}
await page.evaluate(() => document.querySelector('.gx-content')?.scrollBy(0, 900));
await g('m04-map-scroll');
await page.evaluate(() => { const c = [...document.querySelectorAll('.gx-pick, .gx-pcard, [class*=pick]')]; (c[1] ?? c[0])?.scrollIntoView({ block: 'center' }); console.log(c.length); });
await g('m04b-map-picks');
await page.setViewportSize({ width: 360, height: 780 });
await g('m04c-360');
await page.click('.gx-stepbar button:nth-child(2)').catch((e) => console.log('step', e.message));
await page.click('.gx-acard.pick.wide:not(.off)', { timeout: 3000 }).catch((e) => console.log('pick', e.message));
await g('m04d-team-360');
// 요원 목록을 내린 뒤 고르면 그 자리에 머물러야 한다
{
  const before = await page.$eval('.gx-acards.pick', (el) => ((el.scrollTop = el.scrollHeight), el.scrollTop));
  await page.$$eval('.gx-acard.pick.wide:not(.off)', (els) => els[els.length - 1]?.click());
  await page.waitForTimeout(200);
  console.log('pick scroll', before, await page.$eval('.gx-acards.pick', (el) => el.scrollTop));
}
await page.setViewportSize({ width: 390, height: 844 });
await page.click('.gx-stepswap').catch(() => {});
await g('m05-mission');
await page.click('.gx-stepbar .gx-stepb >> nth=0').catch((e) => console.log('goal', e.message));
await g('m05b-custom-goal');
await page.click('.gx-mbox [data-action="mission-pick"]').catch((e) => console.log('mpick', e.message));
await page.click('.gx-stepbar .gx-stepb >> nth=0').catch(() => {});
await g('m05c-custom-cancel');
await page.click('.gx-mtrack .gx-nb[data-value=\"phone\"] >> nth=1');
await g('m06-phone');
await page.click('.ph-list [data-action="ph-dm"]').catch((e) => console.log('dm', e.message));
await g('m06f-room');
await page.click('.ph-back').catch(() => {});
for (const t of await page.$$eval('[data-action^="ph-"]', (els) => els.map((e) => `${e.dataset.action}|${e.dataset.value ?? ''}|${e.textContent.trim().slice(0, 12)}`))) console.log(t);
await page.click('[data-action="ph-ctab"][data-value="T05"]');
await g('m06b-phone-empty');
await page.click('[data-action="ph-sub"][data-value="chats"]');
await g('m06c-chats-empty');
await page.click('[data-action="ph-sub"][data-value="notices"]');
await g('m06d-notices');
await page.click('[data-action="ph-notice"][data-value="n2"]').catch((e) => console.log('notice click', e.message));
await g('m06e-notice-open');
await page.click('.gx-mtrack .gx-nb[data-value=\"wiki\"] >> nth=1');
await g('m07-wiki');
for (const t of await page.$$eval('[data-action^="wiki-"]', (els) => els.map((e) => `${e.dataset.action}|${e.dataset.value ?? ''}|${e.textContent.trim().slice(0, 12)}`))) console.log(t);
await page.setViewportSize({ width: 1300, height: 860 });
await page.click('.gx-nav .gx-nb[data-value="board"]');
await g('p01-board');
await page.click('.gx-board .gx-acard .gx-acard-top b').catch((e) => console.log('agpop pc', e.message));
await g('p01d-agent-info');
await page.click('.gx-agpop-x').catch(() => {});
await page.click('.gx-nav .gx-nb[data-value="map"]');
await page.click('.gx-map li[data-action="pick-event"] .gx-evc-name').catch((e) => console.log('pick-event', e.message));
await g('p02-map-cancel');
await page.click('.gx-stepswap, .gx-nav .gx-nb[data-value="mission"]').catch(() => {});
await page.waitForSelector('.gx-mbox').catch(() => {});
await page.click('.gx-mbox [data-action="mission-pick"]').catch((e) => console.log('mpick', e.message));
await g('p03-custom-cancel');
await page.click('.gx-nav .gx-nb[data-value="board"]');
// 가장 빡빡한 경우: 진행 중 괴이 3개 + 요원 4줄, 상태 설명 두 줄씩 꽉 → 창 전체가 스크롤되면 안 된다
await page.setViewportSize({ width: 1920, height: 1080 });
const fill = () => page.evaluate(() => {
  const ul = document.querySelector('#gx-sec-an .gx-evcs');
  const live = [...ul.children].find((li) => li.querySelector('.gx-evc-who')) ?? ul.children[0];
  ul.innerHTML = '';
  for (let i = 0; i < 3; i++) ul.appendChild(live.cloneNode(true));
  const long = '현장 주변을 수색하며 생존자를 찾고 있다. 외곽 통로에서 이상한 소리가 계속 들려 무전으로 보고하는 중이다.';
  document.querySelectorAll('#gx-sec-ag .gx-acard-txt').forEach((t) => {
    let s = t.querySelector('.gx-acard-sit');
    if (!s) { s = document.createElement('span'); s.className = 'gx-acard-sit'; t.appendChild(s); }
    s.textContent = long;
  });
  const b = document.querySelector('.gx-board');
  return { body: [b.clientHeight, b.scrollHeight], an: ul.offsetHeight, ag: document.querySelector('#gx-sec-ag .gx-acards').offsetHeight, card: document.querySelector('#gx-sec-ag .gx-acard').offsetHeight, ev: live.offsetHeight };
});
console.log('board full', JSON.stringify(await fill()));
await g('p01b-board-full');
await page.evaluate(() => { const ul = document.querySelector('#gx-sec-an .gx-evcs'); ul.appendChild(ul.children[0].cloneNode(true)); const ag = document.querySelector('#gx-sec-ag .gx-acards'); for (let i = 0; i < 3; i++) ag.appendChild(ag.children[i].cloneNode(true)); const b = document.querySelector('.gx-board'); console.log(b.clientHeight, b.scrollHeight); });
console.log('board over', await page.evaluate(() => { const b = document.querySelector('.gx-board'); return [b.clientHeight, b.scrollHeight, document.querySelector('#gx-sec-an .gx-evcs').scrollHeight, document.querySelector('#gx-sec-an .gx-evcs').clientHeight]; }));
await g('p01c-board-over');
await page.setViewportSize({ width: 1300, height: 860 });
await page.click('.gx-nav .gx-nb.desk[data-value="map"]');
await g('p02-map');
await page.fill('[data-input="map-query"]', '강남');
await g('p02b-map-search');
await page.click('.gx-sugi >> nth=0');
console.log('jump', await page.$eval('.gx-mapbar select', (el) => el.value), await page.$eval('[data-input="map-query"]', (el) => el.value));
await g('p02c-map-jump');
await page.selectOption('.gx-mapbar select', '01');
await page.click('.gx-zbtn[data-zoom="in"]');
await page.mouse.move(400, 400);
await g('p03-map-zoomed');
await page.click('.gx-zbtn[data-zoom="reset"]');
await page.$$eval('[data-action="map-region"]', (els) => els.find((e) => e.dataset.value !== '01' && !/hot|live|an|warn/.test(e.className))?.click());
await page.waitForTimeout(400);
await page.$$eval('[data-action="map-place"]', (els) => els.find((e) => !/hot|live|an|warn/.test(e.className))?.click());
await g('p04-map-place');
await page.click('.gx-nav .gx-nb.desk[data-value="mission"]').catch((e) => console.log('custom', e.message));
await g('p05-custom');
await page.click('.gx-nav .gx-nb[data-value="board"]');
// 바깥(어두운 막)을 누르면 닫힘
await page.mouse.click(5, 5);
console.log('outside close', await page.evaluate(() => window.__calls.hide ?? 'n/a'));
console.log(errors);
await browser.close();
