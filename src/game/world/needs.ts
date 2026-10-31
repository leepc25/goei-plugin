// 이름 인물 욕구 AI (docs/필드_세계_NPC_설계.md 5장, 사용자 확정: 욕구 + 의무 → 할 일 고르기, 실제 동작으로만 채운다).
// 욕구 하나 = 0(바닥)~100(가득). 생활 시간(실시간)으로 줄고, 그 욕구를 채우는 활동을 하면 찬다.
// 활동은 그 인물에게 클립이 있을 때만 켜진다 — 없는 동작을 대기 그림으로 때우지 않는다. 켜진 활동이 없으면 서성이기.
import type { PlaceGraph, PlaceKind } from './places';

/** train = 단련(10-31 사용자: 전투 NPC·이름 요원은 모두 훈련장에 가서 훈련한다. 사무·안내·의료·청소 직원은 없음) */
export type NeedId = 'work' | 'hunger' | 'energy' | 'bladder' | 'bowel' | 'social' | 'fun' | 'train';
export const NEEDS: NeedId[] = ['work', 'hunger', 'energy', 'bladder', 'bowel', 'social', 'fun', 'train'];
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
  // 훈련: 팔굽혀펴기·장비 점검·기지개, 그 줄이 없으면 약공 연습(모든 인물에게 있음). 싸우는 몸만 (choose fighter)
  { id: 'train', need: 'train', clip: 'train', where: ['training'], sec: [40, 90], fill: 2.5, label: '훈련' },
];

/** 활동마다 실제로 할 수 있는 줄 (10-31 사용자: 앉아서 하는 것과 서서 하는 것은 다르다, 상황에 따라 다양하게).
 * line = 인물 팩 줄 번호, seat = 의자 방향(그 방향 의자에 앉아서), 없으면 서서. 인물에게 그 줄 그림이 있을 때만 후보.
 * 고를 때: 빈 의자가 있으면 앉는 쪽도 후보, 바로 전에 한 줄은 덜 고른다(actors.ts taskSpot) */
export interface ActOpt { line: string; label: string; seat?: 'front' | 'side' | 'back' }
export const ACT_OPTS: Record<string, ActOpt[]> = {
  work: [
    { line: '63', label: '타자 치는 중', seat: 'front' }, { line: '105', label: '타자 치는 중', seat: 'side' }, { line: '69', label: '타자 치는 중', seat: 'back' },
    { line: '106', label: '손 작업 중', seat: 'front' },
    { line: '124', label: '브리핑 중' }, { line: '121', label: '장비 점검 중' }, { line: '117', label: '서류 보는 중' }, { line: '119', label: '수첩 메모 중' },
    { line: '120', label: '태블릿 확인 중' }, { line: '116', label: '업무 통화 중' }, { line: '118', label: '무전 보고 중' }, { line: '138', label: '서류 추리는 중' },
    { line: '85', label: '손 작업 중' }, { line: '125', label: '물건 진열 중' }, { line: '126', label: '돈 세는 중' }, { line: '128', label: '감정 중' },
    { line: '129', label: '수리 중' }, { line: '139', label: '계산 중' }, { line: '122', label: '경계 서는 중' }, { line: '123', label: '출입 확인 중' },
    { line: '136', label: '손전등 비추는 중' }, { line: '131', label: '닦는 중' }, { line: '88', label: '청소 중' }, { line: '113', label: '진료 기록 중' }, { line: '115', label: '시료 보는 중' },
  ],
  hobby: [
    { line: '149', label: '책 읽는 중', seat: 'front' }, { line: '148', label: '폰 보는 중', seat: 'front' }, { line: '167', label: '신문 읽는 중', seat: 'front' },
    { line: '90', label: '담배 피우는 중' }, { line: '145', label: '담배 피우는 중' }, { line: '155', label: '고기 굽는 중' }, { line: '153', label: '스케치 중' },
    { line: '140', label: '카드 섞는 중' }, { line: '156', label: '햄스터 돌보는 중' }, { line: '160', label: '손장난 중' }, { line: '152', label: '기도 중' },
    { line: '147', label: '폰 보는 중' }, { line: '154', label: '차 따르는 중' }, { line: '168', label: '구경 중' },
    { line: '161', label: '섀도복싱 중' }, { line: '91', label: '과자 먹는 중' },
  ],
  rest: [
    { line: '66', label: '조는 중', seat: 'front' }, { line: '73', label: '기대 쉬는 중', seat: 'front' },
    { line: '65', label: '차 마시는 중', seat: 'front' }, { line: '99', label: '차 마시는 중', seat: 'side' }, { line: '71', label: '차 마시는 중', seat: 'back' },
    { line: '142', label: '커피 마시는 중' }, { line: '143', label: '기지개' },
  ],
  eat: [
    { line: '64', label: '먹는 중', seat: 'front' }, { line: '98', label: '먹는 중', seat: 'side' }, { line: '71', label: '먹는 중', seat: 'back' },
    { line: '157', label: '간식 먹는 중' }, { line: '26', label: '먹는 중' },
  ],
};

/** 생활 1초당 줄어드는 양 (기본). 인물 계수가 곱해진다. 대략 몇 분에 한 번씩 각 욕구가 고개를 든다 */
export const DECAY: Needs = { work: 0.35, hunger: 0.12, energy: 0.08, bladder: 0.2, bowel: 0.05, social: 0.18, fun: 0.12, train: 0.06 };

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
  /** 싸우는 몸(이름 요원·전투 NPC)인가: 훈련은 이 몸만 */
  fighter?: boolean;
}): Choice | null {
  const t = TEMPER[o.name];
  let best: Choice | null = null;
  for (const a of ACTIVITIES) {
    if (!o.has(a.clip) && !(ACT_OPTS[a.id] ?? []).some((x) => o.has(`line:${x.line}`))) continue;
    if (a.need === 'train' && !o.fighter) continue;
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
