import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((f) => JSON.parse(readFileSync(f, 'utf8')));
let bad = 0;
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  // --loose: 수 칸을 감싸는 겹(ph-inline)과 읽어 주기 이름은 빼고 견준다 (틀을 하나로 맞추며 일부러 바꾼 곳)
const loose = process.argv.includes('--loose');
const norm0 = (h) => (loose ? h.replace(/<span class="ph-inline">/g, '').replace(/<\/span>/g, '').replace(/ aria-label="[^"]*"/g, '') : h);
const norm = (h0) => norm0(h0).replace(/<ul class="ms-sample">.*?<\/ul>/g, '').replace(/요청 약 [\d,]+토큰/g, '요청 약 N토큰').replace(/약 <b>[\d,]+토큰<\/b>/g, '');
  const x = norm(a[k]?.rows.html ?? ''), y = norm(b[k]?.rows.html ?? '');
  if (x === y) continue;
  bad++;
  let i = 0; while (i < x.length && x[i] === y[i]) i++;
  console.log(`DIFF ${k} at ${i}\n  A: ${x.slice(Math.max(0, i - 80), i + 160)}\n  B: ${y.slice(Math.max(0, i - 80), i + 160)}`);
}
console.log(bad ? `${bad} pages differ` : 'ALL SAME');
