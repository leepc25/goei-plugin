// 전수검사 11-13 이미지 고침: 밑줄 표정 태그, 이미지 지침 {{user}} 풀기, 상황 카드 설명 캐시
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/img';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/imgtag.ts', 'src/core/imgprompt.ts', 'src/ui/evpic.ts', 'src/core/wiki.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `${n}.mjs`)));
const T = await mod('core/imgtag');
const P = await mod('core/imgprompt');
const E = await mod('ui/evpic');
const W = await mod('core/wiki');

test('밑줄로 쓴 띄어쓰기 표정도 그림 칸이 된다', () => {
  const pick = (n) => (n.toLowerCase() === 'aileen_forced smiling' ? 'Aileen_forced smiling' : null);
  const out = T.renderImgTags('a\n<img=Aileen_forced_smiling>\nb', pick);
  assert.ok(out.includes('{{raw::Aileen_forced smiling}}'), out);
  assert.ok(T.renderImgTags('<img=Aileen_forced smiling>', pick).includes('{{raw::Aileen_forced smiling}}'));
  // 목록이 없을 때도 표정 세트로 믿는다
  assert.ok(T.renderImgTags('<img=Aileen_angry_smile>').includes('{{raw::Aileen_angry smile}}'));
  // 없는 표정은 그대로 빠진다
  assert.equal(T.renderImgTags('a<img=Aileen_no_such>b', pick), 'a\n\nb');
});

test('이미지 지침: 이름을 주면 {{user}}를 풀고, 안 주면 그대로', () => {
  const cfg = P.imgPromptConfig({});
  const raw = P.buildImgPrompt(cfg, ['Jyaldi'], false);
  assert.ok(raw.includes('{{user}}'));
  const named = P.buildImgPrompt(cfg, ['Jyaldi'], false, '영지');
  assert.ok(!named.includes('{{user}}') && named.includes('Do not create tags for 영지.'), named);
  assert.equal(P.buildImgPrompt(cfg, ['Jyaldi'], false, ' '), raw);
});

test('상황 카드 설명: 위키 문서가 생기면 새로 읽는다', () => {
  const char = { globalLore: [] };
  let chat = { localLore: [] };
  assert.equal(E.evArt({ char, chat }, '명일 아파트').desc, '');
  chat = W.saveDoc(chat, { title: '명일 아파트' }, '<lightboard-namuwiki>\n[Paragraph]낡은 아파트.\n</lightboard-namuwiki>');
  assert.equal(E.evArt({ char, chat }, '명일 아파트').desc, '낡은 아파트.');
  // 다른 채팅에는 그 문서가 없다
  assert.equal(E.evArt({ char, chat: { localLore: [] } }, '명일 아파트').desc, '');
});
