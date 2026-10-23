// 「따라와」 의도 분류와 동행 (docs/필드_기능_설계.md 7장). 이름을 사용자가 알려 주는 입력은 없다.
export type Intent = 'follow' | 'wait' | 'return' | null;
const FOLLOW = /(따라\s*와|따라\s*오|같이\s*가|같이\s*가자|함께\s*가|따라\s*다녀)/;
const WAIT = /(기다려|여기\s*있어|여기서\s*기다|거기\s*있어|대기해)/;
const RETURN = /(돌아가|돌아가\s*있어|복귀해|원래\s*자리)/;
/** 명확하면 모델 없이 처리, 아니면 null (대화로 넘겨 태그를 받는다) */
export function classify(text: string): Intent {
  const t = text.replace(/\s+/g, ' ');
  if (/(따라\s*오지\s*마|따라오지\s*마|오지\s*마)/.test(t)) return 'wait';
  if (WAIT.test(t)) return 'wait';
  if (RETURN.test(t)) return 'return';
  if (FOLLOW.test(t) && !/\?|까요|할래|하겠/.test(t)) return 'follow';
  return null;
}

export const MAX_FOLLOWERS = 4;
export interface Companion { npc: string; since: number }

/** 앞에서부터 4명만 필드에 나온다. 나머지는 확정 사실에만 남는다 */
export function fieldCompanions(all: string[]): { shown: string[]; rest: string[] } {
  const seen = [...new Set(all.map(s => s.trim()).filter(Boolean))];
  return { shown: seen.slice(0, MAX_FOLLOWERS), rest: seen.slice(MAX_FOLLOWERS) };
}

/** 동행 가능한가. 거절 이유는 문장으로 */
export function canJoin(o: { state?: string; affinity: number; hasArt?: boolean; busy?: boolean }): { ok: boolean; reason?: string } {
  if (/작전\s*투입|부상|중상|격리|실종|사망/.test(o.state ?? '')) return { ok: false, reason: '지금 상태로는 따라갈 수 없어요.' };
  if (o.busy) return { ok: false, reason: '지금은 맡은 일이 있어요.' };
  if (o.affinity < -10) return { ok: false, reason: '선뜻 따라나서고 싶지 않은 눈치예요.' };
  return { ok: true };
}

/** 주인공이 걸은 길(발자국 열)에서 delaySec 전 자리를 따라간다. 막히면 가까이 합류 */
export interface Foot { t: number; x: number; y: number }
export function followPoint(trail: Foot[], now: number, delaySec = 1.5): { x: number; y: number } | null {
  if (!trail.length) return null;
  const want = now - delaySec;
  let hit = trail[0];
  for (const f of trail) { if (f.t <= want) hit = f; else break; }
  return { x: hit.x, y: hit.y };
}
export const pushFoot = (trail: Foot[], f: Foot, keepSec = 5): Foot[] => [...trail.filter(x => f.t - x.t <= keepSec), f];
