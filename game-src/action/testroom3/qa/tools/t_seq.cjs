const { chromium } = require('playwright'); const path = require('path');
const [,, html, key, outp, ...steps] = process.argv;   // steps: Key:ms or shot
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(html)); await p.waitForFunction(() => window.__room && window.__room.CK);
  await p.evaluate(k => window.__room.setChar(k), key); await p.waitForFunction(k => window.__room.CK === k, key);
  const cv = p.locator('#cv'); await cv.click(); await sleep(400);
  await p.evaluate(px => { const P = window.__room.P; P.x = px; P.face = 1; }, +(process.env.PX || 500));
  let n = 0;
  for (const st of steps) { const [k, ms] = st.split(':');
    if (k === 'shot') await cv.screenshot({ path: `${outp}_${n++}.png` });
    else if (k === 'wait') await sleep(+ms);
    else { await p.keyboard.down(k); await sleep(+(ms || 60)); await p.keyboard.up(k); } }
  console.log('errs', errs); await b.close();
})();
