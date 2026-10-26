// 인물 기록 설정 (채팅별, scriptstate 변수 `$pp_*`. 괴담톡 설정과 같은 방식). 기본값은 설계 문서의 추천값.
export const PP = (key: string) => `$pp_${key}`;

export type Feature = 'affinity' | 'register' | 'perception' | 'perception_ext' | 'suspicion' | 'docs_event' | 'docs_location' | 'docs_faction' | 'docs_item' | 'npc_emotion' | 'taste' | 'openness' | 'rhythm';
export const FEATURES: Feature[] = ['affinity', 'register', 'perception', 'perception_ext', 'suspicion', 'docs_event', 'docs_location', 'docs_faction', 'docs_item', 'npc_emotion', 'taste', 'openness', 'rhythm'];

export const PP_DEFAULTS: Record<string, string> = {
  on: '1',
  /** turn = 매 턴 자동, manual = 「지금 갱신」만 */
  when: 'turn',
  model: 'aux',
  /** detailed = 자세히(원문), compact = 간결 */
  prompt: 'detailed',
  /** split = 절 단위 혼합, append = 시트 전체 + 기록, record = 기록만, off = 본편에 안 넣음 */
  inject: 'split',
  /** off / facts(뒤, 갱신기에 얹음) / scene(앞, 연출형) */
  director: 'facts',
  director_lang: 'en',
  director_len: 'short',
  director_timeout: '20',
  director_reuse: '1',
  speed: '1',
  affinity: '1', register: '1', perception: '1', perception_ext: '1', suspicion: '1',
  docs_event: '1', docs_location: '1', docs_faction: '1', docs_item: '1', npc_emotion: '1',
  /** 리수폿 선택 기능: 취향 띠·음란도·서사 리듬. 기본 끔 */
  taste: '0', openness: '0', rhythm: '0',
  /** auto / confirm */
  newpeople: 'auto',
  twoturn: '0',
  prev_pairs: '1',
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
  director: 'off' | 'facts' | 'scene';
  directorLang: 'en' | 'ko';
  directorLen: 'short' | 'normal';
  directorTimeout: number;
  directorReuse: boolean;
  speed: number;
  features: Set<Feature>;
  newPeople: 'auto' | 'confirm';
  twoTurn: boolean;
  prevPairs: number;
  lang: 'ko' | 'en';
  personCap: number;
  blockCap: number;
  tidy: 'same' | 'separate';
  spanCap: number;
  rules: string;
  directorRules: string;
  parallel: boolean;
  keepRaw: boolean;
}

export function ppValue(state: Record<string, unknown> | undefined, key: string): string {
  const v = state?.[PP(key)];
  return v === undefined || v === null || v === '' || v === 'null' ? (PP_DEFAULTS[key] ?? '') : String(v);
}

export function peopleSettings(state: Record<string, unknown> | undefined): PeopleSettings {
  const v = (k: string) => ppValue(state, k);
  const num = (k: string, min: number, max: number) => Math.max(min, Math.min(max, Number(v(k)) || Number(PP_DEFAULTS[k])));
  const one = <T extends string>(k: string, list: readonly T[]): T => (list.includes(v(k) as T) ? (v(k) as T) : (PP_DEFAULTS[k] as T));
  return {
    on: v('on') === '1',
    when: one('when', ['turn', 'manual'] as const),
    model: v('model') === 'main' ? 'main' : 'aux',
    prompt: one('prompt', ['detailed', 'compact'] as const),
    inject: one('inject', ['split', 'append', 'record', 'off'] as const),
    director: one('director', ['off', 'facts', 'scene'] as const),
    directorLang: v('director_lang') === 'ko' ? 'ko' : 'en',
    directorLen: v('director_len') === 'normal' ? 'normal' : 'short',
    directorTimeout: num('director_timeout', 5, 120),
    directorReuse: v('director_reuse') !== '0',
    speed: num('speed', 0.25, 4),
    features: new Set(FEATURES.filter((f) => v(f) === '1')),
    newPeople: v('newpeople') === 'confirm' ? 'confirm' : 'auto',
    twoTurn: v('twoturn') !== '0',
    prevPairs: num('prev_pairs', 0, 3),
    lang: v('lang') === 'en' ? 'en' : 'ko',
    personCap: num('person_cap', 2000, 40000),
    blockCap: num('block_cap', 4000, 64000),
    tidy: v('tidy') === 'separate' ? 'separate' : 'same',
    spanCap: num('span_cap', 3000, 40000),
    rules: v('rules').slice(0, 4000),
    directorRules: v('director_rules').slice(0, 2000),
    parallel: v('parallel') === '1',
    keepRaw: v('keep_raw') !== '0',
  };
}
