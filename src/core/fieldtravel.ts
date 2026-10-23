// 지역 사이 이동수단 (docs/필드_기능_설계.md 4장). 지역 안은 걷기, 지역 사이는 노선표.
export type Mode = 'walk' | 'subway' | 'bus' | 'taxi' | 'elevator' | 'stairs' | 'car';
export interface TravelRoute {
  id: string;
  mode: Mode;
  from: string;
  to: string;
  minutes: number;
  cost?: number;
  /** 운행 시간 (분, 자정부터). 없으면 늘 */
  open?: [number, number];
  /** 거치는 지역 id (괴이 영향 지역과 맞춘다) */
  via?: string[];
}
/** 아직 그림이 있는 곳이 본부뿐이라 표는 비어 있다. 거점이 늘면 여기에 채운다 */
export const ROUTES: TravelRoute[] = [];

const inOpen = (r: TravelRoute, minute: number) => {
  if (!r.open) return true;
  const m = ((minute % 1440) + 1440) % 1440;
  const [a, b] = r.open;
  return a <= b ? m >= a && m < b : m >= a || m < b;
};
export const routesFrom = (from: string, minute: number, table: TravelRoute[] = ROUTES) => table.filter(r => r.from === from && inOpen(r, minute));

/** 이동 중 괴이 접촉 단계: 징후 → 접촉 → 휘말림. roll 0~1 (호출하는 쪽이 난수를 준다) */
export type Contact = 'none' | 'sign' | 'contact' | 'caught';
export function contactAlong(route: TravelRoute, active: { name: string; loc: string }[], roll: number): { stage: Contact; anomaly?: string } {
  const hit = active.find(a => route.via?.includes(a.loc));
  if (!hit) return { stage: 'none' };
  if (roll < 0.1) return { stage: 'caught', anomaly: hit.name };
  if (roll < 0.35) return { stage: 'contact', anomaly: hit.name };
  if (roll < 0.7) return { stage: 'sign', anomaly: hit.name };
  return { stage: 'none' };
}
export const contactText = (c: { stage: Contact; anomaly?: string }) =>
  c.stage === 'sign' ? `이동 중 괴이 ${c.anomaly}의 징후를 만났다` : c.stage === 'contact' ? `이동 중 괴이 ${c.anomaly}와 접촉했다` : c.stage === 'caught' ? `이동 중 괴이 ${c.anomaly}에 휘말렸다` : '';
