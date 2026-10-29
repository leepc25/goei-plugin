// 자료 팩 받기·저장 (QC 개선 나1). release 폴더의 글 파일을 조각으로 받는 길은 본체 받기(loader/body.ts)·위키·토크나이저(host/install.ts)와 같다:
// Risu 본 화면에서 직접 받고(risuFetch, 웹 프록시 캐시를 피하려 text/plain), 안 되면 nativeFetch. 조각은 200KB 이하 (웹 프록시는 1MB 넘는 파일을 못 받는다).
//
// 세계 자료(goei-data-world): 본체 부팅 때 저장소(pluginStorage goei:data-world)의 글이 이 본체의 지문과 맞으면 읽고, 아니면 받아 저장한다.
//   시작기는 본체 조각만 받으므로 자료는 본체가 스스로 받는다. 받기 실패는 start() 가 본체의 받기 창(host/datapanel.ts: 다시 받기 · 파일로 넣기 · 닫기)을
//   띄우고 던진다. 네트워크가 막힌 환경은 릴리스 zip 의 goei-data-world.txt(조각을 이은 한 파일)를 그 창에서 파일로 넣는다 (installWorldFile).
// 설치 자료(goei-data-install): 설치·점검 때 받아 저장소(goei:data-install)에 둔다 — 점검표·「이전 아이콘으로」가 저장소에서 영구히 받아 오는 데
//   의존하지 않게 (인계서 3절 규칙). 세계 자료와 같은 흐름(지문이 맞으면 읽기만, 판이 바뀌면 다시 받기).
// 어떤 기능도 저장소에서 영구히 받아 오는 데 의존하지 않는다: 두 자료 다 한 번 받으면 pluginStorage 에 있다.
import { applyInstallPack, applyWorldPack, INSTALL_PACK, packMatches, WORLD_PACK, type PackSpec } from '../core/datapack';
import { installDataReady } from '../core/install';
import { sha256Text, textHash } from '../core/texthash';
import { UPDATE_BASE } from '../core/update';
import { worldDataReady } from '../core/world/records';
import { toBytes } from './assets';

export const WORLD_KEY = 'goei:data-world';
export const INSTALL_KEY = 'goei:data-install';

export class DataPackError extends Error {}
export type Progress = (text: string) => void;

type RisuFetch = (url: string, arg: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; status: number }>;

/** 받기 하나에 기다리는 시간. 응답이 영영 안 오면 화면이 「받는 중」으로 굳지 않게 (QC 2026-10-28; ui/update.ts·loader/body.ts 와 같은 값) */
const TIMEOUT_MS = 40_000;
function timeout<T>(p: Promise<T>, name: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error(`${name}을 ${TIMEOUT_MS / 1000}초 안에 받지 못했어요.`)), TIMEOUT_MS)))]).finally(() => clearTimeout(t));
}

/** release 폴더의 글 파일 */
export async function getText(name: string): Promise<string> {
  const url = `${UPDATE_BASE}/${name}?t=${Date.now()}`;
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
  if (!res.ok) throw new Error(`${name}을 받지 못했어요 (${res.status}).`);
  return String((await timeout(res.text(), name)) ?? '');
}

/** release 폴더의 바이트 파일 (아이콘) */
export async function getBytes(name: string): Promise<Uint8Array> {
  const url = `${UPDATE_BASE}/${name}?t=${Date.now()}`;
  const legacy = (risuai as unknown as { risuFetch?: RisuFetch }).risuFetch;
  if (legacy) {
    try {
      const r = await timeout(legacy(url, { method: 'GET', plainFetchForce: true, rawResponse: true, headers: { 'Content-Type': 'text/plain' } }), name);
      const b = r?.ok ? toBytes(r.data) : null;
      if (b?.length) return b;
    } catch {
      // 아래에서 다시
    }
  }
  const res = await timeout(risuai.nativeFetch(url, { method: 'GET' }), name);
  if (!res.ok) throw new Error(`${name}을 받지 못했어요 (${res.status}).`);
  return new Uint8Array(await timeout(res.arrayBuffer(), name));
}

/**
 * 팩 하나를 조각으로 받아 이 본체의 지문과 맞는지 확인한다. 목록(<이름>.json)의 hash 가 본체의 것과 다르면 「아직 이 판의 자료가 올라오지 않았어요」.
 * 이어 붙인 글은 길이 → sha256(crypto.subtle 이 있으면) 또는 hash 로 확인한다 (본체 받기 loader/body.ts fetchBody 와 같은 순서)
 */
export async function fetchPack(pack: PackSpec, progress?: Progress): Promise<string> {
  if (!UPDATE_BASE) throw new DataPackError('받을 곳이 정해지지 않은 빌드예요.');
  if (!pack.expect.hash) throw new DataPackError(`이 빌드에는 ${pack.label} 지문이 없어요.`);
  progress?.(`${pack.label} 목록 받는 중…`);
  let index: { parts?: unknown; length?: unknown; hash?: unknown } | null = null;
  try {
    index = JSON.parse((await getText(`${pack.name}.json`)).replace(/^﻿/, ''));
  } catch (error) {
    throw new DataPackError(`${pack.label} 목록을 받지 못했어요 (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!index || !Array.isArray(index.parts) || typeof index.length !== 'number') throw new DataPackError(`${pack.label} 목록 형식이 달라요.`);
  if (index.hash !== pack.expect.hash) throw new DataPackError(`아직 이 판의 ${pack.label}가 올라오지 않았어요. 잠시 뒤 다시 받아 주세요.`);
  const re = new RegExp(`^${pack.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+\\.txt$`);
  let text = '';
  let n = 0;
  for (const name of index.parts) {
    if (typeof name !== 'string' || !re.test(name)) throw new DataPackError(`${pack.label} 목록 형식이 달라요.`);
    text += await getText(name);
    progress?.(`${pack.label} 받는 중 ${++n}/${index.parts.length}`);
  }
  if (text.length !== pack.expect.length) throw new DataPackError(`${pack.label}를 끝까지 받지 못했어요. (${text.length}/${pack.expect.length}자)`);
  const got = await sha256Text(text);
  if (got !== null) {
    if (got !== pack.expect.sha256) throw new DataPackError(`받은 ${pack.label}가 깨져 있어요(sha256). 다시 받아 주세요.`);
  } else if (textHash(text) !== pack.expect.hash) throw new DataPackError(`받은 ${pack.label}가 깨져 있어요(hash). 다시 받아 주세요.`);
  return text;
}

/**
 * 본체 부팅: 저장소의 세계 자료가 이 본체의 것이면 읽어 넣고(받기 없음), 없거나 판이 다르거나 깨졌으면 받아 저장한다.
 * 받지 못하면 던진다 → start() 가 본체 받기 창(host/datapanel.ts)을 띄우고 그대로 던진다. 처리기 등록·화면은 이 뒤에.
 */
export async function loadWorldData(force = false): Promise<'store' | 'fetch'> {
  let saved: unknown = null;
  try {
    saved = await risuai.pluginStorage.getItem(WORLD_KEY);
  } catch {
    // 아래에서 받는다
  }
  if (typeof saved === 'string' && packMatches(saved, WORLD_PACK.expect)) {
    try {
      applyWorldPack(saved);
      return 'store';
    } catch (error) {
      console.log(`[goei] 저장된 세계 자료를 읽지 못했어요 (다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (typeof saved === 'string') console.log('[goei] 저장된 세계 자료가 이 판과 달라 다시 받아요');
  // 최근 1분 안에 받기에 실패했으면 다시 받으려 하지 않는다 (받기 창의 「다시 받기」는 force). 옛 시작기(release/goei-plugin.js)는 본체 시작 실패 뒤
  // 메시지 표시·요청마다 본체를 다시 실행해 start() 를 또 부르므로, 실패 기록은 본체 모듈이 아니라 전역에 둔다
  const g = globalThis as WorldGlobals;
  if (!force && g.__goeiWorldFail && Date.now() - g.__goeiWorldFail.at < 60_000) throw new Error(g.__goeiWorldFail.reason);
  let text: string;
  try {
    text = await fetchPack(WORLD_PACK);
  } catch (error) {
    const reason = `${WORLD_PACK.label}(${WORLD_PACK.name})를 받지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
    g.__goeiWorldFail = { at: Date.now(), reason };
    throw new Error(reason);
  }
  await keepWorldData(text);
  return 'fetch';
}

/** 세계 자료 실패 기록(1분 억제)과 「사용자가 받기 창을 닫음」 표시. 본체 모듈이 다시 실행돼도 남게 전역에 (host/datapanel.ts 가 읽는다) */
export type WorldGlobals = { __goeiWorldFail?: { at: number; reason: string }; __goeiWorldDismissed?: boolean };

/** 받았거나 파일로 넣은 세계 자료를 쓰고 저장한다. 실패 기록·닫음 표시는 지운다 */
async function keepWorldData(text: string): Promise<void> {
  const g = globalThis as WorldGlobals;
  applyWorldPack(text);
  delete g.__goeiWorldFail;
  delete g.__goeiWorldDismissed;
  try {
    await risuai.pluginStorage.setItem(WORLD_KEY, text);
  } catch (error) {
    // 저장이 안 돼도(용량 초과 등) 이번에는 받은 자료로 돈다. 다음 부팅에 다시 받는다 (본체 저장과 같은 정책, main.ts save)
    console.log(`[goei] 세계 자료를 저장하지 못했어요 (다음에 다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 파일로 넣은 세계 자료 (받기 창의 「파일로 넣기」): 릴리스 zip 의 goei-data-world.txt(조각을 이은 팩 글 하나). 이 본체의 지문(길이·FNV)과 맞을 때만 쓴다.
 * 목록 파일(goei-data-world.json)이나 조각 하나를 넣으면 무엇을 넣어야 하는지 알려 준다
 */
export async function installWorldFile(raw: string): Promise<void> {
  const text = raw.replace(/^\ufeff/, '');
  if (!packMatches(text, WORLD_PACK.expect)) {
    let head: unknown = null;
    try {
      head = text.length < 4000 ? JSON.parse(text) : null;
    } catch {
      // 팩 글이 아니다
    }
    if (head && typeof head === 'object' && Array.isArray((head as { parts?: unknown }).parts)) throw new DataPackError('그건 조각 목록(goei-data-world.json)이에요. 릴리스 zip 의 goei-data-world.txt 를 넣어 주세요.');
    throw new DataPackError(`이 플러그인 판과 맞는 세계 자료(goei-data-world.txt)가 아니에요. (${text.length.toLocaleString()}자, 기대 ${WORLD_PACK.expect.length.toLocaleString()}자)`);
  }
  await keepWorldData(text);
}

/** 저장소의 세계 자료를 지운다 (점검 → 설정 내보내기. 다음 부팅에 다시 받는다) */
export async function dropWorldData(): Promise<void> {
  await risuai.pluginStorage.removeItem(WORLD_KEY).catch(() => {});
}

let installPending: Promise<void> | null = null;
/**
 * 설치·점검 전에 설치 자료를 넣는다 (이번 세션에 이미 넣었으면 바로). 저장소(goei:data-install)의 글이 이 본체의 지문과 맞으면 읽기만 하고,
 * 없거나 판이 다르면 받아 저장한다 — 점검표·「이전 아이콘으로」가 네트워크 없이도 그려지게. 동시에 여러 번 불려도 한 번만 받는다
 */
export async function ensureInstallData(progress?: Progress): Promise<void> {
  if (installDataReady()) return;
  installPending ??= (async () => {
    let saved: unknown = null;
    try {
      saved = await risuai.pluginStorage.getItem(INSTALL_KEY);
    } catch {
      // 아래에서 받는다
    }
    if (typeof saved === 'string' && packMatches(saved, INSTALL_PACK.expect)) {
      try {
        applyInstallPack(saved);
        return;
      } catch (error) {
        console.log(`[goei] 저장된 설치 자료를 읽지 못했어요 (다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
      }
    } else if (typeof saved === 'string') console.log('[goei] 저장된 설치 자료가 이 판과 달라 다시 받아요');
    const text = await fetchPack(INSTALL_PACK, progress);
    applyInstallPack(text);
    try {
      await risuai.pluginStorage.setItem(INSTALL_KEY, text);
    } catch (error) {
      console.log(`[goei] 설치 자료를 저장하지 못했어요 (다음에 다시 받아요): ${error instanceof Error ? error.message : String(error)}`);
    }
  })().finally(() => (installPending = null));
  await installPending;
}

/** 측정·점검용: 두 자료가 들어왔나 */
export const dataReady = () => ({ world: worldDataReady(), install: installDataReady() });
