// 주 루프와 장면 관리. 30Hz 고정 틱 + 화면 주사율 그리기(보간).
// 장면: 제목 → 본부(hq 모듈, 없으면 바로 출동) → 출동(층 → 층 …) → 본부 정산 / 엔진 정산 화면 → 제목·본부.
// 화면 틀·메뉴·HUD는 ui 모듈(껍데기)이 있으면 그쪽을, 없으면 엔진 기본을 쓴다.
import { SCREEN_H, SCREEN_W, TICK_HZ, type GameEvent, type HqModuleLike, type RunConfigCore, type RunResultCore, type StageModule } from './contract';
import type { Art } from './art';
import { Input, type Pad } from './input';
import { makeRenderer, type Renderer } from './render';
import { World, type EnemyFactory, type ItemUse } from './world';

export interface EngineModules {
  stages: StageModule[];
  enemyFactory?: EnemyFactory;
  itemUse?: ItemUse;
  hq?: HqModuleLike;
  /** 모든 엔진 이벤트를 듣는 곳 (소리·화면 효과·대사) */
  listeners?: ((e: GameEvent) => void)[];
  /** 대사창이 전투를 멈추고 있는가 */
  blocking?: () => boolean;
  /** 엔진 기본 HUD를 그릴지 (ui 모듈이 그리면 false) */
  hud?: boolean;
  /** 남이 준 캔버스 (ui 껍데기). 없으면 엔진이 만든다 */
  surface?: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  /** 밖(메뉴)에서 멈춤 */
  paused?: () => boolean;
  /** 밖의 제목 화면을 연다. 없으면 엔진 기본 제목 */
  openTitle?: () => void;
  /** 출동 시작 (껍데기를 놀이 모드로) */
  onPlay?: () => void;
  /** 매 화면 프레임 (dt 초) */
  frame?: (dt: number) => void;
  /** 세계 그리기 뒤에 덧그리기 (ui HUD·효과 등) */
  overlay?: (ctx: CanvasRenderingContext2D, world: World | null, dt: number) => void;
  /** 장면 바뀜: 'title' | 'hq' | 'battle' | 'result' */
  onScene?: (name: string) => void;
  onPause?: (paused: boolean) => void;
  /** 출동 결과를 본부 모양으로 바꿈 (hq 모듈이 있을 때) */
  toHqResult?: (r: RunResultCore, w: World) => unknown;
  /** 출동 시작 시 세계를 손봄 (아이템 모듈 연결 등) */
  onWorld?: (w: World, run: RunConfigCore) => void;
  /** 제목 등 빈 장면의 배경 그리기 */
  drawIdle?: (name: string, ctx: CanvasRenderingContext2D, t: number) => void;
  /** 출동이 끝난 뒤 본부로 가기 전 (귀환·후송 컷신). done을 부르면 본부 정산으로 */
  afterRun?: (how: RunResultCore['how'], done: () => void) => void;
  /** 시작 꼬리표(?start=) 처리. true면 제목 화면을 건너뛴다 */
  boot?: (game: Game) => boolean;
  dispose?: () => void;
}

interface Scene {
  name: string;
  tick(p: Pad): void;
  draw(alpha: number): void;
}

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input = new Input();
  world: World | null = null;
  scene: Scene;
  paused = false;
  private ownCanvas: boolean;
  private renderer: Renderer;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private menuIndex = 0;
  private run: RunConfigCore | null = null;
  private runStage: StageModule | null = null;
  lastResult: RunResultCore | null = null;
  private hqRoot: HTMLElement | null = null;
  private wasPaused = false;
  private menuItems: { y0: number; y1: number }[] = [];
  private titleItems: string[] = [];

  constructor(
    readonly box: HTMLElement,
    readonly art: Art,
    readonly mods: EngineModules,
  ) {
    if (mods.surface) {
      this.canvas = mods.surface.canvas;
      this.ctx = mods.surface.ctx;
      this.ownCanvas = false;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = SCREEN_W;
      this.canvas.height = SCREEN_H;
      this.canvas.className = 'goei-engine-canvas';
      box.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d')!;
      this.ownCanvas = true;
    }
    this.renderer = makeRenderer(this.ctx, art, { hud: mods.hud !== false });
    this.input.attach();
    this.canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.scene = this.idleScene('title');
    this.toTitle();
  }

  /** 꼬리표 시작은 주 루프가 돈 뒤에 (start()에서) */
  private booted = false;

  start() {
    if (!this.booted) {
      this.booted = true;
      queueMicrotask(() => this.mods.boot?.(this));
    }
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      if (!this.last) this.last = now;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.mods.frame?.(dt);
      this.acc += dt;
      const T = 1 / TICK_HZ;
      while (this.acc >= T) {
        this.acc -= T;
        this.tickOnce();
      }
      const paused = this.paused || !!this.mods.paused?.();
      if (paused !== this.wasPaused) {
        this.wasPaused = paused;
        this.mods.onPause?.(paused);
      }
      this.scene.draw(paused ? 1 : this.acc / T);
      this.mods.overlay?.(this.ctx, this.world, dt);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** 시험용: 틱을 n번 바로 돌린다 */
  advance(n: number) {
    for (let i = 0; i < n; i++) this.tickOnce();
    this.scene.draw(1);
  }

  private tickOnce() {
    const p = this.input.sample();
    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.mods.paused?.() && this.scene.name === 'battle') return;
    this.scene.tick(p);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    if (this.ownCanvas) this.canvas.remove();
    if (this.hqRoot) {
      this.mods.hq?.unmount();
      this.hqRoot.remove();
    }
    this.mods.dispose?.();
  }

  /* ───────── 제목·본부 ───────── */

  toTitle() {
    this.world = null;
    this.inHub = false;
    this.paused = false;
    if (this.hqRoot) this.hqRoot.hidden = true;
    if (this.mods.openTitle) {
      this.scene = this.idleScene('title');
      this.mods.openTitle();
    } else this.scene = this.titleScene();
    this.mods.onScene?.('title');
  }

  /** 새로 시작: 본부가 있으면 본부로, 없으면 첫 층 모듈로 바로 출동 */
  start_new(stageId?: string) {
    if (this.mods.hq && !stageId) return this.showHq();
    const stage = this.mods.stages.find((s) => s.id === stageId) ?? this.mods.stages[0];
    this.deploy({ seed: Math.floor(Math.random() * 1e9), agent: 'jyaldi', stageId: stage.id });
  }

  /** 본부를 걷는 중인가 (엔진 벨트 장면) */
  inHub = false;

  showHq() {
    const hq = this.mods.hq!;
    this.world = null;
    this.scene = this.idleScene('hq');
    if (!hq.hub) this.canvas.style.visibility = 'hidden';
    if (!this.hqRoot) {
      this.hqRoot = document.createElement('div');
      this.hqRoot.className = 'goei-engine-hq';
      this.box.appendChild(this.hqRoot);
      hq.mount(this.hqRoot, {
        deploy: (run) => this.deploy(run),
        stages: () => this.mods.stages.map((s) => ({ id: s.id, label: s.label })),
      });
    }
    this.hqRoot.hidden = false;
    if (hq.hub) {
      // 본부 = 엔진 벨트 장면. 메뉴 창(DOM)은 열렸을 때만 보인다
      const stage = hq.hub();
      const run: RunConfigCore = { seed: Math.floor(Math.random() * 1e9), agent: 'jyaldi', stageId: stage.id };
      this.hqRoot.hidden = !hq.isOpen?.();
      this.hqRoot.classList.add('goei-engine-hq-panel');
      this.canvas.style.visibility = '';
      this.inHub = true;
      const w = new World(run, this.art.clips, stage, this.mods.enemyFactory);
      for (const l of this.mods.listeners ?? []) w.on(l);
      this.mods.onWorld?.(w, run);
      w.enterFloor(stage.firstFloor(run));
      this.world = w;
      this.runStage = stage;
      this.inHub = true;
      this.paused = false;
      this.scene = this.battleScene(w);
      this.mods.onPlay?.();
    }
    this.mods.onScene?.('hq');
  }

  private idleScene(name: string): Scene {
    return {
      name,
      tick: () => {},
      draw: () => {
        this.ctx.fillStyle = '#05080a';
        this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        this.mods.drawIdle?.(name, this.ctx, performance.now() / 1000);
      },
    };
  }

  /* ───────── 출동 ───────── */

  deploy(run: RunConfigCore) {
    const stage = this.mods.stages.find((s) => s.id === run.stageId) ?? this.mods.stages[0];
    this.inHub = false;
    this.run = run;
    this.runStage = stage;
    if (this.hqRoot) this.hqRoot.hidden = true;
    this.canvas.style.visibility = '';
    const w = new World(run, this.art.clips, stage, this.mods.enemyFactory);
    if (this.mods.itemUse) w.itemUse = this.mods.itemUse;
    for (const l of this.mods.listeners ?? []) w.on(l);
    this.mods.onWorld?.(w, run);
    w.enterFloor(stage.firstFloor(run));
    this.world = w;
    this.paused = false;
    this.scene = this.battleScene(w);
    this.mods.onPlay?.();
    this.mods.onScene?.('battle');
  }

  /** 출동 끝내기 (철수 메뉴 등에서도 부른다) */
  endRun(how: RunResultCore['how']) {
    const w = this.world;
    if (!w || this.inHub) return;
    const result: RunResultCore = {
      how,
      floors: w.floors,
      kills: w.kills,
      maxCombo: w.player.maxCombo,
      timeSec: Math.round(w.tick / TICK_HZ),
      hpLeft: Math.max(0, Math.round(w.player.hp)),
      notes: w.notes,
    };
    w.emit({ type: 'run:end', how });
    this.lastResult = result;
    this.world = null;
    this.paused = false;
    if (this.mods.hq && this.run) {
      const run = this.run;
      const back = () => {
        this.showHq();
        this.mods.hq!.onReturn((this.mods.toHqResult?.(result, w) ?? result) as RunResultCore, run);
      };
      if (this.mods.afterRun) {
        this.scene = this.idleScene('cutscene');
        this.mods.afterRun(how, back);
      } else back();
      return;
    }
    this.scene = this.resultScene(result);
    this.mods.onScene?.('result');
  }

  private battleScene(w: World): Scene {
    const ownMenu = !this.mods.paused;
    return {
      name: 'battle',
      tick: (p) => {
        if (ownMenu && p.pressed.has('pause')) {
          this.paused = !this.paused;
          this.menuIndex = 0;
        }
        if (this.paused) return this.pauseMenu(p, w);
        if (this.inHub && this.hqRoot) {
          const open = !!this.mods.hq?.isOpen?.();
          this.hqRoot.hidden = !open;
          if (open) return;
        }
        if (this.mods.blocking?.()) return;
        w.step(p);
        if (w.ended) {
          const how = w.ended;
          if (how === 'next') {
            const next = this.runStage!.nextFloor(this.run!, w.floor, 'next');
            if (next) w.enterFloor(next);
            else this.endRun('return');
          } else this.endRun(how === 'withdraw' ? 'withdraw' : 'evac');
        }
      },
      draw: (a) => {
        this.renderer.draw(w, this.paused ? 1 : a);
        if (this.paused) this.drawMenu('일시정지', ['계속', w.showBoxes ? '판정 보기 끄기' : '판정 보기 켜기', '철수 (출동 끝내기)', '처음으로']);
      },
    };
  }

  private pauseMenu(p: Pad, w: World) {
    const n = 4;
    if (p.pressed.has('up')) this.menuIndex = (this.menuIndex + n - 1) % n;
    if (p.pressed.has('down')) this.menuIndex = (this.menuIndex + 1) % n;
    if (p.pressed.has('attack') || p.pressed.has('jump') || p.pressed.has('interact')) this.pick(this.menuIndex, w);
  }

  private pick(i: number, w: World) {
    this.paused = false;
    if (i === 1) w.showBoxes = !w.showBoxes;
    else if (i === 2) this.endRun('withdraw');
    else if (i === 3) this.toTitle();
  }

  private drawMenu(title: string, items: string[], bg = true) {
    const c = this.ctx;
    if (bg) {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(0, 0, SCREEN_W, SCREEN_H);
      c.fillStyle = '#e8eef0';
      c.textAlign = 'center';
      c.font = 'bold 44px sans-serif';
      c.fillText(title, SCREEN_W / 2, 210);
    }
    c.textAlign = 'center';
    c.font = '30px sans-serif';
    items.forEach((t, i) => {
      const y = 300 + i * 64;
      c.fillStyle = i === this.menuIndex ? '#ffd36a' : 'rgba(255,255,255,0.1)';
      c.fillRect(SCREEN_W / 2 - 230, y - 40, 460, 54);
      c.fillStyle = i === this.menuIndex ? '#1a1f22' : '#e8eef0';
      c.fillText(t, SCREEN_W / 2, y - 3);
    });
    c.textAlign = 'left';
    this.menuItems = items.map((_, i) => ({ y0: 300 + i * 64 - 40, y1: 300 + i * 64 + 14 }));
  }

  private onPointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SCREEN_W;
    const y = ((e.clientY - r.top) / r.height) * SCREEN_H;
    if (this.scene.name === 'result') return this.leaveResult();
    if (Math.abs(x - SCREEN_W / 2) > 230) return;
    const i = this.menuItems.findIndex((m) => y >= m.y0 && y <= m.y1);
    if (i < 0) return;
    if (this.world && this.paused) this.pick(i, this.world);
    else if (this.scene.name === 'title') this.titlePick(i);
  }

  /* ───────── 엔진 기본 제목·정산 ───────── */

  private titlePick(i: number) {
    if (i === 0) this.start_new();
    else this.start_new(i === 1 && this.mods.hq ? this.mods.stages[0].id : 'dummy');
  }

  private titleScene(): Scene {
    this.menuIndex = 0;
    this.menuItems = [];
    const first = this.mods.stages[0];
    this.titleItems = this.mods.hq ? ['본부로 출근', `바로 출동 · ${first?.label ?? ''}`, '허수아비 연습'] : [`출동 · ${first?.label ?? ''}`, '허수아비 연습'];
    return {
      name: 'title',
      tick: (p) => {
        const n = this.titleItems.length;
        if (p.pressed.has('up')) this.menuIndex = (this.menuIndex + n - 1) % n;
        if (p.pressed.has('down')) this.menuIndex = (this.menuIndex + 1) % n;
        if (p.pressed.has('attack') || p.pressed.has('jump') || p.pressed.has('interact')) this.titlePick(this.menuIndex);
      },
      draw: () => {
        const c = this.ctx;
        c.fillStyle = '#0d1114';
        c.fillRect(0, 0, SCREEN_W, SCREEN_H);
        c.textAlign = 'center';
        c.font = 'bold 30px monospace';
        c.fillStyle = '#8e9aa1';
        c.fillText('ANOMALY SIMULATION', SCREEN_W / 2, 120);
        c.font = 'bold 58px sans-serif';
        c.fillStyle = '#e8eef0';
        c.fillText('관리국 · 차원 승강기', SCREEN_W / 2, 190);
        this.drawMenu('', this.titleItems, false);
        c.fillStyle = '#8e9aa1';
        c.font = '20px sans-serif';
        c.textAlign = 'center';
        const help = [
          '방향키 이동 · A 3연타 · 달리며 A 돌진 · ↓↓ 앉기, 앉아 A 하단 · Space 점프, 공중 A 점프 킥',
          'S 권총(탄창 8, R 재장전) · D 폭파 · Q 가드 · W 필살기 · Shift 짧게 회피 / 길게 달리기',
          '경직된 적에게 걸어 붙으면 잡기 → A 무릎, 방향+A 잡기 폭파, Space 놓기 · 1~4 아이템 · H 판정 보기 · Esc 메뉴',
        ];
        help.forEach((h, i) => c.fillText(h, SCREEN_W / 2, 560 + i * 34));
        c.textAlign = 'left';
      },
    };
  }

  private leaveResult() {
    if (this.mods.hq) this.showHq();
    else this.toTitle();
  }

  private resultScene(r: RunResultCore): Scene {
    this.menuIndex = 0;
    this.menuItems = [];
    const how = { return: '귀환', withdraw: '철수', evac: '후송' }[r.how];
    let t = 0;
    return {
      name: 'result',
      tick: (p) => {
        if (++t > 20 && (p.pressed.has('attack') || p.pressed.has('jump') || p.pressed.has('interact') || p.pressed.has('pause'))) this.leaveResult();
      },
      draw: () => {
        const c = this.ctx;
        c.fillStyle = '#0d1114';
        c.fillRect(0, 0, SCREEN_W, SCREEN_H);
        c.textAlign = 'center';
        c.fillStyle = r.how === 'evac' ? '#ff6a5a' : '#7fe0a0';
        c.font = 'bold 64px sans-serif';
        c.fillText(how, SCREEN_W / 2, 200);
        c.fillStyle = '#e8eef0';
        c.font = '30px sans-serif';
        const lines = [`처치 ${r.kills}`, `최대 콤보 ${r.maxCombo}`, `층 ${r.floors}`, `시간 ${r.timeSec}초`, `남은 체력 ${r.hpLeft}`];
        lines.forEach((l, i) => c.fillText(l, SCREEN_W / 2, 290 + i * 48));
        c.fillStyle = '#8e9aa1';
        c.font = '22px sans-serif';
        c.fillText('A 또는 화면을 누르면 처음으로', SCREEN_W / 2, 600);
        c.textAlign = 'left';
      },
    };
  }
}
