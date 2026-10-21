// 대사와 컷신 시연판 Chromium 실입력 시험. node scripts/build-story.mjs 뒤 실행. SHOTS=폴더 를 주면 화면을 찍는다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const base = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(base, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(base + sep)) return res.writeHead(403).end();
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox'] });
const shots = process.env.SHOTS;
const errors = [];

/** 대화창·선택지·컷신을 끝까지 넘긴다. pick: 선택지 고르기, skip: 컷신 건너뛰기 */
async function drive(page, { pick = () => 0, skip = false, shot } = {}) {
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const state = await page.evaluate(() => ({
      skip: !document.querySelector('.gsd-skip')?.hidden,
      choices: !document.querySelector('.gsd-choices')?.hidden ? [...document.querySelectorAll('.gsd-choices button')].map((b) => b.textContent) : null,
      box: !document.querySelector('.gsd-box')?.hidden,
      talk: !document.querySelector('.gsd-talk')?.hidden,
      blocking: window.__story.isBlocking(),
      ctrl: document.querySelectorAll('.sd-ctrl button').length,
    }));
    if (shot && n === 0 && (state.box || state.choices)) {
      if (shots) await page.screenshot({ path: join(shots, `${shot}.png`) });
      n++;
    }
    if (state.skip && skip) await page.click('.gsd-skip');
    else if (state.choices) await page.click(`.gsd-choices button >> nth=${pick(state.choices)}`);
    else if (state.box) await page.click('.gsd-box');
    else if (!state.blocking && state.ctrl) return;
    await page.waitForTimeout(state.box || state.choices ? 30 : 120);
  }
  throw new Error('대화가 끝나지 않음');
}

try {
  for (const [label, viewport] of [
    ['m', { width: 390, height: 844 }],
    ['pc', { width: 1280, height: 950 }],
  ]) {
    const page = await browser.newPage({ viewport, hasTouch: label === 'm' });
    page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
    await page.goto(`http://127.0.0.1:${server.address().port}/dist/goei-story.html`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.sd-agents button');
    assert.equal(await page.locator('.sd-agents button').count(), 8);
    await page.click('.sd-agents button >> nth=1'); // 에일린
    if (shots) await page.screenshot({ path: join(shots, `${label}-0-pick.png`) });
    await page.click('[data-do=start]');
    await page.waitForTimeout(3500);
    if (shots) await page.screenshot({ path: join(shots, `${label}-1-first-day.png`) });
    await drive(page, { shot: `${label}-2-jaemtri-first` });
    // 본부: 잼트리 → 게시판 → 첫 임무 → 받기
    await page.click('[data-visit=jaemtri]');
    const order = ['임무 게시판', '[조사]', '받을게요'];
    await drive(page, { pick: (opts) => Math.max(0, opts.findIndex((t) => order.some((o) => t.includes(o)))), shot: `${label}-3-desk` });
    assert.equal(await page.evaluate(() => window.__story.flags.mission), 'm1');
    assert.equal(await page.locator('[data-do=deploy]').isDisabled(), false);
    // 쉬는 요원에게 말 걸기 → 같이 가자 (요원이 바뀐다)
    await page.click('[data-visit=rest]');
    await drive(page, { pick: () => 0 });
    await page.waitForTimeout(200);
    assert.match(await page.locator('.sd-hud').textContent(), /스팡달/);
    // 출동: 브리핑 → 첫 투입 컷신 → 승강기 (인사)
    await page.click('[data-do=deploy]');
    await drive(page, { shot: `${label}-4-briefing` });
    await page.waitForTimeout(4000);
    if (shots) await page.screenshot({ path: join(shots, `${label}-5-first-entry.png`) });
    await drive(page, { skip: true });
    await drive(page, { pick: () => 0, shot: `${label}-6-board` });
    const f = await page.evaluate(() => window.__story.flags);
    assert.equal(f.called_run, 1, '호명');
    assert.equal(f.depth, 1);
    // 층: 전투 사건 말풍선
    await page.click('[data-ev="combat:start"]');
    await page.waitForSelector('.gsd-bubble');
    if (shots) await page.screenshot({ path: join(shots, `${label}-7-bark.png`) });
    for (const ev of ['hp:low', 'combat:ult', 'intrude:fake']) {
      await page.waitForTimeout(700);
      await page.click(`[data-ev="${ev}"]`);
    }
    // 승객 몇 번
    for (let i = 0; i < 3; i++) {
      await page.click('[data-do=meet]');
      await drive(page, { pick: (o) => i % o.length, skip: i === 2, shot: i === 0 ? `${label}-8-passenger` : undefined });
    }
    // 다음 층 2번 (로비 → 지하는 4층부터)
    for (let i = 0; i < 3; i++) {
      await page.click('[data-do=next]');
      await drive(page, { pick: () => 0 });
    }
    assert.equal(await page.evaluate(() => window.__story.flags.depth), 4);
    // 다락방 → 거래 → 로프 귀환
    await page.click('[data-do=attic]');
    await page.waitForTimeout(2500);
    if (shots) await page.screenshot({ path: join(shots, `${label}-9-attic.png`) });
    await drive(page, { skip: true });
    await page.click('[data-do=deal]');
    await drive(page, { pick: () => 0 });
    await page.click('[data-do=rope]');
    await page.waitForTimeout(5000);
    if (shots) await page.screenshot({ path: join(shots, `${label}-10-return.png`) });
    await drive(page, { skip: true });
    await drive(page, { shot: `${label}-11-settle` });
    assert.equal(await page.evaluate(() => window.__story.flags.done_m1), 1);
    // 자유 대화
    await page.click('[data-do=talk]');
    await page.click('.sd-sheet button[data-id=gognija]');
    await page.waitForSelector('.gsd-talk:not([hidden])');
    await page.fill('.gsd-talk input', '블랙 커피 주세요');
    await page.press('.gsd-talk input', 'Enter');
    await page.waitForTimeout(300);
    const reply = await page.locator('.gsd-talk-log p.npc').last().textContent();
    assert.match(reply, /믹스커피|설탕/);
    if (shots) await page.screenshot({ path: join(shots, `${label}-12-talk.png`) });
    await page.click('.gsd-talk [data-x]');
    // 후송
    await page.click('[data-visit=jaemtri]');
    await drive(page, { pick: (opts) => Math.max(0, opts.findIndex((t) => ['임무 게시판', '[진압]', '받을게요'].some((o) => t.includes(o)))) });
    await page.click('[data-do=deploy]');
    await drive(page, { skip: true });
    await page.click('[data-do=evac]');
    await page.waitForTimeout(5200);
    if (shots) await page.screenshot({ path: join(shots, `${label}-13-evac.png`) });
    await drive(page, { skip: true });
    await drive(page);
    // 가로 넘침 없음
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 0, `가로 넘침 ${over}`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('story-browser ok');
} finally {
  await browser.close();
  server.close();
}
