// 공격 동작 공장. 예고(tele) → 유효(active) → 마무리(recover) 세 단계를 기본으로 만든다.
// 예고 장은 적 몸이 뒤로 젖혀지고(빨간 테두리·바닥 위험 표시), 유효 장에서만 공격 상자가 있다.
import { B, bake, humanoid, lerpBox, type Phase } from './frames';
import type { Armor, Debuff, HitSpec, LocalBox, Move, React } from './types';

export const S = (dmg: number, react: React, push = 6, extra: Partial<HitSpec> = {}): HitSpec => ({ dmg, react, push, stop: react === 'none' ? 2 : react === 'flinch' ? 3 : 5, strength: react === 'none' || react === 'flinch' ? 1 : react === 'stagger' ? 2 : 3, ...extra });

export interface StrikeOpt {
  tele: number;
  active: number;
  recover: number;
  /** 공격 상자 앞쪽 범위 (몸 기준) 시작·끝 */
  reach: [number, number];
  z: [number, number];
  dy?: number;
  spec: HitSpec;
  /** 유효 구간 전진 (틱당) */
  lunge?: number;
  /** 예고 동안 뒤로 물러남 (틱당, 음수로 넣지 않는다) */
  back?: number;
  /** 유효 구간 슈퍼아머 (정예·중형은 1) */
  armor?: Armor;
  teleArmor?: Armor;
  /** 몸 (기본 사람 모양) */
  body?: LocalBox[];
  /** 공격 상자가 몸에서 뻗어 나가는가 (팔·혀) */
  extend?: boolean;
  /** 낮은 공격 (점프로 피함): 표시용 */
  low?: boolean;
  fire?: string;
  part?: LocalBox['part'];
}

export function strike(id: string, label: string, w: number, h: number, o: StrikeOpt): Move {
  const body = o.body ?? humanoid(w, h);
  const lean = humanoid(w, h, 16, -w * 0.12);
  const reachBody = humanoid(w, h, 16, w * 0.18);
  const dy = o.dy ?? 20;
  const hitFull = B(o.reach[0], o.reach[1], o.z[0], o.z[1], dy, o.part ?? 'arm');
  const hitStart = B(o.reach[0], o.reach[0] + (o.reach[1] - o.reach[0]) * 0.35, o.z[0], o.z[1], dy, o.part ?? 'arm');
  // 팔·무기 자체도 피격 상자 (뻗은 팔을 때리면 맞는다)
  const armHurt = (t: number) => [...reachBody, lerpBox(B(w * 0.3, w * 0.5, o.z[0], o.z[1], 12, 'arm'), B(w * 0.3, o.reach[1] * 0.8, o.z[0], o.z[1], 12, 'arm'), t)];
  const phases: Phase[] = [
    { n: o.tele, hurt: lean, tele: true, armor: o.teleArmor ?? 0, vx: o.back ? -o.back : 0 },
    { n: o.active, hurt: armHurt, hit: o.extend === false ? [hitFull] : (t: number) => [lerpBox(hitStart, hitFull, Math.min(1, t * 1.6))], armor: o.armor ?? 0, vx: o.lunge ?? 0, fire: o.fire },
    { n: o.recover, hurt: reachBody },
  ];
  if (o.fire) phases[1].hit = [];
  const danger = o.fire ? undefined : [{ fx0: o.reach[0], fx1: o.reach[1] + (o.lunge ?? 0) * o.active, dy }];
  return bake(id, label, body, phases, [{ ...o.spec, low: o.low ?? o.spec.low }], { danger });
}

/** 잡기: 상자가 아니라 발 거리로 성립. 예고 뒤 짧은 유효 장에 손 상자를 둔다 (닿으면 잡기 시작) */
export function grab(id: string, label: string, w: number, h: number, o: { tele: number; active: number; recover: number; reach: number; ticks: number; dmgPerTick: number; lunge?: number; armor?: Armor; debuff?: Debuff; body?: LocalBox[] }): Move {
  const body = o.body ?? humanoid(w, h);
  const spec: HitSpec = { dmg: 0, react: 'none', push: 0, unblockable: true, grab: { ticks: o.ticks, dmgPerTick: o.dmgPerTick }, debuff: o.debuff, stop: 4 };
  return bake(
    id,
    label,
    body,
    [
      { n: o.tele, tele: true, hurt: humanoid(w, h, 16, -w * 0.1) },
      { n: o.active, hit: [B(w * 0.2, o.reach, h * 0.3, h * 0.8, 22, 'arm')], vx: o.lunge ?? 0, armor: o.armor ?? 0 },
      { n: o.recover },
    ],
    [spec],
    { danger: [{ fx0: w * 0.2, fx1: o.reach + (o.lunge ?? 0) * o.active, dy: 22 }] },
  );
}

/** 몸통 돌진: 예고 뒤 빠르게 직선 이동, 몸 앞에 공격 상자 */
export function charge(id: string, label: string, w: number, h: number, o: { tele: number; dash: number; speed: number; recover: number; spec: HitSpec; armor?: Armor; body?: LocalBox[] }): Move {
  const body = o.body ?? humanoid(w, h);
  return bake(
    id,
    label,
    body,
    [
      { n: o.tele, tele: true, hurt: humanoid(w, h, 16, -w * 0.15, 0.15), vx: -0.6 },
      { n: o.dash, hit: [B(0, w * 0.7, h * 0.1, h * 0.85, 22, 'torso')], vx: o.speed, armor: o.armor ?? 1, hurt: humanoid(w, h, 16, w * 0.2) },
      { n: o.recover, vx: (t) => o.speed * 0.3 * (1 - t) },
    ],
    [o.spec],
    { danger: [{ fx0: 0, fx1: o.speed * o.dash + w * 0.7, dy: 22 }] },
  );
}

/** 발사: 예고 뒤 n발 (fire 이름은 발사체 표의 키) */
export function shoot(id: string, label: string, w: number, h: number, o: { tele: number; shots: number; gap: number; recover: number; fire: string; armor?: Armor; body?: LocalBox[] }): Move {
  const body = o.body ?? humanoid(w, h);
  const phases: Phase[] = [{ n: o.tele, tele: true }];
  for (let i = 0; i < o.shots; i++) phases.push({ n: o.gap, fire: o.fire, armor: o.armor ?? 0 });
  phases.push({ n: o.recover });
  return bake(id, label, body, phases, [S(0, 'none')]);
}

/** 대기·피격·다운 몸 (판정 그리기용 공용 동작) */
export function idleMove(w: number, h: number, body?: LocalBox[]): Move {
  return bake('idle', '대기', body ?? humanoid(w, h), [{ n: 1 }], []);
}
