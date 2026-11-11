// 「사용」 상자 (2026-11-07 소지품): 소지품 메뉴에서 「사용」을 누른 물건을 채팅의 마지막 메시지 아래에 칩으로 보여 준다.
// 다음 전송 때 [Inventory] 글의 This turn 에 같이 넘어가고(core/items.ts withInventory), 응답이 붙으면 settleItemUse 가 상자를 정리한다.
// 자리 (2026-11-11 사용자): 브라우저 창에 고정하면 Risu 왼쪽 목록 위에 떴다 → 시작 안내(openinghint.ts)처럼 채팅 메시지 안에 붙인다.
//  · display 가 이 봇 메시지마다 빈 자리(USE_SLOT)를 붙여 두고(body.ts), 본 화면 style 이 마지막 메시지의 자리에만 이름을 채워 보인다.
//    Risu 는 글이 그대로면 메시지를 다시 그리지 않으니(Chats.svelte 글 해시), 이름은 글이 아니라 CSS(::before content)로 넣는다.
//  · 마지막 메시지 = .chat-message-container:first-child (Risu 는 새 메시지를 맨 앞에 넣고 flex-col-reverse 로 뒤집어 보인다).
import { aliveAnchors } from '../core/wallet';
import { dropUse, invOn, ITEM_USE_AT_VAR, itemUseVars, liveItems, readItemUse, readItems } from '../core/items';
import type { Chat } from '../core/types';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';
import { body } from './overlay';
import { updateChat } from './risu';

/** 한 번에 보이는 칩 수. 넘으면 마지막 칸이 「외 n개」 */
const SLOTS = 12;
const LAST = '.chat-message-container:first-child [data-goei-card="use"]';

/** display 가 메시지 끝에 붙이는 빈 자리. 본 화면 style 이 없으면 보이지 않는다 */
export const USE_SLOT = `<div data-goei-card="use" style="display:none"><span data-gu-label></span>${Array.from({ length: SLOTS }, (_, i) => `<span data-gu="${i}"><span data-gu-x="${i}" role="button" aria-label="빼기"></span></span>`).join('')}<span data-gu-more></span></div>`;

const cssStr = (s: string) => `"${s.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** 마지막 메시지의 자리에 이름을 채우는 CSS. 색은 채팅 카드 변수(ui/theme.ts cardVarsCss)를 쓴다 */
export function useBoxCss(names: { label: string }[]): string {
  if (!names.length) return '';
  const show = names.slice(0, names.length > SLOTS ? SLOTS - 1 : SLOTS);
  const more = names.length - show.length;
  return [
    `${LAST} { display: flex !important; flex-wrap: wrap; align-items: center; gap: 6px 8px; width: fit-content; min-width: min(100%, 420px); max-width: 100%; box-sizing: border-box; margin: 10px auto 0; padding: 10px 16px; border: 1px solid var(--goei-accentLine); border-radius: 14px; background: var(--goei-accentBg); color: var(--goei-sub); font-size: .92em; line-height: 1.5; }`,
    `${LAST} [data-gu-label]::before { content: "다음 메시지에 사용"; color: var(--goei-signal); font-weight: 600; margin-right: 4px; }`,
    `${LAST} [data-gu] { display: none; align-items: center; gap: 6px; max-width: 100%; padding: 2px 4px 2px 10px; border: 1px solid var(--goei-accentLine); border-radius: 999px; color: var(--goei-text); }`,
    `${LAST} [data-gu]::before { max-width: 14em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }`,
    `${LAST} [data-gu-x] { flex: none; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--goei-accentLine); color: var(--goei-signal); line-height: 1; cursor: pointer; }`,
    `${LAST} [data-gu-x]::before { content: "×"; }`,
    ...show.map((n, i) => `${LAST} [data-gu="${i}"] { display: inline-flex; } ${LAST} [data-gu="${i}"]::before { content: ${cssStr(n.label)}; }`),
    more > 0 ? `${LAST} [data-gu-more]::before { content: "외 ${more}개"; }` : '',
  ].join('\n');
}

type Root = NonNullable<Awaited<ReturnType<typeof body>>>;
type El = Awaited<ReturnType<Root['doc']['createElement']>>;

let host: El | null = null;
let styleEl: El | null = null;
let where = { charIndex: -1, chatIndex: -1 };
let shown: { id: string; label: string }[] = [];
let busy = false;

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
      await updateChat(charIndex, chatIndex, (chat) => {
        const next = dropUse(readItemUse(chat.scriptstate), id);
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemUseVars(next) } };
      });
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
  const names = useBoxNames(chat);
  where = { charIndex, chatIndex };
  if (!names.length) return hideUseBox();
  const e = await ensure();
  if (!e) return;
  shown = names.slice(0, names.length > SLOTS ? SLOTS - 1 : SLOTS);
  await e.style.setTextContent(useBoxCss(names));
  armChatClick('use');
  await redrawLast(e.doc, charIndex, chatIndex).catch(() => {});
}

export async function hideUseBox(): Promise<void> {
  shown = [];
  if (styleEl) await styleEl.setTextContent('').catch(() => {});
}
