// 망상홈쇼핑 방송 그림 (2026-11-11): 그림 팩(goei-data-homeshop, 배경 판·진행자·동작 시트 webp + 글꼴)을 방송 화면을 처음 열 때 한 번 받아 저장소에 둔다.
// 받기·저장은 내 모습 팩(host/looks.ts)과 같다. 그림은 한 번 풀어 Image 로 들고 있는다 (화면이 캔버스에 그린다).
import { packMatches } from '../core/datapack';
import { HOMESHOP_PACK, parseHomeshopPack, type HsPack } from '../core/homeshop';
import { DataPackError, fetchPack } from './datapack';

export const HOMESHOP_KEY = 'goei:data-homeshop';
export const HS_FONT = 'goei-neodgm';

export interface HsArt {
  pack: HsPack;
  img: Map<string, HTMLImageElement>;
}
let art: HsArt | null = null;
let loading: Promise<void> | null = null;
let failed = '';
let progress = '';
const redraws = new Set<() => void>();

/** 그림이 받히면(또는 실패하면) 부를 다시 그리기 */
export function onHomeshopReady(fn: () => void): void {
  redraws.add(fn);
}
const redraw = () => redraws.forEach((fn) => fn());
export const homeshopStatus = () => ({ ready: !!art, loading: !!loading, progress, failed });

function bytesOf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function load(b64: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    const url = URL.createObjectURL(new Blob([bytesOf(b64).buffer as ArrayBuffer], { type: 'image/webp' }));
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('방송 그림을 풀지 못했어요.'));
    im.src = url;
  });
}
async function build(text: string): Promise<HsArt> {
  const pack = parseHomeshopPack(text);
  const img = new Map<string, HTMLImageElement>();
  await Promise.all(Object.entries(pack.files).map(async ([name, b64]) => void img.set(name, await load(b64))));
  if (pack.font && typeof FontFace === 'function') {
    try {
      const face = new FontFace(HS_FONT, bytesOf(pack.font).buffer as ArrayBuffer);
      await face.load();
      document.fonts.add(face);
    } catch (error) {
      console.log(`[goei] 방송 글꼴을 올리지 못했어요 (기본 글꼴로): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { pack, img };
}

/** 팩을 (한 번) 읽거나 받는다. 실패하면 failed 에 까닭을 남긴다 (다시 부르면 다시 시도) */
export function ensureHomeshop(): Promise<void> {
  if (art || loading) return loading ?? Promise.resolve();
  loading = (async () => {
    failed = '';
    try {
      let saved: unknown = null;
      try {
        saved = await risuai.pluginStorage.getItem(HOMESHOP_KEY);
      } catch {
        // 아래에서 받는다
      }
      if (typeof saved === 'string' && packMatches(saved, HOMESHOP_PACK.expect)) {
        try {
          art = await build(saved);
          return;
        } catch (error) {
          console.log(`[goei] 저장된 방송 그림을 읽지 못했어요 (다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const text = await fetchPack(HOMESHOP_PACK, (t) => {
        progress = t;
        redraw();
      });
      art = await build(text);
      try {
        await risuai.pluginStorage.setItem(HOMESHOP_KEY, text);
      } catch (error) {
        console.log(`[goei] 방송 그림을 저장소에 두지 못했어요 (이번엔 메모리로): ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      failed = error instanceof DataPackError || error instanceof Error ? error.message : String(error);
      console.log(`[goei] 방송 그림 팩: ${failed}`);
    } finally {
      progress = '';
      loading = null;
      redraw();
    }
  })();
  return loading;
}

/** 방송 그림. 아직 없으면 받기 시작하고 null */
export function homeshopArt(): HsArt | null {
  if (!art && !failed && !loading) void ensureHomeshop();
  return art;
}
