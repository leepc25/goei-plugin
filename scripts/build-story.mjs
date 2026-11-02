// 대사와 컷신: 순수 로직 시험 번들. 옛 시연판(goei-story.html)은 차원 승강기와 같이 지웠다 (2026-10-28).
// 사용: node scripts/build-story.mjs
import { build } from 'esbuild';

const common = { bundle: true, target: 'es2022', charset: 'utf8', legalComments: 'none', loader: { '.css': 'text' }, format: 'esm' };
export async function buildStoryPure(outfile = 'dist-test/story.mjs') {
  await build({ ...common, entryPoints: ['src/game/action/story/pure.ts'], outfile });
}
if (import.meta.url === `file://${process.argv[1]}`) await buildStoryPure();
