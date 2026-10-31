// 창 안 앞뒤 이동 기록 (브라우저 ←·→ 처럼, 사용자 2026-10-19). 화면이 바뀔 때마다 그 화면 상태를 적고,
// 뒤로 가면 앞 기록을, 앞으로 가면 다음 기록을 돌려준다. 뒤로 간 뒤 새 화면으로 가면 앞쪽 기록은 버린다.
const LIMIT = 60;

export class NavHistory<T> {
  private list: string[] = [];
  private at = -1;

  /** 지금 화면 상태를 적는다 (방금 적은 것과 같으면 그대로) */
  record(state: T): void {
    const key = JSON.stringify(state);
    if (this.list[this.at] === key) return;
    this.list = this.list.slice(0, this.at + 1);
    this.list.push(key);
    if (this.list.length > LIMIT) this.list.shift();
    this.at = this.list.length - 1;
  }

  can(dir: -1 | 1): boolean {
    const i = this.at + dir;
    return i >= 0 && i < this.list.length;
  }

  /** 한 칸 옮기고 그 화면 상태를 돌려준다. 갈 곳이 없으면 null */
  go(dir: -1 | 1): T | null {
    if (!this.can(dir)) return null;
    this.at += dir;
    return JSON.parse(this.list[this.at]) as T;
  }

  /** 지나온 화면들, 최근 것부터 (같은 화면은 한 번만) */
  recent(): T[] {
    return [...new Set(this.list.slice(0, this.at + 1).reverse())].map((k) => JSON.parse(k) as T);
  }

  clear(): void {
    this.list = [];
    this.at = -1;
  }
}

/** 「기록」 메뉴 안 위치 (ui/records.ts 의 하위 탭·화면·대상) */
export interface RecordsNav {
  sub: 'journal' | 'reports' | 'people' | 'factions';
  view: 'list' | 'report' | 'person' | 'docs' | 'faction';
  id: string;
}

/**
 * 옛 즐겨찾기·이동 기록 호환 (2026-10-29): 위키 탭 안에 있던 인물 목록·개인 기록·기록 문서·세력 화면이 「기록」 메뉴로 옮겨졌다.
 * 옛 `{tab:'wiki', w:{view:'people'|'person'|'docs'|'faction', title}}` 를 기록 메뉴 위치로 바꾼다. 위키 문서 화면이면 null
 */
export function legacyWikiNav(view: string, title: string): RecordsNav | null {
  switch (view) {
    case 'people': return { sub: 'people', view: 'list', id: '' };
    case 'person': return { sub: 'people', view: 'person', id: title };
    case 'docs': return { sub: 'people', view: 'docs', id: '' };
    case 'faction': return { sub: 'factions', view: 'faction', id: title };
    default: return null;
  }
}
