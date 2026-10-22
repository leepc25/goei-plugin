// 캔버스 글씨를 도트 글꼴로 (시스템 글꼴 금지). 도트 글꼴은 11px 배수에서 또렷하다. ui/hud의 pfont와 같은 규칙이지만 화면 모듈(css)을 끌어오지 않게 따로 둔다.
export function pfont(size: number) {
  const n = size <= 12 ? 11 : Math.max(22, Math.round(size / 11) * 11);
  return { n, f: `700 ${n}px "GoeiPixel", "Galmuri11", monospace` };
}
