// 적과 수호자 · 공용 형식. DOM 없음, 30Hz 고정 틱. 엔진 약속(engine/contract.ts)의 Body·Hit·WBox·WorldView를 그대로 쓴다.
// 좌표: x = 가로, y = 바닥 깊이(발 화면 y), z = 높이. 그리는 y = y − z.
import type { Hit, React, WBox } from '../engine/contract';
export type { Body, GameEvent, Hit, HitResult, PlayerState, React, WBox, WorldView } from '../engine/contract';

export type FloorType = 'lobby' | 'chase' | 'replica' | 'trial' | 'dark' | 'silent' | 'puzzle' | 'service' | 'b12';
export const FLOOR_TYPES: FloorType[] = ['lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle', 'service', 'b12'];

/** 기본 기획서 10.1 역할 태그 */
export type Role = 'rush' | 'shoot' | 'hinder' | 'shield' | 'summon' | 'rule' | 'env';
export const ROLE_LABEL: Record<Role, string> = { rush: '돌격', shoot: '사격', hinder: '방해', shield: '방패', summon: '소환', rule: '규칙', env: '환경' };

/** 슈퍼아머 (부록 E.2): 0 없음 · 1 경 · 2 중 · 3 절대 */
export type Armor = 0 | 1 | 2 | 3;

/** 몸 기준 상자. fx는 바라보는 방향 기준 앞(+) 거리, z는 발 기준 높이, dy는 깊이 허용 폭(±). */
export interface LocalBox {
  fx0: number;
  fx1: number;
  z0: number;
  z1: number;
  dy: number;
  /** 피격 부위 (부상·약점 판정용) */
  part?: Part;
}
export type Part = 'head' | 'torso' | 'legs' | 'arm' | 'weapon' | 'core' | 'mouth' | 'back' | 'shield' | 'corner';
/** 월드 피격 상자 (부위 붙음) */
export interface PartBox extends WBox {
  part?: Part;
}

/** 디버프 (부록 E.4). 엔진에는 custom 이벤트 'debuff'로 넘긴다 */
export type Debuff = { kind: 'bleed' | 'taint' | 'headache' | 'confuse' | 'fear' | 'slow' | 'silence'; ticks: number };

/** 동작 하나의 공격 사양 (Hit의 상자 아닌 부분 + 이 모듈 전용 확장) */
export interface HitSpec {
  dmg: number;
  react: React;
  push?: number;
  lift?: number;
  stop?: number;
  low?: boolean;
  /** 막을 수 있나 (false면 가드 무시: 엔진에 armorBreak로 넘김) */
  unblockable?: boolean;
  /** 잡기: 닿으면 grab Hit, 이후 ticks 동안 붙잡고 틱마다 피해 */
  grab?: { ticks: number; dmgPerTick: number; every?: number };
  debuff?: Debuff;
  strength?: 1 | 2 | 3;
  noise?: number;
}

/** 한 장(frame)의 판정 */
export interface FrameBoxes {
  hit: LocalBox[];
  hurt: LocalBox[];
  armor: Armor;
  spec?: number;
  /** 이 장의 몸 이동 (틱당, 바라보는 방향 +) */
  vx?: number;
  vz?: number;
  tele?: boolean;
  fire?: string;
  inv?: boolean;
  ev?: string;
}
export interface Move {
  id: string;
  label: string;
  frames: FrameBoxes[];
  specs: HitSpec[];
  /** 바닥 예고 모양 (그리기용, 몸 기준) */
  danger?: { fx0: number; fx1: number; dy: number }[];
}

/** 드랍 (기본 기획서 11장). 줍기·가방은 아이템 모듈 몫이고 여기서는 굴린 결과만 넘긴다. */
export interface Drop {
  item: 'cash' | 'heal' | 'shard' | 'relic' | 'ammo' | 'dream' | 'key' | 'upgrade';
  n: number;
}

/** 엔진에 없는 신호(규칙 이행 등). 통합 쪽이 E 입력·층 소품 상태를 보고 부른다 → signalEnemies */
export type RuleSignal =
  | { kind: 'greet'; x: number; y: number }
  | { kind: 'mealThanks' }
  | { kind: 'mealEat' }
  | { kind: 'turnAway' }
  | { kind: 'plug'; x: number; propId?: string }
  | { kind: 'bowl'; x: number; y: number }
  | { kind: 'door'; x: number; y: number }
  | { kind: 'childDoor' }
  | { kind: 'look'; on: boolean };

export type { Hit as EngineHit };
