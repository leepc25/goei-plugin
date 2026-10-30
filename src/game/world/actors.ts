// 필드 세계 행위자 시뮬 (docs/필드_세계_NPC_설계.md 3·5·6·7·8장).
// 이름 인물: 욕구 + 의무 → 할 일 고르기(needs.ts). 클립이 있는 활동만 켜지고, 없으면 서성이기·장면 오가기.
// 몹: 나올 때마다 성향을 뽑고(mobs.ts), 지나가다 자기 판단으로 사건을 일으킨다(소매치기·시비). 근무형은 근무시간에 자리를 지킨다.
// 소란도는 장면 단위. 경찰·경비는 플레이어 범죄에만 나선다(crime). 화면 밖 장면도 같은 규칙으로 돈다. 생활은 실시간, 시계와 무관.
import { ACTIVITIES, TEMPER, choose, decayNeeds, fullNeeds, onDuty, type Activity, type Needs } from './needs';
import { ARCHETYPES, DROPS, POCKET, inShift, rollTemper, type Post, type Temperament } from './mobs';
import { derive, rollBase, type BaseStats } from '../combat/stats';
import type { Hop, PlaceGraph } from './places';
import { pick, range, type Rng } from './rng';

export type ActorKind = 'named' | 'mob';
/** 활동 클립 → 의자에서 하는 일 (fighter/seats.ts SEATS acts 이름) */
const SEAT_KIND: Record<string, string> = { work: 'type', eat: 'eat', drink: 'drink', rest: 'doze', hobby: 'book', talk: 'talk' };
export interface ActorDef {
  id: string;
  /** 이름표 (몹은 원형 이름) */
  name: string;
  kind: ActorKind;
  /** 행동 부품 (7-1장): needs = 욕구 AI(클립 없으면 roam), roam = 서성이기, transit = 몹 통행, post = 근무형 */
  brain: 'needs' | 'roam' | 'transit' | 'post';
  home: string;
  roam?: string[];
  /** 그림 열쇠 (이름 인물 = 이름, 몹 = 원형·그림 이름) */
  look?: string;
  speed?: number;
  /** 몹 원형 이름 (mobs.ts ARCHETYPES) */
  archetype?: string;
}
export type Act = 'idle' | 'walk' | 'door' | 'do' | 'notice' | 'post' | 'watch' | 'argue' | 'down' | 'gone';
/** 걸어서 닿은 뒤 할 일 */
type Plan = 'none' | 'do' | 'post' | 'exit' | 'steal' | 'harass' | 'chase' | 'patrol' | 'roam-post';

export interface Actor {
  def: ActorDef;
  scene: string;
  /** 지도 의자에 앉아 있음 (i = 장면 의자 번호). 그림은 그 인물 의자 맞춤값으로 (fighter/seats.ts) */
  seat?: { i: number; dir: 'front' | 'side' | 'back'; kind: string; x: number; y: number };
  /** 앉으러 가는 의자 번호 */
  seatPick?: number;
  x: number;
  y: number;
  face: 1 | -1;
  act: Act;
  /** 사람이 읽는 지금 할 일 (관찰 창) */
  doing: string;
  goal: { x: number; y: number } | null;
  route: Hop[];
  /** idle·door·do·notice·watch 남은 초 */
  wait: number;
  plan: Plan;
  /** 걷기 배율 (뛰기·도망) */
  run: number;
  /** 지금 그릴 클립과 시작 시각(생활 초) */
  clip: string;
  clipAt: number;
  /** 머리 위 아이콘 (! ? ♪ … #) */
  icon?: string;
  iconT: number;
  /** 머리 위 말풍선 (대사) */
  say?: string;
  sayT: number;
  // 이름 인물
  needs?: Needs;
  task?: Activity;
  last?: string;
  noticeCd: number;
  // 몹
  temper?: Temperament;
  drunk?: boolean;
  exitAt?: { x: number; y: number };
  target?: string;
  post?: Post;
  postI?: number;
  /** 다음 판단까지 초 (몹 사건 판단) */
  think: number;
  /** 맞은 공격 id (한 공격에 한 번) */
  hitBy?: number;
  /** 몹 몸 (등급 체력, 설계 2-3). 0이 되면 기절 → 일어나 떠난다 */
  hp?: number;
  hpMax?: number;
  /** 힘민체지정 (몹: 생겨날 때 무작위 합 25) */
  base?: BaseStats;
  /** 주머니 돈 (원) */
  pocket?: number;
  /** 그중 훔친 돈 */
  stolen?: number;
  /** 전투 AI 몸(ai-char)으로 싸우는 중: 시뮬이 움직이지도 그리지도 않는다 (engine/modules.ts life.combat) */
  fighting?: boolean;
}

/** 엔진 공격 판정 상자 (contract Hit의 모양만) */
export interface HitBox { x0: number; x1: number; y: number; dy?: number; z0: number; z1: number; attackId: number }

/** 한 장면의 몹 보충 규칙 (6-2장) */
export interface SpawnRule {
  scene: string;
  target: { day: number; night: number };
  refill: [number, number];
  /** 들어오고 나가는 곳 x. 생략하면 양 끝 */
  gates?: number[];
  /** 원형 이름 목록 (뽑기) */
  mix: string[];
  /** 밤(19:30~05시) 원형 목록. 없으면 mix */
  nightMix?: string[];
}

/** 바깥(대사·장부·연출)에 알릴 일 */
export type SimEvent =
  | { kind: 'steal'; scene: string; thief: string; victim: string; x: number }
  | { kind: 'harass'; scene: string; who: string; target: string; x: number }
  | { kind: 'flee'; scene: string; who: string }
  | { kind: 'notice'; scene: string; who: string }
  | { kind: 'police'; scene: string; n: number }
  | { kind: 'shift'; scene: string; who: string; on: boolean }
  | { kind: 'hurt'; scene: string; who: string; named: boolean; faction?: string; x: number; down: boolean }
  /** 기절한 몹이 떨어뜨린 돈 (불량배·취객·소매치기) */
  | { kind: 'drop'; scene: string; who: string; amount: number; stolen: number; x: number };

export interface SimOptions {
  spawns?: SpawnRule[];
  posts?: Post[];
  /** 그 인물(그림 열쇠)에게 그 클립이 있나. 없으면 그 활동은 꺼진다 */
  has?: (look: string, clip: string) => boolean;
  /** 장면의 소속 (거점 장면 = 그 조직 코드, 거리 = null). 경비·직원 몹의 소속이 된다 */
  sceneFaction?: (scene: string) => string | null;
  /** 세력 평판 구간 (인물 기록 factions()). 몹의 첫 반응을 정한다 (8-6장) */
  stance?: (faction: string) => 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile' | null;
}

const WALK = 150;
const MARGIN = 60;
const NOTICE_PX = 280;
/** 소란도 단계 문턱 (0~100 → 0~3) */
export const UPROAR_STEPS = [20, 50, 80];
let serial = 0;

export class WorldSim {
  readonly actors: Actor[] = [];
  readonly events: SimEvent[] = [];
  private spawnT = new Map<string, number>();
  private uproar = new Map<string, { v: number; x: number }>();
  /** 실제로 흐른 생활 초 */
  time = 0;
  private hour: number | null = null;
  private player: { scene: string; x: number; y: number; seat?: number | null } | null = null;
  readonly spawns: SpawnRule[];
  readonly posts: Post[];
  private has: (look: string, clip: string) => boolean;
  constructor(readonly graph: PlaceGraph, readonly rng: Rng, opts: SimOptions | SpawnRule[] = {}) {
    const o = Array.isArray(opts) ? { spawns: opts } : opts;
    this.spawns = o.spawns ?? [];
    this.posts = o.posts ?? [];
    this.has = o.has ?? (() => false);
    this.sceneFaction = o.sceneFaction ?? (() => null);
    this.stance = o.stance ?? (() => null);
  }
  private sceneFaction: (scene: string) => string | null;
  private stance: (faction: string) => 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile' | null;
  /** 몹의 소속: 경비·직원(근무형·staff·guard)은 장면 소속, 나머지는 없음 */
  mobFaction(a: Actor): string | null {
    if (a.def.kind !== 'mob') return null;
    const role = ARCHETYPES[a.def.archetype ?? a.def.name]?.role;
    return a.post || role === 'guard' || role === 'staff' ? this.sceneFaction(a.scene) : null;
  }

  // ── 바깥에서 부르는 것 ──

  add(def: ActorDef, at?: { scene?: string; x?: number; y?: number }): Actor {
    const scene = at?.scene ?? def.home;
    const p = this.randomSpot(scene);
    const a: Actor = {
      def, scene, x: at?.x ?? p.x, y: at?.y ?? p.y, face: this.rng() < 0.5 ? 1 : -1, act: 'idle', doing: '대기', goal: null, route: [],
      wait: range(this.rng, 0.5, 4), plan: 'none', run: 1, clip: 'idle', clipAt: this.time, iconT: 0, sayT: 0, noticeCd: 0, think: range(this.rng, 1, 4),
    };
    if (def.kind === 'named' && def.brain === 'needs') a.needs = fullNeeds(this.rng);
    if (def.kind === 'mob') {
      const arch = ARCHETYPES[def.archetype ?? def.name];
      a.temper = rollTemper(this.rng, arch);
      a.drunk = !!arch?.drinks && this.isNight() && this.rng() < 0.35;
      // 몸: 한 명마다 힘민체지정(합 25 무작위)을 굴리고 체력은 그 공식으로 (10-30 사용자). 주머니 돈 (백 원 단위)
      a.base = rollBase(this.rng);
      a.hpMax = a.hp = derive(a.base).hp;
      const pk = POCKET[def.archetype ?? def.name];
      a.pocket = pk ? Math.round(range(this.rng, pk[0], pk[1]) / 100) * 100 : 0;
    }
    this.actors.push(a);
    return a;
  }
  remove(id: string): void {
    const i = this.actors.findIndex((a) => a.def.id === id);
    if (i >= 0) this.actors.splice(i, 1);
  }
  inScene(scene: string): Actor[] {
    return this.actors.filter((a) => a.scene === scene && a.act !== 'door' && a.act !== 'gone' && !a.fighting);
  }
  /** 전투 AI로 넘길 행위자: 주인공을 막아선 몹(적대 세력·경찰·시비 뒤 맞섬) */
  challengers(scene: string): Actor[] {
    return this.inScene(scene).filter((a) => a.def.kind === 'mob' && ((a.plan === 'chase' && !a.target && a.act === 'watch') || (a.act === 'argue' && a.doing === '맞섬')));
  }
  /** 전투 AI 몸으로 넘김 (돌아올 때까지 시뮬에서 뺌) */
  toFight(id: string): Actor | null {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || a.fighting) return null;
    a.fighting = true;
    a.goal = null;
    a.route = [];
    return a;
  }
  /** 전투에서 돌아옴. down = 쓰러뜨림(기절 → 깨면 떠남), 아니면 싸움이 끊긴 것(주인공이 장면을 떠남 등) */
  fromFight(id: string, x: number, y: number, down: boolean): void {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || !a.fighting) return;
    a.fighting = false;
    a.x = x;
    a.y = y;
    a.plan = 'none';
    if (down) {
      a.hp = 0;
      this.struck(a, a.face);
      this.crime(a.scene, a.x, 15);
      return;
    }
    a.act = 'idle';
    a.wait = 0.5;
    this.setClip(a, 'idle');
  }
  /** 소란 (플레이어가 몹을 때림·물건 부숨 등). amount 0~100 */
  disturb(scene: string, amount: number, x: number): void {
    const u = this.uproar.get(scene) ?? { v: 0, x };
    u.v = Math.min(100, u.v + amount);
    u.x = x;
    this.uproar.set(scene, u);
  }
  uproarLevel(scene: string): 0 | 1 | 2 | 3 {
    const v = this.uproar.get(scene)?.v ?? 0;
    return (UPROAR_STEPS.filter((s) => v >= s).length) as 0 | 1 | 2 | 3;
  }
  uproarValue(scene: string): number {
    return this.uproar.get(scene)?.v ?? 0;
  }
  /** 플레이어 범죄 → 경찰(거리)·경비(거점)가 출입구로 들어와 플레이어에게 간다 (8-4장) */
  crime(scene: string, x: number, severity = 20): void {
    this.disturb(scene, severity, x);
    const len = this.graph.scene(scene)?.length ?? 1280;
    const street = this.graph.kind(scene) === 'street';
    const n = 1 + this.uproarLevel(scene);
    const have = this.actors.filter((a) => a.scene === scene && a.plan === 'chase').length;
    for (let i = have; i < n; i++) {
      const gate = Math.abs(x - 30) > Math.abs(x - (len - 30)) ? 30 : len - 30;
      const arch = street ? '경찰' : '경비';
      const a = this.add({ id: `mob${++serial}`, name: arch, kind: 'mob', brain: 'transit', home: scene, archetype: arch, look: arch, speed: 170 }, { scene, x: gate, y: this.laneMid(scene) });
      a.plan = 'chase';
      a.run = 1.4;
      this.walkTo(a, { x, y: a.y }, '플레이어에게 가는 중', 'chase');
      this.iconOn(a, '!', 3);
    }
    this.events.push({ kind: 'police', scene, n });
  }
  /**
   * 주인공 공격 판정이 행위자에 닿았나 (필드에는 전투 몸이 아닌 행위자도 맞는다).
   * 몹: 쓰러졌다 일어나 도망(겁) 또는 맞섬, 소란 +15, 범죄로 경찰·경비 출동. 이름 인물: 화내고 사건으로 알림.
   */
  hitBoxes(scene: string, boxes: HitBox[], dir: 1 | -1): Actor[] {
    const out: Actor[] = [];
    for (const a of this.inScene(scene)) {
      for (const b of boxes) {
        if (a.hitBy === b.attackId) continue;
        if (a.x + 30 < b.x0 || a.x - 30 > b.x1 || Math.abs(a.y - b.y) > (b.dy ?? 18) + 14 || b.z0 > 200) continue;
        a.hitBy = b.attackId;
        out.push(a);
        this.struck(a, dir);
        break;
      }
    }
    if (out.length) this.crime(scene, out[0].x, 15 * out.length);
    return out;
  }
  /** 행위자 하나를 맞힘 (에일린 코어 표적 경로). 같은 틱 여러 번은 hitBy로 거른다 */
  hitActor(id: string, dir: 1 | -1, attackId: number, dmg = 12): boolean {
    const a = this.actors.find((q) => q.def.id === id);
    if (!a || a.act === 'gone' || a.act === 'door' || a.hitBy === attackId) return false;
    // 이미 기절해 쓰러진 몹은 더 때려도 반응하지 않는다
    if (a.def.kind === 'mob' && (a.hp ?? 1) <= 0) return false;
    a.hitBy = attackId;
    if (a.def.kind === 'mob' && a.hp !== undefined) a.hp = Math.max(0, a.hp - dmg);
    this.struck(a, dir);
    this.crime(a.scene, a.x, 15);
    return true;
  }
  private struck(a: Actor, dir: 1 | -1): void {
    a.seatPick = undefined;
    a.x += dir * 36;
    a.face = (-dir) as 1 | -1;
    a.goal = null;
    a.route = [];
    // 몹: 체력이 바닥나면 기절(쓰러져 오래 누움), 아니면 휘청
    const down = a.def.kind === 'mob' && (a.hp ?? 1) <= 0;
    if (down && a.pocket && (DROPS.has(a.def.archetype ?? '') || a.stolen)) {
      this.events.push({ kind: 'drop', scene: a.scene, who: a.def.name, amount: a.pocket, stolen: a.stolen ?? 0, x: a.x });
      a.pocket = 0;
      a.stolen = 0;
    }
    this.events.push({ kind: 'hurt', scene: a.scene, who: a.def.name, named: a.def.kind === 'named', x: a.x, down });
    if (a.def.kind === 'named') {
      a.act = 'argue';
      a.doing = '맞고 화남';
      a.wait = 3;
      this.setClip(a, this.canClip(a, 'angry') ? 'angry' : 'idle');
      this.iconOn(a, '#', 3);
      return;
    }
    a.act = 'down';
    a.doing = down ? '기절' : '휘청';
    a.wait = down ? 6 : 0.6;
    this.setClip(a, down && this.canClip(a, 'down') ? 'down' : 'idle');
    this.iconOn(a, '!', 1.5);
  }

  /** 행위자 말풍선 (대사 연결이 부른다) */
  say(a: Actor, text: string, sec = 3.2): void {
    a.say = text;
    a.sayT = sec;
  }
  isNight(): boolean {
    return this.hour != null && (this.hour >= 19.5 || this.hour < 5);
  }

  randomSpot(scene: string): { x: number; y: number } {
    const s = this.graph.scene(scene);
    const [top, bot] = this.graph.lane(scene);
    const len = s?.length ?? 1280;
    return { x: range(this.rng, MARGIN, Math.max(MARGIN + 1, len - MARGIN)), y: range(this.rng, top + 20, bot - 10) };
  }
  private laneMid(scene: string): number {
    const [top, bot] = this.graph.lane(scene);
    return range(this.rng, top + 20, bot - 10);
  }

  /** 생활 시간을 dt초 진행. player = 보이는 장면과 주인공 발, hour = 필드 시(모르면 null) */
  step(dt: number, player?: { scene: string; x: number; y?: number; hour?: number | null; seat?: number | null }): void {
    this.time += dt;
    this.hour = player?.hour ?? null;
    this.player = player ? { scene: player.scene, x: player.x, y: player.y ?? 0, seat: player.seat ?? null } : null;
    for (const [s, u] of this.uproar) {
      u.v = Math.max(0, u.v - (player?.scene === s ? 1.5 : 5) * dt);
      if (u.v <= 0) this.uproar.delete(s);
    }
    for (const a of [...this.actors]) if (!a.fighting) this.stepActor(a, dt);
    for (let i = this.actors.length - 1; i >= 0; i--) if (this.actors[i].act === 'gone') this.actors.splice(i, 1);
    for (const r of this.spawns) this.stepSpawn(r, dt);
    for (const p of this.posts) this.stepPost(p);
  }

  // ── 한 사람 ──

  private setClip(a: Actor, clip: string): void {
    // 의자에서 하는 일이 아니면 일어선다
    if (!clip.startsWith('seat:')) a.seat = undefined;
    if (a.clip !== clip) {
      a.clip = clip;
      a.clipAt = this.time;
    }
  }
  private iconOn(a: Actor, icon: string, sec: number): void {
    a.icon = icon;
    a.iconT = sec;
  }
  private canClip(a: Actor, clip: string): boolean {
    const look = a.def.look ?? a.def.name;
    // 앉아서 하는 일은 의자가 있어야: 서서 하는 줄이 없으면 의자 줄로 (허공에 앉지 않는다)
    return this.has(look, clip) || (!!SEAT_KIND[clip] && this.has(look, `seat:${SEAT_KIND[clip]}`));
  }
  /** 장면의 빈 의자 (다른 사람·주인공이 앉지 않은 것) 중 x 에 가까운 것 */
  private freeSeat(scene: string, x: number): number | null {
    const seats = this.graph.scene(scene)?.seats ?? [];
    let best: number | null = null;
    seats.forEach((st, i) => {
      if (this.player?.scene === scene && this.player.seat === st.box) return;
      if (this.actors.some((q) => q.scene === scene && (q.seat?.i === i || q.seatPick === i))) return;
      if (best === null || Math.abs(st.x - x) < Math.abs(seats[best].x - x)) best = i;
    });
    return best;
  }

  private stepActor(a: Actor, dt: number): void {
    if (a.iconT > 0 && (a.iconT -= dt) <= 0) a.icon = undefined;
    if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = undefined;
    if (a.noticeCd > 0) a.noticeCd -= dt;
    if (a.needs) decayNeeds(a.needs, dt, TEMPER[a.def.name], onDuty(this.hour, TEMPER[a.def.name]));
    if (a.def.kind === 'mob') this.mobThink(a, dt);
    if (a.def.kind === 'named') this.namedNotice(a);
    switch (a.act) {
      case 'door': {
        a.wait -= dt;
        if (a.wait > 0) return;
        const hop = a.route.shift()!;
        const at = this.graph.doorSpot(hop.to, hop.enter) ?? this.randomSpot(hop.to);
        a.scene = hop.to;
        a.x = at.x;
        a.y = at.y;
        return this.nextLeg(a);
      }
      case 'walk':
        return this.move(a, dt);
      case 'do':
        if (a.task && a.needs) a.needs[a.task.need] = Math.min(100, a.needs[a.task.need] + a.task.fill * dt);
        a.wait -= dt;
        if (a.wait <= 0 || (a.task && a.needs && a.needs[a.task.need] >= 100)) {
          a.last = a.task?.id;
          a.task = undefined;
          this.idle(a, 1, 3);
        }
        return;
      case 'notice':
      case 'watch':
      case 'argue':
        a.wait -= dt;
        if (a.wait <= 0) this.resume(a);
        return;
      case 'down':
        a.wait -= dt;
        if (a.wait > 0) return;
        // 기절에서 깨면 체력 조금 돌아오고 (근무형이 아니면) 무조건 자리를 뜬다
        if (a.def.kind === 'mob' && (a.hp ?? 1) <= 0) {
          a.hp = Math.round((a.hpMax ?? 50) * 0.3);
          if (!a.post) return this.flee(a, this.player?.x ?? a.x);
          return this.resume(a);
        }
        // 일어나서: 겁 많으면 도망, 배짱 있으면 맞선다 (실제 싸움은 전투 AI)
        if (a.def.kind === 'mob' && a.temper && !a.post) {
          if (a.temper.courage > 0.75 && ARCHETYPES[a.def.archetype ?? '']?.role === 'thug') {
            a.act = 'argue';
            a.doing = '맞섬';
            a.wait = 3;
            this.iconOn(a, '#', 3);
            return;
          }
          return this.flee(a, this.player?.x ?? a.x);
        }
        return this.resume(a);
      case 'post':
        return this.postStand(a, dt);
      case 'idle':
        a.wait -= dt;
        if (a.wait <= 0) this.decide(a);
        return;
    }
  }

  private move(a: Actor, dt: number): void {
    if (!a.goal) return this.idle(a);
    // 쫓기: 목표가 움직인다
    if (a.plan === 'chase') {
      const p = this.player && this.player.scene === a.scene ? this.player : null;
      const t = a.target ? this.actors.find((q) => q.def.id === a.target) : null;
      if (t && t.scene === a.scene) a.goal = { x: t.x - Math.sign(t.x - a.x) * 70, y: t.y };
      else if (p) a.goal = { x: p.x - Math.sign(p.x - a.x) * 110, y: p.y || a.goal.y };
    }
    const dx = a.goal.x - a.x, dy = a.goal.y - a.y;
    const d = Math.hypot(dx, dy);
    const step = (a.def.speed ?? WALK) * a.run * dt;
    if (Math.abs(dx) > 1) a.face = dx > 0 ? 1 : -1;
    this.setClip(a, a.run > 1.2 && this.canClip(a, 'run') ? 'run' : 'walk');
    if (d <= step) {
      a.x = a.goal.x;
      a.y = a.goal.y;
      a.goal = null;
      return this.arrived(a);
    }
    a.x += (dx / d) * step;
    a.y += (dy / d) * step;
  }

  private idle(a: Actor, min = 2, max = 7): void {
    a.seatPick = undefined;
    a.act = 'idle';
    a.doing = '대기';
    a.run = 1;
    a.plan = 'none';
    a.wait = range(this.rng, min, max);
    this.setClip(a, 'idle');
  }
  /** 잠깐 멈췄다 하던 일로 (몹은 가던 길, 근무형은 자리) */
  private resume(a: Actor): void {
    if (a.post) return this.goPost(a);
    if (a.def.brain === 'transit' && a.exitAt) return this.walkTo(a, a.exitAt, '지나가는 중', 'exit');
    this.idle(a, 0.5, 2);
  }

  private walkTo(a: Actor, p: { x: number; y: number }, doing: string, plan: Plan = 'none'): void {
    a.act = 'walk';
    a.goal = p;
    a.doing = doing;
    a.plan = plan;
  }

  private arrived(a: Actor): void {
    const hop = a.route[0];
    if (hop && hop.from === a.scene) {
      a.act = 'door';
      a.doing = `${this.graph.scene(hop.to)?.name ?? hop.to}(으)로 이동 중`;
      a.wait = Math.max(1, hop.sec / 6);
      return;
    }
    switch (a.plan) {
      case 'do':
        return this.startTask(a);
      case 'post':
        a.act = 'post';
        a.doing = `근무 중 (${a.post?.archetype ?? ''})`;
        a.wait = range(this.rng, 4, 9);
        this.setClip(a, this.canClip(a, 'work') ? 'work' : 'idle');
        return;
      case 'patrol':
      case 'roam-post':
        return this.goPost(a);
      case 'exit':
        a.act = 'gone';
        return;
      case 'steal':
        return this.doSteal(a);
      case 'harass':
        return this.doHarass(a);
      case 'chase':
        // 플레이어(또는 도둑) 앞에 섰다: 경고하고 지켜본다 (전투 연결 전)
        a.act = 'watch';
        a.doing = '막아섬';
        a.wait = 3;
        this.iconOn(a, '!', 2);
        return;
    }
    if (a.def.brain === 'transit' && a.exitAt) {
      a.act = 'gone';
      return;
    }
    this.idle(a);
  }

  private nextLeg(a: Actor): void {
    const hop = a.route[0];
    if (hop) {
      const d = this.graph.doorSpot(a.scene, hop.exit);
      if (d) return this.walkTo(a, d, a.doing, a.plan);
    }
    a.route = [];
    // 목적지 장면: 할 일이 있으면 그 자리로
    if (a.plan === 'do' && a.task) return this.walkTo(a, this.randomSpot(a.scene), a.task.label + ' 하러', 'do');
    if (a.plan === 'roam-post') return this.goPost(a);
    this.walkTo(a, this.randomSpot(a.scene), '자리 잡는 중');
  }

  // ── 이름 인물 ──

  private namedNotice(a: Actor): void {
    const p = this.player;
    if (!p || p.scene !== a.scene || a.noticeCd > 0) return;
    if (a.act !== 'idle' && a.act !== 'walk') return;
    if (a.plan === 'do' || a.route.length) return;
    if (Math.abs(p.x - a.x) > NOTICE_PX || Math.abs(p.y - a.y) > 160) return;
    a.noticeCd = range(this.rng, 20, 35);
    a.act = 'notice';
    a.doing = '주인공을 봄';
    a.goal = null;
    a.face = p.x > a.x ? 1 : -1;
    a.wait = 2.4;
    this.setClip(a, this.canClip(a, 'greet') ? 'greet' : this.canClip(a, 'bow') ? 'bow' : 'idle');
    this.iconOn(a, '!', 1.2);
    this.events.push({ kind: 'notice', scene: a.scene, who: a.def.name });
  }

  private decide(a: Actor): void {
    if (a.post) return this.goPost(a);
    if (a.def.brain === 'transit') return this.idle(a, 1, 3);
    const roam = (a.def.roam ?? [a.def.home]).filter((s) => this.graph.scene(s));
    if (a.def.brain === 'needs' && a.needs) {
      const c = choose({
        name: a.def.name, needs: a.needs, scene: a.scene, roam, graph: this.graph, has: (clip) => this.canClip(a, clip), duty: onDuty(this.hour, TEMPER[a.def.name]),
        partnerIn: (s) => this.actors.some((q) => q !== a && q.def.kind === 'named' && q.scene === s && (q.act === 'idle' || q.act === 'walk') && !q.route.length),
        rand: this.rng, last: a.last,
      });
      if (c) {
        a.task = c.act;
        if (c.scene === a.scene) return this.walkTo(a, this.taskSpot(a, c.act), `${c.act.label} 하러`, 'do');
        const path = this.graph.route(a.scene, c.scene);
        const d = path && this.graph.doorSpot(a.scene, path[0].exit);
        if (path && d) {
          a.route = path;
          return this.walkTo(a, d, `${c.act.label} 하러 ${this.graph.scene(c.scene)?.name ?? c.scene}(으)로`, 'do');
        }
        a.task = undefined;
      }
    }
    // 켜진 활동이 없으면 서성이기·장면 다녀오기 (2단계 뼈대)
    const away = a.scene !== a.def.home;
    const r = this.rng();
    let dest: string | null = null;
    if (away && r < 0.45) dest = a.def.home;
    else if (!away && roam.length > 1 && r < 0.18) dest = pick(this.rng, roam.filter((s) => s !== a.scene));
    if (dest) {
      const path = this.graph.route(a.scene, dest);
      const d = path && this.graph.doorSpot(a.scene, path[0].exit);
      if (path && d) {
        a.route = path;
        return this.walkTo(a, d, `${this.graph.scene(dest)?.name ?? dest}(으)로 가는 중`);
      }
    }
    this.walkTo(a, this.randomSpot(a.scene), '서성이는 중');
  }

  /** 수다는 상대 옆으로, 앉아서 하는 일은 빈 의자로(서서 하는 줄이 없거나 의자가 있으면), 나머지는 장면 안 빈 곳 */
  private taskSpot(a: Actor, t: Activity): { x: number; y: number } {
    a.seatPick = undefined;
    if (!t.partner && SEAT_KIND[t.clip] && this.has(a.def.look ?? a.def.name, `seat:${SEAT_KIND[t.clip]}`)) {
      const i = this.freeSeat(a.scene, a.x);
      const st = i === null ? null : this.graph.scene(a.scene)?.seats?.[i];
      if (st && i !== null) { a.seatPick = i; return { x: st.x, y: st.y }; }
    }
    if (t.partner) {
      const q = this.actors.find((o) => o !== a && o.def.kind === 'named' && o.scene === a.scene && (o.act === 'idle' || o.act === 'walk') && !o.route.length);
      if (q) return { x: q.x + (q.x > a.x ? -90 : 90), y: q.y };
    }
    return this.randomSpot(a.scene);
  }

  private startTask(a: Actor): void {
    const t = a.task;
    if (!t) return this.idle(a);
    if (t.partner) {
      const q = this.actors.find((o) => o !== a && o.def.kind === 'named' && o.scene === a.scene && Math.abs(o.x - a.x) < 220 && (o.act === 'idle' || o.act === 'walk' || o.act === 'notice'));
      if (!q) {
        a.task = undefined;
        return this.idle(a, 1, 2);
      }
      // 상대도 같이 수다 (상대 사교 욕구도 찬다)
      const both = range(this.rng, t.sec[0], t.sec[1]);
      for (const [p, o] of [[a, q], [q, a]] as const) {
        p.act = 'do';
        p.task = t;
        p.wait = both;
        p.goal = null;
        p.route = [];
        p.plan = 'none';
        p.doing = `${o.def.name}와 ${t.label}`;
        p.face = o.x > p.x ? 1 : -1;
        this.setClip(p, this.canClip(p, t.clip) ? t.clip : 'idle');
      }
      this.iconOn(a, '♪', 2);
      return;
    }
    a.act = 'do';
    a.doing = t.label;
    a.wait = range(this.rng, t.sec[0], t.sec[1]);
    a.plan = 'none';
    // 의자에 왔으면 앉는다 (그 의자가 아직 비었을 때)
    const pick = a.seatPick;
    a.seatPick = undefined;
    const st = pick === undefined ? null : this.graph.scene(a.scene)?.seats?.[pick];
    const taken = pick !== undefined && (this.actors.some((q) => q !== a && q.scene === a.scene && q.seat?.i === pick) || (this.player?.scene === a.scene && this.player.seat === st?.box));
    if (st && pick !== undefined && !taken) {
      const kind = SEAT_KIND[t.clip];
      this.setClip(a, `seat:${kind}`);
      a.x = st.x;
      a.y = st.y;
      a.face = st.face === 'W' ? -1 : st.face === 'E' ? 1 : a.face;
      a.seat = { i: pick, dir: st.face === 'N' ? 'back' : st.face ? 'side' : 'front', kind, x: st.x, y: st.y };
      a.doing = `${t.label} (의자)`;
      return;
    }
    // 의자를 못 잡았고 서서 하는 줄도 없으면 그 일을 하지 않는다 (없는 동작을 대기 그림으로 때우지 않는다)
    if (!this.has(a.def.look ?? a.def.name, t.clip)) {
      a.task = undefined;
      return this.idle(a, 1, 3);
    }
    this.setClip(a, t.clip);
  }

  // ── 몹 판단 (8-1장: 사건은 NPC 판단에서) ──

  private mobThink(a: Actor, dt: number): void {
    if (a.act === 'gone' || a.act === 'door') return;
    const lvl = this.uproarLevel(a.scene);
    const t = a.temper;
    if (!t) return;
    a.think -= dt;
    if (a.think > 0) return;
    a.think = range(this.rng, 0.8, 1.6);
    // 세력 평판 구간: 그 소속 몹이 주인공을 보면 (8-6장 표)
    const fac = this.mobFaction(a);
    const p0 = this.player;
    if (fac && p0 && p0.scene === a.scene && Math.abs(p0.x - a.x) < 520 && a.plan !== 'chase' && a.act !== 'argue') {
      const st = this.stance(fac);
      if (st === 'hostile') {
        // 적대: 보자마자 막아선다 (실제 공격은 전투 AI)
        a.run = 1.4;
        a.post = undefined;
        this.walkTo(a, { x: p0.x, y: p0.y || a.y }, '주인공을 막아섬', 'chase');
        this.iconOn(a, '!', 2);
        return;
      }
      if (st === 'wary' && a.act !== 'watch' && this.rng() < 0.3) {
        a.act = 'watch';
        a.doing = '주인공을 경계';
        a.goal = null;
        a.face = p0.x > a.x ? 1 : -1;
        a.wait = 2.5;
        this.iconOn(a, '?', 1.5);
        return;
      }
    }
    if (a.post || a.plan === 'chase' || a.plan === 'steal' || a.plan === 'harass' || a.act === 'argue') return;
    // 소란: 겁 많은 개체는 도망, 호기심 많은 개체는 구경 (근무형·경찰 제외)
    const u = this.uproar.get(a.scene);
    if (lvl >= 1 && u) {
      if (t.courage < 0.25 + 0.15 * lvl && a.run < 1.5) return this.flee(a, u.x);
      if (t.curious > 0.6 && a.act !== 'watch' && this.rng() < 0.4) {
        a.act = 'watch';
        a.doing = '구경';
        a.goal = null;
        a.face = u.x > a.x ? 1 : -1;
        a.wait = range(this.rng, 2, 5);
        this.setClip(a, 'idle');
        this.iconOn(a, '!', 1.5);
        return;
      }
    }
    if (a.act !== 'walk' || a.plan !== 'exit') return;
    // 주인공 쳐다보기: 호기심 높은 개체가 가까이 지나갈 때 잠깐
    const p = this.player;
    if (p && p.scene === a.scene && Math.abs(p.x - a.x) < 220 && t.curious > 0.7 && this.rng() < 0.25) {
      a.act = 'watch';
      a.doing = '주인공을 힐끔';
      a.goal = null;
      a.face = p.x > a.x ? 1 : -1;
      a.wait = 1.2;
      this.setClip(a, 'idle');
      this.iconOn(a, '?', 1);
      return;
    }
    if (this.incidents(a.scene) >= 2) return;
    // 소매치기: 손버릇 있는 개체가 가까운 걷는 행인을 노린다
    if (t.sly > 0.3 && this.rng() < 0.05 + t.sly * 0.1) {
      const v = this.nearMob(a, 500, (q) => q.act === 'walk' && q.plan === 'exit' && !q.post);
      if (v) {
        a.target = v.def.id;
        a.run = 1.2;
        return this.walkTo(a, { x: v.x - Math.sign(v.x - a.x) * 50, y: v.y }, '누군가에게 다가감', 'steal');
      }
    }
    // 시비: 밤에 취한 성급한 개체가 가까운 행인에게
    if (a.drunk && t.haste > 0.55 && this.isNight() && this.rng() < 0.06) {
      const v = this.nearMob(a, 400, (q) => q.act === 'walk' && !q.post);
      if (v) {
        a.target = v.def.id;
        return this.walkTo(a, { x: v.x - Math.sign(v.x - a.x) * 80, y: v.y }, '시비 걸러 감', 'harass');
      }
    }
  }

  private incidents(scene: string): number {
    return this.actors.filter((q) => q.scene === scene && (q.plan === 'steal' || q.plan === 'harass' || q.act === 'argue')).length;
  }
  private nearMob(a: Actor, dist: number, ok: (q: Actor) => boolean): Actor | null {
    let best: Actor | null = null;
    for (const q of this.actors) {
      if (q === a || q.def.kind !== 'mob' || q.scene !== a.scene || !ok(q)) continue;
      const d = Math.abs(q.x - a.x);
      if (d < dist && (!best || d < Math.abs(best.x - a.x))) best = q;
    }
    return best;
  }
  private gateFar(a: Actor, fromX: number): { x: number; y: number } {
    const rule = this.spawns.find((r) => r.scene === a.scene);
    const len = this.graph.scene(a.scene)?.length ?? 1280;
    const gates = rule?.gates?.length ? rule.gates : [30, len - 30];
    const x = [...gates].sort((p, q) => Math.abs(q - fromX) - Math.abs(p - fromX))[0];
    return { x, y: a.y };
  }
  private flee(a: Actor, fromX: number): void {
    a.seatPick = undefined;
    a.run = 1.8;
    a.exitAt = this.gateFar(a, fromX);
    this.walkTo(a, a.exitAt, '도망', 'exit');
    this.setClip(a, this.canClip(a, 'flee') ? 'flee' : 'walk');
    this.iconOn(a, '!', 1.5);
    this.events.push({ kind: 'flee', scene: a.scene, who: a.def.name });
  }

  private doSteal(a: Actor): void {
    const v = this.actors.find((q) => q.def.id === a.target);
    a.target = undefined;
    if (!v || v.scene !== a.scene) return this.resume(a);
    // 실제로 옮긴다: 피해자 주머니에서 절반쯤 (잡으면 도둑이 떨어뜨린다)
    const take = Math.round(((v.pocket ?? 0) * (0.3 + this.rng() * 0.5)) / 100) * 100;
    v.pocket = (v.pocket ?? 0) - take;
    a.pocket = (a.pocket ?? 0) + take;
    a.stolen = (a.stolen ?? 0) + take;
    this.events.push({ kind: 'steal', scene: a.scene, thief: a.def.name, victim: v.def.name, x: v.x });
    this.disturb(a.scene, 12, v.x);
    // 도둑: 반대쪽 출입구로 뛴다
    a.run = 1.9;
    a.exitAt = this.gateFar(a, v.x);
    this.walkTo(a, a.exitAt, '훔치고 달아남', 'exit');
    this.iconOn(v, '!', 2.5);
    // 피해자: 용감하면 쫓고, 아니면 멈춰 선다
    if ((v.temper?.courage ?? 0) > 0.6) {
      v.target = a.def.id;
      v.run = 1.6;
      this.walkTo(v, { x: a.x, y: a.y }, '도둑을 쫓음', 'chase');
      v.wait = 0;
    } else {
      v.act = 'watch';
      v.doing = '털림';
      v.goal = null;
      v.wait = 3;
    }
    // 주변: 용감한 행인은 쫓고, 호기심 많은 행인은 구경
    for (const q of this.actors) {
      if (q === a || q === v || q.scene !== a.scene || q.def.kind !== 'mob' || q.post || Math.abs(q.x - v.x) > 450) continue;
      const t = q.temper!;
      if (t.courage > 0.85 && this.rng() < 0.5) {
        q.target = a.def.id;
        q.run = 1.6;
        this.walkTo(q, { x: a.x, y: a.y }, '도둑을 쫓음', 'chase');
      } else if (t.curious > 0.5) {
        q.act = 'watch';
        q.doing = '구경';
        q.goal = null;
        q.face = v.x > q.x ? 1 : -1;
        q.wait = range(this.rng, 2, 4);
      }
    }
  }

  private doHarass(a: Actor): void {
    const v = this.actors.find((q) => q.def.id === a.target);
    a.target = undefined;
    if (!v || v.scene !== a.scene) return this.resume(a);
    this.events.push({ kind: 'harass', scene: a.scene, who: a.def.name, target: v.def.name, x: v.x });
    this.disturb(a.scene, 8, v.x);
    a.act = 'argue';
    a.doing = '시비 거는 중';
    a.goal = null;
    a.face = v.x > a.x ? 1 : -1;
    a.wait = range(this.rng, 4, 7);
    this.setClip(a, this.canClip(a, 'angry') ? 'angry' : 'idle');
    this.iconOn(a, '#', 3);
    // 상대: 겁 많으면 도망, 아니면 맞받아침
    if ((v.temper?.courage ?? 0) < 0.4) return this.flee(v, a.x);
    v.act = 'argue';
    v.doing = '맞받아침';
    v.goal = null;
    v.face = a.x > v.x ? 1 : -1;
    v.wait = a.wait;
    this.iconOn(v, '#', 3);
  }

  // ── 근무형 (6-3장) ──

  private stepPost(p: Post): void {
    const on = inShift(this.hour, p.shifts) && (p.uproar === undefined || this.uproarLevel(p.scene) >= p.uproar);
    const workers = this.actors.filter((a) => a.post?.id === p.id && a.plan !== 'exit');
    if (on && workers.length < p.count) {
      const [top, bot] = this.graph.lane(p.scene);
      const a = this.add({ id: `post${++serial}`, name: p.archetype, kind: 'mob', brain: 'post', home: p.scene, archetype: p.archetype, look: p.archetype }, { scene: p.scene, x: p.gate, y: (top + bot) / 2 });
      a.post = p;
      a.postI = 0;
      this.goPost(a);
      this.events.push({ kind: 'shift', scene: p.scene, who: p.archetype, on: true });
    } else if (!on) {
      for (const a of workers) {
        // 퇴근: 근무 장면의 출입구로 걸어 나간다 (순회 중이면 지금 장면 아무 끝으로)
        a.post = undefined;
        a.route = [];
        a.exitAt = a.scene === p.scene ? { x: p.gate, y: a.y } : this.gateFar(a, a.x);
        this.walkTo(a, a.exitAt, '퇴근', 'exit');
        this.events.push({ kind: 'shift', scene: p.scene, who: p.archetype, on: false });
      }
    }
  }

  private goPost(a: Actor): void {
    const p = a.post!;
    const [top, bot] = this.graph.lane(a.scene);
    if (p.how === 'fixed') {
      if (a.scene !== p.scene) return this.travel(a, p.scene, 'roam-post');
      return this.walkTo(a, { x: p.spot ?? 400, y: top + 30 }, '자리로', 'post');
    }
    if (p.how === 'patrol') {
      const [l, r] = p.span ?? [100, (this.graph.scene(a.scene)?.length ?? 1280) - 100];
      const x = Math.abs(a.x - l) < Math.abs(a.x - r) ? r : l;
      return this.walkTo(a, { x, y: range(this.rng, top + 20, bot - 10) }, '순찰', 'post');
    }
    // 순회: 경로의 다음 장면으로, 머문 뒤 또 다음
    const route = p.route?.length ? p.route : [p.scene];
    const want = route[(a.postI ?? 0) % route.length];
    if (a.scene !== want) return this.travel(a, want, 'roam-post');
    a.postI = (a.postI ?? 0) + 1;
    a.act = 'post';
    a.doing = `순회 중 (${this.graph.scene(a.scene)?.name ?? a.scene})`;
    a.wait = p.stay ?? 30;
    a.plan = 'roam-post';
    this.setClip(a, this.canClip(a, 'work') ? 'work' : 'idle');
  }

  private postStand(a: Actor, dt: number): void {
    a.wait -= dt;
    if (a.wait > 0) return;
    if (a.post?.how === 'roam') return this.goPost(a);
    if (a.post?.how === 'patrol') return this.goPost(a);
    // 고정: 자리에서 조금씩 몸만 돌린다
    a.face = this.rng() < 0.5 ? 1 : -1;
    a.wait = range(this.rng, 4, 9);
  }

  private travel(a: Actor, scene: string, plan: Plan): void {
    const path = this.graph.route(a.scene, scene);
    const d = path && this.graph.doorSpot(a.scene, path[0].exit);
    if (!path || !d) return this.idle(a);
    a.route = path;
    this.walkTo(a, d, `${this.graph.scene(scene)?.name ?? scene}(으)로`, plan);
  }

  // ── 몹 보충 (6-2장) ──

  private stepSpawn(r: SpawnRule, dt: number): void {
    const night = this.isNight();
    const lvl = this.uproarLevel(r.scene);
    const want = Math.max(0, (night ? r.target.night : r.target.day) - lvl); // 소란이 크면 덜 들어온다
    const have = this.actors.filter((a) => a.def.kind === 'mob' && a.def.brain === 'transit' && a.scene === r.scene && a.plan !== 'chase').length;
    if (have >= want) return void this.spawnT.delete(r.scene);
    const visible = this.player?.scene === r.scene;
    if (!visible) {
      for (let i = have; i < want; i++) this.spawnOne(r, null, true);
      return void this.spawnT.delete(r.scene);
    }
    const left = (this.spawnT.get(r.scene) ?? 0) - dt;
    if (left > 0) return void this.spawnT.set(r.scene, left);
    this.spawnT.set(r.scene, range(this.rng, r.refill[0], r.refill[1]) * (1 + lvl));
    this.spawnOne(r, this.player!.x, false);
  }

  private spawnOne(r: SpawnRule, playerX: number | null, anywhere: boolean): void {
    const len = this.graph.scene(r.scene)?.length ?? 1280;
    const gates = r.gates?.length ? r.gates : [30, len - 30];
    const from = playerX === null ? pick(this.rng, gates) : [...gates].sort((p, q) => Math.abs(q - playerX) - Math.abs(p - playerX))[0];
    const others = gates.filter((g) => g !== from);
    const to = pick(this.rng, others.length ? others : gates);
    const [top, bot] = this.graph.lane(r.scene);
    const name = pick(this.rng, this.isNight() && r.nightMix?.length ? r.nightMix : r.mix);
    const arch = ARCHETYPES[name];
    const look = arch?.looks?.length ? pick(this.rng, arch.looks) : name;
    const a = this.add({ id: `mob${++serial}`, name, kind: 'mob', brain: 'transit', home: r.scene, archetype: name, look, speed: range(this.rng, 110, 170) }, { scene: r.scene, x: anywhere ? range(this.rng, MARGIN, len - MARGIN) : from, y: range(this.rng, top + 20, bot - 10) });
    if (a.temper) a.def.speed = (a.def.speed ?? WALK) * (0.85 + a.temper.haste * 0.35);
    a.exitAt = { x: to, y: range(this.rng, top + 20, bot - 10) };
    this.walkTo(a, a.exitAt, a.drunk ? '비틀거리며 지나감' : '지나가는 중', 'exit');
  }
}

export { ACTIVITIES };
