// QC 03 · 설정 창 모든 페이지(set:screen,image,board,gnet,phone,wiki,visit,people,adv,update)의 모든 조작을 실제로 눌러
// 값이 기기 설정(prefs) 또는 채팅 변수(setChatToIndex)에 맞게 저장되는지, 범위(이 채팅/새 채팅 기본값/시작 전)가 섞이지 않는지,
// 경계값·잘못된 입력, 다시 열었을 때 같은 값이 보이는지를 본다. 세 뷰포트.
// 사용법: node tests/qc-settings-pages-browser.mjs <fixture.json> [pc|phone|land|all]
import assert from 'node:assert/strict';
import { auditDom, boot, chatOf, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, prefsOf, setChat, setInput, sleep, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const which = process.argv[3] ?? 'all';
const vps = which === 'all' ? Object.keys(VIEWPORTS) : [which];
const browser = await launch();

const PAGES = ['screen', 'image', 'board', 'gnet', 'phone', 'wiki', 'visit', 'people', 'adv', 'update'];
/** 기능 페이지: 값은 늘 이 채팅 변수 (범위 전환 없음) */
const FEATURE = new Set(['gnet', 'phone', 'wiki', 'visit', 'people']);
/** 누르면 저장이 아니라 다른 일을 하는 단추 (확인창·네트워크·화면 이동·LLM 호출) — 전수 클릭에서 뺀다 */
const SKIP_ACTION = /^(set-scope|set-bar|set-feat-back|ed-|upd-|visit-orphans|visit-def|gn-def|ph-def|wiki-def|pp-def|pp-update|pp-backfill|pp-reread|pp-diag|pp-tidy|pp-register|pp-ignore|pp-pin|pp-jump|wiki-|adv-reset-all|adv-reset-yes|adv-reset-no|man-|ip-|dir-|mk-|nav-|tab|close)/;
const CHANGE_SKIP = /^(ed-|dir-|ip-|pp-diag-all|pp-backfill-turns|pp-reread-turns)/;

/** 저장 상태 스냅샷 */
async function snap(page) {
  return page.evaluate(() => ({ prefs: window.__store['p:goei:prefs'] ?? '', chat: JSON.stringify(window.__chat.scriptstate ?? {}), setChat: window.__calls.setChat.length }));
}
async function settle(page) {
  // 저장(비동기) → 다시 그리기. busy 표시가 사라질 때까지
  await sleep(120);
  await page.waitForFunction(() => !document.querySelector('.gw .gw-setbody [disabled][data-action^="set-"]:not(.gx-step):not(.gx-seg)') || true);
  await sleep(80);
}

/** 페이지의 조작 목록: 단추(눌리지 않은 것)·스위치·입력칸·드롭다운·막대 */
async function controls(page) {
  return page.evaluate(() => {
    const body = document.querySelector('.gw .gw-setbody');
    if (!body) return [];
    const out = [];
    const rowOf = (el) => el.closest('.ps-row, .dir-line, .dir-in, .st-col-row')?.querySelector('.ps-label > b, .st-col-name > b, span:first-child')?.textContent?.trim() ?? '';
    const scopeBadge = (el) => el.closest('.ps-row, .st-col-row')?.querySelector('.gx-scope')?.textContent?.trim() ?? '';
    const device = (el) => scopeBadge(el) === '이 기기';
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const btns = [...body.querySelectorAll('button[data-action]')];
    btns.forEach((b, i) => {
      if (b.disabled || !vis(b)) return;
      const sw = b.getAttribute('role') === 'switch';
      if (!sw && (b.classList.contains('on') || b.getAttribute('aria-pressed') === 'true')) return;
      out.push({ kind: sw ? 'switch' : 'button', action: b.dataset.action, value: b.dataset.value ?? '', row: rowOf(b), device: device(b), badge: scopeBadge(b), i, text: b.textContent.trim().slice(0, 20) });
    });
    const inputs = [...body.querySelectorAll('[data-change]')];
    inputs.forEach((el, i) => {
      if (el.disabled || !vis(el) || el.tagName === 'BUTTON') return;
      out.push({ kind: el.tagName === 'SELECT' ? 'select' : el.type === 'range' ? 'range' : el.type === 'number' ? 'number' : el.type === 'checkbox' ? 'checkbox' : 'text', action: el.dataset.change, key: el.dataset.key ?? '', row: rowOf(el), device: device(el), badge: scopeBadge(el), i, value: el.value, min: el.min, max: el.max, step: el.step, name: el.name ?? '' });
    });
    return out;
  });
}

async function clickControl(page, c) {
  if (c.kind === 'button' || c.kind === 'switch') {
    await page.evaluate((c) => {
      const body = document.querySelector('.gw .gw-setbody');
      const b = [...body.querySelectorAll('button[data-action]')].filter((x) => x.dataset.action === c.action && (x.dataset.value ?? '') === c.value && !x.disabled)[0];
      if (!b) throw new Error(`no button ${c.action}=${c.value}`);
      b.click();
    }, c);
    return;
  }
  await page.evaluate((c) => {
    const body = document.querySelector('.gw .gw-setbody');
    const el = [...body.querySelectorAll('[data-change]')].filter((x) => x.dataset.change === c.action && (x.dataset.key ?? '') === c.key && (x.name ?? '') === c.name)[0];
    if (!el) throw new Error(`no input ${c.action}:${c.key}`);
    if (c.kind === 'select') {
      const opts = [...el.options];
      const cur = el.selectedIndex;
      el.selectedIndex = (cur + 1) % opts.length;
    } else if (c.kind === 'checkbox') el.checked = !el.checked;
    else if (c.kind === 'range' || c.kind === 'number') {
      const min = Number(el.min || 0);
      const max = Number(el.max || 100);
      const step = Number(el.step || 1);
      const cur = Number(el.value || 0);
      let next = cur + step;
      if (next > max) next = cur - step;
      if (next < min) next = min;
      el.value = String(next);
      if (c.kind === 'range') el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.value = c.value === 'qc 글' ? 'qc 글 2' : 'qc 글';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, c);
}

/** 한 페이지의 조작 전수 클릭. mode: 'chat' | 'defaults' | 'pre' (시작 전) */
async function sweepPage(page, pageId, mode, log) {
  const done = new Set();
  let guard = 0;
  let clicked = 0;
  for (;;) {
    const list = (await controls(page)).filter((c) => !SKIP_ACTION.test(c.action) && !CHANGE_SKIP.test(c.action));
    const next = list.find((c) => !done.has(`${c.kind}|${c.action}|${c.value ?? ''}|${c.key ?? ''}|${c.row}|${c.name ?? ''}`));
    if (!next || guard++ > 400) break;
    done.add(`${next.kind}|${next.action}|${next.value ?? ''}|${next.key ?? ''}|${next.row}|${next.name ?? ''}`);
    const before = await snap(page);
    await clickControl(page, next);
    await settle(page);
    const after = await snap(page);
    const prefsChanged = before.prefs !== after.prefs;
    const chatChanged = before.chat !== after.chat;
    const wroteChat = after.setChat > before.setChat;
    const label = `[${pageId}/${mode}] ${next.row} · ${next.action}=${next.value ?? next.key}`;
    clicked++;
    // 기대: 기능 페이지는 늘 채팅 변수. 그 밖은 「이 기기」 배지면 prefs, 아니면 범위대로
    const expect = FEATURE.has(pageId) ? 'chat' : next.device ? 'prefs' : next.badge === '이 채팅' ? 'chat' : next.badge === '새 채팅 기본값' ? 'prefs' : mode === 'chat' ? 'chat' : 'prefs';
    // 확인창을 여는 조작(상황판 끄기)·저장 안 하는 조작은 둘 다 안 바뀔 수 있다: 그건 따로 본다
    if (next.action === 'set-anomaly' && next.value === 'off' && mode === 'chat') {
      assert.ok(!prefsChanged && !wroteChat, `${label}: 끄기는 확인창만`);
      assert.ok(await page.$('.gw [data-action="set-anomaly"][data-value="off-yes"]'), `${label}: 확인창`);
      await page.evaluate(() => document.querySelector('.gw [data-action="set-anomaly"][data-value="off-no"]').click());
      await settle(page);
      continue;
    }
    if (!prefsChanged && !chatChanged && !wroteChat) {
      // 바뀐 게 없는 조작: 기록만 (같은 값으로 저장 생략 등)
      log.push(`${label}: 변화 없음`);
      continue;
    }
    if (expect === 'prefs') {
      assert.ok(prefsChanged, `${label}: 기기 설정/기본값에 저장돼야 함 (prefs 그대로, chat ${wroteChat ? '씀' : '안 씀'})`);
      assert.ok(!wroteChat && !chatChanged, `${label}: 채팅에 섞여 저장됨`);
    } else {
      assert.ok(wroteChat && chatChanged, `${label}: 채팅 변수에 저장돼야 함 (setChat ${wroteChat}, 변화 ${chatChanged}, prefs ${prefsChanged ? '바뀜' : '그대로'})`);
      assert.ok(!prefsChanged, `${label}: 기기 설정에 섞여 저장됨`);
    }
    const err = await page.$('.gw .gw-setbody .gx-err, .gw .gw-notice.err');
    if (err) log.push(`${label}: 오류 표시 「${(await err.textContent()).trim().slice(0, 80)}」`);
  }
  return clicked;
}

/** 페이지 본문 HTML 을 값 비교용으로 정규화 (토스트·알림·토큰 수 제외) */
const pageSig = (page) => page.evaluate(() => {
  const body = document.querySelector('.gw .gw-setbody');
  if (!body) return '';
  const clone = body.cloneNode(true);
  clone.querySelectorAll('.gx-toast, .gx-err, .gx-hint, .ps-note, .gw-tokens, .st-toast, [role="status"], [role="alert"], .pp-diag, .lc-row, details').forEach((e) => e.remove());
  return clone.innerHTML.replace(/\s+/g, ' ');
});

for (const vp of vps) {
  const log = [];
  let total = 0;
  // ── 시작 전 (picker): 모든 값은 새 채팅 기본값(prefs) 또는 이 채팅(기능 페이지) ──
  {
    const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, vp);
    await openWin(page);
    await page.waitForSelector('.gx-fac');
    await openEditor(page, 'set:screen');
    assert.equal(await page.$('.gw [data-action="set-scope"]'), null, `${vp}: 시작 전엔 범위 전환 없음`);
    for (const p of PAGES) {
      await goNode(page, `set:${p}`);
      await page.waitForSelector('.gw .gw-setbody');
      if (p === 'update') continue; // 네트워크 흐름은 1번 요원 몫. 화면만: 아래에서 따로 본다
      total += await sweepPage(page, p, 'pre', log);
      const a = await auditDom(page, '.gw');
      assert.deepEqual(a.missing, [], `${vp} ${p}: 글자·aria-label 없는 단추`);
      if (vp !== 'pc') assert.deepEqual(a.overflow, [], `${vp} ${p}: 가로 넘침`);
    }
    // 다시 열어도 같은 값: 화면 페이지 (prefs)
    await goNode(page, 'set:screen');
    const sig1 = await pageSig(page);
    await closeEditor(page);
    await openEditor(page, 'set:screen');
    assert.equal(await pageSig(page), sig1, `${vp}: 다시 열어도 화면 설정 같음`);
    // 시작 전엔 chat 에 $st_* 설정 변수가 섞이지 않았다 (기능 페이지 변수는 예외)
    const ss = (await chatOf(page)).scriptstate ?? {};
    const leaked = Object.keys(ss).filter((k) => /^\$(st_(asset|agent|support|fixed_theme|col_|wallet)|wg_)/.test(k));
    assert.deepEqual(leaked, [], `${vp}: 시작 전 설정이 채팅에 섞임`);
    assert.deepEqual(errors, [], `${vp}: 시작 전 오류`);
    await closeEditor(page, true);
    await page.close();
  }
  // ── 시작 뒤: 이 채팅 / 새 채팅 기본값 ──
  {
    const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } };
    const { page, errors } = await boot(browser, fx, started, vp);
    await openWin(page);
    await page.waitForSelector('.gx-tabhead');
    await openEditor(page, 'set:board');
    for (const mode of ['chat', 'defaults']) {
      for (const p of PAGES) {
        await goNode(page, `set:${p}`);
        await page.waitForSelector('.gw .gw-setbody');
        if (p === 'update') continue;
        const seg = await page.$(`.gw [data-action="set-scope"][data-value="${mode}"]`);
        if (seg) {
          await page.evaluate((m) => document.querySelector(`.gw [data-action="set-scope"][data-value="${m}"]`).click(), mode);
          await page.waitForFunction((m) => document.querySelector(`.gw [data-action="set-scope"][data-value="${m}"]`)?.classList.contains('on'), mode);
        } else if (!FEATURE.has(p) && p !== 'screen') assert.fail(`${vp} ${p}: 범위 전환 없음`);
        total += await sweepPage(page, p, mode, log);
        const a = await auditDom(page, '.gw');
        assert.deepEqual(a.missing, [], `${vp} ${p}/${mode}: 글자·aria-label 없는 단추`);
        if (vp !== 'pc') assert.deepEqual(a.overflow, [], `${vp} ${p}/${mode}: 가로 넘침`);
      }
    }
    // 범위 전환 시 값이 뒤섞이지 않는다: 요원 표시 인원을 이 채팅 3, 기본값 7 로 두고 번갈아 본다
    await goNode(page, 'set:board');
    const setAgent = async (mode, n) => {
      await page.evaluate((m) => document.querySelector(`.gw [data-action="set-scope"][data-value="${m}"]`).click(), mode);
      await page.waitForFunction((m) => document.querySelector(`.gw [data-action="set-scope"][data-value="${m}"]`)?.classList.contains('on'), mode);
      for (let i = 0; i < 30; i++) {
        const cur = Number((await page.textContent('.gw [data-action="set-agent"] + b, .gw .st-step:has([data-action="set-agent"]) b')).replace(/\D/g, ''));
        if (cur === n) break;
        await page.evaluate((d) => document.querySelector(`.gw [data-action="set-agent"][data-value="n:${d}"]`).click(), cur < n ? '+' : '-');
        await settle(page);
      }
    };
    const shownAgent = () => page.evaluate(() => Number(document.querySelector('.gw .st-step:has([data-action="set-agent"]) b').textContent.replace(/\D/g, '')));
    await setAgent('chat', 3);
    await setAgent('defaults', 7);
    assert.equal(await shownAgent(), 7);
    assert.equal((await prefsOf(page)).basic.agentLimit, 7, '기본값 7');
    assert.equal((await chatOf(page)).scriptstate.$st_agent_limit, '3', '이 채팅 3');
    await setAgent('chat', 3);
    assert.equal(await shownAgent(), 3, '이 채팅으로 돌아오면 3');
    // 스테퍼 경계: 0 에서 − 잠김, 20 에서 + 잠김
    await setAgent('chat', 0);
    assert.equal(await page.isDisabled('.gw [data-action="set-agent"][data-value="n:-"]'), true, '0명에서 − 잠김');
    await setAgent('chat', 20);
    assert.equal(await page.isDisabled('.gw [data-action="set-agent"][data-value="n:+"]'), true, '20명에서 + 잠김');
    assert.equal((await chatOf(page)).scriptstate.$st_agent_limit, '20');
    // 괴이 발생 수치 경계: 확률 100 에서 + 잠김, 유지 시간 8760 에서 + 잠김, 0 에서 − 잠김
    const worldBtn = (k, op) => `.gw [data-action="set-world"][data-value="${k}:${op}"]`;
    const pushWorld = async (k, op, times) => { for (let i = 0; i < times; i++) { if (await page.isDisabled(worldBtn(k, op))) break; await page.evaluate((s) => document.querySelector(s).click(), worldBtn(k, op)); await settle(page); } };
    await pushWorld('preset_p', '+', 12);
    assert.equal(await page.isDisabled(worldBtn('preset_p', '+')), true, '확률 100% 에서 + 잠김');
    assert.equal((await chatOf(page)).scriptstate.$wg_preset_p, '100');
    await pushWorld('preset_p', '-', 12);
    assert.equal(await page.isDisabled(worldBtn('preset_p', '-')), true, '확률 0% 에서 − 잠김');
    assert.equal((await chatOf(page)).scriptstate.$wg_preset_p, '0');
    await pushWorld('preset_cap', '-', 5);
    assert.equal((await chatOf(page)).scriptstate.$wg_preset_cap, '0');
    assert.equal(await page.isDisabled(worldBtn('preset_cap', '-')), true);
    // 자동 종료 OFF 면 유지 시간 줄이 사라진다
    const expireOff = await page.$('.gw [data-action="set-world"][data-value="preset_expire:0"]');
    if (expireOff) {
      await page.evaluate(() => document.querySelector('.gw [data-action="set-world"][data-value="preset_expire:0"]').click());
      await settle(page);
      assert.equal(await page.$(worldBtn('preset_ttl', '+')), null, '자동 종료 OFF → 유지 시간 줄 없음');
      await page.evaluate(() => document.querySelector('.gw [data-action="set-world"][data-value="preset_expire:1"]').click());
      await settle(page);
      assert.ok(await page.$(worldBtn('preset_ttl', '+')), '자동 종료 ON → 유지 시간 줄');
    }
    // 시작 잔고: 한글 단위·잘못된 값·음수·소수·빈 칸·너무 긴 수
    await page.evaluate(() => document.querySelector('.gw [data-action="set-scope"][data-value="chat"]').click());
    await settle(page);
    const won = '.gw .st-won';
    if (await page.$(won)) {
      const chatWon = async () => JSON.parse((await chatOf(page)).scriptstate.$st_wallet ?? '{}');
      const tryWon = async (text) => { await setInput(page, won, text); await settle(page); return [await page.$eval(won, (e) => e.value), (await chatWon()).start]; };
      // 이야기가 시작된 채팅이라 잔고 직접 수정이 꺼져 있으면 잠겨 있다
      if (await page.isDisabled(won)) {
        const editOn = await page.$('.gw [data-action="set-wallet-edit"][role="switch"]');
        assert.ok(editOn, '잔고 직접 수정 스위치');
        await page.evaluate(() => document.querySelector('.gw [data-action="set-wallet-edit"][role="switch"]').click());
        await settle(page);
        assert.equal(await page.isDisabled(won), false, '잔고 직접 수정 ON → 시작 잔고 열림');
      }
      assert.deepEqual(await tryWon('120만'), ['1,200,000', 1200000], '120만 → 1,200,000');
      assert.deepEqual(await tryWon('3억 5천'), ['300,005,000', 300005000], '한글 단위 억·천');
      const before = (await chatWon()).start;
      for (const bad of ['-5', '1.5', '', 'abc', '9'.repeat(30), '１２３']) {
        const [shown, saved] = await tryWon(bad);
        assert.equal(saved, before, `잘못된 입력 「${bad}」 은 저장 안 함`);
        assert.equal(shown, before.toLocaleString('en-US'), `잘못된 입력 「${bad}」 뒤 칸은 원래 값`);
      }
      assert.deepEqual(await tryWon('1,000,000,000,000'), ['1,000,000,000,000', 1000000000000], '상한 1조');
      assert.equal((await tryWon('1,000,000,000,001'))[1], 1000000000000, '1조 넘으면 저장 안 함');
      assert.deepEqual(await tryWon('0'), ['0', 0], '0원');
    }
    // 고급(생성 공통) 숫자 칸: 음수·소수·빈 칸·너무 큰 수·글자
    await goNode(page, 'set:adv');
    const retries = '.gw input.adv-val[data-key="gen:retries"]';
    const genVal = async () => (await chatOf(page)).scriptstate['$gen_retries'];
    const tryAdv = async (t) => { await setInput(page, retries, t); await settle(page); return [await page.$eval(retries, (e) => e.value), await genVal()]; };
    assert.deepEqual(await tryAdv('2'), ['2', '2']);
    assert.deepEqual(await tryAdv('-5'), ['0', '0'], '음수 → 최소');
    assert.deepEqual(await tryAdv('1.7'), ['2', '2'], '소수 → 반올림');
    assert.deepEqual(await tryAdv('99'), ['3', '3'], '상한');
    assert.deepEqual(await tryAdv(''), ['1', ''], '빈 칸 → 기본값');
    assert.deepEqual((await tryAdv('abc'))[1], '', '글자 → 기본값');
    const budget = '.gw input.adv-val[data-key="gen:budget"]';
    await setInput(page, budget, '1200000');
    await settle(page);
    assert.equal(await page.$eval(budget, (e) => e.value), '200000', '토큰 상한 200000 으로 자름');
    // adv 되돌리기 단추: 바뀐 줄에만 보이고 누르면 기본값
    assert.ok(await page.$('.gw [data-action="adv-reset"][data-value="gen:budget"]'), '바뀐 줄에 되돌리기');
    await page.evaluate(() => document.querySelector('.gw [data-action="adv-reset"][data-value="gen:budget"]').click());
    await settle(page);
    assert.equal((await chatOf(page)).scriptstate['$gen_budget'], '', '되돌리기 → 빈 값');
    assert.equal(await page.$('.gw [data-action="adv-reset"][data-value="gen:budget"]'), null, '기본값이면 되돌리기 없음');
    // 화면 페이지: 창 폭 50~100 (PC) · 테마 3종이 창(.gx)·편집 창(.gw)에 적용 · 메뉴 위치 · 바깥 어둡기
    await goNode(page, 'set:screen');
    for (const w of ['60', '70', '80', '90', '100']) {
      await page.evaluate((w) => document.querySelector(`.gw [data-action="set-editor-width"][data-value="${w}"]`).click(), w);
      await settle(page);
      const width = await page.evaluate(() => document.querySelector('.gw-win').getBoundingClientRect().width);
      if (vp === 'pc') assert.ok(Math.abs(width - (1100 * Number(w)) / 100) < 4, `창 폭 ${w}% → ${width}`);
      else assert.ok(Math.abs(width - VIEWPORTS[vp].width) < 2, `폰은 늘 전체 폭 (${w}% → ${width})`);
    }
    for (const t of ['light', 'paper', 'dark']) {
      await page.evaluate((t) => document.querySelector(`.gw [data-action="set-theme"][data-value="${t}"]`).click(), t);
      await settle(page);
      assert.equal((await chatOf(page)).scriptstate.$st_fixed_theme, t, `테마 ${t}: 이 채팅에`);
      assert.equal(await page.evaluate(() => document.querySelector('.gx').dataset.theme), t, `테마 ${t}: 창 배색`);
      assert.equal(await page.evaluate(() => document.querySelector('.gw').dataset.theme), t, `테마 ${t}: 편집 창 배색`);
      assert.equal((await prefsOf(page)).theme, undefined, `테마 ${t}: 시작 뒤엔 기본값을 건드리지 않음`);
    }
    for (const side of ['right', 'left']) {
      await page.evaluate((s) => document.querySelector(`.gw [data-action="set-nav"][data-value="${s}"]`).click(), side);
      await settle(page);
      assert.equal(await page.evaluate(() => document.querySelector('.gx').dataset.nav), side, `메뉴 ${side}`);
    }
    for (const d of ['0', '100', '50']) {
      await setInput(page, '.gw input[data-input="dim"]', d);
      await settle(page);
      assert.equal((await prefsOf(page)).dim, Number(d), `어둡기 ${d}`);
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.gx')).backgroundColor);
      if (d === '0') assert.ok(/rgba\(\d+, \d+, \d+, 0\)/.test(bg), `0% → 투명 (${bg})`);
      if (d === '100') assert.ok(/^rgb\(/.test(bg), `100% → 불투명 (${bg})`);
    }
    // details(접는 칸)는 조작 뒤 다시 그려도 펼친 채로 (인물 기록 「기능」 칸)
    await goNode(page, 'set:people');
    const det = await page.$('.gw details[data-keep="pp-feat"]');
    if (det) {
      await page.evaluate(() => { const d = document.querySelector('.gw details[data-keep="pp-feat"]'); d.open = true; d.dispatchEvent(new Event('toggle')); });
      await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="pp-set"][role="switch"]')].pop().click());
      await settle(page);
      assert.equal(await page.evaluate(() => document.querySelector('.gw details[data-keep="pp-feat"]')?.open), true, '접는 칸은 조작 뒤에도 펼친 채');
    }
    // 다시 열었을 때 같은 값 (상황판·이미지 페이지, 이 채팅 범위)
    for (const p of ['board', 'image']) {
      await goNode(page, `set:${p}`);
      await page.evaluate(() => document.querySelector('.gw [data-action="set-scope"][data-value="chat"]').click());
      await settle(page);
      const s1 = await pageSig(page);
      await closeEditor(page);
      await openEditor(page, `set:${p}`);
      await page.evaluate(() => document.querySelector('.gw [data-action="set-scope"][data-value="chat"]').click());
      await settle(page);
      assert.equal(await pageSig(page), s1, `${p}: 다시 열어도 같은 값`);
    }
    // 업데이트 페이지: 화면만 (확인 단추·버전 글자)
    await goNode(page, 'set:update');
    assert.ok(await page.$('.gw [data-action="upd-check"]'), '업데이트 확인 단추');
    await closeEditor(page, true);
    await closeWin(page);
    assert.deepEqual(errors, [], `${vp}: 시작 뒤 오류`);
    await page.close();
  }
  console.log(`PASS 설정 페이지 [${vp}]: 조작 ${total}회`);
  for (const l of log) console.log('  ·', l);
}
await browser.close();
