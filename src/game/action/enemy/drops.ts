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

const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

/** 11.2 드랍 표. 정예는 현금·파편 1.5배, 회복 조각 확률 +10%p */
export function rollDrops(table: DropTable, r: () => number, elite = false): Drop[] {
  const out: Drop[] = [];
  const add = (item: Drop['item'], n: number) => n > 0 && out.push({ item, n });
  const k = elite ? 1.5 : 1;
  const heal = (p: number) => r() < p + (elite ? 0.1 : 0) && add('heal', 1);
  switch (table) {
    case 'none':
      return out;
    case 'common':
      add('cash', Math.round(int(r, 1, 3) * k));
      heal(0.15);
      add('shard', Math.round(int(r, 1, 2) * k));
      if (r() < 0.02) add('relic', 1);
      break;
    case 'bureau':
      add('cash', Math.round(int(r, 3, 6) * k));
      heal(0.1);
      add('shard', Math.round(1 * k));
      if (r() < 0.05) add(r() < 0.5 ? 'ammo' : 'relic', 1);
      break;
    case 'daydream':
      add('cash', Math.round(int(r, 6, 10) * k));
      heal(0.1);
      add('shard', Math.round(1 * k));
      if (r() < 0.03) add('dream', 1);
      break;
    case 'mid':
      add('cash', int(r, 12, 20));
      add('heal', 1);
      add('shard', 5);
      add('relic', 1);
      break;
    case 'guardian':
      add('cash', int(r, 40, 60));
      add('heal', 2);
      add('shard', 10);
      add('relic', 1);
      add('upgrade', 1);
      break;
  }
  return out;
}

export const DROP_LABEL: Record<Drop['item'], string> = { cash: '현금', heal: '회복 조각', shard: '이상 파편', relic: '회수물', ammo: '탄약', dream: '꿈결 수집기', key: '열쇠', upgrade: '강화 선택' };
