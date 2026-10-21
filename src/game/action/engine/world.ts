// 전투 세계: 30Hz 한 틱 = 입력 → 플레이어 → 몸들 → 판정(히트스톱·넉백) → 싸움 구간 → 층 모듈 → 카메라.
import {
  SCREEN_W,
  type Body,
  type FloorPlan,
  type GameEvent,
  type Hit,
  type PropSpec,
  type RunConfigCore,
  type SpawnSpec,
  type StageApi,
  type StageModule,
  type WorldView,
} from './contract';
import type { FrameInfo } from './art';
import { Bullet, Dummy, Thug } from './bodies';
import { Fighter, overlap } from './fighter';
import type { Pad } from './input';
import { Player } from './player';

export type EnemyFactory = (spec: SpawnSpec, world: WorldView) => Body;
export type ItemUse = (slot: number, api: StageApi) => false | { anim: 'drink' | 'eat' | 'bandage' | 'toss'; consumed: boolean; label?: string };

export interface Fx {
  kind: 'spark' | 'spark-big' | 'dust' | 'flash' | 'boom' | 'ring' | 'text';
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
  text?: string;
  seed: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 엔진 기본 적: 허수아비 + 임시 적 (적 모듈에 없는 종류도 이걸로) */
export const fallbackEnemy: EnemyFactory = (s, w) => (s.kind.startsWith('dummy') ? new Dummy(s.x, s.y, s.kind === 'dummy') : new Thug(s, w));

const STOP_DEFAULT = { none: 1, flinch: 3, stagger: 4, launch: 6, down: 6, bind: 4 } as const;

export class World implements WorldView {
  tick = 0;
  rand: () => number;
  player: Player;
  bodies: Body[] = [];
  floor!: FloorPlan;
  lane: [number, number] = [500, 680];
  bounds: [number, number] = [0, SCREEN_W];
  noise = 0;
  light = 1;
  fxs: Fx[] = [];
  camX = 0;
  shakeT = 0;
  shakeP = 0;
  subtitle: { text: string; t: number } | null = null;
  banner: { text: string; t: number } | null = null;
  props: PropSpec[] = [];
  encIndex = 0;
  encActive = -1;
  encWave = 0;
  encBodies: Body[] = [];
  goT = 0;
  /** 필살기 컷인 남은 틱 (그동안 세계 정지) */
  cutin = 0;
  showBoxes = false;
  kills = 0;
  floors = 0;
  notes: Record<string, unknown> = {};
  ended: 'next' | 'withdraw' | 'evac' | null = null;
  deadT = 0;
  private hitMemo = new Map<string, number>();
  private listeners: ((e: GameEvent) => void)[] = [];
  private stageApi: StageApi;
  enemyFactory: EnemyFactory;
  /** 모듈이 매 틱 덧붙이는 일 (아이템 등) */
  hooks: (() => void)[] = [];
  /** 싸움 구간을 막는 몸인가 (적 모듈: 평화로운 주민 등은 아님) */
  threat: (b: Body) => boolean = () => true;
  /** E를 눌렀을 때 (적 모듈 규칙 신호 등). 가장 가까운 소품을 같이 준다 */
  interactHooks: ((prop: PropSpec | null) => void)[] = [];
  /** 몸 아래에 덧그리기 (바닥 물건 등). ctx는 화면 좌표 */
  underlays: ((ctx: CanvasRenderingContext2D, camX: number) => void)[] = [];
  itemUse: ItemUse | null = null;
  items: ({ id: string; label: string; n: number } | null)[] = [
    { id: 'bandage', label: '붕대', n: 2 },
    { id: 'ammo', label: '탄약 상자', n: 1 },
    null,
    null,
  ];

  constructor(
    public run: RunConfigCore,
    clips: Record<string, FrameInfo[]>,
    public stage: StageModule | null,
    enemyFactory?: EnemyFactory,
  ) {
    this.rand = mulberry32(run.seed || 1);
    this.player = new Player(clips);
    if (run.hpMax) this.player.hp = this.player.hpMax = run.hpMax;
    this.enemyFactory = enemyFactory ?? fallbackEnemy;
    const self = this;
    this.stageApi = {
      get world() {
        return self;
      },
      spawn: (s) => this.spawn(s),
      setProp: (id, patch) => {
        const i = this.props.findIndex((p) => p.id === id);
        if (i < 0) {
          if (patch) this.props.push({ id, kind: 'decor', x: 0, y: this.lane[0], w: 40, h: 40, ...patch } as PropSpec);
          return;
        }
        if (patch === null) this.props.splice(i, 1);
        else this.props[i] = { ...this.props[i], ...patch };
      },
      hurtPlayer: (dmg, stagger = true) => {
        const p = this.player;
        if (stagger) p.applyHit({ x0: 0, x1: 0, z0: 0, z1: 0, y: p.y, attackId: -this.tick, dmg, react: 'flinch', dir: (-p.dir) as 1 | -1, push: 2 }, this);
        else p.hp = Math.max(0, p.hp - dmg);
      },
      heal: (n) => {
        this.player.hp = Math.min(this.player.hpMax, this.player.hp + n);
        this.emit({ type: 'heal', x: this.player.x });
      },
      note: (k, v) => (this.notes[k] = v),
      finish: (how) => {
        if (!this.ended) this.ended = how;
      },
      movePlayer: (x, y) => {
        const p = this.player;
        p.x = p.px = x;
        if (y !== undefined) p.y = p.py = y;
        p.vx = p.vy = 0;
      },
    };
  }

  get api() {
    return this.stageApi;
  }

  on(f: (e: GameEvent) => void) {
    this.listeners.push(f);
    return () => (this.listeners = this.listeners.filter((g) => g !== f));
  }

  emit(e: GameEvent) {
    for (const f of this.listeners) {
      try {
        f(e);
      } catch (err) {
        console.warn('[goei] 이벤트 처리 오류', err);
      }
    }
    if (this.stage?.onEvent) this.stage.onEvent(this.stageApi, this.floor, e);
  }

  add(b: Body) {
    this.bodies.push(b);
  }

  addBullet(o: { x: number; y: number; z: number; dir: 1 | -1 }) {
    this.add(new Bullet(o.x, o.y, o.z, o.dir));
    this.fx('flash', o.x, o.y, o.z);
  }

  fx(kind: Fx['kind'], x: number, y: number, z: number, text?: string) {
    const life = { spark: 7, 'spark-big': 10, dust: 12, flash: 3, boom: 16, ring: 9, text: 30 }[kind];
    this.fxs.push({ kind, x, y, z, t: 0, life, text, seed: Math.floor(this.rand() * 1e6) });
    if (this.fxs.length > 80) this.fxs.shift();
  }

  shake(ticks: number, power = 2) {
    this.shakeT = Math.max(this.shakeT, ticks);
    this.shakeP = Math.max(this.shakeT > 0 ? this.shakeP : 0, power);
  }

  say(text: string, seconds = 2) {
    this.subtitle = { text, t: Math.round(seconds * 30) };
  }

  spawn(s: SpawnSpec): Body {
    const b = this.enemyFactory(s, this);
    this.add(b);
    this.emit({ type: 'enemySpawn', x: s.x, kind: s.kind });
    return b;
  }

  /* ───────── 층 ───────── */

  enterFloor(f: FloorPlan) {
    this.floor = f;
    this.lane = f.lane ?? [500, 680];
    this.bounds = [0, f.length];
    this.props = (f.props ?? []).map((p) => ({ ...p }));
    this.bodies = [];
    this.encIndex = 0;
    this.encActive = -1;
    this.encBodies = [];
    this.ended = null;
    this.noise = 0;
    this.light = 1;
    const p = this.player;
    p.x = p.px = f.startX;
    p.y = p.py = (this.lane[0] + this.lane[1]) / 2;
    p.z = p.pz = 0;
    p.vx = p.vy = p.vz = 0;
    p.dir = 1;
    this.camX = Math.max(0, Math.min(f.length - SCREEN_W, p.x - SCREEN_W / 2));
    this.banner = { text: f.banner ?? f.title, t: 70 };
    this.floors++;
    this.emit({ type: 'enter:floor', floor: f });
  }

  /* ───────── 한 틱 ───────── */

  step(pad: Pad) {
    this.tick++;
    if (pad.pressed.has('hitbox')) this.showBoxes = !this.showBoxes;
    for (const f of this.fxs) f.t++;
    this.fxs = this.fxs.filter((f) => f.t < f.life);
    if (this.subtitle && --this.subtitle.t <= 0) this.subtitle = null;
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    if (this.shakeT > 0) this.shakeT--;
    if (this.goT > 0) this.goT--;

    for (const b of [this.player as Body, ...this.bodies]) {
      const f = b as Partial<Fighter>;
      f.px = b.x;
      f.py = b.y;
      f.pz = b.z;
    }
    if (this.cutin > 0) {
      this.cutin--;
      return;
    }

    const p = this.player;
    // 플레이어
    if (p.stop > 0) p.stop--;
    else {
      p.tick(this, pad);
      if (p.wantSuper) {
        p.wantSuper = false;
        this.cutin = 22;
        this.emit({ type: 'super', x: p.x, move: 'super' });
      }
      if (p.wantInteract) this.interact();
      if (p.wantItem) this.useItem(p.wantItem);
    }
    // 몸들
    for (const b of this.bodies) {
      if (!b.alive) continue;
      if (b.stop > 0) {
        b.stop--;
        continue;
      }
      b.step(this);
    }
    this.separate();
    this.resolveHits();
    this.bodies = this.bodies.filter((b) => {
      if (b instanceof Fighter && b.phase === 'dead' && b.t > 30) b.alive = false;
      return b.alive;
    });
    for (const h of this.hooks) h();
    // 싸움 구간·층
    this.stepEncounters();
    if (this.stage?.tick) this.stage.tick(this.stageApi, this.floor);
    const exitX = this.floor.exitX ?? this.floor.length - 80;
    if (this.encActive < 0 && p.x >= exitX && !this.ended) this.ended = 'next';
    // 플레이어 쓰러짐 → 후송
    if (p.phase === 'dead' || (p.hp <= 0 && p.phase === 'down')) {
      if (++this.deadT > 75 && !this.ended) this.ended = 'evac';
    }
    this.camera();
  }

  private interact() {
    const p = this.player;
    let best: PropSpec | null = null;
    for (const pr of this.props) {
      const d = Math.abs(pr.x - p.x);
      if (d < 60 && (!best || d < Math.abs(best.x - p.x))) best = pr;
    }
    for (const h of this.interactHooks) h(best);
    if (best && this.stage?.onInteract) {
      p.play('pickup', this);
      this.stage.onInteract(this.stageApi, this.floor, best);
    }
  }

  private useItem(slot: number) {
    const p = this.player;
    if (p.move || p.airborne) return;
    if (this.itemUse) {
      const r = this.itemUse(slot, this.stageApi);
      if (r) {
        p.play(r.anim, this);
        this.emit({ type: 'item', x: p.x });
      }
      return;
    }
    // 기본 지급품 (아이템 모듈이 없을 때)
    const it = this.items[slot - 1];
    if (!it || it.n <= 0) return;
    if (it.id === 'bandage') {
      if (p.hp >= p.hpMax) return this.say('다친 곳이 없다', 1);
      p.hp = Math.min(p.hpMax, p.hp + 60);
      p.play('bandage', this);
      this.emit({ type: 'heal', x: p.x, id: it.id });
    } else if (it.id === 'ammo') {
      p.reserve += 24;
      p.play('pickup', this);
      this.emit({ type: 'item', x: p.x, id: it.id });
      this.say('탄약 +24', 1);
    }
    it.n--;
  }

  /** 겹친 몸을 옆으로 밀어낸다 (벨트스크롤에서 서로 뚫고 지나가지 않게) */
  private separate() {
    const list = [this.player as Body, ...this.bodies].filter((b) => b.alive && b.kind !== 'bullet' && b.z <= 0) as Fighter[];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!(a instanceof Fighter) || !(b instanceof Fighter)) continue;
        if (a.phase === 'held' || b.phase === 'held' || a.phase === 'down' || b.phase === 'down' || a.phase === 'dead' || b.phase === 'dead') continue;
        if (a.invuln > 0 || b.invuln > 0) continue;
        if (Math.abs(a.y - b.y) > 12) continue;
        const min = (a.width + b.width) * 0.8;
        const dx = b.x - a.x;
        if (Math.abs(dx) < min) {
          const push = (min - Math.abs(dx)) / 2;
          const s = dx === 0 ? 1 : Math.sign(dx);
          if (a.team === 'player' && a instanceof Player && a.move) b.x += s * push * 2;
          else {
            a.x -= s * push;
            b.x += s * push;
          }
        }
      }
  }

  private resolveHits() {
    const all = [this.player as Body, ...this.bodies].filter((b) => b.alive);
    const frames = new Map(all.map((b) => [b.id, b.frame()]));
    for (const a of all) {
      const fa = frames.get(a.id)!;
      if (!fa.hit.length) continue;
      for (const h of fa.hit)
        for (const t of all) {
          if (t === a || t.team === a.team || t.team === 'neutral' || !t.alive) continue;
          const ft = frames.get(t.id)!;
          if (!ft.hurt.some((hb) => overlap(h, hb))) continue;
          const key = `${a.id}:${h.attackId}:${t.id}`;
          if (this.hitMemo.has(key)) continue;
          this.hitMemo.set(key, this.tick);
          this.applyHit(a, t, h);
          if (a.kind === 'bullet') a.alive = false;
          if (!a.alive) break;
        }
    }
    if (this.hitMemo.size > 400) for (const [k, v] of this.hitMemo) if (this.tick - v > 120) this.hitMemo.delete(k);
  }

  private applyHit(a: Body, t: Body, h: Hit) {
    // 밀리는 쪽은 때린 쪽 반대 (때린 몸의 방향이 아니라 서로의 위치로 정한다)
    const side = Math.sign(t.x - a.x);
    if (side && side !== h.dir) h = { ...h, dir: side as 1 | -1 };
    const r = t.applyHit(h, this);
    const at = { x: (Math.max(h.x0, t.x - 30) + Math.min(h.x1, t.x + 30)) / 2, y: t.y, z: (h.z0 + h.z1) / 2 };
    if (r.kind === 'immune') return;
    const stop = h.stop ?? STOP_DEFAULT[h.react];
    if (r.kind === 'guard') {
      a.stop = Math.max(a.stop, 3);
      t.stop = Math.max(t.stop, 3);
      this.fx('spark', at.x, at.y, at.z);
      return;
    }
    a.stop = Math.max(a.stop, stop);
    t.stop = Math.max(t.stop, stop);
    const strength = h.strength ?? (h.react === 'down' || h.react === 'launch' ? 3 : h.react === 'stagger' ? 2 : 1);
    this.fx(strength >= 3 ? 'spark-big' : 'spark', at.x, at.y, at.z);
    if (strength >= 2) this.fx('ring', at.x, at.y, at.z, String(strength));
    if (strength >= 3) this.shake(6, 3);
    if (h.noise) this.emit({ type: 'custom', name: 'noise', data: h.noise });
    const p = this.player;
    if (a === p || a.kind === 'bullet') {
      p.onConnect(this, !!r.killed);
      if (r.killed) this.kills++;
    }
    const mk = a.kind === 'bullet' ? 'bullet' : a !== p ? 'enemy' : ({ airkick: 'kick', lowkick: 'low', dash: 'dash', blast: 'blast', groundblast: 'blast', grabblast: 'blast', super: 'super', grabknee: 'kick' } as Record<string, 'kick' | 'low' | 'dash' | 'blast' | 'super'>)[p.moveKey] ?? 'punch';
    this.emit({ type: 'hit', strength, x: at.x, y: at.y, z: at.z, dmg: h.dmg, react: h.react, target: t.kind, combo: a === p ? p.combo : 0, kind: mk });
    if (r.killed && t.team === 'enemy' && !(t instanceof Fighter)) this.emit({ type: 'enemyDie', x: t.x, kind: t.kind });
    if (a === p && p.moveKey === 'grabknee') p.keepHeld();
  }

  private stepEncounters() {
    const encs = this.floor.encounters;
    const p = this.player;
    if (this.encActive < 0) {
      const e = encs[this.encIndex];
      if (e && p.x >= e.triggerX) {
        this.encActive = this.encIndex;
        this.encWave = 0;
        this.bounds = [e.lockFrom, e.lockTo];
        this.spawnWave();
        this.emit({ type: 'combat:start', index: this.encActive });
        if (e.waves.some((w) => w.some((s) => s.boss))) this.emit({ type: 'combat:boss', index: this.encActive });
      }
      return;
    }
    const e = encs[this.encActive];
    this.encBodies = this.encBodies.filter((b) => b.alive && b.hp > 0 && this.threat(b) && !(b instanceof Fighter && (b.phase === 'dead' || b.phase === 'down' && b.hp <= 0)));
    if (this.encBodies.length) return;
    this.encWave++;
    if (this.encWave < e.waves.length) {
      this.spawnWave();
      return;
    }
    this.emit({ type: 'combat:clear', index: this.encActive });
    this.encActive = -1;
    this.encIndex++;
    this.bounds = [0, this.floor.length];
    this.goT = 90;
  }

  private spawnWave() {
    const e = this.floor.encounters[this.encActive];
    this.encBodies = e.waves[this.encWave].map((s) => this.spawn(s));
  }

  private camera() {
    const p = this.player;
    const [b0, b1] = this.bounds;
    const target = p.x - SCREEN_W / 2 + p.dir * 90;
    let cx = this.camX + (target - this.camX) * 0.14;
    cx = Math.max(b0, Math.min(b1 - SCREEN_W, cx));
    cx = Math.max(0, Math.min(this.floor.length - SCREEN_W, cx));
    this.camX = cx;
    // 싸움 중에는 화면 밖으로 못 나감
    if (this.encActive >= 0) p.x = Math.max(cx + 30, Math.min(cx + SCREEN_W - 30, p.x));
  }

  /** 보스 체력 막대용 */
  boss(): { label: string; hp: number; hpMax: number } | null {
    const b = this.bodies.find((x) => x.alive && x.boss);
    return b ? { label: b.label ?? b.kind, hp: b.hp, hpMax: b.hpMax } : null;
  }
}
