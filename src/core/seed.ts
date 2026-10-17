import type { LoreEntry } from './types';

// 원본 Lua의 seedParse/seedLoad 이식.
// "Start trigger" 로어북: "A00-1:관리국|쟈알디|..." 줄마다 시작 조합별로 첫 턴에 강제로 넣을 로어북 이름 목록.
// 퍼메는 로어북 키워드 스캔 대상이 아니라서 첫 응답에 인물·세력 자료가 빠지는 것을 막는다.
export const SEED_ENTRY = 'Start trigger';
export const SEED_OPEN = '%%SEED%%';
export const SEED_CLOSE = '%%/SEED%%';

export function parseSeedManifest(raw: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of raw.split('\n')) {
    const t = line.replace(/\r/g, '').trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^([\w-]+)\s*:\s*(.*)$/.exec(t);
    if (!m) continue;
    const names = m[2].split('|').map((s) => s.trim()).filter(Boolean);
    if (names.length) map.set(m[1], names);
  }
  return map;
}

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
  if (!names) {
    const manifest = byComment.get(SEED_ENTRY)?.join('\n');
    if (!manifest) return { text: '', missing: [SEED_ENTRY] };
    names = parseSeedManifest(manifest).get(`${faction}-${fm}`);
  }
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
