// 깡통봇 설치·점검 (docs/설계안_세계편집.md 9절). 아무 봇에나 플러그인을 설치할 수 있게 카드에 있어야 할 것을 플러그인이 심는다:
// ⚙️설정 폴더(Directory·Plugin manifest), 첫 메시지(시작 안내), 인사말(매니페스트 키→번호), 로어북 설정, 카드 사진(release/pic), 아이콘, 위키 기본 문서 묶음.
// 여기는 순수 계산(검사·로어북 만들기)만. 받기·저장은 host/install.ts.
// 설치 자료(인사말·카드 사진 목록·기본 명부·아이콘 정보)는 본체에 번들하지 않는다 (QC 개선 나1): 설치·점검 화면을 열 때 자료 팩
// (goei-data-install, core/datapack.ts applyInstallPack → setInstallData) 을 받아 넣는다. 저장소에는 두지 않는다 (docs/qc/09_개선_나_1.md).
import { DIRECTORY_COMMENT, MANIFEST_COMMENT, directoryEntries, manifestEntry } from './lorebooks';
import { readManifest } from './start';
import { PLUGIN_VERSION } from './update';
import { readDirectoryData } from './world/directory';
import { DEFAULT_BUDGET, DEFAULT_DEPTH } from './lore';
import { pictures as manifestPictures, type Picture } from './pictures';
import type { LoreEntry, Manifest } from './types';

/** 설치 자료 (자료 팩 goei-data-install 의 내용) */
export interface InstallData {
  /** 인사말: 매니페스트 키 → texts 번호, 글. first = 카드 첫 메시지(시작 안내) */
  greetings: { index: Record<string, number>; texts: string[]; first: string };
  /** 카드 사진 [이름, 지문, 확장자, 크기] */
  pictures: Picture[];
  /** 기본 명부(Directory) */
  directory: Record<string, unknown>;
  /** 아이콘: release/icon.png 파일 이름·지문·크기 */
  icon: { file?: string; digest?: string; bytes?: number };
}

let data: InstallData | null = null;
export function setInstallData(d: InstallData): void {
  if (!d.greetings || typeof d.greetings.index !== 'object' || !Array.isArray(d.greetings.texts) || typeof d.greetings.first !== 'string') throw new Error('설치 자료 형식이 달라요 (greetings).');
  if (!Array.isArray(d.pictures)) throw new Error('설치 자료 형식이 달라요 (pictures).');
  if (!d.directory || typeof d.directory !== 'object') throw new Error('설치 자료 형식이 달라요 (directory).');
  if (!d.icon || typeof d.icon !== 'object') throw new Error('설치 자료 형식이 달라요 (icon).');
  data = d;
}
export const installDataReady = (): boolean => data !== null;
/** 설치 자료. 아직 받지 않았으면 던진다 (host/install.ts 가 설치·점검 전에 ensureInstallData 로 받는다) */
export function installData(): InstallData {
  if (!data) throw new Error('설치 자료(goei-data-install)를 아직 받지 않았어요. 설치·점검 화면을 다시 열어 주세요.');
  return data;
}

export const SETTINGS_FOLDER_NAME = '⚙️설정';
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

/** ⚙️설정 폴더 찾기: 매니페스트 key → 그 key 의 폴더, 없으면 이름으로 */
export function findFolder(lore: LoreEntry[]): LoreEntry | undefined {
  const key = str(readManifest(lore)?.keys?.settings);
  const byKey = key ? lore.find((e) => isFolder(e) && e.key === key) : undefined;
  return byKey ?? lore.find((e) => isFolder(e) && str(e.comment).trim() === SETTINGS_FOLDER_NAME);
}

/** 카드 첫 메시지(시작 안내)인가. 옛 카드 문구도 알아본다 (본체가 이 글을 테마 색 안내판으로 다시 그린다) */
export function isLanding(text: unknown): boolean {
  return typeof text === 'string' && (text.includes('data-goei="landing"') || (text.includes('ANOMALY SIMULATION') && text.includes('버튼을 눌러 시작하세요')));
}

/** Risu 캐릭터 로어북 설정 (없으면 Risu 가 「글로벌 설정 사용」으로 본다) */
export interface LoreSettings {
  tokenBudget: number;
  scanDepth: number;
  recursiveScanning: boolean;
}

/** 로어북 설정이 없는 봇에만 넣을 값: 플러그인 기본(검색 깊이·토큰 예산, 사용자 2026-10-27). 재귀 검색은 Risu 가 설정을 켤 때의 기본(끔). 있으면 null */
export function installLoreSettings(cur: unknown): LoreSettings | null {
  return cur && typeof cur === 'object' ? null : { tokenBudget: DEFAULT_BUDGET, scanDepth: DEFAULT_DEPTH, recursiveScanning: false };
}

export interface InstallState {
  /** 괴이 카드로 인정되나 (매니페스트 또는 명부) */
  goei: boolean;
  manifest: boolean;
  directory: boolean;
  /** 명부가 있긴 한데 깨졌거나(읽을 수 없음) 기본 명부의 칸이 빠졌나 — 「빠진 것 전부 채우기」가 빠진 칸만 채운다 (2026-10-29) */
  directoryGaps: number;
  settingsFolder: boolean;
  /** 첫 메시지가 시작 안내인가 (아니면 안내판이 안 뜬다) */
  firstMessage: boolean;
  /** 봇에 로어북 설정이 있나 (없으면 Risu 가 「글로벌 설정 사용」) */
  loreSettings: boolean;
  /** 인사말: 매니페스트 키마다 추가 인사말에 글이 있나. missing = 심어야 할 키 */
  greetings: { ok: boolean; missing: string[]; total: number };
  /** 사진: 카드 에셋에 없는 카드 사진 */
  pictures: { missing: Picture[]; bytes: number; total: number };
  /** 아이콘: 우리 아이콘이 메인인가 (지문 기록으로 판단) */
  icon: boolean;
  /** 위키 기본 문서 묶음이 있나 (카드 로어북 또는 저장소) */
  wikiPack: boolean;
  /** 토크나이저(o200k_base) 순위표가 저장소에 있나 */
  tokenizer: boolean;
}

type Row = [string, string, string?];
const isRow = (r: unknown): r is Row => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string';

export interface CheckInput {
  lore: LoreEntry[] | undefined;
  firstMessage: unknown;
  loreSettings: unknown;
  alternateGreetings: unknown;
  assets: unknown;
  /** 지금 아이콘이 우리 것인지 (host 가 저장소 기록으로 안다) */
  iconOurs: boolean;
  wikiPack: boolean;
  tokenizer: boolean;
}

/** 설치 상태 점검 */
export function installCheck(i: CheckInput): InstallState {
  const lore = i.lore ?? [];
  const m = readManifest(lore);
  const greetings = Array.isArray(i.alternateGreetings) ? (i.alternateGreetings as unknown[]) : [];
  const idx = m?.greetings ?? {};
  const inst = installData();
  const missing = Object.keys(inst.greetings.index).filter((k) => {
    const n = idx[k];
    if (!Number.isInteger(n) || n < 0 || n >= greetings.length) return true;
    const want = inst.greetings.texts[inst.greetings.index[k]] ?? '';
    return want ? typeof greetings[n] !== 'string' || !(greetings[n] as string).trim() : false;
  });
  const have = new Set(((Array.isArray(i.assets) ? i.assets : []) as unknown[]).filter(isRow).map((r) => r[0]));
  // 깡통봇(매니페스트에 source 없음)은 설치 때 적어 둔 목록이 아니라 지금 설치 자료의 목록으로 본다: 새 릴리스에 추가된 사진,
  // 지문이 바뀐 사진(매니페스트에 적힌 지문과 다름)도 「없음」으로 세어 다시 받게 한다 (loader#6). 정식 카드는 카드 업데이트가 맡는다
  const listed = manifestPictures(m);
  const known = new Map(listed.map((p) => [p[0], p[1]]));
  const want = listed.length && m?.source ? listed : inst.pictures;
  const missingPics = want.filter((p) => !have.has(p[0]) || (known.has(p[0]) && known.get(p[0]) !== p[1]));
  let directory = false;
  let directoryGaps = 0;
  try {
    directory = !!readDirectoryData(lore);
    directoryGaps = directoryGapCount(lore ?? []);
  } catch {
    directory = false;
  }
  return {
    goei: !!m || directory,
    manifest: !!m,
    directory,
    directoryGaps,
    settingsFolder: !!findFolder(lore),
    firstMessage: isLanding(i.firstMessage),
    loreSettings: !installLoreSettings(i.loreSettings),
    greetings: { ok: !missing.length, missing, total: Object.keys(inst.greetings.index).length },
    pictures: { missing: missingPics, bytes: missingPics.reduce((n, p) => n + (Number(p[3]) || 0), 0), total: want.length },
    icon: i.iconOurs,
    wikiPack: i.wikiPack,
    tokenizer: i.tokenizer,
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
  const inst = installData();
  for (const [key, n] of Object.entries(inst.greetings.index)) {
    const text = inst.greetings.texts[n] ?? '';
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
export function buildManifest(o: { greetings: Record<string, number>; settingsKey: string; prev?: Manifest | null }): Manifest & { keys: Record<string, string>; pictures: Picture[] } {
  const prev = (o.prev ?? {}) as Partial<Manifest> & { keys?: Record<string, string> };
  // 위키 폴더 key 는 쓰지 않아 뺀다 (2026-11-08: 위키는 로어북에 두지 않는다)
  const { wiki: _wiki, ...keys } = prev.keys ?? {};
  return {
    ...prev,
    schema: 1,
    plugin: 'goei-plugin',
    version: prev.version ?? PLUGIN_VERSION,
    greetings: o.greetings,
    pictures: manifestPictures(prev as Manifest).length ? manifestPictures(prev as Manifest) : installData().pictures,
    keys: { ...keys, settings: o.settingsKey },
  };
}

/**
 * 받아 저장한 카드 사진을 깡통봇 매니페스트의 사진 목록에 적는다 (같은 이름은 새 지문으로, 새 이름은 뒤에): 점검이 다음에 다시 받으라고 하지 않게 (loader#6).
 * 매니페스트가 없거나 정식 카드(source 있음)이거나 바뀐 것이 없으면 null
 */
export function notePictures(lore: LoreEntry[] | undefined, got: Picture[]): LoreEntry[] | null {
  const old = lore ? manifestEntry(lore) : undefined;
  const m = lore ? readManifest(lore) : null;
  if (!lore || !old || !m || m.source || !got.length) return null;
  const list = manifestPictures(m).map((p) => [...p] as Picture);
  const at = new Map(list.map((p, n) => [p[0], n]));
  let changed = false;
  for (const p of got) {
    const n = at.get(p[0]);
    if (n === undefined) {
      at.set(p[0], list.length);
      list.push([...p] as Picture);
      changed = true;
    } else if (list[n][1] !== p[1] || list[n][2] !== p[2] || list[n][3] !== p[3]) {
      list[n] = [...p] as Picture;
      changed = true;
    }
  }
  if (!changed) return null;
  return lore.map((e) => (e === old ? { ...old, content: JSON.stringify({ ...m, pictures: list }) } : e));
}

const entry = (comment: string, content: string, folder: string, extra: Partial<LoreEntry> = {}): LoreEntry =>
  ({ key: '', secondkey: '', insertorder: 0, comment, content, mode: 'normal', alwaysActive: false, selective: false, useRegex: false, folder, bookVersion: 2, ...extra }) as LoreEntry;
const folderEntry = (comment: string, key: string): LoreEntry =>
  ({ key, comment, content: '', mode: 'folder', insertorder: 100, alwaysActive: false, secondkey: '', selective: false, bookVersion: 2 }) as LoreEntry;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const empty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length);

/**
 * 있는 명부에 기본 명부의 빠진 칸만 채운다 (2026-10-29 사용자: 깡통봇 명부가 비어 거점 0·소속 없음·영문명 잘림·괴담톡 탭 없음).
 * 고친 값은 그대로 두고, 없는 큰 칸·없는 항목·항목 안의 없는 칸만 기본 값으로. 바뀐 칸 수와 결과를 돌려준다.
 * 사용자가 지운 것·일부러 비운 것은 되살리지 않는다 (loader#2):
 * - 명부의 `_removed`(지우거나 이름을 바꾼 거점·조직 이름, core/world/directory.ts withDirectory 가 적는다)에 있는 항목은 건너뛴다
 * - 항목 안의 칸은 아예 없을 때(undefined)만 채운다. 빈 글·빈 목록(소속 미정·직급 없음·목록에서 숨김)은 사용자가 비운 값이라 그대로 둔다.
 *   다만 기본 명부를 한 번도 받은 적 없는 명부(거점이 비어 있고 지운 기록도 없음 — 10-29 의 깡통봇 명부)는 빈 칸도 채운다
 */
export function fillDirectory(cur: Record<string, unknown>, def: Record<string, unknown>): { data: Record<string, unknown>; gaps: number } {
  const out: Record<string, unknown> = { ...cur };
  let gaps = 0;
  const removedOf = (k: string): Set<string> => {
    const r = isObj(cur._removed) ? cur._removed[k] : undefined;
    return new Set(Array.isArray(r) ? r.filter((n): n is string => typeof n === 'string') : []);
  };
  const bare = empty(cur.거점) && !removedOf('거점').size;
  for (const [k, dv] of Object.entries(def)) {
    if (k === '_help' || k === '_removed') continue;
    const cv = out[k];
    const removed = removedOf(k);
    if (empty(cv)) {
      // 사용자가 지운 항목은 빼고 채운다 (전부 지웠으면 빈 채로 둔다)
      const fill = removed.size && isObj(dv) ? Object.fromEntries(Object.entries(dv).filter(([name]) => !removed.has(name))) : dv;
      if (!empty(fill)) (out[k] = fill), gaps++;
      continue;
    }
    // 괴담톡 탭은 통째로 (탭 줄이 비면 괴담톡이 안 나온다)
    if (k === '괴담톡 탭') {
      if (isObj(cv) && empty(cv.tabs) && isObj(dv) && !empty(dv.tabs)) (out[k] = dv), gaps++;
      continue;
    }
    if (!isObj(cv) || !isObj(dv)) continue;
    const sec: Record<string, unknown> = { ...cv };
    for (const [name, de] of Object.entries(dv)) {
      const ce = sec[name];
      if (ce === undefined) {
        if (removed.has(name)) continue;
        sec[name] = de;
        gaps++;
      } else if (isObj(ce) && isObj(de)) {
        const row: Record<string, unknown> = { ...ce };
        for (const [f, fv] of Object.entries(de)) if ((bare ? empty(row[f]) : row[f] === undefined) && !empty(fv)) (row[f] = fv), gaps++;
        sec[name] = row;
      }
    }
    out[k] = sec;
  }
  return { data: out, gaps };
}

/** 명부 상태: 깨졌으면(읽을 수 없음) -1, 빠진 칸 수(0 이면 온전) */
function directoryGapCount(lore: LoreEntry[]): number {
  const parts = directoryEntries(lore).filter((e) => typeof e.content === 'string' && e.content.trim());
  if (!parts.length) return 0;
  const cur = readDirectoryData(lore) as unknown as Record<string, unknown> | null;
  if (!cur) return -1;
  return data ? fillDirectory(cur, installData().directory).gaps : 0;
}

/**
 * 로어북 심기: 없는 것만 만든다 (⚙️설정 폴더 → Directory(기본 명부) → Plugin manifest). 있는 항목은 그대로.
 * 매니페스트는 늘 다시 써서 폴더 key·인사말 번호를 맞춘다
 */
export function installLore(lore: LoreEntry[] | undefined, greetings: Record<string, number>): LoreEntry[] {
  const out = [...(lore ?? [])];
  let settings = findFolder(out);
  if (!settings) {
    settings = folderEntry(SETTINGS_FOLDER_NAME, `${FOLDER_PREFIX}${uuid()}`);
    out.push(settings);
  }
  const settingsKey = str(settings.key);
  const dir = directoryEntries(out).filter((e) => typeof e.content === 'string' && e.content.trim());
  const cur = dir.length ? (readDirectoryData(out) as unknown as Record<string, unknown> | null) : null;
  if (!dir.length || !cur) {
    // 없거나 깨진 명부: 깨진 것은 이름을 바꿔 남기고(지우지 않는다) 기본 명부를 새로 둔다
    for (const e of dir) e.comment = `${String(e.comment)} (읽을 수 없어 보관)`;
    const stale = out.findIndex((e) => e.comment === DIRECTORY_COMMENT);
    const fresh = entry(DIRECTORY_COMMENT, JSON.stringify(installData().directory), settingsKey);
    if (stale >= 0) out[stale] = fresh;
    else out.push(fresh);
  } else {
    for (const e of dir) if (!e.folder) e.folder = settingsKey;
    // 있는 명부: 빠진 칸만 기본 값으로 채운다 (고친 값은 그대로)
    const filled = fillDirectory(cur, installData().directory);
    if (filled.gaps) {
      const first = out.indexOf(dir[0]);
      out[first] = { ...dir[0], comment: DIRECTORY_COMMENT, content: JSON.stringify(filled.data) };
      for (let i = out.length - 1; i >= 0; i--) if (i !== first && dir.includes(out[i])) out.splice(i, 1);
    }
  }
  const prev = readManifest(out);
  const manifest = buildManifest({ greetings, settingsKey, prev });
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
  if (!s.directory) out.push(s.directoryGaps < 0 ? '명부(Directory)를 읽을 수 없음' : '명부(Directory) 없음');
  else if (s.directoryGaps > 0) out.push(`명부에 빠진 칸 ${s.directoryGaps}개`);
  if (!s.manifest) out.push('Plugin manifest 없음');
  if (!s.firstMessage) out.push('첫 메시지(시작 안내) 없음');
  if (!s.loreSettings) out.push('로어북 설정 없음');
  if (!s.greetings.ok) out.push(`인사말 ${s.greetings.missing.length}/${s.greetings.total}개 없음`);
  if (s.pictures.missing.length) out.push(`카드 사진 ${s.pictures.missing.length}/${s.pictures.total}장 없음`);
  if (!s.wikiPack) out.push('위키 기본 문서 없음');
  if (!s.tokenizer) out.push('토크나이저 없음');
  return out;
}
