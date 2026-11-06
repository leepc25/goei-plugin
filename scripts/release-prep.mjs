// 릴리스 준비 (전수점검 §11-8, 2026-11-06): 손으로 하던 ①판 올림 → ②빌드 → ③카드·release 부속 → ④release 복사 → ⑤형 검사·단위 시험을
// 한 번에 돌리고, 남은 절차(브라우저 시험·PR·릴리스)를 체크리스트로 보여 준다. main 반영·릴리스는 하지 않는다 (사용자가 「릴리스해」라고 할 때만).
//
// 사용법: npm run release:prep -- [옵션]
//   --bump patch|minor|major   package.json 판을 올린다 (package-lock.json 도 같이). 기본: 올리지 않음
//   --version x.y.z            판을 이 값으로
//   --no-card                  카드 빌드(③)를 건너뛴다
//   --skip-tests               ⑤를 건너뛴다
//   --browser                  ⑤ 뒤에 브라우저 시험 plugin 그룹도 돌린다 (약 30분)
//   --dry                      무엇을 할지만 보이고 아무것도 바꾸지 않는다
// 규칙: release/ 의 옛 조각·옛 pic 은 지우지 않는다(결과물 삭제 금지). 카드 빌드가 지운 pic 파일은 git 에서 되살린다.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const opt = { bump: '', version: '', card: true, tests: true, browser: false, dry: false };
{
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = () => { if (i + 1 >= a.length) throw new Error(`${k} 뒤에 값이 없어요`); return a[++i]; };
    if (k === '--bump') opt.bump = v();
    else if (k === '--version') opt.version = v();
    else if (k === '--no-card') opt.card = false;
    else if (k === '--skip-tests') opt.tests = false;
    else if (k === '--browser') opt.browser = true;
    else if (k === '--dry') opt.dry = true;
    else if (k === '-h' || k === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
    else throw new Error(`모르는 옵션: ${k}`);
  }
  if (opt.bump && !['patch', 'minor', 'major'].includes(opt.bump)) throw new Error('--bump 는 patch|minor|major');
  if (opt.version && !/^\d+\.\d+\.\d+$/.test(opt.version)) throw new Error('--version 은 x.y.z');
}
const log = (...s) => console.log(`[release:prep] ${s.join(' ')}`);
function run(cmd, args, label) {
  log(`${label}: ${cmd} ${args.join(' ')}`);
  if (opt.dry) return;
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (r.status !== 0) { console.error(`[release:prep] ✗ ${label} 실패 (exit ${r.status ?? r.signal}). 여기서 멈춤.`); process.exit(1); }
}
const git = (args) => { const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout : ''; };

// ① 판
const pkgPath = resolve(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const before = pkg.version;
let version = before;
if (opt.version) version = opt.version;
else if (opt.bump) {
  const [ma, mi, pa] = before.split('.').map(Number);
  version = opt.bump === 'major' ? `${ma + 1}.0.0` : opt.bump === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;
}
if (version !== before) {
  log(`① 판 ${before} → ${version}`);
  if (!opt.dry) {
    writeFileSync(pkgPath, readFileSync(pkgPath, 'utf8').replace(`"version": "${before}"`, `"version": "${version}"`));
    const lockPath = resolve(ROOT, 'package-lock.json');
    if (existsSync(lockPath)) {
      // 맨 위 두 곳("version", packages[""].version)만. 의존성 판은 건드리지 않는다
      const lock = readFileSync(lockPath, 'utf8');
      let n = 0;
      writeFileSync(lockPath, lock.replace(/"version": "[^"]+"/g, (m) => (n++ < 2 ? `"version": "${version}"` : m)));
    }
  }
} else log(`① 판 그대로 ${version} (--bump 또는 --version 으로 올릴 수 있음)`);

// ② 빌드
run('npm', ['run', 'build'], '② 빌드');

// ③ 카드 + release 부속 (card-update.* · version.json · wiki-base.* · icon.png · pic/)
if (opt.card) {
  const src = 'card/원본_봇카드.jpeg';
  if (!existsSync(resolve(ROOT, src))) { console.error(`[release:prep] ✗ ${src} 가 없어요 (카드 원본은 저장소에 있어야 함).`); process.exit(1); }
  run('python3', ['tools/build_lite_card.py', src, 'release/괴이_ANOMALY.charx'], '③ 카드 빌드');
  // 카드 빌드는 지난 판 pic 파일을 지운다 → 결과물 삭제 금지 규칙대로 되살린다 (2026-11-05 와 같게)
  const deleted = git(['status', '--porcelain', '--', 'release/pic']).split('\n').filter((l) => l.startsWith(' D') || l.startsWith('D ')).map((l) => l.slice(3).trim());
  if (deleted.length) {
    log(`③ 카드 빌드가 지운 옛 pic ${deleted.length}장을 되살림`);
    if (!opt.dry) spawnSync('git', ['checkout', '--', ...deleted], { cwd: ROOT, stdio: 'inherit' });
  }
} else log('③ 카드 빌드 건너뜀 (--no-card)');

// ④ dist → release (시작기·본체 조각·자료 팩·토크나이저 조각). 옛 조각은 지우지 않는다
{
  const dist = resolve(ROOT, 'dist');
  const files = readdirSync(dist).filter((f) => /^(goei-plugin\.js|goei-body\.(json|\d+\.txt)|goei-data-(world|install)\.(json|txt|\d+\.txt)|tok-o200k\.(json|\d+\.txt))$/.test(f));
  log(`④ dist → release 복사 ${files.length}개`);
  if (!opt.dry) for (const f of files) copyFileSync(resolve(dist, f), resolve(ROOT, 'release', f));
}

// ④-2 옛 시험 카드(.scratch/fixture)는 옆으로 치운다 — 판이 바뀐 뒤 옛 카드로 브라우저 시험을 돌리면 「판 맞춤」 경고로 실패한다 (2026-11-06 v0.20.9 때 30분 날림)
{
  const fx = resolve(ROOT, '.scratch/fixture');
  if (existsSync(fx)) {
    const old = resolve(ROOT, `.scratch/fixture_old_${Date.now()}`);
    log(`④-2 옛 시험 카드 치움 .scratch/fixture → ${old.replace(ROOT + '/', '')} (다음 브라우저 시험이 새 판으로 다시 만든다)`);
    if (!opt.dry) renameSync(fx, old);
  }
}

// ⑤ 시험
if (opt.tests) {
  run('npm', ['run', 'typecheck'], '⑤ 형 검사');
  run('npm', ['test'], '⑤ 단위 시험');
  if (opt.browser) run('node', ['scripts/test-browser.mjs', '--group', 'plugin', '--no-build'], '⑤ 브라우저 시험 (plugin)');
} else log('⑤ 시험 건너뜀 (--skip-tests)');

// 남은 절차
const ver = opt.dry ? version : JSON.parse(readFileSync(resolve(ROOT, 'release/version.json'), 'utf8'));
console.log(`
[release:prep] 끝. 판 ${version}${opt.dry ? ' (dry: 아무것도 바꾸지 않음)' : ` · release/version.json = ${JSON.stringify(ver)}`}
남은 절차 (사람이 함):
  ${opt.browser ? '✓' : '○'} 브라우저 시험 plugin 그룹: npm run test:browser -- --group plugin --no-build  (약 30분)
  ○ git status 로 release/ 변경 확인 (지워진 파일이 있으면 안 됨 — 결과물 삭제 금지)
  ○ 커밋 → push → 사용자가 「합쳐」면 PR, 「릴리스해」면 main 머지
  ○ main 에 release/version.json 이 올라가면 GitHub Actions(release.yml)가 Releases 를 만든다 → 끝나면 사용자에게 알림
`);
