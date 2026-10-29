// 상황판 목록: 괴이·미스틱 사이트·요원은 카드 명부(directory.ts: 로어북 폴더 + 괴이봇 명부 + 옛 목록),
// 거점과 세력 호칭도 카드 명부(옛 카드는 World catalog 랜드마크 줄·Faction display).
import { extraNames, factionList, factionVars } from '../factions';
import type { FactionCode, LoreEntry, ScriptState } from '../types';
import { SIGUN } from './geo';
import { displaySection, readDirectory, type BaseRow } from './directory';

export interface WorldItem {
  name: string;
  english: string;
  aliases: string[];
}

export interface Landmark extends WorldItem {
  /** 지도 표시명 */
  label: string;
  /** 연결 조직 (명부 조직 이름, 없으면 '') */
  org: string;
  sido: string;
  gu: string;
  x: number;
  y: number;
}

export interface Person {
  id: string;
  name: string;
  english: string;
  affiliation: string;
  rank: string;
  department: string;
  rosterFor: FactionCode[];
}

export interface Catalog {
  anomalies: WorldItem[];
  mysticSites: WorldItem[];
  landmarks: Landmark[];
  people: Person[];
  /** 사망 후 몇 번의 응답이 지나면 결번 처리하고 예비 인원을 올릴지 */
  refill: number;
  /** 관점 소속 → (소속 코드 → 표시명) */
  factionDisplay: Record<string, Record<string, string>>;
  /** 명부에서 만든 새 세력 코드 → 이름 */
  extraNames?: Record<string, string>;
  /** [AC]로 바꿀 수 있는 소속 코드 전체 → 소속 이름($ib_affiliation) */
  affiliations?: Record<string, string>;
  /** 태그·세력 로어북 자리표시자 변수 (factions.ts factionVars) */
  factionVars?: ScriptState;
}

export class CatalogError extends Error {}

const FALLBACK_DISPLAY: Record<string, string> = {
  A00: '관리국',
  B00: '가짜 관리국',
  C00: '백일몽',
  D00: '민간인',
  E00: '프리랜서',
};

function loreText(lore: LoreEntry[], comment: string): string | null {
  const parts = lore.filter((e) => e.comment === comment && typeof e.content === 'string' && e.content.trim());
  return parts.length ? parts.map((e) => e.content as string).join('\n') : null;
}

function parseJson(raw: string, book: string): unknown {
  const clean = raw
    .replace(/^﻿/, '')
    .trim()
    .replace(/^```[\w-]*\s*\n/, '')
    .replace(/\n\s*```\s*$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    throw new CatalogError(`${book}: JSON 구문을 확인하세요.`);
  }
}

/** 지도에 그릴 거점 (보이기 켠 것, 지역이 맞는 것만) */
export function landmarksOf(bases: BaseRow[]): Landmark[] {
  return bases
    .filter((b) => b.show && b.name && SIGUN[b.sido] && (!b.gu || SIGUN[b.sido].includes(b.gu)))
    .map((b) => ({ name: b.name, english: b.english, aliases: b.aliases, label: b.label, org: b.org, sido: b.sido, gu: b.gu, x: b.x, y: b.y }));
}

export function parseCatalog(lore: LoreEntry[] | undefined): Catalog {
  const list = lore ?? [];
  const dir = readDirectory(list);
  if (!dir.folders) {
    const worldRaw = loreText(list, 'World catalog');
    if (!worldRaw) throw new CatalogError('World catalog 로어북이 없어요.');
    parseJson(worldRaw, 'World catalog');
  }
  const place = (p: { label: string; english: string; aliases: string[] }): WorldItem => ({ name: p.label, english: p.english, aliases: p.aliases });
  const anomalies = dir.anomalies.filter((p) => p.preset).map(place).filter((e) => e.name);
  const mysticSites = dir.sites.filter((p) => p.preset).map(place).filter((e) => e.name);
  const landmarks = landmarksOf(dir.bases);

  if (!dir.folders) {
    const rosterRaw = loreText(list, 'Agent roster');
    if (!rosterRaw) throw new CatalogError('Agent roster 로어북이 없어요.');
    const roster = parseJson(rosterRaw, 'Agent roster') as { version?: number; characters?: unknown[] };
    if (roster.version !== 2 || !Array.isArray(roster.characters)) {
      throw new CatalogError('Agent roster: version 2 인물 명부가 필요합니다.');
    }
  }
  const people: Person[] = dir.agents
    .map((a) => ({
      id: a.id,
      name: a.name,
      english: a.english,
      affiliation: a.affiliation,
      rank: a.rank,
      department: a.department,
      rosterFor: a.rosterFor as FactionCode[],
    }))
    .filter((p) => /^P\d{3,}$/.test(p.id) && p.name);
  const refill = dir.refill;

  const factionDisplay = displaySection(list);
  const affiliations: Record<string, string> = {};
  for (const f of factionList(list)) affiliations[f.code] = f.affiliation;
  return { anomalies, mysticSites, landmarks, people, refill, factionDisplay, extraNames: extraNames(list), affiliations, factionVars: factionVars(list) };
}

/** 내 소속에서 본 세력 표시명 (B00에서는 관리국/가짜 관리국이 뒤바뀜) */
export function factionNames(catalog: Catalog, viewer: string | undefined): Record<string, string> {
  const map = catalog.factionDisplay[viewer ?? ''] ?? catalog.factionDisplay.none;
  if (map && typeof map === 'object') return catalog.extraNames ? { ...catalog.extraNames, ...map } : map;
  const m = { ...catalog.extraNames, ...FALLBACK_DISPLAY };
  if (viewer === 'B00') {
    m.A00 = '가짜 관리국';
    m.B00 = '관리국';
  }
  return m;
}

/** 프리셋 괴이 이름에 맞는 정식 이름 (긴 이름 우선) */
export function presetCanon(catalog: Catalog, name: string | undefined): string | null {
  if (!name?.trim()) return null;
  let best: string | null = null;
  for (const a of catalog.anomalies) {
    if ((name === a.name || name.includes(a.name)) && (!best || a.name.length > best.length)) best = a.name;
  }
  return best;
}
