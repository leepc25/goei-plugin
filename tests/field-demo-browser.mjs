// 필드 시연판(release/demo/goei-field-demo.html) 확인: node tests/field-demo-browser.mjs <주소> <저장 png> — 제목 → 필드 입장 → 본부까지 들어가는지 (githack 첫 화면 「Open the page」 자동 통과)
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = []; page.on('console', (m) => { if (m.type() !== 'log') logs.push(m.type() + ': ' + m.text().slice(0, 200)); }); page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
await page.goto(process.argv[2], { timeout: 60000 });
const gate = page.locator('text=Open the page'); if (await gate.count()) { await gate.first().click(); await page.waitForTimeout(3000); }
const t0 = Date.now(); let last = '';
while (Date.now() - t0 < 150000) {
  const st = await page.evaluate(() => ({ inHub: !!window.__goeiEngine?.inHub && !!window.__goeiEngine.world, txt: document.body.innerText.slice(0, 40).replace(/\n/g, '|'), btns: [...document.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => x.textContent.trim().slice(0, 8)).slice(0, 6) }));
  const key = JSON.stringify(st); if (key !== last) { console.log(`t+${Math.round((Date.now() - t0) / 1000)}s`, key); last = key; }
  if (st.inHub) break;
  const btn = page.locator('button:visible', { hasText: /필드 입장|새로 시작|들어가기|계속/ }).first();
  if (await btn.count()) await btn.click().catch(() => {}); else await page.getByText('필드 입장').first().click({ force: true, timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
await page.waitForTimeout(5000); await page.screenshot({ path: process.argv[3] });
console.log(logs.slice(0, 10).join('\n'));
await b.close();
