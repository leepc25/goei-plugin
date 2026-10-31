// 시험용 초기화 (QC 개선 나1): 본체는 세계 자료·설치 자료를 자료 팩(goei-data-world·goei-data-install)으로 받아 넣지만,
// 단위시험은 네트워크가 없으므로 src/data 에서 읽어 같은 글(scripts/data-pack.mjs)을 만들어 넣는다.
// dist-test/core.mjs(빌드가 만드는 입구)가 import 해서 부르므로 `import … from '../dist-test/core.mjs'` 하는 시험은 손댈 것이 없다.
// 브라우저 시험 틀은 distWorldPack()·distInstallPack() 으로 dist 의 팩 글을 가짜 저장소나 받기 흉내에 둔다.
import { readFileSync } from 'node:fs';
import { installPackText, worldPackText } from '../scripts/data-pack.mjs';

const ROOT = new URL('../', import.meta.url);

/** core 모듈(dist-test/core.bundle.mjs 의 네임스페이스)에 세계·설치 자료를 넣는다. 팩 글을 거쳐 넣어 형식 검사(applyWorldPack)도 같이 지난다 */
export function initTestData(core) {
  core.applyWorldPack(worldPackText());
  core.applyInstallPack(installPackText());
}

/** dist/<이름>.json 목록과 조각을 이어 붙인 팩 글 (npm run build 뒤). 본체에 박힌 지문과 같은 글 */
export function distPack(name) {
  const index = JSON.parse(readFileSync(new URL(`dist/${name}.json`, ROOT), 'utf8'));
  return index.parts.map((n) => readFileSync(new URL(`dist/${n}`, ROOT), 'utf8')).join('');
}
export const distWorldPack = () => distPack('goei-data-world');
export const distInstallPack = () => distPack('goei-data-install');

/** 받기 흉내(window.__fetch 의 이름 → 글)에 넣을 팩 파일들: 목록 + 조각 */
export function distPackFiles(name) {
  const index = JSON.parse(readFileSync(new URL(`dist/${name}.json`, ROOT), 'utf8'));
  const files = { [`${name}.json`]: JSON.stringify(index) };
  for (const n of index.parts) files[n] = readFileSync(new URL(`dist/${n}`, ROOT), 'utf8');
  return files;
}

/**
 * 소스를 esbuild 로 바로 묶는 시험(people-*·visit)용: 항목(entryPoints)마다 따로 묶으면 records.ts 사본이 항목마다 생겨 자료를 한 번에 넣을 수 없다.
 * splitting 으로 공용 모듈을 한 조각에 두고 core/datapack.ts 를 항목에 더해 거기로 자료를 넣는다 (outbase 는 'src' 여야 한다)
 */
export async function buildWithData(options) {
  const { build } = await import('esbuild');
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  await build({ ...options, entryPoints: [...options.entryPoints, 'src/core/datapack.ts'], splitting: true });
  initTestData(await import(pathToFileURL(join(options.outdir, 'core/datapack.mjs')).href));
}
