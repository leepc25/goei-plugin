// 스테이지 자료 → 엔진 FloorPlan (docs/게임_모듈_연결.md). 배경·전경 그리기도 여기서 한다(회색 상자, 그림 없음).
import { drawPropArt } from '../art/bg';
import type { Encounter, FloorPlan, PropSpec, SpawnSpec, WorldView } from '../engine/contract';
import { depthLabel } from './data/floortypes';
import { CHUNK_W, ROOM_W, Y_BOTTOM, Y_TOP, laneY, type Floor, type FloorSegment, type Palette, type ServiceCell, type ServiceZone, type Terrain } from './types';
import type { ElevatorButton } from './elevator';
import { FLOOR_TYPES } from './data/floortypes';
import { drawFloor, drawLedge, floorHasGrid, floorPattern, drawWallCell, placeFor, seamPillar } from '../art/bg';

/** FloorPlan에 붙여 두는 스테이지 정보 (엔진은 몰라도 된다) */
export interface StagePlan extends FloorPlan {
  stage: {
    where: 'floor' | 'car' | 'service' | 'ending';
    terrain: Terrain[];
    floor?: Floor;
    cell?: ServiceCell;
    zone?: ServiceZone;
    buttons?: ElevatorButton[];
    /** 층 tick이 그리는 덮개 상태 (어둠·추격 벽·조임) */
    fx: { light: number; chaseX: number; squeeze: number; noise: number; red: boolean };
  };
}

const NOLOCK_TYPES = new Set(['chase', 'deep']);

export function floorPlan(f: Floor, id: string, startX = 240): StagePlan {
  const props: PropSpec[] = f.placed.map((p) => ({
    id: `p${p.id}`,
    kind: p.kind,
    x: p.x,
    y: laneY(p.lane),
    w: p.w,
    h: propH(p.kind),
    label: p.kind === 'sign' ? p.label : p.label,
    solid: p.kind === 'shutter' ? !p.data.open : undefined,
  }));
  // 승객·사는 척하는 주민·로비의 직원은 처음에 소품(말 걸 수 있음)이고, 규칙을 어기면 층 tick이 적으로 바꾼다
  for (const s of f.spawns) {
    if (s.role === 'passenger') props.push({ id: `h${s.id}`, kind: 'passenger', x: s.x, y: laneY(s.lane), w: 50, h: 150, label: '떠도는 승객' });
    if (s.role === 'resident') props.push({ id: `h${s.id}`, kind: 'npc', x: s.x, y: laneY(s.lane), w: 50, h: 150, label: '주민 (사는 척)' });
    if (s.role === 'enemy' && s.data.harmless) props.push({ id: `h${s.id}`, kind: 'npc', x: s.x, y: laneY(s.lane), w: 50, h: 150, label: '평범한 직원' });
  }
  // 싸움 구간: 조각마다 적 자리를 묶는다. 추격·B-12는 화면을 잠그지 않으므로 층 tick이 직접 부른다.
  const encounters: Encounter[] = [];
  if (!NOLOCK_TYPES.has(f.type)) {
    const groups = new Map<number, SpawnSpec[][]>();
    for (const s of f.spawns.filter((s) => s.role === 'enemy' && !s.data.harmless)) {
      const seg = segAt(f.segments, s.x);
      const waves = groups.get(seg.x) ?? [[], []];
      waves[Math.min(1, s.wave)].push({ kind: s.kind, x: s.x, y: laneY(s.lane), elite: s.elite || undefined });
      groups.set(seg.x, waves);
    }
    for (const [x, waves] of groups) {
      const lockFrom = Math.max(0, x - 320);
      encounters.push({ triggerX: x + 120, lockFrom, lockTo: Math.min(f.width, lockFrom + 1280), waves: waves.filter((w) => w.length) });
    }
    const g = f.spawns.find((s) => s.role === 'guardian' && !s.data.onFail && !s.data.survive && s.kind !== 'elder');
    if (g) {
      const room = segAt(f.segments, g.x);
      encounters.push({ triggerX: room.x + 200, lockFrom: room.x, lockTo: room.x + room.w, waves: [[{ kind: g.kind, x: g.x, y: laneY(g.lane), boss: true, elite: g.elite || undefined }]] });
    }
    encounters.sort((a, b) => a.triggerX - b.triggerX);
  }
  const plan: StagePlan = {
    id,
    title: f.label,
    type: f.type,
    depth: f.depth,
    length: f.width,
    lane: [Y_TOP, Y_BOTTOM],
    startX,
    exitX: Infinity,
    encounters,
    props,
    palette: { wall: f.palette.wall, floor: f.palette.floor, accent: f.palette.accent },
    banner: f.label,
    stage: { where: 'floor', terrain: f.segments.flatMap((s) => s.terrain), floor: f, fx: { light: 1, chaseX: -9999, squeeze: 0, noise: 0, red: false } },
  };
  plan.drawBackground = (ctx, camX) => drawBack(ctx, camX, f.segments, f.palette, plan);
  plan.drawForeground = (ctx, camX, world) => drawFront(ctx, camX, world, plan);
  return plan;
}

export function cellPlan(z: ServiceZone, cell: ServiceCell, id: string, startX: number): StagePlan {
  const props: PropSpec[] = cell.things.map((t) => ({ id: `s${t.id}`, kind: t.kind, x: t.x, y: laneY(t.lane), w: 60, h: t.kind === 'rope' ? 260 : t.kind.startsWith('ladder') ? 220 : 110, label: t.label }));
  const pal: Palette = { wall: '#4a3a24', floor: '#33291c', trim: '#1e170e', accent: '#f0b860', fog: 'rgba(0,0,0,0)' };
  const plan: StagePlan = {
    id,
    title: `정비 구역 (${depthLabel(z.depth)} 아래) · ${cell.label}`,
    type: 'service',
    depth: z.depth,
    length: cell.width,
    lane: [Y_TOP, Y_BOTTOM],
    startX,
    exitX: Infinity,
    encounters: [],
    props,
    palette: { wall: pal.wall, floor: pal.floor, accent: pal.accent },
    banner: cell.kind === 'attic' ? '선배들의 다락방' : `정비 구역 · ${cell.label}`,
    stage: { where: 'service', terrain: cell.segments.flatMap((s) => s.terrain), cell, zone: z, fx: { light: 1, chaseX: -9999, squeeze: 0, noise: 0, red: false } },
  };
  plan.drawBackground = (ctx, camX) => drawBack(ctx, camX, cell.segments, pal, plan);
  plan.drawForeground = (ctx, camX, world) => drawFront(ctx, camX, world, plan);
  return plan;
}

export function carPlan(id: string, buttons: ElevatorButton[], depth: number): StagePlan {
  const props: PropSpec[] = [
    { id: 'getoff', kind: 'getoff', x: 90, y: Y_TOP, w: 60, h: 160, label: '내렸다 다시 타기' },
    { id: 'greet', kind: 'greet', x: 260, y: Y_TOP, w: 60, h: 110, label: '인사하기 (E)' },
    { id: 'mirror', kind: 'mirror', x: 420, y: Y_TOP, w: 70, h: 150, label: '거울' },
    { id: 'close', kind: 'close', x: 600, y: Y_TOP, w: 40, h: 60, label: '닫힘 버튼' },
  ];
  buttons.forEach((b, i) =>
    props.push({ id: `btn${i}`, kind: 'button', x: 760 + i * 120, y: Y_TOP, w: 60, h: 60, label: b.exit ? 'EXIT' : `${b.label}${b.shown ? ` · ${FLOOR_TYPES[b.type].label}` : ' · ?'}` }),
  );
  const pal: Palette = { wall: '#5d5146', floor: '#3a332c', trim: '#221d18', accent: '#ffcf70', fog: 'rgba(0,0,0,0)' };
  const segs: FloorSegment[] = [{ ref: 'room:car', x: 0, w: ROOM_W, flip: false, terrain: [] }];
  const plan: StagePlan = {
    id,
    title: `승강기 안 · ${depthLabel(depth)}`,
    type: 'car',
    depth,
    length: ROOM_W,
    lane: [Y_TOP, Y_BOTTOM],
    startX: 160,
    exitX: Infinity,
    encounters: [],
    props,
    palette: { wall: pal.wall, floor: pal.floor, accent: pal.accent },
    banner: '승강기',
    stage: { where: 'car', terrain: [], buttons, fx: { light: 1, chaseX: -9999, squeeze: 0, noise: 0, red: false } },
  };
  plan.drawBackground = (ctx, camX) => drawBack(ctx, camX, segs, pal, plan);
  return plan;
}

export function endingPlan(id: string): StagePlan {
  const pal: Palette = { wall: '#c9c4b4', floor: '#9a9483', trim: '#6b675b', accent: '#ffffff', fog: 'rgba(0,0,0,0)' };
  const segs: FloorSegment[] = [{ ref: 'room:exit_hall', x: 0, w: ROOM_W, flip: false, terrain: [] }];
  const plan: StagePlan = {
    id,
    title: '로비 · 진짜',
    type: 'ending',
    depth: 0,
    length: ROOM_W,
    lane: [Y_TOP, Y_BOTTOM],
    startX: 200,
    exitX: Infinity,
    encounters: [],
    props: [{ id: 'van', kind: 'van', x: 1000, y: Y_TOP, w: 220, h: 140, label: '관리국 차량 (귀환)' }],
    palette: { wall: pal.wall, floor: pal.floor, accent: pal.accent },
    banner: '문을 열고 나왔다. 로비였다. 진짜.',
    stage: { where: 'ending', terrain: [], fx: { light: 1, chaseX: -9999, squeeze: 0, noise: 0, red: false } },
  };
  plan.drawBackground = (ctx, camX) => drawBack(ctx, camX, segs, pal, plan);
  return plan;
}

function propH(kind: string): number {
  return ({ elevator: 200, panel: 90, mirror: 130, door: 180, shutter: 200, servicedoor: 170, hatch: 30, goalwall: 140, table: 50, chasedoor: 190, sign: 60, switch: 50, mark: 30, item: 28, belonging: 28 } as Record<string, number>)[kind] ?? 80;
}

export function segAt(segs: FloorSegment[], x: number): FloorSegment {
  return segs.find((s) => x >= s.x && x < s.x + s.w) ?? segs[segs.length - 1];
}

// ── 그리기 (회색 상자). 시점은 벨트스크롤(docs/게임_통합_규격.md 2장): 벽 0~Y_TOP, 바닥 띠 Y_TOP~Y_BOTTOM에 원근.
// 화면 y = 깊이 y − z. 바닥 앞뒤 줄은 앞으로 올수록 넓어지고, 세로 이음매는 화면 가운데 위 소실점으로 모인다.
const CEIL = 40;
function drawBack(ctx: CanvasRenderingContext2D, camX: number, segs: FloorSegment[], pal: Palette, plan: StagePlan) {
  const [y0, y1] = plan.lane ?? [Y_TOP, Y_BOTTOM];
  const vx0 = camX - 40,
    vx1 = camX + 1320;
  const cx = camX + 640;
  for (const s of segs) {
    if (s.x + s.w < vx0 || s.x > vx1) continue;
    const room = s.ref.startsWith('room:');
    const place = placeFor(plan.stage.where, plan.stage.floor?.type, s.ref, plan.stage.floor?.sub);
    // 바닥은 한 층 안에서 한 가지 (홀·방도 그 층 바닥), 벽 장소가 바뀌는 곳은 기둥으로 잇는다 (통합 검수 2-3)
    const floorPlace = plan.stage.where === 'floor' ? placeFor('floor', plan.stage.floor?.type, '') : place;
    if (drawWallCell(ctx, place, s.ref, s.x, s.w, s.flip, y0)) {
      const i = segs.indexOf(s);
      const prev = i > 0 ? placeFor(plan.stage.where, plan.stage.floor?.type, segs[i - 1].ref, plan.stage.floor?.sub) : place;
      if (prev !== place) seamPillar(ctx, s.x, y0);
      const next = i + 1 < segs.length ? placeFor(plan.stage.where, plan.stage.floor?.type, segs[i + 1].ref, plan.stage.floor?.sub) : place;
      if (next !== place) seamPillar(ctx, s.x + s.w, y0);
      if (!drawFloor(ctx, floorPlace, s.x, s.x + s.w, y0, 720) && !drawFloor(ctx, place, s.x, s.x + s.w, y0, 720)) {
        ctx.fillStyle = pal.floor;
        ctx.fillRect(s.x, y0, s.w, 720 - y0);
      }
      continue; // 지형은 아래에서 한꺼번에
    }
    // 벽
    ctx.fillStyle = pal.wall;
    ctx.fillRect(s.x, CEIL, s.w, y0 - CEIL);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(s.x, 0, s.w, CEIL);
    ctx.fillRect(s.x, y0 - 18, s.w, 18);
    ctx.fillRect(s.x, CEIL, 3, y0 - CEIL);
    // 벽 위쪽 띠 (몰딩)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(s.x, CEIL + 40, s.w, 8);
    // 바닥 (원근)
    ctx.fillStyle = pal.floor;
    ctx.fillRect(s.x, y0, s.w, 720 - y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    // 앞뒤 줄: 3줄 이상, 앞으로 올수록 간격이 넓다
    for (const f of [0.12, 0.28, 0.48, 0.72]) {
      const yy = y0 + (y1 - y0) * f;
      ctx.beginPath();
      ctx.moveTo(s.x, yy);
      ctx.lineTo(s.x + s.w, yy);
      ctx.stroke();
    }
    // 세로 이음매: 위는 소실점 쪽으로 좁아진다
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (let x = Math.ceil(s.x / 120) * 120; x < s.x + s.w; x += 120) {
      ctx.beginPath();
      ctx.moveTo(cx + (x - cx) * 0.78, y0);
      ctx.lineTo(cx + (x - cx) * 1.12, 720);
      ctx.stroke();
    }
    // 앞쪽 그늘
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 40);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x, y0, s.w, 40);
    void room; // 조각·방 이름 글씨는 화면에 쓰지 않는다 (떠 있는 글씨 금지)
  }
  // 지형은 조각을 다 깐 뒤에 (이웃 조각 바닥에 덮이지 않게)
  // 깊이 줄(뒷줄 사물함 등)은 매 장면 새로 모아 엔진에 넘긴다
  const layers: NonNullable<StagePlan['depthLayers']> = [];
  plan.depthLayers = layers;
  for (const s of segs) if (!(s.x + s.w < vx0 || s.x > vx1)) for (const t of s.terrain) drawTerrain(ctx, t, pal, y0, y1, placeFor(plan.stage.where, plan.stage.floor?.type, plan.stage.where === 'floor' ? '' : s.ref, plan.stage.floor?.sub), layers);
  void CHUNK_W;
}

function roomName(ref: string): string {
  return ({ 'room:elevator_hall': '엘리베이터 홀', 'room:guardian_room': '수호자 방', 'room:trial_goal': '시험 목표 방', 'room:attic': '다락방', 'room:exit_hall': '출구 홀', 'room:car': '승강기 안' } as Record<string, string>)[ref] ?? ref;
}

export function drawTerrain(ctx: CanvasRenderingContext2D, t: Terrain, pal: Palette, y0: number, y1: number, place = '', layers?: NonNullable<StagePlan['depthLayers']>) {
  const w = t.x1 - t.x0;
  switch (t.kind) {
    case 'pit': {
      // 무너진 바닥: 원근에 맞춘 깨진 가장자리, 슬래브 단면, 철근, 아래로 깊어지는 어둠 (검은 직사각형·점선·글씨 없음)
      const tf = ctx.getTransform();
      const mid = (ctx.canvas.width / 2 - tf.e) / (tf.a || 1);
      const k = 0.45 / (720 - y0);
      const px = (x: number, y: number) => x + (x - mid) * k * (y - y0);
      const jag = (i: number) => Math.sin(t.x0 * 0.13 + i * 2.7) * 7 + Math.sin(i * 5.1) * 4;
      const n = 10;
      const edge = (x: number, side: number) => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const y = y0 + ((y1 + 30 - y0) * i) / n;
          pts.push([px(x, y) + side * jag(i + (side > 0 ? 20 : 0)), y]);
        }
        return pts;
      };
      const L = edge(t.x0, 1),
        R = edge(t.x1, -1);
      const hole = new Path2D();
      L.forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y)));
      for (let i = R.length - 1; i >= 0; i--) hole.lineTo(R[i][0], R[i][1]);
      hole.closePath();
      const g = ctx.createLinearGradient(0, y0, 0, 720);
      g.addColorStop(0, '#050506');
      g.addColorStop(0.5, '#0c0d10');
      g.addColorStop(1, '#16181c');
      ctx.fillStyle = g;
      ctx.fill(hole);
      // 먼 쪽 슬래브 단면 (두께가 보이는 콘크리트 띠)
      ctx.save();
      ctx.clip(hole);
      ctx.fillStyle = '#5a5c5e';
      ctx.fillRect(t.x0 - 40, y0, w + 80, 14);
      ctx.fillStyle = '#3a3b3d';
      ctx.fillRect(t.x0 - 40, y0 + 14, w + 80, 8);
      // 양옆 단면 그림자
      ctx.fillStyle = 'rgba(70,72,74,0.9)';
      ctx.beginPath();
      L.forEach(([x, y], i) => (i ? ctx.lineTo(x + 12, y) : ctx.moveTo(x + 12, y)));
      for (let i = L.length - 1; i >= 0; i--) ctx.lineTo(L[i][0], L[i][1]);
      ctx.fill();
      ctx.restore();
      // 깨진 가장자리 밝은 테두리와 튀어나온 철근
      ctx.strokeStyle = 'rgba(200,196,186,0.55)';
      ctx.lineWidth = 3;
      for (const side of [L, R]) {
        ctx.beginPath();
        side.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      ctx.strokeStyle = '#6b4a32';
      ctx.lineWidth = 3;
      for (let i = 1; i < n; i += 3) {
        const [lx, ly] = L[i],
          [rx, ry] = R[i];
        ctx.beginPath();
        ctx.moveTo(lx - 4, ly);
        ctx.lineTo(lx + 26 + jag(i) * 2, ly + 10);
        ctx.moveTo(rx + 4, ry);
        ctx.lineTo(rx - 22 - jag(i + 3) * 2, ry + 12);
        ctx.stroke();
      }
      // 가장자리 부스러기
      ctx.fillStyle = '#8d8a84';
      for (let i = 0; i < 8; i++) {
        const e = i % 2 ? L : R;
        const [x, y] = e[(i * 3) % e.length];
        ctx.fillRect(Math.round(x + (i % 2 ? -14 : 8)), Math.round(y - 4), 6, 4);
      }
      break;
    }
    case 'block': {
      // 바닥 띠 전체를 가로지르는 낮은 단(점프로 넘기). 바닥과 같은 원근(뒤 0.62배 → 앞 1배, 화면 가운데로 모임)으로
      // 바닥 타일 무늬·이음줄을 한 단 높이 그대로 깔고, 앞면은 콘크리트 옆면, 둘레에 그늘 (평평한 판처럼 보이지 않게, 검수 6)
      const tf = ctx.getTransform();
      const mid = (ctx.canvas.width / 2 - tf.e) / (tf.a || 1);
      const h = Math.min(t.h, 28);
      const depth = (y: number) => 0.62 + (0.38 * (y - y0)) / Math.max(1, y1 - y0);
      // 사람은 깊이와 상관없이 월드 x에 서므로, 가운데 줄 깊이에서 단 모서리가 t.x0~t.x1이 되게 맞춘다 (판정과 그림 차이를 앞뒤로 반씩)
      const f0 = mid + (t.x0 - mid) / 0.81,
        f1 = mid + (t.x1 - mid) / 0.81;
      const at = (xf: number, y: number) => mid + (xf - mid) * depth(y);
      const quad = (pts: [number, number][], fill: string | CanvasGradient | CanvasPattern) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
      };
      const topPts: [number, number][] = [[at(f0, y0), y0 - h], [at(f1, y0), y0 - h], [at(f1, y1), y1 - h], [at(f0, y1), y1 - h]];
      // 바닥에 지는 그늘 (앞·옆으로 번짐)
      ctx.save();
      ctx.filter = 'blur(6px)';
      quad([[at(f0, y0) - 6, y0], [at(f1, y0) + 6, y0], [at(f1, y1) + 14, y1 + 4], [at(f0, y1) - 14, y1 + 4]], 'rgba(0,0,0,0.35)');
      ctx.restore();
      // 옆면 (화면 가운데 쪽 면이 보인다): 콘크리트, 뒤로 갈수록 어둡게
      const side = (xf: number) => {
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, '#3b3d3f');
        g.addColorStop(1, '#55585a');
        quad([[at(xf, y0), y0 - h], [at(xf, y1), y1 - h], [at(xf, y1), y1], [at(xf, y0), y0]], g);
      };
      if (t.x1 < mid) side(f1);
      else if (t.x0 > mid) side(f0);
      // 윗면: 바닥 무늬 그대로 + 바닥과 같은 이음줄
      const fp = floorPattern(ctx, place);
      ctx.save();
      ctx.beginPath();
      topPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      if (fp) {
        ctx.imageSmoothingEnabled = false;
        fp.setTransform(new DOMMatrix([2, 0, 0, 1, 0, y0 - h]));
        ctx.fillStyle = fp;
      } else ctx.fillStyle = pal.floor;
      const tx0 = Math.min(at(f0, y0), at(f0, y1)) - 4,
        tx1 = Math.max(at(f1, y0), at(f1, y1)) + 4;
      ctx.fillRect(tx0, y0 - h, tx1 - tx0, y1 - y0);
      ctx.strokeStyle = 'rgba(10,10,16,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const ownGrid = floorHasGrid(place);
      for (let d = 0, k = 0; !ownGrid && y0 + d < y1; k++) {
        ctx.moveTo(at(f0, y0 + d) - 4, Math.round(y0 + d) - h);
        ctx.lineTo(at(f1, y0 + d) + 4, Math.round(y0 + d) - h);
        d += 22 + k * 9;
      }
      for (let wx = Math.ceil(f0 / 128) * 128; !ownGrid && wx < f1; wx += 128) {
        ctx.moveTo(at(wx, y0), y0 - h);
        ctx.lineTo(wx, y1 - h);
      }
      ctx.stroke();
      // 바닥과 같은 뒤쪽 그늘 (조금 약하게: 높은 면이 빛을 더 받는다)
      const sh = ctx.createLinearGradient(0, y0 - h, 0, 720 - h);
      sh.addColorStop(0, 'rgba(0,0,0,0.28)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(tx0, y0 - h, tx1 - tx0, y1 - y0);
      ctx.restore();
      // 윗면 테두리: 밝은 모서리 선
      ctx.strokeStyle = 'rgba(230,230,224,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(at(f0, y1), y1 - h);
      ctx.lineTo(at(f0, y0), y0 - h);
      ctx.lineTo(at(f1, y0), y0 - h);
      ctx.lineTo(at(f1, y1), y1 - h);
      ctx.stroke();
      // 앞면: 콘크리트 옆면 (위 모서리 밝게, 아래로 어둡게, 거푸집 자국·이 빠진 모서리)
      const fx0 = at(f0, y1),
        fx1 = at(f1, y1);
      const fg = ctx.createLinearGradient(0, y1 - h, 0, y1);
      fg.addColorStop(0, '#6d6f70');
      fg.addColorStop(1, '#3f4143');
      quad([[fx0, y1 - h], [fx1, y1 - h], [fx1, y1], [fx0, y1]], fg);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let x = fx0 + 40; x < fx1 - 8; x += 64) ctx.fillRect(Math.round(x), y1 - h + 3, 2, h - 5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(fx0, y1 - h, fx1 - fx0, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(fx0, y1 - 2, fx1 - fx0, 2);
      for (let i = 0; i < 3; i++) {
        const cx = fx0 + ((Math.sin(t.x0 * 0.7 + i * 2.3) + 1) / 2) * (fx1 - fx0 - 20) + 6;
        quad([[cx, y1 - h], [cx + 10, y1 - h], [cx + 4, y1 - h + 6]], '#2e3032');
      }
      break;
    }
    case 'low': {
      // 머리 높이로 내려온 굵은 배관 (도트: 4px 단위 색 띠, 이음 고리, 리벳, 녹 얼룩, 천장 걸쇠). 매끈한 그라데이션 금지 (검수 10)
      const py = Math.round((y0 - 232) / 4) * 4;
      const bands: [number, string][] = [[4, '#2a2d2e'], [8, '#5f6567'], [4, '#9aa09e'], [4, '#c3c7c4'], [8, '#7c8280'], [8, '#5a6062'], [6, '#3c4143'], [4, '#222527']];
      const x0 = Math.round(t.x0 / 4) * 4,
        x1 = Math.round(t.x1 / 4) * 4;
      // 걸쇠: 천장에서 내려오는 각진 막대 + 배관을 감싼 띠쇠
      for (let x = x0 + 64; x < x1 - 40; x += 160) {
        ctx.fillStyle = '#1e2021';
        ctx.fillRect(x, 0, 8, py);
        ctx.fillStyle = '#4a4f51';
        ctx.fillRect(x + 2, 0, 2, py);
        ctx.fillStyle = '#1e2021';
        ctx.fillRect(x - 8, py - 8, 24, 8);
      }
      let y = py;
      for (const [h, c] of bands) {
        ctx.fillStyle = c;
        ctx.fillRect(x0, y, x1 - x0, h);
        y += h;
      }
      const ph = y - py;
      // 이음 고리(플랜지)와 리벳
      for (let x = x0 + 24; x < x1 - 16; x += 128) {
        ctx.fillStyle = '#2f3335';
        ctx.fillRect(x, py - 4, 16, ph + 8);
        ctx.fillStyle = '#8d9290';
        ctx.fillRect(x + 4, py - 4, 4, ph + 8);
        ctx.fillStyle = '#c9ccc9';
        for (let ry = py + 4; ry < py + ph - 4; ry += 12) ctx.fillRect(x + 10, ry, 4, 4);
      }
      // 녹 얼룩·물방울 자국 (도트 덩어리)
      for (let x = x0 + 72; x < x1 - 20; x += 196) {
        ctx.fillStyle = '#7a4a2a';
        ctx.fillRect(x, py + ph - 16, 12, 8);
        ctx.fillRect(x + 4, py + ph - 8, 4, 8);
        ctx.fillStyle = '#5a3420';
        ctx.fillRect(x + 12, py + ph - 12, 8, 4);
      }
      break;
    }
    case 'narrow': {
      // 좁은 길: 막힌 칸에 물건 그림(캐비닛·사물함)을 늘어놓아 막는다. 그림이 없으면 벽·칸막이 단색
      const a = laneYIn(t.lane0, y0, y1),
        b = laneYIn(t.lane1, y0, y1);
      const row = (label: string, y: number) => {
        let ok = true;
        for (let x = t.x0 + 50; x < t.x1 - 20 && ok; x += 100) ok = drawPropArt(ctx, 'clutter', label, x, y);
        return ok;
      };
      // 뒷줄 사물함은 배경이 아니라 깊이 줄로(엔진이 몸과 y 순서로 섞어 그린다): 그 뒤에 선 몸은 가려지고 앞에 선 몸은 위에 (검수 9)
      if (a > y0 && layers) {
        layers.push({ y: a, x0: t.x0 - 10, x1: t.x1 + 10, draw: (c) => {
          for (let x = t.x0 + 50; x < t.x1 - 20; x += 100) if (!drawPropArt(c, 'clutter', '사물함', x, a)) break;
        } });
      } else if (a > y0 && !row('사물함', a)) {
        ctx.fillStyle = pal.wall;
        ctx.fillRect(t.x0, y0 - 40, w, a - y0 + 40);
        ctx.fillStyle = pal.trim;
        ctx.fillRect(t.x0, y0 - 40, 6, a - y0 + 40);
        ctx.fillRect(t.x1 - 6, y0 - 40, 6, a - y0 + 40);
      }
      // 앞줄(화면 아래)은 키 큰 사물함이 싸움을 가리므로 낮은 공사 차단대 줄로 막는다 (기둥·노랑검정 가로대·받침)
      if (b < y1) {
        // 실제 공사 차단대 크기: 기둥 ≈ 쟈알디 엉덩이 높이(130px), 가로대 두 줄 (검수 7)
        const fy = Math.min(y1 + 10, b + 150);
        for (let x = t.x0 + 10; x < t.x1 - 10; x += 170) {
          const x2 = Math.min(t.x1 - 10, x + 160);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x - 10, fy - 6, x2 - x + 20, 12);
          for (const px of [x, x2 - 16]) {
            ctx.fillStyle = '#2b2d30';
            ctx.fillRect(px - 14, fy - 10, 44, 12);
            ctx.fillStyle = '#5d6166';
            ctx.fillRect(px, fy - 132, 16, 124);
            ctx.fillStyle = '#878c91';
            ctx.fillRect(px, fy - 132, 5, 124);
            ctx.fillStyle = '#3c3f43';
            ctx.fillRect(px + 12, fy - 132, 4, 124);
          }
          for (const ry of [fy - 122, fy - 72]) {
            for (let sx = x; sx < x2; sx += 24) {
              ctx.fillStyle = ((sx - x) / 24) % 2 ? '#1d1d1f' : '#e2b23a';
              ctx.fillRect(sx, ry, Math.min(24, x2 - sx), 24);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x, ry, x2 - x, 3);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x, ry + 20, x2 - x, 4);
          }
        }
      }
      break;
    }
    case 'redfloor': {
      // 붉은 바닥: 판정 상자처럼 보이는 납작한 직사각형 대신 바닥에 번진 얼룩 (재검수 2-5)
      const a = laneYIn(t.lane0, y0, y1),
        b = laneYIn(t.lane1, y0, y1);
      const cy = (a + b) / 2,
        ry = Math.max(14, (b - a) / 2);
      ctx.save();
      for (let i = 0, n = Math.max(2, Math.round(w / 140)); i < n; i++) {
        const cx = t.x0 + ((i + 0.5) / n) * w + Math.sin(t.x0 + i * 7.3) * 18;
        const rx = (w / n) * 0.75;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
        g.addColorStop(0, 'rgba(120,8,10,0.62)');
        g.addColorStop(0.7, 'rgba(90,6,8,0.35)');
        g.addColorStop(1, 'rgba(60,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry * (0.8 + 0.2 * Math.cos(i * 2.1)), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      label(ctx, '붉은 바닥', t.x0 + 4, laneYIn(t.lane0, y0, y1) + 14, '#ffb0b0');
      break;
    }
    case 'glass':
      ctx.strokeStyle = 'rgba(200,240,255,0.5)';
      for (let x = t.x0; x < t.x1; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, y0 + ((x * 7) % (y1 - y0)));
        ctx.lineTo(x + 12, y0 + ((x * 13) % (y1 - y0)));
        ctx.stroke();
      }
      label(ctx, '깨진 유리 (소리)', t.x0 + 4, y0 + 20, '#bfe8ff');
      break;
  }
}
const laneYIn = (lane: number, y0: number, y1: number) => y0 + (lane / 160) * (y1 - y0);
/** 지형 설명 글씨는 화면에 띄우지 않는다(검수 5번: 떠 있는 설명 글씨 금지). 판정 보기(H)용으로만 남김 */
function label(_ctx: CanvasRenderingContext2D, _s: string, _x: number, _y: number, _c: string) {}

function drawFront(ctx: CanvasRenderingContext2D, camX: number, world: WorldView, plan: StagePlan) {
  const fx = plan.stage.fx;
  const vw = ctx.canvas.width;
  // 추격의 벽
  if (fx.chaseX > -9000) {
    const g = ctx.createLinearGradient(fx.chaseX - 300, 0, fx.chaseX + 40, 0);
    g.addColorStop(0, 'rgba(60,0,0,0.95)');
    g.addColorStop(1, 'rgba(160,20,20,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(fx.chaseX - 1600, 100, 1640, 640);
  }
  // 어둠: 플레이어 둘레만 보인다 (화면 좌표로)
  if (fx.light < 0.99) {
    const p = world.player;
    const r = 80 + fx.light * 520;
    ctx.save();
    ctx.translate(camX, 0);
    const px = p.x - camX,
      py = p.y - p.z - 80;
    const g = ctx.createRadialGradient(px, py, r * 0.35, px, py, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.97)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, 720);
    ctx.restore();
  }
  // 퍼즐: 벽이 조여 온다
  if (fx.squeeze > 0) {
    const w = Math.min(560, fx.squeeze * 560);
    ctx.fillStyle = 'rgba(30,10,50,0.9)';
    ctx.fillRect(camX, 0, w / 2, 720);
    ctx.fillRect(camX + vw - w / 2, 0, w / 2, 720);
  }
  if (fx.red) {
    ctx.fillStyle = 'rgba(160,0,0,0.12)';
    ctx.fillRect(camX, 0, vw, 720);
  }
}
