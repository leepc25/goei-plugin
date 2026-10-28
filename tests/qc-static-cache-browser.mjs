// QC(정적 감사): 전역 상태(모듈 변수)가 채팅·지침 편집에 따라 제때 바뀌는지 — 채팅 A 의 값이 채팅 B 에 새지 않는지.
//  1) 지침(괴담넷 MAIN_CONTEXT)을 설정 창에서 고치면 바로 다음 요청의 참고 기록 머리말이 바뀐다 (예전엔 캐릭터를 바꿀 때까지 옛 규칙)
//  2) 같은 봇의 다른 채팅으로 바꾸면(채팅 화면은 그대로) 배색·상태창 칸 구성이 그 채팅 것으로 바뀐다
// 사용법: node tests/qc-static-cache-browser.mjs <fixture.json>
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { addUserPost, writeGnet, CFG } from '../dist-test/core.mjs';
import { launch, boot, open } from './qc-static-harness.mjs';

const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const MARK = 'QC_RULE_MARKER_7f3a';

function chatA() {
  let chat = {
    message: [{ role: 'user', data: '안녕' }, { role: 'char', data: '첫 장면\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'paper', $st_col_weather: 'hide', [CFG('mode')]: '2' }, // context 기본값('0') = 본편 반영 켬
  };
  const gn = { posts: [], dms: [], sources: {}, seq: 0 };
  addUserPost(gn, '익명1', '중림 지하상가 목격담', '3번 출구에서 또 봤음. 관리국 본부 근처.', '2025.01.01 10:00');
  return writeGnet(chat, gn);
}
const chatB = () => ({
  message: [{ role: 'user', data: '안녕' }, { role: 'char', data: '둘째 채팅\n[▣|2025.02.02|11:00 AM|☁️|9°C|서울역|없음]' }],
  scriptstate: { $st_faction: 'B00', $st_lang: 'ko', $st_fm: '1', $st_fixed_theme: 'light' },
});

const { browser } = await launch();
const { page, errors } = await boot(browser, fixture, chatA());
await page.evaluate((b) => { window.__chats.push(b); }, chatB());
await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });

const request = () => page.evaluate(() => window.__calls.replacers[0]([
  { role: 'system', content: '규칙' }, { role: 'user', content: '안녕' }, { role: 'assistant', content: '첫 장면' }, { role: 'user', content: '관리국 본부 근처 지하상가로 간다' },
], 'model'));
const systems = (req) => req.filter((m) => m.role === 'system').map((m) => m.content).join('\n---\n');

// 1) 지침 편집 → 다음 요청
{
  const before = systems(await request());
  assert.ok(before.includes('중림 지하상가 목격담'), `괴담넷 참고 기록이 요청에 들어가야 함:\n${before.slice(0, 500)}`);
  assert.ok(!before.includes(MARK));
  await open(page);
  await page.click('.gx-nav .gx-nb.desk[data-action="ed-open"]');
  await page.waitForSelector('.gw .gw-set');
  await page.click('[data-action="ed-tab"][data-value="guide"]');
  await page.click('[data-action="ed-node"][data-value="guide:GNet"]');
  await page.waitForSelector('textarea[data-input="ed-guide-sec"]');
  const ok = await page.evaluate((mark) => {
    const field = [...document.querySelectorAll('.gw-field')].find((f) => f.querySelector('b')?.textContent?.trim() === 'MAIN_CONTEXT');
    const ta = field?.querySelector('textarea');
    if (!ta) return false;
    ta.value = `${mark}\n${ta.value}`;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, MARK);
  assert.ok(ok, 'GNet 지침의 MAIN_CONTEXT 절 글칸');
  await page.click('[data-action="ed-guide-save"][data-value="GNet"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] || '{}').guides?.GNet);
  await page.click('.gw [data-action="ed-close"]');
  await page.click('[data-action="close"]');
  await page.waitForFunction(() => window.__calls.hide >= 1);
  const after = systems(await request());
  assert.ok(after.includes(MARK), `고친 지침이 바로 다음 요청에 들어가야 함 (캐릭터를 바꿀 때까지 옛 규칙이면 실패):\n${after.slice(0, 400)}`);
  assert.deepEqual(errors, []);
  console.log('PASS 지침을 고치면 바로 다음 요청의 참고 기록 규칙이 바뀜');
}

// 2) 같은 봇의 다른 채팅으로 (채팅 화면은 그대로)
{
  const theme = () => page.evaluate(() => document.querySelector('[x-goei-fab]')?.getAttribute('x-goei-theme'));
  const status = (t) => page.evaluate((t) => window.__calls.handlers.display(t), t);
  assert.equal(await theme(), 'paper', '채팅 A 배색');
  const a1 = await status('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]');
  assert.ok(!a1.includes('☀️') && a1.includes('4°C'), `채팅 A 는 날씨 칸 숨김(기온만):\n${a1}`);
  await page.evaluate(() => { window.__chatIndex = 1; });
  await page.waitForTimeout(2600); // 감시 루프 2바퀴
  assert.equal(await theme(), 'light', '채팅 B 로 바꾸면 B 의 배색 (채팅 A 배색이 남으면 실패)');
  const b1 = await status('[▣|2025.02.02|11:00 AM|☁️|9°C|서울역|없음]');
  assert.ok(b1.includes('☁️'), `채팅 B 는 날씨 칸 표시 (A 의 칸 구성이 남으면 실패):\n${b1}`);
  await open(page);
  assert.equal(await page.evaluate(() => document.querySelector('.gx').dataset.theme), 'light', '창 배색도 B');
  await page.click('[data-action="close"]');
  await page.evaluate(() => { window.__chatIndex = 0; });
  await page.waitForTimeout(2600);
  assert.equal(await theme(), 'paper', '다시 A 로');
  const a2 = await status('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]');
  assert.ok(!a2.includes('☀️'), 'A 의 칸 구성 복원');
  assert.deepEqual(errors, []);
  console.log('PASS 채팅을 바꾸면 배색·상태창 칸 구성이 그 채팅 것으로');
}

await browser.close();
