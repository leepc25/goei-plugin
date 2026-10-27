// 세계 편집 창 연기 시험: 실제 Chromium 에서 플러그인 번들을 가짜 risuai 로 띄우고, 설정 → 세계 편집 → 기록 고치기 → 저장까지 본다.
// 사용법: node tests/editor-browser.mjs <경량카드.charx 에서 뽑은 fixture.json> [screenshot-dir]
//   fixture.json: { name, globalLore, alternateGreetings } (tools: python3 -c 로 slim.charx 에서 만든다. tests/editor-fixture.py)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const plugin = readFileSync(new URL('../dist/goei-plugin.js', import.meta.url), 'utf8');
const bodyCode = readFileSync(new URL('../dist/goei-body.js', import.meta.url), 'utf8');

function hostScript(char, chat) {
  return `
    window.__calls = { setChat: [], show: [], hide: 0, replacers: [], listeners: [], handlers: {}, setChar: 0 };
    const listeners = new Map();
    const wrap = (el) => el && ({
      _el: el,
      setAttribute: async (k, v) => { el.setAttribute(k, v); }, setInnerHTML: async (h) => { el.innerHTML = h; }, getInnerHTML: async () => el.innerHTML,
      setTextContent: async (t) => { el.textContent = t; }, setStyle: async (k, v) => { el.style[k] = v; }, appendChild: async (c) => { el.appendChild(c._el); },
      querySelector: async (q) => wrap(el.querySelector(q)),
      getBoundingClientRect: async () => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; },
      addEventListener: async (type, fn) => { const id = String(Math.random()); const h = (e) => { fn({ type: e.type, clientX: e.clientX, clientY: e.clientY }); }; listeners.set(id, { type, h }); document.addEventListener(type, h); return id; },
      removeEventListener: async (type, id) => { const l = listeners.get(id); if (l) document.removeEventListener(l.type, l.h); },
      remove: async () => { el.remove(); }, addClass: async (c) => { el.classList.add(c); }, removeClass: async (c) => { el.classList.remove(c); }, hasClass: async (c) => el.classList.contains(c), textContent: async () => el.textContent,
    });
    window.__store = { 'p:goei:body': ${JSON.stringify(bodyCode)} };
    window.__rootDoc = { querySelector: async (q) => wrap(document.querySelector(q)), querySelectorAll: async (q) => [...document.querySelectorAll(q)].map(wrap), createElement: async (t) => wrap(document.createElement(t)), body: wrap(document.body), head: wrap(document.head) };
    window.__char = ${JSON.stringify(char)};
    window.__chat = ${JSON.stringify(chat)};
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.risuai = {
      registerButton: async (arg, cb) => { window.__button = { arg, cb }; return { id: arg.id }; },
      registerSetting: async () => ({ id: 's' }), getRootDocument: async () => window.__rootDoc, requestPluginPermission: async () => true,
      sendChat: async () => true, unwarpSafeArray: async (a) => a,
      safeLocalStorage: { getItem: async (k) => window.__store[k] ?? null, setItem: async (k, v) => { window.__store[k] = v; } },
      pluginStorage: { getItem: async (k) => window.__store['p:' + k] ?? null, setItem: async (k, v) => { window.__store['p:' + k] = v; }, keys: async () => [], removeItem: async (k) => { delete window.__store['p:' + k]; } },
      addRisuReplacer: async (type, fn) => { window.__calls.replacers.push(fn); }, removeRisuReplacer: async () => {},
      addRisuChatListener: async (mode, fn) => { window.__calls.listeners.push(fn); }, removeRisuChatListener: async () => {},
      addRisuScriptHandler: async (mode, fn) => { window.__calls.handlers[mode] = fn; }, removeRisuScriptHandler: async () => {}, onUnload: async () => {},
      showContainer: async (m) => { window.__calls.show.push(m); const g = document.querySelector('.gx'); if (g) g.style.display = ''; },
      hideContainer: async () => { window.__calls.hide++; const g = document.querySelector('.gx'); if (g) g.style.display = 'none'; },
      getCurrentCharacterIndex: async () => 0, getCurrentChatIndex: async () => 0,
      getCharacterFromIndex: async () => clone(window.__char),
      setCharacterToIndex: async (i, c) => { window.__calls.setChar++; window.__char = clone(c); },
      getChatFromIndex: async () => clone(window.__chat),
      setChatToIndex: async (a, b, chat) => { window.__calls.setChat.push(clone(chat)); window.__chat = clone(chat); },
      runLLMModel: async () => ({ type: 'fail', result: 'no' }),
      getCurrentLorebookEntries: async () => clone(window.__char.globalLore || []),
      getDatabase: async () => ({ modules: [], enabledModules: [] }),
      readImage: async () => { throw new Error('no asset'); }, saveAsset: async () => 'assets/x.png', readInlay: async () => null,
      parseRisuChat: async (t) => String(t), nativeFetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }),
    };`;
}

const browser = await chromium.launch();
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
process.on('uncaughtException', async (e) => {
  console.error('FAIL', e?.message ?? e);
  try {
    console.error('page errors:', errors);
    console.error('save bar:', await page.evaluate(() => document.querySelector('.gw-save')?.outerHTML ?? '(none)'));
    console.error('detail head:', await page.evaluate(() => document.querySelector('.gw-detail h2')?.textContent ?? '(none)'));
    console.error('notice:', await page.evaluate(() => document.querySelector('.gw-notice')?.textContent ?? '(none)'));
    console.error('node:', await page.evaluate(() => document.querySelector('.gw-tree-item.on')?.textContent ?? '(none)'));
    console.error('setChar:', await page.evaluate(() => window.__calls.setChar), 'guide:', await page.evaluate(() => !!document.querySelector('.gw-guide')));
  } catch {}
  await browser.close().catch(() => {});
  process.exit(1);
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%"></div></body></html>');
const char = { name: fixture.name ?? '괴이', globalLore: fixture.globalLore, alternateGreetings: fixture.alternateGreetings ?? [], additionalAssets: [] };
await page.addScriptTag({ content: hostScript(char, { message: [], scriptstate: {} }) });
await page.addScriptTag({ content: `(async () => { ${plugin}\n })().catch(e => { window.__bootError = String(e); });` });
await page.waitForFunction(() => window.__calls.replacers.length || window.__bootError);
assert.equal(await page.evaluate(() => window.__bootError ?? null), null);
await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
await page.click('[x-goei-fab] button');
await page.waitForSelector('.gx-fac');
// 시작 전 설정 → 세계 편집
await page.click('[data-action="prefs-open"]');
// 2026-10-27: 설정은 창 하나. 시작 전 설정 단추도 그 창(설정 → 화면)을 연다
await page.waitForSelector('.gw .gw-win');
assert.ok(await page.$('.gw-set .gw-setbody .ps-group'), '설정 페이지(화면)');
assert.ok(await page.$('[data-action="ed-node"][data-value="set:gnet"]'), '설정 트리');
await page.click('[data-action="ed-node"][data-value="set:image"]');
await page.waitForSelector('.gw-set [data-action="set-asset"]');
await page.click('[data-action="ed-node"][data-value="agent"]');
if (shots) await page.screenshot({ path: `${shots}/ed-1-agents.png` });
assert.ok((await page.locator('.gw-row').count()) >= 55, '요원 목록');
await page.click('.gw-row:has-text("쟈알디")');
await page.waitForSelector('.gw-detail .gw-field');
assert.ok((await page.textContent('.gw-detail h2')).includes('쟈알디'));
assert.match(await page.textContent('.gw-tokens'), /토큰/);
// 칸 고치기 → 저장 상태가 바뀜 → 조립 글 보기
await page.fill('.gw-field textarea[data-key="agent|쟈알디|voice"]', '- 낮고 짧게.');
await page.waitForFunction(() => document.querySelector('.gw-save')?.classList.contains('dirty'));
await page.click('[data-action="ed-preview"]');
await page.waitForSelector('.gw-preview');
assert.match(await page.textContent('.gw-preview'), /#### Voice\n- 낮고 짧게\./);
if (shots) await page.screenshot({ path: `${shots}/ed-2-detail.png` });
// 추가 칸·순서
await page.fill('.gw [name="ed-extra-name"]', '취미');
await page.click('[data-action="ed-extra-add"]');
await page.waitForSelector('.gw-field.extra');
await page.click('.gw-field.extra [data-action="ed-field-up"]');
// 글로 가져오기
await page.click('[data-action="ed-import-toggle"]');
await page.fill('.gw-import textarea', '## Personality\n- 장난스럽다\n\n## Weapons\n- 식칼');
await page.click('[data-action="ed-import-parse"]');
await page.waitForSelector('.gw-map');
assert.ok((await page.textContent('.gw-map')).includes('성격'));
await page.click('[data-action="ed-import-apply"]');
await page.waitForFunction(() => document.querySelector('textarea[data-key="agent|쟈알디|character"]')?.value.includes('장난스럽다'));
// 세력 관계: 왼쪽 조직 목록 → 오른쪽에 「고른 조직 → 다른 조직」 줄마다 단계 (2026-10-27 새 레이아웃)
await page.click('[data-action="ed-node"][data-value="relations"]');
await page.waitForSelector('.gw-rel-rows');
await page.click('[data-action="ed-rel-pick"][data-value="극단"]');
await page.waitForFunction(() => document.querySelector('.gw-head h2')?.textContent?.startsWith('극단'));
assert.ok((await page.locator('.gw-rel-rows .gx-seg.on').count()) >= 2, '단계 줄이 있다');
await page.click('[data-action="ed-rel-set"][data-value="극단>병원:favorable"]');
await page.waitForFunction(() => document.querySelector('[data-action="ed-rel-set"][data-value="극단>병원:favorable"]')?.classList.contains('on'));
await page.click('[data-action="ed-rel-set"][data-value="극단>병원:hostile"]');
await page.waitForFunction(() => document.querySelector('[data-action="ed-rel-set"][data-value="극단>병원:hostile"]')?.classList.contains('on'));
await page.click('[data-action="ed-rel-pick"][data-value="병원"]');
await page.waitForFunction(() => document.querySelector('[data-action="ed-rel-set"][data-value="병원>극단:hostile"]')?.classList.contains('on'), null, { timeout: 5000 });
await page.click('[data-action="ed-rel-pick"][data-value="극단"]');
await page.fill('input[data-input="ed-rel-memo"][data-key="극단>병원"]', '피의 원수');
if (shots) await page.screenshot({ path: `${shots}/ed-3-relations.png` });
// 지침
// 지침은 그 기능의 설정 페이지 아래 (2026-10-27): RP·Directive 는 「본편 지침」
await page.click('[data-action="ed-node"][data-value="set:guides"]');
await page.waitForSelector('textarea[data-key="Directive|0"]');
assert.ok((await page.locator('.gw-guide-secs .gw-field-head b', { hasText: 'COMMON' }).count()) >= 1, '지침은 절 단위 글칸');
// 기능 설정 페이지: 괴담톡 설정 + Phone 지침이 한 페이지에, 설정 단추는 패널 처리기로 (범위 전환)
await page.click('[data-action="ed-node"][data-value="set:phone"]');
await page.waitForSelector('textarea[data-key="Phone|1"]');
await page.click('[data-action="ed-node"][data-value="set:screen"]');
await page.waitForSelector('.gw-set [data-action="set-theme"]');
await page.click('.gw-set [data-action="set-theme"][data-value="paper"]');
await page.waitForFunction(() => document.querySelector('.gw-set [data-action="set-theme"][data-value="paper"]')?.classList.contains('on'));
// 창 폭 설정: 70% → 창이 1400px 의 70% (980px)
await page.click('.gw-set [data-action="set-editor-width"][data-value="70"]');
await page.waitForFunction(() => Math.abs(document.querySelector('.gw-win').getBoundingClientRect().width - 980) < 4, null, { timeout: 5000 });
await page.click('.gw-set [data-action="set-editor-width"][data-value="90"]');
await page.waitForFunction(() => Math.abs(document.querySelector('.gw-win').getBoundingClientRect().width - 1260) < 4, null, { timeout: 5000 });
// 저장 → 카드 명부에 세계 덧쓰기
await page.click('[data-action="ed-save"]');
await page.waitForFunction(() => window.__calls.setChar >= 1);
const dir = await page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content));
assert.equal(dir.세계.agent['쟈알디'].fields.voice, '- 낮고 짧게.');
assert.ok(dir.세계.agent['쟈알디'].fields.character.includes('장난스럽다'));
assert.ok(dir.세계.agent['쟈알디'].extra.some((e) => e.name === '취미') && dir.세계.agent['쟈알디'].extra.some((e) => e.name === 'Weapons'));
assert.equal(dir.세계.relations.pairs['극단>병원'].stage, 'hostile');
assert.equal(dir.세계.relations.pairs['극단>병원'].memo, '피의 원수');
await page.waitForFunction(() => !document.querySelector('.gw-save')?.classList.contains('dirty'));
// 다시 읽어도 가상 로어북에 고친 글이 들어간다
const voice = await page.evaluate(async () => {
  const c = await window.risuai.getCharacterFromIndex(0);
  return c.globalLore.find((e) => e.comment === 'Directory') ? 'ok' : 'no';
});
assert.equal(voice, 'ok');
await page.click('[data-action="ed-close"]');
await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
assert.deepEqual(errors, []);
// 5단계: 설치 · 점검 (괴이 카드: 로어북·인사말 있음, 사진은 없음). 설정 패널의 「설치 · 점검」 단추로 다시 연다
await page.click('[data-action="prefs-open"]');
await page.waitForFunction(() => document.querySelector('.gw')?.hidden === false);
await page.click('[data-action="ed-node"][data-value="install"]');
await page.waitForSelector('.gw-install .gw-inst-list');
const inst = await page.textContent('.gw-install');
assert.ok(inst.includes('인사말') && inst.includes('카드 사진') && inst.includes('위키 기본 문서'), inst.slice(0, 300));
assert.ok((await page.locator('.gw-inst-no').count()) >= 1, '사진·아이콘은 ✗');
const setBefore = await page.evaluate(() => window.__calls.setChar);
await page.click('[data-action="ed-inst-all"]');
await page.waitForFunction(() => document.querySelector('.gw-install')?.textContent?.includes('끝났어요'), null, { timeout: 60000 });
assert.ok((await page.evaluate(() => window.__calls.setChar)) >= setBefore + 1, '설치 → 캐릭터 저장');
assert.equal(await page.evaluate(() => window.__char.alternateGreetings.length), 57, '있는 인사말은 늘지 않음');
assert.ok(await page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Plugin manifest').content).keys.settings.startsWith('\uf000folder:')), '매니페스트 폴더 key');
console.log('PASS 설치 · 점검: 상태 표 → 로어북·인사말 다시 맞추기');
console.log('PASS 세계 편집 창: 목록 → 칸 고치기 → 추가 칸·가져오기 → 세력 관계 → 지침 → 저장(Directory.세계)');
await browser.close();
