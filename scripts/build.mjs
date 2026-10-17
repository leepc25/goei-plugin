import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

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

const info = {
  version: pkg.version,
  bytes: Buffer.byteLength(code),
  sha256: createHash('sha256').update(code).digest('hex'),
};
writeFileSync('dist/build-info.json', JSON.stringify(info, null, 2) + '\n');
console.log(info);
