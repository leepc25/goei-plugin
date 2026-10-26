import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-req-'));
await build({
  entryPoints: ['src/core/people/request.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/seed.ts', 'src/core/people/base.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const R = await mod('request');
const T = await mod('types');
const St = await mod('settings');
const Seed = await mod('seed');
const Base = await mod('base');

const SHEET = ['### Character - Jyaldi', '#### Identity', '- Role: Chief', '#### Voice', '- Short orders.'].join('\n');

test('요청 가공: 장면 인물 블록을 마지막 유저 메시지 앞에, split 이면 시트 원문은 뺀다', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = Seed.seedPerson('쟈알디', SHEET, { faction: 'A00', address: { toUser: '요원', register: '반말' }, aliases: ['Jyaldi'] });
  const chat = { message: [{ role: 'user', data: '안녕', chatId: 'u1' }, { role: 'char', data: '쟈알디가 왔다.', chatId: 'c1' }, { role: 'user', data: '부장님께 인사', chatId: 'u2' }], scriptstate: {} };
  const msgs = [{ role: 'system', content: `카드\n${SHEET}\n끝` }, { role: 'user', content: '안녕' }, { role: 'assistant', content: '쟈알디가 왔다.' }, { role: 'user', content: '부장님께 인사' }];
  const o = { settings: St.peopleSettings({}), store, sheetOf: () => SHEET, user: '주인공' };
  const out = R.withPeopleBlock(msgs, chat, o);
  assert.equal(out.length, 5);
  assert.equal(out[3].role, 'system');
  assert.match(out[3].content, /\[People records\][\s\S]*## 쟈알디/);
  assert.match(out[3].content, /Voice:\n- Short orders\./, '고정 절은 블록 안에');
  assert.doesNotMatch(out[0].content, /Short orders/, '시트 원문은 요청에서 빠짐');
  assert.match(out[3].content, /Relationship → 주인공/);
  // append 모드: 시트는 그대로 두고 블록만 더함
  const out2 = R.withPeopleBlock(msgs, chat, { ...o, settings: St.peopleSettings({ $pp_inject: 'append' }) });
  assert.match(out2[0].content, /Short orders/);
  // 끔
  assert.equal(R.withPeopleBlock(msgs, chat, { ...o, settings: St.peopleSettings({ $pp_inject: 'off' }) }).length, 4);
  // 장면에 없는 인물은 안 넣음
  const chat2 = { message: [{ role: 'user', data: '혼자 걷는다', chatId: 'u1' }], scriptstate: {} };
  assert.equal(R.withPeopleBlock(msgs.slice(0, 2), chat2, o).length, 2);
});

test('미리 만든 자료: 52명, 조직 시작값, 별명 표', () => {
  assert.equal(Object.keys(Base.RELATIONS.people).length, 52);
  assert.equal(Base.userAffinityBase('A00', 'A00'), 0);
  assert.ok(Base.userAffinityBase('A00', 'B00') < 0);
  assert.equal(Base.userAffinityBase('A00', 'E00'), 0);
  const names = Base.allNames();
  const j = names.find((n) => n.name === '쟈알디');
  assert.ok(j.aliases.includes('Jyaldi') && j.titles.includes('부장'));
  assert.ok(Base.valuesOf('쟈알디').length > 10);
});
