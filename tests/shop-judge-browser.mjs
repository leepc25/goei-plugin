// 상점 판단·고유 상점 (11-09 사용자): 설정 「상점 판단」·「고유 상점」 표, 인터넷 접속 표식 → 「접속하기」 → 상황판 없이 인터넷 창만 그 몰로. PC·폰.
// 사용법: node tests/shop-judge-browser.mjs <out-dir>
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/shop-judge-shots';
mkdirSync(out, { recursive: true });
const CHAR = '휴대폰으로 우주 쇼핑몰 앱을 열었다. 번쩍이는 배너가 화면을 채웠다.\n[▣|2025.01.01|02:47 PM|☀️|4°C|사무실|목표]\n[shop: 우주쇼핑몰|@web]';

const b = await launch();
const errorsAll = [];
for (const vp of ['pc', 'phone']) {
  const chat = {
    message: [{ role: 'user', data: '쇼핑몰 앱을 연다.', chatId: 'u1' }, { role: 'char', data: CHAR, chatId: 'c1' }],
    scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $sh_judge: 'updater' },
  };
  const { page, errors } = await boot(b, fx, chat, vp);
  const shot = (n) => page.screenshot({ path: `${out}/${vp}_${n}.png` });
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  // 1. 갱신기를 골랐지만 인물 기록이 꺼져 있으니 메인이 대신 → 응답 처리에서 접속 표식으로 정리
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  const data = await page.evaluate(() => window.__chat.message[1].data);
  if (!data.endsWith('[shop: 우주 쇼핑몰|@web:cos]')) errorsAll.push(`[${vp}] web tag: ${data.slice(-60)}`);
  if (await page.evaluate(() => window.__chat.scriptstate.$st_shop)) errorsAll.push(`[${vp}] shop visit opened for web`);
  const html = await page.evaluate((t) => window.__calls.handlers.display(t), data);
  if (!html.includes('접속하기') || !html.includes('data-goei-shop="cos"')) errorsAll.push(`[${vp}] card: ${html.slice(-300)}`);
  // 2. 카드 「접속하기」 → 인터넷 창만
  await closeWin(page); await sleep(200);
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:1'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await page.evaluate((t) => window.__calls.handlers.display(t), data);
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForFunction(() => !!document.querySelector('.gx-netsolo .br-p-cos'), null, { timeout: 8000 }).catch(() => {}); await sleep(400);
  const solo = await page.evaluate(() => ({ cos: !!document.querySelector('.gx-netsolo .br-p-cos'), nav: [...document.querySelectorAll('.gx-tabs, .gx-nav')].some((e) => e.offsetParent), close: !!document.querySelector('.gx-head [data-action="close"]') }));
  if (!solo.cos || solo.nav || !solo.close) errorsAll.push(`[${vp}] net solo: ${JSON.stringify(solo)}`);
  await shot('net-solo');
  // 닫고 다시 열면 평소 상황판
  await closeWin(page); await sleep(200);
  await openWin(page); await sleep(300);
  if (!(await page.evaluate(() => [...document.querySelectorAll('.gx-tabs, .gx-nav')].some((e) => e.offsetParent)))) errorsAll.push(`[${vp}] solo stuck after close`);
  // 3. 설정 → 상점: 판단(대신 안내)·고유 상점 표, 줄 더하고 이름 적기 (v0.21.10 설정창 개편: 상점은 따로 쪽, 줄 이름 「판단」)
  await openEditor(page, 'set:shop'); await sleep(300);
  const row = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.gw .ps-row')];
    const j = rows.find((r) => r.querySelector('.ps-label b')?.textContent?.trim() === '판단');
    j?.scrollIntoView({ block: 'start' });
    return { judge: j?.querySelector('small')?.textContent ?? '', own: document.querySelectorAll('.gw [data-key$=":name"][data-change="set-own"]').length };
  });
  if (!row.judge.includes('메인 모델로 대신합니다') || row.own !== 3) errorsAll.push(`[${vp}] settings: ${JSON.stringify(row)}`);
  await shot('settings-judge');
  // 기본 표는 우주 쇼핑몰·백일몽 포인트몰·망상홈쇼핑 세 줄 (v0.21.6에서 망상홈쇼핑 더함) → 네 번째 줄을 더해 이름 적기
  await page.evaluate(() => document.querySelector('.gw [data-action="set-own-add"]').click()); await sleep(400);
  const inp = page.locator('.gw [data-change="set-own"][data-key$=":name"]').nth(3);
  await inp.fill('심야편의점'); await inp.blur(); await sleep(600);
  const own = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$sh_own || '[]').map((o) => `${o.name}|${o.web}|${o.visit}`));
  if (own.length !== 4 || own[3] !== '심야편의점||shop') errorsAll.push(`[${vp}] own add: ${JSON.stringify(own)}`);
  await sleep(500);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.gw [data-change="set-own"][data-key$=":name"]')].map((e) => e.value));
  if (shown[3] !== '심야편의점') errorsAll.push(`[${vp}] own shown: ${JSON.stringify(shown)}`);
  await page.evaluate(() => document.querySelectorAll('.gw .ms-fx')[3]?.scrollIntoView({ block: 'center' })); await sleep(200);
  await shot('settings-own');
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
