// 이름 뒤 조사: 마지막 글자에 받침이 있으면 앞의 것(을·이·은·과), 없으면 뒤의 것(를·가·는·와).
// 한글이 아니면(영문·숫자 등) 받침을 알 수 없어 「을(를)」처럼 둘 다 적는다.
export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return `${word}${withBatchim}(${without})`;
  return `${word}${code % 28 ? withBatchim : without}`;
}
