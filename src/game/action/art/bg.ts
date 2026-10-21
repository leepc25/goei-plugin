// 배경 그림 (docs/GPT요청_게임배경.md → tools/bg_pixelize.py → game-src/art/bg/dot).
// 시연판은 window.__GOEI_BG_ART__에 내장. 그림이 없는 장소는 false를 돌려주고 부른 쪽이 단색 대역을 그린다.
// 도트 1px = 화면 2px. 벽 칸 320×220 도트 = 화면 640×440, 바닥 무늬 128 도트.

import { HQ_SCENES } from '../hq/map';

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
const OWN_GRID = new Set(['hq_pantry', 'puzzle']);

/** 바닥 띠(y0~y1)를 무늬로 깐다. 무늬는 월드 x에 붙고, 깊이는 모이는 줄과 뒤쪽 어둡게로 읽힌다. */
export function drawFloor(ctx: CanvasRenderingContext2D, place: string, x0: number, x1: number, y0: number, y1: number): boolean {
  place = place.split(':')[0];
  if (!Object.keys(pack()[place] ?? {}).some((n) => n.endsWith('_floor')) && FLOOR_ALT[place]) place = FLOOR_ALT[place];
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
export function placeFor(where: string, floorType: string | undefined, ref: string, sub?: string | null): string {
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
  hq_lab: ['hq_lab', 'hq_jaemtri:hq_jaemtri_wall_4'],
  hq_lobby: ['hq_lobby', 'lobby:lobby_wall_1'],
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
/** 문 옆 빈 명패 (도트 x0, y0, x1, y1): 문이 이어지는 방 이름을 적는다. */
const PLATES: Record<string, [number, number, number, number]> = {
  hq_corridor_wall_3: [220, 52, 247, 63], hq_corridor_wall_4: [209, 62, 236, 72],
};
const SCENE_NAME = new Map(HQ_SCENES.map((s) => [s.id as string, s.name]));

function doorType(kind: string): 'door' | 'stairs' | 'elevator' {
  return kind.startsWith('stairs') ? 'stairs' : kind === 'elevator' ? 'elevator' : 'door';
}

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
  type Piece = { p: string; n: string; x: number; a: number; b: number; door?: string; flip?: boolean; label?: string };
  const pieces: Piece[] = [];
  for (const d of [...doors].sort((a, b) => a.x - b.x)) {
    const want = DOOR_FOR[`${sceneId}:${d.id}`];
    // 정문은 정문 칸, 없으면 보통 문 칸. 보통 문은 정문 칸을 쓰지 않는다.
    const t = d.kind === 'main' && cands.some(([, n]) => DOOR_WALLS[n]?.[2] === 'main') ? 'main' : doorType(d.kind);
    const ok = cands.filter(([, n]) => DOOR_WALLS[n]?.[2] === t);
    const pick = ok.find(([, n]) => n === want) ?? ok[hash(`${sceneId}:${d.id}`) % Math.max(1, ok.length)];
    if (!pick) continue;
    const [x0, x1] = DOOR_WALLS[pick[1]];
    const bx = d.x - ((x0 + x1) / 2) * k;
    pieces.push({ p: pick[0], n: pick[1], x: bx, a: bx, b: bx + bayW, door: d.id, label: d.to && SCENE_NAME.get(d.to) });
  }
  // 겹치는 문 칸은 두 문 사이 가운데서 자른다 (문 구멍은 남는다)
  for (let i = 1; i < pieces.length; i++) {
    const L = pieces[i - 1], R = pieces[i];
    if (L.b > R.a) {
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
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const covered = new Set<string>();
  for (const pc of [...fills, ...pieces]) {
    const im = image(pc.p, pc.n);
    if (!im) continue;
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
      ctx.fillStyle = '#2b2f2c';
      ctx.font = `bold ${Math.round((y1 - y0) * k * 0.62)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pc.label, pc.x + ((x0 + x1) / 2) * k, ((y0 + y1) / 2) * k + k / 2, (x1 - x0 - 3) * k);
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
  for (const pc of [...fills, ...pieces]) for (const e of [pc.a, pc.b]) if (e > 0 && e < length && e - pc.x > 2 && pc.x + bayW - e > 2) seamPillar(ctx, e, wallBottom, 14);
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
  [/게시판|표지|안내|액자|점수판|번호표|점검표|목표|시계|사진/, ['lobby', 6]],
  [/책장/, ['hq_jaemtri', 9]], [/그릇|선반/, ['hq_pantry', 8]], [/카펫/, ['apt', 4]], [/형광등|블라인드/, ['chase', 8]], [/의자/, ['chase', 2]],
  [/배관/, ['service', 8]], [/캐비닛|틈새|셔터/, ['chase', 6]], [/문짝|잠긴 문|문틀|방화문/, ['chase', 1]], [/신발장/, ['apt', 2]],
  [/덮인 가구|벽지|손자국/, ['apt', 7]], [/냉장고/, ['hq_pantry', 1]], [/텔레비전/, ['apt', 5]], [/사물함/, ['hq_workshop', 3]], [/밥상/, ['apt', 3]],
];
const DOOR: Record<string, number> = { apt: 1, chase: 1, lobby: 9, test: 9, hq_office: 9, hq_workshop: 9, hq_pantry: 9 };
const BY_KIND: Record<string, ObjRef> = {
  elevator: ['el_hall', 1, 'el_hall', 2], chasedoor: ['chase', 1], servicedoor: ['hq_workshop', 9], hatch: ['service', 9], shutter: ['chase', 6],
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
  // 부수는·던지는 물건(item_*)은 아이템 그림이 따로 있다: 배경 물건 대신 그것을 쓰게 (청록 상자처럼 보이던 아파트 TV 대역)
  if (kind.startsWith('item_') && typeof window !== 'undefined' && window.__GOEI_ITEM_ART__?.[kind.slice(5)]) return false;
  let ref: ObjRef | undefined;
  if (kind === 'door') {
    const p = placeFor('floor', floorType, '');
    ref = [p, DOOR[p] ?? 0] as ObjRef;
    if (!DOOR[p]) ref = ['chase', 1];
  } else if (kind in BY_KIND) ref = BY_KIND[kind];
  else if (label) {
    // 층마다 자기 물건 그림이 있으면 먼저 (침묵·어둠·퍼즐·심층)
    const own = FLOOR_LABEL[floorType ?? '']?.find(([re]) => re.test(label))?.[1];
    if (own && objImage(own[0], own[1])) ref = own;
    else ref = BY_LABEL.find(([re]) => re.test(label))?.[1];
  }
  if (ref === undefined && kind === 'prop') ref = floorType === 'deep' && objImage('deep', 1) ? ['deep', 1 + (Math.abs(Math.round(sx / 97)) % 9)] : ['chase', 5];
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
  // 빈 흰 판(로비 6번)에 글씨·무늬 (통합 검수 2-4: 빈 판처럼 보인다). 판 면 = 도트 (10,2)~(50,48)
  if (ok && ref.length === 2 && ref[0] === 'lobby' && ref[1] === 6) {
    const im = objImage('lobby', 6)!;
    boardFace(ctx, sx - im.width + 22, y - im.height * 2 + 6, 78, 88, kind, label ?? '');
  }
  ctx.restore();
  return ok;
}

/** 표지판 면: 머리 글씨 두 자 + 글줄 무늬. 종류마다 머리 글씨·무늬가 다르다. */
function boardFace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, kind: string, label: string) {
  const head =
    /시험|점수/.test(label) ? '시험' : /순서/.test(label) ? '순서' : /표지/.test(label) ? '표지' : kind === 'checklist' || /점검/.test(label) ? '점검' : kind === 'goalwall' || /목표/.test(label) ? '목표' : /긁힌/.test(label) ? '' : '안내';
  x = Math.round(x);
  y = Math.round(y);
  ctx.save();
  ctx.fillStyle = head === '시험' || head === '목표' ? '#7a2a26' : '#2c3c52';
  ctx.fillRect(x, y, w, 22);
  if (head) {
    ctx.fillStyle = '#e8e2d2';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(head, x + w / 2, y + 12);
  }
  ctx.fillStyle = '#3a3a3e';
  if (head === '순서') {
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 10 + i * 22, y + 36, 14, 14);
    ctx.fillRect(x + 8, y + 62, w - 16, 4);
  } else if (head === '표지') {
    // 화살표 머리만 (어느 쪽인지는 읽어야 안다)
    ctx.fillRect(x + 18, y + 44, w - 36, 6);
    ctx.fillRect(x + 10, y + 34, 6, 26);
    ctx.fillRect(x + w - 16, y + 34, 6, 26);
  } else if (!head) {
    // 긁힌 글씨: 비뚤어진 긁힘
    ctx.fillStyle = '#5a2a2a';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 6 + ((i * 13) % (w - 20)), y + 8 + i * 12, 14 + ((i * 7) % 20), 3);
  } else {
    // 글줄: 길이가 다른 짧은 줄 (작은 글씨처럼)
    for (let i = 0; i < 5; i++) {
      const lw = w - 16 - ((i * 17) % 28);
      for (let gx = 0; gx < lw; gx += 8) ctx.fillRect(x + 8 + gx, y + 30 + i * 11, 6, 4);
    }
  }
  ctx.restore();
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
  const key = `${p}/${name}`;
  let pat = patterns.get(key);
  if (pat === undefined) {
    pat = ctx.createPattern(im, 'repeat');
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
