/** Canvas CSS transforms do not change clientWidth. Measure the displayed canvas. */
export function mapViewport(canvas: HTMLCanvasElement, requestedScale = 1, width = canvas.width, height = canvas.height) {
  const rect = canvas.getBoundingClientRect();
  const turned = canvas.closest('.gs')?.classList.contains('turned');
  const displayWidth = turned ? rect.height : rect.width;
  const scale = Math.max(1, Math.min(2.4, displayWidth > 0 ? width / displayWidth : requestedScale));
  const touch = !!canvas.closest('.gs')?.querySelector('.tp:not(.hide)')
    || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  return { width, height, scale, touch: !!touch, margin: touch ? 108 : 32 };
}

/** Cleared at the HUD pass, then enabled only when the full map is drawn. */
export function setExplorationMap(canvas: HTMLCanvasElement, open: boolean) {
  canvas.closest('.gs')?.classList.toggle('exploration-map', open);
}
