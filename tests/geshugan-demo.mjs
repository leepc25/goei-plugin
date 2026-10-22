// 게슈간 시연판 실행 검사: 페이지 오류 없이 뜨고, 조작키마다 동작이 바뀌는지, 화면 사진(PC·휴대폰 가로)을 남김.
// 사용: node tests/geshugan-demo.mjs [출력폴더]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
import path from 'node:path';
import fs from 'node:fs';
const out = process.argv[2] || '/tmp/geshugan-shots';
fs.mkdirSync(out, { recursive: true });
const file = 'file://' + path.resolve('release/demo/geshugan-full.html');
const browser = await chromium.launch();
const errs = [];
for (const [name, vp] of [['pc', { width: 1366, height: 900 }], ['phone', { width: 844, height: 390 }]]) {
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', e => errs.push(name + ': ' + e.message));
  await page.goto(file);
  await page.waitForTimeout(1500);
  const seq = [['KeyA', 300], ['KeyA', 300], ['KeyA', 600], ['KeyS', 500, 'up'], ['KeyD', 800, 'up'], ['KeyQ', 300], ['ShiftLeft', 80, 'up'], ['KeyE', 600], ['KeyW', 2500], ['KeyT', 400], ['KeyK', 2500]];
  const seen = new Set();
  let i = 0;
  for (const [k, wait, upNow] of seq) {
    await page.keyboard.down(k);
    if (upNow) await page.waitForTimeout(wait);
    await page.keyboard.up(k);
    for (let t = 0; t < wait; t += 100) { await page.waitForTimeout(100); seen.add(await page.evaluate(() => G.clip)); }
    if (name === 'pc') await page.locator('#screen').screenshot({ path: `${out}/${name}-${String(i).padStart(2, '0')}-${k}.png` });
    i++;
  }
  await page.screenshot({ path: `${out}/${name}-full.png` });
  console.log(name, '거친 동작:', [...seen].join(' '));
  await page.close();
}
await browser.close();
console.log(errs.length ? '오류:\n' + errs.join('\n') : '페이지 오류 없음');
process.exit(errs.length ? 1 : 0);
