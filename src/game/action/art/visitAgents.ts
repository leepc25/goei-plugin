// 본부 방문: 방에 서 있는 요원 그림 (game-pack/visit-agents, tools/build_visit_agents.py).
// 각 요원의 기존 대기(idle) 클립만 쓴다. 그림이 없는 요원은 그리지 않고 대화 목록에만 나온다.
import { PIXEL } from '../engine/contract';
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
  const P = PIXEL * spr(y), k = P / PIXEL;
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
  if (typeof a.head === 'number') return -a.head * PIXEL;
  return Math.min(...a.frames.map((f) => f.oy)) * PIXEL;
}
