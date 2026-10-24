// 필드 전투 효과 틀 (docs/요원_기술안.md 0.5 A표 · 0.6 필살 컷인). 그림 없이 코드가 그리는 공통 타격감과
// GPT 도트 시트(game-src/art/field/fx, fx_목록.txt)를 재생하는 자리. 필드에는 아직 전투가 없어서 엔진은 필살 미리 보기만 부른다.
// 좌표: world 함수는 월드 px(카메라 적용 뒤), screen 함수는 1280×720 기준(캔버스 크기에 맞춰 늘린다). 시간은 초, 히트스톱은 60fps 장 수.
import { PIXEL_FONT } from '../ui/kit';

export type Tier = 'light' | 'mid' | 'heavy' | 'super';
/** 히트스톱 장 수 (약 3 · 중 5 · 강 8 · 필살 마무리 12) */
export const HITSTOP: Record<Tier, number> = { light: 3, mid: 5, heavy: 8, super: 12 };
/** 흔들림 px (약 2 · 중 5 · 강 9 · 필살 14) */
export const SHAKE: Record<Tier, number> = { light: 2, mid: 5, heavy: 9, super: 14 };
/** 도트 1칸 = 화면 1.5px (필드 요원과 같은 격자) */
const DOT = 1.5;
const snap = (v: number) => Math.round(v / DOT) * DOT;

/** 반응: 경직(떨림 2px) · 밀림 · 띄움(포물선) · 바운드 · 다운 */
export type ReactKind = 'stagger' | 'push' | 'launch' | 'bounce' | 'down';
export interface Reaction {
  kind: ReactKind;
  t: number;
  /** 바라보는 반대쪽(맞은 쪽이 밀리는 쪽) 1 | -1 */
  dir: 1 | -1;
  /** 지금 몸 위치 보정: 가로 dx, 떠 있는 높이 lift(위가 +), 떨림 jitter */
  dx: number;
  lift: number;
  jitter: number;
  done: boolean;
}
const REACT: Record<ReactKind, { dur: number; push: number; up: number }> = {
  stagger: { dur: 0.3, push: 0, up: 0 },
  push: { dur: 0.25, push: 60, up: 0 },
  launch: { dur: 0.75, push: 90, up: 170 },
  bounce: { dur: 0.95, push: 110, up: 150 },
  down: { dur: 0.6, push: 70, up: 40 },
};
export function react(kind: ReactKind, dir: 1 | -1): Reaction {
  return { kind, t: 0, dir, dx: 0, lift: 0, jitter: 0, done: false };
}
/** 반응을 dt만큼 진행. 몸 그림 쪽은 dx·lift·jitter만 더해 그리면 된다 (그림자는 lift로 작아진다: shadowScale) */
export function stepReaction(r: Reaction, dt: number): Reaction {
  const d = REACT[r.kind];
  r.t = Math.min(d.dur, r.t + dt);
  const k = r.t / d.dur;
  const ease = 1 - (1 - k) * (1 - k);
  r.dx = r.dir * d.push * ease;
  if (r.kind === 'bounce') {
    // 첫 포물선 70% + 바닥에 튕긴 작은 포물선 30%
    const a = 0.7;
    r.lift = k < a ? d.up * 4 * (k / a) * (1 - k / a) : d.up * 0.3 * 4 * ((k - a) / (1 - a)) * (1 - (k - a) / (1 - a));
  } else r.lift = d.up * 4 * k * (1 - k);
  r.jitter = r.kind === 'stagger' && k < 0.8 ? (Math.floor(r.t * 60) % 2 ? 2 : -2) : 0;
  r.done = r.t >= d.dur;
  return r;
}
/** 띄움 높이에 따라 발밑 그림자 크기 (1 = 바닥) */
export const shadowScale = (lift: number) => Math.max(0.45, 1 - lift / 320);

/** 도트 시트 한 줄: `시트이름 | 칸W×칸H | 장수 | 반복 여부` (fx_목록.txt) */
export interface SheetDef { name: string; w: number; h: number; n: number; loop: boolean }
export function parseFxList(text: string): SheetDef[] {
  const out: SheetDef[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cols = line.split('|').map((s) => s.trim());
    if (cols.length < 3 || !cols[0] || cols[0].startsWith('#')) continue;
    const m = /(\d+)\s*[×x*]\s*(\d+)/.exec(cols[1]);
    const n = parseInt(cols[2], 10);
    if (!m || !(n > 0)) continue;
    out.push({ name: cols[0].replace(/\.png$/, ''), w: +m[1], h: +m[2], n, loop: /반복|loop|예|yes|o\b/i.test(cols[3] ?? '') });
  }
  return out;
}

interface Spark { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string; size: number }
interface Ring { x: number; y: number; t: number; life: number; r0: number; r1: number; color: string }
interface Num { key: string; x: number; y: number; text: string; color: string; t: number; big: boolean; row: number }
interface Ghost { draw: (c: CanvasRenderingContext2D) => void; color: string; t: number; life: number }
interface SheetPlay { def: SheetDef; img: CanvasImageSource; x: number; y: number; t: number; fps: number; flip: boolean; scale: number; tint?: string; until?: number }
interface Mark { x: number; y: number; w: number; t: number; life: number }

/** 필살 컷인 한 번 (0.6절) */
export interface SuperCut {
  /** 요원 색 (띠·글씨 외곽선) */
  color: string;
  /** 기술명 · 부제 */
  name: string;
  sub?: string;
  /** GPT 컷인 그림 400×200 (2배로 보인다). 없으면 fallback */
  art?: CanvasImageSource | null;
  /** 2번째 그림 (눈 깜박임·눈빛). 없으면 eye 자리에 반짝임 한 점 */
  art2?: CanvasImageSource | null;
  /** 컷인 그림이 없을 때: 필드 도트 그림의 머리·어깨 (정사각) */
  fallback?: CanvasImageSource | null;
  /** 눈 위치 (그림 안 비율 0~1) */
  eye?: { x: number; y: number };
}
const CUT = { total: 1.4, bandIn: [0.05, 0.17], artIn: [0.1, 0.25], slam: 0.25, typed: 0.3, out: [0.95, 1.1] } as const;

export interface FieldFxOptions { shake: number; flash: boolean; numbers: boolean }

export class FieldFx {
  opt: FieldFxOptions = { shake: 1, flash: true, numbers: true };
  /** 효과음 자리 ('쿵' 'slam' 등). 엔진이 소리 모듈을 꽂는다 */
  sfx: ((name: string) => void) | null = null;
  private stop = 0;
  private shakeT = 0;
  private shakeDur = 0;
  private shakePow = 0;
  private flashT = 0;
  private flashA = 0;
  private flashColor = '#fff';
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private nums: Num[] = [];
  private totals = new Map<string, { sum: number; last: number; x: number; y: number; rows: number }>();
  private ghosts: Ghost[] = [];
  private plays: SheetPlay[] = [];
  private marks: Mark[] = [];
  private sheets = new Map<string, { def: SheetDef; img: CanvasImageSource }>();
  private bodyFlash = new Map<string, number>();
  private cut: (SuperCut & { t: number; done: () => void }) | null = null;
  private time = 0;

  /* ── 상태 ── */
  /** 히트스톱·필살 컷인 중이면 true: 엔진은 이 동안 월드를 진행하지 않는다 */
  frozen(): boolean { return this.stop > 0 || !!this.cut; }
  /** 필살 컷인이 도는 중인가 */
  inSuper(): boolean { return !!this.cut; }
  /** 화면 흔들림 오프셋 (카메라에 더한다) */
  camera(): { x: number; y: number } {
    if (this.shakeT <= 0 || this.opt.shake <= 0) return { x: 0, y: 0 };
    const k = (this.shakeT / this.shakeDur) * this.shakePow * this.opt.shake;
    return { x: Math.round((Math.random() * 2 - 1) * k), y: Math.round((Math.random() * 2 - 1) * k) };
  }
  /** 맞은 몸 번쩍: 'white' 1장 → 'color' 1장 → null (id = 맞은 몸) */
  flashOf(id: string): 'white' | 'color' | null {
    const f = this.bodyFlash.get(id);
    return f === undefined ? null : f >= 1 ? 'white' : 'color';
  }

  /* ── 하나씩 ── */
  hitstop(frames: number) { this.stop = Math.max(this.stop, frames); }
  shake(px: number, dur = 0.25) {
    if (px >= this.shakePow * (this.shakeT / (this.shakeDur || 1))) (this.shakePow = px), (this.shakeT = this.shakeDur = dur);
  }
  flash(color = '#fff', dur = 0.1, a = 0.6) {
    if (!this.opt.flash) return;
    this.flashColor = color;
    this.flashT = dur;
    this.flashA = a;
  }
  /** 정사각 도트 파편 (1.5px 격자) */
  sparks_(x: number, y: number, n: number, color: string, speed = 4, lift = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
      this.sparks.push({ x, y, vx: Math.cos(a) * v * 60, vy: (Math.sin(a) * v + lift) * 60, t: 0, life: 0.25 + Math.random() * 0.25, color, size: Math.random() < 0.3 ? 3 * DOT : 2 * DOT });
    }
  }
  /** 바닥에 눕힌 타원 고리 (원근: 세로 = 가로 × 0.28) */
  ring(x: number, y: number, r0: number, r1: number, color: string, life = 0.3) { this.rings.push({ x, y, r0, r1, color, t: 0, life }); }
  /** 잔상: 몸 그리기 함수를 요원 색으로 남긴다 (빠른 이동·돌진 때 3장) */
  ghost(draw: (c: CanvasRenderingContext2D) => void, color: string, life = 0.22) {
    this.ghosts.push({ draw, color, t: 0, life });
    if (this.ghosts.length > 6) this.ghosts.shift();
  }
  /** 피해 숫자: 같은 key(맞은 몸)에 이어 맞으면 위로 쌓이고, 0.5초 쉬면 합계 */
  number(key: string, x: number, y: number, dmg: number, color = '#fff', big = false) {
    if (!this.opt.numbers || !(dmg > 0)) return;
    const tot = this.totals.get(key);
    const live = tot && this.time - tot.last < 0.5;
    const row = live ? tot!.rows : 0;
    this.nums.push({ key, x: snap(x), y: snap(y), text: String(Math.round(dmg)), color, t: 0, big, row });
    this.totals.set(key, { sum: (live ? tot!.sum : 0) + dmg, last: this.time, x, y, rows: row + 1 });
  }
  /** 바닥 그을음 같은 자국 (기본 3초) */
  scorch(x: number, y: number, w = 120, life = 3) { this.marks.push({ x, y, w, t: 0, life }); }

  /** 도트 시트 등록 (fx_목록.txt 한 줄 + 그림) */
  register(def: SheetDef, img: CanvasImageSource) { this.sheets.set(def.name, { def, img }); }
  hasSheet(name: string) { return this.sheets.has(name); }
  /** 시트 재생: x,y = 기준점(칸 아래 가운데). flip = 왼쪽 보기. 없는 시트면 false (코드 효과만 쓴다) */
  play(name: string, x: number, y: number, o: { flip?: boolean; scale?: number; fps?: number; tint?: string; seconds?: number } = {}): boolean {
    const s = this.sheets.get(name);
    if (!s) return false;
    this.plays.push({ def: s.def, img: s.img, x, y, t: 0, fps: o.fps ?? 20, flip: !!o.flip, scale: o.scale ?? DOT, tint: o.tint, until: s.def.loop ? (o.seconds ?? 1) : undefined });
    return true;
  }

  /* ── 묶음: 한 번 맞을 때 ── */
  /** 공통 타격감: 히트스톱 + 흔들림 + 몸 번쩍 + 스파크 + 고리 + 숫자 (+ 시트가 있으면 공용 타격 시트) */
  hit(o: { x: number; y: number; tier: Tier; target: string; dmg?: number; color?: string; ground?: number; flip?: boolean }) {
    const t = o.tier, n = t === 'light' ? 1 : t === 'mid' ? 2 : t === 'heavy' ? 3 : 4;
    this.hitstop(HITSTOP[t]);
    this.shake(SHAKE[t], 0.12 + n * 0.06);
    this.bodyFlash.set(o.target, 2);
    this.sparks_(o.x, o.y, 6 + n * 5, o.color ?? '#ffe0a0', 2.5 + n);
    if (o.ground !== undefined && n >= 3) this.ring(o.x, o.ground, 12, 50 + n * 30, o.color ?? '#ffd890', 0.3);
    if (o.dmg !== undefined) this.number(o.target, o.x, o.y - 40, o.dmg, t === 'super' ? '#ffe070' : '#fff', n >= 3);
    if (t === 'super') this.flash('#fff', 0.1, 0.7);
    this.play(n >= 3 ? 'fx_공용_타격_강' : 'fx_공용_타격_약', o.x, o.y + 20, { flip: o.flip });
  }

  /** 필살 컷인 (약 1.4초, 그동안 frozen). 끝나면 resolve */
  super_(c: SuperCut): Promise<void> {
    return new Promise((done) => {
      this.cut?.done();
      this.cut = { ...c, t: 0, done };
      this.sfx?.('super');
    });
  }

  /* ── 흐름 ── */
  /** 실제 시간 dt(초). 히트스톱은 장 단위로 줄인다 */
  update(dt: number) {
    this.time += dt;
    if (this.stop > 0) this.stop = Math.max(0, this.stop - dt * 60);
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    for (const [k, v] of this.bodyFlash) v - 1 <= 0 ? this.bodyFlash.delete(k) : this.bodyFlash.set(k, v - dt * 60);
    if (this.cut) {
      const before = this.cut.t;
      this.cut.t += dt;
      if (before < CUT.slam && this.cut.t >= CUT.slam) (this.shake(SHAKE.light, 0.12), this.sfx?.('slam'));
      if (this.cut.t >= CUT.total) { const d = this.cut.done; this.cut = null; d(); }
    }
    if (this.frozen() && !this.cut) return; // 히트스톱: 파편·숫자도 멈춘다 (흔들림·번쩍만 진행)
    const g = 900;
    this.sparks = this.sparks.filter((s) => ((s.t += dt), (s.x += s.vx * dt), (s.y += s.vy * dt), (s.vy += g * dt * 0.5), s.t < s.life));
    this.rings = this.rings.filter((r) => (r.t += dt) < r.life);
    this.nums = this.nums.filter((n) => (n.t += dt) < 0.9);
    this.ghosts = this.ghosts.filter((h) => (h.t += dt) < h.life);
    this.marks = this.marks.filter((m) => (m.t += dt) < m.life);
    this.plays = this.plays.filter((p) => { p.t += dt; const f = Math.floor(p.t * p.fps); return p.until !== undefined ? p.t < p.until : f < p.def.n; });
    for (const [k, v] of this.totals) {
      if (this.time - v.last > 0.5 && v.rows > 1) {
        this.nums.push({ key: k, x: snap(v.x), y: snap(v.y - 40), text: `${Math.round(v.sum)}`, color: '#ffd23a', t: 0, big: true, row: v.rows });
        this.totals.delete(k);
      } else if (this.time - v.last > 0.5) this.totals.delete(k);
    }
  }

  /** 월드 좌표(카메라 적용된 c)에: 자국 · 잔상 · 고리 · 시트 · 파편 · 숫자 */
  drawWorld(c: CanvasRenderingContext2D) {
    c.save();
    c.imageSmoothingEnabled = false;
    for (const m of this.marks) {
      c.globalAlpha = 0.45 * (1 - m.t / m.life);
      c.fillStyle = '#120c08';
      c.beginPath();
      c.ellipse(m.x, m.y, m.w / 2, m.w * 0.14, 0, 0, Math.PI * 2);
      c.fill();
    }
    for (const h of this.ghosts) {
      c.globalAlpha = 0.5 * (1 - h.t / h.life);
      tinted(c, h.draw, h.color);
    }
    c.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.t / r.life, rr = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      c.globalAlpha = 1 - k;
      c.strokeStyle = r.color;
      c.lineWidth = 3 * DOT * (1 - k) + DOT;
      c.beginPath();
      c.ellipse(r.x, r.y, rr, rr * 0.28, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    for (const p of this.plays) {
      const f = Math.floor(p.t * p.fps) % p.def.n, w = p.def.w * p.scale, h = p.def.h * p.scale;
      c.save();
      c.translate(Math.round(p.x), Math.round(p.y));
      if (p.flip) c.scale(-1, 1);
      if (p.tint) tinted(c, (o) => o.drawImage(p.img, f * p.def.w, 0, p.def.w, p.def.h, -w / 2, -h, w, h), p.tint, 0.5);
      else c.drawImage(p.img, f * p.def.w, 0, p.def.w, p.def.h, -w / 2, -h, w, h);
      c.restore();
    }
    for (const s of this.sparks) {
      c.globalAlpha = 1 - s.t / s.life;
      c.fillStyle = s.color;
      c.fillRect(snap(s.x), snap(s.y), s.size, s.size);
    }
    c.globalAlpha = 1;
    for (const n of this.nums) {
      const rise = Math.min(1, n.t / 0.25);
      const y = n.y - n.row * 28 - rise * 24;
      c.globalAlpha = n.t > 0.6 ? 1 - (n.t - 0.6) / 0.3 : 1;
      const pop = n.t < 0.08 ? 1.5 - n.t * 6 : 1;
      dotText(c, n.text, n.x, y, (n.big ? 26 : 18) * pop, n.color, '#000', 'center');
    }
    c.restore();
  }

  /** 화면 좌표에: 번쩍 · 필살 컷인 (맨 위) */
  drawScreen(c: CanvasRenderingContext2D) {
    if (this.flashT > 0) {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = this.flashA * Math.min(1, this.flashT / 0.05);
      c.fillStyle = this.flashColor;
      c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      c.restore();
    }
    if (this.cut) this.drawCut(c, this.cut);
  }

  private drawCut(c: CanvasRenderingContext2D, k: SuperCut & { t: number }) {
    const t = k.t;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.scale(c.canvas.width / 1280, c.canvas.height / 720);
    c.imageSmoothingEnabled = false;
    // 1. 암전 70% (끝 0.3초 동안 걷힌다)
    const dark = t > CUT.out[1] ? 0.7 * (1 - (t - CUT.out[1]) / (CUT.total - CUT.out[1])) : 0.7;
    c.fillStyle = `rgba(0,0,0,${dark})`;
    c.fillRect(0, 0, 1280, 720);
    // 2. 비스듬한 띠 (왼쪽 아래 → 오른쪽 위 12도), 왼쪽에서 펼쳐지고 끝에 접힌다
    const open = t < CUT.bandIn[0] ? 0 : t < CUT.bandIn[1] ? (t - CUT.bandIn[0]) / (CUT.bandIn[1] - CUT.bandIn[0]) : t < CUT.out[0] ? 1 : Math.max(0, 1 - (t - CUT.out[0]) / (CUT.out[1] - CUT.out[0]));
    const bandH = 260 * (t < CUT.out[0] ? 1 : open);
    if (open > 0 && bandH > 1) {
      c.save();
      c.translate(640, 380);
      c.rotate((-12 * Math.PI) / 180);
      const bw = 1700 * (t < CUT.out[0] ? open : 1);
      c.beginPath();
      c.rect(-850, -bandH / 2, bw, bandH);
      c.clip();
      c.fillStyle = k.color;
      c.fillRect(-850, -bandH / 2, bw, bandH);
      // 띠 위아래 검은 테 + 밝은 줄
      c.fillStyle = '#000';
      c.fillRect(-850, -bandH / 2, bw, 6);
      c.fillRect(-850, bandH / 2 - 6, bw, 6);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-850, -bandH / 2 + 6, bw, 3);
      // 흰 속도선: 오른쪽으로 흐른다
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 18; i++) {
        const ly = -bandH / 2 + 16 + ((i * 53) % Math.max(1, bandH - 32));
        const len = 80 + ((i * 97) % 160);
        const lx = -850 + ((i * 211 + t * 2600) % 1900) - 100;
        c.fillRect(Math.round(lx / 3) * 3, Math.round(ly / 3) * 3, len, 3);
      }
      // 3. 컷인 그림: 왼쪽 밖에서 미끄러져 와 오른쪽 끝이 60% 지점에 멈춤 (멈출 때 4px 반동), 끝에 오른쪽으로 빠짐
      const art = k.art ?? k.fallback;
      if (art) {
        const fromFallback = !k.art;
        const aw = fromFallback ? 400 : 800, ah = fromFallback ? 400 : 400;
        const stopX = 1700 * 0.6 - 850 - aw;
        let x: number;
        if (t < CUT.artIn[0]) x = -850 - aw;
        else if (t < CUT.artIn[1]) { const q = (t - CUT.artIn[0]) / (CUT.artIn[1] - CUT.artIn[0]); x = -850 - aw + (stopX + 850 + aw) * (1 - (1 - q) ** 3); }
        else if (t < CUT.artIn[1] + 0.06) x = stopX + 4 * Math.sin(((t - CUT.artIn[1]) / 0.06) * Math.PI);
        else if (t < CUT.out[0]) x = stopX;
        else x = stopX + ((t - CUT.out[0]) / (CUT.out[1] - CUT.out[0])) * 1800;
        const blink = k.art2 && t > CUT.slam && t < CUT.out[0] && Math.floor((t - CUT.slam) / 0.1) % 2 === 1;
        const im = blink ? k.art2! : art;
        c.drawImage(im, Math.round(x), Math.round(-ah / 2 - (fromFallback ? 40 : 0)), aw, ah);
        // 2번째 그림이 없으면 눈 자리에 반짝임 한 점
        if (!k.art2 && k.eye && t > CUT.slam && t < CUT.out[0]) {
          const ex = Math.round(x + k.eye.x * aw), ey = Math.round(-ah / 2 - (fromFallback ? 40 : 0) + k.eye.y * ah);
          const s = Math.floor(t * 12) % 2 ? 6 : 9;
          c.fillStyle = '#fff';
          c.fillRect(ex - 1, ey - s, 3, s * 2 + 1);
          c.fillRect(ex - s, ey - 1, s * 2 + 1, 3);
        }
      }
      c.restore();
    }
    // 4. 기술명 「쾅」(1.6배 → 제 크기 0.08초) + 부제 한 글자씩 0.3초
    if (t >= CUT.slam) {
      const out = t > CUT.out[0] ? ((t - CUT.out[0]) / (CUT.out[1] - CUT.out[0])) * 900 : 0;
      const sc = t < CUT.slam + 0.08 ? 1.6 - ((t - CUT.slam) / 0.08) * 0.6 : 1;
      c.save();
      c.translate(1000 + out, 330);
      c.rotate((-12 * Math.PI) / 180);
      c.scale(sc, sc);
      nameText(c, k.name, 0, 0, k.color);
      c.restore();
      if (k.sub) {
        const n = Math.min(k.sub.length, Math.floor(((t - CUT.slam) / CUT.typed) * k.sub.length));
        c.save();
        c.translate(1000 + out, 390);
        c.rotate((-12 * Math.PI) / 180);
        dotText(c, k.sub.slice(0, n), 0, 0, 22, '#d8dde0', '#000', 'center');
        c.restore();
      }
    }
    c.restore();
  }
}

/* ── 도트 글씨 ── */
const textCache = new Map<string, HTMLCanvasElement>();
/** Galmuri로 쓰고 알파를 0/1로 끊어 도트 글씨로. 테두리 1칸 + 아래 그림자 */
function crisp(text: string, size: number, fill: string, edge: string, edgeW: number, shadow: number): HTMLCanvasElement {
  const ready = typeof document !== 'undefined' && document.fonts?.check?.(`11px "${PIXEL_FONT}"`);
  const key = `${text}|${size}|${fill}|${edge}|${edgeW}|${shadow}|${ready}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const pad = edgeW + shadow + 2;
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = `${size}px "${PIXEL_FONT}", sans-serif`;
  const w = Math.ceil(m.measureText(text).width) + pad * 2, h = Math.ceil(size * 1.25) + pad * 2;
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const g = mask.getContext('2d')!;
  g.font = m.font;
  g.textBaseline = 'top';
  g.fillStyle = '#fff';
  g.fillText(text, pad, pad);
  const d = g.getImageData(0, 0, w, h);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
  g.putImageData(d, 0, 0);
  const solid = (color: string) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const o = cv.getContext('2d')!;
    o.drawImage(mask, 0, 0);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = color;
    o.fillRect(0, 0, w, h);
    return cv;
  };
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const o = out.getContext('2d')!;
  if (shadow) { const b = solid('#000'); for (let dy = 1; dy <= shadow; dy++) o.drawImage(b, dy, dy); }
  if (edgeW) { const e = solid(edge); for (let dx = -edgeW; dx <= edgeW; dx++) for (let dy = -edgeW; dy <= edgeW; dy++) if (dx || dy) o.drawImage(e, dx, dy); }
  o.drawImage(solid(fill), 0, 0);
  textCache.set(key, out);
  return out;
}
/** 작은 도트 글씨 (피해 숫자·부제) */
export function dotText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, edge = '#000', align: 'left' | 'center' = 'left') {
  if (!text) return;
  const im = crisp(text, Math.round(size), fill, edge, 2, 2);
  c.drawImage(im, Math.round(align === 'center' ? x - im.width / 2 : x), Math.round(y - im.height / 2));
}
/** 필살 기술명: 44px 흰색 + 요원 색 2px 외곽선 + 검은 4px 그림자 */
function nameText(c: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  const im = crisp(text, 44, '#ffffff', color, 2, 4);
  c.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height / 2));
}

/* ── 색 덧입히기 ── */
let tintCv: HTMLCanvasElement | null = null;
/** draw가 그린 모양을 color 한 색으로 (a = 원래 그림 위에 덧입힐 진하기, 1이면 단색 실루엣) */
export function tinted(c: CanvasRenderingContext2D, draw: (o: CanvasRenderingContext2D) => void, color: string, a = 1) {
  const W = c.canvas.width, H = c.canvas.height;
  if (!tintCv) tintCv = document.createElement('canvas');
  if (tintCv.width !== W || tintCv.height !== H) (tintCv.width = W), (tintCv.height = H);
  const o = tintCv.getContext('2d')!;
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'source-over';
  o.clearRect(0, 0, W, H);
  o.setTransform(c.getTransform());
  o.imageSmoothingEnabled = false;
  draw(o);
  if (a < 1) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(tintCv, 0, 0); c.restore(); }
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'source-in';
  o.globalAlpha = a;
  o.fillStyle = color;
  o.fillRect(0, 0, W, H);
  o.globalAlpha = 1;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(tintCv, 0, 0); // a < 1이면 원래 그림 위에 색만 겹친다
  c.restore();
}
/** 맞은 몸 번쩍 그리기: mode 'white'면 흰 실루엣, 'color'면 요원 색 실루엣, null이면 그대로 */
export function drawFlashed(c: CanvasRenderingContext2D, draw: (o: CanvasRenderingContext2D) => void, mode: 'white' | 'color' | null, color: string) {
  if (!mode) return draw(c);
  tinted(c, draw, mode === 'white' ? '#ffffff' : color);
}
