// 차원 승강기 층 생성: 시연판 단일 HTML + 시험용 순수 모듈. (scripts/build.mjs와 따로 둔다: 통합은 「게임 전투와 조작」 몫)
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const demo = await build({ entryPoints: ['src/game/action/stage/demo/main.ts'], bundle: true, format: 'iife', target: 'es2020', charset: 'utf8', minify: true, write: false, loader: { '.css': 'text' } });
const code = demo.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>차원 승강기 · 층 생성 시연판</title><body></body><script>${code}</script></html>`;
mkdirSync('release/demo', { recursive: true });
writeFileSync('release/demo/goei-elevator-stage.html', html);
mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/game/action/stage/index.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/stage.mjs', loader: { '.css': 'text' } });
console.log(`release/demo/goei-elevator-stage.html ${(html.length / 1024).toFixed(1)}KB`);
