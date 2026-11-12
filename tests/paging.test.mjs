// 쌓이는 목록의 「더 보기」 셈 (core/paging.ts, 2026-11-12 사용자): 처음 N줄, 누를 때마다 N줄, 날짜 묶음 머리는 그날 전체로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutGroups, pageCount, journalSettings, JR, JR_DEFAULTS, JR_LIST_PAGE, settings } from '../dist-test/core.mjs';

test('pageCount: 한 번에 보일 줄 수 × (누른 횟수 + 1)', () => {
  assert.equal(pageCount(30, 0), 30);
  assert.equal(pageCount(30, 1), 60);
  assert.equal(pageCount(10, 4), 50);
  assert.equal(pageCount(0, 0), 1, '0·깨진 값은 1줄로');
  assert.equal(pageCount(30, -3), 30);
});

test('cutGroups: 앞에서부터 자르고, 잘린 묶음도 rows(그날 전체)는 그대로', () => {
  const groups = [{ day: 'a', rows: [1, 2, 3] }, { day: 'b', rows: [4, 5] }, { day: 'c', rows: [6] }];
  const c = cutGroups(groups, 4);
  assert.deepEqual(c.groups.map((g) => [g.day, g.shown, g.rows.length]), [['a', [1, 2, 3], 3], ['b', [4], 2]]);
  assert.equal(c.total, 6);
  assert.equal(c.rest, 2);
  assert.deepEqual(groups[1].rows, [4, 5], '원본은 손대지 않는다');
  const all = cutGroups(groups, 99);
  assert.equal(all.rest, 0);
  assert.equal(all.groups.length, 3);
  assert.equal(cutGroups(groups, 3).groups.length, 1, '딱 묶음 끝에서 끊기면 빈 묶음 머리를 만들지 않는다');
  assert.deepEqual(cutGroups([], 30), { groups: [], total: 0, rest: 0 });
  assert.equal(cutGroups(groups, 0).rest, 6);
});

test('설정 $jr_list_page: 기본 30, 10~100, 「기본값으로 저장」 범위', () => {
  assert.equal(JR_DEFAULTS.list_page, '30');
  assert.deepEqual({ ...JR_LIST_PAGE }, { min: 10, max: 100, step: 10 });
  assert.equal(journalSettings(undefined).listPage, 30);
  assert.equal(journalSettings({ [JR('list_page')]: '50' }).listPage, 50);
  assert.equal(journalSettings({ [JR('list_page')]: '3' }).listPage, 10);
  assert.equal(journalSettings({ [JR('list_page')]: '9999' }).listPage, 100);
  assert.equal(journalSettings({ [JR('list_page')]: 'abc' }).listPage, 30);
  assert.ok(settings.PREF_VAR.test('$jr_list_page'));
});
