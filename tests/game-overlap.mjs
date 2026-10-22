// 겹침 자동 검사 (통합 검수 15·17·18·22·23이 매번 한 건씩 찾던 것): 여러 시드 × 층 여러 개를 실제로 돌려
//  ① 몸↔바닥 물건: 요원·적의 발이 물건 막힌 칸 안에 12틱(0.2초) 넘게 머무는지 (물건마다 옆·앞에서 걸어 들어가고, 적과 싸우며 지나가기)
//  ② 물건↔벽 그림: 뒷줄에 놓인 들·부술 물건 그림이 문·명패·게시판·액자·창 구간(plan.keepOut)에 걸치는지
// npm run build 뒤 실행. SEEDS=4 FLOORS=6 으로 늘릴 수 있다. 0건이어야 통과.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const SEEDS = Number(process.env.SEEDS || 5);
const FLOORS = Number(process.env.FLOORS || 5);
const url = `${pathToFileURL(resolve('dist/goei-action-game.html')).href}?start=stage=elevator`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const bad = [];
const errors = [];
const types = new Set();
let floorsSeen = 0, solidsSeen = 0, samples = 0;
try {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    // 시드 고정: 같은 시드면 같은 층·같은 물건
    await page.addInitScript((s) => {
      let r = s * 7919;
      Math.random = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    }, seed);
    await page.goto(url);
    await page.waitForFunction(() => window.__goeiEngine?.world?.solidsNow);
    // 매 틱(엔진 hooks, 물건 막기 뒤) 겹침 재기: 물건 그림 폭 안, 깊이는 뒤 back ~ 앞 (그림 키 × 0.8, 50~90) 칸을 9px 줄여서,
    // 같은 몸이 15틱(0.5초) 넘게 안에 있으면 기록. 순간 이동으로 깊이 들어간 몸은 틱마다 9px씩 빠져나오므로 그보다 짧다
    const hook = () =>
      page.evaluate(() => {
        const w = window.__goeiEngine.world;
        if (w.__ovHooked) return;
        w.__ovHooked = true;
        window.__ov ??= { bad: [], n: 0 };
        const run = new WeakMap();
        w.hooks.push(() => {
          if (!w.solidsNow) return;
          // 싸우다 쓰러져 본부로 돌아가지 않게
          if (w.player.hp < 40) w.player.hp = 100;
          window.__ov.n++;
          const bodies = [w.player, ...w.bodies].filter((b) => b.alive && b.z <= 4 && b.team !== 'neutral' && b.kind !== 'bullet' && b.kind !== 'item' && !b.kind.startsWith('proj') && !/^(dead|down|hidden|dormant)$/.test(b.state ?? b.phase ?? ''));
          for (const b of bodies) {
            const hit = w.solidsNow.find((p) => Math.abs(b.x - p.x) < p.w / 2 + 9 && b.y - p.y > -(p.back ?? 50) + 9 && b.y - p.y < Math.min(90, Math.max(50, (p.h ?? 0) * 0.8)) - 9);
            const n = hit ? (run.get(b) ?? 0) + 1 : 0;
            run.set(b, n);
            if (n === 15) window.__ov.bad.push(`층${w.floors} ${b === w.player ? '요원' : b.kind}@${Math.round(b.x)},${Math.round(b.y)} ↔ 물건@${Math.round(hit.x)},${Math.round(hit.y)} 폭${Math.round(hit.w)}`);
          }
        });
      });
    for (let fl = 0; fl < FLOORS; fl++) {
      await page.waitForFunction(() => window.__goeiEngine.world?.solidsNow && window.__goeiEngine.world.floor?.keepOut);
      await hook();
      floorsSeen++;
      types.add(await page.evaluate(() => window.__goeiEngine.world.floor.type));
      // ② 뒷줄 물건 그림 ↔ 벽 그림 구간
      const wallHits = await page.evaluate(() => {
        const w = window.__goeiEngine.world;
        const ko = w.floor.keepOut ?? [];
        return w.solidsNow.filter((p) => p.y < w.lane[0] + 60).flatMap((p) => ko.filter(([a, b]) => p.x + p.w / 2 > a && p.x - p.w / 2 < b).map(([a, b]) => `물건@${Math.round(p.x)},${Math.round(p.y)} 폭${Math.round(p.w)} ↔ 벽 [${Math.round(a)}, ${Math.round(b)}]`));
      });
      bad.push(...wallHits.map((s) => `시드${seed} 층${fl + 1}: ${s}`));
      // ① 물건마다 왼쪽·오른쪽 옆에서, 앞에서 걸어 들어가기 (적은 잠깐 치우고)
      const solids = await page.evaluate(() => window.__goeiEngine.world.solidsNow.map((p) => ({ x: p.x, y: p.y, w: p.w })));
      solidsSeen += solids.length;
      for (const s of solids) {
        // 옆에서·앞에서 걸어 들어가기, 그리고 물건 바로 앞(검수 23: 상자 더미 앞에서 싸우다 걸터앉은 모양)에 세우고 공격
        for (const [dx, dy, key] of [[-1, 0, 'ArrowRight'], [1, 0, 'ArrowLeft'], [0, 1, 'ArrowUp'], [0, 0.6, 'KeyA'], [0.3, 0.4, 'KeyA']]) {
          await page.evaluate(([x, y]) => {
            const w = window.__goeiEngine.world;
            for (const e of w.bodies) if (e.team !== 'player' && e.team !== 'neutral') (e.x = e.px = x + 900);
            const p = w.player;
            p.x = p.px = x;
            p.y = p.py = Math.max(w.lane[0], Math.min(w.lane[1], y));
          }, [s.x + dx * (s.w / 2 + 70), s.y + dy * 90]);
          await page.keyboard.down(key);
          await page.waitForTimeout(450);
          await page.keyboard.up(key);
        }
      }
      // 적과 싸우며 층을 걸어가기: 오른쪽으로 걸으며 공격
      await page.evaluate(() => { const w = window.__goeiEngine.world; w.player.x = w.player.px = 300; });
      await page.keyboard.down('ArrowRight');
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press(i % 3 ? 'KeyA' : 'ArrowUp');
        await page.waitForTimeout(220);
      }
      await page.keyboard.up('ArrowRight');
      // 다음 층
      const ok = await page.evaluate(() => {
        const g = window.__goeiEngine;
        // 승강기 안 등 층이 아닌 장면은 건너뛴다
        for (let i = 0; i < 6; i++) {
          const next = g.runStage?.nextFloor(g.run, g.world.floor, 'next');
          if (!next) return false;
          g.world.enterFloor(next);
          if (next.keepOut) break;
        }
        if (!g.world.floor.keepOut) return g.world.floor.id ?? 'no-floor';
        g.world.player.hp = g.world.player.maxHp ?? g.world.player.hp;
        return true;
      });
      if (ok !== true) {
        console.log(`시드${seed}: ${fl + 1}층에서 멈춤 (${ok})`);
        break;
      }
      await page.waitForTimeout(400);
    }
    const ov = await page.evaluate(() => window.__ov);
    samples += ov.n;
    bad.push(...ov.bad.map((s) => `시드${seed} ${s}`));
    await page.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], errors.join('\n'));
console.log(`층 ${floorsSeen} (${[...types].join('·')}), 물건 ${solidsSeen}, 표본 ${samples}, 겹침 ${bad.length}`);
assert.ok(floorsSeen >= SEEDS * 2 && samples > 500, '돌린 양이 너무 적다');
assert.equal(bad.length, 0, `겹침 ${bad.length}건:\n${bad.slice(0, 20).join('\n')}`);
console.log('game-overlap 통과');
