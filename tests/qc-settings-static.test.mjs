// QC 03 · 정적 점검: UI 코드의 Risu 제약(eval 없음·form 제출 의존 없음·본 화면 setAttribute 는 x- 만)과
// 스타일시트의 CSS 변수 누락(쓰는데 어느 테마에도 정의되지 않은 변수).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const uiFiles = [...walk(join(root, 'ui')), ...walk(join(root, 'host'))].filter((p) => p.endsWith('.ts'));

test('UI 코드에 eval·new Function 이 없다', () => {
  const bad = uiFiles.filter((p) => /\beval\s*\(|new Function\s*\(/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(bad, []);
});

test('플러그인 창은 form 제출에 기대지 않는다 (iframe 에 allow-forms 없음)', () => {
  const bad = uiFiles.filter((p) => /<form\b/.test(readFileSync(p, 'utf8')));
  assert.deepEqual(bad, [], '<form> 을 그리는 UI 파일');
  // data-take / data-enter 로 받는 입력 단추가 실제로 있다
  const app = readFileSync(join(root, 'ui/app.ts'), 'utf8');
  assert.ok(app.includes('data-take') && app.includes('dataset.enter'));
});

test('본 화면(getRootDocument) 요소에는 x- 속성만 setAttribute 한다', () => {
  // host/overlay.ts 와 host/openinghint.ts 가 본 화면을 만진다. SafeElement.setAttribute 호출의 키가 전부 x- 로 시작해야 한다
  for (const f of ['host/overlay.ts', 'host/openinghint.ts', 'host/container.ts']) {
    const src = readFileSync(join(root, f), 'utf8');
    const calls = [...src.matchAll(/\.setAttribute\(\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2]);
    const bad = calls.filter((k) => !k.startsWith('x-'));
    assert.deepEqual(bad, [], `${f}: x- 가 아닌 setAttribute 키`);
  }
});

test('스타일시트가 쓰는 CSS 변수는 모두 정의돼 있다 (테마 3종 공통)', () => {
  const css = ['ui/style.css', 'ui/editor/style.css'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
  const defined = new Set([...css.matchAll(/(^|[\s;{])(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[2]));
  // JS 가 style 속성으로 넣는 변수 (--gw-width 창 폭 · --stbar 설정 줄 높이 · --nw 위키 문서 색 · --st 요원 상태 색 · --pic 상황 그림 · --px/--py 지도 초점 · --goei-* 채팅 속 카드)
  for (const v of ['--gw-width', '--stbar', '--nw', '--st', '--pic', '--px', '--py', '--goei-void', '--goei-panel', '--goei-line', '--goei-text', '--goei-sub', '--goei-signal', '--goei-accentBg', '--goei-accentLine', '--goei-scrim']) defined.add(v);
  const used = [...css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(,|\))/g)].map((m) => [m[1], m[2] === ',']);
  const missing = [...new Set(used.filter(([v, fallback]) => !defined.has(v) && !fallback).map(([v]) => v))];
  assert.deepEqual(missing, [], '정의 없이 쓰는 CSS 변수');
  // 테마 블록 세 개(:root 다크, light, paper)가 같은 변수 묶음을 정의한다
  const main = readFileSync(join(root, 'ui/style.css'), 'utf8');
  const block = (re) => { const m = re.exec(main); return m ? new Set([...m[1].matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((x) => x[1])) : new Set(); };
  const dark = block(/\.gx,\s*\.gw\s*\{([\s\S]*?)\}/) .size ? block(/\.gx,\s*\.gw\s*\{([\s\S]*?)\}/) : block(/:root\s*\{([\s\S]*?)\}/);
  const light = block(/\[data-theme="light"\][^{]*\{([\s\S]*?)\}/);
  const paper = block(/\[data-theme="paper"\][^{]*\{([\s\S]*?)\}/);
  const palette = [...dark].filter((v) => !['--font', '--mono'].includes(v));
  assert.ok(palette.length >= 20, `다크 배색 변수 ${palette.length}개`);
  assert.deepEqual(palette.filter((v) => !light.has(v)), [], '라이트에 빠진 변수');
  assert.deepEqual(palette.filter((v) => !paper.has(v)), [], '페이퍼에 빠진 변수');
});
