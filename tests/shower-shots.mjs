// 샤워실 검수(11-01): 여자·남자 샤워실에서 자리 2에 서서 E → 샤워 규칙 재생 + 코드 물줄기·김. node tests/shower-shots.mjs <폴더>
import { openField, enterHub } from './field-harness.mjs';
const out = process.argv[2] ?? '.';
const { page, browser, errors } = await openField({ width: 1600, height: 900 });
await enterHub(page);
for (const [sc, x, y, tag] of [['bath_f', 536, 712, 'f'], ['bath_m', 1054, 704, 'm']]) {
  await page.evaluate(([id, x, y]) => window.__goeiEngine.world.stage.jump(id, x, y), [sc, x, y]);
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__goeiEngine.world?.floor?.id)) !== `hq:${sc}`; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1200);
  await page.evaluate(([x, y]) => window.__goeiEngine.world.api.movePlayer(x, y), [x, y]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/shower_${tag}_0.png` });
  await page.keyboard.press('KeyE'); console.log(sc,'afterE',JSON.stringify(await page.evaluate(()=>({showering:window.__goeiEngine.world.player.showering,mode:window.__goeiEngine.world.player.core?.P?.mode}))));
  await page.waitForTimeout(1200);
  await page.keyboard.press('Digit3');   // 시간 보내기 창: 그냥 있기
  await page.waitForTimeout(300);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/shower_${tag}_1.png` });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/shower_${tag}_2.png`, clip: { x: 420, y: 250, width: 420, height: 360 } });
  console.log(sc, JSON.stringify(await page.evaluate(() => ({ showering: window.__goeiEngine.world.player.showering, near: window.__goeiEngine.world.stage.nearInfo?.() }))));
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(800);
  console.log(sc, 'after ←', JSON.stringify(await page.evaluate(() => ({ showering: window.__goeiEngine.world.player.showering }))));
  await page.screenshot({ path: `${out}/shower_${tag}_3_after.png` });
}
console.log('errors', errors.slice(0, 8));
await browser.close();
