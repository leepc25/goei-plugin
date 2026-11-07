// 인물 기록 설정 (채팅별, scriptstate 변수 `$pp_*`. 괴담톡 설정과 같은 방식). 기본값은 설계 문서의 추천값.
export const PP = (key: string) => `$pp_${key}`;

export type Feature = 'axes' | 'affinity' | 'register' | 'perception' | 'perception_ext' | 'suspicion' | 'docs_event' | 'docs_location' | 'docs_faction' | 'docs_item' | 'npc_emotion' | 'taste' | 'openness' | 'rhythm' | 'faction_rep';
/** 수치가 있는 기능. 수치를 끄면 정성 모드 (리수폿 qualitative): 점수 없이 글로만 */
export type NumericFeature = 'affinity' | 'suspicion' | 'openness';
export const NUMERIC_FEATURES: NumericFeature[] = ['affinity', 'suspicion', 'openness'];
export const FEATURES: Feature[] = ['axes', 'affinity', 'register', 'perception', 'perception_ext', 'suspicion', 'docs_event', 'docs_location', 'docs_faction', 'docs_item', 'npc_emotion', 'taste', 'openness', 'rhythm', 'faction_rep'];

export const PP_DEFAULTS: Record<string, string> = {
  on: '1',
  /** turn = 매 턴 자동, manual = 「지금 갱신」만 */
  when: 'turn',
  model: 'aux',
  /** detailed = 자세히(원문), compact = 간결 */
  prompt: 'detailed',
  /** split = 절 단위 혼합, append = 시트 전체 + 기록, record = 기록만, off = 본편에 안 넣음 */
  inject: 'split',
  /** off / note(뒤, 갱신기에 얹은 메모만, 호출 없음) / facts(앞, 사실형 — 본편 전 보조 1회, 원본 directorRole facts) / scene(앞, 연출형).
   *  2026-11-07: 옛 facts(호출 없음)는 note 로 이름을 바꿈. 원본처럼 사실형도 본편 앞에 Director 를 부른다 */
  director: 'facts',
  director_lang: 'en',
  director_len: 'short',
  director_timeout: '90',
  director_reuse: '1',
  /** 리수폿 B: 자료가 모자라면 검색(채팅·로어북·위키)을 요청해 2차 호출. C: 켜진 기능마다 Director 적용 지침 */
  director_search: '1',
  director_features: '1',
  /** 리수폿 A: 장면 인물 고르기. code = 이름이 나온 사람(비용 0), model = 보조 모델이 이름 목록을 보고 고름 (턴당 +1회) */
  router: 'code',
  router_timeout: '60',
  /** 2026-11-07 (전수검사 4 의 L·M·P, 원본 trackedCharactersByScope·stageContext·Router 지침): 항상 포함할 인물(쉼표·줄바꿈), Router·Director 가 보는 최근 글 수, Router 에 덧붙일 지침 */
  always: '',
  recent_msgs: '4',
  router_rules: '',
  /** 리수폿 J-2 단계별 모델: same = 갱신 모델과 같게. model_id_* = 전용 모델 ID (비면 메인·보조) */
  model_director: 'same', model_router: 'same', model_tidy: 'same',
  model_id_update: '', model_id_director: '', model_id_router: '', model_id_tidy: '',
  /** 리수폿 J-3 하이파 참조: Risu HypaMemory 요약을 갱신기·Director 자료에 배경으로 넣음. 기본 끔 */
  hypa: '0',
  hypa_cap: '3000',
  /** 하이파 요약 개수 상한(원본 directorMemoryLimit 16)과 하이파 플러스(플러그인 저장소) 읽기 (2026-11-07) */
  hypa_items: '16',
  hypa_plus: '1',
  speed: '1',
  /** 호감 감소 승수 (원본 affinity.decrease). same = 증가 승수(speed)와 같게 (전수검사 4 의 N) */
  speed_down: 'same',
  /** 기준 메시지(또는 필드 장면) 하나 안의 변화 합 상한. 0 = 한도 없음. 인물 호감·세력 평판 공용 (리수폿 10) */
  turn_cap: '10',
  /** 성격 6축·관찰 누적 (리수폿 People). 기본 켬 */
  axes: '1',
  affinity: '1', register: '1', perception: '1', perception_ext: '1', suspicion: '1',
  docs_event: '1', docs_location: '1', docs_faction: '1', docs_item: '1', npc_emotion: '1',
  /** 수치 사용 (1) / 정성 모드 (0). 호감·의심·음란도 (리수폿 E). 취향 띠는 호감 수치가 켜져 있을 때만 */
  num_affinity: '1', num_suspicion: '1', num_openness: '1',
  /** 리수폿 선택 기능: 취향 띠·음란도·서사 리듬. 기본 끔 */
  taste: '0', openness: '0', rhythm: '0',
  /** 세력 평판 (docs/설계안_세력평판.md). 기본 켬. 본편 주입 켬. 구간 경계 [우호, 호의, 중립, 경계 하한]. 몹 목격 무게 half/full/off */
  faction_rep: '1',
  faction_inject: '1',
  faction_bounds: '61,21,-20,-60',
  mob_weight: 'half',
  /** auto / confirm */
  newpeople: 'auto',
  twoturn: '0',
  /** 갱신기 앞에 붙이는 직전 유저·봇 쌍 (원본 stageContext.writer 2). 2026-11-07 W3: 1 → 2 */
  prev_pairs: '2',
  /** 기록 본문 언어 (ko / en). 이름·인용·호칭은 늘 원문 */
  lang: 'ko',
  /** 인물당 저장 상한 (글자). 리수폿 절 상한 합계와 같은 10,000 */
  person_cap: '10000',
  /** 본편 요청에 넣는 기록 블록 전체 상한 (글자). 리수폿 Director 참고 상한과 같은 16,000 */
  block_cap: '16000',
  /** 저장 상한을 넘긴 인물 정리: same = 같은 갱신 호출에 얹음(기본), separate = 별도 호출 */
  tidy: 'same',
  span_cap: '20000',
  rules: '',
  director_rules: '',
  /** 다른 보조 호출과 병렬 */
  parallel: '0',
  keep_raw: '1',
};

export interface PeopleSettings {
  on: boolean;
  when: 'turn' | 'manual';
  model: 'main' | 'aux';
  prompt: 'detailed' | 'compact';
  inject: 'split' | 'append' | 'record' | 'off';
  director: 'off' | 'note' | 'facts' | 'scene';
  directorLang: 'en' | 'ko';
  directorLen: 'short' | 'normal';
  directorTimeout: number;
  directorReuse: boolean;
  directorSearch: boolean;
  directorFeatures: boolean;
  router: 'code' | 'model';
  routerTimeout: number;
  /** 항상 포함할 인물 이름 (기록에 있는지는 쓰는 쪽이 확인) */
  always: string[];
  /** Router·Director 가 보는 최근 글 수 */
  recentMsgs: number;
  /** Router 지침 덮어쓰기(비면 기본)와 덧붙일 지침 */
  routerPrompt: string;
  routerRules: string;
  /** 단계별 모델 (same 은 갱신 모델로 푼 값) 과 전용 모델 ID (비면 없음) */
  stageModel: Record<Stage, 'main' | 'aux'>;
  stageModelId: Record<Stage, string>;
  hypa: boolean;
  hypaCap: number;
  hypaItems: number;
  hypaPlus: boolean;
  /** 갱신기 절 덮어쓰기 (지금 지침 판 기준) 와 Director 기본 지침 덮어쓰기 */
  promptOverrides: Record<string, string>;
  directorPrompt: string;
  speed: number;
  /** 호감 감소 승수 */
  speedDown: number;
  turnCap: number;
  features: Set<Feature>;
  /** 수치를 켠 기능 */
  numeric: Set<NumericFeature>;
  /** 켜져 있지만 수치를 끈 기능 (정성 모드) */
  qualitative: Set<NumericFeature>;
  newPeople: 'auto' | 'confirm';
  twoTurn: boolean;
  prevPairs: number;
  lang: 'ko' | 'en';
  personCap: number;
  blockCap: number;
  tidy: 'same' | 'separate';
  factionInject: boolean;
  factionBounds: [number, number, number, number];
  mobWeight: 'half' | 'full' | 'off';
  spanCap: number;
  rules: string;
  directorRules: string;
  parallel: boolean;
  keepRaw: boolean;
}

/** 리수폿 J-1 지침 편집: 절 본문 덮어쓰기 변수 (지침 판·절 이름별). director = 연출형 Director 기본 지침 */
export const PS = (prompt: string, section: string) => `$pp_ps_${prompt}_${section}`;
export const PS_PREFIX = '$pp_ps_';
export function promptOverrides(state: Record<string, unknown> | undefined, prompt: string): Record<string, string> {
  const out: Record<string, string> = {};
  const head = `${PS_PREFIX}${prompt}_`;
  for (const [k, v] of Object.entries(state ?? {})) if (k.startsWith(head) && typeof v === 'string' && v.trim()) out[k.slice(head.length)] = v;
  return out;
}

export type Stage = 'update' | 'director' | 'router' | 'tidy';
export const STAGES_ALL: Stage[] = ['update', 'director', 'router', 'tidy'];

export function ppValue(state: Record<string, unknown> | undefined, key: string): string {
  const v = state?.[PP(key)];
  return v === undefined || v === null || v === '' || v === 'null' ? (PP_DEFAULTS[key] ?? '') : String(v);
}

export function peopleSettings(state: Record<string, unknown> | undefined): PeopleSettings {
  const v = (k: string) => ppValue(state, k);
  // 0 도 고른 값이다 (메시지당 변화 상한 0 = 한도 없음, 직전 쌍 0). 예전엔 `|| 기본값` 이라 0 이 기본값(10·1)으로 바뀌었다 (QC 2026-10-28)
  const num = (k: string, min: number, max: number) => {
    const n = Number(v(k));
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : Number(PP_DEFAULTS[k])));
  };
  const one = <T extends string>(k: string, list: readonly T[]): T => (list.includes(v(k) as T) ? (v(k) as T) : (PP_DEFAULTS[k] as T));
  return {
    on: v('on') === '1',
    when: one('when', ['turn', 'manual'] as const),
    model: v('model') === 'main' ? 'main' : 'aux',
    prompt: one('prompt', ['detailed', 'compact'] as const),
    inject: one('inject', ['split', 'append', 'record', 'off'] as const),
    director: one('director', ['off', 'note', 'facts', 'scene'] as const),
    directorLang: v('director_lang') === 'ko' ? 'ko' : 'en',
    directorLen: v('director_len') === 'normal' ? 'normal' : 'short',
    directorTimeout: num('director_timeout', 5, 300),
    directorReuse: v('director_reuse') !== '0',
    directorSearch: v('director_search') !== '0',
    directorFeatures: v('director_features') !== '0',
    router: v('router') === 'model' ? 'model' : 'code',
    routerTimeout: num('router_timeout', 5, 300),
    always: [...new Set(v('always').split(/[,\n]/).map((x) => x.trim().normalize('NFC')).filter(Boolean))].slice(0, 12),
    recentMsgs: num('recent_msgs', 0, 12),
    routerPrompt: (typeof state?.[PS('router', 'base')] === 'string' ? String(state[PS('router', 'base')]) : '').trim().slice(0, 12000),
    routerRules: v('router_rules').slice(0, 2000),
    stageModel: (() => {
      const base = v('model') === 'main' ? 'main' : 'aux';
      const pick = (k: string): 'main' | 'aux' => (v(k) === 'main' ? 'main' : v(k) === 'aux' ? 'aux' : base);
      return { update: base, director: pick('model_director'), router: pick('model_router'), tidy: pick('model_tidy') };
    })(),
    stageModelId: { update: v('model_id_update').trim().slice(0, 120), director: v('model_id_director').trim().slice(0, 120), router: v('model_id_router').trim().slice(0, 120), tidy: v('model_id_tidy').trim().slice(0, 120) },
    hypa: v('hypa') === '1',
    hypaCap: num('hypa_cap', 500, 24000),
    hypaItems: num('hypa_items', 1, 64),
    hypaPlus: v('hypa_plus') !== '0',
    promptOverrides: promptOverrides(state, one('prompt', ['detailed', 'compact'] as const)),
    directorPrompt: (typeof state?.[PS('director', 'base')] === 'string' ? String(state[PS('director', 'base')]) : '').trim().slice(0, 12000),
    speed: num('speed', 0.25, 4),
    speedDown: v('speed_down') === 'same' || v('speed_down') === '' ? num('speed', 0.25, 4) : num('speed_down', 0.25, 4),
    turnCap: num('turn_cap', 0, 100),
    features: new Set(FEATURES.filter((f) => v(f) === '1' && !(f === 'taste' && v('num_affinity') === '0'))),
    numeric: new Set(NUMERIC_FEATURES.filter((f) => v(`num_${f}`) !== '0')),
    qualitative: new Set(NUMERIC_FEATURES.filter((f) => v(f) === '1' && v(`num_${f}`) === '0')),
    newPeople: v('newpeople') === 'confirm' ? 'confirm' : 'auto',
    twoTurn: v('twoturn') !== '0',
    prevPairs: num('prev_pairs', 0, 3),
    lang: v('lang') === 'en' ? 'en' : 'ko',
    personCap: num('person_cap', 2000, 40000),
    blockCap: num('block_cap', 4000, 64000),
    tidy: v('tidy') === 'separate' ? 'separate' : 'same',
    factionInject: v('faction_inject') !== '0',
    factionBounds: parseBounds(v('faction_bounds')),
    mobWeight: one('mob_weight', ['half', 'full', 'off'] as const),
    spanCap: num('span_cap', 3000, 40000),
    rules: v('rules').slice(0, 4000),
    directorRules: v('director_rules').slice(0, 2000),
    parallel: v('parallel') === '1',
    keepRaw: v('keep_raw') !== '0',
  };
}

/** 구간 경계 「61,21,-20,-60」: 네 정수, 내림차순, −100~100. 아니면 기본값 */
export function parseBounds(text: string): [number, number, number, number] {
  const n = String(text ?? '').split(',').map((x) => Number(x.trim()));
  const ok = n.length === 4 && n.every((x) => Number.isInteger(x) && x >= -100 && x <= 100) && n[0] > n[1] && n[1] > n[2] && n[2] > n[3];
  return ok ? (n as [number, number, number, number]) : [61, 21, -20, -60];
}
