// 상황판 창 둘레 기기 틀(설정 → 화면 「외부 프레임」, src/ui/frame.ts) 시험.
// - 기본값 일반 태블릿: .gx[data-frame=tablet] .gx-frame[data-kind=tablet], 창(.gx-panel) 폭은 틀이 없을 때와 같다 (1600×1000)
// - 설정에서 전술/없음으로 바꾸면 바뀌고, 새로 고침(다시 boot, 저장소 유지) 뒤에도 유지
// - 폰(390×844)·좁은 창(1000×900)·필드 전체화면(document.fullscreenElement 흉내)에서는 틀이 없다. 좁은 창은 설정 줄에 안내
// - 설정 창(.gw) 안에는 틀이 없다. 전술 볼트 SVG 의 gradient id 가 겹치지 않는다. 글자는 LINK·STBY·REC 뿐
// 사용법: node tests/qc-frame-browser.mjs <fixture.json>
import assert from 'node:assert/strict';
import { boot, clickSel, closeEditor, launch, loadFixture, openEditor, openWin, prefsOf, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const browser = await launch();
const started = () => ({ message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } });
const PC = { width: 1600, height: 1000, touch: false };
const NARROW = { width: 1000, height: 900, touch: false };

/** 창 열기 + (아이콘이 없어 저절로 뜨는) 설정 창 닫기 */
async function open(page) {
  await openWin(page);
  await page.waitForSelector('.gx-tabhead');
  await sleep(200);
  if (await page.evaluate(() => { const g = document.querySelector('.gw'); return !!g && !g.hidden; })) await closeEditor(page, true);
}
const state = (page) => page.evaluate(() => {
  const g = document.querySelector('.gx');
  const f = g.querySelector('.gx-frame');
  const p = g.querySelector('.gx-panel');
  return { frame: g.dataset.frame, hidden: g.dataset.frameHidden ?? '', kind: f?.dataset.kind ?? null, inFrame: !!f && f.contains(p), panelW: p.getBoundingClientRect().width, panelH: p.getBoundingClientRect().height, gwFrame: !!document.querySelector('.gw .gx-frame') };
});
async function pick(page, kind) {
  await openEditor(page, 'set:screen');
  await clickSel(page, `.gw [data-action="set-frame"][data-value="${kind}"]`);
  await sleep(300);
  await page.waitForFunction(() => !document.querySelector('.gw [data-action="set-frame"][disabled]'));
  const note = await page.evaluate(() => [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label > b')?.textContent.startsWith('외부 프레임'))?.textContent ?? '');
  const gwFrame = !!(await page.$('.gw .gx-frame'));
  await closeEditor(page, true);
  await sleep(100);
  return { note, gwFrame };
}

let prefsSaved;
// ── 1. PC 1600×1000: 기본값 일반, 창 폭 불변, 전술·없음 전환, 설정 창엔 틀 없음, SVG id ──
{
  const { page, errors } = await boot(browser, fx, started(), PC);
  await open(page);
  let s = await state(page);
  assert.equal(s.frame, 'tablet', '기본값은 일반 태블릿');
  assert.equal(s.kind, 'tablet');
  assert.ok(s.inFrame, '.gx-frame 이 .gx-panel 을 감싼다');
  assert.ok(await page.$('.gx[data-frame="tablet"] .gx-frame[data-kind="tablet"]'));
  assert.equal(s.hidden, '', '1600 폭에서는 숨김 아님');
  const tabletW = s.panelW;
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gx')).padding), '4px', '틀을 켜면 바깥 여백 4px');
  // 없음
  let r = await pick(page, 'none');
  assert.ok(!r.gwFrame, '설정 창 안에는 틀이 없다');
  assert.ok(!r.note.includes('숨겼어요'), '넓은 창에서는 숨김 안내 없음');
  s = await state(page);
  assert.equal(s.frame, 'none');
  assert.equal(await page.$('.gx-frame'), null, '없음이면 .gx-frame 없음');
  assert.equal(s.panelW, tabletW, '창 폭은 틀이 있을 때와 같다 (틀은 창 바깥으로만)');
  assert.equal(s.panelW, 1280, '시작 뒤 창 최대 폭');
  assert.equal((await prefsOf(page)).frame, 'none');
  // 전술
  r = await pick(page, 'tactical');
  s = await state(page);
  assert.equal(s.kind, 'tactical');
  assert.ok(s.inFrame);
  assert.equal(s.panelW, tabletW, '전술도 창 폭 그대로');
  assert.ok(s.panelH >= 600, `전술 틀일 때 창 높이 ${s.panelH} ≥ 600`);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gx')).padding), '6px', '전술은 범퍼 돌출분만큼 바깥 여백 6px');
  // 창 테두리는 틀 안에서 지운다(검은 띠와 창 사이 회색 선 방지). 범퍼 바닥(-6px)은 1000px 높이에서 잘리지 않는다
  const edge = await page.evaluate(() => ({ border: getComputedStyle(document.querySelector('.gx-frame > .gx-panel')).borderTopColor, bumpTop: document.querySelector('.gxf-bump.tl.base').getBoundingClientRect().top, bumpBottom: document.querySelector('.gxf-bump.bl.base').getBoundingClientRect().bottom }));
  assert.equal(edge.border, 'rgba(0, 0, 0, 0)', '틀 안 창 테두리는 투명');
  assert.ok(edge.bumpTop >= 0 && edge.bumpBottom <= 1000, `범퍼가 화면 안에 (${edge.bumpTop}~${edge.bumpBottom})`);
  const svg = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('.gx-frame [id]')].map((e) => e.id);
    const screws = document.querySelectorAll('.gx-frame .gxf-screw').length;
    const text = [...document.querySelectorAll('.gx-frame > :not(.gx-panel)')].map((e) => e.textContent.replace(/\s+/g, '')).join('');
    const leds = [...document.querySelectorAll('.gxf-leds b')].map((b) => getComputedStyle(b).backgroundColor);
    return { ids, dup: ids.filter((id, i) => ids.indexOf(id) !== i), screws, text, leds };
  });
  assert.deepEqual(svg.dup, [], 'SVG gradient id 중복 없음');
  assert.equal(svg.ids.length, 12, '볼트 4개 × gradient 3');
  assert.ok(svg.ids.every((id) => id.startsWith('gxf-')), 'id 앞에 gxf-');
  assert.equal(svg.screws, 4);
  assert.equal(svg.text, 'LINKSTBYREC', '글자는 LINK·STBY·REC 뿐');
  assert.deepEqual(svg.leds, ['rgb(94, 234, 212)', 'rgb(58, 47, 18)', 'rgb(255, 122, 107)'], 'LED: LINK 민트 켜짐·STBY 꺼짐·REC 산호 켜짐');
  // 일반으로 돌아오면 저장값은 비운다 (기본값)
  await pick(page, 'tablet');
  assert.equal((await prefsOf(page)).frame, undefined, '일반 태블릿은 기본값이라 저장 안 함');
  assert.equal((await state(page)).kind, 'tablet');
  // 다시 전술로 두고 저장값을 들고 간다
  await pick(page, 'tactical');
  prefsSaved = await page.evaluate(() => window.__store['p:goei:prefs']);
  assert.equal(JSON.parse(prefsSaved).frame, 'tactical');
  // 필드 전체화면 흉내: document.fullscreenElement 가 생기면 틀을 걷고, 풀리면 다시 그린다
  await page.evaluate(() => { window.__fs = document.body; Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => window.__fs }); document.dispatchEvent(new Event('fullscreenchange')); });
  await sleep(100);
  assert.equal((await state(page)).frame, 'none', '전체화면이면 틀 없음');
  assert.equal(await page.$('.gx-frame'), null);
  await page.evaluate(() => { window.__fs = null; document.dispatchEvent(new Event('fullscreenchange')); });
  await sleep(100);
  assert.equal((await state(page)).kind, 'tactical', '전체화면이 풀리면 다시');
  // 창을 좁히면 틀만 숨고 창은 그대로, 넓히면 다시
  await page.setViewportSize({ width: 1000, height: 900 });
  await sleep(200);
  s = await state(page);
  assert.equal(s.frame, 'none');
  assert.equal(s.hidden, '1', '좁은 창: 숨김 표시');
  assert.equal(s.panelW, 1000 - 28, '좁은 창: 창은 바깥 여백 14px 만 빼고 가득');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await sleep(200);
  assert.equal((await state(page)).kind, 'tactical', '넓히면 다시');
  assert.deepEqual(errors, [], 'PC 오류 없음');
  await page.close();
}
// ── 2. 새로 고침(다시 boot, 저장소 유지) 뒤에도 전술 ──
{
  const { page, errors } = await boot(browser, fx, started(), PC, { store: { 'p:goei:prefs': prefsSaved } });
  await open(page);
  const s = await state(page);
  assert.equal(s.kind, 'tactical', '새로 고침 뒤에도 전술');
  assert.ok(s.inFrame);
  // 시작 전 화면(.pre)에도 같은 틀
  const chat0 = { message: [], scriptstate: {} };
  await page.evaluate((c) => { window.__chat = c; }, chat0);
  await page.evaluate(() => document.querySelector('.gx [data-action="close"]')?.click());
  await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
  await openWin(page);
  await page.waitForSelector('.gx-fac');
  const pre = await page.evaluate(() => ({ kind: document.querySelector('.gx-frame')?.dataset.kind, pre: document.querySelector('.gx-frame')?.classList.contains('pre'), panelW: document.querySelector('.gx-panel').getBoundingClientRect().width }));
  assert.equal(pre.kind, 'tactical', '시작 전 화면에도 틀');
  assert.ok(pre.pre, '시작 전 창 폭(1024) 기준 틀');
  assert.equal(pre.panelW, 1024, '시작 전 창 폭 그대로');
  assert.deepEqual(errors, []);
  await page.close();
}
// ── 3. 폰(390×844): 설정이 전술이어도 틀 없음, 안내도 없음 ──
{
  const { page, errors } = await boot(browser, fx, started(), 'phone', { store: { 'p:goei:prefs': prefsSaved } });
  await open(page);
  const s = await state(page);
  assert.equal(s.frame, 'none', '폰은 틀 없음');
  assert.equal(await page.$('.gx-frame'), null);
  assert.equal(s.hidden, '', '폰은 숨김 안내도 없음');
  assert.deepEqual(errors, []);
  await page.close();
}
// ── 4. 좁은 창(1000×900): 틀만 숨고 설정 줄에 안내 ──
{
  const { page, errors } = await boot(browser, fx, started(), NARROW, { store: { 'p:goei:prefs': prefsSaved } });
  await open(page);
  const s = await state(page);
  assert.equal(s.frame, 'none');
  assert.equal(await page.$('.gx-frame'), null, '좁으면 .gx-frame 없음');
  assert.equal(s.hidden, '1');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gx')).padding), '14px', '틀이 없으면 바깥 여백 14px');
  await openEditor(page, 'set:screen');
  const row = await page.evaluate(() => [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label > b')?.textContent.startsWith('외부 프레임'))?.textContent ?? '');
  assert.ok(row.includes('지금 창 폭이 좁아 프레임을 숨겼어요'), `설정 줄 안내: ${row.slice(0, 120)}`);
  assert.ok(row.includes('이 기기'), '「이 기기」 배지');
  assert.equal(await page.$('.gw .gx-frame'), null);
  // 「없음」을 고르면 숨김 안내도 사라진다 (원한 적이 없으니)
  await clickSel(page, '.gw [data-action="set-frame"][data-value="none"]');
  await sleep(300);
  const row2 = await page.evaluate(() => [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.ps-label > b')?.textContent.startsWith('외부 프레임'))?.textContent ?? '');
  assert.ok(!row2.includes('숨겼어요'), '없음이면 안내 없음');
  assert.equal((await state(page)).hidden, '');
  await closeEditor(page, true);
  assert.deepEqual(errors, []);
  await page.close();
}
await browser.close();
console.log('qc-frame: 통과');
