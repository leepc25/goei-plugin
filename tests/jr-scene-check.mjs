// 중림 통로 장면 확인: 문마다 안내·E로 들어가기, 이음선(기둥) 앞뒤 캡처. 사용: node tests/jr-scene-check.mjs <장면> <캡처 폴더>
import { openField, enterHub } from './field-harness.mjs';
const [scene, shots] = process.argv.slice(2);
const { browser, page, errors } = await openField({});
await enterHub(page);
const ev = (f, a) => page.evaluate(f, a);
const go = async () => { await ev((id) => window.__goeiEngine.world.stage.jump(id, 400), scene); await page.waitForTimeout(1400); };
await go();
const sc = await ev(() => { const s = window.__goeiEngine.world.stage.current(); return { id: s.id, length: s.length, doors: s.doors.map((d) => ({ id: d.id, x: d.x })) }; });
const rep = [];
for (const [i, x] of [1, 2, 3].map((k) => [k, 1264 * k])) {
  for (const [y, tag] of [[700, 'back'], [830, 'front']]) {
    await ev(([x, y]) => { const w = window.__goeiEngine.world; w.player.x = x - 120; w.player.y = y; }, [x, y]); await page.waitForTimeout(500);
    if (shots) await page.screenshot({ path: `${shots}/${scene}_seam${i}_${tag}.png` });
  }
}
for (const d of sc.doors) {
  await go();
  await ev(([x]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = 700; }, [d.x]); await page.waitForTimeout(600);
  const near = await ev(() => window.__goeiEngine.world.stage.nearInfo());
  if (shots) await page.screenshot({ path: `${shots}/${scene}_door_${d.id}.png` });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1700);
  const now = await ev(() => window.__goeiEngine.world?.stage.current()?.id);
  rep.push(`문 ${d.id} x=${Math.round(d.x)} 안내=${near ? near.text : '없음'} E→ ${now}`);
}
// 양끝 막힘: 왼쪽·오른쪽 끝으로 걸어가 멈추는 x
for (const [key, x] of [['ArrowLeft', 300], ['ArrowRight', 99999]]) {
  await go();
  await ev(([x]) => { const w = window.__goeiEngine.world; w.player.x = Math.min(x, w.stage.current().length - 300); w.player.y = 760; }, [x]);
  await page.keyboard.down(key); await page.waitForTimeout(2500); await page.keyboard.up(key);
  const px = await ev(() => Math.round(window.__goeiEngine.world.player.x));
  rep.push(`${key} 끝 x=${px}`);
  if (shots) await page.screenshot({ path: `${shots}/${scene}_end_${key}.png` });
}
console.log(JSON.stringify(sc)); console.log(rep.join('\n')); console.log('오류', errors.length ? errors.slice(0, 5) : '없음');
await browser.close();
