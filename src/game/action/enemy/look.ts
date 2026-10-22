// 그림이 오기 전 임시 모양. 종마다 다른 실루엣을 도트 해상도(1도트 = PIXEL 논리 px)로 그려 키운다.
// 옷 덩어리(상의·하의·피부·소품) 색 + 3단 음영(기본·그늘 띠·림 라이트) + 검은 테두리 1도트.
// 상태에 따라 자세가 바뀐다 (걷기 다리, 예비 동작 젖힘, 공격 때 팔 뻗기, 피격 꺾임, 공중 회전, 다운 눕기).
// 좌표: 발 = (0, 0), 위가 −, 바라보는 쪽이 +x.
import { PIXEL } from '../engine/contract';
import type { Enemy } from './enemy';
import { toWorld } from './geom';

type Shape = 'human' | 'spider' | 'beast' | 'snake' | 'hand' | 'furniture';
type Extra = 'cap' | 'backpack' | 'coat' | 'skirt' | 'apron' | 'hair' | 'target' | 'shield' | 'sword' | 'mask' | 'glasses' | 'jaw' | 'strap' | 'wrap' | 'melt' | 'tie';
type Part = 'skin' | 'top' | 'bottom' | 'acc' | 'hair' | 'detail';

interface Look {
  shape: Shape;
  /** 몸통 두께 (키 대비) */
  bulk?: number;
  /** 팔 길이 (키 대비, 보통 0.38) */
  arm?: number;
  /** 머리 반지름 (키 대비) */
  head?: number;
  /** 상체가 앞으로 굽은 정도 (키 대비) */
  hunch?: number;
  /** 다리 길이 (키 대비, 보통 0.46) */
  leg?: number;
  eye?: string;
  /** 거꾸로 붙은 얼굴: 눈이 머리 아래쪽 */
  flipFace?: boolean;
  extras?: Extra[];
  /** 팔 추가 (그림자) */
  arms?: number;
  /** 색: 상의·하의·피부·소품·머리카락 */
  top?: string;
  bottom?: string;
  skin?: string;
  acc?: string;
  hair?: string;
}

const PALE = '#9c968a';
const GREY = '#6f6d68';
const LOOKS: Record<string, Look> = {
  lurker: { shape: 'human', bulk: 0.16, head: 0.075, hunch: 0.05, eye: '#f2efe6', top: '#5d6670', bottom: '#2c3138', skin: PALE, hair: '#1c1c1e', extras: ['tie'] },
  hollow: { shape: 'human', bulk: 0.15, arm: 0.5, head: 0.07, hunch: 0.08, eye: '', top: '#6b5f4f', bottom: '#3b342c', skin: GREY },
  shooter: { shape: 'human', bulk: 0.13, arm: 0.48, head: 0.07, hunch: 0.03, eye: '#ffd760', top: '#c9c3b4', bottom: '#3d4048', skin: PALE, acc: '#5a4c3a', hair: '#24201c', extras: ['strap'] },
  thief: { shape: 'human', bulk: 0.16, head: 0.072, hunch: 0.07, eye: '#e8e2d0', top: '#55603f', bottom: '#3a3a40', skin: '#a08670', acc: '#7a5a3a', extras: ['cap', 'backpack'] },
  charger: { shape: 'human', bulk: 0.27, head: 0.07, hunch: 0.16, leg: 0.4, eye: '#ff6a3a', top: '#7a4a32', bottom: '#3a2c26', skin: '#8a6a5a', acc: '#d8d0c0', extras: ['target'] },
  resident: { shape: 'human', bulk: 0.17, head: 0.08, hunch: 0.02, eye: '#f2efe6', top: '#d2cbbb', bottom: '#4a5a6a', skin: '#a8927e', hair: '#2a2622', extras: ['jaw'] },
  hum: { shape: 'human', bulk: 0.14, head: 0.07, hunch: 0.06, eye: '#9fd3e6', top: '#4a5e6a', bottom: '#2c3a42', skin: '#7a9aa8' },
  noise: { shape: 'human', bulk: 0.14, head: 0.075, hunch: 0.06, eye: '#c8e070', arms: 1, top: '#55603a', bottom: '#33381f', skin: '#8a9a6a' },
  mummy: { shape: 'human', bulk: 0.12, head: 0.07, hunch: 0.12, eye: '#d8c890', top: '#b8a888', bottom: '#8a7a5a', skin: '#a89878', extras: ['wrap'] },
  guard: { shape: 'human', bulk: 0.2, head: 0.07, eye: '#ffe08a', top: '#44506a', bottom: '#2c3446', skin: '#a8927e', acc: '#c8a850', extras: ['cap', 'tie'] },
  proctor: { shape: 'human', bulk: 0.17, head: 0.07, hunch: 0.02, eye: '#ffe08a', top: '#5a4a34', bottom: '#33291e', skin: '#a8927e', acc: '#c8a850', hair: '#3a3a3a', extras: ['coat', 'strap', 'cap'] },
  elder_f: { shape: 'human', bulk: 0.17, head: 0.085, hunch: 0.16, leg: 0.38, eye: '#ff5040', flipFace: true, top: '#7a5a6a', bottom: '#5a6a4a', skin: '#b09880', acc: '#d8d0b8', hair: '#c8c4bc', extras: ['apron', 'hair'] },
  elder_m: { shape: 'human', bulk: 0.14, arm: 0.44, head: 0.07, hunch: 0.05, eye: '#ff5040', flipFace: true, top: '#6a6450', bottom: '#4a4436', skin: '#b09880', hair: '#d0ccc4' },
  family_f: { shape: 'human', bulk: 0.16, head: 0.08, hunch: 0.04, eye: '#e070ff', top: '#c88a9a', bottom: '#6a4a7a', skin: '#b8a08a', hair: '#7a3a9a', extras: ['hair', 'skirt', 'jaw'] },
  family_m: { shape: 'human', bulk: 0.25, arm: 0.42, head: 0.068, hunch: 0.04, eye: '#f2efe6', top: '#5a6a7a', bottom: '#33302c', skin: '#a8927e', hair: '#1c1c1e' },
  shadow: { shape: 'human', bulk: 0.21, arm: 0.5, head: 0.08, hunch: 0.06, eye: '#ffffff', arms: 2, top: '#1a1820', bottom: '#100e14', skin: '#24222a', extras: ['melt'] },
  fb_smg: { shape: 'human', bulk: 0.18, head: 0.07, eye: '', top: '#1e2026', bottom: '#16181c', skin: '#a8927e', acc: '#4a4e56', hair: '#101012', extras: ['glasses', 'tie'] },
  fb_shield: { shape: 'human', bulk: 0.2, head: 0.07, hunch: 0.04, eye: '', top: '#1e2026', bottom: '#16181c', skin: '#a8927e', acc: '#6a7a8a', hair: '#101012', extras: ['glasses', 'shield'] },
  fb_chief: { shape: 'human', bulk: 0.19, head: 0.075, eye: '', top: '#2a2a30', bottom: '#1a1a1e', skin: '#a8927e', acc: '#8a2a2a', hair: '#6a6a6a', extras: ['glasses', 'coat', 'tie'] },
  fb_sword: { shape: 'human', bulk: 0.16, head: 0.07, hunch: 0.03, eye: '', top: '#1e2026', bottom: '#16181c', skin: '#a8927e', acc: '#c8ccd0', hair: '#101012', extras: ['glasses', 'sword'] },
  dd_member: { shape: 'human', bulk: 0.16, head: 0.075, eye: '#ffffff', top: '#2e2a36', bottom: '#1e1c24', skin: '#e8e2d8', extras: ['mask', 'tie'] },
  doorframe: { shape: 'human', bulk: 0.36, head: 0.06, hunch: 0.28, leg: 0.36, eye: '#ff5040', top: '#6a5a4a', bottom: '#3a3026', skin: '#8a7a6a', acc: '#5a4030', extras: ['shield'] },
  crawler: { shape: 'spider', eye: '#ff4030', top: '#4a3a30', skin: '#8a7464' },
  legs: { shape: 'spider', eye: '#ff4030', top: '#3a3028', skin: '#9a8474' },
  predator: { shape: 'beast', eye: '#ffcf40', top: '#4a3a34', skin: '#8a5a4a', acc: '#e8dcc8' },
  tv402: { shape: 'snake', eye: '#9fd3e6', top: '#5a6a5a', skin: '#a8927e', acc: '#3a3a3e' },
  toucher: { shape: 'hand', skin: '#d9d6cc' },
  doorhand: { shape: 'hand', skin: '#d9d6cc' },
  dusty: { shape: 'furniture', eye: '#ffcf40', top: '#7a5a3a', acc: '#a89a80' },
};

export function lookFor(kind: string): Look | null {
  return LOOKS[kind] ?? null;
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
  const p: Pose = { tilt: 0, lean: 0, step: 0, armF: 0.2, armB: -0.15, reach: 1, crouch: 0, lie: 0, open: 0 };
  switch (e.state) {
    case 'walk':
    case 'flee': {
      const s = Math.sin(e.age * (e.state === 'flee' ? 0.5 : 0.32));
      p.step = s;
      p.armF = 0.15 - s * 0.5;
      p.armB = -0.15 + s * 0.5;
      p.lean = e.state === 'flee' ? 0.25 : 0.04;
      p.crouch = Math.abs(s) * -3;
      break;
    }
    case 'attack': {
      if (f?.tele) {
        // 예비: 뒤로 젖히고 팔을 뒤로 들어 버틴다
        p.lean = -0.16;
        p.armF = 2.5;
        p.armB = -0.6;
        p.crouch = 8;
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
      p.crouch = 10;
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
      p.crouch = 18 * p.lie;
      break;
    default:
      p.crouch = Math.sin(e.age * 0.09) * 2;
  }
  return p;
}

type Ctx = CanvasRenderingContext2D;
type Paint = (part: Part) => string;

/** 맞은 순간용 밝은 색 */
function lighten(c: string, k: number): string {
  const m = c.startsWith('#') ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : (c.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  return `rgb(${m.map((v) => Math.round(v + (255 - v) * k)).join(',')})`;
}
/** 뒤쪽 팔다리용 어두운 색 */
function dim(c: string, k = 0.7): string {
  if (c === '#ffffff') return c;
  const m = c.startsWith('#') ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : (c.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  return `rgb(${m.map((v) => Math.round(v * k)).join(',')})`;
}
/** 앞쪽 팔다리: 어두운 테두리를 먼저 그려 몸통과 갈라 보이게 */
function segEdge(ctx: Ctx, w: number, x0: number, y0: number, x1: number, y1: number, bend: number, color: string) {
  if (color !== '#ffffff') seg(ctx, w + PIXEL * 1.6, x0, y0, x1, y1, bend, dim(color, 0.45));
  seg(ctx, w, x0, y0, x1, y1, bend, color);
}
function seg(ctx: Ctx, w: number, x0: number, y0: number, x1: number, y1: number, bend: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo((x0 + x1) / 2 + bend, (y0 + y1) / 2);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function dot(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
  ctx.fill();
}

/** 사람 모양: 뒤팔 → 뒷다리 → 몸통·옷 → 앞다리 → 머리 → 앞팔 순 */
function human(ctx: Ctx, e: Enemy, L: Look, p: Pose, paint: Paint) {
  const h = e.def.h;
  const leg = h * (L.leg ?? 0.46) - p.crouch;
  const bulk = h * (L.bulk ?? 0.15);
  const r = h * (L.head ?? 0.075) * 1.2;
  const arm = h * (L.arm ?? 0.38);
  const hunch = h * (L.hunch ?? 0);
  const torso = h - leg - p.crouch - r * 2;
  const stride = h * 0.11;
  const hipY = -leg;
  const lean = p.lean + (L.hunch ?? 0) * 0.8;
  const neckX = Math.sin(lean) * torso + hunch * 0.4;
  const neckY = hipY - Math.cos(lean) * torso;
  const sx = neckX - Math.sin(lean) * bulk * 0.3;
  const sy = neckY + bulk * 0.35;
  const headX = neckX + Math.sin(lean) * r * 1.1 + r * 0.2;
  const headY = neckY - Math.cos(lean) * r * 0.95;
  const armEnd = (a: number, len: number) => [sx + Math.sin(a) * len, sy + Math.cos(a) * len] as const;
  const [fx, fy] = armEnd(p.armF, arm * p.reach);
  const [bx, by] = armEnd(p.armB, arm);
  const x = L.extras ?? [];
  const limbW = bulk * 0.5;
  const legW = bulk * 0.62;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const legTo = (s: number, back: boolean) => {
    const footX = -s * stride;
    (back ? seg : segEdge)(ctx, legW, 0, hipY, footX, -legW * 0.3, h * 0.04, back ? dim(paint('bottom')) : paint('bottom'));
    // 신발
    seg(ctx, legW * 0.7, footX - legW * 0.1, -legW * 0.3, footX + legW * 0.9, -legW * 0.3, 0, paint('detail'));
  };
  // 뒤팔
  seg(ctx, limbW, sx, sy, bx, by, -arm * 0.08, dim(paint('top')));
  dot(ctx, bx, by, limbW * 0.55, dim(paint('skin')));
  for (let i = 0; i < (L.arms ?? 0); i++) {
    const a = p.armB + 1 + i;
    seg(ctx, limbW * 0.8, sx, sy + 10 + i * 16, sx + Math.sin(a) * arm, sy + 10 + i * 16 + Math.cos(a) * arm, arm * 0.1, paint('skin'));
  }
  legTo(p.step, true);
  if (x.includes('backpack')) {
    ctx.fillStyle = paint('acc');
    const bw = h * 0.15;
    ctx.beginPath();
    ctx.roundRect(neckX - bulk * 0.45 - bw, neckY + bulk * 0.15, bw, torso * 0.62, bw * 0.25);
    ctx.fill();
  }
  // 몸통: 어깨가 넓고 허리가 좁은 덩어리
  ctx.fillStyle = paint('top');
  ctx.beginPath();
  const nx = Math.cos(lean), ny = Math.sin(lean);
  ctx.moveTo(neckX - nx * bulk * 0.55, neckY - ny * bulk * 0.55 + bulk * 0.15);
  ctx.lineTo(neckX + nx * bulk * 0.55, neckY + ny * bulk * 0.55 + bulk * 0.15);
  ctx.lineTo(nx * bulk * 0.42, hipY + ny * bulk * 0.42);
  ctx.lineTo(-nx * bulk * 0.42, hipY - ny * bulk * 0.42);
  ctx.closePath();
  ctx.fill();
  dot(ctx, neckX, neckY + bulk * 0.2, bulk * 0.52, paint('top'));
  // 허리띠 + 하의 윗부분
  seg(ctx, legW * 1.15, -bulk * 0.05, hipY - 2, bulk * 0.05, hipY + legW * 0.4, 0, paint('bottom'));
  if (x.includes('coat') || x.includes('skirt') || x.includes('apron') || x.includes('melt')) {
    const low = x.includes('melt') ? 0 : x.includes('coat') ? -leg * 0.3 : -leg * 0.5;
    const flare = x.includes('melt') ? bulk * 1.5 : bulk * 0.8;
    ctx.fillStyle = x.includes('apron') ? paint('acc') : x.includes('coat') ? paint('top') : paint('bottom');
    ctx.beginPath();
    ctx.moveTo(-bulk * 0.48, hipY - bulk * 0.3);
    ctx.lineTo(bulk * 0.48, hipY - bulk * 0.3);
    ctx.lineTo(flare, low);
    ctx.lineTo(-flare, low);
    ctx.closePath();
    ctx.fill();
  }
  legTo(-p.step, false);
  if (x.includes('tie')) seg(ctx, bulk * 0.12, neckX + bulk * 0.3, neckY + bulk * 0.25, (neckX + 0) / 2 + bulk * 0.3, (neckY + hipY) / 2, 0, paint('acc'));
  if (x.includes('target')) {
    const tx = neckX / 2 - bulk * 0.4, ty = (hipY + neckY) / 2;
    dot(ctx, tx, ty, bulk * 0.36, paint('acc'));
    dot(ctx, tx, ty, bulk * 0.22, '#a83a2a');
    dot(ctx, tx, ty, bulk * 0.09, paint('acc'));
  }
  if (x.includes('strap')) seg(ctx, Math.max(3, bulk * 0.1), neckX - bulk * 0.35, neckY + bulk * 0.3, bulk * 0.4, hipY, 0, paint('acc'));
  if (x.includes('wrap'))
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      const yy = hipY + (neckY - hipY) * t;
      const xx = neckX * t;
      seg(ctx, 3, xx - bulk * 0.45, yy + 4, xx + bulk * 0.45, yy - 4, 0, '#6a5a40');
    }
  // 머리
  dot(ctx, neckX + r * 0.1, neckY + 2, r * 0.45, paint('skin'));
  dot(ctx, headX, headY, r, paint('skin'));
  if (x.includes('hair')) {
    dot(ctx, headX - r * 0.35, headY - r * 0.3, r * 1.1, paint('hair'));
    dot(ctx, headX + r * 0.1, headY - r * 0.55, r * 0.75, paint('hair'));
  } else if (L.hair) {
    // 짧은 머리: 정수리·뒤통수
    ctx.fillStyle = paint('hair');
    ctx.beginPath();
    ctx.arc(headX, headY, r * 1.04, Math.PI * 0.85, Math.PI * 1.9);
    ctx.fill();
  }
  if (x.includes('cap')) {
    ctx.fillStyle = paint('top');
    ctx.fillRect(headX - r * 1.02, headY - r * 1.15, r * 2.04, r * 0.75);
    ctx.fillStyle = paint('detail');
    ctx.fillRect(headX + r * 0.2, headY - r * 0.5, r * 1.3, r * 0.22);
    ctx.fillStyle = paint('acc');
    ctx.fillRect(headX - r * 0.1, headY - r * 0.95, r * 0.4, r * 0.3);
  }
  if (x.includes('mask')) {
    ctx.fillStyle = paint('skin');
    ctx.beginPath();
    ctx.moveTo(headX - r * 0.6, headY - r * 0.6);
    ctx.lineTo(headX - r * 0.3, headY - r * 1.9);
    ctx.lineTo(headX + r * 0.15, headY - r * 0.8);
    ctx.fill();
    dot(ctx, headX + r * 0.9, headY + r * 0.2, r * 0.35, paint('skin'));
  }
  if (x.includes('glasses')) {
    ctx.fillStyle = '#05070a';
    ctx.fillRect(headX + r * 0.05, headY - r * 0.3, r * 0.98, r * 0.32);
  }
  if (x.includes('jaw') && p.open > 0) {
    ctx.fillStyle = '#4a0808';
    ctx.fillRect(headX + r * 0.15, headY + r * 0.15, r * 0.8, r * 1.5 * p.open);
  }
  // 앞팔 + 손
  segEdge(ctx, limbW, sx, sy, fx, fy, arm * 0.06, paint('top'));
  dot(ctx, fx, fy, limbW * 0.62, paint('skin'));
  if (x.includes('sword')) seg(ctx, Math.max(3, h * 0.016), fx, fy, fx + Math.sin(p.armF + 0.4) * h * 0.42, fy + Math.cos(p.armF + 0.4) * h * 0.42, 0, paint('acc'));
  if (x.includes('shield')) {
    const shx = Math.max(fx, sx + bulk * 0.6);
    ctx.fillStyle = paint('acc');
    ctx.beginPath();
    ctx.roundRect(shx - h * 0.02, sy - h * 0.14, h * 0.07, h * 0.52, 4);
    ctx.fill();
  }
}

function spider(ctx: Ctx, e: Enemy, L: Look, p: Pose, paint: Paint) {
  const big = e.kind === 'legs';
  const w = e.def.w;
  const h = big ? e.def.h * 0.55 : e.def.h * 0.6;
  const cy = -(big ? e.def.h * 0.72 : h * 0.9);
  const legN = big ? 5 : 4;
  const walk = e.state === 'walk' || e.state === 'flee' ? e.age * 0.4 : 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < legN; i++) {
      const ph = Math.sin(walk + i * 1.3 + (side > 0 ? 0 : Math.PI)) * 8;
      const fx = side * (w * 0.25 + i * w * 0.07) + ph + (p.armF > 1.4 && side > 0 && i === legN - 1 ? w * 0.3 : 0);
      const kx = fx * 0.6;
      const ky = cy - (big ? e.def.h * 0.3 : h * 0.35);
      ctx.strokeStyle = side < 0 ? paint('detail') : paint('skin');
      ctx.lineWidth = big ? e.def.h * 0.045 : Math.max(5, h * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, 0);
      ctx.stroke();
    }
    if (side < 0) {
      ctx.fillStyle = paint('top');
      ctx.beginPath();
      ctx.ellipse(-w * 0.06, cy, w * 0.22, h * 0.34, p.tilt, 0, Math.PI * 2);
      ctx.fill();
      // 등뼈 마디
      for (let k = 0; k < 4; k++) dot(ctx, -w * 0.18 + k * w * 0.07, cy - h * 0.22, h * 0.07, paint('skin'));
      dot(ctx, w * 0.16, cy - 4, Math.min(w * 0.11, h * 0.24), paint('skin'));
    }
  }
}

function beast(ctx: Ctx, e: Enemy, L: Look, p: Pose, paint: Paint) {
  const w = e.def.w;
  const h = e.def.h;
  const sway = e.state === 'walk' ? Math.sin(e.age * 0.2) * 6 : 0;
  const jaw = p.open * 0.5 + (e.weakOpen > 0 ? 0.6 : 0);
  ctx.lineCap = 'round';
  // 뒷다리
  for (const lx of [-0.28, 0.06]) seg(ctx, h * 0.1, w * lx, -h * 0.35, w * lx - sway, 0, 6, paint('detail'));
  ctx.fillStyle = paint('top');
  ctx.beginPath();
  ctx.ellipse(-w * 0.08, -h * 0.5 + sway * 0.3, w * 0.36, h * 0.3, -0.08, 0, Math.PI * 2);
  ctx.fill();
  // 등 가시
  ctx.fillStyle = paint('detail');
  for (let i = 0; i < 6; i++) {
    const bx = -w * 0.34 + i * w * 0.09;
    ctx.beginPath();
    ctx.moveTo(bx, -h * 0.74);
    ctx.lineTo(bx + w * 0.03, -h * 0.9);
    ctx.lineTo(bx + w * 0.06, -h * 0.74);
    ctx.fill();
  }
  seg(ctx, h * 0.12, -w * 0.4, -h * 0.5, -w * 0.55, -h * 0.12 + sway, -w * 0.1, paint('top'));
  // 머리 (위·아래 턱) + 이빨
  ctx.fillStyle = paint('skin');
  ctx.beginPath();
  ctx.moveTo(w * 0.16, -h * 0.74);
  ctx.lineTo(w * 0.5, -h * 0.55 - jaw * h * 0.25);
  ctx.lineTo(w * 0.22, -h * 0.45);
  ctx.closePath();
  ctx.moveTo(w * 0.2, -h * 0.42);
  ctx.lineTo(w * 0.46, -h * 0.36 + jaw * h * 0.2);
  ctx.lineTo(w * 0.14, -h * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = paint('acc');
  for (let i = 0; i < 4; i++) {
    const tx = w * (0.26 + i * 0.05);
    ctx.fillRect(tx, -h * 0.5 - jaw * h * 0.1 * i * 0.3, 3, h * 0.05);
  }
  for (const lx of [-0.12, 0.2]) seg(ctx, h * 0.11, w * lx, -h * 0.35, w * lx + sway, 0, 6, paint('top'));
}

function snake(ctx: Ctx, e: Enemy, L: Look, p: Pose, paint: Paint) {
  const w = e.def.w;
  const h = e.def.h;
  const wave = e.age * 0.15;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 텔레비전 상자
  ctx.fillStyle = paint('acc');
  ctx.fillRect(-w * 0.52, -h * 0.4, w * 0.27, h * 0.4);
  ctx.fillStyle = '#7aa8b8';
  ctx.fillRect(-w * 0.49, -h * 0.35, w * 0.2, h * 0.26);
  ctx.strokeStyle = paint('top');
  ctx.lineWidth = h * 0.22;
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, -h * 0.2);
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    ctx.lineTo(-w * 0.38 + t * w * 0.68, -h * 0.12 - Math.sin(wave + t * 5) * 10 - t * t * h * 0.5 * (1 + p.lean));
  }
  ctx.stroke();
  dot(ctx, w * 0.32, -h * 0.68 * (1 + p.lean * 0.5), h * 0.14, paint('skin'));
  ctx.fillStyle = '#1c1a18';
  ctx.beginPath();
  ctx.arc(w * 0.3, -h * 0.68 * (1 + p.lean * 0.5), h * 0.15, Math.PI * 0.9, Math.PI * 1.9);
  ctx.fill();
}

function hand(ctx: Ctx, e: Enemy, p: Pose, paint: Paint) {
  const h = e.def.h;
  const reach = p.open ? 1.25 : 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = paint('skin');
  ctx.lineWidth = h * 0.08;
  ctx.beginPath();
  ctx.moveTo(-10, -h * 0.2);
  ctx.quadraticCurveTo(10, -h * 0.75, 30 * reach, -h * 0.85);
  ctx.stroke();
  ctx.lineWidth = h * 0.028;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(30 * reach, -h * 0.85);
    ctx.lineTo(30 * reach + h * 0.12 + i * 2, -h * 0.85 - h * 0.09 + i * h * 0.055);
  }
  ctx.stroke();
}

function furniture(ctx: Ctx, e: Enemy, L: Look, p: Pose, paint: Paint) {
  const w = e.def.w;
  const h = e.def.h;
  const wig = Math.sin(e.age * 0.6) * 4;
  ctx.lineCap = 'round';
  for (const [lx, s, part] of [[-0.38, 1, 'detail'], [0.15, 1, 'detail'], [-0.15, -1, 'top'], [0.38, -1, 'top']] as const) seg(ctx, Math.max(5, h * 0.1), w * lx, -h * 0.6, w * lx + wig * s, 0, wig, paint(part));
  ctx.fillStyle = paint('top');
  ctx.fillRect(-w * 0.47, -h * 0.78, w * 0.94, h * 0.2);
  ctx.fillStyle = paint('acc');
  ctx.fillRect(-w * 0.47, -h * 0.82, w * 0.94, h * 0.06);
}

function drawShape(ctx: Ctx, e: Enemy, L: Look, p: Pose, paint: Paint) {
  if (L.shape === 'human') human(ctx, e, L, p, paint);
  else if (L.shape === 'spider') spider(ctx, e, L, p, paint);
  else if (L.shape === 'beast') beast(ctx, e, L, p, paint);
  else if (L.shape === 'snake') snake(ctx, e, L, p, paint);
  else if (L.shape === 'hand') hand(ctx, e, p, paint);
  else furniture(ctx, e, L, p, paint);
}

// ─── 도트 그리기 판 ─────────────────────────────────────
const CW = 240;
const CH = 280;
const OX = 120;
const OY = 140;
type Board = { c: HTMLCanvasElement | OffscreenCanvas; x: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D };
let boards: Board[] | null = null;
function board(i: number): Board {
  if (!boards) {
    boards = [];
    for (let k = 0; k < 4; k++) {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(CW, CH) : Object.assign(document.createElement('canvas'), { width: CW, height: CH });
      boards.push({ c, x: c.getContext('2d', { willReadFrequently: k === 0 }) as never });
    }
  }
  const b = boards[i];
  b.x.setTransform(1, 0, 0, 1, 0, 0);
  b.x.globalCompositeOperation = 'source-over';
  b.x.globalAlpha = 1;
  b.x.clearRect(0, 0, CW, CH);
  return b;
}

function mix(hex: string, to: string, k: number): string {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const cache = new WeakMap<Enemy, Board & { key: string }>();

/** 그림 모양이 있는 종은 true를 돌려 주고, 없으면 상자 그리기에 맡긴다 */
// 같은 종이 여럿 나와도 복제처럼 보이지 않게: 한 마리마다 옷 색·머리색·체격·키를 조금씩 (독립 검수: 회색 클론 반복)
const OUTFITS: [string, string, string][] = [
  ['#8a3a34', '#2e2a2c', '#1c1612'], // 붉은 재킷
  ['#3f6a52', '#2a2f2c', '#141414'], // 녹색 점퍼
  ['#5c4f86', '#2a2836', '#3a2a1e'], // 보라 카디건
  ['#a08450', '#3d3426', '#5a4a3a'], // 낙타색 코트
  ['#3c5a8a', '#22283a', '#101012'], // 파란 셔츠
  ['#7a5a3c', '#4a3c2c', '#24201c'], // 갈색 양복
  ['#c8b890', '#3a4458', '#2a2622'], // 베이지 니트
  ['#4a4a52', '#6a5a46', '#c8c4bc'], // 회색 정장, 흰머리
];
function varied(e: Enemy, L: Look): { L: Look; scale: number } {
  if (L.shape !== 'human' || e.boss || e.kind.startsWith('fb_')) return { L, scale: 1 };
  const v = (e.id * 2654435761) >>> 0;
  const o = OUTFITS[v % OUTFITS.length];
  const k = 0.75 + ((v >> 4) % 3) * 0.12;
  return {
    L: {
      ...L,
      top: mix(L.top ?? '#5a5a5a', o[0], Math.min(1, k)),
      bottom: mix(L.bottom ?? '#2a2a2a', o[1], Math.min(1, k)),
      hair: (v >> 7) % 3 ? o[2] : L.hair,
      bulk: (L.bulk ?? 0.16) * (0.86 + ((v >> 9) % 4) * 0.07),
    },
    scale: 0.92 + ((v >> 12) % 4) * 0.04,
  };
}

export function drawFigure(e: Enemy, ctx: Ctx, outline: string): boolean {
  const L0 = lookFor(e.kind);
  if (!L0 || typeof document === 'undefined') return false;
  const { L, scale } = varied(e, L0);
  const p = poseOf(e);
  const base = e.def.color;
  const col: Record<Part, string> = {
    top: L.top ?? mix(base, '#101216', 0.35),
    bottom: L.bottom ?? mix(base, '#101216', 0.6),
    skin: L.skin ?? mix(base, '#c8c0b0', 0.3),
    acc: L.acc ?? mix(base, '#e8e0d0', 0.4),
    hair: L.hair ?? '#1c1a1a',
    detail: '#14161a',
  };
  // 맞은 순간 밝게 (흰 덩어리가 되지 않게 색은 남긴다). 쓰러지는 중·죽음에는 번쩍이지 않는다
  const flash = e.flash > 0 && p.lie === 0 && e.state !== 'dead' && e.state !== 'down';
  const transform = (x: Board['x']) => {
    x.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, OX, OY + (e.mem.cling && L.shape === 'spider' ? -40 : 40));
    x.scale(e.dir * scale, scale);
    const upright = L.shape === 'human' || L.shape === 'hand';
    if (e.mem.cling && L.shape === 'spider') x.scale(1, -1);
    if (p.lie > 0 && !upright) {
      // 짐승·거미·가구는 눕는 대신 뒤집혀 납작해진다
      x.translate(0, -e.def.h * 0.25 * p.lie);
      x.scale(1, 1 - 1.5 * p.lie);
      x.translate(0, e.def.h * 0.25 * p.lie);
    } else if (p.lie > 0) {
      x.translate(e.def.h * 0.45 * p.lie, 0);
      x.rotate((-Math.PI / 2) * p.lie);
      x.translate(0, e.def.h * 0.05 * p.lie);
    } else if (p.tilt) x.rotate(p.tilt);
  };
  // 같은 틱·같은 자세면 지난번 그림을 다시 쓴다 (게임은 30틱, 화면은 60장)
  const key = `${e.age}|${e.state}|${e.st}|${e.mf}|${flash}|${outline}|${e.dir}|${e.weakOpen > 0}|${!!e.mem.cling}`;
  let cached = cache.get(e);
  if (!cached || cached.key !== key) {
    if (!cached) {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(CW, CH) : Object.assign(document.createElement('canvas'), { width: CW, height: CH });
      cached = { key: '', c, x: c.getContext('2d') as never };
      cache.set(e, cached);
    }
    cached.key = key;
    // 1) 모양 틀 (알파를 0/255로 잘라 도트 가장자리를 만든다)
    const M = board(0);
    transform(M.x);
    drawShape(M.x as Ctx, e, L, p, () => '#ffffff');
    const hw = Math.min(OX, Math.ceil(Math.max(e.def.w * 0.75, e.def.h * (p.lie > 0 || L.shape !== 'human' ? 1.05 : 0.7)) / PIXEL) + 10);
    const img = M.x.getImageData(OX - hw, 0, hw * 2, CH);
    const a = img.data;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 110 ? 255 : 0;
    M.x.putImageData(img, OX - hw, 0);
    // 2) 색 (옷 덩어리), 틀 밖은 잘라냄
    const C = board(1);
    transform(C.x);
    drawShape(C.x as Ctx, e, L, p, flash ? (part) => lighten(col[part], 0.55) : (part) => col[part]);
    C.x.setTransform(1, 0, 0, 1, 0, 0);
    C.x.globalCompositeOperation = 'destination-in';
    C.x.drawImage(M.c, 0, 0);
    {
      // 3) 그늘 띠: 빛(위·앞)에서 먼 쪽 3도트
      const front = e.dir;
      const S = board(2);
      S.x.drawImage(M.c, 0, 0);
      S.x.globalCompositeOperation = 'source-in';
      S.x.fillStyle = 'rgba(6,8,14,.42)';
      S.x.fillRect(0, 0, CW, CH);
      S.x.globalCompositeOperation = 'destination-out';
      S.x.drawImage(M.c, 3 * front, -3);
      C.x.globalCompositeOperation = 'source-atop';
      C.x.drawImage(S.c, 0, 0);
      // 4) 림 라이트: 빛 쪽 1도트 가장자리
      const R = board(2);
      R.x.drawImage(M.c, 0, 0);
      R.x.globalCompositeOperation = 'source-in';
      R.x.fillStyle = 'rgba(214,226,240,.55)';
      R.x.fillRect(0, 0, CW, CH);
      R.x.globalCompositeOperation = 'destination-out';
      R.x.drawImage(M.c, -front, 1);
      C.x.drawImage(R.c, 0, 0);
    }
    // 5) 테두리 1도트 (예고·아머 때는 그 색)
    const F = board(3);
    F.x.drawImage(M.c, -1, 0);
    F.x.drawImage(M.c, 1, 0);
    F.x.drawImage(M.c, 0, -1);
    F.x.drawImage(M.c, 0, 1);
    F.x.globalCompositeOperation = 'source-in';
    F.x.fillStyle = outline || '#07080a';
    F.x.fillRect(0, 0, CW, CH);
    F.x.globalCompositeOperation = 'source-over';
    F.x.drawImage(C.c, 0, 0);
    cached.x.clearRect(0, 0, CW, CH);
    cached.x.drawImage(F.c, 0, 0);
  }
  const oy = e.mem.cling && L.shape === 'spider' ? -40 : 40;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cached.c as CanvasImageSource, Math.round(e.x - OX * PIXEL), Math.round(e.y - e.z - (OY + oy) * PIXEL), CW * PIXEL, CH * PIXEL);
  ctx.restore();
  // 눈빛 한 점 (원래 해상도, 은은한 빛)
  if (L.eye && !flash && e.state !== 'dead' && e.state !== 'down' && p.lie === 0) {
    const eye = eyeAt(e, L, p);
    if (eye) {
      ctx.save();
      ctx.fillStyle = L.eye;
      ctx.shadowColor = L.eye;
      ctx.shadowBlur = 10;
      ctx.fillRect(Math.round(e.x + eye[0] * e.dir - PIXEL), Math.round(e.y - e.z + eye[1]), Math.ceil(PIXEL * 2), Math.ceil(PIXEL));
      ctx.restore();
    }
  }
  return true;
}

/** 눈 위치 (발 기준, 바라보는 쪽 +). 기울기는 대충 따라간다 */
function eyeAt(e: Enemy, L: Look, p: Pose): [number, number] | null {
  const h = e.def.h;
  if (L.shape === 'human') {
    const r = h * (L.head ?? 0.075) * 1.2;
    const leg = h * (L.leg ?? 0.46) - p.crouch;
    const torso = h - leg - p.crouch - r * 2;
    const lean = p.lean + (L.hunch ?? 0) * 0.8;
    const hx = Math.sin(lean) * torso + h * (L.hunch ?? 0) * 0.4 + Math.sin(lean) * r * 1.1 + r * 0.2;
    const hy = -leg - Math.cos(lean) * torso - Math.cos(lean) * r * 0.95;
    let x = hx + r * 0.5, y = hy + (L.flipFace ? r * 0.35 : -r * 0.12);
    if (p.tilt) {
      const c = Math.cos(p.tilt), s = Math.sin(p.tilt);
      [x, y] = [x * c - y * s, x * s + y * c];
    }
    return [x, y];
  }
  if (L.shape === 'beast') return [e.def.w * 0.27, -h * 0.64];
  if (L.shape === 'snake') return [h * 0.0 + e.def.w * 0.36, -h * 0.7 * (1 + p.lean * 0.5)];
  if (L.shape === 'spider') {
    const cy = e.kind === 'legs' ? -h * 0.72 : -h * 0.54;
    return [e.def.w * 0.2, e.mem.cling ? -cy : cy - 6];
  }
  if (L.shape === 'furniture') return [e.def.w * 0.3, -h * 0.7];
  return null;
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
