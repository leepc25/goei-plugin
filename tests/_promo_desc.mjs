// 설정 페이지마다 맨 위 소개 글을 뽑는다: node tests/_promo_desc.mjs <fixture>
import { boot, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';
const fx = loadFixture(process.argv[2]);
const browser = await launch();
const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1' } };
const { page } = await boot(browser, fx, started, { width: 1920, height: 1200, touch: false, scale: 1 });
await openWin(page); await openEditor(page, 'set:screen');
const out = {};
for (const tab of ['set', 'world', 'guide', 'manage']) {
  await page.evaluate((t) => document.querySelector(`.gw [data-action="ed-tab"][data-value="${t}"]`)?.click(), tab); await sleep(400);
  const nodes = await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((b) => [b.dataset.value, b.innerText.trim().replace(/\s+/g, ' ')]));
  out[tab] = [];
  for (const [n, label] of nodes) {
    if (tab === 'guide' && out[tab].length > 40) break;
    await goNode(page, n); await sleep(200);
    const d = await page.evaluate(() => { const m = document.querySelector('.gw-main, .gw-body, .gw-pane') || document.querySelector('.gw'); const h = m.querySelector('h2,h3,.gw-h,.st-title'); const ps = [...m.querySelectorAll('p')].map((p) => p.innerText.trim()).filter((t) => t.length > 15).slice(0, 2); return { h: h?.innerText?.trim()?.replace(/\s+/g, ' '), ps }; });
    out[tab].push({ n, label, ...d });
  }
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
