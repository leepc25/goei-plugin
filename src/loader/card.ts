// 괴이 카드인지: 플러그인 매니페스트 로어북이 있는지, 없으면 명부(Directory)가 있는지 본다 (본체 없이 시작기에서 쓰는 작은 판정)
import { directoryEntries, manifestEntry } from '../core/lorebooks';
import type { LoreEntry } from '../core/types';

export function isGoeiCard(char: unknown): boolean {
  const lore = (char as { globalLore?: LoreEntry[] } | null)?.globalLore;
  const entry = manifestEntry(lore);
  if (entry && typeof entry.content === 'string') {
    try {
      if ((JSON.parse(entry.content) as { plugin?: unknown })?.plugin === 'goei-plugin') return true;
    } catch {
      // 아래 명부 판정
    }
  }
  // 매니페스트를 지운 카드: 명부에 schema 가 있으면 괴이 카드로 (설계안 9절)
  return directoryEntries(lore).some((e) => typeof e.content === 'string' && /"schema"\s*:\s*1/.test(e.content));
}
