// 카드 업데이트 (선택지용사 방식): 저장소에 올린 카드 데이터(card-update.json)를 받아 지금 카드에 덮어쓴다.
// 채팅·사진·에셋·이름은 그대로 두고, 로어북·정규식은 같은 이름끼리만 바꾸며, 사용자가 고친 명부(Directory)는 지킨다.
// 플러그인 자체는 Risu 설정의 플러그인 탭이 //@update-url로 갱신한다.
import { DIRECTORY_COMMENT, isDirectory, LEGACY_DATA, manifestEntry, OLD_DIRECTORY, RETIRED } from './lorebooks';
import { dropOldOutsidePlaces, migrateLore } from './world/directory';
import type { LoreEntry } from './types';

export const UPDATE_SCHEMA = 1;

/** 저장소의 release 폴더 raw 주소 (비어 있으면 업데이트 확인을 못 함). 빌드 때 package.json의 goei.updateBase로 채운다 */
export const UPDATE_BASE: string = typeof __UPDATE_BASE__ === 'string' ? __UPDATE_BASE__ : '';
declare const __UPDATE_BASE__: string | undefined;

/** 카드에서 바꾸는 칸 (Risu 캐릭터 객체 이름) */
export const CARD_FIELDS = [
  'characterVersion', 'firstMessage', 'alternateGreetings', 'creatorNotes', 'desc', 'personality', 'scenario', 'exampleMessage',
  'systemPrompt', 'postHistoryInstructions', 'backgroundHTML', 'lowLevelAccess', 'virtualscript', 'triggerscript',
] as const;

export interface CardPayload {
  schema: number;
  /** 카드 버전 (매니페스트 version과 비교) */
  version: string;
  /** 이 카드를 쓰려면 필요한 최소 플러그인 버전 */
  minPlugin: string;
  data: Partial<Record<(typeof CARD_FIELDS)[number], unknown>> & { globalLore: LoreEntry[]; customscript: { comment?: string }[] };
}

/** 사용자 손을 탄 값이라 업데이트가 덮어쓰지 않는 로어북 */
export const PROTECTED_LORE = [DIRECTORY_COMMENT, OLD_DIRECTORY];

export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** 지금 카드의 버전 (매니페스트 version, 없으면 0 = 업데이트 기능 이전 카드) */
export function cardVersion(lore: LoreEntry[] | undefined): string {
  const entry = manifestEntry(lore);
  try {
    const v = (JSON.parse(String(entry?.content ?? '')) as { version?: unknown }).version;
    return typeof v === 'string' && v ? v : '0';
  } catch {
    return '0';
  }
}

export function isPayload(x: unknown): x is CardPayload {
  const p = x as CardPayload;
  return !!p && p.schema === UPDATE_SCHEMA && typeof p.version === 'string' && !!p.data && Array.isArray(p.data.globalLore) && Array.isArray(p.data.customscript);
}

/** 같은 이름(+폴더)끼리 짝짓는 열쇠. 이름이 겹치면 순서로 구분한다 */
function keyed<T>(list: T[], name: (x: T) => string): string[] {
  const seen = new Map<string, number>();
  return list.map((x) => {
    const k = name(x);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return `${k}\u0000${n}`;
  });
}

export interface MergeCount { replaced: number; added: number; kept: number; protected: number }

/**
 * 새 목록을 기준으로 합친다: 같은 열쇠는 새 것으로 바꾸고(보호 항목은 지금 것 유지), 새 것에만 있으면 추가,
 * 지금 것에만 있으면(사용자가 넣은 것) 뒤에 그대로 남긴다.
 */
export function mergeByName<T>(current: T[], incoming: T[], name: (x: T) => string, keep: (x: T) => boolean = () => false): { list: T[]; count: MergeCount } {
  const ck = keyed(current, name);
  const ik = keyed(incoming, name);
  const cur = new Map(ck.map((k, i) => [k, current[i]]));
  const count: MergeCount = { replaced: 0, added: 0, kept: 0, protected: 0 };
  const list: T[] = incoming.map((x, i) => {
    const old = cur.get(ik[i]);
    if (old === undefined) {
      count.added++;
      return x;
    }
    if (keep(old)) {
      count.protected++;
      return old;
    }
    if (JSON.stringify(old) !== JSON.stringify(x)) count.replaced++;
    return x;
  });
  const used = new Set(ik);
  ck.forEach((k, i) => {
    if (used.has(k)) return;
    count.kept++;
    list.push(current[i]);
  });
  return { list, count };
}

/** 카드 업데이트 때 지우는 옛 정규식 */
export const RETIRED_SCRIPTS = ['📊상태창'];

const loreName = (e: LoreEntry) => `${e.comment ?? ''}\u0001${(e as { folder?: string }).folder ?? ''}`;

export interface UpdatePlan {
  next: Record<string, unknown>;
  lore: MergeCount;
  scripts: MergeCount;
  /** 바뀌는 카드 칸 이름 */
  fields: string[];
}

/**
 * 이름을 바꾼 로어북 맞추기: 옛 이름 명부(괴이봇 명부)는 새 카드의 Directory 자리로 옮겨 지키고,
 * 더 쓰지 않는 로어북(옛 매니페스트·LB Backend)은 뺀다. 새 카드에도 같은 이름이 있으면 그대로 둔다.
 */
function renamed(current: LoreEntry[], incoming: LoreEntry[]): LoreEntry[] {
  const target = incoming.find((e) => e.comment === DIRECTORY_COMMENT);
  const hasNew = current.some((e) => e.comment === DIRECTORY_COMMENT);
  const keepNames = new Set(incoming.map((e) => e.comment));
  return current
    .filter((e) => !RETIRED.includes(String(e.comment ?? '')) || keepNames.has(e.comment))
    .filter((e) => !(hasNew && e.comment === OLD_DIRECTORY))
    .map((e) => (e.comment === OLD_DIRECTORY && target ? { ...e, comment: DIRECTORY_COMMENT, folder: (target as { folder?: string }).folder } : e))
    .filter((e, i, all) => !isDirectory(e.comment) || all.findIndex((x) => isDirectory(x.comment)) === i);
}

/** 키 지문 (tools/build_lite_card.py key_print와 같게): 쉼표로 나눠 다듬고 다시 이은 글의 FNV-1a 32비트 */
export function keyPrint(key: unknown): string {
  const norm = String(key ?? '').split(',').map((k) => k.trim()).filter(Boolean).join(',');
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(norm)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** 새 카드 매니페스트의 「카드가 낸 적 있는 키」 지문 {로어북 이름: [지문…]} */
function shippedKeys(lore: LoreEntry[]): Record<string, string[]> {
  try {
    const k = (JSON.parse(String(manifestEntry(lore)?.content ?? '')) as { keys?: unknown }).keys;
    return k && typeof k === 'object' ? (k as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/** 사용자가 고친 호출 키는 남긴다: 지금 키가 카드가 낸 키(지문)와 다르면 그 키를 새 항목에 옮긴다 */
function keepUserKeys(current: LoreEntry[], list: LoreEntry[], shipped: Record<string, string[]>): number {
  const ck = keyed(current, loreName);
  const cur = new Map(ck.map((k, i) => [k, current[i]]));
  const lk = keyed(list, loreName);
  let kept = 0;
  list.forEach((e, i) => {
    const prints = shipped[String(e.comment ?? '')];
    const old = cur.get(lk[i]);
    if (!prints || !old || old === e || keyPrint(old.key) === keyPrint(e.key) || prints.includes(keyPrint(old.key))) return;
    list[i] = { ...e, key: old.key, secondkey: old.secondkey ?? e.secondkey };
    kept++;
  });
  return kept;
}

/** 지금 캐릭터에 업데이트를 합친 결과 (저장은 하지 않음) */
export function planUpdate(char: Record<string, unknown>, payload: CardPayload): UpdatePlan {
  const current = renamed((char.globalLore as LoreEntry[]) ?? [], payload.data.globalLore);
  const lore = mergeByName(current, payload.data.globalLore, loreName, (e) => PROTECTED_LORE.includes(e.comment ?? ''));
  keepUserKeys(current, lore.list, shippedKeys(payload.data.globalLore));
  // 옛 데이터 로어북(Faction display 등)은 새 카드에 없어 「사용자가 넣은 것」으로 남는다. 명부로 옮기고 지운다
  if (lore.list.some((e) => LEGACY_DATA.includes(String(e.comment ?? '')))) lore.list = migrateLore(lore.list);
  // 0.16.37 전 카드: 명부 괴이·특수에 기본으로 있던 세력·요원 로어북 후보를 뺀다 (2026-10-21 사용자). 그 뒤에 사용자가 다시 넣은 것은 둔다
  if (compareVersions(cardVersion(char.globalLore as LoreEntry[]), '0.16.37') < 0) lore.list = dropOldOutsidePlaces(lore.list);
  // Risu 캐릭터의 정규식 칸 이름은 customscript (s 없음)
  // 상태창 정규식은 플러그인이 그리게 되어(v0.16.31) 옛 카드에서 뺀다 (새 카드에 같은 이름이 있으면 그대로)
  const incomingNames = new Set(payload.data.customscript.map((r) => r.comment ?? ''));
  const currentScripts = ((char.customscript as { comment?: string }[]) ?? []).filter((r) => !RETIRED_SCRIPTS.includes(r.comment ?? '') || incomingNames.has(r.comment ?? ''));
  const scripts = mergeByName(currentScripts, payload.data.customscript, (r) => r.comment ?? '');
  const next: Record<string, unknown> = { ...char, globalLore: lore.list, customscript: scripts.list };
  delete next.customscripts;
  const fields: string[] = [];
  for (const f of CARD_FIELDS) {
    if (!(f in payload.data)) continue;
    if (JSON.stringify(char[f]) !== JSON.stringify(payload.data[f])) fields.push(f);
    next[f] = payload.data[f];
  }
  return { next, lore: lore.count, scripts: scripts.count, fields };
}

/** 이 플러그인 버전 (빌드 때 package.json에서) */
export const PLUGIN_VERSION: string = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '0';
declare const __PLUGIN_VERSION__: string | undefined;
