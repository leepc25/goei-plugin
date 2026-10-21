// 스테이지 자료 → 엔진 FloorPlan (docs/게임_모듈_연결.md). 배경·전경 그리기도 여기서 한다(회색 상자, 그림 없음).
import type { Encounter, FloorPlan, PropSpec, SpawnSpec, WorldView } from '../engine/contract';
import { depthLabel } from './data/floortypes';
import { CHUNK_W, ROOM_W, Y_BOTTOM, Y_TOP, laneY, type Floor, type FloorSegment, type Palette, type ServiceCell, type ServiceZone, type Terrain } from './types';
import type { ElevatorButton } from './elevator';
import { FLOOR_TYPES } from './data/floortypes';
import { drawFloor, drawWallCell, placeFor } from '../art/bg';

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
    const place = placeFor(plan.stage.where, plan.stage.floor?.type, s.ref);
    if (drawWallCell(ctx, place, s.ref, s.x, s.w, s.flip, y0)) {
      if (!drawFloor(ctx, place, s.x, s.x + s.w, y0, 720)) {
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
    ctx.fillStyle = room ? pal.accent : 'rgba(255,255,255,0.3)';
    ctx.font = '14px monospace';
    ctx.fillText(room ? roomName(s.ref) : `${s.ref.slice(6)}${s.flip ? ' ⇄' : ''}`, s.x + 10, CEIL + 24);
  }
  // 지형은 조각을 다 깐 뒤에 (이웃 조각 바닥에 덮이지 않게)
  for (const s of segs) if (!(s.x + s.w < vx0 || s.x > vx1)) for (const t of s.terrain) drawTerrain(ctx, t, pal, y0, y1);
  void CHUNK_W;
}

function roomName(ref: string): string {
  return ({ 'room:elevator_hall': '엘리베이터 홀', 'room:guardian_room': '수호자 방', 'room:trial_goal': '시험 목표 방', 'room:attic': '다락방', 'room:exit_hall': '출구 홀', 'room:car': '승강기 안' } as Record<string, string>)[ref] ?? ref;
}

function drawTerrain(ctx: CanvasRenderingContext2D, t: Terrain, pal: Palette, y0: number, y1: number) {
  const w = t.x1 - t.x0;
  switch (t.kind) {
    case 'pit': {
      ctx.fillStyle = '#000';
      ctx.fillRect(t.x0, y0 - 2, w, 720 - y0 + 2);
      ctx.strokeStyle = '#ff5050';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(t.x0, y0, w, 720 - y0);
      ctx.setLineDash([]);
      label(ctx, '구덩이 (점프)', t.x0 + 4, y0 + 20, '#ff8080');
      break;
    }
    case 'block':
      // 바닥 띠 전체를 가로지르는 단: 윗면(밝게) + 앞면
      ctx.fillStyle = pal.trim;
      ctx.fillRect(t.x0, y0 - t.h, w, y1 - y0 + t.h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(t.x0, y0 - t.h, w, y1 - y0);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(t.x0, y1 - t.h, w, t.h);
      label(ctx, `단 ${t.h} (점프)`, t.x0 + 4, y0 - t.h - 6, '#ddd');
      break;
    case 'low':
      // 머리 높이로 내려온 배관 (바닥 띠 전체 위)
      ctx.fillStyle = 'rgba(90,90,90,0.85)';
      ctx.fillRect(t.x0, y0 - 230, w, 46);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = t.x0; x < t.x1; x += 24) ctx.fillRect(x, y0 - 230, 4, 46);
      ctx.fillStyle = 'rgba(255,210,120,0.08)';
      ctx.fillRect(t.x0, y0, w, y1 - y0);
      label(ctx, '낮은 천장 (앉아서)', t.x0 + 4, y0 - 236, '#ffd27a');
      break;
    case 'narrow': {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const a = laneYIn(t.lane0, y0, y1),
        b = laneYIn(t.lane1, y0, y1);
      if (a > y0) ctx.fillRect(t.x0, y0, w, a - y0);
      if (b < y1) ctx.fillRect(t.x0, b, w, y1 - b + 30);
      break;
    }
    case 'redfloor': {
      ctx.fillStyle = 'rgba(200,20,20,0.55)';
      ctx.fillRect(t.x0, laneYIn(t.lane0, y0, y1), w, laneYIn(t.lane1, y0, y1) - laneYIn(t.lane0, y0, y1));
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
function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.font = '13px monospace';
  ctx.fillText(s, x, y);
}

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
    ctx.fillStyle = '#ffb0b0';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('뒤에서 오는 것 ▶', fx.chaseX - 200, 340);
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
