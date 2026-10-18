// 요청 토큰 상한 (원본 request_override_*_tokens + 넘칠 때 줄이는 순서).
// 요청문을 다시 만들면서 한 단계씩 줄인다: 이전 위키 문서 → 2차 참조 → 관련 로어북 → 본편 턴 절반씩.
// 요청문 만들기는 동기 함수라 단계는 모듈 변수 하나로 넘긴다 (만드는 동안에만 0이 아님).
import { tokens } from './gnet';

let level = 0;
const LAST = 6;

/** 지금 단계에서 이 자료를 빼야 하는지 */
export const trimPrevious = () => level >= 1;
export const trimSecondary = () => level >= 2;
export const trimRelated = () => level >= 3;

/** 본편 참고 턴 수: 4단계부터 절반씩 (최소 1). 0이면 본편을 보지 않음 */
export function trimTurns(n: number): number {
  if (n <= 0) return 0;
  return level < 4 ? n : Math.max(1, Math.floor(n / 2 ** (level - 3)));
}

export class BudgetError extends Error {}

export function promptTokens(p: { messages: { content: string }[] }): number {
  return p.messages.reduce((n, m) => n + tokens(m.content), 0);
}

/** cap이 0이면 그대로. 넘으면 단계를 올려 다시 만든다. 끝까지 줄여도 넘으면 BudgetError */
export function fitPrompt<P extends { messages: { content: string }[] }>(cap: number, build: () => P): P {
  if (!(cap > 0)) return build();
  try {
    for (level = 0; ; level++) {
      const p = build();
      const n = promptTokens(p);
      if (n <= cap) return p;
      if (level >= LAST) throw new BudgetError(`요청이 토큰 상한(${cap.toLocaleString()})을 넘어요. 참고 자료를 줄여도 약 ${n.toLocaleString()}토큰이에요. 고급 설정에서 상한을 올려 주세요.`);
    }
  } finally {
    level = 0;
  }
}
