// 소지품 이름 → 그림 파일 매칭 (2026-11-07 다시 짬). game-src/items/match_icon.mjs 와 같은 규칙 — 시험(tests/itemicons.test.mjs)이 둘을 맞대 봄. 설명은 그 파일 머리말.
// ① 몸통 단계: 몸통 말(끝 낱말)이 같은 그림만 후보 → 꾸밈말로 고름(줄에만 있는 말·물건이 무엇인지 말하는 말은 깎고, 낡은·녹슨 같은 상태 말은 거의 안 봄)
//    → 꾸밈말이 하나도 안 맞았는데 몸통 말 하나로 된 그림이 없으면 쓰지 않음 ② 글자 조각 점수 ③ 둘 다 못 찾으면 null(공통 그림)

/** 이름 비교용: 소문자, 한글·영어·숫자 말고는 띄어쓰기로 */
export const normIcon = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').trim();

export interface IconRow { file: string; keywords: string[]; phrases: string[]; kind?: string }
export interface IconHit { file: string; score: number }

// ── 종류 (2026-11-09 사용자: 매칭기 재설계) ──
// 모델이 그림 칸에 「종류/물건말」(옷/코트)을 쓰면 ① 그 종류 안에서 물건말·이름의 몸통 말로 → ② 종류 안에서 글자가 가장 가까운 그림 → ③ 종류 대표 그림.
// 상자(공통 그림)는 종류조차 모를 때만. 한국어 이름의 몸통 말은 영어 그림 낱말보다 우선한다.
export const ICON_KIND_LABEL: Record<string, string> = { wear: '옷', food: '음식', tool: '도구', device: '기기', medical: '의료', consumable: '소모품', charm: '부적', weapon: '무기', paper: '서류', valuable: '귀중품', key: '열쇠', seal: '봉인', anomaly: '괴이', adult: '성인', body: '신체', misc: '잡동사니' };
/** 지침에 넣는 종류 목록 글 */
export const ICON_KINDS_TEXT = Object.values(ICON_KIND_LABEL).join('·');
const KIND_OF: Record<string, string> = {};
for (const [k, v] of Object.entries(ICON_KIND_LABEL)) (KIND_OF[v] = k), (KIND_OF[k] = k);
KIND_OF['의류'] = 'wear'; KIND_OF['음식물'] = 'food'; KIND_OF['장비'] = 'device'; KIND_OF['기계'] = 'device'; KIND_OF['약'] = 'medical'; KIND_OF['의약'] = 'medical'; KIND_OF['의료품'] = 'medical'; KIND_OF['문서'] = 'paper'; KIND_OF['종이'] = 'paper'; KIND_OF['보석'] = 'valuable'; KIND_OF['귀중'] = 'valuable'; KIND_OF['잡화'] = 'misc'; KIND_OF['기타'] = 'misc'; KIND_OF['clothes'] = 'wear'; KIND_OF['clothing'] = 'wear'; KIND_OF['medicine'] = 'medical'; KIND_OF['gadget'] = 'device'; KIND_OF['document'] = 'paper'; KIND_OF['etc'] = 'misc';

/** 「종류/물건말」 → { kind(영문 종류 코드, 모르면 ''), word }. 「옷/코트」「옷 / 코트」「wear/coat」「옷」 */
export function splitIconWord(icon: string | undefined): { kind: string; word: string } {
  const raw = String(icon ?? '').trim();
  const m = /^([^/／:：|｜]+?)\s*[/／:：|｜]\s*(.*)$/.exec(raw);
  if (m) {
    const k = KIND_OF[normIcon(m[1])];
    if (k) return { kind: k, word: m[2].trim() };
  }
  const k1 = KIND_OF[normIcon(raw)];
  if (k1) return { kind: k1, word: '' };
  return { kind: '', word: raw };
}

/** 대체 표 글 (한 줄에 「외투 → 코트」, →·=>·=·: 가운데 어느 것이든) → 정규화 말 → 말 */
export function parseIconAliases(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*([^→=:>]+?)\s*(?:→|=>|->|=|:)\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const a = normIcon(m[1]);
    const b = normIcon(m[2]);
    if (a && b && a !== b) out[a] = b;
  }
  return out;
}
/** 기본 대체 표 (설정에서 고친다. 표에 있는 말로만) */
export const ICON_ALIAS_DEFAULT = ['외투 → 코트', '점퍼 → 재킷', '안정수 → 안정제', '캡슐 → 알약', '영양 바 → 에너지바', '바 → 에너지바', '속옷 → 팬티', '내의 → 팬티'].join('\n');
let aliases: Record<string, string> = parseIconAliases(ICON_ALIAS_DEFAULT);
/** 지금 채팅의 대체 표를 올린다 (host/risu.ts loadContext). 빈 글이면 기본 표 */
export function setIconAliases(text: string | undefined | null): void {
  aliases = parseIconAliases(text && text.trim() ? text : ICON_ALIAS_DEFAULT);
}

export type IconMissLevel = 'kind-near' | 'kind-base' | 'none';
export interface IconMiss { name: string; icon: string; level: IconMissLevel; file: string }
const misses: IconMiss[] = [];
const ICON_MISS_MAX = 100;
/** 이번 실행에서 ②③·상자로 떨어진 물건 (설정 「그림 못 찾은 말」 — 뽑을 에셋 고르기용) */
export const readIconMisses = (): IconMiss[] => misses.slice();
export function clearIconMisses(): void {
  misses.length = 0;
}
/** 그 안의 매칭은 「그림 못 찾은 말」에 적지 않는다 (연어 마켓 매물 제목처럼 소지품 물건이 아닌 것, 릴리스 점검 11-09) */
let quiet = 0;
export function iconQuiet<T>(f: () => T): T {
  quiet++;
  try {
    return f();
  } finally {
    quiet--;
  }
}
function noteMiss(m: IconMiss): void {
  if (quiet) return;
  if (misses.some((x) => x.name === m.name && x.icon === m.icon)) return;
  misses.push(m);
  if (misses.length > ICON_MISS_MAX) misses.splice(0, misses.length - ICON_MISS_MAX);
}

// 꾸밈말(뒤에 낱말이 더 오고 끝 글자 받침이 ㄴ: 속삭이는, 피 묻은, 녹슨, 감긴)
const isMod = (wd: string) => wd.length >= 2 && (wd.charCodeAt(wd.length - 1) - 0xac00) % 28 === 4;

// ── ② 조각 단계 ──
const ICON_MIN = 0.7; // 조각 단계에서 이보다 낮으면 공통 그림 (몸통 단계에서 못 찾은 것이라 엄하게)
const A = 0.7; // 물건 쪽 조각이 줄에 없을 때 깎는 몫
const B = 0.3; // 줄 쪽 조각이 물건에 없을 때 깎는 몫
const NAME_W = 0.2; // 그림 찾기 낱말이 있으면 그것으로 고르고, 이름은 비슷한 점수를 가르는 데만
const HEAD_MISS = 0.65; // 이름의 마지막 글자(몸통)가 줄에 없으면 — 위장복 → 위, 가죽 장갑 → 가죽 장부
const TAIL = 0.15; // 이름의 끝 말이 같을 때 덤(드물수록 큼). 낱말에는 안 씀
const MOD_W = 0.5; // 꾸밈말 무게

interface Frags { set: Map<string, number>; tail: string; last: string; w: number }

/** 조각 → 배수. 한글 덩어리(띄어쓰기 무시)는 한 글자·두 글자, 영어·숫자는 낱말(끝 s 뗌) */
function iconFrags(s: string): Omit<Frags, 'w'> {
  const out = new Map<string, number>();
  const put = (f: string, m: number) => out.set(f, Math.max(out.get(f) ?? 0, m));
  let tail = '';
  let last = '';
  for (const p of normIcon(s).match(/[가-힣]+(?: +[가-힣]+)*|[0-9a-z]+/g) ?? []) {
    if (/[가-힣]/.test(p)) {
      const words = p.split(' ');
      const c = words.join('');
      const mult: number[] = [];
      words.forEach((wd, i) => {
        const m = i < words.length - 1 && isMod(wd) ? MOD_W : 1;
        for (let j = 0; j < wd.length; j++) mult.push(m);
      });
      for (let i = 0; i < c.length; i++) {
        put(c[i], mult[i]);
        if (i + 1 < c.length) put(c.slice(i, i + 2), Math.max(mult[i], mult[i + 1]));
      }
      tail = c.length > 1 ? c.slice(-2) : c;
      last = c.slice(-1);
    } else {
      const w = p.length > 3 && p.endsWith('s') && !p.endsWith('ss') ? p.slice(0, -1) : p;
      put(w, 1);
      tail = w;
      last = w;
    }
  }
  return { set: out, tail, last };
}

function makeFragIndex(rows: IconRow[], reps: Record<string, string>, min = ICON_MIN): (name: string, icon?: string) => IconHit | null {
  const df = new Map<string, number>();
  const items = rows.map((r) => {
    const ps = [...new Set(r.phrases.map(normIcon).filter(Boolean))].map((t) => ({ t, ...iconFrags(t), w: 0 })).filter((p) => p.set.size);
    const all = new Set<string>();
    for (const p of ps) for (const f of p.set.keys()) all.add(f);
    for (const f of all) df.set(f, (df.get(f) ?? 0) + 1);
    return { file: r.file, ps };
  });
  const N = items.length || 1;
  const idf = (f: string) => Math.log(1 + N / (df.get(f) || 0.5));
  const idfMax = Math.log(1 + N / 0.5);
  const sum = (m: Map<string, number>) => {
    let a = 0;
    for (const [f, x] of m) a += idf(f) * x;
    return a;
  };
  for (const it of items) for (const p of it.ps) p.w = sum(p.set);
  const score = (q: Frags, it: (typeof items)[number], isName: boolean) => {
    let best = 0;
    let by = '';
    for (const p of it.ps) {
      let c = 0;
      for (const [f, x] of p.set) {
        const y = q.set.get(f);
        if (y) c += idf(f) * Math.min(x, y);
      }
      if (!c) continue;
      let s = c / (c + A * (q.w - c) + B * (p.w - c));
      if (isName) {
        if (q.tail && q.tail === p.tail) s += (TAIL * idf(q.tail)) / idfMax;
        if (q.last && !p.set.has(q.last)) s *= HEAD_MISS;
      }
      if (s > best) (best = s), (by = p.t);
    }
    return { s: best, by };
  };
  const query = (s: string | undefined): Frags | null => {
    if (!s) return null;
    const q = iconFrags(s);
    return q.set.size ? { ...q, w: sum(q.set) } : null;
  };
  const none = { s: 0, by: '' };
  const pick = (qn: Frags | null, qi: Frags | null): IconHit | null => {
    let best: { file: string; total: number; score: number; isRep: number } | null = null;
    for (const it of items) {
      const a = qn ? score(qn, it, true) : none;
      const b = qi ? score(qi, it, false) : none;
      const top = qi ? b.s : a.s;
      if (!top) continue;
      const total = qi ? b.s + NAME_W * a.s : a.s;
      const isRep = reps[a.by] === it.file || reps[b.by] === it.file ? 1 : 0;
      if (!best || total > best.total + 1e-9 || (Math.abs(total - best.total) <= 1e-9 && isRep > best.isRep)) best = { file: it.file, total, score: top, isRep };
    }
    return best && best.score >= min ? { file: best.file, score: best.score } : null;
  };
  return (name, icon) => {
    const qn = query(name);
    const qi = query(icon);
    return (qi && pick(qn, qi)) || (qn && pick(qn, null)) || null;
  };
}

// ── ① 몸통 단계 ──
const HEAD_EXTRA = 1; // 줄에만 있는 꾸밈말·물건이 무엇인지 말하는 말이 빠졌을 때 깎는 몫
const Q_EXTRA = 0.05; // 물건 쪽에만 있는 상태 꾸밈말(낡은·녹슨·old)을 깎는 몫 (같은 점수를 가르는 정도)
const stem = (w: string) => (/^[a-z]+$/.test(w) && w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

interface Head { words: string[]; head: string; mods: string[]; ko: boolean; joined: string }
interface Phrase extends Head { t: string; kw: boolean }
interface Same { qPre: string; pPre: string; whole?: boolean }
interface Found { file: string; s: number; hit: number; plain: boolean; isRep: number; name: number; qPre?: string; retry?: string }

/** 물건이 무엇인지 말하지 않는 몸통 말 (그 앞말이 물건, 2026-11-08 사용자 「매칭 더 정교하게」): 이 말은 떼고 앞말로 찾고, 대표 그림은 쓰지 않는다 */
const GENERIC = new Set(['키트', 'kit', '세트', 'set', '장치', 'device', '도구', 'tool', '기계', 'machine', '용품', 'supply', '물품', '물건', 'item', '패키지', 'package', '묶음', 'pack', '상자', 'box']);
/** 장치·기계·도구 = 「~기」 (경보 장치 → 경보기, 탐지 장치 → 탐지기) */
const MACHINE = new Set(['장치', '기계', '도구']);

function headOf(s: string): Head | null {
  const words = normIcon(s).split(' ').filter(Boolean).map(stem);
  // 끝에 붙은 번호·용량(봉인 상자 1, 앰플 30ml, 생수 2L)은 몸통이 아님 → 뗌. 등급(C급·S등급·F)은 꾸밈말로 앞에 둠 (2026-11-09 사용자: 「앰플 (C급)」이 상자로 나옴)
  const grade: string[] = [];
  while (words.length > 1) {
    const w = words[words.length - 1];
    if (/^\d+$/.test(w) || /^\d+[a-z]+$/.test(w)) words.pop();
    else if (/^(?:[a-z]|\d+)(?:등급|급|형)?$/.test(w)) grade.unshift(words.pop() as string);
    else break;
  }
  words.unshift(...grade);
  if (!words.length) return null;
  const head = words[words.length - 1];
  return { words, head, mods: words.slice(0, -1), ko: /[가-힣]/.test(head), joined: words.join('') };
}

/** 줄 말 p 가 물건 q 와 몸통이 같은가 → 같으면 몸통 밖으로 남는 앞부분(붙여 쓴 꾸밈말), 아니면 null */
function sameHead(q: Head, p: Head): Same | null {
  if (q.head === p.head) return { qPre: '', pPre: '' };
  if (!q.ko || !p.ko) return null;
  if (p.head.length >= 2 && q.head.endsWith(p.head)) return { qPre: q.head.slice(0, -p.head.length), pPre: '' };
  if (q.head.length >= 2 && p.head.endsWith(q.head)) return { qPre: '', pPre: p.head.slice(0, -q.head.length) };
  if (q.head.length >= 2 && p.joined.endsWith(q.head) && p.joined.length > q.head.length) return { qPre: '', pPre: p.joined.slice(0, -q.head.length), whole: true };
  return null;
}

function makeHeadIndex(rows: IconRow[], reps: Record<string, string>): (text: string) => Found | null {
  const items = rows.map((r) => {
    const kws = new Set(r.keywords.map(normIcon).filter(Boolean));
    const ps: Phrase[] = [];
    for (const t of new Set(r.phrases.map(normIcon).filter(Boolean))) {
      const h = headOf(t);
      if (h) ps.push({ t, kw: kws.has(t), ...h });
    }
    return { file: r.file, ps, name: ps[0]?.joined.length ?? 99 };
  });
  const df = new Map<string, number>();
  for (const it of items) for (const w of new Set(it.ps.flatMap((p) => p.words))) df.set(w, (df.get(w) ?? 0) + 1);
  const N = items.length || 1;
  const wt = (w: string) => Math.log(1 + N / (df.get(w) || 0.5));
  const modScore = (q: Head, p: Phrase, h: Same) => {
    const pm = h.whole ? [h.pPre] : [...p.mods, ...(h.pPre ? [h.pPre] : [])];
    const qm = [...q.mods, ...(h.qPre ? [h.qPre] : [])];
    const qj = qm.join('');
    const pj = pm.join('');
    let hit = 0;
    let pOnly = 0;
    let qOnly = 0;
    const inQ = (w: string, whole: boolean) => qm.includes(w) || (w.length >= 2 ? /[가-힣]/.test(w) && qj.includes(w) : whole && qm.some((x) => x.startsWith(w)));
    const inP = (w: string) => pm.includes(w) || (w.length >= 2 && /[가-힣]/.test(w) && pj.includes(w)) || pm.some((x) => x.length === 1 && w.startsWith(x));
    pm.forEach((w, i) => (inQ(w, !h.whole && i < p.mods.length) ? (hit += wt(w)) : (pOnly += wt(w))));
    for (const w of qm) if (!inP(w)) qOnly += (isMod(w) || !/[가-힣]/.test(w) ? 1 : HEAD_EXTRA / Q_EXTRA) * wt(w);
    if (h.qPre && !pm.includes(h.qPre) && !pj.includes(h.qPre)) qOnly += (HEAD_EXTRA / Q_EXTRA) * wt(h.qPre);
    return { s: hit - HEAD_EXTRA * pOnly - Q_EXTRA * qOnly, hit, plain: pm.length === 0 && p.kw };
  };
  const find = (text: string): Found | null => {
    const q = headOf(text);
    if (q && GENERIC.has(q.head) && q.mods.length) {
      // 표의 말과 똑같으면(구급 상자·선물 상자) 그것. 아니면 뒤에 붙은 그런 말을 다 떼고(낚시 도구 세트 → 낚시) 찾음
      // (없으면 공통 그림 — 「도구 세트」만 맞아 해부 도구 세트로, 「키트」만 맞아 양초 키트로 가지 않게)
      const whole = findIn(q, false);
      if (whole && whole.s >= 1e6) return whole;
      const words = [...q.words];
      while (words.length > 1 && GENERIC.has(words[words.length - 1])) words.pop();
      if (words.length === q.words.length || GENERIC.has(words[words.length - 1])) return null;
      const rest = findIn(headOf(words.join(' ')), true);
      if (rest && (rest.hit || rest.plain)) return rest;
      if (MACHINE.has(q.head) && /[가-힣]$/.test(words[words.length - 1])) return { file: '', s: 0, hit: 0, plain: false, isRep: 0, name: 0, retry: [...words.slice(0, -1), words[words.length - 1] + '기'].join(' ') };
      return null;
    }
    return findIn(q, true);
  };
  function findIn(q: Head | null, useRep: boolean): Found | null {
    if (!q) return null;
    const r = reps[q.words.join(' ')];
    if (r) return { file: r, s: 1e9, hit: 1, plain: true, isRep: 1, name: 0 };
    let best: Found | null = null;
    for (const it of items) {
      let top: { s: number; hit: number; plain: boolean } | null = null;
      for (const p of it.ps) {
        if (p.joined === q.joined) {
          top = { s: 1e6, hit: 1, plain: true };
          break;
        }
        const h = sameHead(q, p);
        if (!h) continue;
        const m = modScore(q, p, h);
        if (!top || m.s > top.s) top = m;
      }
      if (!top) continue;
      const isRep = reps[q.head] === it.file ? 1 : 0;
      const better = !best || top.s > best.s + 1e-9 || (Math.abs(top.s - best.s) <= 1e-9 && (isRep > best.isRep || (isRep === best.isRep && it.name < best.name)));
      if (better) best = { file: it.file, ...top, isRep, name: it.name };
    }
    // 꾸밈말이 하나도 안 맞았으면 몸통 말 하나로 된 그림일 때만 — 아니면 그 몸통 말의 대표 그림(생체 신호 은폐 패치 → 패치 대표), 대표도 없으면 쓰지 않음
    const repOf = (): Found | null => (useRep && !GENERIC.has(q.head) && reps[q.head] ? { file: reps[q.head], s: 0, hit: 0, plain: true, isRep: 1, name: 0 } : null);
    if (!best) return repOf();
    // 꾸밈말이 하나도 안 맞고 대표 그림도 없으면 — 전에는 공통 그림(상자)으로 갔다. 2026-11-09 사용자: 그림이 3천 장인데 「기본 지급용 재킷」이 상자로 나오면 안 된다
    // → 몸통 말이 같은 그림 가운데 군말이 가장 적은 것(같은 종류 물건)을 쓴다. 몸통 말이 아예 안 맞을 때만 공통 그림
    if (!best.hit && !best.plain && q.mods.length + (best.qPre ? 1 : 0) > 0) return repOf() ?? (useRep ? best : null);
    return best;
  }
  return find;
}

/** 대체 표 적용: 몸통 말(끝의 키트·세트 같은 말은 건너뜀)을 바꾼다. 통째로 표에 있으면 통째로 */
function aliased(text: string): string {
  const n = normIcon(text);
  if (!n) return '';
  if (aliases[n]) return aliases[n];
  const q = headOf(n);
  if (!q) return n;
  let idx = q.words.length - 1;
  while (idx > 0 && GENERIC.has(q.words[idx])) idx--;
  // 「영양 바」처럼 두 낱말 말도 (끝 두 낱말)
  if (idx > 0 && aliases[`${q.words[idx - 1]} ${q.words[idx]}`]) return [...q.words.slice(0, idx - 1), aliases[`${q.words[idx - 1]} ${q.words[idx]}`], ...q.words.slice(idx + 1)].join(' ');
  if (aliases[q.words[idx]]) return [...q.words.slice(0, idx), aliases[q.words[idx]], ...q.words.slice(idx + 1)].join(' ');
  return n;
}

const KIND_MIN = 0.25; // 종류 안에서 가장 가까운 그림을 고를 때의 조각 점수 하한 (같은 종류라 느슨하게)

export interface IconIndexOpts {
  /** 종류 → 대표 그림 (③) */
  base?: Record<string, string>;
}

/** 표 → match(name, icon) → { file, score } | null (null 이면 공통 그림). rep: 몸통 말 → 대표 그림. icon 은 「종류/물건말」 또는 낱말 */
export function makeIconIndex(rows: IconRow[], rep: Record<string, string> = {}, opts: IconIndexOpts = {}): (name: string, icon?: string) => IconHit | null {
  const reps: Record<string, string> = {};
  for (const [k, f] of Object.entries(rep)) reps[normIcon(k)] = f;
  const head = makeHeadIndex(rows, reps);
  const frag = makeFragIndex(rows, reps);
  const kinds = new Map<string, { head: (t: string) => Found | null; frag: (n: string, i?: string) => IconHit | null; files: Set<string> }>();
  const kindIndex = (k: string) => {
    let x = kinds.get(k);
    if (!x) {
      const sub = rows.filter((r) => r.kind === k);
      // 대표 그림도 그 종류 것만 (릴리스 점검 11-09: 무기/스프레이 → 다른 종류의 스프레이 대표가 붙었다)
      const files = new Set(sub.map((r) => r.file));
      const subReps = Object.fromEntries(Object.entries(reps).filter(([, f]) => files.has(f)));
      x = sub.length ? { head: makeHeadIndex(sub, subReps), frag: makeFragIndex(sub, subReps, KIND_MIN), files } : { head: () => null, frag: () => null, files };
      kinds.set(k, x);
    }
    return x;
  };
  const rank = (h: Found | null) => (!h ? 0 : h.s >= 1e6 ? 3 : h.hit > 0 ? 2 : 1);
  const hit = (h: Found | null): IconHit | null => (h ? { file: h.file, score: 1 } : null);
  const core = (name: string, word: string, K: ReturnType<typeof kindIndex> | null): IconHit | null => {
    const hi = word ? head(word) : null;
    const hn = name ? head(name) : null;
    // 장치·기계·도구를 떼고 「~기」로 다시 찾을 말 (경보 장치 → 경보기): 그 말로 처음부터 다시
    if (hi?.retry || hn?.retry) {
      const ok = (!hi?.retry && hi) || (!hn?.retry && hn);
      if (ok) return hit(ok);
      return (hn?.retry ? core(hn.retry, '', K) : null) || (hi?.retry ? core(hi.retry, '', K) : null) || frag(name, word);
    }
    // 이름이 표의 말과 똑같아도 종류를 알면 그 종류 그림일 때만 (앰플|의료 → 봉인 앰플로 가지 않게)
    if (rank(hn) === 3 && (!K || K.files.has(hn!.file))) return hit(hn);
    // 종류를 알면 그 종류 안에서: 물건말이 맞음 > 이름의 몸통 말이 맞음 > 물건말의 몸통만 맞음
    if (K) {
      const ki = word ? K.head(word) : null;
      const kn = name ? K.head(name) : null;
      const k = rank(ki) >= 2 ? ki : rank(kn) >= 1 ? kn : ki;
      // 종류 안에 없으면 다른 종류로 가지 않고 아래 ② 종류 안 비슷한 그림·③ 종류 대표로 (릴리스 점검 11-09: 앰플|의료/앰플 → 봉인 앰플)
      return hit(k);
    }
    // 둘 다 보고 더 확실한 쪽 (표의 말과 같음 > 꾸밈말까지 맞음 > 몸통만 맞음). 한국어 이름의 몸통 말이 맞으면 영어 그림 낱말보다 이름 (11-09: 스프레이 | canister 가 가스통으로 가지 않게)
    const koName = !!hn && hn.file !== '' && rank(hi) <= 1 && /[가-힣]/.test(name) && !/[가-힣]/.test(word); // 영어 낱말이 몸통만 맞았을 때만 (hand mirror 처럼 꾸밈말까지 맞으면 낱말)
    const h = koName || rank(hn) > rank(hi) || rank(hn) === 3 ? hn : hi || hn;
    if (h) return hit(h);
    return frag(name, word);
  };
  return (name0: string, icon?: string): IconHit | null => {
    const { kind, word: w0 } = splitIconWord(icon);
    // 원래 말이 표에 그대로 있으면 대체 표로 바꾸지 않는다 (릴리스 점검 11-09: 손전등 → 플래시라이트 → 케미컬 라이트)
    const keep = (t: string) => { const n = normIcon(t); return !!n && rank(head(n)) === 3; };
    const name = keep(name0) ? normIcon(name0) : aliased(name0);
    const word = keep(w0) ? normIcon(w0) : aliased(w0);
    const K = kind ? kindIndex(kind) : null;
    const found = core(name, word, K);
    if (found) return found;
    if (!K) {
      noteMiss({ name: name0, icon: icon ?? '', level: 'none', file: '' });
      return null;
    }
    // ② 종류 안에서 가장 가까운 그림 → ③ 종류 대표 그림
    const near = K.frag(name, word);
    if (near) {
      noteMiss({ name: name0, icon: icon ?? '', level: 'kind-near', file: near.file });
      return near;
    }
    const base = opts.base?.[kind];
    noteMiss({ name: name0, icon: icon ?? '', level: base ? 'kind-base' : 'none', file: base ?? '' });
    return base ? { file: base, score: 0 } : null;
  };
}
