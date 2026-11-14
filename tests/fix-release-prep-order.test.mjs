// 릴리스 준비 순서 (재검토 11-14 loader#10): 카드 빌드가 팩의 원료(src/data/install/*.json · src/data/world/greetings.json)를 다시 쓰므로
// 플러그인 빌드는 카드 빌드 뒤, dist → release 복사 앞이어야 한다. --dry 로 순서만 본다 (아무것도 바꾸지 않는다).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const dry = (...args) => spawnSync(process.execPath, [fileURLToPath(new URL('scripts/release-prep.mjs', root)), '--dry', '--skip-tests', ...args], { cwd: fileURLToPath(root), encoding: 'utf8' }).stdout;
const at = (out, re) => out.split('\n').findIndex((l) => re.test(l));

test('release:prep — 카드 빌드 → 플러그인 빌드 → release 복사 순서', { skip: !existsSync(new URL('card/원본_봇카드.jpeg', root)) }, () => {
  const out = dry();
  const lines = out.split('\n');
  const builds = lines.map((l, i) => (/npm run build/.test(l) ? i : -1)).filter((i) => i >= 0);
  const card = at(out, /tools\/build_lite_card\.py .*release\//), build = builds.length ? builds[builds.length - 1] : -1, copy = at(out, /dist → release/);
  assert.ok(card >= 0 && build >= 0, `카드 빌드·플러그인 빌드 줄이 있어야 함:\n${out}`);
  assert.ok(card < build, '플러그인 빌드는 카드 빌드(팩 원료를 다시 씀) 뒤');
  assert.ok(copy >= 0, `dist → release 복사 줄이 있어야 함:\n${out}`);
  assert.ok(build < copy, '플러그인 빌드는 dist → release 복사 앞');
  // 카드 빌드는 scripts/migrate-lore.mjs 로 dist-test/core.mjs(빌드 결과, git 에 없음)를 읽는다 → 카드 앞에도 빌드가 있어야 한다
  assert.ok(builds[0] < card, '카드 빌드 앞에도 빌드가 있어야 함 (dist-test/core.mjs 를 지금 소스로)');
  assert.equal(builds.length, 2, '빌드는 카드 앞 한 번 · 카드 뒤 한 번');
  assert.equal(builds.filter((i) => i > card && i < copy).length, 1, '카드 빌드와 복사 사이의 빌드는 한 번');
});

test('release:prep — 카드 빌드가 dist-test/core.mjs 를 읽는다는 전제가 그대로인지', () => {
  const src = readFileSync(new URL('scripts/migrate-lore.mjs', root), 'utf8');
  assert.match(src, /dist-test\/core\.mjs/);
});

test('release:prep --no-card — 그래도 빌드는 돈다', () => {
  const out = dry('--no-card');
  assert.ok(at(out, /npm run build/) >= 0, out);
  assert.equal(at(out, /tools\/build_lite_card\.py .*release\//), -1);
  assert.equal(out.split('\n').filter((l) => /npm run build/.test(l)).length, 1, '카드 빌드가 없으면 빌드는 한 번');
});
