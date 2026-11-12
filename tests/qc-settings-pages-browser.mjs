// QC 03 · 설정 창 모든 페이지(set:screen,image,board,gnet,phone,wiki,visit,people,journal,adv,update)의 모든 조작을 실제로 눌러
// 값이 기기 설정(prefs) 또는 채팅 변수(setChatToIndex)에 맞게 저장되는지, 범위(이 채팅/새 채팅 기본값/시작 전)가 섞이지 않는지,
// 경계값·잘못된 입력, 다시 열었을 때 같은 값이 보이는지를 본다. 세 뷰포트.
// 사용법: node tests/qc-settings-pages-browser.mjs <fixture.json> [pc|phone|land|all]
import assert from 'node:assert/strict';
import { auditDom, boot, chatOf, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, prefsOf, setChat, setInput, sleep, isPhoneVp, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const which = process.argv[3] ?? 'all';
const vps = which === 'all' ? Object.keys(VIEWPORTS) : [which];
const browser = await launch();

const PAGES = ['screen', 'image', 'board', 'status', 'net', 'phone', 'wiki', 'journal', 'items', 'people', 'factions', 'lore', 'adv']; // 11-09: 업데이트는 점검 → 설치·업데이트(install) 페이지로 합쳐짐
/** 기능 페이지: 값은 늘 이 채팅 변수 (범위 전환 없음) */
const FEATURE = new Set(['net', 'phone', 'wiki', 'people', 'journal', 'factions']);
/** 누르면 저장이 아니라 다른 일을 하는 단추 (확인창·네트워크·화면 이동·LLM 호출) — 전수 클릭에서 뺀다 */
const SKIP_ACTION = /^(set-scope|set-bar|set-feat-back|ed-|upd-|visit-orphans|visit-def|gn-def|ph-def|wiki-def|pp-def|jr-def|rec-|pp-update|pp-backfill|pp-reread|pp-diag|pp-tidy|pp-register|pp-ignore|pp-pin|pp-jump|wiki-|man-|ip-|dir-|mk-|nav-|tab|close)/;
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
    // 입력칸·막대·드롭다운은 value 가 「지금 값」이라 열쇠에 넣으면 누를 때마다 새 조작으로 보여 400번까지 돌았다: 단추만 value 를 넣는다.
    // 스테퍼 단추(adv-set=gn:x=25 → 24 → …)도 value 끝의 수가 매번 바뀌므로 수를 떼고 단추 글자(−/+)로 가른다
    const id = (c) => `${c.kind}|${c.action}|${c.kind === 'button' || c.kind === 'switch' ? `${(c.value ?? '').replace(/=-?[\d.]+$/, '=#')}|${c.text}` : ''}|${c.key ?? ''}|${c.row}|${c.name ?? ''}`;
    const next = list.find((c) => !done.has(id(c)));
    if (!next || guard++ > 400) break;
    done.add(id(next));
    const t0 = Date.now();
    const before = await snap(page);
    await clickControl(page, next);
    await settle(page);
    const after = await snap(page);
    const prefsChanged = before.prefs !== after.prefs;
    const chatChanged = before.chat !== after.chat;
    const wroteChat = after.setChat > before.setChat;
    const label = `[${pageId}/${mode}] ${next.row} · ${next.action}=${next.value ?? next.key}`;
    clicked++;
    if (process.env.QC_VERBOSE) console.log(`  ${label} (${Date.now() - t0}ms)`);
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
    if (!prefsChanged && !chatChanged && wroteChat) {
      // 「저장」 단추로 같은 글을 다시 저장: 채팅에 같은 값을 쓴다 (기기 설정은 안 건드림). 범위는 맞다
      assert.equal(expect, 'chat', `${label}: 기본값 범위인데 채팅에 씀`);
      log.push(`${label}: 같은 값 다시 저장`);
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
  // ── 시작 뒤: 늘 이 채팅 (범위 칩 없음, 2026-10-29) ──
  {
    const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } };
    const { page, errors } = await boot(browser, fx, started, vp);
    await openWin(page);
    await page.waitForSelector('.gx-tabhead');
    await openEditor(page, 'set:board');
    for (const mode of ['chat']) {
      for (const p of PAGES) {
        await goNode(page, `set:${p}`);
        await page.waitForSelector('.gw .gw-setbody');
        if (p === 'update') continue;
        assert.equal(await page.$('.gw [data-action="set-scope"]'), null, `${vp} ${p}: 범위 칩 없음`);
        assert.equal(await page.locator('.gw .gw-top [data-action="set-bar"]').count(), 0, `${vp} ${p}: 창 머리에 저장 단추 없음 (2026-11-08 사용자: 바로 저장, 기본값은 점검 → 저장·불러오기)`);
        total += await sweepPage(page, p, mode, log);
        const a = await auditDom(page, '.gw');
        assert.deepEqual(a.missing, [], `${vp} ${p}/${mode}: 글자·aria-label 없는 단추`);
        if (vp !== 'pc') assert.deepEqual(a.overflow, [], `${vp} ${p}/${mode}: 가로 넘침`);
      }
    }
    // 기본값으로 저장·불러오기: 요원 표시 인원을 3으로 두고 저장 → 기본값 3, 7로 바꾼 뒤 불러오기 → 3 (이 채팅 값만 바뀜)
    await goNode(page, 'set:board');
    const bar = async (what) => {
      await goNode(page, 'manage:backup');
      await page.evaluate((w) => document.querySelector(`.gw [data-action="set-bar"][data-value="${w}"]`).click(), what);
      await page.waitForSelector(`.gw .gw-confirm [data-action="set-bar-yes"][data-value="${what}"]`);
      await page.evaluate((w) => document.querySelector(`.gw .gw-confirm [data-action="set-bar-yes"][data-value="${w}"]`).click(), what);
      await page.waitForFunction(() => !document.querySelector('.gw .gw-confirm'));
      await settle(page);
      await goNode(page, 'set:board');
    };
    const setAgent = async (_mode, n) => {
      for (let i = 0; i < 30; i++) {
        const cur = Number((await page.textContent('.gw [data-action="set-agent"] + b, .gw .st-step:has([data-action="set-agent"]) b')).replace(/\D/g, ''));
        if (cur === n) break;
        await page.evaluate((d) => document.querySelector(`.gw [data-action="set-agent"][data-value="n:${d}"]`).click(), cur < n ? '+' : '-');
        await settle(page);
      }
    };
    const shownAgent = () => page.evaluate(() => Number(document.querySelector('.gw .st-step:has([data-action="set-agent"]) b').textContent.replace(/\D/g, '')));
    await setAgent('chat', 3);
    await bar('save');
    assert.equal((await prefsOf(page)).basic.agentLimit, 3, '기본값으로 저장 → 기본값 3');
    await setAgent('chat', 7);
    assert.equal((await chatOf(page)).scriptstate.$st_agent_limit, '7', '이 채팅 7');
    assert.equal((await prefsOf(page)).basic.agentLimit, 3, '이 채팅을 바꿔도 기본값은 3');
    await bar('load');
    assert.equal(await shownAgent(), 3, '기본값 불러오기 → 이 채팅 3');
    assert.equal((await chatOf(page)).scriptstate.$st_agent_limit, '3');
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
    // 시작 잔고: 한글 단위·잘못된 값·음수·소수·빈 칸·너무 긴 수 (가계부 묶음은 소지품 페이지, 2026-11-12 사용자)
    await goNode(page, 'set:items');
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
    // 상점 페이지의 가게 표·기능 표·양 표 (2026-11-12): 칸을 누르면 그 칸의 변수에만 저장되고 다시 그린 칸에 그 값이 보인다
    await goNode(page, 'set:shop');
    await settle(page);
    {
      const twin = isPhoneVp(vp) ? '.ck-ph' : '.ck-pc';
      const ss = async () => (await chatOf(page)).scriptstate;
      const cell = (key) => `.gw ${twin} [data-action="fam-set"][data-value^="${key}="]`;
      const pressed = (key) => page.$eval(cell(key), (e) => e.getAttribute('aria-pressed'));
      const tap = async (key) => { await page.evaluate((s) => document.querySelector(s).click(), cell(key)); await settle(page); };
      const heads = await page.evaluate((t) => [...document.querySelectorAll(`.gw ${t}`)].filter((g) => g.querySelector('h3')?.textContent === '넘길 내용').map((g) => [...g.querySelectorAll('.ck-h2 > span')].slice(1).map((s) => s.textContent)), twin);
      assert.deepEqual(heads, Array(2).fill(['봇 설명', '작가 노트', '페르소나', '상시 로어북', '관련 로어북', '2차 참조', '맥락 반영']), `[${vp}] 「넘길 내용」 격자 둘의 칸 이름`);
      // 가게 표: 기본값 (봇 설명·상시·관련·맥락 켬, 작가 노트·페르소나·2차 끔) → 우주 쇼핑몰의 작가 노트만 켠다
      for (const shop of ['shop', 'cos', 'bm']) {
        assert.deepEqual(await Promise.all(['give_desc', 'give_authors', 'give_persona', 'give_active', 'give_related', 'give_secondary', 'ctx'].map((k) => pressed(`s:${shop}:${k}`))), ['true', 'false', 'false', 'true', 'true', 'false', 'true'], `[${vp}] 가게 표 기본값 ${shop}`);
      }
      assert.equal(await page.$(cell('s:hs:give_desc')), null, '망상홈쇼핑 줄은 없다');
      await tap('s:cos:give_authors');
      assert.equal((await ss()).$cos_sh_give_authors, '1');
      assert.equal(await pressed('s:cos:give_authors'), 'true', '다시 그린 칸이 켜져 있다');
      assert.deepEqual([await pressed('s:shop:give_authors'), await pressed('s:bm:give_authors'), (await ss()).$sh_give_authors, (await ss()).$bm_sh_give_authors], ['false', 'false', undefined, undefined], '다른 가게는 그대로');
      // 맥락 반영은 가게마다 따로
      await tap('s:bm:ctx');
      assert.equal((await ss()).$bm_sh_ctx, '0');
      assert.deepEqual([await pressed('s:bm:ctx'), await pressed('s:cos:ctx'), await pressed('s:shop:ctx')], ['false', 'true', 'true']);
      // 기능 표: 세 가게가 같이 쓰는 한 값. 1:1 상담의 맥락 반영은 없는 칸(「–」)
      assert.deepEqual(await Promise.all(['shelf', 'talk', 'desk'].map((f) => pressed(`s:shop:fn_${f}_persona`))), ['true', 'true', 'true']);
      assert.equal(await page.$(cell('s:shop:fn_desk_ctx')), null, '1:1 상담 · 맥락 반영 칸은 조작이 없다');
      await tap('s:shop:fn_talk_persona');
      assert.equal((await ss()).$sh_fn_talk_persona, '0');
      assert.deepEqual(await Promise.all(['shelf', 'talk', 'desk'].map((f) => pressed(`s:shop:fn_${f}_persona`))), ['true', 'false', 'true'], '그 기능의 줄만 꺼진다');
      // 양 표: − + 와 직접 치기, 범위 밖은 끝값으로
      const num = (key) => `.gw ${isPhoneVp(vp) ? '.mx-grid.ck-ph' : '.ck-pc'} input.adv-val[data-change="fam-num"][data-key="s:shop:${key}"]`;
      assert.deepEqual([await page.$eval(num('fn_shelf_turns'), (e) => e.value), await page.$eval(num('fn_desk_refs'), (e) => e.value)], ['3', '6'], '정하지 않은 기능은 챗로그 3턴·참조 로어북 6개');
      await page.evaluate((s) => document.querySelector(s).closest('.st-step').querySelectorAll('button.gx-step')[1].click(), num('fn_talk_turns'));
      await settle(page);
      assert.equal((await ss()).$sh_fn_talk_turns, '4');
      assert.deepEqual([await page.$eval(num('fn_talk_turns'), (e) => e.value), await page.$eval(num('fn_shelf_turns'), (e) => e.value)], ['4', '3']);
      await setInput(page, num('fn_desk_refs'), '99');
      await settle(page);
      assert.equal((await ss()).$sh_fn_desk_refs, '12', '상한 12');
      await setInput(page, num('fn_desk_refs'), '0');
      await settle(page);
      assert.deepEqual([(await ss()).$sh_fn_desk_refs, await page.$eval(num('fn_desk_refs'), (e) => e.value), (await ss()).$sh_refs], ['0', '0', undefined], '0개 · 같이 쓰던 값($sh_refs)은 건드리지 않는다');
      // 옮겨 간 줄은 「같이 쓰는 값」에 없다
      const rows = await page.evaluate(() => [...document.querySelectorAll('.gw .ps-row > .ps-label > b')].map((b) => b.textContent.trim()));
      for (const gone of ['맥락 반영', '챗로그 포함', '참조 로어북']) assert.ok(!rows.includes(gone), `「${gone}」 줄은 격자로 옮겨 갔다`);
      for (const kept of ['생각 단계', '다양성 강화', '지난 목록 피하기']) assert.ok(rows.includes(kept), `「${kept}」 줄은 그대로`);
      // 다시 열어도 같은 값
      await closeEditor(page);
      await openEditor(page, 'set:shop');
      await settle(page);
      assert.deepEqual([await pressed('s:cos:give_authors'), await pressed('s:bm:ctx'), await pressed('s:shop:fn_talk_persona'), await page.$eval(num('fn_talk_turns'), (e) => e.value)], ['true', 'false', 'false', '4'], `[${vp}] 다시 열어도 같은 값`);
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
    assert.equal(await page.$('.gw [data-action="adv-reset"]'), null, '칸마다 되돌리기 단추 없음 (11-08 사용자: 초기화는 점검 한 곳)');
    // 화면 페이지: 창 폭 50~100 (PC) · 테마 3종이 창(.gx)·편집 창(.gw)에 적용 · 메뉴 위치 · 바깥 어둡기
    await goNode(page, 'set:screen');
    for (const w of ['60', '70', '80', '90', '100']) {
      await page.evaluate((w) => document.querySelector(`.gw [data-action="set-editor-width"][data-value="${w}"]`).click(), w);
      await settle(page);
      const width = await page.evaluate(() => document.querySelector('.gw-win').getBoundingClientRect().width);
      // 폰 배치(폰 세로·폰 가로)는 늘 전체 폭. PC 는 % 를 따른다 (2026-11-06: 폰 가로도 폰 배치)
      const W = VIEWPORTS[vp].width;
      if (!isPhoneVp(vp)) assert.ok(Math.abs(width - (W * Number(w)) / 100) < 4, `창 폭 ${w}% → ${width}`);
      else assert.ok(Math.abs(width - W) < 2, `폰은 늘 전체 폭 (${w}% → ${width})`);
    }
    // 위의 「기본값으로 저장」이 테마도 기본값에 넣었으니(한 번에 전부), 여기서는 「테마 줄은 기본값을 안 건드린다」만 본다
    const theme0 = (await prefsOf(page)).theme;
    for (const t of ['light', 'paper', 'dark']) {
      await page.evaluate((t) => document.querySelector(`.gw [data-action="set-theme"][data-value="${t}"]`).click(), t);
      await settle(page);
      assert.equal((await chatOf(page)).scriptstate.$st_fixed_theme, t, `테마 ${t}: 이 채팅에`);
      assert.equal(await page.evaluate(() => document.querySelector('.gx').dataset.theme), t, `테마 ${t}: 창 배색`);
      assert.equal(await page.evaluate(() => document.querySelector('.gw').dataset.theme), t, `테마 ${t}: 편집 창 배색`);
      assert.equal((await prefsOf(page)).theme, theme0, `테마 ${t}: 시작 뒤엔 기본값을 건드리지 않음`);
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
      await settle(page);
      const s1 = await pageSig(page);
      await closeEditor(page);
      await openEditor(page, `set:${p}`);
      await settle(page);
      assert.equal(await pageSig(page), s1, `${p}: 다시 열어도 같은 값`);
    }
    // 업데이트 페이지: 화면만 (확인 단추·버전 글자)
    await goNode(page, 'install');
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
