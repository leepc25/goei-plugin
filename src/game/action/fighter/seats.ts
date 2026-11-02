// 의자 앉기 공용 자료 (엔진 fighter/core.ts · 필드 그림 art/charPacks.ts · 필드 세계가 같이 쓴다).
// 의자 맞춤값은 인물마다 테스트룸에서 맞춘 것: game-src/action/testroom3/chairs/<키>.json → 인물 팩 설정 cfg.chair (손으로 맞춘 값),
// 없는 칸은 빌드 자동값 cfg.chairAuto. 값 = { dx(앞쪽 +), dy(아래 +), s(의자 크기), img(의자 그림 방향) }, 의자 그림 원점 (100, 171).
// 필드 원칙(사용자 10-29): 의자는 지도에 놓인 자리에 그대로 있고, 앉는 사람을 그 사람 맞춤값만큼 옮겨 그린다 → 어느 의자에 누가 앉아도 맞는다.

export type SeatDir = 'front' | 'side' | 'back';
/** 앉기 방향마다: 앉는 줄·기본 의자 그림·앉아서 하는 일 → 줄 */
export const SEATS: { dir: SeatDir; sit: string; img: string; acts: Record<string, string> }[] = [
  { dir: 'front', sit: '60', img: 'south', acts: { talk: '62', eat: '64', drink: '65', type: '63', doze: '66', lean: '73', nod: '68', craft: '106', phone: '148', book: '149', paper: '167', call: '67' } },
  { dir: 'side', sit: '96', img: 'east', acts: { talk: '97', eat: '98', drink: '99', type: '105' } },
  { dir: 'back', sit: '61', img: 'north', acts: { talk: '70', eat: '71', drink: '71', type: '69', look: '72' } },
];
/** 「반복, 첫 장 유지」 앉은 줄 */
export const SEAT_LOOP = new Set(['63', '64', '66', '73', '98', '105', '69', '71', '106', '148', '149', '167']);
/** 앉은 줄 전부 (발을 장마다 땅에 맞추는 줄) */
export const SEAT_IDS = new Set(['60', '61', '96', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '97', '98', '99', '105', '106', '148', '149', '167']);

export interface SeatFit { dx: number; dy: number; s: number; img?: string }
type Cfg = { chair?: Record<string, Partial<SeatFit>>; chairAuto?: Record<string, Partial<SeatFit>> };
/** 맞춤값: 줄마다 따로 맞춘 값(기대 쉬기 73 등) > 방향 손 맞춤 > 자동값. edits = 시험장에서 막 고친 값 */
export function seatFit(cfg: Cfg, dir: string, line?: string | null, edits: Record<string, Partial<SeatFit>> = {}): SeatFit {
  const base: SeatFit = { dx: 0, dy: 0, s: 1, ...(cfg.chairAuto?.[dir] ?? {}), ...(cfg.chair?.[dir] ?? {}), ...(edits[dir] ?? {}) };
  return line && (cfg.chair?.[line] || edits[line]) ? { ...base, ...(cfg.chair?.[line] ?? {}), ...(edits[line] ?? {}) } : base;
}
/** 의자 자리(cx, cy)에 앉을 때 사람 발 자리. face 1 = 오른쪽 보기, k = 그 깊이의 그림 배율 */
export const seatBody = (cx: number, cy: number, face: number, fit: SeatFit, k: number) => ({ x: cx - face * fit.dx * k, y: cy - fit.dy * k });
/** 지도 의자가 보는 쪽(E/W/N) → 앉기 방향 */
export const seatDirOf = (face: 'E' | 'W' | 'N' | undefined): SeatDir => (face === 'N' ? 'back' : face ? 'side' : 'front');
