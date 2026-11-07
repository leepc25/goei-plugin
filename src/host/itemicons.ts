// 소지품 그림 (2026-11-07): PixelLab 으로 뽑은 85×85 WebP 그림 2,600여 장 + 매칭 표(game-src/items/README.md)를 자료 팩(goei-data-items)으로 받아 저장소에 둔다.
// 부팅 때 받지 않고 소지품 메뉴가 처음 그림을 찾을 때 받는다 (세계 자료처럼 host/datapack.ts fetchPack · 조각 200KB).
// 그림이 아직 없으면 null 을 주고(화면은 종류 선 아이콘으로), 다 받히면 다시 그리기를 한 번 부른다.
import { applyItemsPack, ITEMS_PACK, matchItemIcon, packMatches, type ItemIconPack } from '../core/datapack';
import { DataPackError, fetchPack } from './datapack';

export const ITEMS_KEY = 'goei:data-items';

let pack: ItemIconPack | null = null;
let loading: Promise<void> | null = null;
let failed = '';
let progress = '';
let redraw: () => void = () => {};
const urls = new Map<string, string>();

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

/** 이름·그림 낱말에 맞는 그림 data URL. 팩이 없으면 받기 시작하고 null (화면은 선 아이콘으로). 매칭 고침은 「소지품 그림 매칭 고치기」에서 */
export function itemIconUrl(name: string, icon?: string): string | null {
  if (!pack) {
    if (!failed) void ensureItemIcons();
    return null;
  }
  const file = (icon ? matchItemIcon(pack, icon, '') : null) ?? matchItemIcon(pack, name, 'misc');
  if (!file) return null;
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
  failed = '';
}
