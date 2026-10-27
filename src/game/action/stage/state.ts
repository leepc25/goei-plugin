// 영구 기록(StageMeta)과 출동 상태(Outing). 엔진·화면과 무관, JSON으로 저장된다.
import { B12 } from './data/floortypes';
import { RESHUFFLE_POOL, RULE, VARIANT_POOL, ruleText } from './data/rules';
import { clampFavor } from './elevator';
import { mix, rng, shuffle } from './rng';
import type { Dir, Floor, FloorType, ServiceZone } from './types';

export const META_VERSION = 1;
export interface StageMeta {
  version: number;
  /** EXIT 재편 횟수 */
  epoch: number;
  /** 규칙별 지금 쓰이는 문장 번호 (재편 때 바뀜) */
  ruleVer: Record<string, number>;
  /** 송신해서 규칙서에 남은 줄: id → 알던 문장 번호 */
  known: Record<string, number>;
  favor: number;
  deepest: number;
  bestFloors: number;
  outings: number;
  exits: number;
  lonelyHeard: boolean;
  /** 다락방 지도를 송신하면 다음 출동 브리핑에 유형 힌트 */
  mapHint: FloorType | null;
}
export function newMeta(): StageMeta {
  return { version: META_VERSION, epoch: 0, ruleVer: {}, known: {}, favor: 0, deepest: 0, bestFloors: 0, outings: 0, exits: 0, lonelyHeard: false, mapHint: null };
}
export const ruleVersion = (m: StageMeta, id: string) => m.ruleVer[id] ?? 0;
/** 지금 판에 맞는 규칙서 줄 (재편으로 바뀐 줄은 빠진다) */
export const currentKnown = (m: StageMeta) => Object.keys(m.known).filter((id) => m.known[id] === ruleVersion(m, id));
/** 재편 뒤 낡은 줄 (취소선) */
export const staleKnown = (m: StageMeta) => Object.keys(m.known).filter((id) => m.known[id] !== ruleVersion(m, id));
export function rulebook(m: StageMeta): { id: string; text: string; stale: boolean; oldText?: string }[] {
  return Object.keys(m.known).map((id) => {
    const stale = m.known[id] !== ruleVersion(m, id);
    return { id, text: ruleText(id, stale ? m.known[id] : ruleVersion(m, id)), stale };
  });
}
export function exitOpen(m: StageMeta): boolean {
  return currentKnown(m).length >= 10 && m.favor >= 3 && m.deepest >= B12;
}
export function exitProgress(m: StageMeta): string {
  return `규칙 ${currentKnown(m).length}/10 · 총애 ${m.favor}/3 · 최저 ${m.deepest >= B12 ? 'B-12 ✓' : m.deepest > 3 ? `B-${m.deepest - 3}` : '—'}/B-12`;
}
/** EXIT를 눌렀다: 승강기 재편. 공통 줄 3개 문장이 바뀌고(이전 줄 취소선), 총애 0, 유형·수호자·승객 진실이 다시 섞인다(epoch). */
export function reshuffle(m: StageMeta): string[] {
  m.exits++;
  m.epoch++;
  const r = rng(mix(m.epoch, m.exits, 4242));
  const pool = shuffle(r, RESHUFFLE_POOL.filter((id) => ruleVersion(m, id) + 1 < RULE[id].texts.length));
  const changed = pool.slice(0, 3);
  for (const id of changed) m.ruleVer[id] = ruleVersion(m, id) + 1;
  m.favor = 0;
  m.lonelyHeard = false;
  return changed;
}

export type Where = 'floor' | 'car' | 'service' | 'ending' | 'side';
export type Target =
  | { to: 'floor'; depth: number; type: FloorType; sub: Floor['sub']; startX?: number; room?: [number, number]; from?: Dir }
  | { to: 'car' }
  | { to: 'service'; col: number; row: number; fromX?: number; side?: 'l' | 'r' | 'u' | 'd' | 'down' }
  | { to: 'side'; depth: number; door: string; secret: boolean; label: string }
  | { to: 'ending' };

export interface Outing {
  seed: number;
  agent: string;
  danger: number;
  growth: number;
  /** 이번 출동에 뒤집힌 규칙 id */
  variants: string[];
  flags: string[];
  depth: number;
  lastTypes: FloorType[];
  visited: { depth: number; type: FloorType }[];
  /** 이번 출동에서 읽었지만 아직 송신 안 한 규칙 */
  found: string[];
  sent: string[];
  where: Where;
  floor: Floor | null;
  /** 정비 구역 */
  service: ServiceZone | null;
  serviceDepth: number;
  cell: [number, number];
  serviceTime: number;
  rerolls: number;
  returnX: number;
  /** 승강기 */
  greeted: boolean;
  closeCount: number;
  rideAttack: boolean;
  stuck: number;
  reveal: boolean;
  tired: boolean;
  deals: number;
  pending: Target | null;
  rescued: string[];
  escort: string | null;
  items: string[];
  favorDelta: number;
  log: string[];
  ending: boolean;
  /** 같은 층을 다시 만들 때 쓰는 번호 (승강기 탑승마다 +1) */
  ride: number;
  // ── 출동 단위 메트로배니아 (기본기획서 6.2·8.4 「메트로배니아 쪽」, 15.1)
  /** 깊이별로 한 번 정해진 층 유형 (되돌아와도 같은 층) */
  floorTypes: Record<number, { type: FloorType; sub: Floor['sub'] }>;
  /** 주운 정비 열쇠: 그 열쇠가 여는 층 깊이 */
  keys: number[];
  /** 연 방화셔터가 있는 층 깊이 */
  gatesOpen: number[];
  /** 위층 점검문이 열린 층 (정비 구역에서 내려와 연 지름길) */
  shortcuts: number[];
  /** 숨은 길이 있는 층 (출동당 0~1, 0 = 없음) */
  secretDepth: number;
  /** 정비 구역: 깊이별 다시 짜인 횟수, 본 칸 */
  services: Record<number, { reroll: number; seen: string[]; key: boolean; zone?: ServiceZone }>;
  /** 층마다 가 본 x 범위 (지도) */
  explored: Record<number, [number, number]>;
  /** 층마다 처음 들어간 해치·점검문 x (정비 구역에서 올라올 자리) */
  hatchX: Record<number, number>;
  /** 곁가지 방: "깊이:문 id" → 보상 받음 */
  sides: Record<string, { done: boolean; secret: boolean; x: number }>;
  /** 강화 선택으로 고른 것 */
  upgrades: string[];
  upgradeN: number;
  /** 싸움 이긴 수 (세 판마다 강화) */
  fightsWon: number;
  /** 출동 레벨 1~10 (기본기획서 16.2): 이상 파편이 모이면 오르고 오를 때마다 강화 하나. 옛 저장엔 없음 → 1 */
  runLevel?: number;
  // ── 층 = 방 격자 세상 (gen/world.ts)
  /** 지금 방 [col,row] */
  room: [number, number];
  /** 주운 열쇠 "깊이:번호" */
  wkeys: string[];
  /** 연 잠금·부순 벽 (gen/world edgeId) */
  unlocked: string[];
  broken: string[];
  /** 깊이별 가 본 방 "col,row" */
  seenRooms: Record<number, string[]>;
  /** 보상을 받은 방 "깊이:col,row" */
  rewards: string[];
  /** 정비 구역에 들어간 방 (올라올 자리) */
  hatchRoom: Record<number, [number, number]>;
  /** 모든 방을 정리한 깊이 (승강기 패널이 켜진다) */
  clearedFloors: number[];
}

export function newOuting(meta: StageMeta, o: { seed: number; agent: string; danger?: number }): Outing {
  const r = rng(mix(o.seed, meta.epoch, 1234));
  const variants = shuffle(r, [...VARIANT_POOL]).slice(0, 1 + Math.floor(r() * 2));
  return {
    seed: o.seed,
    agent: o.agent,
    danger: o.danger ?? 0,
    growth: Math.min(5, Math.floor(meta.outings / 4)),
    variants,
    flags: variants.map((id) => RULE[id].variant!.flag),
    depth: 1,
    lastTypes: [],
    visited: [],
    found: [],
    sent: [],
    where: 'floor',
    floor: null,
    service: null,
    serviceDepth: 0,
    cell: [0, 0],
    serviceTime: 0,
    rerolls: 0,
    returnX: 0,
    greeted: false,
    closeCount: 0,
    rideAttack: false,
    stuck: 0,
    reveal: false,
    tired: false,
    deals: 0,
    pending: null,
    rescued: [],
    escort: null,
    items: [],
    favorDelta: 0,
    log: [],
    ending: false,
    ride: 0,
    floorTypes: {},
    keys: [],
    gatesOpen: [],
    shortcuts: [],
    secretDepth: r() < 0.75 ? 2 + Math.floor(r() * 4) : 0,
    services: {},
    explored: {},
    hatchX: {},
    sides: {},
    upgrades: [],
    upgradeN: 0,
    fightsWon: 0,
    room: [0, 0],
    wkeys: [],
    unlocked: [],
    broken: [],
    seenRooms: {},
    rewards: [],
    hatchRoom: {},
    clearedFloors: [],
  };
}

export function addFavor(meta: StageMeta, out: Outing, n: number, why: string) {
  const before = meta.favor;
  meta.favor = clampFavor(meta.favor + n);
  out.favorDelta += meta.favor - before;
  if (meta.favor !== before) out.log.push(`총애 ${n > 0 ? '+' : ''}${n} (${why}) → ${meta.favor}`);
}

/** 송신: 읽은 규칙을 규칙서에 남긴다 (다락방 인터폰·로프 귀환·EXIT) */
export function sendFound(meta: StageMeta, out: Outing): string[] {
  const sent: string[] = [];
  for (const id of out.found) {
    meta.known[id] = ruleVersion(meta, id);
    sent.push(id);
  }
  out.sent.push(...sent);
  out.found = [];
  return sent;
}

/** 이번 출동 변형 안내 (아는 줄만) */
export function variantNotes(meta: StageMeta, out: Outing): string[] {
  return out.variants.filter((id) => id in meta.known).map((id) => RULE[id].variant!.text);
}
