// PC 마우스 제스처 전부 (2026-11-12 사용자: 「ㄱ 거꾸로 = 닫은 탭 다시 열기」가 안 먹음 → 하나만 보지 말고 제스처 전부를 실제 마우스 이벤트로).
// 오른쪽 단추를 누른 채 끄는 진짜 포인터 이벤트(page.mouse)로 그린다. 깨끗한 획뿐 아니라 사람 손 모양(비스듬·둥근 모서리·삐침)도 그린다.
//   1) 상황판 메뉴(인터넷 밖): ← 뒤로 · → 앞으로, ㄴ·ㄱ거꾸로는 아무 일 없음
//   2) 인터넷의 모든 사이트 화면: ← → 는 그 탭의 기록, ㄴ 탭 닫기, ㄱ거꾸로 닫은 탭 다시 열기(닫은 순서의 거꾸로, 여러 번)
//   3) × 단추로 닫은 탭도 되살아남, 창을 닫았다 열어도, 다른 메뉴에 갔다 와도
//   4) 놓기를 못 받은 뒤(창 밖에서 놓음)에도 다음 제스처가 먹음
//   5) 그냥 오른쪽 클릭은 메뉴를 막지 않고, 끈 뒤에만 막음. 제스처가 아닌 모양은 아무 일 없음. 입력 칸에서 시작하면 제스처가 아님
//   6) 닫은 탭은 채팅($br_tabs)에 남아 새로 고친 뒤에도 되살아남
// 사용법: node tests/gesture-browser.mjs <fixture.json> [--report]   (--report: 틀려도 멈추지 않고 표만 찍는다)
import assert from 'node:assert/strict';
import { boot, launch, loadFixture, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const REPORT = process.argv.includes('--report');
const browser = await launch();
const PC = { width: 1920, height: 1080, touch: false };
const chat0 = (extra = {}) => ({ message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1', ...extra } });
const rows = [];
let fails = 0;
const check = (where, what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  rows.push(`${ok ? 'ok  ' : 'FAIL'} | ${where} | ${what}${ok ? '' : ` | 나온 것 ${JSON.stringify(got)} · 맞는 것 ${JSON.stringify(want)}`}`);
  if (!ok) { fails++; if (!REPORT) { console.log(rows.join('\n')); assert.deepEqual(got, want, `${where}: ${what}`); } }
};

async function start(chat) {
  const { page, errors } = await boot(browser, fx, chat, PC);
  await openWin(page);
  await closeGw(page);
  return { page, errors };
}
/** 시험 카드에서는 설치 안내(설정 창)가 저절로 떠서 상황판을 덮는다 → 닫는다 */
async function closeGw(page) {
  if (!(await page.evaluate(() => { const g = document.querySelector('.gw'); return !!g && !g.hidden; }))) return;
  await page.evaluate(() => document.querySelector('.gw .gw-top [data-action="ed-close"]').click());
  await sleep(300);
  if (await page.$('.gw [data-action="ed-close-force"]')) await page.evaluate(() => document.querySelector('.gw [data-action="ed-close-force"]').click());
  await sleep(300);
}
const click = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error(`no element: ${s}`); e.click(); }, sel);
const menu = async (page, id) => { await click(page, `.gx [data-action="nav-tab"][data-value="${id}"]`); await sleep(450); };
const tabs = (page) => page.evaluate(() => [...document.querySelectorAll('.gx .br-tabs .br-tab')].map((t) => (t.classList.contains('on') ? '*' : '') + (t.querySelector('svg')?.outerHTML.length ?? 0)));
const sites = (page) => page.evaluate(() => [...document.querySelectorAll('.gx .br-page')].map((p) => p.className.replace('br-page br-p-', '')).join());
const curMenu = (page) => page.evaluate(() => document.querySelector('.gx .gx-nb.on')?.dataset.value ?? '');
const tabCount = (page) => page.evaluate(() => document.querySelectorAll('.gx .br-tabs .br-tab').length);
/** 인터넷 탭마다 사이트 (탭을 하나씩 눌러 보지 않고 저장 글로 읽는다: 1.5초 모아 적으므로 기다린다) */
const saved = async (page) => { await sleep(1700); return page.evaluate(() => { try { const v = JSON.parse(window.__chat.scriptstate.$br_tabs); return { t: v.t.map((t) => t.s), x: (v.x ?? []).map((t) => t.s) }; } catch { return null; } }); };

/** 제스처를 시작할 빈 자리 (입력 칸·단추·링크가 아닌 곳) */
const spot = (page) => page.evaluate(() => {
  const r = (document.querySelector('.gx .br-page') ?? document.querySelector('.gx .gx-main') ?? document.querySelector('.gx')).getBoundingClientRect();
  for (let fy = 0.5; fy < 0.9; fy += 0.07) for (let fx = 0.5; fx > 0.2; fx -= 0.06) {
    const x = r.left + r.width * fx, y = r.top + r.height * fy;
    const e = document.elementFromPoint(x, y);
    if (e && e.closest('.gx') && !e.closest('input, textarea, select, [contenteditable], button, a')) return { x, y };
  }
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
/** 획: [dx, dy] 들을 차례로. 오른쪽 단추를 누른 채 8px쯤씩 움직인다. 놓기 직전의 이름표와 메뉴가 막혔는지를 돌려준다 */
async function draw(page, segs, { at = null, release = true } = {}) {
  let { x, y } = at ?? (await spot(page));
  await page.evaluate(() => { window.__ctx = []; if (!window.__ctxOn) { window.__ctxOn = true; window.addEventListener('contextmenu', (e) => setTimeout(() => window.__ctx.push(e.defaultPrevented), 0)); } });
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  for (const [dx, dy] of segs) {
    const n = Math.max(2, Math.round(Math.hypot(dx, dy) / 8));
    for (let i = 1; i <= n; i++) { await page.mouse.move(x + (dx * i) / n, y + (dy * i) / n); await sleep(4); }
    x += dx; y += dy;
  }
  const tip = await page.evaluate(() => { const t = document.querySelector('.gx .gx-gest-tip'); return t ? `${t.textContent}${t.classList.contains('off') ? '(못 함)' : ''}` : '(선 없음)'; });
  if (release) { await page.mouse.up({ button: 'right' }); await sleep(650); }
  return { tip, prevented: await page.evaluate(() => window.__ctx.slice()) };
}
const rad = (d) => (d * Math.PI) / 180;
const vec = (deg, len) => [Math.cos(rad(deg)) * len, Math.sin(rad(deg)) * len];
/** 제스처마다 그리는 법 여럿: 깨끗한 획과 사람 손 모양 */
const STROKES = {
  L: { '깨끗': [[-150, 0]], '비스듬 20°': [vec(160, 160)], '끝 삐침': [[-160, 0], [8, 26]], '첫머리 삐침': [[10, -22], [-170, 0]] },
  R: { '깨끗': [[150, 0]], '비스듬 20°': [vec(20, 160)], '끝 삐침': [[160, 0], [-8, 26]], '첫머리 삐침': [[-10, 22], [170, 0]] },
  DR: { '깨끗': [[0, 130], [130, 0]], '비스듬(세로 25°)': [vec(65, 140), [130, 0]], '둥근 모서리': [[0, 100], vec(60, 25), vec(30, 25), [100, 0]], '끝 삐침': [[0, 130], [130, 0], [6, -26]] },
  UL: { '깨끗': [[0, -130], [-130, 0]], 'ㄱ 다리처럼 비스듬(40°)': [vec(-50, 150), [-140, 0]], 'ㄱ 다리처럼 비스듬(50°)': [vec(-40, 150), [-150, 0]], '둥근 모서리': [[0, -100], vec(-120, 25), vec(-150, 25), [-100, 0]], '끝 삐침': [[0, -130], [-130, 0], [-6, 26]], '첫머리 삐침': [[12, 20], [0, -140], [-130, 0]] },
};
const NAME = { L: '← 뒤로', R: '→ 앞으로', DR: 'ㄴ 탭 닫기', UL: 'ㄱ 거꾸로 = 닫은 탭 다시 열기' };

/* ── 1. 상황판 메뉴 (인터넷 밖): ← → 는 메뉴 사이를 오간다, ㄴ·ㄱ거꾸로는 아무 일 없음 ── */
{
  const { page, errors } = await start(chat0());
  const order = ['map', 'phone', 'items', 'records', 'board'];
  for (const m of order) await menu(page, m);
  check('상황판 메뉴', '처음 자리', await curMenu(page), 'board');
  // 뒤로: 메뉴를 거꾸로 되짚는다 (그리는 법을 돌려 가며)
  const ls = Object.entries(STROKES.L);
  for (let i = order.length - 2, k = 0; i >= 0; i--, k++) {
    const [how, segs] = ls[k % ls.length];
    const r = await draw(page, segs);
    check(`상황판 메뉴 「${order[i + 1]}」`, `${NAME.L} (${how}) 이름표`, r.tip, '뒤로');
    check(`상황판 메뉴 「${order[i + 1]}」`, `${NAME.L} (${how}) → 「${order[i]}」`, await curMenu(page), order[i]);
  }
  const rs = Object.entries(STROKES.R);
  for (let i = 1, k = 0; i < order.length; i++, k++) {
    const [how, segs] = rs[k % rs.length];
    const r = await draw(page, segs);
    check(`상황판 메뉴 「${order[i - 1]}」`, `${NAME.R} (${how}) 이름표`, r.tip, '앞으로');
    check(`상황판 메뉴 「${order[i - 1]}」`, `${NAME.R} (${how}) → 「${order[i]}」`, await curMenu(page), order[i]);
  }
  for (const g of ['DR', 'UL']) {
    const r = await draw(page, STROKES[g]['깨끗']);
    check('상황판 메뉴 「board」', `${NAME[g]}: 인터넷 밖이라 못 함`, r.tip, '—(못 함)');
    check('상황판 메뉴 「board」', `${NAME[g]}: 화면 그대로`, await curMenu(page), 'board');
  }
  check('상황판 메뉴', '오류 없음', errors, []);
  await page.close();
}

/* ── 2. 인터넷: 사이트마다 네 제스처 ── */
{
  const { page, errors } = await start(chat0());
  await menu(page, 'net');
  const all = await page.evaluate(() => [...document.querySelectorAll('.gx .br-bms [data-action="br-go"], .gx [data-action="br-go"]')].map((b) => b.dataset.value).filter((v, i, a) => a.indexOf(v) === i));
  check('인터넷', '즐겨찾기 사이트가 있다', all.length >= 5, true);
  // 첫 탭은 사이트 하나를 열어 둔다 (빈 새 탭 하나만 남으면 되살릴 때 그 자리를 쓰므로 탭 수가 달라진다)
  await click(page, `.gx [data-action="br-go"][data-value="${all[0]}"]`); await sleep(650);
  for (const s of all) {
    // 새 탭에 사이트를 연다 → ← 는 그 탭의 기록(새 탭 화면)으로, → 는 다시 사이트로
    await click(page, '.gx [data-action="br-new"]'); await sleep(300);
    await click(page, `.gx [data-action="br-go"][data-value="${s}"]`); await sleep(700);
    const n = await tabCount(page);
    let r = await draw(page, STROKES.L['깨끗']);
    check(`인터넷 「${s}」`, `${NAME.L} 이름표`, r.tip, '뒤로');
    check(`인터넷 「${s}」`, `${NAME.L} → 그 탭의 앞 화면(새 탭)`, await sites(page), 'home');
    r = await draw(page, STROKES.R['깨끗']);
    check(`인터넷 「새 탭」`, `${NAME.R} 이름표`, r.tip, '앞으로');
    check(`인터넷 「새 탭」`, `${NAME.R} → 「${s}」`, await sites(page), s);
    // ㄴ: 이 탭이 닫힌다 → ㄱ거꾸로: 그 탭이 그 사이트로 되살아난다
    r = await draw(page, STROKES.DR['깨끗']);
    check(`인터넷 「${s}」`, `${NAME.DR} 이름표`, r.tip, '탭 닫기');
    check(`인터넷 「${s}」`, `${NAME.DR} → 탭 수 ${n} → ${n - 1}`, await tabCount(page), n - 1);
    r = await draw(page, STROKES.UL['깨끗']);
    check(`인터넷 (「${s}」 닫은 뒤)`, `${NAME.UL} 이름표`, r.tip, '닫은 탭 다시 열기');
    check(`인터넷 (「${s}」 닫은 뒤)`, `${NAME.UL} → 탭 수 ${n}`, await tabCount(page), n);
    check(`인터넷 (「${s}」 닫은 뒤)`, `${NAME.UL} → 「${s}」 화면`, await sites(page), s);
  }
  check('인터넷 사이트마다', '오류 없음', errors, []);
  await page.close();
}

/* ── 3. 닫은 순서의 거꾸로 여러 번, 사람 손 모양, × 단추·창 닫기·다른 메뉴 ── */
{
  const { page, errors } = await start(chat0());
  await menu(page, 'net');
  const open = async (s, fresh = true) => { if (fresh) { await click(page, '.gx [data-action="br-new"]'); await sleep(300); } await click(page, `.gx [data-action="br-go"][data-value="${s}"]`); await sleep(650); };
  await open('gn', false); await open('cos'); await open('wk'); await open('sm'); await open('gal');
  check('인터넷', '탭 다섯', (await saved(page)).t, ['gn', 'cos', 'wk', 'sm', 'gal']);
  // 닫기: ㄴ(손 모양 둘) → gal, sm / × 단추 → wk
  let r = await draw(page, STROKES.DR['비스듬(세로 25°)']);
  check('인터넷', `${NAME.DR} (비스듬) 이름표`, r.tip, '탭 닫기');
  r = await draw(page, STROKES.DR['둥근 모서리']);
  check('인터넷', `${NAME.DR} (둥근 모서리) 이름표`, r.tip, '탭 닫기');
  await click(page, '.gx .br-tabs [data-action="br-close"][data-value="2"]'); await sleep(500);
  let st = await saved(page);
  check('인터넷', '세 탭을 닫은 뒤 남은 탭', st.t, ['gn', 'cos']);
  check('인터넷', '닫은 탭이 채팅에 닫은 순서로 적힘', st.x, ['gal', 'sm', 'wk']);
  // 되살리기: 닫은 순서의 거꾸로 (wk → sm → gal). 그리는 법을 바꿔 가며
  const back = [['wk', 'ㄱ 다리처럼 비스듬(40°)'], ['sm', 'ㄱ 다리처럼 비스듬(50°)'], ['gal', '끝 삐침']];
  for (const [s, how] of back) {
    r = await draw(page, STROKES.UL[how]);
    check('인터넷', `${NAME.UL} (${how}) 이름표`, r.tip, '닫은 탭 다시 열기');
    check('인터넷', `${NAME.UL} (${how}) → 「${s}」가 되살아남`, await sites(page), s);
  }
  st = await saved(page);
  check('인터넷', '세 번 되살린 뒤 탭 순서', st.t, ['gn', 'cos', 'wk', 'sm', 'gal']);
  check('인터넷', '닫은 탭 목록이 빔', st.x, []);
  r = await draw(page, STROKES.UL['깨끗']);
  check('인터넷', `${NAME.UL}: 되살릴 탭이 없으면 못 함`, r.tip, '—(못 함)');
  check('인터넷', '탭 수 그대로', await tabCount(page), 5);
  // 둥근 모서리·첫머리 삐침으로도
  for (const how of ['둥근 모서리', '첫머리 삐침']) {
    await draw(page, STROKES.DR['끝 삐침']);
    check('인터넷', `${NAME.DR} (끝 삐침) → 탭 수 4`, await tabCount(page), 4);
    r = await draw(page, STROKES.UL[how]);
    check('인터넷', `${NAME.UL} (${how}) 이름표`, r.tip, '닫은 탭 다시 열기');
    check('인터넷', `${NAME.UL} (${how}) → 탭 수 5`, await tabCount(page), 5);
  }
  // 창을 닫았다 열어도, 다른 메뉴에 갔다 와도 닫은 탭이 남는다
  await click(page, '.gx .br-tabs [data-action="br-close"][data-value="4"]'); await sleep(400);
  await click(page, '.gx .br-tabs [data-action="br-close"][data-value="3"]'); await sleep(400);
  await page.evaluate(() => document.querySelector('.gx-head [data-action="close"], .gx [data-action="close"]').click()); await sleep(500);
  await page.evaluate(() => window.__button.cb()); await sleep(1200); await closeGw(page);
  r = await draw(page, STROKES.UL['깨끗']);
  check('인터넷 (창을 닫았다 연 뒤)', `${NAME.UL} 이름표`, r.tip, '닫은 탭 다시 열기');
  check('인터넷 (창을 닫았다 연 뒤)', `${NAME.UL} → 탭 수 4`, await tabCount(page), 4);
  await menu(page, 'items');
  r = await draw(page, STROKES.UL['깨끗']);
  check('소지품 (닫은 탭이 남아 있을 때)', `${NAME.UL}: 인터넷 밖이라 못 함`, r.tip, '—(못 함)');
  await menu(page, 'net');
  r = await draw(page, STROKES.UL['깨끗']);
  check('인터넷 (다른 메뉴에 갔다 온 뒤)', `${NAME.UL} → 탭 수 5`, await tabCount(page), 5);

  /* ── 4. 놓기를 못 받은 뒤에도 다음 제스처가 먹는다 ── */
  // 창 밖에서 단추를 놓은 것처럼: 누름만 오고 놓기는 안 온다
  await page.evaluate(() => { const r = document.querySelector('.gx .br-page'); const b = r.getBoundingClientRect(); r.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, buttons: 2, pointerType: 'mouse', clientX: b.left + 40, clientY: b.top + 300 })); });
  await sleep(100);
  const n0 = await tabCount(page);
  r = await draw(page, STROKES.DR['깨끗']);
  check('인터넷 (놓기를 못 받은 뒤)', `${NAME.DR} 이름표`, r.tip, '탭 닫기');
  check('인터넷 (놓기를 못 받은 뒤)', `${NAME.DR} → 탭 수 ${n0 - 1}`, await tabCount(page), n0 - 1);
  r = await draw(page, STROKES.UL['깨끗']);
  check('인터넷 (놓기를 못 받은 뒤)', `${NAME.UL} → 탭 수 ${n0}`, await tabCount(page), n0);

  /* ── 5. 메뉴 막기, 제스처가 아닌 모양, 입력 칸 ── */
  r = await draw(page, []);
  check('인터넷', '끌지 않은 오른쪽 클릭: 선 없음', r.tip, '(선 없음)');
  check('인터넷', '끌지 않은 오른쪽 클릭: 평소 메뉴를 막지 않음', r.prevented.includes(true), false);
  const before = await tabCount(page);
  for (const [name, segs] of [['ㄱ 바로(→↓)', [[130, 0], [0, 130]]], ['↑', [[0, -150]]], ['↓', [[0, 150]]], ['←↑', [[-130, 0], [0, -130]]], ['→←', [[150, 0], [-150, 0]]], ['↑→', [[0, -130], [130, 0]]]]) {
    const site0 = await sites(page);
    r = await draw(page, segs);
    check('인터넷', `제스처가 아닌 모양 ${name}: 이름표 없음`, r.tip, '');
    check('인터넷', `제스처가 아닌 모양 ${name}: 탭·화면 그대로`, [await tabCount(page), await sites(page)], [before, site0]);
  }
  // 입력 칸에서 시작하면 제스처가 아니다 (글 메뉴를 쓰게 둔다). 괴이위키 찾기 칸
  await click(page, '.gx [data-action="br-new"]'); await sleep(300);
  await click(page, '.gx [data-action="br-go"][data-value="wk"]'); await sleep(700);
  const inp = await page.evaluate(() => { const i = [...document.querySelectorAll('.gx .br-page input, .gx input')].find((e) => e.offsetWidth > 60); if (!i) return null; const r = i.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (inp) {
    r = await draw(page, STROKES.L['깨끗'], { at: inp });
    check('인터넷 「wk」 입력 칸', '입력 칸에서 시작: 제스처 아님(선 없음)', r.tip, '(선 없음)');
  }
  check('인터넷', '오류 없음', errors, []);

  /* ── 6. 닫은 탭은 새로 고친 뒤에도 남는다 ── */
  await draw(page, STROKES.DR['깨끗']);
  const keep = await saved(page);
  check('인터넷', '닫은 탭이 채팅에 적힘', keep.x.slice(-1), ['wk']);
  const raw = await page.evaluate(() => window.__chat.scriptstate.$br_tabs);
  await page.close();
  const again = await start(chat0({ $br_tabs: raw }));
  await menu(again.page, 'net');
  const n1 = await tabCount(again.page);
  r = await draw(again.page, STROKES.UL['깨끗']);
  check('인터넷 (새로 고친 뒤)', `${NAME.UL} 이름표`, r.tip, '닫은 탭 다시 열기');
  check('인터넷 (새로 고친 뒤)', `${NAME.UL} → 탭 수 ${n1 + 1}, 「wk」 화면`, [await tabCount(again.page), await sites(again.page)], [n1 + 1, 'wk']);
  check('인터넷 (새로 고친 뒤)', '오류 없음', again.errors, []);
  await again.page.close();
}

await browser.close();
console.log(rows.join('\n'));
console.log(`\n확인 ${rows.length}개, 틀린 것 ${fails}개`);
if (fails) process.exit(1);
console.log('gesture browser test passed');
