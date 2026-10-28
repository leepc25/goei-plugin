// 적 시험장: 통합본 ?start=arena 로 여는 엔진 층. 자기 화면·입력·HUD 없이 엔진 그대로 쓴다.
// 표지 앞에서 E: 그 종류의 적 하나를 플레이어 앞에 부른다. 「치우기」는 적을 모두 지운다.
// 옛 층 유형 무리 편성·수호자 표지는 차원 승강기와 같이 지웠다 (2026-10-28).
import type { FloorPlan, PropSpec, StageModule } from '../engine/contract';
import { ROSTER } from './roster';

const GAP = 150;
const X0 = 420;

function props(): PropSpec[] {
  const out: PropSpec[] = [{ id: 'clear', kind: 'sign', x: 260, y: 505, w: 110, h: 60, label: '치우기 (E)' }];
  ROSTER.forEach((d, i) => out.push({ id: `one:${d.kind}`, kind: 'sign', x: X0 + i * GAP, y: 505, w: 120, h: 60, label: d.label }));
  return out;
}

export const arenaStage: StageModule = {
  id: 'arena',
  label: '적 시험장',
  firstFloor: (): FloorPlan => {
    const length = X0 + ROSTER.length * GAP + 600;
    return {
      id: 'enemy-arena',
      title: '적 시험장',
      length,
      lane: [500, 680],
      startX: 200,
      exitX: Infinity,
      banner: '적 시험장 · 표지 앞에서 E · H 판정 보기',
      palette: { wall: '#2b343a', floor: '#3c4549', accent: '#6c7b83' },
      props: props(),
      encounters: [],
    };
  },
  nextFloor: () => null,
  onInteract(api, floor, prop) {
    const w = api.world;
    const p = w.player;
    if (prop.id === 'clear') {
      for (const b of w.bodies) if (b.team === 'enemy') b.alive = false;
      return;
    }
    const [kind, what] = prop.id.split(':');
    if (kind === 'one') api.spawn({ kind: what, x: Math.min(p.x + 300, floor.length - 400), y: 590 });
  },
};
