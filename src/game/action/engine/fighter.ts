// 몸 공통: 위치·속도·중력·피격 반응(부록 E.1)·다운·기상 무적·띄움 횟수 제한. 플레이어와 엔진 기본 적이 같이 쓴다.
// 적 스레드(enemy/)도 원하면 이 반응 규칙을 가져다 쓸 수 있다.
import type { Body, Hit, HitResult, WBox, WorldView } from './contract';

export const GRAVITY = 2.6;
let nextId = 1;
export const newId = () => nextId++;

export type Phase = 'free' | 'act' | 'hurt' | 'air-hurt' | 'down' | 'getup' | 'held' | 'dead';

/** 반응 기본값 (틱) */
export const REACT_TICKS = { flinch: 10, stagger: 16, bind: 75 } as const;
export const DOWN_TICKS = 26;
export const GETUP_INVULN = 12;
export const MAX_JUGGLE = 2;

export function overlap(a: WBox, b: WBox): boolean {
  if (a.x1 < b.x0 || b.x1 < a.x0) return false;
  if (a.z1 < b.z0 || b.z1 < a.z0) return false;
  return Math.abs(a.y - b.y) <= Math.max(a.dy ?? 18, b.dy ?? 18);
}

/** 오른쪽 보기 기준 앵커 상자(px) → 월드 상자 */
export function toWorld(b: { x: number; y: number; z: number; dir: 1 | -1 }, x0: number, x1: number, z0: number, z1: number, dy = 18): WBox {
  const a = b.dir === 1 ? b.x + x0 : b.x - x1;
  const c = b.dir === 1 ? b.x + x1 : b.x - x0;
  return { x0: a, x1: c, z0: b.z + z0, z1: b.z + z1, y: b.y, dy };
}

export abstract class Fighter implements Body {
  readonly id = newId();
  abstract readonly team: Body['team'];
  abstract readonly kind: string;
  x = 0; y = 600; z = 0;
  /** 그리기 보간용 직전 틱 위치 */
  px = 0; py = 600; pz = 0;
  vx = 0; vy = 0; vz = 0;
  dir: 1 | -1 = 1;
  hp = 100; hpMax = 100;
  alive = true;
  stop = 0;
  phase: Phase = 'free';
  /** 지금 상태에 들어온 뒤 틱 */
  t = 0;
  /** 반응이 끝나는 틱 수 */
  until = 0;
  invuln = 0;
  /** 슈퍼아머: 0 없음, 1 약 경직 무시, 2 강 경직·띄움까지 무시 */
  armor = 0;
  juggle = 0;
  flash = 0;
  grabbable = true;
  boss = false;
  label?: string;
  /** 넉백 감속 */
  friction = 0.78;
  width = 34;
  lastHitBy = 0;

  abstract frame(): { hit: Hit[]; hurt: WBox[] };
  abstract step(world: WorldView): void;
  draw?(ctx: CanvasRenderingContext2D, world: WorldView): void;

  get airborne() {
    return this.z > 0 || this.vz > 0;
  }

  enter(p: Phase, until = 0) {
    this.phase = p;
    this.t = 0;
    this.until = until;
  }

  /** 맞음: 피해·반응·넉백. 가드·아머는 하위 클래스가 먼저 거른다 */
  applyHit(hit: Hit, world: WorldView): HitResult {
    if (!this.alive || this.phase === 'dead' || this.invuln > 0 || this.phase === 'getup') return { kind: 'immune' };
    if (this.phase === 'down' && this.z <= 0 && !hit.low) return { kind: 'immune' };
    this.hp = Math.max(0, this.hp - hit.dmg);
    this.flash = 3;
    this.dir = (-hit.dir) as 1 | -1;
    const killed = this.hp <= 0;
    let react = hit.react;
    if (killed && react !== 'none') react = 'down';
    // 아머: 반응을 무시 (피해는 받음)
    const rank = { none: 0, flinch: 1, stagger: 2, launch: 2, down: 3, bind: 3 }[react];
    if (!killed && this.armor > 0 && !hit.armorBreak && rank <= this.armor) {
      return { kind: 'armor' };
    }
    const push = hit.push ?? 4;
    if (this.airborne && react !== 'none') {
      // 공중 추가타: 띄움 횟수 제한 안에서만 다시 띄운다
      this.juggle++;
      this.vx = hit.dir * push;
      this.vz = this.juggle <= MAX_JUGGLE ? Math.max(this.vz, (hit.lift ?? 10) * 0.8) : Math.min(this.vz, 0);
      this.enter('air-hurt');
      if (react === 'down' || killed) this.vz = Math.max(this.vz, hit.lift ?? 10);
    } else if (react === 'flinch' || react === 'stagger') {
      this.vx = hit.dir * push;
      this.enter('hurt', REACT_TICKS[react]);
    } else if (react === 'launch' || react === 'down') {
      this.vx = hit.dir * push;
      this.vz = hit.lift ?? (react === 'launch' ? 16 : 11);
      this.z = Math.max(this.z, 1);
      this.juggle = 1;
      this.enter('air-hurt');
    } else if (react === 'bind') {
      this.vx = 0;
      this.enter('hurt', REACT_TICKS.bind);
    }
    if (killed) this.onKilled(world);
    return { kind: 'hit', killed };
  }

  protected onKilled(_world: WorldView) {}

  /** 반응 상태 진행. 처리했으면 true (하위 클래스는 자기 행동을 건너뛴다) */
  protected stepReact(world: WorldView): boolean {
    if (this.flash > 0) this.flash--;
    if (this.invuln > 0) this.invuln--;
    const lane = world.lane;
    switch (this.phase) {
      case 'hurt':
        this.x += this.vx;
        this.vx *= this.friction;
        if (++this.t >= this.until) this.enter('free');
        break;
      case 'air-hurt':
        this.x += this.vx;
        this.z += this.vz;
        this.vz -= GRAVITY;
        if (this.z <= 0 && this.vz < 0) {
          this.z = 0;
          this.vz = 0;
          this.vx *= 0.4;
          world.fx('dust', this.x, this.y, 0);
          world.emit({ type: 'land', x: this.x });
          this.enter('down', this.hp <= 0 ? DOWN_TICKS + 14 : DOWN_TICKS);
          world.emit({ type: 'down', x: this.x, who: this.team === 'player' ? 'player' : 'enemy' });
        }
        break;
      case 'down':
        this.x += this.vx;
        this.vx *= 0.7;
        if (++this.t >= this.until) {
          if (this.hp <= 0) this.enter('dead');
          else this.enter('getup', 14);
        }
        break;
      case 'getup':
        if (++this.t >= this.until) {
          this.invuln = GETUP_INVULN;
          this.juggle = 0;
          this.enter('free');
        }
        break;
      case 'dead':
        this.t++;
        break;
      case 'held':
        this.t++;
        break;
      default:
        return false;
    }
    this.y = Math.max(lane[0], Math.min(lane[1], this.y));
    return true;
  }
}
