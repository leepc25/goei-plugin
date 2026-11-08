// 게시판 사이트 나누기 확인 (2026-11-08, 작업용): node tests/_br_boards.mjs <사진 폴더>
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, goNode, launch, loadFixture, openEditor, openWin } from './qc-settings-harness.mjs';
import { encode } from '../dist-test/core.mjs';

const OUT = process.argv[2] || '.scratch/br-boards';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
const post = (id, title) => ({ id, date: '2025.01.01 02:40', nick: 'ㅇㅇ', title, views: 10, votes: 1, body: `${title} 본문`, mine: false, comments: [] });
const raw = (title, tags = ['자유']) => {
  const posts = [post(1846001, title)];
  const titles = ['야 코엑스 지하주차장 뭐 터졌냐? 경찰 쫙 깔림', '은장도 축성은 아무 성당에서나 해줌?', '부적 진짜/가짜 구별하는 법 정리함', '할머니 집 괘종시계가 밤에만 가는 이유', '요즘 검은 정장 입은 사람들 왜 이렇게 많음?'];
  titles.forEach((t, i) => posts.push({ ...post(1846002 + i, t), tag: tags[i % tags.length], views: 300 * (i + 1), votes: i * 3, comments: Array.from({ length: i * 2 }, (_, k) => ({ parent: 0, nick: `ㅇㅇ${k}`, body: `댓글 ${k}`, mine: false, unread: false, time: '2025.01.01 02:45' })) }));
  posts[0].tag = tags[0];
  return encode({ posts: posts.reverse(), dms: [{ nick: '익명', side: 'npc', body: '그 글 봤어요', unread: true, date: '2025.01.01 02:44' }], sources: {}, seq: 1846010 });
};
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const chat = {
    message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $gn_raw: raw('괴담넷 글', ['자유', '목격', '질문', '정보']), $gal_raw: raw('괴담갤 글', ['일반', '목격', '질문']), $wpf_raw: raw('세정게 글', ['정치', '음모']), $sm_raw: raw('연어 글', ['팝니다', '삽니다']) },
  };
  const { page, errors } = await boot(browser, fx, chat, size);
  let n = 0;
  const shot = async (tag) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  const list = () => page.evaluate(() => [...document.querySelectorAll('.gn-row-main')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const c = (e.querySelector('.bs-t, .bs-nm') ?? e).cloneNode(true); c.querySelectorAll('.bs-tag, .bs-cn').forEach((x) => x.remove()); return c.textContent.replace(/^\[[^\]]*\] /, '').trim(); }));
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  const go = async (site) => {
    if (vp === 'pc') { await click('[data-action="nav-tab"][data-value="net"]'); await click(`.br-bm[data-value="${site}"]`); }
    else { await click('.gx-cgrip'); await click(`[data-action="br-site"][data-value="${site}"]`); }
    await page.waitForTimeout(300);
  };
  await go('gn'); await shot('gn'); assert.equal((await list()).at(-1), '괴담넷 글');
  await click('.gn-row-main'); await shot('gn-post'); await click('[data-action="gn-back"]');
  await go('gal'); await shot('gal'); assert.equal((await list()).at(-1), '괴담갤 글');
  await click('.gn-row-main'); await shot('gal-post'); await click('[data-action="gn-back"]');
  await go('wpf'); assert.equal((await list()).at(-1), '세정게 글'); await shot('wpf');
  await go('sm'); assert.equal((await list()).at(-1), '연어 글'); await shot('sm');
  await go('gn'); assert.equal((await list()).at(-1), '괴담넷 글');
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
