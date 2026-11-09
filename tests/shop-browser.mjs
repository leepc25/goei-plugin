// 상점 사진·흐름 (2026-11-07): 응답 표식 → 응답 처리 → 「상점 열기」 카드(display) → 팝업(보조 모델 가짜 응답) → 상세·구입·흥정·팔기(제안·흥정·확정)·거래 끊음, PC·폰.
// 사용법: node tests/shop-browser.mjs <out-dir>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/shop-shots';
mkdirSync(out, { recursive: true });

const CHAR = '철문을 밀자 기름 냄새와 쇠 냄새가 한꺼번에 밀려왔다. 천장까지 쌓인 선반 사이로 주인이 고개만 내밀었다.\n[▣|2025.01.01|02:47 PM|☀️|4°C|을지로 철물점|목표]\n[shop: 을지로 철물점|백사헌]';
const SHELF = `<shop-identity>
sells: 공구, 소모품, 작업복, 호신 기기
never: 식품, 약, 부적 같은 종교물
prices: 동네 철물점 값, 비싸지 않음
price_range: 1000~200000
</shop-identity>
<owner>뭐 찾소. 급한 거면 왼쪽 선반부터 봐. 값은 적힌 대로고.</owner>
<shelf>
손전등|18000|사용|flashlight|LED 손전등, 건전지 별매|어두운 곳을 비춘다
공구 가방|42000|장비|tool bag|튼튼한 캔버스 가방, 주머니 여섯|
쇠파이프|7000|무기·사용|iron pipe|1m 길이, 끝이 거칠다|둔기로 쓸 수 있다
호신용 최루 스프레이 (대용량)|15000|소모5|pepper spray|경찰 납품용이라고 적혀 있다|사람·짐승을 잠시 멈춘다
건전지 AA 8개|6000|소모8|batteries|유통기한 넉넉|
작업용 장갑|9000|장비|work gloves|가죽 보강, 미끄럼 방지|
전기충격기|65000|무기·사용|stun gun|허가 번호 흐릿함|
철제 봉인 상자|왼손 새끼손가락|-|metal box|자물쇠 둘, 값은 몸으로|
</shelf>`;
const TALK_REPRICE = `<owner>건전지는 따로야. 둘이 같이 가져가면 손전등은 천 원 빼 주지.</owner>
<change mode="partial">
~ 손전등|17000
~ 공구 가방|피 200ml
</change>`;
const SELL_OFFER = `<owner>손전등? 방금 산 거잖소. 중고는 만 이천이면 많이 쳐 주는 거요.</owner>
<change mode="none">
</change>
<offer>12000</offer>`;
const SELL_HAGGLE = `<owner>…만 사천. 그 이상은 안 되오.</owner>
<change mode="none">
</change>
<offer>14000</offer>`;
const TALK_CLOSED = `<owner>됐소. 살 거 아니면 나가쇼.</owner>
<change mode="none">
</change>
<closed/>`;

const b = await launch();
const errorsAll = [];
for (const vp of ['pc', 'phone']) {
  const chat = {
    message: [{ role: 'user', data: '철물점 문을 열고 들어간다.', chatId: 'u1' }, { role: 'char', data: CHAR, chatId: 'c1' }],
    // 장착 중인 물건이 있으면 팔기 화면에 「장착」 상자가 같이 뜬다 (장착한 것도 팔 수 있게)
    scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_items: JSON.stringify({ list: [{ id: 'i_vest', name: '방검 조끼', desc: '입고 있음', effect: '', use: false, equip: 'gear', slot: 0, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' }, { id: 'i_x0', name: '라이터', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x1', name: '붕대', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x2', name: '부적', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x3', name: '생수', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x4', name: '지도', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x5', name: '라디오', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x6', name: '소금', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x7', name: '양초', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x8', name: '나침반', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x9', name: '열쇠꾸러미', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x10', name: '손거울', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },{ id: 'i_x11', name: '호루라기', desc: '', effect: '', use: true, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' }], log: [] }) },
  };
  // 상품 그림 팩은 저장소에 미리 둔다 (소지품과 같은 그림, host/itemicons.ts)
  const { page, errors } = await boot(b, fx, chat, vp, { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });
  if (process.env.SHOP_DEBUG) page.on('console', (m) => { if (/goei/.test(m.text())) console.log('LOG', m.text().slice(0, 300)); });
  const shot = (n) => page.screenshot({ path: `${out}/${vp}_${n}.png` });
  const click = async (sel) => { await page.evaluate((q) => document.querySelector(q)?.click(), sel); await sleep(250); };
  const act = async (action, value) => {
    await page.evaluate(({ action, value }) => {
      const b = document.createElement('button');
      b.dataset.action = action;
      if (value) b.dataset.value = value;
      b.style.display = 'none';
      document.querySelector('.gx-panel')?.appendChild(b);
      b.click();
      b.remove();
    }, { action, value });
    await sleep(300);
  };
  const waitIdle = async () => page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 8000 }).catch(() => {});
  // 창을 한 번 열어 본체를 띄운다 (응답 처리기는 본체가 떠 있어야 돈다)
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await sleep(200);
  // 1. 응답 처리: 표식 → $st_shop (가게·주인·기준), 카드는 display 로
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  const st0 = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || 'null'));
  if (!st0 || st0.shop !== '을지로 철물점' || st0.owner !== '백사헌' || st0.key !== 'c1') errorsAll.push(`[${vp}] settleShop: ${JSON.stringify(st0)} msg=${JSON.stringify(await page.evaluate(() => [window.__chat.message[1].data.slice(-60), Object.keys(window.__chat.scriptstate).filter((k) => k.startsWith('$st_'))]))}`);
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), CHAR);
  if (!html.includes('data-goei-shop') || html.includes('[shop:')) errorsAll.push(`[${vp}] display card missing or tag left: ${html.slice(-200)}`);
  // 2. 창을 닫고 채팅 속 카드의 「상점 열기」를 누른다 — 실제처럼 상점만 뜬다(상황판 없이, 가짜 보조 모델 응답 1개: 진열대)
  await closeWin(page); await sleep(200);
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:1'; d.innerHTML = h; document.body.appendChild(d); }, html);
  // 카드가 채팅에 그려질 때처럼 display 를 한 번 더 불러 클릭 처리기를 깨운다 (카드 없을 때 누른 클릭이 처리기를 재움)
  await page.evaluate((t) => window.__calls.handlers.display(t), CHAR);
  await page.evaluate((t) => { window.__llm = [t]; }, SHELF);
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.gx-solo'), null, { timeout: 8000 }).catch(() => {}); await sleep(200);
  if (!(await page.evaluate(() => !!document.querySelector('.gx-solo') && ![...document.querySelectorAll('.gx-tabs, .gx-nav')].some((e) => e.offsetParent)))) errorsAll.push(`[${vp}] card open is not shop-only`);
  await shot('loading');
  await waitIdle(); await sleep(300);
  const st1 = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || 'null'));
  if (!st1?.loaded || st1.items.length !== 8) errorsAll.push(`[${vp}] shelf: loaded=${st1?.loaded} items=${st1?.items?.map((x) => x.name).join(',')}`);
  const pipe = st1?.items.find((x) => x.name === '쇠파이프');
  if (pipe?.equip !== 'weapon' || st1?.items.find((x) => x.name === '건전지 AA 8개')?.uses !== 8) errorsAll.push(`[${vp}] traits: ${JSON.stringify(st1?.items?.slice(0, 5))}`);
  if (vp === 'pc') {
    // 설명 팝업은 창 맨 위 층 하나 (2026-11-08 사용자: 잘림·스크롤 움찔). 오른쪽 끝 칸은 왼쪽으로 펼친다
    await page.hover('.sh-c[data-value]'); await sleep(200);
    const tip = await page.evaluate(() => { const t = document.querySelector('.it-tipfloat.on'); if (!t) return null; const r = t.getBoundingClientRect(); return { r: r.right, w: innerWidth, b: r.bottom, h: innerHeight }; });
    if (!tip || tip.r > tip.w || tip.b > tip.h) errorsAll.push(`[${vp}] floating tip: ${JSON.stringify(tip)}`);
    await shot('grid');
    const cells = await page.$$('.sh-sale .sh-c[data-value], .sh-c[data-value]');
    await cells[cells.length - 1].hover(); await sleep(200);
    await shot('grid_tip_last');
    await page.mouse.move(1, 1);
  } else await shot('grid');
  // 3. 상세: 잔고 14만 → 전기충격기 6.5만 살 수 있음 / 봉인 상자 12만 가능 / 쇠파이프… 잔고 부족은 없음 → 잔고를 1만으로 낮춰 부족 화면도
  const ids = Object.fromEntries((st1?.items ?? []).map((x) => [x.name, x.id]));
  await act('shop-detail', ids['손전등']);
  await shot('detail');
  await act('shop-detail-close');
  // 4. 흥정: 「건전지도 같이 주면 안 돼?」 → 손전등 17,000 (▾ 표시)
  await page.evaluate((t) => { window.__llm = [t]; }, TALK_REPRICE);
  if (vp === 'phone') await act('shop-drawer');
  await act('shop-ask', ids['손전등']);
  await page.evaluate(() => { const i = document.querySelector('[data-input="shop-say"]'); i.value = '건전지도 같이 주면 안 돼?'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await shot('ask');
  await act('shop-say', '건전지도 같이 주면 안 돼?');
  await waitIdle(); await sleep(300);
  const st2 = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || 'null'));
  const fl = st2?.items.find((x) => x.name === '손전등');
  if (!fl || fl.price !== 17000 || fl.orig !== 18000) errorsAll.push(`[${vp}] reprice: ${JSON.stringify(fl)}`);
  // 다른 대가로 합의 (2026-11-08 사용자): 원 몫 0 + 대가 글
  const bag = st2?.items.find((x) => x.name === '공구 가방');
  if (!bag || bag.price !== 0 || bag.pay !== '피 200ml') errorsAll.push(`[${vp}] pay deal: ${JSON.stringify(bag)}`);
  if (st2?.items.find((x) => x.name === '철제 봉인 상자')?.pay !== '왼손 새끼손가락') errorsAll.push(`[${vp}] shelf pay: ${JSON.stringify(st2?.items.find((x) => x.name === '철제 봉인 상자'))}`);
  if (!st2?.talk.some((l) => l.who === 'me' && l.text.includes('[손전등]'))) errorsAll.push(`[${vp}] my line missing: ${JSON.stringify(st2?.talk)}`);
  await shot('talk');
  if (vp === 'phone') await act('shop-drawer');
  await act('shop-detail', ids['손전등']);
  await shot('detail_haggled');
  // 5. 구입 → 가계부 store 줄 + 소지품 from store + 진열대에서 빠짐
  await act('shop-buy', ids['손전등']);
  await sleep(300);
  const after = await page.evaluate(() => ({ w: JSON.parse(window.__chat.scriptstate.$st_wallet || '{}'), it: JSON.parse(window.__chat.scriptstate.$st_items || '{}'), st: JSON.parse(window.__chat.scriptstate.$st_shop || 'null') }));
  const wl = after.w.log?.find((e) => e.src === 'store');
  if (!wl || wl.amount !== -17000 || wl.anchor !== 'c1') errorsAll.push(`[${vp}] wallet: ${JSON.stringify(after.w.log)}`);
  const bought = after.it.list?.find((e) => e.from === 'store');
  if (!bought || bought.name !== '손전등' || bought.walletId !== wl?.id) errorsAll.push(`[${vp}] item: ${JSON.stringify(after.it.list)}`);
  if (!after.st.items.find((x) => x.name === '손전등')?.sold) errorsAll.push(`[${vp}] not marked sold`);
  await shot('bought');
  // 5b. 팔기: 「팔기」 → 내 소지품(방금 산 손전등) 고름 → 칩 → 보냄(글 없이) → 제안 12,000 → 상세 → 흥정 「만오천」 → 14,000(처음 값 취소선) → 팔기 확정
  await act('shop-pick');
  await shot('pick');
  if (!(await page.$('.sh-pick .it-eqbox [data-value="i_vest"]'))) errorsAll.push(`[${vp}] no equip box in sell pick`);
  const myId = after.it.list.find((e) => e.from === 'store')?.id;
  await act('shop-sell-pick', myId);
  await sleep(200);
  await shot('sell_chip');
  await page.evaluate((t) => { window.__llm = [t]; }, SELL_OFFER);
  await act('shop-say', '');
  await waitIdle(); await sleep(300);
  const so = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || 'null'));
  if (so?.sell?.price !== 12000) errorsAll.push(`[${vp}] sell offer: ${JSON.stringify(so?.sell)} talk=${JSON.stringify(so?.talk?.slice(-2))}`);
  if (!so?.talk.some((l) => l.who === 'me' && l.text === '[판매: 손전등]')) errorsAll.push(`[${vp}] sell line: ${JSON.stringify(so?.talk)}`);
  await shot('sell_offer');
  await page.evaluate((t) => { window.__llm = [t]; }, SELL_HAGGLE);
  await act('shop-sell-haggle');
  await act('shop-say', '만오천은 줘야지');
  await waitIdle(); await sleep(300);
  const sh = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || 'null'));
  if (sh?.sell?.price !== 14000 || sh?.sell?.first !== 12000) errorsAll.push(`[${vp}] sell haggle: ${JSON.stringify(sh?.sell)}`);
  await shot('sell_haggled');
  await act('shop-sell');
  await sleep(300);
  const afterSell = await page.evaluate(() => ({ w: JSON.parse(window.__chat.scriptstate.$st_wallet || '{}'), it: JSON.parse(window.__chat.scriptstate.$st_items || '{}'), st: JSON.parse(window.__chat.scriptstate.$st_shop || 'null') }));
  const sl = afterSell.w.log?.find((e) => e.src === 'store' && e.amount === 14000);
  if (!sl || sl.anchor !== 'c1') errorsAll.push(`[${vp}] sell wallet: ${JSON.stringify(afterSell.w.log)}`);
  if (afterSell.it.list?.some((e) => e.id === myId && !e.soldAt) || !afterSell.it.log?.some((l) => l.what === 'sell' && l.name === '손전등')) errorsAll.push(`[${vp}] sell item: ${JSON.stringify(afterSell.it)}`);
  if (afterSell.st?.sell || afterSell.st?.sales?.[0]?.price !== 14000) errorsAll.push(`[${vp}] sell state: ${JSON.stringify({ sell: afterSell.st?.sell, sales: afterSell.st?.sales })}`);
  await shot('sold');
  if (vp === 'phone' && await page.evaluate(() => !!document.querySelector('.sh-drawer'))) await act('shop-drawer');
  // 6. 잔고 부족: 잔고를 1만으로 → 값 빨강·구입 비활성
  await page.evaluate(() => { const w = JSON.parse(window.__chat.scriptstate.$st_wallet); w.start = 60000; window.__chat.scriptstate.$st_wallet = JSON.stringify(w); });
  await act('shop-close'); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gx')?.style.display !== 'none')) errorsAll.push(`[${vp}] solo shop close left the window open`);
  await page.evaluate((t) => { document.getElementById('chat-card').style.visibility = ''; return window.__calls.handlers.display(t); }, CHAR);
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.gx-solo'), null, { timeout: 8000 }).catch(() => {}); await sleep(200);
  await act('shop-detail', ids['전기충격기']);
  await shot('poor');
  await act('shop-detail-close');
  // 6b. 원이 아닌 대가: 잔고가 모자라도 구입이 열리고, 가계부는 그대로, 소지품에 무엇으로 치렀는지 남는다
  await act('shop-detail', ids['공구 가방']);
  await shot('detail_pay');
  if (await page.evaluate(() => document.querySelector('.sh-det [data-action="shop-buy"]')?.disabled !== false)) errorsAll.push(`[${vp}] pay item buy disabled`);
  const wBefore = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_wallet).log.length);
  await act('shop-buy', ids['공구 가방']);
  await sleep(300);
  const pd = await page.evaluate(() => ({ w: JSON.parse(window.__chat.scriptstate.$st_wallet).log.length, it: JSON.parse(window.__chat.scriptstate.$st_items).list.find((e) => e.name === '공구 가방') }));
  if (pd.w !== wBefore || pd.it?.paidWith !== '피 200ml' || pd.it?.walletId) errorsAll.push(`[${vp}] pay buy: ${JSON.stringify(pd)}`);
  // 7. 거래 끊음 → 진열대 잠김
  await page.evaluate((t) => { window.__llm = [t]; }, TALK_CLOSED);
  if (vp === 'phone') await act('shop-drawer');
  await act('shop-say', '야 좀 깎아 줘 좀');
  await waitIdle(); await sleep(300);
  const st3 = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || 'null'));
  if (!st3?.closed) errorsAll.push(`[${vp}] not closed`);
  await shot('closed');
  if (vp === 'phone') await act('shop-drawer');
  await act('shop-close');
  // 8. 다음 턴 요청: [Inventory] 에 새로 산 것 + 쫓겨남 + 표식 지침
  const req = await page.evaluate(async () => {
    window.__chat.message.push({ role: 'user', data: '가게를 나온다', chatId: 'u2' });
    const out = await window.__calls.replacers[0]([{ role: 'user', content: 'hi' }, { role: 'assistant', content: '본문' }, { role: 'user', content: '가게를 나온다' }], 'model');
    return out.map((m) => String(m.content));
  });
  const inv = req.find((l) => l.includes('[Inventory]')) ?? '';
  if (inv.includes('just bought 손전등') || !inv.includes('공구 가방 (paid with 피 200ml)') || !inv.includes('just sold 손전등 (14,000 won)') || !inv.includes('refused service') || !inv.includes('[shop:')) errorsAll.push(`[${vp}] inventory block: ${inv.slice(0, 200)} … ${inv.slice(-300)}`);
  // 9. 설정 페이지
  await openWin(page); await sleep(300);
  await openEditor(page, 'set:items'); await sleep(300);
  await shot('settings');
  await closeEditor(page, true);
  await closeWin(page);
  errorsAll.push(...errors.filter((e) => !/favicon/.test(e)).map((e) => `[${vp}] ${e}`));
  await page.close();
}
await b.close();
if (errorsAll.length) {
  console.error('FAIL\n' + errorsAll.join('\n'));
  process.exit(1);
}
console.log('ok', out);
