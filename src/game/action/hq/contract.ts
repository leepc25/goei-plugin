// 본부 ↔ 출동(전투·층·아이템) 경계. 본부는 MissionLaunch를 넘기고 출동이 끝나면 RunResult를 받는다.
// 다른 스레드(전투·층 생성·아이템)는 이 모양만 맞추면 된다. 이름이 바뀌면 여기와 docs/게임_모듈_연결.md를 같이 고친다.

export type AgentId = 'jyaldi' | 'eileen';
export type MissionKind = '조사' | '구조' | '진압' | '회수' | '기록';
export type EndHow = 'return' | 'withdraw' | 'evac';

/** 기본 능력치 (기본기획서 16.1). 출동에는 피로·부상·커피를 반영한 값이 들어간다. */
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

/** 아이템 칸 하나. 아이템 표(SUPPLY_CATALOG)는 아이템 스레드 소관. */
export type Slot = null | { id: string; n: number };
/** 가방 칸 하나 (회수물 6칸) */
export type BagSlot = null | { id: string; name: string; research?: number; value?: number };

export interface MissionGoal {
  id: string;
  kind: MissionKind;
  title: string;
  /** 목표 깊이 (1~3 로비, 4 = B-1) */
  depth: number;
  /** 조사 임무: 확인할 규칙 수 */
  rules?: number;
  /** 구조 임무: 구할 사람 id */
  rescue?: string;
  /** 회수 임무: 회수물 id */
  recover?: string;
  /** 본편 상황판 연계 표시 */
  linked?: string;
}

export interface MissionLaunch {
  seed: number;
  agent: AgentId;
  support: AgentId | null;
  goal: MissionGoal;
  stats: AgentStats;
  /** 숙련 단계 1~10 */
  mastery: number;
  /** 숙련으로 열린 동작·효과 id (unique_a = 숙련3, ult2 = 5, unique_b = 6 …). 새 동작은 3·6뿐. */
  moves: string[];
  items: Slot[];
  relics: string[];
  coffee: string | null;
  /** 위험 단계 0~5 */
  danger: number;
  /** 출동 보조 규칙 (기획서 9.4) */
  variant: string;
  /** 규칙서에 이미 있는 줄 */
  knownRules: string[];
  /** 영구 지름길: 한 번 가 본 가장 깊은 층 */
  deepest: number;
}

export interface RunResult {
  how: EndHow;
  missionDone: boolean;
  depth: number;
  floors: number;
  kills: number;
  /** 출동 안에서만 쓰는 재화 (아이템 스레드 ItemRun.cash) */
  cash: number;
  /** 이상 파편 (출동 레벨용, 정산에 영향 없음) */
  shards: number;
  /** 중림 사채 (ItemRun.debt) */
  debt: number;
  /** 바닥에서 주운 예산·이빨 (수호자 등) */
  budget: number;
  teeth: number;
  bag: BagSlot[];
  itemsLeft: Slot[];
  found: string[];
  sent: string[];
  rescued: string[];
  /** 체력 30% 아래로 떨어진 적이 있나 (후송 영구 부상 판정에 씀) */
  bigHit: boolean;
  seconds: number;
}

export const emptyResult = (how: EndHow): RunResult => ({ how, missionDone: false, depth: 1, floors: 0, kills: 0, cash: 0, shards: 0, debt: 0, budget: 0, teeth: 0, bag: [], itemsLeft: [null, null, null, null], found: [], sent: [], rescued: [], bigHit: false, seconds: 0 });
