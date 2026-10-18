import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
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
const common = { define, bundle: true, target: 'es2022', charset: 'utf8', minify: false, legalComments: 'none', loader: { '.css': 'text' }, write: false };

// 플러그인 파일 = 시작기만 (모든 봇에서 읽히므로 작게). 본체는 괴이 카드를 열 때 시작기가 꺼낸다 (src/main.ts)
const loader = await build({ ...common, entryPoints: ['src/main.ts'], format: 'esm' });
const code = header + loader.outputFiles[0].text;
writeFileSync('dist/goei-plugin.js', code);

// 본체: 첫 줄의 판으로 시작기와 맞는지 본다. 받을 때는 조각(goei-body.N.txt)으로 받는다 (Risu 웹 프록시는 1MB 넘는 파일을 못 받는다)
const bodyOut = await build({ ...common, entryPoints: ['src/body-entry.ts'], format: 'iife' });
const bodyCode = `// goei-body ${pkg.version}\n` + bodyOut.outputFiles[0].text;
writeFileSync('dist/goei-body.js', bodyCode);
for (const f of readdirSync('dist')) if (/^goei-body\.\d+\.txt$/.test(f)) unlinkSync(`dist/${f}`);
const bodyParts = [];
{
  const PART_BYTES = 200_000;
  let buf = '';
  let bytes = 0;
  for (const ch of bodyCode) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > PART_BYTES) bodyParts.push(buf), (buf = ''), (bytes = 0);
    buf += ch;
    bytes += n;
  }
  if (buf) bodyParts.push(buf);
}
const partNames = bodyParts.map((p, i) => {
  const name = `goei-body.${i + 1}.txt`;
  writeFileSync(`dist/${name}`, p);
  return name;
});
writeFileSync('dist/goei-body.json', JSON.stringify({ version: pkg.version, parts: partNames, length: bodyCode.length }) + '\n');

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
  bodyBytes: Buffer.byteLength(bodyCode),
  bodyParts: partNames.length,
  sha256: createHash('sha256').update(code).digest('hex'),
};
writeFileSync('dist/build-info.json', JSON.stringify(info, null, 2) + '\n');
console.log(info);
