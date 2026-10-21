// 시연판용 대역 엔진. 「게임 전투와 조작」의 진짜 엔진이 오기 전에, 같은 계약(engine/contract.ts)으로 층 모듈을 돌려 본다.
// 플레이어·적은 회색 상자, 전투는 최소(근접 한 가지). 층 생성·규칙·정비 구역·승강기를 걸어서 확인하는 것이 목적이다.
import type { Body, FloorPlan, GameEvent, Hit, HitResult, PlayerState, PropSpec, SpawnSpec, StageApi, StageModule, WBox, WorldView } from '../../engine/contract';
import type { StagePlan } from '../plan';

export const DT = 1 / 30;
export interface Keys {
  x: number;
  y: number;
  run: boolean;
  jump: boolean;
  attack: boolean;
  interact: boolean;
  crouch: boolean;
}

interface Enemy {
  id: number;
  kind: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  max: number;
  boss: boolean;
  elite: boolean;
  cd: number;
  wind: number;
  flash: number;
  alive: boolean;
  enc: number;
}

const ENEMY_LABEL: Record<string, string> = {
  lurker: '해롭지 않아 보이는 것',
  shooter: '창구 직원',
  hum: '발소리',
  shade: '얼룩',
  crawler: '다리 많은 새끼',
  charger: '돌진하는 것',
  resident: '사는 척하는 주민',
  warmth: '체온을 재는 것',
  toucher: '만지는 것',
  predator: '포식자',
  thief: '보급품 도둑',
  nothuman: '더는 사람이 아닌 것',
  guard: '낡은 제복의 경비원',
  conductor: '낡은 제복의 차장',
  noise: '소리와 냄새',
  shadow: '그림자',
  legs: '다리 많은 것',
  shape: '불가능한 입체 도형',
  elder: '405호 노부부',
  family208: '208호 가족',
  risenhouse: '일어난 집',
};

export class DemoEngine {
  plan!: StagePlan;
  props: PropSpec[] = [];
  enemies: Enemy[] = [];
  p = { x: 200, y: 590, z: 0, vz: 0, dir: 1 as 1 | -1, hp: 160, hpMax: 160, running: false, crouching: false, airborne: false, atk: 0, hurtT: 0, inv: 0 };
  tick = 0;
  /** 화면 논리 폭 (세로 폰은 좁게) */
  viewW = 1280;
  noise = 0;
  light = 1;
  bounds: [number, number] = [0, 99999];
  encDone = new Set<number>();
  encActive = -1;
  encWave = 0;
  says: { text: string; t: number }[] = [];
  shakeT = 0;
  shakeP = 0;
  ended: 'return' | 'withdraw' | 'evac' | null = null;
  notes: Record<string, unknown> = {};
  floors = 0;
  kills = 0;
  private pendingFinish: 'next' | 'withdraw' | null = null;
  private nextId = 1;
  private rand: () => number;
  events: GameEvent[] = [];
  onFloor?: (plan: StagePlan) => void;
  onEnd?: (how: 'return' | 'evac') => void;
  constructor(
    public stage: StageModule,
    public run: { seed: number; agent: string },
  ) {
    let a = run.seed >>> 0;
    this.rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  start() {
    this.load(this.stage.firstFloor(this.run) as StagePlan);
  }
  private load(plan: StagePlan) {
    this.plan = plan;
    this.props = (plan.props ?? []).map((p) => ({ ...p }));
    this.enemies = [];
    this.encDone.clear();
    this.encActive = -1;
    this.bounds = [0, plan.length];
    const lane = plan.lane ?? [500, 680];
    this.p.x = plan.startX;
    this.p.y = Math.max(lane[0], Math.min(lane[1], (lane[0] + lane[1]) / 2));
    this.p.z = 0;
    this.p.vz = 0;
    this.p.crouching = false;
    this.light = 1;
    this.noise = 0;
    this.says = [];
    this.floors++;
    this.emit({ type: 'enter:floor', floor: plan });
    this.onFloor?.(plan);
  }

  // ── WorldView
  get world(): WorldView {
    const self = this;
    return {
      get tick() {
        return self.tick;
      },
      rand: () => self.rand(),
      get player() {
        return self.playerBody();
      },
      bodies: [],
      get floor() {
        return self.plan as FloorPlan;
      },
      get lane() {
        return (self.plan.lane ?? [500, 680]) as [number, number];
      },
      get bounds() {
        return self.bounds;
      },
      get noise() {
        return self.noise;
      },
      set noise(v: number) {
        self.noise = v;
      },
      get light() {
        return self.light;
      },
      set light(v: number) {
        self.light = v;
      },
      add: () => {},
      emit: (e) => self.emit(e),
      fx: () => {},
      shake: (t, pw = 4) => {
        self.shakeT = t;
        self.shakeP = pw;
      },
      say: (text, sec = 3) => self.say(text, sec),
    };
  }
  private playerBody(): Body & PlayerState {
    const p = this.p;
    return {
      id: 0,
      team: 'player',
      kind: this.run.agent,
      x: p.x,
      y: p.y,
      z: p.z,
      dir: p.dir,
      hp: p.hp,
      hpMax: p.hpMax,
      alive: p.hp > 0,
      stop: 0,
      frame: () => ({ hit: [], hurt: [] }),
      step: () => {},
      applyHit: (_h: Hit): HitResult => ({ kind: 'hit' }),
      ammo: 0,
      mag: 0,
      gauge: 0,
      guardMeter: 0,
      state: p.crouching ? 'crouch' : p.airborne ? 'air' : p.running ? 'run' : 'idle',
      airborne: p.airborne,
      running: p.running,
      crouching: p.crouching,
      guarding: false,
      combo: 0,
    };
  }
  get api(): StageApi {
    const self = this;
    return {
      get world() {
        return self.world;
      },
      spawn: (s) => self.spawn(s, -1),
      setProp: (id, patch) => {
        const i = self.props.findIndex((p) => p.id === id);
        if (patch === null) {
          if (i >= 0) self.props.splice(i, 1);
        } else if (i >= 0) Object.assign(self.props[i], patch);
        else if (patch.kind) self.props.push({ id, kind: patch.kind, x: patch.x ?? 0, y: patch.y ?? 600, w: patch.w ?? 40, h: patch.h ?? 40, label: patch.label, solid: patch.solid });
      },
      hurtPlayer: (d, stagger) => self.hurt(d, stagger),
      heal: (n) => {
        self.p.hp = Math.min(self.p.hpMax, self.p.hp + n);
        self.emit({ type: 'heal', x: self.p.x });
      },
      note: (k, v) => {
        self.notes[k] = v;
      },
      finish: (how) => {
        self.pendingFinish = how;
      },
      movePlayer: (x, y) => {
        self.p.x = x;
        if (y !== undefined) self.p.y = y;
      },
    };
  }
  emit(e: GameEvent) {
    this.events.push(e);
    if (this.events.length > 50) this.events.shift();
    this.stage.onEvent?.(this.api, this.plan, e);
  }
  say(text: string, sec: number) {
    this.says = this.says.filter((s) => s.text !== text);
    this.says.push({ text, t: sec });
    if (this.says.length > 3) this.says.shift();
  }
  private spawn(s: SpawnSpec, enc: number) {
    const boss = !!s.boss;
    const max = boss ? (s.kind === 'predator' ? 500 : 380) : s.kind === 'toucher' || s.kind === 'warmth' ? 9999 : (s.elite ? 1.6 : 1) * (s.kind === 'charger' ? 90 : 60);
    this.enemies.push({ id: this.nextId++, kind: s.kind, x: s.x, y: s.y, z: 0, hp: max, max, boss, elite: !!s.elite, cd: 1, wind: 0, flash: 0, alive: true, enc });
    this.emit({ type: 'enemySpawn', x: s.x, kind: s.kind });
  }
  private hurt(d: number, stagger?: boolean) {
    if (this.p.inv > 0) return;
    this.p.hp -= d;
    this.p.hurtT = stagger ? 0.4 : 0.15;
    this.p.inv = 0.5;
    this.emit({ type: 'hurt', x: this.p.x, dmg: d, hp: this.p.hp });
    if (this.p.hp <= 0 && !this.ended) {
      this.ended = 'evac';
      this.emit({ type: 'run:end', how: 'evac' });
      this.onEnd?.('evac');
    }
  }

  nearestProp(): PropSpec | null {
    let best: PropSpec | null = null,
      bd = 61;
    for (const pr of this.props) {
      const d = Math.abs(pr.x - this.p.x);
      if (d < bd && pr.kind !== 'prop' && pr.kind !== 'shutter') (bd = d), (best = pr);
    }
    return best;
  }

  step(k: Keys) {
    if (this.ended) return;
    this.tick++;
    const p = this.p;
    const lane = this.plan.lane ?? [500, 680];
    p.inv -= DT;
    p.hurtT -= DT;
    for (const s of this.says) s.t -= DT;
    this.says = this.says.filter((s) => s.t > 0);
    this.shakeT = Math.max(0, this.shakeT - 1);
    if (k.crouch !== p.crouching && !p.airborne) p.crouching = k.crouch;
    // 이동
    const sp = p.hurtT > 0 ? 0 : p.crouching ? 130 : k.run ? 430 : 260;
    p.running = k.run && k.x !== 0 && !p.crouching;
    const ox = p.x;
    if (p.atk <= 0 || p.airborne) {
      p.x += k.x * sp * DT;
      p.y += k.y * (p.crouching ? 80 : 170) * DT;
    }
    if (k.x) p.dir = k.x > 0 ? 1 : -1;
    p.y = Math.max(lane[0], Math.min(lane[1], p.y));
    // 단단한 소품 (닫힌 셔터)
    for (const pr of this.props)
      if (pr.solid) {
        const left = pr.x - pr.w / 2 - 16,
          right = pr.x + pr.w / 2 + 16;
        if (ox <= left && p.x > left) p.x = left;
        if (ox >= right && p.x < right) p.x = right;
      }
    p.x = Math.max(this.bounds[0] + 30, Math.min(this.bounds[1] - 30, p.x));
    // 점프
    if (k.jump && !p.airborne && !p.crouching) {
      p.vz = 640;
      p.airborne = true;
      this.emit({ type: 'jump', x: p.x });
    }
    if (p.airborne) {
      p.vz -= 2000 * DT;
      p.z += p.vz * DT;
      if (p.z <= 0) {
        p.z = 0;
        p.airborne = false;
        this.emit({ type: 'land', x: p.x });
      }
    }
    if (k.x && !p.airborne && this.tick % 10 === 0) this.emit({ type: 'step', x: p.x });
    // 근접 (최소)
    p.atk -= DT;
    if (k.attack && p.atk <= 0) {
      p.atk = 0.32;
      let hit = false;
      const box: WBox = { x0: p.dir === 1 ? p.x : p.x - 100, x1: p.dir === 1 ? p.x + 100 : p.x, z0: 0, z1: 140, y: p.y };
      for (const e of this.enemies)
        if (e.alive && e.x > box.x0 - 30 && e.x < box.x1 + 30 && Math.abs(e.y - p.y) < 40) {
          hit = true;
          const immortal = e.kind === 'toucher' || e.kind === 'warmth';
          if (!immortal) e.hp -= 34;
          e.flash = 0.15;
          e.x += p.dir * 30;
          this.emit({ type: 'hit', strength: 2, x: e.x, y: e.y, z: 60, dmg: 34, react: 'flinch', target: e.kind, combo: 1 });
          if (e.hp <= 0) {
            e.alive = false;
            this.kills++;
            this.emit({ type: 'enemyDie', x: e.x, kind: e.kind });
          }
        }
      if (!hit) this.emit({ type: 'whiff', x: p.x });
    }
    // 적 (최소 행동: 다가와서 예비 동작 뒤 접촉 피해)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.flash -= DT;
      const dx = p.x - e.x,
        dy = p.y - e.y;
      const speed = e.kind === 'predator' ? 70 : e.boss ? 120 : e.kind === 'toucher' ? 60 : e.kind === 'warmth' ? 110 : e.kind === 'charger' ? 200 : 110;
      if (Math.abs(dx) > 50) e.x += Math.sign(dx) * speed * DT;
      if (Math.abs(dy) > 6) e.y += Math.sign(dy) * 70 * DT;
      e.cd -= DT;
      if (Math.abs(dx) < 70 && Math.abs(dy) < 30) {
        if (e.wind <= 0 && e.cd <= 0) e.wind = 0.45;
      }
      if (e.wind > 0) {
        e.wind -= DT;
        if (e.wind <= 0) {
          e.cd = 1.1;
          if (Math.abs(p.x - e.x) < 80 && Math.abs(p.y - e.y) < 34 && p.z < 60) this.hurt(e.boss ? 16 : e.elite ? 12 : 8, e.boss);
        }
      }
      // 만지는 것들·체온을 재는 것은 조금 닿다가 사라진다
      if ((e.kind === 'toucher' || e.kind === 'warmth') && this.tick % 300 === 0) e.alive = false;
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.flash > -1);
    // 싸움 구간
    const encs = this.plan.encounters;
    if (this.encActive < 0) {
      encs.forEach((en, i) => {
        if (this.encActive < 0 && !this.encDone.has(i) && p.x > en.triggerX) {
          this.encActive = i;
          this.encWave = 0;
          this.bounds = [en.lockFrom, en.lockTo];
          for (const s of en.waves[0] ?? []) this.spawn(s, i);
          this.emit({ type: en.waves[0]?.some((s) => s.boss) ? 'combat:boss' : 'combat:start', index: i });
        }
      });
    } else {
      const i = this.encActive;
      if (!this.enemies.some((e) => e.alive && e.enc === i)) {
        this.encWave++;
        const en = encs[i];
        if (this.encWave < en.waves.length) for (const s of en.waves[this.encWave]) this.spawn(s, i);
        else {
          this.encDone.add(i);
          this.encActive = -1;
          this.bounds = [0, this.plan.length];
          this.emit({ type: 'combat:clear', index: i });
          this.say('GO →', 1.5);
        }
      }
    }
    // 상호작용
    if (k.interact) {
      const pr = this.nearestProp();
      if (pr) this.stage.onInteract?.(this.api, this.plan, pr);
    }
    this.stage.tick?.(this.api, this.plan);
    if (this.pendingFinish) {
      const how = this.pendingFinish;
      this.pendingFinish = null;
      const next = this.stage.nextFloor(this.run, this.plan, how);
      if (next) this.load(next as StagePlan);
      else if (!this.ended) {
        this.ended = 'return';
        this.emit({ type: 'run:end', how: 'return' });
        this.onEnd?.('return');
      }
    }
  }

  // ── 그리기
  draw(ctx: CanvasRenderingContext2D) {
    const p = this.p;
    const vw = this.viewW;
    const camX = Math.max(this.bounds[0], Math.min(Math.max(this.bounds[0], this.bounds[1] - vw), p.x - vw * 0.42));
    ctx.save();
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, vw, 720);
    const sx = this.shakeT ? (this.rand() - 0.5) * this.shakeP * 2 : 0;
    ctx.translate(-camX + sx, 0);
    this.plan.drawBackground?.(ctx, camX);
    // 소품
    const things: { y: number; draw: () => void }[] = [];
    const near = this.nearestProp();
    for (const pr of this.props)
      things.push({
        y: pr.y - 1,
        draw: () => {
          const top = pr.y - pr.h - (pr.kind === 'hatch' ? 260 : 0);
          ctx.fillStyle = propColor(pr.kind);
          ctx.globalAlpha = pr.kind === 'shutter' && !pr.solid ? 0.25 : 1;
          ctx.fillRect(pr.x - pr.w / 2, top, pr.w, pr.h);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = pr === near ? '#fff' : 'rgba(0,0,0,0.6)';
          ctx.lineWidth = pr === near ? 3 : 1;
          ctx.strokeRect(pr.x - pr.w / 2, top, pr.w, pr.h);
          if (pr.label) {
            ctx.font = pr === near ? 'bold 15px sans-serif' : '13px sans-serif';
            ctx.fillStyle = pr === near ? '#fff' : 'rgba(255,255,255,0.75)';
            ctx.textAlign = 'center';
            ctx.fillText(pr.label, pr.x, top - 6);
            ctx.textAlign = 'left';
          }
        },
      });
    for (const e of this.enemies)
      things.push({
        y: e.y,
        draw: () => {
          if (!e.alive) return;
          const hidden = this.light < 0.35 && Math.abs(e.x - p.x) > 140;
          const invisible = e.kind === 'hum' || e.kind === 'noise';
          const w = e.boss ? 110 : e.kind === 'crawler' || e.kind === 'shade' ? 90 : 56,
            h = e.boss ? 190 : e.kind === 'crawler' ? 60 : e.kind === 'shade' ? 30 : 130;
          if (hidden || (invisible && this.tick % 40 > 6)) {
            // 발소리·냄새 파문으로만
            ctx.strokeStyle = 'rgba(200,220,255,0.35)';
            ctx.beginPath();
            ctx.ellipse(e.x, e.y, 30 + (this.tick % 30) * 2, 8 + (this.tick % 30) * 0.5, 0, 0, Math.PI * 2);
            ctx.stroke();
            return;
          }
          ctx.fillStyle = e.flash > 0 ? '#fff' : e.boss ? '#a3263a' : e.elite ? '#c46a2a' : e.kind === 'toucher' || e.kind === 'warmth' ? '#6a6a7a' : '#8a3b3b';
          ctx.fillRect(e.x - w / 2, e.y - h - e.z, w, h);
          if (e.wind > 0) {
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = 3;
            ctx.strokeRect(e.x - w / 2 - 4, e.y - h - 4, w + 8, h + 8);
          }
          ctx.font = '13px sans-serif';
          ctx.fillStyle = '#ffd0d0';
          ctx.textAlign = 'center';
          ctx.fillText(`${ENEMY_LABEL[e.kind] ?? e.kind}${e.boss ? ' (수호자 자리)' : ''}`, e.x, e.y - h - 10);
          if (e.max < 9000) {
            ctx.fillStyle = '#300';
            ctx.fillRect(e.x - 30, e.y - h - 30, 60, 5);
            ctx.fillStyle = '#e44';
            ctx.fillRect(e.x - 30, e.y - h - 30, (60 * Math.max(0, e.hp)) / e.max, 5);
          }
          ctx.textAlign = 'left';
        },
      });
    things.push({
      y: p.y,
      draw: () => {
        const h = p.crouching ? 70 : 130;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.inv > 0 && this.tick % 4 < 2 ? '#fff' : this.run.agent === 'eileen' ? '#3c8ad9' : '#d94b3c';
        ctx.fillRect(p.x - 22, p.y - h - p.z, 44, h);
        ctx.fillStyle = '#ffe';
        ctx.fillRect(p.dir === 1 ? p.x + 8 : p.x - 20, p.y - h - p.z + 14, 12, 8);
        if (p.atk > 0.15) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(p.dir === 1 ? p.x + 22 : p.x - 110, p.y - 100 - p.z, 88, 30);
        }
      },
    });
    things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
    this.plan.drawForeground?.(ctx, camX, this.world);
    // 잠긴 구간 표시
    if (this.encActive >= 0) {
      ctx.fillStyle = 'rgba(255,60,60,0.5)';
      ctx.fillRect(this.bounds[0], 100, 6, 620);
      ctx.fillRect(this.bounds[1] - 6, 100, 6, 620);
    }
    ctx.restore();
    return camX;
  }
}

function propColor(kind: string): string {
  return (
    {
      elevator: '#8d8f86',
      panel: '#e0b84a',
      mirror: '#9fc7d8',
      checklist: '#e8e2c8',
      door: '#6b4a2b',
      shutter: '#555c66',
      switch: '#c9a8ff',
      hatch: '#c7883a',
      servicedoor: '#c7883a',
      sign: '#f1d24a',
      goalwall: '#7ad0ff',
      mark: '#7affc4',
      table: '#a2603a',
      item: '#5fd06b',
      pack: '#5fd06b',
      belonging: '#e0a0ff',
      symbol: '#cccccc',
      chasedoor: '#7a2f2f',
      passenger: '#bfb59a',
      npc: '#a8a08a',
      choice: '#2e6b8f',
      b12: '#ff3030',
      up: '#c7883a',
      down: '#c7883a',
      ladder_up: '#9a7a4a',
      ladder_down: '#9a7a4a',
      left: '#6a5a3a',
      right: '#6a5a3a',
      rope: '#f0d090',
      bed: '#6a7a5a',
      intercom: '#e0b84a',
      memo: '#e8e2c8',
      map: '#e8e2c8',
      gear: '#8ab',
      merchant: '#b090e0',
      fall: '#000000',
      greet: '#e0b84a',
      close: '#e05a4a',
      button: '#ffd27a',
      getoff: '#8d8f86',
      van: '#3a4a6a',
    } as Record<string, string>
  )[kind] ?? '#777';
}
