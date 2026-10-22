// 본부 걷는 화면: 엔진 벨트 장면 (게임_통합_규격 2·4장, docs/본부_평면도.md).
// 건물 지도(장면·문·엘리베이터·자리·가구)는 본부 모듈 map()이 주고, 엔진은 걷기·그리기·장면 옮기기만 한다.
// 장면 하나 = 방 하나 또는 복도 하나. 문 앞 E → 잠깐 암전 뒤 그 문이 이어진 장면, 엘리베이터 → 층 단추, 자리 앞 E → 본부 메뉴 창.
// 화면에 벽 이름·층·잠김 이유 같은 글씨를 쓰지 않는다. 방 이름은 들어갈 때 위에 1초쯤 작게만. 사람 그림은 없으니 자리 주인은 목소리 말풍선으로.
import type { FloorPlan, PropSpec, StageApi, StageModule, WorldView } from './contract';
import { SCREEN_H, SCREEN_W } from './contract';
import { HQ_PLACE, drawFloor, drawHqWall, drawPropArt } from '../art/bg';
import { drawHintIcon } from './hint';
import type { HqDoor, HqMapView, HqScene, HqSpot } from '../hq/map';

type Door = HqDoor & { open: boolean };
type Scene = Omit<HqScene, 'doors' | 'spots'> & { doors: Door[]; spots: (HqSpot & { open: boolean })[] };

export interface HubHost {
  map(): HqMapView;
  openPlace(id: string): void;
  bark(place: string): { who: string; text: string } | null;
  /** 엘리베이터 층 단추. pick(i) 또는 취소(null) */
  chooseFloor(opts: { label: string; open: boolean; here: boolean }[], pick: (i: number | null) => void): void;
  sfx(name: string): void;
  /** 메뉴·대화창이 떠 있나 */
  busy?(): boolean;
}

// 벽 밑선(TOP)은 440, 걷는 띠는 그보다 조금 앞에서: 바닥 가구(밑동 TOP+26)는 배경에 그려지므로 그 뒤에 몸이 서면 가구 위에 겹쳐 보인다
const TOP = 440;
const LANE: [number, number] = [TOP + 30, 690];
const DOOR_H = 250;
const FADE = 8;

const DOOR_W: Record<Door['kind'], number> = { main: 190, door: 110, glass: 150, steel: 120, security: 120, elevator: 150, stairs_up: 120, stairs_down: 120, shop: 130 };

export type Hub = StageModule & { goto(place: string): void; jump(sceneId: string, x?: number): void; sceneIds(): string[]; current(): HqScene | null };

export function makeHub(host: HubHost, whereIs: (place: string) => { scene: string; x: number }): Hub {
  let view: HqMapView | null = null;
  let scene: Scene | null = null;
  let artDoors = new Set<string>();
  let pending: { scene: string; x: number } | null = null;
  let enterTick = -1;
  let fadeOut = 0;
  let barked: string | null = null;

  const sceneOf = (id: string): Scene => view!.scenes.find((s) => s.id === id) ?? view!.scenes[0];

  const build = (id: string, x: number): FloorPlan => {
    view = host.map();
    const sc = sceneOf(id);
    scene = sc;
    barked = null;
    enterTick = -1;
    const props: PropSpec[] = [
      ...sc.doors.map((d) => ({ id: `door:${d.id}`, kind: 'hubdoor', x: d.x, y: TOP, w: DOOR_W[d.kind], h: DOOR_H })),
      ...sc.spots.map((s) => ({ id: `spot:${s.id}`, kind: 'hubspot', x: s.x, y: TOP, w: 120, h: 10 })),
    ];
    const place = HQ_PLACE[sc.look] ?? HQ_PLACE[sc.id] ?? 'hq_office';
    return {
      id: `hq:${sc.id}`,
      title: sc.name,
      type: 'hq',
      length: Math.max(SCREEN_W, sc.length),
      lane: LANE,
      startX: Math.max(60, Math.min(sc.length - 60, x)),
      exitX: Infinity,
      props,
      encounters: [],
      drawBackground(c: CanvasRenderingContext2D, camX: number) {
        // 벽: 장면 전체를 이어진 한 벽으로 (칸막이·이름 띠 없음)
        // 문이 그려진 벽 칸을 엔진 문 자리에 맞춘다: 그 문은 벽 그림이 대신한다
        const cov = drawHqWall(c, place, sc.id, Math.max(SCREEN_W, sc.length), TOP, sc.doors);
        artDoors = cov ?? new Set();
        if (!cov) {
          const g = c.createLinearGradient(0, 0, 0, TOP);
          g.addColorStop(0, '#2a3236');
          g.addColorStop(1, '#3a4448');
          c.fillStyle = g;
          c.fillRect(camX - 40, 0, SCREEN_W + 80, TOP);
        }
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(camX - 40, TOP - 14, SCREEN_W + 80, 14);
        if (!drawFloor(c, place, camX - 40, camX + SCREEN_W + 40, TOP, SCREEN_H)) {
          const g = c.createLinearGradient(0, TOP, 0, SCREEN_H);
          g.addColorStop(0, '#41494c');
          g.addColorStop(1, '#1d2225');
          c.fillStyle = g;
          c.fillRect(camX - 40, TOP, SCREEN_W + 80, SCREEN_H - TOP);
        }
        for (const t of sc.things) if (t.wall) thing(c, t, camX);
        for (const d of sc.doors) if (!artDoors.has(d.id)) door(c, d, camX);
        for (const t of sc.things) if (!t.wall) thing(c, t, camX);
      },
      drawForeground(c: CanvasRenderingContext2D, camX: number, w: WorldView) {
        // 시계는 실제 시간(틱 단위로 환산): 메뉴·정산 창이 열려 월드가 멈춰도 들어오는 암전은 끝난다
        const now = performance.now();
        if (enterTick < 0) enterTick = now;
        const age = (now - enterTick) / (1000 / 30);
        const px = w.player.x;
        // 가까운 문·자리: 요원 머리 위에 작은 도트 아이콘만 (글씨·말풍선 없음, 검수 4-2)
        const nd = sc.doors.find((d) => Math.abs(d.x - px) < 60);
        const ns = !nd ? sc.spots.find((s) => s.open && Math.abs(s.x - px) < 60) : null;
        const show = (nd || ns) && fadeOut <= 0 && !host.busy?.();
        if (show) (w as { hintShown?: boolean }).hintShown = true;
        if (show) drawHintIcon(c, px, w.player.y - w.player.z - 300, w.tick);
        // 암전: 들어올 때 밝아지고, 나갈 때 어두워진다
        const dark = fadeOut > 0 ? 1 - fadeOut / FADE : age < FADE ? 1 - age / FADE : 0;
        if (dark > 0) {
          c.fillStyle = `rgba(0,0,0,${dark})`;
          c.fillRect(camX - 40, 0, SCREEN_W + 80, SCREEN_H); // 이 그림판은 이미 -camX 만큼 옮겨져 있다
        }
      },
    };
  };

  const go = (sceneId: string, x: number) => {
    pending = { scene: sceneId, x };
    fadeOut = FADE;
  };
  const doorX = (sceneId: string, doorId?: string) => sceneOf(sceneId).doors.find((d) => d.id === doorId)?.x ?? 200;

  return {
    id: 'hq',
    label: '본부',
    firstFloor: () => {
      const v = host.map();
      view = v;
      const s = pending ?? v.start;
      pending = null;
      fadeOut = 0;
      return build(s.scene, s.x);
    },
    nextFloor: () => {
      const s = pending ?? { scene: scene?.id ?? 'office', x: 400 };
      pending = null;
      return build(s.scene, s.x);
    },
    tick(a: StageApi) {
      if (fadeOut > 0 && --fadeOut === 0 && pending) {
        if (pending.scene === scene?.id) {
          a.movePlayer(pending.x);
          pending = null;
          enterTick = -1;
        } else a.finish('next');
      }
      // 자리에 가까이 가면 주인 목소리 한 줄 (자막)
      const px = a.world.player.x;
      const sp = scene?.spots.find((s) => s.open && Math.abs(s.x - px) < 170);
      if (sp && sp.place !== barked) {
        barked = sp.place;
        const l = host.bark(sp.place);
        // 벽 가운데 말풍선 대신 아래 자막 한 줄 (검수 4-2)
        if (l) a.world.say(`${l.who}: ${l.text}`, 3.5);
      } else if (!sp) barked = null;
    },
    onInteract(_a, _floor, prop) {
      if (!scene || fadeOut > 0) return;
      if (prop.kind === 'hubspot') {
        const s = scene.spots.find((q) => `spot:${q.id}` === prop.id);
        if (s?.open) host.openPlace(s.place);
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
          go(e.scene, doorX(e.scene, e.door));
        });
        return;
      }
      if (!d.to) return;
      host.sfx(d.kind === 'steel' || d.kind === 'security' ? 'doorSlam' : d.kind.startsWith('stairs') ? 'stepConcrete' : 'doorOpen');
      go(d.to, doorX(d.to, d.toDoor));
    },
    /** 검사·스크린샷용: 장면으로 바로 */
    jump(sceneId: string, x = 400) {
      if (view) go(sceneId, x);
    },
    sceneIds: () => (view ?? host.map()).scenes.map((s) => s.id),
    current: () => scene,
    goto(place: string) {
      if (!view) return;
      const t = whereIs(place);
      go(t.scene, t.x);
    },
  };
}

/* ───────── 그리기 ───────── */

function thing(c: CanvasRenderingContext2D, t: Scene['things'][number], camX: number) {
  const sx = t.x - camX;
  if (sx < -t.w - 100 || sx > SCREEN_W + t.w + 100) return;
  // 바닥 물건은 벽 밑동(뒷줄) 조금 앞에, 벽 물건은 벽 가운데 높이에
  const base = t.wall ? TOP - 70 : TOP + 26;
  if (drawPropArt(c, t.kind, undefined, t.x, base)) return;
  const x = t.x - t.w / 2;
  if (!t.wall) {
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(t.x, base, t.w / 2 + 6, 8, 0, 0, Math.PI * 2);
    c.fill();
  }
  const top = Math.min(10, t.h / 4);
  c.fillStyle = tint(t.kind);
  c.fillRect(x, base - t.h, t.w, t.h);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(x, base - t.h, t.w, top);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(x, base - top, t.w, top);
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  c.lineWidth = 2;
  c.strokeRect(x, base - t.h, t.w, t.h);
}

function door(c: CanvasRenderingContext2D, d: Door, camX: number) {
  const w = DOOR_W[d.kind];
  const sx = d.x - camX;
  if (sx < -w - 40 || sx > SCREEN_W + w + 40) return;
  if (drawPropArt(c, `hq_${d.kind}`, undefined, d.x, TOP)) return;
  const x = d.x - w / 2,
    y = TOP - DOOR_H;
  // 문틀
  c.fillStyle = '#1b2023';
  c.fillRect(x - 8, y - 8, w + 16, DOOR_H + 8);
  switch (d.kind) {
    case 'stairs_up':
    case 'stairs_down': {
      c.fillStyle = '#0d1012';
      c.fillRect(x, y, w, DOOR_H);
      c.fillStyle = '#3a4246';
      const up = d.kind === 'stairs_up';
      for (let i = 0; i < 7; i++) {
        const sy = up ? TOP - 20 - i * 30 : y + 40 + i * 30;
        const inset = up ? i * 10 : 0;
        c.fillRect(x + 8 + inset, sy, w - 16 - inset, 8);
      }
      c.fillStyle = '#5f6a6f';
      c.fillRect(x + 4, y + 30, 4, DOOR_H - 30);
      break;
    }
    case 'elevator': {
      c.fillStyle = '#8a949a';
      c.fillRect(x, y, w / 2 - 1, DOOR_H);
      c.fillRect(x + w / 2 + 1, y, w / 2 - 1, DOOR_H);
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(x + 6, y, 6, DOOR_H);
      c.fillRect(x + w / 2 + 7, y, 6, DOOR_H);
      c.fillStyle = '#ffb34a';
      c.fillRect(d.x - 14, y - 30, 28, 12);
      c.fillStyle = '#2c3236';
      c.fillRect(x + w + 14, y + 110, 16, 34);
      c.fillStyle = '#d9d2b8';
      c.fillRect(x + w + 18, y + 116, 8, 8);
      c.fillRect(x + w + 18, y + 130, 8, 8);
      break;
    }
    case 'glass':
    case 'main': {
      c.fillStyle = 'rgba(150,190,205,0.35)';
      c.fillRect(x, y, w, DOOR_H);
      c.fillStyle = '#2b3236';
      c.fillRect(x, y, w, 10);
      if (d.kind === 'main') c.fillRect(d.x - 3, y, 6, DOOR_H);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(x + 12, y + 20, 8, DOOR_H - 40);
      c.fillStyle = '#c8c2ad';
      c.fillRect(d.kind === 'main' ? d.x - 16 : x + w - 22, y + 120, 6, 40);
      break;
    }
    case 'steel':
    case 'security': {
      c.fillStyle = d.kind === 'security' ? '#4d585e' : '#5a5f62';
      c.fillRect(x, y, w, DOOR_H);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < 4; i++) c.fillRect(x, y + i * (DOOR_H / 4), w, 3);
      c.fillStyle = '#2a2f32';
      c.fillRect(x + w + 12, y + 110, 20, 32);
      c.fillStyle = d.open ? '#57d27a' : '#e0443a';
      c.fillRect(x + w + 17, y + 116, 10, 6);
      break;
    }
    case 'shop': {
      c.fillStyle = '#6b4a2e';
      c.fillRect(x, y, w, DOOR_H);
      c.fillStyle = 'rgba(255,214,140,0.35)';
      c.fillRect(x + 16, y + 26, w - 32, 90);
      c.fillStyle = '#8e2f26';
      c.fillRect(x - 30, y - 34, w + 60, 26);
      break;
    }
    default: {
      c.fillStyle = '#6a5440';
      c.fillRect(x, y, w, DOOR_H);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(x + 12, y + 16, w - 24, 90);
      c.fillRect(x + 12, y + 126, w - 24, 100);
      c.fillStyle = '#c8c2ad';
      c.fillRect(x + w - 22, y + 130, 10, 6);
    }
  }
  if (!d.open) {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x, y, w, DOOR_H);
  }
}

function tint(kind: string): string {
  let h = 0;
  for (let i = 0; i < kind.length; i++) h = (h * 31 + kind.charCodeAt(i)) >>> 0;
  const hue = [28, 35, 200, 210, 18, 160][h % 6];
  return `hsl(${hue} ${14 + (h % 10)}% ${30 + (h % 12)}%)`;
}
