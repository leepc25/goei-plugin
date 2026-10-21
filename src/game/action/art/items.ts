// 아이템·무기 그림 (docs/GPT요청_아이템무기.md → tools/items_pixelize.py → game-src/art/items/dot).
// 시연판은 window.__GOEI_ITEM_ART__에 내장. 그림이 없으면 false를 돌려주고 아이템 모듈의 코드 아이콘이 그린다.

export interface ItemArt {
  src: string;
  w: number;
  h: number;
  grip?: [number, number];
  foot?: [number, number];
}

declare global {
  interface Window {
    __GOEI_ITEM_ART__?: Record<string, ItemArt>;
  }
}

/** 게임 아이템 id → 그림 id (이름이 다른 것) */
const ALIAS: Record<string, string> = { heal: 'heal_orb', ammo: 'rounds', coin: 'coins' };
const cache = new Map<string, HTMLImageElement>();

function art(id: string): ItemArt | undefined {
  const all = (typeof window !== 'undefined' && window.__GOEI_ITEM_ART__) || {};
  return all[id] ?? all[ALIAS[id] ?? ''];
}

function img(a: ItemArt): HTMLImageElement | null {
  let im = cache.get(a.src);
  if (!im) {
    im = new Image();
    im.src = a.src;
    cache.set(a.src, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

/** 손잡이 기준점 (도트). 없으면 undefined. */
export function itemGrip(id: string): [number, number] | undefined {
  return art(id)?.grip;
}

/** size×size 칸에 그림을 맞춰 아래 가운데에 그린다(도트가 고르게 보이도록 배율은 되도록 정수). */
export function drawItemArt(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number): boolean {
  const a = art(id);
  const im = a && img(a);
  if (!a || !im) return false;
  const fit = Math.min(size / a.w, size / a.h);
  const k = fit >= 1 ? Math.floor(fit) : fit;
  const w = a.w * k,
    h = a.h * k;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, Math.round(x + (size - w) / 2), Math.round(y + size - h), w, h);
  ctx.imageSmoothingEnabled = prev;
  return true;
}

/** 손에 든 무기: 손잡이(grip)를 원점에 두고 각도 deg(0 = 위로 세움, 시계 방향)로 그린다. 도트 1 = 화면 2. */
export function drawItemHeld(ctx: CanvasRenderingContext2D, id: string, deg: number): boolean {
  const a = art(id);
  const im = a && img(a);
  if (!a || !im || !a.grip) return false;
  ctx.save();
  ctx.rotate(((deg - 90) * Math.PI) / 180); // 그림은 오른쪽을 향해 누워 있다
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, -a.grip[0] * 2, -a.grip[1] * 2, a.w * 2, a.h * 2);
  ctx.restore();
  return true;
}
