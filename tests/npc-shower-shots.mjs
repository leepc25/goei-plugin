// NPC 샤워 검수(11-02): 여자 샤워실 자리 2·3·4에 여자 이름 인물을 세워 샤워 시작 → 옷 벗기·머리감기/몸씻기·물줄기 장면을 찍는다 (2배)
import { openField, enterHub } from './field-harness.mjs';
const out = process.argv[2] ?? '.';
const { page, browser, errors } = await openField({ width: 1600, height: 900 });
await enterHub(page);
await page.evaluate(() => window.__goeiEngine.world.stage.jump('bath_f', 1760, 780));
for (let i = 0; i < 40 && (await page.evaluate(() => window.__goeiEngine.world?.floor?.id)) !== 'hq:bath_f'; i++) await page.waitForTimeout(250);
await page.waitForTimeout(1000);
const who = await page.evaluate(() => {
  const w = window.__goeiWorld;
  const women = w.actors.filter((a) => a.def.kind === 'named' && w.sexOf(a) === '여' && a.act !== 'gone');
  const spots = w.graph.scene('bath_f').showers;
  const pick = [...women.filter((a) => a.def.name === '콘쥬스'), ...women.filter((a) => a.def.name !== '콘쥬스')].slice(0, 3);
  pick.forEach((a, i) => {
    const s = spots[[2, 3, 4][i]];
    a.scene = 'bath_f'; a.route = []; a.goal = null; a.plan = 'none'; a.following = false;
    a.task = { id: 'shower', need: 'hygiene', clip: 'shower', where: ['bathroom'], sec: [600, 780], fill: 0.2, label: '샤워 중' };
    a.act = 'do'; a.wait = 660; a.station = `bath_f#s:${s.id}`;
    w.startShower(a, s);
  });
  return pick.map((a) => `${a.def.name}@${a.shower?.id}`);
});
console.log('샤워 시작', who);
const shot = async (name, wait) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` }); console.log(name, JSON.stringify(await page.evaluate(() => window.__goeiWorld.inScene('bath_f').filter((a) => a.shower).map((a) => [a.def.name, a.clip, a.nude])))); };
await shot('npc_1_undress', 400);
await shot('npc_1b_undress', 500);
await shot('npc_2_wash', 2500);
await shot('npc_3_wash', 4000);
console.log('errors', errors.slice(0, 8));
await browser.close();
