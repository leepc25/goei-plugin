// 팝업창 공통 (11-09 사용자: 우주 쇼핑몰 질문 창처럼 — 제목줄을 끌어 옮기고, 오른쪽 아래 모서리로 크기를 바꾸고, 창 밖을 누르면 닫힌다).
// 우주 쇼핑몰 질문 창·게시판(괴담넷·괴담갤·세정게·연어 마켓) 쪽지함이 같이 쓴다. PC 에서만 (폰은 아래에서 올라오는 판·전체 화면 그대로).
export interface WinBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PopSpec {
  /** 창이 떠 있는 바탕 (이 안에서만 움직이고 커진다) */
  host: string;
  /** 바탕에 이 클래스가 있으면 폰 모양이라 건드리지 않는다 */
  skip: string;
  win: string;
  /** 끌기 손잡이 (제목줄). 그 안의 단추는 뺀다 */
  grip: string;
  /** 크기 조절 모서리 */
  size: string;
  /** 창 밖이라도 눌렀을 때 닫지 않는 것 (여는 단추, 다른 창) */
  keep: string;
  min: [number, number];
  isOpen(): boolean;
  close(): void;
  save(b: WinBox): void;
}

/** 저장해 둔 자리·크기 → 인라인 스타일 (없으면 CSS 기본 자리) */
export const winStyle = (b: WinBox | null | undefined): string => (b ? ` style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;right:auto;bottom:auto"` : '');

export function bindPopWins(root: HTMLElement, render: () => void, specs: PopSpec[]): void {
  root.addEventListener('pointerdown', (ev) => {
    // 왼쪽 단추만 (오른쪽 단추는 마우스 제스처·메뉴 — 11-09 점검: 오른쪽 클릭에 창이 닫히던 것)
    if (ev.button !== 0) return;
    const t = ev.target as HTMLElement;
    for (const sp of specs) {
      const host = t.closest<HTMLElement>(sp.host);
      if (!host || host.classList.contains(sp.skip)) continue;
      const win = t.closest<HTMLElement>(sp.win);
      if (!win) {
        // 창 밖 누름 → 닫기
        if (sp.isOpen() && !t.closest(sp.keep)) {
          sp.close();
          render();
        }
        return;
      }
      const grip = t.closest(sp.grip) && !t.closest('button, input, select, textarea, a') ? 'move' : t.closest(sp.size) ? 'size' : '';
      if (!grip) return;
      ev.preventDefault();
      const hr = host.getBoundingClientRect();
      const r = win.getBoundingClientRect();
      const start = { px: ev.clientX, py: ev.clientY, x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height };
      const cur = { ...start };
      const [minW, minH] = sp.min;
      const apply = () => {
        win.style.left = `${cur.x}px`;
        win.style.top = `${cur.y}px`;
        win.style.width = `${cur.w}px`;
        win.style.height = `${cur.h}px`;
        win.style.right = 'auto';
        win.style.bottom = 'auto';
      };
      const move = (e: PointerEvent) => {
        const dx = e.clientX - start.px;
        const dy = e.clientY - start.py;
        if (grip === 'move') {
          cur.x = Math.min(Math.max(0, start.x + dx), Math.max(0, hr.width - start.w));
          cur.y = Math.min(Math.max(0, start.y + dy), Math.max(0, hr.height - 40));
        } else {
          cur.w = Math.min(Math.max(minW, start.w + dx), Math.max(minW, hr.width - start.x));
          cur.h = Math.min(Math.max(minH, start.h + dy), Math.max(minH, hr.height - start.y));
        }
        apply();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        sp.save({ x: Math.round(cur.x), y: Math.round(cur.y), w: Math.round(cur.w), h: Math.round(cur.h) });
      };
      apply();
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      return;
    }
  });
}
