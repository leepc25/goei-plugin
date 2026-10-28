// 공통 조작 조각 (2026-10-27 사용자: 리수폿 설정 창처럼). 켬/끔 둘뿐인 선택은 단추 두 개 대신 스위치 하나.
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 선택지가 ON/OFF 둘뿐인가 (seg 도우미들이 스위치로 바꿔 그린다) */
export const isOnOff = (items: [string, string][]): boolean => items.length === 2 && items.every(([, l]) => l === 'ON' || l === 'OFF');

/** 스위치: 누르면 data-value(반대 값)로 data-action 이 간다. 켜짐은 aria-checked */
export function switchHtml(o: { action: string; value: string; on: boolean; disabled?: boolean; label?: string }): string {
  return `<span class="gx-switch-wrap"><small>${o.disabled ? '비활성' : o.on ? '켬' : '끔'}</small><button class="gx-switch" role="switch" aria-checked="${o.on}" data-action="${esc(o.action)}" data-value="${esc(o.value)}" ${o.disabled ? 'disabled' : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}><i></i></button></span>`;
}

/** seg 도우미용: ON/OFF 쌍이면 스위치 HTML, 아니면 null. valueOf 는 data-value 를 만드는 규칙 */
export function onOffSwitch(items: [string, string][], cur: string, action: string, valueOf: (v: string) => string, disabled = false): string | null {
  if (!isOnOff(items)) return null;
  const onV = items.find(([, l]) => l === 'ON')![0];
  const offV = items.find(([, l]) => l === 'OFF')![0];
  const on = cur === onV;
  return switchHtml({ action, value: valueOf(on ? offV : onV), on, disabled });
}

/**
 * 이름 없는 스위치에 줄 이름을 aria-label 로 붙인다 (2026-10-28 QC: seg 도우미가 만든 스위치는 글자가 없어 읽어 주기가 「버튼」뿐이었다).
 * 그린 뒤 한 번 훑는다 (패널·편집 창 render 끝에서). 줄(.ps-row·.dir-line·.st-col-row)의 이름 글자를 쓴다
 */
export function labelSwitches(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('button.gx-switch[role="switch"]:not([aria-label])').forEach((b) => {
    const row = b.closest<HTMLElement>('.ps-row, .dir-line, .st-col-row, .dir-in');
    const name = row?.querySelector<HTMLElement>('.ps-label > b, .st-col-name > b, :scope > span:first-child')?.textContent?.replace(/\s+/g, ' ').trim();
    if (name) b.setAttribute('aria-label', name);
  });
}
