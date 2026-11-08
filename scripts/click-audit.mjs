// 눌러 보는 전수점검 (2026-11-08 사용자: 「전수점검을 수도 없이 시키는데 왜 못 잡냐」 → 코드 읽기 말고 실제로 눌러 보기).
// 점검하는 Claude가 쓰는 도구다. 실제 브라우저(PC·폰)에서 플러그인을 띄우고, 화면에 보이는 눌리는 것을 하나도 빼지 않고 사람처럼 누른다.
// 누를 때마다 앞·직후·뒤 캡처와 반응(오류, 창이 바로 닫힘, 반응 없음, 선택 표시 등)을 적고, 새로 열린 화면은 다시 그 안을 다 누른다.
// 모든 화면에서 같은 종류 단추·칸의 크기·색·글씨·간격·선택 표시를 재서 서로 다른 것(통일성)을 모은다.
// 판단(사용자 결정과 맞는지, 이상한지)은 이 도구가 하지 않는다. 점검하는 Claude가 report.md 와 캡처를 직접 보고 한다 (docs/눌러보기_전수점검.md).
//
// 사용법: node scripts/click-audit.mjs [옵션]          (npm run audit:click -- [옵션])
//   --vp pc,phone,land    화면 크기 (기본 pc,phone)
//   --start board,picker  어느 화면에서 시작하나 (기본 board,picker). board = 채팅 시작 뒤 상황판, picker = 시작 화면
//   --depth n             누른 뒤 새로 열린 화면을 몇 단계까지 따라 들어가나 (기본 6)
//   --per-action n        같은 data-action 의 값(data-value)이 많을 때(지역 250곳·위키 항목 등) 누를 값 수 (기본 5, 0 = 전부). 못 누른 값 수는 보고서 7절에 적는다
//   --explore-values n    같은 data-action 중 몇 개의 값까지 눌러서 열린 화면 안으로 따라 들어가나 (기본 2. 같은 꼴 화면이 수백 번 반복되는 것 막기)
//   --max-clicks n        화면 크기마다 최대로 누를 수 (기본 0 = 끝까지)
//   --workers n           동시에 띄울 페이지 수 (기본 4)
//   --out <폴더>          기록 폴더 (기본 .scratch/click-audit). 안에 report.md · report.json · shots/
//   --fixture <경로>      시험 카드 (기본 .scratch/fixture/fixture.json, 없으면 `npm run test:browser -- --only install` 로 먼저 만든다)
//   --only-scope <css>    이 선택자 안의 것만 누른다 (예: '.gx' 상황판 창만)
//   --report-only         누르지 않고 --out 폴더의 report.json(끊긴 것도)으로 report.md 만 다시 만든다
//   --from 'a|v>b|v'      시작 상태에서 이 열쇠들을 차례로 누른 화면부터 점검한다 (한 화면만 빨리 다시 볼 때. 열쇠는 report.md 의 `action|value`)
// 빌드(dist/)가 있어야 한다: npm run build
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, VIEWPORTS, isPhoneVp } from '../tests/qc-settings-harness.mjs';
import { distPack } from '../tests/data-init.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const opt = { vp: ['pc', 'phone'], start: ['board', 'picker'], depth: 6, perAction: 5, exploreValues: 2, maxClicks: 0, workers: 4, out: '.scratch/click-audit', fixture: '.scratch/fixture/fixture.json', scope: '', from: [] };
{
  const a = process.argv.slice(2);
  const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = () => a[++i];
    if (k === '--vp') opt.vp = list(v());
    else if (k === '--start') opt.start = list(v());
    else if (k === '--depth') opt.depth = Number(v());
    else if (k === '--per-action') opt.perAction = Number(v());
    else if (k === '--explore-values') opt.exploreValues = Number(v());
    else if (k === '--max-clicks') opt.maxClicks = Number(v());
    else if (k === '--workers') opt.workers = Number(v());
    else if (k === '--out') opt.out = v();
    else if (k === '--fixture') opt.fixture = v();
    else if (k === '--report-only') opt.reportOnly = true;
    else if (k === '--only-scope') opt.scope = v();
    else if (k === '--from') opt.from = v().split('>').map((x) => x.trim()).filter(Boolean).map((key) => ({ key, nth: 0 }));
    else if (k === '-h' || k === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
    else throw new Error(`모르는 옵션: ${k}`);
  }
}
const OUT = resolve(ROOT, opt.out);
const SHOTS = resolve(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });
if (!existsSync(resolve(ROOT, 'dist/goei-plugin.js'))) throw new Error('dist/ 가 없어요: npm run build 먼저');
if (!existsSync(resolve(ROOT, opt.fixture))) throw new Error(`시험 카드가 없어요: ${opt.fixture} (npm run test:browser -- --only install 로 만들기)`);
const fx = loadFixture(resolve(ROOT, opt.fixture));
const LOOKS = distPack('goei-data-looks');
const ITEMS = (() => { try { return distPack('goei-data-items'); } catch { return null; } })();
const log = (...m) => console.log('[click-audit]', ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 시작 상태 만들기 ------------------------------------------------------------------------------------------
// 상황판: 시작 화면에서 실제로 소속·상황을 골라 출발하고, 괴이·사건이 생기는 응답 하나를 넣는다. 그 채팅·저장소를 그대로 떠 두고
// 누를 때마다 새 페이지에 넣어 띄운다(앞에서 누른 것이 다음 누르기에 섞이지 않게).
const STATUS = '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
const KEEP_OUT = new Set(['p:goei:body', 'p:goei:data-world']); // hostScript 가 넣는다

async function settle(page) {
  // 설치 안내로 설정 창이 저절로 열렸으면: 사람이 하듯 「설치」를 누르고 닫는다
  await sleep(300);
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => document.querySelector('.gw')?.hidden === false);
    if (!open) break;
    await closeEditor(page, true).catch(() => {});
    await sleep(200);
  }
}

async function makeBase(browser, vp, kind) {
  const store0 = { 'p:goei:data-looks': LOOKS, ...(ITEMS ? { 'p:goei:data-items': ITEMS } : {}) };
  const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, vp, { store: store0 });
  await openWin(page);
  // 첫 실행 설치: 「설치」 단추를 눌러 둔다 (실제 사용자는 설치하고 쓴다)
  await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) {
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-tab"][data-value="manage"]')?.click());
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-node"][data-value="install"]')?.click());
    await sleep(200);
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-inst-all"]')?.click());
    await sleep(1500);
  }
  await settle(page);
  if (kind === 'board') {
    await page.waitForSelector('.gx-fac');
    await page.evaluate(() => document.querySelector('.gx-fac[data-value="A00"]').click());
    await page.evaluate(() => document.querySelector('.gx-sc[data-value="2"]')?.click());
    await page.waitForFunction(() => !document.querySelector('.gx-start')?.disabled, null, { timeout: 5000 });
    const n = await page.evaluate(() => window.__calls.setChat.length);
    await page.evaluate(() => document.querySelector('.gx-start').click());
    await page.waitForFunction((n) => window.__calls.setChat.length > n, n);
    await sleep(400);
    // 첫 요청에 플러그인이 넣는 「NEW [AN|…]」 자리를 그대로 채워 답한다 → 괴이·사건·특수가 실제로 상황판에 생긴다
    await page.evaluate(async (status) => {
      window.__chat.message.push({ role: 'user', data: '출동', chatId: 'u1' });
      const out = JSON.stringify(await window.__calls.replacers[0]([{ role: 'system', content: 'x' }, { role: 'user', content: '출동' }], 'model'));
      const fill = { '<발생지점>': 'QC 지점', '<등급>': 'B', '<배치>': '없음', '<상황>': '소란', '<방문자>': '없음', '<상태>': '대기' };
      const tags = [...new Set((out.match(/NEW \[(?:AN|IN|MS)\|[^\]]*\]/g) || []).map((t) => t.slice(4).replace(/<[^>|]+>/g, (m) => fill[m] ?? 'QC')))];
      window.__caReply = ['첫 답. 쟈알디가 손을 흔들었다.', ...tags, status].join('\n');
    }, STATUS);
    await page.evaluate(async () => {
      const reply = window.__caReply;
      window.__chat.message.push({ role: 'char', data: reply, chatId: 'c1' });
      await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(window.__chat)), characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
    });
    await sleep(300);
  }
  const base = await page.evaluate((keep) => ({ chat: window.__chat, char: window.__char, store: Object.fromEntries(Object.entries(window.__store).filter(([k]) => !keep.includes(k))) }), [...KEEP_OUT]);
  await page.close();
  if (errors.length) log(`${vp}/${kind} 시작 상태 만들 때 오류`, errors);
  return base;
}

async function openFrom(browser, vp, base) {
  const { page, errors } = await boot(browser, { ...fx, fixture: base.char }, base.chat, vp, { store: base.store });
  page.on('dialog', (d) => { errors.push(`(대화상자 ${d.type()}) ${d.message()}`); d.accept().catch(() => {}); });
  page.on('filechooser', () => {});
  await openWin(page);
  await settle(page);
  await page.waitForTimeout(200);
  return { page, errors };
}

// ---- 페이지 안에서 쓰는 것 --------------------------------------------------------------------------------------
// 눌리는 것: data-action 있는 것 전부 + button/summary/[role=button]/label(체크) 중 data-action 없는 것.
// 열쇠(key) = data-action|data-value (없으면 tag.첫클래스|글자). 같은 열쇠가 여럿이면 n번째로 찾는다.
const PAGE_LIB = `
window.__ca = (() => {
  const SKIP = '#other, .default-chat-screen > #other';
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01; };
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.querySelector?.('img')?.alt || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const cls1 = (el) => [...el.classList].filter((c) => !/^(on|sel|active|open|primary|danger|has-|k-|none$)/.test(c))[0] || '';
  const keyOf = (el) => el.dataset.action ? el.dataset.action + '|' + (el.dataset.value ?? '') : el.tagName.toLowerCase() + '.' + cls1(el) + '|' + label(el);
  const clickables = (scope) => {
    const root = scope ? document.querySelectorAll(scope) : [document.body];
    const out = [];
    for (const r of root) for (const el of r.querySelectorAll('[data-action], button, summary, [role=button], label:has(> input[type=checkbox]), input[type=checkbox], input[type=radio], select')) {
      if (el.closest(SKIP)) continue;
      if (el.matches('[data-action] *') && !el.matches('[data-action]') && el.closest('[data-action]') && !el.matches('button, summary, input, select')) continue;
      if (!el.dataset.action && el.closest('[data-action]') && el.closest('[data-action]') !== el) continue; // 안쪽 장식
      out.push(el);
    }
    return out;
  };
  const hit = (el) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2);
    const top = document.elementFromPoint(x, y);
    return { x, y, ok: !!top && (top === el || el.contains(top) || top.contains(el) && top.closest('label') === el.closest('label')), top: top ? top.tagName.toLowerCase() + '.' + [...top.classList].slice(0, 2).join('.') : '' };
  };
  const list = (scope) => {
    const seen = {};
    return clickables(scope).filter(vis).map((el) => {
      const key = keyOf(el); const nth = (seen[key] = (seen[key] ?? -1) + 1);
      const r = el.getBoundingClientRect();
      // 다른 창(설정 창 등) 뒤에 깔린 것은 지금 화면의 단추가 아니다 → behind. 눌리는 것끼리 겹쳐 가린 것은 문제이므로 그대로 둔다
      let behind = false;
      if (r.top < innerHeight && r.bottom > 0) { const h = hit(el); if (!h.ok) { const top = document.elementFromPoint(h.x, h.y); const LAYER = '.gw, .gx-agpop, .gx-idpop, [role=dialog], [class*="pop"], [class*="drawer"], [class*="modal"], [class*="sheet"]'; const tl = top?.closest(LAYER); behind = !!top && ((!!tl && !tl.contains(el)) || !top.closest('[data-action], button, summary, [role=button], label, input, select, a')); } }
      return { key, nth, behind, action: el.dataset.action || '', value: el.dataset.value ?? '', tag: el.tagName.toLowerCase(), cls: cls1(el), label: label(el), disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true', rect: [r.left, r.top, r.width, r.height].map(Math.round) };
    });
  };
  const find = (key, nth, scope) => { const seen = {}; for (const el of clickables(scope)) { if (!vis(el)) continue; const k = keyOf(el); const i = (seen[k] = (seen[k] ?? -1) + 1); if (k === key && i === nth) return el; } return null; };
  const containerOf = (el) => el.closest('[role=dialog], .gx-agpop, .gx-idpop, [class*="pop"], [class*="drawer"], [class*="modal"], .gw-win, .gw, .gx-panel, .gx') || document.body;
  const pathOf = (el) => { const a = []; for (let e = el; e && e !== document.body && a.length < 6; e = e.parentElement) a.push(e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')); return a.reverse().join(' > '); };
  // 화면 표지: 보이는 열쇠 집합 + 창 상태
  const sig = (scope) => { const ks = list(scope).map((x) => x.key + '#' + x.nth); const gx = document.querySelector('.gx'); const gw = document.querySelector('.gw'); return { keys: ks, gx: !!gx && gx.style.display !== 'none', gw: !!gw && !gw.hidden, html: (document.querySelector('.gx')?.innerHTML.length ?? 0) + ':' + (document.querySelector('.gw')?.innerHTML.length ?? 0) + ':' + document.body.childElementCount }; };
  // 누르기 직전 감시: 누른 것과 그것을 담은 창이 언제 사라지는지, 누른 것의 class/aria 가 언제 바뀌는지
  const watch = (el, nth) => {
    const t0 = performance.now();
    const box = containerOf(el);
    const rec = { boxPath: pathOf(box), elGone: null, boxGone: null, elClass: [], boxClass: [], mutations: 0, firstMut: null, before: { elCls: el.className, aria: el.getAttribute('aria-pressed') ?? el.getAttribute('aria-selected') ?? el.getAttribute('aria-expanded') } };
    // 다시 그리기(innerHTML 바꿈)로 같은 창이 새 노드가 되는 건 닫힘이 아니다 → 창은 선택자로, 누른 것은 열쇠로 찾는다
    const boxSel = box === document.body ? 'body' : box.tagName.toLowerCase() + [...box.classList].filter((c) => !/^(on|sel|active|open|show|in|out|closing)$/.test(c)).map((c) => '.' + CSS.escape(c)).join('');
    const elKey = keyOf(el);
    const goneBox = () => ![...document.querySelectorAll(boxSel)].some(vis);
    const goneEl = () => ![...document.querySelectorAll(el.dataset.action ? '[data-action="' + CSS.escape(el.dataset.action) + '"]' : el.tagName)].some((e) => vis(e) && keyOf(e) === elKey);
    const gone = (n) => n === box ? goneBox() : goneEl();
    const mo = new MutationObserver((ms) => {
      const t = Math.round(performance.now() - t0);
      rec.mutations += ms.length; if (rec.firstMut == null) rec.firstMut = t; rec.lastMut = t;
      for (const m of ms) {
        if (m.type === 'attributes' && m.target === el) rec.elClass.push([t, m.attributeName, el.getAttribute(m.attributeName)]);
        if (m.type === 'attributes' && m.target === box) rec.boxClass.push([t, m.attributeName, String(box.getAttribute(m.attributeName)).slice(0, 80)]);
      }
      if (rec.elGone == null && gone(el)) rec.elGone = t;
      if (rec.boxGone == null && gone(box)) rec.boxGone = t;
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-pressed', 'aria-selected', 'aria-expanded', 'open'] });
    // 애니메이션으로 사라지는 것도 잡게 잠깐 동안 프레임마다 본다
    let frames = 0;
    const tick = () => { const t = Math.round(performance.now() - t0); if (rec.elGone == null && gone(el)) rec.elGone = t; if (rec.boxGone == null && gone(box)) rec.boxGone = t; if (++frames < 90) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__caWatch = { rec, stop: () => { mo.disconnect(); if (!el.isConnected) { const n2 = find(elKey, nth, null) || find(elKey, 0, null); if (n2) el = n2; } const s = el.isConnected ? getComputedStyle(el) : null; rec.after = { elCls: el.isConnected ? el.className : null, aria: el.getAttribute('aria-pressed') ?? el.getAttribute('aria-selected') ?? el.getAttribute('aria-expanded'), style: s && styleOf(el) }; return rec; } };
    return rec.boxPath;
  };
  const styleOf = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), font: s.fontSize, weight: s.fontWeight, family: s.fontFamily.split(',')[0].trim(), color: s.color, bg: s.backgroundColor, border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor, radius: s.borderTopLeftRadius, pad: s.paddingTop + ' ' + s.paddingRight, outline: s.outlineStyle === 'none' ? 'none' : s.outlineWidth + ' ' + s.outlineColor, shadow: s.boxShadow === 'none' ? 'none' : s.boxShadow.slice(0, 60), lh: s.lineHeight, align: s.textAlign }; };
  // 화면 점검: 화면 밖으로 나감, 글자 잘림, 눌리는 것끼리 겹침, 작은 누름 칸
  const audit = (scope) => {
    const W = innerWidth, H = innerHeight;
    const els = clickables(scope).filter(vis);
    const off = [], cut = [], overlap = [], small = [];
    const roots = scope ? [...document.querySelectorAll(scope)] : [document.querySelector('.gx'), document.querySelector('.gw')].filter(Boolean);
    for (const root of roots) for (const el of root.querySelectorAll('*')) {
      if (!vis(el) || el.closest('.gx-mclose')) continue;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if ((r.right > W + 1 || r.left < -1) && s.position !== 'fixed' && !el.closest('[style*="translate"]')) { if (off.length < 30) off.push(pathOf(el) + ' ' + Math.round(r.left) + '~' + Math.round(r.right)); }
      if (el.childElementCount === 0 && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) && s.overflow !== 'visible' && s.overflowX !== 'auto' && s.overflowY !== 'auto' && s.overflowX !== 'scroll') {
        if (cut.length < 40) cut.push({ path: pathOf(el), text: el.textContent.trim().slice(0, 30), ellipsis: s.textOverflow === 'ellipsis', sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight });
      }
    }
    const rs = els.map((el) => [el, el.getBoundingClientRect()]);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const [a, ra] = rs[i], [b, rb] = rs[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ix > 2 && iy > 2 && overlap.length < 30) overlap.push([keyOf(a), keyOf(b), Math.round(ix) + '×' + Math.round(iy)]);
    }
    for (const [el, r] of rs) if ((r.width < 32 || r.height < 32) && small.length < 60) small.push([keyOf(el), Math.round(r.width) + '×' + Math.round(r.height)]);
    const styles = els.map((el) => ({ key: keyOf(el), kind: el.tagName.toLowerCase() + '.' + cls1(el), sel: el.classList.contains('on') || el.classList.contains('sel') || el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true', label: label(el), s: styleOf(el) }));
    return { off, cut, overlap, small, styles, pageOver: document.scrollingElement.scrollWidth - W };
  };
  const mark = (el) => { const r = el.getBoundingClientRect(); const d = document.createElement('div'); d.id = '__caMark'; d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:3px solid #ff2d55;box-shadow:0 0 0 2px #fff;border-radius:4px;left:' + (r.left - 3) + 'px;top:' + (r.top - 3) + 'px;width:' + (r.width) + 'px;height:' + (r.height) + 'px'; document.body.appendChild(d); };
  const unmark = () => document.getElementById('__caMark')?.remove();
  return { list, find, sig, watch, audit, mark, unmark, label, keyOf };
})();`;

// ---- 한 번 누르기 ------------------------------------------------------------------------------------------------
// 새 페이지 → 시작 상태 → path(앞서 누른 것들)를 다시 누름 → target 을 누르고 기록
async function pressStep(page, step, touch) {
  const info = await page.evaluate(([k, n, sc]) => { const el = window.__ca.find(k, n, sc); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled, pe: s.pointerEvents }; }, [step.key, step.nth, opt.scope]);
  if (!info) return { ok: false, why: '못 찾음' };
  const h = await page.evaluate(([k, n, sc]) => { const el = window.__ca.find(k, n, sc); const r = el.getBoundingClientRect(); const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2); const top = document.elementFromPoint(x, y); return { x, y, ok: !!top && (top === el || el.contains(top) || (el.tagName === 'INPUT' && top.closest('label')?.contains(el))), top: top ? top.tagName.toLowerCase() + '.' + [...top.classList].slice(0, 2).join('.') + (top.dataset?.action ? '[' + top.dataset.action + ']' : '') : '' }; }, [step.key, step.nth, opt.scope]);
  if (!h.ok) return { ok: false, why: `가려짐(위에 ${h.top})`, x: h.x, y: h.y };
  if (touch) await page.touchscreen.tap(h.x, h.y); else await page.mouse.click(h.x, h.y);
  return { ok: true, x: h.x, y: h.y };
}


// 화면이 0.4초 동안 안 바뀔 때까지 기다린다(최대 4초). 임무 고르기처럼 효과 1.5초 뒤 다음 화면으로 넘어가는 것을 앞 단계로 다시 누를 때 필요
async function quiet(page, still = 400, max = 4000) {
  await page.evaluate(() => { if (window.__caQuiet) return; window.__caQuiet = { t: performance.now() }; new MutationObserver(() => { window.__caQuiet.t = performance.now(); }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
  await page.evaluate(() => { window.__caQuiet.t = performance.now(); });
  const t0 = Date.now();
  await sleep(150);
  while (Date.now() - t0 < max) { const idle = await page.evaluate(() => performance.now() - window.__caQuiet.t); if (idle >= still) return; await sleep(100); }
}

async function prepPage(browser, vp, base, path) {
  const { page, errors } = await openFrom(browser, vp, base);
  await page.addScriptTag({ content: PAGE_LIB });
  const touch = !!VIEWPORTS[vp].touch;
  for (const st of path) {
    const r = await pressStep(page, st, touch);
    if (!r.ok) return { page, errors, fail: `앞 단계 「${st.key}」 ${r.why}` };
    await quiet(page);
  }
  return { page, errors };
}

const fname = (s) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);

async function clickJob(browser, vp, startKind, base, job, idx) {
  const rec = { vp, start: startKind, path: job.path.map((p) => p.key + (p.nth ? '#' + p.nth : '')), key: job.key, nth: job.nth, label: job.label, action: job.action, value: job.value, flags: [] };
  // 띄우기가 (부하로) 실패하면 한 번 더. 그래도 안 되면 기록만 하고 넘어간다 (한 건 때문에 전체가 멈추지 않게)
  let prep = null;
  for (let tries = 0; tries < 2 && !prep; tries++) { try { prep = await prepPage(browser, vp, base, job.path); } catch (e) { rec.note = '띄우기 실패: ' + String(e?.message || e).trim().slice(0, 200); } }
  if (!prep) { rec.flags.push('도구 오류'); return rec; }
  const { page, errors, fail } = prep;
  try {
    if (fail) { rec.flags.push('재현 실패'); rec.note = fail; return rec; }
    const touch = !!VIEWPORTS[vp].touch;
    const before = await page.evaluate((sc) => window.__ca.sig(sc), opt.scope);
    const store0 = await page.evaluate(() => ({ setChat: window.__calls.setChat.length, setStore: (window.__calls.setStore || []).length, llm: (window.__calls.llm || []).length, send: (window.__calls.send || []).length, hide: window.__calls.hide }));
    const tag = `${vp}_${String(idx).padStart(4, '0')}_${fname(job.key)}`;
    const ok = await page.evaluate(([k, n, sc]) => { const el = window.__ca.find(k, n, sc); if (!el) return false; el.scrollIntoView({ block: 'center', behavior: 'instant' }); window.__ca.mark(el); return true; }, [job.key, job.nth, opt.scope]);
    if (!ok) { rec.flags.push('못 찾음'); return rec; }
    await page.screenshot({ path: `${SHOTS}/${tag}_1앞.png` });
    await page.evaluate(() => window.__ca.unmark());
    rec.box = await page.evaluate(([k, n, sc]) => window.__ca.watch(window.__ca.find(k, n, sc), n), [job.key, job.nth, opt.scope]);
    const nErr = errors.length;
    const pr = await pressStep(page, job, touch);
    if (!pr.ok) { rec.flags.push(pr.why.startsWith('가려짐') ? '가려져 못 누름' : pr.why); rec.note = pr.why; await page.evaluate(() => window.__caWatch?.stop()); return rec; }
    await sleep(140);
    await page.screenshot({ path: `${SHOTS}/${tag}_2직후.png` });
    await sleep(900);
    await page.screenshot({ path: `${SHOTS}/${tag}_3뒤.png` });
    rec.shots = [`${tag}_1앞.png`, `${tag}_2직후.png`, `${tag}_3뒤.png`];
    // 1초 뒤에도 화면이 움직이면(효과·닫힘 애니메이션) 0.5초 동안 멈출 때까지(최대 5초) 기다려 「끝」을 한 장 더 찍는다
    const still = async () => page.evaluate(() => { const r = window.__caWatch.rec; return r.lastMut ?? 0; });
    let moved = false;
    for (let t = 1040; t < 5000; t += 250) { const lm = await still(); if (lm < t - 500) break; moved = true; await sleep(250); }
    if (moved) { await page.screenshot({ path: `${SHOTS}/${tag}_4끝.png` }); rec.shots.push(`${tag}_4끝.png`); }
    const w = await page.evaluate(() => window.__caWatch.stop());
    const after = await page.evaluate((sc) => window.__ca.sig(sc), opt.scope);
    const store1 = await page.evaluate(() => ({ setChat: window.__calls.setChat.length, setStore: (window.__calls.setStore || []).length, llm: (window.__calls.llm || []).length, send: (window.__calls.send || []).length, hide: window.__calls.hide }));
    rec.watch = w;
    rec.errors = errors.slice(nErr);
    const bk = new Set(before.keys), ak = new Set(after.keys);
    rec.appeared = [...ak].filter((k) => !bk.has(k));
    rec.vanished = [...bk].filter((k) => !ak.has(k));
    rec.saved = { chat: store1.setChat - store0.setChat, store: store1.setStore - store0.setStore, model: store1.llm - store0.llm, send: store1.send - store0.send };
    rec.win = { before: { gx: before.gx, gw: before.gw }, after: { gx: after.gx, gw: after.gw } };
    rec.before = { gx: before.gx, gw: before.gw, html: before.html }; rec.after = { gx: after.gx, gw: after.gw, html: after.html };
    rec.flags.push(...flagsOf(rec));
    rec.selStyle = w.after?.style || null;
    rec.selChanged = w.after && (w.after.elCls !== w.before.elCls || w.after.aria !== w.before.aria) ? { from: [w.before.elCls, w.before.aria], to: [w.after.elCls, w.after.aria] } : null;
    // 새로 열린 화면이면 그 안을 따라 들어간다
    rec.audit = rec.appeared.length ? await page.evaluate((sc) => window.__ca.audit(sc), opt.scope) : null;
    rec.newList = rec.appeared.length ? await page.evaluate((sc) => window.__ca.list(sc), opt.scope) : null;
  } catch (e) {
    rec.flags.push('도구 오류'); rec.note = String(e?.message || e).slice(0, 300);
  } finally {
    await page.close().catch(() => {});
  }
  return rec;
}


// 이상 반응 표시 (판단 아님, 점검하는 Claude가 캡처로 확인할 곳). --report-only 때도 기록(watch)으로 다시 계산한다
function flagsOf(rec) {
  const f = [], w = rec.watch; if (!w) return f;
  const label = rec.label || '';
  if (rec.errors?.length) f.push('오류');
  const closeish = /(^|-)(close|x|cancel|back|no|hide|skip|drop|del|delete|keep)(-|$)|^close$|^game-close$/.test(rec.action || '') || /닫기|취소|뒤로|접기|×|✕/.test(label);
  const s = rec.saved || {};
  const changed = rec.appeared?.length || rec.vanished?.length || rec.before?.html !== rec.after?.html || w.mutations > 0 || s.chat || s.store || s.model || s.send;
  if (!changed) f.push('반응 없음');
  const moved = (rec.appeared?.length ?? 0) > 0; // 다른 화면으로 넘어감
  if (rec.before?.gx && !rec.after?.gx && !closeish) f.push('상황판 창이 닫힘');
  else if (rec.before?.gw && !rec.after?.gw && !closeish) f.push('설정 창이 닫힘');
  else if (w.boxGone != null && !closeish && !moved) f.push(`누르자 창이 닫힘(${w.boxGone}ms)`);
  else if (w.elGone != null && w.elGone < 400 && !closeish && !moved) f.push(`누른 것이 바로 사라짐(${w.elGone}ms)`);
  // 누른 것에 표시(선택·효과)가 붙었는데 그것이 보일 틈 없이(0.3초 안에) 사라지거나 창이 닫힘 — 2026-11-08 임무 고르기·해제 문제의 꼴
  if (w.elClass?.length) {
    const firstFx = w.elClass[0][0];
    const goneAt = Math.min(w.elGone ?? Infinity, w.boxGone ?? Infinity);
    if (goneAt !== Infinity && goneAt - firstFx < 300) f.push(`효과가 보일 틈 없이 사라짐(효과 ${firstFx}ms → 사라짐 ${goneAt}ms)`);
    const last = w.elClass.at(-1);
    if (w.after && w.after.elCls === w.before.elCls && w.after.aria === w.before.aria && w.elClass.length >= 2) f.push(`표시가 잠깐 바뀌었다 돌아감(${firstFx}~${last[0]}ms)`);
  }
  return f;
}

// ---- 돌리기 ------------------------------------------------------------------------------------------------------
const results = [];
const skippedVals = {};
const states = []; // { vp, start, path, shot, audit }
const t0 = Date.now();
if (opt.reportOnly) { const j = JSON.parse(readFileSync(resolve(OUT, 'report.json'), 'utf8')); for (const r of j.results) if (r.watch) r.flags = [...r.flags.filter((x) => /재현 실패|못 찾음|가려져|꺼진|안 눌림|도구 오류/.test(x)), ...flagsOf(r)];
  results.push(...j.results); states.push(...j.states); opt.vp = j.opt.vp; opt.start = j.opt.start; opt.depth = j.opt.depth; }
const browser = opt.reportOnly ? null : await launch();
for (const vp of opt.reportOnly ? [] : opt.vp) {
  // 누른 열쇠는 화면 크기마다 하나로 센다: 시작 화면에서 출발해 상황판에 들어가도 이미 누른 것은 다시 안 누른다
  const done = new Set();
  const perAct = {};
  const offSeen = new Set();
  const exploredVals = {};
  for (const startKind of opt.start) {
    log(`${vp} · ${startKind} 시작 상태 만드는 중`);
    const base = await makeBase(browser, vp, startKind);
    // 첫 화면
    const { page, fail: fromFail } = await prepPage(browser, vp, base, opt.from);
    if (fromFail) throw new Error(`--from 재현 실패: ${fromFail}`);
    const first = await page.evaluate((sc) => window.__ca.list(sc), opt.scope);
    const audit0 = await page.evaluate((sc) => window.__ca.audit(sc), opt.scope);
    const s0 = `${vp}_${startKind}_화면0.png`;
    await page.screenshot({ path: `${SHOTS}/${s0}`, fullPage: false });
    await page.close();
    states.push({ vp, start: startKind, path: opt.from.map((p) => p.key), shot: s0, audit: audit0 });
    const queue = [];
    const enqueue = (path, list) => {
      for (const it of list) {
        if (done.has(it.key)) continue;
        if (it.behind) continue; // 다른 창 뒤: 그 창을 닫은 화면에서 누른다
        // 꺼진 단추는 기록만 하고 누른 것으로 치지 않는다 (다른 화면에서 켜지면 그때 누른다)
        if (it.disabled) { if (!offSeen.has(it.key)) { offSeen.add(it.key); results.push({ vp, start: startKind, path: path.map((p) => p.key), key: it.key, label: it.label, action: it.action, value: it.value, flags: ['꺼진 단추(누를 수 없음)'], disabled: true }); } continue; }
        if (opt.perAction && it.action) { perAct[it.action] = (perAct[it.action] || 0) + 1; if (perAct[it.action] > opt.perAction) { skippedVals[it.action] = (skippedVals[it.action] || 0) + 1; continue; } }
        done.add(it.key);
        queue.push({ ...it, path });
      }
    };
    enqueue(opt.from, first);
    let n = 0;
    while (queue.length) {
      const batch = queue.splice(0, opt.workers);
      const recs = await Promise.all(batch.map((job, i) => clickJob(browser, vp, startKind, base, job, results.length + i + 1)));
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i], job = batch[i];
        results.push(rec);
        n++;
        const ev = job.action ? (exploredVals[job.action] = (exploredVals[job.action] || 0) + 1) : 1;
        if (rec.newList && job.path.length + 1 < opt.depth && (!opt.exploreValues || ev <= opt.exploreValues)) {
          const step = { key: job.key, nth: job.nth };
          const path = [...job.path, step];
          states.push({ vp, start: startKind, path: path.map((p) => p.key), shot: rec.shots?.[2], audit: rec.audit });
          enqueue(path, rec.newList);
        }
        if (rec.flags.length) log(`  ${vp} ${rec.key} → ${rec.flags.join(', ')}`);
      }
      log(`${vp} · ${startKind}: ${n}번 누름, 남은 ${queue.length} (${Math.round((Date.now() - t0) / 1000)}초)`);
      if (opt.maxClicks && n >= opt.maxClicks) { log(`--max-clicks ${opt.maxClicks} 에서 멈춤, 남은 ${queue.length}개는 「안 눌림」`); for (const q of queue) results.push({ vp, start: startKind, path: q.path.map((p) => p.key), key: q.key, label: q.label, action: q.action, value: q.value, flags: ['안 눌림(상한)'] }); queue.length = 0; }
      writeFileSync(resolve(OUT, 'report.json'), JSON.stringify({ opt, results, states, skippedVals }, null, 1));
    }
  }
}
await browser?.close();

// ---- 통일성 ------------------------------------------------------------------------------------------------------
// 같은 종류(태그.첫클래스) 끼리 크기·글씨·색·테두리·모서리·안쪽 여백이 몇 가지로 갈리는지. 선택된 것과 아닌 것은 따로 본다.
const PROPS = ['h', 'font', 'weight', 'family', 'color', 'bg', 'border', 'radius', 'pad', 'lh'];
const groups = {};
for (const st of states) for (const s of st.audit?.styles || []) {
  const g = (groups[`${st.vp}|${s.kind}|${s.sel ? '선택됨' : '보통'}`] ||= { n: 0, props: {} });
  // 같은 단추가 여러 화면에 나와도 한 번으로 센다 (어느 화면에서 처음 봤는지만 붙인다)
  (g.keys ||= new Set()).add(s.key);
  for (const p of PROPS) { const v = s.s[p]; const m = ((g.props[p] ||= {})[v] ||= new Map()); if (!m.has(s.key)) m.set(s.key, st.path.at(-1) || st.start); }
}
const incons = [];
for (const [k, g] of Object.entries(groups)) {
  const diff = Object.entries(g.props).filter(([, vs]) => Object.keys(vs).length > 1);
  if (diff.length) incons.push({ group: k, n: g.keys.size, diff: diff.map(([p, vs]) => ({ prop: p, values: Object.entries(vs).map(([v, m]) => ({ v, n: m.size, ex: [...m].slice(0, 4).map(([key, at]) => `${key} @${at}`) })).sort((a, b) => b.n - a.n) })) });
}
// 선택 표시: 눌렀을 때 선택 상태가 생긴 것들의 모양을 모은다 (테두리·바탕·그림자·외곽선)
const selLooks = {};
for (const r of results) if (r.selChanged && r.selStyle) { const s = r.selStyle; const look = `테두리 ${s.border} · 바탕 ${s.bg} · 그림자 ${s.shadow} · 외곽선 ${s.outline}`; (selLooks[`${r.vp}|${look}`] ||= []).push(r.key); }
// 이름: 같은 data-action 인데 글자가 다른 것 / 같은 글자인데 data-action 이 다른 것
const byAct = {}, byLabel = {};
for (const r of results) { if (r.action && r.label) (byAct[r.action] ||= new Set()).add(r.label); if (r.label && r.action) (byLabel[r.label] ||= new Set()).add(r.action); }
// PC·폰 차이: 한쪽에서만 보인 열쇠
const keysBy = {}; for (const r of results) (keysBy[r.vp] ||= new Set()).add(r.key);

// 코드에 있는 data-action 전부(글자 그대로 적힌 것) → 한 번도 못 누른 것
const srcActs = new Set();
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|js)$/.test(f)) for (const m of readFileSync(p, 'utf8').matchAll(/data-action="([a-zA-Z0-9_:-]+)"/g)) srcActs.add(m[1]); } };
walk(resolve(ROOT, 'src'));
const pressedActs = {}; for (const r of results) if (r.action && r.shots) (pressedActs[r.action] ||= new Set()).add(r.vp);
const never = [...srcActs].filter((a) => !pressedActs[a]).sort();

// ---- 보고서 ------------------------------------------------------------------------------------------------------
const L = [];
const rel = (p) => relative(OUT, resolve(SHOTS, p));
L.push(`# 눌러 보기 전수점검 기록`, '', `- 만든 때: ${new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16)} KST · 걸린 시간 ${Math.round((Date.now() - t0) / 60000)}분`, `- 화면 크기: ${opt.vp.join(', ')} · 시작: ${opt.start.join(', ')} · 깊이 ${opt.depth}`, `- 누른 수: ${results.filter((r) => r.shots).length} · 화면 수: ${states.length}`, '');
L.push('이 기록은 사실만 적는다. 이상한지·사용자 결정과 맞는지는 점검하는 Claude가 캡처를 열어 보고 판단한다 (docs/눌러보기_전수점검.md).', '');
L.push('## 1. 이상 반응 (캡처 확인할 곳)', '');
const flagged = results.filter((r) => r.flags.length && !r.disabled);
const byFlag = {};
for (const r of flagged) for (const f of r.flags) (byFlag[f.replace(/\(\d+ms\)|\(\d+~\d+ms\)/, '')] ||= []).push(r);
for (const [f, rs] of Object.entries(byFlag)) {
  L.push(`### ${f} (${rs.length})`, '');
  for (const r of rs) L.push(`- [${r.vp}] \`${r.key}\` 「${r.label}」 · 길: ${r.path.length ? r.path.join(' → ') : r.start}${r.flags.length > 1 ? ' · 함께: ' + r.flags.filter((x) => !x.startsWith(f)).join(', ') : ''}${r.errors?.length ? '\n  - 오류: ' + r.errors.slice(0, 3).join(' / ').slice(0, 300) : ''}${r.note ? '\n  - ' + r.note : ''}${r.shots ? '\n  - 캡처: ' + r.shots.map(rel).join(' · ') : ''}`);
  L.push('');
}
L.push('## 2. 선택 표시 모양 (눌러서 선택 상태가 생긴 것)', '');
for (const [k, ks] of Object.entries(selLooks)) L.push(`- [${k.split('|')[0]}] ${k.split('|')[1]} — ${[...new Set(ks)].slice(0, 12).join(', ')}${ks.length > 12 ? ` 외 ${ks.length - 12}` : ''}`);
L.push('', '## 3. 통일성: 같은 종류인데 모양이 갈리는 것', '');
for (const g of incons.sort((a, b) => b.n - a.n)) {
  L.push(`### ${g.group.replace(/\|/g, ' · ')} (${g.n}개)`);
  for (const d of g.diff) L.push(`- ${d.prop}: ` + d.values.map((v) => `**${v.v}** ×${v.n} (${v.ex.join(', ')})`).join(' / '));
  L.push('');
}
L.push('## 4. 이름', '');
for (const [a, ls] of Object.entries(byAct)) if (ls.size > 1 && ls.size < 6) L.push(`- 같은 동작 다른 글자: \`${a}\` → ${[...ls].map((x) => `「${x}」`).join(' ')}`);
for (const [l, as] of Object.entries(byLabel)) if (as.size > 1) L.push(`- 같은 글자 다른 동작: 「${l}」 → ${[...as].map((x) => `\`${x}\``).join(' ')}`);
L.push('', '## 5. 화면마다 잰 것', '');
for (const st of states) {
  const a = st.audit; if (!a) continue;
  const bad = a.off.length || a.cut.length || a.overlap.length || a.pageOver > 0;
  if (!bad) continue;
  L.push(`### [${st.vp}] ${st.path.length ? st.path.join(' → ') : st.start}${st.shot ? ` (${rel(st.shot)})` : ''}`);
  if (a.pageOver > 0) L.push(`- 페이지 가로 넘침 ${a.pageOver}px`);
  for (const o of a.off.slice(0, 8)) L.push(`- 화면 밖: ${o}`);
  for (const c of a.cut.slice(0, 10)) L.push(`- 글자 잘림${c.ellipsis ? '(말줄임)' : ''}: 「${c.text}」 ${c.path} ${c.sw}>${c.cw} / ${c.sh}>${c.ch}`);
  for (const o of a.overlap.slice(0, 10)) L.push(`- 겹침: \`${o[0]}\` ↔ \`${o[1]}\` ${o[2]}`);
  L.push('');
}
L.push('## 6. 작은 누름 칸 (32px 미만, 폰)', '');
const smalls = {}; for (const st of states) if (isPhoneVp(st.vp)) for (const [k, s] of st.audit?.small || []) smalls[k] = s;
L.push(Object.entries(smalls).map(([k, s]) => `\`${k}\` ${s}`).join(' · ') || '없음', '');
L.push('## 7. 못 누른 것', '');
L.push(`- 코드에 있는 data-action ${srcActs.size}개 중 한 번도 못 누른 것 ${never.length}개 (이 시작 상태에서 화면에 안 나온 것. 다른 시작 상태·자료가 필요하면 docs 에 적힌 대로 시작 상태를 더한다):`, '', never.map((a) => `\`${a}\``).join(' '), '');
if (Object.keys(skippedVals).length) L.push(`- 같은 단추의 다른 값이라 안 누른 수 (--per-action ${opt.perAction}): ${Object.entries(skippedVals).sort((a, b) => b[1] - a[1]).map(([a, n]) => `\`${a}\` ${n}`).join(' · ')}`, '');
for (const vp of opt.vp) for (const other of opt.vp) if (vp !== other) { const only = [...(keysBy[vp] || [])].filter((k) => !keysBy[other]?.has(k)); if (only.length) L.push(`- ${vp}에만 있고 ${other}에는 없는 것 ${only.length}개: ${only.slice(0, 40).map((x) => `\`${x}\``).join(' ')}${only.length > 40 ? ' …' : ''}`); }
writeFileSync(resolve(OUT, 'report.md'), L.join('\n') + '\n');
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify({ opt, results, states, incons, selLooks: Object.fromEntries(Object.entries(selLooks)), never }, null, 1));
log(`끝: 누른 수 ${results.filter((r) => r.shots).length}, 이상 반응 ${flagged.length}, 못 누른 data-action ${never.length} · ${relative(ROOT, OUT)}/report.md`);
