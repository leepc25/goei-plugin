// 통합창 게임 연결 시험: ` 열기(게임 멈춤)·Q·E 탭·방향키·` 닫기·Esc 닫기(일시정지 안 뜸), PC 아래 가운데 자동·메뉴·통합창 버튼, 능력 뱃지 그림.
// 먼저 npm run build. 사진 /tmp/cw_g_*.png
import { openField, enterHub } from './field-harness.mjs';
const out = process.argv[2] || '/tmp';
const { browser, page, errors } = await openField({ width: 1600, height: 960 });
await enterHub(page);
const shot = (n) => page.screenshot({ path: `${out}/cw_g_${n}.png` });
const paused = () => page.evaluate(() => !!window.__goeiEngine?.world?.paused);
await page.waitForTimeout(800);
await shot('0_pc_bar');
// PC 아래 가운데 통합창 버튼을 마우스로
const r = await page.evaluate(() => { const el = document.querySelector('.tp-b[data-id="char"]'); const b = el?.getBoundingClientRect(); return b && b.width ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; });
console.log('pc char button', r);
if (r) { await page.mouse.click(r.x, r.y); await page.waitForTimeout(500); }
console.log('mouse open paused', await paused()); await shot('1_open');
await page.keyboard.press('Backquote'); await page.waitForTimeout(300);
console.log('closed paused', await paused());
// 능력 넣어 보기 (괴이 판 흉내): 미끄럼 숙련 일반 랭크1, 빠른 손놀림 희귀 랭크2, 단련된 주먹 특급 랭크3, 특성 맨몸
await page.evaluate(() => {
  const pr = window.__goeiEngine.world.player.perks;
  pr.startRun();
  pr.add('미끄럼 숙련', 0);
  pr.add('빠른 손놀림', 1); pr.add('빠른 손놀림', 1);
  pr.add('단련된 주먹', 2); pr.add('단련된 주먹', 2); pr.add('단련된 주먹', 2);
  pr.addTrait('맨몸');
});
await page.keyboard.press('Backquote'); await page.waitForTimeout(300);
await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE'); await page.waitForTimeout(600);
await shot('2_badges');
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300); await shot('3_badge_pick');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
console.log('esc closed paused', await paused(), 'pause menu', await page.locator('text=일시정지').count());
console.log('errors', errors.slice(0, 8));
await browser.close();
