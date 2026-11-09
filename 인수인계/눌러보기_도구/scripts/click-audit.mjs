// 눌러 보는 전수점검 (2026-11-08 사용자: 「전수점검을 수도 없이 시키는데 왜 못 잡냐」 → 코드 읽기 말고 실제로 눌러 보기).
// 점검하는 Claude가 쓰는 도구다. 실제 브라우저(PC·폰)에서 플러그인을 띄우고, 화면에 보이는 눌리는 것을 하나도 빼지 않고 사람처럼 누른다.
// 누를 때마다 앞·직후·뒤 캡처와 반응(오류, 창이 바로 닫힘, 반응 없음, 선택 표시 등)을 적고, 새로 열린 화면은 다시 그 안을 다 누른다.
// 모든 화면에서 같은 종류 단추·칸의 크기·색·글씨·간격·선택 표시를 재서 서로 다른 것(통일성)을 모은다.
// 판단(사용자 결정과 맞는지, 이상한지)은 이 도구가 하지 않는다. 점검하는 Claude가 report.md 와 캡처를 직접 보고 한다 (docs/눌러보기_전수점검.md).
//
// 사용법: node scripts/click-audit.mjs [옵션]          (npm run audit:click -- [옵션])
//   --vp pc,phone,land    화면 크기 (기본 pc,phone)
//   --start board,picker  어느 화면에서 시작하나 (기본 board,picker,items,shop). board = 채팅 시작 뒤 상황판, picker = 시작 화면,
//                         items = 상황판 + 소지품(장착·소모·손상·고장), shop = 그 상태로 채팅 속 가게 카드를 눌러 연 상점,
//                         gnet = 괴담넷 글·댓글·쪽지가 있는 상태
//   --depth n             누른 뒤 새로 열린 화면을 몇 단계까지 따라 들어가나 (기본 6)
//   --per-action n        같은 data-action 의 값(data-value)이 많을 때(지역 250곳·위키 항목 등) 누를 값 수 (기본 8, 0 = 전부). 못 누른 값 수는 보고서 7절에 적는다
//   --explore-values n    같은 data-action 중 몇 개의 값까지 열린 화면 안으로 따라 들어가나 (기본 0 = 제한 없음). 같은 꼴 화면(보이는 동작 이름 묶음이 같음)은 늘 한 번만 들어간다
//   --max-clicks n        화면 크기마다 최대로 누를 수 (기본 0 = 끝까지)
//   --workers n           동시에 띄울 페이지 수 (기본 CPU 수)
//   --out <폴더>          기록 폴더 (기본 .scratch/click-audit). 안에 report.md · report.json · shots/
//   --fixture <경로>      시험 카드 (기본 .scratch/fixture/fixture.json, 없으면 `npm run test:browser -- --only install` 로 먼저 만든다)
//   --only-scope <css>    이 선택자 안의 것만 누른다 (예: '.gx' 상황판 창만)
//   --probe <파일.mjs>    --from 화면에서 그 파일의 default(page, {vp, shots, log}) 만 돌리고 결과를 probe-<vp>.json 에 (누르기 안 함)
//   --report-only         누르지 않고 --out 폴더의 report.json(끊긴 것도)으로 report.md 만 다시 만든다
//   --resume <폴더,…>     같은 판(커밋)의 지난 기록(report.json)을 읽어, 이미 누른 단추는 건너뛰고 못 누른 곳만 이어서 누른다.
//                         지난 결과도 이번 보고서에 합친다(캡처는 지난 폴더 것을 가리킴). 판이 다르면 멈춘다 (11-09 사용자: 통과한 것을 왜 또 하냐)
//   --plan                --resume 와 같이: 누르지 않고, 다시 누를 동작·연계·건너뛸 수만 보여 준다
//   --from 'a|v>b|v'      시작 상태에서 이 열쇠들을 차례로 누른 화면부터 점검한다 (한 화면만 빨리 다시 볼 때. 열쇠는 report.md 의 `action|value`)
// 빌드(dist/)가 있어야 한다: npm run build
import os from 'node:os';
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boot, launch, loadFixture, openWin, closeEditor, VIEWPORTS, isPhoneVp } from '../tests/qc-settings-harness.mjs';
import { distPack } from '../tests/data-init.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const opt = { vp: ['pc', 'phone'], start: ['board', 'picker', 'items', 'shop', 'gnet'], depth: 6, perAction: 8, exploreValues: 0, maxClicks: 0, workers: Math.max(2, os.cpus().length + 1), out: '.scratch/click-audit', fixture: '.scratch/fixture/fixture.json', scope: '', from: [] };
{
  const a = process.argv.slice(2);
  const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = () => a[++i];
    if (k === '--vp') opt.vp = list(v());
    else if (k === '--start') opt.start = list(v());
    else if (k === '--depth') opt.depth = Number(v());
    else if (k === '--per-action') opt.perAction = Number(v());
    else if (k === '--explore-values') opt.exploreValues = Number(v());
    else if (k === '--max-clicks') opt.maxClicks = Number(v());
    else if (k === '--workers') opt.workers = Number(v());
    else if (k === '--out') opt.out = v();
    else if (k === '--fixture') opt.fixture = v();
    else if (k === '--report-only') opt.reportOnly = true;
    else if (k === '--resume') opt.resume = list(v());
    else if (k === '--plan') opt.plan = true;
    else if (k === '--head') opt.head = v(); // --plan 시험용: 지금 판 대신 이 커밋과 비교
    else if (k === '--only-scope') opt.scope = v();
    else if (k === '--probe') opt.probe = v();
    else if (k === '--from') opt.from = v().split('>').map((x) => x.trim()).filter(Boolean).map((key) => ({ key, nth: 0 }));
    else if (k === '-h' || k === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
    else throw new Error(`모르는 옵션: ${k}`);
  }
}
const OUT = resolve(ROOT, opt.out);
const SHOTS = resolve(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });
if (!existsSync(resolve(ROOT, 'dist/goei-plugin.js'))) throw new Error('dist/ 가 없어요: npm run build 먼저');
if (!existsSync(resolve(ROOT, opt.fixture))) throw new Error(`시험 카드가 없어요: ${opt.fixture} (npm run test:browser -- --only install 로 만들기)`);
const fx = loadFixture(resolve(ROOT, opt.fixture));
// 어느 판으로 돌렸나: 브랜치·커밋·고친 채 안 올린 파일·빌드가 소스보다 옛것인지 (점검 중에도 코드는 계속 바뀐다, 11-08 사용자)
import { execSync as sh } from 'node:child_process';
const git = (c) => { try { return sh(`git ${c}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
// 빌드가 옛것인지: 마지막으로 src 를 바꾼 커밋 시각과, 커밋 안 한 채 고친 src 파일 시각 중 늦은 것보다 dist 가 먼저면 옛 빌드 (빌드가 만드는 src/data 파일은 git 이 안 잡으니 빠진다)
const newestSrc = (() => { let m = Number(git('log -1 --format=%ct -- src')) * 1000 || 0; for (const l of git('status --porcelain -- src').split('\n').filter(Boolean)) { try { m = Math.max(m, statSync(resolve(ROOT, l.slice(3).trim())).mtimeMs); } catch {} } return m; })();
let VERSION = { branch: (() => { const b = git('rev-parse --abbrev-ref HEAD'); if (b && b !== 'HEAD') return b; const n = git("branch -r --contains HEAD --format='%(refname:short)'").split('\n').filter(Boolean)[0]; return n ? n.replace(/^origin\//, '') + '(분리된 판)' : 'HEAD(분리된 판)'; })(), commit: git('log -1 --format=%h·%cd --date=format:%m-%d_%H:%M'), dirty: git('status --porcelain -- src').split('\n').filter(Boolean).length, distOld: statSync(resolve(ROOT, 'dist/goei-plugin.js')).mtimeMs < newestSrc, card: (() => { try { return JSON.parse(readFileSync(resolve(ROOT, 'release/version.json'), 'utf8')).plugin; } catch { return ''; } })() };
if (VERSION.distOld) console.warn('[click-audit] 경고: dist/ 가 src/ 보다 옛것이에요. npm run build 를 먼저 돌리세요 (옛 빌드를 누르게 됨)');
const LOOKS = distPack('goei-data-looks');
const ITEMS = (() => { try { return distPack('goei-data-items'); } catch { return null; } })();
const log = (...m) => console.log('[click-audit]', ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 시작 상태 만들기 ------------------------------------------------------------------------------------------
// 상황판: 시작 화면에서 실제로 소속·상황을 골라 출발하고, 괴이·사건이 생기는 응답 하나를 넣는다. 그 채팅·저장소를 그대로 떠 두고
// 누를 때마다 새 페이지에 넣어 띄운다(앞에서 누른 것이 다음 누르기에 섞이지 않게).
const STATUS = '[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';

const START_ITEMS = [
  { id: 'i_bat', name: '알루미늄 야구방망이', desc: '손잡이에 테이프', effect: '둔기', use: true, equip: 'weapon', slot: 0, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },
  { id: 'i_vest', name: '방검 조끼', desc: '입고 있음', effect: '', use: false, equip: 'gear', slot: 0, state: 'damaged', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },
  { id: 'i_salt', name: '굵은 소금', desc: '지퍼백 한 봉지', effect: '부정한 것을 물린다', use: true, uses: 5, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },
  { id: 'i_light', name: '손전등', desc: 'LED', effect: '어두운 곳을 비춘다', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },
  { id: 'i_card', name: '사원증', desc: '관리국 출입증', effect: '', use: false, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },
  { id: 'i_phone', name: '고장 난 휴대폰', desc: '화면이 깨짐', effect: '', use: false, state: 'broken', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },
];
const GNET_BOARD = { posts: [
  { author: 'abc92', id: 1846002, title: '소라 랜드 관람차 혼자 돎', time: '02:30', date: '2025.01.01 02:30', views: 4237, upvotes: 113, content: '어제 봤음\n진짜임', mine: false,
    comments: [{ author: 'ㅇㅇ(118.235)', content: '사진 없으면 구라', parent: 0, mine: false }, { author: 'abc92', content: '찍으려다 폰 꺼짐', parent: 1, mine: false }] },
  { author: '아직안잠', id: 1846001, title: '야간 편의점 고양이', time: '02:20', date: '2025.01.01 02:20', views: 941, upvotes: 27, content: '오늘도 출근함', mine: false, comments: [] },
], incoming: [{ nick: '관람차덕후', body: '혹시 몇 시쯤이었음?' }] };
const SHELF = `<shop-identity>
sells: 공구, 소모품, 작업복, 호신 기기
never: 식품, 약
prices: 동네 철물점 값
price_range: 1000~200000
</shop-identity>
<owner>뭐 찾소. 값은 적힌 대로고.</owner>
<shelf>
손전등|18000|사용|flashlight|LED 손전등|어두운 곳을 비춘다
공구 가방|42000|장비|tool bag|캔버스 가방|
쇠파이프|7000|무기·사용|iron pipe|1m 길이|둔기로 쓸 수 있다
호신용 최루 스프레이|15000|소모5|pepper spray|경찰 납품용|잠시 멈춘다
작업용 장갑|9000|장비|work gloves|가죽 보강|
철제 봉인 상자|120000|-|metal box|자물쇠 둘|
</shelf>`;
const WIKI_FILES = (() => { try { const idx = JSON.parse(readFileSync(resolve(ROOT, 'release/wiki-base.json'), 'utf8')); const f = { 'wiki-base.json': JSON.stringify(idx) }; for (const n of idx.parts) f[n] = readFileSync(resolve(ROOT, 'release', n), 'utf8'); return f; } catch { return null; } })();
const KEEP_OUT = new Set(['p:goei:body', 'p:goei:data-world']); // hostScript 가 넣는다

async function settle(page) {
  // 설치 안내로 설정 창이 저절로 열렸으면: 사람이 하듯 「설치」를 누르고 닫는다
  await sleep(120);
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => document.querySelector('.gw')?.hidden === false);
    if (!open) break;
    await closeEditor(page, true).catch(() => {});
    await sleep(200);
  }
}

async function makeBase(browser, vp, kind) {
  const store0 = { 'p:goei:data-looks': LOOKS, ...(ITEMS ? { 'p:goei:data-items': ITEMS } : {}) };
  const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, vp, { store: store0 });
  // 설치 「빠진 것 전부 채우기」가 받는 위키 기본 문서를 저장소 판(release/)에서 내준다 → 위키 문서 화면까지 누른다
  if (WIKI_FILES) await page.evaluate((f) => Object.assign(window.__files, f), WIKI_FILES);
  await openWin(page);
  // 첫 실행 설치: 「설치」 단추를 눌러 둔다 (실제 사용자는 설치하고 쓴다)
  await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) {
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-tab"][data-value="manage"]')?.click());
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-node"][data-value="install"]')?.click());
    await sleep(200);
    await page.evaluate(() => document.querySelector('.gw [data-action="ed-inst-all"]')?.click());
    await sleep(1500);
  }
  await settle(page);
  if (kind !== 'picker') {
    await page.waitForSelector('.gx-fac');
    await page.evaluate(() => document.querySelector('.gx-fac[data-value="A00"]').click());
    await page.evaluate(() => document.querySelector('.gx-sc[data-value="2"]')?.click());
    await page.waitForFunction(() => !document.querySelector('.gx-start')?.disabled, null, { timeout: 5000 });
    const n = await page.evaluate(() => window.__calls.setChat.length);
    await page.evaluate(() => document.querySelector('.gx-start').click());
    await page.waitForFunction((n) => window.__calls.setChat.length > n, n);
    await sleep(400);
    // 첫 요청에 플러그인이 넣는 「NEW [AN|…]」 자리를 그대로 채워 답한다 → 괴이·사건·특수가 실제로 상황판에 생긴다
    await page.evaluate(async (status) => {
      window.__chat.message.push({ role: 'user', data: '출동', chatId: 'u1' });
      const out = JSON.stringify(await window.__calls.replacers[0]([{ role: 'system', content: 'x' }, { role: 'user', content: '출동' }], 'model'));
      const fill = { '<발생지점>': 'QC 지점', '<등급>': 'B', '<배치>': '없음', '<상황>': '소란', '<방문자>': '없음', '<상태>': '대기' };
      const tags = [...new Set((out.match(/NEW \[(?:AN|IN|MS)\|[^\]]*\]/g) || []).map((t) => t.slice(4).replace(/<[^>|]+>/g, (m) => fill[m] ?? 'QC')))];
      window.__caReply = ['첫 답. 쟈알디가 손을 흔들었다.', ...tags, status].join('\n');
    }, STATUS);
    await page.evaluate(async () => {
      const reply = window.__caReply;
      window.__chat.message.push({ role: 'char', data: reply, chatId: 'c1' });
      await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(window.__chat)), characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 });
    });
    await sleep(300);
  }
  // 소지품이 든 상태: 장착 무기·장비, 소모성, 보통 물건, 손상된 것
  if (kind === 'items' || kind === 'shop') {
    await page.evaluate((items) => { window.__chat.scriptstate.$st_items = JSON.stringify({ list: items, log: [] }); }, START_ITEMS);
  }
  // 일지 항목이 있는 상태: 상황판에서 사건 하나를 종료(휴지통 두 번)해 일지·보고서 줄을 만든다 → 기록 화면 항목 열기까지
  if (kind === 'items') {
    await openWin(page).catch(() => {}); await settle(page);
    for (let i = 0; i < 2; i++) { await page.click('.gx [data-action="end-event"]', { timeout: 3000 }).catch(() => log('사건 종료 못 누름')); await sleep(500); }
    await page.waitForFunction(() => String(window.__chat.scriptstate.$goei_journal || '').includes('"id"'), null, { timeout: 5000 }).catch(() => log('일지 줄이 안 생김'));
  }
  // 괴담넷 글이 있는 상태: 괴담넷을 열고 새로고침(가짜 보조 모델이 글 둘·댓글을 돌려줌)
  if (kind === 'gnet') {
    await openWin(page); await settle(page);
    await page.evaluate((b) => { window.__llm = [{ type: 'success', result: '```json\n' + JSON.stringify(b) + '\n```' }]; }, GNET_BOARD);
    // 옛 판: 괴담넷 탭. 0.21.4~: 인터넷 → (로그인 묻기면 로그인 없이) → 괴담넷 사이트
    const old = await page.evaluate(() => { const b = document.querySelector('[data-action="nav-tab"][data-value="gnet"], [data-action="tab"][data-value="gnet"]'); b?.click(); return !!b; });
    if (!old) {
      await page.evaluate(() => document.querySelector('[data-action="nav-tab"][data-value="net"], [data-action="tab"][data-value="net"]')?.click());
      await sleep(400);
      await page.evaluate(() => document.querySelector('[data-action="br-login-guest"]')?.click());
      await sleep(300);
      await page.evaluate(() => document.querySelector('[data-action="br-go"][data-value="gn"], [data-action="br-site"][data-value="gn"]')?.click());
    }
    await sleep(400);
    await page.evaluate(() => document.querySelector('[data-action="gn-refresh"]')?.click());
    await page.waitForSelector('.gn-row-main', { timeout: 8000 }).catch(() => log('괴담넷 글이 안 생김'));
    await sleep(300);
  }
  // 가게가 열린 상태: 응답에 가게 표식 → 채팅 카드 「상점 열기」 → 진열대(가짜 보조 모델 응답). 진열대가 저장된 채팅을 떠 둔다
  let pre = null;
  if (kind === 'shop') {
    const shopMsg = '철문을 밀자 기름 냄새와 쇠 냄새가 한꺼번에 밀려왔다.\n[▣|2025.01.01|02:47 PM|☀️|4°C|을지로 철물점|목표]\n[shop: 을지로 철물점|백사헌]';
    await page.evaluate(async (m) => { window.__chat.message.push({ role: 'user', data: '철물점에 들어간다', chatId: 'u2' }, { role: 'char', data: m, chatId: 'c2' }); await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: window.__chat.message.length - 1 }); }, shopMsg);
    await sleep(300);
    pre = { shopMsg };
    await openShop(page, pre, SHELF);
    await page.waitForFunction(() => { try { return JSON.parse(window.__chat.scriptstate.$st_shop || 'null')?.loaded; } catch { return false; } }, null, { timeout: 8000 }).catch(() => log('가게 진열대가 안 채워짐'));
    // 하나 사 둔다: 가계부 항목·산 물건이 있는 상태 (가계부 항목 열기·고치기, 산 물건 화면까지 누르게)
    await page.click('[data-action="shop-detail"]', { timeout: 3000 }).catch(() => log('가게 물건 못 엶'));
    await sleep(300);
    await page.click('[data-action="shop-buy"]', { timeout: 3000 }).catch(() => log('가게 구입 못 누름'));
    await sleep(600);
  }
  const base = await page.evaluate((keep) => ({ chat: window.__chat, char: window.__char, store: Object.fromEntries(Object.entries(window.__store).filter(([k]) => !keep.includes(k))) }), [...KEEP_OUT]);
  await page.close();
  if (errors.length) log(`${vp}/${kind} 시작 상태 만들 때 오류`, errors);
  base.pre = pre;
  return base;
}

const T = (n) => { if (process.env.CA_TIME) { const t = Date.now(); log(`⏱ ${n} ${t - (T.t || t)}ms`); T.t = t; } };
async function openFrom(browser, vp, base) {
  T('시작');
  const { page, errors } = await boot(browser, { ...fx, fixture: base.char }, base.chat, vp, { store: base.store });
  page.on('dialog', (d) => { errors.push(`(대화상자 ${d.type()}) ${d.message()}`); d.accept().catch(() => {}); });
  page.on('filechooser', () => {});
  T('boot');
  // 가짜 모델: 따로 넣은 답이 없을 때 진열대 요청(상점·쇼핑몰)에는 진열대를 돌려준다 → 쇼핑몰 물건이 깔린 뒤 화면까지 누른다
  await page.evaluate((shelf) => { const q = []; window.__llm = new Proxy(q, { get(t, p) { if (p === 'shift') return () => { if (t.length) return t.shift(); const s = JSON.stringify((window.__calls.llm || []).at(-1) || '').slice(-80000); return /<shelf>/.test(s) ? { type: 'success', result: shelf } : undefined; }; return Reflect.get(t, p); } }); }, SHELF);
  // 실제 Risu 에선 플러그인 창이 따로 띄운 틀(iframe, z 49~1000)이라 둥근 괴이 단추(본 문서 z 45)가 창 밑에 깔린다.
  // 시험 틀은 한 문서에 그리므로, 창이 열려 있으면 둥근 단추를 숨겨 실제와 맞춘다 (11-09 릴리스 스레드 확인)
  await page.addStyleTag({ content: 'body:has(.gx:not([style*="display: none"])) [x-goei-fab], body:has(.gw:not([hidden])) [x-goei-fab] { visibility: hidden !important; }' });
  await openWin(page);
  T('openWin');
  await settle(page);
  T('settle');
  if (base.pre?.shopMsg) await openShop(page, base.pre, null);
  await page.waitForTimeout(200);
  return { page, errors };
}

// 채팅 속 가게 카드의 「상점 열기」를 사람처럼 누른다 (상황판 창은 닫고, 카드는 채팅 자리에 그린다)
async function openShop(page, pre, shelf) {
  await page.evaluate(() => { const g = document.querySelector('.gx'); if (g && g.style.display !== 'none') document.querySelector('.gx [data-action="close"]')?.click(); });
  await sleep(200);
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), pre.shopMsg);
  if (process.env.CA_DEBUG) log('shop', JSON.stringify(await page.evaluate(() => window.__chat.scriptstate.$st_shop)).slice(0, 200), String(html).includes('data-goei-shop'), String(html).slice(-200));
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:1'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await page.evaluate((t) => window.__calls.handlers.display(t), pre.shopMsg);
  if (shelf) await page.evaluate((t) => { window.__llm = [t]; }, shelf);
  await page.click('#chat-card [data-goei-shop]', { timeout: 3000 }).catch((e) => log('상점 열기 못 누름', String(e).slice(0, 120)));
  await page.evaluate(() => { const c = document.getElementById('chat-card'); if (c) c.style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.gx-solo'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 8000 }).catch(() => {});
  await sleep(200);
}

// ---- 페이지 안에서 쓰는 것 --------------------------------------------------------------------------------------
// 눌리는 것: data-action 있는 것 전부 + button/summary/[role=button]/label(체크) 중 data-action 없는 것.
// 열쇠(key) = data-action|data-value (없으면 tag.첫클래스|글자). 같은 열쇠가 여럿이면 n번째로 찾는다.
const PAGE_LIB = `
window.__ca = (() => {
  const SKIP = '#other, .default-chat-screen > #other';
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false; const dt = el.closest('details:not([open])'); if (dt && !el.closest('summary')?.parentElement?.isSameNode(dt)) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01; };
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.querySelector?.('img')?.alt || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const cls1 = (el) => [...el.classList].filter((c) => !/^(on|sel|active|open|primary|danger|has-|k-|none$)/.test(c))[0] || '';
  const keyOf = (el) => el.dataset.action ? el.dataset.action + '|' + (el.dataset.value ?? '') : el.tagName.toLowerCase() + '.' + cls1(el) + '|' + label(el);
  const clickables = (scope) => {
    const root = scope ? document.querySelectorAll(scope) : [document.body];
    const out = [];
    for (const r of root) for (const el of r.querySelectorAll('[data-action], button, summary, [role=button], label:has(> input[type=checkbox]), input[type=checkbox], input[type=radio], select')) {
      if (el.closest(SKIP)) continue;
      if (el.matches('[data-action] *') && !el.matches('[data-action]') && el.closest('[data-action]') && !el.matches('button, summary, input, select')) continue;
      if (!el.dataset.action && el.closest('[data-action]') && el.closest('[data-action]') !== el) continue; // 안쪽 장식
      out.push(el);
    }
    return out;
  };
  const hit = (el) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2);
    const top = document.elementFromPoint(x, y);
    return { x, y, ok: !!top && (top === el || el.contains(top) || top.contains(el) && top.closest('label') === el.closest('label')), top: top ? top.tagName.toLowerCase() + '.' + [...top.classList].slice(0, 2).join('.') : '' };
  };
  const list = (scope) => {
    const seen = {};
    return clickables(scope).filter(vis).map((el) => {
      const key = keyOf(el); const nth = (seen[key] = (seen[key] ?? -1) + 1);
      const r = el.getBoundingClientRect();
      // 다른 창(설정 창 등) 뒤에 깔린 것은 지금 화면의 단추가 아니다 → behind. 눌리는 것끼리 겹쳐 가린 것은 문제이므로 그대로 둔다
      let behind = false;
      if (r.top < innerHeight && r.bottom > 0) { const h = hit(el); if (!h.ok) { const top = document.elementFromPoint(h.x, h.y); const LAYER = '.gx-cdr, .gw, .gx-agpop, .gx-idpop, [role=dialog], [class*="pop"], [class*="drawer"], [class*="modal"], [class*="sheet"]'; const tl = top?.closest(LAYER); const el2 = el.closest(LAYER); behind = !!top && ((!!tl && !tl.contains(el)) || (!!el2 && !el2.contains(top)) || !top.closest('[data-action], button, summary, [role=button], label, input, select, a')); } }
      return { key, nth, behind, action: el.dataset.action || '', value: el.dataset.value ?? '', tag: el.tagName.toLowerCase(), cls: cls1(el), label: label(el), disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true', rect: [r.left, r.top, r.width, r.height].map(Math.round) };
    });
  };
  const find = (key, nth, scope) => { const seen = {}; for (const el of clickables(scope)) { if (!vis(el)) continue; const k = keyOf(el); const i = (seen[k] = (seen[k] ?? -1) + 1); if (k === key && i === nth) return el; } return null; };
  const containerOf = (el) => el.closest('[role=dialog], .gx-agpop, .gx-idpop, [class*="pop"], [class*="drawer"], [class*="modal"], .gw-win, .gw, .gx-panel, .gx') || document.body;
  const pathOf = (el) => { const a = []; for (let e = el; e && e !== document.body && a.length < 6; e = e.parentElement) a.push(e.tagName.toLowerCase() + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')); return a.reverse().join(' > '); };
  // 화면 표지: 보이는 열쇠 집합 + 창 상태
  const sig = (scope) => { const ks = list(scope).map((x) => x.key + '#' + x.nth); const gx = document.querySelector('.gx'); const gw = document.querySelector('.gw'); return { keys: ks, gx: !!gx && gx.style.display !== 'none', gw: !!gw && !gw.hidden, html: (document.querySelector('.gx')?.innerHTML.length ?? 0) + ':' + (document.querySelector('.gw')?.innerHTML.length ?? 0) + ':' + document.body.childElementCount }; };
  // 누르기 직전 감시: 누른 것과 그것을 담은 창이 언제 사라지는지, 누른 것의 class/aria 가 언제 바뀌는지
  const watch = (el, nth) => {
    const t0 = performance.now();
    const box = containerOf(el);
    const rec = { boxPath: pathOf(box), elGone: null, boxGone: null, elClass: [], boxClass: [], mutations: 0, firstMut: null, before: { elCls: el.className, aria: el.getAttribute('aria-pressed') ?? el.getAttribute('aria-selected') ?? el.getAttribute('aria-expanded') } };
    // 다시 그리기(innerHTML 바꿈)로 같은 창이 새 노드가 되는 건 닫힘이 아니다 → 창은 선택자로, 누른 것은 열쇠로 찾는다
    const boxSel = box === document.body ? 'body' : box.tagName.toLowerCase() + [...box.classList].filter((c) => !/^(on|sel|active|open|show|in|out|closing)$/.test(c)).slice(0, 1).map((c) => '.' + CSS.escape(c)).join(''); // 첫 class 만: 확인·대기 등 상태 class 가 빠져도 같은 창
    const elKey = keyOf(el);
    const goneBox = () => ![...document.querySelectorAll(boxSel)].some(vis);
    const goneEl = () => ![...document.querySelectorAll(el.dataset.action ? '[data-action="' + CSS.escape(el.dataset.action) + '"]' : el.tagName)].some((e) => vis(e) && keyOf(e) === elKey);
    const gone = (n) => n === box ? goneBox() : goneEl();
    const mo = new MutationObserver((ms) => {
      const t = Math.round(performance.now() - t0);
      rec.mutations += ms.length; if (rec.firstMut == null) rec.firstMut = t; rec.lastMut = t;
      for (const m of ms) {
        if (m.type === 'attributes' && m.target === el) rec.elClass.push([t, m.attributeName, el.getAttribute(m.attributeName)]);
        if (m.type === 'attributes' && m.target === box) rec.boxClass.push([t, m.attributeName, String(box.getAttribute(m.attributeName)).slice(0, 80)]);
      }
      if (rec.elGone == null && gone(el)) rec.elGone = t;
      if (rec.boxGone == null && gone(box)) rec.boxGone = t;
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-pressed', 'aria-selected', 'aria-expanded', 'open'] });
    // 애니메이션으로 사라지는 것도 잡게 잠깐 동안 프레임마다 본다
    let frames = 0;
    const tick = () => { const t = Math.round(performance.now() - t0); if (rec.elGone == null && gone(el)) rec.elGone = t; if (rec.boxGone == null && gone(box)) rec.boxGone = t; if (++frames < 90) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.__caWatch = { rec, stop: () => { mo.disconnect(); if (!el.isConnected) { const n2 = find(elKey, nth, null) || find(elKey, 0, null); if (n2) el = n2; } const s = el.isConnected ? getComputedStyle(el) : null; rec.after = { elCls: el.isConnected ? el.className : null, aria: el.getAttribute('aria-pressed') ?? el.getAttribute('aria-selected') ?? el.getAttribute('aria-expanded'), style: s && styleOf(el) }; return rec; } };
    return rec.boxPath;
  };
  const styleOf = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), font: s.fontSize, weight: s.fontWeight, family: s.fontFamily.split(',')[0].trim(), color: s.color, bg: s.backgroundColor, border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor, radius: s.borderTopLeftRadius, pad: s.paddingTop + ' ' + s.paddingRight, outline: s.outlineStyle === 'none' ? 'none' : s.outlineWidth + ' ' + s.outlineColor, shadow: s.boxShadow === 'none' ? 'none' : s.boxShadow.slice(0, 60), lh: s.lineHeight, align: s.textAlign }; };
  // 화면 점검: 화면 밖으로 나감, 글자 잘림, 눌리는 것끼리 겹침, 작은 누름 칸
  const audit = (scope) => {
    const W = innerWidth, H = innerHeight;
    const els = clickables(scope).filter(vis);
    const off = [], cut = [], overlap = [], small = [];
    const roots = scope ? [...document.querySelectorAll(scope)] : [document.querySelector('.gx'), document.querySelector('.gw')].filter(Boolean);
    for (const root of roots) for (const el of root.querySelectorAll('*')) {
      if (!vis(el) || el.closest('.gx-mclose')) continue;
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if ((r.right > W + 1 || r.left < -1) && s.position !== 'fixed' && !el.closest('[style*="translate"]')) { if (off.length < 30) off.push(pathOf(el) + ' ' + Math.round(r.left) + '~' + Math.round(r.right)); }
      if (el.childElementCount === 0 && el.textContent.trim() && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2) && s.overflow !== 'visible' && s.overflowX !== 'auto' && s.overflowY !== 'auto' && s.overflowX !== 'scroll') {
        if (cut.length < 40) cut.push({ path: pathOf(el), text: el.textContent.trim().slice(0, 30), ellipsis: s.textOverflow === 'ellipsis', sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight });
      }
    }
    const rs = els.map((el) => [el, el.getBoundingClientRect()]);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const [a, ra] = rs[i], [b, rb] = rs[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ix > 2 && iy > 2 && overlap.length < 30) overlap.push([keyOf(a), keyOf(b), Math.round(ix) + '×' + Math.round(iy)]);
    }
    for (const [el, r] of rs) if ((r.width < 32 || r.height < 32) && small.length < 60) small.push([keyOf(el), Math.round(r.width) + '×' + Math.round(r.height)]);
    const styles = els.map((el) => ({ key: keyOf(el), kind: el.tagName.toLowerCase() + '.' + cls1(el), sel: el.classList.contains('on') || el.classList.contains('sel') || el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true', label: label(el), s: styleOf(el) }));
    return { off, cut, overlap, small, styles, pageOver: document.scrollingElement.scrollWidth - W };
  };
  const mark = (el) => { const r = el.getBoundingClientRect(); const d = document.createElement('div'); d.id = '__caMark'; d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:3px solid #ff2d55;box-shadow:0 0 0 2px #fff;border-radius:4px;left:' + (r.left - 3) + 'px;top:' + (r.top - 3) + 'px;width:' + (r.width) + 'px;height:' + (r.height) + 'px'; document.body.appendChild(d); };
  const unmark = () => document.getElementById('__caMark')?.remove();
  return { list, find, sig, watch, audit, mark, unmark, label, keyOf };
})();`;

// ---- 한 번 누르기 ------------------------------------------------------------------------------------------------
// 새 페이지 → 시작 상태 → path(앞서 누른 것들)를 다시 누름 → target 을 누르고 기록
async function pressStep(page, step, touch, scope = opt.scope) {
  const info = await page.evaluate(([k, n, sc]) => { const el = window.__ca.find(k, n, sc); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }); const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled, pe: s.pointerEvents }; }, [step.key, step.nth, scope]);
  if (!info) return { ok: false, why: '못 찾음' };
  const h = await page.evaluate(([k, n, sc]) => { const el = window.__ca.find(k, n, sc); const r = el.getBoundingClientRect(); const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2); const top = document.elementFromPoint(x, y); return { x, y, ok: !!top && (top === el || el.contains(top) || (el.tagName === 'INPUT' && top.closest('label')?.contains(el))), top: top ? top.tagName.toLowerCase() + '.' + [...top.classList].slice(0, 2).join('.') + (top.dataset?.action ? '[' + top.dataset.action + ']' : '') : '' }; }, [step.key, step.nth, scope]);
  if (!h.ok) return { ok: false, why: `가려짐(위에 ${h.top})`, x: h.x, y: h.y };
  if (touch) await page.touchscreen.tap(h.x, h.y); else await page.mouse.click(h.x, h.y);
  return { ok: true, x: h.x, y: h.y };
}


// 화면이 0.4초 동안 안 바뀔 때까지 기다린다(최대 4초). 임무 고르기처럼 효과 1.5초 뒤 다음 화면으로 넘어가는 것을 앞 단계로 다시 누를 때 필요
async function quiet(page, still = 300, max = 2500) {
  await page.evaluate(() => { if (window.__caQuiet) return; window.__caQuiet = { t: performance.now() }; new MutationObserver(() => { window.__caQuiet.t = performance.now(); }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
  await page.evaluate(() => { window.__caQuiet.t = performance.now(); });
  const t0 = Date.now();
  await sleep(150);
  while (Date.now() - t0 < max) { const idle = await page.evaluate(() => { const anim = document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity); return anim ? 0 : performance.now() - window.__caQuiet.t; }); if (idle >= still) return; await sleep(100); }
}

async function prepPage(browser, vp, base, path) {
  const { page, errors } = await openFrom(browser, vp, base);
  await page.addScriptTag({ content: PAGE_LIB });
  const touch = !!VIEWPORTS[vp].touch;
  for (const [i, st] of path.entries()) {
    // --from 길은 --only-scope 밖에 있어도 찾는다 (지도 탭을 눌러 들어간 뒤 지도 안만 누르기 등)
    const r = await pressStep(page, st, touch, i < opt.from.length && st.key === opt.from[i].key ? '' : opt.scope);
    if (!r.ok) return { page, errors, fail: `앞 단계 「${st.key}」 ${r.why}` };
    await quiet(page);
  }
  return { page, errors };
}

const fname = (s) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);

async function clickJob(browser, vp, startKind, base, job, idx) {
  const rec = { vp, start: startKind, path: job.path.map((p) => p.key + (p.nth ? '#' + p.nth : '')), key: job.key, nth: job.nth, label: job.label, action: job.action, value: job.value, flags: [] };
  // 띄우기가 (부하로) 실패하면 한 번 더. 그래도 안 되면 기록만 하고 넘어간다 (한 건 때문에 전체가 멈추지 않게)
  let prep = null;
  for (let tries = 0; tries < 2 && !prep; tries++) { try { prep = await prepPage(browser, vp, base, job.path); } catch (e) { rec.note = '띄우기 실패: ' + String(e?.message || e).trim().slice(0, 200); } }
  if (!prep) { rec.flags.push('도구 오류'); return rec; }
  const { page, errors, fail } = prep;
  try {
    if (fail) { rec.flags.push('재현 실패'); rec.note = fail; return rec; }
    const touch = !!VIEWPORTS[vp].touch;
    const before = await page.evaluate((sc) => window.__ca.sig(sc), opt.scope);
    const store0 = await page.evaluate(() => ({ setChat: window.__calls.setChat.length, setStore: (window.__calls.setStore || []).length, llm: (window.__calls.llm || []).length, send: (window.__calls.send || []).length, hide: window.__calls.hide }));
    const tag = `${vp}_${String(idx).padStart(4, '0')}_${fname(job.key)}`;
    const ok = await page.evaluate(([k, n, sc]) => { const el = window.__ca.find(k, n, sc); if (!el) return false; el.scrollIntoView({ block: 'center', behavior: 'instant' }); window.__ca.mark(el); return true; }, [job.key, job.nth, opt.scope]);
    if (!ok) { rec.flags.push('못 찾음'); return rec; }
    await page.screenshot({ path: `${SHOTS}/${tag}_1앞.png` });
    await page.evaluate(() => window.__ca.unmark());
    rec.box = await page.evaluate(([k, n, sc]) => window.__ca.watch(window.__ca.find(k, n, sc), n), [job.key, job.nth, opt.scope]);
    const nErr = errors.length;
    const pr = await pressStep(page, job, touch);
    if (!pr.ok) { rec.flags.push(pr.why.startsWith('가려짐') ? '가려져 못 누름' : pr.why); rec.note = pr.why; await page.evaluate(() => window.__caWatch?.stop()); return rec; }
    await sleep(140);
    await page.screenshot({ path: `${SHOTS}/${tag}_2직후.png` });
    await sleep(900);
    await page.screenshot({ path: `${SHOTS}/${tag}_3뒤.png` });
    rec.shots = [`${tag}_1앞.png`, `${tag}_2직후.png`, `${tag}_3뒤.png`];
    // 1초 뒤에도 화면이 움직이면(효과·닫힘 애니메이션) 0.5초 동안 멈출 때까지(최대 5초) 기다려 「끝」을 한 장 더 찍는다
    const still = async () => page.evaluate(() => { const r = window.__caWatch.rec; const anim = document.getAnimations().some((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity); return anim ? 1e9 : (r.lastMut ?? 0); });
    let moved = false;
    for (let t = 1040; t < 3000; t += 200) { const lm = await still(); if (lm < t - 500) break; moved = true; await sleep(250); }
    if (moved) { await page.screenshot({ path: `${SHOTS}/${tag}_4끝.png` }); rec.shots.push(`${tag}_4끝.png`); }
    const w = await page.evaluate(() => window.__caWatch.stop());
    const after = await page.evaluate((sc) => window.__ca.sig(sc), opt.scope);
    const store1 = await page.evaluate(() => ({ setChat: window.__calls.setChat.length, setStore: (window.__calls.setStore || []).length, llm: (window.__calls.llm || []).length, send: (window.__calls.send || []).length, hide: window.__calls.hide }));
    rec.watch = w;
    rec.errors = errors.slice(nErr);
    const bk = new Set(before.keys), ak = new Set(after.keys);
    rec.appeared = [...ak].filter((k) => !bk.has(k));
    rec.vanished = [...bk].filter((k) => !ak.has(k));
    rec.saved = { chat: store1.setChat - store0.setChat, store: store1.setStore - store0.setStore, model: store1.llm - store0.llm, send: store1.send - store0.send };
    rec.win = { before: { gx: before.gx, gw: before.gw }, after: { gx: after.gx, gw: after.gw } };
    rec.before = { gx: before.gx, gw: before.gw, html: before.html }; rec.after = { gx: after.gx, gw: after.gw, html: after.html };
    rec.flags.push(...flagsOf(rec));
    rec.selStyle = w.after?.style || null;
    rec.selChanged = w.after && (w.after.elCls !== w.before.elCls || w.after.aria !== w.before.aria) ? { from: [w.before.elCls, w.before.aria], to: [w.after.elCls, w.after.aria] } : null;
    // 새로 열린 화면이면 그 안을 따라 들어간다
    rec.audit = rec.appeared.length ? await page.evaluate((sc) => window.__ca.audit(sc), opt.scope) : null;
    rec.newList = rec.appeared.length ? await page.evaluate((sc) => window.__ca.list(sc), opt.scope) : null;
  } catch (e) {
    rec.flags.push('도구 오류'); rec.note = String(e?.message || e).slice(0, 300);
  } finally {
    await page.close().catch(() => {});
  }
  return rec;
}


// 이상 반응 표시 (판단 아님, 점검하는 Claude가 캡처로 확인할 곳). --report-only 때도 기록(watch)으로 다시 계산한다
function flagsOf(rec) {
  const f = [], w = rec.watch; if (!w) return f;
  const label = rec.label || '';
  if (rec.errors?.length) f.push('오류');
  const closeish = /(^|-)(close|x|cancel|back|no|hide|skip|drop|del|delete|keep)(-|$)|^close$|^game-close$/.test(rec.action || '') || /닫기|취소|뒤로|접기|×|✕/.test(label);
  const s = rec.saved || {};
  const changed = rec.appeared?.length || rec.vanished?.length || rec.before?.html !== rec.after?.html || w.mutations > 0 || s.chat || s.store || s.model || s.send;
  if (!changed) f.push('반응 없음');
  const moved = (rec.appeared?.length ?? 0) > 0; // 다른 화면으로 넘어감
  if (rec.before?.gx && !rec.after?.gx && !closeish) f.push('상황판 창이 닫힘');
  else if (rec.before?.gw && !rec.after?.gw && !closeish) f.push('설정 창이 닫힘');
  else if (w.boxGone != null && !closeish && !moved) f.push(`누르자 창이 닫힘(${w.boxGone}ms)`);
  else if (w.elGone != null && w.elGone < 400 && !closeish && !moved) f.push(`누른 것이 바로 사라짐(${w.elGone}ms)`);
  // 누른 것에 표시(선택·효과)가 붙었는데 그것이 보일 틈 없이(0.3초 안에) 사라지거나 창이 닫힘 — 2026-11-08 임무 고르기·해제 문제의 꼴
  if (w.elClass?.length) {
    const firstFx = w.elClass[0][0];
    // 값만 바뀌어 같은 동작 단추로 다시 그려진 것(켬↔끔 등)은 사라진 게 아니다
    const redrawn = w.boxGone == null && (rec.appeared || []).some((k) => k.split('|')[0] === rec.action);
    const goneAt = redrawn ? Infinity : Math.min(w.elGone ?? Infinity, w.boxGone ?? Infinity);
    if (goneAt !== Infinity && goneAt - firstFx < 300) f.push(`효과가 보일 틈 없이 사라짐(효과 ${firstFx}ms → 사라짐 ${goneAt}ms)`);
    const last = w.elClass.at(-1);
    if (w.after && w.after.elCls === w.before.elCls && w.after.aria === w.before.aria && w.elClass.length >= 2) f.push(`표시가 잠깐 바뀌었다 돌아감(${firstFx}~${last[0]}ms)`);
  }
  return f;
}

// ---- 돌리기 ------------------------------------------------------------------------------------------------------
const results = [];
// 이어 돌리기: 지난 기록을 읽어 둔다 (같은 판만)
const PRIOR = { results: [], states: [] };
const RESUMED = [];
const RESUMED_KEYS = new Set();
// 판이 달라도: 지난 판 → 지금 판 사이에 바뀐 소스에 걸린 단추(동작 이름)·모양(class)만 다시 누른다 (11-09 사용자: 쪼금 고쳤는데 매번 여섯 시간 돌릴래?)
const HEADREF = () => opt.head || 'HEAD';
const STALE = { actions: new Set(), classes: new Set(), names: new Set(), linked: new Set(), cache: {}, files: [] };
function staleSince(c0) {
  const files = git(`diff --name-only ${c0} ${HEADREF()} -- src`).split('\n').filter(Boolean);
  STALE.files.push(...files);
  for (const f of files) {
    // 바뀐 줄 앞뒤 40줄 안의 data-action·case 이름, 바뀐 CSS 줄의 class 이름
    const d = git(`diff -U40 ${c0} ${HEADREF()} -- "${f}"`);
    for (const m of d.matchAll(/data-action=\\?"([\w-]+)"|case '([\w-]+)'|action === '([\w-]+)'|run\('([\w-]+)'/g)) STALE.actions.add(m[1] || m[2] || m[3] || m[4]);
    // 연계: 바뀐 함수·값 이름(diff 머리줄의 함수 이름, 바뀐 줄의 선언)을 다른 파일에서 쓰는 곳을 찾아, 그 곳 앞뒤 40줄의 단추도 다시
    for (const m of d.matchAll(/^@@[^@]*@@.*?\b(?:function|const|let|class)\s+([A-Za-z_]\w{3,})/gm)) STALE.names.add(m[1]);
    for (const m of d.matchAll(/^[+-]\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_]\w{3,})/gm)) STALE.names.add(m[1]);
    if (/\.css$/.test(f)) for (const line of git(`diff -U0 ${c0} ${HEADREF()} -- "${f}"`).split('\n')) if (/^[+-][^+-]/.test(line)) for (const m of line.matchAll(/\.([a-z][\w-]+)/g)) STALE.classes.add(m[1]);
  }
}
// 연계된 곳: 바뀐 이름을 쓰는 소스 줄 앞뒤 40줄의 단추 동작 (한 겹)
function staleLinked() {
  for (const name of STALE.names) {
    if (name.length < 6) continue; // keep·saved 같은 흔한 이름은 엉뚱한 곳까지 끌고 온다
    const hits = git(`grep -n -w "${name}" ${HEADREF()} -- src`).split('\n').filter(Boolean);
    if (hits.length > 25) continue;
    for (const hit of hits) {
      const [, file, ln] = hit.match(/^[^:]+:([^:]+):(\d+):/) || [];
      if (!file || STALE.files.includes(file)) continue;
      const lines = (STALE.cache[file] ||= git(`show ${HEADREF()}:${file}`).split('\n'));
      const chunk = lines.slice(Math.max(0, +ln - 41), +ln + 40).join('\n');
      for (const m of chunk.matchAll(/data-action=\\?"([\w-]+)"|case '([\w-]+)'|action === '([\w-]+)'|run\('([\w-]+)'/g)) STALE.linked.add(m[1] || m[2] || m[3] || m[4]);
    }
  }
  for (const a of STALE.linked) STALE.actions.add(a);
}
// 지난 결과가 바뀐 곳에 닿나: 누른 단추 동작·class 가 바뀐 목록에 있거나, 눌러서 연 화면에 바뀐 단추·class 가 있으면 다시
// 거의 모든 화면에 보이는 단추(왼쪽 메뉴·닫기 등)는 그 단추만 다시 누르고, 그것 때문에 화면 전체를 다시 들어가진 않는다
const UBIQ = new Set();
const touched = (r) => STALE.actions.has(r.action) || (r.newList || []).some((x) => (STALE.actions.has(x.action) && !UBIQ.has(x.action)) || (STALE.classes.has(x.cls) && !UBIQ.has('.' + x.cls)));
for (const dir of opt.resume || []) {
  const d = resolve(ROOT, dir);
  const j = JSON.parse(readFileSync(resolve(d, 'report.json'), 'utf8'));
  const c0 = String(j.version?.commit || '').split('·')[0], c1 = opt.head || String(VERSION.commit).split('·')[0];
  if (!c0) throw new Error(`--resume ${dir}: 지난 기록에 판(커밋)이 없어요`);
  if (c0 !== c1) {
    if (!git(`cat-file -t ${c0}`)) throw new Error(`--resume ${dir}: 지난 판 ${c0} 을 이 저장소에서 못 찾아요 (git fetch)`);
    staleSince(c0); staleLinked();
    log(`판이 바뀜 ${c0} → ${c1}: 바뀐 소스 ${STALE.files.length}개, 다시 누를 동작 ${STALE.actions.size}개(연계 ${STALE.linked.size}개 포함)·모양 ${STALE.classes.size}개`);
  }
  const abs = (n) => (n ? resolve(d, 'shots', n) : n);
  { const cnt = {}, withList = j.results.filter((r) => r.newList); for (const r of withList) for (const a of new Set([...r.newList.map((x) => x.action).filter(Boolean), ...r.newList.map((x) => '.' + x.cls)])) cnt[a] = (cnt[a] || 0) + 1; for (const [a, n] of Object.entries(cnt)) if (n > withList.length * 0.2) UBIQ.add(a); }
  const dropped = new Set();
  for (const r of j.results) {
    if (c0 === c1 || !touched(r)) PRIOR.results.push({ ...r, shots: r.shots?.map(abs), prior: dir, priorCommit: c0 });
    else { dropped.add(`${r.vp}|${r.start}|${[...r.path, r.key].join('>')}`); RESUMED_KEYS.add(`${r.vp}|${r.key}`); }
  }
  // 다시 누를 단추가 연 화면의 옛 잰 값은 버린다 (새로 잰 것이 들어간다)
  for (const st of j.states) if (!dropped.has(`${st.vp}|${st.start}|${st.path.join('>')}`)) PRIOR.states.push({ ...st, shot: abs(st.shot), priorCommit: c0 });
  if (c0 !== c1) RESUMED.push(`${dir}(${c0}) 에서 바뀐 곳 ${dropped.size}개만 다시`);
  else RESUMED.push(`${dir}(같은 판) 에서 이어서`);
}
if (opt.resume) log(`이어 돌리기: 지난 기록 ${PRIOR.results.length}개 (${opt.resume.join(', ')})`);
if (opt.plan) { log('다시 누를 동작:', [...STALE.actions].sort().join(' ')); log('연계로 더한 것:', [...STALE.linked].sort().join(' ')); log('다시 볼 모양(class):', [...STALE.classes].sort().join(' ')); log('바뀐 이름:', [...STALE.names].slice(0, 40).join(' ')); log(`지난 결과 중 그대로 쓰는 것 ${PRIOR.results.length}개 · 다시 누를 단추 약 ${RESUMED_KEYS.size}개`); process.exit(0); }
const skippedVals = {};
const states = []; // { vp, start, path, shot, audit }
const t0 = Date.now();
if (opt.reportOnly) { const j = JSON.parse(readFileSync(resolve(OUT, 'report.json'), 'utf8')); for (const r of j.results) if (r.watch) r.flags = [...r.flags.filter((x) => /재현 실패|못 찾음|가려져|꺼진|안 눌림|도구 오류/.test(x)), ...flagsOf(r)];
  results.push(...j.results); states.push(...j.states); opt.vp = j.opt.vp; opt.start = j.opt.start; opt.depth = j.opt.depth; if (j.version) VERSION = j.version; if (j.minutes != null) opt.minutes = j.minutes; }
const browser = opt.reportOnly ? null : await launch();
for (const vp of opt.reportOnly ? [] : opt.vp) {
  // 누른 열쇠는 화면 크기마다 하나로 센다: 시작 화면에서 출발해 상황판에 들어가도 이미 누른 것은 다시 안 누른다
  const done = new Set();
  const perAct = {};
  const offSeen = new Set();
  const exploredVals = {};
  const exploredSigs = new Set(); // 이미 들어가 본 화면 꼴 (보이는 동작 이름 묶음)
  const sigOf = (list) => [...new Set(list.filter((x) => !x.behind).map((x) => x.action || x.tag + '.' + x.cls))].sort().join(' ');
  // 이어 돌리기: 지난 기록에서 누른 단추·들어가 본 화면은 건너뛴다 (도구 오류·재현 실패·못 찾음은 다시 누른다)
  const prior = PRIOR.results.filter((r) => r.vp === vp);
  for (const r of prior) {
    if (r.disabled) { offSeen.add(r.key); continue; }
    if (r.revisit || r.flags?.some((f) => /도구 오류|재현 실패|못 찾음|안 눌림/.test(f))) continue;
    if (!done.has(r.key)) { done.add(r.key); if (r.action) perAct[r.action] = (perAct[r.action] || 0) + 1; }
    if (r.newList) exploredSigs.add(sigOf(r.newList));
  }
  for (const startKind of opt.start) {
    const revisitSigs = new Set();
    // 메뉴 다시 들어가기는 처음 돌 때 한 번이면 된다. 이어 돌릴 때 또 하면 이미 본 화면을 메뉴마다 다시 돌며 몇백 번 헛누른다 (11-09)
    // 지난번 다시 들어가 본 화면의 안 누른 단추는 아래 「지난번에 들어가 본 화면」에서 그 길로 이어 누른다
    const rv = startKind !== opt.start[0] && !prior.some((r) => r.start === startKind);
    log(`${vp} · ${startKind} 시작 상태 만드는 중`);
    const base = await makeBase(browser, vp, startKind);
    // 첫 화면
    const { page, fail: fromFail } = await prepPage(browser, vp, base, opt.from);
    if (fromFail) throw new Error(`--from 재현 실패: ${fromFail}`);
    // --probe <파일.mjs>: --from 화면에서 그 파일의 default(page, { vp, shots, log }) 를 돌리고 결과를 probe-<vp>.json 에 남긴 뒤 이 화면 누르기는 건너뛴다 (지도 확대·축소처럼 정해진 순서로 재야 할 때)
    if (opt.probe) { const mod = await import(pathToFileURL(resolve(ROOT, opt.probe)).href); const out = await mod.default(page, { vp, shots: SHOTS, log }); writeFileSync(resolve(OUT, `probe-${vp}.json`), JSON.stringify(out, null, 1)); log(`--probe ${vp}: probe-${vp}.json`); await page.close(); continue; }
    const first = await page.evaluate((sc) => window.__ca.list(sc), opt.scope);
    if (process.env.CA_MUT) log('저절로 바뀌는 곳', JSON.stringify(await page.evaluate(() => new Promise((res) => { const c = {}; const mo = new MutationObserver((ms) => { for (const m of ms) { const t = m.target.nodeType === 1 ? m.target : m.target.parentElement; const k = (t?.tagName || '').toLowerCase() + '.' + [...(t?.classList || [])].slice(0, 2).join('.') + ' ' + m.type + (m.attributeName ? ':' + m.attributeName : ''); c[k] = (c[k] || 0) + 1; } }); mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); setTimeout(() => { mo.disconnect(); res(c); }, 3000); }))));
    const audit0 = await page.evaluate((sc) => window.__ca.audit(sc), opt.scope);
    const s0 = `${vp}_${startKind}_화면0.png`;
    await page.screenshot({ path: `${SHOTS}/${s0}`, fullPage: false });
    await page.close();
    states.push({ vp, start: startKind, path: opt.from.map((p) => p.key), shot: s0, audit: audit0 });
    const queue = [];
    // 두 번째 시작 상태부터: 첫 화면의 메뉴 단추는 이미 눌렀어도 다시 눌러 들어간다 (물건 든 소지품·글 있는 괴담넷처럼
    // 한 번 들어가야 달라지는 화면을 보려고. 들어간 화면 꼴이 이미 본 것이면 거기서 멈춘다)
    const NAV = /^(nav-tab|tab|cdr|br-site|br-go|br-tab|ed-open|prefs-open|rec-sub|items-sub|ph-sub)$/;
    const NOCAP = /^(ed-node|ed-tab|nav-tab|tab|rec-sub|items-sub|ph-sub|br-go|br-site|wiki-tab|gn-sub|mall-page)$/;
    const enqueue = (path, list, revisit = false) => {
      for (const it of list) {
        if (done.has(it.key) && !(revisit && NAV.test(it.action || ''))) continue;
        if (done.has(it.key)) { queue.push({ ...it, path, revisit: true }); continue; }
        if (it.behind) continue; // 다른 창 뒤: 그 창을 닫은 화면에서 누른다
        // 꺼진 단추는 기록만 하고 누른 것으로 치지 않는다 (다른 화면에서 켜지면 그때 누른다)
        if (it.disabled) { if (!offSeen.has(it.key)) { offSeen.add(it.key); results.push({ vp, start: startKind, path: path.map((p) => p.key), key: it.key, label: it.label, action: it.action, value: it.value, flags: ['꺼진 단추(누를 수 없음)'], disabled: true }); } continue; }
        // 화면을 옮기는 단추(설정 왼쪽 목록·탭)는 값마다 다른 화면이라 상한 없이 다 누른다
        if (opt.perAction && it.action && !NOCAP.test(it.action)) { perAct[it.action] = (perAct[it.action] || 0) + 1; if (perAct[it.action] > opt.perAction) { skippedVals[it.action] = (skippedVals[it.action] || 0) + 1; continue; } }
        done.add(it.key);
        queue.push({ ...it, path });
      }
    };
    enqueue(opt.from, first, rv);
    // 이어 돌리기: 지난번에 들어가 본 화면들에서 아직 안 누른 것만 이어서 누른다
    for (const r of prior) if (r.start === startKind && r.newList && r.path.length + 1 < opt.depth) enqueue([...r.path.map((key) => ({ key, nth: 0 })), { key: r.key, nth: r.nth ?? 0 }], r.newList);
    let n = 0;
    while (queue.length) {
      const batch = queue.splice(0, opt.workers);
      const recs = await Promise.all(batch.map((job, i) => clickJob(browser, vp, startKind, base, job, results.length + i + 1)));
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i], job = batch[i];
        if (job.revisit) rec.revisit = true;
        results.push(rec);
        n++;
        const ev = job.action ? (exploredVals[job.action] = (exploredVals[job.action] || 0) + 1) : 1;
        // 새로 열린 화면의 꼴(보이는 동작 이름 묶음, 값 빼고)이 이미 들어가 본 것이면 다시 안 들어간다:
        // 지역 250곳·위키 항목처럼 값만 다른 같은 화면은 한 번만, 설정 페이지처럼 생김새가 다른 화면은 다 들어간다
        const sigKey = rec.newList ? [...new Set(rec.newList.filter((x) => !x.behind).map((x) => x.action || x.tag + '.' + x.cls))].sort().join(' ') : '';
        const seenSig = sigKey && exploredSigs.has(sigKey);
        if (rec.newList && !seenSig && job.path.length + 1 < opt.depth && (!opt.exploreValues || ev <= opt.exploreValues)) {
          exploredSigs.add(sigKey);
          const step = { key: job.key, nth: job.nth };
          const path = [...job.path, step];
          states.push({ vp, start: startKind, path: path.map((p) => p.key), shot: rec.shots?.[2], audit: rec.audit });
          enqueue(path, rec.newList, rv); // 뒤 시작 상태에서는 들어간 화면에서도 메뉴 단추를 다시 눌러 더 들어간다
        } else if (rec.newList && seenSig && job.revisit && job.path.length + 1 < opt.depth && !revisitSigs.has(sigKey)) {
          // 뒤 시작 상태: 이미 본 꼴의 화면이라도 메뉴 단추만은 한 번 더 따라간다 (인터넷 새 탭 → 괴담넷 글 목록처럼 한 겹 더 들어가야 달라지는 곳)
          revisitSigs.add(sigKey);
          enqueue([...job.path, { key: job.key, nth: job.nth }], rec.newList.filter((x) => NAV.test(x.action || '')), true);
        }
        if (rec.flags.length) log(`  ${vp} ${rec.key} → ${rec.flags.join(', ')}`);
      }
      log(`${vp} · ${startKind}: ${n}번 누름, 남은 ${queue.length} (${Math.round((Date.now() - t0) / 1000)}초)`);
      if (opt.maxClicks && n >= opt.maxClicks) { log(`--max-clicks ${opt.maxClicks} 에서 멈춤, 남은 ${queue.length}개는 「안 눌림」`); for (const q of queue) results.push({ vp, start: startKind, path: q.path.map((p) => p.key), key: q.key, label: q.label, action: q.action, value: q.value, flags: ['안 눌림(상한)'] }); queue.length = 0; }
      writeFileSync(resolve(OUT, 'report.json'), JSON.stringify({ version: VERSION, opt, results, states, skippedVals }, null, 1)); // 끊겨도 이어 돌리기가 판을 확인하게
    }
  }
}
await browser?.close();
if (PRIOR.results.length) { results.unshift(...PRIOR.results); states.unshift(...PRIOR.states); }

// ---- 통일성 ------------------------------------------------------------------------------------------------------
// 같은 종류(태그.첫클래스) 끼리 크기·글씨·색·테두리·모서리·안쪽 여백이 몇 가지로 갈리는지. 선택된 것과 아닌 것은 따로 본다.
const PROPS = ['h', 'font', 'weight', 'family', 'color', 'bg', 'border', 'radius', 'pad', 'lh'];
const groups = {};
for (const st of states) for (const s of st.audit?.styles || []) {
  const g = (groups[`${st.vp}|${s.kind}|${s.sel ? '선택됨' : '보통'}`] ||= { n: 0, props: {} });
  // 같은 단추가 여러 화면에 나와도 한 번으로 센다 (어느 화면에서 처음 봤는지만 붙인다)
  (g.keys ||= new Set()).add(s.key);
  for (const p of PROPS) { const v = s.s[p]; const m = ((g.props[p] ||= {})[v] ||= new Map()); if (!m.has(s.key)) m.set(s.key, st.path.at(-1) || st.start); }
}
const incons = [];
for (const [k, g] of Object.entries(groups)) {
  const diff = Object.entries(g.props).filter(([, vs]) => Object.keys(vs).length > 1);
  if (diff.length) incons.push({ group: k, n: g.keys.size, diff: diff.map(([p, vs]) => ({ prop: p, values: Object.entries(vs).map(([v, m]) => ({ v, n: m.size, ex: [...m].slice(0, 4).map(([key, at]) => `${key} @${at}`) })).sort((a, b) => b.n - a.n) })) });
}
// 선택 표시: 눌렀을 때 선택 상태가 생긴 것들의 모양을 모은다 (테두리·바탕·그림자·외곽선)
const selLooks = {};
for (const r of results) if (r.selChanged && r.selStyle) { const s = r.selStyle; const look = `테두리 ${s.border} · 바탕 ${s.bg} · 그림자 ${s.shadow} · 외곽선 ${s.outline}`; (selLooks[`${r.vp}|${look}`] ||= []).push(r.key); }
// 이름: 같은 data-action 인데 글자가 다른 것 / 같은 글자인데 data-action 이 다른 것
const byAct = {}, byLabel = {};
// 같은 단추(동작+값)인데 글자가 다른 것만: 값마다 글자가 다른 것(탭 이름 등)은 당연하므로 뺀다
for (const r of results) { if (r.action && r.label) (byAct[r.key.replace(/#\d+$/, '')] ||= new Set()).add(r.label.replace(/\s+/g, ' ').trim().slice(0, 40)); if (r.label && r.action) (byLabel[r.label] ||= new Set()).add(r.action); }
// PC·폰 차이: 한쪽에서만 보인 열쇠
const keysBy = {}; for (const r of results) (keysBy[r.vp] ||= new Set()).add(r.key);

// 코드에 있는 data-action 전부(글자 그대로 적힌 것) → 한 번도 못 누른 것
const srcActs = new Set();
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|js)$/.test(f)) for (const m of readFileSync(p, 'utf8').matchAll(/data-action="([a-zA-Z0-9_:-]+)"/g)) srcActs.add(m[1]); } };
walk(resolve(ROOT, 'src'));
const pressedActs = {}; for (const r of results) if (r.action && r.shots) (pressedActs[r.action] ||= new Set()).add(r.vp);
const never = [...srcActs].filter((a) => !pressedActs[a]).sort();

// ---- 보고서 ------------------------------------------------------------------------------------------------------
const L = [];
const rel = (p) => relative(OUT, resolve(SHOTS, p));
L.push(`# 눌러 보기 전수점검 기록`, '', `- **판: ${VERSION.branch} ${VERSION.commit}${VERSION.card ? ' · v' + VERSION.card : ''}${VERSION.dirty ? ` · 커밋 안 한 src 파일 ${VERSION.dirty}개` : ''}${VERSION.distOld ? ' · ⚠ 빌드가 소스보다 옛것' : ''}** — 이 판 기준 결과다. 그 뒤 바뀐 코드는 다시 돌려야 한다.`, ...(RESUMED.length ? [`- 이어 돌림: ${RESUMED.join(' · ')}${STALE.files.length ? ` · 바뀐 소스: ${STALE.files.slice(0, 12).join(', ')}${STALE.files.length > 12 ? ' 외' : ''}` : ''}`] : []), `- 만든 때: ${new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16)} KST · 걸린 시간 ${opt.minutes ?? Math.round((Date.now() - t0) / 60000)}분`, `- 화면 크기: ${opt.vp.join(', ')} · 시작: ${opt.start.join(', ')} · 깊이 ${opt.depth}`, `- 누른 수: ${results.filter((r) => r.shots).length} · 화면 수: ${states.length}`, '');
L.push('이 기록은 사실만 적는다. 이상한지·사용자 결정과 맞는지는 점검하는 Claude가 캡처를 열어 보고 판단한다 (docs/눌러보기_전수점검.md).', '');
L.push('## 1. 이상 반응 (캡처 확인할 곳)', '');
const flagged = results.filter((r) => r.flags.length && !r.disabled && !r.revisit); // 다시 들어가려고 누른 메뉴는 앞에서 이미 적었다
const byFlag = {};
for (const r of flagged) for (const f of r.flags) (byFlag[f.replace(/\((효과 )?\d+(~\d+)?ms( → 사라짐 \d+ms)?\)/, '')] ||= []).push(r);
for (const [f, rs] of Object.entries(byFlag)) {
  L.push(`### ${f} (${rs.length})`, '');
  for (const r of rs) L.push(`- [${r.vp}] \`${r.key}\` 「${r.label}」 · 길: ${r.path.length ? r.path.join(' → ') : r.start}${r.flags.length > 1 ? ' · 함께: ' + r.flags.filter((x) => !x.startsWith(f)).join(', ') : ''}${r.errors?.length ? '\n  - 오류: ' + r.errors.slice(0, 3).join(' / ').slice(0, 300) : ''}${r.note ? '\n  - ' + r.note : ''}${r.shots ? '\n  - 캡처: ' + r.shots.map(rel).join(' · ') : ''}`);
  L.push('');
}
L.push('## 2. 선택 표시 모양 (눌러서 선택 상태가 생긴 것)', '');
for (const [k, ks] of Object.entries(selLooks)) L.push(`- [${k.split('|')[0]}] ${k.split('|')[1]} — ${[...new Set(ks)].slice(0, 12).join(', ')}${ks.length > 12 ? ` 외 ${ks.length - 12}` : ''}`);
L.push('', '## 3. 통일성: 같은 종류인데 모양이 갈리는 것', '');
for (const g of incons.sort((a, b) => b.n - a.n)) {
  L.push(`### ${g.group.replace(/\|/g, ' · ')} (${g.n}개)`);
  for (const d of g.diff) L.push(`- ${d.prop}: ` + d.values.map((v) => `**${v.v}** ×${v.n} (${v.ex.join(', ')})`).join(' / '));
  L.push('');
}
L.push('## 4. 이름', '');
for (const [a, ls] of Object.entries(byAct)) if (ls.size > 1 && ls.size < 6) L.push(`- 같은 단추 다른 글자: \`${a}\` → ${[...ls].map((x) => `「${x}」`).join(' ')}`);
for (const [l, as] of Object.entries(byLabel)) if (as.size > 1) L.push(`- 같은 글자 다른 동작: 「${l}」 → ${[...as].map((x) => `\`${x}\``).join(' ')}`);
L.push('', '## 5. 화면마다 잰 것', '');
for (const st of states) {
  const a = st.audit; if (!a) continue;
  const bad = a.off.length || a.cut.length || a.overlap.length || a.pageOver > 0;
  if (!bad) continue;
  L.push(`### [${st.vp}] ${st.path.length ? st.path.join(' → ') : st.start}${st.shot ? ` (${rel(st.shot)})` : ''}`);
  if (a.pageOver > 0) L.push(`- 페이지 가로 넘침 ${a.pageOver}px`);
  for (const o of a.off.slice(0, 8)) L.push(`- 화면 밖: ${o}`);
  for (const c of a.cut.slice(0, 10)) L.push(`- 글자 잘림${c.ellipsis ? '(말줄임)' : ''}: 「${c.text}」 ${c.path} ${c.sw}>${c.cw} / ${c.sh}>${c.ch}`);
  for (const o of a.overlap.slice(0, 10)) L.push(`- 겹침: \`${o[0]}\` ↔ \`${o[1]}\` ${o[2]}`);
  L.push('');
}
L.push('## 6. 작은 누름 칸 (32px 미만, 폰)', '');
const smalls = {}; for (const st of states) if (isPhoneVp(st.vp)) for (const [k, s] of st.audit?.small || []) smalls[k] = s;
L.push(Object.entries(smalls).map(([k, s]) => `\`${k}\` ${s}`).join(' · ') || '없음', '');
L.push('## 7. 못 누른 것', '');
L.push(`- 코드에 있는 data-action ${srcActs.size}개 중 한 번도 못 누른 것 ${never.length}개 (이 시작 상태에서 화면에 안 나온 것. 다른 시작 상태·자료가 필요하면 docs 에 적힌 대로 시작 상태를 더한다):`, '', never.map((a) => `\`${a}\``).join(' '), '');
if (Object.keys(skippedVals).length) L.push(`- 같은 단추의 다른 값이라 안 누른 수 (--per-action ${opt.perAction}): ${Object.entries(skippedVals).sort((a, b) => b[1] - a[1]).map(([a, n]) => `\`${a}\` ${n}`).join(' · ')}`, '');
for (const vp of opt.vp) for (const other of opt.vp) if (vp !== other) { const only = [...(keysBy[vp] || [])].filter((k) => !keysBy[other]?.has(k)); if (only.length) L.push(`- ${vp}에만 있고 ${other}에는 없는 것 ${only.length}개: ${only.slice(0, 40).map((x) => `\`${x}\``).join(' ')}${only.length > 40 ? ' …' : ''}`); }
writeFileSync(resolve(OUT, 'report.md'), L.join('\n') + '\n');
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify({ version: VERSION, minutes: opt.minutes ?? Math.round((Date.now() - t0) / 60000), opt, results, states, incons, selLooks: Object.fromEntries(Object.entries(selLooks)), never }, null, 1));
log(`끝: 누른 수 ${results.filter((r) => r.shots).length}, 이상 반응 ${flagged.length}, 못 누른 data-action ${never.length} · ${relative(ROOT, OUT)}/report.md`);
