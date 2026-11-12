/** 기본값이 든 글 칸의 공통 규칙 (2026-11-12 사용자: 회색 안내 글을 기본값으로 쓰지 않는다 — 한 글자만 쳐도 기본값이 통째로 사라졌다).
 *  · 저장된 값이 없으면 칸에 기본값 글이 진짜 값으로 들어 있다 (바로 고쳐 쓴다)
 *  · 칸 내용이 기본값과 같거나 비었으면 저장하지 않는다 ('' = 기본 따름. 기본값이 바뀌면 따라간다)
 *  · 기본값과 다르게 고친 칸만 「바꾼 줄」(.adv-row.changed 점) */

/** 견줄 때의 모양: 줄마다 빈칸을 하나로, 앞뒤·빈 줄 없앰 */
export const defNorm = (text: string): string =>
  String(text ?? '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

/** 칸에 보일 글 */
export const defShown = (stored: string, def: string): string => (String(stored ?? '').trim() === '' ? def : String(stored));

/** 기본값과 다르게 고쳤나 */
export function defChanged(stored: string, def: string, norm: (t: string) => string = defNorm): boolean {
  const s = norm(String(stored ?? ''));
  return s !== '' && s !== norm(def);
}

/** 저장할 글: 비었거나 기본값과 같으면 '' */
export function defStored(input: string, def: string, norm: (t: string) => string = defNorm, max = 4000): string {
  const text = String(input ?? '').trim().slice(0, max);
  return defChanged(text, def, norm) ? text : '';
}
