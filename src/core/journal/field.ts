// 필드 출동 종료 → 보고서 (docs/설계안_기록_보고서.md 5-10절). 엔진 종료가 아니라 필드 장부(core/field.ts)의 exit_anomaly 사건을 재료로 만든다.
// 같은 방문(visit, 없으면 같은 anchor)의 마지막 enter_anomaly 이후 사건이 경과, 투입은 주인공 + 사건에 이름이 나온 사람, 결과는 exit 글,
// 인물 변화·거래는 src 'field' 가운데 같은 anchor·구간의 것. 모델 호출 없음. 같은 출동을 두 번 받아도 id 가 같아 한 번만.
import { affinityOf, cueDelta, sumCues } from '../people/affinity';
import { peopleSettings } from '../people/settings';
import { liveChanges, liveness, messageKey, peopleStore } from '../people/store';
import { factionOfWho, stageOf, type Change } from '../people/types';
import { getPrefs } from '../settings';
import type { Chat } from '../types';
import { aliveAnchors, readWallet, walletBalance, WALLET_START_DEFAULT } from '../wallet';
import { fieldRecord, type FieldEvent, type FieldKind } from '../field';
import type { Catalog } from '../world/catalog';
import type { JournalSettings } from './settings';
import { journalHash, readJournal, readReports, trimJournal, trimReports } from './store';
import { PEOPLE_MAX, RESULT_REPORT_MAX, RESULT_ROW_MAX, TRADES_MAX, TRAIL_MAX, type JournalAgent, type JournalRow, type JournalStore, type Report, type ReportPerson, type ReportStore, type TrailStep } from './types';

export interface FieldBuildInput {
  /** exit_anomaly 사건이 이미 들어 있는 채팅 */
  chat: Chat;
  /** 그 exit_anomaly 사건 (id 로 장부에서 찾는다) */
  exit: FieldEvent;
  /** 주인공 이름 (playerAgent 또는 페르소나) */
  player: string;
  /** 필드 거점 이름 (loc 칸에 그대로) */
  site: string;
  /** 명부 (요원 id 를 붙일 때, 없어도 된다) */
  catalog?: Catalog | null;
  /** 출동 시작 때의 본편 시각 (분). 모르면 null */
  baseMinute: number | null;
  settings: JournalSettings;
  now?: string;
  walletStart?: number;
}

export interface FieldBuildResult {
  journal: JournalStore;
  reports: ReportStore;
  row: JournalRow;
  report: Report;
  /** 이미 있던 출동이면 false (저장할 것 없음) */
  added: boolean;
}

const KIND_LABEL: Partial<Record<FieldKind, string>> = {
  move: '이동', act: '행동', hurt: '부상', down: '쓰러짐', kill: '처치', flee: '도주', provoke: '도발', gift: '선물', trade: '거래', quest: '의뢰',
  follow: '동행', unfollow: '동행 해제', enter_anomaly: '투입', exit_anomaly: '종료', enter_site: '진입', detected: '발각', appoint: '약속', call: '호출',
};
const cut = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);
const two = (n: number) => String(n).padStart(2, '0');
const mmdd = (at: number | null, now: string) => {
  const d = at === null ? new Date(now) : new Date(at * 60000);
  return Number.isFinite(d.getTime()) ? `${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}` : '0000';
};

/** 「작전 투입: <label>」·「작전 종료 (귀환): <label>, 처치 1, 부상 0」 → label */
export function fieldLabel(enterText: string | undefined, exitText: string): string {
  const a = /^작전 투입:\s*(.+)$/.exec(enterText ?? '');
  if (a) return cut(a[1], 60);
  const b = /^작전 종료[^:]*:\s*([^,]+)/.exec(exitText);
  return b ? cut(b[1], 60) : '필드 출동';
}

function fieldPeople(chat: Chat, anchor: string, visit: string | undefined): ReportPerson[] {
  const store = peopleStore(chat);
  if (!store.log.length) return [];
  const live = liveness(chat);
  const all = liveChanges(store, live);
  const ps = peopleSettings(chat.scriptstate);
  const o = { speed: ps.speed, turnCap: ps.turnCap };
  const span = all.filter((c) => c.kind === 'cue' && c.src === 'field' && c.anchor === anchor && !factionOfWho(c.who) && (!visit || !c.group || c.group.startsWith(`${anchor}|${visit}|`)));
  const byWho = new Map<string, Change[]>();
  for (const c of span) (byWho.get(c.who) ?? byWho.set(c.who, []).get(c.who)!).push(c);
  const out: ReportPerson[] = [];
  for (const [who, list] of byWho) {
    const delta = sumCues(who, 0, list, 0, -1e9, 1e9, o);
    if (!delta) continue;
    const top = [...list].sort((a, b) => Math.abs(cueDelta(b, o)) - Math.abs(cueDelta(a, o)))[0];
    const person = store.people[who];
    const stage = person ? stageOf(affinityOf(person, all, store.folded[who] ?? 0, o)).label : undefined;
    out.push({ who, delta, ...(top?.cue ? { cue: top.cue } : {}), ...(top?.reason ? { quote: cut(top.reason, 60) } : {}), ...(stage ? { stage } : {}) });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, PEOPLE_MAX);
}

/** 필드 출동 하나를 일지·보고서에 더한다 */
export function buildFieldReport(input: FieldBuildInput): FieldBuildResult | null {
  const { chat, exit, settings } = input;
  const now = input.now ?? new Date().toISOString();
  const events = fieldRecord(chat).events;
  const xi = events.findIndex((e) => e.id === exit.id);
  const exitEv = xi >= 0 ? events[xi] : exit;
  if (exitEv.kind !== 'exit_anomaly') return null;
  const sameRun = (e: FieldEvent) => e.anchor === exitEv.anchor && (!exitEv.visit || !e.visit || e.visit === exitEv.visit);
  // 같은 방문의 마지막 투입(enter_anomaly)까지 거슬러 간다. 사이에 있는 다른 종료 사건은 같은 출동을 거듭 받은 것(새 id 로 와도)이라
  // 건너뛴다 — 그래야 id 가 같아 한 번만 적힌다 (QC 2026-10-29: 두 번째 종료에서 멈춰 투입 없는 새 보고서가 생겼다)
  let ei = -1;
  for (let i = (xi >= 0 ? xi : events.length) - 1; i >= 0; i--) {
    const e = events[i];
    if (!sameRun(e)) continue;
    if (e.kind === 'enter_anomaly') {
      ei = i;
      break;
    }
  }
  const enter = ei >= 0 ? events[ei] : null;
  const between = (ei >= 0 ? events.slice(ei + 1, xi >= 0 ? xi : undefined) : []).filter((e) => sameRun(e) && e.kind !== 'exit_anomaly');
  const name = fieldLabel(enter?.text, exitEv.text);
  const since = input.baseMinute;
  const dur = enter ? Math.max(1, Math.round((exitEv.at - enter.at) / 60000)) : null;
  const at = since !== null && dur !== null ? since + dur : since;
  const minuteOf = (e: FieldEvent) => (since === null || !enter ? null : since + Math.max(0, Math.round((e.at - enter.at) / 60000)));
  const trail: TrailStep[] = [
    ...(enter ? [{ m: since, e: enter.at, text: cut(enter.text, 160) }] : []),
    ...between.slice(-(TRAIL_MAX - 2)).map((e) => ({ m: minuteOf(e), e: e.at, text: cut(`(${KIND_LABEL[e.kind] ?? e.kind}) ${e.text}`, 160) })),
    { m: at, e: exitEv.at, text: cut(exitEv.text, 160) },
  ].slice(-TRAIL_MAX);
  // 투입: 주인공 + 사건에 이름이 나온 사람 (명부에 있으면 id)
  const people = input.catalog?.people ?? [];
  const agents: JournalAgent[] = [{ id: '', name: cut(input.player || '주인공', 40), st: '' }];
  for (const e of [...(enter ? [enter] : []), ...between, exitEv]) {
    for (const w of e.who ?? []) {
      const n = cut(w, 40);
      if (!n || agents.some((a) => a.name === n)) continue;
      const p = people.find((x) => x.name === n);
      agents.push({ id: p?.id ?? '', name: p?.name ?? n, st: '' });
      if (agents.length >= 8) break;
    }
    if (agents.length >= 8) break;
  }
  const result = cut(exitEv.text, RESULT_REPORT_MAX) || '처리 완료';
  const list = Array.isArray(chat.message) ? chat.message : [];
  const index = Math.max(0, list.length - 1);
  const anchor = list[index] ? messageKey(list[index], index) : `#${index + 1}`;
  const id = journalHash(`fd|${exitEv.visit ?? ''}|${exitEv.anchor}|${enter?.id ?? exitEv.id}`);
  let journal = readJournal(chat);
  let reports = readReports(chat);
  const row: JournalRow = {
    id: `j${id}`, kind: 'fd', name, loc: input.site, at, since, born: since, idx: index, anchor, mine: true, cause: 'field',
    agents: agents.map(({ id: aid, name: an, st }) => ({ id: aid, name: an, st })), result: cut(result, RESULT_ROW_MAX), rpt: `r${id}`,
  };
  const existing = journal.rows.find((r) => r.id === row.id);
  if (existing) {
    const report = reports.items.find((r) => r.id === row.rpt);
    return report ? { journal, reports, row: existing, report, added: false } : null;
  }
  // 그 구간의 필드 거래 (src field, 같은 anchor, 시작~종료 사이)
  const w = readWallet(chat.scriptstate, input.walletStart ?? getPrefs().walletStart ?? WALLET_START_DEFAULT);
  const t0 = enter ? enter.at : exitEv.at - 1;
  const trades = w.log.filter((e) => e.src === 'field' && e.anchor === exitEv.anchor && (() => { const t = Date.parse(e.at); return !Number.isFinite(t) || (t >= t0 - 1000 && t <= exitEv.at + 60000); })())
    .slice(-TRADES_MAX).map((e) => ({ memo: e.memo, amount: e.amount, ...(e.place ? { quote: cut(e.place, 60) } : {}) }));
  const day = mmdd(at, now);
  const no = `RPT-${day}-${two(reports.items.filter((r) => r.no.startsWith(`RPT-${day}-`)).length + 1)}`;
  const report: Report = {
    id: `r${id}`, no, full: true, mine: true, kind: 'fd', cause: 'field',
    head: { name, loc: input.site, place: input.site, born: since, since, at, duration: dur },
    trail, agents, result, people: fieldPeople(chat, exitEv.anchor, exitEv.visit), wallet: trades, balance: walletBalance(w, aliveAnchors(chat)),
    idx: index, anchor, savedAt: now,
  };
  journal = trimJournal({ v: 1, rows: [...journal.rows, row] }, settings.journalCap);
  const t = trimReports({ v: 1, items: [...reports.items, report] }, journal, settings.reportCap);
  return { journal: t.journal, reports: t.reports, row, report, added: true };
}

/** 필드 시트·게임 자막용 한 줄: 「결과 · 요원 · 소요」 */
export function fieldSummary(r: Report): string {
  const dur = r.head.duration !== null ? `${Math.floor(r.head.duration / 60) ? `${Math.floor(r.head.duration / 60)}시간 ` : ''}${r.head.duration % 60}분` : '';
  const who = r.agents.map((a) => a.name).filter(Boolean).join(' · ');
  return [cut(r.result, 60), who, dur].filter(Boolean).join(' · ');
}
