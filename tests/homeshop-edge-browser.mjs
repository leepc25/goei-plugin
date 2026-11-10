// 망상홈쇼핑 모서리 확인 (작업용): node tests/homeshop-edge-browser.mjs
// 두 번 누르기 · 응답 다시 굴리기(주문·상자·맞교환이 되돌아가나) · 상자 두 번 열기 · 본편 턴이 넘어가면 편성 한 칸
import assert from 'node:assert/strict';
import { boot, closeEditor, closeWin, launch, loadFixture, openWin } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';
import { SHOW } from './homeshop-show.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
const items0 = { list: [{ id: 'i_old', name: '낡은 손전등', desc: '', effect: '', use: false, state: 'ok', from: 'manual', anchor: '', at: '2025-01-01T00:00:00Z' }], log: [] };
const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_items: JSON.stringify(items0) } };
const { page, errors } = await boot(browser, fx, chat, { width: 1280, height: 800, touch: false }, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
const ss = () => page.evaluate(() => window.__chat.scriptstate);
const liveNames = async () => page.evaluate(() => { const keys = new Set(window.__chat.message.map((m) => m.chatId)); const j = JSON.parse(window.__chat.scriptstate.$st_items || '{"list":[]}'); return j.list.filter((x) => (!x.anchor || [...keys].some((k) => x.anchor.includes(k))) && !(x.soldAt && [...keys].some((k) => x.soldAt.includes(k)))).map((x) => x.name); });
const reopen = async () => { await closeWin(page); await openWin(page); await page.waitForTimeout(400); if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true); await page.waitForTimeout(300); };
// 이미 소지품을 보고 있으면 누르지 않는다 (PC 는 같은 탭을 다시 누르면 상황판으로 간다)
const toItems = async () => { await page.waitForTimeout(400); if (!(await page.locator('[data-input="items-q"]').count())) await page.click('[data-action="nav-tab"][data-value="items"]'); await page.waitForSelector('[data-input="items-q"]', { timeout: 5000 }); await page.waitForTimeout(300); };
const goHs = async () => { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="hs"]'); await page.waitForTimeout(400); };
const reroll = async (id) => { await page.evaluate((i) => { window.__chat.message[window.__chat.message.length - 1].chatId = i; }, id); await reopen(); await toItems(); };
await openWin(page); await page.waitForTimeout(300);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
await goHs();
await page.waitForSelector('.hs-l3', { timeout: 15000 });
console.log('anchor sample', JSON.stringify(await page.evaluate(() => window.__chat.scriptstate.$hs_show_at)));
// ① 주문 확정 두 번 누르기 → 한 건
await click('[data-action="hs-pop"][data-value="call"]'); await page.waitForTimeout(200);
await page.evaluate(() => { const b = document.querySelector('[data-action="hs-order"]'); b.click(); b.click(); });
await page.waitForFunction(() => (window.__chat.scriptstate.$hs_orders || '').includes('무전기')); await page.waitForTimeout(500);
let st = await ss();
assert.equal(JSON.parse(st.$hs_orders).length, 1, '주문 한 건');
assert.equal(JSON.parse(st.$st_items).list.filter((x) => x.name.includes('택배 상자')).length, 1, '상자 한 개');
const o1 = JSON.parse(st.$hs_orders)[0];
console.log('① ok', o1.anchor, o1.boxId);
// ② 응답 다시 굴리기 → 주문·상자 사라짐, 다시 주문 가능
await click('.hs-pop header [data-action="hs-pop"]');
await reroll('c1b');
assert.equal(await page.locator(`[data-action="items-open"][data-value="${o1.boxId}"]`).count(), 0, '다시 굴리면 상자 없음');
await goHs();
assert.equal(await page.locator('[data-action="hs-pop"][data-value="call"]:not([disabled])').count(), 1, '다시 주문할 수 있음');
await click('[data-action="hs-page"][data-value="orders"]'); await page.waitForTimeout(300);
assert.ok(!(await page.textContent('.hs-wrap')).includes('무전기'), '주문 조회에 없음');
await click('[data-action="hs-page"][data-value=""]'); await page.waitForTimeout(300);
console.log('② ok');
// ③ 맞교환 주문 → 물건 빠짐·호출 없음, 다시 굴리면 물건 돌아옴
await click('[data-action="hs-pop"][data-value="call"]'); await page.waitForTimeout(200);
await click('[data-action="hs-pay"][data-value="barter"]'); await page.waitForTimeout(200);
assert.equal(await page.locator('[data-action="hs-order"][disabled]').count(), 1, '물건 고르기 전에는 확정 못 함');
await click('[data-action="hs-barter"][data-value="i_old"]'); await page.waitForTimeout(200);
await click('[data-action="hs-order"]');
await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$hs_orders || '[]').some((o) => o.barter)); await page.waitForTimeout(400);
st = await ss();
const o2 = JSON.parse(st.$hs_orders).find((o) => o.barter);
assert.deepEqual([o2.n, o2.dues.length, o2.barter], [0, 0, '낡은 손전등']);
await click('.hs-pop header [data-action="hs-pop"]');
await toItems();
assert.equal(await page.locator('[data-action="items-open"][data-value="i_old"]').count(), 0, '맞교환한 물건은 소지품에 없음');
assert.equal(await page.locator(`[data-action="items-open"][data-value="${o2.boxId}"]`).count(), 1, '상자 있음');
console.log('③ ok');
// ④ 상자 열기 두 번 누르기 → 물건 하나
await click(`[data-action="items-open"][data-value="${o2.boxId}"]`); await page.waitForTimeout(300);
await page.evaluate(() => { const b = document.querySelector('[data-action="hs-box-open"]'); b.click(); b.click(); });
await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$hs_orders).some((o) => o.openKey !== undefined)); await page.waitForTimeout(500);
st = await ss();
assert.equal(JSON.parse(st.$st_items).list.filter((x) => x.name === o2.item.name).length, 1, '물건 하나');
assert.equal(await page.locator('[data-action="hs-box-open"]').count(), 0, '연 뒤에는 「열기」 없음');
console.log('④ ok', await page.evaluate(() => document.querySelector('.it-pop, .gx-pop')?.textContent?.slice(0, 60) ?? '(상세 닫힘)'));
await click('[data-action="items-close"]');
// ⑤ 연 응답을 다시 굴리면(주문한 응답과 같음) 전부 없던 일, 맞교환 물건이 돌아옴
await reroll('c1c');
assert.equal(await page.locator('[data-action="items-open"][data-value="i_old"]').count(), 1, '맞교환 물건이 돌아옴');
assert.equal(await page.locator('.it-card, [data-action="items-open"]').count(), 1, '다른 물건 없음');
console.log('⑤ ok');
// ⑥ 다음 턴에 연 상자: 그 턴을 다시 굴리면 미개봉 상자로 돌아옴
await goHs();
await click('[data-action="hs-pop"][data-value="call"]'); await page.waitForTimeout(200);
await click('[data-action="hs-order"]');
await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$hs_orders || '[]').some((o) => o.anchor.includes('c1c') && o.n > 0)); await page.waitForTimeout(300);
const o3 = JSON.parse((await ss()).$hs_orders).find((o) => o.anchor.includes('c1c'));
await click('.hs-pop header [data-action="hs-pop"]');
const at0 = JSON.parse((await ss()).$hs_show).at;
await page.evaluate((r) => { window.__chat.message.push({ role: 'user', data: '계속', chatId: 'u2' }, { role: 'char', data: r, chatId: 'c2' }); }, REPLY);
await reopen();
await toItems();
await click(`[data-action="items-open"][data-value="${o3.boxId}"]`); await page.waitForTimeout(300);
await click('[data-action="hs-box-open"]');
await page.waitForFunction((id) => JSON.parse(window.__chat.scriptstate.$hs_orders).find((o) => o.id === id).openKey !== undefined, o3.id); await page.waitForTimeout(400);
await click('[data-action="items-close"]');
await reroll('c2b');
assert.equal(await page.locator(`[data-action="items-open"][data-value="${o3.boxId}"]`).count(), 1, '연 턴을 다시 굴리면 미개봉 상자');
await click(`[data-action="items-open"][data-value="${o3.boxId}"]`); await page.waitForTimeout(300);
assert.equal(await page.locator('[data-action="hs-box-open"]').count(), 1, '다시 열 수 있음');
await click('[data-action="items-close"]');
console.log('⑥ ok');
// ⑦ 본편 턴이 넘어갔으니 사이트를 열면 편성 한 칸
await goHs(); await page.waitForTimeout(800);
const at1 = JSON.parse((await ss()).$hs_show).at;
assert.equal(at1, at0 + 1, `편성 한 칸 (${at0} → ${at1})`);
await toItems(); await goHs(); await page.waitForTimeout(800);
assert.equal(JSON.parse((await ss()).$hs_show).at, at1, '같은 턴에 다시 열어도 그대로');
console.log('⑦ ok');
assert.deepEqual(errors, []);
console.log('edge ok');
await browser.close();
