// 시안 캡처 (작업용): 방송 중 · 대사 끝나 기다리는 중 · 채팅 읽는 중
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';
import { SHOW } from './homeshop-show.mjs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const [vp, size] of [['pc', { width: 1920, height: 1080, touch: false, scale: 2 }], ['phone', 'phone']]) {
  const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $hs_speed: '30', $hs_hold: '4' } };
  const { page } = await boot(browser, fx, chat, size, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
  if (vp !== 'phone') { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="hs"]'); }
  else { await click('.gx-cgrip'); await click('[data-action="br-site"][data-value="hs"]'); }
  await page.waitForSelector('.hs-l3', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const cutNow = () => page.evaluate(() => (document.querySelector('.hs-scr')?.dataset.clip || '').slice(0, 1));
  const until = async (k) => { for (let i = 0; i < 150; i++) { if ((await cutNow()) === k) return true; await page.waitForTimeout(200); } return false; };
  await until('A'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${vp}_1_와이드.png` });
  await until('B'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${vp}_2_진행자.png` });
  const vs = page.viewportSize();
  await page.mouse.move(vp === 'pc' ? 860 : vs.width / 2, vs.height / 2);
  for (let k = 3; k < 7; k++) {
    const before = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop).join(','));
    await page.mouse.wheel(0, Math.round(vs.height * 0.6));
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => e.scrollTop).join(','));
    if (after === before) break;
    await page.screenshot({ path: `${OUT}/${vp}_${k}_아래로.png` });
  }
  await page.close();
}
await browser.close();
console.log('ok');
