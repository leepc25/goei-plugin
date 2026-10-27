// 이름 인물 욕구 AI (docs/필드_세계_NPC_설계.md 5장, 사용자 확정: 욕구 + 의무 → 할 일 고르기, 실제 동작으로만 채운다).
// 욕구 하나 = 0(바닥)~100(가득). 생활 시간(실시간)으로 줄고, 그 욕구를 채우는 활동을 하면 찬다.
// 활동은 그 인물에게 클립이 있을 때만 켜진다 — 없는 동작을 대기 그림으로 때우지 않는다. 켜진 활동이 없으면 서성이기.
import type { PlaceGraph, PlaceKind } from './places';

export type NeedId = 'work' | 'hunger' | 'energy' | 'bladder' | 'bowel' | 'social' | 'fun';
export const NEEDS: NeedId[] = ['work', 'hunger', 'energy', 'bladder', 'bowel', 'social', 'fun'];
export type Needs = Record<NeedId, number>;

/** 활동 하나: 어느 욕구를, 어떤 클립으로, 어떤 장소 종류에서, 얼마나 */
export interface Activity {
  id: string;
  need: NeedId;
  clip: string;
  /** 갈 장소 종류 (places.ts 꼬리표). 'self' = 지금 장면 (사람 찾기 등) */
  where: PlaceKind[];
  /** 하는 시간 초 [최소, 최대] */
  sec: [number, number];
  /** 초당 차는 양 */
  fill: number;
  /** 관찰 창 글 */
  label: string;
  /** 다른 인물과 함께 (social) */
  partner?: boolean;
}

export const ACTIVITIES: Activity[] = [
  { id: 'work', need: 'work', clip: 'work', where: ['office'], sec: [40, 90], fill: 2.2, label: '일하는 중' },
  { id: 'eat', need: 'hunger', clip: 'eat', where: ['lounge', 'shop'], sec: [25, 45], fill: 4, label: '먹는 중' },
  { id: 'rest', need: 'energy', clip: 'rest', where: ['lounge'], sec: [30, 60], fill: 3, label: '쉬는 중' },
  { id: 'pee', need: 'bladder', clip: 'pee', where: ['restroom'], sec: [8, 14], fill: 12, label: '화장실(소)' },
  { id: 'poo', need: 'bowel', clip: 'poo', where: ['restroom'], sec: [25, 40], fill: 5, label: '화장실(대)' },
  { id: 'chat', need: 'social', clip: 'talk', where: ['office', 'lounge', 'corridor'], sec: [12, 25], fill: 6, label: '수다 중', partner: true },
  { id: 'hobby', need: 'fun', clip: 'hobby', where: ['lounge'], sec: [30, 60], fill: 3, label: '취미' },
];

/** 생활 1초당 줄어드는 양 (기본). 인물 계수가 곱해진다. 대략 몇 분에 한 번씩 각 욕구가 고개를 든다 */
export const DECAY: Needs = { work: 0.35, hunger: 0.12, energy: 0.08, bladder: 0.2, bowel: 0.05, social: 0.18, fun: 0.12 };

/** 인물별 성향 (욕구 계수·취향). 없는 칸은 1. 원작 근거는 docs/본부_설계_2판.md 4장 */
export interface Temper {
  need?: Partial<Needs>;
  /** 취미를 하는 장소 종류 (없으면 휴게실) */
  hobbyAt?: PlaceKind[];
  /** 근무 시간 [시작 시, 끝 시]. 없으면 9~18 */
  shift?: [number, number];
  /** 친한 인물 (수다 상대 우선) */
  friends?: string[];
}
export const TEMPER: Record<string, Temper> = {
  잼트리: { need: { social: 1.3, hunger: 1.2 }, friends: ['쟈알디', '스팡달', '데쥬레', '에일린'] },
  쟈알디: { need: { social: 0.6, work: 1.3 } },
  에일린: { need: { social: 0.4 }, hobbyAt: ['lounge'] },
  큐라스: { need: { social: 1.5, fun: 1.3 }, hobbyAt: ['office'] },
  고르고디오: { need: { fun: 1.3, hunger: 1.3 }, hobbyAt: ['training'] },
  게슈간: { need: { social: 0.3 } },
  로제몬: { need: { hunger: 1.4, fun: 1.2 }, hobbyAt: ['lounge'] },
  데쥬레: { need: { work: 1.2 }, friends: ['잼트리'] },
  고그니쟈: { need: { work: 1.2, social: 1.2 } },
  콘쥬스: { need: { energy: 1.3, fun: 1.3 } },
};

export const fullNeeds = (r: () => number): Needs => Object.fromEntries(NEEDS.map((n) => [n, 55 + r() * 45])) as Needs;

export function decayNeeds(n: Needs, dt: number, t: Temper | undefined, onDuty: boolean): void {
  for (const k of NEEDS) {
    // 업무는 근무 시간에만 줄어든다 (근무 밖이면 가득으로 본다)
    if (k === 'work' && !onDuty) {
      n.work = 100;
      continue;
    }
    n[k] = Math.max(0, n[k] - DECAY[k] * (t?.need?.[k] ?? 1) * dt);
  }
}

export const onDuty = (hour: number | null | undefined, t?: Temper) => {
  if (hour == null) return true; // 시각을 모르면 근무 중으로
  const [a, b] = t?.shift ?? [9, 18];
  return a <= b ? hour >= a && hour < b : hour >= a || hour < b;
};

export interface Choice {
  act: Activity;
  /** 갈 장면 */
  scene: string;
  score: number;
}

/**
 * 할 일 고르기 (5-2장). 점수 = 부족분² × 의무 가중 × 취향 ÷ (1 + 가는 거리 문 수)
 * has(clip) = 그 인물에게 클립이 있나. 없으면 그 활동은 후보가 아니다.
 * roam = 갈 수 있는 장면. partnerHere = 지금 장면에 수다 상대가 있나.
 */
export function choose(o: {
  name: string;
  needs: Needs;
  scene: string;
  roam: string[];
  graph: PlaceGraph;
  has: (clip: string) => boolean;
  duty: boolean;
  partnerIn: (scene: string) => boolean;
  rand: () => number;
  last?: string;
}): Choice | null {
  const t = TEMPER[o.name];
  let best: Choice | null = null;
  for (const a of ACTIVITIES) {
    if (!o.has(a.clip)) continue;
    const lack = 100 - o.needs[a.need];
    if (lack < 25) continue;
    const kinds = a.id === 'hobby' && t?.hobbyAt ? t.hobbyAt : a.where;
    // 갈 장면: 오가는 범위 안에서 그 종류인 곳, 가까운 순
    const places = o.roam.filter((s) => kinds.includes(o.graph.kind(s)));
    for (const s of places) {
      if (a.partner && !o.partnerIn(s)) continue;
      const hops = s === o.scene ? 0 : o.graph.route(o.scene, s)?.length ?? 99;
      if (hops >= 99) continue;
      let w = (lack / 100) ** 2 * 100;
      if (a.need === 'work') w *= o.duty ? 1.6 : 0;
      if (a.need === 'bladder' || a.need === 'bowel') w *= lack > 70 ? 2.2 : 0.7; // 급하면 급하다
      if (o.last === a.id) w *= 0.5; // 같은 활동 연속 감점
      const score = (w / (1 + hops * 0.5)) * (0.9 + o.rand() * 0.2);
      if (!best || score > best.score) best = { act: a, scene: s, score };
    }
  }
  return best && best.score > 8 ? best : null;
}
