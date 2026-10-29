// 채팅 속 상태창: 태그를 상자로 그리고(display), 시각·요일을 누르면 말풍선, 위키 이름을 누르면 창의 위키 문서로.
// 「지난 장면」·위키 이름은 채팅을 바꿀 때와 응답이 들어올 때 미리 모아 둔다 (display는 기다릴 수 없다).
// 보고서 카드(2026-10-29, docs/설계안_기록_보고서.md 5-12절): 사건이 종료된 응답의 상태창 원문(statusKey)을 열쇠로 그 상태창 상자 바로 아래에 카드를 붙인다.
// 설정 「채팅에 보고서 표시」(안 띄움 / 내가 출동한 사건만 / 전부)에 따라 열쇠 표를 모으고, 끄면 표가 비어 다시 그릴 때 카드가 없다. 본문·요청에는 아무것도 넣지 않는다.
import { buildRegistry, colConfig, findStatusTags, hiddenCols, setStatusColumns, statusTimeline } from '../core/world';
import { journalSettings, readReports, type Report } from '../core/journal';
import { listDocs, prepareBaseDocs } from '../core/wiki';
import type { Chat, LoreEntry } from '../core/types';
import { statusHtml, type StatusContext } from '../ui/status';
import { reportCardHtml } from '../ui/reportcard';
import { cardPalette, currentTheme } from '../ui/theme';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';
import { getChar } from './risu';

let ctx: StatusContext = { timeline: null, terms: [], hide: new Set() };
/** 상태창 원문(trim) → 그 응답에서 종료된 사건의 보고서 (설정이 off 면 빈 표) */
let cards = new Map<string, Report[]>();
/** 위키 이름을 누르면 (app.ts가 채운다) */
let openWiki: ((title: string) => void) | null = null;
/** 보고서 카드의 「기록에서 보기」 (app.ts 가 채운다) */
let openRecords: ((id: string) => void) | null = null;

export function setWikiOpener(f: (title: string) => void): void {
  openWiki = f;
}
export function setRecordsOpener(f: (id: string) => void): void {
  openRecords = f;
}

/** 채팅 카드 열쇠 표 (시험·진단용): 상태창 원문 → 보고서 id 들 */
export const reportCardKeys = (): Map<string, string[]> => new Map([...cards].map(([k, v]) => [k, v.map((r) => r.id)]));

function collectCards(chat: Chat): Map<string, Report[]> {
  const mode = journalSettings(chat.scriptstate).chatCard;
  const map = new Map<string, Report[]>();
  if (mode === 'off') return map;
  for (const r of readReports(chat).items) {
    if (!r.statusKey || (mode === 'mine' && !r.mine)) continue;
    (map.get(r.statusKey) ?? map.set(r.statusKey, []).get(r.statusKey)!).push(r);
  }
  return map;
}

/** 이 채팅의 상태창 시각 목록과 위키 이름을 다시 모은다 */
export async function refreshStatusContext(charIndex: number, chatIndex: number, known?: { chat: Chat; char: { globalLore?: LoreEntry[] } | null }): Promise<void> {
  if (charIndex < 0 || chatIndex < 0) return;
  // 부르는 쪽이 방금 읽은 채팅·캐릭터가 있으면 다시 읽지 않는다 (응답 처리)
  const chat = known?.chat ?? ((await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null);
  const char = known ? known.char : await getChar<{ globalLore?: LoreEntry[] }>(charIndex);
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
  cards = collectCards(chat);
}

/** display: 상태창 태그 → 상자 (+ 그 응답에서 종료된 사건의 보고서 카드) */
export function renderStatus(text: string): string {
  const tags = findStatusTags(text);
  if (!tags.length) return text;
  armChatClick('status');
  let out = text;
  // 바꿀 글을 함수로 (문자열이면 `$&` 같은 치환 기호가 상태창 값에 있을 때 깨진다)
  for (const t of tags) {
    const list = cards.get(t.raw.trim());
    let extra = '';
    if (list?.length) {
      armChatClick('report');
      const p = cardPalette(currentTheme());
      extra = list.map((r) => reportCardHtml(r, p)).join('');
    }
    out = out.replace(t.raw, () => statusHtml(t, ctx) + extra);
  }
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

// 보고서 카드의 「기록에서 보기」 → 창의 기록 › 보고서 페이지
onChatClick('report', async (doc, x, y) => {
  const links = await elements(doc, '[data-goei-rec]');
  if (!links.length) return 'idle';
  let inside = false;
  for (const el of links) if (await hit(el, x, y)) inside = true;
  if (!inside) return false;
  // SafeElement 는 속성을 못 읽는다: 아는 보고서 id 마다 그 id 의 링크를 찾아 자리를 맞춰 본다 (id 는 영숫자라 선택자에 그대로)
  const ids = new Set([...cards.values()].flat().map((r) => r.id).filter((id) => /^[A-Za-z0-9_-]+$/.test(id)));
  for (const id of ids) {
    for (const el of await elements(doc, `[data-goei-rec="${id}"]`)) {
      if (!(await hit(el, x, y))) continue;
      if (openRecords) openRecords(id);
      return true;
    }
  }
  return true;
});
