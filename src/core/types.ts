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
  /** 시작 화면 사진 에셋 이름 */
  photo?: string;
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
}

export interface StartChoice {
  faction: FactionCode;
  lang: LangCode;
  fm: number;
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
