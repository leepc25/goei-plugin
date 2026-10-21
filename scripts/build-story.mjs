// 대사와 컷신: 순수 로직 시험 번들 + 폰 시연판 단일 HTML (release/demo/goei-story.html).
// 사용: node scripts/build-story.mjs   (게임 통합 빌드에 합치는 건 「게임 전투와 조작」 몫)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const common = { bundle: true, target: 'es2022', charset: 'utf8', legalComments: 'none', loader: { '.css': 'text' }, format: 'esm' };
export async function buildStoryPure(outfile = 'dist-test/story.mjs') {
  await build({ ...common, entryPoints: ['src/game/action/story/pure.ts'], outfile });
}
export async function buildStoryDemo() {
  const out = await build({ ...common, entryPoints: ['src/game/action/story/demo.ts'], write: false });
  const code = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>대사와 컷신 시연판 · 차원 승강기</title><style>html,body{margin:0;height:100%;background:#0b0f12}#box{position:relative;width:100vw;height:100dvh;max-width:1100px;margin:0 auto}</style><div id="box"></div><script type="module">${code}</script></html>`;
  mkdirSync('dist', { recursive: true });
  mkdirSync('release/demo', { recursive: true });
  writeFileSync('dist/goei-story.html', html);
  writeFileSync('release/demo/goei-story.html', html);
  return html.length;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  await buildStoryPure();
  console.log('goei-story.html', await buildStoryDemo());
}
