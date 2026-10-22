// 본부 건물 지도 (docs/본부_설계_2판.md). 장면 하나 = 방 하나 또는 복도 하나. 엔진(engine/hub.ts)은 이걸 받아 장면을 그리고,
// 문 → 다른 장면, 엘리베이터 → 층 고르기, 자리(spot) 앞 E → 본부 메뉴 창(openPlace) 또는 그 자리 동작.
// 방 안 배치는 hq/rooms.ts(위에서 본 m 좌표)에서 화면 px로 바꾼다. 집기는 막는 상자다.
// 출입: 복도 북쪽 벽 문(N)으로 들어간 방은 방 아래(S)로 들어오고 나간다. 복도 아래 문(S)으로 들어간 방은 방 북쪽 벽 문으로.
import type { PlaceId } from './data';
import type { HqSave } from './state';
import { placeOpen } from './logic';
import { ROOMS, mirror, type Room, type RoomFix } from './rooms';

export type SceneId =
  | 'street' | 'pasta' | 'lobby' | 'admin' | 'swat' | 'f2' | 'office' | 'interview' | 'lounge' | 'wc'
  | 'b1' | 'training' | 'bath' | 'clinic' | 'b2' | 'lab' | 'tooth';

export type DoorKind = 'main' | 'door' | 'glass' | 'steel' | 'security' | 'elevator' | 'stairs_up' | 'stairs_down' | 'shop' | 'slide' | 'cell' | 'exit';
export interface HqDoor {
  id: string;
  /** 문 가운데 x (장면 왼쪽 끝 0 기준) */
  x: number;
  kind: DoorKind;
  /** N = 북쪽 벽 문(기본), S = 화면 아래 출입(나가는 표시) */
  side?: 'N' | 'S';
  /** 나가면 가는 장면과 그 장면의 도착 문. 엘리베이터는 비워 두고 ELEVATOR에서 층을 고른다 */
  to?: SceneId;
  toDoor?: string;
  /** 이 장소가 열려야 열리는 문 (아니면 닫힌 채 덜컹) */
  needs?: PlaceId;
}
/** 방 안 자리. 앞에서 E → place가 있으면 본부 메뉴 창, 없으면 그 자리 동작(act) */
export interface HqSpot {
  id: string;
  x: number;
  /** 깊이(걷는 띠 안 y). 없으면 깊이 무관(옛 장면) */
  y?: number;
  place?: PlaceId;
  /** 자리 주인 (대화 상대) */
  who?: string;
  /** 자리 앞에 뜨는 짧은 동사 */
  verb: string;
  face?: 1 | -1;
  act?: string[];
}
/** 바닥 위 상자 (집기). x = 가운데, y = 앞 모서리(바닥에 닿는 선), d = 뒤로 깊이, h = 높이. 모두 화면 px */
export interface HqBox {
  kind: string;
  x: number;
  w: number;
  y: number;
  d: number;
  h: number;
  solid: boolean;
  /** 의자: 앉은 사람이 보는 쪽 */
  face?: 'E' | 'W' | 'N';
}
/** 옛 장면(거리·파스타집)의 물건: 벽 그림 칸 방식 그대로 */
export interface HqThing {
  kind: string;
  x: number;
  w: number;
  h: number;
  wall?: boolean;
  sign?: boolean;
}
export interface HqScene {
  id: SceneId;
  /** 들어갈 때 잠깐 뜨는 제목 */
  name: string;
  floor: 'out' | '1F' | '2F' | 'B1' | 'B2';
  length: number;
  /** 장면 전용 보행 깊이. 없으면 공용 본부 보행 띠를 쓴다. */
  lane?: [number, number];
  /** 마감: office(지상 사무) · life(생활) · lab(지하 SF) · hall(복도) · 옛 그림(street, pasta) */
  look: string;
  /** 옛 벽 칸 그림으로 그리는 장면 (거리·파스타집은 사용자 지시로 그대로 둔다) */
  legacy?: boolean;
  doors: HqDoor[];
  spots: HqSpot[];
  boxes: HqBox[];
  fixtures: { x: number; w: number; kind: RoomFix['k'] }[];
  things: HqThing[];
}

/** 화면 px: 가로 1 m = 155 px (키 1.65 m = 256 px), 깊이는 방 깊이를 걷는 띠 전체에 */
export const PX_M = 155;
export const LANE_TOP = 470;
export const LANE_BOT = 690;
const HEIGHT: Record<string, number> = { desk: 116, big: 90, wall: 280, glass: 190 };

function fromRoom(r: Room) {
  const yOf = (m: number) => LANE_TOP + (m / r.d) * (LANE_BOT - LANE_TOP);
  const boxes: HqBox[] = r.items.map((it) => {
    if (it.t === 'chair') {
      const y = yOf(it.y);
      return { kind: it.soft ? 'armchair' : 'chair', x: it.x * PX_M, w: it.soft ? 70 : 54, y: y + 10, d: 20, h: it.soft ? 120 : 150, solid: false, face: it.f };
    }
    const y = yOf(it.y + it.h);
    return { kind: it.k ?? it.t, x: (it.x + it.w / 2) * PX_M, w: Math.max(14, it.w * PX_M), y, d: Math.max(8, y - yOf(it.y)), h: it.H ?? HEIGHT[it.t], solid: true };
  });
  return {
    length: Math.max(1280, r.w * PX_M),
    boxes,
    fixtures: r.fix.map((f) => ({ x: (f.x + f.w / 2) * PX_M, w: f.w * PX_M, kind: f.k })),
    spots: r.use.map((u): HqSpot => ({ ...u, x: u.x * PX_M, y: yOf(u.y) })),
  };
}

const M = (m: number) => Math.round(m * PX_M);
type Base = Pick<HqScene, 'id' | 'name' | 'floor' | 'look' | 'doors'>;
/** west = 코어 서쪽 방: 좌우를 뒤집어 출입문(코어 쪽)이 동쪽 끝에 오게 */
const room = (b: Base, key: string, west = false): HqScene => ({ ...b, ...fromRoom(west ? mirror(ROOMS[key]) : ROOMS[key]), things: [] });
/** 방에서 나가는 화면 아래 출입. west 방은 동쪽 끝 */
const exitS = (to: SceneId, toDoor: string, key: string, west = false): HqDoor => ({ id: 'out', x: M(west ? ROOMS[key].w - 1 : 1), kind: 'exit', side: 'S', to, toDoor });
/** 층 가운데 코어: 계단(내려가기)·엘리베이터·계단(올라가기), 계단 옆 벽에 이정표 */
function core(cx: number, up?: [SceneId, string], down?: [SceneId, string]) {
  const doors: HqDoor[] = [{ id: 'elev', x: M(cx), kind: 'elevator' }];
  if (down) doors.push({ id: 'down', x: M(cx - 1.6), kind: 'stairs_down', to: down[0], toDoor: down[1] });
  if (up) doors.push({ id: 'up', x: M(cx + 1.6), kind: 'stairs_up', to: up[0], toDoor: up[1] });
  return { doors, sign: { x: M(cx + 3), w: M(1.2), kind: 'directory' as const } };
}
/** 복도: 방 문은 전부 북쪽 벽. 남쪽은 바깥벽이라 문이 없다 (1층 정문만) */
const hall = (b: Omit<Base, 'doors'>, wm: number, c: ReturnType<typeof core>, doors: HqDoor[], extra: Partial<HqScene> = {}): HqScene => ({
  ...b, length: Math.max(1280, M(wm)), doors: [...c.doors, ...doors], spots: [], boxes: [], fixtures: [c.sign], things: [], ...extra,
});
const gate = (xm: number): HqBox[] => [0.5, 1.7, 2.9].map((ym) => ({ kind: 'gate', x: M(xm), w: 40, y: LANE_TOP + ((ym + 0.6) / 4) * 220, d: (0.6 / 4) * 220, h: 150, solid: true }));

export const HQ_SCENES: HqScene[] = [
  // ── 바깥 (그대로 둠) ──
  {
    id: 'street', name: '종로 뒷골목', floor: 'out', length: 1920, look: 'street', legacy: true, boxes: [], fixtures: [], spots: [],
    doors: [{ id: 'main', x: 640, kind: 'main', to: 'lobby', toDoor: 'main' }, { id: 'pasta', x: 1500, kind: 'shop', to: 'pasta', toDoor: 'out', needs: 'pasta' }],
    things: [{ kind: 'streetlamp', x: 300, w: 30, h: 360 }, { kind: 'streetlamp', x: 1150, w: 30, h: 360 }, { kind: 'bike', x: 860, w: 120, h: 80 }],
  },
  {
    id: 'pasta', name: '파스타집', floor: 'out', length: 1280, look: 'pasta', legacy: true, boxes: [], fixtures: [],
    doors: [{ id: 'out', x: 110, kind: 'shop', to: 'street', toDoor: 'pasta' }],
    spots: [{ id: 'table', x: 680, place: 'pasta', who: '전원', verb: '회식' }],
    things: [{ kind: 'long_table', x: 680, w: 520, h: 90 }, { kind: 'kitchen_window', x: 1050, w: 220, h: 120, wall: true }],
  },
  // ── 1층: 로비 · 행정실(서) · 진압팀(동). 정문은 코어 맞은편 바깥벽 ──
  hall({ id: 'lobby', name: '1층 로비', floor: '1F', look: 'lobby' }, 24, core(12, ['f2', 'down'], ['b1', 'up']), [
    { id: 'admin', x: M(4), kind: 'glass', to: 'admin', toDoor: 'out' },
    { id: 'swat', x: M(19.5), kind: 'glass', to: 'swat', toDoor: 'out' },
    { id: 'main', x: M(12), kind: 'exit', side: 'S', to: 'street', toDoor: 'main' },
  ], { boxes: [...gate(7.5), ...gate(17)] }),
  room({ id: 'admin', name: '행정실', floor: '1F', look: 'office', doors: [exitS('lobby', 'admin', 'admin', true)] }, 'admin', true),
  room({ id: 'swat', name: '진압팀', floor: '1F', look: 'office', doors: [exitS('lobby', 'swat', 'swat')] }, 'swat'),
  // ── 2층 (시작 층): 화장실·종합대응팀(서, 코어 바로 옆) · 면담실·휴게실(동) ──
  hall({ id: 'f2', name: '2층', floor: '2F', look: 'hall' }, 26, core(13, undefined, ['lobby', 'up']), [
    { id: 'wc', x: M(3), kind: 'door', to: 'wc', toDoor: 'out' },
    { id: 'office', x: M(8.8), kind: 'glass', to: 'office', toDoor: 'out' },
    { id: 'interview', x: M(18.5), kind: 'door', to: 'interview', toDoor: 'out', needs: 'interview' },
    { id: 'lounge', x: M(23), kind: 'glass', to: 'lounge', toDoor: 'out' },
  ]),
  room({ id: 'wc', name: '화장실', floor: '2F', look: 'life', doors: [exitS('f2', 'wc', 'wc', true)] }, 'wc', true),
  {
    id: 'office', name: '종합대응팀', floor: '2F', look: 'office', length: 1280, lane: [430, 690],
    doors: [{ id: 'out', side: 'N', x: 1084, kind: 'door', to: 'f2', toDoor: 'office' }],
    boxes: [
      { kind: 'desk', x: 420, y: 520, w: 260, d: 60, h: 140, solid: true },
      { kind: 'chair', x: 245, y: 512, w: 105, d: 45, h: 190, solid: true },
    ],
    fixtures: [], things: [],
    spots: [
      { id: 'jaemtri', x: 680, y: 470, place: 'jaemtri', verb: '임무 게시판', face: 1 },
      { id: 'agents', x: 110, y: 450, place: 'office', verb: '요원' },
      { id: 'chief', x: 800, y: 470, place: 'chief', verb: '결재' },
    ],
  },
  room({ id: 'interview', name: '면담실', floor: '2F', look: 'life', doors: [exitS('f2', 'interview', 'interview')] }, 'interview'),
  room({ id: 'lounge', name: '휴게실', floor: '2F', look: 'life', doors: [exitS('f2', 'lounge', 'lounge')] }, 'lounge'),
  // ── 지하 1층: 의무실(서) · 훈련장·목욕탕(동) ──
  hall({ id: 'b1', name: '지하 1층', floor: 'B1', look: 'labhall' }, 26, core(11, ['lobby', 'down'], ['b2', 'up']), [
    { id: 'clinic', x: M(4.5), kind: 'slide', to: 'clinic', toDoor: 'out' },
    { id: 'training', x: M(17.5), kind: 'slide', to: 'training', toDoor: 'out', needs: 'training' },
    { id: 'bath', x: M(22.5), kind: 'slide', to: 'bath', toDoor: 'out' },
  ]),
  room({ id: 'clinic', name: '의무실', floor: 'B1', look: 'lab', doors: [exitS('b1', 'clinic', 'clinic', true)] }, 'clinic', true),
  room({ id: 'training', name: '훈련장', floor: 'B1', look: 'lab', doors: [exitS('b1', 'training', 'training')] }, 'training'),
  room({ id: 'bath', name: '목욕탕', floor: 'B1', look: 'bath', doors: [exitS('b1', 'bath', 'bath')] }, 'bath'),
  // ── 지하 2층: 격리 실험실(서) · 격리실들 · 끝의 봉인된 두 방 ──
  hall({ id: 'b2', name: '격리 구역', floor: 'B2', look: 'labhall' }, 40, core(12, ['b1', 'down']), [
    { id: 'lab', x: M(6), kind: 'slide', to: 'lab', toDoor: 'out' },
    ...[18, 22, 26, 30].map((x, i): HqDoor => ({ id: `cell${i + 1}`, x: M(x), kind: 'cell' })),
    { id: 'tree', x: M(34), kind: 'cell' },
    { id: 'tooth', x: M(38), kind: 'slide', to: 'tooth', toDoor: 'out', needs: 'tooth' },
  ], { spots: [{ id: 'cells', x: M(22), y: LANE_TOP + 20, verb: '격리문', place: 'gallery' }] }),
  room({ id: 'lab', name: '격리 실험실', floor: 'B2', look: 'lab', doors: [exitS('b2', 'lab', 'lab', true)] }, 'lab', true),
  room({ id: 'tooth', name: '이빨 요정 격리실', floor: 'B2', look: 'lab', doors: [exitS('b2', 'tooth', 'tooth')] }, 'tooth'),
];
export const SCENE_BY_ID = Object.fromEntries(HQ_SCENES.map((s) => [s.id, s])) as Record<SceneId, HqScene>;

/** 엘리베이터 층 단추 (위에서 아래로) */
export const ELEVATOR: { floor: HqScene['floor']; label: string; scene: SceneId; door: string; needs?: PlaceId }[] = [
  { floor: '2F', label: '2', scene: 'f2', door: 'elev' },
  { floor: '1F', label: '1', scene: 'lobby', door: 'elev' },
  { floor: 'B1', label: 'B1', scene: 'b1', door: 'elev' },
  { floor: 'B2', label: 'B2', scene: 'b2', door: 'elev' },
];

/** 메뉴 「장소로 가기」·장소 id → 그 장면과 서 있을 자리 */
export function whereIs(place: PlaceId): { scene: SceneId; x: number; y?: number } {
  for (const sc of HQ_SCENES) {
    const sp = sc.spots.find((p) => p.place === place);
    if (sp) return { scene: sc.id, x: sp.x, y: sp.y };
  }
  if (place === 'street') return { scene: 'street', x: 640 };
  return START;
}
/** 출근·귀환: 단일 화면 사무실의 빈 보행 공간 */
const START = { scene: 'office' as SceneId, x: 820, y: 620 };

export interface HqMapView {
  scenes: (HqScene & { doors: (HqDoor & { open: boolean })[]; spots: (HqSpot & { open: boolean })[] })[];
  elevator: (typeof ELEVATOR[number] & { open: boolean })[];
  /** 지금 시작할 장면: 출근·귀환은 사무실, 후송 직후는 의무실 침대 앞 */
  start: { scene: SceneId; x: number; y?: number };
}
export function hqMap(s: HqSave, justEvacuated = false): HqMapView {
  const ok = (p?: PlaceId) => !p || placeOpen(s, p);
  const bed = SCENE_BY_ID.clinic.spots[0];
  return {
    scenes: HQ_SCENES.map((sc) => ({ ...sc, doors: sc.doors.map((d) => ({ ...d, open: d.kind !== 'cell' && ok(d.needs) })), spots: sc.spots.map((p) => ({ ...p, open: ok(p.place) })) })),
    elevator: ELEVATOR.map((e) => ({ ...e, open: ok(e.needs) })),
    start: justEvacuated ? { scene: 'clinic', x: bed.x, y: bed.y } : START,
  };
}
