// 전수검사 11-13: style.css 고침이 되돌아가지 않게 규칙 글을 확인한다 (CSS 만 읽음, 묶기 없음)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/ui/style.css', 'utf8');
const rule = (sel) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `${sel} 없음`);
  return css.slice(i, css.indexOf('}', i));
};
/** @container (max-width: N) 덩어리 본문 */
const container = (n) => {
  const head = `@container (max-width: ${n}px) {`;
  const i = css.indexOf(head);
  assert.ok(i >= 0, `${head} 없음`);
  const j = css.indexOf('\n}\n', i);
  return css.slice(i, j);
};

test('shop#13: 상점 알림 칸은 높이 상한 안에서 스크롤, 줄어들지 않는다', () => {
  const r = rule('.sh-err');
  assert.match(r, /flex: none/);
  assert.match(r, /max-height: 40vh/);
  assert.match(r, /overflow-y: auto/);
});

test('dirstatus#7: 지도·목록 높이 기준이 패널(90%)과 같다', () => {
  assert.equal(css.includes('min(100vh - 28px, 950px)'), false);
  assert.equal(css.split('min((100vh - 28px) * .9, 950px)').length - 1, 4);
});

test('css#3: 값 등급 표는 좁은 설정 본문에서 두 줄 배치', () => {
  const b = container(1050);
  assert.match(b, /\.ms-tb > \.ms-tb-h, \.ms-tb > \.ms-tb-r \{ grid-template-columns: minmax\(0, 1fr\) 104px 104px 34px; grid-template-areas: "n lo hi x" "d d w w";/);
  assert.match(b, /\.ms-axs > \.ms-tb-h, \.ms-axs > \.ms-ax \{/);
  assert.equal(b.includes('.ms-pairs'), false);
});

test('css#6: 호출 도식은 좁은 설정 본문에서 두 줄 배치', () => {
  const b = container(660);
  assert.match(b, /\.pp-fn \{ grid-template-columns: minmax\(0, 1fr\) auto; grid-template-areas: 'name go' 'calls ctl'; \}/);
  assert.match(b, /\.pp-fn-ctl \.gx-segs \{ flex-wrap: wrap;/);
});

test('css#8: 뽑기 예 「상황용」은 있는 강조색(--signal)', () => {
  assert.match(rule('.ms-sample i'), /color: var\(--signal\)/);
});

test('peopleui#14: 사원증 닫기 36, 아래 단추 작은 조작 규격', () => {
  assert.match(rule('.gx-agcard-x'), /width: 36px; height: 36px/);
  assert.match(rule('.gx-agcard-band'), /height: 36px/);
  assert.match(rule('.gx-agcard-foot button'), /height: var\(--ctl-sm\)/);
});
