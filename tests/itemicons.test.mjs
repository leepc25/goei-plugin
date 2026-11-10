// 소지품 그림 매칭 (2026-11-07 다시 짬): ① 몸통 말이 같은 그림 중 꾸밈말로 → ② 글자 조각 점수 → ③ 못 찾으면 공통 그림. 규칙은 game-src/items/README.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyItemsPack, matchItemIcon, readIconMisses } from '../dist-test/core.mjs';
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
  is('우리가 돕는다!', '', '우리가 도움'); // 위키 「위 헬프!」를 모델이 옮겨 쓴 이름 (11-08)
  is('우리가 돕는다!', 'golden pager', '우리가 도움');
});

test('띄어쓰기만 다른 것', () => {
  is('야간투시경', '', '야간 투시경');
  is('케이블타이', '', '케이블 타이');
  is('SD카드', '', 'SD 카드');
  is('돋보기 안경', '', '돋보기안경');
  is('무선 이어피스', '', '무선 이어피스');
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
  is('침술 키트', 'acupuncture needles', '침');
  is('속삭이는 거울', 'hand mirror', '손거울');
  is('가스마스크', 'gas mask', '방독면');
  is('정체 모를 것', 'wristwatch', '손목시계');
  is('손목시계', 'zzqx', '손목시계'); // 낱말이 안 맞으면 이름으로
});

test('몸통 말 먼저: 꾸밈말에 끌려가지 않음 (11-07 사용자 지적)', () => {
  is('', 'pump shotgun', '펌프 산탄총'); // 펌프 그림(성인용품)으로 가지 않음
  is('', 'old mask', '가면');
  is('', 'old leather bag', '가방');
  is('리버레이터', 'liberator pistol', '권총'); // 표에 없는 이름도 낱말 끝(종류 말)으로
  is('낡은 침', '', '침');
  is('낡은 향', '', '향');
  is('낡은 무전기', '', '무전기');
  is('녹슨 솔방울', '', '솔방울');
  is('녹슨 목걸이 열쇠', '', '목걸이 열쇠');
  is('검은 구급상자', '', '구급상자');
  is('', 'old butterfly knife', '발리송');
  is('쿠크리', 'kukri knife', '쿠크리'); // 낱말은 몸통만 맞고 이름은 표의 말 그대로면 이름
  is('이빨나무', '', '이빨 나무 가지');
  is('이빨요정 선물상자', '', '이빨 요정 선물 상자');
  is('봉인 상자 2', '', '봉인 상자'); // 끝 번호는 몸통 아님
});

test('앞말이 안 맞으면 몸통 말 대표 그림, 키트·세트·장치는 떼고 앞말로 (11-08 사용자 「매칭 더 정교하게」)', () => {
  is('생체 신호 은폐 패치', 'concealment patch', '파스');
  is('방수 전술 랜턴', 'tactical lantern', '전기 랜턴');
  is('향초 세트', 'candle set', '향초');
  is('경보 장치', '', '가스 경보기'); // 장치 = ~기
  is('탐지 장치', '', '금속 탐지기');
  is('구급 상자', '', '구급상자'); // 표의 말 그대로면 그대로
  assert.equal(matchItemIcon(pack, '낚시 도구 세트'), pack.base.misc, '낚시 도구 세트'); // 「도구 세트」만 맞아 해부 도구 세트로 가지 않음
  is('괴이 탐지 장치', '', '금속 탐지기'); // 장치 → ~기, 「탐지기」 몸통이 같은 그림 (11-09: 상자 대신 같은 종류 그림)
});

test('꾸밈말이 안 맞아도 몸통 말이 같으면 같은 종류 그림 (11-09 사용자: 그림 3천 장인데 재킷이 상자로 나오면 안 된다)', () => {
  is('기본 지급용 재킷', '', '가죽 재킷');
  is('검은 재킷', '', '가죽 재킷');
  is('관리국 지급 재킷', '', '가죽 재킷');
  assert.equal(matchItemIcon(pack, '기본 지급품'), pack.base.misc, '몸통 말이 표에 없으면 공통 그림');
});

test('끝에 붙은 용량·등급은 몸통이 아님 (11-09 사용자: 「앰플 30ml」「앰플 (C급)」이 단지·상자로 나옴)', () => {
  is('백일몽 탈모 완화 앰플 30ml', '', '앰플');
  is('백일몽 신체 재생 앰플 (C급)', '', '앰플');
  is('생수 500ml', '', '생수 2L');
  is('꿈결 수집기 (S급)', '', '꿈결 수집기 S등급'); // 등급은 꾸밈말로 남아 등급별 그림을 가른다
  is('꿈결 수집기 F', '', '꿈결 수집기 F등급');
  is('소원권', '', '소원권');
  is('백일몽 재생 물약 F형', '', '물약'); // 「F형」도 등급 꼴 (11-09 사용자 화면)
});

test('종류/물건말 (11-09 사용자: 매칭기 재설계) — 종류 안에서 찾고, 없으면 종류 안 비슷한 그림·종류 대표', () => {
  is('백일몽 규격 방호 정장 외투', '옷/외투', '트렌치코트'); // 대체 표 외투 → 코트
  is('백일몽 규격 방호 정장 외투', '', '트렌치코트');
  is('꿈결 추출 안정수 D급', '의료/안정수', '안정제');
  is('규격 방검 및 방호 내의', '옷/내의', '팬티');
  is('고농축 전해질 영양 바 세트', '음식/영양 바', '에너지바');
  is('D조 추천 비상 섬광 트랩', '도구/덫', '덫');
  is('현장용 차폐 스프레이', 'canister', '기억 지우개 스프레이'); // 한국어 몸통 말이 영어 낱말(몸통만 맞음)보다 먼저
  is('이상한 돌', '괴이/돌멩이', '눈 달린 돌'); // 종류 안에서 (다른 종류의 돌멩이로 가지 않음)
  const kindOf = (f) => table.icons.find((r) => r.file === f)?.kind;
  assert.equal(kindOf(matchItemIcon(pack, '백일몽 앰플', '의료/앰플')), 'medical', '앰플|의료 → 봉인 앰플 아님 (릴리스 점검 11-09)');
  is('후추 스프레이', '무기/스프레이', '호신용 스프레이');
  is('코 스프레이', '의료/스프레이', '비강 스프레이');
  is('손전등', '', '손전등'); // 대체 표로 케미컬 라이트가 되지 않음
  const f = matchItemIcon(pack, '미니 에어로 건조 세탁기', '기기/세탁기');
  assert.ok(f && table.icons.some((r) => r.file === f && r.kind === 'device'), '세탁기 그림이 없으면 기기 종류 안에서 (상자 아님)');
  assert.ok(readIconMisses().some((m) => m.name === '미니 에어로 건조 세탁기'), '못 찾은 말 기록');
});

test('흔한 조각만 맞거나 아무것도 안 맞으면 공통 그림', () => {
  for (const n of ['침술 키트', '녹슨 심령 침술 키트', '전혀 모르는 ㅁㄴㅇ', '리버레이터', '']) assert.equal(matchItemIcon(pack, n), pack.base.misc, n);
});

test('game-src/items/match_icon.mjs 와 플러그인이 같은 답', () => {
  const m = makeMatcher(table);
  const probe = [...table.icons.filter((r) => !r.excluded_note).map((r) => r.name), '손목시계', '봉지라면', '확성기', '녹슨 심령 침술 키트', '피 묻은 곰인형', '가죽 장갑'];
  for (const n of probe) assert.equal(matchItemIcon(pack, n), m(n), n);
  for (const [n, i] of [['침술 키트', 'acupuncture kit'], ['아무거나', 'gas mask'], ['상자', 'box'], ['생체 신호 은폐 패치', 'concealment patch'], ['경보 장치', 'alarm device'], ['향초 세트', 'candle set'], ['낚시 도구 세트', 'fishing set'], ['백일몽 신체 재생 앰플 (C급)', 'ampoule'], ['탈모 완화 앰플 30ml', ''], ['백일몽 규격 방호 정장 외투', '옷/외투'], ['미니 에어로 건조 세탁기', '기기/세탁기'], ['규격 방검 및 방호 내의', '옷/내의'], ['현장용 차폐 스프레이', 'canister']]) assert.equal(matchItemIcon(pack, n, i), m(n, i), `${n}|${i}`);
});

test('글 제목에서 물건 그림 찾기 (연어 마켓 매물, 2026-11-10 사용자: 방검복·라디오조차 안 맞았다)', async () => {
  const { matchTitleIcon } = await import('../dist-test/core.mjs');
  const t = (title, want) => {
    const f = matchTitleIcon(pack, title);
    assert.ok(f && names(f).includes(want), `${title} → ${f ? names(f).join('/') : '없음'} (바란 것 ${want})`);
  };
  t('구형 방검복 상하의 세트', '방검 조끼');
  t('아날로그 다이얼 진공관 라디오 (작동 확인)', '라디오');
  t('구리 합금 육각 나침반', '나침반');
  t('낡은 군용 손전등 건전지 포함', '손전등');
  t('은장 회중시계 고장', '회중시계');
  t('현장용 무전기 한 쌍 충전기 포함', '무전기');
  t('가죽 장갑', '가죽 장갑');
});
