// 규칙서 (스테이지 설계서 7장). 공통 12줄 + 유형별 줄.
// - texts[0]이 처음 판, EXIT 재편(2장) 때마다 공통 줄 일부가 texts[n]으로 바뀐다(이전 줄은 취소선).
// - variant: 출동마다 1~2줄이 '이번 출동에는 다름'으로 뒤집힌다. flag는 규칙 엔진(rules.ts)이 읽는다.
import type { FloorType } from '../types';

export interface RuleVariant {
  flag: string;
  text: string;
}
export interface RuleDef {
  id: string;
  scope: 'common' | FloorType | 'service' | 'elevator';
  texts: string[];
  /** 어기면 (화면 표시용) */
  breach: string;
  variant?: RuleVariant;
}

export const RULES: RuleDef[] = [
  { id: 'entry', scope: 'common', texts: ['점검표 서명란이 빈 엘리베이터가 입구다.', '점검표 날짜가 오늘보다 뒤면 그게 입구다.', '거울이 없는 엘리베이터가 입구다.'], breach: '—' },
  { id: 'noreturn', scope: 'elevator', texts: ['타고 온 승강기로는 못 돌아간다. 귀환은 다락방의 로프.', '위층 버튼은 누르지 마라. 귀환은 로프뿐이다.'], breach: '엉뚱한 층' },
  { id: 'close', scope: 'elevator', texts: ['닫힘 버튼을 연타하지 마라.', '열림 버튼을 누르고 있지 마라.'], breach: '총애 -1', variant: { flag: 'close_any', text: '이번 출동: 닫힘 버튼은 한 번만 눌러도 싫어한다.' } },
  { id: 'greet', scope: 'elevator', texts: ['탈 때 인사해라 (E). 대우가 달라진다.', '탈 때 이름을 말해라 (E). 대우가 달라진다.'], breach: '—', variant: { flag: 'greet_flip', text: '이번 출동: 승강기가 말을 걸면 싫어한다. 인사하지 마라.' } },
  { id: 'mirror', scope: 'elevator', texts: ['거울 속 얼굴이 피곤해 보이면 내려라.', '거울 속 얼굴이 웃고 있으면 내려라.'], breach: '그 층 위협 +30%' },
  { id: 'lobby', scope: 'lobby', texts: ['평범해 보이는 것을 믿지 마라.', '시계가 거꾸로 가는 층에서는 등을 보이지 마라.'], breach: '기습' },
  { id: 'attic', scope: 'service', texts: ['다락방에 오래 있지 마라. (90초)', '정비 구역에서 같은 칸에 오래 있지 마라.'], breach: '포식자', variant: { flag: 'attic_short', text: '이번 출동: 정비 구역은 60초면 포식자가 온다.' } },
  { id: 'passenger', scope: 'common', texts: ['친절한 승객이 둘이면 사연이 긴 쪽이 거짓이다.', '승객이 이름을 먼저 물으면 대답하지 마라.'], breach: '유인', variant: { flag: 'passenger_flip', text: '이번 출동: 사연이 짧은 쪽이 거짓이다.' } },
  { id: 'trial', scope: 'trial', texts: ['벽의 목표를 먼저 읽어라.', '목표는 두 번 읽어라. 두 번째가 진짜다.'], breach: '수호자', variant: { flag: 'trial_mid', text: '이번 출동: 목표는 층 한가운데 벽에 적혀 있다.' } },
  { id: 'dark', scope: 'dark', texts: ['어둠에서는 멈추지 마라.', '어둠에서는 빛을 세 번 이상 켜지 마라.'], breach: '체온을 재는 것', variant: { flag: 'dark_fast', text: '이번 출동: 빛이 두 배 빨리 사그라든다.' } },
  { id: 'silent', scope: 'silent', texts: ['소리를 내지 마라. 달리기·점프 착지·공격이 소리다.', '소리를 내지 마라. 문 여닫는 것도 소리다.'], breach: '소환', variant: { flag: 'silent_fast', text: '이번 출동: 소리가 두 배로 울린다.' } },
  { id: 'exit', scope: 'common', texts: ['EXIT는 규칙 10줄 · 총애 3 · B-12 도달 뒤에만 눌러라.'], breach: '후송 · 영구 손실' },
  // 유형별
  { id: 'c_back', scope: 'chase', texts: ['추격: 뒤돌아보지 마라.'], breach: '뒤의 것이 빨라진다' },
  { id: 'c_door', scope: 'chase', texts: ['추격: 문은 닫고 가라 (E).'], breach: '—', variant: { flag: 'chase_fast', text: '이번 출동: 뒤의 것이 더 빠르다. 문을 꼭 닫아라.' } },
  { id: 'p_sign', scope: 'puzzle', texts: ['퍼즐: 표지가 가리키는 문이 정답이다. 표지는 읽어야 보인다.'], breach: '함정', variant: { flag: 'puzzle_mirror', text: '이번 출동: 표지는 거울에 비친 것이다. 반대 문이 정답이다.' } },
  { id: 'p_order', scope: 'puzzle', texts: ['퍼즐: 스위치는 표지에 적힌 순서로만 눌러라.'], breach: '벽이 조여 온다 -10초' },
  { id: 'p_wall', scope: 'puzzle', texts: ['퍼즐: 시간이 다 되면 벽이 조여 온다. 서둘러라.'], breach: '압사' },
  { id: 'r_greet', scope: 'replica', texts: ['아파트: 주민 옆을 지날 때 인사해라 (E).'], breach: '주민이 깨어남', variant: { flag: 'replica_nogreet', text: '이번 출동: 주민과 눈을 마주치지 마라. 인사하지 마라.' } },
  { id: 'r_quiet', scope: 'replica', texts: ['아파트: 복도에서 뛰지 마라.'], breach: '주민이 깨어남' },
  { id: 'r_meal', scope: 'replica', texts: ['아파트: 밥상 앞에서는 「잘 먹었습니다」(E).'], breach: '주민이 깨어남' },
  { id: 'r_things', scope: 'replica', texts: ['빈집: 남의 물건에 손대지 마라.'], breach: '집이 일어난다' },
  { id: 'r_red', scope: 'replica', texts: ['붉은 벽: 붉은 바닥을 밟지 마라.'], breach: '바닥의 손' },
  { id: 'l_clock', scope: 'lobby', texts: ['로비: 거꾸로 가는 시계 앞에서는 걸어라.'], breach: '해롭지 않아 보이는 것' },
  { id: 'b12', scope: 'common', texts: ['벽에 B-12가 적힌 층은 수호자가 두 배로 자주 나온다.'], breach: '—' },
];
export const RULE: Record<string, RuleDef> = Object.fromEntries(RULES.map((r) => [r.id, r]));
export const COMMON_RULE_IDS = RULES.filter((r) => r.scope === 'common' || r.scope === 'elevator' || r.scope === 'service' || r.id === 'lobby' || r.id === 'trial' || r.id === 'dark' || r.id === 'silent').map((r) => r.id);
/** 재편 때 바뀔 수 있는 줄 (texts가 2개 이상) */
export const RESHUFFLE_POOL = RULES.filter((r) => r.texts.length > 1).map((r) => r.id);
export const VARIANT_POOL = RULES.filter((r) => r.variant).map((r) => r.id);

export function ruleText(id: string, epochIndex: number): string {
  const r = RULE[id];
  if (!r) return id;
  return r.texts[Math.min(epochIndex, r.texts.length - 1)];
}
