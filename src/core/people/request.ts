// 본편 요청에 인물 기록 블록을 끼운다 (beforeRequest). 모델은 부르지 않는다.
// 절 단위 혼합(split)이면 요원 자리에 들어간 그 인물의 시트 원문을 요청에서 빼고 기록 블록으로 대신한다.
import type { Chat } from '../types';
import { peopleBlock, personBlock, rhythmBlock, unknownTo } from './inject';
import { nameMatcher, scenePeople, entriesOf, type NameEntry } from './select';
import { liveChanges, liveEntries, liveness, type Liveness } from './store';
import { latestNote } from './updater';
import { factionNow, factionsBlock, sceneFactionCodes, userFactionOf } from './faction';
import { messageText } from '../refs';
import type { PeopleSettings } from './settings';
import type { PeopleStore, Temper } from './types';

export interface PromptMessage {
  role?: string;
  content?: unknown;
}

export interface RequestOpts {
  settings: PeopleSettings;
  store: PeopleStore;
  /** 인물 시트 (로어북) */
  sheetOf: (name: string) => string | null;
  temperOf?: (name: string) => Temper | undefined;
  extraNames?: Record<string, { aliases?: string[]; titles?: string[] }>;
  /** 지금 쓰려는 유저 입력 */
  input?: string;
  user?: string;
  /** 세력 코드 → 이름 (명부) */
  factionNames?: Record<string, string>;
}

/** 장면 인물의 기록 블록 (본편용). 대상이 없으면 빈 문자열 */
export function peopleBlockFor(chat: Chat, o: RequestOpts): { text: string; people: string[]; sheets: string[] } {
  if (!o.settings.on || o.settings.inject === 'off') return { text: '', people: [], sheets: [] };
  const names: NameEntry[] = entriesOf(o.store, o.extraNames ?? {});
  const match = nameMatcher(names);
  const people = scenePeople(chat, o.store, match, { input: o.input });
  if (!people.length) return { text: '', people: [], sheets: [] };
  const live: Liveness = liveness(chat);
  const changes = liveChanges(o.store, live);
  const blocks: string[] = [];
  const sheets: string[] = [];
  for (const n of people) {
    const p = o.store.people[n];
    const sheet = o.sheetOf(n);
    if (sheet) sheets.push(sheet);
    const note = o.settings.director === 'facts' ? latestNote(o.store, n, live) : null;
    blocks.push(
      personBlock(p, o.store, live, changes, {
        sheet,
        mode: o.settings.inject,
        unknown: o.settings.features.has('perception') ? unknownTo(p, o.store, live) : [],
        user: o.user,
        note,
        temper: o.temperOf?.(n),
        speed: o.settings.speed,
        turnCap: o.settings.turnCap,
        // 본편 전체 예산을 장면 인물 수로 나눈다 (고정 절 원문은 예산 밖)
        maxChars: Math.floor(o.settings.blockCap / people.length),
        taste: o.settings.features.has('taste'),
        openness: o.settings.features.has('openness'),
      }),
    );
  }
  // 서사 리듬 (선택): 장면 전체 기록과 메모를 맨 앞에
  if (o.settings.features.has('rhythm')) {
    const docs = Object.values(o.store.docs).filter((d) => d.type === 'rhythm').flatMap((d) => liveEntries(d.entries, live).slice(-1).map((e) => ({ key: d.key, text: e.text })));
    const note = o.settings.director === 'facts' ? latestNote(o.store, '@rhythm', live)?.now : null;
    const rb = rhythmBlock(docs, note);
    if (rb) blocks.unshift(rb);
  }
  // 세력 평판 (기본 켬): 장면 세력(인물 소속 ∪ 최근 글에 나온 세력) 가운데 중립이 아닌 것만 한 줄씩, 맨 뒤에
  if (o.settings.features.has('faction_rep') && o.settings.factionInject) {
    const list = Array.isArray(chat.message) ? chat.message : [];
    const texts = [...(o.input ? [o.input] : []), ...list.slice(-2).map((m) => messageText(String(m.data ?? '')))];
    const codes = sceneFactionCodes(o.store, people, texts, o.factionNames);
    const uf = userFactionOf(o.store, chat);
    const fb = factionsBlock(codes.map((c) => factionNow(o.store, c, changes, uf, o.settings, o.factionNames)), o.user);
    if (fb) blocks.push(fb);
  }
  return { text: peopleBlock(blocks, o.settings.blockCap), people, sheets };
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 요청에서 시트 원문을 뺀다 (split·record 모드). 로어북 고르기가 넣은 글에 그대로 들어 있을 때만.
 *  공백·줄바꿈 차이는 무시한다 (낱말 사이를 `\s+` 로 맞춘 정규식. 예전 「첫 낱말 ~ 끝 낱말」 자르기는 첫 `###` 부터 엉뚱한 범위를 지웠다. QC 2026-10-28) */
export function stripSheets<M extends PromptMessage>(messages: M[], sheets: string[]): M[] {
  if (!sheets.length) return messages;
  const escRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targets = sheets.map(squash).filter(Boolean).map((t) => ({ t, re: new RegExp(t.split(' ').map(escRe).join('\\s+')) }));
  return messages.map((m) => {
    if (typeof m?.content !== 'string') return m;
    let text = m.content;
    let changed = false;
    for (const { t, re } of targets) {
      const i = text.indexOf(t);
      const next = i >= 0 ? text.slice(0, i) + text.slice(i + t.length) : text.replace(re, '');
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
    return changed ? { ...m, content: text.replace(/\n{3,}/g, '\n\n') } : m;
  });
}

/** 마지막 사용자 메시지 바로 앞에 시스템 메시지로 (상태창 블록과 같은 자리) */
export function insertBlock<M extends PromptMessage>(messages: M[], text: string): M[] {
  if (!text) return messages;
  const at = messages.map((m) => m?.role).lastIndexOf('user');
  const add = { role: 'system', content: text } as M;
  return at < 0 ? [...messages, add] : [...messages.slice(0, at), add, ...messages.slice(at)];
}

/** 요청 가공 한 번에: 블록 만들기 → (split·record) 시트 빼기 → 끼우기 */
export function withPeopleBlock<M extends PromptMessage>(messages: M[], chat: Chat, o: RequestOpts): M[] {
  const r = peopleBlockFor(chat, o);
  if (!r.text) return messages;
  const out = o.settings.inject === 'split' || o.settings.inject === 'record' ? stripSheets(messages, r.sheets) : messages;
  return insertBlock(out, r.text);
}
