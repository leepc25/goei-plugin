// 소지품 그림 (2026-11-07): PixelLab 으로 뽑은 85×85 WebP 그림 2,600여 장 + 매칭 표(game-src/items/README.md)를 자료 팩(goei-data-items)으로 받아 저장소에 둔다.
// 부팅 때 받지 않고 소지품 메뉴가 처음 그림을 찾을 때 받는다 (세계 자료처럼 host/datapack.ts fetchPack · 조각 200KB).
// 그림이 아직 없으면 null 을 주고(화면은 선 아이콘으로), 다 받히면 다시 그리기를 한 번 부른다.
import { applyItemsPack, iconGen, itemPictureNames, ITEMS_PACK, matchItemIcon, matchTitleIcon, packMatches, type ItemIconPack, type ItemPicMore } from '../core/datapack';
import { DataPackError, fetchPack } from './datapack';

export const ITEMS_KEY = 'goei:data-items';

let pack: ItemIconPack | null = null;
let loading: Promise<void> | null = null;
let failed = '';
let progress = '';
let redraw: () => void = () => {};
const urls = new Map<string, string>();
// 그림 찾기 결과를 기억한다: 소지품·상점을 그릴 때마다 전부 다시 찾았다 (전수검사 11-13). 팩·대체 표·분류 설정·못 찾은 말 목록이 바뀌면 비운다
const hits = new Map<string, string | null>();
let hitGen = -1;
function hitOf(key: string, f: () => string | null): string | null {
  const g = iconGen();
  if (g !== hitGen) {
    hits.clear();
    hitGen = g;
  }
  if (hits.has(key)) return hits.get(key)!;
  const v = f();
  if (hits.size > 3000) hits.delete(hits.keys().next().value!);
  hits.set(key, v);
  return v;
}

export function setItemIconRedraw(fn: () => void): void {
  redraw = fn;
}

/** 지금 상태: 받는 중 글 · 실패 까닭 (화면 알림용) */
export const itemIconStatus = () => ({ ready: !!pack, loading: !!loading, progress, failed });

/** 그림 팩을 (한 번) 읽거나 받는다. 실패하면 failed 에 까닭을 남기고 조용히 끝난다 (다시 부르면 다시 시도) */
export function ensureItemIcons(): Promise<void> {
  if (pack || loading) return loading ?? Promise.resolve();
  loading = (async () => {
    failed = '';
    try {
      let saved: unknown = null;
      try {
        saved = await risuai.pluginStorage.getItem(ITEMS_KEY);
      } catch {
        // 아래에서 받는다
      }
      if (typeof saved === 'string' && packMatches(saved, ITEMS_PACK.expect)) {
        try {
          pack = applyItemsPack(saved);
          hits.clear();
          return;
        } catch (error) {
          console.log(`[goei] 저장된 소지품 그림을 읽지 못했어요 (다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const text = await fetchPack(ITEMS_PACK, (t) => {
        progress = t;
        redraw();
      });
      pack = applyItemsPack(text);
      hits.clear();
      try {
        await risuai.pluginStorage.setItem(ITEMS_KEY, text);
      } catch (error) {
        console.log(`[goei] 소지품 그림을 저장소에 두지 못했어요 (이번엔 메모리로): ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      failed = error instanceof DataPackError || error instanceof Error ? error.message : String(error);
      console.log(`[goei] 소지품 그림 팩: ${failed}`);
    } finally {
      progress = '';
      loading = null;
      redraw();
    }
  })();
  return loading;
}

/** 이름(+모델이 쓴 그림 찾기 낱말)에 맞는 그림 data URL. 맞는 게 없으면 공통 그림. 팩이 없으면 받기 시작하고 null */
export function itemIconUrl(name: string, icon?: string, seed?: string, more?: ItemPicMore): string | null {
  if (!pack) {
    if (!failed) void ensureItemIcons();
    return null;
  }
  const p = pack;
  return urlOf(hitOf(`i\u0001${name}\u0001${icon ?? ''}\u0001${seed ?? ''}\u0001${more?.desc ?? ''}`, () => matchItemIcon(p, name, icon, seed, more)));
}
/** 상태에 따라 그림이 여러 장인 물건이면 그 그림 이름들 (갱신기 자료·고치기 양식). 그런 물건이 아니거나 그림 팩이 아직 없으면 null */
export const itemPictures = (name: string, icon?: string): string[] | null => (pack ? itemPictureNames(pack, name, icon) : null);

/** 글 제목 → 그림 (연어 마켓 매물). 맞는 그림이 없으면 소지품과 같이 공통 그림 */
export function titleIconUrl(title: string): string | null {
  if (!pack) {
    if (!failed) void ensureItemIcons();
    return null;
  }
  const p = pack;
  return urlOf(hitOf(`t\u0001${title}`, () => matchTitleIcon(p, title) ?? p.base.misc ?? null));
}

function urlOf(file: string | null): string | null {
  if (!pack || !file) return null;
  let u = urls.get(file);
  if (!u) {
    u = `data:image/${file.endsWith('.png') ? 'png' : 'webp'};base64,${pack.icons[file]}`;
    urls.set(file, u);
  }
  return u;
}

/** 시험용: 팩 글을 바로 넣는다 */
export function setItemIconPack(text: string | null): void {
  pack = text ? applyItemsPack(text) : null;
  urls.clear();
  hits.clear();
  failed = '';
}
