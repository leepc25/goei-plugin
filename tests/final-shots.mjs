// 마무리 검수용 스크린샷: 제목 → 본부 모든 장면 → 임무·브리핑 → 출동 층 걷기·싸움 → 일시정지 → 정산, PC와 폰 가로.
// 걷기는 순간 이동, 누르기는 실제 키. npm run build 뒤: node tests/final-shots.mjs <폴더> [층 수]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const OUT = process.argv[2] || 'shots';
const FLOORS = Number(process.argv[3] || 3);
mkdirSync(OUT, { recursive: true });
const url = pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const errors = [];
const VPS = [
  { name: 'pc', viewport: { width: 1280, height: 720 } },
  { name: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const only = process.env.ONLY;
// COMPACT=1: 검수용으로 장 수를 줄인다 (장면당 한 장, 층마다 시작·싸움 한 장·싸움 뒤)
const COMPACT = !!process.env.COMPACT;
try {
  for (const vp of VPS) {
    if (only && only !== vp.name) continue;
    const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${vp.name}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${vp.name}: ${m.text()}`));
    await page.addInitScript(() => {
      let r = 4242;
      Math.random = () => (r = (r * 16807) % 2147483647) / 2147483647;
    });
    let n = 0;
    const S = async (tag) => page.screenshot({ path: `${OUT}/${vp.name}-${String(++n).padStart(2, '0')}-${tag}.png` });
    const E = (f, a) => page.evaluate(f, a);
    await page.goto(url);
    await page.waitForFunction(() => window.__goeiEngine);
    await page.waitForTimeout(1500);
    await S('title');
    const nw = page.getByText('새로 시작');
    if (await nw.count()) await nw.first().click({ timeout: 3000 }).catch(() => E(() => window.__goeiEngine.start_new()));
    else await E(() => window.__goeiEngine.start_new());
    await page.waitForFunction(() => window.__goeiEngine.inHub && window.__goeiEngine.world);
    // 본부: 장면마다 (긴 장면은 앞·뒤 두 장)
    const ids = await E(() => window.__goeiEngine.world.stage.sceneIds());
    for (const id of ids) {
      const len = await E((id) => {
        const w = window.__goeiEngine.world;
        w.stage.jump(id, 420);
        return 0;
      }, id);
      void len;
      await page.waitForFunction((id) => window.__goeiEngine.world?.floor?.id === `hq:${id}`, id);
      await page.waitForTimeout(700);
      await S(`hq-${id}`);
      const L = await E(() => window.__goeiEngine.world.floor.length);
      if (L > 1700 && !COMPACT) {
        await E((x) => window.__goeiEngine.world.api.movePlayer(x), L - 420);
        await page.waitForTimeout(1200);
        await S(`hq-${id}-b`);
      }
    }
    // 임무: 사무실 잼트리 자리 → E
    await E(() => window.__goeiEngine.world.stage.jump('office', 420));
    await page.waitForFunction(() => window.__goeiEngine.world?.floor?.id === 'hq:office');
    await page.waitForTimeout(500);
    await E(() => {
      const w = window.__goeiEngine.world;
      w.api.movePlayer(w.props.find((q) => q.id === 'spot:jaemtri').x);
    });
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    // 자리 주인과 대화창이 먼저 열린다 (NPC 자유 대화). E 한 번 더 = 원래 창구
    await page.waitForSelector('.gnp:not([hidden])');
    await page.keyboard.press('KeyE');
    await page.waitForSelector('[data-mission]', { state: 'visible' });
    await page.waitForTimeout(300);
    await S('mission');
    await page.click('[data-mission]');
    await page.click('[data-act=brief]');
    await page.waitForSelector('[data-act=deploy]');
    await S('brief');
    await page.click('[data-act=deploy]');
  // 출동 준비 → B3 주차장 승합차 앞에서 E (사용자 2026-10-25)
  await page.waitForFunction(() => !document.querySelector('[data-act=deploy]'));
  await page.evaluate(() => window.__goeiEngine.world.stage.jump('b3', 370, 470));
  await page.waitForFunction(() => window.__goeiEngine.world?.floor?.id === 'hq:b3' && window.__goeiEngine.world.props.some((q) => q.id === 'spot:van'));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__goeiEngine.world && !window.__goeiEngine.inHub);
    // 쓰러지지 않게
    await E(() => {
      const w = window.__goeiEngine.world;
      w.hooks.push(() => w.player.hp < 60 && (w.player.hp = w.player.hpMax));
    });
    await page.waitForTimeout(1500);
    for (let f = 0; f < FLOORS; f++) {
      let fights = 0;
      // 강화 선택 창 등 메뉴가 떠 있으면 한 장 찍고 첫 항목을 고른다 (메트로배니아 구조: 층 끝 강화)
      for (let t = 0; t < 40 && !(await E(() => !!window.__goeiEngine.world?.floor && !window.__goeiEngine.world.ended)); t++) {
        await page.waitForTimeout(500);
        if (t === 4) await S(`floor${f + 1}-choice`);
        if (t >= 4) await page.keyboard.press('Enter');
      }
      await page.waitForFunction(() => window.__goeiEngine.world?.floor && !window.__goeiEngine.world.ended);
      // 컷신·대사가 막고 있으면 넘긴다
      for (let i = 0; i < 6; i++) await page.keyboard.press('KeyE').catch(() => {});
      const info = await E(() => {
        const w = window.__goeiEngine.world;
        return { len: w.floor.length, type: w.floor.type, encs: w.floor.encounters.map((e) => e.triggerX) };
      });
      await S(`floor${f + 1}-start-${info.type}`);
      // 걷기: 화면 폭씩 (싸움 구간 앞은 들어가서 싸운다)
      const encs = [...info.encs];
      for (let x = 900; x < info.len - 300; x += 1100) {
        const enc = encs.length && encs[0] <= x ? encs.shift() : null;
        if (enc !== null) {
          const shoot = !COMPACT || fights++ === 0;
          await E((x) => window.__goeiEngine.world.api.movePlayer(x), enc + 20);
          await page.waitForTimeout(900);
          if (!COMPACT) await S(`floor${f + 1}-enemy`);
          for (let k = 0; k < 10; k++) {
            await page.keyboard.press('KeyA');
            await page.waitForTimeout(120);
            if (shoot && (k === 3 || (k === 7 && !COMPACT))) await S(`floor${f + 1}-hit${k}`);
          }
          // 남은 적 정리 (다음 장면으로)
          await E(() => {
            const w = window.__goeiEngine.world;
            for (const b of w.bodies) if (b.team === 'enemy') (b.hp = 0), (b.alive = false);
          });
          await page.waitForTimeout(1300); // 피해 숫자가 사라진 뒤
          if (shoot) await S(`floor${f + 1}-after`);
          continue;
        }
        await E((x) => window.__goeiEngine.world.api.movePlayer(x), x);
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(500);
        await page.keyboard.up('ArrowRight');
        await page.waitForTimeout(300);
        if (!COMPACT) await S(`floor${f + 1}-walk${x}`);
      }
      if (f === 0) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await S('pause');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
      if (f < FLOORS - 1) {
        await E(() => {
          const w = window.__goeiEngine.world;
          w.encActive = -1;
          w.encIndex = w.floor.encounters.length;
          w.ended = 'next';
        });
        await page.waitForTimeout(1200);
      }
    }
    // 귀환 → 정산
    await E(() => window.__goeiEngine.endRun('return'));
    await page.waitForTimeout(2500);
    for (let i = 0; i < 12 && !(await E(() => window.__goeiEngine.inHub)); i++) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(800);
    await S('settle');
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(errors.length ? `오류 ${errors.length}\n${errors.join('\n')}` : '오류 0');
