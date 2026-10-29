// 새 보고서 알림 (docs/설계안_기록_보고서.md 5-10절): 필드 출동 종료처럼 응답 처리 밖에서 보고서가 생기면 화면(app.ts)이 바로 알게 한다.
// 순수 구독/발행. 채팅 변수에는 아무것도 쓰지 않는다.
import type { JournalCause } from './types';

export interface ReportNotice {
  id: string;
  cause: JournalCause;
  title: string;
  /** 「결과 · 요원 · 소요」 한 줄 */
  summary: string;
}

const subs = new Set<(n: ReportNotice) => void>();
let last: ReportNotice | null = null;

export function onReport(cb: (n: ReportNotice) => void): () => void {
  subs.add(cb);
  return () => void subs.delete(cb);
}

export function emitReport(n: ReportNotice): void {
  last = n;
  for (const f of subs) {
    try {
      f(n);
    } catch {
      /* 구독자 오류는 다른 구독자를 막지 않는다 */
    }
  }
}

/** 이 세션에서 마지막으로 생긴 보고서 알림 (게임 다리 lastReport) */
export const lastReportNotice = () => last;
