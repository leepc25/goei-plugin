// 기본값이 든 글 칸의 공통 규칙 (2026-11-12 사용자: 회색 안내 글을 기본값으로 쓰지 않는다). core/deftext.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export * from './src/core/deftext'; export { rollDefaults, genresText, parseGenres, tiersText, parseTiers, mallRoll } from './src/core/malls'; export { DESK_AXES_DEFAULT, deskSettings } from './src/core/bmdesk'; export { HS_FORMS_DEFAULT, hsSettings } from './src/core/homeshop';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);

test('칸에 보일 글: 저장값이 없으면 기본값이 그대로 들어 있다', () => {
  assert.equal(M.defShown('', '가, 나'), '가, 나');
  assert.equal(M.defShown('  ', '가, 나'), '가, 나');
  assert.equal(M.defShown('다', '가, 나'), '다');
});

test('저장: 기본값과 같거나 비었으면 빈 글(기본 따름), 한 글자라도 다르면 친 글 그대로', () => {
  assert.equal(M.defStored('가, 나', '가, 나'), '');
  assert.equal(M.defStored('  가,  나 \n', '가, 나'), '', '빈칸만 다른 것은 같은 글');
  assert.equal(M.defStored('', '가, 나'), '');
  assert.equal(M.defStored('가, 나, 다', '가, 나'), '가, 나, 다', '덧붙인 글 + 기본값이 함께 남는다');
  assert.equal(M.defStored('가나다라', '가', undefined, 3), '가나다', '길이 상한');
  assert.equal(M.defChanged('', '가'), false);
  assert.equal(M.defChanged('가', '가'), false);
  assert.equal(M.defChanged('나', '가'), true);
});

test('우주 쇼핑몰·포인트몰: 기본 목록을 그대로 두면 저장 안 함, 하나 덧붙이면 읽는 쪽이 21종을 쓴다', () => {
  for (const site of ['cos', 'bm']) {
    const D = M.rollDefaults(site);
    const gN = (t) => M.genresText(M.parseGenres(t)); const tN = (t) => M.tiersText(M.parseTiers(t));
    const g0 = M.genresText(D.genres); const t0 = M.tiersText(D.tiers);
    assert.equal(M.defStored(g0, g0, gN), ''); assert.equal(M.defStored(t0, t0, tN), '');
    assert.equal(M.defStored(g0.replace(/, /g, ',\n'), g0, gN), '', '줄만 바꾼 것은 같은 목록');
    const g1 = M.defStored(`${g0}, 새 것`, g0, gN);
    assert.equal(g1, `${g0}, 새 것`);
    const key = site === 'cos' ? '$cos_roll_genres' : '$bm_roll_genres';
    assert.equal(M.mallRoll({ [key]: g1 }, site).genres.length, D.genres.length + 1);
    assert.deepEqual(M.mallRoll({ [key]: '' }, site).genres, D.genres);
    assert.equal(M.defStored('쓸 수 없는 글', t0, tN), '', '알아들을 줄이 없으면 기본 따름');
  }
});

test('상담사 주사위 칸·출연 형태: 저장값이 없으면 읽는 쪽도 같은 기본값', () => {
  assert.equal(M.deskSettings({}).axes.length, M.DESK_AXES_DEFAULT.split('\n').length);
  assert.deepEqual(M.hsSettings({}).forms, M.HS_FORMS_DEFAULT.split(',').map((x) => x.trim()));
});
