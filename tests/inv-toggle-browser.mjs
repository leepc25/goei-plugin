// 소지품·가계부·상점 켜고 끄기 연계 (2026-11-08 전수점검): 진행 중에 끄고 다시 켤 때 상점 방문·표식·사용 자리·칸 구성 기록·메뉴가 맞게 바뀌는지, PC·폰.
// 사용법: node tests/inv-toggle-browser.mjs   (시험 카드 .scratch/fixture/fixture.json)
import assert from 'node:assert/strict';
import { boot, chatOf, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const CHAR = '철문을 밀자 기름 냄새가 밀려왔다.\n[▣|2025.01.01|02:47 PM|☀️|4°C|을지로 철물점|목표|없음|대기|관리국/요원|100000]\n[shop: 을지로 철물점|백사헌]';
const ITEMS = { list: [{ id: 'i_salt', name: '소금 봉지', desc: '두 봉지', effect: '', use: true, uses: 2, state: 'ok', from: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' }], log: [] };

const b = await launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
for (const vp of ['pc', 'phone']) {
  const chat = {
    message: [{ role: 'user', data: '철물점에 들어간다.', chatId: 'u1' }, { role: 'char', data: CHAR, chatId: 'c1' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_items: JSON.stringify(ITEMS), $st_item_use: JSON.stringify([{ id: 'i_salt', n: 1 }]) },
  };
  // 새 채팅 기본값: 소지품 끔 (6. 기본값 불러오기 시험용. 이 채팅에는 불러오기 전까지 안 쓰인다)
  const { page, errors } = await boot(b, fx, chat, vp, { store: { 'p:goei:prefs': JSON.stringify({ vars: { $it_on: '0' } }) } });
  const ss = async () => (await chatOf(page)).scriptstate;
  const flip = async (action, value) => {
    await page.evaluate(({ action, value }) => document.querySelector(`.gw [data-action="${action}"]${value ? `[data-value="${value}"]` : ''}`)?.click(), { action, value });
    await sleep(450);
  };
  // 상점 켬·끔은 설정 → 상점 격자의 첫 줄(기본 상점) 「사용」 칸 (2026-11-12 설정 개편: 격자). 보고 나서 소지품 페이지로 돌아온다
  const shopSwitch = async () => {
    await goNode(page, 'set:shop'); await sleep(250);
    const r = await page.evaluate(() => { const e = document.querySelector('.gw .ck-pc .ck-row .ck-cell button.ck-m'); return e ? { on: e.getAttribute('aria-pressed') === 'true', disabled: e.disabled } : null; });
    await goNode(page, 'set:items'); await sleep(250);
    return r;
  };

  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  // 응답 처리로 상점 방문을 만든다
  await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  check(JSON.parse((await ss()).$st_shop || 'null')?.shop === '을지로 철물점', `[${vp}] 방문이 안 생김`);

  // 1. 소지품 끔 → 상점도 꺼짐: 방문 닫힘·표식 지움·사용 자리 비움·상점 스위치 잠김
  await openEditor(page, 'set:items');
  await flip('set-inv-on', '0');
  let s = await ss();
  check(s.$it_on === '0', `[${vp}] 소지품 끔 저장 안 됨`);
  check(!s.$st_shop, `[${vp}] 소지품 끔: 방문이 남음`);
  check(!s.$st_item_use, `[${vp}] 소지품 끔: 사용 자리가 남음`);
  check(!(await chatOf(page)).message[1].data.includes('[shop:'), `[${vp}] 소지품 끔: 표식이 남음`);
  check((await shopSwitch())?.disabled === true, `[${vp}] 소지품 끔: 상점 스위치가 안 잠김`);
  // 2. 다시 켬 → 목록 그대로, 다시 켬 표시, 상점 스위치 풀림
  await flip('set-inv-on', '1');
  s = await ss();
  check(s.$it_on === '1' && JSON.parse(s.$st_items).list.length === 1, `[${vp}] 다시 켬: 목록이 바뀜`);
  check(s.$it_resumed === '2', `[${vp}] 다시 켬 표시 없음 (${s.$it_resumed})`);
  check((await shopSwitch())?.disabled === false, `[${vp}] 다시 켬: 상점 스위치가 잠긴 채`);

  // 3. 가계부를 상태창 칸 표에서 「안 씀」 → 상점 꺼짐(방문 닫힘), 칸 구성 기록. 다시 「사용」
  await page.evaluate(async () => { window.__chat.message[1].data += '\n[shop: 을지로 철물점|백사헌]'; await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  check(!!(await ss()).$st_shop, `[${vp}] 다시 방문이 안 생김`);
  await goNode(page, 'set:status');
  await flip('set-col', 'wallet:use:0');
  s = await ss();
  check(s.$st_col_wallet === 'off', `[${vp}] 잔고 칸 안 씀 저장 안 됨`);
  check(!s.$st_shop, `[${vp}] 잔고 칸 안 씀: 방문이 남음`);
  check(!(await chatOf(page)).message[1].data.includes('[shop:'), `[${vp}] 잔고 칸 안 씀: 표식이 남음`);
  check(JSON.parse(s.$st_col_log || '[]').length >= 1, `[${vp}] 칸 구성 기록 없음`);
  await goNode(page, 'set:items');
  check((await shopSwitch())?.disabled === true, `[${vp}] 가계부 끔: 상점 스위치가 안 잠김`);
  // 4. 둘 다 끄면 소지품 메뉴가 사라진다
  await flip('set-inv-on', '0');
  await closeEditor(page, true); await sleep(300);
  const menu = await page.evaluate(() => [...document.querySelectorAll('.gx [data-action="tab"][data-value="items"]')].length);
  check(menu === 0, `[${vp}] 둘 다 끔: 소지품 메뉴가 남음 (${menu})`);
  // 5. 다시 켜면 메뉴가 돌아오고 상점 스위치도 켜짐
  await openEditor(page, 'set:items');
  await flip('set-inv-on', '1');
  await goNode(page, 'set:items'); await sleep(250);
  await flip('set-wallet-on', '1');
  s = await ss();
  check(s.$it_on === '1' && s.$st_col_wallet === 'on', `[${vp}] 다시 켬 저장 안 됨 (${s.$it_on}, ${s.$st_col_wallet})`);
  const sw = await shopSwitch();
  check(sw?.disabled === false && sw?.on === true, `[${vp}] 다시 켬: 상점 스위치 ${JSON.stringify(sw)}`);

  // 6. 기본값 불러오기로 소지품이 꺼질 때도 같은 뒷정리 (새 채팅 기본값 $it_on 0)
  await closeEditor(page, true); await closeWin(page); await sleep(200);
  await page.evaluate(async () => { window.__chat.scriptstate.$st_item_use = JSON.stringify([{ id: 'i_salt', n: 1 }]); window.__chat.message[1].data += '\n[shop: 을지로 철물점|백사헌]'; await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
  await sleep(300);
  await openWin(page); await sleep(300);
  await openEditor(page, 'manage:backup'); // 2026-11-08 사용자: 기본값 불러오기는 점검 → 저장·불러오기
  await flip('set-bar', 'load');
  await flip('set-bar-yes');
  s = await ss();
  check(s.$it_on === '0', `[${vp}] 불러오기: 소지품이 안 꺼짐 (${s.$it_on})`);
  check(!s.$st_shop && !s.$st_item_use, `[${vp}] 불러오기: 방문·사용 자리가 남음`);
  check(!(await chatOf(page)).message[1].data.includes('[shop:'), `[${vp}] 불러오기: 표식이 남음`);
  // 되돌리기 → 소지품 다시 켜짐
  await flip('set-bar-undo');
  s = await ss();
  check(s.$it_on !== '0', `[${vp}] 되돌리기: 소지품이 안 켜짐 (${s.$it_on})`);

  check(errors.length === 0, `[${vp}] 콘솔 오류: ${errors.join(' / ')}`);
  await page.close();
}
await b.close();
if (fails.length) {
  console.error(fails.join('\n'));
  process.exit(1);
}
console.log('inv-toggle-browser 통과');
