// 쟈알디 동작표. 클립 = game-pack/jyaldi/frames.json 키, ticks = 장마다 머무는 틱(30Hz).
// 타격 장은 길게, 예비 동작은 짧게 (기본기획서 1.1.1 ③). 판정 상자는 그림에서 잰 reach를 쓰고, box를 주면 그것을 쓴다(도트, 앵커 기준).
import type { React } from './contract';

export interface MoveHit {
  /** 판정이 켜지는 장 번호들 */
  at: number[];
  dmg: number;
  react: React;
  push: number;
  lift?: number;
  stop: number;
  strength: 1 | 2 | 3;
  low?: boolean;
  armorBreak?: boolean;
  /** [x0, x1, z0, z1] 도트. 없으면 그 장의 reach */
  box?: [number, number, number, number];
  dy?: number;
  /** 화면 흔들림 틱 */
  shake?: number;
  noise?: number;
}

export interface MoveDef {
  clip: string;
  ticks: number[];
  /** 그림 안에서 몸이 이미 앞으로 가 있는 도트 (그릴 때 빼 줌) */
  origin?: number;
  /** 동작이 끝날 때 그림 안에서 전진한 도트 → 끝나면 x에 더함 */
  adv?: number;
  hits?: MoveHit[];
  /** 이 장부터 다음 동작으로 끊어 넘어갈 수 있음 (명중 시). whiffCancel은 헛쳤을 때 */
  cancel?: number;
  whiffCancel?: number;
  /** 무적 장 범위 [처음, 끝] */
  invuln?: [number, number];
  /** 슈퍼아머 [처음, 끝, 등급] */
  armor?: [number, number, number];
  /** 어떤 입력이든 바로 끊고 자유 상태로 (착지 등) */
  free?: boolean;
  /** 시작 전진 속도(px/틱)와 감속 */
  lunge?: [number, number];
}

const T = (...n: number[]) => n;

export const MOVES: Record<string, MoveDef> = {
  // 3연타: 잽(앞손, 예비 없음) → 스트레이트(뒷손) → 강한 스트레이트(앞손). 맞혀야 다음 타로 이어진다
  jab: {
    clip: 'jab', ticks: T(1, 1, 4, 2, 2), adv: 6, cancel: 2, whiffCancel: 3,
    hits: [{ at: [2], dmg: 8, react: 'flinch', push: 5, stop: 3, strength: 1, noise: 0.15 }],
  },
  cross: {
    clip: 'cross', ticks: T(1, 1, 2, 5, 3, 2), origin: 6, adv: 10, cancel: 3, whiffCancel: 4, lunge: [3, 0.7],
    hits: [{ at: [3], dmg: 10, react: 'flinch', push: 6, stop: 4, strength: 2, noise: 0.2 }],
  },
  power: {
    clip: 'power', ticks: T(2, 2, 3, 7, 6), origin: 16, adv: 20, lunge: [11, 0.78], armor: [2, 3, 1],
    hits: [{ at: [3], dmg: 18, react: 'down', push: 11, lift: 13, stop: 7, strength: 3, shake: 6, noise: 0.35 }],
  },
  // 달리며 A: 어깨 돌진
  dash: {
    clip: 'dash', ticks: T(2, 2, 4, 4, 3, 3), adv: 22, lunge: [12, 0.86],
    hits: [{ at: [2, 3], dmg: 14, react: 'down', push: 12, lift: 9, stop: 6, strength: 3, shake: 5, noise: 0.3 }],
  },
  // 앉아 A: 하단 킥 → 띄움
  lowkick: {
    clip: 'lowkick', ticks: T(1, 2, 5, 3, 2, 2), cancel: 3,
    hits: [{ at: [2, 3], dmg: 9, react: 'launch', push: 3, lift: 17, stop: 4, strength: 2, low: true }],
  },
  // 공중 A: 점프 킥
  airkick: {
    clip: 'airkick', ticks: T(1, 2, 6, 6, 4),
    hits: [{ at: [2, 3], dmg: 12, react: 'stagger', push: 8, stop: 4, strength: 2 }],
  },
  // D: 폭파 (고유기). 앞쪽 넓게, 아머 중
  blast: {
    clip: 'blast', ticks: T(2, 2, 3, 6, 4, 3, 3, 3), armor: [0, 3, 2],
    hits: [{ at: [3], dmg: 24, react: 'down', push: 14, lift: 14, stop: 8, strength: 3, armorBreak: true, box: [20, 82, 10, 90], dy: 34, shake: 9, noise: 0.8 }],
  },
  // 앉아 D: 지면 폭파 (양옆 낮게 → 띄움)
  groundblast: {
    clip: 'groundblast', ticks: T(2, 2, 3, 6, 4, 4), armor: [0, 3, 2],
    hits: [{ at: [3], dmg: 18, react: 'launch', push: 5, lift: 20, stop: 7, strength: 3, low: true, box: [-70, 90, 0, 40], dy: 40, shake: 8, noise: 0.8 }],
  },
  fire: { clip: 'fire', ticks: T(2, 2, 2, 1) },
  draw: { clip: 'draw', ticks: T(1, 1, 1, 1, 1) },
  reload: { clip: 'reload', ticks: T(3, 3, 3, 3, 3, 3) },
  evade: { clip: 'evade', ticks: T(1, 2, 2, 2, 2, 2), invuln: [0, 4], lunge: [15, 0.84] },
  land: { clip: 'land', ticks: T(1, 2, 2), free: true },
  // 잡기 타격: 무릎. 세 번째는 잡기 폭파로 넘어감
  grabknee: {
    clip: 'grabknee', ticks: T(2, 2, 4, 3),
    hits: [{ at: [2], dmg: 7, react: 'none', push: 0, stop: 4, strength: 2, box: [14, 46, 20, 60] }],
  },
  grabblast: {
    clip: 'grabblast', ticks: T(2, 2, 2, 2, 6, 3, 3, 3), armor: [0, 7, 2],
    hits: [{ at: [4], dmg: 22, react: 'down', push: 16, lift: 15, stop: 8, strength: 3, armorBreak: true, box: [10, 70, 20, 90], dy: 26, shake: 8, noise: 0.8 }],
  },
  // W: 필살기. 컷인 뒤 큰 폭발 (장 7)
  super: {
    clip: 'super', ticks: T(2, 2, 2, 2, 2, 2, 4, 9, 5, 5), invuln: [0, 9],
    hits: [{ at: [7], dmg: 60, react: 'down', push: 18, lift: 18, stop: 10, strength: 3, armorBreak: true, box: [20, 170, 0, 110], dy: 60, shake: 14, noise: 1 }],
  },
  pickup: { clip: 'pickup', ticks: T(2, 2, 2, 2, 2, 2) },
  drink: { clip: 'drink', ticks: T(3, 3, 3, 3, 3, 3) },
  eat: { clip: 'eat', ticks: T(3, 3, 3, 3, 3, 3) },
  bandage: { clip: 'bandage', ticks: T(3, 3, 3, 3, 3, 3) },
  toss: { clip: 'toss', ticks: T(2, 2, 2, 3, 3, 2) },
  // 임시 무기: 판정은 아이템 모듈이 낸다 (내구도·물건 부수기와 같이). 엔진은 동작만
  wswing: { clip: 'power', ticks: T(2, 2, 3, 5, 5), origin: 16, adv: 20, lunge: [5, 0.75] },
  wfire: { clip: 'fire', ticks: T(2, 2, 2, 1) },
};

export const COMBO = ['jab', 'cross', 'power'] as const;
