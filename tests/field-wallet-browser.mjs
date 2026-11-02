// 필드 가계부 (bridge.wallet): 들어가면 오른쪽 위에 잔고. 필드 안 돈은 바로 잔고에 보이고 장부 사건(trade)을 남기며,
// 가계부에는 필드가 끝날 때 한 줄로 정산한다 (10-31 F14). 방문 시작·끝 표식(enter_field/exit_field)으로 플러그인이 보고서 한 장을 만든다
import assert from 'node:assert/strict';
import { openField, enterHub } from './field-harness.mjs';

const { browser, page, errors } = await openField({ width: 1600, height: 900, panel: false });
try {
  await enterHub(page);
  await page.waitForFunction(() => window.__goeiWallet?.balance() === 140000, null, { timeout: 5000 });
  const after = await page.evaluate(() => window.__goeiWallet.pay(-1200, '삼각김밥'));
  assert.equal(after, 138800);
  const h = await page.evaluate(() => ({ won: window.__h.won, trades: window.__h.trades, rec: window.__h.records.filter((r) => r.kind === 'trade') }));
  assert.deepEqual(h.trades, [], '가계부는 필드가 끝날 때 한 줄');
  assert.equal(h.rec.length, 1);
  assert.match(h.rec[0].text, /Money: -1200 삼각김밥/, '모델 글(활동 결과)은 영어');
  assert.match(h.rec[0].ko, /삼각김밥 −1,200원/, '보고서 글은 한글');
  assert.ok(h.rec[0].visit, '방문 id');
  const enter = await page.evaluate(() => window.__h.records.find((r) => r.kind === 'enter_field'));
  assert.ok(enter && enter.visit === h.rec[0].visit && enter.ko === '필드 입장', '방문 시작 표식');
  // 필드 가게(편의점)는 10-31 사용자 「실제로 없고 역할도 없다」로 지도에서 뺐다 → 돈 한 번 더 (가방 확정 사실 시험은 가게가 다시 생길 때)
  await page.evaluate(() => window.__goeiWallet.pay(-1200, '삼각김밥'));
  // 나오지 않고 응답을 보냄 → 필드 강제 종료: 가계부 한 줄 정산, 끝 표식 하나, 창 닫힘. 두 번 불려도 한 번만
  await page.evaluate(() => window.__h.beforeSend());
  await page.evaluate(() => window.__h.beforeSend?.());
  const end = await page.evaluate(() => ({ trades: window.__h.trades, won: window.__h.won, exits: window.__h.records.filter((r) => r.kind === 'exit_field'), closed: window.__h.closed }));
  assert.equal(end.trades.length, 1, JSON.stringify(end.trades));
  assert.equal(end.trades[0][0], -2400);
  assert.equal(end.won, 140000 - 2400);
  assert.equal(end.exits.length, 1, '끝 표식은 한 번');
  assert.match(end.exits[0].ko, /응답을 보내 필드 종료$/);
  assert.equal(end.exits[0].visit, enter.visit);
  assert.ok(end.closed >= 1, '창 닫힘');
  assert.deepEqual(errors.filter((e) => !/favicon/.test(e)), []);
  console.log('field-wallet-browser 통과');
} finally {
  await browser.close();
}
