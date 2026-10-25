// 필드 시험용 사람 그림 (game-pack/test-people, 사용자가 PixelLab에서 만든 Test woman·Test man 128×256).
// 주인공 = 에일린(2026-10-25 사용자 지시, agent-motion-set 동작 3판): 대기 남동 4장, 걷기·뛰기 동쪽 8장. 왼쪽은 좌우 뒤집기.
// (옛 Test woman 그림은 팩에 남아 있지만 쓰지 않는다)
// 남자 = 사무실에 서 있기만 한다(동쪽 그림, 4방향 캐릭터라 대각선이 없다).
// 크기: 원본 1도트 = 맨 앞 화면 1.5px, 원근은 다른 요원과 같다.
import { snapTo, spr } from '../engine/view';

const SCALE = 1.5;
const RUN_MS = 85;
type Art = { idle: HTMLImageElement; walk: HTMLImageElement; run: HTMLImageElement; man: HTMLImageElement };
let art: Art | null = null;
let revision = 0;
declare global { interface Window { __GOEI_TEST_PEOPLE__?: Record<string, string> } }

/** 그림별 발 기준점(원본 px): 서 있기 128×256 캔버스, 달리기 256×256 캔버스 */
const IDLE = { w: 128, h: 256, fx: 55, fy: 248, head: 14, n: 4, ms: 240 };
const WALK = { w: 256, h: 256, fx: 117, fy: 248, n: 8, ms: 110 };
const RUN = { w: 256, h: 256, fx: 120, fy: 248, n: 8, ms: RUN_MS };
const MAN = { w: 128, h: 256, fx: 66, fy: 249, head: 8 };

export function prepareTestPeople(urlOf?: (file: string) => Promise<string>) {
  const own = ++revision;
  art = null;
  const ready = Promise.all((['idle', 'walk', 'run', 'man'] as const).map(async (key) => {
    const file = key === 'man' ? 'man' : `eileen_${key}`;
    const src = window.__GOEI_TEST_PEOPLE__?.[file] || (urlOf ? await urlOf(file + '.png') : '');
    if (!src) throw new Error('no test art');
    const im = new Image(); im.src = src; await im.decode();
    return [key, im] as const;
  })).then((rows) => { if (revision === own) art = Object.fromEntries(rows) as Art; }).catch(() => { /* 없으면 원래 쟈알디 그림 */ });
  return { ready, dispose: () => { if (revision === own) { revision++; art = null; } } };
}

export const hasTestPeople = () => !!art;

function shadow(c: CanvasRenderingContext2D, x: number, y: number, k: number) {
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.beginPath();
  c.ellipse(x, y, 40 * k, 9 * k, 0, 0, Math.PI * 2);
  c.fill();
}

/** 주인공(에일린). clip에 run이 있으면 뛰기, walk면 걷기, 아니면 대기. x,y = 발 가운데(월드), dir 1 = 오른쪽 */
export function drawTestPlayer(c: CanvasRenderingContext2D, clip: string, x: number, y: number, dir: 1 | -1): boolean {
  if (!art) return false;
  const P = SCALE * spr(y);
  c.save();
  c.imageSmoothingEnabled = false;
  shadow(c, x, y, P);
  snapTo(c, x, y);
  if (dir < 0) c.scale(-1, 1);
  const [im, S] = /run/.test(clip) ? [art.run, RUN] : /walk/.test(clip) ? [art.walk, WALK] : [art.idle, IDLE];
  const f = Math.floor(performance.now() / S.ms) % S.n;
  c.drawImage(im, f * S.w, 0, S.w, S.h, -S.fx * P, -S.fy * P, S.w * P, S.h * P);
  c.restore();
  return true;
}

/** 서 있는 남자. dir 1 = 오른쪽 보기(원본) */
export function drawTestMan(c: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): boolean {
  if (!art) return false;
  const P = SCALE * spr(y);
  c.save();
  c.imageSmoothingEnabled = false;
  shadow(c, x, y, P);
  snapTo(c, x, y);
  if (dir < 0) c.scale(-1, 1);
  c.drawImage(art.man, 0, 0, MAN.w, MAN.h, -MAN.fx * P, -MAN.fy * P, MAN.w * P, MAN.h * P);
  c.restore();
  return true;
}

/** 발 기준 머리 꼭대기 (화면 px, 음수, 원근 미포함 — 부르는 쪽이 persp를 곱한다) */
export const testPlayerTop = () => -(IDLE.fy - IDLE.head) * SCALE;
export const testManTop = () => -(MAN.fy - MAN.head) * SCALE;

/** 주인공(여자) 얼굴 칸: 서 있는 그림의 머리·어깨 side×side (원본 1도트 = 1px) */
let face: HTMLCanvasElement | null = null;
export function testPlayerFace(side = 44): HTMLCanvasElement | null {
  if (!art) return null;
  if (face?.width === side) return face;
  face = document.createElement('canvas');
  face.width = face.height = side;
  const o = face.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  o.drawImage(art.idle, IDLE.fx - side / 2, IDLE.head - 4, side, side, 0, 0, side, side);
  return face;
}
