// Isolated installable build; production release and update URL stay unchanged.
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
const base = 'https://raw.githubusercontent.com/leepc25/goei-plugin/claude/project-thread-qilshh/release/visit-preview';
execFileSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit', env: { ...process.env, GOEI_UPDATE_BASE: base, GOEI_BUILD_VERSION: '0.16.41-visit.2', GOEI_GAME_BUTTON: '1' } });
const dest = 'release/visit-preview';
rmSync(dest, { recursive: true, force: true });
mkdirSync(`${dest}/game`, { recursive: true });
for (const name of readdirSync('dist')) if (/^goei-plugin\.js$|^goei-body(?:\.\d+\.txt|\.json)$/.test(name)) copyFileSync(`dist/${name}`, `${dest}/${name}`);
for (const name of readdirSync('dist/game')) if (name === 'index.json' || /^goei-game\.\d+\.txt$/.test(name) || name.endsWith('.bin')) copyFileSync(`dist/game/${name}`, `${dest}/game/${name}`);
console.log(`본부 방문 테스트 설치 파일: ${dest}/goei-plugin.js`);
