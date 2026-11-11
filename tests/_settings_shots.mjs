// 설정 페이지 그림 찍기 (옮기기 전·후 화면을 견줄 때). 쓰는 법: node tests/_settings_shots.mjs <fixture> <outdir> [node,node…]
import { mkdirSync } from 'node:fs';
import { boot, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';
const fx = loadFixture(process.argv[2]); const out = process.argv[3];
mkdirSync(out, { recursive: true });
const only = process.argv[4]?.split(',');
const browser = await launch();
const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1' } };
for (const [vp, name] of [[{ width: 1920, height: +(process.env.PCH || 6000), touch: false, scale: +(process.env.SCALE || 1) }, 'pc'], [{ width: 390, height: +(process.env.PHH || 9000), touch: true, scale: +(process.env.SCALE || 1) }, 'phone']]) {
  const { page } = await boot(browser, fx, started, vp);
  await openWin(page);
  await openEditor(page, 'set:screen');
  const nodes = only ?? await page.evaluate(() => [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((b) => b.dataset.value));
  for (const n of nodes) {
    await goNode(page, n);
    await sleep(300);
    await page.evaluate(() => document.querySelectorAll('.gw details').forEach((d) => { d.open = true; }));
    await sleep(150);
    await page.screenshot({ path: `${out}/${name}_${n.replace(/[^\w]/g, '_')}.png` });
  }
  await page.close();
}
await browser.close();
