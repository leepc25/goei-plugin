// 요청 속 상태창 정리 (2026-10-23 설계).
// 괴이·사건·특수·요원 태그는 카드 지침의 현재 보고서 변수가 직전 값을 알려 줘서 지난 응답의 태그를 지워도 된다.
// 상태창에는 그런 변수가 없어서 지난 응답의 줄이 직전 값을 알려 주는 유일한 길이었다.
// 그래서 요청 속 지난 상태창 줄은 모두 지우고, 마지막 한 줄만 「직전 상태」 블록으로 마지막 사용자 메시지 앞에 넣는다.
// 요청 속 메시지에서 찾으므로 다시 굴리기에도 맞다(다시 만들 응답은 요청에 없다). 저장 본문과 화면은 건드리지 않는다.
import { findStatusTags } from './world/status';
import type { PromptMessage } from './request';

export const STATUS_HEAD = '[Previous status]';
const NOTE =
  'This is the status line of the scene right before the next input; older status lines were removed from the history. ' +
  'Continue from it: advance the time, update the other fields, and output exactly one new [▣] line at the very end of your response.';

/** 요청 속 마지막 상태창 줄 (원문). 없으면 null */
export function lastStatusLine(messages: PromptMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'assistant' || typeof m.content !== 'string') continue;
    const tags = findStatusTags(m.content);
    if (tags.length) return tags[tags.length - 1].raw.trim();
  }
  return null;
}

/** 지난 응답의 상태창 줄을 모두 지운다 (줄만 지우고 본문은 그대로) */
export function stripStatusLines<M extends PromptMessage>(messages: M[]): M[] {
  return messages.map((m) => {
    if (m?.role !== 'assistant' || typeof m.content !== 'string') return m;
    const tags = findStatusTags(m.content);
    if (!tags.length) return m;
    let c = m.content;
    for (const t of tags) c = c.replace(t.raw, '');
    return { ...m, content: c.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() };
  });
}

export function statusBlock(line: string): string {
  return `${STATUS_HEAD}\n${line}\n${NOTE}`;
}

/** 지난 줄을 지우고 마지막 한 줄을 직전 상태 블록으로 넣는다. 상태창이 하나도 없으면 그대로 */
export function withStatusBlock<M extends PromptMessage>(messages: M[]): M[] {
  if (messages.some((m) => typeof m?.content === 'string' && m.content.startsWith(STATUS_HEAD))) return messages;
  const line = lastStatusLine(messages);
  if (!line) return messages;
  const out = stripStatusLines(messages);
  const at = out.map((m) => m?.role).lastIndexOf('user');
  const block = { role: 'system', content: statusBlock(line) } as M;
  return at < 0 ? [...out, block] : [...out.slice(0, at), block, ...out.slice(at)];
}
