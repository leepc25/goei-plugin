// 에셋 사진 보내기 (2026-11-08 사용자: 반응 그림 대신 인물이 실제 사진을 보낸다).
// 모델은 게시판 글·댓글·쪽지·괴담톡 말에 [사진:이름] 또는 [사진:이름_표정]을 쓰고, 앱이 에셋 그림으로 바꿔 보여 준다.
// 목록은 명부(인물·괴이·특수)에서 그림이 있는 것만 자동으로 만든다. 보낼 곳·때는 모델이 정한다 (제한 없음).
import { readDirectory, type AgentRow, type PlaceRow } from './world/directory';
import { EMOTIONS } from './imgtag';
import type { LoreEntry } from './types';

type Char = { globalLore?: LoreEntry[] } & Record<string, unknown>;

/** 에셋이 있는지 (host/assets 가 채운다. 못 채운 곳에서는 명부에 있는 이름을 다 믿는다) */
let has: (char: Char, name: string) => boolean = () => true;
export function setAssetCheck(fn: (char: never, name: string) => boolean): void {
  has = fn as (char: Char, name: string) => boolean;
}

/** [사진:이름] · [사진:이름_표정] */
export const SITE_PIC_RE = /\[사진:([^\]\n]{1,80})\]/g;

interface Pic {
  name: string;
  /** 그림 이름 (표정이 붙을 수 있으면 영문명) */
  base: string;
  person: boolean;
  terms: string[];
}

function personPic(char: Char, a: AgentRow): Pic | null {
  const en = a.english;
  if (en && has(char, `${en}_default`)) return { name: a.name, base: en, person: true, terms: [a.name, en, ...a.aliases] };
  const one = (a as { photo?: string }).photo || (en && has(char, en) ? en : '');
  return one && has(char, one) ? { name: a.name, base: one, person: false, terms: [a.name, en, ...a.aliases] } : null;
}

function placePic(char: Char, p: PlaceRow): Pic | null {
  const en = p.english;
  const one = p.photo || (en && has(char, `${en}_default`) ? `${en}_default` : en && has(char, en) ? en : '');
  return one && has(char, one) ? { name: p.label, base: one, person: false, terms: [p.label, en, ...p.aliases] } : null;
}

let cache: { lore: unknown; list: Pic[] } | null = null;
function pics(char: Char): Pic[] {
  if (cache && cache.lore === char.globalLore) return cache.list;
  const dir = readDirectory(char.globalLore);
  const list = [
    ...dir.agents.map((a) => personPic(char, a)),
    ...dir.anomalies.map((p) => placePic(char, p)),
    ...dir.sites.map((p) => placePic(char, p)),
  ].filter((x): x is Pic => !!x && !!x.name);
  const seen = new Set<string>();
  const out = list.filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true)));
  cache = { lore: char.globalLore, list: out };
  return out;
}

/** 모델에게 줄 목록 (지침의 __SITE_PICS__ 자리) */
export function sitePicList(char: Char): string {
  const list = pics(char);
  const people = list.filter((p) => p.person).map((p) => p.name);
  const things = list.filter((p) => !p.person).map((p) => p.name);
  if (!people.length && !things.length) return 'Available pictures: none.';
  return [
    people.length ? `People (may add _expression): ${people.join(', ')}` : '',
    people.length ? `Expressions: ${[...EMOTIONS].join(', ')}` : '',
    things.length ? `Anomalies, people and places (no expression): ${things.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

/** [사진:…] 안의 글 → 에셋 이름. 목록에 없으면 null (그때는 사진 설명 틀로 보여 준다) */
export function resolveSitePic(char: Char, raw: string): string | null {
  const text = raw.trim();
  const cut = text.lastIndexOf('_');
  const expr = cut > 0 ? text.slice(cut + 1).trim().toLowerCase() : '';
  const name = cut > 0 && EMOTIONS.has(expr) ? text.slice(0, cut).trim() : text;
  const low = name.toLowerCase();
  const p = pics(char).find((x) => x.terms.some((t) => t && t.toLowerCase() === low));
  if (!p) return null;
  if (!p.person) return p.base;
  const want = `${p.base}_${EMOTIONS.has(expr) ? expr : 'default'}`;
  return has(char, want) ? want : `${p.base}_default`;
}

/** 지침의 __SITE_PICS__ 채우기 */
export const fillSitePics = (text: string, char: Char): string => (text.includes('__SITE_PICS__') ? text.replace(/__SITE_PICS__/g, sitePicList(char)) : text);
