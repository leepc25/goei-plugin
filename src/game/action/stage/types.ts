// 차원 승강기 스테이지 · 공용 자료형. 엔진·화면과 무관하다(DOM 없음).
// 층(벨트스크롤) 좌표: x = 가로 px, lane = 앞뒤 깊이 0(뒤)~LANE_DEPTH(앞), z = 점프 높이.
// 엔진(docs/게임_모듈_연결.md)으로 넘길 때 lane은 laneY()로 화면 y(440~690, docs/게임_통합_규격.md 2장)가 된다.

export const CHUNK_W = 640;
export const ROOM_W = 1280;
export const LANE_DEPTH = 160;
/** 엔진 좌표: 걸을 수 있는 깊이 (화면 y) */
export const Y_TOP = 440;
export const Y_BOTTOM = 690;
/** 조각의 상대 깊이 lane(0~LANE_DEPTH)을 엔진 y로 */
export const laneY = (lane: number) => Y_TOP + (lane / LANE_DEPTH) * (Y_BOTTOM - Y_TOP);

export type FloorType = 'lobby' | 'silent' | 'dark' | 'chase' | 'puzzle' | 'replica' | 'trial' | 'deep';
export type DeepType = Exclude<FloorType, 'lobby' | 'deep'>;
export const DEEP_TYPES: DeepType[] = ['chase', 'replica', 'trial', 'dark', 'silent', 'puzzle'];
export type ReplicaSub = 'vacant' | 'pretending' | 'red';

/** 조각 지형. 조각 안 상대 x(0~CHUNK_W). */
export type Terrain =
  | { kind: 'pit'; x0: number; x1: number }
  | { kind: 'block'; x0: number; x1: number; h: number }
  | { kind: 'low'; x0: number; x1: number }
  | { kind: 'narrow'; x0: number; x1: number; lane0: number; lane1: number }
  | { kind: 'redfloor'; x0: number; x1: number; lane0: number; lane1: number }
  /** 침묵의 층: 밟으면 소리 */
  | { kind: 'glass'; x0: number; x1: number };

/** 조각이 제공하는 "얹을 자리". 생성기가 유형·예산에 따라 채운다. */
export type SlotKind = 'door' | 'hatch' | 'servicedoor' | 'prop' | 'enemy' | 'sign' | 'npc' | 'switch' | 'item';
export interface Slot {
  kind: SlotKind;
  x: number;
  lane?: number;
}
export interface ChunkTemplate {
  id: string;
  /** 'common' 또는 유형 */
  set: 'common' | FloorType | 'service';
  label: string;
  terrain: Terrain[];
  slots: Slot[];
  /** 끝에만 둘 수 있는 조각 (막다른 벽) */
  endOnly?: boolean;
  /** 이 조각이 요구하는 장치 (two-door 갈림길, 스위치 방 등) */
  device?: 'fork' | 'switches' | 'meal' | 'goalwall';
  /** 등장 최소 깊이 */
  minDepth?: number;
}

export type FixedRoomKind = 'elevator_hall' | 'attic' | 'guardian_room' | 'trial_goal' | 'exit_hall';

/** 층 위에 얹힌 것 (전부 절대 x) */
export type PlacedKind =
  | 'elevator' // 엘리베이터 문 (시작 홀)
  | 'panel' // 승강기 패널 (끝 홀) → 다음 층 선택
  | 'mirror'
  | 'checklist'
  | 'door' // 갈림길 문: data.correct
  | 'shutter' // 막힌 셔터: 정답 문·스위치로 열림
  | 'switch' // 스위치: data.order
  | 'hatch' // 천장 해치 → 정비 구역
  | 'servicedoor' // 점검문 → 정비 구역
  | 'sign' // 규칙 표지: data.rule
  | 'goalwall' // 시험 층 목표 벽
  | 'mark' // 시험 층 찾을 표식
  | 'table' // 재현 밥상
  | 'item' // 줍는 것: data.item
  | 'belonging' // 재현 빈집 '남의 물건'
  | 'symbol' // 표시 체계 무리의 벽 기호
  | 'chasedoor' // 추격 층 닫을 수 있는 문
  | 'prop' // 장식(글자만)
  | 'b12' // 벽에 적힌 B-12
  // ── 메트로배니아 (기본기획서 6.2·8.2, 스테이지 설계서 4.2)
  | 'upper' // 위층 정비 구역으로 오르는 점검문 (아래에서는 잠김, 위에서 내려오면 열린 지름길)
  | 'locked' // 잠긴 방화셔터: 그 층 정비 구역의 열쇠로 연다
  | 'sidedoor' // 곁가지 방 문 (끝에 보상)
  | 'crack' // 금 간 벽: 때려 부수면 숨은 방
  | 'vent'; // 막힌 덕트: 앉은 채 E로 숨은 방
export interface Placed {
  id: number;
  kind: PlacedKind;
  x: number;
  lane: number;
  w: number;
  label: string;
  data: Record<string, string | number | boolean>;
}

/** 적·수호자·승객은 다른 작업(적과 수호자 / 대사와 컷신)이 채운다. 스테이지는 "어디에 무엇의 자리"만 준다. */
export interface SpawnHook {
  id: number;
  role: 'enemy' | 'guardian' | 'resident' | 'stalker' | 'passenger' | 'predator';
  /** 후보 종류 id (적 작업이 정의, 여기서는 이름표 겸 기본 상자) */
  kind: string;
  x: number;
  lane: number;
  wave: number;
  elite: boolean;
  /** 승객: 정직 여부, 사연 길이 등 */
  data: Record<string, string | number | boolean>;
}

export interface FloorSegment {
  /** 'room:elevator_hall' 또는 'chunk:<템플릿 id>' */
  ref: string;
  x: number;
  w: number;
  flip: boolean;
  terrain: Terrain[]; // 절대 x로 변환된 것
}

export interface TrialGoal {
  kind: 'marks' | 'bells' | 'nostop' | 'clear';
  need: number;
  time: number;
  text: string;
}

export interface Floor {
  depth: number;
  label: string;
  type: FloorType;
  sub: ReplicaSub | null;
  seed: number;
  width: number;
  segments: FloorSegment[];
  placed: Placed[];
  spawns: SpawnHook[];
  budget: number;
  guardian: string | null;
  goal: TrialGoal | null;
  /** 이 층에서 실제로 작동하는 규칙 id (규칙서 줄) */
  rules: string[];
  /** 규칙 장치 수치 (유형별 규칙 엔진이 읽음) */
  tuning: Record<string, number>;
  palette: Palette;
  fallback: '' | 'A' | 'B';
  tries: number;
}

export interface Palette {
  wall: string;
  floor: string;
  trim: string;
  accent: string;
  fog: string;
}

// ── 정비 구역 ──
// 층과 층 사이의 세로 미로. 칸(cell) 격자이고, 칸 하나 = 화면 하나 폭의 벨트스크롤 방(엔진이 옆보기 물리를 몰라도 된다).
// 좌우 이웃 칸은 화면 끝을 걸어 나가면 이어지고(덕트면 앉아서), 위아래 이웃 칸은 사다리(지지대)로 오르내린다.
export type CellKind = 'entry' | 'duct' | 'support' | 'slope' | 'shaft' | 'attic' | 'down' | 'plain';
export interface ServiceThing {
  id: number;
  kind: 'up' | 'down' | 'ladder_up' | 'ladder_down' | 'left' | 'right' | 'rope' | 'bed' | 'intercom' | 'memo' | 'map' | 'pack' | 'gear' | 'checklist' | 'item' | 'symbol' | 'merchant' | 'fall' | 'key';
  x: number;
  lane: number;
  label: string;
  data: Record<string, string | number | boolean>;
}
export interface ServiceCell {
  col: number;
  row: number;
  kind: CellKind;
  /** 연결: 위·오른쪽·아래·왼쪽 */
  open: { u: boolean; r: boolean; d: boolean; l: boolean };
  /** 가로 연결이 덕트(앉아서만)인가 */
  duct: { r: boolean; l: boolean };
  width: number;
  segments: FloorSegment[];
  things: ServiceThing[];
  label: string;
}
export interface ServiceZone {
  /** 이 정비 구역이 붙은 층 깊이 (위층) */
  depth: number;
  seed: number;
  reroll: number;
  cols: number;
  rows: number;
  cells: ServiceCell[];
  atticCell: [number, number];
  entryCell: [number, number];
  downCell: [number, number];
  shaftCell: [number, number] | null;
  predatorAfter: number;
  /** 위층 잠긴 셔터의 열쇠가 놓인 칸 (없으면 null) */
  keyCell: [number, number] | null;
  /** 칸마다 싸움 한 판 (적 kind 목록). 키 = "col,row" */
  fights: Record<string, string[]>;
}

// ── 곁가지 방 (한 화면). 층의 sidedoor·crack·vent에서 들어가고, 같은 자리로 나온다.
export interface SideRoom {
  depth: number;
  /** 들어온 층 소품 id (p<n>) */
  door: string;
  secret: boolean;
  label: string;
  /** 상자: 강화 선택. 숨은 방은 상자 + 회수물 */
  loot: { kind: 'chest' | 'item' | 'gear'; x: number; item?: string }[];
  fight: string[];
  elite: boolean;
  palette: Palette;
}
