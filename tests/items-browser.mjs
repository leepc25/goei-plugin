// 소지품 메뉴 사진 (2026-11-07): PC 격자·팝업·기록, 폰 격자·서랍·팝업·가계부. 사용법: node tests/items-browser.mjs <out-dir>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/items-shots';
mkdirSync(out, { recursive: true });
const mk = (name, kind, desc, from = 'story', anchor = 'c1', extra = {}) => ({ id: `i_${name}`, name, desc, kind, effect: '', from, anchor, at: '2026-11-07T00:00:00Z', ...extra });
const items = { list: [
  mk('소금 봉지', 'consumable', '관리국 지급품, 두 봉지 남음', 'store', 'c1', { effect: '저급 괴이의 접근을 늦춘다', price: 6000 }), mk('손전등', 'tool', '건전지 넉넉'), mk('부적', 'charm', '세 장', 'manual', ''),
  mk('낡은 열쇠', 'key', '어디 것인지 모름'), mk('녹음기', 'device', '테이프 하나'), mk('방검 조끼', 'wear', '입고 있음'), mk('사건 파일', 'paper', '유계역 건'), mk('진통제', 'medical', '네 알'),
  mk('생수', 'food', '두 병'), mk('검은 구슬', 'anomaly', '차갑다'), mk('현금 봉투', 'valuable', '봉인 그대로'), mk('접이식 칼', 'weapon', ''), ...Array.from({ length: 5 }, (_, i) => mk(`봉인 상자 ${i + 1}`, 'seal', '무겁다')),
], log: [ { id: 'l1', name: '부적', what: 'use', by: 'story', anchor: 'c1', quote: '부적을 꺼내 문틈에 끼웠다', at: '2026-11-07T00:00:00Z' }, { id: 'l2', name: '손수건', what: 'drop', by: 'manual', anchor: '', at: '2026-11-06T00:00:00Z' } ] };
const chat = { message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_items: JSON.stringify(items) } };
const b = await launch();
const errorsAll = [];
for (const vp of ['pc', 'phone']) {
  const { page, errors } = await boot(b, fx, chat, vp);
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await sleep(200);
  const click = async (sel) => { await page.evaluate((q) => document.querySelector(q)?.click(), sel); await sleep(250); };
  const shot = (n) => page.screenshot({ path: `${out}/${vp}_${n}.png` });
  await click('[data-action="tab"][data-value="items"], [data-action="nav-tab"][data-value="items"]');
  if (vp === 'pc') await page.hover('.it-c[data-value="i_소금 봉지"]');
  await shot('grid');
  await click('.it-c[data-value="i_소금 봉지"]');
  await shot('pop');
  await click('[data-action="items-edit"]');
  await shot('edit');
  await click('[data-action="items-back"]');
  await click('[data-action="items-merge"]');
  await shot('merge');
  await click('[data-action="items-close"]');
  await click('[data-action="items-view"][data-value="log"]');
  await shot('log');
  await click('[data-action="items-view"][data-value="grid"]');
  await click('[data-action="items-add"]');
  await shot('add');
  await click('[data-action="items-close"]');
  await click('[data-action="items-sub"][data-value="wallet"]');
  await shot('wallet');
  // 「사용」 → 창을 닫으면 본 화면에 사용 상자 칩, 요청에 [Inventory] 글 (This turn: uses …)
  await click('[data-action="items-sub"][data-value="items"]');
  await click('.it-c[data-value="i_소금 봉지"]');
  await click('[data-action="items-use"]');
  await click('[data-action="items-close"]');
  await closeWin(page); await sleep(300);
  await shot('usebox');
  const req = await page.evaluate(async () => {
    window.__chat.message.push({ role: 'user', data: '소금을 뿌린다', chatId: 'u2' });
    const out = await window.__calls.replacers[0]([{ role: 'user', content: 'hi' }, { role: 'assistant', content: '본문' }, { role: 'user', content: '소금을 뿌린다' }], 'model');
    return out.map((m) => `${m.role}: ${String(m.content).slice(0, 60)}`);
  });
  const inv = req.find((l) => l.includes('[Inventory]'));
  if (!inv) errorsAll.push(`[${vp}] no [Inventory] in request: ${JSON.stringify(req)}`);
  // × 로 빼기: 칩의 × 좌표를 눌러 상자가 사라지는지
  const x = await page.$('[x-goei-usebox] [data-gu-x]');
  if (x) { await x.click(); await sleep(400); }
  const boxShown = await page.evaluate(() => document.querySelector('[x-goei-usebox]')?.style.display);
  if (boxShown !== 'none') errorsAll.push(`[${vp}] use box still shown after ×: ${boxShown}`);
  await openWin(page); await sleep(300);
  await openEditor(page, 'set:items'); await sleep(300);
  await shot('settings');
  await closeEditor(page, true);
  if (vp === 'phone') {
    await click('[data-action="tab"][data-value="records"]');
    await shot('records');
    await click('[data-action="cdr"]');
    await shot('drawer');
    await click('.gx-cpanel [data-value="wiki"]');
    await shot('wiki');
  }
  errorsAll.push(...errors.map((e) => `[${vp}] ${e}`));
  await page.close();
}
await b.close();
console.log(errorsAll.length ? `ERRORS\n${errorsAll.join('\n')}` : 'ok (no page errors)');
