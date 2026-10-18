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
  chat.message ??= [];
  return { charIndex, chatIndex, char, chat };
}

/** 저장 직전에 최신 채팅을 다시 읽고 변경을 적용한다. 다른 곳의 변경을 덮어쓰지 않기 위해서다. */
export async function updateChat(charIndex: number, chatIndex: number, mutate: (chat: Chat) => Chat | null): Promise<Chat | null> {
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

/** 캐릭터 로어북을 바꾼다. 저장 직전에 최신 캐릭터를 다시 읽어 다른 곳의 변경을 덮어쓰지 않는다. */
export async function updateCharacterLore(charIndex: number, mutate: (lore: LoreEntry[]) => LoreEntry[] | null): Promise<boolean> {
  const latest = (await risuai.getCharacterFromIndex(charIndex)) as CharacterSnapshot | null;
  if (!latest) throw new Error('캐릭터를 찾을 수 없어요.');
  const next = mutate(latest.globalLore ?? []);
  if (!next) return false;
  await risuai.setCharacterToIndex(charIndex, { ...latest, globalLore: next });
  return true;
}
