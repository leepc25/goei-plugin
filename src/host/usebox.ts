// 「사용」 상자 (2026-11-07 소지품): 소지품 메뉴에서 「사용」을 누른 물건을 본 화면 입력칸 위에 칩으로 보여 준다.
// 다음 전송 때 [Inventory] 글의 This turn 에 같이 넘어가고(core/items.ts withInventory), 응답이 붙으면 settleItemUse 가 상자를 정리한다.
// 본 화면 DOM은 SafeElement 뿐이라 유령 버튼(overlay.ts)과 같은 방식: x-goei-usebox 속성 선택자 CSS, 클릭은 좌표로 맞춰 본다.
import { ITEM_USE_AT_VAR, itemUseVars, readItemUse } from '../core/items';
import type { Chat } from '../core/types';
import { currentTheme, onThemeChange } from '../ui/theme';
import { elements, hit } from './chatclicks';
import { body, themeVars } from './overlay';
import { updateChat } from './risu';

const CSS = `
${themeVars('[x-goei-usebox]')}
[x-goei-usebox] { position: fixed; right: 76px; bottom: 100px; z-index: 46; display: none; max-width: min(72vw, 560px); font: 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif; pointer-events: none; }
[x-goei-usebox] [x-goei-uwrap] { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; align-items: center; }
[x-goei-usebox] [data-gu-label] { color: var(--g-sub); font-size: 11px; letter-spacing: .02em; margin-right: 2px; text-shadow: 0 1px 2px rgba(0,0,0,.3); }
[x-goei-usebox] [data-gu] { display: inline-flex; align-items: center; gap: 6px; padding: 6px 7px 6px 10px; border-radius: 999px; background: var(--g-panel); color: var(--g-text); border: 1px solid var(--g-line); box-shadow: 0 6px 14px -8px rgba(0,0,0,.6); }
[x-goei-usebox] [data-gu] b { font-weight: 600; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
[x-goei-usebox] [data-gu-x] { width: 16px; height: 16px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--g-acc); color: var(--g-signal); border: 1px solid var(--g-acc-line); font-size: 11px; line-height: 1; pointer-events: auto; cursor: pointer; }
`;

type Root = NonNullable<Awaited<ReturnType<typeof body>>>;
type El = Awaited<ReturnType<Root['doc']['createElement']>>;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let host: El | null = null;
let where = { charIndex: -1, chatIndex: -1 };
let shownNames: string[] = [];
let busy = false;

/** 상자에 보일 이름: 아직 보내지 않은 것만 (보낸 턴은 다시 굴리기용으로 변수에 남지만 칩은 숨긴다) */
export function useBoxNames(chat: Chat | null): string[] {
  if (!chat || chat.scriptstate?.[ITEM_USE_AT_VAR]) return [];
  return readItemUse(chat.scriptstate);
}

async function ensure(): Promise<El | null> {
  if (host) return host;
  const root = await body();
  if (!root) return null;
  const { doc } = root;
  try {
    for (const old of await elements(doc, '[x-goei-usebox]')) await old.remove().catch(() => {});
  } catch { /* 없으면 그만 */ }
  const h = await doc.createElement('div');
  await h.setAttribute('x-goei-usebox', 'true');
  await h.setAttribute('x-goei-theme', currentTheme());
  // SafeElement.setAttribute 는 x- 속성만 받는다. 안쪽은 innerHTML 로 한 번에
  const style = await doc.createElement('style');
  await style.setTextContent(CSS);
  await h.appendChild(style);
  const wrap = await doc.createElement('div');
  await wrap.setAttribute('x-goei-uwrap', 'true');
  await h.appendChild(wrap);
  await root.body.appendChild(h);
  host = h;
  onThemeChange((t) => void h.setAttribute('x-goei-theme', t).catch(() => {}));
  // 문서 전체에 걸리는 리스너: × 를 눌렀는지 좌표로 본다
  await h.addEventListener('click', ((ev: { clientX?: number; clientY?: number }) => void onClick(doc, ev.clientX ?? -1, ev.clientY ?? -1)) as (e: unknown) => void, { passive: true });
  return h;
}

async function onClick(doc: Root['doc'], x: number, y: number): Promise<void> {
  if (busy || !shownNames.length || where.charIndex < 0) return;
  const xs = await elements(doc, '[x-goei-usebox] [data-gu-x]');
  for (let i = 0; i < xs.length; i++) {
    if (!(await hit(xs[i], x, y))) continue;
    const name = shownNames[i];
    if (!name) return;
    busy = true;
    try {
      const { charIndex, chatIndex } = where;
      await updateChat(charIndex, chatIndex, (chat) => {
        const next = readItemUse(chat.scriptstate).filter((n) => n !== name);
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...itemUseVars(next) } };
      });
      await refreshUseBox(charIndex, chatIndex);
    } catch (error) {
      console.log(`[goei] 사용 상자 빼기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      busy = false;
    }
    return;
  }
}

/** 이 채팅 상태로 상자를 다시 그린다 (채팅 바꿈·사용 누름·응답 뒤). known 이 있으면 다시 읽지 않는다 */
export async function refreshUseBox(charIndex: number, chatIndex: number, known?: Chat | null): Promise<void> {
  if (charIndex < 0 || chatIndex < 0) return hideUseBox();
  const chat = known ?? ((await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null);
  const names = useBoxNames(chat);
  where = { charIndex, chatIndex };
  if (!names.length) return hideUseBox();
  const h = await ensure();
  if (!h) return;
  shownNames = names;
  const wrap = await h.querySelector('[x-goei-uwrap]');
  await wrap?.setInnerHTML(`<span data-gu-label>다음 메시지에 사용</span>${names.map((n) => `<span data-gu><b>${esc(n)}</b><span data-gu-x role="button" aria-label="${esc(n)} 빼기">×</span></span>`).join('')}`);
  await h.setStyle('display', 'block');
}

export async function hideUseBox(): Promise<void> {
  shownNames = [];
  if (host) await host.setStyle('display', 'none').catch(() => {});
}
