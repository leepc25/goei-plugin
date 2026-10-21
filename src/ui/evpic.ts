// 상황 카드·커스텀 목록의 그림과 짧은 설명 (2026-10-20 사용자: 상황판을 그림 위주로).
// 괴이·특수는 명부 사진(대표 → 영문명_default → 영문명), 설명은 위키 문서 첫 문단. 그림이 없으면 null (종류별 공용 그림 자리)
import type { ChatContext } from '../host/risu';
import { orgLoreName, readDirectory } from '../core/world/directory';
import { factionNames, parseCatalog } from '../core/world/catalog';
import { hasAsset, mainPic, moduleAssetStamp } from '../host/assets';
import { docSummary, findDoc } from '../core/wiki';
import { imageUrl } from './images';
import { baseShared, situationShared } from '../core/sharedpics';

interface Row { pic: string; title: string; org?: string }
let cache: { lore: unknown; stamp: number; viewer: string; map: Map<string, Row> } | null = null;

/** 이야기의 시점 세력 (시작 화면에서 고른 세력 코드) */
const viewerOf = (ctx: ChatContext) => String(ctx.chat.scriptstate?.['$st_faction'] ?? '');

function rows(ctx: ChatContext): Map<string, Row> {
  const viewer = viewerOf(ctx);
  if (cache && cache.lore === ctx.char.globalLore && cache.stamp === moduleAssetStamp() && cache.viewer === viewer) return cache.map;
  const map = new Map<string, Row>();
  const dir = readDirectory(ctx.char.globalLore);
  // 거점도 영문명 사진을 찾는다 (2026-10-21: 커스텀 거점 목록도 그림 띠)
  for (const p of [...dir.anomalies, ...dir.sites]) {
    const row = { pic: mainPic(ctx.char, p), title: p.lore || p.label };
    for (const n of [p.label, p.lore, ...p.aliases]) if (n && !map.has(n)) map.set(n, row);
  }
  // 거점은 이름(관리국 본부)으로 찾는다. 사진은 영문명 → 연결 조직 사진 → 공용 거점 그림, 설명은 거점 문서가 있으면 그것(백일몽 본사), 없으면 세력 문서
  let names: Record<string, string> = {};
  try {
    names = factionNames(parseCatalog(ctx.char.globalLore), viewer);
  } catch {
    /* 목록 로어북이 없으면 조직 이름 그대로 */
  }
  const fake = dir.orgs.find((o) => o.faction === 'B00');
  for (const b of dir.bases) {
    let org = dir.orgs.find((o) => o.name === b.org);
    // 가짜 관리국 시점에서는 관리국 본부가 자기 본부: 사진·문서·조직이 가짜 관리국 것 (2026-10-21 사용자: 둘 중 하나만 보이게)
    const swap = viewer === 'B00' && org?.faction === 'A00' && !!fake;
    if (swap) org = fake;
    const own = !swap && findDoc(ctx.chat, b.name, ctx.char.globalLore);
    const lore = ctx.char.globalLore ?? [];
    // 영문명이 세력 사진 이름과 다르면 (Baekilmong corporation ↔ Baekilmong) 연결 조직의 사진
    // 거점은 바깥 모습 「Base 영문명」이 먼저 (세력 사진은 대개 안쪽, 2026-10-21 사용자)
    const outside = (en: string | undefined) => (en && hasAsset(ctx.char, `Base ${en}`) ? `Base ${en}` : '');
    const pic = (swap ? outside(org!.spec.english) : outside(b.english) || mainPic(ctx.char, b)) || (org ? mainPic(ctx.char, org.spec) : '');
    const title = own ? b.name : swap ? orgLoreName(lore, org!.name) : b.lore || (org ? orgLoreName(lore, org.name) : b.name);
    // 그것도 없으면 이름 낱말로 고른 공용 거점 그림 (바깥 모습)
    const shared = pic ? '' : baseShared(b.name, b.label).find((n) => hasAsset(ctx.char, n)) ?? '';
    map.set(b.name, { pic: pic || shared, title, org: org ? (org.faction && names[org.faction]) || org.name : '' });
  }
  cache = { lore: ctx.char.globalLore, stamp: moduleAssetStamp(), viewer, map };
  return map;
}

const descs = new Map<string, string>();

/** 그림이 없는 상황의 종류별 공용 그림 (카드 에셋, assets/wiki/Situations) */
// 괴이·사건은 장소, 특수는 종류로 고른 여러 장 중 카드에 있는 첫 그림 (core/sharedpics). 거점은 공용 거점 그림이 없으면 사건 그림
const sharedFor = (kind: string, name: string, text: string) => (kind === 'lm' ? ['Situation Incident'] : situationShared(kind, name, text));

/** 거점 사진 이름: 영문명 → 연결 조직 사진 → '' (공용 그림은 evArt가) */
export const basePic = (ctx: ChatContext, name: string): string => rows(ctx).get(name)?.pic ?? '';

/** 거점이 이어지는 위키 문서와, 시점 세력 기준으로 부르는 연결 조직 이름 */
export function baseLink(ctx: ChatContext, name: string): { doc: string; org: string } {
  const r = rows(ctx).get(name);
  return { doc: r?.title ?? name, org: r?.org ?? '' };
}

/** text: 발생 지점·상황 글 (공용 그림을 장소에 맞게 고를 때) */
export function evArt(ctx: ChatContext, name: string, kind?: string, text = ''): { pic: string | null; desc: string } {
  const r = rows(ctx).get(name);
  const shared = (!r?.pic && kind && sharedFor(kind, name, text).find((n) => hasAsset(ctx.char, n))) || '';
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
