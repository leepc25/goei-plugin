// 하이파 참조 (리수폿 J-3, 2026-11-06 사용자 결정 「Risu API 먼저 확인」): Risu 채팅 객체에 저장되는 HypaMemory 요약을 읽는다.
// Risu 는 채팅마다 hypaV3Data.summaries[].text (V3) 또는 hypaV2Data.mainChunks[].text (V2) 를 둔다. 플러그인 API 가 따로 없어
// getChatFromIndex 로 받은 채팅 객체의 그 칸을 그대로 읽는다 (없으면 빈 배열). 요약은 배경 지식일 뿐 근거(m)로 쓰지 않는다.
import type { Chat } from '../types';

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** 최근 요약부터, 글자 상한 안에서 (오래된 것부터 순서대로 돌려준다) */
export function hypaSummaries(chat: Chat, cap = 3000): string[] {
  const texts: string[] = [];
  const v3 = (chat as Record<string, unknown>).hypaV3Data as { summaries?: unknown } | undefined;
  if (v3 && Array.isArray(v3.summaries)) for (const s of v3.summaries as Record<string, unknown>[]) { const t = str(s?.text); if (t) texts.push(t); }
  if (!texts.length) {
    const v2 = (chat as Record<string, unknown>).hypaV2Data as { mainChunks?: unknown; chunks?: unknown } | undefined;
    const main = v2 && Array.isArray(v2.mainChunks) ? (v2.mainChunks as Record<string, unknown>[]) : [];
    for (const s of main) { const t = str(s?.text); if (t) texts.push(t); }
  }
  const out: string[] = [];
  let used = 0;
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = out.length ? texts[i] : texts[i].slice(0, cap);
    if (used + t.length > cap) break;
    out.unshift(t);
    used += t.length;
  }
  return out;
}
