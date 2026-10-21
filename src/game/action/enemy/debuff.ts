// 디버프를 엔진에 넘긴다. 엔진은 custom 'debuff'의 text만 화면에 띄우므로 글을 꼭 붙인다.
// 엔진은 Hit.debuff를 모른다: 플레이어 체력이 줄었고 그 자리에 디버프 공격 상자가 있었으면 맞은 것으로 본다.
import type { Debuff, Hit, WorldView } from './types';

export const DEBUFF_TEXT: Record<Debuff['kind'], string> = {
  bleed: '출혈 · 피가 멎지 않는다',
  taint: '오염 · 숨이 탁해진다',
  headache: '두통 · 머리가 울린다',
  confuse: '혼란 · 방향이 뒤집힌다',
  fear: '공포 · 몸이 굳는다',
  slow: '느려졌다',
  silence: '목소리가 안 나온다',
};

type Seen = { tick: number; hp: number; said: Record<string, number> };
const seen = new WeakMap<object, Seen>();
let armed: { hit: Hit; debuff: Debuff; from: number }[] = [];

function state(w: WorldView): Seen {
  let s = seen.get(w);
  if (!s) seen.set(w, (s = { tick: -1, hp: w.player.hp, said: {} }));
  return s;
}

/** 디버프 이벤트. 같은 글은 3초에 한 번만 띄운다 */
export function emitDebuff(w: WorldView, debuff: Debuff, from: number) {
  const s = state(w);
  const quiet = w.tick - (s.said[debuff.kind] ?? -999) < 90;
  if (!quiet) s.said[debuff.kind] = w.tick;
  w.emit({ type: 'custom', name: 'debuff', data: { ...debuff, from, text: quiet ? undefined : DEBUFF_TEXT[debuff.kind] } });
}

/** frame()에서 디버프가 실린 공격 상자를 적어 둔다 */
export function armDebuff(hit: Hit, debuff: Debuff, from: number) {
  armed.push({ hit, debuff, from });
}

/** 틱마다 한 번 (적·투사체 step에서): 지난 틱에 맞았는지 본다 */
export function checkDebuffs(w: WorldView) {
  const s = state(w);
  if (s.tick === w.tick) return;
  s.tick = w.tick;
  const p = w.player;
  if (p.hp < s.hp) {
    for (const a of armed) {
      const h = a.hit;
      if (p.x >= h.x0 - 30 && p.x <= h.x1 + 30 && Math.abs(p.y - h.y) <= (h.dy ?? 20) + 20) {
        emitDebuff(w, a.debuff, a.from);
        break;
      }
    }
  }
  s.hp = p.hp;
  armed = [];
}
