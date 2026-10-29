// 적: 순수 모듈 시험용 번들. 옛 적 시험장 단일 HTML(goei-enemy-arena.html)은 층 편성과 같이 지웠다 (2026-10-28).
// 통합본에서는 ?start=arena 로 적 시험장을 연다. 따로 돌릴 때: node scripts/build-enemy.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const mod = await build({ bundle: true, target: 'es2022', charset: 'utf8', legalComments: 'none', write: false, entryPoints: ['src/game/action/enemy/index.ts'], format: 'esm' });
mkdirSync('dist-test', { recursive: true });
writeFileSync('dist-test/enemy.mjs', mod.outputFiles[0].text);
