import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imgtag, settings } from '../dist-test/core.mjs';

const { renderImgTags, imgCss, hasImgTag } = imgtag;
const have = new Set(['Jyaldi_default', 'Jyaldi_smile', 'Eileen_default']);
const pick = (n) => [...have].find((h) => h.toLowerCase() === n.toLowerCase()) ?? null;

test('imgtag: picks the expression, falls back to _default, drops unknown characters', () => {
  const out = renderImgTags('앞 문단.<img=jyaldi_smile>\n뒤 문단 <img="Jyaldi_angry"> <img=Nobody_sad>끝', pick);
  assert.ok(out.includes("url('{{raw::Jyaldi_smile}}')"), '대소문자 맞춤');
  assert.ok(out.includes("url('{{raw::Jyaldi_default}}')"), '없는 표정은 default');
  assert.ok(!out.includes('Nobody'), '없는 캐릭터는 칸 없음');
  assert.ok(!hasImgTag(out));
  assert.match(out, /앞 문단\.\n\n<div class="gim"/, '태그 앞뒤 줄바꿈 (원본 에셋줄바꿈)');
});

test('imgtag: without an asset list the tag name is trusted; unsafe names are dropped', () => {
  assert.ok(renderImgTags('<img=Eileen_cry>').includes('{{raw::Eileen_cry}}'));
  assert.ok(!renderImgTags("<img=a_b}}{{x>").includes('{{raw'));
});

test('imgtag: css follows size, fold and hidden', () => {
  assert.match(imgCss(), /max-width:32em;aspect-ratio:1\/1/);
  assert.match(imgCss('s', 'more'), /max-width:20em;aspect-ratio:16\/9/);
  assert.ok(!imgCss('l', 'open').includes(':hover'), '안 접음은 펼침 없음');
  assert.match(imgCss('l', 'square', true), /display:none/);
  assert.ok(imgCss().includes('.x-risu-gim') && imgCss().includes('.ib-asset-hover'));
});

test('imgtag: prefs keep valid size/fold only', () => {
  const p = settings.setPrefs({ imgSize: 'xl', imgFold: 'less' });
  assert.equal(p.imgSize, 'xl');
  assert.equal(p.imgFold, 'less');
  const q = settings.setPrefs({ imgSize: 'huge', imgFold: 3 });
  assert.equal(q.imgSize, undefined);
  assert.equal(q.imgFold, undefined);
});
