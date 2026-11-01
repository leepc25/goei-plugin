// 통합창 게임 연결 시험: ` 열기(게임 멈춤)·Q·E 탭·방향키·` 닫기·Esc 닫기(일시정지 안 뜸). 먼저 npm run build. 사진 /tmp/cw_g_*.png
import { openField, enterHub } from './field-harness.mjs';
const { browser, page, errors } = await openField({ width: 1600, height: 960 });
await enterHub(page);
const shot = (n) => page.screenshot({ path: `/tmp/cw_g_${n}.png` });
const paused = () => page.evaluate(() => !!window.__goeiEngine?.world?.paused);
await shot('0_before');
await page.keyboard.press('Backquote'); await page.waitForTimeout(500);
console.log('open paused', await paused()); await shot('1_open');
for (const [i, k] of ['KeyE', 'KeyE', 'KeyE'].entries()) { await page.keyboard.press(k); await page.waitForTimeout(400); await shot(`2_tab${i + 1}`); }
await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
await page.keyboard.press('KeyE'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300); await shot('3_skillpick');
await page.keyboard.press('Backquote'); await page.waitForTimeout(500);
console.log('closed paused', await paused()); await shot('4_closed');
await page.keyboard.press('Backquote'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
console.log('esc closed paused', await paused(), 'menu?', await page.locator('text=일시정지').count()); await shot('5_esc');
console.log('errors', errors.slice(0, 8));
await browser.close();
