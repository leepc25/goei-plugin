// 게임 ↔ 플러그인 다리 (타입만). 게임 코드는 플러그인 본체에 들지 않고 코드 팩(goei-game.js)으로 따로 받는다.
// 코드 팩은 실행되면 globalThis.__goeiGame = { version, mount }를 남기고, 플러그인 창이 mount(box, bridge)로 붙인다.
// 플러그인 쪽 구현은 src/host/game/, 단독 시험 페이지용 가짜 다리는 src/game/bridge-local.ts.

/** 저장 칸: 0 = 자동 저장, 1~3 = 수동 */
export type SlotId = 0 | 1 | 2 | 3;
export const SLOT_IDS: SlotId[] = [0, 1, 2, 3];

export interface SlotInfo {
  slot: SlotId;
  /** 저장 시각 (ms) */
  savedAt: number;
  /** 예: 「3일차 · 쟈알디」 */
  title: string;
  /** 예: 「예산 420 · 규칙서 6줄 · 최저 B-2」 */
  summary: string;
  /** 저장 본문 모양 (예: goei-hq/1). 본부 쪽이 정한다 */
  schema: string;
  /** 본문 글자 수 */
  size: number;
}

export interface GameSaves {
  list(): Promise<SlotInfo[]>;
  read(slot: SlotId): Promise<string | null>;
  write(slot: SlotId, data: string, info: { title: string; summary: string; schema: string }): Promise<void>;
  remove(slot: SlotId): Promise<void>;
  /** 마지막으로 쓴 칸 (이어하기). 없으면 null */
  last(): Promise<SlotId | null>;
}

export interface GameAssets {
  /** 받아 둔 팩인가 */
  ready(pack: string): Promise<boolean>;
  /** 팩의 파일 주소 (blob:). 팩이 없거나 파일이 없으면 '' . 게임을 닫으면 주소를 거둔다 */
  url(pack: string, file: string): Promise<string>;
  /** 파일 바이트 (소리를 AudioContext.decodeAudioData로 풀 때 등). 없으면 null */
  bytes(pack: string, file: string): Promise<Uint8Array | null>;
  /** 팩의 atlas.json 내용 (없으면 null) */
  atlas(pack: string): Promise<unknown>;
  /** 팩 목록과 상태 */
  list(): Promise<{ id: string; bytes: number; ready: boolean; old: boolean }[]>;
}

/** 본편(카드·이 채팅) 읽기 전용 스냅숏. 게임을 열 때 한 번 만든다 */
export interface CardSnapshot {
  /** 카드 이름 */
  card: string;
  /** 유저 소속 코드 (A00 등) */
  faction: string;
  /** 캐릭터로 플레이 중인 요원 id (없으면 '') */
  player: string;
  agents: CardAgent[];
  anomalies: CardPlace[];
  sites: CardPlace[];
  /** 지금 상황판에 떠 있는 괴이·사건·미스틱 사이트 */
  events: CardEvent[];
  /** 상황판 시각 (분). 없으면 null */
  minute: number | null;
}

export interface CardAgent {
  id: string;
  name: string;
  english: string;
  affiliation: string;
  rank: string;
  /** 상황판 상태 (휴게·부상·작전투입…). 모르면 '미정' */
  state: string;
  situation: string;
  /** 편성할 수 없는 상태인가 (작전투입·실종·사망·미정) */
  locked: boolean;
  /** 대표 사진(카우보이 샷) 에셋 이름. 주소는 bridge.photo()로 */
  photo: string;
  /** 얼굴 사진 「에셋 이름#가로,세로,크기」(%, 크기는 그림 너비 대비 한 변). # 뒤가 없으면 그림 전체가 얼굴 */
  face: string;
}

export interface CardPlace {
  lore: string;
  label: string;
  english: string;
}

export interface CardEvent {
  kind: 'an' | 'in' | 'ms';
  name: string;
  loc: string;
  grade: string;
  state: string;
  situation: string;
}

/** 정산 결과. 게임이 넘기면 쌓아 두고, 사용자가 「본편에 기록」을 눌렀을 때만 카드에 쓴다 */
export interface GameReport {
  /** 같은 출동을 두 번 넘겨도 한 번만 받도록 (예: 출동 시드) */
  id?: string;
  mission: string;
  outcome: 'return' | 'evac' | 'withdraw';
  /** 예: B-12 */
  depth: string;
  agents: { id: string; name: string; hp?: number; injured?: boolean }[];
  rules: string[];
  loot: string[];
  /** 한두 문장 요약 */
  summary: string;
}

export interface GameViewport {
  /** 전체화면을 시도한다. 브라우저 전체화면이 막히면 창 안 전체화면으로 대신한다 */
  enter(): Promise<void>;
  exit(): Promise<void>;
  readonly full: boolean;
  /** 세로 화면에서 게임을 90도 돌려 가로로 보여 주는 중인가 */
  readonly rotated: boolean;
  /** 화면 좌표(clientX/Y)를 게임 상자 기준 좌표로. 돌려 보일 때도 맞게 바꾼다 */
  toLocal(clientX: number, clientY: number, el: Element): { x: number; y: number };
  /** 크기·방향이 바뀔 때 */
  onChange(cb: () => void): () => void;
}

/** NPC 자유 대화 (설계안 docs/NPC_자유대화.md). 사용자가 대화창에 보낼 때만 부른다. 본편 채팅에는 아무것도 쓰지 않는다 */
export interface GameTalk {
  /** 리스 모델 호출 (메인·보조, 플러그인 제공 모델 허용). 답 원문 */
  model(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], which: 'main' | 'aux'): Promise<string>;
  /** 지금 채팅 카드의 로어북에서 이름이 같은 항목 본문 (CBS를 이 채팅 변수로 푼 것). 없으면 null */
  lore(name: string): Promise<string | null>;
  /** 본편 최근 채팅 n마디 (「이름: 글」, 한 마디 300자 이내). 게임 설정에서 켰을 때만 부른다 */
  recent(n: number): Promise<string[]>;
}

export interface VisitState {
  /** 본부에 온 사람: 상황판 주인공(캐릭터로 플레이)이면 그 요원, 아니면 유저 페르소나(agentId '') */
  visitor: { agentId: string; name: string };
  agents: { id: string; name: string; state: string; situation: string; room: string | null }[];
  turns: { id: string; at: number; agentId: string; name: string; user: string; reply: string; visitor?: string; act?: boolean; extra?: { agentId: string; name: string; line: string }[] }[];
}
export interface GameVisit {
  state(): Promise<VisitState>;
  /** nearby = 같은 방 가까이 있어 끼어들 수 있는 요원 id */
  send(agentId: string, text: string, which: 'main' | 'aux', nearby?: string[]): Promise<VisitState>;
}

export interface GameBridge {
  /** 봇 보조 본부 방문. 응답은 시작한 채팅에 즉시 기록된다. */
  visit?: GameVisit;
  readonly api: 1;
  /** NPC 자유 대화. 없으면 게임은 미리 쓴 대사로만 답한다 */
  talk?: GameTalk;
  /** 시작 화면에서 사용자가 고른 저장 칸. 여기서 불러오고 여기에 저장한다 */
  readonly slot: SlotId;
  saves: GameSaves;
  assets: GameAssets;
  /** 본편 스냅숏. 괴이 카드 채팅이 아니면 null */
  card(): Promise<CardSnapshot | null>;
  /** 요원 사진 주소 (없으면 '') */
  photo(asset: string): Promise<string>;
  /** 정산 결과를 넘긴다 (쓰지는 않는다) */
  report(result: GameReport): void;
  viewport: GameViewport;
  /** 지금 AI 응답을 기다리는 중인가 */
  waiting(): boolean;
  onWaiting(cb: (waiting: boolean) => void): () => void;
  /** 모바일 폭인가 */
  narrow(): boolean;
  /** 게임 창을 닫는다 */
  close(): void;
  /** 창의 다른 탭으로 가서 게임이 안 보이게 됐다/다시 보인다. 게임은 멈추고 소리를 끈다 (2026-10-23) */
  onHidden?(cb: (hidden: boolean) => void): () => void;
}

/** 코드 팩이 남기는 것 */
export interface GameModule {
  version: string;
  mount(box: HTMLElement, bridge: GameBridge): () => void;
  /** 이전 시험판 (관리국 순찰·1인 전투 검증판) */
  legacy?: Record<string, (box: HTMLElement, bridge: GameBridge) => () => void>;
}
