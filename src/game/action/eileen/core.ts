// @ts-nocheck
// 에일린 테스트룸 전투 그대로 (tools/port_eileen_room.py가 room.html에서 떼어 와 만든 파일. 손으로 고치지 말고 변환기를 고친다).
// 바뀐 것: 샌드백(D) → env.targets()의 실제 적, 화면 고정값 → 지금 보이는 화면(VX0~W)·게임 바닥, 키 → env.held, 소리 → env.sfx, 체력 → 게임.
export function createEileenCore(env) {
  const A = env.A, IMG = env.IMG, VFX = env.VFX;
  let VX0 = 0, W = 1280, H = 720, FLOOR0 = 440, FLOOR1 = 669;
  const down = n => env.held.has(n);
  let ctx = null;
  const K = y => env.K(y);
  const store = { get: (k, d) => d, set() {} };
  const sfx = (type, extra = {}) => env.sfx(type, { x: P.x, ...extra });
  const marks = new Map();
  const targets = () => env.targets();
  /** 앞쪽 같은 줄에서 가장 가까운 적 */
  const frontTarget = (dy) => targets().filter(D => Math.abs(D.y - P.y) < dy && (D.x - P.x) * P.face > 0).sort((p, q) => Math.abs(p.x - P.x) - Math.abs(q.x - P.x))[0];
  /** 근접 판정: 같은 줄 앞쪽 사정거리 안의 적들 */
  function inReach(hx, pad = 60, hh = 100) {
    pad *= K(P.y);
    return targets().filter(D => { const dk = K(D.y), hOk = hh > D.z - 110 * dk && hh < D.z + 240 * dk; return Math.abs(D.y - P.y) < 64 && (D.x - P.x) * P.face > -20 && Math.abs(D.x - hx) < pad && hOk; });
  }
  /** 테스트룸 hurtDummy: 피해 숫자·게이지는 그대로, 맞는 반응은 게임 적에게 맡긴다 */
  function hurtDummy(D, dmg, kind, o = {}) {
    if ((marks.get(D.body) || 0) > 0) dmg = Math.round(dmg * 1.5);
    if (!(P.clip && (P.clip.id === '25' || P.clip.id === '25_1'))) gainSp(dmg * 0.45);
    const big = kind !== 'light';
    num(D.x + (Math.random() - 0.5) * 30, D.y - 200 - D.z, dmg, big);
    env.hurt(D, dmg, kind, P.face, hitstop, o);
  }
// PixelLab 이펙트 그림 재생: 2배 도트로, 기준점(pivot)을 x,y에
const vfxDur = name => VFX[name].frames.reduce((a, f) => a + f[4], 0) / 1000;
// PixelLab 이펙트 그림: o.flip(좌우), o.rot(회전), o.anchor('right' = 오른쪽 가운데를 x,y에), o.loop(반복, o.t 동안)
const vfx = (name, x, y, scale = 2, o = {}) => { if (!VFX[name]) return false; const d = vfxDur(name); const T = (o.t || d) + (o.hold || 0); fx.push({ k: 'sheet', name, x, y, s: scale, t0: T, t: T, dur: d, ...o }); return true; };
const has = id => !!A[id];
// 땅 동작 기준선: 모든 동작을 캔버스 아래 4px 선에 맞춤(이어지는 동작끼리 높이가 튀지 않게, 2026-10-24)
const BASE = a => a.h - 4;
const KNOCK_ARC = { '19_1': [0, 4, 16, 34, 44, 38, 22, 6, 0, 0, 0, 0] };   // 쓰러지기: 장마다 몸 아랫면을 바닥에 붙이고 뜨는 높이는 코드로
const ROOT = new Set(['38_1', '40', '37_1', '42_1']);   // 기는 동작: 그림 속에서 몸이 앞으로 나가 반복 때 뚝 끊김 → 몸을 늘 제자리에 두고 이동은 코드로
const groundBase = (id, a, f) => KNOCK_ARC[id] ? a.bot[f] : BASE(a);
// 이펙트는 1/3 크기 층에 그려 도트로 키움(캐릭터 도트와 맞춤). 빛나는 것은 가산 혼합 층
const FXS = 3, mkLayer = () => { const c = document.createElement('canvas'); c.width = 1280 / FXS; c.height = 720 / FXS; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
const [fxNc, fxN] = mkLayer(), [fxLc, fxL] = mkLayer();
const GLOW = new Set(['spark', 'ring', 'flash', 'impact', 'beam', 'mote', 'burst', 'fire', 'tracer', 'speed', 'scan', 'target']);
// ── 장 목록 도우미 ──
const R = (a, b) => { const r = []; if (a <= b) for (let i = a; i <= b; i++) r.push(i); else for (let i = a; i >= b; i--) r.push(i); return r; };
const S = (fr, d) => fr.map(f => ({ f, d }));
function impactOf(id) { const a = A[id]; let imp = 1; for (let f = 1; f < a.n; f++) if (a.reach[f] > a.reach[imp]) imp = f; return imp; }
// 준비 짧게 → 때리는 장 보여 줌 → 마무리 빠르게(캔슬 가능). 멈춤(히트스톱)은 맞았을 때만.
function atkSeq(id, heavy) {
  const a = A[id], imp = impactOf(id), s = [];
  for (let f = 0; f < a.n; f++) {
    if (f < imp) s.push({ f, d: f === 0 ? 0.04 : (heavy ? 0.06 : 0.045) });
    else if (f === imp) s.push({ f, d: heavy ? 0.13 : 0.08, ev: heavy ? 'hitH' : 'hit' });
    else s.push({ f, d: heavy ? 0.06 : 0.05, cancel: true });
  }
  return s;
}

// ── 상태 ──
const P = { x: 420, y: 580, z: 0, vz: 0, face: 1, mode: 'ground', combat: false, armed: false, clip: null, pvx: 0, pvy: 0, pdec: 0,
            jumps: 0, airAtk: false, airVX: 230, takeoff: 0, spin: 0, buf: null, chainT: 0, combo: 0, stunT: 0, idleT: 0, lastTap: {}, runLatch: false,
            hp: 100, sp: 0, heat: 0, overT: 0, lastShot: 0, chargeShown: 0, armorT: 0, inv: 0, charge: 0, ghostT: 0, dying: false, t: 0 };
let zoom = 0, zx = W / 2, zy = H / 2, dShake = 0;
let hitstop = 0, shake = 0, flash = 0, dark = 0, cut = 0, speed = 1, showNo = false, showDummy = true, counter = false, last = performance.now();
let freeSuper = false, showArmor = true, showCancelMark = true;
// 필살기 게이지: 때려 맞히거나 맞으면 참. 다 차면 몸에 금빛 기운
function gainSp(v) { if (P.noGain > P.t) return; const was = P.sp; P.sp = Math.min(100, P.sp + v); if (was < 100 && P.sp >= 100) { sfx('ability'); ring(P.x, P.y - 110 * K(P.y), 140, 0.4, '#ffd34a', 6); flash = 0.06; fx.push({ k: 'num', x: P.x - 50, y: P.y - 260 * K(P.y), v: '필살기 준비', t: 1.0 }); } }
function spReady() { if (freeSuper || P.sp >= 100) { if (!freeSuper) P.sp = 0; return true; } sfx('empty'); fx.push({ k: 'num', x: P.x - 50, y: P.y - 250 * K(P.y), v: '게이지 부족', t: 0.7 }); return false; }
let fx = [];
const items = [];   // 바닥 아이템(반짝임)
const KICK = new Set(['11', '12', '13', '14']);
function play(id, o = {}) {
  const a = A[id];
  P.clip = { id, seq: o.seq || S(R(0, a.n - 1), 1 / (o.fps || 10)), i: 0, t: 0, loopFrom: o.loopFrom ?? -1, onEnd: o.onEnd || null, done: false, paused: false };
  fireEv(P.clip.seq[0]);
}
const curF = () => P.clip ? P.clip.seq[Math.min(P.clip.i, P.clip.seq.length - 1)].f : 0;
const canCancel = () => { const c = P.clip; if (!c || c.done) return true; return !!c.seq[c.i].cancel; };
function tickClip(dt) {
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
const pushP = (vx, dec, vy = 0) => { P.pvx = vx; P.pvy = vy; P.pdec = dec; };

// 그림 속 위치 → 화면 위치 (좌우 반전 반영)
function framePt(id, f, px, py) {
  const a = A[id], flip = a.dir === 'SW' ? P.face > 0 : P.face < 0;
  const air = isAir(id);
  const base = air ? a.bot[f] : groundBase(id, a, f);
  const k = K(P.y);
  return { x: P.x + (flip ? -px : px) * k, y: P.y - P.z - (base - py) * k };
}
const isAir = id => P.mode === 'air' && (id === '7' || id === '14');
function muzzle() { const id = P.clip ? P.clip.id : 'W', f = curF(), a = A[id]; const m = (a.mz && a.mz[f]) || [a.reach[f], a.h * 0.45]; return framePt(id, f, m[0] + 1, m[1]); }
const mzAng = () => { const id = P.clip ? P.clip.id : 'W', a = A[id]; return (a.ang && a.ang[curF()]) || 0; };   // 이 장의 총열 각도(아래가 +)
const MZ_GAP = 30;   // 총알 그림은 총구에서 이만큼(그림 px × 크기) 띄운 곳부터 나타남

// ── 효과 ──
function sparks(x, y, n, big, col) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (big ? 520 : 280) * (0.35 + Math.random());
    fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, t: 0.16 + Math.random() * 0.18, c: col || (Math.random() < 0.5 ? '#fff' : '#ffd866'), s: big ? 5 : 3 }); }
}
const steam = (x, y, s = 1) => VFX.steam_wisp ? vfx('steam_wisp', x, y, 1.6) :  fx.push({ k: 'steam', x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 16, vy: -40 - Math.random() * 30, r: 1.6 * s, t: 0.6, t0: 0.6 });
const ring = (x, y, r, t, c, w = 4, sy = 1) => fx.push({ k: 'ring', x, y, r0: r * 0.2, r, t, t0: t, c, w, sy });
const num = (x, y, v, big) => fx.push({ k: 'num', x, y, v, t: 0.7, big });
const dust = (x, y, n, s = 1) => { for (let i = 0; i < n; i++) fx.push({ k: 'dust', x: x + (Math.random() - 0.5) * 30 * s, y, vx: (Math.random() - 0.5) * 160 * s, vy: -Math.random() * 60, r: 6 + Math.random() * 8 * s, t: 0.45, t0: 0.45 }); };
// 총 쏠 때 불꽃은 그림에 그려진 것만 씀(사용자 2026-10-24) — 코드는 탄피만
function muzzleFlash(p, big) {
  for (let i = 0; i < (big ? 3 : 1); i++) fx.push({ k: 'shell', x: p.x - P.face * 30, y: p.y, vx: -P.face * (80 + Math.random() * 80), vy: -220 - Math.random() * 120, g: P.y, t: 1.2 });
}

function fireEv(e) {
  if (e && e.fn) e.fn();
  if (!e || !e.ev) return;
  const id = P.clip.id, a = A[id], f = e.f;
  if (e.ev === 'hit' || e.ev === 'hitH' || e.ev === 'hitL') {
    const big = e.ev !== 'hit';
    const p = framePt(id, f, a.reach[f], a.h * (e.hy || 0.42));   // 슬라이딩은 발끝 높이(hy)
    const tg = inReach(p.x, big ? 100 : 70, P.y - p.y);
    if (tg.length) {   // 때리는 높이 = 바닥에서 타점까지
      // 맞았을 때만: 살짝 멈춤 + 샌드백 경직
      hitstop = big ? 0.16 : 0.085; shake = big ? 16 : 8; dShake = big ? 11 : 7;
      for (const t of tg) hurtDummy(t, big ? 34 : 12, e.kind || (e.ev === 'hitL' ? 'launch' : big ? 'heavy' : 'light'));
      const D = tg[0];
      sfx('hit', { strength: big ? 3 : 1, kind: KICK.has(id) ? 'kick' : undefined });
      const cx = D.x - P.face * 18 * K(D.y);
      // 맞은 자리: 번쩍 + 초승달 타격선 + 불꽃 + 충격 고리
      if (!vfx(big ? 'hit_heavy' : 'hit_light', cx, p.y, big ? 2 : 2.4, { flip: P.face < 0 })) fx.push({ k: 'impact', x: cx, y: p.y, dir: P.face, t: big ? 0.16 : 0.1, t0: big ? 0.16 : 0.1, big });
      sparks(cx, p.y, big ? 30 : 12, big, Math.random() < 0.5 ? '#ffffff' : '#d6ecff');   // 맨손·발차기 = 불꽃이 아니라 하얀 충격 조각
      ring(cx, p.y, big ? 110 : 50, big ? 0.24 : 0.14, '#ffffff', big ? 7 : 3);
      if (big) {   // 강: 화면 당김(줌) + 집중선 + 바닥 충격파 + 먼지
        zoom = 0.06; zx = cx; zy = p.y; flash = 0.07;
        fx.push({ k: 'speed', x: cx, y: p.y, t: 0.2, t0: 0.2 });
        ring(D.x, D.y, 150, 0.35, 'rgba(255,255,255,.7)', 4, 0.25);
        dust(D.x, D.y, 10, 1.6);
      }
    }
  } else if (e.ev === 'shot' || e.ev === 'shotS' || e.ev === 'shotH') {
    const big = e.ev === 'shotH', p = muzzle();
    if (id === '15') {   // 원거리 연사: 총열 열이 차면 과열 → 쿨다운
      P.heat = Math.min(100, P.heat + 9); P.lastShot = P.t;
      if (P.heat >= 100) { P.overT = 2.6; sfx('empty'); for (let i = 0; i < 8; i++) steam(p.x, p.y, 1.4); }
    }
    muzzleFlash(p, big || e.ev === 'shotS'); sfx('shot');
    const D = frontTarget(60), hitD = !!D;
    const endX = hitD ? D.x - P.face * 14 : (P.face > 0 ? W + 20 : VX0 - 20);
    if (VFX.tracer) { const tt = Math.abs(endX - p.x) / 3400; { const g = mzAng(), gp = MZ_GAP * K(P.y), sx = p.x + P.face * Math.cos(g) * gp, sy = p.y + Math.sin(g) * gp; fx.push({ k: 'bullet', x: sx, y: sy, x2: endX, y2: sy + Math.abs(endX - sx) * Math.tan(g) + (Math.random() - 0.5) * 24, t: tt, t0: tt }); } if (hitD) later(tt, () => { if (!vfx('bullet_hit_body', endX, p.y, 2)) sparks(endX, p.y, 4, false, '#fff6d0'); }); } else fx.push({ k: 'tracer', x: p.x, y: p.y, x2: endX, t: big ? 0.12 : 0.06, big });
    shake = Math.max(shake, big ? 9 : 2.5);
    if (hitD) { sfx('hit', { strength: big ? 2 : 1, kind: 'bullet' }); hurtDummy(D, big ? 40 : e.ev === 'shotS' ? 9 : 7, big ? 'heavy' : 'light'); sparks(endX, p.y, big ? 16 : 5, big); if (big) hitstop = 0.08; }
  } else if (e.ev === 'beam') {
    const p = P.relMz || muzzle(), lv = P.chargeLv; P.relMz = null;
    muzzleFlash(p, true); sfx('shot'); sfx('hit', { strength: 3, kind: 'bullet' });
    // 단계마다 다르게: 1단 = 가는 흰 광선, 2단 = 굵은 푸른 광선 + 충격파, 3단(최대) = 보라 대구경 + 화면 번쩍·띄우기
    const W_ = [0, 10, 24, 40][lv], col = CH_COL[lv];
    if (VFX.charge_beam) fx.push({ k: 'beamS', x: p.x, y: p.y, dir: P.face, t: 0.22 + lv * 0.1, t0: 0.22 + lv * 0.1, sy: [0, 0.35, 0.6, 0.9][lv] });
    else fx.push({ k: 'beam', x: p.x, y: p.y, dir: P.face, t: 0.22 + lv * 0.08, t0: 0.22 + lv * 0.08, w: W_, c: col, lv });
    if (lv >= 3) { flash = 0.2; dust(P.x - P.face * 30, P.y, 10, 1.6); }
    shake = [0, 8, 15, 24][lv];
    for (const D of targets().filter(D => Math.abs(D.y - P.y) < 30 + W_ && (D.x - P.x) * P.face > 0)) { hitstop = [0, 0.08, 0.15, 0.24][lv]; hurtDummy(D, [0, 30, 60, 110][lv], lv >= 2 ? 'launch' : 'heavy'); sparks(D.x, p.y, 10 + lv * 10, true, col); ring(D.x, p.y, 50 + lv * 30, 0.3, col, 4); }
  } else if (e.ev === 'cut') { sfx('super'); cut = 1.1; dark = 2.6; flash = 0.15; hitstop = 0.25; }
  else if (e.ev === 'scan') { sfx('ability'); fx.push({ k: 'scan', x: P.x, y: P.y - 190, dir: P.face, t: 0.55, t0: 0.55 }); }
  else if (e.ev === 'mark') { for (const D of targets().filter(D => (D.x - P.x) * P.face > 0 && Math.abs(D.y - P.y) < 120)) { marks.set(D.body, 6); ring(D.x, D.y - 230, 40, 0.3, '#ff5a4a', 3); } }
  else if (e.ev === 'sup') {   // 제압사격: 앞 땅 부채꼴에 쏟아부음 — 맞으면 밀려나고 경직(못 움직임)
    const p = muzzle(); sfx('shot');
    // 탄착 = 사용자가 그려 준 부채꼴(2026-10-25): 총구에서 앞으로 (총구~발 높이)의 1.25~2.65배 거리 땅에 고르게 촘촘히 — 약 21°~39° 아래
    const dir = P.face, drop = Math.max(40, P.y - p.y), dist = drop * (1.25 + Math.random() * 1.4);
    const gx = p.x + dir * dist, gy = P.y + (Math.random() - 0.5) * 18 * K(P.y), ang = Math.atan2(gy - p.y, dist), cosA = Math.cos(ang), sinA = Math.sin(ang);
    fx.push({ k: 'shell', x: p.x - dir * 30, y: p.y, vx: -dir * (80 + Math.random() * 80), vy: -220 - Math.random() * 120, g: P.y, t: 1.2 });
    const gp = MZ_GAP * K(P.y), sx = p.x + dir * cosA * gp, sy = p.y + sinA * gp, tt = Math.hypot(gx - sx, gy - sy) / 3200;
    if (VFX.tracer) fx.push({ k: 'bullet', x: sx, y: sy, x2: gx, y2: gy, t: tt, t0: tt });
    later(tt, () => { sparks(gx, gy - 3, 4, false, '#ffe9a0'); if (Math.random() < 0.4) dust(gx, gy, 1, 0.4); });
    shake = Math.max(shake, 4);
    // 맞음: 샌드백이 총알 줄 위(앞쪽, 같은 줄)에 있으면
    for (const D of targets()) {
    const ddx = (D.x - p.x) * dir;
    if (ddx > 30 && ddx < dist + 40 && Math.abs(D.y - P.y) < 70) {
      const bulletY = p.y + ddx * Math.tan(ang), dk = K(D.y);
      if (bulletY > D.y - D.z - 220 * dk && bulletY < D.y - D.z + 10) {
        later(ddx / 3200, () => { hurtDummy(D, 7, 'light', { push: 5 }); if (!vfx('bullet_hit_body', D.x - dir * 10, bulletY, 2)) sparks(D.x, bulletY, 4, false, '#fff6d0'); hitstop = Math.max(hitstop, 0.012); });
      }
    }
    }
  }
  else if (e.ev === 'rocket') {
    const p = muzzle(); sfx('shot'); sfx('super'); backblast(p); muzzleFlash(p, true); shake = 16; hitstop = 0.06;
    fx.push({ k: 'rocket', x: p.x + P.face * 20, x0: P.x, y: p.y, gy: P.y, dir: P.face, t: 5 });
  }
  else if (e.ev === 'slideHit') {   // 슬라이딩: 발끝이 지나가는 동안 매 장 판정
    if (!P.slideHit) { const p = framePt(id, f, a.reach[f], a.h * 0.8); if (targets().some(D => Math.abs(D.y - P.y) < 64 && Math.abs(D.x - p.x) < 70 * K(P.y))) { P.slideHit = true; fireEv({ f, ev: 'hit', hy: 0.88 }); } }
  }
  else if (e.ev === 'dust') { dust(P.x, P.y, 6, 1.2); sfx(P.clip.id === '19' || P.clip.id === '19_1' ? 'down' : 'step'); }
}

function explode(x, y, gy, hitD, dmg = 140) {
  sfx('hit', { strength: 3, kind: 'super' });
  shake = Math.max(shake, 14); flash = Math.max(flash, dmg >= 140 ? 0.2 : 0.04); if (hitD) hitstop = 0.2;
  if (VFX['eileen-rpg-explosion']) { vfx('eileen-rpg-explosion', x, gy - 4, 2.4); ring(x, gy, 220, 0.45, 'rgba(255,230,180,.9)', 6, 0.28); if (!vfx('crater', x, gy, 2.2, { hold: 2.5, under: true })) fx.push({ k: 'scorch', x, y: gy, r: 90, t: 3.5 }); dust(x, gy, 10, 2); for (const D of targets()) if (Math.abs(D.x - x) < 200 && Math.abs(D.y - gy) < 70) hurtDummy(D, dmg, 'launch'); return; }
  for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 380; fx.push({ k: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 60, r: 10 + Math.random() * 16, t: 0.5 + Math.random() * 0.4, t0: 0.9 }); }
  for (let i = 0; i < 16; i++) fx.push({ k: 'smoke', x: x + (Math.random() - 0.5) * 80, y: y + (Math.random() - 0.5) * 50, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 70, r: 16 + Math.random() * 14, t: 1.4 + Math.random() * 0.6, t0: 2 });
  sparks(x, y, 40, true, '#ffb347');
  ring(x, gy, 220, 0.45, 'rgba(255,230,180,.9)', 6, 0.28);
  fx.push({ k: 'scorch', x, y: gy, r: 90, t: 3.5 });
  dust(x, gy, 14, 2.2);
  for (const D of targets()) if (Math.abs(D.x - x) < 200 && Math.abs(D.y - gy) < 70) hurtDummy(D, dmg, 'launch');
}
function backblast(p) {
  p = { x: P.x - P.face * 70 * K(P.y), y: p.y };   // 발사관 뒤 = 몸 뒤쪽
  for (let i = 0; i < 14; i++) fx.push({ k: 'fire', x: p.x, y: p.y, vx: -P.face * (200 + Math.random() * 400), vy: (Math.random() - 0.5) * 160, r: 8 + Math.random() * 10, t: 0.3 + Math.random() * 0.25, t0: 0.55 });
  for (let i = 0; i < 10; i++) fx.push({ k: 'smoke', x: p.x - P.face * 20, y: p.y, vx: -P.face * (60 + Math.random() * 160), vy: -20 - Math.random() * 40, r: 12 + Math.random() * 10, t: 1.2, t0: 1.2, c: 150 });
  dust(P.x - P.face * 90, P.y, 10, 1.8);
}

// ── 흐름 ──
function toIdle() { P.mode = 'ground'; P.clip = null; P.combo = 0; P.idleT = 0; }
function act(id, o = {}) { P.mode = o.mode || 'act'; play(id, { ...o, onEnd: o.onEnd || (() => afterBuf(toIdle)) }); }
function reverseOut(id, frames, d, then) { P.mode = 'act'; play(id, { seq: S(frames, d), onEnd: then || (() => afterBuf(toIdle)) }); }
function ensureArmed(then) {
  if (P.armed) return then();
  P.combat = true; sfx('reload'); act('W', { seq: S(R(0, 3), 0.04), onEnd: () => { P.armed = true; then(); } });
}
function afterBuf(fallback) {
  const b = P.buf; P.buf = null;
  if (b === 'light') return light();
  if (b === 'heavy') return heavy();
  if (b === 'dodge') return dodge();
  if (b === 'jump') return jump();
  fallback();
}
const ARMOR = new Set(['12', '13', '23', '24', '25', '22_1', '25_1', '25_2']);
// 슈퍼아머: 강 공격·슬라이딩·충전·기술·필살기 중, 그리고 일어나는 동안과 일어난 뒤 0.6초
const armored = () => P.wakeArmor > 0 || (P.clip && (P.clip.id === '20' || ARMOR.has(P.clip.id)) && (P.mode === 'act' || P.mode === 'charge'));

// ── 공격 ──
function light() {
  P.combat = true; P.armed = false;
  if (P.combo >= 3) P.combo = 0;
  const id = ['9', '10', '11'][P.combo]; P.combo++; sfx('whiff');
  pushP(170, 900);
  act(id, { seq: atkSeq(id, false), onEnd: () => {
    if (id === '11') { P.blowWin = P.t + 0.35; P.combo = 0; return afterBuf(toIdle); }   // 약3 뒤 잠깐은 강 = 날리기
    if (P.buf) return afterBuf(toIdle);
    P.mode = 'chain'; P.chainT = 0.26;   // 친 자세로 잠깐 → 이어지지 않으면 거꾸로 틀어 전투 자세로
  } });
}
function heavy() {
  const prev = P.combo || (P.t < (P.blowWin || 0) ? 3 : 0);   // 콤보 마무리: 단독·약1 → 스턴, 약2 → 띄우기, 약3 → 날리기
  const kind = prev === 2 ? 'launch' : prev >= 3 ? 'blow' : 'stun'; P.lastHeavy = kind;
  sfx('whiff', { strength: 2 }); P.combat = true; P.armed = false; P.combo = 0; pushP(140, 700);
  act('12', { seq: atkSeq('12', true).map(e => e.ev ? { ...e, kind } : e) });
}
function chainExpire() { const id = P.clip.id; P.combo = 0; reverseOut(id, R(A[id].n - 1, 0), 0.03); }
function slide() {
  P.combat = true; P.combo = 0; pushP(840, 1150);
  P.slideHit = false;
  act('13', { seq: atkSeq('13', false).map((e, i, all) => i === 1 ? { ...e, ev: 'dust' } : (i >= 2 && i <= all.length - 2) ? { ...e, ev: 'slideHit' } : e) });
}
function dodge() {
  P.combat = true; P.combo = 0;
  let dx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0), dy = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
  if (!dx && !dy) dx = -P.face;                        // 아무 방향 없으면 뒤로
  if (dx && dx === P.face && P.prevFace === -dx && P.t - P.faceT < 0.3) P.face = P.prevFace;   // 뒤쪽 키로 막 돌아선 경우 = 뒤 회피
  const fwd = dx * P.face > 0, len = Math.hypot(dx, dy);
  sfx('evade'); P.dodgeV = { x: dx / len * 780, y: dy / len * 520 }; P.inv = 0.3; P.ghostT = 0.2;
  P.pvx = 0; P.pdec = 0;
  act(fwd ? '16_1' : '16', { seq: S(R(0, 7), 0.04).map((e, i) => i >= 6 ? { ...e, cancel: true } : e), onEnd: () => { P.dodgeV = null; afterBuf(toIdle); } });
}
function shoot() {
  if (P.overT > 0) {   // 과열: 총은 올려 겨누고 방아쇠만 철컥(반동 한 틱), 총알은 안 나감
    return ensureArmed(() => act('15', { seq: [{ f: 0, d: 0.03 }, { f: 1, d: 0.035 }, { f: 2, d: 0.035 }, { f: 3, d: 0.06, fn: () => { sfx('empty'); const p = muzzle(); steam(p.x, p.y, 1); } }, { f: 4, d: 0.04 }, { f: 3, d: 0.25 }, { f: 5, d: 0.05 }, { f: 6, d: 0.05 }, { f: 7, d: 0.05 }] }));
  }
  ensureArmed(() => {
    const s = [{ f: 0, d: 0.03 }, { f: 1, d: 0.035 }, { f: 2, d: 0.035 }, { f: 3, d: 0.05, ev: 'shot' }, { f: 4, d: 0.06, rep: { key: 'shoot', to: 3 } }, { f: 5, d: 0.05 }, { f: 6, d: 0.05 }, { f: 7, d: 0.05 }];
    act('15', { seq: s });
  });
}
function skill() {
  if (!has('22_1')) return skillOld();
  ensureArmed(() => {
    const a = A['22_1'], s = [{ f: 0, d: 0.04 }, { f: 1, d: 0.05 }];
    for (let f = 2; f <= a.n - 2; f++) for (let k = 0; k < 4; k++) s.push({ f, d: 0.05, ev: 'sup' });   // 발 수 많게(초당 20발)
    s.push({ f: a.n - 1, d: 0.07 });
    act('22_1', { seq: s });
  });
}
// 필살기 「증명해.」 지원 포격(2026-10-24): 판독 동작으로 손가락이 세 곳을 짚으면 그 자리에 표적 → 포탄이 연달아 떨어져 폭발
const later = (t, fn) => fx.push({ k: 'timer', t, fn });
function artillerySuper(chained) {
  if (!chained && !spReady()) return;
  ensureArmed(() => {
    const a = A['22'];
    // 떨어질 자리를 먼저 정하고, 손가락으로 짚을 때마다 그 자리들에 표적을 찍음 → 포탄은 정확히 표적에 떨어짐
    const spots = [];
    for (let k = 0; k < 12; k++) spots.push({ x: VX0 + 60 + Math.random() * (W - VX0 - 120), y: FLOOR0 + 30 + Math.random() * (FLOOR1 - FLOOR0 - 30) });
    for (const D of targets()) if (D.x > VX0 && D.x < W) spots.splice(Math.random() * spots.length | 0, 0, { x: D.x, y: D.y });
    const marks = spots.map(sp => ({ k: 'target', x: sp.x, y: sp.y, t: 8 }));
    const paint = g => { marks.forEach((m, n) => { if (n % 3 === g) fx.push(m); }); sfx('ui'); };
    const s = chained ? [{ f: 0, d: 0.08 }] : [{ f: 0, d: 0.3, ev: 'cut' }];
    for (let f = 1; f < a.n; f++) s.push({ f, d: f === 2 || f === 4 || f === 6 ? 0.28 : 0.1, fn: f === 2 ? () => paint(0) : f === 4 ? () => paint(1) : f === 6 ? () => paint(2) : null });
    act('22', { seq: s, onEnd: () => {
      P.noGain = P.t + 6;   // 필살기 피해로는 게이지가 안 참
      marks.forEach((m, i) => later(0.2 + i * 0.13 + Math.random() * 0.08, () => {
        fx.push({ k: 'mortar', x: m.x, y: m.y, t: 0.32, t0: 0.32 }); sfx('whiff', { strength: 2 });
        later(0.32, () => { explode(m.x, m.y - 10, m.y, false, 55); m.t = 0; });
      }));
      afterBuf(toIdle);
    } });
  });
}
function rocketSuper() {
  if (!has('25_1')) return superMove(false);
  if (!spReady()) return;
  P.armed = false; P.combat = true;
  const a = A['25_1'];
  // 바주카: 꺼내기(25_1) → 발사(25_2, 첫 반동 장에서 로켓) → 꺼내기를 거꾸로 틀어 등 뒤로 넣기(사용자 제안)
  // 앞 바닥에서 집어 들어 어깨에 멤(6차, 2026-10-24) — 집는 장은 조금 천천히, 메는 장은 빠르게
  const s = [{ f: 0, d: 0.3, ev: 'cut' }, { f: 0, d: 0.35 }, { f: 1, d: 0.1 }, { f: 2, d: 0.12 }, { f: 3, d: 0.1 }, { f: 4, d: 0.08 }, { f: 5, d: 0.08 }, { f: 6, d: 0.08 }, { f: 7, d: 0.1 }];
  if (has('25_2')) { const b = A['25_2']; s.push({ f: a.n - 1, d: 0.25 }); }
  act('25_1', { seq: s, onEnd: () => {
    if (!has('25_2')) return afterBuf(toIdle);
    const b = A['25_2'];
    act('25_2', { seq: [{ f: 0, d: 0.12 }, { f: Math.min(1, b.n - 1), d: 0.22, ev: 'rocket' }, ...S(R(2, b.n - 1), 0.09), { f: 0, d: 0.45 }], onEnd: () => reverseOut('25_1', R(a.n - 1, 0), 0.07, () => { P.combat = true; toIdle(); }) });   // 넣을 땐 거꾸로: 어깨에서 내려 바닥에 둠
  } });
}
const ROCKET_FIRE = 6;   // 발사 장: 7번째 장(2026-10-24 4차 결과 보고 정함)
function skillOld() {
  ensureArmed(() => act('22', { seq: S(R(0, 7), 0.09).map((e, i) => i === 1 ? { ...e, ev: 'scan' } : i === 5 ? { ...e, ev: 'mark' } : e) })); }
const CH_COL = ['rgba(255,255,255,.8)', '#fff6c0', '#8fdcff', '#c89bff'];
function charge() {
  ensureArmed(() => { P.mode = 'charge'; P.charge = 0; P.chargeShown = 0; play('23', { seq: [...S(R(0, 3), 0.055), ...S(R(4, 7), 0.11)], loopFrom: 4 }); });
}
function release() {
  P.chargeLv = P.charge >= 2 ? 3 : P.charge > 1.3 ? 2 : P.charge > 0.5 ? 1 : 0;
  P.relMz = muzzle();   // 떼는 순간(겨눈 자세)의 총구 — 광선은 여기서 나감
  if (P.chargeLv >= 2) pushP(-320, 900);   // 큰 반동
  // 떼는 순간 바로 발사(첫 장 총구에서), 그 뒤 반동
  const aimF = curF();
  act('23', { seq: [{ f: aimF, d: 0.12, ev: P.chargeLv ? 'beam' : 'shotH' }], onEnd: () => act('24', { seq: S(R(1, A['24'].n - 1), 0.06) }) });   // 광선은 겨눈 장에서, 반동은 그다음
}
function superMove(free, then) {
  if (!free && !spReady()) return;
  ensureArmed(() => {
    const a = A['25'];
    const peaks = R(4, a.n - 2).sort((p, q) => a.top[q] - a.top[p]).slice(0, 2).sort((p, q) => p - q);
    const s = [{ f: 0, d: 0.35, ev: 'cut' }];
    for (let f = 1; f <= peaks[0] - 1; f++) s.push({ f, d: 0.07 });
    for (let k = 0; k < 16; k++) s.push({ f: peaks[k % 2], d: 0.055, ev: 'shotS' });   // 난사: 반동 장 두 개를 번갈아
    s.push({ f: peaks[1], d: 0.2, ev: 'shotH' });
    for (let f = peaks[1] + 1; f < a.n; f++) s.push({ f, d: 0.07, ev: a.flash && a.flash[f] ? 'shotS' : undefined });   // 그림에 불꽃이 있는 장은 총알도
    act('25', { seq: s, onEnd: then || (() => afterBuf(toIdle)) });
  });
}
// 필살기 「증명해.」(사용자 2026-10-24): 무릎 쏴 난사(옛 25) → 판독으로 표적 → 포격
function proveSuper() { if (!spReady()) return; P.noGain = P.t + 12; superMove(true, () => artillerySuper(true)); }

// ── 이동·점프 ──
function jump() {
  P.mode = 'air'; P.vz = 0; P.jumps = 1; P.airAtk = false; P.spin = 0;
  P.airVX = (down('run') || P.runLatch) ? 430 : 250; P.takeoff = 0.06; sfx('jump');
  play('7', { seq: S([0, 1], 0.03) });
}
function doubleJump() {
  sfx('jump', { pitch: 1.35 }); P.jumps = 2; P.vz = 1040; P.spin = 0.2; play('7', { seq: S([1, 2, 3], 0.065) });
  // 발밑 공기 터짐
  if (!vfx('double_jump', P.x, P.y - P.z + 2, 2.2)) fx.push({ k: 'burst', x: P.x, y: P.y - P.z + 4, t: 0.3, t0: 0.3 });
  ring(P.x, P.y - P.z + 4, 70, 0.25, 'rgba(220,240,255,.9)', 4, 0.35);
}
function jumpAttack(heavyKind) {
  P.airAtk = true;
  play('14', { seq: atkSeq('14', heavyKind).map((e, i, s) => ({ ...(e.ev ? { ...e, ev: heavyKind ? 'hitH' : 'hit', kind: heavyKind ? 'spike' : undefined } : e), d: i === s.length - 1 ? 9 : e.d })) });
}
function land() {
  sfx('land'); P.z = env.ground(P.x, P.y); P.vz = 0; P.airAtk = false; shake = Math.max(shake, 2); if (!vfx('land_dust', P.x, P.y - P.z, 2.2)) dust(P.x, P.y - P.z, 5);
  P.mode = 'act';
  play('7', { seq: [{ f: 6, d: 0.045, cancel: true }, { f: 7, d: 0.05, cancel: true }], onEnd: toIdle });
}

// ── 피격·반응 ──
function takeHit(kind) {
  if (P.inv > 0) { fx.push({ k: 'num', x: P.x, y: P.y - 230, v: '회피', t: 0.6 }); return; }
  if (P.mode === 'block') { sfx('guard'); shake = 4; if (!vfx('guard_block', P.x + P.face * 50 * K(P.y), P.y - 140 * K(P.y), 2.2, { flip: P.face < 0 })) sparks(P.x + P.face * 50, P.y - 140, 8, false, '#9fd0ff'); pushP(-200, 1200); P.hp = Math.max(1, P.hp - 1); return; }
  if (armored()) { gainSp(5); sfx('armor'); P.armorT = 0.28; hitstop = 0.06; shake = 6; return; }   // 슈퍼아머: 버팀
  if (kind === 'knock') return knock();
  hit();
}
function hit() { gainSp(10); sfx('hurt'); P.combat = true; P.combo = 0; P.armed = false; pushP(-280, 1400); flash = 0.05; act('18', { seq: [{ f: 0, d: 0.02 }, ...S(R(1, A['18'].n - 1), 0.055)] }); }
function knock() {
  gainSp(20); sfx('hurt', { strength: 2 }); P.combat = true; P.combo = 0; P.armed = false; pushP(-560, 650); shake = 8;
  const kid = has('19_1') ? '19_1' : '19';   // 남동판이 있으면 그걸로(사용자 2026-10-24)
  // 남동판 2·3장은 그림에 궤적이 그려져 있어 뺌
  if (kid === '19_1' && A['19_1'].n >= 12) {
    P.mode = 'act';
    // 누운 숨: 가슴만 다른 두 장만 천천히 오감 — 팔다리가 들썩이지 않게
    play('19_1', { seq: [...S(R(0, 7), 0.07).map((e, i) => i === 5 ? { ...e, ev: 'dust' } : e), { f: 8, d: 0.6 }, { f: 10, d: 0.6 }], loopFrom: 8 });   // 동판(2026-10-24): 1~8 쓰러짐, 9·11번째 장 = 가슴만 다른 두 장
    P.knockT = 0.56; return;   // 쓰러지는 장이 끝나면 누운 상태(들썩임은 계속 반복)
  }
  act(kid, { seq: S(R(0, 7), 0.065).map((e, i) => i === 5 ? { ...e, ev: 'dust' } : e), onEnd: () => { P.mode = 'down'; } });
}
function getUp() { sfx('wakeup'); P.knockT = 0; act('20', { seq: S(R(0, 7), 0.06), onEnd: () => { P.wakeArmor = 0.6; afterBuf(toIdle); } }); }
function belly() {
  P.mode = 'belly';
  if (has('38_1')) return play('38', { seq: S(R(0, A['38'].n - 1), 0.1), onEnd: () => { if (P.mode === 'belly') play('38_1', { fps: 8, loopFrom: 0 }); } });
  play('38', { seq: [...S(R(0, 3), 0.11), ...S(R(4, 11), 0.1)], loopFrom: 4 });
}
function stun() {
  P.combat = true; P.combo = 0; P.armed = false; P.mode = 'stun'; P.stunT = 2.6;
  play('21', { seq: [{ f: 0, d: 0.05 }, ...S(R(1, 7), 0.1)], loopFrom: 1 });
}
function emote(id, fps, o = {}) { act(id, { seq: S(R(0, A[id].n - 1), 1 / fps), ...o }); }
function sit() { P.mode = 'sit'; play('39', { seq: [{ f: 0, d: 0.04 }, { f: 2, d: 0.035 }, { f: 4, d: 0.035 }, { f: 6, d: 0.06 }, ...S(R(7, 11), 0.13)], loopFrom: 4 }); }   // 털썩: 내려앉는 장을 건너뛰며 빠르게
function sitLoop() { P.mode = 'sit'; play('39', { seq: S(R(7, 11), 0.13), loopFrom: 0 }); }
function crouch() { P.mode = 'crouch'; play('41', { seq: [...S(R(0, 3), 0.08), ...S(R(4, 7), 0.11)], loopFrom: 4 }); }

function onPress(a) {
  if (a === 'left' || a === 'right') { const now = performance.now(); if (now - (P.lastTap[a] || 0) < 260) P.runLatch = true; P.lastTap[a] = now; }
  if (a === 'heal' && P.mode === 'ground') { emote('26', 7); later(0.5, () => { P.hp = Math.min(100, P.hp + 40); if (P.hp > 25) P.dying = false; vfx('heal', P.x, P.y + 4, 3.6 * K(P.y)); P.healT = 0.8; fx.push({ k: 'num', x: P.x - 20, y: P.y - 240 * K(P.y), v: '+40', t: 0.9 }); sfx('heal'); }); return; }
  if (a === 'drop') { items.push({ x: P.x + P.face * 120, y: P.y, t0: P.t }); return; }
  if (a === 'status') { P.status = [null, 'status_poison', 'status_burn', 'status_shock'][([null, 'status_poison', 'status_burn', 'status_shock'].indexOf(P.status || null) + 1) % 4]; return; }
  if (a === 'dying') { P.dying = !P.dying; P.hp = P.dying ? 18 : 100; if (P.dying) sfx('hp:low'); return; }
  if (a === 'hit' || a === 'knock') { if (P.mode !== 'down' && P.mode !== 'belly') return takeHit(a === 'knock' ? 'knock' : 'hit'); }
  if ((P.mode === 'flee' || P.mode === 'back') && !['left', 'right', 'up', 'down', 'run'].includes(a)) toIdle();
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
  }
  if (m === 'act') {
    const CANCEL_INTO = { skill, super: rocketSuper, shoot, charge };   // 공격 뒤 캔슬 구간 → 기술·필살기·원거리·충전
    if (CANCEL_INTO[a] && canCancel() && P.clip && ['9', '10', '11', '12', '13', '16', '16_1'].includes(P.clip.id)) { P.buf = null; return CANCEL_INTO[a](); }
    if (['light', 'heavy', 'dodge', 'jump'].includes(a)) {
      const id = P.clip && P.clip.id;
      if (canCancel() && ['9', '10', '11', '12', '13', '16', '16_1', '7'].includes(id)) {
        if (id === '7') { if (a === 'jump') return jump(); }
        else if (id === '9' || id === '10') { P.buf = a; return; }
        else { P.buf = null; return a === 'light' ? light() : a === 'heavy' ? heavy() : a === 'dodge' ? dodge() : jump(); }
      }
      P.buf = a;
    }
    return;
  }
  if (m === 'down') { if (a === 'crawl') return belly(); if (a === 'jump' || a === 'up' || a === 'light') return getUp(); return; }
  if (m === 'belly') { if (a === 'jump' || a === 'crawl') return getUp(); return; }
  if (m === 'stun') { P.stunT -= 0.18; return; }
  if (m === 'sit' || m === 'scoot') { if (a === 'sit') reverseOut('39', R(6, 0), 0.05); return; }
  if (m === 'crouch' || m === 'crawl4') { if (a === 'crouch') { if (m === 'crawl4') toIdle(); else reverseOut('41', R(3, 0), 0.06); } return; }
  if (m !== 'ground') return;
  const running = down('run') || P.runLatch;
  const moving = down('left') || down('right') || down('up') || down('down');
  switch (a) {
    case 'jump': return jump();
    case 'light': return running && moving ? slide() : light();
    case 'heavy': return heavy();
    case 'dodge': return dodge();
    case 'block': P.combat = true; P.armed = false; P.mode = 'block'; return play('17', { seq: S(R(0, 7), 0.03) });
    case 'shoot': return shoot();
    case 'skill': return skill();
    case 'charge': return charge();
    case 'super': return proveSuper();
    case 'skillOld': return skillOld();
    case 'superOld': return superMove(false);
    case 'combat':
      if (P.armed) return;
      if (!P.combat) return act('3_0', { seq: S(R(0, 3), 0.055), onEnd: () => { P.combat = true; toIdle(); } });
      return reverseOut('3_0', R(3, 0), 0.055, () => { P.combat = false; toIdle(); });
    case 'weapon':
      if (!P.armed) return ensureArmed(toIdle);
      return reverseOut('W', R(3, 0), 0.05, () => { P.armed = false; toIdle(); });
    case 'stun': return stun();
    case 'respond': return emote('28', 7, { seq: [{ f: 0, d: 0.1 }, { f: 1, d: 0.1 }, { f: 2, d: 0.12 }, { f: 3, d: 0.6 }, { f: 2, d: 0.12 }, { f: 1, d: 0.1 }, { f: 0, d: 0.15 }] });
    case 'talk': return emote('29', 7, { seq: [...S([0, 1, 2], 0.16), { f: 3, d: 0.35 }, ...S([2, 1], 0.16), { f: 0, d: 0.6 }, ...S([1, 2], 0.16), { f: 3, d: 0.35 }, ...S([2, 1, 0], 0.16)] });
    case 'nod': return emote('30', 8, { seq: S([...R(0, 3), ...R(0, 3)], 1 / 8) });   // 기본 그림 그대로 두 번
    // 고개 젓기: 한쪽 끝·반대쪽 끝에서 살짝 머물고 가운데는 빨리 지나감 × 2
    case 'shake': return emote('31', 8, { seq: S([...R(0, 3), ...R(0, 3)], 1 / 8) });   // 기본 그림 그대로 두 번
    case 'angry': return emote('32', 9);
    case 'happy': return emote('35', 8);
    case 'surprise': return emote('34', 8, { seq: [...S(R(0, 1), 0.06), { f: 2, d: 0.35 }, ...S(R(3, A['34'].n - 1), 0.12)] });
    case 'eat': return emote('26', 7, { seq: A['26'].n === 8 ? [...S(R(0, 2), 0.12), ...S(R(3, 5), 0.22), ...S(R(6, 7), 0.2)] : undefined });
    case 'pick': { const it = items.findIndex(it => Math.abs(it.x - P.x) < 110 && Math.abs(it.y - P.y) < 40); if (it >= 0) { items.splice(it, 1); later(0.45, () => { sfx('pickup'); P.hp = Math.min(100, P.hp + 20); vfx('heal', P.x, P.y + 4, 3 * K(P.y)); P.healT = 0.6; }); } return emote('27', 8); }
    case 'personal': return emote('2', 7);
    // 발견 반응: 주먹 올리는 뒤 3장(6~8장)은 빼고, 움찔한 뒤 바라보는 장에서 잠깐 머묾
    case 'notice': fx.push({ k: 'icon', v: '!', t: 1.0 }); return act('33', { seq: [{ f: 0, d: 0.06 }, { f: 1, d: 0.06 }, { f: 2, d: 0.1 }, { f: 3, d: 0.12 }, { f: 4, d: 0.45 }, ...S([3, 2, 1, 0], 0.04)] });   // 바라본 뒤 빠르게 거꾸로
    case 'sit': return sit();
    case 'crouch': return crouch();
  }
}
function onRelease(a) {
  if (a === 'left' || a === 'right') { if (!down('left') && !down('right')) P.runLatch = false; }
  if (a === 'block' && P.mode === 'block') reverseOut('17', R(curF(), 0), 0.025);
  if (a === 'charge' && P.mode === 'charge') release();
}

function updateFx(dt) {
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
    else if (e.k === 'rocket') {
      e.x += e.dir * 1500 * dt;
      if (Math.random() < 0.9) fx.push({ k: 'smoke', x: e.x - e.dir * 20, y: e.y + (Math.random() - 0.5) * 6, vx: -e.dir * 40, vy: -10, r: 6, t: 0.8, t0: 0.8, c: 200 });
      const D = targets().find(D => Math.abs(D.y - e.gy) < 60 && (D.x - e.x) * e.dir <= 0 && (D.x - e.x0) * e.dir > 0), hitD = !!D;
      if (hitD || e.x < VX0 - 40 || e.x > W + 40) { e.t = 0; explode(hitD ? D.x : Math.max(VX0 + 20, Math.min(W - 20, e.x)), e.y, e.gy, hitD); }
    }
    else if (e.k === 'shell') { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 1400 * dt; if (e.y > e.g) { e.y = e.g; e.vy *= -0.35; e.vx *= 0.6; } }
  }
  for (const e of fx) if (e.k === 'timer' && e.t <= 0 && !e.done) { e.done = true; e.fn(); }
  fx = fx.filter(e => e.t > 0);
}
function update(dt) {
  P.t += dt;
  updateFx(dt);
  shake = Math.max(0, shake - 70 * dt); zoom = Math.max(0, zoom - 0.5 * dt); flash = Math.max(0, flash - dt); cut = Math.max(0, cut - dt); dark = Math.max(0, dark - dt);
  P.armorT = Math.max(0, P.armorT - dt); P.healT = Math.max(0, (P.healT || 0) - dt);
  if (P.status === 'status_poison' && Math.random() < dt * 7) { const a = A[P.clip ? P.clip.id : '1'], k = K(P.y); fx.push({ k: 'bubble', x: P.x + (Math.random() - 0.5) * 26 * k, y: P.y - P.z - (BASE(a) - a.top[curF()]) * k + 6, vy: -40 - Math.random() * 30, r: 2 + Math.random() * 2.5, t: 0.9 + Math.random() * 0.4, t0: 1.3 }); }   // 독: 머리에서 초록 방울
  if (P.sp >= 100 && Math.random() < dt * 2.5) fx.push({ k: 'mote', x: P.x + (Math.random() - 0.5) * 80 * K(P.y), y: P.y - Math.random() * 40, vy: -90 - Math.random() * 120, c: '#ffd34a', t: 0.8, t0: 0.8 });
  if (P.hp <= 25 && Math.random() < dt * 0.6) vfx('blood_splat', P.x + (Math.random() - 0.5) * 30, P.y - (60 + Math.random() * 80) * K(P.y), 1.8, { flip: Math.random() < 0.5 });
  if (P.hp <= 25 && Math.random() < dt * 3.5) {   // 빈사: 몸에서 핏방울이 떨어져 바닥에 번짐
    const a = A[P.clip ? P.clip.id : '1'], f = curF(), k = K(P.y);
    const top = P.y - P.z - (BASE(a) - a.top[f]) * k, bot = P.y - P.z;
    const y = top + (bot - top) * (0.25 + Math.random() * 0.4);
    for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) fx.push({ k: 'blood', x: P.x + (Math.random() - 0.5) * 30 * k, y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, g: P.y + (Math.random() - 0.5) * 6, t: 3, s: 2 + Math.random() * 2.5 });
  }
  if (hitstop > 0) { hitstop -= dt; return; }
  tickClip(dt);
  P.inv = Math.max(0, P.inv - dt); P.wakeArmor = Math.max(0, (P.wakeArmor || 0) - dt);
  if (P.overT > 0) { P.overT -= dt; P.heat = 100 * Math.max(0, P.overT) / 2.6; if (Math.random() < dt * 6) { const p = P.armed ? muzzle() : { x: P.x + P.face * 30 * K(P.y), y: P.y - 150 * K(P.y) }; steam(p.x, p.y, 1.2); } }
  else if (P.t - P.lastShot > 0.35) P.heat = Math.max(0, P.heat - 30 * dt);
  if (P.ghostT > 0) { P.ghostT -= dt; P.ghostN = (P.ghostN || 0) + dt; if (P.clip && P.ghostN > 0.05 && !(P.ghostN = 0)) fx.push({ k: 'ghost', id: P.clip.id, f: curF(), x: P.x, y: P.y, z: P.z, face: P.face, t: 0.18, t0: 0.18 }); }
  if (P.dodgeV) { P.x += P.dodgeV.x * dt; P.y += P.dodgeV.y * dt; P.dodgeV.x *= Math.pow(0.004, dt); P.dodgeV.y *= Math.pow(0.004, dt); }
  if (P.pvx) { P.x += P.face * P.pvx * dt; const s = Math.sign(P.pvx); P.pvx -= s * P.pdec * dt; if (Math.sign(P.pvx) !== s) P.pvx = 0; }
  const dx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0), dy = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
  const running = down('run') || P.runLatch;
  switch (P.mode) {
    case 'ground': {
      if (down('flee')) { P.mode = 'flee'; play('36', { fps: 14, loopFrom: 0 }); break; }
      if (down('back')) { P.mode = 'back'; play('37', { fps: 10, onEnd: () => { if (P.mode === 'back') (has('37_1') ? play('37_1', { seq: S(R(1, A['37_1'].n - 1), 0.11), loopFrom: 0 }) : play('37', { seq: [{ f: 2, d: 0.17 }, { f: 3, d: 0.17 }], loopFrom: 0 })); } }); break; }   // 움츠림 → 그 자세로 떨며 주춤주춤
      if (dx || dy) {
        if (P.armed) P.armed = false;
        if (dx && dx !== P.face) { P.prevFace = P.face; P.faceT = P.t; P.face = dx; }
        const sp = (running ? 430 : 230) * (P.dying ? 0.6 : 1);
        P.x += dx * sp * dt; P.y += dy * sp * 0.55 * dt;
        const id = running && !P.dying ? '5' : '4';
        if (!P.clip || P.clip.id !== id) play(id, { fps: id === '5' ? 15 : P.dying ? 7 : 11, loopFrom: 0 });
        if (id === '5' && Math.random() < dt * 4) { if (!vfx('run_dust', P.x - P.face * 24, P.y, 2, { flip: P.face < 0 })) dust(P.x - P.face * 20, P.y, 1, 0.6); }
        const sf = curF(); if (sf !== P.stepF && (sf === 1 || sf === 5)) sfx('step'); P.stepF = sf;
        P.idleT = 0;
      } else {
        const id = P.armed ? (has('W1') ? 'W1' : 'W') : P.combat ? '3' : '1';
        if (!P.clip || P.clip.id !== id) {
          if (id === 'W') play('W', { seq: [{ f: 3, d: 9 }], loopFrom: 0 });
          else if (id === '1') play('1', { seq: [{ f: 0, d: P.dying ? 0.45 : 0.6 }, { f: 1, d: P.dying ? 0.45 : 0.6 }], loopFrom: 0 });   // 평상 대기: 앞 두 장만 오감(마지막 장은 가슴이 너무 올라감, 사용자)
          else play(id, { fps: id === 'W1' ? 5 : P.combat ? 7 : 2, loopFrom: 0 });
        }
        P.idleT += dt;
        if (!P.combat && !P.armed && !P.dying && P.idleT > 9) { P.idleT = 0; emote('2', 7); }
      }
      break;
    }
    case 'act': if (P.knockT > 0) { P.knockT -= dt; if (P.knockT <= 0) P.mode = 'down'; } break;
    case 'chain': P.chainT -= dt; if (P.chainT <= 0) chainExpire(); break;
    case 'air': {
      if (P.takeoff > 0) { P.takeoff -= dt; if (P.takeoff <= 0) { P.vz = 1180; dust(P.x, P.y, 3, 0.7); } else break; }
      if (dx) { P.x += dx * P.airVX * dt; if (!P.airAtk) P.face = dx; }
      P.y += dy * 140 * dt;
      P.z += P.vz * dt; P.vz -= 2700 * dt;
      P.spin = Math.max(0, P.spin - dt);
      { const gz = env.ground(P.x, P.y); if (P.z <= gz && P.vz < 0) { P.z = gz; land(); break; } }
      if (!P.airAtk && P.spin <= 0) {
        const f = P.vz > 380 ? 2 : P.vz > -380 ? (P.vz > 0 ? 3 : 4) : 5;
        P.clip = { id: '7', seq: [{ f, d: 9 }], i: 0, t: 0, loopFrom: 0, done: false };
      }
      break;
    }
    case 'charge': {
      if (!down('charge')) { release(); break; }   // 떼면(버튼이 씹혀도) 무조건 발사
      P.charge = Math.min(2.2, P.charge + dt);
      const lv = P.charge >= 2 ? 3 : P.charge > 1.3 ? 2 : P.charge > 0.5 ? 1 : 0;
      if (lv > P.chargeShown) { P.chargeShown = lv; sfx('ability'); ring(P.x, P.y - 110 * K(P.y), 70 + lv * 25, 0.3, CH_COL[lv], 4); flash = 0.04; }
      if (Math.random() < dt * (8 + lv * 10)) fx.push({ k: 'mote', x: P.x + (Math.random() - 0.5) * 90 * K(P.y), y: P.y, vy: -120 - Math.random() * 160, c: CH_COL[lv], t: 0.7, t0: 0.7 });
      break;
    }
    case 'belly': { const go = dx !== 0, looping = P.clip.id === '38_1' || P.clip.i >= 4; if (go) P.face = dx; P.clip.paused = !go && looping; if (go && looping) P.x += dx * 55 * dt; break; }
    case 'stun': P.stunT -= dt; if (P.stunT <= 0) reverseOut('21', [curF() > 1 ? 1 : curF(), 0], 0.07); break;
    case 'flee': if (!down('flee')) { toIdle(); break; } if (dx) P.face = dx; P.x += P.face * 400 * dt; P.y += dy * 180 * dt; break;
    case 'back': { if (!down('back')) { toIdle(); break; } if (P.clip && P.clip.id === '37_1') P.x -= P.face * 80 * dt; P.y += dy * 60 * dt; break; }   // 손드는 동안(37)은 제자리, 걸음(37_1)부터 뒤로
    case 'sit': if (P.clip && P.clip.id === '39' && curF() >= 7 && dx && dx === -P.face) { P.mode = 'scoot'; play('40', { fps: 6, loopFrom: 0 }); } break;
    case 'scoot': if (!(dx && dx === -P.face)) { sitLoop(); break; } P.x -= P.face * 70 * dt; break;
    case 'crouch': if (P.clip && P.clip.i >= 4 && dx) { P.face = dx; P.mode = 'crawl4'; if (has('42_1')) play('42', { seq: S(R(0, 5), 0.08), onEnd: () => { if (P.mode === 'crawl4') play('42_1', { seq: S(R(1, A['42_1'].n - 1), 0.1), loopFrom: 0 }); } }); else play('42', { seq: [...S(R(0, 3), 0.08), ...S(R(4, 11), 0.085)], loopFrom: 4 }); } break;
    case 'crawl4': { const go = dx !== 0, looping = P.clip.id === '42_1' || P.clip.i >= 4; if (go) P.face = dx; P.clip.paused = !go && looping; if (go && looping) P.x += dx * 85 * dt; break; }
  }
  // 물건 위에서 걸어 나가면 떨어진다
  if (P.mode === 'ground' || P.mode === 'chain') { const gz = env.ground(P.x, P.y); if (P.z > gz + 2) { P.mode = 'air'; P.vz = 0; P.jumps = 1; P.airAtk = false; P.takeoff = 0; P.spin = 0; P.airVX = 230; } else P.z = gz; }
  env.clamp(P);
}
// ── 그리기 ──
const silCache = {};
function silhouette(id, f, col) {
  const key = id + ':' + f + ':' + col; if (silCache[key]) return silCache[key];
  const a = A[id], c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
  const g = c.getContext('2d'); g.drawImage(IMG[id], f * a.w, 0, a.w, a.h, 0, 0, a.w, a.h);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, a.w, a.h);
  return silCache[key] = c;
}
function shadow(x, y, z, w, s = 1, up = 0, extra = 0) {
  const k = Math.max(0.3, 1 - z / 380) * s;
  const rx = Math.max(16, w) * 0.58 * k, ry = (5 + extra) * k;
  ctx.fillStyle = `rgba(0,0,0,${0.42 * k})`; ctx.beginPath(); ctx.ellipse(x, y - up * s - 2 * k, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function drawSprite(id, f, x, y, z, face, alpha = 1, tint = null) {
  const a = A[id], img = IMG[id]; if (!img.complete || !img.naturalWidth) return;
  const flip = a.dir === 'SW' ? face > 0 : face < 0;
  const air = P.mode === 'air' && (id === '7' || id === '14');
  const base = air ? a.bot[f] : groundBase(id, a, f);
  if (KNOCK_ARC[id] && alpha === 1) z += KNOCK_ARC[id][f] || 0;
  let bob = 0;
  if (id === 'W' && P.mode === 'ground' && P.armed) bob = Math.round(Math.sin(P.t * 3) * 1.2);
  const sk = K(y);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x), Math.round(y - z + bob)); ctx.scale(flip ? -sk : sk, sk);
  const dxp = -Math.round(a.w / 2) - (ROOT.has(id) && a.cx ? a.cx[f] - a.cx[0] : 0), dyp = -base;
  if (tint && !tint.noEdge) {
    const s = silhouette(id, f, tint.c);
    const offs = tint.glow ? [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]] : [[-2, 0], [2, 0], [0, -2], [0, 2]];
    ctx.globalAlpha = alpha * (tint.ea ?? 1) * (tint.glow ? 0.5 : 1);
    for (const [ox, oy] of offs) ctx.drawImage(s, dxp + ox, dyp + oy);
    ctx.globalAlpha = alpha;
  }
  ctx.drawImage(img, f * a.w, 0, a.w, a.h, dxp, dyp, a.w, a.h);
  if (tint && tint.over) { ctx.globalAlpha = alpha * tint.over; ctx.drawImage(silhouette(id, f, tint.c), dxp, dyp); }
  ctx.restore();
}
function drawPlayer() {
  const c = P.clip; const id = c ? c.id : '1', f = curF(), a = A[id];
  const air = P.mode === 'air' && (id === '7' || id === '14');
  const flip = a.dir === 'SW' ? P.face > 0 : P.face < 0;
  const ft = a.foot[f], kk = K(P.y), fx0 = (flip ? -(ft[0] - (ROOT.has(id) && a.cx ? a.cx[f] - a.cx[0] : 0)) : ft[0] - (ROOT.has(id) && a.cx ? a.cx[f] - a.cx[0] : 0)) * kk;
  const contact = a.bot[f] - (ft[2] || 0), lift = air ? 0 : (KNOCK_ARC[id] ? KNOCK_ARC[id][f] || 0 : Math.max(0, BASE(a) - a.bot[f] - 6));   // 발이 닿는 높이, 그림 속에서 뜬 장이면 그림자를 작게
  const gz0 = env.ground(P.x, P.y);   // 물건 위면 그림자도 그 윗면에
  shadow(P.x + fx0, P.y - gz0, P.z - gz0 + lift * kk, Math.min(80, ft[1]), kk, air ? 0 : groundBase(id, a, f) - contact, Math.min(10, ft[3] || 0));
  let tint = null;
  if (P.armorT > 0) tint = { c: '#ff2a2a', over: 0.35 * (P.armorT / 0.28) };
  else if (armored() && showArmor) tint = { c: 'rgba(255,60,40,.55)', over: 0 };
  else if (P.healT > 0) tint = { c: '#7dff8a', over: 0.35 * P.healT, noEdge: true };
  else if (P.sp >= 100) tint = { c: '#ffd34a', over: 0, ea: 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(P.t * 4)), glow: true };   // 필살기 준비: 금빛 외곽선이 은은하게
  else if (P.hp <= 25) tint = { c: '#d0101a', over: 0.42 * (0.5 + 0.5 * Math.sin(P.t * Math.PI * 2 * 1.3)), noEdge: true };
  else if (P.mode === 'charge') { const lv = P.charge >= 2 ? 3 : P.charge > 1.3 ? 2 : P.charge > 0.5 ? 1 : 0; tint = { c: CH_COL[lv], over: 0.1 + 0.12 * Math.sin(P.t * 20) }; }
  drawSprite(id, f, P.x, P.y, P.z, P.face, 1, tint);
  if (P.mode === 'charge') { const m = muzzle(); drawVfxAt('charge_gather', m.x, m.y, 1.4 + P.charge * 0.7, P.t); }
  if (P.status) {   // 상태이상
    const top = P.y - P.z - (BASE(a) - a.top[f]) * kk, hgt = (BASE(a) - a.top[f]) * kk;
    if (P.status === 'status_burn') for (let i = 0; i < 5; i++) { const ox = Math.sin(i * 2.3) * 22 * kk, oy = top + hgt * (0.2 + 0.16 * i); drawVfxAt('status_burn', P.x + ox, oy + 10 * kk, 0.55 * kk, P.t + i * 0.37); }
    if (P.status === 'status_shock') for (let i = 0; i < 4; i++) { const ph = Math.floor(P.t * 9 + i * 3.7); const rx = Math.sin(ph * 12.9898 + i) * 0.5, ry = (Math.sin(ph * 78.233 + i * 2) * 0.5 + 0.5); drawVfxAt('status_shock', P.x + rx * 40 * kk, top + hgt * (0.05 + ry * 0.9), 0.7 * kk, P.t + i * 0.2); }
  }
  if (P.mode === 'stun') {   // 머리 위 별
    const hy = P.y - (BASE(a) - a.top[f]) * kk - 14;
    if (!drawVfxAt('stun_stars', P.x, hy, 2.2, P.t)) for (let i = 0; i < 3; i++) { const t = P.t * 4 + i * 2.09; star(P.x + Math.cos(t) * 26, hy + Math.sin(t) * 7, 7, '#ffe066'); }
  }
}
function star(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill(); }
function drawVfxAt(name, x, y, sc, el, flip) {   // 캐릭터를 따라다니는 반복 이펙트(스턴 별·충전 모으기)
  const v = VFX[name]; if (!v || !v.img.complete) return false;
  const [fx0, fy0, fw, fh] = sheetFrame(v, el % vfxDur(name));
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(flip ? -sc : sc, sc); ctx.drawImage(v.img, fx0, fy0, fw, fh, -fw * v.pivot[0], -fh * v.pivot[1], fw, fh); ctx.restore(); return true;
}
function sheetFrame(v, el) { el = el * 1000; let i = 0; while (i < v.frames.length - 1 && el >= v.frames[i][4]) { el -= v.frames[i][4]; i++; } return v.frames[i]; }
function drawSheets(under = false) {
  for (const e of fx) {
    if (!!e.under !== under) continue;
    if (e.k === 'bullet' && VFX.tracer && VFX.tracer.img.complete) {   // 예광탄: 총구에서 맞는 자리까지 날아감
      const k = 1 - e.t / e.t0, x = e.x + (e.x2 - e.x) * k, y = e.y + (e.y2 - e.y) * k, [fx0, fy0, fw, fh] = sheetFrame(VFX.tracer, (e.t0 - e.t) % vfxDur('tracer'));
      const L = fw * 0.38 * 2.4, vis = Math.min(L, Math.hypot(x - e.x, y - e.y) + 4), sw = vis / 2.4;   // 출발점 뒤로는 안 그림(꼬리가 총에 겹치지 않게)
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(e.y2 - e.y, e.x2 - e.x)); ctx.drawImage(VFX.tracer.img, fx0 + fw - sw, fy0, sw, fh, -vis, -fh * 1.1, vis, fh * 2.2); ctx.restore();   // 그림의 앞쪽(밝은 머리) 38%만 = 짧은 총알 한 발
    }
    if (e.k === 'beamS' && VFX.charge_beam && VFX.charge_beam.img.complete) {   // 충전 광선: 그림을 가로로 이어 붙임
      const v = VFX.charge_beam, [fx0, fy0, fw, fh] = sheetFrame(v, (e.t0 - e.t) % vfxDur('charge_beam')), sc = e.sy * (0.5 + 0.5 * e.t / e.t0);
      const x2 = e.dir > 0 ? W : VX0, len = Math.abs(x2 - e.x);
      ctx.save(); ctx.translate(e.x, e.y); if (e.dir < 0) ctx.scale(-1, 1);
      // 총구 쪽은 가늘게 시작해 굵어지고(앞 140px), 끝도 살짝 가늘게 — 8px씩 잘라 높이를 바꿔 그림
      const taper = 140, step = 8;
      for (let x = 0; x < len; x += step) {
        const k0 = Math.min(1, 0.12 + (x / taper) ** 0.7 * 0.88);
        const sx = fx0 + ((x / 2) % fw), sw = Math.min(step / 2, fw - (sx - fx0));
        ctx.drawImage(v.img, sx, fy0, sw, fh, x, -fh * sc * k0, sw * 2, fh * 2 * sc * k0);
      }
      ctx.restore();
    }
    if (e.k !== 'sheet') continue;
    const v = VFX[e.name]; if (!v.img.complete) continue;
    const [fx0, fy0, fw, fh] = sheetFrame(v, e.loop ? (e.t0 - e.t) % e.dur : e.t0 - e.t);
    ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y)); if (e.rot) ctx.rotate(e.rot); ctx.scale(e.flip ? -e.s : e.s, e.s);
    if (e.anchor === 'right') ctx.drawImage(v.img, fx0, fy0, fw, fh, -fw, -fh / 2, fw, fh);
    else ctx.drawImage(v.img, fx0, fy0, fw, fh, -fw * v.pivot[0], -fh * v.pivot[1], fw, fh);
    ctx.restore();
  }
}
function drawTargets() {   // 필살기 바닥 표적: 캐릭터 밑에 그림
  for (const e of fx) if (e.k === 'target') {
    const bl = Math.sin(P.t * 14) > 0, r = 26;
    ctx.strokeStyle = bl ? 'rgba(255,70,50,.95)' : 'rgba(255,170,60,.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.moveTo(e.x - r - 8, e.y); ctx.lineTo(e.x + r + 8, e.y); ctx.moveTo(e.x, e.y - 12); ctx.lineTo(e.x, e.y + 12); ctx.stroke();
  }
}
function drawFxUnder() {
  drawTargets();
  for (const e of fx) if (e.k === 'scorch') { ctx.fillStyle = `rgba(20,14,10,${0.55 * Math.min(1, e.t)})`; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r, e.r * 0.28, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const e of fx) if (e.k === 'dust') { const k = e.t / e.t0; ctx.fillStyle = `rgba(200,190,170,${0.45 * k})`; ctx.beginPath(); ctx.arc(e.x, e.y - 4, e.r * (1.6 - k), 0, Math.PI * 2); ctx.fill(); }
  for (const e of fx) if (e.k === 'ghost') drawSprite(e.id, e.f, e.x, e.y, e.z, e.face, 0.16 * e.t / e.t0, { c: '#a8ccff', over: 0.3, noEdge: true });
}
function drawFx(glow) {
  for (const e of fx) {
    if (GLOW.has(e.k) !== glow) continue;
    const k = e.t0 ? e.t / e.t0 : 1;
    if (e.k === 'spark') { ctx.strokeStyle = e.c; ctx.lineWidth = e.s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - e.vx * 0.035, e.y - e.vy * 0.035); ctx.stroke(); }
    else if (e.k === 'ring') { ctx.strokeStyle = e.c; ctx.globalAlpha = k; ctx.lineWidth = e.w * k + 1; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r0 + (e.r - e.r0) * (1 - k), (e.r0 + (e.r - e.r0) * (1 - k)) * e.sy, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (e.k === 'num') { ctx.fillStyle = typeof e.v === 'string' ? '#9fd0ff' : e.big ? '#ffcf4a' : '#fff'; ctx.font = `bold ${e.big ? 30 : 22}px sans-serif`; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(e.v, e.x - 14, e.y); ctx.fillText(e.v, e.x - 14, e.y); }
    else if (e.k === 'tracer') { ctx.strokeStyle = e.big ? 'rgba(255,236,160,.95)' : 'rgba(255,244,190,.85)'; ctx.lineWidth = e.big ? 5 : 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2 ?? (e.y + (e.dy || 0))); ctx.stroke(); }
    else if (e.k === 'flash') {   // 총구 불꽃: 앞으로 뻗는 원뿔 + 옆 갈래
      const L = e.big ? 46 : 28, Wd = e.big ? 13 : 8, d = e.dir, j = 0.8 + Math.random() * 0.4;
      const cone = (len, wid, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(e.x, e.y - wid); ctx.lineTo(e.x + d * len * j, e.y); ctx.lineTo(e.x, e.y + wid); ctx.closePath(); ctx.fill(); };
      cone(L, Wd, 'rgba(255,140,40,.9)'); cone(L * 0.7, Wd * 0.65, 'rgba(255,220,90,.95)'); cone(L * 0.4, Wd * 0.35, '#fff');
      ctx.fillStyle = 'rgba(255,170,60,.85)';
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(e.x + d * 4, e.y); ctx.lineTo(e.x + d * L * 0.35, e.y + sgn * Wd * 1.6 * j); ctx.lineTo(e.x + d * 10, e.y + sgn * 2); ctx.fill(); }
    }
    else if (e.k === 'blood') { ctx.fillStyle = `rgba(150,10,16,${Math.min(1, e.t)})`; if (e.landed) { ctx.beginPath(); ctx.ellipse(e.x, e.y, e.s * 2.2, e.s * 0.8, 0, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(e.x - e.s / 2, e.y - e.s / 2, e.s, e.s); }
    else if (e.k === 'target' && false) {
      const bl = Math.sin(P.t * 14) > 0, r = 26;
      ctx.strokeStyle = bl ? 'rgba(255,70,50,.95)' : 'rgba(255,170,60,.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.moveTo(e.x - r - 8, e.y); ctx.lineTo(e.x + r + 8, e.y); ctx.moveTo(e.x, e.y - 12); ctx.lineTo(e.x, e.y + 12); ctx.stroke();
    }
    else if (e.k === 'mortar') {
      // 떨어지는 포탄: 몸통·탄두·꼬리날개
      const p = 1 - k, y = -80 + (e.y - 30 + 80) * p, x = e.x + (1 - p) * 140, ang = Math.atan2(e.y + 50, -140);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang - Math.PI / 2);
      ctx.fillStyle = '#3d4236'; ctx.fillRect(-6, -26, 12, 36); ctx.fillStyle = '#7a8070'; ctx.fillRect(-6, -26, 4, 36);
      ctx.fillStyle = '#c9a23a'; ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 10); ctx.lineTo(0, 22); ctx.fill();
      ctx.fillStyle = '#2a2e25'; ctx.beginPath(); ctx.moveTo(-6, -26); ctx.lineTo(-13, -36); ctx.lineTo(-6, -18); ctx.moveTo(6, -26); ctx.lineTo(13, -36); ctx.lineTo(6, -18); ctx.fill();
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
    else if (e.k === 'bubble') { ctx.strokeStyle = `rgba(120,230,90,${Math.min(1, e.t * 1.5)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = `rgba(160,255,120,${0.35 * Math.min(1, e.t * 1.5)})`; ctx.fill(); }
    else if (e.k === 'mote') { ctx.fillStyle = e.c; ctx.globalAlpha = k; ctx.fillRect(e.x - 2, e.y - 2, 4, 4); ctx.globalAlpha = 1; }
    else if (e.k === 'fire') {   // 불덩이: 흰 → 노랑 → 주황 → 검붉은
      const c = k > 0.8 ? '255,255,230' : k > 0.55 ? '255,214,90' : k > 0.3 ? '255,120,30' : '120,30,20';
      ctx.fillStyle = `rgba(${c},${Math.min(1, k * 1.6)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    else if (e.k === 'rocket') { ctx.fillStyle = '#5a5f52'; ctx.fillRect(e.x - 16, e.y - 4, 32, 8); ctx.fillStyle = '#c33'; ctx.fillRect(e.x + e.dir * 12 - 4, e.y - 4, 8, 8); star(e.x - e.dir * 20, e.y, 9, '#ffcf5a'); }
    else if (e.k === 'shell') { ctx.fillStyle = '#e8c35a'; ctx.fillRect(e.x - 2, e.y - 1, 5, 3); }
    else if (e.k === 'beam') {
      const x2 = e.dir > 0 ? W : VX0, w = e.w * (0.4 + 0.6 * k), x0 = Math.min(e.x, x2), len = Math.abs(x2 - e.x);
      ctx.globalAlpha = 0.45 * k; ctx.fillStyle = e.c || '#a0dcff'; ctx.fillRect(x0, e.y - w, len, w * 2);
      if (e.lv >= 2) { ctx.strokeStyle = e.c; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= len; x += 24) ctx.lineTo(x0 + x, e.y - w * 1.2 + Math.random() * w * 2.4); ctx.stroke(); }
      ctx.globalAlpha = k; ctx.fillStyle = '#fff'; ctx.fillRect(x0, e.y - w * 0.35, len, w * 0.7); ctx.globalAlpha = 1;
    }
    else if (e.k === 'burst') {
      const r = 18 + 60 * (1 - k); ctx.strokeStyle = `rgba(230,245,255,${k})`; ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * r * 0.5, e.y + Math.sin(a) * r * 0.2); ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.4); ctx.stroke(); }
      ctx.fillStyle = `rgba(230,245,255,${0.35 * k})`; ctx.beginPath(); ctx.ellipse(e.x, e.y, r * 0.7, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    }
    else if (e.k === 'scan') {
      const p = 1 - k, x = e.dir > 0 ? e.x + p * (W - e.x) : e.x - p * (e.x - VX0);
      ctx.strokeStyle = `rgba(255,90,74,${0.8})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x, FLOOR0 - 40); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,74,.08)'; ctx.fillRect(Math.min(e.x, x), 0, Math.abs(x - e.x), H);
    }
    else if (e.k === 'icon') { const a = A[P.clip ? P.clip.id : '1']; const y = P.y - (BASE(a) - a.top[curF()]) * K(P.y) - 40; ctx.fillStyle = '#ff4a3a'; ctx.font = 'bold 44px sans-serif'; ctx.fillText(e.v, P.x - 8, y); }
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
  const p = muzzle(), lv = P.charge >= 2 ? 3 : P.charge > 1.3 ? 2 : P.charge > 0.5 ? 1 : 0;
  if (VFX.charge_gather) { if (lv) { ctx.fillStyle = CH_COL[lv]; ctx.font = 'bold 20px sans-serif'; ctx.fillText(['', '1단', '2단', '최대'][lv], P.x - 16, P.y - 250 * K(P.y)); } return; }   // 모이는 그림은 drawPlayer에서
  const orb = 4 + P.charge * 9 + Math.sin(P.t * 30) * 2;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, orb * 2.2); g.addColorStop(0, '#fff'); g.addColorStop(0.4, CH_COL[lv]); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, orb * 2.2, 0, Math.PI * 2); ctx.fill();
  const w = Math.max(1, 6 - P.charge * 3.5);
  ctx.strokeStyle = lv === 2 ? 'rgba(160,220,255,.9)' : 'rgba(255,90,74,.75)'; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(P.face > 0 ? W : VX0, p.y); ctx.stroke();
  for (let i = 0; i < 3; i++) { const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 30; ctx.fillStyle = lv === 2 ? '#bfe8ff' : '#fff'; ctx.fillRect(p.x + Math.cos(a) * r * (1 - (P.charge % 0.3) / 0.3), p.y + Math.sin(a) * r * (1 - (P.charge % 0.3) / 0.3), 3, 3); }
  if (lv) { ctx.fillStyle = CH_COL[lv]; ctx.font = 'bold 20px sans-serif'; ctx.fillText(['', '1단', '2단', '최대'][lv], P.x - 16, P.y - 250 * K(P.y)); }
}
function drawDying() {
  if (P.hp > 25) return;
  // 심장 박동처럼 두 번 뛰는 붉은 테두리
  const t = (P.t * 1.1) % 1, beat = Math.max(0, 1 - Math.abs(t - 0.08) * 12) + Math.max(0, 1 - Math.abs(t - 0.28) * 12) * 0.7;
  const g = ctx.createRadialGradient(VX0 + 640, H / 2, H * 0.55, VX0 + 640, H / 2, H * 0.95);   // 가장자리만 깜빡임
  g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(170,0,0,${0.55 * beat})`);
  ctx.fillStyle = g; ctx.fillRect(VX0, 0, W - VX0, H);
}
  // ── 게임 쪽 그리기 ──
  function frameView(v) { VX0 = v.x0; W = v.x0 + 1280; FLOOR0 = v.lane[0]; FLOOR1 = v.lane[1]; }
  /** 바닥 층 (사람보다 먼저): 어두워짐·표적·그을음·먼지·잔상·바닥 그림 이펙트 */
  function drawUnder(c) {
    ctx = c;
    if (dark) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, dark * 0.9)})`; ctx.fillRect(VX0, 0, 1280, H); }
    drawFxUnder();
    drawSheets(true);
    for (const it of items) { ctx.fillStyle = '#c94a4a'; ctx.fillRect(it.x - 6, it.y - 14, 12, 14); ctx.fillStyle = '#eee'; ctx.fillRect(it.x - 4, it.y - 18, 8, 4); drawVfxAt('item_sparkle', it.x + 6, it.y - 20, 2, P.t - it.t0); }
  }
  /** 캐릭터 */
  function drawBody(c) { ctx = c; drawPlayer(); }
  /** 이펙트 층 (1/3 크기 도트 층 + 그림 이펙트), 월드 좌표 */
  function drawFxLayer(c) {
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
  function drawScreen(c) {
    ctx = c;
    const v0 = VX0; VX0 = 0;
    drawDying();
    VX0 = v0;
    if (flash) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, flash * 3)})`; ctx.fillRect(0, 0, 1280, H); }
    if (cut) {
      const k = Math.min(1, (1.1 - cut) * 6), y = H / 2 - 80, Wd = 1280;
      ctx.fillStyle = 'rgba(10,10,12,.9)'; ctx.fillRect(0, y, Wd * k, 160);
      ctx.fillStyle = '#cfc7a6'; ctx.fillRect(0, y, Wd * k, 4); ctx.fillRect(0, y + 156, Wd * k, 4);
      ctx.font = env.font(77); ctx.fillText('증명해.', Wd - 560 * k, y + 100);
      ctx.font = env.font(22); ctx.fillStyle = '#aaa59a'; ctx.fillText('「규칙은 읽었어?」', Wd - 540 * k, y + 140);
    }
  }
  return {
    P, A, onPress, onRelease, takeHit, update, frameView, drawUnder, drawBody, drawFxLayer, drawScreen, armored,
    get hitstop() { return hitstop; }, get shake() { return shake; }, get zoom() { return zoom; },
    tickMarks(dt) { for (const [b, t] of marks) { if (t - dt <= 0) marks.delete(b); else marks.set(b, t - dt); } },
    knock, hit,
  };
}
