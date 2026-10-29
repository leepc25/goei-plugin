// 모바일 필드 조작 시험 (docs/모바일조작/모바일_조작_설계.md, 구현 docs/모바일조작/구현_2026-10-29.md).
// 실제 플러그인 창(qc-host 의 boot·startChat + qc-game-host 의 serveGame·openField·enterGame·enterHub)에서 폰 세로 390×844·가로 844×390(hasTouch·isMobile)으로
// 본부까지 들어가 (a) 창 전체·세로는 회전 (b) 머리·아래 메뉴·신분증·유령 버튼 숨김 (c) 버튼 배치 (d) 버튼 → 키 (e) 스틱 (f) 빈 곳 탭 무시
// (g) 대사창 모드 (h) 키패드 모드 (i) AUTO (대련) (j) 필드 나가기 뒤 복귀 (k) 열고 닫기 5회 뒤 리스너·노드 증가 0 을 본다.
// 사용: node tests/qc-mobile-browser.mjs <fixture.json> [사진 폴더 (기본 docs/모바일조작/shots)]
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, boot, startChat } from './qc-host.mjs';
import { gameFiles, serveGame, openField, enterGame, enterHub } from './qc-game-host.mjs';

const fxPath = process.argv[2];
if (!fxPath) throw new Error('사용: node tests/qc-mobile-browser.mjs <fixture.json> [사진 폴더]');
const fx = JSON.parse(readFileSync(fxPath, 'utf8'));
const fixtureDir = dirname(resolve(fxPath));
const shots = process.argv[3] ?? fileURLToPath(new URL('../docs/모바일조작/shots', import.meta.url));
mkdirSync(shots, { recursive: true });
const only = process.env.VPS ? JSON.parse(process.env.VPS) : null;
const results = [];
const ok = (name, info = '') => (results.push(`  ✓ ${name}${info ? ` — ${info}` : ''}`), console.log(`  ✓ ${name}${info ? ` — ${info}` : ''}`));
let cur = null;
const wait = (ms) => cur.waitForTimeout(ms);

/** 층 좌표 → 화면 좌표 (게임이 시계 방향 90도로 돌아 있으면 돌려서) */
const toScreen = (page, x, y) => page.evaluate(([x, y]) => {
  const L = document.querySelector('.gs-touch');
  const r = L.getBoundingClientRect();
  const rot = Math.abs(r.width - L.clientHeight) < 2 && Math.abs(r.height - L.clientWidth) < 2 && Math.abs(L.clientWidth - L.clientHeight) > 4;
  return rot ? { x: r.right - y, y: r.top + x } : { x: r.left + x, y: r.top + y };
}, [x, y]);
const rects = (page) => page.evaluate(() => window.__goeiTouch.rects());
const btnAt = async (page, id) => { const r = (await rects(page))[id]; return toScreen(page, r.x, r.y); };
const size = (page) => page.evaluate(() => { const L = document.querySelector('.gs-touch'); return { w: L.clientWidth, h: L.clientHeight }; });
const startLog = (page) => page.evaluate(() => { window.__tlog = []; window.__offTlog?.(); window.__offTlog = window.__goeiInput.on((c, d, s) => window.__tlog.push([c, d, s, Math.round(performance.now())])); });
const log = (page) => page.evaluate(() => window.__tlog.map(([c, d, s, t]) => [c, d, s, t]));
const held = (page, code) => page.evaluate((c) => window.__goeiInput.held(c), code);
const shownIds = (page) => page.evaluate(() => [...document.querySelectorAll('.tp-b')].filter((b) => getComputedStyle(b).display !== 'none' && b.closest('.tp:not(.hide)')).map((b) => b.dataset.id));

async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i + 1 })) });
}

/** 플러그인 창을 띄우고 필드 시작 화면까지 */
async function bootPhone(browser, w, h, noFs = false) {
  const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, { viewport: { width: w, height: h }, touch: true, fixtureDir });
  await page.evaluate(() => { const m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1'; document.head.append(m); });
  // 아이폰처럼 전체화면이 막힌 경우: 창 전체 덮기 + 회전으로 가야 한다
  if (noFs) await page.evaluate(() => { Element.prototype.requestFullscreen = function () { return Promise.reject(new Error('전체화면 막힘')); }; });
  await startChat(page);
  await page.evaluate(async () => {
    const c = window.__chat;
    c.message.push({ role: 'user', data: '안녕' }, { role: 'char', data: '본부 로비. 조용하다.' });
    await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 });
  });
  await serveGame(page, gameFiles());
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 10000 });
  await page.click('[x-goei-fab] button');
  await page.waitForSelector('.gx-head');
  await openField(page);
  const need = await page.$('[data-g="get"]');
  if (need) {
    await need.click();
    await page.waitForFunction(() => /다 받았어요/.test(document.querySelector('.gx-game')?.textContent ?? ''), null, { timeout: 180000 });
  }
  return { page, errors };
}

/** 창 머리·왼쪽 메뉴 줄(신분증)·아래 메뉴·유령 버튼이 보이는가 */
const chrome = (page) => page.evaluate(() => {
  const vis = (el) => !!el && el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && el.getBoundingClientRect().width > 0;
  const fab = document.querySelector('[x-goei-fab]');
  return {
    head: vis(document.querySelector('.gx-panel > .gx-head')),
    nav: vis(document.querySelector('.gx-panel > .gx-nav')),
    mbar: vis(document.querySelector('.gx-mbar')),
    id: vis(document.querySelector('.gx-panel .gx-id')),
    fab: fab?.style.display === 'block',
    fieldfull: !!document.querySelector('.gx.gx-fieldfull'),
    fs: !!document.fullscreenElement,
  };
});

async function listenerCount(cdp) {
  const { result: win } = await cdp.send('Runtime.evaluate', { expression: 'window' });
  const { result: doc } = await cdp.send('Runtime.evaluate', { expression: 'document' });
  const a = await cdp.send('DOMDebugger.getEventListeners', { objectId: win.objectId });
  const b = await cdp.send('DOMDebugger.getEventListeners', { objectId: doc.objectId });
  return a.listeners.length + b.listeners.length;
}

async function exitField(page) {
  await page.touchscreen.tap(...Object.values(await btnAt(page, 'menu')));
  await page.waitForSelector('.mn.on .mn-btn >> text=필드 나가기', { timeout: 5000 });
  await page.tap('.mn.on .mn-btn >> text=필드 나가기');
  await page.waitForFunction(() => !document.querySelector('.gx-game-box .goei-engine canvas'), null, { timeout: 10000 });
  await wait(600);
}

const browser = await chromium.launch();
const vps = only ?? [[390, 844, 'portrait'], [844, 390, 'landscape'], [390, 844, 'portrait-nofs', true]];
for (const [W, H, name, noFs] of vps) {
  console.log(`── ${name} ${W}×${H}`);
  const { page, errors } = await bootPhone(browser, W, H, !!noFs);
  cur = page;
  const cdp = await page.context().newCDPSession(page);
  const before = { nodes: await page.evaluate(() => document.querySelectorAll('*').length), listeners: await listenerCount(cdp) };
  await enterGame(page);
  await enterHub(page);
  await page.waitForFunction(() => !!window.__goeiTouch && document.querySelector('.tp') && !document.querySelector('.tp').classList.contains('hide'), null, { timeout: 10000 });
  await wait(500);

  // (a) 게임이 창 전체, 세로는 회전
  const a = await page.evaluate(() => {
    const g = document.querySelector('.gx-game'), inn = document.querySelector('.gx-game-in');
    const r = (inn ?? g).getBoundingClientRect();
    return { cover: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], rot: g.classList.contains('gx-rot'), winfull: g.classList.contains('gx-winfull'), fs: document.fullscreenElement === g, w: innerWidth, h: innerHeight, turned: document.querySelector('.gs').classList.contains('turned') };
  });
  assert.ok(a.winfull || a.fs, `창 전체 덮기 또는 전체화면 ${JSON.stringify(a)}`);
  if (noFs) assert.ok(a.winfull && !a.fs, `전체화면이 막히면 창 전체 덮기 ${JSON.stringify(a)}`);
  assert.deepEqual(a.cover, [0, 0, a.w, a.h], `게임이 창 전체 ${JSON.stringify(a)}`);
  assert.equal(a.rot, H > W, `세로면 회전 ${JSON.stringify(a)}`);
  assert.equal(a.turned, false, '껍데기 돌려 보기와 겹쳐 돌리지 않는다');
  const sz = await size(page);
  assert.ok(sz.w > sz.h, `돌린 뒤 층은 가로 ${JSON.stringify(sz)}`);
  ok('(a) 창 전체·회전', JSON.stringify({ ...a, layer: sz }));

  // (b) 머리·아래 메뉴·신분증·유령 버튼 숨김
  const b = await chrome(page);
  assert.ok(!b.head && !b.nav && !b.mbar && !b.id && !b.fab && b.fieldfull, `숨김 ${JSON.stringify(b)}`);
  ok('(b) 창 머리·메뉴·신분증·유령 버튼 숨김', JSON.stringify(b));

  // (c) 버튼 9개 + 메뉴, 배치안대로
  const ids = await shownIds(page);
  const want = ['light', 'heavy', 'dodge', 'block', 'jump', 'unique', 'ult', 'interact', 'auto', 'menu'];
  assert.deepEqual([...ids].sort(), [...want].sort(), `버튼 ${ids}`);
  const R = await rects(page);
  const corner = (id) => Math.hypot(sz.w - R[id].x, sz.h - R[id].y);
  for (const id of want) if (id !== 'light') assert.ok(corner('light') < corner(id), `약공격이 오른쪽 아래 구석 (${id})`);
  assert.ok(R.light.r >= Math.max(...want.filter((i) => i !== 'light').map((i) => R[i].r)), '약공격이 가장 크다');
  assert.ok(Math.abs((R.auto.x + R.menu.x) / 2 - sz.w / 2) < sz.w * 0.05 && R.auto.y > sz.h * 0.8, `자동·메뉴 아래 가운데 ${JSON.stringify([R.auto, R.menu])}`);
  assert.ok(R.dodge.x < R.light.x && R.block.x < R.dodge.x && Math.abs(R.dodge.y - R.light.y) < R.light.r, '약 왼쪽 회피, 그 왼쪽 막기');
  assert.ok(R.jump.y < R.light.y && Math.abs(R.jump.x - R.light.x) < R.light.r * 0.5, '약 바로 위 점프');
  assert.ok(R.heavy.x < R.light.x && R.heavy.y < R.light.y, '약 왼쪽 위 강공격');
  assert.ok(R.unique.x < R.heavy.x && R.unique.y < R.heavy.y, '강 왼쪽 위 고유');
  assert.ok(R.ult.y < R.unique.y && R.ult.x > R.unique.x, '고유 오른쪽 위 필살');
  assert.ok(R.interact.y < R.jump.y && R.interact.x > R.ult.x, '오른쪽 위 조사');
  // 조사가 오른쪽 위 시각·잔고 글자(캔버스 720 기준 약 110px) 아래
  assert.ok(R.interact.y - R.interact.r > (sz.h / 720) * 100, '조사는 시각·잔고 아래');
  // 홈 바: 아래 가운데 버튼은 아래 끝에서 12px 이상
  assert.ok(sz.h - (R.auto.y + R.auto.r) >= 11.5, '자동 버튼은 아래 끝에서 띄움');
  ok('(c) 버튼 10개·배치', ids.join(','));
  if (!noFs) await page.screenshot({ path: `${shots}/${name}-hub.jpg`, type: 'jpeg', quality: 62 });

  // (d) 버튼 → 키
  await startLog(page);
  const L = await btnAt(page, 'light');
  await page.touchscreen.tap(L.x, L.y);
  await wait(150);
  let lg = await log(page);
  assert.ok(lg.some(([c, d]) => c === 'KeyQ' && d) && lg.some(([c, d]) => c === 'KeyQ' && !d), `약공격 = KeyQ 눌렀다 뗌 ${JSON.stringify(lg)}`);
  // 막기: 누르는 동안 KeyC
  const B = await btnAt(page, 'block');
  await touch(cdp, 'touchStart', [B]);
  await wait(250);
  assert.ok(await held(page, 'KeyC'), '막기 누르는 동안 KeyC');
  await touch(cdp, 'touchEnd', []);
  await wait(80);
  assert.ok(!(await held(page, 'KeyC')), '막기 떼면 풀림');
  // 고유 짧게 = KeyD 탭, 길게 = KeyS 누른 채
  const U = await btnAt(page, 'unique');
  await startLog(page);
  await page.touchscreen.tap(U.x, U.y);
  await wait(200);
  lg = await log(page);
  assert.ok(lg.some(([c, d]) => c === 'KeyD' && d) && lg.some(([c, d]) => c === 'KeyD' && !d) && !lg.some(([c]) => c === 'KeyS'), `고유 짧게 = KeyD 탭 ${JSON.stringify(lg)}`);
  await startLog(page);
  await touch(cdp, 'touchStart', [U]);
  await wait(500);
  assert.ok(await held(page, 'KeyS'), '고유 길게 = KeyS 누른 채');
  await touch(cdp, 'touchEnd', []);
  await wait(150);
  lg = await log(page);
  assert.ok(!(await held(page, 'KeyS')) && !lg.some(([c]) => c === 'KeyD'), `고유 길게 떼면 KeyS 풀림, KeyD 없음 ${JSON.stringify(lg)}`);
  // 회피 = ShiftLeft 짧게 (손가락을 오래 대고 있어도)
  const D = await btnAt(page, 'dodge');
  await startLog(page);
  await touch(cdp, 'touchStart', [D]);
  await wait(300);
  await touch(cdp, 'touchEnd', []);
  lg = await log(page);
  const sd = lg.find(([c, d]) => c === 'ShiftLeft' && d), su = lg.find(([c, d]) => c === 'ShiftLeft' && !d);
  assert.ok(sd && su && su[3] - sd[3] < 150, `회피 = ShiftLeft 짧게 ${JSON.stringify(lg)}`);
  // 미끄러져 옮겨 눌림: 약공격 → 점프
  const J = await btnAt(page, 'jump');
  await startLog(page);
  await touch(cdp, 'touchStart', [L]);
  await touch(cdp, 'touchMove', [J]);
  await wait(60);
  const slide = { q: await held(page, 'KeyQ'), sp: await held(page, 'Space') };
  await touch(cdp, 'touchEnd', []);
  assert.ok(!slide.q && slide.sp, `미끄러지면 옆 버튼 ${JSON.stringify(slide)}`);
  ok('(d) 약공격 KeyQ · 막기 KeyC 누른 채 · 고유 짧게 KeyD/길게 KeyS · 회피 ShiftLeft 짧게 · 미끄러짐', `회피 ${su[3] - sd[3]}ms`);
  await wait(600);

  // (e) 스틱: 왼쪽 절반을 누르고 끌면 axis 가 바뀌고 플레이어가 움직인다. 버튼 둘을 같이 눌러도 된다
  const s0 = await toScreen(page, sz.w * 0.22, sz.h * 0.7);
  const s1 = await toScreen(page, sz.w * 0.22 + 70, sz.h * 0.7);
  const x0 = await page.evaluate(() => window.__goeiEngine.world.player.x);
  await touch(cdp, 'touchStart', [{ ...s0, id: 1 }]);
  await touch(cdp, 'touchMove', [{ ...s1, id: 1 }]);
  await wait(100);
  const ax = await page.evaluate(() => window.__goeiInput.axis());
  await touch(cdp, 'touchStart', [{ ...s1, id: 1 }, { ...B, id: 2 }, { ...J, id: 3 }]);
  await wait(60);
  const multi = { c: await held(page, 'KeyC'), sp: await held(page, 'Space'), r: await held(page, 'ArrowRight') };
  await touch(cdp, 'touchMove', [{ ...s1, id: 1 }]);
  await wait(700);
  const x1 = await page.evaluate(() => window.__goeiEngine.world.player.x);
  await touch(cdp, 'touchEnd', []);
  await wait(100);
  assert.ok(ax.x > 0.3, `스틱 axis ${JSON.stringify(ax)}`);
  assert.ok(multi.c && multi.sp && multi.r, `스틱 + 버튼 2개 동시 ${JSON.stringify(multi)}`);
  assert.ok(x1 > x0 + 15, `플레이어가 움직임 ${x0}→${x1}`);
  assert.deepEqual(await page.evaluate(() => window.__goeiInput.axis()), { x: 0, y: 0 }, '손 떼면 axis 0');
  ok('(e) 스틱 axis·이동·여러 손가락', `axis ${ax.x.toFixed(2)} · x ${Math.round(x0)}→${Math.round(x1)}`);

  // (f) 캔버스 빈 곳 탭은 아무 입력도 안 만든다
  await startLog(page);
  const empty = await toScreen(page, sz.w * 0.62, sz.h * 0.3);
  const hitBtn = Object.values(await rects(page)).some((r) => r.shown && Math.hypot(sz.w * 0.62 - r.x, sz.h * 0.3 - r.y) < r.r * 1.2);
  assert.ok(!hitBtn, '빈 곳 고르기');
  await page.touchscreen.tap(empty.x, empty.y);
  const ctxm = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }); el.dispatchEvent(ev); return ev.defaultPrevented; }, [empty.x, empty.y]);
  await wait(150);
  lg = await log(page);
  assert.deepEqual(lg, [], `빈 곳 탭 = 입력 없음 ${JSON.stringify(lg)}`);
  assert.ok(ctxm, '길게 누르기 메뉴 막음');
  const css = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.gs')); return { ta: s.touchAction, us: s.userSelect || s.webkitUserSelect, ob: s.overscrollBehaviorY }; });
  assert.ok(css.ta === 'none' && css.us === 'none' && css.ob === 'none', `층 루트 터치 막기 ${JSON.stringify(css)}`);
  ok('(f) 빈 곳 탭 무시·길게 누르기·확대·선택·당겨서 뒤로 막기', JSON.stringify(css));

  // (g) 대사창 모드: 잼트리 책상에서 조사 → 임무 창
  await page.evaluate(() => { const w = window.__goeiEngine.world; const s = w.stage.current().spots.find((q) => q.id === 'jaemtri'); w.player.x = s.x; w.player.y = s.y; });
  await wait(300);
  const E = await btnAt(page, 'interact');
  await page.touchscreen.tap(E.x, E.y);
  await page.waitForSelector('[data-mission]', { state: 'visible', timeout: 5000 });
  await wait(300);
  const dIds = await shownIds(page);
  assert.deepEqual([...dIds].sort(), ['cancel', 'ok'], `대사창 모드 버튼 ${dIds}`);
  const R2 = await rects(page);
  assert.ok(Math.abs(R2.ok.x - R.light.x) < 2 && Math.abs(R2.cancel.y - R.jump.y) < 2, '선택 = 약공격 자리, 취소 = 점프 자리');
  if (!noFs && name === 'portrait') await page.screenshot({ path: `${shots}/${name}-dialog.jpg`, type: 'jpeg', quality: 62 });
  const selOf = () => page.evaluate(() => { const b = document.querySelector('.hq-kbsel'); return b ? (b.dataset.mission ?? b.dataset.act ?? b.textContent.trim()) : null; });
  // 스틱 아래로 한 번씩 → 고른 칸이 바뀐다
  const st0 = await toScreen(page, sz.w * 0.2, sz.h * 0.55);
  const stD = await toScreen(page, sz.w * 0.2, sz.h * 0.55 + 70);
  const flick = async (to) => { await touch(cdp, 'touchStart', [st0]); await touch(cdp, 'touchMove', [to]); await wait(80); await touch(cdp, 'touchEnd', []); await wait(80); };
  await flick(stD);
  const sel1 = await selOf();
  await flick(stD);
  const sel2 = await selOf();
  assert.ok(sel1 && sel2 && sel1 !== sel2, `스틱 ↓ 로 선택지 이동 ${sel1} → ${sel2}`);
  // 「선택」= Enter: 고른 칸이 눌린다 (임무 칸이면 .on)
  // 「선택」= Enter: 고른 칸이 눌린다 (임무 칸이면 .on, 다른 단추면 창 내용이 바뀐다)
  const talkText = () => page.evaluate(() => document.querySelector('.hq-talk')?.textContent ?? '');
  const pick = await page.evaluate(() => { const b = document.querySelector('.hq-kbsel'); return { mission: b?.dataset.mission ?? null }; });
  const t0 = await talkText();
  const O = await btnAt(page, 'ok');
  await page.touchscreen.tap(O.x, O.y);
  await wait(300);
  if (pick.mission) assert.ok(await page.evaluate((m) => document.querySelector(`[data-mission="${m}"]`)?.classList.contains('on'), pick.mission), `선택 = 고른 임무가 눌림 (${pick.mission})`);
  else assert.notEqual(await talkText(), t0, `선택 = 고른 단추가 눌림 (${sel2})`);
  // 선택지 글자 직접 탭
  const other = await page.evaluate(() => { const bs = [...document.querySelectorAll('[data-mission]')].filter((b) => !b.classList.contains('on')); const b = bs[0]; if (!b) return null; const r = b.getBoundingClientRect(); return { id: b.dataset.mission, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (other) {
    await page.touchscreen.tap(other.x, other.y);
    await wait(250);
    assert.ok(await page.evaluate((m) => document.querySelector(`[data-mission="${m}"]`)?.classList.contains('on'), other.id), '선택지 글자 직접 탭');
  }
  // 「취소」= Escape: 창이 닫히고 놀이 모드로
  // (임무를 고르면 설명 창이 이어서 뜬다: 취소는 Esc 처럼 한 단계씩 닫는다)
  const C = await btnAt(page, 'cancel');
  let cancels = 0;
  for (; cancels < 4 && (await page.evaluate(() => !!document.querySelector('.hq-talk'))); cancels++) {
    await page.touchscreen.tap(C.x, C.y);
    await wait(350);
  }
  assert.equal(await page.evaluate(() => !!document.querySelector('.hq-talk')), false, '취소로 창이 닫힘');
  assert.equal(await page.evaluate(() => !!document.querySelector('.mn.on')), false, '취소가 일시정지를 열지 않는다');
  assert.deepEqual((await shownIds(page)).sort(), [...want].sort(), `창을 닫으면 놀이 모드 ${await page.evaluate(() => [...document.querySelectorAll('.hq-talk, .goei-engine-elev:not([hidden]), .gt-bar[data-open], .mn.on')].map((e) => e.className + ':' + e.textContent.slice(0, 80)).join(' | '))}`);
  ok('(g) 대사창 모드 (선택·취소만, 스틱 ↑↓, 선택 = Enter, 글자 직접 탭, 취소 = 닫기)', `${sel1} → ${sel2}${pick.mission ? ` · 선택 ${pick.mission}` : ''}${other ? ` · 탭 ${other.id}` : ''} · 취소 ${cancels}번`);
  // 메뉴 창(일시정지)도 대사창 모드
  await page.touchscreen.tap(...Object.values(await btnAt(page, 'menu')));
  await page.waitForSelector('.mn.on h2');
  assert.deepEqual((await shownIds(page)).sort(), ['cancel', 'ok'], '일시정지 메뉴 = 대사창 모드');
  await page.touchscreen.tap(...Object.values(await btnAt(page, 'cancel')));
  await page.waitForFunction(() => !document.querySelector('.mn.on'), null, { timeout: 3000 });
  ok('(g) 일시정지 메뉴도 대사창 모드, 취소 = 닫기');

  // (h) 입력칸 초점 → 버튼·스틱 전부 숨김 (아이폰처럼 돌려 보이면 바로 세운 입력 상자)
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-in'; i.style.cssText = 'position:absolute;left:40%;top:40%;z-index:99;font-size:16px'; document.querySelector('.goei-engine').append(i); i.focus(); });
  await wait(200);
  const kp = await page.evaluate(() => ({ hidden: document.querySelector('.tp').classList.contains('hide'), upright: !!document.querySelector('body > .gx-upright'), active: document.activeElement?.closest('.gx-upright') ? 'upright' : document.activeElement?.id }));
  assert.ok(kp.hidden, `입력칸 초점이면 버튼 숨김 ${JSON.stringify(kp)}`);
  if (H > W) assert.ok(kp.upright && kp.active === 'upright', `돌려 보이는 중: 입력칸을 바로 세워 띄움 ${JSON.stringify(kp)}`);
  if (H > W) {
    await page.evaluate(() => { const i = document.querySelector('.gx-upright input'); i.value = '안녕'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.evaluate(() => document.getElementById('tmp-in').value), '안녕', '바로 세운 상자 글이 원래 칸으로');
    await page.evaluate(() => document.querySelector('.gx-upright [data-up="close"]').click());
  }
  await page.evaluate(() => { document.activeElement?.blur(); document.getElementById('tmp-in')?.remove(); });
  await wait(200);
  assert.ok(await page.evaluate(() => !document.querySelector('.tp').classList.contains('hide') && !document.querySelector('.gx-upright')), '초점이 빠지면 복귀');
  ok('(h) 키패드 모드', JSON.stringify(kp));

  // (i) AUTO: 본부(싸움 없음)에서는 흐림 → 대련 무대에서 적이 있으면 주인공이 스스로 싸운다, 스틱을 만지면 멈춤
  assert.ok((await rects(page)).auto.off, '본부에서 AUTO 흐림');
  await page.evaluate(() => window.__goeiEngine.start_new('spar'));
  await page.waitForFunction(() => window.__goeiEngine.world?.stage?.id === 'spar' && !window.__goeiTouch.rects().auto.off, null, { timeout: 15000 });
  await wait(800);
  const A = await btnAt(page, 'auto');
  await page.touchscreen.tap(A.x, A.y);
  await wait(100);
  assert.ok(await page.evaluate(() => window.__goeiAuto.on && document.querySelector('.tp').classList.contains('tp-auto-on')), 'AUTO 켜짐 (안이 청록)');
  const p0 = await page.evaluate(() => ({ x: window.__goeiEngine.world.player.x, n: window.__goeiAuto.last.presses }));
  // 틱 수십 번 뒤 두뇌가 공격 버튼(약·강·기술·사격·충전)을 누른다
  await page.waitForFunction(() => { const c = window.__goeiAuto.last.counts; return (c.light ?? 0) + (c.heavy ?? 0) + (c.skill ?? 0) + (c.shoot ?? 0) + (c.charge ?? 0) > 0; }, null, { timeout: 20000 });
  const p1 = await page.evaluate(() => ({ x: window.__goeiEngine.world.player.x, n: window.__goeiAuto.last.presses, t: window.__goeiAuto.last.tactic, c: JSON.stringify(window.__goeiAuto.last.counts) }));
  // 스틱을 만지는 동안 자동은 멈춘다
  const m0 = await toScreen(page, sz.w * 0.2, sz.h * 0.7);
  const m1 = await toScreen(page, sz.w * 0.2 - 60, sz.h * 0.7);
  await touch(cdp, 'touchStart', [m0]);
  await touch(cdp, 'touchMove', [m1]);
  await wait(200);
  const h0 = await page.evaluate(() => window.__goeiAuto.last.presses);
  await wait(900);
  const hm = await page.evaluate(() => ({ manual: window.__goeiAuto.last.manual, n: window.__goeiAuto.last.presses }));
  await touch(cdp, 'touchEnd', []);
  assert.ok(hm.manual && hm.n === h0, `스틱을 만지면 자동 멈춤 ${JSON.stringify({ h0, ...hm })}`);
  await page.waitForFunction(() => !window.__goeiAuto.last.manual, null, { timeout: 4000 });
  ok('(i) AUTO (대련)', `누름 ${p0.n}→${p1.n} ${p1.c} · 전술 ${p1.t} · x ${Math.round(p0.x)}→${Math.round(p1.x)} · 스틱 중 멈춤`);
  await page.touchscreen.tap(A.x, A.y);
  await wait(100);
  assert.equal(await page.evaluate(() => window.__goeiAuto.on), false, 'AUTO 끔');

  // (j) 필드 나가기 → 머리·메뉴·유령 버튼 복귀, 전체화면 해제
  await exitField(page);
  const j = await chrome(page);
  assert.ok(j.head && !j.fieldfull && j.fab && !j.fs, `나간 뒤 복귀 ${JSON.stringify(j)}`);
  assert.ok(await page.evaluate(() => !document.querySelector('.gx-game.gx-winfull, .gx-game.gx-rot, .gx-game.gx-phone')), '창 덮기·회전 해제');
  ok('(j) 필드 나가기 뒤 복귀', JSON.stringify(j));

  // (k) 열고 닫기 5회 뒤 리스너·노드 증가 0 (첫 입장 뒤 상태와 비교)
  const first = { nodes: await page.evaluate(() => document.querySelectorAll('*').length), listeners: await listenerCount(cdp) };
  for (let i = 0; i < 5; i++) {
    await openField(page);
    await enterGame(page);
    await enterHub(page);
    await exitField(page);
  }
  await page.evaluate(() => window.gc?.());
  const after = { nodes: await page.evaluate(() => document.querySelectorAll('*').length), listeners: await listenerCount(cdp) };
  assert.ok(after.listeners - first.listeners <= 0, `리스너 증가 ${JSON.stringify({ before, first, after })}`);
  assert.ok(after.nodes - first.nodes <= 0, `노드 증가 ${JSON.stringify({ before, first, after })}`);
  ok('(k) 열고 닫기 5회 뒤 증가 0', JSON.stringify({ first, after }));
  assert.deepEqual(errors, [], `오류 ${errors}`);
  await page.close();
}
await browser.close();
console.log('qc-mobile-browser 통과');
