// 채팅 속 상태창: 태그를 상자로 그리고(display), 시각·요일을 누르면 말풍선, 위키 이름을 누르면 창의 위키 문서로.
// 「지난 장면」·위키 이름은 채팅을 바꿀 때와 응답이 들어올 때 미리 모아 둔다 (display는 기다릴 수 없다).
import { buildRegistry, colConfig, findStatusTags, hiddenCols, setStatusColumns, statusTimeline } from '../core/world';
import { listDocs, prepareBaseDocs } from '../core/wiki';
import type { Chat, LoreEntry } from '../core/types';
import { statusHtml, type StatusContext } from '../ui/status';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';
import { getChar } from './risu';

let ctx: StatusContext = { timeline: null, terms: [], hide: new Set() };
/** 위키 이름을 누르면 (app.ts가 채운다) */
let openWiki: ((title: string) => void) | null = null;

export function setWikiOpener(f: (title: string) => void): void {
  openWiki = f;
}

/** 이 채팅의 상태창 시각 목록과 위키 이름을 다시 모은다 */
export async function refreshStatusContext(charIndex: number, chatIndex: number): Promise<void> {
  if (charIndex < 0 || chatIndex < 0) return;
  const chat = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  const char = await getChar<{ globalLore?: LoreEntry[] }>(charIndex);
  if (!chat) return;
  const texts = (chat.message ?? []).filter((m) => m.role === 'char' && typeof m.data === 'string').map((m) => m.data);
  await prepareBaseDocs(char?.globalLore).catch(() => undefined);
  const titles = new Map<string, string>();
  for (const e of buildRegistry(char?.globalLore).entries) for (const t of e.terms) if (t.length >= 2 && !titles.has(t)) titles.set(t, e.name);
  for (const d of listDocs(chat, char?.globalLore)) if (d.title.length >= 2 && !titles.has(d.title)) titles.set(d.title, d.title);
  const terms = [...titles].map(([term, title]) => ({ term, title })).sort((a, b) => b.term.length - a.term.length);
  // 칸 구성: 파서에 알리고(칸 수로 모양 찾기), 상자에서 숨길 칸을 정한다
  setStatusColumns(chat.scriptstate);
  ctx = { timeline: statusTimeline(texts), terms, hide: hiddenCols(colConfig(chat.scriptstate)) };
}

/** display: 상태창 태그 → 상자 */
export function renderStatus(text: string): string {
  const tags = findStatusTags(text);
  if (!tags.length) return text;
  armChatClick('status');
  let out = text;
  // 치환 문자열이 아니라 함수로: 태그 글에 $& · $' 같은 치환 패턴이 들어 있으면 원문 태그가 두 번 들어가거나 뒷글이 끼어든다 (QC 2026-10-28)
  for (const t of tags) out = out.replace(t.raw, () => statusHtml(t, ctx));
  return out;
}

onChatClick('status', async (doc, x, y) => {
  const boxes = await elements(doc, '[data-goei-status]');
  if (!boxes.length) return 'idle';
  let inside = false;
  for (const b of boxes) if (await hit(b, x, y)) inside = true;
  const tips = await elements(doc, '[data-gst-tip]');
  // 말풍선: 누른 것만 열고 나머지는 닫는다 (다시 누르면 닫힘)
  let hitTip = false;
  for (const el of tips) {
    const on = inside && (await hit(el, x, y));
    const open = await el.hasClass('open').catch(() => false);
    if (on && !open) {
      await el.addClass('open');
      hitTip = true;
    } else if (open) await el.removeClass('open');
    if (on) hitTip = true;
  }
  if (hitTip || !inside) return hitTip;
  for (const el of await elements(doc, '[data-goei-wiki]')) {
    if (!(await hit(el, x, y))) continue;
    const name = ((await el.textContent().catch(() => '')) ?? '').trim();
    const title = ctx.terms.find((t) => t.term === name)?.title;
    if (title && openWiki) openWiki(title);
    return true;
  }
  return false;
});
