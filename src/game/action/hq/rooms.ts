// 본부 방 배치 (docs/본부_설계_2판.md, 그림 배치도 /mnt/project-files/game/본부/본부_배치도.html 과 같은 숫자).
// 위에서 본 방 좌표(m): x = 서→동, y = 북쪽 벽(0) → 화면 아래. 엔진(map.ts)이 화면 px로 바꾼다.
// 사람이 쓰는 집기는 전부 옆에서 쓴다: 의자 f = 앉은 사람이 보는 쪽(E/W), 샤워만 N(벽을 봄).
import type { PlaceId } from './data';

/** 바닥에 놓인 것. h = 화면 높이 px(사람 키 256 기준). solid가 아니면 지나갈 수 있다(의자) */
export type RoomItem =
  | { t: 'desk' | 'big' | 'wall' | 'glass'; x: number; y: number; w: number; h: number; k?: string; H?: number }
  | { t: 'chair'; x: number; y: number; f: 'E' | 'W' | 'N'; soft?: boolean };
/** 북쪽 벽에 붙은 것 (창·화면·샤워기·관찰 유리) */
export interface RoomFix { x: number; w: number; k: 'window' | 'screen' | 'shower' | 'glass' | 'blinds' | 'shelfwall' | 'elevator' | 'directory' }
/** 쟈알디가 E로 쓰는 자리. place가 있으면 본부 메뉴 창, act는 그 자리 동작(클립 이름, 생활 클립이 들어오면 재생) */
export interface RoomUse { id: string; x: number; y: number; verb: string; place?: PlaceId; who?: string; face?: 1 | -1; act?: string[] }
export interface Room {
  w: number;
  /** 깊이(m): 걷는 띠 전체에 펼친다 */
  d: number;
  items: RoomItem[];
  fix: RoomFix[];
  use: RoomUse[];
}

const seats4 = (xw: number, xe: number, y1: number, y2: number): RoomItem[] => [
  { t: 'chair', x: xw, y: y1, f: 'E' }, { t: 'chair', x: xw, y: y2, f: 'E' }, { t: 'chair', x: xe, y: y1, f: 'W' }, { t: 'chair', x: xe, y: y2, f: 'W' },
];

export const ROOMS: Record<string, Room> = {
  office: {
    w: 22, d: 5,
    fix: [{ x: 0.5, w: 6, k: 'window' }, { x: 7.5, w: 7, k: 'screen' }, { x: 15.5, w: 6, k: 'window' }],
    items: [
      { t: 'desk', x: 1.0, y: 1.0, w: 0.8, h: 1.6, k: 'opdesk' }, { t: 'chair', x: 2.2, y: 1.8, f: 'W' },
      { t: 'desk', x: 6.0, y: 1.0, w: 1.6, h: 2.0 }, ...seats4(5.6, 8.0, 1.5, 2.5),
      { t: 'desk', x: 11.0, y: 1.0, w: 1.6, h: 2.0 }, ...seats4(10.6, 13.0, 1.5, 2.5),
      { t: 'desk', x: 14.2, y: 3.3, w: 1.4, h: 1.2 }, ...seats4(13.8, 16.0, 3.6, 4.3),
      { t: 'glass', x: 16.9, y: 3.0, w: 0.1, h: 2.0 }, { t: 'glass', x: 16.9, y: 3.0, w: 2.6, h: 0.1 },
      { t: 'desk', x: 17.8, y: 3.7, w: 0.6, h: 0.6, H: 70 }, { t: 'chair', x: 17.45, y: 4.0, f: 'E', soft: true }, { t: 'chair', x: 18.75, y: 4.0, f: 'W', soft: true },
      { t: 'desk', x: 19.6, y: 1.0, w: 0.9, h: 1.8, k: 'chiefdesk' }, { t: 'chair', x: 20.9, y: 1.9, f: 'W' },
      { t: 'wall', x: 21.6, y: 0.8, w: 0.3, h: 2.2, H: 150, k: 'cabinet' },
    ],
    use: [
      { id: 'jaemtri', x: 0.55, y: 1.8, verb: '임무', place: 'jaemtri', who: '잼트리', face: 1 },
      { id: 'agents', x: 9.3, y: 3.6, verb: '요원', place: 'office', who: '요원들' },
      { id: 'chief', x: 20.9, y: 3.0, verb: '결재', place: 'chief', face: -1, act: ['chairsit', 'typing'] },
      { id: 'seat', x: 13.0, y: 3.3, verb: '앉기', face: -1, act: ['chairsit', 'seatthink'] },
    ],
  },
  lounge: {
    w: 16, d: 5,
    fix: [{ x: 1, w: 13, k: 'window' }],
    items: [
      { t: 'wall', x: 0.05, y: 0.6, w: 0.6, h: 1.6, H: 280, k: 'vending' },
      { t: 'desk', x: 3.0, y: 1.0, w: 1.4, h: 1.6, H: 140, k: 'counter' },
      { t: 'desk', x: 7.0, y: 1.0, w: 0.8, h: 0.8 }, { t: 'chair', x: 6.6, y: 1.4, f: 'E' }, { t: 'chair', x: 8.2, y: 1.4, f: 'W' },
      { t: 'desk', x: 7.0, y: 3.0, w: 0.8, h: 0.8 }, { t: 'chair', x: 6.6, y: 3.4, f: 'E' }, { t: 'chair', x: 8.2, y: 3.4, f: 'W' },
      { t: 'big', x: 10.0, y: 2.0, w: 4.0, h: 0.9, H: 110, k: 'sofa' },
      { t: 'wall', x: 15.0, y: 0.3, w: 0.7, h: 0.7, H: 430, k: 'pillar' },
    ],
    use: [
      { id: 'coffee', x: 2.6, y: 2.6, verb: '커피', place: 'pantry', who: '동료', face: 1, act: ['handswork', 'drink'] },
      { id: 'table', x: 6.6, y: 3.9, verb: '앉기', face: 1, act: ['chairsit', 'eat'] },
      { id: 'sofa', x: 12.0, y: 3.4, verb: '눕기', act: ['liesit', 'doze'] },
    ],
  },
  swat: {
    w: 20, d: 5,
    fix: [{ x: 4, w: 6, k: 'screen' }, { x: 11, w: 8, k: 'window' }],
    items: [
      { t: 'desk', x: 3.0, y: 2.0, w: 1.6, h: 2.0 }, ...seats4(2.6, 5.0, 2.5, 3.5),
      { t: 'desk', x: 7.5, y: 2.0, w: 1.6, h: 2.0 }, ...seats4(7.1, 9.5, 2.5, 3.5),
      { t: 'desk', x: 12.0, y: 2.0, w: 1.6, h: 2.0 }, ...seats4(11.6, 14.0, 2.5, 3.5),
      { t: 'desk', x: 15.4, y: 2.0, w: 0.9, h: 1.8, k: 'chiefdesk' }, { t: 'chair', x: 16.7, y: 2.9, f: 'W' },
      { t: 'desk', x: 18.0, y: 2.0, w: 1.0, h: 1.6, H: 150, k: 'bench' },
      { t: 'wall', x: 19.6, y: 0.4, w: 0.3, h: 4.2, H: 300, k: 'locker' },
    ],
    use: [{ id: 'gear', x: 17.6, y: 4.2, verb: '점검', face: 1, act: ['gearcheck', 'glove', 'reload'] }],
  },
  wc: {
    w: 8, d: 5,
    fix: [],
    items: [
      { t: 'desk', x: 3.4, y: 1.5, w: 0.6, h: 1.6, H: 130, k: 'sink' },
      { t: 'wall', x: 6.0, y: 0.3, w: 1.9, h: 4.4, H: 300, k: 'stall' },
    ],
    use: [
      { id: 'sink', x: 3.0, y: 2.3, verb: '씻기', face: 1, act: ['handswork', 'brushteeth'] },
      { id: 'stall', x: 5.6, y: 2.5, verb: '칸', face: 1 },
    ],
  },
  interview: {
    w: 9, d: 5,
    fix: [{ x: 1, w: 7, k: 'blinds' }],
    items: [
      { t: 'desk', x: 3.6, y: 1.5, w: 0.8, h: 0.7, H: 70 },
      { t: 'chair', x: 3.1, y: 1.85, f: 'E', soft: true }, { t: 'chair', x: 4.9, y: 1.85, f: 'W', soft: true },
      { t: 'wall', x: 7.3, y: 2.6, w: 0.8, h: 0.6, H: 110, k: 'cart' },
    ],
    use: [{ id: 'table', x: 4.9, y: 2.9, verb: '면담', place: 'interview', who: '구조된 생존자', face: -1, act: ['chairsit', 'seatmouth'] }],
  },
  admin: {
    w: 12, d: 5,
    fix: [{ x: 0.5, w: 5.5, k: 'shelfwall' }, { x: 7, w: 4.5, k: 'screen' }],
    items: [
      { t: 'desk', x: 1.3, y: 0.8, w: 0.6, h: 2.2, H: 170, k: 'counter' }, { t: 'chair', x: 2.3, y: 1.9, f: 'W' },
      { t: 'desk', x: 4.6, y: 1.0, w: 0.8, h: 2.0 }, ...seats4(4.2, 5.8, 1.5, 2.5),
      { t: 'desk', x: 8.2, y: 1.0, w: 0.8, h: 2.0 }, ...seats4(7.8, 9.4, 1.5, 2.5),
      { t: 'wall', x: 11.4, y: 0.4, w: 0.5, h: 3.0, H: 250, k: 'shelf' },
    ],
    use: [{ id: 'counter', x: 0.75, y: 1.9, verb: '정산', face: 1, act: ['handswork'] }],
  },
  bath: {
    w: 24, d: 5,
    fix: [...[6, 7.5, 9, 10.5, 12].map((x): RoomFix => ({ x: x - 0.3, w: 0.6, k: 'shower' })), { x: 15, w: 8, k: 'glass' }],
    items: [
      { t: 'wall', x: 0.05, y: 0.3, w: 0.5, h: 3.2, H: 295, k: 'locker' },
      { t: 'big', x: 2.0, y: 2.0, w: 0.5, h: 1.5, H: 70, k: 'bench' },
      { t: 'glass', x: 4.5, y: 0, w: 0.12, h: 3.0, H: 200 },
      ...[6, 7.5, 9, 10.5, 12].map((x): RoomItem => ({ t: 'chair', x, y: 0.75, f: 'N' })),
      { t: 'big', x: 14.5, y: 1.0, w: 9.0, h: 3.0, H: 85, k: 'tub' },
    ],
    use: [
      { id: 'locker', x: 0.95, y: 1.6, verb: '탈의', face: -1, act: ['undress'] },
      { id: 'shower', x: 9, y: 1.0, verb: '샤워', act: ['showerturn', 'shower'] },
      { id: 'tub', x: 14.1, y: 2.5, verb: '입욕', face: 1, act: ['stepover', 'bath'] },
    ],
  },
  clinic: {
    w: 16, d: 5,
    fix: [],
    items: [
      { t: 'big', x: 2.4, y: 1.8, w: 2.0, h: 0.9, H: 95, k: 'bed' }, { t: 'chair', x: 4.8, y: 2.25, f: 'W' },
      { t: 'big', x: 7.0, y: 1.8, w: 2.0, h: 0.9, H: 95, k: 'bed' }, { t: 'chair', x: 9.4, y: 2.25, f: 'W' },
      { t: 'desk', x: 13.0, y: 1.0, w: 0.8, h: 1.6 }, { t: 'chair', x: 14.2, y: 1.8, f: 'W' },
      { t: 'wall', x: 15.6, y: 0.4, w: 0.3, h: 2.6, H: 260, k: 'cabinet' },
    ],
    use: [{ id: 'bed', x: 3.4, y: 3.2, verb: '쉬기', place: 'clinic', act: ['bedlie', 'liehold'] }],
  },
  training: {
    w: 44, d: 6,
    fix: [{ x: 4, w: 8, k: 'screen' }],
    items: [
      ...[[3, 1.4], [5.5, 3.4], [8, 1.4], [10.5, 3.4]].map(([x, y]): RoomItem => ({ t: 'big', x, y, w: 0.7, h: 0.7, H: 260, k: 'sandbag' })),
      { t: 'big', x: 12.5, y: 4.2, w: 1.6, h: 0.6, H: 60, k: 'bench' },
      { t: 'wall', x: 16, y: 0.8, w: 0.35, h: 5.1, H: 140, k: 'lowwall' }, { t: 'wall', x: 18.5, y: 0.8, w: 0.35, h: 5.1, H: 140, k: 'lowwall' }, { t: 'wall', x: 21, y: 0.8, w: 0.35, h: 5.1, H: 140, k: 'lowwall' },
      { t: 'wall', x: 26, y: 0.8, w: 0.4, h: 5.1, H: 170, k: 'range' },
      ...[1.4, 2.6, 3.8, 5.0].map((y): RoomItem => ({ t: 'wall', x: 43, y: y - 0.3, w: 0.5, h: 0.6, H: 200, k: 'target' })),
    ],
    use: [
      { id: 'bag', x: 2.4, y: 2.6, verb: '훈련', place: 'training', face: 1, act: ['jab', 'cross'] },
      { id: 'bag2', x: 9.9, y: 4.6, verb: '샌드백', face: 1, act: ['jab', 'cross'] },
      { id: 'photo', x: 24, y: 0.55, verb: '올려다보기', act: ['holdlook'] },
      { id: 'range', x: 25.6, y: 3.8, verb: '사격', face: 1, act: ['fire', 'reload'] },
    ],
  },
  lab: {
    w: 22, d: 5,
    fix: [{ x: 5, w: 9, k: 'glass' }],
    items: [
      { t: 'desk', x: 1.8, y: 0.8, w: 0.6, h: 2.2, H: 160, k: 'counter' },
      { t: 'wall', x: 3.8, y: 0.3, w: 0.3, h: 3.0, H: 290, k: 'shelf' },
      { t: 'desk', x: 8.0, y: 1.0, w: 2.0, h: 1.6, k: 'labbench' }, { t: 'chair', x: 7.6, y: 1.8, f: 'E' }, { t: 'chair', x: 10.4, y: 1.8, f: 'W' },
      { t: 'desk', x: 15.0, y: 1.0, w: 1.4, h: 1.6, k: 'labbench' }, { t: 'chair', x: 16.8, y: 1.8, f: 'W' },
      { t: 'wall', x: 18.8, y: 3.4, w: 0.9, h: 0.6, H: 110, k: 'cart' },
      { t: 'wall', x: 21.6, y: 0.4, w: 0.3, h: 3.6, H: 290, k: 'shelf' },
    ],
    use: [
      { id: 'supply', x: 1.25, y: 1.9, verb: '장비', place: 'supply', who: '고그니쟈', face: 1 },
      { id: 'research', x: 7.6, y: 3.0, verb: '연구', place: 'lab', face: 1 },
      { id: 'appraisal', x: 14.6, y: 1.8, verb: '감정', place: 'appraisal', who: '데쥬레', face: 1 },
    ],
  },
  tooth: {
    w: 9, d: 5,
    fix: [{ x: 2, w: 5, k: 'glass' }],
    items: [{ t: 'wall', x: 4.0, y: 1.0, w: 1.0, h: 1.2, H: 120, k: 'slot' }],
    use: [{ id: 'slot', x: 3.4, y: 2.6, verb: '이빨', place: 'tooth', face: 1 }],
  },
};

/** 좌우 뒤집기: 코어 서쪽 방은 출입문(코어 쪽)이 동쪽 끝에 온다 */
export function mirror(r: Room): Room {
  const flip = (f: 'E' | 'W' | 'N') => (f === 'E' ? 'W' : f === 'W' ? 'E' : f);
  return {
    ...r,
    items: r.items.map((it) => (it.t === 'chair' ? { ...it, x: r.w - it.x, f: flip(it.f) } : { ...it, x: r.w - it.x - it.w })),
    fix: r.fix.map((f) => ({ ...f, x: r.w - f.x - f.w })),
    use: r.use.map((u) => ({ ...u, x: r.w - u.x, face: u.face ? (-u.face as 1 | -1) : undefined })),
  };
}
