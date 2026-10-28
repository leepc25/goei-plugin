import { stripVirtual, withWorldLore } from '../core/world/virtual';
import { setStatusColumns } from '../core/world/statuscols';
import type { Chat, LoreEntry } from '../core/types';
import { applyAdvanced } from '../core/advanced';

export interface CharacterSnapshot {
  name?: string;
  type?: string;
  chaId?: string;
  alternateGreetings?: string[];
  globalLore?: LoreEntry[];
  [key: string]: unknown;
}

export interface ChatContext {
  charIndex: number;
  chatIndex: number;
  char: CharacterSnapshot;
  chat: Chat;
}

export async function loadContext(): Promise<ChatContext | null> {
  const charIndex = await risuai.getCurrentCharacterIndex();
  const chatIndex = await risuai.getCurrentChatIndex();
  if (!Number.isInteger(charIndex) || charIndex < 0 || !Number.isInteger(chatIndex) || chatIndex < 0) return null;
  const char = (await risuai.getCharacterFromIndex(charIndex)) as CharacterSnapshot | null;
  const chat = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  if (!char || !chat) return null;
  // 세계 데이터(기본 + 카드 덧쓰기)를 가상 로어북으로 붙인다. 저장할 때는 updateCharacterLore 가 뺀다
  char.globalLore = withWorldLore(char.globalLore);
  chat.message ??= [];
  // 상태창 파서에 이 채팅의 칸 구성을 알린다 (core/world/statuscols.ts)
  setStatusColumns(chat.scriptstate);
  return { charIndex, chatIndex, char, chat };
}

// 같은 채팅 저장은 차례로 (읽고 쓰는 사이에 다른 저장이 끼면 그 변경이 사라진다. 괴담넷·괴담톡 자동 확인이 동시에 저장할 수 있다)
const queues = new Map<string, Promise<unknown>>();

/** 저장 직전에 최신 채팅을 다시 읽고 변경을 적용한다. 다른 곳의 변경을 덮어쓰지 않기 위해서다. */
export function updateChat(charIndex: number, chatIndex: number, mutate: (chat: Chat) => Chat | null): Promise<Chat | null> {
  const key = `${charIndex}:${chatIndex}`;
  const run = (queues.get(key) ?? Promise.resolve()).then(() => saveChat(charIndex, chatIndex, mutate));
  const tail = run.catch(() => {});
  queues.set(key, tail);
  void tail.then(() => {
    if (queues.get(key) === tail) queues.delete(key);
  });
  return run;
}

async function saveChat(charIndex: number, chatIndex: number, mutate: (chat: Chat) => Chat | null): Promise<Chat | null> {
  const latest = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  if (!latest) throw new Error('채팅을 찾을 수 없어요. 채팅을 다시 열어 주세요.');
  latest.message ??= [];
  // 저장 직전에 이 채팅의 고급 설정으로 맞춘다 (길이 제한·보관 수를 다른 채팅 값으로 쓰지 않게)
  applyAdvanced(latest.scriptstate);
  const next = mutate(latest);
  if (!next) return null;
  await risuai.setChatToIndex(charIndex, chatIndex, next);
  return next;
}

// 플러그인이 로어북을 바꿨을 때 알림 (본체의 지침·등록부 캐시를 비운다. QC 2026-10-28: 세계·지침 편집 뒤에도 캐릭터를 바꿀 때까지 옛 규칙이 요청에 들어갔다)
const loreListeners = new Set<(charIndex: number) => void>();
export function onLoreSaved(f: (charIndex: number) => void): () => void {
  loreListeners.add(f);
  return () => loreListeners.delete(f);
}
export function notifyLoreSaved(charIndex: number): void {
  for (const f of loreListeners) f(charIndex);
}

/** 캐릭터 로어북을 바꾼다. 저장 직전에 최신 캐릭터를 다시 읽어 다른 곳의 변경을 덮어쓰지 않는다. */
export async function updateCharacterLore(charIndex: number, mutate: (lore: LoreEntry[]) => LoreEntry[] | null): Promise<boolean> {
  const latest = (await risuai.getCharacterFromIndex(charIndex)) as CharacterSnapshot | null;
  if (!latest) throw new Error('캐릭터를 찾을 수 없어요.');
  const next = mutate(stripVirtual(latest.globalLore ?? []));
  if (!next) return false;
  await risuai.setCharacterToIndex(charIndex, { ...latest, globalLore: stripVirtual(next) });
  notifyLoreSaved(charIndex);
  return true;
}

/** 캐릭터 읽기 (로어북에 세계 데이터 가상 항목을 붙여서). 읽기 전용 — 저장은 updateCharacterLore 로 */
export async function getChar<T extends { globalLore?: LoreEntry[] } = CharacterSnapshot>(charIndex: number): Promise<T | null> {
  const char = (await risuai.getCharacterFromIndex(charIndex)) as T | null;
  if (char) char.globalLore = withWorldLore(char.globalLore);
  return char;
}
