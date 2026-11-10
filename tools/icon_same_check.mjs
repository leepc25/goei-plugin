// 같은 말 표(game-src/items/upper/_same.txt → icons.json up_same) 검사.
// 매칭기가 이미 어느 그림으로 찾아 주는 말(성수 → 성수병, 표본병 → 괴이 표본 병)은 분류 말로 쓰면 그 그림을 가리게 되므로 뺀다.
// 쓰기: python3 tools/icon_upper.py --apply && node tools/icon_same_check.mjs && python3 tools/icon_upper.py --apply
import { readFileSync, writeFileSync } from 'node:fs';
import { makeIconIndex } from '../game-src/items/match_icon.mjs';
const T = new URL('../game-src/items/icons.json', import.meta.url);
const table = JSON.parse(readFileSync(T, 'utf8'));
const live = table.icons.filter((r) => !r.excluded_note && typeof r.file === 'string');
const rows = live.map((r) => ({ file: r.file, keywords: r.keywords || [], phrases: [...(r.keywords || []), ...(r.head || [])], kind: r.kind }));
const base = makeIconIndex(rows, table.head_rep, {}); // 같은 말 표 없이
const nameOf = (f) => live.find((r) => r.file === f)?.name ?? f;
// _same.txt 의 원래 띄어쓰기로 찾아야 매칭기가 낱말을 나눈다
const src = readFileSync(new URL('../game-src/items/upper/_same.txt', import.meta.url), 'utf8');
const out = ['# tools/icon_same_check.mjs 가 쓴다. 매칭기가 이미 그림을 찾아 주는 말 → 그 그림 (분류 말로 쓰지 않음)'];
let n = 0;
for (const line of src.split('\n')) {
  if (!line.trim() || line.startsWith('#') || !line.includes(':')) continue;
  const [cat, right] = [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1)];
  const rep = cat.startsWith('@') ? null : table.head_rep[cat];
  for (const w0 of right.split(/\s+/).filter(Boolean)) {
    if (w0.startsWith('!')) continue;
    const w = w0.replace(/_/g, ' ');
    const h = base(w, '') ?? base(w.replace(/ /g, ''), '');
    // 찾은 그림의 이름·다른 이름과 글자가 겹칠 때만 (도검 한 자루 → 마대 자루 처럼 끝 낱말만 같은 것은 매칭기가 잘못 찾은 것이라 분류 말로 둔다)
    const f = w.replace(/ /g, '').toLowerCase();
    const rel = h && live.filter((r) => r.file === h.file).some((r) => r.keywords.some((k) => { const x = String(k).replace(/ /g, '').toLowerCase(); return /[가-힣]/.test(f) ? x.length >= 2 && (x.includes(f) || f.includes(x)) : x === f; })); // 영어는 그 말 그대로일 때만 (drink ⊂ soft drink can 은 그 그림을 가리키는 말이 아니다)
    if (h && h.score >= 1 && h.file !== rep && rel) { out.push(`${w0} → ${nameOf(h.file)}`); n++; }
  }
}
writeFileSync(new URL('../game-src/items/upper/_same_skip.txt', import.meta.url), out.join('\n') + '\n');
console.log(`매칭기가 이미 그림을 찾는 말 ${n}개를 _same_skip.txt 에 적음`);
