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
  assert.deepEqual(errors.filter((e) => !/favicon/.test(e)), []);
  console.log('field-wallet-browser 통과');
} finally {
  await browser.close();
}
