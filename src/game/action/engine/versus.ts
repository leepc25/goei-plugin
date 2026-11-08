// 대전(11-08 사용자 「기다리는 동안 대전」): 투명 무대에서 인물끼리 싸운다. 게임(game.ts)·조립(modules.ts)·고르기 창(versus/)이 같이 보는 상태.
// 모드 (11-08 사용자: 1:1 먼저, 3인 팀전·서바이벌도 같은 틀에서):
//   duel     1:1 3판 2선승. 판마다 둘 다 체력을 다시 채운다
//   team     3인 팀전. 쓰러진 쪽만 다음 사람이 나오고, 이긴 사람은 남은 체력 그대로 다음 상대를 맞는다. 한 팀 셋이 다 쓰러지면 끝
//   survival 서바이벌. 내 한 명으로 계속 나오는 상대를 몇 명까지 쓰러뜨리나. 내 체력은 이어지고 상대를 쓰러뜨리면 조금 회복
// 판 끝 판정은 game.ts 가, 그리기는 modules.ts drawVersusBars 가 한다. 경기가 끝나면 onMatchEnd 로 고르기 창에 돌려준다.

export type Side = 0 | 1;
export type VsMode = 'duel' | 'team' | 'survival';

export const versus = {
  mode: 'duel' as VsMode,
  /** 양쪽 명단 [1P, 상대]. duel·survival 의 1P 는 한 명, survival 상대는 뽑을 때마다 늘어난다 */
  team: [[], []] as [string[], string[]],
  /** 지금 나와 있는 사람 번호 [1P, 상대] */
  cur: [0, 0] as [number, number],
  /** 이긴 판 수 [1P, 상대] (duel) */
  wins: [0, 0] as [number, number],
  /** 지금 몇 번째 판 (1부터) */
  round: 1,
  /** 다음 판에 이어 받을 체력 비율 [1P, 상대] (team·survival). null 이면 가득 */
  carry: [null, null] as [number | null, number | null],
  /** 서바이벌: 쓰러뜨린 수 */
  kills: 0,
  /** 판 끝 알림: 쓰러짐 뒤 잠깐, 이긴 쪽 */
  ko: null as null | { side: Side; t: number; next: 'over' | 'next' },
  /** 판 시작 알림 (ROUND n → FIGHT) 남은 초 */
  intro: 0,
  /** 경기 끝: 이긴 쪽, 남은 표시 초 */
  over: null as null | { side: Side; t: number },
  /** 멈춤 (고르기 창이 떠 있는 동안·창을 닫았을 때): 판을 진행하지 않는다 */
  hold: false,
  /** 경기가 끝나 표시까지 마쳤을 때 (고르기 창으로) */
  onMatchEnd: null as null | ((winner: Side) => void),
  /** 서바이벌 다음 상대 뽑기 (고르기 창이 이름 있는 인물 명단으로 정한다) */
  nextFoe: null as null | (() => string),
};

/** duel 에서 경기를 가져가는 승 수 */
export const WINS_TO_TAKE = 2;
/** 판 끝(KO) 표시 초, 경기 끝(승리/패배) 표시 초, 판 시작 표시 초 */
export const KO_SEC = 2.5;
export const OVER_SEC = 3;
export const INTRO_SEC = 1.6;
/** 서바이벌: 상대를 쓰러뜨릴 때 회복하는 최대 체력 비율 */
export const SURVIVAL_HEAL = 0.2;

/** 지금 나와 있는 1P·상대 이름 */
export const fighterOf = (side: Side): string => versus.team[side][versus.cur[side]] ?? '';

/** 새 경기 */
export function newMatch(mode: VsMode, me: string[], foe: string[]): void {
  versus.mode = mode;
  versus.team = [me.slice(), foe.slice()];
  versus.cur = [0, 0];
  versus.wins = [0, 0];
  versus.round = 1;
  versus.carry = [null, null];
  versus.kills = 0;
  versus.ko = null;
  versus.over = null;
  versus.intro = INTRO_SEC;
  versus.hold = false;
}

/**
 * 판이 끝났다 (side 가 이김, hp = 판 끝 체력 비율 [1P, 상대]).
 * 돌려주는 값: 'over' 경기 끝 / 'next' 다음 판 (cur·carry 를 바꿔 둔다)
 */
export function roundEnd(side: Side, hp: [number, number]): 'over' | 'next' {
  const lose = (1 - side) as Side;
  versus.round++;
  if (versus.mode === 'duel') {
    versus.wins[side]++;
    versus.carry = [null, null];
    return versus.wins[side] >= WINS_TO_TAKE ? 'over' : 'next';
  }
  if (versus.mode === 'team') {
    versus.wins[side]++;
    versus.cur[lose]++;
    versus.carry = [null, null];
    versus.carry[side] = Math.max(0.05, hp[side]);
    return versus.cur[lose] >= versus.team[lose].length ? 'over' : 'next';
  }
  // survival: 내가 쓰러지면 끝. 이기면 다음 상대
  if (side === 1) return 'over';
  versus.kills++;
  versus.carry = [Math.min(1, hp[0] + SURVIVAL_HEAL), null];
  const next = versus.nextFoe?.() ?? versus.team[1][versus.cur[1]];
  versus.team[1].push(next);
  versus.cur[1] = versus.team[1].length - 1;
  return 'next';
}
