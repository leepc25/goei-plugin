// 공용 그림 고르기 (src/core/sharedpics.ts)와 요원 성별 (명부 칸 → 로어북 Gender 줄)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situationShared, baseShared, orgShared, agentShared, loreGender, agentGender, readDirectory } from '../dist-test/core.mjs';

test('situations pick by place, mystic sites by what they are', () => {
  assert.equal(situationShared('in', '평택항 컨테이너 터미널', '컨테이너 야적장 화재')[0], 'Situation Incident Port');
  assert.match(situationShared('an', '샛별 고시원')[0], /^Situation Anomaly Apartment [12]$/);
  assert.match(situationShared('an', '유계역')[0], /^Situation Anomaly Subway [12]$/);
  assert.equal(situationShared('ms', '이정 책방', '지하철역 앞')[0], 'Situation Mystic Bookshop');
  assert.equal(situationShared('ms', '무엇이든 자판기')[0], 'Situation Mystic Vending');
  const odd = situationShared('ms', '이상한 그것');
  assert.equal(odd.at(-1), 'Situation Mystic');
  assert.ok(odd.includes('Situation Mystic Door'));
  // 같은 이름은 늘 같은 순서
  assert.deepEqual(situationShared('an', '모르는 곳'), situationShared('an', '모르는 곳'));
});

test('one-letter place words match only whole word ends, new places fall back until drawn', () => {
  // 광역시의 '역'이 지하철로 가면 안 됨 (2026-10-21 사용자 스샷: 영화관이 지하철 그림)
  const cinema = situationShared('an', '충장로 구시가지 영화관', '광주광역시 동구 낡은 상영관에서 사람이 사라진다');
  assert.match(cinema[0], /^Situation Anomaly Theater [12]$/);
  assert.match(cinema[2], /^Situation Anomaly Ruin [12]$/);
  assert.ok(!/Subway|Forest/.test(situationShared('an', '이상한 횟집', '부산광역시 해운대구 지역 주민의 얼굴')[0]));
  assert.match(situationShared('an', '북한산 둘레길')[0], /^Situation Anomaly Forest/);
  assert.match(situationShared('an', '폐공장')[0], /^Situation Anomaly Ruin/);
  assert.match(situationShared('an', '새벽 편의점', '서울특별시 강남구')[0], /^Situation Anomaly Store/);
  // 이름이 상황 글보다 먼저
  assert.match(situationShared('an', '은하 목욕탕', '지하철 타고 온 손님')[0], /^Situation Anomaly Bathhouse/);
});

test('bases and orgs pick by name words', () => {
  assert.equal(baseShared('관리국 본부')[0], 'Shared Base Office');
  assert.equal(baseShared('서울중앙성원')[0], 'Shared Base Religious');
  assert.equal(baseShared('비밀 아지트').at(-2), 'Shared Base Hideout');
  assert.equal(orgShared('백일몽 주식회사')[0], 'Shared Org Corporate');
  assert.equal(orgShared('민간 모임', 'civilian')[0], 'Civilian');
  assert.equal(orgShared('아무개').at(-1), 'Shared Org Office');
});

test('agents pick outfit by org, gender, one of three by name', () => {
  const a = agentShared('관리국', 'A00', 'F', '쟈알디');
  assert.match(a[0], /^Shared Agent Suit Female [123]$/);
  assert.equal(new Set(a.slice(0, 3)).size, 3);
  assert.deepEqual(agentShared('관리국', 'A00', 'F', '쟈알디'), a);
  assert.match(agentShared('백일몽', 'C00', 'M', 'x')[0], /^Shared Agent Masked Male/);
  assert.match(agentShared('관리국', 'A00', '', 'x')[0], /^Shared Agent Religious/);
  assert.match(agentShared('발푸르기스', '', 'F', 'x')[0], /^Shared Agent Occult/);
});

test('gender: directory field first, then the lorebook Gender line', () => {
  const lore = [{ comment: '가', content: '- Gender: Female\n' }, { comment: '나', content: '성별: 남' }, { comment: '다', content: '설명 없음' }];
  assert.equal(loreGender(lore, '가'), 'F');
  assert.equal(loreGender(lore, '나'), 'M');
  assert.equal(loreGender(lore, '다'), '');
  assert.equal(agentGender({ lore: '가' }, lore), 'F');
  assert.equal(agentGender({ lore: '가', gender: 'M' }, lore), 'M');
  assert.equal(agentGender({ lore: '가', gender: 'X' }, lore), '');
  assert.equal(readDirectory([]).agents.length, 0);
});
