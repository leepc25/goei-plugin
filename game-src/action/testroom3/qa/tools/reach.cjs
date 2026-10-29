// 피격 판정 너그러움 재기(10-29 밤, 사용자: 판정이 너무 엄격한지 확인). 허수아비를 앞 거리 x · 위아래 어긋남 y 격자에 두고 각 공격이 맞는지(피해 > 0) 표로.
// 사용: node qa/tools/reach.cjs <out/index.html> <결과.json> [동시 수] [키,키,...]
// 결과: { 키: { 부분: { "x,y": 피해 } } }  부분 = light(약공1) heavy(강공) skill(D) c2(충전 2단) super(F)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const [,, html, outp, par, only] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const XS = [150, 200, 250, 300], YS = [0, 70];
const PARTS = { light: ['KeyQ', 60, 900], heavy: ['KeyW', 60, 1100], skill: ['KeyD', 60, 2600] };
(async () => {
  const b = await chromium.launch();
  const p0 = await b.newPage(); await p0.goto('file://' + path.resolve(html)); await p0.waitForFunction(() => window.__room && window.__room.CK);
  const keys = (await p0.evaluate(() => [...document.querySelectorAll('#chsel option')].map(o => o.value))).filter(k => !only || only.split(',').includes(k)); await p0.close();
  const res = fs.existsSync(outp) ? JSON.parse(fs.readFileSync(outp)) : {}; let qi = 0;
  const worker = async () => {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); await p.goto('file://' + path.resolve(html)); await p.waitForFunction(() => window.__room && window.__room.CK);
    const cv = p.locator('#cv');
    while (qi < keys.length) { const key = keys[qi++]; if (res[key] && Object.keys(res[key]).length >= Object.keys(PARTS).length) continue;
      await p.evaluate(k => window.__room.setChar(k), key); await p.waitForFunction(k => window.__room.CK === k, key); await cv.click(); await sleep(300);
      res[key] = res[key] || {};
      for (const [part, [k, ms, wait]] of Object.entries(PARTS)) {
        if (res[key][part]) continue; const grid = {};
        for (const y of YS) for (const x of XS) {
          await p.evaluate(([x, y]) => { const r = window.__room, P = r.P, D = r.D; r.toIdle(); P.x = 500; P.y = 600; P.z = 0; P.vx = 0; P.face = 1; P.sp = 100; P.cd = {}; P.hp = 100; P.combat = true; D.x = 500 + x; D.y = 600 + y; D.z = 0; D.vz = 0; D.vx = 0; D.hp = 1e6; D.stag = 0; }, [x, y]);
          await sleep(150); await p.keyboard.down(k); await sleep(ms); await p.keyboard.up(k); await sleep(wait);
          grid[`${x},${y}`] = await p.evaluate(() => Math.round(1e6 - window.__room.D.hp));
        }
        res[key][part] = grid; fs.writeFileSync(outp, JSON.stringify(res));
      }
      console.log('done', key);
    }
    await p.close();
  };
  await Promise.all(Array.from({ length: +par || 2 }, worker));
  await b.close(); console.log('끝', Object.keys(res).length);
})();
