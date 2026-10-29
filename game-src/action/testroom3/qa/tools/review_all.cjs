// 전수 검수용 자동 촬영(10-29 밤, 사용자: 126명 × 단추 수십 개를 손으로 다 볼 수 없음).
// 테스트룸을 그대로 띄워 인물마다 동작마다 실제 화면을 여러 장 찍어 띠(strip)로 저장 → qa/review_sheets.py 가 동작별 모음 쪽으로.
// 사용: node qa/tools/review_all.cjs <out/index.html> <저장 폴더> [동시 수] [키,키,...]
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const [,, html, outDir, par, only] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FW = 240, FH = 300;   // 한 장 크기(1배 화면 화소). 사람은 발을 아래쪽 1/6 자리에
// [이름, 준비(p), 찍기 전 동작(p), 장 수, 장 간격 ms, 끝에 정리]
const ACTS = [
  ['대기', null, null, 8, 150],
  ['걷기', null, async p => p.keyboard.down('ArrowRight'), 8, 130, async p => p.keyboard.up('ArrowRight')],
  ['뛰기', null, async p => { await p.keyboard.down('ShiftLeft'); await p.keyboard.down('ArrowRight'); }, 8, 110, async p => { await p.keyboard.up('ArrowRight'); await p.keyboard.up('ShiftLeft'); }],
  ['약공3연', null, async p => { for (let i = 0; i < 3; i++) { await p.keyboard.press('KeyQ'); await sleep(230); } }, 10, 120],
  ['강공', null, async p => p.keyboard.press('KeyW'), 8, 120],
  ['돌진공격', null, async p => { await p.keyboard.down('ShiftLeft'); await p.keyboard.down('ArrowRight'); await sleep(500); await p.keyboard.press('KeyQ'); }, 8, 110, async p => { await p.keyboard.up('ArrowRight'); await p.keyboard.up('ShiftLeft'); }],
  ['점프', null, async p => p.keyboard.press('Space'), 8, 110],
  ['점프공격', null, async p => { await p.keyboard.press('Space'); await sleep(250); await p.keyboard.press('KeyQ'); }, 8, 110],
  ['원거리', null, async p => p.keyboard.press('KeyA'), 8, 110],
  ['충전0', null, async p => { await p.keyboard.down('KeyS'); await sleep(200); await p.keyboard.up('KeyS'); }, 8, 130],
  ['충전1', null, async p => { await p.keyboard.down('KeyS'); await sleep(700); await p.keyboard.up('KeyS'); }, 8, 140],
  ['충전2', null, async p => { await p.keyboard.down('KeyS'); await sleep(1450); await p.keyboard.up('KeyS'); }, 9, 140],
  ['기술', null, async p => p.keyboard.press('KeyD'), 10, 150],
  ['기술2', null, async p => p.keyboard.press('KeyG'), 10, 150],
  ['필살기', async p => p.evaluate(() => { window.__room.P.sp = 100; }), async p => p.keyboard.press('KeyF'), 12, 260],
  ['방어', null, async p => p.keyboard.down('KeyC'), 6, 150, async p => p.keyboard.up('KeyC')],
  ['회피', null, async p => p.keyboard.press('ShiftLeft'), 8, 90],
  ['웅크려기기', null, async p => { await p.keyboard.press('KeyX'); await sleep(300); await p.keyboard.down('ArrowRight'); }, 8, 150, async p => { await p.keyboard.up('ArrowRight'); await p.keyboard.press('KeyX'); }],
  ['뒷걸음', null, async p => p.keyboard.down('ControlLeft'), 6, 150, async p => p.keyboard.up('ControlLeft')],
  ['도망', null, async p => { await p.keyboard.down('KeyV'); }, 6, 130, async p => p.keyboard.up('KeyV')],
  ['맞기', null, async p => p.keyboard.press('Digit1'), 8, 110],
  ['밀려나기', null, async p => p.keyboard.press('KeyN'), 9, 130],
  ['띄워지기', null, async p => p.keyboard.press('KeyB'), 9, 140],
  ['쓰러져눕기', null, async p => p.keyboard.press('Digit2'), 12, 170],
  ['일어나기', null, async p => { await p.keyboard.press('Digit2'); await sleep(2300); await p.keyboard.press('ArrowRight'); }, 8, 140],
  ['스턴', null, async p => p.keyboard.press('Digit3'), 6, 200],
  ['사망서서', null, async p => p.keyboard.press('KeyT'), 10, 160, async p => p.keyboard.press('KeyT')],
  ['사망누워', null, async p => { await p.keyboard.press('Digit2'); await sleep(1500); await p.keyboard.press('KeyT'); }, 10, 160, async p => p.keyboard.press('KeyT')],
  ['정면앉기', null, async p => p.evaluate(() => window.__room.sitAt('front')), 8, 220, async p => { await p.evaluate(() => window.__room.rise(true)); await sleep(600); }],
  ['옆앉기', null, async p => p.evaluate(() => window.__room.sitAt('side')), 8, 220, async p => { await p.evaluate(() => window.__room.rise(true)); await sleep(600); }],
  ['후면앉기', null, async p => p.evaluate(() => window.__room.sitAt('back')), 8, 220, async p => { await p.evaluate(() => window.__room.rise(true)); await sleep(600); }],
  ['기대쉬기', null, async p => { await p.evaluate(() => window.__room.sitAt('front')); await sleep(1500); await clickBtn(p, '기대 쉬기'); }, 8, 220, async p => { await p.evaluate(() => window.__room.rise(true)); await sleep(600); }],
  ['앉은채강타', null, async p => { await p.evaluate(() => window.__room.sitAt('side')); await sleep(1500); await clickBtn(p, '앉은 채 맞기(강)'); }, 10, 160, async p => { await p.evaluate(() => { const r = window.__room; if (r.P.seat) r.rise(true); }); await sleep(600); }],
  ['눕기쉬기', null, async p => clickBtn(p, '눕기 → 쉬기·졸기'), 10, 220],
  ['샤워', null, async p => clickBtn(p, '한 번에(벗기→걷기→물→씻기→입기)'), 14, 420],
];
async function clickBtn(p, label) { const b = p.locator('#scenes button', { hasText: label }).first(); if (await b.count()) await b.click(); }
async function reset(p) {
  await p.evaluate(() => { const r = window.__room, P = r.P, D = r.D; if (P.mode === 'dead') r.onPress && 0; if (P.seat) r.rise(true); r.toIdle(); P.x = 520; P.y = 600; P.z = 0; P.vx = 0; P.face = 1; P.hp = 100; P.sp = 0; P.cd = {}; P.combat = false; P.mode = 'ground'; D.x = 740; D.y = 600; D.z = 0; D.vz = 0; D.hp = 1e6; D.stag = 0; });
  await sleep(200);
}
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p0 = await b.newPage(); await p0.goto('file://' + path.resolve(html)); await p0.waitForFunction(() => window.__room && window.__room.CK);
  const keys = (await p0.evaluate(() => [...document.querySelectorAll('#chsel option')].map(o => o.value))).filter(k => !only || only.split(',').includes(k)); await p0.close();
  let qi = 0;
  const worker = async () => {
    const p = await b.newPage({ viewport: { width: 1400, height: 900 } }); await p.goto('file://' + path.resolve(html)); await p.waitForFunction(() => window.__room && window.__room.CK);
    const cv = p.locator('#cv');
    while (qi < keys.length) {
      const key = keys[qi++]; const dir = path.join(outDir, key); fs.mkdirSync(dir, { recursive: true });
      await p.evaluate(k => window.__room.setChar(k), key); await p.waitForFunction(k => window.__room.CK === k, key); await cv.click(); await sleep(400);
      const has = await p.evaluate(() => { const r = window.__room; return { skill2: !!(window.__C[r.CK].cfg.skills || {}).skill2, shower: !!r.A['SH_A'], lie: !!r.A['75'], sit: !!(r.A['60'] || r.A['96']) }; });
      for (const [name, prep, go, n, dt, done] of ACTS) {
        const out = path.join(dir, name + '.png'); if (fs.existsSync(out)) continue;
        if (name === '기술2' && !has.skill2) continue; if (name === '샤워' && !has.shower) continue; if (name === '눕기쉬기' && !has.lie) continue; if (/앉기|기대|앉은채/.test(name) && !has.sit) continue;
        await reset(p); if (prep) await prep(p);
        const frames = [];
        const goP = go ? go(p) : Promise.resolve();
        for (let i = 0; i < n; i++) {
          const t0 = Date.now();
          const box = name === '필살기' ? await p.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }) : await p.evaluate(([FW, FH]) => { const P = window.__room.P; const r = document.getElementById('cv').getBoundingClientRect(); const sx = r.width / 1280; return { x: r.left + (P.x - FW / 2) * sx, y: r.top + (P.y - FH * 5 / 6) * sx, w: FW * sx, h: FH * sx }; }, [FW, FH]);
          frames.push(await p.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h }, type: 'png' }));
          const el = Date.now() - t0; if (el < dt) await sleep(dt - el);
        }
        await goP.catch(() => {}); if (done) await done(p).catch(() => {});
        fs.writeFileSync(out + '.frames.json', JSON.stringify(frames.map(f => f.toString('base64'))));
      }
      console.log('done', key, Date.now());
    }
    await p.close();
  };
  await Promise.all(Array.from({ length: +par || 2 }, worker));
  await b.close(); console.log('끝', keys.length);
})();
