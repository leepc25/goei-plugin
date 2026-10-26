// 살아 있는 인물 기록 (docs/인물기록_호감_통합설계_3판.md). 로어북 시트는 시작값, 이 기록이 이야기에 따라 바뀌는 쪽.
// 채팅 객체 최상위 키 goeiPeopleV1 에 둔다 (goeiFieldV1·goeiHqVisitV1 과 같은 방식). 값(호감 등)은 저장하지 않고 변경 기록에서 매번 계산한다.

export const PEOPLE_KEY = 'goeiPeopleV1';

/** 인물 기록의 칸. 로어북 시트의 Identity → identity, Character → personality 로 시작값을 넣는다 */
export type SlotId = 'identity' | 'personality' | 'state' | 'relationship' | 'speech' | 'behavior' | 'knowledge' | 'threads' | 'history' | 'scene' | 'suspicion';
export const SLOTS: SlotId[] = ['identity', 'personality', 'state', 'relationship', 'speech', 'behavior', 'knowledge', 'threads', 'history', 'scene', 'suspicion'];

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
  /** 이 항목이 합친 이전 항목 id 들 (merge·정리). 이 항목이 살아 있는 동안 그것들은 대체된 것으로 본다 */
  from?: string[];
  /** (옛 저장) 요약에 합쳐짐 */
  folded?: boolean;
  /** 사건·장소·세력·물건 문서용 */
  date?: string;
  place?: string;
  who?: string[];
  /** 의심: 종류 */
  kind?: string;
}

export type ChangeKind = 'cue' | 'address' | 'identity' | 'note' | 'taste' | 'openness';
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
  /** taste: 새 취향 띠 (-3~3) */
  band?: number;
  /** openness: 시작값(init, 0·90·150·210·270) 또는 변화량(delta) */
  init?: number;
  delta?: number;
}
export type Register = '존댓말' | '반말' | '혼합' | '하게체' | '하오체';
export const REGISTERS: Register[] = ['존댓말', '반말', '혼합', '하게체', '하오체'];

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
  aliases: string[];
}

export type DocType = 'event' | 'location' | 'faction' | 'item' | 'rhythm';
export const DOC_TYPES: DocType[] = ['event', 'location', 'faction', 'item', 'rhythm'];
/** 문서 종류 → 켜는 기능 이름 (리듬은 기능 rhythm) */
export const docFeature = (t: DocType): string => (t === 'rhythm' ? 'rhythm' : `docs_${t}`);
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
  /** 사용자가 「무시」한 이름: 다시 새 인물로 올리지 않는다 */
  ignored: string[];
  migrated?: string[];
}

export const emptyStore = (): PeopleStore => ({ schema: 1, people: {}, docs: {}, log: [], folded: {}, read: {}, pending: {}, ignored: [] });

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

/** 취향 띠 (리수폿 affinity.taste_band): 첫인상 −3~+3. 호감과 다른 축. 올라갈 땐 한 칸씩, 내려갈 땐 여러 칸 */
export const TASTE_MIN = -3;
export const TASTE_MAX = 3;
export const TASTE_STAGES: Record<number, { ko: string; en: string }> = {
  [-3]: { ko: '강한 거부감으로 접촉을 끝내거나 피하려 함', en: 'strong aversion; ends or avoids contact' },
  [-2]: { ko: '분명한 비호감으로 마찰과 거리가 늘고 자발적 친절이 줄어듦', en: 'clear dislike; more friction and distance, less voluntary kindness' },
  [-1]: { ko: '약간 거슬리거나 취향에 맞지 않아 필요한 만큼만 반응함', en: 'slightly grating or not to taste; responds only as needed' },
  [0]: { ko: '특별한 끌림이나 거부감 없이 기존 관계대로 대함', en: 'no particular pull or aversion; treats as the relationship stands' },
  [1]: { ko: '약하게 끌려 조금 더 주목하고 기억하거나 대화를 이어가려 함', en: 'weakly drawn; pays a little more attention, remembers, keeps talking' },
  [2]: { ko: '핵심 취향이 분명히 맞아 먼저 질문하거나 시간과 노력을 더 씀', en: 'core tastes clearly match; asks first, spends more time and effort' },
  [3]: { ko: '여러 핵심 취향이 강하게 맞아 관심의 우선순위가 달라질 수 있음', en: 'several core tastes strongly match; priorities of attention may shift' },
};

/** 음란도 (리수폿 openness.score, 화면 이름 음란도): 0~300, 성인 인물. 시작값은 표의 다섯 값 중 하나, 변화는 새 반응마다 표의 값 */
export const OPENNESS_MIN = 0;
export const OPENNESS_MAX = 300;
export const OPENNESS_BASELINES = [0, 90, 150, 210, 270];
export const OPENNESS_DELTAS = [1, 3, 5, 10, -2, -4, -5];
/** 기준 메시지 하나 안의 합 범위 */
export const OPENNESS_TURN: [number, number] = [-5, 10];
export interface OpennessStage { max: number; label: string; contraception: string; en: string; contraceptionEn: string }
export const OPENNESS_STAGES: OpennessStage[] = [
  { max: 60, label: '정숙', contraception: '피임 필수', en: 'Chaste', contraceptionEn: 'must use contraception and says so as a prerequisite' },
  { max: 120, label: '수줍음', contraception: '주저하지만 피임을 요구', en: 'Shy', contraceptionEn: 'hesitant while still asking for contraception (hesitation is not abandoning the condition)' },
  { max: 180, label: '개방', contraception: '안전일에는 비피임을 고려 가능', en: 'Open', contraceptionEn: 'believes non-use is acceptable on a "safe day" (an attitude; never compute a real safe date)' },
  { max: 240, label: '각성', contraception: '피임 여부를 크게 신경 쓰지 않음', en: 'Awakened', contraceptionEn: 'pays little attention to checking or requesting contraception' },
  { max: 300, label: '탐닉', contraception: '비피임 선호', en: 'Indulgent', contraceptionEn: 'prefers non-use, distinct from mere indifference' },
];
export function opennessStage(value: number): OpennessStage {
  for (const s of OPENNESS_STAGES) if (value <= s.max) return s;
  return OPENNESS_STAGES[OPENNESS_STAGES.length - 1];
}

/** 서사 리듬 (리수폿 rhythm): 장면 국면과 떡밥 단계 이름 (문서 종류 rhythm 의 항목 본문 앞에 붙인다) */
export const RHYTHM_PHASES = ['baseline', 'build_up', 'peak', 'aftermath', 'cooldown'] as const;
export const RHYTHM_ENGAGEMENT = ['active', 'idle', 'intentional_rest'] as const;
export const RHYTHM_HOOK_STAGES = ['seeded', 'hinted', 'escalated', 'payoff_ready', 'resolved', 'retired'] as const;
export const RHYTHM_HOOK_TIERS = ['short', 'mid', 'long'] as const;
