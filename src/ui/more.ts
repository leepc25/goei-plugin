// 「더 보기」 공통 (2026-11-12 사용자: 일지 500줄이 한 번에 다 그려져 스크롤이 길다 → 몇 줄만 보이고 더 보기를 눌러야 더 나오게.
// 「그 더보기는 해당 창 벗어나면 다시 초기화」). 일지·연대기·가계부 거래·소지품 기록이 같이 쓴다.
// 누른 횟수는 저장하지 않는 화면 상태다. 창 전체를 다시 그릴 때(app.ts render) 그 그리기에 나오지 않은 목록의 횟수는 지운다
// = 다른 메뉴·다른 하위 탭으로 가면 처음 줄 수로. 창을 닫을 때도 지운다 (resetMore). 거르기 칩·찾기 글이 바뀌어도 처음부터.
import { cutGroups, pageCount } from '../core/paging';
import { journalSettings } from '../core/journal/settings';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const state = new Map<string, { sig: string; presses: number }>();
const seen = new Set<string>();

/** 창 전체 그리기 앞·뒤 (app.ts render): 이번 그리기에 나오지 않은 목록은 처음 줄 수로 돌린다 */
export function moreBegin(): void {
  seen.clear();
}
export function moreEnd(): void {
  for (const k of [...state.keys()]) if (!seen.has(k)) state.delete(k);
}
/** 창을 닫을 때·채팅이 바뀔 때 */
export function resetMore(): void {
  state.clear();
  seen.clear();
}

/** 「더 보기」를 눌렀다 (data-action="list-more", data-value=목록 이름) */
export function moreAction(key: string): void {
  const s = state.get(key);
  if (s) s.presses += 1;
}

/** 한 번에 보일 줄 수 (설정 → 일지) */
export const listPage = (vars: Record<string, unknown> | undefined) => journalSettings(vars).listPage;

/**
 * 묶음 목록을 지금 보일 만큼만 자른다. key = 목록 이름, sig = 거르기·찾기 글(바뀌면 처음부터).
 * 돌려주는 more = 목록 맨 아래 「더 보기」 단추 (남은 줄이 없으면 빈 글). unit = 「줄」·「건」
 */
export function moreCut<G extends { rows: unknown[] }>(key: string, sig: string, vars: Record<string, unknown> | undefined, groups: G[], unit = '줄'): { groups: (G & { shown: G['rows'] })[]; more: string } {
  seen.add(key);
  let s = state.get(key);
  if (!s || s.sig !== sig) {
    s = { sig, presses: 0 };
    state.set(key, s);
  }
  const cut = cutGroups(groups, pageCount(listPage(vars), s.presses));
  const more = cut.rest > 0
    ? `<div class="gx-more"><button class="gx-mini ph-more" data-action="list-more" data-value="${esc(key)}">더 보기 <small>남은 ${cut.rest.toLocaleString('en-US')}${esc(unit)}</small></button></div>`
    : '';
  return { groups: cut.groups, more };
}
