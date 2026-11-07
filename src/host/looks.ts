// 내 모습 그림 (2026-11-07 사용자): 필드 인물 126명의 대기 동작 팩(goei-data-looks, 약 1.5MB 글)을 처음 그릴 때 한 번 받아 저장소에 둔다.
// 받기·저장은 소지품 그림 팩(host/itemicons.ts)과 같다. 그림은 blob: 주소 하나씩 만들어 다시 그려도 같은 주소를 쓴다(화면 글이 가볍게).
import { packMatches } from '../core/datapack';
import { lookFor, LOOKS_PACK, parseLooksPack, type LookRow } from '../core/looks';
import { playerAgent } from '../core/player';
import { DataPackError, fetchPack } from './datapack';
import type { ChatContext } from './risu';

export const LOOKS_KEY = 'goei:data-looks';

let rows: LookRow[] | null = null;
let loading: Promise<void> | null = null;
let failed = '';
let progress = '';
const redraws = new Set<() => void>();
const urls = new Map<string, string>();

/** 팩이 받히면(또는 실패하면) 부를 다시 그리기. 여럿 둘 수 있다 */
export function onLooksReady(fn: () => void): void {
  redraws.add(fn);
}
const redraw = () => redraws.forEach((fn) => fn());

/** 지금 상태: 받는 중 글 · 실패 까닭 (화면 알림용) */
export const looksStatus = () => ({ ready: !!rows, loading: !!loading, progress, failed });

/** 팩을 (한 번) 읽거나 받는다. 실패하면 failed 에 까닭을 남기고 조용히 끝난다 (다시 부르면 다시 시도) */
export function ensureLooks(): Promise<void> {
  if (rows || loading) return loading ?? Promise.resolve();
  loading = (async () => {
    failed = '';
    try {
      let saved: unknown = null;
      try {
        saved = await risuai.pluginStorage.getItem(LOOKS_KEY);
      } catch {
        // 아래에서 받는다
      }
      if (typeof saved === 'string' && packMatches(saved, LOOKS_PACK.expect)) {
        try {
          rows = parseLooksPack(saved);
          return;
        } catch (error) {
          console.log(`[goei] 저장된 인물 모습을 읽지 못했어요 (다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      const text = await fetchPack(LOOKS_PACK, (t) => {
        progress = t;
        redraw();
      });
      rows = parseLooksPack(text);
      try {
        await risuai.pluginStorage.setItem(LOOKS_KEY, text);
      } catch (error) {
        console.log(`[goei] 인물 모습을 저장소에 두지 못했어요 (이번엔 메모리로): ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      failed = error instanceof DataPackError || error instanceof Error ? error.message : String(error);
      console.log(`[goei] 인물 모습 팩: ${failed}`);
    } finally {
      progress = '';
      loading = null;
      redraw();
    }
  })();
  return loading;
}

/** 팩의 모습 전부. 아직 없으면 받기 시작하고 null */
export function lookRows(): LookRow[] | null {
  if (!rows && !failed) void ensureLooks();
  return rows;
}

/** 모습 시트의 blob: 주소 (한 번 만들어 둔다) */
export function lookUrl(r: LookRow): string {
  let u = urls.get(r.id);
  if (!u) {
    const bin = atob(r.img);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    u = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
    urls.set(r.id, u);
  }
  return u;
}

/** 정면 대기 동작 한 벌: 시트 주소 + 장 수·장 크기·장 길이. 그리는 쪽은 1배(픽셀 그대로), steps(frames) 로 돌린다 */
export interface IdleLook {
  id: string;
  /** 시트 blob: 주소 (가로로 frames 장) */
  url: string;
  frames: number;
  /** 장 하나 크기 (잘린 크기, px) */
  w: number;
  h: number;
  /** 장 하나 길이 (초) */
  sec: number;
  /** 원래 칸(128×256) 크기와 그 안의 자리 — 여러 인물을 같은 발밑에 맞출 때 */
  box: { w: number; h: number; ox: number; oy: number };
}

export const idleOf = (r: LookRow): IdleLook => ({
  id: r.id,
  url: lookUrl(r),
  frames: r.n,
  w: r.cw,
  h: r.ch,
  sec: r.sec,
  box: { w: r.w, h: r.h, ox: r.ox, oy: r.oy },
});

/**
 * 이 채팅의 플레이 인물 대기 동작 (장착 상자 왼쪽 인물 자리 등).
 * 고유 인물로 플레이하면 그 인물, 페르소나면 「내 모습」에서 고른 프리셋, 고르지 않았으면 null.
 * 팩이 아직 없으면 받기 시작하고 null (받히면 onLooksReady 로 다시 그린다)
 */
export function idleLook(ctx: Pick<ChatContext, 'char' | 'chat'>): IdleLook | null {
  const all = lookRows();
  if (!all) return null;
  const pa = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
  const r = lookFor(all, ctx.chat.scriptstate, pa?.name);
  return r ? idleOf(r) : null;
}
