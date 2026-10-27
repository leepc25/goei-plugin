// 가상 로어북: 플러그인 세계 데이터(기본 + 카드 덧쓰기)를 지금 로어북 파이프라인(명부·로어 고르기·위키)이 읽을 수 있는
// LoreEntry 로 만들어 카드 로어북 뒤에 붙인다. 카드에 같은 이름의 진짜 로어북이 그 폴더에 있으면 카드가 이긴다 (사용자 2026-10-27).
// 가상 항목은 goeiVirtual 표식이 있고, 저장할 때는 반드시 뺀다 (stripVirtual).
import type { LoreEntry } from '../types';
import { readDirectory, readDirectoryData, type Directory } from './directory';
import { assembleAgent, assembleAnomaly, assembleAppendix, assembleOrg, assembleSite } from './assemble';
import { assembleFaction, assembleRoster } from './faction';
import { setActiveWorld, worldRecords, worldRelations, type WorldOverrides, type WorldRecord, worldAnomalyNote, excludedOrgs, filterRelations } from './records';
import type { WorldKind } from './schema';
import { guidePrompt } from '../guides';
import { FACTION_BOOK, TAG_BOOK } from '../factions';

export const ROSTER_BOOK = '🙂Roster';
/** 상시 지침 가상 항목: 카드에 같은 이름의 진짜 항목이 없을 때만 (Risu 순서 100·101·102) */
export const ALWAYS_BOOKS: { name: string; order: number; kind: 'tag' | 'faction' | 'roster' }[] = [
  { name: TAG_BOOK, order: 100, kind: 'tag' },
  { name: FACTION_BOOK, order: 101, kind: 'faction' },
  { name: ROSTER_BOOK, order: 102, kind: 'roster' },
];
const WORLD_FOLDER_KEY = '\uf000folder:goei-world-0000-0000-0000-world0000001';

export const VIRTUAL = 'goeiVirtual';
export const isVirtual = (e: LoreEntry) => (e as Record<string, unknown>)[VIRTUAL] === true;
export const stripVirtual = (lore: LoreEntry[]): LoreEntry[] => lore.filter((e) => !isVirtual(e));

/** 가상 폴더 열쇠 (카드 빌드의 폴더 열쇠와 겹치지 않게 고정) */
export const VIRTUAL_FOLDER_KEY: Record<WorldKind, string> = {
  org: 'folder:goei-world-0000-0000-0000-org00000001',
  agent: 'folder:goei-world-0000-0000-0000-agent0000001',
  anomaly: 'folder:goei-world-0000-0000-0000-anomaly00001',
  site: 'folder:goei-world-0000-0000-0000-site00000001',
  appendix: 'folder:goei-world-0000-0000-0000-appendix0001',
};
const FOLDER_NAME: Record<WorldKind, string> = { org: '🌆세력', agent: '🙂요원', anomaly: '🚧괴이', site: '🎁파밍', appendix: '📎부록' };
const FOLDER_WORD: Record<WorldKind, string> = { org: '세력', agent: '요원', anomaly: '괴이', site: '파밍', appendix: '부록' };
const ORDER: Record<WorldKind, number> = { org: 200, agent: 600, anomaly: 500, site: 400, appendix: 0 };

const folderWord = (name: string) => name.replace(/[^\p{L}\p{N}]/gu, '');
const s = (v: unknown) => (typeof v === 'string' ? v : '');

/** 카드 명부에 저장된 덧쓰기 (DirectoryData.세계) */
export function worldOverrides(lore: LoreEntry[] | undefined): WorldOverrides | undefined {
  const d = readDirectoryData(lore ?? []) as unknown as { 세계?: WorldOverrides } | null;
  return d?.세계 && typeof d.세계 === 'object' ? d.세계 : undefined;
}

function folderKey(lore: LoreEntry[], kind: WorldKind): { key: string; make: LoreEntry | null } {
  const words = kind === 'org' ? ['세력', '조직'] : [FOLDER_WORD[kind]];
  const f = lore.find((e) => e.mode === 'folder' && typeof e.key === 'string' && words.includes(folderWord(s(e.comment))));
  if (f) return { key: f.key as string, make: null };
  return {
    key: VIRTUAL_FOLDER_KEY[kind],
    make: { key: VIRTUAL_FOLDER_KEY[kind], comment: FOLDER_NAME[kind], content: '', mode: 'folder', insertorder: 100, alwaysActive: false, secondkey: '', selective: false, bookVersion: 2, [VIRTUAL]: true },
  };
}

const keysOf = (rec: WorldRecord, fallback: string[]) => (rec.keys?.trim() ? rec.keys.trim() : [...new Set(fallback.filter(Boolean))].join(', '));

function entry(kind: WorldKind, name: string, key: string, content: string, folder: string, order: number): LoreEntry {
  return {
    key, secondkey: '', comment: name, content: `@@dont_activate\n${content}\n\n---`, mode: 'normal', insertorder: order,
    alwaysActive: false, selective: false, useRegex: false, bookVersion: 2, folder, [VIRTUAL]: true, goeiKind: kind,
  };
}

/**
 * 카드 로어북 + 가상 로어북. 폴더에 같은 이름의 진짜 항목이 있으면 가상 항목을 만들지 않는다.
 * 1차(명부 읽기)는 카드 로어북만으로 하고, 가상 항목을 더한 뒤 명부를 다시 읽으면 새 요원·괴이가 폴더 항목으로 들어온다.
 */
export function withWorldLore(lore: LoreEntry[] | undefined): LoreEntry[] {
  const base = stripVirtual(lore ?? []);
  const hit = cache.get(base);
  if (hit) return hit;
  const overrides = worldOverrides(base);
  const dir0 = readDirectory(base);
  const out = [...base];
  const existing = new Set(base.filter((e) => e.mode !== 'folder').map((e) => s(e.comment)));
  // 1) 가상 항목이 폴더에 있어야 명부가 요원·괴이·파밍으로 알아보므로, 먼저 빈 본문의 항목을 만들어 명부를 다시 읽는다
  const names: Record<WorldKind, string[]> = { org: [], agent: [], anomaly: [], site: [], appendix: [] };
  const recs: Record<WorldKind, Map<string, WorldRecord>> = {
    org: worldRecords('org', overrides), agent: worldRecords('agent', overrides), anomaly: worldRecords('anomaly', overrides),
    site: worldRecords('site', overrides), appendix: worldRecords('appendix', overrides),
  };
  const folders: Record<WorldKind, string> = { org: '', agent: '', anomaly: '', site: '', appendix: '' };
  for (const kind of ['org', 'site', 'anomaly', 'agent', 'appendix'] as WorldKind[]) {
    const { key, make } = folderKey(base, kind);
    folders[kind] = key;
    const fresh = [...recs[kind].keys()].filter((n) => !existing.has(n) && !(kind === 'org' && recs.org.get(n)?.summaryOnly));
    if (!fresh.length) continue;
    if (make) out.push(make);
    for (const n of fresh) {
      names[kind].push(n);
      // 원문 검색 키를 먼저 넣어야 명부가 영문명(첫 영문 키)을 짐작한다. 조립 뒤에 비면 이름·영문명·별칭으로 채운다
      out.push(entry(kind, n, recs[kind].get(n)!.keys?.trim() ?? '', '', key, ORDER[kind]));
    }
  }
  // 2) 명부(가상 항목 포함)로 본문을 조립해 채운다
  const dir: Directory = readDirectory(out);
  const faction = undefined; // CBS 분기는 글에 남겨 두고(호칭 표 CBS) 요청 때 플러그인이 푼다
  for (const e of out) {
    if (!isVirtual(e) || e.mode === 'folder') continue;
    const kind = (e as { goeiKind?: WorldKind }).goeiKind!;
    const name = s(e.comment);
    const rec = recs[kind]?.get(name);
    if (!rec) continue;
    let content = '';
    let keys = '';
    if (kind === 'agent') {
      const a = dir.agents.find((x) => x.lore === name);
      if (!a) continue;
      content = assembleAgent(rec, a, dir, faction);
      keys = keysOf(rec, [a.english, a.name, ...a.aliases]);
    } else if (kind === 'anomaly' || kind === 'site') {
      const p = (kind === 'anomaly' ? dir.anomalies : dir.sites).find((x) => x.lore === name);
      if (!p) continue;
      content = kind === 'anomaly' ? assembleAnomaly(rec, p, faction) : assembleSite(rec, p, faction);
      keys = keysOf(rec, [p.english, p.label, p.lore, ...p.aliases]);
    } else if (kind === 'org') {
      const o = dir.orgs.find((x) => x.name === name);
      if (!o) continue;
      content = assembleOrg(rec, o, dir, faction);
      keys = keysOf(rec, [o.spec.english ?? '', o.name]);
    } else {
      const r = dir.appendices.find((x) => x.lore === name);
      if (!r) continue;
      content = assembleAppendix(rec, r, faction);
      keys = rec.keys ?? '';
    }
    e.key = keys;
    e.content = `@@dont_activate\n${content}\n\n---`;
  }
  // 인물 기록의 세력 시작값 등이 읽는 「지금 세계」: 관계 격자와 코드→조직 이름
  setActiveWorld(filterRelations(worldRelations(overrides), excludedOrgs(recs.org)), Object.fromEntries(dir.orgs.flatMap((o) => (o.faction ? [[o.faction, o.name]] : []))), worldAnomalyNote(overrides));
  // 상시 지침(🏷️Tag·📜Faction·🙂Roster): 카드에 없으면 가상으로. 요청에는 플러그인이 직접 끼운다 (core/lore.ts insertLoreBlock)
  const missingAlways = ALWAYS_BOOKS.filter((b) => !existing.has(b.name));
  if (missingAlways.length) {
    const wf = base.find((e) => e.mode === 'folder' && typeof e.key === 'string' && folderWord(s(e.comment)) === '세계');
    const wkey = (wf?.key as string | undefined) ?? WORLD_FOLDER_KEY;
    if (!wf) out.push({ key: WORLD_FOLDER_KEY, comment: '🌐세계', content: '', mode: 'folder', insertorder: 100, alwaysActive: false, secondkey: '', selective: false, bookVersion: 2, [VIRTUAL]: true });
    const rel = filterRelations(worldRelations(overrides), excludedOrgs(recs.org));
    for (const b of missingAlways) {
      const content = b.kind === 'tag' ? guidePrompt('Tag') : b.kind === 'faction' ? assembleFaction(dir, recs.org, rel) : assembleRoster(dir, recs.agent, recs.org);
      out.push({ key: '', secondkey: '', comment: b.name, content, mode: 'normal', insertorder: b.order, alwaysActive: true, selective: false, useRegex: false, bookVersion: 2, folder: wkey, [VIRTUAL]: true, goeiKind: b.kind });
    }
  }
  // 조립하지 못한 가상 항목(명부에 안 들어온 이름)은 뺀다
  const result = out.filter((e) => !isVirtual(e) || e.mode === 'folder' || s(e.content) !== '@@dont_activate\n\n\n---');
  cache.set(base, result);
  return result;
}

const cache = new WeakMap<LoreEntry[], LoreEntry[]>();

/** 가상 항목이 하나라도 들어 있는지 */
export const hasVirtual = (lore: LoreEntry[] | undefined): boolean => (lore ?? []).some(isVirtual);
