// 살아 있는 인물 기록 (docs/인물기록_호감_통합설계_3판.md). 로어북 시트는 시작값, 이 기록이 이야기에 따라 바뀌는 쪽.
// 채팅 객체 최상위 키 goeiPeopleV1 에 둔다 (goeiFieldV1·goeiHqVisitV1 과 같은 방식). 값(호감 등)은 저장하지 않고 변경 기록에서 매번 계산한다.

export const PEOPLE_KEY = 'goeiPeopleV1';

/** 인물 기록의 칸. 로어북 시트의 Identity → identity, Character → personality 로 시작값을 넣는다.
 * 기본 11칸 + 기능별 전용 칸 20개 (리수폿 slot id 그대로, 2026-11-06 사용자 결정 「I」): 기능을 끄면 그 칸은 통째로 숨고, 켜면 돌아온다 */
export type CoreSlotId = 'identity' | 'personality' | 'state' | 'relationship' | 'speech' | 'behavior' | 'knowledge' | 'threads' | 'history' | 'scene' | 'suspicion';
export type FeatureSlotId =
  | 'affinity.profile' | 'affinity.values' | 'affinity.appraisal' | 'affinity.current_appraisal' | 'affinity.intent' | 'affinity.stance' | 'affinity.bind' | 'affinity.private' | 'affinity.approach' | 'affinity.surface_actual'
  | 'register.context' | 'register.stage_assessment' | 'register.knowledge_gap' | 'register.restraint'
  | 'perception.profile' | 'perception.modifiers' | 'perception.channels' | 'perception.reading' | 'perception.secret'
  | 'openness.context';
export type SlotId = CoreSlotId | FeatureSlotId;
export const CORE_SLOTS: CoreSlotId[] = ['identity', 'personality', 'state', 'relationship', 'speech', 'behavior', 'knowledge', 'threads', 'history', 'scene', 'suspicion'];

export interface SlotMeta {
  /** 이 칸을 켜는 기능 (null = 늘 있음). suspicion 은 기능 suspicion */
  feature: string | null;
  /** 화면 이름 */
  label: string;
  /** 화면 도움말 */
  help: string;
  /** 지침·정리용 영어 한 줄 */
  hint: string;
  /** 대상(target)이 있는 칸: 유저(@user) 또는 다른 인물마다 항목 */
  targeted?: boolean;
  /** 한 번 쓰면 안 고치는 칸 (첫인상) */
  once?: boolean;
}
export const SLOT_META: Record<SlotId, SlotMeta> = {
  identity: { feature: null, label: '기본정보', help: '이름·나이·소속·외모처럼 잘 바뀌지 않는 기본 정보. 로어북 시트의 Identity 절이 시작값', hint: 'who this person is (affiliation, rank, role, age, appearance)' },
  personality: { feature: null, label: '성격', help: '성격·가치관·버릇. 시트의 Character 절이 시작값이고 이야기에서 드러난 면이 더해져요', hint: 'durable traits and values' },
  state: { feature: null, label: '현재 상태', help: '지금의 몸·마음 상태(부상·피로·기분 등). 바뀌면 이전 항목을 대신해요', hint: 'current condition, location, injuries, mood — keep only what is still true' },
  relationship: { feature: null, label: '인간관계', help: '주인공·다른 인물에 대한 감정과 관계. 「→ 이름」은 그 대상에 대한 것', hint: 'stance toward each target; one entry per target', targeted: true },
  speech: { feature: null, label: '말투', help: '말투·호칭 습관(존댓말·반말, 자주 쓰는 표현)', hint: 'how this person talks to each target; one entry per target', targeted: true },
  behavior: { feature: null, label: '행동 경향', help: '자주 보이는 행동 패턴과 반응 경향', hint: 'habits and patterns of action' },
  knowledge: { feature: null, label: '아는 정보', help: '이 인물이 알게 된 것·모르는 것. 본편에서 비밀을 함부로 누설하지 않게 해요', hint: 'what this person actually knows or does not know' },
  threads: { feature: null, label: '목표·미해결', help: '이 인물의 목표와 아직 풀리지 않은 일', hint: 'open promises, goals, unresolved matters' },
  history: { feature: null, label: '주요 행적', help: '이야기 속에서 한 주요 행동·겪은 일 (오래된 것부터 접혀요)', hint: 'notable past events with this person, oldest first' },
  scene: { feature: null, label: '현재 장면', help: '지금 장면에서의 위치·행동 (짧게 유지돼요)', hint: 'present scene facts' },
  suspicion: { feature: 'suspicion', label: '의심', help: '누구를·무엇을 의심하는지 (정체·배신·거짓말·오염·범행)', hint: 'suspicion cases (prefixes [시작]/[단서]/[반응]/[해소] stay)', targeted: true },
  'affinity.profile': { feature: 'affinity', label: '취향 프로필', help: '관심 범위·끌리는 요소·거슬리는 요소·감정의 형태·절제와 접근 방식. 이 인물 자체의 것(대상 무관)', hint: "the person's scope of interest, observable tastes and aversions, form of feeling, restraint and approach style, with evidence" },
  'affinity.values': { feature: 'affinity', label: '가치 기준', help: '무엇을 먼저 보는지, 관찰 기준, 일반적인 편견과 그 논리', hint: "value priorities, observation criteria, general biases, and the person's logic for them" },
  'affinity.appraisal': { feature: 'affinity', label: '첫인상', help: '처음 마주쳤을 때 겉모습으로 만든 평가와 감정. 한 번 쓰면 절대 안 고쳐요', hint: 'first impression only: the unchanging initial appearance-based appraisal and feeling', targeted: true, once: true },
  'affinity.current_appraisal': { feature: 'affinity', label: '현재 평가', help: '지금 이 대상을 어떻게 보는지, 그 근거와 감정', hint: 'current evaluation only: the present appraisal, its evidence and resulting feeling', targeted: true },
  'affinity.intent': { feature: 'affinity', label: '의도', help: '관심의 성격과 1차·2차 의도 (존중·애정·보호·이용…)', hint: 'nature of target-specific interest and its primary and secondary intents', targeted: true },
  'affinity.stance': { feature: 'affinity', label: '태도', help: '이 대상을 지금 어떻게 해석하고 어떻게 대하는지, 바뀐 근거', hint: 'current target-specific interpretation and treatment, with evidence for change', targeted: true },
  'affinity.bind': { feature: 'affinity', label: '제약', help: '결혼·서약·직업 윤리·명령 같은 제약과 그것을 다루는 방식(지킴·억누름·숨김·합리화·버림)', hint: 'constraints, how they are handled, rationalization, and evidence for an actual transition', targeted: true },
  'affinity.private': { feature: 'affinity', label: '속마음', help: '드러내지 않은 감정, 표현을 막는 조건, 실제로 새어 나온 단서와 그것을 본 사람', hint: 'unexpressed feeling, conditions limiting expression, actual leaks, and who perceived them', targeted: true },
  'affinity.approach': { feature: 'affinity', label: '접근', help: '마지막 실제 접근, 상대의 반응, 확인된 경계, 지금 허용된 범위', hint: "actual approach, the target's response, confirmed boundaries, and the currently permitted range", targeted: true },
  'affinity.surface_actual': { feature: 'affinity', label: '겉과 속', help: '이용·학대 의도가 있을 때 겉으로 보이는 행동과 실제 목적, 시도·목격자·결과', hint: 'outward conduct and actual purpose of exploitative or abusive intent, accumulated attempts, witnesses, and results', targeted: true },
  'register.context': { feature: 'register', label: '호칭 적용 조건', help: '어떤 자리에서 어떤 호칭·말투를 쓰는지(공적·사적, 제3자 앞), 신분 차이가 적용되는 범위', hint: 'where and when each address and register applies (public/private, before third parties), and which status difference applies', targeted: true },
  'register.stage_assessment': { feature: 'register', label: '관계 단계', help: '같이 겪고 서로 인정한 사실로 본 관계의 현재 위치 (숫자 아님)', hint: 'the relationship\'s current position as acknowledged shared experience, never a number or grade', targeted: true },
  'register.knowledge_gap': { feature: 'register', label: '마지막 접점', help: '마지막으로 만난 때와 그 뒤로 확인 못 한 범위', hint: 'last contact point and the unverified range since', targeted: true },
  'register.restraint': { feature: 'register', label: '절제', help: '속마음과 허용된 표현 사이의 거리', hint: 'the gap between inner feeling and permitted expression', targeted: true },
  'perception.profile': { feature: 'perception_ext', label: '관찰 성향', help: '꾸준한 관찰 성향과 전문 분야 (한 번, 기록이나 반복 근거에서)', hint: 'durable observation tendency and domain expertise' },
  'perception.modifiers': { feature: 'perception_ext', label: '현재 손상', help: '지금 관찰을 방해하거나 돕는 조건 (취함·피로·통증·경계·탐색)', hint: 'current impairments or enhancements of perception, with evidence' },
  'perception.channels': { feature: 'perception_ext', label: '장면 조건', help: '지금 장면의 감각 조건 (거리·빛·소음·통화)', hint: "the scene's sensory conditions (distance, light, noise, call connection)" },
  'perception.reading': { feature: 'perception_ext', label: '단서 읽기', help: '실제로 지각한 단서와 그 해석 (단서가 등장했다고 알아챈 것은 아님)', hint: 'a clue actually perceived and its interpretation; a clue appearing is not a clue noticed' },
  'perception.secret': { feature: 'perception', label: '비밀', help: '이 인물이 지키는 비밀 하나당 한 항목: 아는 사람·모르는 사람', hint: 'one entry per meaningful secret this person holds: who knows it and who does not' },
  'openness.context': { feature: 'openness', label: '음란도 조건', help: '친밀한 상황에서 실제로 보인 태도·조건(피임 요구, 경계, 거부)을 글로', hint: 'conditions and attitudes actually shown in intimate contexts (contraception demands, boundaries, refusals), as text' },
};
export const FEATURE_SLOTS: FeatureSlotId[] = (Object.keys(SLOT_META) as SlotId[]).filter((s): s is FeatureSlotId => s.includes('.'));
/** 모든 칸 (저장 읽기·순회용). 지침·화면은 slotsFor 로 켜진 칸만 */
export const SLOTS: SlotId[] = [...CORE_SLOTS, ...FEATURE_SLOTS];
/** 켜진 기능에 맞는 칸 목록 */
export const slotsFor = (features: Set<string>): SlotId[] => SLOTS.filter((s) => { const f = SLOT_META[s].feature; return !f || features.has(f); });
/** 칸의 기능 묶음 이름 (화면용): affinity.* → affinity */
export const slotGroup = (s: SlotId): string => (s.includes('.') ? s.split('.')[0] : 'core');

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
  /** 감정을 가진 쪽 (인물 이름). identity 는 '@user', 세력 평판은 '세력:코드' (factionWho) */
  who: string;
  kind: ChangeKind;
  cue?: Cue;
  quote?: string;
  reason: string;
  void?: boolean;
  /** manual 고정: 이 값으로 덮고 이후 자동 계기는 무시 */
  pin?: number;
  /** 계기 배율 (필드 몹 목격 0.5). 없으면 1 */
  scale?: number;
  /** 메시지당 상한을 세는 묶음. 없으면 anchor. 필드는 「anchor|방문|장면」 (방문·장면마다 따로) */
  group?: string;
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
  /** 감정이 겉으로 드러나는 정도 0~3 (성격 6축의 감정 표출성에서 계산한 값. 2026-11-06 「F」) */
  express: 0 | 1 | 2 | 3;
  aliases: string[];
  /** 성격 6축 0~100 (리수폿 People axes). 갱신기는 축을 직접 바꾸지 않고 관찰만 돌려준다 */
  axes: Axes;
  /** 축의 출처: default = 아직 모델이 시작값을 안 정함, model = 갱신기 init, manual = 사용자가 승인·수정 */
  axesFrom: 'default' | 'model' | 'manual';
  /** 장기 변화 (글로 적는 성격 변화, 승인된 것) */
  patterns: string[];
  /** 성격 변화 후보: 관찰이 쌓여 검토 단계가 되면 사원증에 띄운다 */
  candidates: Record<string, Candidate>;
}

// ── 성격 6축 (리수폿 People profile, 2026-11-06 사용자 결정 「F」) ──
export const AXES = ['relationalInitiative', 'expressionDirectness', 'emotionalExpressiveness', 'guardedness', 'impulsivity', 'relationshipPersistence'] as const;
export type Axis = (typeof AXES)[number];
export type Axes = Record<Axis, number>;
export const AXIS_LABEL: Record<Axis, string> = { relationalInitiative: '관계 주도성', expressionDirectness: '표현 직접성', emotionalExpressiveness: '감정 표출성', guardedness: '경계 성향', impulsivity: '충동성', relationshipPersistence: '관계 지속성' };
export const AXIS_LABEL_EN: Record<Axis, string> = { relationalInitiative: 'relational initiative', expressionDirectness: 'expression directness', emotionalExpressiveness: 'emotional expressiveness', guardedness: 'guardedness', impulsivity: 'impulsivity', relationshipPersistence: 'relationship persistence' };
/** 0~20 / ~40 / ~60 / ~80 / ~100 띠 설명 (리수폿 원문) */
export const AXIS_BANDS: Record<Axis, string[]> = {
  relationalInitiative: ['관계를 거의 먼저 시작하지 않음', '상대가 이끌 때 주로 반응함', '상황에 따라 주도와 반응을 오감', '필요하면 먼저 다가가 관계를 이끔', '지속적으로 관계의 방향을 주도함'],
  expressionDirectness: ['뜻을 거의 직접 말하지 않음', '돌려 말하거나 암시를 선호함', '상황에 따라 직접성과 완곡함을 조절함', '의도와 요구를 비교적 분명히 말함', '생각과 의도를 매우 직접적으로 표현함'],
  emotionalExpressiveness: ['감정을 거의 겉으로 드러내지 않음', '감정 단서가 작고 제한적임', '상황에 따라 감정을 보이거나 감춤', '감정이 말과 행동에 자주 드러남', '감정을 매우 선명하고 즉각적으로 표출함'],
  guardedness: ['타인을 쉽게 믿고 경계를 거의 세우지 않음', '초기 경계가 낮고 비교적 빨리 마음을 엶', '신뢰와 경계를 상황에 맞춰 조절함', '쉽게 속내를 보이지 않고 경계를 유지함', '강한 경계로 접근과 자기 공개를 엄격히 제한함'],
  impulsivity: ['충동을 강하게 억제하고 숙고함', '대체로 생각한 뒤 행동함', '상황에 따라 숙고와 즉흥 행동이 섞임', '감정과 욕구에 따라 빠르게 행동함', '결과를 따지기 전에 매우 충동적으로 행동함'],
  relationshipPersistence: ['관계를 쉽게 놓고 오래 유지하려 하지 않음', '갈등이나 거리가 생기면 물러나기 쉬움', '관계 가치에 따라 유지 여부를 판단함', '어려움이 있어도 관계를 오래 지키려 함', '관계를 매우 끈질기게 유지하고 회복하려 함'],
};
export const AXIS_BANDS_EN: Record<Axis, string[]> = {
  relationalInitiative: ['almost never initiates contact', 'mostly responds when the other leads', 'alternates between leading and responding', 'approaches first when needed and steers the relationship', 'steadily drives the direction of relationships'],
  expressionDirectness: ['almost never states intent directly', 'prefers indirection and hints', 'adjusts between direct and roundabout', 'states intent and demands fairly plainly', 'expresses thoughts and intent very directly'],
  emotionalExpressiveness: ['almost never shows emotion outwardly', 'small, limited emotional cues', 'shows or hides emotion depending on the situation', 'emotion often shows in words and actions', 'expresses emotion vividly and immediately'],
  guardedness: ['trusts easily, hardly any guard', 'low initial guard, opens up fairly fast', 'adjusts trust and guard to the situation', 'does not reveal inner thoughts easily, keeps guard', 'strong guard; strictly limits approach and self-disclosure'],
  impulsivity: ['strongly suppresses impulse and deliberates', 'mostly thinks before acting', 'mix of deliberation and spontaneous action', 'acts quickly on feeling and desire', 'acts very impulsively before weighing consequences'],
  relationshipPersistence: ['lets relationships go easily', 'tends to withdraw when conflict or distance appears', 'keeps or drops a relationship by its value', 'tries to keep relationships through difficulty', 'very persistent in keeping and repairing relationships'],
};
export const DEFAULT_AXES = (): Axes => ({ relationalInitiative: 50, expressionDirectness: 50, emotionalExpressiveness: 50, guardedness: 50, impulsivity: 50, relationshipPersistence: 50 });
export const axisBand = (value: number): number => (value <= 20 ? 0 : value <= 40 ? 1 : value <= 60 ? 2 : value <= 80 ? 3 : 4);
/** 감정 표출성 축 → 표현 정도 0~3 (옛 express) */
export const expressOf = (axes: Axes): 0 | 1 | 2 | 3 => { const v = axes.emotionalExpressiveness; return v <= 20 ? 0 : v <= 45 ? 1 : v <= 70 ? 2 : 3; };
/** 표현 정도 0~3 → 감정 표출성 축 시작값 (relations-base 의 express 로 새 인물의 축을 심을 때) */
export const EXPRESS_TO_AXIS: Record<0 | 1 | 2 | 3, number> = { 0: 15, 1: 35, 2: 60, 3: 85 };

/** 관찰 하나 (갱신기가 돌려준 「이 장면에서 이런 모습」). 기준 메시지가 사라지면 같이 죽는다 */
export interface Observation {
  id: string;
  anchor: string;
  seq: number;
  quote: string;
  /** 무엇이 보였나 (한국어 ≤100) */
  reason: string;
  /** 0~100 */
  strength: number;
  confidence: number;
  void?: boolean;
}
export type CandidateDirection = 'up' | 'down' | 'new' | 'weaken';
export type CandidateStatus = 'collecting' | 'approved' | 'rejected' | 'reverted';
/** 성격 변화 후보: 같은 축·방향·설명의 관찰 묶음. 살아 있는 관찰이 4개 이상·서로 다른 메시지 3개 이상·확신 평균 55 이상이면 검토 대상 */
export interface Candidate {
  id: string;
  /** 축 이름 또는 'pattern'(글로 적는 장기 변화) */
  axis: Axis | 'pattern';
  direction: CandidateDirection;
  /** 변화의 설명 (한국어 ≤120). pattern 이면 장기 변화 본문 */
  pattern: string;
  evidence: Observation[];
  status: CandidateStatus;
  at: string;
  /** 승인 시 적용한 것 (되돌리기용) */
  applied?: { axis: Axis; before: number; after: number } | { pattern: string; removed?: boolean };
}
export const CANDIDATE_READY = { evidence: 4, scenes: 3, confidence: 55 } as const;

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

/** 세력 장부: 값은 없고(시작값 표 + 변경 기록에서 계산) 이름만 */
export interface FactionRecord {
  code: string;
  name: string;
  seeded: { at: string };
}

export interface PeopleStore {
  schema: 1;
  people: Record<string, Person>;
  /** 열쇠 = 조직 코드 (A00·B00·…). 옛 저장에는 없음 = 시작값 */
  factions: Record<string, FactionRecord>;
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

export const emptyStore = (): PeopleStore => ({ schema: 1, people: {}, factions: {}, docs: {}, log: [], folded: {}, read: {}, pending: {}, ignored: [] });

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

/** 세력 평판 (docs/설계안_세력평판.md): 세력 → 유저 값 −100~100. 변경 기록의 who 는 '세력:코드' */
export const FACTION_PREFIX = '세력:';
export const factionWho = (code: string) => `${FACTION_PREFIX}${code}`;
export const factionOfWho = (who: string): string | null => (who.startsWith(FACTION_PREFIX) ? who.slice(FACTION_PREFIX.length) : null);
export const FACTION_MIN = -100;
export const FACTION_MAX = 100;
/** 구간 경계 (설정): [우호 하한, 호의 하한, 중립 하한, 경계 하한]. 그 아래는 적대 */
export const FACTION_BOUNDS_DEFAULT: [number, number, number, number] = [61, 21, -20, -60];
export type FactionStageId = 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile';
export interface FactionStage { id: FactionStageId; label: string; behavior: string; mob: string }
export const FACTION_STAGES: Record<FactionStageId, FactionStage> = {
  friendly: { id: 'friendly', label: '우호', behavior: "Friendly. Members welcome {{user}}, share information freely and take {{user}}'s side in a fight.", mob: '반기고, 싸움에서 편들어 줌' },
  favorable: { id: 'favorable', label: '호의', behavior: 'Favorable. Members greet {{user}}, make way and extend small favors.', mob: '인사하고 길을 비켜 줌' },
  neutral: { id: 'neutral', label: '중립', behavior: 'Neutral. Ordinary procedure; members take no special notice.', mob: '무시' },
  wary: { id: 'wary', label: '경계', behavior: 'Wary. Members watch and verify; on their own ground they warn {{user}} off or expel; elsewhere they only observe.', mob: '지켜봄. 자기 구역에서는 경고·쫓아냄' },
  hostile: { id: 'hostile', label: '적대', behavior: 'Hostile. Members attack {{user}} on sight, even outside their own ground.', mob: '보자마자 공격' },
};
export function factionStage(value: number, bounds: readonly number[] = FACTION_BOUNDS_DEFAULT): FactionStage {
  const [a, b, c, d] = bounds;
  return FACTION_STAGES[value >= a ? 'friendly' : value >= b ? 'favorable' : value >= c ? 'neutral' : value >= d ? 'wary' : 'hostile'];
}
