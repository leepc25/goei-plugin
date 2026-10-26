import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-identity-'));
await build({ entryPoints: ['src/core/world/status.ts', 'src/core/statusctx.ts', 'src/core/people/identity.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const S = await import(pathToFileURL(join(dir, 'core/world/status.mjs')));
const C = await import(pathToFileURL(join(dir, 'core/statusctx.mjs')));
const I = await import(pathToFileURL(join(dir, 'core/people/identity.mjs')));

test('상태창 9칸: 신분 칸을 읽고, 8칸·6칸은 그대로', () => {
  const t9 = S.findStatusTags('[▣|2025.01.01|10:15 PM|🌫️|9°C|명일 아파트|명일 아파트|쟈알디,에일린|투입|관리국/요원]')[0];
  assert.equal(t9.identity, '관리국/요원');
  assert.deepEqual(t9.companions, ['쟈알디', '에일린']);
  assert.equal(t9.deployed, true);
  assert.equal(t9.target, '명일 아파트');
  const t8 = S.findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음|없음|없음]')[0];
  assert.equal(t8.identity, '');
  assert.equal(t8.deployed, false);
  const t6 = S.findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음]')[0];
  assert.equal(t6.identity, '');
  assert.equal(t6.deployed, null);
  const t9b = S.findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음|없음|없음|없음]')[0];
  assert.equal(t9b.identity, '', '없음은 빈 값');
});

test('신분 해석: 조직 코드·직급 사다리·상하 비교', () => {
  const a = I.parseIdentity('관리국/신입', 'c1');
  assert.deepEqual([a.faction, a.rank, a.level], ['A00', '신입', 0]);
  assert.equal(I.parseIdentity('가짜 관리국/대리', 'c1').level, 3);
  assert.equal(I.parseIdentity('가짜 관리국/대리', 'c1').faction, 'B00');
  assert.equal(I.parseIdentity('백일몽/사원', 'c1').level, 1);
  assert.equal(I.parseIdentity('프리랜서/5급', 'c1').level, 0);
  assert.equal(I.parseIdentity('프리랜서/특급', 'c1').level, 5);
  assert.deepEqual([I.parseIdentity('민간인/-', 'c1').faction, I.parseIdentity('민간인/-', 'c1').level], ['D00', null]);
  assert.equal(I.parseIdentity('없음', 'c1'), null);
  assert.equal(I.parseIdentity('관리국/선임 요원', 'c1').level, 2);
  assert.equal(I.relativeRank(a, 'A00', 3), 'down', '신입은 부장보다 아래');
  assert.equal(I.relativeRank(I.parseIdentity('관리국/부장', 'c1'), 'A00', 2), 'up');
  assert.equal(I.relativeRank(a, 'B00', 1), 'outsider');
  assert.equal(I.identityText(a), '관리국/신입');
});

test('직전 상태 블록: 8칸 줄에 아는 신분을 채운다. 9칸이면 그대로', () => {
  const line8 = '[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음|없음|없음]';
  assert.equal(C.withIdentity(line8, '관리국/신입'), '[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음|없음|없음|관리국/신입]');
  const line9 = '[▣|2025.01.01|02:47 AM|☀️|4°C|서울|없음|없음|없음|백일몽/대리]';
  assert.equal(C.withIdentity(line9, '관리국/신입'), line9);
  assert.equal(C.withIdentity(line8, ''), line8);
  const msgs = [{ role: 'assistant', content: `본문\n${line8}` }, { role: 'user', content: '다음' }];
  const out = C.withStatusBlock(msgs, '관리국/신입');
  assert.match(out[1].content, /관리국\/신입\]/);
});
