// 상황 카드·커스텀 목록의 그림과 짧은 설명 (2026-10-20 사용자: 상황판을 그림 위주로).
// 괴이·특수는 명부 사진(대표 → 영문명_default → 영문명), 설명은 위키 문서 첫 문단. 그림이 없으면 null (종류별 공용 그림 자리)
import type { ChatContext } from '../host/risu';
import { readDirectory } from '../core/world/directory';
import { hasAsset, mainPic, moduleAssetStamp } from '../host/assets';
import { docSummary, findDoc } from '../core/wiki';
import { imageUrl } from './images';

interface Row { pic: string; title: string }
let cache: { lore: unknown; stamp: number; map: Map<string, Row> } | null = null;

function rows(ctx: ChatContext): Map<string, Row> {
  if (cache && cache.lore === ctx.char.globalLore && cache.stamp === moduleAssetStamp()) return cache.map;
  const map = new Map<string, Row>();
  const dir = readDirectory(ctx.char.globalLore);
  // 거점도 영문명 사진을 찾는다 (2026-10-21: 커스텀 거점 목록도 그림 띠)
  for (const p of [...dir.anomalies, ...dir.sites]) {
    const row = { pic: mainPic(ctx.char, p), title: p.lore || p.label };
    for (const n of [p.label, p.lore, ...p.aliases]) if (n && !map.has(n)) map.set(n, row);
  }
  // 거점은 이름(관리국 본부)으로 찾는다. 사진은 영문명 = 세력 사진, 설명은 거점 문서가 있으면 그것(백일몽 본사), 없으면 세력 문서
  for (const b of dir.bases) {
    // 영문명이 세력 사진 이름과 다르면 (Baekilmong corporation ↔ Baekilmong) 연결 조직의 사진
    const org = dir.orgs.find((o) => o.name === b.org);
    const row = { pic: mainPic(ctx.char, b) || (org ? mainPic(ctx.char, org.spec) : ''), title: findDoc(ctx.chat, b.name, ctx.char.globalLore) ? b.name : b.lore || b.name };
    map.set(b.name, row);
  }
  cache = { lore: ctx.char.globalLore, stamp: moduleAssetStamp(), map };
  return map;
}

const descs = new Map<string, string>();

/** 그림이 없는 상황의 종류별 공용 그림 (카드 에셋, assets/wiki/Situations) */
const SHARED: Record<string, string> = { an: 'Situation Anomaly', in: 'Situation Incident', ms: 'Situation Mystic' };

export function evArt(ctx: ChatContext, name: string, kind?: string): { pic: string | null; desc: string } {
  const r = rows(ctx).get(name);
  const shared = kind && hasAsset(ctx.char, SHARED[kind] ?? '') ? SHARED[kind] : '';
  const pic = imageUrl(ctx.char, r?.pic || shared);
  const title = r?.title ?? name;
  let desc = descs.get(title);
  if (desc === undefined) {
    const doc = findDoc(ctx.chat, title, ctx.char.globalLore);
    desc = doc ? docSummary(doc.body) : '';
    descs.set(title, desc);
  }
  return { pic, desc };
}
