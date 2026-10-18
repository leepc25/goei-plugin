// 잠깐 떴다 사라지는 안내 (v0.16.23, 사용자 요청): 「연락처를 추가했어요」 같은 말이 줄을 차지한 채 남아 있었다.
// 화면 위에 떠서 자리를 먹지 않고, 글 길이에 맞춰 몇 초 뒤 스스로 사라진다. 다시 그려도 시계는 이어진다.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const timers = new Map<string, { text: string; id: ReturnType<typeof setTimeout> }>();

/** key: 화면마다 하나 (ph·gn). clear(text): 그 글이 아직 떠 있으면 상태에서 지운다 */
export function toast(key: string, text: string, clear: (text: string) => void): string {
  if (!text) return '';
  const cur = timers.get(key);
  if (!cur || cur.text !== text) {
    if (cur) clearTimeout(cur.id);
    const ms = Math.min(8000, 2500 + [...text].length * 50);
    const id = setTimeout(() => {
      timers.delete(key);
      clear(text);
      const el = document.querySelector<HTMLElement>(`.gx-toast[data-toast="${key}"]`);
      if (!el) return;
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, ms);
    timers.set(key, { text, id });
  }
  return `<div class="gx-toast gn-notice" data-toast="${key}" role="status">${esc(text)}</div>`;
}
