// 일지·보고서 읽기/쓰기·상한·고정·리롤 되감기 (docs/설계안_기록_보고서.md 1-5절).
// 채팅 변수 JSON 하나씩. 깨진 값은 빈 저장소로 (parseWorld 와 같은 관용). 일지는 영구 보관 — 메시지가 지워져도 지우지 않는다.
import type { Chat, ScriptState } from '../types';
import { JOURNAL_KEY, REPORTS_KEY, type JournalRow, type JournalStore, type Report, type ReportStore } from './types';

type Vars = Record<string, unknown> | undefined;

/** 간단한 해시 (FNV-1a 32bit, 36진수) — 일지·보고서 id */
export function journalHash(text: string): string {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

const KINDS = new Set(['an', 'in', 'ms', 'fd']);
const CAUSES = new Set(['model', 'ttl', 'manual', 'field']);

const isRow = (r: unknown): r is JournalRow => {
  const x = r as JournalRow;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && KINDS.has(x.kind) && typeof x.name === 'string' && typeof x.loc === 'string'
    && typeof x.idx === 'number' && typeof x.anchor === 'string' && typeof x.mine === 'boolean' && CAUSES.has(x.cause) && Array.isArray(x.agents) && typeof x.result === 'string';
};
const isReport = (r: unknown): r is Report => {
  const x = r as Report;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.no === 'string' && typeof x.full === 'boolean' && typeof x.mine === 'boolean'
    && KINDS.has(x.kind) && CAUSES.has(x.cause) && !!x.head && typeof x.head === 'object' && Array.isArray(x.trail) && Array.isArray(x.agents)
    && typeof x.result === 'string' && typeof x.idx === 'number' && typeof x.anchor === 'string' && typeof x.savedAt === 'string';
};

const varsOf = (src: Chat | Vars): Vars => (src && typeof src === 'object' && 'message' in src ? (src as Chat).scriptstate : (src as Vars));

export const emptyJournal = (): JournalStore => ({ v: 1, rows: [] });
export const emptyReports = (): ReportStore => ({ v: 1, items: [] });

/** 일지 읽기 (채팅 또는 scriptstate). 깨진 줄은 버린다 */
export function readJournal(src: Chat | Vars): JournalStore {
  const raw = varsOf(src)?.[JOURNAL_KEY];
  if (typeof raw !== 'string' || !raw) return emptyJournal();
  try {
    const j = JSON.parse(raw) as JournalStore;
    if (j && j.v === 1 && Array.isArray(j.rows)) return { v: 1, rows: j.rows.filter(isRow) };
  } catch {
    /* 깨진 값은 새로 시작 */
  }
  return emptyJournal();
}

export function readReports(src: Chat | Vars): ReportStore {
  const raw = varsOf(src)?.[REPORTS_KEY];
  if (typeof raw !== 'string' || !raw) return emptyReports();
  try {
    const r = JSON.parse(raw) as ReportStore;
    if (r && r.v === 1 && Array.isArray(r.items)) return { v: 1, items: r.items.filter(isReport) };
  } catch {
    /* 깨진 값은 새로 시작 */
  }
  return emptyReports();
}

export const journalVars = (j: JournalStore): ScriptState => ({ [JOURNAL_KEY]: JSON.stringify(j) });
export const reportVars = (r: ReportStore): ScriptState => ({ [REPORTS_KEY]: JSON.stringify(r) });
export const recordVars = (j: JournalStore, r: ReportStore): ScriptState => ({ ...journalVars(j), ...reportVars(r) });

/** 일지 상한: 넘치면 앞(오래된 것)부터 지운다 */
export function trimJournal(j: JournalStore, cap: number): JournalStore {
  if (j.rows.length <= cap) return j;
  return { v: 1, rows: j.rows.slice(j.rows.length - cap) };
}

/** 보고서 상한: 고정 안 된 것 가운데 오래된 것부터. 지워진 보고서를 가리키던 일지 줄의 rpt 는 끊는다 (줄은 남는다) */
export function trimReports(r: ReportStore, j: JournalStore, cap: number): { reports: ReportStore; journal: JournalStore; removed: string[] } {
  const loose = r.items.filter((x) => !x.pin).length;
  if (loose <= cap) return { reports: r, journal: j, removed: [] };
  let drop = loose - cap;
  const removed: string[] = [];
  const items = r.items.filter((x) => {
    if (x.pin || drop <= 0) return true;
    drop -= 1;
    removed.push(x.id);
    return false;
  });
  return { reports: { v: 1, items }, journal: unlinkReports(j, removed), removed };
}

/** 지워진 보고서 id 를 가리키던 일지 줄의 rpt 를 뗀다 */
export function unlinkReports(j: JournalStore, ids: string[]): JournalStore {
  if (!ids.length) return j;
  const gone = new Set(ids);
  if (!j.rows.some((row) => row.rpt && gone.has(row.rpt))) return j;
  return { v: 1, rows: j.rows.map((row) => (row.rpt && gone.has(row.rpt) ? { ...row, rpt: undefined } : row)) };
}

/** 보고서 고정/해제 (고정은 상한 계산에서 빠진다). 없는 id 면 그대로 */
export function pinReport(r: ReportStore, id: string, on: boolean): ReportStore {
  if (!r.items.some((x) => x.id === id)) return r;
  return { v: 1, items: r.items.map((x) => (x.id === id ? { ...x, pin: on || undefined } : x)) };
}

/**
 * 리롤 되감기: 같은 자리의 응답이 다시 반영될 때, **바로 그 응답이 만들었던** 일지 줄·보고서를 지운다.
 * 대상은 `$goei_prev` 가 적어 둔 그 응답의 일지 줄 id 목록(`made`)이다 — 메시지 번호(idx)로 지우면 앞 메시지를 지운 뒤 같은 번호에 온 무관한
 * 리롤이 옛 기록을 지운다(일지는 영구 보관). id 목록이 없는 옛 `$goei_prev`(2026-10-29 이전 저장)만 번호로 지운다.
 * 수동(manual)·필드(field) 종료는 리롤 기준 상태에도 이미 반영돼 있어(prevWorldVars) 되살아나지 않으므로 두고, 고정한 보고서도 둔다.
 */
export function rewindClosures(j: JournalStore, r: ReportStore, target: number | string[]): { journal: JournalStore; reports: ReportStore; changed: boolean } {
  const auto = (cause: string) => cause === 'model' || cause === 'ttl';
  const pinned = new Set(r.items.filter((x) => x.pin).map((x) => x.id));
  // 보고서 id 는 일지 줄 id 와 같은 해시 (`r…` ↔ `j…`)
  const made = Array.isArray(target) ? new Set(target.map((id) => id.slice(1))) : null;
  const hitRow = (row: JournalRow) => (made ? made.has(row.id.slice(1)) : row.idx === target);
  const hitRpt = (x: Report) => (made ? made.has(x.id.slice(1)) : x.idx === target);
  const items = r.items.filter((x) => !(hitRpt(x) && auto(x.cause) && !x.pin));
  const rows = j.rows.filter((row) => !(hitRow(row) && auto(row.cause) && !(row.rpt && pinned.has(row.rpt))));
  const changed = items.length !== r.items.length || rows.length !== j.rows.length;
  return { journal: changed ? { v: 1, rows } : j, reports: changed ? { v: 1, items } : r, changed };
}

/** 일지 줄 → 보고서 (없으면 null) */
export function reportOf(r: ReportStore, row: JournalRow | undefined): Report | null {
  if (!row?.rpt) return null;
  return r.items.find((x) => x.id === row.rpt) ?? null;
}
