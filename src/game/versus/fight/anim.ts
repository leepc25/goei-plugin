// 동작 재생: 장 목록(장 번호·길이·꼬리표)을 시간대로 넘긴다. 꼬리표(act·cancel·run·shot)는 판정·기술 쪽이 읽는다
import type { CharArt } from './art';

export interface Step {
  /** 장 번호 (0부터) */
  f: number;
  /** 길이 (초) */
  d: number;
  /** 이 장 동안 평타 공격 칸이 살아 있다 */
  act?: boolean;
  /** 맞혔으면 이 장부터 다음 동작으로 이을 수 있다 */
  cancel?: boolean;
  /** 이 장에 들어갈 때 기술 부품 실행 */
  run?: unknown[];
  /** 이 장에 들어갈 때 원거리 한 발 */
  shot?: boolean;
  /** 이 장에 들어갈 때 부를 것 (돌진 난무 필살기) */
  fn?: () => void;
}

export class Anim {
  i = 0;
  t = 0;
  done = false;
  constructor(readonly id: string, readonly steps: Step[], readonly loop = -1, public onEnd: (() => void) | null = null, readonly onStep: ((s: Step) => void) | null = null) {
    if (!steps.length) steps.push({ f: 0, d: 0.1 });
  }
  get step(): Step { return this.steps[Math.min(this.i, this.steps.length - 1)]; }
  get f(): number { return this.step.f; }
  /** 처음 장 꼬리표 (만든 뒤 한 번) */
  start(): this { this.onStep?.(this.step); return this; }
  tick(dt: number): void {
    if (this.done) return;
    this.t += dt;
    let guard = 0;
    while (!this.done && this.t >= this.steps[this.i].d && guard++ < 64) {
      this.t -= this.steps[this.i].d;
      if (this.i + 1 < this.steps.length) this.i++;
      else if (this.loop >= 0) this.i = this.loop;
      else { this.done = true; this.t = 0; const f = this.onEnd; this.onEnd = null; f?.(); return; }
      this.onStep?.(this.steps[this.i]);
    }
  }
  /** 남은 시간 (초, 되풀이면 무한) */
  left(): number {
    if (this.loop >= 0) return Infinity;
    let s = -this.t;
    for (let k = this.i; k < this.steps.length; k++) s += this.steps[k].d;
    return Math.max(0, s);
  }
}

export const range = (a: number, b: number): number[] => {
  const r: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) r.push(i);
  else for (let i = a; i >= b; i--) r.push(i);
  return r;
};
export const steps = (fr: number[], d: number): Step[] => fr.map((f) => ({ f, d }));
export const nOf = (art: CharArt, id: string) => art.A[id]?.n ?? 0;
export const has = (art: CharArt, id: string | undefined | null): id is string => !!id && !!art.A[id] && !!art.IMG[id];
/** 설정의 되풀이 장 (1부터) → 0부터 */
export function loopOf(art: CharArt, id: string): number[] | null {
  const l = (art.cfg.loops as Record<string, number[]> | undefined)?.[id];
  const n = nOf(art, id);
  return l && l.length ? l.map((f) => Math.max(0, Math.min(n - 1, f - 1))) : null;
}
