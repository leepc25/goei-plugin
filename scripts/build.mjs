import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildGamePack, buildPack } from './game-pack.mjs';
import { rmSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
if (process.env.GOEI_BUILD_VERSION) pkg.version = process.env.GOEI_BUILD_VERSION;
// 업데이트 주소: package.json의 goei.updateBase (저장소 release 폴더 raw 주소). 있으면 Risu 플러그인 탭이 이 주소로 플러그인을 갱신한다
const updateBase = String(process.env.GOEI_UPDATE_BASE ?? pkg.goei?.updateBase ?? '').replace(/\/+$/, '');
const header = [
  '//@name goei-plugin',
  '//@display-name 괴이: ANOMALY',
  '//@api 3.0',
  `//@version ${pkg.version}`,
  ...(updateBase ? [`//@update-url ${updateBase}/goei-plugin.js`] : []),
  '//@description 괴이: ANOMALY 전용 플러그인 (괴이봇 2탄 기반): 시작 화면, 상황판, 지도·요원 이동, 커스텀 임무, 괴담넷, 괴담톡, 위키, 설정·캐릭터 이미지',
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

// 게임 코드 팩: 게임 코드는 본체에 넣지 않고 따로 받는다 (src/host/game/code.ts, src/game/entry.ts).
// 자산 팩: game-pack/<폴더>/pack.json이 있는 폴더마다 하나 (src/host/game/packs.ts). 둘 다 dist/game/ → 릴리스 때 release/game/
const split = (str, max) => {
  const out = [];
  let buf = '';
  let bytes = 0;
  for (const ch of str) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > max) (out.push(buf), (buf = ''), (bytes = 0));
    buf += ch;
    bytes += n;
  }
  if (buf) out.push(buf);
  return out;
};
rmSync('dist/game', { recursive: true, force: true });
mkdirSync('dist/game', { recursive: true });
const gameOut = await build({ ...common, entryPoints: ['src/game/entry.ts'], format: 'iife' });
const gameCode = `// goei-game ${pkg.version}\n` + gameOut.outputFiles[0].text;
writeFileSync('dist/game/goei-game.js', gameCode);
const gameParts = split(gameCode, 200_000).map((p, i) => {
  const name = `goei-game.${i + 1}.txt`;
  writeFileSync(`dist/game/${name}`, p);
  return name;
});
const gamePacks = [];
for (const d of existsSync('game-pack') ? readdirSync('game-pack') : []) {
  if (!existsSync(`game-pack/${d}/pack.json`)) continue;
  const p = buildGamePack(`game-pack/${d}`);
  writeFileSync(`dist/game/${p.id}.pack`, p.bytes);
  const parts = [];
  for (let at = 0, i = 1; at < p.bytes.length; at += 512 * 1024, i++) {
    const name = `${p.id}.${i}.bin`;
    writeFileSync(`dist/game/${name}`, p.bytes.subarray(at, at + 512 * 1024));
    parts.push(name);
  }
  gamePacks.push({ id: p.id, hash: p.hash, bytes: p.bytes.length, parts, required: p.required });
}
writeFileSync(
  'dist/game/index.json',
  JSON.stringify({ version: pkg.version, code: { parts: gameParts, length: gameCode.length, bytes: Buffer.byteLength(gameCode) }, packs: gamePacks }, null, 1) + '\n',
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
await build({ ...common, entryPoints: ['src/game/action/engine/demo.ts'], format: 'esm', minify: true, write: true, outfile: 'dist-test/engine-demo.js' });
{
  const art = {
    // 쟈알디 그림(atlas·cutin)은 2026-10-25 사용자 지시로 뺐다. 동작 판정표(frames.json)만 남는다
    atlas: '',
    cutin: '',
    frames: JSON.parse(readFileSync('game-pack/jyaldi/frames.json', 'utf8')),
  };
  // 옛 배경 도트(game-src/art/bg/dot)는 2026-10-25 사용자 지시로 뺐다: 그림이 없는 장소는 단색 대역
  const bg = {};
  // 아이템·무기 그림 (tools/items_pixelize.py → game-src/art/items/dot + items.json)
  const items = {};
  if (existsSync('game-src/art/items/items.json')) {
    for (const [id, e] of Object.entries(JSON.parse(readFileSync('game-src/art/items/items.json', 'utf8')))) {
      const f = `game-src/art/items/${e.file}`;
      if (existsSync(f)) items[id] = { src: `data:image/png;base64,${readFileSync(f).toString('base64')}`, w: e.w, h: e.h, grip: e.grip, foot: e.foot };
    }
  }
  const testPeople = {};
  for (const f of readdirSync('game-pack/test-people').filter((f) => /\.(png|webp)$/.test(f) && !f.startsWith('woman_'))) {
    testPeople[f.replace(/\.(png|webp)$/, '')] = `data:image/${f.endsWith('.webp') ? 'webp' : 'png'};base64,${readFileSync(`game-pack/test-people/${f}`).toString('base64')}`;
  }
  testPeople.eileen = JSON.parse(readFileSync('game-pack/test-people/eileen.json', 'utf8'));
  testPeople.eileen_vfx = JSON.parse(readFileSync('game-pack/test-people/eileen_vfx.json', 'utf8'));
  const hqDoor = {};
  for (const key of ['frame', 'aperture', 'leaf-left', 'leaf-right', 'entry-marker']) {
    hqDoor[key] = `data:image/png;base64,${readFileSync(`game-pack/hq-door-round2/${key}.png`).toString('base64')}`;
  }
  const hqField = {};
  for (const pack of ['hq-field', 'jr-field']) for (const f of readdirSync(`game-pack/${pack}`).filter((f) => f.endsWith('.webp'))) {
    hqField[f.slice(0, -5)] = `data:image/webp;base64,${readFileSync(`game-pack/${pack}/${f}`).toString('base64')}`;
  }
  const code = readFileSync('dist-test/engine-demo.js', 'utf8').replace(/<\/script/gi, '<\\/script');
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>관리국 액션 · 전투 시연</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#box{position:fixed;inset:0}</style><div id="box"></div><script>window.__GOEI_ENGINE_ART__=${JSON.stringify(art)};window.__GOEI_BG_ART__=${JSON.stringify(bg)};window.__GOEI_ITEM_ART__=${JSON.stringify(items)};window.__GOEI_HQ_DOOR_ROUND2__=${JSON.stringify(hqDoor)};window.__GOEI_HQ_FIELD__=${JSON.stringify(hqField)};window.__GOEI_TEST_PEOPLE__=${JSON.stringify(testPeople)}</script><script type="module">${code}</script></html>`;
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
  gameBytes: Buffer.byteLength(gameCode),
  gameParts: gameParts.length,
  gamePacks: gamePacks.map((p) => `${p.id} ${p.bytes}`),
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
