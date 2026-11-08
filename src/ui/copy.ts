// 글 복사 단추 (2026-11-08 사용자: 지침·세계 로어 칸마다 드래그 없이 클립보드로, 종이 두 장 겹친 기호).
// 단추는 data-copy 만 달고 창을 다시 그리지 않는다. 옆 글칸(가까운 .gw-copyto 안의 textarea·input·pre) 글을 복사한다.
import { ICONS } from './icons';

/** 복사 단추 (가까운 .gw-copyto 안의 글을 복사) */
export const copyBtn = (label = '복사') => `<button type="button" class="gx-mini icon gw-copy" data-copy aria-label="${label}" title="${label}">${ICONS.copy}</button>`;

/** 글을 클립보드로. Risu 안에서 navigator.clipboard 가 막혀 있으면 임시 글칸 + execCommand('copy') (2026-11-05 사용자) */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 아래 */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-copy]');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    const el = b.closest('.gw-copyto')?.querySelector<HTMLElement>('textarea, pre, input[data-input]:not(.gw-xname):not(.gw-gtitle)');
    if (!el) return;
    const text = (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement ? el.value : el.textContent ?? '').replace(/^\n/, '');
    void copyText(text).then((ok) => {
      if (!ok) return;
      b.classList.add('done');
      b.innerHTML = ICONS.check;
      setTimeout(() => {
        b.classList.remove('done');
        b.innerHTML = ICONS.copy;
      }, 1200);
    });
  }, true);
}
