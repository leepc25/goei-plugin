// 브라우저 시험 실행기 (개선 제안 나5): 시험 카드(fixture)를 준비하고, 빌드하고, tests/browser-suite.json 의 시험을 **차례로 하나씩** 돈다.
// (여러 개를 동시에 돌리면 Chromium 이 죽거나 시간 초과가 난다.) 하나가 실패해도 나머지는 계속 돌고 마지막에 표를 낸다.
//
// 사용법: node scripts/test-browser.mjs [옵션]      (package.json: npm run test:browser -- [옵션])
//   --fixture <경로>   fixture.json 또는 그 폴더. 없으면 만든다. 기본 .scratch/fixture/fixture.json (환경변수 GOEI_FIXTURE 도 됨)
//   --no-build         npm run build 를 건너뛴다 (시험에 필요한 파일이 없으면 그 시험의 prepare 만 돈다)
//   --only a,b         이 이름들만 (쉼표, 여러 번 가능. 이름 = browser-suite.json 의 name, 파일 이름도 됨)
//   --skip a,b         이 이름들은 빼고
//   --group plugin,game,legacy   묶음으로 고르기
//   --list             고른 시험 표만 보이고 끝
//   --out <폴더>       기록 폴더. 기본 .scratch/test-browser/ (GOEI_TEST_OUT). 시험마다 logs/<이름>.log, 사진 shots/<이름>/, 결과 result.md·result.json
//   --timeout-scale n  제한 시간 배수 (느린 기계 2 등)
// 종료 코드: 하나라도 실패·시간 초과면 1.
//
// 돌리는 동안: 통합 빌드와 prepare(적 시험장·대사 시연판·본부 시연판 빌드)가 release/demo 에도 쓴다. 시작할 때 깨끗했던 release/ 파일은
// 끝날 때 `git checkout -- <그 파일들>` 로 되돌린다(release/ 는 릴리스 때만 바꾼다는 규칙). 이미 바뀐 채였던 파일은 건드리지 않는다.
// 공용 정적 서버(server: true 인 시험, exploration·run-resume)는 저장소 루트에서 `python3 -m http.server <포트>` 를 띄우고 끝나면 내린다.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, createWriteStream, openSync, closeSync, readSync, fstatSync } from 'node:fs';
import { dirname, resolve, basename, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = resolve(ROOT, 'tests/browser-suite.json');

// ---- 인자 ------------------------------------------------------------------------------------------------------
const opt = { fixture: process.env.GOEI_FIXTURE || '', build: true, only: [], skip: [], group: [], list: false, out: process.env.GOEI_TEST_OUT || '', scale: 1 };
{
  const a = process.argv.slice(2);
  const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = () => { if (i + 1 >= a.length) throw new Error(`${k} 뒤에 값이 없어요`); return a[++i]; };
    if (k === '--fixture') opt.fixture = v();
    else if (k === '--no-build') opt.build = false;
    else if (k === '--only') opt.only.push(...list(v()));
    else if (k === '--skip') opt.skip.push(...list(v()));
    else if (k === '--group') opt.group.push(...list(v()));
    else if (k === '--list') opt.list = true;
    else if (k === '--out') opt.out = v();
    else if (k === '--timeout-scale') opt.scale = Number(v()) || 1;
    else if (k === '-h' || k === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
    else throw new Error(`모르는 옵션: ${k}`);
  }
}
const OUT = resolve(ROOT, opt.out || '.scratch/test-browser');
mkdirSync(resolve(OUT, 'logs'), { recursive: true });

// ---- 시험 고르기 ----------------------------------------------------------------------------------------------
const suite = JSON.parse(readFileSync(SUITE, 'utf8')).tests;
const nameOf = (t) => [t.name, basename(t.file), basename(t.file).replace(/\.mjs$/, ''), basename(t.file).replace(/-browser\.mjs$/, '')];
const picked = (t) => (!opt.only.length || opt.only.some((n) => nameOf(t).includes(n))) && !opt.skip.some((n) => nameOf(t).includes(n)) && (!opt.group.length || opt.group.includes(t.group));
for (const n of [...opt.only, ...opt.skip]) if (!suite.some((t) => nameOf(t).includes(n))) console.warn(`경고: 목록에 없는 이름 ${n}`);
const tests = suite.filter(picked);
if (!tests.length) { console.error('고른 시험이 없어요'); process.exit(2); }

const fmtMs = (ms) => (ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`);
const pad = (s, n) => { const w = [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 0x2e7f ? 2 : 1), 0); return String(s) + ' '.repeat(Math.max(0, n - w)); };

if (opt.list) {
  console.log(pad('이름', 30) + pad('묶음', 8) + pad('인자', 20) + pad('제한', 6) + '틀');
  for (const t of tests) console.log(pad(t.name, 30) + pad(t.group, 8) + pad((t.args || []).join(' ') + (t.server ? ' [서버]' : ''), 20) + pad(`${t.timeoutMin}분`, 6) + t.frame);
  process.exit(0);
}

// ---- 도우미 -------------------------------------------------------------------------------------------------------
const log = (...a) => console.log(`[test-browser] ${a.join(' ')}`);
function run(cmd, args, label) {
  log(`${label}: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  if (r.status !== 0) throw new Error(`${label} 실패 (exit ${r.status ?? r.signal})`);
}
const gitLines = (args) => { const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null; };
const releaseDirty = () => new Set((gitLines(['status', '--porcelain', '--', 'release/']) || []).map((l) => l.slice(3)));
const tail = (file, lines = 6) => {
  try {
    const fd = openSync(file, 'r'); const size = fstatSync(fd).size; const n = Math.min(size, 16_384); const b = Buffer.alloc(n);
    readSync(fd, b, 0, n, size - n); closeSync(fd);
    return b.toString('utf8').split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-lines);
  } catch { return []; }
};

// ---- fixture -----------------------------------------------------------------------------------------------------
const needFixture = tests.some((t) => (t.args || []).includes('fixture'));
let fixturePath = '';
if (needFixture) {
  let p = resolve(ROOT, opt.fixture || '.scratch/fixture/fixture.json');
  if (existsSync(p) && !p.endsWith('.json')) p = resolve(p, 'fixture.json');
  if (!p.endsWith('.json')) p = resolve(p, 'fixture.json');
  if (!existsSync(p)) {
    const dir = dirname(p);
    const rel = relative(ROOT, dir);
    if (!rel.startsWith('..') && !isAbsolute(rel) && spawnSync('git', ['check-ignore', '-q', dir], { cwd: ROOT }).status !== 0) throw new Error(`fixture 폴더 ${rel} 가 .gitignore 에 없어요 (.scratch/ 안에 두거나 --fixture 로 저장소 밖을 가리키세요)`);
    mkdirSync(dir, { recursive: true });
    const charx = resolve(dir, 'lite.charx');
    log(`fixture 가 없어 만든다: ${p}`);
    run('python3', ['tools/build_lite_card.py', 'card/원본_봇카드.jpeg', charx], '경량 카드');
    try {
      run('python3', ['tests/make_fixture.py', charx, p], 'fixture');
    } finally {
      if (existsSync(charx)) { unlinkSync(charx); log('lite.charx(93MB) 지움'); }
    }
  }
  fixturePath = p;
  log(`fixture: ${relative(ROOT, p)}`);
}

// ---- 빌드 (release/ 는 끝날 때 되돌린다) ---------------------------------------------------------------------------
const releaseBefore = releaseDirty();
let restored = [];
function restoreRelease() {
  const now = releaseDirty();
  const mine = [...now].filter((f) => !releaseBefore.has(f));
  if (!mine.length) return;
  const r = spawnSync('git', ['checkout', '--', ...mine], { cwd: ROOT, stdio: 'inherit' });
  if (r.status === 0) { restored = mine; log(`release/ 되돌림: ${mine.join(', ')}`); } else log('release/ 되돌리기 실패 — 직접 `git checkout -- release/`');
}
process.on('exit', restoreRelease);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopServer(); process.exit(130); });

const prepares = new Set();
for (const t of tests) {
  const missing = (t.requires || []).filter((f) => !existsSync(resolve(ROOT, f)));
  if (t.prepare?.length && (opt.build || missing.length)) for (const c of t.prepare) prepares.add(c);
}
if (opt.build) run('npm', ['run', 'build'], '통합 빌드');
else log('--no-build: 통합 빌드 건너뜀');
for (const c of prepares) { const [cmd, ...args] = c.split(/\s+/); run(cmd, args, '추가 빌드'); }

// ---- 공용 정적 서버 ---------------------------------------------------------------------------------------------
let server = null, serverPort = 0;
async function freePort() {
  return new Promise((ok, no) => { const s = net.createServer(); s.unref(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
}
async function ensureServer() {
  if (server) return serverPort;
  serverPort = Number(process.env.GOEI_HTTP_PORT) || 8765;
  const busy = await new Promise((ok) => { const c = net.connect(serverPort, '127.0.0.1'); c.once('connect', () => { c.destroy(); ok(true); }); c.once('error', () => ok(false)); });
  if (busy) { serverPort = await freePort(); log(`8765 가 쓰이는 중 → ${serverPort}`); }
  server = spawn('python3', ['-m', 'http.server', String(serverPort), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', () => {});
  server.on('exit', (c) => { if (server) { log(`정적 서버가 먼저 끝남 (exit ${c})`); server = null; } });
  for (let i = 0; i < 100; i++) {
    const up = await new Promise((ok) => { const c = net.connect(serverPort, '127.0.0.1'); c.once('connect', () => { c.destroy(); ok(true); }); c.once('error', () => ok(false)); });
    if (up) { log(`정적 서버 http://127.0.0.1:${serverPort}/ (저장소 루트)`); return serverPort; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('정적 서버가 뜨지 않아요 (python3 -m http.server)');
}
function stopServer() { if (server) { const s = server; server = null; try { s.kill('SIGTERM'); } catch {} } }

// ---- 시험 하나 --------------------------------------------------------------------------------------------------
function killTree(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
  setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 3000).unref();
}
async function runTest(t) {
  const shots = resolve(OUT, 'shots', t.name);
  const sub = (s) => String(s).replace(/\$\{port\}/g, String(serverPort)).replace(/\$\{shots\}/g, shots).replace(/\$\{fixture\}/g, fixturePath);
  const args = (t.args || []).map((a) => (a === 'fixture' ? fixturePath : a === 'shots' ? shots : sub(a)));
  if ((t.args || []).includes('shots') || Object.values(t.env || {}).some((v) => /\$\{shots\}/.test(v))) mkdirSync(shots, { recursive: true });
  const missing = (t.requires || []).filter((f) => !existsSync(resolve(ROOT, f)));
  if (missing.length) return { name: t.name, status: '건너뜀', ms: 0, why: `필요한 파일 없음: ${missing.join(', ')}` };
  if (t.server) await ensureServer();
  const env = { ...process.env };
  for (const [k, v] of Object.entries(t.env || {})) env[k] = sub(v);
  const logFile = resolve(OUT, 'logs', `${t.name}.log`);
  const outStream = createWriteStream(logFile);
  const cmd = ['node', t.file, ...args];
  outStream.write(`$ ${cmd.join(' ')}\n${Object.entries(t.env || {}).map(([k, v]) => `${k}=${sub(v)}`).join(' ')}\n\n`);
  const timeout = Math.round((t.timeoutMin || 10) * 60_000 * opt.scale);
  const t0 = Date.now();
  log(`▶ ${t.name}  (${t.file}${args.length ? ' ' + args.map((a) => relative(ROOT, a) || a).join(' ') : ''}, 제한 ${fmtMs(timeout)})`);
  const child = spawn(cmd[0], cmd.slice(1), { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.pipe(outStream, { end: false });
  child.stderr.pipe(outStream, { end: false });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; killTree(child); }, timeout);
  const code = await new Promise((ok) => child.on('exit', (c, sig) => ok(c ?? `signal ${sig}`)));
  clearTimeout(timer);
  await new Promise((r) => outStream.end(r));
  const ms = Date.now() - t0;
  const res = { name: t.name, ms, log: relative(ROOT, logFile) };
  if (timedOut) { res.status = '시간 초과'; res.why = `${fmtMs(timeout)} 넘김`; }
  else if (code === 0) res.status = '통과';
  else { res.status = '실패'; res.why = `exit ${code}`; }
  if (res.status !== '통과') res.tail = tail(logFile);
  log(`${res.status === '통과' ? '✓' : '✗'} ${t.name} ${res.status} ${fmtMs(ms)}${res.why ? ' — ' + res.why : ''}`);
  return res;
}

// ---- 전체 -----------------------------------------------------------------------------------------------------
const results = [];
const started = new Date();
try {
  for (const t of tests) results.push(await runTest(t));
} finally {
  stopServer();
  restoreRelease();
}
const bad = results.filter((r) => r.status !== '통과' && r.status !== '건너뜀');
const total = results.reduce((a, r) => a + r.ms, 0);

const lines = [];
lines.push(`# 브라우저 시험 결과 · ${started.toISOString().slice(0, 16).replace('T', ' ')} (${fmtMs(total)}, ${results.length}개 중 통과 ${results.filter((r) => r.status === '통과').length} · 실패 ${bad.length} · 건너뜀 ${results.filter((r) => r.status === '건너뜀').length})`);
lines.push('');
lines.push('| 시험 | 결과 | 시간 | 비고 |');
lines.push('|---|---|---|---|');
for (const r of results) lines.push(`| ${r.name} | ${r.status} | ${fmtMs(r.ms)} | ${(r.why || '').replace(/\|/g, '\\|')}${r.tail?.length ? ' — ' + r.tail.slice(-2).join(' ⏎ ').replace(/\|/g, '\\|').slice(0, 300) : ''} |`);
lines.push('');
lines.push(`fixture: ${fixturePath ? relative(ROOT, fixturePath) : '(안 씀)'} · 빌드: ${opt.build ? '함' : '건너뜀'} · 기록: ${relative(ROOT, OUT)}/logs/ · 되돌린 release/: ${restored.length ? restored.join(', ') : '없음'}`);
const md = lines.join('\n');
writeFileSync(resolve(OUT, 'result.md'), md + '\n');
writeFileSync(resolve(OUT, 'result.json'), JSON.stringify({ started: started.toISOString(), fixture: fixturePath, build: opt.build, results }, null, 2) + '\n');

console.log('\n' + pad('시험', 30) + pad('결과', 10) + pad('시간', 9) + '비고');
for (const r of results) console.log(pad(r.name, 30) + pad(r.status, 10) + pad(fmtMs(r.ms), 9) + (r.why || ''));
for (const r of bad) if (r.tail?.length) { console.log(`\n--- ${r.name} 마지막 출력 (${r.log})`); for (const l of r.tail) console.log('  ' + l); }
console.log(`\n${results.length}개 중 통과 ${results.length - bad.length - results.filter((r) => r.status === '건너뜀').length} · 실패 ${bad.length} · ${fmtMs(total)} · 표 ${relative(ROOT, OUT)}/result.md`);
process.exit(bad.length ? 1 : 0);
