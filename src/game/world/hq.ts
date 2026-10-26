// 첫 시연 범위(관리국 본부 + 정면 거리 + 종로 큰길)의 세계 자료. 엔진(places·actors)은 이 자료만 읽는다.
// 장소가 늘면 꼬리표·오가는 범위·보충 규칙을 여기(나중엔 게임 팩 JSON)에 더한다.
import { WorldSim, type SpawnRule } from './actors';
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
    { scene: 'street', target: { day: 4, night: 1 }, refill: [3, 7], gates: [30, 1890], mix: ['행인', '회사원', '배달원'] },
    { scene: 'jongno', target: { day: 8, night: 2 }, refill: [2, 5], mix: ['행인', '회사원', '학생', '관광객'] },
    ...(lobbyMain !== undefined ? [{ scene: 'lobby', target: { day: 2, night: 0 }, refill: [6, 12], gates: [lobbyMain], mix: ['방문객', '행정 직원'] } as SpawnRule] : []),
  ];
}

export function createHqWorld(map: { scenes: PlaceScene[]; elevator: ElevatorStop[] }, seed: number, present: { name: string; scene: string }[]): WorldSim {
  const graph = new PlaceGraph(map.scenes, map.elevator, HQ_KINDS);
  const sim = new WorldSim(graph, mulberry32(seed), hqSpawns(graph));
  for (const p of present) {
    if (!graph.scene(p.scene)) continue;
    sim.add({ id: `npc:${p.name}`, name: p.name, kind: 'named', brain: 'roam', home: p.scene, roam: HQ_ROAM[p.scene] ?? [p.scene], look: p.name });
  }
  return sim;
}
