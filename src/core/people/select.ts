// 장면 인물 고르기 (리수폿 Router 를 코드로): 최근 글에 이름·별명이 나온 인물 + 상태창 동행 칸. 모델은 부르지 않는다.
// 이름 찾기는 로어북 고르기와 같은 한국어 경계 규칙(core/lore.ts keyRegex). 겹치는 호칭(「부장」)은 후보가 하나일 때만.
import type { Chat } from '../types';
import { messageText } from '../refs';
import { keyRegex } from '../lore';
import { findStatusTags } from '../world/status';
import type { PeopleStore } from './types';

export interface NameEntry {
  name: string;
  aliases: string[];
  /** 여러 사람에게 겹칠 수 있는 호칭 */
  titles: string[];
}

const isEnglish = (s: string) => /^[A-Za-z][A-Za-z0-9 .'-]*$/.test(s);

/** 글에서 이름을 찾는 함수. titles 는 그 호칭을 가진 사람이 하나뿐일 때만 그 사람으로 본다 */
export function nameMatcher(entries: NameEntry[]): (text: string) => string[] {
  const pats: { name: string; re: RegExp }[] = [];
  const titleOwners = new Map<string, Set<string>>();
  for (const e of entries) for (const t of e.titles) (titleOwners.get(t) ?? titleOwners.set(t, new Set()).get(t)!).add(e.name);
  for (const e of entries) {
    const keys = [e.name, ...e.aliases, ...e.titles.filter((t) => titleOwners.get(t)?.size === 1)];
    for (const k of keys) {
      const re = keyRegex(k, isEnglish(k), true);
      if (re) pats.push({ name: e.name, re });
    }
  }
  return (text: string) => {
    const found = new Set<string>();
    for (const p of pats) {
      p.re.lastIndex = 0;
      if (p.re.test(text)) found.add(p.name);
    }
    return [...found];
  };
}

export interface SceneOpts {
  /** 최근 몇 마디를 볼지 (기본 2: 마지막 유저 입력과 마지막 응답) */
  recent?: number;
  max?: number;
  /** 지금 쓰려는 유저 입력 (아직 채팅에 없을 때) */
  input?: string;
}

/** 장면 인물: 기록이 있는 사람 중 최근 글에 나온 사람 + 동행 칸. 나온 순서 (최근 글 먼저) */
export function scenePeople(chat: Chat, store: PeopleStore, match: (text: string) => string[], o: SceneOpts = {}): string[] {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const recent = list.slice(-(o.recent ?? 2)).reverse().map((m) => messageText(String(m.data ?? '')));
  if (o.input) recent.unshift(o.input);
  const out: string[] = [];
  const push = (n: string) => {
    if (store.people[n] && !out.includes(n)) out.push(n);
  };
  for (const t of recent) for (const n of match(t)) push(n);
  // 상태창 동행 칸 (마지막 응답)
  const lastBot = [...list].reverse().find((m) => m.role === 'char');
  if (lastBot) {
    const tags = findStatusTags(String(lastBot.data ?? ''));
    for (const c of tags.at(-1)?.companions ?? []) for (const n of match(c)) push(n);
  }
  return out.slice(0, o.max ?? 6);
}

/** 기록에 있는 사람들로 이름 표를 만든다 (relations-base aliases 와 합쳐 쓴다) */
export function entriesOf(store: PeopleStore, extra: Record<string, { aliases?: string[]; titles?: string[] }> = {}): NameEntry[] {
  return Object.values(store.people).map((p) => ({
    name: p.name,
    aliases: [...new Set([...p.aliases, ...(extra[p.name]?.aliases ?? [])])],
    titles: extra[p.name]?.titles ?? [],
  }));
}
