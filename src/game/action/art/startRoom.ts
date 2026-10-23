// One authored room, with a clean plate and a separate alpha workstation.
// Assets are never stretched to the previous 22m floorplan.
type Art = { room: HTMLImageElement; workstation: HTMLImageElement };
let art: Art | null = null;
let revision = 0;
declare global { interface Window { __GOEI_START_ROOM__?: Record<string, string> } }
export function prepareStartRoom(urlOf?: (file: string) => Promise<string>) {
  const own = ++revision;
  art = null;
  const ready = Promise.all(['room', 'workstation'].map(async key => {
    const src = window.__GOEI_START_ROOM__?.[key] || (urlOf ? await urlOf(key + '.png') : '');
    if (!src) throw new Error('Starting room asset unavailable');
    const im = new Image(); im.src = src; await im.decode();
    return [key, im] as const;
  })).then(rows => { if (revision === own) art = Object.fromEntries(rows) as Art; });
  return { ready, dispose: () => { if (revision === own) { revision++; art = null; } } };
}
export function drawStartRoom(c: CanvasRenderingContext2D, open: number): boolean {
  if (!art) return false;
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; // 고화질 원본(임시 시험)
  c.drawImage(art.room, 0, 0, 1280, 720);
  // Existing wall doorway, hinge on its right. No extra door is pasted elsewhere.
  if (open > 0) {
    const x = 1001, y = 89, w = 164, h = 320;
    c.fillStyle = '#12191c'; c.fillRect(x, y, w, h);
    const visible = w * Math.max(0, 1 - open);
    if (visible > 0) c.drawImage(art.room,
      x / 1280 * art.room.width, y / 720 * art.room.height,
      w / 1280 * art.room.width, h / 720 * art.room.height,
      x + w - visible, y, visible, h);
  }
  // Subtle contact shadow under the separately depth-sorted furniture.
  c.fillStyle = 'rgba(8, 7, 6, .22)';
  c.beginPath(); c.ellipse(420, 517, 135, 14, 0, 0, Math.PI * 2); c.fill();
  c.restore(); return true;
}
export function drawStartRoomFurniture(c: CanvasRenderingContext2D, kind: string) {
  if (!art || !['desk', 'chair'].includes(kind)) return;
  c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; // 고화질 원본(임시 시험)
  // tools/startroom_pixelize.py already placed the cutout at screen scale (floor contact y520).
  c.beginPath(); c.rect(kind === 'chair' ? 180 : 294, 270, kind === 'chair' ? 114 : 266, 256); c.clip();
  c.drawImage(art.workstation, 0, 0, 1280, 720);
  c.restore();
}
