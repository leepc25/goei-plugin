import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imgtag, settings } from '../dist-test/core.mjs';

const { renderImgTags, imgCss, hasImgTag, imgTagsKnown, stripOldImgTags } = imgtag;
const have = new Set(['Jyaldi_default', 'Jyaldi_smile', 'Eileen_default']);
const pick = (n) => [...have].find((h) => h.toLowerCase() === n.toLowerCase()) ?? null;

test('imgtag: picks the expression, falls back to _default, drops unknown characters', () => {
  const out = renderImgTags('앞 문단.<img=jyaldi_smile>\n뒤 문단 <img="Jyaldi_angry"> <img=Nobody_sad>끝', pick);
  assert.ok(out.includes("url('{{raw::Jyaldi_smile}}')"), '대소문자 맞춤');
  assert.ok(out.includes("url('{{raw::Jyaldi_default}}')"), '없는 표정은 default');
  assert.ok(!out.includes('Nobody'), '없는 캐릭터는 칸 없음');
  assert.ok(!hasImgTag(out));
  assert.match(out, /앞 문단\.\n\n\{\{#when \{\{greater_equal::\{\{chat_index\}\}::\{\{\? \{\{lastmessageid\}\}-5\}\}\}\}\}\}<div class="gim" style="[^"]*max-width:32em/, '태그 앞뒤 줄바꿈 + 최근 메시지 조건 + 기본 모양');
  assert.ok(out.includes('</div>{{/when}}'));
});

test('imgtag: without an asset list the tag name is trusted when the expression is in the set; others fall back to _default; unsafe names are dropped', () => {
  assert.ok(renderImgTags('<img=Eileen_sad>').includes('{{raw::Eileen_sad}}'));
  assert.ok(renderImgTags('<img=Eileen_cry>').includes('{{raw::Eileen_default}}'), '세트 밖 표정은 default (빈 칸 방지)');
  assert.ok(renderImgTags('<img=Spangdal_seductive smile>').includes('{{raw::Spangdal_default}}'));
  assert.ok(!renderImgTags("<img=a_b}}{{x>").includes('{{x'), '위험한 글자는 들어가지 않음 (세트 밖이라 default 로)');
});

test('imgtag: css follows size %, fold % and hidden', () => {
  assert.match(imgCss(), /max-width:32em!important;aspect-ratio:832\/826.88!important/, '기본은 원본(32em, 거의 정사각형)');
  assert.match(imgCss(50, 40), /max-width:16em!important;aspect-ratio:832\/486.4!important/);
  assert.match(imgCss(150, 100), /max-width:48em!important;aspect-ratio:832\/1216!important/);
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

test('imgtag: known check guards other bots before the Lite check', () => {
  assert.equal(imgTagsKnown('<img=Jyaldi_cry>', pick), true, '표정이 없어도 default가 있으면');
  assert.equal(imgTagsKnown('<img=Jyaldi_smile> <img=Stranger_smile>', pick), false);
  assert.equal(imgTagsKnown('<img=Jyaldi_smile>', undefined), false, '에셋 목록을 못 읽었으면 판정 전엔 안 건드림');
});

test('imgtag: request keeps tags only in the last 6 chat messages, system text not counted', () => {
  const msgs = [];
  for (let i = 0; i < 8; i++) msgs.push({ role: i % 2 ? 'assistant' : 'user', content: `m${i} <img=Jyaldi_smile>` });
  msgs.splice(5, 0, { role: 'system', content: 'lore <img=keep_me>' });
  const out = stripOldImgTags(msgs);
  assert.deepEqual(out.filter((m) => m.role !== 'system').map((m) => m.content.includes('<img=')), [false, false, true, true, true, true, true, true]);
  assert.equal(out[5].content, 'lore <img=keep_me>');
  const few = msgs.slice(4);
  assert.equal(stripOldImgTags(few), few, '바꿀 것이 없으면 그대로');
});

test('imgtag: recent counts from settings (0 = all)', () => {
  assert.ok(renderImgTags('<img=Jyaldi_smile>', pick, 3).includes('{{? {{lastmessageid}}-2}}'));
  assert.ok(!renderImgTags('<img=Jyaldi_smile>', pick, 0).includes('{{#when'), '전부');
  const msgs = [1, 2, 3, 4].map((i) => ({ role: 'assistant', content: `m${i}<img=Jyaldi_smile>` }));
  assert.deepEqual(stripOldImgTags(msgs, 2).map((m) => m.content.includes('<img=')), [false, false, true, true]);
  assert.equal(stripOldImgTags(msgs, 0), msgs);
  const p = settings.setPrefs({ imgShow: 0, imgSend: 12 });
  assert.equal(p.imgShow, 0);
  assert.equal(p.imgSend, 12);
  assert.equal(settings.setPrefs({ imgShow: 99 }).imgShow, undefined);
});
