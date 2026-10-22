// 층 유형 (스테이지 설계서 3장). 유형 하나 = 조각 세트 + 규칙 세트 + 수호자 후보 + 적 후보 + 팔레트.
// 적·수호자 '종류'의 실제 행동은 적과 수호자 작업이 정한다. 여기서는 이름표(kind id)와 가격만 둔다.
import type { FloorType, Palette, ReplicaSub } from '../types';

export interface FloorTypeDef {
  type: FloorType;
  label: string;
  /** 승강기 방송의 수수께끼 경고 (규칙 힌트) */
  hint: string;
  rules: string[];
  guardians: { kind: string; label: string; weakness: string }[];
  enemies: { kind: string; label: string; price: number }[];
  palette: Palette;
}

export const FLOOR_TYPES: Record<FloorType, FloorTypeDef> = {
  lobby: {
    type: 'lobby',
    label: '로비',
    hint: '편하게 둘러보세요. 다 평범하니까요.',
    rules: ['lobby', 'l_clock'],
    guardians: [{ kind: 'guard', label: '낡은 제복의 경비원', weakness: '순찰 경로 밖에 서면 못 본다' }],
    enemies: [
      { kind: 'lurker', label: '해롭지 않아 보이는 것', price: 8 },
      { kind: 'shooter', label: '창구 직원', price: 15 },
      // 로비에 둘만 나오면 같은 모양이 반복된다 (독립 검수: 클론 적)
      { kind: 'hollow', label: '더는 사람이 아닌 것', price: 12 },
    ],
    palette: { wall: '#4a5459', floor: '#6d6a5f', trim: '#2f3638', accent: '#d8c27a', fog: 'rgba(0,0,0,0)' },
  },
  silent: {
    type: 'silent',
    label: '침묵의 층',
    hint: '이번 층에서는 뛰지 마세요. 숨도 작게.',
    rules: ['silent'],
    guardians: [{ kind: 'noise', label: '소리와 냄새', weakness: '조용히 유인해 그릇 아래 가두기' }],
    enemies: [{ kind: 'hum', label: '발소리', price: 20 }],
    palette: { wall: '#3c4646', floor: '#2a3131', trim: '#1b2020', accent: '#9fc6c0', fog: 'rgba(40,60,60,0.15)' },
  },
  dark: {
    type: 'dark',
    label: '어둠의 층',
    hint: '불은 아끼세요. 그리고 멈추지 마세요.',
    rules: ['dark'],
    guardians: [{ kind: 'shadow', label: '그림자', weakness: '빛에 얇아질 때만 피해' }],
    enemies: [
      { kind: 'shade', label: '얼룩', price: 20 },
      { kind: 'crawler', label: '다리 많은 새끼', price: 25 },
    ],
    palette: { wall: '#1d2124', floor: '#141618', trim: '#0b0c0d', accent: '#e8d7a0', fog: 'rgba(0,0,0,0)' },
  },
  chase: {
    type: 'chase',
    label: '추격의 층',
    hint: '문이 열리면 바로 가세요. 뒤는 보지 마시고.',
    rules: ['c_back', 'c_door'],
    guardians: [{ kind: 'legs', label: '다리 많은 것', weakness: '틈새를 막으면 나올 곳이 준다' }],
    enemies: [
      { kind: 'crawler', label: '다리 많은 새끼', price: 25 },
      { kind: 'charger', label: '돌진하는 것', price: 20 },
    ],
    palette: { wall: '#5a3a36', floor: '#3b2826', trim: '#241514', accent: '#ff8a6a', fog: 'rgba(80,0,0,0.12)' },
  },
  puzzle: {
    type: 'puzzle',
    label: '퍼즐과 선택의 층',
    hint: '표지를 읽으세요. 문은 둘인데 길은 하나예요.',
    rules: ['p_sign', 'p_order', 'p_wall'],
    guardians: [{ kind: 'shape', label: '불가능한 입체 도형', weakness: '등 돌리면 반전이 풀린다' }],
    enemies: [
      { kind: 'shooter', label: '사격하는 것', price: 15 },
      { kind: 'charger', label: '돌진하는 것', price: 20 },
    ],
    palette: { wall: '#43385a', floor: '#2d2640', trim: '#1c1729', accent: '#c9a8ff', fog: 'rgba(30,0,60,0.1)' },
  },
  replica: {
    type: 'replica',
    label: '재현의 층 · 아파트',
    hint: '이웃끼리는 인사하는 거예요.',
    rules: ['r_greet', 'r_quiet', 'r_meal'],
    guardians: [
      { kind: 'elder', label: '405호 노부부', weakness: '「잘 먹었습니다」로 전투 생략' },
      { kind: 'family208', label: '208호 가족', weakness: '붉은 것을 밟지 않으면 문이 열린다' },
      { kind: 'risenhouse', label: '일어난 집', weakness: '물건을 제자리에' },
    ],
    enemies: [{ kind: 'resident', label: '사는 척하는 주민', price: 10 }],
    palette: { wall: '#5b5442', floor: '#7a6a4c', trim: '#3a3324', accent: '#ffd98a', fog: 'rgba(60,40,0,0.08)' },
  },
  trial: {
    type: 'trial',
    label: '시험 층',
    hint: '벽부터 읽으세요. 시간은 이미 가고 있어요.',
    rules: ['trial'],
    guardians: [{ kind: 'conductor', label: '낡은 제복의 차장', weakness: '순찰 경로 밖에 서면 못 본다' }],
    enemies: [
      { kind: 'charger', label: '돌진하는 것', price: 20 },
      { kind: 'shooter', label: '사격하는 것', price: 15 },
    ],
    palette: { wall: '#34485a', floor: '#22303c', trim: '#141d25', accent: '#7ad0ff', fog: 'rgba(0,20,40,0.08)' },
  },
  deep: {
    type: 'deep',
    label: 'B-12 · 완전한 어둠',
    hint: '……',
    rules: ['dark', 'silent'],
    guardians: [{ kind: 'touchers', label: '만지는 것들', weakness: '멈추지 않기 + 소리 안 내기' }],
    enemies: [],
    palette: { wall: '#060606', floor: '#050505', trim: '#000', accent: '#777', fog: 'rgba(0,0,0,0)' },
  },
};

export const REPLICA_SUB_LABEL: Record<ReplicaSub, string> = { vacant: '빈집', pretending: '사는 척', red: '붉은 벽' };
export const REPLICA_SUB_RULES: Record<ReplicaSub, string[]> = {
  vacant: ['r_things'],
  pretending: ['r_greet', 'r_quiet', 'r_meal'],
  red: ['r_red', 'r_quiet'],
};
export const REPLICA_SUB_GUARDIAN: Record<ReplicaSub, string> = { vacant: 'risenhouse', pretending: 'elder', red: 'family208' };

/** 깊이 표시. depth 1~3 = 로비 L1~L3, 4부터 B-1. */
export function depthLabel(depth: number): string {
  return depth <= 3 ? `L${depth}` : `B-${depth - 3}`;
}
export const B12 = 15;

/** 위협 예산 (기본 기획서 8.4). */
export function budgetFor(depth: number, chunkIndex: number, danger: number, variant: number, growth: number): number {
  const base = depth <= 3 ? 6 + depth * 3 : 16 + (depth - 3) * 8;
  return Math.round(base + chunkIndex * 2 + danger * 5 + variant + growth * 4);
}
