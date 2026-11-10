// 자료 팩 (QC 개선 나1, docs/qc/09_개선_나_1.md): 세계 자료·설치 자료는 본체에 번들하지 않고 release 폴더의 팩
// (goei-data-world.json + goei-data-world.N.txt, goei-data-install.*) 으로 받는다. 빌드(scripts/build.mjs)가 팩마다 지문을 여기 박아 두어
// 본체는 자기와 맞는 자료만 쓴다 (판이 다르면 다시 받음). 받기·저장은 host/datapack.ts, 여기는 순수 계산(지문 비교·형식 검사·넣기).
import { setInstallData } from './install';
import { makeIconIndex, normIcon } from './iconmatch';
import { textHash } from './texthash';
import { setWorldData } from './world/records';

/** 빌드가 박아 둔 팩 지문: hash(UTF-16 FNV-1a) · sha256(UTF-8) · length(JS 글자 수). scripts/data-pack.mjs packOf 와 같은 모양 */
export interface PackExpect {
  hash: string;
  sha256: string;
  length: number;
}
export interface PackSpec {
  /** 파일 이름 줄기 (goei-data-world → goei-data-world.json · goei-data-world.N.txt) */
  name: string;
  /** 화면·오류 글에 쓰는 이름 */
  label: string;
  expect: PackExpect;
}

declare const __WORLD_PACK__: string | undefined;
declare const __INSTALL_PACK__: string | undefined;
declare const __ITEMS_PACK__: string | undefined;

export function expectOf(raw: unknown): PackExpect {
  try {
    const o = typeof raw === 'string' ? (JSON.parse(raw) as Partial<PackExpect>) : null;
    if (o && typeof o.hash === 'string' && typeof o.sha256 === 'string' && typeof o.length === 'number') return { hash: o.hash, sha256: o.sha256, length: o.length };
  } catch {
    // 아래 빈 지문
  }
  return { hash: '', sha256: '', length: 0 };
}

export const WORLD_PACK: PackSpec = { name: 'goei-data-world', label: '세계 자료', expect: expectOf(typeof __WORLD_PACK__ === 'string' ? __WORLD_PACK__ : undefined) };
export const INSTALL_PACK: PackSpec = { name: 'goei-data-install', label: '설치 자료', expect: expectOf(typeof __INSTALL_PACK__ === 'string' ? __INSTALL_PACK__ : undefined) };
/** 소지품 그림 팩 (2026-11-07): 매칭 표 + 85×85 png base64. 부팅 때가 아니라 소지품 메뉴를 열 때 받는다 (host/itemicons.ts) */
export const ITEMS_PACK: PackSpec = { name: 'goei-data-items', label: '소지품 그림', expect: expectOf(typeof __ITEMS_PACK__ === 'string' ? __ITEMS_PACK__ : undefined) };

/** 저장소에서 읽은 글이 이 본체의 팩인가: 길이와 FNV 지문(동기, 880KB 에 수 ms). 지문이 비어 있는 빌드는 어떤 글도 맞지 않는다(늘 다시 받음) */
export function packMatches(text: string, expect: PackExpect): boolean {
  return !!expect.hash && text.length === expect.length && textHash(text) === expect.hash;
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 세계 자료 팩 글을 풀어 records.ts 에 넣는다. 형식이 다르면 던진다 */
export function applyWorldPack(text: string): void {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('세계 자료 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'world') throw new Error('세계 자료 팩 형식이 달라요 (schema·kind).');
  for (const k of ['agent', 'org', 'anomaly', 'site', 'appendix']) if (!obj(j[k])) throw new Error(`세계 자료 팩 형식이 달라요 (${k}).`);
  const rel = j.relations;
  if (!obj(rel) || !obj(rel.pairs) || typeof rel.common !== 'string') throw new Error('세계 자료 팩 형식이 달라요 (relations).');
  setWorldData({
    agent: j.agent as never,
    org: j.org as never,
    anomaly: j.anomaly as never,
    site: j.site as never,
    appendix: j.appendix as never,
    relations: { pairs: rel.pairs as never, common: rel.common },
    // 첫 장면 기본값 (옛 팩에는 없다)
    ...(obj(j.scenes) && obj(j.scenes.세력) && obj(j.scenes.인물) ? { scenes: j.scenes as never } : {}),
  });
}

/** 설치 자료 팩 글을 풀어 install.ts 에 넣는다. 형식이 다르면 던진다 */
export function applyInstallPack(text: string): void {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('설치 자료 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'install') throw new Error('설치 자료 팩 형식이 달라요 (schema·kind).');
  const g = j.greetings;
  if (!obj(g) || !obj(g.index) || !Array.isArray(g.texts) || typeof g.first !== 'string') throw new Error('설치 자료 팩 형식이 달라요 (greetings).');
  if (!Array.isArray(j.pictures)) throw new Error('설치 자료 팩 형식이 달라요 (pictures).');
  if (!obj(j.directory)) throw new Error('설치 자료 팩 형식이 달라요 (directory).');
  if (!obj(j.icon)) throw new Error('설치 자료 팩 형식이 달라요 (icon).');
  setInstallData({ greetings: { index: g.index as never, texts: g.texts.map(String), first: g.first }, pictures: j.pictures as never, directory: j.directory, icon: j.icon as never });
}

// ── 소지품 그림 팩 (scripts/data-pack.mjs itemsPackText 와 같은 모양, 매칭은 game-src/items/match_icon.mjs 와 같은 규칙 — 시험이 둘을 맞대 봄) ──
// ① 모델이 쓴 「그림 찾기 낱말」(영어 icon) ② 물건 이름 — 둘 다 글자 조각 점수로 표의 줄과 견준다.
//   조각 = 한글은 띄어쓰기를 지운 뒤 한 글자·두 글자, 영어·숫자는 낱말. 조각마다 무게 = 표에 드문 조각일수록 큼(IDF).
//   점수 = 겹친 무게 / (겹친 무게 + A×물건 쪽 남는 무게 + B×줄 쪽 남는 무게) — 줄의 키워드·몸통 말 중 가장 높은 것.
//   이름에는 한국어 몸통이 끝에 온다는 것을 씀: 끝 말이 같으면 덤, 마지막 글자가 줄에 없으면 깎음.
//   짧은 낱말이 긴 이름 안에 끼어 먼저 잡히던 것(확성기 → 「성기」, 봉지라면 → 「지라」)은 나머지 조각이 안 맞아 점수가 낮다.
// ③ 가장 높은 점수가 낮으면(흔한 조각 「키트·상자」만 맞음 등) 공통 그림.

export interface ItemIconRow { k: string[]; h: string[]; ft: string[]; f: string; kind: string; base?: boolean }
export interface ItemIconPack {
  table: ItemIconRow[];
  /** 몸통 말(정규화) → 대표 그림 파일 */
  rep: Record<string, string>;
  icons: Record<string, string>;
  /** 종류 → 기본 그림 (공통 그림은 base.misc) */
  base: Record<string, string>;
  /** 이름·그림 찾기 낱말 → 그림 파일, 점수가 낮으면 null */
  find: (name: string, icon?: string) => string | null;
  /** find 와 같되 점수까지 (몸통 말이 맞으면 1, 글자 조각으로 찾았으면 1 미만) */
  hit: (name: string, icon?: string) => { file: string; score: number } | null;
}

export { clearIconMisses, ICON_ALIAS_DEFAULT, ICON_KIND_LABEL, ICON_KINDS_TEXT, normIcon, parseIconAliases, readIconMisses, setIconAliases, splitIconWord } from './iconmatch';

/** 표 → 찾기 함수 (core/iconmatch.ts = game-src/items/match_icon.mjs) */
function makeIconFind(table: ItemIconRow[], rep: Record<string, string>, base: Record<string, string>) {
  return makeIconIndex(table.map((r) => ({ file: r.f, keywords: r.k, phrases: [...r.k, ...r.h], kind: r.kind })), rep, { base });
}

/** 소지품 그림 팩 글을 푼다. 형식이 다르면 던진다 */
export function applyItemsPack(text: string): ItemIconPack {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('소지품 그림 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'items' || !Array.isArray(j.table) || !obj(j.icons)) throw new Error('소지품 그림 팩 형식이 달라요.');
  const icons = j.icons as Record<string, string>;
  const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
  const table = (j.table as unknown[])
    .filter((r): r is ItemIconRow => obj(r) && typeof r.f === 'string' && typeof r.kind === 'string' && typeof icons[r.f] === 'string')
    .map((r) => ({ k: strs(r.k), h: strs(r.h), ft: strs(r.ft), f: r.f, kind: r.kind, ...(r.base ? { base: true } : {}) }));
  const rep: Record<string, string> = {};
  if (obj(j.rep)) for (const [k, f] of Object.entries(j.rep)) if (typeof f === 'string' && typeof icons[f] === 'string') rep[normIcon(k)] = f;
  const base: Record<string, string> = {};
  for (const r of table) if (r.base) base[r.kind] = r.f;
  const hit = makeIconFind(table, rep, base);
  return { table, rep, icons, base, hit, find: (name, icon) => hit(name, icon)?.file ?? null };
}

/** 이름(+모델이 쓴 그림 찾기 낱말) → 그림 파일 (표시 전용). 맞는 게 없으면 공통 그림(base.misc), 그것도 없으면 null */
export function matchItemIcon(pack: ItemIconPack, itemName: string, icon?: string): string | null {
  return pack.find(itemName, icon) ?? pack.base.misc ?? null;
}

interface PicWords { heads: Set<string>; mods: Set<string> }
const packWords = new WeakMap<ItemIconPack, Map<string, PicWords>>();
/** 그림 파일 → 그 그림을 가리키는 말들의 끝 낱말(몸통)·앞 낱말(꾸밈) */
function wordsOf(pack: ItemIconPack): Map<string, PicWords> {
  let m = packWords.get(pack);
  if (!m) {
    m = new Map();
    // 같은 그림의 줄이 여럿이라 꾸밈 낱말은 그림마다 모은다
    const fts = new Map<string, Set<string>>();
    for (const r of pack.table) {
      if (!fts.has(r.f)) fts.set(r.f, new Set());
      for (const t of r.ft) fts.get(r.f)!.add(normIcon(t));
    }
    for (const r of pack.table) {
      let x = m.get(r.f);
      if (!x) m.set(r.f, (x = { heads: new Set(), mods: new Set() }));
      const ft = fts.get(r.f)!;
      for (const t of [...r.k, ...r.h]) {
        // 괄호 속 꾸밈(「성경책(낡은)」)은 물건 말이 아니다
        const ws = normIcon(t.replace(/\([^)]*\)/g, ' ')).split(' ').filter(Boolean);
        // 표의 꾸밈 낱말(ft: 낡은·old)은 끝에 와도 몸통이 아니다 (「성경책 낡은」)
        ws.forEach((w, i) => (i === ws.length - 1 && !ft.has(w) ? x!.heads : x!.mods).add(w));
      }
    }
    packWords.set(pack, m);
  }
  return m;
}

/** 글 제목(매물 제목처럼 물건 이름 앞뒤에 다른 말이 붙는 글) → 그림 파일. 못 찾으면 null (2026-11-10 사용자: 방검복·라디오조차 안 맞았다).
 *  물건 이름만 오는 소지품과 달리 제목은 「구형 방검복 상하의 세트」「진공관 라디오 (작동 확인)」처럼 끝 말이 물건이 아닐 때가 많다.
 *  ① 제목 전체로 찾은 그림이 끝 낱말을 낱말째로 받치면 그것 (「회중시계 고장」 → 부고장 처럼 글자 꼬리만 겹친 것은 아님)
 *  ② 아니면 앞에서부터 낱말을 늘려 가며 처음으로 그렇게 받쳐지는 그림
 *  ③ 그래도 없으면 제목 전체로 찾은 그림 */
export function matchTitleIcon(pack: ItemIconPack, title: string): string | null {
  const words = normIcon(title).split(' ').filter(Boolean);
  if (!words.length) return null;
  const table = wordsOf(pack);
  // 끝 낱말이 그 그림의 몸통 말과 같거나 한쪽이 다른 쪽의 앞머리 (방독면 = 방독면), 또는 앞 낱말과 앞머리만 겹침 (방검복 ↔ 방검 조끼).
  // 앞 낱말과 똑같기만 한 것은 꾸밈말이라 아님 (낡은 ↔ 낡은 성경)
  const pre = (a: string, b: string) => (a.length >= 2 && b.startsWith(a)) || (b.length >= 2 && a.startsWith(b));
  const backed = (file: string, last: string) => {
    const x = table.get(file);
    if (!x) return false;
    for (const w of x.heads) if (w === last || pre(w, last)) return true;
    for (const w of x.mods) if (w !== last && pre(w, last)) return true;
    return false;
  };
  const at = (n: number) => {
    const h = pack.hit(words.slice(0, n).join(' '));
    return h && h.score >= 1 && backed(h.file, words[n - 1]) ? h.file : null;
  };
  const whole = pack.hit(words.join(' '));
  const first = at(words.length);
  if (first) return first;
  for (let n = 1; n < words.length; n++) {
    const f = at(n);
    if (f) return f;
  }
  return whole?.file ?? null;
}
