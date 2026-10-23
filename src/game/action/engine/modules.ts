// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳.
//   ui/    화면 틀·메뉴·HUD·터치·화면 효과 (mountGameShell)
//   audio/ 효과음·음악 (createGameAudio)
//   hq/    본부와 임무 흐름 (createHq)
// 층(stage/)·적(enemy/)·아이템(items/)·대사(story/)는 들어오는 대로 여기에 잇는다. 없으면 엔진 기본(훈련장·임시 적·기본 지급품).
import type { GameBridge } from '../../bridge';
import { view } from './view';
import { setPixelScale } from './contract';
import { mountTalk } from '../../talk';
import { createGameAudio } from '../audio';
import { VIDEO_AUDIO_EVENT, type VideoTrack } from '../audio/videoTrack';
import { createHq, idbSaves, setItemIconDrawer, setLineProvider, setSupplyCatalog, type MissionLaunch, type RunResult, type SaveSlots } from '../hq';
import { mountGameShell, type HudState, type Shell } from '../ui';
import { navigationFeedback } from './navigationFeedback';
import { syncNavigationButton } from '../ui/navigationButton';
import type { GameEvent, HqModuleLike, RunConfigCore, RunResultCore, StageModule } from './contract';
import type { EngineModules, Game } from './game';
import { DEF_BY_KIND, arenaStage, createEnemy, isThreat } from '../enemy';
import { bindEnemyInteractions } from './enemyInteractions';
import { createElevatorStage } from '../stage';
import { drawMiniMap, drawRunMap } from '../stage/runmap';
import { CUTSCENES, VIDEOS, hqLines, mountStory, stageHooks, type AgentId, type StoryApi } from '../story';
import type { SpeakerId } from '../story/types';
import { itemsBlocking, linkItems, mountItemsOverlay } from './itemsLink';
import { makeHub, type HubHost } from './hub';
import { linkNpcTalk } from './npcLink';
import demoPhotos from '../story/demo-photos.json';
import { whereIs, LANE_TOP, LANE_BOT } from '../hq/map';
import { hasVisitAgent } from '../art/visitAgents';
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
function hqAdapter(saves: SaveSlots, bridge: Partial<GameBridge> | undefined, ui: { chooseFloor: HubHost['chooseFloor']; sfx: (n: string) => void; closed?: () => void; resuming?: () => boolean; overlay?: HubHost['overlay'] }): HqModuleLike & { close(): void; goto(place: string): void; state(): { day: number; rescued: string[] }; visitReady: Promise<void> } {
  const hq = createHq();
  const b = bridge as (Partial<GameBridge> & { slot?: number; photo?: (name: string) => string | undefined }) | undefined;
  const slot = b?.slot ?? 0;
  // 본부 걷기는 엔진 벨트 장면(engine/hub.ts): 건물 지도는 본부 모듈 map(), 엔진은 장면 옮기기·그리기. 메뉴 창(DOM)만 본부 모듈이 띄운다
  let root: HTMLElement | null = null;
  // 본부 방문: 상태 태그로 정한 방(사무실·휴게실·의무실)에 요원을 세운다. 들어가기 전에 한 번 읽는다
  let present: { name: string; room: string }[] = [];
  const visitReady = b?.visit
    ? b.visit.state().then((v) => { present = v.agents.filter((a) => a.room).map((a) => ({ name: a.name, room: a.room! })); }).catch(() => {})
    : Promise.resolve();
  const ROOM_SCENE: Record<string, string> = { office: 'office', lounge: 'lounge', infirmary: 'clinic' };
  const visitors = (sceneId: string) => {
    const here = present.filter((p) => ROOM_SCENE[p.room] === sceneId && hasVisitAgent(p.name));
    const sc = hq.map().scenes.find((s) => s.id === sceneId);
    if (!sc || !here.length) return [];
    const [top, bot] = sc.lane ?? [LANE_TOP, LANE_BOT];
    // 사무실(시작 방)은 왼쪽 책상을 피해 오른쪽 바닥에, 다른 방은 가운데 쪽에 고르게
    const slots = sceneId === 'office'
      ? [[630, 0.4], [1000, 0.5], [1130, 0.85], [620, 0.9], [900, 0.15], [1180, 0.3]]
      : [[0.36, 0.55], [0.5, 0.35], [0.62, 0.75], [0.44, 0.9], [0.72, 0.45], [0.28, 0.8]].map(([fx, fy]) => [sc.length * fx, fy]);
    return here.slice(0, slots.length).map((p, i) => ({ name: p.name, x: slots[i][0], y: top + (bot - top) * slots[i][1], face: (slots[i][0] > (sceneId === 'office' ? 820 : sc.length / 2) ? -1 : 1) as 1 | -1 }));
  };
  const hub = makeHub(
    {
      map: () => hq.map(),
      openPlace: (id) => hq.openPlace(id as never),
      bark: (place) => hq.bark(place as never),
      chooseFloor: (o, pick) => ui.chooseFloor(o, pick),
      sfx: (n) => ui.sfx(n),
      visitors,
      overlay: ui.overlay,
      // 본부 대화창이 떠 있으면 머리 위 표시를 숨긴다 (독립 검수: 브리핑 뒤 ↓ 표시)
      busy: () => typeof document !== 'undefined' && !!document.querySelector('.hq-talk, .hq-over:not(:empty)'),
    },
    (place) => whereIs(place as never),
  );
  return {
    ready: () => hq.ready(),
    visitReady,
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
    agent: { name: p.label ?? '쟈알디', color: '#c0453a' },
    hp: p.hp,
    maxHp: p.hpMax,
    energy: p.skillCd > 0 ? 75 - p.skillCd : 75,
    maxEnergy: 75,
    gauge: p.gauge,
    armor: p.armor,
    weapon: heldWeapon(w) ?? { name: '권총', mag: p.ammo, magMax: p.mag, reserve: p.reserve, reload: p.moveKey === 'reload' ? p.mf / 4 : null },
    items: w.items.map((it) => ({ id: it?.id, label: it?.label ?? '', count: it?.n ?? 0 })),
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
  const shell = mountGameShell(box, {
    synth: true,
    title: bridge?.visit ? '필드' : '차원 승강기',
    sub: bridge?.visit ? '요원들을 만나고 본편 대화를 이어갑니다' : 'ANOMALY SIMULATION · 관리국 액션',
    pauseInfo: () => session.error ?? (game?.inHub ? '본부 자동 저장' : '안전 지점 자동 저장 · 전투 중 중단하면 직전 안전 지점부터'),
    onNew: async () => {
      if (bridge?.visit) { game?.start_new(); return; }
      await session.ready;
      if (session.checkpoint) { await game?.resume(session.checkpoint); game?.endRun('withdraw'); return; }
      // 새 저장: 영상 깃발을 지운다 (저장마다 한 번)
      for (const k of Object.keys(story.flags)) if (k.startsWith('cut_') || k === 'told_rope') delete story.flags[k];
      saveFlags();
      game?.start_new();
    },
    onContinue: async () => {
      if (bridge?.visit) { game?.start_new(); return; }
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
    onTitle: () => bridge?.visit ? bridge.close?.() : game?.toTitle(),
    toLocal: bridge?.viewport ? (x, y, el) => bridge.viewport!.toLocal(x, y, el) : undefined,
    field: bridge?.visit ? { onExit: () => bridge.close?.() } : undefined,
  });
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
  const visit = bridge?.visit ? mountTalk(shell.stage.ui, bridge.visit) : null;
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
  const unknownKinds = new Set<string>();
  const enemyFactory: EnemyFactory = (spec, w) => {
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
  let runAgent: AgentId = 'jyaldi';
  let openingOn = false; // 제목 화면 오프닝 영상이 도는 중 (메뉴가 열려 있어도 영상은 멈추지 않는다)
  const storyRoot = document.createElement('div');
  storyRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15';
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
  const chooseFloor: HubHost['chooseFloor'] = (opts, pick) => {
    floorPick = pick;
    floorBox.innerHTML = opts.map((o, i) => `<button type="button" data-i="${i}"${o.open && !o.here ? '' : ' disabled'}${o.here ? ' class="here"' : ''}>${o.label}</button>`).join('');
    floorBox.hidden = false;
    audio.play('panelButton' as never);
  };
  floorBox.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b && !b.disabled) closeFloors(Number(b.dataset.i));
  });
  const floorKeys = (e: KeyboardEvent) => {
    if (floorBox.hidden) return;
    if (e.code === 'Escape') closeFloors(null);
    else if (/^Digit[1-9]$/.test(e.code)) {
      // 숫자키 = 층 숫자(1·2·3), 지하는 4=B1, 5=B2
      const n = e.code.slice(5);
      const want = n === '4' ? 'B1' : n === '5' ? 'B2' : n;
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
  const hqKeys = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' || !game?.inHub || !hq.isOpen?.()) return;
    hq.close();
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
    if (!VIDEOS.opening || !canFilm()) return;
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
    stages: [elevator, trainingStage, dummyStage, arenaStage, itemStage],
    enemyFactory,
    hq,
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
      ctx.translate(-Math.round(w.camX) - view.crop, 0);
      shell.fx.drawWorld(ctx);
      ctx.restore();
      shell.fx.drawScreen(ctx, w.player.hp / w.player.hpMax);
      const hs = hudState(w, shell);
      if (npc.isOpen()) hs.message = undefined; // 대화창이 열려 있으면 자막·안내 한 줄은 숨긴다 (같은 말이 두 번, 폰 키보드 자리)
      if (mods.blocking?.() || shell.paused) hs.navigation = undefined;
      if (!game?.inHub) shell.hud.draw(ctx, hs, dt); // 본부에서는 전투 HUD 없음
      else if (hs.message) shell.hud.drawMessage(ctx, hs.message, hs.compact); // 본부 목소리는 아래 자막 한 줄
      if (game?.inHub && hs.navigation) shell.hud.drawNavigation(ctx, hs.navigation, hs.compact, hs.device);
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
      if (name === 'title') drawTitleBg(ctx, t);
    },
    boot: (g) => { void Promise.all([session.ready, hq.visitReady]).then(() => { elevator.reloadMeta(); if (bridge?.visit) g.start_new(); else if (!bootFromUrl(g)) g.toTitle(); }); return true; },
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
