// 인물 플레이어: 인물 전투·생활 엔진(fighter/core.ts)을 엔진 플레이어 자리에 꽂는다.
// eileen/player.ts(에일린 시험판)를 126명 공용으로 일반화한 것: 그림·설정은 인물 팩(art/charPacks.ts)에서, 이펙트·의자는 action-fx 팩에서.
// 엔진과 맞닿는 곳만 여기서 한다: 입력(Pad → 테스트룸 동작), 위치 동기화, 적에게 맞히기(env.hurt → 적 applyHit), 적에게 맞기(applyHit → core.takeHit),
// 체력·게이지(게임 값), 그리기(바닥 층·몸·이펙트 층·화면 효과). 판정 크기·반응은 테스트룸 값을 게임 적 반응 등급으로 옮긴다.
import { baseOf, derive, type BaseStats, type Derived } from '../../combat/stats';
import type { DebuffKind } from '../../combat/status';
/** 코어가 타격마다 넘기는 꼬리표 */
type HurtOpt = { push?: number; src?: 'ranged' | 'blast' | 'skill' | null; form?: 'body' | 'gun' | 'psi'; el?: string; debuff?: { k: DebuffKind; s: number }; crit?: boolean };
import { Player } from '../engine/player';
import { Fighter } from '../engine/fighter';
import { newAttackId } from '../engine/ids';
import { spr } from '../engine/view';
import { pfont } from '../engine/pxfont';
import { CHAR_K, charFx, type CharArt } from '../art/charPacks';
import type { Body, Hit, HitResult, React, WBox, WorldView } from '../engine/contract';
import type { Pad, Btn } from '../engine/input';
import type { FrameInfo } from '../engine/art';
import { createFighterCore } from './core';
import { seatBody } from './seats';
import { STATUS, StatusSet } from '../../combat/status';
import { PerkRun, perkWorld, type PerkHost } from '../../perks/runtime';
import { draft, kitOf, type Offer } from '../../perks/rules';
import { GRADE_COLOR, PAIR_COLOR, TRAIT_COLOR } from '../../perks/draftUi';

/** 테스트룸 동작 이름 ↔ 엔진 버튼 */
const PRESS: [Btn, string][] = [
  ['light', 'light'], ['heavy', 'heavy'], ['dodge', 'dodge'], ['block', 'block'], ['shoot', 'shoot'],
  ['skill', 'skill'], ['charge', 'charge'], ['super', 'super'], ['jump', 'jump'], ['weapon', 'weapon'],
  ['combat', 'combat'], ['sit', 'sit'], ['crouch', 'crouch'], ['flee', 'flee'], ['back', 'back'],
  ['left', 'left'], ['right', 'right'], ['up', 'up'], ['down', 'down'],
];
/** 테스트룸 맞음 종류(hurtDummy kind) → 게임 반응. 테스트룸 수치: light 밀림·heavy 휘청·stun 1.4초·launch 띄움·blow 크게 날림·down 넘어뜨림·spike 내리찍음·pull 끌어당김·turn 홱 돌려 밀기 */
const REACT: Record<string, { react: React; push: number; lift: number; strength: 1 | 2 | 3 }> = {
  light: { react: 'flinch', push: 2, lift: 0, strength: 1 },
  heavy: { react: 'stagger', push: 9, lift: 0, strength: 2 },
  stun: { react: 'stagger', push: 5, lift: 0, strength: 2 },
  launch: { react: 'launch', push: 3, lift: 24, strength: 3 },
  blow: { react: 'down', push: 26, lift: 12, strength: 3 },
  down: { react: 'down', push: 12, lift: 6, strength: 3 },
  spike: { react: 'down', push: 4, lift: 0, strength: 3 },
  pull: { react: 'stagger', push: -14, lift: 0, strength: 2 },
  turn: { react: 'stagger', push: 6, lift: 0, strength: 2 },
};

/** 다른 모듈이 붙이는 곳. sfx: 효과음. extraTargets: 전투 몸이 아닌 필드 행위자도 때릴 수 있게 (src/game/world, 엔진 modules가 채운다) */
export const fighterHooks: { sfx: (e: Record<string, unknown>) => void; extraTargets?: () => { body: Body; x: number; y: number; z: number }[]; openDraft?: (p: FighterPlayer, offers: Offer[]) => void } = { sfx: () => {} };

type Core = ReturnType<typeof createFighterCore>;

export class FighterPlayer extends Player {
  core: Core;
  private world: WorldView | null = null;
  private heldNames = new Set<string>();
  private synced = { x: 0, y: 0 };
  private started = false;
  private lastTickAt = 0;
  private lastFrameAt = 0;
  /** 「조준경 덮개」 유물: 이번 출동 첫 사격을 썼나 */
  private firstShotUsed = false;
  /** 마지막으로 코어에서 받아 온 게이지 (바깥에서 바뀌었는지 보려고) */
  private gaugeSeen = 0;
  /** 방어 게이지 0..100 (사용자 2026-10-25: 방어를 무제한으로 못 하게). 막아낸 공격만큼만 깎이고, 안 맞으면 다시 찬다
   * (막고만 있으면 줄지 않는다). 맞아서 바닥나면 가드가 깨져 잠깐 휘청이고, 40까지 차오를 때까지 다시 못 막는다 */
  guard = 100;
  guardBroken = false;
  /** 마지막으로 게이지가 줄어든 뒤 지난 초 (화면 표시가 이걸 보고 사라진다) */
  guardIdle = 99;
  private guardWait = 0;
  private underFn = (ctx: CanvasRenderingContext2D, camX: number) => this.drawUnder(ctx, camX);

  /** 임시 퍽 (괴이 안에서만, src/game/perks). 인물 AI 는 빈 묶음 */
  perks = new PerkRun();
  /** 방 보상: 전투가 끝나면 마지막 적 자리에 떨어지는 카드(후보는 떨어질 때 미리 굴림). 다가가 E로 집으면 3택1 창. 안 집고 다음 방으로 가면 그때 창 */
  reward: { x: number; y: number; t: number; offers: Offer[]; color: string } | null = null;
  /** 전투 끝(괴이 판 진행 중일 때만): 보상 카드를 떨어뜨린다 */
  dropReward(at?: { x: number; y: number }) {
    if (!this.perks.active || this.reward) return;
    const kit = kitOf(this.art.cfg, (id) => this.core.has(id), this.base.str);
    const offers = draft(kit, { ranks: this.perks.ranks, traits: this.perks.traits }, Math.random, this.perks.depth);
    if (!offers.length) return;
    const pair = offers.some((f) => f.type === 'perk' && f.def.kind === '쌍');
    const top = Math.max(...offers.map((f) => (f.type === 'perk' ? f.grade : 0)));
    const p = at ?? this.perks.lastKill ?? { x: this.x + this.dir * 160, y: this.y };
    const [b0, b1] = this.world?.bounds ?? [0, 99999];
    this.reward = { x: Math.max(b0 + 60, Math.min(b1 - 60, p.x)), y: p.y, t: 0, offers, color: pair ? PAIR_COLOR : offers.every((f) => f.type === 'trait') ? TRAIT_COLOR : GRADE_COLOR[top] };
    fighterHooks.sfx({ type: 'pickup', x: p.x });
  }
  /** 보상을 집음 → 3택1 창 */
  takeReward() {
    const r = this.reward;
    if (!r) return;
    this.reward = null;
    fighterHooks.openDraft?.(this, r.offers);
  }
  private rewardNear(): boolean { const r = this.reward; return !!r && Math.abs(r.x - this.x) < 80 && Math.abs(r.y - this.y) < 50; }
  /** 방어막 (NPC 등급, combat/grades.ts): 체력보다 먼저 깎이고, 남은 동안 경직·밀림 없음. 깨지면 잠깐 휘청. 다시 차지 않는다 */
  shield = 0;
  shieldMax = 0;
  /** 인물 팩 (그림·설정) */
  readonly art: CharArt;
  /** 기본 능력치(힘민체지정)와 산출 전투 수치 (combat/stats.ts) */
  base: BaseStats;
  stat: Derived;
  /** 능력치에서 나온 최대 체력 (출동 시작 때 progression 이 이 값을 쓴다) */
  baseHp: number;
  constructor(clips: Record<string, FrameInfo[]>, art: CharArt) {
    super(clips);
    this.art = art;
    this.label = art.cfg.name;
    this.base = baseOf(art.cfg.name, (art.cfg as { bal?: { role?: string } }).bal?.role);
    this.stat = derive(this.base);
    this.baseHp = this.hp = this.hpMax = this.stat.hp;
    // 멈춤(히트스톱)은 테스트룸 코드가 스스로 한다: 엔진이 플레이어에 거는 멈춤은 받지 않는다
    Object.defineProperty(this, 'stop', { get: () => 0, set: () => {}, configurable: true });
    const fx = charFx();
    this.core = createFighterCore({
      A: art.A, IMG: art.IMG, CH: art.cfg, VFX: fx?.VFX ?? {}, CHAIR: fx?.CHAIR ?? {},
      held: this.heldNames,
      K: (y: number) => spr(y) * CHAR_K,
      sfx: (type: string, extra: Record<string, unknown>) => fighterHooks.sfx({ type, ...extra }),
      font: (n: number) => pfont(n).f,
      targets: () => this.targets(),
      // 능력치(본부 출동 stats)·상태 효과 배율 (docs/게임_성장_경제_설계.md 2-2·6장)
      mod: { speed: () => this.speedMul(), sp: () => this.spMul(), cd: () => this.stat.cd },
      // 치명: 플레이어·NPC·적 모두 같은 확률 (10-30)
      crit: () => Math.random() < this.stat.crit, critDmg: () => this.stat.critDmg, critP: () => this.stat.crit,
      perk: this.perks,
      bind: (t: { body: Body }, sec: number) => this.bindBody(t.body, sec),
      // 물건 윗면은 이미 그 높이에 있을 때만 땅이다 (아래에서 걸어 들어가면 올라서지 않고 막힌다)
      ground: (x: number, y: number) => { const p = this.platformAt(x, y); return p && this.core.P.z >= p.h - 10 ? p.h : 0; },
      hurt: (t: { body: Body }, dmg: number, kind: string, face: 1 | -1, hitstop: number, o: HurtOpt) => this.hurtTarget(t.body, dmg, kind, face, hitstop, o),
      clamp: (P: { x: number; y: number }) => {
        const w = this.world;
        if (!w) return;
        P.y = Math.max(w.lane[0], Math.min(w.lane[1], P.y));
        P.x = Math.max(w.bounds[0] + 30, Math.min(w.bounds[1] - 30, P.x));
      },
    });
    this.perks.host = this.perkHost();
  }

  /** 퍽이 엔진을 만지는 손잡이 (src/game/perks/runtime.ts PerkHost) */
  private perkHost(): PerkHost {
    const api = this.core.perkApi;
    const me = this; // eslint-disable-line @typescript-eslint/no-this-alias
    return {
      kit: kitOf(this.art.cfg, (id) => this.core.has(id), this.base.str),
      get P() { return me.core.P; },
      me: {
        get hp() { return me.hp; }, set hp(v: number) { me.hp = Math.max(0, Math.min(me.hpMax, v)); },
        get hpMax() { return me.hpMax; }, set hpMax(v: number) { me.hpMax = v; },
        get baseHp() { return me.baseHp; }, set baseHp(v: number) { me.baseHp = v; },
        get shield() { return me.shield; }, set shield(v: number) { me.shield = v; },
        get shieldMax() { return me.shieldMax; }, set shieldMax(v: number) { me.shieldMax = v; },
        get x() { return me.x; }, set x(v: number) { me.x = v; },
        get y() { return me.y; }, set y(v: number) { me.y = v; },
      },
      foes: () => api.proxies(),
      hit: (t, dmg, kind, tag, depth) => api.hit(t, dmg, kind, tag, depth),
      boom: (b) => api.boom(b),
      status: (body, k, s, mul) => this.putStatus(body, k, s, mul),
      statusOf: (body) => (body as { status?: unknown }).status instanceof StatusSet ? (body as { status: StatusSet }).status : null,
      mark: (t, s) => api.mark(t, s),
      bind: (t, s) => api.bind(t, s),
      stun: (t, s) => this.stunBody(t.body, s),
      later: (s, fn) => api.later(s, fn),
      text: (x, y, v) => api.text(x, y, v),
      ghost: (ids, mul) => api.ghost(ids, mul),
      replaySkill: (mul) => api.replaySkill(mul),
      moveBody: (body, dx) => { body.x += dx; if (body.core?.P) body.core.P.x += dx; },
      bounds: () => (this.world?.bounds ?? [0, 1280]) as [number, number],
      isDown: (body) => body.core?.P ? ['down', 'belly'].includes(body.core.P.mode) : body.state === 'down' || body.state === 'getup',
      isStunned: (t) => t.stunT > 0 || t.body.state === 'stunned' || t.body.core?.P?.mode === 'stun',
      isElite: (body) => !!body.elite || !!body.boss || (body.shieldMax ?? 0) > 0,
      setHpMax: (v) => { this.hpMax = v; },
      addSp: (v) => api.gainSp(v),
      gainDodge: () => { this.core.P.dodgeN = Math.min(this.core.P.dodgeMax, this.core.P.dodgeN + 1); },
      resetSkillCd: () => { this.core.P.cd.skill = 0; this.core.P.skillN = this.core.P.skillMax || 1; },
    };
  }
  /** 상대에게 상태 이상 (퍽): 상대 정신력으로 지속 감소. 새로 걸리면 머리 위에 이름 */
  private putStatus(body: any, k: DebuffKind, s: number, mul?: number) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const st = (body as { status?: unknown }).status;
    if (!(st instanceof StatusSet) || !body.alive || body.hp <= 0) return;
    if (st.apply(k, k === 'taint' ? undefined : s * (body.stat?.statusDur ?? 1), mul)) this.core.perkApi.text(body.x, body.y - (body.z || 0) - 250, STATUS[k].label);
  }
  /** 기절: 엔진 적은 stunned, 인물은 스턴 동작 */
  private stunBody(body: any, s: number) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!body.alive || body.hp <= 0) return;
    if (body.core?.P) { if (!['down', 'belly', 'dead'].includes(body.core.P.mode)) { body.core.stun(); body.core.P.stunT = s; } return; }
    if (typeof body.set === 'function' && body.state !== 'dead' && body.state !== 'spawn') { body.move = null; body.set('stunned'); body.stunT = Math.round(s * 30); }
  }
  /** 묶기: 엔진 적은 bound(못 움직임), 인물은 스턴 */
  private bindBody(body: any, s: number) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!body.alive || body.hp <= 0) return;
    if (body.core?.P) return this.stunBody(body, s);
    if (typeof body.set === 'function' && body.state !== 'dead' && body.state !== 'spawn' && body.state !== 'air') { body.move = null; body.set('bound'); body.bindT = Math.round(s * 30); }
  }

  /** 발 자리 아래 올라설 물건 (데스크 등) */
  private platformAt(x: number, y: number) {
    const ps = (this.world?.floor as { platforms?: { x0: number; x1: number; y0: number; y1: number; h: number }[] } | undefined)?.platforms;
    let best: { x0: number; x1: number; y0: number; y1: number; h: number } | null = null;
    for (const p of ps ?? []) if (x >= p.x0 && x <= p.x1 && y >= p.y0 - 4 && y <= p.y1 + 4 && (!best || p.h > best.h)) best = p;
    return best;
  }
  /** 그리는 순서용 깊이: 물건 위에 서 있으면 그 물건 앞 모서리보다 앞으로 */
  /** 회피 충전: 쓸 수 있는 회피 수 + 다음 하나가 찬 만큼(0~1) */
  get dodgeMeter(): number { const P = this.core.P; return P.dodgeN + (P.dodgeN < P.dodgeMax && P.dodgeCd > 0 ? 1 - Math.max(0, P.dodgeT) / P.dodgeCd : 0); }
  get dodgeMax(): number { return this.core.P.dodgeMax; }
  /** 아이템 쓸 때 몸짓(엔진은 옛 동작 이름 drink·eat·bandage·toss 를 부름): 인물 팩 공통 줄 「26 섭취」로. 던지는 동작은 공통 줄에 없어서 몸짓 없이 효과만(10-30 동작 대조) */
  override play(key: string, world: WorldView): void {
    if (key === 'drink' || key === 'eat' || key === 'bandage') { if (this.core.has('26')) this.core.emote('26', 7); return; }
    if (key === 'toss') return;
    super.play(key, world);
  }
  /** 고유기·충전·필살 피해 배율: NPC만 0.5 (docs/설계_기본피해_표준.md 3장) */
  skillMul = 1;
  get sortY() {
    const p = this.z > 4 ? this.platformAt(this.x, this.y) : null;
    return p && this.z >= p.h - 8 ? p.y1 + 2 : this.y;
  }

  private targets() {
    return this.foes().map((b) => ({ body: b, x: b.x, y: b.y, z: b.z })).concat(this.extraFoes());
  }
  /** 때릴 상대 (주인공: 적 편 몸 전부. AI 대련 상대(src/game/combat)는 주인공 쪽으로 바꾼다) */
  protected foes(): Body[] {
    const w = this.world as (WorldView & { bodies: Body[] }) | null;
    if (!w) return [];
    return w.bodies.filter((b) => b.alive && b.team === 'enemy' && b.hp > 0 && b.kind !== 'bullet');
  }
  /** 전투 몸이 아닌 필드 행위자 (주인공만) */
  protected extraFoes(): { body: Body; x: number; y: number; z: number }[] {
    return fighterHooks.extraTargets?.() ?? [];
  }
  /** AI 쪽에서 쓰는 지금 월드 */
  protected get worldNow(): WorldView | null {
    return this.world;
  }

  /** 이동·회피·점프 속도 배율: 능력치 speed × 상태 효과 */
  protected speedMul(): number {
    return this.stat.speed * (this.progression?.stats.speed ?? 1) * (this.statusMod?.speed() ?? 1) * this.perks.walkMul();
  }
  /** 필살 게이지 차는 배율: 능력치 charge × 상태 효과 */
  protected spMul(): number {
    return this.stat.sp * (this.progression?.stats.charge ?? 1) * (this.statusMod?.sp() ?? 1) * this.perks.spMul();
  }
  /** 상태 효과 (출혈·오염·두통·혼란·공포·둔화·침묵, src/game/combat/status.ts). 적 공격의 debuff 이벤트가 건다 */
  status = new StatusSet();
  /** 상태 효과가 거는 배율 */
  statusMod?: { speed(): number; sp(): number } = { speed: () => this.status.speedMul(), sp: () => this.status.spMul() };

  private hurtTarget(t: Body, dmg: number, kind: string, face: 1 | -1, hitstop: number, o: HurtOpt): { killed?: boolean; guard?: boolean } | void {
    const w = this.world as (WorldView & { kills: number; emit(e: unknown): void }) | null;
    if (!w || !t.alive) return;
    const r = REACT[kind] ?? REACT.light;
    // 근접·기술은 힘, 원거리(사격·충전탄·제압사격)는 사격 배율 (폭발은 배율 없음: 엔진 progressionHit 'ability'와 같음)
    const st = this.progression?.stats;
    // 판정 형태로 어느 능력치가 피해를 키울지 (docs/설계_능력치_기술피해_안.md 4장): 몸 = 힘, 총·투척 = 민, 이능 = 지. 꼬리표가 없으면 사격은 총, 나머지는 몸
    const form = o.form ?? (o.src === 'ranged' ? 'gun' : 'body');
    let scale = form === 'gun' ? this.stat.aim * (st?.aim ?? 1) : form === 'psi' ? this.stat.psi : this.stat.power * (st?.power ?? 1);
    if (o.src === 'blast' && !o.form) scale = 1;
    // 에일린 전용 유물 「조준경 덮개」(숙련 8): 출동마다 첫 사격 명중은 치명 ×2
    if (o.src === 'ranged' && !this.firstShotUsed && this.label === '에일린' && this.progression?.relics.includes('own_eileen')) {
      this.firstShotUsed = true;
      scale *= 2;
      w.say('치명!', 0.8);
    }
    const hit: Hit = { x0: t.x - 1, x1: t.x + 1, z0: 0, z1: 400, y: t.y, dy: 999, attackId: newAttackId(), dmg: dmg * this.dmgMul * scale * (o.src === 'skill' ? this.skillMul : 1), react: r.react, dir: face, push: o.push ?? r.push, lift: r.lift, stop: 0, strength: r.strength };
    const res = t.applyHit(hit, w);
    if (res.kind === 'immune') return;
    // 기술 부가효과: 맞은 상대에게 상태 이상 (docs/퍽/기술_부가효과.md). 막았으면 안 걸림. 상대 정신력으로 지속이 줄어듦. 퍽: 지속 연장·깊은 상처
    if (o.debuff && res.kind !== 'guard') this.putStatus(t, o.debuff.k, (o.debuff.s > 0 ? o.debuff.s : STATUS[o.debuff.k].sec) * this.perks.outDur(o.debuff.k), o.debuff.k === 'bleed' ? this.perks.bleedMul() : undefined);
    // 맞은 적은 테스트룸 멈춤만큼 멈춘다
    t.stop = Math.max(t.stop, Math.round(Math.max(hitstop, kind === 'light' ? 0.085 : 0.16) * 30));
    this.combo = this.comboClock > 0 ? this.combo + 1 : 1;
    this.comboClock = 40;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (res.killed) {
      w.kills++;
      if (t.team === 'enemy' && !(t instanceof Fighter)) w.emit({ type: 'enemyDie', x: t.x, kind: t.kind });
    }
    return { killed: !!res.killed, guard: res.kind === 'guard' };
  }

  /* ───────── 엔진 쪽 ───────── */

  frame(): { hit: Hit[]; hurt: WBox[] } {
    const k = spr(this.y) * CHAR_K;
    return { hit: [], hurt: this.alive ? [{ x0: this.x - 26 * k, x1: this.x + 26 * k, z0: this.z, z1: this.z + this.height(), y: this.y, dy: 16 }] : [] };
  }
  /** 화면 위 키(서 있는 그림 기준) */
  height(): number {
    const m = this.art.A['1'];
    return (m ? Math.min(m.h - 4, m.floor) - (m.top[0] ?? 14) : 210) * spr(this.y) * CHAR_K;
  }

  applyHit(hit: Hit, world: WorldView): HitResult {
    const P = this.core.P;
    if (P.inv > 0 || this.invuln > 0) {
      this.core.takeHit('hit');
      // 빈틈 없음(퍽): 회피 무적 중에 닿은 투사체도 되돌린다
      if (P.dodging && this.perks.reflectOnDodge() && !this.attackerOf(hit)) this.core.perkApi.reflect(hit.dmg, this.perks.reflectSplit());
      return { kind: 'immune' };
    }
    if (P.mode === 'down' || P.mode === 'belly' || this.phase === 'down') return { kind: 'immune' };
    const front = hit.dir === -P.face;
    if (P.mode === 'block' && front) {
      // 퍽: 막기 사건(가시 방패·혼쭐·금품 수수 불가·쌓인 울분·탄 되받기·맨손으로 쳐낸다·가드 강화·완전 방어)
      const attacker = this.attackerOf(hit);
      const pr = this.perks.blocked({ melee: !!attacker, attacker, dmg: hit.dmg });
      if (!pr.noDrain) this.spendGuard((14 + hit.dmg * 0.6) / this.perks.guardMul());
      if (pr.reflect) this.core.perkApi.reflect(hit.dmg, this.perks.reflectSplit());
      if (this.guardBroken && this.perks.guardBreak()) { this.core.onRelease('block'); world.emit({ type: 'guard', x: this.x }); return { kind: 'guard' }; }
      if (this.guardBroken) {
        // 가드 브레이크: 막던 자세가 깨지고 잠깐 휘청인다
        this.core.onRelease('block');
        this.core.stun();
        P.stunT = 1.1;
        world.emit({ type: 'guard', x: this.x });
        return { kind: 'hit' };
      }
      this.core.takeHit('hit');
      this.hp = Math.max(1, this.hp - Math.round(hit.dmg * (this.team === 'player' ? this.perks.blockChip() : 0.1)));
      world.emit({ type: 'guard', x: this.x });
      return { kind: 'guard' };
    }
    if (this.ward > 0 && hit.dmg > 0) {
      this.ward--;
      this.invuln = 20;
      world.say('부적이 대신 맞았다', 1);
      return { kind: 'immune' };
    }
    // 경직 저항(poise): 이 값 이하 세기의 공격엔 움찔하지 않는다 (피해는 받음). 세기가 없으면 반응으로 어림한다
    const strength = hit.strength ?? (hit.react === 'down' || hit.react === 'launch' ? 3 : hit.react === 'stagger' ? 2 : 1);
    // 수술 여섯 시간째(퍽): 충전 중에는 맞아도 끊기지 않는다(피해는 받음)
    const armored = this.core.armored() || strength <= (this.progression?.stats.poise ?? 0) || (P.mode === 'charge' && this.perks.keepCharge());
    // 방어(defense): 받는 피해 감소 (가드·무적·부적 뒤 실제 체력 피해에만, 엔진 defendedHit과 같음)
    let taken = hit.dmg * this.stat.taken * (1 - (this.progression?.stats.defense ?? 0)) * (this.core.armored() ? 0.5 : 1) * this.perks.takenMul();
    if (this.shield > 0) {
      const cut = Math.min(this.shield, Math.round(taken));
      this.shield -= cut;
      taken -= cut;
      world.emit({ type: 'hurt', x: this.x, dmg: cut, hp: this.hp });
      if (this.shield > 0) { P.armorT = 0.28; (P as { armorC?: string }).armorC = '#5ab8ff'; return { kind: 'armor' }; }   // 슈퍼아머 번쩍과 같고 색만 하늘색
      world.emit({ type: 'guard', x: this.x });
      // 방어막이 깨짐: NPC 는 잠깐 휘청 (남은 피해는 체력으로). 플레이어 보호막(퍽 「방어막」)은 휘청 없이 반응 장갑만
      if (this.team === 'player') { this.perks.shieldBroke(); this.shieldMax = 0; }
      else { this.core.stun(); P.stunT = 0.8; }
      this.hp = Math.max(0, this.hp - Math.round(taken));
      return { kind: 'hit' };
    }
    // 죽을 한 방: 버티기·죽은 채로 있을 수가 없다(퍽)
    if (this.hp - Math.round(taken) <= 0 && this.team === 'player') {
      const r = this.perks.lethal();
      if (r === 'hold') { world.emit({ type: 'hurt', x: this.x, dmg: taken, hp: this.hp }); this.core.takeHit('hit'); return { kind: 'hit' }; }
      if (r === 'revive') { world.emit({ type: 'hurt', x: this.x, dmg: taken, hp: this.hp }); this.core.knock(); return { kind: 'hit' }; }
    }
    this.hp = Math.max(0, this.hp - Math.round(taken));
    if (this.team === 'player') this.perks.hurt(taken);
    world.emit({ type: 'hurt', x: this.x, dmg: taken, hp: this.hp });
    if (!this.lowWarned && this.hp < this.hpMax * 0.3) {
      this.lowWarned = true;
      world.emit({ type: 'hp:low' });
    }
    if (this.hp <= 0) {
      this.core.knock();
      this.phase = 'down';
      return { kind: 'hit', killed: true };
    }
    this.status.onHit();
    if (armored) { this.core.takeHit('hit'); return { kind: 'armor' }; }
    P.face = (Math.sign(hit.dir) === 1 ? -1 : 1) as 1 | -1;
    const knock = (hit.react === 'down' || hit.react === 'launch') && !(this.team === 'player' && this.perks.noKnock());
    this.core.takeHit(knock ? 'knock' : 'hit');
    return { kind: 'hit' };
  }

  /** 이 공격을 한 근접 상대 (앞 220px 안, 같은 줄). 없으면 투사체로 본다 */
  private attackerOf(hit: Hit) {
    const P = this.core.P;
    return this.core.perkApi.proxies().filter((q) => Math.abs(q.y - P.y) < 70 && Math.abs(q.x - P.x) < 220 && Math.sign(q.x - P.x) === -Math.sign(hit.dir || -P.face)).sort((a, b) => Math.abs(a.x - P.x) - Math.abs(b.x - P.x))[0] ?? null;
  }

  listen(p: Pad) {
    this.input(p);
  }

  /** 본부 의자 자리(hub.ts seat): 엔진 앉기 클립 대신 테스트룸 앉기(코어 sitAt, 의자 그림·맞춤 chairs/<키>.json 그대로). 조사 키로 일어나 exit 자리로 */
  private coreSeat: { exit: { x: number; y: number } } | null = null;
  /** 코어 의자에 앉아 있나 (hub.ts: 방 의자 그림 숨김) */
  get sitting(): boolean { return !!this.coreSeat; }
  sit(clip: string, x: number, y: number, face: 1 | -1, exit: { x: number; y: number }): boolean {
    const P = this.core.P as unknown as { x: number; y: number; z: number; vx: number; face: 1 | -1; mode: string; seat: unknown };
    const can = ['60', '96', '61'].some((id) => this.core.has(id));
    if (!can || P.mode !== 'ground' || this.z > 0) return super.sit(clip, x, y, face, exit);
    P.x = x; P.y = y; P.z = 0; P.vx = 0; P.face = face;
    this.core.sitAt(clip.includes('side') ? 'side' : clip.includes('back') ? 'back' : 'front');
    if (!P.seat) return super.sit(clip, x, y, face, exit);
    // 지도 의자는 (x, y) 그 자리에 둔다: 사람 발을 이 인물 의자 맞춤값(chairs/<키>.json)만큼 옮긴다 (fighter/seats.ts)
    const seat = P.seat as { dir: string; cx?: number; cy?: number };
    seat.cx = x; seat.cy = y;
    const body = seatBody(x, y, face, this.core.chairFit(seat.dir), spr(y) * CHAR_K);
    P.x = body.x; P.y = body.y;
    this.coreSeat = { exit };
    this.sync();
    return true;
  }
  private coreSeatStep(p: Pad) {
    const P = this.core.P as unknown as { x: number; y: number; mode: string; seat: unknown };
    if (!this.coreSeat) return;
    if (P.mode === 'seat' && (p.pressed.has('interact') || p.pressed.has('sit') || p.pressed.has('jump'))) this.core.rise(false);
    if (!P.seat && P.mode !== 'seatUp') { const e = this.coreSeat.exit; this.coreSeat = null; P.x = e.x; P.y = e.y; this.sync(); }
  }

  private input(p: Pad) {
    const names = this.heldNames;
    names.clear();
    // 혼란: 좌우가 뒤집힌다
    const flip = this.status.flipped();
    const nameOf = (n: string) => (flip && n === 'left' ? 'right' : flip && n === 'right' ? 'left' : n);
    for (const [b, n] of PRESS) if (p.held.has(b)) names.add(nameOf(n));
    if (p.run) names.add('run');
    // 공포: 막지 못한다. 침묵: 기술·필살을 못 쓴다
    if (!this.status.canBlock()) names.delete('block');
    const silenced = !this.status.canSkill();
    if (silenced) { names.delete('skill'); names.delete('super'); }
    // 방어: 게이지가 다 회복되지 않았거나(깨진 뒤 40 미만) 거의 없으면 들어가지 않는다
    if (this.guardBroken || this.guard < 8) names.delete('block');
    // 방향키는 쓰러짐·웅크림·주저앉음일 때만 테스트룸에 넘긴다 (좌우 = 기기, 위 = 일어나기)
    const lying = ['down', 'belly', 'sit', 'scoot', 'crouch', 'crawl4'].includes(this.core.P.mode);
    for (const [b, n0] of PRESS) {
      const n = nameOf(n0);
      if (!p.pressed.has(b) || (silenced && (n === 'skill' || n === 'super'))) continue;
      if ((lying || !['left', 'right', 'up', 'down'].includes(n)) && (n !== 'block' || names.has('block'))) this.core.onPress(n);
    }
    if (p.evade) this.core.onPress('dodge');
    for (const b of ['block', 'charge'] as Btn[]) if (p.released.has(b)) this.core.onRelease(b);
  }

  tick(world: WorldView, p: Pad) {
    this.world = world;
    const w = world as WorldView & { underlays: ((c: CanvasRenderingContext2D, camX: number) => void)[]; camX: number };
    if (!w.underlays.includes(this.underFn)) w.underlays.push(this.underFn);
    if (this.seat) return super.tick(world, p);
    const P = this.core.P;
    // 엔진이 옮긴 만큼(문 앞 도착·막힘·화면 끝)만 받는다: 틱 사이에 그림 장마다 움직인 것은 그대로 둔다
    if (!this.started) { this.started = true; P.x = this.x; P.y = this.y; }
    else { P.x += this.x - this.synced.x; P.y += this.y - this.synced.y; }
    P.hp = Math.round((this.hp / this.hpMax) * 100);
    this.lastTickAt = performance.now();
    this.wantInteract = p.pressed.has('interact');
    // 방 보상 카드: 가까이에서 E
    if (this.wantInteract && this.rewardNear()) { this.wantInteract = false; this.takeReward(); }
    this.wantItem = p.pressed.has('item1') ? 1 : p.pressed.has('item2') ? 2 : p.pressed.has('item3') ? 3 : p.pressed.has('item4') ? 4 : 0;
    if (this.comboClock > 0 && --this.comboClock === 0) this.combo = 0;
    this.statusStep(world, 1 / 30);
    this.coreSeatStep(p);
    if (this.coreSeat) { this.heldNames.clear(); this.core.frameView({ x0: w.camX, lane: w.lane }); this.sync(); return; } // 앉아 있는 동안은 일어나기만
    if (this.phase !== 'down') this.input(p); // 쓰러지면 후송을 기다린다
    this.core.frameView({ x0: w.camX, lane: w.lane });
    this.sync();
  }

  /** 그림 장마다 (render.ts): 테스트룸처럼 실제 시간으로 움직이고 동작을 넘긴다.
   * 엔진 틱(30Hz)에서 1/30초씩 돌리면 0.04초짜리 장이 0.067초로 늘고 움직임이 30장으로 끊긴다 (사용자: 테스트룸보다 프레임이 떨어져 보임) */
  frameStep() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.lastFrameAt || now)) / 1000);
    this.lastFrameAt = now;
    // 월드가 멈춰 있으면(메뉴·대화창) 같이 멈춘다
    if (!this.world || this.seat || now - this.lastTickAt > 120 || dt <= 0) return;
    const w = this.world as WorldView & { camX: number };
    const P = this.core.P;
    P.x += this.x - this.synced.x; P.y += this.y - this.synced.y; // 틱 뒤 막힘·끝 보정
    this.core.frameView({ x0: w.camX, lane: w.lane });
    this.perkSync(dt);
    this.core.update(dt);
    this.guardStep(dt);
    this.calmStep(dt);
    const s = this.core.shake;
    if (s > 6) w.shake(2, Math.min(4, s / 6));
    this.sync();
  }

  /** 퍽 수치를 코어 상태에 넘기고(장마다), 퍽 시계를 돌린다 */
  private perkSync(dt: number) {
    const k = this.perks, P = this.core.P;
    if (!k.ranks.size && !k.traits.size && !k.host) return;
    P.atkSpd = k.atkSpd(); P.slideMul = k.slideMul(); P.heavyRange = k.heavyRange();
    P.dodgeMax = k.dodgeMax(); P.dodgeCd = k.dodgeCd(); P.dodgeInv = k.dodgeInv(); P.dodgeLen = k.dodgeLen();
    P.maxJumps = k.maxJumps(); P.airMul = k.airMul(); P.runMul = k.runMul();
    P.shotMul = k.shotCdMul(); P.heatMul = k.heatMul(); P.overCut = k.overCut(); P.noShoot = k.noShoot();
    P.skillCdMul = k.skillCdMul(); P.chargeMul = k.chargeMul(); P.chargeBig = k.count('충전 강화') >= 3; P.hurtSp = k.hurtSp(); P.ukemi = k.ukemi();
    const sm = k.skillCharges(); if (sm !== (P.skillMax || 1)) { P.skillMax = sm; P.skillN = Math.min(sm, Math.max(1, P.skillN || 1)); }
    this.status.immune = k.mindGuard() ? new Set(['fear', 'confuse']) : undefined;
    this.status.taintPer = k.taintPer();
    if (this.team !== 'player') return;
    k.tick(dt);
    // 방 안이 먼저 지친다·제 편 때리기·당구: 적 몸에 직접
    const w = this.world as (WorldView & { bodies: Body[] }) | null;
    if (!w) return;
    const gap = k.enemyGap();
    const foes = w.bodies.filter((b) => b.alive && b.team === 'enemy' && b.hp > 0 && b.kind !== 'bullet') as (Body & Record<string, any>)[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const e of foes) e.perkGap = gap;
    if (perkWorld.friendlyFire) for (const e of foes) {
      if (e.core || !e.status?.has?.('confuse') || e.state !== 'attack' || typeof e.frame !== 'function') continue;
      const hits = (e.frame() as { hit: Hit[] }).hit;
      for (const o of foes) if (o !== e) for (const b of (o.frame() as { hurt: WBox[] }).hurt) for (const h of hits) if (h.x0 < b.x1 && b.x0 < h.x1 && (h.z0 ?? 0) < b.z1 && b.z0 < (h.z1 ?? 999) && Math.abs(h.y - b.y) <= (h.dy ?? 20) + (b.dy ?? 0)) o.applyHit(h, w);
    }
    if (k.has('당구')) for (const e of foes) {
      if (e.core || !e.mem) continue;
      if (!e.mem.wallHit) { e.mem.billiard = false; continue; }
      if (e.mem.billiard || e.state !== 'air') continue;
      const o = foes.find((o) => o !== e && Math.abs(o.x - e.x) < 46 && Math.abs(o.y - e.y) < 30);
      if (!o) continue;
      e.mem.billiard = true;
      const pain = (b: typeof e) => Math.round((b.hpMax ?? 300) * (b.wallDmg ?? 0.06) * 0.5);
      for (const b of [e, o]) b.applyHit({ x0: b.x - 1, x1: b.x + 1, z0: 0, z1: 400, y: b.y, dy: 999, attackId: newAttackId(), dmg: pain(b), react: 'down', dir: (b.x >= e.x ? 1 : -1) as 1 | -1, push: 8, lift: 8, stop: 4, strength: 3 }, w);
      w.shake(4, 3);
    }
  }

  /** 전투 자세(무기 꺼냄 포함)로 있다가 가까이(700px) 적이 없고 공격·방어 키를 안 누른 채 5초가 지나면
   * 평상 대기로 돌아온다: 무기부터 넣고, 1.5초 뒤 자세를 푼다 (사용자 2026-10-25). 걷기는 상관없다 */
  private calmT = 0;
  private calmHold = false;
  private calmStep(dt: number) {
    const P = this.core.P;
    const acting = [...this.heldNames].some((n) => !['left', 'right', 'up', 'down', 'run'].includes(n));
    const near = this.targets().some((t) => Math.abs(t.x - this.x) < 700);
    if (acting || near || !(P.combat || P.armed)) { this.calmT = 0; this.calmHold = false; return; }
    if (P.mode !== 'ground') { if (!this.calmHold) this.calmT = 0; return; } // 무기 넣는 동작 중에는 시계를 이어 간다
    this.calmT += dt;
    if (this.calmT < 5) return;
    if (P.armed) { this.core.onPress('weapon'); this.calmT = 3.5; this.calmHold = true; return; }
    this.calmT = 0; this.calmHold = false;
    this.core.onPress('combat');
  }

  /** 상태 효과 시간·피해 (엔진 틱마다). 지속 피해로는 쓰러지지 않는다(1 남김). 오염은 최대 체력을 줄인다 */
  private statusStep(world: WorldView, dt: number) {
    if (!this.status.list.length) return;
    const P = this.core.P;
    const dmg = this.status.step(dt, { maxHp: this.hpMax, running: this.running, blocking: P.mode === 'block' });
    if (dmg > 0 && this.hp > 1) this.hp = Math.max(1, this.hp - dmg);
    const cap = this.hpMax * this.status.maxHpRatio();
    if (this.hp > cap) this.hp = cap;
    void world;
  }

  private spendGuard(n: number) {
    this.guard = Math.max(0, this.guard - n);
    this.guardWait = 0.8;
    this.guardIdle = 0;
    if (this.guard <= 0) this.guardBroken = true;
  }

  /** 마지막으로 막아낸 뒤 0.8초가 지나면 초당 35씩 찬다 (막는 중이어도) */
  private guardStep(dt: number) {
    this.guardIdle += dt;
    if (this.guardWait > 0) { this.guardWait -= dt; return; }
    this.guard = Math.min(100, this.guard + 35 * dt);
    if (this.guardBroken && this.guard >= 40) this.guardBroken = false;
  }

  private sync() {
    const P = this.core.P;
    this.x = P.x; this.y = P.y; this.z = P.z;
    this.px = this.x; this.py = this.y; this.pz = this.z; // 보간 없이 지금 자리 (장마다 움직인다)
    this.synced.x = this.x; this.synced.y = this.y;
    this.dir = P.face > 0 ? 1 : -1;
    // 엔진·아이템이 게이지를 바꿨으면(각성제 등) 먼저 코어 필살 게이지에 넘긴다 (코어 값으로 덮어써서 아이템이 헛돌던 문제)
    if (this.gauge !== this.gaugeSeen) P.sp = Math.max(0, Math.min(100, this.gauge));
    this.gauge = this.gaugeSeen = P.sp;
    this.running = this.core.P.mode === 'ground' && this.heldNames.has('run');
  }

  /* ───────── 그리기 (render.ts가 부른다) ───────── */

  private drawUnder(ctx: CanvasRenderingContext2D, camX: number) {
    this.core.frameView({ x0: camX, lane: this.world?.lane ?? [440, 669] });
    ctx.save(); ctx.translate(-camX, 0); this.core.drawUnder(ctx); this.drawReward(ctx); ctx.restore();
  }
  /** 바닥 보상 카드 (코드 그림: 도트 카드 + 테두리 등급 색 + 빛, 반짝임은 공용 이펙트 item_sparkle). PixelLab 카드 그림이 생기면 여기만 바꾼다 */
  private drawReward(ctx: CanvasRenderingContext2D) {
    const r = this.reward;
    if (!r) return;
    if (!this.perks.active) { this.reward = null; return; }   // 판이 끝나면(죽음·복귀·귀환) 사라짐
    r.t += 1 / 60;
    const k = spr(r.y) * CHAR_K, drop = Math.max(0, 1 - r.t * 3), bob = Math.sin(r.t * 3) * 4 * k;
    const cx = Math.round(r.x), cy = Math.round(r.y - (46 + drop * 60) * k - bob);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, r.y, 22 * k, 6 * k, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46 * k); g.addColorStop(0, r.color + 'aa'); g.addColorStop(1, r.color + '00');
    ctx.fillStyle = g; ctx.fillRect(cx - 46 * k, cy - 46 * k, 92 * k, 92 * k);
    const w = Math.round(22 * k), h = Math.round(30 * k), b = Math.max(2, Math.round(3 * k));
    ctx.fillStyle = '#000'; ctx.fillRect(cx - w / 2 - 1, cy - h / 2 - 1, w + 2, h + 2);
    ctx.fillStyle = r.color; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.fillStyle = '#16181c'; ctx.fillRect(cx - w / 2 + b, cy - h / 2 + b, w - b * 2, h - b * 2);
    ctx.fillStyle = r.color; ctx.fillRect(cx - 2 * k, cy - 6 * k, 4 * k, 8 * k); ctx.fillRect(cx - 2 * k, cy + 4 * k, 4 * k, 3 * k);
    if (this.rewardNear()) { ctx.font = pfont(16).f; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#f2e3b0'; ctx.strokeText('E 보상', cx, cy - h / 2 - 10); ctx.fillText('E 보상', cx, cy - h / 2 - 10); }
    ctx.restore();
    if (Math.floor(r.t * 2) !== Math.floor((r.t - 1 / 60) * 2)) this.core.perkApi.vfx('item_sparkle', cx + (Math.random() - 0.5) * 20, cy, 2 * k);
  }
  /** 몸 (x,y = 화면 좌표 발 자리: 보간된 값이라 테스트룸 P 대신 이것을 쓴다) */
  drawSelf(ctx: CanvasRenderingContext2D, camX: number) {
    ctx.save(); ctx.translate(-camX, 0); ctx.imageSmoothingEnabled = false; this.core.drawBody(ctx); ctx.restore();
  }
  drawFxLayer(ctx: CanvasRenderingContext2D, camX: number) {
    this.core.frameView({ x0: camX, lane: this.world?.lane ?? [440, 669] });
    ctx.save(); ctx.translate(-camX, 0); ctx.imageSmoothingEnabled = false; this.core.drawFxLayer(ctx); ctx.restore();
  }
  drawScreen(ctx: CanvasRenderingContext2D) {
    this.core.drawScreen(ctx);
  }
}
