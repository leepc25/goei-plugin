// 보조 모델 이미지(에셋) 태그 보충. 원본 imgTagFireCore와 같은 흐름:
// 단락 번호 매김 → Image tag 로어북의 캐릭터 → 등장 캐릭터만 → 보조 모델 JSON 패치 → 단락 뒤에 <img=...> 삽입.
import type { LoreEntry } from './types';
import { termPresent } from './world/registry';

export class AssetError extends Error {}

export const IMAGE_BOOK = 'Image tag';
/** 최근 보조 모델 보충 결과 한 줄 (설정 탭에 보임) */
export const ASSET_NOTE = '$goei_asset_note';

export interface ImageData {
  characters: string[];
  keywords: string[];
  keywordSet: Set<string>;
  /** 소문자 이름·별칭 → 영문명 (둘 이상을 가리키면 false) */
  aliases: Map<string, string | false>;
}

const fail = (field: string, why: string) => new AssetError(`${IMAGE_BOOK} 이미지 자료 오류 (${field}): ${why}`);

/** Image tag 로어북 (원본 WG.auxImageData). 같은 이름이 여럿이면 이어 붙이지 않고 마지막 것 */
export function readImageData(lore: LoreEntry[]): ImageData {
  const books = lore.filter((e) => e.comment === IMAGE_BOOK && typeof e.content === 'string' && e.content.trim() && e.content.trim() !== '[]');
  if (!books.length) throw fail('읽기', '로어북이 없거나 비어 있습니다. 봇 카드를 업데이트했는지 확인하세요.');
  let src: Record<string, unknown>;
  try {
    src = JSON.parse(String(books[books.length - 1].content).replace(/^﻿/, '').trim());
  } catch {
    throw fail('JSON', 'JSON 구문 또는 같은 이름의 중복 로어북을 확인하세요.');
  }
  if (!src || typeof src !== 'object') throw fail('JSON', '객체가 필요합니다.');
  const d: ImageData = { characters: [], keywords: [], keywordSet: new Set(), aliases: new Map() };
  const allowed = new Set<string>();
  const alias = (term: string, target: string) => {
    const k = term.toLowerCase();
    const cur = d.aliases.get(k);
    d.aliases.set(k, cur !== undefined && cur !== target ? false : target);
  };
  const list = (v: unknown, field: string): unknown[] => {
    if (!Array.isArray(v)) throw fail(field, '배열이 필요합니다.');
    return v;
  };
  const text = (v: unknown, field: string): string => {
    if (typeof v !== 'string' || !v.trim()) throw fail(field, '빈 문자열이 아닌 값이 필요합니다.');
    return v.trim();
  };
  for (const raw of list(src.characters, 'characters')) {
    const name = text(raw, 'characters');
    if (/[<>"{}_]/.test(name)) throw fail('characters', `이미지 영문명에 사용할 수 없는 문자입니다: ${name}`);
    if (!allowed.has(name)) {
      allowed.add(name);
      d.characters.push(name);
    }
    alias(name, name);
  }
  if (!d.characters.length) throw fail('characters', '출력 대상이 필요합니다.');
  for (const raw of list(src.sfw_keywords, 'sfw_keywords')) {
    const k = text(raw, 'sfw_keywords');
    if (!d.keywordSet.has(k)) {
      d.keywordSet.add(k);
      d.keywords.push(k);
    }
  }
  if (!d.keywords.length) throw fail('sfw_keywords', '태그 목록이 필요합니다.');
  const obj = (v: unknown, field: string) => {
    if (v === undefined) return {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw fail(field, '객체가 필요합니다.');
    return v as Record<string, unknown>;
  };
  for (const [term, target] of Object.entries(obj(src.kor_to_eng, 'kor_to_eng'))) {
    if (typeof target !== 'string' || !allowed.has(target)) throw fail('kor_to_eng', `characters에 없는 대상: ${String(target)}`);
    alias(text(term, 'kor_to_eng'), target);
  }
  for (const [target, terms] of Object.entries(obj(src.eng_aliases, 'eng_aliases'))) {
    if (!allowed.has(target)) throw fail('eng_aliases', `characters에 없는 대상: ${target}`);
    for (const t of list(terms, 'eng_aliases')) alias(text(t, 'eng_aliases'), target);
  }
  return d;
}

/** 본문에서 기존 <img=...> 태그를 지운다 (다시 생성·재호출 때 겹치지 않게) */
export function stripImageTags(content: string): string {
  return content.replace(/\n\s*\n\s*<img\s*=[^>]*>\s*\n\s*\n/g, '\n\n').replace(/<img\s*=[^>]*>\s*/g, '');
}

/** 이미지 태그를 붙일 본문과, 건드리지 않을 뒤쪽(상태창 [▣| / [◎| 블록부터) */
export function splitNarrative(content: string): { narrative: string; trailing: string } {
  const cut = ['[▣|', '[◎|'].map((p) => content.indexOf(p)).filter((i) => i >= 0);
  const at = cut.length ? Math.min(...cut) : -1;
  const narrative = at >= 0 ? content.slice(0, at) : content;
  const trailing = at >= 0 ? content.slice(at) : '';
  return {
    narrative: stripImageTags(narrative.replace(/<thoughts>[\s\S]*?<\/thoughts>/g, '').replace(/<!--[\s\S]*?-->/g, '')).trim(),
    trailing,
  };
}

/** 빈 줄로 나눈 단락 */
export function paragraphs(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (const line of `${text}\n`.split('\n').slice(0, -1)) {
    if (/^\s*$/.test(line)) {
      if (cur.length) out.push(cur.join('\n'));
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}

export function activeCharacters(narrative: string, d: ImageData): string[] {
  return d.characters.filter((name) => [...d.aliases].some(([alias, target]) => target === name && termPresent(narrative, alias)));
}

/** 보조 모델 요청 (원본 imgBuildPrompt 그대로) */
export function assetPrompt(active: string[], paras: string[], d: ImageData, limit: number): { role: 'user'; content: string }[] {
  const first = active[0] ?? 'Lee Ha-neul';
  const n = String(limit);
  const aliasLines = active
    .map((name) => {
      const names = [...d.aliases].filter(([, t]) => t === name).map(([a]) => a).sort();
      return names.length ? `- ${name} (${names.join(', ')})` : '';
    })
    .filter(Boolean);
  const w: string[] = [
    '# Insert <img> tags into a finished narrative.',
    '',
    'Output ONLY a JSON array. No text. No explanation. No code fence.',
    '',
    '## Format',
    '[{"line":N,"tag":"<img=\\"Character_keyword\\">"}]',
    '',
    "- `line`: 1-based paragraph number from the numbered narrative below. The tag is inserted AFTER that paragraph (the tag represents that paragraph's character).",
    '- `tag`: full `<img="Name_keyword">` string with Name and keyword from the allowed lists.',
    '- If no listed character appears in the narrative, output `[]`.',
    '',
    '## Rules',
    '- ONE tag per paragraph maximum. If multiple listed characters appear in the same paragraph, choose the one who is the FOCUS of that paragraph.',
    "- EVIDENCE-BASED: a character MUST be explicitly mentioned by name (English prefix OR Korean alias) in that paragraph's text to be tagged.",
    '- FORBIDDEN: tagging characters not present in the narrative. Absence in narrative = NO TAG.',
    '- MUST tag every visible listed character at least ONCE when they appear and are the focus.',
    '- Tag at first appearance AND when emotion changes SIGNIFICANTLY (smile → cry, calm → angry, neutral → shocked).',
    '- DO NOT tag minor variations (smile → bigger smile = SAME tag, skip).',
    '- DO NOT tag {{user}}, the narrator, or undefined NPCs.',
    '- DO NOT invent character names or keywords. Use only the lists below.',
    '',
    '## HARD LIMIT (per-character, independent count)',
    `- Each listed character has their OWN independent counter for tags. The limit is ${n} tag${n === '1' ? '' : 's'} PER character, NOT a total for the whole response.`,
    `- Character A may receive up to ${n} tag(s). Character B may ALSO receive up to ${n} tag(s). They do not share a budget.`,
    `- If 3 characters appear and each is the focus of separate paragraphs, you may output up to ${limit * 3} tags total (3 characters × ${n} each).`,
    '- Per-character priority when over the limit: KEEP the most significant emotion moments, SKIP the rest.',
    '- This per-character limit is absolute — exceeding it for any single character is a hard error. Under-using it (when more legitimate tags exist for that character) wastes the budget.',
    '',
    '## Allowed Character Names (use exactly as written)',
    active.join(' | '),
    '',
    ...(aliasLines.length ? ['## Aliases (for presence verification — still use the full English name in tag)', ...aliasLines, ''] : []),
    '## Allowed Keywords (use exactly as written)',
    `SFW: ${d.keywords.join(', ')}`,
    '',
    '## Examples',
    '',
    '### NEGATIVE (do not do this)',
    'Narrative:',
    '[1] The room is empty.',
    '[2] Wind blows through the window.',
    '',
    'Wrong output:',
    `[{"line":1,"tag":"<img=\\"${first}_neutral\\">"}]   <- no listed character present`,
    '',
    'Correct output:',
    '[]',
    '',
    '### POSITIVE (do this)',
    'Narrative:',
    `[1] ${first} walked into the room with a quiet smile.`,
    '[2] She glanced at the figure standing by the desk, her expression hardening into something sharper.',
    '',
    'Correct output:',
    `[{"line":1,"tag":"<img=\\"${first}_default\\">"},{"line":2,"tag":"<img=\\"${first}_serious\\">"}]`,
    '',
    '## Narrative (numbered by paragraph)',
    '',
    paras.map((p, i) => `[${i + 1}] ${p}`).join('\n\n'),
    '',
    '# Reminder: Output ONLY the JSON array. No prose. No explanation. If no listed character appears, output [].',
  ];
  return [{ role: 'user', content: w.join('\n') }];
}

/** 응답에서 JSON 배열만 (앞뒤 글·코드 펜스가 있어도) */
export function parsePatches(raw: string): { line: number; tag: string }[] {
  const text = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const s = text.indexOf('[');
  const e = text.lastIndexOf(']');
  if (s < 0 || e <= s) return [];
  let v: unknown;
  try {
    v = JSON.parse(text.slice(s, e + 1));
  } catch {
    try {
      v = JSON.parse(text.slice(s, e + 1).replace(/,\s*([\]}])/g, '$1'));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is { line: unknown; tag: unknown } => !!p && typeof p === 'object')
    .map((p) => ({ line: Number(p.line), tag: typeof p.tag === 'string' ? p.tag : '' }));
}

/** 단락 뒤에 태그를 끼운다. 단락당 하나, 캐릭터별 limit개까지, 목록에 있는 이름·키워드만 */
export function applyPatches(paras: string[], patches: { line: number; tag: string }[], limit: number, d: ImageData): string {
  const sorted = [...d.characters].sort((a, b) => b.length - a.length);
  const inserts = new Map<number, string>();
  const count = new Map<string, number>();
  for (const p of patches) {
    const ln = p.line;
    if (!Number.isInteger(ln) || ln < 1 || ln > paras.length || inserts.has(ln)) continue;
    const m = /<img\s*=\s*"([^"]+)"/.exec(p.tag) ?? /<img\s*=\s*([^>]+)>/.exec(p.tag);
    const inner = m?.[1]?.trim();
    if (!inner) continue;
    const name = sorted.find((c) => inner.startsWith(`${c}_`));
    if (!name || !d.keywordSet.has(inner.slice(name.length + 1))) continue;
    const cur = count.get(name) ?? 0;
    if (cur >= limit) continue;
    inserts.set(ln, `<img=${inner}>`);
    count.set(name, cur + 1);
  }
  const out: string[] = [];
  paras.forEach((para, i) => {
    out.push(para);
    const tag = inserts.get(i + 1);
    if (tag) out.push(tag);
  });
  return out.join('\n\n');
}

export interface AssetJob {
  /** 이 본문으로 요청했다 (저장 전에 그대로인지 다시 확인) */
  original: string;
  paras: string[];
  trailing: string;
  messages: { role: 'user'; content: string }[];
}

/** 태그를 붙일 것이 없으면 null */
/** exclude: 태그하지 않을 영문명 (주인공 이미지를 끈 채 캐릭터로 플레이할 때 그 요원) */
export function planAsset(content: string, d: ImageData, limit: number, exclude: string[] = []): AssetJob | null {
  const { narrative, trailing } = splitNarrative(content);
  if (!narrative) return null;
  const active = activeCharacters(narrative, d).filter((name) => !exclude.includes(name));
  if (!active.length) return null;
  const paras = paragraphs(narrative);
  if (!paras.length) return null;
  return { original: content, paras, trailing, messages: assetPrompt(active, paras, d, limit) };
}

export function finishAsset(job: AssetJob, response: string, d: ImageData, limit: number): string | null {
  const patches = parsePatches(response);
  if (!patches.length) return null;
  const body = applyPatches(job.paras, patches, limit, d);
  return job.trailing ? `${body}\n${job.trailing}` : body;
}
