// 맞춤 주문 완성 알림 확인 (작업용): node tests/order-ready-browser.mjs <사진 폴더>
// 완성된 턴의 상태창 아래에 카드가 붙고, 「받으러 가기」가 우주 쇼핑몰 창을 연다
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, launch, loadFixture } from './qc-settings-harness.mjs';

const OUT = process.argv[2] || '.scratch/order-ready';
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const st = (d, t) => `답.\n[▣|${d}|${t}|☀️|4°C|관리국|QC 괴이]`;
const o = { id: 'q1', anchor: 'c1', price: 4500000, hours: 2, orderedAt: Date.UTC(2025, 0, 1, 2, 47) / 60000, orderedKey: 'c1', item: { name: '소리 없는 신발', desc: '발에 맞게 만든 신발', effect: '발소리가 사라진다', use: false } };
const message = [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: st('2025.01.01', '02:47 AM'), chatId: 'c1' }, { role: 'user', data: '계속', chatId: 'u2' }, { role: 'char', data: st('2025.01.01', '06:00 AM'), chatId: 'c2' }];
const browser = await launch();
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const chat = { message, scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $pp_on: '0', $cos_orders: JSON.stringify([o]) } };
  const { page, errors } = await boot(browser, fx, chat, size);
  await page.waitForTimeout(800);
  const show = async (i) => {
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), message[i].data);
    await page.evaluate(({ h, i }) => { const d = document.createElement('div'); d.id = `m${i}`; d.style.cssText = `position:fixed;left:16px;top:${i * 90}px;width:min(520px,calc(100vw - 32px));z-index:1;white-space:pre-wrap;color:#ddd`; d.innerHTML = h; document.body.appendChild(d); }, { h: html, i });
    return html;
  };
  const h1 = await show(1);
  const h3 = await show(3);
  assert.ok(!h1.includes('받으러 가기'), '주문한 응답에는 카드 없음');
  assert.ok(h3.includes('받으러 가기') && h3.includes('소리 없는 신발'), '완성된 응답 아래 카드');
  await page.screenshot({ path: `${OUT}/${vp}-card.png` });
  await page.click('#m3 [data-goei-shop="cos"]');
  await page.waitForSelector('.gx-netsolo .ms, .gx-netsolo .br', { timeout: 8000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${vp}-open.png` });
  // 「카드만」·「사용 안 함」
  assert.deepEqual(errors, []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
