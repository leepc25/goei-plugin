// 가림 확인 (작업용, 2026-11-12): 실제 방송 화면에서 손이 진열대로 내려가는 동작(속삭임·웃음·화남·말하기)의 캔버스를 그대로 떠 저장한다
import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, closeEditor, launch, loadFixture, openWin } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';
import { SHOW } from './homeshop-show.mjs';
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const CUES = ['상품|속삭임|건전지가 없어도 누군가는 꼭 받아요, 고객님.|-', '와이드|속삭임|건전지가 없어도 누군가는 꼭 받아요, 고객님.|-', '상품|화남|끊지 마시라고 했습니다, 고객님.|-', '상품|웃음|매진 임박입니다, 고객님.|-', '상품|말하기|오늘 첫 상품입니다, 고객님.|-'].join('\n');
const show = SHOW.replace(/#1\n[\s\S]*?\n#2/, `#1\n${CUES}\n#2`);
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $hs_speed: '30', $hs_hold: '1' } };
const { page } = await boot(browser, fx, chat, { width: 1920, height: 1080, touch: false, scale: 1 }, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
await openWin(page); await page.waitForTimeout(300);
if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, show);
if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]');
await click('.br-bm[data-value="hs"]');
await page.waitForSelector('.hs-l3', { timeout: 15000 });
const seen = new Map();
for (let i = 0; i < 700; i++) {
  const s = await page.evaluate(() => { const st = document.querySelector('.hs-scr'); const c = st?.querySelector('canvas'); return c ? { clip: st.dataset.clip || '', url: c.toDataURL('image/png') } : null; });
  if (s && !seen.has(s.url)) seen.set(s.url, s.clip);
  await page.waitForTimeout(60);
}
let n = 0;
for (const [url, clip] of seen) writeFileSync(`${OUT}/${String(n++).padStart(3, '0')}_${clip.replace(/[^\w가-힣]/g, '_')}.png`, Buffer.from(url.split(',')[1], 'base64'));
await page.close();
await browser.close();
console.log('ok', n);
