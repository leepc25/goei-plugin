// 본부 건물 지도 (docs/본부_평면도.md). 장면 하나 = 방 하나 또는 복도 하나. 엔진(engine/hub.ts)은 이걸 받아 장면을 그리고,
// 문 → 다른 장면, 엘리베이터 → 층 고르기, 자리(spot) 앞 E → 본부 메뉴 창(openPlace)을 연다.
// 화면에 방 이름·층·잠김 이유 같은 글씨를 쓰지 않는다. 방 이름은 들어갈 때 잠깐 뜨는 제목으로만 쓴다.
import type { PlaceId } from './data';
import type { HqSave } from './state';
import { placeOpen } from './logic';

export type SceneId =
  | 'street' | 'lobby' | 'f2' | 'clinic' | 'interview' | 'office' | 'chief' | 'pantry'
  | 'supply' | 'training' | 'b2' | 'appraisal' | 'lab' | 'tooth' | 'pasta';

export type DoorKind = 'main' | 'door' | 'glass' | 'steel' | 'security' | 'elevator' | 'stairs_up' | 'stairs_down' | 'shop';
export interface HqDoor {
  id: string;
  /** 문 가운데 x (장면 왼쪽 끝 0 기준) */
  x: number;
  kind: DoorKind;
  /** 나가면 가는 장면과 그 장면의 도착 문. 엘리베이터는 비워 두고 ELEVATOR에서 층을 고른다 */
  to?: SceneId;
  toDoor?: string;
  /** 이 장소가 열려야 열리는 문 (아니면 닫힌 채 덜컹) */
  needs?: PlaceId;
}
/** 방 안 기능 자리. 앞에서 E → 본부 메뉴 창(place) */
export interface HqSpot {
  id: string;
  x: number;
  place: PlaceId;
  /** 자리 주인 (도트가 없으면 빈 자리 물건 + 목소리로만). 없으면 물건만 */
  who?: string;
  /** 자리 앞에 뜨는 짧은 동사 */
  verb: string;
}
/** 가구·물건. wall=true면 벽에 붙은 것(창, 화이트보드, 선반), 아니면 바닥에 선 것. h는 화면 픽셀(벽 높이 370 기준) */
export interface HqThing {
  kind: string;
  x: number;
  w: number;
  h: number;
  wall?: boolean;
  /** 주인 없는 자리 표시 물건 (카디건, 컵 등) */
  sign?: boolean;
}
export interface HqScene {
  id: SceneId;
  /** 들어갈 때 잠깐 뜨는 제목 */
  name: string;
  floor: 'out' | '1F' | '2F' | '3F' | 'B1' | 'B2';
  length: number;
  /** 배경 묶음 이름 (타일과 배경 스레드가 그림을 붙인다) */
  look: string;
  doors: HqDoor[];
  spots: HqSpot[];
  things: HqThing[];
}

const S = (id: SceneId, name: string, floor: HqScene['floor'], length: number, look: string, doors: HqDoor[], spots: HqSpot[], things: HqThing[]): HqScene => ({ id, name, floor, length, look, doors, spots, things });

export const HQ_SCENES: HqScene[] = [
  S('street', '종로 뒷골목', 'out', 1920, 'street',
    [{ id: 'main', x: 640, kind: 'main', to: 'lobby', toDoor: 'main' }, { id: 'pasta', x: 1500, kind: 'shop', to: 'pasta', toDoor: 'out', needs: 'pasta' }],
    [],
    [{ kind: 'streetlamp', x: 300, w: 30, h: 360 }, { kind: 'streetlamp', x: 1150, w: 30, h: 360 }, { kind: 'bike', x: 860, w: 120, h: 80 }]),
  // 로비: 엘리베이터는 우편함 오른쪽 칸, 계단 두 개는 그 오른쪽 칸들에 (그림 확인 2026-10-22)
  S('lobby', '1층 로비', '1F', 2160, 'lobby',
    [{ id: 'main', x: 140, kind: 'main', to: 'street', toDoor: 'main' }, { id: 'elev', x: 985, kind: 'elevator' }, { id: 'up', x: 1455, kind: 'stairs_up', to: 'f2', toDoor: 'down' }, { id: 'down', x: 1925, kind: 'stairs_down', to: 'supply', toDoor: 'up' }],
    [],
    [{ kind: 'guard_desk', x: 400, w: 260, h: 120 }, { kind: 'mailboxes', x: 600, w: 120, h: 150, wall: true }, { kind: 'plant', x: 650, w: 60, h: 130 }]),
  S('f2', '2층', '2F', 1640, 'corridor',
    [{ id: 'elev', x: 330, kind: 'elevator' }, { id: 'down', x: 60, kind: 'stairs_down', to: 'lobby', toDoor: 'up' }, { id: 'up', x: 1500, kind: 'stairs_up', to: 'office', toDoor: 'down' }, { id: 'clinic', x: 640, kind: 'door', to: 'clinic', toDoor: 'out' }, { id: 'interview', x: 1040, kind: 'door', to: 'interview', toDoor: 'out', needs: 'interview' }],
    [],
    [{ kind: 'window', x: 1250, w: 140, h: 120, wall: true }, { kind: 'hydrant_box', x: 840, w: 70, h: 110, wall: true }]),
  S('clinic', '의무실', '2F', 1280, 'clinic',
    [{ id: 'out', x: 120, kind: 'door', to: 'f2', toDoor: 'clinic' }],
    [{ id: 'bed', x: 700, place: 'clinic', verb: '쉬기' }],
    [{ kind: 'med_cabinet', x: 330, w: 140, h: 220, wall: true }, { kind: 'bed', x: 560, w: 220, h: 90 }, { kind: 'curtain', x: 680, w: 20, h: 300 }, { kind: 'bed', x: 820, w: 220, h: 90 }, { kind: 'iv_stand', x: 960, w: 30, h: 200 }, { kind: 'bed', x: 1100, w: 220, h: 90 }]),
  S('interview', '면담실', '2F', 960, 'interview',
    [{ id: 'out', x: 110, kind: 'door', to: 'f2', toDoor: 'interview' }],
    [{ id: 'table', x: 560, place: 'interview', who: '구조된 생존자', verb: '면담' }],
    [{ kind: 'blinds', x: 560, w: 260, h: 150, wall: true }, { kind: 'table_small', x: 560, w: 200, h: 80 }, { kind: 'chair', x: 440, w: 50, h: 100 }, { kind: 'chair', x: 680, w: 50, h: 100 }, { kind: 'recorder', x: 560, w: 30, h: 16, sign: true }]),
  // 3층: 엘리베이터에서 내리면 유리문 → 큰 사무실. 잼트리 자리는 입구 바로 옆
  S('office', '종합대응팀', '3F', 3200, 'office',
    [{ id: 'elev', x: 330, kind: 'elevator' }, { id: 'down', x: 60, kind: 'stairs_down', to: 'f2', toDoor: 'up' }, { id: 'chief', x: 2450, kind: 'door', to: 'chief', toDoor: 'out' }, { id: 'pantry', x: 2950, kind: 'door', to: 'pantry', toDoor: 'out' }],
    [
      { id: 'jaemtri', x: 700, place: 'jaemtri', who: '잼트리', verb: '임무' },
      { id: 'agents', x: 1400, place: 'office', who: '요원들', verb: '요원' },
    ],
    [
      { kind: 'glass_door', x: 500, w: 120, h: 300, wall: true },
      { kind: 'whiteboard', x: 840, w: 240, h: 150, wall: true },
      { kind: 'desk_monitors', x: 700, w: 260, h: 130 },
      { kind: 'condensed_milk_coffee', x: 640, w: 20, h: 26, sign: true },
      { kind: 'cardigan_chair', x: 770, w: 60, h: 110, sign: true },
      { kind: 'window', x: 1150, w: 300, h: 170, wall: true },
      { kind: 'window', x: 1650, w: 300, h: 170, wall: true },
      { kind: 'desk_row', x: 1200, w: 420, h: 110 },
      { kind: 'desk_row', x: 1700, w: 420, h: 110 },
      { kind: 'coat_chair', x: 1420, w: 60, h: 110, sign: true },
      { kind: 'copier', x: 2050, w: 120, h: 130 },
      { kind: 'sofa', x: 2250, w: 240, h: 90 },
      { kind: 'meeting_table', x: 2700, w: 260, h: 90 },
    ]),
  S('chief', '부장실', '3F', 1100, 'chief',
    [{ id: 'out', x: 110, kind: 'door', to: 'office', toDoor: 'chief' }],
    [{ id: 'desk', x: 640, place: 'chief', who: '부장', verb: '결재' }],
    [{ kind: 'bookshelf', x: 380, w: 180, h: 260, wall: true }, { kind: 'window', x: 820, w: 260, h: 170, wall: true }, { kind: 'chief_desk', x: 640, w: 280, h: 120 }, { kind: 'paper_pile', x: 560, w: 60, h: 40, sign: true }]),
  S('pantry', '탕비실', '3F', 1000, 'pantry',
    [{ id: 'out', x: 110, kind: 'door', to: 'office', toDoor: 'pantry' }],
    [{ id: 'coffee', x: 460, place: 'pantry', who: '동료', verb: '커피' }],
    [{ kind: 'sink_counter', x: 460, w: 360, h: 120 }, { kind: 'coffee_machine', x: 420, w: 70, h: 80, sign: true }, { kind: 'mix_coffee_box', x: 520, w: 50, h: 40, sign: true }, { kind: 'fridge', x: 760, w: 110, h: 250 }, { kind: 'table_small', x: 640, w: 160, h: 80 }]),
  // 계단(그림 폭 최대 280)과 엘리베이터(폭 약 210 + 호출 단추) 사이는 그림 반폭 합 이상 띄운다 (통합 검수 22).
  // 지하 1층: 창고형 정비·보급실, 옆 철문으로 훈련장
  S('supply', '정비·보급실', 'B1', 2240, 'supply',
    [{ id: 'elev', x: 390, kind: 'elevator' }, { id: 'up', x: 90, kind: 'stairs_up', to: 'lobby', toDoor: 'down' }, { id: 'down', x: 640, kind: 'stairs_down', to: 'b2', toDoor: 'up', needs: 'appraisal' }, { id: 'training', x: 2140, kind: 'steel', to: 'training', toDoor: 'out', needs: 'training' }],
    [
      { id: 'locker', x: 940, place: 'supply', who: '콘쥬스', verb: '장비' },
    ],
    [{ kind: 'locker_row', x: 940, w: 300, h: 250, wall: true }, { kind: 'workbench', x: 1300, w: 240, h: 110 }, { kind: 'shelf', x: 1580, w: 220, h: 280, wall: true }, { kind: 'shelf', x: 1830, w: 220, h: 280, wall: true }, { kind: 'cargo_cart', x: 1120, w: 130, h: 90, sign: true }]),
  S('training', '훈련장', 'B1', 2560, 'training',
    [{ id: 'out', x: 110, kind: 'steel', to: 'supply', toDoor: 'training' }],
    [{ id: 'dummy', x: 900, place: 'training', verb: '훈련' }],
    [{ kind: 'mat', x: 900, w: 700, h: 20 }, { kind: 'dummy', x: 1000, w: 70, h: 200 }, { kind: 'record_board', x: 600, w: 200, h: 140, wall: true }, { kind: 'shooting_lane', x: 1900, w: 900, h: 140 }]),
  // 지하 2층: 카드키. 보안문 → 격리 구역 복도(전시) → 감정실 · 연구실 · 끝 철문
  S('b2', '격리 구역', 'B2', 2560, 'containment',
    [{ id: 'elev', x: 390, kind: 'elevator' }, { id: 'up', x: 90, kind: 'stairs_up', to: 'supply', toDoor: 'down' }, { id: 'appraisal', x: 860, kind: 'door', to: 'appraisal', toDoor: 'out' }, { id: 'lab', x: 1360, kind: 'security', to: 'lab', toDoor: 'out', needs: 'lab' }, { id: 'tooth', x: 2440, kind: 'steel', to: 'tooth', toDoor: 'out', needs: 'tooth' }],
    [{ id: 'showcase', x: 1900, place: 'gallery', verb: '전시' }],
    [{ kind: 'security_gate', x: 620, w: 80, h: 300, wall: true }, { kind: 'showcase', x: 1800, w: 160, h: 200 }, { kind: 'showcase', x: 2050, w: 160, h: 200 }, { kind: 'warning_light', x: 1060, w: 30, h: 30, wall: true }]),
  S('appraisal', '감정실', 'B2', 1280, 'appraisal',
    [{ id: 'out', x: 110, kind: 'door', to: 'b2', toDoor: 'appraisal' }],
    [{ id: 'bench', x: 600, place: 'appraisal', who: '데쥬레', verb: '감정' }],
    [{ kind: 'appraisal_bench', x: 600, w: 300, h: 110 }, { kind: 'gloves', x: 540, w: 40, h: 20, sign: true }, { kind: 'hologram', x: 950, w: 140, h: 200 }, { kind: 'drawers', x: 330, w: 160, h: 220, wall: true }]),
  S('lab', '격리 연구실', 'B2', 1920, 'lab',
    [{ id: 'out', x: 110, kind: 'security', to: 'b2', toDoor: 'lab' }],
    [{ id: 'bench', x: 700, place: 'lab', who: '고그니쟈', verb: '연구' }],
    [{ kind: 'lab_bench', x: 700, w: 320, h: 110 }, { kind: 'mix_coffee_box', x: 620, w: 50, h: 40, sign: true }, { kind: 'glass_cell', x: 1300, w: 420, h: 330, wall: true }, { kind: 'server_rack', x: 1750, w: 110, h: 260 }]),
  S('tooth', '이빨 요정 격리실', 'B2', 1280, 'tooth',
    [{ id: 'out', x: 110, kind: 'steel', to: 'b2', toDoor: 'tooth' }],
    [{ id: 'slot', x: 520, place: 'tooth', verb: '이빨' }],
    [{ kind: 'tooth_tree', x: 880, w: 300, h: 340 }, { kind: 'cage', x: 880, w: 420, h: 340, wall: true }, { kind: 'feed_slot', x: 520, w: 90, h: 120 }]),
  S('pasta', '파스타집', 'out', 1280, 'pasta',
    [{ id: 'out', x: 110, kind: 'shop', to: 'street', toDoor: 'pasta' }],
    [{ id: 'table', x: 680, place: 'pasta', who: '전원', verb: '회식' }],
    [{ kind: 'long_table', x: 680, w: 520, h: 90 }, { kind: 'kitchen_window', x: 1050, w: 220, h: 120, wall: true }]),
];
export const SCENE_BY_ID = Object.fromEntries(HQ_SCENES.map((s) => [s.id, s])) as Record<SceneId, HqScene>;

/** 엘리베이터 층 단추 (위에서 아래로). B2는 카드키: 감정실이 열린 뒤 */
export const ELEVATOR: { floor: HqScene['floor']; label: string; scene: SceneId; door: string; needs?: PlaceId }[] = [
  { floor: '3F', label: '3', scene: 'office', door: 'elev' },
  { floor: '2F', label: '2', scene: 'f2', door: 'elev' },
  { floor: '1F', label: '1', scene: 'lobby', door: 'elev' },
  { floor: 'B1', label: 'B1', scene: 'supply', door: 'elev' },
  { floor: 'B2', label: 'B2', scene: 'b2', door: 'elev', needs: 'appraisal' },
];

/** 메뉴 「장소로 가기」·장소 id → 그 장면과 서 있을 x */
export function whereIs(place: PlaceId): { scene: SceneId; x: number } {
  for (const sc of HQ_SCENES) {
    const sp = sc.spots.find((p) => p.place === place);
    if (sp) return { scene: sc.id, x: sp.x - 90 };
  }
  if (place === 'street') return { scene: 'street', x: 640 };
  return { scene: 'office', x: 620 };
}

export interface HqMapView {
  scenes: (HqScene & { doors: (HqDoor & { open: boolean })[]; spots: (HqSpot & { open: boolean })[] })[];
  elevator: (typeof ELEVATOR[number] & { open: boolean })[];
  /** 지금 시작할 장면: 출근·귀환은 3층 사무실 잼트리 자리 옆, 후송 직후는 2층 의무실 */
  start: { scene: SceneId; x: number };
}
export function hqMap(s: HqSave, justEvacuated = false): HqMapView {
  const ok = (p?: PlaceId) => !p || placeOpen(s, p);
  return {
    scenes: HQ_SCENES.map((sc) => ({ ...sc, doors: sc.doors.map((d) => ({ ...d, open: ok(d.needs) })), spots: sc.spots.map((p) => ({ ...p, open: ok(p.place) })) })),
    elevator: ELEVATOR.map((e) => ({ ...e, open: ok(e.needs) })),
    start: justEvacuated ? { scene: 'clinic', x: 560 } : { scene: 'office', x: 560 },
  };
}
