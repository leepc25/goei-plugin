// 본체 받기·실행. 본체(goei-body.js)는 「// goei-body 판」 줄로 시작하고, 실행하면 globalThis.__goeiBody를 남긴다.
import type { BodyHandlers } from '../body';

export type Body = BodyHandlers;
export const BODY_KEY = 'goei:body';
/** 저장소 release 폴더 주소 (scripts/build.mjs가 package.json goei.updateBase로 채운다) */
const BASE: string = typeof __UPDATE_BASE__ === 'string' ? __UPDATE_BASE__ : '';
declare const __UPDATE_BASE__: string | undefined;

export class BodyError extends Error {}

export function bodyVersion(code: string): string | null {
  return /^\/\/ goei-body (\S+)/.exec(code)?.[1] ?? null;
}

/** 본체 글 지문 (scripts/build.mjs textHash 와 같게): UTF-16 단위의 FNV-1a 32비트. 길이만 보면 글자가 바뀐 조각을 못 잡는다 */
export function bodyHash(code: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) h = Math.imul(h ^ code.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/**
 * 본체 코드를 실행한다. Risu 플러그인 칸은 nonce가 붙은 스크립트만 실행하므로(eval·blob 막힘)
 * 이 플러그인 스크립트의 nonce를 그대로 붙여 넣는다.
 */
export function runBody(code: string, version: string): { start: () => Promise<Body> } {
  const g = globalThis as unknown as { __goeiBody?: { version: string; start: () => Promise<Body> } };
  delete g.__goeiBody;
  const nonce = [...document.querySelectorAll('script')].map((s) => s.nonce).find(Boolean);
  const s = document.createElement('script');
  if (nonce) s.nonce = nonce;
  s.textContent = code;
  document.head.append(s);
  s.remove();
  const api = g.__goeiBody as { version: string; start: () => Promise<Body> } | undefined;
  delete g.__goeiBody;
  if (!api || typeof api.start !== 'function') throw new BodyError('본체를 실행하지 못했어요.');
  if (api.version !== version) throw new BodyError(`본체 판(${api.version})이 플러그인(${version})과 달라요.`);
  return api;
}

type RisuFetch = (url: string, arg: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; status: number }>;

/** 받기 하나에 기다리는 시간. 응답이 영영 안 오면(프록시 멈춤) 시작기가 조용히 죽은 채 남지 않게 (QC 2026-10-28; ui/update.ts·host/game/fetch.ts 와 같은 이유) */
const TIMEOUT_MS = 40_000;
function timeout<T>(p: Promise<T>, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<never>((_, rej) => (t = setTimeout(() => rej(new BodyError(`${what}을 ${TIMEOUT_MS / 1000}초 안에 받지 못했어요.`)), TIMEOUT_MS)))]).finally(() => clearTimeout(t));
}

/** release 폴더의 글 파일. Risu 본 화면에서 직접 받고(risuFetch), 안 되면 nativeFetch (ui/update.ts와 같은 이유) */
async function getText(name: string): Promise<string> {
  const url = `${BASE}/${name}?t=${Date.now()}`;
  const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
  if (legacy) {
    try {
      const r = await timeout(legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } }), name);
      if (r?.ok && r.data instanceof Uint8Array) return new TextDecoder().decode(r.data);
    } catch {
      // 아래에서 다시
    }
  }
  const res = await timeout(risuai.nativeFetch(url, { method: 'GET' }), name);
  if (!res.ok) throw new BodyError(`받지 못했어요 (${res.status}).`);
  return String((await timeout(res.text(), name)) ?? '');
}

/** 이 판의 본체를 조각으로 받아 붙인다 (Risu 웹 프록시는 1MB 넘는 파일을 못 받는다) */
export async function fetchBody(version: string): Promise<string> {
  if (!BASE) throw new BodyError('받을 곳이 정해지지 않았어요.');
  let index: { version?: unknown; parts?: unknown; length?: unknown; hash?: unknown } | null = null;
  try {
    index = JSON.parse((await getText('goei-body.json')).replace(/^﻿/, ''));
  } catch {
    throw new BodyError('본체 정보를 받지 못했어요.');
  }
  if (index?.version !== version) throw new BodyError('아직 이 판의 본체가 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.');
  if (!Array.isArray(index.parts) || typeof index.length !== 'number') throw new BodyError('본체 정보가 올바르지 않아요.');
  let code = '';
  for (const name of index.parts) {
    if (typeof name !== 'string' || !/^goei-body\.\d+\.txt$/.test(name)) throw new BodyError('본체 정보가 올바르지 않아요.');
    code += await getText(name);
  }
  if (code.length !== index.length || bodyVersion(code) !== version) throw new BodyError('본체를 끝까지 받지 못했어요.');
  // 지문이 있는 판(0.17.9~)은 글자까지 맞는지 본다. 옛 release 의 목록에는 지문이 없다
  if (typeof index.hash === 'string' && bodyHash(code) !== index.hash) throw new BodyError('받은 본체가 깨져 있어요. 다시 받아 주세요.');
  return code;
}
