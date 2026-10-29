// 첫 시연 범위(관리국 본부 + 정면 거리 + 종로 큰길)의 세계 자료. 엔진(places·actors)은 이 자료만 읽는다.
// 장소가 늘면 꼬리표·오가는 범위·보충 규칙을 여기(나중엔 게임 팩 JSON)에 더한다.
import { WorldSim, type SimOptions, type SpawnRule } from './actors';
import type { Post } from './mobs';
import { PlaceGraph, type ElevatorStop, type PlaceKind, type PlaceScene } from './places';
import { mulberry32 } from './rng';
import { areaSpawns, type AreaKind } from './districts';

export const HQ_KINDS: Record<string, PlaceKind> = {
  street: 'street', jongno: 'street', pasta: 'shop', metro: 'street', yeongdeungpo: 'street', gangnam: 'street', mangwon: 'street', yeouido: 'street', lobby: 'lobby', f2: 'corridor', f3: 'corridor', b1: 'corridor', b2: 'corridor', b3: 'garage',
  office: 'office', swat: 'office', interview: 'room', edu: 'room', lounge: 'lounge', wc: 'restroom', wc3: 'restroom', training: 'training', clinic: 'clinic', tooth: 'cell',
};

/** 바깥 장면 꼬리표 (6-4장 인구) */
export const HQ_AREAS: Record<string, AreaKind> = {
  street: 'alley', jongno: 'downtown', metro: 'subway', yeongdeungpo: 'market', gangnam: 'nightlife', mangwon: 'residential', yeouido: 'park',
};
/** 지역: 바뀌면 시계 「지역 이동」. 승강장은 지역 없음(타고 내릴 때 정해진다). 본부 안은 종로 */
const HQ_DISTRICT: Record<string, string> = { yeongdeungpo: 'yeongdeungpo', gangnam: 'gangnam', mangwon: 'mangwon', yeouido: 'yeouido' };
export const hqDistrict = (scene: string): string | null => (scene === 'metro' ? null : HQ_DISTRICT[scene] ?? 'jongno');

/** 장면 소속: 본부 안은 관리국(A00). 바깥 거리·가게·중림 지하상가(jr_*, 민간 상가)는 없음 */
export const hqSceneFaction = (scene: string): string | null => (scene === 'pasta' || scene.startsWith('jr_') || HQ_AREAS[scene] ? null : 'A00');

/** 이름 인물이 오가는 장면: 처음 선 장면(본편 상태로 정한 방) → 범위. 부상은 의무실에 묶인다 */
export const HQ_ROAM: Record<string, string[]> = {
  office: ['office', 'f3', 'lounge', 'wc3'],
  lounge: ['lounge', 'f3', 'office', 'wc3'],
  clinic: ['clinic'],
};

/** 몹 보충 (6-2장). 수치는 시연판에서 조정 */
export function hqSpawns(graph: PlaceGraph): SpawnRule[] {
  const lobbyMain = graph.scene('lobby')?.doors.find((d) => d.id === 'main')?.x;
  // 바깥은 꼬리표로 (승강장은 타는 곳마다 드나든다)
  const metroGates = graph.scene('metro')?.doors.map((d) => d.x);
  return [
    ...areaSpawns(Object.fromEntries(Object.entries(HQ_AREAS).filter(([s]) => graph.scene(s))), { street: [30, 1890], ...(metroGates?.length ? { metro: metroGates } : {}) }),
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
    // 의무실·연구실(B2): 의사·간호사 주간 근무 (문은 방 아래 출입이라 gate = 출입 x)
    ...clinicPosts(graph),
    // 필드 가게 주인 (src/game/world/fieldShop.ts SHOPS: 편의점 24시간, 시장 노점 06~19시). 가게 자리 x는 hq/map.ts spots와 같게
    ...(graph.scene('jongno') ? [{ id: 'cvs-clerk', archetype: '편의점 점원', scene: 'jongno', how: 'fixed', spot: 1300, shifts: [[0, 24]], count: 1, gate: 2200 } as Post] : []),
    ...(graph.scene('yeongdeungpo') ? [{ id: 'market-seller', archetype: '상인', scene: 'yeongdeungpo', how: 'fixed', spot: 1500, shifts: [[6, 19]], count: 1, gate: 200 } as Post] : []),
  ];
}

function clinicPosts(graph: PlaceGraph): Post[] {
  const c = graph.scene('clinic');
  if (!c) return [];
  const gate = c.doors.find((d) => d.id === 'out')?.x ?? 100;
  return [
    { id: 'doctor', archetype: '의사', scene: 'clinic', how: 'fixed', spot: Math.round(c.length * 0.7), shifts: [[9, 18]], count: 1, gate },
    { id: 'nurse', archetype: '간호사', scene: 'clinic', how: 'patrol', span: [Math.round(c.length * 0.15), Math.round(c.length * 0.6)], shifts: [[9, 18]], count: 1, gate },
  ];
}

export function createHqWorld(
  map: { scenes: PlaceScene[]; elevator: ElevatorStop[] },
  seed: number,
  present: { name: string; scene: string }[],
  has: (look: string, clip: string) => boolean = () => false,
  extra: Pick<SimOptions, 'stance'> = {},
): WorldSim {
  const graph = new PlaceGraph(map.scenes, map.elevator, HQ_KINDS);
  const sim = new WorldSim(graph, mulberry32(seed), { spawns: hqSpawns(graph), posts: hqPosts(graph), has, sceneFaction: hqSceneFaction, ...extra });
  for (const p of present) {
    if (!graph.scene(p.scene)) continue;
    // 부상(의무실)이면 침대 곁에만: 오가는 범위가 의무실 하나
    sim.add({ id: `npc:${p.name}`, name: p.name, kind: 'named', brain: 'needs', home: p.scene, roam: HQ_ROAM[p.scene] ?? [p.scene], look: p.name });
  }
  return sim;
}
