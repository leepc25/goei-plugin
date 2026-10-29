// 「기록」 메뉴의 자료형 (docs/설계안_기록_보고서.md 1장): 일지 줄과 보고서.
// 둘 다 채팅 변수 JSON ($goei_journal · $goei_reports). 종료 순간 잘라 둔 스냅숏이라 그 뒤 세계가 바뀌어도 그대로다.
import type { CloseCause, TrailStep } from '../world/engine';

export type { TrailStep, ClosedEvent, CloseCause } from '../world/engine';

export const JOURNAL_KEY = '$goei_journal';
export const REPORTS_KEY = '$goei_reports';

/** an 괴이 · in 사건 · ms 특수 · fd 필드 출동 */
export type JournalKind = 'an' | 'in' | 'ms' | 'fd';
export type JournalCause = CloseCause | 'field';

export const JOURNAL_KIND_LABEL: Record<JournalKind, string> = { an: '괴이', in: '사건', ms: '특수', fd: '필드 출동' };

/** 투입 요원 하나와 종료 시점 상태 (명부에 없는 이름은 id '') */
export interface JournalAgent {
  id: string;
  name: string;
  st: string;
  /** 보고서에만: 종료 시점 요원 상황 글 (≤80) */
  situation?: string;
}

export interface JournalRow {
  /** `j` + hash(kind|name|loc|born|closeEpoch) */
  id: string;
  kind: JournalKind;
  name: string;
  /** 지역 코드 (locName 으로 표시) */
  loc: string;
  grade?: string;
  /** 종료 세계 분 (모르면 null → 「시각 없음」 묶음) */
  at: number | null;
  /** 활성 시작 분 */
  since: number | null;
  born: number | null;
  /** 종료를 반영한 메시지 번호 (리롤 되감기 열쇠). 수동·필드는 그때 마지막 메시지 번호 */
  idx: number;
  /** 그 메시지의 열쇠 (messageKey) */
  anchor: string;
  /** 내가 출동 */
  mine: boolean;
  cause: JournalCause;
  agents: JournalAgent[];
  /** 마지막 상황 글 ≤120자, 없으면 '처리 완료' */
  result: string;
  /** 보고서 id (상한에 밀려 지워지면 없어진다) */
  rpt?: string;
  /** 괴이 「클리어」 태그로 끝남 */
  cleared?: boolean;
}

export interface ReportHead {
  name: string;
  grade?: string;
  loc: string;
  /** 종료 응답 상태창의 위치 칸 */
  place?: string;
  born: number | null;
  since: number | null;
  at: number | null;
  /** 분 (since·at 둘 다 알 때) */
  duration: number | null;
  cleared?: boolean;
}

/** 그 기간에 호감이 움직인 사람 하나 */
export interface ReportPerson {
  who: string;
  delta: number;
  cue?: string;
  /** 근거 인용 (≤60) */
  quote?: string;
  /** 종료 시점 단계 이름 */
  stage?: string;
}

export interface ReportTrade {
  memo: string;
  amount: number;
  quote?: string;
}

export interface Debrief {
  who: string;
  text: string;
  src: 'turn' | 'backfill' | 'manual';
  at: string;
}

export interface Report {
  /** `r` + 일지 줄과 같은 hash */
  id: string;
  /** 표시용 「RPT-MMDD-NN」 */
  no: string;
  /** true = 전체(내가 출동), false = 간이(백그라운드) */
  full: boolean;
  mine: boolean;
  kind: JournalKind;
  cause: JournalCause;
  head: ReportHead;
  /** ≤24 */
  trail: TrailStep[];
  agents: JournalAgent[];
  /** ≤400 */
  result: string;
  /** 전체만, ≤12 */
  people?: ReportPerson[];
  /** 전체만, ≤12 */
  wallet?: ReportTrade[];
  /** 종료 시점 잔고 (전체만) */
  balance?: number;
  debrief?: Debrief;
  pin?: boolean;
  idx: number;
  anchor: string;
  /** 종료 응답의 상태창 원문(trim) → 채팅 카드 자리표. 없으면 카드 없음 */
  statusKey?: string;
  /** ISO */
  savedAt: string;
}

export interface JournalStore {
  v: 1;
  rows: JournalRow[];
}
export interface ReportStore {
  v: 1;
  items: Report[];
}

export const TRAIL_MAX = 24;
export const RESULT_ROW_MAX = 120;
export const RESULT_REPORT_MAX = 400;
export const PEOPLE_MAX = 12;
export const TRADES_MAX = 12;
