// 일반 적 · 중간 보스 도감. 근거: 스테이지설계서_차원승강기 3·9·14장, 스테이지설계서_명일아파트 6장(재현의 층), 기본 기획서 10장·부록 E.
// 수치(체력·가격·틀 수)는 게임 설계이며 시험판에서 조정한다. 가격 = 위협 예산(기본 기획서 8.4)에서 사는 값.
import { B, bake, humanoid, lowBody } from './frames';
import { charge, grab, S, shoot, strike } from './moves';
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
export type Faction = 'elevator' | 'replica' | 'bureau' | 'daydream' | 'guardian';
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

const H = 190; // 사람 키 (논리 px, 도트 95)

// ─── 차원 승강기 고유 ─────────────────────────────────────────

const lurkerBody = humanoid(64, H);
const lurker: EnemyDef = {
  kind: 'lurker',
  label: '해롭지 않아 보이는 것',
  role: 'rule',
  faction: 'elevator',
  price: 8,
  hp: 45,
  speed: 1.6,
  w: 64,
  h: H,
  body: lurkerBody,
  armor: 0,
  types: ['lobby'],
  ai: 'ambush',
  keep: [40, 90],
  drop: 'common',
  grabbable: true,
  cap: 3,
  note: '로비 구석에 서 있는 회사원 같은 것. 등을 보이거나 가까이 가면 고개가 먼저 돈다.',
  weak: '정면으로 보고 지나가면 깨어나지 않는다 (규칙 6)',
  color: '#8b8f86',
  attacks: [
    { move: grab('snap', '물어뜯기', 64, H, { tele: 10, active: 5, recover: 18, reach: 110, lunge: 9, ticks: 36, dmgPerTick: 2 }), range: [0, 150], dy: 30, cd: 90, weight: 2, when: 'targetBack' },
    { move: strike('claw', '할퀴기', 64, H, { tele: 12, active: 4, recover: 14, reach: [20, 95], z: [90, 170], spec: S(8, 'flinch', 4) }), range: [0, 100], dy: 24, cd: 30, weight: 3 },
  ],
};

const hollow: EnemyDef = {
  kind: 'hollow',
  label: '더는 사람이 아닌 것',
  role: 'rush',
  faction: 'elevator',
  price: 12,
  hp: 75,
  speed: 1.1,
  w: 66,
  h: H,
  body: humanoid(66, H, 16, 8),
  armor: 0,
  types: ['lobby', 'chase', 'replica', 'trial', 'puzzle', 'dark', 'silent'],
  ai: 'rush',
  keep: [30, 80],
  drop: 'common',
  grabbable: true,
  note: '승객 옷을 입은 것. 얼굴은 보지 않는 편이 낫다. 느리게 걷다가 갑자기 덤빈다.',
  color: '#7d7466',
  attacks: [
    { move: strike('lunge', '덤벼들기', 66, H, { tele: 16, active: 6, recover: 20, reach: [20, 90], z: [80, 180], lunge: 7, spec: S(12, 'stagger', 8) }), range: [60, 170], dy: 26, cd: 70, weight: 2 },
    { move: grab('hug', '끌어안기', 66, H, { tele: 14, active: 4, recover: 22, reach: 80, ticks: 45, dmgPerTick: 1.5 }), range: [0, 120], dy: 24, cd: 120, weight: 2 },
    { move: strike('swipe', '팔 휘두르기', 66, H, { tele: 12, active: 4, recover: 12, reach: [10, 85], z: [90, 170], spec: S(7, 'flinch', 3) }), range: [0, 90], dy: 22, cd: 24, weight: 3 },
  ],
};

const crawlerBody = lowBody(110, 54);
const crawler: EnemyDef = {
  kind: 'crawler',
  label: '다리 많은 새끼',
  role: 'rush',
  faction: 'elevator',
  price: 16,
  hp: 50,
  speed: 3.2,
  w: 110,
  h: 54,
  body: crawlerBody,
  armor: 0,
  types: ['chase', 'dark', 'service'],
  ai: 'ceiling',
  keep: [20, 70],
  drop: 'common',
  grabbable: true,
  cap: 4,
  note: '천장을 기다가 바로 위에서 떨어진다. 바닥 그림자가 진해지면 피할 때다.',
  weak: '떨어진 직후 뒤집혀 있는 동안 (약 1초)',
  color: '#5b4a3f',
  attacks: [
    {
      move: bake(
        'drop',
        '덮치기',
        crawlerBody,
        [
          { n: 18, tele: true, hurt: [B(-50, 50, 0, 40, 20, 'torso')] },
          { n: 6, hit: [B(-60, 60, 0, 70, 30, 'legs')], vz: -30 },
          { n: 30, hurt: [B(-55, 55, 0, 30, 20, 'core')], ev: 'flipped' },
        ],
        [S(14, 'down', 2, { strength: 2 })],
        { danger: [{ fx0: -60, fx1: 60, dy: 30 }] },
      ),
      range: [0, 30],
      dy: 18,
      cd: 60,
      weight: 3,
      when: 'airTarget',
    },
    { move: strike('nip', '물기', 110, 54, { tele: 8, active: 3, recover: 10, reach: [30, 90], z: [0, 60], lunge: 4, body: crawlerBody, spec: S(6, 'flinch', 3), low: true }), range: [0, 100], dy: 22, cd: 20, weight: 3, when: 'grounded' },
  ],
};

const shadeBody = [B(-55, 55, 0, 10, 26, 'core')];
const shade: EnemyDef = {
  kind: 'shade',
  label: '얼룩',
  role: 'hinder',
  faction: 'elevator',
  price: 18,
  hp: 70,
  speed: 1.4,
  w: 110,
  h: 12,
  body: shadeBody,
  armor: 0,
  types: ['dark'],
  ai: 'stain',
  keep: [0, 10],
  drop: 'common',
  grabbable: false,
  cap: 3,
  note: '바닥의 얼룩. 멈춰 있는 사람 밑으로 모인다. 빛을 받으면 얇아진다.',
  weak: '빛(손전등) 안에서만 피해를 받는다. 멈추지 마라 (규칙 10)',
  color: '#1d1a24',
  attacks: [
    {
      move: bake(
        'rise',
        '솟구치기',
        shadeBody,
        [
          { n: 20, tele: true },
          { n: 8, hit: (t) => [B(-45, 45, 0, 40 + 160 * t, 26, 'arm')], hurt: (t) => [B(-30, 30, 0, 40 + 160 * t, 20, 'core')] },
          { n: 24, hurt: [B(-30, 30, 0, 200, 20, 'core')] },
        ],
        [S(16, 'launch', 1, { lift: 14, strength: 3, unblockable: true })],
        { danger: [{ fx0: -45, fx1: 45, dy: 26 }] },
      ),
      range: [0, 30],
      dy: 20,
      cd: 90,
      weight: 1,
    },
  ],
};

const humBody = humanoid(60, 180);
const hum: EnemyDef = {
  kind: 'hum',
  label: '발소리',
  role: 'rush',
  faction: 'elevator',
  price: 18,
  hp: 55,
  speed: 1.5,
  w: 60,
  h: 180,
  body: humBody,
  armor: 0,
  types: ['silent'],
  ai: 'invisible',
  keep: [20, 70],
  drop: 'common',
  grabbable: true,
  cap: 3,
  note: '보이지 않는다. 발밑 파문만 보인다. 소리를 내면 바로 그쪽으로 온다.',
  weak: '맞으면 잠깐 모습이 드러난다',
  color: '#c9d3cf',
  attacks: [
    { move: strike('scrape', '긁기', 60, 180, { tele: 14, active: 4, recover: 16, reach: [15, 90], z: [70, 170], spec: S(12, 'stagger', 6) }), range: [0, 100], dy: 24, cd: 40, weight: 2 },
    { move: strike('shriek', '비명', 60, 180, { tele: 20, active: 6, recover: 20, reach: [-120, 120], z: [0, 200], dy: 50, extend: false, spec: S(6, 'stagger', 10, { unblockable: true, debuff: { kind: 'fear', ticks: 60 } }) }), range: [0, 120], dy: 50, cd: 180, weight: 1 },
  ],
};

const predBody = [B(-110, 40, 0, 80, 30, 'legs'), B(-120, 60, 80, 190, 30, 'torso'), B(40, 120, 70, 170, 26, 'head')];
const predator: EnemyDef = {
  kind: 'predator',
  label: '포식자',
  role: 'rush',
  faction: 'elevator',
  price: 45,
  hp: 340,
  speed: 0.9,
  w: 240,
  h: 190,
  body: predBody,
  armor: 1,
  types: ['service'],
  ai: 'heavy',
  keep: [60, 150],
  drop: 'mid',
  grabbable: false,
  cap: 1,
  note: '틈새로 떨어진 것들을 먹고 사는 크고 느린 것. 다락방에 오래 있으면 온다 (규칙 7).',
  weak: '삼키기 뒤 1초 동안 입이 열려 있다 (머리 피해 2배)',
  color: '#4c3b2e',
  attacks: [
    {
      move: grab('maw', '삼키기', 240, 190, { tele: 24, active: 6, recover: 30, reach: 170, lunge: 5, ticks: 60, dmgPerTick: 1.2, armor: 2, body: predBody }),
      range: [40, 180],
      dy: 34,
      cd: 150,
      weight: 2,
    },
    { move: strike('tail', '꼬리 쓸기', 240, 190, { tele: 22, active: 8, recover: 22, reach: [-220, 40], z: [0, 50], dy: 44, extend: false, spec: S(16, 'down', 8, { strength: 3 }), low: true, armor: 1, body: predBody }), range: [0, 200], dy: 44, cd: 110, weight: 2, when: 'behind' },
    { move: strike('slam', '내리찍기', 240, 190, { tele: 26, active: 5, recover: 28, reach: [40, 190], z: [0, 120], dy: 40, extend: false, spec: S(22, 'down', 6, { strength: 3 }), armor: 1, body: predBody }), range: [30, 190], dy: 40, cd: 90, weight: 3 },
  ],
};

const chargerBody = humanoid(80, 170, 18, 14);
const charger: EnemyDef = {
  kind: 'charger',
  label: '돌진하는 것',
  role: 'rush',
  faction: 'elevator',
  price: 20,
  hp: 110,
  speed: 1.3,
  w: 80,
  h: 170,
  body: chargerBody,
  armor: 0,
  types: ['trial', 'puzzle', 'chase'],
  ai: 'rush',
  keep: [180, 320],
  drop: 'common',
  grabbable: true,
  note: '시험 층 벽의 목표를 등에 붙이고 다닌다. 머리를 낮추면 직선으로 달려온다.',
  weak: '벽이나 기둥에 부딪히면 어지러워한다 (1.5초)',
  color: '#8a5a3a',
  attacks: [
    { move: charge('ram', '들이받기', 80, 170, { tele: 22, dash: 22, speed: 11, recover: 24, spec: S(16, 'stagger', 14, { strength: 2 }), armor: 1, body: chargerBody }), range: [140, 460], dy: 20, cd: 100, weight: 3 },
    { move: strike('butt', '머리 박기', 80, 170, { tele: 12, active: 4, recover: 14, reach: [20, 80], z: [110, 170], spec: S(10, 'stagger', 8) }), range: [0, 90], dy: 22, cd: 40, weight: 2 },
  ],
};

const edgeBody = [B(-30, 30, -30, 30, 18, 'core')];
const edge: EnemyDef = {
  kind: 'edge',
  label: '모서리 조각',
  role: 'shoot',
  faction: 'elevator',
  price: 15,
  hp: 50,
  speed: 2,
  w: 60,
  h: 60,
  body: edgeBody,
  armor: 0,
  types: ['puzzle'],
  ai: 'float',
  keep: [220, 380],
  drop: 'common',
  grabbable: false,
  hover: 110,
  cap: 3,
  note: '불가능한 도형에서 떨어져 나온 조각. 오래 보면 멀미가 난다.',
  weak: '돌진 뒤 잠깐 바닥에 박힌다',
  color: '#7a6cc2',
  attacks: [
    { move: shoot('spin', '조각 날리기', 60, 60, { tele: 18, shots: 2, gap: 10, recover: 20, fire: 'shard', body: edgeBody }), range: [150, 520], dy: 30, cd: 70, weight: 3 },
    { move: charge('cut', '베고 지나가기', 60, 60, { tele: 20, dash: 14, speed: 16, recover: 30, spec: S(10, 'stagger', 8, { debuff: { kind: 'bleed', ticks: 120 } }), armor: 0, body: edgeBody }), range: [60, 300], dy: 18, cd: 120, weight: 1 },
  ],
};

// ─── 재현의 층 「아파트 단지」 (명일 아파트 6장) ─────────────────

const residentBody = humanoid(66, H);
const resident: EnemyDef = {
  kind: 'resident',
  label: '사는 척하는 주민',
  role: 'rule',
  faction: 'replica',
  price: 10,
  hp: 150,
  speed: 1.2,
  w: 66,
  h: H,
  body: residentBody,
  armor: 0,
  types: ['replica'],
  ai: 'rule',
  keep: [30, 80],
  drop: 'common',
  grabbable: true,
  note: '평범한 이웃처럼 서 있다. 인사를 안 하거나 복도에서 뛰면 턱이 벌어진다.',
  weak: '규칙을 지키면 싸우지 않는다 (인사 E). 등 뒤 1.5배',
  color: '#9c8f7a',
  attacks: [
    { move: strike('nail', '손톱', 66, H, { tele: 12, active: 4, recover: 10, reach: [15, 90], z: [100, 170], spec: S(9, 'flinch', 4) }), range: [0, 100], dy: 22, cd: 22, weight: 3 },
    { move: strike('jaw', '턱 벌려 물기', 66, H, { tele: 20, active: 5, recover: 22, reach: [20, 110], z: [140, 200], lunge: 6, spec: S(16, 'stagger', 8, { debuff: { kind: 'bleed', ticks: 150 }, strength: 2 }) }), range: [40, 150], dy: 24, cd: 90, weight: 2 },
  ],
};

const dustyBody = lowBody(90, 60);
const dusty: EnemyDef = {
  kind: 'dusty',
  label: '먼지 생활용품',
  role: 'rush',
  faction: 'replica',
  price: 6,
  hp: 60,
  speed: 0.9,
  w: 90,
  h: 60,
  body: dustyBody,
  armor: 0,
  types: ['replica'],
  ai: 'rush',
  keep: [10, 60],
  drop: 'common',
  grabbable: true,
  cap: 5,
  note: '먼지 쌓인 밥상과 의자가 다리를 꼼지락거리며 기어 온다.',
  color: '#8c7b5c',
  attacks: [{ move: strike('bump', '부딪치기', 90, 60, { tele: 14, active: 5, recover: 16, reach: [20, 70], z: [0, 60], lunge: 6, body: dustyBody, spec: S(7, 'flinch', 6), low: true }), range: [0, 110], dy: 22, cd: 40, weight: 1 }],
};

const handBody = [B(-20, 20, 60, 150, 14, 'arm')];
const doorhand: EnemyDef = {
  kind: 'doorhand',
  label: '문틈 손',
  role: 'hinder',
  faction: 'replica',
  price: 8,
  hp: 40,
  speed: 0,
  w: 40,
  h: 150,
  body: handBody,
  armor: 0,
  types: ['replica'],
  ai: 'fixed',
  keep: [0, 0],
  drop: 'common',
  grabbable: false,
  cap: 2,
  note: '문틈에서 하얀 손이 나와 지나가는 사람을 붙잡는다.',
  weak: '문을 닫으면 들어간다 (E)',
  color: '#ddd6c6',
  attacks: [{ move: grab('clutch', '붙잡기', 40, 150, { tele: 12, active: 6, recover: 30, reach: 110, ticks: 60, dmgPerTick: 0.6, debuff: { kind: 'slow', ticks: 90 }, body: handBody }), range: [0, 120], dy: 26, cd: 120, weight: 1 }],
};

const faceBody = [B(-36, 36, 110, 180, 14, 'head')];
const wallface: EnemyDef = {
  kind: 'wallface',
  label: '벽에 묻힌 얼굴',
  role: 'env',
  faction: 'replica',
  price: 8,
  hp: 100,
  speed: 0,
  w: 72,
  h: 180,
  body: faceBody,
  armor: 0,
  types: ['replica'],
  ai: 'fixed',
  keep: [0, 0],
  drop: 'none',
  grabbable: false,
  cap: 3,
  note: '붉은 벽에 반쯤 묻힌 사람 얼굴. 지나가면 깨문다.',
  weak: '공격하지 마라. 때리면 바닥의 손들이 깨어난다 (규칙 11)',
  color: '#a04a3c',
  attacks: [{ move: strike('bite', '깨물기', 72, 180, { tele: 10, active: 4, recover: 26, reach: [-50, 50], z: [60, 180], dy: 40, extend: false, body: faceBody, spec: S(8, 'flinch', 3) }), range: [0, 60], dy: 60, cd: 50, weight: 1 }],
};

const flatBody = [B(-40, 40, 0, 8, 22, 'arm')];
const floorhand: EnemyDef = {
  kind: 'floorhand',
  label: '납작한 손 바닥',
  role: 'hinder',
  faction: 'replica',
  price: 8,
  hp: 80,
  speed: 0.6,
  w: 80,
  h: 8,
  body: flatBody,
  armor: 0,
  types: ['replica'],
  ai: 'floorgrab',
  keep: [0, 10],
  drop: 'common',
  grabbable: false,
  cap: 4,
  note: '바닥 무늬인 줄 알았던 손바닥이 발목을 잡는다.',
  weak: '점프로 넘어가면 못 잡는다',
  color: '#b8a48e',
  attacks: [
    {
      move: bake(
        'ankle',
        '발목 잡기',
        flatBody,
        [
          { n: 12, tele: true },
          { n: 6, hit: [B(-45, 45, 0, 24, 24, 'arm')], hurt: [B(-30, 30, 0, 40, 20, 'arm')] },
          { n: 20, hurt: [B(-30, 30, 0, 40, 20, 'arm')] },
        ],
        [{ dmg: 0, react: 'none', unblockable: true, low: true, grab: { ticks: 40, dmgPerTick: 0.5 }, debuff: { kind: 'slow', ticks: 90 }, stop: 3 }],
        { danger: [{ fx0: -45, fx1: 45, dy: 24 }] },
      ),
      range: [0, 40],
      dy: 22,
      cd: 60,
      weight: 1,
    },
  ],
};

const frameBody = [B(-46, 46, 0, 210, 20, 'torso'), B(30, 52, 0, 210, 22, 'shield')];
const doorframe: EnemyDef = {
  kind: 'doorframe',
  label: '문틀이 된 등',
  role: 'shield',
  faction: 'replica',
  price: 30,
  hp: 300,
  speed: 0.5,
  w: 100,
  h: 210,
  body: frameBody,
  armor: 2,
  types: ['replica'],
  ai: 'shield',
  keep: [40, 110],
  drop: 'common',
  grabbable: false,
  cap: 1,
  note: '문을 막고 선 굽은 등. 앞에서 치면 반만 들어간다.',
  weak: '등 쪽은 벽이라 없다. 잡기 폭파·던지기·환경 무기로 자세를 무너뜨려라',
  color: '#6e5b4e',
  attacks: [
    { move: strike('shove', '밀어붙이기', 100, 210, { tele: 18, active: 6, recover: 20, reach: [30, 120], z: [20, 190], lunge: 4, extend: false, body: frameBody, armor: 2, teleArmor: 2, spec: S(12, 'stagger', 14, { strength: 2 }) }), range: [0, 130], dy: 26, cd: 60, weight: 2 },
    { move: strike('crush', '짓누르기', 100, 210, { tele: 28, active: 6, recover: 30, reach: [20, 150], z: [0, 120], extend: false, body: frameBody, armor: 2, teleArmor: 2, spec: S(20, 'down', 4, { strength: 3 }) }), range: [0, 150], dy: 30, cd: 150, weight: 1 },
  ],
};

const tvBody = [B(-120, 30, 0, 60, 26, 'torso'), B(30, 90, 40, 150, 22, 'head'), B(0, 34, 60, 140, 20, 'back')];
const tv402: EnemyDef = {
  kind: 'tv402',
  label: '402호의 것',
  role: 'summon',
  faction: 'replica',
  price: 40,
  hp: 600,
  speed: 1.3,
  w: 210,
  h: 150,
  body: tvBody,
  armor: 1,
  types: ['replica'],
  ai: 'summoner',
  keep: [120, 260],
  drop: 'mid',
  grabbable: false,
  mid: true,
  cap: 1,
  note: '텔레비전에서 기어 나온 뱀 몸통에 사람 머리. 쳐다보면 두통이 온다.',
  weak: '등을 돌리면 멈춘다 (규칙 8). 뒤통수 2배',
  color: '#3f5a6a',
  attacks: [
    { move: strike('bite', '길게 물기', 210, 150, { tele: 18, active: 6, recover: 20, reach: [40, 230], z: [40, 150], lunge: 6, body: tvBody, armor: 1, spec: S(16, 'stagger', 10, { strength: 2 }) }), range: [60, 260], dy: 26, cd: 60, weight: 3 },
    { move: strike('coil', '휘감아 쓸기', 210, 150, { tele: 24, active: 8, recover: 24, reach: [-160, 160], z: [0, 70], dy: 50, extend: false, body: tvBody, armor: 1, low: true, spec: S(18, 'down', 8, { strength: 3 }) }), range: [0, 170], dy: 50, cd: 120, weight: 2 },
    { move: shoot('static', '지지직', 210, 150, { tele: 22, shots: 1, gap: 10, recover: 26, fire: 'static', body: tvBody }), range: [160, 600], dy: 60, cd: 140, weight: 2 },
  ],
};

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

// ─── 수호자 부하 ────────────────────────────────────────────

const mummy: EnemyDef = {
  kind: 'mummy',
  label: '식탁의 미라',
  role: 'rush',
  faction: 'replica',
  price: 0,
  hp: 90,
  speed: 0.6,
  w: 60,
  h: 176,
  body: humanoid(60, 176),
  armor: 0,
  types: [],
  ai: 'rush',
  keep: [20, 70],
  drop: 'none',
  grabbable: true,
  note: '405호 식탁에 앉아 있던 두 사람. 노부부가 싸우기 시작하면 일어나 느리게 따라온다.',
  color: '#a89a7c',
  attacks: [{ move: strike('grope', '더듬기', 60, 176, { tele: 18, active: 5, recover: 18, reach: [15, 90], z: [80, 160], spec: S(8, 'flinch', 4, { debuff: { kind: 'taint', ticks: 600 } }) }), range: [0, 100], dy: 22, cd: 60, weight: 1 }],
};


// ─── 층 모듈이 부르는 이름 (스테이지 floortypes·승객 조우) ─────────────────

const clerkBody = humanoid(62, 186);
const shooter: EnemyDef = {
  kind: 'shooter',
  label: '사격하는 것',
  role: 'shoot',
  faction: 'elevator',
  price: 15,
  hp: 70,
  speed: 1.2,
  w: 62,
  h: 186,
  body: clerkBody,
  armor: 0,
  types: ['lobby', 'trial', 'puzzle'],
  ai: 'kite',
  keep: [240, 400],
  drop: 'common',
  grabbable: true,
  cap: 3,
  note: '창구 직원처럼 앉아 있다가 서류철에서 날붙이를 던진다. 거리를 둔다.',
  weak: '던진 뒤 잠깐 선다. 깊이를 바꿔 피하고 붙어라',
  color: '#6e7a70',
  attacks: [
    { move: shoot('toss', '날붙이 던지기', 62, 186, { tele: 16, shots: 2, gap: 8, recover: 20, fire: 'spoon', body: clerkBody }), range: [150, 560], dy: 18, cd: 60, weight: 3 },
    { move: strike('jab', '찌르기', 62, 186, { tele: 10, active: 4, recover: 14, reach: [15, 85], z: [100, 160], spec: S(8, 'stagger', 10) }), range: [0, 90], dy: 22, cd: 40, weight: 4, when: 'close' },
  ],
};

const thief: EnemyDef = {
  kind: 'thief',
  label: '보급 승객',
  role: 'rush',
  faction: 'elevator',
  price: 0,
  hp: 110,
  speed: 2,
  w: 62,
  h: 184,
  body: humanoid(62, 184),
  armor: 0,
  types: [],
  ai: 'rival',
  keep: [60, 120],
  drop: 'daydream',
  grabbable: true,
  note: '배낭을 멘 승객. 보급품을 노리고 덤빈다. 몰리면 도망간다.',
  weak: '체력 30% 아래면 도망친다',
  color: '#7a6a4a',
  attacks: [
    { move: strike('shove', '밀치기', 62, 184, { tele: 12, active: 4, recover: 14, reach: [15, 90], z: [90, 170], spec: S(8, 'stagger', 12) }), range: [0, 100], dy: 22, cd: 30, weight: 3 },
    { move: strike('pipe', '쇠파이프', 62, 184, { tele: 18, active: 5, recover: 20, reach: [20, 120], z: [80, 190], lunge: 4, spec: S(14, 'down', 8, { strength: 3 }) }), range: [0, 140], dy: 24, cd: 80, weight: 2 },
  ],
};

const touchBody = [B(-24, 24, 60, 170, 14, 'arm')];
const toucher: EnemyDef = {
  kind: 'toucher',
  label: '만지는 손',
  role: 'hinder',
  faction: 'elevator',
  price: 0,
  hp: 1,
  speed: 1.1,
  w: 48,
  h: 170,
  body: touchBody,
  armor: 3,
  types: [],
  ai: 'touch',
  keep: [0, 30],
  drop: 'none',
  grabbable: false,
  note: '완전한 어둠에서 어깨를 만지는 손. 때려도 닿지 않는다. 멈추거나 소리 내면 다가온다.',
  weak: '움직이고, 조용히. 20초 뒤 사라진다',
  color: '#d8d0c0',
  attacks: [
    {
      move: bake('touch', '만지기', touchBody, [{ n: 20, tele: true }, { n: 4, hit: [B(-30, 50, 60, 170, 18, 'arm')] }, { n: 24 }], [{ dmg: 0, react: 'none', unblockable: true, debuff: { kind: 'fear', ticks: 60 }, stop: 0 }], { danger: [{ fx0: -30, fx1: 50, dy: 18 }] }),
      range: [0, 60],
      dy: 20,
      cd: 90,
      weight: 1,
    },
  ],
};

export const ROSTER: EnemyDef[] = [shooter, thief, toucher, lurker, hollow, crawler, shade, hum, predator, charger, edge, resident, dusty, doorhand, wallface, floorhand, doorframe, tv402, fbSmg, fbShield, fbChief, fbSword, ddMember, mummy];
export const ROSTER_BY_KIND: Record<string, EnemyDef> = Object.fromEntries(ROSTER.map((d) => [d.kind, d]));
/** 난입 세력 (층 유형과 무관하게 섞인다) */
export const INTRUDERS = { bureau: ['fb_smg', 'fb_shield', 'fb_chief'], bureauMid: ['fb_sword'], daydream: ['dd_member'] };
