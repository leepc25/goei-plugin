// 인물 팩(game-pack/char-<번호>/: 줄마다 WebP 무손실 시트 + char.json{cfg, A})과 공용 이펙트·의자 팩(game-pack/action-fx/)을 받는다.
// tools/build_char_packs.py 가 테스트룸 빌더(game-src/action/testroom3/build.py)의 측정값·설정을 그대로 옮겨 만든 것이라,
// 인물 엔진 fighter/core.ts 가 바로 쓴다(A = 줄 측정값, IMG = 시트, CH = 설정, VFX = 이펙트, CHAIR = 의자).
// 필드 생태계(hub.ts drawLiveActor)도 같은 그림으로 생활 클립을 그린다: 클립 이름(docs/필드_클립_이름_약속.md) ↔ 줄 번호는 아래 FIELD_CLIP.
import { snapTo, spr } from '../engine/view';
import { SEATS, SEAT_IDS, SEAT_LOOP, seatBody, seatFit, type SeatDir } from '../fighter/seats';

/** 줄(동작) 측정값. 테스트룸 build.py analyze 가 잰 것 (src 대신 file) */
export interface LineMeta {
  name: string; n: number; w: number; h: number; ox: number; oy: number; cw: number; ch: number;
  bot: number[]; top: number[]; reach: number[]; foot: number[][]; mz: number[]; cx: number[]; flash: number[]; ang: number[]; mbot: number[];
  floor: number; file: string;
}
export interface VfxMeta { frames: number[][]; pivot: number[]; file: string }
export type Vfx = VfxMeta & { img: HTMLImageElement };
/** 테스트룸 인물 설정(payload). 코어가 읽는 칸만 적고 나머지는 열어 둔다 */
export interface CharCfg {
  key: string; name: string; dir: string; color: string; armed?: boolean;
  picks?: Record<string, number>; loops?: Record<string, number[]>; hit?: Record<string, number>;
  gun?: string[]; kick?: string[]; ranged?: Record<string, unknown>; skills?: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}
export interface CharArt { key: string; cfg: CharCfg; A: Record<string, LineMeta>; IMG: Record<string, HTMLImageElement> }
export interface RosterRow { key: string; name: string; num: string; pack: string; color?: string; dir: string; armed?: boolean; npc: boolean; kb: number }

/** 주인공 그림 배율 (eileen/player.ts CHAR_K 와 같다: 맨 뒤 줄 키 1.65m = 235px) */
export const CHAR_K = 1.28;

type UrlOf = (pack: string, file: string) => Promise<string>;
type BytesOf = (pack: string, file: string) => Promise<Uint8Array | null>;
let io: { urlOf: UrlOf; bytesOf: BytesOf; ready: (pack: string) => Promise<boolean> } | null = null;
let fx: { VFX: Record<string, Vfx>; CHAIR: Record<string, HTMLImageElement>; roster: RosterRow[] } | null = null;
const chars = new Map<string, CharArt>();
const loading = new Map<string, Promise<CharArt | null>>();
let revision = 0;

async function img(src: string): Promise<HTMLImageElement> {
  if (!src) throw new Error('no image');
  const im = new Image(); im.src = src; await im.decode(); return im;
}
async function json<T>(pack: string, file: string): Promise<T | null> {
  const b = await io!.bytesOf(pack, file).catch(() => null);
  return b ? (JSON.parse(new TextDecoder().decode(b)) as T) : null;
}

/** 시작: 공용 이펙트·의자·명단(action-fx 팩). 인물은 고를 때 받는다 */
export function prepareCharPacks(assets?: { ready(p: string): Promise<boolean>; url: UrlOf; bytes: BytesOf }) {
  const own = ++revision;
  fx = null; chars.clear(); loading.clear(); faces.clear();
  if (!assets) return { ready: Promise.resolve(), dispose: () => {} };
  io = { urlOf: (p, f) => assets.url(p, f), bytesOf: (p, f) => assets.bytes(p, f), ready: (p) => assets.ready(p) };
  const ready = (async () => {
    if (!(await io!.ready('action-fx'))) return;
    const vm = (await json<Record<string, VfxMeta>>('action-fx', 'vfx.json')) ?? {};
    const roster = (await json<RosterRow[]>('action-fx', 'roster.json')) ?? [];
    const VFX: Record<string, Vfx> = {};
    await Promise.all(Object.entries(vm).map(async ([k, v]) => { try { VFX[k] = { ...v, img: await img(await io!.urlOf('action-fx', v.file)) }; } catch { /* 이 그림만 없음 */ } }));
    const CHAIR: Record<string, HTMLImageElement> = {};
    const dirs = ['south', 'south-east', 'south-west', 'east', 'west', 'north', 'north-east', 'north-west'];
    await Promise.all(dirs.flatMap((d) => [
      io!.urlOf('action-fx', `chair-${d}.webp`).then(img).then((im) => { CHAIR[d] = im; }, () => {}),
      io!.urlOf('action-fx', `chair2-${d}.webp`).then(img).then((im) => { CHAIR['C02:' + d] = im; }, () => {}),
    ]));
    if (revision === own) fx = { VFX, CHAIR, roster };
  })().catch((e) => { console.warn('[goei] action-fx 팩 없음', e); });
  return { ready, dispose: () => { if (revision === own) { revision++; fx = null; chars.clear(); loading.clear(); } } };
}

export const hasCharPacks = () => !!fx;
export const charRoster = (): RosterRow[] => fx?.roster ?? [];
export const charFx = () => fx;
/** 이름(쟈알디) 또는 키(1.1_쟈알디) → 명단 줄 */
export function rosterOf(nameOrKey: string): RosterRow | null {
  return fx?.roster.find((r) => r.key === nameOrKey || r.name === nameOrKey) ?? null;
}

/** 인물 팩 받기 (한 번 받으면 둔다). 팩이 없거나 아직 안 받았으면 null */
export function loadChar(nameOrKey: string): Promise<CharArt | null> {
  const r = rosterOf(nameOrKey);
  if (!r || !io) return Promise.resolve(null);
  const hit = chars.get(r.key);
  if (hit) return Promise.resolve(hit);
  let p = loading.get(r.key);
  if (!p) {
    const own = revision;
    p = (async () => {
      if (!(await io!.ready(r.pack))) return null;
      const d = await json<{ cfg: CharCfg; A: Record<string, LineMeta> }>(r.pack, 'char.json');
      if (!d) return null;
      const IMG: Record<string, HTMLImageElement> = {};
      await Promise.all(Object.entries(d.A).map(async ([id, m]) => { try { IMG[id] = await img(await io!.urlOf(r.pack, m.file)); } catch { delete d.A[id]; } }));
      const art: CharArt = { key: r.key, cfg: d.cfg, A: d.A, IMG };
      if (revision === own) chars.set(r.key, art);
      return art;
    })().catch((e) => { console.warn('[goei] 인물 팩 실패', r.key, e); return null; });
    loading.set(r.key, p);
  }
  return p;
}
/** 받아 둔 인물 (없으면 null, 받기 시작은 안 한다) */
export const charArt = (nameOrKey: string): CharArt | null => { const r = rosterOf(nameOrKey); return r ? chars.get(r.key) ?? null : null; };

/* ───────── 필드 생활 클립 (hub.ts) ───────── */

/** 필드 클립 이름(docs/필드_클립_이름_약속.md) → 테스트룸 줄 번호 후보(앞에서부터 있는 것). loop=false 는 한 번 재생 뒤 마지막 장 */
/** seq = ids 를 차례로 이어 튼다 (그 인물에게 있는 줄만, 끝나면 처음부터): 약공 연타 9→10→11→강 12 같은 훈련 */
export const FIELD_CLIP: Record<string, { ids: string[]; fps?: number; loop?: boolean; seq?: boolean }> = {
  idle: { ids: ['1'], fps: 1 / 0.6 },
  walk: { ids: ['4'], fps: 11 }, run: { ids: ['5_1', '5'], fps: 15 },
  work: { ids: ['124', '121'], fps: 6 },
  eat: { ids: ['26'], fps: 6 }, drink: { ids: ['142', '26'], fps: 6 },
  rest: { ids: ['2'], fps: 4 },
  pee: { ids: ['102', '101'], fps: 5 }, poo: { ids: ['102'], fps: 5 },
  hobby: { ids: ['90', '155', '2'], fps: 5 },
  talk: { ids: ['29'], fps: 7 },
  greet: { ids: ['28', '30'], fps: 7, loop: false }, bow: { ids: ['30'], fps: 7, loop: false },
  gesture: { ids: ['29'], fps: 7, loop: false }, nod: { ids: ['30'], fps: 7, loop: false }, shake: { ids: ['31'], fps: 7, loop: false },
  surprise: { ids: ['34', '33'], fps: 8, loop: false }, laugh: { ids: ['35'], fps: 7, loop: false }, angry: { ids: ['32'], fps: 7, loop: false },
  stretch: { ids: ['2'], fps: 5, loop: false }, sigh: { ids: ['2'], fps: 5, loop: false }, armcross: { ids: ['2'], fps: 5 }, think: { ids: ['2'], fps: 5 }, scratch: { ids: ['2'], fps: 5, loop: false },
  scared: { ids: ['41', '37'], fps: 7 }, flee: { ids: ['36'], fps: 12 }, cower: { ids: ['41'], fps: 7 },
  // 겁 반응(10-30 동작 활용표): 주저앉기 → 뒤로 기기, 뒷걸음질, 네발로 허둥지둥
  sitdown: { ids: ['39'], fps: 8, loop: false }, backoff: { ids: ['37_1', '37'], fps: 8 }, crawl: { ids: ['38_1', '38'], fps: 8 }, scramble: { ids: ['42_1', '42'], fps: 9 },
  // 걷다 잠깐 멈춰 하는 일(10-30 사람처럼 걷기, world/actors.ts PAUSES): 그 줄이 있는 인물만
  pushup: { ids: ['144'], fps: 6 },
  // 훈련장 장비(10-31): 샌드백·허수아비 = 약공 연타 → 강공 이어서, 사격대 = 원거리 공격
  strike: { ids: ['9', '10', '11', '12'], fps: 11, seq: true }, shoot: { ids: ['15'], fps: 9 },
  // 상호작용(10-31): 무전 보고·수첩 메모, 진료(의사)·치료받기
  radio: { ids: ['118'], fps: 5 }, memo: { ids: ['119'], fps: 5 }, exam: { ids: ['107', '108', '109', '110', '113'], fps: 5 }, treat: { ids: ['78', '76'], fps: 4 },
  // 훈련(욕구): 팔굽혀펴기 → 장비 점검 → 기지개 → 약공 연습(모든 인물에게 있음) 중 그 인물에게 있는 첫 줄
  train: { ids: ['144', '121', '143', '9'], fps: 6 },
  phone: { ids: ['147'], fps: 5 }, call: { ids: ['116'], fps: 5 }, coffee: { ids: ['142'], fps: 5 }, limber: { ids: ['143'], fps: 6, loop: false }, music: { ids: ['151'], fps: 6 },
  smoke: { ids: ['145', '90'], fps: 5 }, browse: { ids: ['168'], fps: 4 }, snack: { ids: ['157'], fps: 6 }, front: { ids: ['50'], fps: 1 / 0.6 }, back: { ids: ['57'], fps: 1 / 0.6 }, spot: { ids: ['33'], fps: 8, loop: false },
  down: { ids: ['19'], fps: 10, loop: false }, die: { ids: ['44'], fps: 9, loop: false }, dieLie: { ids: ['45'], fps: 6, loop: false }, getup: { ids: ['20'], fps: 9, loop: false },
  sit: { ids: ['60', '96', '61'], fps: 1 / 0.6 }, lie: { ids: ['76', '75'], fps: 4 },
};
/** 그 인물에게 그 클립 그림이 있나 (받아 둔 인물만 참). 필드 세계는 그림 있는 행동만 켠다 */
export function hasCharClip(nameOrKey: string, clip: string): boolean {
  const a = charArt(nameOrKey);
  if (!a) return false;
  // 의자에서 하는 일 (seat:<일>): 앉는 줄이 하나라도 있으면 앉을 수 있다 (그 일 줄이 없으면 앉아 숨쉬기)
  if (clip.startsWith('seat:')) return SEATS.some((s) => !!a.A[s.sit]);
  const m = FIELD_CLIP[clip];
  return !!m && m.ids.some((id) => !!a.A[id]);
}
export const charClips = (nameOrKey: string): string[] => Object.keys(FIELD_CLIP).filter((c) => hasCharClip(nameOrKey, c));

function shadow(c: CanvasRenderingContext2D, x: number, y: number, w: number, k: number) {
  c.fillStyle = 'rgba(0,0,0,0.36)';
  c.beginPath(); c.ellipse(x, y - 2 * k, Math.max(16, w) * 0.58 * k, 5 * k, 0, 0, Math.PI * 2); c.fill();
}

/** 생활 클립 그리기. x,y = 발 가운데(월드), dir 1 = 오른쪽 보기, now·since = ms. 그림 없으면 false (부르는 쪽이 실루엣) */
export function drawCharClip(c: CanvasRenderingContext2D, nameOrKey: string, x: number, y: number, dir: 1 | -1, now: number, clip = 'idle', since = 0): boolean {
  const a = charArt(nameOrKey);
  if (!a) return false;
  const cm = FIELD_CLIP[clip] ?? FIELD_CLIP.idle;
  if (cm.seq) {
    // 이어 틀기: 있는 줄들의 장을 한 줄로 늘어놓고 차례로
    const ids = cm.ids.filter((i) => !!a.A[i] && !!a.IMG[i]);
    const total = ids.reduce((n, i) => n + a.A[i].n, 0);
    if (total) {
      let k = Math.floor((now / 1000) * (cm.fps ?? 6)) % total;
      for (const i of ids) { if (k < a.A[i].n) { drawLine(c, a, i, k, x, y, dir); return true; } k -= a.A[i].n; }
    }
  }
  let id = cm.ids.find((i) => !!a.A[i]);
  let m = id ? a.A[id] : null;
  if (!m) { id = '1'; m = a.A['1']; if (!m) return false; }
  if (!a.IMG[id!]) return false;
  const loopIds = (a.cfg.loops ?? {})[id!];
  let f: number;
  if (id === '1') f = Math.floor(now / 600) % 2; // 평상 대기: 앞 두 장만 (테스트룸 규칙)
  else {
    const n = Math.floor(((now - (cm.loop === false ? since : 0)) / 1000) * (cm.fps ?? 6));
    if (cm.loop === false) f = Math.min(n, m.n - 1);
    else if (loopIds?.length && clip !== 'walk' && clip !== 'run') { const L = loopIds.map((v) => Math.max(0, Math.min(m!.n - 1, v - 1))); f = n < L[0] ? n : L[(n - L[0]) % L.length]; }
    else f = n % m.n;
  }
  f = Math.max(0, Math.min(m.n - 1, f));
  drawLine(c, a, id!, f, x, y, dir);
  return true;
}
/** 줄 하나의 한 장을 발 (x, y)에 그린다 (그림자 포함). 앉은 줄은 장마다 가장 낮은 점(발)을 땅에 (엔진 groundBase 와 같음) */
function drawLine(c: CanvasRenderingContext2D, a: CharArt, id: string, f: number, x: number, y: number, dir: 1 | -1, shade = true) {
  const m = a.A[id], im = a.IMG[id];
  if (!m || !im) return;
  const k = spr(y) * CHAR_K;
  const flip = (a.cfg.dir === 'W' || a.cfg.dir === 'SW') ? dir > 0 : dir < 0;
  // 땅 기준선: 테스트룸 BASE (캔버스 아래 4px, 그 줄의 가장 낮은 점이 더 위면 그 점)
  const base = SEAT_IDS.has(id) ? Math.min(m.h - 4, m.floor, m.bot[f] ?? m.floor) : Math.min(m.h - 4, m.floor);
  c.save();
  c.imageSmoothingEnabled = false;
  const ft = m.foot[f] ?? [0, 40];
  if (shade) shadow(c, x + (flip ? -ft[0] : ft[0]) * k, y, Math.min(80, ft[1]), k);
  snapTo(c, x, y);
  c.scale(flip ? -k : k, k);
  // 시트는 장마다 cw×ch 로 잘려 있고(ox, oy = 원본 128×256 안의 자리) — 코어 drawSprite 와 같은 식 (10-29: w 로 잘라 옆 장이 겹쳐 보이던 것)
  c.drawImage(im, f * m.cw, 0, m.cw, m.ch, -Math.round(m.w / 2) + m.ox, -base + m.oy, m.cw, m.ch);
  c.restore();
}

/** 지도 의자 (cx, cy)에 앉은 인물: 의자는 그 자리에, 사람은 이 인물 의자 맞춤값(chairs/<키>.json)만큼 옮겨 그린다 (주인공 엔진과 같은 규칙, fighter/seats.ts).
 * dir = 앉기 방향, face = 보는 쪽, kind = 앉아서 하는 일(talk·eat·type·doze…, 그 방향에 줄이 없으면 앉아 숨쉬기). 그림 없으면 false */
export function drawCharSeat(c: CanvasRenderingContext2D, nameOrKey: string, cx: number, cy: number, face: 1 | -1, now: number, dir: SeatDir, kind = ''): boolean {
  const a = charArt(nameOrKey);
  if (!a) return false;
  let row = SEATS.find((s) => s.dir === dir && a.A[s.sit] && !(dir === 'back' && a.cfg.noBackSit));
  if (!row) row = SEATS.find((s) => a.A[s.sit] && !(s.dir === 'back' && a.cfg.noBackSit));
  if (!row) return false;
  const act = row.acts[kind];
  const id = act && a.A[act] ? act : row.sit;
  const m = a.A[id];
  let f: number;
  if (id === row.sit) f = m.n - 1;   // 앉아 있기: 앉는 줄 마지막 장
  else {
    const n = Math.floor((now / 1000) * 6), L = ((a.cfg.loops ?? {})[id] ?? []).map((v) => Math.max(0, Math.min(m.n - 1, v - 1)));
    f = SEAT_LOOP.has(id) && L.length ? (n < L[0] ? n % m.n : L[(n - L[0]) % L.length]) : n % m.n;
  }
  const fit = seatFit(a.cfg as never, row.dir, id);
  const k = spr(cy) * CHAR_K;
  const body = seatBody(cx, cy, face, fit, k);
  const im = charFx()?.CHAIR[fit.img || row.img] ?? charFx()?.CHAIR[row.img];
  const chair = () => {
    if (!im?.complete) return;
    c.save(); c.imageSmoothingEnabled = false; c.translate(Math.round(cx), Math.round(cy)); c.scale(face * k * fit.s, k * fit.s); c.drawImage(im, -100, -171); c.restore();
  };
  if (row.dir !== 'back') chair();
  drawLine(c, a, id, f, body.x, body.y, face, false);
  if (row.dir === 'back') chair();
  return true;
}
/** 발 기준 머리 꼭대기 (화면 px, 음수, 원근 미포함) */
export function charTop(nameOrKey: string): number {
  const a = charArt(nameOrKey), m = a?.A['1'];
  return m ? -(Math.min(m.h - 4, m.floor) - (m.top[0] ?? 14)) * CHAR_K : -(252 - 14) * CHAR_K;
}
/** 얼굴 칸(네임텍·초상): 고개 젓기 첫 장(없으면 평상 대기) 머리 부분 */
const faces = new Map<string, HTMLCanvasElement>();
export function charFace(nameOrKey: string, side = 44, flip = false): HTMLCanvasElement | null {
  const a = charArt(nameOrKey);
  const id = a?.A['31'] ? '31' : '1';
  const m = a?.A[id];
  if (!a || !m) return null;
  const key = `${a.key}|${side}|${flip}`, hit = faces.get(key);
  if (hit) return hit;
  const face = document.createElement('canvas');
  faces.set(key, face);
  face.width = face.height = side;
  const o = face.getContext('2d')!;
  o.imageSmoothingEnabled = false;
  // 얼굴 가운데 = 몸 중심에서 보는 쪽으로 6도트, 머리 꼭대기에서 조금 아래부터 (시트 좌표 = 원본 좌표 − ox/oy)
  const fx0 = m.w / 2 + (m.cx[0] ?? 0) + (a.cfg.dir === 'W' || a.cfg.dir === 'SW' ? -6 : 6) - m.ox;
  const top = (m.top[0] ?? 14) - m.oy;
  if (flip) { o.translate(side, 0); o.scale(-1, 1); }
  o.drawImage(a.IMG[id], Math.round(fx0 - side / 2), Math.max(0, top + 2), side, side, 0, 0, side, side);
  return face;
}
