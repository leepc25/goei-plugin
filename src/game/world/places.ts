// 장소 그래프 (docs/필드_세계_NPC_설계.md 4장). 장면 = 점, 문·계단·엘리베이터 = 선.
// 엔진은 특정 장소를 모른다: 장면 자료(지금은 본부 지도 hq/map.ts)를 받아 그래프를 만든다. 새 장면은 자료만 늘리면 된다.
export interface PlaceDoor {
  id: string;
  x: number;
  kind: string;
  side?: 'N' | 'S';
  to?: string;
  toDoor?: string;
  up?: string;
  down?: string;
  locked?: boolean;
  /** 지도에서 열림 여부 (없으면 열림) */
  open?: boolean;
}
export interface PlaceScene {
  id: string;
  name: string;
  floor?: string;
  length: number;
  lane?: [number, number];
  legacy?: boolean;
  doors: PlaceDoor[];
  /** 지도 의자 (box = 장면 상자 번호, face = 앉은 사람이 보는 쪽). 이름 인물이 일·식사·휴식을 앉아서 할 자리 */
  seats?: { x: number; y: number; face?: 'E' | 'W' | 'N'; box: number }[];
}
export interface ElevatorStop {
  scene: string;
  door: string;
  open?: boolean;
}
/** 장면 종류 꼬리표 (인구·직무 규칙이 쓴다). 표에 없으면 kindOf가 이름으로 짐작 */
export type PlaceKind = 'office' | 'corridor' | 'lobby' | 'lounge' | 'clinic' | 'restroom' | 'training' | 'garage' | 'cell' | 'street' | 'shop' | 'room';

export interface Hop {
  /** 이 장면에서 */
  from: string;
  /** 이 문으로 나가 */
  exit: string;
  /** 이 장면의 */
  to: string;
  /** 이 문으로 들어온다 */
  enter: string;
  /** 문 지나는 데 드는 초 (생활 시간, 시계와 무관) */
  sec: number;
}

const DEFAULT_LANE: [number, number] = [470, 680];

export class PlaceGraph {
  readonly scenes = new Map<string, PlaceScene>();
  private edges = new Map<string, Hop[]>();
  constructor(scenes: PlaceScene[], elevator: ElevatorStop[] = [], private kinds: Record<string, PlaceKind> = {}) {
    for (const s of scenes) this.scenes.set(s.id, s);
    const add = (h: Hop) => (this.edges.get(h.from) ?? this.edges.set(h.from, []).get(h.from)!).push(h);
    const usable = (d: PlaceDoor) => !d.locked && d.open !== false;
    for (const s of scenes) {
      for (const d of s.doors) {
        if (!usable(d)) continue;
        if (d.to && this.scenes.has(d.to)) add({ from: s.id, exit: d.id, to: d.to, enter: d.toDoor ?? d.id, sec: 3 });
        for (const t of [d.up, d.down]) if (t && this.scenes.has(t)) add({ from: s.id, exit: d.id, to: t, enter: this.stairDoor(t) ?? d.id, sec: 20 });
        if (d.kind === 'elevator') {
          for (const e of elevator) if (e.scene !== s.id && e.open !== false && this.scenes.has(e.scene)) add({ from: s.id, exit: d.id, to: e.scene, enter: e.door, sec: 30 });
        }
      }
    }
  }
  private stairDoor(sceneId: string): string | null {
    return this.scenes.get(sceneId)?.doors.find((d) => d.kind === 'stairs' || d.up || d.down)?.id ?? null;
  }
  scene(id: string): PlaceScene | undefined {
    return this.scenes.get(id);
  }
  lane(id: string): [number, number] {
    return this.scenes.get(id)?.lane ?? DEFAULT_LANE;
  }
  kind(id: string): PlaceKind {
    return this.kinds[id] ?? 'room';
  }
  neighbors(id: string): Hop[] {
    return this.edges.get(id) ?? [];
  }
  /** 문 앞 발 자리: 북쪽 벽 문은 띠 위쪽, 화면 아래 출입은 띠 아래쪽, 옛 장면은 띠 가운데 */
  doorSpot(sceneId: string, doorId: string): { x: number; y: number } | null {
    const s = this.scenes.get(sceneId);
    const d = s?.doors.find((q) => q.id === doorId);
    if (!s || !d) return null;
    const [top, bot] = this.lane(sceneId);
    const y = s.legacy ? (top + bot) / 2 : d.side === 'S' ? bot - 14 : top + 16;
    return { x: d.x, y };
  }
  /** 가장 적은 문을 지나는 길 (BFS). 같으면 null, 못 가면 null */
  route(from: string, to: string): Hop[] | null {
    if (from === to || !this.scenes.has(from) || !this.scenes.has(to)) return null;
    const prev = new Map<string, Hop>();
    const seen = new Set([from]);
    const q = [from];
    while (q.length) {
      const cur = q.shift()!;
      for (const h of this.neighbors(cur)) {
        if (seen.has(h.to)) continue;
        seen.add(h.to);
        prev.set(h.to, h);
        if (h.to === to) {
          const path: Hop[] = [];
          for (let at = to; at !== from; ) {
            const step = prev.get(at)!;
            path.unshift(step);
            at = step.from;
          }
          return path;
        }
        q.push(h.to);
      }
    }
    return null;
  }
}
