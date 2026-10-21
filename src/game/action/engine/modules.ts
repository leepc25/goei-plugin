// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳.
//   ui/    화면 틀·메뉴·HUD·터치·화면 효과 (mountGameShell)
//   audio/ 효과음·음악 (createGameAudio)
//   hq/    본부와 임무 흐름 (createHq)
// 층(stage/)·적(enemy/)·아이템(items/)·대사(story/)는 들어오는 대로 여기에 잇는다. 없으면 엔진 기본(훈련장·임시 적·기본 지급품).
import type { GameBridge } from '../../bridge';
import { createGameAudio } from '../audio';
import { createHq, idbSaves, type MissionLaunch, type RunResult, type SaveSlots } from '../hq';
import { mountGameShell, type HudState, type Shell } from '../ui';
import type { GameEvent, HqModuleLike, RunConfigCore, RunResultCore } from './contract';
import type { EngineModules, Game } from './game';
import { DEF_BY_KIND, createEnemy, isThreat, signalEnemies } from '../enemy';
import { createElevatorStage } from '../stage';
import { mountStory, type StoryApi } from '../story';
import { itemsBlocking, linkItems, mountItemsOverlay } from './itemsLink';
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

/** 본부 모듈을 엔진 모양으로 감싼다 */
function hqAdapter(saves: SaveSlots, bridge?: Partial<GameBridge>): HqModuleLike {
  const hq = createHq();
  return {
    mount(root, host) {
      hq.mount(root, {
        deploy: (l) => host.deploy({ ...l, hpMax: l.stats?.hp, launch: l } as Launch),
        load: () => saves.read(0),
        save: (d) => saves.write(0, d, { title: '자동 저장', summary: `${hq.state.day}일차`, schema: 'goei-hq/1' }),
        saves,
        link: bridge?.card
          ? {
              card: async () => {
                const c = await bridge.card!();
                return c ? { agents: c.agents.map((a) => ({ id: a.id, name: a.name, english: a.english, photo: '' })), events: c.events.map((e) => ({ kind: e.kind, name: e.name, loc: e.loc, state: e.state })) } : null;
              },
              report: async (p: unknown) => {
                bridge.report?.(p as never);
                return '정산 결과를 넘겼습니다. 「본편에 기록」을 누르면 카드에 씁니다.';
              },
            } as never
          : undefined,
      });
    },
    onReturn(r, run) {
      const l = (run as Launch).launch;
      if (l) hq.onReturn(r as unknown as RunResult, l);
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
  };
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
  const audio = createGameAudio(local('goei-game-audio'));
  let game: Game | null = null;
  const shell = mountGameShell(box, {
    synth: true,
    title: '차원 승강기',
    sub: 'ANOMALY SIMULATION · 관리국 액션',
    onNew: () => game?.start_new(),
    onContinue: () => game?.start_new('dummy'),
    hasSave: () => true,
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
  const story: StoryApi = mountStory(
    storyRoot,
    {
      getAgent: () => 'jyaldi',
      sfx: (n) => audio.event({ type: 'custom', name: n } as never),
      shake: (ms, amp) => shell.fx.onGameEvent({ type: 'shake', ms, amp } as never),
      anchor: (id) => {
        if (id !== 'agent' || !world) return null;
        const c = shell.canvas.getBoundingClientRect();
        const r = storyRoot.getBoundingClientRect();
        const p = world.player;
        return { x: c.left - r.left + ((p.x - world.camX) / 1280) * c.width, y: c.top - r.top + ((p.y - p.z - 190) / 720) * c.height };
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
  const hq = hqAdapter(saves, bridge);
  const listeners: ((e: GameEvent) => void)[] = [
    (e) => {
      audio.event(e as never);
      shell.fx.onGameEvent(e as never);
      story.event(e.type, e as never);
      if (e.type === 'run:end') saveFlags();
    },
  ];
  const mods: EngineModules = {
    stages: [elevator, trainingStage, dummyStage],
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
      shell.hud.draw(ctx, hs, dt);
      shell.touch.setItems(hs.items);
      shell.touch.setGauge(w.player.gauge / 100);
      shell.touch.hint('reload', w.player.ammo <= 2 && w.player.reserve > 0);
      shell.fx.drawTransition(ctx);
    },
    onScene: (name) => {
      if (name === 'title' || name === 'hq') audio.floor(name as never);
      if (name === 'hq') {
        shell.play(); // 타이틀 메뉴 닫기
        shell.mode = 'title';
      }
    },
    onPause: (p) => (p ? audio.pause() : audio.resume()),
    onWorld: (w, run) => {
      world = w;
      w.on((e) => {
        // 승강기를 타고 새 층에 내릴 때 안내 방송 (첫 층은 건너뛴다)
        if (e.type === 'enter:floor' && w.floors > 1 && e.floor.depth) story.say('board', { depth: e.floor.depth, ftype: (e.floor as { type?: string }).type ?? '' });
      });
      w.on((e) => {
        if (e.type === 'hp:low') w.notes.bigHit = true;
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
      w.hooks.push(() => items.tick());
      w.underlays.push((c, camX) => items.draw(c, camX));
    },
    toHqResult,
    dispose: () => {
      unmountItems();
      window.removeEventListener('keydown', storyKeys, true);
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
