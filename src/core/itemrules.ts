// 소지품 규칙 표 (2026-11-12 사용자: 「하나만 땜빵하지 말고 전체적으로」, 기계 일은 코드가):
//  ① 판정 표 — 물건의 갈래(무기·장비·사용·소모N)는 모델 깃발을 그대로 믿지 않고 「종류 또는 물건말 → 갈래」 표로 코드가 정한다
//  ② 「두고 옴」 말 · 「벗음」 말 — 갱신기가 설명만 고쳐 보냈을 때 코드가 잡는 안전망 (core/items.ts applyItemChanges)
//  ③ 등급 말 — 갱신기가 이름·설명에 본문에 없는 등급 말을 넣으면 뺀다 (등급은 본문이 정한다. 코드도 갱신기도 짐작하지 않는다)
// 표·낱말은 모두 설정에서 고친다 (채팅 변수 $it_*; 비우면 아래 기본값). 지금 채팅의 표는 host/risu.ts loadContext 가 올린다 (그림 대체 말과 같은 방식).
import { ICON_KIND_LABEL, normIcon, splitIconWord } from './iconmatch';
import { parseTraits, type ItemTraits } from './itemtraits';

export const ITEM_RULES_VAR = '$it_rules';
export const ITEM_LEFT_WORDS_VAR = '$it_left_words';
export const ITEM_OFF_WORDS_VAR = '$it_off_words';

/** 기본 판정 표: 한 줄 「종류 또는 물건말 → 갈래」. 갈래 말은 쓰임 글과 같다 (무기·장비·사용·소모N, 없으면 -). 물건말 줄이 종류 줄보다 먼저 본다 */
export const ITEM_RULES_DEFAULT = ['옷 → 장비', '무기 → 무기', '음식 → 소모1', '의료 → 소모1', '소모품 → 소모1', '열쇠 → 사용', '부적 → 사용', '봉인 → 사용', '서류 → -', '귀중품 → -', '잡동사니 → -', '괴이 → -', '도구 → 장비·사용', '기기 → 장비·사용'].join('\n');
/** 「두고 옴」 말: 갱신기가 update 의 설명에 이런 말을 적으면 지닌 목록에서 뺀다 */
export const ITEM_LEFT_WORDS_DEFAULT = '두고, 놓고, 보관해, 맡겨, 반납, 압수, 버리고, 잃어';
/** 「벗음」 말: 이런 말만 있으면 장착만 푼다 */
export const ITEM_OFF_WORDS_DEFAULT = '벗어, 벗고, 내려놓, 풀어';
/** 등급 이름 표 (위키 card/wiki-base.json 「백일몽」 문서의 「괴담 등급별 클리어 보상」 표 그대로): 갱신기가 이름·설명에 적은 등급 말이 인용에 실제로 있는지 확인하는 데만 쓴다.
 *  기존 설정·실행 중 자료에는 이 표가 없어(위키 문서는 비동기 저장소) 여기 둔다 — 설정 줄로 옮길지는 사용자 결정 대기 */
export const ITEM_GRADE_WORDS_DEFAULT = ['그늘 → F', '황혼 → E', '땅거미 → D', '어스름 → C', '어둠 → B', '암흑 → A', '심연 → S'].join('\n');
/** 상태 그림 묶음의 물건인데 그림 말에도 이름에도 어느 그림인지 안 적혔고 「빈」도 아닐 때 쓰는 그림의 등급 — 임시 값 (사용자 결정 대기). 이 한 곳만 바꾸면 된다 (core/datapack.ts formIcon) */
export const ITEM_FORM_DEFAULT = 'C';
export const ITEM_WORDS_MAX = 200;
export const ITEM_GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;

/** 「빈」: 빈 그림의 이름(icons.json 「빈 꿈결 수집기」)에 쓰인 말 */
export const FORM_EMPTY = '빈';
export const isGrade = (v: unknown): boolean => typeof v === 'string' && (ITEM_GRADES as readonly string[]).includes(v);

const SEP = /→|=>|->|=|:/;
export interface TraitRule { key: string; traits: ItemTraits | null }
/** 판정 표 글 → 줄. 왼쪽이 종류 말(옷·도구 …)이면 종류 줄, 아니면 물건말 줄. 오른쪽 「-」는 판정 없음 */
export function parseItemRules(text: string): { kinds: Map<string, ItemTraits | null>; words: Map<string, ItemTraits | null> } {
  const kinds = new Map<string, ItemTraits | null>();
  const words = new Map<string, ItemTraits | null>();
  const kindOf = new Map(Object.entries(ICON_KIND_LABEL).map(([k, v]) => [v, k]));
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = SEP.exec(line);
    if (!m) continue;
    const a = line.slice(0, m.index).trim();
    const b = line.slice(m.index + m[0].length).trim();
    if (!a || !b) continue;
    const traits = /^[-–—]$/.test(b) ? null : parseTraits(b);
    // 갈래 말이 하나도 없는 오른쪽(오타)은 쓰지 않는다
    if (traits && !traits.use && !traits.equip && !traits.uses) continue;
    const kind = kindOf.get(a);
    if (kind) kinds.set(kind, traits);
    else if (normIcon(a)) words.set(normIcon(a).replace(/ /g, ''), traits);
  }
  return { kinds, words };
}
export const parseWords = (text: string): string[] => [...new Set(String(text ?? '').split(/[,，\n]/).map((w) => w.replace(/\s+/g, ' ').trim()).filter(Boolean))];

interface Rules { traits: ReturnType<typeof parseItemRules>; left: string[]; off: string[]; grades: [string, string][] }
/** 등급 이름 표 글 → [이름, 등급 글자] */
export function parseGradeWords(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = SEP.exec(line);
    if (!m) continue;
    const a = line.slice(0, m.index).trim();
    const g = line.slice(m.index + m[0].length).trim().toUpperCase();
    if (a && isGrade(g)) out.push([a, g]);
  }
  return out;
}
const build = (vars: Record<string, unknown> | undefined): Rules => {
  const txt = (k: string, def: string) => { const s = String(vars?.[k] ?? ''); return s.trim() ? s : def; };
  return { traits: parseItemRules(txt(ITEM_RULES_VAR, ITEM_RULES_DEFAULT)), left: parseWords(txt(ITEM_LEFT_WORDS_VAR, ITEM_LEFT_WORDS_DEFAULT)), off: parseWords(txt(ITEM_OFF_WORDS_VAR, ITEM_OFF_WORDS_DEFAULT)), grades: parseGradeWords(ITEM_GRADE_WORDS_DEFAULT) };
};
let rules: Rules = build(undefined);
/** 지금 채팅의 표를 올린다 (host/risu.ts loadContext · 갱신기 적용 직전). 빈 값은 기본 표 */
export function setItemRules(vars: Record<string, unknown> | undefined | null): void {
  rules = build(vars ?? undefined);
}

/** 그림 낱말(종류/물건말/english)의 종류 코드 (모르면 '') */
export const kindOfIcon = (icon: unknown): string => splitIconWord(typeof icon === 'string' ? icon : '').kind;

/**
 * 갈래 정하기: 종류(kind)·물건말·이름을 표에서 찾는다. 물건말 줄(그림 낱말의 물건말 → 이름의 끝 낱말 → 이름 전체) → 종류 줄.
 * 표에 줄이 없으면 undefined (그때만 모델이 적은 값을 쓴다). 표의 「-」는 판정 없음.
 * 횟수: 표가 소모N 이면 모델이 적은 횟수(없으면 N). 표에 소모가 없으면 모델이 적은 횟수를 그대로 둔다 (횟수는 갈래가 아니라 양)
 */
export function traitsFor(kind: string, icon: unknown, name: string, model: { use?: boolean; uses?: unknown; equip?: unknown } = {}): ItemTraits | undefined {
  const t = rules.traits;
  const flat = (s: string) => normIcon(s).replace(/ /g, '');
  const { word } = splitIconWord(typeof icon === 'string' ? icon : '');
  const nameWords = normIcon(name).split(' ').filter(Boolean);
  const keys = [flat(word), nameWords[nameWords.length - 1] ?? '', flat(name)].filter(Boolean);
  let hit: ItemTraits | null | undefined;
  for (const k of keys) if (t.words.has(k)) { hit = t.words.get(k); break; }
  if (hit === undefined && kind && t.kinds.has(kind)) hit = t.kinds.get(kind);
  if (hit === undefined) return undefined;
  const n = Number(model.uses);
  const modelUses = Number.isSafeInteger(n) && n >= 1 ? Math.min(999, n) : undefined;
  const uses = hit?.uses ? modelUses ?? hit.uses : modelUses;
  return { use: !!hit?.use || !!uses, ...(uses ? { uses } : {}), ...(hit?.equip ? { equip: hit.equip } : {}) };
}

const has = (text: string, words: string[]) => { const t = String(text ?? ''); return words.find((w) => t.includes(w)) ?? ''; };
/** 설명에 「두고 옴」 말이 있나 → 걸린 말. 「벗음」 말 자리는 지우고 본다: 「내려놓고」의 「놓고」가 두고 옴으로 걸려 물건이 빠졌다 (전수검사 11-13) */
export const leftWordIn = (text: string): string => {
  let t = String(text ?? '');
  for (const w of rules.off) t = t.split(w).join(' ');
  return has(t, rules.left);
};
/** 설명에 「벗음」 말이 있나 → 걸린 말 */
export const offWordIn = (text: string): string => has(text, rules.off);

/** 글에 「빈」이 낱말로 적혔나 (「빈 꿈결 수집기」「빈 병」. 「수빈」「빈틈」은 아님) */
export const saysEmpty = (text: string): boolean => new RegExp(`(?:^|[\\s(\\[「『])${FORM_EMPTY}(?=\\s)`).test(String(text ?? ''));
/** 이름 앞의 「빈 」을 뗀 이름 (찼을 때 보일 이름). 「빈」으로 시작하지 않으면 그대로 */
export const nameFilled = (name: string): string => { const n = String(name ?? '').trim(); return n.startsWith(`${FORM_EMPTY} `) && n.length > 2 ? n.slice(2).trim() : n; };

const reEsc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 등급 말 뒤에 이런 꼴이 오면 그 등급이 아니라는 말이다 (「어스름 등급에서는 결코 나올 수 없는」「C등급보다」「B등급이 아닌」) */
const NOT_AFTER = /없[는을다었]|아닌|아니[라고었]|보다|못\s?[한할미]|넘[는어]|이상|이하|미만|초과/;
interface GradeHit { g: string; at: number; end: number; not: boolean }
/** 글에 적힌 등급 말: 「B등급」「B급」 또는 등급 이름 + 「등급」(「어둠 등급」「어스름(C) 등급」).
 *  「어둠 현장」「어둠 속」처럼 「등급」이 붙지 않은 이름은 등급이 아니다 (2026-11-12 사용자: 그 어둠은 괴이를 뜻하는 말) */
export function gradeHits(text0: string): GradeHit[] {
  const text = String(text0 ?? '');
  const hits: GradeHit[] = [];
  const put = (g: string, at: number, len: number) => { if (isGrade(g)) hits.push({ g, at, end: at + len, not: NOT_AFTER.test(text.slice(at + len, at + len + 20).split(/[,.!?…\n]/)[0]) }); };
  for (const m of text.matchAll(/(?<![A-Za-z])([A-Za-z])\s?(?:등급|급)/g)) put(m[1].toUpperCase(), m.index!, m[0].length);
  for (const [name, g] of rules.grades) {
    for (const m of text.matchAll(new RegExp(`${reEsc(name)}\\s?(?:\\(\\s?([A-Za-z])\\s?\\)\\s?)?등급`, 'g'))) put((m[1] ?? g).toUpperCase(), m.index!, m[0].length);
  }
  return hits.sort((a, b) => a.at - b.at);
}
/** 인용 글에 이 등급이 분명히 적혀 있나 (부정·견줌 꼴은 인정하지 않는다) */
export const gradeInQuote = (quote: string, grade: string): boolean => gradeHits(quote).some((h) => h.g === grade && !h.not);
/** 갱신기가 쓴 글(이름·설명)에서 본문 인용에 없는 등급 말을 뺀다 → 남은 글과 뺀 말. 인용에 그 등급이 적혀 있으면 그대로 둔다 */
export function stripGrades(text0: string, quote: string): { text: string; cut: string[] } {
  const text = String(text0 ?? '');
  const cut: string[] = [];
  let out = '';
  let pos = 0;
  for (const h of gradeHits(text)) {
    if (h.at < pos || gradeInQuote(quote, h.g)) continue;
    out += text.slice(pos, h.at);
    cut.push(text.slice(h.at, h.end));
    pos = h.end;
  }
  out += text.slice(pos);
  return cut.length ? { text: out.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(/^[\s·,의]+|[\s·,]+$/g, '').trim(), cut } : { text, cut };
}
