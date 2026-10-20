// 괴담톡·괴담넷 도구 줄 (v0.16.23, 사용자 설계). PC는 왼쪽 목록 맨 아래에 늘 보이고 (오른쪽 입력줄과 같은 높이),
// 모바일은 하단 바 바로 위에 접혀 있다가 손잡이를 누르거나 위로 밀면 펼쳐지고, 다시 누르거나 아래로 밀면 접힌다.
// 펼친 상태는 다시 그려도 그대로 (괴담톡·괴담넷 함께).

let open = false;

export function drawerHtml(tools: string, above = '', cls = ''): string {
  return `<div class="ph-drawer${cls ? ` ${cls}` : ''}${open ? ' open' : ''}">
    <button class="ph-grip" type="button" aria-label="${open ? '도구 접기' : '도구 펼치기'}" aria-expanded="${open}"><i></i></button>
    ${above}<div class="ph-tools">${tools}</div></div>`;
}

/** 도구 버튼이 아닌 내용(지역·검색, 작전 메모)을 담는 서랍. 모바일에서만 보인다 (임무·커스텀) */
export function drawerBox(content: string, cls = '', after = ''): string {
  return `<div class="ph-drawer gx-mdrawer${cls ? ` ${cls}` : ''}${open ? ' open' : ''}">
    <button class="ph-grip" type="button" aria-label="${open ? '도구 접기' : '도구 펼치기'}" aria-expanded="${open}"><i></i></button>
    <div class="ph-dbody">${content}</div>${after}</div>`;
}

/** 서랍에서 다른 화면으로 갈 때: 접어 두고 간다 (펼친 채로 남아 다음 화면에서 가려지던 문제) */
export function closeDrawer(): void {
  open = false;
}

function set(box: HTMLElement, on: boolean) {
  open = on;
  box.classList.toggle('open', on);
  const grip = box.querySelector<HTMLElement>('.ph-grip');
  grip?.setAttribute('aria-expanded', String(on));
  grip?.setAttribute('aria-label', on ? '도구 접기' : '도구 펼치기');
}

export function bindDrawer(root: HTMLElement, onSide?: () => void): void {
  const box = root.querySelector<HTMLElement>('.ph-drawer');
  const grip = box?.querySelector<HTMLElement>('.ph-grip');
  if (!box || !grip) return;
  grip.addEventListener('click', () => set(box, !open));
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
    if (onSide && open && box.classList.contains('gx-bdrawer') && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) return onSide();
    if (dy < -24 && !open) set(box, true);
    else if (dy > 24 && open) set(box, false);
  }, { passive: true });
}
