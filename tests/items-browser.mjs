// 소지품 메뉴 사진 (2026-11-07): PC 격자·팝업·기록, 폰 격자·서랍·팝업·가계부. 사용법: node tests/items-browser.mjs <out-dir>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/items-shots';
mkdirSync(out, { recursive: true });
const mk = (name, desc, extra = {}, from = 'story', anchor = 'c1') => ({ id: `i_${name}`, name, desc, effect: '', use: false, state: 'ok', from, anchor, at: '2026-11-07T00:00:00Z', ...extra });
const items = { list: [
  mk('소금 봉지', '관리국 지급품', { effect: '저급 괴이의 접근을 늦춘다', price: 6000, use: true, uses: 3, icon: 'salt' }, 'store'), mk('손전등', '건전지 넉넉', { use: true, icon: 'flashlight' }), mk('부적', '세 장', { use: true, uses: 3 }, 'manual', ''),
  mk('낡은 열쇠', '어디 것인지 모름'), mk('녹음기', '테이프 하나', { use: true, state: 'damaged' }), mk('방검 조끼', '입고 있음', { equip: 'gear', slot: 0 }), mk('사건 파일', '유계역 건'), mk('진통제', '네 알', { use: true, uses: 4 }),
  mk('생수', '두 병', { use: true, uses: 2 }), mk('검은 구슬', '차갑다'), mk('금반지', '봉인 그대로', { equip: 'gear' }), mk('접이식 칼', '', { equip: 'weapon', use: true, slot: 0 }), mk('권총', '탄창 하나', { equip: 'weapon', use: true }),
  mk('무전기', '젖어서 안 켜짐', { use: true, state: 'broken' }), ...Array.from({ length: 4 }, (_, i) => mk(`봉인 상자 ${i + 1}`, '무겁다')),
], log: [ { id: 'l1', name: '부적', item: 'i_부적', what: 'use', by: 'use', n: 1, anchor: 'c1', at: '2026-11-07T00:00:00Z' }, { id: 'l2', name: '손수건', what: 'drop', by: 'manual', anchor: '', at: '2026-11-06T00:00:00Z' }, { id: 'l3', name: '삼단봉', what: 'destroy', by: 'story', anchor: 'c1', quote: '삼단봉이 두 동강 났다', at: '2026-11-07T00:00:00Z' } ] };
const chat = { message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_items: JSON.stringify(items), $st_look: JSON.parse(distPack('goei-data-looks')).looks.find((l) => l.g === '여')?.id ?? '' } };
const b = await launch();
const errorsAll = [];
for (const vp of ['pc', 'phone']) {
  // 소지품 그림 팩은 저장소에 미리 둔다 (받기 없이 바로 그림, host/itemicons.ts)
  const { page, errors } = await boot(b, fx, chat, vp, { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await sleep(200);
  const click = async (sel) => { await page.evaluate((q) => document.querySelector(q)?.click(), sel); await sleep(250); };
  const shot = (n) => page.screenshot({ path: `${out}/${vp}_${n}.png` });
  await click('[data-action="tab"][data-value="items"], [data-action="nav-tab"][data-value="items"]');
  await shot('boxes');
  if (vp === 'pc') {
    await page.hover('.it-c[data-value="i_소금 봉지"]');
    await shot('grid');
    // 끌어다 놓기: 권총 → 손 둘째 칸, 진통제 → 사용 두 번(×2), 손전등 → 사용, 끄는 동안 버리기 띠
    const drag = async (from, to) => { await page.dragAndDrop(from, to); await sleep(350); };
    await drag('.it-c[data-value="i_권총"]', '[data-drop="equip:weapon:1"]');
    await drag('.it-c[data-value="i_진통제"]', '[data-drop="use"]');
    await drag('.it-c[data-value="i_진통제"]', '[data-drop="use"]');
    await drag('.it-c[data-value="i_손전등"]', '[data-drop="use"]');
    await drag('.it-c[data-value="i_부적"]', '[data-drop="use"]');
    await drag('.it-c[data-value="i_부적"]', '[data-drop="use"]');
    await shot('dropped');
    const st = await page.evaluate(() => ({ use: window.__chat.scriptstate.$st_item_use, items: JSON.parse(window.__chat.scriptstate.$st_items).list.filter((x) => x.slot !== undefined).map((x) => `${x.name}:${x.slot}`) }));
    if (!String(st.use).includes('"i_진통제","n":2') || !st.items.includes('권총:1')) errorsAll.push(`[pc] drag result: ${JSON.stringify(st)}`);
    // 끄는 중 모습 (버리기 띠)
    await page.evaluate(() => document.querySelector('.gx-items')?.classList.add('it-dragging'));
    await shot('dragging');
    await page.evaluate(() => document.querySelector('.gx-items')?.classList.remove('it-dragging'));
    // 버리기 띠는 끄는 동안만 보이므로 마우스로 직접: 잡고 조금 움직여 끌기 시작 → 띠로
    const src = await page.$('.it-c[data-value="i_검은 구슬"]');
    const sb = await src.boundingBox();
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x + sb.width / 2 + 20, sb.y + sb.height / 2 + 20, { steps: 4 });
    await sleep(200);
    const tb = await (await page.$('[data-drop="drop"]')).boundingBox();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 6 });
    await page.mouse.up();
    await sleep(400);
    await shot('drop_confirm');
    await click('[data-action="items-back"]');
    await click('[data-action="items-close"]');
  }
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
  if (vp === 'phone') {
    await click('.it-c[data-value="i_소금 봉지"]');
    await click('[data-action="items-use"]');
    await click('[data-action="items-use"]');
    await shot('pop_use2');
    await click('[data-action="items-close"]');
    await shot('boxes_used');
    await click('.it-c[data-value="i_권총"]');
    await click('[data-action="items-equip"]');
    await click('[data-action="items-close"]');
    await shot('equipped');
  }
  await closeWin(page); await sleep(300);
  // 칩은 채팅 속 마지막 메시지 아래 (2026-11-11): 화면 처리기가 붙인 빈 자리를 본 화면 style 이 채운다. 옛 메시지의 자리는 안 보인다
  const chip = await page.evaluate(async () => {
    const list = document.createElement('div');
    list.id = 'chatmock';
    list.style.cssText = 'position:fixed;left:16px;right:16px;top:60px;z-index:1;display:flex;flex-direction:column-reverse;color:#ddd';
    for (const m of [...window.__chat.message].reverse()) {
      const d = document.createElement('div');
      d.className = 'chat-message-container';
      d.innerHTML = await window.__calls.handlers.display(m.data);
      list.appendChild(d);
    }
    document.body.appendChild(list);
    const cards = [...list.querySelectorAll('[data-goei-card="use"]')];
    const vis = (e) => getComputedStyle(e).display !== 'none';
    const last = cards[0];
    return {
      cards: cards.length, lastOn: !!last && vis(last), oldOn: cards.slice(1).some(vis),
      label: last ? getComputedStyle(last.querySelector('[data-gu-label]'), '::before').content : '',
      names: last ? [...last.querySelectorAll('[data-gu]')].filter(vis).map((e) => getComputedStyle(e, '::before').content) : [],
      fixed: !!document.querySelector('[x-goei-usebox] [data-gu]'),
    };
  });
  if (!chip.lastOn || chip.oldOn || !chip.label.includes('다음 메시지에 사용') || !chip.names.length || chip.fixed) errorsAll.push(`[${vp}] use chip not under last message: ${JSON.stringify(chip)}`);
  console.log(vp, 'chip', JSON.stringify(chip));
  await shot('usebox');
  // × 로 빼기: 칩의 × 좌표를 눌러 상자가 사라지는지. 보내기 전에 본다 (2026-11-12: 요청에 실려 나가면 칩이 바로 숨는다, tests/usebar-browser.mjs)
  let xClicks = 0;
  for (let i = 0; i < 6; i++) {
    let x = null;
    for (const e of await page.$$('#chatmock .chat-message-container:first-child [data-gu-x]')) if (await e.isVisible()) { x = e; break; }
    if (!x) break;
    await x.click(); await sleep(400); xClicks++;
  }
  if (!xClicks) errorsAll.push(`[${vp}] no × to click on the use chip`);
  const boxShown = await page.evaluate(() => { const c = document.querySelector('#chatmock [data-goei-card="use"]'); return c ? getComputedStyle(c).display : 'none'; });
  if (boxShown !== 'none') errorsAll.push(`[${vp}] use box still shown after ×: ${boxShown}`);
  const useLeft = await page.evaluate(() => window.__chat.scriptstate.$st_item_use);
  console.log(vp, 'use after ×', useLeft, 'clicks', xClicks);
  const req = await page.evaluate(async () => {
    window.__chat.message.push({ role: 'user', data: '소금을 뿌린다', chatId: 'u2' });
    const out = await window.__calls.replacers[0]([{ role: 'user', content: 'hi' }, { role: 'assistant', content: '본문' }, { role: 'user', content: '소금을 뿌린다' }], 'model');
    return out.map((m) => `${m.role}: ${String(m.content).slice(0, 60)}`);
  });
  const inv = req.find((l) => l.includes('[Inventory]'));
  if (!inv) errorsAll.push(`[${vp}] no [Inventory] in request: ${JSON.stringify(req)}`);
  await page.evaluate(() => document.querySelector('#chatmock')?.remove());
  await openWin(page); await sleep(300);
  await openEditor(page, 'set:items'); await sleep(300);
  await shot('settings');
  await closeEditor(page, true);
  if (vp === 'phone') {
    await click('[data-action="tab"][data-value="records"]');
    await shot('records');
    await click('[data-action="cdr"]');
    await shot('drawer');
    await click('.gx-cpanel [data-value="wk"]');
    await shot('wiki');
  }
  errorsAll.push(...errors.map((e) => `[${vp}] ${e}`));
  await page.close();
}
await b.close();
// 틀린 것이 있으면 실패로 끝낸다 — 전에는 찍기만 하고 0으로 끝났다 (전수검사 11-13)
if (errorsAll.length) { console.error('FAIL\n' + errorsAll.join('\n')); process.exit(1); }
console.log('ok (no page errors)');
