// 본부 걷는 화면: 엔진 벨트 장면 (docs/본부_설계_2판.md).
// 건물 지도(장면·문·엘리베이터·자리·집기 상자)는 본부 모듈 map()이 주고, 엔진은 걷기·막기·그리기·장면 옮기기만 한다.
// 장면 하나 = 방 하나 또는 복도 하나. 북쪽 벽 문은 벽 앞(깊이 위쪽)에서, 화면 아래 출입은 아래쪽 끝에서 E.
// 문은 열리는 그림이 나온 뒤 잠깐 암전, 엘리베이터는 층 단추, 자리 앞 E는 본부 메뉴 창 또는 그 자리 동작.
// 집기는 바닥 위 상자(앞면 + 윗면)로 몸과 깊이 순서로 섞여 그려지고, 몸은 상자를 뚫고 지나가지 못한다.
// 방 그림(GPT 전체 그림 + 앞 레이어)이 오기 전까지는 같은 자리·크기의 색 상자로 그린다.
// 화면 글씨: 그림 층의 지상 표찰(2·3층)·잠긴 문 「잠겨 있다」만 (사용자 2026-10-25). 그 밖의 방 이름·층·잠김 이유는 쓰지 않는다.
import type { Player } from './player';
import type { FloorPlan, StageApi, StageModule, WorldView } from './contract';
import { SCREEN_H, SCREEN_W } from './contract';
import { HQ_PLACE, drawFloor, drawHqWall, drawPropArt, drawHqTextureWall } from '../art/bg';
import { drawHqDoorRound2 } from '../art/hqDoorRound2';
import { drawCallLit, drawHqField, drawHqFieldLight, drawHqFieldObject, drawHqSigns, hasHqField } from '../art/hqField';
import { charTop, drawCharClip, drawCharSeat, charArt, charFx, CHAR_K } from '../art/charPacks';
import { persp, view as fieldView } from './view';
import { blockByProps, clearSpot, type BlockProp } from './propBlock';
import { PAINTED, clampPainted, doorReachY } from '../hq/painted';
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
  /** 장면이 바뀌었다 (처음 들어갈 때는 부르지 않는다) */
  entered?(to: { id: string; name: string; floor?: string }, from: { id: string; name: string; floor?: string }, walkedPx: number): void;
  /** 메뉴·대화창이 떠 있나 */
  busy?(): boolean;
  /** 자리 동작(앉기·눕기…) 클립 순서. 플레이어 동작 재생이 붙으면 여기로 */
  act?(seq: string[], face: 1 | -1 | undefined): void;
  /** 본부 방문: 이 장면에 서 있는 요원 (상태 태그로 정한 방). 발 위치와 보는 쪽 */
  visitors?(sceneId: string): { name: string; x: number; y: number; face: 1 | -1 }[];
  /** 장면 맨 위에 그리기 (월드 좌표): 이름표·말풍선. people = 이 방 요원, player = 주인공 발 */
  overlay?(c: CanvasRenderingContext2D, people: { name: string; x: number; y: number; top: number; label?: string; mob?: boolean }[], player: { name: string; x: number; y: number; top: number }): void;
  /** 필드 시각 (시, 0~24). 없으면 시간대 조명은 기기 시계 */
  hour?(): number | null;
  /** 앉기·눕기 자리에 앉았다 (시간 보내기 고르기) */
  sat?(): void;
  /** 필드 가게 자리: 거래 창을 연다. 못 열면(문 닫음 등) 자막 한 줄 */
  shop?(id: string): string | null;
  /** 필드 세계 (src/game/world): 있으면 visitors 대신 움직이는 행위자를 그린다 */
  life?: HubLife;
}

/** 보이는 장면의 행위자 하나 (월드 좌표, 발 기준) */
export interface LiveActor { id: string; name: string; kind: 'named' | 'mob'; x: number; y: number; face: 1 | -1; look?: string; moving: boolean; clip?: string; since?: number; until?: number; icon?: string; say?: string;
  /** 몹: 지금 말을 걸 수 있나 (10-31 사용자: 몹도 이름 인물처럼 대화) */
  talk?: boolean;
  /** 지도 의자에 앉음: 의자 번호(장면 상자 번호)·앉기 방향·하는 일·의자 자리 */
  seat?: { box: number; dir: 'front' | 'side' | 'back'; kind: string; x: number; y: number } }
export interface HubLife {
  /** 생활 시간 진행 (실시간 초). at = 보이는 장면과 주인공 발 */
  tick(dt: number, at: { scene: string; x: number; y?: number; seat?: number | null }): void;
  actors(sceneId: string): LiveActor[];
  /** 관찰 창이 켜져 있으면 글 줄, 꺼져 있으면 null */
  observer(sceneId: string): string[] | null;
  /** 몹 그림. 없으면 회색 실루엣 */
  drawMob?(c: CanvasRenderingContext2D, a: LiveActor): void;
  /** 생활 시각(초): 클립 재생 기준 */
  lifeTime?(): number;
  /** 주인공 공격 판정 → 맞은 행위자 수 */
  hit?(sceneId: string, boxes: { x0: number; x1: number; y: number; dy?: number; z0: number; z1: number; attackId: number }[], dir: 1 | -1): number;
  /** 매 틱: 주인공을 막아선 행위자를 전투 AI 몸으로 세우고(ai-char), 쓰러진 몸을 행위자로 되돌린다 */
  combat?(api: StageApi, sceneId: string): void;
  /** 시체 둘레 폴리스 라인 (라바콘 + 노란 테이프, 10-30). 깊이 층으로 그린다 */
  cordons?(sceneId: string): { x0: number; x1: number; y0: number; y1: number }[];
  /** 훈련장 장비 (샌드백·허수아비·사격 과녁, 10-31: 그림은 일단 코드 drawGear, 나중에 교체). busy = 누가 치는 중 → 흔들림 */
  gear?(sceneId: string): { kind: 'sandbag' | 'dummy' | 'target'; x: number; y: number; busy: boolean }[];
}
/** 폴리스 라인 층 자리 수 (장면당 시체 상한 5 → 라인 최대 5) */
const CORDON_SLOTS = 5;
/** 훈련 장비 층 자리 수 (훈련장 한 곳 7개) */
const GEAR_SLOTS = 8;
/** 행위자 깊이 층 자리 수 (한 화면 상한보다 넉넉히) */
const LIFE_SLOTS = 24;

const TOP = 440;
const LANE: [number, number] = [LANE_TOP, LANE_BOT];
const DOOR_H = 250;
const FADE = 8;
/** 문 열리는 그림 길이(틱). 그림 장면은 문마다 다르다 (엘리베이터·셔터는 천천히) */
const OPEN_T = 9;
const openLen = (sc: Scene | null, d: HqDoor) => (!sc?.painted ? OPEN_T : d.kind === 'elevator' ? 22 : d.kind === 'cell' ? 26 : 12);
/** 잠긴 문 덜컹 길이(틱) */
const RATTLE_T = 10;
const DOOR_W: Record<Door['kind'], number> = { main: 190, door: 120, stairs: 120, glass: 160, steel: 120, security: 120, elevator: 160, stairs_up: 120, stairs_down: 120, shop: 130, slide: 170, cell: 150, exit: 150 };

export type Hub = StageModule & { nearInfo(): { text: string; locked: boolean } | null; speech(): { who: string; text: string; x: number; y: number; top: number } | null; goto(place: string): void; jump(sceneId: string, x?: number, y?: number): void; sceneIds(): string[]; current(): HqScene | null };

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
  /** 자리 주인 목소리 한 줄: 아래 자막 대신 그 사람 머리 위 말풍선 (사용자 2026-10-25) */
  let speech: { who: string; text: string; x: number; y: number; top: number; until: number } | null = null;
  let curPeople: { name: string; x: number; y: number }[] = [];
  /** 보이는 장면의 행위자 (host.life) */
  let live: LiveActor[] = [];
  /** 지금 장면의 폴리스 라인 (시체 둘레) */
  let cords: { x0: number; x1: number; y0: number; y1: number }[] = [];
  /** 지금 장면의 훈련 장비 */
  let gears: { kind: 'sandbag' | 'dummy' | 'target'; x: number; y: number; busy: boolean }[] = [];
  let opening: { id: string; t: number; len: number; then: () => void } | null = null;
  /** 들어온 문이 뒤에서 닫히는 것·메뉴 문이 다시 닫히는 것 */
  let closing: { id: string; t: number; len: number } | null = null;
  let rattle: { id: string; t: number } | null = null;
  let arriveDoor: string | null = null;
  /** 엘리베이터 층을 고른 뒤: 호출 단추가 초록으로 바뀌고 잠깐 뒤 문이 열린다 */
  let callWait: { t: number; then: () => void } | null = null;
  let callOn = false;
  let near: string | null = null;
  let solids: (BlockProp & { h?: number })[] = [];
  /** 주인공이 앉아 있는 방 의자 (코어가 인물 팩 의자를 그리는 동안 방 의자 그림은 숨긴다) */
  let sitChair: HqBox | null = null;
  /** 이 장면에서 걸은 거리 (px). 필드 시계가 쓴다 */
  let walked = 0;
  let lastX: number | null = null;

  const sceneOf = (id: string): Scene => view!.scenes.find((s) => s.id === id) ?? view!.scenes[0];
  const openOf = (id: string) =>
    opening && opening.id === id ? Math.min(1, opening.t / opening.len) : closing && closing.id === id ? Math.max(0, 1 - closing.t / closing.len) : 0;
  const doorFx = (id: string) => ({ open: openOf(id), shake: rattle && rattle.id === id ? (rattle.t % 4 < 2 ? 3 : -3) * (1 - rattle.t / RATTLE_T) : 0 });

  const build = (id: string, x: number, y?: number): FloorPlan => {
    view = host.map();
    const base = sceneOf(id);
    // 방문 요원은 그 방의 자리(대화 상대)로 붙인다: E → 대화창 (npcLink hubTalk → visit)
    const people = (host.life ? [] : host.visitors?.(base.id) ?? []).map((p) => {
      const at = clearSpot(p.x, p.y, base.boxes.filter((b) => b.solid).map((b) => ({ x: b.x, y: b.y, w: b.w, back: b.d + 6, front: 8 })), base.lane ?? LANE);
      return { ...p, x: at.x, y: at.y };
    });
    const sc: Scene = { ...base, spots: [...base.spots, ...people.map((p) => ({ id: `visit:${p.name}`, x: p.x, y: p.y, who: p.name, verb: '대화', face: p.face, open: true }))] };
    curPeople = people;
    speech = null;
    const prev = scene;
    scene = sc;
    if (prev && prev.id !== sc.id) host.entered?.({ id: sc.id, name: sc.name, floor: sc.floor }, { id: prev.id, name: prev.name, floor: prev.floor }, walked);
    walked = 0;
    lastX = null;
    barked = null;
    enterTick = -1;
    opening = null;
    rattle = null;
    callWait = null;
    callOn = false;
    // 들어온 문은 열린 채로 시작해 뒤에서 닫힌다 (그림 장면)
    const inDoor = arriveDoor ? sc.doors.find((d) => d.id === arriveDoor) : undefined;
    closing = sc.painted && inDoor ? { id: inDoor.id, t: 0, len: openLen(sc, inDoor) } : null;
    arriveDoor = null;
    near = null;
    solids = [...sc.boxes.filter((b) => b.solid).map((b) => ({ x: b.x, y: b.y, w: b.w, back: b.d + 6, front: 8, h: sc.painted ? b.h : undefined })), ...people.map((p) => ({ x: p.x, y: p.y, w: 80, back: 24, front: 24 }))];
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
      platforms: sc.painted ? sc.boxes.filter((b) => b.solid && b.h > 0 && b.h < 400).map((b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.d, y1: b.y, h: b.h })) : undefined,
      depthLayers: sc.boxes.map((b, bi) => ({ y: b.y, occludedSilhouette: !sc.painted, x0: b.x - b.w / 2, x1: b.x + b.w / 2, draw: (c: CanvasRenderingContext2D) => {
        if (sc.painted && hasHqField(sc.painted)) { drawHqFieldObject(c, sc.painted, b.kind); return; }
        // 누가 앉은 의자는 앉은 사람이 자기 맞춤값으로 그린다 (주인공 = 엔진, 이름 인물 = drawCharSeat)
        if (b === sitChair || live.some((q) => q.seat?.box === bi)) return;
        drawBox(c, b, sc.look);
      } })).concat(people.map((p) => ({ y: p.y, x0: p.x - 60, x1: p.x + 60, occludedSilhouette: false, draw: (c: CanvasRenderingContext2D) => { drawCharClip(c, p.name, p.x, p.y, p.face, performance.now()); } })))
        // 움직이는 행위자: 자리 수만큼 층을 두고 매 프레임 지금 목록의 i번째를 읽는다 (깊이 정렬은 y 게터로)
        .concat(host.life ? Array.from({ length: LIFE_SLOTS }, (_, i) => ({
          get y() { return live[i]?.y ?? -1e9; },
          get x0() { return (live[i]?.x ?? -1e9) - 60; },
          get x1() { return (live[i]?.x ?? -1e9) + 60; },
          occludedSilhouette: false,
          draw: (c: CanvasRenderingContext2D) => { const a = live[i]; if (a) drawLiveActor(c, a, host.life!); },
        })) : [])
        // 훈련 장비: 장비마다 한 층 (사람과 깊이로 겹친다)
        .concat(host.life?.gear ? Array.from({ length: GEAR_SLOTS }, (_, i) => ({
          get y() { return gears[i]?.y ?? -1e9; },
          get x0() { return (gears[i]?.x ?? -1e9) - 40; },
          get x1() { return (gears[i]?.x ?? -1e9) + 40; },
          occludedSilhouette: false,
          draw: (c: CanvasRenderingContext2D) => { const g = gears[i]; if (g) drawGear(c, g, performance.now() / 1000); },
        })) : [])
        // 폴리스 라인: 라인마다 뒤쪽(뒷줄 라바콘·옆 테이프)과 앞쪽(앞줄 라바콘·테이프) 두 층 → 시체·사람과 깊이로 겹친다
        .concat(host.life?.cordons ? Array.from({ length: CORDON_SLOTS * 2 }, (_, i) => ({
          get y() { const b = cords[i >> 1]; return b ? (i & 1 ? b.y1 : b.y0) : -1e9; },
          get x0() { return cords[i >> 1]?.x0 ?? -1e9; },
          get x1() { return cords[i >> 1]?.x1 ?? -1e9; },
          occludedSilhouette: false,
          draw: (c: CanvasRenderingContext2D) => { const b = cords[i >> 1]; if (b) drawCordon(c, b, !!(i & 1), performance.now() / 1000); },
        })) : []),
      drawBackground(c: CanvasRenderingContext2D, camX: number) {
        if (sc.painted && drawHqField(c, sc.painted, camX, doorFx, host.hour?.() ?? null)) {
          // 표찰은 지상 사무 층(2·3층)만 (사용자 2026-10-25)
          if (sc.floor === '2F' || sc.floor === '3F') drawHqSigns(c, sc.painted, sc.doors);
          if (callOn) drawCallLit(c, sc.painted, performance.now());
          return;
        }
        if (sc.legacy) {
          const cov = drawHqWall(c, place, sc.id, len, TOP, sc.doors);
          artDoors = cov ?? new Set();
          c.fillStyle = 'rgba(0,0,0,0.35)';
          c.fillRect(camX - 40, TOP - 14, fieldView.w + 80, 14);
          if (!drawFloor(c, place, camX - 40, camX + fieldView.w + 40, TOP, SCREEN_H)) {
            c.fillStyle = '#2b3135';
            c.fillRect(camX - 40, TOP, fieldView.w + 80, SCREEN_H - TOP);
          }
          for (const t of sc.things) if (t.wall) legacyThing(c, t, camX);
          for (const d of sc.doors) if (!artDoors.has(d.id)) legacyDoor(c, d, camX);
          for (const t of sc.things) if (!t.wall) legacyThing(c, t, camX);
          return;
        }
        drawRoomShell(c, sc, camX);
        const textured = (sc.id === 'office' || sc.id === 'f2') && drawHqTextureWall(c, place, len, camX, sc.doors.filter(d => !isS(d)).map(d => ({ x: d.x, width: d.kind === 'glass' ? 192 : DOOR_W[d.kind] + 24 })));
        if (sc.id === 'office' || sc.id === 'f2') drawFloor(c, place, camX - 40, camX + fieldView.w + 40, TOP, SCREEN_H);
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
        if (sc.painted) drawHqFieldLight(c, sc.painted, camX, host.hour?.() ?? null, now);
        // 엘리베이터 앞 방향 안내(drawHqGuide)는 사용자 지시로 끔 (2026-10-25)
        // 주인공 그림은 쟈알디 그림이라 머리 높이도 쟈알디 기준
        // 말풍선·이름표는 화면 px 그대로 (필드 zoom을 되돌려 글자 도트가 고르게). top은 원근까지 곱한 화면 px
        const z = fieldView.zoom;
        c.save();
        c.scale(1 / z, 1 / z);
        // 사람 그림은 월드 배율로 그려지므로(배경과 같이 커짐) 머리 높이도 z를 곱한다
        const shown = host.life ? live.filter((a) => a.kind === 'named') : people;
        const mobsShown = host.life ? live.filter((a) => a.kind === 'mob' && a.talk) : [];
        host.overlay?.(c, [...shown.map((p) => ({ name: p.name, x: p.x * z, y: p.y * z, top: namedTop(p.name) * persp(p.y) * z })),
          ...mobsShown.map((p) => ({ name: `mob:${p.id}`, label: p.name, mob: true, x: p.x * z, y: p.y * z, top: (p.look && charArt(p.look) ? charTop(p.look) : -230) * persp(p.y) * z }))], { name: '', x: w.player.x * z, y: (w.player.y - w.player.z) * z, top: ((w.player as { art?: { key: string } }).art ? charTop((w.player as { art?: { key: string } }).art!.key) : -230) * persp(w.player.y) * z });
        c.restore();
        // 행위자 머리 위 아이콘·말풍선 (화면 px)
        if (host.life) {
          c.save();
          c.scale(1 / z, 1 / z);
          for (const a of live) {
            if (!a.icon && !a.say) continue;
            const top = (a.kind === 'named' ? namedTop(a.name) : a.look && charArt(a.look) ? charTop(a.look) : -230) * persp(a.y);
            drawHeadBubble(c, a.x * z, (a.y + top) * z - 8, a.say ?? a.icon!, !!a.say);
          }
          c.restore();
        }
        // 세계 관찰 창 (개발 도구): 화면 오른쪽 위, 화면 px 그대로
        const obs = host.life?.observer(sc.id);
        if (obs) drawObserver(c, obs);
        // 출입 표식과 잠금 이유는 render.ts / HUD가 같은 조사 대상으로 표시한다.
        const dark = fadeOut > 0 ? 1 - fadeOut / FADE : age < FADE ? 1 - age / FADE : 0;
        if (dark > 0) {
          c.fillStyle = `rgba(0,0,0,${dark})`;
          c.fillRect(camX - 40, 0, fieldView.w + 80, SCREEN_H); // 이 그림판은 이미 -camX 만큼 옮겨져 있다
        }
      },
    };
  };

  const go = (sceneId: string, x: number, y?: number) => {
    fieldView.worldH = sceneOf(sceneId).painted ? PAINTED[sceneOf(sceneId).painted!]?.h ?? 700 : SCREEN_H;
    pending = { scene: sceneId, x, y };
    fadeOut = FADE;
  };
  const arriveAt = (sceneId: string, doorId?: string) => {
    const d = sceneOf(sceneId).doors.find((q) => q.id === doorId);
    return d ? { x: d.x, y: sceneOf(sceneId).legacy ? undefined : doorY(d, sceneOf(sceneId).lane ?? LANE) } : { x: 200, y: undefined };
  };
  const goDoor = (sceneId: string, doorId?: string) => {
    arriveDoor = doorId ?? null;
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
    // 아직 안 열린 자리도 다가가면 「잠김」으로 보인다 (전수검사: 연구·감정·면담 자리가 아무 안내 없이 비어 보였다)
    for (const s of scene.spots) {
      const ok = Math.abs(s.x - px) < (s.y === undefined ? 60 : 75) && (s.y === undefined || Math.abs(s.y - py) < 55);
      consider(`spot:${s.id}`, 'hubspot', s.x, ok);
    }
    for (const d of scene.doors) {
      const reach = Math.abs(d.x - px) < (scene.legacy ? 60 : 75);
      const lane = scene.lane ?? LANE;
      const reachY = scene.painted ? doorReachY(scene.painted, d.id) : null;
      const depth = scene.legacy || (isS(d) ? py > lane[1] - 60 : py < Math.max(lane[0] + 75, reachY ?? 0));
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
      if (sitChair && !(a.world.player as Player).seat && !(a.world.player as { sitting?: boolean }).sitting) sitChair = null;
      if (host.life && scene) {
        host.life.tick(1 / 30, { scene: scene.id, x: a.world.player.x, y: a.world.player.y, seat: sitChair ? scene.boxes.indexOf(sitChair) : null });
        // 주인공 공격이 행위자에게 닿았나 (필드 행위자는 전투 몸이 아니라 따로 본다)
        const boxes = a.world.player.frame().hit;
        if (boxes.length && host.life.hit) {
          const n = host.life.hit(scene.id, boxes, a.world.player.dir);
          if (n) a.world.emit({ type: 'hit', strength: 1, x: boxes[0].x0, y: boxes[0].y, z: 120, dmg: 0, react: 'flinch', target: 'npc', combo: 0 });
        }
        host.life.combat?.(a, scene.id);
        live = host.life.actors(scene.id);
        cords = host.life.cordons?.(scene.id) ?? [];
        gears = host.life.gear?.(scene.id) ?? [];
        // 이름 인물 대화 자리(visit:이름)를 지금 서 있는 곳으로 옮긴다 (E → npcLink 대화)
        const named = live.filter((q) => q.kind === 'named');
        // 몹도 말을 걸 수 있다 (10-31 사용자): 자리 열쇠 = mob:<id> (같은 이름 몹이 여럿이라 이름 대신 id)
        const talkers = live.filter((q) => q.kind === 'mob' && q.talk);
        scene.spots = scene.spots.filter((q) => !q.id.startsWith('visit:')).concat(named.map((q) => ({ id: `visit:${q.name}`, x: q.x, y: q.y, who: q.name, verb: '대화', face: q.face, open: true })), talkers.map((q) => ({ id: `visit:mob:${q.id}`, x: q.x, y: q.y, who: `mob:${q.id}`, verb: '대화', face: q.face, open: true })));
        curPeople = named;
      }
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
        lastX = null;
      }
      if (lastX !== null) { const d = Math.abs(p.x - lastX); if (d < 60) walked += d; }
      lastX = p.x;
      if (opening && opening.t < opening.len && ++opening.t === opening.len) {
        const then = opening.then;
        then();
      }
      if (callWait && --callWait.t <= 0) { const f = callWait.then; callWait = null; f(); }
      if (closing && ++closing.t >= closing.len) closing = null;
      if (rattle && ++rattle.t >= RATTLE_T) rattle = null;
      // 물건보다 높이 떠 있으면(점프·올라선 몸) 막지 않는다
      if (solids.length && !(p as Player).seat) blockByProps([p as never], solids.filter((s) => !(s.h !== undefined && p.z >= s.h - 6)), scene?.lane ?? LANE);
      if (scene?.painted) {
        // 그림 층: 양 끝 옆벽·튀어나온 벽 바깥으로 못 간다
        const q = clampPainted(scene.painted, p.x, p.y);
        if (q.x !== p.x || q.y !== p.y) a.movePlayer(q.x, q.y);
      }
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
        if (l) {
          // 말하는 사람이 이 방에 서 있으면 그 머리 위, 아니면 그 자리 위
          const who = curPeople.find((q) => q.name === l.who);
          const x = who?.x ?? sp.x, y = who?.y ?? sp.y ?? p.y;
          speech = { who: l.who, text: l.text, x, y, top: (who ? namedTop(l.who) : -200) * persp(y), until: performance.now() + 3800 };
        }
      } else if (!sp) barked = null;
    },
    onInteract(a, _floor, prop) {
      if (!scene || fadeOut > 0 || opening || callWait) return;
      if (prop.kind === 'hubspot') {
        const s = scene.spots.find((q) => `spot:${q.id}` === prop.id);
        if (!s) return;
        if (!s.open) return a.world.say('아직 쓸 수 없다. 본부 일이 더 진행되면 열린다.', 2.5);
        if (s.shop) {
          const m = host.shop?.(s.shop);
          if (m) a.world.say(m, 2.5);
          return;
        }
        if (s.place) return host.openPlace(s.place);
        if (s.say) return a.world.say(s.say, 3);
        if (s.seat && s.act?.[0]) {
          if (s.chair !== undefined && live.some((q) => q.seat?.box === s.chair)) return a.world.say('누가 앉아 있다.', 1.5);
          const exit = clearSpot(s.x, s.y ?? a.world.player.y, solids, scene.lane ?? LANE);
          if ((a.world.player as Player).sit(s.act[0], s.seat.x, s.seat.y, s.face ?? 1, exit) && s.chair !== undefined) sitChair = scene.boxes[s.chair] ?? null;
          host.sat?.();
          return;
        }
        // 자리 동작: 그 자리에 서서 보는 쪽을 맞춘다 (생활 클립 재생은 host.act)
        if (s.y !== undefined) a.movePlayer(s.x, s.y);
        if (s.face) (a.world.player as { dir: 1 | -1 }).dir = s.face;
        if (s.act) host.act?.(s.act, s.face);
        // 앉기·눕기 자리 = 시간 보내기 (docs/필드_세계_NPC_설계.md 16-2)
        if (/앉기|눕기/.test(s.verb)) host.sat?.();
        return;
      }
      if (prop.kind !== 'hubdoor') return;
      const d = scene.doors.find((q) => `door:${q.id}` === prop.id);
      if (!d) return;
      if (!d.open) {
        if (scene.painted) rattle = { id: d.id, t: 0 };
        if (d.locked) a.world.say('잠겨 있다', 1.5);
        return host.sfx('knock');
      }
      const len = openLen(scene, d);
      if (d.kind === 'stairs') {
        // 계단: 위층·아래층 중 고른다 (그 층의 계단 문으로 나온다)
        const to = [d.up, d.down].filter((q): q is NonNullable<typeof q> => !!q);
        const label = (id: string) => view!.elevator.find((e) => e.scene === id)?.label ?? id;
        const go1 = (target: string) => {
          host.sfx('doorLatch');
          opening = { id: d.id, t: 0, len, then: () => goDoor(target, 'stairs') };
        };
        if (to.length === 1) return go1(to[0]);
        host.chooseFloor(to.map((q) => ({ label: label(q), open: true, here: false })), (i) => {
          if (i != null && to[i]) go1(to[i]);
        });
        return;
      }
      if (d.place) {
        // 방 그림이 없는 장소: 문이 열리면 메뉴 창, 문은 다시 닫힌다
        const place = d.place;
        host.sfx(scene.painted ? 'doorLatch' : d.kind === 'cell' ? 'doorSlam' : 'doorOpen');
        opening = { id: d.id, t: 0, len, then: () => { opening = null; closing = { id: d.id, t: 0, len }; host.openPlace(place); } };
        return;
      }
      if (d.kind === 'elevator') {
        const here = scene.id;
        const opts = view!.elevator.map((e) => ({ label: e.label, open: e.open, here: e.scene === here }));
        host.chooseFloor(opts, (i) => {
          if (i == null) return;
          const e = view!.elevator[i];
          if (!e?.open || e.scene === here) return;
          if (!scene?.painted) {
            host.sfx('ding');
            opening = { id: d.id, t: 0, len, then: () => goDoor(e.scene, e.door) };
            return;
          }
          // 단추가 초록으로 바뀌며 딸깍 → 잠깐 뒤 띵 하고 문이 열린다
          host.sfx('panelButton');
          callOn = true;
          callWait = { t: 14, then: () => { host.sfx('elevChime'); opening = { id: d.id, t: 0, len, then: () => goDoor(e.scene, e.door) }; } };
        });
        return;
      }
      if (!d.to) return;
      const to = d.to,
        toDoor = d.toDoor;
      host.sfx(scene.painted ? 'doorLatch' : d.kind === 'steel' || d.kind === 'security' || d.kind === 'cell' ? 'doorSlam' : d.kind.startsWith('stairs') ? 'stepConcrete' : 'doorOpen');
      if (scene.legacy) return goDoor(to, toDoor);
      opening = { id: d.id, t: 0, len, then: () => goDoor(to, toDoor) };
    },
    /** 지금 손이 닿는 문·자리의 짧은 이름 (캐릭터 옆 말풍선) */
    speech() {
      if (!speech || performance.now() > speech.until || fadeOut > 0) return null;
      return speech;
    },
    nearInfo() {
      if (!scene || !near || opening || fadeOut > 0) return null;
      if (near.startsWith('spot:')) {
        const s = scene.spots.find((q) => `spot:${q.id}` === near);
        return s ? { text: s.verb, locked: !s.open } : null;
      }
      const d = scene.doors.find((q) => `door:${q.id}` === near);
      if (!d) return null;
      const text = d.label ?? (d.kind === 'elevator' ? '엘리베이터' : d.kind === 'stairs' ? '계단' : d.kind === 'exit' ? '나가기' : '문');
      return { text, locked: !d.open };
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
    w = fieldView.w + 80;
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
  if (x > camX + fieldView.w + 40 || x + f.w < camX - 40) return;
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
  if (x > camX + fieldView.w + 40 || x + w < camX - 40) return;
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
  if (d.x + w < camX - 40 || d.x - w > camX + fieldView.w + 40) return;
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
  if (d.x < camX - 200 || d.x > camX + fieldView.w + 200) return;
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
/** 의자: 인물 팩 공용 의자 그림(action-fx chair-<방향>, 테스트룸 C01·원점 (100,171))이 있으면 그걸로, 없으면 옛 코드 의자 */
function drawChair(c: CanvasRenderingContext2D, b: HqBox) {
  const CH = charFx()?.CHAIR;
  const im = CH?.[b.face === 'N' ? 'north' : b.face === 'W' ? 'west' : 'east'];
  if (im?.complete && im.naturalWidth) {
    const k = persp(b.y) * CHAR_K;
    c.save();
    c.translate(Math.round(b.x), Math.round(b.y));
    c.scale(k, k);
    c.imageSmoothingEnabled = false;
    c.drawImage(im, -100, -171);
    c.restore();
    return;
  }
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
  if (sx < -t.w - 100 || sx > fieldView.w + t.w + 100) return;
  const base = t.wall ? TOP - 70 : TOP + 26;
  if (drawPropArt(c, t.kind, undefined, t.x, base)) return;
  c.fillStyle = '#4a4f55';
  c.fillRect(t.x - t.w / 2, base - t.h, t.w, t.h);
}

function legacyDoor(c: CanvasRenderingContext2D, d: Door, camX: number) {
  const w = DOOR_W[d.kind];
  const sx = d.x - camX;
  if (sx < -w - 40 || sx > fieldView.w + w + 40) return;
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

/** 이름 인물 머리 꼭대기: 인물 팩(테스트룸 그림) 값, 없으면 실루엣 높이 */
const namedTop = (name: string) => (charArt(name) ? charTop(name) : -230);
/** 행위자 그리기: 이름 인물은 인물 팩(통합 테스트룸 생활 클립, 10-29) → 실루엣, 몹은 host가 주는 그림(없으면 실루엣) */
function drawLiveActor(c: CanvasRenderingContext2D, a: LiveActor, life: HubLife): void {
  const t = (life.lifeTime?.() ?? performance.now() / 1000) * 1000;
  const until = a.until === undefined ? undefined : a.until * 1000;
  if (a.seat && drawCharSeat(c, a.kind === 'named' ? a.name : a.look ?? a.name, a.seat.x, a.seat.y, a.face, t, a.seat.dir, a.seat.kind, (a.since ?? 0) * 1000, until)) return;
  if (a.kind === 'named' && drawCharClip(c, a.name, a.x, a.y, a.face, t, a.clip, (a.since ?? 0) * 1000, until)) return;
  if (a.kind === 'mob' && life.drawMob) return life.drawMob(c, a);
  silhouette(c, a);
}
/** 훈련 장비 (임시 코드 그림, 10-31 사용자 1안: 나중에 그림으로 교체). 발 자리 (x, y), 원근 배율. busy 면 맞는 것처럼 흔들린다 */
export function drawGear(c: CanvasRenderingContext2D, g: { kind: 'sandbag' | 'dummy' | 'target'; x: number; y: number; busy: boolean }, t: number): void {
  const k = persp(g.y);
  const sway = g.busy ? Math.sin(t * 9 + g.x) : 0;
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(g.x, g.y, 26 * k, 6 * k, 0, 0, Math.PI * 2); c.fill();
  if (g.kind === 'sandbag') {
    // 천장 사슬 + 매달린 붉은 가죽 자루
    const top = g.y - 300 * k, ang = sway * 0.12;
    c.strokeStyle = '#4a4f55'; c.lineWidth = Math.max(1, 3 * k);
    c.beginPath(); c.moveTo(g.x, top); c.lineTo(g.x + Math.sin(ang) * 70 * k, top + 70 * k); c.stroke();
    c.translate(g.x, top + 70 * k); c.rotate(ang);
    c.fillStyle = '#8a2e26'; c.fillRect(-22 * k, 0, 44 * k, 150 * k);
    c.fillStyle = '#6d231d'; c.fillRect(-22 * k, 0, 44 * k, 10 * k); c.fillRect(-22 * k, 140 * k, 44 * k, 10 * k);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(-16 * k, 14 * k, 6 * k, 120 * k);
  } else if (g.kind === 'dummy') {
    // 받침 + 나무 기둥 + 짚 몸통 + 머리 (맞으면 흔들림)
    const ang = sway * 0.06;
    c.fillStyle = '#3d3a36'; c.fillRect(g.x - 24 * k, g.y - 8 * k, 48 * k, 8 * k);
    c.translate(g.x, g.y - 8 * k); c.rotate(ang);
    c.fillStyle = '#6b4a2b'; c.fillRect(-5 * k, -150 * k, 10 * k, 150 * k);
    c.fillStyle = '#c9a65b'; c.fillRect(-26 * k, -205 * k, 52 * k, 90 * k);
    c.fillStyle = '#b08c45'; c.fillRect(-26 * k, -165 * k, 52 * k, 6 * k);
    c.fillStyle = '#6b4a2b'; c.fillRect(-48 * k, -195 * k, 96 * k, 8 * k);
    c.fillStyle = '#c9a65b'; c.beginPath(); c.arc(0, -225 * k, 20 * k, 0, Math.PI * 2); c.fill();
  } else {
    // 사격 과녁: 다리 둘 + 흰 판 + 붉은 고리 (맞으면 살짝 떨림)
    const dx = sway * 2 * k;
    c.strokeStyle = '#3d3a36'; c.lineWidth = Math.max(1, 4 * k);
    c.beginPath(); c.moveTo(g.x - 16 * k, g.y); c.lineTo(g.x - 8 * k, g.y - 90 * k); c.moveTo(g.x + 16 * k, g.y); c.lineTo(g.x + 8 * k, g.y - 90 * k); c.stroke();
    c.fillStyle = '#ece8df'; c.fillRect(g.x - 30 * k + dx, g.y - 190 * k, 60 * k, 100 * k);
    for (const [r, col] of [[24, '#c23b30'], [17, '#ece8df'], [10, '#c23b30'], [4, '#ece8df']] as const) {
      c.fillStyle = col; c.beginPath(); c.arc(g.x + dx, g.y - 140 * k, r * k, 0, Math.PI * 2); c.fill();
    }
  }
  c.restore();
}

/** 라바콘 하나 (발 x, y). 원근만큼 작아진다 */
function drawCone(c: CanvasRenderingContext2D, x: number, y: number): number {
  const k = persp(y), h = 34 * k, w = 22 * k;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(x, y, w * 0.75, 4 * k, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2a2a2a';
  c.fillRect(Math.round(x - w * 0.62), Math.round(y - 4 * k), Math.round(w * 1.24), Math.max(2, Math.round(4 * k)));
  c.fillStyle = '#f26a1b';
  c.beginPath(); c.moveTo(x - w / 2, y - 4 * k); c.lineTo(x - 3 * k, y - h); c.lineTo(x + 3 * k, y - h); c.lineTo(x + w / 2, y - 4 * k); c.closePath(); c.fill();
  c.fillStyle = '#f4f1e8';   // 흰 띠
  const t0 = 0.45, t1 = 0.62, at = (t: number) => w / 2 - (w / 2 - 3 * k) * t;
  c.beginPath(); c.moveTo(x - at(t0), y - 4 * k - (h - 4 * k) * t0); c.lineTo(x - at(t1), y - 4 * k - (h - 4 * k) * t1); c.lineTo(x + at(t1), y - 4 * k - (h - 4 * k) * t1); c.lineTo(x + at(t0), y - 4 * k - (h - 4 * k) * t0); c.closePath(); c.fill();
  return h;
}
/** 노란 테이프 한 칸: 두 라바콘 꼭대기를 잇고 가운데가 살짝 처지며 바람에 흔들린다. words = 「POLICE LINE」 글씨 */
function drawTape(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number, words: boolean): void {
  const k = persp((y0 + y1) / 2), sag = 5 * k + 2 * k * Math.sin(t * 2.3 + x0 * 0.05);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag * 2;
  c.strokeStyle = '#f2d21b';
  c.lineWidth = Math.max(2, 5 * k);
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.stroke();
  if (!words || Math.abs(x1 - x0) < 60 * k) return;
  c.save();
  c.fillStyle = '#111';
  c.font = `bold ${Math.max(6, Math.round(5 * k))}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('POLICE LINE', mx, (y0 + y1) / 2 + sag);
  c.restore();
}
/** 폴리스 라인: 시체 둘레 네모. back = 뒷줄 라바콘과 좌우 테이프, front = 앞줄 라바콘과 앞 테이프 */
export function drawCordon(c: CanvasRenderingContext2D, b: { x0: number; x1: number; y0: number; y1: number }, front: boolean, t: number): void {
  const n = Math.max(1, Math.round((b.x1 - b.x0) / 70));
  const xs = Array.from({ length: n + 1 }, (_, i) => b.x0 + ((b.x1 - b.x0) * i) / n);
  const y = front ? b.y1 : b.y0;
  c.save();
  const top = xs.map((x) => ({ x, y: y - drawCone(c, x, y) * 0.8 }));
  if (!front) {
    // 옆 테이프 (뒤 모서리 → 앞 모서리)
    const hb = 34 * persp(b.y0) * 0.8, hf = 34 * persp(b.y1) * 0.8;
    drawTape(c, b.x0, b.y0 - hb, b.x0, b.y1 - hf, t, false);
    drawTape(c, b.x1, b.y0 - hb, b.x1, b.y1 - hf, t, false);
  }
  for (let i = 0; i < top.length - 1; i++) drawTape(c, top[i].x, top[i].y, top[i + 1].x, top[i + 1].y, t, front);
  c.restore();
}
/** 그림이 없을 때 대역: 바닥 그림자 + 회색 몸 (검수 전 표시) */
export function silhouette(c: CanvasRenderingContext2D, a: { x: number; y: number; kind: 'named' | 'mob' }): void {
  const k = persp(a.y);
  const h = 230 * k, w = 64 * k;
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath();
  c.ellipse(a.x, a.y, w * 0.6, 9 * k, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = a.kind === 'named' ? '#6d7f94' : '#7b7f86';
  c.fillRect(a.x - w / 2, a.y - h, w, h * 0.78);
  c.beginPath();
  c.arc(a.x, a.y - h - w * 0.05, w * 0.36, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function drawObserver(c: CanvasRenderingContext2D, lines: string[]): void {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = '13px monospace';
  const w = Math.min(c.canvas.width - 16, Math.max(260, ...lines.map((l) => c.measureText(l).width + 20)));
  const h = Math.min(c.canvas.height - 16, lines.length * 17 + 12);
  // 오른쪽 위 (왼쪽 위는 HUD 초상화·체력)
  const x0 = c.canvas.width - w - 8;
  c.fillStyle = 'rgba(8,12,18,0.82)';
  c.fillRect(x0, 8, w, h);
  c.fillStyle = '#d7e3ef';
  lines.forEach((l, i) => { if (16 + 17 * (i + 1) < h + 8) c.fillText(l, x0 + 8, 8 + 17 * (i + 1)); });
  c.restore();
}
/** 머리 위 작은 말풍선: 아이콘 한 글자(! ? ♪ … #) 또는 대사 한 줄 */
function drawHeadBubble(c: CanvasRenderingContext2D, x: number, y: number, text: string, line: boolean): void {
  c.save();
  c.font = line ? '14px Galmuri11, sans-serif' : 'bold 16px Galmuri11, sans-serif';
  const w = Math.min(320, c.measureText(text).width + (line ? 16 : 12));
  const h = line ? 22 : 22;
  const bx = Math.round(x - w / 2), by = Math.round(y - h);
  c.fillStyle = text === '#' ? '#f2d0cc' : '#f4f1e8';
  c.strokeStyle = '#1b1f24';
  c.lineWidth = 2;
  c.fillRect(bx, by, w, h);
  c.strokeRect(bx, by, w, h);
  c.fillRect(Math.round(x) - 3, by + h, 6, 4);
  c.fillStyle = '#1b1f24';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, Math.round(x), by + h / 2 + 1, w - 8);
  c.restore();
}
