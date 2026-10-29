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
  /** 유저 신분 (상태창 「신분」 칸, 인물 기록이 알아낸 것). 없으면 undefined. level = 직급 사다리 숫자 */
  identity?: { faction: string; rank: string; level: number | null };
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
  /** 전체화면을 시도한다. kind 'browser'(기본) = 브라우저 전체화면, 막히면 창 안으로. 'panel' = 상황창 안 전체(왼쪽 메뉴·오른쪽 신분증 칸까지 덮음) */
  enter(kind?: 'browser' | 'panel'): Promise<void>;
  /** 지금 전체화면 종류 (없으면 null). 옛 플러그인은 없다 */
  readonly mode?: 'browser' | 'panel' | null;
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

/** 필드 장부에 남길 사건 (게임 코드가 만든다). 본편 응답을 요청할 때 정제돼 들어간다 (docs/필드_기능_설계.md 8장) */
export interface GameFieldEvent {
  kind: string;
  /** 사람이 읽는 한 줄 */
  text: string;
  scene?: string;
  who?: string[];
  weight?: 1 | 2 | 3;
  /** 지금 확정된 사실 하나 (같은 key는 나중 것이 이긴다) */
  fact?: { key: string; value: string; permanent?: boolean };
  /** 목격한 소속 (세력 평판): 조직 코드와 「명단 인물이 봤나(named) / 이름 없는 몹이 봤나」. 몹 목격은 계기 값의 절반(설정) */
  witness?: { faction: string; named: boolean };
  /** 방문 번호·id. 호감·평판의 메시지당 상한을 방문마다(그리고 장면마다) 따로 세게. 없으면 장면 이름만으로 나눈다 */
  visit?: string;
}

/** 세력 평판 (docs/설계안_세력평판.md): 세력 → 유저 값과 구간. 몹의 첫 반응은 stage 로 정한다 */
export interface FactionView {
  code: string;
  name: string;
  /** −100~100 */
  value: number;
  /** friendly 우호 · favorable 호의 · neutral 중립 · wary 경계 · hostile 적대 */
  stage: 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile';
  stageLabel: string;
  /** 구간 경계 [우호 하한, 호의 하한, 중립 하한, 경계 하한] (설정) */
  bounds: [number, number, number, number];
}
/** 필드에 들어갈 수 있는지 (본편 주인공이 괴이 안이면 막는다) */
export interface GameEntry {
  allow: boolean;
  presence: 'none' | 'prep' | 'inside' | 'unknown';
  reason?: string;
  notice?: string;
  /** 시작 거점 id (표에 없는 소속은 본부) */
  site: string;
  /** 본편 현재 시각 (자정부터 분). 모르면 null */
  minute: number | null;
}
export interface GameField {
  record(ev: GameFieldEvent): Promise<void>;
  /** 입장 판정. 못 읽으면 막지 않는다 */
  entry?(): Promise<GameEntry>;
  /** 사용자가 판정을 직접 고친다 (null = 자동) */
  override?(v: 'inside' | 'outside' | null): void;
  /** 이 세션에서 마지막으로 만들어진 필드 출동 보고서 (exit_anomaly 뒤 플러그인이 만든다). 없으면 null. 게임은 본부 복귀 때 자막 한 줄에만 쓴다 */
  lastReport?(): Promise<{ id: string; title: string; summary: string } | null>;
}

/** 게임 안 설정(화면·소리·조작) 저장소: 플러그인이 이 채팅 변수로 둔다 (메인 설정 → 필드에서도 고침) */
/** 살아 있는 인물 기록 한 사람 (플러그인 core/people). 필드 대사·태도·대화 입력에 쓴다 */
export interface PersonView {
  name: string;
  faction: string;
  aliases: string[];
  /** 호감: 값(-100~300)과 8단계 */
  affinity: { value: number; stage: string; cell: 'hostile' | 'base' | 'warm' | 'close' };
  /** 유저를 부르는 말 */
  address: { toUser: string; register: '존댓말' | '반말' | '혼합' | '하게체' | '하오체' };
  express: 0 | 1 | 2 | 3;
  /** 칸별 살아 있는 항목 본문 */
  state: string[];
  knowledge: string[];
  threads: string[];
  suspicion: { target: string; kind: string; text: string }[];
  /** 이 인물에 대한 다음 턴 메모 (사실형 Director) */
  note?: { now?: string; mustNot?: string[] };
}
export interface GamePeople {
  /** 기록이 있는 인물 (이름을 주면 그 사람들만). 기록 기능이 꺼져 있으면 빈 목록 */
  people(names?: string[]): Promise<PersonView[]>;
  /** NPC 대화 입력용 글: 시트 고정 절 + 살아 있는 기록 (없으면 null → 게임은 시트 사본) */
  sheet(name: string): Promise<string | null>;
  /** 세력 평판 전부 (아는 세력 모두, 장부가 없으면 시작값). 기능이 꺼져 있으면 빈 목록 */
  factions(): Promise<FactionView[]>;
  /** 기록이 갱신될 때 (갱신기가 끝났을 때) */
  onChange(cb: () => void): () => void;
}

/** 가계부 (플러그인 core/wallet.ts, 채팅 변수 $st_wallet). 본편 상태창 잔고 칸과 같은 장부 */
export interface GameWallet {
  /** 지금 잔고(원). 이 채팅에서 잔고 칸을 끈 경우 null (게임은 돈 기능을 숨긴다) */
  balance(): Promise<number | null>;
  /** 필드 거래 한 줄: 들어오면 +, 나가면 −. 모자라도 적는다(마이너스 = 빚, 막는 건 게임이). where = 필드 장면 이름·필드 시각(가계부 줄에 보임). 적은 뒤 잔고, 못 적으면 null */
  add(amount: number, memo: string, where?: { place?: string; time?: string }): Promise<number | null>;
}

export interface GameUiPrefs {
  load(): Promise<string | null>;
  save(text: string): void;
}

export interface GameBridge {
  /** 게임 안 설정 저장소. 없으면(옛 플러그인) 게임이 브라우저 저장소에 둔다 */
  uiPrefs?: GameUiPrefs;
  /** 필드 장부. 없으면 사건을 남기지 않는다 */
  field?: GameField;
  /** 봇 보조 본부 방문. 응답은 시작한 채팅에 즉시 기록된다. */
  visit?: GameVisit;
  /** 살아 있는 인물 기록 (없으면 옛 플러그인: 게임은 시트 사본·자기 저장소로 동작) */
  people?: GamePeople;
  /** 가계부 (없으면 옛 플러그인: 게임은 돈을 쓰지 않는다) */
  wallet?: GameWallet;
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
}
