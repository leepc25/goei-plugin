// 스테이지 자료 → 엔진 FloorPlan (docs/게임_모듈_연결.md). 배경·전경 그리기도 여기서 한다(회색 상자, 그림 없음).
import { drawPropArt, isStandBoard, propArtSize, wallDecoSpans } from '../art/bg';
import type { Encounter, FloorPlan, PropSpec, SpawnSpec, WorldView } from '../engine/contract';
import { depthLabel } from './data/floortypes';
import { CHUNK_W, ROOM_W, Y_BOTTOM, Y_TOP, laneY, type Floor, type FloorSegment, type Palette, type ServiceCell, type ServiceZone, type SideRoom, type Terrain } from './types';
import type { ElevatorButton } from './elevator';
import { FLOOR_TYPES } from './data/floortypes';
import { drawFloor, drawLedge, drawLowRow, setFloorTone, drawPipeBundle, floorHasGrid, isHighSign, floorPattern, drawWallCell, placeFor, seamPillar, wallSolidSpans } from '../art/bg';

/** FloorPlan에 붙여 두는 스테이지 정보 (엔진은 몰라도 된다) */
export interface StagePlan extends FloorPlan {
  stage: {
    where: 'floor' | 'car' | 'service' | 'ending' | 'side';
    terrain: Terrain[];
    floor?: Floor;
    cell?: ServiceCell;
    zone?: ServiceZone;
    side?: SideRoom;
    buttons?: ElevatorButton[];
    /** 층 tick이 그리는 덮개 상태 (어둠·추격 벽·조임) */
    fx: { light: number; chaseX: number; squeeze: number; noise: number; red: boolean };
  };
}

/** 좁은 길 뒷줄: 사물함 자리(가운데 x들)와 그 그림이 차지하는 월드 x 구간.
 * 층 tick은 이 구간 전체에서 사물함 뒤 깊이로 못 들어가게 막는다 (검수 16-1).
 * 이웃 좁은 길(지그재그 미로)과는 사이 가운데까지만 쓰고, 사물함을 그 안에 맞춰 놓는다: 그림이 막힌 구간 밖으로 삐져나오면 그 뒤에 몸이 숨는다 (검수 18-1).
 * 사물함 한 칸(화면 252px)도 안 들어가는 좁은 틈은 낮은 차단대(xs 빈 배열)로. 뒷줄이 없으면 null. */
export function narrowBack(t: Terrain, terr: readonly Terrain[] = []): { span: [number, number]; xs: number[] } | null {
  if (t.kind !== 'narrow' || t.lane0 <= 0) return null;
  const H = 126;
  const xs: number[] = [];
  for (let x = t.x0 + 50; x < t.x1 - 20; x += 100) xs.push(x);
  if (!xs.length) xs.push((t.x0 + t.x1) / 2);
  let a = xs[0] - H,
    b = xs[xs.length - 1] + H;
  let clipped = false;
  for (const o of terr) {
    if (o === t || o.kind !== 'narrow') continue;
    if (o.x1 <= t.x0 && (o.x1 + t.x0) / 2 > a) (a = (o.x1 + t.x0) / 2), (clipped = true);
    else if (o.x0 >= t.x1 && (t.x1 + o.x0) / 2 < b) (b = (t.x1 + o.x0) / 2), (clipped = true);
  }
  // 벽 그림의 문·명패·게시판·액자·창 앞 사물함은 뺀다(그 칸은 낮은 차단대): 키 큰 사물함이 벽 그림을 가렸다 (검수 23)
  const wall = lockerWall.get(t);
  const open = (xs: number[]) => (wall ? xs.filter((x) => !wall.spans.some(([s0, s1]) => x + wall.half > s0 && x - wall.half < s1)) : xs);
  if (!clipped) return { span: [a, b], xs: open(xs) };
  if (b - a < 2 * H) return { span: [Math.max(a, t.x0 - 20), Math.min(b, t.x1 + 20)], xs: [] };
  const fit: number[] = [];
  for (let x = a + H; x <= b - H; x += 100) fit.push(x);
  if (fit[fit.length - 1] < b - H - 1) fit.push(b - H);
  return { span: [a, b], xs: open(fit) };
}
/** floorPlan이 채운다: 좁은 길마다 피할 벽 그림 구간과 사물함 그림 절반 폭 */
const lockerWall = new WeakMap<Terrain, { spans: [number, number][]; half: number }>();
export const narrowBackSpan = (t: Terrain, terr: readonly Terrain[] = []): [number, number] | null => narrowBack(t, terr)?.span ?? null;

const NOLOCK_TYPES = new Set(['chase', 'deep']);

/** 메트로배니아 소품은 이미 있는 그림 종류로 그린다 (그림 없는 종류는 엔진이 안 그린다). 뜻은 module이 placed.kind로 가른다 */
export const METRO_ART: Record<string, string> = { upper: 'chasedoor', sidedoor: 'door', locked: 'firegate', wdoor: 'door', wup: 'hq_stairs_up', wdown: 'hq_stairs_down', reward: 'pack' };
/** 심층은 사람 건물이 아니다: 위로는 매달린 줄, 아래로는 무너진 바닥 */
const DEEP_ART: Record<string, string> = { wup: 'rope', wdown: 'fall' };

export function floorPlan(f: Floor, id: string, startX = 240): StagePlan {
  const props: PropSpec[] = f.placed.map((p) => ({
    id: `p${p.id}`,
    kind: (f.type === 'deep' ? DEEP_ART[p.kind] : undefined) ?? METRO_ART[p.kind] ?? p.kind,
    x: p.x,
    y: laneY(p.lane),
    w: p.w,
    h: propH(p.kind),
    label: p.kind === 'item' && p.data.item ? `${p.label}:${p.data.item}` : p.label, // 보급품:ammo → 바닥 그림을 종류대로 (itemsLink drawSupply)
    solid: p.kind === 'shutter' ? !p.data.open : p.kind === 'locked' ? true : undefined,
  }));
  // 천장 해치 = 벽에 기대 세운 사다리: 복도 한가운데가 아니라 벽선에 (검수 21)
  for (const p of props) if (p.kind === 'hatch') p.y = Y_TOP;
  // 승객·사는 척하는 주민·로비의 직원은 처음에 소품(말 걸 수 있음)이고, 규칙을 어기면 층 tick이 적으로 바꾼다
  for (const s of f.spawns) {
    if (s.role === 'passenger') props.push({ id: `h${s.id}`, kind: 'passenger', x: s.x, y: laneY(s.lane), w: 50, h: 150, label: '떠도는 승객' });
    if (s.role === 'resident') props.push({ id: `h${s.id}`, kind: 'npc', x: s.x, y: laneY(s.lane), w: 50, h: 150, label: '주민 (사는 척)' });
    if (s.role === 'enemy' && s.data.harmless) props.push({ id: `h${s.id}`, kind: 'npc', x: s.x, y: laneY(s.lane), w: 50, h: 150, label: '평범한 직원' });
  }
  const doorSpans = spreadProps(f, props, startX);
  const lockerHalf = (propArtSize('clutter', '사물함')?.w ?? 150) / 2;
  for (const sg of f.segments) for (const t of sg.terrain) if (t.kind === 'narrow') lockerWall.set(t, { spans: doorSpans, half: lockerHalf });
  // 싸움 구간: 조각마다 적 자리를 묶는다. 추격·B-12는 화면을 잠그지 않으므로 층 tick이 직접 부른다.
  const encounters: Encounter[] = [];
  if (!NOLOCK_TYPES.has(f.type)) {
    const groups = new Map<number, SpawnSpec[][]>();
    for (const s of f.spawns.filter((s) => s.role === 'enemy' && !s.data.harmless)) {
      const seg = segAt(f.segments, s.x);
      const waves = groups.get(seg.x) ?? [[], []];
      waves[Math.min(1, s.wave)].push({ kind: s.kind, x: s.x, y: clearOfProps(props, s.x, laneY(s.lane)), elite: s.elite || undefined });
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
    // 방은 네 방향에서 들어온다. 방 전체를 한 전투로 묶어 역방향 진입 때
    // 이전 구간에 가두거나 적을 화면 밖에 남기는 일을 막는다.
    if (f.room && encounters.length) {
      const waves = encounters.flatMap(e => e.waves);
      encounters.splice(0, encounters.length, { triggerX: 0, lockFrom: 0, lockTo: f.width, waves });
    }
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
    keepOut: doorSpans,
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
  // 칸 싸움: 칸 가운데에서 한 판 (들어온 쪽 반대편에서 나온다)
  const fight = z.fights?.[`${cell.col},${cell.row}`];
  const encounters: Encounter[] = fight?.length
    ? [{ triggerX: 0, lockFrom: 0, lockTo: ROOM_W, waves: [fight.map((kind, i) => ({ kind, x: startX < 640 ? 980 - i * 120 : 300 + i * 120, y: laneY(30 + ((i * 53) % 110)) }))] }]
    : [];
  const plan: StagePlan = {
    id,
    title: `정비 구역 (${depthLabel(z.depth)} 아래) · ${cell.label}`,
    type: 'service',
    depth: z.depth,
    length: cell.width,
    lane: [Y_TOP, Y_BOTTOM],
    startX,
    exitX: Infinity,
    encounters,
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

/** 곁가지 방 (한 화면): 들어온 층의 벽 그림·팔레트 그대로, 왼쪽에 나가는 문, 오른쪽에 보상 배낭. 싸움이 있으면 배낭은 이긴 뒤에 */
export function sidePlan(room: SideRoom, parent: Floor, id: string): StagePlan {
  const props: PropSpec[] = [{ id: 'xback', kind: 'door', x: 170, y: Y_TOP, w: 90, h: 180, label: '나가는 문 (복도로)' }];
  for (const l of room.loot) {
    if (l.kind === 'chest') props.push({ id: 'xchest', kind: 'pack', x: l.x, y: laneY(90), w: 60, h: 60, label: '선배가 남긴 배낭 (강화)' });
    else if (l.kind === 'gear') props.push({ id: 'xgear', kind: 'gear', x: l.x, y: laneY(130), w: 50, h: 50, label: '용도 모를 장비' });
    else props.push({ id: `xitem${l.x}`, kind: 'item', x: l.x, y: laneY(120), w: 28, h: 28, label: `보급품:${l.item ?? 'heal'}` });
  }
  const segs: FloorSegment[] = [
    { ref: `chunk:side_${room.door}_a`, x: 0, w: CHUNK_W, flip: false, terrain: [] },
    { ref: `chunk:side_${room.door}_b`, x: CHUNK_W, w: CHUNK_W, flip: true, terrain: [] },
  ];
  const encounters: Encounter[] = room.fight.length
    ? [{ triggerX: 330, lockFrom: 0, lockTo: ROOM_W, waves: [room.fight.map((kind, i) => ({ kind, x: 780 + i * 130, y: laneY(20 + ((i * 61) % 130)), elite: (room.elite && i === 0) || undefined }))] }]
    : [];
  const plan: StagePlan = {
    id,
    title: `${parent.label} · ${room.label}`,
    type: parent.type,
    depth: parent.depth,
    length: ROOM_W,
    lane: [Y_TOP, Y_BOTTOM],
    startX: 260,
    exitX: Infinity,
    encounters,
    props,
    palette: { wall: room.palette.wall, floor: room.palette.floor, accent: room.palette.accent },
    banner: room.secret ? `숨은 방 · ${room.label}` : room.label,
    stage: { where: 'side', terrain: [], floor: parent, side: room, fx: { light: 1, chaseX: -9999, squeeze: 0, noise: 0, red: false } },
  };
  plan.drawBackground = (ctx, camX) => drawBack(ctx, camX, segs, room.palette, plan);
  plan.drawForeground = (ctx, camX, world) => drawFront(ctx, camX, world, plan);
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

/* ── 소품 겹침 금지 (검수 12-2) ──
   기능이 있는 자리(문·승강기·패널·스위치·셔터·해치…)는 그대로 두고, 꾸밈 소품(그림 소품·입간판·탁자·물건·사람)만 옮긴다.
   ① 소품끼리 같은 깊이에서 그림 폭이 겹치지 않게 ② 벽에 붙은 소품은 벽 그림 속 문·가구 앞을 피하게 ③ 지형(단·구덩이·좁은 길) 위에 놓지 않게. */
const FIXED_PROPS = new Set(['firegate', 'hq_stairs_up', 'hq_stairs_down', 'pack', 'crack', 'vent', 'key', 'elevator', 'mirror', 'panel', 'chasedoor', 'b12', 'goalwall', 'switch', 'shutter', 'door', 'servicedoor', 'rope', 'up', 'down', 'fall', 'ladder_up', 'ladder_down', 'left', 'right', 'intercom', 'button', 'getoff', 'close', 'greet']);
const BOARD_GAP = 1400;
// 소품 그림 폭: 그림이 있으면 그 실제 폭(자판기·소파처럼 넓은 것이 문·명패를 가렸다, 검수 22), 없으면 종류별 기본
const artW = (p: PropSpec, floorType?: string) => {
  const base = Math.max(p.w, p.kind === 'firegate' ? 170 : 0, p.kind === 'item' || p.kind === 'belonging' || p.kind === 'mark' ? 60 : p.kind === 'passenger' || p.kind === 'npc' ? 80 : 130);
  if (p.kind === 'item' || p.kind === 'belonging' || p.kind === 'mark' || p.kind === 'passenger' || p.kind === 'npc') return base;
  return Math.max(base, propArtSize(p.kind, p.label, floorType)?.w ?? 0);
};

function spreadProps(f: Floor, props: PropSpec[], startX: number): [number, number][] {
  const wallY = Y_TOP + 40;
  const keepOut: [number, number][] = [];
  for (const sg of f.segments) keepOut.push(...wallSolidSpans(placeFor('floor', f.type, sg.ref, f.sub, f.depth), sg.x, sg.w, sg.flip));
  const wallDoors = keepOut.filter(([a, b]) => b - a >= 100);
  const terr = f.segments.flatMap((sg) => sg.terrain).filter((t) => t.kind === 'block' || t.kind === 'pit' || t.kind === 'narrow' || t.kind === 'low');
  const taken: { a: number; b: number; y: number }[] = [];
  // 갈림길·규칙 표지는 순서가 뜻이라 그대로
  const meaning = new Set(f.placed.filter((q) => q.data.fork !== undefined || q.data.group !== undefined).map((q) => `p${q.id}`));
  // 규칙 표지는 지우지 않지만(읽어야 한다) 겹치면 옮긴다
  const ruled = new Set(f.placed.filter((q) => q.data.rule).map((q) => `p${q.id}`));
  // 잠긴 셔터 앞 해치는 열쇠 길이다. 같은 쪽에서 벽 그림을 피하도록 옮긴다.
  const gateX = f.placed.find((q) => q.kind === 'locked')?.x ?? -1;
  const fixed = (p: PropSpec) => FIXED_PROPS.has(p.kind) || meaning.has(p.id) || (p.kind !== 'hatch' && p.x < startX + 60 && (!f.room || ruled.has(p.id)));
  // 입간판(로비 6번 판 그림으로 그려지는 것 전부)은 한 화면에 하나 (검수 13-2, 14-1: 화면마다 2~3개, 같은 「비상구」 둘이 나란히).
  // 규칙·갈림길 표지는 남기고, 뜻 없는 꾸밈 판은 다른 판과 1400px 안이거나 앞 판과 같은 것이면 뺀다.
  const boardLike = (p: PropSpec) => isStandBoard(p.kind, p.label, f.type) && !isHighSign(p.kind, p.label);
  const must = (p: PropSpec) => meaning.has(p.id) || ruled.has(p.id);
  // 판 자리: 고정된 판(갈림길·순서) → 규칙 표지 → 꾸밈 판 순으로 잡는다. 꾸밈 판은 자리가 없거나, 넷째거나, 바로 앞 판과 같은 그림이면 뺀다.
  const kept: PropSpec[] = props.filter((p) => boardLike(p) && fixed(p));
  const decor = new Set(props.filter((p) => boardLike(p) && !must(p) && !fixed(p)));
  // 벽 그림의 게시판·액자·창 앞에도 벽 쪽 소품을 세우지 않는다 (검수 14-1)
  for (const sg of f.segments) keepOut.push(...wallDecoSpans(placeFor('floor', f.type, sg.ref, f.sub, f.depth), sg.x, sg.w, sg.flip));
  // 점검문(철문)은 덩이 안 자리만 정해져 있다: 벽 그림의 문·게시판 앞이면 가까운 빈 벽으로 민다 (검수 22: 철문이 게시판을 가림)
  for (const p of props.filter((q) => q.kind === 'servicedoor' || (q.kind === 'chasedoor' && f.placed.some((z) => `p${z.id}` === q.id && z.kind === 'upper')) || (q.kind === 'door' && f.placed.some((z) => `p${z.id}` === q.id && z.kind === 'sidedoor')) || q.kind === 'crack')) {
    const h = artW(p, f.type) / 2;
    // 잠긴 셔터 앞 정비 구역 입구는 밀려도 셔터 앞에 남아야 한다 (열쇠를 가지러 갈 길)
    const gate = gateX >= 0 ? { x: gateX } : null;
    const side = gate ? Math.sign(p.x - gate.x) : 0;
    const ok = (x: number) =>
      x - h >= 40 && x + h <= f.width - 40 &&
      (!gate || Math.sign(x - gate.x) === side && Math.abs(x - gate.x) > h + 120) &&
      !keepOut.some(([a, b]) => x + h + 8 > a && x - h - 8 < b) &&
      !terr.some((t) => x + h > t.x0 - 20 && x - h < t.x1 + 20) &&
      !props.some((q) => q !== p && (q.kind === 'shutter' || q.kind === 'firegate') && Math.abs(q.x - x) < h + 120) &&
      !props.some((q) => q !== p && fixed(q) && Math.abs(q.y - p.y) < 90 && Math.abs(q.x - x) < h + artW(q, f.type) / 2 + 16);
    if (ok(p.x)) continue;
    let x: number | null = null;
    for (let d = 24; d <= 1600 && x === null; d += 24) x = ok(p.x + d) ? p.x + d : ok(p.x - d) ? p.x - d : null;
    // 벽이 문으로 꽉 찬 층(퍼즐·추격): 빈 벽이 없으면 벽 그림의 문 하나를 통째로 덮어 그 문이 철문이 되게 한다
    if (x === null)
      for (const [a, b] of [...wallDoors].sort((u, v) => Math.abs((u[0] + u[1]) / 2 - p.x) - Math.abs((v[0] + v[1]) / 2 - p.x))) {
        const c = (a + b) / 2;
        if (b - a > 2 * h || keepOut.some(([a2, b2]) => (a2 !== a || b2 !== b) && c + h > a2 && c - h < b2)) continue;
        if (terr.some((t) => c + h > t.x0 - 20 && c - h < t.x1 + 20) || props.some((q) => q !== p && fixed(q) && Math.abs(q.y - p.y) < 90 && Math.abs(q.x - c) < h + artW(q, f.type) / 2 + 16)) continue;
        x = c;
        break;
      }
    if (x !== null) p.x = x;
  }
  // 갈림길·순서 표지(자리가 뜻이라 고정)도 문·벽 문·다른 고정 소품을 가리면 가까운 빈 벽으로 조금만 민다 (뜻이 바뀌지 않는 거리 안)
  for (const p of props.filter((q) => boardLike(q) && meaning.has(q.id))) {
    const h = artW(p, f.type) / 2;
    // 잠긴 셔터 앞 정비 구역 입구는 밀려도 셔터 앞에 남아야 한다 (열쇠를 가지러 갈 길)
    const gate = gateX >= 0 ? { x: gateX } : null;
    const side = gate ? Math.sign(p.x - gate.x) : 0;
    const ok = (x: number) =>
      x - h >= 40 && x + h <= f.width - 40 &&
      (!gate || Math.sign(x - gate.x) === side && Math.abs(x - gate.x) > h + 120) &&
      !keepOut.some(([a, b]) => x + h + 6 > a && x - h - 6 < b) &&
      !props.some(q => q !== p && q.solid && Math.abs(q.x - x) < 120) &&
      !props.some((q) => q !== p && fixed(q) && !boardLike(q) && Math.abs(q.y - p.y) < 90 && Math.abs(q.x - x) < h + artW(q, f.type) / 2 + 12);
    if (ok(p.x)) continue;
    for (let d = 12; d <= 360; d += 12) {
      if (ok(p.x - d)) {
        p.x -= d;
        break;
      }
      if (ok(p.x + d)) {
        p.x += d;
        break;
      }
    }
  }
  for (const p of props) if (fixed(p)) taken.push({ a: p.x - artW(p, f.type) / 2, b: p.x + artW(p, f.type) / 2, y: p.y });
  // 잠긴 방화셔터는 복도 깊이 전체를 막는다: 앞뒤 어느 줄에도 E로 잡힐 것을 붙여 두지 않는다 (가장 가까운 것 하나만 잡힌다)
  for (const g of f.placed.filter((q) => q.kind === 'locked')) for (const y of [Y_TOP, (Y_TOP + Y_BOTTOM) / 2, Y_BOTTOM]) taken.push({ a: g.x - 150, b: g.x + 150, y });
  const free = (p: PropSpec, x: number) => {
    const h = artW(p, f.type) / 2;
    if (p.kind === 'hatch' && p.x < gateX && x + h + 120 >= gateX) return false;
    // E 선택은 깊이(y)를 보지 않는다. 다른 줄의 물건도 필수 장치의
    // x를 차지하면 열쇠·스위치 입력을 가로챌 수 있다.
    if (f.room && f.placed.some(q => (q.data.dir || ['key', 'switch', 'goalwall', 'panel'].includes(q.kind)) && `p${q.id}` !== p.id && Math.abs(q.x - x) < 120)) return false;
    if (props.some(q => q !== p && q.solid && Math.abs(q.x - x) < 120)) return false;
    if (x - h < 40 || x + h > f.width - 40) return false;
    if (taken.some((t) => Math.abs(t.y - p.y) < 90 && x + h + 16 > t.a && x - h - 16 < t.b)) return false;
    if (p.y <= wallY && keepOut.some(([a, b]) => x + h > a && x - h < b)) return false;
    if (terr.some((t) => x + h > t.x0 - 80 && x - h < t.x1 + 80)) return false; // 구덩이·단은 앞쪽이 원근으로 넓어진다
    if (spaced && boardLike(p) && kept.some((q) => q !== p && Math.abs(q.x - x) <= BOARD_GAP)) return false;
    // 사다리(천장 해치)도 한 화면에 하나
    if (spaced && p.kind === 'hatch' && placed.some((q) => q !== p && q.kind === 'hatch' && Math.abs(q.x - x) <= BOARD_GAP)) return false;
    return true;
  };
  let spaced = true;
  // 한 화면 간격 자리가 없으면(짧은 층에 규칙 표지 셋) 다른 판과 가장 먼 빈자리
  const farthest = (p: PropSpec, reach: number): number | null => {
    spaced = p.kind === 'hatch';
    let best: number | null = null, bd = -1;
    for (let d = -reach; d <= reach; d += 24) {
      const x = p.x + d;
      if (!free(p, x)) continue;
      const md = Math.min(...(p.kind === 'hatch' ? placed.filter((q) => q.kind === 'hatch') : kept).filter((q) => q !== p).map((q) => Math.abs(q.x - x)), 1e9);
      if (md > bd) (bd = md), (best = x);
    }
    spaced = true;
    return best;
  };
  const placed: PropSpec[] = props.filter(fixed);
  const order = (p: PropSpec) => p.kind === 'hatch' ? -1 : (boardLike(p) ? (decor.has(p) ? 1 : 0) : 2);
  for (const p of [...props].filter((q) => !fixed(q)).sort((a, b) => order(a) - order(b) || a.x - b.x)) {
    let x: number | null = null;
    // 판은 다른 판과 한 화면 떨어진 자리를 더 멀리까지 찾는다
    const reach = boardLike(p) || p.kind === 'hatch' ? 1800 : p.y <= wallY ? 900 : 480;
    for (let d = 0; d <= reach; d += 24) {
      if (free(p, p.x + d)) {
        x = p.x + d;
        break;
      }
      if (d && free(p, p.x - d)) {
        x = p.x - d;
        break;
      }
    }
    if (x === null && ((boardLike(p) && !decor.has(p)) || p.kind === 'hatch' || p.kind === 'npc' || p.kind === 'passenger')) x = farthest(p, f.width);
    // 같은 셔터 쪽의 정비구역 입구가 이미 있으면 겹치는 추가 사다리는 생략한다.
    if (x === null && p.kind === 'hatch' && placed.some(q => q.kind === 'hatch' && (q.x < gateX) === (p.x < gateX))) {
      props.splice(props.indexOf(p), 1);
      continue;
    }
    // 짧은 방의 주민·승객이 같은 줄에 몰려도 셔터 앞에 남겨 두지 않는다.
    // 다른 깊이 줄의 빈자리까지 찾되 E 접근 간격은 그대로 지킨다.
    if (x === null && (p.kind === 'npc' || p.kind === 'passenger')) {
      const originalY = p.y;
      for (const y of [Y_BOTTOM - 30, (Y_TOP + Y_BOTTOM) / 2, Y_TOP + 60]) {
        p.y = y;
        x = farthest(p, f.width);
        if (x !== null) break;
      }
      if (x === null) p.y = originalY;
    }
    // 벽에 붙는 꾸밈 소품이 문·명패·벽 장식을 피할 자리가 없으면 빼 버린다 (검수 22: 자판기가 문·게시판을 가림)
    if (x === null && p.kind === 'prop' && p.y <= wallY && !must(p) && p.label !== '거꾸로 가는 시계') {
      props.splice(props.indexOf(p), 1);
      continue;
    }
    if (decor.has(p)) {
      const near = x === null ? null : kept.reduce<PropSpec | null>((n, q) => (!n || Math.abs(q.x - x!) < Math.abs(n.x - x!) ? q : n), null);
      if (x === null || kept.length >= 3 || (near && near.kind === p.kind && near.label === p.label)) {
        props.splice(props.indexOf(p), 1);
        continue;
      }
    }
    // 같은 꾸밈 소품(정수기 둘 등)이 나란히 서지 않게 (검수 14-1 「같은 종류 연속 금지」)
    if (!must(p) && p.kind === 'prop' && placed.some((q) => q.kind === p.kind && q.label === p.label && Math.abs(q.x - (x ?? p.x)) < 640)) {
      props.splice(props.indexOf(p), 1);
      continue;
    }
    p.x = x ?? p.x;
    placed.push(p);
    if (boardLike(p)) kept.push(p);
    taken.push({ a: p.x - artW(p, f.type) / 2, b: p.x + artW(p, f.type) / 2, y: p.y });
  }
  // 문·벽 가구·벽 장식(게시판·액자·창) 구간: 엔진이 들·부술 물건을 놓을 때도 피한다 (검수 22)
  return keepOut;
}

/** 적이 소품 한가운데 서지 않게: 그 자리에 소품이 있으면 깊이를 비켜 선다 */
function clearOfProps(props: PropSpec[], x: number, y: number): number {
  const hit = (yy: number) => props.some((p) => Math.abs(p.y - yy) < 70 && Math.abs(p.x - x) < artW(p) / 2 + 40);
  if (!hit(y)) return y;
  for (const d of [90, -90, 160, -160]) {
    const yy = Math.max(Y_TOP + 10, Math.min(Y_BOTTOM - 10, y + d));
    if (!hit(yy)) return yy;
  }
  return y;
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
  const where = plan.stage.where === 'side' ? 'floor' : plan.stage.where;
  const vx0 = camX - 40,
    vx1 = camX + 1320;
  const cx = camX + 640;
  setFloorTone(where === 'floor' ? (plan.depth ?? 1) : 0);
  for (const s of segs) {
    if (s.x + s.w < vx0 || s.x > vx1) continue;
    const room = s.ref.startsWith('room:');
    const place = placeFor(where, plan.stage.floor?.type, s.ref, plan.stage.floor?.sub, plan.stage.floor?.depth);
    // 바닥은 한 층 안에서 한 가지 (홀·방도 그 층 바닥), 벽 장소가 바뀌는 곳은 기둥으로 잇는다 (통합 검수 2-3)
    const floorPlace = where === 'floor' ? placeFor('floor', plan.stage.floor?.type, '', null, plan.stage.floor?.depth) : place;
    if (drawWallCell(ctx, place, s.ref, s.x, s.w, s.flip, y0)) {
      const i = segs.indexOf(s);
      const prev = i > 0 ? placeFor(where, plan.stage.floor?.type, segs[i - 1].ref, plan.stage.floor?.sub, plan.stage.floor?.depth) : place;
      if (prev !== place) seamPillar(ctx, s.x, y0);
      const next = i + 1 < segs.length ? placeFor(where, plan.stage.floor?.type, segs[i + 1].ref, plan.stage.floor?.sub, plan.stage.floor?.depth) : place;
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
  const allTerr = segs.flatMap((s) => s.terrain);
  for (const s of segs) if (!(s.x + s.w < vx0 || s.x > vx1)) for (const t of s.terrain) drawTerrain(ctx, t, pal, y0, y1, placeFor(where, plan.stage.floor?.type, where === 'floor' ? '' : s.ref, plan.stage.floor?.sub, plan.stage.floor?.depth), layers, allTerr);
  drawMetro(ctx, plan, vx0, vx1, y0);
  void CHUNK_W;
}

/** 메트로배니아 소품 중 그림 묶음에 없는 것: 금 간 벽·막힌 덕트·정비 열쇠는 코드 도트로. 위층 점검문·곁가지 문 위에는 작은 비상등 */
function drawMetro(ctx: CanvasRenderingContext2D, plan: StagePlan, vx0: number, vx1: number, y0: number) {
  const P = 3;
  const f = plan.stage.floor;
  for (const p of plan.props ?? []) {
    if (p.x < vx0 - 100 || p.x > vx1 + 100) continue;
    const x = Math.round(p.x);
    const pl = f && p.id.startsWith('p') ? f.placed.find((z) => `p${z.id}` === p.id) : undefined;
    if (p.kind === 'crack') {
      const broken = !!p.label?.includes('부서진');
      ctx.save();
      if (broken) {
        // 뚫린 구멍 + 깨진 가장자리 + 바닥 잔해
        ctx.fillStyle = '#0b0a09';
        ctx.beginPath();
        ctx.moveTo(x - 50, y0 - 6);
        ctx.lineTo(x - 56, y0 - 120);
        ctx.lineTo(x - 30, y0 - 168);
        ctx.lineTo(x + 18, y0 - 176);
        ctx.lineTo(x + 52, y0 - 130);
        ctx.lineTo(x + 48, y0 - 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6b6258';
        for (let i = 0; i < 9; i++) ctx.fillRect(x - 64 + ((i * 37) % 128), y0 + 4 + ((i * 13) % 18), P * 3, P * 2);
      } else {
        ctx.strokeStyle = 'rgba(20,16,12,0.85)';
        ctx.lineWidth = P;
        const lines = [
          [0, -30, -20, -70, -8, -110, -34, -150],
          [0, -30, 24, -64, 14, -100, 40, -138],
          [-8, -110, 10, -126],
          [14, -100, -4, -84],
        ];
        for (const l of lines) {
          ctx.beginPath();
          ctx.moveTo(x + l[0], y0 + l[1]);
          for (let i = 2; i < l.length; i += 2) ctx.lineTo(x + l[i], y0 + l[i + 1]);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x - 22, y0 - 74, P * 2, P);
        ctx.fillRect(x + 20, y0 - 66, P * 2, P);
      }
      ctx.restore();
    } else if (p.kind === 'firegate') {
      // 잠긴 방화셔터: 벽 아래까지 내려온 철제 셔터 + 바닥 경고띠 + 열쇠 구멍 (전용 그림이 없어 코드로)
      const hw = 74,
        top = y0 - 236;
      ctx.fillStyle = '#1a1c1f';
      ctx.fillRect(x - hw - 10, top - 26, hw * 2 + 20, 30);
      ctx.fillStyle = '#3b4046';
      ctx.fillRect(x - hw - 6, top - 22, hw * 2 + 12, 20);
      ctx.fillStyle = '#26292d';
      ctx.fillRect(x - hw - 10, top, 10, y0 - top + 4);
      ctx.fillRect(x + hw, top, 10, y0 - top + 4);
      for (let yy = top; yy < y0; yy += 12) {
        ctx.fillStyle = '#7d848b';
        ctx.fillRect(x - hw, yy, hw * 2, 9);
        ctx.fillStyle = '#5a6168';
        ctx.fillRect(x - hw, yy + 9, hw * 2, 3);
        ctx.fillStyle = '#9aa1a8';
        ctx.fillRect(x - hw, yy, hw * 2, 2);
      }
      ctx.fillStyle = '#3c4146';
      ctx.fillRect(x - hw, y0 - 14, hw * 2, 14);
      // 경고 판 + 열쇠 구멍
      ctx.fillStyle = '#c23a2c';
      ctx.fillRect(x - 30, top + 70, 60, 34);
      ctx.fillStyle = '#ffe9d0';
      ctx.fillRect(x - 24, top + 78, 48, 4);
      ctx.fillRect(x - 24, top + 90, 30, 4);
      ctx.fillStyle = '#e8c35a';
      ctx.fillRect(x + hw - 30, y0 - 90, 18, 26);
      ctx.fillStyle = '#1a1408';
      ctx.fillRect(x + hw - 23, y0 - 84, 4, 8);
      ctx.fillRect(x + hw - 22, y0 - 76, 2, 6);
      // 바닥 경고띠 (복도 깊이 전체)
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = i % 2 ? '#1a1a1a' : '#d9b02a';
        ctx.beginPath();
        ctx.moveTo(x - hw + i * 15, y0);
        ctx.lineTo(x - hw + i * 15 + 15, y0);
        ctx.lineTo(x - hw + i * 15 + 5, y0 + 250);
        ctx.lineTo(x - hw + i * 15 - 10, y0 + 250);
        ctx.closePath();
        ctx.fill();
      }
    } else if (p.kind === 'vent') {
      const open = !!p.label?.includes('열린');
      const vy = y0 - 64;
      ctx.fillStyle = '#2a2d30';
      ctx.fillRect(x - 40, vy, 80, 48);
      ctx.fillStyle = open ? '#050505' : '#575d62';
      ctx.fillRect(x - 34, vy + 6, 68, 36);
      if (!open) {
        ctx.fillStyle = '#2f3336';
        for (let i = 0; i < 6; i++) ctx.fillRect(x - 34, vy + 9 + i * 6, 68, P);
        ctx.fillStyle = '#8a8f93';
        for (const [dx, dy] of [[-36, 2], [32, 2], [-36, 40], [32, 40]]) ctx.fillRect(x + dx, vy + dy, P, P);
      }
    } else if (p.kind === 'key') {
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 300;
      const ky = Math.round(p.y - 40 + Math.sin(t) * 4);
      ctx.save();
      ctx.fillStyle = 'rgba(255,214,110,0.22)';
      ctx.beginPath();
      ctx.arc(x, ky, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2a08';
      ctx.fillRect(x - 16, ky - 10, 14, 20);
      ctx.fillRect(x - 4, ky - 3, 26, 6);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(x - 13, ky - 7, 8, 14);
      ctx.fillRect(x - 2, ky - 1, 22, 3);
      ctx.fillRect(x + 12, ky + 2, 3, 6);
      ctx.fillRect(x + 18, ky + 2, 3, 5);
      ctx.fillStyle = '#3a2a08';
      ctx.fillRect(x - 10, ky - 3, 3, 6);
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - 18, Math.round(p.y) - 4, 36, 6);
    } else if (pl && (pl.kind === 'upper' || pl.kind === 'sidedoor')) {
      // 문 위 작은 비상등: 위층 점검문은 열렸으면 초록·잠겼으면 빨강, 곁가지 문은 호박색 (보상을 받으면 꺼진다)
      const h = propArtSize(p.kind, p.label, f?.type)?.h ?? 190;
      const ly = Math.round(Y_TOP - h - 18);
      const col = pl.kind === 'upper' ? (p.label?.includes('열림') ? '#5fe08a' : '#e0503c') : p.label?.includes('비었다') ? '#3a3a3a' : '#ffb840';
      ctx.fillStyle = '#1c1f22';
      ctx.fillRect(x - 12, ly - 4, 24, 14);
      ctx.fillStyle = col;
      ctx.fillRect(x - 8, ly, 16, 6);
      if (!p.label?.includes('비었다')) {
        ctx.fillStyle = col + '33';
        ctx.fillRect(x - 20, ly - 10, 40, 26);
      }
    }
  }
}

function roomName(ref: string): string {
  return ({ 'room:elevator_hall': '엘리베이터 홀', 'room:guardian_room': '수호자 방', 'room:trial_goal': '시험 목표 방', 'room:attic': '다락방', 'room:exit_hall': '출구 홀', 'room:car': '승강기 안' } as Record<string, string>)[ref] ?? ref;
}

/** 공사 차단대 줄: 길 폭을 같은 너비 차단대 n개로 나눈다 (끝에 기둥 하나짜리 조각이 남지 않게, 검수 14-2).
 * 좁은 칸(폭 80)도 기둥 둘 + 가로대 한 벌(폭 160)로, 칸 가운데에. fy = 받침이 닿는 바닥 y */
function drawBarricade(ctx: CanvasRenderingContext2D, x0: number, x1: number, fy: number) {
  const w = x1 - x0;
  const bw = Math.max(w, 160),
    bx0 = x0 + (w - bw) / 2;
  const n = Math.max(1, Math.round((bw - 20) / 170)),
    sw = (bw - 20) / n;
  for (let i = 0; i < n; i++) {
    const x = Math.round(bx0 + 10 + i * sw),
      x2 = Math.round(bx0 + 10 + (i + 1) * sw - 10);
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

export function drawTerrain(ctx: CanvasRenderingContext2D, t: Terrain, pal: Palette, y0: number, y1: number, place = '', layers?: NonNullable<StagePlan['depthLayers']>, segTerrain: readonly Terrain[] = []) {
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
      // 낮은 천장: 천장에서 내려온 보(콘크리트 덩어리) + 그 밑면을 따라 붙은 배관. 공중에 뜬 원통이 아니라 천장 구조물로 읽히게 (검수 12-3)
      const x0 = Math.round(t.x0 / 4) * 4,
        x1 = Math.round(t.x1 / 4) * 4;
      const by = Math.round((y0 - 236) / 4) * 4; // 보 밑면
      // 배관 그림(어둠 층 물건 3번)을 천장부터 밑면까지 다발로 쌓는다. 그림이 없으면 아래 코드 보
      if (drawPipeBundle(ctx, x0, x1, by + 32)) break;
      // 보 몸통: 위는 천장 그늘, 아래로 밝아지는 3단 + 밑면 모서리
      const bands: [number, string][] = [[0.45, '#2b2c2e'], [0.3, '#45474a'], [0.25, '#5b5e61']];
      let yy = 0;
      for (const [k, c] of bands) {
        const h = Math.round((by * k) / 4) * 4;
        ctx.fillStyle = c;
        ctx.fillRect(x0, yy, x1 - x0, h);
        yy += h;
      }
      ctx.fillStyle = '#5b5e61';
      ctx.fillRect(x0, yy, x1 - x0, by - yy);
      ctx.fillStyle = '#8a8d8f';
      ctx.fillRect(x0, by - 8, x1 - x0, 4);
      ctx.fillStyle = '#1c1d1f';
      ctx.fillRect(x0, by - 4, x1 - x0, 4);
      // 양 끝 그늘 면 (두께)
      ctx.fillStyle = '#232426';
      ctx.fillRect(x0, 0, 8, by);
      ctx.fillRect(x1 - 8, 0, 8, by);
      // 거푸집 자국·얼룩
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let x = x0 + 40; x < x1 - 20; x += 96) ctx.fillRect(x, 24, 4, by - 40);
      ctx.fillStyle = 'rgba(90,60,40,0.35)';
      for (let x = x0 + 60; x < x1 - 30; x += 150) ctx.fillRect(x, by - 28, 20, 12);
      // 밑면 배관 (보에 붙은 두 줄, 4px 색 띠) + 띠쇠
      const pipe = (py: number, ph: number) => {
        const cs = ['#2a2d2e', '#7c8280', '#b9bdba', '#6a706f', '#3a3f41'];
        const st = ph / cs.length;
        cs.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect(x0 + 8, py + Math.round(i * st), x1 - x0 - 16, Math.ceil(st));
        });
      };
      pipe(by, 20);
      pipe(by + 20, 12);
      for (let x = x0 + 32; x < x1 - 24; x += 112) {
        ctx.fillStyle = '#1e2021';
        ctx.fillRect(x, by - 2, 8, 36);
        ctx.fillStyle = '#9a9e9c';
        ctx.fillRect(x + 2, by, 2, 30);
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
        const nb = narrowBack(t, segTerrain)!;
        layers.push({ y: a, x0: nb.span[0], x1: nb.span[1], draw: (c) => {
          // 뒷줄도 낮은 턱 그림 줄로 (독립 검수: 차단대가 붙어 몰림). 그림이 없을 때만 차단대
          if (!nb.xs.length) return void (drawLowRow(c, nb.span[0], nb.span[1], a, nb.span[0] + 7) || drawBarricade(c, nb.span[0], nb.span[1], a));
          // 사물함을 뺀 칸(벽 그림 앞)은 차단대로 메운다: 먼저 차단대, 그 위에 사물함
          const half = (propArtSize('clutter', '사물함')?.w ?? 150) / 2;
          let from = nb.span[0];
          for (const x of [...nb.xs, Infinity]) {
            const to = x === Infinity ? nb.span[1] : x - half;
            if (to - from > 40 && !drawLowRow(c, from, to, a, from + 7)) drawBarricade(c, from, to, a);
            from = Math.max(from, x + half);
          }
          for (const x of nb.xs) if (!drawPropArt(c, 'clutter', '사물함', x, a)) break;
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
        if (!drawLowRow(ctx, t.x0, t.x1, Math.min(y1 + 6, b + 70), t.x0)) drawBarricade(ctx, t.x0, t.x1, fy);
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
