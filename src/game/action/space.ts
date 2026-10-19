/** 일반 체형 도트와 배경이 공유하는 화면 공간. 원본 128px, 정수 2배 표시. */
export const SCENE = {
  width: 1280,
  height: 720,
  backgroundWidth: 640,
  backgroundHeight: 360,
  floorBack: 460,
  floorMin: 480,
  floorMax: 680,
  referenceY: 530,
  nativeAdultHeight: 128,
  actorScale: 2,
  adultHeight: 256,
  enemyScale: 2,
  doorHeight: 340,
} as const;
/** 얕은 벨트스크롤 원근. 도트는 정수 배율을 유지하고 앞뒤는 바닥 정렬로 표현한다. */
export function depthScale(_footY: number): number {
  return 1;
}
export const GAIT = { walk: 224, run: 300 } as const;
export const MOTION = { walkSpeed: 200, runSpeed: 360 } as const;
