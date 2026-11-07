// 하이파 참조 (리수폿 J-3, 2026-11-06 사용자 결정 「Risu API 먼저 확인」): Risu 채팅 객체에 저장되는 HypaMemory 요약을 읽는다.
// Risu 는 채팅마다 hypaV3Data.summaries[].text (V3) 또는 hypaV2Data.mainChunks[].text (V2), 옛 supaMemoryData 를 둔다. 플러그인 API 가 따로 없어
// getChatFromIndex 로 받은 채팅 객체의 그 칸을 그대로 읽는다 (없으면 빈 배열). 요약은 배경 지식일 뿐 근거(m)로 쓰지 않는다.
// 2026-11-07 (전수검사 3 의 H·I): 원본 리수폿처럼 「최신순」이 아니라 **관련도 순위**로 고른다 — 이번 입력·최근 글·장면 인물 이름의 낱말이 든 요약에 가점,
// 중요 표시(isImportant·favorite)는 맨 앞, 같은 글 중복 제거, 개수 상한 + 글자 상한. 하이파 플러스(플러그인 저장소 hypaplus_state_<char>_<chat>)도 읽는다.
import type { Chat } from '../types';

export interface HypaItem { source: 'hypa' | 'hypaplus'; text: string; favorite: boolean; index: number }
export const HYPA_ITEM_CHARS = 4000;
export const HYPA_DEFAULT_ITEMS = 16;
export const HYPA_MAX_ITEMS = 64;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
export const hypaNorm = (v: unknown): string => String(v ?? '').normalize('NFC').toLocaleLowerCase().replace(/[^\p{L}\p{N}_]+/gu, ' ').trim();
export const hypaTokens = (v: unknown): string[] => [...new Set(hypaNorm(v).split(/\s+/).filter((t) => t.length >= 2))];

/** 관련도 점수 (원본 hypaScore): 중요 표시 1000, 낱말 하나 맞으면 +50+길이, 기본은 순번(최신이 큼) */
export function hypaScore(text: string, query: string, index: number, favorite = false): number {
  const source = hypaNorm(text);
  let score = favorite ? 1000 : index;
  for (const token of hypaTokens(query)) if (source.includes(token)) score += 50 + token.length;
  return score;
}

/** Risu 채팅 객체의 하이파 요약 (V3 → V2 → supaMemory) */
export function nativeHypaItems(chat: Chat): HypaItem[] {
  const items: HypaItem[] = [];
  const c = chat as Record<string, unknown>;
  const v3 = c.hypaV3Data as { summaries?: unknown } | undefined;
  if (v3 && Array.isArray(v3.summaries) && v3.summaries.length) {
    (v3.summaries as Record<string, unknown>[]).forEach((s, i) => { const t = str(s?.text); if (t) items.push({ source: 'hypa', text: t, favorite: s?.isImportant === true, index: i + 1 }); });
    return items;
  }
  const v2 = c.hypaV2Data as { mainChunks?: unknown } | undefined;
  if (v2 && Array.isArray(v2.mainChunks) && v2.mainChunks.length) {
    (v2.mainChunks as Record<string, unknown>[]).forEach((s, i) => { const t = str(s?.text); if (t) items.push({ source: 'hypa', text: t, favorite: false, index: i + 1 }); });
    return items;
  }
  const supa = str(c.supaMemoryData);
  if (supa) supa.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).forEach((t, i) => items.push({ source: 'hypa', text: t, favorite: false, index: i + 1 }));
  return items;
}

/** 하이파 플러스 노드 한 줄 (원본 plusNodeText) */
function plusNodeText(node: Record<string, unknown>): string {
  const type = node?.type === 'facts' ? '사실' : '기억';
  const time = str(node?.time);
  const location = str(node?.location);
  const characters = Array.isArray(node?.characters) ? (node.characters as unknown[]).map(String).filter(Boolean) : [];
  const content = str(node?.content);
  const dialogues = Array.isArray(node?.dialogues) ? (node.dialogues as Record<string, unknown>[]).map((d) => `${str(d?.speaker)}: ${str(d?.text)}`).filter((v) => v !== ': ') : [];
  return content ? `[${type}${time ? ` · ${time}` : ''}${location ? ` · ${location}` : ''}${characters.length ? ` · ${characters.join(', ')}` : ''}]\n${content}${dialogues.length ? `\n${dialogues.join('\n')}` : ''}` : '';
}

/** 하이파 플러스 저장값(플러그인 저장소 `hypaplus_state_<charId>_<chatId>` 의 JSON 문자열 또는 객체) → 항목. 호출하는 쪽(host)이 읽어서 넘긴다 */
export function hypaPlusItems(stored: unknown): HypaItem[] {
  let state: unknown = stored;
  if (typeof stored === 'string') { try { state = JSON.parse(stored); } catch { return []; } }
  if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
  const out: HypaItem[] = [];
  const chunks = (state as { chunks?: unknown }).chunks;
  for (const chunk of Array.isArray(chunks) ? (chunks as Record<string, unknown>[]) : []) {
    for (const node of Array.isArray(chunk?.nodes) ? (chunk.nodes as Record<string, unknown>[]) : []) {
      const text = plusNodeText(node);
      if (text) out.push({ source: 'hypaplus', text, favorite: node?.favorite === true, index: Number(node?.createdAt) || out.length + 1 });
    }
  }
  return out;
}

/** 관련도 순위로 고르기 (원본 selectHypaItems): 중복 제거 → 점수 내림차순(같으면 최신) → 개수·글자 상한 → 원래 순서로 돌려준다 */
export function selectHypa(items: HypaItem[], query: string, o: { maxItems?: number; maxChars?: number } = {}): HypaItem[] {
  const maxItems = Math.max(0, Math.min(HYPA_MAX_ITEMS, o.maxItems ?? HYPA_DEFAULT_ITEMS));
  const maxChars = Math.max(0, o.maxChars ?? 24000);
  const unique = new Map<string, HypaItem>();
  for (const it of items) { const k = hypaNorm(it.text); if (k && !unique.has(k)) unique.set(k, it); }
  const ranked = [...unique.values()].map((it) => ({ it, score: hypaScore(it.text, query, it.index, it.favorite) })).sort((a, b) => b.score - a.score || b.it.index - a.it.index);
  const selected: HypaItem[] = [];
  let chars = 0;
  for (const { it } of ranked) {
    if (selected.length >= maxItems) break;
    const text = it.text.slice(0, HYPA_ITEM_CHARS);
    if (chars + text.length > maxChars) continue;
    chars += text.length;
    selected.push({ ...it, text });
  }
  return selected.sort((a, b) => a.index - b.index);
}

/** 갱신기·Director 자료용: 채팅 요약(+플러스)에서 query 와 관련 있는 것부터 글자 상한 안에서. 결과는 원래 순서(오래된 것부터) */
export function hypaSummaries(chat: Chat, cap = 3000, query = '', o: { plus?: unknown; maxItems?: number } = {}): string[] {
  const items = [...nativeHypaItems(chat), ...(o.plus !== undefined ? hypaPlusItems(o.plus) : [])];
  return selectHypa(items, query, { maxItems: o.maxItems, maxChars: cap }).map((it) => it.text);
}
