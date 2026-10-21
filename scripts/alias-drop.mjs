// 명부 기본 별칭 정리 목록 만들기: 원본 카드(정리 전) 로어북에서 규칙에 걸리는 별칭을 뽑아 src/core/world/alias-drop.json에 쓴다.
// 사용법: node scripts/alias-drop.mjs <정리 전 경량 카드 로어북.json>   (먼저 npm run build). 원본 카드가 바뀔 때만 다시 돌린다
import { readFileSync, writeFileSync } from 'node:fs';
const core = await import(new URL('../dist-test/core.mjs', import.meta.url));
const raw = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const lore = Array.isArray(raw) ? raw : raw.globalLore;
const junk = core.junkAliases(lore);
writeFileSync(new URL('../src/core/world/alias-drop.json', import.meta.url), `${JSON.stringify(junk, null, 1)}\n`);
console.log(Object.fromEntries(Object.entries(junk).map(([k, v]) => [k, Object.values(v).flat().length])));
