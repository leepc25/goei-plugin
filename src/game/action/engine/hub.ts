// 본부 걷는 화면: 엔진 벨트 장면 (docs/본부_설계_2판.md).
// 건물 지도(장면·문·엘리베이터·자리·집기 상자)는 본부 모듈 map()이 주고, 엔진은 걷기·막기·그리기·장면 옮기기만 한다.
// 장면 하나 = 방 하나 또는 복도 하나. 북쪽 벽 문은 벽 앞(깊이 위쪽)에서, 화면 아래 출입은 아래쪽 끝에서 E.
// 문은 열리는 그림이 나온 뒤 잠깐 암전, 엘리베이터는 층 단추, 자리 앞 E는 본부 메뉴 창 또는 그 자리 동작.
// 집기는 바닥 위 상자(앞면 + 윗면)로 몸과 깊이 순서로 섞여 그려지고, 몸은 상자를 뚫고 지나가지 못한다.
// 방 그림(GPT 전체 그림 + 앞 레이어)이 오기 전까지는 같은 자리·크기의 색 상자로 그린다.
// 화면에 방 이름·층·잠김 이유 같은 글씨를 쓰지 않는다.
import type { Player } from './player';
import type { FloorPlan, StageApi, StageModule, WorldView } from './contract';
import { SCREEN_H, SCREEN_W } from './contract';
import { HQ_PLACE, drawFloor, drawHqWall, drawPropArt, drawHqTextureWall } from '../art/bg';
import { drawStartRoom, drawStartRoomFurniture } from '../art/startRoom';
import { drawHqDoorRound2 } from '../art/hqDoorRound2';
import { drawVisitAgent, visitAgentTop } from '../art/visitAgents';
import { drawTestMan, hasTestPeople, testManTop, testPlayerTop } from '../art/testPeople';
import { persp, view as fieldView } from './view';
import { blockByProps, clearSpot, type BlockProp } from './propBlock';
import { LANE_BOT, LANE_TOP, type HqBox, type HqDoor, type HqMapView, type HqScene, type HqSpot } from '../hq/map';

type Door = HqDoor & { open: boolean };
type Spot = HqSpot & { open: boolean };
type Scene = Omit<HqScene, 'doors' | 'spots'> & { doors: Door[]; spots: Spot[] };

export interface HubHost {
  map(): HqMapView;
  openPlace(id: string): void;
  bark(place: string): { who: string; text: string } | null;
  /** 엘리베이터 층 단추. pick(i) 또는 취소(null) */
  chooseFloor(opts: { label: string; open: boolean; here: boolean }[], pick: (i: number | null) => void): void;
  sfx(name: string): void;
  /** 메뉴·대화창이 떠 있나 */
  busy?(): boolean;
  /** 자리 동작(앉기·눕기…) 클립 순서. 플레이어 동작 재생이 붙으면 여기로 */
  act?(seq: string[], face: 1 | -1 | undefined): void;
  /** 본부 방문: 이 장면에 서 있는 요원 (상태 태그로 정한 방). 발 위치와 보는 쪽 */
  visitors?(sceneId: string): { name: string; x: number; y: number; face: 1 | -1 }[];
  /** 장면 맨 위에 그리기 (월드 좌표): 이름표·말풍선. people = 이 방 요원, player = 주인공 발 */
  overlay?(c: CanvasRenderingContext2D, people: { name: string; x: number; y: number; top: number }[], player: { name: string; x: number; y: number; top: number }): void;
}

const TOP = 440;
const LANE: [number, number] = [LANE_TOP, LANE_BOT];
const DOOR_H = 250;
const FADE = 8;
/** 문 열리는 그림 길이(틱) */
const OPEN_T = 9;
const DOOR_W: Record<Door['kind'], number> = { main: 190, door: 120, glass: 160, steel: 120, security: 120, elevator: 160, stairs_up: 120, stairs_down: 120, shop: 130, slide: 170, cell: 150, exit: 150 };

export type Hub = StageModule & { goto(place: string): void; jump(sceneId: string, x?: number, y?: number): void; sceneIds(): string[]; current(): HqScene | null };

const isS = (d: HqDoor) => d.side === 'S';
const doorY = (d: HqDoor, lane: [number, number] = LANE) => (isS(d) ? lane[1] - 14 : lane[0] + 16);

export function makeHub(host: HubHost, whereIs: (place: string) => { scene: string; x: number; y?: number }): Hub {
  let view: HqMapView | null = null;
  let scene: Scene | null = null;
  let artDoors = new Set<string>();
  let pending: { scene: string; x: number; y?: number } | null = null;
  let arrive: { x: number; y?: number } | null = null;
  let enterTick = -1;
  let fadeOut = 0;
  let barked: string | null = null;
  let opening: { id: string; t: number; then: () => void } | null = null;
  let near: string | null = null;
  let solids: BlockProp[] = [];

  const sceneOf = (id: string): Scene => view!.scenes.find((s) => s.id === id) ?? view!.scenes[0];
  const openOf = (id: string) => (opening && opening.id === id ? Math.min(1, opening.t / OPEN_T) : 0);

  const build = (id: string, x: number, y?: number): FloorPlan => {
    view = host.map();
    const base = sceneOf(id);
    // 방문 요원은 그 방의 자리(대화 상대)로 붙인다: E → 대화창 (npcLink hubTalk → visit)
    const people = (host.visitors?.(base.id) ?? []).map((p) => {
      const at = clearSpot(p.x, p.y, base.boxes.filter((b) => b.solid).map((b) => ({ x: b.x, y: b.y, w: b.w, back: b.d + 6, front: 8 })), base.lane ?? LANE);
      return { ...p, x: at.x, y: at.y };
    });
    const sc: Scene = { ...base, spots: [...base.spots, ...people.map((p) => ({ id: `visit:${p.name}`, x: p.x, y: p.y, who: p.name, verb: '대화', face: p.face, open: true }))] };
    scene = sc;
    barked = null;
    enterTick = -1;
    opening = null;
    near = null;
    // 필드 시험: 사무실에 서 있는 남자 (임시)
    const man = sc.id === 'office' && hasTestPeople() ? { x: 900, y: 560 } : null;
    solids = [...(man ? [{ x: man.x, y: man.y, w: 70, back: 20, front: 20 }] : []), ...sc.boxes.filter((b) => b.solid).map((b) => ({ x: b.x, y: b.y, w: b.w, back: b.d + 6, front: 8 })), ...people.map((p) => ({ x: p.x, y: p.y, w: 80, back: 24, front: 24 }))];
    const len = Math.max(SCREEN_W, sc.length);
    const sx = Math.max(60, Math.min(len - 60, x));
    arrive = { x: sx, y };
    const place = HQ_PLACE[sc.id] ?? HQ_PLACE[sc.look] ?? 'hq_office';
    return {
      id: `hq:${sc.id}`,
      title: sc.name,
      type: 'hq',
      length: len,
      lane: sc.lane ?? LANE,
      startX: sx,
      exitX: Infinity,
      props: [],
      encounters: [],
      depthLayers: sc.boxes.map((b) => ({ y: sc.id === 'office' && b.kind === 'chair' ? 495 : b.y, occludedSilhouette: sc.id !== 'office', x0: sc.id === 'office' ? 180 : b.x - b.w / 2, x1: sc.id === 'office' ? 560 : b.x + b.w / 2, draw: (c: CanvasRenderingContext2D) => {
        if (sc.id === 'office') { drawStartRoomFurniture(c, b.kind); return; }
        drawBox(c, b, sc.look);
      } })).concat(people.map((p) => ({ y: p.y, x0: p.x - 60, x1: p.x + 60, occludedSilhouette: false, draw: (c: CanvasRenderingContext2D) => { drawVisitAgent(c, p.name, p.x, p.y, p.face, performance.now()); } })))
        .concat(man ? [{ y: man.y, x0: man.x - 60, x1: man.x + 60, occludedSilhouette: false, draw: (c: CanvasRenderingContext2D) => { drawTestMan(c, man.x, man.y, -1); } }] : []),
      drawBackground(c: CanvasRenderingContext2D, camX: number) {
        if (sc.id === 'office' && drawStartRoom(c, openOf('out'))) return;
        if (sc.legacy) {
          const cov = drawHqWall(c, place, sc.id, len, TOP, sc.doors);
          artDoors = cov ?? new Set();
          c.fillStyle = 'rgba(0,0,0,0.35)';
          c.fillRect(camX - 40, TOP - 14, SCREEN_W + 80, 14);
          if (!drawFloor(c, place, camX - 40, camX + SCREEN_W + 40, TOP, SCREEN_H)) {
            c.fillStyle = '#2b3135';
            c.fillRect(camX - 40, TOP, SCREEN_W + 80, SCREEN_H - TOP);
          }
          for (const t of sc.things) if (t.wall) legacyThing(c, t, camX);
          for (const d of sc.doors) if (!artDoors.has(d.id)) legacyDoor(c, d, camX);
          for (const t of sc.things) if (!t.wall) legacyThing(c, t, camX);
          return;
        }
        drawRoomShell(c, sc, camX);
        const textured = (sc.id === 'office' || sc.id === 'f2') && drawHqTextureWall(c, place, len, camX, sc.doors.filter(d => !isS(d)).map(d => ({ x: d.x, width: d.kind === 'glass' ? 192 : DOOR_W[d.kind] + 24 })));
        if (sc.id === 'office' || sc.id === 'f2') drawFloor(c, place, camX - 40, camX + SCREEN_W + 40, TOP, SCREEN_H);
        for (const f of sc.fixtures) {
          // Windows/boards are already painted in the wall tiles; keep functional signage.
          if (!textured || f.kind === 'directory') drawFixture(c, f, sc.look, camX);
        }
        for (const d of sc.doors) if (!isS(d)) {
          if (sc.id === 'f2' && d.id === 'office' && d.kind === 'glass' && drawHqDoorRound2(c, d.x, openOf(d.id), d.open)) continue;
          drawDoorN(c, d, sc.look, openOf(d.id), camX);
        }
        for (const d of sc.doors) if (isS(d)) drawFloorExit(c, d, openOf(d.id), camX);
      },
      drawForeground(c: CanvasRenderingContext2D, camX: number, w: WorldView) {
        // 시계는 실제 시간(틱 단위로 환산): 메뉴·정산 창이 열려 월드가 멈춰도 들어오는 암전은 끝난다
        const now = performance.now();
        if (enterTick < 0) enterTick = now;
        const age = (now - enterTick) / (1000 / 30);
        if (!sc.legacy) for (const d of sc.doors) if (isS(d)) drawExitLintel(c, d, camX);
        // 주인공 그림은 쟈알디 그림이라 머리 높이도 쟈알디 기준
        // 말풍선·이름표는 화면 px 그대로 (필드 zoom을 되돌려 글자 도트가 고르게). top은 원근까지 곱한 화면 px
        const z = fieldView.zoom;
        c.save();
        c.scale(1 / z, 1 / z);
        host.overlay?.(c, people.map((p) => ({ name: p.name, x: p.x * z, y: p.y * z, top: visitAgentTop(p.name) * persp(p.y) })), { name: '', x: w.player.x * z, y: w.player.y * z, top: (hasTestPeople() ? testPlayerTop() : visitAgentTop('쟈알디')) * persp(w.player.y) });
        c.restore();
        // 출입 표식과 잠금 이유는 render.ts / HUD가 같은 조사 대상으로 표시한다.
        const dark = fadeOut > 0 ? 1 - fadeOut / FADE : age < FADE ? 1 - age / FADE : 0;
        if (dark > 0) {
          c.fillStyle = `rgba(0,0,0,${dark})`;
          c.fillRect(camX - 40, 0, SCREEN_W + 80, SCREEN_H); // 이 그림판은 이미 -camX 만큼 옮겨져 있다
        }
      },
    };
  };

  const go = (sceneId: string, x: number, y?: number) => {
    pending = { scene: sceneId, x, y };
    fadeOut = FADE;
  };
  const arriveAt = (sceneId: string, doorId?: string) => {
    const d = sceneOf(sceneId).doors.find((q) => q.id === doorId);
    return d ? { x: d.x, y: sceneOf(sceneId).legacy ? undefined : doorY(d, sceneOf(sceneId).lane ?? LANE) } : { x: 200, y: undefined };
  };
  const goDoor = (sceneId: string, doorId?: string) => {
    const t = arriveAt(sceneId, doorId);
    go(sceneId, t.x, t.y);
  };

  /** 지금 서 있는 자리에서 E가 닿는 문·자리 하나 */
  const target = (px: number, py: number): { id: string; kind: 'hubdoor' | 'hubspot'; x: number } | null => {
    if (!scene) return null;
    let best: { id: string; kind: 'hubdoor' | 'hubspot'; x: number; d: number } | null = null;
    const consider = (id: string, kind: 'hubdoor' | 'hubspot', x: number, ok: boolean) => {
      const d = Math.abs(x - px);
      if (ok && (!best || d < best.d)) best = { id, kind, x, d };
    };
    // 자리 먼저: 같은 거리면 자리(격리문 앞 전시 등)가 이긴다
    for (const s of scene.spots) {
      if (!s.open) continue;
      const ok = Math.abs(s.x - px) < (s.y === undefined ? 60 : 75) && (s.y === undefined || Math.abs(s.y - py) < 55);
      consider(`spot:${s.id}`, 'hubspot', s.x, ok);
    }
    for (const d of scene.doors) {
      const reach = Math.abs(d.x - px) < (scene.legacy ? 60 : 75);
      const lane = scene.lane ?? LANE;
      const depth = scene.legacy || (isS(d) ? py > lane[1] - 60 : py < lane[0] + 75);
      consider(`door:${d.id}`, 'hubdoor', d.x, reach && depth);
    }
    return best;
  };

  return {
    id: 'hq',
    label: '본부',
    firstFloor: () => {
      const v = host.map();
      view = v;
      const s = pending ?? v.start;
      pending = null;
      fadeOut = 0;
      return build(s.scene, s.x, s.y);
    },
    nextFloor: () => {
      const s = pending ?? { scene: scene?.id ?? 'office', x: 400 };
      pending = null;
      return build(s.scene, s.x, s.y);
    },
    tick(a: StageApi) {
      if (fadeOut > 0 && --fadeOut === 0 && pending) {
        if (pending.scene === scene?.id) {
          arrive = { x: pending.x, y: pending.y };
          pending = null;
          enterTick = -1;
        } else return a.finish('next');
      }
      const p = a.world.player as WorldView['player'] & { px?: number };
      // 들어온 자리: 문 앞 깊이에, 집기와 겹치면 비켜서
      if (arrive) {
        const y = arrive.y ?? p.y;
        const at = clearSpot(arrive.x, y, solids, scene?.lane ?? LANE);
        a.movePlayer(at.x, at.y);
        arrive = null;
      }
      if (opening && opening.t < OPEN_T && ++opening.t === OPEN_T) {
        const then = opening.then;
        opening.t = OPEN_T;
        then();
      }
      if (solids.length && !(p as Player).seat) blockByProps([p as never], solids, scene?.lane ?? LANE);
      // E가 닿는 것 하나만 엔진 소품으로 (엔진은 x 거리만 보므로 깊이는 여기서 고른다)
      const t = (p as Player).seat ? null : target(p.x, p.y);
      const id = t?.id ?? null;
      if (id !== near) {
        if (near) a.setProp(near, null);
        if (t) a.setProp(t.id, { kind: t.kind, x: p.x, y: p.y, w: 40, h: 10 });
        near = id;
      } else if (t) a.setProp(t.id, { x: p.x, y: p.y });
      // 자리에 가까이 가면 주인 목소리 한 줄 (자막)
      const sp = scene?.spots.find((s) => s.open && s.who && s.place && Math.abs(s.x - p.x) < 170);
      if (sp && sp.place !== barked) {
        barked = sp.place!;
        const l = host.bark(sp.place!);
        if (l) a.world.say(`${l.who}: ${l.text}`, 3.5);
      } else if (!sp) barked = null;
    },
    onInteract(a, _floor, prop) {
      if (!scene || fadeOut > 0 || opening) return;
      if (prop.kind === 'hubspot') {
        const s = scene.spots.find((q) => `spot:${q.id}` === prop.id);
        if (!s?.open) return;
        if (s.place) return host.openPlace(s.place);
        if (s.seat && s.act?.[0]) {
          const exit = clearSpot(s.x, s.y ?? a.world.player.y, solids, scene.lane ?? LANE);
          (a.world.player as Player).sit(s.act[0], s.seat.x, s.seat.y, s.face ?? 1, exit);
          return;
        }
        // 자리 동작: 그 자리에 서서 보는 쪽을 맞춘다 (생활 클립 재생은 host.act)
        if (s.y !== undefined) a.movePlayer(s.x, s.y);
        if (s.face) (a.world.player as { dir: 1 | -1 }).dir = s.face;
        if (s.act) host.act?.(s.act, s.face);
        return;
      }
      if (prop.kind !== 'hubdoor') return;
      const d = scene.doors.find((q) => `door:${q.id}` === prop.id);
      if (!d) return;
      if (!d.open) return host.sfx('knock');
      if (d.kind === 'elevator') {
        const here = scene.id;
        const opts = view!.elevator.map((e) => ({ label: e.label, open: e.open, here: e.scene === here }));
        host.chooseFloor(opts, (i) => {
          if (i == null) return;
          const e = view!.elevator[i];
          if (!e?.open || e.scene === here) return;
          host.sfx('ding');
          opening = { id: d.id, t: 0, then: () => goDoor(e.scene, e.door) };
        });
        return;
      }
      if (!d.to) return;
      const to = d.to,
        toDoor = d.toDoor;
      host.sfx(d.kind === 'steel' || d.kind === 'security' || d.kind === 'cell' ? 'doorSlam' : d.kind.startsWith('stairs') ? 'stepConcrete' : 'doorOpen');
      if (scene.legacy) return goDoor(to, toDoor);
      opening = { id: d.id, t: 0, then: () => goDoor(to, toDoor) };
    },
    /** 검사·스크린샷용: 장면으로 바로 */
    jump(sceneId: string, x = 400, y?: number) {
      if (view) go(sceneId, x, y);
    },
    sceneIds: () => (view ?? host.map()).scenes.map((s) => s.id),
    current: () => scene,
    goto(place: string) {
      if (!view) return;
      const t = whereIs(place);
      go(t.scene, t.x, t.y);
    },
  };
}

/* ───────── 임시 그림: 방 껍데기·벽 붙박이·문·집기 상자 (GPT 방 그림이 오면 바뀐다) ───────── */

type Look = { wallTop: string; wallBot: string; band: string; light: string; floorA: string; floorB: string; dim?: number; tiles?: boolean; panels?: boolean };
const LOOKS: Record<string, Look> = {
  // 지상: 짙은 남색·숯색 벽, 호두나무 판, 천장 간접 조명, 밝은 회색 바닥
  office: { wallTop: '#1f2836', wallBot: '#2c3a4d', band: '#5e4330', light: '#cfe4ff', floorA: '#8f99a5', floorB: '#848e9a' },
  hall: { wallTop: '#1f2733', wallBot: '#2a3544', band: '#4d3a2c', light: '#cfe4ff', floorA: '#7f8994', floorB: '#76808b' },
  lobby: { wallTop: '#24262b', wallBot: '#34373e', band: '#6a5644', light: '#ffe9c4', floorA: '#8d8a84', floorB: '#83807a' },
  life: { wallTop: '#2a3039', wallBot: '#3b4450', band: '#6a5240', light: '#ffe6c2', floorA: '#9a8a74', floorB: '#8f7f69' },
  bath: { wallTop: '#7f919b', wallBot: '#9fb1ba', band: '#3f5260', light: '#fff4dc', floorA: '#b2bcc1', floorB: '#a6b0b5', tiles: true },
  // 지하: 흰 패널, 청록 빛줄 (복도는 반쯤만 불)
  lab: { wallTop: '#aab4bb', wallBot: '#c3cbd0', band: '#2f3a42', light: '#45d6de', floorA: '#9aa3a9', floorB: '#8f989e', panels: true },
  labhall: { wallTop: '#aab4bb', wallBot: '#c3cbd0', band: '#2f3a42', light: '#45d6de', floorA: '#9aa3a9', floorB: '#8f989e', panels: true, dim: 0.5 },
};

function drawRoomShell(c: CanvasRenderingContext2D, sc: Scene, camX: number) {
  const L = LOOKS[sc.look] ?? LOOKS.office;
  const x0 = camX - 40,
    w = SCREEN_W + 80;
  const g = c.createLinearGradient(0, 0, 0, TOP);
  g.addColorStop(0, L.wallTop);
  g.addColorStop(1, L.wallBot);
  c.fillStyle = g;
  c.fillRect(x0, 0, w, TOP);
  // 천장 띠와 간접 조명 줄
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(x0, 0, w, 24);
  c.fillStyle = L.light;
  c.globalAlpha = 0.55;
  c.fillRect(x0, 24, w, 4);
  c.globalAlpha = 1;
  if (L.tiles) {
    c.strokeStyle = 'rgba(40,60,70,0.25)';
    c.lineWidth = 1;
    for (let y = 60; y < TOP - 50; y += 36) {
      c.beginPath();
      c.moveTo(x0, y);
      c.lineTo(x0 + w, y);
      c.stroke();
    }
    for (let x = Math.floor(x0 / 36) * 36; x < x0 + w; x += 36) {
      c.beginPath();
      c.moveTo(x, 40);
      c.lineTo(x, TOP - 50);
      c.stroke();
    }
  }
  if (L.panels) {
    c.fillStyle = 'rgba(30,40,48,0.18)';
    for (let x = Math.floor(x0 / 240) * 240; x < x0 + w; x += 240) c.fillRect(x, 28, 3, TOP - 28);
    c.fillStyle = L.light;
    c.globalAlpha = 0.8;
    c.fillRect(x0, TOP - 92, w, 5);
    c.globalAlpha = 1;
  }
  // 걸레받이 판
  c.fillStyle = L.band;
  c.fillRect(x0, TOP - 44, w, 44);
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.fillRect(x0, TOP - 44, w, 3);
  // 바닥: 깊이 줄무늬 (앞으로 올수록 넓게)
  c.fillStyle = L.floorA;
  c.fillRect(x0, TOP, w, SCREEN_H - TOP);
  c.fillStyle = L.floorB;
  for (let i = 0, y = TOP; y < SCREEN_H; i++) {
    const hgt = 18 + i * 6;
    if (i % 2) c.fillRect(x0, y, w, hgt);
    y += hgt;
  }
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(x0, TOP, w, 10);
  if (L.dim) {
    c.fillStyle = `rgba(6,10,16,${L.dim})`;
    c.fillRect(x0, 0, w, SCREEN_H);
  }
}

function drawFixture(c: CanvasRenderingContext2D, f: Scene['fixtures'][number], look: string, camX: number) {
  const x = f.x - f.w / 2;
  if (x > camX + SCREEN_W + 40 || x + f.w < camX - 40) return;
  switch (f.kind) {
    case 'window': {
      // 통창: 장막 안의 텅 빈 종로 밤
      const y = 70,
        h = TOP - 150;
      c.fillStyle = '#0d1522';
      c.fillRect(x, y, f.w, h);
      c.fillStyle = '#1a2638';
      for (let i = 0; i * 70 < f.w; i++) {
        const bh = 90 + ((i * 53) % 110);
        c.fillRect(x + i * 70 + 8, y + h - bh, 52, bh);
      }
      c.fillStyle = 'rgba(255,214,140,0.35)';
      for (let i = 0; i * 70 < f.w; i++) if (i % 3 === 1) c.fillRect(x + i * 70 + 22, y + h - 60, 10, 12);
      c.strokeStyle = '#8193a8';
      c.lineWidth = 6;
      c.strokeRect(x, y, f.w, h);
      c.lineWidth = 3;
      for (let i = 1; i * 230 < f.w; i++) {
        c.beginPath();
        c.moveTo(x + i * 230, y);
        c.lineTo(x + i * 230, y + h);
        c.stroke();
      }
      break;
    }
    case 'screen': {
      const y = 90,
        h = 190;
      c.fillStyle = '#0e2a3a';
      c.fillRect(x, y, f.w, h);
      c.strokeStyle = '#24465a';
      c.lineWidth = 8;
      c.strokeRect(x, y, f.w, h);
      c.strokeStyle = '#4fd1e0';
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i <= 12; i++) c[i ? 'lineTo' : 'moveTo'](x + 30 + (i * (f.w - 60)) / 12, y + h - 50 - Math.abs(Math.sin(i * 1.7)) * (h - 100));
      c.stroke();
      c.fillStyle = '#ff9b52';
      for (let i = 1; i < 4; i++) c.fillRect(x + (i * f.w) / 4 - 7, y + 60 + ((i * 37) % 70), 14, 14);
      break;
    }
    case 'shower': {
      c.fillStyle = '#c9d2d8';
      c.fillRect(f.x - 4, 100, 8, TOP - 200);
      c.fillRect(f.x - 4, 100, 46, 8);
      c.fillStyle = '#e8edf0';
      c.fillRect(f.x + 26, 104, 34, 14);
      c.fillStyle = '#9aa6ad';
      c.fillRect(f.x - 14, TOP - 160, 28, 10);
      break;
    }
    case 'glass': {
      const y = 80,
        h = TOP - 170;
      c.fillStyle = look === 'bath' ? 'rgba(235,242,246,0.75)' : '#11202a';
      c.fillRect(x, y, f.w, h);
      if (look !== 'bath') {
        c.fillStyle = 'rgba(69,214,222,0.18)';
        c.fillRect(x, y, f.w, h);
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.beginPath();
        c.ellipse(f.x, y + h - 40, 60, 110, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = look === 'bath' ? '#8fa1ab' : '#d6dde2';
      c.lineWidth = 8;
      c.strokeRect(x, y, f.w, h);
      break;
    }
    case 'blinds': {
      const y = 80,
        h = TOP - 170;
      c.fillStyle = '#d9c9a8';
      c.fillRect(x, y, f.w, h);
      c.fillStyle = 'rgba(90,70,50,0.25)';
      for (let yy = y + 8; yy < y + h; yy += 14) c.fillRect(x, yy, f.w, 3);
      c.fillStyle = 'rgba(255,214,150,0.35)';
      c.beginPath();
      c.ellipse(f.x + f.w / 3, TOP - 40, 120, 30, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'shelfwall': {
      const y = 60,
        h = TOP - 104;
      c.fillStyle = '#3a3026';
      c.fillRect(x, y, f.w, h);
      c.fillStyle = 'rgba(160,200,215,0.25)';
      for (let i = 0; i * 120 < f.w; i++) c.fillRect(x + i * 120 + 8, y + 8, 104, h - 16);
      c.fillStyle = '#d8d0bd';
      for (let i = 0; i * 120 < f.w; i++) for (let r = 0; r < 4; r++) c.fillRect(x + i * 120 + 16, y + 20 + r * ((h - 40) / 4), 88, 14);
      break;
    }
    case 'directory': {
      // 계단 옆 이정표: 층마다 색 띠 + 그림 기호 (글씨 없음)
      const y = 150,
        h = 220;
      c.fillStyle = '#14191f';
      c.fillRect(x, y, f.w, h);
      const cols = ['#4f8fd6', '#d9a441', '#3cc596', '#9a6be0'];
      cols.forEach((col, i) => {
        c.fillStyle = col;
        c.fillRect(x + 10, y + 12 + i * 51, f.w - 20, 40);
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(x + 20, y + 22 + i * 51, 20, 20);
      });
      c.strokeStyle = '#9aa6b0';
      c.lineWidth = 4;
      c.strokeRect(x, y, f.w, h);
      break;
    }
    default:
      break;
  }
}

function drawDoorN(c: CanvasRenderingContext2D, d: Door, look: string, open: number, camX: number) {
  const w = DOOR_W[d.kind];
  const x = d.x - w / 2,
    y = TOP - DOOR_H;
  if (x > camX + SCREEN_W + 40 || x + w < camX - 40) return;
  c.fillStyle = '#12161b';
  c.fillRect(x - 10, y - 12, w + 20, DOOR_H + 12);
  c.fillStyle = '#05070a';
  c.fillRect(x, y, w, DOOR_H);
  const panels = (col: string, hl: string) => {
    const off = (w / 2) * open;
    c.fillStyle = col;
    c.fillRect(x - off, y, w / 2, DOOR_H);
    c.fillRect(x + w / 2 + off, y, w / 2, DOOR_H);
    c.fillStyle = hl;
    c.fillRect(x - off + 8, y + 10, 5, DOOR_H - 20);
    c.fillRect(x + w / 2 + off + 8, y + 10, 5, DOOR_H - 20);
  };
  c.save();
  c.beginPath();
  c.rect(x, y, w, DOOR_H);
  c.clip();
  switch (d.kind) {
    case 'stairs_up':
    case 'stairs_down': {
      c.fillStyle = '#2c333a';
      const up = d.kind === 'stairs_up';
      for (let i = 0; i < 8; i++) {
        const sy = up ? TOP - 18 - i * 28 : y + 30 + i * 28;
        c.fillRect(x + (up ? i * 8 : 0), sy, w - (up ? i * 8 : 0), 8);
      }
      break;
    }
    case 'elevator':
      panels('#9aa5ac', 'rgba(255,255,255,0.25)');
      break;
    case 'glass':
      panels('rgba(150,190,210,0.45)', 'rgba(255,255,255,0.35)');
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.fillRect(x, y + 110, w, 26); // 젖빛 띠
      break;
    case 'slide':
      panels('#d9e0e4', 'rgba(69,214,222,0.6)');
      break;
    case 'cell':
      panels('#59626a', 'rgba(0,0,0,0.2)');
      break;
    default:
      panels('#6e7a83', 'rgba(255,255,255,0.15)');
  }
  c.restore();
  // 상태 등·호출 단추
  if (d.kind === 'elevator') {
    c.fillStyle = '#ffb34a';
    c.fillRect(d.x - 16, y - 34, 32, 12);
  }
  if (d.kind === 'slide' || d.kind === 'cell') {
    c.fillStyle = d.kind === 'cell' ? '#e0b43a' : d.open ? '#45d6de' : '#e0443a';
    c.fillRect(x + w + 14, y + 100, 12, 12);
  }
  if (!d.open && d.kind !== 'cell') {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x, y, w, DOOR_H);
  }
  void look;
}

/** 화면 아래 출입: 바닥 끝에 빛 띠 + 아래로 가는 화살표 (사용자: 문 자리에 나가는 표시) */
function drawFloorExit(c: CanvasRenderingContext2D, d: Door, open: number, camX: number) {
  const w = DOOR_W.exit;
  if (d.x + w < camX - 40 || d.x - w > camX + SCREEN_W + 40) return;
  const col = d.kind === 'cell' ? '#7d4a3a' : d.open ? '#3cc596' : '#6b7480';
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(d.x - w / 2 - 10, SCREEN_H - 36, w + 20, 36);
  c.fillStyle = col;
  c.globalAlpha = 0.55 + 0.45 * open;
  c.fillRect(d.x - w / 2, SCREEN_H - 14, w, 8);
  c.globalAlpha = 1;
}
function drawExitLintel(c: CanvasRenderingContext2D, d: Door, camX: number) {
  if (d.kind === 'cell') return;
  if (d.x < camX - 200 || d.x > camX + SCREEN_W + 200) return;
  const col = d.open ? '#3cc596' : '#6b7480';
  const y = SCREEN_H - 30;
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(d.x - 16, y - 8);
  c.lineTo(d.x + 16, y - 8);
  c.lineTo(d.x, y + 10);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.lineWidth = 2;
  c.stroke();
}

const BOX_COL: Record<string, [string, string]> = {
  desk: ['#b48a64', '#7a5539'], opdesk: ['#b48a64', '#6a4a33'], chiefdesk: ['#8a6448', '#4f3624'], labbench: ['#e4e9ec', '#a9b4bb'], counter: ['#c9b39a', '#6a5240'],
  sink: ['#e8edf0', '#9fb0b8'], big: ['#8ea2b6', '#5d7083'], sofa: ['#6d7f93', '#46566a'], bed: ['#f0f2f3', '#8d9aa4'], tub: ['#5fb8cf', '#e8eef0'], bench: ['#9b7a5a', '#6b5038'],
  wall: ['#5a6571', '#3a434d'], cabinet: ['#5e4a3a', '#3e3126'], vending: ['#c64a3a', '#7d2c22'], pillar: ['#9aa1a6', '#6f767b'], locker: ['#7f8b95', '#56616b'], stall: ['#8a97a1', '#5f6b75'],
  shelf: ['#6c7781', '#48525b'], cart: ['#b9c2c8', '#7d878e'], lowwall: ['#c2862f', '#8a5d1f'], range: ['#3b434b', '#262c32'], target: ['#f2f2f2', '#c9c9c9'], sandbag: ['#7a2e26', '#561f19'],
  gate: ['#b8c0c6', '#7c868d'], slot: ['#3a3f45', '#23272b'], glass: ['rgba(140,205,225,0.35)', 'rgba(110,180,205,0.3)'],
};

function drawBox(c: CanvasRenderingContext2D, b: HqBox, look: string) {
  if (b.kind === 'chair' || b.kind === 'armchair') return drawChair(c, b);
  const [top, front] = BOX_COL[b.kind] ?? BOX_COL.wall;
  const x = b.x - b.w / 2;
  c.fillStyle = top;
  c.fillRect(x, b.y - b.h - b.d, b.w, b.d);
  c.fillStyle = front;
  c.fillRect(x, b.y - b.h, b.w, b.h);
  c.strokeStyle = 'rgba(15,20,26,0.75)';
  c.lineWidth = 3;
  c.strokeRect(x, b.y - b.h - b.d, b.w, b.d + b.h);
  c.beginPath();
  c.moveTo(x, b.y - b.h);
  c.lineTo(x + b.w, b.y - b.h);
  c.stroke();
  // 책상 위: 모니터와 편의점 커피 (책상마다)
  if (b.kind === 'desk' || b.kind === 'opdesk' || b.kind === 'chiefdesk') {
    const n = b.kind === 'opdesk' ? 3 : Math.max(1, Math.round(b.w / 120));
    for (let i = 0; i < n; i++) {
      const mx = x + ((i + 0.5) * b.w) / n;
      c.fillStyle = '#121a22';
      c.fillRect(mx - 22, b.y - b.h - b.d / 2 - 46, 44, 34);
      c.fillStyle = '#3a6d8a';
      c.fillRect(mx - 18, b.y - b.h - b.d / 2 - 42, 36, 26);
    }
    c.fillStyle = '#efe6d2';
    c.fillRect(x + b.w - 20, b.y - b.h - 18, 10, 14);
  }
  if (b.kind === 'bed') {
    c.fillStyle = '#ffffff';
    c.fillRect(x + 8, b.y - b.h - b.d + 6, 46, b.d - 12);
  }
  if (b.kind === 'tub') {
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(x + 10, b.y - b.h - b.d + 8, b.w - 20, 6);
  }
  if (b.kind === 'target') {
    c.fillStyle = '#d0443a';
    for (const r of [26, 14]) {
      c.beginPath();
      c.arc(b.x, b.y - b.h / 2, r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2f2f2';
    }
  }
  if (b.kind === 'gate') {
    c.fillStyle = '#57d27a';
    c.fillRect(b.x - 6, b.y - b.h - b.d + 4, 12, 6);
  }
  void look;
}

/** 옆에서 본 의자: 앉은 사람이 보는 쪽 반대편에 등받이 */
function drawChair(c: CanvasRenderingContext2D, b: HqBox) {
  const seatY = b.y - 82;
  const col = b.kind === 'armchair' ? '#8a5b4a' : '#2d3640';
  c.fillStyle = col;
  if (b.face === 'N') {
    // 목욕 의자
    c.fillRect(b.x - 22, b.y - 34, 44, 10);
    c.fillRect(b.x - 18, b.y - 24, 6, 24);
    c.fillRect(b.x + 12, b.y - 24, 6, 24);
    return;
  }
  const back = b.face === 'E' ? -1 : 1;
  c.fillRect(b.x - b.w / 2, seatY, b.w, b.kind === 'armchair' ? 26 : 12);
  c.fillRect(b.x + back * (b.w / 2) - (back > 0 ? 12 : 0), seatY - (b.h - 82), 12, b.h - 82 + 12);
  c.fillRect(b.x - 4, seatY + 12, 8, 70);
  c.fillRect(b.x - 24, b.y - 8, 48, 6);
}

/* ───────── 옛 장면(거리·파스타집) 그리기: 그대로 둔다 ───────── */

function legacyThing(c: CanvasRenderingContext2D, t: HqScene['things'][number], camX: number) {
  const sx = t.x - camX;
  if (sx < -t.w - 100 || sx > SCREEN_W + t.w + 100) return;
  const base = t.wall ? TOP - 70 : TOP + 26;
  if (drawPropArt(c, t.kind, undefined, t.x, base)) return;
  c.fillStyle = '#4a4f55';
  c.fillRect(t.x - t.w / 2, base - t.h, t.w, t.h);
}

function legacyDoor(c: CanvasRenderingContext2D, d: Door, camX: number) {
  const w = DOOR_W[d.kind];
  const sx = d.x - camX;
  if (sx < -w - 40 || sx > SCREEN_W + w + 40) return;
  if (drawPropArt(c, `hq_${d.kind}`, undefined, d.x, TOP)) return;
  const x = d.x - w / 2,
    y = TOP - DOOR_H;
  c.fillStyle = '#1b2023';
  c.fillRect(x - 8, y - 8, w + 16, DOOR_H + 8);
  c.fillStyle = d.kind === 'shop' ? '#6b4a2e' : 'rgba(150,190,205,0.35)';
  c.fillRect(x, y, w, DOOR_H);
  if (!d.open) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x, y, w, DOOR_H);
  }
}
