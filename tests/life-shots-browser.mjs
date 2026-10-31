// 생활 동작 화면 확인(10-31): 본부 사무실·휴게실에서 이름 인물이 하는 일을 시간 순서로 찍는다
import { openField, enterHub } from './field-harness.mjs';
const out = process.argv[2] ?? '.';
const { page, browser } = await openField({ width: 1600, height: 900 });
await enterHub(page);
const scenes = await page.evaluate(() => window.__goeiWorld.graph.scenes ? null : null);
const pick = await page.evaluate(() => { const w = window.__goeiWorld; const c = {}; for (const a of w.actors) if (a.def.kind === 'named') c[a.scene] = (c[a.scene] ?? 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]); });
console.log('장면', pick);
for (const sc of pick) {
  await page.evaluate((id) => window.__goeiEngine.world.stage.jump(id, 600), sc);
  await page.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(2500);
    const d = await page.evaluate((sc) => window.__goeiWorld.inScene(sc).filter((a) => a.def.kind === 'named').map((a) => `${a.def.name}:${a.doing}${a.seat ? '(의자)' : ''}`), sc);
    console.log(sc, i, d.join(' / '));
    await page.screenshot({ path: `${out}/life-${sc}-${i}.png` });
  }
}
await browser.close();
