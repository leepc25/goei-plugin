// 본 게임 시연판에 인물 팩을 가짜 assets 다리로 꽂아 화면을 찍는다(10-29). 저장소 루트에서 `python3 -m http.server 8765` 띄운 뒤: node tools/shot_demo_charpacks.cjs <저장 폴더> [주인공 이름]
// 시연판을 http로 열고 가짜 assets 다리(game-pack/ 폴더 직접)로 다시 열어 화면을 찍는다
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const [,, outDir, hero] = process.argv; fs.mkdirSync(outDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/dist/goei-action-game.html'); await sleep(1500);
  await p.evaluate((hero) => {
    const assets = {
      ready: async (pack) => (await fetch(`/game-pack/${pack}/pack.json`)).ok,
      url: async (pack, f) => `/game-pack/${pack}/${f}`,
      bytes: async (pack, f) => { const r = await fetch(`/game-pack/${pack}/${f}`); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; },
      atlas: async () => null, list: async () => [],
    };
    const visit = hero ? { state: async () => ({ visitor: { agentId: 'x', name: hero }, agents: [{ id: 'a', name: '쟈알디', state: '', situation: '', room: 'office' }, { id: 'b', name: '잼트리', state: '', situation: '', room: 'office' }, { id: 'c', name: '스팡달', state: '', situation: '', room: 'lounge' }], turns: [] }), send: async () => ({ visitor: { agentId: 'x', name: hero }, agents: [], turns: [] }) } : undefined;
    window.__goeiDemo.open({ assets, visit });
  }, hero || '');
  await sleep(4000); await p.screenshot({ path: path.join(outDir, 'title.png') });
  await p.keyboard.press('Enter'); await sleep(5000); await p.screenshot({ path: path.join(outDir, 'field.png') });
  const info = await p.evaluate(() => { const g = window.__goeiEngine; const w = g && g.world; const pl = w && w.player; return { hub: g && g.inHub, player: pl && pl.constructor.name, label: pl && pl.label, x: pl && pl.x, y: pl && pl.y, mode: pl && pl.core && pl.core.P.mode, art: pl && pl.art && pl.art.key, scene: w && w.floor && w.floor.id }; }).catch(e => String(e));
  console.log(JSON.stringify(info)); console.log('errors:', errs.slice(0, 10).join('\n'));
  // 걷기·공격 몇 번
  await p.keyboard.down('ArrowRight'); await sleep(1200); await p.keyboard.up('ArrowRight'); await p.screenshot({ path: path.join(outDir, 'walk.png') });
  await p.keyboard.press('KeyQ'); await sleep(200); await p.screenshot({ path: path.join(outDir, 'light.png') });
  await p.keyboard.press('KeyD'); await sleep(400); await p.screenshot({ path: path.join(outDir, 'skill.png') });
  await sleep(800); await p.screenshot({ path: path.join(outDir, 'after.png') });
  console.log('errors2:', errs.slice(0, 10).join('\n'));
  await b.close();
})();
