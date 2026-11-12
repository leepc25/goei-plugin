// 왼쪽 메뉴 묶음(호출·표시·기능)과 가계부 → 소지품 합침 (2026-11-12 사용자): 「설정 →」 도착, 켜고 끄기, 설정 찾기, 시작 전 기본값, PC·폰
// 사용법: node tests/menu-merge-browser.mjs
import assert from 'node:assert/strict';
import { boot, chatOf, goNode, launch, loadFixture, openEditor, openWin, prefsOf, sleep } from './qc-settings-harness.mjs';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const CHAR = '문을 열었다.\n[▣|2025.01.01|02:47 PM|☀️|4°C|본부|목표|없음|대기|관리국/요원|100000]';
const started = () => ({ message: [{ role: 'user', data: '간다.', chatId: 'u1' }, { role: 'char', data: CHAR, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1' } });
const b = await launch(); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
for (const vp of ['pc', 'phone']) {
  { const { page, errors } = await boot(b, fx, started(), vp);
    await openWin(page); await sleep(300); await openEditor(page, 'manage:flow'); await sleep(300);
    const titles = await page.evaluate(() => [...document.querySelectorAll('.gw .gw-tree-group h4')].map((h) => h.textContent.trim()));
    ok(JSON.stringify(titles) === JSON.stringify(['호출', '표시', '기능']), `[${vp}] 묶음 ${titles}`);
    ok(await page.evaluate(() => !document.querySelector('.gw [data-action="ed-node"][data-value="set:wallet"]')), `[${vp}] 메뉴에 가계부 없음`);
    // 호출 흐름 가계부 줄의 「설정 →」 → 소지품 페이지, 가계부 묶음의 「사용」 줄이 밝혀짐
    const go = await page.evaluate(() => { const b = [...document.querySelectorAll('.gw [data-action="ed-flow-go"]')].find((x) => x.dataset.value.includes('가계부')); const v = b?.dataset.value; b?.click(); return v; });
    ok(go === 'set:items|r:사용@가계부', `[${vp}] 설정 → 값 ${go}`); await sleep(500);
    const hit = await page.evaluate(() => { const on = document.querySelector('.gw .gw-tree-item.on')?.dataset.value; const f = document.querySelector('.gw .gw-find-flash'); return { on, grp: f?.closest('.ps-group')?.querySelector('h3')?.textContent.trim(), act: f?.querySelector('[data-action^="set-wallet-on"], [data-action="set-wallet-on"]') ? 1 : 0, html: f?.className }; });
    ok(hit.on === 'set:items' && hit.grp === '가계부', `[${vp}] 도착 ${JSON.stringify(hit)}`);
    // 가계부 끄고 켜기: 같은 페이지에서
    await page.evaluate(() => document.querySelector('.gw [data-action="set-wallet-on"][data-value="0"]')?.click()); await sleep(500);
    ok((await chatOf(page)).scriptstate.$st_col_wallet === 'off', `[${vp}] 가계부 끔 저장`);
    const groups = await page.evaluate(() => [...document.querySelectorAll('.gw .gw-body .ps-group > h3')].map((h) => h.childNodes[0]?.textContent.trim()));
    ok(groups.includes('가계부') && !groups.includes('잔고'), `[${vp}] 끄면 가계부 묶음에 사용만: ${groups}`);
    await page.evaluate(() => document.querySelector('.gw [data-action="set-wallet-on"][data-value="1"]')?.click()); await sleep(500);
    ok((await chatOf(page)).scriptstate.$st_col_wallet === 'on', `[${vp}] 가계부 켬 저장`);
    // 설정 찾기: 「잔고 직접 수정」 → 소지품 페이지
    await page.evaluate(() => { const i = document.querySelector('.gw .gw-find input, .gw input.gw-find, .gw [data-input="ed-find"]'); if (i) { i.value = '잔고 직접'; i.dispatchEvent(new Event('input', { bubbles: true })); } }); await sleep(500);
    const found = await page.evaluate(() => [...document.querySelectorAll('.gw .gw-find-hit')].map((x) => x.textContent.trim()));
    ok(found.some((t) => t.includes('잔고 직접 수정') && t.includes('소지품')), `[${vp}] 찾기 ${JSON.stringify(found).slice(0, 200)}`);
    ok(errors.length === 0, `[${vp}] 콘솔 오류 ${errors.slice(0, 2)}`);
    await page.close(); }
  { // 시작 전: 소지품 페이지의 가계부 사용 → 새 채팅 기본값
    const { page, errors } = await boot(b, fx, { message: [], scriptstate: {} }, vp);
    await openWin(page); await sleep(300); await openEditor(page, 'set:items'); await sleep(300);
    await page.evaluate(() => document.querySelector('.gw [data-action="set-wallet-on"][data-value="0"]')?.click()); await sleep(500);
    ok((await prefsOf(page)).vars?.$st_col_wallet === 'off', `[${vp}] 시작 전 가계부 끔 = 기본값 ${JSON.stringify((await prefsOf(page)).vars)}`);
    ok(errors.length === 0, `[${vp}] 시작 전 콘솔 오류 ${errors.slice(0, 2)}`);
    await page.close(); }
}
await b.close(); console.log(`PASS ${n}`);
