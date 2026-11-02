import type { WBox } from '../engine/contract';
import { PROPS, WEAPONS } from './data';
import { damageProp, placeProp, rand, spawnPickup, type Field, type ItemEvent, type PropEnt, type Target } from './field';
import { usesAmmo, type ItemRun } from './inventory';
/**
 * 통합 게임(engine/itemsLink.ts)이 부르는 도우미. 적 모듈이 굴린 드랍을 바닥에 놓고,
 * 플레이어 공격 상자로 물건을 부수고, 층마다 들 물건·부술 물건·임시 무기를 놓는다.
 */

/** 적 모듈 Drop.item 그대로 */
export interface EnemyDrop {
  item: 'heal' | 'ammo';
  n: number;
}
/** 적이 들고 있던 임시 무기 (부록 F.2). 적 모듈 종류 이름 기준 */
export const ENEMY_WEAPONS: Record<string, { p: number; pool: string[] }> = {
  fb_smg: { p: 0.3, pool: ['smg'] },
  fb_sword: { p: 0.5, pool: ['katana'] },
  fb_chief: { p: 0.35, pool: ['servicepistol', 'shotgun'] },
  fb_shield: { p: 0.2, pool: ['pipe'] },
  dd_member: { p: 0.1, pool: ['kitchenknife'] },
};
/** 적 모듈 드랍 → 바닥. 탄을 안 쓰는 요원에게는 탄이 안 떨어진다. */
export function spawnEnemyDrops(field: Field, run: ItemRun, drops: EnemyDrop[], x: number, y: number, kind = ''): ItemEvent[] {
  const ev: ItemEvent[] = [];
  const put = (k: Parameters<typeof spawnPickup>[1], ref?: string, amount = 1) => {
    spawnPickup(field, k, x, y, ref, amount);
    ev.push({ t: 'drop', kind: k, ref, x, y });
  };
  for (const d of drops) {
    if (!Number.isSafeInteger(d.n) || d.n <= 0) continue;
    switch (d.item) {
      case 'heal':
        for (let i = 0; i < d.n; i++) put('heal');
        break;
      case 'ammo':
        if (usesAmmo(run)) for (let i = 0; i < d.n; i++) put('ammo');
        break;
    }
  }
  // 탄이 바닥나면 탄을 조금 더 자주 (막힘 방지)
  if (usesAmmo(run) && run.mag + run.reserve < 8 && rand(field) < 0.25) put('ammo');
  const w = ENEMY_WEAPONS[kind];
  if (w && rand(field) < w.p) put('weapon', w.pool[Math.floor(rand(field) * w.pool.length)]);
  return ev;
}

/**
 * 플레이어 공격 상자로 부서지는 물건을 친다. seen에 (attackId:물건id)를 남겨 한 동작에 한 번만.
 * 엔진이 매 틱 player.frame().hit을 넘긴다.
 */
export function strikeProps(field: Field, run: ItemRun, hits: (WBox & { attackId: number; dmg: number })[], seen: Set<string>, targets: Target[] = []): ItemEvent[] {
  const ev: ItemEvent[] = [];
  if (!hits.length) return ev;
  for (const e of field.ents.slice()) {
    if (e.type !== 'prop' || !field.ents.includes(e)) continue;
    const d = PROPS[e.prop];
    if (d.use === 'throw') continue;
    for (const h of hits) {
      const key = h.attackId + ':' + e.id;
      if (seen.has(key)) continue;
      if (h.x1 < e.x - d.w / 2 || h.x0 > e.x + d.w / 2 || h.z0 > d.h + 110 || h.z1 < 0 || Math.abs(h.y - e.y) > (h.dy ?? 18) + 24) continue;
      seen.add(key);
      ev.push(...damageProp(field, run, e as PropEnt, Math.max(6, h.dmg), targets));
      break;
    }
  }
  if (seen.size > 400) seen.clear();
  return ev;
}

/** 층 하나에 물건을 놓는다: 들 물건 둘, 부술 물건 둘, 임시 무기 하나. 층 모듈 소품·출구와 겹치지 않게. */
export function furnishFloor(
  field: Field,
  floor: { length: number; startX?: number; exitX?: number; props?: { x: number; w: number }[] },
  lane: [number, number],
  r: () => number = () => rand(field),
): void {
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const end = Number.isFinite(floor.exitX) ? floor.exitX! : floor.length - 80;
  const x0 = (floor.startX ?? 200) + 260,
    x1 = Math.max(x0 + 200, Math.min(end, floor.length - 80) - 160);
  const taken = (floor.props ?? []).map(p => [p.x - (p.w ?? 40) / 2 - 60, p.x + (p.w ?? 40) / 2 + 60] as const);
  const spot = (): number | null => {
    for (let i = 0; i < 12; i++) {
      const x = x0 + r() * (x1 - x0);
      if (!taken.some(([a, b]) => x > a && x < b)) {
        taken.push([x - 90, x + 90]);
        return x;
      }
    }
    return null;
  };
  const front = lane[1] - 20,
    back = lane[0] + 10;
  const put = (id: string, y: number) => {
    const x = spot();
    if (x !== null) placeProp(field, id, x, y);
  };
  put(pick(['chair', 'bin', 'pot']), front - r() * 40);
  put(pick(['tv', 'extinguisher', 'table', 'chair']), front - 20 - r() * 40);
  put(pick(['crate', 'crate', 'drawer', 'mailbox']), back);
  put(pick(['barrel', 'locker', 'crate']), back + r() * 20);
  const wx = spot();
  if (wx !== null) {
    const p = spawnPickup(field, 'weapon', wx, (lane[0] + lane[1]) / 2, pick(Object.keys(WEAPONS).filter(id => id !== 'katana' && id !== 'smg')));
    Object.assign(p, { vx: 0, vy: 0, vz: 0, z: 0 });
  }
}
