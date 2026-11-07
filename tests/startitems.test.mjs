import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readStartItems, parseStartItems, startItemsText, startItemsState, startItemsVars, liveItems, equippedOf, gridItems, itemLeft, readItems, readDirectory, directoryData, withDirectory } from '../dist-test/core.mjs';

const install = JSON.parse(readFileSync(new URL('../src/data/install/directory.json', import.meta.url), 'utf8'));
const of = (name) => readStartItems(install.요원[name].start_items);

test('기본 명부: 초안 표 55명 중 48명에 129줄', () => {
  const rows = Object.values(install.요원).filter((a) => a.start_items?.length);
  assert.equal(rows.length, 48);
  assert.equal(rows.reduce((n, a) => n + a.start_items.length, 0), 129);
  for (const a of rows) assert.deepEqual(readStartItems(a.start_items), a.start_items, '저장 모양 그대로 읽힌다');
});

test('시작하면 무기·장비는 빈 칸에 차례로 끼우고, 넘치거나 「소지품」 줄은 격자에', () => {
  const alive = new Set();
  const it = startItemsState(of('에일린'));
  const eq = equippedOf(liveItems(it, alive));
  assert.deepEqual(eq.weapon.map((e) => e?.name), ['권총', '소총']);
  assert.equal(eq.gear[0]?.name, '방탄조끼');
  // 살라딘: 무기 셋째(폭약)는 소지품, 소모 3
  const s = startItemsState(of('살라딘'));
  const sl = liveItems(s, alive);
  assert.deepEqual(equippedOf(sl).weapon.map((e) => e?.name), ['시미터', 'AK-47']);
  const bomb = gridItems(sl).find((e) => e.name === '폭약');
  assert.ok(bomb && bomb.equip === 'weapon' && itemLeft(s, bomb, alive) === 3);
  // 윤병수 수류탄: 무기 칸이 비어도 표대로 소지품
  const y = liveItems(startItemsState(of('윤병수')), alive);
  assert.ok(gridItems(y).some((e) => e.name === '수류탄'));
  // 블라렛: 장비 4칸이 다 찬다
  assert.equal(equippedOf(liveItems(startItemsState(of('블라렛')), alive)).gear.filter(Boolean).length, 4);
});

test('편집 칸 글 ↔ 줄, 소모 띄어쓰기·「-」 빈칸', () => {
  const list = of('살라딘');
  assert.deepEqual(parseStartItems(startItemsText(list)), list);
  assert.deepEqual(parseStartItems('담배 | 소모 20 | 소지품 | 한 갑 | - | cigarette\n\n | 사용'), [{ name: '담배', use: true, uses: 20, desc: '한 갑', icon: 'cigarette' }]);
});

test('시작 변수: 줄이 없으면 빈 소지품', () => {
  assert.deepEqual(startItemsVars([]), { $st_items: '' });
  const it = readItems(startItemsVars(of('쟈알디')));
  assert.deepEqual(it.list.map((e) => e.name), ['권총', '검은 장갑', '담배']);
  assert.ok(it.list.every((e) => e.anchor === '' && e.from === 'manual'));
});

test('명부 로어북에 저장하고 다시 읽으면 시작 소지품이 그대로', () => {
  const F = (id, name) => ({ comment: name, key: `folder:${id}`, mode: 'folder', content: '' });
  const base = [F('g', '🙂요원'), { comment: '쟈알디', key: 'Jyaldi, 쟈알디', content: '쟈알디 설정', mode: 'normal', folder: 'folder:g' }];
  const d = readDirectory(base);
  const row = d.agents.find((a) => a.lore === '쟈알디');
  assert.equal(row.startItems, undefined);
  row.startItems = of('쟈알디');
  const data = directoryData(d);
  assert.deepEqual(data.요원.쟈알디.start_items, of('쟈알디'));
  const back = readDirectory(withDirectory(base, data)).agents.find((a) => a.lore === '쟈알디');
  assert.deepEqual(back.startItems, of('쟈알디'));
  delete back.startItems;
  assert.equal('start_items' in directoryData({ ...d, agents: [back] }).요원.쟈알디, false, '비우면 칸을 저장하지 않음');
});
