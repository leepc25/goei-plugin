// 연대기·인사 기록부 (2026-11-06 사용자 「진행시켜」, 전수점검 아이디어 H-1·H-2).
// 둘 다 모델을 부르지 않고, 이 채팅에 이미 남은 기록(일지·보고서·가계부·인물 기록 변경 기록)만 센다.
// 연대기는 플레이하는 인물(유저)의 것: 내가 나간 사건, 나를 향한 인물 호감 「단계」 변화, 나에 대한 세력 「구간」 변화, 신분(진급) 변경만.
// 자잘한 것(거래 한 건, 수치 오르내림, 메모)은 올리지 않는다 (사용자: 「너무 자잘한 것까지 다 누적되면 곤란」).
// 필드(게임)는 v0.20.4(11-04)에 뺐으므로 옛 채팅에 남은 `fd` 줄은 세지 않는다.
import type { Chat, LoreEntry } from '../types';
import { factionWho, FACTION_MAX, FACTION_MIN, AFF_MAX, AFF_MIN, factionStage, stageOf, type Change, type PeopleStore } from '../people/types';
import { sumCues } from '../people/affinity';
import { factionBase, temperOf } from '../people/base';
import { userFactionOf } from '../people/faction';
import { peopleSettings } from '../people/settings';
import { liveChanges, liveness, peopleStore } from '../people/store';
import { lastStatusFields } from '../world/tags';
import { locName } from '../world/geo';
import { aliveAnchors, liveWallet, readWallet, walletBalance } from '../wallet';
import { readDirectory } from '../world/directory';
import { playerAgent, playerId } from '../player';
import { readJournal } from './store';
import { JOURNAL_KIND_LABEL } from './types';

export type ChronKind = 'event' | 'person' | 'faction' | 'rank';
export const CHRON_KIND_LABEL: Record<ChronKind, string> = { event: '사건', person: '인물', faction: '세력', rank: '신분' };

export interface ChronEntry {
  /** 메시지 순서 (정렬 열쇠). 모르면 큰 수 */
  pos: number;
  /** 같은 메시지 안 순서 */
  seq: number;
  kind: ChronKind;
  /** 세계 분 (일지 줄만). 없으면 null */
  at: number | null;
  /** 날짜 묶음 글 (상태창 날짜 → 없으면 일지 시각) */
  day: string;
  /** 머리 (굵게) */
  title: string;
  /** 설명 한 줄 */
  text: string;
  /** 보고서 id (누르면 보고서) */
  rpt?: string;
  /** 인물 이름 (누르면 인물 기록) */
  person?: string;
  /** 세력 코드 (누르면 세력 기록) */
  faction?: string;
  /** 괴이 등급 (사건 줄) */
  grade?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 메시지 번호 → 그 메시지(또는 그 앞 가장 가까운 응답)의 상태창 날짜 */
function dayLabels(chat: Chat): (pos: number) => string {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const days: string[] = [];
  let last = '';
  list.forEach((m, i) => {
    if (m.role === 'char') {
      const st = lastStatusFields([str(m.data)]);
      if (st?.date) last = st.date;
    }
    days[i] = last;
  });
  return (pos) => (pos < 0 ? '' : days[Math.min(pos, days.length - 1)] ?? last);
}

const two = (n: number) => String(n).padStart(2, '0');
const dayOfMinute = (at: number | null) => {
  if (at === null) return '';
  const d = new Date(at * 60000);
  return `${d.getUTCFullYear()}.${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())}`;
};
const hhmm = (at: number | null) => {
  if (at === null) return '';
  const d = new Date(at * 60000);
  return `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
};

const CAUSE_LABEL: Record<string, string> = { manual: '종료', expire: '기한 종료', cleared: '클리어', clear: '클리어' };

/** 유저의 연대기 (오래된 것부터). 내 사건·출동·인물 단계·세력 구간·신분만 */
export function buildChronicle(chat: Chat, lore: LoreEntry[] | undefined): ChronEntry[] {
  const out: ChronEntry[] = [];
  const day = dayLabels(chat);
  // 1) 내 사건 (일지): 종료 줄 하나
  for (const r of readJournal(chat).rows) {
    if (!r.mine || r.kind === 'fd') continue;
    const pos = r.idx;
    const d = day(pos) || dayOfMinute(r.at);
    const when = hhmm(r.at);
    const kind = `${JOURNAL_KIND_LABEL[r.kind]}${r.grade ? ` ${r.grade}` : ''}`;
    const dur = r.at !== null && r.since !== null ? Math.max(0, r.at - r.since) : null;
    const durText = dur === null ? '' : `${Math.floor(dur / 60) ? `${Math.floor(dur / 60)}시간 ` : ''}${dur % 60}분`;
    const how = r.cleared ? '클리어' : CAUSE_LABEL[String(r.cause)] ?? '종료';
    out.push({ pos, seq: 0, kind: 'event', at: r.at, day: d, title: r.name, grade: r.grade, rpt: r.rpt, text: [kind, locName(r.loc) || r.loc, when, durText ? `소요 ${durText}` : '', how].filter(Boolean).join(' · ') });
  }
  // 2) 인물 호감 단계·세력 구간이 바뀐 때, 신분 변경 (변경 기록을 앞에서부터 다시 더해 단계가 바뀌는 지점만)
  const store: PeopleStore = peopleStore(chat);
  const live = liveness(chat);
  const changes = liveChanges(store, live);
  const s = peopleSettings(chat.scriptstate);
  const uf = userFactionOf(store, chat);
  const names = Object.fromEntries(readDirectory(lore).orgs.filter((o) => o.faction).map((o) => [o.faction, o.name]));
  const byWho = new Map<string, Change[]>();
  for (const c of changes) if (c.kind === 'cue') (byWho.get(c.who) ?? byWho.set(c.who, []).get(c.who)!).push(c);
  for (const [who, list] of byWho) {
    const isFac = who.startsWith('세력:');
    const code = isFac ? who.slice(3) : '';
    if (isFac ? !code : !store.people[who]) continue;
    const base = isFac ? factionBase(code, uf) : store.people[who].affinity.base;
    const folded = store.folded[who] ?? 0;
    const o = isFac ? { speed: s.speed, turnCap: s.turnCap } : { temper: temperOf(who), speed: s.speed, turnCap: s.turnCap };
    const [min, max] = isFac ? [FACTION_MIN, FACTION_MAX] : [AFF_MIN, AFF_MAX];
    const stageLabel = (v: number) => (isFac ? factionStage(v, s.factionBounds).label : stageOf(v).label);
    let prev = stageLabel(sumCues(who, base, [], folded, min, max, o));
    for (let i = 0; i < list.length; i++) {
      const now = stageLabel(sumCues(who, base, list.slice(0, i + 1), folded, min, max, o));
      if (now === prev) continue;
      const c = list[i];
      const pos = live.at.get(c.anchor) ?? 1e9;
      const label = (isFac ? names[code] : '') || (isFac ? code : who);
      out.push({ pos, seq: 1 + c.seq, kind: isFac ? 'faction' : 'person', at: null, day: day(pos), title: label, text: `${isFac ? '평판' : '호감'} ${prev} → ${now}${c.reason ? ` · ${c.reason}` : ''}`, ...(isFac ? { faction: code } : { person: who }) });
      prev = now;
    }
  }
  for (const c of changes) {
    if (c.kind !== 'identity') continue;
    const what = [c.faction ? names[c.faction] ?? c.faction : '', c.rank ?? ''].filter(Boolean).join(' ');
    if (!what) continue;
    const pos = live.at.get(c.anchor) ?? 1e9;
    out.push({ pos, seq: 1 + c.seq, kind: 'rank', at: null, day: day(pos), title: '신분', text: `${what}${c.reason ? ` · ${c.reason}` : ''}` });
  }
  return out.sort((a, b) => a.pos - b.pos || a.seq - b.seq);
}

export interface Personnel {
  /** 사원 번호 (플레이하는 인물 id, 없으면 '') */
  id: string;
  name: string;
  faction: string;
  rank: string;
  /** 첫 응답의 상태창 날짜 */
  since: string;
  /** 내 사건(괴이·사건·특수) 수 */
  closed: number;
  cleared: number;
  /** 같이 간 요원 Top3 [이름, 횟수] */
  companions: [string, number][];
  /** 지출 합계(음수 거래의 절댓값)·수입 합계·잔고 */
  spent: number;
  earned: number;
  balance: number;
  /** 세력 평판: [이름, 구간 이름] (주인공 소속 제외, 중립 아닌 것만) */
  standings: [string, string][];
  /** 받은 배지 */
  badges: string[];
}

/** 인사 기록부 숫자 (사원증 뒷면) */
export function buildPersonnel(chat: Chat, lore: LoreEntry[] | undefined, walletStart: number, userName: string): Personnel {
  const rows = readJournal(chat).rows.filter((r) => r.mine && r.kind !== 'fd');
  const events = rows;
  const comp = new Map<string, number>();
  for (const r of rows) for (const a of r.agents) if (a.name) comp.set(a.name, (comp.get(a.name) ?? 0) + 1);
  const pa = playerAgent(lore, chat.scriptstate);
  const alive = aliveAnchors(chat);
  const w = readWallet(chat.scriptstate, walletStart);
  const trades = liveWallet(w, alive);
  const store = peopleStore(chat);
  const changes = liveChanges(store, liveness(chat));
  const s = peopleSettings(chat.scriptstate);
  const uf = userFactionOf(store, chat);
  const dir = readDirectory(lore);
  const names = Object.fromEntries(dir.orgs.filter((o) => o.faction).map((o) => [o.faction, o.name]));
  const standings: [string, string][] = [];
  for (const code of new Set([...Object.keys(store.factions), ...changes.filter((c) => c.who.startsWith('세력:')).map((c) => c.who.slice(3))])) {
    if (!code || code === uf) continue;
    const v = sumCues(factionWho(code), factionBase(code, uf), changes, store.folded[factionWho(code)] ?? 0, FACTION_MIN, FACTION_MAX, { speed: s.speed, turnCap: s.turnCap });
    const st = factionStage(v, s.factionBounds);
    if (st.id !== 'neutral') standings.push([names[code] ?? code, st.label]);
  }
  const first = (Array.isArray(chat.message) ? chat.message : []).find((m) => m.role === 'char');
  const since = first ? lastStatusFields([str(first.data)])?.date ?? '' : '';
  const badges: string[] = [];
  if (events.length >= 1) badges.push('첫 종료');
  if (events.length >= 5) badges.push('종료 5건');
  if (events.length >= 10) badges.push('종료 10건');
  if (rows.some((r) => r.cleared)) badges.push('클리어');
  if (comp.size >= 5) badges.push('동행 5명');
  return {
    id: playerId(chat.scriptstate) || '',
    name: pa?.name || userName || '나',
    faction: (store.identity?.faction && names[store.identity.faction]) || names[uf] || store.identity?.faction || uf || '',
    rank: store.identity?.rank || pa?.rank || '',
    since,
    closed: events.length,
    cleared: rows.filter((r) => r.cleared).length,
    companions: [...comp.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3),
    spent: trades.filter((e) => e.amount < 0).reduce((n, e) => n - e.amount, 0),
    earned: trades.filter((e) => e.amount > 0).reduce((n, e) => n + e.amount, 0),
    balance: walletBalance(w, alive),
    standings,
    badges,
  };
}

