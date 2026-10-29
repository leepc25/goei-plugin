// 시작 화면에서 미리 쓴 첫 장면(시작 메시지)으로 시작한 뒤, 첫 전송 전까지 그 장면 아래에 「적고 전송」 안내와 재선택 버튼.
// 직접 입력·커스텀 임무와 달리 놓을 유저 메시지가 없으니 자동 전송도, 유저 메시지도 만들지 않는다.
// display는 어느 글인지 알려 주지 않아서, 고른 첫 장면 원문에서 한 줄을 떼어 두고 그 줄이 든 글에만 붙인다.
// 첫 메시지를 보내면 Risu가 첫 장면을 다시 그리지 않을 수 있어서, 숨김은 본 화면 CSS(overlay.ts OPENING_CSS)가 맡는다.
import { getChar } from './risu';
import { factionList } from '../core/factions';
import { findScenario } from '../core/scenarios';
import { chatPhase, currentChoice } from '../core/start';
import type { Chat, LoreEntry } from '../core/types';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';

/** 안내를 붙일 첫 장면을 알아보는 한 줄. 없으면 안내 없음 */
let marker = '';
let opener: (() => void) | null = null;

/** 첫 장면 원문에서 CBS·태그가 없는 가장 긴 줄의 앞부분 (display 글은 CBS가 풀린 뒤라 그런 줄만 그대로 남는다) */
export function greetingMarker(greeting: string): string {
  const lines = greeting.split('\n').map((l) => l.trim()).filter((l) => l && !/[{}<>[\]]/.test(l));
  const best = lines.sort((a, b) => b.length - a.length)[0] ?? '';
  return best.length >= 8 ? best.slice(0, 40) : '';
}

/** 이 채팅이 시작 메시지로 시작해서 아직 첫 전송 전인지 */
export function openingStaged(chat: Chat, lore: LoreEntry[] | undefined): boolean {
  if (chatPhase(chat) !== 'staged' || (chat.message ?? []).length) return false;
  const cur = currentChoice(chat);
  return !!cur.faction && !!cur.fm && findScenario(cur.faction, cur.fm, factionList(lore))?.kind === 'opening';
}

/** 안내를 켠다(첫 장면 원문) / 끈다(null) */
export function setOpeningHint(greeting: string | null): void {
  marker = greeting ? greetingMarker(greeting) : '';
}

export function setRepickOpener(f: () => void): void {
  opener = f;
}

/** display: 이 글이 안내를 붙일 첫 장면인지 */
export function wantsOpeningHint(text: string): boolean {
  return !!marker && text.includes(marker);
}

/** 채팅을 바꿨을 때: 그 채팅 상태로 안내를 다시 정한다 */
export async function refreshOpeningHint(charIndex: number, chatIndex: number): Promise<void> {
  if (charIndex < 0 || chatIndex < 0) return void (marker = '');
  const chat = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  const char = await getChar<{ globalLore?: LoreEntry[]; alternateGreetings?: string[] }>(charIndex);
  const fm = Number(chat?.fmIndex);
  setOpeningHint(chat && openingStaged(chat, char?.globalLore) && Number.isInteger(fm) && fm >= 0 ? (char?.alternateGreetings?.[fm] ?? null) : null);
}

let busy = false;

onChatClick('opening', async (doc, x, y) => {
  const list = await elements(doc, '[data-goei-repick]');
  if (!list.length) return 'idle';
  let on = false;
  for (const el of list) if (await hit(el, x, y)) on = true;
  if (!on || busy) return false;
  busy = true;
  try {
    opener?.();
  } finally {
    busy = false;
  }
  return true;
});

/** 안내를 채팅에 그릴 때 (body.ts display) */
export function openingShown(): void {
  armChatClick('opening');
}
