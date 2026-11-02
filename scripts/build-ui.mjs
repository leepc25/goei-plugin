// 화면과 조작 모듈(src/game/action/ui) 시험용 묶음. 옛 회색 상자 시연판(goei-ui-demo.html)은 차원 승강기와 같이 지웠다 (2026-10-28).
import { build } from 'esbuild';

await build({ entryPoints: ['src/game/action/ui/input.ts'], bundle: true, format: 'esm', target: 'es2020', outfile: 'dist-test/ui-input.mjs' });
