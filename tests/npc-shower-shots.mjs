// NPC 샤워 검수(11-02): 탈의실(여) 캐비닛 앞에서 옷 벗기 → 맨몸으로 샤워실로 → 샤워기에서 씻기 (2배로 잘라 본다)
import { openField, enterHub } from './field-harness.mjs';
const out = process.argv[2] ?? '.';
const { page, browser, errors } = await openField({ width: 1600, height: 900 });
await enterHub(page);
const go = async (sc, x, y) => { await page.evaluate(([sc, x, y]) => window.__goeiEngine.world.stage.jump(sc, x, y), [sc, x, y]); for (let i = 0; i < 40 && (await page.evaluate(() => window.__goeiEngine.world?.floor?.id)) !== `hq:${sc}`; i++) await page.waitForTimeout(250); await page.waitForTimeout(900); };
const st = () => page.evaluate(() => window.__goeiWorld.actors.filter((a) => a.shower).map((a) => [a.def.name, a.scene, a.shower.step, a.clip, !!a.nude, Math.round(a.x), Math.round(a.y)]));
await go('shower_f', 1000, 760);
console.log('캐비닛', await page.evaluate(() => window.__goeiWorld.graph.scene('shower_f').lockers));
const who = await page.evaluate(() => {
  const w = window.__goeiWorld;
  const a = w.actors.find((q) => q.def.kind === 'named' && w.sexOf(q) === '여' && q.act !== 'gone');
  const L = w.graph.scene('shower_f').lockers[0];
  a.scene = 'shower_f'; a.route = []; a.goal = null; a.following = false; a.x = L.x; a.y = L.y;
  a.task = { id: 'shower', need: 'hygiene', clip: 'shower', where: ['locker'], sec: [600, 780], fill: 0.2, label: '샤워 중' };
  a.shower = { step: 'start' }; a.station = `shower_f#l:${L.id}`;
  w.showerNext(a);
  return a.def.name;
});
console.log('인물', who);
for (const [n, t] of [['lk_1', 300], ['lk_2', 500], ['lk_3', 400], ['lk_4', 900]]) { await page.waitForTimeout(t); await page.screenshot({ path: `${out}/${n}.png` }); console.log(n, JSON.stringify(await st())); }
for (let i = 0; i < 60 && !(await st()).some((s) => s[1] === 'bath_f'); i++) await page.waitForTimeout(500);
await go('bath_f', 1760, 780);
for (let i = 0; i < 80 && !(await st()).some((s) => s[2] === 'wash'); i++) await page.waitForTimeout(500);
await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/bt_1.png` }); console.log('bt_1', JSON.stringify(await st()));
await page.waitForTimeout(3000); await page.screenshot({ path: `${out}/bt_2.png` }); console.log('bt_2', JSON.stringify(await st()));
console.log('errors', errors.slice(0, 8));
await browser.close();
