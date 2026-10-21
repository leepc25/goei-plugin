/**
 * 위성 지도 구름: 처음 위성 화면을 열 때 한 번만 이어 붙는 구름 무늬(흰 구름 + 그림자)를 그려 둔다.
 * 화면에서는 이 그림을 transform으로 옮기기만 해서 매 프레임 다시 그리지 않는다.
 */
const N = 256;

function lattice(seed: number, g: number): Float32Array {
  const a = new Float32Array(g * g);
  let s = seed >>> 0;
  for (let i = 0; i < a.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    a[i] = s / 4294967296;
  }
  return a;
}

/** 이어 붙는 값 잡음 (g칸 격자, 가장자리에서 되감김) */
function noise(lat: Float32Array, g: number, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % g) + g) % g, y0 = ((yi % g) + g) % g, x1 = (x0 + 1) % g, y1 = (y0 + 1) % g;
  const a = lat[y0 * g + x0] + (lat[y0 * g + x1] - lat[y0 * g + x0]) * sx;
  const b = lat[y1 * g + x0] + (lat[y1 * g + x1] - lat[y1 * g + x0]) * sx;
  return a + (b - a) * sy;
}

function fbm(seed: number, base: number, oct: number): (u: number, v: number) => number {
  const lats = Array.from({ length: oct }, (_, o) => lattice(seed + o * 101, base << o));
  return (u, v) => {
    let t = 0, amp = 0.5, sum = 0;
    for (let o = 0; o < oct; o++) {
      const g = base << o;
      t += noise(lats[o], g, u * g, v * g) * amp;
      sum += amp;
      amp *= 0.5;
    }
    return t / sum;
  };
}

function draw(seed: number): { cloud: string; shadow: string } | null {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d');
  if (!x) return null;
  const main = fbm(seed, 4, 6);
  const warp = fbm(seed + 7, 3, 3);
  const img = x.createImageData(N, N);
  const sh = x.createImageData(N, N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N;
      // 바람 방향으로 살짝 늘이고 비틀어 줄무늬·소용돌이 느낌을 낸다
      const w = warp(u, v) - 0.5;
      const n = main(u + w * 0.35, v + w * 0.2);
      const d = Math.min(1, Math.max(0, (n - 0.5) / 0.22));
      const a = d * d * (3 - 2 * d);
      const k = (j * N + i) * 4;
      const tone = 196 + 59 * Math.min(1, a * 1.3);
      img.data[k] = tone; img.data[k + 1] = tone + 2; img.data[k + 2] = Math.min(255, tone + 6);
      img.data[k + 3] = Math.round(a * 235);
      sh.data[k] = 0; sh.data[k + 1] = 4; sh.data[k + 2] = 8;
      sh.data[k + 3] = Math.round(a * 120);
    }
  }
  x.putImageData(img, 0, 0);
  const cloud = c.toDataURL('image/png');
  x.putImageData(sh, 0, 0);
  return { cloud, shadow: c.toDataURL('image/png') };
}

let done = false;

/** 위성 화면을 그릴 때 부른다. 처음 한 번만 그림을 만들고 스타일로 걸어 둔다 */
export function ensureClouds(): void {
  if (done) return;
  done = true;
  try {
    const a = draw(20251021);
    if (!a) return;
    const st = document.createElement('style');
    st.textContent = `.gx-opfx.sky > :is(.c1, .c2) { background-image: url(${a.cloud}); } .gx-opfx.sky > .c0 { background-image: url(${a.shadow}); }`;
    document.head.appendChild(st);
  } catch {
    // 그림을 못 만들면 구름 없이 지도만 보인다
  }
}
