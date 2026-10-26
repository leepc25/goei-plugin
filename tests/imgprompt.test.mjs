// 이미지 태그 지침을 설정으로: 틀·대상 캐릭터(명부+자료+추가−끔, 주인공 규칙)·표정 세트·조립·옛 로어북 블록 제거
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imgprompt, settings } from '../dist-test/core.mjs';

const { imgPromptConfig, imgCandidates, imgCharacters, buildImgPrompt, stripImgLore, applyImgConfig, IMG_PROMPT_DEFAULT, IMG_KEYWORDS_DEFAULT } = imgprompt;
const bookLore = [{ comment: 'Image tag', content: JSON.stringify({ characters: ['Jyaldi', 'Avensha', 'Brownie'], kor_to_eng: { 쟈알디: 'Jyaldi' } }) }];

test('설정 읽기: 비어 있으면 기본 틀·기본 표정, 이름은 금지 문자 제거', () => {
  const c = imgPromptConfig({});
  assert.equal(c.template, IMG_PROMPT_DEFAULT);
  assert.deepEqual(c.keywords, IMG_KEYWORDS_DEFAULT);
  const d = imgPromptConfig({ imgPrompt: '  ', imgNamesOff: ['Jyaldi', ' Jy<al>di '], imgNamesExtra: ['Secriem', 'Bad_Name'], imgKeywords: ['Happy', 'sad!!', ''] });
  assert.ok(d.off.includes('Jyaldi') && d.off.length === 1, '같은 이름은 한 번');
  assert.deepEqual(d.extra, ['Secriem', 'BadName']);
  assert.deepEqual(d.keywords, ['happy', 'sad']);
});

test('대상 캐릭터: 명부 영문명 + Image tag 목록 + 추가 − 끔, 주인공 규칙', () => {
  const cfg = imgPromptConfig({ imgNamesExtra: ['Secriem'], imgNamesOff: ['Brownie'] });
  const cands = imgCandidates(bookLore, cfg);
  assert.ok(cands.some((c) => c.name === 'Jyaldi' && c.source === 'book') && cands.some((c) => c.name === 'Secriem' && c.source === 'extra'));
  const names = imgCharacters(bookLore, cfg, { assetPlayer: false, playerEnglish: 'Jyaldi' });
  assert.deepEqual(names, ['Avensha', 'Secriem'], '끈 Brownie 와 주인공 요원 Jyaldi 는 빠짐');
  const withUser = imgCharacters(bookLore, cfg, { assetPlayer: true, userName: '영지' });
  assert.ok(withUser.includes('영지') && withUser.includes('Jyaldi'), '주인공 ON + 페르소나면 페르소나 이름 추가');
  assert.ok(!imgCharacters(bookLore, cfg, { assetPlayer: true, playerEnglish: 'Jyaldi', userName: '영지' }).includes('영지'), '캐릭터 플레이면 페르소나 이름 없음');
});

test('조립: 자리표 채움, 주인공 OFF 면 {{user}} 금지 줄, ON 이면 없음', () => {
  const cfg = imgPromptConfig({});
  const off = buildImgPrompt(cfg, ['Jyaldi', 'Aileen'], false);
  assert.ok(off.includes('Characters {name}: Jyaldi, Aileen') && off.includes('Available {keyword}: default, angry') && off.includes('Do not create tags for {{user}}.') && off.includes('solely on {{user}}, narration'));
  const on = buildImgPrompt(cfg, ['Jyaldi'], true);
  assert.ok(!on.includes('{{user}}') && !on.includes('{user_rule}') && !on.includes('{user_skip}'));
  const custom = buildImgPrompt(imgPromptConfig({ imgPrompt: 'X {characters} Y {keywords}', imgKeywords: ['smile'] }), ['A'], true);
  assert.equal(custom, 'X A Y smile');
});

test('옛 로어북 블록 제거와 보조 자료 입히기', () => {
  const msgs = [{ role: 'system', content: 'before\n## Inserting Character Visual Images\n\n### Objective\n- x\n- Strict Adherence: Do not invent new {name}, or {keyword}. Only use those provided.\n\n---\nafter' }, { role: 'user', content: 'hi' }];
  const out = stripImgLore(msgs);
  assert.equal(out[0].content, 'before\nafter');
  assert.equal(stripImgLore([{ role: 'user', content: 'hi' }])[0].content, 'hi');
  const d = applyImgConfig({ characters: ['Jyaldi'], keywords: ['angry'], keywordSet: new Set(['angry']), aliases: new Map([['쟈알디', 'Jyaldi']]) }, ['Jyaldi', 'Secriem'], ['smile']);
  assert.deepEqual(d.characters, ['Jyaldi', 'Secriem']);
  assert.ok(d.keywordSet.has('smile') && !d.keywordSet.has('angry'));
  assert.equal(d.aliases.get('secriem'), 'Secriem');
  assert.equal(d.aliases.get('쟈알디'), 'Jyaldi');
  const p = settings.setPrefs({ imgPrompt: 'T', imgNamesOff: ['A'], imgNamesExtra: ['B'], imgKeywords: ['c'] });
  assert.equal(p.imgPrompt, 'T');
  assert.deepEqual([p.imgNamesOff, p.imgNamesExtra, p.imgKeywords], [['A'], ['B'], ['c']]);
});
