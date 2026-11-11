// 맞춤 주문 완성 알림 확인 (작업용): node tests/order-ready-browser.mjs <사진 폴더>
// 응답 처리가 완성된 응답 끝에 표식 [shop-ready: …] 을 적고, 화면이 카드로 바꾸고, 「받으러 가기」가 우주 쇼핑몰 창을 연다. 받으면 표식이 지워진다
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, launch, loadFixture } from './qc-settings-harness.mjs';

const OUT = process.argv[2] || '.scratch/order-ready';
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const st = (d, t) => `답.\n[▣|${d}|${t}|☀️|4°C|관리국|QC 괴이]`;
const o = { id: 'q1', anchor: 'c1', price: 4500000, hours: 2, orderedAt: Date.UTC(2025, 0, 1, 2, 47) / 60000, orderedKey: 'c1', item: { name: '소리 없는 신발', desc: '발에 맞게 만든 신발', effect: '발소리가 사라진다', use: false } };
const message0 = [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: st('2025.01.01', '02:47 AM'), chatId: 'c1' }, { role: 'user', data: '계속', chatId: 'u2' }, { role: 'char', data: st('2025.01.01', '06:00 AM'), chatId: 'c2' }];
const browser = await launch();
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const message = JSON.parse(JSON.stringify(message0));
  const chat = { message, scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $pp_on: '0', $cos_orders: JSON.stringify([o]) } };
  const { page, errors } = await boot(browser, fx, chat, size);
  await page.waitForTimeout(800);
  const show = async (i) => {
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), message[i].data);
    await page.evaluate(({ h, i }) => { const d = document.createElement('div'); d.id = `m${i}`; d.style.cssText = `position:fixed;left:16px;top:${i * 90}px;width:min(520px,calc(100vw - 32px));z-index:1;white-space:pre-wrap;color:#ddd`; d.innerHTML = h; document.body.appendChild(d); }, { h: html, i });
    return html;
  };
  // 응답이 들어온 것처럼 응답 처리를 돌린다 → 표식이 적힌다
  await page.evaluate(async () => { const c = window.__chat; await window.__calls.listeners[0]({ char: JSON.parse(JSON.stringify(window.__char)), chat: JSON.parse(JSON.stringify(c)), characterIndex: 0, chatIndex: 0, messageIndex: c.message.length - 1 }); });
  const data = await page.evaluate(() => window.__chat.message.map((m) => m.data));
  assert.ok(data[3].endsWith('\n[shop-ready: cos|소리 없는 신발]'), data[3]);
  assert.ok(!data[1].includes('shop-ready'));
  message[1].data = data[1]; message[3].data = data[3];
  const h1 = await show(1);
  const h3 = await show(3);
  assert.ok(!h1.includes('받으러 가기'), '주문한 응답에는 카드 없음');
  assert.ok(h3.includes('받으러 가기') && h3.includes('소리 없는 신발') && !h3.includes('shop-ready'), '완성된 응답 아래 카드, 표식은 안 보임');
  await page.screenshot({ path: `${OUT}/${vp}-card.png` });
  await page.click('#m3 [data-goei-shop="cos"]');
  await page.waitForSelector('.gx-netsolo .ms, .gx-netsolo .br', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${vp}-open.png` });
  // 상태창이 없는 글에도 카드가 붙는다
  const bare = await page.evaluate(() => window.__calls.handlers.display('상태창 없는 답\n[shop-ready: cos|장갑]'));
  assert.ok(bare.includes('받으러 가기') && bare.includes('장갑') && !bare.includes('shop-ready'));
  // 주문 조회에서 받으면 표식이 지워진다
  await page.evaluate(() => document.querySelectorAll('#m1,#m3').forEach((e) => e.remove()));
  await page.click('.gx-netsolo [data-action="mall-custom-take"]').catch(async () => { await page.click('.gx-netsolo :text("주문 조회")'); await page.click('.gx-netsolo [data-action="mall-custom-take"]'); });
  await page.waitForFunction(() => !window.__chat.message.some((m) => String(m.data).includes('shop-ready')), null, { timeout: 8000 });
  await page.screenshot({ path: `${OUT}/${vp}-taken.png` });
  assert.deepEqual(errors, []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
