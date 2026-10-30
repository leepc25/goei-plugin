// 퍽 효과 (docs/설계_퍽_목록_3판.md): 가진 퍽·특성을 수치로 합치고, 전투 사건(맞힘·처치·회피·막기·피격·착지·사격·기술·방)에 효과를 낸다.
// 수치 퍽은 게터로(엔진이 읽음), 사건 퍽은 훅으로. 피해 보너스는 더하고(1 + 합), 받는 피해 감소는 곱한다(1장 7항).
// 엔진 쪽 손잡이(PerkHost)는 fighter/player.ts 가 코어(fighter/core.ts perkApi)와 몸을 묶어 넘긴다. 이 파일은 그림을 모른다.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PERK_TEXT } from './defs.gen';
import { STATUS_NUM, type DebuffKind, type StatusSet } from '../combat/status';
import type { Kit } from './rules';

/** 맞힘 출처 */
export type HitSrc = 'light' | 'heavy' | 'slide' | 'jump' | 'shot' | 'skill' | 'charge' | 'super' | 'perk' | 'other';
const MELEE = new Set<HitSrc>(['light', 'heavy', 'slide', 'jump']);
const TECH = new Set<HitSrc>(['skill', 'charge', 'super']);

/** 맞힘 하나 (코어 damageTarget 이 만든다) */
export interface PerkCtx {
  /** 코어 표적 대리 (x·y·z·mark·bindT·stunT·stag·juggle·body) */
  t: any;
  body: any;
  src: HitSrc;
  /** 약공 몇 타째(1~3), 마지막 타면 last */
  step: number;
  last: boolean;
  kind: string;
  dmg: number;
  /** 퍽이 일으킨 피해의 이름 (연쇄 막기) */
  tag?: string;
  /** 폭발 연쇄 깊이 */
  depth?: number;
  /** 충전 단계·최대 단계인가 */
  lv?: number;
  maxLv?: boolean;
  thrown?: boolean;
  // pre 가 채움
  critAdd: number;
  forceCrit: boolean;
  critDmgAdd: number;
  kill?: boolean;
  // post 때
  crit?: boolean;
  killed?: boolean;
  guarded?: boolean;
  hpBefore?: number;
}

export interface Boom { x: number; gy: number; r: number; dmg: number | ((t: any) => number); kind: string; tag: string; depth?: number; style?: 'blast' | 'shock' | 'heat' | 'none'; skip?: any; ail?: [DebuffKind, number] }

/** 엔진 손잡이 */
export interface PerkHost {
  kit: Kit;
  /** 코어 상태 (x·y·z·face·t·mode·dodgeN…) */
  P: any;
  me: { hp: number; hpMax: number; baseHp: number; shield: number; shieldMax: number; x: number; y: number };
  foes(): any[];
  hit(t: any, dmg: number, kind: string, tag: string, depth?: number): { killed?: boolean } | void;
  boom(b: Boom): void;
  status(body: any, k: DebuffKind, s: number, mul?: number): void;
  statusOf(body: any): StatusSet | null;
  mark(t: any, s: number): void;
  bind(t: any, s: number): void;
  stun(t: any, s: number): void;
  later(s: number, fn: () => void): void;
  text(x: number, y: number, v: string): void;
  ghost(ids: string[], mul: number): void;
  replaySkill(mul: number): void;
  moveBody(body: any, dx: number): void;
  bounds(): [number, number];
  isDown(body: any): boolean;
  isStunned(t: any): boolean;
  isElite(body: any): boolean;
  setHpMax(v: number): void;
  addSp(v: number): void;
  gainDodge(): void;
  resetSkillCd(): void;
}

/** 미끼 잔상: 인물 AI 적이 이 자리를 노린다 (fighter/ai.ts) */
export const perkDecoy = { x: 0, y: 0, until: -1 };
/** 혼란 적의 공격이 다른 적에게도 (제 편 때리기, fighter/ai.ts·player.ts) */
export const perkWorld = { friendlyFire: false };

const ail = (k: string) => k as DebuffKind;
const RANK = new Map(PERK_TEXT.map((p) => [p.name, p.rank]));

export class PerkRun {
  ranks = new Map<string, number>();
  traits = new Set<string>();
  host: PerkHost | null = null;
  /** 쌓임 계수 */
  n: Record<string, number> = {};
  /** 대상별 기억 (재발동 간격·계수) */
  private per = new WeakMap<object, Record<string, number>>();
  /** 방마다 1회 */
  private roomUsed = new Set<string>();
  /** 괴이 한 번에 1회 */
  private runUsed = new Set<string>();
  private time = 0;
  private roomT = 0;
  private lastKillT = -99;
  private lastHurtT = -99;
  private ringDmg = 0;
  private blockAt = -99;
  private blockPress = -99;
  private dodgeAt = -99;
  private dodgeEndAt = -99;
  private dodgeFrom: { x: number; y: number } | null = null;
  private dodgeHit = new Set<object>();
  /** 회피 시작 때 상대가 어느 쪽에 있었나 (꿰뚫는 회피: 쪽이 바뀌면 통과) */
  private dodgeSide = new Map<object, number>();
  private comboHits: Record<string, boolean> = {};
  private shots = 0;
  private shotHits = 0;
  private bombsThisDodge = 0;
  private armorRefillAt = -1;
  private killWindow = 0;
  private crisisUntil = -1;
  /** 바뀌었을 때 화면(시험장·창)이 다시 그린다 */
  version = 0;

  r(name: string): number { return this.ranks.get(name) ?? 0; }
  has(name: string): boolean { return this.ranks.has(name) || this.traits.has(name); }
  private get T() { return this.time; }

  /* ───────── 얻기·잃기 ───────── */
  add(name: string): void {
    if (name === '응급 치료') { const h = this.host; if (h) h.me.hp = Math.min(h.me.hpMax, h.me.hp + h.me.hpMax * 0.3); return; }
    this.ranks.set(name, Math.min(RANK.get(name) ?? 1, this.r(name) + 1));
    this.changed();
  }
  addTrait(name: string): void { this.traits.add(name); this.changed(); }
  remove(name: string): void { if (!this.ranks.delete(name)) this.traits.delete(name); this.changed(); }
  /** 죽거나 괴이를 나오면 다 사라진다 */
  reset(): void {
    this.ranks.clear(); this.traits.clear(); this.n = {}; this.runUsed.clear(); this.roomUsed.clear();
    this.changed();
  }
  private changed() { this.version++; this.applyHpMax(); }

  /* ───────── 수치 (엔진이 읽음) ───────── */
  /** 최대 체력 배율 */
  hpMul(): number {
    return (1 + 0.08 * this.r('튼튼한 몸')) * (this.traits.has('유리 대포') ? 0.7 : 1) * (this.traits.has('경량화') ? 0.85 : 1) * (1 + 0.02 * Math.min(6, Math.floor((this.n.hunt ?? 0) / 10)) * (this.has('사냥 기록') ? 1 : 0));
  }
  private applyHpMax() { const h = this.host; if (!h) return; const v = Math.round(h.me.baseHp * this.hpMul()); if (v !== h.me.hpMax) { const ratio = h.me.hp / h.me.hpMax; h.setHpMax(v); h.me.hp = Math.min(v, Math.max(1, Math.round(v * ratio))); } }
  /** 받는 피해 배율 */
  takenMul(): number {
    const h = this.host;
    const low = !!h && h.me.hp <= h.me.hpMax * 0.3;
    return (this.T < this.crisisUntil ? 0.5 : 1) * (1 - 0.05 * this.r('두꺼운 가죽')) * (this.traits.has('철벽') ? 0.75 : 1) * (this.traits.has('무모함') ? 1.15 : 1) * (this.traits.has('탐욕') ? 1.1 : 1) * (low && this.has('배수진') ? 0.85 : 1);
  }
  /** 걷기·달리기 */
  walkMul(): number { return (1 + 0.06 * this.r('가벼운 발')) * (this.traits.has('철벽') ? 0.85 : 1) * (this.traits.has('경량화') ? 1.2 : 1) * (this.traits.has('겁쟁이') && this.T - this.dodgeEndAt < 1 ? 1.3 : 1); }
  runMul(): number { return 1 + 0.08 * this.r('가벼운 발'); }
  dodgeMax(): number { return 2 + this.r('연속 회피') + (this.traits.has('경량화') ? 1 : 0); }
  dodgeCd(): number { return Math.max(0.3, 0.8 - 0.15 * this.r('회피 충전 단축')); }
  dodgeInv(): number { return 0.3 + 0.05 * this.r('무적 회피') + (this.traits.has('겁쟁이') ? 0.1 : 0); }
  dodgeLen(): number { return (1 + 0.2 * this.r('긴 회피')) * (this.traits.has('무거운 장비') ? 0.7 : 1); }
  maxJumps(): number { return (this.has('3단 점프') ? 3 : 2) - (this.traits.has('무거운 장비') ? 1 : 0); }
  airMul(): number { return this.has('3단 점프') ? 1.4 : 1; }
  /** 약공·강공 동작 빠르기 (1 = 그대로, 클수록 빠름) */
  atkSpd(): number {
    const h = this.host;
    return (1 + 0.06 * this.r('빠른 손놀림')) * (1 + 0.03 * Math.min(5, Math.floor((this.n.combo ?? 0) / 10)) * (this.has('콤보 고조') ? 1 : 0)) * (this.traits.has('광전사') && h && h.me.hp <= h.me.hpMax * 0.5 ? 1.1 : 1);
  }
  slideMul(): number { return 1 + 0.15 * this.r('미끄럼 숙련'); }
  heavyRange(): number { return 1 + 0.2 * this.r('넓은 휘두르기'); }
  shotCdMul(): number { return (1 - 0.1 * this.r('빠른 방아쇠')) * (this.traits.has('난사') ? 0.7 : 1); }
  heatMul(): number { return 1 / (1 + 0.2 * this.r('냉각 장치')); }
  overCut(): number { return 0.5 * this.r('냉각 장치') + (this.has('과열 방출') ? 0.8 : 0); }
  noShoot(): boolean { return this.traits.has('총 버림'); }
  skillCdMul(): number { return (1 - 0.1 * this.r('고유기 숙련')) * (this.traits.has('과충전') ? 1.3 : 1); }
  skillCharges(): number { return this.has('고유기 2회') ? 2 : 1; }
  chargeMul(): number { return 1 - 0.15 * this.r('충전 단축'); }
  spMul(): number { return (1 + 0.12 * this.r('필살 충전')) * (this.traits.has('과충전') ? 1.4 : 1); }
  hurtSp(): number { return this.has('고통 증폭') ? 2 : 1; }
  guardMul(): number { return 1 + 0.25 * this.r('가드 강화'); }
  blockChip(): number { return this.has('완전 방어') ? 0 : 0.1; }
  noKnock(): boolean { return this.has('다운 무시') || this.traits.has('무거운 장비') || (this.has('방어막') && (this.host?.me.shield ?? 0) > 0); }
  keepCharge(): boolean { return this.has('수술 여섯 시간째'); }
  ukemi(): boolean { return this.has('낙법'); }
  /** 내가 거는 상태 지속 */
  outDur(k: DebuffKind): number { return k === 'taint' ? 1 : (1 + 0.3 * this.r('지속 연장')) * (this.traits.has('저주받은 손') ? 1.5 : 1); }
  /** 내가 받는 상태 지속 */
  inDur(): number { return (1 - 0.2 * this.r('내성')) * (this.traits.has('저주받은 손') ? 1.5 : 1); }
  taintPer(): number { return Math.max(0.05, STATUS_NUM.taintPerStack - 0.05 * this.r('내성')); }
  mindGuard(): boolean { return this.has('정신 방벽'); }
  bleedMul(): number { return 1 + 0.3 * this.r('깊은 상처'); }
  critBonus(): number { return (this.traits.has('도박꾼') ? 0.15 : 0) + 0.01 * Math.min(10, this.n.close ?? 0); }
  critDmgAdd(): number { return this.traits.has('도박꾼') ? 0.5 : 0; }
  /** 규정상 이렇게 해도 돼: 보상 후보 다시 뽑기 (괴이 한 번에 2회) */
  rerollsLeft(): number { return this.has('규정상 이렇게 해도 돼') ? Math.max(0, 2 - (this.n.rerolls ?? 0)) : 0; }
  useReroll(): void { this.n.rerolls = (this.n.rerolls ?? 0) + 1; }
  /** 방 보상 후보 수 */
  offers(): number { return this.traits.has('탐욕') ? 4 : 3; }

  /** 쌓임 표시 */
  stacks(): { name: string; v: number; max: number }[] {
    const out: { name: string; v: number; max: number }[] = [];
    const put = (name: string, key: string, max: number) => { if (this.has(name)) out.push({ name, v: Math.min(max, this.n[key] ?? 0), max }); };
    put('연속 처치', 'chain', 5); put('무피격', 'clean', 10); put('사냥 기록', 'hunt', 60); put('피의 저금통', 'bank', 8);
    put('아슬아슬', 'close', 10); put('콤보 고조', 'combo', 50); put('쌓인 울분', 'rage', 5); put('현장 경험', 'rooms', 10);
    put('탄피 모으기', 'shells', 20); put('되갚기', 'payback', 5);
    return out;
  }

  /* ───────── 대상별 기억 ───────── */
  private mem(o: object): Record<string, number> { let m = this.per.get(o); if (!m) this.per.set(o, (m = {})); return m; }
  /** 같은 대상 재발동 간격 */
  private ready(o: object, key: string, sec: number): boolean { const m = this.mem(o); if (this.T - (m[key] ?? -99) < sec) return false; m[key] = this.T; return true; }
  private st(body: any): StatusSet | null { return this.host?.statusOf(body) ?? null; }
  private ailCount(c: PerkCtx): number { const s = this.st(c.body); return (s?.list.length ?? 0) + (c.t.mark > 0 ? 1 : 0) + (c.t.bindT > 0 ? 1 : 0); }
  private dist(a: any, b: any): number { return Math.hypot(a.x - b.x, (a.y - b.y) * 1.6); }
  private around(t: any, r: number): any[] { return (this.host?.foes() ?? []).filter((q) => q !== t && q.body !== t.body && this.dist(q, t) < r); }

  /* ───────── 맞히기 전: 피해 보너스·치명·반응 바꾸기 ───────── */
  pre(c: PerkCtx): void {
    const h = this.host; if (!h) return;
    const s = this.st(c.body);
    const melee = MELEE.has(c.src), shot = c.src === 'shot', tech = TECH.has(c.src);
    const hpR = c.body.hpMax ? c.body.hp / c.body.hpMax : 1;
    // 등 뒤: 대상이 나를 등지고 있음. 공포(겁먹은 등)·혼란(혼란 틈)·표식(사냥꾼의 눈)이면 어느 쪽이든 등 뒤
    const faceDir = c.body.dir ?? c.body.core?.P?.face ?? 0;
    let back = faceDir !== 0 && Math.sign(c.t.x - h.P.x) === faceDir;
    if ((this.has('겁먹은 등') && s?.has('fear')) || (this.has('혼란 틈') && s?.has('confuse')) || (this.has('사냥꾼의 눈') && c.t.mark > 0)) back = true;
    let add = 0;
    const R = (n: string) => this.r(n);
    if (c.src === 'light') add += 0.08 * R('단련된 주먹') + (c.last ? 0.08 * R('단련된 주먹') : 0);
    if (c.src === 'slide') add += 0.2 * R('미끄럼 숙련');
    if (c.src === 'heavy') add += 0.12 * R('무거운 한 방');
    if (melee && c.t.z > 4) add += 0.15 * R('공중 사냥');
    if (melee && hpR <= 0.2) add += 0.25 * R('마무리 일격');
    if (shot) add += 0.08 * R('정조준') + (c.thrown ? 0.12 * R('투척 강화') : 0);
    if (shot && R('거리 감각')) { const d = Math.abs(c.t.x - h.P.x); if (d < 200 || d > 640) add += 0.12 * R('거리 감각'); }
    if (back) add += 0.15 * R('그림자 습격');
    if (c.hpBefore != null && c.hpBefore >= (c.body.hpMax ?? 1)) add += 0.2 * R('첫 일격');
    if (this.has('배수진') && h.me.hp <= h.me.hpMax * 0.3) add += 0.25;
    if (h.isElite(c.body)) add += 0.25 * R('정예 사냥');
    if (this.has('일대일') && h.foes().length === 1) add += 0.2;
    if (h.isDown(c.body)) add += 0.2 * R('앉게');
    if (R('약점 찌르기') && this.ailCount(c) > 0) add += 0.1 * R('약점 찌르기');
    if (this.has('겁먹은 등') && s?.has('fear')) add += 0.15;
    if (c.src === 'skill') add += 0.12 * R('고유기 강화') + (this.has('피의 저금통') ? 0.05 * Math.min(8, this.n.bank ?? 0) : 0);
    if (c.src === 'charge') add += 0.12 * R('충전 강화');
    if (c.src === 'super') add += 0.15 * R('필살 강화');
    if (c.src === 'heavy' && this.has('쌓인 울분')) add += 0.12 * Math.min(5, this.n.rage ?? 0);
    if (this.has('연속 처치')) add += 0.05 * Math.min(5, this.n.chain ?? 0);
    if (this.has('무피격')) add += 0.02 * Math.min(10, this.n.clean ?? 0);
    if (this.has('현장 경험')) add += 0.015 * Math.min(10, this.n.rooms ?? 0);
    if (melee && this.has('되갚기')) add += 0.03 * Math.min(5, this.n.payback ?? 0);
    if (melee && this.has('일부러 비좁게')) { const [b0, b1] = h.bounds(); const wd = Math.min(h.P.x - b0, b1 - h.P.x); add += wd < 150 ? 0.3 : wd > 300 ? -0.1 : 0; }
    // 특성
    if (this.traits.has('무모함')) add += 0.2;
    if (this.traits.has('유리 대포')) add += 0.35;
    if (this.traits.has('한 방 주의')) add += c.src === 'heavy' || c.src === 'charge' ? 0.4 : c.src === 'light' ? -0.3 : 0;
    if (this.traits.has('광전사') && h.me.hp <= h.me.hpMax * 0.5) add += 0.3;
    if (this.traits.has('되감는 시계') && c.src === 'skill') add -= 0.2;
    if (this.traits.has('피의 대가') && tech) add += 0.35;
    if (this.traits.has('겁쟁이') && melee) add -= 0.15;
    if (this.traits.has('총 버림') && melee) add += 0.3;
    if (this.traits.has('난사') && shot) add -= 0.2;
    let dmg = c.dmg * Math.max(0.1, 1 + add);
    if (this.has('혼돈 변수') && tech) dmg *= 0.7 + Math.random() * 0.8;
    // 되받아치기: 막기 성공 뒤 0.5초 안 약공 → 강공 피해·휘청
    if (c.src === 'light' && this.has('되받아치기') && this.T - this.blockAt < 0.5) { dmg *= 2.2; c.kind = 'heavy'; this.blockAt = -99; }
    // 반응 바꾸기
    if (c.src === 'slide' && this.has('발목 걸기')) c.kind = 'down';
    if (shot && this.has('자세 무너뜨리기') && (c.t.stunT > 0 || c.body.state === 'hurt')) c.kind = 'down';
    if (c.src === 'heavy' && this.has('두통 울림') && s?.has('headache') && this.ready(c.body, 'ring', 6)) { c.kind = 'stun'; h.later(0, () => h.stun(c.t, 0.8)); }
    // 입막음 처형: 침묵 걸린 적이 체력 25% 이하면 강공이 바로 쓰러뜨림 (정예는 피해 +50%)
    if (c.src === 'heavy' && this.has('입막음 처형') && s?.has('silence') && hpR <= 0.25) { if (h.isElite(c.body)) dmg *= 1.5; else c.kill = true; }
    // 치명
    c.critAdd += this.critBonus() + (shot ? 0.05 * R('급소 겨냥') : 0) + (shot && this.has('묶인 과녁') && c.t.bindT > 0 ? 0.4 : 0);
    c.critDmgAdd += this.critDmgAdd();
    if (this.has('기절 추격') && h.isStunned(c.t) && this.ready(c.body, 'stunCrit', 1.5)) c.forceCrit = true;
    if (shot && this.has('틈새 사격') && this.T - this.dodgeEndAt < 1 && !this.n.gapUsed) { c.forceCrit = true; this.n.gapUsed = 1; }
    // 도박꾼: 치명이 아닌 공격 −10% (치명이면 post 에서 되돌림 없이 치명 배율이 덮음)
    if (this.traits.has('도박꾼')) dmg *= 0.9;
    c.dmg = dmg;
  }

  /* ───────── 맞힌 뒤: 상태 걸기·터뜨리기·계수 ───────── */
  post(c: PerkCtx): void {
    const h = this.host; if (!h || c.src === 'perk') { if (c.killed) this.kill(c); return; }
    if (c.guarded) return;
    const s = this.st(c.body);
    const put = (k: DebuffKind, sec: number, mul?: number) => h.status(c.body, k, sec * this.outDur(k), mul);
    const melee = MELEE.has(c.src);
    // 콤보 계수 (콤보 고조)
    if (melee) { this.n.combo = (this.n.combo ?? 0) + 1; this.killWindow = 0; }
    // 약공 3타
    if (c.src === 'light') {
      this.comboHits[c.step] = true;
      if (c.last) {
        if (this.has('두통 유발')) put('headache', 4);
        if (this.traits.has('저주받은 손')) { const ks: DebuffKind[] = ['bleed', 'taint', 'headache', 'confuse', 'fear', 'slow', 'silence']; put(ks[Math.floor(Math.random() * ks.length)], 3); }
        if (this.has('오염 손톱')) { const m = this.mem(c.body); m.claw = (m.claw ?? 0) + 1; if (m.claw === 3) put('taint', 1); }
        if (this.has('따라 치는 그림자') && this.comboHits[1] && this.comboHits[2]) h.later(0.4, () => h.ghost(['9', '10', '11'], 0.3));
        if (this.has('그림자 분대') && this.comboHits[1] && this.comboHits[2]) this.n.squadUntil = this.T + 3.4;
        if (this.has('충격 주먹')) this.shockFist(c);
        this.comboHits = {};
      }
    }
    if (c.src === 'slide' && this.has('발목 걸기')) put('slow', 2);
    if (c.src === 'heavy') {
      if (this.has('출혈 일격') && this.ready(c.body, 'bleedHit', 2)) put('bleed', 6, this.bleedMul());
      const faceDir = c.body.dir ?? c.body.core?.P?.face ?? 0;
      if (this.has('족쇄 차기') && faceDir && Math.sign(c.t.x - h.P.x) === faceDir && this.ready(c.body, 'shackle', 5)) h.bind(c.t, 1.5 * this.outDur('slow'));
      if (this.has('쌓인 울분')) this.n.rage = 0;
    }
    if (c.src === 'shot') {
      this.shotHits++;
      if (this.has('표식탄') && this.shotHits % 4 === 0) h.mark(c.t, 3 + (this.has('사냥꾼의 눈') ? 2 : 0));
      if (this.has('겁주기') && Math.random() < 0.2 && this.ready(c.body, 'scare', 6)) put('fear', 2);
      if (this.has('폭발탄') && this.shotHits % 5 === 0) h.boom({ x: c.t.x, gy: c.t.y, r: 150, dmg: 66, kind: 'heavy', tag: 'boom', depth: 0, style: 'blast' });
    }
    if (c.src === 'charge' && c.maxLv && this.has('혼란 충전')) put('confuse', 2);
    if (c.src === 'skill') {
      if (this.has('둔화 고유기')) put('slow', 2);
      if (this.has('진조의 피')) h.me.hp = Math.min(h.me.hpMax, h.me.hp + c.dmg * 0.08 * this.r('진조의 피'));
      if (this.has('피의 저금통') && (this.n.bank ?? 0) > 0 && !this.n.bankSpend) { this.n.bankSpend = 1; h.later(1, () => { this.n.bank = 0; this.n.bankSpend = 0; }); }
    }
    if (c.src === 'super' && this.has('침묵의 필살')) put('silence', 4);
    // 조합
    if (s?.has('bleed') && this.has('피 터뜨리기') && (c.src === 'heavy' || (c.src === 'charge' && c.maxLv))) this.burstBleed(c, s);
    if (s?.has('slow') && this.has('얼어붙은 발') && ['launch', 'down', 'blow', 'spike'].includes(c.kind)) { h.hit(c.t, (c.body.hpMax ?? 1000) * 0.06, 'light', 'frozen'); this.wakeLate(c.body, 0.5); }
    if (s?.stacks('taint') && c.src === 'super' && this.has('오염 연소') && this.ready(c.body, 'burn', 1.5)) { const n = s.stacks('taint'); h.hit(c.t, (c.body.hpMax ?? 1000) * 0.1 * n, 'heavy', 'burn'); s.cure('taint'); }
    if (this.has('바닥 차갑지?') && ['launch', 'down', 'blow', 'spike'].includes(c.kind)) this.wakeLate(c.body, 0.6);
    if (this.has('공중 사냥') && this.r('공중 사냥') >= 2) c.body.maxLaunch = 3;
    if (this.has('벽꽝 강화')) c.body.wallDmg = 0.15;
    if (this.has('보이지 않는 사슬') && c.t.bindT > 0) for (const q of h.foes()) if (q !== c.t && q.bindT > 0) h.hit(q, c.dmg * 0.25, 'light', 'chain');
    if (c.crit) {
      if (this.has('급소 간파')) h.mark(c.t, 3 + (this.has('사냥꾼의 눈') ? 2 : 0));
      if (this.has('표식 전염') && c.t.mark > 0) { const q = this.around(c.t, 300)[0]; if (q) h.mark(q, 3); }
    }
    if (this.has('혼란 틈') && s?.has('confuse') && this.ready(c.body, 'confTip', 4)) put('slow', 1);
    if (c.killed) this.kill(c);
  }

  private wakeLate(body: any, sec: number) {
    if (body.mem) body.wakeExtra = (body.wakeExtra ?? 0) + Math.round(sec * 30);
    else if (body.core?.P) body.core.P.wakeExtra = (body.core.P.wakeExtra ?? 0) + sec;
  }
  /** 피 터뜨리기: 남은 출혈 피해를 한꺼번에 ×1.3, 출혈 풀림. 피바다면 둘레 2m에 출혈이 튐 */
  private burstBleed(c: PerkCtx, s: StatusSet) {
    const h = this.host!;
    const b = s.list.find((x) => x.kind === 'bleed');
    if (!b) return;
    const left = (c.body.hpMax ?? 1000) * STATUS_NUM.bleedPerSec * b.stacks * Math.min(b.t, 12) * (b.mul ?? 1) * 1.3;
    s.cure('bleed');
    h.hit(c.t, left, 'heavy', 'burst');
    if (this.has('피바다')) for (const q of this.around(c.t, 200)) h.status(q.body, 'bleed', 6 * this.outDur('bleed'), this.bleedMul());
  }
  /** 충격 주먹: 3타 끝에 앞으로 충격파(관통, 3타 피해 60% + 움찔) */
  private shockFist(c: PerkCtx) {
    const h = this.host!;
    const dir = h.P.face, x0 = h.P.x;
    for (const q of h.foes()) { const dx = (q.x - x0) * dir; if (dx > 0 && dx < 420 && Math.abs(q.y - h.P.y) < 70 && q !== c.t) h.hit(q, c.dmg * 0.6, 'light', 'fist'); }
    h.boom({ x: x0 + dir * 200, gy: h.P.y, r: 0, dmg: 0, kind: 'light', tag: 'fist', style: 'shock' });
  }

  /** 처치 */
  kill(c: PerkCtx): void {
    const h = this.host; if (!h) return;
    const s = this.st(c.body);
    const elite = h.isElite(c.body);
    this.n.chain = Math.min(5, (this.n.chain ?? 0) + 1); this.lastKillT = this.T;
    this.n.hunt = (this.n.hunt ?? 0) + 1; if ((this.n.hunt % 10) === 0) this.applyHpMax();
    if (this.has('피의 저금통')) this.n.bank = Math.min(8, (this.n.bank ?? 0) + 1);
    if (this.traits.has('피에 굶주림')) h.me.hp = Math.min(h.me.hpMax, h.me.hp + h.me.hpMax * 0.03);
    const isBoom = c.tag === 'corpse' || c.tag === 'boom' || c.tag === 'dodgebomb' || c.tag === 'heat';
    const depth = c.depth ?? 0;
    if (this.has('시체 폭발') && (!isBoom || (this.has('연쇄 폭파') && depth < 3))) {
      const mx = c.body.hpMax ?? 1000, x = c.t.x, gy = c.t.y;
      h.later(0.4, () => h.boom({ x, gy, r: 200, dmg: mx * (elite ? 0.06 : 0.12), kind: 'heavy', tag: 'corpse', depth: depth + 1, style: 'blast', skip: c.body }));
    }
    if (this.has('위협')) for (const q of this.around(c.t, 300)) if (!h.isElite(q.body)) h.status(q.body, 'fear', 1.5 * this.outDur('fear'));
    if (s?.stacks('taint') && this.has('오염 전파')) for (const q of this.around(c.t, this.has('역병') ? 400 : 200)) { h.status(q.body, 'taint', 1); if (this.has('역병')) h.status(q.body, 'slow', 2 * this.outDur('slow')); }
    if (s?.has('bleed') && this.has('피바다')) for (const q of this.around(c.t, 200)) h.status(q.body, 'bleed', 6 * this.outDur('bleed'), this.bleedMul());
    if (s && s.list.length >= 2 && this.has('상처 옮기기')) { const q = this.around(c.t, 250)[0]; if (q) for (const a of s.list) h.status(q.body, a.kind, Math.max(0.5, (a.t === Infinity ? 6 : a.t) / 2)); }
  }

  /* ───────── 회피 ───────── */
  dodge(): void {
    const h = this.host; if (!h) return;
    this.dodgeAt = this.T; this.dodgeFrom = { x: h.P.x, y: h.P.y }; this.dodgeHit.clear(); this.n.gapUsed = 0;
    this.dodgeSide.clear(); for (const q of h.foes()) this.dodgeSide.set(q.body, Math.sign(q.x - h.P.x));
    if (this.has('회피 폭탄')) { const x = h.P.x, gy = h.P.y; h.later(0.6, () => h.boom({ x, gy, r: 150, dmg: 60, kind: 'heavy', tag: 'dodgebomb', style: 'blast' })); }
    if (this.has('미끼 잔상')) { perkDecoy.x = h.P.x; perkDecoy.y = h.P.y; perkDecoy.until = performance.now() + 1500; }
  }
  /** 회피 중 매 장: 몸을 통과한 적 */
  dodgeTick(): void {
    const h = this.host; if (!h || !this.has('꿰뚫는 회피')) return;
    // 몸에 닿거나(엔진이 몸끼리 밀어내 실제로 겹치지 않을 때가 많음 → 회피 방향으로 붙은 적) 지나쳐 쪽이 바뀌면
    const vx = h.P.dodgeV?.x ?? 0;
    for (const q of h.foes()) if (!this.dodgeHit.has(q.body) && Math.abs(q.y - h.P.y) < 50 && ((Math.abs(q.x - h.P.x) < 120 && Math.sign(q.x - h.P.x) === Math.sign(vx)) || (this.dodgeSide.has(q.body) && Math.sign(q.x - h.P.x) !== this.dodgeSide.get(q.body)))) {
      this.dodgeHit.add(q.body);
      h.hit(q, 60, 'light', 'pierce');
      h.status(q.body, 'slow', 1.5 * this.outDur('slow'));
    }
  }
  dodgeEnd(): void { this.dodgeEndAt = this.T; }
  /** 회피 무적으로 피함. 시작 0.15초 안이면 아슬아슬 */
  evaded(): void { if (this.T - this.dodgeAt < 0.15 && this.has('아슬아슬')) this.n.close = Math.min(10, (this.n.close ?? 0) + 1); }
  /** 회피 무적 중 투사체 → 되돌림(빈틈 없음) */
  reflectOnDodge(): boolean { return this.has('빈틈 없음'); }

  /* ───────── 막기 ───────── */
  blockPressed(): void { this.blockPress = this.T; }
  /** 막기 성공. melee = 근접(때린 적 attacker), dmg = 막은 공격 피해. 돌려줄 투사체면 true */
  blocked(o: { melee: boolean; attacker: any | null; dmg: number }): { reflect: boolean; noDrain: boolean } {
    const h = this.host; if (!h) return { reflect: false, noDrain: false };
    this.blockAt = this.T;
    if (this.has('쌓인 울분')) this.n.rage = Math.min(5, (this.n.rage ?? 0) + 1);
    if (o.melee && o.attacker) {
      const a = o.attacker;
      if (this.has('가시 방패')) h.status(a.body, 'bleed', 4 * this.outDur('bleed'), this.bleedMul());
      if (this.has('혼쭐') && this.ready(a.body, 'scold', 6)) h.status(a.body, 'confuse', 2 * this.outDur('confuse'));
      if (this.has('금품 수수 불가')) h.hit(a, o.dmg * 0.3, 'light', 'bribe');
    }
    const exact = this.T - this.blockPress < 0.2;
    return { reflect: !o.melee && exact && this.has('탄 되받기'), noDrain: !o.melee && this.has('맨손으로 쳐낸다') };
  }
  /** 막기 게이지가 깨짐: 깨지며 터진다면 휘청 대신 충격파 + 0.5초 무적 (방마다 1회) → true */
  guardBreak(): boolean {
    const h = this.host; if (!h || !this.has('깨지며 터진다') || this.roomUsed.has('break')) return false;
    this.roomUsed.add('break');
    h.boom({ x: h.P.x, gy: h.P.y, r: 250, dmg: 20, kind: 'blow', tag: 'break', style: 'shock' });
    h.P.inv = Math.max(h.P.inv, 0.5);
    return true;
  }
  /** 보호막이 깨짐 (반응 장갑) */
  shieldBroke(): void {
    const h = this.host; if (!h || !this.has('반응 장갑')) return;
    h.boom({ x: h.P.x, gy: h.P.y, r: 250, dmg: 20, kind: 'blow', tag: 'armor', style: 'shock' });
    if (!this.roomUsed.has('armorRefill')) { this.roomUsed.add('armorRefill'); this.armorRefillAt = this.T + 20; }
  }

  /* ───────── 맞음 ───────── */
  hurt(dmg: number): void {
    this.lastHurtT = this.T; this.n.clean = 0;
    // 위기 회복: 30% 아래로 넘어가는 순간 25% 회복 + 1초 받는 피해 절반 (방마다 랭크만큼)
    const h = this.host;
    if (h && this.has('위기 회복') && h.me.hp < h.me.hpMax * 0.3 && h.me.hp + dmg >= h.me.hpMax * 0.3 && (this.n.crisis ?? 0) < this.r('위기 회복')) {
      this.n.crisis = (this.n.crisis ?? 0) + 1;
      h.me.hp = Math.min(h.me.hpMax, h.me.hp + h.me.hpMax * 0.25);
      this.crisisUntil = this.T + 1;
      h.text(h.P.x, h.P.y - 260, '위기 회복');
    }
    if (this.has('되갚기')) this.n.payback = Math.min(5, (this.n.payback ?? 0) + 1);
    if (this.has('치유 반지')) this.ringDmg += dmg;
  }
  /** 죽을 한 방. 살려 두면 true */
  lethal(): 'hold' | 'revive' | null {
    const h = this.host; if (!h) return null;
    if (this.has('버티기') && !this.roomUsed.has('hold')) { this.roomUsed.add('hold'); h.me.hp = 1; h.P.inv = Math.max(h.P.inv, 1); h.text(h.P.x, h.P.y - 260, '버티기'); return 'hold'; }
    if (this.has('죽은 채로 있을 수가 없다') && !this.runUsed.has('revive')) {
      this.runUsed.add('revive');
      const lose = [...this.ranks.keys()].filter((n) => n !== '죽은 채로 있을 수가 없다');
      if (lose.length) { const n = lose[Math.floor(Math.random() * lose.length)]; this.ranks.delete(n); h.text(h.P.x, h.P.y - 290, `${n} 잃음`); }
      this.ranks.delete('죽은 채로 있을 수가 없다'); this.changed();
      h.me.hp = 1; h.P.inv = Math.max(h.P.inv, 2.4);
      h.later(2, () => { h.me.hp = Math.round(h.me.hpMax * 0.4); h.text(h.P.x, h.P.y - 260, '일어났다'); });
      return 'revive';
    }
    return null;
  }

  /* ───────── 착지·사격·기술 ───────── */
  land(o: { heavy: boolean; jumps: number }): void {
    const h = this.host; if (!h || !o.heavy || !this.has('내려찍기')) return;
    const meteor = this.has('유성 낙하') && o.jumps >= 3;
    h.boom({ x: h.P.x, gy: h.P.y, r: meteor ? 500 : 250, dmg: 22, kind: meteor ? 'down' : 'heavy', tag: 'slam', style: 'shock' });
  }
  /** 띄운 적이 땅에 닿음 (패대기) */
  enemyLanded(t: any): void {
    const h = this.host; if (!h || !this.has('패대기')) return;
    const mx = t.body.hpMax ?? 1000;
    h.boom({ x: t.x, gy: t.y, r: 200, dmg: mx * 0.06, kind: 'light', tag: 'slam2', style: 'shock', skip: t.body });
  }
  /** 사격 한 발. 강한 한 발이면 true (탄피 모으기) */
  shot(): boolean {
    this.shots++;
    if (!this.has('탄피 모으기')) return false;
    this.n.shells = (this.n.shells ?? 0) + 1;
    if (this.n.shells > 20) { this.n.shells = 0; return true; }
    return false;
  }
  /** 사격 모양: 겹탄(위아래 2발 70%)·관통·도탄·난사(흩어짐)·탄막 반사 */
  shotMods(): { lanes: number[]; pierce: boolean; bounce: boolean; split: boolean; spread: boolean; boomerang: boolean } {
    return { lanes: this.has('겹탄') ? [-36, 36] : [0], pierce: this.has('관통탄'), bounce: this.has('도탄'), split: this.has('탄막 반사'), spread: this.traits.has('난사'), boomerang: this.has('부메랑 투척') };
  }
  reflectSplit(): boolean { return this.has('탄막 반사'); }
  overheat(): void {
    const h = this.host; if (!h || !this.has('과열 방출')) return;
    h.boom({ x: h.P.x, gy: h.P.y, r: 200, dmg: 88, kind: 'blow', tag: 'heat', style: 'heat' });
  }
  skillUse(): void {
    const h = this.host; if (!h) return;
    if (this.has('책상 내려치기')) for (const q of h.foes()) if (this.dist(q, h.P) < 300) h.hit(q, 0, 'light', 'desk');
    if (this.traits.has('되감는 시계') && Math.random() < 0.5) h.later(0.05, () => h.resetSkillCd());
    this.bloodCost();
  }
  chargeUse(): void { this.bloodCost(); }
  superUse(): void { this.bloodCost(); }
  private bloodCost() { const h = this.host; if (h && this.traits.has('피의 대가')) h.me.hp = Math.max(1, h.me.hp - h.me.hpMax * 0.02); }
  superEnd(): void { const h = this.host; if (h && this.has('앙코르')) h.later(0.8, () => h.replaySkill(0.4)); }
  /** 충전을 모으는 동안: 끌어당기는 충전(소용돌이면 5m, 부딪히면 휘청) */
  chargeTick(dt: number): void {
    const h = this.host; if (!h || !this.has('끌어당기는 충전')) return;
    const big = this.has('소용돌이'), r = big ? 500 : 300;
    const pulled: any[] = [];
    for (const q of h.foes()) {
      const dx = q.x - h.P.x;
      if (dx * h.P.face <= 0 || Math.abs(dx) > r || Math.abs(q.y - h.P.y) > 90 || q.bindT > 0 || h.isDown(q.body) || Math.abs(dx) < 70) continue;
      h.moveBody(q.body, -Math.sign(dx) * 60 * dt * (big ? 1.6 : 1));
      pulled.push(q);
    }
    if (big) for (let i = 0; i < pulled.length; i++) for (let j = i + 1; j < pulled.length; j++) {
      const a = pulled[i], b = pulled[j];
      if (Math.abs(a.x - b.x) < 40 && Math.abs(a.y - b.y) < 30 && this.ready(a.body, 'swirl', 1.5)) { h.hit(a, 10, 'heavy', 'swirl'); h.hit(b, 10, 'heavy', 'swirl'); }
    }
  }
  /** 내 약공 하나 (그림자 분대: 잔상이 따라 침) */
  lightStart(id: string): void { const h = this.host; if (h && this.T < (this.n.squadUntil ?? 0)) h.later(0.15, () => h.ghost([id], 0.25)); }

  /* ───────── 방 ───────── */
  roomEnter(): void {
    const h = this.host; if (!h) return;
    this.roomUsed.clear(); this.roomT = 0; this.n.clean = 0; this.n.payback = 0; this.n.crisis = 0; this.armorRefillAt = -1;
    if (this.has('시작 게이지')) h.addSp(20 * this.r('시작 게이지'));
    if (this.has('방어막')) { h.me.shieldMax = h.me.shield = Math.round(h.me.hpMax * 0.1); }
    if (this.traits.has('피에 굶주림')) h.me.hp = Math.max(1, h.me.hp - h.me.hpMax * 0.1);
  }
  roomClear(): void {
    const h = this.host; if (!h) return;
    this.n.rooms = Math.min(10, (this.n.rooms ?? 0) + 1);
    // 단식: 잃은 체력의 절반 (대가: 회복약을 못 씀, engine/itemsLink.ts)
    if (this.traits.has('단식')) h.me.hp = Math.min(h.me.hpMax, h.me.hp + (h.me.hpMax - h.me.hp) * 0.5);
  }
  /** 방 안이 먼저 지친다: 적 공격 간격 배수 */
  enemyGap(): number { if (!this.has('방 안이 먼저 지친다')) return 1; return this.roomT > 30 ? 1 / 0.75 : this.roomT > 15 ? 1 / 0.85 : 1; }

  /** 매 장 */
  tick(dt: number): void {
    const h = this.host; if (!h) return;
    this.time += dt; this.roomT += dt;
    if (this.T - this.lastKillT > 5) this.n.chain = 0;
    if (this.has('무피격') && this.T - this.lastHurtT >= 1) { this.n.clean = Math.min(10, Math.floor(this.T - Math.max(this.lastHurtT, this.T - this.roomT))); }
    if (this.has('치유 반지') && this.ringDmg > 0 && this.T - this.lastHurtT >= 3) { h.me.hp = Math.min(h.me.hpMax, h.me.hp + this.ringDmg * 0.2 * this.r('치유 반지')); this.ringDmg = 0; }
    if (this.armorRefillAt > 0 && this.T >= this.armorRefillAt) { this.armorRefillAt = -1; h.me.shield = h.me.shieldMax; }
    // 콤보가 끊기면(1.5초 동안 근접 명중 없음) 콤보 고조 0
    this.killWindow += dt; if (this.killWindow > 1.5) this.n.combo = 0;
    // 질주 들이받기: 1초 넘게 달리면 몸 앞 판정
    if (this.has('질주 들이받기') && (h.P.runT ?? 0) > 1) for (const q of h.foes()) {
      if ((q.x - h.P.x) * h.P.face > -10 && Math.abs(q.x - h.P.x) < 70 && Math.abs(q.y - h.P.y) < 40 && this.ready(q.body, 'ram', 1)) h.hit(q, 40, 'heavy', 'ram');
    }
    perkWorld.friendlyFire = this.has('제 편 때리기');
  }
}
