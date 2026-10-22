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

test('imgtag: css follows size %, fold % and hidden', () => {
  assert.match(imgCss(), /max-width:32em;aspect-ratio:832\/826.88/, '기본은 원본(32em, 거의 정사각형)');
  assert.match(imgCss(50, 40), /max-width:16em;aspect-ratio:832\/486.4/);
  assert.match(imgCss(150, 100), /max-width:48em;aspect-ratio:832\/1216/);
  assert.ok(!imgCss(100, 100).includes(':hover'), '100%는 접지 않음');
  assert.match(imgCss(100, 68, true), /display:none/);
  assert.ok(imgCss().includes('.x-risu-gim') && imgCss().includes('.ib-asset-hover'));
});

test('imgtag: prefs keep valid percentages only', () => {
  const p = settings.setPrefs({ imgSize: 150, imgFold: '45' });
  assert.equal(p.imgSize, 150);
  assert.equal(p.imgFold, 45);
  const q = settings.setPrefs({ imgSize: 500, imgFold: 'l' });
  assert.equal(q.imgSize, undefined);
  assert.equal(q.imgFold, undefined);
});
