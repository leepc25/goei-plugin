// 쌓이는 목록의 「더 보기」 (2026-11-12 사용자: 일지 500줄이 한 번에 다 그려져 스크롤이 길다. 몇 줄만 보이고 더 보기를 눌러야 더 나오게.
// 「그 더보기는 해당 창 벗어나면 다시 초기화」). 일지·연대기·가계부 거래·소지품 기록이 같은 규칙 (ui/more.ts, core/paging.ts).
// 사용: node tests/recmore-browser.mjs <fixture.json> [사진 폴더]
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, closeWin, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fx = loadFixture(args[0] || new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const OUT = args[1] || '.scratch/recmore';
mkdirSync(OUT, { recursive: true });

const N = 200;
const DAY0 = Date.UTC(2025, 0, 1) / 60000;
/** 일지 200줄: 하루 16줄씩, 홀수 줄은 내 사건. 맨 마지막(가장 최근) 줄이 #200 */
const rows = Array.from({ length: N }, (_, i) => {
  const n = i + 1;
  const at = DAY0 + Math.floor(i / 16) * 1440 + (i % 16) * 60 + 30;
  return { id: `j${n}`, kind: n % 3 === 0 ? 'in' : 'an', name: `시험 상황 ${String(n).padStart(3, '0')}`, loc: '11', ...(n % 3 ? { grade: 'D' } : {}), at, since: at - 40, born: at - 60, idx: 1, anchor: 'c1', mine: n % 2 === 1, cause: 'model', agents: [], result: `결과 ${n}`, ...(n >= 195 ? { rpt: `r${n}` } : {}) };
});
const reports = rows.filter((r) => r.rpt).map((r) => ({ id: r.rpt, no: `R-${r.id}`, full: false, mine: r.mine, kind: r.kind, cause: 'model', head: { name: r.name, loc: r.loc, born: r.born, since: r.since, at: r.at, duration: 40 }, trail: [], agents: [], result: r.result, idx: 1, anchor: 'c1', savedAt: '2025-01-01T00:00:00Z' }));
const wallet = { start: 140000, log: Array.from({ length: 120 }, (_, i) => ({ id: `w${i + 1}`, anchor: '', amount: i % 2 ? -1000 - i : 2000 + i, memo: `시험 거래 ${String(i + 1).padStart(3, '0')}`, src: 'story' })) };
const items = { list: [], log: Array.from({ length: 90 }, (_, i) => ({ id: `l${i + 1}`, name: `시험 물건 ${String(i + 1).padStart(3, '0')}`, what: i % 2 ? 'use' : 'get', by: 'story', anchor: 'c1', at: '2025.01.01 02:47 AM' })) };
const mkChat = () => ({
  message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]', chatId: 'c1' }],
  scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0',
    $goei_journal: JSON.stringify({ v: 1, rows }), $goei_reports: JSON.stringify({ v: 1, items: reports }), $st_wallet: JSON.stringify(wallet), $st_items: JSON.stringify(items) },
});

const browser = await launch();
const results = [];
for (const [vp, size] of [['pc', { width: 1920, height: 1080, touch: false }], ['phone', 'phone']]) {
  const { page, errors } = await boot(browser, fx, mkChat(), size);
  const T = (name) => results.push(`[${vp}] ${name}`);
  const tab = async (v) => { await page.locator(`.gx :is([data-action="tab"], [data-action="nav-tab"])[data-value="${v}"]:visible`).first().click(); await sleep(250); };
  const sub = async (v) => { await page.locator(`.gx [data-action="rec-sub"][data-value="${v}"]:visible`).first().click(); await sleep(250); };
  const count = (sel) => page.locator(`.gx ${sel}`).count();
  const moreText = (box) => page.evaluate((box) => document.querySelector(`.gx ${box} [data-action="list-more"]`)?.textContent.replace(/\s+/g, ' ').trim() ?? null, box);
  const more = async (box) => { await page.locator(`.gx ${box} [data-action="list-more"]`).click(); await sleep(250); };
  const shot = (tag) => page.screenshot({ path: `${OUT}/${vp}-${tag}.png` });
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);

  // ── 일지 ──
  await tab('records');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 30, '일지: 처음 30줄만 DOM에');
  assert.equal(await moreText('.gx-jr-list'), '더 보기 남은 170줄');
  const first = await page.evaluate(() => document.querySelector('.gx .gx-jr-list .gx-jr-row b')?.textContent);
  assert.equal(first, '시험 상황 200', '최근 것이 맨 위');
  // 날짜 머리의 건수는 그날 전체 (잘린 날도): 마지막에 보이는 날 = 16줄짜리 날인데 14줄만 보인다
  const heads = await page.evaluate(() => [...document.querySelectorAll('.gx .gx-jr-list .gx-jr-day')].map((s) => ({ em: s.querySelector('h3 em').textContent, n: s.querySelectorAll('.gx-jr-row').length })));
  const sumOf = (em) => (em.match(/\d+/g) ?? []).map(Number).reduce((a, b) => a + b, 0);
  assert.deepEqual(heads.map((h) => h.n), [8, 16, 6], '8줄(마지막 날) + 16 + 잘린 6');
  assert.deepEqual(heads.map((h) => sumOf(h.em)), [8, 16, 16], '머리 건수는 그날 전체');
  T('일지 처음 30줄, 남은 170줄, 날짜 머리는 그날 전체');
  await page.evaluate(() => document.querySelector('.gx .gx-jr-list [data-action="list-more"]').scrollIntoView({ block: 'center' })); await sleep(200);
  await shot('journal-30');
  const top0 = await page.evaluate(() => document.querySelector('.gx .gx-body').scrollTop);
  await more('.gx-jr-list');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 60, '더 보기 → 60줄');
  assert.equal(await moreText('.gx-jr-list'), '더 보기 남은 140줄');
  assert.equal(await page.evaluate(() => document.querySelector('.gx .gx-body').scrollTop), top0, '더 보기를 눌러도 읽던 자리 그대로');
  T('더 보기 → 60줄, 남은 140줄, 스크롤 자리 유지');
  // 보고서 팝업을 열었다 닫아도 펼친 채
  await page.evaluate(() => document.querySelector('.gx .gx-body').scrollTo(0, 0));
  await page.locator('.gx .gx-jr-list button.gx-jr-row').first().click(); await sleep(250);
  assert.equal(await count('.gx-rptpop'), 1, '보고서 팝업');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 60, '팝업 뒤 목록도 60줄 그대로');
  await page.locator('.gx .gx-rptpop .gx-agpop-x').click(); await sleep(250);
  assert.equal(await count('.gx-rptpop'), 0);
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 60, '보고서 팝업을 닫아도 60줄');
  T('보고서 팝업 열고 닫아도 펼친 채');
  // 찾기는 전체에서 (31번째 이후 줄도), 목록만 다시 그려 입력칸 초점 유지
  const Q = '.gx input[data-input="rec-q"]';
  if (vp === 'phone') { await page.evaluate(() => document.querySelector('.gx .gx-rdrawer [data-action]')?.click()); await sleep(200); }
  const qVisible = await page.locator(`${Q}:visible`).count();
  const typeQ = async (text) => {
    if (qVisible) { await page.locator(`${Q}:visible`).first().fill(text); } else { await page.evaluate(([q, t]) => { const el = document.querySelector(q); el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, [Q, text]); }
    await sleep(250);
  };
  await typeQ('시험 상황 007');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 1, '찾기: 194번째 줄도 찾는다');
  assert.equal(await moreText('.gx-jr-list'), null, '남은 줄이 없으면 단추 없음');
  if (qVisible) assert.equal(await page.evaluate(() => document.activeElement?.dataset?.input), 'rec-q', '찾기 칸 초점 유지');
  await typeQ('시험 상황 1');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 30, '찾은 결과(100~199 = 100줄)도 30줄로 끊는다');
  assert.equal(await moreText('.gx-jr-list'), '더 보기 남은 70줄');
  await typeQ('');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 30, '찾기 글이 바뀌면 처음 줄 수부터');
  T('찾기는 전체 200줄에서, 결과도 30줄씩, 초점 유지');
  // 거르기 칩: 전체에서 거르고 처음부터
  await more('.gx-jr-list');
  await page.evaluate(() => document.querySelector('.gx [data-action="rec-filter"][data-value="mine"]').click()); await sleep(250);
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 30);
  assert.equal(await moreText('.gx-jr-list'), '더 보기 남은 70줄', '내 사건 100줄 가운데 30');
  await page.evaluate(() => document.querySelector('.gx [data-action="rec-filter"][data-value="all"]').click()); await sleep(250);
  T('거르기 칩을 바꾸면 처음 줄 수부터');
  // 하위 탭을 바꿨다 오면 30
  await more('.gx-jr-list'); await more('.gx-jr-list');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 90);
  await sub('people'); await sub('journal');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 30, '하위 탭을 바꿨다 오면 30줄');
  T('하위 탭 바꿨다 오면 30줄');
  // 다른 메뉴로 나갔다 오면 30
  await more('.gx-jr-list');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 60);
  await tab('board'); await tab('records');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 30, '다른 메뉴로 나갔다 오면 30줄');
  T('다른 메뉴로 나갔다 오면 30줄');
  // 창을 닫았다 열면 30
  await more('.gx-jr-list');
  await closeWin(page); await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  if (!(await count('.gx-jr-list'))) await tab('records');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 30, '창을 닫았다 열면 30줄');
  T('창을 닫았다 열면 30줄');

  // ── 연대기 (내 사건 100줄) ──
  await sub('chronicle');
  assert.equal(await count('.gx-chron .gx-cr-row'), 30, '연대기: 처음 30줄');
  assert.equal(await moreText('.gx-chron'), '더 보기 남은 70줄');
  await more('.gx-chron');
  assert.equal(await count('.gx-chron .gx-cr-row'), 60);
  await sub('journal'); await sub('chronicle');
  assert.equal(await count('.gx-chron .gx-cr-row'), 30, '연대기도 벗어나면 처음부터');
  await page.evaluate(() => document.querySelector('.gx .gx-chron [data-action="list-more"]').scrollIntoView({ block: 'center' })); await sleep(200);
  await shot('chronicle-30');
  T('연대기 30 → 60 → 벗어나면 30');

  // ── 가계부 거래 (120건) ──
  await tab('items');
  await page.locator('.gx [data-action="items-sub"][data-value="wallet"]:visible').first().click(); await sleep(300);
  assert.equal(await count('.gx-wt-list .gx-wt-row'), 30, '가계부: 처음 30건');
  assert.equal(await moreText('.gx-wt-list'), '더 보기 남은 90건');
  await more('.gx-wt-list');
  assert.equal(await count('.gx-wt-list .gx-wt-row'), 60);
  await page.evaluate(() => document.querySelector('.gx [data-action="wallet-filter"][data-value="out"]').click()); await sleep(250);
  assert.equal(await count('.gx-wt-list .gx-wt-row'), 30, '지출 60건 가운데 30');
  assert.equal(await moreText('.gx-wt-list'), '더 보기 남은 30건');
  await page.evaluate(() => document.querySelector('.gx [data-action="wallet-filter"][data-value="all"]').click()); await sleep(250);
  await page.evaluate(() => document.querySelector('.gx .gx-wt-list [data-action="list-more"]').scrollIntoView({ block: 'center' })); await sleep(200);
  await shot('wallet-30');
  T('가계부 30 → 60, 거르면 처음부터');

  // ── 소지품 기록 (90줄) ──
  await page.locator('.gx [data-action="items-sub"][data-value="items"]:visible').first().click(); await sleep(250);
  await page.evaluate(() => document.querySelector('.gx [data-action="items-view"][data-value="log"]').click()); await sleep(300);
  assert.equal(await count('.it-log .gx-wt-row'), 30, '소지품 기록: 처음 30줄');
  assert.equal(await moreText('.it-log'), '더 보기 남은 60줄');
  await more('.it-log'); await more('.it-log');
  assert.equal(await count('.it-log .gx-wt-row'), 90);
  assert.equal(await moreText('.it-log'), null, '다 보이면 단추 없음');
  await page.evaluate(() => document.querySelector('.gx [data-action="items-view"][data-value="grid"]').click()); await sleep(250);
  await page.evaluate(() => document.querySelector('.gx [data-action="items-view"][data-value="log"]').click()); await sleep(250);
  assert.equal(await count('.it-log .gx-wt-row'), 30, '물건으로 갔다 오면 30줄');
  T('소지품 기록 30 → 90(단추 없음) → 벗어나면 30');

  // ── 설정: 한 번에 보일 줄 수 ──
  await openEditor(page, 'set:journal'); await sleep(300);
  const txt = await page.textContent('.gw .gw-setbody');
  assert.ok(txt.includes('한 번에 보일 줄 수') && txt.includes('30줄'), '설정 줄이 있다');
  const box = await page.evaluate(() => { const b = document.querySelector('.gw [data-action="jr-step"][data-value="list_page:-"]').closest('.st-step').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
  assert.equal(box.h, 34, '숫자 상자 높이 34 (공통 규격)');
  await page.screenshot({ path: `${OUT}/${vp}-setting.png` });
  await page.click('.gw [data-action="jr-step"][data-value="list_page:-"]'); await page.waitForFunction(() => window.__chat.scriptstate.$jr_list_page === '20');
  await page.click('.gw [data-action="jr-step"][data-value="list_page:-"]'); await page.waitForFunction(() => window.__chat.scriptstate.$jr_list_page === '10');
  assert.equal(await page.evaluate(() => document.querySelector('.gw [data-action="jr-step"][data-value="list_page:-"]').disabled), true, '10에서 − 잠김');
  await closeEditor(page, true); await sleep(200);
  await tab('records');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 10, '설정을 10으로 바꾸면 10줄');
  assert.equal(await moreText('.gx-jr-list'), '더 보기 남은 190줄');
  await more('.gx-jr-list');
  assert.equal(await count('.gx-jr-list .gx-jr-row'), 20, '더 보기도 10줄씩');
  T(`설정 「한 번에 보일 줄 수」 30 → 10 반영 (숫자 상자 ${box.w}×${box.h})`);

  // 가로 넘침·오류
  const over = await page.evaluate(() => { const g = document.querySelector('.gx .gx-body'); return g.scrollWidth - g.clientWidth; });
  assert.ok(over <= 1, `가로 넘침 없음 (${over})`);
  assert.deepEqual(errors, [], '콘솔 오류 없음');
  await page.close();
}
await browser.close();
console.log(results.map((r) => `ok ${r}`).join('\n'));
console.log(`recmore-browser: ${results.length} 통과`);
