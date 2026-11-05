// 괴담톡·괴담넷 도구 줄 (v0.16.23, 사용자 설계). PC는 왼쪽 목록 맨 아래에 늘 보이고 (오른쪽 입력줄과 같은 높이),
// 모바일은 하단 바 바로 위에 접혀 있다가 손잡이를 누르거나 위로 밀면 펼쳐지고, 다시 누르거나 아래로 밀면 접힌다.
// 펼친 상태는 다시 그려도 그대로. 서랍마다(탭마다) 따로 기억한다 — 2026-11-05 사용자: 상황판 즐겨찾기를 펼친 채 임무로 가면
// 지역 서랍이 펼쳐져 지도를 가리고, 설정 창에서 접으면 상황판 서랍까지 접히던 문제(변수 하나를 모두가 같이 썼다).

const opened = new Map<string, boolean>();
const isOpen = (key: string) => opened.get(key) === true;

function shell(key: string, cls: string, inner: string): string {
  const open = isOpen(key);
  return `<div class="ph-drawer${cls ? ` ${cls}` : ''}${open ? ' open' : ''}" data-drawer="${key}">
    <button class="ph-grip" type="button" aria-label="${open ? '도구 접기' : '도구 펼치기'}" aria-expanded="${open}"><i></i></button>
    ${inner}</div>`;
}

/** 도구 단추 서랍. key = 펼침 상태를 기억하는 이름(기본은 cls, 둘 다 없으면 'tools') */
export function drawerHtml(tools: string, above = '', cls = '', key = cls || 'tools'): string {
  return shell(key, cls, `${above}<div class="ph-tools">${tools}</div>`);
}

/** 도구 버튼이 아닌 내용(지역·검색, 작전 메모)을 담는 서랍. 모바일에서만 보인다 (임무·커스텀·명부) */
export function drawerBox(content: string, cls = '', after = '', key = cls || 'box'): string {
  return shell(key, `gx-mdrawer${cls ? ` ${cls}` : ''}`, `<div class="ph-dbody">${content}</div>${after}`);
}

/** 서랍에서 다른 화면으로 갈 때: 접어 두고 간다 (펼친 채로 남아 다음 화면에서 가려지던 문제). key 없이 부르면 전부 */
export function closeDrawer(key?: string): void {
  if (key === undefined) opened.clear();
  else opened.set(key, false);
}

function set(box: HTMLElement, on: boolean) {
  opened.set(box.dataset.drawer ?? 'tools', on);
  box.classList.toggle('open', on);
  const grip = box.querySelector<HTMLElement>('.ph-grip');
  grip?.setAttribute('aria-expanded', String(on));
  grip?.setAttribute('aria-label', on ? '도구 접기' : '도구 펼치기');
}

export function bindDrawer(root: HTMLElement, onSide?: () => void): void {
  const box = root.querySelector<HTMLElement>('.ph-drawer');
  const grip = box?.querySelector<HTMLElement>('.ph-grip');
  if (!box || !grip) return;
  const open = () => box.classList.contains('open');
  grip.addEventListener('click', () => set(box, !open()));
  // 위아래로 밀기: 손잡이와 도구 줄 어디서든
  // 좌우로 밀기: 상황판 서랍(즐겨찾기)만, 펼쳐 있을 때 ★ 창
  let y0: number | null = null;
  let x0 = 0;
  box.addEventListener('touchstart', (e) => {
    y0 = e.touches[0]?.clientY ?? null;
    x0 = e.touches[0]?.clientX ?? 0;
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (y0 === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? y0) - y0;
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
    y0 = null;
    if (onSide && open() && box.classList.contains('gx-bdrawer') && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) return onSide();
    if (dy < -24 && !open()) set(box, true);
    else if (dy > 24 && open()) set(box, false);
  }, { passive: true });
}
