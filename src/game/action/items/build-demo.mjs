// 아이템 시험판 단일 HTML: node src/game/action/items/build-demo.mjs → release/demo/goei-items-demo.html
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = await build({ entryPoints: ['src/game/action/items/demo.ts'], bundle: true, format: 'iife', target: 'es2020', minify: true, write: false });
const code = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><title>아이템과 무기 시험판</title></head><body><div id="items-demo"></div><script>${code}</script></body></html>`;
mkdirSync('release/demo', { recursive: true });
writeFileSync('release/demo/goei-items-demo.html', html);
console.log('release/demo/goei-items-demo.html', html.length, 'bytes');
