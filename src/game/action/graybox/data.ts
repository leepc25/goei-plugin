// 회색 상자 시험판 · 데이터표. 그림 없음. 스테이지 설계서(차원 승강기)와 기본 기획서 8.4·부록 A를 숫자로 옮긴 것.
export type FloorType = 'lobby' | 'chase' | 'replica' | 'trial' | 'dark' | 'silent' | 'puzzle' | 'service';
export const TYPE_LABEL: Record<FloorType, string> = {
  lobby: '로비',
  chase: '추격의 층',
  replica: '재현의 층 · 아파트',
  trial: '시험 층',
  dark: '어둠의 층',
  silent: '침묵의 층',
  puzzle: '퍼즐과 선택의 층',
  service: '정비 구역',
};
export const TYPE_COLOR: Record<FloorType, string> = {
  lobby: '#3a4a52',
  chase: '#5a3030',
  replica: '#4a4530',
  trial: '#30455a',
  dark: '#15181c',
  silent: '#2e3a3a',
  puzzle: '#3f3050',
  service: '#4a3a24',
};

export interface AgentDef {
  id: 'jyaldi' | 'eileen';
  name: string;
  color: string;
  hp: number;
  atk: number;
  speed: number;
  /** 원거리: 피해, 연사 간격(초), 사거리 */
  ranged: { dmg: number; rate: number; range: number; clip: number };
  melee: { reach: number; dmg: [number, number, number] };
  unique: 'blast' | 'read';
  uniqueLabel: string;
  ultLabel: string;
  evade: 'side' | 'back';
}
export const AGENTS: AgentDef[] = [
  {
    id: 'jyaldi',
    name: '쟈알디',
    color: '#d94b3c',
    hp: 220,
    atk: 1.2,
    speed: 1,
    ranged: { dmg: 14, rate: 0.35, range: 420, clip: 999 },
    melee: { reach: 96, dmg: [18, 18, 34] },
    unique: 'blast',
    uniqueLabel: 'D 폭파 (주변 폭발, 벽 부수기)',
    ultLabel: 'W 전부 폭파',
    evade: 'side',
  },
  {
    id: 'eileen',
    name: '에일린',
    color: '#3c8ad9',
    hp: 170,
    atk: 1,
    speed: 1.1,
    ranged: { dmg: 22, rate: 0.5, range: 560, clip: 30 },
    melee: { reach: 72, dmg: [12, 12, 24] },
    unique: 'read',
    uniqueLabel: 'D 읽기 (표지·문·승객 정체 공개)',
    ultLabel: 'W 장총 일제 사격',
    evade: 'back',
  },
];

export interface EnemyDef {
  kind: string;
  label: string;
  price: number;
  hp: number;
  atk: number;
  speed: number;
  reach: number;
  windup: number;
  armor: 0 | 1 | 2 | 3;
  w: number;
  h: number;
  /** 어느 층 유형에 나오나 */
  types: FloorType[];
  special?: 'ranged' | 'rule' | 'ceiling' | 'invisible' | 'shadow' | 'reverse' | 'predator' | 'lurker';
}
export const ENEMIES: EnemyDef[] = [
  { kind: 'lurker', label: '해롭지 않아 보이는 것', price: 8, hp: 40, atk: 10, speed: 0.6, reach: 60, windup: 0.9, armor: 0, w: 56, h: 120, types: ['lobby'], special: 'lurker' },
  { kind: 'resident', label: '사는 척하는 주민', price: 10, hp: 90, atk: 14, speed: 0.8, reach: 70, windup: 0.5, armor: 0, w: 60, h: 130, types: ['replica'], special: 'rule' },
  { kind: 'shooter', label: '사격 요원', price: 15, hp: 70, atk: 8, speed: 0.7, reach: 460, windup: 0.8, armor: 0, w: 56, h: 128, types: ['lobby', 'trial', 'puzzle', 'replica'], special: 'ranged' },
  { kind: 'charger', label: '돌진하는 것', price: 20, hp: 120, atk: 18, speed: 1.4, reach: 80, windup: 0.4, armor: 1, w: 70, h: 120, types: ['trial', 'chase', 'puzzle'] },
  { kind: 'crawler', label: '다리 많은 새끼', price: 25, hp: 60, atk: 12, speed: 1.6, reach: 60, windup: 0.3, armor: 0, w: 80, h: 70, types: ['chase', 'dark'], special: 'ceiling' },
  { kind: 'shade', label: '얼룩', price: 20, hp: 80, atk: 16, speed: 0.9, reach: 64, windup: 0.6, armor: 0, w: 90, h: 40, types: ['dark'], special: 'shadow' },
  { kind: 'hum', label: '발소리', price: 20, hp: 60, atk: 20, speed: 1.0, reach: 64, windup: 0.5, armor: 0, w: 60, h: 120, types: ['silent'], special: 'invisible' },
  { kind: 'predator', label: '포식자', price: 40, hp: 300, atk: 30, speed: 0.7, reach: 110, windup: 1.0, armor: 2, w: 140, h: 150, types: ['service'], special: 'predator' },
];
export interface GuardianDef {
  kind: string;
  label: string;
  type: FloorType;
  hp: number;
  atk: number;
  speed: number;
  reach: number;
  windup: number;
  armor: 0 | 1 | 2 | 3;
  w: number;
  h: number;
  weakness: string;
  special: 'patrol' | 'ceiling' | 'shadow' | 'invisible' | 'reverse' | 'elder';
}
export const GUARDIANS: GuardianDef[] = [
  { kind: 'guard', label: '낡은 제복의 경비원', type: 'lobby', hp: 500, atk: 22, speed: 0.9, reach: 90, windup: 0.7, armor: 1, w: 70, h: 150, weakness: '순찰 경로 밖에 서면 못 본다. 등 뒤 2배', special: 'patrol' },
  { kind: 'legs', label: '다리 많은 것', type: 'chase', hp: 700, atk: 26, speed: 1.3, reach: 100, windup: 0.5, armor: 1, w: 160, h: 110, weakness: '틈새를 막으면 나올 곳이 줄어든다', special: 'ceiling' },
  { kind: 'shadow', label: '그림자', type: 'dark', hp: 600, atk: 24, speed: 1.0, reach: 90, windup: 0.6, armor: 2, w: 160, h: 60, weakness: '손전등(아이템 4) 3초 동안만 피해', special: 'shadow' },
  { kind: 'noise', label: '소리와 냄새', type: 'silent', hp: 400, atk: 28, speed: 1.1, reach: 80, windup: 0.5, armor: 0, w: 70, h: 140, weakness: '보이지 않음. 파문으로 위치', special: 'invisible' },
  { kind: 'shape', label: '불가능한 입체 도형', type: 'puzzle', hp: 800, atk: 20, speed: 0.8, reach: 110, windup: 0.9, armor: 2, w: 120, h: 160, weakness: '보고 있으면 조작 반전. 등 돌리면 해제', special: 'reverse' },
  { kind: 'elder', label: '405호 노부부', type: 'replica', hp: 1200, atk: 24, speed: 0.6, reach: 100, windup: 0.8, armor: 2, w: 90, h: 140, weakness: '하단 공격(앉아 A) 2배 · 「잘 먹었습니다」(E)로 전투 생략', special: 'elder' },
  { kind: 'guard2', label: '낡은 제복의 차장', type: 'trial', hp: 550, atk: 22, speed: 1.0, reach: 90, windup: 0.6, armor: 1, w: 70, h: 150, weakness: '순찰 경로 밖에 서면 못 본다', special: 'patrol' },
];

export interface RuleDef {
  id: string;
  text: string;
  type: FloorType | 'common';
}
export const RULES: RuleDef[] = [
  { id: 'entry', text: '점검표 서명란이 빈 엘리베이터가 입구다.', type: 'common' },
  { id: 'noreturn', text: '타고 온 승강기로는 못 돌아간다. 귀환은 다락방의 로프.', type: 'common' },
  { id: 'greet', text: '승강기를 탈 때 인사해라 (E). 대우가 달라진다.', type: 'common' },
  { id: 'close', text: '닫힘 버튼을 연타하지 마라.', type: 'common' },
  { id: 'mirror', text: '거울 속 얼굴이 피곤해 보이면 내려라.', type: 'common' },
  { id: 'lobby', text: '평범해 보이는 것을 믿지 마라.', type: 'lobby' },
  { id: 'attic', text: '다락방에 오래 있지 마라.', type: 'service' },
  { id: 'passenger', text: '친절한 승객이 둘이면 사연이 긴 쪽이 거짓이다.', type: 'common' },
  { id: 'trial', text: '벽의 목표를 먼저 읽어라.', type: 'trial' },
  { id: 'dark', text: '어둠에서는 멈추지 마라.', type: 'dark' },
  { id: 'silent', text: '소리를 내지 마라. 달리기·총·큰 기술이 소리다.', type: 'silent' },
  { id: 'exit', text: 'EXIT는 규칙 10줄 · 총애 3 · B-12 도달 뒤에만 눌러라.', type: 'common' },
  { id: 'r_greet', text: '아파트: 주민에게 먼저 인사해라 (E).', type: 'replica' },
  { id: 'r_quiet', text: '아파트: 복도에서 뛰지 마라.', type: 'replica' },
  { id: 'r_meal', text: '아파트: 권하는 밥은 「잘 먹었습니다」(E)로 거절해라.', type: 'replica' },
  { id: 'p_sign', text: '퍼즐: 표지가 가리키는 문이 정답이다. 표지는 읽어야 보인다.', type: 'puzzle' },
  { id: 'c_door', text: '추격: 문은 닫고 가라 (E). 뒤의 것이 느려진다.', type: 'chase' },
];
export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));

export interface MissionDef {
  id: string;
  kind: string;
  title: string;
  depth: string;
  reward: { budget: number; teeth: number; research: number };
  requires?: string;
}
export const MISSIONS: MissionDef[] = [
  { id: 'm1', kind: '조사', title: '로비에서 규칙 2개 확인 후 로프로 귀환', depth: 'L1~L2', reward: { budget: 100, teeth: 2, research: 0 } },
  { id: 'm2', kind: '진압', title: '로비 L3 경비원', depth: 'L3', reward: { budget: 200, teeth: 0, research: 0 }, requires: 'm1' },
  { id: 'm3', kind: '조사', title: '추격의 층 통과', depth: 'B-1', reward: { budget: 200, teeth: 0, research: 1 }, requires: 'm2' },
  { id: 'm4', kind: '구조', title: '야근하다 들어온 회사원을 다락방까지', depth: 'B-1~B-2', reward: { budget: 300, teeth: 5, research: 0 }, requires: 'm3' },
  { id: 'm5', kind: '조사', title: '재현의 층 「아파트」 규칙 3개', depth: 'B-2', reward: { budget: 150, teeth: 0, research: 2 }, requires: 'm3' },
  { id: 'm6', kind: '진압', title: '405호 노부부 (재현)', depth: 'B-2', reward: { budget: 400, teeth: 0, research: 1 }, requires: 'm5' },
  { id: 'm7', kind: '회수', title: '서명란이 빈 점검표', depth: '정비 구역', reward: { budget: 100, teeth: 0, research: 3 }, requires: 'm2' },
  { id: 'm8', kind: '조사', title: '시험 층 목표 달성', depth: 'B-3', reward: { budget: 500, teeth: 0, research: 1 }, requires: 'm6' },
  { id: 'm9', kind: '기록', title: 'B-5 도달', depth: 'B-5', reward: { budget: 600, teeth: 5, research: 2 }, requires: 'm8' },
];

export interface UpgradeDef {
  id: string;
  label: string;
}
export const UPGRADES: UpgradeDef[] = [
  { id: 'hp', label: '체력 +40' },
  { id: 'atk', label: '근접 피해 +25%' },
  { id: 'shot', label: '원거리 피해 +30%' },
  { id: 'speed', label: '이동 +12%' },
  { id: 'guard', label: '가드 피해 반감 → 1/3' },
  { id: 'evade', label: '회피 무적 +50%' },
  { id: 'clip', label: '아이템 1칸 +2' },
  { id: 'unique', label: '고유기 재사용 -30%' },
];
export const ITEMS = ['회복약', '방어 강화', '능력 회복', '손전등'] as const;
/** 난이도 예산 (기본 기획서 8.4). depth 1~3 = 로비, 4+ = B-(depth-3). */
export function budgetFor(depth: number, chunkIndex: number, danger: number, variant: number, growth: number): number {
  const base = depth <= 3 ? 6 + depth * 3 : 16 + (depth - 3) * 8;
  return Math.round(base + chunkIndex * 2 + danger * 5 + variant + growth * 4);
}
export function depthLabel(depth: number): string {
  return depth <= 3 ? `L${depth}` : `B-${depth - 3}`;
}
