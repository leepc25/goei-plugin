// 엔진 기본 층: 훈련장. 층 생성 모듈(stage/)이 없을 때와 조작 연습용. 회색 상자.
import type { FloorPlan, StageModule } from './contract';

export function trainingFloor(): FloorPlan {
  const L = 4200;
  return {
    id: 'training-1',
    title: '관리국 지하 훈련장',
    type: 'lobby',
    depth: 0,
    length: L,
    lane: [440, 690],
    startX: 200,
    exitX: L - 120,
    banner: '관리국 지하 훈련장 · 조작 연습',
    palette: { wall: '#2b343a', floor: '#3c4549', accent: '#6c7b83' },
    props: [
      { id: 'sign1', kind: 'sign', x: 420, y: 445, w: 140, h: 60, label: 'A 연타 · ↓↓ 앉기 · Shift 회피/달리기' },
    ],
    encounters: [
      { triggerX: 500, lockFrom: 0, lockTo: 1400, waves: [[{ kind: 'dummy-once', x: 1000, y: 590 }], [{ kind: 'thug', x: 1300, y: 560 }, { kind: 'thug', x: 1350, y: 650 }]] },
      { triggerX: 1800, lockFrom: 1500, lockTo: 2800, waves: [[{ kind: 'thug', x: 2700, y: 540 }, { kind: 'thug', x: 2750, y: 620 }, { kind: 'thug', x: 1520, y: 670 }], [{ kind: 'thug', x: 2750, y: 560, elite: true }, { kind: 'thug', x: 1530, y: 600 }]] },
      { triggerX: 3000, lockFrom: 2900, lockTo: 4200, waves: [[{ kind: 'thug', x: 4100, y: 590, boss: true }, { kind: 'thug', x: 2950, y: 560 }, { kind: 'thug', x: 4150, y: 660 }]] },
    ],
  };
}

export const trainingStage: StageModule = {
  id: 'training',
  label: '훈련장',
  firstFloor: () => trainingFloor(),
  nextFloor: () => null,
};

/** 허수아비만 있는 연습 방 (끝없음) */
export const dummyStage: StageModule = {
  id: 'dummy',
  label: '허수아비 연습',
  firstFloor: () => ({
    id: 'dummy-room',
    title: '허수아비 연습',
    length: 1280,
    startX: 360,
    exitX: Infinity,
    banner: '허수아비 연습 · H 판정 보기 · Esc 메뉴',
    encounters: [{ triggerX: 0, lockFrom: 0, lockTo: 1280, waves: [[{ kind: 'dummy', x: 760, y: 565 }, { kind: 'dummy', x: 980, y: 540 }], [{ kind: 'dummy', x: 900, y: 590 }]] }],
  }),
  nextFloor: () => null,
};
