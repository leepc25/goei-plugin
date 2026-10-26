// 호감 계산: 시작값 + 살아 있는 계기의 합. 계기마다 저장된 변화량은 없고 매번 순서대로 다시 계산한다.
// 규칙(리수폿 수치 체계): 계기 이름 → 기본값, 성격 계수·설정 배율, 기준 메시지 하나 안의 합은 ±10 (예외 계기 제외), 범위 -100~300, 고정은 그 값으로 덮음.
import { AFF_MAX, AFF_MIN, CUE_VALUE, DEFAULT_TEMPER, EXCEPTION_CUES, FACTION_MAX, FACTION_MIN, OPENNESS_MAX, OPENNESS_MIN, OPENNESS_TURN, TASTE_MAX, TASTE_MIN, TURN_CAP, factionStage, factionWho, stageOf, type Change, type Person, type Temper } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface AffinityOpts {
  temper?: Temper;
  /** 설정 「호감 변화 속도」 0.5~2 */
  speed?: number;
  /** 설정 「메시지당 변화 상한」. 0 = 한도 없음. 없으면 기본 10 */
  turnCap?: number;
}

/** 계기 하나의 변화량 (배율 적용, 상한 전) */
export function cueDelta(c: Change, o: AffinityOpts = {}): number {
  if (c.kind !== 'cue' || !c.cue) return 0;
  const raw = CUE_VALUE[c.cue] ?? 0;
  // 배율 (필드 몹 목격 0.5): 소수점 버림. 0 이면 계기 없음
  const base = typeof c.scale === 'number' && c.scale !== 1 ? Math.trunc(raw * c.scale) : raw;
  const t = o.temper ?? DEFAULT_TEMPER;
  return base * (base >= 0 ? t.open : t.grudge) * (o.speed ?? 1);
}

/** 계기 합 (호감·세력 공용): 시작값 + 살아 있는 계기, 기준 메시지당 ±10, 고정은 덮음 */
export function sumCues(who: string, base: number, changes: Change[], folded: number, min: number, max: number, o: AffinityOpts = {}): number {
  let value = clamp(base + folded, min, max);
  let pinned = false;
  const mine = changes.filter((c) => c.who === who && c.kind === 'cue');
  const groups = new Map<string, Change[]>();
  for (const c of mine) (groups.get(c.anchor) ?? groups.set(c.anchor, []).get(c.anchor)!).push(c);
  for (const [, list] of groups) {
    let normal = 0;
    let extra = 0;
    for (const c of list) {
      if (c.pin !== undefined) {
        value = clamp(c.pin, min, max);
        pinned = true;
        normal = 0;
        extra = 0;
        continue;
      }
      if (pinned) continue;
      const d = cueDelta(c, o);
      if (c.cue && EXCEPTION_CUES.has(c.cue)) extra += d;
      else normal += d;
    }
    const cap = o.turnCap === undefined ? TURN_CAP : o.turnCap;
    if (!pinned) value = clamp(value + (cap > 0 ? clamp(normal, -cap, cap) : normal) + extra, min, max);
  }
  return Math.round(value * 100) / 100;
}

/**
 * 인물 → 유저 호감 현재값. changes 는 살아 있는 것만, 기준 메시지 순서로 정렬된 것 (store.liveChanges).
 * manual pin 을 만나면 그 값으로 덮고 그 뒤 자동 계기는 무시한다 (고정 해제 = pin 변경을 void).
 */
export function affinityOf(person: Person, changes: Change[], folded = 0, o: AffinityOpts = {}): number {
  return sumCues(person.name, person.affinity.base, changes, folded, AFF_MIN, AFF_MAX, o);
}

/** 화면·대사용 요약 */
export function affinityView(person: Person, changes: Change[], folded = 0, o: AffinityOpts = {}) {
  const value = affinityOf(person, changes, folded, o);
  const stage = stageOf(value);
  const last = [...changes].reverse().find((c) => c.who === person.name && c.kind === 'cue' && c.pin === undefined);
  return { value, stage, last };
}

/** 호칭 현재값: 고정이면 시작값, 아니면 마지막 살아 있는 address 변경 */
export function addressOf(person: Person, changes: Change[]): { toUser: string; register: Person['address']['register'] } {
  if (person.address.pin) return { toUser: person.address.toUser, register: person.address.register };
  const last = [...changes].reverse().find((c) => c.who === person.name && c.kind === 'address' && c.toUser);
  return last ? { toUser: last.toUser!, register: last.register ?? person.address.register } : { toUser: person.address.toUser, register: person.address.register };
}

/** 취향 띠 현재값: 마지막 살아 있는 taste 변경의 띠. 아직 판정 전이면 null */
export function tasteOf(person: Person, changes: Change[]): number | null {
  const last = [...changes].reverse().find((c) => c.who === person.name && c.kind === 'taste' && typeof c.band === 'number');
  return last ? clamp(Math.round(last.band!), TASTE_MIN, TASTE_MAX) : null;
}

/** 음란도 현재값: 시작값(init) + 살아 있는 변화량의 합. 기준 메시지 하나 안의 합은 -5~+10. 시작값이 없으면 null (판정 전) */
export function opennessOf(person: Person, changes: Change[]): number | null {
  const mine = changes.filter((c) => c.who === person.name && c.kind === 'openness');
  let value: number | null = null;
  const groups = new Map<string, Change[]>();
  for (const c of mine) (groups.get(c.anchor) ?? groups.set(c.anchor, []).get(c.anchor)!).push(c);
  for (const [, list] of groups) {
    let net = 0;
    for (const c of list) {
      if (typeof c.init === 'number' && value === null) value = clamp(c.init, OPENNESS_MIN, OPENNESS_MAX);
      else if (typeof c.delta === 'number' && value !== null) net += c.delta;
    }
    if (value !== null) value = clamp(value + clamp(net, OPENNESS_TURN[0], OPENNESS_TURN[1]), OPENNESS_MIN, OPENNESS_MAX);
  }
  return value === null ? null : Math.round(value * 100) / 100;
}

/** 세력 → 유저 평판 현재값: 시작값(조직×조직 표) + 살아 있는 계기. 세력 성격 계수는 1, 설정 속도는 적용 */
export function factionOf(code: string, base: number, changes: Change[], folded = 0, o: AffinityOpts = {}): number {
  return sumCues(factionWho(code), base, changes, folded, FACTION_MIN, FACTION_MAX, { speed: o.speed, turnCap: o.turnCap });
}

export function factionView(code: string, base: number, changes: Change[], folded = 0, o: AffinityOpts = {}, bounds?: readonly number[]) {
  const value = factionOf(code, base, changes, folded, o);
  const stage = factionStage(value, bounds);
  const last = [...changes].reverse().find((c) => c.who === factionWho(code) && c.kind === 'cue' && c.pin === undefined);
  return { value, stage, last };
}
