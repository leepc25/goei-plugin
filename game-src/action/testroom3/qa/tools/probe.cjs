// 판정 부품을 바로 실행해 맞는지 확인. node qa/tools/probe.cjs <index.html> <키>
const { chromium } = require('playwright'); const path = require('path');
const [,, html, key] = process.argv; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto('file://' + path.resolve(html)); await p.waitForFunction(() => window.__room && window.__room.CK);
  await p.evaluate(k => window.__room.setChar(k), key); await p.waitForFunction(k => window.__room.CK === k, key);
  await p.locator('#cv').click(); await sleep(300);
  const out = await p.evaluate(() => {
    const r = window.__room, P = r.P, D = r.D; const res = {};
    r.toIdle(); P.x = 640; P.y = 600; P.z = 0; P.face = 1; D.x = 860; D.y = 600; D.z = 0; D.vz = 0; D.hp = 1e6;
    res.K = typeof K === 'function' ? K(600) : 'noK'; res.showDummy = typeof showDummy !== 'undefined' ? showDummy : 'undef'; res.face = P.face; res.mode = P.mode;
    const t = (name, fx) => { D.hp = 1e6; D.x = 860; D.y = 600; D.z = 0; runFx(fx, {}); res[name] = Math.round(1e6 - D.hp); };
    t('melee140', [{ t: 'melee', range: 140, hit: { dmg: 10, kind: 'light' } }]);
    t('melee190', [{ t: 'melee', range: 190, hit: { dmg: 10, kind: 'light' } }]);
    t('v_front110_r100', [{ t: 'v', vfx: 'x3-c-ground-crack', at: 'front', dx: 110, r: 100, scale: 0.6, hit: { dmg: 10, kind: 'light' } }]);
    t('v_front140_r90', [{ t: 'v', vfx: 'x3-c-hit-spark-heavy', at: 'front', dx: 140, r: 90, scale: 0.6, hit: { dmg: 10, kind: 'light' } }]);
    t('hit_only', [{ t: 'hit', hit: { dmg: 10, kind: 'light' } }]);
    res.after = { Dx: D.x, Dy: D.y, Px: P.x, Py: P.y, face: P.face };
    return res; });
  // v 는 later()로 지연 → 잠깐 기다린 뒤 다시 읽음
  await sleep(600); const hp = await p.evaluate(() => Math.round(1e6 - window.__room.D.hp));
  console.log(key, JSON.stringify(out), 'v-after-wait', hp); await b.close();
})();
