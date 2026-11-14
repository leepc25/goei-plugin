// 세계 탭에서 요원 하나를 연 화면: node tests/_promo_world.mjs <fixture> <out.png>
import { boot, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';
const fx = loadFixture(process.argv[2]);
const browser = await launch();
const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1' } };
const { page } = await boot(browser, fx, started, { width: 1920, height: 1200, touch: false, scale: 1 });
await openWin(page); await openEditor(page, 'agent'); await sleep(400);
const ok = await page.evaluate(() => { const el = [...document.querySelectorAll('.gw button, .gw [data-action]')].find((e) => /에일린/.test(e.innerText || '') && e.getBoundingClientRect().width > 0); if (!el) return false; el.click(); return el.dataset.action || el.className; });
console.log('clicked', ok); await sleep(900);
await page.screenshot({ path: process.argv[3] });
await browser.close();
