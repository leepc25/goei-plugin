// 대전 한 판의 공용 상태 모양: 몸(Fighter)·이펙트·탄·늦게 도는 일. match.ts 가 만들고 fighter.ts·skillfx.ts 가 쓴다
import type { Fighter } from './fighter';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 화면 이펙트 하나 (k = 종류, t = 남은 초) */
export interface Fx { k: string; t: number; t0: number; under?: boolean; [k: string]: any }

/** 한 번 쓴 공격 (평타 한 대·기술 한 번). 기술 피해는 전체(budget)를 맞는 수로 나눠(per) 쓴다 */
export interface Use {
  id: number;
  kind: 'light' | 'heavy' | 'launch' | 'blow' | 'jump' | 'ranged' | 'skill' | 'charge' | 'super';
  budget: number;
  per: number;
  dealt: number;
  /** 막기 불가 (필살기·끝까지 모은 충전기) */
  unblock: boolean;
  /** 특수기 (막아도 깎임) */
  special: boolean;
  /** 맞는 자리 전용 그림 */
  hitVfx?: { n: string; s: number } | null;
  /** 충전 단계 */
  lv?: number;
  /** 기술: 처음 맞힌 때의 줄임 배율 (같은 기술 안에서는 더 줄이지 않는다) */
  sc?: number;
}

/** 탄 하나 */
export interface Proj {
  owner: Fighter;
  use: Use;
  x: number;
  /** 화면 y (월드) */
  y: number;
  dir: number;
  v: number;
  life: number;
  kind: string;
  vfx?: string;
  tint?: string;
  rot?: number;
  size: number;
  c: string;
  hit: any;
  pierce: boolean;
  done: Set<Fighter>;
  /** 기본 원거리 (한 번에 한 발) */
  basic: boolean;
  end?: any[];
  trail: [number, number][];
  t: number;
}

export interface Stage {
  /** 판 시간 (초) */
  t: number;
  /** 무대 길이 */
  L: number;
  fighters: Fighter[];
  fx: Fx[];
  proj: Proj[];
  timers: { t: number; fn: () => void }[];
  /** 지금 보이는 화면 왼쪽 끝·폭 (월드) */
  viewX0: number;
  viewW: number;
  /** 화면 흔들림 */
  shake(v: number): void;
  /** 소리 사건 */
  sfx(e: { type: string; strength?: number; kind?: string; by?: string; x?: number }): void;
  /** 필살기 시작 (모두 멈추고 연출) */
  superFlash(by: Fighter, name: string): void;
  /** 공격 번호 */
  nextId(): number;
  /** 시험 기록 (맞음마다) */
  log?: (e: { by: string; to: string; kind: string; clip?: string; id: number; dmg: number; guard: boolean }) => void;
}

export const later = (st: Stage, t: number, fn: () => void) => { st.timers.push({ t, fn }); };
