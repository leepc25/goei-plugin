// 상점 「메인 요청에 붙이는 것」 격자 (2026-11-12 사용자: 「각 기능들 컨텍 포함 선택이 어디있지? 상점 관련된거 없는거 같은데」 → 가게마다 다른 격자).
// 설정 → 상점: 줄 = 기본 상점·우주 쇼핑몰·백일몽 포인트몰, 칸 = 컨텍스트 포함 · 구매 · 팔기 · 문의 · 맞춤 주문 · 1:1 상담, 없는 것은 빈 칸(–). 그 아래 「최대 양」.
// ① 격자 모양(줄·칸·빈 칸·기본값 전부 켬) ② 같은 페이지 「호출」 격자와 같은 치수·선·제목 ③ 칸마다 누르면 그 변수만 바뀌고 다시 누르면 돌아온다
// ④ 「컨텍스트 포함」을 끄면 그 줄 나머지가 잠기고 값은 남는다 ⑤ 「최대 양」 수 상자(공통 규격, 큰 것) ⑥ 닫았다 열어도 같다 ⑦ 가로 넘침 없음 ⑧ 시작 전(새 채팅 기본값).
// 사용: node tests/shopctx-browser.mjs <fixture.json> [사진 폴더]
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, launch, loadFixture, openEditor, openWin, prefsOf, sleep } from './qc-settings-harness.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fx = loadFixture(args[0] || new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const OUT = args[1] || '.scratch/shopctx';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const started = () => ({
  message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]', chatId: 'c1' }],
  scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' },
});
let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const ok = (v, m) => { assert.ok(v, m); checks++; };

const TITLE = '메인 요청에 붙이는 것';
const ROWS = ['기본 상점', '우주 쇼핑몰', '백일몽 포인트몰'];
const IDS = ['shop', 'cos', 'bm'];
const COLS = ['컨텍스트 포함', '구매', '팔기', '문의', '맞춤 주문', '1:1 상담'];
const KEYS = ['', 'buy', 'sell', 'ask', 'order', 'desk'];
/** 가게마다 있는 칸 (1 = 체크, – = 빈 칸) */
const SHAPE = ['1 1 1 1 – –', '1 1 – 1 1 –', '1 1 – – – 1'];
const varOf = (r, c) => `${IDS[r] === 'shop' ? '$sh_main' : `$${IDS[r]}_sh_main`}${KEYS[c] ? `_${KEYS[c]}` : ''}`;

/** 보이는 격자 하나를 읽는다 (PC·폰 쌍둥이 가운데 보이는 것) */
const readGrid = (page, title) => page.evaluate((title) => {
  const s = [...document.querySelectorAll('.gw section.ck')].find((x) => x.getBoundingClientRect().width > 0 && (x.querySelector('h3')?.textContent ?? '').split(' · ').includes(title));
  if (!s) return null;
  const px = (e) => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  const cs = (e, ...ks) => { const c = getComputedStyle(e); return ks.map((k) => c[k]).join(' | '); };
  const row = s.querySelector('.ck-row');
  const btn = s.querySelector('.ck-row .ck-m:not([disabled])');
  const h3 = s.querySelector('h3');
  return {
    cls: s.className.replace(/\s*ck-hasnum/, ''), w: px(s).w, n: s.style.getPropertyValue('--ck-n'),
    h1: [...s.querySelectorAll('.ck-h1 > b')].map((e) => e.textContent), h2: [...s.querySelectorAll('.ck-h2 > span')].slice(1).map((e) => e.textContent),
    names: [...s.querySelectorAll('.ck-row .ck-name')].map((e) => e.textContent.trim()),
    cells: [...s.querySelectorAll('.ck-row')].map((r) => [...r.querySelectorAll('.ck-cell')].map((c) => { const b = c.querySelector('button'); return c.querySelector('.ck-x') ? '–' : `${b.disabled ? 'L' : ''}${b.classList.contains('on') ? 1 : 0}`; }).join(' ')),
    nameW: px(s.querySelector('.ck-name')).w, rowH: px(row).h, btn: px(btn),
    colW: [...new Set([...row.querySelectorAll('.ck-cell')].map((c) => Math.round(c.getBoundingClientRect().width)))],
    line: cs(s.querySelectorAll('.ck-row')[1], 'borderTopColor', 'borderTopWidth', 'borderTopStyle'), headLine: cs(s.querySelector('.ck-h2'), 'borderBottomColor', 'borderBottomWidth', 'borderBottomStyle'), first: cs(row.querySelector('.ck-cell.ck-first'), 'boxShadow'),
    box: cs(s.querySelector('.ps-rows'), 'borderTopColor', 'borderTopWidth', 'borderRadius', 'backgroundColor'),
    h3: cs(h3, 'fontSize', 'fontWeight', 'color', 'letterSpacing'), h1s: cs(s.querySelector('.ck-h1 > b'), 'fontSize', 'fontWeight', 'color'), h2s: cs(s.querySelector('.ck-h2 > span.ck-first'), 'fontSize', 'fontWeight', 'color'), names_: cs(s.querySelector('.ck-name'), 'fontSize', 'fontWeight', 'color'),
    foot: s.querySelector('.mx-foot')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    clip: [...s.querySelectorAll('.ck-h1 > b, .ck-h2 > span, .ck-name')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
  };
}, title);

async function run(vp, size, chat, fresh) {
  const { page, errors } = await boot(browser, fx, chat, size);
  const tag = `[${vp}${fresh ? ' 시작 전' : ''}]`;
  const where = () => page.evaluate(() => ({ chat: { ...(window.__chat.scriptstate ?? {}) }, prefs: JSON.parse(window.__store['p:goei:prefs'] || '{}').vars ?? {} }));
  const val = async (k) => { const w = await where(); return fresh ? w.prefs[k] : w.chat[k]; };
  const cell = (r, c) => page.evaluate(([title, r, c]) => {
    const s = [...document.querySelectorAll('.gw section.ck')].find((x) => x.getBoundingClientRect().width > 0 && x.querySelector('h3')?.textContent === title);
    const b = s.querySelectorAll('.ck-row')[r].querySelectorAll('.ck-cell')[c].querySelector('button');
    if (!b || b.disabled) return false;
    b.click(); return true;
  }, [TITLE, r, c]).then(async (v) => { await sleep(350); return v; });
  const shot = async (name) => { await page.evaluate((title) => [...document.querySelectorAll('.gw section.ck h3')].find((h) => h.textContent === title && h.getBoundingClientRect().width > 0).scrollIntoView({ block: 'start' }), TITLE); await sleep(300); await page.screenshot({ path: `${OUT}/${vp}${fresh ? '-fresh' : ''}-${name}.png` }); };
  const stepper = () => page.evaluate(() => {
    const i = [...document.querySelectorAll('.gw input[data-change="fam-num"][data-key="s:shop:main_lines"]')].find((e) => e.getBoundingClientRect().width > 0);
    if (!i) return null;
    const box = i.closest('.st-step'); const b = box.getBoundingClientRect(); const [minus, plus] = box.querySelectorAll('button');
    const row = box.closest('.ps-row');
    return { n: document.querySelectorAll('.gw input[data-change="fam-num"][data-key="s:shop:main_lines"]').length, cls: box.className, w: Math.round(b.width), h: Math.round(b.height), value: i.value, ph: i.placeholder, unit: box.querySelector('span')?.textContent, minusOff: minus.disabled, plusOff: plus.disabled, label: row?.querySelector('.ps-name, b, h4')?.textContent.trim(), rowText: row?.textContent.replace(/\s+/g, ' ').trim(), over: i.scrollWidth > i.clientWidth + 1 };
  });
  const put = async (v) => { await page.evaluate((v) => { const i = [...document.querySelectorAll('.gw input[data-change="fam-num"][data-key="s:shop:main_lines"]')].find((e) => e.getBoundingClientRect().width > 0); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); }, v); await sleep(350); };
  const press = async (sign) => { await page.evaluate((sign) => { const i = [...document.querySelectorAll('.gw input[data-change="fam-num"][data-key="s:shop:main_lines"]')].find((e) => e.getBoundingClientRect().width > 0); const bs = i.closest('.st-step').querySelectorAll('button'); bs[sign === '+' ? 1 : 0].click(); }, sign); await sleep(350); };
  const noOverflow = async (m) => eq(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || [...document.querySelectorAll('.gw .fam-wide section.ck, .gw .fam-wide .ps-row')].some((t) => t.getBoundingClientRect().width > 0 && t.scrollWidth > t.clientWidth + 1)), false, `${tag} ${m}: 가로 넘침 없음`);

  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await openEditor(page, 'set:shop'); await sleep(400);

  /* ① 격자 모양 */
  const g = await readGrid(page, TITLE);
  ok(g, `${tag} 격자가 있다`);
  eq(await page.evaluate((t) => [...document.querySelectorAll('.gw section.ck h3')].filter((h) => h.textContent === t && h.getBoundingClientRect().width > 0).length, TITLE), 1, `${tag} 보이는 격자는 하나`);
  ok(g.cls.includes(vp === 'pc' ? 'ck-pc' : 'ck-ph'), `${tag} ${vp === 'pc' ? 'PC' : '폰'} 격자`);
  eq(g.h1, ['메인 요청', '붙일 것'], `${tag} 칸 묶음`);
  eq(g.h2, COLS, `${tag} 칸 이름`);
  eq(g.names, ROWS, `${tag} 줄 = 세 가게 (망상홈쇼핑 줄 없음)`);
  eq(g.cells, SHAPE, `${tag} 기본값: 있는 칸은 전부 켬, 없는 칸은 –`);
  eq(g.cells.join(' ').split(' ').filter((x) => x === '–').length, 7, `${tag} 빈 칸 7개`);
  ok(g.foot.startsWith('켜면 '), `${tag} 설명 첫 문장 「켜면 …」: ${g.foot.slice(0, 40)}`);
  ok(g.foot.includes('「맥락 반영」과는 방향이 반대'), `${tag} 방향 설명`);
  eq(g.clip, [], `${tag} 잘린 글 없음`);

  /* ② 같은 페이지 「호출」 격자, 같은 틀 */
  const ref = await readGrid(page, '호출');
  ok(ref, `${tag} 견줄 「호출」 격자`);
  for (const k of ['w', 'nameW', 'rowH', 'btn', 'line', 'headLine', 'first', 'box', 'h3', 'h1s', 'h2s', 'names_']) eq(g[k], ref[k], `${tag} 「호출」 격자와 같은 ${k}`);
  ok(/1px \| solid$/.test(g.line) && /1px \| solid$/.test(g.headLine) && /inset/.test(g.first), `${tag} 격자 선이 그려져 있다 (${g.line} / ${g.first})`);
  eq(g.nameW, vp === 'pc' ? 136 : 74, `${tag} 이름 칸 폭 (상점 페이지 격자 공통)`);
  eq(g.colW.length <= 2 && Math.max(...g.colW) - Math.min(...g.colW) <= 1, true, `${tag} 칸 폭이 모두 같다 (${g.colW})`);
  await noOverflow('처음');
  await shot('grid');
  const sizes = { nameW: g.nameW, rowH: g.rowH, btn: g.btn, colW: g.colW, gridW: g.w, line: g.line, colLine: g.first, h3: g.h3, h1: g.h1s, h2: g.h2s, name: g.names_ };

  /* ③ 칸마다: 누르면 그 변수만 0, 다시 누르면 1 */
  for (let r = 0; r < 3; r++) for (let c = 1; c < 6; c++) {
    const has = SHAPE[r].split(' ')[c] === '1';
    const before = await where();
    const done = await cell(r, c);
    eq(done, has, `${tag} ${ROWS[r]}·${COLS[c]}: ${has ? '누를 수 있다' : '빈 칸은 못 누른다'}`);
    if (!has) { eq(await where(), before, `${tag} 빈 칸: 아무것도 안 바뀜`); continue; }
    eq(await val(varOf(r, c)), '0', `${tag} ${ROWS[r]}·${COLS[c]} 끔 → ${varOf(r, c)}=0`);
    const now = (await readGrid(page, TITLE)).cells;
    eq(now.map((x, i) => (i === r ? x.split(' ').map((y, j) => (j === c ? '1' : y)).join(' ') : x)), SHAPE, `${tag} 그 칸만 꺼짐`);
    const after = await where();
    const changed = [...new Set([...Object.keys(after.chat), ...Object.keys(before.chat)])].filter((k) => after.chat[k] !== before.chat[k]).concat([...new Set([...Object.keys(after.prefs), ...Object.keys(before.prefs)])].filter((k) => after.prefs[k] !== before.prefs[k]));
    eq(changed, [varOf(r, c)], `${tag} 바뀐 변수는 하나`);
    await cell(r, c);
    eq(await val(varOf(r, c)), '1', `${tag} 다시 켬`);
  }
  eq((await readGrid(page, TITLE)).cells, SHAPE, `${tag} 전부 되돌림`);

  /* ④ 컨텍스트 포함: 끄면 그 줄 나머지는 잠기고 값은 남는다 */
  await cell(1, 3); // 우주 쇼핑몰 문의 끔
  for (let r = 0; r < 3; r++) {
    await cell(r, 0);
    eq(await val(varOf(r, 0)), '0', `${tag} ${ROWS[r]} 컨텍스트 포함 끔`);
    const row = (await readGrid(page, TITLE)).cells[r].split(' ');
    eq(row[0], '0', `${tag} 맨 앞 칸 꺼짐`);
    ok(row.slice(1).every((x) => x === '–' || x.startsWith('L')), `${tag} ${ROWS[r]} 나머지 칸 잠김: ${row.join(' ')}`);
    if (r === 1) eq(row.join(' '), '0 L1 – L0 L1 –', `${tag} 잠겨도 켜 둔 값·꺼 둔 값이 그대로 보인다`);
    eq(await cell(r, 1), false, `${tag} 잠긴 칸은 못 누른다`);
  }
  await shot('master-off');
  await noOverflow('잠김');
  /* ⑥ 닫았다 열어도 같다 */
  await closeEditor(page, true); await openEditor(page, 'set:shop'); await sleep(400);
  eq((await readGrid(page, TITLE)).cells, ['0 L1 L1 L1 – –', '0 L1 – L0 L1 –', '0 L1 – – – L1'], `${tag} 다시 열어도 같은 값`);
  for (let r = 0; r < 3; r++) await cell(r, 0);
  await cell(1, 3);
  eq((await readGrid(page, TITLE)).cells, SHAPE, `${tag} 다시 켜면 돌아온다`);

  /* ⑤ 최대 양 */
  let s = await stepper();
  ok(s, `${tag} 「최대 양」 수 상자`);
  ok(s.rowText.startsWith('최대 양'), `${tag} 줄 이름 「최대 양」: ${s.rowText.slice(0, 30)}`);
  ok(/\blg\b/.test(s.cls) && s.cls.includes('st-step'), `${tag} 공통 수 상자, 큰 것 (${s.cls})`);
  eq([s.w, s.h], [206, 34], `${tag} 수 상자 206×34`);
  eq([s.value, s.ph, s.unit, s.minusOff, s.plusOff], ['', '제한 없음', '줄', true, false], `${tag} 기본값 = 제한 없음`);
  ok(!s.over, `${tag} 「제한 없음」이 상자 안에 다 보인다`);
  await press('+');
  eq(await val('$sh_main_lines'), '1', `${tag} + → 1`);
  await put('12');
  eq([await val('$sh_main_lines'), (await stepper()).value], ['12', '12'], `${tag} 12 입력`);
  await shot('lines-12');
  await put('999');
  s = await stepper();
  eq([await val('$sh_main_lines'), s.value, s.plusOff], ['200', '200', true], `${tag} 상한 200, + 잠김`);
  await press('-');
  eq(await val('$sh_main_lines'), '199', `${tag} − → 199`);
  await put('');
  s = await stepper();
  eq([await val('$sh_main_lines'), s.value, s.minusOff], ['0', '', true], `${tag} 비우면 제한 없음`);
  await noOverflow('최대 양');
  eq(errors.filter((e) => !/favicon/.test(e)), [], `${tag} 콘솔 오류 없음`);
  if (fresh) ok(Object.keys((await where()).chat).every((k) => !/sh_main/.test(k)), `${tag} 새 채팅 기본값에만 저장 (이 채팅 변수에는 없음)`);
  await page.close();
  return sizes;
}

const out = {};
out.pc = await run('pc', { width: 1920, height: 1080, touch: false }, started(), false);
out.phone = await run('phone', 'phone', started(), false);
out.pcFresh = await run('pc', { width: 1920, height: 1080, touch: false }, { message: [], scriptstate: {} }, true);
out.phoneFresh = await run('phone', 'phone', { message: [], scriptstate: {} }, true);
await browser.close();
console.log(JSON.stringify(out));
console.log(`shopctx-browser: ${checks} checks ok`);
