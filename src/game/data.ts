// 관찰형 게임(관리국 순찰)의 고정 데이터. 수치는 여기서만 고친다.

export type AgentId = 'jyaldi' | 'gorgo' | 'geshu' | 'deadfall' | 'spandal' | 'eileen' | 'curas' | 'rose';
export type EnemyId = 'corner' | 'watchman' | 'statue' | 'master';

/** 요원 기술의 종류: 범위 피해 / 아군 회복 / 피해 감소 / 적 묶기 / 아군 공격력 */
export type SkillKind = 'blast' | 'heal' | 'guard' | 'bind' | 'rally';

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  hp: number;
  atk: number;
  /** 공격이 닿는 거리 (논리 픽셀) */
  range: number;
  /** 공격 간격 (초) */
  rate: number;
  /** 기술 충전 시간 (초) */
  charge: number;
  skill: SkillKind;
  skillName: string;
  /** 기술 위력 (피해·회복량 배율, 또는 지속 초) */
  power: number;
  /** 얼굴 칸 번호 (faces.png) */
  face: number;
}

export const AGENTS: AgentDef[] = [
  { id: 'jyaldi', name: '쟈알디', role: '공격', hp: 130, atk: 18, range: 150, rate: 1.4, charge: 9, skill: 'blast', skillName: '폭발', power: 3.2, face: 0 },
  { id: 'gorgo', name: '고르고디오', role: '방어', hp: 220, atk: 14, range: 46, rate: 1.6, charge: 10, skill: 'guard', skillName: '중장갑', power: 5, face: 1 },
  { id: 'geshu', name: '게슈간', role: '제어', hp: 116, atk: 13, range: 140, rate: 1.5, charge: 10, skill: 'bind', skillName: '염동력', power: 3, face: 2 },
  { id: 'deadfall', name: '데드폴', role: '회복', hp: 124, atk: 10, range: 130, rate: 1.5, charge: 11, skill: 'heal', skillName: '시간 역행', power: 0.45, face: 3 },
  { id: 'spandal', name: '스팡달', role: '공격', hp: 112, atk: 21, range: 52, rate: 1.2, charge: 9, skill: 'bind', skillName: '그림자 가시', power: 2, face: 4 },
  { id: 'eileen', name: '에일린', role: '지원', hp: 120, atk: 14, range: 180, rate: 1.0, charge: 11, skill: 'rally', skillName: '조준 지시', power: 6, face: 5 },
  { id: 'curas', name: '큐라스', role: '공격', hp: 126, atk: 18, range: 150, rate: 1.4, charge: 10, skill: 'blast', skillName: '발화', power: 2.6, face: 6 },
  { id: 'rose', name: '로제몬', role: '지원', hp: 118, atk: 11, range: 140, rate: 1.5, charge: 10, skill: 'bind', skillName: '정신 간섭', power: 3.5, face: 7 },
];

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  atk: number;
  range: number;
  rate: number;
  speed: number;
  /** 그리는 배율 (정수). 우두머리는 크게 */
  scale: 1 | 2;
  boss: boolean;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  corner: { id: 'corner', name: '모퉁이 귀신', hp: 70, atk: 9, range: 34, rate: 1.5, speed: 48, scale: 1, boss: false },
  watchman: { id: 'watchman', name: '야간 경비', hp: 95, atk: 11, range: 40, rate: 1.8, speed: 38, scale: 1, boss: false },
  statue: { id: 'statue', name: '움직이는 동상', hp: 900, atk: 22, range: 70, rate: 2.4, speed: 16, scale: 2, boss: true },
  master: { id: 'master', name: '악몽의 주인', hp: 1300, atk: 26, range: 80, rate: 2.2, speed: 20, scale: 2, boss: true },
};

export type BackId = 'belt-school' | 'room-classroom' | 'room-lab' | 'room-broadcast' | 'room-courtyard' | 'belt-camp';

export interface RoomDef {
  back: BackId;
  name: string;
}

/** 한 번의 순찰 = 방 세 곳. 세 번째 방 끝에 우두머리 */
export const ROOMS: RoomDef[] = [
  { back: 'belt-school', name: '본관 복도' },
  { back: 'room-classroom', name: '교실' },
  { back: 'room-lab', name: '과학실' },
  { back: 'room-broadcast', name: '방송실' },
  { back: 'room-courtyard', name: '중앙 정원' },
];

export const CAMP: RoomDef = { back: 'belt-camp', name: '은신처' };

/** 요원 동작 시트(6×6) 줄: 걷기 0–11, 대기·공격 12–17, 기술 18–23, 피격·쓰러짐 24–29, 휴식 30–35 */
export const AF = {
  walk: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  idle: 12,
  attack: [14, 15, 16, 17],
  attackHit: 1,
  skill: [18, 19, 20, 21, 22, 23],
  skillHit: 3,
  hurt: 24,
  down: [25, 26, 27],
  rise: [28, 29],
  /** 앉아서 쉬기·먹기·마시기·정비 */
  rest: [30, 31, 32, 33],
} as const;

/** 적 동작 시트(6×4) 줄: 이동·대기 0–5, 공격 6–11, 기술 12–17, 피격·쓰러짐 18–23 */
export const EF = {
  move: [0, 1, 2, 3, 4, 5],
  attack: [7, 8, 9, 10, 11],
  attackHit: 2,
  skill: [12, 13, 14, 15, 16, 17],
  skillHit: 3,
  hurt: 19,
  die: [20, 21, 22, 23],
} as const;

/** 조정 상수 */
export const TUNE = {
  /** 논리 화면 높이. 배경(320×180)을 2배로 그린 높이 */
  sceneH: 360,
  /** 요원 걷는 속도 (논리 픽셀/초) */
  walkSpeed: 44,
  /** 걷기 그림 한 칸당 이동 거리 */
  strideStep: 6,
  /** 방 하나의 길이 */
  roomLen: 1500,
  /** 순찰이 깊어질 때마다 적 체력·공격력 배율 증가 */
  depthScale: 0.12,
  /** 은신처 휴식 시간 (초) */
  campTime: 7,
  /** 응답을 기다리는 동안 진행 속도 */
  waitingSpeed: 1.25,
  /** 저장 최소 간격 (밀리초) */
  saveGap: 5000,
} as const;
