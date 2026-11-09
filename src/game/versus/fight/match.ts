// 대전 경기 화면 (2026-11-08 새로 짬): 필드 게임(월드·필드 인물 엔진) 없이 대전만 돈다.
// 그림판·브라운관·창 맞춤은 필드와 같은 화면 틀(ui/stage.ts)을 쓰고, 판 흐름(ROUND → GO → K.O. → WINNER → 다음 판)·
// 카메라(두 사람 가운데를 따라감)·밀어내기·화면 밖 X·태그매치 들어오기·서바이벌 웨이브를 여기서 한다.
import { mountStage, type Stage as Screen } from '../../action/ui/stage';
import { view } from '../../action/engine/view';
import { charArt, charRoster, loadChar } from '../../action/art/charPacks';
import { versus, roundEnd, fighterOf, KO_SEC, OVER_SEC, INTRO_SEC, CLOCK_SEC, TRANS, VS_RAISE, type Side } from '../../action/engine/versus';
import { surv, waveOf, SURV } from '../../action/engine/survival';
import { vsEventSound } from '../sound';
import { dotText } from '../../action/ui/pixelHud';
import type { SfxId } from '../../action/audio';
import { Fighter, emptyCtl, type Btn, type Ctl } from './fighter';
import { Brain, PERSONAS } from './ai';
import { stepProj, carryPt } from './skillfx';
import { drawVfx, drawSprite, vfxOf, vfxDur } from './art';
import { drawVersusBars, drawBench, setVsSay } from './hud';
import type { Stage, Fx, Proj } from './stage';
import { K, LINE, DT, HP, WALL, dotSample, RUSH_SUPER } from './rules';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 그림판 세로에 보이는 월드 높이 (960 / 686 = 도트 1.4배, 11-08 사용자) */
const VIEW_H = 686;
const SCREEN_H = 720;
/** 두 사람 사이 최대 (화면 폭 − 이만큼) */
const KEEP = 160;
/** 몸끼리 최소 간격 = 둘의 반폭 합 */

const KEYS: Record<string, Btn> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', Space: 'up', KeyA: 'light', KeyS: 'heavy', KeyD: 'charge', KeyQ: 'shoot', KeyW: 'skill', KeyZ: 'sit', KeyX: 'crouch' };

export interface FightOpts {
  /** 알림 소리 (ROUND·K.O. 등) */
  say?: (id: SfxId) => void;
  /** 소리 사건이 녹음 소리로 안 바뀌었을 때 (총소리 등) */
  sfx?: (e: { type: string; [k: string]: unknown }) => void;
  /** 시험: 1P 도 AI */
  auto?: boolean;
}

export class Match {
  readonly screen: Screen;
  readonly st: Stage;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private cam = -1;
  private shakeV = 0;
  private superT = 0;
  private superName: { text: string; t: number; by: Fighter } | null = null;
  private darkT = 0;
  /** 돌진 난무 필살기: 배경 완전 암전 (초) · 화면 하얀 번쩍 (초) */
  private blackT = 0;
  /** 배경만 하얗게 (캐릭터는 그대로 보임, 킹오파 큰 한 방의 흰 화면) */
  private bgWhiteT = 0;
  private whiteT = 0;
  private whiteT0 = 0.3;
  private brains = new Map<Fighter, Brain>();
  private keys = new Set<Btn>();
  private edges = new Set<Btn>();
  private ups = new Set<Btn>();
  private koReact: { win: Fighter | null; lose: Fighter | null } | null = null;
  private idN = 1;
  private dead = false;
  private attackers = new Set<Fighter>();
  /** 시험: 1P 도 AI */
  auto = false;
  /** 시험 기록: 맞음마다 (누가·무엇으로·피해) */
  log: { t: number; by: string; to: string; kind: string; clip?: string; id: number; dmg: number; guard: boolean }[] = [];
  /** 시험: 기록 켜기 */
  logOn = false;
  /** 시험: 멈춤 (그리기만) */
  paused = false;
  /** 시험: 맞는 칸(초록)·공격 칸(빨강)·총구(노랑) 표시 */
  debug = false;

  constructor(readonly box: HTMLElement, readonly opts: FightOpts = {}) {
    view.clear = true;
    this.auto = !!opts.auto;
    this.screen = mountStage(box);
    this.screen.root.classList.add('goei-engine');
    this.screen.setCrt('screen');
    const self = this;
    this.st = {
      t: 0, L: view.vsLen, fighters: [], fx: [], proj: [], timers: [], viewX0: 0, viewW: 914,
      shake: (v) => { self.shakeV = Math.max(self.shakeV, v); },
      bgWhite: (sec) => { self.bgWhiteT = Math.max(self.bgWhiteT, sec); },
      whiteFlash: (sec) => { self.whiteT = Math.max(self.whiteT, sec); self.whiteT0 = Math.max(0.05, sec); },
      sfx: (e) => { if (!vsEventSound(e as never)) opts.sfx?.(e); },
      superFlash: (by, name) => self.superFlash(by, name),
      nextId: () => self.idN++,
      log: (e) => { if (self.logOn) self.log.push({ t: self.st.t, ...e }); },
    };
    setVsSay(opts.say ?? null);
    addEventListener('keydown', this.kd);
    addEventListener('keyup', this.ku);
    addEventListener('blur', this.blur);
  }

  // ───────── 입력 ─────────
  private kd = (e: KeyboardEvent) => {
    const b = KEYS[e.code];
    // 기술 연습은 판이 끝나지 않으니 Esc 로 고르기 창으로
    if (e.code === 'Escape' && versus.mode === 'practice' && !versus.hold && !versus.over) { e.preventDefault(); versus.onMatchEnd?.(0); return; }
    // 기술 연습: R 로 둘 다 가운데 처음 자리로
    if (e.code === 'KeyR' && versus.mode === 'practice' && !versus.hold && !e.repeat) { e.preventDefault(); this.practiceReset(); return; }
    if (!b) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    if (e.repeat || this.keys.has(b)) return;
    this.keys.add(b); this.edges.add(b);
  };
  private ku = (e: KeyboardEvent) => { const b = KEYS[e.code]; if (b && this.keys.delete(b)) this.ups.add(b); };
  private blur = () => { this.keys.clear(); this.edges.clear(); };
  private padCtl(): Ctl {
    const c: Ctl = { held: new Set(this.keys), pressed: new Set(this.edges), released: new Set(this.ups) };
    for (const b of c.pressed) c.held.add(b);
    this.edges.clear(); this.ups.clear();
    return c;
  }

  // ───────── 경기 ─────────
  /** 새 경기 첫 판 (versus 상태는 newMatch 로 차려 둔 뒤) */
  begin(): void {
    this.st.L = view.vsLen;
    this.cam = -1;
    this.newRound(true);
    if (!this.raf) this.loop();
  }
  private make(name: string, side: 0 | 1, x: number, face: 1 | -1): Fighter | null {
    const art = charArt(name);
    if (!art) return null;
    const f = new Fighter(art, side, side, x, face, this.st);
    return f;
  }
  private brainFor(f: Fighter, n: number, react = 0.2): Brain {
    const b = new Brain(f, PERSONAS[n % PERSONAS.length], react);
    this.brains.set(f, b);
    return b;
  }
  /** 판 차리기. 1:1 = 둘 다 새로, 태그매치 = 진 쪽만 다음 캐릭터, 서바이벌 = 나 혼자 */
  private newRound(first: boolean): void {
    const st = this.st, L = st.L;
    st.fx = []; st.proj = []; st.timers = [];
    this.superT = 0; this.superName = null; this.darkT = 0; this.blackT = 0; this.whiteT = 0; this.bgWhiteT = 0;
    const keep = st.fighters.slice();
    st.fighters = [];
    this.brains.clear();
    const hpOf = (side: 0 | 1) => { const c = versus.carry[side]; return c != null ? Math.max(1, Math.round(HP * c)) : HP; };
    const p1 = this.make(fighterOf(0), 0, L / 2 - 260, 1) ?? keep[0];
    if (p1) { p1.reset(L / 2 - 260, 1, hpOf(0)); st.fighters.push(p1); }
    if (this.auto && p1) this.brainFor(p1, 1);
    if (versus.mode !== 'survival') {
      const p2 = this.make(fighterOf(1), 1, L / 2 + 260, -1);
      if (p2) {
        p2.reset(L / 2 + 260, -1, hpOf(1)); st.fighters.push(p2);
        // 기술 연습: 상대는 두뇌 없이 가만히 선 더미
        p2.noKo = versus.mode === 'practice';
        if (versus.mode !== 'practice') this.brainFor(p2, versus.round + versus.cur[1]);
      }
    }
    versus.intro = INTRO_SEC;
    versus.clock = CLOCK_SEC;
    void first;
  }
  private superFlash(by: Fighter, name: string): void {
    this.superT = 0.6;
    this.darkT = 1.6;
    this.superName = { text: name, t: 0.9, by };
    for (const f of this.st.fighters) f.hold = Math.max(f.hold, 0.6);
    if (RUSH_SUPER.has(by.name)) {
      // 킹오파식 시작 (11-09 5판, 롬에서 잰 순서): 배경만 흰색 4장 → 검은 배경 + 뒤 층진 빛 8장 줄어듦 → 가슴 앞 빛덩이 8장 → 빛살 8장. 1장 = 1게임장
      this.blackT = 0.7;   // 킹오파: 빛살이 사라지면 배경이 바로 돌아옴(약 40게임장)
      this.bgWhiteT = 4 / 60;
      const y = LINE - by.z - 125 * K;
      this.st.fx.push({ k: 'sheet', name: 'dot-hand-orb', x: by.x + by.face * 12 * K, y, s: 2 * K, anchor: 'center', under: true, live: true, t: 9, t0: 9, el: 0 });
      this.st.fx.push({ k: 'sheet', name: 'dot-hand-rise', x: by.x + by.face * 24 * K, y, s: 2 * K, anchor: 'center', live: true, t: 9, t0: 9, el: 0 });
    } else if (dotSample(by)) this.st.fx.push({ k: 'sheet', name: 'dot-burst', x: by.x, y: LINE - by.z - 120 * K, s: 2 * K, anchor: 'center', t: 9, t0: 9, el: 0 });
    else {
    this.st.fx.push({ k: 'ring', x: by.x, y: LINE - by.z - 120 * K, r: 260 * K, t: 0.6, t0: 0.6, c: by.color, w: 8, sy: 1 });
    this.st.fx.push({ k: 'ring', x: by.x, y: LINE - by.z - 120 * K, r: 160 * K, t: 0.45, t0: 0.45, c: '#ffffff', w: 5, sy: 1 });
    }
    this.opts.say?.('superStart');
  }

  /** 한 틱 (60Hz) */
  step(): void {
    const st = this.st;
    if (versus.hold) return;
    if (versus.trans) return this.transTick();
    st.t += DT;
    const fs = st.fighters;
    if (versus.intro > 0 || versus.over) {
      if (versus.intro > 0) { versus.intro = Math.max(0, versus.intro - DT); for (const f of fs) { f.ctl = emptyCtl(); f.tick(); } }
      if (versus.over && (versus.over.t -= DT) <= 0) { const side = versus.over.side; versus.over = null; versus.onMatchEnd?.(side); }
      this.updateFx();
      return;
    }
    // 손: 1P 키보드, 나머지 두뇌. K.O. 뒤에는 양쪽 다 손을 뗀다
    const pad = this.padCtl();
    this.attackers = new Set(fs.filter((f) => f.team === 1 && (f.state === 'atk' || f.state === 'charge')));
    for (const f of fs) {
      const b = this.brains.get(f);
      if (b) b.off = !!versus.ko;
      f.ctl = versus.ko ? emptyCtl() : b ? b.think() : f.side === 0 ? pad : emptyCtl();
    }
    for (const f of fs) f.tick();
    if (this.superT > 0) { this.superT -= DT; if (this.superT > 0) { this.updateFx(true); return; } }
    // 늦게 도는 일
    for (const tm of st.timers.slice()) { tm.t -= DT; }
    const due = st.timers.filter((tm) => tm.t <= 0);
    st.timers = st.timers.filter((tm) => tm.t > 0);
    for (const tm of due) tm.fn();
    st.proj = st.proj.filter((p) => !stepProj(st, p));
    this.updateFx();
    this.pushApart();
    if (versus.mode !== 'survival') this.keepOnScreen();
    if (versus.mode === 'survival') this.survival();
    if (versus.mode === 'practice') return this.practice();
    this.judge();
  }

  private pushApart(): void {
    const fs = this.st.fighters.filter((f) => f.alive && f.z < 20 && f.state !== 'down' && f.state !== 'ko' && f.deadT < 0);
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j];
      if (a.team === b.team && versus.mode !== 'survival') continue;
      const MIN = a.half() + b.half(), d = b.x - a.x, ad = Math.abs(d);
      if (ad >= MIN) continue;
      const s = d === 0 ? (i % 2 ? 1 : -1) : Math.sign(d), half = (MIN - ad) / 2;
      a.x -= s * half; b.x += s * half;
    }
    const L = this.st.L;
    for (const f of fs) f.x = Math.max(WALL, Math.min(L - WALL, f.x));
  }
  /** 두 사람이 늘 한 화면 안에 (11-08 사용자 「화면을 벗어나면 안되지」) */
  private keepOnScreen(): void {
    const [p, foe] = this.st.fighters;
    if (!p || !foe) return;
    const maxD = this.st.viewW - KEEP, d = Math.abs(foe.x - p.x);
    if (d <= maxD) return;
    const ex = d - maxD, s = Math.sign(foe.x - p.x) || 1;
    const outF = s * foe.vx, outP = -s * p.vx;
    if (outF >= outP) foe.x -= s * ex; else p.x += s * ex;
  }

  /** 기술 연습: 판 끝 없음. 내 필살 게이지는 늘 가득, 더미는 1초 동안 안 맞으면 체력이 다시 찬다 */
  private practice(): void {
    const [p, d] = this.st.fighters;
    versus.clock = CLOCK_SEC;
    if (p && !p.inSuper) p.gauge = 100;
    if (d && this.st.t - d.chainT > 1 && (d.state === 'idle' || d.state === 'guard')) { d.hp = d.hpMax; if (p) p.combo = 0; }
    if (d) d.gauge = 0;
  }

  private practiceReset(): void {
    const st = this.st, L = st.L, [p, d] = st.fighters;
    st.fx = []; st.proj = []; st.timers = [];
    p?.reset(L / 2 - 260, 1, HP);
    d?.reset(L / 2 + 260, -1, HP);
    this.cam = -1;
  }

  /** 판 끝 판정 (K.O. · 시간 끝) */
  private judge(): void {
    const fs = this.st.fighters, p = fs[0];
    if (!p) return;
    const foes = fs.filter((f) => f.team === 1);
    const foeDown = versus.mode !== 'survival' && foes.length > 0 && !foes.some((f) => f.hp > 0);
    if (!versus.ko && versus.mode !== 'survival') versus.clock = Math.max(0, versus.clock - DT);
    const timeUp = !versus.ko && versus.mode !== 'survival' && versus.clock <= 0;
    if (!versus.ko && (foeDown || p.hp <= 0 || timeUp)) {
      const foe = foes[0];
      const r = (b?: Fighter) => (b ? Math.max(0, b.hp / b.hpMax) : 0);
      const rp = r(p), rf = r(foe);
      const side: Side = timeUp && p.hp > 0 && !foeDown ? (rp >= rf ? 0 : 1) : p.hp > 0 && foeDown ? 0 : 1;
      const win = side === 0 ? rp : rf;
      const kind = timeUp && p.hp > 0 && !foeDown ? 'time' : win >= 0.999 ? 'perfect' : 'ko';
      versus.ko = { side, t: KO_SEC, kind, next: roundEnd(side, [rp, rf]) };
      this.koReact = { win: side === 0 ? p : foe ?? null, lose: side === 0 ? foe ?? null : p };
      for (const f of [p, foe]) if (f) f.flashT = 0;
    } else if (versus.ko && versus.ko.t > KO_SEC - 1.4) {
      versus.ko.t -= DT;
    } else if (versus.ko && (versus.ko.t -= DT) > 0) {
      // 판 끝 반응: 이긴 쪽 기뻐하기(35), 서 있는 진 쪽(시간 끝) 화내기(32)
      if (this.koReact?.win && this.koReact.win.hp > 0) this.koReact.win.emote('35');
      if (this.koReact?.lose && this.koReact.lose.hp > 0) this.koReact.lose.emote('32');
    } else if (versus.ko && versus.ko.t <= 0) {
      const { side, next } = versus.ko;
      versus.ko = null;
      if (next === 'over') versus.over = { side, t: OVER_SEC };
      else versus.trans = { t: 0, lose: (1 - side) as Side, placed: false };
    }
  }

  /** 판 사이 (11-08 사용자): 접힘·암전 → 새 판 → 진 쪽 다음 캐릭터가 화면 밖(태그매치는 대기 자리)에서 점프로 */
  private transTick(): void {
    const tr = versus.trans!;
    tr.t += DT;
    if (tr.t >= TRANS.fold && !tr.placed) {
      this.cam = -1;
      tr.placed = true;
      this.newRound(false);
      versus.intro = 0;
      return;
    }
    if (!tr.placed) return;
    const body = this.st.fighters[tr.lose === 0 ? 0 : 1];
    if (!body) { versus.trans = null; versus.intro = INTRO_SEC; return; }
    const home = (body as any).homeX ?? ((body as any).homeX = body.x);
    let off = tr.lose === 0 ? home - 260 : home + 260, enter = TRANS.enter, high = 150;
    if (versus.mode === 'team') {
      const sp = view.vsBg?.bench.spots[tr.lose]?.[0], L = this.st.L;
      off = sp ? sp.x : tr.lose === 0 ? 220 : L - 220;
      const d = Math.abs(home - off);
      enter = 0.5 + d / 1500; high = 150 + d * 0.1;
    }
    const e = (tr.t - (TRANS.fold + TRANS.dark + TRANS.open)) / enter, k = Math.max(0, Math.min(1, e));
    body.x = off + (home - off) * k;
    body.z = k > 0 && k < 1 ? Math.sin(k * Math.PI) * high : 0;
    const n = body.art.A['7']?.n ?? 0;
    body.force = k > 0 && k < 1 && n ? { id: '7', f: Math.min(n - 1, Math.floor(k * n)), air: true } : null;
    if (e >= 1) { body.x = home; body.z = 0; body.force = null; delete (body as any).homeX; versus.trans = null; versus.intro = INTRO_SEC; }
  }

  // ───────── 서바이벌 ─────────
  private survival(): void {
    const st = this.st, p = st.fighters[0];
    surv.bannerT = Math.max(0, surv.bannerT - DT);
    const foes = st.fighters.filter((f) => f.team === 1);
    for (const f of foes) {
      if (f.hp > 0) continue;
      if (f.deadT < 0) {
        if (f.state === 'ko' && f.z > 0) continue;
        f.deadT = 0;
        versus.kills++;
        if (f.boss && p && p.hp > 0) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * SURV.healBoss);
      }
      f.deadT += DT;
      if (f.deadT > SURV.lie) f.alpha = Math.floor((f.deadT - SURV.lie) * 10) % 2 === 0 ? 0 : 1;
      if (f.deadT > SURV.lie + SURV.blink) f.alive = false;
    }
    st.fighters = st.fighters.filter((f) => f.alive);
    if (!p || p.hp <= 0) return;
    const living = st.fighters.filter((f) => f.team === 1 && f.hp > 0);
    if (surv.wave > 0 && !surv.queue.length && !living.length && surv.restT <= 0) {
      surv.restT = SURV.rest;
      p.hp = Math.min(p.hpMax, p.hp + p.hpMax * SURV.healWave);
    }
    if (surv.restT > 0) { surv.restT -= DT; if (surv.restT <= 0) this.startWave(); return; }
    surv.spawnT -= DT;
    if (surv.spawnT > 0 || !surv.queue.length || living.length >= SURV.onScreen) return;
    const i = surv.queue.findIndex((q) => !!charArt(q.name));
    if (i < 0) return;
    const q = surv.queue.splice(i, 1)[0];
    surv.side ^= 1;
    const x = surv.side ? Math.min(st.L - 80, st.viewX0 + st.viewW + 40) : Math.max(80, st.viewX0 - 40);
    const f = this.make(q.name, 1, x, x > p.x ? -1 : 1);
    if (!f) return;
    f.boss = q.boss;
    f.hpMax = f.hp = Math.round(HP * (q.boss ? 1.2 : 0.4) * surv.mul);
    f.dmgMul = surv.mul * (q.boss ? 1 : 0.7);
    st.fighters.push(f);
    const b = this.brainFor(f, st.fighters.length, q.boss ? 0.2 : 0.32);
    // 동시 공격은 둘까지 (공격 중인 상대 수)
    b.canAttack = () => this.attackers.has(f) || this.attackers.size < SURV.attackWeight;
    surv.spawnT = SURV.spawnGap;
  }
  private startWave(): void {
    surv.wave++;
    const w = waveOf(surv.wave);
    surv.mul = 1 + SURV.tierStep * w.tier;
    const me = versus.team[0][0];
    const rows = charRoster().filter((r) => r.name !== me);
    const npcs = rows.filter((r) => r.npc).map((r) => r.name), named = rows.filter((r) => !r.npc).map((r) => r.name);
    const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
    surv.queue = [];
    if (w.boss && named.length) surv.queue.push({ name: pick(named), boss: true });
    for (let i = 0; i < w.minions && npcs.length; i++) surv.queue.push({ name: pick(npcs), boss: false });
    for (const q of surv.queue) void loadChar(q.name);
    surv.bannerT = 1.6;
    surv.spawnT = 0.5;
  }

  // ───────── 이펙트 ─────────
  private updateFx(frozen = false): void {
    const st = this.st;
    this.whiteT = Math.max(0, this.whiteT - DT);
    this.bgWhiteT = Math.max(0, this.bgWhiteT - DT);
    // 필살기 시작 멈춤 동안에도 도는 것 (모여드는 줄기·뒤쪽 기운)
    if (frozen) { for (const e of st.fx) if (e.live) { e.t -= DT; if (e.el != null) e.el += DT; } st.fx = st.fx.filter((e) => e.t > 0); return; }
    for (const e of st.fx) {
      e.t -= DT;
      if (e.el != null) e.el += DT;
      if (e.k === 'shell' || e.k === 'coin') { e.vy += 1800 * DT; e.x += e.vx * DT; e.y = Math.min(LINE, e.y + e.vy * DT); }
      if (e.k === 'fire') { e.x += e.vx * DT; e.y += e.vy * DT; }
      if (e.k === 'drop') { if (e.y < e.g) { e.y += e.vy * DT; e.x += e.vx * DT; e.rot += e.vr * DT; } }
    }
    st.fx = st.fx.filter((e) => e.t > 0);
    this.shakeV = Math.max(0, this.shakeV - 60 * DT);
    this.darkT = Math.max(0, this.darkT - DT);
    this.blackT = Math.max(0, this.blackT - DT);
    if (this.superName) { this.superName.t -= DT; if (this.superName.t <= 0) this.superName = null; }
  }

  // ───────── 루프·그리기 ─────────
  private loop = () => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (!this.last) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    if (typeof document !== 'undefined' && document.hidden) return;
    // K.O. 순간 슬로 모션 (11-08 사용자): 쓰러지기 시작한 판 시간 0.6초를 약 2초에 걸쳐
    const slow = versus.ko && versus.ko.t > KO_SEC - 0.6 ? 0.3 : 1;
    this.acc += dt * slow;
    let n = 0;
    while (this.acc >= DT && n++ < 30) { this.acc -= DT; if (!this.paused) this.step(); }
    this.draw();
  };

  /** 그림판 세로 배율 (판 사이 접기·펴기) */
  private fold(): number {
    const tr = versus.trans;
    if (!tr) return 1;
    const { fold, dark, open } = TRANS;
    if (tr.t < fold) return 1 - tr.t / fold;
    if (tr.t < fold + dark) return 0;
    if (tr.t < fold + dark + open) return (tr.t - fold - dark) / open;
    return 1;
  }

  draw(): void {
    const cv = this.screen.canvas, c = this.screen.ctx, st = this.st;
    const zoom = cv.height / VIEW_H, vw = cv.width / zoom, vh = cv.height / zoom;
    const L = st.L;
    // 카메라: 두 사람 가운데 (판 사이 태그매치는 무대 가운데 고정)
    const p = st.fighters[0];
    const foes = st.fighters.filter((f) => f.team === 1 && f.alive);
    const foe = p ? foes.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] : foes[0];
    const mid = versus.trans?.placed ? L / 2 : p && foe ? (p.x + foe.x) / 2 : p ? p.x : L / 2;
    const want = Math.max(0, Math.min(Math.max(0, L - vw), mid - vw / 2));
    this.cam = this.cam < 0 ? want : this.cam + (want - this.cam) * 0.12;
    st.viewX0 = this.cam; st.viewW = Math.min(vw, L);
    const cropY = SCREEN_H - vh + VS_RAISE;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const f = this.fold();
    cv.style.transform = f < 1 ? `scaleY(${Math.max(0.001, f).toFixed(3)})` : '';
    // 흔들림 (11-09, 킹오파98 화면 메모리에서 봄): 화면 전체가 위아래로 2게임장마다 번갈아 한 칸(캐릭터 점 4개쯤) 들썩임. 세기는 들썩이는 폭만 바꿈
    const shY = this.shakeV > 0 ? (Math.floor(this.st.t * 30) % 2 ? 1 : -1) * Math.min(10 * K, 4 + this.shakeV * 0.35) : 0;
    c.save();
    c.scale(zoom, zoom);
    c.translate(-Math.round(this.cam * zoom) / zoom, -cropY + shY);
    c.imageSmoothingEnabled = false;
    const bg = view.vsBg;
    if (bg) {
      c.drawImage(bg.img, Math.round(bg.x), Math.round(bg.y), Math.round(bg.w), Math.round(bg.h));
      for (const o of bg.objs) if (!o.front) c.drawImage(o.img, Math.round(o.x), Math.round(o.y), Math.round(o.w), Math.round(o.h));
      // 필살기: 배경 그림만 어둡게, 캐릭터는 그 위에 그대로
      if (this.bgWhiteT > 0) { c.fillStyle = '#fff'; c.fillRect(Math.round(bg.x), Math.round(bg.y), Math.round(bg.w), Math.round(bg.h)); }
      else if (this.blackT > 0) { c.fillStyle = `rgba(0,0,0,${Math.min(1, this.blackT * 2.5).toFixed(3)})`; c.fillRect(Math.round(bg.x), Math.round(bg.y), Math.round(bg.w), Math.round(bg.h)); }
      else if (this.darkT > 0) { c.fillStyle = `rgba(0,0,0,${Math.min(0.65, this.darkT * 0.6).toFixed(3)})`; c.fillRect(Math.round(bg.x), Math.round(bg.y), Math.round(bg.w), Math.round(bg.h)); }
    }
    drawBench(c, 0);
    this.drawFx(c, true);
    const koRed = versus.ko && versus.ko.t > KO_SEC - 0.28 ? 0.6 : 0;
    const order = st.fighters.slice().sort((a, b) => (a.state === 'atk' ? 1 : 0) - (b.state === 'atk' ? 1 : 0));
    for (const fi of order) fi.draw(c, { red: koRed });
    this.drawProj(c);
    this.drawFx(c, false);
    if (this.debug) this.drawDebug(c);
    if (bg) for (const o of bg.objs) if (o.front) c.drawImage(o.img, Math.round(o.x), Math.round(o.y), Math.round(o.w), Math.round(o.h));
    if (this.superName) {
      const by = this.superName.by, im = dotText(this.superName.text, '#ffffff', 2);
      c.save(); c.globalAlpha = Math.min(1, this.superName.t * 4);
      c.drawImage(im, Math.round(by.x - im.width / 2), Math.round(LINE - by.z - 300 * K - im.height));
      c.restore();
    }
    c.restore();
    // K.O. 순간 화면 번쩍 (배경이 있을 때만: 투명 무대는 본문을 덮지 않게)
    if (bg && versus.ko && versus.ko.t > KO_SEC - 0.12) { c.fillStyle = `rgba(255,255,255,${(0.75 * (versus.ko.t - (KO_SEC - 0.12)) / 0.12).toFixed(3)})`; c.fillRect(0, 0, cv.width, cv.height); }
    // 필살기 마무리 등 화면 전체 하얀 번쩍 (11-09 사용자: 번쩍임 제한 없음)
    if (this.whiteT > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(1, (this.whiteT / this.whiteT0) * 1.1).toFixed(3)})`; c.fillRect(0, 0, cv.width, cv.height); }
    drawVersusBars(c, p, st.fighters.filter((x) => x.team === 1));
  }

  private drawDebug(c: CanvasRenderingContext2D): void {
    const box = (b: { x0: number; x1: number; z0: number; z1: number }, col: string) => { c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(b.x0, LINE - b.z1, b.x1 - b.x0, b.z1 - b.z0); };
    for (const f of this.st.fighters) {
      box(f.hurt(), '#3f3');
      if (f.state === 'atk' && f.atk?.normal) { const h = f.hitBox(); if (h) box(h, '#f33'); }
      const m = f.muzzle(); c.fillStyle = '#ff0'; c.fillRect(m.x - 4, m.y - 4, 8, 8);
    }
    for (const p of this.st.proj) { c.strokeStyle = '#0ff'; c.strokeRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2); }
  }

  private drawProj(c: CanvasRenderingContext2D): void {
    for (const p of this.st.proj) this.drawOneProj(c, p);
  }
  private drawOneProj(c: CanvasRenderingContext2D, p: Proj): void {
    if (p.kind === 'bullet') {
      const v = vfxOf('tracer'), len = 90 * p.size;
      if (v && v.img.complete) {
        const fr = v.frames[0];
        c.save(); c.translate(p.x, p.y); if (p.dir < 0) c.scale(-1, 1);
        c.drawImage(v.img, fr[0], fr[1], fr[2], fr[3], -len, -fr[3] * 0.9, len, fr[3] * 1.8);
        c.restore();
      } else { c.fillStyle = '#fff6d0'; c.fillRect(p.x - (p.dir > 0 ? len : 0), p.y - 2, len, 4); }
      return;
    }
    // 꼬리 (점 몇 개, 그라데이션 없이)
    c.save();
    for (let i = 0; i < p.trail.length; i++) {
      const [tx, ty] = p.trail[i], a = (i + 1) / p.trail.length, r = Math.max(2, Math.round(10 * p.size * a));
      c.globalAlpha = 0.35 * a; c.fillStyle = p.c; c.fillRect(Math.round(tx - r), Math.round(ty - r), r * 2, r * 2);
    }
    c.restore();
    if (p.vfx && drawVfx(c, p.vfx, p.t, p.x, p.y, p.size, { loop: true, anchor: 'center', flip: p.dir < 0, tint: p.tint, rot: p.rot })) return;
    const r = Math.round(12 * p.size);
    c.fillStyle = '#000'; c.fillRect(Math.round(p.x - r - 2), Math.round(p.y - r - 2), r * 2 + 4, r * 2 + 4);
    c.fillStyle = p.c; c.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2);
    c.fillStyle = '#ffffff'; c.fillRect(Math.round(p.x - r / 2), Math.round(p.y - r / 2), r, r);
  }

  private drawFx(c: CanvasRenderingContext2D, under: boolean): void {
    for (const e of this.st.fx) {
      if (!!e.under !== under) continue;
      this.drawOne(c, e);
    }
  }
  private drawOne(c: CanvasRenderingContext2D, e: Fx): void {
    const k = 1 - e.t / e.t0;
    switch (e.k) {
      case 'sheet': {
        if (e.dur == null) { const v = vfxOf(e.name); e.dur = v ? vfxDur(v) : 0.3; }
        if (e.el > e.dur && !e.loop && !e.hold) { e.t = 0; return; }
        const el = e.loop ? e.el : Math.min(e.el, e.dur - 0.001);
        const alpha = e.fade && e.t < e.fade ? e.t / e.fade : 1;
        drawVfx(c, e.name, el, e.x, e.y, e.s, { flip: e.flip, anchor: e.anchor, tint: e.tint, rot: e.rot, alpha, loop: e.loop });
        return;
      }
      case 'streak': {
        // 사방에서 가운데로 빨려 드는 금빛 점선 줄기
        c.save();
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2 + Math.sin(e.seed + i * 7.1) * 0.12;
          const far = 760 * (1 - k) + 40 + (Math.sin(e.seed * 3 + i * 2.3) + 1) * 60, len = 70 + (Math.sin(e.seed + i * 5.7) + 1) * 50;
          for (let q = 0; q < len; q += 6) {
            const r = far + q, x = Math.round(e.x + Math.cos(a) * r), y = Math.round(e.y + Math.sin(a) * r * 0.8);
            c.fillStyle = q < 12 ? '#fff6c0' : q < len * 0.5 ? '#ffd040' : '#d07a18';
            c.fillRect(x, y, 4, 3);
          }
        }
        c.restore();
        return;
      }
      case 'spark': {
        const n = e.n || 6;
        c.fillStyle = e.c;
        for (let i = 0; i < n; i++) {
          const a = (e.seed + i * 2.399) % (Math.PI * 2), v = 90 + ((e.seed * 31 + i * 17) % 120);
          const x = e.x + Math.cos(a) * v * k, y = e.y + Math.sin(a) * v * k * 0.8 + 120 * k * k, s = Math.max(2, Math.round(5 * (1 - k)));
          c.fillRect(Math.round(x), Math.round(y), s, s);
        }
        return;
      }
      case 'dust': {
        c.fillStyle = `rgba(210,200,180,${(0.55 * (1 - k)).toFixed(3)})`;
        for (let i = 0; i < (e.n || 6); i++) {
          const d = ((e.seed * 13 + i * 37) % 100) / 100 - 0.5, r = Math.round(6 + 10 * k);
          c.fillRect(Math.round(e.x + d * 140 * (0.4 + k)), Math.round(e.y - 6 - 30 * k * ((i % 3) / 3) - r), r, r);
        }
        return;
      }
      case 'ring': {
        const r = e.r * (0.2 + 0.8 * k);
        c.save(); c.globalAlpha = 1 - k; c.strokeStyle = e.c; c.lineWidth = e.w;
        c.beginPath(); c.ellipse(e.x, e.y, r, r * (e.sy ?? 1), 0, 0, Math.PI * 2); c.stroke(); c.restore();
        return;
      }
      case 'tracer': {
        const x = e.x + (e.x2 - e.x) * k, y = e.y + (e.y2 - e.y) * k;
        c.strokeStyle = '#fff6d0'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x - (e.x2 - e.x) * 0.3, y - (e.y2 - e.y) * 0.3); c.lineTo(x, y); c.stroke();
        return;
      }
      case 'beam': {
        const v = vfxOf('charge_beam');
        const len = Math.abs(e.x2 - e.x), sc = e.sy * (0.5 + 0.5 * (e.t / e.t0));
        if (v && v.img.complete) {
          const [fx0, fy0, fw, fh] = v.frames[Math.floor((e.t0 - e.t) / 0.05) % v.frames.length];
          c.save(); c.translate(e.x, e.y); if (e.dir < 0) c.scale(-1, 1);
          for (let x = 0; x < len; x += 8) {
            const k0 = Math.min(1, 0.12 + (x / 140) ** 0.7 * 0.88), sx = fx0 + ((x / 2) % fw), sw = Math.min(4, fw - (sx - fx0));
            c.drawImage(v.img, sx, fy0, sw, fh, x, -fh * sc * k0, sw * 2, fh * 2 * sc * k0);
          }
          c.restore();
        } else { c.fillStyle = e.c; c.fillRect(Math.min(e.x, e.x2), e.y - e.w / 2, len, e.w); }
        return;
      }
      case 'fire': {
        const r = Math.round(e.r * (1 - k * 0.5));
        c.fillStyle = k < 0.3 ? '#fff3b0' : k < 0.6 ? '#ffb040' : '#d0501a';
        c.fillRect(Math.round(e.x - r), Math.round(e.y - r), r * 2, r * 2);
        return;
      }
      case 'shell': c.fillStyle = '#d8b050'; c.fillRect(Math.round(e.x), Math.round(e.y), 4, 2); return;
      case 'coin': c.fillStyle = '#ffd35a'; c.fillRect(Math.round(e.x - 4), Math.round(e.y - 4), 8, 8); return;
      case 'line': {
        const f = e.from as Fighter, o = f.foe();
        if (!o) return;
        c.save(); c.globalAlpha = Math.min(1, e.t * 2); c.strokeStyle = e.c; c.lineWidth = 3;
        c.beginPath(); c.moveTo(f.x, LINE - f.z - 230 * K); c.lineTo(o.x, LINE - o.z - 150 * K); c.stroke(); c.restore();
        return;
      }
      case 'lob': case 'toss': {
        const x = e.x0 + (e.x1 - e.x0) * k, y = e.y0 + (e.y1 - e.y0) * k - Math.sin(k * Math.PI) * (e.arc ?? 140);
        if (e.vfx && drawVfx(c, e.vfx, e.t0 - e.t, x, y, e.sc ?? K, { anchor: 'center', flip: e.flip, rot: (e.rot || 0) * k * 6 })) return;
        c.fillStyle = '#000'; c.fillRect(Math.round(x - 8), Math.round(y - 8), 16, 16);
        c.fillStyle = e.c || '#7a8a50'; c.fillRect(Math.round(x - 6), Math.round(y - 6), 12, 12);
        return;
      }
      case 'carry': {
        const f = e.owner as Fighter, pt = carryPt(f, e);
        if (!pt) { if (f.anim !== e.clip) e.t = 0; return; }
        drawVfx(c, e.vfx, this.st.t, pt.x, pt.y, (e.sc || 1) * K, { anchor: 'center', flip: f.face < 0, loop: true });
        return;
      }
      case 'obj': {
        const a = e.alpha ?? 1, s = e.s ?? K;
        if (e.by && e.did) {
          const by = e.by as Fighter, n = by.art.A[e.did]?.n ?? 1;
          drawSprite(c, by.art, e.did, Math.floor(this.st.t * 6) % n, e.x, 0, e.face, false, { alpha: (e.alpha ?? 0.45) * Math.min(1, (e.t / e.t0) * 4), over: { c: e.c, a: e.over } });
          return;
        }
        if (e.vfx && drawVfx(c, e.vfx, e.t0 - e.t, e.x, e.y, s, { anchor: e.ground ? 'bottom' : 'center', flip: e.face < 0, loop: true, alpha: a })) return;
        c.save(); c.globalAlpha = a * Math.min(1, e.t * 3);
        const w = Math.round(28 * s), h = Math.round(28 * s), y = e.ground ? e.y - h : e.y - h / 2;
        c.fillStyle = '#000'; c.fillRect(Math.round(e.x - w / 2 - 2), Math.round(y - 2), w + 4, h + 4);
        c.fillStyle = e.c; c.fillRect(Math.round(e.x - w / 2), Math.round(y), w, h);
        c.restore();
        return;
      }
      case 'target': c.save(); c.strokeStyle = '#ff5a4a'; c.lineWidth = 3; c.beginPath(); c.ellipse(e.x, e.y, 34, 10, 0, 0, Math.PI * 2); c.stroke(); c.restore(); return;
      case 'mortar': c.fillStyle = '#2a2a2a'; c.fillRect(Math.round(e.x - 5), Math.round(e.y - 600 * (1 - k) - 12), 10, 18); return;
      case 'sweep': {
        const x = e.x0 + (e.x1 - e.x0) * k;
        c.save(); c.globalAlpha = 0.75 * Math.sin(k * Math.PI); c.fillStyle = e.c;
        c.beginPath(); c.ellipse(x, e.y, 260, 120, 0, 0, Math.PI * 2); c.fill(); c.restore();
        return;
      }
      case 'drop': c.save(); c.translate(e.x, e.y); c.rotate(e.rot); c.fillStyle = e.c; c.fillRect(-8, -5, 16, 10); c.restore(); return;
      case 'spike': {
        const h = e.h * Math.min(1, k * 5) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        c.fillStyle = e.c === '#000' ? '#120a16' : '#120a16';
        c.beginPath(); c.moveTo(e.x - 6, e.y); c.lineTo(e.x + 6, e.y); c.lineTo(e.x + e.lean * h, e.y - h); c.closePath(); c.fill();
        return;
      }
      case 'scorch': c.save(); c.globalAlpha = Math.min(0.5, e.t); c.fillStyle = '#1a1410'; c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * 0.3, 0, 0, Math.PI * 2); c.fill(); c.restore(); return;
      case 'eyes': c.fillStyle = e.c; c.fillRect(Math.round(e.x - 6), Math.round(e.y), 4, 3); c.fillRect(Math.round(e.x + 4), Math.round(e.y), 4, 3); return;
    }
  }

  /** 시험: 그림 없이 n 초 진행 */
  simulate(sec: number): void { for (let i = 0; i < sec / DT; i++) this.step(); }

  destroy(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this.kd);
    removeEventListener('keyup', this.ku);
    removeEventListener('blur', this.blur);
    setVsSay(null);
    this.screen.dispose();
  }
}

export const vfxLen = (name: string) => { const v = vfxOf(name); return v ? vfxDur(v) : 0; };
