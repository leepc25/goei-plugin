// 깡통봇 설치·점검의 받기·저장 (core/install.ts 가 계산, 여기서 Risu 에 쓴다).
// 로어북·인사말은 캐릭터에, 사진은 에셋 저장소(release/pic), 아이콘은 release/icon.png 를 받아 메인 아이콘으로,
// 위키 기본 문서 묶음은 release/wiki-base.N.txt 를 받아 플러그인 저장소에 둔다.
import { installCheck, installLore, INSTALL_ICON, plantGreetings, type InstallState } from '../core/install';
import { UPDATE_BASE } from '../core/update';
import { setStoredWikiPack, storedWikiPack, WIKI_PACK_HEAD } from '../core/wiki';
import { clearTokenizer, setTokenizerRanks, tokenizerName } from '../core/tokenizer';
import type { LoreEntry } from '../core/types';
import { digest, fetchPictures } from './picpack';
import { toBytes } from './assets';
import { forgetImages } from '../ui/images';

const WIKI_KEY = 'goei:wikibase';
const TOK_KEY = 'goei:tok-o200k';
const ICON_KEY = 'goei:icon';

type RisuFetch = (url: string, arg: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown; status: number }>;

/** 받기 하나에 기다리는 시간. 응답이 영영 안 오면 설치 화면이 「받는 중」으로 굳지 않게 (QC 2026-10-28; ui/update.ts 와 같은 값) */
const TIMEOUT_MS = 40_000;
function timeout<T>(p: Promise<T>, name: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([p, new Promise<never>((_, rej) => (t = setTimeout(() => rej(new Error(`${name}을 ${TIMEOUT_MS / 1000}초 안에 받지 못했어요.`)), TIMEOUT_MS)))]).finally(() => clearTimeout(t));
}

async function getText(name: string): Promise<string> {
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

async function getBytes(name: string): Promise<Uint8Array> {
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

/** 저장소의 위키 묶음을 읽어 core/wiki 에 알린다 (본체 시작 때 한 번) */
export async function loadStoredWikiPack(): Promise<void> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(WIKI_KEY);
    setStoredWikiPack(typeof raw === 'string' && raw.startsWith(WIKI_PACK_HEAD) ? raw : null);
  } catch {
    setStoredWikiPack(null);
  }
}

/** 아이콘 기록: 캐릭터 id → { ours: 우리 아이콘 경로, prev: 설치 전 아이콘 } */
interface IconNote {
  ours: string;
  prev: string;
}
async function iconNotes(): Promise<Record<string, IconNote>> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(ICON_KEY);
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return o && typeof o === 'object' ? (o as Record<string, IconNote>) : {};
  } catch {
    return {};
  }
}

const charId = (char: Record<string, unknown>) => String(char.chaId ?? char.name ?? '');

/** 지금 캐릭터의 설치 상태 */
export async function checkInstall(charIndex: number): Promise<{ state: InstallState; iconPrev: string }> {
  const char = ((await risuai.getCharacterFromIndex(charIndex)) ?? {}) as Record<string, unknown>;
  const notes = await iconNotes();
  const note = notes[charId(char)];
  const lore = char.globalLore as LoreEntry[] | undefined;
  const packInLore = (lore ?? []).some((e) => typeof e.content === 'string' && e.content.startsWith(WIKI_PACK_HEAD));
  const state = installCheck({
    lore,
    alternateGreetings: char.alternateGreetings,
    assets: char.additionalAssets,
    iconOurs: !!note && note.ours === String(char.image ?? ''),
    wikiPack: packInLore || !!storedWikiPack(),
    tokenizer: !!tokenizerName(),
  });
  return { state, iconPrev: note?.prev ?? '' };
}

export type InstallStep = 'lore' | 'pictures' | 'icon' | 'wiki';
export type Progress = (text: string) => void;

/** 로어북·인사말 심기 (없는 것만). 캐릭터를 저장한다 */
export async function installLoreAndGreetings(charIndex: number, o: { name?: string } = {}): Promise<void> {
  const char = (await risuai.getCharacterFromIndex(charIndex)) as Record<string, unknown> | null;
  if (!char) throw new Error('캐릭터를 찾을 수 없어요.');
  const planted = plantGreetings(char.alternateGreetings);
  const lore = installLore(char.globalLore as LoreEntry[] | undefined, planted.index);
  // 봇 이름: 설치 화면의 선택(기본: 괴이 카드가 아니던 봇이면 「괴이: ANOMALY」로)
  await risuai.setCharacterToIndex(charIndex, { ...char, ...(o.name ? { name: o.name } : {}), globalLore: lore, alternateGreetings: planted.greetings });
}

/** 없는 카드 사진을 release/pic 에서 받아 에셋 저장소에 넣는다 */
export async function installPictures(charIndex: number, progress: Progress): Promise<number> {
  const char = (await risuai.getCharacterFromIndex(charIndex)) as Record<string, unknown> | null;
  if (!char) throw new Error('캐릭터를 찾을 수 없어요.');
  const { state } = await checkInstall(charIndex);
  const all = state.pictures.missing;
  if (!all.length) return 0;
  // 100장씩 받아 받은 만큼 바로 캐릭터에 저장한다: 1,751장(93MB)을 받다 끊겨도 다시 누르면 이어서 받는다
  const CHUNK = 100;
  let saved = 0;
  let assets: unknown = char.additionalAssets;
  for (let i = 0; i < all.length; i += CHUNK) {
    const get = all.slice(i, i + CHUNK);
    const bytes = get.reduce((n, p) => n + (Number(p[3]) || 0), 0);
    let last = 0;
    try {
      assets = await fetchPictures(assets, { get, replaced: 0, added: get.length, bytes }, (n, phase) => {
        if (n - last >= 10 || n === 0 || n === get.length) {
          last = n;
          progress(`사진 ${phase === 'get' ? '받는' : '저장'} 중 ${saved + n}/${all.length}`);
        }
      });
    } catch (error) {
      if (saved) throw new Error(`${saved}/${all.length}장까지 받았어요. ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    const fresh = ((await risuai.getCharacterFromIndex(charIndex)) ?? char) as Record<string, unknown>;
    await risuai.setCharacterToIndex(charIndex, { ...fresh, additionalAssets: assets });
    saved += get.length;
  }
  forgetImages();
  return saved;
}

/** 아이콘: release/icon.png 를 받아 저장하고 메인 아이콘으로. 설치 전 아이콘은 기록해 둔다 (「이전 아이콘으로」) */
export async function installIcon(charIndex: number, progress: Progress): Promise<void> {
  if (!INSTALL_ICON.file) throw new Error('이 판에는 아이콘 정보가 없어요.');
  const char = (await risuai.getCharacterFromIndex(charIndex)) as Record<string, unknown> | null;
  if (!char) throw new Error('캐릭터를 찾을 수 없어요.');
  progress('아이콘 받는 중…');
  const bytes = await getBytes(INSTALL_ICON.file);
  if (INSTALL_ICON.bytes && bytes.length !== INSTALL_ICON.bytes) throw new Error('아이콘을 끝까지 받지 못했어요.');
  // 지문(icon.json digest)도 본다: 길이만 같은 엉뚱한 파일을 메인 아이콘으로 쓰지 않게 (지문을 못 내는 환경이면 길이만)
  const d = INSTALL_ICON.digest ? await digest(bytes) : null;
  if (d && d !== INSTALL_ICON.digest) throw new Error('받은 아이콘이 이 판의 아이콘과 달라요.');
  const path = await risuai.saveAsset(bytes);
  if (typeof path !== 'string' || !path) throw new Error('아이콘을 저장하지 못했어요.');
  const notes = await iconNotes();
  const id = charId(char);
  const prev = String(char.image ?? '');
  notes[id] = { ours: path, prev: notes[id]?.ours === prev ? notes[id].prev : prev };
  await risuai.pluginStorage.setItem(ICON_KEY, JSON.stringify(notes));
  // Risu 는 캐릭터 아이콘을 여러 개 둘 수 있다 (캐릭터 디스플레이 → 캐릭터 아이콘 「+」, ccAssets 의 type icon). 메인은 image.
  // 기존 아이콘은 목록에 남기고(없으면 더해) 우리 것을 더한 뒤 메인으로 (사용자 2026-10-27)
  const cc = (Array.isArray(char.ccAssets) ? (char.ccAssets as CcAsset[]) : []).filter((a) => a && typeof a === 'object');
  const hasIcon = (uri: string) => cc.some((a) => a.type === 'icon' && a.uri === uri);
  if (prev && !hasIcon(prev)) cc.push({ type: 'icon', uri: prev, name: cc.some((a) => a.type === 'icon' && a.name === 'main') ? 'previous' : 'main', ext: extOf(prev) });
  if (!hasIcon(path)) cc.push({ type: 'icon', uri: path, name: 'goei', ext: 'png' });
  await risuai.setCharacterToIndex(charIndex, { ...char, image: path, ccAssets: cc });
}

interface CcAsset {
  type: string;
  uri: string;
  name: string;
  ext: string;
}
const extOf = (path: string) => /\.(png|jpe?g|webp|avif|gif)$/i.exec(path)?.[1]?.toLowerCase() ?? 'png';

/** 설치 전 아이콘으로 되돌린다 */
export async function restoreIcon(charIndex: number): Promise<boolean> {
  const char = (await risuai.getCharacterFromIndex(charIndex)) as Record<string, unknown> | null;
  if (!char) return false;
  const notes = await iconNotes();
  const note = notes[charId(char)];
  if (!note?.prev) return false;
  await risuai.setCharacterToIndex(charIndex, { ...char, image: note.prev });
  delete notes[charId(char)];
  await risuai.pluginStorage.setItem(ICON_KEY, JSON.stringify(notes));
  return true;
}

/** 위키 기본 문서 묶음: release/wiki-base.N.txt 를 받아 저장소에 */
export async function installWikiPack(progress: Progress): Promise<number> {
  if (!UPDATE_BASE) throw new Error('받을 곳이 정해지지 않은 빌드예요.');
  progress('위키 기본 문서 목록 받는 중…');
  let index: { parts?: unknown; length?: unknown } | null = null;
  try {
    index = JSON.parse((await getText('wiki-base.json')).replace(/^﻿/, ''));
  } catch {
    throw new Error('위키 기본 문서 목록을 받지 못했어요.');
  }
  if (!index || !Array.isArray(index.parts)) throw new Error('위키 기본 문서 목록 형식이 달라요.');
  let text = '';
  let n = 0;
  for (const name of index.parts) {
    if (typeof name !== 'string' || !/^wiki-base\.\d+\.txt$/.test(name)) throw new Error('위키 기본 문서 목록 형식이 달라요.');
    text += await getText(name);
    progress(`위키 기본 문서 받는 중 ${++n}/${index.parts.length}`);
  }
  if (typeof index.length === 'number' && text.length !== index.length) throw new Error(`위키 기본 문서를 끝까지 받지 못했어요. (${text.length}/${index.length}자)`);
  if (!text.startsWith(WIKI_PACK_HEAD)) throw new Error('위키 기본 문서 묶음 형식이 달라요.');
  await risuai.pluginStorage.setItem(WIKI_KEY, text);
  setStoredWikiPack(text);
  return text.length;
}

/** 저장소의 토크나이저 순위표를 올린다 (본체 시작 때 한 번, 화면을 막지 않게 뒤로 미룸) */
export async function loadStoredTokenizer(): Promise<void> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(TOK_KEY);
    if (typeof raw === 'string' && raw.length > 1000) setTimeout(() => setTokenizerRanks(raw, 'o200k_base'), 0);
  } catch {
    // 어림값 그대로
  }
}

/** 토크나이저 순위표: release/tok-o200k.N.txt 를 받아 저장소에 */
export async function installTokenizer(progress: Progress): Promise<void> {
  if (!UPDATE_BASE) throw new Error('받을 곳이 정해지지 않은 빌드예요.');
  progress('토크나이저 목록 받는 중…');
  let index: { parts?: unknown; length?: unknown; name?: unknown } | null = null;
  try {
    index = JSON.parse((await getText('tok-o200k.json')).replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('토크나이저 목록을 받지 못했어요.');
  }
  if (!index || !Array.isArray(index.parts)) throw new Error('토크나이저 목록 형식이 달라요.');
  let text = '';
  let n = 0;
  for (const name of index.parts) {
    if (typeof name !== 'string' || !/^tok-o200k\.\d+\.txt$/.test(name)) throw new Error('토크나이저 목록 형식이 달라요.');
    text += await getText(name);
    progress(`토크나이저 받는 중 ${++n}/${index.parts.length}`);
  }
  if (typeof index.length === 'number' && text.length !== index.length) throw new Error(`토크나이저를 끝까지 받지 못했어요. (${text.length}/${index.length}자)`);
  if (!setTokenizerRanks(text, 'o200k_base')) throw new Error('토크나이저 순위표 형식이 달라요.');
  await risuai.pluginStorage.setItem(TOK_KEY, text);
}

export async function dropTokenizer(): Promise<void> {
  await risuai.pluginStorage.removeItem(TOK_KEY).catch(() => {});
  clearTokenizer();
}

/** 저장소의 위키 묶음을 지운다 (카드에 묶음이 들어 있는 옛 카드면 그걸 쓴다) */
export async function dropWikiPack(): Promise<void> {
  await risuai.pluginStorage.removeItem(WIKI_KEY).catch(() => {});
  setStoredWikiPack(null);
}
