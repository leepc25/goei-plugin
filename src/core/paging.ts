// 길게 쌓이는 목록(일지·연대기·가계부 거래·소지품 기록)을 처음 N줄만 그리고 「더 보기」로 N줄씩 더 그리는 공통 셈 (2026-11-12 사용자).
// 화면 상태(몇 번 눌렀나)는 ui/more.ts, 한 번에 보일 줄 수는 설정 「일지」의 $jr_list_page (core/journal/settings.ts).

/** 보일 줄 수 = 한 번에 보일 줄 수 × (누른 횟수 + 1) */
export function pageCount(page: number, presses: number): number {
  const p = Math.max(1, Math.trunc(page) || 1);
  return p * (Math.max(0, Math.trunc(presses) || 0) + 1);
}

/**
 * 묶음(날짜별)으로 나뉜 목록을 앞에서부터 count 줄만 남긴다.
 * 묶음은 순서 그대로, 잘린 묶음은 앞줄만 `shown` 에. 한 줄도 안 남는 묶음은 뺀다.
 * `rows` 는 손대지 않는다 — 묶음 머리의 건수·합계는 그날 전체로 셈한다 (더 보기를 눌러도 머리 숫자가 바뀌지 않게).
 */
export function cutGroups<G extends { rows: unknown[] }>(groups: G[], count: number): { groups: (G & { shown: G['rows'] })[]; total: number; rest: number } {
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  let left = Math.max(0, Math.trunc(count) || 0);
  const out: (G & { shown: G['rows'] })[] = [];
  for (const g of groups) {
    if (left <= 0) break;
    const shown = g.rows.slice(0, left);
    left -= shown.length;
    if (shown.length) out.push({ ...g, shown });
  }
  const shownN = out.reduce((n, g) => n + g.shown.length, 0);
  return { groups: out, total, rest: total - shownN };
}
