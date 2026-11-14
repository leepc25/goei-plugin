// 에셋 사진 보내기 (2026-11-08 사용자: 반응 그림 대신 인물이 실제 사진을 보낸다).
// 모델은 게시판 글·댓글·쪽지·괴담톡 말에 [사진:이름] 또는 [사진:이름_표정]을 쓰고, 앱이 에셋 그림으로 바꿔 보여 준다.
// 목록은 명부(인물·괴이·특수)에서 그림이 있는 것만 자동으로 만든다. 보낼 곳·때는 모델이 정한다 (제한 없음).
import { readDirectory, type AgentRow, type PlaceRow } from './world/directory';
import { EMOTIONS } from './imgtag';
import { fillVars } from './guides';
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

/** 모델에게 줄 목록 (지침의 __SITE_PICS__ 자리).
 *  sec: 지침 절 읽기 (PICS_NONE · PICS_PEOPLE · PICS_EXPR · PICS_THINGS, {list} 자리). 절이 없으면 코드에 남긴 옛 글 (전수검사 11-13)
 *  within: 이번 요청의 최근 본문·게시판/쪽지 내용 (늘 붙는 인물 명부 같은 참고 기록은 넣지 않는다: 모든 이름이 걸린다). 주면 거기에 이름(한글·영문·별칭)이 나온 것만 넣는다 (사용자 2026-11-14: 요청마다 전체 목록이 붙지 않게) */
export function sitePicList(char: Char, sec?: (name: string) => string | null | undefined, within?: string): string {
  const low = within?.toLowerCase();
  const list = low === undefined ? pics(char) : pics(char).filter((p) => p.terms.some((t) => !!t && t.trim().length >= 2 && low.includes(t.trim().toLowerCase())));
  const people = list.filter((p) => p.person).map((p) => p.name);
  const things = list.filter((p) => !p.person).map((p) => p.name);
  const line = (name: string, old: string, items?: string[]): string => {
    const t = sec?.(name)?.trim() || old;
    return items ? fillVars(t, { list: items.join(', ') }) : t;
  };
  if (!people.length && !things.length) return line('PICS_NONE', 'Available pictures: none.');
  return [
    people.length ? line('PICS_PEOPLE', 'People (may add _expression): {list}', people) : '',
    people.length ? line('PICS_EXPR', 'Expressions: {list}', [...EMOTIONS]) : '',
    things.length ? line('PICS_THINGS', 'Anomalies, people and places (no expression): {list}', things) : '',
  ].filter(Boolean).join('\n');
}

/** 표정 (긴 것부터: angry smile 이 smile 보다 먼저) */
const EMO_LONGEST = [...EMOTIONS].sort((a, b) => b.length - a.length);

/** [사진:…] 안의 글 → 에셋 이름. 목록에 없으면 null (그때는 사진 설명 틀로 보여 준다) */
export function resolveSitePic(char: Char, raw: string): string | null {
  const text = raw.trim();
  // 끝이 맞는 가장 긴 표정을 고른다: 띄어쓰기 표정(forced smiling)을 밑줄로 써도 받는다 (전수검사 11-13)
  const low0 = text.toLowerCase();
  let at = -1;
  const hit = EMO_LONGEST.find((e) => (at = low0.search(new RegExp(`_\\s*${e.replace(/ /g, '[ _]')}$`))) > 0);
  const expr = hit ?? '';
  const name = hit ? text.slice(0, at).trim() : text;
  const low = name.toLowerCase();
  const p = pics(char).find((x) => x.terms.some((t) => t && t.toLowerCase() === low));
  if (!p) return null;
  if (!p.person) return p.base;
  const want = `${p.base}_${EMOTIONS.has(expr) ? expr : 'default'}`;
  return has(char, want) ? want : `${p.base}_default`;
}

/** 지침의 __SITE_PICS__ 채우기 */
export const fillSitePics = (text: string, char: Char): string => (text.includes('__SITE_PICS__') ? text.replace(/__SITE_PICS__/g, sitePicList(char)) : text);
