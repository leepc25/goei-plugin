import { AMMO_PICKUP, ITEMS, RELICS, SIGNATURES, WEAPONS, type ItemEffect } from './data';
/** 출동 하나 동안 요원이 들고 다니는 것. JSON 그대로 저장된다. DOM·엔진과 무관. */

export interface Slot {
  id: string;
  n: number;
}
export interface BagEntry {
  id: string;
  name: string;
  value: number;
  research: number;
}
export interface Held {
  id: string;
  /** 남은 휘두르기 횟수 또는 탄 */
  uses: number;
}
export interface ItemRun {
  agent: string;
  /** 1~4번 소모품. 칸 하나에 한 종류만 겹친다. */
  loadout: (Slot | null)[];
  /** 회수물 가방 6칸 */
  bag: (BagEntry | null)[];
  /** 고유 원거리 탄: 장전 수, 예비, 재장전 남은 시간 */
  mag: number;
  reserve: number;
  reloadT: number;
  shotCd: number;
  /** 손에 든 임시 무기(가방을 안 쓴다, 하나만) */
  held: Held | null;
  /** 들고 있는 환경 물건(던지기 전) */
  carry: { prop: string; hp: number } | null;
  cash: number;
  shards: number;
  /** 신유리 사채. 귀환 후 본부가 예산으로 갚는다. */
  debt: number;
  /** 부적: 피격 무효 남은 횟수 */
  ward: number;
  itemCd: number;
}
/** 엔진이 넘기는 요원 상태. 효과 없는 아이템을 소비하지 않으려고 쓴다. 생략하면 늘 소비한다. */
export interface UseContext {
  hp: number;
  max: number;
  bleed?: boolean;
  taint?: number;
  headache?: boolean;
  /** 공포·혼란 */
  mind?: boolean;
  energy?: number;
  energyMax?: number;
  gauge?: number;
}

export const SLOT_COUNT = 4,
  BAG_COUNT = 6;

export function createItemRun(agent: string, loadout?: (Slot | null)[]): ItemRun {
  const sig = SIGNATURES[agent] ?? SIGNATURES.jyaldi;
  const slots: (Slot | null)[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const s = loadout?.[i];
    slots.push(s && ITEMS[s.id] && Number.isFinite(s.n) && s.n >= 1 ? { id: s.id, n: Math.min(ITEMS[s.id].max, Math.floor(s.n)) } : null);
  }
  return {
    agent: sig.agent,
    loadout: slots,
    bag: new Array(BAG_COUNT).fill(null),
    mag: sig.mag,
    reserve: sig.reserve,
    reloadT: 0,
    shotCd: 0,
    held: null,
    carry: null,
    cash: 0,
    shards: 0,
    debt: 0,
    ward: 0,
    itemCd: 0,
  };
}
export const DEFAULT_LOADOUT: (Slot | null)[] = [{ id: 'medkit', n: 2 }, { id: 'bandage', n: 1 }, { id: 'flash', n: 1 }, null];

/** 소모품을 칸에 넣는다. 같은 종류 칸에 먼저, 없으면 빈 칸. 넣은 수를 돌려준다. */
export function addItem(run: ItemRun, id: string, n = 1): number {
  const def = ITEMS[id];
  if (!def || !Number.isSafeInteger(n) || n <= 0) return 0;
  let left = n;
  for (const s of run.loadout) {
    if (s && s.id === id && s.n < def.max) {
      const k = Math.min(left, def.max - s.n);
      s.n += k;
      left -= k;
      if (!left) return n;
    }
  }
  for (let i = 0; i < run.loadout.length && left; i++) {
    if (!run.loadout[i]) {
      const k = Math.min(left, def.max);
      run.loadout[i] = { id, n: k };
      left -= k;
    }
  }
  return n - left;
}
export function canAddItem(run: ItemRun, id: string): boolean {
  const def = ITEMS[id];
  return !!def && run.loadout.some(s => !s || (s.id === id && s.n < def.max));
}

/** 효과가 없을 상황인지. 없으면 소비하지 않는다(키 반복으로 낭비 방지). */
function useless(effect: ItemEffect, c?: UseContext): boolean {
  if (!c) return false;
  switch (effect.type) {
    case 'heal':
      return c.hp >= c.max;
    case 'cure':
      if (effect.status === 'bleed') return !c.bleed && c.hp >= c.max;
      if (effect.status === 'taint') return !c.taint;
      if (effect.status === 'headache') return !c.headache;
      if (effect.status === 'mind') return !c.mind;
      return false;
    case 'energy':
      return c.energy !== undefined && c.energyMax !== undefined && c.energy >= c.energyMax;
    case 'gauge':
      return c.gauge !== undefined && c.gauge >= 1;
    default:
      return false;
  }
}
/** 1~4 칸 사용(slot은 0부터). 소비했으면 효과를, 아니면 null. 적용(체력 등)은 엔진 몫. */
export function useItem(run: ItemRun, slot: number, ctx?: UseContext): { id: string; effect: ItemEffect } | null {
  const s = run.loadout[slot];
  if (!s || s.n <= 0 || run.itemCd > 0) return null;
  const def = ITEMS[s.id];
  if (!def || (!def.always && useless(def.effect, ctx))) return null;
  s.n--;
  if (s.n <= 0) run.loadout[slot] = null;
  run.itemCd = 0.35;
  if (def.effect.type === 'ward') run.ward += def.effect.hits;
  return { id: def.id, effect: def.effect };
}
/** 피격 직전 엔진이 부른다. 부적이 있으면 소모하고 true(피해 무효). */
export function consumeWard(run: ItemRun): boolean {
  if (run.ward <= 0) return false;
  run.ward--;
  return true;
}

export function addRelic(run: ItemRun, id: string): boolean {
  const def = RELICS[id];
  const i = run.bag.indexOf(null);
  if (!def || i < 0) return false;
  run.bag[i] = { id, name: def.name, value: def.value, research: def.research };
  return true;
}
export const bagFree = (run: ItemRun) => run.bag.filter(b => !b).length;

/** 기존 엔진의 회복 조각 효과. 바닥에서 받을 수량 판정과 실제 HP 적용이 같은 값을 쓴다. */
export const pickupHealAmount = (max: number, amount = 1) => max * 0.08 * amount;

// ---------- 고유 원거리 탄 ----------
export const usesAmmo = (run: ItemRun) => (SIGNATURES[run.agent]?.ammo ?? 'none') !== 'none';
export function addAmmo(run: ItemRun, amount?: number): number {
  const sig = SIGNATURES[run.agent];
  if (!sig || sig.ammo === 'none') return 0;
  const want = amount ?? AMMO_PICKUP[sig.ammo].amount;
  const k = Math.max(0, Math.min(want, sig.reserveMax - run.reserve));
  run.reserve += k;
  return k;
}
/** 고유 원거리 1발. 'fire' | 'dry'(탄 없음) | 'reloading' | 'cooldown' | 'free'(탄이 없는 요원) */
export function fireSignature(run: ItemRun): 'fire' | 'dry' | 'reloading' | 'cooldown' | 'free' {
  if (!usesAmmo(run)) return 'free';
  if (run.reloadT > 0) return 'reloading';
  if (run.shotCd > 0) return 'cooldown';
  if (run.mag <= 0) {
    if (startReload(run)) return 'reloading';
    return 'dry';
  }
  run.mag--;
  run.shotCd = 0.16;
  if (run.mag === 0) startReload(run);
  return 'fire';
}
/** 탄창이 비면 자동 재장전(별도 키 없음). 예비가 없으면 false. */
export function startReload(run: ItemRun): boolean {
  const sig = SIGNATURES[run.agent];
  if (!sig || sig.ammo === 'none' || run.reloadT > 0 || run.reserve <= 0 || run.mag >= sig.mag) return false;
  run.reloadT = sig.reload;
  return true;
}
/** 시간 진행. 재장전 끝나면 true. */
export function tickRun(run: ItemRun, dt: number): boolean {
  run.itemCd = Math.max(0, run.itemCd - dt);
  run.shotCd = Math.max(0, run.shotCd - dt);
  if (run.reloadT > 0) {
    run.reloadT -= dt;
    if (run.reloadT <= 0) {
      run.reloadT = 0;
      const sig = SIGNATURES[run.agent];
      const k = Math.min(sig.mag - run.mag, run.reserve);
      run.mag += k;
      run.reserve -= k;
      return true;
    }
  }
  return false;
}

// ---------- 임시 무기 ----------
export function equip(run: ItemRun, id: string, uses?: number): Held | null {
  const def = WEAPONS[id];
  if (!def) return null;
  const prev = run.held;
  run.held = { id, uses: uses ?? def.uses };
  return prev;
}
/** A(근접 묶음) 또는 S(총 묶음) 한 번. 임시 무기를 안 들었거나 종류가 다르면 null → 고유 동작 그대로. */
export function useWeapon(run: ItemRun, cls: 'melee' | 'gun') {
  const h = run.held;
  if (!h) return null;
  const def = WEAPONS[h.id];
  if (def.cls !== cls) return null;
  h.uses--;
  const broke = h.uses <= 0;
  if (broke) run.held = null;
  return { def, broke, left: Math.max(0, h.uses) };
}
