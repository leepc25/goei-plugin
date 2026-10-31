// 종료 → 일지 줄 + 보고서 스냅숏 (docs/설계안_기록_보고서.md 3-3·4장). 엔진 밖에서, 모델 호출 없이.
// 입력은 종료를 반영한 채팅(메시지·scriptstate·인물 기록)과 엔진이 이번 응답에 적어 둔 closed[]. 자동(ttl)·모델 태그·수동 종료 세 길이 여기로 모인다.
import { affinityOf, cueDelta, sumCues } from '../people/affinity';
import { peopleSettings } from '../people/settings';
import { anchorPositions, liveChanges, liveness, messageKey, peopleStore } from '../people/store';
import { factionOfWho, stageOf, type Change } from '../people/types';
import { getPrefs } from '../settings';
import type { Chat, ChatMessage } from '../types';
import { aliveAnchors, liveWallet, readWallet, WALLET_START_DEFAULT } from '../wallet';
import type { Catalog } from '../world/catalog';
import { codesToNames, type AnEntry, type ClosedEvent, type InEntry, type MsEntry, type WorldState } from '../world/engine';
import { findStatusTags } from '../world/status';
import { isMine, periodOf } from './mine';
import type { JournalSettings } from './settings';
import { journalHash, readJournal, readReports, trimJournal, trimReports } from './store';
import {
  PEOPLE_MAX, RESULT_REPORT_MAX, RESULT_ROW_MAX, TRADES_MAX, TRAIL_MAX,
  type JournalAgent, type JournalRow, type JournalStore, type Report, type ReportPerson, type ReportStore, type ReportTrade, type TrailStep,
} from './types';

export interface BuildInput {
  /** 종료를 반영한 메시지가 들어 있는 채팅 (scriptstate 에 지금 일지·보고서·가계부) */
  chat: Chat;
  /** 종료를 반영한 메시지 번호 (수동 종료는 마지막 메시지) */
  index: number;
  /** 종료 뒤 세계 (요원 상태를 읽는다) */
  world: WorldState;
  closed: ClosedEvent[];
  catalog: Catalog;
  faction: string;
  settings: JournalSettings;
  /** 저장 시각 ISO (시험용. 없으면 지금) */
  now?: string;
  /** 가계부 시작 잔고 (없으면 설정값) */
  walletStart?: number;
}

export interface BuildResult {
  journal: JournalStore;
  reports: ReportStore;
  /** 이번에 더한 일지 줄 */
  rows: JournalRow[];
  /** 이번에 더한 보고서 */
  added: Report[];
}

const text = (m: ChatMessage | undefined) => (typeof m?.data === 'string' ? m.data : '');
const cut = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);
const NONE = /^(?:없음|none|-|—|미정|n\/a)$/i;

/** 투입 칸 「P001, P002」·「쟈알디·스팡달」 → 요원과 종료 시점 상태 */
export function parseAgents(deploy: string, world: WorldState, c: Catalog, faction: string): JournalAgent[] {
  const names = codesToNames(deploy ?? '', c, faction).split(/[,，、/·]|\s+및\s+|\s+and\s+/i).map((n) => n.trim()).filter((n) => n && !NONE.test(n));
  const out: JournalAgent[] = [];
  for (const raw of names) {
    const name = raw.replace(/\s*[(（][^)）]*[)）]\s*$/, '').trim() || raw;
    if (out.some((a) => a.name === name)) continue;
    const p = c.people.find((x) => x.name === name || (!!x.english && x.english.toLowerCase() === name.toLowerCase()));
    const rec = p ? world.agents[p.id] : undefined;
    const st = rec && rec.st !== '미정' ? rec.st : '';
    out.push({ id: p?.id ?? '', name: p?.name ?? name, st, ...(rec?.situation ? { situation: cut(rec.situation, 80) } : {}) });
    if (out.length >= 8) break;
  }
  return out;
}

const two = (n: number) => String(n).padStart(2, '0');
/** 세계 분 → 「MMDD」 (UTC 기준, clock() 과 같은 변환). 분을 모르면 저장 시각 날짜 */
function mmdd(at: number | null, now: string): string {
  const d = at === null ? new Date(now) : new Date(at * 60000);
  return Number.isFinite(d.getTime()) ? `${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}` : '0000';
}

function peopleDelta(chat: Chat, from: number, to: number): ReportPerson[] {
  const store = peopleStore(chat);
  if (!store.log.length) return [];
  const live = liveness(chat);
  const all = liveChanges(store, live);
  const ps = peopleSettings(chat.scriptstate);
  const o = { speed: ps.speed, turnCap: ps.turnCap };
  const pos = (c: Change) => live.at.get(c.anchor) ?? -1;
  const span = all.filter((c) => c.kind === 'cue' && c.pin === undefined && !factionOfWho(c.who) && pos(c) >= from && pos(c) <= to);
  const byWho = new Map<string, Change[]>();
  for (const c of span) (byWho.get(c.who) ?? byWho.set(c.who, []).get(c.who)!).push(c);
  const out: ReportPerson[] = [];
  for (const [who, list] of byWho) {
    const delta = sumCues(who, 0, list, 0, -1e9, 1e9, o);
    if (!delta) continue;
    const top = [...list].sort((a, b) => Math.abs(cueDelta(b, o)) - Math.abs(cueDelta(a, o)))[0];
    const person = store.people[who];
    const stage = person ? stageOf(affinityOf(person, all.filter((c) => pos(c) <= to), store.folded[who] ?? 0, o)).label : undefined;
    out.push({ who, delta, ...(top?.cue ? { cue: top.cue } : {}), ...(top?.quote || top?.reason ? { quote: cut(top.quote || top.reason, 60) } : {}), ...(stage ? { stage } : {}) });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, PEOPLE_MAX);
}

function walletSpan(chat: Chat, from: number, to: number, start?: number): { trades: ReportTrade[]; balance: number } {
  const w = readWallet(chat.scriptstate, start ?? getPrefs().walletStart ?? WALLET_START_DEFAULT);
  const live = liveWallet(w, aliveAnchors(chat));
  const at = anchorPositions(chat);
  const pos = (anchor: string) => at.get(anchor) ?? -1;
  // 수동 조정(anchor '')은 거래 목록에서 빼고 잔고에만 반영한다
  const trades = live.filter((e) => e.anchor && pos(e.anchor) >= from && pos(e.anchor) <= to).slice(-TRADES_MAX)
    .map((e) => ({ memo: e.memo, amount: e.amount, ...(e.quote ? { quote: cut(e.quote, 60) } : {}) }));
  const balance = live.filter((e) => !e.anchor || pos(e.anchor) <= to).reduce((n, e) => n + e.amount, w.start);
  return { trades, balance };
}

/** 종료 하나 → 일지 줄 + 보고서. 보고서 번호는 부르는 쪽이 매긴다 */
function snapshot(input: BuildInput, ev: ClosedEvent, anchor: string, now: string): { row: JournalRow; report: Report } {
  const { chat, index, world, catalog, faction } = input;
  const e = ev.entry;
  const an = ev.kind === 'an' ? (e as AnEntry) : null;
  const name = (an ? an.presetName || an.name : e.name) || '이름 미확인';
  const deploy = ev.kind === 'ms' ? (e as MsEntry).visitors : ((e as AnEntry | InEntry).deploy ?? '');
  const agents = parseAgents(deploy, world, catalog, faction);
  const trail: TrailStep[] = (e.trail?.length ? e.trail : e.situation ? [{ m: e.since, e: ev.epoch, text: cut(e.situation, 160) }] : []).slice(-TRAIL_MAX);
  const lastText = trail.length ? trail[trail.length - 1].text : '';
  const prefix = ev.cleared ? '클리어 · ' : '';
  const result = prefix + (lastText || '처리 완료');
  const { from, to } = periodOf(chat, index, e);
  const mine = isMine(chat, from, to, { name, presetName: an?.presetName || undefined, agentNames: agents.map((a) => a.name), touched: e.touched });
  const id = journalHash(`${ev.kind}|${name}|${e.loc}|${e.born ?? ''}|${ev.epoch}`);
  const tags = findStatusTags(text(chat.message?.[index]));
  const last = tags[tags.length - 1];
  const at = ev.minute;
  const grade = an?.grade || undefined;
  const row: JournalRow = {
    id: `j${id}`, kind: ev.kind, name, loc: e.loc, ...(grade ? { grade } : {}), at, since: e.since, born: e.born, idx: index, anchor, mine, cause: ev.cause,
    agents: agents.map(({ id: aid, name: an2, st }) => ({ id: aid, name: an2, st })), result: cut(result, RESULT_ROW_MAX), rpt: `r${id}`, ...(ev.cleared ? { cleared: true } : {}),
  };
  const report: Report = {
    id: `r${id}`, no: '', full: mine, mine, kind: ev.kind, cause: ev.cause,
    head: { name, ...(grade ? { grade } : {}), loc: e.loc, ...(last?.place ? { place: cut(last.place, 60) } : {}), born: e.born, since: e.since, at, duration: at !== null && e.since !== null ? Math.max(0, at - e.since) : null, ...(ev.cleared ? { cleared: true } : {}) },
    trail, agents, result: cut(result, RESULT_REPORT_MAX),
    idx: index, anchor, ...(last ? { statusKey: last.raw.trim() } : {}), savedAt: now,
  };
  if (mine) {
    report.people = peopleDelta(chat, from, to);
    const w = walletSpan(chat, from, to, input.walletStart);
    report.wallet = w.trades;
    report.balance = w.balance;
  }
  return { row, report };
}

/**
 * 이번 응답의 종료들을 일지·보고서에 더한다. 같은 id 가 이미 있으면 건너뛴다 (같은 응답을 두 번 반영해도 두 줄이 되지 않게).
 * 상한을 넘으면 오래된 것부터 (보고서는 고정 제외, 지워진 보고서를 가리키던 줄의 rpt 는 끊는다).
 */
export function buildClosures(input: BuildInput): BuildResult {
  const { chat, index, closed, settings } = input;
  const now = input.now ?? new Date().toISOString();
  const list = Array.isArray(chat.message) ? chat.message : [];
  const m = list[index];
  const anchor = m ? messageKey(m, index) : `#${index + 1}`;
  let journal = readJournal(chat);
  let reports = readReports(chat);
  const rows: JournalRow[] = [];
  const added: Report[] = [];
  const have = new Set(journal.rows.map((r) => r.id));
  for (const ev of closed) {
    const { row, report } = snapshot(input, ev, anchor, now);
    if (have.has(row.id)) continue;
    have.add(row.id);
    const day = mmdd(report.head.at, now);
    const n = reports.items.filter((r) => r.no.startsWith(`RPT-${day}-`)).length + added.filter((r) => r.no.startsWith(`RPT-${day}-`)).length + 1;
    report.no = `RPT-${day}-${two(n)}`;
    rows.push(row);
    added.push(report);
  }
  if (!rows.length) return { journal, reports, rows, added };
  journal = trimJournal({ v: 1, rows: [...journal.rows, ...rows] }, settings.journalCap);
  const t = trimReports({ v: 1, items: [...reports.items, ...added] }, journal, settings.reportCap);
  journal = t.journal;
  reports = t.reports;
  return { journal, reports, rows, added };
}
