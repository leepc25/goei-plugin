// 위협 예산으로 적 편성 사기 (기본 기획서 8.4).
// 예산 = 층 기본값(깊이) + 방 순서 × 증가분 + 위험 단계 × 보너스 + 변형 + 성장. 적마다 가격이 있고 예산 안에서 산다.
// 수가 아니라 질: 화면당 8체 상한. 남는 예산은 파도 수(2→3)와 정예 접사(출혈·경 아머·빠름·재생)로 쓴다.
// 겹치지 않게: 직전 3방과 같은 조합이면 다시 뽑는다.
import { ROSTER, ROSTER_BY_KIND, INTRUDERS, type EnemyDef } from './roster';
import type { Affix } from './enemy';
import type { FloorType } from './types';
import type { SpawnSpec } from '../engine/contract';

export const SCREEN_CAP = 8;
export const ELITE_COST = 14;
const AFFIXES: Affix[] = ['bleed', 'armor', 'fast', 'regen'];

export interface Spawn extends SpawnSpec {
  affixes?: Affix[];
  wave: number;
}
export interface WavePlan {
  budget: number;
  spent: number;
  waves: Spawn[][];
  elites: number;
  intrusion: 'bureau' | 'daydream' | null;
  signature: string;
}
export interface Area {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
export const DEFAULT_AREA: Area = { x0: 0, x1: 1280, y0: 500, y1: 680 };

/** 방 예산. depth 1~3 = 로비 L1~L3, 4 이상 = B-(depth−3). 회색 상자 시험판과 같은 식 */
export function budgetFor(depth: number, chunkIndex = 0, danger = 0, variant = 0, growth = 0): number {
  const base = depth <= 3 ? 6 + depth * 3 : 16 + (depth - 3) * 8;
  return Math.round(base + chunkIndex * 2 + danger * 5 + variant + growth * 4);
}

/** 이 층 유형에서 살 수 있는 적 */
export function poolFor(floor: FloorType, intrusion: WavePlan['intrusion'] = null, allowMid = false): EnemyDef[] {
  if (floor === 'b12') return [];
  let kinds: string[];
  if (intrusion === 'bureau') kinds = [...INTRUDERS.bureau, ...(allowMid ? INTRUDERS.bureauMid : [])];
  else if (intrusion === 'daydream') kinds = INTRUDERS.daydream;
  else kinds = ROSTER.filter((d) => d.types.includes(floor) && d.price > 0 && (allowMid || !d.mid)).map((d) => d.kind);
  return kinds.map((k) => ROSTER_BY_KIND[k]).filter(Boolean);
}

/** 붙박이·매복형은 화면 안쪽에, 나머지는 양 끝에서 걸어 들어온다 */
function place(d: EnemyDef, i: number, area: Area, r: () => number): { x: number; y: number } {
  const inner = ['fixed', 'floorgrab', 'ambush', 'ceiling', 'rule', 'stain'].includes(d.ai);
  const y = d.kind === 'wallface' ? area.y0 : area.y0 + 10 + r() * (area.y1 - area.y0 - 20);
  if (inner) return { x: area.x0 + 160 + r() * (area.x1 - area.x0 - 320), y };
  const left = i % 2 === 0 ? r() < 0.7 : r() < 0.3;
  // 같은 쪽에서 나오는 적은 줄지어 (한 덩어리로 겹쳐 들어오지 않게)
  const gap = Math.floor(i / 2) * 120;
  return { x: left ? area.x0 - 40 - gap - r() * 60 : area.x1 + 40 + gap + r() * 60, y };
}

export interface PlanOpts {
  budget: number;
  floor: FloorType;
  depth: number;
  rand: () => number;
  area?: Area;
  /** 직전 방들의 조합 서명 (최근 3개만 본다) */
  recent?: string[];
  /** 난입 세력 (가짜 관리국 · 백일몽) */
  intrusion?: WavePlan['intrusion'];
  /** 중간 보스를 살 수 있나 (곁가지 끝·잠긴 문 뒤) */
  allowMid?: boolean;
}

export function planEncounter(o: PlanOpts): WavePlan {
  let plan = buy(o);
  for (let i = 0; i < 3 && o.recent?.slice(-3).includes(plan.signature); i++) plan = buy(o);
  return plan;
}

function buy(o: PlanOpts): WavePlan {
  const r = o.rand;
  const area = o.area ?? DEFAULT_AREA;
  const intrusion = o.intrusion ?? null;
  const pool = poolFor(o.floor, intrusion, o.allowMid);
  const plan: WavePlan = { budget: o.budget, spent: 0, waves: [], elites: 0, intrusion, signature: '' };
  if (!pool.length || o.budget <= 0) return plan;
  const cheapest = Math.min(...pool.map((d) => d.price));
  // 파도 수: 예산이 크면 2→3. 한 파도는 화면 상한 8
  const nWaves = o.budget < 30 ? 1 : o.budget < 75 ? 2 : 3;
  // 깊은 곳(B-5 이하)은 예산 일부를 처음부터 정예 몫으로 떼어 둔다
  const reserve = o.depth >= 8 ? Math.round(o.budget * 0.15) : 0;
  let left = o.budget - reserve;
  // 중간 보스는 먼저 산다 (있으면 마지막 파도)
  const mids = pool.filter((d) => d.mid && d.price <= left * 0.6);
  let mid: EnemyDef | null = null;
  if (o.allowMid && mids.length && r() < 0.5) {
    mid = mids[Math.floor(r() * mids.length)];
    left -= mid.price;
  }
  const normal = pool.filter((d) => !d.mid);
  // 수가 아니라 질: 깊이에 따라 한 파도의 머릿수를 늘리되 8을 넘지 않는다. 남는 예산은 정예로 간다
  const softCap = Math.min(SCREEN_CAP, 3 + Math.floor(o.depth / 2));
  for (let wv = 0; wv < nWaves; wv++) {
    const share = wv === nWaves - 1 ? left : Math.round(left / (nWaves - wv));
    let wl = share;
    const wave: Spawn[] = [];
    if (mid && wv === nWaves - 1) wave.push({ kind: mid.kind, ...place(mid, 0, area, r), wave: wv });
    let guard = 0;
    while (wl >= cheapest && wave.length < softCap && guard++ < 40) {
      const ok = normal.filter((d) => d.price <= wl && wave.filter((s) => s.kind === d.kind).length < (d.cap ?? SCREEN_CAP));
      if (!ok.length) break;
      // 같은 종은 덜 뽑히게 (조합 다양화)
      const weights = ok.map((d) => 1 / (1 + wave.filter((s) => s.kind === d.kind).length * 1.5));
      let pick = r() * weights.reduce((a, b) => a + b, 0);
      let d = ok[ok.length - 1];
      for (let i = 0; i < ok.length; i++) if ((pick -= weights[i]) <= 0) ((d = ok[i]), (i = ok.length));
      wave.push({ kind: d.kind, ...place(d, wave.length, area, r), wave: wv });
      wl -= d.price;
    }
    left -= share - wl;
    plan.waves.push(wave);
  }
  // 남은 예산 → 정예 접사 (수가 아니라 질)
  left += reserve;
  const all = plan.waves.flat().filter((s) => !ROSTER_BY_KIND[s.kind]?.mid);
  for (const s of shuffled(all, r)) {
    if (left < ELITE_COST) break;
    s.elite = true;
    s.affixes = [AFFIXES[Math.floor(r() * AFFIXES.length)]];
    if (left >= ELITE_COST * 3 && r() < 0.4) {
      const second = AFFIXES.filter((a) => a !== s.affixes![0]);
      s.affixes.push(second[Math.floor(r() * second.length)]);
      left -= ELITE_COST;
    }
    left -= ELITE_COST;
    plan.elites++;
  }
  plan.waves = plan.waves.filter((w) => w.length);
  plan.spent = o.budget - left;
  plan.signature = plan.waves.map((w) => w.map((s) => s.kind + (s.elite ? '*' : '')).sort().join(',')).join('|');
  return plan;
}

function shuffled<T>(a: T[], r: () => number): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** 엔진 약속의 모양: 파도 목록 (SpawnSpec[][]). x·y는 area 기준 월드 좌표 */
export function spawnWave(budget: number, floorType: FloorType | string, depth: number, rng: () => number, area: Area = DEFAULT_AREA, opts: Partial<PlanOpts> = {}): Spawn[][] {
  return planEncounter({ budget, floor: (floorType as FloorType) ?? 'lobby', depth, rand: rng, area, ...opts }).waves;
}

/** 난입 굴리기 (스테이지 설계서 15장): 가짜 관리국 25%(어디든), 백일몽 30%(B-2 이하) — 출동당 확률이라 방마다는 낮게 */
export function rollIntrusion(depth: number, r: () => number, perRoom = 0.12): WavePlan['intrusion'] {
  if (r() >= perRoom) return null;
  return depth >= 5 && r() < 0.55 ? 'daydream' : 'bureau';
}
