// 연대기·인사 기록부 (2026-11-06 사용자 「진행시켜」, 아이디어 묶음 1·2).
// 둘 다 모델을 부르지 않고, 이 채팅에 이미 남은 기록(일지·가계부·인물 기록의 변경 기록)만 센다.
// 연대기는 유저만의 것 (사용자: 「오로지 유저만의 연대기」): 내가 나간 사건의 종료, 나를 향한 인물 호감 「단계」 변화,
// 나에 대한 세력 평판 「구간」 변화, 내 신분 변경만. 수치 오르내림·거래 한 건·메모는 올리지 않는다 (사용자: 「너무 자잘한것까지 다 누적되면 곤란」).
// 필드 기능은 v0.20.4(11-04)에 뺐으므로 옛 채팅에 남은 필드 줄(fd)은 세지 않는다.
import type { Chat, LoreEntry } from '../types';
import { FACTION_MAX, FACTION_MIN, AFF_MAX, AFF_MIN, factionStage, stageOf, type Change } from '../people/types';
import { sumCues } from '../people/affinity';
import { factionBase, temperOf } from '../people/base';
import { factionName, userFactionOf } from '../people/faction';
import { peopleSettings } from '../people/settings';
import { liveChanges, liveness, peopleStore } from '../people/store';
import { lastStatusFields } from '../world/tags';
import { locName } from '../world/geo';
import { readDirectory } from '../world/directory';
import { playerAgent } from '../player';
import { readJournal } from './store';
import { JOURNAL_KIND_LABEL, type JournalKind } from './types';

export type ChronKind = 'event' | 'person' | 'faction' | 'rank';
export const CHRON_KIND_LABEL: Record<ChronKind, string> = { event: '사건', person: '인물', faction: '세력', rank: '신분' };

export interface ChronEntry {
  /** 메시지 순서 (정렬 열쇠) */
  pos: number;
  /** 같은 메시지 안 순서 */
  seq: number;
  kind: ChronKind;
  /** 날짜 묶음 글 (그 메시지까지의 마지막 상태창 날짜, 없으면 일지 시각의 날짜) */
  day: string;
  /** 머리 (굵게) */
  title: string;
  /** 설명 한 줄 */
  text: string;
  /** 사건 줄: 일지 종류·등급 (표식) */
  jk?: JournalKind;
  grade?: string;
  /** 보고서 id (누르면 보고서) */
  rpt?: string;
  /** 인물 이름 (누르면 인물 기록) */
  person?: string;
  /** 세력 코드 (누르면 세력 기록) */
  faction?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 메시지 번호 → 그 메시지까지 가장 최근 응답의 상태창 날짜 */
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
  return (pos) => (pos < 0 || !days.length ? '' : days[Math.min(pos, days.length - 1)] ?? '');
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

/** 세력 코드 → 이름 (명부 이름표 우선) */
function factionNames(lore: LoreEntry[] | undefined): Record<string, string> {
  return Object.fromEntries(readDirectory(lore).orgs.filter((o) => o.faction).map((o) => [o.faction, o.name]));
}

/** 유저의 연대기 (오래된 것부터) */
export function buildChronicle(chat: Chat, lore: LoreEntry[] | undefined): ChronEntry[] {
  const out: ChronEntry[] = [];
  const day = dayLabels(chat);
  // 1) 내가 나간 사건: 종료 한 줄 (일지와 같은 말: 직접 종료·시간 경과·클리어)
  for (const r of readJournal(chat).rows) {
    if (!r.mine || r.kind === 'fd') continue;
    const dur = r.at !== null && r.since !== null ? Math.max(0, r.at - r.since) : null;
    const durText = dur === null ? '' : `소요 ${Math.floor(dur / 60) ? `${Math.floor(dur / 60)}시간 ` : ''}${dur % 60}분`;
    const how = r.cleared ? '클리어' : r.cause === 'manual' ? '직접 종료' : r.cause === 'ttl' ? '시간 경과로 종료' : '종료';
    const kind = `${JOURNAL_KIND_LABEL[r.kind]}${r.grade ? ` ${r.grade}` : ''}`;
    out.push({
      pos: r.idx, seq: 0, kind: 'event', day: day(r.idx) || dayOfMinute(r.at), title: r.name, jk: r.kind, grade: r.grade, rpt: r.rpt,
      text: [kind, locName(r.loc) || r.loc, hhmm(r.at), durText, how].filter(Boolean).join(' · '),
    });
  }
  // 2) 인물 호감 단계·세력 평판 구간: 기준 메시지 하나를 다 더한 뒤 단계가 달라진 곳만 (한 메시지 안 오르내림은 올리지 않는다)
  const store = peopleStore(chat);
  const live = liveness(chat);
  const changes = liveChanges(store, live);
  const s = peopleSettings(chat.scriptstate);
  const uf = userFactionOf(store, chat);
  const names = factionNames(lore);
  const posOf = (c: Change) => live.at.get(c.anchor) ?? -1;
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
    const label = (v: number) => (isFac ? factionStage(v, s.factionBounds).label : stageOf(v).label);
    let prev = label(sumCues(who, base, [], folded, min, max, o));
    for (let i = 0; i < list.length; i++) {
      // 같은 기준 메시지의 마지막 계기까지 묶는다
      if (i + 1 < list.length && list[i + 1].anchor === list[i].anchor) continue;
      const now = label(sumCues(who, base, list.slice(0, i + 1), folded, min, max, o));
      if (now === prev) continue;
      const c = list[i];
      const reason = [...list.slice(0, i + 1)].reverse().find((x) => x.anchor === c.anchor && x.reason)?.reason ?? '';
      out.push({
        pos: posOf(c), seq: 1 + c.seq, kind: isFac ? 'faction' : 'person', day: day(posOf(c)),
        title: isFac ? factionName(code, names, store) : who,
        text: `${isFac ? '평판' : '호감'} ${prev} → ${now}${reason ? ` · ${reason}` : ''}`,
        ...(isFac ? { faction: code } : { person: who }),
      });
      prev = now;
    }
  }
  // 3) 내 신분 (소속·직급) 변경
  for (const c of changes) {
    if (c.kind !== 'identity') continue;
    const what = [c.faction ? factionName(c.faction, names, store) : '', c.rank ?? ''].filter(Boolean).join(' · ');
    if (!what) continue;
    out.push({ pos: posOf(c), seq: 1 + c.seq, kind: 'rank', day: day(posOf(c)), title: '신분', text: `${what}${c.reason ? ` · ${c.reason}` : ''}` });
  }
  return out.sort((a, b) => a.pos - b.pos || a.seq - b.seq);
}

export interface Personnel {
  /** 이 채팅 첫 응답의 상태창 날짜 (배치일) */
  since: string;
  /** 「내 사건」(일지 mine) 가운데 끝난 것. 진행 중인 출동은 세지 않는다 */
  closed: number;
  /** 그 가운데 괴이 클리어 */
  cleared: number;
  /** 같이 간 요원 전부 [이름, 횟수] 많은 순 (나 자신은 빼고, 팝업이라 다 보인다 — 사용자 11-06) */
  companions: [string, number][];
}

/** 인사 기록 숫자 (팝업): 배치일, 끝낸 내 사건 수·클리어, 같이 간(투입 칸에 같이 적힌) 요원 전부. 지출은 넣지 않는다 (사용자 11-06) */
export function buildPersonnel(chat: Chat, lore: LoreEntry[] | undefined): Personnel {
  const rows = readJournal(chat).rows.filter((r) => r.mine && r.kind !== 'fd');
  const me = playerAgent(lore, chat.scriptstate);
  const comp = new Map<string, number>();
  for (const r of rows) {
    for (const name of new Set(r.agents.map((a) => a.name).filter((n) => n && n !== me?.name))) comp.set(name, (comp.get(name) ?? 0) + 1);
  }
  const first = (Array.isArray(chat.message) ? chat.message : []).find((m) => m.role === 'char' && lastStatusFields([str(m.data)])?.date);
  return {
    since: first ? lastStatusFields([str(first.data)])?.date ?? '' : '',
    closed: rows.length,
    cleared: rows.filter((r) => r.cleared).length,
    companions: [...comp.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}
