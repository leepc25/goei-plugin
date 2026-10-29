// 조각 세트 (스테이지 설계서 5장). 조각 = 반 화면 폭(640px) 가로 한 칸.
// 조각은 지형 모양과 "얹을 자리"만 가진다. 왼쪽·오른쪽 끝은 어느 조각과도 이어진다(바닥선·깊이 통일, 끝 40px은 늘 평지).
// 공용 10개 + 유형별 세트. 같은 조각이라도 좌우 뒤집기·팔레트·얹는 것이 다르면 다른 층이다.
import { CHUNK_W, LANE_DEPTH, type ChunkTemplate, type Slot, type Terrain } from '../types';

const M = LANE_DEPTH / 2;
const s = (kind: Slot['kind'], x: number, lane = M): Slot => ({ kind, x, lane });
const pit = (x0: number, x1: number): Terrain => ({ kind: 'pit', x0, x1 });
const block = (x0: number, x1: number, h = 44): Terrain => ({ kind: 'block', x0, x1, h });
const low = (x0: number, x1: number): Terrain => ({ kind: 'low', x0, x1 });
const narrow = (x0: number, x1: number, lane0: number, lane1: number): Terrain => ({ kind: 'narrow', x0, x1, lane0, lane1 });
const glass = (x0: number, x1: number): Terrain => ({ kind: 'glass', x0, x1 });

const T = (id: string, set: ChunkTemplate['set'], label: string, terrain: Terrain[], slots: Slot[], extra: Partial<ChunkTemplate> = {}): ChunkTemplate => ({ id, set, label, terrain, slots, ...extra });

export const COMMON_CHUNKS: ChunkTemplate[] = [
  T('c_flat', 'common', '복도', [], [s('enemy', 320), s('prop', 160, 10), s('item', 480, 120), s('sign', 120, 0)]),
  T('c_step', 'common', '단차', [block(220, 420)], [s('enemy', 520), s('prop', 100, 10)]),
  T('c_pit', 'common', '꺼진 바닥', [pit(260, 380)], [s('enemy', 520), s('item', 120, 140)]),
  T('c_twodoor', 'common', '두 문', [], [s('door', 200, 0), s('door', 440, 0), s('sign', 320, 0)]),
  T('c_service', 'common', '점검문', [], [s('servicedoor', 460, 0), s('enemy', 240), s('prop', 120, 10)]),
  T('c_hatch', 'common', '천장 해치', [], [s('hatch', 320, 40), s('enemy', 520)]),
  T('c_deadend', 'common', '막다른 벽', [], [s('prop', 520, 0), s('servicedoor', 360, 0)], { endOnly: true }),
  T('c_bend', 'common', '꺾임', [narrow(0, 280, 0, 100), narrow(280, 640, 60, LANE_DEPTH)], [s('enemy', 460, 120), s('sign', 80, 0)]),
  T('c_wide', 'common', '넓은 홀', [], [s('enemy', 200, 30), s('enemy', 420, 130), s('item', 320, 80), s('prop', 560, 10)]),
  T('c_narrow', 'common', '좁은 통로', [narrow(80, 560, 60, 110)], [s('enemy', 400, 85)]),
];

export const TYPE_CHUNKS: ChunkTemplate[] = [
  // 로비: 사무실 건물 로비·복도·휴게실. 어긋난 구석이 규칙 단서.
  T('l_desk', 'lobby', '안내 데스크', [block(260, 400, 36)], [s('prop', 330, 0), s('npc', 520), s('sign', 120, 0)]),
  T('l_lounge', 'lobby', '휴게실', [], [s('prop', 140, 20), s('prop', 300, 20), s('enemy', 480), s('item', 560, 140)]),
  T('l_clock', 'lobby', '거꾸로 가는 시계', [], [s('sign', 320, 0), s('enemy', 520), s('prop', 120, 0)]),
  T('l_office', 'lobby', '사무실 복도', [], [s('prop', 120, 0), s('prop', 360, 0), s('enemy', 500), s('hatch', 240, 40)]),
  T('l_pillars', 'lobby', '기둥 홀', [narrow(160, 240, 0, 70), narrow(400, 480, 90, LANE_DEPTH)], [s('enemy', 320), s('item', 560, 40)]),
  T('l_rest', 'lobby', '화장실 앞', [low(300, 420)], [s('prop', 140, 0), s('enemy', 520)]),
  // 침묵: 유리 바닥 = 소리 함정
  T('s_library', 'silent', '열람실', [], [s('prop', 120, 0), s('prop', 280, 0), s('prop', 440, 0), s('enemy', 360)]),
  T('s_glass', 'silent', '깨진 유리 복도', [glass(180, 460)], [s('enemy', 540), s('item', 100, 130)]),
  T('s_carpet', 'silent', '카펫 홀', [], [s('enemy', 200), s('enemy', 480), s('sign', 340, 0)]),
  T('s_bowls', 'silent', '그릇 선반', [block(420, 520, 30)], [s('prop', 200, 0), s('item', 300, 140), s('enemy', 560)]),
  T('s_glass2', 'silent', '유리 계단', [glass(60, 200), block(260, 380, 40), glass(420, 560)], [s('enemy', 320)]),
  T('s_hush', 'silent', '쉿 복도', [narrow(100, 540, 40, 120)], [s('sign', 80, 0), s('enemy', 420, 80)]),
  // 어둠
  T('d_pitch', 'dark', '칠흑 복도', [pit(300, 400)], [s('enemy', 180), s('enemy', 520)]),
  T('d_pillars', 'dark', '기둥 숲', [narrow(120, 200, 0, 60), narrow(320, 400, 100, LANE_DEPTH), narrow(500, 560, 0, 70)], [s('enemy', 260), s('item', 440, 140)]),
  T('d_stairs', 'dark', '계단참', [block(200, 300, 30), block(300, 420, 60)], [s('enemy', 540)]),
  T('d_duct', 'dark', '낮은 배관', [low(160, 480)], [s('item', 560, 80)]),
  T('d_well', 'dark', '물 고인 바닥', [pit(140, 240), pit(400, 500)], [s('enemy', 320)]),
  T('d_hall', 'dark', '빈 홀', [], [s('enemy', 160), s('enemy', 320), s('enemy', 480), s('sign', 80, 0)]),
  // 추격: 멈추면 죽음. 장애물 점프·앉기·문 닫기.
  T('h_collapse', 'chase', '무너지는 복도', [pit(160, 260), pit(420, 520)], [s('enemy', 340)]),
  T('h_doors', 'chase', '문 복도', [], [s('door', 300, 0), s('item', 140, 120)]),
  T('h_crates', 'chase', '상자 더미', [block(140, 220, 40), block(380, 460, 50)], [s('enemy', 560)]),
  T('h_pipes', 'chase', '낮은 파이프', [low(200, 300), low(420, 500)], [s('enemy', 600)]),
  T('h_mixed', 'chase', '엉킨 복도', [block(120, 200), low(300, 380), pit(470, 560)], []),
  T('h_door2', 'chase', '방화문', [narrow(200, 640, 40, 120)], [s('door', 520, 0), s('enemy', 300, 80)]),
  // 퍼즐과 선택
  T('p_fork', 'puzzle', '두 갈래 문', [], [s('door', 180, 0), s('door', 460, 0), s('sign', 60, 0)], { device: 'fork' }),
  T('p_switch', 'puzzle', '스위치 방', [], [s('switch', 160, 20), s('switch', 320, 20), s('switch', 480, 20), s('sign', 60, 0)], { device: 'switches' }),
  T('p_loop', 'puzzle', '끝나지 않는 복도', [], [s('prop', 160, 0), s('prop', 480, 0), s('enemy', 320)]),
  T('p_tilt', 'puzzle', '기울어진 방', [block(100, 260, 24), block(260, 420, 48), block(420, 540, 24)], [s('enemy', 600)]),
  T('p_maze', 'puzzle', '칸막이', [narrow(100, 220, 0, 60), narrow(260, 380, 100, LANE_DEPTH), narrow(420, 540, 0, 60)], [s('item', 320, 140), s('enemy', 560)]),
  T('p_stair', 'puzzle', '거꾸로 계단', [block(200, 440, 40), pit(300, 340)], [s('sign', 100, 0)]),
  // 재현 · 아파트 (명일 아파트 틀을 조각으로: 복도·거실·안방·부엌·베란다·계단실·창고)
  T('r_corridor', 'replica', '아파트 복도', [], [s('npc', 260), s('prop', 120, 0), s('prop', 440, 0), s('item', 540, 140)]),
  T('r_living', 'replica', '거실', [], [s('prop', 140, 10), s('npc', 380), s('item', 520, 120)], { device: 'meal' }),
  T('r_room', 'replica', '안방', [block(380, 520, 30)], [s('prop', 200, 0), s('item', 300, 140), s('npc', 560)]),
  T('r_kitchen', 'replica', '부엌', [], [s('prop', 120, 0), s('prop', 260, 0), s('npc', 460)], { device: 'meal' }),
  T('r_veranda', 'replica', '베란다', [narrow(80, 560, 0, 70), pit(260, 340)], [s('item', 480, 40)]),
  T('r_stairs', 'replica', '계단실', [block(220, 420, 40)], [s('sign', 100, 0), s('npc', 520)]),
  T('r_storage', 'replica', '창고', [low(360, 480)], [s('item', 160, 60), s('item', 280, 120), s('prop', 560, 0)]),
  // 시험
  T('t_arena', 'trial', '시험장', [], [s('enemy', 200, 40), s('enemy', 360, 120), s('enemy', 500, 60), s('item', 320, 80)]),
  T('t_marks', 'trial', '표식 복도', [block(380, 460, 36)], [s('item', 140, 30), s('item', 420, 120), s('enemy', 560)]),
  T('t_bells', 'trial', '종 매단 홀', [], [s('switch', 200, 20), s('switch', 440, 140), s('enemy', 320)]),
  T('t_gauntlet', 'trial', '관문', [pit(140, 240), block(340, 420, 44), low(500, 580)], [s('item', 300, 140)]),
  T('t_lockers', 'trial', '사물함', [narrow(120, 520, 50, LANE_DEPTH)], [s('item', 220, 140), s('item', 460, 70), s('enemy', 360)]),
  T('t_ring', 'trial', '둥근 홀', [], [s('enemy', 160), s('enemy', 480), s('sign', 320, 0)]),
];

export const ALL_CHUNKS = [...COMMON_CHUNKS, ...TYPE_CHUNKS];
export const CHUNK_BY_ID: Record<string, ChunkTemplate> = Object.fromEntries(ALL_CHUNKS.map((c) => [c.id, c]));

/** 조각 좌우 뒤집기 */
export function flipTerrain(t: Terrain): Terrain {
  const f = (x: number) => CHUNK_W - x;
  return { ...t, x0: f(t.x1), x1: f(t.x0) } as Terrain;
}

/** 정비 구역 조각 (덕트·지지대·기울어진 바닥·승강로 틈새). 칸 하나 = 이 조각 2개. */
export const SERVICE_CHUNKS: ChunkTemplate[] = [
  T('v_duct', 'service', '덕트', [low(60, 580)], [s('item', 320, 120)]),
  T('v_duct2', 'service', '좁은 덕트', [low(0, 300), narrow(300, 640, 40, 120)], []),
  T('v_support', 'service', '지지대', [block(140, 260, 40), block(380, 500, 60)], [s('item', 440, 40)]),
  T('v_slope', 'service', '기울어진 바닥', [block(100, 220, 20), block(220, 340, 40), block(340, 460, 60)], [s('prop', 560, 0)]),
  T('v_gapline', 'service', '틈새 난간', [pit(240, 340)], [s('item', 520, 140)]),
  T('v_plain', 'service', '배관 통로', [], [s('prop', 200, 0), s('item', 420, 80)]),
];
CHUNK_BY_ID_ADD(SERVICE_CHUNKS);
function CHUNK_BY_ID_ADD(list: ChunkTemplate[]) {
  for (const c of list) CHUNK_BY_ID[c.id] = c;
}
