// 위키 라이트보드 항목 (자동 작성·본문 그림·정보칸 표정·주석 펼치기, 2026-11-06)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wikiPrompt, wikiSettings, renderArticle, portraitMood, wikiTitlePrompt, acceptTitle } from '../dist-test/core.mjs';

const src = (vars = {}) => ({
  char: { name: '괴이', desc: '', globalLore: [] },
  chat: { message: [{ role: 'user', data: '오후역에 갔다' }, { role: 'char', data: '오후역 플랫폼은 조용했다' }], scriptstate: vars, localLore: [] },
});
const req = (extra = {}) => ({ title: '오후역', writingRequest: '', inherited: [], previous: null, direct: false, ...extra });

test('위키: 설정 기본값과 자동 작성 설정 읽기', () => {
  const s = wikiSettings({});
  assert.equal(s.footnotes, 'pop');
  assert.equal(s.images, 'infobox');
  assert.equal(s.auto, '0');
  const t = wikiSettings({ '$nw_footnotes': 'inline', '$nw_images': 'body', '$nw_auto': 'turn', '$nw_auto_title': 'input', '$nw_auto_query': ' 오후역 ' });
  assert.deepEqual([t.footnotes, t.images, t.auto, t.autoTitle, t.autoQuery], ['inline', 'body', 'turn', 'input', '오후역']);
});

test('위키: 본문 그림은 제목·참고·챗로그에 나온 것만, 표정은 인물 문서에만', () => {
  const images = [{ name: 'Afternoon Station', label: '오후역' }, { name: 'Dark Garden', label: '어둠의 정원' }];
  const p = wikiPrompt(src(), req({ images, moods: ['smile', 'serious'] }), wikiSettings({}), {});
  const sys = p.messages[0].content;
  assert.match(sys, /BODY IMAGES/);
  assert.match(sys, /- Afternoon Station = 오후역/);
  assert.doesNotMatch(sys, /Dark Garden/);
  assert.match(sys, /portrait_mood/);
  assert.match(sys, /smile, serious/);
  const none = wikiPrompt(src(), req(), wikiSettings({}), {}).messages[0].content;
  assert.doesNotMatch(none, /BODY IMAGES|portrait_mood/);
});

test('위키: 그림 블록·표정·주석 펼치기 렌더', () => {
  const body = '<lightboard-namuwiki doc_title="오후역" doc_type="other" portrait_mood="Smile">\n[Paragraph]조용한 역이다.📌늘 그렇다.📌\n[Image]Name:Afternoon Station|Caption:승강장\n[Image]Name:없는그림|Caption:x\n</lightboard-namuwiki>';
  assert.equal(portraitMood(body), 'smile');
  const o = { saved: () => false, canon: (t) => t };
  const pop = renderArticle(body, o);
  assert.match(pop.html, /nw-fn.*\[1\]/);
  assert.match(pop.html, /nw-notes/);
  assert.doesNotMatch(pop.html, /nw-fig/, '그림 함수를 안 주면 그림 블록은 건너뛴다');
  const inl = renderArticle(body, { ...o, inlineNotes: true, image: (n) => (n === 'Afternoon Station' ? 'blob:x' : null) });
  assert.match(inl.html, /nw-fn-in">\(늘 그렇다\.\)/);
  assert.doesNotMatch(inl.html, /nw-notes/);
  assert.equal((inl.html.match(/<figure/g) ?? []).length, 1);
  assert.match(inl.html, /figcaption>승강장/);
});

test('위키: 자동 작성 제목 고르기 요청과 응답 읽기', () => {
  const m = wikiTitlePrompt(src(), ['오후역', '어둠의 정원'], ['어둠의 정원'], {});
  assert.match(m[0].content, /Return exactly \{"title"/);
  assert.match(m[1].content, /- 오후역/);
  assert.match(m[1].content, /이미 쓴 문서/);
  assert.equal(acceptTitle('<think>x</think>{"title":"오후역"}', ['오후역', '어둠의 정원']), '오후역');
  assert.equal(acceptTitle('어둠의 정원', ['오후역', '어둠의 정원']), '어둠의 정원');
  assert.throws(() => acceptTitle('{"title":"관리국"}', ['오후역']), /후보에 없는/);
});
