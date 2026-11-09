const { chromium } = require('playwright');
const [a, o, shots] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto(`http://localhost:8765/dist/goei-waitfight.html?pick=${encodeURIComponent(a)},${encodeURIComponent(o)}&bg=street`);
  await pg.waitForFunction(() => globalThis.__vsFight && globalThis.__vsFight.st.fighters.length === 2, null, { timeout: 40000 });
  await pg.evaluate(() => { const m = globalThis.__vsFight, v = globalThis.__vsState, st = m.st; m.paused = true; m.brains.clear(); v.intro = 0; m.logOn = true; m.log = [];
    const [p, q] = st.fighters; p.reset(st.L / 2 - 300, 1, 1000); q.reset(st.L / 2 + 150, -1, 1000); p.gauge = 100; for (let i = 0; i < 10; i++) m.step();
    for (const x of ['light', 'heavy']) { m.edges.add(x); m.keys.add(x); } m.step(); for (const x of ['light', 'heavy']) { m.keys.delete(x); m.ups.add(x); } });
  const out = [];
  for (let k = 0; k < 45; k++) {
    const s = await pg.evaluate(() => { const m = globalThis.__vsFight, [p, q] = m.st.fighters; return `${m.st.t.toFixed(2)} p:${p.state}/${p.anim?.id}#${p.anim?.f} x=${Math.round(p.x)} z=${Math.round(p.z)} sup=${p.inSuper} | q:${q.state} x=${Math.round(q.x)} z=${Math.round(q.z)} hp=${q.hp} combo=${p.combo}`; });
    out.push(k + ' ' + s);
    if (shots) { await pg.waitForTimeout(40); await pg.screenshot({ path: `rush8/r${String(k).padStart(3, '0')}.png` }); }
    await pg.evaluate((n) => { const m = globalThis.__vsFight; for (let i = 0; i < n; i++) m.step(); }, k < 40 ? 1 : 3);
  }
  console.log(out.join('\n'));
  const log = await pg.evaluate(() => globalThis.__vsFight.log.filter(e => e.kind === 'super').map(e => e.dmg));
  console.log('super hits', log.length, 'dmg', log.reduce((a, b) => a + b, 0), JSON.stringify(log));
  await b.close();
})();
