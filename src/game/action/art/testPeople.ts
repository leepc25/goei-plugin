// 필드 시험용 사람 그림 (game-pack/test-people).
// 주인공 = 에일린 테스트룸 완성본(2026-10-25 사용자 지시): 테스트룸이 정리한 시트·기준점(eileen.json)을 그대로 쓰고,
// 재생도 테스트룸 규칙대로(평상 대기는 앞 두 장만 0.6초씩, 걷기 11장/초, 뛰기 15장/초, 발밑 = 그림 높이 - 4, 그림자는 발 범위).
// 엔진 동작 이름(idle·walk·jab…)은 테스트룸 동작 번호로 바꿔 그린다. 왼쪽은 좌우 뒤집기.
// 남자 = 사무실에 서 있기만 한다(Test man, 동쪽 그림).
// 크기: 원본 1도트 = 화면 1px × 원근 × 설정의 캐릭터 크기(charSize).
import { snapTo, spr } from '../engine/view';
import { charSize } from '../charSize';

const MAN_SCALE = 1;
type Meta = { name: string; dir: string; n: number; w: number; h: number; bot: number[]; foot: number[][]; cx: number[] };
type Art = { clips: Record<string, { im: HTMLImageElement; m: Meta }>; man: HTMLImageElement };
let art: Art | null = null;
let revision = 0;
declare global { interface Window { __GOEI_TEST_PEOPLE__?: Record<string, string> & { eileen?: Record<string, Meta> } } }

const MAN = { w: 128, h: 256, fx: 66, fy: 249, head: 8 };

export function prepareTestPeople(urlOf?: (file: string) => Promise<string>, bytesOf?: (file: string) => Promise<Uint8Array | null>) {
  const own = ++revision;
  art = null;
  const img = async (file: string, ext = '.png') => {
    const src = window.__GOEI_TEST_PEOPLE__?.[file] || (urlOf ? await urlOf(file + ext) : '');
    if (!src) throw new Error('no test art');
    const im = new Image(); im.src = src; await im.decode();
    return im;
  };
  const ready = (async () => {
    let meta = window.__GOEI_TEST_PEOPLE__?.eileen as Record<string, Meta> | undefined;
    if (!meta && bytesOf) {
      const b = await bytesOf('eileen.json');
      if (b) meta = JSON.parse(new TextDecoder().decode(b));
    }
    if (!meta) throw new Error('no eileen');
    const rows = await Promise.all(Object.entries(meta).map(async ([id, m]) => [id, { im: await img(`eileen_${id}`, '.webp'), m }] as const));
    const man = await img('man');
    if (revision === own) art = { clips: Object.fromEntries(rows), man };
  })().catch(() => { /* 없으면 원래 쟈알디 그림 */ });
  return { ready, dispose: () => { if (revision === own) { revision++; art = null; } } };
}

export const hasTestPeople = () => !!art;

/** 엔진 동작 → 테스트룸 동작 번호. loop = 시간으로 도는 동작 (장/초), 나머지는 엔진 진행률로 장을 고른다 */
const MAP: Record<string, string> = {
  idle: '1', guard: '3', walk: '4', run: '5', jump: '7', land: '6',
  jab: '9', cross: '10', lowkick: '11', toss: '11', power: '12', dash: '13', airkick: '14',
  fire: '15', shotgun: '15', pipe: '12', evade: '16', block: '17', hit: '18', down: '19', getup: '20',
  blast: '22', chain: '22', wall: '22', groundblast: '22', grabblast: '22', charge: '23', super: '25',
  // pickup은 E(조사)마다 짧게 나와서 문 앞에서 허리를 굽히게 된다: 서 있기로 둔다
  eat: '26', drink: '26', bandage: '26', pickup: '1', crouch: '39', grab: '10', grabknee: '11',
  draw: 'W', holster: 'W', reload: 'W',
};
const LOOP_FPS: Record<string, number> = { '4': 11, '5': 15, '3': 8 };

function frameOf(id: string, m: Meta, f: number, total: number): number {
  const now = performance.now() / 1000;
  if (id === '1') return Math.floor(now / 0.6) % 2; // 평상 대기: 앞 두 장만 (마지막 장은 가슴이 너무 올라감, 사용자)
  if (LOOP_FPS[id]) return Math.floor(now * LOOP_FPS[id]) % m.n;
  return Math.max(0, Math.min(m.n - 1, Math.floor(((f + 0.5) / Math.max(1, total)) * m.n)));
}

function shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number, k: number) {
  c.fillStyle = `rgba(0,0,0,${0.36})`;
  c.beginPath();
  c.ellipse(x, y - 2 * k, Math.max(16, w) * 0.58 * k, 5 * k, 0, 0, Math.PI * 2);
  c.fill();
}

/** 주인공(에일린). clip·frame·total = 엔진 동작과 그 장(진행률). x,y = 발 가운데(월드), dir 1 = 오른쪽 */
export function drawTestPlayer(c: CanvasRenderingContext2D, clip: string, frame: number, total: number, x: number, y: number, dir: 1 | -1): boolean {
  if (!art) return false;
  const id = MAP[clip] ?? '1';
  const e = art.clips[id] ?? art.clips['1'];
  if (!e) return false;
  const { im, m } = e;
  const f = frameOf(id, m, frame, total);
  const k = spr(y) * charSize.k;
  const flip = m.dir === 'SW' ? dir > 0 : dir < 0;
  c.save();
  c.imageSmoothingEnabled = false;
  const ft = m.foot[f] ?? [0, 40];
  shadow(c, x + (flip ? -ft[0] : ft[0]) * k, y, Math.min(80, ft[1]), k);
  snapTo(c, x, y);
  c.scale(flip ? -k : k, k);
  c.drawImage(im, f * m.w, 0, m.w, m.h, -Math.round(m.w / 2), -(m.h - 4), m.w, m.h);
  c.restore();
  return true;
}

/** 서 있는 남자. dir 1 = 오른쪽 보기(원본) */
export function drawTestMan(c: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): boolean {
  if (!art) return false;
  const P = MAN_SCALE * spr(y) * charSize.k;
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.beginPath(); c.ellipse(x, y, 40 * P, 9 * P, 0, 0, Math.PI * 2); c.fill();
  snapTo(c, x, y);
  if (dir < 0) c.scale(-1, 1);
  c.drawImage(art.man, 0, 0, MAN.w, MAN.h, -MAN.fx * P, -MAN.fy * P, MAN.w * P, MAN.h * P);
  c.restore();
  return true;
}

/** 발 기준 머리 꼭대기 (화면 px, 음수, 원근 미포함 — 부르는 쪽이 persp를 곱한다) */
export const testPlayerTop = () => -(252 - 14) * charSize.k;
export const testManTop = () => -(MAN.fy - MAN.head) * MAN_SCALE * charSize.k;

/** 주인공 얼굴 칸: 평상 대기 첫 장의 머리·어깨 side×side (원본 1도트 = 1px) */
let face: HTMLCanvasElement | null = null;
export function testPlayerFace(side = 44): HTMLCanvasElement | null {
  const e = art?.clips['1'];
  if (!e) return null;
  if (face?.width === side) return face;
  face = document.createElement('canvas');
  face.width = face.height = side;
  const o = face.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  const cx = e.m.w / 2 + (e.m.cx[0] ?? 0);
  o.drawImage(e.im, cx - side / 2, 14 - 4, side, side, 0, 0, side, side);
  return face;
}
