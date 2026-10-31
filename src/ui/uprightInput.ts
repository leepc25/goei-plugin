// 돌려 보이는 게임(아이폰 세로 = 게임 90도 회전) 안의 입력칸을 바로 세워 키패드 바로 위에 띄운다 (모바일 조작 설계 2026-10-28).
// 회전된 층 밖(document.body)에 임시 입력 상자를 두고, 쓴 글을 원래 입력칸(.gt-in 등)에 넘긴다. 보내기는 원래 칸에 Enter 를 보낸다.
// 실제 가로 고정이 된 안드로이드(돌리지 않음)는 그대로 둔다.
export function uprightInput(layer: HTMLElement, rotated: () => boolean): () => void {
  let box: HTMLElement | null = null;
  let src: HTMLInputElement | HTMLTextAreaElement | null = null;
  const vv = typeof visualViewport !== 'undefined' ? visualViewport : null;
  const place = () => {
    if (!box) return;
    // 키패드가 올라오면 보이는 높이가 준다: 그 바로 위
    const bottom = vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    box.style.bottom = `${bottom}px`;
  };
  const close = (blurSrc = true) => {
    const s = src;
    box?.remove();
    box = null;
    src = null;
    if (blurSrc) s?.blur();
  };
  const onFocus = (e: FocusEvent) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) || !layer.contains(t) || !rotated() || box) return;
    src = t;
    const b = document.createElement('div');
    b.className = 'gx-upright';
    b.innerHTML = '<input type="text" autocomplete="off" enterkeyhint="send"><button type="button" data-up="send">보내기</button><button type="button" data-up="close">닫기</button>';
    const inp = b.querySelector('input')!;
    inp.value = t.value;
    inp.placeholder = t.placeholder;
    if (t.maxLength > 0) inp.maxLength = t.maxLength;
    inp.setAttribute('aria-label', t.getAttribute('aria-label') ?? '입력');
    const sync = () => {
      if (!src) return;
      src.value = inp.value;
      src.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const send = () => {
      const s = src;
      if (!s) return;
      sync();
      s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }));
      close();
    };
    inp.addEventListener('input', sync);
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.isComposing && ev.keyCode !== 229) (ev.preventDefault(), send());
      else if (ev.key === 'Escape') close();
    });
    // 상자 밖으로 초점이 나가면 닫는다 (단추 누르는 사이는 기다린다)
    inp.addEventListener('blur', () => setTimeout(() => box && !box.contains(document.activeElement) && close(), 120));
    b.addEventListener('click', (ev) => {
      const k = (ev.target as HTMLElement).closest<HTMLElement>('[data-up]')?.dataset.up;
      if (k === 'send') send();
      else if (k === 'close') close();
    });
    box = b;
    document.body.append(b);
    place();
    inp.focus({ preventScroll: true });
  };
  layer.addEventListener('focusin', onFocus);
  vv?.addEventListener('resize', place);
  vv?.addEventListener('scroll', place);
  return () => {
    layer.removeEventListener('focusin', onFocus);
    vv?.removeEventListener('resize', place);
    vv?.removeEventListener('scroll', place);
    close(false);
  };
}
