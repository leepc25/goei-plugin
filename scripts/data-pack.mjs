// 자료 팩 (QC 개선 나1): 본체(goei-body.js)에 번들하던 세계 자료(src/data/world/*.json)와 설치 자료(src/data/install/*.json)를
// 따로 받는 팩으로 만든다. 글 하나(JSON) → 200KB 조각(goei-data-<이름>.N.txt) + 목록(goei-data-<이름>.json).
// 본체에는 팩의 지문(hash·sha256·length)만 박혀 있어(scripts/build.mjs define) 자기와 맞는 자료만 쓴다.
// 빌드(scripts/build.mjs)와 시험 초기화(tests/data-init.mjs)가 같은 함수로 같은 글을 만든다.
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const readJson = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));

export const WORLD_PACK_NAME = 'goei-data-world';
export const INSTALL_PACK_NAME = 'goei-data-install';
/** 소지품 그림 팩 (2026-11-07): game-src/items/icons.json 매칭 표 + icons/*.png (85×85, 배경 없음) base64. 소지품 메뉴를 처음 열 때 받아 저장소에 둔다 (host/itemicons.ts) */
export const ITEMS_PACK_NAME = 'goei-data-items';
/** 내 모습 팩 (2026-11-07 사용자): 필드 인물 126명의 정면 대기 동작(game-pack/char-N/50.webp, 장마다 cw×ch 로 잘린 가로 줄) + 줄 측정값. 시작 패널 「내 모습」·소지품 인물 자리가 처음 그릴 때 받아 저장소에 둔다 (host/looks.ts) */
export const LOOKS_PACK_NAME = 'goei-data-looks';
/** 조각 하나의 상한 (Risu 웹 프록시는 1MB 넘는 파일을 못 받는다. 본체 조각과 같은 200KB) */
export const PART_BYTES = 200_000;

/** 세계 자료 팩 글: 종류별 기록(records)과 세력 관계(pairs·common). src/core/world/records.ts setWorldData 가 읽는 모양 */
export function worldPackText() {
  const kinds = { agent: 'agents', org: 'orgs', anomaly: 'anomalies', site: 'sites', appendix: 'appendices' };
  const out = { schema: 1, kind: 'world' };
  for (const [kind, file] of Object.entries(kinds)) out[kind] = readJson(`src/data/world/${file}.json`).records;
  const rel = readJson('src/data/world/relations.json');
  out.relations = { pairs: rel.pairs, common: rel.common };
  out.scenes = scenesData();
  return JSON.stringify(out);
}

/** 첫 장면 기본값 (2026-11-05 사용자: 첫 장면은 Risu 추가 첫 메시지가 아니라 플러그인이 넣는다).
 *  세력 공용 장면 = scenarios.json 의 opening 칸 + src/data/world/greetings.json 글(키 A00-ko-1 …, 카드 빌드가 씀), 인물별 장면 = src/data/world/scenes.json 「인물」.
 *  src/core/scenes.ts 가 읽는 모양: { 세력: { A00: { '1': { label, ko, en } } }, 인물: { P001: { ko, en } } } */
export function scenesData() {
  const sc = readJson('src/data/scenarios.json');
  const g = readJson('src/data/world/greetings.json');
  const text = (key) => (Number.isInteger(g.index[key]) ? g.texts[g.index[key]] ?? '' : '');
  const 세력 = {};
  for (const f of sc.factions) {
    const rows = {};
    for (const s of f.scenarios) if (s.kind === 'opening') rows[String(s.fm)] = { label: s.label, ko: text(`${f.code}-ko-${s.fm}`), en: text(`${f.code}-en-${s.fm}`) };
    세력[f.code] = rows;
  }
  const own = readJson('src/data/world/scenes.json');
  return { 세력, 인물: own.인물 ?? {} };
}

/** 설치 자료 팩 글: 인사말·카드 사진 목록·기본 명부·아이콘 정보. src/core/install.ts setInstallData 가 읽는 모양 */
export function installPackText() {
  return JSON.stringify({
    schema: 1,
    kind: 'install',
    greetings: readJson('src/data/install/greetings.json'),
    pictures: readJson('src/data/install/pictures.json'),
    directory: readJson('src/data/install/directory.json'),
    icon: readJson('src/data/install/icon.json'),
  });
}

/** 소지품 그림 팩 글 (game-src/items/README.md 표 기준, 11-07 최종): { schema, kind:'items', table:[{k:키워드, h:몸통 말, ft:특징 말, f:파일, kind, base?}], rep:{몸통 말: 파일}, icons:{파일: base64 webp} }.
 *  「빼」한 줄(excluded_note)은 뺀다. merged_into 줄은 file 이 대표 그림이라 그대로 둔다. src/core/datapack.ts applyItemsPack·matchItemIcon 가 읽는 모양 */
export function itemsPackText() {
  const src = readJson('game-src/items/icons.json');
  const table = [];
  const files = new Set();
  for (const e of src.icons) {
    if (!Array.isArray(e.keywords) || typeof e.file !== 'string' || e.excluded_note) continue;
    table.push({ k: e.keywords, h: Array.isArray(e.head) ? e.head : [], ft: Array.isArray(e.feats) ? e.feats : [], f: e.file, kind: e.kind, ...(e.base ? { base: true } : {}) });
    files.add(e.file);
  }
  const rep = {};
  for (const [k, f] of Object.entries(src.head_rep ?? {})) if (typeof f === 'string') (rep[k] = f), files.add(f);
  const icons = {};
  for (const f of [...files].sort()) icons[f] = readFileSync(new URL(`game-src/items/icons/${f}`, ROOT)).toString('base64');
  return JSON.stringify({ schema: 1, kind: 'items', table, rep, icons });
}

/** 세력 전용 NPC 프리셋: 이름 앞머리 → 시작 세력 코드 (사용자 11-08: 관리국 4·가짜 관리국 6·백일몽 4는 그 세력으로 시작할 때만) */
const LOOK_FACTION = [['가짜관리국', 'B00'], ['관리국', 'A00'], ['백일몽', 'C00']];

/** 내 모습 팩 글: { schema, kind:'looks', looks:[{id, name, g, unique, fac, n, w, h, cw, ch, ox, oy, img}] }.
 *  id = 인물 팩 번호(char-6.54 → '6.54'). 고유 인물(char-1~5)은 명부 이름(cfg.name)으로 찾는다.
 *  성별 g: 일반 NPC(char-6)만 필드 신상표(src/game/world/mobProfiles.json sex). 고유 인물은 고르는 창이 안 열려 성별이 필요 없다(''), fac = 그 세력으로 시작할 때만 고를 수 있는 프리셋의 세력 코드.
 *  img = 정면 대기 줄(A['50'], 남쪽을 봄) 시트 base64 webp. src/core/looks.ts parseLooksPack 이 읽는 모양 */
export function looksPackText() {
  const dir = new URL('game-pack/', ROOT);
  const ids = readdirSync(dir)
    .filter((d) => /^char-\d+\.\d+$/.test(d))
    .sort((a, b) => {
      const [a1, a2] = a.slice(5).split('.').map(Number);
      const [b1, b2] = b.slice(5).split('.').map(Number);
      return a1 - b1 || a2 - b2;
    });
  const profiles = readJson('src/game/world/mobProfiles.json');
  const looks = [];
  for (const d of ids) {
    const j = readJson(`game-pack/${d}/char.json`);
    const m = j.A?.['50'];
    if (!m || typeof m.file !== 'string') continue;
    const name = String(j.cfg?.name ?? '');
    const id = d.slice(5);
    const unique = !id.startsWith('6.');
    const sex = unique ? '' : profiles[name]?.sex;
    const g = sex === '남' || sex === '여' ? sex : '';
    const fac = unique ? '' : (LOOK_FACTION.find(([p]) => name.startsWith(p))?.[1] ?? '');
    looks.push({ id, name, g, unique, fac, n: m.n, w: m.w, h: m.h, cw: m.cw, ch: m.ch, ox: m.ox, oy: m.oy, img: readFileSync(new URL(`game-pack/${d}/${m.file}`, ROOT)).toString('base64') });
  }
  return JSON.stringify({ schema: 1, kind: 'looks', looks });
}

/** 글 지문 (src/core/texthash.ts textHash 와 같게): UTF-16 단위의 FNV-1a 32비트. crypto.subtle 이 없는 환경에서도 본체가 저장소의 자료를 확인한다 */
export function textHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** 글을 UTF-8 바이트 상한으로 자른다 (서로게이트 쌍을 가르지 않게 글자 단위) */
export function splitText(text, max = PART_BYTES) {
  const out = [];
  let buf = '';
  let bytes = 0;
  for (const ch of text) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > max) (out.push(buf), (buf = ''), (bytes = 0));
    buf += ch;
    bytes += n;
  }
  if (buf) out.push(buf);
  return out;
}

/** 팩 하나의 지문·목록. 본체에 박는 것은 expect(hash·sha256·length) */
export function packOf(name, text, version) {
  const parts = splitText(text);
  const expect = { hash: textHash(text), sha256: createHash('sha256').update(text, 'utf8').digest('hex'), length: text.length };
  const partNames = parts.map((_, i) => `${name}.${i + 1}.txt`);
  return { name, text, parts, partNames, expect, index: { name, version, parts: partNames, ...expect } };
}
