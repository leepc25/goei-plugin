// 내 모습 (2026-11-07): 시작 패널 「내 모습」 단계(페르소나만, 성별 → 그 성별 프리셋 격자, 고르지 않아도 됨)와 시작한 뒤 다시 고르는 창.
// 사용법: node tests/looks-browser.mjs <out-dir> [fixture.json]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { boot, chatOf, closeEditor, closeWin, launch, loadFixture, openWin, setChat, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const out = process.argv[2] ?? '/tmp/looks-shots';
const fx = loadFixture(process.argv[3] ?? new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(out, { recursive: true });
const looks = JSON.parse(distPack('goei-data-looks')).looks;
const men = looks.filter((r) => !r.unique && r.g === '남').length;
const women = looks.filter((r) => !r.unique && r.g === '여').length;
assert.equal(looks.length, 126, '팩: 126명');
assert.deepEqual([men, women], [31, 32], '팩: 일반 프리셋 남31·여32');

const b = await launch();
const fails = [];
for (const vp of ['pc', 'phone']) {
  const { page, errors } = await boot(b, fx, { message: [], scriptstate: {} }, vp, { store: { 'p:goei:data-looks': distPack('goei-data-looks') } });
  await openWin(page);
  // 설치·점검 창이 먼저 뜨면 닫는다
  await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForSelector('.gx-fac');
  const click = async (sel) => { await page.evaluate((q) => document.querySelector(q)?.click(), sel); await sleep(300); };
  const shot = (n, sel) => (sel ? page.locator(sel).first().screenshot({ path: `${out}/${vp}_${n}.png` }) : page.screenshot({ path: `${out}/${vp}_${n}.png` }));
  const heads = () => page.$$eval('.gx-body > section > h2', (els) => els.map((e) => e.textContent.trim()));
  await click('.gx-fac[data-value="A00"]');
  const h = await heads();
  if (!h.some((t) => t.startsWith('3내 모습'))) fails.push(`[${vp}] 페르소나: 내 모습 단계 없음 ${JSON.stringify(h)}`);
  await page.evaluate(() => document.querySelector('.gx-body section:nth-of-type(3)')?.scrollIntoView({ block: 'start' }));
  await sleep(200);
  await shot('1_성별전');
  await click('[data-action="look-g"][data-value="여"]');
  const nW = await page.$$eval('.gx-lookc:not(.none)', (els) => els.length);
  if (nW !== women) fails.push(`[${vp}] 여: ${nW}칸 (기대 ${women})`);
  await page.evaluate(() => document.querySelector('.gx-body section:nth-of-type(3)')?.scrollIntoView({ block: 'start' }));
  await sleep(200);
  await shot('2_여');
  await click('[data-action="look-g"][data-value="남"]');
  const nM = await page.$$eval('.gx-lookc:not(.none)', (els) => els.length);
  if (nM !== men) fails.push(`[${vp}] 남: ${nM}칸 (기대 ${men})`);
  // 격자 안쪽을 내려 고른 뒤에도 그 자리를 지키는지
  await page.evaluate(() => { const g = document.querySelector('.gx-lookg'); g.scrollTop = 600; });
  const pickId = await page.evaluate(() => [...document.querySelectorAll('.gx-lookc:not(.none)')][9].dataset.value);
  await click(`.gx-lookc[data-value="${pickId}"]`);
  const keep = await page.evaluate(() => document.querySelector('.gx-lookg').scrollTop);
  if (keep < 500) fails.push(`[${vp}] 고른 뒤 격자 스크롤이 맨 위로 (${keep})`);
  if (!(await page.$(`.gx-lookc.on[data-value="${pickId}"]`))) fails.push(`[${vp}] 고른 칸 표시 없음`);
  await page.evaluate(() => document.querySelector('.gx-body section:nth-of-type(3)')?.scrollIntoView({ block: 'start' }));
  await sleep(200);
  await shot('3_남_고름');
  // 움직임: 0.6초 뒤 배경 자리가 바뀐다
  const pos = () => page.$eval('.gx-lookc.on .gx-look', (e) => getComputedStyle(e).backgroundPositionX);
  const p1 = await pos(); await sleep(700); const p2 = await pos();
  if (p1 === p2) fails.push(`[${vp}] 대기 동작이 안 움직임 (${p1})`);
  // 고유 인물로 바꾸면 단계가 빠진다
  const agent = await page.evaluate(() => document.querySelector('.gx-whoc[data-value^="P"]')?.dataset.value);
  if (agent) {
    await click(`.gx-whoc[data-value="${agent}"]`);
    if ((await heads()).some((t) => t.includes('내 모습'))) fails.push(`[${vp}] 고유 인물인데 내 모습 단계가 보임`);
    await click('.gx-whoc[data-value=""]');
  }
  // 출발 → 채팅에 $st_look
  await click('.gx-sc');
  await click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length >= 1, null, { timeout: 15000 }).catch(() => {});
  const saved = (await chatOf(page)).scriptstate?.$st_look;
  if (saved !== pickId) fails.push(`[${vp}] 저장된 내 모습 ${saved} (기대 ${pickId})`);
  // 시작한 뒤 다시 고르는 창 (장착 상자가 부를 openLookPicker 와 같은 단추)
  await closeWin(page);
  await setChat(page, { message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문', chatId: 'c1' }], scriptstate: { ...(await chatOf(page)).scriptstate } });
  await openWin(page);
  await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.evaluate(() => { const x = document.createElement('button'); x.dataset.action = 'look-open'; x.id = 'lk'; document.querySelector('.gx-panel').appendChild(x); x.click(); });
  await sleep(400);
  await shot('4_다시고르기');
  const other = await page.evaluate(() => [...document.querySelectorAll('.gx-lookpop .gx-lookc:not(.none)')][2]?.dataset.value);
  await click(`.gx-lookpop .gx-lookc[data-value="${other}"]`);
  await sleep(300);
  const saved2 = (await chatOf(page)).scriptstate?.$st_look;
  if (saved2 !== other) fails.push(`[${vp}] 다시 고른 모습 ${saved2} (기대 ${other})`);
  await click('.gx-lookpop .gx-lookc.none');
  await sleep(300);
  if ((await chatOf(page)).scriptstate?.$st_look !== '') fails.push(`[${vp}] 고르지 않음이 안 지워짐`);
  if (errors.length) fails.push(`[${vp}] 페이지 오류: ${errors.join(' | ')}`);
  await page.close();
}
await b.close();
if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log(`ok · 사진 ${out}`);
