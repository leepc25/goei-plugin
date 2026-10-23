// NPC 일과와 장면 길찾기 (docs/필드_기능_설계.md 5장). 위치는 저장하지 않고 시각으로 다시 계산한다.
export interface Block { from: number; to: number; scene: string; spot?: string; act: string }
export interface Schedule { npc: string; blocks: Block[] }
export interface Where { scene: string; spot?: string; act: string }

/** 본편 상태가 일과보다 먼저다 (5-2). null = 일과대로 */
export function stateOverride(state: string): Where | 'away' | null {
  const s = state.trim();
  if (/작전\s*투입|실종|사망/.test(s)) return 'away';
  if (/부상|중상/.test(s)) return { scene: 'clinic', act: 'rest' };
  if (/격리/.test(s)) return { scene: 'isolation', act: 'confined' };
  return null;
}

/** 지금 어디서 무엇을 하나. minute = 자정부터 분 (하루를 넘으면 돈다). 'away' = 필드에 없다 */
export function whereAt(s: Schedule, minute: number, state = '', home = 'lobby'): Where | 'away' {
  const o = stateOverride(state);
  if (o) return o;
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440;
  for (const b of s.blocks) {
    // 자정을 넘는 블록(22:00~06:00)도 허용
    const hit = b.from <= b.to ? m >= b.from && m < b.to : m >= b.from || m < b.to;
    if (hit) return { scene: b.scene, spot: b.spot, act: b.act };
  }
  return { scene: home, act: 'idle' };
}

export type Graph = Record<string, string[]>;

/** 장면 그래프 최단 경로 (너비 우선). 없으면 null. 시작과 끝을 포함 */
export function routeScenes(g: Graph, from: string, to: string): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, '']]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of g[cur] ?? []) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (n === to) {
        const path = [n];
        for (let p = cur; p; p = prev.get(p)!) path.unshift(p);
        return path;
      }
      q.push(n);
    }
  }
  return null;
}

/** 막힘 처리: 3번 실패하면 목표 자리로 순간 이동 (끼임 방지) */
export function stuckStep(fails: number): 'sidestep' | 'teleport' {
  return fails >= 3 ? 'teleport' : 'sidestep';
}
