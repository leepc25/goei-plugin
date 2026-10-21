// 적 시험장: 통합본 ?start=arena 로 여는 엔진 층. 자기 화면·입력·HUD 없이 엔진 그대로 쓴다.
// 표지 앞에서 E: 그 층 유형의 일반 적 한 무리, 또는 수호자 하나를 플레이어 앞에 부른다. 「치우기」는 적을 모두 지운다.
import type { FloorPlan, PropSpec, StageModule } from '../engine/contract';
import { spawnWave } from './spawn';

const MIXED: [string, string][] = [
  ['lobby', '로비'], ['chase', '추격'], ['trial', '시험'], ['dark', '어둠'],
  ['silent', '침묵'], ['puzzle', '퍼즐'], ['service', '정비'], ['replica', '재현'],
];
const BOSSES: [string, string][] = [
  ['guard', '경비원'], ['conductor', '차장'], ['legs', '다리 많은 것'], ['shadow', '그림자'],
  ['noise', '소리와 냄새'], ['shape', '입체 도형'], ['elder', '405호 노부부'], ['family208', '208호 가족'],
  ['risenhouse', '일어난 집'], ['touchers', '만지는 것들'], ['predator', '포식자'],
];
const GAP = 150;
const X0 = 420;

function props(): PropSpec[] {
  const out: PropSpec[] = [{ id: 'clear', kind: 'sign', x: 260, y: 505, w: 110, h: 60, label: '치우기 (E)' }];
  MIXED.forEach(([t, name], i) => out.push({ id: `mix:${t}`, kind: 'sign', x: X0 + i * GAP, y: 505, w: 120, h: 60, label: `${name} 무리` }));
  BOSSES.forEach(([k, name], i) => out.push({ id: `boss:${k}`, kind: 'sign', x: X0 + (MIXED.length + i) * GAP + 80, y: 505, w: 120, h: 60, label: name }));
  return out;
}

export const arenaStage: StageModule = {
  id: 'arena',
  label: '적 시험장',
  firstFloor: (): FloorPlan => {
    const length = X0 + (MIXED.length + BOSSES.length) * GAP + 600;
    return {
      id: 'enemy-arena',
      title: '적 시험장',
      type: 'lobby',
      depth: 4,
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
    const x0 = Math.min(p.x + 160, floor.length - 700);
    const area = { x0, x1: x0 + 560, y0: 520, y1: 670 };
    if (kind === 'boss') {
      api.spawn({ kind: what, x: x0 + 300, y: 590, boss: true });
      return;
    }
    if (kind === 'mix') for (const s of spawnWave(24, what, 4, () => w.rand(), area).flat()) api.spawn(s);
  },
};
