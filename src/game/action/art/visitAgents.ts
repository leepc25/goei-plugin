// 본부 방문: 방에 서 있는 요원 그림 (game-pack/visit-agents, tools/build_visit_agents.py).
// 각 요원의 기존 대기(idle) 클립만 쓴다. 그림이 없는 요원은 그리지 않고 대화 목록에만 나온다.
import { PIXEL } from '../engine/contract';
import { charSize } from '../charSize';
import { snapTo, spr } from '../engine/view';

type Frame = { sx: number; sy: number; w: number; h: number; ox: number; oy: number };
type Sheet = { atlas: HTMLImageElement; agents: Record<string, { ms: number; frames: Frame[] }> };
let sheet: Sheet | null = null;
let revision = 0;
declare global { interface Window { __GOEI_VISIT_AGENTS__?: { atlas: string; frames: Sheet['agents'] } } }

export function prepareVisitAgents(urlOf?: (file: string) => Promise<string>, bytesOf?: (file: string) => Promise<Uint8Array | null>) {
  const own = ++revision;
  sheet = null;
  const ready = (async () => {
    const inline = window.__GOEI_VISIT_AGENTS__;
    let src = inline?.atlas ?? '';
    let agents = inline?.frames;
    if (!inline && urlOf && bytesOf) {
      // Risu 창은 blob 주소를 fetch로 못 읽는다: JSON은 바이트로 받는다
      const b = await bytesOf('frames.json');
      agents = b ? (JSON.parse(new TextDecoder().decode(b)) as { agents: Sheet['agents'] }).agents : undefined;
      src = await urlOf('atlas.png');
    }
    if (!src || !agents) return;
    const im = new Image();
    im.src = src;
    await im.decode();
    if (revision === own) sheet = { atlas: im, agents };
  })().catch(() => { /* 그림 없으면 목록 대화만 */ });
  return { ready, dispose: () => { if (revision === own) { revision++; sheet = null; } } };
}

export const hasVisitAgent = (name: string) => !!sheet?.agents[name];

/** x,y = 발 가운데. dir 1 = 오른쪽 보기(원본 방향) */
export function drawVisitAgent(c: CanvasRenderingContext2D, name: string, x: number, y: number, dir: 1 | -1, now: number): boolean {
  const a = sheet?.agents[name];
  if (!sheet || !a?.frames.length) return false;
  const f = a.frames[Math.floor(now / a.ms) % a.frames.length];
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.beginPath();
  const P = PIXEL * spr(y) * charSize.k, k = P / PIXEL;
  c.ellipse(x, y, 34 * k, 8 * k, 0, 0, Math.PI * 2);
  c.fill();
  snapTo(c, x, y);
  if (dir < 0) c.scale(-1, 1);
  c.drawImage(sheet.atlas, f.sx, f.sy, f.w, f.h, f.ox * P, f.oy * P, f.w * P, f.h * P);
  c.restore();
  return true;
}

/** 발 기준 머리 꼭대기 높이 (화면 px, 음수). frames.json의 head(원본 px)가 있으면 그것, 없으면 그림 윗변 */
export function visitAgentTop(name: string): number {
  const a = sheet?.agents[name] as ({ head?: number; frames: Frame[] } | undefined);
  if (!a?.frames.length) return -260;
  if (typeof a.head === 'number') return -a.head * PIXEL * charSize.k;
  return Math.min(...a.frames.map((f) => f.oy)) * PIXEL * charSize.k;
}

/** 대화창·화면 UI 얼굴: 필드 그림(도트) 첫 장의 머리·어깨를 잘라 1도트 = 1px 그림 주소로 (CSS pixelated로 키운다). 그림이 없으면 '' */
const faces = new Map<string, string>();
const faceCanvas = new Map<string, HTMLCanvasElement>();
/** 같은 얼굴을 캔버스로 (화면 UI에 바로 그린다) */
export function visitAgentFaceCanvas(name: string, side = 34): HTMLCanvasElement | null {
  visitAgentFace(name, side);
  return faceCanvas.get(`${name}|${side}`) ?? null;
}
export function visitAgentFace(name: string, side = 34): string {
  const a = sheet?.agents[name];
  if (!sheet || !a?.frames.length) return '';
  const key = `${name}|${side}`;
  const hit = faces.get(key);
  if (hit !== undefined) return hit;
  const f = a.frames[0];
  const src = document.createElement('canvas');
  src.width = f.w;
  src.height = f.h;
  const g = src.getContext('2d')!;
  g.drawImage(sheet.atlas, f.sx, f.sy, f.w, f.h, 0, 0, f.w, f.h);
  let url = '';
  try {
    // 머리 가운데: 맨 위 14줄의 불투명 칸 가로 평균
    const d = g.getImageData(0, 0, f.w, Math.min(14, f.h)).data;
    let sx = 0, n = 0, top = -1;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { const p = (i - 3) / 4; sx += p % f.w; n++; if (top < 0) top = Math.floor(p / f.w); }
    const cx = n ? sx / n : f.w / 2;
    const out = document.createElement('canvas');
    out.width = out.height = side;
    const o = out.getContext('2d')!;
    o.imageSmoothingEnabled = false;
    o.drawImage(src, Math.round(side / 2 - cx), 2 - Math.max(0, top));
    url = out.toDataURL();
    faceCanvas.set(key, out);
  } catch { /* 읽을 수 없는 그림이면 사진으로 */ }
  faces.set(key, url);
  return url;
}
