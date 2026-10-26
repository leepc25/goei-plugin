// 첫 시연 범위(관리국 본부 + 정면 거리 + 종로 큰길)의 세계 자료. 엔진(places·actors)은 이 자료만 읽는다.
// 장소가 늘면 꼬리표·오가는 범위·보충 규칙을 여기(나중엔 게임 팩 JSON)에 더한다.
import { WorldSim, type SpawnRule } from './actors';
import type { Post } from './mobs';
import { PlaceGraph, type ElevatorStop, type PlaceKind, type PlaceScene } from './places';
import { mulberry32 } from './rng';

export const HQ_KINDS: Record<string, PlaceKind> = {
  street: 'street', jongno: 'street', pasta: 'shop', lobby: 'lobby', f2: 'corridor', f3: 'corridor', b1: 'corridor', b2: 'corridor', b3: 'garage',
  office: 'office', swat: 'office', interview: 'room', edu: 'room', lounge: 'lounge', wc: 'restroom', wc3: 'restroom', training: 'training', clinic: 'clinic', tooth: 'cell',
};

/** 이름 인물이 오가는 장면: 처음 선 장면(본편 상태로 정한 방) → 범위. 부상은 의무실에 묶인다 */
export const HQ_ROAM: Record<string, string[]> = {
  office: ['office', 'f3', 'lounge', 'wc3'],
  lounge: ['lounge', 'f3', 'office', 'wc3'],
  clinic: ['clinic'],
};

/** 몹 보충 (6-2장). 수치는 시연판에서 조정 */
export function hqSpawns(graph: PlaceGraph): SpawnRule[] {
  const lobbyMain = graph.scene('lobby')?.doors.find((d) => d.id === 'main')?.x;
  return [
    { scene: 'street', target: { day: 4, night: 2 }, refill: [3, 7], gates: [30, 1890], mix: ['행인', '회사원', '배달원', '불량배'] },
    { scene: 'jongno', target: { day: 8, night: 3 }, refill: [2, 5], mix: ['행인', '회사원', '학생', '관광객', '회사원', '불량배'] },
    ...(lobbyMain !== undefined ? [{ scene: 'lobby', target: { day: 2, night: 0 }, refill: [6, 12], gates: [lobbyMain], mix: ['방문객', '행정 직원'] } as SpawnRule] : []),
  ];
}

/** 근무형 몹 (6-3장 근무표 초안, 수치는 시연판에서 조정) */
export function hqPosts(graph: PlaceGraph): Post[] {
  const lobby = graph.scene('lobby');
  if (!lobby) return [];
  const gate = lobby.doors.find((d) => d.id === 'main')?.x ?? 300;
  const desk = Math.round(lobby.length * 0.55);
  return [
    { id: 'desk', archetype: '안내 직원', scene: 'lobby', how: 'fixed', spot: desk, shifts: [[9, 18]], count: 1, gate },
    { id: 'night', archetype: '경비', scene: 'lobby', how: 'fixed', spot: desk, shifts: [[18, 9]], count: 1, gate },
    { id: 'guard', archetype: '경비', scene: 'lobby', how: 'patrol', span: [gate + 120, Math.min(lobby.length - 120, gate + 900)], shifts: [[0, 24]], count: 1, gate },
    { id: 'cleaner', archetype: '청소부', scene: 'lobby', how: 'roam', route: ['lobby', 'f2', 'f3', 'b1', 'lobby'], stay: 40, shifts: [[6, 9], [20, 23]], count: 1, gate },
  ];
}

export function createHqWorld(
  map: { scenes: PlaceScene[]; elevator: ElevatorStop[] },
  seed: number,
  present: { name: string; scene: string }[],
  has: (look: string, clip: string) => boolean = () => false,
): WorldSim {
  const graph = new PlaceGraph(map.scenes, map.elevator, HQ_KINDS);
  const sim = new WorldSim(graph, mulberry32(seed), { spawns: hqSpawns(graph), posts: hqPosts(graph), has });
  for (const p of present) {
    if (!graph.scene(p.scene)) continue;
    // 부상(의무실)이면 침대 곁에만: 오가는 범위가 의무실 하나
    sim.add({ id: `npc:${p.name}`, name: p.name, kind: 'named', brain: 'needs', home: p.scene, roam: HQ_ROAM[p.scene] ?? [p.scene], look: p.name });
  }
  return sim;
}
