// 대전 기술 부품 해석기 (2026-11-08 새로 짬). 인물 설정 skills 의 부품 목록(그림 이름·자리·맞음 종류)만 읽고,
// 자리는 대전 화면 기준으로 새로 정한다:
//   hand = 지금 장의 총구·손끝, front = 몸 앞 바닥(dx), self = 발밑, body = 몸 가운데, target = 상대 자리,
//   screen = 두 사람 사이 가운데 (필드의 「화면 가운데」 대신. 크기는 필드에서 캐릭터와 이루던 비율 그대로)
// 피해 값은 부품의 dmg 를 쓰지 않는다: 그 기술 한 번의 전체 피해(rules DMG)를 맞는 횟수로 나눈 값 (Use.per)
import { VFX_ORG } from './vfxorg';
import { vfxOf, vfxDur, muzzleOf, framePt } from './art';
import { later, type Stage, type Use, type Proj } from './stage';
import type { Fighter, HitKind } from './fighter';
import { K, LINE, DT, DMG, HP } from './rules';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
export interface FxCtx {
  use: Use | null;
  /** 시작 자리 (충전 방출 순간 총구 등) */
  o?: { x: number; y: number };
  /** 부품 자리 (화면 전체·소환물·떨어진 자리) */
  pt?: { x: number; z?: number; onT?: boolean };
  lv?: number;
  /** 기본 원거리 (한 번에 한 발 규칙) */
  basic?: boolean;
}

/** 필드 테스트룸에서 서 있는 사람 배율 (화면 전체 그림을 캐릭터와 같은 비율로 맞추려고) */
const FIELD_K = 1.184;
const REL = K / FIELD_K;
const MZ_GAP = 30;
const KINDS = new Set(['light', 'heavy', 'launch', 'blow', 'down', 'stun', 'spike', 'pull', 'turn']);
const kindOf = (k: string | undefined, dflt: HitKind): HitKind => (k && KINDS.has(k) ? (k as HitKind) : dflt);

export function runFx(me: Fighter, list: Json[] | undefined, c: FxCtx): void {
  for (const s of list || []) {
    if (!s || typeof s !== 'object') continue;
    const f = (FX as Record<string, (me: Fighter, s: Json, c: FxCtx) => void>)[s.t];
    if (!f) continue;
    try { f(me, s, c); } catch (e) { console.warn('[vs fx]', s.t, e); }
  }
}

// ───────── 자리 ─────────
interface Pos { x: number; gy: number; hy: number; k: number }
function target(me: Fighter, c: FxCtx): { x: number; z: number; onT: boolean } {
  if (c.pt) return { x: c.pt.x, z: c.pt.z ?? 0, onT: !!c.pt.onT };
  const o = me.foe();
  return o ? { x: o.x, z: o.z, onT: true } : { x: me.x + me.face * 300, z: 0, onT: false };
}
function screenMid(me: Fighter): number {
  const o = me.foe(), st = me.st;
  const mid = o ? (me.x + o.x) / 2 : me.x + me.face * 200;
  return Math.max(st.viewX0 + 120, Math.min(st.viewX0 + st.viewW - 120, mid));
}
function posOf(me: Fighter, s: Json, c: FxCtx): Pos {
  const f = me.face;
  if (s.at === 'target' || s.at === 'spot') { const p = target(me, c); return { x: p.x + f * (s.dx || 0) * K, gy: LINE, hy: LINE - p.z - (s.h ?? 110) * K, k: K }; }
  if (s.at === 'self') return { x: me.x + f * (s.dx || 0) * K, gy: LINE, hy: LINE - me.z - (s.h ?? 110) * K, k: K };
  if (s.at === 'front') return { x: me.x + f * (s.dx ?? 150) * K, gy: LINE, hy: LINE - me.z - (s.h ?? 110) * K, k: K };
  if (s.at === 'body') return { x: me.x + f * (s.dx || 0) * K, gy: LINE, hy: LINE - me.z - (s.h ?? 110) * K + (s.dy || 0) * K, k: K };
  if (s.at === 'screen' || s.at === 'center') return { x: screenMid(me) + f * (s.dx || 0) * REL, gy: LINE - 20 + (s.dy || 0) * REL, hy: LINE - 230 * REL + (s.dy || 0) * REL, k: REL };
  const m = c.o || me.muzzle();
  return { x: m.x + f * (s.dx || 0) * K, gy: LINE, hy: m.y + (s.dy || 0) * K, k: K };
}

// ───────── 맞음 ─────────
function useOf(me: Fighter, c: FxCtx): Use { return c.use ?? me.newUse('skill', DMG.skill, 4); }
/** x 둘레 r 안(그리고 높이 h0~h1 안)에 있는 상대를 h 로 맞힌다. n 번 나눠 맞음 */
function strike(me: Fighter, c: FxCtx, h: Json, area: { x: number; r: number; y?: number; all?: boolean; front?: boolean } | null, at?: { x: number; y: number }) {
  if (!h) return;
  const n = Math.max(1, h.n || 1), use = useOf(me, c);
  // 여러 대로 나눠 맞는 것: 첫 대에 맞은 상대는 밀려나도 나머지를 다 맞는다 (11-08: 돌진 2타 등이 첫 대 넉백으로 헛나감)
  const victims = new Set<Fighter>();
  const one = (i: number) => {
    const kind = i === n - 1 ? kindOf(h.kind, 'heavy') : kindOf(h.mid, 'light');
    for (const o of i > 0 && victims.size ? [...victims] : me.foes()) {
      if (area && !area.all && !(i > 0 && victims.size)) {
        const b = o.hurt();
        if (area.x + area.r < b.x0 || area.x - area.r > b.x1) continue;
        if (area.front && (o.x - me.x) * me.face < -30) continue;
        if (area.y != null) { const z = LINE - area.y; if (z < b.z0 - 90 || z > b.z1 + 60) continue; }
      }
      const b = o.hurt();
      const hx = at?.x != null ? Math.max(b.x0, Math.min(b.x1, at.x)) : area && !area.all ? Math.max(b.x0, Math.min(b.x1, area.x)) : o.x - me.face * 14;
      const hy = at?.y != null ? Math.max(LINE - b.z1 + 20, Math.min(LINE - b.z0 - 20, at.y)) : area?.y != null ? area.y : LINE - (b.z0 + b.z1) / 2;
      const got = o.receive(me, { use, kind, at: { x: hx, y: hy }, noVfx: !!h.noVfx, vfx: h.vfx && vfxOf(h.vfx) ? h.vfx : undefined, vs: h.vs, tint: h.tint, sound: h.sfx });
      if (i === 0 && got !== 'miss') victims.add(o);
    }
  };
  for (let i = 0; i < n; i++) i ? later(me.st, i * (h.every || 0.1), () => one(i)) : one(0);
}

// ───────── 그림 ─────────
function sheet(st: Stage, name: string, x: number, y: number, s: number, o: Json = {}): boolean {
  const v = vfxOf(name);
  if (!v) return false;
  const d = vfxDur(v);
  const T = (o.loopFor || d) + (o.hold || 0);
  const e = { k: 'sheet', name, x, y, s, el: 0, dur: d, t: T, t0: T, ...o };
  if (o.back) st.fx.unshift(e); else st.fx.push(e);
  return true;
}
const spark = (st: Stage, x: number, y: number, n: number, c = '#ffffff', big = false) => st.fx.push({ k: 'spark', x, y, n, c, t: big ? 0.32 : 0.2, t0: big ? 0.32 : 0.2, seed: Math.random() * 99 });
const ring = (st: Stage, x: number, y: number, r: number, t: number, c: string, w = 4, sy = 1) => st.fx.push({ k: 'ring', x, y, r, t, t0: t, c, w, sy });
const dust = (st: Stage, x: number, n = 6) => st.fx.push({ k: 'dust', x, y: LINE, n, t: 0.45, t0: 0.45, seed: Math.random() * 99 });
const crater = (st: Stage, x: number, k: number, hold = 2.5) => { if (!sheet(st, 'ground-crater2', x, LINE, k, { anchor: 'pivot', under: true, back: true, hold, fade: 0.6, flip: Math.random() < 0.5 })) st.fx.push({ k: 'scorch', x, y: LINE, r: 50 * k, t: hold, t0: hold }); };
const colOf = (me: Fighter, s: Json) => (s.color && !/^rgba?\(/.test(s.color) ? s.color : me.color);
const boomSnd = (me: Fighter, x: number) => me.st.sfx({ type: 'hit', strength: 3, kind: 'blast', x });

/** 시트 지속 (초) */
const durOf = (name: string) => { const v = vfxOf(name); return v ? vfxDur(v) : 0.5; };

// ───────── 탄 ─────────
function proj(me: Fighter, s: Json, c: FxCtx, p: Pos) {
  const use = useOf(me, c), dir = me.face;
  const kind = s.kind || 'orb';
  if (kind === 'bullet') {
    me.st.sfx({ type: 'shot', x: p.x });
    const g = MZ_GAP * K, sx = p.x + dir * g;
    const pr: Proj = { owner: me, use, x: sx, y: p.hy, dir, v: 3000, life: 0.6, kind, size: K * (s.big ? 1.4 : 1), c: '#fff6d0', hit: s.hit || { kind: 'light' }, pierce: false, done: new Set(), basic: !!c.basic, trail: [], t: 0, end: s.end };
    me.st.proj.push(pr);
    me.st.fx.push({ k: 'shell', x: p.x - dir * 20, y: p.hy, vx: -dir * (80 + Math.random() * 80), vy: -260, g: LINE, t: 1.0, t0: 1.0 });
    return;
  }
  me.st.sfx({ type: 'whiff', strength: 2, x: p.x });
  const fancy = !c.basic && s.plain !== true;
  const pr: Proj = { owner: me, use, x: p.x, y: p.hy + (s.dy || 0) * K, dir, v: Math.min(1500, s.speed || 1300), life: s.life || 1.4, kind, vfx: s.vfx && vfxOf(s.vfx) ? s.vfx : undefined, tint: s.tint, rot: s.rot, size: (s.size || 1) * K * (fancy ? 1.4 : 1), c: s.color || me.color, hit: s.hit || { kind: 'light' }, pierce: !!s.pierce, done: new Set(), basic: !!c.basic, trail: [], t: 0, end: s.end };
  me.st.proj.push(pr);
}

/** 탄 한 틱 (match 가 부른다). 맞으면 true */
export function stepProj(st: Stage, p: Proj): boolean {
  const dt = DT;
  p.t += dt;
  const x0 = p.x;
  p.x += p.dir * p.v * dt;
  p.life -= dt;
  if (p.kind !== 'bullet') { p.trail.push([p.x, p.y]); if (p.trail.length > 8) p.trail.shift(); }
  const hitR = (p.kind === 'bullet' ? 8 : 26) * p.size;
  for (const o of p.owner.foes()) {
    if (p.done.has(o)) continue;
    const b = o.hurt(), z = LINE - p.y;
    const xa = Math.min(x0, p.x) - hitR, xb = Math.max(x0, p.x) + hitR;
    if (xb < b.x0 || xa > b.x1 || z < b.z0 - hitR - 20 || z > b.z1 + hitR) continue;
    p.done.add(o);
    const hx = p.dir > 0 ? Math.max(b.x0, Math.min(b.x1, p.x)) : Math.min(b.x1, Math.max(b.x0, p.x));
    const r = o.receive(p.owner, { use: p.use, kind: kindOf(p.hit?.kind, 'light'), at: { x: hx, y: p.y }, noVfx: p.kind === 'bullet' });
    if (r === 'hit' && p.kind === 'bullet') { if (!sheet(st, 'bullet_hit_body', hx, p.y, 2, { anchor: 'pivot', flip: p.dir < 0 })) spark(st, hx, p.y, 5, '#fff6d0'); }
    if (r !== 'miss' && p.end) runFx(p.owner, p.end, { use: p.use, pt: { x: hx, z: LINE - p.y, onT: true } });
    if (!p.pierce && r !== 'miss') return true;
  }
  // 탄끼리 부딪치면 둘 다 사라진다 (기본 원거리끼리)
  if (p.basic) for (const q of st.proj) if (q !== p && q.basic && q.owner.team !== p.owner.team && Math.abs(q.x - p.x) < 30 && Math.abs(q.y - p.y) < 60) { q.life = 0; spark(st, p.x, p.y, 8, '#ffffff'); return true; }
  return p.life <= 0 || p.x < st.viewX0 - 200 || p.x > st.viewX0 + st.viewW + 200;
}

// ───────── 부품 ─────────
const FX: Record<string, (me: Fighter, s: Json, c: FxCtx) => void> = {
  v(me, s, c) {
    const meta = vfxOf(s.vfx);
    if (!meta) return;
    const fw = meta.frames[0][2], fh = meta.frames[0][3], md = s.mode || (meta as Json).mode || 'center';
    const scr = s.at === 'screen';
    const p = s.at === 'body' ? posOf(me, s, c) : scr ? posOf(me, s, c) : (() => { const q = posOf(me, { at: 'front', ...s, dy: 0 }, c); if (s.dy) { q.gy += s.dy * q.k; q.hy += s.dy * q.k; } return q; })();
    let sc = (s.scale || 1) * p.k;
    if (s.w) sc = (1280 * s.w / fw) * REL;
    // 손에서 뻗는 그림: 시작점이 손에 오게 (자료의 dx 가 이미 반 폭만큼 밀어 둔 것은 그대로)
    const org = VFX_ORG[s.vfx];
    if (s.at === 'hand' && org != null) { const half = (0.5 - org) * fw * sc, dxw = (s.dx || 0) * K; if (half > 100 * K && dxw < half * 0.5) p.x += me.face * (half - dxw); }
    const flip = s.flip === false ? false : me.face < 0;
    const y = md === 'bottom' ? p.gy : p.hy;
    const o: Json = { anchor: md === 'bottom' ? 'bottom' : 'center', flip };
    for (const [k, v] of Object.entries({ under: s.under, back: s.back, tint: s.tint, hold: s.hold, loopFor: s.loop || undefined, loop: s.loop ? true : undefined, fade: s.fade, rot: s.rot ? s.rot * (flip ? -1 : 1) : undefined })) if (v !== undefined) o[k] = v;
    const go = () => {
      sheet(me.st, s.vfx, p.x, y, sc, o);
      if (s.boom) boomSnd(me, p.x);
    };
    go();
    if (s.hit) {
      const r = Math.min(260, (s.r ?? fw * 0.4) * sc), hy = md === 'bottom' ? p.gy - Math.min(fh * sc * 0.5, 110 * K) : p.hy;
      const hitAt = (t: number) => later(me.st, t, () => strike(me, c, t > (s.delay || 0) ? (s.tickHit || s.hit) : s.hit, scr ? { x: 0, r: 0, all: true } : { x: p.x, r: r + 20 }, scr ? undefined : { x: p.x, y: hy }));
      hitAt(s.delay || 0);
      if (s.loop || s.tick) { const every = s.tick || durOf(s.vfx), end = (s.loop || 0) + (s.hold || 0); for (let t = (s.delay || 0) + every; t < end - 0.05; t += every) hitAt(t); }
    }
    if (s.after) later(me.st, durOf(s.vfx) + (s.hold || 0), () => runFx(me, s.after, { ...c, pt: { x: p.x, z: 0, onT: c.pt?.onT } }));
  },
  proj(me, s, c) { proj(me, s, c, posOf(me, { at: 'hand', ...s }, c)); },
  beam(me, s, c) {
    const p = c.o || me.muzzle(), lv = s.lv || 1, w = s.w || [0, 10, 24, 40][lv] || 20;
    me.st.sfx({ type: 'shot', x: p.x });
    const dir = me.face, x2 = dir > 0 ? me.st.viewX0 + me.st.viewW + 60 : me.st.viewX0 - 60;
    me.st.fx.push({ k: 'beam', x: p.x, y: p.y, x2, dir, t: 0.22 + lv * 0.1, t0: 0.22 + lv * 0.1, sy: s.sy || [0, 0.35, 0.6, 0.9][lv] || 0.6, w, c: s.color || me.color });
    const len = Math.abs(x2 - p.x);
    strike(me, c, s.hit || { kind: lv >= 2 ? 'launch' : 'heavy' }, { x: p.x + dir * len / 2, r: len / 2, y: p.y, front: true });
  },
  melee(me, s, c) { const r = Math.max(s.range || 170, 175) * K; strike(me, c, s.hit, { x: me.x + me.face * r * 0.6, r: r * 0.6 + 20, front: true }); },
  hit(me, s, c) { if (s.hit) strike(me, c, s.hit, c.pt ? { x: c.pt.x, r: 60 } : { x: 0, r: 0, all: true }); },
  dash(me, s, c) {
    const v = Math.min(1400, s.speed || 1500), T = s.time || 0.45;
    me.st.sfx({ type: 'evade', x: me.x });
    let tt = 0, done = false;
    const tick = () => {
      tt += DT;
      if (me.state === 'hit' || me.state === 'air' || me.state === 'down' || me.state === 'ko') return;
      me.vx = me.face * v;
      // delay = 닿은 뒤 늦게 베이는 시간 (필드와 같게: 닿는 판정은 바로, 맞음만 늦게)
      if (!done && s.hit) for (const o of me.foes()) { const b = o.hurt(), x0 = me.x - me.half() - 10, x1 = me.x + me.half() + 10, fr = me.face > 0 ? x1 + 30 : x0 - 30; if (Math.min(x0, x1, fr) <= b.x1 && Math.max(x0, x1, fr) >= b.x0) { done = true; const ox = o.x; if (s.delay) later(me.st, s.delay, () => strike(me, c, s.hit, { x: o.x, r: Math.abs(o.x - ox) + 60 })); else strike(me, c, s.hit, { x: o.x, r: 10 }); if (s.stop) tt = T; } }
      if (tt < T) later(me.st, DT, tick); else me.vx = 0;
    };
    tick();
  },
  hop(me, s) { me.vx = -me.face * Math.min(900, s.v || 900); me.inv = Math.max(me.inv, Math.min(0.5, s.inv || 0.5)); },
  teleport(me, s) {
    const o = me.foe();
    sheet(me.st, 'fx-vanish', me.x, LINE - 110 * K, 3.4 * K, { anchor: 'center', tint: colOf(me, { color: s.color || '#d8d4e8' }) });
    if (!o) { me.x += me.face * 260; return; }
    const side = s.to === 'front' ? -1 : 1, from = Math.sign(o.x - me.x) || me.face;
    me.x = Math.max(80, Math.min(me.st.L - 80, o.x + from * side * (s.dist || 85) * K));
    me.face = (Math.sign(o.x - me.x) || me.face) as 1 | -1;
  },
  pull(me, s, c) { const o = me.foe(); if (!o) return; o.vx = Math.sign(me.x - o.x) * Math.min(700, (s.dist || 220) * 3); if (s.hit) strike(me, c, s.hit, { x: o.x, r: 40 }); },
  launch(me, s) { const o = me.foe(); if (o && o.state !== 'ko') o.knock('launch', me.face, Math.min(1, (s.v || 900) / 1050)); },
  lift(me, s, c) {
    const o = me.foe();
    if (!o || (c.pt && !c.pt.onT)) return;
    if (s.hit) strike(me, c, { ...s.hit, kind: 'launch' }, { x: o.x, r: 60 });
    if (o.state === 'air') { o.liftT = Math.min(1.0, s.time || 1.2); o.liftH = Math.min(220, (s.h || 120) * K); }
    ring(me.st, o.x, LINE, 60, 0.4, colOf(me, s), 3, 0.3);
  },
  bind(me, s) { const o = me.foe(); if (!o) return; o.bindT = Math.min(1.0, s.time || 1); sheet(me.st, 'fx-bind', o.x, LINE - o.z, 3.6 * K, { anchor: 'bottom', tint: colOf(me, s), hold: Math.max(0, Math.min(1.0, s.time || 1) - 0.6), fade: 0.4 }); },
  tether(me, s, c) {
    const q = c.pt || (me.foe() ? { x: me.foe()!.x, onT: true } : null);
    if (!q) return;
    me.st.fx.push({ k: 'line', from: me, tx: q.x, c: s.color || me.color, t: s.time || 1.5, t0: s.time || 1.5 });
    FX.bind(me, s, c);
  },
  hide(me, s) { me.vanish = { out: (s.mode || 'out') === 'out', t: 0, d: s.dur || 0.2 }; },
  mark(me, s) { const o = me.foe(); if (o) sheet(me.st, 'fx-mark', o.x, LINE - o.z - 240 * K, 1.8 * K, { anchor: 'center', tint: colOf(me, { color: s.color || '#ff5a4a' }) }); },
  buff(me, s) { for (let i = 0; i < 3; i++) later(me.st, i * 0.06, () => sheet(me.st, 'fx-buff', me.x + (i - 1) * 34 * K, LINE - 10 * K, 3 * K, { anchor: 'bottom', tint: colOf(me, s) })); me.st.sfx({ type: 'ability', x: me.x }); },
  heal(me, s) { me.hp = Math.min(me.hpMax, me.hp + Math.round((s.v || 30) * HP / 1000)); sheet(me.st, 'heal', me.x, LINE + 4, 3.4 * K, { anchor: 'pivot' }); },
  scan(me, s) { sheet(me.st, 'fx-scan', me.x + me.face * 170 * K, LINE - me.z - 130 * K, 3 * K, { anchor: 'center', flip: me.face < 0, tint: colOf(me, s) }); },
  eyes(me, s) { const { id, f, air } = me.pose(), m = me.art.A[id]; if (!m) return; const e = framePt(me.x, me.z, me.face, id, m, f, air, m.reach[0] * 0.15, m.h * 0.88); me.st.fx.push({ k: 'eyes', x: e.x, y: e.y, c: s.color || '#c58bff', t: s.time || 0.35, t0: s.time || 0.35 }); },
  shake(me, s) { me.st.shake(Math.min(12, (s.v || 10) * 0.6)); },
  // 화면 전체(필드) → 대전: 상대 자리 + 보이는 화면 안 몇 곳
  screen(me, s, c) {
    const st = me.st, o = me.foe(), spots: { x: number; z: number; onT: boolean }[] = [];
    for (let i = 0; i < Math.min(5, s.spots ?? 5); i++) spots.push({ x: st.viewX0 + 90 + Math.random() * (st.viewW - 180), z: 0, onT: false });
    if (o) spots.splice(Math.floor(Math.random() * (spots.length + 1)), 0, { x: o.x, z: o.z, onT: true });
    spots.forEach((pt, i) => later(st, i * (s.every ?? 0.11), () => runFx(me, (s.each || []).map((e: Json) => ({ ...e, at: e.at === 'self' ? 'self' : 'target', hit: pt.onT ? e.hit : null })), { ...c, pt: pt.onT && o ? { x: o.x, z: o.z, onT: true } : pt })));
  },
  // 늦게 나오는 부품: 동작이 끝난 뒤라도 나온다. 그 사이 내가 맞아 끊겼으면(맞는 중·뜬 채·쓰러짐) 안 나온다 (11-08: 박민성 충전 끝 내려찍기가 안 나옴)
  later(me, s, c) { later(me.st, s.in || 0.5, () => { if (me.inSuper || !(me.state === 'hit' || me.state === 'air' || me.state === 'down' || me.state === 'getup' || me.state === 'ko')) runFx(me, s.fx, c); }); },
  repeat(me, s, c) { for (let i = 0; i < (s.n || 3); i++) later(me.st, i * (s.every || 0.1), () => runFx(me, s.fx, c)); },
  chance(me, s, c) { runFx(me, Math.random() < (s.p ?? 0.5) ? s.yes : s.no, c); },
  barrage(me, s, c) {
    for (let i = 0; i < (s.n || 10); i++) later(me.st, i * (s.every || 0.1), () => {
      const t = target(me, c);
      runFx(me, (s.each || []).map((e: Json) => ({ ...e, at: 'target', hit: t.onT ? e.hit : null })), { ...c, pt: { x: t.x + (Math.random() - 0.5) * (s.jitter || 50), z: t.z, onT: t.onT } });
    });
  },
  blast(me, s, c) {
    const p = posOf(me, s, c), sc = (s.scale || 1.6) * p.k / K * K, onAir = (s.at || 'hand') === 'hand' || s.air;
    const name = s.vfx || 'eileen-rpg-explosion';
    if (!sheet(me.st, name, p.x + (onAir ? me.face * 26 * sc : 0), onAir ? p.hy : p.gy - 4, sc * 1.2 * (s.vfxMul || 1), onAir ? { anchor: 'center', flip: me.face < 0 } : { anchor: 'pivot' })) spark(me.st, p.x, onAir ? p.hy : p.gy - 30, 14, '#ffb04a', true);
    if (s.scorch) crater(me.st, p.x, sc * 0.7, s.scorch);
    if (!onAir) dust(me.st, p.x, 6);
    boomSnd(me, p.x);
    strike(me, c, s.hit, { x: p.x, r: (s.r || 110) * p.k, y: onAir ? p.hy : undefined }, { x: p.x, y: p.hy });
  },
  boom(me, s, c) {
    const p = posOf(me, { at: 'target', ...s }, c), sc = (s.scaleR ? s.scaleR[0] + Math.random() * (s.scaleR[1] - s.scaleR[0]) : s.scale || 1) * p.k;
    sheet(me.st, s.vfx, p.x, p.gy, sc, { anchor: 'pivot', flip: Math.random() < 0.5 });
    if (s.shake) me.st.shake(Math.min(10, s.shake * 0.5));
    later(me.st, 0.1, () => { crater(me.st, p.x, sc * 0.9, s.scorch || 3); dust(me.st, p.x, 8); });
    boomSnd(me, p.x);
    later(me.st, 0.12, () => strike(me, c, s.hit, { x: p.x, r: (s.r || 120) * sc }));
  },
  chain(me, s, c) { const n = s.n || 3; for (let i = 0; i < n; i++) later(me.st, i * (s.every || 0.12), () => FX.blast(me, { ...s, at: 'front', dx: (s.from || 90) + i * (s.step || 120), scale: (s.scale || 1.3) * (1 + i * 0.12), hit: i === n - 1 ? s.hit : (s.hit && { ...s.hit, kind: s.hit.mid || 'light' }) }, c)); },
  circle(me, s, c) {
    const p = posOf(me, { at: 'self', ...s }, c), r = (s.r || 260) * p.k, n = s.n || 8;
    ring(me.st, p.x, p.gy, r, 0.5, s.color || 'rgba(255,230,180,.9)', 7, 0.3);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; later(me.st, i * 0.03, () => { const x = p.x + Math.cos(a) * r * 0.8; sheet(me.st, s.vfx || 'eileen-rpg-explosion', x, p.gy - 4 + Math.sin(a) * r * 0.24, (s.scale || 1.5) * p.k, { anchor: 'pivot' }); }); }
    if (s.center !== false) later(me.st, 0.12, () => sheet(me.st, s.vfx || 'eileen-rpg-explosion', p.x, p.gy - 4, (s.scale || 1.5) * 1.6 * p.k, { anchor: 'pivot' }));
    boomSnd(me, p.x);
    later(me.st, 0.08, () => strike(me, c, s.hit, { x: p.x, r }));
  },
  pillar(me, s, c) {
    const p = posOf(me, { at: 'target', ...s }, c), sc = (s.scale || 1.5) * p.k;
    if (!s.vfx && vfxOf('fx-pillar')) sheet(me.st, 'fx-pillar', p.x, p.gy + 6 * p.k, 3 * p.k, { anchor: 'bottom', tint: colOf(me, s) });
    else for (let i = 0; i < 4; i++) later(me.st, i * 0.06, () => sheet(me.st, s.vfx || 'eileen-rpg-explosion', p.x, p.gy - 4 - i * 70 * sc, sc * (1.2 - i * 0.15), { anchor: 'pivot' }));
    if (s.scorch !== 0) crater(me.st, p.x, sc * 0.8, s.scorch || 3);
    boomSnd(me, p.x);
    strike(me, c, s.hit, { x: p.x, r: 90 * sc });
  },
  shock(me, s, c) {
    const p = posOf(me, { at: 'front', dx: 60, ...s }, c), r = (s.r || 220) * p.k;
    if (!sheet(me.st, 'fx-shockwave', p.x, p.gy + 10 * p.k, r / 70, { anchor: 'bottom', under: true, tint: colOf(me, { color: s.color || '#ffffff' }) })) ring(me.st, p.x, p.gy, r, 0.4, s.color || 'rgba(255,255,255,.85)', 6, 0.3);
    dust(me.st, p.x, 12);
    me.st.sfx({ type: 'hit', strength: 3, x: p.x });
    strike(me, c, s.hit, { x: p.x, r });
  },
  ring(me, s, c) { const p = posOf(me, { at: 'self', ...s }, c); if (s.air || !sheet(me.st, 'fx-shockwave', p.x, p.gy + 10 * p.k, (s.r || 120) * p.k / 70, { anchor: 'bottom', under: true, tint: colOf(me, s) })) ring(me.st, p.x, s.air ? p.hy : p.gy, (s.r || 120) * p.k, s.time || 0.5, s.color || me.color, s.w || 5, s.air ? 1 : 0.3); },
  slash(me, s, c) {
    const p = s.at === 'center' ? posOf(me, { ...s, at: 'screen' }, c) : posOf(me, { at: 'front', ...s }, c);
    const r = (s.size || 160) * p.k;
    if (!sheet(me.st, 'fx-slash', p.x, p.hy, r / 40, { anchor: 'center', flip: me.face < 0, tint: s.dark ? '#2a1a3a' : colOf(me, s), loopFor: 0.32 })) ring(me.st, p.x, p.hy, r, 0.3, colOf(me, s), 6);
    me.st.sfx({ type: 'whiff', strength: 2, x: p.x });
    strike(me, c, s.hit, s.at === 'center' ? { x: 0, r: 0, all: true } : { x: p.x, r });
  },
  spikes(me, s, c) {
    const p = posOf(me, { at: 'front', ...s }, c), sp = (s.spread || 70) * p.k;
    for (let i = 0; i < 3; i++) later(me.st, i * 0.05, () => sheet(me.st, 'fx-shadow', p.x + (i - 1) * 60 * p.k, p.gy + 8 * p.k, 2.2 * p.k, { anchor: 'bottom' }));
    for (let i = 0; i < (s.n || 5); i++) later(me.st, i * 0.025, () => me.st.fx.push({ k: 'spike', x: p.x + (Math.random() - 0.5) * sp * 2, y: p.gy, h: (s.len || 120) * p.k * (0.6 + Math.random() * 0.6), lean: (Math.random() - 0.5) * 0.5, c: s.color || me.color, t: s.time || 0.55, t0: s.time || 0.55 }));
    later(me.st, 0.04, () => strike(me, c, s.hit, { x: p.x, r: sp + 30 }));
  },
  grid(me, s, c) {
    const p = posOf(me, { at: 'front', ...s }, c), w = (s.w || 300) * p.k;
    for (let i = 0; i < (s.n || 16); i++) later(me.st, i * 0.02, () => me.st.fx.push({ k: 'spike', x: p.x + (Math.random() - 0.5) * w, y: p.gy, h: (s.len || 110) * p.k * (0.6 + Math.random() * 0.5), lean: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.3), c: s.color || me.color, t: s.time || 1.6, t0: s.time || 1.6 }));
    strike(me, c, s.hit || { kind: 'light' }, { x: p.x, r: w / 2 + 30 });
    if (s.bind) FX.bind(me, { time: s.bind, color: s.color }, c);
  },
  firewall(me, s, c) {
    const scr = s.at === 'screen', p = scr ? { x: screenMid(me), gy: LINE, k: REL } as Pos : posOf(me, { at: 'target', ...s }, c);
    const w = scr ? me.st.viewW : (s.w || 160) * p.k, n = Math.max(1, Math.round(w / 220));
    for (let i = 0; i < n; i++) sheet(me.st, 'fx-fire', p.x + (i - (n - 1) / 2) * w / n, p.gy + 6, 1.8 * p.k, { anchor: 'bottom', loopFor: s.time || 3, loop: true });
    strike(me, c, s.hit, scr ? { x: 0, r: 0, all: true } : { x: p.x, r: w / 2 + 20 });
  },
  puddle(me, s, c) { const p = posOf(me, { at: 'self', ...s }, c); sheet(me.st, 'fx-shadow', p.x, p.gy + 8 * p.k, (s.r || 70) * p.k / 40, { anchor: 'bottom', under: true }); },
  flame(me, s, c) {
    const T = s.time || 1.2, len = (s.len || 300) * K;
    for (let i = 0; i * 0.03 < T; i++) later(me.st, i * 0.03, () => { if (me.state !== 'atk') return; const m = me.muzzle(); me.st.fx.push({ k: 'fire', x: m.x + me.face * 10, y: m.y, vx: me.face * (500 + Math.random() * 400), vy: (Math.random() - 0.5) * 140, r: 5 + Math.random() * 6, t: 0.25 + Math.random() * 0.25, t0: 0.5 }); });
    for (let i = 0; i < 3; i++) later(me.st, i * 0.08, () => { const m = me.muzzle(); sheet(me.st, 'fx-fire', m.x + me.face * (len * (i + 1) / 4), m.y, (0.6 + i * 0.2) * K, { anchor: 'center', flip: me.face < 0 }); });
    if (s.hit) { const n = s.hit.n || 6; for (let i = 0; i < n; i++) later(me.st, 0.1 + i * T / n, () => { const m = me.muzzle(); strike(me, c, { ...s.hit, n: 1, kind: i === n - 1 ? s.hit.kind || 'heavy' : 'light' }, { x: m.x + me.face * len / 2, r: len / 2 + 30, front: true }); }); }
  },
  lob(me, s, c) {
    const n = s.n || 1;
    for (let i = 0; i < n; i++) {
      const m = me.muzzle(), dist = (s.dist || 300) * K, tx = m.x + me.face * dist + (i - (n - 1) / 2) * (s.spread || 50), T = s.time || 0.7;
      me.st.fx.push({ k: 'lob', x0: m.x, y0: m.y, x1: tx, y1: LINE, t: T, t0: T, icon: s.icon || 'grenade', c: me.color });
      later(me.st, T + (s.fuse || 0), () => runFx(me, (s.end || [{ t: 'blast', at: 'target', scale: 1.1, hit: s.hit }]).map((e: Json) => ({ ...e, at: e.at || 'target' })), { ...c, pt: { x: tx, z: 0, onT: false } }));
    }
  },
  toss(me, s, c) {
    const f = me.face, [dx0, h0] = s.from || [60, 200];
    for (const e of me.st.fx) if (e.k === 'carry' && e.owner === me) e.t = 0;
    const x0 = me.x + f * dx0 * K, x1 = me.x + f * (s.dx || 220) * K, T = s.time || 0.32;
    me.st.fx.push({ k: 'toss', vfx: s.vfx, x0, x1, y0: LINE - h0 * K, y1: LINE - (s.land || 50) * K, arc: (s.arc || 90) * K, sc: (s.scale || 1) * K, flip: f < 0, t: T, t0: T, rot: (s.spin || 0) * f });
    if (s.then) later(me.st, T, () => runFx(me, s.then, { ...c, pt: { x: x1, z: 0, onT: false } }));
  },
  carry(me, s) { me.st.fx.push({ k: 'carry', owner: me, vfx: s.vfx, pts: s.pts, clip: me.anim, sc: s.scale || 1, t: 9, t0: 9 }); },
  coinDrop(me, s, c) { const p = posOf(me, { at: 'target', ...s }, c); me.st.fx.push({ k: 'coin', x: p.x, y: p.hy, vx: -me.face * 90, vy: -320, t: 1.6, t0: 1.6 }); },
  waves(me, s, c) {
    for (let i = 0; i < (s.n || 3); i++) later(me.st, i * 0.09, () => { const m = me.muzzle(); if (!sheet(me.st, 'fx-shockwave', m.x + me.face * (40 + i * 40), m.y + 20, 1.2 + i * 0.5, { anchor: 'center', tint: colOf(me, s) })) ring(me.st, m.x + me.face * 20, m.y, (s.r || 70) * (1 + i * 0.4), 0.35, s.color || '#ffcf9a', 4); });
    if (s.hit) FX.melee(me, { range: s.range || 260, hit: s.hit }, c);
  },
  // 큰 괴이 그림자가 화면을 휩쓸며 n번 (고그니쟈)
  sweep(me, s, c) {
    const st = me.st, dir = me.face, T = s.time || 2;
    st.fx.push({ k: 'sweep', x0: dir > 0 ? st.viewX0 - 260 : st.viewX0 + st.viewW + 260, x1: dir > 0 ? st.viewX0 + st.viewW + 260 : st.viewX0 - 260, y: LINE - 60, dir, c: s.color || '#140c18', t: T, t0: T });
    if (s.hit) { const n = s.hit.n || 5; for (let i = 0; i < n; i++) later(st, T * (0.3 + 0.4 * i / n), () => strike(me, c, { ...s.hit, n: 1, kind: i === n - 1 ? s.hit.kind || 'launch' : 'heavy' }, { x: 0, r: 0, all: true })); }
  },
  rain(me, s) { const st = me.st; for (let i = 0; i < Math.min(40, s.n || 40); i++) later(st, Math.random() * (s.time || 1.2), () => st.fx.push({ k: 'drop', x: st.viewX0 + Math.random() * st.viewW, y: LINE - 700, vy: 300 + Math.random() * 300, vx: (Math.random() - 0.5) * 80, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, g: LINE - Math.random() * 20, c: s.color || '#f2efe6', t: 3, t0: 3 })); },
  // 에일린 제압사격 한 발: 총구에서 앞 땅으로
  suppress(me, s, c) {
    const p = c.o || me.muzzle(), dir = me.face, drop = Math.max(40, LINE - p.y), dist = drop * (1.25 + Math.random() * 1.4);
    const gx = p.x + dir * dist, gy = LINE + (Math.random() - 0.5) * 10;
    me.st.sfx({ type: 'shot', x: p.x });
    me.st.fx.push({ k: 'tracer', owner: me, x: p.x + dir * MZ_GAP * K, y: p.y, x2: gx, y2: gy, t: 0.06, t0: 0.06 });
    later(me.st, 0.06, () => spark(me.st, gx, gy - 3, 4, '#ffe9a0'));
    const o = me.foe();
    if (o && (o.x - p.x) * dir > 30 && Math.abs(o.x - p.x) < dist + 60) strike(me, c, { kind: 'light' }, { x: o.x, r: 10 });
  },
  // 판독 표적 → 포격 (에일린)
  artillery(me, s, c) {
    const st = me.st, o = me.foe(), spots: { x: number; onT: boolean }[] = [];
    for (let k = 0; k < Math.min(10, s.n || 12); k++) spots.push({ x: st.viewX0 + 60 + Math.random() * (st.viewW - 120), onT: false });
    if (o) spots.splice(Math.floor(Math.random() * spots.length), 0, { x: o.x, onT: true });
    spots.forEach((m) => st.fx.push({ k: 'target', x: m.x, y: LINE, t: 1.3 + spots.length * 0.13, t0: 2 }));
    spots.forEach((m, i) => later(st, 1.2 + i * 0.13, () => { st.fx.push({ k: 'mortar', x: m.x, y: LINE, t: 0.32, t0: 0.32 }); later(st, 0.32, () => FX.blast(me, { at: 'target', air: false, scale: 1.4, scorch: 2.5, hit: m.onT ? { kind: 'launch' } : null }, { ...c, pt: { x: m.onT && o ? o.x : m.x, z: 0, onT: m.onT } })); }));
  },
  summon(me, s, c) {
    const p = posOf(me, { at: 'front', ...s }, c);
    const T = Math.min(5, s.time || 4);
    // 분신(decoy): 내 그림을 반투명하게 그 자리에 (11-08: 네모로 나오던 것)
    const decoy = s.icon === 'decoy';
    const did = decoy ? (s.anim && me.art.A[s.anim] ? s.anim : me.idleId()) : undefined;
    const o = { k: 'obj', anim: s.anim, did, by: decoy ? me : undefined, over: s.over ?? 0.55, vfx: s.vfx, alpha: s.alpha, icon: s.icon || 'box', x: p.x, y: s.at === 'hand' ? p.hy : p.gy, ground: s.at !== 'hand', c: s.color || me.color, t: T, t0: T, s: p.k, face: me.face };
    me.st.fx.push(o);
    if (o.ground) sheet(me.st, 'fx-summon', o.x, o.y + 8 * o.s, 1.6 * o.s, { anchor: 'bottom', tint: colOf(me, s) });
    // 분신이 쏘는 것은 분신 그림의 총구에서
    const hand = () => {
      if (!did) return { x: o.x, y: o.y - 40 * o.s };
      const m = me.art.A[did], f = Math.floor(me.st.t * 6) % m.n, [px, py] = muzzleOf(me.art, did, f);
      return framePt(o.x, 0, o.face, did, m, f, false, px, py);
    };
    if (s.tick) { const n = Math.floor(T / (s.tick.every || 1)); for (let i = 1; i <= n; i++) later(me.st, i * s.tick.every, () => runFx(me, s.tick.fx, { ...c, o: hand(), pt: { x: o.x, z: 0, onT: false } })); }
  },
  self(me, s, c) {
    const k = K * (s.scale || 1), x0 = me.x, f = me.face;
    sheet(me.st, s.vfx, x0, LINE - me.z, k, { anchor: 'pivot', flip: f < 0, under: s.under !== false });
    boomSnd(me, me.x);
    for (const g of s.craters || []) later(me.st, g.at || 0, () => crater(me.st, x0 + f * g.dx * k, k * (g.k || 0.6), g.hold || 3));
    for (const h of s.hits || [{}]) later(me.st, h.at || 0, () => {
      const x = x0 + f * (h.dx ?? 150) * k;
      if (h.crater) crater(me.st, x, k * h.crater, h.hold || 3);
      if (h.dust) dust(me.st, x, 6);
      strike(me, c, h.hit || s.hit, { x, r: (h.r || 110) * k }, { x, y: LINE - (h.h ?? 110) * k });
    });
  },
  big(me, s, c) {
    const v = vfxOf(s.vfx);
    if (!v) return;
    const fh = v.frames[0][3], fw = v.frames[0][2], o = me.foe();
    const gx = o ? o.x : me.x + me.face * 380 * REL, sc = ((s.h || 460) / fh) * REL;
    const w = me.st.viewW;
    if (fw * sc > w * 1.1) sheet(me.st, s.vfx, screenMid(me), LINE - 20, (w * 1.05) / fw, { anchor: 'bottom', flip: me.face < 0 });
    else sheet(me.st, s.vfx, gx, LINE + 10, sc, { anchor: 'bottom', flip: me.face < 0 });
    me.st.shake(8);
    boomSnd(me, gx);
    void c;
  },
};

/** 손에 든 물건 자리 (그리기용) */
export function carryPt(me: Fighter, e: Json): { x: number; y: number } | null {
  if (me.anim !== e.clip) return null;
  const p = e.pts?.[String(me.anim?.f != null ? me.anim.f + 1 : 1)];
  if (!p) return null;
  return { x: me.x + me.face * p[0] * K, y: LINE - me.z - p[1] * K };
}

export { muzzleOf };
