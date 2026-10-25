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

/** 한 번 받기에 기다리는 시간. 넘으면 그 요청은 버리고 다른 길·다음 시도로 (2026-10-25: 조각 하나가 응답 없이 걸려 「받는 중 8/11」에서 멈춤) */
const TIMEOUT_MS = 20000;
const TRIES = 3;

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error(`${what} ${ms / 1000}초 응답 없음`)), ms)))]).finally(() => clearTimeout(t));
}

/** 마지막으로 실패한 까닭들 (화면 오류 문구·측정용) */
export const fetchLog: string[] = [];

export async function getBytes(name: string): Promise<Uint8Array> {
  if (!GAME_BASE) throw new GameFileError('받을 곳이 정해지지 않았어요. 파일로 넣어 주세요.');
  const why: string[] = [];
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    const url = `${GAME_BASE}/${name}?t=${Date.now()}`;
    const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
    if (legacy) {
      try {
        const r = await timeout(legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } }), TIMEOUT_MS, 'risuFetch');
        const b = r?.ok ? toBytes(r.data) : null;
        if (b?.length) return count(b);
        why.push(`risuFetch ${r?.ok ? '빈 응답' : `실패(${r?.status ?? '?'})`}`);
      } catch (e) {
        why.push(e instanceof Error ? e.message : String(e));
      }
    }
    try {
      const res = await timeout(risuai.nativeFetch(url, { method: 'GET' }), TIMEOUT_MS, 'nativeFetch');
      if (res.ok) {
        const b = new Uint8Array(await timeout(res.arrayBuffer(), TIMEOUT_MS, 'nativeFetch 본문'));
        if (b.length) return count(b);
        why.push('nativeFetch 빈 응답');
      } else why.push(`nativeFetch 실패(${res.status})`);
    } catch (e) {
      why.push(e instanceof Error ? e.message : String(e));
    }
    if (attempt < TRIES) await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  const msg = `${name} 받기 실패: ${why.join(' · ')}`;
  fetchLog.push(msg);
  console.log(`[goei] ${msg}`);
  throw new GameFileError(`${name}을(를) ${TRIES}번 시도했지만 받지 못했어요 (${why.slice(-2).join(' · ')}). 다시 받기를 눌러 주세요.`);
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
