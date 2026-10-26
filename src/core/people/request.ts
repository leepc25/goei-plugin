// 본편 요청에 인물 기록 블록을 끼운다 (beforeRequest). 모델은 부르지 않는다.
// 절 단위 혼합(split)이면 요원 자리에 들어간 그 인물의 시트 원문을 요청에서 빼고 기록 블록으로 대신한다.
import type { Chat } from '../types';
import { peopleBlock, personBlock, unknownTo } from './inject';
import { nameMatcher, scenePeople, entriesOf, type NameEntry } from './select';
import { liveChanges, liveness, type Liveness } from './store';
import { latestNote } from './updater';
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
        maxChars: 1600,
      }),
    );
  }
  return { text: peopleBlock(blocks), people, sheets };
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 요청에서 시트 원문을 뺀다 (split·record 모드). 로어북 고르기가 넣은 자리 글에 그대로 들어 있을 때만 */
export function stripSheets<M extends PromptMessage>(messages: M[], sheets: string[]): M[] {
  if (!sheets.length) return messages;
  const targets = sheets.map(squash).filter(Boolean);
  return messages.map((m) => {
    if (typeof m?.content !== 'string') return m;
    let text = m.content;
    let changed = false;
    for (const t of targets) {
      const i = text.indexOf(t);
      if (i >= 0) {
        text = text.slice(0, i) + text.slice(i + t.length);
        changed = true;
        continue;
      }
      // 공백 차이: 줄별로 압축해 비교
      const flat = squash(text);
      const j = flat.indexOf(t);
      if (j >= 0 && flat === squash(text)) {
        // 줄바꿈이 섞인 원문에서 같은 자리를 찾기 어렵다 → 줄 단위로 겹치는 줄을 지운다
        const lines = t.split(' ');
        const first = lines[0];
        const start = text.indexOf(first);
        if (start >= 0) {
          const end = text.indexOf(lines[lines.length - 1], start);
          if (end > start) {
            text = text.slice(0, start) + text.slice(end + lines[lines.length - 1].length);
            changed = true;
          }
        }
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
