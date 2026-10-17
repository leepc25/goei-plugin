// 카드 업데이트 (선택지용사 방식): 저장소에 올린 카드 데이터(card-update.json)를 받아 지금 카드에 덮어쓴다.
// 채팅·사진·에셋·이름은 그대로 두고, 로어북·정규식은 같은 이름끼리만 바꾸며, 사용자가 고친 「괴이봇 명부」는 지킨다.
// 플러그인 자체는 Risu 설정의 플러그인 탭이 //@update-url로 갱신한다.
import { MANIFEST_COMMENT } from './start';
import { DIRECTORY_COMMENT } from './world/directory';
import type { LoreEntry } from './types';

export const UPDATE_SCHEMA = 1;

/** 저장소의 release 폴더 raw 주소 (비어 있으면 업데이트 확인을 못 함). 빌드 때 package.json의 goei.updateBase로 채운다 */
export const UPDATE_BASE: string = typeof __UPDATE_BASE__ === 'string' ? __UPDATE_BASE__ : '';
declare const __UPDATE_BASE__: string | undefined;

/** 카드에서 바꾸는 칸 (Risu 캐릭터 객체 이름) */
export const CARD_FIELDS = [
  'firstMessage', 'alternateGreetings', 'creatorNotes', 'desc', 'personality', 'scenario', 'exampleMessage',
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
export const PROTECTED_LORE = [DIRECTORY_COMMENT];

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
  const entry = (lore ?? []).find((e) => e.comment === MANIFEST_COMMENT);
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

const loreName = (e: LoreEntry) => `${e.comment ?? ''}\u0001${(e as { folder?: string }).folder ?? ''}`;

export interface UpdatePlan {
  next: Record<string, unknown>;
  lore: MergeCount;
  scripts: MergeCount;
  /** 바뀌는 카드 칸 이름 */
  fields: string[];
}

/** 지금 캐릭터에 업데이트를 합친 결과 (저장은 하지 않음) */
export function planUpdate(char: Record<string, unknown>, payload: CardPayload): UpdatePlan {
  const lore = mergeByName((char.globalLore as LoreEntry[]) ?? [], payload.data.globalLore, loreName, (e) => PROTECTED_LORE.includes(e.comment ?? ''));
  // Risu 캐릭터의 정규식 칸 이름은 customscript (s 없음)
  const scripts = mergeByName((char.customscript as { comment?: string }[]) ?? [], payload.data.customscript, (r) => r.comment ?? '');
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
