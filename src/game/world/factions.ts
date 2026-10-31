// 세력끼리 관계 (방문 대응, 10-31 사용자): 세력 평판 기능이 켜져 있으면 플러그인의 세력 관계 표(설정 → 세력 관계)를 따르고,
// 꺼져 있으면 게임 기본값 = 큰 세력 셋(관리국 A00 · 가짜 관리국 B00 · 백일몽 C00): 가짜 관리국은 둘과 적대, 관리국 ↔ 백일몽은 경계
// (10-31 사용자: 플러그인 기본 표와 베이스를 맞춤), 나머지(협회·중림 등)는 전부 중립.
export type Stance = 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile';

/** 게임 기본값: 큰 세력 셋 */
export const MAJOR_FACTIONS = ['A00', 'B00', 'C00'] as const;

export function defaultRelation(viewer: string, target: string): Stance {
  if (viewer === target) return 'friendly';
  const big = (c: string) => (MAJOR_FACTIONS as readonly string[]).includes(c);
  if (!big(viewer) || !big(target)) return 'neutral';
  return (viewer === 'A00' && target === 'C00') || (viewer === 'C00' && target === 'A00') ? 'wary' : 'hostile';
}

/** 플러그인 표(「A00>B00」 → 단계, 중립은 빠짐)가 있으면 그것, 없으면(null: 기능 꺼짐·옛 플러그인) 기본값 */
export function relationFrom(table: Record<string, Stance> | null | undefined): (viewer: string, target: string) => Stance {
  if (!table) return defaultRelation;
  return (v, t) => (v === t ? 'friendly' : table[`${v}>${t}`] ?? 'neutral');
}

/** 기본 세력 이름 (세력 평판 기능이 꺼져 이름표를 못 받을 때 장부 글에 쓴다) */
export const FACTION_NAMES: Record<string, string> = { A00: '관리국', B00: '가짜 관리국', C00: '백일몽', D00: '민간인', E00: '프리랜서' };
