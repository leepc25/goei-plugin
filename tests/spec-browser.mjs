// 공통 규격 시험 (2026-11-12 사용자: 규격은 약속이 아니라 시험으로 지킨다).
// 설정 창의 모든 페이지를 PC·폰, 시작 뒤·시작 전으로 열어 아래를 어기면 실패한다.
//  1) 조작 높이: 수 상자·seg·고르기·단추(gx-mini)·글 칸은 34px
//  2) 수 상자 폭: 작은 것(--step-sm)·큰 것(--step-lg) 두 값뿐. 한 격자·한 짝 줄 안에서는 한 값
//  3) 잘린 글: 수 상자의 값(끝 값·0일 때의 말 포함)·seg·칩·단추의 글이 상자보다 넓으면 안 된다
//  4) 자리: 한 페이지에서 줄 이름 시작·조작 시작·설명 시작 x 는 종류마다 한 값 (호출 흐름: 호출 글·예상·지난 턴·설정 → 도)
//  5) 격자 안에 격자 줄이 아닌 줄이 끼면 안 된다
// 사용법: node tests/spec-browser.mjs <fixture.json> [--report <파일>] [--soft]   (--soft: 실패해도 0으로 끝내고 목록만)
import { readFileSync, writeFileSync } from 'node:fs';
import { boot, launch, loadFixture, openEditor, openWin, goNode, sleep } from './qc-settings-harness.mjs';

const args = process.argv.slice(2);
const fx = loadFixture(args[0]);
const soft = args.includes('--soft');
const reportAt = args.includes('--report') ? args[args.indexOf('--report') + 1] : '';
const src = readFileSync(new URL('./flow-consult-browser.mjs', import.meta.url), 'utf8');
const started = new Function('MARK', src.split('\n').find((l) => l.startsWith('const started = ')).replace('const started = ', 'return (').replace(/;\s*$/, ')'))('ZZ메인본문표식');
const fresh = () => ({ message: [], scriptstate: {} });
const H = 34;
/** 자리 규칙의 예외 (까닭을 적는다) */
const X_ALLOW = {
  // 호출 흐름의 이름표: 조작 칸이 두 칸이라 왼쪽 칸·오른쪽 칸 두 자리
  'manage:flow|label': 2,
  // 폰 격자 줄: [자동 호출][모델] 두 조작이 한 줄 → 두 자리
  'manage:flow|phGridCtl': 2,
};
const browser = await launch();
const fails = [];
const stepW = new Map();
const report = [];

const probe = () => {
  const vis = (e) => !!e.offsetParent && e.getBoundingClientRect().width > 0;
  const page = document.querySelector('.gw .gw-page') ?? document.querySelector('.gw .gw-body');
  const out = { h: [], steps: [], clip: [], x: {}, mixed: [], ingrid: [], sizes: {} };
  if (!page) return out;
  const rowOf = (e) => (e.closest('.ps-row, .fl-line, .flc, .ck-row, .mx-row')?.querySelector('.ps-label > b, .fl-name, .ck-name, .mx-label')?.textContent ?? '').trim() || (e.getAttribute('aria-label') ?? '');
  const R = (n) => Math.round(n * 10) / 10;
  // 1) 높이
  for (const e of page.querySelectorAll('.st-step, .gx-segs, select, .gx-mini, input.gx-search, input.st-text, input.ps-text')) {
    if (!vis(e)) continue;
    const h = R(e.getBoundingClientRect().height);
    if (Math.abs(h - 34) > 0.6) out.h.push(`${rowOf(e)} <${e.className.split(' ')[0] || e.tagName}> ${h}`);
  }
  // 2) 수 상자 폭 3) 잘린 값
  const cv = document.createElement('canvas').getContext('2d');
  const tw = (el, t) => { const cs = getComputedStyle(el); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return cv.measureText(t).width; };
  for (const s of page.querySelectorAll('.st-step')) {
    if (!vis(s)) continue;
    const w = R(s.getBoundingClientRect().width);
    out.steps.push(w);
    (out.sizes[w] ??= []).push(rowOf(s));
    const inp = s.querySelector('input'); const b = s.querySelector('b'); const unit = s.querySelector(':scope > span');
    if (inp) {
      const cs = getComputedStyle(inp);
      const room = inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const cands = [inp.value, inp.max && Number(inp.max) < 1e9 ? String(inp.max) : '', inp.min, inp.placeholder].filter(Boolean);
      for (const t of cands) { const need = tw(inp, t); if (need > room + 0.5) out.clip.push(`${rowOf(s)} 수 상자 「${t}${unit ? ' ' + unit.textContent : ''}」 ${R(need)} > ${R(room)}`); }
    }
    if (b && b.scrollWidth > b.clientWidth + 1) out.clip.push(`${rowOf(s)} 수 상자 「${b.textContent}」 ${b.scrollWidth} > ${b.clientWidth}`);
    if (s.scrollWidth > s.clientWidth + 1) out.clip.push(`${rowOf(s)} 수 상자 안이 넘침 ${s.scrollWidth} > ${s.clientWidth}`);
  }
  for (const g of page.querySelectorAll('.ck-pc, .fam-set, .mx-grid')) {
    if (!vis(g)) continue;
    const ws = [...new Set([...g.querySelectorAll('.st-step')].filter(vis).map((s) => R(s.getBoundingClientRect().width)))];
    if (ws.length > 1) out.mixed.push(`${(g.closest('.ps-group')?.querySelector('h3')?.textContent ?? rowOf(g)).trim()}: ${ws.join(' / ')}`);
  }
  // 한 묶음(상자)의 줄들: 수 상자 크기 하나 (격자·접힌 칸 빼고)
  for (const g of page.querySelectorAll('.ps-rows')) {
    if (!vis(g) || g.querySelector('.ck-line')) continue;
    const ws = [...new Set([...g.querySelectorAll('.st-step')].filter((s) => vis(s) && s.closest('.ps-rows') === g).map((s) => R(s.getBoundingClientRect().width)))];
    if (ws.length > 1) out.mixed.push(`묶음 「${(g.closest('.ps-group, details')?.querySelector('h3, summary')?.textContent ?? '').trim() || '(제목 없음)'}」: ${ws.join(' / ')}`);
  }
  // 격자: 가로 넘침 없음, 한 줄의 수 상자 사이 틈 4px 이상
  for (const g of page.querySelectorAll('.ck-pc')) {
    if (!vis(g)) continue;
    if (g.scrollWidth > g.clientWidth + 1) out.clip.push(`격자 「${g.closest('.ps-group')?.querySelector('h3')?.textContent ?? ''}」 가로 넘침 ${g.scrollWidth} > ${g.clientWidth}`);
    for (const row of g.querySelectorAll('.ck-row')) { const bs = [...row.querySelectorAll('.st-step')].filter(vis).map((s) => s.getBoundingClientRect()); for (let i = 1; i < bs.length; i++) if (bs[i].left - bs[i - 1].right < 3.5) { out.clip.push(`격자 「${g.closest('.ps-group')?.querySelector('h3')?.textContent ?? ''}」 수 상자가 붙음 (${R(bs[i].left - bs[i - 1].right)}px)`); break; } }
  }
  for (const e of page.querySelectorAll('.gx-seg, .gx-chip, .gx-mini')) {
    if (!vis(e)) continue;
    if (e.scrollWidth > e.clientWidth + 1) out.clip.push(`${rowOf(e)} <${e.className.split(' ')[0]}> 「${e.textContent.trim().slice(0, 20)}」 ${e.scrollWidth} > ${e.clientWidth}`);
  }
  // 4) 자리
  const tx = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) if (t.textContent.trim()) break; if (!t) return R(el.getBoundingClientRect().left); const r = document.createRange(); r.selectNodeContents(t); return R(r.getBoundingClientRect().left); };
  const add = (k, v, row) => { if (v === null || v === undefined) return; ((out.x[k] ??= {})[v] ??= []).push(row); };
  const L = (el) => (el && vis(el) ? R(el.getBoundingClientRect().left) : null);
  const Rr = (el) => (el && vis(el) ? R(el.getBoundingClientRect().right) : null);
  for (const r of page.querySelectorAll('.ps-rows > .ps-row')) {
    if (!vis(r) || r.closest('.ps-adv-body, details:not([open]), .ck-ph, .mx-grid, .ph-form-body')) continue;
    const nm = r.querySelector(':scope > .ps-label > b'); const ctl = r.querySelector(':scope > .ps-ctl'); const help = r.querySelector(':scope > .ps-help, :scope > .ps-ctl > .ps-help, :scope .ps-help');
    const row = (nm?.textContent ?? '').trim();
    if (nm && vis(nm)) add('name', tx(nm), row);
    if (ctl && vis(ctl) && ctl.firstElementChild) add('ctl', L(ctl), row);
    if (help && vis(help) && help.textContent.trim()) add('help', tx(help), row);
  }
  for (const l of page.querySelectorAll('.fl-pc .fl-line.fl-row')) {
    if (!vis(l)) continue;
    const nm = l.querySelector('.fl-name'); const row = nm?.textContent ?? '';
    add(l.classList.contains('sub') ? 'subName' : 'name', tx(nm), row);
    if (l.querySelector('.fl-pair')) add('ctl', L(l.querySelector('.fl-pair')), row);
    if (l.querySelector('.ck-cell')) add('gridCell', L(l.querySelector('.ck-cell')), row);
    for (const lab of l.querySelectorAll('.fl-l')) add('label', L(lab), row);
    // 호출 칸은 오른쪽 맞춤(횟수 크게 + 조건 작은 글, 2026-11-12 c3464c79b·3136c5a28): 자리는 횟수 글의 오른쪽 끝으로 잰다
    const said = l.querySelector('.fl-said'); if (said && said.textContent.trim()) add('said', Rr(said.querySelector(':scope > b') ?? said), row);
    // 호출 글은 한 줄: 두 줄로 꺾이거나 칸을 넘치면 안 된다 (2026-11-12 사용자)
    if (said && said.textContent.trim()) {
      // 횟수(b)는 한 줄, 조건(small)은 좁은 호출 칸 안에서 꺾여도 된다(3136c5a28 「호출 칸 좁게」, small white-space: normal). 둘 다 옆 칸을 넘치면 안 된다
      const go = l.querySelector('.fl-go'); const st0 = [...l.querySelectorAll('.fl-st')].find(vis);
      const limit = (st0 ?? go)?.getBoundingClientRect().left ?? Infinity;
      for (const part of (said.querySelector(':scope > b, :scope > small') ? said.querySelectorAll(':scope > b, :scope > small') : [said])) {
        if (!part.textContent.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(part);
        const tops = new Set([...rg.getClientRects()].map((c) => Math.round(c.top)));
        if (tops.size > 1 && part.tagName !== 'SMALL') out.clip.push(`호출 글 두 줄: ${row} 「${part.textContent.trim()}」`);
        if (rg.getBoundingClientRect().right > limit + 0.5) out.clip.push(`호출 글이 옆 칸을 넘음: ${row} 「${part.textContent.trim()}」 ${R(rg.getBoundingClientRect().right)} > ${R(limit)}`);
      }
    }
    const help = l.querySelector('.fl-help'); if (help) add('help', tx(help), row);
    const st = l.querySelectorAll('.fl-st'); add('st1', L(st[0]), row); add('st2', L(st[1]), row);
    add('goR', Rr(l.querySelector('button.fl-go')), row);
  }
  for (const c of page.querySelectorAll('.fl-ph .flc')) {
    if (!vis(c)) continue;
    { const cs = c.querySelector('.flc-calls'); if (cs && cs.textContent.trim()) { const rg = document.createRange(); rg.selectNodeContents(cs); if (new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size > 1) out.clip.push(`호출 글 두 줄(폰): ${c.querySelector('.fl-name')?.textContent ?? ''} 「${cs.textContent.trim()}」`); } }
    const nm = c.querySelector('.fl-name'); const row = nm?.textContent ?? '';
    add(c.classList.contains('sub') ? 'subName' : 'name', tx(nm), row);
    add(c.classList.contains('sub') ? 'subCard' : 'card', L(c), row);
    const help = c.querySelector('.fl-help'); if (help) add(c.classList.contains('sub') ? 'subHelp' : 'help', tx(help), row);
    // 폰 조작 자리 (2026-11-12 전수점검 B1): 켜고 끄는 스위치는 첫 줄 오른쪽 한 자리, 「설정 →」 한 자리, 조작 줄은 카드 안쪽 왼쪽 끝 한 자리 (격자 줄만 두 자리), 조작이 카드 밖으로 안 나감
    const top = c.querySelector('.flc-top'); const cr = c.getBoundingClientRect(); const inL = top.getBoundingClientRect().left; const inR = top.getBoundingClientRect().right;
    const sw = c.querySelector('.flc-top .gx-switch, .flc-top .flc-sw'); if (sw) add('phSwitch', R(cr.right - sw.getBoundingClientRect().right), row);
    add('phGo', R(cr.right - c.querySelector('.flc-top .fl-go').getBoundingClientRect().right), row);
    for (const cell of c.querySelectorAll('.flc-c')) {
      const inRow = !!cell.closest('.flc-side.row');
      add(inRow ? 'phGridCtl' : 'phCtl', R(cell.getBoundingClientRect().left - inL), row);
      const k = cell.lastElementChild.getBoundingClientRect();
      if (k.right > inR + 0.5) out.clip.push(`폰 조작이 카드 밖으로: ${row} ${R(k.right)} > ${R(inR)}`);
    }
    if (c.querySelector(':scope > .flc-c, .flc-top ~ .gx-switch')) out.clip.push(`폰 카드에 조작 줄 밖의 조작: ${row}`);
  }
  for (const s of page.querySelectorAll('.ps-ctl > .fam-set')) {
    if (!vis(s)) continue;
    const base = s.getBoundingClientRect().left; const row = rowOf(s);
    [...s.querySelectorAll('.fam-set1')].filter(vis).forEach((p) => { const box = p.querySelector('.st-step, .gx-segs, .gx-switch'); if (box) add('pairBox', innerWidth <= 760 ? R(p.getBoundingClientRect().right - box.getBoundingClientRect().right) : R(box.getBoundingClientRect().left - p.getBoundingClientRect().left), row); add('pairCol', R((p.getBoundingClientRect().left - base) % (p.getBoundingClientRect().width + 22)), row); });
  }
  // 5) 격자 안의 딴 줄
  for (const g of page.querySelectorAll('.fl-grid .fl-pc')) {
    if (!vis(g)) continue;
    const kids = [...(g.querySelector('.fl-gbox') ?? g).children];
    const first = kids.findIndex((k) => k.querySelector('.ck-cell')); const last = kids.length - 1 - [...kids].reverse().findIndex((k) => k.querySelector('.ck-cell'));
    kids.slice(first, last + 1).forEach((k) => { if (!k.querySelector('.ck-cell')) out.ingrid.push(`${g.closest('.ps-group')?.querySelector('h3')?.textContent ?? ''}: ${(k.querySelector('.fl-name')?.textContent || k.textContent).trim().slice(0, 24)}`); });
  }
  for (const g of page.querySelectorAll('.ck-pc')) {
    if (!vis(g)) continue;
    const rows = [...g.querySelectorAll('.ck-row')]; if (rows.length < 2) continue;
    let e = rows[0].nextElementSibling;
    while (e && e !== rows[rows.length - 1]) { if (!e.classList.contains('ck-row')) out.ingrid.push(`${g.closest('.ps-group')?.querySelector('h3')?.textContent ?? ''}: ${e.textContent.trim().slice(0, 24)}`); e = e.nextElementSibling; }
  }
  return out;
};

async function nodes(page) {
  const all = [];
  for (const tab of ['set']) {
    await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tab);
    await sleep(250);
    all.push(...await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((e) => e.dataset.value).filter((v) => v && !v.startsWith('label:'))));
  }
  return [...new Set(all)];
}
/** 수 상자를 끝 값까지 눌러 본다 (0일 때의 말·가장 큰 수가 그때만 보인다). 글 수 상자(<b>)만: 입력 칸은 min·max·placeholder 로 이미 잰다 */
async function ends(page, where) {
  const n = await page.evaluate(() => [...document.querySelectorAll('.gw .gw-page .st-step')].filter((s) => s.offsetParent && s.querySelector(':scope > b')).length);
  for (let i = 0; i < n; i++) {
    for (const dir of [0, 1]) {
      let moved = 0;
      for (let k = 0; k < 14; k++) {
        const ok = await page.evaluate(([i, dir]) => { const s = [...document.querySelectorAll('.gw .gw-page .st-step')].filter((s) => s.offsetParent && s.querySelector(':scope > b'))[i]; const b = s?.querySelectorAll('.gx-step')[dir]; if (!b || b.disabled) return false; b.click(); return true; }, [i, dir]);
        if (!ok) break; moved++; await sleep(120);
      }
      const r = await page.evaluate((i) => { const s = [...document.querySelectorAll('.gw .gw-page .st-step')].filter((s) => s.offsetParent && s.querySelector(':scope > b'))[i]; const b = s?.querySelector(':scope > b'); return b ? { t: b.textContent, clip: b.scrollWidth > b.clientWidth + 1, w: Math.round(s.getBoundingClientRect().width * 10) / 10, row: (s.closest('.ps-row, .fl-line, .flc')?.querySelector('.ps-label > b, .fl-name')?.textContent ?? '').trim() } : null; }, i);
      if (r?.clip) fails.push(`${where} 잘림(끝 값): ${r.row} 「${r.t}」`);
      if (r) stepW.set(r.w, (stepW.get(r.w) ?? 0) + 1);
      for (let k = 0; k < moved; k++) { await page.evaluate(([i, dir]) => [...document.querySelectorAll('.gw .gw-page .st-step')].filter((s) => s.offsetParent && s.querySelector(':scope > b'))[i]?.querySelectorAll('.gx-step')[1 - dir]?.click(), [i, dir]); await sleep(90); }
    }
  }
}

for (const [vpName, vp] of [['PC', { width: 1920, height: 1080, touch: false }], ['폰', { width: 390, height: 844, touch: true }]]) {
  for (const [chatName, chat] of [['시작 뒤', started], ['시작 전', fresh]]) {
    const { page, errors } = await boot(browser, fx, chat(), vp);
    await openWin(page); await openEditor(page, 'manage:flow'); await sleep(600);
    const list = await nodes(page);
    for (const n of list) {
      await goNode(page, n).catch(() => {}); await sleep(450);
      const where = `[${vpName}·${chatName}] ${n}`;
      const r = await page.evaluate(probe);
      r.h.forEach((x) => fails.push(`${where} 높이≠34: ${x}`));
      r.clip.forEach((x) => fails.push(`${where} 잘림: ${x}`));
      r.mixed.forEach((x) => fails.push(`${where} 한 묶음에 수 상자 폭 여럿: ${x}`));
      r.ingrid.forEach((x) => fails.push(`${where} 격자 안에 딴 줄: ${x}`));
      for (const w of r.steps) stepW.set(w, (stepW.get(w) ?? 0) + 1);
      for (const [k, v] of Object.entries(r.x)) {
        const vals = Object.keys(v); const allow = X_ALLOW[`${n}|${k}`] ?? 1;
        if (vals.length > allow) fails.push(`${where} 자리 ${k}: ${vals.map((x) => `${x}(${v[x].length}: ${v[x][0]})`).join('  ')}`);
      }
      report.push({ where, steps: [...new Set(r.steps)].sort((a, b) => a - b), sizes: r.sizes, x: Object.fromEntries(Object.entries(r.x).map(([k, v]) => [k, Object.keys(v)])) });
      if (vpName === 'PC' && chatName === '시작 뒤') await ends(page, where);
    }
    if (errors.length) fails.push(`[${vpName}·${chatName}] 콘솔 오류 ${errors.length}: ${errors[0]}`);
    await page.close();
  }
}
await browser.close();
const widths = [...stepW.keys()].sort((a, b) => a - b);
if (widths.length > 2) fails.push(`수 상자 폭이 ${widths.length}가지: ${widths.join(', ')} (두 값만 허용)`);
if (reportAt) writeFileSync(reportAt, JSON.stringify({ widths: Object.fromEntries(stepW), fails, report }, null, 1));
console.log(`수 상자 폭: ${widths.map((w) => `${w}px(${stepW.get(w)})`).join(', ')}`);
console.log(`어긴 곳 ${fails.length}곳`);
for (const f of fails) console.log(' - ' + f);
if (fails.length && !soft) { console.error('FAIL spec'); process.exit(1); }
console.log(fails.length ? 'SOFT (실패 목록만)' : 'PASS spec');
