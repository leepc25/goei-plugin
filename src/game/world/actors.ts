// 필드 세계 행위자 시뮬 (docs/필드_세계_NPC_설계.md 3·5·6·7장).
// 2단계 뼈대: 몸 자리·걷기·문 지나기·장면 옮기기·몹 통행·보충. 욕구 AI(5장)는 3단계에서 Brain을 바꿔 끼운다.
// 화면 밖 장면도 같은 규칙으로 돈다(행위자 수십 명은 가볍다). 생활은 실시간, 시계(clock.ts)와 무관.
import type { Hop, PlaceGraph } from './places';
import { pick, range, type Rng } from './rng';

export type ActorKind = 'named' | 'mob';
export interface ActorDef {
  id: string;
  /** 이름표 (몹은 원형 이름) */
  name: string;
  kind: ActorKind;
  /** 행동 부품 이름 (7-1장). 2단계: roam(이름 인물 서성이기·장면 오가기), transit(몹 통행) */
  brain: 'roam' | 'transit';
  /** 돌아가는 장면 */
  home: string;
  /** 오갈 수 있는 장면 (roam) */
  roam?: string[];
  /** 그림 열쇠 (이름 인물 = 이름, 몹 = 원형) */
  look?: string;
  /** 걷는 속도 px/초 */
  speed?: number;
}
export type Act = 'idle' | 'walk' | 'door' | 'gone';
export interface Actor {
  def: ActorDef;
  scene: string;
  x: number;
  y: number;
  face: 1 | -1;
  act: Act;
  /** 사람이 읽는 지금 할 일 (관찰 창) */
  doing: string;
  goal: { x: number; y: number } | null;
  route: Hop[];
  /** idle·door 남은 초 */
  wait: number;
  /** 몹: 나갈 출입구 */
  exitAt?: { x: number; y: number };
}

/** 한 장면의 몹 보충 규칙 (6-2장 스포너의 뼈대) */
export interface SpawnRule {
  scene: string;
  /** 목표 인원 (시간대별, 시 → 인원). 없으면 day */
  target: { day: number; night: number };
  /** 모자랄 때 보충 간격 초 [최소, 최대] */
  refill: [number, number];
  /** 들어오고 나가는 곳 x (길 끝·지하철 입구 등). 생략하면 양 끝 */
  gates?: number[];
  /** 원형 이름 목록 (뽑기) */
  mix: string[];
}

const WALK = 150;
const MARGIN = 60;
let serial = 0;

export class WorldSim {
  readonly actors: Actor[] = [];
  private spawnT = new Map<string, number>();
  /** 실제로 흐른 생활 초 */
  time = 0;
  constructor(readonly graph: PlaceGraph, readonly rng: Rng, readonly spawns: SpawnRule[] = []) {}

  /** 행위자 하나를 장면에 세운다 (자리 없으면 장면 안 아무 데나) */
  add(def: ActorDef, at?: { scene?: string; x?: number; y?: number }): Actor {
    const scene = at?.scene ?? def.home;
    const p = this.randomSpot(scene);
    const a: Actor = { def, scene, x: at?.x ?? p.x, y: at?.y ?? p.y, face: this.rng() < 0.5 ? 1 : -1, act: 'idle', doing: '대기', goal: null, route: [], wait: range(this.rng, 0.5, 4) };
    this.actors.push(a);
    return a;
  }
  remove(id: string): void {
    const i = this.actors.findIndex((a) => a.def.id === id);
    if (i >= 0) this.actors.splice(i, 1);
  }
  inScene(scene: string): Actor[] {
    return this.actors.filter((a) => a.scene === scene && a.act !== 'door' && a.act !== 'gone');
  }

  randomSpot(scene: string): { x: number; y: number } {
    const s = this.graph.scene(scene);
    const [top, bot] = this.graph.lane(scene);
    const len = s?.length ?? 1280;
    return { x: range(this.rng, MARGIN, Math.max(MARGIN + 1, len - MARGIN)), y: range(this.rng, top + 20, bot - 10) };
  }

  /** 생활 시간을 dt초 진행. player = 보이는 장면과 주인공 발 (몹은 주인공에서 먼 출입구로 들어온다) */
  step(dt: number, player?: { scene: string; x: number; hour?: number | null }): void {
    this.time += dt;
    for (const a of [...this.actors]) this.stepActor(a, dt);
    for (let i = this.actors.length - 1; i >= 0; i--) if (this.actors[i].act === 'gone') this.actors.splice(i, 1);
    for (const r of this.spawns) this.stepSpawn(r, dt, player);
  }

  private stepActor(a: Actor, dt: number): void {
    switch (a.act) {
      case 'door': {
        a.wait -= dt;
        if (a.wait > 0) return;
        const hop = a.route.shift()!;
        const at = this.graph.doorSpot(hop.to, hop.enter) ?? this.randomSpot(hop.to);
        a.scene = hop.to;
        a.x = at.x;
        a.y = at.y;
        this.nextLeg(a);
        return;
      }
      case 'walk': {
        if (!a.goal) return this.idle(a);
        const dx = a.goal.x - a.x, dy = a.goal.y - a.y;
        const d = Math.hypot(dx, dy);
        const step = (a.def.speed ?? WALK) * dt;
        if (Math.abs(dx) > 1) a.face = dx > 0 ? 1 : -1;
        if (d <= step) {
          a.x = a.goal.x;
          a.y = a.goal.y;
          a.goal = null;
          return this.arrived(a);
        }
        a.x += (dx / d) * step;
        a.y += (dy / d) * step;
        return;
      }
      case 'idle':
        a.wait -= dt;
        if (a.wait <= 0) this.decide(a);
        return;
    }
  }

  private idle(a: Actor, min = 2, max = 7): void {
    a.act = 'idle';
    a.doing = '대기';
    a.wait = range(this.rng, min, max);
  }

  private arrived(a: Actor): void {
    // 길 위 문 앞에 닿았다 → 문 안으로 (보이는 장면에서 사라짐)
    const hop = a.route[0];
    if (hop && hop.from === a.scene) {
      a.act = 'door';
      a.doing = `${this.graph.scene(hop.to)?.name ?? hop.to}(으)로 이동 중`;
      a.wait = Math.max(1, hop.sec / 6);
      return;
    }
    if (a.def.brain === 'transit' && a.exitAt) {
      a.act = 'gone';
      return;
    }
    this.idle(a);
  }

  /** 문을 지나 새 장면에 들어온 뒤: 다음 문으로 가거나, 목적지면 그 안 아무 데로 */
  private nextLeg(a: Actor): void {
    const hop = a.route[0];
    if (hop) {
      const d = this.graph.doorSpot(a.scene, hop.exit);
      if (d) return this.walkTo(a, d, a.doing);
    }
    a.route = [];
    this.walkTo(a, this.randomSpot(a.scene), '자리 잡는 중');
  }

  private walkTo(a: Actor, p: { x: number; y: number }, doing: string): void {
    a.act = 'walk';
    a.goal = p;
    a.doing = doing;
  }

  /** 할 일 고르기. 2단계 뼈대: roam = 서성이기·다른 장면 다녀오기 (3단계 욕구 AI가 대신한다) */
  private decide(a: Actor): void {
    if (a.def.brain === 'transit') return this.idle(a, 1, 3);
    const roam = (a.def.roam ?? [a.def.home]).filter((s) => this.graph.scene(s));
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

  private stepSpawn(r: SpawnRule, dt: number, player?: { scene: string; x: number; hour?: number | null }): void {
    const night = player?.hour != null && (player.hour >= 19.5 || player.hour < 5);
    const want = night ? r.target.night : r.target.day;
    const have = this.actors.filter((a) => a.def.kind === 'mob' && a.scene === r.scene).length;
    if (have >= want) return void this.spawnT.delete(r.scene);
    const visible = player?.scene === r.scene;
    // 안 보이는 장면은 모자란 만큼 바로 채운다 (들어가면 이미 그 시간대 인원이 깔려 있다)
    if (!visible) {
      for (let i = have; i < want; i++) this.spawnOne(r, null, true);
      return void this.spawnT.delete(r.scene);
    }
    // 보이는 장면은 보충 간격마다 한 명씩, 주인공에서 먼 출입구로 걸어 들어온다
    const left = (this.spawnT.get(r.scene) ?? 0) - dt;
    if (left > 0) return void this.spawnT.set(r.scene, left);
    this.spawnT.set(r.scene, range(this.rng, r.refill[0], r.refill[1]));
    this.spawnOne(r, player!.x, false);
  }

  private spawnOne(r: SpawnRule, playerX: number | null, anywhere: boolean): void {
    const len = this.graph.scene(r.scene)?.length ?? 1280;
    const gates = r.gates?.length ? r.gates : [30, len - 30];
    const from = playerX === null ? pick(this.rng, gates) : [...gates].sort((p, q) => Math.abs(q - playerX) - Math.abs(p - playerX))[0];
    const others = gates.filter((g) => g !== from);
    const to = pick(this.rng, others.length ? others : gates);
    const [top, bot] = this.graph.lane(r.scene);
    const look = pick(this.rng, r.mix);
    const a = this.add({ id: `mob${++serial}`, name: look, kind: 'mob', brain: 'transit', home: r.scene, look, speed: range(this.rng, 110, 170) }, { scene: r.scene, x: anywhere ? range(this.rng, MARGIN, len - MARGIN) : from, y: range(this.rng, top + 20, bot - 10) });
    a.exitAt = { x: to, y: range(this.rng, top + 20, bot - 10) };
    this.walkTo(a, a.exitAt, '지나가는 중');
  }
}
