// 화면 효과: 땅 그림자, 어두운 층 조명·림라이트, 피격 섬광(하얀 실루엣), 흔들림, 스파크·충격파, 피해 숫자,
// 층 제목, 전환(암전·승강기 문·조리개·지직). 엔진은 onEvent 로 사건만 알려 주면 된다.
import { FONT, label, pfont, setPixelText } from './hud';
import { H as H0, W as W0 } from './stage';

// 캔버스 크기 (채우기면 가로가 넓다). 그리는 함수가 정한다
let W = W0,
  H = H0;
const size = (c: CanvasRenderingContext2D) => ((W = c.canvas.width), (H = c.canvas.height));

export type FxEvent =
  | { type: 'hit'; x: number; y: number; strength: 1 | 2 | 3; dmg?: number; target?: 'enemy' | 'player' }
  | { type: 'guard'; x: number; y: number }
  | { type: 'down'; x: number; y: number }
  | { type: 'hurt'; strength?: number }
  | { type: 'blast'; x: number; y: number; r?: number }
  | { type: 'ult' }
  | { type: 'heal'; x: number; y: number; amount?: number }
  | { type: 'pop'; x: number; y: number; text: string; color?: string }
  | { type: 'floor'; depth: string; name: string; variant?: string };

export type TransitionKind = 'fade' | 'doors' | 'iris' | 'glitch';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
  size: number;
}
interface Ring {
  x: number;
  y: number;
  t: number;
  life: number;
  r0: number;
  r1: number;
  color: string;
  width: number;
}
interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  big: boolean;
}

function off(w: number, h: number): CanvasRenderingContext2D {
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return cv.getContext('2d') as CanvasRenderingContext2D;
}
function fit(c: CanvasRenderingContext2D, w: number, h: number) {
  const cv = c.canvas as HTMLCanvasElement;
  if (cv.width < w || cv.height < h) (cv.width = Math.max(cv.width, Math.ceil(w))), (cv.height = Math.max(cv.height, Math.ceil(h)));
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.clearRect(0, 0, w, h);
}

export interface FxOptions {
  shake: number;
  flash: boolean;
  numbers: boolean;
}

export class Fx {
  opt: FxOptions = { shake: 1, flash: true, numbers: true };
  private shakeT = 0;
  private shakeDur = 0;
  private shakePow = 0;
  private flashes: { color: string; t: number; dur: number; a: number }[] = [];
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private pops: Pop[] = [];
  private title: { depth: string; name: string; variant?: string; t: number } | null = null;
  private dim = 0;
  private tr: { kind: TransitionKind; t: number; dur: number; mid?: () => void; midDone: boolean; x: number; y: number; done: () => void; text: string } | null = null;
  private time = 0;
  private m1 = off(256, 256);
  private m2 = off(256, 256);
  private dark = off(1800, 720);
  /** 진동 같은 바깥 반응 (게임패드·폰) */
  rumble: ((strength: number, ms: number) => void) | null = null;

  onEvent(e: FxEvent) {
    switch (e.type) {
      case 'hit': {
        const s = e.strength;
        // 오락실 타격감(검수 9번): 더 크게, 숫자는 머리 위로 크게
        this.shake(3 + s * 4, 0.1 + s * 0.06);
        this.burst(e.x, e.y, 10 + s * 7, e.target === 'player' ? '#ff6050' : '#ffe0a0', 3 + s * 1.5);
        this.ring(e.x, e.y, 16, 60 + s * 45, s === 3 ? '#fff' : '#ffd890', 4 + s * 3, 0.2 + s * 0.05);
        if (e.dmg != null && Math.round(e.dmg) > 0 && this.opt.numbers) this.pop(e.x, e.y - 30, String(Math.round(e.dmg)), e.target === 'player' ? '#ff7060' : s === 3 ? '#ffe070' : '#fff', s >= 2);
        if (s === 3) this.flash('#fff', 0.08, 0.35);
        this.rumble?.(0.2 + s * 0.2, 60 + s * 30);
        break;
      }
      case 'guard':
        this.burst(e.x, e.y, 8, '#9fd8ff', 3);
        this.ring(e.x, e.y, 20, 60, '#9fd8ff', 4, 0.2);
        this.shake(2, 0.06);
        break;
      case 'down':
        this.shake(6, 0.15);
        this.burst(e.x, e.y, 10, '#b0a490', 3, -1);
        break;
      case 'hurt':
        this.shake(5 + (e.strength ?? 1) * 3, 0.18);
        this.flash('#ff2020', 0.1, 0.2); // 화면 전체가 붉게 물들지 않게 약하게 (독립 검수)
        this.rumble?.(0.6, 140);
        break;
      case 'blast':
        this.shake(10, 0.3);
        this.ring(e.x, e.y, 20, e.r ?? 220, '#ffb070', 8, 0.35);
        this.burst(e.x, e.y, 26, '#ffb070', 5);
        this.flash('#ffd8a0', 0.12, 0.3);
        this.rumble?.(1, 250);
        break;
      case 'ult':
        this.dim = 0.7;
        this.flash('#fff', 0.15, 0.5);
        this.rumble?.(0.8, 200);
        break;
      case 'heal':
        this.burst(e.x, e.y, 12, '#80f0a0', 2, -1.5);
        if (e.amount && this.opt.numbers) this.pop(e.x, e.y - 40, `+${e.amount}`, '#80f0a0', false);
        break;
      case 'pop':
        this.pop(e.x, e.y, e.text, e.color ?? '#fff', false);
        break;
      case 'floor':
        this.title = { depth: e.depth, name: e.name, variant: e.variant, t: 0 };
        break;
    }
  }

  /** 엔진 GameEvent(engine/contract.ts)를 그대로 받는다. y 는 화면 y(발 위치 − 높이), 없으면 opt.y */
  onGameEvent(e: { type: string; [k: string]: unknown }, opt: { y?: number } = {}) {
    const n = (k: string, d = 0) => (typeof e[k] === 'number' ? (e[k] as number) : d);
    const x = n('x'),
      y = typeof e.y === 'number' ? n('y') - n('z') : opt.y ?? 520;
    switch (e.type) {
      case 'hit':
        return this.onEvent({ type: 'hit', x, y, strength: Math.max(1, Math.min(3, n('strength', 1))) as 1 | 2 | 3, dmg: n('dmg'), target: e.target === 'player' ? 'player' : 'enemy' });
      case 'guard':
        return this.onEvent({ type: 'guard', x, y });
      case 'guardBreak':
        this.shake(8, 0.2);
        this.ring(x, y, 20, 120, '#9fd8ff', 6, 0.3);
        return this.flash('#9fd8ff', 0.12, 0.3);
      case 'hurt':
        return this.onEvent({ type: 'hurt', strength: n('dmg') > 20 ? 2 : 1 });
      case 'down':
        return this.onEvent({ type: 'down', x, y: opt.y ?? 600 });
      case 'super':
        return this.onEvent({ type: 'ult' });
      case 'ability':
        return this.shake(4, 0.1);
      case 'heal':
        return this.onEvent({ type: 'heal', x, y });
      case 'bossRoar':
        return this.shake(10, 0.6);
      case 'ruleFound':
        return this.flash('#f0d890', 0.25, 0.18);
      case 'enter:floor': {
        const f = (e.floor ?? {}) as { title?: string; depth?: number; type?: string };
        return this.onEvent({ type: 'floor', depth: f.depth == null ? '' : f.depth <= 3 ? `L${f.depth}` : `B-${f.depth - 3}`, name: f.title ?? '' });
      }
    }
  }

  shake(pow: number, dur: number) {
    if (pow * this.opt.shake < this.shakePow * (this.shakeT / (this.shakeDur || 1))) return;
    this.shakePow = pow * this.opt.shake;
    this.shakeT = this.shakeDur = dur;
  }
  flash(color: string, dur: number, a = 0.4) {
    if (!this.opt.flash) return;
    this.flashes.push({ color, t: 0, dur, a });
  }
  burst(x: number, y: number, n: number, color: string, speed: number, lift = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        v = (0.4 + Math.random()) * speed * 60;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 + lift * 60, t: 0, life: 0.18 + Math.random() * 0.22, color, size: 2 + Math.random() * 3 });
    }
  }
  ring(x: number, y: number, r0: number, r1: number, color: string, width: number, life: number) {
    this.rings.push({ x, y, r0, r1, color, width, life, t: 0 });
  }
  pop(x: number, y: number, text: string, color: string, big: boolean) {
    // 같은 자리의 앞 숫자와 겹치지 않게 엇갈린다: 가까운 숫자가 남아 있으면 옆·위로 한 칸씩 (검수 12-5)
    let n = 0;
    for (const p of this.pops) if (p.t < 0.6 && Math.abs(p.x - x) < 70 && Math.abs(p.y - y) < 90) n++;
    const side = n % 2 ? 1 : -1;
    this.pops.push({ x: x + (n ? side * (28 + 14 * n) : (Math.random() - 0.5) * 16), y: y - n * 34, text, color, t: 0, big });
  }

  /** 흔들림 오프셋: 카메라에 더한다 */
  camera(): { x: number; y: number } {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = this.shakeT / this.shakeDur;
    const p = this.shakePow * k;
    return { x: Math.round((Math.random() * 2 - 1) * p), y: Math.round((Math.random() * 2 - 1) * p * 0.6) };
  }
  get busy() {
    return !!this.tr;
  }

  update(dt: number) {
    this.time += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
    for (const s of this.sparks) (s.t += dt), (s.x += s.vx * dt), (s.y += s.vy * dt), (s.vy += 900 * dt), (s.vx *= 0.9);
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.life);
    for (const p of this.pops) (p.t += dt), (p.y -= dt * (p.t < 0.2 ? 160 : 30));
    this.pops = this.pops.filter((p) => p.t < 0.9);
    if (this.title) {
      this.title.t += dt;
      if (this.title.t > 1.9) this.title = null;
    }
    this.dim = Math.max(0, this.dim - dt * 1.2);
    if (this.tr) {
      const tr = this.tr;
      tr.t += dt;
      if (!tr.midDone && tr.t >= tr.dur / 2) {
        tr.midDone = true;
        tr.mid?.();
      }
      if (tr.t >= tr.dur) {
        this.tr = null;
        tr.done();
      }
    }
  }

  /** 월드 좌표 효과 (카메라 변환을 걸고 부른다) */
  drawWorld(c: CanvasRenderingContext2D) {
    c.save();
    for (const r of this.rings) {
      const k = r.t / r.life;
      c.globalAlpha = 1 - k;
      c.strokeStyle = r.color;
      c.lineWidth = r.width * (1 - k * 0.6);
      c.beginPath();
      c.ellipse(r.x, r.y, r.r0 + (r.r1 - r.r0) * easeOut(k), (r.r0 + (r.r1 - r.r0) * easeOut(k)) * 0.75, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      c.globalAlpha = 1 - s.t / s.life;
      c.fillStyle = s.color;
      c.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      c.fillRect(s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.size * 0.6, s.size * 0.6);
    }
    c.globalCompositeOperation = 'source-over';
    for (const p of this.pops) {
      const a = p.t > 0.6 ? 1 - (p.t - 0.6) / 0.3 : 1;
      const sc = p.t < 0.1 ? 1 + (0.1 - p.t) * 6 : 1;
      c.globalAlpha = a;
      setPixelText(true); // 피해 숫자도 도트 글꼴
      label(c, p.text, p.x, p.y, (p.big ? 46 : 34) * sc, p.color, 'center', 900);
      setPixelText(false);
    }
    c.restore();
  }

  /** 화면 덮개: 필살 암전·섬광·체력 위험 테두리·층 제목. HUD 보다 먼저 */
  drawScreen(c: CanvasRenderingContext2D, hpRatio = 1) {
    size(c);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.dim > 0) (c.fillStyle = `rgba(0,0,0,${Math.min(0.6, this.dim)})`), c.fillRect(0, 0, W, H);
    if (hpRatio < 0.3) {
      const k = (0.3 - hpRatio) / 0.3;
      const pulse = 0.55 + Math.sin(this.time * (4 + k * 4)) * 0.25;
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(120,0,0,0)');
      g.addColorStop(1, `rgba(150,0,0,${0.55 * k * pulse + 0.1})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    for (const f of this.flashes) {
      c.globalAlpha = f.a * (1 - f.t / f.dur);
      c.fillStyle = f.color;
      c.fillRect(0, 0, W, H);
    }
    c.globalAlpha = 1;
    if (this.title) this.drawTitle(c, this.title);
    c.restore();
  }

  private drawTitle(c: CanvasRenderingContext2D, t: { depth: string; name: string; variant?: string; t: number }) {
    // 짧은 층 제목 한 줄만 (검수 4-7: 위아래 검은 띠·가운데 반투명 띠·큰 L1 글자 없음)
    // 벽에 붙은 글씨로 읽히지 않게 천장 띠에 어두운 도트 판을 받쳐 잠깐만 (독립 검수: 층 제목이 벽·문 위에 남음)
    const inK = Math.min(1, t.t / 0.3),
      outK = t.t > 1.5 ? (t.t - 1.5) / 0.4 : 0;
    c.globalAlpha = Math.max(0, inK * (1 - outK));
    // 층 숫자는 오른쪽 위 HUD(L1)에 있으니 이름만, 그 바로 아래 오른쪽 끝에 (독립 검수: 「L1 · 로비」가 「L1」과 겹침)
    const text = t.name.replace(/^\s*(L\d+|B-?\d+)\s*·\s*/, '') || t.depth;
    c.font = pfont(22).f;
    const pw = (Math.round(c.measureText(text).width + 40) + 3) & ~3,
      ph = t.variant ? 64 : 44,
      px = (Math.round(W - 16 - pw) >> 2) << 2,
      py = 62;
    c.fillStyle = '#0c0f12';
    c.fillRect(px - 4, py - 4, pw + 8, ph + 8);
    c.fillStyle = '#b8873a';
    c.fillRect(px, py, pw, ph);
    c.fillStyle = 'rgba(16,20,24,0.94)';
    c.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    // 도트 글꼴 (시스템 글꼴 금지)
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ece2c8';
    c.fillText(text, px + pw / 2, py + 22);
    if (t.variant) (c.font = pfont(11).f), (c.fillStyle = '#f0b45a'), c.fillText(`변형 · ${t.variant}`, px + pw / 2, py + 48);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.globalAlpha = 1;
  }

  /** 전환: 가운데에서 mid 를 부르고 끝나면 풀린다 */
  /** open: 이미 덮인 상태에서 시작해 열리기만 한다 (상태가 먼저 바뀐 뒤 부를 때) */
  transition(kind: TransitionKind, opts: { dur?: number; mid?: () => void; x?: number; y?: number; text?: string; open?: boolean } = {}): Promise<void> {
    return new Promise((done) => {
      if (this.tr) {
        // 앞 전환을 바로 끝낸다
        const old = this.tr;
        if (!old.midDone) old.mid?.();
        old.done();
      }
      const dur = opts.dur ?? (kind === 'doors' ? 1.6 : kind === 'glitch' ? 0.7 : 0.8);
      this.tr = { kind, t: opts.open ? dur / 2 : 0, dur, mid: opts.mid, midDone: !!opts.open, x: opts.x ?? W / 2, y: opts.y ?? H / 2, done, text: opts.text ?? '' };
    });
  }
  /** 맨 마지막(HUD·메뉴 위)에 그린다 */
  drawTransition(c: CanvasRenderingContext2D) {
    size(c);
    const tr = this.tr;
    if (!tr) return;
    const half = tr.dur / 2;
    // 0 → 1 (덮음) → 0
    const k = tr.t < half ? easeInOut(tr.t / half) : 1 - easeInOut((tr.t - half) / half);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (tr.kind === 'fade') {
      c.fillStyle = `rgba(0,0,0,${k})`;
      c.fillRect(0, 0, W, H);
    } else if (tr.kind === 'doors') {
      // 승강기 문: 양쪽에서 닫히고, 닫힌 동안 층 숫자
      const hold = Math.min(1, k * 1.15);
      const dw = (W / 2) * hold;
      const g = c.createLinearGradient(0, 0, dw, 0);
      g.addColorStop(0, '#3c4448');
      g.addColorStop(1, '#5f696e');
      c.fillStyle = g;
      c.fillRect(0, 0, dw, H);
      const g2 = c.createLinearGradient(W, 0, W - dw, 0);
      g2.addColorStop(0, '#3c4448');
      g2.addColorStop(1, '#5f696e');
      c.fillStyle = g2;
      c.fillRect(W - dw, 0, dw, H);
      c.fillStyle = 'rgba(0,0,0,0.5)';
      for (let i = 1; i < 4; i++) c.fillRect((dw * i) / 4, 0, 1, H), c.fillRect(W - (dw * i) / 4, 0, 1, H);
      c.fillStyle = '#111';
      c.fillRect(dw - 2, 0, 2, H);
      c.fillRect(W - dw, 0, 2, H);
      if (hold >= 1 && tr.text) {
        c.fillStyle = '#120604';
        c.fillRect(W / 2 - 90, 70, 180, 70);
        setPixelText(true);
        label(c, tr.text, W / 2, 124, 44, '#ff8a40', 'center', 900);
        setPixelText(false);
      }
    } else if (tr.kind === 'iris') {
      const r = Math.hypot(W, H) * (1 - k);
      c.fillStyle = '#000';
      c.beginPath();
      c.rect(0, 0, W, H);
      c.arc(tr.x, tr.y, Math.max(0, r), 0, Math.PI * 2, true);
      c.fill();
    } else {
      // 지직: 가로 띠가 밀리고 붉은 잡음
      const src = c.canvas;
      const n = 14;
      for (let i = 0; i < n; i++) {
        if (Math.random() > 0.35 + k * 0.5) continue;
        const y = Math.floor(Math.random() * H),
          h = 4 + Math.random() * 40;
        const dx = (Math.random() - 0.5) * 160 * k;
        c.drawImage(src, 0, y, W, h, dx, y, W, h);
      }
      c.fillStyle = `rgba(0,0,0,${k * 0.85})`;
      c.fillRect(0, 0, W, H);
      c.fillStyle = `rgba(180,20,20,${k * 0.25})`;
      for (let i = 0; i < 40; i++) c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 80, 2);
    }
    c.restore();
  }

  // ── 그리기 도구 (엔진·렌더러가 쓴다) ──

  /** 땅 그림자: 공중에 뜰수록 작고 옅게 */
  static shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number, z = 0) {
    const k = Math.max(0.35, 1 - z / 320);
    c.save();
    c.fillStyle = `rgba(0,0,0,${0.45 * k})`;
    c.beginPath();
    c.ellipse(x, y, (w / 2) * k, (w / 7) * k, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /** 어두운 층: 빛 자리만 뚫린 어둠. 빛은 월드 좌표, camX 를 빼서 그린다 */
  darkness(c: CanvasRenderingContext2D, lights: { x: number; y: number; r: number; color?: string; flicker?: boolean }[], alpha: number, camX: number, camY = 0) {
    size(c);
    const d = this.dark;
    fit(d, W, H);
    d.fillStyle = `rgba(2,3,6,${alpha})`;
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const r = l.r * (l.flicker ? 0.94 + Math.sin(this.time * 23) * 0.03 + Math.random() * 0.03 : 1);
      const x = l.x - camX,
        y = l.y - camY;
      const g = d.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.fillRect(x - r, y - r, r * 2, r * 2);
    }
    d.globalCompositeOperation = 'source-over';
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(d.canvas, 0, 0, W, H, 0, 0, W, H);
    // 빛 색 (따뜻한 손전등 등)
    c.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.color) continue;
      const x = l.x - camX,
        y = l.y - camY;
      const g = c.createRadialGradient(x, y, 0, x, y, l.r);
      g.addColorStop(0, l.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - l.r, y - l.r, l.r * 2, l.r * 2);
    }
    c.restore();
  }

  /** 실루엣을 한 색으로 (피격 하얀 번쩍). draw 는 (0,0)~(w,h) 안에 그림을 그린다 */
  tint(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, draw: (o: CanvasRenderingContext2D) => void, color: string, a = 1) {
    const m = this.m1;
    fit(m, w, h);
    draw(m);
    m.globalCompositeOperation = 'source-in';
    m.fillStyle = color;
    m.fillRect(0, 0, w, h);
    c.save();
    c.globalAlpha *= a;
    c.drawImage(m.canvas, 0, 0, w, h, x, y, w, h);
    c.restore();
  }

  /** 림라이트: 빛을 향한 가장자리만 밝게. 어두운 층에서 캐릭터가 배경과 갈라져 보이게 한다 */
  rim(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, draw: (o: CanvasRenderingContext2D) => void, lx: number, ly: number, color = '#ffd9a0', a = 0.9, thick = 3) {
    const pad = thick + 1;
    const ww = w + pad * 2,
      hh = h + pad * 2;
    const s = this.m2,
      r = this.m1;
    fit(s, ww, hh);
    s.translate(pad, pad);
    draw(s);
    s.setTransform(1, 0, 0, 1, 0, 0);
    fit(r, ww, hh);
    r.drawImage(s.canvas, 0, 0, ww, hh, 0, 0, ww, hh);
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = color;
    r.fillRect(0, 0, ww, hh);
    // 빛 쪽으로 thick 만큼 밀린 실루엣이 덮는 곳을 지우면 빛을 향한 테두리만 남는다
    const cx = x + w / 2,
      cy = y + h / 2;
    const d = Math.hypot(lx - cx, ly - cy) || 1;
    const dx = ((lx - cx) / d) * thick,
      dy = ((ly - cy) / d) * thick;
    r.globalCompositeOperation = 'destination-out';
    r.drawImage(s.canvas, 0, 0, ww, hh, -dx, -dy, ww, hh);
    c.save();
    c.globalAlpha *= a;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(r.canvas, 0, 0, ww, hh, x - pad, y - pad, ww, hh);
    c.restore();
  }
}

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export { FONT };
