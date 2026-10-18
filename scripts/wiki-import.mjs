// GPT가 쓴 위키 기본 문서(result_*.txt)를 검사해서 card/wiki-base.json에 모은다. 경량 카드 빌드가 이 파일을 카드 로어북 「📖위키」 폴더로 넣는다.
// 사용법: node scripts/wiki-import.mjs <카드 로어북.json> <result 파일...>   (먼저 npm run build)
// 같은 제목이 다시 오면 새 것으로 바꾼다. 검사에 걸린 문서는 넣지 않고 이유를 보여 준다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const core = await import(new URL('../dist-test/core.mjs', import.meta.url));
const root = new URL('../card/', import.meta.url);
const titles = JSON.parse(readFileSync(new URL('wiki-titles.json', root), 'utf8'));
const basePath = new URL('wiki-base.json', root);
const base = existsSync(basePath) ? JSON.parse(readFileSync(basePath, 'utf8')) : {};
const lore = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const reg = core.buildRegistry(lore);
const canon = (t) => core.canonicalTitle(reg, { char: { globalLore: lore }, chat: { message: [] } }, t).title;
const byTitle = new Map(titles.map((t) => [t.title, t]));
// 소문 문서에 나오면 공략을 적었을 가능성이 큰 말 (사람이 다시 본다)
const SPOILER = /(생존 규칙|생존 수칙|금지 행동|탈출 (조건|방법)|처치 방법|약점은|정답은|공략)/;
const META = /(로어북|롤플레이|프롬프트|캐릭터 카드|\bAI\b|등장인물|작중)/;
const prose = (b) => [...b.matchAll(/^\[(?:Paragraph|List|Quote)\](.*)$/gm)].map((m) => m[1]).join('').replace(/➡️|❗|✂️|📌/g, '').replace(/\s/g, '').length;
const report = { ok: [], warn: [], fail: [] };
for (const file of process.argv.slice(3)) {
  const text = readFileSync(file, 'utf8');
  const blocks = text.match(/<lightboard-namuwiki[\s>][\s\S]*?<\/lightboard-namuwiki>/g) ?? [];
  if (!blocks.length) report.fail.push(`${file}: 문서 블록이 없음`);
  for (const raw of blocks) {
    const asked = /doc_title="([^"]*)"/.exec(raw)?.[1]?.trim() ?? '';
    const t = byTitle.has(asked) ? asked : canon(asked);
    const info = byTitle.get(t);
    if (!info) {
      report.fail.push(`「${asked}」: 문서 목록에 없는 제목`);
      continue;
    }
    let body;
    try {
      body = core.acceptArticle(raw, t, canon);
    } catch (e) {
      report.fail.push(`${String(info.no).padStart(3, '0')} 「${t}」: ${e.message}`);
      continue;
    }
    const notes = [];
    const n = prose(body);
    if (n < 4000) notes.push(`본문 ${n}자 (짧음)`);
    if (info.kind === 'rumor' && SPOILER.test(body)) notes.push(`공략 표현: ${SPOILER.exec(body)[0]}`);
    if (META.test(body)) notes.push(`세계 밖 표현: ${META.exec(body)[0]}`);
    if (!/[✂📌]/u.test(body)) notes.push('드립(취소선·각주) 없음');
    base[t] = body;
    (notes.length ? report.warn : report.ok).push(`${String(info.no).padStart(3, '0')} 「${t}」 ${n}자${notes.length ? ' — ' + notes.join(', ') : ''}`);
  }
}
writeFileSync(basePath, JSON.stringify(base, null, 1));
const missing = titles.filter((t) => !base[t.title]).map((t) => `${String(t.no).padStart(3, '0')} ${t.title}`);
console.log(`통과 ${report.ok.length} · 확인 필요 ${report.warn.length} · 실패 ${report.fail.length} · 모인 문서 ${Object.keys(base).length}/${titles.length}`);
for (const k of ['fail', 'warn']) for (const line of report[k]) console.log(`[${k === 'fail' ? '실패' : '확인'}] ${line}`);
if (missing.length && missing.length < titles.length) console.log(`아직 없음 ${missing.length}개: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' …' : ''}`);
