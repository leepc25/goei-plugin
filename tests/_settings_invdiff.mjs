import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
let bad = 0;
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const norm = (h) => h.replace(/<ul class="ms-sample">.*?<\/ul>/g, '').replace(/요청 약 [\d,]+토큰/g, '요청 약 N토큰').replace(/약 <b>[\d,]+토큰<\/b>/g, '');
  const x = norm(a[k]?.rows.html ?? ''), y = norm(b[k]?.rows.html ?? '');
  if (x === y) continue;
  bad++;
  let i = 0; while (i < x.length && x[i] === y[i]) i++;
  console.log(`DIFF ${k} at ${i}\n  A: ${x.slice(Math.max(0, i - 80), i + 160)}\n  B: ${y.slice(Math.max(0, i - 80), i + 160)}`);
}
console.log(bad ? `${bad} pages differ` : 'ALL SAME');
