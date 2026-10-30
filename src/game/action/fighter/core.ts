// 인물 전투·생활 엔진 (게임 원본). 처음엔 통합 테스트룸(room.html)에서 떼어 왔지만 2026-10-29부터 이 파일이 원본이다: 여기서 고친다.
// 테스트룸은 이 엔진을 불러다 쓰는 시험장(src/game/action/fighter/testroom.ts).
// 게임과 맞닿는 곳: 표적 = env.targets()의 실제 적(T = 지금 가장 가까운 앞 상대 + 범위 검사에 든 상대 전부), 화면 = 보이는 화면(VX0~W)·게임 바닥, 키 = env.held, 소리 = env.sfx, 체력 = 게임.
// env: { A, IMG, CH, VFX, CHAIR, held:Set, K(y), sfx(type, extra), font(n), targets():[{body,x,y,z}], hurt(T, dmg, kind, face, hitstop, o), clamp(P), ground(x,y), mod?:{speed(),sp()}, heal?(v) }
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SEATS as SEAT_TABLE, SEAT_LOOP as SEAT_LOOP_IDS, SEAT_IDS as SEAT_ID_SET, seatFit } from './seats';
/** 인물 설정(char.json cfg)·줄 측정값(A)·이펙트 정의·기술 부품은 JSON 자료라 모양이 인물·기술마다 다르다 → 자료 쪽은 느슨한 형(Json)으로 둔다 */
type Json = any;
/** 부품 실행 맥락 ({ o, pt, basic, … }) */
type Ctx = Json;
/** 동작 재생 한 칸 */
export type SeqEv = Json;
export interface Clip { id: string; seq: SeqEv[]; i: number; t: number; loopFrom: number; onEnd: (() => void) | null; done: boolean; paused: boolean; [k: string]: Json }
/** 화면 이펙트 하나 (k = 종류, t = 남은 시간) */
type Fx = Json;
/** 맞을 상대 하나 (게임 몸 + 엔진이 붙여 두는 반응 상태) */
export interface Target { body: Json; x: number; y: number; z: number; vx: number; vz: number; hp: number; mark: number; bindT: number; stunT: number; liftT: number; stag: number; hitT: number; hits: number; juggle: number; bounced: boolean; flash: number; [k: string]: Json }
/** 인물 상태 (P) */
export interface PState { x: number; y: number; z: number; vz: number; face: number; mode: string; combat: boolean; armed: boolean; clip: Clip | null; t: number; hp: number; sp: number; heat: number; cd: Record<string, number>; seat: Json; [k: string]: Json }
export interface FighterEnv {
  A: Record<string, Json>; IMG: Record<string, HTMLImageElement>; CH: Json; VFX?: Record<string, Json>; CHAIR?: Record<string, HTMLImageElement>;
  held: Set<string>; K(y: number): number; sfx(type: string, extra?: Json): void; font?(n: number): string;
  targets(): { body: Json; x: number; y: number; z: number }[];
  hurt(t: Target, dmg: number, kind: string, face: number, hitstop: number, o: { src?: string | null }): void;
  clamp(P: PState): void; ground(x: number, y: number): number; mod?: { speed(): number; sp(): number }; heal?(v: number): void;
}
export function createFighterCore(env: FighterEnv) {
  const VFX = env.VFX || {}, CHAIR = env.CHAIR || {};
  let VX0 = 0, W = 1280, H = 720, FLOOR0 = 440, FLOOR1 = 669;
  const down = (n?: Json) => env.held.has(n);
  let ctx: CanvasRenderingContext2D = null as unknown as CanvasRenderingContext2D;
  const K = (y?: Json) => env.K(y);
  const sfx = (type?: Json, extra = {}) => env.sfx(type, { x: P.x, ...extra });
  const boomSnd = (strength = 2, x = 0) => env.sfx('boom', { strength, x });
  let runT = 0, curSrc: string | null = null;
  /** 표적 대리: 게임 적 몸 하나마다 반응 상태(mark·bindT·liftT·stunT…)를 붙여 둔다. T = 지금 가장 가까운 앞 상대 */
  const proxyMap = new Map<Json, Target>();
  const proxyOf = (t?: Json) => { let p = proxyMap.get(t.body); if (!p) { p = ({ body: t.body, juggle: 0, bounced: false, stunT: 0, vx: 0, z: 0, vz: 0, ang: 0, va: 0, hits: 0, hitT: 0, flash: 0, stag: 0, hp: 400, mark: 0, atkT: 2.2, wind: 0, bindT: 0, bindC: '#7A3FB0', liftT: 0 } as unknown as Target); proxyMap.set(t.body, p); } p.x = t.x; p.y = t.y; p.z = t.z + (p.liftT > 0 ? p.z : 0); return p; };
  let proxiesNow: Target[] = [], hitList: Target[] = [];
  const proxies = () => proxiesNow;
  /** 상대 전부를 맞을 목록에(화면 전체 기술) */
  const allT = () => { hitList = [...proxiesNow]; return hitList.length > 0; };
  /** 지금 가장 가까운 앞 상대. 없으면 null 이지만 읽는 곳은 near·inReach·strike 가 채운 뒤라 Target 으로 둔다(테스트룸 때부터의 약속) */
  let T: Target = null as unknown as Target;
  function updateProxies(dt?: Json) {
    const seen = new Set();
    proxiesNow = env.targets().map(t => { const p = proxyOf(t); seen.add(t.body); p.mark = Math.max(0, p.mark - dt); p.bindT = Math.max(0, p.bindT - dt); p.stunT = Math.max(0, p.stunT - dt); p.liftT = Math.max(0, (p.liftT || 0) - dt); p.stag = Math.max(0, p.stag - dt); p.hitT = Math.max(0, p.hitT - dt); if (p.hitT === 0) p.hits = 0; return p; });
    for (const b of [...proxyMap.keys()]) if (!seen.has(b)) proxyMap.delete(b);
    const front = proxiesNow.filter(p => Math.abs(p.y - P.y) < 120 && (p.x - P.x) * P.face > -40).sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x));
    T = front[0] || proxiesNow.sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0] || null;
  }
const A = env.A, IMG = env.IMG, CH = Object.assign({ picks: {}, loops: {}, hit: {}, skills: {}, gun: [], kick: [], ranged: {} }, env.CH), CK = CH.key;
const vfxDur = (name?: Json) => VFX[name].frames.reduce((a?: Json, f?: Json) => a + f[4], 0) / 1000;
// PixelLab 이펙트 그림: o.flip(좌우), o.rot(회전), o.anchor('right'), o.center(가운데 기준), o.loop, o.under(바닥 층)
const vfx = (name?: Json, x?: Json, y?: Json, scale = 2, o: Json = {}) => { if (!VFX[name]) return false; const d = vfxDur(name); const T = (o.t || d) + (o.hold || 0); const e = { k: 'sheet', name, x, y, s: scale, dur: d, ...o, t0: T, t: T }; o.back ? fx.unshift(e) : fx.push(e); return true; };   // back: 같은 층 맨 아래(다른 이펙트 밑)
const has = (id?: Json) => !!A[id];
const nOf = (id?: Json) => A[id] ? A[id].n : 0;
const cf = (id?: Json, f?: Json) => Math.max(0, Math.min(nOf(id) - 1, f));
// 설정의 장 번호는 1부터(동작표와 같게) → 코드는 0부터
const LP = (id?: Json) => { const l = CH.loops && CH.loops[id]; return l && l.length ? l.map((f?: Json) => cf(id, f - 1)) : null; };
const PK = (name?: Json, id?: Json) => cf(id, ((CH.picks || {})[name] || nOf(id)) - 1);
const idleId = () => has('3') ? '3' : '1';
const BASE = (a?: Json) => Math.min(a.h - 4, a.floor);   // 땅 동작 기준선: 캔버스 아래 4px. 그 줄의 가장 낮은 점이 그보다 위면(PixelLab이 몸을 위쪽에 그림) 그 점을 땅으로(10-29 사용자: 서 있을 때 발보다 높이 쓰러지고 그림자와 벌어짐)
const arcOf = (id?: Json) => CH.arc && CH.arc[id];
const ROOT = new Set(['38_1', '40', '37_1', '42_1']);   // 기는 동작: 몸을 제자리에 두고 이동은 코드로
// 누운·앉은 동작은 PixelLab이 몸을 캔버스 위쪽에 그려서 떠 보임 → 그 장의 맨 아래 픽셀을 바닥에 맞춤(사용자 2026-10-25)
const FLAT = new Set(['19', '20', '38', '38_1', '43', '45']);   // 바닥에 몸을 눕히는 줄: 몸통 아래 선으로 맞춤
const LIE = new Set(['20', '38', '38_1', '39', '40', '41', '42', '42_1', '43', '45']);
const lieFrom = (a?: Json) => a.bot.indexOf(Math.min(...a.bot)) + 1;   // 날아가 쓰러지기: 가장 높이 뜬 장 다음부터 땅
const FALLS = new Set(['18_3', '44', '75', '76', '77']);   // 서서 시작해 눕는 줄: 누운 장만 몸통 아랫선으로(눕기 75~77도 10-28: 허공에 눕는 인물 → 바닥. 침대 높이는 나중에 물건에 맞춤)
// 누운 장 판정(10-28 고침): 바닥에서 떠 있게 그린 그림도 누운 것으로 봄(몸 높이만 봄). 누운 장들은 같은 바닥선(몸통 아랫선의 가운데 값)을 써서 반복 때 들썩이지 않게
const lowF = (a?: Json, f?: Json) => (a.bot[f] - a.top[f]) < 0.55 * (a.bot[0] - a.top[0]);
// 누운 장은 장마다 자기 몸통 아랫선을 바닥에(그림마다 높이가 달라 한 줄로 맞추면 위아래로 튐 — 10-28 데드폴)
// 앉기·앉은 줄: 장마다 그 장의 가장 낮은 점(발)을 땅에(10-29 밤 사용자: PixelLab이 앉은 장을 캔버스 위쪽에 그린 줄은 서 있던 바닥 기준이라 사람·의자가 통째로 떠 보임 — 데쥬레 후면 41px, 이연화 후면 등)
const SEAT_IDS = SEAT_ID_SET;
const groundBase = (id?: Json, a?: Json, f?: Json) => arcOf(id) ? a.bot[f] : SEAT_IDS.has(id) ? Math.min(BASE(a), a.bot[f]) : FALLS.has(id) ? (lowF(a, f) && a.mbot ? a.mbot[f] + 3 : Math.min(BASE(a), a.bot[f] + 2)) : (LIE.has(id) || (id === '19' && f >= lieFrom(a))) ? (FLAT.has(id) && a.mbot ? a.mbot[f] + 3 : a.bot[f] + 2) : BASE(a);   // 누운 장: 몸통 아래 선을 바닥에(늘어진 손발은 바닥 앞쪽으로 내려감)
const FXS = 3, mkLayer = () => { const c = document.createElement('canvas'); c.width = 1280 / FXS; c.height = 720 / FXS; const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; return [c, g] as [HTMLCanvasElement, CanvasRenderingContext2D]; };
const [fxNc, fxN] = mkLayer(), [fxLc, fxL] = mkLayer();
const GLOW = new Set(['spark', 'ring', 'flash', 'impact', 'beam', 'mote', 'burst', 'fire', 'tracer', 'speed', 'scan', 'orb', 'slash', 'grid']);

// ── 키 ──

// ── 장 목록 도우미 ──
const R = (a?: Json, b?: Json) => { const r = []; if (a <= b) for (let i = a; i <= b; i++) r.push(i); else for (let i = a; i >= b; i--) r.push(i); return r; };
const S = (fr?: Json, d?: Json) => fr.map((f?: Json) => ({ f, d }));
function impactOf(id?: Json) { const a = A[id]; if (CH.hit && CH.hit[id]) return cf(id, CH.hit[id] - 1); let imp = 1; for (let f = 1; f < a.n; f++) if (a.reach[f] > a.reach[imp]) imp = f; return Math.min(imp, a.n - 1); }
// 준비 짧게 → 때리는 장 보여 줌 → 마무리 빠르게(캔슬 가능). 멈춤(히트스톱)은 맞았을 때만.
const SPD = () => ({ slow: 1.25, fast: 0.85 } as Record<string, number>)[(CH.bal || {}).speed] || 1;   // 손 빠르기(밸런스 표): 느린 인물은 평타 동작이 길고 한 대가 아픔(10-28)
function atkSeq(id?: Json, heavy?: Json) {
  const a = A[id], imp = impactOf(id), s = [], k = SPD();
  for (let f = 0; f < a.n; f++) {
    if (f < imp) s.push({ f, d: (f === 0 ? 0.04 : (heavy ? 0.06 : 0.045)) * k });
    else if (f === imp) s.push({ f, d: (heavy ? 0.13 : 0.08) * k, ev: heavy ? 'hitH' : 'hit' });
    else s.push({ f, d: (heavy ? 0.06 : 0.05) * k, cancel: true });
  }
  return s;
}

// ── 상태 ──
const P0 = () => ({ x: 420, y: 580, z: 0, vz: 0, face: 1, mode: 'ground', combat: false, armed: false, clip: null, pvx: 0, pvy: 0, pdec: 0,
            jumps: 0, airAtk: false, airVX: 230, takeoff: 0, spin: 0, buf: null, chainT: 0, combo: 0, stunT: 0, idleT: 0, lastTap: {}, runLatch: false,
            hp: 100, sp: 0, heat: 0, overT: 0, lastShot: 0, chargeShown: 0, armorT: 0, inv: 0, charge: 0,
            dodgeN: 2, dodgeMax: 2, dodgeCd: 0.8, dodgeT: 0, wakeDelay: 0.6, downAt: -9, wakeBuf: null, ghostT: 0, dying: false, t: 0, buffT: 0, vanish: null, cd: {}, seat: null });
let P: PState = P0() as PState;
let zoom = 0;
let paused = false, hitstop = 0, shake = 0, flash = 0, dark = 0, cut = 0;
let freeSuper = false, showArmor = true, grayT = 0;
// ── 밸런스(사용자 2026-10-25): 인물 설정 bal = { atk: {줄: 피해}, cd: {skill, skill2, charge, shot}, gun: single|rapid|heavy|thrown|none, shotDmg, heatPer }
// 계산 근거·표: docs/밸런스_설계.md, 값은 game-src/action/testroom3/balance.py 가 넣음
const BAL = () => CH.bal || {};
const isHot = () => !!(CH.ranged && CH.ranged.heat) || BAL().gun === 'rapid';
function cdReady(k?: Json) { const t = (P.cd[k] || 0) - P.t; if (t <= 0) return true; sfx('empty'); fx.push({ k: 'num', x: P.x - 40, y: P.y - 250 * K(P.y), v: `쿨타임 ${t.toFixed(1)}초`, t: 0.6 }); return false; }
function setCd(k?: Json) { const v = (BAL().cd || {})[k]; if (v) P.cd[k] = P.t + v; }
const atkDmg = (id?: Json, big?: Json) => { const a = BAL().atk || {}; const v = a[id] ?? (big ? 34 : 12); return id === '14' && big ? Math.round(v * 1.8) : v; };   // 점프 강공격(내려찍기)은 약의 1.8배(10-28 「점프 강·약 피해 같음」)
function gainSp(v?: Json) { if (P.noGain > P.t) return; v *= env.mod ? env.mod.sp() : 1; const was = P.sp; P.sp = Math.min(100, P.sp + v); if (was < 100 && P.sp >= 100) { sfx('ability'); flash = 0.06; fx.push({ k: 'num', x: P.x - 50, y: P.y - 260 * K(P.y), v: '필살기 준비', t: 1.0 }); } }
function spReady() { if (freeSuper || P.sp >= 100) { if (!freeSuper) P.sp = 0; return true; } sfx('empty'); fx.push({ k: 'num', x: P.x - 50, y: P.y - 250 * K(P.y), v: '게이지 부족', t: 0.7 }); return false; }
let fx: Fx[] = [];
const items: Fx[] = [];
// 폭발 소리(기술·충전·필살기): 공용 소리 대신 직접 합성 — 터지는 순간의 굉음(잡음+찌그러짐) + 낮게 꺼지는 울림 + 흩어지는 파편 소리

function play(id?: Json, o: Json = {}) {
  if (!A[id]) id = idleId();
  const a = A[id];
  let seq = (o.seq || S(R(0, a.n - 1), 1 / (o.fps || 10))).map((e?: Json) => ({ ...e, f: cf(id, e.f) }));
  // 설정 skip(그 장 빼기) · start(앞 동작 끝 장과 어긋난 첫 장을 건너뜀, 앞으로 틀 때만)
  const sk = CH.skip && CH.skip[id], st = CH.start && CH.start[id];
  if (sk) { const t = seq.filter((e?: Json) => !sk.includes(e.f + 1) || e.ev || e.fn); if (t.length) seq = t; }
  if (st && seq.length > 1 && seq[0].f === 0 && seq[1].f >= seq[0].f) { const k = seq.findIndex((e?: Json) => e.f >= st - 1); if (k > 0) { const lost = seq.slice(0, k).filter((e?: Json) => e.ev || e.fn); seq = seq.slice(k); if (lost.length) seq[0] = { ...seq[0], ev: seq[0].ev || lost[0].ev, list: seq[0].list || lost[0].list, fn: seq[0].fn || lost[0].fn }; if (o.loopFrom > 0) o = { ...o, loopFrom: Math.max(0, o.loopFrom - k) }; } }
  P.clip = { id, seq, i: 0, t: 0, loopFrom: o.loopFrom ?? -1, onEnd: o.onEnd || null, done: false, paused: false };
  fireEv(P.clip.seq[0]);
}
const curF = () => P.clip ? P.clip.seq[Math.min(P.clip.i, P.clip.seq.length - 1)].f : 0;
const canCancel = () => { const c = P.clip; if (!c || c.done) return true; return !!c.seq[c.i].cancel; };
function tickClip(dt?: Json) {
  const c = P.clip; if (!c || c.done || c.paused) return;
  c.t += dt;
  while (c.t >= c.seq[c.i].d) {
    c.t -= c.seq[c.i].d;
    const cur = c.seq[c.i];
    if (cur.rep && down(cur.rep.key) && !(cur.rep.key === 'shoot' && P.overT > 0)) { c.i = cur.rep.to; fireEv(c.seq[c.i]); continue; }
    if (c.i + 1 < c.seq.length) { c.i++; fireEv(c.seq[c.i]); }
    else if (c.loopFrom >= 0) { c.i = c.loopFrom; fireEv(c.seq[c.i]); }
    else { c.done = true; c.t = 0; const f = c.onEnd; c.onEnd = null; if (f) f(); break; }
    if (P.clip !== c) break;
  }
}
const pushP = (vx?: Json, dec?: Json, vy = 0) => { P.pvx = vx; P.pvy = vy; P.pdec = dec; };

// 그림 속 위치 → 화면 위치. 빌드가 모든 그림을 오른쪽(동·남동)을 보게 맞춰 두었으니 왼쪽을 볼 때만 뒤집음
function framePt(id?: Json, f?: Json, px?: Json, py?: Json) {
  const a = A[id], flip = P.face < 0;
  const base = isAir(id) ? a.bot[f] : groundBase(id, a, f);
  const k = K(P.y);
  return { x: P.x + (flip ? -px : px) * k, y: P.y - P.z - (base - py) * k };
}
const isAir = (id?: Json) => P.mode === 'air' && (id === '7' || id === '14');
const restId = () => P.armed ? (has('W_1') ? 'W_1' : has('W') ? 'W' : idleId()) : idleId();
// 손끝(총 없는 줄): 가장 앞으로 뻗은 손발 자리. 충전 모으기(23) 이펙트용(10-28 진나솔: 무릎에 생김)
function handPt() { const id = P.clip && A[P.clip.id] ? P.clip.id : restId(), f = P.clip ? curF() : 0, a = A[id], ry = CH.reachY && CH.reachY[id] && CH.reachY[id][f]; if (!a || ry == null || (CH.gun || []).includes(id)) return muzzle(); return framePt(id, f, a.reach[f] - 6, ry); }
function muzzle() { const id = P.clip && A[P.clip.id] ? P.clip.id : restId(), f = P.clip ? curF() : 0, a = A[id]; if (!a) return { x: P.x + P.face * 40, y: P.y - 150 }; const m = (a.mz && a.mz[f]) || [a.reach[f], a.h * 0.45]; return framePt(id, f, m[0] + 1, m[1]); }
const mzAng = () => { const id = P.clip ? P.clip.id : restId(), a = A[id]; return (a && a.ang && a.ang[curF()]) || 0; };
const MZ_GAP = 30;
const later = (t?: Json, fn?: Json) => fx.push({ k: 'timer', t, fn });

// ── 효과 도우미 ──
// 기술 투사체 꼬리·빛무리(10-29)
function projTrail(e?: Json) {
  if (!e.fancy || !e.trail || e.trail.length < 2) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < e.trail.length; i++) { const [tx, ty] = e.trail[i], a = (i + 1) / e.trail.length; ctx.globalAlpha = 0.35 * a; ctx.fillStyle = e.c; ctx.beginPath(); ctx.arc(tx, ty, 16 * e.size * a, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 0.25; const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 34 * e.size); g.addColorStop(0, '#fff'); g.addColorStop(0.4, e.c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, 34 * e.size, 0, 6.283); ctx.fill();
  ctx.restore();
}
function sparks(x?: Json, y?: Json, n?: Json, big?: Json, col?: Json) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (big ? 520 : 280) * (0.35 + Math.random());
    fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, t: 0.16 + Math.random() * 0.18, c: col || (Math.random() < 0.5 ? '#fff' : '#ffd866'), s: big ? 5 : 3 }); }
}
const steam = (x?: Json, y?: Json, s = 1) => VFX.steam_wisp ? vfx('steam_wisp', x, y, 1.6) : fx.push({ k: 'steam', x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 16, vy: -40 - Math.random() * 30, r: 1.6 * s, t: 0.6, t0: 0.6 });
const ring = (x?: Json, y?: Json, r?: Json, t?: Json, c?: Json, w = 4, sy = 1) => fx.push({ k: 'ring', x, y, r0: r * 0.2, r, t, t0: t, c, w, sy });
const num = (x?: Json, y?: Json, v?: Json, big?: Json) => fx.push({ k: 'num', x, y, v, t: 0.7, big });
const dust = (x?: Json, y?: Json, n?: Json, s = 1) => { for (let i = 0; i < n; i++) fx.push({ k: 'dust', x: x + (Math.random() - 0.5) * 30 * s, y, vx: (Math.random() - 0.5) * 160 * s, vy: -Math.random() * 60, r: 6 + Math.random() * 8 * s, t: 0.45, t0: 0.45 }); };
// 총 쏠 때 불꽃은 그림에 그려진 것만 씀 — 코드는 탄피만
function muzzleFlash(p?: Json, big?: Json) { if (!(CH.gun || []).length) return; for (let i = 0; i < (big ? 3 : 1); i++) fx.push({ k: 'shell', x: p.x - P.face * 30, y: p.y, vx: -P.face * (80 + Math.random() * 80), vy: -220 - Math.random() * 120, g: P.y, t: 1.2 }); }

function inReach(hx?: Json, pad = 60, hh = 100, wide = false) { pad *= K(P.y); const l = proxies().filter(q => { const dk = K(q.y), hOk = wide ? P.z < q.z + 215 * dk && hh > q.z - 120 * dk : hh > q.z - 110 * dk && hh < q.z + 240 * dk; return Math.abs(q.y - P.y) < (wide ? 100 : 80) && (q.x - P.x) * P.face > (wide ? -60 : -20) && Math.abs(q.x - hx) < pad && hOk; }); if (l.length) { hitList = l; T = l[0]; } return l.length > 0; }
// 고유기·충전·필살 동작 줄(피해 출처 「기술」 판정용: NPC 기술 배율)
let skillClipSet: Set<string> | null = null;
const skillClips = () => skillClipSet ??= new Set([CH.skills?.skill?.anim, CH.skills?.skill2?.anim, CH.skills?.charge?.hold, CH.skills?.charge?.release, CH.skills?.super?.anim, ...((CH.skills?.super?.steps || []) as Json[]).map((s: Json) => s.anim)].filter(Boolean).map(String));
function damageTarget(dmg?: Json, kind?: Json) {
  if (T.mark > 0) dmg = Math.round(dmg * 1.5);
  T.hp = Math.max(0, T.hp - dmg); T.hits++; if (!P.inSuper) gainSp(dmg * 0.45); T.hitT = 1.0; T.flash = 0.09;
  const big = kind !== 'light', air = T.z > 0 || T.vz > 0, dir = Math.sign(T.x - P.x) || P.face;
  T.stag = kind === 'launch' ? 0.9 : big ? 0.5 : 0.34;
  T.va += dir * (kind === 'launch' ? 7 : big ? 4.5 : 2);
  if (['down', 'spike', 'blow', 'launch'].includes(kind)) T.liftT = 0;
  if (T.bindT > 0) { T.vx = 0; }
  else if (kind === 'spike' && air) { T.vz = -1100; T.vx = dir * 120; T.juggle++; }
  else if (kind === 'launch') { T.vz = air ? Math.max(T.vz, 720) : 980; T.vx = dir * 90; T.juggle = air ? T.juggle + 1 : 0; T.bounced = false; }
  else if (kind === 'blow') { T.vz = 420; T.vx = dir * 980; T.juggle++; T.bounced = true; }
  else if (kind === 'down') { T.vz = 260; T.vx = dir * 420; T.juggle++; T.bounced = true; }
  else if (kind === 'stun') { T.stunT = 1.4; T.vx = dir * 200; }
  else if (kind === 'pull') { T.vx = -dir * 520; }
  else if (kind === 'turn') { T.turnT = 0.6; T.turnDir = dir; T.vx = 0; T.stag = 0.15; }   // 홱 뒤돌아 등을 보인 채 2m 밀려 걸어감(로제몬 D)
  else if (air) { T.juggle++; T.vz = Math.max(T.vz, (big ? 560 : 420) * Math.max(0.3, 1 - T.juggle * 0.12)); T.vx = dir * (big ? 160 : 70); }
  else T.vx = dir * (big ? 460 : 55);
  num(T.x + (Math.random() - 0.5) * 30, T.y - 200 - T.z, dmg, big);
  if (T.body) env.hurt(T, dmg, kind, P.face, hitstop, { src: curSrc ?? (P.inSuper || (P.clip && skillClips().has(P.clip.id)) || P.mode === 'charge' ? 'skill' : null) });
}
function fireEv(e?: Json) {
  if (e && e.fn) e.fn();
  if (!e || !e.ev) return;
  const id = P.clip!.id, a = A[id], f = e.f;
  if (e.ev === 'hit' || e.ev === 'hitH') {
    const big = e.ev !== 'hit';
    const ry = id === '14' && CH.reachY && CH.reachY['14'] && CH.reachY['14'][f], p = framePt(id, f, a.reach[f], ry != null && ry !== false ? ry : a.h * (e.hy || 0.42));   // 점프 공격은 앞으로 뻗은 손발 높이에서
    const wide = id === '14';   // 공중공격은 판정을 넓게(사용자 2026-10-25): 앞뒤 160·위아래·깊이 넓게
    if (inReach(p.x, wide ? 160 : big ? 115 : 90, P.y - p.y, wide)) {   // 10-29 밤 사용자: 판정이 엄격 → 앞 여유 70/100 → 90/115, 줄 차이 64 → 80
      hitstop = big ? 0.16 : 0.085; shake = big ? 16 : 8; P.connected = true;
      { const list = [...hitList]; hitList = []; for (const t of list) { T = t; damageTarget(atkDmg(id, big), e.kind || (big ? 'heavy' : 'light')); } T = list[0]; }
      sfx('hit', { strength: big ? 3 : 1, kind: (CH.kick || []).includes(id) ? 'kick' : undefined });
      const cx = T.x - P.face * 18 * K(T.y); p.y = Math.max(T.y - T.z - 185 * K(T.y), Math.min(T.y - T.z - 15 * K(T.y), p.y));   // 불꽃은 허수아비 몸 위에
      if (!vfx(big ? 'hit_heavy' : 'hit_light', cx, p.y, big ? 2 : 2.4, { flip: P.face < 0 })) fx.push({ k: 'impact', x: cx, y: p.y, dir: P.face, t: big ? 0.16 : 0.1, t0: big ? 0.16 : 0.1, big });
      sparks(cx, p.y, big ? 30 : 12, big, Math.random() < 0.5 ? '#ffffff' : '#d6ecff');
      ring(cx, p.y, big ? 110 : 50, big ? 0.24 : 0.14, '#ffffff', big ? 7 : 3);
      if (big) { zoom = 0.06; flash = 0.07; fx.push({ k: 'speed', x: cx, y: p.y, t: 0.2, t0: 0.2 }); ring(T.x, T.y, 150, 0.35, 'rgba(255,255,255,.7)', 4, 0.25); dust(T.x, T.y, 10, 1.6); }
    }
  } else if (e.ev === 'shot') {
    const p = muzzle();
    if (isHot()) { P.heat = Math.min(100, P.heat + (BAL().heatPer || 9)); P.lastShot = P.t; if (P.heat >= 100) { P.overT = 2.6; sfx('empty'); for (let i = 0; i < 8; i++) steam(p.x, p.y, 1.4); } }
    const pj = CH.ranged && CH.ranged.proj || { t: 'proj', kind: 'orb' };
    curSrc = 'ranged'; runFx([BAL().shotDmg ? { ...pj, hit: { ...(pj.hit || { kind: 'light' }), dmg: BAL().shotDmg } } : pj], { o: p, basic: true }); curSrc = null;
  } else if (e.ev === 'run') runFx(e.list, e.ctx || {});
  else if (e.ev === 'slideHit') {
    if (!P.slideHit) { const p = framePt(id, f, a.reach[f], a.h * 0.6); if (!!T && Math.abs(T.y - P.y) < 64 && Math.abs(T.x - p.x) < 80 * K(P.y)) { P.slideHit = true; fireEv({ f, ev: 'hit', hy: 0.6 }); } }
  }
  else if (e.ev === 'dust') { dust(P.x, P.y, 6, 1.2); sfx(id === '19' ? 'down' : 'step'); }
}

// ═════════ 공용 효과 부품 (인물 설정 skills 가 조합해서 씀) ═════════
// 위치: at = hand(손·총구, 기본) | front(앞 바닥, dx) | self(발밑) | target(표적·화면 전체의 각 자리)
function posOf(s?: Json, c?: Json) {
  const k = K(P.y), f = P.face;
  if (s.at === 'target' || s.at === 'spot') { const p = c.pt || { x: T.x, y: T.y, z: T.z }; const kk = K(p.y); return { x: p.x + f * (s.dx || 0) * kk, gy: p.y, hy: p.y - (p.z || 0) - (s.h ?? 110) * kk, k: kk }; }
  if (s.at === 'self') return { x: P.x + f * (s.dx || 0) * k, gy: P.y, hy: P.y - (s.h ?? 110) * k, k };
  if (s.at === 'front') return { x: P.x + f * (s.dx ?? 150) * k, gy: P.y, hy: P.y - (s.h ?? 110) * k, k };
  const m = c.o || muzzle(); return { x: m.x + f * (s.dx || 0) * k, gy: P.y, hy: m.y + (s.dy || 0) * k, k };
}
const near = (x?: Json, gy?: Json, rx?: Json, ry = 90) => { const l = proxies().filter(T => Math.abs(T.x - x) < rx && Math.abs(T.y - gy) < ry); if (l.length) { hitList = l; T = l[0]; } return l.length > 0; };   // 줄 차이 70 → 90(10-29 밤 사용자: 판정이 너무 엄격)
// 맞았을 때만: 멈춤·흔들림·타격 그림
function strike(h?: Json, y?: Json) {
  if (!h) return;
  const n = h.n || 1;
  const one = (i?: Json) => {
    const kind = i === n - 1 ? (h.kind || 'heavy') : (h.mid || 'light'), big = kind !== 'light';
    hitstop = Math.max(hitstop, h.stop ?? (big ? 0.14 : 0.07)); shake = Math.max(shake, h.shake ?? (big ? 12 : 5));
    damageTarget(Math.round((h.dmg || 20) / n), kind); sfx('hit', { strength: big ? 3 : 1, kind: h.sfx });
    const hy = y ?? T.y - T.z - 110 * K(T.y);
    if (!h.noVfx) { if (h.vfx && VFX[h.vfx]) vfx(h.vfx, T.x, hy, (h.vs || 1) * K(T.y), { center: true, flip: P.face < 0, tint: h.tint }); else if (!vfx(big ? 'hit_heavy' : 'hit_light', T.x, hy, big ? 1.8 : 2.2, { flip: P.face < 0 })) sparks(T.x, hy, 10, big); }   // h.vfx: 맞는 자리 그림(3판 타격 불꽃 등)
    if (h.text) fx.push({ k: 'num', x: T.x - 30, y: hy - 70, v: h.text, t: 1.2 });
    const hv = P.hitVfx; if (hv && P.t < hv.until && P.t - hv.last > 0.12 && VFX[hv.n]) { hv.last = P.t; (VFX[hv.n].mode === 'bottom' ? vfx(hv.n, T.x, T.y, hv.s * K(T.y), { bottom: true, flip: P.face < 0 }) : vfx(hv.n, T.x, hy, hv.s * K(T.y), { center: true, flip: P.face < 0 })); }   // 기술 전용 타격 그림을 맞는 자리에(10-29: 이펙트가 엉뚱한 곳에 나오지 않게)
  };
  const list = hitList.length ? [...hitList] : (T ? [T] : []); hitList = [];
  const all = (i?: Json) => { const d0 = T; for (const t of list) { T = t; one(i); } T = d0 || T; };
  if (!list.length) return;
  for (let i = 0; i < n; i++) i ? later(i * (h.every || 0.1), () => all(i)) : all(0);
}
// 공용 바닥 파괴(전 인물 통일): 땅이 터지고 돌 부스러기가 튄 뒤 갈라진 구덩이가 남았다가 흐려짐. 바닥 층(캐릭터 뒤)
function craterAt(x?: Json, gy?: Json, k?: Json, hold = 3) { if (!vfx('ground-crater2', x, gy, k, { under: true, back: true, hold, fade: 0.6, flip: Math.random() < 0.5 })) fx.push({ k: 'scorch', x, y: gy, r: 50 * k, t: hold }); }
const FX = {
  // 손에 든 물건: 이 동작 동안 장마다 {장: [앞 dx, 바닥에서 가운데 높이]} 자리에 이펙트 그림 한 장(콘쥬스 바리케이드, 10-28)
  carry(s?: Json) { fx.push({ k: 'carry', vfx: s.vfx, pts: s.pts, clip: P.clip, sc: s.scale || 1, t: 9 }); },
  // 손에서 앞으로 포물선을 그리며 던짐 → 떨어진 자리에서 then 실행(at: 'spot')
  toss(s?: Json) { const k = K(P.y), f = P.face, [dx0, h0] = s.from || [60, 200]; for (const e of fx) if (e.k === 'carry' && e.clip === P.clip) e.t = 0;
    const x0 = P.x + f * dx0 * k, x1 = P.x + f * (s.dx || 220) * k, T = s.time || 0.32;
    fx.push({ k: 'toss', vfx: s.vfx, x0, x1, y0: P.y - h0 * k, y1: P.y - (s.land || 50) * k, arc: (s.arc || 90) * k, gy: P.y, sc: (s.scale || 1) * k, flip: f < 0, t: T, t0: T, rot: (s.spin || 0) * f, then: s.then }); },
  // 맞은 자리에서 동전이 튀어 바닥에 떨어져 돌다 멈춤(로제몬 D)
  coinDrop(s?: Json, c?: Json) { const p = posOf({ at: 'target', ...s }, c); fx.push({ k: 'coin', x: p.x, y: p.hy, vx: -P.face * 90, vy: -320, g: p.gy, t: 1.6 }); },
  // 눈빛 번쩍(보라 점 2개)
  eyes(s?: Json, c?: Json) { const id = P.clip ? P.clip.id : restId(), a = A[id]; const e = framePt(id, P.clip ? curF() : 0, (a ? a.reach[0] * 0.15 : 6), a ? a.h * 0.88 : 180); fx.push({ k: 'eyes', x: e.x, y: e.y, t: s.time || 0.35, t0: s.time || 0.35, c: s.color || '#c58bff' }); },
  // 캐릭터 그림을 넣어 뽑은 이펙트(캐릭터는 지움): 캐릭터 발 자리·배율로 그려 손·몸 위치가 맞음. under(기본)면 캐릭터 뒤
  // hits: [{at 초, dx 앞 거리(그림 화소), r 너비, hit, crater 배율}] · craters: [{at, dx, dy(아래로 +), k}] 그림 속 폭발 밑동마다
  self(s?: Json, c?: Json) {
    const k = K(P.y) * (s.scale || 1), x0 = P.x, y0 = P.y, f = P.face;
    vfx(s.vfx, x0, y0 - P.z, k, { flip: f < 0, under: s.under !== false });
    boomSnd(s.strength || 2, P.x);
    for (const g of (s.craters || [])) later(g.at || 0, () => craterAt(x0 + f * g.dx * k, y0 + (g.dy || 0) * k, k * (g.k || 0.6), g.hold || 3));   // 이펙트 그림 속 폭발 자리마다 바닥 파괴(그림 화소 기준)
    for (const h of (s.hits || [{}])) later(h.at || 0, () => {
      const x = x0 + f * (h.dx ?? 150) * k;
      if (h.crater) craterAt(x, y0, k * h.crater, h.hold || 3);
      if (h.dust) dust(x, y0, 6, k * 1.4);
      if (near(x, y0, (h.r || 110) * k, (h.depth || 75) * k)) strike(h.hit || s.hit, y0 - (h.h ?? 110) * k);
    });
  },
  // 필살기 전용 큰 이펙트(인물마다 PixelLab, docs/필살기_이펙트_설명.json): 표적 자리(없으면 앞쪽)에 화면 높이 절반 넘게
  big(s?: Json, c?: Json) {
    const v = VFX[s.vfx]; if (!v) return;
    const fh = v.frames[0][3], fw = v.frames[0][2], gx = !!T ? T.x : P.x + P.face * 380, gy = !!T ? T.y : P.y;
    const sc = (s.h || 460) / fh;
    if (fw * sc > W * 1.1) { vfx(s.vfx, W / 2, (FLOOR0 + FLOOR1) / 2 + 40, W * 1.05 / fw, { bottom: true, flip: P.face < 0 }); }
    else vfx(s.vfx, gx, gy + 10, sc, { bottom: true, flip: P.face < 0 });
    flash = Math.max(flash, 0.12); shake = Math.max(shake, 12); boomSnd(3, gx);
  },
  // 큰 폭발 한 번(바닥에서 솟음) + 공용 바닥 파괴
  boom(s?: Json, c?: Json) {
    const p = posOf({ at: 'target', ...s }, c), sc = (s.scaleR ? s.scaleR[0] + Math.random() * (s.scaleR[1] - s.scaleR[0]) : s.scale || 1) * p.k;   // scaleR: [최소, 최대] 무작위 크기
    vfx(s.vfx, p.x, p.gy, sc, { flip: Math.random() < 0.5 });
    if (s.shake) shake = Math.max(shake, s.shake);
    later(0.1, () => { craterAt(p.x, p.gy, sc * 0.9, s.scorch || 3); dust(p.x, p.gy, 8, sc * 1.6); });
    boomSnd(3, P.x);
    if (s.hit && near(p.x, p.gy, (s.r || 120) * sc, 80)) later(s.at || 0.12, () => strike(s.hit));
  },
  // 폭발 하나: vfx 그림(기본 RPG 폭발) + 그을음. hand면 손 앞 공중, 아니면 바닥
  blast(s?: Json, c?: Json) {
    const p = posOf(s, c), sc = (s.scale || 1.6) * p.k, onAir = (s.at || 'hand') === 'hand' || s.air;
    if (!vfx(s.vfx || 'eileen-rpg-explosion', p.x + (onAir ? P.face * 26 * sc : 0), onAir ? p.hy : p.gy - 4, sc * 1.2, onAir ? { center: true, flip: P.face < 0 } : {})) for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, v = 80 + Math.random() * 300; fx.push({ k: 'fire', x: p.x, y: onAir ? p.hy : p.gy - 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 60, r: 8 + Math.random() * 12, t: 0.6, t0: 0.6 }); }
    if (s.scorch) craterAt(p.x, p.gy, sc * 0.7, s.scorch);
    if (!onAir) dust(p.x, p.gy, 6, sc);
    boomSnd(2, P.x);
    if (near(p.x, p.gy, (s.r || 110) * p.k, s.depth || 75)) strike(s.hit, p.hy);
  },
  // 앞으로 일직선 연쇄 폭발
  chain(s?: Json, c?: Json) { const n = s.n || 3; for (let i = 0; i < n; i++) later(i * (s.every || 0.12), () => FX.blast({ ...s, at: 'front', dx: (s.from || 90) + i * (s.step || 120), scale: (s.scale || 1.3) * (1 + i * 0.12), hit: i === n - 1 ? s.hit : (s.hit && { ...s.hit, kind: s.hit.mid || 'light', dmg: (s.hit.dmg || 30) * 0.5 }) }, c)); },
  // 둘레 원형 범위: 바닥 고리 + 둘레 폭발 n개
  circle(s?: Json, c?: Json) {
    const p = posOf({ at: 'self', ...s }, c), r = (s.r || 260) * p.k, n = s.n || 8;
    ring(p.x, p.gy, r, 0.5, s.color || 'rgba(255,230,180,.9)', 7, 0.3);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; later(i * 0.03, () => { const x = p.x + Math.cos(a) * r * 0.8, gy = p.gy + Math.sin(a) * r * 0.24; vfx(s.vfx || 'eileen-rpg-explosion', x, gy - 4, (s.scale || 1.5) * p.k); dust(x, gy, 3, 1.5); }); }
    if (s.center !== false) later(0.12, () => vfx(s.vfx || 'eileen-rpg-explosion', p.x, p.gy - 4, (s.scale || 1.5) * 1.6 * p.k));
    boomSnd(3, P.x);
    if (near(p.x, p.gy, r, r * 0.35 + 30)) later(0.08, () => strike(s.hit));
  },
  // 바닥에서 하늘로 솟는 폭발 기둥(폭발 그림을 위로 쌓음)
  pillar(s?: Json, c?: Json) {
    const p = posOf({ at: 'target', ...s }, c), sc = (s.scale || 1.5) * p.k;
    const light = !s.vfx && VFX['fx-pillar'];   // 폭발 기둥이 아닌 인물은 공용 빛기둥(COMMON.pillar)만
    if (!light) for (let i = 0; i < 4; i++) later(i * 0.06, () => vfx(s.vfx || 'eileen-rpg-explosion', p.x + (Math.random() - 0.5) * 10, p.gy - 4 - i * 70 * sc, sc * (1.2 - i * 0.15)));
    if (!light) for (let i = 0; i < 18; i++) fx.push({ k: 'fire', x: p.x + (Math.random() - 0.5) * 30 * sc, y: p.gy - Math.random() * 40, vx: (Math.random() - 0.5) * 60, vy: -500 - Math.random() * 500, r: 8 + Math.random() * 10, t: 0.5 + Math.random() * 0.3, t0: 0.8 });
    if (s.scorch !== 0) craterAt(p.x, p.gy, sc * 0.8, s.scorch || 3);
    boomSnd(3, P.x);
    if (near(p.x, p.gy, 90 * sc, 70)) strike(s.hit);
  },
  // 화면 전체: 표적 + 무작위 자리 spots곳에 each 부품을 차례로
  screen(s?: Json, c?: Json) {
    const spots: Json[] = [];
    for (let i = 0; i < (s.spots ?? 5); i++) spots.push({ x: 90 + Math.random() * (W - 180), y: FLOOR0 + 40 + Math.random() * (FLOOR1 - FLOOR0 - 50), z: 0 });
    if (!!T) spots.splice(Math.random() * (spots.length + 1) | 0, 0, { x: T.x, y: T.y, z: T.z, onT: true });
    spots.forEach((pt, i) => later(i * (s.every ?? 0.11), () => runFx((s.each || []).map((e?: Json) => ({ ...e, at: e.at === 'self' ? 'self' : 'target', hit: pt.onT ? e.hit : null })), { ...c, pt: pt.onT ? { x: T.x, y: T.y, z: T.z, onT: true } : pt })));
  },
  // 투사체: bullet(예광탄 그림) | orb(빛 구슬) | spike(검은 가시) | pen(볼펜) | card | knife
  proj(s?: Json, c?: Json) {
    const p = posOf({ at: 'hand', ...s }, c), dir = P.face;
    if ((s.kind || 'orb') === 'bullet') {
      muzzleFlash(p, s.big); sfx('shot');
      const hitD = !!T && Math.abs(T.y - P.y) < 60 && (T.x - P.x) * dir > 0;
      const endX = hitD ? T.x - dir * 14 : (dir > 0 ? W + 20 : -20);
      const tt = Math.abs(endX - p.x) / 3400, g = Math.max(-0.1, Math.min(0.1, mzAng())) + (s.spread ? (Math.random() - 0.5) * s.spread : 0),   // 반동으로 총구가 들린 장도 탄은 앞으로(10-28 데드폴 한 발이 허공으로)
      gp = MZ_GAP * K(P.y), sx = p.x + dir * Math.cos(g) * gp, sy = p.hy + Math.sin(g) * gp;
      fx.push({ k: 'bullet', x: sx, y: sy, x2: endX, y2: sy + Math.abs(endX - sx) * Math.tan(g) + (Math.random() - 0.5) * 20, t: tt, t0: tt });
      shake = Math.max(shake, s.big ? 6 : 1.5);
      if (hitD) later(tt, () => { if (!vfx('bullet_hit_body', endX, p.hy, 2)) sparks(endX, p.hy, 4, false, '#fff6d0'); strike({ noVfx: true, stop: s.big ? 0.08 : 0.02, shake: s.big ? 9 : 2, ...(s.hit || { dmg: 7, kind: 'light' }) }); });
      return;
    }
    sfx(s.sfx || 'whiff');
    const fancy = !c.basic && s.plain !== true;   // 기술 투사체: 1.5배·인물 색 잔상 꼬리·빛무리·맞으면 큰 불꽃(10-29 사용자: 초라한 투사체 하나 딸랑)
    fx.push({ k: 'proj', kind: s.kind || 'orb', vfx: s.vfx, tint: s.tint, rot: s.rot, x: p.x, y: p.hy + (s.dy || 0) * p.k, gy: P.y, dir, v: s.speed || 1300, c: s.color || CH.color, size: (s.size || 1) * p.k * (fancy ? 1.5 : 1), hit: s.hit, pierce: s.pierce, done: new Set(), t: s.life || 1.4, end: s.end, fancy, trail: [] });
    if (fancy) { muzzleFlash(p, true); flash = Math.max(flash, 0.04); }
  },
  // 굵은 광선(충전): charge_beam 그림을 가로로 이어 붙임
  beam(s?: Json, c?: Json) {
    const p = c.o || muzzle(), lv = s.lv || 1, w = s.w || [0, 10, 24, 40][lv] || 20;
    sfx('shot'); sfx('hit', { strength: 3, kind: 'bullet' });
    if (VFX.charge_beam && !s.code) fx.push({ k: 'beamS', x: p.x, y: p.y, dir: P.face, t: 0.22 + lv * 0.1, t0: 0.22 + lv * 0.1, sy: s.sy || [0, 0.35, 0.6, 0.9][lv] || 0.6 });
    else fx.push({ k: 'beam', x: p.x, y: p.y, dir: P.face, t: 0.3, t0: 0.3, w, c: s.color || CH.color, lv });
    if (!!T && Math.abs(T.y - P.y) < 30 + w && (T.x - P.x) * P.face > 0) strike(s.hit || { dmg: 30 * lv, kind: lv >= 2 ? 'launch' : 'heavy' }, p.y);
  },
  // 앞 범위 타격(그림 없는 판정 상자)
  // melee 사거리는 평타(170)만큼은 닿게(10-29: 140 같은 짧은 사거리는 평타 거리의 상대를 못 맞혔음)
  melee(s?: Json, c?: Json) { const r = Math.max(s.range || 170, 175) * K(P.y), x = P.x + P.face * r * 0.6; if (near(x, P.y, r * 0.6 + 40, s.depth || 90) && (T.x - P.x) * P.face > -20) strike(s.hit); },   // 깊이 64 → 90, 앞 여유 +10(10-29 밤)
  // 바닥 가시: 검은 바늘 n개가 솟음
  spikes(s?: Json, c?: Json) {
    const p = posOf({ at: 'front', ...s }, c), n = s.n || 5, sp = (s.spread || 70) * p.k;
    for (let i = 0; i < n; i++) later(i * 0.025, () => fx.push({ k: 'spikeG', x: p.x + (Math.random() - 0.5) * sp * 2, y: p.gy + (Math.random() - 0.5) * 24, h: (s.len || 120) * p.k * (0.6 + Math.random() * 0.6), lean: (Math.random() - 0.5) * 0.5, c: s.color || CH.color, t: s.time || 0.55, t0: s.time || 0.55 }));
    if (near(p.x, p.gy, sp + 30, 60)) later(0.04, () => strike(s.hit));
  },
  // 가시 격자(구속): 넓은 범위 + 맞으면 묶임
  grid(s?: Json, c?: Json) {
    const p = posOf({ at: 'front', ...s }, c), w = (s.w || 300) * p.k, dep = s.depth || 60;
    for (let i = 0; i < (s.n || 16); i++) later(i * 0.02, () => fx.push({ k: 'spikeG', x: p.x + (Math.random() - 0.5) * w, y: p.gy + (Math.random() - 0.5) * dep * 2, h: (s.len || 110) * p.k * (0.6 + Math.random() * 0.5), lean: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.3), c: s.color || CH.color, t: s.time || 1.6, t0: s.time || 1.6 }));
    if (near(p.x, p.gy, w / 2 + 30, dep + 20)) { strike(s.hit || { dmg: 12, kind: 'light' }); if (s.bind) FX.bind({ time: s.bind, color: s.color }); }
  },
  puddle(s?: Json, c?: Json) { const p = posOf({ at: 'self', ...s }, c); fx.push({ k: 'puddle', x: p.x, y: p.gy, r: (s.r || 70) * p.k, c: s.color || '#000', t: s.time || 0.8, t0: s.time || 0.8 }); },
  // 몸 숨기기/드러내기(아래부터 지움)
  hide(s?: Json) { P.vanish = { mode: s.mode || 'out', t: 0, dur: s.dur || 0.2 }; },
  // 순간 이동: 표적 등 뒤(behind) 또는 앞(front)
  teleport(s?: Json) {
    if (!!!T) { P.x += P.face * 260; return; }
    const side = s.to === 'front' ? -1 : 1, from = Math.sign(T.x - P.x) || P.face;
    P.x = T.x + from * side * (s.dist || 85) * K(T.y); P.y = T.y; P.face = -from * side;
    if (s.puddle !== false) FX.puddle({ at: 'self', r: 70, time: 0.6, color: s.color || '#000' }, {});
  },
  bind(s?: Json) { if (!!!T) return; T.bindT = s.time || 2; T.bindC = s.color || CH.color; T.vx = 0; },
  mark(s?: Json) { if (!!!T) return; T.mark = s.time || 6; T.markC = s.color || '#ff5a4a'; ring(T.x, T.y - 230 * K(T.y), 40, 0.3, T.markC, 3); if (s.text) fx.push({ k: 'num', x: T.x - 30, y: T.y - 260 * K(T.y), v: s.text, t: 1.2 }); },
  buff(s?: Json) { P.buffT = s.time || 4; P.buffC = s.color || CH.color; P.buffEdge = s.edge !== false; if (s.label) fx.push({ k: 'num', x: P.x - 40, y: P.y - 250 * K(P.y), v: s.label, t: 1.2 }); sfx('ability'); },
  heal(s?: Json) { const v = s.v || 30; P.hp = Math.min(100, P.hp + v); if (P.hp > 25) P.dying = false; vfx('heal', P.x, P.y + 4, 3.4 * K(P.y)); P.healT = 0.8; fx.push({ k: 'num', x: P.x - 20, y: P.y - 240 * K(P.y), v: '+' + v, t: 0.9 }); sfx('heal'); },
  // 소환·설치: 작은 물건(code 그림)을 두고, tick 마다 부품 실행
  summon(s?: Json, c?: Json) {
    const p = posOf({ at: 'front', ...s }, c);
    const o = { k: 'obj', anim: s.anim, alpha: s.alpha, over: s.over, icon: s.icon || 'box', x: p.x, y: s.at === 'hand' ? p.hy : p.gy, ground: s.at !== 'hand', c: s.color || CH.color, t: s.time || 4, t0: s.time || 4, s: p.k, face: P.face };
    fx.push(o);
    if (s.tick) { const n = Math.floor((s.time || 4) / s.tick.every); for (let i = 1; i <= n; i++) later(i * s.tick.every, () => runFx(s.tick.fx, { o: { x: o.x, y: o.y - 40 * o.s }, pt: { x: o.x, y: p.gy } })); }
  },
  pull(s?: Json) { if (!!!T) return; const dir = Math.sign(P.x - T.x); T.vx = dir * (s.dist || 220) * 3; if (s.hit) strike(s.hit); },
  launch(s?: Json) { if (!!!T) return; T.vz = s.v || 900; T.bounced = false; },
  flash(s?: Json) { flash = Math.max(flash, s.v || 0.1); },
  shake(s?: Json) { shake = Math.max(shake, s.v || 10); },
  dark(s?: Json) { dark = Math.max(dark, s.v || 1); },
  zoom(s?: Json) { zoom = s.v || 0.06; },
  text(s?: Json, c?: Json) { const q = c.pt || T, p = s.at === 'target' ? { x: q.x, y: q.y - (q.z || 0) - 260 * K(q.y) } : { x: P.x, y: P.y - 270 * K(P.y) }; fx.push({ k: 'num', x: p.x - 30, y: p.y, v: s.v, t: s.time || 1.2, big: s.big }); },
  // 돌진: 그 장을 잡은 채 앞으로 미끄러짐, 표적을 지나며 한 번 맞힘
  dash(s?: Json) { P.dash = { v: s.speed || 1500, t: s.time || 0.45, hit: s.hit, delay: s.delay, stop: s.stop, done: false }; P.ghostT = Math.max(P.ghostT, s.time || 0.45); sfx('evade'); },
  // 뒤로 펄쩍(데쥬레): 무적 + 뒤로 이동
  hop(s?: Json) { P.dodgeV = { x: -P.face * (s.v || 900), y: 0 }; P.inv = Math.max(P.inv, s.inv || 1); P.z = 0; if (s.text) fx.push({ k: 'num', x: P.x - 10, y: P.y - 270 * K(P.y), v: s.text, t: 0.8 }); },
  // 띄워 고정(게슈간): 표적을 h만큼 띄워 time초 공중에
  lift(s?: Json, c?: Json) { if (!!!T || (c.pt && !c.pt.onT)) return; T.liftT = s.time || 1.5; T.liftH = s.h || 120; T.vx = 0; ring(T.x, T.y, 60, 0.4, s.color || CH.color, 3, 0.3); if (s.hit) strike(s.hit); },
  // 실(로제몬): 정수리에서 대상까지 선
  tether(s?: Json, c?: Json) { const q = c.pt || { x: T.x, y: T.y, onT: true }; fx.push({ k: 'tether', tx: q.x, ty: q.y, onT: !!q.onT, c: s.color || CH.color, t: s.time || 2, t0: s.time || 2 }); },
  // 바닥 충격파: 고리 + 먼지 + 금 + 반지름 안 맞음
  shock(s?: Json, c?: Json) { const p = posOf({ at: 'front', dx: 60, ...s }, c), r = (s.r || 220) * p.k; ring(p.x, p.gy, r, 0.4, s.color || 'rgba(255,255,255,.85)', 6, 0.3); dust(p.x, p.gy, 12, 1.8); fx.push({ k: 'scorch', x: p.x, y: p.gy, r: r * 0.45, t: s.scorch || 2.5 }); sfx('hit', { strength: 3 }); if (near(p.x, p.gy, r, r * 0.35 + 40)) strike(s.hit); },
  // 같은 효과를 대상 둘레에 여러 번(큐라스 지속 포격)
  barrage(s?: Json, c?: Json) { for (let i = 0; i < (s.n || 10); i++) later(i * (s.every || 0.1), () => { const q = c.pt || (!!T ? { x: T.x, y: T.y, z: T.z, onT: true } : { x: P.x + P.face * 300, y: P.y }); runFx((s.each || []).map((e?: Json) => ({ ...e, at: 'target', hit: q.onT ? e.hit : null })), { ...c, pt: { x: q.x + (Math.random() - 0.5) * (s.jitter || 50), y: q.y + (Math.random() - 0.5) * 14, z: q.z, onT: q.onT } }); }); },
  // 불 벽: 그 자리에 time초 동안 불이 솟고, 안에 있으면 맞음
  firewall(s?: Json, c?: Json) { const p = s.at === 'screen' ? { x: W / 2, gy: FLOOR1 - 20, k: 1 } : posOf({ at: 'target', ...s }, c); const w = s.at === 'screen' ? W : (s.w || 160) * p.k; fx.push({ k: 'firewall', x: p.x, y: p.gy, w, t: s.time || 3, t0: s.time || 3 }); if (s.at === 'screen' ? allT() : near(p.x, p.gy, w / 2 + 20, 60)) strike(s.hit); },
  // 큰 괴이 그림자가 화면을 휩쓸며 n번 물어뜯음(고그니쟈)
  sweep(s?: Json) { const dir = P.face, T = s.time || 2; fx.push({ k: 'sweep', x0: dir > 0 ? -260 : W + 260, x1: dir > 0 ? W + 260 : -260, y: (FLOOR0 + FLOOR1) / 2 + 30, dir, c: s.color || '#140c18', t: T, t0: T }); sfx('super'); if (allT() && s.hit) { const n = s.hit.n || 5; for (let i = 0; i < n; i++) later(T * (0.3 + 0.4 * i / n), () => strike({ ...s.hit, n: 1, kind: i === n - 1 ? (s.hit.kind || 'launch') : 'heavy' })); } },
  // 잔해 파도(콘쥬스): 상자 더미가 앞으로 밀려가며 표적을 쓸어냄
  wave(s?: Json) { fx.push({ k: 'wave', style: s.style, c: s.color, x: P.x + P.face * 60, dir: P.face, v: s.speed || 900, y: P.y, hit: s.hit, done: false, t: 3, t0: 3 }); sfx('whiff', { strength: 3 }); },
  ring(s?: Json, c?: Json) { const p = posOf({ at: 'self', ...s }, c); ring(p.x, s.air ? p.hy : p.gy, (s.r || 120) * p.k, s.time || 0.5, s.color || CH.color, s.w || 5, s.air ? 1 : 0.3); },
  // 화염 방사(윤병수): time초 동안 손·총구에서 앞으로 불을 뿜고, 앞 len 안이면 n번 맞음
  flame(s?: Json, c?: Json) { const T = s.time || 1.2, len = (s.len || 300) * K(P.y); for (let i = 0; i * 0.03 < T; i++) later(i * 0.03, () => { const m = muzzle(); for (let j = 0; j < 3; j++) fx.push({ k: 'fire', x: m.x + P.face * 10, y: m.y, vx: P.face * (500 + Math.random() * 400), vy: (Math.random() - 0.5) * 140, r: 5 + Math.random() * 6, t: 0.25 + Math.random() * 0.25, t0: 0.5 }); }); if (s.hit && !!T && (T.x - P.x) * P.face > 0 && Math.abs(T.x - P.x) < len + 40 && Math.abs(T.y - P.y) < 70) { const n = s.hit.n || 6; for (let i = 0; i < n; i++) later(0.1 + i * T / n, () => strike({ ...s.hit, n: 1, kind: i === n - 1 ? (s.hit.kind || 'heavy') : 'light', stop: 0.03, shake: 3 })); } },
  // 포물선으로 던짐(수류탄): n개를 부채꼴로, 떨어진 자리에서 end 부품
  lob(s?: Json, c?: Json) { const n = s.n || 1; for (let i = 0; i < n; i++) { const m = muzzle(), k = K(P.y), dist = (s.dist || 300) * k, dy = (i - (n - 1) / 2) * (s.spread || 50); const tx = m.x + P.face * dist, ty = P.y + dy; fx.push({ k: 'lob', x0: m.x, y0: m.y, x1: tx, y1: ty, t: s.time || 0.7, t0: s.time || 0.7, icon: s.icon || 'grenade' }); later((s.time || 0.7) + (s.fuse || 0), () => runFx((s.end || [{ t: 'blast', scale: 1.1 }]).map((e?: Json) => ({ ...e, at: 'target', hit: near(tx, ty, 120, 60) ? e.hit : null })), { pt: { x: tx, y: ty } })); } },
  // 소리 고리: 손(마이크·입) 앞에서 n겹 퍼짐
  waves(s?: Json, c?: Json) { for (let i = 0; i < (s.n || 3); i++) later(i * 0.09, () => { const m = muzzle(); ring(m.x + P.face * 20, m.y, (s.r || 70) * (1 + i * 0.4), 0.35, s.color || '#ffcf9a', 4, 1); }); if (s.hit) FX.melee({ range: s.range || 260, hit: s.hit }, c); },
  hit(s?: Json) { if (s.hit) strike(s.hit); },   // 그림 없이 맞음만(화면 전체 기술의 표적 자리)
  // 3판 이펙트 그림(x3-*) 한 장. 기준 배율 1 = 인물과 같은 화소 크기(인물 그림을 크기 기준으로 뽑음). mode(bottom·center)는 빌드가 목록에서 넣음
  // at: hand | front(dx) | self | body(몸 가운데) | target(표적·화면 전체 각 자리) | screen(화면 가운데)
  // scale · w(화면 폭에 대한 비율로 맞춤) · dx·dy(그림 화소, dy 아래로 +) · flip:false · tint(흰 공용 그림에 색) · under · hold · loop(초) · fade · rot · back
  // 맞음: hit + r(기본 그림 폭 40%) + depth + delay. after: [부품] 그림이 끝난 뒤
  v(s?: Json, c?: Json) {
    const meta = VFX[s.vfx]; if (!meta) return;
    const fw = meta.frames[0][2], fh = meta.frames[0][3], md = s.mode || meta.mode || 'center';
    let p;
    if (s.at === 'screen') p = { x: W / 2 + P.face * (s.dx || 0), gy: (FLOOR0 + FLOOR1) / 2 + 40 + (s.dy || 0), hy: H / 2 + (s.dy || 0), k: 1 };
    else if (s.at === 'body') { const k = K(P.y); p = { x: P.x + P.face * (s.dx || 0) * k, gy: P.y, hy: P.y - P.z - (s.h ?? 110) * k + (s.dy || 0) * k, k }; }
    else { p = posOf({ at: 'front', ...s }, c); if (s.dy) { p.gy += s.dy * p.k; p.hy += s.dy * p.k; } }
    let sc = (s.scale || 1) * (s.at === 'screen' ? 1 : p.k);
    if (s.w) sc = W * s.w / fw;
    const flip = s.flip === false ? false : P.face < 0;
    const o = { [md === 'bottom' ? 'bottom' : 'center']: true, flip };   // 빈 값은 넣지 않음(undefined가 그림 시간 t를 덮어써 바로 지워지던 버그)
    for (const [k, v] of Object.entries({ under: s.under, back: s.back, tint: s.tint, hold: s.hold, loop: s.loop ? true : undefined, t: s.loop || undefined, fade: s.fade, rot: s.rot ? s.rot * (flip ? -1 : 1) : undefined })) if (v !== undefined) o[k] = v;
    vfx(s.vfx, p.x, md === 'bottom' ? p.gy : p.hy, sc, o);
    if (s.boom) boomSnd(s.boom, p.x);
    if (s.hit) {
      const r = (s.r ?? fw * 0.4) * sc, hy = md === 'bottom' ? p.gy - Math.min(fh * sc * 0.5, 110 * p.k) : p.hy;
      const hitAt = (t?: Json) => later(t, () => { if (s.at === 'screen' ? allT() : near(p.x, p.gy, r + 20, (s.depth || 75) * (p.k || 1))) strike(t > (s.delay || 0) ? (s.tickHit || s.hit) : s.hit, hy); });
      hitAt(s.delay || 0);
      // 되풀이 그림(불 벽 등): 그림이 한 바퀴 돌 때마다(또는 tick 초마다) 다시 맞음 — 띄워진 상대도(10-28 큐라스 2단 두 번째 불꽃 판정 없음)
      if (s.loop || s.tick) { const every = s.tick || vfxDur(s.vfx), end = (s.loop || 0) + (s.hold || 0); for (let t = (s.delay || 0) + every; t < end - 0.05; t += every) hitAt(t); }
    }
    if (s.after) later(vfxDur(s.vfx) + (s.hold || 0), () => runFx(s.after, { ...c, pt: { x: p.x, y: p.gy, z: 0, onT: c.pt && c.pt.onT } }));
  },
  repeat(s?: Json, c?: Json) { for (let i = 0; i < (s.n || 3); i++) later(i * (s.every || 0.1), () => runFx(s.fx || [], c)); },
  gray(s?: Json) { grayT = Math.max(grayT, s.time || 1); },
  chance(s?: Json, c?: Json) { const ok = Math.random() < (s.p ?? 0.5); runFx(ok ? s.yes : s.no, c); },
  // 위에서 쏟아지는 작은 것들(서류·잔·카드)
  rain(s?: Json) { for (let i = 0; i < (s.n || 40); i++) later(Math.random() * (s.time || 1.2), () => fx.push({ k: 'drop', icon: s.icon || 'paper', x: Math.random() * W, y: -20, vy: 300 + Math.random() * 300, vx: (Math.random() - 0.5) * 80, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, g: FLOOR0 + Math.random() * (FLOOR1 - FLOOR0), c: s.color || '#f2efe6', t: 3, t0: 3 })); },
  // 훑기: 화면을 가로지르는 선(line) / 펼쳐지는 사각 격자(grid)
  scan(s?: Json) { fx.push({ k: s.style === 'grid' ? 'grid' : 'scan', x: P.x, y: P.y - 190 * K(P.y), dir: P.face, c: s.color || CH.color, t: s.time || 0.6, t0: s.time || 0.6 }); sfx('ability'); },
  // 베기 궤적: x(엑스) | arc(초승달)
  slash(s?: Json, c?: Json) {
    const p = s.at === 'center' ? { x: W / 2, gy: (FLOOR0 + FLOOR1) / 2, hy: H / 2, k: 1 } : posOf({ at: 'front', ...s }, c);
    fx.push({ k: s.dark ? 'slashD' : 'slash', style: s.style || 'arc', x: p.x, y: p.hy, r: (s.size || 160) * (s.at === 'center' ? 1 : p.k), dir: P.face, c: s.color || CH.color, t: 0.3, t0: 0.3 });
    sfx('whiff', { strength: 2 });
    if (s.at === 'center' ? allT() : near(p.x, p.gy, (s.size || 160) * p.k, 70)) strike(s.hit);
  },
  later(s?: Json, c?: Json) { later(s.in || 0.5, () => runFx(s.fx || [], c)); },
  // 에일린: 제압사격 한 발(앞 땅 부채꼴)
  suppress(s?: Json, c?: Json) {
    const p = c.o || muzzle(); sfx('shot');
    const dir = P.face, drop = Math.max(40, P.y - p.y), dist = drop * (1.25 + Math.random() * 1.4);
    const gx = p.x + dir * dist, gy = P.y + (Math.random() - 0.5) * 18 * K(P.y), ang = Math.atan2(gy - p.y, dist);
    fx.push({ k: 'shell', x: p.x - dir * 30, y: p.y, vx: -dir * (80 + Math.random() * 80), vy: -220 - Math.random() * 120, g: P.y, t: 1.2 });
    const gp = MZ_GAP * K(P.y), sx = p.x + dir * Math.cos(ang) * gp, sy = p.y + Math.sin(ang) * gp, tt = Math.hypot(gx - sx, gy - sy) / 3200;
    if (VFX.tracer) fx.push({ k: 'bullet', x: sx, y: sy, x2: gx, y2: gy, t: tt, t0: tt });
    later(tt, () => { sparks(gx, gy - 3, 4, false, '#ffe9a0'); if (Math.random() < 0.4) dust(gx, gy, 1, 0.4); });
    shake = Math.max(shake, 1.5);
    const ddx = (T.x - p.x) * dir;
    if (!!T && ddx > 30 && ddx < dist + 40 && Math.abs(T.y - P.y) < 90) {   // 줄 차이 70 → 90(10-29 밤)
      const bulletY = p.y + ddx * Math.tan(ang), dk = K(T.y);
      if (bulletY > T.y - T.z - 220 * dk && bulletY < T.y - T.z + 10) later(ddx / 3200, () => { damageTarget(s.dmg || 7, 'light'); T.vx += dir * 140; T.stag = Math.max(T.stag, 0.45); vfx('bullet_hit_body', T.x - dir * 10, bulletY, 2); hitstop = Math.max(hitstop, 0.012); shake = Math.max(shake, 3); });
    }
  },
  // 에일린: 판독 표적 → 포격
  artillery(s?: Json) {
    const spots: Json[] = [];
    for (let k = 0; k < (s.n || 12); k++) spots.push({ x: 60 + Math.random() * (W - 120), y: FLOOR0 + 30 + Math.random() * (FLOOR1 - FLOOR0 - 30) });
    if (!!T) spots.splice(Math.random() * spots.length | 0, 0, { x: T.x, y: T.y, onT: true });
    const marks = spots.map(sp => ({ k: 'target', x: sp.x, y: sp.y, t: 8, onT: sp.onT }));
    [0, 1, 2].forEach(g => later(g * 0.38, () => { marks.forEach((m, n) => { if (n % 3 === g) fx.push(m); }); sfx('ui'); }));
    marks.forEach((m, i) => later(1.2 + i * 0.13 + Math.random() * 0.08, () => {
      fx.push({ k: 'mortar', x: m.x, y: m.y, t: 0.32, t0: 0.32 }); sfx('whiff', { strength: 2 });
      later(0.32, () => { FX.blast({ at: 'target', air: false, scale: 1.4, scorch: 2.5, hit: m.onT ? { dmg: 55, kind: 'launch' } : null }, { pt: { x: m.x, y: m.y } }); m.t = 0; });
    }));
  },
};
function runFx(list?: Json, c: Ctx = {}) { for (const s of list || []) { const f = (FX as Record<string, Json>)[s.t]; if (f) try { const n0 = fx.length; f(s, c); const cm = (COMMON as Record<string, Json>)[s.t]; if (cm) cm(s, c, n0); } catch (e) { console.warn(s, e); } } }
// ── 공용 스킬 이펙트(PixelLab, 흰색으로 뽑아 인물 색을 입힘). 코드 도형 대신 그림을 쓰고, 그림이 없으면 원래 코드 도형 그대로 ──
// 사용자 2026-10-25: 스킬마다 이펙트. 목록·구분은 docs/스킬_이펙트_목록.md
const colOf = (s?: Json) => s.color && !/^rgba?\(/.test(s.color) ? s.color : CH.color;
const dropNew = (n0?: Json, kinds?: Json) => { for (let i = fx.length - 1; i >= n0; i--) if (kinds.includes(fx[i].k)) fx.splice(i, 1); };   // 방금 넣은 코드 도형을 그림으로 바꿈
const COMMON = {
  slash(s?: Json, c?: Json, n0?: Json) { if (!VFX['fx-slash']) return; const e = fx.slice(n0).find(e => e.k === 'slash' || e.k === 'slashD'); if (!e) return; dropNew(n0, ['slash', 'slashD']); vfx('fx-slash', e.x, e.y, e.r / 40, { center: true, flip: e.dir < 0, tint: s.dark ? '#2a1a3a' : colOf(s), t: 0.32 }); },
  bind(s?: Json) { if (!!!T || !VFX['fx-bind']) return; const k = K(T.y); vfx('fx-bind', T.x, T.y - T.z, 3.6 * k, { bottom: true, tint: colOf(s), hold: Math.max(0, (s.time || 2) - 0.6), fade: 0.4 }); },
  tether(s?: Json) { COMMON.bind(s); },
  mark(s?: Json) { if (!!!T || !VFX['fx-mark']) return; dropNew(fx.length - 1, ['ring']); vfx('fx-mark', T.x, T.y - T.z - 240 * K(T.y), 1.8 * K(T.y), { center: true, tint: colOf(s) }); },
  scan(s?: Json, c?: Json, n0?: Json) { if (!VFX['fx-scan']) return; dropNew(n0, ['scan', 'grid']); vfx('fx-scan', P.x + P.face * 170 * K(P.y), P.y - 130 * K(P.y), 3 * K(P.y), { center: true, flip: P.face < 0, tint: colOf(s) }); },
  shock(s?: Json, c?: Json, n0?: Json) { if (!VFX['fx-shockwave']) return; const p = posOf({ at: 'front', dx: 60, ...s }, c); dropNew(n0, ['scorch', 'ring']); vfx('fx-shockwave', p.x, p.gy + 10 * p.k, (s.r || 220) * p.k / 70, { bottom: true, under: true, tint: colOf({ color: s.color || '#ffffff' }) }); },
  ring(s?: Json, c?: Json, n0?: Json) { if (s.air || !VFX['fx-shockwave']) return; const p = posOf({ at: 'self', ...s }, c); dropNew(n0, ['ring']); vfx('fx-shockwave', p.x, p.gy + 10 * p.k, (s.r || 120) * p.k / 70, { bottom: true, under: true, tint: colOf(s) }); },
  waves(s?: Json) { if (!VFX['fx-shockwave']) return; const m = muzzle(); for (let i = 0; i < (s.n || 3); i++) later(i * 0.09, () => vfx('fx-shockwave', m.x + P.face * (40 + i * 40), m.y + 20, 1.2 + i * 0.5, { center: true, tint: colOf(s) })); },
  summon(s?: Json, c?: Json, n0?: Json) { if (!VFX['fx-summon']) return; const o = fx.slice(n0).find(e => e.k === 'obj'); if (!o || !o.ground) return; vfx('fx-summon', o.x, o.y + 8 * o.s, 1.6 * o.s, { bottom: true, tint: colOf(s) }); },
  buff(s?: Json) { if (!VFX['fx-buff']) return; const k = K(P.y); for (let i = 0; i < 3; i++) later(i * 0.06, () => vfx('fx-buff', P.x + (i - 1) * 34 * k, P.y - 10 * k, 3 * k, { bottom: true, tint: colOf(s) })); },
  hide(s?: Json) { if (VFX['fx-vanish']) vfx('fx-vanish', P.x, P.y - 110 * K(P.y), 3.4 * K(P.y), { center: true, tint: colOf({ color: s.color || '#d8d4e8' }) }); },
  teleport(s?: Json) { if (VFX['fx-vanish']) vfx('fx-vanish', P.x, P.y - 110 * K(P.y), 3.4 * K(P.y), { center: true, tint: colOf({ color: s.color || '#d8d4e8' }) }); },
  puddle(s?: Json, c?: Json) { if (!VFX['fx-shadow']) return; const p = posOf({ at: 'self', ...s }, c); vfx('fx-shadow', p.x, p.gy + 8 * p.k, (s.r || 70) * p.k / 40, { bottom: true, under: true }); },
  spikes(s?: Json, c?: Json, n0?: Json) { if (!VFX['fx-shadow']) return; const p = posOf({ at: 'front', ...s }, c); dropNew(n0, ['spikeG']); for (let i = 0; i < 3; i++) later(i * 0.05, () => vfx('fx-shadow', p.x + (i - 1) * 60 * p.k, p.gy + 8 * p.k, 2.2 * p.k, { bottom: true })); },
  grid(s?: Json, c?: Json, n0?: Json) { if (!VFX['fx-shadow']) return; const p = posOf({ at: 'front', ...s }, c), w = (s.w || 300) * p.k; for (let i = 0; i < 5; i++) later(i * 0.04, () => vfx('fx-shadow', p.x + (i - 2) * w / 5, p.gy + 8 * p.k, 2 * p.k, { bottom: true })); },
  firewall(s?: Json, c?: Json) { if (!VFX['fx-fire']) return; const p = s.at === 'screen' ? { x: W / 2, gy: FLOOR1 - 20, k: 1 } : posOf({ at: 'target', ...s }, c); const w = s.at === 'screen' ? W : (s.w || 160) * p.k, n = Math.max(1, Math.round(w / 220)); for (let i = 0; i < n; i++) vfx('fx-fire', p.x + (i - (n - 1) / 2) * w / n, p.gy + 6, 1.8 * p.k, { bottom: true, t: s.time || 3, loop: true }); },
  flame(s?: Json) { if (!VFX['fx-fire']) return; const k = K(P.y), len = (s.len || 300); for (let i = 0; i < 3; i++) later(i * 0.08, () => { const m = muzzle(); vfx('fx-fire', m.x + P.face * (len * (i + 1) / 4) * k, m.y, (0.6 + i * 0.2) * k, { center: true, flip: P.face < 0 }); }); },   // 총구 높이에서 사거리(len) 안에만(10-28 윤병수: 바닥에 깔리고 사거리 밖까지 보였음)
  pillar(s?: Json, c?: Json) { if (s.vfx || !VFX['fx-pillar']) return; const p = posOf({ at: 'target', ...s }, c); vfx('fx-pillar', p.x, p.gy + 6 * p.k, 3 * p.k, { bottom: true, tint: colOf(s) }); },
};

// ── 흐름 ──
function toIdle0() { P.mode = 'ground'; P.clip = null; P.combo = 0; P.idleT = 0; P.inSuper = false; P.returning = false; }
// 동작이 끝나 대기로 갈 때: 끝 장과 대기 첫 장이 크게 다른 줄(빌드가 잰 seam ≥ 0.35)은 두 장을 거꾸로 짧게 되짚고 대기로(10-29 사용자: 동작 사이가 뚝뚝 끊김). 예약 입력이 있으면 바로
function toIdle() {
  const prev = P.clip && P.clip.id;
  if (prev && !P.returning && !P.buf && P.hp > 0 && P.z <= 0 && needReturn(prev)) { P.returning = true; P.mode = 'act'; P.clip = null; const rs = retFrames(prev); play(prev, { seq: S(rs, 0.04), onEnd: () => { P.fadeOut = { id: prev, f: rs[rs.length - 1], until: P.t + 0.12, d: 0.12 }; toIdle0(); } }); return; }
  toIdle0();
}
// 동작 끝 → 대기 자세로 뚝 끊기는 줄(빌드가 잰 이음새 seam ≥ 0.35)은 끝 장에서 두 장 거꾸로 짧게 되짚어 자세를 되돌린 뒤 대기(10-29 사용자: 동작 사이가 뚝뚝 끊김). 다음 입력을 예약했으면 바로 넘어감
const needReturn = (id?: Json) => id !== '20' && !!(CH.seam && CH.seam[id] >= 0.35 && A[id] && A[id].n >= 4);
// 되돌림 장은 빌드가 고른 「끝에서 거꾸로, 대기와 가장 닮은 장까지」(payload.ret, 최대 4장). 마지막에 0.12초 겹쳐 사라지게(P.fadeOut)
const retFrames = (id?: Json) => { const r = CH.ret && CH.ret[id], n = A[id].n; return r && r.length ? r.filter((f?: Json) => f < n) : [n - 2, Math.max(0, n - 4)]; };
function act(id?: Json, o: Json = {}) { P.mode = o.mode || 'act'; play(id, { ...o, onEnd: o.onEnd || (() => afterBuf(toIdle)) }); }
function reverseOut(id?: Json, frames?: Json, d?: Json, then?: Json) { P.mode = 'act'; play(id, { seq: S(frames, d), onEnd: then || (() => afterBuf(toIdle)) }); }
// 무기 있는 인물: 꺼내기(W) → 무기 자세 장. 무기 없는 인물: 꺼내기 없이 바로 겨눈 자세(W-1)
function ensureArmed(then?: Json) {
  if (P.armed) return then();
  P.combat = true;
  if (!has('W')) { P.armed = true; return then(); }
  sfx('reload'); act('W', { seq: S(R(0, PK('weapon', 'W')), 0.04), onEnd: () => { P.armed = true; then(); } });
}
function afterBuf(fallback?: Json) {
  const b = P.buf; P.buf = null;
  if (b === 'light') return light();
  if (b === 'heavy') return heavy();
  if (b === 'dodge') return dodge();
  if (b === 'jump') return jump();
  fallback();
}
const ARMOR = new Set(['12', '13', '23', '24', '25']);
const armored = () => P.wakeArmor > 0 || (P.clip && (P.clip.id === '20' || ARMOR.has(P.clip.id) || P.skArmor) && (P.mode === 'act' || P.mode === 'charge'));

// ── 공격 ──
const comboIds = () => ['9', '10', '11'].filter(has);
function light() {
  const L = comboIds(); if (!L.length) return;
  P.combat = true; P.armed = false;
  if (P.combo >= L.length) P.combo = 0;
  const id = L[P.combo]; P.combo++; sfx('whiff'); P.connected = false;
  pushP(170, 900);
  act(id, { seq: atkSeq(id, false), onEnd: () => {
    if (P.combo >= L.length) { P.blowWin = P.t + 0.35; P.combo = 0; return afterBuf(toIdle); }
    if (P.buf) return afterBuf(toIdle);
    P.mode = 'chain'; P.chainT = 0.26;
  } });
}
function heavy() {
  if (!has('12')) return light();
  const prev = P.combo || (P.t < (P.blowWin || 0) ? 3 : 0);
  const kind = prev === 2 ? 'launch' : prev >= 3 ? 'blow' : 'stun';
  sfx('whiff', { strength: 2 }); P.combat = true; P.armed = false; P.combo = 0; pushP(140, 700);
  act('12', { seq: atkSeq('12', true).map(e => e.ev ? { ...e, kind } : e) });
}
function chainExpire() { const id = P.clip!.id; P.combo = 0; reverseOut(id, R(A[id].n - 1, 0), 0.03); }
function slide() {
  if (!has('13')) return light();
  P.combat = true; P.combo = 0; pushP(840, 1150); P.slideHit = false;
  act('13', { seq: atkSeq('13', false).map((e, i, all) => i === 1 ? { ...e, ev: 'dust' } : (i >= 2 && i <= all.length - 2) ? { ...e, ev: 'slideHit' } : e) });
}
function dodge() {
  P.combat = true; P.combo = 0;
  let dx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0), dy = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
  if (!dx && !dy) dx = -P.face;
  if (dx && dx === P.face && P.prevFace === -dx && P.t - P.faceT < 0.3) P.face = P.prevFace;
  const fwd = dx * P.face > 0, len = Math.hypot(dx, dy);
  const id = fwd && has('16_1') ? '16_1' : has('16') ? '16' : null; if (!id) return;
  // 회피는 2번까지 모아 두고 하나 쓰면 0.8초 뒤 다시 찬다(10-30 사용자: 연타하면 0.24초 캔슬 < 무적 0.3초라 무적이 끊기지 않던 것). 퍽은 dodgeMax·dodgeCd를 바꾼다
  if (P.dodgeN < 1) return;
  P.dodgeN--; if (P.dodgeT <= 0) P.dodgeT = P.dodgeCd;
  sfx('evade'); P.dodgeV = { x: dx / len * 780, y: dy / len * 520 }; P.inv = 0.3; P.ghostT = 0.2;
  P.pvx = 0; P.pdec = 0;
  const n = nOf(id), d = 0.32 / n;
  act(id, { seq: S(R(0, n - 1), d).map((e?: Json, i?: Json) => i >= n - 2 ? { ...e, cancel: true } : e), onEnd: () => { P.dodgeV = null; afterBuf(toIdle); } });
}
// 원거리: 반복 구간이 있으면 첫 장 = 발사, 끝 장에서 누르고 있으면 되돌아감. 없으면 그림 불꽃 장(또는 뻗은 장)마다 발사
function shoot() {
  if (!has('15')) return;
  if ((BAL().cd || {}).shot) { if ((P.cd.shot || 0) > P.t) { if ((BAL().cd.shot) >= 1) cdReady('shot'); return; } setCd('shot'); }   // 연사 무기 말고는 한 발씩 + 간격(1초 이상만 「쿨타임」 표시)
  const a = A['15'];
  if (P.overT > 0) return ensureArmed(() => act('15', { seq: [...S(R(0, Math.min(3, a.n - 1)), 0.035), { f: Math.min(3, a.n - 1), d: 0.25, fn: () => { sfx('empty'); const p = muzzle(); steam(p.x, p.y, 1); } }, ...S(R(Math.min(4, a.n - 1), a.n - 1), 0.05)] }));
  ensureArmed(() => {
    const lp = LP('15'), s: Json[] = [];
    if (lp) {
      const a0 = lp[0], a1 = lp[lp.length - 1];
      for (let f = 0; f < a0; f++) s.push({ f, d: 0.035 });
      const to = s.length;
      const fl = R(a0, a1).filter(f => a.flash[f]), fire = fl.length ? fl : [a0];   // 그림에 총구 불꽃이 있는 장마다 한 발(10-28 블라렛 쌍권총: 번갈아 쏘는데 1발만 나감)
      for (let f = a0; f <= a1; f++) s.push({ f, d: 0.06, ev: fire.includes(f) ? 'shot' : undefined });
      if (isHot()) s[s.length - 1].rep = { key: 'shoot', to };   // 누른 채 연사는 과열 있는 연사 무기만(사용자 2026-10-26)
      for (let f = a1 + 1; f < a.n; f++) s.push({ f, d: 0.05 });
    } else {
      const fire = a.flash.some(Boolean) ? a.flash.map((v?: Json, i?: Json) => v ? i : -1).filter((i?: Json) => i >= 0) : [impactOf('15')];
      for (let f = 0; f < a.n; f++) s.push({ f, d: fire.includes(f) ? 0.08 : 0.045, ev: fire.includes(f) ? 'shot' : undefined });
    }
    act('15', { seq: s });
  });
}

// ── 고유기술·충전·필살기: 인물 설정 skills 로 돈다 ──
// 기술 = { name, anim, fps, armed, armor:[a,b], move, events:[{f, to, rep, d, alt, fx:[부품…]}] } (장 번호는 1부터)
function skillSeq(sp?: Json) {
  const id = has(sp.anim) ? sp.anim : idleId(), a = A[id], d0 = 1 / (sp.fps || 10), s: Json[] = [];
  const evs = (sp.events || []).map((e?: Json) => ({ ...e, f0: cf(id, e.f - 1), to0: e.to ? cf(id, e.to - 1) : null }));
  const arm = sp.armor ? [sp.armor[0] - 1, sp.armor[1] - 1] : null;
  for (let f = 0; f < a.n; f++) {
    const e = evs.find((e?: Json) => f === e.f0 || (e.to0 != null && f >= e.f0 && f <= e.to0));
    if (e && e.loop && e.to0 != null) { if (f === e.f0) for (let k = 0; k < e.loop; k++) for (let g = e.f0; g <= e.to0; g++) s.push({ f: g, d: e.d || d0, ev: g === e.f0 ? 'run' : undefined, list: e.fx }); else if (f <= e.to0) continue; }
    else if (e && e.alt && e.to0 != null) { if (f === e.f0) for (let k = 0; k < (e.rep || 4) * 2; k++) s.push({ f: k % 2 ? e.to0 : e.f0, d: e.d || 0.055, ev: 'run', list: e.fx }); else if (f <= e.to0) continue; }
    else if (e) { for (let k = 0; k < (e.rep || 1); k++) s.push({ f, d: e.d || (e.hold ? e.hold : d0), ev: 'run', list: e.fx }); }
    else s.push({ f, d: d0 });
    if (arm) s[s.length - 1].armor = f >= arm[0] && f <= arm[1];
  }
  if (sp.rev) s.reverse();   // 거꾸로(견착 자세 풀기 등)
  if (sp.upto) s.splice(sp.upto);   // 앞 몇 장만(1부터 센 장 수)
  return { id, s };
}
function doSkill(sp?: Json, then?: Json) {
  if (!sp) return;
  const go = () => {
    P.combo = 0; P.combat = true;
    const { id, s } = skillSeq(sp);
    s.forEach(e => { const fn = e.fn; e.fn = () => { P.skArmor = !!e.armor || !!sp.armorAll; fn && fn(); }; });
    if (sp.push) pushP(sp.push, 900);
    act(id, { seq: s, onEnd: () => { P.skArmor = false; if (then) return then(); if (!(CH.armed && sp.armed)) P.armed = false; afterBuf(toIdle); } });
  };
  if (sp.armed) ensureArmed(go); else { P.armed = false; go(); }
}
// 여러 동작을 잇는 기술(steps): 고유기술·둘째 기술·NPC 특수공격도 필살기처럼 차례로
function runSkill(sp?: Json, then?: Json) { if (!sp) return; P.hitVfx = sp.hitVfx ? { n: sp.hitVfx, s: sp.hitScale || 1, until: P.t + (sp.hitFor || 2.5), last: -9 } : null; const steps = sp.steps || [sp]; const go = (i?: Json) => i >= steps.length ? (then ? then() : (P.skArmor = false, (CH.armed && sp.armed) || (P.armed = false), afterBuf(toIdle))) : doSkill({ ...steps[i], armed: steps[i].armed ?? sp.armed, armor: steps[i].armor ?? (i ? undefined : sp.armor) }, () => go(i + 1)); go(0); }
function skill() { if (!cdReady('skill')) return; setCd('skill'); const sp = CH.skills.skill; if (sp && sp.alt && P.buffT > 0 && CH.skills[sp.alt]) return runSkill(CH.skills[sp.alt]); runSkill(sp); }
function skill2() { if (!CH.skills.skill2 || !cdReady('skill2')) return; setCd('skill2'); runSkill(CH.skills.skill2); }
function superMove() {
  const sp = CH.skills.super; if (!sp) return;
  if (!spReady()) return;
  P.inSuper = true; P.noGain = P.t + 8; P.hitVfx = null;
  // 컷인: 화면 정지 + 요원 색 띠 + 기술명
  sfx('super'); cut = 1.1; dark = 1.6; flash = 0.12; hitstop = 0.9;
  const steps = sp.steps || [sp];
  const run = (i?: Json) => { if (i >= steps.length) { P.inSuper = false; P.inv = 0; return afterBuf(toIdle); } doSkill({ armorAll: true, ...steps[i], armed: steps[i].armed ?? sp.armed }, () => run(i + 1)); };
  P.inv = 30; later(0.85, () => run(0));   // 컷인이 걷힌 뒤 몸동작·효과
}
const CH_COL = ['rgba(255,255,255,.8)', '#fff6c0', '#8fdcff', '#c89bff'];
const chLevels = () => (CH.skills.charge && CH.skills.charge.levels) || [0.5, 1.2];
const chLv = () => chLevels().filter((t?: Json) => P.charge >= t).length;
function charge() {
  const sp = CH.skills.charge; if (!sp) return;   // 충전기는 쿨타임 없음(사용자 2026-10-26)
  const go = () => {
    P.mode = 'charge'; P.charge = 0; P.chargeShown = 0;
    const id = has(sp.hold) ? sp.hold : idleId(), lp = LP(id) || R(Math.min(3, nOf(id) - 1), nOf(id) - 1), s: Json[] = [];
    for (let f = 0; f < lp[0]; f++) s.push({ f, d: 0.055 });
    const from = s.length; for (const f of lp) s.push({ f, d: 0.11 });
    play(id, { seq: s, loopFrom: from });
  };
  if (sp.armed) ensureArmed(go); else { P.armed = false; P.combat = true; go(); }
}
function release() {
  const sp = CH.skills.charge, lv = chLv(), list = (sp.lv || {})[lv] || [];
  { const hv = (sp.hitVfx || {})[lv]; P.hitVfx = hv ? { n: hv, s: (sp.hitScale || {})[lv] || 1, until: P.t + 2.5, last: -9 } : null; }   // 충전 단계별 전용 타격 그림(10-29)
  P.chargeLv = lv; P.relMz = muzzle();
  const rl = (sp.releaseLv && sp.releaseLv[lv]) || sp.release, rid = has(rl) ? rl : idleId(), n = nOf(rid);
  if (sp.fireOnRelease) { runFx(list, { o: P.relMz, lv }); P.skArmor = true; return act(rid, { seq: S(R(Math.min(1, n - 1), n - 1), 0.06), onEnd: () => { P.skArmor = false; afterBuf(toIdle); } }); }
  doSkill({ anim: rid, fps: sp.fps || 12, armed: sp.armed, armorAll: true, events: [{ f: (sp.fireLv && sp.fireLv[lv]) || sp.fire || 2, fx: list }] });
}

// ── 이동·점프 ──
// 방향 점프(7): 고른 꼭대기 장을 기준으로 오름·꼭대기·내림·착지 장을 고름
const jf = () => { const n = nOf('7'), ap = PK('apex', '7'); return { up: [0, Math.min(1, n - 1)], rise: Math.max(1, ap - 1), top: ap, fall: Math.max(ap, Math.min(ap + 1, n - 3)), fall2: Math.max(ap, Math.min(ap + 2, n - 3)), land: [Math.max(0, n - 2), n - 1] }; };
function jump() {
  if (!has('7')) return;
  P.mode = 'air'; P.z = 0; P.vz = 0; P.jumps = 1; P.airAtk = false; P.spin = 0;
  P.airVX = (down('run') || P.runLatch) ? 430 : 250; P.takeoff = 0.06; sfx('jump');
  play('7', { seq: S(jf().up, 0.03) });
}
function doubleJump() {
  const j = jf();
  sfx('jump', { pitch: 1.35 }); P.jumps = 2; P.vz = 1040; const up = R(Math.min(1, j.top), j.top); P.spin = up.length * 0.045; play('7', { seq: S(up, 0.045) });   // 2단 점프: 오르는 장을 다 거쳐 부드럽게(10-28 게슈간 뚝뚝 끊김)
  if (!vfx('double_jump', P.x, P.y - P.z + 2, 2.2)) fx.push({ k: 'burst', x: P.x, y: P.y - P.z + 4, t: 0.3, t0: 0.3 });
  ring(P.x, P.y - P.z + 4, 70, 0.25, 'rgba(220,240,255,.9)', 4, 0.35);
}
function jumpAttack(heavyKind?: Json) {
  if (!has('14')) return;
  P.airAtk = true; P.airHit = false; P.airHeavy = !!heavyKind;
  // 맞는 장 하나만 보던 것 → 뻗은 장부터 착지까지 닿으면 한 번 맞음(10-28 「점프 공격 타점이 안 맞음」). 판정은 갱신 쪽(air)에서
  play('14', { seq: atkSeq('14', heavyKind).map((e, i, s) => { const { ev, ...r } = e; return { ...r, d: i === s.length - 1 ? 9 : e.d }; }) });
}
function land() {
  sfx('land'); P.z = 0; P.vz = 0; P.airAtk = false; shake = Math.max(shake, 2); if (!vfx('land_dust', P.x, P.y, 2.2, { bottom: true })) dust(P.x, P.y, 5);
  P.mode = 'act';
  const j = jf();
  play('7', { seq: [{ f: j.land[0], d: 0.045, cancel: true }, { f: j.land[1], d: 0.05, cancel: true }], onEnd: toIdle });
}

// ── 피격·반응 ──
function takeHit(kind?: Json) {
  if (P.mode === 'dead') return;
  if (P.mode === 'air') { P.airAtk = false; P.spin = 0; }
  if (P.inv > 0) { fx.push({ k: 'num', x: P.x, y: P.y - 230, v: '회피', t: 0.6 }); return; }
  if (P.mode === 'block') { sfx('guard'); shake = 4; if (!vfx('guard_block', P.x + P.face * 50 * K(P.y), P.y - 140 * K(P.y), 2.2, { flip: P.face < 0 })) sparks(P.x + P.face * 50, P.y - 140, 8, false, '#9fd0ff'); pushP(-200, 1200); return; }
  if (armored()) { gainSp(5); sfx('armor'); P.armorT = 0.28; hitstop = 0.06; shake = 6; return; }
  if (P.mode === 'charge') P.charge = 0;
  if (kind === 'knock') return knock();
  if (kind === 'low') return hitAs('18_1', -300, 12, 0.09);
  if (kind === 'push') return hitAs('18_2', -620, 16, 0.06);
  if (kind === 'launch') return launched();
  hit();
}
// 공격 종류 → 피격 동작(사용자 2026-10-25): 약 = 맞기 상단(18) · 강 = 맞기 하단(18-1) · 날리기 = 크게 밀려나기(18-2) · 띄우기 = 띄워지기(18-3) · 다운 = 쓰러지기(19) · 누운 채 = 움찔(43) · HP 0 = 사망(44 서서 / 45 누워서)
function hitAs(id?: Json, push?: Json, dmg?: Json, d = 0.055) { if (!has(id)) return hit(); gainSp(10); sfx('hurt', { strength: 2 }); P.combat = true; P.combo = 0; P.armed = false; pushP(push, 1100); flash = 0.05; shake = Math.max(shake, 6); P.hp = Math.max(1, P.hp - dmg); act(id, { seq: [{ f: 0, d: 0.02 }, ...S(R(1, nOf(id) - 1), d)] }); }
const LIE19 = () => CH.lie19 && CH.lie19.length ? CH.lie19.map((f?: Json) => cf('19', f - 1)) : LP('19');   // 누운 반복 = 빌드가 잰 「다 누운 장」만(10-29: 표의 반복 구간에 무릎 세운 장이 섞여 활어처럼 퍼덕임)
function lieLoop() { const n = nOf('19'), lp = LIE19() || [n - 1]; if (P.mode !== 'down') P.downAt = P.t; P.mode = 'down'; play('19', { seq: lp.map((f?: Json) => ({ f, d: lp.length <= 2 ? 0.6 : 0.3 })), loopFrom: 0 }); }
function launched() {
  if (!has('18_3')) return knock();
  gainSp(20); sfx('hurt', { strength: 2 }); P.combat = true; P.combo = 0; P.armed = false; pushP(-380, 700); shake = 8;
  P.mode = 'act'; P.knockT = 0; play('18_3', { seq: S(R(0, nOf('18_3') - 1), 0.07), onEnd: () => { dust(P.x, P.y, 6, 1.2); sfx('down'); lieLoop(); } });
}
function flinch() {   // 누운 채 맞음: 움찔했다 다시 누워 숨쉬기
  flash = 0.05; shake = Math.max(shake, 4); sfx('hurt');
  if (!has('43')) return;
  play('43', { seq: S(R(0, nOf('43') - 1), 0.07), onEnd: () => { if (P.mode === 'down') lieLoop(); } });
}
function die() {
  if (P.mode === 'dead') { P.mode = 'ground'; P.hp = 100; P.dying = false; return toIdle(); }   // 테스트룸: 다시 누르면 되살림
  const lying = P.mode === 'down' || P.mode === 'belly', id = lying ? '45' : '44';
  if (!has(id)) return;
  sfx('hurt', { strength: 3 }); P.hp = 0; P.combat = false; P.armed = false; P.knockT = 0; P.mode = 'dead';
  play(id, { seq: S(R(0, nOf(id) - 1), lying ? 0.12 : 0.08), onEnd: () => fx.push({ k: 'num', x: P.x - 24, y: P.y - 60, v: '사망', t: 1.5 }) });
}
function hit() { if (!has('18')) return; gainSp(10); sfx('hurt'); P.combat = true; P.combo = 0; P.armed = false; pushP(-280, 1400); flash = 0.05; act('18', { seq: [{ f: 0, d: 0.02 }, ...S(R(1, A['18'].n - 1), 0.055)] }); }
// 날아가 쓰러지기(19): 반복 구간(누워 숨) 앞까지 쓰러지고, 누운 채 반복
function knock() {
  if (!has('19')) return hit();
  gainSp(20); sfx('hurt', { strength: 2 }); P.combat = true; P.combo = 0; P.armed = false; if (CH.fallRev) P.face = -P.face; pushP(CH.fallRev ? 560 : -560, 650);   // fallRev: 19가 앞으로 엎어지게 그려진 인물 → 몸을 돌려 맞은 반대쪽에 머리가 떨어지게(10-28 이성해 등) shake = 8;
  const n = nOf('19'), lp = LIE19() || [n - 1], fall = R(0, Math.max(0, lp[0] - 1));
  P.mode = 'act';
  const dustAt = Math.max(1, Math.round(fall.length * 0.65));
  play('19', { seq: [...S(fall, 0.07).map((e?: Json, i?: Json) => i === dustAt ? { ...e, ev: 'dust' } : e), ...lp.map((f?: Json) => ({ f, d: lp.length <= 2 ? 0.6 : 0.3 }))], loopFrom: fall.length });
  P.knockT = fall.length * 0.07;
}
function getUp() { if (!has('20')) return toIdle(); sfx('wakeup'); P.knockT = 0; act('20', { seq: S(R(0, nOf('20') - 1), 0.06), onEnd: () => { P.wakeArmor = 0.6; afterBuf(toIdle); } }); }
function belly() {
  if (!has('38')) return;
  if (P.mode === 'down' && (CH.turn19 || []).includes('38')) P.face = -P.face;   // 기기 첫 장이 누운 장과 좌우 반대로 그려짐 → 몸을 돌려 머리 자리 유지(10-28 이기석)
  P.mode = 'belly';
  if (has('38_1')) return play('38', { seq: S(R(0, Math.min(4, nOf('38') - 1)), 0.1), onEnd: () => { if (P.mode === 'belly') play('38_1', { seq: S(R(0, nOf('38_1') - 2), 0.12), loopFrom: 0 }); } });   // 38은 배 깐 장(5장)까지, 이어 38_1 포복 반복(끝 장 = 첫 장이라 뺌)
  const lp = LP('38') || R(Math.min(4, nOf('38') - 1), nOf('38') - 1);
  play('38', { seq: [...S(R(0, lp[0] - 1), 0.11), ...S(lp, 0.1)], loopFrom: lp[0] });
}
function stun() {
  if (!has('21')) return;
  P.combat = true; P.combo = 0; P.armed = false; P.mode = 'stun'; P.stunT = 2.6;
  const lp = LP('21') || R(1, nOf('21') - 1);
  play('21', { seq: [...S(R(0, lp[0] - 1), 0.05), ...S(lp, 0.1)], loopFrom: lp[0] });
}
function emote(id?: Json, fps?: Json, o: Json = {}) { if (!has(id)) return; act(id, { seq: S(R(0, A[id].n - 1), 1 / fps), ...o }); }
const sitLp = () => LP('39') || R(Math.max(0, nOf('39') - 5), nOf('39') - 1);
function sit() { if (!has('39')) return; P.mode = 'sit'; const lp = sitLp(); play('39', { seq: [...S(R(0, lp[0] - 1), 0.05), ...S(lp, 0.13)], loopFrom: lp[0] }); }
const crLp = () => LP('41') || R(Math.min(4, nOf('41') - 1), nOf('41') - 1);
function crouch() { if (!has('41')) return; P.mode = 'crouch'; const lp = crLp(); play('41', { seq: [...S(R(0, lp[0] - 1), 0.08), ...S(lp, 0.11)], loopFrom: lp[0] }); }

// ── 의자 앉기(3판 정면 60 · 옆 96 · 후면 61) — 라이브 seat: 4틱(0.133초)마다 한 장, E로 거꾸로 일어남 ──
const SEATS: Json[] = SEAT_TABLE;   // 앉기 방향 표: fighter/seats.ts (필드 그림과 같이 씀)
const SEAT_LOOP = SEAT_LOOP_IDS;   // 「반복, 첫 장 유지」 줄
const SEAT_F = 0.133;
// 의자 맞춤 {dx(앞쪽 +), dy(아래 +), s}: 설정 chars/<키>.json "chair" > 이 브라우저에서 미세 조정한 값 > 빌드 자동값(chairfit.py)
/** 의자 맞추기(시험장 「의자 맞추기」 칸): 방향별 { dx, dy, s } 고친 값. 비어 있으면 설정값(chairs/<키>.json → CH.chair) 그대로 */
const chairEdits: Record<string, Json> = {};
const chairEdit = (): Record<string, Json> => chairEdits;
let seatIdx = -1, showChair = true;
function chairFit(dir?: Json, line?: Json) { return seatFit(CH, dir, line, chairEdit()); }   // 줄마다(기대 쉬기 73 등) 따로 맞춘 값이 있으면 그것 (fighter/seats.ts)
function seatIdle() { const s = P.seat; P.mode = 'seat'; const n = nOf(s.sit); play(s.sit, { seq: [{ f: n - 1, d: 9 }], loopFrom: 0 }); P.clip!.breathe = true; }
function sitChair() {
  const okSeat = (s?: Json) => has(s.sit) && !(CH.noBackSit && s.dir === 'back');   // 후면 앉기 그림이 실패한 인물(앉지 않고 섬)은 후면 자리를 건너뜀(10-29 아벤샤)
  for (let k = 1; k <= SEATS.length; k++) { const s = SEATS[(seatIdx + k) % SEATS.length]; if (okSeat(s)) { seatIdx = SEATS.indexOf(s); break; } }
  const s = SEATS[seatIdx]; if (!s || !okSeat(s)) return;
  P.combat = false; P.armed = false; P.mode = 'seat'; P.seat = { ...s, x: P.x, y: P.y, face: P.face };
  play(s.sit, { seq: S(R(0, nOf(s.sit) - 1), SEAT_F), onEnd: seatIdle });
}
function rise(fast?: Json) { const s = P.seat; if (!s) return toIdle(); const n = nOf(s.sit); reverseOut(s.sit, R(n - 1, 0), fast ? 0.04 : SEAT_F, () => { P.seat = null; if (fast === 'hit') hit(); else toIdle(); }); P.mode = 'seatUp'; }
function seatAct(kind?: Json) {
  const s = P.seat, id = s && s.acts[kind];
  if (!id || !has(id)) {   // 지금 방향에 없는 줄이면 그 줄이 있는 방향으로 앉은 뒤 이어서(정면 전용 줄 등)
    const t = SEATS.find(t => t.acts[kind] && has(t.acts[kind]) && has(t.sit)); if (!t) return;
    P.seat = null; sitAt(t.dir); later(nOf(t.sit) * SEAT_F + 0.15, () => P.seat && P.seat.dir === t.dir && seatAct(kind)); return;
  }
  const n = nOf(id);
  if (SEAT_LOOP.has(id)) { play(id, { seq: S(R(0, n - 1), 0.16), loopFrom: 0 }); P.clip!.breathe = false; }
  else play(id, { seq: S(R(0, n - 1), 0.14), onEnd: seatIdle });
  P.mode = 'seat';
}
// 앉은 채 맞기: 약 = 앉기 거꾸로 빠르게 → 맞기 / 강 = 옆이면 굴러떨어지기(169) → 누움, 정면·후면이면 바로 쓰러지기(10-27 결정)
function seatHit(strong?: Json) {
  const s = P.seat;
  if (!strong) return rise('hit');
  P.seat = null;
  if (s.dir === 'side' && has('169')) { sfx('hurt', { strength: 2 }); shake = 8; P.mode = 'act'; play('169', { seq: S(R(0, nOf('169') - 1), 0.08), onEnd: () => { dust(P.x, P.y, 6, 1.2); sfx('down'); lieLoop(); } }); return; }
  P.mode = 'ground'; knock();
}
// ── 장면 시험(10-28): 여러 줄을 이어 틂. 단계 {id, n(되풀이), rev(거꾸로), hold(끝 장 머무는 초), d(한 장 초)} ──
function runScene(steps?: Json, label?: Json) {
  P.seat = null; P.z = 0; P.combat = false; P.armed = false; P.mode = 'act'; P.scene = label; let i = 0;
  const next = () => {
    if (P.scene !== label) return;
    while (i < steps.length && !has(steps[i].id)) i++;
    if (i >= steps.length) { P.scene = null; return toIdle(); }
    const st = steps[i++], n = nOf(st.id), fr = st.rev ? R(n - 1, 0) : R(0, n - 1), seq: Json[] = [];
    for (let k = 0; k < (st.n || 1); k++) seq.push(...S(fr, st.d || 0.13));
    if (st.hold) seq.push({ f: fr[fr.length - 1], d: st.hold });
    P.mode = 'act'; play(st.id, { seq, onEnd: next });
  };
  if (label) fx.push({ k: 'num', x: P.x - 60, y: P.y - 280 * K(P.y), v: label, t: 1.4 });
  next();
}
const SCENES = [
  ['의자', [['정면 앉기', () => sitAt('front')], ['옆 앉기', () => sitAt('side')], ['후면 앉기', () => sitAt('back')],
    ['앉아 수다', () => seatAct('talk')], ['앉아 먹기', () => seatAct('eat')], ['앉아 마시기', () => seatAct('drink')], ['앉아 타자', () => seatAct('type')],
    ['앉아 졸기', () => seatAct('doze')], ['기대 쉬기', () => seatAct('lean')], ['앉아 일하다 고개 들어 끄덕(정면)', () => seatAct('nod')], ['앉아 손 작업(정면)', () => seatAct('craft')], ['앉아 폰 보기(정면)', () => seatAct('phone')], ['앉아 책 읽기(정면)', () => seatAct('book')], ['앉아 신문 읽기(정면)', () => seatAct('paper')], ['앉아 통화(정면)', () => seatAct('call')], ['앉은 채 돌아보기(후면)', () => seatAct('look')], ['일어나기', () => P.seat && rise()],
    ['앉은 채 맞기(약)', () => P.seat && seatHit(false)], ['앉은 채 맞기(강) · 옆 = 굴러떨어지기', () => P.seat && seatHit(true)]], () => has('60') || has('96')],
  ['샤워', [['한 번에(벗기→걷기→물→씻기→입기)', () => runScene([{ id: 'SH_A', d: 0.12 }, { id: 'SH_B', n: 2 }, { id: 'SH_D', n: 3 }, { id: 'SH_E', n: 3 }, { id: 'SH_A', rev: true, d: 0.1 }], '샤워')],
    ['옷 벗기', () => runScene([{ id: 'SH_A', d: 0.12, hold: 0.6 }], '옷 벗기')], ['맨몸 걷기', () => runScene([{ id: 'SH_B', n: 4 }])], ['물 맞으며 쉬기', () => runScene([{ id: 'SH_D', n: 4 }])],
    ['몸 씻기', () => runScene([{ id: 'SH_E', n: 4 }])], ['옷 입기(벗기 거꾸로)', () => runScene([{ id: 'SH_A', rev: true, d: 0.1 }], '옷 입기')]], () => has('SH_A')],
  ['화장실', [['남 소변(서서)', () => runScene([{ id: '57', hold: 0.4 }, { id: '100', n: 2 }, { id: '57', hold: 0.4 }], '소변')],
    ['앉아 볼일', () => runScene([{ id: '101' }, { id: '102', n: 4 }, { id: '103' }], '볼일')], ['손 씻기', () => runScene([{ id: '57', hold: 1.0 }, { id: '104' }], '손 씻기')]], () => has('101') || has('100')],
  ['눕기', [['눕기 → 쉬기·졸기', () => runScene([{ id: '75' }, { id: '76', n: 4, d: 0.2 }, { id: '75', rev: true }])], ['눕기 → 아파하기', () => runScene([{ id: '75' }, { id: '77', n: 2 }, { id: '75', rev: true }])]], () => has('75')],
  ['피격·사망', [['맞기', () => takeHit('hit')], ['맞기 하단', () => takeHit('low')], ['크게 밀려나기', () => takeHit('push')], ['띄워지기', () => takeHit('launch')], ['날아가 쓰러지기', () => takeHit('knock')],
    ['누운 채 움찔', () => P.mode === 'down' ? flinch() : (knock(), later(1.2, flinch))], ['일어나기', () => P.mode === 'down' && getUp()], ['스턴', () => stun()],
    ['사망(서서)', () => { if (P.mode === 'dead') die(); die(); }], ['사망(누워서)', () => { if (P.mode === 'dead') die(); knock(); later(1.4, () => { P.mode = 'down'; die(); }); }], ['되살리기', () => P.mode === 'dead' && die()]], () => true],
];
// 그 인물에게 줄이 없어 아무것도 안 하는 버튼은 숨김(사용자 10-28: 이길환 끄덕·손 작업)
function sitAt(dir?: Json) { if (P.seat) return; if (dir === 'back' && CH.noBackSit) dir = 'side'; seatIdx = SEATS.findIndex(s => s.dir === dir) - 1; P.scene = null; sitChair(); }

// ── 생활·직무 줄: , . 로 차례로 틀기(목록 단추와 같음) ──
let lifeI = -1;
const lifeIds = () => Object.keys(A).filter(id => /^\d+/.test(id) && parseInt(id) >= 50 && id !== '169').sort((a, b) => parseFloat(a.replace('_', '.')) - parseFloat(b.replace('_', '.')));
function playLife(id?: Json) {
  if (!A[id]) return;
  P.seat = null; P.z = 0; P.combat = false; P.armed = false;
  const n = nOf(id);
  const lp = LP(id);
  act(id, { seq: lp ? [...S(R(0, Math.max(0, lp[0] - 1)), 0.13), ...S(lp, 0.13), ...S(lp, 0.13), ...S(lp, 0.13)] : S(R(0, n - 1), 0.13) });
  fx.push({ k: 'num', x: P.x - 60, y: P.y - 270 * K(P.y), v: `${id} ${A[id].name}`, t: 1.6 });
}
function stepLife(d?: Json) { const L = lifeIds(); if (!L.length) return; lifeI = (lifeI + d + L.length) % L.length; playLife(L[lifeI]); }

function onPress(a?: Json) {
  if (a === 'run') { runT = performance.now(); return; }
  if (!CK) return;
  if (a === 'pause') { paused = !paused; return; }
  if (a === 'lifePrev' || a === 'lifeNext') { if (P.mode !== 'dead') stepLife(a === 'lifeNext' ? 1 : -1); return; }
  let dbl = false;
  if (a === 'left' || a === 'right' || a === 'down') { const now = performance.now(); dbl = now - (P.lastTap[a] || 0) < 260; if (dbl && a !== 'down') P.runLatch = true; P.lastTap[a] = now; }
  // 앉은 자리
  if (P.mode === 'seat' || P.mode === 'seatUp') {
    if (P.mode === 'seatUp') return;
    if (['seat', 'pick', 'up', 'jump'].includes(a)) return rise();
    if (a === 'hit') return seatHit(false);
    if (['hitLow', 'push', 'launch', 'knock'].includes(a)) return seatHit(true);
    const SA: Record<string, string> = { respond: 'talk', talk: 'eat', nod: 'drink', shake: 'type', angry: 'doze', happy: 'lean' };
    if (SA[a]) return seatAct(SA[a]);
    if (a !== 'die') return;
  }
  if (a === 'heal' && P.mode === 'ground') { emote('26', 7); later(0.5, () => FX.heal({ v: 40 })); return; }
  if (a === 'drop') { items.push({ x: P.x + P.face * 120, y: P.y, t0: P.t }); return; }
  if (a === 'status') { P.status = [null, 'status_poison', 'status_burn', 'status_shock'][([null, 'status_poison', 'status_burn', 'status_shock'].indexOf(P.status || null) + 1) % 4]; return; }
  if (a === 'dying') { P.dying = !P.dying; P.hp = P.dying ? 18 : 100; if (P.dying) sfx('hp:low'); return; }
  if (a === 'die') return die();
  if (P.mode === 'dead') return;
  if (a === 'hit' && P.mode === 'down') return flinch();
  if (['hit', 'knock', 'hitLow', 'push', 'launch'].includes(a)) { if (P.mode !== 'down' && P.mode !== 'belly') return takeHit(({ hit: 'hit', knock: 'knock', hitLow: 'low', push: 'push', launch: 'launch' } as Record<string, string>)[a]); }
  if ((P.mode === 'flee' || P.mode === 'back') && !['left', 'right', 'up', 'down', 'run'].includes(a)) toIdle();
  if (P.scene && ['left', 'right', 'up', 'down'].includes(a)) { P.scene = null; return toIdle(); }
  const m = P.mode;
  if (m === 'air') {
    if (a === 'jump' && P.jumps < 2) doubleJump();
    else if ((a === 'light' || a === 'heavy') && !P.airAtk) jumpAttack(a === 'heavy');
    return;
  }
  if (m === 'chain') {
    if (a === 'light') return light();
    if (a === 'heavy') return heavy();
    if (a === 'dodge') return dodge();
    if (a === 'jump') return jump();
    if (a === 'skill') return skillPress();
  }
  if (m === 'act') {
    const CANCEL_INTO: Record<string, () => void> = { skill: skillPress, super: superMove, shoot, charge, skill2 };
    if (CANCEL_INTO[a] && canCancel() && P.clip && ['9', '10', '11', '12', '13', '16', '16_1'].includes(P.clip.id)) { P.buf = null; return CANCEL_INTO[a](); }
    if (['light', 'heavy', 'dodge', 'jump'].includes(a)) {
      const id = P.clip ? P.clip.id : '';
      if (canCancel() && ['9', '10', '11', '12', '13', '16', '16_1', '7'].includes(id)) {
        if (id === '7') { if (a === 'jump') return jump(); }
        else if (id === '9' || id === '10') { P.buf = a; return; }
        else { P.buf = null; return a === 'light' ? light() : a === 'heavy' ? heavy() : a === 'dodge' ? dodge() : jump(); }
      }
      P.buf = a;
    }
    return;
  }
  // 기상 지연: 바닥에 닿고 wakeDelay(0.6초) 동안은 못 일어난다. 그동안 누른 키는 기억했다가 끝나면 일어난다(10-30 사용자 「벌떡벌떡 일어나면 되냐」). 누운 동안 무적은 그대로
  if (m === 'down' && P.t - (P.downAt ?? -9) < P.wakeDelay) { if (a !== 'hit') P.wakeBuf = a; return; }
  if (m === 'down') { if (a === 'crawl' || a === 'left' || a === 'right') return belly(); if (['jump', 'up', 'light', 'left', 'right', 'down', 'run'].includes(a)) return getUp(); return; }   // 누운 채 방향키·달리기도 일어나기(10-28: 쓰러진 뒤 「달리기가 안 됨」으로 보였음)
  if (m === 'belly') { if (a === 'jump' || a === 'crawl' || a === 'up') return getUp(); return; }
  if (m === 'stun') { P.stunT -= 0.18; return; }
  if (m === 'sit' || m === 'scoot') { if (['sit', 'jump', 'left', 'right', 'up', 'run'].includes(a)) reverseOut('39', R(Math.max(0, sitLp()[0] - 1), 0), 0.05); return; }   // 주저앉은 채 방향키·점프도 일어나기
  if (m === 'crouch' || m === 'crawl4') { if (a === 'crouch') { if (m === 'crawl4') toIdle(); else reverseOut('41', R(Math.max(0, crLp()[0] - 1), 0), 0.06); } return; }
  if (m !== 'ground') return;
  const running = down('run') || P.runLatch;
  const moving = down('left') || down('right') || down('up') || down('down');
  switch (a) {
    case 'jump': return jump();
    case 'light': return running && moving ? slide() : light();
    case 'heavy': return running && moving ? slide() : heavy();   // 뛰다 강공격도 돌진 공격(사용자 2026-10-25)
    case 'dodge': return dodge();
    case 'block': if (!has('17')) return; P.combat = true; P.armed = false; P.mode = 'block'; return play('17', { seq: S(R(0, nOf('17') - 1), 0.03) });
    case 'shoot': return shoot();
    case 'skill': return skillPress();
    case 'skill2': return skill2();
    case 'charge': return charge();
    case 'super': return superMove();
    case 'combat':
      if (P.armed) return;
      if (!has('3_0')) { P.combat = !P.combat; return toIdle(); }
      if (!P.combat) return act('3_0', { seq: S(R(0, PK('combat', '3_0')), 0.055), onEnd: () => { P.combat = true; toIdle(); } });
      return reverseOut('3_0', R(PK('combat', '3_0'), 0), 0.055, () => { P.combat = false; toIdle(); });
    case 'weapon':
      if (!P.armed) return ensureArmed(toIdle);
      if (!has('W')) { P.armed = false; return toIdle(); }
      return reverseOut('W', R(PK('weapon', 'W'), 0), 0.05, () => { P.armed = false; toIdle(); });
    case 'stun': return stun();
    case 'eat': return emote('26', 7);
    case 'respond': { const n = nOf('28'); return emote('28', 7, { seq: [...S(R(0, n - 2), 0.1), { f: n - 1, d: 0.6 }, ...S(R(n - 2, 0), 0.1)] }); }
    case 'talk': { const lp = LP('29') || R(0, nOf('29') - 1); return emote('29', 7, { seq: [...S(lp, 0.16), ...S(lp, 0.16), { f: 0, d: 0.3 }] }); }
    case 'nod': return emote('30', 8, { seq: S([...R(0, nOf('30') - 1), ...R(0, nOf('30') - 1)], 1 / 8) });
    case 'shake': return emote('31', 8, { seq: S([...R(0, nOf('31') - 1), ...R(0, nOf('31') - 1)], 1 / 8) });
    case 'angry': return emote('32', 9);
    case 'happy': return emote('35', 8);
    case 'surprise': { const n = nOf('34'); return emote('34', 8, { seq: [...S(R(0, Math.min(1, n - 1)), 0.06), { f: Math.min(2, n - 1), d: 0.35 }, ...S(R(Math.min(3, n - 1), n - 1), 0.12)] }); }
    case 'pick': { const it = items.findIndex(it => Math.abs(it.x - P.x) < 110 && Math.abs(it.y - P.y) < 40); if (it >= 0) { items.splice(it, 1); later(0.45, () => { sfx('pickup'); FX.heal({ v: 20 }); }); } return emote('27', 8); }
    case 'personal': return emote('2', 7);
    case 'notice': { const n = nOf('33'), top = Math.min(4, n - 1); fx.push({ k: 'icon', v: '!', t: 1.0 }); return act('33', { seq: [...S(R(0, top - 1), 0.07), { f: top, d: 0.45 }, ...S(R(top - 1, 0), 0.04)] }); }
    case 'sit': return sit();
    case 'crouch': return crouch();
    case 'seat': return sitChair();
  }
}
// 고유기술 키: 짧게 = 고유기술, 길게(0.25초) = 충전
function skillPress() { return skill(); }   // 기술(D)은 누르면 바로. 충전은 S 따로(사용자 2026-10-25 키 배치)
function onRelease(a?: Json) {
  if (a === 'run' && performance.now() - runT <= 180) return onPress('dodge');
  if (a === 'left' || a === 'right') { if (!down('left') && !down('right')) P.runLatch = false; }
  if (a === 'block' && P.mode === 'block') reverseOut('17', R(curF(), 0), 0.025);
  if ((a === 'charge' || a === 'skill') && P.mode === 'charge') return release();
}

// ── 매 장 ──
function updateFx(dt?: Json) {
  for (const e of fx) {
    e.t -= dt;
    if (e.k === 'spark') { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 1100 * dt; }
    else if (e.k === 'dust') { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.92; }
    else if (e.k === 'num') e.y -= 60 * dt;
    else if (e.k === 'blood') { if (!e.landed) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 1300 * dt; if (e.y >= e.g) { e.y = e.g; e.landed = true; e.t = Math.min(e.t, 2.2); } } }
    else if (e.k === 'steam' || e.k === 'smoke') { e.x += e.vx * dt; e.y += e.vy * dt; e.r += (e.k === 'smoke' ? 26 : 4) * dt; e.vx *= 0.97; }
    else if (e.k === 'mote') e.y += e.vy * dt;
    else if (e.k === 'bubble') { e.y += e.vy * dt; e.x += Math.sin(e.t * 9) * 12 * dt; }
    else if (e.k === 'fire') { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.9; e.vy *= 0.9; e.r += 60 * dt; }
    else if (e.k === 'drop') { if (e.y < e.g) { e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.vr * dt; } else e.y = e.g; }
    else if (e.k === 'proj') {
      e.x += e.dir * e.v * dt;
      if (e.fancy) { e.trail.push([e.x, e.y]); if (e.trail.length > 9) e.trail.shift(); }
      const dk = K(T.y);
      if (!!T && !e.done.has(1) && Math.abs(T.y - e.gy) < 60 && Math.abs(T.x - e.x) < 34 * dk && e.y > T.y - T.z - 240 * dk && e.y < T.y - T.z + 10) {
        e.done.add(1); strike(e.hit || { dmg: 8, kind: 'light' }, e.y);
        if (e.fancy) { vfx('x3-c-hit-spark-heavy', T.x, e.y, 1.1 * e.size, { center: true, flip: e.dir < 0, tint: e.c }); ring(T.x, e.y, 60 * e.size, 0.3, e.c, 4, 1); sparks(T.x, e.y, 12, true, e.c); shake = Math.max(shake, 7); }
        if (e.end) runFx(e.end, { pt: { x: T.x, y: T.y, z: T.z }, o: { x: e.x, y: e.y } });
        if (!e.pierce) e.t = 0;
      }
      if (e.x < VX0 - 40 || e.x > W + 40) e.t = 0;
    }
    else if (e.k === 'wave') {
      e.x += e.dir * e.v * dt; if (Math.random() < dt * 30) dust(e.x, e.y + (Math.random() - 0.5) * 120, 1, 1.4);
      if (!e.done && !!T && (T.x - e.x) * e.dir < 20 && (T.x - e.x) * e.dir > -60) { e.done = true; strike(e.hit || { dmg: 15, kind: 'blow' }); T.vx = e.dir * 1500; }
      if (e.x < VX0 - 300 || e.x > W + 300) e.t = 0;
    }
    else if (e.k === 'lob') {}
    else if (e.k === 'firewall' && Math.random() < dt * 40) fx.push({ k: 'fire', x: e.x + (Math.random() - 0.5) * e.w, y: e.y - Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: -250 - Math.random() * 300, r: 6 + Math.random() * 8, t: 0.5, t0: 0.6 });
    else if (e.k === 'carry') { if (P.clip !== e.clip) e.t = 0; }
    else if (e.k === 'toss') { if (e.t - dt <= 0 && e.then) { const pt = { x: e.x1, y: e.gy, z: 0 }; runFx(e.then, { pt }); e.then = null; } }
    else if (e.k === 'shell' || e.k === 'coin') { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 1400 * dt; if (e.y > e.g) { e.y = e.g; e.vy *= -0.35; e.vx *= 0.6; } }
  }
  for (const e of fx) if (e.k === 'timer' && e.t <= 0 && !e.done) { e.done = true; e.fn(); }
  fx = fx.filter(e => e.t > 0);
}
function update(dt?: Json) {
  P.t += dt;
  updateFx(dt);
  grayT = Math.max(0, grayT - dt); shake = Math.max(0, shake - 70 * dt); zoom = Math.max(0, zoom - 0.5 * dt); flash = Math.max(0, flash - dt); cut = Math.max(0, cut - dt); dark = Math.max(0, dark - dt);
  P.armorT = Math.max(0, P.armorT - dt); P.healT = Math.max(0, (P.healT || 0) - dt); P.buffT = Math.max(0, P.buffT - dt);
  if (P.vanish) { P.vanish.t += dt; if (P.vanish.mode === 'in' && P.vanish.t >= P.vanish.dur) P.vanish = null; }
  if (!CK) return;
  if (P.status === 'status_poison' && Math.random() < dt * 7) { const a = A[P.clip ? P.clip.id : idleId()] || A[idleId()], k = K(P.y); fx.push({ k: 'bubble', x: P.x + (Math.random() - 0.5) * 26 * k, y: P.y - P.z - (BASE(a) - a.top[curF()]) * k + 6, vy: -40 - Math.random() * 30, r: 2 + Math.random() * 2.5, t: 0.9 + Math.random() * 0.4, t0: 1.3 }); }
  if (P.hp <= 25 && P.mode !== 'dead' && Math.random() < dt * 0.6) vfx('blood_splat', P.x + (Math.random() - 0.5) * 30, P.y - (60 + Math.random() * 80) * K(P.y), 1.8, { flip: Math.random() < 0.5 });
  if (P.hp <= 25 && P.mode !== 'dead' && Math.random() < dt * 3.5) {
    const a = A[P.clip ? P.clip.id : idleId()] || A[idleId()], f = curF(), k = K(P.y);
    const top = P.y - P.z - (BASE(a) - a.top[Math.min(f, a.n - 1)]) * k, bot = P.y - P.z;
    const y = top + (bot - top) * (0.25 + Math.random() * 0.4);
    for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) fx.push({ k: 'blood', x: P.x + (Math.random() - 0.5) * 30 * k, y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, g: P.y + (Math.random() - 0.5) * 6, t: 3, s: 2 + Math.random() * 2.5 });
  }
  if (hitstop > 0) { hitstop -= dt; return; }
  // 고유기술 키를 길게 누르면 충전으로
  updateProxies(dt);
  tickClip(dt);
  // 공중에서 맞거나 다른 동작으로 넘어가도 떨어지게(10-28: 점프 중 맞으면 허공에 고정되던 버그). 점프(air) 모드는 따로 처리
  if (P.mode !== 'air' && P.z > 0) { P.vz = Math.min(P.vz || 0, 300) - 2700 * dt; P.z = Math.max(0, P.z + P.vz * dt); if (P.z === 0) { P.vz = 0; dust(P.x, P.y, 4, 1); sfx('land'); } }
  if (P.clip && (P.clip.id === 'SH_D' || P.clip.id === 'SH_E') && Math.random() < dt * 60) { const k = K(P.y); fx.push({ k: 'mote', x: P.x + (Math.random() - 0.5) * 70 * k, y: P.y - (230 + Math.random() * 40) * k, vy: 700 + Math.random() * 200, c: 'rgba(170,220,255,.8)', t: 0.3 }); }   // 샤워 물줄기(코드)
  P.inv = Math.max(0, P.inv - dt); P.wakeArmor = Math.max(0, (P.wakeArmor || 0) - dt);
  if (P.mode === 'down' && P.wakeBuf && P.t - (P.downAt ?? -9) >= P.wakeDelay) { const k = P.wakeBuf; P.wakeBuf = null; onPress(k); }
  else if (P.mode !== 'down') P.wakeBuf = null;
  if (P.dodgeN < P.dodgeMax) { P.dodgeT -= dt; if (P.dodgeT <= 0) { P.dodgeN++; P.dodgeT = P.dodgeN < P.dodgeMax ? P.dodgeCd : 0; } }
  if (P.overT > 0) { P.overT -= dt; P.heat = 100 * Math.max(0, P.overT) / 2.6; if (Math.random() < dt * 6) { const p = P.armed ? muzzle() : { x: P.x + P.face * 30 * K(P.y), y: P.y - 150 * K(P.y) }; steam(p.x, p.y, 1.2); } }
  else if (P.t - P.lastShot > 0.35) P.heat = Math.max(0, P.heat - 30 * dt);
  if (P.ghostT > 0) { P.ghostT -= dt; P.ghostN = (P.ghostN || 0) + dt; if (P.clip && P.ghostN > 0.05 && !(P.ghostN = 0)) fx.push({ k: 'ghost', id: P.clip.id, f: curF(), x: P.x, y: P.y, z: P.z, face: P.face, t: 0.18, t0: 0.18 }); }
  if (P.dash) { const d = P.dash; P.x += P.face * d.v * dt; d.t -= dt; if (!d.done && !!T && Math.abs(T.y - P.y) < 70 && Math.abs(T.x - P.x) < 70 * K(P.y)) { d.done = true; if (d.hit !== null) { const h = d.hit || { dmg: 40, kind: 'blow' }; d.delay ? later(d.delay, () => strike(h)) : strike(h); } if (d.stop) d.t = Math.min(d.t, d.stop); } if (d.t <= 0 || P.x < 75 || P.x > W - 75) P.dash = null; }
  if (P.dodgeV) { P.x += P.dodgeV.x * dt; P.y += P.dodgeV.y * dt; P.dodgeV.x *= Math.pow(0.004, dt); P.dodgeV.y *= Math.pow(0.004, dt); }
  if (P.pvx) { P.x += P.face * P.pvx * dt; const s = Math.sign(P.pvx); P.pvx -= s * P.pdec * dt; if (Math.sign(P.pvx) !== s) P.pvx = 0; }
  const dx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0), dy = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
  const running = down('run') || P.runLatch;
  switch (P.mode) {
    case 'ground': {
      if (down('flee') && has('36')) { P.mode = 'flee'; play('36', { fps: 14, loopFrom: 0 }); break; }
      if (down('back') && has('37')) { P.mode = 'back'; play('37', { fps: 10, onEnd: () => { if (P.mode !== 'back') return; if (has('37_1')) { const n = nOf('37_1'), lp = LP('37_1') || R(Math.min(1, n - 1), n - 1); play('37_1', { seq: S(lp, 0.11), loopFrom: 0 }); } else { const n = nOf('37'); play('37', { seq: [{ f: n - 2, d: 0.17 }, { f: n - 1, d: 0.17 }], loopFrom: 0 }); } } }); break; }
      if (dx || dy) {
        if (P.armed) P.armed = false;
        if (dx && dx !== P.face) { P.prevFace = P.face; P.faceT = P.t; P.face = dx; }
        const sp = (running ? 430 : 230) * (P.dying ? 0.6 : 1) * (env.mod ? env.mod.speed() : 1);
        P.x += dx * sp * dt; P.y += dy * sp * 0.55 * dt;
        const id = running && !P.dying && has('5') ? (has('5_1') ? '5_1' : '5') : '4';   // 5_1: 끝 장이 첫 장으로 닫힌 뛰기 반복(끝 장은 첫 장과 같아 뺌)
        const cyc = CH.cycle && CH.cycle[id];   // 끝→첫 장이 튀는 인물은 잘 이어지는 구간만 되풀이(10-29: 걷기·뛰기 뚝뚝 끊김)
        if (!P.clip || P.clip.id !== id) id === '5_1' ? play(id, { seq: S(R(0, nOf(id) - 2), 1 / 15), loopFrom: 0 }) : cyc ? play(id, { seq: S(R(cyc[0] - 1, cyc[1] - 1), 1 / (id === '5' ? 15 : P.dying ? 7 : 11)), loopFrom: 0 }) : play(id, { fps: id === '5' ? 15 : P.dying ? 7 : 11, loopFrom: 0 });
        if (id[0] === '5' && Math.random() < dt * 4) { if (!vfx('run_dust', P.x - P.face * 24, P.y + 2, 2 * K(P.y), { flip: P.face < 0, bottom: true }))   // 먼지 밑동을 발 높이에(10-28: 발보다 한참 밑에 생김)
           dust(P.x - P.face * 20, P.y, 1, 0.6); }
        const sf = curF(), n = nOf(id); if (sf !== P.stepF && (sf === 1 || sf === (n >> 1) + 1)) sfx('step'); P.stepF = sf;
        P.idleT = 0;
      } else {
        const id = P.armed ? restId() : P.combat ? idleId() : '1';
        if (!P.clip || P.clip.id !== id) {
          if (id === 'W') play('W', { seq: [{ f: PK('weapon', 'W'), d: 9 }], loopFrom: 0 });
          else { const lp = LP(id) || R(0, nOf(id) - 1); const d = id === '1' ? Math.max(0.25, Math.min(0.6, 1.2 / lp.length)) * (P.dying ? 0.75 : 1) : id === 'W_1' ? 0.2 : 1 / 7; play(id, { seq: S(lp, d), loopFrom: 0 }); }
        }
        P.idleT += dt;
        if (!P.combat && !P.armed && !P.dying && P.idleT > 9) { P.idleT = 0; emote('2', 7); }
      }
      break;
    }
    case 'act': if (P.knockT > 0) { P.knockT -= dt; if (P.knockT <= 0) { P.mode = 'down'; P.downAt = P.t; } } break;
    case 'chain': P.chainT -= dt; if (P.chainT <= 0) chainExpire(); break;
    case 'air': {
      if (P.takeoff > 0) { P.takeoff -= dt; if (P.takeoff <= 0) { P.vz = 1180; dust(P.x, P.y, 3, 0.7); } else break; }
      if (dx) { P.x += dx * P.airVX * dt; if (!P.airAtk) P.face = dx; }
      P.y += dy * 140 * dt;
      P.z += P.vz * dt; P.vz -= 2700 * dt;
      P.spin = Math.max(0, P.spin - dt);
      if (P.airAtk && !P.airHit && P.clip && P.clip.id === '14' && curF() >= impactOf('14')) { const was = T.hits; fireEv({ f: curF(), ev: P.airHeavy ? 'hitH' : 'hit', kind: P.airHeavy ? 'spike' : undefined }); if (T.hits !== was) P.airHit = true; }
      { const gz = env.ground(P.x, P.y); if (P.z <= gz && P.vz < 0) { P.z = gz; land(); break; } }
      if (!P.airAtk && P.spin <= 0) {
        const j = jf(), f = P.vz > 380 ? j.rise : P.vz > -380 ? (P.vz > 0 ? j.top : j.fall) : j.fall2;
        P.clip = { id: '7', seq: [{ f, d: 9 }], i: 0, t: 0, loopFrom: 0, done: false, onEnd: null, paused: false };
      }
      break;
    }
    case 'charge': {
      if (!down('charge') && !down('skill')) { release(); break; }
      P.charge = Math.min(chLevels()[chLevels().length - 1] + 0.3, P.charge + dt);
      const lv = chLv();
      if (lv > P.chargeShown) { P.chargeShown = lv; sfx('ability'); const m = handPt(); ring(m.x, m.y, 30 + lv * 14, 0.3, CH_COL[Math.min(3, lv)], 3); flash = 0.04; }
      break;
    }
    case 'belly': { const go = dx !== 0, looping = P.clip!.id === '38_1' || P.clip!.i >= 4; if (go) P.face = CH.crawlRev ? -dx : dx; P.clip!.paused = !go && looping; if (go && looping) P.x += dx * 55 * dt; break; }
    case 'stun': P.stunT -= dt; if (P.stunT <= 0) reverseOut('21', [curF() > 1 ? 1 : curF(), 0], 0.07); break;
    case 'flee': if (!down('flee')) { toIdle(); break; } if (dx) P.face = dx; P.x += P.face * 400 * dt; P.y += dy * 180 * dt; break;
    case 'back': { if (!down('back')) { toIdle(); break; } if (P.clip && P.clip.id === '37_1') P.x -= P.face * 80 * dt; P.y += dy * 60 * dt; break; }
    case 'sit': break;   // 주저앉아 뒤로 기기(40)는 사용자 2026-10-25 결정으로 전원 삭제 — 앉은 채 뒤로 가지 않음
    case 'crouch': if (P.clip && P.clip.i >= crLp()[0] && dx && has('42')) { P.face = dx; P.mode = 'crawl4'; const c4 = PK('crawl4', '42'); if (has('42_1')) play('42', { seq: S(R(0, c4), 0.08), onEnd: () => { if (P.mode === 'crawl4') { const n = nOf('42_1'), lp = LP('42_1') || R(Math.min(1, n - 1), n - 1); play('42_1', { seq: S(lp, 0.1), loopFrom: 0 }); } } }); else { const lp = LP('42') || R(Math.min(4, nOf('42') - 1), nOf('42') - 1); play('42', { seq: [...S(R(0, lp[0] - 1), 0.08), ...S(lp, 0.085)], loopFrom: lp[0] }); } } break;
    case 'crawl4': { const go = dx !== 0, looping = P.clip!.id === '42_1' || P.clip!.i >= 4; if (go) P.face = dx; P.clip!.paused = !go && looping; if (go && looping) P.x += dx * 85 * dt; break; }
  }
  env.clamp(P);
}

// ── 그리기 ──
let silCache: Record<string, Json> = {};
function silhouette(id?: Json, f?: Json, col?: Json) {
  const key = id + ':' + f + ':' + col; if (silCache[key]) return silCache[key];
  const a = A[id], c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
  const g = c.getContext('2d')!; g.drawImage(IMG[id], f * a.cw, 0, a.cw, a.ch, a.ox, a.oy, a.cw, a.ch);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, a.w, a.h);
  return silCache[key] = c;
}
function shadow(x?: Json, y?: Json, z?: Json, w?: Json, s = 1, up = 0, extra = 0) {
  const k = Math.max(0.3, 1 - z / 380) * s;
  const rx = Math.max(16, w) * 0.58 * k, ry = (5 + extra) * k;
  ctx.fillStyle = `rgba(0,0,0,${0.42 * k})`; ctx.beginPath(); ctx.ellipse(x, y - up * s - 2 * k, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function drawSprite(id?: Json, f?: Json, x?: Json, y?: Json, z?: Json, face?: Json, alpha = 1, tint: Json = null, clipFrac = 1, breathe = 0) {
  const a = A[id], img = IMG[id]; if (!a || !img || !img.complete || !img.naturalWidth) return;
  f = Math.min(f, a.n - 1);
  const flip = face < 0;
  const air = P.mode === 'air' && (id === '7' || id === '14');
  const base = air ? a.bot[f] : groundBase(id, a, f);
  if (arcOf(id) && alpha === 1) z += arcOf(id)[f] || 0;
  const sk = K(y), jt = alpha === 1 && CH.jitter && CH.jitter[id] ? (Math.random() - 0.5) * 2 * CH.jitter[id] : 0;   // fail 줄을 대신하는 장에 코드 흔들림
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x + jt), Math.round(y - z)); ctx.scale(flip ? -sk : sk, sk);
  const dxp = -Math.round(a.w / 2) - (ROOT.has(id) && a.cx ? a.cx[f] - a.cx[0] : 0), dyp = -base;
  if (clipFrac < 1) {   // 아래부터 지움(그림자로 가라앉기): 위쪽 clipFrac 만 보임
    const top = a.top[f], hh = (a.bot[f] - top) * clipFrac;
    ctx.beginPath(); ctx.rect(dxp - 10, dyp + top - 4, a.w + 20, hh + 4); ctx.clip();
  }
  if (tint && !tint.noEdge) {
    const s = silhouette(id, f, tint.c);
    const offs = tint.glow ? [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]] : [[-2, 0], [2, 0], [0, -2], [0, 2]];
    ctx.globalAlpha = alpha * (tint.ea ?? 1) * (tint.glow ? 0.5 : 1);
    for (const [ox, oy] of offs) ctx.drawImage(s, dxp + ox, dyp + oy);
    ctx.globalAlpha = alpha;
  }
  if (breathe) {   // 앉은 대기 코드 숨쉬기(사용자 10-27): 허리띠 위만 1화소 오르내림, 손·다리는 그대로
    const wy = Math.max(1, Math.min(a.ch - 1, Math.round(a.top[f] + (a.bot[f] - a.top[f]) * 0.45 - a.oy)));
    // 아래를 먼저, 위는 경계 줄을 한 줄 더 겹쳐 그림 — 올린 1화소만큼 허리에 빈 줄이 생기던 것(사용자 10-29)
    ctx.drawImage(img, f * a.cw, wy, a.cw, a.ch - wy, dxp + a.ox, dyp + a.oy + wy, a.cw, a.ch - wy);
    ctx.drawImage(img, f * a.cw, 0, a.cw, wy + breathe, dxp + a.ox, dyp + a.oy - breathe, a.cw, wy + breathe);
  } else ctx.drawImage(img, f * a.cw, 0, a.cw, a.ch, dxp + a.ox, dyp + a.oy, a.cw, a.ch);
  if (tint && tint.over) { ctx.globalAlpha = alpha * tint.over; ctx.drawImage(silhouette(id, f, tint.c), dxp, dyp); }
  ctx.restore();
}
function drawPlayer() {
  if (!CK) return;
  const c = P.clip; let id = c ? c.id : '1'; if (!A[id]) id = idleId(); const a = A[id]; if (!a) return; const f = Math.min(curF(), a.n - 1);
  const air = P.mode === 'air' && (id === '7' || id === '14');
  let vis = 1;
  if (P.vanish) { const k = Math.min(1, P.vanish.t / P.vanish.dur); vis = P.vanish.mode === 'out' ? 1 - k : k; }
  const flip = P.face < 0;
  const ft = a.foot[f], kk = K(P.y), off = ROOT.has(id) && a.cx ? a.cx[f] - a.cx[0] : 0, fx0 = (flip ? -(ft[0] - off) : ft[0] - off) * kk;
  const contact = a.bot[f] - (ft[2] || 0), lift = air ? 0 : (arcOf(id) ? arcOf(id)[f] || 0 : Math.max(0, BASE(a) - a.bot[f] - 6));
  if (vis > 0.05) shadow(P.x + fx0, P.y, P.z + lift * kk, Math.min(80, ft[1]), kk * Math.max(0.3, vis), air ? 0 : groundBase(id, a, f) - contact, Math.min(10, ft[3] || 0));
  if (vis <= 0.01) return;
  let tint: Json = null;
  if (P.armorT > 0) tint = { c: '#ff2a2a', over: 0.35 * (P.armorT / 0.28) };
  else if (armored() && showArmor) tint = { c: 'rgba(255,60,40,.55)', over: 0 };
  else if (P.healT > 0) tint = { c: '#7dff8a', over: 0.35 * P.healT, noEdge: true };
  else if (P.buffT > 0 && P.buffEdge) tint = { c: P.buffC || CH.color, over: 0, ea: 0.5 + 0.3 * Math.sin(P.t * 8) };   // 버프: 몸 테두리만(둘레 기운 없음)
  else if (P.sp >= 100) tint = { c: '#ffd34a', over: 0, ea: 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(P.t * 4)), glow: true };
  else if (P.hp <= 25 && P.mode !== 'dead') tint = { c: '#d0101a', over: 0.42 * (0.5 + 0.5 * Math.sin(P.t * Math.PI * 2 * 1.3)), noEdge: true };
  else if (P.mode === 'charge') { const lv = Math.min(3, chLv()); tint = { c: CH_COL[lv], over: 0.08 + 0.08 * Math.sin(P.t * 20), noEdge: true }; }
  // 의자: C01 사무 의자 1배(판정 전). 정면·옆은 사람 뒤 층, 후면은 등받이가 몸을 가리게 사람 앞 층(seat_fit.json front=true, 10-28 사용자 지적: 등받이를 뚫고 앉음)
  // 의자 자리 고정(필드 지도 의자, P.seat.cx·cy): 의자는 그 자리에, 사람을 맞춤값(줄마다 다를 수 있음)만큼 옮겨 그린다. 없으면 사람 기준(시험장)
  const cf0 = P.seat ? chairFit(P.seat.dir, P.clip && P.clip.id) : null;
  const anchored = !!(P.seat && P.seat.cx != null && cf0);
  const bx = anchored ? P.seat.cx - P.face * cf0.dx * kk : P.x, by = anchored ? P.seat.cy - cf0.dy * kk : P.y;
  const chair = () => { if (!(P.seat && showChair && CHAIR[P.seat.img] && CHAIR[P.seat.img].complete)) return; const cf = cf0!, im = CHAIR[cf.img || P.seat.img] && CHAIR[cf.img || P.seat.img].complete ? CHAIR[cf.img || P.seat.img] : CHAIR[P.seat.img];
    ctx.save(); ctx.translate(Math.round(anchored ? P.seat.cx : P.x + P.face * cf.dx * kk), Math.round(anchored ? P.seat.cy : P.y + cf.dy * kk)); ctx.scale((P.face < 0 ? -1 : 1) * kk * cf.s, kk * cf.s); ctx.drawImage(im, -100, -171); ctx.restore(); };
  const chairFront = P.seat && P.seat.dir === 'back';
  if (!chairFront) chair();
  drawSprite(id, f, bx, by, P.z, P.face, 1, tint, vis, c && c.breathe ? (Math.sin(P.t * 2.6) > 0 ? 1 : 0) : 0);
  if (chairFront) chair();
  if (P.fadeOut && P.t < P.fadeOut.until && !P.seat && A[P.fadeOut.id]) drawSprite(P.fadeOut.id, P.fadeOut.f, P.x, P.y, P.z, P.face, 0.85 * (P.fadeOut.until - P.t) / P.fadeOut.d, null, vis);   // 대기로 넘어갈 때 앞 동작 장을 잠깐 겹쳐 흐리게(10-29)
  if (P.mode === 'charge') { const m = handPt(); drawVfxAt('charge_gather', m.x, m.y, 1.2 + Math.min(1, P.charge) * 0.8, P.t); }
  if (P.status) {
    const top = P.y - P.z - (BASE(a) - a.top[f]) * kk, hgt = (BASE(a) - a.top[f]) * kk;
    if (P.status === 'status_burn') for (let i = 0; i < 5; i++) { const ox = Math.sin(i * 2.3) * 22 * kk, oy = top + hgt * (0.2 + 0.16 * i); drawVfxAt('status_burn', P.x + ox, oy + 10 * kk, 0.55 * kk, P.t + i * 0.37); }
    if (P.status === 'status_shock') for (let i = 0; i < 4; i++) { const ph = Math.floor(P.t * 9 + i * 3.7); const rx = Math.sin(ph * 12.9898 + i) * 0.5, ry = (Math.sin(ph * 78.233 + i * 2) * 0.5 + 0.5); drawVfxAt('status_shock', P.x + rx * 40 * kk, top + hgt * (0.05 + ry * 0.9), 0.7 * kk, P.t + i * 0.2); }
  }
  if (P.mode === 'stun') {
    const hy = P.y - (BASE(a) - a.top[f]) * kk - 14;
    if (!drawVfxAt('stun_stars', P.x, hy, 2.2, P.t)) for (let i = 0; i < 3; i++) { const t = P.t * 4 + i * 2.09; star(P.x + Math.cos(t) * 26, hy + Math.sin(t) * 7, 7, '#ffe066'); }
  }
}
function star(x?: Json, y?: Json, r?: Json, c?: Json) { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
// 공용 이펙트(흰색으로 뽑음)에 인물 색 입히기: 밝은 곳은 그 색, 어두운 곳은 어둡게, 투명은 그대로. 이름+색으로 한 번만 만들어 둠
const TINT: Record<string, Json> = {};
function tinted(name?: Json, c?: Json) {
  const v = VFX[name], key = name + c; if (!c || !v.img.complete) return v.img;
  if (TINT[key]) return TINT[key];
  const cv2 = document.createElement('canvas'); cv2.width = v.img.naturalWidth; cv2.height = v.img.naturalHeight;
  const g = cv2.getContext('2d')!; g.drawImage(v.img, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = c; g.fillRect(0, 0, cv2.width, cv2.height);
  g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.35; g.drawImage(v.img, 0, 0);   // 가운데 흰 빛은 조금 남김
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(v.img, 0, 0);
  return (TINT[key] = cv2);
}
function drawVfxAt(name?: Json, x?: Json, y?: Json, sc?: Json, el?: Json, flip?: Json, tint?: Json) {
  const v = VFX[name]; if (!v || !v.img.complete) return false;
  const [fx0, fy0, fw, fh] = sheetFrame(v, el % vfxDur(name));
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(flip ? -sc : sc, sc); ctx.drawImage(tint ? tinted(name, tint) : v.img, fx0, fy0, fw, fh, -fw * v.pivot[0], -fh * v.pivot[1], fw, fh); ctx.restore(); return true;
}
function sheetFrame(v?: Json, el?: Json) { el = el * 1000; let i = 0; while (i < v.frames.length - 1 && el >= v.frames[i][4]) { el -= v.frames[i][4]; i++; } return v.frames[i]; }
function drawSheets(under = false) {
  for (const e of fx) {
    if (!!e.under !== under) continue;
    if (e.k === 'bullet' && VFX.tracer && VFX.tracer.img.complete) {
      const k = 1 - e.t / e.t0, x = e.x + (e.x2 - e.x) * k, y = e.y + (e.y2 - e.y) * k, [fx0, fy0, fw, fh] = sheetFrame(VFX.tracer, (e.t0 - e.t) % vfxDur('tracer'));
      const L = fw * 0.38 * 2.4, vis = Math.min(L, Math.hypot(x - e.x, y - e.y) + 4), sw = vis / 2.4;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(e.y2 - e.y, e.x2 - e.x)); ctx.drawImage(VFX.tracer.img, fx0 + fw - sw, fy0, sw, fh, -vis, -fh * 1.1, vis, fh * 2.2); ctx.restore();
    }
    if (e.k === 'beamS' && VFX.charge_beam && VFX.charge_beam.img.complete) {
      const v = VFX.charge_beam, [fx0, fy0, fw, fh] = sheetFrame(v, (e.t0 - e.t) % vfxDur('charge_beam')), sc = e.sy * (0.5 + 0.5 * e.t / e.t0);
      const x2 = e.dir > 0 ? W : VX0, len = Math.abs(x2 - e.x);
      ctx.save(); ctx.translate(e.x, e.y); if (e.dir < 0) ctx.scale(-1, 1);
      const taper = 140, step = 8;
      for (let x = 0; x < len; x += step) {
        const k0 = Math.min(1, 0.12 + (x / taper) ** 0.7 * 0.88);
        const sx = fx0 + ((x / 2) % fw), sw = Math.min(step / 2, fw - (sx - fx0));
        ctx.drawImage(v.img, sx, fy0, sw, fh, x, -fh * sc * k0, sw * 2, fh * 2 * sc * k0);
      }
      ctx.restore();
    }
    if (e.k !== 'sheet') continue;
    const v = VFX[e.name]; if (!v.img.complete) continue; const img = e.tint ? tinted(e.name, e.tint) : v.img;
    const [fx0, fy0, fw, fh] = sheetFrame(v, e.loop ? (e.t0 - e.t) % e.dur : e.t0 - e.t);
    ctx.save(); if (e.fade && e.t < e.fade) ctx.globalAlpha = e.t / e.fade; ctx.translate(Math.round(e.x), Math.round(e.y)); if (e.rot) ctx.rotate(e.rot); ctx.scale(e.flip ? -e.s : e.s, e.s);
    if (e.anchor === 'right') ctx.drawImage(img, fx0, fy0, fw, fh, -fw, -fh / 2, fw, fh);
    else if (e.bottom) ctx.drawImage(img, fx0, fy0, fw, fh, -fw / 2, -fh + (v.bpad || 0), fw, fh);   // 칸 아래 빈 줄만큼 내려 그림 밑동을 바닥에
    else if (e.center) ctx.drawImage(img, fx0, fy0, fw, fh, -fw / 2, -fh / 2, fw, fh);
    else ctx.drawImage(img, fx0, fy0, fw, fh, -fw * v.pivot[0], -fh * v.pivot[1], fw, fh);
    ctx.restore();
  }
}
function drawTargets() {
  for (const e of fx) if (e.k === 'target') {
    const bl = Math.sin(P.t * 14) > 0, r = 26;
    ctx.strokeStyle = bl ? 'rgba(255,70,50,.95)' : 'rgba(255,170,60,.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.moveTo(e.x - r - 8, e.y); ctx.lineTo(e.x + r + 8, e.y); ctx.moveTo(e.x, e.y - 12); ctx.lineTo(e.x, e.y + 12); ctx.stroke();
  }
}
function drawFxUnder() {
  drawTargets();
  for (const e of fx) if (e.k === 'scorch') { ctx.fillStyle = `rgba(20,14,10,${0.55 * Math.min(1, e.t)})`; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r, e.r * 0.28, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const e of fx) if (e.k === 'puddle') { const k = e.t / e.t0, g = Math.min(1, (1 - k) * 5) * Math.min(1, k * 3); ctx.fillStyle = 'rgba(8,4,14,' + (0.85 * g) + ')'; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * (0.5 + 0.5 * g), e.r * 0.26 * (0.5 + 0.5 * g), 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = e.c; ctx.globalAlpha = 0.6 * g; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
  for (const e of fx) if (e.k === 'dust') { const k = e.t / e.t0; ctx.fillStyle = `rgba(200,190,170,${0.45 * k})`; ctx.beginPath(); ctx.arc(e.x, e.y - 4, e.r * (1.6 - k), 0, Math.PI * 2); ctx.fill(); }
  for (const e of fx) if (e.k === 'drop' && e.y >= e.g) drawDrop(e);
  for (const e of fx) if (e.k === 'ghost' && A[e.id]) drawSprite(e.id, e.f, e.x, e.y, e.z, e.face, 0.16 * e.t / e.t0, { c: '#a8ccff', over: 0.3, noEdge: true });
}
// 소환물·떨어지는 것: 작은 도트 그림(코드)
function drawIcon(icon?: Json, x?: Json, y?: Json, s?: Json, c?: Json, face = 1) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s * face, s);
  const R_ = (x?: Json, y?: Json, w?: Json, h?: Json, col?: Json) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  if (icon === 'cup') { R_(-9, -16, 18, 16, '#f4f0e6'); R_(-9, -16, 18, 3, '#8a5a2b'); R_(9, -12, 5, 8, '#f4f0e6'); R_(-6, -2, 12, 2, '#ccc'); }
  else if (icon === 'tablet') { R_(-14, -20, 28, 20, '#222'); R_(-12, -18, 24, 16, c); R_(-10, -16, 8, 3, '#fff'); R_(-10, -11, 14, 2, '#fff'); }
  else if (icon === 'paper') { R_(-7, -9, 14, 18, '#f2efe6'); R_(-5, -6, 10, 1, '#999'); R_(-5, -3, 10, 1, '#999'); R_(-5, 0, 7, 1, '#999'); }
  else if (icon === 'turret') { R_(-14, -10, 28, 10, '#4a4f58'); R_(-6, -22, 12, 12, '#6b7280'); R_(4, -19, 18, 4, '#2b2f36'); R_(-16, 0, 32, 4, '#2b2f36'); R_(-3, -18, 4, 4, c); }
  else if (icon === 'tube') { ctx.globalAlpha *= 0.55; R_(-30, -150, 60, 150, '#9fd8ff'); ctx.globalAlpha /= 0.55; R_(-34, -154, 68, 8, '#d9eef8'); R_(-34, -6, 68, 8, '#5a6b78'); R_(-30, -146, 4, 140, '#e8f6ff'); R_(22, -146, 3, 140, '#e8f6ff'); }
  else if (icon === 'wall') { for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { R_(-30 + j * 30, -24 - i * 24, 28, 22, '#8a6a42'); R_(-30 + j * 30, -24 - i * 24, 28, 3, '#6b5030'); } R_(-31, -73, 60, 2, c); }
  else if (icon === 'rift') { R_(-5, -150, 10, 150, '#1a0a24'); R_(-2, -150, 4, 150, '#6a3a9a'); R_(-7, -110, 2, 60, '#b08ae0'); }
  else if (icon === 'coin') { R_(-7, -7, 14, 14, '#e8c35a'); R_(-5, -5, 10, 10, '#ffe08a'); R_(-1, -4, 2, 8, '#b08a2a'); }
  else if (icon === 'card') { R_(-8, -11, 16, 22, '#fff'); R_(-6, -9, 12, 18, c); }
  else { R_(-14, -24, 28, 24, '#8a6a42'); R_(-14, -24, 28, 4, '#6b5030'); R_(-2, -24, 4, 24, c); }
  ctx.restore();
}
function drawDrop(e?: Json) { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.y < e.g ? e.rot : 0); ctx.globalAlpha = Math.min(1, e.t); drawIcon(e.icon, 0, 0, 1.6, e.c); ctx.restore(); }
function drawFx(glow?: Json) {
  for (const e of fx) {
    if (GLOW.has(e.k) !== glow) continue;
    const k = e.t0 ? e.t / e.t0 : 1;
    if (e.k === 'spark') { ctx.strokeStyle = e.c; ctx.lineWidth = e.s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - e.vx * 0.035, e.y - e.vy * 0.035); ctx.stroke(); }
    else if (e.k === 'ring') { ctx.strokeStyle = e.c; ctx.globalAlpha = k; ctx.lineWidth = e.w * k + 1; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r0 + (e.r - e.r0) * (1 - k), (e.r0 + (e.r - e.r0) * (1 - k)) * e.sy, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (e.k === 'num') { ctx.fillStyle = typeof e.v === 'string' ? '#9fd0ff' : e.big ? '#ffcf4a' : '#fff'; ctx.font = `bold ${e.big ? 30 : 22}px sans-serif`; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(e.v, e.x - 14, e.y); ctx.fillText(e.v, e.x - 14, e.y); }
    else if (e.k === 'blood') { ctx.fillStyle = `rgba(150,10,16,${Math.min(1, e.t)})`; if (e.landed) { ctx.beginPath(); ctx.ellipse(e.x, e.y, e.s * 2.2, e.s * 0.8, 0, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(e.x - e.s / 2, e.y - e.s / 2, e.s, e.s); }
    else if (e.k === 'mortar') {
      const p = 1 - k, y = -80 + (e.y - 30 + 80) * p, x = e.x + (1 - p) * 140, ang = Math.atan2(e.y + 50, -140);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang - Math.PI / 2);
      ctx.fillStyle = '#3d4236'; ctx.fillRect(-6, -26, 12, 36); ctx.fillStyle = '#7a8070'; ctx.fillRect(-6, -26, 4, 36);
      ctx.fillStyle = '#c9a23a'; ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.lineTo(0, 22); ctx.fill();
      ctx.restore();
    }
    else if (e.k === 'impact') {
      const r = (e.big ? 70 : 42) * (1.2 - k * 0.4);
      star(e.x, e.y, r * 0.8 * k + 6, 'rgba(255,255,255,.95)');
      ctx.strokeStyle = `rgba(255,255,255,${k})`; ctx.lineWidth = (e.big ? 10 : 6) * k + 1;
      ctx.beginPath(); ctx.arc(e.x - e.dir * r * 0.4, e.y, r, -Math.PI / 2.6, Math.PI / 2.6, e.dir < 0); ctx.stroke();
    }
    else if (e.k === 'speed') {
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * k})`; ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + i, r0 = 120 + (i % 3) * 30; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0 * 0.7); ctx.lineTo(e.x + Math.cos(a) * (r0 + 220), e.y + Math.sin(a) * (r0 + 220) * 0.7); ctx.stroke(); }
    }
    else if (e.k === 'steam') { ctx.fillStyle = `rgba(235,235,240,${0.3 * k})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); }
    else if (e.k === 'smoke') { const c = e.c || 90; ctx.fillStyle = `rgba(${c},${c},${c + 5},${0.55 * k})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); }
    else if (e.k === 'bubble') { ctx.strokeStyle = `rgba(120,230,90,${Math.min(1, e.t * 1.5)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke(); }
    else if (e.k === 'mote') { ctx.fillStyle = e.c; ctx.globalAlpha = k; ctx.fillRect(e.x - 2, e.y - 2, 4, 4); ctx.globalAlpha = 1; }
    else if (e.k === 'fire') { const c = k > 0.8 ? '255,255,230' : k > 0.55 ? '255,214,90' : k > 0.3 ? '255,120,30' : '120,30,20'; ctx.fillStyle = `rgba(${c},${Math.min(1, k * 1.6)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); }
    else if (e.k === 'shell') { ctx.fillStyle = '#e8c35a'; ctx.fillRect(e.x - 2, e.y - 1, 5, 3); }
    else if (e.k === 'carry') { const pt = e.pts[curF()]; if (pt) { const k = K(P.y); drawVfxAt(e.vfx, P.x + P.face * pt[0] * k, P.y - P.z - pt[1] * k, e.sc * k, 0, P.face < 0); } }
    else if (e.k === 'toss') { const u = 1 - e.t / e.t0, x = e.x0 + (e.x1 - e.x0) * u, y = e.y0 + (e.y1 - e.y0) * u - e.arc * 4 * u * (1 - u); ctx.save(); ctx.translate(x, y); ctx.rotate(e.rot * u); drawVfxAt(e.vfx, 0, 0, e.sc, 0, e.flip); ctx.restore(); }
    else if (e.k === 'coin') { ctx.save(); ctx.translate(e.x, e.y - 6); ctx.scale(e.vy === 0 && Math.abs(e.vx) < 5 ? 1 : Math.abs(Math.cos(e.t * 16)) * 0.85 + 0.15, 1); drawIcon('coin', 0, 0, 0.9, CH.color); ctx.restore(); }
    else if (e.k === 'eyes') { const a = e.t / e.t0; ctx.fillStyle = e.c; ctx.globalAlpha = a; for (const ox of [-6, 6]) { ctx.fillRect(e.x + ox - 3, e.y - 2, 6, 4); ctx.fillRect(e.x + ox - 9 * a - 1, e.y - 1, 18 * a + 2, 2); } ctx.globalAlpha = 1; }
    else if (e.k === 'beam') {
      const x2 = e.dir > 0 ? W : 0, w = e.w * (0.4 + 0.6 * k), x0 = Math.min(e.x, x2), len = Math.abs(x2 - e.x);
      ctx.globalAlpha = 0.45 * k; ctx.fillStyle = e.c || '#a0dcff'; ctx.fillRect(x0, e.y - w, len, w * 2);
      ctx.globalAlpha = k; ctx.fillStyle = '#fff'; ctx.fillRect(x0, e.y - w * 0.35, len, w * 0.7); ctx.globalAlpha = 1;
    }
    else if (e.k === 'burst') {
      const r = 18 + 60 * (1 - k); ctx.strokeStyle = `rgba(230,245,255,${k})`; ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r * 0.5, e.y + Math.sin(a) * r * 0.2); ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.4); ctx.stroke(); }
    }
    else if (e.k === 'scan') {
      const p = 1 - k, x = e.dir > 0 ? e.x + p * (W - e.x) : e.x - p * e.x;
      ctx.strokeStyle = e.c; ctx.globalAlpha = 0.85; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x, FLOOR0 - 40); ctx.lineTo(x, H); ctx.stroke();
      ctx.globalAlpha = 0.1; ctx.fillStyle = e.c; ctx.fillRect(Math.min(e.x, x), 0, Math.abs(x - e.x), H); ctx.globalAlpha = 1;
    }
    else if (e.k === 'grid') {   // 데이터 격자: 사각 칸이 펼쳐졌다 접힘
      const p = Math.min(1, (1 - k) * 3) * Math.min(1, k * 3), w = 520 * p, h = 300 * p, x0 = e.x + e.dir * 40 - (e.dir < 0 ? w : 0), y0 = e.y - h / 2;
      ctx.strokeStyle = e.c; ctx.lineWidth = 2; ctx.globalAlpha = 0.8; ctx.strokeRect(x0, y0, w, h);
      ctx.globalAlpha = 0.35; for (let gx = 0; gx <= w; gx += 40) { ctx.beginPath(); ctx.moveTo(x0 + gx, y0); ctx.lineTo(x0 + gx, y0 + h); ctx.stroke(); } for (let gy = 0; gy <= h; gy += 40) { ctx.beginPath(); ctx.moveTo(x0, y0 + gy); ctx.lineTo(x0 + w, y0 + gy); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    else if (e.k === 'orb') {}
    else if (e.k === 'slash' || e.k === 'slashD') {
      const p = 1 - k, r = e.r, lw = 10 * k + 2;
      ctx.strokeStyle = e.c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, k * 2);
      if (e.style === 'h') { const L = W * Math.min(1, p * 5); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.dir > 0 ? 0 : W, e.y); ctx.lineTo(e.dir > 0 ? L : W - L, e.y); ctx.stroke(); }
      else if (e.style === 'x') { const L = r * Math.min(1, p * 4); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x - s * r, e.y - r); ctx.lineTo(e.x - s * r + s * 2 * L, e.y - r + 2 * L); ctx.stroke(); } ctx.strokeStyle = '#fff'; ctx.lineWidth = lw * 0.35; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x - s * r, e.y - r); ctx.lineTo(e.x - s * r + s * 2 * L, e.y - r + 2 * L); ctx.stroke(); } }
      else { ctx.beginPath(); ctx.arc(e.x - e.dir * r * 0.3, e.y, r, -Math.PI / 2.4, Math.PI / 2.4 * Math.min(1, p * 4) * 2 - Math.PI / 2.4, e.dir < 0); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    else if (e.k === 'icon') { const a = A[P.clip ? P.clip.id : '1'] || A[idleId()]; const y = P.y - (BASE(a) - a.top[Math.min(curF(), a.n - 1)]) * K(P.y) - 40; ctx.fillStyle = '#ff4a3a'; ctx.font = 'bold 44px sans-serif'; ctx.fillText(e.v, P.x - 8, y); }
  }
}
// 캐릭터와 같은 층에 그리는 것: 투사체·가시·소환물·떨어지는 중인 것
function drawMid() {
  for (const e of fx) {
    if (e.k === 'spikeG') {   // 바닥에서 솟는 검은 가시
      const k = e.t / e.t0, up = Math.min(1, (1 - k) * 6) * (k < 0.25 ? k / 0.25 : 1), h = e.h * up;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.lean);
      ctx.fillStyle = e.c; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -h - 3); ctx.lineTo(6, 0); ctx.fill();
      ctx.fillStyle = '#0b0710'; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(0, -h); ctx.lineTo(4, 0); ctx.fill();
      ctx.restore();
    }
    else if (e.k === 'proj' && e.vfx && VFX[e.vfx]) { projTrail(e); ctx.save(); ctx.translate(e.x, e.y); if (e.rot) ctx.rotate(P.t * e.rot); drawVfxAt(e.vfx, 0, 0, e.size, P.t, e.dir < 0, e.tint); ctx.restore(); }   // 3판 그림 투사체(모래 탄·수갑·의수 등)
    else if (e.k === 'proj' && e.kind === 'orb' && VFX['fx-orb']) { projTrail(e); drawVfxAt('fx-orb', e.x, e.y, 2.6 * e.size, P.t, e.dir < 0, e.c); }
    else if (e.k === 'proj') {
      projTrail(e); const s = e.size, d = e.dir;
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(d * s, s);
      if (e.kind === 'spike') { ctx.fillStyle = e.c; ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(16, 0); ctx.lineTo(-26, 4); ctx.fill(); ctx.fillStyle = '#0b0710'; ctx.beginPath(); ctx.moveTo(-24, -2); ctx.lineTo(13, 0); ctx.lineTo(-24, 2); ctx.fill(); }
      else if (e.kind === 'pen') { ctx.fillStyle = '#1d2a4a'; ctx.fillRect(-14, -2, 22, 4); ctx.fillStyle = '#ddd'; ctx.fillRect(8, -1, 5, 2); ctx.fillStyle = e.c; ctx.fillRect(-14, -3, 4, 6); ctx.rotate(0); }
      else if (e.kind === 'coin') { drawIcon('coin', 0, 0, 1.2, CH.color); }
      else if (e.kind === 'cuff') { ctx.rotate(P.t * 12); ctx.strokeStyle = '#d8dde6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-6, 0, 6, 0, 6.3); ctx.moveTo(12, 0); ctx.arc(6, 0, 6, 0, 6.3); ctx.stroke(); }
      else if (e.kind === 'arm') { ctx.rotate(P.t * 10); ctx.fillStyle = '#1b1b1f'; ctx.fillRect(-14, -4, 20, 8); ctx.fillStyle = '#e8c4a0'; ctx.fillRect(6, -5, 8, 10); }
      else if (e.kind === 'box') { ctx.rotate(P.t * 8); drawIcon('box', 0, 12, 1.4, CH.color); }
      else if (e.kind === 'card') { ctx.fillStyle = '#fff'; ctx.fillRect(-8, -5, 16, 10); ctx.fillStyle = e.c; ctx.fillRect(-6, -3, 12, 6); }
      else if (e.kind === 'knife') { ctx.fillStyle = '#d8dde6'; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(16, 0); ctx.lineTo(-6, 3); ctx.fill(); ctx.fillStyle = '#3a2a20'; ctx.fillRect(-16, -2, 10, 4); }
      else { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, '#fff'); g.addColorStop(0.45, e.c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    else if (e.k === 'obj' && e.icon === 'decoy') { const k = e.t / e.t0; drawSprite(e.anim && A[e.anim] ? e.anim : idleId(), Math.floor(P.t * 6) % nOf(e.anim && A[e.anim] ? e.anim : idleId()), e.x, e.y, 0, e.face, (e.alpha || 0.45) * Math.min(1, k * 4) * (0.8 + 0.2 * Math.sin(P.t * 20)), { c: e.c && e.c !== CH.color ? e.c : '#9fd8ff', over: e.over ?? 0.55, noEdge: true }); }
    else if (e.k === 'obj') { const k = e.t / e.t0, a = Math.min(1, k * 4, (1 - k) * 8 + 0.2); ctx.globalAlpha = a; drawIcon(e.icon, e.x, e.y, 2 * e.s, e.c, e.face); ctx.globalAlpha = 1; if (e.icon === 'cup' && Math.random() < 0.15) steam(e.x, e.y - 34 * e.s, 1); }
    else if (e.k === 'drop' && e.y < e.g) drawDrop(e);
    else if (e.k === 'tether') {   // 정수리 → 대상
      const a = A[P.clip && A[P.clip.id] ? P.clip.id : idleId()], f = Math.min(curF(), a.n - 1), hx = P.x, hy = P.y - P.z - (BASE(a) - a.top[f]) * K(P.y);
      const tx = e.onT ? T.x : e.tx, ty = e.onT ? T.y - T.z - 190 * K(T.y) : e.ty - 150 * K(e.ty), k = e.t / e.t0;
      ctx.strokeStyle = e.c; ctx.lineWidth = 3; ctx.globalAlpha = Math.min(1, k * 4); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + tx) / 2, Math.min(hy, ty) - 60 + Math.sin(P.t * 7) * 8, tx, ty); ctx.stroke(); ctx.globalAlpha = 1;
    }
    else if (e.k === 'sweep') {   // 괴이 그림자: 큰 검은 덩어리 + 붉은 눈 + 이빨
      const p = 1 - e.t / e.t0, x = e.x0 + (e.x1 - e.x0) * p, y = e.y + Math.sin(p * 18) * 14, d = e.dir;
      ctx.save(); ctx.translate(x, y); ctx.scale(d, 1); ctx.globalAlpha = 0.88;
      ctx.fillStyle = e.c; ctx.beginPath(); ctx.ellipse(0, -60, 230, 110, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(-200 + i * 50, 20 + Math.sin(P.t * 12 + i) * 10, 20, 50, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ff2a3a'; for (const [ex, ey] of [[150, -100], [185, -88], [120, -80]]) ctx.fillRect(ex, ey, 12, 6);
      ctx.fillStyle = '#e8e2d4'; const jaw = Math.abs(Math.sin(P.t * 10)) * 30; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(130 + i * 16, -40); ctx.lineTo(138 + i * 16, -40 + 14 + jaw * 0.3); ctx.lineTo(146 + i * 16, -40); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    else if (e.k === 'lob') { const p = 1 - e.t / e.t0, x = e.x0 + (e.x1 - e.x0) * p, y = e.y0 + (e.y1 - e.y0) * p - Math.sin(p * Math.PI) * 160; ctx.fillStyle = '#3a4a2a'; ctx.fillRect(x - 5, y - 6, 10, 12); ctx.fillStyle = '#9a9a7a'; ctx.fillRect(x - 2, y - 9, 4, 3); }
    else if (e.k === 'wave' && e.style === 'sand') { ctx.fillStyle = e.c || '#d8b878'; for (let i = 0; i < 7; i++) { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(e.x - e.dir * (i % 3) * 40, e.y - 30 - i * 34, 70 - i * 4, 40, 0, 0, 6.3); ctx.fill(); } ctx.globalAlpha = 1; }
    else if (e.k === 'wave') { for (let i = 0; i < 9; i++) drawIcon(i % 3 ? 'box' : 'wall', e.x - e.dir * (i % 3) * 30, e.y - 120 + i * 30 * 0.9 - (i % 3) * 26, 2.2 * K(e.y), CH.color, e.dir); }
  }
}
function drawHeat() {
  if (P.heat < 50 || !P.armed) return;
  const p = muzzle(), a = (P.heat - 50) / 50;
  const g = ctx.createRadialGradient(p.x - P.face * 14, p.y, 0, p.x - P.face * 14, p.y, 22);
  g.addColorStop(0, `rgba(255,${P.overT > 0 ? 60 : 120},30,${0.8 * a})`); g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x - P.face * 14, p.y, 22, 0, Math.PI * 2); ctx.fill();
}
function drawChargeAim() {
  if (P.mode !== 'charge') return;
  const lv = chLv(), max = chLevels().length;
  if (lv) { ctx.fillStyle = CH_COL[Math.min(3, lv)]; ctx.font = 'bold 20px sans-serif'; ctx.fillText(lv >= max ? '최대' : lv + '단', P.x - 16, P.y - 250 * K(P.y)); }
}
function drawDying() {
  if (P.hp > 25) return;
  const t = (P.t * 1.1) % 1, beat = Math.max(0, 1 - Math.abs(t - 0.08) * 12) + Math.max(0, 1 - Math.abs(t - 0.28) * 12) * 0.7;
  const g = ctx.createRadialGradient(640, H / 2, H * 0.55, 640, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(170,0,0,${0.55 * beat})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, H);
}
// 필살기 컷인(던파식): 요원 색 띠가 비스듬히 펼쳐지고 기술명이 박힘
function drawCut() {
  if (!cut) return;
  const sp = CH.skills.super || {}, k = Math.min(1, (1.1 - cut) * 7), out = cut < 0.15 ? cut / 0.15 : 1, y = H / 2 - 80;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-12 * Math.PI / 180); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = out; ctx.fillStyle = 'rgba(10,10,12,.9)'; ctx.fillRect(-200, y - 10, (W + 400) * k, 180);
  ctx.fillStyle = CH.color; ctx.fillRect(-200, y - 10, (W + 400) * k, 8); ctx.fillRect(-200, y + 162, (W + 400) * k, 8);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const x = ((P.t * 2400 + i * 137) % (W + 400)) - 200, yy = y + 10 + (i * 37) % 150; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 120, yy); ctx.stroke(); }
  // 상반신 컷인 그림이 없으니 전투 대기 그림의 위쪽을 크게
  const a = A[idleId()];
  if (a && IMG[idleId()].complete) { const sc = 1.6, cx = 220 + (1 - k) * -300; ctx.save(); ctx.beginPath(); ctx.rect(-200, y - 2, W + 400, 164); ctx.clip(); ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG[idleId()], 0, 0, a.cw, Math.min(a.ch, 120), cx - a.cw * sc / 2, y - 6, a.cw * sc, Math.min(a.ch, 120) * sc); ctx.restore(); }
  const s = 1 + Math.max(0, 0.6 - (1.1 - cut - 0.25) * 7.5);
  const nm = sp.name || '필살기', fsz = Math.min(70, Math.floor(560 / Math.max(1, nm.length) * 1.05)); ctx.font = `bold ${Math.round(fsz * Math.max(1, s))}px sans-serif`; ctx.lineWidth = 6; ctx.strokeStyle = CH.color; ctx.fillStyle = '#fff';
  const tx = W - 600 * k; ctx.strokeText(sp.name || '필살기', tx, y + 100); ctx.fillText(sp.name || '필살기', tx, y + 100);
  ctx.font = '22px sans-serif'; ctx.fillStyle = '#c8c4b8'; ctx.fillText((sp.sub || '').slice(0, Math.floor((1.1 - cut) * 40)), tx + 10, y + 142);
  ctx.restore();
}
  // ── 게임 쪽 그리기 ──
  function frameView(v?: Json) { VX0 = v.x0; W = v.x0 + 1280; FLOOR0 = v.lane[0]; FLOOR1 = v.lane[1]; }
  /** 바닥 층 (사람보다 먼저): 어두워짐·표적·그을음·먼지·잔상·바닥 그림 이펙트 */
  function drawUnder(c: CanvasRenderingContext2D) {
    ctx = c;
    if (dark) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, dark * 0.9)})`; ctx.fillRect(VX0, 0, 1280, H); }
    drawFxUnder();
    drawSheets(true);
    for (const it of items) { ctx.fillStyle = '#c94a4a'; ctx.fillRect(it.x - 6, it.y - 14, 12, 14); ctx.fillStyle = '#eee'; ctx.fillRect(it.x - 4, it.y - 18, 8, 4); drawVfxAt('item_sparkle', it.x + 6, it.y - 20, 2, P.t - it.t0); }
  }
  /** 캐릭터(의자 포함) */
  function drawBody(c: CanvasRenderingContext2D) { ctx = c; drawPlayer(); }
  /** 중간 층(투사체·소환물·그림자 괴이) + 이펙트 층(1/3 크기 도트 층 + 그림 이펙트), 월드 좌표 */
  function drawFxLayer(c: CanvasRenderingContext2D) {
    ctx = c; drawMid();
    const main = c;
    for (const g of [fxN, fxL]) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fxNc.width, fxNc.height); g.setTransform(1 / FXS, 0, 0, 1 / FXS, -VX0 / FXS, 0); g.globalCompositeOperation = 'source-over'; }
    ctx = fxN; drawFx(false);
    ctx = fxL; fxL.globalCompositeOperation = 'lighter'; drawChargeAim(); drawHeat(); drawFx(true);
    ctx = main;
    ctx.drawImage(fxNc, VX0, 0, 1280, H);
    drawSheets();
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(fxLc, VX0, 0, 1280, H); ctx.globalCompositeOperation = 'source-over';
  }
  /** 화면 전체: 빈사 테두리·번쩍임·필살기 컷인 (화면 좌표) */
  function drawScreen(c: CanvasRenderingContext2D) {
    ctx = c;
    drawDying();
    if (flash) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, flash * 3)})`; ctx.fillRect(0, 0, 1280, H); }
    const w0 = W; W = 1280; drawCut(); W = w0;
  }
  return {
    P, A, CH, onPress, onRelease, takeHit, update, frameView, drawUnder, drawBody, drawFxLayer, drawScreen, armored,
    get hitstop() { return hitstop; }, get shake() { return shake; }, get zoom() { return zoom; }, get target() { return T; },
    knock, hit, stun, die, sitAt, rise, seatAct, runScene, playLife, lifeIds, emote, act, toIdle, has, nOf, SCENES,
    /** 시험장 전용 스위치: 필살 게이지 무시 */
    get freeSuper() { return freeSuper; }, set freeSuper(v: boolean) { freeSuper = v; },
    /** 시험장 의자 맞추기: 고친 값 묶음(바꾸면 바로 그림에 반영)·지금 맞춤 값 */
    chairEdits, chairFit,
  };
}
