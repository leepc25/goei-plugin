// 대전 전용 규칙 표 (2026-11-08 새로 짬). 필드 전투 값(기술 피해·쿨타임·스탯)은 쓰지 않는다.
// 캐릭터마다 다른 것은 그림·동작·이펙트 모양뿐이고, 피해·경직·밀림·게이지는 모두 이 표 하나로 정한다.
// 시간은 초, 거리는 월드 단위(발 줄 기준 1280 화면, 캐릭터 그림 1px = K 월드).

/** 캐릭터 그림 배율 (월드). 필드 인물 배율(art/charPacks CHAR_K)과 같다 */
export const K = 1.28;
/** 발 줄 (월드 y) */
export const LINE = 700;
/** 틱 (초). 판정은 60Hz 로 돈다 */
export const DT = 1 / 60;
/** 중력 (월드/초²) */
export const GRAV = 2600;

/** 체력 (모두 같음: 대전엔 NPC 스탯·체력 뻥튀기 X) */
export const HP = 1000;

/** 피해 표. 기술(고유기·충전·필살)은 「한 번 쓸 때 전체」 값을 그 기술의 맞는 횟수로 나눈다 */
export const DMG = {
  light: 30,
  heavy: 60,
  /** 약약강 (띄우기) */
  launch: 70,
  /** 약약약강 (날려 쓰러뜨리기) */
  blow: 90,
  jump: 40,
  ranged: 40,
  skill: 110,
  /** 충전 단계별 (0 = 짧게 누름) */
  charge: [50, 80, 120, 150],
  super: 300,
};
/** 이어 맞을수록 줄이기: n 번째 맞음(0부터) 배율 = max(MIN, 1 - STEP·n) */
export const SCALE = { step: 0.08, min: 0.45 };
/** 공중에 뜬 상대·쓰러진 상대를 때릴 때 배율 */
export const JUGGLE_MUL = 0.7, OTG_MUL = 0.5;
/** 막았을 때 받는 피해 비율 (평타는 0) */
export const CHIP = { normal: 0, special: 0.2 };

/** 게이지 (100 이면 필살기). 준 피해·받은 피해에 곱한다 */
export const GAUGE = { deal: 0.09, take: 0.05, whiffSpecial: 0 };

/** 경직 (초) */
export const STUN = {
  light: 0.36,
  heavy: 0.5,
  blockLight: 0.2,
  blockHeavy: 0.3,
  /** 막은 쪽이 막기 자세에 묶이는 최소 시간 */
  blockHold: 0.12,
};
/** 히트스톱 (초): 막음 · 약 · 강 · 띄움·날림 · 필살기 */
export const FREEZE = { guard: 0.05, light: 0.07, heavy: 0.11, big: 0.15, super: 0.12 };

/** 맞은 쪽 밀림 (월드/초, 초속). 맞으면 날아감 (제자리 X) */
export const PUSH = {
  light: 330,
  heavy: 560,
  guard: 240,
  guardHeavy: 420,
  /** 띄우기: 위로 · 옆으로 */
  launch: { vz: 1050, vx: 160 },
  /** 날려 쓰러뜨리기 */
  blow: { vz: 520, vx: 1050 },
  /** 강제 다운 (6연타) · 기술 down */
  down: { vz: 380, vx: 520 },
  /** 공중에서 맞음 (띄운 상대 이어치기) */
  air: { vz: 560, vx: 150 },
  /** K.O. 날아가기 */
  ko: { vz: 720, vx: 820 },
};
/** 밀림 감속 (월드/초²) */
export const FRICTION = 2600;

/** 이 수만큼 이어 맞으면(막은 것도 셈) 쓰러진다 */
export const CHAIN_DOWN = 6;
/** 이어 맞음이 끊기는 간격 (초) */
export const CHAIN_GAP = 0.7;
/** 띄운 상대 이어치기 한도 (넘으면 그대로 떨어진다) */
export const JUGGLE_MAX = 4;
/** 쓰러진 상대 때리기 한도 (넘으면 일어날 때까지 안 맞음) */
export const OTG_MAX = 2;
/** 누워 있는 최소 시간 · 일어나는 동안 무적 */
export const LIE_SEC = 0.55;

/** 이동 (월드/초) */
export const MOVE = {
  /** 기본 달리기 */
  run: 430,
  /** 뒤로 걷기 (상대를 본 채) */
  back: 230,
  dash: 900,
  dashSec: 0.26,
  backdash: 760,
  backdashSec: 0.3,
  /** 회피 무적 */
  dashInv: 0.2,
  jumpVz: 1180,
  jumpVx: 300,
};

/** 평타 장 길이 (초): 준비 장 · 때리는 장 · 마무리 장. 후딜은 필드의 약 1.5배·강 2배 (11-08 사용자) */
export const ATK = {
  /** startMax = 누르고 때리는 장까지 최대 (초) */
  light: { pre: 0.045, first: 0.04, hit: 0.08, post: 0.075, startMax: 0.15 },
  heavy: { pre: 0.06, first: 0.05, hit: 0.13, post: 0.12, startMax: 0.24 },
  /** 공격하며 앞으로 나가는 속도 (준비 장 동안) */
  lungeLight: 160,
  lungeHeavy: 260,
  /** 콤보 끝 강 (밀린 상대에게 닿게 한 걸음 더) */
  lungeFinisher: 420,
};
/** 약공 이음: 마무리 장이 끝나고 이만큼 안에 다시 누르면 다음 약공 */
export const CHAIN_WINDOW = 0.3;
/** 입력 기다림: 지금 못 하는 입력을 이만큼만 들고 있다 (늦게 나가는 예약 공격 X) */
export const BUFFER = 0.12;
/** 특수기·충전·원거리 뒤 굳음 (초) */
export const SPECIAL_LAG = 0.2;

/** 몸 상자: 서 있는 몸 반폭 (그림 px). 밀어내기·맞는 칸에 쓴다 */
export const BODY_HALF = 26;
/** 공격 칸 높이 반폭 (그림 px, 손끝 높이 기준) */
export const TIP_HALF = 46;
/** 공격 칸 손끝 앞뒤 (그림 px): 손끝에서 앞으로 · 뒤로 */
export const TIP = { front: 10, back: 46 };

/** 무대 양 끝 여유 (월드) */
export const WALL = 60;

/** 기술 피해를 나눌 최대 맞는 수 (이보다 많이 맞는 기술은 앞쪽 이만큼에서 전체 피해가 다 들어가고, 나머지는 1씩) */
export const HIT_CAP = { skill: 5, charge: 5, super: 8 };
