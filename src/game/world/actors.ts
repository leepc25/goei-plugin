// 필드 세계 행위자 시뮬 (docs/필드_세계_NPC_설계.md 3·5·6·7·8장).
// 이름 인물: 욕구 + 의무 → 할 일 고르기(needs.ts). 클립이 있는 활동만 켜지고, 없으면 서성이기·장면 오가기.
// 몹: 나올 때마다 성향을 뽑고(mobs.ts), 지나가다 자기 판단으로 사건을 일으킨다(소매치기·시비). 근무형은 근무시간에 자리를 지킨다.
// 소란도는 장면 단위. 경찰·경비는 플레이어 범죄에만 나선다(crime). 화면 밖 장면도 같은 규칙으로 돈다. 생활은 실시간, 시계와 무관.
import { ACTIVITIES, ACT_OPTS, TEMPER, choose, decayNeeds, fullNeeds, onDuty, type ActOpt, type Activity, type Needs } from './needs';
import { ARCHETYPES, DROPS, POCKET, inShift, rollTemper, type Post, type Temperament } from './mobs';
import { baseOf, derive, rollBase, type BaseStats } from '../combat/stats';
import { NAMED_MUL } from './npcperks';
import { defaultRelation, type Stance } from './factions';
import { applyTemper, catOf, rollNpcPerks } from './npcperks';
import type { Hop, PlaceGraph } from './places';
import { pick, range, type Rng } from './rng';

export type ActorKind = 'named' | 'mob';
/** 장면 의자의 앉는 방향 (N = 등, E·W = 옆, 없으면 정면) */
const seatDir = (face?: 'E' | 'W' | 'N'): 'front' | 'side' | 'back' => (face === 'N' ? 'back' : face ? 'side' : 'front');
/** 활동 클립 → 의자에서 하는 일 (fighter/seats.ts SEATS acts 이름) */
const SEAT_KIND: Record<string, string> = { work: 'type', eat: 'eat', drink: 'drink', rest: 'doze', hobby: 'book', talk: 'talk' };
export interface ActorDef {
  id: string;
  /** 이름표 (몹은 원형 이름) */
  name: string;
  kind: ActorKind;
  /** 행동 부품 (7-1장): needs = 욕구 AI(클립 없으면 roam), roam = 서성이기, transit = 몹 통행, post = 근무형 */
  brain: 'needs' | 'roam' | 'transit' | 'post';
  home: string;
  roam?: string[];
  /** 그림 열쇠 (이름 인물 = 이름, 몹 = 원형·그림 이름) */
  look?: string;
  speed?: number;
  /** 몹 원형 이름 (mobs.ts ARCHETYPES) */
  archetype?: string;
  /** 소속 세력 코드 (다른 세력 거점에 들어온 방문자 등, 방문 대응 10-31). 없으면 장면 소속·없음 */
  faction?: string;
}
export type Act = 'idle' | 'walk' | 'pause' | 'dead' | 'door' | 'do' | 'notice' | 'post' | 'watch' | 'argue' | 'down' | 'scared' | 'gone';
/** 걸어서 닿은 뒤 할 일 */
type Plan = 'none' | 'do' | 'post' | 'exit' | 'steal' | 'harass' | 'chase' | 'patrol' | 'roam-post' | 'cordon' | 'treat';

export interface Actor {
  def: ActorDef;
  scene: string;
  /** 지도 의자에 앉아 있음 (i = 장면 의자 번호). 그림은 그 인물 의자 맞춤값으로 (fighter/seats.ts) */
  seat?: { i: number; dir: 'front' | 'side' | 'back'; kind: string; x: number; y: number };
  /** 앉으러 가는 의자 번호 */
  seatPick?: number;
  x: number;
  y: number;
  face: 1 | -1;
  act: Act;
  /** 사람이 읽는 지금 할 일 (관찰 창) */
  doing: string;
  goal: { x: number; y: number } | null;
  route: Hop[];
  /** idle·door·do·notice·watch 남은 초 */
  wait: number;
  plan: Plan;
  /** 걷기 배율 (뛰기·도망) */
  run: number;
  /** 지금 그릴 클립과 시작 시각(생활 초) */
  clip: string;
  clipAt: number;
  /** 이 클립(일)이 끝나는 생활 초 — 그림이 끝 구간(책 덮기·컵 내리기)을 그 직전에 튼다 */
  clipUntil?: number;
  /** 활동에서 고른 줄 (ACT_OPTS), 바로 전에 한 줄 (같은 것 연달아 덜 고르게) */
  opt?: ActOpt;
  lastLine?: string;
  /** 이어 틀 클립 (맞고 의자에서 굴러떨어짐 → 일어나기 → 반응): 머리 클립이 끝나면 다음으로 */
  clipQ?: { clip: string; sec: number }[];
  clipQT?: number;
  /** 머리 위 아이콘 (! ? ♪ … #) */
  icon?: string;
  iconT: number;
  /** 머리 위 말풍선 (대사) */
  say?: string;
  sayT: number;
  // 이름 인물
  needs?: Needs;
  task?: Activity;
  last?: string;
  noticeCd: number;
  // 몹
  temper?: Temperament;
  drunk?: boolean;
  exitAt?: { x: number; y: number };
  target?: string;
  post?: Post;
  postI?: number;
  /** 다음 판단까지 초 (몹 사건 판단) */
  think: number;
  /** 맞은 공격 id (한 공격에 한 번) */
  hitBy?: number;
  /** 몹 몸 (등급 체력, 설계 2-3). 0이 되면 기절 → 일어나 떠난다 */
  hp?: number;
  hpMax?: number;
  /** 겁 반응 종류(sit 주저앉음·backoff 뒷걸음질)·다시 반응할 때까지 남은 초·도망 동작 */
  scare?: 'freeze' | 'sit' | 'cower' | 'backoff' | 'run';
  scareCd?: number;
  fleeClip?: string;
  /** 힘민체지정 (몹: 생겨날 때 무작위 합 25) */
  base?: BaseStats;
  /** 주머니 돈 (원) */
  pocket?: number;
  /** 그중 훔친 돈 */
  stolen?: number;
  /** 전투 AI 몸(ai-char)으로 싸우는 중: 시뮬이 움직이지도 그리지도 않는다 (engine/modules.ts life.combat) */
  fighting?: boolean;
  // 사람처럼 걷기 (10-30): 걸음 흔들림 위상 · 비켜선 깊이 · 다음 멈춤까지 초 · 장애물 우회 경유점 · 같이 걷는 일행(앞사람 id)과 나란히 선 깊이
  phase?: number;
  side?: number;
  pauseCd?: number;
  detour?: { x: number; y: number }[];
  buddy?: string;
  buddyDy?: number;
  /** 겁먹은 까닭이 있는 자리 x (시체 등). 없으면 주인공 */
  scareFrom?: number;
  /** 시체를 이미 봤다 (한 번만 반응) */
  sawBody?: boolean;
  /** 죽은 게임 시각(시간 누계) */
  diedAt?: number;
  /** 기절한 생활 시각(초): 이 뒤 KO_GRACE 동안은 무기로 맞아도 안 죽음 */
  downAt?: number;
  /** NPC 전용 퍽 (world/npcperks.ts): 생겨날 때 한 번 */
  perks?: string[];
  /** 한 번만 쓰는 퍽을 썼나 (뒤끝·지원 요청·호출·끈질긴 추적) */
  used?: string[];
  /** 구경꾼: 다시 구경할 때까지 초 */
  lookCd?: number;
  /** 훈련 중인 동작 (전투원) */
  trainClip?: string;
  /** 동료와 다시 어울릴 때까지 초 (인사·대화·다툼) */
  chatCd?: number;
  /** 진료할 사람 id (의사) */
  patient?: string;
  /** 쓰는 훈련 장비 (장면#번호) */
  station?: string;
  /** 평소 거리 순찰 중인 경찰 (C16, 10-31) */
  patrol?: boolean;
  /** 주인공이 말을 걸기 전에 하던 일 (몹 대화, 모델에 넣는다) */
  talkFrom?: string;
  /** 이름 인물이 맞고 화난 생활 시각 (또 맞으면 맞선다, C4) */
  angryAt?: number;
  /** 호감 적대 이름 인물이 마지막으로 싸움에서 돌아온 생활 시각 (1분은 다시 막지 않음) */
  blockAt?: number;
  /** 필드 안 NPC끼리 싸움 (방문 대응 10-31): 상대 id, 다음 타격까지 초 */
  brawl?: { foe: string; t: number };
  /** 이미 인사한 방문자 id */
  greeted?: string[];
  /** 경계: 따라붙어 지켜보는 방문자 id (경비) */
  escort?: string;
  /** 경보 대응 중인 거점 세력 (모이는 쪽) */
  alarm?: string;
  /** 방문자: 경계 거점에 머문 초 (경고 → 내보냄) */
  stay?: number;
  /** 동행 (10-31 사용자 「전부 만들어야지」, 필드 기능 7장): 주인공을 따라 걷는 중. 욕구·할 일은 멈춘다 */
  following?: boolean;
  /** 「기다려」: 그 자리에 남아 기다린다 (할 일을 고르지 않음) */
  hold?: boolean;
  /** 동행 중 싸움 거들기: 때릴 전투 몸 자리, 다음 타격까지 초 */
  assist?: { x: number; y: number; t: number } | null;
}

/** 훈련장 장비 하나 (10-31 사용자: 샌드백·허수아비·사격 과녁. 그림은 일단 코드, 나중에 교체) */
export interface Gear { kind: 'sandbag' | 'dummy' | 'target'; x: number; y: number; busy: boolean }

/** 길에 놓인 막힌 곳 (폴리스 라인·부서진 물건 등). wall = 길을 위아래 끝까지 막음 → 돌아섬 */
export interface Obstacle { id: string; x0: number; x1: number; y0: number; y1: number; wall?: boolean }

/** 걷다 잠깐 멈춰 하는 일: 클립 이름(charPacks FIELD_CLIP) · 관찰 창 글 · 몇 초. 그 인물에게 그 줄이 있을 때만 후보 (10-30 동작 활용표) */
const PAUSES: { clip: string; doing: string; sec: [number, number] }[] = [
  { clip: 'phone', doing: '폰 보는 중', sec: [4, 9] },
  { clip: 'call', doing: '통화 중', sec: [5, 10] },
  { clip: 'coffee', doing: '커피 마시는 중', sec: [4, 8] },
  { clip: 'limber', doing: '기지개', sec: [2.5, 4] },
  { clip: 'smoke', doing: '담배 피우는 중', sec: [5, 10] },
  { clip: 'browse', doing: '뒷짐 지고 구경', sec: [4, 8] },
  { clip: 'snack', doing: '간식 먹는 중', sec: [3, 6] },
  { clip: 'front', doing: '잠깐 멈춤', sec: [1.5, 3.5] },
  { clip: 'back', doing: '진열장 구경', sec: [3, 6] },
  { clip: 'spot', doing: '뭔가 발견', sec: [1.2, 2] },
  { clip: 'rest', doing: '잠깐 멈춤', sec: [1.5, 3.5] },
  { clip: 'idle', doing: '두리번', sec: [2, 3.5] },
];

/** 순찰 경찰이 걷다 멈춰 하는 일 (그 줄이 있는 그림만) */
const PATROL_PAUSES: { clip: string; doing: string; sec: [number, number] }[] = [
  { clip: 'radio', doing: '무전 보고', sec: [3, 5] },
  { clip: 'memo', doing: '수첩 메모', sec: [3, 5] },
  { clip: 'idle', doing: '주위를 살핌', sec: [2, 4] },
  { clip: 'spot', doing: '뭔가 발견', sec: [1.2, 2] },
];
/** 평소 거리 순찰 (C16, 10-31 사용자 「평소에도 종종 등장」): 거리 장면마다 이 초 간격으로 한 번 들어올지 굴린다 */
export const PATROL = { every: [90, 200] as [number, number], chance: 0.5, pair: 0.6, speed: [95, 115] as [number, number] };

/** 엔진 공격 판정 상자 (contract Hit의 모양만) */
export interface HitBox { x0: number; x1: number; y: number; dy?: number; z0: number; z1: number; attackId: number }

/** 한 장면의 몹 보충 규칙 (6-2장) */
export interface SpawnRule {
  scene: string;
  target: { day: number; night: number };
  refill: [number, number];
  /** 들어오고 나가는 곳 x. 생략하면 양 끝 */
  gates?: number[];
  /** 원형 이름 목록 (뽑기) */
  mix: string[];
  /** 밤(19:30~05시) 원형 목록. 없으면 mix */
  nightMix?: string[];
  /** 시간대별 유동인구 (있으면 target·mix 대신): from~to 시(자정 넘김 가능)에 장면 1,000px당 n명, mix 에서 뽑는다 */
  bands?: { from: number; to: number; n: number; mix: string[] }[];
}

/** 바깥(대사·장부·연출)에 알릴 일 */
export type SimEvent =
  | { kind: 'steal'; scene: string; thief: string; victim: string; x: number }
  | { kind: 'harass'; scene: string; who: string; target: string; x: number }
  | { kind: 'flee'; scene: string; who: string }
  | { kind: 'notice'; scene: string; who: string }
  | { kind: 'police'; scene: string; n: number }
  | { kind: 'shift'; scene: string; who: string; on: boolean }
  | { kind: 'hurt'; scene: string; who: string; id: string; named: boolean; faction?: string; x: number; down: boolean; hostile: boolean }
  /** 기절한 몹이 떨어뜨린 돈 (불량배·소매치기) */
  | { kind: 'drop'; scene: string; who: string; amount: number; stolen: number; x: number }
  /** NPC 사망 (살해 허용일 때만). 시체는 장면에 남고 경찰이 1시간 뒤 수습 */
  | { kind: 'kill'; scene: string; who: string; id: string; x: number }
  /** 시체를 본 사람: 신고(용감) */
  | { kind: 'report'; scene: string; who: string; x: number }
  /** 경찰이 시체를 수습함 */
  | { kind: 'cleared'; scene: string; n: number }
  /** 세력끼리 싸움이 붙음 (방문 대응): a = 거점 쪽, b = 방문자 */
  | { kind: 'brawl'; scene: string; a: string; af: string; b: string; bf: string; x: number }
  /** 그 싸움에서 한쪽이 쓰러지거나 달아남 */
  | { kind: 'brawlEnd'; scene: string; winner: string; loser: string; how: 'down' | 'fled' }
  /** 경계: 방문자를 내보냄 */
  | { kind: 'expel'; scene: string; who: string; by: string }
  /** 말풍선 칸 하나 (speech.ts speakCell). cell = game-src/dialogue2 칸 열쇠, ctx = 그 순간 정보(say = 대사 자료가 없을 때 쓸 글) */
  | { kind: 'cue'; scene: string; who: string; id: string; cell: string; ctx?: Record<string, string> }
  /** 동행 시작·끝 (follow·wait·return·hit = 맞아서 그만둠) */
  | { kind: 'follow'; scene: string; who: string; mode: 'follow' | 'wait' | 'return' | 'hit' }
  /** 거점 경보 켜짐·꺼짐 (why = 까닭, threat = 위협 이름 또는 {user}) */
  | { kind: 'alarm'; scene: string; faction: string; on: boolean; why: string; threat: string };

export interface SimOptions {
  spawns?: SpawnRule[];
  posts?: Post[];
  /** 그 인물(그림 열쇠)에게 그 클립이 있나. 없으면 그 활동은 꺼진다 */
  has?: (look: string, clip: string) => boolean;
  /** 장면의 소속 (거점 장면 = 그 조직 코드, 거리 = null). 경비·직원 몹의 소속이 된다 */
  sceneFaction?: (scene: string) => string | null;
  /** 세력 평판 구간 (인물 기록 factions()). 몹의 첫 반응을 정한다 (8-6장) */
  stance?: (faction: string) => 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile' | null;
  /** 설정 「필드에서 NPC 살해 허용」 (기본 끔: 체력 0 = 기절) */
  killOk?: () => boolean;
  /** 세력끼리 관계 (보는 쪽 → 대상). 없으면 기본값 (world/factions.ts) */
  relation?: (viewer: string, target: string) => Stance;
  /** 이름 인물의 호감이 적대 구간인가 (인물 기록). 없으면 아무도 아님 */
  namedHostile?: (name: string) => boolean;
}

const WALK = 150;
/** 동행 인원 상한 (core/fieldfollow MAX_FOLLOWERS 와 같음) */
export const MAX_FOLLOW = 4;
/** 동행: 주인공 뒤 첫 사람 거리, 사람마다 더 벌어지는 거리 */
const FOLLOW_GAP = [95, 55] as const;
const MARGIN = 60;
const NOTICE_PX = 280;
/** 한 장면에 남는 시체 상한 (넘치면 오래된 것부터 치움) */
export const CORPSE_MAX = 5;
/** 시체 수습까지 게임 시간 (시간) */
export const CLEAR_HOURS = 1;
/** 수습 뒤 「사건 현장」으로 사람이 덜 들어오는 게임 시간 (시간) */
export const INCIDENT_HOURS = 24;
/** 시체를 알아보는 거리 */
const SEE_BODY_PX = 260;
/** 기절 직후 죽지 않는 초 (연타 마지막 대에 실수로 죽지 않게) */
export const KO_GRACE = 2;
/** 이름 인물: 화난 뒤 이 초 안에 또 맞으면 맞서 싸운다 (C4, 10-31 사용자 가안) */
export const NAMED_FIGHT_SEC = 6;
/** 소란도 단계 문턱 (0~100 → 0~3) */
export const UPROAR_STEPS = [20, 50, 80];
let serial = 0;

export class WorldSim {
  readonly actors: Actor[] = [];
  readonly events: SimEvent[] = [];
  private spawnT = new Map<string, number>();
  /** 거리 장면마다 다음 순찰을 굴릴 때까지 초 */
  private patrolT = new Map<string, number>();
  private uproar = new Map<string, { v: number; x: number }>();
  /** 실제로 흐른 생활 초 */
  time = 0;
  private hour: number | null = null;
  private player: { scene: string; x: number; y: number; seat?: number | null; armed?: boolean; face?: number } | null = null;
  readonly spawns: SpawnRule[];
  readonly posts: Post[];
  private has: (look: string, clip: string) => boolean;
  constructor(readonly graph: PlaceGraph, readonly rng: Rng, opts: SimOptions | SpawnRule[] = {}) {
    const o = Array.isArray(opts) ? { spawns: opts } : opts;
    this.spawns = o.spawns ?? [];
    this.posts = o.posts ?? [];
    this.has = o.has ?? (() => false);
    this.sceneFaction = o.sceneFaction ?? (() => null);
    this.stance = o.stance ?? (() => null);
    this.killOk = o.killOk ?? (() => false);
    this.relation = o.relation ?? defaultRelation;
    this.namedHostile = o.namedHostile ?? (() => false);
  }
  private namedHostile: (name: string) => boolean;
  private relation: (viewer: string, target: string) => Stance;
  private killOk: () => boolean;
  /** 게임 시간 누계(시간). 필드 시계가 움직인 만큼만 흐른다 (시계 없으면 실시간 3분 = 1시간) */
  gameH = 0;
  /** 경찰이 와서 라인을 친 장면 */
  private cordoned = new Set<string>();
  /** 사건 현장: 수습한 게임 시각 */
  private sites = new Map<string, number>();
  private sceneFaction: (scene: string) => string | null;
  private stance: (faction: string) => 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile' | null;
  /** 몹의 소속: 경비·직원(근무형·staff·guard)은 장면 소속, 나머지는 없음 */
  mobFaction(a: Actor): string | null {
    if (a.def.kind !== 'mob') return null;
    if (a.def.faction) return a.def.faction;
    const role = ARCHETYPES[a.def.archetype ?? a.def.name]?.role;
    return a.post || role === 'guard' || role === 'staff' ? this.sceneFaction(a.scene) : null;
  }

  // ── 바깥에서 부르는 것 ──

  add(def: ActorDef, at?: { scene?: string; x?: number; y?: number }): Actor {
    const scene = at?.scene ?? def.home;
    const p = this.randomSpot(scene);
    const a: Actor = {
      def, scene, x: at?.x ?? p.x, y: at?.y ?? p.y, face: this.rng() < 0.5 ? 1 : -1, act: 'idle', doing: '대기', goal: null, route: [],
      wait: range(this.rng, 0.5, 4), plan: 'none', run: 1, clip: 'idle', clipAt: this.time, iconT: 0, sayT: 0, noticeCd: 0, think: range(this.rng, 1, 4),
      phase: this.rng() * Math.PI * 2, pauseCd: range(this.rng, 4, 18),
    };
    if (def.kind === 'named' && def.brain === 'needs') a.needs = fullNeeds(this.rng);
    if (def.kind === 'mob') {
      const arch = ARCHETYPES[def.archetype ?? def.name];
      a.temper = rollTemper(this.rng, arch);
      // NPC 퍽: 경찰은 전부, 나머지는 역할·성격으로 무작위. 성격에 얹는 퍽은 바로 (겁쟁이·깡다구·손버릇·구경꾼)
      a.perks = rollNpcPerks(this.rng, catOf(arch?.role), a.temper);
      applyTemper(a.perks, a.temper);
      a.drunk = !!arch?.drinks && this.isNight() && this.rng() < 0.35;
      // 몸: 한 명마다 힘민체지정(합 25 무작위)을 굴리고 체력은 그 공식으로 (10-30 사용자). 주머니 돈 (백 원 단위)
      a.base = rollBase(this.rng);
      a.hpMax = a.hp = derive(a.base).hp;
      const pk = POCKET[def.archetype ?? def.name];
      a.pocket = pk ? Math.round(range(this.rng, pk[0], pk[1]) / 100) * 100 : 0;
      if (a.perks.includes('주머니 두둑')) a.pocket *= 2;
    }
    this.actors.push(a);
    return a;
  }
  remove(id: string): void {
    const i = this.actors.findIndex((a) => a.def.id === id);
    if (i >= 0) this.actors.splice(i, 1);
  }
  private blocks = new Map<string, Obstacle[]>();
  /** 막힌 곳 놓기·치우기 (box = null 이면 치움). 걷는 사람은 돌아가고, wall 이면 돌아선다 */
  setObstacle(scene: string, box: Obstacle | null, id = box?.id ?? ''): void {
    const list = (this.blocks.get(scene) ?? []).filter((b) => b.id !== id);
    if (box) list.push(box);
    if (list.length) this.blocks.set(scene, list);
    else this.blocks.delete(scene);
  }
  obstacles(scene: string): readonly Obstacle[] {
    return this.blocks.get(scene) ?? [];
  }
  inScene(scene: string): Actor[] {
    return this.actors.filter((a) => a.scene === scene && a.act !== 'door' && a.act !== 'gone' && !a.fighting);
  }
  /** 전투 AI로 넘길 행위자: 주인공을 막아선 몹(적대 세력·경찰·시비 뒤 맞섬) */
  challengers(scene: string): Actor[] {
    return this.inScene(scene).filter((a) => (a.plan === 'chase' && !a.target && a.act === 'watch') || (a.act === 'argue' && a.doing === '맞섬'));
  }
  /** 전투 AI 몸으로 넘김 (돌아올 때까지 시뮬에서 뺌) */
  toFight(id: string): Actor | null {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || a.fighting) return null;
    a.fighting = true;
    a.goal = null;
    a.route = [];
    // 패거리(불량배): 같은 장면 불량배 둘까지 같이 덤빈다. 호출(경비): 한 번 경비 1명을 부른다
    if (this.perk(a, '패거리')) {
      const mates = this.inScene(a.scene).filter((q) => q !== a && !q.fighting && ['walk', 'idle', 'pause', 'watch'].includes(q.act) && ARCHETYPES[q.def.archetype ?? '']?.role === 'thug').slice(0, 2);
      for (const q of mates) { q.act = 'argue'; q.doing = '맞섬'; q.wait = 3; q.goal = null; this.iconOn(q, '#', 2); }
    }
    if (this.once(a, '호출')) this.reinforce(a.scene, '경비', this.player?.x ?? a.x);
    return a;
  }
  /** 전투에서 돌아옴. down = 쓰러뜨림(기절 → 깨면 떠남), 아니면 싸움이 끊긴 것(주인공이 장면을 떠남 등) */
  fromFight(id: string, x: number, y: number, down: boolean | 'dead' | 'deadLying'): void {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || !a.fighting) return;
    a.fighting = false;
    a.blockAt = this.time;
    a.x = x;
    a.y = y;
    a.plan = 'none';
    if (down === 'dead' || down === 'deadLying') {
      a.hp = 0;
      this.kill(a, down === 'deadLying', true);
      return;
    }
    if (down) {
      a.hp = 0;
      this.struck(a, a.face, true);
      this.crime(a.scene, a.x, 15);
      this.playerViolence(a.scene, a.x, a, 'assault');
      return;
    }
    a.act = 'idle';
    a.wait = 0.5;
    this.setClip(a, 'idle');
  }
  /** 소란 (플레이어가 몹을 때림·물건 부숨 등). amount 0~100 */
  disturb(scene: string, amount: number, x: number): void {
    const u = this.uproar.get(scene) ?? { v: 0, x };
    u.v = Math.min(100, u.v + amount);
    u.x = x;
    this.uproar.set(scene, u);
  }
  uproarLevel(scene: string): 0 | 1 | 2 | 3 {
    const v = this.uproar.get(scene)?.v ?? 0;
    return (UPROAR_STEPS.filter((s) => v >= s).length) as 0 | 1 | 2 | 3;
  }
  uproarValue(scene: string): number {
    return this.uproar.get(scene)?.v ?? 0;
  }
  /** 플레이어 범죄 → 경찰(거리)·경비(거점)가 출입구로 들어와 플레이어에게 간다 (8-4장) */
  crime(scene: string, x: number, severity = 20): void {
    this.disturb(scene, severity, x);
    const len = this.graph.scene(scene)?.length ?? 1280;
    const street = this.graph.kind(scene) === 'street';
    const n = 1 + this.uproarLevel(scene);
    // 순찰 중인 경찰이 그 장면에 있으면 그들이 먼저 달려온다 (C16)
    for (const p of this.actors.filter((q) => q.scene === scene && q.patrol && q.plan !== 'chase' && !q.fighting && !['down', 'dead', 'gone'].includes(q.act))) {
      p.plan = 'chase';
      p.run = 1.4;
      p.buddy = undefined;
      this.walkTo(p, { x, y: p.y }, '현장으로 달려감', 'chase');
      this.iconOn(p, '!', 3);
      this.say(p, '거기 멈춰!', 2);
    }
    const have = this.actors.filter((a) => a.scene === scene && a.plan === 'chase').length;
    for (let i = have; i < n; i++) {
      const gate = Math.abs(x - 30) > Math.abs(x - (len - 30)) ? 30 : len - 30;
      const arch = street ? '경찰' : '경비';
      const a = this.add({ id: `mob${++serial}`, name: arch, kind: 'mob', brain: 'transit', home: scene, archetype: arch, look: this.lookOf(arch), speed: 170 }, { scene, x: gate, y: this.laneMid(scene) });
      a.plan = 'chase';
      a.run = 1.4;
      this.walkTo(a, { x, y: a.y }, '플레이어에게 가는 중', 'chase');
      this.iconOn(a, '!', 3);
    }
    this.events.push({ kind: 'police', scene, n });
  }
  /**
   * 주인공 공격 판정이 행위자에 닿았나 (필드에는 전투 몸이 아닌 행위자도 맞는다).
   * 몹: 쓰러졌다 일어나 도망(겁) 또는 맞섬, 소란 +15, 범죄로 경찰·경비 출동. 이름 인물: 화내고 사건으로 알림.
   */
  hitBoxes(scene: string, boxes: HitBox[], dir: 1 | -1): Actor[] {
    const out: Actor[] = [];
    for (const a of this.inScene(scene)) {
      if (a.act === 'dead') continue;
      for (const b of boxes) {
        if (a.hitBy === b.attackId) continue;
        if (a.x + 30 < b.x0 || a.x - 30 > b.x1 || Math.abs(a.y - b.y) > (b.dy ?? 18) + 14 || b.z0 > 200) continue;
        a.hitBy = b.attackId;
        out.push(a);
        this.struck(a, dir, this.hostile(a));
        break;
      }
    }
    if (out.length) this.crime(scene, out[0].x, 15 * out.length);
    if (out.length) this.playerViolence(scene, out[0].x, out[0], 'assault');
    return out;
  }
  /** 행위자 하나를 맞힘 (에일린 코어 표적 경로). 같은 틱 여러 번은 hitBy로 거른다 */
  hitActor(id: string, dir: 1 | -1, attackId: number, dmg = 12, lethal = false): boolean {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || a.act === 'gone' || a.act === 'door' || a.hitBy === attackId) return false;
    if (a.act === 'dead') return false;
    // 이미 기절해 쓰러진 몹: 살해 허용이고 기절 2초 뒤 무기 쪽 공격(lethal)이면 누운 채 사망(45). 맨손·연타 중엔 기절 그대로 (10-30)
    if (a.def.kind === 'mob' && (a.hp ?? 1) <= 0) {
      if (!this.killOk() || !lethal || this.time - (a.downAt ?? this.time) < KO_GRACE) return false;
      a.hitBy = attackId;
      this.kill(a, true);
      return true;
    }
    a.hitBy = attackId;
    if (a.def.kind === 'mob' && a.hp !== undefined) a.hp = Math.max(0, a.hp - dmg);
    this.struck(a, dir, this.hostile(a));
    this.crime(a.scene, a.x, 15);
    this.playerViolence(a.scene, a.x, a, 'assault');
    return true;
  }
  private perk(a: Actor, name: string): boolean {
    return !!a.perks?.includes(name);
  }
  /** 한 번만 쓰는 퍽: 처음이면 true (쓴 것으로 적는다) */
  private once(a: Actor, name: string): boolean {
    if (!this.perk(a, name) || a.used?.includes(name)) return false;
    (a.used ??= []).push(name);
    return true;
  }
  /** 경찰·경비 한 명을 장면 끝 출입구에서 주인공 쪽으로 (지원 요청·호출) */
  private reinforce(scene: string, arch: '경찰' | '경비', x: number): void {
    const len = this.graph.scene(scene)?.length ?? 1280;
    const gate = Math.abs(x - 30) > Math.abs(x - (len - 30)) ? 30 : len - 30;
    const c = this.add({ id: `mob${++serial}`, name: arch, kind: 'mob', brain: 'transit', home: scene, archetype: arch, look: this.lookOf(arch), speed: 170 }, { scene, x: gate, y: this.laneMid(scene) });
    c.plan = 'chase';
    c.run = 1.4;
    this.walkTo(c, { x, y: c.y }, arch === '경찰' ? '지원 출동' : '호출받고 오는 중', 'chase');
    this.iconOn(c, '!', 3);
  }
  /** 지원 요청(경찰 퍽): 싸우던 경찰 체력이 절반 아래 → 한 번 경찰 1명을 더 부른다 (전투 쪽에서 부름) */
  backup(id: string): void {
    const a = this.actors.find((q) => q.def.id === id);
    if (a && this.once(a, '지원 요청')) this.reinforce(a.scene, '경찰', this.player?.x ?? a.x);
  }
  /** 맞기 전에 이미 주인공에게 맞서던 몸인가 (막아섬·시비 뒤 맞섬): 먼저 친 게 누구인지 기록용 */
  private hostile(a: Actor): boolean {
    return a.plan === 'chase' || (a.act === 'argue' && a.doing === '맞섬') || (a.act === 'watch' && a.doing === '막아섬');
  }
  /** 맞음: 앉아 있었으면(의자·화장실) 굴러떨어지기(169) → 일어나기 → 반응, 누워 있었으면 누운 채 움찔(43) → 반응 (10-31 사용자: 앉은 피격은 굴러떨어지기로 통일) */
  private struck(a: Actor, dir: 1 | -1, hostile = false): void {
    // 서서 소변(100)은 앉은 게 아니라 그냥 피격 자세로 (10-31 사용자)
    const seated = !!a.seat || (a.act === 'do' && (a.clip === 'poo' || (a.clip === 'pee' && !this.canClip(a, 'line:100'))));
    const lying = a.clip === 'lie' || a.clip === 'treat';
    this.struckCore(a, dir, hostile);
    const react = a.clip;
    const seq: { clip: string; sec: number }[] = [];
    if (seated && this.canClip(a, 'line:169')) seq.push({ clip: 'line:169', sec: 1.6 }, ...(this.canClip(a, 'getup') ? [{ clip: 'getup', sec: 1 }] : []));
    else if (lying && this.canClip(a, 'line:43')) seq.push({ clip: 'line:43', sec: 0.9 });
    if (!seq.length) return;
    this.setClip(a, seq[0].clip);
    a.clipQ = [...seq.slice(1), { clip: react, sec: 0 }];
    a.clipQT = seq[0].sec;
    a.wait += seq.reduce((n, s) => n + s.sec, 0);
  }
  private struckCore(a: Actor, dir: 1 | -1, hostile = false): void {
    a.seatPick = undefined;
    a.x += dir * 36;
    a.face = (-dir) as 1 | -1;
    a.goal = null;
    a.route = [];
    // 몹: 체력이 바닥나면 기절(쓰러져 오래 누움), 아니면 휘청. 체력 0은 살해 허용이어도 먼저 기절
    const down = (a.hp ?? 1) <= 0;   // 몹·이름 인물(싸움에서 진 뒤)
    if (down && a.pocket && (DROPS.has(a.def.archetype ?? '') || a.stolen)) {
      this.events.push({ kind: 'drop', scene: a.scene, who: a.def.name, amount: a.pocket, stolen: a.stolen ?? 0, x: a.x });
      a.pocket = 0;
      a.stolen = 0;
    }
    this.events.push({ kind: 'hurt', scene: a.scene, who: a.def.name, id: a.def.id, named: a.def.kind === 'named', x: a.x, down, hostile });
    // 이름 인물 (C4, 10-31 사용자 가안): 첫 대는 화내고, NAMED_FIGHT_SEC 안에 또 맞으면 맞서 싸운다(전투 AI 몸, 그 인물 그림·능력치 표 ×1.5).
    // 싸움에서 체력 0이 되면 아래 몹처럼 기절
    if (a.def.kind === 'named' && !(a.hp !== undefined && a.hp <= 0)) {
      const again = a.angryAt !== undefined && this.time - a.angryAt < NAMED_FIGHT_SEC;
      a.angryAt = this.time;
      a.act = 'argue';
      a.doing = again ? '맞섬' : '맞고 화남';
      a.wait = 3;
      if (again) a.perks ??= ['스탯 뻥튀기', '체력 뻥튀기'];
      this.setClip(a, this.canClip(a, 'angry') ? 'angry' : 'idle');
      this.iconOn(a, '#', 3);
      return;
    }
    a.act = 'down';
    a.doing = down ? '기절' : '휘청';
    if (down) a.downAt = this.time;
    a.wait = down ? 6 : 0.6;
    this.setClip(a, down && this.canClip(a, 'down') ? 'down' : 'idle');
    this.iconOn(a, '!', 1.5);
  }

  /** 행위자 말풍선 (대사 연결이 부른다) */
  say(a: Actor, text: string, sec = 3.2): void {
    a.say = text;
    a.sayT = sec;
  }
  isNight(): boolean {
    return this.hour != null && (this.hour >= 19.5 || this.hour < 5);
  }

  randomSpot(scene: string): { x: number; y: number } {
    const s = this.graph.scene(scene);
    const [top, bot] = this.graph.lane(scene);
    const len = s?.length ?? 1280;
    return { x: range(this.rng, MARGIN, Math.max(MARGIN + 1, len - MARGIN)), y: range(this.rng, top + 20, bot - 10) };
  }
  private laneMid(scene: string): number {
    const [top, bot] = this.graph.lane(scene);
    return range(this.rng, top + 20, bot - 10);
  }

  /** 생활 시간을 dt초 진행. player = 보이는 장면과 주인공 발, hour = 필드 시(모르면 null) */
  step(dt: number, player?: { scene: string; x: number; y?: number; hour?: number | null; seat?: number | null; armed?: boolean; face?: number }): void {
    this.time += dt;
    const h = player?.hour ?? null;
    if (h != null && this.hour != null) this.gameH += (h - this.hour + 24) % 24;
    else if (h == null) this.gameH += dt / 180;
    this.hour = h;
    // 끈질긴 추적(경찰 퍽): 주인공이 장면을 옮기면 쫓던 경찰이 한 번 따라 들어온다
    const was = this.player?.scene;
    if (player && was && was !== player.scene) {
      for (const a of this.actors.filter((q) => q.scene === was && q.plan === 'chase' && !q.fighting)) {
        if (!this.once(a, '끈질긴 추적')) continue;
        const len = this.graph.scene(player.scene)?.length ?? 1280;
        a.scene = player.scene;
        a.x = Math.abs(player.x - 30) > Math.abs(player.x - (len - 30)) ? 30 : len - 30;
        a.y = player.y ?? this.laneMid(player.scene);
        a.route = [];
        this.walkTo(a, { x: player.x, y: a.y }, '쫓아옴', 'chase');
        this.iconOn(a, '!', 2);
      }
    }
    // 동행: 주인공이 장면을 옮기면 같이 들어온다. 발자국은 새 장면에서 다시
    if (player && was && was !== player.scene) {
      this.trail = [];
      for (const id of this.followers) {
        const a = this.actors.find((q) => q.def.id === id);
        if (a && a.scene === was && !a.fighting && !['down', 'dead', 'gone'].includes(a.act)) this.joinScene(a, player.scene, player.x, player.y ?? 0);
      }
    }
    if (player) {
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.abs(last.x - player.x) > 4 || Math.abs(last.y - (player.y ?? 0)) > 4 || this.time - last.t > 0.5) this.trail.push({ t: this.time, x: player.x, y: player.y ?? 0 });
      while (this.trail.length > 2 && this.time - this.trail[0].t > 6) this.trail.shift();
    }
    this.player = player ? { scene: player.scene, x: player.x, y: player.y ?? 0, seat: player.seat ?? null, armed: !!player.armed, face: player.face ?? 1 } : null;
    for (const [s, u] of this.uproar) {
      u.v = Math.max(0, u.v - (player?.scene === s ? 1.5 : 5) * dt);
      if (u.v <= 0) this.uproar.delete(s);
    }
    for (const a of [...this.actors]) if (!a.fighting) this.stepActor(a, dt);
    for (let i = this.actors.length - 1; i >= 0; i--) if (this.actors[i].act === 'gone') this.actors.splice(i, 1);
    this.stepCorpses();
    for (const r of this.spawns) this.stepSpawn(r, dt);
    for (const p of this.posts) this.stepPost(p);
    this.stepPatrol(dt);
    if ((this.visitT -= dt) <= 0) { this.visitT = 0.5; this.stepVisitors(0.5); this.stepPlayerVisit(0.5); }
    this.stepAlarms(dt);
  }

  // ── 방문 대응 (10-31 사용자, 살아 있는 세상 4단계): 다른 세력 사람이 세력 거점 장면에 들어오면 거점 사람들이 세력 관계대로 ──
  // 우호·호의 = 인사, 중립 = 무시, 경계 = 경비가 따라붙어 지켜보다 경고 → 내보냄, 적대 = 경비·전투원이 막아서 싸우고 비전투원은 겁먹고 피함.
  // 관계는 세력 평판 기능이 켜져 있으면 플러그인 세력 관계 표, 꺼져 있으면 기본값(큰 세력 셋 서로 적대). 주인공 대응은 따로(세력 평판 구간, mobThink)
  private visitT = 0;
  /** 그 사람의 소속: 따로 정한 세력 → 근무형·경비·직원은 장면 소속 */
  factionOf(a: Actor): string | null {
    return a.def.faction ?? this.mobFaction(a);
  }
  /** 싸울 수 있는 몸인가 (경비·경찰·불량배·관리국 요원·이름 인물·다른 세력 방문자) */
  private combatant(a: Actor): boolean {
    const role = ARCHETYPES[a.def.archetype ?? '']?.role;
    return a.def.kind === 'named' || !!a.def.faction || role === 'guard' || role === 'police' || role === 'thug';
  }
  private free(a: Actor): boolean {
    return !a.brawl && !a.fighting && !['down', 'dead', 'gone', 'door', 'scared'].includes(a.act) && a.plan !== 'chase' && a.plan !== 'cordon';
  }
  /** 다른 세력 방문자를 들여보낸다 (C15 세력 NPC 배치·시험이 부른다) */
  spawnVisitor(scene: string, archetype: string, faction: string, x?: number): Actor {
    const len = this.graph.scene(scene)?.length ?? 1280;
    const arch = ARCHETYPES[archetype];
    const a = this.add({ id: `mob${++serial}`, name: archetype, kind: 'mob', brain: 'transit', home: scene, archetype, look: arch?.looks?.length ? pick(this.rng, arch.looks) : archetype, faction }, { scene, x: x ?? 60, y: this.laneMid(scene) });
    a.exitAt = { x: len - 60, y: a.y };
    this.walkTo(a, a.exitAt, '둘러보는 중', 'exit');
    return a;
  }
  private stepVisitors(dt: number): void {
    // 따라붙던 방문자가 나갔거나 쫓겨 나가는 중이면 경비는 자리로
    for (const e of this.actors) {
      if (!e.escort || e.escort === 'player') continue;   // 주인공 경계는 stepPlayerVisit
      const v = this.actors.find((q) => q.def.id === e.escort);
      if (v && v.scene === e.scene && v.act !== 'gone' && !(v.plan === 'exit' && (v.stay ?? 0) < 0)) continue;
      e.escort = undefined;
      if (e.post) this.goPost(e);
      else this.resume(e);
    }
    const scenes = new Set(this.actors.map((a) => a.scene));
    for (const scene of scenes) {
      const home = this.sceneFaction(scene);
      if (!home) continue;
      const here = this.inScene(scene).filter((a) => !a.brawl);
      const visitors = here.filter((v) => { const f = this.factionOf(v); return !!f && f !== home && this.free(v); });
      if (!visitors.length) continue;
      const ours = here.filter((q) => this.factionOf(q) === home && this.free(q));
      for (const v of visitors) {
        const st = this.relation(home, this.factionOf(v)!);
        const near = (ok: (q: Actor) => boolean, d = 520) => ours.filter((q) => ok(q) && Math.abs(q.x - v.x) < d).sort((p, q) => Math.abs(p.x - v.x) - Math.abs(q.x - v.x));
        if (st === 'friendly' || st === 'favorable') {
          const g = near((q) => !q.greeted?.includes(v.def.id) && q.act !== 'notice', 400)[0];
          if (!g) continue;
          (g.greeted ??= []).push(v.def.id);
          g.act = 'notice';
          g.doing = '방문자에게 인사';
          g.goal = null;
          g.face = v.x > g.x ? 1 : -1;
          g.wait = 2.2;
          this.setClip(g, this.canClip(g, 'greet') ? 'greet' : 'idle');
          this.say(g, st === 'friendly' ? '오셨어요!' : '안녕하세요.', 2);
          continue;
        }
        if (st === 'wary') {
          // 경비 하나가 따라붙어 지켜보고, 오래 머물면 경고 → 내보낸다
          let e = ours.find((q) => q.escort === v.def.id);
          if (!e) {
            e = near((q) => !q.escort && ARCHETYPES[q.def.archetype ?? '']?.role === 'guard', 2000)[0];
            if (!e) continue;
            e.escort = v.def.id;
            this.iconOn(e, '!', 1.5);
          }
          if (Math.abs(e.x - v.x) > 140) {
            this.walkTo(e, { x: v.x + (e.x < v.x ? -90 : 90), y: v.y }, '방문자를 따라감', 'none');
          } else if (e.act !== 'watch') {
            e.act = 'watch';
            e.doing = '방문자 경계';
            e.goal = null;
            e.wait = 1;
            e.face = v.x > e.x ? 1 : -1;
            this.setClip(e, 'idle');
          }
          v.stay = (v.stay ?? 0) + dt;
          if (v.stay >= 6 && v.stay - dt < 6) this.say(e, '여긴 관계자 외 출입 금지입니다.', 2.5);
          if (v.stay >= 14) {
            this.say(e, '나가 주시죠.', 2);
            v.exitAt = this.gateFar(v, e.x);
            this.walkTo(v, v.exitAt, '쫓겨남', 'exit');
            v.plan = 'exit';
            v.stay = -1e9;
            this.events.push({ kind: 'expel', scene, who: v.def.name, by: e.def.name });
          }
          continue;
        }
        if (st !== 'hostile') continue;
        // 적대 방문자 = 들어오자마자 거점 경보 (10-31 사용자: 싸움 전이라도). 경보가 모든 방의 전투원을 모은다
        this.raiseAlarm(scene, v.x, v.def.id, 'intruder');
        // 적대: 싸울 수 있는 우리 쪽이 둘까지 붙는다. 비전투원은 겁먹고 피한다
        const fighters = near((q) => this.combatant(q), 2000).slice(0, 2);
        for (const q of ours) if (!this.combatant(q) && Math.abs(q.x - v.x) < 500 && q.def.kind === 'mob' && !q.post) this.scareAt(q, v.x);
        if (!fighters.length) continue;
        for (const f of fighters) this.startBrawl(f, v);
        // 방문자: 싸울 수 있으면 맞서고, 아니면 달아난다
        if (this.combatant(v) && (v.temper?.courage ?? 0.7) >= 0.35) this.startBrawl(v, fighters[0]);
        else this.flee(v, fighters[0].x);
        this.disturb(scene, 25, v.x);
        this.events.push({ kind: 'brawl', scene, a: fighters[0].def.name, af: home, b: v.def.name, bf: this.factionOf(v)!, x: v.x });
      }
    }
  }
  private startBrawl(a: Actor, foe: Actor): void {
    if (a.brawl) return;
    a.brawl = { foe: foe.def.id, t: range(this.rng, 0.4, 0.9) };
    a.escort = undefined;
    a.goal = null;
    a.route = [];
    a.seatPick = undefined;
    a.doing = `${foe.def.name}와 싸움`;
    this.iconOn(a, '#', 2);
    // 이름 인물은 체력이 없으면 표(×1.5, 10-31 이름 인물 퍽)로
    if (a.hp === undefined) { a.base ??= baseOf(a.def.look ?? a.def.name); a.hpMax = a.hp = Math.round(derive(a.base).hp * (a.def.kind === 'named' ? NAMED_MUL.hp : 1)); }
  }
  private endBrawl(a: Actor): void {
    a.brawl = undefined;
    a.run = 1;
    if (a.post) return this.goPost(a);
    this.resume(a);
  }
  /** NPC끼리 싸움 한 틱: 붙을 때까지 다가가고, 붙으면 0.9~1.4초마다 한 대 (피해 = 힘·받는 피해 공식). 체력 0 = 기절, 겁 많으면 30% 아래서 달아남 */
  private stepBrawl(a: Actor, dt: number): void {
    const f = this.actors.find((q) => q.def.id === a.brawl!.foe);
    if (!f || f.scene !== a.scene || ['down', 'dead', 'gone', 'door'].includes(f.act) || f.fighting || (f.plan === 'exit' && f.act === 'walk' && !f.brawl)) return this.endBrawl(a);
    if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = undefined;
    if (a.iconT > 0 && (a.iconT -= dt) <= 0) a.icon = undefined;
    a.face = f.x > a.x ? 1 : -1;
    const gap = Math.abs(f.x - a.x);
    if (gap > 80 || Math.abs(f.y - a.y) > 24) {
      const sp = (a.def.speed ?? WALK) * 1.4 * dt;
      a.x += Math.sign(f.x - a.x) * Math.min(sp, Math.max(0, gap - 70));
      a.y += Math.sign(f.y - a.y) * Math.min(sp * 0.5, Math.abs(f.y - a.y));
      a.act = 'walk';
      if (a.clip !== 'walk') this.setClip(a, 'walk');
      return;
    }
    a.act = 'argue';
    if ((a.brawl!.t -= dt) > 0) { if (a.clip === 'walk') this.setClip(a, 'idle'); return; }
    a.brawl!.t = range(this.rng, 0.9, 1.4);
    this.setClip(a, this.canClip(a, 'strike') ? 'strike' : 'idle');
    const ab = a.base ?? baseOf(a.def.look), fb = f.base ?? baseOf(f.def.look);
    const dmg = Math.round(60 * derive(ab).power * derive(fb).taken * range(this.rng, 0.8, 1.2));
    if (f.hp === undefined) this.startBrawl(f, a);
    f.hp = Math.max(0, (f.hp ?? 0) - dmg);
    f.x += a.face * 10;
    if (f.hp <= 0) {
      f.brawl = undefined;
      f.act = 'down';
      f.doing = '기절';
      f.downAt = this.time;
      f.wait = range(this.rng, 15, 25);
      f.goal = null;
      this.setClip(f, this.canClip(f, 'down') ? 'down' : 'idle');
      this.events.push({ kind: 'brawlEnd', scene: a.scene, winner: a.def.name, loser: f.def.name, how: 'down' });
      return this.endBrawl(a);
    }
    if (f.hpMax && f.hp < f.hpMax * 0.3 && (f.temper?.courage ?? 0.7) < 0.5) {
      f.brawl = undefined;
      this.flee(f, a.x);
      this.events.push({ kind: 'brawlEnd', scene: a.scene, winner: a.def.name, loser: f.def.name, how: 'fled' });
      return this.endBrawl(a);
    }
    if (!f.brawl) this.startBrawl(f, a);
  }

  /** 평소 거리 순찰 (C16): 거리 장면마다 가끔 경찰 1~2명이 한쪽 끝에서 들어와 천천히 걸어 반대쪽으로 나간다.
   *  걷다 무전·메모·두리번. 순찰이 있는 동안 그 장면에선 소매치기·시비를 안 벌이고, 범죄가 나면 먼저 달려온다(crime). 시체를 보면 현장을 맡는다 */
  private stepPatrol(dt: number): void {
    for (const r of this.spawns) {
      const scene = r.scene;
      if (this.graph.kind(scene) !== 'street') continue;
      const left = (this.patrolT.get(scene) ?? range(this.rng, PATROL.every[0], PATROL.every[1]) * 0.5) - dt;
      if (left > 0) { this.patrolT.set(scene, left); continue; }
      this.patrolT.set(scene, range(this.rng, PATROL.every[0], PATROL.every[1]));
      // 이미 경찰이 있거나(순찰·출동·현장) 소란이 크면 건너뜀
      if (this.actors.some((a) => a.scene === scene && a.def.archetype === '경찰' && a.act !== 'gone') || this.uproarLevel(scene) >= 2) continue;
      if (this.rng() >= PATROL.chance) continue;
      this.spawnPatrol(scene, r.gates);
    }
  }
  /** 순찰 경찰 한 조를 들여보낸다 (시험·개발 도구도 부른다). 들어온 사람들 */
  spawnPatrol(scene: string, gates?: number[]): Actor[] {
    const len = this.graph.scene(scene)?.length ?? 1280;
    const gs = gates?.length ? gates : [30, len - 30];
    const px = this.player?.scene === scene ? this.player.x : null;
    // 보이는 장면이면 주인공에서 먼 쪽 출입구로 (갑자기 옆에 생기지 않게)
    const from = px === null ? pick(this.rng, gs) : [...gs].sort((p, q) => Math.abs(q - px) - Math.abs(p - px))[0];
    const to = gs.filter((g) => g !== from).sort((p, q) => Math.abs(q - from) - Math.abs(p - from))[0] ?? (from < len / 2 ? len - 30 : 30);
    const [top, bot] = this.graph.lane(scene);
    const y = range(this.rng, top + 30, bot - 30);
    const speed = range(this.rng, PATROL.speed[0], PATROL.speed[1]);
    const out: Actor[] = [];
    const n = this.rng() < PATROL.pair ? 2 : 1;
    const arch = ARCHETYPES['경찰'];
    for (let i = 0; i < n; i++) {
      const dy = i === 0 ? 0 : y - top > bot - y ? -26 : 26;
      const a = this.add({ id: `mob${++serial}`, name: '경찰', kind: 'mob', brain: 'transit', home: scene, archetype: '경찰', look: arch?.looks?.length ? pick(this.rng, arch.looks) : '경찰', speed }, { scene, x: from - (i ? Math.sign(to - from) * 24 : 0), y: y + dy });
      a.patrol = true;
      a.exitAt = { x: to, y: y + dy };
      if (i && out[0]) { a.buddy = out[0].def.id; a.buddyDy = dy; }
      this.walkTo(a, a.exitAt, i ? '동료와 순찰' : '순찰 중', 'exit');
      out.push(a);
    }
    return out;
  }
  /** 원형의 그림 하나 (원형 이름 = 실루엣이라 그림 목록에서 고른다) */
  private lookOf(arch: string): string {
    const l = ARCHETYPES[arch]?.looks;
    return l?.length ? pick(this.rng, l) : arch;
  }
  // ── 경보 (10-31 사용자 결정 docs/필드기능_결정_1031.md 9번): 거점 전체 상태. 켜지면 경비·전투 가능한 요원이 위협에게 몰려가 공격, 비전투원은 피함 ──
  /** 거점 세력 → 경보 (threats = 'player' 또는 행위자 id) */
  readonly alarms = new Map<string, { scene: string; x: number; threats: string[]; quiet: number; tick: number; why: string }>();
  /** 위협이 사라지고 이만큼(초) 지나면 해제 */
  static ALARM_CLEAR = 15;
  /** 그 거점 세력의 경보 (없으면 null) */
  alarmOf(faction: string | null | undefined): { scene: string; x: number; threats: string[]; why: string } | null {
    return faction ? this.alarms.get(faction) ?? null : null;
  }
  /** 장면이 경보 중인 거점인가 */
  alarmIn(scene: string): boolean {
    return !!this.alarmOf(this.sceneFaction(scene));
  }
  /** 경보를 켠다 (이미 켜져 있으면 위협만 더한다). threat = 'player' 또는 행위자 id */
  raiseAlarm(scene: string, x: number, threat: string, why: string): void {
    const fac = this.sceneFaction(scene);
    if (!fac) return;
    let al = this.alarms.get(fac);
    if (!al) {
      al = { scene, x, threats: [], quiet: 0, tick: 0, why };
      this.alarms.set(fac, al);
      const t = threat === 'player' ? '{user}' : this.actors.find((q) => q.def.id === threat)?.def.name ?? threat;
      this.events.push({ kind: 'alarm', scene, faction: fac, on: true, why, threat: t });
    }
    if (!al.threats.includes(threat)) { al.threats.push(threat); al.tick = 0; }   // 새 위협이면 바로 모은다
    al.scene = scene;
    al.x = x;
    al.quiet = 0;
  }
  /** 위협이 아직 거점 안에 있나 */
  private threatAt(fac: string, t: string): { scene: string; x: number; y: number; actor?: Actor } | null {
    if (t === 'player') {
      const p = this.player;
      return p && this.sceneFaction(p.scene) === fac ? { scene: p.scene, x: p.x, y: p.y } : null;
    }
    const a = this.actors.find((q) => q.def.id === t);
    if (!a || a.fighting || ['down', 'dead', 'gone'].includes(a.act) || (a.plan === 'exit' && a.doing === '쫓겨남') || this.sceneFaction(a.scene) !== fac) return null;
    return { scene: a.scene, x: a.x, y: a.y, actor: a };
  }
  /** 경보에 싸우러 가는 사람: 경비·경찰·전투 계열 이름 인물·다른 세력 아닌 전투원 */
  private alarmFighter(a: Actor, fac: string): boolean {
    if (a.def.kind === 'named') return !this.noAssist(a.def.name) && (!a.def.faction || a.def.faction === fac);
    const role = ARCHETYPES[a.def.archetype ?? '']?.role;
    return (role === 'guard' || role === 'police') && (this.mobFaction(a) === fac || !a.def.faction);
  }
  private stepAlarms(dt: number): void {
    for (const [fac, al] of this.alarms) {
      const live = al.threats.map((t) => [t, this.threatAt(fac, t)] as const).filter(([, v]) => !!v) as [string, NonNullable<ReturnType<WorldSim['threatAt']>>][];
      if (!live.length) {
        if ((al.quiet += dt) < WorldSim.ALARM_CLEAR) continue;
        this.alarms.delete(fac);
        for (const a of this.actors) {
          if (a.alarm !== fac) continue;
          a.alarm = undefined;
          a.run = 1;
          if (a.fighting || a.brawl || ['down', 'dead', 'gone'].includes(a.act)) continue;
          a.plan = 'none';
          a.route = [];
          this.resume(a);
        }
        this.events.push({ kind: 'alarm', scene: al.scene, faction: fac, on: false, why: al.why, threat: '' });
        continue;
      }
      al.quiet = 0;
      al.scene = live[0][1].scene;
      al.x = live[0][1].x;
      if ((al.tick -= dt) > 0) continue;
      al.tick = 1.5;
      for (const a of this.actors) {
        if (a.following || a.fighting || ['down', 'dead', 'gone', 'door'].includes(a.act) || this.sceneFaction(a.scene) !== fac) continue;
        if (al.threats.includes(a.def.id)) continue;
        // 가장 가까운 위협 (같은 장면 먼저)
        const [tid, t] = live.slice().sort(([, p], [, q]) => (p.scene === a.scene ? 0 : 1) - (q.scene === a.scene ? 0 : 1) || Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
        if (this.alarmFighter(a, fac)) {
          a.alarm = fac;
          if (a.brawl) continue;
          a.seatPick = undefined;
          a.task = undefined;
          a.escort = undefined;
          a.run = 1.6;
          if (t.scene !== a.scene) {
            if (a.route.length && a.plan === 'chase') continue;   // 이미 가는 중
            const path = this.graph.route(a.scene, t.scene);
            const d = path && this.graph.doorSpot(a.scene, path[0].exit);
            if (!path || !d) continue;
            a.route = path;
            this.walkTo(a, d, '경보: 현장으로 달려감', 'chase');
            this.iconOn(a, '!', 2);
            continue;
          }
          if (tid === 'player') {
            if (a.plan === 'chase' && !a.target) continue;
            a.target = undefined;
            this.walkTo(a, { x: t.x, y: t.y || a.y }, '경보: 침입자에게', 'chase');
            this.iconOn(a, '!', 2);
          } else if (t.actor) {
            this.startBrawl(a, t.actor);
            a.doing = `경보: ${t.actor.def.name}와 싸움`;
          }
          continue;
        }
        // 비전투원: 위협이 있는 장면이면 반대쪽으로 피한다 (다른 방은 그대로)
        if (a.scene !== t.scene || a.alarm === fac || a.act === 'scared') continue;
        if (Math.abs(a.x - t.x) > 900) continue;
        a.alarm = fac;
        this.evade(a, t.x);
      }
    }
  }
  /** 대피: 위협 반대쪽 끝으로 달려가 머문다 (사라지지 않음. 지나가던 사람은 그대로 나감) */
  private evade(a: Actor, fromX: number): void {
    if (a.def.kind === 'mob' && !a.post && !a.def.faction && a.def.brain === 'transit') return this.flee(a, fromX);
    const len = this.graph.scene(a.scene)?.length ?? 1280;
    const x = fromX < len / 2 ? len - 90 : 90;
    a.seatPick = undefined;
    a.task = undefined;
    a.run = 1.6;
    this.walkTo(a, { x, y: a.y }, '대피', 'none');
    this.setClip(a, this.canClip(a, 'run') ? 'run' : 'walk');
    this.iconOn(a, '!', 1.5);
  }
  /** 주인공이 거점 안에서 누군가를 때림·쓰러뜨림·죽임: 맞은 쪽이 위협(침입자)이 아니면 주인공이 위협 */
  private playerViolence(scene: string, x: number, victim: Actor | undefined, why: string): void {
    const fac = this.sceneFaction(scene);
    if (!fac) return;
    if (victim && this.alarms.get(fac)?.threats.includes(victim.def.id)) return;
    this.raiseAlarm(scene, x, 'player', why);
  }
  // ── 주인공 쫓아냄 (10-31 사용자 결정 2번): 경계 거점에 들어온 주인공에게 경비가 따라붙어 경고 → 「나가 주시죠」 → 버티면 경보 ──
  // 버팀 판정 = 위치·시간: 출구 쪽으로 가는 중이면 시간이 멈추고, 서 있거나 안쪽으로 가면 흐른다. 말: 경비가 [[허가]]면 머물게 두고, [[경보]]면 바로 경보
  /** 「나가 주시죠」 뒤 버틸 수 있는 초 */
  static EXPEL_SEC = 20;
  playerVisit: { fac: string; stay: number; out: number; left: number; guard?: string; permit: boolean; last: number } | null = null;
  /** 경비가 주인공을 경고 중인가 (그 경비에게 말을 걸면 [[허가]]·[[경보]]를 쓸 수 있다) */
  guardingPlayer(id: string): boolean {
    const v = this.playerVisit;
    return !!v && !v.permit && v.guard === id;
  }
  /** 경비가 허락함: 이번 방문은 머물게 둔다 */
  permitPlayer(): void {
    if (!this.playerVisit) return;
    this.playerVisit.permit = true;
    const g = this.actors.find((q) => q.def.id === this.playerVisit!.guard);
    if (g) { g.escort = undefined; this.resume(g); }
  }
  /** 경비가 위협받음: 시간이 남아 있어도 바로 경보 */
  threatAlarm(id?: string): void {
    const p = this.player;
    if (!p || !this.sceneFaction(p.scene)) return;
    const g = id ? this.actors.find((q) => q.def.id === id) : undefined;
    if (g) { g.escort = undefined; }
    this.raiseAlarm(p.scene, p.x, 'player', 'threat');
  }
  /** 장면 → 거점 밖까지 남은 길 (문 수 × 1만 + 다음 문까지 가로 거리). 거점 밖이면 0 */
  private exitCost(scene: string, x: number, fac: string): number {
    if (this.sceneFaction(scene) !== fac) return 0;
    let best = Infinity;
    for (const id of this.graph.ids()) {
      if (this.sceneFaction(id) === fac) continue;
      const path = this.graph.route(scene, id);
      if (!path?.length) continue;
      const d = this.graph.doorSpot(scene, path[0].exit);
      const c = path.length * 10000 + (d ? Math.abs(d.x - x) : 0);
      if (c < best) best = c;
    }
    return best;
  }
  private stepPlayerVisit(dt: number): void {
    const p = this.player;
    const fac = p ? this.sceneFaction(p.scene) : null;
    const v = this.playerVisit;
    // 거점 밖으로 나감: 경고를 받았으면 「쫓겨남」
    if (!p || !fac || (v && v.fac !== fac)) {
      if (v) {
        const g = this.actors.find((q) => q.def.id === v.guard);
        if (g?.escort === 'player') { g.escort = undefined; if (!g.fighting && !g.brawl) this.resume(g); }
        if (v.out > 0 && !v.permit) this.events.push({ kind: 'expel', scene: g?.scene ?? '', who: '{user}', by: g?.def.name ?? '경비' });
      }
      this.playerVisit = null;
      if (!p || !fac) return;
    }
    const st = this.stance(fac);
    // 적대 세력 거점에 들어옴 = 침입자 (적대 방문자와 같다)
    if (st === 'hostile') { this.raiseAlarm(p.scene, p.x, 'player', 'intruder'); return; }
    if (st !== 'wary') return;
    const pv = (this.playerVisit ??= { fac, stay: 0, out: 0, left: WorldSim.EXPEL_SEC, permit: false, last: this.exitCost(p.scene, p.x, fac) });
    if (pv.permit || this.alarms.has(fac)) return;
    // 따라붙는 경비 (없으면 거점 안 아무 경비, 같은 장면 먼저)
    let g = this.actors.find((q) => q.def.id === pv.guard && q.escort === 'player' && !q.fighting && !['down', 'dead', 'gone'].includes(q.act));
    if (!g) {
      g = this.actors.filter((q) => !q.escort && !q.fighting && !q.brawl && !['down', 'dead', 'gone', 'door'].includes(q.act) && this.sceneFaction(q.scene) === fac && ARCHETYPES[q.def.archetype ?? '']?.role === 'guard')
        .sort((a, b) => (a.scene === p.scene ? 0 : 1) - (b.scene === p.scene ? 0 : 1) || Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
      if (!g) return;
      g.escort = 'player';
      pv.guard = g.def.id;
      this.iconOn(g, '!', 1.5);
    }
    if (g.scene !== p.scene) {
      if (!g.route.length) {
        const path = this.graph.route(g.scene, p.scene);
        const d = path && this.graph.doorSpot(g.scene, path[0].exit);
        if (path && d) { g.route = path; this.walkTo(g, d, '주인공을 따라감', 'none'); }
      }
    } else if (g.doing === '주인공과 대화') {
      // 말을 듣는 중: 그 자리
    } else if (Math.abs(g.x - p.x) > 140) {
      this.walkTo(g, { x: p.x + (g.x < p.x ? -90 : 90), y: p.y || g.y }, '주인공을 따라감', 'none');
    } else if (g.act !== 'watch') {
      g.act = 'watch';
      g.doing = '주인공 경계';
      g.goal = null;
      g.wait = 1;
      g.face = p.x > g.x ? 1 : -1;
      this.setClip(g, 'idle');
    }
    pv.stay += dt;
    if (pv.stay >= 6 && pv.stay - dt < 6) this.say(g, '여긴 관계자 외 출입 금지입니다.', 2.5);
    if (pv.stay < 14) return;
    if (pv.out === 0) { this.say(g, '나가 주시죠.', 2.5); this.iconOn(g, '#', 2); }
    pv.out += dt;
    // 버팀 판정: 출구까지 남은 길이 줄었으면(나가는 중) 시간이 멈춘다
    const cost = this.exitCost(p.scene, p.x, fac);
    // 경비와 말하는 동안도 멈춘다 (말로 넘기는 길)
    if (cost >= pv.last - 4 && g.doing !== '주인공과 대화') pv.left -= dt;
    pv.last = cost;
    if (pv.left > 0) return;
    this.say(g, '경보 울려!', 2);
    g.escort = undefined;
    this.raiseAlarm(p.scene, p.x, 'player', 'trespass');
  }
  // ── 동행 (10-31 사용자 결정 docs/필드기능_결정_1031.md 1번): 모델 답의 [[동행]]·[[기다림]]·[[복귀]] 표시로만 켜고 끈다 ──
  /** 따라오는 사람 id (앞에서부터 주인공 뒤 순서, 최대 MAX_FOLLOW) */
  readonly followers: string[] = [];
  /** 주인공 발자국 (최근 몇 초) */
  private trail: { t: number; x: number; y: number }[] = [];
  /** 동행이 전투 몸을 때린 것 (게임 쪽이 꺼내 전투 몸에 맞힌다) */
  readonly assistHits: { who: string; x: number; y: number; dir: 1 | -1; dmg: number }[] = [];
  /** 싸움에서 빠지는 사람 (비전투 계열): 동행이어도 거들지 않는다 */
  noAssist: (name: string) => boolean = () => false;
  /** 이름(또는 id)으로 행위자 */
  findActor(key: string): Actor | undefined {
    return this.actors.find((q) => q.def.id === key || (q.def.kind === 'named' && q.def.name === key));
  }
  /** follow = 따라옴, wait = 그 자리에서 기다림, return = 일과로. 못 하면 false (인원 초과·없음·쓰러짐) */
  setFollow(key: string, mode: 'follow' | 'wait' | 'return' | 'hit'): boolean {
    const a = this.findActor(key);
    if (!a || ['dead', 'gone'].includes(a.act) || a.fighting) return false;
    const i = this.followers.indexOf(a.def.id);
    if (mode === 'follow') {
      if (i < 0 && this.followers.length >= MAX_FOLLOW) return false;
      if (i < 0) this.followers.push(a.def.id);
      a.following = true;
      a.hold = false;
      a.task = undefined;
      a.goal = null;
      a.route = [];
      a.seatPick = undefined;
      a.buddy = undefined;
      a.escort = undefined;
      if (a.act !== 'down') { a.act = 'idle'; a.wait = 0; this.setClip(a, 'idle'); }
      a.doing = '주인공을 따라감';
      this.iconOn(a, '!', 1.2);
    } else {
      if (i < 0 && !a.following && !(mode === 'return' && a.hold)) return false;
      if (i >= 0) this.followers.splice(i, 1);
      a.following = false;
      a.assist = null;
      a.hold = mode === 'wait';
      if (a.act !== 'down') {
        a.goal = null;
        a.act = 'idle';
        a.wait = mode === 'wait' ? 1e9 : 0.5;
        a.doing = mode === 'wait' ? '기다리는 중' : '자리로 돌아가는 중';
        this.setClip(a, 'idle');
      }
    }
    this.events.push({ kind: 'follow', scene: a.scene, who: a.def.name, mode });
    return true;
  }
  /** 싸움 거들기 대상 (게임 쪽이 매 틱 정한다). null = 싸움 없음 */
  setAssist(id: string, at: { x: number; y: number } | null): void {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a?.following) return;
    if (!at) { a.assist = null; return; }
    a.assist = { x: at.x, y: at.y, t: a.assist?.t ?? range(this.rng, 0.3, 0.8) };
  }
  /** 동행 한 틱: 주인공이 지나간 자리를 조금 뒤처져 걷는다. 싸움 중이면 상대에게 붙어 때린다 */
  private stepFollow(a: Actor, dt: number): void {
    const p = this.player;
    if (a.act === 'down' || a.act === 'scared') return;   // 맞아 쓰러짐·겁먹음은 그대로 (쓰러짐은 struck 에서 동행이 풀린다)
    if (!p) { if (a.clip !== 'idle') this.setClip(a, 'idle'); return; }
    // 장면이 다르면 (문 앞에서 늦음) 주인공 장면으로 붙는다
    if (a.scene !== p.scene) { this.joinScene(a, p.scene, p.x, p.y); return; }
    const order = Math.max(0, this.followers.indexOf(a.def.id));
    const speed = (a.def.speed ?? WALK);
    if (a.assist) {
      const t = a.assist;
      const gap = Math.abs(t.x - a.x);
      a.face = t.x > a.x ? 1 : -1;
      a.act = 'walk';
      a.doing = '주인공을 거들어 싸움';
      if (gap > 80 || Math.abs(t.y - a.y) > 24) {
        const sp = speed * 1.5 * dt;
        a.x += Math.sign(t.x - a.x) * Math.min(sp, Math.max(0, gap - 70));
        a.y += Math.sign(t.y - a.y) * Math.min(sp * 0.5, Math.abs(t.y - a.y));
        if (a.clip !== 'run' && a.clip !== 'walk') this.setClip(a, this.canClip(a, 'run') ? 'run' : 'walk');
        return;
      }
      if ((t.t -= dt) > 0) { if (a.clip === 'run' || a.clip === 'walk') this.setClip(a, 'idle'); return; }
      t.t = range(this.rng, 0.9, 1.4);
      this.setClip(a, this.canClip(a, 'strike') ? 'strike' : 'idle');
      a.base ??= baseOf(a.def.look ?? a.def.name);
      this.assistHits.push({ who: a.def.id, x: t.x, y: t.y, dir: a.face, dmg: Math.round(60 * derive(a.base).power * range(this.rng, 0.8, 1.2)) });
      return;
    }
    // 1초 + 사람마다 0.6초 뒤 발자국. 너무 붙으면 간격을 둔다
    const want = this.time - (1 + order * 0.6);
    let hit = this.trail[0] ?? { t: this.time, x: p.x, y: p.y };
    for (const f of this.trail) { if (f.t <= want) hit = f; else break; }
    const gapMin = FOLLOW_GAP[0] + order * FOLLOW_GAP[1];
    let gx = hit.x;
    if (Math.abs(p.x - gx) < gapMin) gx = p.x - Math.sign(p.x - a.x || -(p.face ?? 1)) * gapMin;
    const gy = hit.y || a.y;
    const dx = gx - a.x;
    const far = Math.abs(p.x - a.x);
    // 아주 멀어지면(막힘·끼임) 주인공 가까이 붙는다
    if (far > 900) { a.x = p.x - (p.face ?? 1) * gapMin; a.y = p.y || a.y; return; }
    if (Math.abs(dx) < 12 && Math.abs(gy - a.y) < 8) {
      a.act = 'idle';
      a.wait = 1;
      a.doing = '주인공을 따라감';
      a.face = p.x > a.x ? 1 : -1;
      if (a.clip !== 'idle') this.setClip(a, 'idle');
      return;
    }
    const run = far > 260 ? 1.6 : 1;
    const step = speed * run * dt;
    a.act = 'walk';
    a.doing = '주인공을 따라감';
    a.face = dx > 0 ? 1 : -1;
    const clip = run > 1 && this.canClip(a, 'run') ? 'run' : 'walk';
    if (a.clip !== clip) this.setClip(a, clip);
    a.x += Math.sign(dx) * Math.min(Math.abs(dx), step);
    const [top, bot] = this.graph.lane(a.scene);
    a.y = Math.max(top, Math.min(bot, a.y + Math.sign(gy - a.y) * Math.min(Math.abs(gy - a.y), step * 0.5)));
  }
  /** 동행: 주인공이 들어간 장면으로 같이 (도착 자리 = 주인공 뒤) */
  private joinScene(a: Actor, scene: string, x: number, y: number): void {
    const len = this.graph.scene(scene)?.length ?? 1280;
    const order = Math.max(0, this.followers.indexOf(a.def.id));
    const back = x < len / 2 ? -1 : 1;   // 들어온 문 쪽(가까운 끝)으로 뒤에 선다
    a.scene = scene;
    a.x = Math.max(30, Math.min(len - 30, x + back * (FOLLOW_GAP[0] + order * FOLLOW_GAP[1])));
    a.y = y || this.laneMid(scene);
    a.route = [];
    a.goal = null;
    a.act = 'idle';
    a.wait = 0.5;
    this.setClip(a, 'idle');
  }
  /** 몹에게 말을 걸 수 있나 (10-31 사용자: 몹도 이름 인물처럼 대화). 싸움·기절·사망·겁먹음·쫓김·막아섬·나가는 문 앞이면 안 됨 */
  canTalk(a: Actor): boolean {
    return a.def.kind === 'mob' && !a.fighting && !a.brawl && !['down', 'dead', 'gone', 'door', 'scared', 'argue'].includes(a.act) && a.plan !== 'chase' && a.plan !== 'steal' && a.plan !== 'harass';
  }
  /** 대화 중인 몹: 그 자리에 멈춰 주인공을 본다 (매 틱 다시 부르는 동안만, 대화창을 닫으면 1초 뒤 하던 일로) */
  holdTalk(id: string, px: number): void {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || !this.canTalk(a)) return;
    if (a.act !== 'pause' || a.doing !== '주인공과 대화') {
      a.talkFrom = a.doing;
      a.goal = null;
      a.route = [];
      a.seatPick = undefined;
      a.buddy = undefined;
      a.act = 'pause';
      a.doing = '주인공과 대화';
      this.setClip(a, this.canClip(a, 'talk') ? 'talk' : 'idle');
    }
    a.wait = 1;
    a.face = px > a.x ? 1 : -1;
  }
  /** 그 장면에 순찰 경찰이 있나 (싸움·쓰러짐·나감 제외) */
  private patrolIn(scene: string): Actor | undefined {
    return this.actors.find((q) => q.scene === scene && q.patrol && q.plan !== 'chase' && !q.fighting && !['down', 'dead', 'gone'].includes(q.act));
  }

  // ── 한 사람 ──

  private setClip(a: Actor, clip: string, fromQ = false): void {
    if (!fromQ) a.clipQ = undefined;
    // 의자에서 하는 일이 아니면 일어선다
    if (!clip.startsWith('seat:')) a.seat = undefined;
    if (a.clip !== clip) {
      a.clip = clip;
      a.clipAt = this.time;
      a.clipUntil = undefined;
    }
  }
  private iconOn(a: Actor, icon: string, sec: number): void {
    a.icon = icon;
    a.iconT = sec;
  }
  private canClip(a: Actor, clip: string): boolean {
    const look = a.def.look ?? a.def.name;
    // 앉아서 하는 일은 의자가 있어야: 서서 하는 줄이 없으면 의자 줄로 (허공에 앉지 않는다)
    return this.has(look, clip) || (!!SEAT_KIND[clip] && this.has(look, `seat:${SEAT_KIND[clip]}`));
  }
  /** 장면의 빈 의자 (다른 사람·주인공이 앉지 않은 것) 중 x 에 가까운 것 */
  private freeSeat(scene: string, x: number, dir?: 'front' | 'side' | 'back'): number | null {
    const seats = this.graph.scene(scene)?.seats ?? [];
    let best: number | null = null;
    seats.forEach((st, i) => {
      if (dir && seatDir(st.face) !== dir) return;
      if (this.player?.scene === scene && this.player.seat === st.box) return;
      if (this.actors.some((q) => q.scene === scene && (q.seat?.i === i || q.seatPick === i))) return;
      if (best === null || Math.abs(st.x - x) < Math.abs(seats[best].x - x)) best = i;
    });
    return best;
  }

  private stepActor(a: Actor, dt: number): void {
    if (a.clipQ?.length && (a.clipQT = (a.clipQT ?? 0) - dt) <= 0) {
      const n = a.clipQ.shift()!;
      this.setClip(a, n.clip, true);
      a.clipQT = n.sec;
      if (!a.clipQ.length) a.clipQ = undefined;
    }
    if (a.iconT > 0 && (a.iconT -= dt) <= 0) a.icon = undefined;
    if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = undefined;
    if (a.act === 'dead') return;
    if (a.brawl) return this.stepBrawl(a, dt);
    // 동행: 쓰러지면 동행이 풀린다(깨면 일과로). 따라오는 동안 자기 일·응대는 멈춘다 (욕구는 그대로 준다)
    if (a.following && a.act === 'down') this.setFollow(a.def.id, 'hit');
    if (a.following) {
      if (a.needs) decayNeeds(a.needs, dt, TEMPER[a.def.name], false);
      return this.stepFollow(a, dt);
    }
    if (a.noticeCd > 0) a.noticeCd -= dt;
    if (a.needs) decayNeeds(a.needs, dt, TEMPER[a.def.name], onDuty(this.hour, TEMPER[a.def.name]));
    if (a.def.kind === 'mob') this.mobThink(a, dt);
    if (a.def.kind === 'named' && this.namedBlocks(a)) return;   // 호감 적대: 보자마자 막아섬 (C4 다안)
    if (a.def.kind === 'named' || a.post) this.namedNotice(a);   // 주인공 응대: 이름 인물·직원
    this.socialStep(a, dt);
    if (a.def.kind === 'mob') this.threatened(a, dt);
    this.seeBody(a);
    this.gawk(a, dt);
    switch (a.act) {
      // 겁에 질림(무기를 들이밀었을 때): 주저앉아 있다가 뒤로 기거나, 뒷걸음질 친 뒤 달아난다
      case 'scared': {
        a.wait -= dt;
        const src = a.scareFrom ?? this.player?.x;
        if (a.scare === 'backoff' && src !== undefined) a.x += Math.sign(a.x - src || 1) * 55 * dt;
        // 얼어붙음: 주인공이 무기를 거두거나 떠날 때까지 주저앉은 채 꼼짝 못 함
        if (a.scare === 'freeze' && a.scareFrom === undefined && this.player?.armed && this.player.scene === a.scene) { a.wait = Math.max(a.wait, 0.5); return; }
        if (a.wait > 0) return;
        const from = src ?? a.x;
        // 주저앉았다가 네발로 기어 달아남(42). 엎드려 기기(38)는 쓰러진 몸 전용이라 여기선 안 씀
        if (a.scare === 'sit' && this.canClip(a, 'scramble')) { this.flee(a, from, 'scramble', 0.5); return; }
        if (a.scare === 'cower' && this.canClip(a, 'scramble')) { this.flee(a, from, 'scramble', 0.6); return; }
        this.flee(a, from);
        return;
      }
      case 'door': {
        a.wait -= dt;
        if (a.wait > 0) return;
        const hop = a.route.shift()!;
        const at = this.graph.doorSpot(hop.to, hop.enter) ?? this.randomSpot(hop.to);
        a.scene = hop.to;
        a.x = at.x;
        a.y = at.y;
        return this.nextLeg(a);
      }
      case 'walk':
        return this.move(a, dt);
      case 'do':
        if (a.task && a.needs) a.needs[a.task.need] = Math.min(100, a.needs[a.task.need] + a.task.fill * dt);
        a.wait -= dt;
        // 직원의 책상 일은 욕구가 차도 정한 시간만큼 (근무라서). 그 밖은 욕구가 다 차면 끝
        if (a.wait <= 0 || (a.task && a.needs && a.needs[a.task.need] >= 100 && !(a.post && (a.task.id === 'work' || a.task.id === 'train')))) {
          a.last = a.task?.id;
          a.task = undefined;
          this.idle(a, 1, 3);
        }
        return;
      case 'notice':
      case 'watch':
      case 'argue':
        a.wait -= dt;
        if (a.wait <= 0) this.resume(a);
        return;
      case 'down':
        a.wait -= dt;
        if (a.wait > 0) return;
        // 기절에서 깨면 체력 조금 돌아오고 (근무형이 아니면) 무조건 자리를 뜬다
        if (a.def.kind === 'mob' && (a.hp ?? 1) <= 0) {
          a.hp = Math.round((a.hpMax ?? 50) * 0.3);
          // 뒤끝(불량배): 한 번은 도망 대신 다시 맞선다
          if (this.once(a, '뒤끝')) { a.act = 'argue'; a.doing = '맞섬'; a.wait = 3; this.iconOn(a, '#', 3); this.setClip(a, this.canClip(a, 'angry') ? 'angry' : 'idle'); return; }
          // 겁 많으면 일어나지도 못하고 엎드린 채 기어서(38) 달아난다
          if (!a.post && (a.temper?.courage ?? 1) < 0.4 && this.canClip(a, 'crawl')) return this.flee(a, this.player?.x ?? a.x, 'crawl', 0.3);
          if (!a.post) return this.flee(a, this.player?.x ?? a.x);
          return this.resume(a);
        }
        // 일어나서: 겁 많으면 도망, 배짱 있으면 맞선다 (실제 싸움은 전투 AI)
        if (a.def.kind === 'mob' && a.temper && !a.post) {
          if (a.temper.courage > (this.perk(a, '싸움꾼') ? 0.55 : 0.75) && ARCHETYPES[a.def.archetype ?? '']?.role === 'thug') {
            a.act = 'argue';
            a.doing = '맞섬';
            a.wait = 3;
            this.iconOn(a, '#', 3);
            return;
          }
          return this.flee(a, this.player?.x ?? a.x);
        }
        // 이름 인물: 기절에서 깨면 체력 조금 돌아오고 하던 일로 (화는 그대로 남아 또 맞으면 바로 맞선다)
        if (a.def.kind === 'named' && a.hp !== undefined && a.hp <= 0) { a.hp = Math.round((a.hpMax ?? 1000) * 0.3); a.angryAt = this.time; }
        return this.resume(a);
      case 'post':
        return this.postStand(a, dt);
      case 'idle':
        a.wait -= dt;
        if (a.wait <= 0) this.decide(a);
        return;
      case 'pause': {
        // 가다 잠깐 멈춤: 두리번(평상 대기)은 좌우로 고개를 돌리듯 몸을 돌린다. 끝나면 가던 길로
        const t0 = this.time - a.clipAt;
        if (a.clip === 'idle' && Math.floor(t0 / 0.9) !== Math.floor((t0 - dt) / 0.9)) a.face = (-a.face) as 1 | -1;
        if (a.doing.startsWith('대화') && a.needs) a.needs.social = Math.min(100, a.needs.social + 6 * dt);   // 선 채 대화는 수다 욕구를 채운다
        a.wait -= dt;
        if (a.wait > 0) return;
        if (!a.goal) return this.resume(a);
        a.act = 'walk';
        a.doing = a.def.brain === 'transit' ? '지나가는 중' : a.doing;
        return;
      }
    }
  }

  private move(a: Actor, dt: number): void {
    if (!a.goal) return this.idle(a);
    // 쫓기: 목표가 움직인다
    if (a.plan === 'chase') {
      const p = this.player && this.player.scene === a.scene ? this.player : null;
      const t = a.target ? this.actors.find((q) => q.def.id === a.target) : null;
      if (t && t.scene === a.scene) a.goal = { x: t.x - Math.sign(t.x - a.x) * 70, y: t.y };
      else if (p) a.goal = { x: p.x - Math.sign(p.x - a.x) * 110, y: p.y || a.goal.y };
    }
    // 도망 중이면 도망 동작(달아나기·기어서)을 유지 (그 인물에게 없으면 뛰기·걷기)
    const fleeing = (a.doing === '도망' || a.doing === '기어서 도망') && a.fleeClip && this.canClip(a, a.fleeClip);
    // 느긋한 걸음: 뛰거나 쫓거나 달아나는 중이 아님 → 흔들림·비켜 가기·멈추기
    const casual = a.run <= 1.2 && !fleeing && a.plan !== 'chase' && a.doing !== '도망';
    const lead = this.leaderOf(a);
    // 장애물: 가는 길에 막힌 곳이 있으면 비켜 갈 경유점 (wall 이면 돌아섬)
    if (!a.detour?.length && this.planDetour(a)) return;
    const wp = a.detour?.[0];
    const goal = wp ?? a.goal;
    const dx = goal.x - a.x;
    // 제 걸음: 사람마다 속도가 다르고(생길 때 성급함으로) 걷는 동안 조금씩 빨라졌다 느려졌다 한다. 일행은 앞사람 걸음에 맞춤
    let speed = (lead?.def.speed ?? a.def.speed ?? WALK) * a.run;
    if (casual) speed *= 1 + 0.07 * Math.sin(this.time * 1.9 + (a.phase ?? 0));
    if (lead) speed *= Math.max(0.75, Math.min(1.25, 1 + ((lead.x - a.x) * Math.sign(dx || 1)) / 120));
    const step = speed * dt;
    if (Math.abs(dx) > 1) a.face = dx > 0 ? 1 : -1;
    this.setClip(a, fleeing ? a.fleeClip! : a.run > 1.2 && this.canClip(a, 'run') ? 'run' : 'walk');
    if (casual && !wp) this.sidestep(a, Math.sign(dx), dt);
    // 길 따라: 멀리 갈 땐 옆으로 걷고 깊이(줄)는 걸음의 35%만큼 천천히 옮긴다. 가까워지거나 경유점이면 곧장
    const far = !wp && Math.abs(dx) > 60;
    const ty = lead && far ? lead.y + (a.buddyDy ?? 0) : goal.y + (far ? (a.side ?? 0) : 0);
    const dy = ty - a.y;
    if (Math.abs(dx) <= step && Math.abs(goal.y - a.y) <= step) {
      a.x = goal.x;
      a.y = goal.y;
      if (wp) return void a.detour!.shift();
      a.goal = null;
      a.side = 0;
      return this.arrived(a);
    }
    let vx: number, vy: number;
    if (far) {
      vy = Math.sign(dy) * Math.min(Math.abs(dy), step * 0.35);
      vx = Math.sign(dx) * Math.min(Math.abs(dx), Math.sqrt(step * step - vy * vy));
    } else {
      const d = Math.hypot(dx, goal.y - a.y);
      vx = (dx / d) * step;
      vy = ((goal.y - a.y) / d) * step;
    }
    a.x += vx;
    const [top, bot] = this.graph.lane(a.scene);
    a.y = Math.max(Math.min(top, goal.y), Math.min(Math.max(bot, goal.y), a.y + vy));   // 띠 밖 목표(의자 등)면 그쪽은 열어 둠
    if (casual && !wp && !lead) this.maybePause(a, dt);
  }

  /** 같이 걷는 일행의 앞사람 (같은 장면에서 걷거나 멈춰 있을 때만). 떨어지면 혼자 걷는다 */
  private leaderOf(a: Actor): Actor | null {
    if (!a.buddy) return null;
    const l = this.actors.find((q) => q.def.id === a.buddy);
    if (!l || l.scene !== a.scene || l.fighting || !['walk', 'pause'].includes(l.act) || l.doing === '도망') {
      a.buddy = undefined;
      return null;
    }
    return l;
  }

  /** 서로 비켜 가기: 앞쪽 같은 줄에 사람이 있으면 위·아래로 살짝 비켜선다(그 사람 반대쪽, 띠 안). 없으면 천천히 제 줄로 */
  private sidestep(a: Actor, dir: number, dt: number): void {
    const ahead = this.actors.find((q) => q !== a && q.scene === a.scene && !q.fighting && q.act !== 'door' && q.act !== 'gone'
      && q.def.id !== a.buddy && q.buddy !== a.def.id && (q.x - a.x) * dir > 0 && Math.abs(q.x - a.x) < 110 && Math.abs(q.y - a.y - (a.side ?? 0)) < 22);
    if (!ahead) {
      if (a.side) a.side = Math.abs(a.side) < 1 ? 0 : a.side * (1 - Math.min(1, dt * 0.7));
      return;
    }
    const [top, bot] = this.graph.lane(a.scene);
    let s = Math.sign(a.y - ahead.y) || (this.rng() < 0.5 ? 1 : -1);
    if (a.y + s * 30 < top || a.y + s * 30 > bot) s = -s;
    a.side = (ahead.y - a.y) + s * 30;
  }

  /** 막힌 곳 우회 경유점. 앞길(가는 방향 200px 안)에 막힌 곳이 있고 지금 줄이 그 안이면 위·아래 바깥으로 돌아간다. 길을 다 막았으면 돌아섬(true) */
  private planDetour(a: Actor): boolean {
    const list = this.blocks.get(a.scene);
    if (!list || !a.goal) return false;
    const g = a.goal, dir = Math.sign(g.x - a.x);
    if (!dir) return false;
    const [top, bot] = this.graph.lane(a.scene);
    for (const b of list) {
      const near = dir > 0 ? b.x0 : b.x1, far = dir > 0 ? b.x1 : b.x0;
      if ((near - a.x) * dir < -2 || (near - a.x) * dir > 200) continue;   // 이미 지났거나 아직 멀다
      if ((g.x - near) * dir < 0) continue;   // 목표가 막힌 곳 앞
      if (b.wall || (b.y0 <= top + 20 && b.y1 >= bot - 20)) {
        // 길이 막힘: 돌아서 온 쪽으로 (지나가던 사람은 다른 출구, 아니면 이쪽 아무 데나)
        const len = this.graph.scene(a.scene)?.length ?? 1280;
        a.detour = [];
        a.route = [];
        const back = { x: Math.max(MARGIN, Math.min(len - MARGIN, near - dir * range(this.rng, 120, 400))), y: a.y };
        if (a.exitAt) a.exitAt = { x: dir > 0 ? 30 : len - 30, y: a.y };
        this.walkTo(a, a.exitAt ?? back, '길이 막혀 돌아감', a.exitAt ? 'exit' : 'none');
        return true;
      }
      const y = a.y + (a.side ?? 0);
      if (y < b.y0 - 14 || y > b.y1 + 14) continue;   // 그 줄은 비어 있음
      const upY = b.y0 - 18, downY = b.y1 + 18;
      const okUp = upY >= top, okDown = downY <= bot;
      const yy = okUp && (!okDown || a.y - upY < downY - a.y) ? upY : okDown ? downY : upY;
      a.detour = [{ x: near - dir * 12, y: yy }, { x: far + dir * 12, y: yy }];
      return false;
    }
    return false;
  }

  /** 가다 잠깐 멈추기: 성급하면 덜, 호기심 많으면 더. 그 인물이 가진 줄만, 때·곳·성향에 맞게 고름 */
  private maybePause(a: Actor, dt: number): void {
    if (!['none', 'exit', 'do'].includes(a.plan) || a.route.length || a.drunk) return;
    if ((a.pauseCd = (a.pauseCd ?? 10) - dt) > 0) return;
    const t = a.temper ?? { courage: 0.5, social: 0.5, haste: 0.5, curious: 0.5, sly: 0 };
    a.pauseCd = range(this.rng, 10, 26) * (0.7 + t.haste);
    if (this.rng() > 0.25 + 0.35 * t.curious - 0.2 * t.haste) return;
    const h = this.hour, morning = h != null && h >= 6 && h < 11, night = this.isNight();
    const kind = this.graph.kind(a.scene), outside = kind === 'street' || kind === 'shop';
    const role = ARCHETYPES[a.def.archetype ?? '']?.role;
    const buddy = this.actors.find((q) => q.buddy === a.def.id && q.scene === a.scene);
    if (a.patrol) {
      const po = PATROL_PAUSES.filter((o) => this.canClip(a, o.clip));
      if (!po.length) return;
      const o = pick(this.rng, po);
      return this.pauseAs(a, o.clip, o.doing, range(this.rng, o.sec[0], o.sec[1]), buddy);
    }
    const w: Record<string, number> = {
      phone: 3, call: 1.2, coffee: morning ? 3 : 0.8, limber: morning ? 2 : 0.7, smoke: (night ? 2.5 : 1) * (role === 'thug' ? 2 : 1),
      browse: 0.5 + 2.5 * t.curious, snack: 0.8, front: 0.8, back: outside ? 1.5 : 0.4, spot: t.curious, rest: 1, idle: 2,
    };
    // 일행이 있으면 서로 마주 보고 수다
    if (buddy && this.canClip(a, 'talk') && this.canClip(buddy, 'talk')) return this.pauseAs(a, 'talk', '일행과 수다', range(this.rng, 4, 9), buddy);
    const opts = PAUSES.filter((o) => this.canClip(a, o.clip));
    if (!opts.length) return;
    let r = this.rng() * opts.reduce((n, o) => n + w[o.clip], 0);
    const o = opts.find((x) => (r -= w[x.clip]) <= 0) ?? opts[opts.length - 1];
    this.pauseAs(a, o.clip, o.doing, range(this.rng, o.sec[0], o.sec[1]), buddy);
  }
  private pauseAs(a: Actor, clip: string, doing: string, sec: number, buddy?: Actor): void {
    a.act = 'pause';
    a.doing = doing;
    a.wait = sec;
    a.side = 0;
    this.setClip(a, clip);
    a.clipUntil = this.time + sec;
    if (!buddy) return;
    buddy.act = 'pause';
    buddy.doing = doing === '일행과 수다' ? doing : '일행 기다림';
    buddy.wait = sec;
    if (doing === '일행과 수다') { a.face = (buddy.x >= a.x ? 1 : -1); buddy.face = (-a.face) as 1 | -1; }
    this.setClip(buddy, doing === '일행과 수다' ? 'talk' : 'idle');
  }

  private idle(a: Actor, min = 2, max = 7): void {
    a.seatPick = undefined;
    a.act = 'idle';
    a.doing = '대기';
    a.run = 1;
    a.plan = 'none';
    a.wait = range(this.rng, min, max);
    this.setClip(a, 'idle');
  }
  /** 잠깐 멈췄다 하던 일로 (몹은 가던 길, 근무형은 자리) */
  private resume(a: Actor): void {
    if (a.post) return this.goPost(a);
    if (a.def.brain === 'transit' && a.exitAt) return this.walkTo(a, a.exitAt, '지나가는 중', 'exit');
    this.idle(a, 0.5, 2);
  }

  private walkTo(a: Actor, p: { x: number; y: number }, doing: string, plan: Plan = 'none'): void {
    a.act = 'walk';
    a.goal = p;
    a.detour = [];
    a.doing = doing;
    a.plan = plan;
  }

  private arrived(a: Actor): void {
    const hop = a.route[0];
    if (hop && hop.from === a.scene) {
      a.act = 'door';
      a.doing = `${this.graph.scene(hop.to)?.name ?? hop.to}(으)로 이동 중`;
      a.wait = Math.max(1, hop.sec / 6);
      return;
    }
    switch (a.plan) {
      case 'do':
        return this.startTask(a);
      case 'post':
        a.act = 'post';
        if (a.post?.how === 'train') {
          a.doing = `훈련 중 (${({ pushup: '팔굽혀펴기', work: '장비 점검', limber: '기지개' } as Record<string, string>)[a.trainClip ?? ''] ?? '대기'})`;
          a.wait = range(this.rng, 10, 25);
          this.setClip(a, a.trainClip ?? 'idle');
          return;
        }
        a.doing = `근무 중 (${a.post?.archetype ?? ''})`;
        a.wait = range(this.rng, 4, 9);
        this.setClip(a, this.canClip(a, 'work') ? 'work' : 'idle');
        return;
      case 'patrol':
      case 'roam-post':
        return this.goPost(a);
      case 'exit':
        a.act = 'gone';
        return;
      case 'cordon':
        return this.arriveCordon(a);
      case 'treat': {
        // 진료: 의사는 진료 줄, 환자는 치료받기(그 줄이 있으면)
        const pt = this.actors.find((q) => q.def.id === a.patient);
        a.patient = undefined;
        a.act = 'pause';
        a.doing = '진료 중';
        a.wait = range(this.rng, 6, 10);
        this.setClip(a, 'exam');
        if (pt && pt.scene === a.scene) {
          a.face = pt.x > a.x ? 1 : -1;
          if (pt.act !== 'do' && this.canClip(pt, 'treat')) { pt.act = 'pause'; pt.goal = null; pt.doing = '치료받는 중'; pt.wait = a.wait; pt.face = (-a.face) as 1 | -1; this.setClip(pt, 'treat'); }
        }
        return;
      }
      case 'steal':
        return this.doSteal(a);
      case 'harass':
        return this.doHarass(a);
      case 'chase':
        // 플레이어(또는 도둑) 앞에 섰다: 경고하고 지켜본다 (전투 연결 전)
        a.act = 'watch';
        a.doing = '막아섬';
        a.wait = 3;
        this.iconOn(a, '!', 2);
        return;
    }
    if (a.def.brain === 'transit' && a.exitAt) {
      a.act = 'gone';
      return;
    }
    this.idle(a);
  }

  private nextLeg(a: Actor): void {
    const hop = a.route[0];
    if (hop) {
      const d = this.graph.doorSpot(a.scene, hop.exit);
      if (d) return this.walkTo(a, d, a.doing, a.plan);
    }
    a.route = [];
    // 목적지 장면: 할 일이 있으면 그 자리로
    if (a.plan === 'do' && a.task) return this.walkTo(a, this.randomSpot(a.scene), a.task.label + ' 하러', 'do');
    if (a.plan === 'roam-post') return this.goPost(a);
    this.walkTo(a, this.randomSpot(a.scene), '자리 잡는 중');
  }

  // ── 이름 인물 ──

  /** 호감이 적대 구간인 이름 인물 (10-31 사용자 C4 다안): 주인공을 보면 막아서고(몹 적대 세력과 같은 길), 막아서면 전투 AI가 싸운다.
   *  싸움이 끝난 뒤(이기든 지든) 1분은 다시 막지 않는다 */
  private namedBlocks(a: Actor): boolean {
    const p = this.player;
    if (!p || p.scene !== a.scene || !this.namedHostile(a.def.name)) return false;
    if (a.plan === 'chase' || a.fighting || ['down', 'dead', 'gone', 'door', 'argue'].includes(a.act) || a.seat) return false;
    if (this.time < (a.blockAt ?? -1e9) + 60 || Math.abs(p.x - a.x) > 520) return false;
    a.perks ??= ['스탯 뻥튀기', '체력 뻥튀기'];
    a.task = undefined;
    a.run = 1.4;
    this.walkTo(a, { x: p.x + (a.x > p.x ? 70 : -70), y: p.y || a.y }, '주인공을 막아섬', 'chase');
    this.iconOn(a, '!', 2);
    return true;
  }
  private namedNotice(a: Actor): void {
    const p = this.player;
    if (!p || p.scene !== a.scene || a.noticeCd > 0) return;
    if (a.act !== 'idle' && a.act !== 'walk' && !(a.post && a.act === 'post')) return;
    if (a.plan === 'do' || a.route.length) return;
    if (Math.abs(p.x - a.x) > NOTICE_PX || Math.abs(p.y - a.y) > 160) return;
    a.noticeCd = range(this.rng, 20, 35);
    a.act = 'notice';
    a.doing = '주인공을 봄';
    a.goal = null;
    a.face = p.x > a.x ? 1 : -1;
    a.wait = 2.4;
    this.setClip(a, this.canClip(a, 'greet') ? 'greet' : this.canClip(a, 'bow') ? 'bow' : 'idle');
    this.iconOn(a, '!', 1.2);
    this.events.push({ kind: 'notice', scene: a.scene, who: a.def.name });
  }

  private decide(a: Actor): void {
    // 「기다려」: 그 자리에 남는다 (다시 「따라와」·「돌아가」 전까지)
    if (a.hold) { a.act = 'idle'; a.wait = 5; a.doing = '기다리는 중'; return; }
    if (a.post) return this.goPost(a);
    if (a.def.brain === 'transit') return this.idle(a, 1, 3);
    const roam = (a.def.roam ?? [a.def.home]).filter((s) => this.graph.scene(s));
    if (a.def.brain === 'needs' && a.needs) {
      const c = choose({
        name: a.def.name, needs: a.needs, scene: a.scene, roam, graph: this.graph, has: (clip) => this.canClip(a, clip), duty: onDuty(this.hour, TEMPER[a.def.name]),
        partnerIn: (s) => this.actors.some((q) => q !== a && q.def.kind === 'named' && q.scene === s && (q.act === 'idle' || q.act === 'walk') && !q.route.length),
        rand: this.rng, last: a.last, fighter: true,   // 이름 요원은 모두 싸우는 몸
      });
      if (c) {
        a.task = c.act;
        if (c.scene === a.scene) return this.walkTo(a, this.taskSpot(a, c.act), `${c.act.label} 하러`, 'do');
        const path = this.graph.route(a.scene, c.scene);
        const d = path && this.graph.doorSpot(a.scene, path[0].exit);
        if (path && d) {
          a.route = path;
          return this.walkTo(a, d, `${c.act.label} 하러 ${this.graph.scene(c.scene)?.name ?? c.scene}(으)로`, 'do');
        }
        a.task = undefined;
      }
    }
    // 켜진 활동이 없으면 서성이기·장면 다녀오기 (2단계 뼈대)
    const away = a.scene !== a.def.home;
    const r = this.rng();
    let dest: string | null = null;
    if (away && r < 0.45) dest = a.def.home;
    else if (!away && roam.length > 1 && r < 0.18) dest = pick(this.rng, roam.filter((s) => s !== a.scene));
    if (dest) {
      const path = this.graph.route(a.scene, dest);
      const d = path && this.graph.doorSpot(a.scene, path[0].exit);
      if (path && d) {
        a.route = path;
        return this.walkTo(a, d, `${this.graph.scene(dest)?.name ?? dest}(으)로 가는 중`);
      }
    }
    this.walkTo(a, this.randomSpot(a.scene), '서성이는 중');
  }

  /** 수다는 상대 옆으로, 앉아서 하는 일은 빈 의자로(서서 하는 줄이 없거나 의자가 있으면), 나머지는 장면 안 빈 곳 */
  private taskSpot(a: Actor, t: Activity): { x: number; y: number } {
    a.seatPick = undefined;
    a.station = undefined;
    a.opt = undefined;
    if (t.id === 'train') { const st = this.trainSpot(a); if (st) return st; }
    // 그 인물에게 그림이 있는 줄 중에서 고른다 (10-31): 앉는 줄은 그 방향 빈 의자가 있을 때만. 바로 전에 한 줄은 덜 고른다
    const look = a.def.look ?? a.def.name;
    const opts = (ACT_OPTS[t.id] ?? []).filter((o) => this.has(look, `line:${o.line}`));
    if (opts.length && !t.partner) {
      const cand: { o: ActOpt; seat: number | null; w: number }[] = [];
      for (const o of opts) {
        const seat = o.seat ? this.freeSeat(a.scene, a.x, o.seat) : null;
        if (o.seat && seat === null) continue;
        cand.push({ o, seat, w: (o.line === a.lastLine ? 0.25 : 1) * (o.seat ? 1.2 : 1) * (o.once ? 0.5 : 1) });
      }
      if (cand.length) {
        let r = this.rng() * cand.reduce((n, c) => n + c.w, 0);
        const c = cand.find((x) => (r -= x.w) <= 0) ?? cand[cand.length - 1];
        a.opt = c.o;
        if (c.seat !== null) {
          const st = this.graph.scene(a.scene)!.seats![c.seat];
          a.seatPick = c.seat;
          return { x: st.x, y: st.y };
        }
        return this.randomSpot(a.scene);
      }
    }
    if (!t.partner && SEAT_KIND[t.clip] && this.has(a.def.look ?? a.def.name, `seat:${SEAT_KIND[t.clip]}`)) {
      const i = this.freeSeat(a.scene, a.x);
      const st = i === null ? null : this.graph.scene(a.scene)?.seats?.[i];
      if (st && i !== null) { a.seatPick = i; return { x: st.x, y: st.y }; }
    }
    if (t.partner) {
      const q = this.actors.find((o) => o !== a && o.def.kind === 'named' && o.scene === a.scene && (o.act === 'idle' || o.act === 'walk') && !o.route.length);
      if (q) return { x: q.x + (q.x > a.x ? -90 : 90), y: q.y };
    }
    return this.randomSpot(a.scene);
  }

  private startTask(a: Actor): void {
    const t = a.task;
    if (!t) return this.idle(a);
    if (t.partner) {
      const q = this.actors.find((o) => o !== a && (o.def.kind === 'named' || !!o.post) && o.scene === a.scene && Math.abs(o.x - a.x) < 220 && (o.act === 'idle' || o.act === 'walk' || o.act === 'post' || o.act === 'notice'));
      if (!q) {
        a.task = undefined;
        return this.idle(a, 1, 2);
      }
      // 상대도 같이 수다 (상대 사교 욕구도 찬다)
      const both = range(this.rng, t.sec[0], t.sec[1]);
      for (const [p, o] of [[a, q], [q, a]] as const) {
        p.act = 'do';
        p.task = t;
        p.wait = both;
        p.goal = null;
        p.route = [];
        p.plan = 'none';
        p.doing = `${o.def.name}와 ${t.label}`;
        p.face = o.x > p.x ? 1 : -1;
        this.setClip(p, this.canClip(p, t.clip) ? t.clip : 'idle');
      }
      this.iconOn(a, '♪', 2);
      return;
    }
    a.act = 'do';
    a.doing = a.opt?.label ?? t.label;
    a.wait = a.opt?.once ? range(this.rng, 2.5, 4) : range(this.rng, t.sec[0], t.sec[1]);
    a.plan = 'none';
    if (a.opt) a.lastLine = a.opt.line;
    // 의자에 왔으면 앉는다 (그 의자가 아직 비었을 때)
    const pick = a.seatPick;
    a.seatPick = undefined;
    const st = pick === undefined ? null : this.graph.scene(a.scene)?.seats?.[pick];
    const taken = pick !== undefined && (this.actors.some((q) => q !== a && q.scene === a.scene && q.seat?.i === pick) || (this.player?.scene === a.scene && this.player.seat === st?.box));
    if (st && pick !== undefined && !taken) {
      const kind = a.opt?.seat ? a.opt.line : SEAT_KIND[t.clip];
      this.setClip(a, `seat:${kind}`);
      a.clipUntil = this.time + a.wait;
      a.x = st.x;
      a.y = st.y;
      a.face = st.face === 'W' ? -1 : st.face === 'E' ? 1 : a.face;
      a.seat = { i: pick, dir: st.face === 'N' ? 'back' : st.face ? 'side' : 'front', kind, x: st.x, y: st.y };
      a.doing = `${a.opt?.label ?? t.label} (의자)`;
      return;
    }
    // 고른 줄이 앉는 줄인데 의자를 놓쳤으면 그 일을 하지 않는다 (허공에 앉지 않는다)
    if (a.opt?.seat) {
      a.task = undefined;
      a.opt = undefined;
      return this.idle(a, 1, 3);
    }
    if (a.opt) {
      this.setClip(a, `line:${a.opt.line}`);
      a.clipUntil = this.time + a.wait;
      return;
    }
    // 훈련 장비 앞: 과녁이면 사격, 샌드백·허수아비면 연타 (오른쪽을 보고)
    if (t.id === 'train' && a.station) {
      const gi = Number(a.station.split('#')[1]);
      const g = this.gear(a.scene)[gi];
      if (g) {
        a.face = 1;
        const clip = g.kind === 'target' ? 'shoot' : 'strike';
        this.setClip(a, this.canClip(a, clip) ? clip : 'train');
        a.doing = g.kind === 'target' ? '사격 훈련' : g.kind === 'sandbag' ? '샌드백 치기' : '허수아비 치기';
        return;
      }
    }
    // 의자를 못 잡았고 서서 하는 줄도 없으면 그 일을 하지 않는다 (없는 동작을 대기 그림으로 때우지 않는다)
    if (!this.has(a.def.look ?? a.def.name, t.clip)) {
      a.task = undefined;
      return this.idle(a, 1, 3);
    }
    this.setClip(a, t.clip);
    a.clipUntil = this.time + a.wait;
  }

  // ── 몹 판단 (8-1장: 사건은 NPC 판단에서) ──

  private mobThink(a: Actor, dt: number): void {
    if (a.act === 'gone' || a.act === 'door' || a.act === 'down' || a.act === 'dead') return;   // 기절해 누운 몸은 판단하지 않는다 (깨어날 때 따로)
    const lvl = this.uproarLevel(a.scene);
    const t = a.temper;
    if (!t) return;
    a.think -= dt;
    if (a.think > 0) return;
    a.think = range(this.rng, 0.8, 1.6);
    // 세력 평판 구간: 그 소속 몹이 주인공을 보면 (8-6장 표)
    const fac = this.mobFaction(a);
    const p0 = this.player;
    if (fac && p0 && p0.scene === a.scene && Math.abs(p0.x - a.x) < 520 && a.plan !== 'chase' && a.act !== 'argue') {
      const st = this.stance(fac);
      if (st === 'hostile') {
        // 적대: 보자마자 막아선다 (실제 공격은 전투 AI)
        a.run = 1.4;
        a.post = undefined;
        this.walkTo(a, { x: p0.x, y: p0.y || a.y }, '주인공을 막아섬', 'chase');
        this.iconOn(a, '!', 2);
        return;
      }
      if (st === 'wary' && a.act !== 'watch' && this.rng() < 0.3) {
        a.act = 'watch';
        a.doing = '주인공을 경계';
        a.goal = null;
        a.face = p0.x > a.x ? 1 : -1;
        a.wait = 2.5;
        this.iconOn(a, '?', 1.5);
        return;
      }
    }
    if (a.post || a.plan === 'chase' || a.plan === 'cordon' || a.plan === 'steal' || a.plan === 'harass' || a.act === 'argue') return;
    // 소란: 겁 많은 개체는 도망, 호기심 많은 개체는 구경 (근무형·경찰·경비 제외)
    if (['police', 'guard'].includes(ARCHETYPES[a.def.archetype ?? '']?.role ?? '')) return;
    const u = this.uproar.get(a.scene);
    if (lvl >= 1 && u) {
      if (t.courage < 0.25 + 0.15 * lvl && a.run < 1.5) return this.flee(a, u.x);
      if (t.curious > 0.6 && a.act !== 'watch' && this.rng() < 0.4) {
        a.act = 'watch';
        a.doing = '구경';
        a.goal = null;
        a.face = u.x > a.x ? 1 : -1;
        a.wait = range(this.rng, 2, 5);
        this.setClip(a, 'idle');
        this.iconOn(a, '!', 1.5);
        return;
      }
    }
    if (a.act !== 'walk' || a.plan !== 'exit') return;
    // 주인공 쳐다보기: 호기심 높은 개체가 가까이 지나갈 때 잠깐
    const p = this.player;
    if (p && p.scene === a.scene && Math.abs(p.x - a.x) < 220 && t.curious > 0.7 && this.rng() < 0.25) {
      a.act = 'watch';
      a.doing = '주인공을 힐끔';
      a.goal = null;
      a.face = p.x > a.x ? 1 : -1;
      a.wait = 1.2;
      this.setClip(a, 'idle');
      this.iconOn(a, '?', 1);
      return;
    }
    if (this.incidents(a.scene) >= 2) return;
    // 순찰 경찰이 있는 동안은 손을 안 댄다 (C16)
    if (this.patrolIn(a.scene)) return;
    // 소매치기: 손버릇 있는 개체가 가까운 걷는 행인을 노린다
    if (t.sly > 0.3 && this.rng() < 0.05 + t.sly * 0.1) {
      const v = this.nearMob(a, 500, (q) => q.act === 'walk' && q.plan === 'exit' && !q.post);
      if (v) {
        a.target = v.def.id;
        a.run = 1.2;
        return this.walkTo(a, { x: v.x - Math.sign(v.x - a.x) * 50, y: v.y }, '누군가에게 다가감', 'steal');
      }
    }
    // 시비: 밤에 취한 성급한 개체가 가까운 행인에게
    if (a.drunk && t.haste > 0.55 && this.isNight() && this.rng() < 0.06) {
      const v = this.nearMob(a, 400, (q) => q.act === 'walk' && !q.post);
      if (v) {
        a.target = v.def.id;
        return this.walkTo(a, { x: v.x - Math.sign(v.x - a.x) * 80, y: v.y }, '시비 걸러 감', 'harass');
      }
    }
  }

  private incidents(scene: string): number {
    return this.actors.filter((q) => q.scene === scene && (q.plan === 'steal' || q.plan === 'harass' || q.act === 'argue')).length;
  }
  private nearMob(a: Actor, dist: number, ok: (q: Actor) => boolean): Actor | null {
    let best: Actor | null = null;
    for (const q of this.actors) {
      if (q === a || q.def.kind !== 'mob' || q.scene !== a.scene || !ok(q)) continue;
      const d = Math.abs(q.x - a.x);
      if (d < dist && (!best || d < Math.abs(best.x - a.x))) best = q;
    }
    return best;
  }
  private gateFar(a: Actor, fromX: number): { x: number; y: number } {
    const rule = this.spawns.find((r) => r.scene === a.scene);
    const len = this.graph.scene(a.scene)?.length ?? 1280;
    const gates = rule?.gates?.length ? rule.gates : [30, len - 30];
    const x = [...gates].sort((p, q) => Math.abs(q - fromX) - Math.abs(p - fromX))[0];
    return { x, y: a.y };
  }
  /** 무기를 들이밀면(주인공이 무기를 꺼내 3m 안에서 이쪽을 봄) 겁 반응 — 동작은 그 인물에게 있는 줄만(없으면 비슷한 줄로).
   * 용기 낮음: 놀라 주저앉았다가 뒤로 기어 도망 · 보통: 뒷걸음질 → 달아나기 · 높음: 불량배는 맞서고, 그 밖은 화내고 비켜 감. 근무형·경찰·경비는 겁먹지 않음 */
  // ── 사망·시체 (10-30) ──

  /**
   * 훈련장(장소 종류 training) 장비: 방 길이·걷는 띠에 비례해 놓는다(방 크기가 바뀌어도 따라감).
   * 앞쪽 샌드백 2, 가운데 허수아비 2, 끝 사격 과녁 3(사수는 과녁 왼쪽 사대에). busy = 지금 누가 쓰는 중
   */
  gear(scene: string): Gear[] {
    if (this.graph.kind(scene) !== 'training') return [];
    const len = this.graph.scene(scene)?.length ?? 1280;
    const [top, bot] = this.graph.lane(scene);
    const d = bot - top;
    const g: Omit<Gear, 'busy'>[] = [
      { kind: 'sandbag', x: len * 0.18, y: top + d * 0.25 }, { kind: 'sandbag', x: len * 0.3, y: top + d * 0.25 },
      { kind: 'dummy', x: len * 0.44, y: top + d * 0.45 }, { kind: 'dummy', x: len * 0.56, y: top + d * 0.45 },
      { kind: 'target', x: len * 0.92, y: top + d * 0.15 }, { kind: 'target', x: len * 0.92, y: top + d * 0.45 }, { kind: 'target', x: len * 0.92, y: top + d * 0.75 },
    ];
    return g.map((q, i) => ({ ...q, x: Math.round(q.x), y: Math.round(q.y), busy: this.stationUser(scene, i) !== null }));
  }
  /** 그 장비를 지금 쓰는(또는 쓰러 가는) 사람 */
  private stationUser(scene: string, i: number): Actor | null {
    const key = `${scene}#${i}`;
    return this.actors.find((q) => q.station === key && q.scene === scene && q.task?.id === 'train' && (q.act === 'do' || (q.act === 'walk' && q.plan === 'do'))) ?? null;
  }
  /** 훈련 자리: 쏠 수 있으면 사대 먼저(반반), 아니면 샌드백·허수아비. 비어 있는 것 중 가까운 것. 없으면 null */
  private trainSpot(a: Actor): { x: number; y: number } | null {
    const gs = this.gear(a.scene);
    if (!gs.length) return null;
    const shoot = this.canClip(a, 'shoot') && this.rng() < 0.5;
    const free = gs.map((g, i) => ({ g, i })).filter(({ g, i }) => (shoot ? g.kind === 'target' : g.kind !== 'target') && this.stationUser(a.scene, i) === null);
    if (!free.length) return null;
    const { g, i } = free.sort((p, q) => Math.abs(p.g.x - a.x) - Math.abs(q.g.x - a.x))[0];
    a.station = `${a.scene}#${i}`;
    // 사수는 과녁에서 왼쪽으로 떨어진 사대, 타격은 장비 왼쪽 바로 앞 (오른쪽을 본다)
    return { x: g.kind === 'target' ? Math.round(g.x - (this.graph.scene(a.scene)?.length ?? 1280) * 0.26) : g.x - 118, y: g.y + 4 };
  }

  /** 장면의 시체 */
  corpses(scene: string): Actor[] {
    return this.actors.filter((a) => a.scene === scene && a.act === 'dead');
  }
  /** 사건 현장 표시 (수습 뒤 INCIDENT_HOURS 동안) */
  incident(scene: string): boolean {
    const t = this.sites.get(scene);
    return t !== undefined && this.gameH - t < INCIDENT_HOURS;
  }
  /** 죽음: 선 채면 사망(44), 누워 있었으면 누운 채 사망(45). 시체로 남고 큰 범죄 → 경찰 출동, 한 명은 현장으로 */
  private kill(a: Actor, lying: boolean, fromFight = false): void {
    this.playerViolence(a.scene, a.x, a, 'murder');
    a.seat = undefined;
    a.seatPick = undefined;
    a.goal = null;
    a.route = [];
    a.detour = [];
    a.hp = 0;
    a.act = 'dead';
    a.doing = '사망';
    a.say = undefined;
    a.icon = undefined;
    a.diedAt = this.gameH;
    // 그림: 사망 줄이 없으면 쓰러진 끝 장(19)으로
    this.setClip(a, lying ? (this.canClip(a, 'dieLie') ? 'dieLie' : 'down') : this.canClip(a, 'die') ? 'die' : 'down');
    if (fromFight) a.clipAt = this.time - 60;   // 전투 몸이 이미 쓰러지는 걸 틀었다 → 끝 장부터
    for (const q of this.actors) if (q.buddy === a.def.id) q.buddy = undefined;
    if (a.pocket && (DROPS.has(a.def.archetype ?? '') || a.stolen)) {
      this.events.push({ kind: 'drop', scene: a.scene, who: a.def.name, amount: a.pocket, stolen: a.stolen ?? 0, x: a.x });
      a.pocket = 0;
      a.stolen = 0;
    }
    this.events.push({ kind: 'kill', scene: a.scene, who: a.def.name, id: a.def.id, x: a.x });
    // 상한: 넘치면 오래된 시체부터 치움
    const list = this.corpses(a.scene).sort((p, q) => (p.diedAt ?? 0) - (q.diedAt ?? 0));
    for (let i = 0; i < list.length - CORPSE_MAX; i++) list[i].act = 'gone';
    this.crime(a.scene, a.x, 60);
    this.dispatchCordon(a.scene, a.x, a.y);
  }
  /** 현장 경찰(거리)·경비(실내) 한 명: 시체로 가서 라인을 치고 수습까지 지킨다. 이미 있으면 안 부름 */
  private dispatchCordon(scene: string, x: number, y: number): void {
    if (this.actors.some((q) => q.scene === scene && q.plan === 'cordon')) return;
    const len = this.graph.scene(scene)?.length ?? 1280;
    const arch = this.graph.kind(scene) === 'street' ? '경찰' : '경비';
    const gate = Math.abs(x - 30) > Math.abs(x - (len - 30)) ? len - 30 : 30;
    const [top, bot] = this.graph.lane(scene);
    const c = this.add({ id: `mob${++serial}`, name: arch, kind: 'mob', brain: 'transit', home: scene, archetype: arch, look: this.lookOf(arch), speed: 170 }, { scene, x: gate, y: this.laneMid(scene) });
    c.run = 1.3;
    const side = x > gate ? -1 : 1;
    this.walkTo(c, { x: x + side * 110, y: Math.max(top + 10, Math.min(bot - 10, y + 40)) }, '현장으로 가는 중', 'cordon');
  }
  /** 라인 묶기: 가까운 시체끼리 하나로 (시체 둘레 앞뒤·좌우로 라바콘) */
  private cordonBoxes(scene: string): Obstacle[] {
    const [top, bot] = this.graph.lane(scene);
    const boxes = this.corpses(scene).map((c) => ({ x0: c.x - 75, x1: c.x + 75, y0: Math.max(top, c.y - 30), y1: Math.min(bot, c.y + 22) }));
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length && !merged; j++) {
        const p = boxes[i], q = boxes[j];
        if (p.x0 - 20 < q.x1 && q.x0 - 20 < p.x1 && p.y0 - 20 < q.y1 && q.y0 - 20 < p.y1) {
          boxes[i] = { x0: Math.min(p.x0, q.x0), x1: Math.max(p.x1, q.x1), y0: Math.min(p.y0, q.y0), y1: Math.max(p.y1, q.y1) };
          boxes.splice(j, 1);
          merged = true;
        }
      }
    }
    return boxes.map((b, i) => ({ id: `cordon${i}`, ...b }));
  }
  private setCordon(scene: string): void {
    for (const b of this.obstacles(scene).filter((o) => o.id.startsWith('cordon'))) this.setObstacle(scene, null, b.id);
    if (!this.cordoned.has(scene)) return;
    for (const b of this.cordonBoxes(scene)) this.setObstacle(scene, b);
  }
  /** 매 틱: 현장 경찰 도착 → 라인, 1시간 지난 시체 수습, 다 치우면 라인 걷고 경찰 떠남, 사건 현장 표시 */
  private stepCorpses(): void {
    const scenes = new Set(this.actors.filter((a) => a.act === 'dead' || a.plan === 'cordon').map((a) => a.scene));
    for (const sc of [...this.cordoned]) scenes.add(sc);
    for (const sc of scenes) {
      const bodies = this.corpses(sc);
      // 시체가 있는 동안은 소란이 가라앉지 않는다
      if (bodies.length) this.uproar.set(sc, { v: Math.max(this.uproar.get(sc)?.v ?? 0, 80), x: bodies[0].x });
      const old = bodies.filter((b) => this.gameH - (b.diedAt ?? 0) >= CLEAR_HOURS);
      if (old.length) {
        for (const b of old) b.act = 'gone';
        this.events.push({ kind: 'cleared', scene: sc, n: old.length });
      }
      if (this.corpses(sc).length) {
        if (this.cordoned.has(sc) && old.length) this.setCordon(sc);
        continue;
      }
      // 다 치움: 라인 걷고 현장 경찰은 떠난다
      if (old.length || this.cordoned.has(sc)) this.sites.set(sc, this.gameH);
      this.cordoned.delete(sc);
      this.setCordon(sc);
      for (const q of this.actors.filter((x) => x.scene === sc && x.plan === 'cordon')) {
        const len = this.graph.scene(sc)?.length ?? 1280;
        q.exitAt = { x: q.x < len / 2 ? 30 : len - 30, y: q.y };
        q.run = 1;
        this.walkTo(q, q.exitAt, '현장 정리 끝', 'exit');
      }
    }
  }
  /** 현장 경찰이 도착: 라인을 치고 지킨다 */
  private arriveCordon(a: Actor): void {
    a.act = 'watch';
    a.doing = '현장 통제';
    a.wait = 1e9;
    a.run = 1;
    a.face = (this.corpses(a.scene).some((b) => b.x > a.x) ? 1 : -1);
    this.setClip(a, 'idle');
    this.cordoned.add(a.scene);
    this.setCordon(a.scene);
  }
  /** 구경꾼(퍽): 소란이 난 장면에서 걷다가 멈춰 구경한다 (뒷짐 구경·발견·두리번 중 가진 줄) */
  private gawk(a: Actor, dt: number): void {
    if (!this.perk(a, '구경꾼') || (a.lookCd = (a.lookCd ?? 0) - dt) > 0) return;
    if (!['walk', 'idle'].includes(a.act) || a.fighting || a.plan === 'chase' || this.uproarLevel(a.scene) < 1) return;
    a.lookCd = 25;
    const clip = ['browse', 'spot', 'idle'].find((c) => this.canClip(a, c)) ?? 'idle';
    const u = this.uproar.get(a.scene);
    if (u) a.face = u.x > a.x ? 1 : -1;
    a.act = 'pause';
    a.doing = '구경';
    a.wait = range(this.rng, 4, 8);
    this.setClip(a, clip);
  }
  /** 시체를 봄 (경찰·경비·현장 사람 빼고, 한 번만): 겁 많으면 겁 반응·도망, 중간이면 놀라 피해 감, 용감하면 신고 */
  private seeBody(a: Actor): void {
    if (a.sawBody || a.fighting || a.post || a.def.kind !== 'mob' || !['walk', 'idle', 'pause'].includes(a.act) || a.plan === 'chase' || a.plan === 'cordon') return;
    const role = ARCHETYPES[a.def.archetype ?? '']?.role;
    // 순찰 경찰이 시체를 봄: 현장 경찰이 아직 없으면 자기가 맡는다 (라인·수습까지)
    if (a.patrol) {
      const body = this.actors.find((q) => q.act === 'dead' && q.scene === a.scene && Math.abs(q.x - a.x) < SEE_BODY_PX * 1.5);
      if (!body || this.actors.some((q) => q.scene === a.scene && q.plan === 'cordon')) return;
      a.sawBody = true;
      a.patrol = false;
      a.buddy = undefined;
      const [top, bot] = this.graph.lane(a.scene);
      this.iconOn(a, '!', 2);
      this.say(a, '여기 현장 통제합니다.', 2.5);
      return this.walkTo(a, { x: body.x + (a.x < body.x ? -110 : 110), y: Math.max(top + 10, Math.min(bot - 10, body.y + 40)) }, '현장으로 가는 중', 'cordon');
    }
    if (role === 'police' || role === 'guard') return;
    const b = this.actors.find((q) => q.act === 'dead' && q.scene === a.scene && Math.abs(q.x - a.x) < SEE_BODY_PX && Math.abs(q.y - a.y) < 140);
    if (!b) return;
    a.sawBody = true;
    a.buddy = undefined;
    const c = a.temper?.courage ?? 0.3;
    this.iconOn(a, '!', 2);
    const reporter = this.perk(a, '신고 정신') && !this.cordoned.has(a.scene);   // 신고 정신(퍽): 겁먹어도 먼저 신고
    if (c < 0.4 && !reporter) return this.scareAt(a, b.x, b.x);
    if ((c < 0.7 && !reporter) || this.cordoned.has(a.scene)) {
      // 놀라서 현장을 피해 돌아감
      a.act = 'scared';
      a.scare = 'run';
      a.scareFrom = b.x;
      a.goal = null;
      a.wait = 1.2;
      a.doing = '놀람';
      a.face = b.x > a.x ? 1 : -1;
      this.setClip(a, this.canClip(a, 'surprise') ? 'surprise' : 'idle');
      return;
    }
    // 용감: 신고 (경찰이 아직 없으면 현장 경찰을 부른다), 그 뒤 피해 감
    a.act = 'scared';
    a.scare = 'run';
    a.scareFrom = b.x;
    a.goal = null;
    a.wait = 3;
    a.doing = '신고 중';
    a.face = b.x > a.x ? 1 : -1;
    this.setClip(a, this.canClip(a, 'call') ? 'call' : this.canClip(a, 'phone') ? 'phone' : 'surprise');
    this.events.push({ kind: 'report', scene: a.scene, who: a.def.name, x: b.x });
    this.dispatchCordon(a.scene, b.x, b.y);
  }

  private threatened(a: Actor, dt: number): void {
    if (a.scareCd && (a.scareCd -= dt) > 0) return;
    const p = this.player;
    if (!p?.armed || p.scene !== a.scene || a.fighting || a.post || !a.temper) return;
    if (['down', 'scared', 'gone', 'door', 'argue'].includes(a.act) || a.doing === '도망' || a.doing === '기어서 도망') return;
    const role = ARCHETYPES[a.def.archetype ?? '']?.role;
    if (role === 'police' || role === 'guard') return;
    const dx = a.x - p.x;
    if (Math.abs(dx) > 300 || Math.abs(a.y - p.y) > 90 || Math.sign(dx) !== Math.sign(p.face ?? 1)) return;
    a.scareCd = 8;
    a.seatPick = undefined;
    const c = a.temper.courage;
    this.iconOn(a, '!', 1.5);
    if (c >= (this.perk(a, '싸움꾼') ? 0.55 : 0.7)) {
      if (role === 'thug') { a.act = 'argue'; a.doing = '맞섬'; a.wait = 3; this.iconOn(a, '#', 3); return; }
      a.act = 'argue'; a.doing = '화냄'; a.wait = 1.2;
      this.setClip(a, this.canClip(a, 'angry') ? 'angry' : 'idle');
      return;
    }
    this.scareAt(a, p.x);
  }
  /** 겁에 질림: from = 겁나게 한 것의 x (무기 든 주인공·시체) */
  private scareAt(a: Actor, from: number, why?: number): void {
    const c = a.temper?.courage ?? 0.3;
    const dx = a.x - from;
    a.scareFrom = why;
    a.goal = null;
    a.act = 'scared';
    a.face = dx > 0 ? -1 : 1;
    // 도망도 사람마다: 용기가 낮을수록 얼어붙거나 기어서, 높을수록 뒷걸음질·뛰어서. 같은 용기라도 무작위로 갈림
    const w: [NonNullable<Actor['scare']>, number][] = [['freeze', 1 - c * 2], ['sit', 1.1 - c * 1.5], ['cower', 1 - c], ['backoff', 0.2 + c], ['run', 0.3 + c]];
    let r = this.rng() * w.reduce((n, [, v]) => n + Math.max(0, v), 0);
    a.scare = w.find(([, v]) => (r -= Math.max(0, v)) <= 0)?.[0] ?? 'run';
    const clip = (...l: string[]) => l.find((x) => this.canClip(a, x)) ?? 'idle';
    switch (a.scare) {
      case 'freeze': a.wait = 3; a.doing = '얼어붙음'; this.setClip(a, clip('sitdown', 'cower', 'surprise')); break;
      case 'sit': a.wait = 1.6; a.doing = '주저앉음'; this.setClip(a, clip('sitdown', 'cower', 'surprise')); break;
      case 'cower': a.wait = 1.4; a.doing = '웅크려 떪'; this.setClip(a, clip('cower', 'sitdown', 'surprise')); break;
      case 'backoff': a.wait = 1.3; a.doing = '뒷걸음질'; this.setClip(a, clip('backoff', 'surprise')); break;
      case 'run': a.wait = 0.4; a.doing = '놀람'; this.setClip(a, clip('surprise', 'idle')); break;
    }
    this.events.push({ kind: 'flee', scene: a.scene, who: a.def.name });
  }
  /** 전투에서 달아남(기세가 꺾임): 전투 몸에서 돌아와 장면 밖으로 */
  fledFight(id: string, x: number, y: number): void {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || !a.fighting) return;
    a.fighting = false; a.x = x; a.y = y; a.plan = 'none';
    this.flee(a, this.player?.x ?? x);
  }
  private flee(a: Actor, fromX: number, clip = 'flee', run = 1.8): void {
    a.seatPick = undefined;
    a.run = run * (this.perk(a, '날쌘 도망') ? 1.3 : 1);   // 날쌘 도망(퍽): 30% 빨리
    a.exitAt = this.gateFar(a, fromX);
    this.walkTo(a, a.exitAt, clip === 'crawl' || clip === 'scramble' ? '기어서 도망' : '도망', 'exit');
    this.setClip(a, this.canClip(a, clip) ? clip : this.canClip(a, 'flee') ? 'flee' : 'walk');
    a.fleeClip = clip;
    this.iconOn(a, '!', 1.5);
    this.events.push({ kind: 'flee', scene: a.scene, who: a.def.name });
  }

  private doSteal(a: Actor): void {
    const v = this.actors.find((q) => q.def.id === a.target);
    a.target = undefined;
    if (!v || v.scene !== a.scene) return this.resume(a);
    // 실제로 옮긴다: 피해자 주머니에서 절반쯤 (잡으면 도둑이 떨어뜨린다)
    const take = Math.round(((v.pocket ?? 0) * (0.3 + this.rng() * 0.5)) / 100) * 100;
    v.pocket = (v.pocket ?? 0) - take;
    a.pocket = (a.pocket ?? 0) + take;
    a.stolen = (a.stolen ?? 0) + take;
    this.events.push({ kind: 'steal', scene: a.scene, thief: a.def.name, victim: v.def.name, x: v.x });
    this.disturb(a.scene, 12, v.x);
    // 도둑: 반대쪽 출입구로 뛴다
    a.run = 1.9;
    a.exitAt = this.gateFar(a, v.x);
    this.walkTo(a, a.exitAt, '훔치고 달아남', 'exit');
    this.iconOn(v, '!', 2.5);
    // 피해자: 용감하면 쫓고, 아니면 멈춰 선다
    if ((v.temper?.courage ?? 0) > 0.6) {
      v.target = a.def.id;
      v.run = 1.6;
      this.walkTo(v, { x: a.x, y: a.y }, '도둑을 쫓음', 'chase');
      v.wait = 0;
    } else {
      v.act = 'watch';
      v.doing = '털림';
      v.goal = null;
      v.wait = 3;
    }
    // 주변: 용감한 행인은 쫓고, 호기심 많은 행인은 구경
    for (const q of this.actors) {
      if (q === a || q === v || q.scene !== a.scene || q.def.kind !== 'mob' || q.post || Math.abs(q.x - v.x) > 450) continue;
      const t = q.temper!;
      if (t.courage > 0.85 && this.rng() < 0.5) {
        q.target = a.def.id;
        q.run = 1.6;
        this.walkTo(q, { x: a.x, y: a.y }, '도둑을 쫓음', 'chase');
      } else if (t.curious > 0.5) {
        q.act = 'watch';
        q.doing = '구경';
        q.goal = null;
        q.face = v.x > q.x ? 1 : -1;
        q.wait = range(this.rng, 2, 4);
      }
    }
  }

  private doHarass(a: Actor): void {
    const v = this.actors.find((q) => q.def.id === a.target);
    a.target = undefined;
    if (!v || v.scene !== a.scene) return this.resume(a);
    this.events.push({ kind: 'harass', scene: a.scene, who: a.def.name, target: v.def.name, x: v.x });
    this.disturb(a.scene, 8, v.x);
    a.act = 'argue';
    a.doing = '시비 거는 중';
    a.goal = null;
    a.face = v.x > a.x ? 1 : -1;
    a.wait = range(this.rng, 4, 7);
    this.setClip(a, this.canClip(a, 'angry') ? 'angry' : 'idle');
    this.iconOn(a, '#', 3);
    // 상대: 겁 많으면 도망, 아니면 맞받아침
    if ((v.temper?.courage ?? 0) < 0.4) return this.flee(v, a.x);
    v.act = 'argue';
    v.doing = '맞받아침';
    v.goal = null;
    v.face = a.x > v.x ? 1 : -1;
    v.wait = a.wait;
    this.iconOn(v, '#', 3);
  }

  // ── 근무형 (6-3장) ──

  private stepPost(p: Post): void {
    const on = inShift(this.hour, p.shifts) && (p.uproar === undefined || this.uproarLevel(p.scene) >= p.uproar);
    const workers = this.actors.filter((a) => a.post?.id === p.id && a.plan !== 'exit');
    if (on && workers.length < p.count) {
      const [top, bot] = this.graph.lane(p.scene);
      const a = this.add({ id: `post${++serial}`, name: p.archetype, kind: 'mob', brain: 'post', home: p.scene, archetype: p.archetype, look: ARCHETYPES[p.archetype]?.looks?.length ? pick(this.rng, ARCHETYPES[p.archetype]!.looks!) : p.archetype }, { scene: p.scene, x: p.gate, y: (top + bot) / 2 });
      a.post = p;
      a.postI = 0;
      // 직원도 욕구가 있다 (10-31 자율 행동 1단계): 근무 중에 배고프거나 급하면 쉬러 갔다가 자리로 돌아온다
      a.needs = fullNeeds(this.rng);
      this.goPost(a);
      this.events.push({ kind: 'shift', scene: p.scene, who: p.archetype, on: true });
    } else if (!on) {
      for (const a of workers) {
        // 퇴근: 근무 장면의 출입구로 걸어 나간다 (순회 중이면 지금 장면 아무 끝으로)
        a.post = undefined;
        a.route = [];
        a.exitAt = a.scene === p.scene ? { x: p.gate, y: a.y } : this.gateFar(a, a.x);
        this.walkTo(a, a.exitAt, '퇴근', 'exit');
        this.events.push({ kind: 'shift', scene: p.scene, who: p.archetype, on: false });
      }
    }
  }

  private goPost(a: Actor): void {
    const p = a.post!;
    const [top, bot] = this.graph.lane(a.scene);
    if (p.how === 'fixed') {
      if (a.scene !== p.scene) return this.travel(a, p.scene, 'roam-post');
      return this.walkTo(a, { x: p.spot ?? 400, y: p.y ?? top + 30 }, '자리로', 'post');
    }
    if (p.how === 'patrol') {
      const [l, r] = p.span ?? [100, (this.graph.scene(a.scene)?.length ?? 1280) - 100];
      const x = Math.abs(a.x - l) < Math.abs(a.x - r) ? r : l;
      return this.walkTo(a, { x, y: range(this.rng, top + 20, bot - 10) }, '순찰', 'post');
    }
    // 책상 일(사무): 그 방 빈 의자에 앉아 타자. 끝나면 decide → 다시 여기 (사이사이 쉬는 시간)
    if (p.how === 'desk' || p.how === 'train') {
      if (a.scene !== p.scene) return this.travel(a, p.scene, 'roam-post');
      if (this.takeBreak(a)) return;
      if (p.how === 'desk') {
        const work = ACTIVITIES.find((t) => t.id === 'work')!;
        a.task = work;
        return this.walkTo(a, this.taskSpot(a, work), '책상으로', 'do');
      }
      // 훈련(전투원): 빈 훈련 장비가 있으면 거기서(샌드백·허수아비·사격), 없으면 장비 점검·팔굽혀펴기·기지개를 돌아가며 방 안 아무 데서나
      const train = ACTIVITIES.find((t) => t.id === 'train')!;
      const st = this.trainSpot(a);
      if (st) { a.task = train; return this.walkTo(a, st, '훈련하러', 'do'); }
      const opts = ['pushup', 'work', 'limber'].filter((c) => this.canClip(a, c) && c !== a.trainClip);
      a.trainClip = opts.length ? pick(this.rng, opts) : 'idle';
      return this.walkTo(a, this.randomSpot(a.scene), '훈련하러', 'post');
    }
    // 순회: 경로의 다음 장면으로, 머문 뒤 또 다음
    const route = p.route?.length ? p.route : [p.scene];
    const want = route[(a.postI ?? 0) % route.length];
    if (a.scene !== want) return this.travel(a, want, 'roam-post');
    a.postI = (a.postI ?? 0) + 1;
    a.act = 'post';
    a.doing = `순회 중 (${this.graph.scene(a.scene)?.name ?? a.scene})`;
    a.wait = p.stay ?? 30;
    a.plan = 'roam-post';
    this.setClip(a, this.canClip(a, 'work') ? 'work' : 'idle');
  }

  private postStand(a: Actor, dt: number): void {
    a.wait -= dt;
    if (a.wait > 0) return;
    if (this.takeBreak(a)) return;
    // 경비·요원: 근무 중 가끔 무전 보고·수첩 메모 (그 줄이 있는 그림만)
    if (['guard', 'police'].includes(ARCHETYPES[a.def.archetype ?? '']?.role ?? '') && this.rng() < 0.2) {
      const clip = ['radio', 'memo'].find((c) => this.canClip(a, c));
      if (clip) { a.doing = clip === 'radio' ? '무전 보고' : '수첩 메모'; a.wait = range(this.rng, 3, 5); this.setClip(a, clip); return; }
    }
    // 의사: 의무실에 사람이 있으면 다가가 진료 (청진·맥·소독·붕대·기록 줄)
    if (a.def.archetype === '의사' && this.canClip(a, 'exam') && this.rng() < 0.5) {
      const pt = this.actors.find((q) => q !== a && q.scene === a.scene && q.def.kind === 'named' && !q.fighting && q.act !== 'walk');
      if (pt) { a.patient = pt.def.id; return this.walkTo(a, { x: pt.x + (pt.x > a.x ? -80 : 80), y: pt.y }, '진료하러', 'treat'); }
    }
    if (a.post?.how === 'roam' || a.post?.how === 'patrol' || a.post?.how === 'train') return this.goPost(a);
    // 고정: 자리에서 조금씩 몸만 돌린다
    a.face = this.rng() < 0.5 ? 1 : -1;
    a.wait = range(this.rng, 4, 9);
  }

  /** 동료(이름 요원·직원)끼리: 지나가다 인사, 둘 다 한가하면 선 채 대화, 드물게 말다툼. 그림에 있는 줄만 */
  private socialStep(a: Actor, dt: number): void {
    if ((a.chatCd = (a.chatCd ?? range(this.rng, 5, 20)) - dt) > 0) return;
    const mate = (q: Actor) => (q.def.kind === 'named' || !!q.post) && !q.fighting;
    if (!mate(a) || !['walk', 'idle', 'post'].includes(a.act) || a.seat) { a.chatCd = range(this.rng, 3, 8); return; }
    const q = this.actors.find((o) => o !== a && o.scene === a.scene && mate(o) && ['walk', 'idle', 'post'].includes(o.act) && !o.seat
      && (o.chatCd ?? 0) <= 0 && Math.abs(o.x - a.x) < 110 && Math.abs(o.y - a.y) < 50);
    if (!q) { a.chatCd = range(this.rng, 3, 8); return; }
    a.chatCd = q.chatCd = range(this.rng, 30, 70);
    const both = (clipA: string, clipB: string, doing: string, sec: number) => {
      for (const [p, o, c] of [[a, q, clipA], [q, a, clipB]] as const) {
        p.act = 'pause'; p.doing = doing; p.wait = sec; p.face = o.x > p.x ? 1 : -1;
        this.setClip(p, this.canClip(p, c) ? c : 'idle');
      }
    };
    const soc = (x: Actor) => x.temper?.social ?? 0.5;
    // 둘 다 사교성이 아주 낮으면 드물게 말다툼
    if (soc(a) < 0.25 && soc(q) < 0.25 && this.rng() < 0.1) { both('angry', 'angry', '말다툼', range(this.rng, 2, 4)); this.iconOn(a, '#', 2); return; }
    // 둘 중 하나라도 걷는 중: 지나가다 인사 (먼저 본 쪽 응대, 상대 끄덕)
    if (a.act === 'walk' || q.act === 'walk') { both('greet', 'nod', '인사', 1.4); return; }
    // 둘 다 한가: 수다 욕구가 덜 찼으면 선 채 대화 (손짓·끄덕)
    if ((a.needs?.social ?? 50) < 80 || (q.needs?.social ?? 50) < 80) { both('talk', 'nod', `대화 (${q.def.name})`, range(this.rng, 6, 12)); q.doing = `대화 (${a.def.name})`; this.iconOn(a, '♪', 1.5); }
  }

  /** 직원 쉬는 시간: 일 말고 가장 급한 욕구(배고픔·화장실·쉬기·수다)가 크면 같은 소속 건물 안에서 그 일을 할 곳으로. 끝나면 decide → 자리로 */
  private takeBreak(a: Actor): boolean {
    const p = a.post;
    if (!p || !a.needs) return false;
    const fac = this.sceneFaction(p.scene);
    const roam = fac ? this.graph.ids().filter((id) => this.sceneFaction(id) === fac) : [p.scene];
    const c = choose({
      name: a.def.name, needs: a.needs, scene: a.scene, roam, graph: this.graph, has: (clip) => this.canClip(a, clip), duty: false,
      partnerIn: (s) => this.actors.some((q) => q !== a && q.scene === s && (q.def.kind === 'named' || !!q.post) && ['idle', 'walk', 'post'].includes(q.act) && !q.route.length),
      rand: this.rng, last: a.last, fighter: ['guard', 'police'].includes(ARCHETYPES[a.def.archetype ?? '']?.role ?? ''),   // 경비·요원만 훈련
    });
    if (!c || c.score < 30) return false;
    a.task = c.act;
    if (c.scene === a.scene) { this.walkTo(a, this.taskSpot(a, c.act), `${c.act.label} 하러`, 'do'); return true; }
    const path = this.graph.route(a.scene, c.scene);
    const d = path && this.graph.doorSpot(a.scene, path[0].exit);
    if (!path || !d) { a.task = undefined; return false; }
    a.route = path;
    this.walkTo(a, d, `${c.act.label} 하러 ${this.graph.scene(c.scene)?.name ?? c.scene}(으)로`, 'do');
    return true;
  }

  private travel(a: Actor, scene: string, plan: Plan): void {
    const path = this.graph.route(a.scene, scene);
    const d = path && this.graph.doorSpot(a.scene, path[0].exit);
    if (!path || !d) return this.idle(a);
    a.route = path;
    this.walkTo(a, d, `${this.graph.scene(scene)?.name ?? scene}(으)로`, plan);
  }

  // ── 몹 보충 (6-2장) ──

  private stepSpawn(r: SpawnRule, dt: number): void {
    const night = this.isNight();
    const lvl = this.uproarLevel(r.scene);
    // 소란이 크면 덜 들어온다. 시체가 있거나 사건 현장(수습 뒤 하루)이면 더 덜
    const inc = this.sites.get(r.scene);
    const scared = this.corpses(r.scene).length ? 2 : inc !== undefined && this.gameH - inc < INCIDENT_HOURS ? 1 : 0;
    const band = this.bandOf(r);
    const want = Math.max(0, (band ? band.n : night ? r.target.night : r.target.day) - lvl - scared);
    const have = this.actors.filter((a) => a.def.kind === 'mob' && a.def.brain === 'transit' && a.scene === r.scene && a.plan !== 'chase' && a.plan !== 'cordon' && a.act !== 'dead').length;
    if (have >= want) return void this.spawnT.delete(r.scene);
    const visible = this.player?.scene === r.scene;
    if (!visible) {
      for (let i = have; i < want; ) i += this.spawnOne(r, null, true, want - i);
      return void this.spawnT.delete(r.scene);
    }
    const left = (this.spawnT.get(r.scene) ?? 0) - dt;
    if (left > 0) return void this.spawnT.set(r.scene, left);
    // 붐비는 시간일수록 자주 들어온다 (사람이 지나가 나가는 만큼 채운다)
    this.spawnT.set(r.scene, (range(this.rng, r.refill[0], r.refill[1]) * (1 + lvl)) / Math.max(1, want / 6));
    this.spawnOne(r, this.player!.x, false, want - have);
  }

  /** 지금 시각의 유동인구 구간 (시계 없으면 낮 12시로 본다) */
  private bandOf(r: SpawnRule): { n: number; mix: string[] } | null {
    if (!r.bands?.length) return null;
    const h = this.hour ?? 12;
    const b = r.bands.find((q) => (q.from <= q.to ? h >= q.from && h < q.to : h >= q.from || h < q.to)) ?? r.bands[0];
    // n 은 1,000px당 인원 → 장면 길이만큼
    return { n: Math.round((b.n * (this.graph.scene(r.scene)?.length ?? 1000)) / 1000), mix: b.mix };
  }
  private mixOf(r: SpawnRule): string[] {
    return this.bandOf(r)?.mix ?? (this.isNight() && r.nightMix?.length ? r.nightMix : r.mix);
  }
  /** 한 명(또는 일행 둘) 들여보냄. 들어온 수 */
  private spawnOne(r: SpawnRule, playerX: number | null, anywhere: boolean, room = 1): number {
    const len = this.graph.scene(r.scene)?.length ?? 1280;
    const gates = r.gates?.length ? r.gates : [30, len - 30];
    const from = playerX === null ? pick(this.rng, gates) : [...gates].sort((p, q) => Math.abs(q - playerX) - Math.abs(p - playerX))[0];
    const others = gates.filter((g) => g !== from);
    const to = pick(this.rng, others.length ? others : gates);
    const [top, bot] = this.graph.lane(r.scene);
    const mix = this.mixOf(r);
    const name = pick(this.rng, mix);
    const arch = ARCHETYPES[name];
    const look = arch?.looks?.length ? pick(this.rng, arch.looks) : name;
    const a = this.add({ id: `mob${++serial}`, name, kind: 'mob', brain: 'transit', home: r.scene, archetype: name, look, speed: range(this.rng, 110, 170) }, { scene: r.scene, x: anywhere ? range(this.rng, MARGIN, len - MARGIN) : from, y: range(this.rng, top + 20, bot - 10) });
    if (a.temper) a.def.speed = (a.def.speed ?? WALK) * (0.85 + a.temper.haste * 0.35);
    a.exitAt = { x: to, y: range(this.rng, top + 20, bot - 10) };
    this.walkTo(a, a.exitAt, a.drunk ? '비틀거리며 지나감' : '지나가는 중', 'exit');
    // 일행: 친화가 높으면 가끔 아는 사람과 같이 들어와 나란히 걷는다 (시민·학생·직장인·불량배)
    const role = arch?.role;
    if (room < 2 || !a.temper || !['civilian', 'student', 'worker', 'thug'].includes(role ?? '') || this.rng() >= 0.3 * a.temper.social) return 1;
    const mates = mix.filter((m) => ARCHETYPES[m]?.role === role);
    const name2 = mates.length ? pick(this.rng, mates) : name;
    const arch2 = ARCHETYPES[name2];
    const dy = a.y - top > bot - a.y ? -26 : 26;
    const b = this.add({ id: `mob${++serial}`, name: name2, kind: 'mob', brain: 'transit', home: r.scene, archetype: name2, look: arch2?.looks?.length ? pick(this.rng, arch2.looks) : name2, speed: a.def.speed },
      { scene: r.scene, x: a.x - (to > a.x ? 24 : -24), y: a.y + dy });
    b.buddy = a.def.id;
    b.buddyDy = dy;
    b.exitAt = { x: to, y: Math.max(top + 10, Math.min(bot - 10, a.exitAt.y + dy)) };
    b.drunk = a.drunk;
    this.walkTo(b, b.exitAt, '일행과 걷는 중', 'exit');
    return 2;
  }
}

export { ACTIVITIES };
