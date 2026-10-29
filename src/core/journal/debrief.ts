// 소감 (docs/설계안_기록_보고서.md 6장): 종료 사건의 담당 요원 소감 2~3줄.
// 모델은 따로 부르지 않는다 — 인물 기록 갱신기 호출에 `ended_now` 입력과 `debriefs[]` 출력 칸을 얹는다 (가계부 거래와 같은 길).
// 보고서 페이지 「소감 쓰기」만 보조 모델 1회 (host/journal.ts, 짧은 전용 지침 DEBRIEF_PROMPT).
import { locName } from '../world/geo';
import { JOURNAL_KIND_LABEL, type Debrief, type Report, type ReportStore } from './types';

/** 갱신기 입력 자료 `ended_now` 한 건 */
export interface EndedNow {
  id: string;
  kind: string;
  name: string;
  grade?: string;
  loc: string;
  /** 투입 요원 이름 (소감을 쓸 사람 후보) */
  agents: string[];
  result: string;
  /** 경과 마지막 3줄 */
  trail_tail: string[];
  mine: boolean;
}

export const DEBRIEF_TEXT_MAX = 300;
export const ENDED_NOW_MAX = 3;

/** 요청 글에 들어가므로 템플릿 기호·줄바꿈을 막는다 */
const plain = (s: unknown, max: number) => String(s ?? '').replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％').replace(/\s+/g, ' ').trim().slice(0, max);

/** 보고서 → 갱신기 입력 한 건 */
export function endedNowOf(r: Report): EndedNow {
  return {
    id: r.id,
    kind: JOURNAL_KIND_LABEL[r.kind] ?? r.kind,
    name: plain(r.head.name, 60),
    ...(r.head.grade ? { grade: r.head.grade } : {}),
    loc: plain(r.head.place || locName(r.head.loc) || r.head.loc, 60),
    agents: r.agents.map((a) => a.name).filter(Boolean).slice(0, 8),
    result: plain(r.result, 200),
    trail_tail: r.trail.slice(-3).map((t) => plain(t.text, 160)),
    mine: r.mine,
  };
}

/** 이 묶음(응답 번호들)에서 종료돼 아직 소감이 없는 보고서 (오래된 것부터, 최대 3건) */
export function endedInBatch(reports: ReportStore, indexes: number[]): Report[] {
  const set = new Set(indexes);
  return reports.items.filter((r) => set.has(r.idx) && !r.debrief).slice(-ENDED_NOW_MAX);
}

export interface DebriefItem { id: string; who: string; text: string }

/**
 * 모델이 돌려준 소감 한 건을 검사한다. 통과하면 정리된 항목, 아니면 버린 이유.
 * id 는 ended 에 있어야, who 는 그 사건 투입 요원 이름(없으면 첫 요원, 요원이 없으면 「담당 요원」), 글은 비어 있지 않고 템플릿 기호가 없어야 한다.
 */
export function validateDebrief(item: unknown, ended: EndedNow[]): { ok: true; value: DebriefItem } | { ok: false; reason: string } {
  const d = item as Partial<DebriefItem> | null;
  if (!d || typeof d !== 'object') return { ok: false, reason: '항목이 아님' };
  const e = ended.find((x) => x.id === d.id);
  if (!e) return { ok: false, reason: '이번 턴에 종료된 사건이 아님' };
  const raw = typeof d.text === 'string' ? d.text : '';
  if (/\{\{|%%/.test(raw)) return { ok: false, reason: '템플릿 기호가 들어 있음' };
  const text = plain(raw, DEBRIEF_TEXT_MAX);
  if (text.length < 4) return { ok: false, reason: '본문 없음' };
  const whoRaw = typeof d.who === 'string' ? d.who.trim() : '';
  const who = e.agents.find((a) => a === whoRaw || (!!whoRaw && (a.includes(whoRaw) || whoRaw.includes(a)))) ?? e.agents[0] ?? '담당 요원';
  return { ok: true, value: { id: e.id, who, text } };
}

/** 검사를 통과한 소감을 보고서에 적는다 (사건당 하나, 같은 id 가 둘이면 첫 것. 이미 있으면 manual 만 덮어쓴다). 바뀐 보고서 수 */
export function withDebriefs(store: ReportStore, items: DebriefItem[], src: Debrief['src'], now = new Date().toISOString()): { store: ReportStore; applied: number } {
  const seen = new Set<string>();
  let applied = 0;
  const next = store.items.map((r) => {
    const d = items.find((x) => x.id === r.id && !seen.has(x.id));
    if (!d) return r;
    seen.add(d.id);
    if (r.debrief && src !== 'manual') return r;
    applied++;
    return { ...r, debrief: { who: d.who, text: d.text, src, at: now } };
  });
  return { store: applied ? { v: 1, items: next } : store, applied };
}

/** 수동 1회(보고서 페이지 「소감 쓰기」) 전용 짧은 지침. 갱신기 전체 지침(수천 자)을 보낼 이유가 없다 */
export const DEBRIEF_PROMPT = [
  'You write a short after-action note for a Korean roleplay chat about an anomaly-response bureau.',
  '`ended_now` lists one incident that just ended: its name, grade, place, the agents who were deployed, the result, and the last few situation lines. `span` holds excerpts of the story around the ending (reference only).',
  'Write, in Korean, 2–3 sentences (≤240 characters) in the voice of ONE deployed agent (pick from `agents`; use the first one when unsure): what happened and how it felt, as a debrief. Use only facts present in `ended_now` or `span`; never invent names, numbers or outcomes. No quotation marks around the whole note, no template symbols such as double braces or double percent signs.',
  'Return exactly one JSON object and nothing else: {"debriefs":[{"id":"<ended_now id>","who":"<agent name>","text":"<Korean 2–3 sentences>"}]}',
].join('\n');
