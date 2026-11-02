import { AMMO_PICKUP, DROP_TABLES, ITEMS, PICKUP, PROPS, SIGNATURES, WEAPONS, type PickupKind, type Status } from './data';
import {
  addAmmo,
  addItem,
  equip,
  fireSignature,
  pickupHealAmount,
  tickRun,
  useItem,
  usesAmmo,
  useWeapon,
  type ItemRun,
  type UseContext,
} from './inventory';
/**
 * 방 안의 줍는 것·환경 물건·아이템 투사체. 고정 시간 step, DOM 없음, 시드 난수.
 * 좌표는 전투 시뮬과 같다: x 가로, y 바닥 깊이(480~680), z 높이(위가 +).
 */

export interface Pickup {
  id: number;
  type: 'pickup';
  kind: PickupKind;
  /** 아이템·회수물·무기 id */
  ref?: string;
  amount: number;
  /** 일부 보충하고 바닥에 남은 실제 탄 수. 없는 구형 저장은 amount개 탄약 상자로 해석한다. */
  ammoLeft?: number;
  /** 임시 무기 남은 횟수(버린 무기) */
  uses?: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
}
export interface PropEnt {
  id: number;
  type: 'prop';
  prop: string;
  x: number;
  y: number;
  hp: number;
  flash: number;
}
export type FieldEnt = Pickup | PropEnt;
export interface Proj {
  id: number;
  /** prop: 던진 물건, grenade: 섬광·연막, bullet: 임시 총·고유 총 */
  kind: 'prop' | 'grenade' | 'bullet';
  ref: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
  knockback: number;
  knockdown: boolean;
  status?: Status;
  vsHuman?: number;
  armorBreak?: boolean;
  hit: number[];
}
export interface Zone {
  kind: 'smoke' | 'salt' | 'flash' | 'blast' | 'shock';
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
  slow?: number;
}
export interface Field {
  seed: number;
  nextId: number;
  depth: number;
  ents: FieldEnt[];
  projs: Proj[];
  zones: Zone[];
  bounds: { x0: number; x1: number; y0: number; y1: number };
}
/** 엔진이 넘기는 맞을 수 있는 것(적). human: 사람형, anomaly: 괴이(소금이 막음) */
export interface Target {
  id: number;
  x: number;
  y: number;
  z?: number;
  w: number;
  h: number;
  human?: boolean;
}
export interface Actor {
  x: number;
  y: number;
  z: number;
  dir: number;
}
export interface FieldInput {
  /** E를 누른 순간 */
  interact?: boolean;
  /** A를 누른 순간 */
  attack?: boolean;
  /** S를 누른 순간 / 누르고 있는 중 */
  shoot?: boolean;
  shootHeld?: boolean;
  /** 1~4를 누른 순간(0~3) */
  use?: number;
}
export type ItemEvent =
  | { t: 'pickup'; kind: PickupKind; ref?: string; amount: number; x: number; y: number }
  | { t: 'full'; kind: 'item' | 'ammo'; ref?: string }
  | { t: 'use'; slot: number; id: string; effect: ReturnType<typeof useItem> extends infer R ? (R extends { effect: infer E } ? E : never) : never }
  | { t: 'equip'; weapon: string; dropped?: string }
  | { t: 'swing'; weapon: string; left: number }
  | { t: 'weaponBreak'; weapon: string }
  | { t: 'lift'; prop: string }
  | { t: 'throw'; prop: string }
  | { t: 'hit'; target: number; damage: number; knockback: number; knockdown: boolean; status?: Status; stun?: number; armorBreak?: boolean; x: number; y: number; source: string }
  | { t: 'propHit'; prop: string; x: number; y: number }
  | { t: 'break'; prop: string; x: number; y: number }
  | { t: 'burst'; kind: Zone['kind']; x: number; y: number; r: number }
  | { t: 'shot'; source: string; x: number; y: number; dir: number }
  | { t: 'dry' }
  | { t: 'reload' }
  | { t: 'reloaded' }
  | { t: 'drop'; kind: PickupKind; ref?: string; x: number; y: number };

// ---------- 난수 (저장 가능한 정수 상태) ----------
export function rand(f: { seed: number }): number {
  let t = (f.seed = (f.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(f: { seed: number }, a: T[]) => a[Math.floor(rand(f) * a.length)];

export function createField(seed = 1, depth = 1, bounds = { x0: 40, x1: 1240, y0: 480, y1: 680 }): Field {
  return { seed: seed | 0 || 1, nextId: 1, depth, ents: [], projs: [], zones: [], bounds };
}
export function placeProp(field: Field, prop: string, x: number, y: number): PropEnt {
  const def = PROPS[prop];
  const e: PropEnt = { id: field.nextId++, type: 'prop', prop, x, y, hp: def.hp, flash: 0 };
  field.ents.push(e);
  return e;
}
/** 바닥에 하나 떨어뜨린다. 작은 포물선으로 튄다. */
export function spawnPickup(field: Field, kind: PickupKind, x: number, y: number, ref?: string, amount = 1, uses?: number): Pickup {
  const a = rand(field) * Math.PI * 2,
    s = (40 + rand(field) * 70) * (kind === 'weapon' ? 0.6 : 1);
  const p: Pickup = {
    id: field.nextId++,
    type: 'pickup',
    kind,
    ref,
    amount,
    uses,
    x,
    y,
    z: 30,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s * 0.4,
    vz: 260 + rand(field) * 120,
    age: 0,
  };
  field.ents.push(p);
  return p;
}

/** 드랍 표를 굴린다. 탄을 안 쓰는 요원에게는 탄이 안 떨어진다. 탄이 바닥나면 탄 확률을 올린다(막힘 방지). */
export function rollDrops(field: Field, run: ItemRun, table: string, x: number, y: number): ItemEvent[] {
  const rows = DROP_TABLES[table];
  const out: ItemEvent[] = [];
  if (!rows) return out;
  for (const r of rows) {
    let p = r.p;
    if (r.kind === 'ammo' && usesAmmo(run) && run.mag + run.reserve < 8) p = Math.min(1, p + 0.25);
    if (rand(field) >= p) continue;
    const kind = r.kind;
    if (kind === 'ammo' && !usesAmmo(run)) continue;
    const ref = r.pool ? pick(field, r.pool) : undefined;
    spawnPickup(field, kind, x, y, ref, 1);
    out.push({ t: 'drop', kind, ref, x, y });
  }
  return out;
}
export const dropFromKill = rollDrops;

function burst(field: Field, kind: Zone['kind'], x: number, y: number, r: number, life: number, slow?: number): ItemEvent {
  field.zones.push({ kind, x, y, r, t: 0, life, slow });
  return { t: 'burst', kind, x, y, r };
}
/** 소금 원 안인지(괴이는 들어오지 못한다) */
export const inSalt = (field: Field, x: number, y: number) =>
  field.zones.some(z => z.kind === 'salt' && Math.hypot(x - z.x, (y - z.y) * 2) < z.r);
/** 연막 둔화 배율(1 = 그대로) */
export function slowAt(field: Field, x: number, y: number): number {
  let m = 1;
  for (const z of field.zones) if (z.kind === 'smoke' && Math.hypot(x - z.x, (y - z.y) * 2) < z.r) m = Math.min(m, 1 - (z.slow ?? 0));
  return m;
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6);

function hitsTarget(p: { x: number; y: number; z: number }, t: Target, pad = 0): boolean {
  return Math.abs(p.x - t.x) < t.w / 2 + pad && Math.abs(p.y - t.y) < 34 + pad && p.z >= (t.z ?? 0) - 10 && p.z <= (t.z ?? 0) + t.h;
}
function propBox(e: PropEnt, p: { x: number; y: number; z: number }, pad = 0): boolean {
  const d = PROPS[e.prop];
  return Math.abs(p.x - e.x) < d.w / 2 + pad && Math.abs(p.y - e.y) < 30 + pad && p.z <= d.h + pad;
}

/** 환경 물건에 피해. 부서지면 표를 굴리고 효과를 터뜨린다. */
export function damageProp(field: Field, run: ItemRun, e: PropEnt, dmg: number, targets: Target[] = []): ItemEvent[] {
  // 한 공격의 복사 목록에 있어도 앞선 연쇄 폭발이 이미 제거했을 수 있다.
  if (!field.ents.includes(e)) return [];
  const def = PROPS[e.prop];
  if (def.use === 'throw') return [];
  e.hp -= dmg;
  e.flash = 0.12;
  if (e.hp > 0) return [{ t: 'propHit', prop: e.prop, x: e.x, y: e.y }];
  field.ents.splice(field.ents.indexOf(e), 1);
  const ev: ItemEvent[] = [{ t: 'break', prop: e.prop, x: e.x, y: e.y }];
  if (def.loot) ev.push(...rollDrops(field, run, def.loot, e.x, e.y));
  if (def.burst) ev.push(...explode(field, run, def.burst, e.x, e.y, def.id, targets, def.knockdown));
  return ev;
}
export function explode(
  field: Field,
  run: ItemRun,
  b: NonNullable<(typeof PROPS)[string]['burst']>,
  x: number,
  y: number,
  source: string,
  targets: Target[],
  knockdown: boolean,
): ItemEvent[] {
  const ev: ItemEvent[] = [burst(field, b.type, x, y, b.radius, b.time ?? 0.5, b.slow)];
  if (b.damage) {
    for (const t of targets)
      if (Math.hypot(t.x - x, (t.y - y) * 2) < b.radius)
        ev.push({ t: 'hit', target: t.id, damage: b.damage, knockback: 180, knockdown, status: b.type === 'shock' ? 'stun' : undefined, stun: b.type === 'shock' ? 1 : undefined, x: t.x, y: t.y, source });
    // 폭발은 다른 물건도 부순다(연쇄)
    for (const e of field.ents.slice())
      if (e.type === 'prop' && Math.hypot(e.x - x, (e.y - y) * 2) < b.radius && field.ents.includes(e))
        ev.push(...damageProp(field, run, e, b.damage, targets));
  }
  return ev;
}

/**
 * A 한 번. 물건을 들고 있으면 던지고, 근접 임시 무기면 휘두르고(내구 소모),
 * 맨손이면 고유 근접(엔진 몫)으로 돌려보낸다. 휘두르기·고유 근접 모두 앞의 환경 물건을 친다.
 * melee: 엔진이 쓰는 고유 근접의 피해·사거리(물건 부수기용)
 */
export function attack(
  field: Field,
  run: ItemRun,
  actor: Actor,
  targets: Target[],
  melee = { damage: 12, reach: 110 },
): { events: ItemEvent[]; handled: boolean } {
  const ev: ItemEvent[] = [];
  if (run.carry) {
    const def = PROPS[run.carry.prop];
    field.projs.push({
      id: field.nextId++,
      kind: 'prop',
      ref: def.id,
      x: actor.x + actor.dir * 30,
      y: actor.y,
      z: actor.z + 120,
      vx: actor.dir * 760,
      vz: 120,
      life: 1.6,
      damage: def.damage,
      knockback: 220,
      knockdown: def.knockdown,
      hit: [],
    });
    ev.push({ t: 'throw', prop: def.id });
    run.carry = null;
    return { events: ev, handled: true };
  }
  const w = useWeapon(run, 'melee');
  const reach = w ? w.def.reach : melee.reach,
    dmg = w ? w.def.damage : melee.damage;
  const box = { x: actor.x + actor.dir * reach * 0.5, y: actor.y, z: actor.z + 80 };
  if (w) {
    ev.push({ t: 'swing', weapon: w.def.id, left: w.left });
    for (const t of targets)
      if (Math.abs(t.x - box.x) < reach * 0.5 + t.w / 2 && Math.abs(t.y - actor.y) < 40)
        ev.push({
          t: 'hit',
          target: t.id,
          damage: dmg,
          knockback: w.def.knockback,
          knockdown: false,
          status: w.def.status,
          armorBreak: w.def.armorBreak,
          x: t.x,
          y: t.y,
          source: w.def.id,
        });
    if (w.broke) ev.push({ t: 'weaponBreak', weapon: w.def.id });
  }
  for (const e of field.ents.slice())
    if (e.type === 'prop' && PROPS[e.prop].use !== 'throw' && Math.abs(e.x - box.x) < reach * 0.5 + PROPS[e.prop].w / 2 && Math.abs(e.y - actor.y) < 44)
      ev.push(...damageProp(field, run, e, dmg, targets));
  return { events: ev, handled: !!w };
}

/** S. 총 임시 무기를 들었으면 그 총, 아니면 고유 원거리(탄 있는 요원만 여기서 탄을 만든다). */
export function shoot(field: Field, run: ItemRun, actor: Actor, held = false): ItemEvent[] {
  const ev: ItemEvent[] = [];
  const g = run.held && WEAPONS[run.held.id].cls === 'gun' ? WEAPONS[run.held.id] : null;
  if (g) {
    if (held && !g.rate) return ev;
    if (run.shotCd > 0) return ev;
    const w = useWeapon(run, 'gun')!;
    run.shotCd = g.rate ?? 0.28;
    const n = g.pellets ?? 1;
    for (let i = 0; i < n; i++) spawnBullet(field, actor, g.damage, g.knockback, g.reach, g.id, n > 1 ? (i / (n - 1) - 0.5) * (g.spread ?? 0) : 0, g.vsHuman);
    ev.push({ t: 'shot', source: g.id, x: actor.x, y: actor.y, dir: actor.dir });
    if (w.broke) ev.push({ t: 'weaponBreak', weapon: g.id });
    return ev;
  }
  if (held) return ev;
  const r = fireSignature(run);
  if (r === 'fire') {
    spawnBullet(field, actor, 10, 30, 640, 'signature', 0);
    ev.push({ t: 'shot', source: 'signature', x: actor.x, y: actor.y, dir: actor.dir });
    if (run.reloadT > 0) ev.push({ t: 'reload' });
  } else if (r === 'dry') ev.push({ t: 'dry' });
  else if (r === 'reloading' && run.reloadT > 0 && run.shotCd === 0) {
    run.shotCd = 0.2;
    ev.push({ t: 'reload' });
  }
  return ev;
}
export function spawnBullet(field: Field, a: Actor, damage: number, knockback: number, reach: number, ref: string, dy: number, vsHuman?: number) {
  const speed = 1500;
  field.projs.push({
    id: field.nextId++,
    kind: 'bullet',
    ref,
    x: a.x + a.dir * 50,
    y: a.y + dy,
    z: a.z + 130,
    vx: a.dir * speed,
    vz: 0,
    life: reach / speed,
    damage,
    knockback,
    knockdown: false,
    vsHuman,
    hit: [],
  });
}

/** E: 가까운 것부터 무기 → 아이템·회수물 → 들 수 있는 물건. 물건을 든 채 E는 내려놓기. */
export function interact(field: Field, run: ItemRun, actor: Actor): ItemEvent[] {
  if (run.carry) {
    const e = placeProp(field, run.carry.prop, actor.x + actor.dir * 50, actor.y);
    e.hp = run.carry.hp;
    run.carry = null;
    return [];
  }
  let best: FieldEnt | null = null,
    bd: number = PICKUP.interact;
  for (const e of field.ents) {
    const d = near(e, actor);
    if (d >= bd) continue;
    if (e.type === 'pickup' && (e.kind === 'weapon' || e.kind === 'item') && e.z < 8) {
      best = e;
      bd = d;
    } else if (e.type === 'prop' && PROPS[e.prop].use !== 'break' && !run.held) {
      best = e;
      bd = d;
    }
  }
  if (!best) return [];
  if (best.type === 'prop') {
    field.ents.splice(field.ents.indexOf(best), 1);
    run.carry = { prop: best.prop, hp: best.hp };
    return [{ t: 'lift', prop: best.prop }];
  }
  return take(field, run, best, true);
}
function take(field: Field, run: ItemRun, p: Pickup, manual: boolean, ctx?: UseContext): ItemEvent[] {
  if (!field.ents.includes(p)) return [];
  const at = { x: p.x, y: p.y };
  let amount = p.amount;
  switch (p.kind) {
    case 'heal':
      if (ctx) {
        if (ctx.hp >= ctx.max) return [];
        amount = Math.min(p.amount, Math.ceil((ctx.max - ctx.hp) / pickupHealAmount(ctx.max)));
        ctx.hp = Math.min(ctx.max, ctx.hp + pickupHealAmount(ctx.max, amount));
      }
      break;
    case 'ammo': {
      const ammo = SIGNATURES[run.agent]?.ammo;
      if (!ammo || ammo === 'none') return [];
      p.ammoLeft ??= AMMO_PICKUP[ammo].amount * p.amount;
      amount = addAmmo(run, p.ammoLeft);
      if (!amount) return manual ? [{ t: 'full', kind: 'ammo' }] : [];
      p.ammoLeft -= amount;
      if (!p.ammoLeft) field.ents.splice(field.ents.indexOf(p), 1);
      return [{ t: 'pickup', kind: p.kind, amount, ...at }];
    }
    case 'item':
      amount = addItem(run, p.ref!, p.amount);
      if (!amount) return manual ? [{ t: 'full', kind: 'item', ref: p.ref }] : [];
      break;
    case 'weapon': {
      const prev = equip(run, p.ref!, p.uses);
      field.ents.splice(field.ents.indexOf(p), 1);
      if (prev) spawnPickup(field, 'weapon', at.x, at.y, prev.id, 1, prev.uses);
      return [{ t: 'equip', weapon: p.ref!, dropped: prev?.id }];
    }
  }
  p.amount -= amount;
  if (p.amount <= 0) field.ents.splice(field.ents.indexOf(p), 1);
  return [{ t: 'pickup', kind: p.kind, ref: p.ref, amount, ...at }];
}

/**
 * 한 틱. 바닥 물건 낙하·자동 흡수, 입력(E·A·S·1~4), 투사체 충돌, 효과 구역 시간.
 * 'heal' 줍기와 'use' 이벤트의 실제 회복·상태 적용은 엔진이 한다.
 */
export function stepField(
  field: Field,
  run: ItemRun,
  actor: Actor,
  input: FieldInput,
  targets: Target[],
  dt: number,
  ctx?: UseContext,
  melee?: { damage: number; reach: number },
): ItemEvent[] {
  const ev: ItemEvent[] = [];
  // 같은 틱의 회복 조각 여러 개 및 뒤따르는 회복약 입력도 이미 예정된 회복을 고려한다.
  ctx = ctx ? { ...ctx } : undefined;
  if (tickRun(run, dt)) ev.push({ t: 'reloaded' });
  const b = field.bounds;
  // 바닥 물건
  for (const e of field.ents.slice()) {
    if (e.type === 'prop') {
      e.flash = Math.max(0, e.flash - dt);
      continue;
    }
    e.age += dt;
    if (e.z > 0 || e.vz > 0) {
      e.vz -= 1400 * dt;
      e.z += e.vz * dt;
      e.x = Math.max(b.x0, Math.min(b.x1, e.x + e.vx * dt));
      e.y = Math.max(b.y0, Math.min(b.y1, e.y + e.vy * dt));
      if (e.z <= 0) {
        e.z = 0;
        e.vz = Math.abs(e.vz) > 200 ? -e.vz * 0.3 : 0;
        e.vx *= 0.5;
        e.vy *= 0.5;
      }
      continue;
    }
    if (e.age < 0.35 || actor.z > 40) continue;
    // 작은 자동 흡수: 현금·파편·회복 조각·탄 / 아이템·회수물은 밟으면
    const auto = e.kind === 'heal' || e.kind === 'ammo';
    const d = near(e, actor);
    if (auto && d < PICKUP.magnet) {
      e.x += (actor.x - e.x) * Math.min(1, dt * 14);
      e.y += (actor.y - e.y) * Math.min(1, dt * 14);
    }
    if ((auto && d < PICKUP.touch) || (e.kind === 'item' && d < PICKUP.touch)) ev.push(...take(field, run, e, false, ctx));
  }
  // 입력
  if (input.interact) ev.push(...interact(field, run, actor));
  if (input.attack) ev.push(...attack(field, run, actor, targets, melee).events);
  if (input.shoot || input.shootHeld) ev.push(...shoot(field, run, actor, !input.shoot));
  if (input.use !== undefined) {
    const u = useItem(run, input.use, ctx);
    if (u) {
      ev.push({ t: 'use', slot: input.use, id: u.id, effect: u.effect });
      const e = u.effect;
      if (e.type === 'salt') ev.push(burst(field, 'salt', actor.x, actor.y, e.radius, e.time));
      if (e.type === 'flash' || e.type === 'smoke')
        field.projs.push({
          id: field.nextId++,
          kind: 'grenade',
          ref: u.id,
          x: actor.x + actor.dir * 30,
          y: actor.y,
          z: actor.z + 120,
          vx: actor.dir * 380,
          vz: 360,
          life: 3,
          damage: 0,
          knockback: 0,
          knockdown: false,
          hit: [],
        });
    }
  }
  // 투사체
  for (const p of field.projs.slice()) {
    p.life -= dt;
    p.x += p.vx * dt;
    if (p.kind !== 'bullet') {
      p.vz -= 1300 * dt;
      p.z += p.vz * dt;
    }
    let done = p.life <= 0 || p.x < b.x0 - 60 || p.x > b.x1 + 60;
    if (p.kind === 'grenade') {
      // 벽으로 던져도 소비한 소모품은 방 안에 떨어져 효과를 낸다.
      if (p.x < b.x0 || p.x > b.x1) {
        p.x = Math.max(b.x0, Math.min(b.x1, p.x));
        p.vx = 0;
      }
      done = p.life <= 0;
      if (p.z <= 0 || done) {
        const def = ITEMS[p.ref].effect;
        if (def.type === 'flash') {
          ev.push(burst(field, 'flash', p.x, p.y, def.radius, 0.4));
          for (const t of targets)
            if (Math.hypot(t.x - p.x, (t.y - p.y) * 2) < def.radius)
              ev.push({ t: 'hit', target: t.id, damage: 0, knockback: 0, knockdown: false, status: 'stun', stun: def.stun, x: t.x, y: t.y, source: p.ref });
        } else if (def.type === 'smoke') ev.push(burst(field, 'smoke', p.x, p.y, def.radius, def.time, def.slow));
        done = true;
      }
    } else {
      for (const t of targets) {
        if (p.hit.includes(t.id) || !hitsTarget(p, t, p.kind === 'prop' ? 16 : 0)) continue;
        p.hit.push(t.id);
        const dmg = Math.round(p.damage * (t.human && p.vsHuman ? p.vsHuman : 1));
        ev.push({ t: 'hit', target: t.id, damage: dmg, knockback: p.knockback, knockdown: p.knockdown, status: p.status, armorBreak: p.armorBreak, x: t.x, y: t.y, source: p.ref });
        if (p.kind === 'bullet' || p.kind === 'prop') done = true;
        break;
      }
      if (!done)
        for (const e of field.ents)
          if (e.type === 'prop' && propBox(e, p) && PROPS[e.prop].use !== 'throw') {
            ev.push(...damageProp(field, run, e, Math.max(p.damage, 8), targets));
            done = true;
            break;
          }
      if (p.kind === 'prop' && (done || p.z <= 0)) {
        done = true;
        const def = PROPS[p.ref];
        ev.push({ t: 'break', prop: p.ref, x: p.x, y: p.y });
        if (def.burst) ev.push(...explode(field, run, def.burst, p.x, p.y, def.id, targets, def.knockdown));
        else ev.push(burst(field, 'blast', p.x, p.y, 40, 0.25));
      }
    }
    if (done) field.projs.splice(field.projs.indexOf(p), 1);
  }
  for (const z of field.zones.slice()) {
    z.t += dt;
    if (z.t >= z.life) field.zones.splice(field.zones.indexOf(z), 1);
  }
  return ev;
}
