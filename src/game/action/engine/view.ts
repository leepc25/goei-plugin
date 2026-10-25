// 필드(창 높이 맞춤)에서 캔버스가 1280보다 좁을 때, 1280 화면 중 어디를 보여 줄지 (주인공을 가운데로).
// 월드 그림만 이만큼 옮기고, HUD는 좁은 캔버스 폭(canvas.width)에 맞춰 그린다.
// zoom: 필드는 캔버스가 창을 꽉 채우고(세로 720이 아님) 월드를 canvas.height/720 배로 그린다.
// 사람 그림은 zoom을 되돌려 도트 1칸이 늘 PIXEL 화면 px이 되게 하고, 원근(뒤로 갈수록 작게)을 곱한다.
export const view = { crop: 0, cropY: 0, zoom: 1, lane: [440, 690] as [number, number] };

/** 필드 원근: 줄 맨 뒤 0.85배 ~ 맨 앞 1배 */
export const FAR = 0.85;
export const persp = (y: number) => {
  const [a, b] = view.lane;
  const t = b > a ? Math.max(0, Math.min(1, (y - a) / (b - a))) : 1;
  return FAR + (1 - FAR) * t;
};
/** 발 y에 선 사람 그림의 배율 (월드 좌표 기준). 배경과 같이 커지고 작아진다 (사용자 2026-10-25: 캐릭터만 작아지면 안 됨) */
export const spr = (y: number) => persp(y);
/** 사람 그림 원점을 (x, y)로 옮기되 화면 픽셀 정수에 붙인다 (필드는 월드를 zoom배로 그려서 월드 정수 좌표가 화면 소수 px이 된다) */
export function snapTo(c: CanvasRenderingContext2D, x: number, y: number) {
  c.translate(x, y);
  const t = c.getTransform();
  c.setTransform(t.a, t.b, t.c, t.d, Math.round(t.e), Math.round(t.f));
}
