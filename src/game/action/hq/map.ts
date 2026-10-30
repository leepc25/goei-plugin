// 본부 건물 지도 (docs/본부_설계_2판.md). 장면 하나 = 방 하나 또는 복도 하나. 엔진(engine/hub.ts)은 이걸 받아 장면을 그리고,
// 문 → 다른 장면, 엘리베이터 → 층 고르기, 자리(spot) 앞 E → 본부 메뉴 창(openPlace) 또는 그 자리 동작.
// 방 안 배치는 hq/rooms.ts(위에서 본 m 좌표)에서 화면 px로 바꾼다. 집기는 막는 상자다.
// 출입: 복도 북쪽 벽 문(N)으로 들어간 방은 방 아래(S)로 들어오고 나간다. 복도 아래 문(S)으로 들어간 방은 방 북쪽 벽 문으로.
import type { PlaceId } from './data';
import type { HqSave } from './state';
import { placeOpen } from './logic';
import { ROOMS, mirror, type Room, type RoomFix } from './rooms';
import { PAINTED, PAINTED_LANE, doorX } from './painted';
import { MAPEDIT_SPOTS } from './mapedit.gen';
import { JR_ROOM_SPOTS } from './jrRooms.gen';

export type SceneId =
  | 'street' | 'jongno' | 'pasta' | 'metro' | 'yeongdeungpo' | 'gangnam' | 'mangwon' | 'yeouido' | 'lobby' | 'swat' | 'f2' | 'f3' | 'office' | 'interview' | 'lounge' | 'wc' | 'wc3'
  | 'b1' | 'edu' | 'training' | 'clinic' | 'b2' | 'b3' | 'tooth'
  | 'jr_entry' | 'jr_b1' | 'jr_alley' | 'jr_b2'
  | 'jr_daebak' | 'jr_heolgap' | 'jr_youngchang' | 'jr_songil' | 'jr_jinryo' | 'jr_op';

export type DoorKind = 'main' | 'door' | 'glass' | 'steel' | 'security' | 'elevator' | 'stairs_up' | 'stairs_down' | 'stairs' | 'shop' | 'slide' | 'cell' | 'exit';
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
  /** 방 그림이 없는 장소: 문이 열린 뒤 그 장소의 본부 메뉴 창 */
  place?: PlaceId;
  /** 늘 잠긴 문 */
  locked?: boolean;
  /** 방 이름: 지상 표찰·엘리베이터 앞 화살표 안내 */
  label?: string;
  /** 계단 문: 위층·아래층 장면 (같은 장면의 stairs 문으로 나온다) */
  up?: SceneId;
  down?: SceneId;
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
  seat?: { x: number; y: number };
  /** E를 누르면 자막 한 줄 */
  say?: string;
  /** 출동 차량: 출동 준비가 됐으면 출발 */
  depart?: boolean;
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
  floor: 'out' | '1F' | '2F' | '3F' | 'B1' | 'B2' | 'B3';
  /** 층 배경 그림 (hq/painted.ts 열쇠). 그림이 있으면 색 상자 대신 그림으로 그린다 */
  painted?: string;
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

/** 화면 px (docs/필드_그림_통합_지침.md): 맨 뒤 줄에서 1 m = 142 px (키 1.65 m = 235 px), 벽·바닥 선 y420, 걷는 띠 y420–669, 배경 세로 700 */
export const PX_M = 142;
export const LANE_TOP = 420;
export const LANE_BOT = 669;
const HEIGHT: Record<string, number> = { desk: 106, big: 121, wall: 283, glass: 190 };

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
/** 층 복도: 확정 배경 그림 한 장. 문 x는 그림의 문 가운데, 집기는 그림에서 오린 오브젝트의 바닥 상자 */
function floorHall(id: SceneId, name: string, floor: HqScene['floor'], doors: Omit<HqDoor, 'x'>[], extra: Partial<HqScene> = {}): HqScene {
  const p = PAINTED[id];
  // 맵 에디터로 만든 장면이면 앉는 자리도 그쪽 것
  if (MAPEDIT_SPOTS[id]) extra = { ...extra, spots: MAPEDIT_SPOTS[id] };
  return {
    id, name, floor, look: id.startsWith('jr_') ? 'jr' : p.under ? 'labhall' : id === 'lobby' ? 'lobby' : 'hall', painted: id, length: p.w, lane: p.lane ?? PAINTED_LANE,
    doors: doors.map((d) => ({ ...d, x: doorX(id, d.id) })),
    spots: [], fixtures: [], things: [],
    // 막는 상자는 그림을 그리지 않는다 (오브젝트 그림은 첫 상자 자리에서 한 번만, 깊이 순서는 sortY)
    boxes: [
      ...p.objects.flatMap((o) => (o.solid ?? []).map((b, i) => ({ kind: i ? `${o.id}:${i}` : o.id, x: (b.x0 + b.x1) / 2, w: b.x1 - b.x0, y: i ? b.y1 : o.sortY, d: b.y1 - b.y0, h: b.h ?? o.sortY - o.y, solid: true }))),
      // 막지 않는 오브젝트(가림만): 그림 자리용 빈 상자
      ...p.objects.filter((o) => !o.solid?.length).map((o) => ({ kind: o.id, x: o.x + o.w / 2, w: o.w, y: o.sortY, d: 1, h: 0, solid: false })),
      // 그림 속 화분·벤치: 바닥 상자만 (그림은 배경에 이미 있다)
      ...(p.blocks ?? []).map(([x0, x1, y1, h]) => ({ kind: 'block', x: (x0 + x1) / 2, w: x1 - x0, y: y1, d: y1 - (p.lane ?? PAINTED_LANE)[0], h: h ?? 999, solid: true })),
    ],
    ...extra,
  };
}

export const HQ_SCENES: HqScene[] = [
  // ── 바깥 (그대로 둠) ──
  {
    id: 'street', name: '종로 뒷골목', floor: 'out', length: 1920, look: 'street', legacy: true, boxes: [], fixtures: [], spots: [],
    doors: [
      { id: 'main', x: 640, kind: 'main', to: 'lobby', toDoor: 'main' }, { id: 'pasta', x: 1500, kind: 'shop', to: 'pasta', toDoor: 'out', needs: 'pasta' },
      // 임시 연결: 이동수단(노선표)이 생기기 전까지 거리 동쪽 끝에서 중림으로 바로 간다
      // 필드 세계: 종로 큰길로 (중림 임시 출구와 겹치지 않게 조금 안쪽)
      { id: 'east', x: 1720, kind: 'door', to: 'jongno', toDoor: 'west', label: '종로 큰길' },
      { id: 'jr', x: 1840, kind: 'exit', side: 'S', to: 'jr_entry', toDoor: 'west', label: '중림 지하상가 (임시)' },
    ],
    things: [{ kind: 'streetlamp', x: 300, w: 30, h: 360 }, { kind: 'streetlamp', x: 1150, w: 30, h: 360 }, { kind: 'bike', x: 860, w: 120, h: 80 }],
  },
  // 종로 큰길: 필드 세계 첫 시연 범위(docs/필드_세계_NPC_설계.md 20장). 그림 전까지 회색 거리
  {
    id: 'jongno', name: '종로 큰길', floor: 'out', length: 4000, look: 'street', legacy: true, boxes: [], fixtures: [], spots: [],
    doors: [{ id: 'west', x: 60, kind: 'door', to: 'street', toDoor: 'east', label: '종로 뒷골목' }, { id: 'metro', x: 2200, kind: 'door', to: 'metro', toDoor: 'jonggak', label: '종각역' }],
    things: [{ kind: 'streetlamp', x: 700, w: 30, h: 360 }, { kind: 'streetlamp', x: 1700, w: 30, h: 360 }, { kind: 'streetlamp', x: 2700, w: 30, h: 360 }, { kind: 'streetlamp', x: 3600, w: 30, h: 360 }],
  },
  // 지하철 승강장 하나에서 각 지역 역으로 내린다 (내린 지역이 바뀌면 시계 「지역 이동」 +30분). 그림 전까지 회색 장면, 좌표 임시
  {
    id: 'metro', name: '지하철 승강장', floor: 'out', length: 3200, look: 'corridor', legacy: true, boxes: [], fixtures: [], spots: [],
    doors: [
      { id: 'jonggak', x: 300, kind: 'door', to: 'jongno', toDoor: 'metro', label: '종각역 (종로)' },
      { id: 'yeongdeungpo', x: 1000, kind: 'door', to: 'yeongdeungpo', toDoor: 'metro', label: '영등포시장역' },
      { id: 'gangnam', x: 1700, kind: 'door', to: 'gangnam', toDoor: 'metro', label: '강남역' },
      { id: 'mangwon', x: 2400, kind: 'door', to: 'mangwon', toDoor: 'metro', label: '망원역' },
      { id: 'yeouido', x: 3000, kind: 'door', to: 'yeouido', toDoor: 'metro', label: '여의나루역' },
    ],
    things: [],
  },
  ...([
    ['yeongdeungpo', '영등포 시장', 3600, '영등포시장역'],
    ['gangnam', '강남 번화가', 4000, '강남역'],
    ['mangwon', '망원 주택가', 3000, '망원역'],
    ['yeouido', '여의도 한강공원', 4000, '여의나루역'],
  ] as const).map(([id, name, length, station]): HqScene => ({
    id, name, floor: 'out', length, look: 'street', legacy: true, boxes: [], fixtures: [], spots: [],
    doors: [{ id: 'metro', x: 200, kind: 'door', to: 'metro', toDoor: id, label: station }],
    things: [1, 2, 3].map((i) => ({ kind: 'streetlamp', x: Math.round((length * i) / 4), w: 30, h: 360 })),
  })),
  {
    id: 'pasta', name: '파스타집', floor: 'out', length: 1280, look: 'pasta', legacy: true, boxes: [], fixtures: [],
    doors: [{ id: 'out', x: 110, kind: 'shop', to: 'street', toDoor: 'pasta' }],
    spots: [{ id: 'table', x: 680, place: 'pasta', who: '전원', verb: '회식' }],
    things: [{ kind: 'long_table', x: 680, w: 520, h: 90 }, { kind: 'kitchen_window', x: 1050, w: 220, h: 120, wall: true }],
  },
  // ── 층 복도는 확정 배경 그림 6장 (hq/painted.ts). 문은 그림의 문 순서대로 (서→동). 사용자 배치 2026-10-25 ──
  floorHall('lobby', '1층 로비', '1F', [
    { id: 'main', kind: 'glass', to: 'street', toDoor: 'main', label: '현관' },
    { id: 'elev', kind: 'elevator' },
    { id: 'stairs', kind: 'stairs', up: 'f2', down: 'b1', label: '계단' },
  ]),
  floorHall('f2', '2층', '2F', [
    { id: 'wc', kind: 'door', to: 'wc', toDoor: 'out', label: '화장실' },
    { id: 'swat', kind: 'glass', to: 'swat', toDoor: 'out', label: '진압팀' },
    { id: 'elev', kind: 'elevator' },
    { id: 'meeting', kind: 'door', locked: true, label: '회의실' },
    { id: 'interview', kind: 'door', to: 'interview', toDoor: 'out', needs: 'interview', label: '면담실' },
    { id: 'stairs', kind: 'stairs', up: 'f3', down: 'lobby', label: '계단' },
  ]),
  room({ id: 'wc', name: '화장실', floor: '2F', look: 'life', doors: [exitS('f2', 'wc', 'wc', true)] }, 'wc', true),
  room({ id: 'swat', name: '진압팀', floor: '2F', look: 'office', doors: [exitS('f2', 'swat', 'swat', true)] }, 'swat', true),
  room({ id: 'interview', name: '면담실', floor: '2F', look: 'life', doors: [exitS('f2', 'interview', 'interview')] }, 'interview'),
  floorHall('f3', '3층', '3F', [
    { id: 'wc', kind: 'door', to: 'wc3', toDoor: 'out', label: '화장실' },
    { id: 'pantry', kind: 'door', place: 'pantry', label: '탕비실' },
    { id: 'lounge', kind: 'door', to: 'lounge', toDoor: 'out', label: '휴게실' },
    { id: 'elev', kind: 'elevator' },
    { id: 'office', kind: 'glass', to: 'office', toDoor: 'out', label: '종합대응팀' },
    { id: 'stairs', kind: 'stairs', down: 'f2', label: '계단' },
  ]),
  room({ id: 'wc3', name: '화장실', floor: '3F', look: 'life', doors: [exitS('f3', 'wc', 'wc', true)] }, 'wc', true),
  room({ id: 'lounge', name: '휴게실', floor: '3F', look: 'life', doors: [exitS('f3', 'lounge', 'lounge')] }, 'lounge'),
  room({ id: 'office', name: '종합대응팀', floor: '3F', look: 'office', doors: [exitS('f3', 'office', 'office')] }, 'office'),
  floorHall('b1', '지하 1층', 'B1', [
    { id: 'edu', kind: 'door', to: 'edu', toDoor: 'out', label: '교육장' },
    { id: 'training', kind: 'steel', to: 'training', toDoor: 'out', needs: 'training', label: '훈련장' },
    { id: 'elev', kind: 'elevator' },
    { id: 'shower_m', kind: 'door', locked: true, label: '샤워실(남)' },
    { id: 'shower_f', kind: 'door', locked: true, label: '샤워실(여)' },
    { id: 'stairs', kind: 'stairs', up: 'lobby', label: '계단' },
  ]),
  room({ id: 'edu', name: '교육장', floor: 'B1', look: 'office', doors: [exitS('b1', 'edu', 'edu', true)] }, 'edu', true),
  room({ id: 'training', name: '훈련장', floor: 'B1', look: 'lab', doors: [exitS('b1', 'training', 'training')] }, 'training'),
  floorHall('b2', '격리 구역', 'B2', [
    { id: 'interrogation', kind: 'steel', locked: true, label: '심문실' },
    { id: 'isolation', kind: 'cell', to: 'tooth', toDoor: 'out', needs: 'tooth', label: '격리실' },
    { id: 'elev', kind: 'elevator' },
    { id: 'clinic', kind: 'slide', to: 'clinic', toDoor: 'out', label: '의무실·연구실' },
    { id: 'archive', kind: 'steel', locked: true, label: '창고·서고' },
  ]),
  // 의무실 겸 실험실: 의무실(침대) + 격리 연구실(연구·감정)을 한 방으로. 장비 보급은 B3 보급실로 옮김
  { ...room({ id: 'clinic', name: '의무실·연구실', floor: 'B2', look: 'lab', doors: [] }, 'medlab'), doors: [exitS('b2', 'clinic', 'medlab')] },
  room({ id: 'tooth', name: '격리실', floor: 'B2', look: 'lab', doors: [exitS('b2', 'isolation', 'tooth')] }, 'tooth'),
  floorHall('b3', '지하 주차장', 'B3', [
    { id: 'supply', kind: 'steel', place: 'supply', label: '보급실' },
    { id: 'elev', kind: 'elevator' },
  ], { spots: [{ id: 'van', x: 370, y: LANE_TOP + 50, verb: '출동', depart: true }] }),
  // ── 중림 지하상가 (중립지역, 그림 4장). 지상 입구 → 지하 1층 앞골목 → (가운데 통로) 뒷골목 / (동쪽 계단) 지하 2층 ──
  floorHall('jr_entry', '중림 지하상가 입구', 'out', [
    { id: 'west', kind: 'exit', side: 'S', to: 'street', toDoor: 'jr', label: '종로로 (임시)' },
    { id: 'down', kind: 'door', to: 'jr_b1', toDoor: 'up', label: '지하상가로 내려가기' },
  ]),
  floorHall('jr_b1', '중림 지하상가 지하 1층', 'B1', [
    { id: 'up', kind: 'door', to: 'jr_entry', toDoor: 'down', label: '지상으로' },
    { id: 'daebak', kind: 'glass', to: 'jr_daebak', toDoor: 'out', label: '대박 알선' },
    { id: 'songil', kind: 'glass', to: 'jr_songil', toDoor: 'out', label: '손길 의원' },
    { id: 'alley', kind: 'door', to: 'jr_alley', toDoor: 'b1', label: '뒷골목' },
    { id: 'down', kind: 'door', to: 'jr_b2', toDoor: 'up', label: '지하 2층으로' },
  ]),
  floorHall('jr_alley', '중림 뒷골목', 'B1', [
    { id: 'b1', kind: 'door', to: 'jr_b1', toDoor: 'alley', label: '앞골목' },
    { id: 'heolgap', kind: 'door', to: 'jr_heolgap', toDoor: 'out', label: '헐값 매입' },
  ]),
  floorHall('jr_b2', '중림 지하상가 지하 2층', 'B2', [
    { id: 'up', kind: 'door', to: 'jr_b1', toDoor: 'down', label: '지하 1층으로' },
    { id: 'youngchang', kind: 'steel', to: 'jr_youngchang', toDoor: 'out', label: '창고 B-7 (영창 컨설팅)' },
  ]),
  // 가게 안 (GPT 빈 방 + GPT 가구, tools/jr/rooms.py)
  floorHall('jr_daebak', '대박 알선', 'B1', [{ id: 'out', kind: 'glass', to: 'jr_b1', toDoor: 'daebak', label: '나가기' }], { spots: JR_ROOM_SPOTS.jr_daebak }),
  floorHall('jr_heolgap', '헐값 매입', 'B1', [{ id: 'out', kind: 'exit', side: 'S', to: 'jr_alley', toDoor: 'heolgap', label: '나가기' }], { spots: JR_ROOM_SPOTS.jr_heolgap }),
  floorHall('jr_youngchang', '영창 컨설팅', 'B2', [{ id: 'out', kind: 'steel', to: 'jr_b2', toDoor: 'youngchang', label: '나가기' }], { spots: JR_ROOM_SPOTS.jr_youngchang }),
  floorHall('jr_songil', '손길 의원', 'B1', [
    { id: 'out', kind: 'exit', side: 'S', to: 'jr_b1', toDoor: 'songil', label: '나가기' },
    { id: 'jinryo', kind: 'door', to: 'jr_jinryo', toDoor: 'out', label: '진료실' },
    { id: 'op', kind: 'door', to: 'jr_op', toDoor: 'out', label: '수술실' },
  ], { spots: JR_ROOM_SPOTS.jr_songil }),
  floorHall('jr_jinryo', '진료실', 'B1', [{ id: 'out', kind: 'door', to: 'jr_songil', toDoor: 'jinryo', label: '대기실로' }], { spots: JR_ROOM_SPOTS.jr_jinryo }),
  floorHall('jr_op', '수술실', 'B1', [{ id: 'out', kind: 'door', to: 'jr_songil', toDoor: 'op', label: '대기실로' }], { spots: JR_ROOM_SPOTS.jr_op }),
];
export const SCENE_BY_ID = Object.fromEntries(HQ_SCENES.map((s) => [s.id, s])) as Record<SceneId, HqScene>;

/** 엘리베이터 층 단추 (위에서 아래로) */
export const ELEVATOR: { floor: HqScene['floor']; label: string; scene: SceneId; door: string; needs?: PlaceId }[] = [
  { floor: '3F', label: '3', scene: 'f3', door: 'elev' },
  { floor: '2F', label: '2', scene: 'f2', door: 'elev' },
  { floor: '1F', label: '1', scene: 'lobby', door: 'elev' },
  { floor: 'B1', label: 'B1', scene: 'b1', door: 'elev' },
  { floor: 'B2', label: 'B2', scene: 'b2', door: 'elev' },
  { floor: 'B3', label: 'B3', scene: 'b3', door: 'elev' },
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
/** 출근·귀환: 3층 종합대응팀 사무실 (잼트리 자리 근처 빈 바닥) */
const START = { scene: 'office' as SceneId, x: M(4), y: LANE_TOP + 170 };

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
    scenes: HQ_SCENES.map((sc) => ({ ...sc, doors: sc.doors.map((d) => ({ ...d, open: !d.locked && (d.kind !== 'cell' || !!d.place) && ok(d.needs ?? d.place) })), spots: sc.spots.map((p) => ({ ...p, open: ok(p.place) })) })),
    elevator: ELEVATOR.map((e) => ({ ...e, open: ok(e.needs) })),
    start: justEvacuated ? { scene: 'clinic', x: bed.x, y: bed.y } : START,
  };
}
