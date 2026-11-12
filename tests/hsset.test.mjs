// 망상홈쇼핑 설정 정의표 (core/setdef/homeshop.ts): 줄·기본값·줄이 적는 변수와 읽는 쪽이 맞는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeshop, hslog, hsset, settings } from '../dist-test/core.mjs';
const { hsSettings, HS_NUM, HS_KEY, HS_READ_DEFAULT, HS_FORMS_DEFAULT, HS_VAR, HS_AT_VAR, HS_ORDERS_VAR, HS_AUD_VAR } = homeshop;
const { HOMESHOP_SET, HS_PAIRS, HS_DEF_TEXT, hsRowVars, HS_TEL_KEY, HS_RETRY_KEY } = hsset;
const rows = HOMESHOP_SET.groups.flatMap((g) => g.rows);

test('망상홈쇼핑 설정: 묶음과 줄 — 이 페이지에만 있는 줄만, 상점 표의 줄은 없다', () => {
  assert.deepEqual(HOMESHOP_SET.groups.map((g) => [g.title, g.rows.map((r) => r.key)]), [
    ['', ['net', 'retry', 'say', 'sayCue', 'sayChat']],
    ['편성', ['cue', 'chat']],
    ['방송 흐름', ['speed', 'hold', 'frame', 'chatGap', 'next', 'turn', 'lock']],
    ['남은 수량', ['left', 'drop', 'dropRate', 'dropFast', 'dropStep', 'soonAt', 'end']],
    ['주문', ['barter', 'peek']],
    ['컨텍스트 포함', ['call', 'forms', 'aud']],
    ['진행자 동작', ['fill', 'fillCool', 'rareP', 'rareCool', 'read', 'clips']],
    ['방송 화면', ['tel', 'cut', 'bulb', 'tear', 'tearP', 'scan', 'scalePc', 'scalePh']],
  ]);
  // 상점마다 따로 정하는 값·네 곳이 같이 쓰는 값·메인 요청에 붙이는 것은 설정 → 상점에 있다
  for (const r of rows) {
    assert.ok(!/^(on|auto|size|turns|refs)$|^sh:/.test(r.key), `상점 표의 줄이 페이지에 있다: ${r.key}`);
    for (const v of hsRowVars(r.key)) assert.ok(!v.startsWith('$hs_sh_') && !v.startsWith('$hs_main') && v !== HS_KEY.on, `${r.key} → ${v}`);
  }
  assert.equal(new Set(rows.map((r) => r.label)).size, rows.length, '줄 이름이 겹치지 않는다');
  for (const w of ['컨텍스트에 포함', '최근 본문 턴 수', '참고 로어북', '정부기관', '이면', '본편', '참고 자료']) for (const r of rows) assert.ok(!r.label.includes(w), `${r.label}: ${w}`);
});

test('망상홈쇼핑 설정: 기본값·범위 (넘김 문서 2절)', () => {
  const D = { chatMin: [30, 0, 120], chatMax: [40, 0, 120], cueMin: [12, 2, 20], cueMax: [16, 2, 20], sayCueMin: [1, 1, 6], sayCueMax: [3, 1, 6], sayChatMin: [2, 0, 12], sayChatMax: [5, 0, 12],
    chatGap: [22, 5, 100], speed: [11, 3, 40], hold: [12, 0, 50], frame: [110, 50, 250], tearP: [6, 0, 100], fillLo: [3, 1, 30], fillHi: [6, 1, 30], fillCool: [8, 0, 60], rareP: [10, 0, 100], rareCool: [20, 0, 120],
    next: [0, 0, 60], left: [30, 1, 999], dropRate: [100, 10, 400], dropFast: [20, 10, 50], dropStep: [3, 1, 20], soonAt: [5, 0, 99], endLo: [2, 1, 99], endHi: [8, 1, 99], callLo: [6, 1, 60], callHi: [12, 1, 60] };
  assert.deepEqual(Object.keys(HS_NUM).sort(), Object.keys(D).sort());
  for (const [k, [def, lo, hi]] of Object.entries(D)) assert.deepEqual([HS_NUM[k].def, HS_NUM[k].lo, HS_NUM[k].hi], [def, lo, hi], k);
  const s = hsSettings({});
  assert.deepEqual([s.sayCue, s.sayChat, s.cue, s.chat, s.next], [[1, 3], [2, 5], [12, 16], [30, 40], 0]);
  assert.deepEqual(s.read, ['고개 꺾기', '굳은 응시']);
  assert.equal(HS_READ_DEFAULT, '고개 꺾기, 굳은 응시');
  assert.deepEqual(HS_DEF_TEXT.read, [HS_KEY.read, HS_READ_DEFAULT, 200]);
  assert.deepEqual(HS_DEF_TEXT.forms, [HS_KEY.forms, HS_FORMS_DEFAULT, 200]);
  // 줄의 조작 범위는 HS_NUM 그대로
  for (const r of rows) {
    if (r.ctl.t === 'num') assert.deepEqual([r.ctl.lo, r.ctl.hi, r.ctl.unit], [HS_NUM[r.key].lo, HS_NUM[r.key].hi, HS_NUM[r.key].unit], r.key);
    if (r.ctl.t === 'minmax') { const [a, b] = HS_PAIRS[r.key]; assert.deepEqual(r.ctl.keys, [a, b]); assert.deepEqual([r.ctl.lo, r.ctl.hi, HS_NUM[b].lo, HS_NUM[b].hi], [HS_NUM[a].lo, HS_NUM[a].hi, HS_NUM[a].lo, HS_NUM[a].hi], r.key); }
  }
  const by = (k) => rows.find((r) => r.key === k);
  assert.deepEqual([by('sayCue').ctl.lo, by('sayCue').ctl.hi, by('sayChat').ctl.lo, by('sayChat').ctl.hi], [1, 6, 0, 12]);
  assert.deepEqual(by('read').ctl, { t: 'text', ph: '', def: HS_READ_DEFAULT, max: 200 });
  // 회색 안내 글을 기본값처럼 쓰지 않는다: 기본값이 든 칸은 def, 그 밖의 칸은 안내 글 없음
  for (const r of rows) if (r.ctl.t === 'text' || r.ctl.t === 'area') assert.equal(r.ctl.ph, '', `${r.key} 회색 안내 글`);
});

test('망상홈쇼핑 설정: 줄이 적는 변수를 읽는 쪽이 읽는다 (적고 → 설정 값이 바뀐다)', () => {
  const base = JSON.stringify(hsSettings({}));
  const uiRead = new Set([HS_TEL_KEY, HS_RETRY_KEY]); // 화면이 바로 읽는 값 (ui/homeshop.ts telOf · retryOf)
  const seen = new Set();
  for (const r of rows) {
    const vars = hsRowVars(r.key);
    assert.ok(vars.length, `${r.key}: 적는 변수가 없다`);
    for (const v of vars) {
      assert.ok(!seen.has(v), `${v} 를 두 줄이 적는다`); seen.add(v);
      if (uiRead.has(v)) continue;
      const num = Object.values(HS_NUM).find((d) => d.key === v);
      const val = num ? String(num.def === num.hi ? num.lo : num.hi) : r.ctl.t === 'seg' && r.ctl.opts.length > 2 ? '2' : r.ctl.t === 'seg' ? '0' : 'B:웃음=드물게';
      assert.notEqual(JSON.stringify(hsSettings({ [v]: val })), base, `${r.key} → ${v} 를 아무도 읽지 않는다`);
    }
  }
  assert.deepEqual([HS_TEL_KEY, HS_RETRY_KEY], ['$hs_tel', '$hs_retry']);
  // 새 줄
  assert.deepEqual(hsRowVars('sayCue'), ['$hs_say_cue_min', '$hs_say_cue_max']);
  assert.deepEqual(hsRowVars('sayChat'), ['$hs_say_chat_min', '$hs_say_chat_max']);
  assert.deepEqual(hsRowVars('read'), ['$hs_read']);
  assert.deepEqual(hsSettings({ $hs_say_cue_min: '2', $hs_say_cue_max: '6' }).sayCue, [2, 6]);
  assert.deepEqual(hsSettings({ $hs_say_cue_max: '9' }).sayCue, [1, 6], '범위 밖은 끝 값으로');
  assert.deepEqual(hsSettings({ $hs_say_chat_min: '0', $hs_say_chat_max: '12' }).sayChat, [0, 12]);
  assert.deepEqual(hsSettings({ $hs_read: '웃음, 끄덕임' }).read, ['웃음', '끄덕임']);
  assert.deepEqual(hsSettings({ $hs_read: '' }).read, ['고개 꺾기', '굳은 응시'], '비우면 기본값');
  // 네 곳이 같이 쓰는 값은 기본 상점 자리($sh_*) 하나: 망상홈쇼핑 이름으로 적어도 읽지 않는다 (그래서 그런 줄·처리기를 두지 않는다)
  for (const k of ['ctx', 'turns', 'refs', 'thoughts', 'diverse', 'prev']) assert.equal(JSON.stringify(hsSettings({ [`$hs_sh_${k}`]: k === 'thoughts' ? 'note' : k === 'turns' || k === 'refs' ? '7' : '0' })), base, `$hs_sh_${k}`);
  assert.equal(hsSettings({ $sh_turns: '7' }).shop.turns, 7);
});

test('망상홈쇼핑 설정: 모든 설정 변수는 「기본값으로 저장」 범위, 상태 변수는 아니다', () => {
  for (const r of rows) for (const v of hsRowVars(r.key)) assert.ok(settings.PREF_VAR.test(v), `${r.key} → ${v}`);
  for (const v of [...Object.values(hslog.HS_MAIN_KEY), HS_KEY.on, HS_KEY.auto, '$hs_sh_model', '$hs_sh_min', '$hs_sh_max', '$hs_sh_price']) assert.ok(settings.PREF_VAR.test(v), v);
  for (const v of [HS_VAR, HS_AT_VAR, HS_ORDERS_VAR, HS_AUD_VAR, hslog.HS_LOG_VAR, '$hs_anything']) assert.ok(!settings.PREF_VAR.test(v), `${v} 는 상태`);
  assert.deepEqual(settings.chatSettingVars({ $hs_read: '웃음', $hs_say_cue_max: '4', $hs_drop: '0', $hs_main_tokens: '500', $hs_show: '{}', $hs_log: '{}' }), { $hs_read: '웃음', $hs_say_cue_max: '4', $hs_drop: '0', $hs_main_tokens: '500' });
});

test('망상홈쇼핑: 메인 요청에 붙이는 값($hs_main·$hs_main_kinds·$hs_main_tokens)을 읽는 뜻', () => {
  const m = hslog.hsMainSettings;
  assert.deepEqual(m({}), { on: true, kinds: ['show', 'chat', 'say', 'buy'], tokens: 3000 });
  assert.equal(m({ $hs_main: '0' }).on, false);
  assert.equal(m({ $hs_main: '' }).on, true);
  assert.deepEqual(m({ $hs_main_kinds: 'buy, show' }).kinds, ['show', 'buy']);
  assert.deepEqual(m({ $hs_main_kinds: '' }).kinds, ['show', 'chat', 'say', 'buy'], '빈 글 = 전부');
  assert.deepEqual(m({ $hs_main_kinds: 'none' }).kinds, [], '아는 종류가 없는 글 = 아무것도 안 넘김');
  assert.equal(m({ $hs_main_tokens: '0' }).tokens, 0);
  assert.equal(m({ $hs_main_tokens: '999999' }).tokens, 200000);
  assert.equal(m({ $hs_main_tokens: '' }).tokens, 3000);
});
