// 괴담톡·괴담넷 도구 줄 (v0.16.23, 사용자 설계). PC는 왼쪽 목록 맨 아래에 늘 보이고 (오른쪽 입력줄과 같은 높이),
// 모바일은 하단 바 바로 위에 접혀 있다가 손잡이를 누르거나 위로 밀면 펼쳐지고, 다시 누르거나 아래로 밀면 접힌다.
// 펼친 상태는 다시 그려도 그대로. 서랍마다(탭마다) 따로 기억한다 (2026-11-05 사용자: 변수 하나를 모두가 같이 써서 다른 서랍까지 같이 펼쳐지고 접혔다).

const opened = new Map<string, boolean>();

/** 2026-11-07 사용자: 메뉴별 도구 줄은 폰에서도 접지 않고 늘 보인다 (손잡이 없음). 접고 펼치는 서랍은 하단 바 위 공용 서랍 하나 (app.ts commonDrawer) */
function shell(key: string, cls: string, inner: string): string {
  return `<div class="ph-drawer open${cls ? ` ${cls}` : ''}" data-drawer="${key}">${inner}</div>`;
}

/** 도구 단추 서랍. key = 펼침 상태를 기억하는 이름(기본은 cls, 둘 다 없으면 'tools') */
export function drawerHtml(tools: string, above = '', cls = '', key = cls || 'tools'): string {
  return shell(key, cls, `${above}<div class="ph-tools">${tools}</div>`);
}

/** 도구 버튼이 아닌 내용(지역·검색, 작전 메모)을 담는 서랍. 모바일에서만 보인다 (임무·커스텀·명부) */
export function drawerBox(content: string, cls = '', after = '', key = cls || 'box'): string {
  return shell(key, `gx-mdrawer${cls ? ` ${cls}` : ''}`, `<div class="ph-dbody">${content}</div>${after}`);
}

function set(box: HTMLElement, on: boolean) {
  opened.set(box.dataset.drawer ?? 'tools', on);
  box.classList.toggle('open', on);
  const grip = box.querySelector<HTMLElement>('.ph-grip');
  grip?.setAttribute('aria-expanded', String(on));
  grip?.setAttribute('aria-label', on ? '도구 접기' : '도구 펼치기');
}

export function bindDrawer(root: HTMLElement): void {
  const box = root.querySelector<HTMLElement>('.ph-drawer');
  const grip = box?.querySelector<HTMLElement>('.ph-grip');
  if (!box || !grip) return;
  const open = () => box.classList.contains('open');
  grip.addEventListener('click', () => set(box, !open()));
  // 위아래로 밀기: 손잡이와 도구 줄 어디서든
  let y0: number | null = null;
  box.addEventListener('touchstart', (e) => {
    y0 = e.touches[0]?.clientY ?? null;
  }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (y0 === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? y0) - y0;
    y0 = null;
    if (dy < -24 && !open()) set(box, true);
    else if (dy > 24 && open()) set(box, false);
  }, { passive: true });
}
