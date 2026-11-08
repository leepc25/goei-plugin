// 고르기·VS 화면의 브라운관 (11-08 사용자 「거기도 적용해야지」): 경기 화면 셰이더(ui/crt.ts, 투명 무대 모드)와 같은 식을 2D 캔버스에.
// 색 갈라짐(빨강·파랑 1px) · 밝은 곳 빛 번짐 · 주사선(두 줄마다, 밝을수록 옅게) · RGB 형광 세로줄(3px) · 밝기 보정. 빈 곳은 투명 그대로.

/** 캔버스를 그 자리에서 브라운관으로. 그림이 바뀔 때마다 한 번 부른다 (매 화면 X) */
export function crt2d(cv: HTMLCanvasElement): HTMLCanvasElement {
  const w = cv.width, h = cv.height;
  if (!w || !h) return cv;
  const o = cv.getContext('2d', { willReadFrequently: true })!;
  const src = o.getImageData(0, 0, w, h), s = src.data;
  const out = o.createImageData(w, h), d = out.data;
  const at = (x: number, y: number) => ((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4;
  // 셰이더와 같이 원래 색(알파를 곱하지 않은 값)을 읽는다
  const pm = (i: number, c: number) => s[i + c];
  const MASK = [[1, 0.72, 0.72], [0.72, 1, 0.72], [0.72, 0.72, 1]];
  for (let y = 0; y < h; y++) {
    const line = y % 2 === 0 ? 1 : 0;   // cos(y·π): 짝수 줄이 주사선
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, il = at(x - 1, y), ir = at(x + 1, y);
      const alpha = Math.max(s[i + 3], s[il + 3], s[ir + 3]) / 255;
      // 빛 번짐: 둘레 8곳(2.5px) 평균에서 밝은 곳만
      let br = 0, bg = 0, bb = 0;
      for (let k = 0; k < 8; k++) {
        const a = k * 0.785398, j = at(x + Math.round(Math.cos(a) * 2.5), y + Math.round(Math.sin(a) * 2.5));
        br += pm(j, 0); bg += pm(j, 1); bb += pm(j, 2);
      }
      const gr = Math.max(br / 8 / 255 - 0.55, 0) * 0.9, gg = Math.max(bg / 8 / 255 - 0.55, 0) * 0.9, gb = Math.max(bb / 8 / 255 - 0.55, 0) * 0.9;
      if (alpha <= 0 && gr + gg + gb <= 0) continue;
      // 색 갈라짐: 빨강은 왼쪽, 파랑은 오른쪽에서
      let r = pm(il, 0) / 255 + gr, g = pm(i, 1) / 255 + gg, b = pm(ir, 2) / 255 + gb;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const scan = 1 + ((0.62 + (0.9 - 0.62) * Math.min(1, lum)) - 1) * line;
      const m = MASK[x % 3];
      const f = (v: number, mk: number) => Math.pow(Math.max(0, v * scan * (1 + (mk - 1) * 0.32) * 1.22), 0.95);
      r = f(r, m[0]); g = f(g, m[1]); b = f(b, m[2]);
      const a = Math.min(1, Math.max(alpha, ((gr + gg + gb) / 3) * 0.8));
      // 셰이더: col·alpha + glow·(1-alpha) 를 미리 곱한 값으로 → 보통 알파로 되돌린다
      const k2 = (v: number, gv: number) => (a > 0 ? Math.min(255, Math.round(((v * alpha + gv * (1 - alpha)) / a) * 255)) : 0);
      d[i] = k2(r, gr); d[i + 1] = k2(g, gg); d[i + 2] = k2(b, gb); d[i + 3] = Math.round(a * 255);
    }
  }
  o.putImageData(out, 0, 0);
  return cv;
}
