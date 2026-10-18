// 괴이 카드인지: 플러그인 매니페스트 로어북이 있는지만 본다 (본체 없이 시작기에서 쓰는 작은 판정)
import { manifestEntry } from '../core/lorebooks';
import type { LoreEntry } from '../core/types';

export function isGoeiCard(char: unknown): boolean {
  const entry = manifestEntry((char as { globalLore?: LoreEntry[] } | null)?.globalLore);
  if (!entry || typeof entry.content !== 'string') return false;
  try {
    return (JSON.parse(entry.content) as { plugin?: unknown })?.plugin === 'goei-plugin';
  } catch {
    return false;
  }
}
