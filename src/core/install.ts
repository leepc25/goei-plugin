// 깡통봇 설치·점검 (docs/설계안_세계편집.md 9절). 아무 봇에나 플러그인을 설치할 수 있게 카드에 있어야 할 것을 플러그인이 심는다:
// ⚙️설정 폴더(Directory·Plugin manifest), 📖위키 폴더, 인사말 57개(매니페스트 키→번호), 카드 사진 1,751장(release/pic), 아이콘, 위키 기본 문서 묶음.
// 여기는 순수 계산(검사·로어북 만들기)만. 받기·저장은 host/install.ts.
import greetingsRaw from '../data/install/greetings.json';
import picturesRaw from '../data/install/pictures.json';
import directoryRaw from '../data/install/directory.json';
import iconRaw from '../data/install/icon.json';
import { DIRECTORY_COMMENT, MANIFEST_COMMENT, directoryEntries, manifestEntry } from './lorebooks';
import { readManifest } from './start';
import { PLUGIN_VERSION } from './update';
import { readDirectoryData } from './world/directory';
import { pictures as manifestPictures, type Picture } from './pictures';
import type { LoreEntry, Manifest } from './types';

export const INSTALL_GREETINGS = greetingsRaw as { index: Record<string, number>; texts: string[] };
export const INSTALL_PICTURES = picturesRaw as Picture[];
export const DEFAULT_DIRECTORY = directoryRaw as Record<string, unknown>;
export const INSTALL_ICON = iconRaw as { file?: string; digest?: string; bytes?: number };

export const SETTINGS_FOLDER_NAME = '⚙️설정';
export const WIKI_FOLDER_NAME = '📖위키';
/** 카드 빌드와 같은 위키 폴더 key (tools/build_lite_card.py WIKI_FOLDER_KEY) */
export const WIKI_FOLDER_KEY = 'folder:6f1c2a7e-wiki-0000-0000-goeiwiki0001';
const FOLDER_PREFIX = 'folder:';

const isFolder = (e: LoreEntry) => e.mode === 'folder';
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 괴이 카드인가: 매니페스트가 있거나(정식), 명부(Directory)만 있어도(매니페스트를 지운 카드) 인정한다 */
export function isGoeiLore(lore: LoreEntry[] | undefined): boolean {
  if (!lore?.length) return false;
  if (readManifest(lore)) return true;
  try {
    return !!readDirectoryData(lore);
  } catch {
    return false;
  }
}

/** 폴더 찾기: 매니페스트 key → 그 key 의 폴더, 없으면 이름으로 */
export function findFolder(lore: LoreEntry[], which: 'settings' | 'wiki'): LoreEntry | undefined {
  const m = readManifest(lore);
  const key = str((m as Manifest & { keys?: Record<string, unknown> })?.keys?.[which]);
  const byKey = key ? lore.find((e) => isFolder(e) && e.key === key) : undefined;
  if (byKey) return byKey;
  const name = which === 'settings' ? SETTINGS_FOLDER_NAME : WIKI_FOLDER_NAME;
  return lore.find((e) => isFolder(e) && str(e.comment).trim() === name) ?? (which === 'wiki' ? lore.find((e) => isFolder(e) && e.key === WIKI_FOLDER_KEY) : undefined);
}

export interface InstallState {
  /** 괴이 카드로 인정되나 (매니페스트 또는 명부) */
  goei: boolean;
  manifest: boolean;
  directory: boolean;
  settingsFolder: boolean;
  wikiFolder: boolean;
  /** 인사말: 매니페스트 키마다 추가 인사말에 글이 있나. missing = 심어야 할 키 */
  greetings: { ok: boolean; missing: string[]; total: number };
  /** 사진: 카드 에셋에 없는 카드 사진 */
  pictures: { missing: Picture[]; bytes: number; total: number };
  /** 아이콘: 우리 아이콘이 메인인가 (지문 기록으로 판단) */
  icon: boolean;
  /** 위키 기본 문서 묶음이 있나 (카드 로어북 또는 저장소) */
  wikiPack: boolean;
}

type Row = [string, string, string?];
const isRow = (r: unknown): r is Row => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string';

export interface CheckInput {
  lore: LoreEntry[] | undefined;
  alternateGreetings: unknown;
  assets: unknown;
  /** 지금 아이콘이 우리 것인지 (host 가 저장소 기록으로 안다) */
  iconOurs: boolean;
  wikiPack: boolean;
}

/** 설치 상태 점검 */
export function installCheck(i: CheckInput): InstallState {
  const lore = i.lore ?? [];
  const m = readManifest(lore);
  const greetings = Array.isArray(i.alternateGreetings) ? (i.alternateGreetings as unknown[]) : [];
  const idx = m?.greetings ?? {};
  const missing = Object.keys(INSTALL_GREETINGS.index).filter((k) => {
    const n = idx[k];
    if (!Number.isInteger(n) || n < 0 || n >= greetings.length) return true;
    const want = INSTALL_GREETINGS.texts[INSTALL_GREETINGS.index[k]] ?? '';
    return want ? typeof greetings[n] !== 'string' || !(greetings[n] as string).trim() : false;
  });
  const have = new Set(((Array.isArray(i.assets) ? i.assets : []) as unknown[]).filter(isRow).map((r) => r[0]));
  const want = manifestPictures(m).length ? manifestPictures(m) : INSTALL_PICTURES;
  const missingPics = want.filter((p) => !have.has(p[0]));
  let directory = false;
  try {
    directory = !!readDirectoryData(lore);
  } catch {
    directory = false;
  }
  return {
    goei: !!m || directory,
    manifest: !!m,
    directory,
    settingsFolder: !!findFolder(lore, 'settings'),
    wikiFolder: !!findFolder(lore, 'wiki'),
    greetings: { ok: !missing.length, missing, total: Object.keys(INSTALL_GREETINGS.index).length },
    pictures: { missing: missingPics, bytes: missingPics.reduce((n, p) => n + (Number(p[3]) || 0), 0), total: want.length },
    icon: i.iconOurs,
    wikiPack: i.wikiPack,
  };
}

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

/**
 * 인사말 심기: 있는 추가 인사말은 그대로 두고(사용자 것), 우리 글과 같은 글이 이미 있으면 그 번호를 쓰고, 없으면 뒤에 붙인다.
 * 직접 입력 시나리오의 빈 인사말은 하나를 같이 쓴다 (카드 빌드 build_openings 와 같은 구조: 키 → alternateGreetings 번호)
 */
export function plantGreetings(existing: unknown): { greetings: string[]; index: Record<string, number> } {
  const out = (Array.isArray(existing) ? existing : []).map((g) => (typeof g === 'string' ? g : ''));
  const index: Record<string, number> = {};
  const at = new Map<string, number>();
  out.forEach((g, n) => {
    if (!at.has(g)) at.set(g, n);
  });
  for (const [key, n] of Object.entries(INSTALL_GREETINGS.index)) {
    const text = INSTALL_GREETINGS.texts[n] ?? '';
    let hit = at.get(text);
    if (hit === undefined) {
      hit = out.length;
      out.push(text);
      at.set(text, hit);
    }
    index[key] = hit;
  }
  return { greetings: out, index };
}

/** 매니페스트 글 */
export function buildManifest(o: { greetings: Record<string, number>; settingsKey: string; wikiKey: string; prev?: Manifest | null }): Manifest & { keys: Record<string, string>; pictures: Picture[] } {
  const prev = (o.prev ?? {}) as Partial<Manifest> & { keys?: Record<string, string>; wiki?: unknown };
  return {
    ...prev,
    schema: 1,
    plugin: 'goei-plugin',
    version: prev.version ?? PLUGIN_VERSION,
    greetings: o.greetings,
    pictures: manifestPictures(prev as Manifest).length ? manifestPictures(prev as Manifest) : INSTALL_PICTURES,
    keys: { ...(prev.keys ?? {}), settings: o.settingsKey, wiki: o.wikiKey },
  };
}

const entry = (comment: string, content: string, folder: string, extra: Partial<LoreEntry> = {}): LoreEntry =>
  ({ key: '', secondkey: '', insertorder: 0, comment, content, mode: 'normal', alwaysActive: false, selective: false, useRegex: false, folder, bookVersion: 2, ...extra }) as LoreEntry;
const folderEntry = (comment: string, key: string): LoreEntry =>
  ({ key, comment, content: '', mode: 'folder', insertorder: 100, alwaysActive: false, secondkey: '', selective: false, bookVersion: 2 }) as LoreEntry;

/**
 * 로어북 심기: 없는 것만 만든다 (⚙️설정 폴더 → Directory(기본 명부) → 📖위키 폴더 → Plugin manifest). 있는 항목은 그대로.
 * 매니페스트는 늘 다시 써서 폴더 key·인사말 번호를 맞춘다
 */
export function installLore(lore: LoreEntry[] | undefined, greetings: Record<string, number>): LoreEntry[] {
  const out = [...(lore ?? [])];
  let settings = findFolder(out, 'settings');
  if (!settings) {
    settings = folderEntry(SETTINGS_FOLDER_NAME, `${FOLDER_PREFIX}${uuid()}`);
    out.push(settings);
  }
  const settingsKey = str(settings.key);
  const dir = directoryEntries(out).filter((e) => typeof e.content === 'string' && e.content.trim());
  if (!dir.length) {
    const stale = out.findIndex((e) => e.comment === DIRECTORY_COMMENT);
    const fresh = entry(DIRECTORY_COMMENT, JSON.stringify(DEFAULT_DIRECTORY), settingsKey);
    if (stale >= 0) out[stale] = fresh;
    else out.push(fresh);
  } else {
    for (const e of dir) if (!e.folder) e.folder = settingsKey;
  }
  let wiki = findFolder(out, 'wiki');
  if (!wiki) {
    wiki = folderEntry(WIKI_FOLDER_NAME, WIKI_FOLDER_KEY);
    out.push(wiki);
  }
  const prev = readManifest(out);
  const manifest = buildManifest({ greetings, settingsKey, wikiKey: str(wiki.key), prev });
  const old = manifestEntry(out);
  const fresh = entry(MANIFEST_COMMENT, JSON.stringify(manifest), settingsKey);
  if (old) {
    const at = out.indexOf(old);
    out[at] = { ...old, content: fresh.content, folder: old.folder || settingsKey };
  } else out.push(fresh);
  return out;
}

/** 점검 요약 글 (설치 화면·설정 안내) */
export function installSummary(s: InstallState): string[] {
  const out: string[] = [];
  if (!s.settingsFolder) out.push('⚙️설정 폴더 없음');
  if (!s.directory) out.push('명부(Directory) 없음');
  if (!s.manifest) out.push('Plugin manifest 없음');
  if (!s.wikiFolder) out.push('📖위키 폴더 없음');
  if (!s.greetings.ok) out.push(`인사말 ${s.greetings.missing.length}/${s.greetings.total}개 없음`);
  if (s.pictures.missing.length) out.push(`카드 사진 ${s.pictures.missing.length}/${s.pictures.total}장 없음`);
  if (!s.wikiPack) out.push('위키 기본 문서 없음');
  return out;
}
