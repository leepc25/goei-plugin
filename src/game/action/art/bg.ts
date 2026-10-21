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
    // 칸은 월드 위치 순서로 돌려 쓴다: 이웃한 칸이 같은 그림이 되지 않게 (통합 검수: 로비 문 4개 반복)
    const k = Math.round((x + i * bw) / 640);
    const im = image(place.split(':')[0], names[(k + (hash(place) % names.length)) % names.length]);
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
  wallLight(ctx, x, w, wallBottom);
  ctx.restore();
  return true;
}

/** 벽 명암 단계: 천장 쪽 두 단, 걸레받이 쪽 한 단을 어둡게 (부드러운 그라데이션 대신 도트처럼 끊어진 띠). */
function wallLight(ctx: CanvasRenderingContext2D, x: number, w: number, bottom: number) {
  const bands: [number, number, number][] = [
    [0, 0.1, 0.42],
    [0.1, 0.2, 0.24],
    [0.2, 0.3, 0.1],
    [0.94, 1, 0.3],
  ];
  for (const [a, b, k] of bands) {
    ctx.fillStyle = `rgba(8,8,14,${k})`;
    ctx.fillRect(x, Math.round(bottom * a), w, Math.round(bottom * (b - a)));
  }
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
  // 바닥 타일 줄: 앞으로 올수록 간격이 넓어지는 가로줄 + 화면 가운데로 모이는 세로줄 (월드 x에 붙음)
  const t = ctx.getTransform();
  const vanish = (ctx.canvas.width / 2 - t.e) / t.a; // 화면 가운데의 월드 x
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.strokeStyle = 'rgba(10,10,16,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let d = 0, k = 0; ; k++) {
    const y = Math.round(y0 + d);
    if (y >= y1) break;
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    d += 22 + k * 9;
  }
  const tile = 128;
  for (let wx = Math.floor((x0 - 400) / tile) * tile; wx < x1 + 400; wx += tile) {
    const top = vanish + (wx - vanish) * 0.62;
    if (Math.max(top, wx) < x0 || Math.min(top, wx) > x1) continue;
    ctx.moveTo(top, y0);
    ctx.lineTo(wx, y1);
  }
  ctx.stroke();
  ctx.restore();
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

// ── 소품 그림 (물건 모음 → objects/<장소>_objects_N). 회색 상자 대신. 도트 1px = 화면 2px, 발(아래 가운데)을 바닥 y에.
type ObjRef = [string, number] | [string, number, string, number] | null; // [장소, 번호] 또는 둘을 나란히, null = 그리지 않음(벽 그림에 이미 있음)

const BY_LABEL: [RegExp, ObjRef][] = [
  [/자판기/, ['lobby', 3]], [/소파/, ['lobby', 2]], [/정수기/, ['lobby', 5]], [/화분/, ['lobby', 4]], [/우산/, ['el_hall', 3]],
  [/게시판|표지|안내|액자|점수판|번호표|점검표|목표|시계|사진/, ['lobby', 6]],
  [/책장/, ['hq_jaemtri', 9]], [/그릇|선반/, ['hq_pantry', 8]], [/카펫/, ['apt', 4]], [/형광등|블라인드/, ['chase', 8]], [/의자/, ['chase', 2]],
  [/배관/, ['service', 8]], [/캐비닛|틈새|셔터/, ['chase', 6]], [/문짝|잠긴 문|문틀|방화문/, ['chase', 1]], [/신발장/, ['apt', 2]],
  [/덮인 가구|벽지|손자국/, ['apt', 7]], [/냉장고/, ['hq_pantry', 1]], [/텔레비전/, ['apt', 5]], [/사물함/, ['hq_workshop', 3]], [/밥상/, ['apt', 3]],
];
const DOOR: Record<string, number> = { apt: 1, chase: 1, lobby: 9, test: 9, hq_office: 9, hq_workshop: 9, hq_pantry: 9 };
const BY_KIND: Record<string, ObjRef> = {
  elevator: ['el_hall', 1, 'el_hall', 2], chasedoor: ['chase', 1], servicedoor: ['hq_workshop', 9], hatch: ['service', 9], shutter: ['chase', 6],
  table: ['apt', 3], switch: ['test', 3], checklist: ['lobby', 6], sign: ['lobby', 6], symbol: null, goalwall: ['lobby', 6], belonging: ['service', 6],
  // 승강기 안: 거울·버튼판은 벽 그림에 있다. 상호작용 자리는 그림 없이 (가까이 가면 엔진이 안내)
  mirror: null, panel: null, button: null, getoff: null, greet: null, close: null, mark: null, b12: null,
};

function objImage(place: string, n: number): HTMLImageElement | null {
  return image(place, `objects/${place}_objects_${n}`);
}

function drawObj(ctx: CanvasRenderingContext2D, place: string, n: number, x: number, y: number): number {
  const im = objImage(place, n);
  if (!im) return 0;
  ctx.drawImage(im, Math.round(x - im.width), Math.round(y - im.height * 2), im.width * 2, im.height * 2);
  return im.width * 2;
}

/** 소품 하나를 그림으로. true면 처리됨(그렸거나, 그리지 않는 게 맞는 자리). false면 그림이 아직 없어 부른 쪽 대역. */
export function drawPropArt(ctx: CanvasRenderingContext2D, kind: string, label: string | undefined, sx: number, y: number, floorType?: string): boolean {
  let ref: ObjRef | undefined;
  if (kind === 'door') {
    const p = placeFor('floor', floorType, '');
    ref = [p, DOOR[p] ?? 0] as ObjRef;
    if (!DOOR[p]) ref = ['chase', 1];
  } else if (kind in BY_KIND) ref = BY_KIND[kind];
  else if (label) ref = BY_LABEL.find(([re]) => re.test(label))?.[1];
  if (ref === undefined && kind === 'prop') ref = ['chase', 5];
  if (ref === undefined) return false;
  if (ref === null) return true;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  let ok = true;
  if (ref.length === 4) {
    const a = objImage(ref[0], ref[1]),
      b = objImage(ref[2], ref[3]);
    if (a && b) {
      ctx.drawImage(a, Math.round(sx - a.width * 2), Math.round(y - a.height * 2), a.width * 2, a.height * 2);
      ctx.drawImage(b, Math.round(sx), Math.round(y - b.height * 2), b.width * 2, b.height * 2);
    } else ok = false;
  } else ok = drawObj(ctx, ref[0], ref[1], sx, y) > 0;
  ctx.restore();
  return ok;
}
