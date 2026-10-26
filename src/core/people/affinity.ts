// 호감 계산: 시작값 + 살아 있는 계기의 합. 계기마다 저장된 변화량은 없고 매번 순서대로 다시 계산한다.
// 규칙(리수폿 수치 체계): 계기 이름 → 기본값, 성격 계수·설정 배율, 기준 메시지 하나 안의 합은 ±10 (예외 계기 제외), 범위 -100~300, 고정은 그 값으로 덮음.
import { AFF_MAX, AFF_MIN, CUE_VALUE, DEFAULT_TEMPER, EXCEPTION_CUES, TURN_CAP, stageOf, type Change, type Person, type Temper } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface AffinityOpts {
  temper?: Temper;
  /** 설정 「호감 변화 속도」 0.5~2 */
  speed?: number;
}

/** 계기 하나의 변화량 (배율 적용, 상한 전) */
export function cueDelta(c: Change, o: AffinityOpts = {}): number {
  if (c.kind !== 'cue' || !c.cue) return 0;
  const base = CUE_VALUE[c.cue] ?? 0;
  const t = o.temper ?? DEFAULT_TEMPER;
  return base * (base >= 0 ? t.open : t.grudge) * (o.speed ?? 1);
}

/**
 * 인물 → 유저 호감 현재값. changes 는 살아 있는 것만, 기준 메시지 순서로 정렬된 것 (store.liveChanges).
 * manual pin 을 만나면 그 값으로 덮고 그 뒤 자동 계기는 무시한다 (고정 해제 = pin 변경을 void).
 */
export function affinityOf(person: Person, changes: Change[], folded = 0, o: AffinityOpts = {}): number {
  let value = clamp(person.affinity.base + folded, AFF_MIN, AFF_MAX);
  let pinned = false;
  const mine = changes.filter((c) => c.who === person.name && (c.kind === 'cue'));
  // 기준 메시지별로 묶어 상한을 건다
  const groups = new Map<string, Change[]>();
  for (const c of mine) (groups.get(c.anchor) ?? groups.set(c.anchor, []).get(c.anchor)!).push(c);
  for (const [, list] of groups) {
    let normal = 0;
    let extra = 0;
    for (const c of list) {
      if (c.pin !== undefined) {
        value = clamp(c.pin, AFF_MIN, AFF_MAX);
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
    if (!pinned) value = clamp(value + clamp(normal, -TURN_CAP, TURN_CAP) + extra, AFF_MIN, AFF_MAX);
  }
  return Math.round(value * 100) / 100;
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
