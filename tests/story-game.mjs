// 통합 게임(goei-action-game.html) 안에서 대사 모듈이 도는지 보는 Chromium 시험. npm run build 뒤 실행. SHOTS=폴더 를 주면 화면을 찍는다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const shots = process.env.SHOTS;
const url = pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const errors = [];
const S = (page, name) => (shots ? page.screenshot({ path: `${shots}/${name}.png` }) : null);
const bubbles = (page) => page.evaluate(() => [...document.querySelectorAll('.gsy-bubble')].map((b) => b.textContent));

/** 대화·컷신을 끝까지 넘긴다 */
async function finish(page) {
  const c = { timeout: 800 };
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__goeiStory.isBlocking())); i++) {
    if (await page.locator('.gsy-skip:not([hidden])').count()) await page.locator('.gsy-skip').click(c).catch(() => {});
    else if (await page.locator('.gsy-choices:not([hidden]) button').count()) await page.locator('.gsy-choices button').first().click(c).catch(() => {});
    else if (await page.locator('.gsy-box:not([hidden])').count()) await page.locator('.gsy-box').click(c).catch(() => {});
    await page.waitForTimeout(150);
  }
  assert.equal(await page.evaluate(() => window.__goeiStory.isBlocking()), false, '대화·컷신이 안 끝남');
}

try {
  for (const [label, viewport, q] of [
    ['pc', { width: 1280, height: 720 }, ''],
    ['m', { width: 844, height: 390 }, '?touch=1'],
  ]) {
    const page = await browser.newPage({ viewport, hasTouch: !!q });
    page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
    await page.goto(url + q);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__goeiEngine);
    await page.waitForTimeout(300);
    await page.getByText('새로 시작').click();
    // 본부 = 엔진 벨트 장면: 잼트리 자리 앞에서 E
    await page.waitForFunction(() => window.__goeiEngine.inHub && window.__goeiEngine.world);
    await page.waitForTimeout(300);
    await page.evaluate(() => { const w = window.__goeiEngine.world; w.player.x = w.props.find((q) => q.id === 'jaemtri').x; });
    await page.waitForTimeout(100);
    await page.keyboard.press('KeyE');
    await page.waitForSelector('[data-mission]', { state: 'visible' });
    const desk = await page.locator('.hq-say').allTextContents();
    assert.ok(desk.some((t) => t.includes('잼트리')), `잼트리 말칸 ${desk}`);
    await S(page, `${label}-1-jaemtri`);
    await page.click('[data-mission]');
    await page.click('[data-act=brief]');
    await page.waitForSelector('[data-act=deploy]');
    const brief = (await page.locator('.hq-say').allTextContents()).join(' / ');
    assert.match(brief, /잼트리/);
    assert.doesNotMatch(brief, /부장\s*목표/, '부장 기본 문장이 남아 있음');
    await S(page, `${label}-2-brief`);
    await page.click('[data-act=deploy]');
    await page.waitForFunction(() => window.__goeiEngine.world);
    await page.waitForTimeout(500);
    // 첫 출동이면 엔진이 첫 투입 컷신을 튼다: 화면을 찍고 끝까지 넘긴다
    if (await page.evaluate(() => window.__goeiStory.isBlocking())) {
      await page.waitForTimeout(3000);
      await S(page, `${label}-2b-first-entry`);
      await finish(page);
    }
    // 첫 층: 대화창이 막지 않는다
    assert.equal(await page.evaluate(() => document.querySelector('.gsy-box')?.hidden ?? true), true, '층 들어가자마자 대화창이 열림');
    // 전투 사건 → 요원 말풍선 (요원 위에)
    await page.evaluate(() => window.__goeiEngine.world.emit({ type: 'combat:start', index: 0 }));
    await page.waitForTimeout(200);
    const b1 = await bubbles(page);
    assert.ok(b1.length >= 1, '전투 시작 말풍선 없음');
    await S(page, `${label}-3-bark`);
    // 적이 쓰러진 down은 요원 「쓰러짐」 대사를 내지 않는다
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__goeiEngine.world.emit({ type: 'down', x: 0, who: 'enemy' }));
    await page.waitForTimeout(150);
    const b2 = await bubbles(page);
    // 규칙 어김(층 모듈 custom) → 말풍선
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__goeiEngine.world.emit({ type: 'custom', name: 'ruleBroken', data: { id: 'greet' } }));
    await page.waitForTimeout(150);
    const b3 = await bubbles(page);
    assert.ok(b3.length >= 1, '규칙 어김 말풍선 없음');
    // 실제로 몇 대 쳐 본다 (멈춤 없이 움직이는가)
    const x0 = await page.evaluate(() => window.__goeiEngine.world.player.x);
    const t0 = await page.evaluate(() => window.__goeiEngine.world.tick);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowRight');
    for (let i = 0; i < 6; i++) await page.keyboard.press('KeyA'), await page.waitForTimeout(90);
    const x1 = await page.evaluate(() => window.__goeiEngine.world.player.x);
    assert.ok((await page.evaluate(() => window.__goeiEngine.world.tick)) > t0, '말풍선 뒤 게임이 멈춤');
    if (!q && x1 === x0) console.warn('(이동 없음: 문·벽 앞일 수 있음)', x0);
    assert.equal(await page.evaluate(() => window.__goeiEngine.world.paused ?? false), false);
    // 대화창·선택지: 전투가 멈추고, 터치 버튼과 겹치지 않고, 눌러서 넘어간다
    await page.evaluate(() => window.__goeiStory.say('passenger_three', { honest: 1 }));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__goeiStory.isBlocking()), true);
    const tick0 = await page.evaluate(() => window.__goeiEngine.world.tick);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__goeiEngine.world.tick), tick0, '대화 중 전투가 멈추지 않음');
    await S(page, `${label}-4-dialogue`);
    const overlap = await page.evaluate(() => {
      const box = document.querySelector('.gsy-box').getBoundingClientRect();
      const hits = [];
      for (const el of document.querySelectorAll('button, [class*=touch] *, [class*=pad] *')) {
        if (el.closest('.gsy')) continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height > innerWidth * innerHeight * 0.2) continue; // 터치 층 전체 판
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
        if (r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top) hits.push(el.className || el.tagName);
      }
      return hits;
    });
    assert.deepEqual(overlap, [], `대화창이 버튼과 겹침 ${overlap}`);
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__goeiStory.isBlocking())); i++) {
      const ch = await page.locator('.gsy-choices:not([hidden]) button').count();
      if (ch) {
        if (i < 8) await S(page, `${label}-5-choices`);
        await page.locator('.gsy-choices button').first().click();
      } else await page.locator('.gsy-box').click();
      await page.waitForTimeout(80);
    }
    assert.equal(await page.evaluate(() => window.__goeiStory.isBlocking()), false, '대화가 안 끝남');
    // 컷신: 무대 그림이 없으니 어둡게 가리고 자막·대화
    for (const id of ['first_entry', 'evac']) {
      await page.evaluate((id) => window.__goeiStory.cutscene(id), id);
      await page.waitForTimeout(3600);
      await S(page, `${label}-6-cs-${id}`);
      await page.locator('.gsy-skip').click({ timeout: 800 }).catch(() => {});
      for (let i = 0; i < 30 && (await page.evaluate(() => window.__goeiStory.isBlocking())); i++) {
        const c = { timeout: 800 };
        if (await page.locator('.gsy-choices:not([hidden]) button').count()) await page.locator('.gsy-choices button').first().click(c).catch(() => {});
        else if (await page.locator('.gsy-box:not([hidden])').count()) await page.locator('.gsy-box').click(c).catch(() => {});
        else if (await page.locator('.gsy-skip:not([hidden])').count()) await page.locator('.gsy-skip').click(c).catch(() => {});
        await page.waitForTimeout(150);
      }
      assert.equal(await page.evaluate(() => window.__goeiStory.isBlocking()), false, `컷신 ${id} 안 끝남`);
    }
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.gsy-fade')).opacity), '0', '컷신 뒤 화면이 어두운 채');
    console.log(label, { desk: desk.slice(0, 2), brief: brief.slice(0, 160), b1, b2, b3 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 0, `가로 넘침 ${over}`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('story-game ok');
} finally {
  await browser.close();
}
