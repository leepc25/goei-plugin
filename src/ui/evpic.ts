// 상황 카드·커스텀 목록의 그림과 짧은 설명 (2026-10-20 사용자: 상황판을 그림 위주로).
// 괴이·특수는 명부 사진(대표 → 영문명_default → 영문명), 설명은 위키 문서 첫 문단. 그림이 없으면 null (종류별 공용 그림 자리)
import type { ChatContext } from '../host/risu';
import { readDirectory } from '../core/world/directory';
import { mainPic, moduleAssetStamp } from '../host/assets';
import { docSummary, findDoc } from '../core/wiki';
import { imageUrl } from './images';

interface Row { pic: string; title: string }
let cache: { lore: unknown; stamp: number; map: Map<string, Row> } | null = null;

function rows(ctx: ChatContext): Map<string, Row> {
  if (cache && cache.lore === ctx.char.globalLore && cache.stamp === moduleAssetStamp()) return cache.map;
  const map = new Map<string, Row>();
  const dir = readDirectory(ctx.char.globalLore);
  for (const p of [...dir.anomalies, ...dir.sites]) {
    const row = { pic: mainPic(ctx.char, p), title: p.lore || p.label };
    for (const n of [p.label, p.lore, ...p.aliases]) if (n && !map.has(n)) map.set(n, row);
  }
  cache = { lore: ctx.char.globalLore, stamp: moduleAssetStamp(), map };
  return map;
}

const descs = new Map<string, string>();

export function evArt(ctx: ChatContext, name: string): { pic: string | null; desc: string } {
  const r = rows(ctx).get(name);
  const pic = r?.pic ? imageUrl(ctx.char, r.pic) : null;
  const title = r?.title ?? name;
  let desc = descs.get(title);
  if (desc === undefined) {
    const doc = findDoc(ctx.chat, title, ctx.char.globalLore);
    desc = doc ? docSummary(doc.body) : '';
    descs.set(title, desc);
  }
  return { pic, desc };
}
