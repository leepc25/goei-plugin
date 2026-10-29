import type { NavigationFeedback } from '../engine/navigationFeedback';

/** 기존 손 그림 버튼에 조사/잠김 글자만 덧붙인다. 입력 판정과 공용 CSS는 건드리지 않는다. */
export function syncNavigationButton(canvas: HTMLCanvasElement, navigation?: NavigationFeedback) {
  const button = canvas.closest('.gs')?.querySelector<HTMLElement>('.tp [data-id="interact"]');
  if (!button) return;
  const target = navigation?.target;
  const locked = target?.kind === 'locked';
  const active = !!target && !locked && target.kind !== 'decoration';
  const text = locked ? '잠김' : '조사';
  const description = target ? `${text} · ${target.text}${target.reason ? ` · ${target.reason}` : ''}` : '조사 · 표시된 대상에 가까이 가세요';
  if (button.getAttribute('aria-label') === description) return;
  button.setAttribute('aria-label', description);
  button.title = description;
  button.classList.toggle('hint', active);
  const label = button.querySelector<HTMLElement>('b');
  if (!label) return;
  // 버튼 그림을 가리지 않게 버튼 아래 한 줄 (참고 모바일 게임처럼 버튼 자체는 아이콘만). 잠김일 때만 글자를 띄운다
  label.textContent = text;
  Object.assign(label.style, {
    display: locked ? 'block' : 'none', position: 'absolute', left: '50%', top: '100%', transform: 'translate(-50%, 2px)',
    padding: '0 6px', borderRadius: '6px', whiteSpace: 'nowrap',
    background: 'rgba(7,11,15,.85)', color: '#f0b45a',
    font: '700 11px sans-serif', lineHeight: '16px', textAlign: 'center',
    pointerEvents: 'none', textShadow: 'none',
  });
}
