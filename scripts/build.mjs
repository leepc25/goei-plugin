import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildPack } from './game-pack.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
// 업데이트 주소: package.json의 goei.updateBase (저장소 release 폴더 raw 주소). 있으면 Risu 플러그인 탭이 이 주소로 플러그인을 갱신한다
const updateBase = String(pkg.goei?.updateBase ?? '').replace(/\/+$/, '');
const header = [
  '//@name goei-plugin',
  '//@display-name 괴이: 이면세계',
  '//@api 3.0',
  `//@version ${pkg.version}`,
  ...(updateBase ? [`//@update-url ${updateBase}/goei-plugin.js`] : []),
  '//@description 괴이: 이면세계 전용 플러그인 (괴이봇 2탄 기반): 시작 화면, 상황판, 지도·요원 이동, 커스텀 임무, 괴담넷, 괴담톡, 위키, 설정·캐릭터 이미지',
  '',
].join('\n');

mkdirSync('dist', { recursive: true });
const define = { __UPDATE_BASE__: JSON.stringify(updateBase), __PLUGIN_VERSION__: JSON.stringify(pkg.version) };
const result = await build({
  define,
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  charset: 'utf8',
  minify: false,
  legalComments: 'none',
  loader: { '.css': 'text' },
  write: false,
});
const code = header + result.outputFiles[0].text;
writeFileSync('dist/goei-plugin.js', code);

// 테스트용: 순수 로직만 묶은 모듈
await build({
  define,
  entryPoints: ['src/core/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  charset: 'utf8',
  outfile: 'dist-test/core.mjs',
});

// 관찰형 게임 시험 페이지용 (tests/game/demo.html)
await build({
  entryPoints: ['src/game/demo.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  charset: 'utf8',
  loader: { '.css': 'text' },
  outfile: 'dist-test/game-demo.js',
});
await build({
  entryPoints: ['src/game/sim.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  charset: 'utf8',
  outfile: 'dist-test/game-sim.mjs',
});

// 게임 그림 팩: 플러그인과 따로, 원하는 사람만 게임 창에서 받는다 (release/ 폴더에서 바로 받거나 파일로 넣기).
// 그림이 그대로면 바이트도 같아서 매번 써도 바뀐 것으로 잡히지 않는다
const PACK_VERSION = Number(/PACK_VERSION = (\d+)/.exec(readFileSync('src/game/assets.ts', 'utf8'))[1]);
const pack = buildPack('game-pack/patrol', 'patrol', PACK_VERSION);
writeFileSync('dist/goei-game-patrol.pack', pack);
mkdirSync('release', { recursive: true });
writeFileSync('release/goei-game-patrol.pack', pack);
mkdirSync('dist-test', { recursive: true });
writeFileSync('dist-test/goei-game-patrol.pack', pack);

const info = {
  version: pkg.version,
  bytes: Buffer.byteLength(code),
  sha256: createHash('sha256').update(code).digest('hex'),
};
writeFileSync('dist/build-info.json', JSON.stringify(info, null, 2) + '\n');
console.log(info);
