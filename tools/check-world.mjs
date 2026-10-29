// 세계 데이터 대조: 원문 카드 로어북(JSON 덤프)에서 다섯 폴더(세력·요원·괴이·파밍·부록) 항목을 뺀 뒤
// withWorldLore 로 가상 항목을 만들어, 같은 이름 원문과 글이 같은지 본다 (공백·장식 줄 정규화 뒤).
// 사용법: node tools/check-world.mjs <lore.json>   (tools/migrate_world.py --check 가 만든다)
import { readFileSync } from 'node:fs';
import { withWorldLore, isVirtual } from '../dist-test/core.mjs';

const lore = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const folders = Object.fromEntries(lore.filter((e) => e.mode === 'folder').map((e) => [e.key, String(e.comment ?? '')]));
const WORLD = ['🌆세력', '🙂요원', '🚧괴이', '🎁파밍', '📎부록'];
const originals = new Map();
const base = [];
for (const e of lore) {
  const f = folders[e.folder] ?? '';
  if (e.mode !== 'folder' && WORLD.includes(f) && String(e.content ?? '').trim()) {
    originals.set(String(e.comment), { content: String(e.content), key: String(e.key ?? ''), folder: f });
    continue;
  }
  if (e.mode !== 'folder' && WORLD.includes(f)) continue; // 구분선
  base.push(e);
}
const ALIAS = { 협회: '특수재난대응협회', '이슬람 서울중앙성원': '이슬람', '발푸르기스 협회': '발푸르기스' };
const bodyOnly = (t) => t.split('\n').filter((l) => !/^#{3,6} /.test(l) && !/^\[Affiliation code: \w+\]$/.test(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim();
// 괴이 공통 머리말은 2026-10-27부터 기록마다 붙지 않고 요청의 괴이 묶음 앞에 한 번만 (records.ts activeAnomalyNote) → 원문에서 떼고 비교
const SIM_NOTE = /\n*\[Simulation-only\][^\n]*\n*/g;
const norm = (t) =>
  String(t)
    .replace(/\r/g, '')
    .replace(SIM_NOTE, '\n\n')
    .replace(/^\s*@@dont_activate[ \t]*\n/, '')
    .replace(/\n+---\s*$/, '')
    .replace(/ \{\{\/if\}\}/g, '{{/if}}')
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const out = withWorldLore(base);
const virt = new Map(out.filter((e) => isVirtual(e) && e.mode !== 'folder').map((e) => [String(e.comment), e]));
let ok = 0, bad = 0, missing = 0, keyDiff = 0, headOnly = 0, orderOnly = 0;
const lineBag = (t) => bodyOnly(t).split('\n').map((l) => l.trim()).filter(Boolean).sort().join('\n');
for (const [name, o] of originals) {
  const v = virt.get(ALIAS[name] ?? name);
  if (!v) {
    missing++;
    console.log(`없음: ${o.folder} ${name}`);
    continue;
  }
  const a = norm(o.content), b = norm(v.content);
  if (a === b) ok++;
  else if (bodyOnly(a) === bodyOnly(b)) headOnly++;
  else if (lineBag(a) === lineBag(b)) orderOnly++;
  else {
    bad++;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    console.log(`다름: ${o.folder} ${name}\n  원문: …${JSON.stringify(a.slice(Math.max(0, i - 80), i + 160))}\n  조립: …${JSON.stringify(b.slice(Math.max(0, i - 80), i + 160))}`);
  }
  const ka = o.key.split(',').map((x) => x.trim()).filter(Boolean).join(', ');
  const kb = String(v.key ?? '').split(',').map((x) => x.trim()).filter(Boolean).join(', ');
  if (ka !== kb) {
    keyDiff++;
    console.log(`키 다름: ${name}: ${JSON.stringify(ka)} → ${JSON.stringify(kb)}`);
  }
}
const known = new Set([...originals.keys()].map((n) => ALIAS[n] ?? n));
const extra = [...virt.keys()].filter((n) => !known.has(n));
if (extra.length) console.log('원문에 없는 가상 항목:', extra);
console.log(`같음 ${ok} · 제목 줄만 다름(칸 제목·##### 강등) ${headOnly} · 절 순서만 다름(같은 칸으로 모임) ${orderOnly} · 본문 다름 ${bad} · 없음 ${missing} · 키 다름 ${keyDiff} · 가상 전체 ${virt.size}`);
process.exit(bad || missing ? 1 : 0);
