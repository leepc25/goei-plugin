// 기술 판정 추적: runFx 부품과 strike 호출을 시간·자리와 함께 기록. node qa/tools/trace.cjs <index.html> <키> <skill|c0|c1|c2|super> [dummyDx=220]
const { chromium } = require('playwright'); const path = require('path');
const [,, html, key, act, ddx] = process.argv; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(html)); await p.waitForFunction(() => window.__room && window.__room.CK);
  await p.evaluate(k => window.__room.setChar(k), key); await p.waitForFunction(k => window.__room.CK === k, key);
  await p.locator('#cv').click(); await sleep(300);
  await p.evaluate(() => { window.__log = []; const t0 = performance.now(); const r = window.__room;
    const rf = window.runFx; window.runFx = function (list, c) { for (const s of list || []) window.__log.push({ t: Math.round(performance.now() - t0), part: s.t, at: s.at, dx: s.dx, r: s.r, range: s.range, vfx: s.vfx, hit: !!s.hit, Px: Math.round(r.P.x), Dx: Math.round(r.D.x), Dz: Math.round(r.D.z), clip: r.P.clip && r.P.clip.id, f: r.P.clip && r.P.clip.i }); return rf.call(this, list, c); };
    const st = window.strike; window.strike = function (h, y) { window.__log.push({ t: Math.round(performance.now() - t0), STRIKE: h && h.dmg, kind: h && h.kind, Px: Math.round(r.P.x), Dx: Math.round(r.D.x), hp: Math.round(r.D.hp) }); return st.call(this, h, y); }; });
  const lv = await p.evaluate(() => { const c = (window.__C[window.__room.CK].cfg.skills || {}).charge; return c && c.levels || [0.5, 1.2]; });
  const acts = { skill: ['KeyD', 80], c0: ['KeyS', 260], c1: ['KeyS', lv[0] * 1000 + 200], c2: ['KeyS', lv[1] * 1000 + 250], super: ['KeyF', 80] };
  const [k, ms] = acts[act];
  await p.evaluate(dd => { const r = window.__room, P = r.P, D = r.D; r.toIdle(); P.x = 640; P.y = 600; P.z = 0; P.face = 1; P.sp = 100; P.cd = {}; P.hp = 100; D.x = 640 + dd; D.y = 600; D.z = 0; D.vz = 0; D.hp = 1e6; }, +(ddx || 220));
  await sleep(250); await p.keyboard.down(k); await sleep(ms); await p.keyboard.up(k); await sleep(act === 'super' ? 6500 : 4200);
  const log = await p.evaluate(() => window.__log); const dmg = await p.evaluate(() => Math.round(1e6 - window.__room.D.hp));
  console.log(key, act, 'dmg', dmg, 'errs', errs); for (const e of log) console.log(' ', JSON.stringify(e));
  await b.close();
})();
