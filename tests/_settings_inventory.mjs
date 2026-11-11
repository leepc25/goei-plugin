// 설정 줄 목록 뽑기 (설정 개편 2단계, 2026-11-11): 설정 창 「기능」 탭의 모든 페이지를 열어 줄(이름·조절 칸)을 기계로 뽑는다.
// 줄을 옮기거나 틀을 바꾼 뒤 다시 뽑아 앞 판과 대조하면 빠진 줄이 드러난다.
// 사용법: node tests/_settings_inventory.mjs <fixture.json> <out.json>
import { writeFileSync } from 'node:fs';
import { boot, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const out = process.argv[3];
const browser = await launch();
const started = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|목표]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $br_login: '1' } };
const { page, errors } = await boot(browser, fx, started, 'pc');
await openWin(page);
await openEditor(page, 'set:screen');
const nodes = await page.evaluate(() => {
  document.querySelector('.gw [data-action="ed-tab"][data-value="set"]')?.click();
  return [...document.querySelectorAll('.gw [data-action="ed-node"]')].map((b) => [b.dataset.value, b.textContent.trim()]);
});
const result = {};
for (const [node, label] of nodes) {
  if (node.startsWith('label:')) continue;
  await goNode(page, node);
  await sleep(250);
  // 접힌 칸(고급 설정 등)을 전부 편다
  await page.evaluate(() => document.querySelectorAll('.gw .gw-setbody details, .gw details').forEach((d) => { d.open = true; }));
  await sleep(120);
  result[node] = { label, rows: await page.evaluate(() => {
    const body = document.querySelector('.gw .gw-setbody') ?? document.querySelector('.gw .gw-main') ?? document.querySelector('.gw');
    const ctlOf = (el) => [...el.querySelectorAll('[data-action], [data-change], [data-input]')].map((c) => {
      const a = c.dataset.action ?? c.dataset.change ?? c.dataset.input;
      const k = c.dataset.key ?? '';
      const v = c.tagName === 'BUTTON' ? (c.dataset.value ?? '') : '';
      return `${a}${k ? `#${k}` : ''}${v ? `=${v}` : ''}`;
    });
    const groupOf = (el) => el.closest('section, details')?.querySelector('h3, summary')?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40) ?? '';
    const rows = [...body.querySelectorAll('.ps-row, .st-col-row, .dir-line, .adv-row, .adv-chips')].map((r) => ({
      group: groupOf(r),
      name: (r.querySelector('.ps-label > b, .st-col-name > b, label > span, b')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
      help: !!r.querySelector('.ps-label > small'),
      controls: ctlOf(r),
    }));
    // 줄 밖에 있는 조절 칸 (틀 밖 표 등)
    const inRow = new Set([...body.querySelectorAll('.ps-row, .st-col-row, .dir-line, .adv-row, .adv-chips')].flatMap((r) => [...r.querySelectorAll('[data-action], [data-change], [data-input]')]));
    const loose = [...body.querySelectorAll('[data-action], [data-change], [data-input]')].filter((c) => !inRow.has(c)).map((c) => `${c.dataset.action ?? c.dataset.change ?? c.dataset.input}${c.dataset.key ? `#${c.dataset.key}` : ''}${c.tagName === 'BUTTON' && c.dataset.value ? `=${c.dataset.value}` : ''}`);
    return { rows, loose };
  }) };
}
await browser.close();
writeFileSync(out, JSON.stringify(result, null, 1));
const total = Object.values(result).reduce((a, p) => a + p.rows.rows.length, 0);
console.log(`pages ${Object.keys(result).length} · rows ${total} · loose controls ${Object.values(result).reduce((a, p) => a + p.rows.loose.length, 0)}`);
for (const [n, p] of Object.entries(result)) console.log(`${n}\t${p.label}\t${p.rows.rows.length}\t${p.rows.loose.length}`);
if (errors.length) console.log('page errors:', errors.slice(0, 5));
