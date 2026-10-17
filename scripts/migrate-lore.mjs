// 경량 카드 만들 때: 로어북 목록(JSON)을 카드 명부로 옮기고, 🏷️Tag·📜Faction에 새 세력 자리표시자를 넣는다. 플러그인과 같은 코드(dist-test/core.mjs)를 쓴다.
// 사용법: node scripts/migrate-lore.mjs <in.json> <out.json>   (먼저 npm run build)
// 비교:   node scripts/migrate-lore.mjs --compare <원본.json> <경량.json>  → 상황판·이름 찾기·명부가 같은지
import { readFileSync, writeFileSync } from 'node:fs';
const core = await import(new URL('../dist-test/core.mjs', import.meta.url));
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
if (process.argv[2] === '--compare') {
  const a = read(process.argv[3]);
  const b = read(process.argv[4]);
  const sort = (x) => (Array.isArray(x) ? x.map(sort) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])])) : x);
  const j = (x) => JSON.stringify(sort(x));
  const da = core.readDirectory(a);
  const db = core.readDirectory(b);
  const out = {
    catalog: j(core.parseCatalog(a)) === j(core.parseCatalog(b)),
    registry: j(core.buildRegistry(a).entries) === j(core.buildRegistry(b).entries),
    agents: j(da.agents) === j(db.agents),
    orgs: j(da.orgs) === j(db.orgs),
    saved: db.saved,
    counts: [db.anomalies.length, db.sites.length, db.agents.length, db.orgs.length],
  };
  console.log(JSON.stringify(out));
} else {
  const lore = read(process.argv[2]);
  const r = core.withFactionPlaceholders(core.migrateLore(lore));
  if (r.missing.length) throw new Error(`새 세력 자리표시자를 넣을 곳을 못 찾음: ${r.missing.join(', ')}`);
  writeFileSync(process.argv[3], JSON.stringify(r.lore));
}
