// 처치 보상 (기본 기획서 11장). 여기서는 굴리기만 하고, 바닥에 떨어뜨리고 줍는 것은 아이템 모듈(dropFromKill)이 한다.
// 연결: setDropHook(fn) 한 번. 훅이 없으면 custom 이벤트 'enemyDrop'만 나간다.
import type { DropTable } from './roster';
import type { Drop, WorldView } from './types';

export interface DropContext {
  enemy: { id: number; kind: string; elite: boolean; boss: boolean };
  kind: string;
  x: number;
  y: number;
  drops: Drop[];
  world: WorldView;
}
type Hook = (c: DropContext) => void;
let hook: Hook | null = null;
export function setDropHook(fn: Hook | null) {
  hook = fn;
}
export function fireDropHook(c: DropContext) {
  hook?.(c);
}


/** 처치 드랍 표. 회복 조각·탄만 (옛 출동 현금·이상 파편·회수물·강화 선택은 2026-10-28에 지웠다). 정예는 회복 조각 확률 +10%p */
export function rollDrops(table: DropTable, r: () => number, elite = false): Drop[] {
  const out: Drop[] = [];
  const add = (item: Drop['item'], n: number) => n > 0 && out.push({ item, n });
  const heal = (p: number) => r() < p + (elite ? 0.1 : 0) && add('heal', 1);
  switch (table) {
    case 'none':
      return out;
    case 'common':
      heal(0.15);
      break;
    case 'bureau':
      heal(0.1);
      if (r() < 0.05) add('ammo', 1);
      break;
    case 'daydream':
      heal(0.1);
      break;
    case 'mid':
      add('heal', 1);
      break;
    case 'guardian':
      add('heal', 2);
      break;
  }
  return out;
}

export const DROP_LABEL: Record<Drop['item'], string> = { heal: '회복 조각', ammo: '탄약' };
