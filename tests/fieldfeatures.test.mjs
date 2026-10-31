// 필드 기능 (10-31 사용자 결정 docs/필드기능_결정_1031.md): 동행·쫓아냄·반응·말다툼·수다·퇴근·경보
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-fieldfeat-'));
const names = ['rng', 'places', 'actors', 'namedReact'];
await build({ entryPoints: [...names.map((n) => `src/game/world/${n}.ts`), 'src/core/visitPrompt.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)));
const R = await imp('game/world/rng'), P = await imp('game/world/places'), A = await imp('game/world/actors'), NR = await imp('game/world/namedReact'), VP = await imp('core/visitPrompt');

const scenes = [
  { id: 'lobby', name: '로비', length: 2000, lane: [420, 669], doors: [{ id: 'main', x: 300, kind: 'glass', to: 'street', toDoor: 'main' }, { id: 'stairs', x: 1500, kind: 'stairs', up: 'f3' }] },
  { id: 'street', name: '거리', length: 1920, legacy: true, doors: [{ id: 'main', x: 640, kind: 'main', to: 'lobby', toDoor: 'main' }] },
  { id: 'f3', name: '3층', length: 2400, lane: [420, 669], doors: [{ id: 'office', x: 400, kind: 'glass', to: 'office', toDoor: 'out' }, { id: 'stairs', x: 2000, kind: 'stairs', down: 'lobby' }] },
  { id: 'office', name: '사무실', length: 1600, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'office' }] },
];
const kinds = { office: 'office', f3: 'corridor', lobby: 'lobby', street: 'street' };
const HQ = new Set(['lobby', 'f3', 'office']);
const sim = (o = {}) => new A.WorldSim(new P.PlaceGraph(scenes, [], kinds), R.mulberry32(7), { sceneFaction: (s) => (HQ.has(s) ? 'A00' : null), ...o });
const named = (w, name, scene = 'office', x = 800) => w.add({ id: `npc:${name}`, name, kind: 'named', brain: 'needs', home: scene, roam: [scene], look: name }, { scene, x, y: 560 });
const run = (w, sec, player) => { for (let t = 0; t < sec; t += 1 / 30) w.step(1 / 30, typeof player === 'function' ? player(t) : player); };

test('표시: 답 끝 [[동행]] 등을 떼고 종류만 남긴다 (모르는 [[…]]는 그대로)', () => {
  const r = VP.takeFieldTags('좋아, 가자.\n[[동행]]');
  assert.deepEqual(r.tags, ['follow']);
  assert.equal(r.raw.trim(), '좋아, 가자.');
  assert.deepEqual(VP.takeFieldTags('싫어.').tags, []);
  assert.deepEqual(VP.takeFieldTags('a [[기다림]] [[복귀]] [[허가]] [[경보]] [[호감 +1]]').tags, ['wait', 'return', 'permit', 'alarm']);
  assert.match(VP.takeFieldTags('x [[호감 +1]]').raw, /\[\[호감/);
  assert.equal(VP.fieldTagRules([]), '');
  assert.match(VP.fieldTagRules(['follow']), /\[\[동행\]\]/);
});

test('동행: 따라 걷고, 장면을 같이 넘고, 기다려·돌아가', () => {
  const w = sim();
  const a = named(w, '에일린');
  run(w, 1, { scene: 'office', x: 600, y: 560 });
  assert.ok(w.setFollow('에일린', 'follow'));
  assert.ok(a.following);
  // 주인공이 오른쪽으로 걸어감 → 뒤따라 옴
  run(w, 6, (t) => ({ scene: 'office', x: 600 + Math.min(t, 4) * 200, y: 560 }));
  assert.ok(Math.abs(a.x - 1400) < 260, `따라옴 x=${a.x}`);
  assert.ok(a.x < 1400, '주인공 뒤');
  // 장면 이동
  run(w, 0.2, { scene: 'f3', x: 420, y: 560 });
  assert.equal(a.scene, 'f3');
  assert.equal(w.events.filter((e) => e.kind === 'follow').length, 1);
  // 기다려: 동행이 풀리고 그 자리
  assert.ok(w.setFollow('에일린', 'wait'));
  const x0 = a.x;
  run(w, 10, { scene: 'f3', x: 2000, y: 560 });
  assert.ok(!a.following && a.hold);
  assert.ok(Math.abs(a.x - x0) < 5, '기다림');
  // 돌아가: 일과로
  assert.ok(w.setFollow('에일린', 'return'));
  assert.ok(!a.hold && !a.following);
});

test('동행: 최대 4명, 쓰러지면 풀림', () => {
  const w = sim();
  const ps = ['가', '나', '다', '라', '마'].map((n, i) => named(w, n, 'office', 500 + i * 60));
  run(w, 0.5, { scene: 'office', x: 600, y: 560 });
  const ok = ps.map((p) => w.setFollow(p.def.name, 'follow'));
  assert.deepEqual(ok, [true, true, true, true, false]);
  ps[0].act = 'down';
  run(w, 0.1, { scene: 'office', x: 600, y: 560 });
  assert.ok(!ps[0].following);
  assert.ok(w.events.some((e) => e.kind === 'follow' && e.mode === 'hit'));
});

test('반응표: 55명, 칸 값은 정해진 동작·행동만', () => {
  const acts = new Set(['ignore', 'watch', 'approach', 'confront', 'attack', 'protect', 'report', 'avoid', 'flee', 'cower']);
  let n = 0;
  for (const name of ['쟈알디', '에일린', '콘쥬스', '탐미주의']) assert.ok(NR.reactOf(name), name);
  for (const s of ['weapon', 'body', 'uproar', 'crime', 'allyHit', 'allyDown']) {
    const c = NR.reactCell('에일린', s);
    assert.ok(c && acts.has(c.act), s);
    n++;
  }
  assert.equal(n, 6);
  assert.equal(NR.reactOf('콘쥬스').combat, false);
});
