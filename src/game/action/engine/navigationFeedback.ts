// 읽기 전용 안내 어댑터. 실제 E 대상 순서/거리와 본부·필드 장면의 문·자리 열림을 따른다.
// 그림(kind)으로 문을 추측하지 않고 placed.kind·지도·본부 장면을 읽는다.
import type { World } from './world';
import type { PropSpec } from './contract';
import type { HqDoor, HqSpot } from '../hq/map';

export interface NavigationTarget {
  id: string;
  text: string;
  kind: 'exit' | 'interact' | 'locked' | 'decoration';
  /** 실행을 권하지 않는 이유. 이때 E 버튼 대신 상태를 표시한다. */
  reason?: string;
}
export interface NavigationFeedback {
  objective: string;
  target: NavigationTarget | null;
}
type Scene = { doors: (HqDoor & { open: boolean })[]; spots: (HqSpot & { open: boolean })[] };
type NavigationStage = { current?(): Scene | null };

/** World.interact와 같은 엄격한 <60 및 동률 선착순. 장식이 가리는 뒤의 문을 선택하지 않는다. */
export function navigationTarget(props: readonly PropSpec[], x: number): PropSpec | null {
  let best: PropSpec | null = null;
  for (const p of props) if (Math.abs(p.x - x) < 60 && (!best || Math.abs(p.x - x) < Math.abs(best.x - x))) best = p;
  return best;
}

export function navigationFeedback(w: World): NavigationFeedback {
  if (w.player.seat) return { objective: '본부 · 의자에서 휴식 중', target: { id: 'seat:stand', text: '일어나기', kind: 'interact' } };
  const stage = w.stage as NavigationStage | undefined;
  const objective = w.floor.type === 'hq' ? '본부 · 표시된 출입구와 자리 앞에서 조사' : '표시된 장치를 조사하세요';
  const result: NavigationFeedback = { objective, target: null };
  if (w.ended || w.player.hp <= 0 || w.player.carry) return result;
  const p = navigationTarget(w.props, w.player.x);
  if (!p) return result;
  const set = (text: string, kind: NavigationTarget['kind'] = 'interact', reason?: string) => {
    result.target = { id: p.id, text, kind: reason ? 'locked' : kind, reason };
    return result;
  };
  const scene = w.floor.type === 'hq' ? stage?.current?.() : null;
  if (scene && p.kind === 'hubdoor') {
    const d = scene.doors.find(d => `door:${d.id}` === p.id);
    if (!d) return result;
    if (!d.open) return set('닫힌 문', 'locked', d.needs ? '본부 시설 해금 필요' : '출입할 수 없는 문');
    if (d.kind === 'elevator') return set('승강기 · 층 선택');
    return d.to ? set(d.side === 'S' ? '출구 · 복도로 이동' : '출입구 · 이동', 'exit') : set('배경 문 · 출입 불가', 'decoration');
  }
  if (scene && p.kind === 'hubspot') {
    const s = scene.spots.find(s => `spot:${s.id}` === p.id);
    return s?.open ? set([s.who, s.verb].filter(Boolean).join(' · ')) : result;
  }
  const name = p.label ?? '';
  if (p.kind === 'decor') return set('배경 장식 · 출입 불가', 'decoration');
  // 라벨 없는 배경 물건에는 조사 가능 표시를 만들지 않는다.
  if (!name) return result;
  return set(name);
}
