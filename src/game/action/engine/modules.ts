// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳.
//   ui/    화면 틀·메뉴·HUD·터치·화면 효과 (mountGameShell)
//   audio/ 효과음·음악 (createGameAudio)
//   hq/    본부와 임무 흐름 (createHq)
// 층(stage/)·적(enemy/)·아이템(items/)·대사(story/)는 들어오는 대로 여기에 잇는다. 없으면 엔진 기본(훈련장·임시 적·기본 지급품).
import type { GameBridge } from '../../bridge';
import { createGameAudio } from '../audio';
import { createHq, idbSaves, setItemIconDrawer, setLineProvider, setSupplyCatalog, type MissionLaunch, type RunResult, type SaveSlots } from '../hq';
import { mountGameShell, type HudState, type Shell } from '../ui';
import type { GameEvent, HqModuleLike, RunConfigCore, RunResultCore, StageModule } from './contract';
import type { EngineModules, Game } from './game';
import { DEF_BY_KIND, arenaStage, createEnemy, isThreat, signalEnemies } from '../enemy';
import { createElevatorStage } from '../stage';
import { CUTSCENES, VIDEOS, hqLines, mountStory, stageHooks, type AgentId, type StoryApi } from '../story';
import type { SpeakerId } from '../story/types';
import { itemsBlocking, linkItems, mountItemsOverlay } from './itemsLink';
import { makeHub, type HubHost } from './hub';
import { linkNpcTalk } from './npcLink';
import demoPhotos from '../story/demo-photos.json';
import { whereIs } from '../hq/map';
import { drawTitleBg, setHudItemIcon } from '../ui';
import { SUPPLY_CATALOG, drawItemIcon } from '../items';
import { dummyStage, trainingStage } from './training';
import { fallbackEnemy, type EnemyFactory, type World } from './world';

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
function hqAdapter(saves: SaveSlots, bridge: Partial<GameBridge> | undefined, ui: { chooseFloor: HubHost['chooseFloor']; sfx: (n: string) => void; closed?: () => void }): HqModuleLike & { close(): void; goto(place: string): void; state(): { day: number; rescued: string[] } } {
  const hq = createHq();
  const b = bridge as (Partial<GameBridge> & { slot?: number; photo?: (name: string) => string | undefined }) | undefined;
  const slot = b?.slot ?? 0;
  // 본부 걷기는 엔진 벨트 장면(engine/hub.ts): 건물 지도는 본부 모듈 map(), 엔진은 장면 옮기기·그리기. 메뉴 창(DOM)만 본부 모듈이 띄운다
  let root: HTMLElement | null = null;
  const hub = makeHub(
    {
      map: () => hq.map(),
      openPlace: (id) => hq.openPlace(id as never),
      bark: (place) => hq.bark(place as never),
      chooseFloor: (o, pick) => ui.chooseFloor(o, pick),
      sfx: (n) => ui.sfx(n),
      // 본부 대화창이 떠 있으면 머리 위 표시를 숨긴다 (독립 검수: 브리핑 뒤 ↓ 표시)
      busy: () => typeof document !== 'undefined' && !!document.querySelector('.hq-talk, .hq-over:not(:empty)'),
    },
    (place) => whereIs(place as never),
  );
  return {
    hub: () => hub,
    state: () => hq.state,
    goto: (place: string) => hub.goto(place),
    isOpen: () => hq.isOpen(),
    close: () => hq.close(),
    mount(r, host) {
      root = r;
      hq.mount(r, {
        deploy: (l) => host.deploy({ ...l, hpMax: l.stats?.hp, launch: l } as Launch),
        load: () => saves.read(slot as never),
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
      if (l) hq.onReturn({ ...(r as unknown as RunResult), runId: (l as { runId?: string }).runId } as RunResult, l);
    },
    unmount: () => hq.unmount(),
  };
}

/** 엔진 결과 → 본부 정산 모양 */
function toHqResult(r: RunResultCore, w: World): RunResult {
  const n = r.notes as Partial<RunResult> & Record<string, unknown>;
  return {
    how: r.how,
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
    weapon: heldWeapon(w) ?? { name: '권총', mag: p.ammo, magMax: p.mag, reserve: p.reserve, reload: p.moveKey === 'reload' ? p.mf / 6 : null },
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
  setSupplyCatalog(SUPPLY_CATALOG as never);
  setHudItemIcon(drawItemIcon as never);
  setItemIconDrawer(drawItemIcon as never);
  const audio = createGameAudio(local('goei-game-audio'));
  let game: Game | null = null;
  const shell = mountGameShell(box, {
    synth: true,
    title: '차원 승강기',
    sub: 'ANOMALY SIMULATION · 관리국 액션',
    onNew: () => {
      // 새 저장: 영상 깃발을 지운다 (저장마다 한 번)
      for (const k of Object.keys(story.flags)) if (k.startsWith('cut_') || k === 'told_rope') delete story.flags[k];
      saveFlags();
      game?.start_new();
    },
    onContinue: () => game?.start_new(),
    hasSave: hasSaved,
    onRetreat: () => game?.endRun('withdraw'),
    onTitle: () => game?.toTitle(),
    toLocal: bridge?.viewport ? (x, y, el) => bridge.viewport!.toLocal(x, y, el) : undefined,
  });
  const stageStore = {
    load: () => {
      try {
        const t = localStorage.getItem('goei-game-stage');
        return t ? JSON.parse(t) : null;
      } catch {
        return null;
      }
    },
    save: (m: unknown) => {
      try {
        localStorage.setItem('goei-game-stage', JSON.stringify(m));
      } catch {
        /* 저장 못 해도 진행 */
      }
    },
  };
  // NPC 자유 대화 (npcLink.ts): 껍데기 놀이판 층에 대화창, 승객은 층 모듈 훅으로
  const npc = linkNpcTalk({
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
  const elevator = createElevatorStage(stageStore, npc.stageHooks(stageHooks()));
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
        return { x: ox + gx * k, y: oy + Math.max(120, p.y - p.z - (world.hintShown ? 362 : 290)) * k, minX: ox, maxX: Math.min(maxX ?? Infinity, ox + 1280 * k) };
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
  const saves: SaveSlots = (bridge?.saves as unknown as SaveSlots) ?? idbSaves('goei-game');
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
    chooseFloor,
    sfx: (n) => audio.play(n as never),
    closed: () => {
      if (dinnerDue) (dinnerDue = false), cutOnce('dinner');
    },
  });
  // 본부 메뉴 창이 열려 있으면 Esc는 창 닫기 (껍데기 일시정지보다 먼저)
  const hqKeys = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' || !game?.inHub || !hq.isOpen?.()) return;
    hq.close();
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', hqKeys, true);
  // 오락실 오프닝: 제목 화면에서 20초 가만히 있으면 opening 영상, 끝나면 다시 기다린다. 아무 입력이나 대기 시간을 처음부터
  let openingT: ReturnType<typeof setTimeout> | null = null;
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
    stages: [elevator, trainingStage, dummyStage, arenaStage, itemStage],
    enemyFactory,
    hq,
    hud: false,
    blocking: () => story.isBlocking() || itemsBlocking() || !floorBox.hidden || npc.isOpen(),
    listeners,
    surface: { canvas: shell.canvas, ctx: shell.ctx },
    paused: () => shell.paused,
    openTitle: () => {
      shell.openTitle();
      armOpening();
    },
    onPlay: () => shell.play(),
    frame: (dt) => {
      syncVolume();
      story.update(dt);
      shell.frame(dt);
      shell.input.endFrame();
    },
    overlay: (ctx, w, dt) => {
      if (!w) return;
      audio.setListener(w.camX + 640, 640);
      footsteps(w);
      ctx.save();
      ctx.translate(-Math.round(w.camX), 0);
      shell.fx.drawWorld(ctx);
      ctx.restore();
      shell.fx.drawScreen(ctx, w.player.hp / w.player.hpMax);
      const hs = hudState(w, shell);
      if (!game?.inHub) shell.hud.draw(ctx, hs, dt); // 본부에서는 전투 HUD 없음
      else if (hs.message && !npc.isOpen()) shell.hud.drawMessage(ctx, hs.message, hs.compact); // 본부 목소리는 아래 자막 한 줄 (대화창이 열려 있으면 같은 말이 두 번 나오지 않게 숨김)
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
      if (p) audio.pause();
      else audio.resume();
      // 메뉴가 열리면 말풍선·GO 표시를 숨긴다
      storyRoot.style.visibility = p ? 'hidden' : '';
      if (world) world.paused = p;
    },
    onWorld: (w, run) => {
      world = w;
      runAgent = run.agent as AgentId;
      // 첫 출동: 도트 영상 first_entry, 끝나면 로프 안내 자막 한 줄 (영상을 못 틀면 자막만)
      if (run.stageId !== 'hq' && (run as Launch).launch && !story.flags.told_rope) {
        story.flags.told_rope = 1;
        const rope = () => world === w && w.say('(잼트리) 타고 온 걸로는 못 돌아와요. 귀환은 다락방 로프.', 3);
        if (!cutOnce('first_entry', () => setTimeout(rope, 1200))) setTimeout(rope, 4600);
      }
      // 새 저장의 첫 본부: first_day (첫 출동 영상과 사이에 본부를 한 번 걷게 된다)
      if (run.stageId === 'hq') setTimeout(() => world === w && cutOnce('first_day'), 600);
      w.hitFx = false; // 맞을 때 효과는 껍데기 fx가 그린다
      if (run.stageId === 'hq') return void npc.attach(w, { hub: (hq.hub?.() ?? null) as never, hq: true }); // 본부 걷기: 아이템·대사 안내·전투 기록 없음
      w.notes.runId = `${run.seed}`;
      // 승강기 안내 방송은 층 모듈 hooks를 대사 모듈이 채우면 거기서 나온다 (여기서 따로 부르지 않음: 중복)
      w.on((e) => {
        if (e.type === 'hp:low') w.notes.bigHit = true;
      });
      // 진압 임무: 쓰러뜨린 수호자 종류를 남긴다
      const bossesDown = new Set<number>();
      w.hooks.push(() => {
        for (const bd of w.bodies) {
          if (!(bd as { boss?: boolean }).boss || bossesDown.has(bd.id) || (bd.alive && bd.hp > 0)) continue;
          bossesDown.add(bd.id);
          ((w.notes.bosses ??= []) as string[]).push(bd.kind);
        }
      });
      w.threat = (b) => (DEF_BY_KIND[b.kind] ? isThreat(b as never) : true);
      w.interactHooks.push((prop) => {
        const p = w.player;
        const at = { x: p.x, y: p.y };
        signalEnemies(w as never, { kind: 'greet', ...at } as never);
        signalEnemies(w as never, { kind: 'door', ...at } as never);
        if (prop?.kind === 'crevice') signalEnemies(w as never, { kind: 'plug', x: prop.x } as never);
        if (prop?.kind === 'bowl') signalEnemies(w as never, { kind: 'bowl', x: prop.x, y: prop.y } as never);
        if (prop?.kind === 'table' || prop?.kind === 'meal') signalEnemies(w as never, { kind: 'mealThanks', ...at } as never);
      });
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
    boot: (g) => bootFromUrl(g),
    dispose: () => {
      npc.dispose();
      unmountItems();
      const g = globalThis as { __goeiStory?: unknown; __goeiStoryStart?: unknown; __goeiNpc?: unknown };
      delete g.__goeiStory;
      delete g.__goeiNpc;
      delete g.__goeiStoryStart;
      world = null;
      game = null;
      window.removeEventListener('keydown', storyKeys, true);
      window.removeEventListener('keydown', titleInput, true);
      window.removeEventListener('pointerdown', titleInput, true);
      if (openingT) clearTimeout(openingT);
      window.removeEventListener('keydown', hqKeys, true);
      window.removeEventListener('keydown', floorKeys, true);
      saveFlags();
      story.dispose();
      setLineProvider(null);
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
