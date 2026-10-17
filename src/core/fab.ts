// 플로팅 버튼 위치 계산. 위치는 화면 오른쪽·아래 가장자리에서의 거리(px)로 저장해서
// 창 크기가 바뀌어도 모서리 기준으로 그대로 남는다.
export interface FabPos {
  right: number;
  bottom: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const FAB_SIZE = 48;
export const FAB_MARGIN = 8;
export const DEFAULT_FAB_POS: FabPos = { right: 16, bottom: 96 };
/** 이만큼 움직이면 클릭이 아니라 끌기로 본다 */
export const DRAG_THRESHOLD = 6;

export function inside(rect: Rect | null | undefined, x: unknown, y: unknown): boolean {
  if (!rect || typeof x !== 'number' || typeof y !== 'number') return false;
  return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
}

export function clampPos(pos: FabPos, viewW: number, viewH: number): FabPos {
  const maxR = Math.max(FAB_MARGIN, viewW - FAB_SIZE - FAB_MARGIN);
  const maxB = Math.max(FAB_MARGIN, viewH - FAB_SIZE - FAB_MARGIN);
  const r = Number.isFinite(pos.right) ? pos.right : DEFAULT_FAB_POS.right;
  const b = Number.isFinite(pos.bottom) ? pos.bottom : DEFAULT_FAB_POS.bottom;
  return {
    right: Math.round(Math.min(maxR, Math.max(FAB_MARGIN, r))),
    bottom: Math.round(Math.min(maxB, Math.max(FAB_MARGIN, b))),
  };
}

/** 포인터가 (dx, dy)만큼 움직였을 때 새 위치 */
export function dragTo(start: FabPos, dx: number, dy: number, viewW: number, viewH: number): FabPos {
  return clampPos({ right: start.right - dx, bottom: start.bottom - dy }, viewW, viewH);
}

export function parsePos(raw: string | null | undefined): FabPos {
  try {
    const p = JSON.parse(raw ?? '');
    if (p && Number.isFinite(p.right) && Number.isFinite(p.bottom)) return { right: p.right, bottom: p.bottom };
  } catch {
    /* default */
  }
  return { ...DEFAULT_FAB_POS };
}
