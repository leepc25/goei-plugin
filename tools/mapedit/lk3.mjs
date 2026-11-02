// 탈의실·샤워실 크기 확인 화면: node tools/mapedit/lk3.mjs out.png "[[x,y,face],...]" 장면 성별 — 같은 인물(첫 사람 모습)로 세워 게임 화면을 찍는다 (11-02)
import { openField, enterHub } from '../../tests/field-harness.mjs';
const [out, spotsJ, SC, SEX] = process.argv.slice(2);
const spots = JSON.parse(spotsJ);
const { page, browser, errors } = await openField({ width: 1600, height: 900 });
await enterHub(page);
await page.evaluate((sc) => window.__goeiEngine.world.stage.jump(sc, 640, 820), SC);
for (let i = 0; i < 40 && (await page.evaluate(() => window.__goeiEngine.world?.floor?.id)) !== `hq:${SC}`; i++) await page.waitForTimeout(250);
await page.waitForTimeout(800);
await page.evaluate(([spots, SC, SEX]) => {
  const w = window.__goeiWorld;
  const fs = w.actors.filter((q) => w.sexOf(q) === SEX).slice(0, spots.length);
  fs.forEach((a, i) => { const [x, y, f] = spots[i]; a.scene = SC; a.route = []; a.goal = null; a.following = false; a.shower = undefined; a.x = x; a.y = y; a.look = fs[0].look; a.def = { ...a.def, look: fs[0].def.look }; a.face = f; a.act = 'do'; a.wait = 9999; a.clip = 'idle'; a.task = { id: 'rest', need: 'rest', clip: 'idle', where: [], sec: [9999, 9999], fill: 0, label: '' }; });
}, [spots, SC, SEX]);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log('errors', errors.slice(0, 5));
await browser.close();
