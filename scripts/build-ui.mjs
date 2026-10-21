// 화면·조작 시연판 (src/game/action/ui): 회색 상자 층을 새 HUD·터치·패드·메뉴·효과로 돌리는 단일 HTML.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

await build({ entryPoints: ['src/game/action/ui/demo.ts'], bundle: true, format: 'esm', target: 'es2020', charset: 'utf8', loader: { '.css': 'text' }, outfile: 'dist-test/ui-demo.js', legalComments: 'none' });
await build({ entryPoints: ['src/game/action/ui/input.ts'], bundle: true, format: 'esm', target: 'es2020', outfile: 'dist-test/ui-input.mjs' });
const code = readFileSync('dist-test/ui-demo.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#000"><title>차원 승강기 · 화면과 조작</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden;overscroll-behavior:none}#box{position:fixed;inset:0;width:100vw;height:100dvh}</style><div id="box"></div><script type="module">${code}</script></html>`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/goei-ui-demo.html', html);
mkdirSync('release/demo', { recursive: true });
writeFileSync('release/demo/goei-ui-demo.html', html);
