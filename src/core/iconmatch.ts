// 소지품 이름 → 그림 파일 매칭 (2026-11-07 다시 짬). game-src/items/match_icon.mjs 와 같은 규칙 — 시험(tests/itemicons.test.mjs)이 둘을 맞대 봄. 설명은 그 파일 머리말.
// ① 몸통 단계: 몸통 말(끝 낱말)이 같은 그림만 후보 → 꾸밈말로 고름(줄에만 있는 말·물건이 무엇인지 말하는 말은 깎고, 낡은·녹슨 같은 상태 말은 거의 안 봄)
//    → 꾸밈말이 하나도 안 맞았는데 몸통 말 하나로 된 그림이 없으면 쓰지 않음 ② 글자 조각 점수 ③ 둘 다 못 찾으면 null(공통 그림)

/** 이름 비교용: 소문자, 한글·영어·숫자 말고는 띄어쓰기로 */
export const normIcon = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').trim();

export interface IconRow { file: string; keywords: string[]; phrases: string[] }
export interface IconHit { file: string; score: number }

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

function makeFragIndex(rows: IconRow[], reps: Record<string, string>): (name: string, icon?: string) => IconHit | null {
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
    return best && best.score >= ICON_MIN ? { file: best.file, score: best.score } : null;
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
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) words.pop(); // 끝 번호(봉인 상자 1)는 몸통이 아님
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

/** 표 → match(name, icon) → { file, score } | null (null 이면 공통 그림). rep: 몸통 말 → 대표 그림 */
export function makeIconIndex(rows: IconRow[], rep: Record<string, string> = {}): (name: string, icon?: string) => IconHit | null {
  const reps: Record<string, string> = {};
  for (const [k, f] of Object.entries(rep)) reps[normIcon(k)] = f;
  const head = makeHeadIndex(rows, reps);
  const frag = makeFragIndex(rows, reps);
  const rank = (h: Found | null) => (!h ? 0 : h.s >= 1e6 ? 3 : h.hit > 0 ? 2 : 1);
  const match = (name: string, icon?: string): IconHit | null => {
    const hi = icon ? head(icon) : null;
    const hn = name ? head(name) : null;
    // 장치·기계·도구를 떼고 「~기」로 다시 찾을 말 (경보 장치 → 경보기): 그 말로 처음부터 다시
    if (hi?.retry || hn?.retry) {
      const ok = (!hi?.retry && hi) || (!hn?.retry && hn);
      if (ok) return { file: ok.file, score: 1 };
      return (hn?.retry ? match(hn.retry, '') : null) || (hi?.retry ? match(hi.retry, '') : null) || frag(name, icon);
    }
    const h = rank(hn) > rank(hi) || rank(hn) === 3 ? hn : hi || hn;
    if (h) return { file: h.file, score: 1 };
    return frag(name, icon);
  };
  return match;
}
