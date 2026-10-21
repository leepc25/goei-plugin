// 아이템 모듈(items/) 연결: 1~4 소모품, 처치 드랍·자동 줍기(현금·파편·회복·탄·아이템·회수물), 섬광·연막 투척, 탄약 맞추기.
// 환경 물건 들기(E)·던지기(A), 임시 무기 줍기(E)·휘두르기(A)·쏘기(S). 든 것은 캐릭터 그림과 따로 손 고정점에 그린다.
import { drawItemHeld } from '../art/items';
import {
  ITEMS,
  PROPS,
  WEAPONS,
  placeProp,
  spawnPickup,
  createField,
  createItemRun,
  drawItemIcon,
  dropFromKill,
  spawnEnemyDrops,
  strikeProps,
  furnishFloor,
  openShop,
  createShopPanel,
  VENDORS,
  type ShopPanel,
  type VendorId,
  type EnemyDrop,
  stepField,
  toGameEvents,
  type Field,
  type ItemEvent,
  type ItemRun,
  type Target,
} from '../items';
import { TICK_HZ, type Body, type RunConfigCore } from './contract';
import { drawPropArt } from '../art/bg';

/** 층에 깔아도 되는 부서지는 물건: 배경 물건 그림이 있거나 아이콘이 물건처럼 보이는 것 */
const PROP_ART = new Set(['chair', 'pot', 'tv', 'table', 'crate']);
import { Fighter } from './fighter';
import { blockByProps, nudgeProp } from './propBlock';
import type { World } from './world';

// 적 모듈에 없는 임시 적만 아이템 표로 굴린다. 적 모듈 적은 그쪽 드랍(custom 'enemyDrop')을 바닥에 놓는다.
const DROP_TABLE: Record<string, string> = { thug: 'anomaly', dummy: 'anomaly' };

/** 바닥에 떨어진 물건 그림을 캐릭터와 같은 배율(도트 1 = 화면 2)로, 아래 가운데를 (x, y)에 */
const FLOOR_ALIAS: Record<string, string> = { heal: 'heal_orb', ammo: 'rounds', coin: 'coins' };
const floorImgs = new Map<string, HTMLImageElement>();
function drawFloorArt(c: CanvasRenderingContext2D, id: string, x: number, y: number): boolean {
  const all = (typeof window !== 'undefined' && (window as { __GOEI_ITEM_ART__?: Record<string, { src: string; w: number; h: number }> }).__GOEI_ITEM_ART__) || {};
  const a = all[id] ?? all[FLOOR_ALIAS[id] ?? ''];
  if (!a) return false;
  let im = floorImgs.get(a.src);
  if (!im) floorImgs.set(a.src, (im = Object.assign(new Image(), { src: a.src })));
  if (!im.complete || !im.naturalWidth) return false;
  const w = a.w * 2,
    h = a.h * 2;
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(im, Math.round(x - w / 2), Math.round(y - h), w, h);
  c.imageSmoothingEnabled = prev;
  return true;
}

/** 환경 물건(가구)은 손에 드는 배율이 아니라 실제 크기: 그림 높이를 PROPS[id].h(화면 px)에 맞춘다. 아래 가운데 = (x, y) */
function drawPropSized(c: CanvasRenderingContext2D, id: string, x: number, y: number): boolean {
  const d = PROPS[id];
  const all = (typeof window !== 'undefined' && (window as { __GOEI_ITEM_ART__?: Record<string, { src: string; w: number; h: number }> }).__GOEI_ITEM_ART__) || {};
  const a = all[id];
  if (!a || !d) return false;
  let im = floorImgs.get(a.src);
  if (!im) floorImgs.set(a.src, (im = Object.assign(new Image(), { src: a.src })));
  if (!im.complete || !im.naturalWidth) return false;
  const h = d.h,
    w = (a.w * h) / a.h;
  const prev = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(im, Math.round(x - w / 2), Math.round(y - h), Math.round(w), h);
  c.imageSmoothingEnabled = prev;
  return true;
}

// 중림 상인 거래 창 (무대 위에 겹침). 열려 있으면 전투를 멈춘다: modules.ts의 blocking에서 itemsBlocking()
let shopPanel: ShopPanel | null = null;
export const itemsBlocking = () => !!shopPanel?.isOpen();
export function mountItemsOverlay(root: HTMLElement) {
  shopPanel?.dispose();
  shopPanel = createShopPanel(root);
  return () => (shopPanel?.dispose(), (shopPanel = null));
}

export function linkItems(w: World, run: RunConfigCore & { launch?: { items?: ({ id: string; n: number } | null)[] } }) {
  const loadout = run.launch?.items ?? [{ id: 'medkit', n: 2 }, { id: 'flash', n: 2 }, { id: 'adrenaline', n: 1 }, null];
  const ir: ItemRun = createItemRun('jyaldi', loadout.map((s) => (s ? { id: s.id, n: s.n } : null)));
  let field: Field = createField(run.seed, 1);
  const p = w.player;
  p.mag = p.ammo = ir.mag || p.mag;
  p.reserve = ir.reserve;
  let lastReserve = ir.reserve;
  (w as unknown as { itemRun: ItemRun }).itemRun = ir;
  (w as unknown as { itemField: () => Field }).itemField = () => field;

  const syncSlots = () => {
    w.items = ir.loadout.map((s) => (s ? { id: s.id, label: ITEMS[s.id]?.name ?? s.id, n: s.n } : null));
  };
  syncSlots();
  const targets = (): Target[] =>
    w.bodies
      .filter((b) => b.team === 'enemy' && b.alive && b.hp > 0)
      .map((b) => ({ id: b.id, x: b.x, y: b.y, z: b.z, w: 56, h: 170, human: true }));
  const ctx = () => ({ hp: p.hp, max: p.hpMax, gauge: p.gauge / 100, energy: p.skillCd > 0 ? 0 : 1, energyMax: 1 });

  const apply = (evs: ItemEvent[]) => {
    for (const e of evs) {
      if (e.t === 'hit') {
        const b = w.bodies.find((x) => x.id === e.target);
        if (!b) continue;
        if (e.status === 'stun' && b instanceof Fighter && b.phase === 'free') {
          b.enter('hurt', Math.round((e.stun ?? 2) * TICK_HZ));
          w.fx('ring', b.x, b.y, 100, '2');
        } else if (e.damage > 0) b.applyHit({ x0: b.x, x1: b.x, z0: 0, z1: 0, y: b.y, attackId: -1, dmg: e.damage, react: e.knockdown ? 'down' : 'stagger', dir: e.x < p.x ? -1 : 1, push: e.knockback / 30, armorBreak: e.armorBreak }, w);
      } else if (e.t === 'use') {
        const f = e.effect;
        if (f.type === 'heal') p.hp = Math.min(p.hpMax, p.hp + p.hpMax * f.ratio);
        else if (f.type === 'cure') p.hp = Math.min(p.hpMax, p.hp + p.hpMax * (f.heal ?? 0));
        else if (f.type === 'gauge') p.gauge = Math.min(100, p.gauge + f.amount * 100);
        else if (f.type === 'energy') p.skillCd = 0;
        else if (f.type === 'ward') p.ward += f.hits;
      } else if (e.t === 'pickup' && e.kind === 'heal') {
        p.hp = Math.min(p.hpMax, p.hp + p.hpMax * 0.08);
      }
    }
    for (const g of toGameEvents(evs, p.x, p.ammo)) w.emit(g as never);
    if (ir.reserve !== lastReserve) {
      p.reserve += ir.reserve - lastReserve;
      ir.reserve = lastReserve = p.reserve;
    }
    syncSlots();
  };

  const actor = () => ({ x: p.x, y: p.y, z: p.z, dir: p.dir });
  const syncCarry = () => {
    p.carry = ir.carry
      ? { kind: 'prop', id: ir.carry.prop, hold: 'over' }
      : ir.held
        ? { kind: 'weapon', id: ir.held.id, hold: 'hand', cls: WEAPONS[ir.held.id]?.cls }
        : null;
  };
  const melee = { damage: 12, reach: 110 };
  p.itemAct = (k) => {
    if (ir.carry) {
      apply(stepField(field, ir, actor(), { attack: true }, targets(), 0, ctx(), melee));
      syncCarry();
      return 'toss';
    }
    const cls = ir.held ? WEAPONS[ir.held.id]?.cls : undefined;
    if (k === 'attack' && cls === 'melee') {
      apply(stepField(field, ir, actor(), { attack: true }, targets(), 0, ctx(), melee));
      syncCarry();
      return 'wswing';
    }
    if (k === 'shoot' && cls === 'gun') {
      apply(stepField(field, ir, actor(), { shoot: true }, targets(), 0, ctx()));
      syncCarry();
      return 'wfire';
    }
    return null;
  };
  w.pickHook = () => {
    const before = `${ir.carry?.prop}|${ir.held?.id}|${field.ents.length}`;
    const evs = stepField(field, ir, actor(), { interact: true }, targets(), 0, ctx());
    apply(evs);
    syncCarry();
    const changed = evs.length > 0 || before !== `${ir.carry?.prop}|${ir.held?.id}|${field.ents.length}`;
    if (changed && p.phase === 'free' && !p.move && p.z <= 0) p.play('pickup', w);
    return changed;
  };
  w.drawHeld = (c, carry, sx, sy, deg, dir) => {
    c.save();
    c.translate(sx, sy);
    if (dir < 0) c.scale(-1, 1);
    if (carry.kind === 'prop') {
      const d = PROPS[carry.id];
      const s = Math.max(d?.w ?? 60, d?.h ?? 60);
      // 머리 위로 들어 올린 높이 (머리에 겹치지 않게 조금 띄움), 바닥과 같은 실제 크기
      if (!drawPropSized(c, carry.id, 0, -18)) drawItemIcon(c, carry.id, -s / 2, -s - 18, s);
    } else if (!drawItemHeld(c, carry.id, deg)) {
      // 무기 그림의 손잡이 = 그림 아래쪽 1/4 지점. 각도 0 = 위로 세움, 시계 방향
      c.rotate(((deg + 45) * Math.PI) / 180);
      drawItemIcon(c, carry.id, -12, -36, 48);
    }
    c.restore();
  };

  w.itemUse = (slot) => {
    const evs = stepField(field, ir, { x: p.x, y: p.y, z: p.z, dir: p.dir }, { use: slot - 1 }, targets(), 0, ctx());
    const used = evs.find((e) => e.t === 'use') as Extract<ItemEvent, { t: 'use' }> | undefined;
    apply(evs);
    if (!used) {
      if (w.items[slot - 1]) w.say('지금은 쓸 필요가 없다', 1);
      return false;
    }
    const t = used.effect.type;
    return { anim: t === 'heal' || t === 'energy' || t === 'gauge' ? 'drink' : t === 'cure' ? 'bandage' : t === 'flash' || t === 'smoke' ? 'toss' : 'drink', consumed: true };
  };

  w.on((e) => {
    if (e.type === 'enter:floor') {
      field = createField(run.seed + w.floors * 7919, e.floor.depth ?? 1, { x0: 20, x1: e.floor.length - 20, y0: w.lane[0], y1: w.lane[1] });
      // 층마다 들 물건 둘, 부술 물건 둘, 임시 무기 하나 (층 소품·출구를 피해서)
      // 지형(단·구덩이·좁은 길·낮은 천장) 위에도 놓지 않는다 (검수 12-2: TV가 단 모서리에 걸침)
      const terr = ((e.floor as { stage?: { terrain?: { x0: number; x1: number }[] } }).stage?.terrain ?? []).map((t) => ({ x: (t.x0 + t.x1) / 2, w: t.x1 - t.x0 + 360 }));
      furnishFloor(field, { ...e.floor, props: [...(e.floor.props ?? []).map((p) => ({ x: p.x, w: Math.max(p.w, 130) })), ...terr] }, w.lane, () => w.rand());
      // 그림이 없는 물건(회색 기둥처럼 보이는 아이콘 대역)은 층에 두지 않는다 (재검수 2-1)
      field.ents = field.ents.filter((q) => q.type !== 'prop' || PROP_ART.has(q.prop));
      syncCarry();
    }
    if (e.type === 'enemyDie' && DROP_TABLE[e.kind]) apply(dropFromKill(field, ir, DROP_TABLE[e.kind], e.x, w.player.y));
    if (e.type === 'custom' && e.name === 'enemyDrop') {
      const d = e.data as { kind: string; x: number; y: number; drops: EnemyDrop[] };
      apply(spawnEnemyDrops(field, ir, d.drops, d.x, d.y, d.kind));
    }
  });

  // 중림 상인: 층 모듈의 merchant 소품 앞 E
  let shopSeed = run.seed ^ 0x5151;
  w.interactHooks.push((prop) => {
    if (prop?.kind !== 'merchant' || !shopPanel || shopPanel.isOpen()) return;
    const ids = Object.keys(VENDORS) as VendorId[];
    const vendor = ids.find((v) => prop.label?.includes(VENDORS[v].name)) ?? 'madeokhee';
    const shop = openShop(vendor, ir, w.floor?.depth ?? 1, shopSeed + (w.floors | 0) * 131);
    lastReserve = ir.reserve = p.reserve;
    shopPanel.open(shop, ir, (r) => {
      if (r.heal) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * r.heal);
      if (r.hpCost) p.hp = Math.max(1, p.hp - p.hpMax * r.hpCost);
      apply([]);
      syncCarry();
      w.emit({ type: 'pickup', x: p.x, id: 'shop' });
    }, () => w.say(VENDORS[vendor].bye, 2));
  });

  const hitSeen = new Set<string>();
  const overlapT = new WeakMap<object, number>();
  // 검사 스크립트용: 바닥 물건 목록 (화면 검수에서 물건·몸 겹침을 숫자로 잰다)
  Object.defineProperty(w, 'itemField', { get: () => field, configurable: true });
  return {
    run: ir,
    /** 시연(?start=items): 들 물건·임시 무기를 한 줄로 늘어놓는다 */
    showcase() {
      const ym = (w.lane[0] + w.lane[1]) / 2;
      Object.keys(PROPS).forEach((id, i) => placeProp(field, id, 520 + i * 150, ym + ((i % 2) * 2 - 1) * 50));
      Object.keys(WEAPONS).forEach((id, i) => spawnPickup(field, 'weapon', 600 + i * 140, ym));
    },
    tick() {
      lastReserve = ir.reserve = p.reserve;
      // 플레이어 공격 상자로 상자·서랍장·드럼통 부수기
      const hits = p.frame().hit;
      if (hits.length) apply(strikeProps(field, ir, hits, hitSeen, targets()));
      apply(stepField(field, ir, { x: p.x, y: p.y, z: p.z, dir: p.dir }, {}, targets(), 1 / TICK_HZ, ctx()));
      // 바닥 물건 뚫고 지나가기 금지: 요원·적 모두 (검수 15-2)
      const ents = field.ents.filter((e) => e.type === 'prop' && PROPS[e.prop]);
      const solids = ents.map((e) => ({ x: e.x, y: e.y, w: PROPS[(e as { prop: string }).prop].w }));
      if (solids.length) {
        const bodies = [p, ...w.bodies].filter((b) => b.alive && b.kind !== 'bullet' && b.kind !== 'item' && b.team !== 'neutral');
        const stuck = blockByProps(bodies, solids, w.lane);
        // 0.5초 넘게 겹쳐 있으면(제자리에 묶인 적) 물건을 옆으로 옮긴다
        ents.forEach((e, i) => {
          const n = stuck.has(i) ? (overlapT.get(e) ?? 0) + 1 : 0;
          overlapT.set(e, n);
          if (n > TICK_HZ / 2) nudgeProp(solids[i], bodies, solids, 40, (w.floor?.length ?? 99999) - 40), (e.x = solids[i].x), overlapT.set(e, 0);
        });
      }
      syncCarry();
      w.notes.cash = ir.cash;
      w.notes.held = ir.held ? { name: WEAPONS[ir.held.id].name, uses: ir.held.uses, max: WEAPONS[ir.held.id].uses } : null;
      w.notes.shards = ir.shards;
      w.notes.debt = ir.debt;
      w.notes.bag = ir.bag.map((b) => (b ? { id: b.id, name: b.name } : null));
      w.notes.itemsLeft = ir.loadout.map((s) => (s ? { id: s.id, n: s.n } : null));
    },
    draw(c: CanvasRenderingContext2D, camX: number) {
      for (const e of field.ents) {
        if (e.type === 'prop') {
          const d = PROPS[e.prop];
          const s = Math.max(d?.w ?? 60, d?.h ?? 60);
          c.fillStyle = 'rgba(0,0,0,0.3)';
          c.beginPath();
          c.ellipse(e.x - camX, e.y, s * 0.4, 6, 0, 0, Math.PI * 2);
          c.fill();
          if (e.flash > 0) c.globalAlpha = 0.6;
          // 배경 물건 그림이 있으면 그것, 없으면 아이콘
          if (!drawPropArt(c, `item_${e.prop}`, d?.name, e.x - camX, e.y) && !drawPropSized(c, e.prop, e.x - camX, e.y)) drawItemIcon(c, e.prop, e.x - camX - s / 2, e.y - s, s);
          c.globalAlpha = 1;
          continue;
        }
        if (e.type !== 'pickup') continue;
        const x = e.x - camX;
        const y = e.y - e.z;
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath();
        c.ellipse(x, e.y, 14, 5, 0, 0, Math.PI * 2);
        c.fill();
        const bob = Math.sin((w.tick + e.id * 7) / 6) * 3;
        const id = e.ref ?? e.kind;
        // 바닥 크기 = 손에 든 것과 같은 배율(도트 1 = 화면 2). 그림이 없으면 코드 아이콘 28px
        if (!drawFloorArt(c, id, x, y - 4 + bob)) drawItemIcon(c, id, x - 14, y - 34 + bob, 28);
      }
      for (const pj of field.projs) {
        c.fillStyle = '#d8e0e4';
        if (pj.kind === 'prop' && pj.ref) {
          if (!drawPropSized(c, pj.ref, pj.x - camX, pj.y - pj.z + (PROPS[pj.ref]?.h ?? 56) / 2)) drawItemIcon(c, pj.ref, pj.x - camX - 28, pj.y - pj.z - 28, 56);
        }
        else c.fillRect(pj.x - camX - 5, pj.y - pj.z - 5, 10, 10);
      }
      for (const z of field.zones) {
        c.strokeStyle = z.kind === 'salt' ? 'rgba(240,240,240,0.6)' : 'rgba(160,170,180,0.5)';
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(z.x - camX, z.y, z.r, z.r * 0.35, 0, 0, Math.PI * 2);
        c.stroke();
      }
    },
    bodiesHit(_b: Body) {},
  };
}
