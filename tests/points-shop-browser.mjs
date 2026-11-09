// 백일몽 포인트 상점 (2026-11-08 사용자: 포인트는 포인트 상점에서만): 복지몰 표식 → 진열대(currency points) → 잔고 칸이 포인트 → 구입하면 포인트 장부만 줄고 가계부는 그대로, PC·폰.
// 사용법: node tests/points-shop-browser.mjs <out-dir>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openWin, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/points-shop-shots';
mkdirSync(out, { recursive: true });

const CHAR = '사원증을 대자 복지몰 화면이 켜졌다.\n[▣|2025.01.01|02:47 PM|☀️|4°C|백일몽 본사|없음|없음|없음|백일몽/사원|140000|1000]\n[shop: 임직원 복지몰|]';
const SHELF = `<shop-identity>
sells: 임직원 복지 물품, 회사 물약
never: 현금 거래
prices: 백일몽 복지 포인트만 받음
currency: points
</shop-identity>
<owner>임직원 복지몰에 오신 것을 환영합니다.</owner>
<shelf>
탈모약|100|사용|pill bottle|시중가 50만 원짜리 탈모약||
대형 가전 교환권|500|사용|voucher|최상급 가전 하나와 바꿔 준다||
재생 물약|10000p|소모1|potion|상처를 되돌리는 회사 물약|상처 회복|
</shelf>`;

const b = await launch();
const errorsAll = [];
for (const vp of ['pc', 'phone']) {
  const chat = {
    message: [{ role: 'user', data: '복지몰을 연다.', chatId: 'u1' }, { role: 'char', data: CHAR, chatId: 'c1' }],
    scriptstate: { $st_look: '7.1', $st_faction: 'C00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $pp_on: '0', $st_points_on: '1', $st_points: JSON.stringify({ start: 0, log: [{ id: 'p1', anchor: 'c1', amount: 1000, memo: '이번 달 복지 포인트', src: 'story', at: '2026-11-08T00:00:00Z' }] }) },
  };
  const { page, errors } = await boot(b, fx, chat, vp, { store: { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') } });
  const shot = (n) => page.screenshot({ path: `${out}/${vp}_${n}.png` });
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
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await sleep(200);
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), CHAR);
  await closeWin(page); await sleep(200);
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:1'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await page.evaluate((t) => window.__calls.handlers.display(t), CHAR);
  await page.evaluate((t) => { window.__llm = [t]; }, SHELF);
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.gx-solo'), null, { timeout: 8000 }).catch(() => {});
  await waitIdle(); await sleep(400);
  const st = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || 'null'));
  if (!st?.identity?.points) errorsAll.push(`[${vp}] not a point shop: ${JSON.stringify(st?.identity)}`);
  const potion = st?.items.find((x) => x.name === '재생 물약');
  if (potion?.price !== 10000 || potion?.pay) errorsAll.push(`[${vp}] 10000p price: ${JSON.stringify(potion)}`);
  const bal = await page.evaluate(() => document.querySelector('.sh-bal')?.textContent?.trim());
  if (bal !== '1,000p') errorsAll.push(`[${vp}] balance shows points: ${bal}`);
  const bands = await page.evaluate(() => [...document.querySelectorAll('.sh-c .sh-band, .sh-rare-pr')].map((e) => e.textContent.trim()));
  if (!bands.includes('100p')) errorsAll.push(`[${vp}] band in p: ${bands.join(',')}`);
  await shot('grid');
  const ids = Object.fromEntries((st?.items ?? []).map((x) => [x.name, x.id]));
  await act('shop-detail', ids['탈모약']);
  await shot('detail');
  await act('shop-buy', ids['탈모약']);
  await sleep(300);
  const after = await page.evaluate(() => ({ p: JSON.parse(window.__chat.scriptstate.$st_points || '{}'), w: window.__chat.scriptstate.$st_wallet ?? '', it: JSON.parse(window.__chat.scriptstate.$st_items || '{}') }));
  const spent = after.p.log?.find((e) => e.src === 'store');
  if (!spent || spent.amount !== -100) errorsAll.push(`[${vp}] point ledger: ${JSON.stringify(after.p)}`);
  if (after.w && JSON.parse(after.w).log?.some((e) => e.src === 'store')) errorsAll.push(`[${vp}] won wallet touched: ${after.w}`);
  const got = after.it.list?.find((x) => x.name === '탈모약');
  if (!got || got.price !== undefined || !/100 Baekilmong points/.test(got.paidWith ?? '')) errorsAll.push(`[${vp}] item paid: ${JSON.stringify(got)}`);
  const bal2 = await page.evaluate(() => document.querySelector('.sh-bal')?.textContent?.trim());
  if (bal2 !== '900p') errorsAll.push(`[${vp}] balance after: ${bal2}`);
  // 포인트 모자람: 재생 물약 10,000p
  await act('shop-detail', ids['재생 물약']);
  await shot('detail_poor');
  await act('shop-detail-close');
  errorsAll.push(...errors.filter((e) => !/favicon/.test(e)).map((e) => `[${vp}] ${e}`));
  await page.close();
}
await b.close();
if (errorsAll.length) {
  console.error('FAIL\n' + errorsAll.join('\n'));
  process.exit(1);
}
console.log('ok', out);
