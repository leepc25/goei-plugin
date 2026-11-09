// 우주 쇼핑몰 설정 아래쪽(진열 배정·시그니처 상품) 캡처 (11-09). node tests/_shot_cos_settings.mjs [출력 폴더]
import { boot, launch, loadFixture, openEditor, openWin, closeEditor } from './qc-settings-harness.mjs';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] || '.scratch/cos-settings';
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } };
  const { page } = await boot(browser, fx, chat, size);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  await openEditor(page, 'set:cos');
  await page.waitForTimeout(400);
  for (let i = 1; i <= 3; i++) {
    await page.evaluate((k) => { const b = document.querySelector('.gw-body') ?? document.scrollingElement; const groups = [...document.querySelectorAll('.ps-group h3')]; const g = groups.find((h) => h.textContent.startsWith(k)); if (g) g.scrollIntoView({ block: 'start' }); }, i === 1 ? '진열 배정' : i === 2 ? '시그니처' : '시그니처');
    if (i === 3) await page.evaluate(() => { const b = document.querySelector('.gw-body'); if (b) b.scrollTop = b.scrollHeight; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${vp}-${i}.png` });
  }
  await page.close();
}
await browser.close();
console.log('done', OUT);
