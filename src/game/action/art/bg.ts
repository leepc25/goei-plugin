// 배경 그림 (docs/GPT요청_게임배경.md → tools/bg_pixelize.py → game-src/art/bg/dot).
// 시연판은 window.__GOEI_BG_ART__에 내장. 그림이 없는 장소는 false를 돌려주고 부른 쪽이 단색 대역을 그린다.
// 도트 1px = 화면 2px. 벽 칸 320×220 도트 = 화면 640×440, 바닥 무늬 128 도트.

export type BgPack = Record<string, Record<string, string>>; // 장소 → 이름 → data URL

declare global {
  interface Window {
    __GOEI_BG_ART__?: BgPack;
  }
}

const cache = new Map<string, HTMLImageElement | null>();
const patterns = new Map<string, CanvasPattern | null>();

function pack(): BgPack {
  return (typeof window !== 'undefined' && window.__GOEI_BG_ART__) || {};
}

function image(place: string, name: string): HTMLImageElement | null {
  const key = `${place}/${name}`;
  if (cache.has(key)) {
    const im = cache.get(key)!;
    return im && im.complete && im.naturalWidth ? im : null;
  }
  const src = pack()[place]?.[name];
  if (!src) {
    cache.set(key, null);
    return null;
  }
  const im = new Image();
  im.src = src;
  cache.set(key, im);
  return null;
}

/** place는 '장소' 또는 '장소:갈래'(수호자 방: guardian:guard → guardian_guard_wall*). */
function walls(place: string): string[] {
  const [p, sub] = place.split(':');
  return Object.keys(pack()[p] ?? {})
    .filter((n) => n.includes('_wall') && (!sub || n.startsWith(`${p}_${sub}_`)))
    .sort();
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 조각 하나의 벽(0~wallBottom)을 칸 그림으로 채운다. 칸 하나 = 640 논리 px. */
export function drawWallCell(ctx: CanvasRenderingContext2D, place: string, ref: string, x: number, w: number, flip: boolean, wallBottom: number): boolean {
  const names = walls(place);
  if (!names.length) return false;
  const bays = Math.max(1, Math.round(w / 640));
  const bw = w / bays;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < bays; i++) {
    const im = image(place.split(':')[0], names[hash(`${ref}#${i}`) % names.length]);
    if (!im) {
      ctx.restore();
      return false;
    }
    const bx = x + i * bw;
    if (flip) {
      ctx.save();
      ctx.translate(bx + bw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(im, 0, 0, bw, wallBottom);
      ctx.restore();
    } else ctx.drawImage(im, bx, 0, bw, wallBottom);
  }
  ctx.restore();
  return true;
}

/** 바닥 띠(y0~y1)를 무늬로 깐다. 뒤쪽 줄일수록 좁고 납작하게(원근), 무늬는 월드 x에 붙는다. */
export function drawFloor(ctx: CanvasRenderingContext2D, place: string, x0: number, x1: number, y0: number, y1: number): boolean {
  place = place.split(':')[0];
  const name = Object.keys(pack()[place] ?? {}).find((n) => n.endsWith('_floor'));
  const im = name ? image(place, name) : null;
  if (!im) return false;
  const key = `${place}/${name}`;
  let pat = patterns.get(key);
  if (pat === undefined) {
    pat = ctx.createPattern(im, 'repeat');
    patterns.set(key, pat);
  }
  if (!pat) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const step = 6;
  for (let y = y0; y < y1; y += step) {
    const t = (y - y0) / Math.max(1, y1 - y0); // 0 = 뒤, 1 = 앞
    const sx = 2 * (0.7 + 0.3 * t);
    const sy = sx * 0.5;
    // 화면 위쪽에서 시작하는 무늬의 세로 위치: 뒤에서 앞으로 누적된 깊이
    const depth = (y - y0) / sy;
    pat.setTransform(new DOMMatrix([sx, 0, 0, sy, 0, y - depth * sy]));
    ctx.fillStyle = pat;
    ctx.fillRect(x0, y, x1 - x0, Math.min(step, y1 - y));
  }
  // 뒤쪽 어둡게 (깊이 읽힘)
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
  return true;
}

/** 층 유형·고정 방 → 그림 장소 (docs/GPT요청_게임배경.md의 장소 이름). */
export function placeFor(where: string, floorType: string | undefined, ref: string): string {
  if (where === 'car') return 'el_car';
  if (where === 'service' || ref === 'room:attic') return 'service';
  if (ref === 'room:elevator_hall' || ref === 'room:exit_hall') return 'el_hall';
  if (ref === 'room:guardian_room') return `guardian:${({ chase: 'legs', replica: '405' } as Record<string, string>)[floorType ?? ''] ?? 'guard'}`;
  if (ref === 'room:trial_goal') return 'test';
  return ({ lobby: 'lobby', chase: 'chase', trial: 'test', replica: 'apt', puzzle: 'test', silent: 'chase', dark: 'chase', deep: 'service' } as Record<string, string>)[floorType ?? ''] ?? 'lobby';
}

/** 폭이 정해진 칸(본부 장소처럼 640보다 좁거나 넓은 칸)에 벽 그림을 늘리지 않고 가운데를 잘라 채운다. */
export function drawWallCrop(ctx: CanvasRenderingContext2D, place: string, key: string, x: number, w: number, wallBottom: number): boolean {
  const names = walls(place);
  if (!names.length) return false;
  const im = image(place.split(':')[0], names[hash(key) % names.length]);
  if (!im) return false;
  const k = wallBottom / im.height; // 화면 px / 도트
  const bayW = im.width * k;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let dx = 0; dx < w; dx += bayW) {
    const cw = Math.min(bayW, w - dx);
    const sx = w <= bayW ? (im.width - cw / k) / 2 : 0;
    ctx.drawImage(im, sx, 0, cw / k, im.height, x + dx, 0, cw, wallBottom);
  }
  ctx.restore();
  return true;
}

/** 본부 장소 id → 그림 장소 (그림이 없는 장소는 비슷한 방을 빌린다). */
export const HQ_PLACE: Record<string, string> = {
  office: 'hq_office', jaemtri: 'hq_jaemtri', chief: 'hq_office', supply: 'hq_workshop', pantry: 'hq_pantry', clinic: 'test', interview: 'hq_office',
  training: 'hq_workshop', appraisal: 'hq_jaemtri', lab: 'test', tooth: 'service', gallery: 'chase',
};
