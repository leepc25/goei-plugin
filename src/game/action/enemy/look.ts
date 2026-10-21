// 그림이 오기 전 임시 모양: 종마다 다른 어두운 실루엣 + 눈빛 한 점. 상태에 따라 자세가 바뀐다
// (걷기 다리, 예비 동작 젖힘, 공격 때 팔 뻗기, 피격 때 뒤로 꺾임, 공중 회전, 다운 때 눕기).
// 좌표: 발 = (0, 0), 위가 −, 바라보는 쪽이 +x. Enemy.draw가 e.x, e.y−e.z로 옮기고 dir로 뒤집어 부른다.
import type { Enemy } from './enemy';
import { toWorld } from './geom';

type Shape = 'human' | 'spider' | 'beast' | 'snake' | 'hand' | 'furniture' | 'boxes';
type Extra = 'cap' | 'backpack' | 'coat' | 'skirt' | 'apron' | 'hair' | 'target' | 'shield' | 'sword' | 'mask' | 'glasses' | 'jaw' | 'strap' | 'wrap' | 'melt';

interface Look {
  shape: Shape;
  /** 어깨 두께(몸통 선 굵기, 키 대비) */
  bulk?: number;
  /** 팔 길이 (키 대비, 보통 0.36) */
  arm?: number;
  /** 머리 반지름 (키 대비) */
  head?: number;
  /** 목·상체가 앞으로 굽은 정도 (키 대비) */
  hunch?: number;
  /** 다리 길이 (키 대비, 보통 0.46) */
  leg?: number;
  eye?: string;
  /** 거꾸로 붙은 얼굴: 눈이 머리 아래쪽 */
  flipFace?: boolean;
  extras?: Extra[];
  /** 팔 추가 (그림자) */
  arms?: number;
}

const LOOKS: Record<string, Look> = {
  lurker: { shape: 'human', bulk: 0.15, head: 0.075, hunch: 0.05, eye: '#f2efe6', extras: [] },
  hollow: { shape: 'human', bulk: 0.14, arm: 0.5, head: 0.07, hunch: 0.08, eye: '' },
  shooter: { shape: 'human', bulk: 0.12, arm: 0.48, head: 0.07, hunch: 0.03, eye: '#ffd760', extras: ['strap'] },
  thief: { shape: 'human', bulk: 0.15, head: 0.072, hunch: 0.07, eye: '#e8e2d0', extras: ['cap', 'backpack'] },
  charger: { shape: 'human', bulk: 0.26, head: 0.07, hunch: 0.16, leg: 0.4, eye: '#ff6a3a', extras: ['target'] },
  resident: { shape: 'human', bulk: 0.16, head: 0.08, hunch: 0.02, eye: '#f2efe6', extras: ['jaw'] },
  hum: { shape: 'human', bulk: 0.13, head: 0.07, hunch: 0.06, eye: '#9fd3e6' },
  noise: { shape: 'human', bulk: 0.13, head: 0.075, hunch: 0.06, eye: '#c8e070', arms: 1 },
  mummy: { shape: 'human', bulk: 0.11, head: 0.07, hunch: 0.12, eye: '#d8c890', extras: ['wrap'] },
  guard: { shape: 'human', bulk: 0.19, head: 0.07, eye: '#ffe08a', extras: ['cap'] },
  proctor: { shape: 'human', bulk: 0.16, head: 0.07, hunch: 0.02, eye: '#ffe08a', extras: ['coat', 'strap'] },
  elder_f: { shape: 'human', bulk: 0.16, head: 0.085, hunch: 0.16, leg: 0.38, eye: '#ff5040', flipFace: true, extras: ['apron'] },
  elder_m: { shape: 'human', bulk: 0.13, arm: 0.44, head: 0.07, hunch: 0.05, eye: '#ff5040', flipFace: true },
  family_f: { shape: 'human', bulk: 0.15, head: 0.08, hunch: 0.04, eye: '#e070ff', extras: ['hair', 'skirt', 'jaw'] },
  family_m: { shape: 'human', bulk: 0.24, arm: 0.42, head: 0.068, hunch: 0.04, eye: '#f2efe6' },
  shadow: { shape: 'human', bulk: 0.2, arm: 0.5, head: 0.08, hunch: 0.06, eye: '#ffffff', arms: 2, extras: ['melt'] },
  fb_smg: { shape: 'human', bulk: 0.17, head: 0.07, eye: '', extras: ['glasses'] },
  fb_shield: { shape: 'human', bulk: 0.19, head: 0.07, hunch: 0.04, eye: '', extras: ['glasses', 'shield'] },
  fb_chief: { shape: 'human', bulk: 0.18, head: 0.075, eye: '', extras: ['glasses', 'coat'] },
  fb_sword: { shape: 'human', bulk: 0.15, head: 0.07, hunch: 0.03, eye: '', extras: ['glasses', 'sword'] },
  dd_member: { shape: 'human', bulk: 0.15, head: 0.075, eye: '#ffffff', extras: ['mask'] },
  doorframe: { shape: 'human', bulk: 0.36, head: 0.06, hunch: 0.28, leg: 0.36, eye: '#ff5040', extras: ['shield'] },
  crawler: { shape: 'spider', eye: '#ff4030' },
  legs: { shape: 'spider', eye: '#ff4030' },
  predator: { shape: 'beast', eye: '#ffcf40' },
  tv402: { shape: 'snake', eye: '#9fd3e6' },
  toucher: { shape: 'hand' },
  doorhand: { shape: 'hand' },
  dusty: { shape: 'furniture', eye: '#ffcf40' },
};

export function lookFor(kind: string): Look | null {
  const l = LOOKS[kind];
  return l && l.shape !== 'boxes' ? l : null;
}

/** 몸 색: 종 색을 아주 어둡게 (그림자 사람) */
export function shadowColor(hex: string, k = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const base = [13, 15, 19];
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * (1 - k) + base[i] * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function rim(hex: string): string {
  return shadowColor(hex, 0.35);
}

interface Pose {
  /** 몸 전체 기울기 (라디안, + = 앞으로) */
  tilt: number;
  /** 상체만 더 숙임 */
  lean: number;
  /** 걷기 위상 (−1~1) */
  step: number;
  /** 앞팔·뒤팔 각도 (0 = 아래로, π/2 = 앞으로 수평, π = 위로) */
  armF: number;
  armB: number;
  /** 앞팔 뻗기 배율 */
  reach: number;
  crouch: number;
  /** 0 = 서 있음, 1 = 누움 */
  lie: number;
  open: number;
}

function poseOf(e: Enemy): Pose {
  const f = e.frameNow();
  const p: Pose = { tilt: 0, lean: 0, step: 0, armF: 0.25, armB: -0.2, reach: 1, crouch: 0, lie: 0, open: 0 };
  const breath = Math.sin(e.age * 0.09);
  switch (e.state) {
    case 'walk':
    case 'flee': {
      const s = Math.sin(e.age * (e.state === 'flee' ? 0.5 : 0.32));
      p.step = s;
      p.armF = 0.2 - s * 0.5;
      p.armB = -0.2 + s * 0.5;
      p.lean = e.state === 'flee' ? 0.25 : 0.04;
      break;
    }
    case 'attack': {
      if (f?.tele) {
        // 예비: 뒤로 젖히고 팔을 뒤로 들어 버틴다
        p.lean = -0.16;
        p.armF = 2.5;
        p.armB = -0.6;
        p.crouch = 6;
        p.open = 0.5;
      } else if (f?.hit.length) {
        // 공격: 팔을 공격 상자 쪽으로 뻗는다
        const b = f.hit[0];
        const shoulderZ = e.def.h * 0.78;
        const midZ = (b.z0 + b.z1) / 2;
        const midX = Math.max(10, (b.fx0 + b.fx1) / 2);
        p.armF = Math.max(0.3, Math.min(2.6, Math.atan2(midX, shoulderZ - midZ)));
        p.reach = Math.min(1.7, Math.max(1, Math.hypot(midX, shoulderZ - midZ) / (e.def.h * 0.42)));
        p.lean = 0.22;
        p.armB = -0.9;
        p.step = 0.7;
        p.open = 1;
      } else {
        p.lean = 0.1;
        p.armF = 1;
        p.step = 0.4;
      }
      break;
    }
    case 'grabbing':
      p.armF = 1.5;
      p.armB = 1.3;
      p.lean = 0.15;
      p.open = 1;
      break;
    case 'hurt':
    case 'bound': {
      // 맞으면 뒤로 꺾였다 돌아온다
      const k = Math.max(0, 1 - e.st / 10);
      p.tilt = -0.28 * (0.4 + 0.6 * k);
      p.lean = -0.18 * k;
      p.armF = 1.1;
      p.armB = 0.9;
      break;
    }
    case 'stunned':
      p.tilt = Math.sin(e.age * 0.25) * 0.12;
      p.lean = 0.2;
      p.armF = 0.1;
      p.armB = 0.1;
      p.crouch = 8;
      break;
    case 'air':
      p.tilt = -0.5 - Math.min(0.9, e.st * 0.05);
      p.armF = 2.2;
      p.armB = 2;
      p.step = 0.6;
      break;
    case 'down':
    case 'dead':
      p.lie = 1;
      p.armF = 2.9;
      p.armB = 3.05;
      break;
    case 'getup':
      p.lie = Math.max(0, 1 - e.st / 12);
      p.crouch = 14 * p.lie;
      break;
    default:
      p.crouch = breath * 1.5;
  }
  return p;
}

type Ctx = CanvasRenderingContext2D;

function limb(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, bend: number) {
  const mx = (x0 + x1) / 2 + bend;
  const my = (y0 + y1) / 2;
  ctx.moveTo(x0, y0);
  ctx.lineTo(mx, my);
  ctx.lineTo(x1, y1);
}

/** 사람 모양. 외곽선을 먼저 굵게, 몸을 그 위에 */
function human(ctx: Ctx, e: Enemy, L: Look, p: Pose, body: string, line: string, outline: string) {
  const h = e.def.h;
  const leg = h * (L.leg ?? 0.46) - p.crouch;
  const bulk = h * (L.bulk ?? 0.15);
  const r = h * (L.head ?? 0.075);
  const arm = h * (L.arm ?? 0.38);
  const hunch = h * (L.hunch ?? 0);
  const torso = h - leg - p.crouch - r * 2;
  const stride = h * 0.11;
  const hipX = 0;
  const hipY = -leg;
  const lean = p.lean + (L.hunch ?? 0) * 0.8;
  const neckX = hipX + Math.sin(lean) * torso + hunch * 0.4;
  const neckY = hipY - Math.cos(lean) * torso;
  const sx = neckX - Math.sin(lean) * bulk * 0.3;
  const sy = neckY + bulk * 0.3;
  const headX = neckX + Math.sin(lean) * r * 1.1 + r * 0.2;
  const headY = neckY - Math.cos(lean) * r * 0.95;
  const armEnd = (a: number, len: number) => [sx + Math.sin(a) * len, sy + Math.cos(a) * len] as const;
  const [fx, fy] = armEnd(p.armF, arm * p.reach);
  const [bx, by] = armEnd(p.armB, arm);
  const extras = L.extras ?? [];

  const strokeAll = (w: number, color: string, pass: 'outline' | 'body') => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const add = pass === 'outline' ? w : 0;
    // 뒤팔 → 뒷다리 → 몸통 → 앞다리 → 앞팔 순
    ctx.lineWidth = bulk * 0.42 + add;
    ctx.beginPath();
    limb(ctx, sx, sy, bx, by, -arm * 0.08);
    for (let i = 0; i < (L.arms ?? 0); i++) limb(ctx, sx, sy + 10 + i * 14, sx + Math.sin(p.armB + 1 + i) * arm, sy + 10 + i * 14 + Math.cos(p.armB + 1 + i) * arm, arm * 0.1);
    ctx.stroke();
    ctx.lineWidth = bulk * 0.55 + add;
    ctx.beginPath();
    limb(ctx, hipX, hipY, hipX - p.step * stride, 0, h * 0.04);
    ctx.stroke();
    ctx.lineWidth = bulk + add;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY + bulk * 0.2);
    ctx.lineTo(neckX, neckY + bulk * 0.25);
    ctx.stroke();
    if (extras.includes('coat') || extras.includes('skirt') || extras.includes('apron') || extras.includes('melt')) {
      const low = extras.includes('melt') ? 0 : extras.includes('coat') ? -leg * 0.35 : -leg * 0.55;
      const flare = extras.includes('melt') ? bulk * 1.4 : bulk * 0.8;
      ctx.beginPath();
      ctx.moveTo(hipX - bulk * 0.45 - add / 2, hipY - bulk * 0.3);
      ctx.lineTo(hipX + bulk * 0.45 + add / 2, hipY - bulk * 0.3);
      ctx.lineTo(hipX + flare + add / 2, low + add / 2);
      ctx.lineTo(hipX - flare - add / 2, low + add / 2);
      ctx.closePath();
      ctx.fill();
    }
    if (extras.includes('backpack')) {
      const bx0 = neckX - bulk * 0.5 - h * 0.12 - add / 2;
      ctx.fillRect(bx0, neckY + bulk * 0.2 - add / 2, h * 0.14 + add, torso * 0.6 + add);
    }
    ctx.lineWidth = bulk * 0.55 + add;
    ctx.beginPath();
    limb(ctx, hipX, hipY, hipX + p.step * stride, 0, h * 0.04);
    ctx.stroke();
    // 머리
    ctx.beginPath();
    ctx.arc(headX, headY, r + add / 2, 0, Math.PI * 2);
    ctx.fill();
    if (extras.includes('hair')) {
      ctx.beginPath();
      ctx.arc(headX - r * 0.35, headY - r * 0.35, r * 1.15 + add / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (extras.includes('cap')) {
      ctx.fillRect(headX - r - add / 2, headY - r * 1.05 - add / 2, r * 2 + add, r * 0.6 + add);
      ctx.fillRect(headX, headY - r * 0.55 - add / 2, r * 1.6 + add / 2, r * 0.22 + add);
    }
    if (extras.includes('mask')) {
      ctx.beginPath();
      ctx.moveTo(headX - r * 0.6, headY - r * 0.6);
      ctx.lineTo(headX - r * 0.3, headY - r * 1.9 - add / 2);
      ctx.lineTo(headX + r * 0.1, headY - r * 0.8);
      ctx.fill();
    }
    // 앞팔
    ctx.lineWidth = bulk * 0.42 + add;
    ctx.beginPath();
    limb(ctx, sx, sy, fx, fy, arm * 0.06);
    ctx.stroke();
    if (extras.includes('sword')) {
      ctx.lineWidth = 4 + add;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.sin(p.armF + 0.4) * h * 0.42, fy + Math.cos(p.armF + 0.4) * h * 0.42);
      ctx.stroke();
    }
    if (extras.includes('shield')) {
      const shx = Math.max(fx, sx + bulk * 0.6);
      ctx.fillRect(shx - add / 2, sy - h * 0.12 - add / 2, h * 0.07 + add, h * 0.5 + add);
    }
  };
  strokeAll(outline.startsWith('rgba') ? 4 : 6, outline, 'outline');
  strokeAll(0, body, 'body');

  // 테두리 빛 (등 쪽 가는 선) · 장식
  ctx.lineWidth = 2;
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.arc(headX, headY, r - 1, Math.PI * 0.9, Math.PI * 1.5);
  ctx.stroke();
  if (extras.includes('target')) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc((hipX + neckX) / 2 - bulk * 0.45, (hipY + neckY) / 2, bulk * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (extras.includes('strap')) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(neckX - bulk * 0.3, neckY + bulk * 0.3);
    ctx.lineTo(hipX + bulk * 0.35, hipY);
    ctx.stroke();
  }
  if (extras.includes('wrap')) {
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const yy = hipY + (neckY - hipY) * t;
      const xx = hipX + (neckX - hipX) * t;
      ctx.beginPath();
      ctx.moveTo(xx - bulk * 0.5, yy + 4);
      ctx.lineTo(xx + bulk * 0.5, yy - 4);
      ctx.stroke();
    }
  }
  // 눈 (거꾸로 된 얼굴은 아래쪽) · 선글라스 · 찢어진 턱
  const eyeY = headY + (L.flipFace ? r * 0.35 : -r * 0.15);
  if (extras.includes('glasses')) {
    ctx.fillStyle = '#05070a';
    ctx.fillRect(headX + r * 0.05, eyeY - 3, r * 0.95, 6);
    ctx.fillStyle = 'rgba(200,220,255,.5)';
    ctx.fillRect(headX + r * 0.45, eyeY - 2, 4, 2);
  } else if (L.eye) {
    ctx.fillStyle = L.eye;
    ctx.shadowColor = L.eye;
    ctx.shadowBlur = 8;
    ctx.fillRect(headX + r * 0.45, eyeY - 2.5, 5, 5);
    ctx.shadowBlur = 0;
  }
  if (extras.includes('jaw') && p.open > 0) {
    ctx.fillStyle = '#5a0c0c';
    const jh = r * (1.4 * p.open);
    ctx.fillRect(headX + r * 0.15, headY + r * 0.2, r * 0.8, jh);
  }
}

function spider(ctx: Ctx, e: Enemy, L: Look, p: Pose, body: string, outline: string) {
  const big = e.kind === 'legs';
  const w = e.def.w;
  const h = big ? e.def.h * 0.55 : e.def.h * 0.6;
  const cy = -(big ? e.def.h * 0.72 : h * 0.9) * (1 - p.lie * 0.6);
  const legN = big ? 5 : 4;
  const walk = e.state === 'walk' || e.state === 'flee' ? e.age * 0.4 : 0;
  const draw = (add: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = (big ? 9 : 5) + add;
    ctx.beginPath();
    for (let i = 0; i < legN; i++) {
      for (const side of [-1, 1]) {
        const ph = Math.sin(walk + i * 1.3 + (side > 0 ? 0 : Math.PI)) * 8;
        const fx = side * (w * 0.25 + i * w * 0.07) + ph;
        const kx = fx * 0.6;
        const ky = cy - (big ? 60 : 18);
        ctx.moveTo(0, cy);
        ctx.lineTo(kx, ky);
        ctx.lineTo(fx + (p.armF > 1.4 && side > 0 && i === legN - 1 ? w * 0.3 : 0), 0);
      }
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-w * 0.04, cy, w * 0.2 + add / 2, h * 0.32 + add / 2, p.tilt, 0, Math.PI * 2);
    ctx.ellipse(w * 0.16, cy - 4, w * 0.1 + add / 2, h * 0.22 + add / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  draw(outline.startsWith('rgba') ? 4 : 6, outline);
  draw(0, body);
  ctx.fillStyle = L.eye ?? '#ff4030';
  for (let i = 0; i < 3; i++) ctx.fillRect(w * 0.2 + i * 6, cy - 8 + (i % 2) * 4, 4, 4);
}

function beast(ctx: Ctx, e: Enemy, L: Look, p: Pose, body: string, outline: string) {
  const w = e.def.w;
  const h = e.def.h;
  const sway = e.state === 'walk' ? Math.sin(e.age * 0.2) * 6 : 0;
  const jaw = p.open * 0.5 + (e.weakOpen > 0 ? 0.6 : 0);
  const draw = (add: number, color: string) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(-w * 0.08, -h * 0.5 + sway * 0.3, w * 0.36 + add / 2, h * 0.3 + add / 2, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // 머리 (위·아래 턱)
    ctx.beginPath();
    ctx.moveTo(w * 0.18, -h * 0.72 - add / 2);
    ctx.lineTo(w * 0.5 + add / 2, -h * 0.55 - jaw * h * 0.25);
    ctx.lineTo(w * 0.22, -h * 0.45);
    ctx.closePath();
    ctx.moveTo(w * 0.2, -h * 0.42);
    ctx.lineTo(w * 0.46 + add / 2, -h * 0.36 + jaw * h * 0.2);
    ctx.lineTo(w * 0.16, -h * 0.25 + add / 2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 16 + add;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, -h * 0.5);
    ctx.quadraticCurveTo(-w * 0.62, -h * 0.4 + sway, -w * 0.55, -h * 0.12);
    for (const lx of [-0.28, -0.12, 0.06, 0.2]) {
      ctx.moveTo(w * lx, -h * 0.35);
      ctx.lineTo(w * lx + sway * (lx > 0 ? 1 : -1), 0);
    }
    ctx.stroke();
  };
  draw(outline.startsWith('rgba') ? 4 : 6, outline);
  draw(0, body);
  ctx.fillStyle = L.eye ?? '#ffcf40';
  ctx.fillRect(w * 0.26, -h * 0.66, 6, 5);
}

function snake(ctx: Ctx, e: Enemy, L: Look, p: Pose, body: string, outline: string) {
  const w = e.def.w;
  const h = e.def.h;
  const wave = e.age * 0.15;
  const draw = (add: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = h * 0.22 + add;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.12);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      ctx.lineTo(-w * 0.45 + t * w * 0.75, -h * 0.12 - Math.sin(wave + t * 5) * 10 - t * t * h * 0.5 * (1 + p.lean));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.32, -h * 0.68 * (1 + p.lean * 0.5), h * 0.14 + add / 2, 0, Math.PI * 2);
    ctx.fill();
    // 텔레비전 상자
    ctx.fillRect(-w * 0.5 - add / 2, -h * 0.36 - add / 2, w * 0.24 + add, h * 0.36 + add);
  };
  draw(outline.startsWith('rgba') ? 4 : 6, outline);
  draw(0, body);
  ctx.fillStyle = 'rgba(160,210,230,.35)';
  ctx.fillRect(-w * 0.47, -h * 0.32, w * 0.18, h * 0.24);
  ctx.fillStyle = L.eye ?? '#9fd3e6';
  ctx.fillRect(w * 0.36, -h * 0.72 * (1 + p.lean * 0.5), 5, 5);
}

function hand(ctx: Ctx, e: Enemy, p: Pose, outline: string) {
  const h = e.def.h;
  const reach = p.open ? 1.25 : 1;
  const draw = (add: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = 12 + add;
    ctx.beginPath();
    ctx.moveTo(-10, -h * 0.2);
    ctx.quadraticCurveTo(10, -h * 0.75, 30 * reach, -h * 0.85);
    ctx.stroke();
    ctx.lineWidth = 4 + add;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(30 * reach, -h * 0.85);
      ctx.lineTo(30 * reach + 18 + i * 2, -h * 0.85 - 14 + i * 9);
    }
    ctx.stroke();
  };
  draw(outline.startsWith('rgba') ? 4 : 6, outline);
  draw(0, '#d9d6cc');
}

function furniture(ctx: Ctx, e: Enemy, L: Look, outline: string, body: string) {
  const w = e.def.w;
  const h = e.def.h;
  const wig = Math.sin(e.age * 0.6) * 4;
  const draw = (add: number, color: string) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.fillRect(-w * 0.45 - add / 2, -h * 0.75 - add / 2, w * 0.9 + add, h * 0.18 + add);
    ctx.lineWidth = 5 + add;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [lx, s] of [[-0.38, 1], [-0.15, -1], [0.15, 1], [0.38, -1]] as const) {
      ctx.moveTo(w * lx, -h * 0.6);
      ctx.lineTo(w * lx + wig * s, 0);
    }
    ctx.stroke();
  };
  draw(outline.startsWith('rgba') ? 4 : 6, outline);
  draw(0, body);
  ctx.fillStyle = 'rgba(220,210,190,.25)';
  ctx.fillRect(-w * 0.45, -h * 0.75, w * 0.9, 4);
  ctx.fillStyle = L.eye ?? '#ffcf40';
  ctx.fillRect(w * 0.3, -h * 0.68, 4, 4);
}

/** 그림 모양이 있는 종은 true를 돌려 주고, 없으면 상자 그리기에 맡긴다 */
export function drawFigure(e: Enemy, ctx: Ctx, outline: string): boolean {
  const L = lookFor(e.kind);
  if (!L) return false;
  const p = poseOf(e);
  const body = e.flash > 0 ? '#ffffff' : shadowColor(e.def.color, 0.62);
  const line = rim(e.def.color);
  // 어두운 바닥에서도 보이게 늘 옅은 테두리
  if (!outline) outline = 'rgba(190,200,210,.38)';
  ctx.save();
  ctx.translate(e.x, e.y - e.z);
  ctx.scale(e.dir, 1);
  // 눕기: 발을 축으로 뒤로 넘어간다 (몸 가운데가 제자리에 오게 옮김)
  const upright = L.shape === 'human' || L.shape === 'hand';
  if (e.mem.cling && L.shape === 'spider') ctx.scale(1, -1);
  if (p.lie > 0 && !upright) {
    // 짐승·거미·가구는 눕는 대신 납작해지며 뒤집힌다
    ctx.translate(0, -e.def.h * 0.25 * p.lie);
    ctx.scale(1, 1 - 1.5 * p.lie);
    ctx.translate(0, e.def.h * 0.25 * p.lie);
  } else if (p.lie > 0) {
    ctx.translate(e.def.h * 0.45 * p.lie, 0);
    ctx.rotate(-Math.PI / 2 * p.lie);
    ctx.translate(0, e.def.h * 0.05 * p.lie);
  } else if (p.tilt) ctx.rotate(p.tilt);
  if (L.shape === 'human') human(ctx, e, L, p, body, line, outline);
  else if (L.shape === 'spider') spider(ctx, e, L, p, body, outline);
  else if (L.shape === 'beast') beast(ctx, e, L, p, body, outline);
  else if (L.shape === 'snake') snake(ctx, e, L, p, body, outline);
  else if (L.shape === 'hand') hand(ctx, e, p, outline);
  else if (L.shape === 'furniture') furniture(ctx, e, L, outline, body);
  ctx.restore();
  return true;
}

/** 공격 판정이 켜진 장: 상자 대신 짧은 휘두름 자국 */
export function drawSwing(e: Enemy, ctx: Ctx, alpha: number) {
  const f = e.frameNow();
  if (!f?.hit.length) return;
  ctx.save();
  ctx.globalAlpha = 0.55 * alpha;
  ctx.strokeStyle = '#fff3e0';
  ctx.lineCap = 'round';
  for (const b of f.hit) {
    const wb = toWorld(b, e.x, e.y, e.z, e.dir);
    const cx = (wb.x0 + wb.x1) / 2;
    const cz = (wb.z0 + wb.z1) / 2;
    const r = Math.max(18, (wb.x1 - wb.x0) / 2);
    ctx.lineWidth = Math.max(4, Math.min(14, (wb.z1 - wb.z0) / 4));
    ctx.beginPath();
    const a0 = e.dir > 0 ? -Math.PI * 0.45 : Math.PI * 0.55;
    ctx.arc(cx - e.dir * r * 0.4, e.y - cz, r, a0, a0 + Math.PI * 0.9 * e.dir, e.dir < 0);
    ctx.stroke();
  }
  ctx.restore();
}
