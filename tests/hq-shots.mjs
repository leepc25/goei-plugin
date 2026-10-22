// 본부 검수용 스크린샷: 모든 장면을 왼쪽 끝부터 오른쪽 끝까지 한 화면씩. npm run build 뒤: node tests/hq-shots.mjs <폴더>
// ONLY=pc|phone, SCENES=office,lobby
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const OUT = process.argv[2] || 'shots';
mkdirSync(OUT, { recursive: true });
const url = pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const VPS = [
  { name: 'pc', viewport: { width: 1280, height: 720 } },
  { name: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const errors = [];
const only = process.env.ONLY;
const want = process.env.SCENES ? process.env.SCENES.split(',') : null;
try {
  for (const vp of VPS) {
    if (only && only !== vp.name) continue;
    const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${vp.name}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${vp.name}: ${m.text()}`));
    const E = (f, a) => page.evaluate(f, a);
    await page.goto(url);
    await page.waitForFunction(() => window.__goeiEngine);
    await page.waitForTimeout(800);
    const nw = page.getByText('새로 시작');
    if (await nw.count()) await nw.first().click({ timeout: 3000 }).catch(() => E(() => window.__goeiEngine.start_new()));
    else await E(() => window.__goeiEngine.start_new());
    await page.waitForFunction(() => window.__goeiEngine.inHub && window.__goeiEngine.world);
    // 모든 방 열기 (검수용)
    await E(() => window.__goeiEngine.debugUnlockHq?.());
    await page.waitForTimeout(500);
    const ids = await E(() => window.__goeiEngine.world.stage.sceneIds());
    for (const id of ids) {
      if (want && !want.includes(id)) continue;
      await E((id) => window.__goeiEngine.world.stage.jump(id, 300), id);
      await page.waitForFunction((id) => window.__goeiEngine.world?.floor?.id === `hq:${id}`, id);
      await page.waitForTimeout(600);
      const L = await E(() => window.__goeiEngine.world.floor.length);
      const xs = [];
      for (let x = 300; x < L; x += 1000) xs.push(Math.min(x, L - 300));
      if (xs[xs.length - 1] < L - 400) xs.push(L - 300);
      let k = 0;
      for (const x of xs) {
        await E((x) => window.__goeiEngine.world.api.movePlayer(x, 668), x);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${vp.name}-${id}-${++k}.png` });
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (errors.length) console.log('ERRORS', errors.slice(0, 10));
console.log('done');
