// 주 루프와 장면 관리. 30Hz 고정 틱 + 화면 주사율 그리기(보간).
// 장면: 제목 → 본부(hq 모듈, 없으면 바로 출동) → 출동(층 → 층 …) → 본부 정산 / 엔진 정산 화면 → 제목·본부.
// 화면 틀·메뉴·HUD는 ui 모듈(껍데기)이 있으면 그쪽을, 없으면 엔진 기본을 쓴다.
import { pfont } from './pxfont';
import { view } from './view';
import { aiHold } from '../fighter/ai';
import { versus, roundEnd, KO_SEC, OVER_SEC, INTRO_SEC, CLOCK_SEC, TRANS, VS_RAISE, type Side } from './versus';
import { charSize } from '../charSize';

/** 필드 화면 확대 100%: 무확대(월드 1px = 화면 CSS 1px, 사용자 2026-10-27). 화면 확대 슬라이더로 최대 250% */
export const BASE_ZOOM = 1;
import { SCREEN_H, SCREEN_W, TICK_HZ, type GameEvent, type HqModuleLike, type RunConfigCore, type RunResultCore, type StageModule } from './contract';
import type { Art } from './art';
import { Input, type Pad } from './input';
import { makeRenderer, type Renderer } from './render';
import { World, type EnemyFactory, type ItemUse } from './world';
import type { RunCheckpoint } from './checkpoint';

export interface EngineModules {
  saveCheckpoint?(value: RunCheckpoint | null): void;
  stages: StageModule[];
  enemyFactory?: EnemyFactory;
  itemUse?: ItemUse;
  hq?: HqModuleLike;
  /** 본부 메뉴 창을 붙일 곳: 게임 화면(1280×720) 층. 없으면 게임 상자. NPC 대화창과 같은 층이라 같이 커지고 같은 자리에 뜬다 */
  hqLayer?: () => HTMLElement | null;
  /** 모든 엔진 이벤트를 듣는 곳 (소리·화면 효과·대사) */
  listeners?: ((e: GameEvent) => void)[];
  /** 대사창이 전투를 멈추고 있는가 */
  blocking?: () => boolean;
  /** 히트스톱·필살 컷인 동안 true: 월드를 진행하지 않는다 */
  frozen?: () => boolean;
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
  /** 불투명 컷씬이 전체 화면을 덮을 때 배경 월드를 다시 그리지 않는다. */
  covered?: () => boolean;
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

/** 대전 화면 확대 (11-08 사용자 「캐릭터 픽셀 2배」): 무대 1280 중 절반이 보이고 화면이 두 사람을 따라간다 */
/** 대전: 그림판 세로에 보이는 월드 높이. 600 → 960 그림판에서 도트 1.6배 (11-08 사용자: 킹오파처럼 캐릭터 키 = 화면 절반쯤) */
const VS_VIEW_H = 686;   // 960 / 686 = 도트 1.4배 (11-08 사용자: 1.6배도 킹오파보다 크다)
const NO_PAD: Pad = { held: new Set(), pressed: new Set(), released: new Set(), mx: 0, my: 0, evade: false, run: false, downDouble: false };

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly input = new Input();
  world: World | null = null;
  /** 대전 판 끝 반응할 몸 (이긴 쪽·진 쪽) */
  private vsReact: { win: unknown; lose: unknown } | null = null;
  /** 대전 화면 왼쪽 끝(월드 x). -1 = 아직 없음 */
  private vsCam = -1;
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
      if (this.dead) return;
      this.raf = requestAnimationFrame(frame);
      if (!this.last) this.last = now;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.mods.frame?.(dt);
      // 대전 K.O. 순간 슬로 모션 (11-08 사용자): 쓰러지기 시작한 판 시간 0.6초를 실제로는 약 2초에 걸쳐
      const slow = view.clear && versus.ko && versus.ko.t > KO_SEC - 0.6 ? 0.3 : 1;
      this.acc += dt * slow;
      view.vsSlow = slow;
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
      if (!this.mods.covered?.()) {
        const w = this.world;
        // 설정 「화면 확대」: 배경과 사람을 같이 키운다.
        // 필드(PC): 100% = 월드 1px를 화면 BASE_ZOOM px로 고정 (사용자 2026-10-27: 그림·창 높이에 따라 확대율이 바뀌면 방마다 사람 크기가 달라진다).
        //   창이 크면 더 넓게 보이고, 장면이 화면보다 짧으면 위아래는 검게, 길면 주인공을 따라 위아래로 움직인다.
        // 폰처럼 낮은 창(CSS 600px 미만)과 필드 밖은 예전처럼 장면 세로가 창에 꽉 (그림 700, 그 밖 720)
        // 11-02 사용자: 필드는 장면 세로를 창에 꽉 채우고(검은 띠 없음), 사람이 가장 큰 장면 기준으로 다른 장면은 더 키운다(view.sceneZoom ≥ 1, 위아래는 주인공을 따라 움직임). 10-27의 PC 1배 고정은 폐기.
        const H = this.inHub ? view.worldH : SCREEN_H;
        // 투명 무대(대전)는 그림판이 16:9보다 높다: 폭 기준으로 그리고 남는 위쪽은 비워 둔다
        view.zoom = view.clear && !this.inHub ? (this.canvas.height / VS_VIEW_H) : (this.canvas.height / H) * Math.max(1, charSize.k) * (this.inHub ? view.sceneZoom : 1);
        if (w) view.lane = w.lane;
        const vw = this.canvas.width / view.zoom;
        view.w = this.inHub ? Math.max(SCREEN_W, vw) : SCREEN_W;
        view.hub = this.inHub;
        // 화면 밀기는 그림과 같은 보간 위치로 (틱 위치로 하면 걸을 때 화면이 30Hz로 툭툭 따라가 캐릭터가 떨린다).
        // 렌더러는 camX를 정수로 반올림하므로, 둘을 합한 이동이 화면 px 정수가 되게 crop을 맞춘다
        view.crop = 0;
        // 렌더러와 같은 보간값: 층 단추·대화창·본부 창이 떠서 월드가 멈춘 동안 여기만 틱 진행률로 움직이면 화면이 매 장 좌우로 떨린다 (리스 좁은 창)
        const frozen = paused || !!this.mods.blocking?.() || !!this.mods.hq?.isOpen?.();
        if (view.clear && !this.inHub && w && vw < view.vsLen) {
          // 대전 (11-08 사용자 「무대는 길고 화면이 왔다 갔다」): 두 사람 가운데를 따라간다. 무대 끝(대기 인물 자리)은 그쪽으로 가야 보인다
          const a = frozen ? 1 : this.acc / T;
          const at = (b: { x: number; px?: number }) => (b.px ?? b.x) + (b.x - (b.px ?? b.x)) * a;
          const p = w.player, foes = w.bodies.filter((b) => b.team === 'enemy' && b.alive);
          const foe = foes.sort((m, n) => Math.abs(m.x - p.x) - Math.abs(n.x - p.x))[0];
          // 판 사이(태그매치 11-08 사용자): 암전 뒤 화면은 무대 가운데에 고정하고, 다음 캐릭터만 날아 들어온다 (날아오는 캐릭터를 따라가지 않게)
          const mid = versus.trans?.placed ? view.vsLen / 2 : foe ? (at(p) + at(foe)) / 2 : at(p);
          const want = Math.max(0, Math.min(view.vsLen - vw, mid - vw / 2));
          // 부드럽게 따라가기 (한 장에 남은 거리의 12%)
          this.vsCam = this.vsCam < 0 ? want : this.vsCam + (want - this.vsCam) * (frozen ? 0 : 0.12);
          // 렌더러는 월드 카메라를 보간·반올림한 값(drawCamX)으로 옮긴다 → 같은 값을 빼야 한다 (w.camX 를 빼면 달릴 때 장마다 앞뒤로 떨린다, 11-08 사용자 「화면이 달달거려」)
          const camDraw = Math.round(w.prevCamX + (w.camX - w.prevCamX) * a);
          view.crop = Math.round(this.vsCam * view.zoom) / view.zoom - camDraw;
          view.vsX0 = this.vsCam;
        } else if (vw < SCREEN_W && w) {
          const a = frozen ? 1 : this.acc / T,
            cam = Math.round(w.prevCamX + (w.camX - w.prevCamX) * a),
            px = (w.player.px ?? w.player.x) + (w.player.x - (w.player.px ?? w.player.x)) * a,
            raw = Math.max(0, Math.min(SCREEN_W - vw, px - cam - vw / 2));
          view.crop = Math.round((cam + raw) * view.zoom) / view.zoom - cam;
        }
        // 확대해서 세로가 다 안 들어가면 주인공 발이 화면 아래쪽 1/3에 오게 위아래를 자른다
        view.cropY = 0;
        const vh = this.canvas.height / view.zoom;
        if (this.inHub) {
          // 장면 밖(짧거나 좁은 장면의 남는 곳)은 검게
          this.ctx.fillStyle = '#000';
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (vh > H + 0.5) {
          // 장면이 화면보다 짧다: 가운데 두고 위아래는 검게
          view.cropY = -Math.round(((vh - H) / (view.clear ? 1 : 2)) * view.zoom) / view.zoom; // 투명 무대는 바닥을 아래에 붙인다
        } else if (view.clear && !this.inHub) {
          view.cropY = H - vh + VS_RAISE;   // 대전: 발 줄을 화면 아래에서 조금 띄운다 (11-08 사용자 「캐릭터가 너무 밑에」)
        } else if (vh < H - 0.5 && w) {
          const a = frozen ? 1 : this.acc / T, p = w.player as { y: number; py?: number };
          const py = (p.py ?? p.y) + (p.y - (p.py ?? p.y)) * a;
          view.cropY = Math.round(Math.max(0, Math.min(H - vh, py - vh * 0.7)) * view.zoom) / view.zoom;
        }
        if (view.clear) {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          const f = this.vsFold();
          this.canvas.style.transform = f < 1 ? `scaleY(${Math.max(0.001, f).toFixed(3)})` : '';
        }
        this.ctx.save();
        this.ctx.scale(view.zoom, view.zoom);
        this.ctx.translate(-view.crop, -view.cropY);
        this.scene.draw(paused ? 1 : this.acc / T);
        this.ctx.restore();
        // K.O. 순간 붉게 한 번 깜빡 (11-08 사용자): 그려진 캐릭터 위에만 (빈 곳=본문은 칠하지 않는다)
        // K.O. 순간 화면 번쩍 (11-08 사용자 「슬로로 날아가면서 화면 빛나는 효과」): 배경이 있는 무대만 (투명 무대는 본문을 덮지 않게 캐릭터 색만)
        if (view.clear && view.vsBg && versus.ko && versus.ko.t > KO_SEC - 0.12) {
          this.ctx.fillStyle = `rgba(255,255,255,${(0.75 * (versus.ko.t - (KO_SEC - 0.12)) / 0.12).toFixed(3)})`;
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (view.clear && !view.vsBg && versus.ko && versus.ko.t > KO_SEC - 0.1) {   // 배경이 있으면 그림판 전체가 붉어지므로 캐릭터 색 입히기로 (아래 vsReact)
          this.ctx.save();
          this.ctx.globalCompositeOperation = 'source-atop';
          this.ctx.fillStyle = 'rgba(255,30,20,.75)';
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.restore();
        }
        this.mods.overlay?.(this.ctx, this.world, dt);
      }
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
    this.checkpoint();
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.world = null;
    this.run = null;
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
    this.checkpoint();
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
    this.deploy({ seed: Math.floor(Math.random() * 1e9), agent: 'eileen', stageId: stage.id });
  }

  private dead = false;
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
      // 걷는 본부(엔진 장면)면 게임 화면 층에: 큰 창에서 임무 창만 작게 우하단에 붙던 문제 (사용자 2026-10-25)
      ((hq.hub && this.mods.hqLayer?.()) || this.box).appendChild(this.hqRoot);
      hq.mount(this.hqRoot, {
        deploy: (run) => this.deploy(run),
        stages: () => this.mods.stages.map((s) => ({ id: s.id, label: s.label })),
      });
    }
    this.hqRoot.hidden = false;
    if (hq.hub) {
      // 본부 = 엔진 벨트 장면. 메뉴 창(DOM)은 열렸을 때만 보인다
      const stage = hq.hub();
      const run: RunConfigCore = { seed: Math.floor(Math.random() * 1e9), agent: 'eileen', stageId: stage.id };
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

  deploy(run: RunConfigCore, saved?: RunCheckpoint) {
    const stage = this.mods.stages.find((s) => s.id === run.stageId) ?? this.mods.stages[0];
    // 본부의 MissionLaunch에는 stageId가 없을 수 있다. 실제 선택된 무대를
    // 출동·월드·저장에 공통으로 남겨 기본 무대로 출동한 기록도 복원한다.
    run = { ...run, stageId: stage.id };
    this.inHub = false;
    this.run = run;
    this.runStage = stage;
    if (this.hqRoot) this.hqRoot.hidden = true;
    this.canvas.style.visibility = '';
    const w = new World(run, this.art.clips, stage, this.mods.enemyFactory);
    if (this.mods.itemUse) w.itemUse = this.mods.itemUse;
    for (const l of this.mods.listeners ?? []) w.on(l);
    this.mods.onWorld?.(w, run);
    w.enterFloor(saved && stage.restore ? stage.restore(saved.stage) : stage.firstFloor(run));
    if (saved) w.restore(saved.world);
    this.world = w;
    this.paused = false;
    this.scene = this.battleScene(w);
    this.mods.onPlay?.();
    this.mods.onScene?.('battle');
    this.checkpoint(true);
  }

  /** 전투 도중에는 직전 안전 지점을 유지한다. HP·탄·드랍도 함께 되돌린다. */
  checkpoint(force = false) {
    const w = this.world;
    if (!w || this.inHub || !this.run || !w.canCheckpoint() || (!force && this.mods.blocking?.())) return;
    const stage = this.runStage?.snapshot?.();
    if (!stage) return;
    this.mods.saveCheckpoint?.({ version: 1, run: this.run, stage, world: w.snapshot(), savedAt: Date.now() });
  }

  async resume(saved: RunCheckpoint) {
    // v1 초기 저장은 기본 무대의 ID를 생략했다. 명시된 알 수 없는 ID는 거부한다.
    const stageId = saved.run.stageId ?? this.mods.stages[0]?.id;
    if (saved.version !== 1 || !this.mods.stages.some(s => s.id === stageId && s.restore)) throw new Error('지원하지 않는 출동 저장');
    if (this.mods.hq) { this.showHq(); await this.mods.hq.ready?.(); }
    this.deploy({ ...saved.run, stageId }, saved);
    this.world?.say('출동 복원 완료. 전투 중 중단한 경우 마지막 안전 지점부터 이어집니다.', 4);
  }

  /** 출동 끝내기 (철수 메뉴 등에서도 부른다) */
  endRun(how: RunResultCore['how']) {
    const w = this.world;
    if (!w || this.inHub) return;
    const result: RunResultCore = {
      how,
      floors: Number(w.notes['stage.visitedCount'] ?? w.floors),
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
      // 영상보다 정산·저장을 먼저 한다. 영상을 보는 중 닫아도 보상이 사라지지 않는다.
      this.mods.hq.onReturn((this.mods.toHqResult?.(result, w) ?? result) as RunResultCore, run);
      this.mods.saveCheckpoint?.(null);
      const back = () => this.showHq();
      if (this.mods.afterRun) {
        this.scene = this.idleScene('cutscene');
        this.mods.afterRun(how, back);
      } else back();
      return;
    }
    this.mods.saveCheckpoint?.(null);
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
        if (this.mods.blocking?.() || this.mods.frozen?.()) return; // frozen = 히트스톱·필살 컷인
        // 대전(투명 무대): 판 시작(ROUND n → FIGHT)·경기 끝 표시 동안은 멈춘다
        if (view.clear && versus.hold) return;
        if (view.clear && versus.trans) { this.vsTrans(w, p); return; }
        if (view.clear && (versus.intro > 0 || versus.over)) {
          const dt = 1 / TICK_HZ;
          if (versus.intro > 0) { if (versus.mode !== 'survival') w.openEncounter(); versus.intro = Math.max(0, versus.intro - dt); aiHold.on = true; w.step(NO_PAD); }   // ROUND·GO 동안: 둘 다 제자리에 서서 대기 동작만 (손은 뗀 채)
          if (versus.over && (versus.over.t -= dt) <= 0) {
            const side = versus.over.side;
            versus.over = null;
            versus.onMatchEnd?.(side);
          }
          return;
        }
        // 대전 K.O. 뒤에는 양쪽 다 손을 뗀다 (11-08 사용자): 1P 입력 비우고 AI 두뇌 멈춤. 쓰러지는 동작·승리 동작은 그대로
        aiHold.on = view.clear && !!versus.ko;
        w.step(view.clear && versus.ko ? NO_PAD : p);
        if (view.clear) this.vsPushApart(w);
        if (view.clear && versus.mode !== 'survival') this.vsKeepOnScreen(w);
        // 대전: 쓰러지면 KO 표시 → 3판 2선승이면 경기 끝, 아니면 같은 무대로 다음 판. 본부·결과 화면으로 가지 않는다
        if (view.clear) {
          // 서바이벌은 상대가 다 쓰러져도 판이 끝나지 않는다 (웨이브가 이어짐, engine/survival.ts)
        const foeDown = versus.mode !== 'survival' && w.bodies.some((b) => b.team === 'enemy') && !w.bodies.some((b) => b.team === 'enemy' && b.alive && b.hp > 0);
          // 판 시간 (서바이벌은 없음): 다 되면 남은 체력 비율이 높은 쪽 승 (같으면 1P)
          if (!versus.ko && versus.mode !== 'survival') versus.clock = Math.max(0, versus.clock - 1 / TICK_HZ);
          const timeUp = !versus.ko && versus.mode !== 'survival' && versus.clock <= 0;
          if (!versus.ko && ((w.ended && versus.mode !== 'survival') || foeDown || w.player.hp <= 0 || timeUp)) {
            const foe = w.bodies.find((b) => b.team === 'enemy' && b.alive && b.hp > 0) ?? w.bodies.find((b) => b.team === 'enemy');
            const ratio = (b: { hp: number; hpMax: number } | undefined) => (b && b.hpMax > 0 ? Math.max(0, b.hp / b.hpMax) : 0);
            const rp = ratio(w.player), rf = ratio(foe);
            const side: Side = timeUp && w.player.hp > 0 && !foeDown ? (rp >= rf ? 0 : 1) : w.player.hp > 0 && foeDown ? 0 : 1;
            const win = side === 0 ? rp : rf;
            const kind = timeUp && w.player.hp > 0 && !foeDown ? 'time' : win >= 0.999 ? 'perfect' : 'ko';
            versus.ko = { side, t: KO_SEC, kind, next: roundEnd(side, [rp, rf]) };
            this.vsReact = { win: side === 0 ? w.player : foe, lose: side === 0 ? foe : w.player };
            for (const b of [w.player, foe] as unknown as { core?: { P: { armorT: number; armorC?: string } } }[]) if (b?.core) { b.core.P.armorT = 0.28; b.core.P.armorC = '#ff2a2a'; }   // K.O. 순간 캐릭터만 붉게
          } else if (versus.ko && versus.ko.t > KO_SEC - 1.4) {
            versus.ko.t -= 1 / TICK_HZ;   // 쓰러지는 걸 잠깐 보고
          } else if (versus.ko && (versus.ko.t -= 1 / TICK_HZ) > 0) {
            // 판 끝 반응 (11-08 사용자): 이긴 쪽 기뻐하기(35), 서 있는 진 쪽(시간 끝) 화내기(32). 하던 동작이 끝나면 다시
            const emo = (b: unknown, id: string) => {
              const core = (b as { core?: { has(i: string): boolean; emote(i: string, fps: number): void; P: { mode: string } } } | undefined)?.core;
              if (core?.has(id) && core.P.mode !== 'act' && (b as { hp: number }).hp > 0) core.emote(id, 8);
            };
            emo(this.vsReact?.win, '35');
            emo(this.vsReact?.lose, '32');
          } else if (versus.ko && versus.ko.t <= 0) {
            const { side, next } = versus.ko;
            versus.ko = null;
            if (next === 'over') versus.over = { side, t: OVER_SEC };
            else versus.trans = { t: 0, lose: (1 - side) as Side, placed: false };
          }
          return;
        }
        if (w.ended) {
          const how = w.ended;
          if (how === 'next') {
            const next = this.runStage!.nextFloor(this.run!, w.floor, 'next');
            if (next) { w.enterFloor(next); this.checkpoint(true); }
            else this.endRun('return');
          } else this.endRun(how);
        }
        else if (w.tick % 60 === 0) this.checkpoint();
      },
      draw: (a) => {
        this.renderer.draw(w, this.paused || this.mods.blocking?.() || this.mods.hq?.isOpen?.() ? 1 : a);
        if (this.paused) this.drawMenu('일시정지', ['계속', w.showBoxes ? '판정 보기 끄기' : '판정 보기 켜기', '철수 (출동 끝내기)', '처음으로']);
      },
    };
  }

  /** 판 사이 넘어가기 (11-08 사용자). 접히는 동안 새 판을 차리고, 펴진 뒤 진 쪽 캐릭터가 화면 밖에서 점프해 자리로 들어온다 */
  private vsTrans(w: World, p: Pad) {
    const tr = versus.trans!;
    tr.t += 1 / TICK_HZ;
    const T0 = TRANS.fold;
    if (tr.t >= T0 && !tr.placed && w === this.world) {
      // 암전 동안 새 판: 화면은 가운데부터 다시 따라간다
      versus.clock = CLOCK_SEC;
      this.vsCam = -1;
      tr.placed = true;
      this.start_new(this.run?.stageId);
      return;
    }
    if (!tr.placed) return;
    // 새 판 첫 틱: 상대를 세우려고 한 번만 진행하고, 들어올 쪽을 화면 밖으로
    const body = (tr.lose === 0 ? w.player : w.bodies.find((b) => b.team === 'enemy')) as unknown as { x: number; y: number; z: number; px?: number; py?: number; pz?: number; homeX?: number; homeY?: number } | undefined;
    if (!body) { w.step(p); return; }
    const home = body.homeX ?? (body.homeX = body.x), homeY = body.homeY ?? (body.homeY = body.y);
    // 태그매치 (11-08 사용자): 다음 캐릭터는 자기 대기 자리(뒤 줄)에서 길게 한 번 뛰어 시작 자리로. 멀수록 오래·높이
    // 1:1 은 진 쪽이 화면 밖에서 점프로 들어온다
    let off = tr.lose === 0 ? home - 260 : home + 260, offY = homeY, enter = TRANS.enter, high = 150;
    if (versus.mode === 'team') {
      const sp = view.vsBg?.bench.spots[tr.lose]?.[0], L = view.vsLen;
      off = sp ? sp.x : tr.lose === 0 ? 220 : L - 220;
      offY = homeY + (sp ? sp.dy : -150);
      const d = Math.abs(home - off);
      enter = 0.5 + d / 1500; high = 150 + d * 0.1;
    }
    const e = (tr.t - (TRANS.fold + TRANS.dark + TRANS.open)) / enter;
    const k = Math.max(0, Math.min(1, e));
    body.x = off + (home - off) * k;
    body.y = offY + (homeY - offY) * k;
    body.z = k > 0 && k < 1 ? Math.sin(k * Math.PI) * high : 0;
    body.px = body.x; body.py = body.y; body.pz = body.z;
    // 엔진 틱이 멈춘 동안이라 캐릭터 그림(코어)이 몸을 따라오지 않는다 → 직접 맞춘다 (그림자만 날아가던 문제)
    const core = (body as { core?: { P: Record<string, any>; A: Record<string, { n: number } | undefined> }; synced?: { x: number; y: number }; started?: boolean });
    if (core.core) {
      const P = core.core.P, n = core.core.A['7']?.n ?? 0;
      P.x = body.x; P.y = body.y; P.z = body.z; P.face = tr.lose === 0 ? 1 : -1; core.started = true;
      if (core.synced) { core.synced.x = body.x; core.synced.y = body.y; }
      // 뛰는 동안은 점프 그림(7번 줄)을 날아가는 정도에 맞춰, 내려앉으면 대기로
      if (k > 0 && k < 1 && n) { P.mode = 'air'; P.clip = { id: '7', seq: [{ f: Math.min(n - 1, Math.floor(k * n)), d: 9 }], i: 0, t: 0, loopFrom: 0, done: false, onEnd: null, paused: false }; }
      else if (P.mode === 'air') { P.mode = 'ground'; P.clip = null; }
    }
    if (e >= 1) {
      body.x = home; body.y = homeY; body.z = 0; delete body.homeX; delete body.homeY;
      versus.trans = null;
      versus.intro = INTRO_SEC;
    }
  }

  /** 대전(11-08 사용자 「화면을 벗어나면 안되지」): 두 사람이 늘 한 화면 안에. 벌어지면 이번 틱에 바깥으로 더 움직인 쪽을 붙잡는다 */
  /** 대전 몸통 판정 (11-08 사용자 「몸으로 달려와 비비면서 공격」): 서 있는 캐릭터끼리는 겹치지 않고 서로 밀어낸다. 공중(점프로 넘기)·누운 몸은 빼고 */
  private vsPushApart(w: World) {
    const MIN = 72;
    type B = { x: number; z: number; alive: boolean; team?: string; core?: { P: { mode: string } } };
    const bs = ([w.player, ...w.bodies] as unknown as B[]).filter((b) => b.alive && b.team !== 'neutral' && b.z < 20 && !['down', 'belly', 'dead'].includes(b.core?.P.mode ?? ''));
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j], d = b.x - a.x, ad = Math.abs(d);
      if (ad >= MIN) continue;
      const s = d === 0 ? (i % 2 ? 1 : -1) : Math.sign(d), half = (MIN - ad) / 2;
      a.x -= s * half; b.x += s * half;
    }
    const L = view.vsLen;
    for (const b of bs) b.x = Math.max(40, Math.min(L - 40, b.x));
  }

  private vsKeepOnScreen(w: World) {
    const p = w.player as unknown as { x: number; px?: number }, foe = w.bodies.find((b) => b.team === 'enemy' && b.alive) as unknown as { x: number; px?: number } | undefined;
    if (!foe) return;
    const maxD = this.canvas.width / view.zoom - 160;
    const d = Math.abs(foe.x - p.x);
    if (d <= maxD) return;
    const ex = d - maxD, s = Math.sign(foe.x - p.x) || 1;
    const outP = -s * (p.x - (p.px ?? p.x)), outF = s * (foe.x - (foe.px ?? foe.x));
    if (outF >= outP) foe.x -= s * ex; else p.x += s * ex;
  }

  /** 판 사이 화면 접기·펴기 (그림판 세로 배율) */
  private vsFold(): number {
    const tr = versus.trans;
    if (!tr) return 1;
    const { fold, dark, open } = TRANS;
    if (tr.t < fold) return 1 - tr.t / fold;
    if (tr.t < fold + dark) return 0;
    if (tr.t < fold + dark + open) return (tr.t - fold - dark) / open;
    return 1;
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
      c.font = pfont(44).f;
      c.fillText(title, SCREEN_W / 2, 210);
    }
    c.textAlign = 'center';
    c.font = pfont(30).f;
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
        c.font = pfont(58).f;
        c.fillStyle = '#e8eef0';
        c.fillText('괴이 ː ANOMALY', SCREEN_W / 2, 190);
        this.drawMenu('', this.titleItems, false);
        c.fillStyle = '#8e9aa1';
        c.font = pfont(20).f;
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
    const how = { return: '귀환', withdraw: '철수', evac: '후송', death: '사망' }[r.how];
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
        c.fillStyle = r.how === 'death' ? '#c23030' : r.how === 'evac' ? '#ff6a5a' : '#7fe0a0';
        c.font = pfont(64).f;
        c.fillText(how, SCREEN_W / 2, 200);
        c.fillStyle = '#e8eef0';
        c.font = pfont(30).f;
        const lines = [`처치 ${r.kills}`, `최대 콤보 ${r.maxCombo}`, `층 ${r.floors}`, `시간 ${r.timeSec}초`, `남은 체력 ${r.hpLeft}`];
        lines.forEach((l, i) => c.fillText(l, SCREEN_W / 2, 290 + i * 48));
        c.fillStyle = '#8e9aa1';
        c.font = pfont(22).f;
        c.fillText('A 또는 화면을 누르면 처음으로', SCREEN_W / 2, 600);
        c.textAlign = 'left';
      },
    };
  }
}
