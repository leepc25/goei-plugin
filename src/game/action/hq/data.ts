// 본부 데이터표: 장소·요원·임무·숙련·커피·유물·연구. 기본기획서 4·5·13·15·16장과 부록 E를 숫자로 옮긴 것.
// 아이템 표(보급품)는 아이템 스레드(src/game/action/items/)가 정한다. 그 표가 들어오기 전까지 SUPPLY_FALLBACK을 쓴다.
import type { AgentId, AgentStats, MissionGoal } from './contract';

export type PlaceId = 'street' | 'office' | 'jaemtri' | 'chief' | 'supply' | 'pantry' | 'clinic' | 'interview' | 'training' | 'appraisal' | 'lab' | 'tooth' | 'gallery' | 'pasta';

export interface PlaceDef {
  id: PlaceId;
  name: string;
  floor: '지상' | '지하' | '바깥';
  /** 본부 가로 화면 위 위치(왼쪽 끝)와 폭 */
  x: number;
  w: number;
  npc: string | null;
  /** 열리는 조건 설명 (잠겨 있을 때 보임) */
  opens: string;
  color: string;
}
// 기획서 4.1 표 순서. 의무실은 후송 연출(6.4)과 영구 부상 치료(부록 E.5) 자리라 지상에 하나 더 둔다.
export const PLACES: PlaceDef[] = [
  { id: 'street', name: '건물 앞 텅 빈 종로', floor: '바깥', x: 0, w: 360, npc: null, opens: '처음', color: '#2a3138' },
  { id: 'office', name: '종합대응팀 사무실', floor: '지상', x: 380, w: 420, npc: '쉬는 요원들', opens: '처음', color: '#33404a' },
  { id: 'jaemtri', name: '잼트리 자리', floor: '지상', x: 820, w: 260, npc: '잼트리', opens: '처음', color: '#3b4a3a' },
  { id: 'chief', name: '부장실', floor: '지상', x: 1100, w: 260, npc: '부장', opens: '처음', color: '#4a3a33' },
  { id: 'supply', name: '정비·보급실', floor: '지상', x: 1380, w: 300, npc: '콘쥬스', opens: '처음', color: '#3a3f4a' },
  { id: 'pantry', name: '탕비실', floor: '지상', x: 1700, w: 240, npc: '동료', opens: '처음', color: '#4a4433' },
  { id: 'clinic', name: '의무실', floor: '지상', x: 1960, w: 220, npc: null, opens: '처음', color: '#38484a' },
  { id: 'interview', name: '면담실', floor: '지상', x: 2200, w: 240, npc: '구조된 생존자', opens: '첫 구조 후', color: '#3e3a4a' },
  { id: 'training', name: '훈련장·사격장', floor: '지하', x: 2500, w: 340, npc: null, opens: '첫 출동 후', color: '#2c3530' },
  { id: 'appraisal', name: '감정실', floor: '지하', x: 2860, w: 260, npc: '데쥬레', opens: '첫 회수 후', color: '#30343f' },
  { id: 'lab', name: '격리 연구실', floor: '지하', x: 3140, w: 300, npc: '고그니쟈', opens: '첫 감정 후', color: '#2f3b42' },
  { id: 'tooth', name: '이빨 요정 격리실', floor: '지하', x: 3460, w: 260, npc: '격리팀', opens: '첫 진압 후', color: '#402f36' },
  { id: 'gallery', name: '격리 구역 복도', floor: '지하', x: 3740, w: 300, npc: null, opens: '첫 진압 후', color: '#2a2f33' },
  { id: 'pasta', name: '파스타집', floor: '바깥', x: 4080, w: 300, npc: '전원', opens: '첫 진압 후', color: '#4a3a2a' },
];
export const HQ_WIDTH = 4400;
export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p])) as Record<PlaceId, PlaceDef>;

export interface AgentInfo {
  id: AgentId;
  name: string;
  color: string;
  base: AgentStats;
  weapon: string;
  /** 숙련 3·6에서 열리는 새 동작 이름 (이름만. 동작은 전투 스레드) */
  moveA: string;
  moveB: string;
}
// 체력·속도는 회색 상자 시험판(graybox/data.ts AGENTS)과 같은 값.
export const AGENTS: AgentInfo[] = [
  { id: 'jyaldi', name: '쟈알디', color: '#d94b3c', base: { hp: 220, power: 1.2, aim: 1, defense: 0.1, speed: 1, poise: 1, charge: 1 }, weapon: '폭파 + 권총', moveA: '폭파 변형 A: 지면 폭파', moveB: '폭파 변형 B: 연쇄 폭파' },
  { id: 'eileen', name: '에일린', color: '#3c8ad9', base: { hp: 170, power: 1, aim: 1.3, defense: 0.05, speed: 1.1, poise: 0, charge: 1.1 }, weapon: '소총', moveA: '읽기 변형 A: 약점 표시', moveB: '읽기 변형 B: 관통 저격' },
];
export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<AgentId, AgentInfo>;

// ── 임무 (기획서 9.5). id는 회색 상자 시험판 MISSIONS와 같다. ──
export interface MissionDef extends MissionGoal {
  depthLabel: string;
  reward: { budget: number; teeth: number; research: number };
  requires?: string;
  /** 다시 받을 수 있는 정규 임무 */
  repeat?: boolean;
  /** 구조 요청: 출동 몇 번 안에 */
  deadline?: number;
}
export const MISSIONS: MissionDef[] = [
  { id: 'm1', kind: '조사', title: '로비에서 규칙 2개 확인 후 로프로 귀환', depth: 2, depthLabel: 'L1~L2', rules: 2, reward: { budget: 100, teeth: 2, research: 0 }, repeat: true },
  { id: 'm2', kind: '진압', title: '로비 L3 경비원', depth: 3, depthLabel: 'L3', reward: { budget: 200, teeth: 3, research: 0 }, requires: 'm1' },
  { id: 'm3', kind: '조사', title: '추격의 층 통과', depth: 5, depthLabel: 'B-1', reward: { budget: 200, teeth: 2, research: 1 }, requires: 'm2' },
  { id: 'm4', kind: '구조', title: '야근하다 들어온 회사원을 다락방까지', depth: 5, depthLabel: 'B-1~B-2', rescue: 'worker', reward: { budget: 300, teeth: 5, research: 0 }, requires: 'm3', deadline: 2 },
  { id: 'm5', kind: '조사', title: '재현의 층 「아파트」 규칙 3개', depth: 5, depthLabel: 'B-2', rules: 3, reward: { budget: 150, teeth: 2, research: 2 }, requires: 'm3' },
  { id: 'm6', kind: '진압', title: '405호 노부부 (재현)', depth: 5, depthLabel: 'B-2', reward: { budget: 400, teeth: 4, research: 1 }, requires: 'm5' },
  { id: 'm7', kind: '회수', title: '서명란이 빈 점검표', depth: 3, depthLabel: '정비 구역', recover: 'checklist', reward: { budget: 100, teeth: 1, research: 3 }, requires: 'm2' },
  { id: 'm8', kind: '조사', title: '시험 층 목표 달성', depth: 6, depthLabel: 'B-3', reward: { budget: 500, teeth: 3, research: 1 }, requires: 'm6' },
  { id: 'm9', kind: '기록', title: 'B-5 도달', depth: 8, depthLabel: 'B-5', reward: { budget: 600, teeth: 5, research: 2 }, requires: 'm8' },
];
export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/** 출동 보조 규칙 (기획서 9.4). 출동마다 하나. */
export const VARIANTS = [
  { id: 'greet3', text: '오늘 승강기는 인사한 사람만 버튼을 3개 보여 준다.', hint: '오늘은 승강기가 인사한 사람한테만 버튼을 다 보여 준대요.' },
  { id: 'polite', text: '오늘 재현의 층 주민은 존댓말에만 반응한다.', hint: '아파트 주민들이 오늘은 존댓말에만 대답한대요.' },
  { id: 'attic_half', text: '오늘 다락방 체류 제한이 절반이다.', hint: '다락방에 오래 있지 마세요. 오늘은 그게 빨리 온대요.' },
  { id: 'liars', text: '오늘 승객은 전부 거짓말을 한다.', hint: '승객 말은 오늘 거꾸로 들으세요.' },
  { id: 'b12', text: '오늘 패널에 깊은 층 버튼이 처음부터 떠 있다.', hint: '패널에 처음 보는 숫자가 떠 있대요. 누르지 마세요. …아마도.' },
] as const;

// ── 숙련 (기획서 16.3). 새 동작은 3·6 두 번뿐. ──
export const MASTERY_XP = [0, 80, 200, 360, 560, 800, 1080, 1400, 1760, 2160];
export const MASTERY_UNLOCKS: Record<number, { id: string; label: string; move?: boolean }> = {
  2: { id: 'pool', label: '요원 강화 후보 추가' },
  3: { id: 'unique_a', label: '고유기 변형 A (새 동작)', move: true },
  5: { id: 'ult2', label: '필살기 2단계' },
  6: { id: 'unique_b', label: '고유기 변형 B (새 동작)', move: true },
  8: { id: 'relic_own', label: '전용 유물' },
  10: { id: 'palette', label: '숙련 의상 색' },
};

// ── 커피 (부록 E.3) ──
export const COFFEES = [
  { id: 'black', name: '블랙', effect: '필살 충전 +20%', who: '' },
  { id: 'mix', name: '믹스커피', effect: '체력 +10%', who: '데쥬레·고그니쟈 추천' },
  { id: 'condensed', name: '연유 커피', effect: '아이템 효과 +20%', who: '잼트리 특기' },
  { id: 'americano', name: '편의점 아메리카노', effect: '속도 +10%', who: '' },
] as const;

// ── 유물 (12.3) · 연구 (4.1 격리 연구실) ──
export const RELICS: Record<string, { name: string; effect: string }> = {
  first_guard: { name: '휴대용 재떨이', effect: '출동마다 첫 피격 무효' },
  forgive: { name: '구겨진 사과문', effect: '규칙 위반 1회 용서' },
  gauge: { name: '고장 난 초시계', effect: '필살 게이지 +25% 빠르게' },
  own_jyaldi: { name: '쟈알디의 라이터', effect: '폭파 범위 +20% (쟈알디 숙련 8)' },
  own_eileen: { name: '에일린의 조준경 덮개', effect: '첫 사격 치명 (에일린 숙련 8)' },
};
export interface ResearchDef {
  id: string;
  name: string;
  research: number;
  budget: number;
  gives: string;
  requires?: string;
}
export const RESEARCH: ResearchDef[] = [
  { id: 'rs_relic1', name: '재떨이 속 재 분석', research: 3, budget: 100, gives: 'relic:first_guard' },
  { id: 'rs_supply', name: '진압 장비 보급 승인', research: 4, budget: 100, gives: 'supply' },
  { id: 'rs_relic2', name: '사과문 문장 해독', research: 5, budget: 150, gives: 'relic:forgive', requires: 'rs_relic1' },
  { id: 'rs_danger', name: '위험 단계 기준 수립', research: 6, budget: 200, gives: 'danger' },
  { id: 'rs_relic3', name: '멈춘 시간 측정', research: 8, budget: 250, gives: 'relic:gauge', requires: 'rs_relic2' },
];

/** 아이템 모듈(items/data.ts SUPPLY_CATALOG)과 같은 id·값. 엔진이 setSupplyCatalog로 그쪽 표를 넣으면 그것을 쓴다. */
export interface SupplyDef {
  id: string;
  name: string;
  price: number;
  kind: 'heal' | 'cure' | 'throw' | 'special';
  max: number;
  desc: string;
  /** 연구로 열림 */
  locked?: boolean;
}
/** 연구 「진압 장비 보급 승인」 뒤에 살 수 있는 것 */
export const LOCKED_SUPPLY = new Set(['antidote', 'smoke', 'charm']);
export const SUPPLY_FALLBACK: SupplyDef[] = [
  { id: 'medkit', name: '회복약', price: 30, kind: 'heal', max: 3, desc: '체력 35% 회복' },
  { id: 'bandage', name: '압박 붕대', price: 18, kind: 'cure', max: 3, desc: '출혈을 멈추고 체력 10% 회복' },
  { id: 'antidote', name: '정화제', price: 40, kind: 'cure', max: 2, desc: '오염 한 단계 제거' },
  { id: 'salt', name: '소금', price: 25, kind: 'special', max: 3, desc: '발밑에 소금 원. 괴이가 6초 동안 들어오지 못한다' },
  { id: 'flash', name: '섬광탄', price: 35, kind: 'throw', max: 3, desc: '주변 적 2초 기절' },
  { id: 'smoke', name: '연막탄', price: 28, kind: 'throw', max: 2, desc: '연기 속 적 40% 둔화, 5초' },
  { id: 'charm', name: '관리국 부적', price: 60, kind: 'special', max: 1, desc: '다음 피격 1회 무효' },
  { id: 'energy', name: '에너지 음료', price: 22, kind: 'special', max: 2, desc: '능력 자원 40 회복' },
];
/** 예전 본부 저장의 임시 id → 아이템 모듈 id */
export const OLD_ITEM_IDS: Record<string, string> = { heal: 'medkit', guard: 'bandage', torch: 'flash' };

/** 이빨 요정 상자 잡동사니 (본부 장식) */
export const DECOR = ['녹슨 사원증', '이 빠진 머그컵', '「여기 오래 있지 마」 쪽지', '402호 리모컨', '엘리베이터 점검 스티커', '누군가의 어금니', '접힌 우산', '반쯤 탄 향초'];

/** 구조된 생존자 (면담실). 면담하면 규칙 단서 한 줄. */
export const SURVIVORS: Record<string, { name: string; clue: string; rule?: string }> = {
  worker: { name: '야근하던 회사원', clue: '「인사를 안 했더니 버튼이 두 개밖에 안 보였어요.」', rule: 'greet' },
  student: { name: '길 잃은 학생', clue: '「거울을 봤는데 제 얼굴이 엄청 피곤해 보였어요. 그래서 내렸어요.」', rule: 'mirror' },
};
