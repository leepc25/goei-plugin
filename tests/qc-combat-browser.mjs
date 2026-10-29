// QC 게임 ③ 전투: 대련 무대 난이도 4단계 × 1:1 뒤 1:2 (AI 에일린, src/combat/brain.ts · eileen/aiFighter.ts),
//  에일린 키(Q 약 · W 강 · C 방어 · A 사격 · S 충전 · D 기술 · F 필살 · Space 점프 · Shift 회피), 강공격 마무리 3종(스턴·띄우기·날리기),
//  히트스톱(맞은 몸 stop)·흔들림(core.shake), 적 AI 가 때린다, 경계(화면 밖으로 못 나감). npm run build 뒤: node tests/qc-combat-browser.mjs [사진 폴더]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(execSync('npm root -g').toString().trim() + '/');
const { chromium } = require('playwright');
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const base = pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const results = [];
const ok = (name, detail = '') => { results.push(`${name} · 통과${detail ? ` · ${detail}` : ''}`); console.log('PASS', name, detail); };
const st = (page) => page.evaluate(() => {
  const w = window.__goeiEngine.world, p = w.player, P = p.core?.P;
  const ai = w.bodies.filter((b) => b.team === 'enemy' && b.alive).map((b) => ({ id: b.id, label: b.label, hp: b.hp, x: Math.round(b.x), y: Math.round(b.y), stop: b.stop }));
  return { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z), hp: p.hp, hpMax: p.hpMax, mode: P?.mode, clip: P?.clip?.id, sp: P?.sp, combo: P?.combo, lastHeavy: P?.lastHeavy, shake: p.core?.shake, len: w.floor.length, lane: w.lane, ai, tick: w.tick, ended: w.ended };
});
const hold = async (page, code, ms) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); };

for (const diff of ['easy', 'normal', 'hard', 'nightmare']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?start=stage=spar&ai=${diff}`);
  await page.waitForFunction(() => window.__goeiEngine?.world && !window.__goeiEngine.inHub, null, { timeout: 30000 });
  await page.waitForFunction(() => window.__goeiEngine.world.bodies.some((b) => b.team === 'enemy' && b.alive), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const s0 = await st(page);
  assert.equal(s0.ai.length, 1, `1:1 로 시작 ${JSON.stringify(s0.ai)}`);
  assert.ok(s0.mode !== undefined, '에일린 플레이어 (core)');
  // 적 AI 가 다가와 때린다: 가만히 서서 12초 → 체력이 준다 (nightmare 는 빨리, easy 는 느리지만 줄긴 한다)
  await page.waitForFunction((hp) => window.__goeiEngine.world.player.hp < hp, s0.hp, { timeout: 25000 }).catch(() => {});
  const hit = await st(page);
  assert.ok(hit.hp < s0.hp, `${diff}: AI 가 때린다 (${s0.hp}→${hit.hp})`);
  // 플레이어 공격: 마무리 3종(단독 강 = 스턴, 약2+강 = 띄우기, 약3+강 = 날리기), 히트스톱(core.hitstop, 에일린은 엔진 stop 대신 코어가 멈춘다)·흔들림(core.shake)
  // 상대 AI 는 잠시 두뇌를 꺼 가만히 세운다 (반격에 약공이 끊기면 마무리 종류를 못 가린다). 5ms 표본으로 코어 값을 읽는다
  await page.evaluate(() => {
    const w = window.__goeiEngine.world; const e = w.bodies.find((b) => b.team === 'enemy' && b.alive);
    e.__tick = e.brain.tick; e.brain.tick = () => ({ hold: new Set(), press: new Set(), release: new Set() });
    window.__max = { hs: 0, sh: 0 }; window.__clips = new Set();
    window.__sampler = setInterval(() => { const c = w.player.core; window.__max.hs = Math.max(window.__max.hs, c.hitstop); window.__max.sh = Math.max(window.__max.sh, c.shake); if (c.P.clip) window.__clips.add(c.P.clip.id); }, 5);
  });
  const ground = () => page.waitForFunction(() => { const P = window.__goeiEngine.world.player.core.P; return P.mode === 'ground'; }, null, { timeout: 8000 });
  const kinds = {};
  let hsMax = 0, shMax = 0, dmgTotal = 0;
  for (const [name, seq] of [['stun', ['KeyW']], ['launch', ['KeyQ', 'KeyQ', 'KeyW']], ['blow', ['KeyQ', 'KeyQ', 'KeyQ', 'KeyW']]]) {
    await page.evaluate(() => { const w = window.__goeiEngine.world; const p = w.player; p.hp = p.hpMax; p.core.P.lastHeavy = null; const e = w.bodies.find((b) => b.team === 'enemy' && b.alive); e.hp = e.hpMax; p.x = e.x - 110; p.y = e.y; p.dir = 1; if (p.core) p.core.P.face = 1; window.__max = { hs: 0, sh: 0 }; window.__clips = new Set(); });
    // 앞서 AI 에 맞아 넘어져 있으면 첫 키가 일어나기에 쓰인다(마무리가 한 칸씩 밀림): 서서 자유로울 때까지
    await ground();
    await page.waitForTimeout(300);
    // 약공격은 다음 입력을 하나만 기억한다(core.ts P.buf): 고정 간격으로 누르면 느린 기계에서 세 번째 약이 강에 덮여 「띄우기」가 나온다.
    // 그래서 약은 그 연타 동작(9·10·11)이 시작된 것을 보고 다음 키를 누른다 (사람은 동작을 보고 치므로 같은 조건)
    let n = 0;
    for (const k of seq) {
      await page.keyboard.press(k);
      if (k === 'KeyQ') {
        const id = ['9', '10', '11'][n++];
        await page.waitForFunction((id) => window.__goeiEngine.world.player.core.P.clip?.id === id, id, { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(120);
      } else await page.waitForTimeout(330);
    }
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => { const w = window.__goeiEngine.world; const e = w.bodies.find((b) => b.team === 'enemy' && b.alive); return { lastHeavy: w.player.core.P.lastHeavy, dmg: e.hpMax - e.hp, max: window.__max, clips: [...window.__clips] }; });
    kinds[name] = r.lastHeavy;
    hsMax = Math.max(hsMax, r.max.hs); shMax = Math.max(shMax, r.max.sh); dmgTotal += r.dmg;
  }
  assert.deepEqual(kinds, { stun: 'stun', launch: 'launch', blow: 'blow' }, `강공격 마무리 3종 ${JSON.stringify(kinds)}`);
  // 빠른 연타 (2026-10-29 사용자: 선입력 2칸): 약·약·약·강을 120ms 간격으로 눌러도 세 번째 약이 안 사라지고 날리기
  await page.evaluate(() => { const w = window.__goeiEngine.world; const p = w.player; p.core.P.lastHeavy = null; const e = w.bodies.find((b) => b.team === 'enemy' && b.alive); e.hp = e.hpMax; p.x = e.x - 110; p.y = e.y; p.dir = 1; if (p.core) p.core.P.face = 1; });
  await ground();
  await page.waitForTimeout(300);
  for (const k of ['KeyQ', 'KeyQ', 'KeyQ', 'KeyW']) { await page.keyboard.press(k); await page.waitForTimeout(120); }
  await page.waitForFunction(() => window.__goeiEngine.world.player.core.P.lastHeavy !== null, null, { timeout: 4000 }).catch(() => {});
  const fast = await page.evaluate(() => window.__goeiEngine.world.player.core.P.lastHeavy);
  assert.equal(fast, 'blow', `빠른 연타 약3+강 = 날리기 (${fast})`);
  assert.ok(hsMax > 0, `히트스톱 ${hsMax}`);
  assert.ok(shMax > 6, `흔들림 ${shMax}`);
  assert.ok(dmgTotal > 0, `상대 피해 ${dmgTotal}`);
  await page.evaluate(() => clearInterval(window.__sampler));
  // 점프 · 회피 · 방어 · 사격 · 충전 · 기술 · 필살 (게이지 100). 동작마다 땅에 서서 자유로운 상태(ground)를 기다린다
  await ground();
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  const air = await st(page);
  assert.ok(air.z > 0 || air.mode === 'air', `점프 z=${air.z} mode=${air.mode}`);
  await page.waitForTimeout(900);
  await ground();
  const dx0 = (await st(page)).x;
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(500);
  const dodge = await st(page);
  assert.notEqual(dodge.x, dx0, '회피로 자리가 바뀐다');
  await ground();
  await page.keyboard.down('KeyC'); await page.waitForTimeout(200);
  assert.equal((await st(page)).mode, 'block', '방어 자세');
  await page.keyboard.up('KeyC');
  await page.keyboard.press('KeyA'); await page.waitForTimeout(400);
  await hold(page, 'KeyS', 900);
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyD'); await page.waitForTimeout(600);
  await page.evaluate(() => { const w = window.__goeiEngine.world; const p = w.player; p.core.P.sp = 100; const e = w.bodies.find((b) => b.team === 'enemy' && b.alive); if (e) { p.x = e.x - 200; p.y = e.y; p.dir = 1; if (p.core) p.core.P.face = 1; } });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  let frozen = false;
  for (let i = 0; i < 40 && !frozen; i++) { frozen = await page.evaluate(() => !!window.__goeiFieldFx?.frozen() || window.__goeiEngine.world.player.core.P.sp < 100); await page.waitForTimeout(50); }
  assert.ok(frozen, '필살기: 게이지를 쓴다 (컷인·멈춤)');
  if (shots) await page.screenshot({ path: `${shots}/combat-${diff}-super.png` });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const w = window.__goeiEngine.world; const e = w.bodies.find((b) => b.team === 'enemy' && b.alive); if (e?.__tick) e.brain.tick = e.__tick; });
  // 두뇌를 되돌리면 누워 있던 상대도 일어난다 (예전엔 일어나기를 안 눌러 무적으로 누운 채 대련이 끝나지 않았다)
  await page.waitForFunction(() => window.__goeiEngine.world.bodies.filter((b) => b.team === 'enemy' && b.alive && b.hp > 0).every((b) => !['down', 'belly'].includes(b.core.P.mode)), null, { timeout: 6000 });
  // 1:2: 첫 상대를 쓰러뜨리면 둘이 나온다
  // 필살기 등으로 첫 상대가 이미 쓰러져 둘째 물결이 나왔을 수 있다: 첫 상대(AI 에일린 1)만 체력 1 로 (둘째 물결까지 1 로 만들면 Q 에 다 쓰러져 1:2 를 못 본다)
  await page.evaluate(() => { for (const b of window.__goeiEngine.world.bodies) if (b.team === 'enemy' && b.alive && b.hp > 0 && b.label === 'AI 에일린 1') b.hp = 1; });
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => { const w = window.__goeiEngine.world; const p = w.player; const e = w.bodies.find((b) => b.team === 'enemy' && b.alive && b.hp > 0 && b.label === 'AI 에일린 1'); if (e) { p.x = e.x - 110; p.y = e.y; p.dir = 1; if (p.core) p.core.P.face = 1; } });
    await page.keyboard.press('KeyQ'); await page.waitForTimeout(250);
    if (await page.evaluate(() => window.__goeiEngine.world.bodies.filter((b) => b.team === 'enemy' && b.alive && b.hp > 0).length >= 2)) break;
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => window.__goeiEngine.world.bodies.filter((b) => b.team === 'enemy' && b.alive && b.hp > 0).length >= 2, null, { timeout: 20000 }).catch(async (e) => { console.log('DBG', JSON.stringify(await st(page)), await page.evaluate(() => JSON.stringify(window.__goeiEngine.world.bodies.filter((b) => b.team === 'enemy').map((b) => [b.label, b.hp, b.alive, b.core?.P?.mode, b.core?.P?.clip?.id, b.core?.P?.inv, typeof b.brain?.tick, !!b.__tick, b.stop])))); throw e; });
  const two = await st(page);
  assert.equal(two.ai.filter((a) => a.hp > 0).length, 2, `1:2 ${JSON.stringify(two.ai)}`);
  // 1:2 에서 10초: 둘 다 살아 움직이고(자리가 바뀜) 오류 없음, 지휘(공격권)로 동시에 덤비지 않는 순간이 있다
  const pos0 = two.ai.map((a) => a.x);
  await page.waitForTimeout(6000);
  const two2 = await st(page);
  assert.ok(two2.ai.some((a, i) => Math.abs(a.x - pos0[i]) > 20), 'AI 둘이 움직인다');
  // 경계: 왼쪽·오른쪽 끝·위아래 띠 밖으로 못 나간다
  await page.evaluate(() => { const p = window.__goeiEngine.world.player; p.hp = p.hpMax; });
  await hold(page, 'ArrowLeft', 2500);
  const L = await st(page);
  await hold(page, 'ArrowRight', 5000);
  const R = await st(page);
  await hold(page, 'ArrowUp', 1500);
  const U = await st(page);
  await hold(page, 'ArrowDown', 1500);
  const D = await st(page);
  assert.ok(L.x >= 0 && R.x <= R.len, `좌우 경계 ${L.x}..${R.x} (길이 ${R.len})`);
  assert.ok(U.y >= U.lane[0] - 1 && D.y <= D.lane[1] + 1, `위아래 띠 ${U.y}..${D.y} (${U.lane})`);
  assert.ok(two2.ai.every((a) => a.x >= -50 && a.x <= two2.len + 50 && a.y >= two2.lane[0] - 5 && a.y <= two2.lane[1] + 5), `AI 도 띠 안 ${JSON.stringify(two2.ai)}`);
  if (shots) await page.screenshot({ path: `${shots}/combat-${diff}-1v2.png` });
  assert.deepEqual(errors, [], `오류 ${errors}`);
  ok(`대련 ${diff}`, `AI 피해 ${s0.hp}→${hit.hp} · 마무리 ${Object.values(kinds).join('/')} · 히트스톱 ${hsMax.toFixed(2)}s · 흔들림 ${shMax} · 1:2 ${two2.ai.map((a) => a.hp).join('/')}`);
  await page.close();
}
console.log(results.join('\n'));
console.log('qc-combat-browser 통과');
await browser.close();
