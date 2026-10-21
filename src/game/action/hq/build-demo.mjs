// 본부 시연판 단일 HTML 만들기: node src/game/action/hq/build-demo.mjs → release/demo/goei-hq.html
// (공용 빌드 스크립트는 「게임 전투와 조작」 스레드가 합칠 때 이 줄을 옮긴다)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const photo = (f) => `data:image/avif;base64,${readFileSync(`assets/agents/${f}`).toString('base64')}`;
const out = await build({
  entryPoints: ['src/game/action/hq/demo.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  charset: 'utf8',
  loader: { '.css': 'text' },
  write: false,
  define: { __HQ_DEMO_PHOTOS__: JSON.stringify({ jyaldi: photo('Jyaldi_default.avif'), eileen: photo('Aileen_default.avif') }) },
});
const code = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>관리국 본부 시연판</title><style>html,body{margin:0;height:100%;background:#0b0f13}#box{position:relative;width:100%;height:100dvh;max-width:1400px;margin:0 auto}</style><div id="box"></div><script type="module">${code}</script></html>`;
mkdirSync('release/demo', { recursive: true });
writeFileSync('release/demo/goei-hq.html', html);
mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/game/action/hq/logic.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/hq-logic.mjs' });
await build({ entryPoints: ['src/game/action/hq/state.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/hq-state.mjs' });
console.log(`release/demo/goei-hq.html ${(html.length / 1024).toFixed(0)}KB`);
