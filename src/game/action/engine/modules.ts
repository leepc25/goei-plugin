// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳.
//   ui/    화면 틀·메뉴·HUD·터치·화면 효과 (mountGameShell)
//   audio/ 효과음·음악 (createGameAudio)
//   hq/    본부와 임무 흐름 (createHq)
// 층(stage/)·적(enemy/)·아이템(items/)·대사(story/)는 들어오는 대로 여기에 잇는다. 없으면 엔진 기본(훈련장·임시 적·기본 지급품).
import type { GameBridge } from '../../bridge';
import { createGameAudio } from '../audio';
import { createHq, idbSaves, setItemIconDrawer, setSupplyCatalog, type MissionLaunch, type RunResult, type SaveSlots } from '../hq';
import { mountGameShell, type HudState, type Shell } from '../ui';
import type { GameEvent, HqModuleLike, RunConfigCore, RunResultCore, StageModule } from './contract';
import type { EngineModules, Game } from './game';
import { DEF_BY_KIND, createEnemy, isThreat, signalEnemies } from '../enemy';
import { createElevatorStage } from '../stage';
import { CUTSCENES, mountStory, type StoryApi } from '../story';
import { itemsBlocking, linkItems, mountItemsOverlay } from './itemsLink';
import { makeHub, type HubPlace } from './hub';
import { PLACES } from '../hq/data';
import { openPlaces } from '../hq/logic';
import { drawTitleBg } from '../ui';
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
function hqAdapter(saves: SaveSlots, bridge?: Partial<GameBridge>, gotoPlace?: (id: string) => void): HqModuleLike & { close(): void } {
  const hq = createHq();
  const b = bridge as (Partial<GameBridge> & { slot?: number; photo?: (name: string) => string | undefined }) | undefined;
  const slot = b?.slot ?? 0;
  // 본부 걷기는 엔진 벨트 장면. 본부 모듈에 places·openPlace·isOpen이 생기기 전까지는 기존 DOM을 띄우고 장소 단추를 누른다
  type HqPanel = { places?: () => HubPlace[]; openPlace?: (id: string) => void; isOpen?: () => boolean; close?: () => void };
  const api = hq as unknown as HqPanel;
  let root: HTMLElement | null = null;
  let fbOpen = false;
  const places = (): HubPlace[] =>
    api.places?.() ??
    (() => {
      const open = new Set(openPlaces(hq.state).map((p) => p.id));
      return PLACES.map((p) => ({ id: p.id, name: p.name, floor: p.floor, x: p.x, w: p.w, npc: p.npc, color: p.color, open: open.has(p.id), opens: p.opens }));
    })();
  const openPlace = (id: string) => {
    if (api.openPlace) return api.openPlace(id);
    fbOpen = true;
    if (root) root.hidden = false;
    (root?.querySelector(`[data-go="${id}"]`) as HTMLElement | null)?.click();
  };
  return {
    hub: () => makeHub(places, openPlace),
    isOpen: () => (api.isOpen ? api.isOpen() : fbOpen),
    close: () => (api.close ? api.close() : (fbOpen = false)),
    mount(r, host) {
      root = r;
      if (!api.openPlace) {
        const close = document.createElement('button');
        close.textContent = '✕ 닫기';
        close.className = 'goei-engine-hq-close';
        close.addEventListener('click', () => (fbOpen = false));
        r.appendChild(close);
      }
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
        closed: () => (fbOpen = false),
        goto: (id: string) => gotoPlace?.(id),
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
    items: w.items.map((it) => ({ label: it?.label ?? '', count: it?.n ?? 0 })),
    floor: { depth: d ? (d <= 3 ? `L${d}` : `B-${d - 3}`) : '', name: f.title },
    favor: 0,
    money: { cash: (w.notes.cash as number | undefined) ?? 0, budget: 0, research: 0, teeth: 0 },
    boss: boss ? { name: boss.label, hp: boss.hp, max: boss.hpMax } : null,
    message: w.subtitle?.text,
    meters: [{ label: '가드', v: p.guardMeter, max: 100, color: '#9ad08a' }],
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
  setItemIconDrawer(drawItemIcon as never);
  const audio = createGameAudio(local('goei-game-audio'));
  let game: Game | null = null;
  const shell = mountGameShell(box, {
    synth: true,
    title: '차원 승강기',
    sub: 'ANOMALY SIMULATION · 관리국 액션',
    onNew: () => game?.start_new(),
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
  const elevator = createElevatorStage(stageStore);
  // 시연용 방: 적 고르기(?start=arena[&enemy=종류]), 아이템 진열(?start=items)
  const kinds = Object.keys(DEF_BY_KIND);
  let arenaIdx = 0;
  const arenaStage: StageModule = {
    id: 'arena',
    label: '적 시험장',
    firstFloor: () => ({
      id: 'arena',
      title: '적 시험장',
      length: 2400,
      startX: 300,
      exitX: Infinity,
      banner: '적 시험장 · 표지판 앞에서 E: 다음 적',
      props: [{ id: 'next', kind: 'sign', x: 160, y: 445, w: 120, h: 60, label: 'E · 다음 적' }],
      encounters: [],
    }),
    nextFloor: () => null,
    onInteract(api, _f, prop) {
      if (prop.id !== 'next' || !kinds.length) return;
      let want: string | null = null;
      try {
        want = new URLSearchParams(location.search).get('enemy');
      } catch {
        /* 없음 */
      }
      const kind = want && arenaIdx === 0 ? want : kinds[arenaIdx % kinds.length];
      arenaIdx++;
      const p = api.world.player;
      api.spawn({ kind, x: p.x + 420, y: p.y, boss: !!(DEF_BY_KIND[kind] as { boss?: boolean })?.boss });
      api.world.say(`다음 적: ${kind}`, 1.5);
    },
  };
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
  (globalThis as { __goeiStory?: (id: string) => void }).__goeiStory = (id) => (CUTSCENES[id] ? story.cutscene(id) : story.say(id));
  const story: StoryApi = mountStory(
    storyRoot,
    {
      getAgent: () => 'jyaldi',
      sfx: (n) => audio.event({ type: 'custom', name: n } as never),
      shake: (ms, amp) => shell.fx.onGameEvent({ type: 'shake', ms, amp } as never),
      anchor: (id) => {
        if (id !== 'agent' || !world) return null;
        // 화면을 돌려도 맞도록 변환 전 배치 좌표(offset*)로 계산
        const cv = shell.canvas;
        let ox = 0,
          oy = 0;
        for (let n: HTMLElement | null = cv; n && n !== storyRoot.offsetParent; n = n.offsetParent as HTMLElement | null) (ox += n.offsetLeft), (oy += n.offsetTop);
        const k = cv.offsetWidth / 1280;
        const p = world.player;
        return { x: ox - storyRoot.offsetLeft + (p.x - world.camX) * k, y: oy - storyRoot.offsetTop + (p.y - p.z - 190) * k };
      },
      emit: (ev, arg) => world?.emit({ type: 'custom', name: ev, data: { arg } } as never),
    },
    { saved: savedFlags },
  );
  const saveFlags = () => {
    try {
      localStorage.setItem('goei-game-story', JSON.stringify(story.flags));
    } catch {
      /* 저장 못 해도 진행 */
    }
  };
  const storyKeys = (e: KeyboardEvent) => {
    if (!story.isBlocking()) return;
    if (/^Digit[1-9]$/.test(e.code)) story.choose(Number(e.code.slice(5)) - 1);
    else if (['Space', 'Enter', 'KeyE', 'KeyZ', 'KeyA'].includes(e.code)) story.advance();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', storyKeys, true);
  const saves: SaveSlots = (bridge?.saves as unknown as SaveSlots) ?? idbSaves('goei-game');
  const hq = hqAdapter(saves, bridge, (id) => {
    const w = game?.inHub ? game.world : null;
    const door = w?.props.find((q) => q.id === id);
    if (w && door) (w.player.x = door.x), (w.player.px = door.x);
  });
  // 본부 메뉴 창이 열려 있으면 Esc는 창 닫기 (껍데기 일시정지보다 먼저)
  const hqKeys = (e: KeyboardEvent) => {
    if (e.code !== 'Escape' || !game?.inHub || !hq.isOpen?.()) return;
    hq.close();
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', hqKeys, true);
  const listeners: ((e: GameEvent) => void)[] = [
    (e) => {
      audio.event(e as never);
      if (game?.inHub && (e.type === 'enter:floor' || e.type === 'custom')) return; // 본부: 승강기 안내·층 제목 없음
      shell.fx.onGameEvent(e as never);
      story.event(e.type, e as never);
      if (e.type === 'run:end') saveFlags();
    },
  ];
  const mods: EngineModules = {
    stages: [elevator, trainingStage, dummyStage, arenaStage, itemStage],
    enemyFactory,
    hq,
    hud: false,
    blocking: () => story.isBlocking() || itemsBlocking(),
    listeners,
    surface: { canvas: shell.canvas, ctx: shell.ctx },
    paused: () => shell.paused,
    openTitle: () => shell.openTitle(),
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
      shell.touch.setItems(hs.items);
      shell.touch.setGauge(w.player.gauge / 100);
      shell.touch.hint('reload', w.player.ammo <= 2 && w.player.reserve > 0);
      shell.fx.drawTransition(ctx);
    },
    onScene: (name) => {
      if (name === 'title' || name === 'hq') audio.floor(name as never);
      if (name === 'hq') shell.play(); // 본부도 걷는 장면: 타이틀 메뉴 닫고 조작·터치 켜기
    },
    onPause: (p) => (p ? audio.pause() : audio.resume()),
    onWorld: (w, run) => {
      world = w;
      w.hitFx = false; // 맞을 때 효과는 껍데기 fx가 그린다
      if (run.stageId === 'hq') return; // 본부 걷기: 아이템·대사 안내·전투 기록 없음
      w.notes.runId = `${run.seed}`;
      w.on((e) => {
        // 승강기를 타고 새 층에 내릴 때 안내 방송 (첫 층은 건너뛴다)
        if (e.type === 'enter:floor' && w.floors > 1 && e.floor.depth) story.say('board', { depth: e.floor.depth, ftype: (e.floor as { type?: string }).type ?? '' });
      });
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
      if (run.stageId === 'itemroom') items.showcase();
      w.hooks.push(() => items.tick());
      w.underlays.push((c, camX) => items.draw(c, camX));
    },
    toHqResult,
    drawIdle: (name, ctx, t) => {
      if (name === 'title') drawTitleBg(ctx, t);
    },
    boot: (g) => bootFromUrl(g),
    dispose: () => {
      unmountItems();
      window.removeEventListener('keydown', storyKeys, true);
      window.removeEventListener('keydown', hqKeys, true);
      saveFlags();
      story.dispose();
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
    if (v) (globalThis as { __goeiStory?: (id: string) => void }).__goeiStory?.(v);
  } else return false;
  return true;
}
