// 생성 방식 (라이트보드 5.0.0 생각보조·비망록·다시 보기, 2026-11-06)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craft, refreshPrompt, incomingPlan, phonePrompt, wikiPrompt, wikiSettings, advanced } from '../dist-test/core.mjs';

const { craftMessages, craftSettings, memoTexts } = craft;
const base = [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'DATA' }];
const texts = { thoughts: '1. A\n2. B', memo: { persona: 'PERSONA', job: 'JOB', prefill: 'PREFILL', prefillUser: 'PUSER' } };

test('craft: 기본은 그대로, 다시 보기는 기능 값이 0이면 공통 값', () => {
  const s = craftSettings({}, 'gn');
  assert.deepEqual(s, { thoughts: 'off', memo: false, reiterate: 0 });
  assert.deepEqual(craftMessages(base, s, texts), base);
  assert.equal(craftSettings({ '$gen_reiterate': '2' }, 'ph').reiterate, 2);
  assert.equal(craftSettings({ '$gen_reiterate': '2', '$nw_adv_reiterate': '1' }, 'nw').reiterate, 1);
  assert.equal(craftSettings({ '$lb_cfg_lb-gn.adv_thoughts': 'note', '$lb_cfg_lb-gn.adv_memo': '1' }, 'gn').thoughts, 'note');
  assert.equal(advanced.genSettings({ '$gen_user_msgs': '0', '$gen_concurrent': '2' }).userMessages, false);
  assert.equal(advanced.genSettings({ '$gen_concurrent': '2' }).concurrent, 2);
});

test('craft: 생각 단계 적고 지움 / 속으로만, 비망록은 앞글과 미리 채운 응답', () => {
  const note = craftMessages(base, { thoughts: 'note', memo: false, reiterate: 0 }, texts);
  assert.match(note[0].content, /^SYS\n\n# Thoughts\n/);
  assert.match(note[0].content, /<lb-process>/);
  const inner = craftMessages(base, { thoughts: 'inner', memo: false, reiterate: 0 }, texts);
  assert.match(inner[0].content, /# Thoughts Guideline/);
  assert.doesNotMatch(inner[0].content, /<lb-process>/);
  // 순서표가 없으면 붙이지 않는다
  assert.deepEqual(craftMessages(base, { thoughts: 'note', memo: false, reiterate: 0 }, { thoughts: '' }), base);
  const memo = craftMessages(base, { thoughts: 'off', memo: true, reiterate: 0 }, texts);
  assert.match(memo[0].content, /^PERSONA\n\n# Job Note\nJOB\n\nSYS$/);
  assert.deepEqual(memo.slice(2), [{ role: 'assistant', content: 'PREFILL' }, { role: 'user', content: 'PUSER' }]);
  assert.deepEqual(memoTexts((k) => k).prefillUser, 'MEMO.PREFILL_USER');
});

const src = (vars = {}) => ({
  char: { name: '괴이', desc: '', globalLore: [] },
  chat: { message: [{ role: 'user', data: '유저가 쓴 지시문' }, { role: 'char', data: '본문 응답' }], scriptstate: vars, localLore: [] },
});

test('craft: 세 기능 요청문에 실제로 붙고, 유저 메시지 빼기가 먹는다', () => {
  const st = { posts: [], dms: [], sources: {}, seq: 100000 };
  const on = { '$lb_cfg_lb-gn.adv_thoughts': 'note', '$lb_cfg_lb-gn.adv_memo': '1' };
  const g = refreshPrompt(src(on), st, incomingPlan(src(on).chat, st, () => 0.99), 'ㅇㅇ', {});
  assert.match(g.messages[0].content, /Freya/);
  assert.match(g.messages[0].content, /Last Board Topics/);
  assert.equal(g.messages.at(-2).role, 'assistant');
  const off = refreshPrompt(src({ '$gen_user_msgs': '0' }), st, incomingPlan(src().chat, st, () => 0.99), 'ㅇㅇ', {});
  assert.doesNotMatch(off.messages[1].content, /유저가 쓴 지시문/);
  assert.equal(off.messages.length, 2);
  const w = wikiPrompt(src({ '$nw_adv_thoughts': 'inner' }), { title: '시험', writingRequest: '', inherited: [] }, wikiSettings({}), {});
  assert.match(w.messages[0].content, /# Thoughts Guideline/);
});
