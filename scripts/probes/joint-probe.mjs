import { boot, launch, loadFixture, openWin, closeEditor } from '../../tests/qc-settings-harness.mjs';
import { distPack } from '../../tests/data-init.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fx = loadFixture('.scratch/fixture/fixture.json');
const browser = await launch();
const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, 'pc', { store: { 'p:goei:data-looks': distPack('goei-data-looks') } });
page.on('console', (m) => { const t = m.text(); if (/goei|통합|괴담/.test(t)) console.log('[console]', t.slice(0, 200)); });
await openWin(page); await sleep(400);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) {
  await page.evaluate(() => document.querySelector('.gw [data-action="ed-tab"][data-value="manage"]')?.click());
  await page.evaluate(() => document.querySelector('.gw [data-action="ed-node"][data-value="install"]')?.click());
  await sleep(200); await page.evaluate(() => document.querySelector('.gw [data-action="ed-inst-all"]')?.click()); await sleep(1500);
  await closeEditor(page, true).catch(() => {});
}
await page.waitForSelector('.gx-fac');
await page.evaluate(() => document.querySelector('.gx-fac[data-value="A00"]').click());
await page.evaluate(() => document.querySelector('.gx-sc[data-value="2"]')?.click());
await page.waitForFunction(() => !document.querySelector('.gx-start')?.disabled, null, { timeout: 5000 });
await page.evaluate(() => document.querySelector('.gx-start').click());
await sleep(800);
// 두 자동 호출 「매 턴」 (설정 화면이 쓰는 값과 같게)
await page.evaluate(() => { Object.assign(window.__chat.scriptstate, { '$lb_cfg_lb-gn.lazy': '0', '$ph_auto': '1' }); window.__calls.llm = []; });
const ss = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.__chat.scriptstate).filter(([k]) => /lazy|ph_auto|ph_model|lb-gn\.mode|adv_model|ph_adv_model/.test(k)))));
console.log('settings', ss);
await page.evaluate(async () => {
  window.__chat.message.push({ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '쟈알디가 손을 흔들었다. 에일린이 휴대폰을 봤다.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC]', chatId: 'c1' });
  await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(window.__chat)), characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
});
await sleep(8000);
const calls = await page.evaluate(() => (window.__calls.llm || []).map((o) => { const s = JSON.stringify(o); return s.slice(0, 160); }));
console.log('LLM calls:', calls.length); for (const c of calls) console.log(' -', c);
console.log('errors', errors.slice(0, 5));
await browser.close();
