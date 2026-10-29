// QC(정적 감사) 성능·자원 측정: 본체 시작 시간, display 처리기 1000건, 1초 감시 루프의 risuai 호출 수(가만히 10초),
// 창 열고 닫기 100번·채팅 전환 100번 뒤 heap·DOM 노드·<style> 수·설정 저장 횟수. 측정값을 출력하고 아래 LIMIT 상한을 넘으면 실패.
// 사용법: node tests/qc-static-perf-browser.mjs <fixture.json>
//
// 상한(개선 제안 나7, docs/qc/09_개선_나_567.md): 이 컨테이너(CPU 4개를 나눠 쓰는 느린 기계)에서 3번 돌린 측정값의 3~5배, 튀는 값은 더 넉넉히.
//  측정 3회: bootMs 81~207 · fabVisibleMs 195~394(06 보고서 409) · display1000Ms 32~72(06 보고서 48) · 열고 닫기 100번 8.6~9.9초 ·
//  heap +0.5MB · 노드 521→521 · 리스너 80→80 · style 3→3 · 가만히 10초 API 30회. 노드·리스너·style 은 「늘지 않음」을 본다.
const LIMIT = {
  bootMs: 1500,          // 시작기 주입 → 본체 start() 끝. 측정 81~207 (튀는 값)
  fabVisibleMs: 2000,    // 플로팅 버튼 보임. 측정 195~409
  display1000Ms: 500,    // display 처리기 1000건. 측정 32~72 (예전 2~4초 → 48ms 로 고친 것의 회귀 감시)
  openClose100Ms: 45_000, // 창 열고 닫기 100번 (Playwright 기다리기 포함). 측정 8.6~9.9초
  idleApi10s: 90,        // 가만히 10초 동안 risuai 호출 합계. 측정 30 (초당 3번)
  heapGrowMB: 5,         // 열고 닫기·채팅 전환 100번 뒤 heap 증가. 측정 +0.5 / +0.1
};
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { launch, boot, open } from './qc-static-harness.mjs';

const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const status = (i) => `[▣|2025.01.${String((i % 28) + 1).padStart(2, '0')}|0${i % 10}:47 AM|☀️|4°C|관리국 본부|없음]`;
const chat = (n) => ({
  message: [{ role: 'user', data: '안녕' }, { role: 'char', data: `장면 ${n}\n${status(n)}` }],
  scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '1', $st_fixed_theme: n % 2 ? 'light' : 'paper' },
});
const imgName = fixture.additionalAssets?.[0]?.[0] ?? 'x';
const samples = [
  (i) => `평범한 문단 ${i}. `.repeat(40),
  (i) => `서술 ${i}\n\n"대사"\n\n${status(i)}`,
  (i) => `<img="${imgName}">\n서술 ${i}\n${status(i)}`,
  (i) => `다른 봇 글 ${i} <b>굵게</b>`,
];

const { browser } = await launch();
const { page, errors } = await boot(browser, fixture, chat(0));
const out = {};
out.bootMs = Math.round(await page.evaluate(() => window.__tBoot ?? -1));
// 시작기 주입부터 본체 실행(3.4MB 스크립트)·start()·첫 감시 차례 끝(플로팅 버튼 보임)까지
out.fabVisibleMs = Math.round(await page.evaluate(() => new Promise((ok) => { const f = () => (document.querySelector('[x-goei-fab]')?.style.display === 'block' ? ok(performance.now() - window.__t0) : setTimeout(f, 2)); f(); })));
await page.evaluate(() => { for (let i = 1; i < 6; i++) window.__chats.push(null); });
await page.evaluate((cs) => { for (let i = 0; i < cs.length; i++) window.__chats[i + 1] = cs[i]; }, [chat(1), chat(2), chat(3)]);

// display 1000건 (형태 4가지 섞어서)
{
  const texts = Array.from({ length: 1000 }, (_, i) => samples[i % samples.length](i));
  const r = await page.evaluate(async (texts) => {
    const d = window.__calls.handlers.display;
    for (let i = 0; i < 20; i++) await d(texts[i]); // 데우기
    const t0 = performance.now();
    let bad = 0;
    for (const t of texts) { const o = await d(t); if (typeof o !== 'string') bad++; }
    return { ms: performance.now() - t0, bad };
  }, texts);
  out.display1000Ms = Math.round(r.ms);
  assert.equal(r.bad, 0);
}

// 가만히 있을 때 감시 루프 비용 (10초)
{
  await page.evaluate(() => { window.__calls.api = {}; });
  await page.waitForTimeout(10_000);
  out.idleApi10s = await page.evaluate(() => window.__calls.api);
}

let cdp = null;
// 플로팅 버튼은 본 화면 SafeElement 라 좌표로 맞힌다 (요소 핸들 없이)
const fabClick = async () => {
  const r = await page.evaluate(() => { const b = document.querySelector('[x-goei-fab] button').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.click(r[0], r[1]);
};
const metrics = async () => {
  cdp ??= await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, styles: await page.evaluate(() => document.querySelectorAll('style').length), listeners: m.JSEventListeners };
};

// 창 열고 닫기 100번
{
  await open(page);
  await page.click('[data-action="close"]');
  await fabClick();
  await page.waitForFunction(() => { const b = document.querySelector('.gx .gx-nb'); return b && b.offsetParent !== null; });
  await page.evaluate(() => document.querySelector('.gx [data-action="close"]').click());
  await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
  const before = await metrics();
  const saves0 = await page.evaluate(() => window.__calls.prefsSaves);
  const t0 = Date.now();
  // page.click·waitForSelector 는 Playwright 가 요소 핸들을 잡아 둬서(DevTools 전역 핸들) 떼어 낸 DOM 이 남은 것처럼 보인다 → 페이지 안에서 직접 누른다
  for (let i = 0; i < 100; i++) {
    await fabClick();
    await page.waitForFunction(() => { const b = document.querySelector('.gx .gx-nb'); return b && b.offsetParent !== null; });
    await page.evaluate(() => document.querySelector('.gx [data-action="close"]').click());
    await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
  }
  out.openClose100 = { before, after: await metrics(), ms: Date.now() - t0, prefsSaves: (await page.evaluate(() => window.__calls.prefsSaves)) - saves0 };
}

// 채팅 전환 100번 (감시 루프가 알아채게 1.1초씩은 너무 길어 0~3 번을 빠르게 돌리고 마지막에 기다린다)
{
  const before = await metrics();
  const saves0 = await page.evaluate(() => window.__calls.prefsSaves);
  for (let i = 0; i < 100; i++) {
    await page.evaluate((n) => { window.__chatIndex = n; }, i % 4);
    await page.waitForTimeout(260);
    if (i % 10 === 9) await page.waitForTimeout(1100);
  }
  await page.waitForTimeout(1500);
  out.chatSwitch100 = { before, after: await metrics(), prefsSaves: (await page.evaluate(() => window.__calls.prefsSaves)) - saves0 };
}

console.log(JSON.stringify(out, null, 2));
assert.deepEqual(errors, []);
// 시간 상한 (느린 기계 기준으로 넉넉히 — 넘으면 성능 회귀)
assert.ok(out.bootMs >= 0 && out.bootMs < LIMIT.bootMs, `본체 시작 ${out.bootMs}ms < ${LIMIT.bootMs}ms`);
assert.ok(out.fabVisibleMs < LIMIT.fabVisibleMs, `플로팅 버튼 보임 ${out.fabVisibleMs}ms < ${LIMIT.fabVisibleMs}ms`);
assert.ok(out.display1000Ms < LIMIT.display1000Ms, `display 1000건 ${out.display1000Ms}ms < ${LIMIT.display1000Ms}ms`);
assert.ok(out.openClose100.ms < LIMIT.openClose100Ms, `열고 닫기 100번 ${out.openClose100.ms}ms < ${LIMIT.openClose100Ms}ms`);
const idleCalls = Object.values(out.idleApi10s).reduce((a, b) => a + b, 0);
assert.ok(idleCalls <= LIMIT.idleApi10s, `가만히 10초 risuai 호출 ${idleCalls}회 ≤ ${LIMIT.idleApi10s}회`);
// 자원: 열고 닫기 100번·채팅 전환 100번에 노드·리스너·<style> 이 늘지 않고 heap 은 조금만
for (const [label, m] of [['열고 닫기 100번', out.openClose100], ['채팅 전환 100번', out.chatSwitch100]]) {
  assert.ok(m.after.styles <= m.before.styles, `${label}: CSS 재주입 없음 (${m.before.styles} → ${m.after.styles})`);
  assert.ok(m.after.nodes <= m.before.nodes, `${label}: DOM 노드가 늘지 않음 (${m.before.nodes} → ${m.after.nodes})`);
  assert.ok(m.after.listeners <= m.before.listeners, `${label}: 리스너가 늘지 않음 (${m.before.listeners} → ${m.after.listeners})`);
  assert.ok(m.after.heapMB - m.before.heapMB < LIMIT.heapGrowMB, `${label}: heap ${m.before.heapMB} → ${m.after.heapMB}MB, 증가 ${LIMIT.heapGrowMB}MB 미만`);
  assert.equal(m.prefsSaves, 0, `${label}: 설정을 저장하지 않음`);
}
console.log('PASS 성능·자원 측정');
await browser.close();
