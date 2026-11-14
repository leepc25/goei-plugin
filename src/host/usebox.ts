// 보낸 뒤 (2026-11-12 사용자: 「채팅 보냈는데 왜 안 없어져」): 요청에 실려 나간 순간 숨긴다 (markUseSent). 전에는 응답이 다 붙은 뒤에야(settleItemUse) 사라져서,
//  응답을 쓰는 동안·요청이 실패한 동안 방금 보낸 유저 메시지 아래에 그대로 남았다. 응답 알림 없이 기다림이 끝나면(실패) 아직 안 쓰인 것이니 다시 보인다.
//  전수검사 11-13 (사용자 결정): 숨기면 실패 때 최대 3분 사라져 보이므로, 숨기지 않고 이름표를 「보내는 중」으로 바꿔 둔다.
// 「사용」 상자 (2026-11-07 소지품): 소지품 메뉴에서 「사용」을 누른 물건을 채팅의 마지막 메시지 아래에 칩으로 보여 준다.
// 다음 전송 때 [Inventory] 글의 This turn 에 같이 넘어가고(core/items.ts withInventory), 응답이 붙으면 settleItemUse 가 상자를 정리한다.
// 자리 (2026-11-11 사용자): 브라우저 창에 고정하면 Risu 왼쪽 목록 위에 떴다 → 시작 안내(openinghint.ts)처럼 채팅 메시지 안에 붙인다.
//  · display 가 이 봇 메시지마다 빈 자리(USE_SLOT)를 붙여 두고(body.ts), 본 화면 style 이 마지막 메시지의 자리에만 이름을 채워 보인다.
//    Risu 는 글이 그대로면 메시지를 다시 그리지 않으니(Chats.svelte 글 해시), 이름은 글이 아니라 CSS(::before content)로 넣는다.
//  · 마지막 메시지 = .chat-message-container:first-child (Risu 는 새 메시지를 맨 앞에 넣고 flex-col-reverse 로 뒤집어 보인다).
import { aliveAnchors } from '../core/wallet';
import { dropUse, invOn, ITEM_USE_AT_VAR, itemUseVars, lastUserKey, liveItems, readItemUse, readItems, useRerolling, usesToSend } from '../core/items';
import type { Chat } from '../core/types';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';
import { body } from './overlay';
import { updateChat } from './risu';
import { isWaiting, onWaiting, setWaiting, setWaitingProbe } from './waiting';

/** 한 번에 보이는 칩 수. 넘으면 마지막 칸이 「외 n개」 */
const SLOTS = 12;
const LAST = '.chat-message-container:first-child [data-goei-card="use"]';

/** display 가 메시지 끝에 붙이는 빈 자리. 본 화면 style 이 없으면 보이지 않는다 */
export const USE_SLOT = `<div data-goei-card="use" style="display:none"><span data-gu-label></span>${Array.from({ length: SLOTS }, (_, i) => `<span data-gu="${i}"><span data-gu-x="${i}" role="button" aria-label="빼기"></span></span>`).join('')}<span data-gu-more></span></div>`;

const cssStr = (s: string) => `"${s.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** 마지막 메시지의 자리에 이름을 채우는 CSS. 색은 채팅 카드 변수(ui/theme.ts cardVarsCss)를 쓴다 */
/** sending: 이번 요청에 실려 나간 칩이 있다 — 숨기지 않고 이름표만 「보내는 중」 (요청이 실패해도 칩이 사라져 보이지 않게, 전수검사 11-13) */
export function useBoxCss(names: { label: string }[], sending = false): string {
  if (!names.length) return '';
  const show = names.slice(0, names.length > SLOTS ? SLOTS - 1 : SLOTS);
  const more = names.length - show.length;
  return [
    `${LAST} { display: flex !important; flex-wrap: wrap; align-items: center; gap: 6px 8px; width: fit-content; min-width: min(100%, 420px); max-width: 100%; box-sizing: border-box; margin: 10px auto 0; padding: 10px 16px; border: 1px solid var(--goei-accentLine); border-radius: 14px; background: var(--goei-accentBg); color: var(--goei-sub); font-size: .92em; line-height: 1.5; }`,
    `${LAST} [data-gu-label]::before { content: "${sending ? '보내는 중' : '다음 메시지에 사용'}"; color: var(--goei-signal); font-weight: 600; margin-right: 4px; }`,
    `${LAST} [data-gu] { display: none; align-items: center; gap: 6px; max-width: 100%; padding: 2px 4px 2px 10px; border: 1px solid var(--goei-accentLine); border-radius: 999px; color: var(--goei-text); }`,
    `${LAST} [data-gu]::before { max-width: 14em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }`,
    `${LAST} [data-gu-x] { flex: none; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--goei-accentLine); color: var(--goei-signal); line-height: 1; cursor: pointer; }`,
    `${LAST} [data-gu-x]::before { content: "×"; }`,
    ...show.map((n, i) => `${LAST} [data-gu="${i}"] { display: inline-flex; } ${LAST} [data-gu="${i}"]::before { content: ${cssStr(n.label)}; }`),
    more > 0 ? `${LAST} [data-gu-more]::before { content: "외 ${more}개"; }` : '',
    // 보내는 중에는 × 를 숨긴다: 이미 요청에 실려 나간 사용이라 뺄 수 없다 (재검토 11-14 B-9 사용자 결정)
    sending ? `${LAST} [data-gu-x] { display: none; } ${LAST} [data-gu] { padding-right: 10px; }` : '',
  ].join('\n');
}

type Root = NonNullable<Awaited<ReturnType<typeof body>>>;
type El = Awaited<ReturnType<Root['doc']['createElement']>>;

let host: El | null = null;
let styleEl: El | null = null;
let where = { charIndex: -1, chatIndex: -1 };
let shown: { id: string; label: string }[] = [];
let busy = false;
/** 이번 요청에 실려 나간 것: 어느 채팅의 어느 유저 메시지 턴에 어떤 물건이 나갔나. 그 턴이 끝날 때까지 이름표는 「보내는 중」 */
let sent: { charIndex: number; chatIndex: number; userKey: string; ids: Set<string> } | null = null;

/** 「보내는 중」인 물건 id: 같은 채팅·같은 유저 턴이고 아직 응답이 정리하지 않았을 때만 (다른 턴이면 지난 일이니 잊는다) */
export function sentUseIds(chat: Chat | null, charIndex: number, chatIndex: number): Set<string> | null {
  if (!sent || !chat || sent.charIndex !== charIndex || sent.chatIndex !== chatIndex) return null;
  if (chat.scriptstate?.[ITEM_USE_AT_VAR] || lastUserKey(chat) !== sent.userKey) { sent = null; return null; }
  return sent.ids;
}

/** 이 물건의 사용이 「보내는 중」인가 (소지품 창: 「사용 취소」를 숨기고, 버리기·삭제·해제·끌어 바꾸기에도 사용 목록에 남긴다. 재검토 11-14 B-9 사용자 답).
 *  sentUseIds 와 달리 적어 둔 것을 지우지 않는다: 소지품 창이 든 채팅이 조금 옛것이어도 보낸 표시를 잃지 않게 */
export function useSending(chat: Chat | null | undefined, charIndex: number, chatIndex: number, id: string): boolean {
  if (!sent || !chat || sent.charIndex !== charIndex || sent.chatIndex !== chatIndex) return false;
  return !chat.scriptstate?.[ITEM_USE_AT_VAR] && lastUserKey(chat) === sent.userKey && sent.ids.has(id);
}

/** 답이 붙은 뒤 사용 정리(body.ts onOutput → settleItemUse)가 끝날 때까지도 잠근다: 기다림이 꺼진 뒤 정리 전에 넣은 것이 쓴 것으로 적히지 않게 (11-14 사용자) */
let settling = 0;
/** 정리 시작. 돌려준 함수를 부르면 풀린다 (여러 번 불러도 한 번만. 못 불러도 30초 뒤 풀린다) */
export function holdUseSettle(): () => void {
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    settling = Math.max(0, settling - 1);
    // 답이 붙어 정리가 끝났다: 「보내는 중」 표시도 끝 (자리 사본을 다시 보낸 턴은 at 이 비어 있어 표시가 남았다)
    if (!settling) sent = null;
  };
  settling++;
  const timer = setTimeout(release, 30_000);
  return release;
}
/** 요청을 보낸 채팅. 모르면(null) 모든 채팅을 잠근다 */
let lockAt: { charIndex: number; chatIndex: number } | null = null;
/** 본편 요청이 어느 채팅에서 나갔는지 적는다 (body.ts onBeforeRequest: 시작할 때 null, 채팅을 읽은 뒤 그 자리). 다른 채팅의 「사용」은 막지 않는다 */
export function setUseLockAt(at: { charIndex: number; chatIndex: number } | null): void {
  lockAt = at ? { charIndex: at.charIndex, chatIndex: at.chatIndex } : null;
  if (!at) { out = null; blind = false; } // 새 요청: 지난 요청에 실린 것은 잊는다
}
/** 마지막 본편 요청을 손대지 못하고 보냈나 (이 봇 판정이 늦었거나 채팅을 못 읽음). [Inventory] 가 안 실렸으니 그 답에는 사용을 적지 않는다:
 *  그사이 넣었거나 넣어 둔 것이 모델 모르게 쓴 것으로 적히고 깎였다. 자리는 그대로 두어 다음 요청에 실린다 */
let blind = false;
/** body.ts onBeforeRequest: setUseLockAt(null) 뒤에 적는다 (다음 요청에서 꺼진다) */
export function setUseBlind(): void { blind = true; }
export function useBlind(): boolean { return blind; }
/** 마지막 본편 요청에 실제로 실려 나간 사용 (다시 굴리기 포함). sent 와 달리 기다림이 늦게 꺼져도 남는다: 답이 붙을 때 정리(settleItemUse)가 본다 */
let out: { charIndex: number; chatIndex: number; userKey: string; ids: Set<string>; reroll: boolean } | null = null;
/** 이 채팅·이 유저 턴의 요청에 실려 나간 물건 id. 모르면 null (요청을 못 봤거나 다른 턴) */
export function sentOut(charIndex: number, chatIndex: number, chat: Chat | null | undefined): Set<string> | null {
  if (!out || !chat || out.charIndex !== charIndex || out.chatIndex !== chatIndex || out.userKey !== lastUserKey(chat)) return null;
  return out.ids;
}
/** 그 요청이 자리 사본을 다시 보낸 다시 굴리기였나. 모르면 null. 정리(settleItemUse)가 요청과 같은 판정을 쓰게 넘긴다 (이어 쓰기는 같은 응답에 덧붙는다) */
export function sentReroll(charIndex: number, chatIndex: number, chat: Chat | null | undefined): boolean | null {
  return sentOut(charIndex, chatIndex, chat) ? out!.reroll : null;
}
/** 지금은 「사용」을 바꿀 수 없나(넣기·빼기): 이 채팅의 본편 답을 기다리는 중이거나 답 정리 중 (다시 굴리기 포함).
 *  그사이 넣은 것은 요청에 없었는데도 답이 붙을 때 쓴 것으로 적히고 횟수가 깎였다 (11-14 사용자: 전부 막기).
 *  빼기도 막는다: 요청을 조립하는 사이(보낸 표시 전)에 빼면 모델은 쓴 것으로 받았는데 기록이 안 남았다 (11-14 재검토).
 *  채팅 자리를 안 주면 어느 채팅이든 잠긴 것으로 본다 */
export function useLocked(charIndex?: number, chatIndex?: number): boolean {
  if (settling > 0) return true;
  if (!isWaiting()) return false;
  return !lockAt || charIndex === undefined || chatIndex === undefined || (lockAt.charIndex === charIndex && lockAt.chatIndex === chatIndex);
}

/** 리수가 지금 답을 만드는 중인가: 입력창에 멈춤 단추(.loadmove)가 있으면 busy, 보내기 단추가 돌아와 있으면 idle. 화면을 못 읽거나 단추를 못 찾으면 unknown */
async function risuBusy(): Promise<'busy' | 'idle' | 'unknown'> {
  try {
    const screen = await (await body())?.doc.querySelector('.default-chat-screen');
    if (!screen) return 'unknown';
    if (await screen.querySelector('.loadmove')) return 'busy';
    return (await screen.querySelector('.button-icon-send')) ? 'idle' : 'unknown';
  } catch {
    return 'unknown'; // 못 읽으면 모른다
  }
}

/** 리수는 중지·실패·프롬프트 미리 보기를 알려 주지 않아, 답이 안 오는데도 기다림이 3분까지 켜져 있었다 (11-14 재검토).
 *  리수 입력창에 보내기 단추가 돌아와 있으면(만드는 중에는 그 자리에 멈춤 단추 .loadmove 가 있다) 요청이 끝난 것이니 기다림을 끈다.
 *  「사용」을 막기 직전에만 본다. 화면을 못 읽거나 단추를 못 찾으면 그대로 둔다 */
export async function freeUseLock(): Promise<void> {
  if (!isWaiting()) return;
  if ((await risuBusy()) === 'idle') setWaiting(false, true);
}

// 답이 3분보다 늦어도 리수가 아직 만드는 중이면 기다림을 끄지 않는다: 꺼지면 「사용」 잠금이 풀려, 그사이 넣거나 뺀 것이 답이 붙을 때 어긋났다 (11-14 재검토)
setWaitingProbe(async () => (await risuBusy()) === 'busy');

/** 본편 요청에 「사용」이 실려 나갔다 (body.ts onBeforeRequest, [Inventory] 를 넣은 바로 뒤). 칩 이름표를 바로 「보내는 중」으로 */
export async function markUseSent(charIndex: number, chatIndex: number, chat: Chat): Promise<void> {
  const userKey = lastUserKey(chat);
  // 요청에 실제로 실린 것만 (core/items.ts usesToSend: [Inventory] 의 「uses」 줄과 같은 셈)
  const ids = usesToSend(chat).map((u) => u.id);
  out = { charIndex, chatIndex, userKey, ids: new Set(ids), reroll: useRerolling(chat) };
  if (!ids.length || chat.scriptstate?.[ITEM_USE_AT_VAR]) return;
  sent = { charIndex, chatIndex, userKey, ids: new Set(ids) };
  await refreshUseBox(charIndex, chatIndex, chat);
}

// 응답 알림 없이 기다림이 끝났다 = 요청이 실패했거나 멈췄다: 아직 안 쓰인 것이니 칩을 다시 보인다 (다음 전송에 다시 실린다)
onWaiting((w, late) => {
  if (!w) lockAt = null;
  if (w || !late || !sent) return;
  const { charIndex, chatIndex } = sent;
  sent = null;
  void refreshUseBox(charIndex, chatIndex).catch(() => {});
});

/** 상자에 보일 것: 아직 보내지 않은 것만 (보낸 턴은 다시 굴리기용으로 변수에 남지만 칩은 숨긴다). 이름 ×n */
export function useBoxNames(chat: Chat | null): { id: string; label: string }[] {
  // 소지품이 꺼져 있으면 상자도 없다 (2026-11-07 사용자: 켜고 끄기)
  if (!chat || chat.scriptstate?.[ITEM_USE_AT_VAR] || !invOn(chat.scriptstate)) return [];
  const live = liveItems(readItems(chat.scriptstate), aliveAnchors(chat));
  return readItemUse(chat.scriptstate).flatMap((u) => {
    const e = live.find((x) => x.id === u.id);
    return e ? [{ id: u.id, label: `${e.name}${u.n > 1 ? ` ×${u.n}` : ''}` }] : [];
  });
}

async function ensure(): Promise<{ doc: Root['doc']; style: El } | null> {
  const root = await body();
  if (!root) return null;
  const { doc } = root;
  if (host && styleEl) return { doc, style: styleEl };
  try {
    for (const old of await elements(doc, '[x-goei-usebox]')) await old.remove().catch(() => {});
  } catch { /* 없으면 그만 */ }
  // 화면에 보이는 것은 없다: 채팅 속 자리를 채우는 style 만 든다 (SafeElement.setAttribute 는 x- 속성만 받는다)
  const h = await doc.createElement('div');
  await h.setAttribute('x-goei-usebox', 'true');
  const style = await doc.createElement('style');
  await h.appendChild(style);
  await root.body.appendChild(h);
  host = h;
  styleEl = style;
  return { doc, style };
}

/** × 로 뺀 뒤의 채팅. 「보내는 중」인 물건이면 null (그대로 둔다): 모델은 이미 쓴 것으로 받았으니 빼면 횟수·기록이 어긋난다 (재검토 11-14 B-9).
 *  이 채팅의 답을 기다리는 중·정리 중에도 null: 보낸 표시가 붙기 전(요청 조립 중)에 빼는 틈을 막는다 */
export function dropUseUnlessSent(chat: Chat, charIndex: number, chatIndex: number, id: string): Chat | null {
  if (useLocked(charIndex, chatIndex) || sentUseIds(chat, charIndex, chatIndex)?.has(id)) return null;
  const next = dropUse(readItemUse(chat.scriptstate), id);
  return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemUseVars(next) } };
}

// × 를 눌렀는지 좌표로 본다 (채팅 속 단추와 같은 길, host/chatclicks.ts)
onChatClick('use', async (doc, x, y) => {
  if (!shown.length || where.charIndex < 0) return 'idle';
  if (busy) return false;
  const xs = await elements(doc, `${LAST} [data-gu-x]`);
  for (let i = 0; i < xs.length; i++) {
    if (!(await hit(xs[i], x, y))) continue;
    const id = shown[i]?.id;
    if (!id) return false;
    busy = true;
    try {
      const { charIndex, chatIndex } = where;
      await freeUseLock(); // 중지·실패로 끝난 요청이 × 를 막지 않게
      await updateChat(charIndex, chatIndex, (chat) => dropUseUnlessSent(chat, charIndex, chatIndex, id));
      await refreshUseBox(charIndex, chatIndex);
    } catch (error) {
      console.log(`[goei] 사용 상자 빼기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      busy = false;
    }
    return true;
  }
  return false;
});

/** 마지막 메시지가 이 플러그인이 뜨기 전·Lite 판정 전에 그려져 자리가 없으면, 그 글 끝에 줄바꿈을 붙였다 떼어 Risu 가 다시 그리게 한다 (body.ts redrawAfterLoad 와 같은 방법, 글은 원래대로 돌아온다) */
async function redrawLast(doc: Root['doc'], charIndex: number, chatIndex: number): Promise<void> {
  if (!(await elements(doc, '.chat-message-container')).length || (await elements(doc, LAST)).length) return;
  const flip = (add: boolean) => updateChat(charIndex, chatIndex, (cur) => {
    const list = cur.message ?? [];
    const m = list[list.length - 1];
    if (!m || typeof m.data !== 'string' || (cur as { isStreaming?: boolean }).isStreaming) return null;
    if (!add && !m.data.endsWith('\n')) return null;
    return { ...cur, message: [...list.slice(0, -1), { ...m, data: add ? `${m.data}\n` : m.data.slice(0, -1) }] };
  }).catch(() => null);
  if (!(await flip(true))) return;
  await new Promise((r) => setTimeout(r, 300));
  await flip(false);
}

/** 이 채팅 상태로 상자를 다시 그린다 (채팅 바꿈·사용 누름·응답 뒤). known 이 있으면 다시 읽지 않는다 */
export async function refreshUseBox(charIndex: number, chatIndex: number, known?: Chat | null): Promise<void> {
  if (charIndex < 0 || chatIndex < 0) return hideUseBox();
  const chat = known ?? ((await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null);
  const hold = sentUseIds(chat, charIndex, chatIndex);
  // 보낸 뒤 새로 놓은 것이 있으면 그것만(다음 메시지에 사용), 없으면 보낸 것을 「보내는 중」으로 둔다
  const all = useBoxNames(chat);
  const fresh = all.filter((n) => !hold?.has(n.id));
  const sending = !fresh.length && all.length > 0 && !!hold;
  const names = sending ? all : fresh;
  where = { charIndex, chatIndex };
  if (!names.length) return hideUseBox();
  const e = await ensure();
  if (!e) return;
  shown = names.slice(0, names.length > SLOTS ? SLOTS - 1 : SLOTS);
  await e.style.setTextContent(useBoxCss(names, sending));
  armChatClick('use');
  await redrawLast(e.doc, charIndex, chatIndex).catch(() => {});
}

export async function hideUseBox(): Promise<void> {
  shown = [];
  if (styleEl) await styleEl.setTextContent('').catch(() => {});
}
