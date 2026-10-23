// 필드 거점 표 (docs/필드_기능_설계.md). 소속 코드 → 시작 거점. 아직 그림이 있는 곳은 본부뿐이라
// 표에 없는 소속은 모두 본부로 들어간다 (exact=false로 알린다).
export interface SiteDef {
  id: string;
  name: string;
  /** 이 소속 코드가 시작하는 곳 */
  factions: string[];
  /** 중립지역: 어느 소속이든 들어갈 수 있다 */
  neutral?: boolean;
}

export const SITES: SiteDef[] = [
  { id: 'hq', name: '관리국 본부', factions: [] },
];
export const FALLBACK_SITE = SITES[0];

export function siteFor(faction: string): { site: SiteDef; exact: boolean } {
  const f = faction.trim();
  const hit = f ? SITES.find(s => s.factions.includes(f)) : undefined;
  return hit ? { site: hit, exact: true } : { site: FALLBACK_SITE, exact: false };
}
