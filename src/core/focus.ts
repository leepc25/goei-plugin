// 본편 요청에 붙이는 기록 고르기 (v0.16.27). 원본은 「최근 것」만 붙였다.
// 최근 본편 몇 턴에 나온 이름(인물·닉네임·장소·괴이)과 관련된 기록을 먼저 넣고, 관련이 없어도 아주 최근 것 몇 개는 남긴다.
// 모델을 부르지 않는다. 이름 맞추기는 로어북 참고와 같은 규칙(조사 허용, 단어 경계)을 쓴다.
import { referenceEntries, termPresent, type Registry } from './world/registry';

export interface Focus {
  /** 최근 본편 글 */
  scene: string;
  /** 본편에 나온 명부 항목의 모든 이름 (표시명·영문명·별칭) */
  terms: string[];
}

/** 장면으로 볼 본편 턴 수 (사용자 글 + 응답 = 한 턴) */
export const FOCUS_TURNS = 3;

/** 요청 메시지에서 최근 본편 글만 모은다 (system 제외) */
export function sceneText(messages: { role?: string; content?: unknown }[], turns = FOCUS_TURNS): string {
  const story = messages.filter((m) => m && m.role !== 'system' && typeof m.content === 'string');
  return story
    .slice(-turns * 2)
    .map((m) => m.content as string)
    .join('\n');
}

export function makeFocus(scene: string, registry: Registry): Focus {
  const terms = scene.trim() ? referenceEntries(registry, scene).flatMap((e) => e.terms) : [];
  return { scene, terms: [...new Set(terms)].filter((t) => [...t].length >= 2) };
}

/** 기록의 이름(사람·닉네임·제목)이 장면에 나왔거나, 기록 글에 장면 속 명부 이름이 나오면 관련 */
export function related(f: Focus | null | undefined, names: string[], text = ''): boolean {
  if (!f) return false;
  if (names.some((n) => [...n.trim()].length >= 2 && termPresent(f.scene, n.trim()))) return true;
  return !!text && f.terms.some((t) => termPresent(text, t));
}

export interface Pick<T> {
  order: number;
  related: boolean;
  /** 개수 제한에 세지 않는 기록 (괴담톡 공지) */
  free?: boolean;
  /** 이번 턴에 꼭 넣을 기록 (보관함에서 잠깐 되살린 글). 맨 먼저 고른다 (전수검사 11-13) */
  pin?: boolean;
  data: T;
}

/**
 * 넣을 기록을 고른다. 관련 기록을 고르는 장면이 없으면(focus 끔) 원본처럼 최근 순.
 * 순서: 아주 최근 recent개 → 관련 기록 최근 순. 개수(max)·토큰(fits) 안에서만. 결과는 시간 순.
 * cost·room 을 주면 기록마다 토큰을 한 번씩만 세어 합으로 고르고, fits 는 끝에 한 번만 확인한다
 * (후보마다 묶음 전체를 다시 세서 기록이 많으면 전송이 몇 초씩 늦었다, 전수검사 11-13)
 */
export function pickRecords<T>(items: Pick<T>[], o: { focus: boolean; recent: number; max: number; fits: (kept: T[]) => boolean; cost?: (data: T) => number; room?: number }): T[] {
  const newest = items.slice().sort((a, b) => b.order - a.order);
  const rest = o.focus
    ? [...newest.filter((x, i) => x.free || i < o.recent), ...newest.filter((x, i) => !x.free && i >= o.recent && x.related)]
    : newest;
  const queue = [...newest.filter((x) => x.pin), ...rest.filter((x) => !x.pin)];
  if (o.cost && o.room !== undefined) {
    const accepted: Pick<T>[] = [];
    const seen = new Set<Pick<T>>();
    const freeLeft = (from: number) => queue.slice(from).some((x) => x.free && !seen.has(x));
    let counted = 0;
    let used = 0;
    for (let q = 0; q < queue.length; q++) {
      const item = queue[q];
      if (seen.has(item)) continue;
      if (!item.free && counted >= o.max) {
        if (!freeLeft(q + 1)) break;
        continue;
      }
      const c = o.cost(item.data);
      if (used + c > o.room) continue;
      used += c;
      seen.add(item);
      accepted.push(item);
      if (!item.free) counted++;
    }
    const byTime = () => accepted.slice().sort((a, b) => a.order - b.order).map((x) => x.data);
    // 건별 합은 거의 늘 실제보다 크지만 보장은 아니다: 실제 상한은 여기서 지킨다 (나중에 넣은 것부터 뺀다)
    while (accepted.length && !o.fits(byTime())) accepted.pop();
    return byTime();
  }
  const kept: Pick<T>[] = [];
  let counted = 0;
  for (const item of queue) {
    if (kept.includes(item)) continue;
    if (!item.free && counted >= o.max) continue;
    const next = [...kept, item].sort((a, b) => a.order - b.order);
    if (!o.fits(next.map((x) => x.data))) continue;
    kept.splice(0, kept.length, ...next);
    if (!item.free) counted++;
  }
  return kept.map((x) => x.data);
}
