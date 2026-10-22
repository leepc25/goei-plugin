// 실제 엔진 World + createEnemy 회귀. 별도 번들: 다른 테스트의 산출물을 덮어쓰지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
// 담당 밖 world.ts는 편집하지 않는다. 인계 패치를 검증할 때만 번들 입력에 적용한다.
const sharedPatch = process.env.ENEMY_AI_ROUND2_SHARED_PATCH === '1';
const pendingWorld = sharedPatch ? {} : { todo: '공용 World 프레임 맵/접촉 분리 패치 필요 (enemy-ai-round2-integration.patch)' };
const patchPlugin = { name: 'enemy-ai-round2-shared-patch', setup(b) {
  b.onLoad({ filter: /engine\/world\.ts$/ }, async ({ path }) => ({ loader: 'ts', contents: (await readFile(path, 'utf8'))
    .replace('[b.id, b.frame()]', '[b, b.frame()]').replace('frames.get(a.id)', 'frames.get(a)').replace('frames.get(t.id)', 'frames.get(t)')
    .replace("if (e.def.keep && e.def.keep[1] < 30) continue;", "if (e.kind === 'toucher' || (e.def.keep && e.def.keep[1] < 30)) continue;") }));
} };
await build({ stdin: { contents: `
export { World } from './src/game/action/engine/world.ts';
export * from './src/game/action/enemy/index.ts';
export { linkItems } from './src/game/action/engine/itemsLink.ts';
export { insideProp } from './src/game/action/engine/propBlock.ts';
export { Input } from './src/game/action/engine/input.ts';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'browser', outfile: `dist-test/enemy-ai-round2-runtime${sharedPatch ? '-integrated' : ''}.mjs`, plugins: sharedPatch ? [patchPlugin] : [], logLevel: 'error' });
const { World, createEnemy, isThreat, linkItems, insideProp } = await import(`../dist-test/enemy-ai-round2-runtime${sharedPatch ? '-integrated' : ''}.mjs`);
const pad = { mx: 0, my: 0, evade: false, run: false, downDouble: false, held: new Set(), pressed: new Set(), released: new Set() };
function setup(kind, x = 950, px = 400) {
  const run = { seed: 42, agent: 'jyaldi' };
  const w = new World(run, {}, null, (s, w) => createEnemy(s.kind, s.x, s.y, w.rand));
  w.threat = isThreat;
  w.enterFloor({ id: 'enemy-ai-round2', type: 'lobby', title: 'AI 검증', length: 1600, startX: px, exitX: Infinity, encounters: [], props: [] });
  const e = w.spawn({ kind, x, y: 565 });
  const events = [];
  w.on(ev => events.push(ev));
  return { w, e, run, events };
}
function step(w, n) {
  for (let i = 0; i < n; i++) {
    // 적의 공격은 실제 판정한다. 생존 시간을 늘리는 것은 표적 플레이어뿐이다.
    w.player.invuln = 100;
    w.step(pad);
  }
}
let attackId = 20000;
function hit(w, e, react, dmg = 1) {
  return e.applyHit({ x0: e.x - 50, x1: e.x + 50, z0: 0, z1: 500, y: e.y, attackId: attackId++, dmg, react, dir: 1, armorBreak: true }, w);
}

test('새 World: 적 자신의 공격으로 적 HP가 줄지 않는다', pendingWorld, () => {
  const { w, e } = setup('crawler', 440);
  const hp = e.hp;
  step(w, 100);
  assert.equal(e.hp, hp);
});

test('백일몽 탐사원: 멀리서 다가와 사거리 안에서 실제 공격한다', () => {
  const { w, e, events } = setup('dd_member');
  step(w, 600);
  assert.ok(events.some(ev => ev.type === 'enemyTell'), `공격 없이 정지: x=${e.x}, state=${e.state}`);
  assert.ok(events.some(ev => ev.type === 'hit' && ev.target === 'player') || e.atk > 0);
});

test('인사한 주민: 피격하면 적대하고 띄움/다운/기상에서 회복한다', () => {
  for (const react of ['flinch', 'launch', 'bind']) {
    const { w, e } = setup('resident');
    step(w, 40);
    e.brain.signal(e, { kind: 'greet', x: e.x }, w);
    hit(w, e, react);
    step(w, 180);
    assert.equal(e.hostile, true, `${react}: 인사 뒤 피격을 무시`);
    assert.ok(!['hurt', 'stunned', 'air', 'down', 'getup', 'bound'].includes(e.state), `${react}: ${e.state}/${e.st}`);
  }
});

test('천장 적: 매달린 채 피격해도 낙하·기상을 끝낸다', () => {
  for (const react of ['launch', 'down', 'bind']) {
    const { w, e } = setup('crawler', 1450);
    step(w, 40);
    hit(w, e, react);
    let landed = false;
    for (let t = 0; t < 120; t++) { step(w, 1); if (e.z === 0) landed = true; }
    assert.ok(landed, `${react}: z=${e.z}, cling=${e.mem.cling}, state=${e.state}`);
    assert.notEqual(e.state, 'air');
  }
});

test('일반 적: 탁자의 양쪽·레인 경계를 돌아 추격한다', () => {
  for (const [ex, px, py] of [[1000,400,565], [400,1000,565], [1000,400,460], [1000,400,660]]) {
    const { w, e, run, events } = setup('hollow', ex, px);
    w.player.y = py; e.y = py;
    const items = linkItems(w, run);
    w.props.push({ id: 'table', kind: 'table', x: 720, y: py, w: 180, h: 100 });
    w.hooks.push(() => items.tick());
    step(w, 900);
    assert.ok(events.some(ev => ev.type === 'enemyTell'), `가구 앞 정지: ${ex}/${px}/${py} -> ${e.x},${e.y}`);
    assert.ok(!w.solidsNow.some(p => insideProp(p, e.x, e.y)), '추격 후에도 가구 안에 겹침');
  }
});

test('천장 적: 착지 후 다시 천장에 올라 두 번째 덮치기를 한다', pendingWorld, () => {
  const { w, e } = setup('crawler', 440);
  let drops = 0, lastAtk = 0, landed = false, climbed = false;
  for (let t = 0; t < 1200 && drops < 2; t++) {
    step(w, 1);
    if (e.z === 0) landed = true;
    if (landed && e.z >= 280 && e.mem.cling) climbed = true;
    if (e.move?.id === 'drop' && e.atk !== lastAtk) { lastAtk = e.atk; drops++; }
  }
  assert.ok(climbed, `재상승 실패: ${e.state} z=${e.z}`);
  assert.ok(drops >= 2, `덮치기 ${drops}회`);
});

test('바닥 추격형과 도주형도 가구를 돌아간다', () => {
  for (const kind of ['floorhand', 'shade', 'dd_member']) {
    const { w, e, run, events } = setup(kind, 1000);
    const items = linkItems(w, run); w.hooks.push(() => items.tick());
    w.light = 0;
    w.props.push({ id: 'table', kind: 'table', x: kind === 'dd_member' ? 1250 : 720, y: 565, w: 180, h: 100 });
    if (kind === 'dd_member') { step(w, 12); hit(w, e, 'flinch', 110); }
    step(w, 900);
    if (kind === 'dd_member') {
      assert.equal(e.alive, false, `도주 중 가구 끼임: ${e.x},${e.y}`);
      assert.equal(events.filter(ev => ev.type === 'custom' && ev.name === 'enemyEscape').length, 1);
      assert.equal(events.filter(ev => ev.type === 'custom' && ev.name === 'enemyDrop').length, 0);
    } else assert.ok(events.some(ev => ev.type === 'enemyTell'), `${kind}: ${e.x},${e.y}`);
  }
});

test('화면 밖에서 생성된 적은 방 안으로 복귀해 공격한다', () => {
  for (const [kind, x] of [['hollow', -400], ['fb_smg', 2000], ['dd_member', 2000]]) {
    const { w, e, events } = setup(kind, x);
    step(w, 1000);
    assert.ok(events.some(ev => ev.type === 'enemyTell'), `${kind}: ${e.x}/${e.state}`);
    assert.ok(e.x >= w.bounds[0] && e.x <= w.bounds[1], `${kind}: 방 밖 잔류`);
  }
});

test('실제 총알 판정으로 사망·드랍·제거가 한 번만 일어난다', () => {
  const { w, e, run, events } = setup('dd_member', 1000);
  const items = linkItems(w, run); w.hooks.push(() => items.tick());
  step(w, 40);
  for (let t = 0; t < 600 && e.hp > 0; t++) {
    if (t % 12 === 0) w.addBullet({ x: e.x - 40, y: e.y, z: 120, dir: 1 });
    step(w, 1);
  }
  step(w, 60);
  assert.equal(e.hp, 0);
  assert.equal(w.bodies.includes(e), false);
  assert.equal(events.filter(ev => ev.type === 'enemyDie' && ev.kind === e.kind).length, 1);
  const drops = events.filter(ev => ev.type === 'custom' && ev.name === 'enemyDrop');
  assert.equal(drops.length, 1);
  assert.ok(drops[0].data.drops.length > 0);
  assert.ok(w.itemField.ents.some(p => p.type === 'pickup'), '실제 아이템 필드 드랍');
});

test('만지는 손: 몸 분리 때문에 접촉 사거리 밖에 영구 밀려나지 않는다', pendingWorld, () => {
  const { w, events } = setup('toucher');
  step(w, 500);
  assert.ok(events.some(ev => ev.type === 'enemyTell'), '접촉 예고가 한 번도 없음');
});

test('사격 무리: 뒤쪽 적도 사거리 안에서 교전한다', () => {
  const { w, e } = setup('fb_smg', 700);
  const foes = [e, ...[850, 1000, 1200].map(x => w.spawn({kind: 'fb_smg', x, y: 565}))];
  step(w, 900);
  for (const foe of foes) assert.ok(foe.atk > 0, `후열 정지: ${foe.x}/${foe.y}`);
});

test('일반 적: 무피격 대기 플레이어에게 실제 피해를 준다', () => {
  const { w, events } = setup('dd_member');
  const hp = w.player.hp;
  for (let t = 0; t < 700 && w.player.hp === hp; t++) w.step(pad);
  assert.ok(w.player.hp < hp);
  assert.ok(events.some(ev => ev.type === 'hit' && ev.target === 'player'));
});

// 선택 검증: 별도 회색 상자 HTML + 실제 Chromium 입력. 캐릭터 그림을 읽거나 만들지 않는다.
if (process.env.ENEMY_AI_ROUND2_BROWSER === '1') test('Chromium: World 추격·가구·키보드 사격·모바일 표시', async () => {
  const { writeFile, readFile } = await import('node:fs/promises');
  const { createServer } = await import('node:http');
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/enemy-ai-round2-browser-tools/node_modules/playwright/index.mjs');
  const suffix = sharedPatch ? '-integrated' : '';
  const htmlName = `enemy-ai-round2${suffix}.html`;
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>일반 적 AI 2차 검증</title>
<style>body{margin:0;background:#171d28;color:#eee;font:16px sans-serif}main{max-width:1280px;margin:auto}canvas{width:100%;height:calc(100dvh - 185px);min-height:180px;object-fit:contain;display:block;background:#222c3c}button,select{font:inherit;margin:8px;padding:8px}p{margin:12px}</style>
<main><p>일반 적 AI · 회색 상자 기능 검증 / 캐릭터 그림 없음 / 공용 연결 패치 ${sharedPatch ? '검증 번들에 적용' : '미적용'}</p>
<select id="kind"><option>hollow</option><option>dd_member</option><option>crawler</option><option>resident</option></select><button id="reset">다시 시작</button><button id="shoot">사격 S</button><button id="pause">정지/재개</button>
<p>방향키 이동 · S 사격 · A 근접 · Space 점프. 청록=플레이어, 붉은색=적, 갈색=가구. 아래 상태에 HP/틱 표시.</p><canvas width="1600" height="720"></canvas><p id="status"></p></main>
<script type="module">
import {World,createEnemy,isThreat,linkItems,Input} from './enemy-ai-round2-runtime${suffix}.mjs';
const input=new Input();input.attach(window);let w,e,events,paused=false;
function reset(kind='hollow',table=true){document.querySelector('#kind').value=kind;const run={seed:42,agent:'jyaldi'};w=new World(run,{},null,(s,w)=>createEnemy(s.kind,s.x,s.y,w.rand));w.threat=isThreat;
w.enterFloor({id:'round2-browser',title:'AI 검증',type:'lobby',length:1600,startX:400,exitX:Infinity,encounters:[],props:[]});e=w.spawn({kind,x:1000,y:565});events=[];w.on(ev=>events.push(ev));const items=linkItems(w,run);w.hooks.push(()=>items.tick());if(table)w.props.push({id:'table',kind:'table',x:720,y:565,w:180,h:100});}
reset();const c=document.querySelector('canvas').getContext('2d');
function draw(){c.clearRect(0,0,1600,720);c.fillStyle='#344156';c.fillRect(0,440,1600,250);for(const p of w.solidsNow){c.fillStyle='#82624b';c.fillRect(p.x-p.w/2,p.y-50,p.w,100)}
for(const b of [w.player,...w.bodies]){if(!b.alive)continue;c.fillStyle=b===w.player?'#60dcc9':b.state==='dead'?'#777':'#e87878';c.fillRect(b.x-20,b.y-b.z-70,40,70);c.fillStyle='#fff';c.font='18px sans-serif';c.fillText(b.kind+' '+Math.ceil(b.hp),b.x-35,b.y-b.z-80)}document.querySelector('#status').textContent='tick '+w.tick+' / player HP '+w.player.hp+' / enemy '+e.state+' HP '+e.hp+' / x '+e.x.toFixed(1)+' y '+e.y.toFixed(1);}
function step(n){for(let i=0;i<n;i++)w.step(input.sample());draw()}
window.__ai={get world(){return w},get enemy(){return e},get events(){return events},reset,step,set paused(v){paused=v}};
document.querySelector('#reset').onclick=()=>reset(document.querySelector('#kind').value);
document.querySelector('#pause').onclick=()=>paused=!paused;
document.querySelector('#shoot').onclick=()=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyS',bubbles:true}));step(1);window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyS',bubbles:true}));};
let last=performance.now(),acc=0;function loop(now){acc+=Math.min(100,now-last);last=now;while(acc>=1000/30){if(!paused)step(1);acc-=1000/30}draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
</script></html>`;
  await writeFile(`dist-test/${htmlName}`, html);
  const server = createServer(async (req, res) => {
    const name = req.url?.split('?')[0].slice(1);
    if (![htmlName, `enemy-ai-round2-runtime${suffix}.mjs`].includes(name)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', name.endsWith('.mjs') ? 'text/javascript' : 'text/html');
    res.end(await readFile(`dist-test/${name}`));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const errors = [], results = [];
  try {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/${htmlName}`);
      await page.waitForFunction(() => !!window.__ai);
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
      assert.ok(await page.evaluate(() => window.__ai.world.player.x > 400), '실제 방향키 이동');
      const chase = await page.evaluate(() => {
        const a = window.__ai; a.paused = true; a.reset('hollow', true); a.step(900);
        return { x: a.enemy.x, y: a.enemy.y, attacks: a.events.filter(e => e.type === 'enemyTell').length, hp: a.world.player.hp };
      });
      assert.ok(chase.attacks > 0, 'Chromium 가구 우회 추격');
      await page.evaluate(() => { window.__ai.reset('dd_member', false); window.__ai.paused = false; });
      const before = await page.evaluate(() => window.__ai.world.player.ammo);
      if (viewport.width < 1000) await page.locator('#shoot').tap();
      else await page.keyboard.press('KeyS');
      // 첫 S는 권총 뽑기, 준비가 끝난 뒤 두 번째 S로 발사한다.
      await page.waitForTimeout(500);
      if (viewport.width < 1000) await page.locator('#shoot').tap();
      else await page.keyboard.press('KeyS');
      await page.waitForTimeout(1800);
      const shot = await page.evaluate(() => ({ ammo: window.__ai.world.player.ammo, hp: window.__ai.enemy.hp }));
      assert.ok(shot.ammo < before, '실제 S/터치 사격');
      assert.ok(shot.hp < 150, '발사한 탄환이 적에게 명중');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '가로 넘침 없음');
      await page.screenshot({ path: `dist-test/enemy-ai-round2${suffix}-${viewport.width}.png` });
      results.push({ viewport, chase, shot }); await page.close();
    }
    assert.deepEqual(errors, []);
    await writeFile(`dist-test/enemy-ai-round2${suffix}-browser.json`, JSON.stringify({ sharedPatch, results, errors }, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
