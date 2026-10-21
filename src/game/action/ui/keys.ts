// 조작 표: 기본 기획서 부록 A. 터치·게임패드도 이 KeyboardEvent.code 를 누르고 뗀다 (엔진은 키보드만 알면 된다).
export type Act =
  | 'left' | 'right' | 'up' | 'down'
  | 'attack' | 'shoot' | 'unique' | 'guard' | 'ult' | 'interact'
  | 'jump' | 'evade' | 'item1' | 'item2' | 'item3' | 'item4'
  | 'support' | 'map' | 'auto' | 'menu' | 'reload' | 'hitbox';

export const CODE: Record<Act, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  attack: 'KeyA',
  shoot: 'KeyS',
  unique: 'KeyD',
  guard: 'KeyQ',
  ult: 'KeyW',
  interact: 'KeyE',
  jump: 'Space',
  evade: 'ShiftLeft',
  item1: 'Digit1',
  item2: 'Digit2',
  item3: 'Digit3',
  item4: 'Digit4',
  support: 'KeyC',
  map: 'KeyZ',
  auto: 'KeyX',
  menu: 'Escape',
  reload: 'KeyR',
  hitbox: 'KeyH',
};

/** 키보드에서 같은 행동으로 받는 다른 키 */
export const ALIAS: Record<string, string> = { ShiftRight: 'ShiftLeft', Tab: 'KeyZ', Numpad1: 'Digit1', Numpad2: 'Digit2', Numpad3: 'Digit3', Numpad4: 'Digit4' };

export const KEY_OF: Record<string, string> = {
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyC: 'c', KeyZ: 'z', KeyX: 'x', KeyR: 'r', KeyH: 'h',
  Space: ' ', ShiftLeft: 'Shift', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Escape: 'Escape', Tab: 'Tab', Enter: 'Enter',
};

export const LABEL: Record<Act, string> = {
  left: '왼쪽', right: '오른쪽', up: '위(안쪽)', down: '아래(앞쪽)·두 번 앉기',
  attack: '근접 (연타 3타)', shoot: '원거리', unique: '고유기 (짧게·길게)', guard: '가드 (누른 채)', ult: '필살기 (게이지 가득)', interact: '상호작용·줍기',
  jump: '점프', evade: '짧게 회피 · 누른 채 달리기', item1: '아이템 1', item2: '아이템 2', item3: '아이템 3', item4: '아이템 4',
  support: '지원 요원 호출', map: '지도', auto: '자동 전환', menu: '메뉴', reload: '재장전', hitbox: '판정 보기',
};

/** 화면에 보이는 키 이름 */
export const KEY_NAME: Record<Act, string> = {
  left: '←', right: '→', up: '↑', down: '↓', attack: 'A', shoot: 'S', unique: 'D', guard: 'Q', ult: 'W', interact: 'E',
  jump: 'Space', evade: 'Shift', item1: '1', item2: '2', item3: '3', item4: '4', support: 'C', map: 'Z', auto: 'X', menu: 'Esc', reload: 'R', hitbox: 'H',
};

/** 표준 배치 게임패드 (Xbox 이름 기준). 버튼 번호 → 키 */
export const PAD_BUTTON: Record<number, string> = {
  0: 'Space', // A 점프
  1: 'KeyE', // B 상호작용
  2: 'KeyA', // X 근접
  3: 'KeyS', // Y 원거리
  4: 'KeyQ', // LB 가드
  5: 'ShiftLeft', // RB 회피·달리기
  6: 'KeyD', // LT 고유기
  7: 'KeyW', // RT 필살기
  8: 'KeyZ', // Back 지도
  9: 'Escape', // Start 메뉴
  10: 'KeyC', // L3 지원
  11: 'KeyR', // R3 재장전 (자동 전환·판정 보기는 메뉴에)
  12: 'Digit1', // 십자 위 아이템 1
  15: 'Digit2', // 십자 오른쪽 아이템 2
  13: 'Digit3', // 십자 아래 아이템 3
  14: 'Digit4', // 십자 왼쪽 아이템 4
};
export const PAD_NAME: Record<string, string> = {
  Space: 'A', KeyE: 'B', KeyA: 'X', KeyS: 'Y', KeyQ: 'LB', ShiftLeft: 'RB', KeyD: 'LT', KeyW: 'RT', KeyZ: 'Back', Escape: 'Start', KeyC: 'L3', KeyR: 'R3', KeyX: '메뉴', KeyH: '메뉴',
  Digit1: '십자↑', Digit2: '십자→', Digit3: '십자↓', Digit4: '십자←', ArrowLeft: '왼쪽 스틱', ArrowRight: '왼쪽 스틱', ArrowUp: '왼쪽 스틱', ArrowDown: '왼쪽 스틱',
};

export const ACTS = Object.keys(CODE) as Act[];
export const ACT_OF_CODE: Record<string, Act> = Object.fromEntries(ACTS.map((a) => [CODE[a], a]));
