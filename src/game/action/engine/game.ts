// 주 루프와 장면 관리. 30Hz 고정 틱 + 화면 주사율 그리기(보간). 장면: 제목 → (본부) → 출동(층 → 층) → 정산 → 제목/본부.
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
  /** ui 모듈이 HUD를 그리면 false */
  hud?: boolean;
  /** 그리기 뒤에 덧그리기 (ui 모듈 HUD 등) */
  overlay?: (ctx: CanvasRenderingContext2D, world: World | null) => void;
}

interface Scene {
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
  private renderer: Renderer;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private menuIndex = 0;
  private run: RunConfigCore | null = null;
  private runStage: StageModule | null = null;
  private runStart = 0;
  lastResult: RunResultCore | null = null;
  private hqRoot: HTMLElement | null = null;

  constructor(
    readonly box: HTMLElement,
    readonly art: Art,
    readonly mods: EngineModules,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCREEN_W;
    this.canvas.height = SCREEN_H;
    this.canvas.className = 'goei-engine-canvas';
    box.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.renderer = makeRenderer(this.ctx, art, { hud: mods.hud !== false });
    this.input.attach();
    this.canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    this.scene = this.titleScene();
    if (mods.hq) this.openHq();
  }

  start() {
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      if (!this.last) this.last = now;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.acc += dt;
      const T = 1 / TICK_HZ;
      while (this.acc >= T) {
        this.acc -= T;
        this.tickOnce();
      }
      this.scene.draw(this.acc / T);
      this.mods.overlay?.(this.ctx, this.world);
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
    if (document.hidden) return;
    this.scene.tick(p);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.canvas.remove();
    this.closeHq();
  }

  /* ───────── 본부 ───────── */

  private openHq() {
    const hq = this.mods.hq;
    if (!hq) return;
    this.hqRoot = document.createElement('div');
    this.hqRoot.className = 'goei-engine-hq';
    this.box.appendChild(this.hqRoot);
    this.canvas.style.visibility = 'hidden';
    this.input.detach();
    hq.mount(this.hqRoot, {
      deploy: (run) => {
        this.closeHq();
        this.deploy(run);
      },
      stages: () => this.mods.stages.map((s) => ({ id: s.id, label: s.label })),
    });
  }

  private closeHq() {
    if (!this.hqRoot) return;
    this.mods.hq?.unmount();
    this.hqRoot.remove();
    this.hqRoot = null;
    this.canvas.style.visibility = '';
    this.input.attach();
  }

  /* ───────── 출동 ───────── */

  deploy(run: RunConfigCore) {
    const stage = this.mods.stages.find((s) => s.id === run.stageId) ?? this.mods.stages[0];
    this.run = run;
    this.runStage = stage;
    const w = new World(run, this.art.clips, stage, this.mods.enemyFactory);
    if (this.mods.itemUse) w.itemUse = this.mods.itemUse;
    for (const l of this.mods.listeners ?? []) w.on(l);
    w.enterFloor(stage.firstFloor(run));
    this.world = w;
    this.runStart = performance.now();
    this.paused = false;
    this.scene = this.battleScene(w);
  }

  private endRun(how: RunResultCore['how']) {
    const w = this.world!;
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
    void this.runStart;
    if (this.mods.hq && this.run) {
      this.world = null;
      this.openHq();
      this.mods.hq.onReturn(result, this.run);
      return;
    }
    this.scene = this.resultScene(result);
  }

  private battleScene(w: World): Scene {
    return {
      tick: (p) => {
        if (p.pressed.has('pause')) {
          this.paused = !this.paused;
          this.menuIndex = 0;
        }
        if (this.paused) return this.pauseMenu(p, w);
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
    if (i === 0) this.paused = false;
    else if (i === 1) {
      w.showBoxes = !w.showBoxes;
      this.paused = false;
    } else if (i === 2) {
      this.paused = false;
      this.endRun('withdraw');
    } else {
      this.paused = false;
      this.world = null;
      if (this.mods.hq) this.openHq();
      else this.scene = this.titleScene();
    }
  }

  private drawMenu(title: string, items: string[]) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.fillStyle = '#e8eef0';
    c.textAlign = 'center';
    c.font = 'bold 44px sans-serif';
    c.fillText(title, SCREEN_W / 2, 210);
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
  private menuItems: { y0: number; y1: number }[] = [];

  private onPointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SCREEN_W;
    const y = ((e.clientY - r.top) / r.height) * SCREEN_H;
    if (Math.abs(x - SCREEN_W / 2) > 230) return;
    const i = this.menuItems.findIndex((m) => y >= m.y0 && y <= m.y1);
    if (i < 0) return;
    if (this.world && this.paused) this.pick(i, this.world);
    else if (!this.world) this.titlePick(i);
  }

  /* ───────── 제목·정산 ───────── */

  private titleItems = ['출동 · 훈련장', '허수아비 연습'];

  private titlePick(i: number) {
    const stage = i === 0 ? this.mods.stages[0] : this.mods.stages.find((s) => s.id === 'dummy') ?? this.mods.stages[0];
    this.deploy({ seed: Math.floor(Math.random() * 1e9), agent: 'jyaldi', stageId: stage.id });
  }

  private titleScene(): Scene {
    this.menuIndex = 0;
    this.menuItems = [];
    const stages = this.mods.stages;
    this.titleItems = [stages[0] ? `출동 · ${stages[0].label}` : '출동', '허수아비 연습'];
    let t = 0;
    return {
      tick: (p) => {
        t++;
        const n = this.titleItems.length;
        if (p.pressed.has('up')) this.menuIndex = (this.menuIndex + n - 1) % n;
        if (p.pressed.has('down')) this.menuIndex = (this.menuIndex + 1) % n;
        if (p.pressed.has('attack') || p.pressed.has('jump') || p.pressed.has('interact')) this.titlePick(this.menuIndex);
      },
      draw: () => {
        const c = this.ctx;
        c.fillStyle = '#0d1114';
        c.fillRect(0, 0, SCREEN_W, SCREEN_H);
        c.fillStyle = '#e8eef0';
        c.textAlign = 'center';
        c.font = 'bold 30px monospace';
        c.fillStyle = '#8e9aa1';
        c.fillText('ANOMALY SIMULATION', SCREEN_W / 2, 120);
        c.font = 'bold 58px sans-serif';
        c.fillStyle = '#e8eef0';
        c.fillText('관리국 · 차원 승강기', SCREEN_W / 2, 190);
        c.textAlign = 'left';
        this.drawMenuNoBg(this.titleItems);
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
        void t;
      },
    };
  }

  private drawMenuNoBg(items: string[]) {
    const c = this.ctx;
    c.textAlign = 'center';
    c.font = '30px sans-serif';
    items.forEach((tx, i) => {
      const y = 300 + i * 64;
      c.fillStyle = i === this.menuIndex ? '#ffd36a' : 'rgba(255,255,255,0.1)';
      c.fillRect(SCREEN_W / 2 - 230, y - 40, 460, 54);
      c.fillStyle = i === this.menuIndex ? '#1a1f22' : '#e8eef0';
      c.fillText(tx, SCREEN_W / 2, y - 3);
    });
    c.textAlign = 'left';
    this.menuItems = items.map((_, i) => ({ y0: 300 + i * 64 - 40, y1: 300 + i * 64 + 14 }));
  }

  private resultScene(r: RunResultCore): Scene {
    this.menuIndex = 0;
    this.menuItems = [];
    const how = { return: '귀환', withdraw: '철수', evac: '후송' }[r.how];
    let t = 0;
    return {
      tick: (p) => {
        if (++t > 20 && (p.pressed.has('attack') || p.pressed.has('jump') || p.pressed.has('interact') || p.pressed.has('pause'))) {
          this.world = null;
          this.scene = this.titleScene();
        }
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
        this.menuItems = [{ y0: 0, y1: SCREEN_H }];
      },
    };
  }
}
