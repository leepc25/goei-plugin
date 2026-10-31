// 일반 적 · 중간 보스 도감: 가짜 관리국·백일몽. 옛 차원 승강기·재현의 층 괴이와 수호자 부하는 2026-10-28에 지웠다.
// 수치(체력·가격·틀 수)는 게임 설계이며 시험판에서 조정한다.
import { B, bake, humanoid } from './frames';
import { charge, S, shoot, strike } from './moves';
import type { Armor, FloorType, LocalBox, Move, Role } from './types';

export type AiKind =
  | 'rush'
  | 'kite'
  | 'shield'
  | 'ambush'
  | 'ceiling'
  | 'stain'
  | 'invisible'
  | 'heavy'
  | 'rule'
  | 'fixed'
  | 'floorgrab'
  | 'summoner'
  | 'chief'
  | 'duelist'
  | 'rival'
  | 'float'
  | 'touch'
  | 'boss';
export type Faction = 'bureau' | 'daydream';
export type DropTable = 'common' | 'bureau' | 'daydream' | 'mid' | 'guardian' | 'none';

export interface Attack {
  move: Move;
  /** 대상과 x 거리 [최소, 최대] */
  range: [number, number];
  /** 깊이 차 허용 */
  dy: number;
  /** 재사용 대기 (틱) */
  cd: number;
  weight: number;
  /** 추가 조건 이름 (ai.ts의 COND 표) */
  when?: 'grounded' | 'airTarget' | 'close' | 'far' | 'behind' | 'targetBack' | 'phase2' | 'phase3' | 'lowHp';
}

export interface EnemyDef {
  kind: string;
  label: string;
  role: Role;
  faction: Faction;
  price: number;
  hp: number;
  /** 걷는 속도 (px/틱) */
  speed: number;
  w: number;
  h: number;
  body: LocalBox[];
  /** 평상시 아머 */
  armor: Armor;
  types: FloorType[];
  attacks: Attack[];
  ai: AiKind;
  /** 선호 거리 [최소, 최대] */
  keep: [number, number];
  drop: DropTable;
  grabbable: boolean;
  /** 중간 보스 */
  mid?: boolean;
  /** 떠 있음 (기본 높이) */
  hover?: number;
  /** 화면당 최대 수 */
  cap?: number;
  /** 도감 설명 (게임 안 표시용, 한국어) */
  note: string;
  weak?: string;
  color: string;
}


// ─── 가짜 관리국 (모든 괴이에 난입) ─────────────────────────────

const suitBody = humanoid(64, 196);
const fbSmg: EnemyDef = {
  kind: 'fb_smg',
  label: '가짜 관리국 · 기관단총',
  role: 'shoot',
  faction: 'bureau',
  price: 15,
  hp: 120,
  speed: 1.5,
  w: 64,
  h: 196,
  body: suitBody,
  armor: 0,
  types: [],
  ai: 'kite',
  keep: [280, 440],
  drop: 'bureau',
  grabbable: true,
  note: '검은 정장, 선글라스. 거리를 두고 짧게 끊어 쏜다.',
  weak: '쏘는 동안은 서 있다. 깊이를 바꿔 피하고 붙어라',
  color: '#23262b',
  attacks: [
    { move: shoot('burst', '점사', 64, 196, { tele: 16, shots: 4, gap: 4, recover: 22, fire: 'bullet' }), range: [180, 620], dy: 14, cd: 60, weight: 3 },
    { move: strike('butt', '개머리판', 64, 196, { tele: 10, active: 4, recover: 14, reach: [15, 85], z: [100, 170], spec: S(9, 'stagger', 10) }), range: [0, 90], dy: 22, cd: 40, weight: 4, when: 'close' },
  ],
};

const fbShieldBody = [...humanoid(70, 196), B(30, 58, 10, 190, 22, 'shield')];
const fbShield: EnemyDef = {
  kind: 'fb_shield',
  label: '가짜 관리국 · 진압 방패',
  role: 'shield',
  faction: 'bureau',
  price: 20,
  hp: 200,
  speed: 0.9,
  w: 70,
  h: 196,
  body: fbShieldBody,
  armor: 1,
  types: [],
  ai: 'shield',
  keep: [60, 120],
  drop: 'bureau',
  grabbable: true,
  note: '진압 방패를 앞세워 밀고 들어온다. 정면 공격과 총알을 막는다.',
  weak: '뒤로 돌아가거나 잡아서 던져라. 방패 치기 뒤 빈틈',
  color: '#2c3036',
  attacks: [
    { move: strike('bash', '방패 치기', 70, 196, { tele: 16, active: 5, recover: 24, reach: [30, 110], z: [20, 190], lunge: 7, extend: false, body: fbShieldBody, armor: 1, spec: S(11, 'stagger', 16, { strength: 2 }) }), range: [0, 140], dy: 24, cd: 60, weight: 2 },
    { move: strike('baton', '진압봉', 70, 196, { tele: 12, active: 4, recover: 14, reach: [20, 95], z: [100, 190], body: fbShieldBody, spec: S(8, 'flinch', 4) }), range: [0, 100], dy: 22, cd: 30, weight: 2 },
  ],
};

const fbChief: EnemyDef = {
  kind: 'fb_chief',
  label: '가짜 관리국 · 과장님',
  role: 'summon',
  faction: 'bureau',
  price: 25,
  hp: 150,
  speed: 1.2,
  w: 66,
  h: 200,
  body: humanoid(66, 200),
  armor: 0,
  types: [],
  ai: 'chief',
  keep: [360, 520],
  drop: 'bureau',
  grabbable: true,
  cap: 1,
  note: '뒤에서 직급을 부르면 부하 전원이 빨라지고 세진다.',
  weak: '지휘관 먼저. 호명 중(1초)에 맞으면 끊긴다',
  color: '#3b2f2a',
  attacks: [
    { move: bake('rally', '직급 호명', humanoid(66, 200), [{ n: 30, tele: true }, { n: 6, ev: 'rally' }, { n: 16 }], [S(0, 'none')]), range: [0, 2000], dy: 2000, cd: 360, weight: 3 },
    { move: shoot('pistol', '권총', 66, 200, { tele: 18, shots: 1, gap: 8, recover: 18, fire: 'bullet' }), range: [120, 640], dy: 16, cd: 50, weight: 2 },
  ],
};

const swordBody = humanoid(64, 200);
const fbSword: EnemyDef = {
  kind: 'fb_sword',
  label: '가짜 관리국 · 검사',
  role: 'rush',
  faction: 'bureau',
  price: 50,
  hp: 500,
  speed: 1.8,
  w: 64,
  h: 200,
  body: swordBody,
  armor: 0,
  types: [],
  ai: 'duelist',
  keep: [120, 220],
  drop: 'mid',
  grabbable: true,
  mid: true,
  cap: 1,
  note: '검은 일본도. 두 번 베고, 화면을 가로질러 돌진해 벤다. 자세를 잡으면 받아친다.',
  weak: '가드로 받은 뒤 반격. 2연베기 뒤 0.8초 빈틈',
  color: '#15161a',
  attacks: [
    {
      move: bake(
        'twocut',
        '2연베기',
        swordBody,
        [
          { n: 14, tele: true, hurt: humanoid(64, 200, 16, -10) },
          { n: 4, hit: [B(10, 150, 80, 200, 24, 'weapon')], spec: 0, vx: 5, armor: 1 },
          { n: 6 },
          { n: 4, hit: [B(10, 160, 30, 150, 24, 'weapon')], spec: 1, vx: 5, armor: 1 },
          { n: 24, hurt: humanoid(64, 200, 16, 14) },
        ],
        [S(12, 'flinch', 4, { debuff: { kind: 'bleed', ticks: 120 } }), S(16, 'stagger', 12, { debuff: { kind: 'bleed', ticks: 120 }, strength: 2 })],
        { danger: [{ fx0: 10, fx1: 210, dy: 24 }] },
      ),
      range: [0, 170],
      dy: 24,
      cd: 50,
      weight: 3,
    },
    { move: charge('iai', '돌진 베기', 64, 200, { tele: 26, dash: 12, speed: 24, recover: 30, spec: S(22, 'down', 6, { debuff: { kind: 'bleed', ticks: 150 }, strength: 3 }), armor: 2, body: swordBody }), range: [200, 700], dy: 18, cd: 150, weight: 2 },
    { move: bake('stance', '받아치기 자세', swordBody, [{ n: 8, tele: true }, { n: 40, ev: 'parry', armor: 0 }, { n: 8 }], [S(0, 'none')]), range: [0, 200], dy: 30, cd: 240, weight: 1, when: 'phase2' },
  ],
};

// ─── 백일몽 (모든 괴이에 조우) ─────────────────────────────────

const ddBody = humanoid(62, 186);
const ddMember: EnemyDef = {
  kind: 'dd_member',
  label: '백일몽 탐사원',
  role: 'rush',
  faction: 'daydream',
  price: 18,
  hp: 150,
  speed: 2,
  w: 62,
  h: 186,
  body: ddBody,
  armor: 0,
  types: [],
  ai: 'rival',
  keep: [80, 160],
  drop: 'daydream',
  grabbable: true,
  note: '정장에 동물 가면. 회수물을 노리는 경쟁자. 몰리면 연막을 뿌리고 도망간다.',
  weak: '체력 30% 아래면 도망친다. 도망 전에 잡아라',
  color: '#4d3f63',
  attacks: [
    {
      move: bake(
        'kick2',
        '2연차기',
        ddBody,
        [
          { n: 10, tele: true },
          { n: 3, hit: [B(20, 100, 40, 110, 22, 'legs')], spec: 0, vx: 3 },
          { n: 5 },
          { n: 4, hit: [B(20, 110, 100, 180, 22, 'legs')], spec: 1, vx: 4 },
          { n: 14 },
        ],
        [S(7, 'flinch', 4), S(11, 'stagger', 10)],
        { danger: [{ fx0: 20, fx1: 140, dy: 22 }] },
      ),
      range: [0, 120],
      dy: 22,
      cd: 40,
      weight: 3,
    },
    { move: bake('smoke', '연막', ddBody, [{ n: 10, tele: true }, { n: 4, fire: 'smoke' }, { n: 10, inv: true, vx: -10 }], [S(0, 'none')]), range: [0, 140], dy: 40, cd: 200, weight: 1, when: 'close' },
  ],
};

export const ROSTER: EnemyDef[] = [fbSmg, fbShield, fbChief, fbSword, ddMember];
export const ROSTER_BY_KIND: Record<string, EnemyDef> = Object.fromEntries(ROSTER.map((d) => [d.kind, d]));
