// 전수검사 11-13 이미지 고침 (3차): 밑줄 표정(보조 모델·사진 보내기), 보조 모델 지침 {{user}} 풀기, 주인공 금지·사진 목록 머리말을 지침 절로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix3/images';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/asset.ts', 'src/core/sitepics.ts', 'src/core/imgprompt.ts', 'src/core/guides.ts', 'src/core/world/directory.ts', 'src/core/imgtag.ts'],
  outdir: dir, outbase: 'src', bundle: true, splitting: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' },
  loader: { '.txt': 'text', '.md': 'text' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `${n}.mjs`)));
const A = await mod('core/asset');
const S = await mod('core/sitepics');
const P = await mod('core/imgprompt');
const G = await mod('core/guides');
const D = await mod('core/world/directory');
const T = await mod('core/imgtag');

const dirFolder = (key, comment) => ({ key, comment, mode: 'folder', content: '' });
const dirEntry = (folder, comment, key, order) => ({ comment, key, folder, insertorder: order, mode: 'normal', content: `@@dont_activate\n${comment}` });
function lore(agents) {
  const base = [dirFolder('F:ag', '🙂요원'), dirFolder('F:set', '⚙️설정'), ...agents.map((a, i) => dirEntry('F:ag', a.name, `${a.english}, ${a.name}`, 600 + i))];
  return D.withDirectory(base, D.directoryData(D.readDirectory(base)));
}
const LORE = lore([{ name: '에일린', english: 'Aileen' }]);
const KW = ['default', 'smile', 'forced smiling', 'angry smile'];
const reset = () => { for (const n of G.GUIDE_NAMES) G.setGuideOverride(n, ''); };
const withSec = (name, sec, body) => G.guideDefault(name).replace(new RegExp(`@@SECTION ${sec.replace('.', '\\.')}\\n[\\s\\S]*?\\n@@END`), `@@SECTION ${sec}\n${body}\n@@END`);

test('보조 모델: 밑줄로 쓴 띄어쓰기 표정도 넣고, 띄어쓰기 꼴로 넣는다', () => {
  const d = A.imageDataFrom(LORE, ['Aileen'], KW);
  const out = A.applyPatches(['a', 'b', 'c'], [
    { line: 1, tag: '<img="Aileen_forced_smiling">' },
    { line: 2, tag: '<img="Aileen_smile">' },
    { line: 3, tag: '<img="Aileen_no_such">' },
  ], 5, d);
  assert.equal(out, 'a\n\n<img=Aileen_forced smiling>\n\nb\n\n<img=Aileen_smile>\n\nc');
});

test('보조 모델 지침: 이름을 알면 {{user}}를 풀고, 모르면 그대로', () => {
  reset();
  const d = A.imageDataFrom(LORE, ['Aileen'], KW);
  const raw = A.assetPrompt(['Aileen'], ['Aileen smiled.'], d, 1)[0].content;
  assert.ok(raw.includes('- DO NOT tag {{user}}, the narrator, or undefined NPCs.'), raw);
  const named = A.assetPrompt(['Aileen'], ['Aileen smiled.'], { ...d, userName: '영지' }, 1)[0].content;
  assert.ok(!named.includes('{{user}}') && named.includes('- DO NOT tag 영지, the narrator, or undefined NPCs.'), named);
  assert.equal(named.replace('영지', '{{user}}'), raw, '다른 글자는 그대로');
});

test('사진 보내기: 끝이 맞는 가장 긴 표정, 밑줄·띄어쓰기 둘 다', () => {
  const char = { globalLore: LORE };
  assert.equal(S.resolveSitePic(char, 'Aileen_forced_smiling'), 'Aileen_forced smiling');
  assert.equal(S.resolveSitePic(char, 'Aileen_forced smiling'), 'Aileen_forced smiling');
  assert.equal(S.resolveSitePic(char, 'Aileen_angry_smile'), 'Aileen_angry smile');
  assert.equal(S.resolveSitePic(char, 'Aileen_smile'), 'Aileen_smile');
  assert.equal(S.resolveSitePic(char, 'aileen_ Smile'), 'Aileen_smile');
  assert.equal(S.resolveSitePic(char, '에일린'), 'Aileen_default');
  assert.equal(S.resolveSitePic(char, 'Aileen_nope'), null);
});

test('사진 목록 머리말: 기본은 옛 글 그대로, 절을 주면 그 글', () => {
  const char = { globalLore: LORE };
  const old = `People (may add _expression): 에일린\nExpressions: ${[...T.EMOTIONS].join(', ')}`;
  assert.equal(S.sitePicList(char), old);
  const g = Object.fromEntries([...G.guideDefault('GNet').matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)].map((m) => [m[1].trim(), m[2]]));
  assert.equal(S.sitePicList(char, (k) => g[k]), old, '기본 지침 절 = 옛 글');
  assert.equal(g['DM.QUOTE_UNKNOWN'], '[not retained; do not attribute to the contact]');
  assert.equal(S.sitePicList(char, (k) => (k === 'PICS_PEOPLE' ? 'P: {list}' : undefined)).split('\n')[0], 'P: 에일린');
  assert.equal(S.sitePicList({ globalLore: lore([]) }, (k) => g[k]), 'Available pictures: none.');
});

test('메인 이미지 지침: 주인공 금지 문장은 Asset 절, 기본은 옛 글 그대로', () => {
  reset();
  const cfg = P.imgPromptConfig({});
  const old = cfg.template.replace(/\{characters\}/g, 'Aileen').replace(/\{keywords\}/g, cfg.keywords.join(', '))
    .replace(/\{user_skip\}/g, '{{user}}, ').replace(/\{user_rule\}\n?/g, '- Do not create tags for {{user}}.\n').replace(/\n{3,}/g, '\n\n').trim();
  assert.equal(P.buildImgPrompt(cfg, ['Aileen'], false), old);
  G.setGuideOverride('Asset', withSec('Asset', 'MAIN_USER_RULE', '- No tags for {{user}}.'));
  try {
    const out = P.buildImgPrompt(cfg, ['Aileen'], false, '영지');
    assert.ok(out.includes('- No tags for 영지.') && !out.includes('Do not create tags'), out);
  } finally { reset(); }
  // 절이 없는 옛 지침이면 옛 글
  G.setGuideOverride('Asset', G.guideDefault('Asset').replace(/@@SECTION MAIN_USER_(RULE|SKIP)\n[\s\S]*?\n@@END\n?/g, ''));
  try { assert.equal(P.buildImgPrompt(cfg, ['Aileen'], false), old); } finally { reset(); }
});

// 재검토 11-14 ①-8: 사진 목록 머리말 절은 비워도 코드의 기본 글이 나가므로 「비우면 기본 글」 표시 대상이다 (나-51)
test('사진 목록 머리말 절(PICS_*): 비우면 기본 글이 쓰이는 절로 표시된다', () => {
  const char = { globalLore: LORE };
  for (const site of ['GNet', 'Gal', 'Wpf', 'Salmon']) {
    for (const sec of ['PICS_NONE', 'PICS_PEOPLE', 'PICS_EXPR', 'PICS_THINGS']) assert.equal(G.blankUsesDefault(site, sec), true, `${site} ${sec}`);
    assert.equal(G.blankUsesDefault(site, 'DM.QUOTE_UNKNOWN'), true);
    // 표시 대상이 아닌 이름은 그대로 아니다
    assert.equal(G.blankUsesDefault(site, 'PICS_OTHER'), false);
    assert.equal(G.blankUsesDefault(site, 'XPICS_NONE'), false);
  }
  // 표시와 실제가 맞는다: 절을 비우면 기본 글이 나간다
  assert.equal(S.sitePicList(char, () => ''), S.sitePicList(char));
  assert.equal(S.sitePicList({ globalLore: lore([]) }, () => ''), 'Available pictures: none.');
});
