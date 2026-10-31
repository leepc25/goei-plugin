import { openField, enterHub } from './field-harness.mjs';
const shots = process.argv[2];
const { browser, page, errors } = await openField({});
await enterHub(page);
const ev = (f, a) => page.evaluate(f, a);
await ev(() => window.__goeiEngine.world.stage.jump('jr_b1', 400)); await page.waitForTimeout(1500);
const sc = await ev(() => { const s = window.__goeiEngine.world.stage.current(); return { id: s.id, w: s.w ?? null, doors: s.doors.map((d) => ({ id: d.id, x: d.x, kind: d.kind })) }; });
console.log(JSON.stringify(sc));
const rep = [];
for (const [x, y, name] of [[1264, 700, 'seam1_back'], [1264, 830, 'seam1_front'], [3792, 760, 'seam3'], [4412, 700, 'daebak'], [5970, 700, 'alley'], [8209, 700, 'songil'], [8700, 700, 'down'], [150, 760, 'up']]) {
  await ev(([x, y]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = y; }, [x, y]);
  await page.waitForTimeout(700);
  const near = await ev(() => window.__goeiEngine.world.stage.nearInfo());
  const pos = await ev(() => { const p = window.__goeiEngine.world.player; return [Math.round(p.x), Math.round(p.y)]; });
  rep.push(`${name} 위치=${pos} 안내=${near ? near.text : '없음'}`);
  await page.screenshot({ path: `${shots}/${name}.png` });
}
// 문 들어가기 확인
for (const d of sc.doors) {
  await ev(() => window.__goeiEngine.world.stage.jump('jr_b1', 400)); await page.waitForTimeout(1300);
  await ev(([x]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = 700; }, [d.x]); await page.waitForTimeout(500);
  const near = await ev(() => window.__goeiEngine.world.stage.nearInfo());
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1700);
  const now = await ev(() => window.__goeiEngine.world?.stage.current()?.id);
  rep.push(`문 ${d.id} x=${Math.round(d.x)} 안내=${near ? near.text : '없음'} E→ ${now}`);
}
console.log(rep.join('\n')); console.log('오류', errors.length ? errors.slice(0, 5) : '없음');
await browser.close();
