// 필드 시계 (docs/필드_세계_NPC_설계.md 16장, 사용자 확정 2026-10-26).
// 시계는 플레이어 행동으로만 흐른다: 장면 넘어가기·지역 이동·모델 대화 한 번·싸움(장면당 한 번)·시간 보내기. 그 밖은 0.
// 생활(걷기·일하기)은 실시간으로 돌지만 시계를 움직이지 않는다. 수치는 설정에서 고친다(분).
export interface ClockRules {
  /** 장면 넘어가기 */
  scene: number;
  /** 지역 이동(지하철·버스·택시) */
  region: number;
  /** 이름 인물과 모델 대화 한 번(창을 열고 닫을 때까지) */
  talk: number;
  /** 한 장면에서 싸움이 일어나면 그 장면에서 한 번 */
  fight: number;
}
export const DEFAULT_CLOCK: ClockRules = { scene: 10, region: 30, talk: 10, fight: 10 };

export type ClockEvent =
  | { kind: 'scene'; to: string }
  | { kind: 'region'; to: string }
  | { kind: 'talk' }
  | { kind: 'fight' }
  | { kind: 'wait'; minutes: number };

const clampMin = (v: unknown, def: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 24 * 60) : def;
};
/** 설정 값(문자열 등)을 규칙으로. 틀린 값은 기본값 */
export function clockRules(raw?: Partial<Record<keyof ClockRules, unknown>>): ClockRules {
  return {
    scene: clampMin(raw?.scene, DEFAULT_CLOCK.scene),
    region: clampMin(raw?.region, DEFAULT_CLOCK.region),
    talk: clampMin(raw?.talk, DEFAULT_CLOCK.talk),
    fight: clampMin(raw?.fight, DEFAULT_CLOCK.fight),
  };
}

export class FieldClock {
  /** 자정부터 분. 본편 시각을 모르면 null (시계를 세지 않는다) */
  minute: number | null;
  private foughtHere = false;
  constructor(start: number | null, public rules: ClockRules = DEFAULT_CLOCK) {
    this.minute = start;
  }
  /** 사건 하나 → 흐른 분 (시계를 모르면 0) */
  advance(ev: ClockEvent): number {
    let add = 0;
    switch (ev.kind) {
      case 'scene':
        add = this.rules.scene;
        this.foughtHere = false;
        break;
      case 'region':
        add = this.rules.region;
        this.foughtHere = false;
        break;
      case 'talk':
        add = this.rules.talk;
        break;
      case 'fight':
        if (this.foughtHere) return 0;
        this.foughtHere = true;
        add = this.rules.fight;
        break;
      case 'wait':
        add = Math.max(0, ev.minutes);
        break;
    }
    if (this.minute === null) return 0;
    this.minute += add;
    return add;
  }
  /** 시 (0~24, 날짜는 버림) */
  hour(): number | null {
    return this.minute === null ? null : (this.minute / 60) % 24;
  }
  text(): string {
    if (this.minute === null) return '--:--';
    const m = Math.floor(this.minute) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
}
