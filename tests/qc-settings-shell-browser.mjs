// QC 03 · 창 뼈대: 열기/닫기 50회 누수(document 리스너·노드 수), 편집 창 열기/닫기 50회, 뒤로/앞으로·폰 쓸기 뒤로,
// 즐겨찾기 5개 상한, 메뉴 왼쪽/오른쪽, 바깥 어둡기 단계, 테마 3종이 패널·편집 창 모든 페이지에 적용(배색 변수), 창 폭 50~100 (저장값 검사),
// 폰 한 열·가로 넘침 없음·글칸 전체 폭, 편집 창 서랍, Esc·바깥 클릭 닫기.
// 사용법: node tests/qc-settings-shell-browser.mjs <fixture.json> [pc|phone|land|all]
import assert from 'node:assert/strict';
import { auditDom, boot, clickSel, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, prefsOf, sleep, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const which = process.argv[3] ?? 'all';
const vps = which === 'all' ? Object.keys(VIEWPORTS) : [which];
const browser = await launch();
const started = () => ({ message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } });
const EDITOR_NODES = ['set:screen', 'set:image', 'set:board', 'set:gnet', 'set:phone', 'set:wiki', 'set:visit', 'set:people', 'set:journal', 'set:adv', 'set:update', 'agent', 'org', 'anomaly', 'site', 'appendix', 'base', 'relations', 'guide:RP', 'guide:Image', 'rule:new', 'install', 'manage:diag', 'manage:log', 'manage:backup'];
const PANEL_TABS = ['board', 'map', 'mission', 'phone', 'gnet', 'wiki', 'records', 'wallet'];
// 유령 버튼은 다시 보일 때 리스너를 떼고 다시 건다(떼기마다 비동기) → 그게 끝난 뒤에 잰다
const measure = async (page) => (await sleep(400), page.evaluate(() => ({ listeners: window.__docListeners, nodes: document.querySelectorAll('*').length, styles: document.querySelectorAll('style').length })));

for (const vp of vps) {
  const phone = vp !== 'pc';
  const narrow = VIEWPORTS[vp].width <= 760; // 편집 창 한 열·서랍·쓸기 뒤로·상황판 서랍은 화면 760px 이하 (폰 가로 844 는 PC 배치)
  const { page, errors } = await boot(browser, fx, started(), vp);
  // ── 열기/닫기 50회 ──
  await openWin(page);
  await page.waitForSelector('.gx-tabhead');
  await closeWin(page);
  await openWin(page);
  await closeWin(page);
  const m0 = await measure(page);
  for (let i = 0; i < 50; i++) {
    await openWin(page);
    await closeWin(page);
  }
  await openWin(page);
  await closeWin(page);
  const m1 = await measure(page);
  assert.ok(m1.listeners - m0.listeners <= 2, `${vp}: 창 열기/닫기 50회 뒤 document 리스너 ${m0.listeners} → ${m1.listeners}`);
  assert.ok(m1.nodes - m0.nodes <= 20, `${vp}: 노드 수 ${m0.nodes} → ${m1.nodes}`);
  assert.equal(m1.styles, m0.styles, `${vp}: style 태그 수`);
  // ── 편집 창 열기/닫기 50회 ──
  await openWin(page);
  await openEditor(page, 'set:screen');
  await closeEditor(page);
  const e0 = await measure(page);
  for (let i = 0; i < 50; i++) {
    await openEditor(page, EDITOR_NODES[i % EDITOR_NODES.length]);
    await closeEditor(page, true);
  }
  // 닫힌 창은 숨길 뿐 마지막 페이지를 들고 있으니 같은 페이지로 돌려놓고 잰다
  await openEditor(page, 'set:screen');
  await closeEditor(page);
  const e1 = await measure(page);
  assert.ok(e1.listeners - e0.listeners <= 2, `${vp}: 편집 창 50회 뒤 document 리스너 ${e0.listeners} → ${e1.listeners}`);
  assert.ok(e1.nodes - e0.nodes <= 40, `${vp}: 편집 창 노드 수 ${e0.nodes} → ${e1.nodes}`);
  assert.equal(e1.styles, e0.styles, `${vp}: style 태그 수`);
  assert.equal(await page.evaluate(() => document.querySelectorAll('.gw').length), 1, '편집 창 뿌리 하나');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.gx').length), 1, '패널 뿌리 하나');

  // ── 테마 3종 × 패널 탭·편집 창 페이지: data-theme 이 붙고 배색 변수가 풀린다 (값이 빈 변수 없음) ──
  const unresolved = (page, sel) => page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const cs = getComputedStyle(root);
    const bad = [];
    for (const v of ['--void', '--panel', '--panel2', '--line', '--text', '--sub', '--dim', '--signal', '--accent-bg', '--accent-line', '--danger', '--amber', '--scrim']) if (!cs.getPropertyValue(v).trim()) bad.push(v);
    // 글자색이 배경색과 같아 안 보이는 요소가 있나 (본문 글)
    const same = [];
    for (const el of root.querySelectorAll('.gw-setbody b, .gw-setbody small, .gx-body b, h2, h3')) {
      const s = getComputedStyle(el);
      if (s.color === s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') same.push(el.tagName + '.' + el.className);
    }
    return { bad, same: same.slice(0, 5) };
  }, sel);
  for (const t of ['light', 'paper', 'dark']) {
    await openEditor(page, 'set:screen');
    await clickSel(page, `.gw [data-action="set-theme"][data-value="${t}"]`);
    await page.waitForFunction((t) => document.querySelector('.gx')?.dataset.theme === t && document.querySelector('.gw')?.dataset.theme === t, t);
    for (const n of EDITOR_NODES) {
      await goNode(page, n);
      const u = await unresolved(page, '.gw');
      assert.deepEqual(u.bad, [], `${vp} ${t} ${n}: 빈 배색 변수`);
      assert.deepEqual(u.same, [], `${vp} ${t} ${n}: 글자색 = 배경색`);
      if (phone) {
        const a = await auditDom(page, '.gw');
        assert.deepEqual(a.overflow, [], `${vp} ${t} ${n}: 가로 넘침`);
        assert.ok(a.scrollW <= VIEWPORTS[vp].width + 1, `${vp} ${n}: 페이지 가로 스크롤 ${a.scrollW}`);
      }
    }
    await closeEditor(page, true);
    for (const tab of PANEL_TABS) {
      await page.evaluate((tab) => [...document.querySelectorAll(`.gx [data-action="tab"][data-value="${tab}"], .gx [data-action="nav-tab"][data-value="${tab}"]`)].pop()?.click(), tab);
      await sleep(150);
      const u = await unresolved(page, '.gx');
      assert.deepEqual(u.bad, [], `${vp} ${t} 탭 ${tab}: 빈 배색 변수`);
      if (phone) {
        // 쓸기 닫기 손잡이(gx-mclose)·가로 쓸기 목록(위키 레일·세력 사진·장면 띠)은 일부러 화면 밖까지 이어진다: 그 안쪽 요소까지 뺀다
        const a = await auditDom(page, '.gx .gx-panel', '.gx-mclose, .gx-mtrack, .nw-rail, .nw-panel, .gx-fac-img, .gx-facs, .gx-scs');
        assert.deepEqual(a.overflow, [], `${vp} ${t} 탭 ${tab}: 가로 넘침`);
      }
    }
  }
  await page.evaluate(() => [...document.querySelectorAll('.gx [data-value="board"]')].pop()?.click());

  // ── 뒤로/앞으로 (PC 단추) · 폰 쓸기 ──
  const goTab = async (tab) => {
    await page.evaluate((tab) => [...document.querySelectorAll(`.gx [data-action="tab"][data-value="${tab}"], .gx [data-action="nav-tab"][data-value="${tab}"]`)].pop()?.click(), tab);
    await page.waitForFunction((tab) => document.querySelector('.gx')?.dataset.tab === tab, tab);
  };
  const curTab = () => page.evaluate(() => document.querySelector('.gx').dataset.tab);
  await goTab('wiki');
  await goTab('phone');
  if (!narrow) {
    await clickSel(page, '.gx [data-action="nav-back"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.tab === 'wiki');
    await clickSel(page, '.gx [data-action="nav-back"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.tab === 'board');
    await clickSel(page, '.gx [data-action="nav-fwd"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.tab === 'wiki');
    await clickSel(page, '.gx [data-action="nav-fwd"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.tab === 'phone');
    assert.equal(await page.isDisabled('.gx [data-action="nav-fwd"]'), true, '맨 끝이면 앞으로 잠김');
  } else {
    // 오른쪽으로 쓸면 뒤로, 왼쪽으로 쓸면 앞으로 (화면 가운데에서)
    const swipe = async (dir) => {
      const box = await page.$eval('.gx .gx-content', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      const x0 = box.x - dir * 60;
      await page.touchscreen.tap; // noop (hasTouch 확인)
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: box.y }] });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dir * 25 * i, y: box.y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await sleep(250);
    };
    await swipe(1);
    assert.equal(await curTab(), 'wiki', '오른쪽 쓸기 → 뒤로');
    await swipe(-1);
    assert.equal(await curTab(), 'phone', '왼쪽 쓸기 → 앞으로');
    await swipe(1);
    await swipe(1);
    assert.equal(await curTab(), 'board');
  }

  // ── 즐겨찾기 5개 상한 ──
  const openMarks = async () => {
    if (!narrow) await clickSel(page, '.gx [data-action="mk-pop"]');
    else await page.evaluate(() => [...document.querySelectorAll('.gx .gx-bdrawer [data-action="mk-pop"], .gx [data-action="mk-pop"]')].pop()?.click());
    await page.waitForSelector('.gx .mk-pop');
  };
  // 기본 즐겨찾기 4개(2026-10-29 사용자)가 처음부터 있다 → 화면에서 모두 지우고 시작
  await openMarks();
  while (await page.$('.gx .mk-pop [data-action="mk-del"]')) { await clickSel(page, '.gx .mk-pop [data-action="mk-del"]'); await sleep(60); }
  assert.equal(((await prefsOf(page)).marks ?? []).length, 0, '기본 즐겨찾기 지움');
  await page.evaluate(() => document.querySelector('.gx .mk-pop [data-action="mk-pop"]')?.click());
  await sleep(80);
  for (const tab of ['board', 'wiki', 'phone', 'gnet', 'map', 'wallet']) {
    await goTab(tab);
    await openMarks();
    const n = ((await prefsOf(page)).marks ?? []).length;
    const here = await page.$('.gx .mk-pop [data-action="mk-here"]');
    if (tab === 'wallet') {
      assert.ok(!here || (await page.isDisabled('.gx .mk-pop [data-action="mk-here"]')), '5개면 「지금 화면」 잠김');
      assert.ok((await page.textContent('.gx .mk-pop')).includes('5개까지'), '상한 안내');
      assert.equal((await prefsOf(page)).marks.length, 5);
    } else {
      assert.ok(here, `${tab}: 지금 화면 추가 단추`);
      await clickSel(page, '.gx .mk-pop [data-action="mk-here"]');
      await page.waitForFunction((n) => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').marks ?? []).length === n + 1, n);
    }
    await page.evaluate(() => document.querySelector('.gx .mk-pop [data-action="mk-pop"]')?.click());
    await sleep(80);
  }
  await openMarks();
  assert.ok((await page.textContent('.gx .mk-head')).includes('5/5'));
  await clickSel(page, '.gx .mk-pop [data-action="mk-del"][data-value="0"]');
  await page.waitForFunction(() => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').marks ?? []).length === 4);
  // 즐겨찾기로 이동
  await clickSel(page, '.gx .mk-pop [data-action="mk-go"][data-value="0"]');
  await page.waitForFunction(() => document.querySelector('.gx')?.dataset.tab === 'wiki');
  if (narrow) {
    await goTab('board');
    // 회귀: 이 채팅은 상황판이 꺼져 있다(빈 화면). 그래도 서랍은 있어야 한다
    assert.equal(await page.locator('.gx .gx-bdrawer .mk-slot').count(), 5, '폰 상황판 서랍 다섯 칸');
  }
  await page.evaluate(() => { const p = JSON.parse(window.__store['p:goei:prefs'] ?? '{}'); delete p.marks; window.__store['p:goei:prefs'] = JSON.stringify(p); });

  // ── 메뉴 왼쪽/오른쪽 (PC) · 바깥 어둡기 단계 ──
  await openEditor(page, 'set:screen');
  if (!narrow) {
    const navSide = () => page.evaluate(() => { const n = document.querySelector('.gx .gx-nav').getBoundingClientRect(); const p = document.querySelector('.gx .gx-panel').getBoundingClientRect(); return n.left - p.left < p.right - n.right ? 'left' : 'right'; });
    assert.equal(await navSide(), 'left');
    await clickSel(page, '.gw [data-action="set-nav"][data-value="right"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.nav === 'right');
    assert.equal(await navSide(), 'right', '메뉴 오른쪽');
    const popSide = async () => { await closeEditor(page); await openMarks(); const r = await page.$eval('.gx .mk-pop', (e) => e.getBoundingClientRect()); const n = await page.$eval('.gx .gx-nav', (e) => e.getBoundingClientRect()); await page.evaluate(() => document.querySelector('.gx .mk-pop [data-action="mk-pop"]')?.click()); await openEditor(page, 'set:screen'); return r.left >= n.right - 1 ? 'left' : r.right <= n.left + 1 ? 'right' : 'overlap'; };
    // 즐겨찾기 창은 메뉴 바로 옆에 뜬다: 메뉴가 오른쪽이면 창은 메뉴의 왼쪽 가장자리 안쪽(겹치지 않음). 폭이 좁으면 창 가운데를 넘을 수 있어 좌우 거리로는 못 잰다
    assert.equal(await popSide(), 'right', '즐겨찾기 창도 오른쪽 메뉴 옆 (메뉴와 겹치지 않음)');
    await clickSel(page, '.gw [data-action="set-nav"][data-value="left"]');
    await page.waitForFunction(() => document.querySelector('.gx')?.dataset.nav === 'left');
  }
  for (const d of [0, 25, 50, 75, 100]) {
    await page.evaluate((d) => { const el = document.querySelector('.gw input[data-input="dim"]'); el.value = String(d); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, d);
    await page.waitForFunction((d) => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').dim === d, d);
    const alpha = await page.evaluate(() => { const bg = getComputedStyle(document.querySelector('.gx')).backgroundColor; const m = /rgba?\(\d+, \d+, \d+(?:, ([\d.]+))?\)/.exec(bg); return m ? Number(m[1] ?? 1) : -1; });
    assert.ok(Math.abs(alpha - d / 100) < 0.02, `어둡기 ${d}% → alpha ${alpha}`);
    assert.equal(await page.$eval('.gw input[data-input="dim"] + output', (e) => e.textContent), `${d}%`);
  }
  await closeEditor(page);

  // ── 폰(760px 이하): 편집 창 서랍(메뉴) · 한 열 · 글칸 전체 폭 · 드롭다운 ──
  if (narrow) {
    await openEditor(page, 'set:board');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gw .gw-tree')).transform !== 'none'), true, '서랍은 숨어 있다');
    // 회귀: 닫힌 서랍은 Tab·읽어 주기에서도 빠진다 (visibility hidden), 열면 보인다
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gw .gw-tree')).visibility), 'hidden', '닫힌 서랍 visibility');
    await clickSel(page, '.gw [data-action="ed-drawer"]');
    await page.waitForFunction(() => document.querySelector('.gw .gw-win')?.classList.contains('drawer'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.gw .gw-tree')).visibility === 'visible');
    await clickSel(page, '.gw [data-action="ed-node"][data-value="set:image"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-win')?.classList.contains('drawer') && document.querySelector('.gw .gw-tree-item.on')?.dataset.value === 'set:image');
    const cols = await page.evaluate(() => [...document.querySelectorAll('.gw .ps-row')].map((r) => getComputedStyle(r).gridTemplateColumns.trim().split(/\s+/).length));
    assert.ok(cols.length && cols.every((c) => c === 1), `폰 줄은 한 열 (${[...new Set(cols)].join(',')})`);
    await goNode(page, 'set:gnet');
    const widths = await page.evaluate(() => [...document.querySelectorAll('.gw .ps-row textarea, .gw .ps-ctl > input.ps-text')].map((t) => { const w = t.getBoundingClientRect().width; const p = t.closest('.ps-row').getBoundingClientRect().width; return Math.round((w / p) * 100); }));
    assert.ok(widths.length && widths.every((w) => w >= 85), `폰 글칸 전체 폭 (${widths.join(',')}%)`);
    await goNode(page, 'agent');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gw .gw-list-pick')).display !== 'none'), true, '폰 세계 탭은 드롭다운');
    await closeEditor(page);
  }

  // ── 창 폭 저장값: 50~100 밖은 버리고 기본 90, 55 는 55 ──
  await page.evaluate(() => { const p = JSON.parse(window.__store['p:goei:prefs'] ?? '{}'); p.editorWidth = 30; window.__store['p:goei:prefs'] = JSON.stringify(p); });
  await closeWin(page);
  await page.evaluate(() => window.__button.cb());
  await page.waitForSelector('.gx-tabhead');
  await openEditor(page, 'manage:backup');
  await page.waitForSelector('.gw textarea[data-input="man-import-text"]');
  const applyPrefs = async (json) => {
    await page.evaluate((j) => { const el = document.querySelector('.gw textarea[data-input="man-import-text"]'); el.value = j; el.dispatchEvent(new Event('input', { bubbles: true })); }, json);
    await clickSel(page, '.gw [data-action="man-import"]');
    await page.waitForSelector('.gw [data-action="man-import-yes"]');
    await clickSel(page, '.gw [data-action="man-import-yes"]');
    await page.waitForFunction(() => document.querySelector('.gw .gw-head')?.textContent?.includes('가져왔어요'));
    await goNode(page, 'set:screen');
    await goNode(page, 'manage:backup');
  };
  await applyPrefs('{"editorWidth": 30}');
  assert.equal((await prefsOf(page)).editorWidth, undefined, '30% 은 버림');
  if (!phone) assert.ok(Math.abs((await page.$eval('.gw-win', (e) => e.getBoundingClientRect().width)) - 990) < 4, '기본 90%');
  await applyPrefs('{"editorWidth": 55}');
  assert.equal((await prefsOf(page)).editorWidth, 55);
  if (!phone) assert.ok(Math.abs((await page.$eval('.gw-win', (e) => e.getBoundingClientRect().width)) - 605) < 4, '55%');
  await applyPrefs('{}');

  // ── Esc · 바깥 클릭 ──
  await goNode(page, 'set:screen');
  await clickSel(page, '.gw [data-action="set-nav"][data-value="right"]'); // 단추를 눌러 다시 그린 뒤에도
  await sleep(150);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
  assert.equal(await page.evaluate(() => document.querySelector('.gx')?.style.display), '', 'Esc 로 편집 창만 닫히고 패널은 남는다');
  await openEditor(page, 'set:screen');
  await clickSel(page, '.gw [data-action="set-nav"][data-value="left"]');
  await sleep(150);
  if (!narrow) {
    await page.mouse.click(2, 2);
    await page.waitForFunction(() => document.querySelector('.gw')?.hidden === true);
    assert.equal(await page.evaluate(() => document.querySelector('.gx')?.style.display), '', '바깥 클릭으로 편집 창만 닫힘');
  } else {
    // 760px 이하는 편집 창이 화면 전체라 바깥이 없다: 닫기 단추로
    assert.equal(await page.evaluate(() => Math.round(document.querySelector('.gw .gw-win').getBoundingClientRect().width)), VIEWPORTS[vp].width, '폰 편집 창은 화면 전체');
    await closeEditor(page);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
  assert.deepEqual(errors, [], `${vp}: 오류`);
  console.log(`PASS 창 뼈대 [${vp}]: 리스너 ${m0.listeners}→${m1.listeners}, 노드 ${m0.nodes}→${m1.nodes}; 편집 창 리스너 ${e0.listeners}→${e1.listeners}, 노드 ${e0.nodes}→${e1.nodes}`);
  await page.close();
}
await browser.close();
