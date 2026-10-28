const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const [,, html, outp, par] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const p0 = await b.newPage(); await p0.goto('file://' + path.resolve(html)); await p0.waitForFunction(() => window.__room && window.__room.CK);
  const keys = await p0.evaluate(() => [...document.querySelectorAll('#chsel option')].map(o => o.value)); await p0.close();
  const res = {}; let qi = 0;
  const worker = async () => {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); await p.goto('file://' + path.resolve(html)); await p.waitForFunction(() => window.__room && window.__room.CK);
    const cv = p.locator('#cv');
    while (qi < keys.length) { const key = keys[qi++];
      await p.evaluate(k => window.__room.setChar(k), key); await p.waitForFunction(k => window.__room.CK === k, key); await cv.click(); await sleep(300);
      const lv = await p.evaluate(() => { const c = (window.__C[window.__room.CK].cfg.skills || {}).charge; return c && c.levels || [0.5, 1.2]; });
      const acts = { skill: ['KeyD', 80], c0: ['KeyS', 260], c1: ['KeyS', lv[0] * 1000 + 200], c2: ['KeyS', lv[1] * 1000 + 250], super: ['KeyF', 80] };
      res[key] = {};
      for (const [n, [k, ms]] of Object.entries(acts)) {
        await p.evaluate(() => { const r = window.__room, P = r.P, D = r.D; r.toIdle(); P.x = 640; P.y = 600; P.z = 0; P.face = 1; P.sp = 100; P.cd = {}; P.hp = 100; D.x = 860; D.y = 600; D.z = 0; D.vz = 0; D.hp = 1e6; });
        await sleep(250);
        await p.keyboard.down(k); await sleep(ms); await p.keyboard.up(k); await sleep(n === 'super' ? 6500 : 4200);
        res[key][n] = await p.evaluate(() => Math.round(1e6 - window.__room.D.hp));
      }
      fs.writeFileSync(outp, JSON.stringify(res, null, 0));
    }
  };
  await Promise.all(Array.from({ length: +par || 5 }, worker));
  await b.close(); console.log('done', Object.keys(res).length);
})();
