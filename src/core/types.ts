/** 플레이 세력 코드: 기본 A00~E00, 명부에서 만든 새 세력 F00~ */
export type FactionCode = string;
export type FactionType = 'org' | 'civilian' | 'freelancer';
export type LangCode = 'ko' | 'en';
export type ScenarioKind = 'opening' | 'direct' | 'preset';

export interface Scenario {
  fm: number;
  label: string;
  kind: ScenarioKind;
}

export interface Faction {
  code: FactionCode;
  name: string;
  affiliation: string;
  blurb: string;
  scenarios: Scenario[];
  /** 명부에서 고른 대표 사진 (비우면 영문명으로 찾는다, ui/images factionPic) */
  photo?: string;
  /** 영문명 (사진을 찾는 이름) */
  english?: string;
  type?: FactionType;
  /** 기본 다섯 세력 */
  builtin?: boolean;
  /** 시작 화면에서 숨김 (기본 세력만) */
  hidden?: boolean;
  /** 새 세력: [AC] 목록·📜Faction에 쓰는 영어 이름과 설명 */
  gmName?: string;
  gmDesc?: string;
  /** 새 세력: 시작 첫 턴에 함께 넣을 로어북 */
  seed?: string[];
  /** 새 세력: 괴담톡 전용 탭 이름 */
  tab?: string;
  /** 새 세력: 명부 조직 이름 */
  org?: string;
}

export interface ScenarioData {
  languages: { code: LangCode; label: string }[];
  factions: Faction[];
  defaultScenario: Record<string, number>;
}

export interface LoreEntry {
  comment?: string;
  content?: string;
  [key: string]: unknown;
}

export interface Manifest {
  schema: number;
  plugin: string;
  source?: { name?: string; version?: string };
  /** "A00-ko-1" → alternateGreetings index */
  greetings: Record<string, number>;
  /** 카드 버전 */
  version?: string;
  /** 사진·에셋 지문 (build_lite_card.py). 카드 업데이트로 못 옮기는 사진이 바뀌었는지 비교용 */
  assets?: string;
  /** 카드 사진 [이름, 지문, 확장자, 바이트]. 창의 업데이트가 지문이 바뀐 것만 받아 바꾼다 (host/picpack.ts) */
  pictures?: [string, string, string, number][];
  /** 폴더 key (settings·wiki): 이름 대신 key 로 찾는다 (core/install.ts findFolder) */
  keys?: Record<string, string>;
  /** 위키 기본 문서 묶음 지문·길이 (release/wiki-base) */
  wiki?: { digest?: string; length?: number };
}

export interface StartChoice {
  faction: FactionCode;
  lang: LangCode;
  fm: number;
  /** 캐릭터로 플레이: 유저가 연기할 요원 코드 (없으면 페르소나) */
  player?: string;
}

export type ScriptState = Record<string, string | number | boolean>;

export interface ChatMessage {
  role: 'user' | 'char' | string;
  data: string;
  [key: string]: unknown;
}

export interface Chat {
  message: ChatMessage[];
  fmIndex?: number;
  scriptstate?: ScriptState;
  [key: string]: unknown;
}
