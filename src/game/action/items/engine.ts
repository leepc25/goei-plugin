import type { GameEvent, Hit, React, WBox } from '../engine/contract';
import { PROPS, WEAPONS } from './data';
import { damageProp, explode, type Field, type ItemEvent, type PropEnt } from './field';
import { useWeapon, type ItemRun } from './inventory';
/**
 * 엔진(docs/게임_모듈_연결.md) 쪽 모양으로 바꾸는 얇은 층. 타입만 가져오고 엔진 코드는 부르지 않는다.
 * 엔진이 적 판정을 직접 할 때: stepField에 targets를 빈 배열로 넘기고
 *   projectileHits(field) → 적 피격 상자와 겹치면 hitProp(field, run, projId, targetId)
 *   breakableBoxes(field) → 플레이어 공격 상자와 겹치면 strikeProp(field, run, propId, dmg)
 */

const TICK = 30;
let attackSeq = 900000;
const react = (knockdown: boolean, kb: number): React => (knockdown ? 'down' : kb >= 140 ? 'stagger' : 'flinch');

/** 날아가는 투척물·탄을 엔진 Hit 상자로. projId로 hitProp을 부른다. */
export function projectileHits(field: Field): (Hit & { projId: number })[] {
  const out: (Hit & { projId: number })[] = [];
  for (const p of field.projs) {
    if (p.kind === 'grenade') continue;
    const half = p.kind === 'prop' ? 34 : 14;
    out.push({
      projId: p.id,
      attackId: 1_000_000 + p.id,
      x0: p.x - half,
      x1: p.x + half,
      z0: p.z - (p.kind === 'prop' ? 30 : 8),
      z1: p.z + (p.kind === 'prop' ? 30 : 8),
      y: p.y,
      dy: p.kind === 'prop' ? 26 : 18,
      dmg: p.damage,
      react: react(p.knockdown, p.knockback),
      dir: p.vx >= 0 ? 1 : -1,
      push: p.knockback / TICK,
      armorBreak: p.armorBreak,
      strength: p.kind === 'prop' ? 3 : 1,
    });
  }
  return out;
}
/** 엔진이 투사체가 적을 맞혔다고 알릴 때. 탄·물건은 거기서 끝나고, 터지는 물건은 터진다. */
export function hitProp(field: Field, run: ItemRun, projId: number, targetId: number): ItemEvent[] {
  const p = field.projs.find(q => q.id === projId);
  if (!p || p.hit.includes(targetId)) return [];
  p.hit.push(targetId);
  field.projs.splice(field.projs.indexOf(p), 1);
  if (p.kind !== 'prop') return [];
  const def = PROPS[p.ref];
  const ev: ItemEvent[] = [{ t: 'break', prop: p.ref, x: p.x, y: p.y }];
  if (def.burst) ev.push(...explode(field, run, def.burst, p.x, p.y, def.id, [], def.knockdown));
  return ev;
}
/** 부술 수 있는 환경 물건의 피격 상자 */
export function breakableBoxes(field: Field): (WBox & { propId: number })[] {
  return field.ents
    .filter((e): e is PropEnt => e.type === 'prop' && PROPS[e.prop].use !== 'throw')
    .map(e => {
      const d = PROPS[e.prop];
      return { propId: e.id, x0: e.x - d.w / 2, x1: e.x + d.w / 2, z0: 0, z1: d.h, y: e.y, dy: 24 };
    });
}
export function strikeProp(field: Field, run: ItemRun, propId: number, dmg: number): ItemEvent[] {
  const e = field.ents.find(x => x.id === propId);
  return e && e.type === 'prop' ? damageProp(field, run, e, dmg) : [];
}
/**
 * 임시 무기를 든 채 A(근접 묶음) 또는 S(총 묶음) 한 번. 한 번 쓰는 값만큼 내구·탄이 준다.
 * null이면 고유 동작 그대로. 돌려준 값을 엔진 공격에 그대로 쓰거나 곱한다.
 */
export function weaponAttack(run: ItemRun, kind: 'melee' | 'shot') {
  const w = useWeapon(run, kind === 'melee' ? 'melee' : 'gun');
  if (!w) return null;
  const d = w.def;
  return {
    weapon: d.id,
    /** 요원 몸짓 클립: 한 손 근접 묶음 = pipe, 총 묶음 = shotgun (엔진의 기존 클립 이름) */
    clip: d.cls === 'melee' ? 'pipe' : 'shotgun',
    dmg: d.damage,
    push: d.knockback / TICK,
    react: react(false, d.knockback),
    reach: d.reach,
    pellets: d.pellets ?? 1,
    spread: d.spread ?? 0,
    rate: d.rate,
    status: d.status,
    armorBreak: !!d.armorBreak,
    vsHuman: d.vsHuman ?? 1,
    left: w.left,
    broke: w.broke,
  };
}
/** 아이템 이벤트 → 엔진 GameEvent(효과음 이름). x는 플레이어 위치. */
export function toGameEvents(events: ItemEvent[], x: number, ammo = 0): GameEvent[] {
  const out: GameEvent[] = [];
  for (const e of events) {
    switch (e.t) {
      case 'pickup':
        out.push({ type: e.kind === 'heal' ? 'heal' : 'pickup', x: e.x, id: e.ref ?? e.kind });
        break;
      case 'equip':
        out.push({ type: 'pickup', x, id: e.weapon });
        break;
      case 'lift':
        out.push({ type: 'pickup', x, id: e.prop });
        break;
      case 'use':
        out.push({ type: e.effect.type === 'heal' || e.effect.type === 'cure' ? 'heal' : 'item', x, id: e.id });
        break;
      case 'shot':
        out.push({ type: 'shot', x: e.x, ammo });
        break;
      case 'dry':
        out.push({ type: 'empty', x });
        break;
      case 'reload':
        out.push({ type: 'reload', x });
        break;
      case 'throw':
        out.push({ type: 'whiff', x });
        break;
      case 'break':
      case 'burst':
      case 'weaponBreak':
      case 'full':
      case 'drop':
        out.push({ type: 'custom', name: 'item:' + e.t, data: e });
        break;
    }
  }
  return out;
}
export { WEAPONS };
