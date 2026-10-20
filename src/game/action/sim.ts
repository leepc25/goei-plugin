import { GAIT, MOTION, SCENE } from './space';
import { ATTACK, isStrike, strikeContact, strikeDuration } from './motion';
/** 방 하나의 1인 전투 검증판. DOM/호스트와 무관한 고정 시간 시뮬레이션. */
export const WIDTH = 1280,
  HEIGHT = 720,
  SAVE_VERSION = 5;
export type Act =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'land'
  | 'melee1'
  | 'melee2'
  | 'melee3'
  | 'shot'
  | 'skill'
  | 'ult'
  | 'dash'
  | 'guard'
  | 'crouch'
  | 'crouchwalk'
  | 'lowkick'
  | 'airattack'
  | 'dashattack'
  | 'stun'
  | 'victory'
  | 'defeat'
  | 'hurt'
  | 'down'
  | 'rise'
  | 'dead';
export type ExtendedAct = 'reload' | 'dryfire' | 'grab' | 'grabhold' | 'grabstrike' | 'throw' | 'grabbed' | 'thrown' | 'eat' | 'drink' | 'bandage';
export interface Body {
  id: number;
  kind: 'jyaldi' | 'corner' | 'watchman';
  x: number;
  y: number;
  z: number;
  vz: number;
  dir: number;
  hp: number;
  max: number;
  act: Act | ExtendedAct;
  t: number;
  duration: number;
  fired: boolean;
  inv: number;
  flash: number;
  cooldown: number;
  armor: boolean;
  stride: number;
  speed: number;
  push: number;
  ammo: number;
  reserve: number;
}
export interface Player extends Body {
  energy: number;
  gauge: number;
  guard: number;
  dashCd: number;
  items: number[];
  attackBuffer: number;
  crouching: boolean;
  heldTarget: number | null;
  holdTime: number;
  usingItem: number | null;
}
export interface Bolt {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  life: number;
  enemy: boolean;
}
export interface Effect {
  x: number;
  y: number;
  z: number;
  t: number;
  duration: number;
  kind: 'hit' | 'blast' | 'guard' | 'shot';
}
export interface Run {
  version: number;
  player: Player;
  enemies: Body[];
  bolts: Bolt[];
  effects: Effect[];
  time: number;
  auto: boolean;
  phase: 'combat' | 'cleared' | 'evacuated';
  nextId: number;
  cutin: number;
  hitstop: number;
  kills: number;
  message: string;
  shake: number;
  practice: boolean;
}
export interface Input {
  x: number;
  y: number;
  attack?: boolean;
  ranged?: boolean;
  reload?: boolean;
  grab?: boolean;
  run?: boolean;
  jump?: boolean;
  dash?: boolean;
  guard?: boolean;
  skill?: boolean;
  ult?: boolean;
  item?: number;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const body = (id: number, kind: Body['kind'], x: number, y: number, hp: number): Body => ({
  id,
  kind,
  x,
  y,
  z: 0,
  vz: 0,
  dir: kind === 'jyaldi' ? 1 : -1,
  hp,
  max: hp,
  act: 'idle',
  t: 0,
  duration: 0,
  fired: false,
  inv: 0,
  flash: 0,
  cooldown: 0,
  armor: false,
  stride: 0,
  speed: 0,
  push: 0,
  ammo: 8,
  reserve: 32,
});
export function newRun(): Run {
  return {
    version: SAVE_VERSION,
    player: {
      ...body(1, 'jyaldi', 220, 510, 200),
      energy: 100,
      gauge: 100,
      guard: 100,
      dashCd: 0,
      items: [3, 2, 2],
      attackBuffer: 0,
      crouching: false,
      ammo: 8,
      reserve: 32,
      heldTarget: null,
      holdTime: 0,
      usingItem: null,
    },
    enemies: [
      body(2, 'corner', 760, 480, 130),
      body(3, 'watchman', 1030, 560, 145),
      body(4, 'corner', 1130, 510, 130),
      body(5, 'watchman', 940, 610, 145),
    ],
    bolts: [],
    effects: [],
    time: 0,
    auto: false,
    phase: 'combat',
    nextId: 6,
    cutin: 0,
    hitstop: 0,
    kills: 0,
    message: 'Z 근접 · D 권총 · R 재장전 · G 잡기 / Shift 유지 달리기',
    shake: 0,
    practice: false,
  };
}
/** 실제 전투와 같은 판정으로 동작을 시험하되 표적은 먼저 공격하지 않는다. */
export function practiceRun(): Run {
  const r = newRun();
  r.practice = true;
  r.player.x = 440;
  r.player.y = 570;
  r.message = '동작 훈련 · 수동 표적 / Z 약약강 · A+↓ 앉기 · Shift+→+Z 대시공격';
  r.enemies.forEach((e, i) => {
    e.x = i ? 1200 : 530;
    e.y = i ? 680 : 570;
    e.hp = i ? 0 : 1000;
    e.max = i ? e.max : 1000;
    if (i) {
      e.act = 'dead';
      e.t = 2;
    }
  });
  r.kills = 3;
  return r;
}
function act(b: Body, name: Act | ExtendedAct, duration: number) {
  b.act = name;
  b.t = 0;
  b.duration = duration;
  b.fired = false;
}
function fx(r: Run, kind: Effect['kind'], x: number, y: number, z = 65) {
  if (r.effects.length >= 64) r.effects.shift();
  const duration = kind === 'blast' ? 0.55 : 0.22;
  r.effects.push({ x, y, z, t: 0, duration, kind });
}
function facing(a: Body, b: Body) {
  return (b.x - a.x) * a.dir >= -8;
}
function damage(
  r: Run,
  b: Body,
  amount: number,
  source: Body,
  down = false,
  stop = down ? 5 / 60 : 3 / 60,
  push = down ? 66 : 18,
): boolean {
  if (b.hp <= 0 || b.inv > 0) return false;
  const p = r.player;
  if (
    b === p &&
    ['guard', 'crouch', 'crouchwalk'].includes(p.act) &&
    facing(p, source) &&
    p.guard > 0
  ) {
    p.guard = Math.max(0, p.guard - amount * 2);
    p.flash = 0.08;
    fx(r, 'guard', p.x + p.dir * 40, p.y, p.act === 'crouch' ? 105 : 165);
    if (!p.guard) {
      act(p, 'stun', 0.65);
      r.message = '가드 붕괴! 거리를 확보하세요.';
    }
    return false;
  }
  if(p.heldTarget!==null && (b===p || b.id===p.heldTarget)){
    const held=r.enemies.find(e=>e.id===p.heldTarget);
    if(held?.act==='grabbed')act(held,'hurt',0.2);
    p.heldTarget=null;
    if(b!==p && ['grab','grabhold','grabstrike'].includes(p.act))act(p,'idle',0);
  }
  b.hp = Math.max(0, b.hp - amount);
  b.flash = 0.12;
  const impactHeight =
    source.act === 'lowkick'
      ? 35
      : source.act === 'airattack'
        ? Math.min(190, source.z + 105)
        : 165;
  fx(r, 'hit', b.x, b.y, b.z + impactHeight);
  r.hitstop = Math.max(r.hitstop, stop);
  r.shake = Math.max(r.shake, down ? 6 : 2);
  // 정지 뒤 관성이 풀린다. 맞는 즉시 대상 좌표를 순간이동시키지 않는다.
  b.push = source.dir * push * 8;
  if (b === p) {
    p.inv = 0.5;
    p.gauge = clamp(p.gauge + 7, 0, 100);
  } else p.gauge = clamp(p.gauge + amount * 0.35, 0, 100);
  if (b.hp <= 0) {
    act(b, 'dead', 1);
    if (b !== p) r.kills++;
  } else if (!b.armor) act(b, down ? 'down' : 'hurt', down ? 0.9 : 0.23);
  return true;
}
function move(b: Body, x: number, y: number, speed: number, dt: number, face = true) {
  const len = Math.max(1, Math.hypot(x, y)),
    ox = b.x,
    oy = b.y;
  b.x = clamp(b.x + (x / len) * speed * dt, 55, WIDTH - 55);
  b.y = clamp(b.y + (y / len) * speed * dt, SCENE.floorMin, SCENE.floorMax);
  const distance = Math.hypot(b.x - ox, b.y - oy);
  b.speed = Math.min(1200, distance / dt);
  // 1주기의 실제 보폭과 재생 위상을 연결. 벽에 막히면 위상도 정지한다.
  if (b.z === 0 && b.act !== 'dash')
    b.stride =
      (b.stride +
        distance /
          (b.act === 'run' ? GAIT.run : b.act === 'crouchwalk' ? GAIT.crouch : GAIT.walk)) %
      1;
  if (x && face) b.dir = x > 0 ? 1 : -1;
}
function nearTarget(r: Run) {
  const p = r.player;
  return r.enemies.find(
    (e) =>
      e.hp > 0 &&
      (e.x - p.x) * p.dir >= -8 &&
      Math.abs(e.x - p.x) < 118 &&
      Math.abs(e.y - p.y) < 32 &&
      (p.z > 0 ? p.z < 150 && e.z < 60 : Math.abs(e.z - p.z) < 60),
  );
}
function bolt(r: Run, b: Body, enemy: boolean) {
  if (r.bolts.length >= 48) return;
  const muzzleX = enemy ? 48 : b.z > 0 ? 60 : 96;
  const muzzleHeight = enemy ? 135 : b.z > 0 ? 215 : 178;
  r.bolts.push({
    id: r.nextId++,
    x: b.x + b.dir * muzzleX,
    y: b.y,
    z: b.z + muzzleHeight,
    vx: b.dir * (enemy ? 410 : 1000),
    life: 1.7,
    enemy,
  });
  fx(r, 'shot', b.x + b.dir * muzzleX, b.y, b.z + muzzleHeight);
}
function item(r: Run, i: number) {
  const p = r.player;
  if (!Number.isInteger(i) || i < 0 || i > 2 || p.items[i] <= 0 || p.hp <= 0) return;
  if (!['idle','walk','run','crouch'].includes(p.act) || p.z || p.vz) return;
  if ((i===0 && p.hp>=p.max) || (i===1 && p.guard>=100) || (i===2 && p.energy>=100)) return;
  p.usingItem=i;
  act(p, (['eat','bandage','drink'] as const)[i], [1.1,1.8,1.3][i]);
  r.message = ['음식 먹기','붕대 감기','음료 마시기'][i];
}
/** 자동도 같은 명령과 사거리·재사용 대기시간을 사용한다. */
export function autoInput(r: Run): Input {
  const p = r.player,
    live = r.enemies.filter((e) => e.hp > 0);
  const e = live.sort(
    (a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
  )[0];
  if (!e) return { x: 0, y: 0 };
  const dx = e.x - p.x,
    dy = e.y - p.y,
    threat = live.find(
      (e) => e.act === 'shot' && e.duration - e.t < 0.25 && Math.abs(e.y - p.y) < 30,
    );
  return {
    x: Math.abs(dy) > 22 ? 0 : Math.abs(dx) > 100 ? Math.sign(dx) : 0,
    run: Math.abs(dx) > 260,
    y: threat ? (p.y > 540 ? -1 : 1) : Math.abs(dy) > 12 ? Math.sign(dy) : 0,
    attack: Math.abs(dy) < 26 && Math.abs(dx) < 120,
    ranged: Math.abs(dy) < 26 && Math.abs(dx) > 360 && r.time % 1.8 < 0.45,
    reload: p.ammo===0 && p.reserve>0,
    skill: Math.abs(dx) < 390 && Math.abs(dy) < 70 && p.energy >= 35,
    dash: !!threat,
    ult: p.gauge >= 100 && live.length >= 2,
    item: p.hp < 95 ? 0 : undefined,
  };
}
export function step(r: Run, raw: Input, dt: number) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30);
  r.effects = r.effects.filter((f) => (f.t += dt) < f.duration);
  r.shake = Math.max(0, r.shake - dt * 24);
  if (r.phase !== 'combat') {
    r.player.t += dt;
    for (const enemy of r.enemies) if (enemy.act === 'dead') enemy.t += dt;
    return;
  }
  const p = r.player,
    input = r.auto ? autoInput(r) : raw;
  // 히트스톱 중에도 입력을 받는다. 대상·공격 자세와 물리는 멈추고 섬광은 진행한다.
  p.attackBuffer = input.attack ? 0.12 : Math.max(0, p.attackBuffer - dt);
  if (r.cutin > 0) {
    r.cutin = Math.max(0, r.cutin - dt);
    return;
  }
  if (r.hitstop > 0) {
    r.hitstop = Math.max(0, r.hitstop - dt);
    return;
  }
  r.time += dt;
  if (p.usingItem !== null && !['eat','drink','bandage'].includes(p.act)) p.usingItem=null;
  for (const b of [p, ...r.enemies]) {
    b.t += dt;
    if (!b.fired && b.act==='reload' && b.t>=0.8) {
      const count=Math.min(8-b.ammo,b.reserve);
      b.ammo+=count; b.reserve-=count; b.fired=true;
      if(b===p)r.message=`장전 완료 · ${p.ammo}/8 · 예비 ${p.reserve}`;
    }
    if (b===p && p.usingItem!==null && ['eat','drink','bandage'].includes(b.act) && !b.fired && b.t>=b.duration*0.65) {
      const i=p.usingItem;
      if(p.items[i]>0){
        p.items[i]--;
        if(i===0)p.hp=Math.min(p.max,p.hp+70);
        if(i===1)p.guard=100;
        if(i===2)p.energy=100;
      }
      b.fired=true;
    }
    b.inv = Math.max(0, b.inv - dt);
    b.flash = Math.max(0, b.flash - dt);
    b.cooldown = Math.max(0, b.cooldown - dt);
    if (b.push) {
      const oldX=b.x, nextX=b.x + b.push * dt;
      b.x = clamp(nextX, 55, WIDTH - 55);
      if(b.act==='thrown'){
        if(!b.fired){
          const struck=r.enemies.find(e=>e!==b && e.hp>0 && Math.abs(e.y-b.y)<28 && Math.abs(e.z-b.z)<100 && e.x>=Math.min(oldX,b.x)-24 && e.x<=Math.max(oldX,b.x)+24);
          if(struck){b.fired=true;damage(r,struck,22,{...p,dir:Math.sign(b.push)},true);}
        }
        if(nextX!==b.x){damage(r,b,35,{...p,dir:Math.sign(b.push)},true);b.z=0;b.vz=0;}
      }
      b.push *= Math.exp(-dt * 10);
      if (Math.abs(b.push) < 1) b.push = 0;
    }
    if (b.z > 0 || b.vz > 0) {
      b.vz -= 1000 * dt;
      b.z = Math.max(0, b.z + b.vz * dt);
      if (!b.z) {
        b.vz = 0;
        if(b.act==='thrown'){
          damage(r,b,35,p,true,0.08,15);
          if(b.hp>0)act(b,'down',0.9);
          fx(r,'hit',b.x,b.y,15);
        }
        if (b === p && ['jump', 'walk', 'run', 'idle', 'airattack', 'shot'].includes(b.act))
          act(b, 'land', 0.12);
      }
    }
    if (b.act === 'down' && b.t >= b.duration) {
      act(b, 'rise', 0.35);
      b.inv = 0.55;
    } else if (
      !['dead', 'idle', 'walk', 'run', 'jump', 'guard', 'crouch', 'crouchwalk','grabhold','grabbed','thrown'].includes(b.act) &&
      b.t >= b.duration
    ) {
      if(b===p && (b.act==='grab' || b.act==='grabstrike') && p.heldTarget!==null){
        act(p,'grabhold',0);
        continue;
      }
      const next =
        b === p && p.attackBuffer > 0 && b.z === 0 && b.act === 'melee1'
          ? 'melee2'
          : b === p && p.attackBuffer > 0 && b.z === 0 && b.act === 'melee2'
            ? 'melee3'
            : null;
      if (next) {
        act(b, next, strikeDuration(next));
        p.attackBuffer = 0;
      } else {
        if (b === p && b.act === 'melee3') b.cooldown = 0.18;
        act(b, 'idle', 0);
      }
      b.armor = false;
    }
  }
  p.energy = Math.min(100, p.energy + dt * 9);
  p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.act !== 'guard' && p.act !== 'crouch') p.guard = Math.min(100, p.guard + dt * 15);
  if (input.item !== undefined) item(r, input.item);
  if(p.heldTarget!==null){
    const target=r.enemies.find(e=>e.id===p.heldTarget);
    p.holdTime+=dt;
    if(!target || target.hp<=0 || !['grab','grabhold','grabstrike'].includes(p.act) || target.act!=='grabbed' || p.holdTime>=3){
      if(target?.act==='grabbed'){act(target,'hurt',0.2);target.inv=0.3;}
      p.heldTarget=null;
      if(['grab','grabhold','grabstrike'].includes(p.act))act(p,'idle',0);
    }else{
      target.x=clamp(p.x+p.dir*52,55,WIDTH-55); target.y=p.y; target.dir=-p.dir;
      if(p.act==='grabhold' && input.grab){
        p.heldTarget=null;
        if(input.x || input.y){
          const dir=input.x ? Math.sign(input.x) : p.dir;
          p.dir=dir;target.dir=dir;target.z=16;target.vz=350;target.push=dir*1100;
          act(target,'thrown',3);act(p,'throw',0.55);r.message='던지기';
        }else{act(target,'hurt',0.2);act(p,'idle',0);r.message='잡기 해제';}
      }else if(p.act==='grabhold' && p.attackBuffer>0){
        act(p,'grabstrike',0.45);p.attackBuffer=0;
      }else if(p.act==='grabstrike' && p.t>=0.18 && !p.fired){
        p.fired=true;target.hp=Math.max(0,target.hp-12);fx(r,'hit',target.x,target.y,160);r.hitstop=0.035;
        if(!target.hp){act(target,'dead',1);r.kills++;p.heldTarget=null;}
      }
    }
  }
  if (['idle', 'walk', 'run', 'jump', 'guard', 'crouch', 'crouchwalk'].includes(p.act)) {
    if (r.auto) {
      const target = r.enemies
        .filter((e) => e.hp > 0)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (target) p.dir = target.x >= p.x ? 1 : -1;
    }
    if (input.x && !r.auto) p.dir = input.x > 0 ? 1 : -1;
    if (input.jump && p.z === 0) {
      p.vz = 600;
      p.crouching = false;
    }
    if (input.guard && input.y > 0 && !p.z && !p.vz) p.crouching = true;
    if (!input.guard) p.crouching = false;
    if(input.reload && p.ammo<8 && p.reserve>0 && !p.z && !p.vz){
      act(p,'reload',1.15);r.message='탄창 교체 중';
    } else if(input.grab && !p.z && !p.vz){
      const target=r.enemies.filter(e=>e.hp>0 && !['down','rise','thrown'].includes(e.act) && e.z===0 && facing(p,e) && Math.abs(e.x-p.x)<85 && Math.abs(e.y-p.y)<28).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
      act(p,'grab',0.28);
      if(target){p.heldTarget=target.id;p.holdTime=0;act(target,'grabbed',3);r.message='잡기 · Z 타격 · 방향+G 던지기 · G 놓기';}
      else r.message='잡기 실패 · 대상에게 가까이 접근';
    } else if (input.ult && p.gauge >= 100) {
      p.gauge = 0;
      act(p, 'ult', 0.9);
      p.armor = true;
      p.inv = 1.05;
      r.cutin = 0.75;
      r.message = '집중 파괴';
    } else if (input.dash && p.dashCd <= 0) {
      if (input.x) p.dir = Math.sign(input.x);
      act(p, 'dash', 0.3);
      p.inv = 0.24;
      p.dashCd = 0.8;
    } else if (input.guard && !p.z && !p.vz) {
      p.act = p.crouching ? (input.x ? 'crouchwalk' : 'crouch') : 'guard';
      if (input.x) p.dir = Math.sign(input.x);
      if (p.crouching && p.attackBuffer > 0 && p.cooldown <= 0) {
        act(p, 'lowkick', strikeDuration('lowkick'));
        p.attackBuffer = 0;
        p.cooldown = 0.35;
      } else if (p.act === 'crouchwalk') move(p, input.x, 0, 85, dt);
    } else if (input.skill && p.energy >= 35) {
      p.energy -= 35;
      act(p, 'skill', 0.48);
      p.armor = true;
    } else if (p.attackBuffer > 0 && p.cooldown <= 0) {
      p.attackBuffer = 0;
      if (p.z > 0 || p.vz > 0) {
        act(p, 'airattack', strikeDuration('airattack'));
      } else if (!p.z && !p.vz && input.run && input.x) {
        act(p, 'dashattack', strikeDuration('dashattack'));
      } else {
        act(p, 'melee1', strikeDuration('melee1'));
        p.cooldown = 0;
      }
    } else if (input.ranged && p.cooldown <= 0) {
      act(p, p.ammo>0 ? 'shot':'dryfire', 0.24);
      p.cooldown = 0.28;
      if(!p.ammo)r.message='탄창이 비었습니다 · R 재장전';
    } else {
      const x = clamp(input.x, -1, 1),
        y = clamp(input.y, -1, 1);
      const running = !!input.run;
      p.act = p.z > 0 || p.vz > 0 ? 'jump' : x || y ? (running ? 'run' : 'walk') : 'idle';
      move(p, x, y, p.z ? 240 : running ? MOTION.runSpeed : MOTION.walkSpeed, dt, !r.auto);
    }
  }
  if (p.act === 'dash' && p.attackBuffer > 0 && p.t < 0.16) {
    act(p, 'dashattack', strikeDuration('dashattack'));
    p.attackBuffer = 0;
    p.inv = 0;
  }
  if (p.act === 'dash' && p.t >= 0.04 && p.t < 0.16) move(p, input.x || p.dir, input.y, 1200, dt);
  if (p.act === 'dashattack' && p.t < strikeContact('dashattack'))
    move(p, p.dir, 0, 420, dt, false);
  if (p.act === 'airattack' && p.z > 0) move(p, p.dir, 0, 160, dt, false);
  if (isStrike(p.act) && p.t >= strikeContact(p.act) && !p.fired) {
    p.fired = true;
    const finish = p.act === 'melee3',
      attack = ATTACK[p.act];
    const oldX = p.x;
    let connected = false;
    for (const e of r.enemies)
      if (
        e.hp > 0 &&
        (e.x - oldX) * p.dir >= -8 &&
        Math.abs(e.x - oldX) < attack.reach &&
        Math.abs(e.y - p.y) < 35 &&
        (p.act === 'airattack' ? p.z < 150 && e.z < 60 : Math.abs(e.z - p.z) < 60)
      )
        connected =
          damage(
            r,
            e,
            attack.damage,
            p,
            finish || p.act === 'dashattack',
            attack.stop / 60,
            attack.push,
          ) || connected;
    // 큰 dt에서도 접촉 자세를 넘어가서 회수 포즈에 얼지 않게 한다.
    if (connected) p.t = strikeContact(p.act);
    if (finish && connected) fx(r, 'blast', p.x + p.dir * 120, p.y, 150);
    r.message =
      p.act === 'lowkick'
        ? '하단차기'
        : p.act === 'airattack'
          ? '공중차기'
          : p.act === 'dashattack'
            ? '대시 어깨치기'
            : finish
              ? '근접 3타 · 파괴 충격'
              : p.act === 'melee2'
                ? '근접 2타 · 오른 장타'
                : '근접 1타 · 왼 장타';
    if (connected) return;
  }
  if (p.act === 'shot' && p.t >= 0.03 && !p.fired) {
    p.fired = true;
    if(p.ammo>0){p.ammo--;bolt(r, p, false);}
  }
  if ((p.act === 'skill' || p.act === 'ult') && p.t >= (p.act === 'ult' ? 0.3 : 0.14) && !p.fired) {
    p.fired = true;
    const ultimate = p.act === 'ult',
      x = p.x + p.dir * (ultimate ? 280 : 190);
    fx(r, 'blast', x, p.y, 70);
    for (const e of r.enemies)
      if (
        e.hp > 0 &&
        Math.abs(e.x - x) < (ultimate ? 550 : 220) &&
        Math.abs(e.y - p.y) < (ultimate ? 260 : 100)
      )
        damage(r, e, ultimate ? 70 : 45, p, true);
  }
  for (const e of r.enemies) {
    if (r.practice) continue;
    if (e.hp <= 0 || ['hurt', 'down', 'rise','grabbed','thrown','reload'].includes(e.act)) continue;
    if (e.act === 'shot') {
      if (!e.fired && e.t >= e.duration - 0.12) {
        e.fired = true;
        if (e.kind === 'watchman') {if(e.ammo>0){e.ammo--;bolt(r,e,true);}}
        else if (Math.abs(p.x - e.x) < 115 && Math.abs(p.y - e.y) < 42 && p.z < 55 && facing(e, p))
          damage(r, p, 16, e, true);
      }
      continue;
    }
    const dx = p.x - e.x,
      dy = p.y - e.y,
      range = e.kind === 'watchman' ? 550 : 90;
    e.dir = dx >= 0 ? 1 : -1;
    if(e.kind==='watchman' && !e.ammo && e.reserve>0){act(e,'reload',1.2);continue;}
    if(e.kind==='watchman' && !e.ammo && !e.reserve){e.act='guard';continue;}
    if (Math.abs(dx) < range && Math.abs(dy) < 25 && e.cooldown <= 0) {
      act(e, 'shot', e.kind === 'watchman' ? 0.85 : 0.65);
      e.cooldown = e.kind === 'watchman' ? 1.7 : 1.2;
    } else {
      move(
        e,
        Math.abs(dx) > range * 0.8 ? Math.sign(dx) : 0,
        Math.abs(dy) > 15 ? Math.sign(dy) : 0,
        e.kind === 'watchman' ? 75 : 125,
        dt,
      );
      e.act = 'walk';
    }
  }
  for (const b of r.bolts) {
    const old = b.x;
    b.x += b.vx * dt;
    b.life -= dt;
    const targets = b.enemy ? [p] : r.enemies;
    // 먼저 접촉하는 대상을 선택한다. 빠른 탄환도 이동 구간 전체를 검사한다.
    const candidates = targets
      .filter(
        (t) =>
          t.hp > 0 &&
          t.inv <= 0 &&
          Math.abs(t.y - b.y) < 28 &&
          b.z >= t.z + 10 &&
          b.z <= t.z + (t.act === 'crouch' ? 125 : 245) &&
          Math.max(old, b.x) >= t.x - 28 &&
          Math.min(old, b.x) <= t.x + 28,
      )
      .sort((a, c) => Math.abs(a.x - old) - Math.abs(c.x - old));
    if (candidates[0]) {
      damage(r, candidates[0], b.enemy ? 12 : 18, {
        ...p,
        x: old,
        dir: Math.sign(b.vx),
      });
      b.life = 0;
    }
  }
  r.bolts = r.bolts.filter((b) => b.life > 0 && b.x > -30 && b.x < WIDTH + 30);
  if (p.hp <= 0) {
    r.phase = 'evacuated';
    act(p, 'defeat', 0.8);
    r.message = '작전 지속 불가 · 본부 후송';
  } else if (!r.practice && r.enemies.every((e) => e.hp <= 0)) {
    r.phase = 'cleared';
    act(p, 'victory', 0.7);
    r.message = '훈련 완료 · 전원 제압';
  }
}
export function serialize(r: Run): string {
  return JSON.stringify(r);
}
/** 필드/범위 검증 후 복원. 예전 순찰 데이터와는 다른 키를 사용한다. */
export function restore(raw: string | null): Run | null {
  try {
    if (!raw || raw.length > 120_000) return null;
    const r = JSON.parse(raw) as Run;
    if([1,2,3,4].includes(r?.version) && r.player){
      r.player.ammo=8;r.player.reserve=32;r.player.heldTarget=null;r.player.holdTime=0;r.player.usingItem=null;
      for(const enemy of r.enemies ?? []){enemy.ammo=8;enemy.reserve=32;}
      if(r.version===4)r.version=SAVE_VERSION;
    }
    if ([1, 2, 3].includes(r?.version) && r.player && Array.isArray(r.enemies)) {
      for (const b of [r.player, ...r.enemies]) {
        b.stride = b.stride ?? 0;
        b.speed = b.speed ?? 0;
        b.push = 0;
        b.y = clamp(b.y, SCENE.floorMin, SCENE.floorMax);
      }
      for (const bolt of r.bolts ?? []) bolt.y = clamp(bolt.y, SCENE.floorMin, SCENE.floorMax);
      r.version = SAVE_VERSION;
      r.shake = 0;
      r.practice = false;
      r.player.attackBuffer = 0;
      r.player.crouching = false;
    }
    const finite = (n: unknown, lo: number, hi: number) =>
      typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
    const actions: (Act | ExtendedAct)[] = [
      'reload','dryfire','grab','grabhold','grabstrike','throw','grabbed','thrown','eat','drink','bandage',
      'idle',
      'walk',
      'run',
      'jump',
      'land',
      'melee1',
      'melee2',
      'melee3',
      'shot',
      'skill',
      'ult',
      'dash',
      'guard',
      'crouch',
      'crouchwalk',
      'lowkick',
      'airattack',
      'dashattack',
      'stun',
      'victory',
      'defeat',
      'hurt',
      'down',
      'rise',
      'dead',
    ];
    const validBody = (b: Body) =>
      b &&
      Number.isInteger(b.id) &&
      finite(b.id, 1, 1e8) &&
      ['jyaldi', 'corner', 'watchman'].includes(b.kind) &&
      finite(b.x, 55, 1225) &&
      finite(b.y, SCENE.floorMin, SCENE.floorMax) &&
      finite(b.z, 0, 500) &&
      finite(b.vz, -1500, 600) &&
      (b.dir === 1 || b.dir === -1) &&
      finite(b.max, 1, 1000) &&
      finite(b.hp, 0, b.max) &&
      actions.includes(b.act) &&
      finite(b.t, 0, 1e7) &&
      finite(b.duration, 0, 10) &&
      finite(b.inv, 0, 10) &&
      finite(b.flash, 0, 10) &&
      finite(b.cooldown, 0, 10) &&
      typeof b.fired === 'boolean' &&
      typeof b.armor === 'boolean' &&
      finite(b.stride, 0, 1) &&
      finite(b.speed, 0, 1200) &&
      finite(b.push, -1200, 1200) &&
      Number.isInteger(b.ammo) && finite(b.ammo,0,8) &&
      Number.isInteger(b.reserve) && finite(b.reserve,0,999);
    if (
      !r ||
      r.version !== SAVE_VERSION ||
      !validBody(r.player) ||
      r.player.kind !== 'jyaldi' ||
      !Array.isArray(r.enemies) ||
      r.enemies.length !== 4 ||
      !r.enemies.every((e) => validBody(e) && e.kind !== 'jyaldi') ||
      new Set([r.player, ...r.enemies].map((b) => b.id)).size !== 5
    )
      return null;
    const p = r.player;
    if (
      !Number.isInteger(p.ammo) || !finite(p.ammo,0,8) ||
      !Number.isInteger(p.reserve) || !finite(p.reserve,0,999) ||
      !(p.heldTarget===null || r.enemies.some(e=>e.id===p.heldTarget && e.act==='grabbed' && e.hp>0)) ||
      !finite(p.holdTime,0,4) ||
      !(p.usingItem===null || (Number.isInteger(p.usingItem) && finite(p.usingItem,0,2))) ||
      ![p.energy, p.gauge, p.guard].every((n) => finite(n, 0, 100)) ||
      !finite(p.dashCd, 0, 10) ||
      !finite(p.attackBuffer, 0, 0.13) ||
      typeof p.crouching !== 'boolean' ||
      !Array.isArray(p.items) ||
      p.items.length !== 3 ||
      !p.items.every((n) => Number.isInteger(n) && finite(n, 0, 9))
    )
      return null;
    if (
      !finite(r.time, 0, 1e7) ||
      !finite(r.nextId, 6, 1e8) ||
      !Number.isInteger(r.nextId) ||
      !finite(r.kills, 0, 4) ||
      !Number.isInteger(r.kills) ||
      typeof r.auto !== 'boolean' ||
      !['combat', 'cleared', 'evacuated'].includes(r.phase) ||
      !finite(r.cutin, 0, 1) ||
      !finite(r.hitstop, 0, 1) ||
      !finite(r.shake, 0, 10) ||
      typeof r.practice !== 'boolean' ||
      typeof r.message !== 'string' ||
      r.message.length > 150
    )
      return null;
    if (
      (r.phase === 'combat' && (p.hp <= 0 || (!r.practice && r.enemies.every((e) => !e.hp)))) ||
      (r.phase === 'cleared' && (p.hp <= 0 || r.enemies.some((e) => e.hp > 0))) ||
      (r.phase === 'evacuated' && p.hp > 0)
    )
      return null;
    if (
      !Array.isArray(r.bolts) ||
      r.bolts.length > 48 ||
      !r.bolts.every(
        (b) =>
          Number.isInteger(b.id) &&
          finite(b.id, 1, 1e8) &&
          finite(b.x, -30, 1310) &&
          finite(b.y, SCENE.floorMin, SCENE.floorMax) &&
          finite(b.z, 0, 600) &&
          finite(b.vx, -1000, 1000) &&
          finite(b.life, 0, 2) &&
          typeof b.enemy === 'boolean',
      )
    )
      return null;
    // 장식 효과는 복구하지 않아도 판정에 영향 없음. 도중 공격·탄환·컷인은 유지한다.
    r.effects = [];
    return r;
  } catch {
    return null;
  }
}
