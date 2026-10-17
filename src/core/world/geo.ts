// 지역 데이터. 원본 Lua의 SIGUN/SIDONAME 표를 그대로 옮겼다 (src/data/geo.json).
// loc 코드 = "시도코드-시군순번" (예: "02-6" = 서울 종로구). 키에는 한글을 쓰지 않는다.
import geo from '../../data/geo.json';

export const SIGUN: Record<string, string[]> = geo.sigun;
export const SIDO_NAME: Record<string, string> = geo.sido;
/** 대규모 재난으로 봉인된 세광특별시. 발생 추첨에서 영구 제외 */
export const SEALED_LOC: string = geo.sealedLoc;

/** 발생 추첨 대상 전체 (봉인 지역 제외) */
export const POOL: string[] = Object.entries(SIGUN).flatMap(([code, list]) =>
  list.map((_, i) => `${code}-${i}`).filter((loc) => loc !== SEALED_LOC),
);

export function locName(loc: string): string {
  const m = /^(\d+)-(\d+)$/.exec(loc);
  if (!m) return loc;
  const gu = SIGUN[m[1]]?.[Number(m[2])];
  if (gu === '세광특별시') return gu;
  const sido = SIDO_NAME[m[1]] ?? m[1];
  return gu ? `${sido} ${gu}` : sido;
}

/** "서울특별시 종로구" → "서울 종로구" (모델이 시도를 줄여 쓰는 경우) */
function shortName(name: string): string {
  return name.replace(/^(\S+?)(?:특별자치도|특별자치시|특별시|광역시|도)(\s)/, '$1$2');
}

/**
 * 모델이 적은 지역과 시스템 지역이 같은지. 공백 무시, 한쪽이 다른 쪽을 포함하면 일치 (시도 접두 차이 허용).
 * 원본 규칙에 더해 "서울 종로구"처럼 시도를 줄여 쓴 것도 받는다.
 */
export function regionMatch(tagRegion: string | undefined, name: string | undefined): boolean {
  if (!tagRegion?.trim() || !name?.trim()) return false;
  const a = tagRegion.replace(/\s+/g, '');
  return [name, shortName(name)].some((n) => {
    const b = n.replace(/\s+/g, '');
    return a === b || a.includes(b) || b.includes(a);
  });
}

/** 모델이 적은 지역 이름에 딱 하나만 맞는 loc. 여러 곳이 맞으면(예: "중구") null */
export function uniqueRegion(region: string): string | null {
  let match: string | null = null;
  for (const [code, list] of Object.entries(SIGUN)) {
    for (let i = 0; i < list.length; i++) {
      const loc = `${code}-${i}`;
      if (loc === SEALED_LOC || !regionMatch(region, locName(loc))) continue;
      if (match) return null;
      match = loc;
    }
  }
  return match;
}

/** 랜드마크(시도 코드 + 구 이름)의 loc */
export function landmarkLoc(sido: string, gu: string): string | null {
  const i = (SIGUN[sido] ?? []).indexOf(gu);
  return i >= 0 ? `${sido}-${i}` : null;
}

/** 전국 지도의 시도 핀: [코드, 짧은 이름, x%, y%] */
export const NATION_PINS = geo.nation as unknown as [string, string, number, number][];
/** 시도 지도의 시군구 핀 (SIGUN 순서와 같음, x%·y%) */
export const REGION_PINS = geo.pins as unknown as Record<string, ([number, number] | null)[]>;
export const MAP_CODES: string[] = NATION_PINS.map((p) => p[0]);

/** 지도 제목용 시도 이름 (경기는 북부·남부로 나뉨) */
export function regionName(code: string): string {
  if (code === '09') return '경기 북부';
  if (code === '10') return '경기 남부';
  return SIDO_NAME[code] ?? '전국';
}
