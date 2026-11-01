// 통합창 시안 사진: node tools/preview/char_window.mjs [출력.png]
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/usr/lib/node_modules/')('playwright')); }
const outDir = process.argv[2] || '.';
const js = (await build({ entryPoints: ['tools/preview/charWindowPreview.ts'], bundle: true, write: false, format: 'iife', target: 'es2020' })).outputFiles[0].text;
const badges = {};
for (const k of ['reckless', 'triplejump', 'extrashot', 'vitality']) badges[k] = 'data:image/png;base64,' + readFileSync(`game-src/art/ui/perk_sample/${k}_0.png`).toString('base64');
badges.body = 'data:image/webp;base64,' + readFileSync('game-pack/char-1.1/1.webp').toString('base64');
const sheetArg = process.env.SHEET;
let sheetJs = '';
if (sheetArg) {
  const names = readFileSync('docs/퍽/뱃지_그림_문구_1101.txt', 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => { const a = l.split('|'); return [a[0], a[2], a[3]]; });
  const u = (f) => JSON.stringify('data:image/png;base64,' + readFileSync(f).toString('base64'));
  // 등급 색 판(동·금): 같은 이름 뒤에 _bronze·_gold
  sheetJs = `window.__sheet=${u(sheetArg)};window.__sheetB=${u(sheetArg.replace('.png', '_bronze.png'))};window.__sheetG=${u(sheetArg.replace('.png', '_gold.png'))};window.__sheetNames=${JSON.stringify(names)};`;
}
const b = await chromium.launch();
for (const tab of ['능력치', '기술', '능력', '소지품', '능력_스크롤', '능력_없음']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.error(e.message));
  await p.setContent(`<!doctype html><html><body style="margin:0;background:#000"><canvas id="c" width="1280" height="720"></canvas><script>window.__badges=${JSON.stringify(badges)};window.__tab=${JSON.stringify(tab.split('_')[0])};window.__many=${tab.endsWith('스크롤')};window.__none=${tab.endsWith('없음')};${sheetJs}</script></body></html>`);
  await p.addScriptTag({ content: js });
  await p.waitForFunction(() => window.__done, null, { timeout: 15000 });
  await p.locator('#c').screenshot({ path: `${outDir}/통합창_${tab}.png` });
  await p.close();
  console.log(tab);
}
await b.close();
