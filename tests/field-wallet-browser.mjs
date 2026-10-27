// 필드 가계부 (bridge.wallet): 들어가면 오른쪽 위에 잔고, 필드 거래는 같은 장부에 적고 장부 사건(trade)을 남긴다
import assert from 'node:assert/strict';
import { openField, enterHub } from './field-harness.mjs';

const { browser, page, errors } = await openField({ width: 1600, height: 900, panel: false });
try {
  await enterHub(page);
  await page.waitForFunction(() => window.__goeiWallet?.balance() === 140000, null, { timeout: 5000 });
  const after = await page.evaluate(() => window.__goeiWallet.pay(-1200, '삼각김밥'));
  assert.equal(after, 138800);
  const h = await page.evaluate(() => ({ won: window.__h.won, trades: window.__h.trades, rec: window.__h.records.filter((r) => r.kind === 'trade') }));
  assert.deepEqual(h.trades, [[-1200, '삼각김밥']]);
  assert.equal(h.rec.length, 1);
  assert.match(h.rec[0].text, /삼각김밥 −1,200원/);
  assert.ok(h.rec[0].visit, '방문 id');
  // 필드 가게: 종로 큰길 편의점에서 사면 가계부에서 빠지고 가방은 채팅 상태($fd_state)에 저장
  await page.evaluate(() => window.__goeiEngine.world.stage.jump('jongno', 1300));
  await page.waitForTimeout(1500);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.gf-shop:not([hidden])');
  await page.click('.gf-shop [data-buy="onigiri"]');
  await page.waitForFunction(() => window.__h.won === 138800 - 1200);
  const fd = await page.evaluate(() => JSON.parse(window.__h.fd));
  assert.equal(fd.bag.onigiri, 1);
  assert.equal(fd.shops.cvs.stock.onigiri, 7);
  assert.ok((await page.evaluate(() => window.__h.trades)).some(([n, m]) => n === -1200 && /편의점 삼각김밥/.test(m)));
  // 가방이 바뀌면 본편에 확정 사실 「필드 가방」
  await page.waitForFunction(() => window.__h.records.some((r) => r.fact?.key === '필드 가방' && r.fact.value === '삼각김밥×1'));
  await page.keyboard.press('Escape');
  assert.deepEqual(errors.filter((e) => !/favicon/.test(e)), []);
  console.log('field-wallet-browser 통과');
} finally {
  await browser.close();
}
