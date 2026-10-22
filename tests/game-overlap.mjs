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
      // ③ 그려지는 소품 상자: 벽선에 선 꾸밈 소품·표지판 ↔ 문·명패·벽 장식, 같은 깊이 소품끼리
      // ④ 적이 생겨날 자리(엔진 spawnAdjust 뒤)가 물건 막힌 칸 안인지
      const stat = await page.evaluate(() => {
        const w = window.__goeiEngine.world;
        const out = [];
        const ko = w.floor.keepOut ?? [];
        const FIXED = new Set(['elevator', 'mirror', 'panel', 'chasedoor', 'b12', 'goalwall', 'switch', 'shutter', 'door', 'servicedoor', 'rope', 'up', 'down', 'fall', 'ladder_up', 'ladder_down', 'left', 'right', 'intercom', 'button', 'getoff', 'close', 'greet']);
        const rs = w.propRects;
        for (const r of rs) {
          if (r.y > w.lane[0] + 40 || FIXED.has(r.what.split(':')[0])) continue;
          for (const [a, b] of ko) if (Math.min(b, r.x + r.w / 2) - Math.max(a, r.x - r.w / 2) > 6) out.push(`벽 ${r.what}@${Math.round(r.x)},${Math.round(r.y)} 폭${Math.round(r.w)} ↔ 벽 그림 [${Math.round(a)}, ${Math.round(b)}]`);
        }
        for (let i = 0; i < rs.length; i++)
          for (let j = i + 1; j < rs.length; j++) {
            const a = rs[i], b = rs[j];
            if (Math.abs(a.y - b.y) >= 30) continue; // 깊이가 30 넘게 다르면 앞뒤로 읽힌다
            if (Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2) > 8) out.push(`소품끼리 ${a.what}@${Math.round(a.x)},${Math.round(a.y)} ↔ ${b.what}@${Math.round(b.x)},${Math.round(b.y)}`);
          }
        const sol = w.solidsNow;
        for (const en of w.floor.encounters ?? [])
          for (const wave of en.waves)
            for (const s0 of wave) {
              const s = w.spawnAdjust ? w.spawnAdjust(s0) : s0;
              const hit = sol.find((p) => Math.abs(s.x - p.x) < p.w / 2 + 9 && s.y - p.y > -(p.back ?? 50) + 9 && s.y - p.y < 50 - 9);
              if (hit) out.push(`적 생성 ${s.kind}@${Math.round(s.x)},${Math.round(s.y)} ↔ 물건@${Math.round(hit.x)},${Math.round(hit.y)}`);
            }
        return out;
      });
      bad.push(...stat.map((s) => `시드${seed} 층${fl + 1}: ${s}`));
      // ① 물건마다 왼쪽·오른쪽 옆에서, 앞에서 걸어 들어가기 (적은 잠깐 치우고). FAST=1 이면 건너뛴다(정적 검사만)
      const solids = await page.evaluate(() => window.__goeiEngine.world.solidsNow.map((p) => ({ x: p.x, y: p.y, w: p.w })));
      solidsSeen += solids.length;
      for (const s of process.env.FAST ? [] : solids) {
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
      for (let i = 0; i < (process.env.FAST ? 0 : 16); i++) {
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
  // ⑤ 본부 모든 장면: 바닥 가구 ↔ 문 (책상 위 커피·책상 앞 의자처럼 일부러 붙인 가구끼리는 빼고), 걷는 띠가 바닥 가구 밑동보다 앞인지, 걸어 다니며 몸이 가구 그림 위에 겹치지 않는지
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url.replace('stage=elevator', 'hq'));
    await page.waitForFunction(() => window.__goeiEngine?.inHub && window.__goeiEngine.world?.stage?.sceneIds);
    const ids = await page.evaluate(() => window.__goeiEngine.world.stage.sceneIds());
    const DOOR_W = { main: 190, door: 110, glass: 150, steel: 120, security: 120, elevator: 150, stairs_up: 120, stairs_down: 120, shop: 130 };
    for (const id of ids) {
      await page.evaluate((id) => window.__goeiEngine.world.stage.jump(id, 400), id);
      await page.waitForFunction((id) => window.__goeiEngine.world?.floor?.id === `hq:${id}`, id);
      const r = await page.evaluate((DOOR_W) => {
        const w = window.__goeiEngine.world;
        const sc = w.stage.current();
        const out = [];
        const floorThings = sc.things.filter((t) => !t.wall);
        // 바닥 가구는 배경에 그려진다(밑동 y = 466): 걷는 띠 앞끝이 그보다 뒤면 몸이 가구 위에 겹친다
        if (floorThings.length && w.lane[0] < 466 + 2) out.push(`걷는 띠 ${w.lane[0]}가 바닥 가구 밑동(466)보다 뒤`);
        for (const t of floorThings) {
          for (const d of sc.doors) if (Math.min(t.x + t.w / 2, d.x + DOOR_W[d.kind] / 2) - Math.max(t.x - t.w / 2, d.x - DOOR_W[d.kind] / 2) > 6) out.push(`가구 ${t.kind}@${t.x} ↔ 문 ${d.kind}(${d.id})@${d.x}`);
        }
        return out;
      }, DOOR_W);
      bad.push(...r.map((s) => `본부 ${id}: ${s}`));
      // 몸: 띠 맨 뒤로 걸어가 보기 (띠 밖으로 못 나가는지)
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowUp');
      const y = await page.evaluate(() => window.__goeiEngine.world.player.y);
      if (y < 466 + 2) bad.push(`본부 ${id}: 요원이 바닥 가구 밑동 뒤(y ${Math.round(y)})로 걸어감`);
    }
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
