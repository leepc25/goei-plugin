// 중림 실내 4곳(대박 알선·손길 의원·헐값 매입·영창 컨설팅) 나가기 → 통로의 그 문 앞으로 돌아오는지. 사용: node tests/jr-rooms-back.mjs [캡처 폴더]
import { openField, enterHub } from './field-harness.mjs';
const [shots] = process.argv.slice(2);
const { browser, page, errors } = await openField({});
await enterHub(page);
const ev = (f, a) => page.evaluate(f, a);
const rep = [];
for (const room of ['jr_daebak', 'jr_songil', 'jr_heolgap', 'jr_youngchang']) {
  await ev((id) => window.__goeiEngine.world.stage.jump(id, 400), room); await page.waitForTimeout(1400);
  const out = await ev(() => { const s = window.__goeiEngine.world.stage.current(); const d = s.doors.find((x) => x.id === 'out'); const ln = s.lane ?? [585, 836]; return d && { x: d.x, y: d.side === 'S' ? ln[1] - 20 : ln[0] + 20 }; });
  await ev(([x, y]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = y; }, [out.x, out.y]); await page.waitForTimeout(600);
  const near = await ev(() => window.__goeiEngine.world.stage.nearInfo());
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1700);
  const now = await ev(() => { const w = window.__goeiEngine.world; return { id: w.stage.current().id, x: Math.round(w.player.x) }; });
  if (shots) await page.screenshot({ path: `${shots}/back_${room}.png` });
  rep.push(`${room} 나가기 안내=${near ? near.text : '없음'} → ${now.id} x=${now.x}`);
}
console.log(rep.join('\n')); console.log('오류', errors.length ? errors.slice(0, 5) : '없음');
await browser.close();
