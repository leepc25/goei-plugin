// 적과 수호자 모듈 입구. 엔진(engine/modules.ts)이 쓰는 것:
//   createEnemy(kind, x, y, rng, opts?)  → Enemy (엔진 Body: frame()·step()·applyHit()·draw())
//   stepEnemies(world)                   → 모든 적 한 틱 (Body.step을 엔진이 직접 부르면 안 불러도 된다. 같은 틱 두 번은 무시)
//   applyHit(enemy, hit, world)          → {kind, killed}
//   spawnWave(budget, floorType, depth, rng, area?) → 파도별 SpawnSpec (위협 예산)
//   guardianSpawn(floorType, area?)      → 수호자 방 SpawnSpec
//   signalEnemies(world, signal)         → 규칙 이행 신호 (인사·잘 먹었습니다·틈새 막기·그릇·문 닫기)
//   setDropHook(fn)                      → 처치 드랍 (아이템 모듈 dropFromKill과 연결)
//   isThreat(body)                       → 싸움 구간을 막는 적인가 (평화로운 주민·수호자 대기 상태는 아님)
import { AI_BRAINS } from './ai';
import { KIND_ALIAS } from './kinds';
export { KIND_ALIAS } from './kinds';
import { Enemy, type Affix } from './enemy';
import { GUARDIANS, GUARDIAN_BRAINS } from './guardians';
import { setSpawner } from './registry';
import { scaleAll } from './scale';
import { ROSTER, type EnemyDef } from './roster';
import type { Body, Hit, HitResult, RuleSignal, WorldView } from './types';

export { Enemy } from './enemy';
export { ROSTER, ROSTER_BY_KIND } from './roster';
export { GUARDIANS, GUARDIAN_FOR } from './guardians';
export { budgetFor, planEncounter, spawnWave, guardianSpawn, rollIntrusion, poolFor, SCREEN_CAP } from './spawn';
export { setDropHook, rollDrops, DROP_LABEL } from './drops';
export { moveJson, moveTiming } from './frames';
export { arenaStage } from './arenaStage';
export type { EnemyDef } from './roster';
export type { GuardianDef } from './guardians';

export const ALL_DEFS: EnemyDef[] = [...ROSTER, ...GUARDIANS];
scaleAll(ALL_DEFS);
export const DEF_BY_KIND: Record<string, EnemyDef> = Object.fromEntries(ALL_DEFS.map((d) => [d.kind, d]));

/** 층 모듈(stage/)이 쓰는 이름 → 이 모듈의 종류. solo = 짝을 스스로 부른다 (노부부·208호 가족) */
// 엔진은 DEF_BY_KIND[spec.kind]로 우리 적인지 본다. 별칭도 여기서 찾히게 한다
for (const [k, a] of Object.entries(KIND_ALIAS)) if (!DEF_BY_KIND[k] && DEF_BY_KIND[a.kind]) DEF_BY_KIND[k] = DEF_BY_KIND[a.kind];
export function hasKind(kind: string): boolean {
  return !!(DEF_BY_KIND[kind] || KIND_ALIAS[kind]);
}

export function createEnemy(kind: string, x: number, y: number, rng: () => number, opts: { elite?: boolean; affixes?: Affix[] } = {}): Enemy {
  const alias = KIND_ALIAS[kind];
  if (alias) kind = alias.kind;
  const def = DEF_BY_KIND[kind];
  if (!def) throw new Error(`unknown enemy kind: ${kind}`);
  const brain = GUARDIAN_BRAINS[kind] ?? AI_BRAINS[def.ai] ?? AI_BRAINS.rush;
  const AFF: Affix[] = ['bleed', 'armor', 'fast', 'regen'];
  const affixes = opts.elite ? (opts.affixes ?? [AFF[Math.floor(rng() * AFF.length)]]) : [];
  const e = new Enemy(def, x, y, brain, { elite: opts.elite, affixes, rand: rng });
  if (alias?.solo) e.mem.solo = true;
  return e;
}

// 두뇌가 부하를 부를 때 (402호 → 먼지 생활용품, 벽 얼굴 → 바닥 손, 노부부 → 미라 …)
setSpawner((w, kind, x, y, opts) => {
  const e = createEnemy(kind, x, y, () => w.rand(), opts);
  w.add(e);
  w.emit({ type: 'enemySpawn', x, kind });
  return e;
});

const stepped = new WeakMap<Enemy, number>();
export function stepEnemies(world: WorldView, ticks = 1) {
  for (let t = 0; t < ticks; t++)
    for (const b of world.bodies) {
      if (!(b instanceof Enemy) || !b.alive || b.stop > 0) continue;
      if (stepped.get(b) === world.tick) continue;
      stepped.set(b, world.tick);
      b.step(world);
    }
}

export function applyHit(enemy: Enemy, hit: Hit, world: WorldView): HitResult {
  return enemy.applyHit(hit, world);
}

export function signalEnemies(world: WorldView, s: RuleSignal) {
  for (const b of world.bodies) if (b instanceof Enemy && b.alive) b.brain.signal?.(b, s, world);
}

export function isThreat(b: Body): boolean {
  if (!(b instanceof Enemy)) return false;
  return b.alive && b.state !== 'dead' && b.hostile && b.mem.mode !== 'table' && b.mem.mode !== 'peace';
}

export type { RuleSignal } from './types';
