// 소지품 이름 → 그림 파일 매칭 (표시 전용, 모델에는 넘기지 않음). 11-07 다시 짬. src/core/datapack.ts matchItemIcon 과 같은 규칙.
// 물건이 「무엇」인지 = 몸통 말(한국어·영어 모두 끝 낱말)부터 맞춘다. 꾸밈말은 같은 몸통 안에서 고를 때만 쓴다.
// ① 몸통 단계: 그림 찾기 낱말(영어 icon)과 물건 이름 각각으로
//    - 후보 = 몸통 말이 같은 줄 (한국어는 붙여 쓴 것도: 야간투시경 ↔ 야간 투시경, 표본병 ↔ 괴이 표본 병, 봉지라면 → 라면)
//    - 점수 = 맞은 꾸밈말 무게 − HEAD_EXTRA × 줄에만 있는 꾸밈말 무게 (무게 = 표에 드문 낱말일수록 큼). 물건 쪽에만 있는 꾸밈말(낡은·old)은 상태라 거의 안 봄
//    - 꾸밈말이 하나도 안 맞았는데 몸통 말 하나로 된 그림이 없으면(키트·상자처럼 저마다 다른 특수 물건뿐) 쓰지 않음 — 「침술 키트」가 양초 키트로 가지 않게
// ② 조각 단계: ①에서 못 찾으면 글자 조각 점수(아래 makeFragIndex). 성수 → 성수병, 방검복 → 방검 조끼 같은 것
// ③ 둘 다 못 찾으면 공통 그림.
export const ICON_MIN = 0.7; // 조각 단계에서 이보다 낮으면 공통 그림 (몸통 단계에서 못 찾은 것이라 엄하게 — 리버레이터가 성인용품으로, 침술 키트가 양초 키트로 가지 않게)
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

/** ② 글자 조각 점수. rows: [{ phrases: string[], file }], rep: 몸통 말 → 대표 그림 → match(name, icon) → { file, score } | null */
function makeFragIndex(rows, rep = {}) {
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
  /** 그림 찾기 낱말(있으면) → 안 맞으면 이름 → 둘 다 낮으면 null */
  return function match(name, icon) {
    const qn = query(name);
    const qi = query(icon);
    return (qi && pick(qn, qi)) || (qn && pick(qn, null)) || null;
  };
}

// ── ① 몸통 단계 ──
const HEAD_EXTRA = 1; // 줄에만 있는 꾸밈말을 깎는 몫 — 「선물 상자」가 이빨 요정 선물 상자로 가지 않게
const Q_EXTRA = 0.05; // 물건 쪽에만 있는 꾸밈말을 깎는 몫 (같은 점수를 가르는 정도)
const stem = w => (/^[a-z]+$/.test(w) && w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
/** 말 → { words, head, mods, ko, joined } (영어는 끝 s 뗌) */
function headOf(s) {
  const words = normIcon(s).split(' ').filter(Boolean).map(stem);
  // 끝에 붙은 번호(봉인 상자 1, 2)는 몸통이 아님
  while (words.length > 1 && /^\d+$/.test(words[words.length - 1])) words.pop();
  if (!words.length) return null;
  return { words, head: words[words.length - 1], mods: words.slice(0, -1), ko: /[가-힣]/.test(words[words.length - 1]), joined: words.join('') };
}
/** 줄 말 p 가 물건 q 와 몸통이 같은가 → 같으면 몸통 밖으로 남는 앞부분(붙여 쓴 꾸밈말) { qPre, pPre }, 아니면 null */
function sameHead(q, p) {
  if (q.head === p.head) return { qPre: '', pPre: '' };
  if (!q.ko || !p.ko) return null;
  // 한국어 붙여 쓰기: 한쪽 몸통이 다른 쪽 끝을 두 글자 넘게 덮으면 같은 몸통 (손목시계 ↔ 시계, 표본병 ↔ 괴이 표본 병)
  if (p.head.length >= 2 && q.head.endsWith(p.head)) return { qPre: q.head.slice(0, -p.head.length), pPre: '' };
  if (q.head.length >= 2 && p.head.endsWith(q.head)) return { qPre: '', pPre: p.head.slice(0, -q.head.length) };
  if (q.head.length >= 2 && p.joined.endsWith(q.head) && p.joined.length > q.head.length) return { qPre: '', pPre: p.joined.slice(0, -q.head.length), whole: true };
  return null;
}
function makeHeadIndex(rows, reps) {
  const items = rows.map(r => {
    const kws = new Set((r.keywords ?? r.phrases).map(normIcon).filter(Boolean));
    const ps = [...new Set(r.phrases.map(normIcon).filter(Boolean))].map(t => ({ t, kw: kws.has(t), ...headOf(t) })).filter(p => p.words);
    return { file: r.file, ps, name: ps[0]?.joined.length ?? 99 };
  });
  // 낱말 무게: 그 낱말이 든 줄이 드물수록 큼
  const df = new Map();
  for (const it of items) for (const w of new Set(it.ps.flatMap(p => p.words))) df.set(w, (df.get(w) || 0) + 1);
  const N = items.length || 1;
  const wt = w => Math.log(1 + N / (df.get(w) || 0.5));
  // 붙여 쓴 꾸밈말(qPre·pPre)은 그 안에 든 상대 낱말로 맞춘다 (방검 + 조끼 ↔ 방검조끼)
  const modScore = (q, p, h) => {
    const pm = h.whole ? [h.pPre] : [...p.mods, ...(h.pPre ? [h.pPre] : [])];
    const qm = [...q.mods, ...(h.qPre ? [h.qPre] : [])];
    const qj = qm.join(''), pj = pm.join('');
    let hit = 0, pOnly = 0, qOnly = 0;
    // 줄의 한 글자 꾸밈말은 물건 쪽 낱말 머리로도 맞춤 (목 ↔ 목이) — 붙여 쓴 몸통 앞부분(사다리의 사)은 아님
    const inQ = (w, whole) => qm.includes(w) || (w.length >= 2 ? /[가-힣]/.test(w) && qj.includes(w) : whole && qm.some(x => x.startsWith(w)));
    const inP = w => pm.includes(w) || (w.length >= 2 && /[가-힣]/.test(w) && pj.includes(w)) || pm.some(x => x.length === 1 && w.startsWith(x));
    pm.forEach((w, i) => (inQ(w, !h.whole && i < p.mods.length) ? (hit += wt(w)) : (pOnly += wt(w))));
    // 물건 쪽에만 있는 말: 한국어 상태 꾸밈말(끝 받침 ㄴ: 낡은·녹슨·검은·부서진)은 거의 안 보고, 나머지(목걸이 열쇠의 목걸이, 뼈 칼의 뼈)는 그 물건이 무엇인지라 줄에만 있는 말만큼 깎음
    for (const w of qm) if (!inP(w)) qOnly += (isMod(w) || !/[가-힣]/.test(w) ? 1 : HEAD_EXTRA / Q_EXTRA) * wt(w);
    // 붙여 쓴 몸통 앞부분(솔방울의 솔, 구급상자의 구급)은 상태가 아니라 그 물건이 무엇인지라 줄에 없으면 크게 깎음
    if (h.qPre && !pm.includes(h.qPre) && !pj.includes(h.qPre)) qOnly += (HEAD_EXTRA / Q_EXTRA) * wt(h.qPre);
    // plain = 몸통 말 하나로 된 키워드 (표의 「몸통」 칸에서 온 말은 특수 물건에 붙은 것이라 아님)
    return { s: hit - HEAD_EXTRA * pOnly - Q_EXTRA * qOnly, hit, plain: pm.length === 0 && p.kw };
  };
  /** q → { file, s, hit, plain } | null (몸통이 같은 줄 중 가장 나은 것) */
  return function find(text) {
    const q = headOf(text);
    if (q && GENERIC.has(q.head) && q.mods.length) {
      // 키트·세트·장치처럼 물건이 무엇인지를 말하지 않는 몸통: 통째로 맞는 그림이 있으면 그것, 없으면 앞말(향초 세트 → 향초)로. 대표 그림은 쓰지 않음
      // 표의 말과 똑같으면(구급 상자·선물 상자) 그것. 아니면 뒤에 붙은 그런 말을 다 떼고(낚시 도구 세트 → 낚시) 찾고, 그래도 없으면 통째로 맞춘 것
      const whole = findIn(q, false);
      if (whole && whole.s >= 1e6) return whole;
      const words = [...q.words];
      while (words.length > 1 && GENERIC.has(words[words.length - 1])) words.pop();
      if (words.length === q.words.length || GENERIC.has(words[words.length - 1])) return null;
      const rest = findIn(headOf(words.join(' ')), true);
      if (rest && (rest.hit || rest.plain)) return rest;
      // 장치·기계·도구 = 「~기」 (경보 장치 → 경보기, 탐지 장치 → 탐지기)
      if (MACHINE.has(q.head) && /[가-힣]$/.test(words[words.length - 1])) return { retry: [...words.slice(0, -1), words[words.length - 1] + '기'].join(' ') };
      return null;
    }
    return findIn(q, true);
  };
  function findIn(q, useRep) {
    if (!q) return null;
    // 말 그 자체가 대표 그림의 몸통 말이면 대표 (방패 → 진압 방패, 거울 → 거울)
    const r = reps[q.words.join(' ')];
    if (r) return { file: r, s: 1e9, hit: 1, plain: true };
    let best = null;
    for (const it of items) {
      let top = null;
      for (const p of it.ps) {
        // 표 줄 말이 물건 말과 붙여 쓰기만 다르면 그대로 (sd카드 ↔ sd 카드)
        if (p.joined === q.joined) { top = { s: 1e6, hit: 1, plain: true }; break; }
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
    const repOf = () => (useRep && !GENERIC.has(q.head) && reps[q.head] ? { file: reps[q.head], s: 0, hit: 0, plain: true } : null);
    if (!best) return repOf();
    // 꾸밈말이 하나도 안 맞았으면 몸통 말 하나로 된 그림일 때만 — 아니면 그 몸통 말의 대표 그림, 대표도 없으면 쓰지 않음
    if (!best.hit && !best.plain && q.mods.length + (best.qPre ? 1 : 0) > 0) return repOf();
    return best;
  }
}
const MACHINE = new Set(['장치', '기계', '도구']);
/** 물건이 무엇인지 말하지 않는 몸통 말 (그 앞말이 물건) */
const GENERIC = new Set(['키트', 'kit', '세트', 'set', '장치', 'device', '도구', 'tool', '기계', 'machine', '용품', 'supply', '물품', '물건', 'item', '패키지', 'package', '묶음', 'pack', '상자', 'box']);

/** rows: [{ keywords?, phrases, file }], rep: 몸통 말 → 대표 그림 → match(name, icon) → { file, score } | null */
export function makeIconIndex(rows, rep = {}) {
  const reps = {};
  for (const [k, f] of Object.entries(rep)) reps[normIcon(k)] = f;
  const head = makeHeadIndex(rows, reps);
  const frag = makeFragIndex(rows, rep);
  return function match(name, icon) {
    // 장치·기계·도구를 떼고 「~기」로 다시 찾을 말 (경보 장치 → 경보기): 그 말로 처음부터 다시
    const again = (x) => (x?.retry ? match(x.retry, '') : null);
    const ri = icon ? head(icon) : null, rn = name ? head(name) : null;
    if (ri?.retry || rn?.retry) {
      const hit = (!ri?.retry && ri) || (!rn?.retry && rn);
      if (hit) return { file: hit.file, score: 1 };
      return again(rn) || again(ri) || frag(name, icon);
    }
    // 낱말·이름 둘 다 보고 더 확실한 쪽: 표의 말과 같음 > 꾸밈말까지 맞음 > 몸통만 맞음 (같으면 낱말). kukri knife 이 식칼로 가지 않고 이름 「쿠크리」로
    const rank = h => (!h ? 0 : h.s >= 1e6 ? 3 : h.hit > 0 ? 2 : 1);
    const hi = icon ? head(icon) : null, hn = name ? head(name) : null;
    const h = rank(hn) > rank(hi) || rank(hn) === 3 ? hn : hi || hn; // 둘 다 표의 말과 같으면 이름 (염소 가면 | goat mask → 염소 가면)
    if (h) return { file: h.file, score: 1 };
    return frag(name, icon);
  };
}

/** icons.json 표 → match(name, icon) → 그림 파일 (없으면 공통 그림 common) */
export function makeMatcher(table, common) {
  const rows = table.icons.filter(r => !r.excluded_note && typeof r.file === 'string')
    .map(r => ({ file: r.file, keywords: r.keywords || [], phrases: [...(r.keywords || []), ...(r.head || [])] }));
  const fallback = common ?? table.icons.find(r => r.base && r.kind === 'misc')?.file ?? null;
  const m = makeIconIndex(rows, table.head_rep);
  return (name, icon) => m(name, icon)?.file ?? fallback;
}
