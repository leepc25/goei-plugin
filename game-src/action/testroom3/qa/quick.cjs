// 전원 빠른 검사: 인물마다 대기·약1·필살기만 찍고 콘솔 오류를 모음
// 사용: node game-src/action/testroom3/qa/quick.cjs
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'quick');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../out/index.html'));
  await p.waitForFunction(() => window.__room && window.__room.CK);
  await p.evaluate(() => { const f = document.getElementById('fs'); if (!f.checked) f.click(); });
  const keys = await p.evaluate(() => [...document.querySelectorAll('#chsel option')].map(o => o.value));
  const cv = p.locator('#cv'); const res = [];
  const tap = async k => { await p.keyboard.down(k); await sleep(50); await p.keyboard.up(k); };
  for (const k of keys) {
    const before = errs.length;
    await p.evaluate(k => window.__room.setChar(k), k); await p.waitForFunction(k => window.__room.CK === k, k);
    await cv.click(); await sleep(250);
    const anims = await p.evaluate(() => Object.keys(window.__room.A).length);
    await cv.screenshot({ path: path.join(OUT, k + '_1대기.png') });
    await p.evaluate(() => { const P = window.__room.P; P.x = 700; P.face = 1; }); await tap('KeyZ'); await sleep(130);
    await cv.screenshot({ path: path.join(OUT, k + '_2약1.png') });
    await sleep(500); await p.evaluate(() => { const P = window.__room.P; P.x = 520; P.face = 1; }); await tap('KeyF'); await sleep(2000);
    await cv.screenshot({ path: path.join(OUT, k + '_3필살기.png') });
    await sleep(2500);
    res.push(`${k} 줄${anims} 오류${errs.length - before}${errs.length > before ? ' ' + errs.slice(before).join(' | ') : ''}`);
  }
  console.log(res.join('\n')); console.log('총 오류', errs.length);
  await b.close();
})();
