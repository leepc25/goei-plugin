// 적: 시험장 단일 HTML(release/demo/goei-enemy-arena.html)과 순수 모듈 시험용 번들.
// scripts/build.mjs와 따로 돈다 (통합 빌드 줄은 「게임 전투와 조작」이 더한다): node scripts/build-enemy.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const common = { bundle: true, target: 'es2022', charset: 'utf8', legalComments: 'none', write: false };
const arena = await build({ ...common, entryPoints: ['src/game/action/enemy/arena/demo.ts'], format: 'iife', minify: true });
const code = arena.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>적 시험장</title></head><body><div id="app"></div><script>${code}</script></body></html>`;
mkdirSync('release/demo', { recursive: true });
mkdirSync('dist', { recursive: true });
writeFileSync('release/demo/goei-enemy-arena.html', html);
writeFileSync('dist/goei-enemy-arena.html', html);
const mod = await build({ ...common, entryPoints: ['src/game/action/enemy/index.ts'], format: 'esm' });
mkdirSync('dist-test', { recursive: true });
writeFileSync('dist-test/enemy.mjs', mod.outputFiles[0].text);
const arenaMod = await build({ ...common, entryPoints: ['src/game/action/enemy/arena/arena.ts'], format: 'esm' });
writeFileSync('dist-test/enemy-arena.mjs', arenaMod.outputFiles[0].text);
console.log({ arenaBytes: Buffer.byteLength(html) });
