// 11-14 사용자 B-11: 폰·좁은 창에서는 요원 목록이 드롭다운 한 줄로 바뀌어 순서 ▲▼가 안 보였다 → 요원 기록 머리의 이름 옆에 같은 단추
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1114/b11';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: { record: 'src/ui/editor/record.ts' },
  outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' },
  loader: { '.txt': 'text', '.css': 'text', '.svg': 'text', '.png': 'dataurl', '.webp': 'dataurl' }, logLevel: 'silent',
});
const R = await import(pathToFileURL(resolve(join(dir, 'record.mjs'))));
const css = await readFile('src/ui/editor/style.css', 'utf8');

const agent = (lore, name, affiliation) => ({ lore, name, affiliation, team: '' });
const d = { agents: [agent('가', '가 요원', '관리국'), agent('나', '나 요원', '관리국'), agent('다', '다 요원', '관리국'), agent('라', '라 요원', '다른 곳')] };

test('요원 기록 머리(이름 옆)에 목록 줄과 같은 ▲▼ 단추가 들어간다', () => {
  const html = R.headMove('agent', d, '나');
  assert.match(html, /^<span class="gw-hmove">/);
  assert.equal(html, `<span class="gw-hmove">${R.agentMoveButtons(d, '나')}</span>`, '목록 줄과 같은 단추');
  assert.match(html, /data-action="dir-move" data-value="up\|나" aria-label="나 요원 위로"/);
  assert.match(html, /data-action="dir-move" data-value="down\|나" aria-label="나 요원 아래로"/);
  assert.doesNotMatch(html, /disabled/);
});

test('같은 소속의 맨 위·맨 아래에서는 그쪽 단추가 꺼진다', () => {
  assert.match(R.headMove('agent', d, '가'), /aria-label="가 요원 위로" title="위로" disabled/);
  assert.doesNotMatch(R.headMove('agent', d, '가'), /아래로" title="아래로" disabled/);
  assert.match(R.headMove('agent', d, '다'), /aria-label="다 요원 아래로" title="아래로" disabled/);
});

test('요원이 아니거나 명부에 없는 이름이면 단추가 없다', () => {
  assert.equal(R.headMove('org', d, '가'), '');
  assert.equal(R.headMove('agent', d, '없는 이름'), '');
});

test('CSS: 넓은 창에서는 숨기고, 목록이 드롭다운으로 바뀌는 두 규칙(좁은 칸·좁은 화면)에서만 보인다', () => {
  assert.match(css, /\n\.gw-head h2 \.gw-hmove \{ display: none;/);
  const shown = [...css.matchAll(/\.gw-list-pane \.gw-list-pick \{ display: block;[^\n]*\n  \.gw-head h2 \.gw-hmove \{ display: inline-flex; \}/g)];
  assert.equal(shown.length, 2, '@container 600 과 @media 760 두 곳');
});
