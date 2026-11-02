// 게임 모듈 연결 약속 (docs/게임_모듈_연결.md). 엔진(engine/)이 주인이다. 바꿀 일이 있으면 「게임 전투와 조작」에 먼저 알린다.
// 필드 추가는 선택(?)으로만 한다. 각 모듈의 자체 API(ui InputHub·audio createGameAudio·story mountStory·items stepField·
// enemy createEnemy·hq MissionLaunch)는 그대로 두고, 엔진의 통합 파일(engine/modules.ts)이 이 타입으로 이어 붙인다.
//
// 좌표 (회색 상자 sim.ts와 같음): 화면 1280×720 논리 px.
//   x = 가로(px, 왼쪽 0), y = 바닥 깊이 = 발이 닿는 화면 y (보통 480~680, 클수록 앞), z = 높이(px, 바닥 0, 위가 +).
//   화면에 그리는 y = y − z. 도트 1px = 논리 2px (쟈알디 키 약 100도트 = 200px).
// 틱: 30Hz 고정 (TICK = 1/30초). 모든 시간 수치(경직·히트스톱·무적)는 틱 단위. 그리기는 화면 주사율대로 보간.

export const TICK_HZ = 30;
export const SCREEN_W = 1280;
export const SCREEN_H = 720;
/** 도트 1px = 논리 2.75px: 쟈알디 몸(약 93px 도트)이 화면에서 약 256px (규격 2장, 검수 8번) */
export let PIXEL = 2.75;
/** 필드는 도트 1px = 논리 2px (화면 픽셀에 정수로 맞춰 도트가 고르게 찍히게, 2026-10-23 사용자). 전투는 2.75 그대로 */
export function setPixelScale(p: number): void {
  PIXEL = p;
}

/** 월드 AABB. x0<x1, z0<z1(높이). 깊이는 y ± dy (기본 dy 18) 안에 있어야 겹친다 */
export interface WBox { x0: number; x1: number; z0: number; z1: number; y: number; dy?: number }

/** 피격 반응 등급 (기본기획서 부록 E.1) */
export type React = 'none' | 'flinch' | 'stagger' | 'launch' | 'down' | 'bind';

export interface Hit extends WBox {
  /** 한 동작 안에서 같은 상대는 한 번만 맞는다 */
  attackId: number;
  dmg: number;
  react: React;
  /** 미는 방향 (+1 오른쪽) */
  dir: 1 | -1;
  /** 넉백 속도 px/틱, 띄움 속도 px/틱 */
  push?: number;
  lift?: number;
  /** 히트스톱 틱 (기본 flinch 2, stagger 3, launch·down 5) */
  stop?: number;
  low?: boolean;
  /** 크게 날리는 한 방(테스트룸 blow): 맞은 쪽은 크게 밀려나기(18_2) */
  blow?: boolean;
  /** 무기 쪽 공격(칼·총·투척·이능·기술·폭발, 무기 든 근접): 살해 허용일 때 기절한 몸을 죽일 수 있다. 맨손은 기절까지만 */
  lethal?: boolean;
  grab?: boolean;
  armorBreak?: boolean;
  /** 강도 1·2·3 (효과음·충격파 크기) */
  strength?: 1 | 2 | 3;
  noise?: number;
}

export interface HitResult {
  kind: 'hit' | 'guard' | 'armor' | 'immune';
  killed?: boolean;
}

/** 엔진이 돌리는 몸 하나 (플레이어·적·투사체). 적 모듈은 이 모양으로 돌려주거나, 엔진 통합이 감싼다 */
export interface Body {
  readonly id: number;
  readonly team: 'player' | 'enemy' | 'neutral';
  readonly kind: string;
  x: number; y: number; z: number;
  dir: 1 | -1;
  hp: number; hpMax: number;
  alive: boolean;
  /** 히트스톱 남은 틱. >0이면 엔진이 step을 건너뛴다 */
  stop: number;
  grabbable?: boolean;
  boss?: boolean;
  label?: string;
  /** 이 틱의 판정 (월드 좌표) */
  frame(): { hit: Hit[]; hurt: WBox[] };
  step(world: WorldView): void;
  applyHit(hit: Hit, world: WorldView): HitResult;
  draw?(ctx: CanvasRenderingContext2D, world: WorldView): void;
}

/** 이벤트 이름은 효과음 스레드 목록과 같다. 소리·화면 효과·대사·층 모듈 모두 이 하나의 흐름을 듣는다 */
export type GameEvent =
  | { type: 'hit'; strength: 1 | 2 | 3; x: number; y: number; z: number; dmg: number; react: React; target: string; combo: number; kind?: 'punch' | 'kick' | 'low' | 'dash' | 'bullet' | 'blast' | 'super' | 'enemy' }
  | { type: 'whiff' | 'jump' | 'land' | 'evade' | 'step'; x: number }
  | { type: 'shot'; x: number; ammo: number }
  | { type: 'empty' | 'reload'; x: number }
  | { type: 'guard' | 'guardBreak'; x: number }
  | { type: 'hurt'; x: number; dmg: number; hp: number }
  | { type: 'down'; x: number; who: 'player' | 'enemy' }
  | { type: 'ability' | 'super'; x: number; move: string }
  | { type: 'heal' | 'item' | 'pickup'; x: number; id?: string }
  | { type: 'enemyDie' | 'enemySpawn' | 'enemyTell' | 'bossTell' | 'bossRoar'; x: number; kind: string }
  | { type: 'door' | 'ding' | 'ruleFound'; x: number; id?: string }
  | { type: 'combat:start' | 'combat:boss' | 'combat:clear'; index: number }
  | { type: 'enter:floor'; floor: FloorPlan }
  | { type: 'hp:low' }
  | { type: 'run:end'; how: 'return' | 'withdraw' | 'evac' | 'death' }
  | { type: 'custom'; name: string; data?: unknown };

/** 적·층·아이템이 보는 세계 */
export interface WorldView {
  /** 회수품은 아이템 가방 하나에서만 보관·소비하고 출동 저장에 포함한다. */
  recovery?: { has(id: string): boolean; add(id: string): boolean; take(id: string): boolean };
  readonly tick: number;
  rand(): number;
  readonly player: Body & PlayerState;
  readonly bodies: readonly Body[];
  readonly floor: FloorPlan;
  /** 걸을 수 있는 깊이 [위, 아래] (화면 y) */
  readonly lane: [number, number];
  /** 화면 잠금 구간 (싸움 중) */
  readonly bounds: [number, number];
  /** 침묵의 층 소리 0~1, 어둠의 층 빛 0~1 (층 모듈이 씀) */
  noise: number;
  light: number;
  add(b: Body): void;
  emit(e: GameEvent): void;
  fx(kind: 'spark' | 'spark-big' | 'dust' | 'flash' | 'boom' | 'ring' | 'text', x: number, y: number, z: number, text?: string): void;
  shake(ticks: number, power?: number): void;
  say(text: string, seconds?: number): void;
}

export interface PlayerState {
  readonly ammo: number;
  readonly mag: number;
  readonly gauge: number;
  readonly guardMeter: number;
  readonly state: string;
  readonly airborne: boolean;
  readonly running: boolean;
  readonly crouching: boolean;
  readonly guarding: boolean;
  readonly combo: number;
}

export interface SpawnSpec { kind: string; x: number; y: number; elite?: boolean; boss?: boolean }

/** 플레이어가 triggerX를 넘으면 화면이 [lockFrom, lockTo]에 잠기고 waves가 차례로 나온다. 다 쓰러뜨리면 풀림(「GO →」) */
export interface Encounter { triggerX: number; lockFrom: number; lockTo: number; waves: SpawnSpec[][] }

export interface PropSpec {
  id: string;
  kind: string; // door hatch sign crate pickup elevator rope wall-crack decor …
  x: number; y: number; w: number; h: number;
  label?: string;
  solid?: boolean;
  breakable?: boolean;
  /** 사람 대역: 플레이어 클립을 색만 바꿔 그린다 (본부 동료 등). 회색 상자로 사람을 그리지 않는다 */
  actor?: { clip?: string; hue?: number; face?: 1 | -1; name?: string };
}

/** 층(또는 정비 구역 한 칸) 하나. 층 생성 모듈이 만든다 */
export interface FloorPlan {
  id: string;
  title: string;
  type?: string; // lobby chase replica trial dark silent puzzle service
  depth?: number;
  length: number;
  /** 걸을 수 있는 깊이 [위, 아래]. 기본 [440, 690] (게임_통합_규격 2장) */
  lane?: [number, number];
  startX: number;
  /** 넘으면 구간 끝. 기본 length − 80. 층 모듈이 finish로만 끝내려면 Infinity */
  exitX?: number;
  encounters: Encounter[];
  props?: PropSpec[];
  palette?: { wall: string; floor: string; accent: string };
  banner?: string;
  /** 배경을 직접 그림 (선택). ctx는 카메라만큼 옮겨진 월드 좌표 */
  drawBackground?(ctx: CanvasRenderingContext2D, camX: number): void;
  /** 몸들 위에 그림 (어둠·안개 등, 선택). 없으면 엔진이 world.light < 1일 때 어둡게 덮는다 */
  drawForeground?(ctx: CanvasRenderingContext2D, camX: number, world: WorldView): void;
  /** 몸과 깊이(y) 순서로 섞어 그릴 바닥 위 물건 줄 (월드 좌표). y = 바닥에 닿는 선, x0~x1 = 그림 폭 */
  depthLayers?: { y: number; x0: number; x1: number; occludedSilhouette?: boolean; draw(ctx: CanvasRenderingContext2D): void }[];
  /** 올라설 수 있는 물건 윗면 (발 자리 상자 + 높이 px). 그보다 높이 뛰면 넘고 위에 선다 */
  platforms?: { x0: number; x1: number; y0: number; y1: number; h: number }[];
  /** 바닥 물건을 두면 안 되는 x 구간 (벽 그림 속 문·가구 앞 등) */
  keepOut?: [number, number][];
}

export interface StageApi {
  readonly world: WorldView;
  spawn(s: SpawnSpec): void;
  setProp(id: string, patch: Partial<PropSpec> | null): void;
  /** false = 무적·회피로 안 맞음 */
  hurtPlayer(dmg: number, stagger?: boolean): boolean;
  heal(n: number): void;
  note(key: string, value: unknown): void;
  finish(how: 'next' | 'withdraw' | 'return'): void;
  /** 플레이어를 옮김 (구덩이 복귀·낮은 천장·단·추격 밀기). 속도는 0으로 */
  movePlayer(x: number, y?: number): void;
}

export interface StageModule {
  id: string;
  label: string;
  snapshot?(): string | null;
  restore?(state: string): FloorPlan;
  firstFloor(run: RunConfigCore): FloorPlan;
  /** null = 출동 끝(귀환) */
  nextFloor(run: RunConfigCore, prev: FloorPlan, how: 'next' | 'withdraw'): FloorPlan | null;
  tick?(api: StageApi, floor: FloorPlan): void;
  /** E를 누르면 플레이어와 x 거리 60px 안(깊이 무관)의 가장 가까운 소품 하나로 부른다 */
  onInteract?(api: StageApi, floor: FloorPlan, prop: PropSpec): void;
  onEvent?(api: StageApi, floor: FloorPlan, e: GameEvent): void;
}

/** 엔진이 꼭 읽는 출동 정보. 본부의 MissionLaunch가 이 필드들을 가진다 */
export interface RunConfigCore {
  seed: number;
  agent: string;
  stageId?: string;
  danger?: number;
  hpMax?: number;
}

/** 엔진이 채우는 결과. 본부의 RunResult가 이것을 포함하고 나머지는 notes(층·아이템 모듈 기록)에서 꺼낸다 */
export interface RunResultCore {
  how: 'return' | 'withdraw' | 'evac' | 'death';
  floors: number;
  kills: number;
  maxCombo: number;
  timeSec: number;
  hpLeft: number;
  notes: Record<string, unknown>;
}

/** 본부 모듈 모양 (hq/). 엔진이 DOM 한 칸을 주고, 출동 버튼에서 deploy를 부르게 한다 */
export interface HqHostCore {
  deploy(run: RunConfigCore): void;
  stages(): { id: string; label: string }[];
}
export interface HqModuleLike {
  mount(root: HTMLElement, host: HqHostCore): void;
  ready?(): Promise<void>;
  onReturn(result: RunResultCore, run: RunConfigCore): void;
  unmount(): void;
  /** 본부를 엔진 벨트 장면으로 걷게 할 때: 본부 층 (없으면 DOM 본부만) */
  hub?(): StageModule;
  /** 본부 메뉴 창이 열려 있나 (열린 동안 걷기 멈춤, 창 DOM을 보임) */
  isOpen?(): boolean;
}
