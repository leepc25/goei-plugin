// 게시판 사이트 나누기 확인 (2026-11-08, 작업용): node tests/_br_boards.mjs <사진 폴더>
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, goNode, launch, loadFixture, openEditor, openWin } from './qc-settings-harness.mjs';
import { encode } from '../dist-test/core.mjs';

const OUT = process.argv[2] || '.scratch/br-boards';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const post = (id, title) => ({ id, date: '2025.01.01 02:40', nick: 'ㅇㅇ', title, views: 10, votes: 1, body: `${title} 본문`, mine: false, comments: [] });
const raw = (title) => encode({ posts: [post(1846001, title)], dms: [], sources: {}, seq: 1846001 });
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const vp of ['pc', 'phone']) {
  const chat = {
    message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $gn_raw: raw('괴담넷 글'), $gal_raw: raw('괴담갤 글') },
  };
  const { page, errors } = await boot(browser, fx, chat, vp);
  let n = 0;
  const shot = async (tag) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  const list = () => page.evaluate(() => [...document.querySelectorAll('.gn-title b')].map((e) => e.textContent));
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  const go = async (site) => {
    if (vp === 'pc') { await click('[data-action="nav-tab"][data-value="net"]'); await click(`.br-bm[data-value="${site}"]`); }
    else { await click('.gx-cgrip'); await click(`[data-action="br-site"][data-value="${site}"]`); }
    await page.waitForTimeout(300);
  };
  await go('gn'); assert.deepEqual(await list(), ['괴담넷 글']); await shot('gn');
  await go('gal'); assert.deepEqual(await list(), ['괴담갤 글']); await shot('gal');
  await go('wpf'); assert.deepEqual(await list(), []); await shot('wpf');
  await go('sm'); assert.deepEqual(await list(), []); await shot('sm');
  await go('gn'); assert.deepEqual(await list(), ['괴담넷 글']);
  // 설정: 괴담갤 페이지에서 바꾼 값은 괴담갤에만
  await openEditor(page, 'set:gal'); await shot('set-gal');
  await click('.gw [data-action="gn-cfg"][data-value="keepown=0"]');
  await page.waitForTimeout(400);
  const ss = await page.evaluate(() => window.__chat.scriptstate);
  assert.equal(ss['$lb_cfg_lb-gal.keepown'], '0');
  assert.equal(ss['$lb_cfg_lb-gn.keepown'], undefined);
  assert.equal(ss.$gn_site, undefined);
  await goNode(page, 'set:gnet'); await shot('set-gn');
  await goNode(page, 'guide:Gal'); await shot('guide-gal');
  if (errors.length) console.log(vp, 'page errors:', errors.slice(0, 5));
  assert.deepEqual(errors, []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
