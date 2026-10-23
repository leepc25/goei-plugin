// 도트 그림이 없는 얼굴 사진을 대화창 화풍에 맞춰 코드로 거칠게 줄인다: 칸 평균으로 cells×cells, 색 단계를 줄이고 pixelated로 키운다.
// 처음 부르면 ''를 돌려주고 다 되면 done()을 부른다(그 사이에는 원래 사진을 보인다).
const cache = new Map<string, string>();
const busy = new Set<string>();
export function pixelPhoto(src: string, done: () => void, cells = 40): string {
  if (!src) return '';
  const key = `${cells}|${src}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!busy.has(key)) {
    busy.add(key);
    const im = new Image();
    im.onload = () => {
      let url = src;
      try {
        // 가운데 정사각형 (얼굴은 사진 위쪽)
        const s = Math.min(im.naturalWidth, im.naturalHeight);
        const c = document.createElement('canvas');
        c.width = c.height = cells;
        const g = c.getContext('2d')!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(im, (im.naturalWidth - s) / 2, 0, s, s, 0, 0, cells, cells);
        const d = g.getImageData(0, 0, cells, cells);
        const q = (v: number) => Math.round(v / 36) * 36;
        for (let i = 0; i < d.data.length; i += 4) { d.data[i] = q(d.data[i]); d.data[i + 1] = q(d.data[i + 1]); d.data[i + 2] = q(d.data[i + 2]); d.data[i + 3] = d.data[i + 3] > 127 ? 255 : 0; }
        g.putImageData(d, 0, 0);
        url = c.toDataURL();
      } catch { /* 읽을 수 없는 사진은 그대로 */ }
      cache.set(key, url);
      busy.delete(key);
      done();
    };
    im.onerror = () => { cache.set(key, ''); busy.delete(key); done(); };
    im.src = src;
  }
  return '';
}
