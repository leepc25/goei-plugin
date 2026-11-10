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
function makeFragIndex(rows, rep, min = ICON_MIN) {
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
    return best && best.score >= min ? { file: best.file, score: best.score } : null;
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
  // 끝에 붙은 번호·용량(봉인 상자 1, 앰플 30ml, 생수 2L)은 몸통이 아님 → 뗌. 등급(C급·S등급·F)은 꾸밈말로 앞에 둠 (2026-11-09)
  const grade = [];
  while (words.length > 1) {
    const w = words[words.length - 1];
    if (/^\d+$/.test(w) || /^\d+[a-z]+$/.test(w)) words.pop();
    else if (/^(?:[a-z]|\d+)(?:등급|급|형)?$/.test(w)) grade.unshift(words.pop());
    else break;
  }
  words.unshift(...grade);
  if (!words.length) return null;
  return { words, head: words[words.length - 1], mods: words.slice(0, -1), ko: /[가-힣]/.test(words[words.length - 1]), joined: words.join('') };
}
/** 줄 말 p 가 물건 q 와 몸통이 같은가 → 같으면 몸통 밖으로 남는 앞부분(붙여 쓴 꾸밈말) { qPre, pPre }, 아니면 null */
function sameHead(q, p, pre = false) {
  if (q.head === p.head) return { qPre: '', pPre: '' };
  if (!q.ko || !p.ko) return null;
  // 표의 말이 「부채 도구」처럼 물건이 무엇인지 말하지 않는 말로 끝나면 그 끝 말로는 맞추지 않는다 (2026-11-10: 낚시도구·청소도구 → 부채)
  if (GENERIC.has(p.head)) return null;
  // 한국어 붙여 쓰기: 한쪽 몸통이 다른 쪽 끝을 두 글자 넘게 덮으면 같은 몸통 (손목시계 ↔ 시계, 표본병 ↔ 괴이 표본 병)
  if (p.head.length >= 2 && q.head.endsWith(p.head)) return { qPre: q.head.slice(0, -p.head.length), pPre: '' };
  if (q.head.length >= 2 && p.head.endsWith(q.head)) return { qPre: '', pPre: p.head.slice(0, -q.head.length) };
  if (q.head.length >= 2 && p.joined.endsWith(q.head) && p.joined.length > q.head.length) return { qPre: '', pPre: p.joined.slice(0, -q.head.length), whole: true };
  // 앞머리가 같은 말 (머그 ↔ 머그컵, 2026-11-10 사용자): 다른 길로 하나도 못 찾았을 때 마지막에만 본다 (pre)
  if (pre && q.head.length >= 2 && p.head.length > q.head.length && p.head.startsWith(q.head)) return { qPre: '', pPre: '', pre: true };
  return null;
}
function makeHeadIndex(rows, reps, pre = false) {
  const items = rows.map(r => {
    const kws = new Set((r.keywords ?? r.phrases).map(normIcon).filter(Boolean));
    const ps = [...new Set(r.phrases.map(normIcon).filter(Boolean))].map(t => ({ t, kw: kws.has(t), ...headOf(t) })).filter(p => p.words);
    return { file: r.file, ps, name: ps[0]?.joined.length ?? 99, words: new Set(ps.flatMap((p) => p.words)) };
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
    let q = headOf(text);
    // 붙여 쓴 「낚시도구·탐지장치」는 「낚시 도구」로 떼어 본다 (표에 그 말 그대로 있으면 그대로: 구급상자)
    if (q && q.ko && !GENERIC.has(q.head)) {
      const g = [...GENERIC].find((x) => /[가-힣]/.test(x) && q.head.length > x.length && q.head.endsWith(x));
      if (g) {
        const whole = findIn(q, false);
        if (whole && whole.s >= 1e6) return whole;
        q = headOf([...q.mods, q.head.slice(0, -g.length), g].join(' '));
      }
    }
    if (q && GENERIC.has(q.head) && q.mods.length) {
      // 키트·세트·장치처럼 물건이 무엇인지를 말하지 않는 몸통: 통째로 맞는 그림이 있으면 그것, 없으면 앞말(향초 세트 → 향초)로. 대표 그림은 쓰지 않음
      // 표의 말과 똑같으면(구급 상자·선물 상자) 그것. 아니면 뒤에 붙은 그런 말을 다 떼고(낚시 도구 세트 → 낚시) 찾고, 그래도 없으면 통째로 맞춘 것
      const whole = findIn(q, false);
      if (whole && whole.s >= 1e6) return whole;
      const words = [...q.words];
      while (words.length > 1 && GENERIC.has(words[words.length - 1])) words.pop();
      if (words.length === q.words.length || GENERIC.has(words[words.length - 1])) return null;
      const rest = findIn(headOf(words.join(' ')), true);
      // 군말을 떼고 찾은 것은 「그 말 그대로」가 아니다 (약상자 → 약 → 진통제 가 대체 말 「약상자 → 구급상자」를 막지 않게)
      if (rest && (rest.hit || rest.plain)) return { ...rest, kw: false, loose: true };
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
    if (r) return { file: r, s: 1e9, hit: 1, plain: true, kw: !!items.find((it) => it.file === r)?.ps.some((p) => p.kw && p.joined === q.joined) };
    let best = null;
    for (const it of items) {
      let top = null;
      for (const p of it.ps) {
        // 표 줄 말이 물건 말과 붙여 쓰기만 다르면 그대로 (sd카드 ↔ sd 카드)
        if (p.joined === q.joined) { top = { s: 1e6, hit: 1, plain: true, kw: p.kw }; break; }
        const h = sameHead(q, p, pre);
        if (!h) continue;
        const m = modScore(q, p, h);
        // 이 줄 말로는 꾸밈말이 안 맞았어도 그 그림의 다른 이름에 그 말이 있으면 맞은 것으로 (이빨나무 ↔ 「이빨 나무 가지」의 몸통 말 나무)
        const extra = [...q.mods, ...(h.qPre ? [h.qPre] : [])];
        const m2 = !m.hit && extra.some((w) => w.length >= 2 && it.words.has(w)) ? { ...m, s: m.s + 1, hit: 1e-3 } : m;
        if (!top || m2.s > top.s) top = { ...m2, more: extra.length > 0, ph: p.head };
      }
      if (!top) continue;
      const isRep = reps[q.head] === it.file || (!!top.ph && reps[top.ph] === it.file) ? 1 : 0;
      const better = !best || top.s > best.s + 1e-9 || (Math.abs(top.s - best.s) <= 1e-9 && (+!!top.kw > +!!best.kw || (!!top.kw === !!best.kw && (isRep > best.isRep || (isRep === best.isRep && it.name < best.name)))));
      if (better) best = { file: it.file, ...top, isRep, name: it.name };
    }
    const repOf = () => (useRep && !GENERIC.has(q.head) && reps[q.head] ? { file: reps[q.head], s: 0, hit: 0, plain: true } : null);
    if (!best) return repOf();
    // 꾸밈말이 하나도 안 맞았으면 몸통 말 하나로 된 그림일 때만 — 아니면 그 몸통 말의 대표 그림, 대표도 없으면 쓰지 않음
    // 꾸밈말이 하나도 안 맞고 대표 그림도 없으면 — 전에는 공통 그림(상자)으로 갔다. 2026-11-09 사용자: 그림이 3천 장인데 「기본 지급용 재킷」이 상자로 나오면 안 된다
    // → 몸통 말이 같은 그림 가운데 군말이 가장 적은 것(같은 종류 물건)을 쓴다. 몸통 말이 아예 안 맞을 때만 공통 그림
    if (!best.hit && !best.plain && q.mods.length + (best.qPre ? 1 : 0) > 0) return repOf() ?? (useRep ? best : null);
    return best;
  }
}
const MACHINE = new Set(['장치', '기계', '도구']);
/** 물건이 무엇인지 말하지 않는 몸통 말 (그 앞말이 물건) */
const GENERIC = new Set(['키트', 'kit', '세트', 'set', '장치', 'device', '도구', 'tool', '기계', 'machine', '용품', 'supply', '물품', '물건', 'item', '패키지', 'package', '묶음', 'pack', '상자', 'box']);

// ── 종류 (2026-11-09 사용자: 매칭기 재설계, src/core/iconmatch.ts 와 같음) ──
export const ICON_KIND_LABEL = { wear: '옷', food: '음식', tool: '도구', device: '기기', medical: '의료', consumable: '소모품', charm: '부적', weapon: '무기', paper: '서류', valuable: '귀중품', key: '열쇠', seal: '봉인', anomaly: '괴이', adult: '성인', body: '신체', misc: '잡동사니' };
const KIND_OF = {};
for (const [k, v] of Object.entries(ICON_KIND_LABEL)) (KIND_OF[v] = k), (KIND_OF[k] = k);
Object.assign(KIND_OF, { 의류: 'wear', 음식물: 'food', 장비: 'device', 기계: 'device', 약: 'medical', 의약: 'medical', 의료품: 'medical', 문서: 'paper', 종이: 'paper', 보석: 'valuable', 귀중: 'valuable', 잡화: 'misc', 기타: 'misc', clothes: 'wear', clothing: 'wear', medicine: 'medical', gadget: 'device', document: 'paper', etc: 'misc' });
export function splitIconWord(icon) {
  const raw = String(icon ?? '').trim();
  const words = (rest) => {
    const ps = rest.split(/\s*[/／|｜]\s*/).map((x) => x.trim()).filter(Boolean);
    const ko = ps.find((x) => /[가-힣]/.test(x));
    const en = ps.find((x) => !/[가-힣]/.test(x));
    return ko ? { word: ko, en: en ?? '' } : { word: en ?? '', en: '' };
  };
  const m = /^([^/／:：|｜]+?)\s*[/／:：|｜]\s*(.*)$/.exec(raw);
  if (m) { const k = KIND_OF[normIcon(m[1])]; if (k) return { kind: k, ...words(m[2]) }; }
  const k1 = KIND_OF[normIcon(raw)];
  if (k1) return { kind: k1, word: '', en: '' };
  return { kind: '', ...words(raw) };
}
export function parseIconAliases(text) {
  const out = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*([^→=:>]+?)\s*(?:→|=>|->|=|:)\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const a = normIcon(m[1]), b = normIcon(m[2]);
    if (a && b && a !== b) out[a] = b;
  }
  return out;
}
export const ICON_ALIAS_DEFAULT = ['외투 → 코트', '점퍼 → 재킷', '안정수 → 안정제', '캡슐 → 알약', '영양 바 → 에너지바', '영양바 → 에너지바', '숙취해소제 → 숙취 음료', '택배 → 택배 상자', '소설책 → 책', '알 → 계란', '하이라이터 → 형광펜', '다마고치 → 게임기', '인라인 → 인라인 스케이트', '선스틱 → 선크림', '곱창밴드 → 머리끈', '렌즈케이스 → 콘택트렌즈 통', '콘택트렌즈 → 콘택트렌즈 통', '약상자 → 구급상자', '나이프 → 칼', '정원가위 → 원예 가위', '전지가위 → 원예 가위', '간식 → 과자', '온수매트 → 전기장판', '종이가방 → 쇼핑백', '여행가방 → 캐리어', '햇반 → 즉석밥', '링거팩 → 링거', '인슐린 → 인슐린 펜', 'DVD → CD', '바 → 에너지바', '속옷 → 팬티', '내의 → 팬티'].join('\n');
let aliases = parseIconAliases(ICON_ALIAS_DEFAULT);
export function setIconAliases(text) { aliases = parseIconAliases(text && text.trim() ? text : ICON_ALIAS_DEFAULT); }
function aliased(text) {
  const n = normIcon(text);
  if (!n) return '';
  if (aliases[n]) return aliases[n];
  const q = headOf(n);
  if (!q) return n;
  let idx = q.words.length - 1;
  while (idx > 0 && GENERIC.has(q.words[idx])) idx--;
  if (idx > 0 && aliases[`${q.words[idx - 1]} ${q.words[idx]}`]) return [...q.words.slice(0, idx - 1), aliases[`${q.words[idx - 1]} ${q.words[idx]}`], ...q.words.slice(idx + 1)].join(' ');
  if (aliases[q.words[idx]]) return [...q.words.slice(0, idx), aliases[q.words[idx]], ...q.words.slice(idx + 1)].join(' ');
  return n;
}
/** 전체 찾기에서 빼는 종류 (옷/후드 → 본디지 마스크, 음식/알 → 고환). 괴이 그림은 이 세계의 보통 물건(가면·표본 병)이기도 해서 빼지 않는다 */
const SPECIAL_KIND = new Set(['adult', 'body']);
const KIND_MIN = 0.25;

/** rows: [{ keywords?, phrases, file, kind? }], rep: 몸통 말 → 대표 그림, opts.base: 종류 → 대표 그림 → match(name, icon) → { file, score } | null */
export function makeIconIndex(rows, rep = {}, opts = {}) {
  const reps = {};
  for (const [k, f] of Object.entries(rep)) reps[normIcon(k)] = f;
  // 전체에서 찾을 때는 보통 물건 그림만 본다 (2026-11-10 사용자: 보드게임 → 성인 보드게임, DVD → 성인 DVD, 케이지 → 정조 케이지 처럼 새지 않게).
  // 성인·신체 그림은 모델이 그 종류로 적었거나(종류 안 찾기), 종류를 안 적었고 이름이 그 그림의 이름 그대로일 때만
  const plainRows = rows.filter((r) => !SPECIAL_KIND.has(r.kind ?? ''));
  const plainFiles = new Set(plainRows.map((r) => r.file));
  const plainReps = Object.fromEntries(Object.entries(reps).filter(([, f]) => plainFiles.has(f)));
  const special = new Map();
  // 이름(첫 낱말 칸)이 그대로 같으면 종류를 뭐라고 적었든 그 그림 (2026-11-10 사용자: 소모품/콘돔 이 상자로 가면 안 된다)
  const specialName = new Map();
  for (const r of rows) {
    if (!SPECIAL_KIND.has(r.kind ?? '')) continue;
    for (const k of r.keywords ?? []) {
      const j = normIcon(k).replace(/ /g, '');
      if (j && !special.has(j)) special.set(j, r.file);
    }
    const n0 = normIcon((r.keywords ?? [])[0] ?? '').replace(/ /g, '');
    if (n0 && !specialName.has(n0)) specialName.set(n0, r.file);
    // 성인·신체 그림의 영어 이름은 몸통 말 칸에 있다 (condom, chastity cage) — 영어로 출력하는 사용자 대비 (2026-11-10 사용자)
    for (const k of r.phrases ?? []) {
      if (/[가-힣]/.test(k)) continue;
      const j = normIcon(k).replace(/ /g, '');
      if (j.length < 3) continue;
      if (!special.has(j)) special.set(j, r.file);
      if (!specialName.has(j)) specialName.set(j, r.file);
    }
  }
  // 맨 먼저: 물건 이름이나 물건말이 어느 그림의 이름과 그대로 같으면 그 그림. 종류를 뭐라고 적었든, 성인·신체 그림이든 (2026-11-10 사용자: 「원래 이름 같으면 나오고 그게 안 될 때를 대비해서 로직을 만드는 것」)
  // 같은 이름이 여러 종류에 있으면 적은 종류의 것
  const byName = new Map();
  for (const r of rows) {
    const n0 = normIcon((r.keywords ?? [])[0] ?? '').replace(/ /g, '');
    if (!n0) continue;
    const l = byName.get(n0) ?? [];
    l.push({ file: r.file, kind: r.kind ?? '' });
    byName.set(n0, l);
  }
  const exactName = (t, kind, same = false) => {
    const l = t ? byName.get(normIcon(t).replace(/ /g, '')) : undefined;
    if (!l) return null;
    const own = l.find((x) => x.kind === kind);
    // 물건말(그림 칸)만 같을 때는 적은 종류 안의 그림이거나 종류를 안 적었을 때만 — 이름이 「이상한 돌」이고 괴이/돌멩이 면 괴이 안에서 찾는다
    if (!own && same && kind) return null;
    return { file: (own ?? l[0]).file, score: 1 };
  };
  const headPlain = makeHeadIndex(plainRows, plainReps);
  const head = (t, sp = true) => {
    const h = headPlain(t);
    if (h && h.s >= 1e6) return h;
    const tj = normIcon(t).replace(/ /g, '');
    const mp = sp ? special : specialName;
    const f = mp.get(tj) ?? (/^[a-z0-9]+s$/.test(tj) ? mp.get(tj.replace(/s$/, '')) : undefined); // condoms → condom
    return f ? { file: f, s: 1e6, hit: 1, plain: true, isRep: 0, name: 0, kw: true } : h;
  };
  const frag = makeFragIndex(plainRows, plainReps);
  // 마지막 길: 앞머리가 같은 말 (머그 → 머그컵). 연어 마켓 제목 매칭(strict)에서는 안 쓴다 (은장 → 은장도)
  const headPre = makeHeadIndex(plainRows, plainReps, true);
  const pre = (t) => { const h = t ? headPre(t) : null; return h && h.file ? h : null; };
  const kinds = new Map();
  const kindIndex = (k) => {
    let x = kinds.get(k);
    if (!x) {
      const sub = rows.filter((r) => r.kind === k);
      // 대표 그림도 그 종류 것만 (릴리스 점검 11-09)
      const files = new Set(sub.map((r) => r.file));
      const subReps = Object.fromEntries(Object.entries(reps).filter(([, f]) => files.has(f)));
      x = sub.length ? { head: makeHeadIndex(sub, subReps), frag: makeFragIndex(sub, subReps, KIND_MIN), files, special: SPECIAL_KIND.has(k) } : { head: () => null, frag: () => null, files, special: SPECIAL_KIND.has(k) };
      kinds.set(k, x);
    }
    return x;
  };
  const rank = (h) => (!h ? 0 : h.s >= 1e6 ? 3 : h.hit > 0 ? 2 : 1);
  const hit = (h) => (h ? { file: h.file, score: 1 } : null);
  const core = (name, word, en, K, strict) => {
    const hi = word ? head(word, !K) : null, he = en ? head(en, !K) : null, hn = name ? head(name, !K) : null;
    if (hi?.retry || hn?.retry) {
      const ok = (!hi?.retry && hi) || (!hn?.retry && hn);
      if (ok) return hit(ok);
      return (hn?.retry ? core(hn.retry, '', en, K, strict) : null) || (hi?.retry ? core(hi.retry, '', en, K, strict) : null) || frag(name, word);
    }
    if (rank(hn) === 3 && (!K || K.files.has(hn.file))) return hit(hn);
    if (K) {
      // 종류 안에서 「~도구 → ~기」로 다시 찾으라는 답(retry)은 그림이 아니다 (도구/주방도구 가 상자로 가던 것)
      const kh = (t) => { const x = K.head(t); return x && x.file ? x : null; };
      const ki = word ? kh(word) : null, ke = en ? kh(en) : null, kn = name ? kh(name) : null;
      const k = rank(ki) >= 2 ? ki : rank(ke) >= 2 ? ke : rank(kn) >= 1 ? kn : ki || ke;
      // 종류 안에서 영어 낱말의 몸통만 맞은 것(novel → 성인 소설, medicine → 소화제)은 가장 약하다: 한글로 전체에서 찾은 것·앞머리가 같은 말이 먼저
      if (k && k === ke && rank(ke) === 1 && !ki && !kn) {
        const ko = (hi && hi.file ? hi : null) || (hn && hn.file ? hn : null) || (strict ? null : pre(word) || pre(name));
        if (ko) return hit(ko);
        const kf = frag(name, word);
        if (kf) return kf;
      }
      // 같은 말이 전체에서는 그대로 맞는데 종류 안에서는 덜 맞으면 전체 것 (2026-11-10 사용자: 도구/요가매트 → 커터 매트 가 아니라 요가 매트).
      // 그 말이 종류 안에 아예 없으면 종류 안 그림 그대로 (괴이/돌멩이 「이상한 돌」 → 눈 달린 돌)
      // 종류 안 그림이 그 말의 몸통만 맞고 나머지(요가·신용)는 못 맞췄을 때만. 말이 몸통뿐이면 종류 안 그림 그대로 (무기/스프레이 → 호신용 스프레이).
      // 다만 전체에 이름이 그 말 그대로인 그림이 있으면 그것 (도구/가위 → 뼈 절단 가위 가 아니라 가위).
      const lit = (h, kx) => !!kx && ((rank(kx) < 3 && kx.hit === 0 && !!kx.more && rank(h) === 3) || (!kx.kw && !!h?.kw));
      const same = lit(hi, ki) ? hi : lit(hn, kn) ? hn : lit(he, ke) ? he : null;
      // 성인·신체로 적었으면 그 종류 안 그림이 먼저 (성인/집게 → 고기 집게 가 아니라 니플 클램프)
      if (k && same && same.file !== k.file && !K.special) return hit(same);
      if (k) return hit(k);
      // 종류 안에 없으면 전체에서 물건말(한글 → 영어) → 이름. 없으면 종류 대표 (2026-11-10)
      // 영어 낱말의 몸통만 맞은 것은 맨 뒤 (한약/herbal medicine → 감기약 이 아니라 한약 봉지)
      const g = rank(hi) >= 2 ? hi : rank(he) >= 2 ? he : hi || hn;
      if (g && g.file) return hit(g);
      const soft = strict ? null : hit(pre(word) || pre(name)) || frag(name, word);
      return soft || (he && he.file ? hit(he) : null);
    }
    const koName = !!hn && hn.file !== '' && rank(hi) <= 1 && /[가-힣]/.test(name) && !/[가-힣]/.test(word); // 영어 낱말이 몸통만 맞았을 때만 (hand mirror 처럼 꾸밈말까지 맞으면 낱말)
    const h = koName || rank(hn) > rank(hi) || rank(hn) === 3 ? hn : hi || hn;
    if (h) return hit(h);
    if (he) return hit(he);
    return frag(name, word) || (strict ? null : hit(pre(word) || pre(name)));
  };
  // ── 분류 말 (2026-11-10 사용자: 「과자·다과·간식」처럼 세부 이름이 아닌 말은 그 분류 안에서 뽑아 보여 준다. 대·중·소분류 단계마다 매칭 단어) ──
  const flat = (t) => normIcon(t).replace(/ /g, '');
  const groups = new Map();
  for (const r of rows) for (const u of r.up ?? []) {
    const f = flat(u);
    const l = groups.get(f) ?? [];
    l.push({ file: r.file, kind: r.kind ?? '' });
    groups.set(f, l);
  }
  const sameMap = opts.same ?? {};
  const cats = opts.cats ? new Set(opts.cats.map(flat)) : null;
  /** 말 → 그 분류의 그림들과 분류 이름 (그 말이 분류 이름이거나 같은 뜻 말일 때) */
  const members = (t) => {
    const n = normIcon(t);
    if (!n) return null;
    // 영어는 복수형도 (snacks → snack, candies → candy, boxes → box)
    const f0 = flat(n);
    const singular = /^[a-z0-9]+$/.test(f0) ? [f0.replace(/ies$/, 'y'), f0.replace(/es$/, ''), f0.replace(/s$/, '')].filter((x) => x !== f0 && x.length >= 3) : [];
    for (const c of [f0, aliases[n] ? flat(aliases[n]) : '', ...singular]) {
      if (!c) continue;
      const cat = sameMap[c];
      if (cat?.startsWith('@')) return { ms: rows.filter((r) => r.kind === cat.slice(1)).map((r) => ({ file: r.file, kind: r.kind ?? '' })), cat: '' };
      const g = cat ? flat(cat) : c;
      if (groups.has(g) && (!cats || cats.has(g))) return { ms: groups.get(g), cat: cat ?? '' };
    }
    return null;
  };
  const POOL_SKIP = new Set(['adult', 'body', 'anomaly']);
  /** 성인·신체·괴이로 적었으면 그 종류 것, 아니면 보통 그림만 (보통 그림이 절반이 안 되는 분류 — 성인용품 — 는 그대로) */
  const poolOf = (ms, kind) => {
    const own = POOL_SKIP.has(kind) ? ms.filter((x) => x.kind === kind) : [];
    const plain = ms.filter((x) => !POOL_SKIP.has(x.kind));
    const use = own.length ? own : plain.length * 2 >= ms.length ? plain : ms;
    return [...new Set(use.map((x) => x.file))].sort();
  };
  const base = (name0, icon, strict) => {
    const { kind, word: w0, en } = splitIconWord(icon);
    const K = kind ? kindIndex(kind) : null;
    const keep = (t) => { const n = normIcon(t); if (!n) return false; const h = head(n, !kind); return (rank(h) === 3 && !h.loose && (!!h.kw || h.s >= 1e9)) || (!!K && ((x) => rank(x) === 3 && !x.loose)(K.head(n))); }; // 표(전체는 이름, 적은 종류 안은 몸통 말까지)에 그대로 있는 말은 대체하지 않는다
    const ex = exactName(name0, kind) ?? exactName(w0, kind, true);
    if (ex) return ex;
    const name = keep(name0) ? normIcon(name0) : aliased(name0);
    const word = keep(w0) ? normIcon(w0) : aliased(w0);
    const found = core(name, word, normIcon(en), K, !!strict);
    if (found) return found;
    return null; // 못 찾으면 상자 (종류 대표 그림 없앰, 2026-11-10 사용자)
  };
  return (name0, icon, strict) => {
    const hit0 = base(name0, icon, strict);
    if (strict) return hit0;
    const { kind, word: w0, en } = splitIconWord(icon);
    const kindOnly = kind ? ICON_KIND_LABEL[kind] ?? '' : '';
    // ① 물건 이름이 분류 말
    let g = members(name0);
    // 이름이 어느 그림의 이름 그대로면 그림 칸에 분류 말을 적었어도 그 그림 (콘돔 | 음식/과자 → 콘돔)
    if (!g && !exactName(name0, kind)) {
      // ② 그림 칸의 물건말(한글 → 영어 낱말)이 분류 말: 이름의 몸통 말로 찾은 그림이 있으면 그 그림이 먼저
      //    (새우깡 | 음식/과자 → 새우과자, 현장용 차폐 스프레이 | canister → 스프레이), 이름으로 못 찾을 때만 분류에서 뽑는다
      g = (normIcon(name0) !== normIcon(w0) ? members(w0) : null) ?? (en ? members(en) : null);
      if (g) {
        const byNameOnly = base(name0, kindOnly, false);
        if (byNameOnly && byNameOnly.score >= 1) return g.ms.some((x) => x.file === byNameOnly.file) ? byNameOnly : hit0;
      }
    }
    if (!g) return hit0;
    const pool = poolOf(g.ms, kind);
    if (pool.length < 2) return hit0;
    // 같은 뜻 말(다과)이면 그 분류(과자)의 대표 그림이 기본
    const first = (g.cat ? base(g.cat, kindOnly, false) : null) ?? hit0;
    return { file: first?.file ?? pool[0], score: first?.score ?? 1, pool };
  };
}

/** icons.json 표 → match(name, icon) → 그림 파일 (없으면 공통 그림 common) */
export function makeMatcher(table, common) {
  const rows = table.icons.filter(r => !r.excluded_note && typeof r.file === 'string')
    .map(r => ({ file: r.file, keywords: r.keywords || [], phrases: [...(r.keywords || []), ...(r.head || [])], kind: r.kind, up: r.up }));
  const fallback = common ?? table.icons.find(r => r.base && r.kind === 'misc')?.file ?? null;
  const base = {};
  for (const r of table.icons) if (r.base && typeof r.kind === 'string') base[r.kind] = r.file;
  const m = makeIconIndex(rows, table.head_rep, { base, same: table.up_same, cats: table.up_cats });
  return (name, icon) => m(name, icon)?.file ?? fallback;
}

/** 분류 그림들 가운데 물건마다 하나 (물건 id 로 고정). 그림이 늘어도 되도록 「그림마다 점수를 매겨 가장 높은 것」 — 새 그림이 이길 때만 바뀐다 */
export function pickIconFromPool(pool, seed) {
  let best = pool[0];
  let top = -1;
  for (const f of pool) {
    let h = 2166136261;
    const t = `${seed}|${f}`;
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
    const v = (h ^ (h >>> 15)) >>> 0;
    if (v > top) (top = v), (best = f);
  }
  return best;
}
