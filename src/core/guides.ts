// 플러그인 내장 지침 (docs/설계안_세계편집.md 3장, 사용자 2026-10-27): 카드 로어북 GNet·Phone·Wiki·Directive·Visit 과
// 카드 description(RP 지침)을 플러그인이 들고 간다. 카드 로어북은 더 읽지 않는다 (우선 규칙 없음).
// 글은 src/data/guides/*.txt (경량 카드 v0.16.65 에서 그대로 옮김). 사용자가 고친 글(기기 설정)은 setGuideOverride 로 덮는다.
import gnet from '../data/guides/gnet.txt';
import phone from '../data/guides/phone.txt';
import wiki from '../data/guides/wiki.txt';
import directive from '../data/guides/directive.txt';
import visit from '../../card/visit-guide.txt';
import rp from '../data/guides/rp.txt';
import tag from '../data/guides/tag.txt';

export type GuideName = 'GNet' | 'Phone' | 'Wiki' | 'Directive' | 'Visit' | 'RP' | 'Tag';
export const GUIDE_NAMES: GuideName[] = ['GNet', 'Phone', 'Wiki', 'Directive', 'Visit', 'RP', 'Tag'];
export const GUIDE_LABEL: Record<GuideName, string> = { GNet: '괴담넷', Phone: '괴담톡', Wiki: '위키', Directive: '이동·임무 지시문', Visit: '필드(본부 방문)', RP: 'RP 지침(봇 설명)', Tag: '상태창·태그' };

const VISIT_HEAD = '<!-- Visit: 본부 방문 대화 지침. 플러그인이 요청마다 필요한 섹션만 골라 씁니다. 자동 활성화 OFF / 키워드 비움. 섹션 구분 줄은 그대로 두세요. -->';
const DEFAULTS: Record<GuideName, string> = {
  GNet: gnet.replace(/\r/g, ''),
  Phone: phone.replace(/\r/g, ''),
  Wiki: wiki.replace(/\r/g, ''),
  Directive: directive.replace(/\r/g, ''),
  Visit: `${VISIT_HEAD}\n\n${visit.replace(/\r/g, '').trim()}\n`,
  RP: rp.replace(/\r/g, ''),
  Tag: tag.replace(/\r/g, ''),
};

const overrides = new Map<GuideName, string>();

/** 기기 설정에서 고친 글을 올린다 (빈 글이면 기본으로). 편집 창이 부른다 */
export function setGuideOverride(name: GuideName, text: string | undefined | null): void {
  if (text && text.trim()) overrides.set(name, text.replace(/\r/g, ''));
  else overrides.delete(name);
}

export const isGuideName = (name: string): name is GuideName => (GUIDE_NAMES as string[]).includes(name);
export const guideDefault = (name: GuideName): string => DEFAULTS[name];
export const guideText = (name: GuideName): string => overrides.get(name) ?? DEFAULTS[name];
export const guideOverridden = (name: GuideName): boolean => overrides.has(name);

/** 카드 description 이 아직 RP 지침을 들고 있는지 (경량 카드 v0.16.65 까지). 들고 있으면 플러그인이 다시 넣지 않는다 */
export const RP_HEAD = '## RP Guidance';

/* ── 지침을 절 단위로 (2026-10-27 사용자: 통째 글칸이 아니라 항목별로). 쪼갠 뒤 그대로 합치면 원문과 같다 ──
   GNet·Phone·Wiki·Visit: @@SECTION 이름 … @@END / Directive: ===이름=== / RP·Tag: ##·### 머리글. 절 앞의 머리글(제목 줄 등)은 「머리」 절 */
export interface GuidePart {
  title: string;
  /** 절 머리 (구분 줄 포함, 글칸에 안 보임) */
  head: string;
  /** 글칸에 보이는 본문 (끝 빈 줄 뺀 것) */
  body: string;
  /** 본문 뒤 (끝 빈 줄·@@END·절 사이 간격, 글칸에 안 보임) */
  tail: string;
}

function splitBy(text: string, re: RegExp, headOf: (m: RegExpMatchArray) => { title: string; head: string }): GuidePart[] {
  const hits = [...text.matchAll(re)];
  if (!hits.length) return [{ title: '전체', head: '', body: text.replace(/\s+$/, ''), tail: text.match(/\s+$/)?.[0] ?? '' }];
  const out: GuidePart[] = [];
  const pre = text.slice(0, hits[0].index);
  if (pre.trim()) out.push({ title: '머리', head: '', body: pre.replace(/\s+$/, ''), tail: pre.match(/\s+$/)?.[0] ?? '' });
  else if (pre) out.push({ title: '머리', head: pre, body: '', tail: '' });
  hits.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : text.length;
    const raw = text.slice(start, end);
    const tail = raw.match(/\s+$/)?.[0] ?? '';
    out.push({ ...headOf(m), body: raw.slice(0, raw.length - tail.length), tail });
  });
  return out;
}

export function splitGuide(text: string): GuidePart[] {
  if (text.includes('@@SECTION')) {
    const re = /@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g;
    const hits = [...text.matchAll(re)];
    const out: GuidePart[] = [];
    const pre = text.slice(0, hits[0]?.index ?? 0);
    if (pre.trim()) out.push({ title: '머리', head: '', body: pre.replace(/\s+$/, ''), tail: pre.match(/\s+$/)?.[0] ?? '' });
    else if (pre) out.push({ title: '머리', head: pre, body: '', tail: '' });
    hits.forEach((m, i) => {
      const end = m.index! + m[0].length;
      const gap = text.slice(end, i + 1 < hits.length ? hits[i + 1].index! : text.length);
      out.push({ title: m[1].trim(), head: `@@SECTION ${m[1]}\n`, body: m[2], tail: `\n@@END${gap}` });
    });
    return out;
  }
  if (/^===[^=\n]+===$/m.test(text)) return splitBy(text, /^===([^=\n]+)===\n/gm, (m) => ({ title: m[1].trim(), head: m[0] }));
  if (/^#{2,3} /m.test(text)) return splitBy(text, /^#{2,3} ([^\n]*)\n/gm, (m) => ({ title: m[1].trim(), head: m[0] }));
  return splitBy(text, /$^/g, () => ({ title: '전체', head: '' }));
}

export const joinGuide = (parts: GuidePart[]): string => parts.map((p) => p.head + p.body + p.tail).join('');
