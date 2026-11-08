// 설정 페이지 통일 사진 (2026-11-08 사용자: 자동 호출 맨 위·이름 통일·상태창 일괄 표시·인물 진단 점검으로). 사용법: node tests/shot-settings-unify.mjs <out-dir>
import { mkdirSync } from 'node:fs';
import { boot, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/settings-shots';
mkdirSync(out, { recursive: true });
const b = await launch();
const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko' } };
const { page, errors } = await boot(b, fx, started, { width: 1600, height: 1000 });
await openWin(page);
await page.waitForSelector('.gx-tabhead');
await openEditor(page, 'set:gnet');
for (const n of ['set:gnet', 'set:phone', 'set:wiki', 'set:people', 'set:status', 'set:items', 'manage:people']) {
  await goNode(page, n);
  await sleep(400);
  await page.evaluate(() => document.querySelector('.gw .gw-body')?.scrollTo(0, 0));
  await sleep(150);
  await page.screenshot({ path: `${out}/${n.replace(':', '_')}.png` });
}
// 상태창: 칸 표까지 내려서
await goNode(page, 'set:status');
await sleep(300);
await page.evaluate(() => document.querySelector('.st-col-all')?.scrollIntoView({ block: 'start' }));
await sleep(150);
await page.screenshot({ path: `${out}/set_status_cols.png` });
await page.evaluate(() => document.querySelector('.st-col-all [data-value="all:show:0"]')?.click());
await sleep(500);
await page.evaluate(() => document.querySelector('.st-col-all')?.scrollIntoView({ block: 'start' }));
await sleep(150);
await page.screenshot({ path: `${out}/set_status_cols_hidden.png` });
const hid = await page.evaluate(() => Object.entries(window.__chat.scriptstate).filter(([k, v]) => k.startsWith('$st_col_') && v === 'hide').length);
console.log('hidden cols', hid, 'errors', errors);
await b.close();
