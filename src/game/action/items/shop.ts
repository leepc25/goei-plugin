import { AMMO_PICKUP, CLINIC, ITEMS, LOANS, SIGNATURES, VENDORS, WEAPONS, priceAt, type VendorId } from './data';
import { addAmmo, addItem, canAddItem, equip, type ItemRun } from './inventory';
import { rand } from './field';
/** 출동 중 중림 상인. 현금만 받는다(13장). 진열은 출동 시드와 층으로 정해져 다시 열어도 같다. */

export interface Offer {
  key: string;
  kind: 'item' | 'ammo' | 'weapon' | 'clinic' | 'loan' | 'gamble';
  ref: string;
  name: string;
  desc: string;
  price: number;
  /** 남은 수량 */
  stock: number;
  /** 사채: 귀환 후 갚을 예산 */
  debt?: number;
  /** 자판기: 체력으로 지불 */
  hpCost?: number;
}
export interface Shop {
  vendor: VendorId;
  depth: number;
  seed: number;
  offers: Offer[];
  /** 마덕희만 회수물을 산다 */
  buys: boolean;
  greet: string;
}

/** 휴식방 한 곳에 누가 있는지 굴린다. 없으면 null. */
export function rollVendor(state: { seed: number }): VendorId | null {
  const r = rand(state);
  let acc = 0;
  for (const v of Object.values(VENDORS)) {
    acc += v.appear;
    if (r < acc) return v.id;
  }
  return null;
}

export function openShop(vendor: VendorId, run: ItemRun, depth: number, seed: number): Shop {
  const st = { seed: seed | 0 || 7 };
  const v = VENDORS[vendor];
  const offers: Offer[] = [];
  const greet = v.greet[Math.floor(rand(st) * v.greet.length)];
  if (vendor === 'madeokhee') {
    const pool = ['medkit', 'bandage', 'antidote', 'painkiller', 'sedative', 'salt', 'flash', 'smoke', 'charm', 'energy', 'adrenaline'];
    // 늘 회복약 + 무작위 3종
    const picks = ['medkit'];
    while (picks.length < 4) {
      const id = pool[Math.floor(rand(st) * pool.length)];
      if (!picks.includes(id)) picks.push(id);
    }
    for (const id of picks) {
      const d = ITEMS[id];
      offers.push({ key: 'i:' + id, kind: 'item', ref: id, name: d.name, desc: d.desc, price: priceAt(d.price, depth), stock: id === 'medkit' ? 3 : 2 });
    }
    const sig = SIGNATURES[run.agent];
    if (sig && sig.ammo !== 'none') {
      const a = AMMO_PICKUP[sig.ammo];
      offers.push({ key: 'ammo', kind: 'ammo', ref: sig.ammo, name: a.name, desc: `${sig.ranged} 예비 +${a.amount}`, price: priceAt(sig.ammo === 'rifle' ? 30 : 15, depth), stock: 4 });
    }
    if (rand(st) < 0.6) {
      const ws = ['pipe', 'kitchenknife', 'servicepistol', 'shotgun', 'smg'];
      const id = ws[Math.floor(rand(st) * ws.length)];
      const w = WEAPONS[id];
      offers.push({ key: 'w:' + id, kind: 'weapon', ref: id, name: w.name, desc: `${w.cls === 'gun' ? '총' : '한 손 근접'} · ${w.cls === 'gun' ? '탄' : '내구'} ${w.uses} · ${w.desc}`, price: priceAt(w.cls === 'gun' ? 55 : 30, depth), stock: 1 });
    }
  } else if (vendor === 'backalley') {
    for (const c of CLINIC) offers.push({ key: 'c:' + c.id, kind: 'clinic', ref: c.id, name: c.name, desc: c.desc, price: priceAt(c.price, depth), stock: 1 });
  } else if (vendor === 'shinyuri') {
    LOANS.forEach((l, i) =>
      offers.push({ key: 'l:' + i, kind: 'loan', ref: String(i), name: `현금 ${l.cash}`, desc: `귀환 후 예산 ${l.debt} 상환. 못 갚으면 유물 압류`, price: 0, stock: 1, debt: l.debt }),
    );
  } else {
    offers.push({ key: 'g:cash', kind: 'gamble', ref: 'cash', name: '동전 넣기', desc: '무작위 아이템 하나', price: priceAt(25, depth), stock: 3 });
    offers.push({ key: 'g:hp', kind: 'gamble', ref: 'hp', name: '다른 것을 넣기', desc: '체력 20%를 내고 무작위 아이템 하나', price: 0, stock: 2, hpCost: 0.2 });
  }
  return { vendor, depth, seed: st.seed, offers, buys: vendor === 'madeokhee', greet };
}

export type BuyResult =
  | { ok: true; got: string; heal?: number; cure?: string[]; hpCost?: number }
  | { ok: false; why: 'cash' | 'stock' | 'full' | 'ammoFull' | 'loan'; currency?: 'hp'; message?: string };
/** 체력 거래 직전 엔진의 현재 상태. 지급과 체력 차감은 같은 호출 안에서 처리한다. */
export interface BuyContext {
  hp: number;
  max: number;
  /** 현재 걸려 있고 onBuy에서 실제 제거할 수 있는 상태만 전달한다. */
  curable?: readonly string[];
}
/** 하나 산다. 체력·상태 적용은 엔진 몫(heal 비율, cure 목록, hpCost 비율을 돌려준다). */
export function buy(shop: Shop, run: ItemRun, key: string, ctx?: BuyContext): BuyResult {
  const o = shop.offers.find(x => x.key === key);
  if (!o || o.stock <= 0) return { ok: false, why: 'stock' };
  if (run.cash < o.price) return { ok: false, why: 'cash' };
  // 엔진의 최소 체력 1 보정으로 대가가 사라지지 않도록, 지급 전에 전액 지불을 확인한다.
  // 체력 정보가 연결되지 않은 호출도 무료 지급으로 처리하지 않는다.
  if (o.hpCost && (!ctx || !Number.isFinite(ctx.hp) || !Number.isFinite(ctx.max) || ctx.max <= 0 || ctx.hp - ctx.max * o.hpCost < 1))
    return { ok: false, why: 'cash', currency: 'hp' };
  let res: BuyResult;
  switch (o.kind) {
    case 'item':
      if (!canAddItem(run, o.ref)) return { ok: false, why: 'full' };
      addItem(run, o.ref);
      res = { ok: true, got: o.name };
      break;
    case 'ammo':
      if (!addAmmo(run)) return { ok: false, why: 'ammoFull' };
      res = { ok: true, got: o.name };
      break;
    case 'weapon':
      // 손에 든 임시 무기는 상인이 가져간다(가방을 안 쓰므로)
      equip(run, o.ref);
      res = { ok: true, got: o.name };
      break;
    case 'clinic': {
      const c = CLINIC.find(x => x.id === o.ref)!;
      const heal = ctx && Number.isFinite(ctx.hp) && Number.isFinite(ctx.max) && ctx.hp > 0 && ctx.hp < ctx.max ? c.heal : 0;
      const cure = c.cure.filter(status => ctx?.curable?.includes(status));
      if (!heal && !cure.length) return { ok: false, why: 'stock', message: '지금은 받을 수 있는 치료가 없다' };
      res = { ok: true, got: o.name, heal, cure };
      break;
    }
    case 'loan': {
      if (run.debt > 0) return { ok: false, why: 'loan' };
      const l = LOANS[+o.ref];
      run.cash += l.cash;
      run.debt += l.debt;
      for (const x of shop.offers) if (x.kind === 'loan') x.stock = 0;
      return { ok: true, got: o.name };
    }
    case 'gamble': {
      const st = { seed: shop.seed };
      const ids = Object.keys(ITEMS).filter(id => canAddItem(run, id));
      if (!ids.length) return { ok: false, why: 'full' };
      const id = ids[Math.floor(rand(st) * ids.length)];
      shop.seed = st.seed;
      addItem(run, id);
      res = { ok: true, got: ITEMS[id].name, hpCost: o.hpCost };
      break;
    }
  }
  run.cash -= o.price;
  o.stock--;
  return res;
}
/** 마덕희에게 회수물 팔기(가방 칸 번호) */
export function sell(shop: Shop, run: ItemRun, bagIndex: number): number {
  const b = run.bag[bagIndex];
  if (!shop.buys || !b) return 0;
  const price = sellPrice(shop, b.value);
  run.bag[bagIndex] = null;
  run.cash += price;
  return price;
}
export const sellPrice = (shop: Shop, value: number) => Math.round(value * (1 + shop.depth * 0.03));
