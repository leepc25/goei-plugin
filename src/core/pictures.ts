// 카드 사진 목록 비교 (사진 업데이트, host/picpack.ts가 받아 넣는다)
import type { Manifest } from './types';

/** [이름, 지문(sha1 앞 12자), 확장자, 바이트] (tools/build_lite_card.py card_pictures) */
export type Picture = [string, string, string, number];

export function pictures(m: Manifest | null | undefined): Picture[] {
  const list = m?.pictures as unknown;
  return Array.isArray(list)
    ? list.filter((p): p is Picture => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string' && typeof p[2] === 'string')
    : [];
}

export interface PicPlan {
  /** 받을 사진 (바뀜 + 새로) */
  get: Picture[];
  replaced: number;
  added: number;
  bytes: number;
  /** 지울 사진 이름: 지금 카드 매니페스트에 있었는데 새 카드에서 뺀 것 (직접 넣은 사진은 매니페스트에 없으므로 안 지운다). 2026-11-05 사용자: 이름만 있는 옛 요원 그림 55장 */
  drop: string[];
}

/** 카드 에셋 목록에서 이름들을 뺀 목록 */
export function dropAssets(assets: unknown, names: string[]): unknown[] {
  const gone = new Set(names);
  return ((Array.isArray(assets) ? assets : []) as unknown[]).filter((r) => !(isRow(r) && gone.has(r[0])));
}

type Row = [string, string, string?];
const isRow = (r: unknown): r is Row => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string';

/**
 * 받을 사진을 고른다. 지금 카드에 그 이름이 없으면 새로, 있는데 지금 매니페스트의 지문과 다르면(지문 기록이 없는 옛 카드 포함) 바뀜.
 */
export function planPictures(assets: unknown, cur: Manifest | null | undefined, next: Manifest | null | undefined): PicPlan {
  const have = new Set(((Array.isArray(assets) ? assets : []) as unknown[]).filter(isRow).map((r) => r[0]));
  const known = new Map(pictures(cur).map((p) => [p[0], p[1]]));
  const plan: PicPlan = { get: [], replaced: 0, added: 0, bytes: 0, drop: [] };
  if (next) {
    const nextNames = new Set(pictures(next).map((p) => p[0]));
    for (const n of known.keys()) if (have.has(n) && !nextNames.has(n)) plan.drop.push(n);
  }
  for (const p of pictures(next)) {
    if (have.has(p[0]) && known.get(p[0]) === p[1]) continue;
    plan.get.push(p);
    plan.bytes += Number(p[3]) || 0;
    if (have.has(p[0])) plan.replaced++;
    else plan.added++;
  }
  return plan;
}
