// QC 게임 ② 필드 세계 시뮬·시계·장부 다리 (src/game/world/*, engine/modules.ts hqAdapter). 리스 필드 모드 틀(field-harness)로:
//  씨앗 × 시각 6벌 생태계(이름 인물 욕구·근무형·몹·소란·경찰·말풍선·관찰 창 F9) 오류 없이 → 필드 시계(장면·지역·대화·싸움·시간 보내기, 0 포함) →
//  지하철로 지역 4곳 이동·귀환 → 장부 witness·visit → 세력 태도(경계·적대) → 열고 닫기 뒤 대화 시계 한 번만(리스너 누수 회귀).
// 사용: npm run build && node tests/qc-field-world-browser.mjs [사진 폴더]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { openField, enterHub } from './field-harness.mjs';

const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const results = [];
const ok = (name, detail = '') => { results.push(`${name} · 통과${detail ? ` · ${detail}` : ''}`); console.log('PASS', name, detail); };
const card = (minute) => ({ card: '괴이', faction: 'A00', player: '', agents: [], anomalies: [], sites: [], events: [], minute });
const jump = async (page, id, x = 400) => {
  await page.evaluate(([id, x]) => window.__goeiEngine.world.stage.jump(id, x), [id, x]);
  await page.waitForFunction((id) => window.__goeiEngine.world?.stage.current()?.id === id, id, { timeout: 10000 });
  await page.waitForTimeout(600);
};
const lastClock = (page) => page.evaluate(() => [...window.__h.records].reverse().find((e) => e.fact?.key === '필드 시각')?.fact.value ?? null);
const closeMenus = async (page) => { for (let i = 0; i < 4; i++) { if (!(await page.evaluate(() => !!document.querySelector('.mn.on') || !!document.querySelector('.gt-bar[data-open]')))) return; await page.keyboard.press('Escape'); await page.waitForTimeout(200); } };
/** 화면(합성 결과) 오른쪽 위 관찰 창 자리의 어두운 비율: 엔진 캔버스는 그린 뒤 비워질 수 있어 스크린숏을 페이지에서 풀어 잰다 */
const darkTopRight = async (page) => {
  const vp = page.viewportSize();
  const png = (await page.screenshot({ clip: { x: vp.width - 300, y: 20, width: 260, height: 60 } })).toString('base64');
  return page.evaluate(async (b64) => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 8) < 30 && Math.abs(d[i + 2] - 18) < 30 && d[i] + d[i + 1] + d[i + 2] < 120) dark++; return dark / (d.length / 4); }, png);
};
/** 지금 서 있는 곳에서 문 id 앞으로 가 E */
const useDoor = async (page, doorId) => {
  const d = await page.evaluate((id) => window.__goeiEngine.world.stage.current().doors.find((q) => q.id === id), doorId);
  assert.ok(d, `문 ${doorId}`);
  for (const y of [470, 490, 520, 560, 600, 640]) {
    await page.evaluate(([x, y]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = y; }, [d.x, y]);
    await page.waitForTimeout(200);
    if (await page.evaluate(() => !!window.__goeiEngine.world.stage.nearInfo())) break;
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction((to) => window.__goeiEngine.world?.stage.current()?.id === to, d.to, { timeout: 10000 });
  await page.waitForTimeout(800);
};

// ── ① 생태계 전수: 씨앗 × 시각 ──
for (const [seed, hour] of [[1, 0], [7, 6], [42, 10], [1, 14], [7, 18], [42, 22]]) {
  const { browser, page, errors } = await openField({ width: 1280, height: 720, panel: false, query: `?seed=${seed}`, card: card(hour * 60) });
  await enterHub(page);
  await page.keyboard.press('F9'); // 관찰 창
  // 본부 안팎을 돌며 세계를 굴린다 (화면 밖 장면도 같은 규칙으로 돈다)
  const seen = {};
  for (const sc of ['office', 'f3', 'lobby', 'street', 'jongno']) {
    await jump(page, sc);
    await page.waitForTimeout(2500);
    seen[sc] = await page.evaluate((sc) => { const w = window.__goeiWorld; return { n: w.inScene(sc).length, named: w.inScene(sc).filter((a) => a.def.kind === 'named').map((a) => `${a.def.name}:${a.doing}`), mobs: w.inScene(sc).filter((a) => a.def.kind === 'mob').map((a) => a.def.name), uproar: w.uproarLevel(sc), say: w.inScene(sc).filter((a) => a.say).length }; }, sc);
    if (shots && sc === 'lobby') await page.screenshot({ path: `${shots}/world-${seed}-${hour}-lobby.png` });
  }
  const total = await page.evaluate(() => ({ actors: window.__goeiWorld.actors.length, named: window.__goeiWorld.actors.filter((a) => a.def.kind === 'named').map((a) => `${a.def.name}@${a.scene}:${a.doing}`), time: Math.round(window.__goeiWorld.time), night: window.__goeiWorld.isNight() }));
  assert.ok(total.named.length >= 1, `이름 인물 ${JSON.stringify(total.named)}`);
  assert.ok(seen.lobby.n + seen.street.n + seen.jongno.n > 0, `몹이 보충된다 ${JSON.stringify(seen)}`);
  // 근무형: 안내 직원 9~18시, 야간 경비 18~9시, 경비 순찰 늘
  const posts = await page.evaluate(() => window.__goeiWorld.actors.filter((a) => a.post).map((a) => `${a.post.id}:${a.def.name}`));
  const onDuty = hour >= 9 && hour < 18;
  assert.ok(posts.some((p) => p.startsWith('guard:')), `경비 순찰 ${posts}`);
  assert.equal(posts.some((p) => p.startsWith('desk:')), onDuty, `${hour}시 안내 직원 ${posts}`);
  assert.equal(posts.some((p) => p.startsWith('night:')), !onDuty, `${hour}시 야간 경비 ${posts}`);
  assert.equal(total.night, hour >= 19.5 || hour < 5, `밤 판정 ${hour}시`);
  // 관찰 창 글이 그려진다 (오른쪽 위 자리는 관찰 창이 차지)
  const obs = await page.evaluate(() => { const w = window.__goeiEngine.world; return !!w.stage; });
  assert.ok(obs);
  await page.keyboard.press('F9');
  assert.deepEqual(errors, [], `오류 ${errors}`);
  ok(`생태계 seed ${seed} / ${hour}시`, `행위자 ${total.actors} · 근무 ${posts.join(',')} · 로비 ${seen.lobby.mobs.join(',')} · 거리 ${seen.street.n}+${seen.jongno.n}`);
  await browser.close();
}

// ── ② 시계: 장면 10 · 지역 30 · 대화 10 · 싸움 10(장면당 한 번) · 시간 보내기 모든 선택지 · 0 값 ──
{
  const { browser, page, errors } = await openField({ width: 1280, height: 720, panel: false, query: '?seed=3', card: card(10 * 60) });
  await enterHub(page);
  await jump(page, 'f3');
  assert.equal(await lastClock(page), '10:10', '장면 넘어가기 +10');
  const mv = await page.evaluate(() => window.__h.records.filter((e) => e.kind === 'move').map((e) => e.text));
  assert.ok(mv.some((t) => /종합대응팀 → 3층 \(10:10\)/.test(t)), `이동 사건 ${mv}`);
  // 시간 보내기: 앉기 자리(사무실 seat) → 선택지 전부
  await jump(page, 'office');
  assert.equal(await lastClock(page), '10:20');
  const sit = async () => {
    await page.evaluate(() => { const w = window.__goeiEngine.world; const s = w.stage.current().spots.find((q) => q.id === 'seat'); w.player.x = s.x; w.player.y = s.y; });
    await page.waitForTimeout(250);
    await page.keyboard.press('KeyE');
    await page.waitForSelector('.mn.on');
    return page.evaluate(() => [...document.querySelectorAll('.mn.on .mn-btn, .mn.on .mn-row')].map((b) => (b.querySelector(':scope > span') ?? b).textContent.trim()).filter(Boolean));
  };
  const opts = await sit();
  assert.deepEqual(opts.filter((o) => !/그냥 있기|뒤로|닫기/.test(o)), ['30분', '1시간', '낮까지', '근무 끝까지'], `10:20 선택지 ${opts}`);
  await page.locator('.mn.on .mn-row > span', { hasText: /^근무 끝까지$/ }).click();
  await page.waitForFunction(() => window.__h.records.some((e) => /시간을 보냈다/.test(e.text)));
  assert.equal(await lastClock(page), '18:00', '근무 끝까지');
  const waited = await page.evaluate(() => window.__h.records.find((e) => /시간을 보냈다/.test(e.text)));
  assert.equal(waited.kind, 'act', '장부 사건 종류 (wait 는 장부에 없음)');
  await page.waitForTimeout(400);
  // 앉은 자리에서 일어나야 다시 앉을 수 있다: 옆으로 비켰다 다시
  await page.evaluate(() => { window.__goeiEngine.world.player.x += 200; });
  await page.waitForTimeout(300);
  const opts2 = await sit();
  assert.deepEqual(opts2.filter((o) => !/그냥 있기|뒤로|닫기/.test(o)), ['30분', '1시간', '밤까지'] /* 18시는 저녁(17~19시 반) → 다음은 밤 */, `18:00 선택지 ${opts2}`);
  await page.locator('.mn.on .mn-row > span', { hasText: /^30분$/ }).click();
  await page.waitForTimeout(400);
  assert.equal(await lastClock(page), '18:30');
  await page.evaluate(() => { window.__goeiEngine.world.player.x += 200; });
  await page.waitForTimeout(300);
  const opts3 = await sit();
  await page.locator('.mn.on .mn-row > span', { hasText: /^그냥 있기$/ }).click();
  await page.waitForTimeout(300);
  assert.equal(await lastClock(page), '18:30', '그냥 있기는 시계가 안 간다');
  // 대화 한 번 = +10: 잼트리(사무실) 옆에서 E → 보내기 → 닫기
  await page.evaluate(() => { window.__goeiEngine.world.player.x += 200; });
  const talk = async () => {
    for (let i = 0; i < 25 && !(await page.evaluate(() => document.querySelector('.gt-bar[data-open]'))); i++) {
      await page.evaluate(() => { const w = window.__goeiEngine.world; const a = window.__goeiWorld.inScene('office').find((q) => q.def.name === '잼트리'); if (a) { w.player.x = a.x - 40; w.player.y = a.y; } });
      await page.waitForTimeout(200);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(250);
    }
    await page.waitForSelector('.gt-bar[data-open]', { timeout: 5000 });
    const sent0 = await page.evaluate(() => window.__h.sent.length); // Enter 전에 세야 한다 (보내기가 빠르면 센 뒤라 +1 을 영원히 기다림)
    await page.fill('.gt-in', '잘 지냈어?');
    await page.keyboard.press('Enter');
    await page.waitForFunction((n) => window.__h.sent.length === n, sent0 + 1, { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  };
  await talk();
  await jump(page, 'f3');
  assert.equal(await lastClock(page), '18:50', '대화 +10 뒤 장면 +10');
  // 싸움: 장면당 한 번 +10 (같은 장면에서 두 번 쳐도 한 번)
  await jump(page, 'lobby');
  assert.equal(await lastClock(page), '19:00');
  const hit = async (scene) => page.evaluate((scene) => { const w = window.__goeiWorld; const a = w.inScene(scene).find((q) => q.def.kind === 'mob' && q.act !== 'gone' && q.act !== 'door'); return a ? w.hitActor(a.def.id, 1, Math.floor(Math.random() * 1e9)) && a.def.id : null; }, scene);
  for (let i = 0; i < 10 && !(await hit('lobby')); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(300);
  await hit('lobby');
  await page.waitForTimeout(300);
  await jump(page, 'f2'); // 장면을 옮기면 몹 사건이 묶여 장부로
  await page.waitForTimeout(300);
  const clockAfterFight = await lastClock(page);
  assert.equal(clockAfterFight, '19:20', '싸움 +10 (한 번만) 뒤 장면 +10');
  const prov = await page.evaluate(() => window.__h.records.filter((e) => e.kind === 'provoke'));
  assert.ok(prov.length >= 1 && /1층 로비에서 사람 2명을 때렸다/.test(prov[0].text), `몹 사건 묶음 ${JSON.stringify(prov)}`);
  assert.ok(prov[0].visit && /^v/.test(prov[0].visit), '방문 id');
  assert.equal(prov[0].witness?.faction, 'A00', `목격 소속 (로비 경비·안내 직원은 관리국) ${JSON.stringify(prov[0].witness)}`);
  assert.equal(prov[0].witness?.named, false);
  // 경찰·경비 출동 사건이 났다
  const police = await page.evaluate(() => window.__goeiWorld.actors.filter((a) => a.def.archetype === '경비' && a.plan === 'chase').length);
  assert.ok(police >= 1, `경비 출동 ${police}`);
  ok('시계·시간 보내기·싸움·목격', `${clockAfterFight} · ${prov[0].text}`);
  assert.deepEqual(errors, []);
  await browser.close();
}

// ── ③ 시간 설정 0 (안 감) · 지하철로 지역 4곳 이동·귀환 ──
{
  const prefs = JSON.stringify({ tScene: 0, tRegion: 0, tTalk: 0, tFight: 0, tWaitShort: 0, tWaitLong: 0 });
  const { browser, page, errors } = await openField({ width: 1280, height: 720, panel: false, query: '?seed=5', card: card(22 * 60), uiPrefs: prefs });
  await enterHub(page);
  await jump(page, 'f3');
  assert.equal(await lastClock(page), '22:00', '장면 0분');
  await jump(page, 'office');
  await page.evaluate(() => { const w = window.__goeiEngine.world; const s = w.stage.current().spots.find((q) => q.id === 'seat'); w.player.x = s.x; w.player.y = s.y; });
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.mn.on');
  const opts = await page.evaluate(() => [...document.querySelectorAll('.mn.on .mn-btn, .mn.on .mn-row')].map((b) => (b.querySelector(':scope > span') ?? b).textContent.trim()).filter(Boolean));
  assert.deepEqual(opts.filter((o) => !/그냥 있기|뒤로|닫기/.test(o)), ['아침까지'], `22시·0분 설정 선택지 ${opts}`);
  await page.locator('.mn.on .mn-row > span', { hasText: /^아침까지$/ }).click();
  await page.waitForTimeout(400);
  assert.equal(await lastClock(page), '05:00', '아침(5시)까지');
  ok('시간 설정 0', `${opts.join('/')}`);
  await closeMenus(page);
  await browser.close();
}
{
  const { browser, page, errors } = await openField({ width: 1280, height: 720, panel: false, query: '?seed=9', card: card(12 * 60) });
  await enterHub(page);
  await jump(page, 'jongno', 2100);
  let t = await lastClock(page);
  assert.equal(t, '12:10');
  await useDoor(page, 'metro');
  assert.equal(await lastClock(page), '12:20', '승강장은 장면 +10');
  const log = [];
  for (const [door, scene] of [['yeongdeungpo', 'yeongdeungpo'], ['gangnam', 'gangnam'], ['mangwon', 'mangwon'], ['yeouido', 'yeouido']]) {
    await useDoor(page, door);
    assert.equal(await page.evaluate(() => window.__goeiEngine.world.stage.current().id), scene);
    const arrived = await lastClock(page);
    log.push(`${scene} ${arrived}`);
    // 지역이 바뀌었으니 +30
    await page.waitForTimeout(1500);
    const mobs = await page.evaluate((s) => window.__goeiWorld.inScene(s).map((a) => a.def.name), scene);
    log.push(`(${mobs.length}명)`);
    if (shots) await page.screenshot({ path: `${shots}/region-${scene}.png` });
    await useDoor(page, 'metro');
  }
  // 12:20 → 영등포 12:50 → 승강장 13:00 → 강남 13:30 → 승강장 13:40 → 망원 14:10 → 승강장 14:20 → 여의도 14:50 → 승강장 15:00
  assert.deepEqual(log.filter((l) => !l.startsWith('(')), ['yeongdeungpo 12:50', 'gangnam 13:30', 'mangwon 14:10', 'yeouido 14:50'], log.join(' '));
  await useDoor(page, 'jonggak');
  assert.equal(await lastClock(page), '15:30', '종로로 귀환 = 지역 이동 +30');
  const facts = await page.evaluate(() => window.__h.records.filter((e) => e.fact?.key === '주인공 위치').map((e) => e.fact.value));
  assert.equal(facts.at(-1), '종로 큰길');
  assert.deepEqual(errors, []);
  ok('지하철 지역 4곳 이동·귀환', log.join(' '));
  await browser.close();
}

// ── ④ 세력 태도: 적대 = 막아섬, 경계 = 지켜봄 · 인물 기록 호감·호칭이 대사 칸에 ──
for (const stage of ['hostile', 'wary']) {
  const people = { factions: [{ code: 'A00', name: '관리국', value: stage === 'hostile' ? -90 : -40, stage, stageLabel: stage === 'hostile' ? '적대' : '경계', bounds: [61, 21, -20, -60] }], people: [{ name: '잼트리', faction: 'A00', aliases: [], affinity: { value: -70, stage: '적대', cell: 'hostile' }, address: { toUser: '너', register: '반말' }, express: 1, state: [], knowledge: [], threads: [], suspicion: [] }] };
  const { browser, page, errors } = await openField({ width: 1280, height: 720, panel: false, query: '?seed=11', card: card(11 * 60), people });
  await enterHub(page);
  await jump(page, 'lobby', 700);
  let got = null;
  for (let i = 0; i < 40 && !got; i++) {
    await page.waitForTimeout(250);
    got = await page.evaluate((stage) => { const w = window.__goeiWorld; const here = w.inScene('lobby').filter((a) => w.mobFaction(a) === 'A00'); if (stage === 'hostile') { const a = here.find((q) => q.plan === 'chase' && /막아섬/.test(q.doing)); return a ? `${a.def.name}:${a.doing}` : null; } const a = here.find((q) => q.act === 'watch' && /경계/.test(q.doing)); return a ? `${a.def.name}:${a.doing}` : null; }, stage);
  }
  assert.ok(got, `${stage}: 관리국 몹 반응 없음`);
  if (shots) await page.screenshot({ path: `${shots}/stance-${stage}.png` });
  assert.deepEqual(errors, []);
  ok(`세력 태도 ${stage}`, got);
  await browser.close();
}

// ── ⑤ 열고 닫기 뒤에도 대화 한 번 = +10 (window 리스너 누수 회귀) · F9 한 번에 관찰 창 전환 ──
{
  const { browser, page, errors } = await openField({ width: 1280, height: 720, panel: false, query: '?seed=3', card: card(9 * 60) });
  await enterHub(page);
  await page.evaluate(() => window.__h.remount());
  await enterHub(page);
  await page.evaluate(() => window.__h.remount());
  await enterHub(page);
  // 본부는 사무실에서 시작한다: 같은 장면으로 뛰면 이동 사건이 없어 시각 사실도 없다 → 복도 갔다 돌아와 기준 시각을 만든다
  await jump(page, 'f3');
  await jump(page, 'office');
  const before = await lastClock(page);
  for (let i = 0; i < 25 && !(await page.evaluate(() => document.querySelector('.gt-bar[data-open]'))); i++) {
    await page.evaluate(() => { const w = window.__goeiEngine.world; const a = window.__goeiWorld.inScene('office').find((q) => q.def.name === '잼트리'); if (a) { w.player.x = a.x - 40; w.player.y = a.y; } });
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('.gt-bar[data-open]', { timeout: 5000 });
  await page.fill('.gt-in', '안녕');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__h.sent.length >= 1, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await jump(page, 'f3');
  const after = await lastClock(page);
  const [h0, m0] = before.split(':').map(Number), [h1, m1] = after.split(':').map(Number);
  assert.equal((h1 * 60 + m1) - (h0 * 60 + m0), 20, `세 번째로 붙인 뒤 대화 +10 + 장면 +10 = 20 (${before} → ${after})`);
  // 관찰 창: F9 한 번에 켜지고 다시 한 번에 꺼진다 (리스너가 쌓였으면 두 번 눌린 셈이 된다)
  await page.keyboard.press('F9');
  await page.waitForTimeout(200);
  const on = await darkTopRight(page);
  await page.keyboard.press('F9');
  await page.waitForTimeout(200);
  const off = await darkTopRight(page);
  assert.ok(on > off + 0.2, `관찰 창 켜짐/꺼짐 (어두운 비율 ${on.toFixed(2)} / ${off.toFixed(2)})`);
  assert.deepEqual(errors, []);
  ok('다시 붙인 뒤 대화 시계 한 번 · F9 전환', `${before}→${after}`);
  await browser.close();
}
console.log(results.join('\n'));
console.log('qc-field-world-browser 통과');
