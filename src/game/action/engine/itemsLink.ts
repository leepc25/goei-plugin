// 아이템 모듈(items/) 연결: 1~4 소모품, 처치 드랍·자동 줍기(현금·파편·회복·탄·아이템·회수물), 섬광·연막 투척, 탄약 맞추기.
// 임시 무기(쇠파이프·산탄총)는 아직 엔진 동작에 안 붙였다 (줍기 E를 넘기지 않음).
import {
  ITEMS,
  createField,
  createItemRun,
  drawItemIcon,
  dropFromKill,
  stepField,
  toGameEvents,
  type Field,
  type ItemEvent,
  type ItemRun,
  type Target,
} from '../items';
import { TICK_HZ, type Body, type RunConfigCore } from './contract';
import { Fighter } from './fighter';
import type { World } from './world';

const DROP_TABLE: Record<string, string> = { thug: 'anomaly', dummy: 'anomaly' };

export function linkItems(w: World, run: RunConfigCore & { launch?: { items?: ({ id: string; n: number } | null)[] } }) {
  const loadout = run.launch?.items ?? [{ id: 'medkit', n: 2 }, { id: 'flash', n: 2 }, { id: 'adrenaline', n: 1 }, null];
  const ir: ItemRun = createItemRun('jyaldi', loadout.map((s) => (s ? { id: s.id, n: s.n } : null)));
  let field: Field = createField(run.seed, 1);
  const p = w.player;
  p.mag = p.ammo = ir.mag || p.mag;
  p.reserve = ir.reserve;
  let lastReserve = ir.reserve;
  (w as unknown as { itemRun: ItemRun }).itemRun = ir;

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
    }
    if (e.type === 'enemyDie') apply(dropFromKill(field, ir, DROP_TABLE[e.kind] ?? 'anomaly', e.x, w.player.y));
  });

  return {
    run: ir,
    tick() {
      lastReserve = ir.reserve = p.reserve;
      apply(stepField(field, ir, { x: p.x, y: p.y, z: p.z, dir: p.dir }, {}, targets(), 1 / TICK_HZ, ctx()));
      w.notes.cash = ir.cash;
      w.notes.shards = ir.shards;
      w.notes.debt = ir.debt;
      w.notes.bag = ir.bag.map((b) => (b ? { id: b.id, name: b.name } : null));
      w.notes.itemsLeft = ir.loadout.map((s) => (s ? { id: s.id, n: s.n } : null));
    },
    draw(c: CanvasRenderingContext2D, camX: number) {
      for (const e of field.ents) {
        if (e.type !== 'pickup') continue;
        const x = e.x - camX;
        const y = e.y - e.z;
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath();
        c.ellipse(x, e.y, 14, 5, 0, 0, Math.PI * 2);
        c.fill();
        const bob = Math.sin((w.tick + e.id * 7) / 6) * 3;
        const id = e.ref ?? e.kind;
        drawItemIcon(c, id, x - 14, y - 34 + bob, 28);
      }
      for (const pj of field.projs) {
        c.fillStyle = '#d8e0e4';
        c.fillRect(pj.x - camX - 5, pj.y - pj.z - 5, 10, 10);
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
