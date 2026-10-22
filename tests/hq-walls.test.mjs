// 본부 모든 장면: 문·계단·엘리베이터가 벽 그림 속 장식(게시판·창·소화전…)이나 서로를 덮지 않는지 (통합 검수 22·23).
// 엔진과 같은 drawHqWall(art/bg.ts)을 기록용 캔버스로 돌려 벽 칸 배치를 얻고, hq/wallDeco.ts의 장식 구간과 맞대 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';

const BG = 'game-src/art/bg/dot';
const size = new Map(); // 'place/name' → [w, h]
const pack = {};
for (const place of readdirSync(BG)) {
  for (const sub of ['', 'objects/']) {
    const dir = `${BG}/${place}/${sub}`;
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.png'))) {
      const b = readFileSync(dir + f);
      const key = `${place}/${sub}${f.slice(0, -4)}`;
      const url = `data:image/png;base64,${b.toString('base64')}`;
      size.set(key, [b.readUInt32BE(16), b.readUInt32BE(20)]);
      size.set(url, key);
      (pack[place] ??= {})[sub + f.slice(0, -4)] = url;
    }
  }
}
// 브라우저 없이: 그림은 크기만 아는 가짜
globalThis.window = { __GOEI_BG_ART__: pack };
globalThis.Image = class {
  set src(url) {
    const v = size.get(url);
    const [w, h] = size.get(v);
    Object.assign(this, { key: v, width: w, height: h, naturalWidth: w, complete: true });
  }
};
const bundle = async (code) => {
  const out = await build({ stdin: { contents: code, resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', target: 'es2022', write: false });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
};
const M = await bundle(`export { drawHqWall, HQ_PLACE, propArtSize } from './src/game/action/art/bg'; export { HQ_SCENES } from './src/game/action/hq/map'; export { HQ_WALL_DECO } from './src/game/action/hq/wallDeco';`);

const TOP = 440; // engine/hub.ts LANE[0]
const K = TOP / 220;
const SCREEN_W = 1280;
// engine/hub.ts DOOR_W (+ 문틀 8)
const DOOR_W = { main: 190, door: 110, glass: 150, steel: 120, security: 120, elevator: 150, stairs_up: 120, stairs_down: 120, shop: 130 };
const STAIRS_ART = { stairs_up: 'hq_lobby/objects/hq_lobby_objects_6', stairs_down: 'hq_lobby/objects/hq_lobby_objects_9' };

/** 기록용 캔버스: drawImage마다 그림 이름, 원본 x 구간, 화면 x 구간, 뒤집힘 */
function recorder() {
  const draws = [];
  let t = { tx: 0, s: 1 };
  const stack = [];
  const noop = () => {};
  const ctx = new Proxy(
    {
      save: () => stack.push({ ...t }),
      restore: () => (t = stack.pop() ?? { tx: 0, s: 1 }),
      translate: (x) => (t.tx += t.s * x),
      scale: (sx) => (t.s *= sx),
      drawImage: (im, sx, sy, sw, sh, dx, dy, dw, dh) => {
        if (dx === undefined) [dx, dy, dw, dh, sx, sy, sw, sh] = [sx, sy, sw ?? im.width, sh ?? im.height, 0, 0, im.width, im.height];
        const a = t.tx + t.s * dx,
          b = t.tx + t.s * (dx + dw);
        draws.push({ key: im.key, sx, sy, sw, dy, dh, x0: Math.min(a, b), x1: Math.max(a, b), flip: t.s < 0 });
      },
      createLinearGradient: () => ({ addColorStop: noop }),
      measureText: () => ({ width: 10 }),
    },
    { get: (o, k) => (k in o ? o[k] : typeof k === 'string' ? noop : undefined), set: () => true },
  );
  return { ctx, draws };
}

function layout(sc) {
  const place = M.HQ_PLACE[sc.look] ?? M.HQ_PLACE[sc.id];
  const length = Math.max(SCREEN_W, sc.length);
  // 처음 부를 때 그림을 만들고(null), 두 번째에 그린다 (bg.ts image())
  M.drawHqWall(recorder().ctx, place, sc.id, length, TOP, sc.doors);
  const r = recorder();
  const covered = M.drawHqWall(r.ctx, place, sc.id, length, TOP, sc.doors) ?? new Set();
  const deco = [];
  const over = [];
  const cut = [];
  for (const d of r.draws) {
    const name = d.key.split('/').pop();
    if (name === 'hq_corridor_wall_1' && d.sy > 0) {
      over.push({ what: '엘리베이터', a: d.x0, b: d.x1 });
      continue;
    }
    if (!name.includes('_wall') || d.dh !== TOP) continue;
    for (const [u0, u1] of M.HQ_WALL_DECO[name] ?? []) {
      const lo = Math.max(u0, d.sx),
        hi = Math.min(u1, d.sx + d.sw);
      if (hi <= lo) continue;
      if (hi - lo < u1 - u0 - 2) cut.push(`${name} 장식 ${u0}~${u1}이 칸 이음매에서 잘림 (${Math.round(d.x0)}~${Math.round(d.x1)})`);
      const a = d.flip ? d.x1 - (hi - d.sx) * K : d.x0 + (lo - d.sx) * K;
      deco.push({ what: `${name} 장식 ${u0}~${u1}`, a, b: a + (hi - lo) * K });
    }
  }
  for (const d of sc.doors) {
    if (covered.has(d.id)) continue;
    let half = DOOR_W[d.kind] / 2 + 8;
    const art = STAIRS_ART[d.kind];
    if (art && size.has(art)) half = size.get(art)[0];
    over.push({ what: `${d.kind}(${d.id})`, a: d.x - half, b: d.x + half });
  }
  // 벽에 붙은 가구(사물함 줄·책장 등)도 문·계단·엘리베이터를 덮으면 안 된다
  const things = [];
  for (const t of sc.things) {
    if (!t.wall) continue;
    const sz = M.propArtSize(t.kind, undefined);
    if (sz) things.push({ what: `가구 ${t.kind}`, a: t.x - sz.w / 2, b: t.x + sz.w / 2 });
  }
  return { deco, over, things, cut, length };
}

test('옛 벽 칸 장면(거리·파스타집): 문이 벽 장식·벽 가구나 서로를 덮지 않는다', () => {
  const bad = [];
  for (const sc of M.HQ_SCENES.filter((s) => s.legacy)) {
    const { deco, over, things, cut, length } = layout(sc);
    for (const c of cut) bad.push(`${sc.id}: ${c}`);
    for (const t of things) for (const d of deco) if (Math.min(d.b, t.b) - Math.max(d.a, t.a) > 4) bad.push(`${sc.id}: ${t.what} ${Math.round(t.a)}~${Math.round(t.b)} ↔ ${d.what} ${Math.round(d.a)}~${Math.round(d.b)}`);
    for (const t of things) for (const o of over) if (Math.min(o.b, t.b) - Math.max(o.a, t.a) > 4) bad.push(`${sc.id}: ${t.what} ${Math.round(t.a)}~${Math.round(t.b)} ↔ ${o.what}`);
    for (const o of over) {
      if (o.a < -2 || o.b > length + 2) bad.push(`${sc.id}: ${o.what} ${Math.round(o.a)}~${Math.round(o.b)}가 장면 밖으로 나감`);
      for (const d of deco) if (Math.min(o.b, d.b) - Math.max(o.a, d.a) > 4) bad.push(`${sc.id}: ${o.what} ${Math.round(o.a)}~${Math.round(o.b)} ↔ ${d.what} ${Math.round(d.a)}~${Math.round(d.b)}`);
    }
    for (let i = 0; i < over.length; i++)
      for (let j = i + 1; j < over.length; j++) {
        const p = over[i], q = over[j];
        if (Math.min(p.b, q.b) - Math.max(p.a, q.a) > 0) bad.push(`${sc.id}: ${p.what} ↔ ${q.what} 서로 겹침`);
      }
  }
  assert.deepEqual(bad, []);
});

test('장식 표는 본부 벽 그림 이름과 맞는다', () => {
  const names = new Set();
  for (const [place, files] of Object.entries(pack)) if (place.startsWith('hq_')) for (const n of Object.keys(files)) if (n.includes('_wall')) names.add(n);
  for (const n of Object.keys(M.HQ_WALL_DECO)) assert.ok(names.has(n), `그림 없음: ${n}`);
});
