// 통합창 시안 사진: node tools/preview/char_window.mjs [출력.png]
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/usr/lib/node_modules/')('playwright')); }
const out = process.argv[2] || 'char_window.png';
const js = (await build({ entryPoints: ['tools/preview/charWindowPreview.ts'], bundle: true, write: false, format: 'iife', target: 'es2020' })).outputFiles[0].text;
const badges = {};
for (const k of ['undying', 'triplejump', 'extrashot', 'vitality']) badges[k] = 'data:image/png;base64,' + readFileSync(`game-src/art/ui/perk_sample/${k}_0.png`).toString('base64');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.error(e.message));
await p.setContent(`<!doctype html><html><body style="margin:0;background:#000"><canvas id="c" width="1280" height="720"></canvas><script>window.__badges=${JSON.stringify(badges)}</script></body></html>`);
await p.addScriptTag({ content: js });
await p.waitForFunction(() => window.__done, null, { timeout: 15000 });
await p.locator('#c').screenshot({ path: out });
await b.close();
console.log(out);
