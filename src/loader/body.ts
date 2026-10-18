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

/** release 폴더의 글 파일. Risu 본 화면에서 직접 받고(risuFetch), 안 되면 nativeFetch (ui/update.ts와 같은 이유) */
async function getText(name: string): Promise<string> {
  const url = `${BASE}/${name}?t=${Date.now()}`;
  const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
  if (legacy) {
    try {
      const r = await legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } });
      if (r?.ok && r.data instanceof Uint8Array) return new TextDecoder().decode(r.data);
    } catch {
      // 아래에서 다시
    }
  }
  const res = await risuai.nativeFetch(url, { method: 'GET' });
  if (!res.ok) throw new BodyError(`받지 못했어요 (${res.status}).`);
  return String((await res.text()) ?? '');
}

/** 이 판의 본체를 조각으로 받아 붙인다 (Risu 웹 프록시는 1MB 넘는 파일을 못 받는다) */
export async function fetchBody(version: string): Promise<string> {
  if (!BASE) throw new BodyError('받을 곳이 정해지지 않았어요.');
  let index: { version?: unknown; parts?: unknown; length?: unknown } | null = null;
  try {
    index = JSON.parse((await getText('goei-body.json')).replace(/^﻿/, ''));
  } catch {
    throw new BodyError('본체 정보를 받지 못했어요.');
  }
  if (index?.version !== version) throw new BodyError('아직 이 판의 본체가 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.');
  if (!Array.isArray(index.parts) || typeof index.length !== 'number') throw new BodyError('본체 정보가 올바르지 않아요.');
  let code = '';
  for (const name of index.parts) code += await getText(String(name));
  if (code.length !== index.length || bodyVersion(code) !== version) throw new BodyError('본체를 끝까지 받지 못했어요.');
  return code;
}
