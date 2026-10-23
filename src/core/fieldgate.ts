// 필드 입장 판정 (docs/필드_기능_설계.md): 본편 주인공이 지금 괴이 안에 있는가.
// 이름 매칭이 아니라 구조로 판단한다: 요원 상태 「작전투입」, 상태창 투입 칸, 상황판 목표 칸.
export type Presence = 'none' | 'prep' | 'inside' | 'unknown';

export interface PresenceInput {
  /** 캐릭터로 플레이 중인가 (요원 상태를 믿을 수 있나) */
  player: boolean;
  /** 주인공 요원의 상황판 상태 */
  state?: string;
  /** 상태창 목표 칸 (브리핑·이동 중에도 잡힌다) */
  target?: string;
  /** 상태창 투입 칸. 칸이 없으면 null */
  deployed?: boolean | null;
  /** 사용자가 직접 고친 판정 */
  override?: 'inside' | 'outside' | null;
}

const IN_STATE = /작전\s*투입/;

export function presence(i: PresenceInput): Presence {
  if (i.override === 'inside') return 'inside';
  const prep = (i.target ?? '').trim() ? 'prep' : 'none';
  if (i.override === 'outside') return prep;
  const deployed = i.deployed ?? null;
  if (i.player) {
    if (IN_STATE.test(i.state ?? '')) return 'inside';
    // 요원 상태와 상태창이 서로 어긋나면 모른다
    if (deployed === true) return 'unknown';
    return prep;
  }
  if (deployed === true) return 'inside';
  if (deployed === null) return prep === 'prep' ? 'unknown' : 'none';
  return prep;
}

export interface EntryDecision {
  allow: boolean;
  presence: Presence;
  /** 막혔을 때 사용자에게 보일 한 줄 */
  reason?: string;
  /** 들어가되 알려 줄 말 */
  notice?: string;
}

export function entryDecision(p: Presence): EntryDecision {
  if (p === 'inside') return { allow: false, presence: p, reason: '본편에서 지금 괴이 안에 있어요. 밖으로 나온 뒤에 들어갈 수 있어요.' };
  if (p === 'unknown') return { allow: true, presence: p, notice: '본편 상태를 확실히 판단하지 못해 그대로 들어가요.' };
  return { allow: true, presence: p };
}
