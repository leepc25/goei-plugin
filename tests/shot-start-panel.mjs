// 시작 패널 사진 (2026-11-08 사용자: 시작 잔고 칸·태블릿 세로 3:4). 사용법: node tests/shot-start-panel.mjs <out-dir>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/start-shots';
mkdirSync(out, { recursive: true });
const b = await launch();
for (const [vp, size] of [['pc', { width: 1600, height: 1000 }], ['pc-tall', { width: 1920, height: 1300 }]]) {
  const { page } = await boot(b, fx, { message: [], scriptstate: {} }, 'pc', { store: { 'p:goei:data-looks': distPack('goei-data-looks') } });
  await page.setViewportSize(size);
  await openWin(page);
  await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForSelector('.gx-fac');
  await page.evaluate(() => document.querySelector('.gx-fac[data-value="A00"]').click());
  await sleep(300);
  await page.evaluate(() => document.querySelector('.gx-sc')?.click());
  await sleep(300);
  await page.screenshot({ path: `${out}/${vp}.png` });
  await page.evaluate(() => document.querySelector('.gx-wallet-start')?.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await page.screenshot({ path: `${out}/${vp}_wallet.png` });
  await page.close();
}
await b.close();
console.log('ok', out);
