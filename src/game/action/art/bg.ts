// 배경 그림 (docs/GPT요청_게임배경.md → tools/bg_pixelize.py → game-src/art/bg/dot).
// 시연판은 window.__GOEI_BG_ART__에 내장. 그림이 없는 장소는 false를 돌려주고 부른 쪽이 단색 대역을 그린다.
// 도트 1px = 화면 2px. 벽 칸 320×220 도트 = 화면 640×440, 바닥 무늬 128 도트.

import { HQ_SCENES } from '../hq/map';
import { HQ_WALL_DECO } from '../hq/wallDeco';

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
/** 층 벽 그림의 빈 명패 (도트 x0, y0, x1, y1): 장소에 맞는 방 이름·호수를 적는다 (검수 12-1: 빈 회색 명패). */
const FLOOR_PLATES: Record<string, [number, number, number, number][]> = {
  lobby_wall_3: [[45, 79, 63, 91], [262, 79, 282, 91]],
  apt_wall_1: [[95, 40, 120, 48]],
  apt_vacant_wall_1: [[95, 40, 120, 48]],
  silent_wall_3: [[140, 30, 180, 37]],
};
/** 방 이름 → 명패 그림 번호 (plates_objects: 1 공구 2 책 3 침대 4 회의 5 상자 6 전화 7 십자 8 열쇠 9 아파트 호수판) */
function plateFor(room: string): number {
  if (/^\d+$/.test(room)) return 9;
  const t: [RegExp, number][] = [[/기계|정비|보급|공방/, 1], [/자료|서고|열람|고문서|연구|감정/, 2], [/숙직|의무/, 3], [/회의|면담|대응|팀|사무/, 4], [/창고|격리/, 5], [/상담|통신/, 6], [/의무|치료/, 7], [/관리|부장|별관|실장/, 8]];
  return t.find(([re]) => re.test(room))?.[1] ?? 4;
}
/** 명패 그림을 빈 명패 칸(x, y, w, h 화면 px) 가운데에, 다른 그림과 같은 도트 크기(1도트 = 2px)로 덮는다 */
function drawPlate(ctx: CanvasRenderingContext2D, room: string, x: number, y: number, w: number, h: number) {
  const im = objImage('plates', plateFor(room));
  if (!im) return;
  const k = 2;
  const dw = im.width * k,
    dh = im.height * k;
  ctx.drawImage(im, Math.round(x + (w - dw) / 2), Math.round(y + (h - dh) / 2), dw, dh);
}

const PLATE_NAMES: Record<string, string[]> = {
  lobby: ['관리실', '자료실', '숙직실', '기계실', '상담실', '회의실', '창고'],
  apt: ['301', '302', '303', '304', '404', '305'],
  apt_vacant: ['501', '502', '503', '504'],
  silent: ['열람실', '서고', '별관', '고문서실'],
};

// 층마다 벽·바닥 색조를 조금씩 바꾼다: L1·L2·L3가 같은 복도로 보이지 않게 (독립 검수: 층별 타일셋 동일 반복).
// ctx.filter는 iOS Safari에 없으므로 그림마다 한 번 픽셀 색을 곱해 캐시한다.
let tone = 0;
const TONES: [number, number, number, number][] = [
  [1, 1, 1, 0],
  [1.06, 0.98, 0.84, 6], // 누런 낡은 층
  [0.86, 1.0, 0.94, 0], // 푸른빛 도는 녹색 층
  [0.92, 0.9, 1.08, -4], // 차가운 보랏빛 층
];
const toned = new Map<string, HTMLCanvasElement>();
/** 0이면 원래 색. 층 깊이를 넣는다 (그리기 전에 한 번) */
export function setFloorTone(depth: number) {
  // 시작 홀(승강기 벽)은 층마다 같은 그림이라 색조를 층마다 돌린다 (독립 검수 fb99e85: L1~L3 시작 화면이 같음)
  tone = depth > 0 ? (depth - 1) % TONES.length : 0;
}
function tonedImage(key: string, im: HTMLImageElement): CanvasImageSource {
  if (!tone || typeof document === 'undefined') return im;
  const k = `${key}#${tone}`;
  let c = toned.get(k);
  if (!c) {
    c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    const [r, gg, b, add] = TONES[tone];
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = Math.min(255, d.data[i] * r + add);
      d.data[i + 1] = Math.min(255, d.data[i + 1] * gg + add);
      d.data[i + 2] = Math.min(255, d.data[i + 2] * b + add);
    }
    g.putImageData(d, 0, 0);
    toned.set(k, c);
  }
  return c;
}

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
    const im0 = image(place.split(':')[0], names[(k + (hash(place) % names.length)) % names.length]);
    if (!im0) {
      ctx.restore();
      return false;
    }
    const im = tonedImage(`${place}/${names[(k + (hash(place) % names.length)) % names.length]}`, im0);
    const bx = x + i * bw;
    if (flip) {
      ctx.save();
      ctx.translate(bx + bw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(im, 0, 0, bw, wallBottom);
      ctx.restore();
    } else ctx.drawImage(im, bx, 0, bw, wallBottom);
    const name = names[(k + (hash(place) % names.length)) % names.length];
    (FLOOR_PLATES[name] ?? []).forEach(([px0, py0, px1, py1], j) => {
      // 빈 명패 자리에 GPT 명패 그림(방 기호, 보강 2번)을 붙인다. 글씨는 쓰지 않는다
      const list = PLATE_NAMES[place.split(':')[0]] ?? PLATE_NAMES.lobby;
      const room = list[hash(`${place}:${Math.round(bx)}:${j}`) % list.length];
      const kx = bw / 320,
        ky = wallBottom / 220;
      const x0 = flip ? bx + (320 - px1) * kx : bx + px0 * kx;
      drawPlate(ctx, room, x0, py0 * ky, (px1 - px0) * kx, (py1 - py0) * ky);
    });
  }
  wallLight(ctx, x, w, wallBottom);
  ctx.restore();
  return true;
}

/** 벽 그림 속 바닥에 닿는 문·가구 자리 (그림 px, 그림 폭 320 기준). 벽에 붙는 소품이 이 앞을 가리지 않게 쓴다 (검수 12-2). */
const WALL_SOLID: Record<string, [number, number][]> = {
  apt_wall_1: [[68, 144]], apt_wall_2: [[196, 282]], apt_wall_3: [[160, 320]], apt_wall_4: [[20, 185], [210, 270]],
  apt_red_wall_1: [[68, 148]], apt_red_wall_2: [[68, 142]], apt_vacant_wall_1: [[68, 142], [165, 280]], apt_vacant_wall_2: [[68, 142], [158, 205]],
  chase_wall_1: [[118, 200]], chase_wall_4: [[40, 122]], dark_wall_2: [[0, 150], [200, 278]], dark_wall_3: [[22, 90]],
  deep_wall_1: [[114, 205]], deep_wall_2: [[20, 240]], deep_wall_3: [[88, 140]], el_car_wall_4: [[75, 235]],
  el_hall_wall_1: [[108, 212]], el_hall_wall_3: [[110, 210]], el_hall_wall_4: [[112, 190]],
  guardian_guard_wall_2: [[180, 300]], guardian_legs_wall_2: [[120, 230]],
  lobby_wall_2: [[65, 255]], lobby_wall_3: [[62, 145], [165, 250]], lobby_wall_4: [[38, 108]],
  puzzle_wall_1: [[18, 105], [215, 305]], puzzle_wall_3: [[40, 95], [200, 275]], puzzle_wall_4: [[55, 145]],
  service_wall_2: [[0, 160]], service_wall_3: [[112, 205]], service_wall_4: [[55, 125]],
  silent_wall_2: [[228, 282]], silent_wall_3: [[112, 195]], silent_wall_4: [[25, 275]], test_wall_3: [[70, 250]],
};

/** 벽에 걸린 게시판·액자·창·표지(도트 x 구간). 입간판·소품이 그 앞을 가리지 않게 (검수 14-1). */
const WALL_DECO: Record<string, [number, number][]> = {
  lobby_wall_4: [[122, 212], [222, 290]],
  apt_wall_1: [[146, 182], [188, 272]], apt_wall_2: [[85, 170]], apt_wall_3: [[32, 136]],
  chase_wall_2: [[35, 285]], chase_wall_3: [[65, 255]], chase_wall_4: [[140, 282]],
  dark_wall_3: [[95, 285]], dark_wall_4: [[40, 135]], deep_wall_4: [[30, 285]],
  puzzle_wall_1: [[118, 200]], puzzle_wall_2: [[30, 280]], puzzle_wall_3: [[28, 180]], puzzle_wall_4: [[170, 255]],
  silent_wall_3: [[15, 100], [230, 315]], silent_wall_4: [[25, 285]], test_wall_1: [[50, 268]], test_wall_2: [[45, 275]],
};

/** drawWallCell과 같은 칸 고르기로, 조각(x, w) 벽 그림 속 문·가구가 차지한 월드 x 구간들 */
export function wallSolidSpans(place: string, x: number, w: number, flip: boolean, table: Record<string, [number, number][]> = WALL_SOLID): [number, number][] {
  const names = walls(place);
  if (!names.length) return [];
  const bays = Math.max(1, Math.round(w / 640));
  const bw = w / bays;
  const out: [number, number][] = [];
  for (let i = 0; i < bays; i++) {
    const k = Math.round((x + i * bw) / 640);
    const name = names[(k + (hash(place) % names.length)) % names.length];
    const bx = x + i * bw,
      sc = bw / 320;
    for (const [a, b] of table[name] ?? []) out.push(flip ? [bx + bw - b * sc, bx + bw - a * sc] : [bx + a * sc, bx + b * sc]);
  }
  return out;
}

/** 벽 그림 속 게시판·액자·창이 차지한 월드 x 구간들 */
export function wallDecoSpans(place: string, x: number, w: number, flip: boolean): [number, number][] {
  return wallSolidSpans(place, x, w, flip, WALL_DECO);
}

/** 벽 명암 단계: 천장 쪽 두 단, 걸레받이 쪽 한 단을 어둡게 (부드러운 그라데이션 대신 도트처럼 끊어진 띠). */
function wallLight(ctx: CanvasRenderingContext2D, x: number, w: number, bottom: number) {
  // 천장 쪽 그늘과 걸레받이 그늘: 띠 세 겹은 무늬처럼 보여서(불합격 4) 매끈한 그라데이션으로
  const top = ctx.createLinearGradient(0, 0, 0, bottom * 0.32);
  top.addColorStop(0, 'rgba(8,8,14,0.42)');
  top.addColorStop(1, 'rgba(8,8,14,0)');
  ctx.fillStyle = top;
  ctx.fillRect(x, 0, w, Math.round(bottom * 0.32));
  const foot = ctx.createLinearGradient(0, bottom * 0.9, 0, bottom);
  foot.addColorStop(0, 'rgba(8,8,14,0)');
  foot.addColorStop(1, 'rgba(8,8,14,0.34)');
  ctx.fillStyle = foot;
  ctx.fillRect(x, Math.round(bottom * 0.9), w, Math.round(bottom * 0.1) + 1);
}

/** 무늬 자체가 바둑판·타일 줄인 바닥 (겹쳐 긋는 줄 생략). */
const OWN_GRID = new Set(['hq_pantry', 'hq_street', 'puzzle']);

/** 바닥 띠(y0~y1)를 무늬로 깐다. 무늬는 월드 x에 붙고, 깊이는 모이는 줄과 뒤쪽 어둡게로 읽힌다. */
export function drawFloor(ctx: CanvasRenderingContext2D, place: string, x0: number, x1: number, y0: number, y1: number): boolean {
  place = place.split(':')[0];
  // 탕비실 바닥 그림은 도트화하면 투명 체커처럼 보인다 (독립 검수 fb99e85): 복도 바닥을 빌린다
  if (place === 'hq_pantry') place = 'hq_corridor';
  if (!Object.keys(pack()[place] ?? {}).some((n) => n.endsWith('_floor')) && FLOOR_ALT[place]) place = FLOOR_ALT[place];
  const name = Object.keys(pack()[place] ?? {}).find((n) => n.endsWith('_floor'));
  const im = name ? image(place, name) : null;
  if (!im) return false;
  const key = `${place}/${name}#${tone}`;
  let pat = patterns.get(key);
  if (pat === undefined) {
    pat = ctx.createPattern(tonedImage(`${place}/${name}`, im), 'repeat');
    patterns.set(key, pat);
  }
  if (!pat) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // 무늬는 한 배율(가로 2, 세로 1)로 통째로 깐다: 줄마다 배율을 바꾸면 바둑판이 계단처럼 어긋난다(모아레, 불합격 4)
  pat.setTransform(new DOMMatrix([2, 0, 0, 1, 0, y0]));
  ctx.fillStyle = pat;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // 바닥 타일 줄: 앞으로 올수록 간격이 넓어지는 가로줄 + 화면 가운데로 모이는 세로줄 (월드 x에 붙음)
  // 바둑판처럼 무늬에 줄이 이미 있는 바닥은 줄을 겹쳐 긋지 않는다
  const t = ctx.getTransform();
  const ownGrid = OWN_GRID.has(place);
  const vanish = (ctx.canvas.width / 2 - t.e) / t.a; // 화면 가운데의 월드 x
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  ctx.strokeStyle = 'rgba(10,10,16,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let d = 0, k = 0; !ownGrid; k++) {
    const y = Math.round(y0 + d);
    if (y >= y1) break;
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    d += 22 + k * 9;
  }
  const tile = 128;
  for (let wx = Math.floor((x0 - 400) / tile) * tile; !ownGrid && wx < x1 + 400; wx += tile) {
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
export function placeFor(where: string, floorType: string | undefined, ref: string, sub?: string | null, depth?: number): string {
  // 재현의 층 하위 변형(붉은 벽·빈집)은 자기 벽 그림 (바닥은 아파트 바닥, FLOOR_ALT)
  if (where === 'floor' && floorType === 'replica' && sub && !ref.startsWith('room:') && walls(`apt_${sub}`).length) return `apt_${sub}`;
  if (where === 'car') return 'el_car';
  if (where === 'service' || ref === 'room:attic') return 'service';
  if (ref === 'room:elevator_hall' || ref === 'room:exit_hall') return 'el_hall';
  if (ref === 'room:guardian_room') return `guardian:${({ chase: 'legs', replica: '405' } as Record<string, string>)[floorType ?? ''] ?? 'guard'}`;
  if (ref === 'room:trial_goal') return 'test';
  // 침묵·어둠·퍼즐·심층은 자기 그림(GPT요청_게임배경_층별)이 들어오면 그것, 아직이면 비슷한 층을 빌린다
  const t = floorType ?? '';
  if (['silent', 'dark', 'puzzle', 'deep'].includes(t) && walls(t).length) return t;
  // 로비 층이 이어지면 같은 복도로 보인다: 깊이마다 다른 벽 묶음 (독립 검수: L1·L2·L3 동일, 색조만으로는 불가)
  if (where === 'floor' && t === 'lobby' && depth && depth > 1) {
    const alt = ['lobby', 'el_hall', 'chase'][(depth - 1) % 3];
    if (walls(alt).length) return alt;
  }
  return ({ lobby: 'lobby', chase: 'chase', trial: 'test', replica: 'apt', puzzle: 'test', silent: 'chase', dark: 'chase', deep: 'service' } as Record<string, string>)[t] ?? 'lobby';
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

/** 본부 장면 id·look → 그림 장소 (hq/map.ts). 옛 본부 장소 id도 받는다. */
export const HQ_PLACE: Record<string, string> = {
  street: 'hq_street', lobby: 'hq_lobby', f2: 'hq_corridor', corridor: 'hq_corridor', clinic: 'hq_clinic', interview: 'hq_interview',
  office: 'hq_office', jaemtri: 'hq_jaemtri', chief: 'hq_chief', pantry: 'hq_pantry', supply: 'hq_supply', training: 'hq_training',
  b2: 'hq_containment', containment: 'hq_containment', appraisal: 'hq_appraisal', lab: 'hq_lab', tooth: 'hq_tooth', pasta: 'hq_pasta', gallery: 'chase',
};

/** 본부 장면에서 벽 칸을 함께 쓰는 장소 (같은 방 마감). */
const HQ_WALLS: Record<string, string[]> = {
  hq_office: ['hq_office', 'hq_jaemtri'],
  hq_supply: ['hq_supply', 'hq_workshop'],
  hq_lobby: ['hq_lobby', 'lobby:lobby_wall_1'],
  // 문 그림이 없는 방은 이웃 방의 문 칸을 빌린다: 엔진이 그린 문이 책장·창·게시판을 덮지 않게 (통합 검수 23, tests/hq-walls.test.mjs)
  hq_chief: ['hq_chief', 'hq_office:hq_office_wall_3'],
  hq_interview: ['hq_interview', 'hq_office:hq_office_wall_3'],
  hq_appraisal: ['hq_appraisal', 'hq_containment:hq_containment_wall_3'],
  hq_lab: ['hq_lab', 'hq_jaemtri:hq_jaemtri_wall_4', 'hq_containment:hq_containment_wall_1'],
  hq_training: ['hq_training', 'hq_workshop:hq_workshop_wall_3'],
  hq_tooth: ['hq_tooth', 'hq_containment:hq_containment_wall_4'],
  hq_pasta: ['hq_pasta', 'hq_pantry:hq_pantry_wall_4'],
};
/** 바닥 그림이 없는 장소가 빌리는 바닥. */
const FLOOR_ALT: Record<string, string> = {
  hq_chief: 'hq_office', hq_interview: 'hq_office', hq_jaemtri: 'hq_office', hq_lobby: 'lobby', hq_supply: 'hq_workshop',
  hq_appraisal: 'hq_containment', hq_lab: 'hq_clinic', hq_tooth: 'hq_containment', apt_red: 'apt', apt_vacant: 'apt',
};
/** 문이 그려진 벽 칸: 문 구멍 x 범위(도트)와 종류. 엔진 문 자리에 그 칸을 맞춰 그리면 문이 따로 그려지지 않는다. */
const DOOR_WALLS: Record<string, [number, number, 'door' | 'stairs' | 'elevator' | 'main']> = {
  lobby_wall_1: [140, 180, 'main'],
  hq_street_wall_1: [130, 190, 'door'], hq_street_wall_3: [204, 267, 'door'], hq_lobby_wall_2: [130, 238, 'stairs'],
  hq_corridor_wall_1: [114, 206, 'elevator'], hq_corridor_wall_3: [128, 205, 'door'], hq_corridor_wall_4: [124, 196, 'door'],
  hq_clinic_wall_4: [77, 163, 'door'], hq_office_wall_3: [126, 194, 'door'], hq_pantry_wall_2: [62, 139, 'door'], hq_pantry_wall_4: [122, 198, 'door'],
  hq_workshop_wall_1: [29, 101, 'door'], hq_workshop_wall_3: [115, 206, 'door'], hq_supply_wall_2: [123, 215, 'door'],
  hq_containment_wall_1: [139, 216, 'door'], hq_containment_wall_3: [116, 204, 'door'], hq_containment_wall_4: [111, 211, 'door'],
};
/** 본부에서 쓰지 않는 벽 칸 (문이 둘이라 엔진 문과 맞출 수 없음, 막다른 골목 입구). */
const HQ_SKIP = new Set(['hq_office_wall_5', 'hq_street_wall_4']);
/** 특정 문에 쓸 벽 칸: 장면:문 → 그림 이름. */
const DOOR_FOR: Record<string, string> = {
  'street:main': 'hq_street_wall_1', 'street:pasta': 'hq_street_wall_3', 'lobby:main': 'lobby_wall_1',
  // 2층 복도: 의무실은 흰 여닫이문, 면담실은 나무문 (같은 문 둘이 나란하면 칸막이처럼 보인다)
  'f2:clinic': 'hq_corridor_wall_4', 'f2:interview': 'hq_corridor_wall_3',
};
/** 문 옆 빈 명패 (도트 x0, y0, x1, y1): 문이 이어지는 방 기호 명패를 붙인다. */
const PLATES: Record<string, [number, number, number, number]> = {
  hq_corridor_wall_3: [220, 52, 247, 63], hq_corridor_wall_4: [209, 62, 236, 72],
};
const SCENE_NAME = new Map(HQ_SCENES.map((s) => [s.id as string, s.name]));

function doorType(kind: string): 'door' | 'stairs' | 'elevator' {
  return kind.startsWith('stairs') ? 'stairs' : kind === 'elevator' ? 'elevator' : 'door';
}

/** 벽 칸 그림 없이 엔진이 덧그리는 문의 반폭(화면 px): 엘리베이터는 2층 복도 엘리베이터 조각, 계단은 로비 계단 물건 그림. */
function overlayHalf(kind: string, k: number): number {
  if (kind === 'elevator') return ((213 - 108) * k) / 2;
  const ref = BY_KIND[`hq_${kind}`];
  const im = ref ? objImage(ref[0], ref[1]) : null;
  if (im) return im.width;
  return kind.startsWith('stairs') ? 140 : 0;
}
/** 민벽 띠: 채움 칸 그림 중 장식이 없는 가장 넓은 도트 구간 [장소, 그림, [u0, u1]] (hq/wallDeco.ts) */
function plainStrip(fill: [string, string][], m = 4): [string, string, [number, number]] | null {
  let best: [string, string, [number, number]] | null = null;
  for (const [p, n] of fill) {
    const deco = HQ_WALL_DECO[n];
    if (!deco) continue;
    const hole = DOOR_WALLS[n];
    let cur = 6;
    // 문이 그려진 칸이면 문 구멍(+문틀)도 장식처럼 피한다
    for (const [a, b] of [...deco, ...(hole ? [[hole[0] - 14, hole[1] + 14] as [number, number]] : []), [314, 320] as [number, number]].sort((u, v) => u[0] - v[0])) {
      if (a - m > cur + m && (!best || a - cur - 2 * m > best[2][1] - best[2][0])) best = [p, n, [cur + m, a - m]];
      cur = Math.max(cur, b);
    }
  }
  return best && best[2][1] - best[2][0] >= 6 ? best : null;
}

/** 민벽 띠 고르기: 같은 방 칸에서 넉넉히 → 좁게(장식 사이 틈) → 문 칸을 빌린 방이면 빌린 칸의 민벽 */
const plainOf = (fill: [string, string][], cands: [string, string][]) => plainStrip(fill) ?? plainStrip(fill, 1) ?? plainStrip(cands);

/**
 * 본부 장면 벽: 엔진 문 자리에 문이 그려진 벽 칸을 문 구멍이 맞게 놓고, 사이는 문 없는 칸으로 채운다.
 * 칸끼리 겹치면 가운데서 자르고 기둥을 세운다. 돌려주는 집합 = 벽 그림이 문을 대신한 문 id (엔진은 그 문을 그리지 않는다).
 */
export function drawHqWall(ctx: CanvasRenderingContext2D, place: string, sceneId: string, length: number, wallBottom: number, doors: { id: string; x: number; kind: string; to?: string }[]): Set<string> | null {
  const cands: [string, string][] = [];
  for (const src of HQ_WALLS[place] ?? [place]) {
    const [p, only] = src.split(':');
    for (const n of walls(p)) if ((!only || n === only) && !HQ_SKIP.has(n)) cands.push([p, n]);
  }
  if (!cands.length) return null;
  const plain = cands.filter(([, n]) => !DOOR_WALLS[n]);
  const fill = plain.length ? plain : cands;
  const k = wallBottom / 220; // 화면 px / 도트
  const bayW = 320 * k;
  type Piece = { p: string; n: string; x: number; a: number; b: number; door?: string; flip?: boolean; label?: string; blank?: [number, number] };
  const pieces: Piece[] = [];
  for (const d of [...doors].sort((a, b) => a.x - b.x)) {
    const want = DOOR_FOR[`${sceneId}:${d.id}`];
    // 정문은 정문 칸, 없으면 보통 문 칸. 보통 문은 정문 칸을 쓰지 않는다.
    const t = d.kind === 'main' && cands.some(([, n]) => DOOR_WALLS[n]?.[2] === 'main') ? 'main' : doorType(d.kind);
    const ok = cands.filter(([, n]) => DOOR_WALLS[n]?.[2] === t);
    const pick = ok.find(([, n]) => n === want) ?? ok[hash(`${sceneId}:${d.id}`) % Math.max(1, ok.length)];
    if (!pick) {
      // 문 칸이 없는 엘리베이터·계단: 그 뒤는 장식 없는 민벽으로 (게시판·소화전을 덮지 않게, 통합 검수 22·23)
      const half = overlayHalf(d.kind, k);
      const st = plainOf(fill, cands);
      if (half && st) pieces.push({ p: st[0], n: st[1], x: d.x - half - 12, a: d.x - half - 12, b: d.x + half + 12, blank: st[2] });
      continue;
    }
    const [x0, x1] = DOOR_WALLS[pick[1]];
    const bx = d.x - ((x0 + x1) / 2) * k;
    pieces.push({ p: pick[0], n: pick[1], x: bx, a: bx, b: bx + bayW, door: d.id, label: d.to && SCENE_NAME.get(d.to) });
  }
  // 벽에 붙은 가구(사물함 줄·책장·화이트보드…) 뒤도 민벽으로: 가구가 벽 그림 속 창·게시판을 반쯤 가리지 않게
  const sc = HQ_SCENES.find((x) => x.id === sceneId);
  const strip = plainOf(fill, cands);
  for (const t of sc?.things ?? []) {
    if (!t.wall || !strip) continue;
    const sz = propArtSize(t.kind, undefined);
    if (sz) pieces.push({ p: strip[0], n: strip[1], x: t.x - sz.w / 2 - 12, a: t.x - sz.w / 2 - 12, b: t.x + sz.w / 2 + 12, blank: strip[2] });
  }
  pieces.sort((u, v) => u.a - v.a);
  // 겹치는 문 칸은 두 문 사이 가운데서 자른다 (문 구멍은 남는다). 민벽 조각과 겹치면 민벽을 남긴다
  for (let i = 1; i < pieces.length; i++) {
    const L = pieces[i - 1], R = pieces[i];
    if (L.b <= R.a) continue;
    if (R.blank && !L.blank) L.b = R.a;
    else if (L.blank && !R.blank) R.a = L.b;
    else {
      const m = (L.b + R.a) / 2;
      L.b = m;
      R.a = m;
    }
  }
  // 빈 곳은 문 없는 칸으로
  const fills: Piece[] = [];
  let cur = 0, idx = hash(sceneId);
  const gaps: [number, number][] = [];
  for (const pc of pieces) {
    if (pc.a > cur) gaps.push([cur, pc.a]);
    cur = Math.max(cur, pc.b);
  }
  if (cur < length) gaps.push([cur, length]);
  for (const [g0, g1] of gaps) {
    for (let x = g0; x < g1; x += bayW) {
      // 문 없는 칸이 적으면 번갈아 좌우를 뒤집어 같은 칸이 줄지어 보이지 않게
      const flip = fill.length < 3 && Math.floor(idx / fill.length) % 2 === 1;
      const [p, n] = fill[idx++ % fill.length];
      fills.push({ p, n, x, a: x, b: Math.min(x + bayW, g1), flip });
    }
  }
  // 칸 이음매·장면 끝에서 반쯤 잘리는 벽 장식(창·게시판 반쪽)은 통째로 민벽으로 덮는다 (통합 검수 23, tests/hq-walls.test.mjs)
  const plainSt = plainOf(fill, cands);
  if (plainSt) {
    for (const pc of [...fills, ...pieces]) {
      if (pc.blank) continue;
      let a = Math.max(pc.a, pc.x, 0),
        b = Math.min(pc.b, pc.x + bayW, length);
      const spans = (HQ_WALL_DECO[pc.n] ?? []).map(([u0, u1]) => (pc.flip ? [pc.x + bayW - u1 * k, pc.x + bayW - u0 * k] : [pc.x + u0 * k, pc.x + u1 * k])).sort((u, v) => u[0] - v[0]);
      for (const [d0, d1] of spans) {
        if (d1 <= a || d0 >= b || (d0 >= a - 1 && d1 <= b + 1)) continue;
        const blank = (x0: number, x1: number) => x1 - x0 > 1 && pieces.push({ p: plainSt[0], n: plainSt[1], x: x0, a: x0, b: x1, blank: plainSt[2] });
        if (d0 < a) {
          blank(a, Math.min(d1, b));
          a = Math.min(d1, b);
        } else {
          blank(Math.max(d0, a), b);
          b = Math.max(d0, a);
        }
      }
      pc.a = a;
      pc.b = b;
    }
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const covered = new Set<string>();
  for (const pc of [...fills, ...pieces]) {
    const im = image(pc.p, pc.n);
    if (!im) continue;
    if (pc.blank) {
      const [u0, u1] = pc.blank;
      ctx.drawImage(im, u0, 0, u1 - u0, im.height, pc.a, 0, pc.b - pc.a, wallBottom);
      continue;
    }
    const a = Math.max(pc.a, pc.x), b = Math.min(pc.b, pc.x + bayW);
    if (b <= a) continue;
    if (pc.flip) {
      // 뒤집힌 칸: 화면 구간 [a, b]는 그림에서 오른쪽 끝부터 잰 같은 폭
      ctx.save();
      ctx.translate(a + b, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(im, (pc.x + bayW - b) / k, 0, (b - a) / k, im.height, a, 0, b - a, wallBottom);
      ctx.restore();
    } else ctx.drawImage(im, (a - pc.x) / k, 0, (b - a) / k, im.height, a, 0, b - a, wallBottom);
    if (pc.door) covered.add(pc.door);
    const pl = PLATES[pc.n];
    if (pl && pc.label && pc.x + pl[0] * k >= a && pc.x + pl[2] * k <= b) {
      const [x0, y0, x1, y1] = pl;
      drawPlate(ctx, pc.label, pc.x + x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k);
    }
  }
  // 이 장소 벽 그림에 엘리베이터가 없으면 2층 복도 엘리베이터(문틀째)를 잘라 붙인다
  const el = image('hq_corridor', 'hq_corridor_wall_1');
  for (const d of doors) {
    if (d.kind !== 'elevator' || covered.has(d.id) || !el) continue;
    const [cx0, cy0, cx1, cy1] = [108, 23, 213, 218];
    const w = (cx1 - cx0) * k, h = (cy1 - cy0) * k;
    ctx.drawImage(el, cx0, cy0, cx1 - cx0, cy1 - cy0, Math.round(d.x - w / 2), Math.round(wallBottom - h - 2 * k), w, h);
    covered.add(d.id);
  }
  // 잘린 이음매에 기둥
  for (const pc of [...fills, ...pieces]) for (const e of [pc.a, pc.b]) if (e > 0 && e < length && (pc.blank || (e - pc.x > 2 && pc.x + bayW - e > 2))) seamPillar(ctx, e, wallBottom, 14);
  // 이웃 칸 끝 색이 크게 다르면(나무 책장 ↔ 크림 벽, 유리 ↔ 베이지) 기둥으로 갈라 이음매가 아니라 벽 모서리로 읽히게
  const all = [...fills, ...pieces].sort((u, v) => u.a - v.a);
  for (let i = 1; i < all.length; i++) {
    const L = all[i - 1], R = all[i];
    if (Math.abs(L.b - R.a) > 2 || R.a <= 0 || R.a >= length) continue;
    const cl = edgeColor(L.p, L.n, L.flip ? 'l' : 'r'), cr = edgeColor(R.p, R.n, R.flip ? 'r' : 'l');
    if (cl && cr && Math.abs(cl[0] - cr[0]) + Math.abs(cl[1] - cr[1]) + Math.abs(cl[2] - cr[2]) > 70) seamPillar(ctx, R.a, wallBottom, 30);
  }
  wallLight(ctx, 0, length, wallBottom);
  ctx.restore();
  return covered;
}

const edges = new Map<string, [number, number, number] | null>();
/** 벽 칸 왼쪽/오른쪽 끝 띠(16도트)의 평균 색 (벽 가운데 높이). */
function edgeColor(place: string, name: string, side: 'l' | 'r'): [number, number, number] | null {
  const key = `${place}/${name}/${side}`;
  if (edges.has(key)) return edges.get(key)!;
  const im = image(place, name);
  if (!im) return null;
  let out: [number, number, number] | null = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = 16;
    cv.height = 120;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(im, side === 'l' ? 8 : im.width - 24, 50, 16, 120, 0, 0, 16, 120);
    const d = g.getImageData(0, 0, 16, 120).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += d[i + c];
    const n = d.length / 4;
    out = [sum[0] / n, sum[1] / n, sum[2] / n];
  } catch {
    out = null;
  }
  edges.set(key, out);
  return out;
}

/** 장소가 바뀌는 이음매·잘린 칸 이음매의 기둥 (도트 마감: 어두운 몸통 + 밝은 모서리). */
export function seamPillar(ctx: CanvasRenderingContext2D, x: number, wallBottom: number, w = 36) {
  const x0 = Math.round(x - w / 2);
  // 기둥 양옆 그늘: 벽이 기둥 뒤로 꺾여 들어가는 것처럼 (색이 바로 맞붙어 보이지 않게)
  if (w >= 24) {
    const s = w * 2;
    for (const [from, to] of [[x0, x0 - s], [x0 + w, x0 + w + s]]) {
      const g = ctx.createLinearGradient(from, 0, to, 0);
      g.addColorStop(0, 'rgba(6,6,10,0.5)');
      g.addColorStop(1, 'rgba(6,6,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(from, to), 0, s, wallBottom);
    }
  }
  ctx.fillStyle = '#22262a';
  ctx.fillRect(x0, 0, w, wallBottom);
  ctx.fillStyle = '#3a4045';
  ctx.fillRect(x0 + 2, 0, Math.max(2, Math.round(w / 4)), wallBottom);
  ctx.fillStyle = '#121416';
  ctx.fillRect(x0 + w - 2, 0, 2, wallBottom);
  ctx.fillRect(x0, 0, 2, wallBottom);
  if (w >= 24) {
    // 걸레받이 받침
    ctx.fillStyle = '#2e3337';
    ctx.fillRect(x0 - 4, wallBottom - 18, w + 8, 18);
    ctx.fillStyle = '#121416';
    ctx.fillRect(x0 - 4, wallBottom - 18, w + 8, 2);
  }
}

// ── 소품 그림 (물건 모음 → objects/<장소>_objects_N). 회색 상자 대신. 도트 1px = 화면 2px, 발(아래 가운데)을 바닥 y에.
type ObjRef = [string, number] | [string, number, string, number] | null; // [장소, 번호] 또는 둘을 나란히, null = 그리지 않음(벽 그림에 이미 있음)

const FLOOR_LABEL: Record<string, [RegExp, [string, number]][]> = {
  silent: [[/괘종시계|시계/, ['silent', 1]], [/책장/, ['silent', 7]], [/그릇|선반/, ['silent', 5]], [/카펫/, ['silent', 4]], [/의자/, ['silent', 3]]],
  dark: [[/형광등/, ['dark', 2]], [/의자/, ['dark', 1]], [/배관/, ['dark', 3]], [/책상/, ['dark', 4]], [/상자/, ['dark', 5]]],
  puzzle: [[/거꾸로/, ['puzzle', 2]], [/액자/, ['puzzle', 1]], [/화분/, ['puzzle', 3]], [/표지/, ['puzzle', 4]]],
};

const BY_LABEL: [RegExp, ObjRef][] = [
  [/자판기/, ['lobby', 3]], [/소파/, ['lobby', 2]], [/정수기/, ['lobby', 5]], [/화분/, ['lobby', 4]], [/우산/, ['el_hall', 3]],
  [/옷걸이|외투/, ['props', 11]], [/대걸레|청소/, ['props', 15]], [/접이|쌓인 의자/, ['props', 16]], [/수레|카트/, ['props', 17]], [/고무나무/, ['props', 18]],
  [/게시판|표지|안내|액자|점수판|번호표|점검표|목표|시계|사진/, ['lobby', 6]],
  [/책장/, ['hq_jaemtri', 9]], [/그릇|선반/, ['hq_pantry', 8]], [/카펫/, ['apt', 4]], [/형광등|블라인드/, ['chase', 8]], [/의자/, ['chase', 2]],
  [/배관/, ['service', 8]], [/캐비닛|틈새|셔터/, ['chase', 6]], [/문짝|잠긴 문|문틀|방화문/, ['chase', 1]], [/신발장/, ['apt', 2]],
  [/덮인 가구|벽지|손자국/, ['apt', 7]], [/냉장고/, ['hq_pantry', 1]], [/텔레비전/, ['apt', 5]], [/사물함/, ['hq_workshop', 3]], [/밥상/, ['apt', 3]],
];
const DOOR: Record<string, number> = { apt: 1, chase: 1, lobby: 9, test: 9, hq_office: 9, hq_workshop: 9, hq_pantry: 9 };
const BY_KIND: Record<string, ObjRef> = {
  elevator: ['el_hall', 12], chasedoor: ['chase', 1], servicedoor: ['hq_workshop', 9],  shutter: ['chase', 6],
  table: ['apt', 3], switch: ['test', 3], checklist: ['lobby', 6], sign: ['lobby', 6], symbol: null, goalwall: ['lobby', 6], belonging: ['service', 6],
  item: ['service', 7], up: ['service', 9], down: ['service', 9], fall: ['service', 9], ladder_up: ['service', 1], ladder_down: ['service', 1],
  rope: ['service', 2], pack: ['service', 6], gear: ['service', 3], memo: ['lobby', 6], map: ['lobby', 6], intercom: ['test', 3],
  left: ['chase', 1], right: ['chase', 1], merchant: ['service', 7],
  // 승강기 안: 거울·버튼판은 벽 그림에 있다. 상호작용 자리는 그림 없이 (가까이 가면 엔진이 안내)
  // 본부 문(엔진 hub.ts가 hq_<문 종류>로 부른다): 벽 그림에 문이 없을 때 엘리베이터·계단 그림
  hq_stairs_up: ['hq_lobby', 6], hq_stairs_down: ['hq_lobby', 9],
  mirror: null, panel: null, button: null, getoff: null, greet: null, close: null, mark: null, b12: null,
  // 본부 평면도(hq/map.ts) 물건. 창문·블라인드처럼 벽에 붙은 것은 벽 그림에 있다.
  window: null, blinds: null, glass_door: null, hydrant_box: null, kitchen_window: null, mailboxes: null, coat_chair: null,
  streetlamp: ['hq_street', 1], bike: ['hq_street', 7],
  guard_desk: ['hq_lobby', 1], plant: ['hq_lobby', 5],
  desk_monitors: ['hq_jaemtri', 1], cardigan_chair: ['hq_office', 12], condensed_milk_coffee: ['hq_office', 16], mix_coffee_box: ['hq_office', 17],
  whiteboard: ['hq_office', 13], desk_row: ['hq_office', 10, 'hq_office', 11], copier: ['hq_office', 14], sofa: ['hq_office', 4],
  meeting_table: ['hq_office', 15], paper_pile: ['hq_office', 18], chief_desk: ['hq_chief', 1], bookshelf: null, chair: ['hq_interview', 3],
  bed: ['hq_clinic', 1], iv_stand: ['hq_clinic', 2], curtain: ['hq_clinic', 3], med_cabinet: null, recorder: ['hq_interview', 4],
  dummy: ['hq_training', 1], mat: null, record_board: null, shooting_lane: null,
  showcase: ['hq_containment', 1], security_gate: null, warning_light: null,
  appraisal_bench: ['hq_appraisal', 1], gloves: ['hq_appraisal', 3], hologram: ['hq_appraisal', 2], drawers: ['hq_appraisal', 9],
  lab_bench: ['hq_lab', 1], glass_cell: null, server_rack: ['hq_lab', 9],
  tooth_tree: ['hq_tooth', 1], cage: null, feed_slot: null, long_table: ['hq_pasta', 1],
  coffee_machine: ['hq_pantry', 2], fridge: ['hq_pantry', 1], table_small: ['hq_pantry', 3], sink_counter: ['hq_pantry', 8],
  locker_row: ['hq_supply', 4], workbench: ['hq_workshop', 1], cargo_cart: ['hq_supply', 3], shelf: ['hq_supply', 1],
};

/** 바닥에 서는 층 소품 (props_objects_2: 10 정수기 11 옷걸이 12 우산꽂이 14 신발장 15 대걸레 16 접이 의자 17 짐수레 18 화분, 13 소화기함은 벽) */
const PROPS_2 = [10, 11, 12, 14, 15, 16, 17, 18];
/** 표지판 그림 번호 (signs_objects: 1 층 안내도 2 비상구(벽) 3 미끄럼 주의 4 엘리베이터 안내 5 점검표 6 진입 금지 7 코르크 게시판 8 나무 게시판 9 재떨이) */
function signFor(kind: string, label: string, h: number): number {
  if (kind === 'checklist' || /점검/.test(label)) return 5;
  if (/규칙|금지/.test(label)) return 6;
  if (/표지|주의|미끄/.test(label)) return 3;
  if (/순서|게시판|사진|분실/.test(label)) return 7;
  if (kind === 'goalwall' || /목표|시험|점수|긁힌|액자|시계/.test(label)) return 8;
  if (kind === 'map' || /지도|안내도/.test(label)) return 1;
  return [1, 4, 7][h % 3];
}

/** 벽 높이(문 위)에 다는 표지: 바닥 발 y와 상관없이 화면 y = WALL_HIGH 에 아래 끝을 둔다 */
export const WALL_HIGH = 104;
export function isHighSign(kind: string, label: string | undefined): boolean {
  return kind === 'sign' && !!label?.includes('읽어야');
}

/** 물건 그림이 묶음에 있는가 (그림이 아직 안 읽혔어도: 층 배치 때와 그릴 때 같은 그림을 고르게) */
function hasObj(place: string, n: number): boolean {
  return !!pack()[place]?.[`objects/${place}_objects_${n}`];
}

function objImage(place: string, n: number): HTMLImageElement | null {
  return image(place, `objects/${place}_objects_${n}`);
}

function drawObj(ctx: CanvasRenderingContext2D, place: string, n: number, x: number, y: number): number {
  const im = objImage(place, n);
  if (!im) return 0;
  ctx.drawImage(im, Math.round(x - im.width), Math.round(y - im.height * 2), im.width * 2, im.height * 2);
  return im.width * 2;
}

/** 소품이 쓸 물건 그림 [장소, 번호]. undefined = 그림 없음(부른 쪽 대역), null = 그리지 않음. */
export function propArtRef(kind: string, label: string | undefined, sx: number, floorType?: string): ObjRef | undefined {
  let ref: ObjRef | undefined;
  if (kind === 'door') {
    const p = placeFor('floor', floorType, '');
    ref = [p, DOOR[p] ?? 0] as ObjRef;
    if (!DOOR[p]) ref = ['chase', 1];
  } else if (kind in BY_KIND) ref = BY_KIND[kind];
  else if (label) {
    // 층마다 자기 물건 그림이 있으면 먼저 (침묵·어둠·퍼즐·심층)
    const own = FLOOR_LABEL[floorType ?? '']?.find(([re]) => re.test(label))?.[1];
    if (own && hasObj(own[0], own[1])) ref = own;
    else ref = BY_LABEL.find(([re]) => re.test(label))?.[1];
  }
  // 이름으로 못 고른 꾸밈 소품: 이름마다 정해진 그림 하나 (화면 x로 고르면 걸을 때 그림이 바뀌고 막는 폭도 틀어진다)
  const h = hash(`${kind}:${label ?? ''}`);
  if (ref === undefined && kind === 'prop')
    ref = floorType === 'deep' && hasObj('deep', 1) ? ['deep', 1 + (h % 9)] : pack().props ? ['props', PROPS_2[h % PROPS_2.length]] : ['chase', 5];
  // 갈림길 표지: 문이 줄지은 벽 앞에 세울 자리가 없다 → 문 위 벽에 다는 비상구형 표지 (WALL_HIGH, 바닥을 차지하지 않음)
  if (isHighSign(kind, label)) ref = pack().signs ? ['signs', 2] : ref;
  // 서 있는 판(옛 로비 6번 흰 판 + 코드 포스터) → GPT 표지판 그림 (보강 1번)
  if (ref && ref.length === 2 && ref[0] === 'lobby' && ref[1] === 6 && pack().signs) ref = ['signs', signFor(kind, label ?? '', h)];
  void sx;
  return ref;
}

/** 소품 그림의 화면 크기 (그림이 아직 안 읽혔으면 null). 몸 막기 폭·높이에 쓴다 */
export function propArtSize(kind: string, label: string | undefined, floorType?: string): { w: number; h: number } | null {
  const r = propArtRef(kind, label, 0, floorType);
  if (!r) return null;
  const a = objSize(r[0], r[1]);
  if (!a) return null;
  if (r.length === 4) {
    const b = objSize(r[2], r[3]);
    return b ? { w: (a.w + b.w) * 2, h: Math.max(a.h, b.h) * 2 } : null;
  }
  return { w: a.w * 2, h: a.h * 2 };
}

/** 물건 그림 도트 크기: 그림이 읽히기 전(층 배치 때)에도 PNG 머리(IHDR)에서 바로 읽는다 */
const sizeCache = new Map<string, { w: number; h: number } | null>();
function objSize(place: string, n: number): { w: number; h: number } | null {
  const key = `${place}/${n}`;
  if (sizeCache.has(key)) return sizeCache.get(key)!;
  const src = pack()[place]?.[`objects/${place}_objects_${n}`];
  let out: { w: number; h: number } | null = null;
  const m = typeof src === 'string' ? /^data:image\/png;base64,(.{32})/.exec(src) : null;
  if (m && typeof atob === 'function') {
    const b = atob(m[1]);
    const u = (i: number) => ((b.charCodeAt(i) << 24) | (b.charCodeAt(i + 1) << 16) | (b.charCodeAt(i + 2) << 8) | b.charCodeAt(i + 3)) >>> 0;
    out = { w: u(16), h: u(20) };
  }
  sizeCache.set(key, out);
  return out;
}

/** 이 소품이 서 있는 판(표지판 그림)으로 그려지는가 */
export function isStandBoard(kind: string, label: string | undefined, floorType?: string): boolean {
  const r = propArtRef(kind, label, 0, floorType);
  return !!r && r.length === 2 && ((r[0] === 'lobby' && r[1] === 6) || (r[0] === 'signs' && r[1] !== 9));
}

function drawCeilingHatch(ctx: CanvasRenderingContext2D, sx: number) {
  const x = Math.round(sx - 56);
  const R = (rx: number, ry: number, rw: number, rh: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x + rx, ry, rw, rh);
  };
  ctx.save();
  // 천장 구멍: 테두리 + 안쪽 어둠 + 안쪽 배관 한 줄
  R(-4, 0, 120, 26, '#1b1d20');
  R(0, 0, 112, 20, '#5a5f63');
  R(4, 0, 104, 16, '#0c0d0f');
  R(10, 4, 92, 3, '#2c3034');
  R(0, 20, 112, 2, '#8a9094');
  // 늘어진 뚜껑 (왼쪽 경첩에서 비스듬히)
  for (let i = 0; i < 18; i++) R(-2 - i, 22 + i * 3, 14, 3, i % 6 === 0 ? '#3d4246' : '#6b7175');
  // 접이식 사다리: 두 기둥 + 가로대, 아래 끝 그늘
  R(40, 20, 6, 64, '#3a3e42');
  R(70, 20, 6, 64, '#3a3e42');
  R(41, 20, 2, 64, '#9aa0a4');
  R(71, 20, 2, 64, '#9aa0a4');
  for (let ry = 30; ry < 84; ry += 12) {
    R(46, ry, 24, 4, '#7d8387');
    R(46, ry + 3, 24, 1, '#2a2d30');
  }
  R(40, 82, 36, 2, '#1b1d20');
  ctx.restore();
}

/** 낮은 천장: 배관 그림을 가로로 이어 붙여 천장(0)부터 bottom까지 다발로. 줄마다 반 칸 어긋나고 번갈아 뒤집는다 */
export function drawPipeBundle(ctx: CanvasRenderingContext2D, x0: number, x1: number, bottom: number): boolean {
  const im = objImage('dark', 3);
  if (!im) return false;
  const w = im.width * 2,
    h = im.height * 2 - 12; // 줄끼리 조금 겹쳐 틈 없이
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(x0, 0, x1 - x0, bottom);
  ctx.clip();
  for (let row = 0, y = bottom - im.height * 2; y > -h; row++, y -= h)
    for (let x = x0 - (row % 2 ? w / 2 : 0); x < x1; x += w) {
      if (row % 2) {
        ctx.save();
        ctx.translate(x + w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(im, 0, y, w, im.height * 2);
        ctx.restore();
      } else ctx.drawImage(im, x, y, w, im.height * 2);
    }
  ctx.restore();
  return true;
}

/** 낮은 막이 줄 (GPT props_objects 1~9 중 낮은 것: 줄무늬 콘크리트 턱·모래주머니·화단·철제 통·팔레트).
 * 좁은 길의 앞줄(화면 아래)을 키 큰 차단대 대신 무릎 높이로 막는다 (독립 검수: 차단대 몰림). fy = 받침이 닿는 바닥 y */
export function drawLowRow(ctx: CanvasRenderingContext2D, x0: number, x1: number, fy: number, seed: number): boolean {
  // 철제 통(5)은 빈 회색 칸처럼 보여 뺀다 (독립 검수)
  const ORDER = [1, 6, 4, 2, 1, 4, 6, 1, 2];
  const ims = ORDER.map((n) => objImage('props', n));
  if (ims.some((im) => !im)) return false;
  // 그림 폭을 차례로 이어 붙여 [x0, x1]을 채우고, 남는 폭은 가운데 맞춤
  const pick: HTMLImageElement[] = [];
  let tot = 0;
  for (let i = Math.abs(Math.round(seed / 97)) % ORDER.length; ; i = (i + 1) % ORDER.length) {
    const im = ims[i]!;
    if (pick.length && tot + im.width * 2 > x1 - x0 + 30) break;
    pick.push(im);
    tot += im.width * 2;
    if (pick.length > 30) break;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  let x = Math.round(x0 + (x1 - x0 - tot) / 2);
  for (const im of pick) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + 4, fy - 6, im.width * 2 - 8, 10);
    ctx.drawImage(im, x, fy - im.height * 2, im.width * 2, im.height * 2);
    x += im.width * 2;
  }
  ctx.restore();
  return true;
}

/** 소품 하나를 그림으로. true면 처리됨(그렸거나, 그리지 않는 게 맞는 자리). false면 그림이 아직 없어 부른 쪽 대역. */
export function drawPropArt(ctx: CanvasRenderingContext2D, kind: string, label: string | undefined, sx: number, y: number, floorType?: string): boolean {
  if (kind === 'hatch') {
    // 천장 해치: 바닥 y와 상관없이 천장(화면 맨 위)에 열린 구멍 + 늘어진 뚜껑 + 짧은 접이식 사다리.
    // 바닥 상자(검수 20)·복도 한가운데 사다리(검수 21)는 벽 그림을 가렸다. 사다리 끝은 y 84까지만 (문·게시판 위)
    drawCeilingHatch(ctx, sx);
    return true;
  }
  // 부수는·던지는 물건(item_*)은 아이템 그림이 따로 있다: 배경 물건 대신 그것을 쓰게 (청록 상자처럼 보이던 아파트 TV 대역)
  if (kind.startsWith('item_') && typeof window !== 'undefined' && window.__GOEI_ITEM_ART__?.[kind.slice(5)]) return false;
  const ref = propArtRef(kind, label, sx, floorType);
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
  } else ok = drawObj(ctx, ref[0], ref[1], sx, isHighSign(kind, label) ? WALL_HIGH : y) > 0;
  ctx.restore();
  return ok;
}

/**
 * 지형 덩어리(좁은 길의 튀어나온 바닥·앞 칸막이, 단)를 그 층 바닥 무늬로 칠한다. 회색 상자 대신.
 * 윗면은 바닥 무늬를 밝게, face(px)만큼 아래쪽은 어두운 앞면. 바닥 그림이 없으면 false.
 */
/** 바닥 무늬에 타일 줄이 이미 있는지 (덧줄 생략). */
export function floorHasGrid(place: string): boolean {
  return OWN_GRID.has(place.split(':')[0]);
}

/** 장소 바닥 무늬 (바닥 그림이 없으면 FLOOR_ALT). 낮은 단 윗면처럼 바닥과 같은 재질로 칠할 때. */
export function floorPattern(ctx: CanvasRenderingContext2D, place: string): CanvasPattern | null {
  let p = place.split(':')[0];
  if (!Object.keys(pack()[p] ?? {}).some((n) => n.endsWith('_floor')) && FLOOR_ALT[p]) p = FLOOR_ALT[p];
  const name = Object.keys(pack()[p] ?? {}).find((n) => n.endsWith('_floor'));
  const im = name ? image(p, name) : null;
  if (!im) return null;
  const key = `${p}/${name}`;
  let pat = patterns.get(key);
  if (pat === undefined) {
    pat = ctx.createPattern(im, 'repeat');
    patterns.set(key, pat);
  }
  return pat ?? null;
}

export function drawLedge(ctx: CanvasRenderingContext2D, place: string, x0: number, x1: number, yTop: number, yBot: number, face = 0): boolean {
  let p = place.split(':')[0];
  if (!Object.keys(pack()[p] ?? {}).some((n) => n.endsWith('_floor')) && FLOOR_ALT[p]) p = FLOOR_ALT[p];
  const name = Object.keys(pack()[p] ?? {}).find((n) => n.endsWith('_floor'));
  const im = name ? image(p, name) : null;
  if (!im || yBot <= yTop) return false;
  const key = `${p}/${name}#${tone}`;
  let pat = patterns.get(key);
  if (pat === undefined) {
    pat = ctx.createPattern(tonedImage(`${p}/${name}`, im), 'repeat');
    patterns.set(key, pat);
  }
  if (!pat) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  pat.setTransform(new DOMMatrix([2, 0, 0, 2, 0, 0]));
  ctx.fillStyle = pat;
  ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop - face);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x0, yTop, x1 - x0, 4);
  if (face > 0) {
    ctx.fillStyle = 'rgba(10,10,16,0.55)';
    ctx.fillRect(x0, yBot - face, x1 - x0, face);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x0, yBot - 3, x1 - x0, 3);
  ctx.fillRect(x0, yTop, 3, yBot - yTop);
  ctx.fillRect(x1 - 3, yTop, 3, yBot - yTop);
  ctx.restore();
  return true;
}
