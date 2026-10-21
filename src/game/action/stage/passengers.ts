// 떠도는 승객 (스테이지 설계서 9장). 정보·보급을 주는 사람과 유인·거짓 정보를 파는 사람. "둘 다 친절해 보인다".
// 대사 본문은 「대사와 컷신」 작업이 lines 훅으로 바꿀 수 있다. 여기는 결과 규칙과 기본 문장.
export type PassengerKind = 'three_years' | 'markers' | 'supply' | 'nothuman' | 'missing';
export const PASSENGER_LABEL: Record<PassengerKind, string> = {
  three_years: '삼 년째 승객',
  markers: '표시 체계 무리',
  supply: '배낭 멘 승객',
  nothuman: '승객 옷을 입은 것',
  missing: '야근하다 들어온 회사원',
};

export interface PassengerLines {
  talk?(kind: PassengerKind, honest: boolean, long: boolean): string[] | null;
}

export function defaultTalk(kind: PassengerKind, long: boolean, hasFork: boolean): string[] {
  const story = long
    ? ['나 여기 삼 년째야. 처음엔 회사 엘리베이터였지. 야근하고, 1층 누르고, 띵. 그 뒤로 별걸 다 봤어. 아내 얼굴이 기억이 안 나. 아니, 기억은 나는데…', '그러니까 내 말 들어.']
    : ['나 여기 오래 있었어. 내 말 들어.'];
  switch (kind) {
    case 'three_years':
      return [...story, hasFork ? '저쪽 문 말고 이쪽.' : '다음 버튼은… 내가 알아.'];
    case 'markers':
      return ['벽에 동그라미 있지? 동그라미 안에 줄 하나면 위험, 비어 있으면 쉼터야.', '우리끼리 남기는 표시야. 너도 남겨.'];
    case 'supply':
      return long ? ['배낭 무겁지? 나도 그랬어. 다락방에 숨겨 둔 게 있는데, 같이 가면 나눠 줄게. 정말이야, 나 혼자 다 못 먹어.'] : ['다락방 오른쪽 구석에 하나 숨겨 놨어.'];
    case 'nothuman':
      return ['…………', '(얼굴을 보려 하면 고개가 같이 돈다)'];
    case 'missing':
      return ['저… 관리국이세요? 야근하다가 1층을 눌렀는데요…', '같이 나가게 해 주세요. 부탁이에요.'];
  }
}

/** 고르기: 돕기 / 무시 / 뺏기 (기본 기획서 7.3) */
export type PassengerChoice = 'help' | 'ignore' | 'rob';
export const CHOICE_LABEL: Record<PassengerChoice, string> = { help: '돕는다 (E)', ignore: '무시한다 (E)', rob: '뺏는다 (E)' };
