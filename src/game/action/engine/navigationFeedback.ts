// 읽기 전용 안내 어댑터. 실제 E 대상 순서/거리와 현행 층의 잠금 조건을 따른다.
// 그림(kind)으로 문을 추측하지 않고 placed.kind·지도·본부 장면을 읽는다.
import type { World } from './world';
import type { PropSpec } from './contract';
import type { ElevatorStage } from '../stage/module';
import type { StagePlan } from '../stage/plan';
import type { MapDir, RunMap } from '../stage/runmap';
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
const MARK = (n: number) => '①②③④'[n - 1] ?? String(n);
const ARROW: Record<MapDir, string> = { l: '←', r: '→', u: '↑', d: '↓' };
type Scene = { doors: (HqDoor & { open: boolean })[]; spots: (HqSpot & { open: boolean })[] };
type NavigationStage = Partial<ElevatorStage> & { current?(): Scene | null };

/** World.interact와 같은 엄격한 <60 및 동률 선착순. 장식이 가리는 뒤의 문을 선택하지 않는다. */
export function navigationTarget(props: readonly PropSpec[], x: number): PropSpec | null {
  let best: PropSpec | null = null;
  for (const p of props) if (Math.abs(p.x - x) < 60 && (!best || Math.abs(p.x - x) < Math.abs(best.x - x))) best = p;
  return best;
}

export function navigationFeedback(w: World, map?: RunMap | null): NavigationFeedback {
  const stage = w.stage as NavigationStage | undefined;
  const m = map === undefined ? stage?.mapView?.() : map;
  const plan = (w.floor as Partial<StagePlan>).stage;
  const outing = stage?.outing?.();
  // encIndex에는 아직 시작하지 않은 파도도 남는다. 근처 적 유무는 출입 잠금 기준이 아니다.
  const combat = !!m && (w.encActive >= 0 || w.encIndex < w.floor.encounters.length);
  const guardian = plan?.where === 'floor' && w.bodies.some(b => b.alive && b.hp > 0 && b.boss);
  const travelReason = combat ? '전투 중 잠김 · 이 방의 적을 정리하세요' : guardian ? '수호자를 해결해야 길이 열립니다' : undefined;
  const objective = travelReason ?? m?.goal ?? (w.floor.type === 'hq' ? '본부 · 표시된 출입구와 자리 앞에서 조사' : '표시된 장치를 조사하세요');
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
  const pl = plan?.floor?.placed.find(pl => `p${pl.id}` === p.id);
  const kind = pl?.kind ?? p.kind;
  const room = m?.worlds.find(f => f.depth === m.depth)?.rooms.find(r => r.col === m?.room?.[0] && r.row === m?.room?.[1]);
  const dir = pl?.data.dir as MapDir | undefined;
  const lock = dir ? room?.lock[dir] : undefined;
  const master = outing?.upgrades.includes('master') && !outing.upgrades.includes('master:used');
  const lockReason = lock && lock.state === 'locked' && !master ? `열쇠 ${MARK(lock.n)} 필요 · 열린 방을 탐색하세요` : undefined;
  const name = p.label ?? '';
  if (['wdoor', 'wup', 'wdown'].includes(kind)) {
    return set(`${dir ? ARROW[dir] + ' ' : ''}출입구 · ${name}`, 'exit', lockReason ?? travelReason);
  }
  if (kind === 'locked') {
    const needsKey = lock ? lockReason : !master && !outing?.keys.includes(outing.depth) ? '열쇠 필요 · 정비 구역을 탐색하세요' : undefined;
    // 셔터 E는 잠금만 해제하므로 전투 중에도 열쇠가 있으면 실행 가능하다.
    return set(needsKey ? '잠긴 셔터' : '셔터 잠금 해제', 'interact', needsKey);
  }
  if (kind === 'upper') return set('위층 점검문', 'exit', !outing?.shortcuts.includes(outing.depth) ? '반대편 정비 구역에서 열어야 합니다' : travelReason);
  if (kind === 'panel') return set('승강기 패널 · 다음 층', 'exit', m?.where === 'floor' && !m.panelReady ? '이 층의 방과 목표를 모두 해결하세요' : travelReason);
  if (kind === 'elevator') return set('승강기 문', 'locked', name === '타고 온 엘리베이터' ? '돌아갈 수 없음 · 귀환은 다락방 로프' : '승강기 패널을 조사하세요');
  if (kind === 'rope' || kind === 'van') return set(`귀환 출구 · ${name}`, 'exit');
  if (kind === 'down' || kind === 'fall') return set(`아래층 출구 · ${name}`, 'exit', !m?.panelReady ? '위 층의 방과 목표를 모두 해결하세요' : travelReason);
  if ((kind === 'left' || kind === 'right') && plan?.cell?.duct[kind === 'left' ? 'l' : 'r'] && !w.player.crouching) return set(name, 'locked', '앉은 채로 조사하세요');
  if (['hatch', 'servicedoor', 'sidedoor', 'ladder_up', 'ladder_down', 'left', 'right', 'up', 'getoff'].includes(kind) || (kind === 'door' && plan?.where === 'side')) return set(`출구 · ${name}`, 'exit', travelReason);
  if (kind === 'button') return set(name, 'exit', outing && outing.stuck > 0 ? '승강기 정지 중 · 잠시 기다리세요' : travelReason);
  if (kind === 'crack') return set(name || '금 간 벽', 'exit', name.includes('부서진') ? travelReason : '공격해서 벽을 부수세요');
  if (kind === 'vent') return set(name || '덕트', 'exit', !name.includes('열린') && !w.player.crouching ? '앉은 채로 조사하세요' : travelReason);
  if (kind === 'key') return set(`줍기 · ${name || '열쇠'}`);
  if (kind === 'decor' || (!pl && kind === 'door' && plan?.where !== 'side')) return set('배경 장식 · 출입 불가', 'decoration');
  // 라벨 없는 배경 물건에는 조사 가능 표시를 만들지 않는다.
  if (!name) return result;
  return set(name);
}
