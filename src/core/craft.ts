// 생성 방식 (라이트보드 5.0.0에서 옮김, 2026-11-06 사용자 「전부 넣어야지」): 괴담넷·괴담톡·위키 요청문에 공통으로 덧붙이는 것.
// - 생각 단계 (원본 「생각보조」 적고 제거 / 생각만 / 안하기): 기능마다 다른 순서표(지침의 THOUGHTS.* 절)를 붙인다.
//   적고 지움이면 모델이 <lb-process> 안에 짧게 적고, 모델 호출(host/llm.ts)이 그 칸을 떼고 결과만 넘긴다.
// - 비망록 (원본 「탈옥 (비망록)」): 지침의 MEMO.* 절. 맨 앞에 인물 글과 작업 문장, 맨 끝에 미리 채운 응답과 사용자 한마디.
// 다시 보기·동시 요청 수·재시도 문구는 모델 호출 쪽(host/llm.ts)에서 한다.
import { advNum, advValue, type AdvFeature } from './advanced';

export type ThoughtsMode = 'off' | 'inner' | 'note';
type State = Record<string, unknown> | undefined;
type Feature = Exclude<AdvFeature, 'gen'>;

export interface CraftSettings {
  thoughts: ThoughtsMode;
  memo: boolean;
  /** 다시 보기 횟수. 기능 값이 0이면 공통 값 */
  reiterate: number;
}

export function craftSettings(state: State, f: Feature): CraftSettings {
  const t = advValue(state, f, 'thoughts');
  return {
    thoughts: t === 'inner' || t === 'note' ? t : 'off',
    memo: advValue(state, f, 'memo') === '1',
    reiterate: advNum(state, f, 'reiterate') || advNum(state, 'gen', 'reiterate'),
  };
}

export interface CraftTexts {
  /** 이 작업의 생각 순서표 (없으면 생각 단계를 붙이지 않는다) */
  thoughts?: string;
  memo?: { persona: string; job: string; prefill: string; prefillUser: string };
}

export interface CraftMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 다시 물을 때 붙이는 원인 분석 지시 (원본은 생각 단계를 꺼도 이렇게 한다). <lb-process> 칸은 모델 호출이 지운다 */
export const RETRY_ANALYZE = 'First analyze the error source step-by-step in a short <lb-process> block, then print only the required node with the corrected data in it, without apologies, explanations, or preambles.';

/** 원본 lb.thoughts 머리말 (모드별) */
const NOTE_HEAD = 'Think step-by-step for final data, but keep minimal draft per step.\n\nFollow this template.';
const NOTE_TAIL = 'Always include subject and object. For list items like generated new topics, summarize them into 3-5 essential keywords, focusing on nouns. '
  + 'Write the process in an extremely condensed telegraphic style plaintext, almost to the level of noun lists, without any preambles or markdown decorations.\n\n'
  + 'Put the above step-by-step process into a `<lb-process>` block BEFORE the required output:\n<lb-process>\n(process)\n</lb-process>\n\nThen output the required data exactly as instructed. The application removes the <lb-process> block.';
const INNER_HEAD = 'The following template is your internal guide. Reason through it thoroughly, every step of it. Do not write the reasoning out; output only the required data.';

/** system 칸 하나를 고친다 (첫 system, 없으면 맨 앞에 새로) */
function editSystem(messages: CraftMessage[], edit: (s: string) => string): CraftMessage[] {
  const i = messages.findIndex((m) => m.role === 'system');
  if (i < 0) return [{ role: 'system', content: edit('') }, ...messages];
  return messages.map((m, j) => (j === i ? { ...m, content: edit(m.content) } : m));
}

/** 요청문에 생각 단계·비망록을 덧붙인다. 설정이 꺼져 있거나 지침에 그 절이 없으면 그대로 */
export function craftMessages<M extends CraftMessage>(messages: M[], s: CraftSettings, texts: CraftTexts): CraftMessage[] {
  let out: CraftMessage[] = messages;
  const steps = texts.thoughts?.trim();
  if (steps && s.thoughts !== 'off') {
    const block = s.thoughts === 'note' ? `# Thoughts\n${NOTE_HEAD}\n\n${steps}\n\n${NOTE_TAIL}` : `# Thoughts Guideline\n${INNER_HEAD}\n\n${steps}`;
    out = editSystem(out, (sys) => `${sys}\n\n${block}`);
  }
  const memo = texts.memo;
  if (s.memo && memo && memo.persona.trim()) {
    out = editSystem(out, (sys) => `${memo.persona.trim()}\n\n${memo.job.trim() ? `# Job Note\n${memo.job.trim()}\n\n` : ''}${sys}`);
    if (memo.prefill.trim()) {
      out = [...out, { role: 'assistant', content: memo.prefill.trim() }];
      if (memo.prefillUser.trim()) out = [...out, { role: 'user', content: memo.prefillUser.trim() }];
    }
  }
  return out;
}

/** 지침 절 읽기 함수로 비망록 묶음을 만든다 */
export function memoTexts(read: (name: string) => string): CraftTexts['memo'] {
  return { persona: read('MEMO.PERSONA'), job: read('MEMO.JOB'), prefill: read('MEMO.PREFILL'), prefillUser: read('MEMO.PREFILL_USER') };
}
