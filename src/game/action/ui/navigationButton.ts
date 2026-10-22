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
  label.textContent = text;
  Object.assign(label.style, {
    display: 'block', position: 'absolute', inset: 'auto 2px 2px',
    background: 'rgba(7,11,15,.9)', color: locked ? '#f0b45a' : '#fff8e6',
    font: '700 12px sans-serif', lineHeight: '15px', textAlign: 'center',
    pointerEvents: 'none', textShadow: 'none',
  });
}
