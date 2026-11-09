// 플러그인 내장 지침 (docs/설계안_세계편집.md 3장, 사용자 2026-10-27): 카드 로어북 GNet·Phone·Wiki·Directive·Visit 과
// 카드 description(RP 지침)을 플러그인이 들고 간다. 카드 로어북은 더 읽지 않는다 (우선 규칙 없음).
// 글은 src/data/guides/*.txt (경량 카드 v0.16.65 에서 그대로 옮김). 사용자가 고친 글(기기 설정)은 setGuideOverride 로 덮는다.
import gnetBase from '../data/guides/gnet.txt';
import phone from '../data/guides/phone.txt';
import wiki from '../data/guides/wiki.txt';
import directive from '../data/guides/directive.txt';
import rp from '../data/guides/rp.txt';
import tag from '../data/guides/tag.txt';
import shop from '../data/guides/shop.txt';
import updater from '../data/guides/updater-detailed.txt';
import updaterCompact from '../data/guides/updater-compact.txt';
import { DIRECTOR_FACTS, DIRECTOR_SCENE, ROUTER_SYSTEM } from './people/basetext';

export type GuideName = 'GNet' | 'Gal' | 'Wpf' | 'Salmon' | 'Cos' | 'Bm' | 'Phone' | 'Wiki' | 'Directive' | 'RP' | 'Tag' | 'Shop' | 'Updater' | 'UpdaterCompact' | 'Director' | 'Router';
export const GUIDE_NAMES: GuideName[] = ['GNet', 'Gal', 'Wpf', 'Salmon', 'Cos', 'Bm', 'Phone', 'Wiki', 'Directive', 'RP', 'Tag', 'Shop', 'Updater', 'UpdaterCompact', 'Director', 'Router'];
export const GUIDE_LABEL: Record<GuideName, string> = { GNet: '괴담넷', Gal: '괴담갤', Wpf: '세정게', Salmon: '연어 마켓', Cos: '우주 쇼핑몰', Bm: '백일몽 포인트몰', Phone: '괴담톡', Wiki: '괴이위키', Directive: '이동·임무 지시문', RP: 'RP 지침(봇 설명)', Tag: '상태창·태그', Shop: '상점', Updater: '인물 기록 갱신기(자세히)', UpdaterCompact: '인물 기록 갱신기(간결)', Director: 'Director(이번 턴 연기 지시)', Router: 'Router(장면 인물 고르기)' };

/* ── 게시판 사이트별 기본 지침 (2026-11-08 사용자: 사이트마다 따로). 기본 글은 한 벌(gnet.txt)에 사이트 갈래가 들어 있고,
   여기서 그 사이트 갈래만 남겨 사이트마다 따로 된 지침을 만든다. 그 뒤 사용자는 사이트마다 따로 고친다 ── */
const STYLE_WHEN = /^\{\{#when \{\{(equal|notequal)::\{\{getvar::lb_cfg_lb-gn\.style\}\}::(\w+)\}\}\}\}$/;
/** s[i]가 「{{#when」일 때 그 여는 표식이 끝난 자리 */
function openEnd(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; ) {
    if (s.startsWith('{{', j)) { depth++; j += 2; continue; }
    if (s.startsWith('}}', j)) { depth--; j += 2; if (!depth) return j; continue; }
    j++;
  }
  return s.length;
}
/** 여는 표식 뒤 j부터 짝이 되는 「{{/when}}」 자리 */
function closeAt(s: string, j: number): number {
  let depth = 1;
  for (;;) {
    const a = s.indexOf('{{#when', j);
    const b = s.indexOf('{{/when}}', j);
    if (b < 0) return s.length;
    if (a >= 0 && a < b) { depth++; j = openEnd(s, a); continue; }
    if (!--depth) return b;
    j = b + 9;
  }
}
function pickStyle(s: string, style: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const a = s.indexOf('{{#when', i);
    if (a < 0) return out + s.slice(i);
    const e = openEnd(s, a);
    const m = STYLE_WHEN.exec(s.slice(a, e));
    if (!m) { out += s.slice(i, e); i = e; continue; }
    const c = closeAt(s, e);
    const keep = m[1] === 'equal' ? style === m[2] : style !== m[2];
    out += s.slice(i, a) + (keep ? pickStyle(s.slice(e, c), style) : '');
    i = c + 9;
  }
}
const boardGuide = (style: 'net' | 'gal' | 'wpf') => pickStyle(gnetBase.replace(/\r/g, ''), style);
/** 연어 마켓: 괴담갤(일반인 이용자) 갈래에서 소개·주제만 거래 게시판으로 */
function salmonGuide(): string {
  return boardGuide('gal')
    .replace(/^괴담갤 \(괴담 갤러리\) is a completely civilian[^\n]*$/m, SALMON_ABOUT)
    .replace(/^Use 썰, 창작 괴담[^\n]*$/m, SALMON_TOPICS);
}
const SALMON_ABOUT = "연어 마켓 (salmon-market.kr) is a Korean secondhand-trade board of the hidden side of the ongoing narrative's world, used like an ordinary neighborhood resale app: people post items for sale (팝니다) or items they want (삽니다), and deals happen face to face (직거래) at an agreed time and place. What is traded ranges from ordinary used goods to anomaly-related items, charms, salvage, information and odd services, all listed in the same plain resale tone. Sellers and buyers are ordinary residents, enthusiasts, collectors, brokers, scammers and people from the anomaly trade who never identify themselves. Treat users as people in this world, not story readers or game players.";
const SALMON_TOPICS = 'Each post is a listing: 팝니다 (selling) or 삽니다 (buying). Start the title with the plain name of the one item being sold or sought (e.g. 「업소용 튀김기 팝니다」, 「방검복 구합니다」) so the app can show its picture; put district, condition and extras in the body, not the title. Give the item, its condition, a price written freely by the poster (an amount, 나눔, 가격 제안, 협의 and so on), a neighborhood for 직거래, and a short body in resale-app tone. Mix ordinary used goods with anomaly-related items, salvage, charms, information and odd requests. Comments are questions, haggling, 예약 requests and warnings. Do not force every listing to involve an anomaly.';

// 쇼핑몰 (2026-11-08 사용자: 사이트마다 지침 따로). 상점 지침의 절을 그대로 쓰고 첫 절(COMMON)만 그 사이트 글로 바꾼다. 본편 표식 절은 뺀다
const mallGuide = (common: string): string => shop.replace(/\r/g, '')
  .replace(/@@SECTION COMMON\n[\s\S]*?\n@@END/, `@@SECTION COMMON\n${common}\n@@END`)
  .replace(/\n*@@SECTION MAIN_TAG\n[\s\S]*?\n@@END\n*/, '\n');
const COS_COMMON = "You run 우주 쇼핑몰 (cosmic-mall.alien), the web page of a hidden shop inside the ongoing Korean urban-horror roleplay (서울의 이면, 괴이): a 1990s-style personal homepage that sells strange goods of unknown origin. The page has no staff; its only voice is an unnamed 운영자. The site name and the UFO logo are the whole joke, and the page never explains it: NEVER state or hint that the operator or the goods are alien, from space, from another star or another world; never call the customer 지구인; never explain where the goods come from, how they are made or how they are delivered; never wink at the player. The page behaves like a dull, slightly broken shop. Everything the 운영자 writes and every item 설명 is in 왈도체 — Korean that reads as if a foreign shop catalog was run through a cheap 1990s translation program, written by someone who believes it is correct Korean. Concretely: (1) word-for-word translation keeping the source word order and dummy subjects (「그것은 밝음을 제공 합니다」, 「이것은 당신을 돕습니다」); (2) the dictionary's first meaning picked even when wrong (fire → 「불을 열어라」, save → 「구하다」, free → 「자유」); (3) a space before 하다·되다·입니다 (「추천 합니다」, 「발송 됩니다」, 「상품 입니다」) and wrong or missing particles (「물건을 보겠습니다」, 「당신은 만족을 가집니다」); (4) stiff formal endings (-합니다, -하십시오) with a sudden blunt one now and then (-한다, -하라) and overdone exclamation (「굉장한!!」); (5) nouns where Korean uses verbs (「사용의 결과」, 「환불의 존재는 없습니다」). Short flat catalog sentences. No slang, no internet memes, no cute mascot talk, no 「~인 것이다」 on every line, no English words left untranslated except product names — the comedy is accidental, never performed. Item names may themselves look mistranslated: a transliterated phrase (「위 헬프!」), a literal rendering (「끝까지 밝은 손전등」), a wrong word (「기억을 지우는 스푸레이」); the 설명 states what the thing does in one or two flat sentences and never its limits, side effects or origin. You are the backend for the mall page, not the narrator: you only decide what is listed and what the 운영자 writes. The \"owner\" is the 운영자. Buying is a bank transfer in Korean won to the mall's account; there are no refunds and no returns. Write in Korean. Prices are Korean won as plain integers. Never mention the player's money or inventory (you do not know them). Do not write anything outside the required blocks.";
const BM_COMMON = "You run 백일몽 포인트몰 (point.baekilmong.intra), the in-house welfare point mall of 백일몽, inside an ongoing Korean urban-horror roleplay (서울의 이면, 괴이). Employees spend Baekilmong points here; each employee earns their own points through their own work and they cannot be exchanged for cash. The mall never hands out, grants or pays points. You are the backend for the mall page, not the narrator: you only decide what is listed. There is no shopkeeper or chat; the \"owner\" line is a short mall notice about the goods in plain corporate Korean (never about points being issued or granted), or empty. Sell what such a company mall would: everyday welfare goods, appliances, health goods, and supplies for anomaly fieldwork as the reference material allows. Write in Korean. Every price is a plain integer in points. Never mention the player's points or inventory (you do not know them). Do not write anything outside the required blocks.";

const DEFAULTS: Record<GuideName, string> = {
  GNet: boardGuide('net'),
  Gal: boardGuide('gal'),
  Wpf: boardGuide('wpf'),
  Salmon: salmonGuide(),
  Phone: phone.replace(/\r/g, ''),
  Wiki: wiki.replace(/\r/g, ''),
  Directive: directive.replace(/\r/g, ''),
  RP: rp.replace(/\r/g, ''),
  Tag: tag.replace(/\r/g, ''),
  Shop: shop.replace(/\r/g, ''),
  Cos: mallGuide(COS_COMMON),
  Bm: mallGuide(BM_COMMON),
  Updater: updater.replace(/\r/g, ''),
  UpdaterCompact: updaterCompact.replace(/\r/g, ''),
  Director: `@@SECTION FACTS\n${DIRECTOR_FACTS.join('\n')}\n@@END\n\n@@SECTION SCENE\n${DIRECTOR_SCENE.join('\n')}\n@@END\n`,
  Router: `@@SECTION ROLE\n${ROUTER_SYSTEM.slice(0, 3).join('\n')}\n@@END\n\n@@SECTION RULES\n${ROUTER_SYSTEM.slice(3).join('\n')}\n@@END\n`,
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

/* ── 내가 추가한 규칙 (2026-10-27 리수폿식 「프롬프트」 탭): 기기 설정에 두고, 붙일 지침의 늘 쓰이는 절 끝에 넣는다 ──
   본편(RP): 글 끝 / 이동·임무(Directive): COMMON 절 / 괴담넷: LB 절 / 괴담톡: COMMON / 위키: NW.GUIDE / 필드: COMMON */
export type RuleTarget = 'RP' | 'Directive' | 'GNet' | 'Gal' | 'Wpf' | 'Salmon' | 'Phone' | 'Wiki';
export const RULE_TARGETS: RuleTarget[] = ['RP', 'Directive', 'GNet', 'Gal', 'Wpf', 'Salmon', 'Phone', 'Wiki'];
export const RULE_TARGET_LABEL: Record<RuleTarget, string> = { RP: '본편', Directive: '이동·임무', GNet: '괴담넷', Gal: '괴담갤', Wpf: '세정게', Salmon: '연어 마켓', Phone: '괴담톡', Wiki: '위키' };
export interface UserRule {
  id: string;
  title: string;
  text: string;
  to: RuleTarget[];
  on: boolean;
}
const RULE_SECTION: Record<RuleTarget, string | null> = { RP: null, Directive: 'COMMON', GNet: 'LB', Gal: 'LB', Wpf: 'LB', Salmon: 'LB', Phone: 'COMMON', Wiki: 'NW.GUIDE' };

let userRules: UserRule[] = [];
export function setUserRules(rules: UserRule[] | undefined | null): void {
  userRules = Array.isArray(rules) ? rules.filter((r) => r && typeof r.id === 'string') : [];
}
export const getUserRules = (): UserRule[] => userRules;

/** 이 지침에 붙을 규칙 글 (없으면 빈 글) */
export function rulesFor(name: GuideName): string {
  if (!(RULE_TARGETS as string[]).includes(name)) return '';
  const hit = userRules.filter((r) => r.on && r.text.trim() && r.to.includes(name as RuleTarget));
  if (!hit.length) return '';
  return `## User Rules\n${hit.map((r) => `### ${r.title.trim() || '규칙'}\n${r.text.trim()}`).join('\n\n')}`;
}

/** 요청에 쓰는 지침 글: 고친 글(또는 기본) + 내가 추가한 규칙. 편집 창은 guideText(규칙 없는 글)를 쓴다 */
export function guidePrompt(name: GuideName): string {
  const base = guideText(name);
  const rules = rulesFor(name);
  if (!rules) return base;
  const at = RULE_SECTION[name as RuleTarget];
  if (!at) return `${base.replace(/\s+$/, '')}\n\n${rules}\n`;
  const parts = splitGuide(base);
  const i = parts.findIndex((p) => p.title === at);
  if (i < 0) return base;
  parts[i] = { ...parts[i], body: `${parts[i].body}\n\n${rules}` };
  return joinGuide(parts);
}

/** 지침의 @@SECTION 절들 (고친 글 + 내가 추가한 규칙 반영). 상점처럼 로어북 없이 플러그인 지침만 쓰는 곳 */
export function guideSections(name: GuideName): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of guidePrompt(name).matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)) out[m[1].trim()] = m[2];
  return out;
}

/** 절 글의 {이름} 자리를 채운다. 모르는 이름은 그대로 둔다 */
export const fillGuide = (text: string | undefined, vars: Record<string, string>): string =>
  String(text ?? '').replace(/\{([a-z_]+)\}/g, (all, k: string) => (k in vars ? vars[k] : all)).trim();
