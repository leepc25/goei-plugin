// 살아 있는 인물 기록 (docs/인물기록_호감_통합설계_3판.md). 로어북 시트는 시작값, 이 기록이 이야기에 따라 바뀌는 쪽.
// 채팅 객체 최상위 키 goeiPeopleV1 에 둔다 (goeiFieldV1·goeiHqVisitV1 과 같은 방식). 값(호감 등)은 저장하지 않고 변경 기록에서 매번 계산한다.

export const PEOPLE_KEY = 'goeiPeopleV1';

/** 인물 기록의 칸. 로어북 시트의 Identity → identity, Character → personality 로 시작값을 넣는다 */
export type SlotId = 'identity' | 'personality' | 'state' | 'relationship' | 'speech' | 'behavior' | 'knowledge' | 'threads' | 'history' | 'scene' | 'suspicion';
export const SLOTS: SlotId[] = ['identity', 'personality', 'state', 'relationship', 'speech', 'behavior', 'knowledge', 'threads', 'history', 'scene', 'suspicion'];
/** 칸마다 둘 수 있는 항목 수. 넘으면 오래된 것을 코드가 한 줄로 합친다 */
export const SLOT_CAP: Record<SlotId, number> = { identity: 6, personality: 8, state: 6, relationship: 8, speech: 4, behavior: 8, knowledge: 10, threads: 8, history: 12, scene: 3, suspicion: 6 };

/** 호감 계기 → 기본 변화량 (리수폿 변화량 표). 숫자는 모델이 쓰지 않고 코드가 이 표로 정한다 */
export type Cue = '작은친절' | '도움' | '큰도움' | '헌신' | '실망' | '무시' | '배신' | '파탄' | '중대위반';
export const CUE_VALUE: Record<Cue, number> = { 작은친절: 1, 도움: 3, 큰도움: 5, 헌신: 10, 실망: -2, 무시: -4, 배신: -5, 파탄: -10, 중대위반: -50 };
export const CUES = Object.keys(CUE_VALUE) as Cue[];
/** 기준 메시지 하나 안의 합 상한 (예외 계기는 상한을 넘는다) */
export const TURN_CAP = 10;
export const EXCEPTION_CUES = new Set<Cue>(['중대위반']);
export const AFF_MIN = -100;
export const AFF_MAX = 300;

export type EntrySrc = 'seed' | 'story' | 'field' | 'manual';

/** 칸 항목 하나. 기준 메시지(anchor)가 채팅에 있고(story면 인용도 남아 있어야) 살아 있다 */
export interface Entry {
  id: string;
  text: string;
  /** relationship·speech·suspicion: 대상 ('@user' 또는 인물 이름) */
  target?: string;
  src: EntrySrc;
  /** 기준 메시지 chatId 또는 #메시지수 (visit.ts anchorOf). seed 는 '#0' */
  anchor: string;
  /** 같은 기준 메시지 안의 순서 */
  seq: number;
  /** 근거 인용 (story 만, 60자 이내) */
  quote?: string;
  /** 사용자가 고정 (자동 교체·삭제 무시) */
  pin?: boolean;
  /** 사용자가 취소 */
  void?: boolean;
  /** 이 항목이 대체한 이전 항목 id (대체 항목이 죽으면 이전 항목이 되살아난다) */
  replaces?: string;
  /** 사건·장소·세력·물건 문서용 */
  date?: string;
  place?: string;
  who?: string[];
  /** 의심: 종류 */
  kind?: string;
}

export type ChangeKind = 'cue' | 'address' | 'identity' | 'note';
/** 변경 기록 하나 (호감 계기, 호칭 변경, 유저 신분, 다음 턴 메모). 값은 여기서 계산한다 */
export interface Change {
  id: string;
  anchor: string;
  seq: number;
  src: EntrySrc;
  /** 감정을 가진 쪽 (인물 이름). identity 는 '@user' */
  who: string;
  kind: ChangeKind;
  cue?: Cue;
  quote?: string;
  reason: string;
  void?: boolean;
  /** manual 고정: 이 값으로 덮고 이후 자동 계기는 무시 */
  pin?: number;
  /** address */
  toUser?: string;
  register?: Register;
  /** identity */
  faction?: string;
  rank?: string;
  /** note (사실형 Director): 다음 턴용 메모 */
  now?: string;
  mustNot?: string[];
}
export type Register = '존댓말' | '반말' | '혼합';

export interface Person {
  name: string;
  /** A00 등 조직 코드 또는 '협회' 같은 이름. 모르면 '' */
  faction: string;
  seeded: { from: 'lore' | 'dialogue' | 'none'; at: string; hash?: string };
  slots: Partial<Record<SlotId, Entry[]>>;
  /** 유저 대상 호감 시작값 (relations-base: orgs). 현재값은 계산 */
  affinity: { base: number };
  address: { toUser: string; register: Register; pin?: boolean };
  /** 감정이 겉으로 드러나는 정도 0~3 */
  express: 0 | 1 | 2 | 3;
  minor?: boolean;
  aliases: string[];
}

export type DocType = 'event' | 'location' | 'faction' | 'item';
export const DOC_TYPES: DocType[] = ['event', 'location', 'faction', 'item'];
export const DOC_CAP: Record<DocType, number> = { event: 60, location: 8, faction: 8, item: 8 };
/** 인물 밖 문서: 사건은 건마다, 장소·세력·물건은 이름마다 「바뀐 것」 항목 */
export interface Doc {
  type: DocType;
  key: string;
  entries: Entry[];
}

export interface Identity {
  faction: string;
  rank: string;
  level: number | null;
  from: 'status' | 'scan' | 'manual' | 'default';
  anchor: string;
}

export interface PeopleStore {
  schema: 1;
  people: Record<string, Person>;
  /** 열쇠 = `${type}:${key}` */
  docs: Record<string, Doc>;
  log: Change[];
  /** 접힌 옛 계기의 합 (인물 이름 → 호감 합) */
  folded: Record<string, number>;
  /** 읽은 메시지: chatId(또는 #순번) → 내용 해시 */
  read: Record<string, string>;
  identity?: Identity;
  /** 새 인물 후보 (2턴 규칙·확인 모드): 이름 → 처음 본 기준 메시지 */
  pending: Record<string, { anchor: string; aliases: string[] }>;
  migrated?: string[];
}

export const emptyStore = (): PeopleStore => ({ schema: 1, people: {}, docs: {}, log: [], folded: {}, read: {}, pending: {} });

/** 호감 8단계 (리수폿). 상한은 「이하」 */
export interface Stage {
  max: number;
  label: string;
  /** 본편에 넣는 행동 방향 (영어) */
  behavior: string;
  /** 필드 대사 칸 */
  cell: 'hostile' | 'base' | 'warm' | 'close';
}
export const STAGES: Stage[] = [
  { max: -71, label: '극도의 적대', behavior: 'Extreme hostility. Keep the actual cause and constraints; the stage alone never compels a newly invented harmful act.', cell: 'hostile' },
  { max: -31, label: '적대', behavior: 'Hostility. Real distance or antagonism, expressed in this character\'s own manner.', cell: 'hostile' },
  { max: -1, label: '혐오', behavior: 'Aversion. Evidence-grounded resentment or coldness; shorter answers, discretionary effort withheld.', cell: 'hostile' },
  { max: 60, label: '무관심', behavior: 'Indifference. Base-personality politeness, small talk and work cooperation. No special favor, no forced coldness.', cell: 'base' },
  { max: 120, label: '인식', behavior: 'Recognition. Remembers personal details, notices absence, a little more willing to ask or answer.', cell: 'warm' },
  { max: 180, label: '관심', behavior: 'Interest. Seeks shared time; offers reliable help, concern, explanation or appropriately personal worries.', cell: 'warm' },
  { max: 240, label: '끌림', behavior: 'Attraction. Makes time and space for this person; reveals more sincere concern, preferences or vulnerability.', cell: 'close' },
  { max: 300, label: '애정', behavior: 'Affection. Deep care, voluntary support and emotional closeness, within this character\'s own personality.', cell: 'close' },
];
export function stageOf(value: number): Stage {
  for (const s of STAGES) if (value <= s.max) return s;
  return STAGES[STAGES.length - 1];
}

/** 성격 계수 (relations-base temper) */
export interface Temper { open: number; grudge: number }
export const DEFAULT_TEMPER: Temper = { open: 1, grudge: 1 };
