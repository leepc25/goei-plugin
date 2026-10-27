// 공통 조작 조각 (2026-10-27 사용자: 리수폿 설정 창처럼). 켬/끔 둘뿐인 선택은 단추 두 개 대신 스위치 하나.
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 선택지가 ON/OFF 둘뿐인가 (seg 도우미들이 스위치로 바꿔 그린다) */
export const isOnOff = (items: [string, string][]): boolean => items.length === 2 && items.every(([, l]) => l === 'ON' || l === 'OFF');

/** 스위치: 누르면 data-value(반대 값)로 data-action 이 간다. 켜짐은 aria-checked */
export function switchHtml(o: { action: string; value: string; on: boolean; disabled?: boolean; label?: string }): string {
  return `<button class="gx-switch" role="switch" aria-checked="${o.on}" data-action="${esc(o.action)}" data-value="${esc(o.value)}" ${o.disabled ? 'disabled' : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}><i></i></button>`;
}

/** seg 도우미용: ON/OFF 쌍이면 스위치 HTML, 아니면 null. valueOf 는 data-value 를 만드는 규칙 */
export function onOffSwitch(items: [string, string][], cur: string, action: string, valueOf: (v: string) => string, disabled = false): string | null {
  if (!isOnOff(items)) return null;
  const onV = items.find(([, l]) => l === 'ON')![0];
  const offV = items.find(([, l]) => l === 'OFF')![0];
  const on = cur === onV;
  return switchHtml({ action, value: valueOf(on ? offV : onV), on, disabled });
}
