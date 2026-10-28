// QC 03 사진: 시작 화면·첫 장면 고르기·상황판·설정 창 모든 페이지를 세 뷰포트(PC·폰 세로·폰 가로)로 찍는다.
// 사용법: node tests/qc-ui-shots.mjs <fixture.json> <out-dir> [pc|phone|land|all]
// 파일: <out>/<페이지>-<뷰포트>.png (페이지당 뷰포트당 1장)
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin, setChat, sleep, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const out = process.argv[3];
const which = process.argv[4] ?? 'all';
const vps = which === 'all' ? Object.keys(VIEWPORTS) : [which];
mkdirSync(out, { recursive: true });
const browser = await launch();
const NODES = ['set:screen', 'set:image', 'set:board', 'set:gnet', 'set:phone', 'set:wiki', 'set:visit', 'set:people', 'set:adv', 'set:update', 'agent', 'org', 'anomaly', 'site', 'appendix', 'base', 'relations', 'guide:RP', 'guide:Image', 'rule:new', 'install', 'manage:diag', 'manage:log', 'manage:backup'];
const name = (n) => n.replace(':', '-');

for (const vp of vps) {
  const { page } = await boot(browser, fx, { message: [], scriptstate: {} }, vp);
  const shot = (n) => page.screenshot({ path: `${out}/${n}-${vp}.png` });
  await openWin(page);
  await page.waitForSelector('.gx-fac');
  await page.evaluate(() => document.querySelector('.gx-fac[data-value="A00"]').click());
  await sleep(400);
  await shot('start-picker');
  // 커스텀 임무 → 첫 장면 고르기
  await page.evaluate(() => document.querySelector('.gx-sc[data-value="9"]').click());
  await page.evaluate(() => document.querySelector('.gx-start').click());
  await page.waitForSelector('[data-action="repick"]');
  await sleep(300);
  await shot('start-opening');
  // 진행 중 채팅
  await closeWin(page);
  await setChat(page, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } });
  await openWin(page);
  await page.waitForSelector('.gx-tabhead');
  await sleep(300);
  await shot('panel-board');
  await openEditor(page, 'set:screen');
  for (const n of NODES) {
    await goNode(page, n);
    await page.waitForFunction(() => !document.querySelector('.gw')?.textContent?.includes('점검하는 중'));
    if (n === 'agent') {
      await page.evaluate(() => { const s = document.querySelector('.gw .gw-list-pick'); s.value = '쟈알디'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      await sleep(200);
    }
    await sleep(250);
    await shot(`ed-${name(n)}`);
  }
  await closeEditor(page, true);
  await page.close();
  console.log(`shots [${vp}] ${NODES.length + 3}`);
}
await browser.close();
