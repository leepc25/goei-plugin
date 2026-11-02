// 필드(창 높이 맞춤)에서 캔버스가 1280보다 좁을 때, 1280 화면 중 어디를 보여 줄지 (주인공을 가운데로).
// 월드 그림만 이만큼 옮기고, HUD는 좁은 캔버스 폭(canvas.width)에 맞춰 그린다.
// zoom: 필드는 캔버스가 창을 꽉 채우고(세로 720이 아님) 월드를 canvas.height/720 배로 그린다.
// 사람 그림은 zoom을 되돌려 도트 1칸이 늘 PIXEL 화면 px이 되게 하고, 원근(뒤로 갈수록 작게)을 곱한다.
/** worldH: 장면 세로(월드 px). 관리국 그림 배경은 700, 나머지는 720. 필드(PC) 확대는 장면과 상관없이 고정(game.ts BASE_ZOOM), 폰은 이 높이를 창에 꽉 맞춘다 */
/** w: 화면에 보이는 월드 폭. 기본 1280, 필드 무확대에서 창이 넓으면 그만큼 넓다 (카메라·그리는 범위가 이걸 따른다) */
export const view = { crop: 0, cropY: 0, zoom: 1, lane: [440, 690] as [number, number], worldH: 720, w: 1280, hub: false,
  /** 사람 그림 배율에 더 곱할 값. 장면에 dotK(앞줄 도트 배율)가 있으면 dotK / CHAR_K, 아니면 1 (hub.ts가 장면에 들어갈 때 정한다) */
  charMul: 1,
  /** 장면 전체(배경·사람·물건) 확대율. 사람 크기는 모든 장면에서 STD_DOTK로 같게 두고, 그림 규격(dotK)이 다른 장면은 화면 전체를 STD_DOTK/dotK 배로 보여 준다 (사용자 11-02 「화면마다 사람 크기가 들쑥날쑥」→ 통일) */
  sceneZoom: 1,
  /** 이 장면의 줄 맨 뒤 배율(장면에 far가 있으면 그 값, 없으면 FAR). hub.ts가 장면에 들어갈 때 정한다 */
  far: 0.85,
  /** 이 y(월드)보다 앞에서는 사람을 더 키우지 않는다(장면 grow 값, 없으면 줄 맨 앞까지 키움). 사용자 11-01 15:07 「제일 앞에서 너무 급격하게 커진다」 */
  growTo: 0,
  /** 기준점 크기표 [발 y(월드), 배율(맨 앞 1)]: 있으면 이웃 기준점 사이에서만 크기가 바뀌고, 첫 점보다 뒤·끝 점보다 앞은 그 크기 그대로.
   *  장면 그림의 문·물건 높이로 잰다 (사용자 11-01 15:21: 키우기는 문~앞 캐비닛, 줄이기는 문~제일 안쪽 캐비닛 사이에서만) */
  sizes: [] as [number, number][] };

/** 필드 원근 기본값: 줄 맨 뒤 0.85배 ~ 맨 앞 1배 (장면마다 view.far로 바꿀 수 있음) */
export const FAR = 0.85;
/** 모든 장면의 사람 앞줄 도트 배율 기준값 (맵 에디터 장면 기본 dotK). 장면 dotK가 이와 다르면 sceneZoom으로 화면 전체를 맞춘다 */
export const STD_DOTK = 1.4292;
/** 원근 배율 계산(순수 함수): sizes 표가 있으면 표로, 없으면 lane 뒤 far ~ 앞(growTo 또는 lane 앞) 1 */
export const perspOf = (y: number, lane: [number, number], far: number, growTo: number, sizes: [number, number][]) => {
  const sz = sizes;
  if (sz.length) {
    if (y <= sz[0][0]) return sz[0][1];
    for (let i = 1; i < sz.length; i++) if (y <= sz[i][0]) {
      const [y0, k0] = sz[i - 1], [y1, k1] = sz[i];
      return k0 + (k1 - k0) * (y - y0) / (y1 - y0);
    }
    return sz[sz.length - 1][1];
  }
  const a = lane[0], b = growTo > a ? growTo : lane[1];
  const t = b > a ? Math.max(0, Math.min(1, (y - a) / (b - a))) : 1;
  return far + (1 - far) * t;
};
export const persp = (y: number) => perspOf(y, view.lane, view.far, view.growTo, view.sizes);
/** 사람 크기 기준: 기본 장면(dotK STD_DOTK, 원근 far 0.85)의 줄 한가운데 크기. 모든 장면은 줄 한가운데 사람이 이 크기가 되게 sceneZoom을 맞춘다 (앞뒤 원근 차이는 장면 그림대로 둔다) */
export const STD_MID = STD_DOTK * (FAR + 1) / 2;
/** 발 y에 선 사람 그림의 배율 (월드 좌표 기준). 배경과 같이 커지고 작아진다 (사용자 2026-10-25: 캐릭터만 작아지면 안 됨) */
export const spr = (y: number) => persp(y) * view.charMul;
/** 사람 그림 원점을 (x, y)로 옮기되 화면 픽셀 정수에 붙인다 (필드는 월드를 zoom배로 그려서 월드 정수 좌표가 화면 소수 px이 된다) */
export function snapTo(c: CanvasRenderingContext2D, x: number, y: number) {
  c.translate(x, y);
  const t = c.getTransform();
  c.setTransform(t.a, t.b, t.c, t.d, Math.round(t.e), Math.round(t.f));
}
