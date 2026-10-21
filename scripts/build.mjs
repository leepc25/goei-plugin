import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
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
const define = {
  __UPDATE_BASE__: JSON.stringify(updateBase),
  __PLUGIN_VERSION__: JSON.stringify(pkg.version),
};
const common = {
  define,
  bundle: true,
  target: 'es2022',
  charset: 'utf8',
  minify: false,
  legalComments: 'none',
  loader: { '.css': 'text' },
  write: false,
};

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
    if (bytes + n > PART_BYTES) (bodyParts.push(buf), (buf = ''), (bytes = 0));
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
writeFileSync(
  'dist/goei-body.json',
  JSON.stringify({ version: pkg.version, parts: partNames, length: bodyCode.length }) + '\n',
);

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

// 1인 액션 검증판과 순수 전투 로직 시험용.
await build({
  ...common,
  entryPoints: ['src/game/action/demo.ts'],
  format: 'esm',
  write: true,
  outfile: 'dist-test/action-demo.js',
});
await build({
  entryPoints: ['src/game/action/sim.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'dist-test/action-sim.mjs',
});

await build({
  ...common,
  entryPoints: ['src/ui/game.ts'],
  format: 'esm',
  write: true,
  outfile: 'dist-test/action-ui.js',
});

// 회색 상자 시험판 (그림 없음): 시험 페이지용 번들, 순수 시뮬레이션, 단일 HTML.
await build({ ...common, entryPoints: ['src/game/action/graybox/demo.ts'], format: 'esm', write: true, outfile: 'dist-test/graybox-demo.js' });
await build({ entryPoints: ['src/game/action/graybox/sim.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/graybox-sim.mjs' });
{
  const code = readFileSync('dist-test/graybox-demo.js', 'utf8').replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>회색 상자 시험판 · 차원 승강기</title><style>body{margin:0;background:#02070c;display:flex;justify-content:center}#box{position:relative;max-width:100vw;height:100dvh}</style><div id="box"></div><script type="module">${code}</script></html>`;
  writeFileSync('dist/goei-graybox.html', html);
  mkdirSync('release/demo', { recursive: true });
  writeFileSync('release/demo/goei-graybox.html', html);
}

// 게임 엔진 시연판 (전투·조작·장면 관리). 쟈알디 그림 묶음(game-pack/jyaldi)을 내장한 단일 HTML.
await build({ ...common, entryPoints: ['src/game/action/engine/demo.ts'], format: 'esm', write: true, outfile: 'dist-test/engine-demo.js' });
{
  const art = {
    atlas: `data:image/png;base64,${readFileSync('game-pack/jyaldi/atlas.png').toString('base64')}`,
    cutin: `data:image/png;base64,${readFileSync('game-pack/jyaldi/cutin.png').toString('base64')}`,
    frames: JSON.parse(readFileSync('game-pack/jyaldi/frames.json', 'utf8')),
  };
  // 배경 그림 (tools/bg_pixelize.py → game-src/art/bg/dot/<장소>/*.png). 없으면 단색 대역.
  const bg = {};
  const bgDir = 'game-src/art/bg/dot';
  for (const place of existsSync(bgDir) ? readdirSync(bgDir) : []) {
    for (const f of readdirSync(`${bgDir}/${place}`).filter((f) => f.endsWith('.png'))) {
      (bg[place] ??= {})[f.slice(0, -4)] = `data:image/png;base64,${readFileSync(`${bgDir}/${place}/${f}`).toString('base64')}`;
    }
  }
  const code = readFileSync('dist-test/engine-demo.js', 'utf8').replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>관리국 액션 · 전투 시연</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#box{position:fixed;inset:0}</style><div id="box"></div><script>window.__GOEI_ENGINE_ART__=${JSON.stringify(art)};window.__GOEI_BG_ART__=${JSON.stringify(bg)}</script><script type="module">${code}</script></html>`;
  writeFileSync('dist/goei-action-game.html', html);
  mkdirSync('release/demo', { recursive: true });
  writeFileSync('release/demo/goei-action-game.html', html);
}
// 소리 시험실 (효과음·음악·환경음 전부 코드 합성): 단일 HTML. 순수 로직은 시험용으로 따로 묶는다.
{
  const out = await build({ ...common, entryPoints: ['src/game/action/audio/demo.ts'], format: 'esm', minify: true });
  const code = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>소리 시험실 · 차원 승강기</title><body><script type="module">${code}</script></body></html>`;
  writeFileSync('dist/goei-sound.html', html);
  mkdirSync('release/demo', { recursive: true });
  writeFileSync('release/demo/goei-sound.html', html);
  const lib = await build({ ...common, entryPoints: ['src/game/action/audio/index.ts'], format: 'esm', minify: true });
  console.log(`소리 모듈 ${(lib.outputFiles[0].contents.length / 1024).toFixed(1)}KB (압축 전 최소화)`);
}
await build({ entryPoints: ['src/game/action/audio/music.ts', 'src/game/action/audio/songs.ts', 'src/game/action/audio/index.ts'], bundle: true, format: 'esm', target: 'es2022', outdir: 'dist-test/audio' });

await build({
  ...common,
  entryPoints: ['src/game/action/motion-demo.ts'],
  format: 'esm',
  write: true,
  outfile: 'dist-test/motion-demo.js',
});

// 새 액션 그림 팩은 구형 순찰 팩과 분리한다.
const actionPack = buildPack('game-pack/action', 'action', 4, [
  'a-jyaldi-action',
  'bg-bureau-action',
  'e-corner',
  'e-watchman',
]);
writeFileSync('dist/goei-game-action.pack', actionPack);
mkdirSync('dist-test', { recursive: true });
writeFileSync('dist-test/goei-game-action.pack', actionPack);
const actionReviewed = JSON.parse(readFileSync('game-src/action/layout.json', 'utf8')).releaseReady === true;
if (actionReviewed) writeFileSync('release/goei-game-action-normal-v4.pack', actionPack);

// 설치 없이 여는 단일 HTML 검증판. 필요한 새 액션 그림만 포함한다.
const actionArt = {
  atlas: JSON.parse(readFileSync('game-pack/action/atlas.json', 'utf8')),
  files: Object.fromEntries(
    ['a-jyaldi-action', 'e-corner', 'e-watchman', 'bg-bureau-action'].map((name) => [
      name,
      `data:image/png;base64,${readFileSync(`game-pack/action/${name}.png`).toString('base64')}`,
    ]),
  ),
};
const actionCode = readFileSync('dist-test/action-demo.js', 'utf8').replace(/<\/script/gi, '<\\/script');
writeFileSync(
  'dist/goei-action-demo.html',
  `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>관리국 1인 전투 검증판</title><style>body{margin:0;background:#02070c;display:flex;justify-content:center}#box{position:relative;max-width:100vw;height:100dvh}</style><div id="box"></div><script>window.__GOEI_ACTION_ART__=${JSON.stringify(actionArt)}</script><script type="module">${actionCode}</script></html>`,
);

const motionCode = readFileSync('dist-test/motion-demo.js', 'utf8').replace(/<\/script/gi, '<\\/script');
writeFileSync(
  'dist/goei-jyaldi-motions.html',
  `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>쟈알디 동작 확인</title><body><script>window.__GOEI_ACTION_ART__=${JSON.stringify(actionArt)}</script><script type="module">${motionCode}</script></body></html>`,
);

// 검토한 그림만 공유용 시연판으로 승격한다. 진행 중 자료는 dist에만 둔다.
if (actionReviewed) {
  mkdirSync('release/demo', { recursive: true });
  const playable = readFileSync('dist/goei-action-demo.html');
  writeFileSync('release/demo/goei-action-demo.html', playable);
  const actionProfile = actionArt.atlas.action?.profile;
  writeFileSync(
    actionProfile?.startsWith('normal-')
      ? 'release/demo/goei-jyaldi-normal.html'
      : 'release/demo/goei-jyaldi-slender.html',
    playable,
  );
  if (actionProfile === 'normal-v4') writeFileSync('release/demo/goei-jyaldi-action-v4.html', playable);
  writeFileSync('release/demo/goei-jyaldi-motions.html', readFileSync('dist/goei-jyaldi-motions.html'));
}

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

// 게임 모듈 시험용 묶음 (dist-test/*): 시험이 쓰는 파일을 한 번에 만든다. 단독 시연판은 개발용(게임_통합_규격 7장)
await import('./build-ui.mjs');
await import('./build-enemy.mjs');
{
  const story = await import('./build-story.mjs');
  await story.buildStoryPure();
}
