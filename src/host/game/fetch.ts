// 게임 파일 받기: 저장소 release/game/ 폴더에서 받는다. 본체 받기(loader/body.ts)와 같은 길:
// Risu 본 화면에서 직접 받고(risuFetch, 웹 프록시 캐시를 피하려 text/plain), 안 되면 nativeFetch.
// 웹 Risu 프록시는 요청당 약 1MB까지라 큰 파일은 조각(512KB 이하)으로 나눠 올린다.
import { UPDATE_BASE } from '../../core/update';
import { toBytes } from '../assets';

export const GAME_BASE = UPDATE_BASE ? `${UPDATE_BASE}/game` : '';

export class GameFileError extends Error {}

type RisuFetch = (url: string, arg: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; status: number }>;

/** 받은 바이트 수 (측정용) */
export const fetchStats = { requests: 0, bytes: 0 };

export async function getBytes(name: string): Promise<Uint8Array> {
  if (!GAME_BASE) throw new GameFileError('받을 곳이 정해지지 않았어요. 파일로 넣어 주세요.');
  const url = `${GAME_BASE}/${name}?t=${Date.now()}`;
  const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
  if (legacy) {
    try {
      const r = await legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } });
      const b = r?.ok ? toBytes(r.data) : null;
      if (b) return count(b);
    } catch {
      // 아래에서 다시
    }
  }
  const res = await risuai.nativeFetch(url, { method: 'GET' });
  if (!res.ok) throw new GameFileError(`받지 못했어요 (${res.status}).`);
  return count(new Uint8Array(await res.arrayBuffer()));
}

function count(b: Uint8Array): Uint8Array {
  fetchStats.requests++;
  fetchStats.bytes += b.length;
  return b;
}

export const getText = async (name: string) => new TextDecoder().decode(await getBytes(name)).replace(/^﻿/, '');

/** 받은 조각을 이어 붙인다 */
export async function getParts(parts: string[], onPart?: (done: number, total: number) => void): Promise<Uint8Array> {
  const bufs: Uint8Array[] = [];
  for (const [i, p] of parts.entries()) {
    bufs.push(await getBytes(p));
    onPart?.(i + 1, parts.length);
  }
  const out = new Uint8Array(bufs.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const b of bufs) out.set(b, at), (at += b.length);
  return out;
}

/** 게임 파일 목록 (release/game/index.json, scripts/build.mjs가 만든다) */
export interface GameIndex {
  version: string;
  code: { parts: string[]; length: number; bytes: number };
  packs: PackEntry[];
}

export interface PackEntry {
  id: string;
  /** 내용 지문 (sha256 앞 16자). 바뀌었을 때만 다시 받는다 */
  hash: string;
  bytes: number;
  parts: string[];
  /** 게임을 열 때 꼭 있어야 하는 팩인가 (아니면 필요할 때 받는다) */
  required: boolean;
}

let index: Promise<GameIndex> | null = null;

export function gameIndex(): Promise<GameIndex> {
  index ??= (async () => {
    let v: GameIndex;
    try {
      v = JSON.parse(await getText('index.json')) as GameIndex;
    } catch {
      throw new GameFileError('게임 파일 목록을 받지 못했어요.');
    }
    if (!v || typeof v.version !== 'string' || !Array.isArray(v.code?.parts) || !Array.isArray(v.packs)) throw new GameFileError('게임 파일 목록이 올바르지 않아요.');
    return v;
  })();
  index.catch(() => (index = null));
  return index;
}

/** 목록을 다시 받게 한다 (다시 받기 버튼) */
export const forgetIndex = () => void (index = null);

export function base64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(out);
}

export const unbase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
