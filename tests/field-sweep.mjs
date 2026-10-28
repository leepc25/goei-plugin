// 필드 전수 순회 (2026-10-25 사용자: 전수검사): 리스와 같은 창 크기·필드 모드로 모든 장면을 돌며
// 문마다 다가가 안내가 뜨는지, 열리는 문은 E로 들어가 장면이 바뀌는지, 자리마다 E가 무언가를 여는지, 오류가 없는지 본다.
// 사용: npm run build && node tests/field-sweep.mjs [shots 폴더]
import { openField, enterHub } from './field-harness.mjs';
const shots = process.argv[2];
const { browser, page, errors } = await openField({});
await enterHub(page);
const ev = (f, a) => page.evaluate(f, a);
const scenes = await ev(() => window.__goeiEngine.world.stage.sceneIds());
const report = [];
const closeAll = async () => {
  for (let i = 0; i < 4; i++) {
    const open = await ev(() => !!document.querySelector('.mn.on') || !!document.querySelector('.gnp:not([hidden])') || !document.querySelector('.goei-engine-hq')?.hidden || !document.querySelector('.goei-engine-elev')?.hidden);
    if (!open) return;
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  }
};
for (const id of scenes) {
  await closeAll();
  await ev((id) => window.__goeiEngine.world.stage.jump(id, 400), id);
  await page.waitForTimeout(1300); // 들어올 때 어두워졌다 밝아지는 동안은 안내가 없다
  const sc = await ev(() => { const s = window.__goeiEngine.world.stage.current(); return { id: s.id, doors: s.doors.map((d) => ({ id: d.id, x: d.x, open: d.open, kind: d.kind, side: d.side })), spots: s.spots.map((q) => ({ id: q.id, x: q.x, y: q.y, verb: q.verb, open: q.open !== false })) }; });
  if (shots) await page.screenshot({ path: `${shots}/${id}.png` });
  for (const d of sc.doors) {
    let near = null;
    for (const y of [470, 490, 520, 560, 600, 640]) {
      await ev(([x, y]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = y; }, [d.x, y]);
      await page.waitForTimeout(260);
      near = await ev(() => window.__goeiEngine.world.stage.nearInfo());
      if (near) break;
    }
    let after = null;
    if (near && !near.locked && d.kind !== 'elevator' && d.kind !== 'stairs') {
      await page.keyboard.press('KeyE'); await page.waitForTimeout(1600);
      after = await ev(() => ({ scene: window.__goeiEngine.world?.stage.current()?.id, hq: !document.querySelector('.goei-engine-hq')?.hidden }));
      await closeAll();
      if (after.scene !== id) { await ev((id) => window.__goeiEngine.world.stage.jump(id, 400), id); await page.waitForTimeout(1300); }
    }
    report.push(`${id} 문 ${d.id}(${d.kind ?? ''}) 안내=${near ? near.text + (near.locked ? '·잠김' : '') : '없음!'}${after ? ` → ${after.scene}${after.hq ? '(창)' : ''}` : ''}`);
  }
  for (const s of sc.spots) {
    await closeAll();
    if (await ev((id) => window.__goeiEngine.world.stage.current().id !== id, id)) { await ev((id) => window.__goeiEngine.world.stage.jump(id, 400), id); await page.waitForTimeout(1300); }
    // 앞 자리에서 앉은 채면(시간 보내기 창을 닫아도 앉아 있음) 다음 자리 안내가 안 뜬다: 옆으로 비켜 일어난 뒤 옮긴다 (qc-field-world 와 같은 순서)
    await ev(() => { window.__goeiEngine.world.player.x += 200; }); await page.waitForTimeout(300);
    await ev(([x, y]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = y; }, [s.x, s.y ?? 560]);
    await page.waitForTimeout(300);
    const near = await ev(() => window.__goeiEngine.world.stage.nearInfo());
    await page.keyboard.press('KeyE'); await page.waitForTimeout(900);
    const got = await ev(() => ({ choose: document.querySelector('.mn.on')?.textContent?.includes('시간 보내기') ?? false, gnp: !!document.querySelector('.gnp:not([hidden])'), talk: !!document.querySelector('.gtalk[data-open], [data-open].gk-talk'), hq: !document.querySelector('.goei-engine-hq')?.hidden, scene: window.__goeiEngine.world?.stage.current()?.id, say: window.__goeiEngine.world?.subtitle?.text ?? null }));
    report.push(`${id} 자리 ${s.id}(${s.verb}) 안내=${near ? near.text : '없음!'} E→ ${got.choose ? '시간 보내기 ' : ''}${got.gnp ? '대화창 ' : ''}${got.hq ? '메뉴창 ' : ''}${got.say ? `「${got.say}」 ` : ''}${got.scene !== id ? `장면 ${got.scene}` : ''}`);
    if (shots && (got.gnp || got.hq)) await page.screenshot({ path: `${shots}/${id}-${s.id}.png` });
    await closeAll();
  }
}
// 엘리베이터: 층마다 단추로 이동
for (const [from, label, want] of [['lobby', '3', 'f3'], ['f3', 'B3', 'b3'], ['b3', '1', 'lobby']]) {
  await closeAll();
  await ev((id) => window.__goeiEngine.world.stage.jump(id, 400), from); await page.waitForTimeout(1300);
  const ex = await ev(() => window.__goeiEngine.world.stage.current().doors.find((d) => d.kind === 'elevator')?.x);
  for (const y of [470, 490, 520, 560]) { await ev(([x, y]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = y; }, [ex, y]); await page.waitForTimeout(260); if (await ev(() => window.__goeiEngine.world.stage.nearInfo())) break; }
  await page.keyboard.press('KeyE');
  for (let i = 0; i < 30 && await ev(() => document.querySelector('.goei-engine-elev')?.hidden !== false); i++) await page.waitForTimeout(100);
  await page.evaluate((label) => [...document.querySelectorAll('.goei-engine-elev button')].find((b) => b.textContent === label)?.click(), label);
  await page.waitForTimeout(6000);
  const now = await ev(() => window.__goeiEngine.world.stage.current().id);
  report.push(`엘리베이터 ${from} → ${label}: ${now}${now === want ? '' : ' (기대 ' + want + ')!'}`);
}
console.log(report.join('\n'));
console.log('오류', errors.length ? errors.slice(0, 10) : '없음');
await browser.close();
