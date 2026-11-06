// QC · 설정 창 「바뀐 곳만 다시 그리기」 (2026-11-06 사용자, 전수점검 남은 것 6): 같은 화면에서 스위치 하나를 누르면
// 글칸·목록 요소가 그대로 남고(같은 DOM 노드), 치던 글·스크롤이 유지되며, 스위치 표시만 바뀐다. 다른 화면으로 가면 통째로 새로 그린다.
// 사용법: node tests/qc-settings-morph-browser.mjs <fixture.json> [pc|phone|land|all]
import assert from 'node:assert/strict';
import { boot, clickSel, goNode, launch, loadFixture, openEditor, openWin, setInput, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const vps = process.argv[3] === 'all' || !process.argv[3] ? Object.keys(VIEWPORTS) : [process.argv[3]];
const browser = await launch();
for (const vp of vps) {
  const { page, errors } = await boot(browser, fx, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } }, vp);
  await openWin(page);
  await page.waitForSelector('.gx-tabhead');
  await openEditor(page, 'rule:new');
  await clickSel(page, '.gw [data-action="ed-rule-new"]');
  await page.waitForSelector('.gw textarea[data-input="ed-rule-text"]');
  const ruleId = await page.$eval('.gw textarea[data-input="ed-rule-text"]', (e) => e.dataset.key);
  // 요소에 표를 남기고, 글을 치고, 본문을 조금 내린다
  await page.evaluate(() => {
    window.__ta = document.querySelector('.gw textarea[data-input="ed-rule-text"]');
    window.__body = document.querySelector('.gw .gw-body');
    window.__win = document.querySelector('.gw .gw-win');
    window.__body.scrollTop = 40;
  });
  await setInput(page, '.gw textarea[data-input="ed-rule-text"]', '치던 글', 'input');
  const before = await page.$eval(`.gw [data-action="ed-rule-on"][data-value="${ruleId}"]`, (e) => e.getAttribute('aria-checked'));
  // 스위치 하나 → 같은 화면 다시 그리기 = 바뀐 곳만
  await clickSel(page, `.gw [data-action="ed-rule-on"][data-value="${ruleId}"]`);
  await page.waitForFunction(([id, was]) => document.querySelector(`.gw [data-action="ed-rule-on"][data-value="${id}"]`)?.getAttribute('aria-checked') !== was, [ruleId, before]);
  const r = await page.evaluate(() => ({
    sameTa: window.__ta === document.querySelector('.gw textarea[data-input="ed-rule-text"]'),
    sameBody: window.__body === document.querySelector('.gw .gw-body'),
    sameWin: window.__win === document.querySelector('.gw .gw-win'),
    text: document.querySelector('.gw textarea[data-input="ed-rule-text"]').value,
    scroll: document.querySelector('.gw .gw-body').scrollTop,
    taCount: document.querySelectorAll('.gw textarea[data-input="ed-rule-text"]').length,
  }));
  assert.ok(r.sameTa && r.sameBody && r.sameWin, `${vp}: 같은 화면 다시 그리기는 요소를 바꾸지 않음 ${JSON.stringify(r)}`);
  assert.equal(r.text, '치던 글', `${vp}: 치던 글 유지`);
  assert.equal(r.taCount, 1, `${vp}: 글칸이 둘로 늘지 않음`);
  const scrollable = await page.evaluate(() => { const b = document.querySelector('.gw .gw-body'); return b.scrollHeight > b.clientHeight + 40; });
  if (scrollable) assert.equal(r.scroll, 40, `${vp}: 스크롤 유지`);
  // 폰: 서랍이 다시 묶이지 않음 (손잡이 한 번 누르면 한 번만 열림/닫힘)
  if (await page.$('.gw .ph-drawer .ph-grip')) {
    const open0 = await page.$eval('.gw .ph-drawer', (e) => e.classList.contains('open'));
    await page.evaluate(() => document.querySelector('.gw .ph-drawer .ph-grip').click());
    await page.waitForFunction((was) => document.querySelector('.gw .ph-drawer')?.classList.contains('open') !== was, open0);
    // 열린 채로 스위치를 한 번 더 → 바뀐 곳만 그리니 서랍은 열린 채
    await clickSel(page, `.gw [data-action="ed-rule-on"][data-value="${ruleId}"]`);
    await page.waitForFunction(([id, was]) => document.querySelector(`.gw [data-action="ed-rule-on"][data-value="${id}"]`)?.getAttribute('aria-checked') === was, [ruleId, before]);
    assert.equal(await page.$eval('.gw .ph-drawer', (e) => e.classList.contains('open')), !open0, `${vp}: 다시 그려도 서랍 상태 유지`);
    await page.evaluate(() => document.querySelector('.gw .ph-drawer .ph-grip').click());
    await page.waitForFunction((was) => document.querySelector('.gw .ph-drawer')?.classList.contains('open') === was, open0);
  }
  // 다른 화면으로 가면 통째로
  await goNode(page, 'guide:RP');
  await page.waitForSelector('.gw textarea[data-key="RP|0"]');
  assert.ok(await page.evaluate(() => !document.contains(window.__ta)), `${vp}: 다른 화면은 새로 그림`);
  await goNode(page, `rule:${ruleId}`).catch(() => {});
  assert.deepEqual(errors, [], `${vp}: 콘솔 오류 없음`);
  await page.close();
  console.log(`PASS 설정 창 바뀐 곳만 다시 그리기 [${vp}]`);
}
await browser.close();
