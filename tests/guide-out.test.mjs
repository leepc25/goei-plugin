// 코드에 박혀 있던 지침을 지침 절로 옮긴 것 (2026-11-13 사용자: 「설정 지침칸으로 안 빠지고 하드코딩 돼 있는 것을 지침으로」).
// 1) 기본 지침의 새 절 = 옛 소스의 글자 그대로 (tests/fixtures/guide-out-old.json sections)
// 2) 기본 지침으로 만든 요청문 = 옛 코드가 만들던 요청문 (같은 파일의 calls: 옮기기 전 코드로 만든 것)
// 3) 새 절이 없는 지침(옛 글로 고쳐 저장해 둔 것)이면 코드에 남긴 옛 글을 써서 요청문이 같다
// 4) 절을 고치면 요청문이 바뀐다 (절마다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBundle, calls, withoutSections, withSection, GUIDES_OF } from './guide-out-calls.mjs';

const OLD = JSON.parse(readFileSync(new URL('./fixtures/guide-out-old.json', import.meta.url), 'utf8'));
const M = await buildBundle(process.cwd());
const G = M.G;
const reset = () => { for (const n of G.GUIDE_NAMES) G.setGuideOverride(n, ''); };
const sectionsOf = (name) => Object.fromEntries([...G.guideDefault(name).matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)].map((m) => [m[1].trim(), m[2]]));
const BASE = calls(M);
const moved = Object.entries(OLD.sections).flatMap(([file, list]) => list.map(([name, body]) => ({ file, name, body })));

test('옮긴 절: 기본 지침의 글이 옛 소스 글자와 같다', () => {
  assert.equal(moved.length, 95);
  for (const { file, name, body } of moved) {
    for (const guide of GUIDES_OF[file]) assert.equal(sectionsOf(guide)[name], body, `${guide} / ${name}`);
  }
});

test('새 지침 넷이 지침 목록에 있고 이름표가 있다', () => {
  for (const n of ['Common', 'Main', 'UpdaterExtra', 'Asset']) {
    assert.ok(G.GUIDE_NAMES.includes(n) && G.isGuideName(n), n);
    assert.ok(G.GUIDE_LABEL[n], n);
    assert.ok(G.splitGuide(G.guideDefault(n)).length > 3, `${n}: 절 단위로 갈린다`);
    assert.equal(G.joinGuide(G.splitGuide(G.guideDefault(n))), G.guideDefault(n), `${n}: 쪼갰다 합치면 그대로`);
  }
});

test('기본 지침으로 만든 요청문 = 옮기기 전 코드가 만들던 요청문', () => {
  reset();
  const names = Object.keys(OLD.calls);
  assert.equal(names.length, 56);
  for (const k of names) assert.equal(BASE[k], OLD.calls[k], k);
});

test('새 절이 없는 지침(옛 글로 고쳐 둔 것)이면 코드에 남긴 옛 글을 쓴다: 요청문이 같다', () => {
  for (const [file, guides] of Object.entries(GUIDES_OF)) {
    const names = OLD.sections[file].map(([n]) => n);
    for (const g of guides) {
      const cut = withoutSections(G.guideDefault(g), names);
      for (const n of names) assert.ok(!cut.includes(`@@SECTION ${n}\n`), `${g} ${n}`);
      G.setGuideOverride(g, cut);
    }
  }
  try {
    for (const { file, name } of moved) for (const g of GUIDES_OF[file]) assert.equal(G.guideSec(g, name), null, `${g} / ${name}`);
    const out = calls(M);
    for (const k of Object.keys(BASE)) assert.equal(out[k], BASE[k], k);
  } finally { reset(); }
});

test('절을 고치면 그 절이 들어가는 요청문이 바뀐다 (절마다)', () => {
  const MARK = 'ZZ-EDITED-ZZ';
  for (const { file, name } of moved) {
    for (const g of GUIDES_OF[file]) G.setGuideOverride(g, withSection(G.guideDefault(g), name, (b) => `${b} ${MARK}`));
    try {
      const out = calls(M);
      const hit = Object.keys(out).filter((k) => out[k] !== BASE[k]);
      assert.ok(hit.length > 0, `${file} / ${name}: 어느 요청문도 바뀌지 않았다`);
      assert.ok(hit.every((k) => out[k].includes(MARK)), `${file} / ${name}: 바뀐 요청문에 고친 글이 있다`);
    } finally { reset(); }
  }
  assert.deepEqual(calls(M), BASE, '되돌리면 처음과 같다');
});

test('자리 채우기: {이름} 만 채우고 {{…}}·모르는 이름은 그대로, 채운 값은 다시 훑지 않는다', () => {
  assert.equal(G.fillVars('a {x} {{user}} {y} {X}', { x: '{y}', user: 'U' }), 'a {y} {{user}} {y} {X}');
  assert.equal(G.guideOr('Common', 'NO.SUCH', 'old'), 'old');
  assert.equal(G.guideOr('Common', 'NO.SUCH', () => 'old2'), 'old2');
  G.setGuideOverride('Common', withSection(G.guideDefault('Common'), 'RETRY.ANALYZE', () => '   '));
  try {
    assert.equal(G.guideSec('Common', 'RETRY.ANALYZE'), null, '비운 절은 없는 것으로');
    assert.equal(M.craft.retryAnalyze(), M.craft.RETRY_ANALYZE);
  } finally { reset(); }
});
