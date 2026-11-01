// 필드 이어하기(11-01, 할일 1-8): 방문을 끝낼 때 세계의 이어 갈 것만 적어 두고(채팅 변수 $fd_state 의 world 칸), 다음 방문에 되살린다.
// 적는 것: 이름 인물 욕구, 동행 중인 인물, 주인공이 서 있던 장면·자리, 필드 시각, 맨몸 인물. 몹·경보·싸움은 방문마다 새로.
import type { Needs } from './needs';

export interface FieldWorldSave {
  v: 1;
  /** 저장할 때 필드 시각(초). 다음 방문 시각과의 차이만큼 욕구가 더 줄어든다 */
  clock: number | null;
  /** 이름 인물 이름 → 욕구 */
  needs: Record<string, Needs>;
  /** 동행 중이던 인물 이름 (순서대로) */
  follow: string[];
  /** 주인공이 서 있던 장면·자리 */
  player?: { scene: string; x: number; y?: number };
  /** 맨몸(샤워 중)이던 인물 이름 */
  nude?: string[];
}

export function parseWorldSave(o: unknown): FieldWorldSave | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const s = o as Partial<FieldWorldSave>;
  if (s.v !== 1 || !s.needs || typeof s.needs !== 'object') return undefined;
  const needs: Record<string, Needs> = {};
  for (const [k, v] of Object.entries(s.needs)) {
    if (!v || typeof v !== 'object') continue;
    const n: Record<string, number> = {};
    for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) if (typeof nv === 'number' && Number.isFinite(nv)) n[nk] = Math.max(0, Math.min(100, nv));
    needs[k] = n as Needs;
  }
  const str = (l: unknown) => (Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : []);
  const p = s.player && typeof s.player === 'object' && typeof s.player.scene === 'string' && typeof s.player.x === 'number' ? { scene: s.player.scene, x: s.player.x, ...(typeof s.player.y === 'number' ? { y: s.player.y } : {}) } : undefined;
  return { v: 1, clock: typeof s.clock === 'number' ? s.clock : null, needs, follow: str(s.follow), ...(p ? { player: p } : {}), ...(str(s.nude).length ? { nude: str(s.nude) } : {}) };
}
