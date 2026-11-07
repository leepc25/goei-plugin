// 소지품 이름 → 그림 파일 매칭 (표시 전용, 모델에는 넘기지 않음). 11-07 고침. src/core/datapack.ts matchItemIcon 과 같은 규칙.
// ① 모델이 쓴 「그림 찾기 낱말」(영어 icon) ② 물건 이름 — 둘 다 글자 조각 점수로 표의 줄과 견준다.
//   조각 = 한글은 띄어쓰기를 지운 뒤 한 글자·두 글자, 영어·숫자는 낱말. 조각마다 무게 = 표에 드문 조각일수록 큼(IDF).
//   점수 = 겹친 무게 / (겹친 무게 + A×물건 쪽 남는 무게 + B×줄 쪽 남는 무게) — 줄의 키워드·몸통 말 중 가장 높은 것.
//   이름에는 한국어 몸통이 끝에 온다는 것을 씀: 끝 말이 같으면 덤, 마지막 글자가 줄에 없으면 깎음.
//   짧은 낱말이 긴 이름 안에 끼어 먼저 잡히던 것(확성기 → 「성기」, 봉지라면 → 「지라」)은 나머지 조각이 안 맞아 점수가 낮다.
// ③ 가장 높은 점수가 낮으면(흔한 조각 「키트·세트·상자」만 맞음 등) 공통 그림.
export const ICON_MIN = 0.42; // 이보다 낮으면 공통 그림
// 물건 쪽 조각이 줄에 없으면 A, 줄 쪽 조각이 물건에 없으면 B 만큼 깎음 — 줄이 물건 이름을 다 덮으면(표본병 → 괴이 표본 병) 덜 깎임
const A = 0.7, B = 0.3;
// 그림 찾기 낱말이 있으면 그것으로 고르고, 이름은 같은 점수 근처를 가르는 데만 씀
const NAME_W = 0.2;
// 이름의 마지막 글자(몸통)가 줄에 없으면 깎음 — 위장복 → 위, 가죽 장갑 → 가죽 장부, 초코바 → 핫초코 같은 것
const HEAD_MISS = 0.65;
const TAIL = 0.15; // 이름의 끝 말(한국어는 몸통이 끝)이 같을 때 덤 (드문 끝 말일수록 큼). 그림 찾기 낱말에는 안 씀 — 「acupuncture kit」이 kit 로 끌려가지 않게

export const normIcon = s => String(s ?? '').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ' ').trim();

// 꾸밈말(뒤에 낱말이 더 오고 끝 글자 받침이 ㄴ: 속삭이는, 피 묻은, 녹슨, 감긴)은 무게를 줄인다 — 몸통이 아니라서
const isMod = wd => wd.length >= 2 && (wd.charCodeAt(wd.length - 1) - 0xac00) % 28 === 4;
const MOD_W = 0.5;

/** 조각 → 배수. 한글 덩어리(띄어쓰기 무시)는 한 글자·두 글자, 영어·숫자는 낱말(끝 s 뗌). tail = 끝 말 */
export function iconFrags(s) {
  const n = normIcon(s);
  const out = new Map();
  const put = (f, m) => out.set(f, Math.max(out.get(f) ?? 0, m));
  let tail = '', last = '';
  const parts = n.match(/[가-힣]+(?: +[가-힣]+)*|[0-9a-z]+/g) || [];
  for (const p of parts) {
    if (/[가-힣]/.test(p)) {
      const words = p.split(' ');
      const c = words.join('');
      const mult = [];
      words.forEach((wd, i) => { const m = i < words.length - 1 && isMod(wd) ? MOD_W : 1; for (const _ of wd) mult.push(m); });
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

/** rows: [{ phrases: string[], file }], rep: 몸통 말 → 대표 그림 → match(name, icon) → { file, score } | null */
export function makeIconIndex(rows, rep = {}) {
  const df = new Map();
  const reps = {};
  for (const [k, f] of Object.entries(rep)) reps[normIcon(k)] = f;
  const items = rows.map(r => {
    const ps = [...new Set(r.phrases.map(normIcon).filter(Boolean))].map(t => ({ t, ...iconFrags(t) })).filter(p => p.set.size);
    const all = new Set();
    for (const p of ps) for (const f of p.set.keys()) all.add(f);
    for (const f of all) df.set(f, (df.get(f) || 0) + 1);
    return { file: r.file, ps };
  });
  const N = items.length || 1;
  const idf = f => Math.log(1 + N / (df.get(f) || 0.5));
  const idfMax = Math.log(1 + N / 0.5);
  const sum = m => { let a = 0; for (const [f, x] of m) a += idf(f) * x; return a; };
  for (const it of items) for (const p of it.ps) p.w = sum(p.set);
  /** 줄 하나의 점수: 이름·키워드·몸통 말 중 가장 높은 것과 그 말 */
  const score = (q, it, tailOn) => {
    let best = 0, by = '';
    for (const p of it.ps) {
      let c = 0;
      for (const [f, x] of p.set) { const y = q.set.get(f); if (y) c += idf(f) * Math.min(x, y); }
      if (!c) continue;
      let s = c / (c + A * (q.w - c) + B * (p.w - c));
      if (tailOn) {
        if (q.tail && q.tail === p.tail) s += (TAIL * idf(q.tail)) / idfMax;
        if (q.last && !p.set.has(q.last)) s *= HEAD_MISS;
      }
      if (s > best) (best = s), (by = p.t);
    }
    return { s: best, by };
  };
  const query = s => {
    const q = iconFrags(s);
    q.w = sum(q.set);
    return q.set.size ? q : null;
  };
  const pick = (qn, qi) => {
    let best = null;
    for (const it of items) {
      const a = qn ? score(qn, it, true) : { s: 0, by: '' };
      const b = qi ? score(qi, it, false) : { s: 0, by: '' };
      const top = qi ? b.s : a.s;
      if (!top) continue;
      const total = qi ? b.s + NAME_W * a.s : a.s;
      // 같은 점수면 그 말의 대표 그림(head_rep)
      const isRep = reps[a.by] === it.file || reps[b.by] === it.file ? 1 : 0;
      if (!best || total > best.total + 1e-9 || (Math.abs(total - best.total) <= 1e-9 && isRep > best.isRep)) best = { file: it.file, total, score: top, isRep };
    }
    return best && best.score >= ICON_MIN ? { file: best.file, score: best.score } : null;
  };
  /** ① 그림 찾기 낱말(있으면) → 안 맞으면 ② 이름 → 둘 다 낮으면 null(공통 그림) */
  return function match(name, icon) {
    // 이름·낱말이 몸통 말 그 자체면 그 말의 대표 그림(head_rep: 방패 → 진압 방패, 거울 → 거울)
    const ri = reps[normIcon(icon)], rn = reps[normIcon(name)];
    if (ri) return { file: ri, score: 1 };
    if (rn) return { file: rn, score: 1 };
    const qn = query(name);
    const qi = query(icon);
    return (qi && pick(qn, qi)) || (qn && pick(qn, null)) || null;
  };
}

/** icons.json 표 → match(name, icon) → 그림 파일 (없으면 공통 그림 common) */
export function makeMatcher(table, common) {
  const rows = table.icons.filter(r => !r.excluded_note && typeof r.file === 'string')
    .map(r => ({ file: r.file, phrases: [...(r.keywords || []), ...(r.head || [])] }));
  const fallback = common ?? table.icons.find(r => r.base && r.kind === 'misc')?.file ?? null;
  const m = makeIconIndex(rows, table.head_rep);
  return (name, icon) => m(name, icon)?.file ?? fallback;
}
