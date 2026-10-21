// 승강기 (스테이지 설계서 8장): 해설자이자 거래 상대. 총애 −3~+3.
// 인사(E) +0/+1, 닫힘 연타 −1, 승객 구함 +1, 수호자를 규칙으로 통과 +1, 승강기 안에서 공격 −2.
// 총애가 높으면 버튼 3개·유형 미리 보임·보급품 위치. 낮으면 버튼 1개, −2 이하면 문이 안 닫혀 10초 갇힘 + 적.
// 호명(요원 사적 사실)·요원 반응 대사는 「대사와 컷신」 작업 몫이다. 여기는 그 자리(lines 훅)와 기본 문장만 둔다.
import { FLOOR_TYPES, depthLabel } from './data/floortypes';
import { pickSub, pickType } from './gen/floor';
import { mix, rng } from './rng';
import type { FloorType, ReplicaSub } from './types';

export const FAVOR_MIN = -3;
export const FAVOR_MAX = 3;
export const clampFavor = (n: number) => Math.max(FAVOR_MIN, Math.min(FAVOR_MAX, n));

export interface ElevatorButton {
  depth: number;
  label: string;
  type: FloorType;
  sub: ReplicaSub | null;
  /** 유형이 미리 보이는가 (총애 2+, 승객 정보, 다락방 지도) */
  shown: boolean;
  /** 기억된 버튼 (전에 간 깊이로 바로) */
  remembered?: boolean;
  exit?: boolean;
}

/** 대사 훅. 「대사와 컷신」이 채운다. 없으면 아래 기본 문장. */
export interface ElevatorLines {
  callout?(agent: string, favor: number, n: number): string | null;
  reaction?(agent: string, n: number): string | null;
}

export function buttonCount(favor: number): number {
  return favor <= -2 ? 1 : favor >= 2 ? 3 : 2;
}

export function elevatorButtons(o: { seed: number; depth: number; favor: number; epoch: number; last: FloorType[]; reveal: boolean; deepest: number; exitOpen: boolean }): ElevatorButton[] {
  const n = buttonCount(o.favor);
  const out: ElevatorButton[] = [];
  const next = o.depth + 1;
  if (o.exitOpen && o.depth <= 3) out.push({ depth: 0, label: 'EXIT', type: 'lobby', sub: null, shown: true, exit: true });
  for (let i = 0; i < n; i++) {
    const type = pickType(next, o.last, o.seed, o.epoch, i * 101 + 3);
    out.push({ depth: next, label: depthLabel(next), type, sub: type === 'replica' ? pickSub(o.seed + i, next, o.epoch) : null, shown: o.favor >= 2 || o.reveal });
  }
  // 같은 유형 둘이면 하나 바꾸기 (선택이 의미 있게)
  if (out.length >= 2 && next > 3) {
    const r = rng(mix(o.seed, next, 99));
    for (let i = 1; i < out.length; i++)
      if (!out[i].exit && out.slice(0, i).some((b) => b.type === out[i].type)) {
        const alt = (['chase', 'replica', 'trial', 'dark', 'silent', 'puzzle'] as FloorType[]).filter((t) => !out.some((b) => b.type === t) && t !== o.last[o.last.length - 1]);
        if (alt.length && next !== 15) out[i].type = alt[Math.floor(r() * alt.length)];
        out[i].sub = out[i].type === 'replica' ? pickSub(o.seed + i, next, o.epoch) : null;
      }
  }
  // 승강기 버튼 기억 (영구 지름길): 로비에서 전에 간 가장 깊은 곳 바로 위까지
  if (o.depth <= 3 && o.deepest >= 5) {
    const d = Math.max(4, o.deepest - 1);
    const type = pickType(d, [], o.seed, o.epoch, 555);
    out.push({ depth: d, label: `${depthLabel(d)} (기억)`, type, sub: type === 'replica' ? pickSub(o.seed, d, o.epoch) : null, shown: o.favor >= 2 || o.reveal, remembered: true });
  }
  return out;
}

export function announce(depth: number, type: FloorType): string {
  return `띵. ${depth <= 3 ? `${depth}층` : depthLabel(depth)}입니다. 문이 열립니다.${type === 'deep' ? '' : ` …${FLOOR_TYPES[type].hint}`}`;
}

export function greetLine(favor: number, gained: boolean, flip: boolean): string {
  if (flip) return '…말 걸지 마요. 오늘은.';
  if (!gained) return favor >= 2 ? '네, 네. 알아요. 반가워요.' : '…';
  return ['…인사는 받을게요.', '어머. 예의 바르네요.', '고마워요. 다들 안 하더라고요.', '오늘은 좋은 층으로 모실게요.'][Math.max(0, Math.min(3, favor + 1))];
}
export const CLOSE_SPAM_LINE = '…서두르지 마요. 문은 제가 닫아요.';
export const STUCK_LINE = '문이… 안 닫히네요. 어쩌죠. 누가 오는데.';
export const LONELY_LINE = '…여기 오래 있으면, 다들 말이 없어져요. 당신은 말을 해 줘서 좋았어요.';
export const MUTTER = ['열두 층 아래는 아직 아무도 안 세어 봤어요.', '이 버튼, 어제는 없었는데.', '거울 보지 마요. 피곤해 보여요.', '아래층 사람들이 또 문을 두드려요.', '위로는 안 가요. 그건 제 일이 아니라서.'];

export function defaultCallout(agent: string, favor: number): string {
  const name = agent === 'eileen' ? '에일린' : agent === 'jyaldi' ? '쟈알디' : '요원';
  return favor >= 1 ? `안녕, ${name} 씨. 이번 층에서는 꼭 살아남아요.` : `${name} 씨. 또 왔네요.`;
}

/** 다락방 인터폰 거래 (원문): 회수물 1개 또는 미송신 단서 1개 → 다음 층 유형 공개 / 깊이 +2 / 보급품 위치. 총애가 낮을수록 거짓이 섞인다. */
export type DealKind = 'reveal' | 'skip' | 'supply';
export function dealTruth(favor: number, roll: number): boolean {
  return roll < 0.5 + favor * 0.15;
}
