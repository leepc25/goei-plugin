// 괴이위키 화면 확인 (2026-11-08, 작업용): node tests/_br_wiki.mjs <사진 폴더>
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, launch, loadFixture, openWin } from './qc-settings-harness.mjs';

const OUT = process.argv[2] || '.scratch/br-wiki';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $nw_auto: '0' } };
  const { page, errors } = await boot(browser, fx, chat, size);
  let n = 0;
  const shot = async (tag) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  if (vp === 'pc') { await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="wk"]'); }
  else { await click('.gx-cgrip'); await click('[data-action="br-site"][data-value="wk"]'); }
  await page.waitForTimeout(400);
  await shot('home');
  // 문서 하나 만들기: 검색 → 없는 문서 → 작성 → 생성
  const article = (title) => `<lightboard-namuwiki doc_title="${title}" doc_type="other" main_color="#27685b" asset_src="" related1="소라 랜드 괴담" recent1="쟈알디">
[Infobox]Title:${title}|위치:서울|상태:❗폐장❗
[Toc]
[Heading]Level:1|Title:개요
[Paragraph]${title}은 폐장한 놀이공원이다. ➡️소라 랜드 괴담➡️이 유명하다.📌출처 불명.📌
[Heading]Level:1|Title:목격담
[List]관람차가 혼자 돈다
[Quote]돌아가|Source:경비원
</lightboard-namuwiki>`;
  // 시안 상태 순서대로: 대문 → 검색 → 없는 문서(로어북 있음) → 작성 중 → 문서 → 다시 쓰기 → 목록 → 새 문서 → 대문+목록
  await page.fill('[data-input="wiki-query"]', '관리');
  await page.press('[data-input="wiki-query"]', 'Enter');
  await page.waitForSelector('.wk-find', { timeout: 4000 });
  assert.equal(await page.locator('.wk-find .sres li').count() > 0, true, '검색 결과');
  await shot('search');
  await page.fill('[data-input="wiki-query"]', '소라 랜드');
  await page.press('[data-input="wiki-query"]', 'Enter');
  await page.waitForSelector('.wk-compose', { timeout: 4000 });
  await shot('none');
  // 작성 중 화면을 찍을 수 있게 응답을 붙잡아 둔다
  await page.evaluate((a) => { window.__llm = { shift: () => new Promise((r) => { window.__llmGo = () => r({ type: 'success', result: a }); }) }; }, article('소라 랜드'));
  await click('[data-action="wiki-start"]');
  await page.waitForFunction(() => typeof window.__llmGo === 'function');
  await shot('busy');
  assert.ok((await page.textContent('.wk-compose')).includes('작성하는 중'), '작성 중');
  await page.evaluate(() => window.__llmGo());
  await page.waitForSelector('.nw-doc', { timeout: 8000 });
  await shot('doc');
  await click('[data-action="wiki-rewrite"]');
  await shot('rw');
  await click('[data-action="wiki-rw-cancel"]');
  if (vp === 'pc') await click('.wk .wlb'); else await click('.wk .wgrab');
  await page.waitForSelector('.wk .wdr.open');
  await shot('list');
  await page.fill('[data-input="wiki-filter"]', '소라');
  await page.waitForTimeout(200);
  assert.ok((await page.textContent('.wk .wlist')).includes('소라 랜드'), '서랍 검색');
  await shot('list-filter');
  await page.fill('[data-input="wiki-filter"]', '');
  await page.evaluate(() => document.querySelector('[data-input="wiki-filter"]').dispatchEvent(new Event('input', { bubbles: true })));
  await click('.wk .wscrim');
  await click('[data-action="wiki-random"]');
  await page.waitForTimeout(200);
  await click('[data-action="wiki-home"]');
  await click('[data-action="wiki-new"]');
  await page.waitForSelector('.wk .in1');
  await shot('new');
  await click('[data-action="wiki-home"]');
  await page.waitForTimeout(200);
  await shot('home2');
  if (vp === 'pc') await click('.wk .wlb'); else await click('.wk .wgrab');
  await shot('mainlist');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '가로 넘침 없음');
  if (errors.length) console.log(vp, 'page errors:', errors.slice(0, 5));
  assert.deepEqual(errors, []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
