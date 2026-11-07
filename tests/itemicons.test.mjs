// 소지품 그림 매칭 (2026-11-07 고침): ① 모델이 쓴 그림 찾기 낱말 → ② 이름 글자 조각 점수 → ③ 낮으면 공통 그림. 규칙은 game-src/items/README.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyItemsPack, matchItemIcon } from '../dist-test/core.mjs';
import { itemsPackText } from '../scripts/data-pack.mjs';
import { makeMatcher } from '../game-src/items/match_icon.mjs';

const pack = applyItemsPack(itemsPackText());
const table = JSON.parse(readFileSync(new URL('../game-src/items/icons.json', import.meta.url), 'utf8'));
const names = (f) => table.icons.filter((r) => r.file === f).map((r) => r.name);
const is = (name, icon, want) => {
  const f = matchItemIcon(pack, name, icon);
  assert.ok(names(f).includes(want), `${name}${icon ? `|${icon}` : ''} → ${names(f).join('/') || f} (바란 것 ${want})`);
};

test('팩 모양: 표·그림·공통 그림', () => {
  assert.ok(pack.table.length > 2500 && Object.keys(pack.icons).length >= new Set(pack.table.map((r) => r.f)).size, '표·그림');
  assert.ok(!pack.table.some((r) => r.k.includes('우산 칼')), '「빼」한 줄은 없음');
  assert.ok(pack.base.misc, '공통 그림');
  assert.throws(() => applyItemsPack('{"schema":1,"kind":"world"}'));
});

test('짧은 낱말이 긴 이름 안에 끼어 잡히던 것 (11-07 점검 목록)', () => {
  is('손목시계', '', '손목시계');
  is('기관단총', '', '기관단총');
  is('중기관총', '', '중기관총');
  is('봉지라면', '', '라면 봉지');
  is('후드티', '', '후드티');
  is('확성기', '', '확성기');
  is('신경안정제', '', '안정제');
});

test('띄어쓰기만 다른 것', () => {
  is('야간투시경', '', '야간 투시경');
  is('케이블타이', '', '케이블 타이');
  is('SD카드', '', 'SD 카드');
  is('돋보기 안경', '', '돋보기안경');
  is('이어피스', '', '무선 이어피스');
});

test('비슷한 이름·다른 이름', () => {
  is('방검복', '', '방검 조끼');
  is('성수', '', '성수병');
  is('가스마스크', '', '방독면');
  is('방패', '', '진압 방패');
  is('표본병', '', '괴이 표본 병');
  is('실험 가운', '', '흰 가운');
  is('버터나이프', '', '특제 버터나이프');
  is('간호복', '', '간호사복');
  is('피 묻은 곰인형', '', '피 묻은 인형');
  is('속삭이는 거울', '', '거울');
  is('목이 없는 인형', '', '목 없는 인형');
  is('편의점 삼각김밥', '', '삼각김밥');
  is('folding knife', '', '접이식 칼');
});

test('그림 찾기 낱말이 이름보다 먼저', () => {
  is('침술 키트', 'acupuncture kit', '침');
  is('속삭이는 거울', 'hand mirror', '손거울');
  is('가스마스크', 'gas mask', '방독면');
  is('정체 모를 것', 'wristwatch', '손목시계');
  is('손목시계', 'zzqx', '손목시계'); // 낱말이 안 맞으면 이름으로
});

test('흔한 조각만 맞거나 아무것도 안 맞으면 공통 그림', () => {
  for (const n of ['녹슨 심령 침술 키트', '전혀 모르는 ㅁㄴㅇ', '위장복', '']) assert.equal(matchItemIcon(pack, n), pack.base.misc, n);
});

test('game-src/items/match_icon.mjs 와 플러그인이 같은 답', () => {
  const m = makeMatcher(table);
  const probe = [...table.icons.filter((r) => !r.excluded_note).map((r) => r.name), '손목시계', '봉지라면', '확성기', '녹슨 심령 침술 키트', '피 묻은 곰인형', '가죽 장갑'];
  for (const n of probe) assert.equal(matchItemIcon(pack, n), m(n), n);
  for (const [n, i] of [['침술 키트', 'acupuncture kit'], ['아무거나', 'gas mask'], ['상자', 'box']]) assert.equal(matchItemIcon(pack, n, i), m(n, i), `${n}|${i}`);
});
