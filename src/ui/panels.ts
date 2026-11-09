// 접는 칸(<details data-keep>)이 다시 그려도 열린 채로 남게 기억한다 (설정을 하나 바꿀 때마다 닫히지 않게)
const open = new Set<string>();

export const keepOpen = (key: string, fallback = false) => (open.has(key) || (fallback && !open.has(`!${key}`)) ? ' open' : '');

/** app.ts가 toggle 이벤트(버블링 안 함)를 잡아 넘긴다 */
export function rememberPanel(el: HTMLDetailsElement): void {
  const key = el.dataset.keep;
  if (!key) return;
  open.delete(key);
  open.delete(`!${key}`);
  open.add(el.open ? key : `!${key}`);
}

/** 코드가 칸을 열어 두기 (예: 새로 만든 규칙 칸) */
export function markOpen(key: string): void {
  open.delete(`!${key}`);
  open.add(key);
}
