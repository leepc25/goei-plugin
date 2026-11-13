// 깡통봇 설치·점검의 받기·저장 (core/install.ts 가 계산, 여기서 Risu 에 쓴다).
// 로어북·인사말은 캐릭터에, 사진은 에셋 저장소(release/pic), 아이콘은 release/icon.png 를 받아 메인 아이콘으로,
// 위키 기본 문서 묶음은 release/wiki-base.N.txt 를 받아 플러그인 저장소에 둔다.
// 설치 자료(인사말·사진 목록·기본 명부·아이콘 정보)는 점검 전에 자료 팩(goei-data-install)으로 받는다 (host/datapack.ts ensureInstallData, QC 개선 나1).
import { installCheck, installData, installLore, installLoreSettings, isLanding, plantGreetings, type InstallState } from '../core/install';
import { UPDATE_BASE } from '../core/update';
import { setStoredWikiPack, storedWikiPack, WIKI_PACK_HEAD } from '../core/wiki';
import { clearTokenizer, setTokenizerRanks, tokenizerName } from '../core/tokenizer';
import type { LoreEntry } from '../core/types';
import { digest, fetchPicture, mergePictures, PicError } from './picpack';
import type { Picture } from '../core/pictures';
import { ensureInstallData, getBytes, getText, type Progress } from './datapack';
import { forgetImages } from '../ui/images';
import { loadModuleAssets } from './assets';

const WIKI_KEY = 'goei:wikibase';
const TOK_KEY = 'goei:tok-o200k';
const ICON_KEY = 'goei:icon';

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

/** 지금 캐릭터의 설치 상태. 설치 자료가 아직 없으면 먼저 받는다 (진행 글은 progress 로) */
export async function checkInstall(charIndex: number, progress?: Progress): Promise<{ state: InstallState; iconPrev: string }> {
  await ensureInstallData(progress);
  const char = ((await risuai.getCharacterFromIndex(charIndex)) ?? {}) as Record<string, unknown>;
  const notes = await iconNotes();
  const note = notes[charId(char)];
  const lore = char.globalLore as LoreEntry[] | undefined;
  const packInLore = (lore ?? []).some((e) => typeof e.content === 'string' && e.content.startsWith(WIKI_PACK_HEAD));
  const state = installCheck({
    lore,
    firstMessage: char.firstMessage,
    loreSettings: char.loreSettings,
    alternateGreetings: char.alternateGreetings,
    assets: char.additionalAssets,
    iconOurs: !!note && note.ours === String(char.image ?? ''),
    wikiPack: packInLore || !!storedWikiPack(),
    tokenizer: !!tokenizerName(),
  });
  return { state, iconPrev: note?.prev ?? '' };
}

export type InstallStep = 'lore' | 'pictures' | 'icon' | 'wiki';
export type { Progress };

/** 로어북·첫 메시지·인사말·로어북 설정 심기 (없는 것만). 캐릭터를 저장한다 */
export async function installLoreAndGreetings(charIndex: number, o: { name?: string } = {}): Promise<void> {
  const char = (await risuai.getCharacterFromIndex(charIndex)) as Record<string, unknown> | null;
  if (!char) throw new Error('캐릭터를 찾을 수 없어요.');
  const planted = plantGreetings(char.alternateGreetings);
  const lore = installLore(char.globalLore as LoreEntry[] | undefined, planted.index);
  // 첫 메시지: 시작 안내가 아니면 시작 안내로 (안내판이 뜨게, 사용자 2026-11-08). 원래 글은 지우지 않고 추가 인사말 끝으로 옮긴다
  const first = char.firstMessage;
  const landing = isLanding(first) ? {} : { firstMessage: installData().greetings.first };
  if (!isLanding(first) && typeof first === 'string' && first.trim() && !planted.greetings.includes(first)) planted.greetings.push(first);
  // 로어북 설정: 없으면(「글로벌 설정 사용」) 플러그인 기본 값으로. 있으면 그대로
  const ls = installLoreSettings(char.loreSettings);
  // 봇 이름: 설치 화면의 선택(기본: 괴이 카드가 아니던 봇이면 「괴이: ANOMALY」로)
  await risuai.setCharacterToIndex(charIndex, {
    ...char,
    ...(o.name ? { name: o.name } : {}),
    ...landing,
    ...(ls ? { loreSettings: ls } : {}),
    globalLore: lore,
    alternateGreetings: planted.greetings,
  });
}

/** 없는 카드 사진을 release/pic 에서 받아 에셋 저장소에 넣는다 */
export async function installPictures(charIndex: number, progress: Progress): Promise<number> {
  const char = (await risuai.getCharacterFromIndex(charIndex)) as Record<string, unknown> | null;
  if (!char) throw new Error('캐릭터를 찾을 수 없어요.');
  const { state } = await checkInstall(charIndex);
  const all = state.pictures.missing;
  if (!all.length) return 0;
  // 일꾼 여럿이 한 장씩 받자마자 저장한다 (2026-11-08 사용자: 100장 받고 100장 저장하길 되풀이해 오래 걸림).
  // 캐릭터에는 COMMIT 장마다 한 번 적는다: 받다 끊겨도 저장한 만큼은 남아 다시 누르면 이어서 받는다
  const WORKERS = 8;
  const COMMIT = 300;
  let saved = 0;
  let assets: unknown = char.additionalAssets;
  const commit = async (list: [Picture, string][]) => {
    if (!list.length) return;
    assets = mergePictures(assets, list);
    const fresh = ((await risuai.getCharacterFromIndex(charIndex)) ?? char) as Record<string, unknown>;
    await risuai.setCharacterToIndex(charIndex, { ...fresh, additionalAssets: assets });
    saved += list.length;
  };
  for (let i = 0; i < all.length; i += COMMIT) {
    const get = all.slice(i, i + COMMIT);
    const done: [Picture, string][] = [];
    let next = 0;
    let failure: unknown = null;
    const worker = async () => {
      while (next < get.length && !failure) {
        const p = get[next++];
        try {
          const path = await risuai.saveAsset(await fetchPicture(p));
          if (typeof path !== 'string' || !path) throw new PicError('사진을 저장하지 못했어요.');
          done.push([p, path]);
        } catch (error) {
          failure ??= error;
          return;
        }
        const n = saved + done.length;
        if (n % 10 === 0 || n === all.length) progress(`사진 받는 중 ${n}/${all.length}`);
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    // 실패해도 이미 저장한 사진은 캐릭터에 적어 둔다 (안 적으면 저장소에 주인 없는 파일로 남는다)
    await commit(done);
    if (failure) {
      const why = failure instanceof Error ? failure.message : String(failure);
      throw new Error(saved ? `${saved}/${all.length}장까지 받았어요. ${why}` : why);
    }
  }
  forgetImages();
  // 채팅 속 그림 태그가 보는 에셋 목록도 다시 읽는다 (전수검사 11-13)
  void loadModuleAssets().catch(() => false);
  return saved;
}

/** 아이콘: release/icon.png 를 받아 저장하고 메인 아이콘으로. 설치 전 아이콘은 기록해 둔다 (「이전 아이콘으로」) */
export async function installIcon(charIndex: number, progress: Progress): Promise<void> {
  const icon = installData().icon;
  if (!icon.file) throw new Error('이 판에는 아이콘 정보가 없어요.');
  const char = (await risuai.getCharacterFromIndex(charIndex)) as Record<string, unknown> | null;
  if (!char) throw new Error('캐릭터를 찾을 수 없어요.');
  progress('아이콘 받는 중…');
  const bytes = await getBytes(icon.file);
  if (icon.bytes && bytes.length !== icon.bytes) throw new Error('아이콘을 끝까지 받지 못했어요.');
  // 지문(icon.json digest)도 본다: 길이만 같은 엉뚱한 파일을 메인 아이콘으로 쓰지 않게 (지문을 못 내는 환경이면 길이만)
  const d = icon.digest ? await digest(bytes) : null;
  if (d && d !== icon.digest) throw new Error('받은 아이콘이 이 판의 아이콘과 달라요.');
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
  if (!hasIcon(path)) cc.push({ type: 'icon', uri: path, name: 'goei', ext: extOf(icon.file) });
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

/** 옛 필드 게임 자료(코드·자산 팩)를 저장소에서 지운다. 2026-11-04 필드를 뺄 때 파일은 남겨 둔 실수 → 11-05 사용자: 지우기 단추 + 플러그인이 뜰 때 자동으로 */
export async function dropOldGame(): Promise<number> {
  let n = 0;
  try {
    const keys: unknown = await risuai.pluginStorage.keys();
    for (const k of Array.isArray(keys) ? keys : []) {
      if (typeof k === 'string' && (k === 'goei:game:code' || k.startsWith('goei:game:pack:'))) {
        await risuai.pluginStorage.removeItem(k).catch(() => {});
        n++;
      }
    }
  } catch {
    // 키 목록을 못 읽는 판: 코드 키만
    await risuai.pluginStorage.removeItem('goei:game:code').catch(() => {});
  }
  return n;
}
