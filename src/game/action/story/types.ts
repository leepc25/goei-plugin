// 대사·컷신 공용 형식. 엔진(전투)·본부·층 생성 쪽은 이 파일의 형식만 알면 된다.

/** 플레이어블 요원. 회색 상자 시험판(graybox/data.ts)과 같은 id를 쓴다. */
export type AgentId = 'jyaldi' | 'eileen' | 'spangdal' | 'geshugan' | 'gorgodio' | 'kyuras' | 'deadpole' | 'rojemon';
export const AGENT_IDS: AgentId[] = ['jyaldi', 'eileen', 'spangdal', 'geshugan', 'gorgodio', 'kyuras', 'deadpole', 'rojemon'];

/** 말하는 쪽. agent는 지금 출동한 요원으로 바뀐다. */
export type SpeakerId =
  | AgentId
  | 'agent'
  | 'jaemtri'
  | 'gognija'
  | 'dejure'
  | 'konjyuce'
  | 'madeokhee'
  | 'elevator'
  | 'passenger'
  | 'survivor'
  | 'fake'
  | 'daydream'
  | 'narr'
  | 'radio';

export type Mood = 'base' | 'smile' | 'serious' | 'hurt' | 'surprise';

/** 상태 값. 플래그·총애·규칙 수 같은 것을 한 곳에 둔다. */
export type Value = number | string | boolean;
export type Flags = Record<string, Value>;

export interface SayNode {
  t: 'say';
  who: SpeakerId;
  text: string;
  mood?: Mood;
  line: number;
}
export interface ChoiceOption {
  text: string;
  to: string;
  if?: string;
  set?: string;
}
export interface ChoiceNode {
  t: 'choice';
  options: ChoiceOption[];
  line: number;
}
export interface PickNode {
  t: 'pick';
  lines: SayNode[];
  line: number;
}
export interface SetNode {
  t: 'set';
  key: string;
  op: '=' | '+=' | '-=';
  expr: string;
  line: number;
}
export interface GotoNode {
  t: 'goto';
  to: string;
  if?: string;
  line: number;
}
export interface EmitNode {
  t: 'emit';
  event: string;
  arg: string;
  line: number;
}
export interface CallNode {
  t: 'call';
  script: string;
  line: number;
}
/** 요원 대사표의 태그 하나를 지금 요원 말로 넣는다. */
export interface AgentLineNode {
  t: 'agentline';
  tag: string;
  who: SpeakerId;
  line: number;
}
export interface EndNode {
  t: 'end';
  line: number;
}
export type ScriptNode = SayNode | ChoiceNode | PickNode | SetNode | GotoNode | EmitNode | CallNode | AgentLineNode | EndNode;

export interface Script {
  id: string;
  nodes: ScriptNode[];
  labels: Record<string, number>;
}

/** 실행기가 화면에 내보내는 한 걸음 */
export type StoryStep =
  | { kind: 'say'; who: SpeakerId; name: string; text: string; mood: Mood }
  | { kind: 'choice'; options: { text: string; index: number }[] }
  | { kind: 'end' };

/** 엔진에서 대사 쪽으로 오는 사건. 말풍선(전투 중)과 대화창(멈춤)을 고르는 근거가 된다. */
export type StoryEvent =
  | 'combat:start'
  | 'combat:boss'
  | 'combat:kill'
  | 'combat:combo'
  | 'combat:dodge'
  | 'combat:ult'
  | 'combat:guardbreak'
  | 'ammo:low'
  | 'ammo:empty'
  | 'weapon:pickup'
  | 'item:use'
  | 'hp:low'
  | 'find:rule'
  | 'find:item'
  | 'rule:break'
  | 'intrude:fake'
  | 'intrude:daydream'
  | 'rescue'
  | 'win'
  | 'floor:enter'
  | 'attic:enter'
  | 'down'
  | 'revive';
