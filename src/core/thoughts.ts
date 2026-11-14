// 생각 모델의 속생각 블록 (전수검사 11-13)
/** Risu 가 생각 모델의 속생각을 응답 앞에 붙여 저장한 블록 (<Thoughts>…</Thoughts>). 저장 본문에서는 지우지 않고 읽을 때만 뗀다.
 *  닫히지 않은 블록은 글 맨 앞에서 시작할 때만 통째로 생각으로 본다 (전수검사 11-13) */
export function stripThoughts(text: string): string {
  const t = text.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>\s*/gi, '');
  return /^\s*<(?:thoughts|think)\b[^>]*>/i.test(t) ? '' : t;
}

/** 응답 맨 앞의 생각 블록과 나머지로 나눈다 (상황판 태그 처리는 나머지에만, 저장할 때 다시 붙인다) */
export function splitThoughts(text: string): { head: string; body: string } {
  // 이어진 블록 전부, <Thoughts>·<think> 둘 다 (재검토 11-14 ①-5)
  const m = /^\s*(?:<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>\s*)+/i.exec(text);
  return m ? { head: m[0], body: text.slice(m[0].length) } : { head: '', body: text };
}
