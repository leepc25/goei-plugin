// 쇼핑몰 사이트 확인 (2026-11-08, 작업용): node tests/_br_malls.mjs <사진 폴더>
// 우주 쇼핑몰: 열면 진열 → 장바구니 → 주문 → 입금 창 → 이체(가계부·소지품) / 운영자에게 질문(물건 붙이기·링크)
// 백일몽 포인트몰: 로그인 전 막힘 → 로그인 → 진열 → 포인트로 구매
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, goNode, launch, loadFixture, openEditor, openWin } from './qc-settings-harness.mjs';

const OUT = process.argv[2] || '.scratch/br-malls';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const ok = (result) => ({ type: 'success', result });
const COS_SHELF = `<shop-identity>
sells: 먼 별에서 왔다는 이상한 물건
never: 지구의 평범한 물건
prices: 원, 매우 비싸게
currency: won
</shop-identity>
<owner>
오늘은 새로운 물건이 도착 한 것이다!! 꿈의 통조림을 강하게 추천 하는 것이다.
</owner>
<shelf>
꿈의 통조림|999999|소모1|tin can|0.4|먹으면 꿈을 꾸는 것이다. 누구의 꿈 인지는 우리도 알지 않는다.|남의 꿈을 꾼다|특가:1500000
기억을 지우는 스푸레이|2400000|소모3|spray can|0.3|뿌리면 지워지는 것이다. 무엇이 지워지는 것 인지 고르는 것은 할 수 없다.|기억 일부 지움|희귀
끝까지 밝은 손의 전등|1200000|사용|flashlight|0.5|꺼지는 것을 하지 않는다. 진짜로 꺼지는 것을 하지 않는다.|꺼지지 않음|
별가루 소금|80000|소모5|salt|0.1|별에서 긁어 온 소금 인 것이다.||
</shelf>`;
const BM_SHELF = `<shop-identity>
sells: 임직원 복지 물품과 현장 보급품
never: 무기류
prices: 포인트, 정가
currency: points
</shop-identity>
<owner>
이번 주 생활용품 특가가 진행 중입니다.
</owner>
<shelf>
두루마리 휴지 30롤|90|소모30|toilet paper|0.1|생활 필수품.||특가:120
진공청소기|480|사용|vacuum cleaner|5|무선 진공청소기.||
미공개 시약 (등급 무작위)|1000|소모1|potion bottle|0.2|현장탐사팀 지급용.|무작위 효과|희귀
탈모약 (6개월분)|100|소모180|pill bottle|0.01|6개월분.||
</shelf>`;
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const chat = {
    message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_wallet: JSON.stringify({ start: 5000000, log: [] }), $st_points: JSON.stringify({ start: 12400, log: [{ id: 'p0', anchor: '', amount: 0, memo: '지급', src: 'manual', at: '2025-01-01T00:00:00Z' }] }) },
  };
  const { page, errors } = await boot(browser, fx, chat, size);
  let n = 0;
  const shot = async (tag) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  const ss = () => page.evaluate(() => window.__chat.scriptstate);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  const go = async (site) => {
    if (vp === 'pc') { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click(`.br-bm[data-value="${site}"]`); }
    else { await click('.gx-cgrip'); await click(`[data-action="br-site"][data-value="${site}"]`); }
    await page.waitForTimeout(300);
  };
  // 우주 쇼핑몰: 열면 진열대를 받는다 (자동 호출 기본 「창을 열 때」)
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, COS_SHELF);
  await go('cos');
  await page.waitForSelector('.cs-it', { timeout: 6000 });
  assert.equal(await page.locator('.cs-it').count(), 4);
  const call = await page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content).join('\n'));
  assert.ok(call.includes('우주 쇼핑몰 (cosmic-mall.alien)'), '우주몰 지침');
  assert.ok((await page.textContent('.cs-wel')).includes('꿈의 통조림'), '운영자 한마디');
  await shot('cos');
  // 장바구니 → 주문 → 입금 창 → 이체
  const ids = await page.evaluate(() => [...document.querySelectorAll('.cs-it')].map((e) => e.dataset.item));
  await click(`[data-action="mall-cart"][data-value="${ids[1]}"]`);
  await click(`[data-action="mall-cart"][data-value="${ids[3]}"]`);
  await click('[data-action="mall-page"][data-value="cart"]');
  await shot('cos-cart');
  await click('[data-action="mall-order"]');
  await shot('cos-pay');
  await click('[data-action="mall-pay"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$st_wallet || '').includes('store'));
  const w = JSON.parse((await ss()).$st_wallet);
  assert.equal(w.log.reduce((a, e) => a + e.amount, 0), -(999999 + 80000), '가계부에서 빠짐');
  const items = JSON.parse((await ss()).$st_items || '{}');
  assert.ok(JSON.stringify(items).includes('별가루 소금'), '소지품에 들어감');
  assert.equal(await page.locator('.cs-it').count(), 2, '산 것은 목록에서 빠짐');
  await shot('cos-paid');
  // 운영자에게 질문: 상품에서 열면 붙음, 답의 물건 이름은 링크
  await click(`[data-action="mall-ask"][data-value="${ids[2]}"]`);
  assert.equal(await page.locator('.q-card').count(), 1, '물건이 붙음');
  await page.fill('[data-input="mall-say"]', '이거 진짜 안 꺼져요?');
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<owner>\n진짜로 꺼지지 않는 것이다!! 끝까지 밝은 손의 전등 은 우리의 자랑 이다.\n</owner>\n<change mode="none">\n</change>' }]; });
  await click('[data-action="mall-say"]');
  await page.waitForSelector('.q-op .cs-ln', { timeout: 6000 });
  assert.ok((await page.textContent('.q-lg')).includes('[끝까지 밝은 손의 전등] 이거 진짜'), '내 질문에 물건 이름');
  await shot('cos-ask');
  await click('[data-action="mall-pick"]');
  await shot('cos-ask-pick');
  await click('[data-action="mall-ask-close"]');
  // 백일몽 포인트몰: 로그인 전에는 막힘
  await go('bm');
  assert.equal(await page.locator('.bp-need').count(), 1, '로그인 필요');
  await shot('bm-login');
  await click('.ms [data-action="br-login"]');
  await page.fill('input[name="br-nick"]', '은하제');
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, BM_SHELF);
  await click('[data-action="br-login-save"]');
  await page.waitForTimeout(300);
  if (!(await page.locator('.bp-it').count())) await click('[data-action="br-reload"]');
  await page.waitForSelector('.bp-it', { timeout: 6000 });
  assert.ok((await page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content).join('\n'))).includes('백일몽 포인트몰'), '포인트몰 지침');
  await shot('bm');
  const bid = await page.evaluate(() => [...document.querySelectorAll('.bp-it')].find((e) => e.textContent.includes('진공청소기')).dataset.item);
  await click(`[data-action="mall-buy"][data-value="${bid}"]`);
  await page.waitForFunction(() => (window.__chat.scriptstate.$st_points || '').includes('진공청소기'));
  assert.ok((await page.textContent('.bp-pt')).includes('11,920'), '포인트 차감');
  await shot('bm-bought');
  await click('[data-action="mall-page"][data-value="rare"]');
  await shot('bm-rare');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '가로 넘침 없음');
  // 설정: 사이트마다 값 따로
  await openEditor(page, 'set:cos'); await shot('set-cos');
  await click('.gw [data-action="ms-cfg"][data-value="cos:auto=manual"]');
  await page.fill('.gw [data-change="ms-num"][data-key="cos:max"]', '15');
  await page.dispatchEvent('.gw [data-change="ms-num"][data-key="cos:max"]', 'change');
  await page.waitForTimeout(400);
  const st2 = await ss();
  assert.equal(st2.$cos_sh_auto, 'manual');
  assert.equal(st2.$bm_sh_auto, undefined);
  assert.equal(st2.$cos_sh_max, '15', '상품 수 최대');
  await goNode(page, 'set:bm'); await shot('set-bm');
  await goNode(page, 'guide:Cos'); await shot('guide-cos');
  if (errors.length) console.log(vp, 'page errors:', errors.slice(0, 5));
  assert.deepEqual(errors, []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
