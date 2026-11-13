// 전수검사 11-13 고침 확인: 상태창 끝 점 날짜, 괴담 등급 영어 낱말, 짧은 첫 획 제스처.
// 실행: node --test tests/fix2-world.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/world';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/world/status.ts', 'src/core/world/tags.ts', 'src/ui/gesture.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const S = await import(pathToFileURL(join(dir, 'core/world/status.mjs')).href);
const T = await import(pathToFileURL(join(dir, 'core/world/tags.mjs')).href);
const { readStroke } = await import(pathToFileURL(join(dir, 'ui/gesture.mjs')).href);

test('상태창: 날짜 끝 점이 있어도 칸이 밀리지 않는다', () => {
  for (const date of ['2025.03.14.', '2025. 3. 14.(금)', '2025.03.14', '2025년 3월 14일 금요일']) {
    const [t] = S.findStatusTags(`[▣|${date}|21:40|🌧️|8°C|서울 본부 3층|이성해|김솔음, 최요원|12,000원]`);
    assert.equal(t.date, date, date);
    assert.equal(t.place, '서울 본부 3층', date);
    assert.equal(t.target, '이성해', date);
    assert.notEqual(S.statusMinute(t.date, t.time), null, date);
  }
});

test('괴담 등급: 영어 낱말 속 글자를 등급으로 읽지 않는다', () => {
  const want = { 'Grade B': 'B', 'Rank D': 'D', 'Grade: B': 'B', 'Class E': 'E', 'B급': 'B', '등급: C': 'C', D: 'D', 'S+': 'S', S: 'S', Safe: 'S', '': '' };
  for (const [v, g] of Object.entries(want)) assert.equal(T.normGrade(v), g, v);
});

const legs = (list) => {
  let x = 400, y = 400;
  const pts = [[x, y]];
  for (const [dx, dy] of list) {
    for (let i = 1; i <= 10; i++) pts.push([x + (dx * i) / 10, y + (dy * i) / 10]);
    x += dx;
    y += dy;
  }
  return pts;
};
test('제스처: 짧은 세로(45~50) + 긴 가로도 두 획으로 읽는다', () => {
  assert.equal(readStroke(legs([[0, -50], [-160, 0]])), 'UL');
  assert.equal(readStroke(legs([[0, 45], [150, 0]])), 'DR');
  assert.equal(readStroke(legs([[-160, 0]])), 'L');
  assert.equal(readStroke(legs([[150, 0]])), 'R');
});
