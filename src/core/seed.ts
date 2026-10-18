import type { LoreEntry } from './types';
import { seedSection } from './world/directory';

// 원본 Lua의 seedParse/seedLoad 이식.
// 명부의 「시작 로어북」(옛 카드는 Start trigger 로어북): 시작 조합(A00-1)마다 첫 턴에 강제로 넣을 로어북 이름 목록.
// 퍼메는 로어북 키워드 스캔 대상이 아니라서 첫 응답에 인물·세력 자료가 빠지는 것을 막는다.
export { parseSeedManifest } from './lorebooks';
export const SEED_OPEN = '%%SEED%%';
export const SEED_CLOSE = '%%/SEED%%';

export interface SeedResult {
  text: string;
  missing: string[];
}

/** Build the seed block for faction+fm. Lore is matched by comment, like Risu getLoreBooks. names: 새 세력처럼 목록을 직접 줄 때 */
export function buildSeed(lore: LoreEntry[], faction: string, fm: number, names?: string[]): SeedResult {
  const byComment = new Map<string, string[]>();
  for (const e of lore) {
    if (typeof e.comment !== 'string' || typeof e.content !== 'string' || !e.content) continue;
    const list = byComment.get(e.comment) ?? [];
    if (!list.includes(e.content)) list.push(e.content);
    byComment.set(e.comment, list);
  }
  names ??= seedSection(lore)[`${faction}-${fm}`];
  if (!names?.length) return { text: '', missing: [] };
  const parts: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const bodies = byComment.get(name);
    if (bodies) parts.push(bodies.join('\n\n'));
    else missing.push(name);
  }
  const joined = parts.join('\n\n');
  return { text: joined ? `${SEED_OPEN}\n${joined}\n${SEED_CLOSE}` : '', missing };
}

const SEED_BLOCK = /%%SEED%%[\s\S]*?%%\/SEED%%\n?/g;
const SEED_MARKER = /%%\/?SEED%%\n?/g;

/**
 * 시드 수명: 첫 유저 전송(과 그 리롤)까지만 유지하고 두 번째 전송부터 제거한다 (원본과 동일).
 * keep=true면 표식만 지우고 본문은 남긴다.
 */
export function applySeedLifetime(text: string, keep: boolean): string {
  if (!text.includes(SEED_OPEN)) return text;
  return keep ? text.replace(SEED_MARKER, '') : text.replace(SEED_BLOCK, '');
}
