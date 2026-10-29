// 미리 만든 자료: 호칭 표 시드 (유저 신분에 따른 상급·동급·하급·외부인 호칭)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-base-'));
await build({
  entryPoints: ['src/core/people/base.ts', 'src/core/people/identity.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const B = await mod('base');
const I = await mod('identity');

test('호칭 표: 52명 전부 있고 말투는 5종 안', () => {
  const names = Object.keys(B.ADDRESS.names);
  assert.equal(names.length, 52);
  for (const n of names) {
    const row = B.ADDRESS.names[n];
    assert.ok(['존댓말', '반말', '혼합', '하게체', '하오체'].includes(row.register), `${n} 말투`);
    assert.ok(row.outsider, `${n} 외부인 호칭`);
    assert.ok(B.RELATIONS.people[n], `${n} relations-base 에 있음`);
  }
  assert.equal(B.ADDRESS.names.쟈알디.register, '반말');
  assert.equal(B.ADDRESS.names.고그니쟈.register, '하게체');
});

test('시작 호칭: 유저 신분으로 상급·동급·하급·외부인을 고른다', () => {
  const senior = I.parseIdentity('관리국/부장', '#1');
  const rookie = I.parseIdentity('관리국/신입', '#1');
  const company = I.parseIdentity('회사/대리', '#1');
  const row = B.ADDRESS.names.잼트리; // A00, level 2
  assert.deepEqual(B.seedAddress('잼트리', 'A00', senior), { toUser: row.up, register: row.register });
  assert.deepEqual(B.seedAddress('잼트리', 'A00', rookie), { toUser: row.down, register: row.register });
  assert.equal(B.seedAddress('잼트리', 'A00', company).toUser, row.outsider);
  assert.equal(B.seedAddress('잼트리', 'A00', undefined).toUser, row.outsider, '신분 모르면 외부인');
  assert.equal(B.seedAddress('없는사람', 'A00', senior), undefined);
});

test('시작값 한 벌: 소속·표현·호감 시작값·별명·호칭', () => {
  const b = B.seedBaseFor('잼트리', 'A00', I.parseIdentity('관리국/요원', '#1'));
  assert.equal(b.faction, 'A00');
  assert.ok(b.address?.toUser);
  assert.ok(Array.isArray(b.aliases));
  assert.equal(B.seedBaseFor('없는사람', '', undefined).address, undefined);
});
