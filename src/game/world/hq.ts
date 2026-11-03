// 첫 시연 범위(관리국 본부 + 정면 거리 + 종로 큰길)의 세계 자료. 엔진(places·actors)은 이 자료만 읽는다.
// 장소가 늘면 꼬리표·오가는 범위·보충 규칙을 여기(나중엔 게임 팩 JSON)에 더한다.
import { WorldSim, type SimOptions, type SpawnRule } from './actors';
import type { Post } from './mobs';
import { PlaceGraph, type ElevatorStop, type PlaceKind, type PlaceScene } from './places';
import { mulberry32 } from './rng';
import { streetSpawns } from './districts';

/** 장소 종류는 방 이름 낱말로 정한다(world/places.ts kindFromName, 10-31): 층 배치·방이 바뀌어도 여기 고칠 것 없음 */

/** 건물(거점) 표 (11-02 사용자 15:43 「백일몽·중림·협회·관리국 전부 옳은 사람이 배치」): 장면 id 머리글자 → 건물.
 *  faction = 거점 세력(경비·직원의 소속, 경고·경보 기준), null = 중립(협회 사이트·중림 상가). streets = 그 건물 밖 거리·통로(유동인구, 소속 없음).
 *  장면이 늘어도 머리글자만 맞으면 여기 고칠 것 없음. 접두어 없는 장면은 관리국 본부 */
export interface Building { id: string; name: string; prefix: string; faction: string | null; district: string; lobby?: string; streets: string[] }
export const BUILDINGS: Building[] = [
  { id: 'fb', name: '가짜 관리국', prefix: 'fb_', faction: 'B00', district: 'jongno', lobby: 'fb_lobby', streets: ['fb_street'] },
  { id: 'by', name: '백일몽', prefix: 'by_', faction: 'C00', district: 'gangnam', lobby: 'by_lobby', streets: ['by_street'] },
  { id: 'sdra', name: '특수재난대응협회', prefix: 'sdra_', faction: null, district: 'yeongdeungpo', lobby: 'sdra_lobby', streets: ['sdra_street'] },
  // 중림 지하상가: 가게(jr_daebak 등)는 주인만의 장소, 지상 입구·지하 통로·골목은 거리처럼 사람이 오간다
  { id: 'jr', name: '중림 지하상가', prefix: 'jr_', faction: null, district: 'jungnim', streets: ['jr_entry', 'jr_b1', 'jr_b2', 'jr_alley'] },
  { id: 'hq', name: '관리국 본부', prefix: '', faction: 'A00', district: 'jongno', lobby: 'lobby', streets: ['street', 'pasta'] },
];
export const hqBuilding = (scene: string): Building => BUILDINGS.find((b) => scene.startsWith(b.prefix))!;
/** 건물 안 장면인가 (거리·통로·가게 밖 제외) */
export const hqInside = (scene: string): boolean => !hqBuilding(scene).streets.includes(scene);
/** 바깥 거리·통로 장면 전부 (모두 같은 거리 유동인구, 10-31) */
export const HQ_STREETS = BUILDINGS.flatMap((b) => b.streets).filter((s) => s !== 'pasta');
/** 지역: 바뀌면 시계 「지역 이동」. 승강장은 지역 없음(타고 내릴 때 정해진다) */
export const hqDistrict = (scene: string): string | null => hqBuilding(scene).district;

/** 장면 소속: 건물 안 = 그 건물 세력(관리국 A00·가짜 관리국 B00·백일몽 C00). 협회·중림·거리·가게는 없음 */
export const hqSceneFaction = (scene: string): string | null => (hqInside(scene) ? hqBuilding(scene).faction : null);

/** 상주 인물 (11-02 사용자 「건물마다 옳은 사람」): 카드 요원이 아닌 이름 인물이 사는 곳. 책상 주인은 장면 자리(owner/who)로 앉는다.
 *  중림 가게 주인(위키·roster 역할), 협회 창구 직원, 가짜 관리국 검사부대·진압부대(책상 BY_DESK_OWNERS), 백일몽 일반팀·정예팀 */
export const RESIDENTS: { name: string; scene: string; roam?: string[] }[] = [
  { name: '문혜란', scene: 'jr_daebak' }, { name: '마덕희', scene: 'jr_heolgap' }, { name: '신유리', scene: 'jr_youngchang' },
  { name: '고연지', scene: 'jr_jinryo', roam: ['jr_jinryo', 'jr_op'] }, { name: '윤지아', scene: 'jr_songil', roam: ['jr_songil', 'jr_jinryo'] },
  { name: '서윤지', scene: 'sdra_counter' }, { name: '차여진', scene: 'sdra_counter' },
  ...['이도형', '고영훈', '노기균', '송주익'].map((name) => ({ name, scene: 'fb_office' })),
  ...['곽성주', '조성춘', '윤병수', '김성진', '송진섭'].map((name) => ({ name, scene: 'fb_swat' })),
  ...['이자헌', '은하제', '박민성', '백사헌', '고영은', '강이학', '장허운'].map((name) => ({ name, scene: 'by_office' })),
  ...['백석주', '진나솔', '이성해'].map((name) => ({ name, scene: 'by_elite' })),
];
/** 장면 종류 덮어쓰기: 가게 주인·창구 직원이 자기 자리에서 「일」을 하도록 사무실로 본다 (이름으로는 shop·room) */
export const HQ_KINDS: Record<string, PlaceKind> = { sdra_counter: 'office', jr_daebak: 'office', jr_heolgap: 'office', jr_youngchang: 'office' };
/** 손님 (11-02 사용자: 가게 4곳·협회 창구를 NPC가 실제로 이용): 들어와 빈 자리에 앉아 머물다 나간다 */
const VISITS: { scene: string; n: number; mix: string[]; stay: [number, number] }[] = [
  { scene: 'sdra_counter', n: 3, mix: ['프리랜서', '프리랜서', '행인'], stay: [40, 90] },
  { scene: 'jr_songil', n: 2, mix: ['행인', '프리랜서'], stay: [60, 120] },
  { scene: 'jr_daebak', n: 1, mix: ['프리랜서'], stay: [30, 70] },
  { scene: 'jr_heolgap', n: 1, mix: ['프리랜서', '행인'], stay: [30, 70] },
  { scene: 'jr_youngchang', n: 1, mix: ['프리랜서'], stay: [30, 70] },
];

/** 이름 인물이 오가는 장면 (10-31 사용자: 정해진 곳이 아니라 건물 전체). 자기 건물 안 장면 전부. 다친 사람(의무실에서 시작)·중림 가게 주인은 그 방에 묶인다 */
export function hqRoam(graph: PlaceGraph, home: string, name?: string): string[] {
  const r = name ? RESIDENTS.find((q) => q.name === name)?.roam : undefined;
  if (r) return r.filter((id) => graph.scene(id));
  if (/(^|_)(clinic|infirmary)$/.test(home) || home.startsWith('jr_')) return [home];
  const b = hqBuilding(home);
  return graph.ids().filter((id) => hqBuilding(id) === b && hqInside(id));
}

/** 몹 보충 (6-2장). 수치는 시연판에서 조정 */
export function hqSpawns(graph: PlaceGraph): SpawnRule[] {
  // 바깥 거리·통로는 모두 같은 인구 (승강장은 타는 곳마다 드나든다). 중림 행인 비율(프리랜서 위주)은 원형이 생기면 districts 에서
  // 중림 지하 통로·뒷골목(6,000~9,000px)은 큰길 밀도면 100명이 넘어 한산하게(0.35 = 1,000px당 3~4명, Claude 추정치)
  const out: SpawnRule[] = streetSpawns(HQ_STREETS.filter((s) => graph.scene(s)), { street: [30, 1890] }, { jr_entry: 0.6, jr_b1: 0.35, jr_b2: 0.35, jr_alley: 0.35 })
    .map((r) => (STREET_SWAP[r.scene] ? { ...r, swap: STREET_SWAP[r.scene] } : r));
  // 건물 로비마다 드나드는 사람: 행인 + 그 건물 직원(직원 원형이 있는 건물만)
  for (const b of BUILDINGS) {
    const lobby = b.lobby ? graph.scene(b.lobby) : null;
    const main = lobby?.doors.find((d) => d.id === 'main')?.x;
    if (!lobby || main === undefined) continue;
    const staff = ROLES[b.id]?.staff;
    // 협회 로비는 프리랜서(창구 손님)가 드나든다
    out.push({ scene: lobby.id, target: { day: 2, night: 0 }, refill: [6, 12], gates: [main], mix: b.id === 'sdra' ? ['행인', '프리랜서', '프리랜서'] : staff ? ['행인', staff] : ['행인'] });
  }
  for (const v of VISITS) {
    const sc = graph.scene(v.scene);
    if (!sc) continue;
    out.push({ scene: v.scene, target: { day: v.n, night: 0 }, refill: [20, 45], gates: [sc.doors[0]?.x ?? 100], mix: v.mix, visit: v.stay });
  }
  return out;
}

/** 건물별 사람 (11-02 사용자 「건물마다 옳은 사람」): 안내 데스크·경비·사무 직원·훈련하는 전투원 원형. 협회는 데스크 없음, 훈련장은 프리랜서가 쓴다 */
const ROLES: Record<string, { desk?: string; guard: string; staff: string; fighter: string }> = {
  hq: { desk: '안내 직원', guard: '경비', staff: '행정 직원', fighter: '관리국 요원' },
  fb: { desk: '가짜 관리국 검사', guard: '가짜 관리국 진압', staff: '가짜 관리국 검사', fighter: '가짜 관리국 진압' },
  by: { desk: '백일몽 직원', guard: '백일몽 경비', staff: '백일몽 직원', fighter: '백일몽 경비' },
  sdra: { guard: '협회 경비', staff: '협회 직원', fighter: '프리랜서' },
};
/** 거리마다 섞이는 사람 (11-02 사용자: 중림 행인은 프리랜서 위주 + 세력 요원 드문드문, 세력 거리 앞은 살아 있게). 비율은 Claude 제안(프리랜서 6 : 시민 3 : 세력 1) — 사용자 확정 대기 */
const 세력 = ['관리국 요원', '백일몽 직원', '가짜 관리국 검사', '협회 직원'];
const rep = (n: number, s: string) => Array<string>(n).fill(s);
const STREET_SWAP: Record<string, Record<string, string[]>> = {
  street: { 행인: [...rep(8, '행인'), '행정 직원'] },
  fb_street: { 행인: [...rep(8, '행인'), '가짜 관리국 검사'] },
  sdra_street: { 행인: [...rep(6, '행인'), ...rep(3, '프리랜서'), '협회 직원'] },
  // 중림: 프리랜서 24 : 시민 12 : 세력 4(네 세력 하나씩) = 6 : 3 : 1
  ...Object.fromEntries(['jr_entry', 'jr_b1', 'jr_b2', 'jr_alley'].map((id) => [id, { 행인: [...rep(24, '프리랜서'), ...rep(12, '행인'), ...세력] }])),
};

/** 근무형 몹 (6-3장 근무표 초안, 수치는 시연판에서 조정): 건물마다 로비 근무자 + 의무실 + 방 종류별 자동 인원 */
export function hqPosts(graph: PlaceGraph): Post[] {
  return [
    ...BUILDINGS.flatMap((b) => lobbyPosts(graph, b)),
    // 의무실·연구실(B2): 의사·간호사 주간 근무 (문은 방 아래 출입이라 gate = 출입 x)
    ...BUILDINGS.flatMap((b) => clinicPosts(graph, `${b.prefix}clinic`, b.id)),
    // 방 종류로 인원 자동 (10-31 자율 행동 2단계): 방이 늘거나 옮겨도 여기 고칠 것 없음
    ...autoPosts(graph),
  ];
}

/** 로비 근무자: 안내 직원(주간)·야간 경비(데스크가 있는 로비만), 순찰 경비(종일), 청소부(건물 복도 순회). 협회 로비는 안내데스크 없음(11-02 사용자) → 경비·청소부만 */
function lobbyPosts(graph: PlaceGraph, b: Building): Post[] {
  const lobby = b.lobby ? graph.scene(b.lobby) : null;
  if (!lobby) return [];
  const gate = lobby.doors.find((d) => d.id === 'main')?.x ?? 300;
  // 데스크 자리: 그림에 근무 자리(posts.desk)가 적혀 있으면 그 자리, 아니면 지도 boxes 'desk' 가운데 뒤. 둘 다 없으면 데스크 근무 없음
  const box = (lobby as { boxes?: { kind: string; x: number; y: number; d: number }[] }).boxes?.find((q) => q.kind === 'desk');
  const post = (lobby as { posts?: Record<string, [number, number]> }).posts?.desk;
  const desk = post ? Math.round(post[0]) : box ? Math.round(box.x) : null;
  const deskY = post ? post[1] : box ? Math.round(box.y - box.d - 8) : undefined;
  const halls = graph.ids().filter((id) => new RegExp(`^${b.prefix}(f\\d+|b\\d)$`).test(id));
  const scene = lobby.id;
  const role = ROLES[b.id] ?? ROLES.hq;
  return [
    ...(desk !== null && role.desk ? [
      { id: `${b.id}-desk`, archetype: role.desk, scene, how: 'fixed', spot: desk, y: deskY, shifts: [[9, 18]], count: 1, gate },
      { id: `${b.id}-night`, archetype: role.guard, scene, how: 'fixed', spot: desk, y: deskY, shifts: [[18, 9]], count: 1, gate },
    ] as Post[] : []),
    { id: `${b.id}-guard`, archetype: role.guard, scene, how: 'patrol', span: [gate + 120, Math.min(lobby.length - 120, gate + 900)], shifts: [[0, 24]], count: 1, gate },
    { id: `${b.id}-cleaner`, archetype: '청소부', scene, how: 'roam', route: [scene, ...halls, scene], stay: 40, shifts: [[6, 9], [20, 23]], count: 1, gate },
  ];
}

/** 장소 종류 → 그 방에 상주하는 역할(ROLES 열쇠)·인원·근무시간. 사무실 1곳당 사무 3, 훈련장 1곳당 전투원 4 (협회 훈련장은 프리랜서 3).
 *  이름 인물이 책상 주인인 사무실(종합대응팀·가짜 관리국 검사부대·진압부대·백일몽 사무실)은 자동 인원 없음 — 그 사람들은 이름 인물로 앉힌다 */
const ROLE_BY_KIND: Partial<Record<string, { who: 'staff' | 'fighter'; how: Post['how']; per: number; shifts: [number, number][] }>> = {
  office: { who: 'staff', how: 'desk', per: 3, shifts: [[9, 18]] },
  training: { who: 'fighter', how: 'train', per: 4, shifts: [[9, 18]] },
};
export function autoPosts(graph: PlaceGraph): Post[] {
  const out: Post[] = [];
  for (const id of graph.ids()) {
    if (!hqInside(id)) continue;
    const b = hqBuilding(id);
    const r = ROLE_BY_KIND[graph.kind(id)];
    const roles = ROLES[b.id];
    if (!r || !roles) continue;
    const name = graph.scene(id)?.name ?? '';
    // 이름 인물의 방: 종합대응팀(관리국 요원들), 검사부대·진압부대(가짜 관리국 인물표), 백일몽 사무실·정예 → 이름 없는 직원 안 둠
    if (/종합대응|검사부대|진압부대/.test(name) || (b.id === 'by' && r.who === 'staff')) continue;
    // 관리국 진압팀 = 진압팀원(관리국 요원)이 책상 일 (10-31 사용자)
    const archetype = /진압/.test(name) ? roles.fighter : roles[r.who];
    const gate = graph.scene(id)?.doors[0]?.x ?? 100;
    // 협회 창구: 이름 직원 둘(서윤지·차여진) + 이름 없는 협회 직원 1 (clerk3). 협회 훈련장: 프리랜서 3
    const count = id === 'sdra_counter' ? 1 : b.id === 'sdra' && r.who === 'fighter' ? 3 : r.per;
    out.push({ id: `auto-${id}`, archetype, scene: id, how: r.how, shifts: r.shifts, count, gate });
  }
  return out;
}

function clinicPosts(graph: PlaceGraph, scene: string, bid: string): Post[] {
  const c = graph.scene(scene);
  if (!c) return [];
  const gate = c.doors.find((d) => d.id === 'out')?.x ?? 100;
  return [
    { id: `${bid}-doctor`, archetype: '의사', scene, how: 'fixed', spot: Math.round(c.length * 0.7), shifts: [[9, 18]], count: 1, gate },
    { id: `${bid}-nurse`, archetype: '간호사', scene, how: 'patrol', span: [Math.round(c.length * 0.15), Math.round(c.length * 0.6)], shifts: [[9, 18]], count: 1, gate },
  ];
}

export function createHqWorld(
  map: { scenes: PlaceScene[]; elevator: ElevatorStop[] },
  seed: number,
  present: { name: string; scene: string }[],
  has: (look: string, clip: string) => boolean = () => false,
  extra: Pick<SimOptions, 'stance' | 'playerFaction' | 'killOk' | 'relation' | 'namedHostile' | 'nav' | 'lineN'> = {},
): WorldSim {
  const graph = new PlaceGraph(map.scenes, map.elevator, HQ_KINDS);
  const sim = new WorldSim(graph, mulberry32(seed), { spawns: hqSpawns(graph), posts: hqPosts(graph), has, sceneFaction: hqSceneFaction, ...extra });
  const names = new Set<string>();
  for (const p of [...present, ...RESIDENTS.filter((r) => !present.some((q) => q.name === r.name))]) {
    if (!graph.scene(p.scene) || names.has(p.name)) continue;
    names.add(p.name);
    // 부상(의무실)이면 침대 곁에만: 오가는 범위가 의무실 하나. 상주 인물은 자기 건물(가게 주인은 가게)
    // 본편 카드가 그 방에 있다고 한 요원(present)은 퇴근하지 않는다 (11-02 사용자: 밤에 들어가니 요원이 하나도 없음 → 카드 상태 우선). 상주 인물(RESIDENTS)은 근무표대로
    const card = present.some((q) => q.name === p.name);
    sim.add({ id: `npc:${p.name}`, name: p.name, kind: 'named', brain: 'needs', home: p.scene, roam: hqRoam(graph, p.scene, p.name), look: p.name, ...(card ? { card: true } : {}) });
  }
  return sim;
}
