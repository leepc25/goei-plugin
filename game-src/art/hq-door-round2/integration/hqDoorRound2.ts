// Proposed new file: src/game/action/art/hqDoorRound2.ts.
// Presentation only. Existing hub supplies open progress; it owns movement and timing.
type Key = 'frame' | 'aperture' | 'leaf-left' | 'leaf-right' | 'entry-marker';
const keys: Key[] = ['frame', 'aperture', 'leaf-left', 'leaf-right', 'entry-marker'];
type Images = Record<Key, HTMLImageElement>;
let images: Images | null = null;
let revision = 0;
declare global {
  interface Window { __GOEI_HQ_DOOR_ROUND2__?: Partial<Record<Key, string>> }
}

/** Use bridge.assets.url('hq-door-round2', file) in plugin; embedded URLs in a standalone build. */
export function prepareHqDoorRound2(urlOf?: (file: string) => Promise<string>): () => void {
  const own = ++revision;
  images = null;
  void Promise.all(keys.map(async key => {
    const src = window.__GOEI_HQ_DOOR_ROUND2__?.[key] || (urlOf ? await urlOf(key + '.png') : '');
    if (!src) throw new Error('Optional door art unavailable');
    const im = new Image(); im.src = src; await im.decode();
    const dims = key === 'entry-marker' ? [48, 16] : key.startsWith('leaf-') ? [40, 125] : [96, 144];
    if (im.naturalWidth !== dims[0] || im.naturalHeight !== dims[1]) throw new Error('Door art size mismatch');
    return [key, im] as const;
  })).then(rows => { if (revision === own) images = Object.fromEntries(rows) as Images; })
    .catch(() => { /* keep existing procedural doorway if pack is unavailable */ });
  return () => { if (revision === own) { revision++; images = null; } };
}

/** World coordinates: caller already applies -camX. Caller restricts this to f2.office. */
export function drawHqDoorRound2(c: CanvasRenderingContext2D, x: number, open: number, unlocked: boolean): boolean {
  if (!images) return false;
  const a=images, ox=x-96, oy=168;
  const off=Math.round(40*Math.max(0,Math.min(1,Number.isFinite(open)?open:0)))*2;
  c.save();c.imageSmoothingEnabled=false;
  c.drawImage(a.aperture,ox,oy,192,288);
  c.save();c.beginPath();c.rect(x-80,190,160,250);c.clip();
  c.drawImage(a['leaf-left'],x-80-off,190,80,250);
  c.drawImage(a['leaf-right'],x+off,190,80,250);
  if(!unlocked){c.fillStyle='rgba(0,0,0,0.35)';c.fillRect(x-80,190,160,250)}
  c.restore();
  c.drawImage(a.frame,ox,oy,192,288);
  // In drawBackground: floor/door first, then marker, before depth-sorted actors.
  if(unlocked)c.drawImage(a['entry-marker'],x-48,448,96,32);
  c.restore();return true;
}
