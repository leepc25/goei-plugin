// 릴리스 준비 순서 (재검토 11-14 loader#10): 카드 빌드가 팩의 원료(src/data/install/*.json · src/data/world/greetings.json)를 다시 쓰므로
// 플러그인 빌드는 카드 빌드 뒤, dist → release 복사 앞이어야 한다. --dry 로 순서만 본다 (아무것도 바꾸지 않는다).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const dry = (...args) => spawnSync(process.execPath, [fileURLToPath(new URL('scripts/release-prep.mjs', root)), '--dry', '--skip-tests', ...args], { cwd: fileURLToPath(root), encoding: 'utf8' }).stdout;
const at = (out, re) => out.split('\n').findIndex((l) => re.test(l));

test('release:prep — 카드 빌드 → 플러그인 빌드 → release 복사 순서', { skip: !existsSync(new URL('card/원본_봇카드.jpeg', root)) }, () => {
  const out = dry();
  const card = at(out, /tools\/build_lite_card\.py .*release\//), build = at(out, /npm run build/), copy = at(out, /dist → release/);
  assert.ok(card >= 0 && build >= 0, `카드 빌드·플러그인 빌드 줄이 있어야 함:\n${out}`);
  assert.ok(card < build, '플러그인 빌드는 카드 빌드(팩 원료를 다시 씀) 뒤');
  if (copy >= 0) assert.ok(build < copy, '플러그인 빌드는 dist → release 복사 앞');
  assert.equal(out.split('\n').filter((l) => /npm run build/.test(l)).length, 1, '빌드는 한 번');
});

test('release:prep --no-card — 그래도 빌드는 돈다', () => {
  const out = dry('--no-card');
  assert.ok(at(out, /npm run build/) >= 0, out);
  assert.equal(at(out, /tools\/build_lite_card\.py .*release\//), -1);
});
