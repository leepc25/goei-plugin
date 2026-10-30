// 요원 능력치를 전투에 연결한다. 출동 중 강화(dmgMul)와 별도다.
// 옛 본부 출동(MissionLaunch)은 지웠다(2026-10-28). launch가 없으면 기본 수치다.
/** 기본 능력치. 걸리는 값은 피해·속도·경직 배율 */
export interface AgentStats {
  hp: number;
  /** 근접 피해 배율 */
  power: number;
  /** 원거리 피해 배율 */
  aim: number;
  /** 받는 피해 감소 (0~0.5) */
  defense: number;
  speed: number;
  /** 경직 저항 0~3 */
  poise: number;
  /** 필살 게이지 충전 배율 */
  charge: number;
}
import type { Hit, RunConfigCore } from './contract';
import type { MoveDef } from './moves';

export interface RunProgression {
  readonly stats: Readonly<AgentStats>;
  readonly relics: readonly string[];
  readonly moves: readonly string[];
  readonly agent: string;
  readonly fromHq: boolean;
}

type ProgressionRun = RunConfigCore & { launch?: { stats?: AgentStats; relics?: string[]; moves?: string[]; agent?: string } };
const NEUTRAL: AgentStats = { hp: 1000, power: 1, aim: 1, defense: 0, speed: 1, poise: 0, charge: 1 };
const positive = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/** 직접 연습/시연은 기존 수치, 본부 출동은 이미 커피·유물·피로를 반영한 stats를 사용한다. */
export function progressionFor(run?: ProgressionRun): RunProgression {
  const s = run?.launch?.stats;
  return {
    agent: run?.agent ?? 'jyaldi',
    fromHq: !!run?.launch,
    stats: {
      hp: positive(s?.hp, run?.hpMax ?? NEUTRAL.hp),
      power: positive(s?.power, NEUTRAL.power),
      aim: positive(s?.aim, NEUTRAL.aim),
      defense: typeof s?.defense === 'number' && Number.isFinite(s.defense) ? Math.max(0, Math.min(.5, s.defense)) : 0,
      speed: positive(s?.speed, NEUTRAL.speed),
      poise: typeof s?.poise === 'number' && Number.isFinite(s.poise) ? Math.max(0, Math.min(3, s.poise)) : 0,
      charge: positive(s?.charge, NEUTRAL.charge),
    },
    relics: [...(run?.launch?.relics ?? [])],
    moves: [...(run?.launch?.moves ?? [])],
  };
}

/** World 생성 때만 호출. 첫 피격 보호는 기존 ward 저장값을 쓰므로 방 이동·복원으로 재충전되지 않는다. */
export function initializeProgression(player: { progression: RunProgression; hp: number; hpMax: number; ward: number }, run: ProgressionRun) {
  player.progression = progressionFor(run);
  player.hp = player.hpMax = player.progression.stats.hp;
  if (player.progression.relics.includes('first_guard')) player.ward++;
}

const BLAST_MOVES = new Set(['blast', 'bigblast', 'groundblast', 'grabblast', 'chain', 'wall', 'super']);
export const isBlastMove = (move: string) => BLAST_MOVES.has(move);

/** 근접/사격 배율과 폭파 유물 범위. 스킬에 별도의 힘 배율을 임의로 붙이지 않는다. */
export function progressionHit(hit: Hit, p: RunProgression, kind: 'melee' | 'ranged' | 'ability'): Hit {
  const damage = hit.dmg * (kind === 'melee' ? p.stats.power : kind === 'ranged' ? p.stats.aim : 1);
  if (kind !== 'ability' || p.agent !== 'jyaldi' || !p.relics.includes('own_jyaldi')) return damage === hit.dmg ? hit : { ...hit, dmg: damage };
  const x = (hit.x0 + hit.x1) / 2, z = (hit.z0 + hit.z1) / 2;
  const halfX = (hit.x1 - hit.x0) * .6, halfZ = (hit.z1 - hit.z0) * .6;
  return { ...hit, dmg: damage, x0: x - halfX, x1: x + halfX, z0: z - halfZ, z1: z + halfZ, dy: (hit.dy ?? 18) * 1.2 };
}

/** 가드·무적·첫 피격 보호가 처리된 뒤 실제 체력 피해에 적용한다. */
export function defendedHit(hit: Hit, p: RunProgression): Hit {
  return p.stats.defense ? { ...hit, dmg: hit.dmg * (1 - p.stats.defense) } : hit;
}

/** F/G는 제작서의 숙련 3/6 변형. 단독 연습/시연은 기존처럼 모든 동작을 시험한다. */
export function canUseMasteryMove(p: RunProgression, key: string): boolean {
  if (!p.fromHq) return true;
  return key === 'chain' ? p.moves.includes('unique_a') : key === 'wall' ? p.moves.includes('unique_b') : true;
}

/** 숙련5: 같은 필살 동작의 폭발 장 다음 장에 한 번 더 판정/이펙트를 낸다. */
export function masteryMove(p: RunProgression, key: string, move: MoveDef): MoveDef {
  if (key !== 'super' || !p.moves.includes('ult2')) return move;
  return { ...move, hits: move.hits?.map(h => ({ ...h, at: [...h.at, 8] })) };
}
/** 한 동작 안의 두 폭발이 엔진의 동일 공격 중복 판정에 합쳐지지 않게 한다. */
export const masteryHitId = (p: RunProgression, key: string, frame: number, id: number) =>
  id + (key === 'super' && p.moves.includes('ult2') && frame >= 8 ? 1 : 0);
