// 플러그인만 읽는 데이터 로어북 이름. 이름을 바꾼 뒤에도 옛 이름으로 된 카드를 계속 읽는다.
import type { LoreEntry } from './types';

export const DIRECTORY_COMMENT = 'Directory';
export const MANIFEST_COMMENT = 'Plugin manifest';
export const OLD_DIRECTORY = '괴이봇 명부';
export const OLD_MANIFEST = '괴이봇 플러그인 매니페스트';

/** 명부로 옮긴 옛 데이터 로어북 (옮기고 나면 지운다) */
export const LEGACY_DATA = ['World catalog', 'Agent roster', 'Faction display', 'Phone tabs', 'Start trigger'];
/** 다른 로어북에 합쳐서 더 쓰지 않는 로어북 (카드 업데이트 때 지운다) */
export const RETIRED = ['LB Backend', OLD_MANIFEST];

export const isDirectory = (comment: unknown) => comment === DIRECTORY_COMMENT || comment === OLD_DIRECTORY;

/** 새 이름 항목이 있으면 그것만, 없으면 옛 이름 항목 */
export function named(lore: LoreEntry[] | undefined, name: string, old: string): LoreEntry[] {
  const list = lore ?? [];
  const hit = list.filter((e) => e.comment === name);
  return hit.length ? hit : list.filter((e) => e.comment === old);
}

export const directoryEntries = (lore: LoreEntry[] | undefined) => named(lore, DIRECTORY_COMMENT, OLD_DIRECTORY);
export const manifestEntry = (lore: LoreEntry[] | undefined) => named(lore, MANIFEST_COMMENT, OLD_MANIFEST)[0];

/** 「A00-1:관리국|쟈알디」 줄마다 시작 조합별 첫 턴 로어북 목록 (옛 Start trigger 형식) */
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
