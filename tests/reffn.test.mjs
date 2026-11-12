// 기능별 「넘길 내용」·「넘길 양」 (core/reffn.ts): 게시판마다의 칩, 게시판 표 × 기능 표, 괴담톡은 기능 표만,
// 요청 종류마다 제 줄을 쓰는지, 기능별 챗로그·지난 기록·요청 토큰 상한, 정하지 않았을 때 물려받기, 기본 상태는 전과 같은 요청문
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist-test/core.mjs';
import { ACTIVE_MARK, PERSON_MARK, boardPrompts, phonePrompts, realLore } from './reffn-prompts.mjs';

const { reffn, boards, advanced, settings } = core;
const { fnRefs, fnRefToggles, fnChipOn, fnNum, fnOwnNum, fnBudget, fnHistory, fnHistoryVar, fnHistorySetKey, fnSet, fnVar, isFnVar, REF_FNS, REF_CHIP_KEYS } = reffn;
const G = (k) => `$lb_cfg_lb-gn.adv_${k}`;
const GF = (fn, k) => `$lb_cfg_lb-gn.adv_fn_${fn}_${k}`;
const PF = (fn, k) => `$ph_adv_fn_${fn}_${k}`;
const ALL_ON = { description: true, authors: true, persona: true, active: true, related: true, secondary: false };
const has = (t, s) => t.includes(s);

test('기능 표: 이름·변수·기본값', () => {
  assert.deepEqual(REF_FNS.gn.map((x) => x.key), ['refresh', 'post', 'comment', 'dm']);
  assert.deepEqual(REF_FNS.ph.map((x) => x.label), ['답장', '새 메시지 확인', '보기 전용 방']);
  assert.equal(fnVar('gn', 'dm', 'persona'), GF('dm', 'persona'));
  assert.equal(fnVar('ph', 'view', 'related'), PF('view', 'related'));
  for (const f of ['gn', 'ph']) for (const { key } of REF_FNS[f]) assert.deepEqual(fnRefs({}, f, key), ALL_ON, `${f} ${key} 기본값`);
  // 새 채팅 기본값으로 저장되는 변수 (core/settings.ts PREF_VAR)
  const names = [GF('refresh', 'desc'), GF('post', 'history'), GF('dm', 'budget'), PF('reply', 'turns'), PF('view', 'history'), PF('check', 'secondary'),
    ...['gal', 'wpf', 'sm'].flatMap((s) => REF_CHIP_KEYS.map((c) => `$lb_cfg_lb-${s}.adv_${c}`))];
  for (const n of names) assert.ok(settings.PREF_VAR.test(n), n);
  for (const n of names.slice(0, 6)) assert.ok(isFnVar(n), n);
});

test('게시판 칩은 게시판마다 따로 (괴담넷 자리 값을 같이 쓰지 않는다), 기능 표·양 표는 네 게시판이 같이 쓴다', () => {
  const ss = { '$lb_cfg_lb-gal.adv_active': '0', [G('persona')]: '0', [GF('dm', 'desc')]: '0', [GF('post', 'turns')]: '3', [G('turns')]: '5' };
  const view = (s) => boards.boardState(ss, s);
  assert.equal(advanced.refToggles(view('gn'), 'gn').active, true);
  assert.equal(advanced.refToggles(view('gal'), 'gn').active, false);
  assert.equal(advanced.refToggles(view('gn'), 'gn').persona, false);
  for (const s of ['gal', 'wpf', 'sm']) assert.equal(advanced.refToggles(view(s), 'gn').persona, true, `${s} 는 제 값(기본 켬)`);
  for (const s of ['gn', 'gal', 'wpf', 'sm']) {
    assert.equal(fnChipOn(view(s), 'gn', 'dm', 'desc'), false, `${s} 기능 표는 한 값`);
    assert.equal(fnNum(view(s), 'gn', 'post', 'turns'), 3);
    assert.equal(fnNum(view(s), 'gn', 'refresh', 'turns'), 5, '따로 정하지 않은 기능은 같이 쓰는 값');
  }
  // 사이트 보기에서 고친 칩은 그 사이트 자리에 적힌다
  const out = boards.boardWrite({ scriptstate: ss }, { scriptstate: { ...view('sm'), [G('desc')]: '0' } }, 'sm').scriptstate;
  assert.equal(out['$lb_cfg_lb-sm.adv_desc'], '0');
  assert.equal(out[G('desc')], undefined);
});

test('게시판: 게시판 표와 기능 표에서 모두 켠 것만 넘긴다', () => {
  assert.equal(fnRefs({ [G('desc')]: '0' }, 'gn', 'refresh').description, false, '게시판 끔');
  assert.equal(fnRefs({ [GF('refresh', 'desc')]: '0' }, 'gn', 'refresh').description, false, '기능 끔');
  assert.equal(fnRefs({ [GF('refresh', 'desc')]: '0' }, 'gn', 'post').description, true, '다른 기능은 그대로');
  assert.equal(fnRefs({ [GF('dm', 'secondary')]: '1' }, 'gn', 'dm').secondary, false, '2차 참조: 기능만 켜서는 안 넘어간다');
  assert.equal(fnRefs({ [G('secondary')]: '1' }, 'gn', 'dm').secondary, false, '2차 참조: 게시판만 켜서도 안 넘어간다');
  assert.equal(fnRefs({ [G('secondary')]: '1', [GF('dm', 'secondary')]: '1' }, 'gn', 'dm').secondary, true);
  assert.deepEqual(fnRefs({ [G('active')]: '0' }, 'gn', 'dm'), fnRefToggles({ [G('active')]: '0' }, 'gn', 'dm'));
});

test('괴담톡: 기능 표만 본다 (옛 메뉴 칩은 읽지 않는다)', () => {
  const old = { '$ph_adv_desc': '0', '$ph_adv_authors': '0', '$ph_adv_persona': '0', '$ph_adv_active': '0', '$ph_related': '0', '$ph_adv_secondary': '1' };
  for (const { key } of REF_FNS.ph) assert.deepEqual(fnRefs(old, 'ph', key), ALL_ON, `${key}: 옛 칩 무시`);
  const ss = { [PF('view', 'secondary')]: '1', [PF('reply', 'related')]: '0' };
  assert.equal(fnRefs(ss, 'ph', 'view').secondary, true, '기능 표의 2차 참조만으로 켜진다');
  assert.equal(fnRefToggles(ss, 'ph', 'view').secondary, false, '겹쳐 보는 규칙이었다면 꺼져 있다');
  assert.equal(fnRefs(ss, 'ph', 'reply').related, false);
  assert.equal(fnRefs(ss, 'ph', 'check').related, true);
});

test('게시판 요청: 요청 종류마다 제 줄을 쓴다 (쪽지의 페르소나, 한 게시판만 끈 상시 로어북, 글 하나만 새로고침 = 새로고침 줄)', () => {
  const base = boardPrompts(core);
  for (const k of Object.keys(base)) {
    assert.ok(has(base[k], '봇설명표식') && has(base[k], '작가노트표식') && has(base[k], '페르소나표식') && has(base[k], ACTIVE_MARK), `${k}: 기본은 전부`);
  }
  // 쪽지만 페르소나 끔
  let p = boardPrompts(core, { [GF('dm', 'persona')]: '0' });
  assert.ok(!has(p.dm, '페르소나표식'));
  for (const k of ['refresh', 'post', 'comment', 'refreshOne']) assert.ok(has(p[k], '페르소나표식'), k);
  // 괴담갤만 상시 로어북 끔: 괴담갤의 모든 요청에서 빠지고 다른 게시판은 그대로
  const vars = { '$lb_cfg_lb-gal.adv_active': '0' };
  p = boardPrompts(core, vars, 'gal');
  for (const k of Object.keys(p)) assert.ok(!has(p[k], ACTIVE_MARK) && has(p[k], '[활성 로어북: 현재 발생 상황]'), `gal ${k}`);
  for (const s of ['gn', 'wpf', 'sm']) assert.ok(has(boardPrompts(core, vars, s).refresh, ACTIVE_MARK), s);
  // 새로고침 줄의 상시 로어북 끔: 새로고침과 글 하나만 새로고침에서만 빠진다
  p = boardPrompts(core, { [GF('refresh', 'active')]: '0' });
  assert.ok(!has(p.refresh, ACTIVE_MARK) && !has(p.refreshOne, ACTIVE_MARK));
  for (const k of ['post', 'comment', 'dm']) assert.ok(has(p[k], ACTIVE_MARK), k);
  // 댓글 줄·글 쓰기 줄
  p = boardPrompts(core, { [GF('comment', 'desc')]: '0', [GF('post', 'authors')]: '0' });
  assert.ok(!has(p.comment, '봇설명표식') && has(p.refreshOne, '봇설명표식') && has(p.post, '봇설명표식'));
  assert.ok(!has(p.post, '작가노트표식') && has(p.comment, '작가노트표식') && has(p.refresh, '작가노트표식'));
});

test('게시판 요청: 기능별 챗로그 턴 수와 지난 기록', () => {
  // 글 쓰기만 1턴, 쪽지는 안 봄
  let p = boardPrompts(core, { [GF('post', 'turns')]: '1', [GF('dm', 'turns')]: '0' });
  assert.ok(!has(p.post, '둘째 턴 글') && has(p.post, '셋째 턴 글'));
  assert.ok(!has(p.dm, '셋째 턴 글'));
  for (const k of ['refresh', 'comment', 'refreshOne']) assert.ok(has(p[k], '첫째 턴 글'), k);
  // 물려받기: 같이 쓰는 값(옛 「챗로그 포함」)이 2턴이면 정하지 않은 기능은 모두 2턴, 따로 정한 새로고침만 3턴
  p = boardPrompts(core, { [G('turns')]: '2', [GF('refresh', 'turns')]: '3' });
  assert.ok(has(p.refresh, '첫째 턴 글') && has(p.refreshOne, '첫째 턴 글'));
  for (const k of ['post', 'comment', 'dm']) assert.ok(!has(p[k], '첫째 턴 글') && has(p[k], '둘째 턴 글'), k);
  // 지난 기록 — 글 쓰기: 다른 글 활동으로 넘기는 글 수가 제 값 (기본 10, 새로고침의 글 수와 따로)
  p = boardPrompts(core);
  assert.ok(has(p.post, '글제목9번') && !has(p.post, '글제목10번'));
  p = boardPrompts(core, { [GF('post', 'history')]: '2', [G('refresh_posts')]: '12' });
  assert.ok(has(p.post, '글제목1번') && !has(p.post, '글제목2번'), '글 쓰기는 2개');
  assert.ok(has(p.refresh, '글제목11번') && !has(p.refresh, '글제목12번'), '새로고침은 12개');
  assert.ok(has(p.comment, '글제목11번') && !has(p.comment, '글제목12번'), '댓글 요청의 다른 글 수는 새로고침의 글 수 그대로');
  // 지난 기록 — 댓글(답글의 댓글 수, 다른 글의 댓글 수)·쪽지
  p = boardPrompts(core, { [G('comments')]: '1', [G('dm_history')]: '2' });
  assert.ok(!has(p.comment, '글5댓글1') && has(p.comment, '글5댓글2'));
  assert.ok(!has(p.dm, '쪽지글3번') && has(p.dm, '쪽지글4번') && has(p.dm, '쪽지글5번'));
});

test('괴담톡 요청: 요청 종류마다 제 줄을 쓴다 (넘길 내용·챗로그·지난 기록)', () => {
  const base = phonePrompts(core);
  for (const k of Object.keys(base)) assert.ok(has(base[k], '봇설명표식') && has(base[k], '작가노트표식') && has(base[k], '페르소나표식') && has(base[k], ACTIVE_MARK) && has(base[k], '첫째 턴 글'), `${k}: 기본은 전부`);
  assert.ok(has(base.reply, PERSON_MARK) && has(base.check, PERSON_MARK), '인물 로어북 원문');
  // 인물 로어북 한 칸이 참여 인물 원문을 켜고 끈다 (답장만 끔)
  let p = phonePrompts(core, { [PF('reply', 'related')]: '0' });
  assert.ok(!has(p.reply, PERSON_MARK) && has(p.check, PERSON_MARK));
  // 줄마다 따로
  p = phonePrompts(core, { [PF('view', 'desc')]: '0', [PF('check', 'persona')]: '0', [PF('reply', 'active')]: '0', [PF('view', 'turns')]: '1', [PF('check', 'turns')]: '0' });
  assert.ok(!has(p.view, '봇설명표식') && has(p.reply, '봇설명표식') && has(p.check, '봇설명표식'));
  assert.ok(!has(p.check, '페르소나표식') && has(p.reply, '페르소나표식') && has(p.view, '페르소나표식'));
  assert.ok(!has(p.reply, ACTIVE_MARK) && has(p.check, ACTIVE_MARK) && has(p.view, ACTIVE_MARK));
  assert.ok(!has(p.view, '둘째 턴 글') && has(p.view, '셋째 턴 글') && !has(p.check, '셋째 턴 글') && has(p.reply, '첫째 턴 글'));
  // 옛 메뉴 칩·옛 「인물 로어북」 변수는 요청을 바꾸지 않는다
  assert.deepEqual(phonePrompts(core, { '$ph_adv_desc': '0', '$ph_related': '0', '$ph_adv_secondary': '1' }), base);
  // 지난 기록: 답장·새 메시지 확인은 방 말풍선 (정하지 않으면 「방마다 참조할 말풍선」 값), 보기 전용 방은 앞 방 말풍선 (기본 30)
  assert.ok(has(base.reply, '말풍선0번') && has(base.view, '앞방말10번') && !has(base.view, '앞방말9번'));
  p = phonePrompts(core, { [PF('reply', 'history')]: '10', [PF('view', 'history')]: '5' });
  assert.ok(!has(p.reply, '말풍선29번') && has(p.reply, '말풍선30번') && has(p.check, '말풍선0번'));
  assert.ok(!has(p.view, '앞방말34번') && has(p.view, '앞방말35번'));
  p = phonePrompts(core, { '$ph_adv_room_history': '10', [PF('check', 'history')]: '20' });
  assert.ok(!has(p.reply, '말풍선29번') && has(p.reply, '말풍선30번'), '답장은 물려받는다');
  assert.ok(!has(p.check, '말풍선19번') && has(p.check, '말풍선20번'), '새 메시지 확인은 제 값');
});

test('괴담톡 보기 전용 방: 인물 로어북을 끄면 이름이 나온 로어북이 빠진다 (실제 카드)', { skip: !realLore }, () => {
  const direct = (t) => t.includes('"kind":"direct"');
  const chat = { message: [{ role: 'user', data: '소라 랜드로 간다' }, { role: 'char', data: '관람차가 돈다.' }] };
  const run = (vars) => {
    const PP = core.phonePrompt;
    const src = { char: { name: '괴이봇', desc: '', globalLore: realLore }, chat: { ...chat, scriptstate: vars, localLore: [] } };
    return PP.viewPrompt(src, {}, []).messages.map((m) => m.content).join('\n');
  };
  assert.ok(direct(run({})), '기본: 이름이 나온 로어북이 실린다');
  assert.ok(!direct(run({ [PF('view', 'related')]: '0' })));
  assert.ok(direct(run({ [PF('reply', 'related')]: '0', '$ph_related': '0' })), '다른 줄·옛 변수는 상관없다');
});

test('양 표: 따로 정한 값, 물려받기, 요청 토큰 상한', () => {
  assert.equal(fnOwnNum({}, 'gn', 'dm', 'turns'), null);
  assert.equal(fnNum({}, 'gn', 'dm', 'turns'), 8);
  assert.equal(fnNum({ [G('turns')]: '3' }, 'gn', 'dm', 'turns'), 3);
  assert.equal(fnNum({ [G('turns')]: '3', [GF('dm', 'turns')]: '0' }, 'gn', 'dm', 'turns'), 0, '0도 따로 정한 값');
  assert.equal(fnNum({ [GF('dm', 'turns')]: '999' }, 'gn', 'dm', 'turns'), 8, '범위 밖은 정하지 않은 것');
  // 상한: 기능 값 → 메뉴 값 → 생성 공통 값
  assert.equal(fnBudget({}, 'gn', 'refresh'), 0);
  assert.equal(fnBudget({ '$gen_budget': '9000' }, 'gn', 'refresh'), 9000);
  assert.equal(fnBudget({ '$gen_budget': '9000', [G('budget')]: '5000' }, 'gn', 'refresh'), 5000);
  assert.equal(fnBudget({ '$gen_budget': '9000', [G('budget')]: '5000', [GF('refresh', 'budget')]: '2000' }, 'gn', 'refresh'), 2000);
  assert.equal(fnBudget({ '$gen_budget': '9000', [G('budget')]: '5000', [GF('refresh', 'budget')]: '2000' }, 'gn', 'dm'), 5000);
  assert.equal(fnBudget({ '$gen_budget': '9000', [G('budget')]: '5000', [GF('dm', 'budget')]: '0' }, 'gn', 'dm'), 9000, '0 = 생성 공통 값');
  assert.equal(fnBudget({ '$ph_adv_budget': '4000', [PF('view', 'budget')]: '1500' }, 'ph', 'view'), 1500);
  assert.equal(fnBudget({ '$ph_adv_budget': '4000', [PF('view', 'budget')]: '1500' }, 'ph', 'reply'), 4000);
  // 지난 기록
  assert.deepEqual(['refresh', 'post', 'comment', 'dm'].map((k) => fnHistory({}, 'gn', k)), [10, 10, 30, 50]);
  assert.deepEqual(['reply', 'check', 'view'].map((k) => fnHistory({}, 'ph', k)), [100, 100, 30]);
  assert.equal(fnHistoryVar('gn', 'refresh'), G('refresh_posts'));
  assert.equal(fnHistoryVar('gn', 'comment'), G('comments'));
  assert.equal(fnHistoryVar('gn', 'dm'), G('dm_history'));
  assert.equal(fnHistoryVar('gn', 'post'), GF('post', 'history'));
  assert.equal(fnHistory({ [G('refresh_posts')]: '7' }, 'gn', 'post'), 10, '글 쓰기는 새로고침의 글 수를 빌리지 않는다');
  assert.equal(fnHistory({ '$ph_adv_room_history': '40' }, 'ph', 'check'), 40);
  assert.equal(fnHistory({ '$ph_adv_room_history': '40', [PF('check', 'history')]: '15' }, 'ph', 'check'), 15);
  assert.equal(fnHistory({ '$ph_adv_room_history': '40' }, 'ph', 'view'), 30);
  assert.equal(fnHistorySetKey('gn', 'dm'), 'dm_history');
  assert.equal(fnHistorySetKey('ph', 'view'), 'fn_view_history');
});

test('화면의 칸이 보내는 값 읽기 (fnSet)', () => {
  assert.deepEqual(fnSet('gn', 'fn_dm_persona', '0'), [GF('dm', 'persona'), '0']);
  assert.deepEqual(fnSet('ph', 'fn_view_secondary', '1'), [PF('view', 'secondary'), '1']);
  assert.equal(fnSet('gn', 'fn_dm_persona', '2'), null);
  assert.equal(fnSet('gn', 'fn_reply_desc', '1'), null, '그 메뉴에 없는 기능');
  assert.equal(fnSet('gn', 'fn_dm_nope', '1'), null);
  assert.deepEqual(fnSet('gn', 'fn_post_turns', '500'), [GF('post', 'turns'), '200'], '범위 안으로');
  assert.deepEqual(fnSet('gn', 'fn_post_budget', '-5'), [GF('post', 'budget'), '0']);
  assert.deepEqual(fnSet('gn', 'fn_post_turns', ''), [GF('post', 'turns'), ''], '빈 칸 = 따로 정하지 않음');
  assert.deepEqual(fnSet('gn', 'fn_post_history', '0'), [GF('post', 'history'), '1']);
  assert.equal(fnSet('gn', 'fn_refresh_history', '5'), null, '세부 값 표의 값을 그대로 쓰는 칸은 그 표의 열쇠로 보낸다');
  assert.deepEqual(fnSet('ph', 'fn_view_history', '999'), [PF('view', 'history'), '300']);
  assert.deepEqual(fnSet('ph', 'fn_reply_history', '3'), [PF('reply', 'history'), '10']);
  assert.equal(fnSet('ph', 'fn_reply_turns', 'abc'), null);
});

test('기본 상태의 요청문 = 기본값을 하나하나 적은 상태의 요청문 (손대지 않으면 전과 같다)', () => {
  const explicit = {};
  for (const s of ['gn', 'gal', 'wpf', 'sm']) for (const c of REF_CHIP_KEYS) explicit[`$lb_cfg_lb-${s}.adv_${c}`] = c === 'secondary' ? '0' : '1';
  for (const { key } of REF_FNS.gn) {
    for (const c of REF_CHIP_KEYS) explicit[GF(key, c)] = c === 'secondary' ? '0' : '1';
    explicit[GF(key, 'turns')] = '8';
    explicit[GF(key, 'budget')] = '0';
  }
  explicit[GF('post', 'history')] = '10';
  for (const { key } of REF_FNS.ph) {
    for (const c of REF_CHIP_KEYS) explicit[PF(key, c)] = c === 'secondary' ? '0' : '1';
    explicit[PF(key, 'turns')] = '8';
    explicit[PF(key, 'budget')] = '0';
    explicit[PF(key, 'history')] = key === 'view' ? '30' : '100';
  }
  for (const s of ['gn', 'gal', 'wpf', 'sm']) assert.deepEqual(boardPrompts(core, explicit, s), boardPrompts(core, {}, s), s);
  assert.deepEqual(phonePrompts(core, explicit), phonePrompts(core));
  for (const { key } of REF_FNS.gn) assert.equal(fnBudget(explicit, 'gn', key), fnBudget({}, 'gn', key));
});
