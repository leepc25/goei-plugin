/** v4: 그림 수와 무관한 동작 시간. 60Hz 설계 틱이며 화면 주사율이 아니다. */
export const ATTACK = {
  melee1: {
    ticks: [4, 1, 2, 3, 6],
    contact: 5,
    damage: 18,
    reach: 124,
    stop: 3,
    push: 18,
  },
  melee2: {
    ticks: [4, 1, 2, 4, 7],
    contact: 5,
    damage: 24,
    reach: 132,
    stop: 3,
    push: 24,
  },
  melee3: {
    ticks: [5, 3, 1, 3, 6, 10],
    contact: 9,
    damage: 38,
    reach: 148,
    stop: 5,
    push: 66,
  },
  lowkick: {
    ticks: [5, 3, 11],
    contact: 5,
    damage: 22,
    reach: 150,
    stop: 3,
    push: 26,
  },
  airattack: {
    ticks: [4, 5, 9],
    contact: 4,
    damage: 26,
    reach: 155,
    stop: 4,
    push: 35,
  },
  dashattack: {
    ticks: [4, 2, 4, 12],
    contact: 6,
    damage: 32,
    reach: 142,
    stop: 4,
    push: 48,
  },
} as const;
export type Strike = keyof typeof ATTACK;
export const strikeDuration = (name: Strike) =>
  ATTACK[name].ticks.reduce((a: number, b) => a + b, 0) / 60;
export const strikeContact = (name: Strike) => ATTACK[name].contact / 60;
export function isStrike(name: string): name is Strike {
  return name in ATTACK;
}
