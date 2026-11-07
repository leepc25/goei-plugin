// 아바타 (2026-11-07~08): 시작 패널 「내 페르소나」 아래 아바타 칸 → 팝업(성별 → 그 성별 일반 프리셋 + 고른 세력 전용 프리셋, 정면 대기 동작)에서 꼭 고름.
// 세력 전용(관리국·가짜 관리국·백일몽 직원)은 그 세력일 때만. 시작한 뒤에도 같은 팝업으로 바꾼다.
// 사용법: node tests/looks-browser.mjs <out-dir> [fixture.json]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { boot, chatOf, closeEditor, closeWin, launch, loadFixture, openWin, setChat, sleep } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const out = process.argv[2] ?? '/tmp/looks-shots';
const fx = loadFixture(process.argv[3] ?? new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(out, { recursive: true });
const looks = JSON.parse(distPack('goei-data-looks')).looks;
assert.equal(looks.length, 126, '팩: 126명');
const count = (g, fac) => looks.filter((r) => !r.unique && r.g === g && (!r.fac || r.fac === fac)).length;
assert.deepEqual(looks.filter((r) => r.fac).map((r) => r.fac).sort().join(''), 'A00A00A00A00B00B00B00B00B00B00C00C00C00C00', '세력 전용: 관리국 4 · 가짜 관리국 6 · 백일몽 4');

const b = await launch();
const fails = [];
for (const vp of ['pc', 'phone']) {
  const { page, errors } = await boot(b, fx, { message: [], scriptstate: {} }, vp, { store: { 'p:goei:data-looks': distPack('goei-data-looks') } });
  await openWin(page);
  await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForSelector('.gx-fac');
  const click = async (sel) => { await page.evaluate((q) => document.querySelector(q)?.click(), sel); await sleep(300); };
  const shot = (n) => page.screenshot({ path: `${out}/${vp}_${n}.png` });
  const cells = () => page.$$eval('.gx-lookpop .gx-lookc', (els) => els.length);
  await click('.gx-fac[data-value="A00"]');
  const heads = await page.$$eval('.gx-body > section > h2', (els) => els.map((e) => e.textContent.trim()));
  if (!heads.includes('3아바타')) fails.push(`[${vp}] 아바타 단계 없음 ${JSON.stringify(heads)}`);
  if (!(await page.isDisabled('.gx-lookchip'))) fails.push(`[${vp}] 성별 전에 아바타 칸이 열림`);
  if (!(await page.isDisabled('.gx-start'))) fails.push(`[${vp}] 아바타 없이 출발이 열림`);
  await page.evaluate(() => document.querySelector('.gx-lookstep')?.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await shot('1_시작패널_고르기전');
  await click('[data-action="look-sex"][data-value="여"]');
  await click('.gx-lookchip');
  if ((await cells()) !== count('여', 'A00')) fails.push(`[${vp}] 관리국 여: ${await cells()}칸 (기대 ${count('여', 'A00')})`);
  await shot('2_팝업_여_관리국');
  await click('[data-action="look-close"]');
  await click('[data-action="look-sex"][data-value="남"]');
  await click('.gx-lookchip');
  if ((await cells()) !== count('남', 'A00')) fails.push(`[${vp}] 관리국 남: ${await cells()}칸 (기대 ${count('남', 'A00')})`);
  const names = await page.$$eval('.gx-lookpop .gx-lookc', (els) => els.map((e) => e.dataset.value));
  const fake = looks.filter((r) => r.fac === 'B00').map((r) => r.id);
  if (names.some((id) => fake.includes(id))) fails.push(`[${vp}] 관리국인데 가짜 관리국 그림이 보임`);
  // 움직임
  const pos = () => page.$eval('.gx-lookpop .gx-look', (e) => getComputedStyle(e).backgroundPositionX);
  const p1 = await pos(); await sleep(700); const p2 = await pos();
  if (p1 === p2) fails.push(`[${vp}] 대기 동작이 안 움직임 (${p1})`);
  const own = looks.find((r) => r.fac === 'A00' && r.g === '남').id;
  await click(`.gx-lookpop .gx-lookc[data-value="${own}"]`);
  if (await page.$('.gx-lookpop')) fails.push(`[${vp}] 고른 뒤 팝업이 안 닫힘`);
  await page.evaluate(() => document.querySelector('.gx-lookstep')?.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await shot('3_시작패널_고른뒤');
  // 세력을 바꾸면 그 세력 전용 아바타는 빠진다
  await click('.gx-fac[data-value="C00"]');
  if (await page.$('.gx-lookchip.on')) fails.push(`[${vp}] 백일몽으로 바꿨는데 관리국 아바타가 남음`);
  await click('.gx-fac[data-value="A00"]');
  await click('.gx-lookchip');
  await click(`.gx-lookpop .gx-lookc[data-value="${own}"]`);
  // 기존 인물을 고르면 아바타 칸은 그 인물 성별·모습으로 잠긴다
  const agent = await page.evaluate(() => document.querySelector('.gx-whoc[data-value^="P"]')?.dataset.value);
  await click(`.gx-whoc[data-value="${agent}"]`);
  if (!(await page.$('.gx-lookstep.locked .gx-lookface'))) fails.push(`[${vp}] 기존 인물인데 아바타 칸에 그 인물 모습이 없음`);
  if (!(await page.$('.gx-lookstep.locked .gx-seg.on'))) fails.push(`[${vp}] 기존 인물 성별이 안 들어감`);
  if (!(await page.isDisabled('.gx-lookchip'))) fails.push(`[${vp}] 기존 인물인데 아바타 칸이 열림`);
  await page.evaluate(() => document.querySelector('.gx-lookstep')?.scrollIntoView({ block: 'center' }));
  await sleep(200);
  await shot('5_기존인물');
  await click('.gx-whoc[data-value=""]');
  await click('.gx-sc');
  if (await page.isDisabled('.gx-start')) fails.push(`[${vp}] 아바타를 골랐는데 출발이 막힘`);
  await click('.gx-start');
  await page.waitForFunction(() => window.__calls.setChat.length >= 1, null, { timeout: 15000 }).catch(() => {});
  const saved = (await chatOf(page)).scriptstate?.$st_look;
  if (saved !== own) fails.push(`[${vp}] 저장된 아바타 ${saved} (기대 ${own})`);
  // 시작한 뒤 다시 고르는 팝업 (장착 상자가 부를 openLookPicker 와 같은 단추)
  await closeWin(page);
  await setChat(page, { message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: '본문', chatId: 'c1' }], scriptstate: { ...(await chatOf(page)).scriptstate } });
  await openWin(page);
  await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.evaluate(() => { const x = document.createElement('button'); x.dataset.action = 'look-open'; document.querySelector('.gx-panel').appendChild(x); x.click(); });
  await sleep(400);
  await click('[data-action="look-g"][data-value="남"]');
  await shot('4_시작뒤_팝업');
  const other = await page.evaluate(() => [...document.querySelectorAll('.gx-lookpop .gx-lookc')][2]?.dataset.value);
  await click(`.gx-lookpop .gx-lookc[data-value="${other}"]`);
  await sleep(300);
  if ((await chatOf(page)).scriptstate?.$st_look !== other) fails.push(`[${vp}] 다시 고른 아바타 저장 안 됨`);
  if (errors.length) fails.push(`[${vp}] 페이지 오류: ${errors.join(' | ')}`);
  await page.close();
}
await b.close();
if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log(`ok · 사진 ${out}`);
