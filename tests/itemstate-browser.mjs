// 물건 구조 고침 (2026-11-12) 브라우저 시험·사진: 정장 사례(두고 옴) · 수집기 그림 · 손전등 갈래 · 버림 → 다시 줍기 · 기록 표시.
// 갱신기 응답은 가짜다 (실제 모델을 부르지 않는다): core 의 applyItemChanges 에 「모델이 보냈을 변화」를 넣어 채팅 상태를 만들고 화면을 띄운다.
// 사용: node tests/itemstate-browser.mjs <사진 폴더> [core.mjs 경로] [--before]
//   --before = 고치기 전 빌드로 같은 장면을 찍기만 한다 (확인 없음). 옛 지침에는 그림 말을 다시 고르라는 말이 없으므로 그림 말 없이 보낸다
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { boot, closeEditor, launch, loadFixture, openEditor, openWin, setInput, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const before = process.argv.includes('--before');
const out = args[0] ?? '.scratch/itemstate';
const I = await import(args[1] ? pathToFileURL(resolve(args[1])).href : new URL('../dist-test/core.mjs', import.meta.url).href);
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(out, { recursive: true });

const msg = (role, data, chatId) => ({ role, data, chatId });
const board = (t) => `\n[▣|2025.05.10|${t}|☀️|18°C|백일몽 본사|퇴근]`;
const M1 = [msg('user', '출근', 'u1'), msg('char', `정장을 받아 입고 손전등을 챙겼다.${board('09:00 AM')}`, 'c1')];
const M2 = [...M1, msg('user', '현장을 정리하고 돌아간다', 'u2'), msg('char', `정장은 탈의실 3번 사물함에 넣고 문을 잠갔다. 수집기는 눈금 끝까지 검붉은 꿈결로 차 있었다.${board('06:10 PM')}`, 'c2')];
const M3 = [...M2, msg('user', '손전등을 다시 줍는다', 'u3'), msg('char', `바닥에 버렸던 손전등을 다시 주워 들었다.${board('06:30 PM')}`, 'c3')];
const keys = (m) => m.map((x) => x.chatId);
const aliveOf = (m) => new Set(keys(m));
const ch = (o) => ({ desc: '', effect: '', quote: 'q', ...o });

// 처음: 본문에서 얻은 정장(장착)·손전등(모델은 지침대로 usable: true, equip: none 을 적는다) + 시작 소지품 빈 꿈결 수집기
let s0 = { list: [], log: [] };
s0 = I.addItem(s0, aliveOf(M1), { name: '사내용 정장 세트', desc: '검은색 재킷과 바지 정장 및 셔츠 세트', equip: 'gear', icon: '옷/정장/suit', weight: 1.2, from: 'story', anchor: 'c1', quote: '정장을 받아 입고' });
s0 = I.equipItem(s0, aliveOf(M1), s0.list[0].id);
s0 = I.addItem(s0, aliveOf(M1), { name: '손전등', desc: '건전지 넉넉', use: true, icon: '기기/손전등/flashlight', weight: 0.3, from: 'story', anchor: 'c1', quote: '손전등을 챙겼다' });
s0 = I.addItem(s0, aliveOf(M1), { name: '빈 꿈결 수집기', desc: '괴담을 빠져나오거나 끝내면 꿈결로 차는 주사기 모양 눈금 실린더', icon: 'dream collector', weight: 0.2, from: 'manual', anchor: '' });
// 둘째 응답 뒤 갱신기가 보냈을 변화 (사용자가 겪은 꼴: 정장은 설명만 고치고 equip: none)
const turn2 = [
  ch({ anchor: 'c2', name: '사내용 정장 세트', action: 'update', desc: '탈의실 3번 사물함에 보관해 둔 검은색 정장 세트', equip: null, use: false, quote: '정장은 탈의실 3번 사물함에 넣고 문을 잠갔다' }),
  ch({ anchor: 'c2', name: '빈 꿈결 수집기', action: 'update', desc: '검붉은 꿈결이 눈금 끝까지 찬 실린더', ...(before ? {} : { icon: '꿈결 수집기 A등급' }), quote: '수집기는 눈금 끝까지 검붉은 꿈결로 차 있었다' }),
];
const s2 = I.applyItemChanges(s0, aliveOf(M2), turn2, { order: keys(M2) });

const state = (items, extra = {}) => ({ $st_faction: 'F00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_items: JSON.stringify({ list: items.list, log: items.log }), ...extra });
const browser = await launch();
const errorsAll = [];
const result = {};
for (const vp of ['pc', 'phone']) {
  const open = async (messages, items) => {
    const size = vp === 'pc' ? { width: 1280, height: 860, touch: false, scale: 2 } : { width: 390, height: 844, touch: true, scale: 2 };
    const { page, errors } = await boot(browser, fx, { message: messages, scriptstate: state(items) }, size, { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });
    await openWin(page); await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    const click = async (sel) => { await page.evaluate((q) => document.querySelector(q)?.click(), sel); await sleep(300); };
    await click('[data-action="tab"][data-value="items"], [data-action="nav-tab"][data-value="items"]');
    await click('[data-action="items-sub"][data-value="items"]');
    await sleep(500);
    const shot = (n) => page.screenshot({ path: `${out}/${vp}_${n}.png` });
    const view = () => page.evaluate(() => ({
      grid: [...document.querySelectorAll('.it-grid .it-c:not(.empty) > b')].map((b) => b.textContent),
      slots: [...document.querySelectorAll('.it-eqslots .it-slot:not(.empty)')].map((b) => b.getAttribute('aria-label')),
      weight: document.querySelector('.it-wgt b')?.textContent ?? '',
      btns: [...document.querySelectorAll('.it-pop .it-btns button')].map((b) => b.textContent.trim()),
      log: [...document.querySelectorAll('.it-log .gx-wt-row')].map((r) => r.querySelector('.gx-wt-memo')?.textContent.replace(/\s+/g, ' ').trim()),
      pics: Object.fromEntries([...document.querySelectorAll('.it-grid .it-c:not(.empty), .it-eqslots .it-slot:not(.empty)')].map((c) => [c.querySelector('b')?.textContent ?? c.getAttribute('aria-label'), (c.querySelector('.it-ic img')?.getAttribute('src') ?? '').length])),
      src: Object.fromEntries([...document.querySelectorAll('.it-grid .it-c:not(.empty)')].map((c) => [c.querySelector('b')?.textContent, c.querySelector('.it-ic img')?.getAttribute('src') ?? ''])),
    }));
    const idOf = (name) => page.evaluate((n) => [...document.querySelectorAll('.it-c, .it-slot')].find((c) => (c.querySelector('b')?.textContent ?? c.getAttribute('aria-label') ?? '').startsWith(n))?.getAttribute('data-value') ?? '', name);
    return { page, errors, click, shot, view, idOf };
  };
  const packUrl = (file) => { const p = JSON.parse(distPack('goei-data-items')); return `data:image/webp;base64,${p.icons[file]}`; };

  // ① 처음
  let w = await open(M1, s0);
  await w.shot('1_처음');
  const v1 = await w.view();
  await w.click(`[data-action="items-open"][data-value="${await w.idOf('손전등')}"]`);
  await w.shot('2_손전등_팝업');
  const torch = await w.view();
  errorsAll.push(...w.errors.map((e) => `[${vp}] ${e}`));
  await w.page.close();

  // ② 둘째 응답 뒤: 정장은 사물함에, 수집기는 참
  w = await open(M2, s2);
  await w.shot('3_둘째_응답_뒤');
  const v2 = await w.view();
  const suitId = await w.idOf('사내용 정장 세트');
  if (suitId) { await w.click(`[data-action="items-open"][data-value="${suitId}"]`); await w.shot('4_정장_팝업'); await w.click('[data-action="items-close"]'); }
  const suitPop = suitId ? await w.view() : null;
  await w.click('[data-action="items-view"][data-value="log"]');
  await w.shot('5_기록');
  const v2log = await w.view();
  await w.click('[data-action="items-view"][data-value="grid"]');
  // ③ 손전등을 사용자가 버린다 (화면 단추) → 다음 응답에서 다시 줍는다
  await w.click(`[data-action="items-open"][data-value="${await w.idOf('손전등')}"]`);
  await w.click('[data-action="items-drop-ask"]');
  await w.click('[data-action="items-drop"]');
  await sleep(400);
  await w.shot('6_손전등_버림');
  const v3 = await w.view();
  const dropped = I.readItems(await w.page.evaluate(() => window.__chat.scriptstate));
  errorsAll.push(...w.errors.map((e) => `[${vp}] ${e}`));
  await w.page.close();
  // 같은 응답(c2)을 근거로 한 new 는 안 되살아나야 하고, 뒤 응답(c3)을 근거로 한 new 는 같은 물건으로. 모델은 판정 칸 없이 보낸다
  const same = I.applyItemChanges(dropped, aliveOf(M2), [ch({ anchor: 'c2', name: '손전등', action: 'new', desc: '바닥에 있던 손전등' })], { order: keys(M2) });
  const again = I.applyItemChanges(dropped, aliveOf(M3), [ch({ anchor: 'c3', name: '손전등', action: 'new', desc: '다시 주운 손전등', quote: '바닥에 버렸던 손전등을 다시 주워 들었다' })], { order: keys(M3) });
  w = await open(M3, again);
  await w.shot('7_다시_주움');
  const v4 = await w.view();
  await w.click(`[data-action="items-open"][data-value="${await w.idOf('손전등')}"]`);
  await w.shot('8_다시_주운_손전등_팝업');
  const torch2 = await w.view();
  errorsAll.push(...w.errors.map((e) => `[${vp}] ${e}`));
  await w.page.close();

  // ④ 설정 줄: 판정 표(접힘) · 두고 옴 말 · 장착 풀기 말 — 기본값이 칸에 들어 있고, 고치면 저장되고, 기본값과 같으면 저장 안 함. 조작 높이 34px
  if (!before) {
    const size = vp === 'pc' ? { width: 1280, height: 860, touch: false, scale: 2 } : { width: 390, height: 844, touch: true, scale: 2 };
    const { page, errors } = await boot(browser, fx, { message: M1, scriptstate: state(s0) }, size);
    await openWin(page); await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    await openEditor(page, 'set:items'); await sleep(300);
    const ss = () => page.evaluate(() => window.__chat.scriptstate);
    const L = '.gw [data-change="set-items-left-words"]'; const O = '.gw [data-change="set-items-off-words"]';
    const val = (q) => page.evaluate((q) => document.querySelector(q)?.value ?? null, q);
    assert.equal(await val(L), '두고, 놓고, 보관해, 맡겨, 반납, 압수, 버리고, 잃어', `[${vp}] 두고 옴 말 기본값이 칸에`);
    assert.equal(await val(O), '벗어, 벗고, 내려놓, 풀어');
    await setInput(page, L, '두고, 놓고, 보관해, 맡겨, 반납, 압수, 버리고, 잃어, 맡기고'); await sleep(400);
    assert.equal((await ss()).$it_left_words, '두고, 놓고, 보관해, 맡겨, 반납, 압수, 버리고, 잃어, 맡기고');
    await setInput(page, L, ''); await sleep(400);
    assert.ok(!(await ss()).$it_left_words, '비우면 기본값'); assert.equal(await val(L), '두고, 놓고, 보관해, 맡겨, 반납, 압수, 버리고, 잃어');
    // 판정 표: 접혀 있다 → 펴서 한 칸 고침 → 저장 → 기본값으로
    assert.equal(await page.evaluate(() => document.querySelector('.gw details[data-keep="items-rules"]')?.open), false, '판정 표는 접혀 있다');
    assert.equal(await page.evaluate(() => document.querySelector('.gw details[data-keep="items-rules"] .adv-count')?.textContent), '14줄');
    await page.evaluate(() => { const d = document.querySelector('.gw details[data-keep="items-rules"]'); d.open = true; d.dispatchEvent(new Event('toggle')); d.scrollIntoView({ block: 'start' }); }); await sleep(300);
    await page.screenshot({ path: `${out}/${vp}_9_설정_판정표.png` });
    const cell = (k) => `.gw [data-change="set-items-rules-cell"][data-key="${k}"]`;
    assert.deepEqual([await val(cell('12:a')), await val(cell('12:b'))], ['도구', '사용']);
    await setInput(page, cell('12:b'), '장비·사용'); await sleep(400);
    assert.ok(String((await ss()).$it_rules).includes('도구 → 장비·사용'), `[${vp}] 판정 표 저장: ${(await ss()).$it_rules}`);
    await page.evaluate(() => document.querySelector('.gw [data-action="set-items-rules-reset"]')?.click()); await sleep(400);
    assert.ok(!(await ss()).$it_rules, '기본값으로');
    // 조작 높이 34px · 가로 넘침 없음
    const hs = await page.evaluate(() => [...document.querySelectorAll('.gw [data-change="set-items-left-words"], .gw [data-change="set-items-off-words"], .gw details[data-keep="items-rules"] input, .gw details[data-keep="items-rules"] .gx-mini')].map((e) => Math.round(e.getBoundingClientRect().height * 10) / 10).filter((h) => h > 0));
    assert.ok(hs.length > 10 && hs.every((h) => Math.abs(h - 34) <= 0.6), `[${vp}] 조작 높이: ${[...new Set(hs)]}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '가로 넘침 없음');
    await page.evaluate(() => document.querySelector('.gw [data-change="set-items-left-words"]')?.scrollIntoView({ block: 'center' })); await sleep(300);
    await page.screenshot({ path: `${out}/${vp}_10_설정_말.png` });
    errorsAll.push(...errors.map((e) => `[${vp}] ${e}`));
    await page.close();
  }
  result[vp] = { v1: { grid: v1.grid, slots: v1.slots, weight: v1.weight }, torch: torch.btns, v2: { grid: v2.grid, slots: v2.slots, weight: v2.weight }, suitPop: suitPop?.btns ?? null, log: v2log.log, v3: v3.grid, same: I.liveItems(same, aliveOf(M2)).map((e) => e.name), v4: v4.grid, torch2: torch2.btns };
  if (before) continue;
  const P = JSON.parse(distPack('goei-data-items'));
  const fileOf = (name) => P.table.find((r) => r.k[0] === name)?.f;
  // 손전등 갈래: 기기 → 사용 (전수검사 11-13 승인: 도구·기기는 사용만)
  assert.ok(torch.btns.includes('사용') && !torch.btns.includes('장착'), `[${vp}] 손전등 팝업 단추: ${torch.btns}`);
  // 정장 사례: 격자·장착 칸에서 빠지고 무게가 줄고, 기록에 「없어짐 · 두고 옴」
  assert.ok(v1.slots.some((x) => x.startsWith('사내용 정장 세트')), `[${vp}] 처음엔 장착 칸에`);
  assert.ok(!v2.grid.includes('사내용 정장 세트') && !v2.slots.some((x) => x.startsWith('사내용 정장 세트')), `[${vp}] 정장이 소지품에서 빠짐: ${JSON.stringify(v2)}`);
  assert.equal(Number(v1.weight) - Number(v2.weight), 1.2, `[${vp}] 무게 ${v1.weight} → ${v2.weight}`);
  assert.ok(v2log.log.some((t) => t.includes('사내용 정장 세트') && t.includes('없어짐') && t.includes('두고 옴')), `[${vp}] 기록: ${v2log.log.join(' / ')}`);
  // 수집기: 이름에서 「빈」이 떼이고, 갱신기가 고른 그림
  assert.ok(v2.grid.includes('꿈결 수집기') && !v2.grid.includes('빈 꿈결 수집기'), `[${vp}] 수집기 이름: ${v2.grid}`);
  assert.equal(v1.src['빈 꿈결 수집기'], packUrl(fileOf('빈 꿈결 수집기')), `[${vp}] 처음엔 빈 그림`);
  assert.equal(v2.src['꿈결 수집기'], packUrl(fileOf('꿈결 수집기 A등급')), `[${vp}] 찬 뒤엔 갱신기가 고른 그림`);
  // 버림 → 다시 줍기
  assert.ok(!v3.grid.includes('손전등'), `[${vp}] 버린 뒤 격자: ${v3.grid}`);
  assert.deepEqual(result[vp].same.includes('손전등'), false, `[${vp}] 같은 응답 근거로는 안 되살아남`);
  assert.ok(v4.grid.includes('손전등'), `[${vp}] 다시 주움: ${v4.grid}`);
  assert.ok(torch2.btns.includes('사용') && !torch2.btns.includes('장착'), `[${vp}] 다시 주운 손전등도 갈래 그대로: ${torch2.btns}`);
  assert.equal(again.list.filter((e) => e.name === '손전등').length, 1, '새 줄이 생기지 않음');
  assert.equal(await Promise.resolve(errorsAll.length), 0, errorsAll.join('\n'));
}
await browser.close();
console.log(JSON.stringify(result, null, 1));
if (errorsAll.length) { console.error(errorsAll.join('\n')); process.exit(1); }
console.log(before ? '(고치기 전 사진만)' : 'itemstate-browser OK');
