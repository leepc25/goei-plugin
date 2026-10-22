// 입력 모음: 키보드·터치·게임패드를 같은 키 코드로 합친다.
// 엔진은 held/pressed/axis 를 읽거나, synth 를 켜서 window 의 keydown/keyup 만 들어도 된다.
import { ALIAS, KEY_OF } from './keys';

export type Source = 'kb' | 'touch' | 'pad';
const MARK = '__goeiSynth';

export class InputHub {
  private bySrc = new Map<Source, Set<string>>([
    ['kb', new Set()],
    ['touch', new Set()],
    ['pad', new Set()],
  ]);
  private down = new Set<string>();
  private edgeDown = new Set<string>();
  private edgeUp = new Set<string>();
  private since = new Map<string, number>();
  private analog = new Map<Source, { x: number; y: number }>();
  /** 마지막으로 쓴 입력 장치 (안내 글자 고르기용) */
  last: Source = 'kb';
  /** 켜면 장치별 입력을 합친 KeyboardEvent만 target에 보낸다 (키보드 원본은 차단). */
  synth = false;
  target: EventTarget | null = null;
  /** 메뉴가 열려 있으면 게임 입력을 막고 메뉴가 받는다 */
  capture: ((code: string, down: boolean, src: Source) => boolean) | null = null;
  private listeners: ((code: string, down: boolean, src: Source) => void)[] = [];
  private detach: (() => void) | null = null;
  now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  on(fn: (code: string, down: boolean, src: Source) => void): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((f) => f !== fn));
  }
  press(code: string, src: Source) {
    code = ALIAS[code] ?? code;
    this.last = src;
    if (this.capture?.(code, true, src)) return;
    const set = this.bySrc.get(src)!;
    if (set.has(code)) return;
    set.add(code);
    if (!this.down.has(code)) {
      this.down.add(code);
      this.edgeDown.add(code);
      this.since.set(code, this.now());
      this.emit(code, true);
      for (const f of this.listeners) f(code, true, src);
    }
  }
  release(code: string, src: Source) {
    code = ALIAS[code] ?? code;
    const set = this.bySrc.get(src)!;
    if (!set.delete(code)) {
      this.capture?.(code, false, src);
      return;
    }
    for (const s of this.bySrc.values()) if (s.has(code)) return;
    this.down.delete(code);
    this.edgeUp.add(code);
    this.emit(code, false);
    for (const f of this.listeners) f(code, false, src);
  }
  releaseSource(src: Source) {
    for (const c of [...this.bySrc.get(src)!]) this.release(c, src);
    this.analog.delete(src);
  }
  releaseAll() {
    for (const s of ['kb', 'touch', 'pad'] as Source[]) this.releaseSource(s);
  }
  held(code: string): boolean {
    return this.down.has(code);
  }
  /** 누르고 있던 시간(초). 안 누르면 0 */
  heldFor(code: string): number {
    return this.down.has(code) ? (this.now() - (this.since.get(code) ?? this.now())) / 1000 : 0;
  }
  pressed(code: string): boolean {
    return this.edgeDown.has(code);
  }
  released(code: string): boolean {
    return this.edgeUp.has(code);
  }
  /** 매 프레임(엔진 틱) 끝에 부른다 */
  endFrame() {
    this.edgeDown.clear();
    this.edgeUp.clear();
  }
  setAnalog(src: Source, x: number, y: number) {
    if (x === 0 && y === 0) this.analog.delete(src);
    else this.analog.set(src, { x, y });
  }
  /** 이동 방향 -1~1. 아날로그(스틱)가 있으면 그 값, 없으면 방향키 */
  axis(): { x: number; y: number } {
    let x = 0,
      y = 0;
    for (const a of this.analog.values()) (x += a.x), (y += a.y);
    if (x === 0 && y === 0) {
      x = (this.held('ArrowRight') ? 1 : 0) - (this.held('ArrowLeft') ? 1 : 0);
      y = (this.held('ArrowDown') ? 1 : 0) - (this.held('ArrowUp') ? 1 : 0);
    }
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }
  private emit(code: string, down: boolean) {
    if (!this.synth || !this.target || typeof KeyboardEvent === 'undefined') return;
    const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: KEY_OF[code] ?? code, bubbles: true, cancelable: true });
    (ev as unknown as Record<string, boolean>)[MARK] = true;
    this.target.dispatchEvent(ev);
  }
  /** 키보드 받기. 글 입력칸에 초점이 있으면 무시한다 */
  attachKeyboard(el: Window | HTMLElement, opts: { prevent?: (code: string) => boolean } = {}) {
    this.detach?.();
    const physical = new Set<string>();
    const onKey = (e: Event) => {
      const ev = e as KeyboardEvent;
      if ((ev as unknown as Record<string, boolean>)[MARK]) return;
      const t = ev.target as HTMLElement | null;
      const editing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (editing && ev.type === 'keydown') return;
      // The engine must only see the aggregate edge, including when a menu consumes it.
      if (this.synth) ev.stopImmediatePropagation();
      if (ev.type === 'keydown') {
        if (opts.prevent?.(ev.code) ?? true) ev.preventDefault();
        if (ev.repeat) return;
        physical.add(ev.code);
        this.press(ev.code, 'kb');
      } else {
        physical.delete(ev.code);
        const code = ALIAS[ev.code] ?? ev.code;
        if (![...physical].some(c => (ALIAS[c] ?? c) === code)) this.release(code, 'kb');
      }
    };
    const blur = () => { physical.clear(); this.releaseAll(); };
    const vis = () => document.hidden && blur();
    el.addEventListener('keydown', onKey);
    el.addEventListener('keyup', onKey);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    this.detach = () => {
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
    };
  }
  dispose() {
    this.detach?.();
    this.releaseAll();
  }
}
