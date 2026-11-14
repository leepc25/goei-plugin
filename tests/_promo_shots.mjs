// 홍보글용 캡처 (2026-11-14, 작업용): node tests/_promo_shots.mjs <폴더>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin } from './qc-settings-harness.mjs';
const OUT = process.argv[2] || '.scratch/promo';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부 3층|신입 교육 수료]';
const VP = { pc: { width: 1280, height: 860, touch: false }, phone: { width: 390, height: 844, touch: true } };
for (const vp of ['pc', 'phone']) {
  for (const mode of ['start', 'play']) {
    const chat = mode === 'start' ? { message: [], scriptstate: {} } : {
      message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }],
      scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' },
    };
    const { page, errors } = await boot(browser, fx, chat, VP[vp]);
    let n = 0;
    const shot = async (tag) => { await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${vp}-${mode}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
    const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
    try {
      await openWin(page); await page.waitForTimeout(400);
      if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
      await shot('open');
      if (mode === 'play') for (const t of ['board', 'map', 'phone', 'net', 'items', 'records']) {
        const ok = await click(`[data-action="nav-tab"][data-value="${t}"]`) || await click(`[data-action="tab"][data-value="${t}"]`);
        await shot(t + (ok ? '' : '-NO'));
      }
      console.log(vp, mode, await page.evaluate(() => [...document.querySelectorAll('.gx [data-action]')].map((e) => e.dataset.action + ':' + (e.dataset.value || '')).filter((v, i, a) => a.indexOf(v) === i).slice(0, 80).join(' ')));
    } catch (e) { console.log(vp, mode, 'ERR', e.message); await page.screenshot({ path: `${OUT}/${vp}-${mode}-ERR.png` }); }
    if (errors.length) console.log(vp, 'page errors:', errors.slice(0, 3));
    await page.close();
  }
}
await browser.close();
