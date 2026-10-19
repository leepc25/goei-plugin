/** 배경 소품·바닥·캐릭터가 공유하는 화면 공간 규격. */
export const SCENE = {
  width:1280,height:720,backgroundWidth:640,backgroundHeight:360,
  floorBack:360,floorMin:400,floorMax:655,referenceY:530,adultHeight:160,
  // 배경 원본 640x360에서 일반 문 높이 105~115px, 성인 약 80px.
  doorHeight:220,
} as const;
/** 얕은 벨트스크롤 원근. 점프 z가 아닌 바닥 발 위치로만 배율을 정한다. */
export function depthScale(footY:number):number {
  return Math.max(.93,Math.min(1.07,1+(footY-SCENE.referenceY)*.0005));
}

/** 전용 보행 시트의 발목 간격에 맞춘 1주기 이동 거리(px). */
export const GAIT = {walk:128,run:224} as const;
