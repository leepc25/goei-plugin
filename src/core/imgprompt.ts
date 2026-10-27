// 이미지 태그 지침 (메인 모델): 카드 로어북 「Asset」 대신 플러그인이 설정으로 조립해 요청에 끼운다 (사용자 2026-10-26).
// 지침 본문(틀)·출력 대상 캐릭터(명부 영문명에서 고름 + 임의 추가)·표정 세트를 설정에서 관리한다. 보조 모델 경로(core/asset.ts)도 같은 목록을 쓴다.
import type { LoreEntry } from './types';
import { readDirectory } from './world/directory';

/** 표정 세트 기본 (카드 그림 assets/portraits 27종) */
export const IMG_KEYWORDS_DEFAULT = ['default', 'angry', 'annoyed', 'bored', 'confused', 'contemptuous', 'crying', 'curious', 'dumbfounded', 'embarrassed', 'excited', 'exhausted', 'happy', 'laughing', 'lovestruck', 'lustful', 'nervous', 'proud', 'sad', 'scared', 'serious', 'shy', 'smile', 'smirk', 'smug', 'surprised', 'thinking'];

/** 지침 틀 기본 (카드 로어북 「Asset」 원문에서 CBS 를 뺀 것). 자리표: {characters} {keywords} {user_rule} {user_skip} */
export const IMG_PROMPT_DEFAULT = `## Inserting Character Visual Images

### Objective
- Generate character image tags only when a defined character is present and performing an action or expressing emotion in that paragraph.
- Do NOT generate tags for {user_skip}undefined characters.

### Placement Rules
- Conditional Tagging: Insert an image tag only if a defined character from the lists below is the focus of that paragraph.
- Skip Rule: If a paragraph focuses solely on {user_skip}narration without characters, or undefined NPCs, do not insert any image tag.
- Empty Line Buffer: When inserting a tag, place one blank line before and after.

- Example Structure:
Paragraph Text

<img={name}_{keyword}>

Next Paragraph Text

### Tag Construction Logic
- Identify the character type and follow the specific string format below.
{user_rule}

#### Defined Characters
- Format: <img={name}_{keyword}>
- Characters {name}: {characters}
- Available {keyword}: {keywords}

### Logic Priority
- If only {user_skip}undefined NPCs, or pure narration: Do NOT insert any tag.
- Strict Adherence: Do not invent new {name}, or {keyword}. Only use those provided.

---`;

export interface ImgPromptConfig {
  template: string;
  /** 끈 이름 (명부 목록에서 뺌) */
  off: string[];
  /** 임의 추가 이름 */
  extra: string[];
  keywords: string[];
}

export const IMG_TEMPLATE_MAX = 6000;
const cleanName = (s: unknown) => String(s ?? '').replace(/[<>"{}_\n]/g, '').trim().slice(0, 40);
const cleanKeyword = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().slice(0, 24);

/** 설정 값 읽기 (없으면 기본) */
export function imgPromptConfig(p: { imgPrompt?: string; imgNamesOff?: string[]; imgNamesExtra?: string[]; imgKeywords?: string[] } = {}): ImgPromptConfig {
  const kw = (p.imgKeywords ?? []).map(cleanKeyword).filter(Boolean);
  return {
    template: p.imgPrompt?.trim() ? p.imgPrompt.slice(0, IMG_TEMPLATE_MAX) : IMG_PROMPT_DEFAULT,
    off: [...new Set((p.imgNamesOff ?? []).map(cleanName).filter(Boolean))],
    extra: [...new Set((p.imgNamesExtra ?? []).map(cleanName).filter(Boolean))],
    keywords: kw.length ? [...new Set(kw)] : IMG_KEYWORDS_DEFAULT,
  };
}

/** 출력 대상 후보 전부: 명부 요원 영문명 + 임의 추가 (순서 유지, 중복 제거). 로어북 「Image tag」「Asset」은 더 쓰지 않는다 (사용자 2026-10-27) */
export function imgCandidates(lore: LoreEntry[] | undefined, cfg: ImgPromptConfig): { name: string; korean: string; source: 'directory' | 'extra' }[] {
  const out: { name: string; korean: string; source: 'directory' | 'extra' }[] = [];
  const seen = new Set<string>();
  const push = (name: string, korean: string, source: 'directory' | 'extra') => {
    const n = cleanName(name);
    if (!n || seen.has(n.toLowerCase())) return;
    seen.add(n.toLowerCase());
    out.push({ name: n, korean, source });
  };
  for (const a of readDirectory(lore).agents) if (a.english) push(a.english, a.name, 'directory');
  for (const n of cfg.extra) push(n, '', 'extra');
  return out;
}

export interface ImgPlayerOpts {
  /** 「주인공 이미지」 설정 */
  assetPlayer: boolean;
  /** 캐릭터로 플레이 중인 요원 영문명 (없으면 페르소나) */
  playerEnglish?: string;
  /** 페르소나 이름 ({{user}} 가 아닌 실제 이름이 필요할 때) */
  userName?: string;
}

/** 실제 출력 대상: 후보 − 끈 이름, 주인공 규칙 적용 (OFF 면 주인공 요원을 뺌, ON 이고 캐릭터 플레이가 아니면 페르소나 이름을 더함) */
export function imgCharacters(lore: LoreEntry[] | undefined, cfg: ImgPromptConfig, po: ImgPlayerOpts): string[] {
  const off = new Set(cfg.off.map((n) => n.toLowerCase()));
  let names = imgCandidates(lore, cfg).map((c) => c.name).filter((n) => !off.has(n.toLowerCase()));
  if (!po.assetPlayer && po.playerEnglish) names = names.filter((n) => n.toLowerCase() !== po.playerEnglish!.toLowerCase());
  if (po.assetPlayer && !po.playerEnglish) {
    const u = cleanName(po.userName);
    if (u && !names.some((n) => n.toLowerCase() === u.toLowerCase())) names.push(u);
  }
  return names;
}

/** 지침 조립 */
export function buildImgPrompt(cfg: ImgPromptConfig, characters: string[], assetPlayer: boolean): string {
  const userSkip = assetPlayer ? '' : '{{user}}, ';
  const userRule = assetPlayer ? '' : '- Do not create tags for {{user}}.';
  return cfg.template
    .replace(/\{characters\}/g, characters.join(', '))
    .replace(/\{keywords\}/g, cfg.keywords.join(', '))
    .replace(/\{user_skip\}/g, userSkip)
    .replace(/\{user_rule\}\n?/g, userRule ? `${userRule}\n` : '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 옛 카드의 로어북 「Asset」 본문이 요청에 남아 있으면 지운다 (플러그인 지침과 겹치지 않게) */
const LORE_BLOCK = /## Inserting Character Visual Images[\s\S]*?Only use those provided\.\s*(?:---\s*)?/g;
export function stripImgLore<M extends { role?: string; content?: unknown }>(messages: M[]): M[] {
  let changed = false;
  const out = messages.map((m) => {
    if (typeof m?.content !== 'string' || !m.content.includes('## Inserting Character Visual Images')) return m;
    changed = true;
    return { ...m, content: m.content.replace(LORE_BLOCK, '').replace(/\n{3,}/g, '\n\n') };
  });
  return changed ? out.filter((m) => !(typeof m?.content === 'string' && !m.content.trim())) : messages;
}

/** 보조 모델 자료(core/asset.ts ImageData)에 설정의 목록을 입힌다: 캐릭터는 설정 결과로, 표정은 설정 세트로 */
export function applyImgConfig<D extends { characters: string[]; keywords: string[]; keywordSet: Set<string>; aliases: Map<string, string | false> }>(d: D, characters: string[], keywords: string[]): D {
  const aliases = new Map(d.aliases);
  for (const n of characters) if (!aliases.has(n.toLowerCase())) aliases.set(n.toLowerCase(), n);
  return { ...d, characters, keywords, keywordSet: new Set(keywords), aliases };
}
