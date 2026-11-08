// 인터넷 브라우저 캡처 (2026-11-08, 작업용): node tests/_br_shots.mjs <사진 폴더>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin } from './qc-settings-harness.mjs';

const OUT = process.argv[2] || '.scratch/br-shots';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const vp of ['pc', 'phone']) {
  const chat = {
    message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' },
  };
  const { page, errors } = await boot(browser, fx, chat, vp);
  let n = 0;
  const shot = async (tag) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  try {
    await openWin(page); await page.waitForTimeout(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    await page.waitForTimeout(300);
    if (vp === 'pc') {
      await click('[data-action="nav-tab"][data-value="net"]'); await shot('newtab');
      await click('.br-bm[data-value="gn"]'); await shot('gn');
      await click('[data-action="br-new"]'); await click('.br-bm[data-value="wk"]'); await shot('wk');
      await click('[data-action="br-new"]'); await click('.br-bm[data-value="sm"]'); await shot('sm-soon');
      await click('[data-action="br-tab"][data-value="0"]'); await shot('back-to-gn');
      await click('[data-action="br-login"]'); await shot('login');
      await page.fill('.br-in', '밤샘요원'); await click('[data-action="br-login-save"]'); await shot('logged');
      await click('[data-action="br-close"][data-value="0"]'); await shot('closed0');
    } else {
      await click('.gx-cgrip'); await shot('drawer');
      await click('[data-action="br-site"][data-value="gn"]'); await shot('gn');
      await click('.gx-cgrip'); await click('[data-action="br-site"][data-value="wk"]'); await shot('wk');
      await click('[data-action="br-list"]'); await shot('tablist');
      await click('[data-action="br-list"]'); await click('[data-action="br-login"]'); await shot('login');
    }
  } catch (e) { console.log(vp, 'ERR', e.message); await page.screenshot({ path: `${OUT}/${vp}-ERR.png` }); }
  if (errors.length) console.log(vp, 'page errors:', errors.slice(0, 5));
  await page.close();
}
await browser.close();
