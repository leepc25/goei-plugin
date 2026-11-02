const { chromium } = require('playwright'); const path = require('path');
const [,, html, key, outp, ...rest] = process.argv; const times = rest.map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(html)); await p.waitForFunction(() => window.__room && window.__room.CK);
  await p.evaluate(k => window.__room.setChar(k), key); await p.waitForFunction(k => window.__room.CK === k, key);
  const cv = p.locator('#cv'); await cv.click(); await sleep(400);
  await p.evaluate(() => { const P = window.__room.P; P.x = 450; P.face = 1; window.__room.P.sp = 100; });
  await p.keyboard.down(process.env.KEY || 'KeyD'); await sleep(60); await p.keyboard.up(process.env.KEY || 'KeyD');
  let t0 = 0; for (const [i, t] of times.entries()) { await sleep(t - t0); t0 = t; await cv.screenshot({ path: `${outp}_${i}.png` }); }
  console.log('errs', errs); await b.close();
})();
