// 장(frame)별 판정 상자 만들기. 동작은 단계(phase) 목록으로 적고, 굽기(bake)하면 장마다 hit[]·hurt[]가 따로 생긴다 (부록 E.2.1).
// 상자를 단계 안에서 보간할 수 있어 팔이 뻗어 나가는 동안 공격 상자가 장마다 자란다.
import type { Armor, FrameBoxes, HitSpec, LocalBox, Move } from './types';

export const B = (fx0: number, fx1: number, z0: number, z1: number, dy = 18, part?: LocalBox['part']): LocalBox => ({ fx0, fx1, z0, z1, dy, part });

/** 사람 모양 몸 (다리·몸통·머리) */
export function humanoid(w: number, h: number, dy = 16, lean = 0, crouch = 0): LocalBox[] {
  const hh = h * (1 - crouch * 0.35);
  return [
    B(-w * 0.32, w * 0.32, 0, hh * 0.46, dy, 'legs'),
    B(-w * 0.5 + lean, w * 0.5 + lean, hh * 0.46, hh * 0.8, dy, 'torso'),
    B(-w * 0.28 + lean * 1.4, w * 0.28 + lean * 1.4, hh * 0.8, hh, dy, 'head'),
  ];
}
/** 낮고 긴 몸 (기는 것·얼룩) */
export function lowBody(w: number, h: number, dy = 20): LocalBox[] {
  return [B(-w * 0.5, w * 0.15, 0, h * 0.8, dy, 'torso'), B(w * 0.15, w * 0.5, 0, h, dy, 'head')];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpBox(a: LocalBox, b: LocalBox, t: number): LocalBox {
  return { fx0: lerp(a.fx0, b.fx0, t), fx1: lerp(a.fx1, b.fx1, t), z0: lerp(a.z0, b.z0, t), z1: lerp(a.z1, b.z1, t), dy: lerp(a.dy, b.dy, t), part: a.part };
}

type BoxesAt = LocalBox[] | ((t: number) => LocalBox[]);
export interface Phase {
  n: number;
  hurt?: BoxesAt;
  hit?: BoxesAt;
  spec?: number;
  armor?: Armor;
  vx?: number | ((t: number) => number);
  vz?: number;
  tele?: boolean;
  fire?: string;
  inv?: boolean;
  ev?: string;
}

const at = (b: BoxesAt | undefined, t: number): LocalBox[] => (b ? (typeof b === 'function' ? b(t) : b) : []);

/** 단계 → 장 */
export function bake(id: string, label: string, body: LocalBox[], phases: Phase[], specs: HitSpec[], extra: Partial<Move> = {}): Move {
  const frames: FrameBoxes[] = [];
  for (const p of phases) {
    for (let i = 0; i < p.n; i++) {
      const t = p.n <= 1 ? 1 : i / (p.n - 1);
      const f: FrameBoxes = { hit: at(p.hit, t), hurt: p.hurt ? at(p.hurt, t) : body, armor: p.armor ?? 0 };
      if (f.hit.length) f.spec = p.spec ?? 0;
      const vx = typeof p.vx === 'function' ? p.vx(t) : p.vx;
      if (vx) f.vx = vx;
      if (p.vz && i === 0) f.vz = p.vz;
      if (p.tele) f.tele = true;
      if (p.fire && i === 0) f.fire = p.fire;
      if (p.inv) f.inv = true;
      if (p.ev && i === 0) f.ev = p.ev;
      frames.push(f);
    }
  }
  return { id, label, frames, specs, ...extra };
}

/** 굽힌 동작 → JSON (frames[n].hit[], frames[n].hurt[]) */
export function moveJson(m: Move) {
  return {
    id: m.id,
    label: m.label,
    frames: m.frames.map((f, i) => ({ n: i, hit: f.hit, hurt: f.hurt, armor: f.armor, ...(f.tele ? { tele: true } : {}), ...(f.spec !== undefined ? { spec: f.spec } : {}) })),
    specs: m.specs,
  };
}

/** 장 구간 요약 (도감·검수 표용): 예고·유효·마무리 장 수 */
export function moveTiming(m: Move): { tele: number; active: number; recover: number; total: number } {
  let tele = 0,
    first = -1,
    last = -1;
  m.frames.forEach((f, i) => {
    if (f.tele) tele++;
    if (f.hit.length || f.fire) {
      if (first < 0) first = i;
      last = i;
    }
  });
  const total = m.frames.length;
  return { tele, active: first < 0 ? 0 : last - first + 1, recover: first < 0 ? 0 : total - last - 1, total };
}
