// 본부 건물 지도 (docs/본부_설계_2판.md). 장면 하나 = 방 하나 또는 복도 하나. 엔진(engine/hub.ts)은 이걸 받아 장면을 그리고,
// 문 → 다른 장면, 엘리베이터 → 층 고르기, 자리(spot) 앞 E → 본부 메뉴 창(openPlace) 또는 그 자리 동작.
// 방 안 배치는 hq/rooms.ts(위에서 본 m 좌표)에서 화면 px로 바꾼다. 집기는 막는 상자다.
// 출입: 복도 북쪽 벽 문(N)으로 들어간 방은 방 아래(S)로 들어오고 나간다. 복도 아래 문(S)으로 들어간 방은 방 북쪽 벽 문으로.
import type { PlaceId } from './data';
import { ROOMS, mirror, type Room, type RoomFix, type RoomItem } from './rooms';
import { PAINTED, PAINTED_LANE, doorX, type HqToilet } from './painted';
import { JR_ROOM_SPOTS } from './jrRooms.gen';
import { MAPEDIT_SPOTS } from './mapedit.gen';
import type { PaintedScene } from './painted';

export type SceneId =
  | 'street' | 'pasta' | 'lobby' | 'swat' | 'f2' | 'f3' | 'office' | 'interview' | 'lounge' | 'wc' | 'wc3'
  | 'b1' | 'edu' | 'training' | 'clinic' | 'b2' | 'b3' | 'tooth' | 'bath_f' | 'bath_m' | 'shower_f' | 'shower_m'
  | 'jr_entry' | 'jr_b1' | 'jr_alley' | 'jr_b2'
  | 'sdra_lobby' | 'sdra_f2' | 'sdra_wc_m' | 'sdra_wc_f'
  | 'sdra_b1' | 'sdra_shower_f' | 'sdra_shower_m' | 'sdra_bath_f' | 'sdra_bath_m' | 'sdra_training'
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
  /** 필드 가게 (src/game/world/fieldShop.ts SHOPS id): E로 거래 창 */
  shop?: string;
  /** 의자 자리: 그 장면 boxes의 의자 번호 (앉아 있는 동안 방 의자 그림은 숨기고 인물 팩 의자를 그린다) */
  chair?: number;
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
  /** 의자 그림 묶음('L' = 휴게실 쉘 의자). 없으면 C01 사무의자 */
  set?: string;
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
  /** 의자 자리 (boxes 의 의자). 주인공·이름 인물이 앉는다. set = 의자 그림 묶음(HqBox.set) */
  seats?: { x: number; y: number; face?: 'E' | 'W' | 'N'; box: number; set?: string }[];
  /** 화장실 쓰는 자리 (칸·소변기·세면대) */
  toilets?: HqToilet[];
  /** 남녀 구분 화장실: 이 성별만 쓴다 (NPC는 다른 쪽에 들어가지 않는다) */
  /** 샤워 자리 (11-02 NPC 샤워): 그림의 샤워기 발 자리 */
  showers?: { id: string; x: number; y: number; face: 1 | -1 }[];
  /** 탈의실 캐비닛 앞 자리 (11-02) */
  lockers?: { id: string; x: number; y: number; face: 1 | -1 }[];
  sex?: '남' | '여';
  /** NPC 생활 동작 자리(11-02 휴게실 확정): 자판기 57→27→142, 정수기·커피 57→142, 전자레인지·찬장 57→157, 게시판 57, 싱크대 104 */
  stations?: { id: string; x: number; y: number; lines: string[] }[];
}

/** 화면 px (docs/필드_그림_통합_지침.md): 맨 뒤 줄에서 1 m = 142 px (키 1.65 m = 235 px), 벽·바닥 선 y420, 걷는 띠 y420–669, 배경 세로 700 */
export const PX_M = 142;
export const LANE_TOP = 420;
export const LANE_BOT = 669;

/** 회색 방(그림 없는 방)은 의자만 둔다 (사용자 2026-10-29: 「가구 같은 거 넣지 말고 회색 룸에 의자들만 놔둬. 이미지 뽑고 나면 교체」).
 * rooms.ts 의 책상·침대·벽 집기·벽 붙박이는 그림이 올 때까지 그리지도 막지도 않는다. 의자마다 앉기 자리 하나(E → 인물 팩 앉기, 코어 sitAt) */
function fromRoom(r: Room) {
  const yOf = (m: number) => LANE_TOP + (m / r.d) * (LANE_BOT - LANE_TOP);
  const chairs = r.items.filter((it): it is Extract<RoomItem, { t: 'chair' }> => it.t === 'chair');
  const boxes: HqBox[] = chairs.map((it) => {
    const y = yOf(it.y);
    return { kind: it.soft ? 'armchair' : 'chair', x: it.x * PX_M, w: it.soft ? 70 : 54, y: y + 10, d: 20, h: it.soft ? 120 : 150, solid: false, face: it.f };
  });
  // 의자 자리: 앉은 사람이 보는 쪽(E/W = 옆 앉기, N = 후면 앉기). 발 자리 = 의자 바닥 선
  const spots: HqSpot[] = boxes.map((b, i): HqSpot => ({
    id: `chair${i}`, x: b.x, y: b.y, verb: '앉기', face: b.face === 'W' ? -1 : 1, seat: { x: b.x, y: b.y }, act: [b.face === 'N' ? 'sit_back' : 'sit_side'], chair: i,
  }));
  return {
    length: Math.max(1280, r.w * PX_M),
    boxes,
    fixtures: [],
    spots,
    seats: boxes.map((b, i) => ({ x: b.x, y: b.y, face: b.face, box: i })),
  };
}

const M = (m: number) => Math.round(m * PX_M);
type Base = Pick<HqScene, 'id' | 'name' | 'floor' | 'look' | 'doors'>;
/** west = 코어 서쪽 방: 좌우를 뒤집어 출입문(코어 쪽)이 동쪽 끝에 오게 */
const room = (b: Base, key: string, west = false): HqScene => ({ ...b, ...fromRoom(west ? mirror(ROOMS[key]) : ROOMS[key]), things: [] });
/** 방에서 나가는 화면 아래 출입. west 방은 동쪽 끝 */
const exitS = (to: SceneId, toDoor: string, key: string, west = false): HqDoor => ({ id: 'out', x: M(west ? ROOMS[key].w - 1 : 1), kind: 'exit', side: 'S', to, toDoor });
/** 층 복도: 확정 배경 그림 한 장. 문 x는 그림의 문 가운데, 집기는 그림에서 오린 오브젝트의 바닥 상자 */
/** 탈의실 캐비닛 앞 서는 자리 (11-02, 그림의 캐비닛 옆면 밑선에서 땀). face = 캐비닛 쪽.
 * 여: 왼쪽 캐비닛 섬 오른쪽 면 두 자리, 오른쪽 섬 왼쪽 면 한 자리. 남: 가운데 캐비닛 오른쪽 면 두 자리, 오른쪽 벽 캐비닛 한 자리 */
const LOCKERS: Record<'shower_f' | 'shower_m', { id: string; x: number; y: number; face: 1 | -1 }[]> = {
  shower_f: [{ id: 'locker1', x: 560, y: 670, face: -1 }, { id: 'locker2', x: 600, y: 610, face: -1 }, { id: 'locker3', x: 700, y: 680, face: 1 }, { id: 'locker4', x: 316, y: 640, face: 1 }, { id: 'locker5', x: 885, y: 604, face: 1 }],   // 4·5: 사용자 11-02 06:28 「여기도 넣어」(빨래통 왼쪽 사물함 앞 모서리, 오른쪽 안쪽 분홍 사물함 앞)
  shower_m: [{ id: 'locker1', x: 865, y: 700, face: -1 }, { id: 'locker2', x: 935, y: 640, face: -1 }, { id: 'locker3', x: 1100, y: 690, face: 1 }, { id: 'locker4', x: 544, y: 646, face: 1 }, { id: 'locker5', x: 1072, y: 636, face: 1 }],   // 4·5: 사용자 11-02 07:01 「여기도 하나 넣어야지」「여기도 넣고」(가운데 사물함 왼쪽 옆면 앞 벤치 끝, 오른쪽 사물함 줄 안쪽 앞)
};
const lockerSpots = (id: 'shower_f' | 'shower_m'): HqSpot[] => LOCKERS[id].map((l) => ({ id: `locker:${l.id}`, x: l.x, y: l.y, verb: '캐비닛', face: l.face, act: ['locker'] }));
/** 샤워실 그림의 샤워기 발 자리 → NPC가 서는 자리 (11-02 NPC 샤워) */
const showerSpots = (id: SceneId) => (PAINTED[id]?.showers ?? []).map((s) => ({ id: s.id, x: s.foot[0], y: s.foot[1], face: s.face }));
function floorHall(id: SceneId, name: string, floor: HqScene['floor'], doors: Omit<HqDoor, 'x'>[], extra: Partial<HqScene> = {}): HqScene {
  const p = PAINTED[id];
  // 그림 속 의자(11-02 휴게실): 상자(kind chair, 그림은 drawChair가 set 그림으로)·앉는 자리·NPC 자리. 자리의 chair 번호는 의자 차례 → 상자 번호
  const chairBoxes: HqBox[] = (p.chairs ?? []).map((ch) => ({ kind: 'chair', x: ch.x, w: 54, y: ch.y, d: 20, h: 150, solid: false, face: ch.face, set: ch.set }));
  // 맵 에디터로 만든 장면이면 앉는 자리도 그쪽 것
  if (MAPEDIT_SPOTS[id]?.length) extra = { ...extra, spots: MAPEDIT_SPOTS[id] };
  if (p.stations?.length && !extra.stations) extra = { ...extra, stations: p.stations };
  const sc = floorHallBase(id, name, floor, doors, p, extra);
  if (chairBoxes.length) {
    const base = sc.boxes.length;
    sc.boxes = [...sc.boxes, ...chairBoxes];
    sc.spots = sc.spots.map((s) => (s.chair !== undefined ? { ...s, chair: base + s.chair } : s));
    sc.seats = chairBoxes.map((b, i) => ({ x: b.x, y: b.y, face: b.face, box: base + i, set: b.set }));
  }
  return sc;
}
function floorHallBase(id: SceneId, name: string, floor: HqScene['floor'], doors: Omit<HqDoor, 'x'>[], p: PaintedScene, extra: Partial<HqScene>): HqScene {
  return {
    ...(p.posts ? { posts: p.posts } : {}), id, name, floor, look: id.startsWith('jr_') ? 'jr' : p.under ? 'labhall' : id === 'lobby' ? 'lobby' : 'hall', painted: id, length: p.w, lane: p.lane ?? PAINTED_LANE,
    doors: doors.map((d) => ({ ...d, x: doorX(id, d.id) })),
    spots: [], fixtures: [], things: [],
    // 막는 상자는 그림을 그리지 않는다 (오브젝트 그림은 첫 상자 자리에서 한 번만, 깊이 순서는 sortY)
    boxes: [
      ...p.objects.flatMap((o) => (o.solid ?? []).map((b, i) => ({ kind: i ? `${o.id}:${i}` : o.id, x: (b.x0 + b.x1) / 2, w: b.x1 - b.x0, y: i ? b.y1 : o.sortY, d: b.y1 - b.y0, h: b.h ?? o.sortY - o.y, solid: true }))),
      // 막지 않는 오브젝트(가림만): 그림 자리용 빈 상자 (깊이는 걷는 띠 안으로 자름: 탈의실(여) 맨 앞 빨래 바구니 sortY 848, 탈의실(남) 오른쪽 벽 캐비닛 조각 sortY 594 — 사람과 앞뒤는 그대로, 11-02)
      ...p.objects.filter((o) => !o.solid?.length).map((o) => ({ kind: o.id, x: o.x + o.w / 2, w: o.w, y: Math.max((p.lane ?? PAINTED_LANE)[0], Math.min(o.sortY, (p.lane ?? PAINTED_LANE)[1])), d: 1, h: 0, solid: false })),
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
      { id: 'jr', x: 1840, kind: 'exit', side: 'S', to: 'jr_entry', toDoor: 'west', label: '중림 지하상가 (임시)' },
      // 임시 연결(11-02): 협회 정면 거리가 생기기 전까지 이 거리에서 협회 1층으로 바로 간다
      { id: 'sdra', x: 1100, kind: 'exit', side: 'S', to: 'sdra_lobby', toDoor: 'main', label: '특수재난대응협회 (임시)' },
    ],
    things: [{ kind: 'streetlamp', x: 300, w: 30, h: 360 }, { kind: 'streetlamp', x: 1150, w: 30, h: 360 }, { kind: 'bike', x: 860, w: 120, h: 80 }],
  },
  // 10-31 사용자: 종로 큰길·지하철 승강장·지역 회색 장면 4곳(영등포·강남·망원·여의도)과 편의점·노점은 가설로 만든 것이라 뺐다.
  // 거리는 각 세력·중립 건물로 들어가는 길거리뿐 — 지도가 완성되면 그때 더한다
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
  ]),
  // 2층은 새 본부 그림(PixelLab 11-01, game-src/mapedit/f2): 서→동 진압팀 철제문 · 엘리베이터 · 화장실(남). 계단·회의실·면담실 없음(본부 최소화)
  floorHall('f2', '2층', '2F', [
    { id: 'swat', kind: 'steel', to: 'swat', toDoor: 'out', label: '진압팀' },
    { id: 'elev', kind: 'elevator' },
    { id: 'wc', kind: 'door', to: 'wc', toDoor: 'out', label: '화장실(남)' },
  ]),
  // 화장실은 그림 장면(PixelLab 11-01, tools/mapedit/author_hq_wc.py): 대변기 칸·소변기·세면대 자리(toilets). 나가는 곳은 화면 아래 오른쪽
  floorHall('wc', '화장실(남)', '2F', [{ id: 'out', kind: 'exit', side: 'S', to: 'f2', toDoor: 'wc', label: '나가기' }], { toilets: PAINTED.wc?.toilets, sex: '남' }),
  room({ id: 'swat', name: '진압팀', floor: '2F', look: 'office', doors: [exitS('f2', 'swat', 'swat', true)] }, 'swat', true),
  // 3층은 새 본부 그림(PixelLab 2026-10-31~11-01, game-src/mapedit/hq_f3): 서→동 종합대응팀 유리문 · 엘리베이터 · 화장실(여) · 휴게실. 계단·탕비실 없음(본부 최소화, 사용자 10-31)
  floorHall('f3', '3층', '3F', [
    { id: 'office', kind: 'glass', to: 'office', toDoor: 'out', label: '종합대응팀' },
    { id: 'elev', kind: 'elevator' },
    { id: 'wc', kind: 'door', to: 'wc3', toDoor: 'out', label: '화장실(여)' },
    { id: 'lounge', kind: 'glass', to: 'lounge', toDoor: 'out', label: '휴게실' },
  ]),
  floorHall('wc3', '화장실(여)', '3F', [{ id: 'out', kind: 'exit', side: 'S', to: 'f3', toDoor: 'wc', label: '나가기' }], { toilets: PAINTED.wc3?.toilets, sex: '여' }),
  // 휴게실: 그림 장면(PixelLab 11-02, tools/mapedit/author_hq_lounge.py). 테이블 3개는 올라설 수 있는 발판, 의자 12개(쉘 의자 'L'), 출입문 = 비상구 표지 밑 유리문 → 3층 복도
  floorHall('lounge', '휴게실', '3F', [{ id: 'out', kind: 'exit', to: 'f3', toDoor: 'lounge', label: '나가기' }]),
  room({ id: 'office', name: '종합대응팀', floor: '3F', look: 'office', doors: [exitS('f3', 'office', 'office')] }, 'office'),
  // 지하 1층은 새 본부 그림(PixelLab 11-01, game-src/mapedit/b1): 서→동 샤워실(여) · 샤워실(남) · 훈련장 양문 · 엘리베이터. 교육장·계단 없음(본부 최소화)
  floorHall('b1', '지하 1층', 'B1', [
    // 샤워실 두 곳(11-01): 여자 = 확정 그림 bath_f, 남자 = 같은 그림 색 바꾼 bath_m (game-src/mapedit/bath_*)
    { id: 'shower_f', kind: 'door', to: 'shower_f', toDoor: 'out', label: '탈의실(여)' },
    { id: 'shower_m', kind: 'door', to: 'shower_m', toDoor: 'out', label: '탈의실(남)' },
    { id: 'training', kind: 'steel', to: 'training', toDoor: 'out', needs: 'training', label: '훈련장' },
    { id: 'elev', kind: 'elevator' },
  ]),
  // 샤워실: 출입문은 오른쪽 옆벽(그림 속 문). 자리 6곳(E → 샤워 규칙 재생)은 mapedit.gen 의 MAPEDIT_SPOTS
  // 탈의실(11-02 사용자 「탈의실에서 옷을 벗고 샤워실로」): 지하 1층 → 탈의실(아래 출구) → 샤워실(왼쪽 벽 문). 캐비닛 앞 자리에서 옷 벗기·입기
  floorHall('shower_f', '탈의실(여)', 'B1', [{ id: 'out', kind: 'exit', side: 'S', to: 'b1', toDoor: 'shower_f', label: '나가기' }, { id: 'bath', kind: 'exit', to: 'bath_f', toDoor: 'out', label: '샤워실' }], { sex: '여', lockers: LOCKERS.shower_f, spots: lockerSpots('shower_f') }),
  floorHall('shower_m', '탈의실(남)', 'B1', [{ id: 'out', kind: 'exit', side: 'S', to: 'b1', toDoor: 'shower_m', label: '나가기' }, { id: 'shower', kind: 'exit', to: 'bath_m', toDoor: 'out', label: '샤워실' }], { sex: '남', lockers: LOCKERS.shower_m, spots: lockerSpots('shower_m') }),
  floorHall('bath_f', '샤워실(여)', 'B1', [{ id: 'out', kind: 'exit', to: 'shower_f', toDoor: 'bath', label: '탈의실' }], { sex: '여', showers: showerSpots('bath_f') }),
  floorHall('bath_m', '샤워실(남)', 'B1', [{ id: 'out', kind: 'exit', to: 'shower_m', toDoor: 'shower', label: '탈의실' }], { sex: '남', showers: showerSpots('bath_m') }),
  room({ id: 'training', name: '훈련장', floor: 'B1', look: 'lab', doors: [exitS('b1', 'training', 'training')] }, 'training'),
  // 지하 2층은 새 본부 그림(PixelLab 11-01, game-src/mapedit/b2): 서→동 격리시설 방폭문 · 격리팀 사무실(의무실·연구실) · 엘리베이터. 심문실·창고 없음(본부 최소화)
  floorHall('b2', '격리 구역', 'B2', [
    { id: 'isolation', kind: 'cell', to: 'tooth', toDoor: 'out', needs: 'tooth', label: '격리시설' },
    { id: 'clinic', kind: 'steel', to: 'clinic', toDoor: 'out', label: '격리팀 사무실' },
    { id: 'elev', kind: 'elevator' },
  ]),
  // 의무실 겸 실험실: 의무실(침대) + 격리 연구실(연구·감정)을 한 방으로. 장비 보급은 B3 보급실로 옮김
  { ...room({ id: 'clinic', name: '의무실·연구실', floor: 'B2', look: 'lab', doors: [] }, 'medlab'), doors: [exitS('b2', 'clinic', 'medlab')] },
  room({ id: 'tooth', name: '격리실', floor: 'B2', look: 'lab', doors: [exitS('b2', 'isolation', 'tooth')] }, 'tooth'),
  floorHall('b3', '지하 주차장', 'B3', [
    { id: 'supply', kind: 'steel', place: 'supply', label: '보급실' },
    { id: 'elev', kind: 'elevator' },
  ]),
  // ── 특수재난대응협회 (중립, 11-02 사용자: 관리국 본부 배경을 그대로 쓰고 1층·복도만 새로). 1층 = PixelLab p4(tools/mapedit/author_sdra_lobby.py): 왼쪽 옆벽 정문 · 뒷벽 가운데 엘리베이터. 안내 데스크 없음 ──
  floorHall('sdra_lobby', '협회 1층', '1F', [
    { id: 'main', kind: 'glass', to: 'street', toDoor: 'sdra', label: '정문' },
    { id: 'elev', kind: 'elevator' },
  ]),
  // 협회 2층 복도(11-02 사용자 「화장실만 이은걸로 이층은 마무리」, tools/mapedit/author_sdra_f2.py): 창구 유리문(안쪽 방 그림 없음 → 잠금) · 엘리베이터 · 화장실 남·여. 화장실은 관리국 그림을 그대로 쓴다
  floorHall('sdra_f2', '협회 2층', '2F', [
    { id: 'office', kind: 'glass', locked: true, label: '협회 창구' },
    { id: 'elev', kind: 'elevator' },
    { id: 'wc_m', kind: 'door', to: 'sdra_wc_m', toDoor: 'out', label: '화장실(남)' },
    { id: 'wc_f', kind: 'door', to: 'sdra_wc_f', toDoor: 'out', label: '화장실(여)' },
  ]),
  floorHall('sdra_wc_m', '화장실(남)', '2F', [{ id: 'out', kind: 'exit', side: 'S', to: 'sdra_f2', toDoor: 'wc_m', label: '나가기' }], { toilets: PAINTED.sdra_wc_m?.toilets, sex: '남' }),
  floorHall('sdra_wc_f', '화장실(여)', '2F', [{ id: 'out', kind: 'exit', side: 'S', to: 'sdra_f2', toDoor: 'wc_f', label: '나가기' }], { toilets: PAINTED.sdra_wc_f?.toilets, sex: '여' }),
  // 협회 지하 1층 복도(11-02 사용자 「지하는 저걸로 픽스」, tools/mapedit/author_sdra_b1.py): 서→동 탈의실(남) · 탈의실(여) · 훈련장 양문 · 엘리베이터.
  // 방 안은 관리국 그림·자리를 그대로 쓴다(사용자 11:02 「협회 방 내부는 전부 관리국걸」) — 나가는 문만 협회 지하 1층으로
  floorHall('sdra_b1', '협회 지하 1층', 'B1', [
    { id: 'shower_m', kind: 'door', to: 'sdra_shower_m', toDoor: 'out', label: '탈의실(남)' },
    { id: 'shower_f', kind: 'door', to: 'sdra_shower_f', toDoor: 'out', label: '탈의실(여)' },
    { id: 'training', kind: 'steel', to: 'sdra_training', toDoor: 'out', label: '훈련장' },
    { id: 'elev', kind: 'elevator' },
  ]),
  floorHall('sdra_shower_f', '탈의실(여)', 'B1', [{ id: 'out', kind: 'exit', side: 'S', to: 'sdra_b1', toDoor: 'shower_f', label: '나가기' }, { id: 'bath', kind: 'exit', to: 'sdra_bath_f', toDoor: 'out', label: '샤워실' }], { sex: '여', lockers: LOCKERS.shower_f, spots: lockerSpots('shower_f') }),
  floorHall('sdra_shower_m', '탈의실(남)', 'B1', [{ id: 'out', kind: 'exit', side: 'S', to: 'sdra_b1', toDoor: 'shower_m', label: '나가기' }, { id: 'shower', kind: 'exit', to: 'sdra_bath_m', toDoor: 'out', label: '샤워실' }], { sex: '남', lockers: LOCKERS.shower_m, spots: lockerSpots('shower_m') }),
  floorHall('sdra_bath_f', '샤워실(여)', 'B1', [{ id: 'out', kind: 'exit', to: 'sdra_shower_f', toDoor: 'bath', label: '탈의실' }], { sex: '여', showers: showerSpots('bath_f'), spots: MAPEDIT_SPOTS.bath_f ?? [] }),
  floorHall('sdra_bath_m', '샤워실(남)', 'B1', [{ id: 'out', kind: 'exit', to: 'sdra_shower_m', toDoor: 'shower', label: '탈의실' }], { sex: '남', showers: showerSpots('bath_m'), spots: MAPEDIT_SPOTS.bath_m ?? [] }),
  room({ id: 'sdra_training', name: '훈련장', floor: 'B1', look: 'lab', doors: [exitS('sdra_b1', 'training', 'training')] }, 'training'),
  // ── 중림 지하상가 (중립지역, 그림 4장). 지상 입구 → 지하 1층 앞골목 → (가운데 통로) 뒷골목 / (동쪽 계단) 지하 2층 ──
  floorHall('jr_entry', '중림 지하상가 입구', 'out', [
    { id: 'west', kind: 'exit', side: 'S', to: 'street', toDoor: 'jr', label: '버스 정류장' },
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
  floorHall('jr_jinryo', '진료실', 'B1', [{ id: 'out', kind: 'exit', side: 'S', to: 'jr_songil', toDoor: 'jinryo', label: '대기실로' }], { spots: JR_ROOM_SPOTS.jr_jinryo }),
  floorHall('jr_op', '수술실', 'B1', [{ id: 'out', kind: 'exit', side: 'S', to: 'jr_songil', toDoor: 'op', label: '대기실로' }], { spots: JR_ROOM_SPOTS.jr_op }),
];
export const SCENE_BY_ID = Object.fromEntries(HQ_SCENES.map((s) => [s.id, s])) as Record<SceneId, HqScene>;

/** 엘리베이터 층 단추 (위에서 아래로) */
/** bldg = 건물(없으면 관리국 본부). 엘리베이터는 같은 건물 층만 고른다 (11-02 협회 추가) */
export const ELEVATOR: { floor: HqScene['floor']; label: string; scene: SceneId; door: string; needs?: PlaceId; bldg?: string }[] = [
  { floor: '3F', label: '3', scene: 'f3', door: 'elev' },
  { floor: '2F', label: '2', scene: 'f2', door: 'elev' },
  { floor: '1F', label: '1', scene: 'lobby', door: 'elev' },
  { floor: 'B1', label: 'B1', scene: 'b1', door: 'elev' },
  { floor: 'B2', label: 'B2', scene: 'b2', door: 'elev' },
  { floor: 'B3', label: 'B3', scene: 'b3', door: 'elev' },
  // 협회: 2층·1층·지하 1층
  { floor: '2F', label: '2', scene: 'sdra_f2', door: 'elev', bldg: 'sdra' },
  { floor: '1F', label: '1', scene: 'sdra_lobby', door: 'elev', bldg: 'sdra' },
  { floor: 'B1', label: 'B1', scene: 'sdra_b1', door: 'elev', bldg: 'sdra' },
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
  /** 지금 시작할 장면 (사무실) */
  start: { scene: SceneId; x: number; y?: number };
}
/** 문은 잠금 칸이 없으면 다 열린다. 옛 본부 메뉴 자리(place가 붙은 자리: 임무·장비·감정 …)는 출동과 같이 지워서 닫는다 (2026-10-28) */
export function hqMap(): HqMapView {
  return {
    scenes: HQ_SCENES.map((sc) => ({ ...sc, doors: sc.doors.map((d) => ({ ...d, open: !d.locked && (d.kind !== 'cell' || !!d.place) })), spots: sc.spots.map((p) => ({ ...p, open: !p.place })) })),
    elevator: ELEVATOR.map((e) => ({ ...e, open: true })),
    start: START,
  };
}
