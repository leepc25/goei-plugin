// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳.
//   ui/    화면 틀·메뉴·HUD·터치·화면 효과 (mountGameShell)
//   audio/ 효과음·음악 (createGameAudio)
//   hq/    본부와 임무 흐름 (createHq)
// 층(stage/)·적(enemy/)·아이템(items/)·대사(story/)는 들어오는 대로 여기에 잇는다. 없으면 엔진 기본(훈련장·임시 적·기본 지급품).
import { clockText } from '../../../core/fieldclock';
import type { GameAssets, GameBridge } from '../../bridge';
import { persp, view } from './view';
import { KEYMAP } from './input';
import { drawGuardBar } from '../ui/pixelHud';
import { EileenPlayer } from '../eileen/player';
import { setPixelScale } from './contract';
import { mountTalk } from '../../talk';
import { createGameAudio } from '../audio';
import { VIDEO_AUDIO_EVENT, type VideoTrack } from '../audio/videoTrack';
import { createHq, idbSaves, setItemIconDrawer, setLineProvider, setSupplyCatalog, type MissionLaunch, type RunResult, type SaveSlots } from '../hq';
import { mountGameShell, type HudState, type Shell } from '../ui';
import { localStore, type SettingsStore } from '../ui/settings';
import { navigationFeedback } from './navigationFeedback';
import { syncNavigationButton } from '../ui/navigationButton';
import type { Body, GameEvent, HqModuleLike, RunConfigCore, RunResultCore, StageModule } from './contract';
import type { EngineModules, Game } from './game';
import { DEF_BY_KIND, arenaStage, createEnemy, isThreat } from '../enemy';
import { bindEnemyInteractions } from './enemyInteractions';
import { createElevatorStage } from '../stage';
import { drawMiniMap, drawRunMap } from '../stage/runmap';
import { CUTSCENES, VIDEOS, hqLines, mountStory, stageHooks, type AgentId, type StoryApi } from '../story';
import type { SpeakerId } from '../story/types';
import { itemsBlocking, linkItems, mountItemsOverlay } from './itemsLink';
import { makeHub, silhouette, type HubHost, type HubLife } from './hub';
import { createHqWorld } from '../../world/hq';
import { DEFAULT_CLOCK } from '../../world/clock';
import { hashSeed } from '../../world/rng';
import { observerLines } from '../../world/observer';
import { Lines, NPC_TYPE, type DialogueData, type LineCtx } from '../../world/lines';
import { Chatter } from '../../world/speech';
import dialogueData from '../../world/dialogue.json';
import type { Actor, SimEvent } from '../../world/actors';
import type { FactionView, PersonView } from '../../bridge';
import { FieldClock } from '../../world/clock';
import type { WorldSim } from '../../world/actors';
import { linkNpcTalk } from './npcLink';
import demoPhotos from '../story/demo-photos.json';
import { whereIs, LANE_TOP, LANE_BOT } from '../hq/map';
import { hasVisitAgent, hasVisitClip, visitAgentFaceCanvas } from '../art/visitAgents';
import { drawTestMan, hasTestPeople, testPlayerFace, testPlayerTop } from '../art/testPeople';
import { eileenHooks } from '../eileen/player';
import { AiEileen } from '../eileen/aiFighter';
import { Squad, DIFF, type Difficulty } from '../../combat/brain';
import { FieldFx, parseFxList } from '../fx/fieldFx';
import { SUPER_TEXT } from '../fx/superText';
import { drawTitleBg, setHudItemIcon } from '../ui';
import { SUPPLY_CATALOG, drawItemIcon } from '../items';
import { dummyStage, trainingStage } from './training';
import { fallbackEnemy, type EnemyFactory, type World } from './world';
import { SessionStore } from './sessionStore';

const local = (key: string) => ({
  load: () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  save: (v: string) => {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* 저장 못 해도 진행 */
    }
  },
});

type Launch = RunConfigCore & { launch?: MissionLaunch };

const SAVED_KEY = 'goei-game-saved';
const markSaved = () => local(SAVED_KEY).save('1');
const hasSaved = () => local(SAVED_KEY).load() === '1';

/** 본부 모듈을 엔진 모양으로 감싼다 */
/** 필드 시각 (초). 입장할 때 본편 시각과 합치고, 걸을 때마다 늘어난다 */
/** 필드 제목 화면 글자 (이름 「괴이 ː ANOMALY」) */
const VISIT_TITLE = { title: '괴이 ː ANOMALY', sub: '필드 · 요원들을 만나고 본편 대화를 이어갑니다' };
const fieldClock: { sec: number | null; place: string } = { sec: null, place: '' };

function hqAdapter(saves: SaveSlots, bridge: Partial<GameBridge> | undefined, ui: { chooseFloor: HubHost['chooseFloor']; sfx: (n: string) => void; closed?: () => void; resuming?: () => boolean; overlay?: HubHost['overlay'] }): HqModuleLike & { close(): void; goto(place: string): void; state(): { day: number; rescued: string[] }; visitReady: Promise<void>; visitor(): { agentId: string; name: string } } {
  const hq = createHq();
  const b = bridge as (Partial<GameBridge> & { slot?: number; photo?: (name: string) => string | undefined }) | undefined;
  const slot = b?.slot ?? 0;
  // 본부 걷기는 엔진 벨트 장면(engine/hub.ts): 건물 지도는 본부 모듈 map(), 엔진은 장면 옮기기·그리기. 메뉴 창(DOM)만 본부 모듈이 띄운다
  let root: HTMLElement | null = null;
  // 본부 방문: 상태 태그로 정한 방(사무실·휴게실·의무실)에 요원을 세운다. 들어가기 전에 한 번 읽는다
  let present: { name: string; room: string }[] = [];
  let visitor = { agentId: '', name: '' };
  let ready = false;
  const visitReady = (b?.visit
    ? b.visit.state().then((v) => { visitor = v.visitor; present = v.agents.filter((a) => a.room).map((a) => ({ name: a.name, room: a.room! })); }).catch(() => {})
    // 시연판(본편 연결 없음): 생태계를 볼 수 있게 요원 몇 명을 세운다
    : Promise.resolve().then(() => { present = [{ name: '잼트리', room: 'office' }, { name: '쟈알디', room: 'office' }, { name: '큐라스', room: 'lounge' }, { name: '고르고디오', room: 'lounge' }, { name: '데쥬레', room: 'infirmary' }]; })).then(() => { ready = true; });
  // 필드 시각은 본편 상태줄 시각에서 시작한다 (docs/필드_세계_NPC_설계.md 16-3). 유저 소속·신분도 같이
  let me: { faction: string; level: number | null } = { faction: 'A00', level: 1 };
  void b?.card?.().then((snap) => {
    if (fieldClock.sec === null && snap?.minute != null) fieldClock.sec = snap.minute * 60;
    if (snap) me = { faction: snap.identity?.faction || snap.faction || 'A00', level: snap.identity?.level ?? null };
  }).catch(() => {});
  // 인물 기록(호감 단계·호칭)과 세력 평판: 대사 칸·몹 반응에 쓴다. 기록이 갱신되면 다시 읽는다
  const peopleBy = new Map<string, PersonView>();
  const factionBy = new Map<string, FactionView>();
  const readPeople = () => {
    void b?.people?.people().then((l) => { peopleBy.clear(); for (const p of l) peopleBy.set(p.name, p); }).catch(() => {});
    void b?.people?.factions().then((l) => { factionBy.clear(); for (const f of l) factionBy.set(f.code, f); }).catch(() => {});
  };
  readPeople();
  b?.people?.onChange(readPeople);
  /** 이번 필드 방문 id (방문마다 호감·평판 상한을 따로 세게) */
  const visitId = `v${Date.now().toString(36)}`;
  const ROOM_SCENE: Record<string, string> = { office: 'office', lounge: 'lounge', infirmary: 'clinic' };
  // 필드 세계 (src/game/world): 요원은 처음 선 방에서 서성이고 이웃 장면을 오간다, 거리·로비는 몹이 오간다.
  // 씨앗: 주소 ?seed=숫자 가 있으면 그것 (재현), 없으면 이번 입장마다 새로
  const seedParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('seed') : null;
  const seed = seedParam ? (Number(seedParam) >>> 0 || hashSeed(seedParam)) : (Date.now() >>> 0);
  let sim: WorldSim | null = null;
  let observing = false;
  // 모델 대화 한 번(창을 열고 닫을 때까지) = 시계 +10분 (사용자 확정 2026-10-26)
  if (typeof window !== 'undefined') window.addEventListener('goei:talk-closed', () => { if (fieldClock.sec !== null) fieldClock.sec += DEFAULT_CLOCK.talk * 60; });
  if (typeof window !== 'undefined') window.addEventListener('keydown', (e) => { if (e.key === 'F9' || e.key === '`') { observing = !observing; e.preventDefault(); } });
  const world = () => {
    if (!sim && ready) {
      sim = createHqWorld(hq.map(), seed, present.filter((p) => ROOM_SCENE[p.room]).map((p) => ({ name: p.name, scene: ROOM_SCENE[p.room] })), hasVisitClip, { stance: (f) => factionBy.get(f)?.stage ?? null });
      chatter = new Chatter(sim, new Lines(dialogueData as unknown as DialogueData, sim.rng), lineCtx);
    }
    // 개발 도구·브라우저 시험: 세계를 들여다본다 (관찰 창과 같은 정보)
    if (sim) (globalThis as { __goeiWorld?: WorldSim }).__goeiWorld = sim;
    return sim;
  };
  let chatter: Chatter | null = null;
  /** 말하는 사람 기준 대사 칸: 플레이어 소속·직급, 적으로 보나 (호감 적대 구간·세력 적대·싸움 중) */
  const lineCtx = (a: Actor): LineCtx => {
    const hour = fieldClock.sec === null ? null : (fieldClock.sec / 3600) % 24;
    const named = a.def.kind === 'named' ? peopleBy.get(a.def.name) : undefined;
    const fac = a.def.kind === 'mob' ? sim?.mobFaction(a) ?? (dialogueData as unknown as DialogueData).npc[NPC_TYPE[a.def.archetype ?? a.def.name] ?? '']?.faction ?? null : named?.faction ?? null;
    const enemy = a.act === 'argue' || a.plan === 'chase' || named?.affinity.cell === 'hostile' || (!!fac && factionBy.get(fac)?.stage === 'hostile');
    return { hour, faction: me.faction, level: me.level, enemy };
  };
  // 필드 장부: 이름 인물에게 한 일은 그때그때, 몹은 장면마다 묶어서 (몹 개인 잡담·스쳐 지나감은 넘기지 않음, 13장)
  const mobHits = new Map<string, { n: number; witness?: { faction: string; named: boolean } }>();
  const flushMobs = (sceneId: string) => {
    const m = mobHits.get(sceneId);
    if (!m || !m.n) return;
    mobHits.delete(sceneId);
    const name = hq.map().scenes.find((s) => s.id === sceneId)?.name ?? sceneId;
    void b?.field?.record({ kind: 'provoke', text: `${name}에서 사람 ${m.n}명을 때렸다`, scene: name, weight: m.n >= 3 ? 2 : 1, visit: visitId, ...(m.witness ? { witness: m.witness } : {}) }).catch(() => {});
  };
  /** 이 장면에서 이미 싸웠나 (싸움 = 장면당 한 번 +10분, 사용자 확정) */
  let foughtHere = false;
  const record = (evs: SimEvent[]) => {
    for (const e of evs) {
      if (e.kind !== 'hurt') continue;
      if (!foughtHere) { foughtHere = true; if (fieldClock.sec !== null) fieldClock.sec += DEFAULT_CLOCK.fight * 60; }
      const w = sim;
      if (!w) return;
      // 목격: 그 장면의 소속 있는 사람 (이름 인물이 보면 named)
      const here = w.inScene(e.scene);
      const namedWit = here.find((q) => q.def.kind === 'named' && q.def.name !== e.who && peopleBy.get(q.def.name)?.faction);
      const mobWit = here.find((q) => w.mobFaction(q));
      const witness = namedWit ? { faction: peopleBy.get(namedWit.def.name)!.faction, named: true } : mobWit ? { faction: w.mobFaction(mobWit)!, named: false } : undefined;
      const sceneName = hq.map().scenes.find((s) => s.id === e.scene)?.name ?? e.scene;
      if (e.named) {
        void b?.field?.record({ kind: 'hurt', text: `${sceneName}에서 ${e.who}을(를) 때렸다`, scene: sceneName, who: [e.who], weight: 2, visit: visitId, ...(witness ? { witness } : {}) }).catch(() => {});
      } else {
        const m = mobHits.get(e.scene) ?? { n: 0 };
        m.n++;
        m.witness ??= witness;
        mobHits.set(e.scene, m);
      }
    }
  };
  let flushT = 0;
  const clockView = () => { const c = new FieldClock(fieldClock.sec === null ? null : fieldClock.sec / 60); return c; };
  // 필드 행위자를 에일린 공격 표적으로 (전투 몸이 아니므로 가짜 몸을 건넨다. 보이는 장면만)
  let lifeScene = '';
  eileenHooks.extraTargets = () => {
    const w = sim;
    if (!w || !lifeScene) return [];
    return w.inScene(lifeScene).filter((a) => a.act !== 'down').map((a) => ({
      x: a.x, y: a.y, z: 0,
      body: { id: -1, team: 'enemy', kind: 'npc', x: a.x, y: a.y, z: 0, dir: a.face, hp: 1, hpMax: 1, alive: true, stop: 0, frame: () => ({ hit: [], hurt: [] }), step: () => {},
        applyHit: (h: { dir: 1 | -1; attackId: number }) => (w.hitActor(a.def.id, h.dir, h.attackId) ? { kind: 'hit' as const } : { kind: 'immune' as const }) } as unknown as Body,
    }));
  };
  const life: HubLife = {
    tick: (dt, at) => {
      if (lifeScene && lifeScene !== at.scene) { flushMobs(lifeScene); foughtHere = false; }
      lifeScene = at.scene;
      const w = world();
      if (!w) return;
      w.step(dt, { ...at, hour: fieldClock.sec === null ? null : (fieldClock.sec / 3600) % 24 });
      const evs = w.events.splice(0);
      record(evs);
      chatter?.step(dt, at.scene, at.x, evs);
      if ((flushT += dt) > 20) { flushT = 0; flushMobs(at.scene); }
    },
    lifeTime: () => sim?.time ?? 0,
    hit: (sceneId, boxes, dir) => world()?.hitBoxes(sceneId, boxes, dir).length ?? 0,
    actors: (sceneId) => (world()?.inScene(sceneId) ?? []).map((a) => ({ id: a.def.id, name: a.def.name, kind: a.def.kind, x: a.x, y: a.y, face: a.face, look: a.def.look, moving: a.act === 'walk', clip: a.clip, since: a.clipAt, icon: a.icon, say: a.say })),
    observer: (sceneId) => (observing && sim ? observerLines(sim, clockView(), sceneId, seed) : null),
    drawMob: (c, a) => { if (!drawTestMan(c, a.x, a.y, a.face)) silhouette(c, a); },
  };
  const visitors = (sceneId: string) => {
    const here = present.filter((p) => ROOM_SCENE[p.room] === sceneId && hasVisitAgent(p.name));
    const sc = hq.map().scenes.find((s) => s.id === sceneId);
    if (!sc || !here.length) return [];
    const [top, bot] = sc.lane ?? [LANE_TOP, LANE_BOT];
    // 방 가운데 쪽에 고르게
    const slots = [[0.36, 0.55], [0.5, 0.35], [0.62, 0.75], [0.44, 0.9], [0.72, 0.45], [0.28, 0.8]].map(([fx, fy]) => [sc.length * fx, fy]);
    return here.slice(0, slots.length).map((p, i) => ({ name: p.name, x: slots[i][0], y: top + (bot - top) * slots[i][1], face: (slots[i][0] > sc.length / 2 ? -1 : 1) as 1 | -1 }));
  };
  const hub = makeHub(
    {
      map: () => hq.map(),
      openPlace: (id) => hq.openPlace(id as never),
      bark: (place) => hq.bark(place as never),
      chooseFloor: (o, pick) => ui.chooseFloor(o, pick),
      sfx: (n) => ui.sfx(n),
      visitors,
      life,
      // 장면을 옮기면 장부에 이동 사건과 지금 위치(확정 사실)를 남긴다
      entered: (to, from, walkedPx) => {
        fieldClock.place = to.name;
        // 장면 넘어가기 = 10분 (사용자 확정 2026-10-26, 설정에서 조정 예정). 걸은 거리는 시계와 무관
        void walkedPx;
        const sec = DEFAULT_CLOCK.scene * 60;
        if (fieldClock.sec !== null) fieldClock.sec += sec;
        const at = fieldClock.sec === null ? '' : ` (${clockText(fieldClock.sec)})`;
        void b?.field?.record({ kind: 'move', text: `${from.name} → ${to.name}${at}`, scene: to.name, weight: 1, fact: { key: '주인공 위치', value: to.name } }).catch(() => {});
        if (fieldClock.sec !== null) void b?.field?.record({ kind: 'move', text: `필드 시각 ${clockText(fieldClock.sec)}`, scene: to.name, weight: 1, fact: { key: '필드 시각', value: clockText(fieldClock.sec) } }).catch(() => {});
      },
      overlay: ui.overlay,
      hour: () => (fieldClock.sec === null ? null : (fieldClock.sec / 3600) % 24),
      depart: () => hq.depart(),
      armed: () => hq.armed(),
      // 본부 대화창이 떠 있으면 머리 위 표시를 숨긴다 (독립 검수: 브리핑 뒤 ↓ 표시)
      busy: () => typeof document !== 'undefined' && !!document.querySelector('.hq-talk, .hq-over:not(:empty)'),
    },
    (place) => whereIs(place as never),
  );
  return {
    ready: () => hq.ready(),
    visitReady,
    visitor: () => visitor,
    hub: () => hub,
    state: () => hq.state,
    goto: (place: string) => hub.goto(place),
    isOpen: () => hq.isOpen(),
    close: () => hq.close(),
    mount(r, host) {
      root = r;
      hq.mount(r, {
        deploy: (l) => !bridge?.visit && host.deploy({ ...l, hpMax: l.stats?.hp, launch: l } as Launch),
        load: () => saves.read(slot as never),
        resuming: ui.resuming,
        save: (d) => (markSaved(), saves.write(slot as never, d, { title: '자동 저장', summary: `${hq.state.day}일차`, schema: 'goei-hq/1' })),
        saves,
        link: bridge?.card
          ? {
              card: async () => {
                const c = await bridge.card!();
                return c ? { agents: c.agents.map((a) => ({ id: a.id, name: a.name, english: a.english, photo: (b?.photo && a.photo ? b.photo(a.photo) : '') ?? '' })), events: c.events.map((e) => ({ kind: e.kind, name: e.name, loc: e.loc, state: e.state })) } : null;
              },
              report: async (p: unknown) => {
                bridge.report?.(p as never);
                return '정산 결과를 넘겼습니다. 시작 화면의 본편 연동에서 보고서 붙이기·기록 로어북을 고를 수 있어요.';
              },
            } as never
          : undefined,
        closed: () => ui.closed?.(),
        goto: (id: string) => hub.goto(id),
      }, { walk: false });
    },
    onReturn(r, run) {
      const l = (run as Launch).launch;
      if (l) hq.onReturn({ ...(r as unknown as RunResult), runId: (r as unknown as RunResult).runId ?? l.runId } as RunResult, l);
    },
    unmount: () => hq.unmount(),
  };
}

/** 엔진 결과 → 본부 정산 모양 */
function toHqResult(r: RunResultCore, w: World): RunResult {
  const n = r.notes as Partial<RunResult> & Record<string, unknown>;
  return {
    how: r.how,
    runId: (w.run as Launch).launch?.runId,
    missionDone: (n.missionDone as boolean | undefined) ?? r.how === 'return',
    depth: (n.depth as number | undefined) ?? Math.max(1, w.floor?.depth ?? r.floors),
    floors: r.floors,
    kills: r.kills,
    cash: n.cash ?? 0,
    shards: n.shards ?? 0,
    debt: n.debt ?? 0,
    budget: n.budget ?? 0,
    teeth: n.teeth ?? 0,
    bag: n.bag ?? [],
    itemsLeft: n.itemsLeft ?? w.items.map((it) => (it && it.n > 0 ? { id: it.id, n: it.n } : null)),
    found: n.found ?? [],
    sent: n.sent ?? [],
    rescued: n.rescued ?? [],
    bigHit: !!n.bigHit,
    seconds: r.timeSec,
    notes: r.notes,
  } as RunResult;
}

function hudState(w: World, shell: Shell): HudState {
  const p = w.player;
  const boss = w.boss();
  const f = w.floor;
  const d = f.depth ?? 0;
  return {
    agent: { name: p.label ?? '쟈알디', color: '#c0453a', portrait: (p as { core?: unknown }).core ? testPlayerFace(64, p.dir < 0) : null },
    hp: p.hp,
    maxHp: p.hpMax,
    energy: p.skillCd > 0 ? 75 - p.skillCd : 75,
    maxEnergy: 75,
    gauge: p.gauge,
    armor: p.armor,
    // 에일린은 탄창 대신 우하단 기술 상자에 총열 열을 보인다
    weapon: heldWeapon(w) ?? ((p as { core?: unknown }).core ? null : { name: '권총', mag: p.ammo, magMax: p.mag, reserve: p.reserve, reload: p.moveKey === 'reload' ? p.mf / 4 : null }),
    items: w.items.map((it) => ({ id: it?.id, label: it?.label ?? '', count: it?.n ?? 0 })),
    field: fieldClock.sec !== null || fieldClock.place ? { clock: fieldClock.sec === null ? undefined : clockText(fieldClock.sec), place: fieldClock.place || undefined } : undefined,
    floor: { depth: d ? (d <= 3 ? `L${d}` : `B-${d - 3}`) : '', name: f.title },
    favor: 0,
    money: { cash: (w.notes.cash as number | undefined) ?? 0, budget: 0, research: 0, teeth: 0 },
    boss: boss ? { name: boss.label, hp: boss.hp, max: boss.hpMax } : null,
    // 아래 자막은 3초까지만 (바닥 띠를 오래 가리지 않게)
    message: w.subtitle && w.tick - w.subtitleAt < 90 ? w.subtitle.text : undefined,
    // 가드 게이지는 가드 중이거나 닳았을 때만
    meters: p.guarding || p.guardMeter < 100 ? [{ label: '가드', v: p.guardMeter, max: 100, color: '#9ad08a' }] : [],
    compact: shell.touchShown,
    device: shell.touchShown ? 'touch' : shell.input.last,
    navigation: navigationFeedback(w),
  };
}

/** 임시 무기를 든 동안 무기 칸은 그 무기의 남은 횟수·탄 (아이템 모듈이 notes.held에 남김) */
function heldWeapon(w: World) {
  const h = w.notes.held as { name: string; uses: number; max: number } | null | undefined;
  return h ? { name: h.name, mag: h.uses, magMax: h.max, reserve: 0, reload: null } : null;
}

export interface Wiring {
  mods: EngineModules;
  /** 게임이 붙을 상자 (껍데기가 있으면 그 무대) */
  box: HTMLElement;
  bind(game: Game): void;
}

export function engineModules(box: HTMLElement, bridge?: Partial<GameBridge>): Wiring {
  const rawSaves: SaveSlots = (bridge?.saves as unknown as SaveSlots) ?? idbSaves('goei-game');
  const session = new SessionStore(rawSaves, (bridge as { slot?: number })?.slot ?? 0, typeof localStorage === 'undefined' ? undefined : localStorage);
  setSupplyCatalog(SUPPLY_CATALOG as never);
  setHudItemIcon(drawItemIcon as never);
  setItemIconDrawer(drawItemIcon as never);
  const audio = createGameAudio(local('goei-game-audio'));
  let game: Game | null = null;
  /** 필드 입장 판정. 막히면 이유를 보이고 「밖에 있어요」로 고칠 수 있다. 들어가도 되면 true */
  async function gate(): Promise<boolean> {
    const f = bridge?.field;
    if (!f?.entry) return true;
    let info = await f.entry().catch(() => null);
    while (info && !info.allow) {
      const i = await shell.choose({ title: '지금은 들어갈 수 없어요', lines: [info.reason ?? ''], options: ['닫기', '밖에 있어요'] });
      if (i !== 1) return false;
      f.override?.('outside');
      info = await f.entry().catch(() => null);
    }
    if (info?.notice) await shell.choose({ title: '알림', lines: [info.notice], options: ['확인'] });
      return true;
  }
  // 게임 안 설정: 리스에서는 플러그인이 이 채팅 변수로 둔다(메인 설정 → 필드와 같은 값). 아직 없으면 이 기기에 남은 값으로 시작
  const uiPrefs = bridge?.uiPrefs;
  const store: SettingsStore | undefined = uiPrefs ? {
    load: async () => (await uiPrefs.load().catch(() => null)) ?? localStore.load(),
    save: (t) => { uiPrefs.save(t); localStore.save(t); },
  } : undefined;
  const shell = mountGameShell(box, {
    synth: true,
    store,
    title: bridge?.visit ? VISIT_TITLE.title : '차원 승강기',
    sub: bridge?.visit ? VISIT_TITLE.sub : 'ANOMALY SIMULATION · 관리국 액션',
    pauseInfo: () => session.error ?? (game?.inHub ? '본부 자동 저장' : '안전 지점 자동 저장 · 전투 중 중단하면 직전 안전 지점부터'),
    onNew: async () => {
      if (bridge?.visit) { if (await gate()) game?.start_new(); return; }
      await session.ready;
      if (session.checkpoint) { await game?.resume(session.checkpoint); game?.endRun('withdraw'); return; }
      // 새 저장: 영상 깃발을 지운다 (저장마다 한 번)
      for (const k of Object.keys(story.flags)) if (k.startsWith('cut_') || k === 'told_rope') delete story.flags[k];
      saveFlags();
      game?.start_new();
    },
    onContinue: async () => {
      if (bridge?.visit) { if (await gate()) game?.start_new(); return; }
      await session.ready;
      try {
        if (session.checkpoint) await game?.resume(session.checkpoint);
        else game?.start_new();
      } catch {
        // 원본은 남긴다. 저장 오류를 새 출동으로 조용히 덮어쓰지 않는다.
        void shell.choose({ title: '출동 복원 실패', lines: ['저장 기록을 읽지 못했습니다. 원본 기록은 보존했습니다.'], options: ['닫기'] });
      }
    },
    hasSave: () => session.hasSave || hasSaved(),
    onRetreat: () => bridge?.visit ? bridge.close?.() : game?.endRun('withdraw'),
    onTitle: () => game?.toTitle(),
    toLocal: bridge?.viewport ? (x, y, el) => bridge.viewport!.toLocal(x, y, el) : undefined,
    field: bridge?.visit ? {
      onExit: () => bridge.close?.(),
      // 옛 플러그인(mode 없음)은 전체 화면 칸을 숨긴다
      fullscreen: bridge.viewport && 'mode' in bridge.viewport ? { enter: (k) => bridge.viewport!.enter(k), exit: () => bridge.viewport!.exit(), mode: () => bridge.viewport!.mode ?? null } : undefined,
    } : undefined,
  });
  // 필드 전투 효과 틀 (fx/fieldFx.ts). 히트스톱·필살 컷인 동안은 월드를 멈춘다(mods.frozen)
  const ffx = new FieldFx();
  (globalThis as { __goeiFieldFx?: unknown }).__goeiFieldFx = ffx; // 시험용
  ffx.sfx = (n) => audio.event({ type: n === 'super' ? 'super' : 'hit', kind: n === 'slam' ? 'super' : undefined, strength: 3 } as never);
  const cutins = new Map<string, HTMLImageElement>();
  if (bridge?.visit && bridge.assets) void loadFieldFx(bridge.assets, ffx, cutins);
  const inField = () => !!game?.inHub && !!bridge?.visit && !mods.blocking?.() && !shell.paused;
  /** 필드 필살 미리 보기 (전투가 아직 없어 피해는 없다): 컷인 → 흰 번쩍·흔들림·파편 */
  const previewSuper = () => {
    const w = game?.world;
    if (!w || ffx.inSuper()) return;
    const me = hq.visitor();
    const name = me.name || '방문자';
    const t = SUPER_TEXT[name] ?? { color: '#C8283C', name: '필살기', sub: '' };
    const fallback = (me.agentId && visitAgentFaceCanvas(name, 60)) || testPlayerFace(60);
    void ffx.super_({ ...t, art: cutins.get(name), art2: cutins.get(`${name}_2`), fallback, eye: { x: 0.62, y: 0.42 } }).then(() => {
      ffx.flash('#fff', 0.1, 0.7);
      ffx.shake(14, 0.6);
      const p = w.player;
      ffx.sparks_(p.x, p.y - 120, 30, t.color, 6);
      ffx.ring(p.x, p.y, 20, 260, t.color, 0.45);
      ffx.scorch(p.x, p.y, 160, 3);
    });
  };
  const fieldFxKeys = (e: KeyboardEvent) => {
    if ((e.code !== 'KeyS' && e.code !== 'KeyW') || e.repeat || !inField()) return;
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    previewSuper();
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', fieldFxKeys, true);
  const stageStore = {
    load: () => {
      if (session.meta) return session.meta as never;
      try {
        const t = localStorage.getItem('goei-game-stage');
        return t ? JSON.parse(t) : null;
      } catch {
        return null;
      }
    },
    save: (m: unknown) => {
      session.setMeta(m);
      try {
        localStorage.setItem('goei-game-stage', JSON.stringify(m));
      } catch {
        /* 저장 못 해도 진행 */
      }
    },
  };
  // NPC 자유 대화 (npcLink.ts): 껍데기 놀이판 층에 대화창, 승객은 층 모듈 훅으로
  // 본부 방문: 머리 위 이름표·말풍선과 아래 한 줄 입력 (talk.ts)
  const visit = bridge?.visit ? mountTalk(shell.stage.ui, bridge.visit, bridge.field) : null;
  const npc = linkNpcTalk({
    visit: visit ? name => { if (name) visit.open(name); } : undefined,
    layer: shell.stage.ui,
    bridge,
    settings: () => shell.settings,
    agent: () => runAgent,
    day: () => hq.state().day,
    rescued: () => hq.state().rescued,
    photo: (k) => (bridge as { photo?: (n: string) => string | undefined } | undefined)?.photo?.(k) || (demoPhotos as Record<string, string>)[k],
    sfx: (n) => audio.play(n as never),
    onOpen: (on) => shell.touch.setVisible(!on && shell.mode === 'play'),
  });
  (globalThis as { __goeiNpc?: unknown }).__goeiNpc = npc; // 시험용
  (globalThis as { __goeiStage?: unknown }).__goeiStage = shell.stage; // 시험용
  // 필드 요원: 지금 그림(몸 약 97도트)을 화면 약 255px로 (PixelLab 256 캔버스 몸 약 170도트 ×1.5 크기를 미리 보기). 원근은 view.persp
  setPixelScale(bridge?.visit ? 2.625 : 2.75);
  (globalThis as { __goeiSetPixel?: (p: number) => void }).__goeiSetPixel = setPixelScale; // 시험용
  // 강화 선택(기본기획서 15.2)은 껍데기 선택 창으로: 창이 열린 동안 게임이 멈춘다
  const elevator = createElevatorStage(stageStore, {
    ...npc.stageHooks(stageHooks()),
    pickUpgrade: (v, done) => {
      void shell.choose({ title: `${v.why} · 강화 하나`, lines: ['이번 출동 동안만 남는다. 같은 계열 셋이면 완성 효과.'], options: v.options.map((o) => `[${o.set}] ${o.label} — ${o.text}`), cancel: false }).then((i) => done(Math.max(0, i)));
      return true;
    },
  });
  // 출동 지도 (Z·Tab·M, 터치 「지도」): 열린 동안 게임이 멈춘다. 구석 미니맵은 늘
  let mapOpen = false;
  let guardA = 0; // 방어 게이지 불투명도
  const offMapKey = shell.input.on((code, down) => {
    if (!down) return;
    if ((code === 'KeyZ' || code === 'KeyM') && world && world.stage === elevator && !game?.inHub && !shell.paused && !story.isBlocking()) mapOpen = !mapOpen;
  });
  setLineProvider(hqLines);
  // 시연용 방: 적 시험장은 적 모듈 것(?start=arena), 아이템 진열(?start=items)
  const itemStage: StageModule = {
    id: 'itemroom',
    label: '아이템 진열실',
    firstFloor: () => ({ id: 'itemroom', title: '아이템 진열실', length: 3200, startX: 300, exitX: Infinity, banner: '아이템 진열실 · E 줍기·들기 · A 던지기·휘두르기', encounters: [{ triggerX: 0, lockFrom: 0, lockTo: 3200, waves: [[{ kind: 'dummy', x: 1600, y: 560 }, { kind: 'dummy', x: 2400, y: 620 }]] }] }),
    nextFloor: () => null,
  };
  // 대련 방 (전투 AI 시험, docs/전투_AI_설계.md): ?start=stage=spar  ·  난이도 ?ai=easy|normal|hard|nightmare
  const aiDiff: Difficulty = (() => { try { const v = new URLSearchParams(location.search).get('ai'); return v && v in DIFF ? (v as Difficulty) : 'normal'; } catch { return 'normal'; } })();
  const sparStage: StageModule = {
    id: 'spar',
    label: '대련',
    firstFloor: () => ({
      id: 'spar-room', title: '대련', length: 2400, startX: 500, exitX: Infinity,
      banner: `대련 · 전투 AI (${aiDiff}) · 1:1 뒤 1:2`,
      encounters: [{ triggerX: 0, lockFrom: 0, lockTo: 2400, waves: [[{ kind: 'ai-eileen', x: 1100, y: 580 }], [{ kind: 'ai-eileen', x: 1300, y: 540 }, { kind: 'ai-eileen', x: 200, y: 640 }]] }],
    }),
    nextFloor: () => null,
  };
  let squad = new Squad(DIFF[aiDiff].melee);
  let aiN = 0;
  const unknownKinds = new Set<string>();
  const enemyFactory: EnemyFactory = (spec, w) => {
    if (spec.kind === 'ai-eileen' && w.player instanceof EileenPlayer) {
      if (aiN === 0) squad = new Squad(DIFF[aiDiff].melee);
      const n = ++aiN;
      // 성향은 상대마다 다르게 (돌격형 / 신중형 / 견제형)
      const personas = [{ aggression: 0.75, patience: 0.35, zoning: 0.2, courage: 0.9 }, { aggression: 0.35, patience: 0.8, zoning: 0.3, courage: 0.8 }, { aggression: 0.4, patience: 0.5, zoning: 0.85, courage: 0.7 }];
      const ai = new AiEileen((w.player as unknown as { clips: ConstructorParameters<typeof AiEileen>[0] }).clips, { id: `ai${n}`, grade: 'B', difficulty: aiDiff, persona: personas[(n - 1) % personas.length], seed: 1000 + n, squad, label: `AI 에일린 ${n}` });
      ai.x = spec.x; ai.y = spec.y;
      ai.hp = ai.hpMax = 160;
      return ai as never;
    }
    if (DEF_BY_KIND[spec.kind]) {
      const sp = spec as typeof spec & { affixes?: never };
      return createEnemy(spec.kind, spec.x, spec.y, () => w.rand(), { elite: spec.elite, affixes: sp.affixes }) as never;
    }
    if (!spec.kind.startsWith('dummy') && !unknownKinds.has(spec.kind)) {
      unknownKinds.add(spec.kind);
      console.warn('[goei] 적 모듈에 없는 종류 → 임시 적:', spec.kind);
    }
    return fallbackEnemy(spec, w);
  };
  // 대사·컷신: 말풍선은 늘, 대화창·컷신이 열리면 전투를 멈춘다
  let world: World | null = null;
  let runAgent: AgentId = 'eileen'; // 주인공은 에일린 (쟈알디는 부장 NPC)
  let openingOn = false; // 제목 화면 오프닝 영상이 도는 중 (메뉴가 열려 있어도 영상은 멈추지 않는다)
  const storyRoot = document.createElement('div');
  // 넘치는 창(층 단추 등)이 바깥 틀에 스크롤바를 만들면 틀 크기가 바뀌어 화면을 다시 맞추고, 그게 되풀이되며 화면이 떨렸다 (리스 작은 창)
  storyRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;overflow:hidden';
  shell.stage.root.appendChild(storyRoot);
  const attachVideoAudio = (event: Event) => audio.attachMedia((event as CustomEvent<VideoTrack>).detail);
  storyRoot.addEventListener(VIDEO_AUDIO_EVENT, attachVideoAudio);
  const unmountItems = mountItemsOverlay(shell.stage.root);
  const savedFlags = (() => {
    try {
      return JSON.parse(localStorage.getItem('goei-game-story') ?? 'null') ?? undefined;
    } catch {
      return undefined;
    }
  })();
  // 메뉴 소리와 설정 화면의 음량 밀대를 소리 모듈에 잇는다 (환경음·메뉴 버스는 효과음 밀대를 따른다)
  shell.menu.onSound = (k) => audio.play(k === 'move' ? 'uiMove' : k === 'ok' ? 'uiOk' : 'uiBack');
  let vol = '';
  const syncVolume = () => {
    const s = shell.settings;
    const key = `${s.master}/${s.music}/${s.sfx}`;
    if (key === vol) return;
    vol = key;
    audio.setVolume('master', s.master);
    audio.setVolume('music', s.music);
    audio.setVolume('sfx', s.sfx);
    audio.setVolume('amb', s.sfx * 0.8);
    audio.setVolume('ui', s.sfx * 0.7);
  };
  // 발소리: 엔진이 step 사건을 따로 내지 않으므로 땅 위에서 움직인 거리로 낸다 (보폭 걸음 55 / 달리기 75)
  let foot = { x: 0, y: 0, d: 0, w: null as unknown };
  const footsteps = (w: { player: { x: number; y: number; airborne: boolean; running: boolean } }) => {
    const p = w.player;
    if (foot.w !== w) foot = { x: p.x, y: p.y, d: 0, w };
    const moved = Math.hypot(p.x - foot.x, (p.y - foot.y) * 1.5);
    foot.x = p.x;
    foot.y = p.y;
    if (p.airborne || moved > 60) return void (foot.d = 0);
    foot.d += moved;
    if (foot.d >= (p.running ? 75 : 55)) {
      foot.d = 0;
      audio.event({ type: 'step', x: p.x, vol: p.running ? 0.9 : 0.6 });
    }
  };
  (globalThis as { __goeiStoryStart?: (id: string) => void }).__goeiStoryStart = (id) => (CUTSCENES[id] || VIDEOS[id] ? story.cutscene(id) : story.say(id));
  const story: StoryApi = mountStory(
    storyRoot,
    {
      getAgent: () => runAgent,
      sfx: (n) => audio.event({ type: 'custom', name: n } as never),
      shake: (ms, amp) => shell.fx.onGameEvent({ type: 'shake', ms, amp } as never),
      anchor: (id) => {
        if (id !== 'agent' || !world) return null;
        // 껍데기 root 좌표(돌린 화면이어도 root 안에서는 가로)로 계산: 게임 화면(.gs-stage)은 translate(tx,ty) scale(k)
        const st = shell.canvas.parentElement as HTMLElement;
        const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(st.style.transform);
        const k = shell.stage.scale || 1;
        const ox = st.offsetLeft + (m ? +m[1] : 0) - storyRoot.offsetLeft,
          oy = st.offsetTop + (m ? +m[2] : 0) - storyRoot.offsetTop;
        const p = world.player;
        // 말풍선은 머리 위, 화면 가장자리(터치 버튼 띠) 안쪽으로
        const gx = Math.max(200, Math.min(1000, p.x - world.camX));
        // 보이는 터치 버튼(오른쪽 묶음)의 왼쪽 끝을 넘지 않게. 버튼 위치는 배치 좌표 translate라 회전과 무관
        let maxX: number | undefined;
        const tp = storyRoot.ownerDocument.querySelector<HTMLElement>('.tp');
        if (tp && tp.offsetParent) {
          let tx = 0;
          for (let n: HTMLElement | null = tp; n && n !== storyRoot.offsetParent; n = n.offsetParent as HTMLElement | null) tx += n.offsetLeft;
          for (const b of tp.querySelectorAll<HTMLElement>('.tp-b:not(.item):not(.top)')) {
            if (!b.offsetWidth || getComputedStyle(b).display === 'none') continue;
            const left = tx - storyRoot.offsetLeft + new DOMMatrix(getComputedStyle(b).transform).m41;
            if (left > storyRoot.clientWidth / 2) maxX = Math.min(maxX ?? Infinity, left);
          }
        }
        // 놀이판(게임 화면) 안쪽으로만: 폰 가로의 좌우 버튼 띠에 걸치지 않게
        let lo = ox,
          hi = Math.min(maxX ?? Infinity, ox + 1280 * k);
        // 문·승강기·벽 가구 앞을 피해, 머리에서 가장 가까운 빈 벽 구간 안에 말풍선을 둔다 (독립 검수: 말풍선이 문을 가림)
        const gap = bubbleGap(world, gx);
        if (gap) {
          lo = Math.max(lo, ox + gap[0] * k);
          hi = Math.min(hi, ox + gap[1] * k);
        }
        return { x: ox + gx * k, y: oy + Math.max(120, p.y - p.z - (world.hintShown ? 362 : 290)) * k, minX: lo, maxX: hi };
      },
      emit: (ev, arg) => world?.emit({ type: 'custom', name: ev, data: { arg } } as never),
      paused: () => shell.paused && !openingOn,
    },
    { saved: savedFlags },
  );
  (globalThis as { __goeiStory?: StoryApi }).__goeiStory = story; // 시험용
  const saveFlags = () => {
    try {
      localStorage.setItem('goei-game-story', JSON.stringify(story.flags));
    } catch {
      /* 저장 못 해도 진행 */
    }
  };
  const storyKeys = (e: KeyboardEvent) => {
    if (!story.isBlocking()) return;
    if (e.code === 'Escape') story.skip();
    else if (/^Digit[1-9]$/.test(e.code)) story.choose(Number(e.code.slice(5)) - 1);
    else if (['Space', 'Enter', 'KeyE', 'KeyZ', 'KeyA'].includes(e.code)) story.advance();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', storyKeys, true);
  const saves: SaveSlots = {
    ...session.hqSaves,
    restore: async n => {
      const hq = await session.hqSaves.restore!(n);
      if (hq) elevator.reloadMeta();
      return hq;
    },
  };
  // 엘리베이터 층 단추 (본부). 1~5 숫자키·Esc, 누르면 닫힌다
  let floorPick: ((i: number | null) => void) | null = null;
  const floorBox = document.createElement('div');
  floorBox.className = 'goei-engine-elev';
  floorBox.hidden = true;
  storyRoot.appendChild(floorBox);
  const closeFloors = (i: number | null) => {
    floorBox.hidden = true;
    const f = floorPick;
    floorPick = null;
    f?.(i);
  };
  // 키보드: 방향키로 고르고 Enter·Space·E로 누른다 (사용자 2026-10-25)
  let floorSel = -1;
  const floorBtns = () => [...floorBox.querySelectorAll('button')] as HTMLButtonElement[];
  const markFloor = (i: number) => {
    floorSel = i;
    floorBtns().forEach((b, k) => b.classList.toggle('sel', k === i));
  };
  const stepFloor = (d: number) => {
    const bs = floorBtns();
    for (let k = 1; k <= bs.length; k++) {
      const j = (floorSel + d * k + bs.length * 2) % bs.length;
      if (!bs[j].disabled) return markFloor(j);
    }
  };
  const chooseFloor: HubHost['chooseFloor'] = (opts, pick) => {
    floorPick = pick;
    floorBox.innerHTML = opts.map((o, i) => `<button type="button" data-i="${i}"${o.open && !o.here ? '' : ' disabled'}${o.here ? ' class="here"' : ''}>${o.label}</button>`).join('');
    floorBox.hidden = false;
    markFloor(floorBtns().findIndex((b) => !b.disabled));
    audio.play('panelButton' as never);
  };
  floorBox.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b && !b.disabled) closeFloors(Number(b.dataset.i));
  });
  const floorKeys = (e: KeyboardEvent) => {
    if (floorBox.hidden) return;
    if (e.code === 'Escape') closeFloors(null);
    // 한 줄 배치 (사용자 2026-10-25: 두 줄은 헷갈림)
    else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') stepFloor(-1);
    else if (e.code === 'ArrowDown' || e.code === 'ArrowRight') stepFloor(1);
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
      if (!e.repeat && floorSel >= 0 && !floorBtns()[floorSel]?.disabled) closeFloors(floorSel);
    } else if (/^Digit[1-9]$/.test(e.code)) {
      // 숫자키 = 층 숫자(1·2·3), 지하는 4=B1, 5=B2, 6=B3
      const n = e.code.slice(5);
      const want = n === '4' ? 'B1' : n === '5' ? 'B2' : n === '6' ? 'B3' : n;
      const b = [...floorBox.querySelectorAll('button')].find((q) => q.textContent === want) as HTMLButtonElement | undefined;
      if (b && !b.disabled) closeFloors(Number(b.dataset.i));
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', floorKeys, true);
  /* 도트 영상 컷신 자리 (지휘자 결정, 검수10): 한 전환에 하나, 저장마다 한 번(이야기 깃발 cut_<id>), 늘 건너뛰기.
     opening = 제목 화면 대기 오프닝(반복) · first_day = 새 저장 첫 본부 · first_entry = 첫 출동 · first_call = 처음 L2 이상
     attic = 첫 로프 귀환 · exit = 출구 층 · dinner = 첫 임무 성공 정산 뒤 · evac = 첫 후송 */
  const canFilm = () => location.protocol !== 'file:'; // file:// 시연판은 프레임 목록을 못 읽는다
  const cutOnce = (id: string, done?: () => void): boolean => {
    if (!VIDEOS[id] || !canFilm() || story.flags[`cut_${id}`] || story.isBlocking()) return false;
    story.flags[`cut_${id}`] = 1;
    saveFlags();
    story.cutscene(id, done);
    return true;
  };
  let dinnerDue = false;
  const hq = hqAdapter(saves, bridge, {
    resuming: () => !!session.checkpoint,
    chooseFloor,
    sfx: (n) => audio.play(n as never),
    closed: () => {
      if (dinnerDue) (dinnerDue = false), cutOnce('dinner');
    },
    overlay: visit ? (c, people, player) => visit.draw(c, people, player) : undefined,
  });
  // 본부 메뉴 창이 열려 있으면 Esc는 창 닫기 (껍데기 일시정지보다 먼저)
  // 본부 메뉴 창(임무 창구·정비실 등) 키보드 (사용자 2026-10-25: 키보드가 안 먹는다): 방향키로 단추를 고르고 Enter·Space·E로 누른다, Esc 닫기
  let hqSel: HTMLElement | null = null;
  const hqButtons = () => [...document.querySelectorAll<HTMLElement>('.goei-engine-hq button:not([disabled]), .goei-engine-hq [data-act]:not(button)')].filter((b) => b.offsetParent && !b.closest('[hidden]'));
  const markHq = (b: HTMLElement | null) => {
    hqSel?.classList.remove('hq-kbsel');
    hqSel = b;
    b?.classList.add('hq-kbsel');
    b?.scrollIntoView?.({ block: 'nearest' });
  };
  const hqKeys = (e: KeyboardEvent) => {
    if (!game?.inHub || !hq.isOpen?.() || npc.isOpen()) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const list = hqButtons();
    if (hqSel && !list.includes(hqSel)) hqSel = null;
    const at = hqSel ? list.indexOf(hqSel) : -1;
    const first = () => list.find((b) => b.classList.contains('primary') || b.classList.contains('on')) ?? list[0] ?? null;
    if (e.code === 'Escape') hq.close();
    else if (e.code === 'ArrowDown' || e.code === 'ArrowRight' || e.code === 'Tab') markHq(at < 0 ? first() : list[(at + 1) % list.length]);
    else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') markHq(at < 0 ? first() : list[(at - 1 + list.length) % list.length]);
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
      if (e.repeat) return e.preventDefault();
      const b = hqSel ?? first();
      hqSel = null;
      b?.click();
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const saveOnHide = () => { game?.checkpoint(); void session.flush(); };
  // 창의 다른 탭으로 가면 일시정지 메뉴를 열어 둔다 (게임 멈춤·소리 끔). 돌아오면 「계속」으로 이어 간다
  let hiddenNow = false;
  const offHidden = bridge?.onHidden?.((h) => {
    hiddenNow = h;
    if (h) {
      visit?.close();
      if (shell.mode === 'play' && !shell.paused) shell.openPause();
      audio.setPaused(true);
      saveOnHide();
    }
  });
  window.addEventListener('pagehide', saveOnHide);
  document.addEventListener('visibilitychange', saveOnHide);
  window.addEventListener('keydown', hqKeys, true);
  // 오락실 오프닝: 제목 화면에서 20초 가만히 있으면 opening 영상, 끝나면 다시 기다린다. 아무 입력이나 대기 시간을 처음부터
  let openingT: ReturnType<typeof setTimeout> | null = null;
  const cancelStoryForScene = () => {
    if (openingT) clearTimeout(openingT);
    openingT = null;
    story.cancel();
    openingOn = false;
    const menuEl = shell.stage.root.querySelector<HTMLElement>('.gs-ui');
    if (menuEl) menuEl.style.visibility = '';
    storyRoot.style.zIndex = '15';
    storyRoot.style.visibility = shell.paused ? 'hidden' : '';
  };
  const armOpening = () => {
    if (openingT) clearTimeout(openingT);
    openingT = null;
    // 필드: 오프닝 영상은 차원 승강기 이야기라 틀지 않는다
    if (bridge?.visit || !VIDEOS.opening || !canFilm()) return;
    openingT = setTimeout(() => {
      openingT = null;
      if (shell.mode !== 'title' || story.isBlocking()) return armOpening();
      // 제목 메뉴(DOM)가 영상 위를 덮지 않게 도는 동안 숨긴다
      const menuEl = shell.stage.root.querySelector<HTMLElement>('.gs-ui');
      if (menuEl) menuEl.style.visibility = 'hidden';
      storyRoot.style.visibility = ''; // 제목 메뉴가 열려 있는 동안은 '멈춤'이라 영상 층이 숨어 있다
      storyRoot.style.zIndex = '60'; // 제목 그림·메뉴 층 위로
      openingOn = true;
      story.cutscene('opening', () => {
        openingOn = false;
        if (menuEl) menuEl.style.visibility = '';
        storyRoot.style.zIndex = '15';
        if (shell.paused) storyRoot.style.visibility = 'hidden';
        if (shell.mode === 'title') armOpening();
      });
    }, 20000);
  };
  // 오프닝 중엔 아무 입력이나 건너뛰기, 대기 중엔 대기 시간을 처음부터
  const titleInput = (e: Event) => {
    if (openingOn) {
      story.skip();
      e.preventDefault();
      e.stopImmediatePropagation();
    } else if (openingT && shell.mode === 'title') armOpening();
  };
  window.addEventListener('keydown', titleInput, true);
  window.addEventListener('pointerdown', titleInput, true);
  // 에일린 테스트룸 전투의 소리는 화면 효과 없이 소리만
  eileenHooks.sfx = (e) => audio.event(e as never);
  const listeners: ((e: GameEvent) => void)[] = [
    (e) => {
      audio.event(e as never);
      if (game?.inHub && (e.type === 'enter:floor' || e.type === 'custom')) return; // 본부: 승강기 안내·층 제목 없음
      shell.fx.onGameEvent(e as never);
      story.event(e.type, e as never);
      if (e.type === 'run:end') saveFlags();
      if (e.type === 'enter:floor' && world) {
        const f = world.floor;
        if (f.id.startsWith('ending')) cutOnce('exit');
        else if ((f.depth ?? 0) >= 2) cutOnce('first_call');
      }
    },
  ];
  const mods: EngineModules = {
    saveCheckpoint: v => { markSaved(); session.setCheckpoint(v); },
    frozen: () => ffx.frozen(),
    stages: [elevator, trainingStage, dummyStage, arenaStage, itemStage, sparStage],
    enemyFactory,
    hq,
    hqLayer: () => shell.stage.ui,
    hud: false,
    blocking: () => !!visit?.isOpen() || story.isBlocking() || itemsBlocking() || !floorBox.hidden || npc.isOpen() || mapOpen,
    covered: () => story.isVideoPlaying(),
    listeners,
    surface: { canvas: shell.canvas, ctx: shell.ctx },
    paused: () => shell.paused,
    openTitle: () => {
      cancelStoryForScene();
      world = null; // 지난 본부 영상 예약도 다음 화면을 가리지 않게 한다.
      mapOpen = false;
      shell.openTitle();
      armOpening();
    },
    onPlay: () => shell.play(),
    frame: (dt) => {
      ffx.opt = { shake: shell.settings.shake, flash: shell.settings.flash, numbers: shell.settings.numbers };
      ffx.update(shell.paused ? 0 : dt);
      { const o = ffx.camera(); shell.canvas.style.translate = o.x || o.y ? `${o.x}px ${o.y}px` : ''; }
      syncVolume();
      audio.setPaused(hiddenNow || (shell.paused && !openingOn));
      audio.setCutscene(story.isVideoPlaying());
      story.update(dt);
      shell.frame(dt);
      shell.input.endFrame();
    },
    overlay: (ctx, w, dt) => {
      if (!w) return;
      audio.setListener(w.camX + 640, 640);
      footsteps(w);
      ctx.save();
      ctx.scale(view.zoom, view.zoom);
      ctx.translate(-w.drawCamX - view.crop, -view.cropY);
      shell.fx.drawWorld(ctx);
      ffx.drawWorld(ctx);
      ctx.restore();
      shell.fx.drawScreen(ctx, w.player.hp / w.player.hpMax);
      const hs = hudState(w, shell);
      if (npc.isOpen()) hs.message = undefined; // 대화창이 열려 있으면 자막·안내 한 줄은 숨긴다 (같은 말이 두 번, 폰 키보드 자리)
      if (mods.blocking?.() || shell.paused) hs.navigation = undefined;
      // 필드(방문): 전투 HUD 대신 주인공 칸 (도트 얼굴·이름·체력·필살 게이지). 대화창·메뉴가 열려 있으면 숨긴다
      let cardEnd = 0;
      if (game?.inHub && !mods.blocking?.() && !shell.paused) {
        const me = hq.visitor();
        const name = me.name || (testPlayerFace() ? '에일린' : '방문자');
        const face = (me.agentId && visitAgentFaceCanvas(name, 34)) || testPlayerFace(64, w.player.dir < 0) || visitAgentFaceCanvas('쟈알디', 34);
        // 좌상단 초상화 상자 (사용자 2026-10-25: 위 목표 띠 대신)
        shell.hud.drawFieldCard(ctx, { name, face, hp: w.player.hp, maxHp: w.player.hpMax, gauge: w.player.gauge, compact: hs.compact, top: true, items: hs.items, device: hs.device }, dt);
      }
      // 왼쪽 아래 기술 칸 줄 (에일린): 터치 버튼이 있으면 그 자리라 숨긴다. 자막은 그 오른쪽에
      const core = (w.player as { core?: { P: Record<string, any> } }).core;
      if (core && !shell.touchShown && !mods.blocking?.() && !shell.paused) {
        const P = core.P, clip = P.clip?.id as string | undefined, off = ['down', 'belly', 'stun'].includes(P.mode);
        const lv = P.charge >= 2 ? 3 : P.charge > 1.3 ? 2 : P.charge > 0.5 ? 1 : 0;
        const key = (b: string) => { const c = Object.keys(KEYMAP).find((k) => KEYMAP[k] === b); return c ? c.replace(/^Key/, '') : '?'; };
        cardEnd = shell.hud.drawSkillBox(ctx, { compact: hs.compact, slots: [
          { key: key('light'), icon: 'punch', name: '약공', cd: 0, off, active: ['9', '10', '11'].includes(clip ?? '') },
          { key: key('heavy'), icon: 'kick', name: '강공', cd: 0, off, active: clip === '12' },
          { key: key('shoot'), icon: 'gun', name: '사격', cd: P.overT > 0 ? P.overT / 2.6 : 0, cdText: P.overT > 0 ? P.overT.toFixed(1) : undefined, off, active: clip === '15', bar: P.heat / 100, hot: P.overT > 0 || P.heat > 70 },
          { key: key('charge'), icon: 'bolt', name: '충전', cd: 0, off, active: P.mode === 'charge', bar: P.mode === 'charge' ? P.charge / 2.2 : undefined, badge: P.mode === 'charge' && lv ? ['', '1', '2', 'MAX'][lv] : undefined },
          { key: key('skill'), icon: 'wave', name: '기술', cd: 0, off, active: clip === '22_1' },
          { key: key('super'), icon: 'star', name: '필살', cd: 0, off: off || P.sp < 100, full: P.sp >= 100, bar: P.sp / 100 },
        ] }, dt);
      }
      if (!game?.inHub) shell.hud.draw(ctx, { ...hs, messageLeft: cardEnd }, dt); // 본부에서는 전투 HUD 없음
      else if (!mods.blocking?.() && !shell.paused) {
        // 본부: 대사는 말하는 사람 머리 위 말풍선 (사용자 2026-10-25: 아래 검은 자막 상자 대신). 그 밖의 안내 한 줄은 주인공 머리 위
        const z = view.zoom, toX = (x: number) => (x - w.drawCamX - view.crop) * z, toY = (y: number) => (y - view.cropY) * z;
        const sp = (w.stage as { speech?: () => { who: string; text: string; x: number; y: number; top: number } | null }).speech?.();
        if (sp) shell.hud.drawSpeech(ctx, { x: toX(sp.x), y: toY(sp.y + sp.top) - 6, who: sp.who, text: sp.text, compact: hs.compact });
        else if (hs.message) {
          const p = w.player, head = (hasTestPeople() ? testPlayerTop() : -230) * persp(p.y);
          shell.hud.drawSpeech(ctx, { x: toX(p.x), y: toY(p.y - p.z + head) - 10, who: '', text: hs.message, compact: hs.compact });
        }
      }
      // 방어 게이지: 캐릭터 머리 위, 막는 중·회복 중에만 (가득 차면 천천히 사라진다)
      const ep = w.player instanceof EileenPlayer ? w.player : null;
      if (ep && !mods.blocking?.() && !shell.paused) {
        const show = ep.guard < 99.5 || ep.core.P.mode === 'block';
        guardA = show ? Math.min(1, guardA + dt * 8) : Math.max(0, guardA - dt * 2.5);
        const z = view.zoom, head = testPlayerTop() * persp(ep.y);
        const gx = (ep.x - w.drawCamX - view.crop) * z, gy = (ep.y - ep.z + head * 0.92 - view.cropY) * z - 12;
        drawGuardBar(ctx, gx + 5, gy, ep.guard / 100, ep.guardBroken, guardA, performance.now() / 1000);
      }
      // 본부: 위 안내 띠 대신 캐릭터 옆 말풍선 (닿는 문·자리가 있을 때만, 캐릭터와 겹치지 않게 옆에)
      const tg = game?.inHub && !mods.blocking?.() && !shell.paused ? (w.stage as { nearInfo?: () => { text: string; locked: boolean } | null }).nearInfo?.() : null;
      if (tg) {
        const p = w.player, z = view.zoom;
        const head = (hasTestPeople() ? testPlayerTop() : -230) * persp(p.y);
        const sx = (p.x - w.drawCamX - view.crop) * z, sy = (p.y - p.z + head * 0.72 - view.cropY) * z;
        const half = 46 * persp(p.y) * 1.15 * z;
        const side: 1 | -1 = sx > ctx.canvas.width - 320 ? -1 : 1;
        const key = hs.device === 'pad' ? 'B' : hs.device === 'touch' || hs.compact ? '조' : 'E';
        shell.hud.drawPrompt(ctx, { x: sx + side * (half + 18), y: sy, side, key, text: tg.locked ? `${tg.text} · 잠김` : tg.text, locked: tg.locked, compact: hs.compact });
      }
      ffx.drawScreen(ctx);
      if (shell.paused) mapOpen = false;
      if (!game?.inHub && w.stage === elevator) {
        const m = elevator.mapView();
        const t = performance.now() / 1000;
        // 폰처럼 화면이 작게 줄면 지도 글자·표식을 그만큼 키운다
        const U = Math.min(2.2, Math.max(1, 1280 / Math.max(1, shell.canvas.clientWidth || 1280)));
        if (m && mapOpen) drawRunMap(ctx, m, w.player.x, t, U);
        else if (m) drawMiniMap(ctx, m, w.player.x, t, U);
      } else mapOpen = false;
      syncNavigationButton(shell.canvas, hs.navigation);
      shell.touch.setItems(hs.items);
      shell.touch.setGauge(w.player.gauge / 100);
      shell.touch.hint('reload', w.player.ammo <= 2 && w.player.reserve > 0);
      shell.fx.drawTransition(ctx);
    },
    onScene: (name) => {
      if (name === 'title' || name === 'hq') audio.floor(name as never);
      if (name === 'hq') shell.play(); // 본부도 걷는 장면: 타이틀 메뉴 닫고 조작·터치 켜기
    },
    onPause: (p) => {
      // 메뉴가 열리면 말풍선·GO 표시를 숨긴다
      storyRoot.style.visibility = p ? 'hidden' : '';
      if (world) world.paused = p;
    },
    onWorld: (w, run) => {
      // 괴이 안으로 들어갔다: 장부에 남긴다 (끝날 때 결과 한 줄이 더 들어간다)
      if (bridge?.field && (run as { stageId?: string }).stageId !== 'hq') {
        const label = String((run as { stageId?: string }).stageId ?? '괴이');
        void bridge.field.record({ kind: 'enter_anomaly', text: `작전 투입: ${label}`, weight: 3, fact: { key: '작전', value: `투입 중 (${label})` } }).catch(() => {});
        w.on((e) => {
          if (e.type !== 'run:end') return;
          const how = (e as unknown as { how: string }).how;
          const text = `작전 종료 (${how === 'evac' ? '후송' : how === 'withdraw' ? '철수' : '귀환'}): ${label}, 처치 ${w.kills}, 부상 ${Math.max(0, Math.round(w.player.hpMax - w.player.hp))}`;
          void bridge.field!.record({ kind: 'exit_anomaly', text, weight: 3, fact: { key: '작전', value: `종료 (${how === 'evac' ? '후송' : how === 'withdraw' ? '철수' : '귀환'})` } }).catch(() => {});
        });
      }
      cancelStoryForScene();
      world = w;
      runAgent = run.agent as AgentId;
      // 첫 출동: 도트 영상 first_entry, 끝나면 로프 안내 자막 한 줄 (영상을 못 틀면 자막만)
      if (run.stageId !== 'hq' && (run as Launch).launch && !story.flags.told_rope) {
        story.flags.told_rope = 1;
        const rope = () => world === w && w.say('(잼트리) 타고 온 걸로는 못 돌아와요. 귀환은 다락방 로프.', 3);
        if (!cutOnce('first_entry', () => setTimeout(rope, 1200))) setTimeout(rope, 4600);
      }
      // 새 저장의 첫 본부: first_day (첫 출동 영상과 사이에 본부를 한 번 걷게 된다)
      // The rebuilt starting room is shown immediately. The old full-frame first_day
      // film is retired until its replacement uses the new room and layered staging.
      w.hitFx = false; // 맞을 때 효과는 껍데기 fx가 그린다
      if (run.stageId === 'hq') return void npc.attach(w, { hub: (hq.hub?.() ?? null) as never, hq: true }); // 본부 걷기: 아이템·대사 안내·전투 기록 없음
      w.notes.runId = (run as Launch).launch?.runId;
      // 승강기 안내 방송은 층 모듈 hooks를 대사 모듈이 채우면 거기서 나온다 (여기서 따로 부르지 않음: 중복)
      w.on((e) => {
        if (e.type === 'hp:low') w.notes.bigHit = true;
      });
      // 진압 임무: 쓰러뜨린 수호자 종류를 남긴다
      const bossesDown = new Set<number>();
      w.hooks.push(() => {
        for (const bd of w.bodies) {
          if (!(bd as { boss?: boolean }).boss || bossesDown.has(bd.id) || bd.hp > 0) continue;
          bossesDown.add(bd.id);
          ((w.notes.bosses ??= []) as string[]).push(bd.kind);
        }
      });
      w.threat = (b) => (DEF_BY_KIND[b.kind] ? isThreat(b as never) : true);
      bindEnemyInteractions(w);
      w.on((e) => {
        if (e.type !== 'custom') return;
        const d = (e.data ?? {}) as { dmg?: number; text?: string };
        if (e.name === 'evac' && !w.ended) w.ended = 'evac';
        else if (e.name === 'hurtPlayer') w.api.hurtPlayer(d.dmg ?? 10);
        else if (e.name === 'debuff' && d.text) w.say(d.text, 1.5);
      });
      const items = linkItems(w, run);
      npc.attach(w, { items, hq: false });
      if (run.stageId === 'itemroom') items.showcase();
      w.hooks.push(() => items.tick());
      w.underlays.push((c, camX) => items.draw(c, camX));
    },
    toHqResult,
    afterRun: (how, done) => {
      let fired = false;
      const once = () => (fired ? undefined : ((fired = true), done()));
      // 첫 후송 = evac, 첫 로프 귀환(귀환·철수) = attic. 그 밖엔 영상 없이 바로 정산. 첫 임무 성공이면 정산 창을 닫은 뒤 dinner
      if (how === 'return' && world?.notes.missionDone !== false) dinnerDue = !story.flags.cut_dinner;
      if (!cutOnce(how === 'evac' ? 'evac' : 'attic', once)) once();
    },
    drawIdle: (name, ctx, t) => {
      if (name === 'title') bridge?.visit ? drawTitleBg(ctx, t, VISIT_TITLE.title, VISIT_TITLE.sub) : drawTitleBg(ctx, t);
    },
    boot: (g) => { void Promise.all([session.ready, hq.visitReady]).then(() => { elevator.reloadMeta(); if (bridge?.visit || !bootFromUrl(g)) g.toTitle(); }); return true; },
    dispose: () => {
      window.removeEventListener('pagehide', saveOnHide);
      document.removeEventListener('visibilitychange', saveOnHide);
      offHidden?.();
      npc.dispose();
      unmountItems();
      const g = globalThis as { __goeiStory?: unknown; __goeiStoryStart?: unknown; __goeiNpc?: unknown };
      delete g.__goeiStory;
      delete g.__goeiNpc;
      delete g.__goeiStoryStart;
      world = null;
      game = null;
      window.removeEventListener('keydown', storyKeys, true);
      offMapKey();
      window.removeEventListener('keydown', titleInput, true);
      window.removeEventListener('pointerdown', titleInput, true);
      if (openingT) clearTimeout(openingT);
      window.removeEventListener('keydown', hqKeys, true);
      window.removeEventListener('keydown', fieldFxKeys, true);
      window.removeEventListener('keydown', floorKeys, true);
      saveFlags();
      storyRoot.removeEventListener(VIDEO_AUDIO_EVENT, attachVideoAudio);
      story.dispose();
      setLineProvider(null);
      visit?.dispose();
      setPixelScale(2.75);
      audio.dispose();
      shell.dispose();
    },
  };
  return {
    mods,
    box: shell.stage.root,
    bind: (g) => {
      game = g;
    },
  };
}

/** 시작 꼬리표 (게임_통합_규격 1장): ?start=hq | stage=elevator|training|dummy | arena | items | story=<장면> */
function bootFromUrl(g: Game): boolean {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(location.search);
  } catch {
    return false;
  }
  const start = q.get('start');
  if (!start) return false;
  const [k, v] = start.split('=');
  if (k === 'hq') g.start_new();
  else if (k === 'stage') g.start_new(v || undefined);
  else if (k === 'arena') g.start_new('arena');
  else if (k === 'items') g.start_new('itemroom');
  else if (k === 'story') {
    g.start_new('dummy');
    if (v) (globalThis as { __goeiStoryStart?: (id: string) => void }).__goeiStoryStart?.(v);
  } else return false;
  return true;
}

/** 화면 x(게임 좌표) 근처에서 문·승강기·벽 가구와 겹치지 않는 폭 300 이상 빈 구간 [시작, 끝] (화면 좌표) */
function bubbleGap(world: World, gx: number): [number, number] | null {
  const cam = world.camX;
  const solid: [number, number][] = (world.floor.keepOut ?? []).filter(([a, b]) => b - a >= 60).map(([a, b]) => [a - cam, b - cam]);
  for (const pr of world.floor.props ?? []) {
    if (!/door|elevator|exit|panel|shutter|mirror|goalwall/.test(pr.kind)) continue;
    const h = Math.max(pr.w, 200) / 2 + 20;
    solid.push([pr.x - h - cam, pr.x + h - cam]);
  }
  solid.sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let at = Math.max(0, gx - 520);
  const end = Math.min(1280, gx + 520);
  for (const [a, b] of solid) {
    if (b <= at) continue;
    if (a >= end) break;
    if (a - at >= 300) gaps.push([at, a]);
    at = Math.max(at, b);
  }
  if (end - at >= 300) gaps.push([at, end]);
  if (!gaps.length) return null;
  const dist = (g: [number, number]) => (gx < g[0] ? g[0] - gx : gx > g[1] ? gx - g[1] : 0);
  gaps.sort((a, b) => dist(a) - dist(b));
  return dist(gaps[0]) < 360 ? gaps[0] : null;
}

/** 필드 효과 팩 (game-pack/field-fx, 아직 없음): fx/fx_목록.txt + fx/<시트>.png, cutin/<인물>.png(_2). 없으면 코드 효과만 */
async function loadFieldFx(assets: GameAssets, ffx: FieldFx, cutins: Map<string, HTMLImageElement>) {
  try {
    if (!(await assets.ready('field-fx'))) return;
    const list = await assets.bytes('field-fx', 'fx/fx_목록.txt');
    const img = async (file: string) => {
      const u = await assets.url('field-fx', file);
      if (!u) return null;
      const im = new Image();
      im.src = u;
      await im.decode();
      return im;
    };
    for (const d of list ? parseFxList(new TextDecoder().decode(list)) : []) {
      const im = await img(`fx/${d.name}.png`).catch(() => null);
      if (im) ffx.register(d, im);
    }
    for (const name of Object.keys(SUPER_TEXT)) {
      for (const k of [name, `${name}_2`]) {
        const im = await img(`cutin/${k}.png`).catch(() => null);
        if (im) cutins.set(k, im);
      }
    }
  } catch { /* 팩이 없거나 깨졌으면 코드 효과만 */ }
}
