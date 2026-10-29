// QC 게임 ① 플러그인 창에서 게임 열기 (src/ui/game.ts · host/game/*). 가짜 Risu(tests/qc-game-host.mjs)에 진행 중인 채팅을 심고
//  팩 없음 → 받기 실패 → 받기 → 팩 옛 판 → 코드 옛 판 → 판 불일치 파일 넣기 → 열기/닫기 반복 누수(AudioContext·rAF·리스너·blob) →
//  저장 칸(깨진 본문·schema 다름·용량) → 다리(visit·field·wallet·$hq_ui) → 본편 요청에 끼는 막간(자동 전송 없음) → 숨기기/다시 붙이기 → 전체 화면·Esc.
// 사용: npm run build && node tests/qc-game-plugin-browser.mjs <fixture.json> [사진 폴더]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium, waitSel, boot, openPanel, openField, enterGame, enterHub, loadFixture, startedChat, startWorldChat, gameFiles, serveGame, VERSION } from './qc-game-host.mjs';

const { fixture, fixtureDir } = loadFixture(process.argv[2]);
const shots = process.argv[3];
if (shots) mkdirSync(shots, { recursive: true });
const files = gameFiles();
const browser = await chromium.launch();
process.on('unhandledRejection', async (e) => { console.error('FAIL', e); await browser.close().catch(() => {}); process.exit(1); });
// 게임 머리의 닫기 단추는 필드 탭 안에서는 숨겨져 있다(창의 머리가 대신). 사용자는 Esc → 「필드 나가기」(= game-close 동작)로 나간다: 그 동작을 바로 부른다
const closeGame = async (page) => { await page.evaluate(() => document.querySelector('[data-action="game-close"]')?.click()); await waitSel(page, '.gx-game', { state: 'detached', timeout: 10000 }); };
const status = (page) => page.evaluate(() => document.querySelector('.gx-settings [role=status]')?.textContent ?? '');
const waitStatus = (page, re, ms = 60000) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('.gx-settings [role=status]')?.textContent ?? ''), re.source, { timeout: ms });
/** 본편 응답(상황판 태그)을 플러그인 출력 처리기로 읽혀 $goei_world 를 만든다 (tests/browser.mjs startedWithReply 와 같다) */
const settleWorld = (page) => page.evaluate(async () => {
  const c = window.__chat;
  await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
});
/** 누수 계측: AudioContext 수·상태, rAF 호출 수, window/document 리스너 순증 */
const INSTRUMENT = `
  window.__ac = []; const AC = window.AudioContext; window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ac.push(this); } };
  window.__raf = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => raf((t) => { window.__raf++; f(t); });
  window.__lis = {}; for (const T of [window, document]) { const add = T.addEventListener.bind(T), rem = T.removeEventListener.bind(T); const tag = T === window ? 'w' : 'd';
    T.addEventListener = (type, fn, o) => { window.__lis[tag + ':' + type] = (window.__lis[tag + ':' + type] ?? 0) + 1; return add(type, fn, o); };
    T.removeEventListener = (type, fn, o) => { window.__lis[tag + ':' + type] = (window.__lis[tag + ':' + type] ?? 0) - 1; return rem(type, fn, o); }; }`;
const results = [];
const ok = (name, detail = '') => { results.push(`${name} · 통과${detail ? ` · ${detail}` : ''}`); console.log('PASS', name, detail); };

// ── ① 받기: 없음 → 실패 → 부분 실패 → 성공 → 팩 옛 판 → 코드 옛 판 → 판 불일치 파일 ──
{
  let { page, errors } = await boot(browser, fixture, startedChat(), { fixtureDir });
  await page.addScriptTag({ content: INSTRUMENT });
  await settleWorld(page);
  await openPanel(page);
  await openField(page);
  assert.equal(await page.locator('.gx-gl [data-g="play"]:not([disabled])').count(), 0, '파일 없이는 들어가기 못 함');
  assert.match(await page.textContent('.gx-gl'), /처음 한 번만 받아요/);
  // 받을 곳이 없다(404)
  await page.click('[data-g="get"]');
  await waitStatus(page, /받지 못했어요/);
  assert.equal(await page.locator('[data-g="get"]:not([disabled])').count(), 1, '실패 뒤 받기 단추 다시 살아남');
  // 팩 한 조각만 404: 코드는 저장되고 팩에서 멈춘다, 다시 받기로 이어진다
  await serveGame(page, files, { fail: '^hq-field\\.2\\.bin$' });
  await page.click('[data-g="get"]');
  await waitStatus(page, /받지 못했어요.*hq-field/, 120000);
  assert.match(await page.evaluate(() => window.__store['p:goei:game:code']?.slice(0, 24) ?? ''), /^\/\/ goei-game /, '코드는 먼저 저장됨');
  assert.equal(await page.evaluate(() => 'p:goei:game:pack:hq-field' in window.__store), false, '깨진 팩은 저장 안 됨');
  const before = await page.evaluate(() => (window.__calls.fetch ?? []).length);
  await serveGame(page, files);
  await page.click('[data-g="get"]');
  await waitStatus(page, /다 받았어요/, 120000);
  const after = await page.evaluate(() => (window.__calls.fetch ?? []).length);
  const got = await page.evaluate(() => Object.keys(window.__store).filter((k) => k.startsWith('p:goei:game:pack:')).map((k) => k.slice(17)));
  assert.ok(got.includes('hq-field') && got.includes('jr-field') && got.includes('test-people'), `필수 팩 저장 ${got}`);
  const codeParts = await page.evaluate(() => (window.__calls.fetch ?? []).filter((u) => /goei-game\.\d+\.txt/.test(u)).length);
  assert.equal(codeParts, JSON.parse(new TextDecoder().decode(Buffer.from(files['index.json'], 'base64'))).code.parts.length, `코드 조각은 한 번만 받는다 (두 번째 받기는 저장해 둔 코드) ${codeParts}`);
  ok('받기 없음→실패→부분 실패→성공', `요청 ${after - before}번`);
  // 팩 옛 판: 저장한 팩의 지문을 바꾸면 그 팩만 다시 받는다
  await page.evaluate(() => { const k = 'p:goei:game:pack:jyaldi'; const v = JSON.parse(window.__store[k]); v.hash = 'old0000000000000'; window.__store[k] = JSON.stringify(v); });
  await closeGame(page);
  await openField(page);
  assert.match(await page.textContent('.gx-gl'), /게임 파일 받기/, '옛 팩이 있으면 받기 줄이 다시 보임');
  await page.evaluate(() => (window.__calls.fetch = []));
  await page.click('[data-g="get"]');
  await waitStatus(page, /다 받았어요/, 120000);
  const refetched = await page.evaluate(() => (window.__calls.fetch ?? []).map((u) => u.split('?')[0].split('/').pop()));
  assert.ok(refetched.includes('jyaldi.1.bin') && !refetched.some((n) => n.startsWith('hq-field')) && !refetched.some((n) => /goei-game\.\d/.test(n)), `옛 팩만 다시 받음 ${refetched}`);
  ok('팩 옛 판 갱신', refetched.join(','));
  // 코드 옛 판: 저장한 코드의 판 머리가 다르면(플러그인이 바뀐 뒤 새 페이지) 다시 받는다. 같은 페이지 안에서는 이미 실행한 모듈을 쓴다(정상)
  const store = await page.evaluate(() => JSON.stringify(window.__store));
  assert.deepEqual(errors, []);
  await page.close();
  const fresh = async (patch) => {
    const b = await boot(browser, fixture, startedChat(), { fixtureDir });
    await b.page.evaluate(({ store, patch }) => { Object.assign(window.__store, JSON.parse(store)); (new Function('store', patch))(window.__store); }, { store, patch });
    await settleWorld(b.page);
    await openPanel(b.page);
    await openField(b.page);
    await serveGame(b.page, files);
    return b;
  };
  {
    const { page, errors } = await fresh("store['p:goei:game:code'] = store['p:goei:game:code'].replace(/^\\/\\/ goei-game \\S+/, '// goei-game 0.0.1');");
    assert.match(await page.textContent('.gx-gl'), /플러그인이 바뀌어 게임 파일을 새로 받아야 해요/);
    assert.equal(await page.locator('.gx-gl [data-g="play"]:not([disabled])').count(), 0, '옛 코드로는 들어가기 못 함');
    await page.evaluate(() => (window.__calls.fetch = []));
    await page.click('[data-g="get"]');
    await waitStatus(page, /다 받았어요/, 120000);
    assert.match(await page.evaluate(() => window.__store['p:goei:game:code'].slice(0, 30)), new RegExp(`^// goei-game ${VERSION.replace(/\./g, '\\.')}`));
    const refetched = await page.evaluate(() => (window.__calls.fetch ?? []).map((u) => u.split('?')[0].split('/').pop()));
    assert.ok(refetched.some((n) => /goei-game\.\d/.test(n)) && !refetched.some((n) => /\.bin$/.test(n)), `코드만 다시 받음 ${refetched}`);
    ok('코드 옛 판 갱신');
    assert.deepEqual(errors, []);
    await page.close();
  }
  // 목록(index.json)의 판이 플러그인과 다르면 받지 않고 안내
  {
    const { page, errors } = await fresh("store['p:goei:game:code'] = store['p:goei:game:code'].replace(/^\\/\\/ goei-game \\S+/, '// goei-game 0.0.1');");
    await page.evaluate(() => { const idx = JSON.parse(new TextDecoder().decode(window.__gameBytes['index.json'])); idx.version = '9.9.9'; window.__gameBytes['index.json'] = new TextEncoder().encode(JSON.stringify(idx)); });
    await page.click('[data-g="get"]');
    await waitStatus(page, /아직 이 판의 게임 파일이 올라오지 않았어요/);
    await serveGame(page, files);
    await page.click('[data-g="get"]');
    await waitStatus(page, /다 받았어요/, 120000);
    ok('목록 판 불일치 안내');
    assert.deepEqual(errors, []);
    await page.close();
  }
  ({ page, errors } = await fresh(''));
  // 파일로 넣기: 판이 다른 코드, 팩이 아닌 바이트
  const put = async (name, bytes) => page.evaluate(async ({ name, bytes }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0))], name));
    const input = document.querySelector('[data-g-file]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { name, bytes });
  await put('goei-game.js', Buffer.from('// goei-game 0.0.1\nglobalThis.__goeiGame={version:"0.0.1",mount(){}}').toString('base64'));
  await waitStatus(page, /용 게임 코드가 아니에요/);
  await put('bad.pack', Buffer.from('NOTAPACK0000').toString('base64'));
  await waitStatus(page, /게임 팩 파일이 아니에요/);
  // 판이 맞는 코드를 파일로 넣으면 그대로 받아들인다
  await put('goei-game.js', files['goei-game.js']);
  await waitStatus(page, /넣었어요: 게임 코드/);
  ok('파일로 넣기 (판 불일치·팩 아님·정상)');
  if (shots) await page.screenshot({ path: `${shots}/qc-plugin-home.png` });
  assert.deepEqual(errors, []);
  await page.close();
}

// ── ② 열기·닫기 20회 누수, 저장 칸, 다리, 막간, 숨기기, 전체 화면, Esc ──
{
  // 세계(상황판)가 시작된 채팅: 요원 방(사무실·휴게실)·세계 시각이 있어야 본부 방문·인물 대화를 본다
  const { page, errors } = await boot(browser, fixture, { id: 'chat-qc-1', message: [], scriptstate: {} }, { fixtureDir });
  await page.addScriptTag({ content: INSTRUMENT });
  await startWorldChat(page);
  await openPanel(page);
  await openField(page);
  await serveGame(page, files);
  await page.click('[data-g="get"]');
  await waitStatus(page, /다 받았어요/, 120000);
  const cdp = await page.context().newCDPSession(page);
  const heapMB = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = (await cdp.send('Performance.getMetrics')).metrics.find((x) => x.name === 'JSHeapUsedSize'); return +(m.value / 1048576).toFixed(1); };
  await cdp.send('Performance.enable');
  const cold = await heapMB();
  let base = cold, closed = 0;
  const lis0 = await page.evaluate(() => ({ ...window.__lis }));
  const times = [];
  for (let i = 0; i < 20; i++) {
    const t0 = Date.now();
    await enterGame(page);
    if (i === 0) assert.equal(await page.evaluate(() => typeof window.__goeiBridge), 'undefined', '$goei_diag 없이는 플러그인 다리를 페이지 전역에 두지 않는다');
    if (i < 2) await enterHub(page); // 두 번은 본부까지 (세계 시뮬·장부·시계까지 돈다)
    else await page.waitForFunction(() => !!window.__goeiEngine, null, { timeout: 20000 });
    times.push(Date.now() - t0);
    await closeGame(page);
    await page.waitForTimeout(80);
    // 닫은 뒤: blob 주소 0, 엔진 전역 없음, rAF 멈춤
    const live = await page.evaluate(() => window.__goeiGameStats.urls());
    assert.equal(live, 0, `${i + 1}번째 닫은 뒤 blob 주소 ${live}`);
    assert.equal(await page.evaluate(() => !!window.__goeiEngine), false, '엔진 전역이 남음');
    // 첫 열기는 게임 코드 모듈(한 페이지에 한 번 실행)·팩 캐시로 ~12MB 가 는다(정상). 누수는 그 뒤부터 잰다
    if (i === 0) base = await heapMB();
    if (i === 19) closed = await heapMB(); // 닫은 직후 (다시 연 시작 화면이 읽어 둔 파일은 빼고 잰다)
    await openField(page);
  }
  await page.waitForTimeout(400);
  const raf0 = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(500);
  const rafDelta = await page.evaluate((r) => window.__raf - r, raf0);
  const ac = await page.evaluate(() => ({ n: window.__ac.length, open: window.__ac.filter((c) => c.state !== 'closed').length }));
  const lis1 = await page.evaluate(() => ({ ...window.__lis }));
  const grew = Object.entries(lis1).filter(([k, v]) => v - (lis0[k] ?? 0) > 2).map(([k, v]) => `${k}:+${v - (lis0[k] ?? 0)}`);
  assert.equal(rafDelta, 0, `닫은 뒤에도 rAF 가 돈다 (${rafDelta}/0.5s)`);
  assert.equal(ac.open, 0, `AudioContext 가 열린 채 남음 ${ac.open}/${ac.n}`);
  assert.deepEqual(grew, [], `리스너가 쌓임 ${grew}`);
  assert.ok(closed - base < 6, `첫 열기 뒤 19회 동안 힙 ${base}→${closed}MB (처음 ${cold})`);
  ok('열기/닫기 20회 누수', `열기 ${Math.min(...times)}~${Math.max(...times)}ms · AudioContext ${ac.n}개 모두 닫힘 · 힙 처음 ${cold} · 첫 열기 뒤 ${base}→20회 뒤 ${closed}MB`);

  // 저장 칸 0~3: 자동 저장은 0번. 깨진 본문·schema 다름·목록 깨짐·큰 본문 → 열리고 오류 없음
  await page.evaluate(() => { window.__store['p:goei:game:slot:0'] = '{"schema":"goei-session/1","revision":'; window.__store['p:goei:game:slots'] = '[not json'; });
  await enterGame(page); await enterHub(page);
  assert.ok(await page.evaluate(() => window.__goeiEngine.inHub), '깨진 저장으로도 본부 열림');
  await page.keyboard.press('Escape');
  await waitSel(page, '.mn.on');
  const pauseSub = await page.textContent('.mn.on');
  await page.keyboard.press('Escape');
  await closeGame(page);
  await openField(page);
  await page.evaluate(() => { window.__store['p:goei:game:slot:0'] = JSON.stringify({ schema: 'goei-other/9', foo: 1 }); window.__store['p:goei:game:slots'] = JSON.stringify({ slots: [{ slot: 0, savedAt: 1, title: 'x', summary: '', schema: 'goei-other/9', size: 1 }, { slot: 7 }], last: 0 }); });
  await enterGame(page); await enterHub(page);
  assert.ok(await page.evaluate(() => window.__goeiEngine.inHub), 'schema 다른 저장으로도 본부 열림');
  await closeGame(page);
  await openField(page);
  // 큰 본문 (2MB) 과 1~3 칸 쓰기·읽기·지우기·마지막 칸 (호스트 saves 직접)
  await page.evaluate(() => { window.__store['p:goei:game:slot:0'] = JSON.stringify({ schema: 'goei-session/1', revision: 1, hq: null, meta: null, checkpoint: null, pad: 'x'.repeat(2 * 1024 * 1024) }); });
  // 플러그인 다리(window.__goeiBridge)는 이 채팅 변수 $goei_diag 가 '1' 일 때만 노출된다 (진단·시험용. 평소엔 페이지 전역에 저장 경로를 열지 않는다) — 이번 열기부터
  await page.evaluate(() => { window.__chat.scriptstate.$goei_diag = '1'; });
  await enterGame(page); await enterHub(page);
  assert.ok(await page.evaluate(() => window.__goeiEngine.inHub), '2MB 저장으로도 본부 열림');
  const saved0 = await page.evaluate(() => { const l = JSON.parse(window.__store['p:goei:game:slots'] ?? '{"slots":[]}'); return { n: l.slots.length, last: l.last, size: (window.__store['p:goei:game:slot:0'] ?? '').length }; });
  assert.ok(saved0.n >= 1 && saved0.last === 0 && saved0.size > 0 && saved0.size < 1024 * 1024, `자동 저장 0번 칸 다시 씀 ${JSON.stringify(saved0)}`);
  ok('저장 칸 (깨진 JSON·schema 다름·목록 깨짐·2MB)', `일시정지 안내 「${pauseSub.replace(/\s+/g, ' ').slice(0, 60)}…」`);

  // 다리: 필드 장부 (장면 이동 → move 사건·확정 사실), 가계부, 인물 대화(visit), $hq_ui
  await page.evaluate(() => window.__goeiEngine.world.stage.jump('f3', 400));
  await page.waitForFunction(() => window.__goeiEngine.world?.stage.current()?.id === 'f3', null, { timeout: 10000 });
  await page.waitForFunction(() => (window.__chat.goeiFieldV1?.events ?? []).some((e) => e.kind === 'move'), null, { timeout: 10000 });
  const evs = await page.evaluate(() => window.__chat.goeiFieldV1.events.map((e) => ({ kind: e.kind, text: e.text, fact: e.fact?.key, anchor: e.anchor })));
  assert.ok(evs.some((e) => e.kind === 'move' && e.fact === '주인공 위치'), `이동 사건 ${JSON.stringify(evs.slice(-3))}`);
  assert.ok(evs.some((e) => e.fact === '필드 시각'), '필드 시각 사실 (본편 시각 10:20 에서 시작)');
  assert.ok(evs.every((e) => e.anchor === 'm2'), '사건 기준은 마지막 메시지 chatId');
  const wallet0 = await page.evaluate(() => window.__goeiWallet.balance());
  const after1 = await page.evaluate(() => window.__goeiWallet.pay(-3000, 'QC 거래'));
  assert.equal(after1, wallet0 - 3000, `가계부 거래 뒤 잔고 ${wallet0}→${after1}`);
  await page.waitForFunction(() => (window.__chat.goeiFieldV1?.events ?? []).some((e) => e.kind === 'trade'), null, { timeout: 5000 });
  const w = await page.evaluate(() => ({ raw: window.__chat.scriptstate.$st_wallet, ev: window.__chat.goeiFieldV1.events.find((e) => e.kind === 'trade') }));
  assert.match(String(w.raw ?? ''), /QC 거래/, '가계부 변수에 필드 거래가 적힘');
  assert.match(w.ev.text, /QC 거래 −3,000원/);
  // 시간 보내기 (앉기 자리) → 장부 사건과 필드 시각 사실
  await page.evaluate(() => window.__goeiEngine.world.stage.jump('office', 400));
  await page.waitForFunction(() => window.__goeiEngine.world?.stage.current()?.id === 'office', null, { timeout: 10000 });
  await page.waitForTimeout(1300);
  await page.evaluate(() => { const w = window.__goeiEngine.world; const s = w.stage.current().spots.find((q) => q.id === 'seat'); w.player.x = s.x; w.player.y = s.y; });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await waitSel(page, '.mn.on');
  assert.match(await page.textContent('.mn.on'), /시간 보내기/);
  await page.keyboard.press('Enter'); // 첫 선택지 (30분)
  await page.waitForFunction(() => (window.__chat.goeiFieldV1?.events ?? []).some((e) => /시간을 보냈다/.test(e.text)), null, { timeout: 5000 });
  const waited = await page.evaluate(() => window.__chat.goeiFieldV1.events.find((e) => /시간을 보냈다/.test(e.text)));
  assert.equal(waited.kind, 'act');
  assert.equal(waited.fact?.key, '필드 시각');
  assert.match(waited.fact.value, /^11:/, `본편 10:20 + 장면 10분 ×2 + 30분 → ${waited.fact.value}`);
  ok('다리: 장부 이동·시각·가계부·시간 보내기', `잔고 ${wallet0}→${after1} · 시각 ${waited.fact.value}`);
  // $hq_ui: 게임 설정을 바꾸면 이 채팅 변수에 저장 (0.6초 모아서)
  await page.keyboard.press('Escape');
  await waitSel(page, '.mn.on');
  await page.locator('.mn.on .mn-btn, .mn.on .mn-row', { hasText: /^설정$/ }).first().click();
  await waitSel(page, '.mn.on .mn-tog, .mn.on .mn-ch');
  await page.locator('.mn.on .mn-row', { hasText: /피격 섬광/ }).first().click();
  await page.waitForFunction(() => { const v = window.__chat.scriptstate?.$hq_ui; return typeof v === 'string' && JSON.parse(v).flash === false; }, null, { timeout: 5000 });
  const prefs = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$hq_ui));
  assert.equal(prefs.flash, false);
  assert.equal(prefs.tScene, 10, '필드 시간 기본값도 같이 저장');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  ok('$hq_ui 채팅별 설정 저장');
  // 다리: 출동 종료 → 보고서 (기록 묶음 3): 플러그인이 exit_anomaly 를 받아 같은 저장에 일지 fd 줄·전체 보고서를 만들고, 필드 탭 위에 시트, lastReport 다리로 게임에 알린다
  assert.ok(await page.evaluate(() => !!window.__goeiBridge?.field?.lastReport), '플러그인 다리 노출 ($goei_diag=1 진단용)');
  assert.equal(await page.evaluate(() => window.__goeiBridge.field.lastReport()), null, '출동 전엔 보고서 없음');
  await page.evaluate(async () => {
    const f = window.__goeiBridge.field;
    await f.record({ kind: 'enter_anomaly', text: '작전 투입: 젖은 복도', weight: 3, visit: 'qc1', fact: { key: '작전', value: '투입 중 (젖은 복도)' } });
    await f.record({ kind: 'kill', text: '그림자를 처치했다', who: ['에일린'], visit: 'qc1' });
    await f.record({ kind: 'exit_anomaly', text: '작전 종료 (귀환): 젖은 복도, 처치 1, 부상 0', weight: 3, visit: 'qc1', fact: { key: '작전', value: '종료 (귀환)' } });
  });
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$goei_journal ?? '{"rows":[]}').rows.some((r) => r.kind === 'fd'), null, { timeout: 5000 });
  const fd = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_journal)).rows.find((r) => r.kind === 'fd');
  const frpt = JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_reports)).items.find((r) => r.id === fd.rpt);
  assert.ok(fd.mine && fd.cause === 'field' && fd.name === '젖은 복도' && frpt?.full && frpt.mine, JSON.stringify(fd));
  assert.deepEqual(frpt.trail.map((t) => t.text), ['작전 투입: 젖은 복도', '(처치) 그림자를 처치했다', '작전 종료 (귀환): 젖은 복도, 처치 1, 부상 0']);
  assert.ok(frpt.agents.some((a) => a.name === '에일린') && frpt.agents.length >= 2, `투입 ${JSON.stringify(frpt.agents)}`);
  assert.equal(frpt.statusKey, undefined, '필드 종료는 응답이 아니라 채팅 카드 열쇠가 없다');
  assert.ok(frpt.head.since !== null && frpt.head.duration !== null && frpt.head.duration >= 1, `시각 ${JSON.stringify(frpt.head)}`);
  const last = await page.evaluate(() => window.__goeiBridge.field.lastReport());
  assert.ok(last && last.id === frpt.id && last.title === '젖은 복도' && last.summary.includes('에일린'), JSON.stringify(last));
  await waitSel(page, '.gx-fieldsheet');
  const sheet = await page.textContent('.gx-fieldsheet');
  assert.ok(sheet.includes('출동 종료') && sheet.includes('젖은 복도') && sheet.includes('에일린') && sheet.includes('내가 출동'), sheet);
  assert.ok(await page.evaluate(() => !!window.__goeiEngine && !!document.querySelector('.gx-game')), '시트가 떠도 게임은 붙어 있다');
  if (shots) await page.screenshot({ path: `${shots}/qc-plugin-fieldsheet.png` });
  await page.click('.gx-fieldsheet [data-action="rec-open"]');
  await waitSel(page, '.gx-records .gx-rpt');
  assert.ok((await page.textContent('.gx-rpt')).includes('필드 출동') && (await page.textContent('.gx-rpt')).includes('젖은 복도'));
  assert.ok(await page.evaluate(() => !!window.__goeiEngine), '기록 탭으로 가도 게임은 떼어 둔 채 산다');
  await page.locator('[data-value="field"]:visible').first().click();
  await waitSel(page, '.gx-game .goei-engine canvas');
  assert.equal(await page.locator('.gx-fieldsheet').count(), 0, '보고서를 열면 시트는 닫힘');
  await waitSel(page, '.mn.on'); // 떼었다 붙이면 일시정지 메뉴가 열려 있다 → 닫기
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.mn.on'));
  // 같은 출동을 다시 받아도 한 번 (같은 방문·같은 투입 사건)
  await page.evaluate(async () => { await window.__goeiBridge.field.record({ kind: 'exit_anomaly', text: '작전 종료 (귀환): 젖은 복도, 처치 1, 부상 0', weight: 3, visit: 'qc1' }); });
  await page.waitForTimeout(400);
  assert.equal(JSON.parse(await page.evaluate(() => window.__chat.scriptstate.$goei_journal)).rows.filter((r) => r.kind === 'fd').length, 1, '중복 없음');
  ok('다리: 출동 종료 → 일지 fd 줄·전체 보고서·필드 시트·lastReport', `${frpt.no} · ${last.summary}`);
  // 인물 대화: 요원 옆에서 E → 말풍선 입력 → 모델 응답 → 채팅 goeiHqVisitV1 에 기록, 본편 채팅 메시지는 늘지 않음
  const who = await page.evaluate(() => { const w = window.__goeiWorld; const a = w.actors.find((q) => q.def.kind === 'named'); return a ? { name: a.def.name, scene: a.scene, x: a.x, y: a.y } : null; });
  assert.ok(who, '필드에 선 요원이 있다');
  await page.evaluate((who) => window.__goeiEngine.world.stage.jump(who.scene, who.x), who);
  await page.waitForFunction((s) => window.__goeiEngine.world?.stage.current()?.id === s, who.scene, { timeout: 10000 });
  await page.waitForTimeout(1300);
  for (let i = 0; i < 20 && !(await page.evaluate(() => document.querySelector('.gt-bar[data-open]'))); i++) {
    await page.evaluate((n) => { const w = window.__goeiEngine.world; const a = window.__goeiWorld.actors.find((q) => q.def.name === n); w.player.x = a.x - 40; w.player.y = a.y; }, who.name);
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
  }
  await waitSel(page, '.gt-bar[data-open]');
  const msgs0 = await page.evaluate(() => window.__chat.message.length);
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '응, 왔구나. 오늘은 조용해.' }]; });
  await page.fill('.gt-in', '안녕하세요');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window.__chat.goeiHqVisitV1?.turns ?? []).length === 1, null, { timeout: 15000 });
  const turn = await page.evaluate(() => window.__chat.goeiHqVisitV1.turns[0]);
  assert.equal(turn.user, '안녕하세요');
  assert.match(turn.reply, /왔구나/);
  assert.equal(await page.evaluate(() => window.__chat.message.length), msgs0, '대화는 채팅 메시지로 들어가지 않는다');
  assert.equal(await page.evaluate(() => (window.__calls.send ?? []).length), 0, '자동 전송 없음');
  await page.keyboard.press('Escape'); // 대화창 닫기 → 시계 +대화 분
  await page.waitForTimeout(300);
  ok('다리: 요원 대화(visit)', `${who.name} · ${turn.reply.slice(0, 20)}`);
  if (shots) await page.screenshot({ path: `${shots}/qc-plugin-talk.png` });

  // 다른 탭으로 가면 떼어 두고 멈춘다 (일시정지 메뉴·소리 끔), 돌아오면 같은 엔진이 다시 붙는다
  const engineId = await page.evaluate(() => (window.__goeiEngine.__qcId = Math.random()));
  await page.locator('[data-value="board"]:visible').first().click();
  await page.waitForFunction(() => !document.querySelector('.gx-game')?.isConnected, null, { timeout: 5000 });
  assert.ok(await page.evaluate(() => !!window.__goeiEngine), '떼어 둔 동안 엔진은 산다');
  // 탭을 바꾸면 창이 다시 그려져 게임 층이 먼저 떨어진다: 그래도 멈춤 알림이 가 일시정지가 열려야 한다 (예전엔 안 가서 떼어진 채 계속 돌았다)
  assert.ok(await page.evaluate(() => [...(window.__goeiEngine.canvas.closest('.gx-game')?.querySelectorAll('.mn') ?? [])].some((m) => m.classList.contains('on'))), '떼어 둔 동안 일시정지');
  await page.locator('[data-value="field"]:visible').first().click();
  await waitSel(page, '.gx-game .goei-engine canvas');
  assert.equal(await page.evaluate(() => window.__goeiEngine.__qcId), engineId, '같은 엔진이 다시 붙음');
  assert.equal(await page.locator('.mn.on').count(), 1, '돌아오면 일시정지 메뉴가 열려 있다');
  // 엔진은 캔버스 여러 장(화면·HUD·CRT 등)을 쓴다: 엔진 하나·화면 캔버스 하나인지 본다 (다시 붙일 때 새로 만들지 않음)
  assert.equal(await page.locator('.goei-engine').count(), 1, '엔진 하나');
  assert.equal(await page.locator('.goei-engine .gs-canvas').count(), 1, '화면 캔버스 하나');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.mn.on'));
  ok('숨기기 → 다시 붙이기');

  // Esc = 일시정지 / 전체 화면 (상황창 안·끄기) / 필드 나가기
  await page.keyboard.press('Escape');
  await waitSel(page, '.mn.on');
  await page.locator('.mn.on .mn-btn, .mn.on .mn-row', { hasText: /^설정$/ }).first().click();
  await page.locator('.mn.on .mn-row', { hasText: /전체 화면/ }).locator('[data-opt="panel"]').click();
  await waitSel(page, '.gx-game.gx-panelfull');
  const full = await page.evaluate(() => { const r = document.querySelector('.gx-game').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  assert.ok(full.w >= 1000, `상황창 안 전체 ${full.w}×${full.h}`);
  if (shots) await page.screenshot({ path: `${shots}/qc-plugin-panelfull.png` });
  await page.locator('.mn.on .mn-row', { hasText: /전체 화면/ }).locator('[data-opt="off"]').click();
  await page.waitForFunction(() => !document.querySelector('.gx-game.gx-panelfull'));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.mn.on'));
  // 필드 나가기 → 창은 상황판으로, 게임 없음
  await page.keyboard.press('Escape');
  await waitSel(page, '.mn.on');
  await page.locator('.mn.on .mn-btn, .mn.on .mn-row', { hasText: /필드 나가기/ }).first().click();
  await page.waitForFunction(() => !document.querySelector('.gx-game') && !window.__goeiEngine, null, { timeout: 5000 });
  ok('Esc 일시정지 · 전체 화면 · 필드 나가기');

  // 게임을 닫은 뒤 본편 요청: 막간·확정 사실이 끼고(자동 전송 없음), 방문 기록은 메시지로 남지 않는다
  const req = await page.evaluate(() => window.__calls.replacers[0]([{ role: 'system', content: 'sys' }, { role: 'user', content: '시작' }, { role: 'assistant', content: window.__chat.message[1].data }, { role: 'user', content: '다음' }], 'model'));
  const text = req.map((m) => m.content).join('\n');
  assert.match(text, /\[필드 막간\]/, '막간이 요청에 들어감');
  assert.match(text, /안녕하세요[\s\S]*왔구나/, '대화 원문');
  assert.match(text, /\(이동\)/, '장부 사건');
  assert.match(text, /\[Field facts\][\s\S]*주인공 위치/, '확정 사실');
  assert.equal(await page.evaluate(() => (window.__calls.send ?? []).length), 0, '자동 전송 없음');
  assert.equal(await page.evaluate(() => window.__chat.message.length), msgs0, '채팅 메시지 수 그대로');
  ok('본편 요청에 끼는 막간 (자동 전송 없음)');
  assert.deepEqual(errors, []);
  await page.close();
}
console.log(results.join('\n'));
console.log('qc-game-plugin-browser 통과');
await browser.close();
