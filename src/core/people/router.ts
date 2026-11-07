// 모델 Router (리수폿 A, 2026-11-06 사용자 결정 「옵션」): 보조 모델이 이름 목록(이름·별명·호칭·소속)만 보고 이번 응답에 필요한 인물을 고르고,
// 글에 나오지만 기록에 없는 이름을 new_characters 로 알린다. 코드 Router(select.ts)는 이름이 직접 나온 사람만 고르지만,
// 모델은 「그 사람」「부장님 말대로」처럼 이름 없이 가리킨 제3자도 고른다. 실패·지연이면 코드 Router 로 돌아간다.
import type { Chat } from '../types';
import { messageText } from '../refs';
import { hash, liveEntries, liveness, plain } from './store';
import type { NameEntry } from './select';
import type { PeopleStore } from './types';
import { ROUTER_SYSTEM } from './basetext';

export interface RouterInput { system: string; data: Record<string, unknown>; key: string; max: number }
export interface RouterHint { name: string; aliases: string[]; quote: string }
export interface RouterResult { selected: string[]; newCharacters: RouterHint[] }
export const ROUTER_MAX = 6;

export { ROUTER_SYSTEM };

/** 요청 자료: 이름 목록 + 최근 글 + 입력 */
/** 명단 전체 예산 (원본 identity_context 12,000자) */
export const ROUTER_CATALOG_CHARS = 12000;
export const ROUTER_IDENTITY_CHARS = 280;
export function buildRouter(chat: Chat, store: PeopleStore, names: NameEntry[], input: string, o: { recent?: number; max?: number; exclude?: string[]; prompt?: string; rules?: string; identityOf?: (name: string) => string | null | undefined } = {}): RouterInput {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const n = o.recent ?? 4;
  const recent = (n > 0 ? list.slice(-n) : []).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: messageText(String(m.data ?? '')).slice(0, 2500) }));
  const ex = new Set(o.exclude ?? []);
  // 2026-11-07 전수검사 2 의 G (원본 identity_context): 정체 발췌(시트·기본정보 첫 280자)와 관계 상대를 함께 줘 「그 사람」「부장님」 식 지칭을 가릴 근거를 준다. 전체 12,000자 예산
  const live = liveness(chat);
  let budget = ROUTER_CATALOG_CHARS;
  const catalog = Object.values(store.people).filter((p) => !ex.has(p.name)).map((p) => {
    const e = names.find((n) => n.name === p.name);
    const ident = plain(o.identityOf?.(p.name) || liveEntries(p.slots.identity, live).map((x) => x.text).join(' '), ROUTER_IDENTITY_CHARS);
    const relations = [...new Set(liveEntries(p.slots.relationship, live).map((x) => x.target).filter((t): t is string => !!t && t !== '@user'))].slice(0, 6);
    const row = { name: p.name, aliases: [...new Set([...p.aliases, ...(e?.aliases ?? [])])].slice(0, 8), titles: (e?.titles ?? []).slice(0, 4), faction: p.faction, ...(ident ? { identity: ident } : {}), ...(relations.length ? { relations } : {}) };
    const size = JSON.stringify(row).length;
    if (size > budget && row.identity) { delete (row as { identity?: string }).identity; }
    budget -= JSON.stringify(row).length;
    return row;
  });
  const max = o.max ?? ROUTER_MAX;
  // 기본 지침은 지침 탭 「Router」(o.prompt, 비면 내장 글)와 덧붙일 지침(router_rules). 2026-11-07 전수검사 4 의 P (원본 customPrompts.router)
  const base = o.prompt?.trim() ? o.prompt.trim() : ROUTER_SYSTEM.join('\n');
  const system = [base.replace('{{MAX}}', String(max)), o.rules?.trim() ? `## User rules\n${o.rules.trim()}` : ''].filter(Boolean).join('\n');
  const data = { input: input.slice(0, 4000), recent, catalog };
  const key = hash(JSON.stringify({ input, recent: recent.map((r) => r.text.slice(0, 400)), names: catalog.map((c) => c.name), system: system.length }));
  return { system, data, key, max };
}

/** 응답 읽기: 기록에 있는 정식 이름만 (별명으로 답하면 정식 이름으로), 상한, 미등록 이름은 힌트 */
export function parseRouter(raw: string, store: PeopleStore, names: NameEntry[], max = ROUTER_MAX): RouterResult {
  let t = raw.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('JSON 객체가 없어요');
  const v = JSON.parse(t.slice(a, b + 1)) as { selected?: unknown; new_characters?: unknown };
  if (!Array.isArray(v.selected)) throw new Error('selected 목록이 없어요');
  const canon = (s: string): string | null => {
    const q = s.trim().normalize('NFC');
    if (!q) return null;
    if (store.people[q]) return q;
    const hit = names.find((n) => n.name === q || n.aliases.includes(q)) ?? Object.values(store.people).find((p) => p.aliases.includes(q));
    return hit && store.people[hit.name] ? hit.name : null;
  };
  const selected: string[] = [];
  for (const x of v.selected as unknown[]) {
    const name = canon(typeof x === 'string' ? x : String((x as Record<string, unknown>)?.name ?? ''));
    if (name && !selected.includes(name)) selected.push(name);
    if (selected.length >= max) break;
  }
  const known = new Set([...Object.keys(store.people), ...names.flatMap((n) => [n.name, ...n.aliases])]);
  const newCharacters: RouterHint[] = [];
  for (const x of (Array.isArray(v.new_characters) ? v.new_characters : []) as Record<string, unknown>[]) {
    const name = plain(x?.name, 30);
    if (!name || known.has(name) || newCharacters.some((h) => h.name === name)) continue;
    newCharacters.push({ name, aliases: (Array.isArray(x.aliases) ? x.aliases : []).map((s) => plain(s, 30)).filter(Boolean).slice(0, 4), quote: plain(x.quote, 80) });
    if (newCharacters.length >= 12) break;
  }
  return { selected, newCharacters };
}
