// 소지품 이름 → 그림 파일 매칭 (표시 전용, 모델에는 넘기지 않음). 11-07.
// 순서: ① 키워드(고유·다른 이름, 한글·영어)가 이름에 들어 있으면 가장 긴 것
//       ② head(몸통 말) 맞고 feats(특징 말) 하나 이상 → 점수 높은 것 (같으면 종류 같은 것 → 대표)
//       ③ head만 맞음 → head_rep(몸통 말별 대표)   ④ 종류 base 그림
export function makeMatcher(table) {
  const rows = table.icons.filter(r => !r.excluded_note);
  const norm = s => String(s || '').toLowerCase().replace(/[\s()「」'"!·.,_-]+/g, ' ').trim();
  const kws = [];
  const rep = table.head_rep || {};
  // 몸통 말(head_rep에 있는 말)은 ①에서 쓰지 않음 → 특징 점수(②)·대표(③)로 감
  for (const r of rows) for (const k of r.keywords || []) { const n = norm(k); if (n.length >= 2 && !rep[n]) kws.push([n, r]); }
  kws.sort((a, b) => b[0].length - a[0].length);
  const fileOf = r => r.file; // merged_into 줄은 file이 대표 그림
  const base = {};
  for (const r of rows) if (r.base) base[r.kind] = fileOf(r);
  const has = (name, w) => { const n = norm(w); return n.length >= 1 && (` ${name} `.includes(` ${n} `) || (/[가-힣]/.test(n) && n.length >= 2 && name.includes(n)) || (/[가-힣]/.test(n) && n.length === 1 && ` ${name} `.includes(` ${n} `))); };
  return function match(itemName, kind) {
    const name = norm(itemName);
    if (!name) return kind && base[kind] ? { file: base[kind], how: 'base' } : null;
    for (const [k, r] of kws) if (has(name, k)) return { file: fileOf(r), how: 'keyword', key: k, name: r.name };
    let best = null;
    const heads = new Set();
    for (const r of rows) {
      const hs = (r.head || []).filter(h => has(name, h));
      if (!hs.length) continue;
      hs.forEach(h => heads.add(norm(h)));
      const f = (r.feats || []).filter(x => has(name, x)).length;
      if (!f) continue;
      const score = f * 10 + (kind && r.kind === kind ? 1 : 0);
      if (!best || score > best.score || (score === best.score && rep[norm(hs[0])] === fileOf(r))) best = { score, r };
    }
    if (best) return { file: fileOf(best.r), how: 'feature', name: best.r.name };
    const longest = [...heads].sort((a, b) => b.length - a.length)[0];
    if (longest && rep[longest]) return { file: rep[longest], how: 'head', key: longest };
    return kind && base[kind] ? { file: base[kind], how: 'base' } : null;
  };
}
